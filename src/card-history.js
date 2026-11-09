// The card's history data: the cache of what Home Assistant returned (history and
// long-term statistics), filled on demand for the time window shown, and the user's own
// state process function. Part of HistoryCardState (added to it in history-explorer-card.js).

import { colorEntityOf } from "./card-datasets.js";
import { seriesOf, attributeHistories, msOf } from "./history-series.js";
import { STATE_NOT_LISTED, OPTION_DEFAULTS, YEAR_HOURS, MAX_RANGE_YEARS, STATS_EXPORT_PERIODS } from "./history-options.js";
import { HORIZON } from "./card-yscale.js";
import { haRequests } from "./ha-requests.js";
const moment = window.HXLocal_moment;

// The period of the long-term statistics asked, in ms (statistics.period)
const PERIOD_MS = { '5minute': 300e3, hour: 3600e3, day: 86400e3, week: 7 * 86400e3, month: 30 * 86400e3 };
// (a period it doesn't know: the default one's)
const periodMs = p => PERIOD_MS[p] ?? PERIOD_MS[OPTION_DEFAULTS.statistics.period];
// Home Assistant's short-term statistics: every 5 minutes, kept as long as the history
// (recorder purge_keep_days) — what it returns is taken, nothing assumed
const FINE_PERIOD = '5minute';
// Home Assistant's daily statistics, from its hourly ones: for a window where a column of
// pixels lasts a day or more (the statistics of the period shorter than a day)
const DAY_PERIOD = 'day';
// Home Assistant's weekly and monthly statistics: for a column of pixels of a week, a month
// or more (a month counted 30 days), and as a coarse source drawn first
const WEEK_PERIOD = 'week', MONTH_PERIOD = 'month';
// A shown entity changed: its recent history refreshed at most once every 2 s, never sooner
// than five times what drawing the graphs again last took (see scheduleAutoRefresh)
const AUTO_REFRESH_MIN_MS = 2000, AUTO_REFRESH_BUILD_FACTOR = 5;
// A year's days, and the cache's days at most: twice the longest time range, for the window
// to be moved back a whole range
const YEAR_DAYS = YEAR_HOURS / 24, CACHE_MAX_DAYS = 2 * MAX_RANGE_YEARS * YEAR_DAYS;
// The start of the day n days after day d (a date or a slot's start), as a cache slot's
// bounds are written: local time, "YYYY-MM-DDT00:00:00"
const dayAfter = (d, n) => moment(d).add(n, "day").format("YYYY-MM-DD") + "T00:00:00";
// Where each kind of request goes in a cache slot: the history (by hours), the 5-minute
// statistics, the statistics of the period, the daily, weekly and monthly ones — from the finest
const LAYER = { month: 'month', week: 'week', day: 'day', stats: 'stats', fine: 'fine', history: 'hist' };
const LAYERS = ['hist', 'fine', 'stats', 'day', 'week', 'month'];
// The period of a kind of statistics request (Home Assistant's)
const periodOfKind = (kind, period) => ( { fine: FINE_PERIOD, day: DAY_PERIOD, week: WEEK_PERIOD, month: MONTH_PERIOD } )[kind] ?? period;
// The first pass, drawn at once while the window's own source comes: over the window, the
// coarsest statistics coarser than it still giving the window COARSE_POINTS values — else
// the next coarser one, if it gives it COARSE_MIN_POINTS —; over a window on each side
// (the automatic Y axis' only), the coarsest giving it SIDE_POINTS
const COARSE_POINTS = 100, COARSE_MIN_POINTS = 10, SIDE_POINTS = 3;
// Statistics of a period shorter than an entity's own would make up values between its own
// (a value held, drawn as twelve the same, then a step): told once a session, at the start, by
// probing its history (_probeFine) — its last PROBE_MS: its 5-minute statistics valid where the
// mean time between its values there (that time divided by their count; none: infinite) is
// under FINE_GAP_MS; its hourly ones too where it has HOUR_COUNT values there at least; else
// its last PROBE_LONG_MS: its hourly ones valid where that mean is under HOUR_GAP_MS — the
// daily, weekly and monthly ones always. Statistics not valid never used, drawn or exported
// (see _relevant). SENSOR_GAPS: by entity, { fine, hour } — whether they're valid
const PROBE_MS = 2 * 3600e3, FINE_GAP_MS = 4 * 60e3, HOUR_COUNT = 6, PROBE_LONG_MS = 8 * 3600e3, HOUR_GAP_MS = 48 * 60e3;
const SENSOR_GAPS = new Map();
// The history in blocks: a day's history kept by the hours it covers (a slot's cover, by
// entity: [from, to) ranges), asked over the window and a window on each side — whole hours,
// a block within a day, from the right (see _histPieces)
const HOUR_MS = 3600e3;
// (two lists of rows in time order, merged in time order)
function mergeRows(a, b)
{
    const out = [];
    let i = 0, j = 0;
    while( i < a.length || j < b.length )
        out.push(j >= b.length || ( i < a.length && msOf(a[i].last_changed) <= msOf(b[j].last_changed) ) ? a[i++] : b[j++]);
    return out;
}
// (ranges [a, b) in order: one more added, those touching it joined)
function addRange(list, a, b)
{
    const out = [];
    for( const r of [...list, [a, b]].sort((p, q) => p[0] - q[0]) ) {
        const l = out[out.length - 1];
        if( l && r[0] <= l[1] ) l[1] = Math.max(l[1], r[1]); else out.push([r[0], r[1]]);
    }
    return out;
}
// (the parts of [a, b) outside ranges list, in order)
function outside(a, b, list)
{
    const out = [];
    let x = a;
    for( const [p, q] of [...list].sort((u, v) => u[0] - v[0]) ) {
        if( q <= x ) continue;
        if( p >= b ) break;
        if( p > x ) out.push([x, Math.min(p, b)]);
        x = Math.max(x, q);
        if( x >= b ) break;
    }
    if( x < b ) out.push([x, b]);
    return out;
}
// Ahead of the gestures to come — the time panned, a zoom in or out —, the cache filled
// around the window, in steps, in the background (AHEAD_GAP_MS after the last request
// answered, or the window last changed — no gesture going on): the coarse source over
// AHEAD_COARSE[step] windows on each side, the window's own over AHEAD_FINE[step]
const AHEAD_COARSE = [1, 1, 2, 4], AHEAD_FINE = [0, 1, 1, 1];
// The background never loads Home Assistant: one request at a time, only when nothing else is
// under way nor a gesture going on, at least AHEAD_GAP_MS — and twice what the last one
// took — after the last one ended (Home Assistant busy for it a third of the time at most),
// never more than AHEAD_GAP_MAX_MS
const AHEAD_GAP_MS = 1000, AHEAD_GAP_MAX_MS = 30000;
// The cache filled ahead only while it holds fewer rows than this, all entities and layers
// together, nor would after the step — each source on its own: the window's rows of it
// times the windows added. A chatty sensor's history isn't filled ahead, the statistics
// around still are (a row: some 100 bytes)
const AHEAD_MAX_ROWS = 300000;
// Past this many rows in the cache (some 50 MB: a row of the history some 90 bytes, of the
// statistics some 160), the least useful purged until it's back under AHEAD_MAX_ROWS: the
// days farthest from the window first, their history first, then their 5-minute
// statistics, the hourly and daily ones last; never the window nor a window on each side
const CACHE_MAX_ROWS = 500000;
// How late Home Assistant may be with a period's statistics: it compiles them once the
// period has ended (within seconds — room left for it being slow)
const STATS_LAG = 10 * 60e3;

export class CardHistory
{
    // --------------------------------------------------------------------------------------
    // The cache: a slot a day, from cacheSize days ago to today (the last one — more added
    // as the days pass, _extendToNow). In each, by entity, its history (hist), its 5-minute
    // statistics (fine) and its statistics of the period, hourly by default (stats), as rows
    // — { last_changed, state }, a statistics row also statistics: { end, min, mean, max } —,
    // the daily, weekly and monthly ones too; an entity's rows
    // there only once loaded (an empty list: loaded, nothing in it); in each layer, when
    // each entity's rows were asked (askedAt: before the day's end, they lack what came
    // since), and the time they cover (cover: [from, to) ranges) — every source alike: what's
    // lacking is what isn't covered (_missing, _histPieces), a refresh cutting each one's
    // cover at the time it was asked (_forgetToday), the rows there kept and drawn until the
    // new ones come; the statistics by whole days, the history by whole hours (its blocks:
    // their state at the start, given with each, a boundary, b)
    // --------------------------------------------------------------------------------------

    _slot(d, e)
    {
        const _by = f => Object.fromEntries(LAYERS.map(l => [l, f()]));
        return { start: d, end: e, start_m: moment(d), end_m: moment(e), ..._by(() => new Map()), askedAt: _by(() => new Map()), cover: _by(() => new Map()) };
    }

    initCache()
    {
        let d = dayAfter(moment(), -this.cacheSize);

        for( let i = 0; i < this.cacheSize+1; i++ ) {
            let e = dayAfter(d, 1);
            this.cache.push(this._slot(d, e));
            d = e;
        }
    }

    growCache(growSize)
    {
        if( this.cacheSize >= CACHE_MAX_DAYS ) return;

        let e = this.cache[0].start;

        for( let i = 0; i < growSize; i++ ) {
            let d = dayAfter(e, -1);
            this.cache.unshift(this._slot(d, e));
            e = d;
        }

        this.cacheSize += growSize;
        // (the requests under way name their slots by index: moved with them)
        for( const q of this._requests ) { q.c0 += growSize; q.c1 += growSize; }
    }

    // Slots added for the days begun since the cache was made (a page left open past
    // midnight: today is a new slot)
    _extendToNow()
    {
        while( msOf(this.cache[this.cache.length - 1].end) <= Date.now() ) {
            const d = this.cache[this.cache.length - 1].end;
            this.cache.push(this._slot(d, dayAfter(d, 1)));
            this.cacheSize++;
        }
    }

    mapStartTimeToCacheSlot(t)
    {
        let mt = moment(t);

        for( let i = 0; i < this.cacheSize+1; i++ ) {
            if( mt >= this.cache[i].start_m && mt < this.cache[i].end_m ) return i;
        }

        if( mt < this.cache[0].start_m ) return 0;

        return -1;
    }

    mapEndTimeToCacheSlot(t)
    {
        let mt = moment(t);

        for( let i = 0; i < this.cacheSize+1; i++ ) {
            if( mt > this.cache[i].start_m && mt <= this.cache[i].end_m ) return i;
        }

        if( mt > this.cache[this.cacheSize].end_m ) return this.cacheSize;

        return -1;
    }

    // The entities whose history is loaded: those shown, and those giving a shown entity
    // its color (see colorEntityOf) — each once
    historyEntityIds()
    {
        const ids = new Set();
        for( const g of this.graphs ) for( const e of g.entities ) ids.add(e.entity);
        for( const id of this.colorEntityIds() ) ids.add(id);
        return [...ids];
    }

    // The entities giving a shown entity its color
    colorEntityIds()
    {
        const ids = new Set();
        for( const g of this.graphs ) for( const e of g.entities ) { const c = colorEntityOf(e); if( c ) ids.add(c); }
        return ids;
    }

    // The entities whose long-term statistics are asked: those Home Assistant keeps statistics
    // of (a state_class) — shown or giving a curve its color, however they're shown: a curve,
    // bars, a timeline, an arrowline; an angle too (its history asked besides: _angleIds) —,
    // not an attribute (no statistics); none when the statistics are off
    _statisticsIds()
    {
        if( !this.statistics.enabled ) return [];
        const ids = new Set();
        for( const id of this.historyEntityIds() )
            if( !seriesOf(id).attribute && this.stateOf(id)?.attributes?.state_class ) ids.add(id);
        return [...ids];
    }

    // The angles among the entities with statistics — circular (see circularPeriodOf) wherever
    // one of its uses takes it as such, the entity being in the cache once —: Home
    // Assistant may average them as plain numbers — wrong across 0 —, so their history is
    // asked besides wherever they're drawn from statistics (see _askMissing)
    _angleIds(statIds)
    {
        const _angles = new Set();
        for( const g of this.graphs ) for( const e of g.entities ) if( this.circularPeriodOf(e) ) _angles.add(e.entity);
        return statIds.filter(id => _angles.has(id));
    }

    // The coarsest source that gives each column of pixels its min, mean and max as exactly
    // as the history (to 1 px): of the statistics (_sources) — monthly, weekly, daily, of the
    // period (hourly), 5-minute —, the coarsest whose period a column lasts at least (a
    // month counted 30 days); else 'history'. Always 'history', the statistics off; never,
    // forced (statistics.force: the 5-minute ones at most)
    _sourceNeeded()
    {
        return this._sourceIn(this._sources());
    }
    // (the same within a ladder of sources S: an entity's, see _ladders)
    _sourceIn(S)
    {
        if( !this.statistics.enabled ) return 'history';
        const _px = Math.max(0, ...this.graphs.map(g => g.chart.hecPlotWidth()));
        const _column = moment(this.endTime).diff(moment(this.startTime)) / ( _px || 1000 );
        for( let k = S.length - 1; k >= 1; k-- ) if( _column >= S[k].ms ) return S[k].kind;
        return this.statistics.force && S[1] ? S[1].kind : 'history';
    }

    // An entity's rows over cache slots c0 to c1 — in each slot, the finest it has: its
    // history over the hours it covers, else its 5-minute statistics, its statistics of the
    // period…; and before the first row of a finer one, the coarser ones (where the recorder
    // no longer keeps the history or the 5-minute statistics: a day past their retention, or
    // the day it begins) — with, first, its last value before c0 when an earlier slot has it, so that
    // the graphs have one value just before the start of their own data (no interpolation
    // issue at the start of a curve, no state disappearing at the start of a timeline).
    // Empty when the cache has none. What the cache has is drawn at once, however coarse —
    // the daily statistics, the hourly ones, the 5-minute ones —, a finer layer replacing it
    // as it comes: the history too, when the window is drawn from it (_sourceNeeded)
    cachedHistory(entity, c0, c1, layers = null)
    {
        const _end = x => msOf(x.statistics?.end ?? x.last_changed);
        // (layers: those it may be drawn from — see _drawLayers —; else every one)
        const _layers = layers ? LAYERS.filter(l => layers.has(l)) : LAYERS;
        const _rows = s => _layers.reduceRight((coarser, layer) => {
            const a = s[layer].get(entity);
            // (the history over the hours it covers, the coarser ones around them)
            if( layer === 'hist' && a && coarser?.length ) {
                const cov = s.cover.hist.get(entity) ?? [];
                const out = coarser.filter(x => !cov.some(([p, q]) => msOf(x.last_changed) < q && _end(x) > p));
                return mergeRows(out, a);
            }
            if( !a || !coarser?.length ) return a ?? coarser;
            const _first = a.length ? msOf(a[0].last_changed) : Infinity;
            const _before = coarser.filter(x => _end(x) <= _first);
            return _before.length ? _before.concat(a) : a;
        }, undefined);
        let r = [];
        for( let i = c0; i <= c1; i++ ) {
            const a = _rows(this.cache[i]);
            if( a ) r = r.concat(a);
        }
        for( let i = c0 - 1; i >= 0; i-- ) {
            const a = _rows(this.cache[i]);
            if( !a ) break;
            if( a.length ) {
                const _last = a[a.length - 1];
                // (at its end — a week's, a month's no later than c0's start: never after the rows it precedes)
                r.unshift({ last_changed: Math.min(msOf(_last.statistics?.end ?? _last.last_changed), msOf(this.cache[c0].start)), state: _last.state });
                break;
            }
        }
        return r;
    }

    // The graphs' data for the time window shown, from the cache: one history per shown
    // entity, in the graphs' order (an empty one when the cache has none, so that the
    // indices stay in step with buildChartData), and the color entities' by entity_id
    generateGraphDataFromCache()
    {
        const _t = performance.now();
        let c0 = this.mapStartTimeToCacheSlot(this.startTime);
        let c1 = this.mapEndTimeToCacheSlot(this.endTime);

        if( c0 >= 0 && c1 >= 0 ) {
            const result = [];
            // (each from the layers its ladder allows: see _drawLayers)
            const _layers = this._drawLayers(this._statisticsIds());
            for( const g of this.graphs ) for( const e of g.entities ) result.push(this.cachedHistory(e.entity, c0, c1, _layers.get(e.entity)));
            const colorHistory = {};
            for( const id of this.colorEntityIds() ) colorHistory[id] = this.cachedHistory(id, c0, c1, _layers.get(id));
            this.buildChartData(result, colorHistory);
        } else
            this.buildChartData(null);
        // (how long the graphs took to be drawn again: the pace of the refreshes, see
        // scheduleAutoRefresh)
        this._lastBuildMs = performance.now() - _t;
        this.perf?.add('redraw', this._lastBuildMs);
    }

    // The graphs drawn again from the cache as soon as the page is free — once for all the
    // answers that came meanwhile (each answer is a task of its own: those that came while
    // the graphs were drawn are put in the cache before the next drawing)
    _drawSoon()
    {
        if( this._drawTid ) return;
        this._drawTid = setTimeout(() => {
            this._drawTid = 0;
            this.generateGraphDataFromCache();
        }, 0);
    }

    // --------------------------------------------------------------------------------------
    // Loading the window: what the cache lacks asked to Home Assistant
    // --------------------------------------------------------------------------------------

    // What the window shown needs from Home Assistant, asked — drawn at once from what the
    // cache has (its coarse source or finer: _drawLayers), then refined as the rest comes —,
    // entity by entity, each drawn as soon as its own answer comes, sent to Home Assistant by
    // pass, then in the graphs' order, as fast as it answers them (see ha-requests.js):
    // - first, once a session, each entity's history's last 2 hours — its last 8 when they
    //   hold few values —: the statistics valid for it (_relevant, _probeFine) — its ladder of
    //   sources (_ladders);
    // - the source a column of pixels needs (_sourceNeeded) for the window: its statistics in
    //   one request, its history in blocks — whole hours, a day at most, the most recent first
    //   (_histPieces), the cache keeping a day's history by the hours it covers;
    // - in three passes, each once the entity's one before has come:
    //   1. the coarse statistics (_coarseOf) over the whole window at once, and the coarsest
    //      giving a window SIDE_POINTS values (_sideOf) a window on each side — what the
    //      automatic Y axis looks at, never drawn —, where the cache has nothing finer;
    //   2. its own source over the window — the history of an entity without statistics too,
    //      taking its share of Home Assistant only (_shareOf);
    //   3. the coarse statistics a window on each side — the history, for an entity drawn
    //      from it — quietly: the window no longer loading;
    // - where a day of the window comes back empty, or starting late (the recorder no longer
    //   keeps it, or not all of it: past its retention), the next coarser statistics there;
    //   where all its statistics come back empty or starting late (deleted, or begun that day,
    //   after a change of unit), its history;
    // - where the statistics of the window aren't compiled yet (an hour's once it has ended):
    //   today, and yesterday until 1:10, the finer ones; then the history after the finest
    //   statistics — the last minutes —, in one request; the history of an entity whose
    //   statistics stop earlier there (Home Assistant late with them, or none);
    // - then, in the background (one request at a time, see _backgroundFree): the history of
    //   the angles drawn from statistics over the window first; then the cache filled further
    //   around the window in steps (see _scheduleAhead): the window's own source a window on
    //   each side, the coarse one — and the history of an entity drawn from it — up to
    //   AHEAD_COARSE windows, never past AHEAD_MAX_ROWS rows in the cache.
    // Nothing is asked twice: what the cache has, or a request under way will bring. The
    // graphs are drawn at once, from what the cache has — the window asked is the window
    // shown, whatever is loading —; each answer draws them again
    updateHistory()
    {
        this.showDate();
        this._askMissing();
        this.generateGraphDataFromCache();
    }

    // The sources of a curve with statistics, from the finest: the history, the 5-minute
    // statistics, those of the period (hourly by default), the daily, weekly and monthly ones — each its kind of
    // request and the time a value covers (ms)
    _sources()
    {
        const p = periodMs(this.statistics.period), l = [{ kind: 'history', ms: 0 }];
        if( p > PERIOD_MS[FINE_PERIOD] ) l.push({ kind: 'fine', ms: PERIOD_MS[FINE_PERIOD] });
        l.push({ kind: 'stats', ms: p });
        if( p < PERIOD_MS[DAY_PERIOD] ) l.push({ kind: 'day', ms: PERIOD_MS[DAY_PERIOD] });
        if( p < PERIOD_MS[WEEK_PERIOD] ) l.push({ kind: 'week', ms: PERIOD_MS[WEEK_PERIOD] });
        if( p < PERIOD_MS[MONTH_PERIOD] ) l.push({ kind: 'month', ms: PERIOD_MS[MONTH_PERIOD] });
        return l;
    }

    // The coarse source of the first pass for a window r ms long whose own is source (an
    // index in sources): the coarsest coarser than it still giving the window COARSE_POINTS
    // values or more — the fewest rows, the quickest to come —; else the next coarser one if
    // it gives it COARSE_MIN_POINTS; else none (-1): the window's own source first
    _coarseOf(sources, source, r)
    {
        for( let k = sources.length - 1; k > source; k-- ) if( r / sources[k].ms >= COARSE_POINTS ) return k;
        return source + 1 < sources.length && r / sources[source + 1].ms >= COARSE_MIN_POINTS ? source + 1 : -1;
    }

    // The statistics of the first pass a window r ms long on each side of it, for the
    // automatic Y axis only: the coarsest still giving it SIDE_POINTS values; else none (-1)
    _sideOf(sources, r)
    {
        for( let k = sources.length - 1; k >= 1; k-- ) if( r / sources[k].ms >= SIDE_POINTS ) return k;
        return -1;
    }

    // The entities with statistics by ladder of sources, for a window r ms long: { ids, S
    // (the ladder, from the finest), source (their own, _sourceNeeded), si, ci (the coarse
    // one, _coarseOf), vi (the very coarse one around the window, _sideOf) } — the statistics
    // not relevant for an entity left out of its ladder (_relevant): its own source the
    // history where they would be, its coarse one the first relevant
    _ladders(statIds, r)
    {
        const S0 = this._sources(), out = new Map();
        for( const id of statIds ) {
            const S = S0.filter((x, k) => !k || this._relevant(id, x.ms)), _key = S.map(x => x.kind).join();
            if( !out.has(_key) ) {
                const source = this._sourceIn(S), si = S.findIndex(x => x.kind === source);
                out.set(_key, { ids: [], S, source, si, ci: this._coarseOf(S, si, r), vi: this._sideOf(S, r) });
            }
            out.get(_key).ids.push(id);
        }
        return [...out.values()];
    }

    // Whether statistics of a period ms long are valid for entity id (see SENSOR_GAPS): not
    // probed yet, or the daily, weekly and monthly ones: valid
    _relevant(id, ms)
    {
        const g = SENSOR_GAPS.get(id);
        if( !g || ms >= PERIOD_MS.day ) return true;
        return ms <= PERIOD_MS[FINE_PERIOD] ? g.fine : g.hour;
    }

    // Entity id's values in its history in the cache from t to now — the state at a block's
    // start, given with it, left out
    _valuesSince(id, t)
    {
        const _now = Date.now();
        let n = 0;
        for( const s of this.cache ) for( const x of s.hist.get(id) ?? [] ) { const v = msOf(x.last_changed); if( !x.b && v > t && v <= _now ) n++; }
        return n;
    }

    // Whether the statistics of entities ids are valid (SENSOR_GAPS), before any is used:
    // their history's last PROBE_MS asked, their 5-minute ones told by it, their hourly ones
    // too with HOUR_COUNT values there at least; else their last PROBE_LONG_MS asked (the
    // hours already there not asked again), their hourly ones told by it. Kept in the cache;
    // no answer: every statistics valid
    _probeFine(ids)
    {
        if( this._fineProbing || !ids.length ) return;
        const _now = Date.now(), _gap = (n, ms) => n ? ms / n : Infinity;
        const _probe = (l, ms) => Promise.all(l.flatMap(id => this._histPieces(id, _now - ms, _now).map(p => this._askHist(id, p, { light: true })))).then(errors => errors.find(Boolean));
        this._fineProbing = true;
        _probe(ids, PROBE_MS).then(e => {
            if( e ) { for( const id of ids ) SENSOR_GAPS.set(id, { fine: true, hour: true }); return; }
            const _long = [];
            for( const id of ids ) {
                const n = this._valuesSince(id, _now - PROBE_MS);
                SENSOR_GAPS.set(id, { fine: _gap(n, PROBE_MS) < FINE_GAP_MS, hour: n >= HOUR_COUNT });
                if( n < HOUR_COUNT ) _long.push(id);
            }
            if( _long.length ) return _probe(_long, PROBE_LONG_MS).then(e2 => {
                for( const id of _long ) SENSOR_GAPS.get(id).hour = !e2 ? _gap(this._valuesSince(id, _now - PROBE_LONG_MS), PROBE_LONG_MS) < HOUR_GAP_MS : true;
            });
        }).finally(() => { this._fineProbing = false; this._askMissing(); this._drawSoon(); });
    }

    // The layers of the cache an entity's curve is drawn from, the window shown — those of
    // its ladder (_ladders) from the finest to its coarse source (none: the next coarser than
    // its own, where a day of it comes back empty) —: never the very coarse ones around the
    // window (the automatic Y axis' only), nor the 5-minute statistics of an entity without
    // them. null: every one (an entity without statistics: its history only)
    _drawLayers(statIds)
    {
        const r = msOf(this.endTime) - msOf(this.startTime), out = new Map();
        for( const g of this._ladders(statIds, r) ) {
            const k = g.ci >= 0 ? g.ci : Math.min(g.si + 1, g.S.length - 1);
            const l = new Set(g.S.slice(0, k + 1).map(x => LAYER[x.kind]));
            for( const id of g.ids ) out.set(id, l);
        }
        return out;
    }

    // The blocks of entity id's history from A to B (ms) still to ask — not covered, nor under
    // way —, from the right: whole hours (A and B rounded out to them, B no later than now's),
    // never across midnight (a block within a day: a slot) — { i: its slot, a, b }
    _histPieces(id, A, B)
    {
        if( !this.cache.length ) return [];
        // (a block reaching now covers its hour to its end: what comes later, asked by a refresh — see _forgetToday)
        A = Math.max(msOf(this.cache[0].start), Math.floor(A / HOUR_MS) * HOUR_MS);
        B = Math.min(msOf(this.cache[this.cache.length - 1].end), Math.ceil(Math.min(B, Date.now()) / HOUR_MS) * HOUR_MS);
        if( B <= A ) return [];
        const i0 = this.mapStartTimeToCacheSlot(moment(A)), i1 = this.mapEndTimeToCacheSlot(moment(B)), out = [];
        if( i0 < 0 || i1 < 0 ) return [];
        const _flying = this._requests.filter(q => q.kind === 'history' && q.b0 !== undefined && q.ids.has(id)).map(q => [q.b0, q.b1]);
        for( let i = i1; i >= i0; i-- ) {
            const s = this.cache[i], a = Math.max(A, msOf(s.start)), b = Math.min(B, msOf(s.end));
            if( b <= a ) continue;
            const _parts = outside(a, b, [...( s.cover.hist.get(id) ?? [] ), ..._flying]);
            for( let k = _parts.length - 1; k >= 0; k-- ) out.push({ i, a: _parts[k][0], b: _parts[k][1] });
        }
        return out;
    }

    // Whether entity id's history in slot i covers A to B (ms) — the slot's part of it, until now
    _histCovers(i, id, A, B)
    {
        const s = this.cache[i], cov = s.cover.hist.get(id);
        if( !cov ) return false;
        const a = Math.max(A, msOf(s.start)), b = Math.min(B, msOf(s.end), Date.now());
        return b <= a || !outside(a, b, cov).length;
    }

    // A block of entity id's history asked (p: see _histPieces); o: { pass, quiet, background,
    // share (see _shareOf) }
    _askHist(id, p, o = {})
    {
        return this._ask('history', p.i, p.i, new Set(Array.isArray(id) ? id : [id]), p.a, !!o.quiet, !!o.background, { pass: o.pass, until: p.b, share: o.share });
    }

    // The series ids by request: each on its own, an entity's attributes together — one
    // request for their entity's history with its attributes (see historyCall)
    _histUnits(ids)
    {
        const out = new Map();
        for( const id of ids ) {
            const _k = seriesOf(id).attribute ? 'attributes of ' + seriesOf(id).entity : id;
            if( !out.has(_k) ) out.set(_k, []);
            out.get(_k).push(id);
        }
        return [...out.values()];
    }

    // An entity without statistics shares Home Assistant (see ha-requests.js): its history
    // asked, while the others load, at most 1 / the curves' count of what Home Assistant does
    // for the window (key: the window's) — all of it once alone
    _shareOf(id, hasStats, key)
    {
        return hasStats.has(id) ? null : { key: id, n: this.historyEntityIds().length, epoch: key };
    }

    // A block of history put in slot i's cache: its rows from a to b (ms) in place of those
    // there — its first, the state at a given with it, a boundary (b), dropped where the hours
    // before it are covered too —, the hours covered (cover) joined
    _mergeHist(i, id, rows, a, b)
    {
        const s = this.cache[i], old = s.hist.get(id) ?? [];
        const _add = rows.map((x, k) => !k && msOf(x.last_changed) <= a ? { ...x, b: true } : x);
        const cov = addRange(s.cover.hist.get(id) ?? [], a, b);
        const _keep = old.filter(x => { const t = msOf(x.last_changed); return t < a || t >= b; });
        s.hist.set(id, mergeRows(_keep, _add).filter(x => !x.b || !cov.some(([p, q]) => p < msOf(x.last_changed) && msOf(x.last_changed) <= q)));
        s.cover.hist.set(id, cov);
    }

    // The slots from t0 to t1 (ms; until now, from the cache's first): [first, last]
    _slotsOf(t0, t1)
    {
        return [this.mapStartTimeToCacheSlot(Math.max(t0, this.cache[0].start_m.valueOf())), this.mapEndTimeToCacheSlot(Math.min(t1, Date.now()))];
    }

    // What the window lacks asked (see updateHistory)
    _askMissing()
    {
        // Prime the cache on first call; a slot for each day begun since
        if( !this.cache.length ) this.initCache();
        this._extendToNow();

        const t0 = msOf(this.startTime), t1 = msOf(this.endTime), r = t1 - t0;
        // (a new window, or new curves: the cache filled around it from the first step again)
        const _key = [this.startTime, this.endTime, ...this.historyEntityIds()].join();
        if( _key !== this._aheadKey ) { this._aheadKey = _key; this._ahead = 0; this._aheadFine = true; }
        const _step = this._ahead ?? 0;

        // Check if we need to grow the cache due to an overflow
        // (a year at a time, until it reaches the window's start and the coarse source's
        // before it — 10 years at most, see growCache)
        const _from = t0 - AHEAD_COARSE[_step] * r;
        while( _from < this.cache[0].start_m.valueOf() && this.cacheSize < CACHE_MAX_DAYS ) this.growCache(YEAR_DAYS);

        const c0 = this.mapStartTimeToCacheSlot(this.startTime);
        const c1 = this.mapEndTimeToCacheSlot(this.endTime);
        const _ids = this.historyEntityIds();
        if( c0 < 0 || c1 < 0 || !_ids.length ) return;
        const _statIds = this._statisticsIds(), _hasStats = new Set(_statIds);
        // (the statistics, before any is used: each entity's history probed first, once a
        // session — nothing else asked meanwhile, see _probeFine)
        if( this._sources().some(x => x.kind === 'fine') ) {
            const _unknown = _statIds.filter(id => !SENSOR_GAPS.has(id));
            if( _unknown.length || this._fineProbing ) { this._probeFine(_unknown); this.state.loading = this._loading(); return; }
        }
        // (each entity's ladder of sources — the 5-minute statistics left out where its
        // history is sparser —, its own source, its coarse one, the very coarse one around the
        // window: _ladders; the entities by ladder, groups)
        const _groups = this._ladders(_statIds, r), G = new Map();
        for( const g of _groups ) for( const id of g.ids ) G.set(id, g);
        // (does slot i have a source of entity id as fine as its ladder's k-th or finer — the
        // history where it covers that day's part of the window, A to B?)
        const _hasFrom = (i, id, k, A = t0, B = t1) => ( G.get(id)?.S ?? [{ kind: 'history' }] ).slice(0, k + 1).some(x => x.kind === 'history'
            ? this._histCovers(i, id, A, B) : this.cache[i][LAYER[x.kind]].has(id));
        // (an entity drawn from its history over the window: without statistics, or its own source the history)
        const _histDrawn = id => !G.has(id) || G.get(id).source === 'history';

        // (the angles drawn from statistics — their history over the window first of the
        // background, see below —: a part of it still to ask)
        const _angles = new Set(this._angleIds(_statIds).filter(id => !_histDrawn(id)));
        let _anglesPending = false;
        for( const id of _angles ) if( this._histPieces(id, t0, t1).length ) _anglesPending = true;

        // Pass 1: the coarse source over the window, the coarsest giving a window SIDE_POINTS
        // values a window on each side, where nothing finer is there — the window's own source
        // asked once all of it has come
        const [a0, a1] = this._slotsOf(t0 - AHEAD_COARSE[0] * r, t1 + AHEAD_COARSE[0] * r);
        // (entity by entity — each drawn as soon as its own answer comes —, the coarse one over
        // the whole window at once)
        for( const g of _groups ) for( const id of g.ids ) {
            if( g.ci >= 0 ) this._askRuns(g.S[g.ci].kind, c0, c1, [id], i => !_hasFrom(i, id, g.ci), c0, c1, false, { pass: 1 });
            if( g.vi >= 0 && a0 >= 0 && a1 >= 0 ) this._askRuns(g.S[g.vi].kind, a0, a1, [id], i => ( i < c0 || i > c1 ) && !_hasFrom(i, id, g.vi, t0 - r, t1 + r), a0, a1, false, { pass: 1, light: true });
        }
        // (an entity whose own pass 1 is still under way: its pass 2 waits for it alone)
        const _pass1Ids = new Set();
        for( const q of this._requests ) if( q.pass === 1 && q.key === _key ) for( const id of q.ids ) _pass1Ids.add(id);
        const _pass1 = id => _pass1Ids.has(id);

        // The window's own statistics — where they aren't compiled yet, the finer ones there —
        // and, where a day comes back empty (past the recorder's retention), the next coarser
        const _period = periodMs(this.statistics.period);
        // (a source of a day that came back empty, or whose first value comes well after the
        // day's start — a period of it, a minute for the history: the recorder's retention)
        const _empty = (i, id, x) => {
            const a = this.cache[i][LAYER[x.kind]].get(id);
            return !!a && ( !a.length || msOf(a[0].last_changed) > this.cache[i].start_m.valueOf() + Math.max(x.ms, 60e3) );
        };
        // (each ladder's finest statistics — its layer and their period: the history after them)
        const _finestOf = g => g.S[1] ? { layer: LAYER[g.S[1].kind], ms: g.S[1].ms } : null;
        for( const g of _groups ) {
            const S = g.S, si = g.si, _wanted = new Map(S.map(x => [x.kind, new Set()]));
            for( let i = c0; i <= c1; i++ ) for( const id of g.ids ) {
                let k = si;
                // (not compiled yet: the finer statistics, down to the finest of its ladder)
                while( k > 1 && this._lacksStatistics(i, S[k].ms) ) k--;
                if( k >= 1 ) _wanted.get(S[k].kind).add(i + ' ' + id);
                if( k !== si && si >= 1 ) _wanted.get(S[si].kind).add(i + ' ' + id);
                // (empty, or starting late: the next coarser)
                for( let j = si; j + 1 < S.length && _empty(i, id, S[j]); j++ ) _wanted.get(S[j + 1].kind).add(i + ' ' + id);
            }
            for( const id of g.ids ) if( !_pass1(id) ) for( const x of S.slice(1) ) this._askRuns(x.kind, c0, c1, [id], i => _wanted.get(x.kind).has(i + ' ' + id), c0, c1, false, { pass: 2 });
            // The history after the finest statistics — what Home Assistant hasn't compiled
            // yet —, from their period and STATS_LAG ago to now, in one request
            // (history blocks, as any: see _histPieces)
            const f = _finestOf(g), _from = Date.now() - ( f?.ms ?? 0 ) - STATS_LAG;
            if( g.source !== 'history' && f && _from < t1 ) for( const id of g.ids ) if( !_pass1(id) )
                for( const p of this._histPieces(id, Math.max(_from, t0), t1) ) this._askHist(id, p, { pass: 2 });
        }

        // The history each day needs: everything when it tells more; else the entities
        // without statistics, and those whose finest statistics stop early on a recent day
        // (and, the other way round, where a day's statistics came back empty or starting late
        // — every one loaded there: deleted, or begun that day, after a change of unit; never
        // compiled —, its history)
        const _noStatistics = (i, id) => {
            const S = G.get(id).S.slice(1), _loaded = S.filter(x => this.cache[i][LAYER[x.kind]].has(id));
            // (once every one asked there has come: a coarser one may yet fill it)
            return _loaded.length > 0 && _loaded.every(x => _empty(i, id, x)) && !S.some(x => this._askedFor(x.kind, i, id));
        };
        const _stopEarly = (i, id) => { const f = _finestOf(G.get(id)); return !!f && this._statisticsStopEarly(i, id, f.layer, f.ms); };
        const _histWanted = (i, id) => _histDrawn(id) || _stopEarly(i, id) || _noStatistics(i, id);
        // (entity by entity, in the graphs' order — its pass 1 come —, in blocks: whole hours,
        // a day at most, the most recent first — see _histPieces; an entity without statistics
        // taking its share of Home Assistant only, while the others load: _shareOf)
        for( const u of this._histUnits(_ids) ) {
            if( u.some(_pass1) ) continue;
            for( const p of this._histPieces(u[0], t0, t1) ) if( u.some(id => _histWanted(p.i, id)) ) this._askHist(u, p, { pass: 2, share: this._shareOf(u[0], _hasStats, _key) });
        }

        // (an entity whose window has come — its passes 1 and 2 —: its pass 3; the whole window's: the background)
        const _under = new Set();
        for( const q of this._requests ) if( !q.quiet && q.c0 <= c1 && q.c1 >= c0 ) for( const id of q.ids ) _under.add(id);
        const _windowDone = !_under.size && !_pass1Ids.size;

        // Pass 3, once the window has come — passes 1 and 2, above —: the coarse source a window on
        // each side, quietly — the history for an entity drawn from it —; further, ahead, in the background
        // (the history's only while the cache stays under AHEAD_MAX_ROWS with twice the window's
        // more: a chatty sensor's history never taken further than the window)
        const _sides = this._histUnits(_ids.filter(id => _histDrawn(id) && !_under.has(id) && !_pass1(id))).flatMap(u => this._histPieces(u[0], t0 - r, t1 + r).map(p => ( { id: u, p } )));
        if( _sides.length && !( this._aheadFine && this.cacheRows() + 2 * this._windowRows(['hist']) <= AHEAD_MAX_ROWS ) ) this._aheadFine = false;
        else for( const { id, p } of _sides ) this._askHist(id, p, { pass: 3, quiet: true, share: this._shareOf(id[0], _hasStats, _key) });
        for( const g of _groups ) {
            if( g.ci < 0 ) continue;
            if( a0 >= 0 && a1 >= 0 ) for( const id of g.ids ) if( !_under.has(id) && !_pass1(id) )
                this._askRuns(g.S[g.ci].kind, a0, a1, [id], i => ( i < c0 || i > c1 ) && !_hasFrom(i, id, g.ci, t0 - r, t1 + r), c0, c1, false, { pass: 3 });
            if( _windowDone && AHEAD_COARSE[_step] > AHEAD_COARSE[0] && !_anglesPending ) {
                const [b0, b1] = this._slotsOf(t0 - AHEAD_COARSE[_step] * r, t1 + AHEAD_COARSE[_step] * r);
                const W = AHEAD_COARSE[_step] * r;
                if( b0 >= 0 && b1 >= 0 ) this._askRuns(g.S[g.ci].kind, b0, b1, g.ids, (i, id) => ( i < a0 || i > a1 ) && !_hasFrom(i, id, g.ci, t0 - W, t1 + W), c0, c1, true);
            }
        }

        // Angles drawn from statistics (the window's own source a statistics one): their history
        // over the window once it has come, first of the background — as the background, one
        // part at a time, Home Assistant free (_backgroundFree) —, a few days at a time, the
        // most recent first, each drawn as it comes (the points worked out again from it:
        // their mean, min and max); then a window on each side, with the rest of the background
        if( _windowDone && _anglesPending ) {
            const _next = this._histUnits([..._angles]).map(u => ( { id: u, p: this._histPieces(u[0], t0, t1)[0] } )).filter(x => x.p).sort((a, b) => b.p.b - a.p.b)[0];
            if( _next && this._backgroundFree() ) this._askHist(_next.id, _next.p, { background: true });
        }

        // The window's own source a window on each side, ahead, in the background (see
        // _scheduleAhead) — the statistics, or the history it is drawn from; the history of the
        // entities without statistics, and of the angles drawn from statistics, too
        if( AHEAD_FINE[_step] && this._aheadFine ) {
            const [b0, b1] = this._slotsOf(t0 - AHEAD_FINE[_step] * r, t1 + AHEAD_FINE[_step] * r);
            if( b0 >= 0 && b1 >= 0 ) {
                const _out = i => i < c0 || i > c1;
                for( const g of _groups ) if( g.si >= 1 ) this._askRuns(g.S[g.si].kind, b0, b1, g.ids, (i, id) => _out(i) && !_hasFrom(i, id, g.si), c0, c1, true);
            }
        }
        // (the history of the entities drawn from it and of the angles: as far as the coarse
        // statistics go, a block at a time, the nearest the window first)
        if( _windowDone && AHEAD_COARSE[_step] > AHEAD_COARSE[0] && this._aheadFine && !_anglesPending ) {
            const W = AHEAD_COARSE[_step] * r, _mid = ( t0 + t1 ) / 2;
            const _next = this._histUnits(_ids.filter(id => _histDrawn(id) || _angles.has(id))).flatMap(u => this._histPieces(u[0], t0 - W, t1 + W).map(p => ( { id: u, p } )))
                .sort((x, y) => Math.abs(( x.p.a + x.p.b ) / 2 - _mid) - Math.abs(( y.p.a + y.p.b ) / 2 - _mid))[0];
            if( _next && this._backgroundFree() ) this._askHist(_next.id, _next.p, { background: true });
        }

        // (what the CSV exports can't tell yet, once the window has come: probed in the background)
        if( _windowDone ) this._probeExports(c0, c1, _statIds, c0, c1);

        this.state.loading = this._loading();
        this._scheduleAhead();
    }

    // The next step ahead (AHEAD_COARSE, AHEAD_FINE), once the user has looked at the graphs
    // without moving them for AHEAD_GAP_MS, nothing under way — each window change, each
    // answer starting the wait again
    _scheduleAhead()
    {
        clearTimeout(this._aheadTid);
        if( ( this._ahead ?? 0 ) >= AHEAD_COARSE.length - 1 ) return;
        this._aheadTid = setTimeout(() => {
            if( this._requests.length || this.state.drag ) return this._scheduleAhead();
            // (the cache kept reasonable: no part of a step that would take it past
            // AHEAD_MAX_ROWS — the window's own source no longer filled ahead, the coarse one
            // still, while it fits)
            const _next = ( this._ahead ?? 0 ) + 1, _rows = this.cacheRows();
            const S = this._sources(), si = S.findIndex(x => x.kind === this._sourceNeeded());
            const ci = this._coarseOf(S, si, msOf(this.endTime) - msOf(this.startTime));
            const _fine = 2 * ( AHEAD_FINE[_next] - AHEAD_FINE[_next - 1] ) * this._windowRows([LAYER[S[si].kind]]);
            if( _rows + _fine > AHEAD_MAX_ROWS ) this._aheadFine = false;
            const _coarse = ci < 0 ? 0 : 2 * ( AHEAD_COARSE[_next] - AHEAD_COARSE[_next - 1] ) * this._windowRows([LAYER[S[ci].kind]]);
            if( _rows + ( this._aheadFine ? _fine : 0 ) + _coarse > AHEAD_MAX_ROWS ) return;
            this._ahead = _next;
            this._askMissing();
        }, AHEAD_GAP_MS);
    }

    // The cache kept under CACHE_MAX_ROWS rows: past it, the least useful rows purged until
    // it's back under AHEAD_MAX_ROWS (see CACHE_MAX_ROWS) — a day purged is asked again when
    // it's needed, drawn meanwhile from the coarser statistics kept
    _purge()
    {
        let n = this.cacheRows();
        if( n <= CACHE_MAX_ROWS ) return;
        const t0 = msOf(this.startTime), t1 = msOf(this.endTime), r = t1 - t0;
        const [k0, k1] = this._slotsOf(t0 - r, t1 + r);
        if( k0 < 0 || k1 < 0 ) return;
        const _far = [];
        for( let i = 0; i < this.cache.length; i++ ) if( i < k0 || i > k1 ) _far.push(i);
        _far.sort((a, b) => Math.max(k0 - b, b - k1) - Math.max(k0 - a, a - k1));
        // (the layers from the finest — the biggest)
        for( const l of LAYERS ) for( const i of _far ) {
            const s = this.cache[i];
            for( const [id, a] of s[l] ) {
                n -= a.length;
                s[l].delete(id); s.askedAt[l].delete(id); s.cover[l].delete(id);
            }
            if( n <= AHEAD_MAX_ROWS ) { this._cacheVersion = this.cacheVersion() + 1; return; }
        }
        this._cacheVersion = this.cacheVersion() + 1;
    }

    // May a request be made in the background now — nothing under way, no gesture going on,
    // the pause after the last one over? If not, the cache is looked at again once it is
    _backgroundFree()
    {
        const _wait = ( this._backgroundNext ?? 0 ) - Date.now();
        if( !this._requests.length && !haRequests.busy() && !this.state.drag && _wait <= 0 ) return true;
        clearTimeout(this._backgroundTid);
        this._backgroundTid = setTimeout(() => { this._backgroundTid = 0; if( !this._requests.length ) this._askMissing(); }, Math.min(AHEAD_GAP_MAX_MS, Math.max(_wait, AHEAD_GAP_MS)));
        return false;
    }

    // --------------------------------------------------------------------------------------
    // The CSV export: from the cache first, what it lacks asked to Home Assistant
    // --------------------------------------------------------------------------------------

    // The cache layer and the kind of request of an export's source — 'history', or a
    // statistics period (STATS_EXPORT_PERIODS) —, none when the cache doesn't keep it (the
    // hourly statistics, statistics.period being a day)
    _exportSource(source)
    {
        if( source === 'history' ) return { kind: 'history', layer: 'hist' };
        const _kind = ['fine', 'stats', 'day', 'week', 'month'].find(k => periodOfKind(k, this.statistics.period) === source);
        return _kind ? { kind: _kind, layer: LAYER[_kind] } : null;
    }

    // The rows of a source over the window shown (see _exportSource), by entity, as Home
    // Assistant gives them — the history { lu, s(, a) }, the statistics { start, end, state,
    // mean, min, max, sum } —: what the cache has, the days it lacks asked to Home Assistant
    // (and kept there); with the attributes, or a source the cache doesn't keep, all asked
    // → a promise of { id: rows }
    exportRows(source, ids, withAttributes = false)
    {
        // (statistics not relevant for an entity — see _relevant —: none of it, they would make up values)
        if( source !== 'history' ) ids = ids.filter(id => this._relevant(id, PERIOD_MS[source] ?? 0));
        const t0 = msOf(this.startTime), t1 = msOf(this.endTime), _src = this._exportSource(source);
        if( !ids.length ) return Promise.resolve({});
        if( !this.cache.length || withAttributes || !_src )
            return this._askHA(source === 'history' ? this.historyRequest(ids, moment(t0), moment(t1), withAttributes) : this.statisticsRequest(ids, moment(t0), moment(t1), source));
        const c0 = this.mapStartTimeToCacheSlot(this.startTime), c1 = this.mapEndTimeToCacheSlot(this.endTime);
        // (the days lacking, a request for each run of them; those under way waited for)
        const _waits = [];
        let run = null;
        const _flush = () => { if( run ) _waits.push(this._ask(_src.kind, run.c0, run.c1, run.ids)); run = null; };
        // (the history: its blocks lacking over the window — see _histPieces)
        if( _src.kind === 'history' ) for( const u of this._histUnits(ids) ) for( const p of this._histPieces(u[0], t0, t1) ) _waits.push(this._askHist(u, p));
        else for( let i = c0; i <= c1; i++ ) {
            const _n = ids.filter(id => this._missing(i, _src.layer, id) && !this._askedFor(_src.kind, i, id));
            if( !_n.length ) { _flush(); continue; }
            if( run ) { run.c1 = i; _n.forEach(id => run.ids.add(id)); } else run = { c0: i, c1: i, ids: new Set(_n) };
        }
        _flush();
        const _under = () => this._requests.some(q => q.kind === _src.kind && q.c0 <= c1 && q.c1 >= c0);
        const _wait = () => new Promise(r => { const _k = () => _under() ? setTimeout(_k, 50) : r(); _k(); });
        // (a request of it failing: the export fails — no file of what came)
        return Promise.all(_waits).then(errors => { const e = errors.find(Boolean); if( e ) throw e; }).then(_wait).then(() => {
            const out = {};
            for( const id of ids ) {
                const rows = [];
                for( let i = c0; i <= c1; i++ ) rows.push(...( this.cache[i][_src.layer].get(id) ?? [] ));
                if( source === 'history' ) {
                    // (as Home Assistant gives it: the state in force at the start, at the start's time)
                    const _in = rows.filter(x => msOf(x.last_changed) >= t0 && msOf(x.last_changed) < t1).map(x => ({ lu: msOf(x.last_changed) / 1000, s: x.state }));
                    const _before = rows.filter(x => msOf(x.last_changed) < t0).pop();
                    if( _before && !( _in.length && _in[0].lu * 1000 === t0 ) ) _in.unshift({ lu: t0 / 1000, s: _before.state });
                    if( _in.length ) out[id] = _in;
                } else {
                    const _in = rows.filter(x => msOf(x.last_changed) >= t0 && msOf(x.last_changed) < t1)
                                    .map(x => ({ start: msOf(x.last_changed), end: msOf(x.statistics.end), ...( x.statistics.raw ?? { mean: x.statistics.mean, min: x.statistics.min, max: x.statistics.max } ) }));
                    if( _in.length ) out[id] = _in;
                }
            }
            return out;
        });
    }

    // What the window has, at least in part, for each export (ids: the entities exported):
    // { history: n, periods: { period: n }, statistics: n — the entities with data —, cached:
    // { period: true when the cache holds it over the whole window for every one of them } }.
    // From what the cache knows, and Home Assistant's recorder: its hourly, daily, weekly and
    // monthly statistics come from the same long-term statistics (one known, all known); its
    // 5-minute statistics are kept as long as its history (one known, the other too, for an
    // entity with statistics); an entity without statistics (no state class, an attribute, an
    // angle) has none. What isn't known yet is probed in the background (_probeExports)
    exportAvailability(ids)
    {
        const out = { history: 0, statistics: 0, periods: Object.fromEntries(STATS_EXPORT_PERIODS.map(p => [p.period, 0])), cached: {} };
        if( !this.cache.length ) return out;
        const c0 = this.mapStartTimeToCacheSlot(this.startTime), c1 = this.mapEndTimeToCacheSlot(this.endTime);
        if( c0 < 0 || c1 < 0 ) return out;
        const _stats = new Set(this._statisticsIds());
        for( const id of ids ) {
            const a = this._availability(id, c0, c1, _stats.has(id));
            if( a.short ) out.history++;
            // (a period counted only where relevant for it: see _relevant)
            const _fine = a.short && _stats.has(id) && this._relevant(id, PERIOD_MS['5minute']), _long = ['hour', 'day', 'week', 'month'].filter(p => a.long && this._relevant(id, PERIOD_MS[p]));
            if( _fine ) out.periods['5minute']++;
            for( const p of _long ) out.periods[p]++;
            if( _fine || _long.length ) out.statistics++;
        }
        for( const p of STATS_EXPORT_PERIODS.map(x => x.period) ) {
            const _src = this._exportSource(p), _with = ids.filter(id => _stats.has(id) && this._relevant(id, PERIOD_MS[p] ?? 0));
            out.cached[p] = !!_src && out.periods[p] > 0 && _with.every(id => { for( let i = c0; i <= c1; i++ ) if( this._missing(i, _src.layer, id) ) return false; return true; });
        }
        return out;
    }

    // Has entity id's window (slots c0 to c1) data of the short-term family — its history, its
    // 5-minute statistics (stats: it has statistics) — and of the long-term one, at least in
    // part? { short, long, shortKnown, longKnown } — known: some layer of it loaded there
    _availability(id, c0, c1, stats)
    {
        // (a layer loaded and empty tells only when its period can end within the window: a
        // month's, empty over a day, tells nothing)
        const r = msOf(this.endTime) - msOf(this.startTime), _ms = { stats: periodMs(this.statistics.period), day: PERIOD_MS[DAY_PERIOD], week: PERIOD_MS[WEEK_PERIOD], month: PERIOD_MS[MONTH_PERIOD] };
        const _of = layers => { let known = false, has = false;
            for( let i = c0; i <= c1; i++ ) for( const l of layers ) { const a = this.cache[i][l].get(id); if( a?.length ) has = known = true; else if( a && ( _ms[l] ?? 0 ) <= r ) known = true; }
            return { known, has }; };
        const _short = _of(stats ? ['hist', 'fine'] : ['hist']), _long = stats ? _of(['stats', 'day', 'week', 'month']) : { known: true, has: false };
        return { short: _short.has, long: _long.has, shortKnown: _short.known, longKnown: _long.known };
    }

    // What the exports can't tell yet (see exportAvailability), probed in the background, for
    // the entities shown: their long-term statistics over the window, of the coarsest period
    // the window holds (an hour, a day, a week, a month: few rows, one ended at least), their
    // 5-minute statistics — or, without statistics, their history — on its last day
    _probeExports(c0, c1, statIds, w0, w1)
    {
        const _stats = new Set(statIds), _long = [], _fine = [], _hist = [];
        for( const id of this.historyEntityIds() ) {
            const a = this._availability(id, c0, c1, _stats.has(id));
            if( !a.longKnown ) _long.push(id);
            if( !a.shortKnown ) ( _stats.has(id) ? _fine : _hist ).push(id);
        }
        // (each kind for all of them at once — a request in the background each, one at a time)
        const r = msOf(this.endTime) - msOf(this.startTime), _longKind = this._sources().filter(x => !['history', 'fine'].includes(x.kind) && x.ms <= r).pop()?.kind ?? 'stats';
        if( _long.length ) this._askRuns(_longKind, c0, c1, _long, () => true, w0, w1, true);
        if( _fine.length ) this._askRuns('fine', c1, c1, _fine, () => true, w0, w1, true);
        if( _hist.length ) {
            const _p = this._histPieces(_hist[0], msOf(this.endTime) - HOUR_MS, msOf(this.endTime))[0];
            if( _p && this._backgroundFree() ) this._askHist(_hist[0], _p, { background: true });
        }
    }

    // How many rows the cache holds, every entity and layer together
    cacheRows()
    {
        let n = 0;
        for( const s of this.cache ) for( const l of LAYERS ) for( const a of s[l].values() ) n += a.length;
        return n;
    }

    // How many rows the window shown holds in its slots, in layers (LAYER's)
    _windowRows(layers)
    {
        const c0 = this.mapStartTimeToCacheSlot(this.startTime), c1 = this.mapEndTimeToCacheSlot(this.endTime);
        let n = 0;
        for( let i = Math.max(0, c0); i <= c1; i++ ) for( const l of layers ) for( const a of this.cache[i][l].values() ) n += a.length;
        return n;
    }

    // The rows of a kind that slots c0 to c1 lack for entities ids — those wanted (wants(i,
    // id)), neither loaded nor under way —, a request for each run of days needing some; a run
    // outside the window (slots w0 to w1) asked quietly
    _askRuns(kind, c0, c1, ids, wants, w0, w1, background = false, o = {})
    {
        // (in the background: one run at a time, when Home Assistant is free — _backgroundFree —,
        // the others at a later turn)
        if( background && !this._backgroundFree() ) return;
        let run = null, sent = false;
        const _flush = () => {
            if( run && !( background && sent ) ) { this._ask(kind, run.c0, run.c1, run.ids, null, run.c1 < w0 || run.c0 > w1, background, o); sent = true; }
            run = null;
        };
        for( let i = c0; i <= c1; i++ ) {
            const _n = ids.filter(id => this._missing(i, LAYER[kind], id) && !this._askedFor(kind, i, id) && wants(i, id));
            // (a run never crosses the window's edges: what's outside it asked quietly)
            if( run && ( i === w0 || i === w1 + 1 ) ) _flush();
            if( !_n.length ) { _flush(); continue; }
            if( run ) { run.c1 = i; _n.forEach(id => run.ids.add(id)); } else run = { c0: i, c1: i, ids: new Set(_n) };
        }
        _flush();
    }

    // Is the window loading — a request under way for it (not one for the values around it)?
    _loading()
    {
        return this._requests.some(q => !q.quiet);
    }

    // The cache slots around the window the automatic Y axes look at (card-yscale.js): HORIZON
    // windows on each side, until now — [first, last], or [-1, -1] for none
    yScaleSlots()
    {
        if( !this.cache.length ) return [-1, -1];
        const t0 = msOf(this.startTime), t1 = msOf(this.endTime), r = t1 - t0;
        return [this.mapStartTimeToCacheSlot(Math.max(t0 - HORIZON * r, this.cache[0].start_m.valueOf())),
                this.mapEndTimeToCacheSlot(Math.min(t1 + HORIZON * r, Date.now()))];
    }

    // How many answers the cache has taken: what was read from it is still up to date while
    // this doesn't change
    cacheVersion()
    {
        return this._cacheVersion ?? 0;
    }

    // Is a request of a kind under way for slot i and entity id?
    _askedFor(kind, i, id)
    {
        return this._requests.some(q => q.kind === kind && q.c0 <= i && i <= q.c1 && q.ids.has(id));
    }

    // Does slot i reach into the time the statistics of a period (ms) may not cover yet —
    // the period not ended, or ended less than STATS_LAG ago?
    _lacksStatistics(i, period)
    {
        return msOf(this.cache[i].end) > Date.now() - period - STATS_LAG;
    }

    // Are entity id's rows of a layer missing in slot i — never loaded, or to be asked again?
    _missing(i, layer, id)
    {
        const s = this.cache[i];
        // (its cover over the day, until now: the statistics by whole days — see _forgetToday)
        const cov = s.cover[layer].get(id);
        return !cov || outside(msOf(s.start), Math.min(msOf(s.end), Date.now()), cov).length > 0;
    }

    // Do entity id's statistics of a layer (their period, ms) stop early on a recent slot i —
    // loaded, their last period ending before the slot's end, or before what Home Assistant
    // should have compiled by now (Home Assistant late with them, or none)?
    _statisticsStopEarly(i, id, layer, period)
    {
        const s = this.cache[i], a = s[layer].get(id);
        if( !a || !this._lacksStatistics(i, period) ) return false;
        const _end = a.length ? msOf(a[a.length - 1].statistics.end) : msOf(s.start);
        return _end < Math.min(msOf(s.end), Date.now() - period - STATS_LAG);
    }

    // A request to Home Assistant for slots c0 to c1 and entities ids — kind 'day' (daily statistics), 'stats',
    // 'fine' (5-minute statistics), 'week', 'month', or 'history' (from a time, from, in slot
    // c0, until o.until: a block, see _askHist) —, kept under way until it's answered, or fails (even before it's sent); the
    // answer put in the cache, what's still missing asked, the graphs drawn again
    _ask(kind, c0, c1, ids, from = null, quiet = false, background = false, o = {})
    {
        // (o.pass: the pass of the window's loading it belongs to — key: that window's; o.light:
        // a very coarse one, sent at once with the others — see ha-requests.js)
        const q = { kind, c0, c1, ids, gen: this._loadGen, at: Date.now(), quiet: quiet || background, background, pass: o.pass ?? 0, key: this._aheadKey };
        this._requests.push(q);
        const t0 = from !== null ? moment(Math.max(from, msOf(this.cache[c0].start))) : this.cache[c0].start, t1 = o.until !== undefined ? moment(o.until) : this.cache[c1].end, l = [...ids];
        // (a block of history: the hours it asks — see _histPieces)
        if( kind === 'history' ) { q.b0 = msOf(t0); q.b1 = msOf(t1); }
        const _period = periodOfKind(kind, this.statistics.period);
        let _p;
        try {
            // (sent by pass, then in the graphs' order: see ha-requests.js)
            const _at = Math.min(...l.map(id => { const k = this.historyEntityIds().indexOf(id); return k < 0 ? 999 : k; }));
            const _o = { light: !!o.light, now: background, rows: this._rowsOf(kind, l.length, moment(t1).diff(t0) / 86400e3), order: ( o.pass || 9 ) * 1000 + _at, share: o.share ?? null, epoch: this._aheadKey };
            _p = kind === 'history' ? this.historyCall(l, t0, t1, _o) : this._askHA(this.statisticsRequest(l, t0, t1, _period), _o);
        } catch( e ) {
            _p = Promise.reject(e);
        }
        // (→ once answered and put in the cache, its error or null: an export waits for it)
        return _p.then(r => { this._answered(q, r); return null; }, e => { this._answered(q, null, e); return e ?? new Error('request failed'); });
    }

    // Request q answered (result), or failed (error). Whatever happens in between, the
    // request is no longer under way, the loading state says so, and the graphs are drawn
    // again: never a request left waiting for good, nor a loading state that never ends
    _answered(q, result, error)
    {
        this._requests = this._requests.filter(x => x !== q);
        // (a request in the background: the next one no sooner than twice what it took)
        if( q.background ) this._backgroundNext = Date.now() + Math.min(AHEAD_GAP_MAX_MS, Math.max(AHEAD_GAP_MS, 2 * ( Date.now() - q.at )));
        try {
            // (an answer for a cache since cleared — reloadHistory —: ignored)
            if( q.gen !== this._loadGen ) return;
            if( error ) console.error('history-explorer-card: history request failed', error);
            const _t = performance.now();
            if( this.databaseCallback ) this.databaseCallback(!error);
            // (what each entity asked got, split by day: an entity absent from the answer has
            // nothing there — kept as such, not asked again; a failure: nothing kept, asked
            // again at the next update)
            if( !error ) for( const id of q.ids ) {
                const a = result?.[id] ?? [];
                const _period = periodMs(periodOfKind(q.kind, this.statistics.period));
                const rows = q.kind === 'history' ? a.map(x => ({ last_changed: x.lu * 1000, state: x.s })) : a.map(x => this._statisticsRow(x, _period));
                let p = 0;
                for( let i = q.c0; i <= q.c1; i++ ) {
                    const _end = msOf(this.cache[i].end);
                    let k = p;
                    while( k < rows.length && msOf(rows[k].last_changed) < _end ) k++;
                    const s = this.cache[i], _layer = LAYER[q.kind];
                    if( q.b0 !== undefined ) this._mergeHist(i, id, rows.slice(p, k), Math.max(q.b0, msOf(s.start)), Math.min(q.b1, msOf(s.end)));
                    else { s[_layer].set(id, rows.slice(p, k)); s.cover[_layer].set(id, [[msOf(s.start), msOf(s.end)]]); }
                    s.askedAt[_layer].set(id, q.at);
                    p = k;
                }
            }
            this.perf?.add('part', performance.now() - _t);
            this._cacheVersion = this.cacheVersion() + 1;
            if( !error ) this._purge();
            // (what's still missing asked at once, before this answer is drawn: Home Assistant
            // works on it meanwhile)
            if( !error ) this._askMissing();
        } finally {
            this.state.loading = this._loading();
            // (an answer for days outside the window — asked quietly — changes nothing shown:
            // not drawn again, a hover, a tooltip left as they are; the next drawing takes it)
            const w0 = this.mapStartTimeToCacheSlot(this.startTime), w1 = this.mapEndTimeToCacheSlot(this.endTime);
            // (a block of history: by its hours, not its day's)
            const _in = q.b0 !== undefined ? q.b0 < msOf(this.endTime) && q.b1 > msOf(this.startTime) : q.c0 <= w1 && q.c1 >= w0;
            if( !q.quiet || _in ) this._drawSoon();
        }
    }

    // How many rows a request of kind should give for n entities over days (the regulator's
    // time-out, see ha-requests.js): the statistics' periods; the history's as the cache holds
    // them, an entity's day — a value a minute, without any yet
    _rowsOf(kind, n, days)
    {
        if( kind !== 'history' ) return n * days * 86400e3 / periodMs(periodOfKind(kind, this.statistics.period));
        // (by the hours of history the cache covers)
        let _rows = 0, _ms = 0;
        for( const s of this.cache ) for( const [id, a] of s.hist ) { _rows += a.length; for( const [p, q] of s.cover.hist.get(id) ?? [] ) _ms += q - p; }
        return n * days * ( _ms ? _rows / _ms * 86400e3 : 1440 );
    }

    // A request of the history or the statistics to Home Assistant — timed, with how many
    // values it gave, while a performance test records (perf)
    _askHA(request, o = {})
    {
        // (through the page's regulator: see ha-requests.js)
        const _p = haRequests.request(() => this._hass.callWS(request), { ...o, connected: () => this._hass?.connection?.connected !== false });
        if( !this.perf ) return _p;
        const _t = performance.now(), _perf = this.perf;
        return _p.then(r => {
            const _values = Object.values(r ?? {}).reduce((n, a) => n + ( Array.isArray(a) ? a.length : 0 ), 0);
            _perf.add('request', performance.now() - _t, { type: request.type, entities: ( request.entity_ids ?? request.statistic_ids ?? [] ).length, values: _values });
            return r;
        });
    }

    // What the card does, timed while a performance test records it (card-tests.js): the
    // requests to Home Assistant, each answer put in the cache, the graphs drawn again and
    // each chart's update — recorder: { add(kind, ms, info) }, null: nothing recorded
    setPerfRecorder(recorder)
    {
        this.perf = recorder;
    }

    // A row of the cache from an hour of Home Assistant's statistics: its mean — or, for a
    // total, its state —, with its end, min, mean and max (statistics)
    _statisticsRow(x, period)
    {
        const _v = x.mean ?? x.state ?? x.sum;
        // (raw: what Home Assistant gave — its state, mean, min, max, sum —, a CSV export's columns)
        return { last_changed: x.start, state: _v,
                 statistics: { end: x.end ?? msOf(x.start) + period, min: x.min ?? _v, mean: _v, max: x.max ?? _v,
                               raw: { state: x.state, mean: x.mean, min: x.min, max: x.max, sum: x.sum } } };
    }

    // --------------------------------------------------------------------------------------
    // User defined state process function
    // --------------------------------------------------------------------------------------

    process(sample, process)
    {
        if( sample === '' || sample === null || sample === undefined ) {
            sample = 'unavailable';
        }

        if( process ) {
            let v = sample * 1.0;
            if( isNaN(v) ) v = sample;
            return process(v);
        } else
            return sample;
    }

    processRaw(sample, process)
    {
        if( sample === null || sample === undefined ) {
            sample = 'unavailable';
        }

        return process ? process(sample) : sample;
    }

    // How entity e's states become the values drawn: its process function, then its
    // stateMap (mini-graph-card's state_map) — a state listed, its place in the list (0, 1,
    // 2…); any other, STATE_NOT_LISTED (no value: see showMissingState). null: as they are
    processOf(e)
    {
        const _p = this.buildProcessFunction(e?.process);
        const _map = this.resolveOption(e, 'stateMap');
        if( !_map?.length ) return _p;
        return v => {
            const x = _p ? _p(v) : v;
            const i = _map.findIndex(m => m.value === String(x));
            return i >= 0 ? i : STATE_NOT_LISTED;
        };
    }

    buildProcessFunction(p)
    {
        if( !p ) return null;

        try {
            const f = new Function('state', `"use strict";return (${p});`);
            f('undefined');
            return f;
        } catch( e ) {
            console.warn(e.message);
            return null;
        }
    }

    // A shown entity changed: refresh its recent history — at most once every 2 s, however
    // often the entities change (the next refresh is never postponed by a further change,
    // and the recent history is only reloaded then, not at each change), and never sooner
    // than five times what drawing the graphs again last took: the page is never kept busy
    // by the refreshes more than a fifth of the time, however many curves and values it shows
    scheduleAutoRefresh()
    {
        if( this._autoRefreshTid ) return;
        this._autoRefreshTid = setTimeout(() => {
            this._autoRefreshTid = 0;
            this.refresh();
        }, Math.max(AUTO_REFRESH_MIN_MS, AUTO_REFRESH_BUILD_FACTOR * ( this._lastBuildMs ?? 0 )));
    }

    updateHistoryAutoRefresh()
    {
        const now = moment();
        const last = moment(this.endTime);

        // If auto scroll is allowed (scrolled at or past the previous last event) then adjust the x position
        // if the new event is past the visible graph area.
        if( this.state.autoScroll && last < now ) {
            this.today();
        } else {
            this.updateHistory();
        }
    }

    // The history loaded again, now, whatever is loading: a load in progress is superseded —
    // its answer, when it comes, ignored (_loadGen)
    reloadHistory()
    {
        this._loadGen = ( this._loadGen ?? 0 ) + 1;
        this._requests = [];
        this.state.loading = false;
        this.cache.length = 0;
        this.updateHistory();
    }

    // What was asked before its day ended — the history, the statistics — to be asked again:
    // what came since (the refresh): today's, and yesterday's too when it was asked before
    // midnight, however long ago. Kept meanwhile, and drawn: replaced as each entity's answer
    // comes, never something coarser in between
    _forgetToday()
    {
        if( !this.cache.length ) return;
        this._extendToNow();
        for( const s of this.cache ) {
            const _end = msOf(s.end);
            // (every source's cover cut at the time it was asked: what came since asked again — the
            // statistics their whole day, the history its hours from then — see _missing, _histPieces)
            for( const l of LAYERS ) for( const [id, at] of s.askedAt[l] ) if( at < _end )
                s.cover[l].set(id, ( s.cover[l].get(id) ?? [] ).map(([p, q]) => [p, Math.min(q, at)]).filter(([p, q]) => q > p));
        }
    }

    // --------------------------------------------------------------------------------------
    // Home Assistant's recorder
    // --------------------------------------------------------------------------------------

    // The request for the history of entities ids from t0 to t1 (none: until now) — their
    // states only, unless withAttributes
    historyRequest(ids, t0, t1 = null, withAttributes = false)
    {
        return {
            type: "history/history_during_period",
            start_time: moment(t0).format('YYYY-MM-DDTHH:mm:ssZ'),
            ...( t1 !== null ? { end_time: moment(t1).format('YYYY-MM-DDTHH:mm:ssZ') } : {} ),
            minimal_response: !withAttributes,
            no_attributes: !withAttributes,
            entity_ids: ids
        };
    }

    // The history of series ids (entities' states, or attributes — see history-series.js)
    // from t0 to t1 (none: until now), as Home Assistant gives the states' (by id, its
    // compressed rows): the states asked as usual; the attributes from their entities'
    // history with its attributes, every change included (an attribute changing alone is
    // no significant change for Home Assistant)
    historyCall(ids, t0, t1 = null, o = {})
    {
        const _states = ids.filter(id => !seriesOf(id).attribute);
        const _attrs = ids.filter(id => seriesOf(id).attribute);
        const _entities = [...new Set(_attrs.map(id => seriesOf(id).entity))];
        const _ask = (l, attributes) => l.length
            ? this._askHA({ ...this.historyRequest(l, t0, t1, attributes), ...( attributes ? { significant_changes_only: false } : {} ) }, o)
            : Promise.resolve({});
        return Promise.all([_ask(_states, false), _ask(_entities, true)])
            .then(([r, ra]) => ({ ...r, ...attributeHistories(_attrs, ra) }));
    }

    // The request for the long-term statistics of ids from t0 to t1, by period
    statisticsRequest(ids, t0, t1, period)
    {
        return {
            type: ( this.version[0] > 2022 || this.version[1] >= 11 ) ? "recorder/statistics_during_period" : "history/statistics_during_period",
            start_time: moment(t0).format('YYYY-MM-DDTHH:mm:ssZ'),
            end_time: moment(t1).format('YYYY-MM-DDTHH:mm:ssZ'),
            period,
            statistic_ids: ids
        };
    }

    // The automatic refresh: the newest part of the cache asked again, the window moved to
    // the present in real time
    refresh()
    {
        this._forgetToday();
        this.updateHistoryAutoRefresh();
    }
}
