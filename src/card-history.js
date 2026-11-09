// The card's history data: the cache of what Home Assistant returned (history and
// long-term statistics), filled on demand for the time window shown, and the user's own
// state process function. Part of HistoryCardState (added to it in history-explorer-card.js).

import { colorEntityOf } from "./card-datasets.js";
import { seriesOf, attributeHistories, msOf } from "./history-series.js";
import { STATE_NOT_LISTED, OPTION_DEFAULTS, YEAR_HOURS, MAX_RANGE_YEARS } from "./history-options.js";
import { HORIZON } from "./card-yscale.js";
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
// Where each kind of request goes in a cache slot: the history of whole days, the history
// after the statistics (tail), the 5-minute statistics, the statistics of the period, the
// daily statistics — from the finest
const LAYER = { month: 'month', week: 'week', day: 'day', stats: 'stats', fine: 'fine', tail: 'tail', history: 'hist' };
const LAYERS = ['hist', 'tail', 'fine', 'stats', 'day', 'week', 'month'];
// The period of a kind of statistics request (Home Assistant's)
const periodOfKind = (kind, period) => ( { fine: FINE_PERIOD, day: DAY_PERIOD, week: WEEK_PERIOD, month: MONTH_PERIOD } )[kind] ?? period;
// History parts asked at once (Home Assistant answers two together a quarter sooner)
const HISTORY_REQUESTS = 2;
// The coarse source drawn at once while the window's own comes: the coarsest statistics, a
// step coarser than it at least, still giving the window this many values
const COARSE_POINTS = 10;
// Ahead of the gestures to come — the time panned, a zoom in or out —, the cache filled
// around the window, in steps while the user looks at the graphs without moving them (this
// long after the last request answered, or the window last changed): the coarse source
// over AHEAD_COARSE[step] windows on each side, the window's own over AHEAD_FINE[step]
const AHEAD_IDLE_MS = 2000, AHEAD_COARSE = [1, 1, 2, 4], AHEAD_FINE = [0, 1, 1, 1];
// Filling ahead never loads Home Assistant: one request at a time, only when nothing else is
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
    // and its history after the statistics of the most recent days (tail); an entity's rows
    // there only once loaded (an empty list: loaded, nothing in it); in each layer, when
    // each entity's rows were asked (askedAt: before the day's end, they lack what came
    // since) and the entities whose rows are to be asked again (stale: the refresh), kept
    // until they come
    // --------------------------------------------------------------------------------------

    _slot(d, e)
    {
        const _by = f => Object.fromEntries(LAYERS.map(l => [l, f()]));
        return { start: d, end: e, start_m: moment(d), end_m: moment(e), ..._by(() => new Map()), askedAt: _by(() => new Map()), stale: _by(() => new Set()) };
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

    // The entities whose long-term statistics are asked: those drawn as a curve or as bars,
    // numbers Home Assistant keeps statistics of (a state_class) — not an attribute, not an
    // angle (a mean of angles isn't one), not one only giving a color; none when the
    // statistics are off
    _statisticsIds()
    {
        if( !this.statistics.enabled ) return [];
        const ids = new Set(), colors = this.colorEntityIds();
        for( const g of this.graphs ) for( const e of g.entities ) {
            const _kind = this.entityKind(g, e);
            if( ( _kind !== 'line' && _kind !== 'bar' ) || seriesOf(e.entity).attribute || this.circularPeriodOf(e) ) continue;
            if( this.stateOf(e.entity)?.attributes?.state_class ) ids.add(e.entity);
        }
        for( const id of colors ) ids.delete(id);
        return [...ids];
    }

    // The coarsest source that gives each column of pixels its min, mean and max as exactly
    // as the history (to 1 px): of the statistics (_sources) — monthly, weekly, daily, of the
    // period (hourly), 5-minute —, the coarsest whose period a column lasts at least (a
    // month counted 30 days); else 'history'. Always 'history', the statistics off; never,
    // forced (statistics.force: the 5-minute ones at most)
    _sourceNeeded()
    {
        if( !this.statistics.enabled ) return 'history';
        const _px = Math.max(0, ...this.graphs.map(g => g.chart.hecPlotWidth()));
        const _column = moment(this.endTime).diff(moment(this.startTime)) / ( _px || 1000 );
        const S = this._sources();
        for( let k = S.length - 1; k >= 1; k-- ) if( _column >= S[k].ms ) return S[k].kind;
        return this.statistics.force ? S[1].kind : 'history';
    }

    // An entity's rows over cache slots c0 to c1 — in each slot, the finest it has: its
    // history, else its history after the statistics, its 5-minute statistics, its
    // statistics of the period; and before the first row of a finer one, the coarser ones
    // (where the recorder no longer keeps the history or the 5-minute statistics: a day past
    // their retention, or the day it begins; the statistics before the tail) — with, first, its last value before c0 when an earlier slot has it, so that
    // the graphs have one value just before the start of their own data (no interpolation
    // issue at the start of a curve, no state disappearing at the start of a timeline).
    // Empty when the cache has none. What the cache has is drawn at once, however coarse —
    // the daily statistics, the hourly ones, the 5-minute ones —, a finer layer replacing it
    // as it comes: the history too, when the window is drawn from it (_sourceNeeded)
    cachedHistory(entity, c0, c1)
    {
        const _end = x => msOf(x.statistics?.end ?? x.last_changed);
        const _rows = s => LAYERS.reduceRight((coarser, layer) => {
            const a = s[layer].get(entity);
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
            for( const g of this.graphs ) for( const e of g.entities ) result.push(this.cachedHistory(e.entity, c0, c1));
            const colorHistory = {};
            for( const id of this.colorEntityIds() ) colorHistory[id] = this.cachedHistory(id, c0, c1);
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
    // cache has, however coarse, then refined as the rest comes:
    // - the source a column of pixels needs (_sourceNeeded: the history, the 5-minute, the
    //   hourly or the daily statistics) for the window, the statistics in one request, the
    //   history a few days at a time, the most recent first, two parts at once — two for the
    //   window shown: those still under way for another one don't hold it back;
    // - first, the coarsest statistics a step coarser at least (_coarseOf) still giving the
    //   window COARSE_POINTS values — the quickest to come —, over the window and a window on each side
    //   (the time a pan or a zoom out shows next), where the cache has nothing finer;
    // - where a day of the window comes back empty, or starting late (the recorder no longer
    //   keeps it, or not all of it: past its retention), the next coarser statistics there;
    //   where all its statistics come back empty or starting late (deleted, or begun that day,
    //   after a change of unit), its history;
    // - where the statistics of the window aren't compiled yet (an hour's once it has ended):
    //   today, and yesterday until 1:10, the finer ones; then the history after the finest
    //   statistics — the last minutes, from 5 minutes and STATS_LAG ago —, in one request; the
    //   whole day's history of an entity whose statistics stop earlier there (Home Assistant
    //   late with them, or none); and the history of the entities without statistics,
    //   everywhere;
    // - for the curves without that first, coarse pass, the window's own source a window on
    //   each side, at once, as soon as the window has come — quietly;
    // - while the user looks at the graphs without moving them, the cache filled further
    //   around the window in steps (see _scheduleAhead): the window's own source a window on
    //   each side, the coarse one up to AHEAD_COARSE windows — quietly: the window isn't
    //   loading for them —, never past AHEAD_MAX_ROWS rows in the cache.
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

    // The coarse source drawn first for a window r ms long whose own is source (an index in
    // sources): the coarsest, a step coarser at least, still giving the window COARSE_POINTS
    // values or more — the fewest rows, the quickest to come; the window's own when it is the
    // coarsest (asked around the window too); else none (-1)
    _coarseOf(sources, source, r)
    {
        if( source === sources.length - 1 ) return source;
        for( let k = sources.length - 1; k > source; k-- ) if( r / sources[k].ms >= COARSE_POINTS ) return k;
        return -1;
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
        const _asked = (kind, i, id) => this._askedFor(kind, i, id);
        const _source = this._sourceNeeded();
        const S = this._sources(), si = S.findIndex(x => x.kind === _source), ci = this._coarseOf(S, si, r);
        // (does slot i have a source of entity id as fine as S[k] or finer?)
        const _hasFrom = (i, id, k) => S.slice(0, k + 1).some(x => this.cache[i][LAYER[x.kind]].has(id));

        // The coarse source first, over the window and around it, where nothing finer is there
        if( ci >= 0 ) {
            const [a0, a1] = this._slotsOf(t0 - AHEAD_COARSE[0] * r, t1 + AHEAD_COARSE[0] * r);
            if( a0 >= 0 && a1 >= 0 ) this._askRuns(S[ci].kind, a0, a1, _statIds, (i, id) => !_hasFrom(i, id, ci), c0, c1);
            // (further, ahead: in the background)
            if( AHEAD_COARSE[_step] > AHEAD_COARSE[0] ) {
                const [b0, b1] = this._slotsOf(t0 - AHEAD_COARSE[_step] * r, t1 + AHEAD_COARSE[_step] * r);
                if( b0 >= 0 && b1 >= 0 ) this._askRuns(S[ci].kind, b0, b1, _statIds, (i, id) => ( i < a0 || i > a1 ) && !_hasFrom(i, id, ci), c0, c1, true);
            }
        }

        // The window's own statistics — where they aren't compiled yet, the finer ones there —
        // and, where a day comes back empty (past the recorder's retention), the next coarser
        const _period = periodMs(this.statistics.period);
        const _finestMs = Math.min(_period, PERIOD_MS[FINE_PERIOD]);
        // (a source of a day that came back empty, or whose first value comes well after the
        // day's start — a period of it, a minute for the history: the recorder's retention)
        const _empty = (i, id, k) => {
            const a = this.cache[i][LAYER[S[k].kind]].get(id);
            return !!a && ( !a.length || msOf(a[0].last_changed) > this.cache[i].start_m.valueOf() + Math.max(S[k].ms, 60e3) );
        };
        const _wanted = new Map(S.map(x => [x.kind, new Set()]));
        for( let i = c0; i <= c1; i++ ) for( const id of _statIds ) {
            let k = si;
            // (not compiled yet: the finer statistics, down to the 5-minute ones)
            while( k > 1 && this._lacksStatistics(i, S[k].ms) ) k--;
            if( k >= 1 ) _wanted.get(S[k].kind).add(i + ' ' + id);
            if( k !== si && si >= 1 ) _wanted.get(S[si].kind).add(i + ' ' + id);
            // (empty, or starting late: the next coarser)
            for( let j = si; j + 1 < S.length && _empty(i, id, j); j++ ) _wanted.get(S[j + 1].kind).add(i + ' ' + id);
        }
        for( const x of S.slice(1) ) this._askRuns(x.kind, c0, c1, _statIds, (i, id) => _wanted.get(x.kind).has(i + ' ' + id), c0, c1);

        // The history after the finest statistics — what Home Assistant hasn't compiled yet —,
        // from their period and STATS_LAG ago to now, in one request
        if( _source !== 'history' )
            this._askRows('tail', c0, c1, _statIds, i => this._lacksStatistics(i, _finestMs), Date.now() - _finestMs - STATS_LAG);

        // The history each day needs: everything when it tells more; else the entities
        // without statistics, and those whose finest statistics stop early on a recent day
        const _all = _source === 'history';
        const _finest = _period > PERIOD_MS[FINE_PERIOD] ? 'fine' : 'stats';
        // (and, the other way round, where a day's statistics came back empty or starting late
        // — every one loaded there: deleted, or begun that day, after a change of unit; never
        // compiled —, its history)
        const _noStatistics = (i, id) => {
            const _loaded = S.map((x, k) => k).slice(1).filter(k => this.cache[i][LAYER[S[k].kind]].has(id));
            // (once every one asked there has come: a coarser one may yet fill it)
            return _loaded.length > 0 && _loaded.every(k => _empty(i, id, k)) && !S.slice(1).some(x => this._askedFor(x.kind, i, id));
        };
        const _histWanted = (i, id) => _all || !_hasStats.has(id) || this._statisticsStopEarly(i, id, _finest, _finestMs) || _noStatistics(i, id);
        // (a statistics entity's history of a recent day, left from a shorter window, out of
        // date and no longer wanted: dropped — the statistics and the tail drawn instead)
        for( let i = c0; i <= c1; i++ ) for( const id of this.cache[i].stale.hist ) if( !_histWanted(i, id) ) {
            this.cache[i].hist.delete(id);
            this.cache[i].stale.hist.delete(id);
        }
        const _needs = i => _ids.filter(id => this._missing(i, 'hist', id) && _histWanted(i, id));
        // (a few days at a time — at most 8 parts for the window —, the most recent first)
        const _days = Math.max(1, Math.ceil(( c1 - c0 + 1 ) / 8));
        const _underWay = () => this._requests.filter(q => q.kind === 'history' && q.c0 <= c1 && q.c1 >= c0).length;
        let i = c1;
        while( i >= c0 ) {
            const _n = _needs(i).filter(id => !_asked('history', i, id));
            if( !_n.length ) { i--; continue; }
            if( _underWay() >= HISTORY_REQUESTS ) break;
            // (the days before it needing exactly the same entities, up to a part's length: a
            // curve's recent days never asked with weeks of a timeline's)
            const _k = k => _needs(k).filter(id => !_asked('history', k, id)).join();
            let j = i;
            while( j - 1 >= c0 && i - ( j - 1 ) < _days && _k(j - 1) === _n.join() ) j--;
            this._ask('history', j, i, new Set(_n));
            i = j - 1;
        }

        // The window's own source a window on each side — the statistics, or the history it is
        // drawn from —, outside the window, quietly: at once, as soon as the window has come,
        // for the curves without a first, coarse pass (the second pass: the window first, then
        // its sides, both at once); else ahead, the user idle (see _scheduleAhead), one at a time
        const _coarsePass = id => ci >= 0 && _hasStats.has(id);
        const _windowDone = !this._requests.some(q => !q.quiet && q.c0 <= c1 && q.c1 >= c0);
        const _sides = this._aheadFine && _windowDone && _ids.some(id => !_coarsePass(id)) && this._sidesFit(S[si].kind);
        if( ( AHEAD_FINE[_step] && this._aheadFine ) || _sides ) {
            const _w = Math.max(this._aheadFine ? AHEAD_FINE[_step] : 0, _sides ? 1 : 0);
            const [b0, b1] = this._slotsOf(t0 - _w * r, t1 + _w * r);
            if( b0 >= 0 && b1 >= 0 ) {
                // (outside the window: its own days are asked above, two history parts at once;
                // at once for the curves without a coarse pass, else in the background)
                const _out = i => i < c0 || i > c1;
                for( const now of [true, false] ) {
                    if( now ? !_sides : !( AHEAD_FINE[_step] && this._aheadFine ) ) continue;
                    const _which = id => now ? !_coarsePass(id) : true;
                    if( si >= 1 ) this._askRuns(S[si].kind, b0, b1, _statIds, (i, id) => _out(i) && _which(id) && !_hasFrom(i, id, si), c0, c1, !now);
                    this._askRuns('history', b0, b1, _ids, (i, id) => _out(i) && _which(id) && ( !_hasStats.has(id) || _all ) && !_hasFrom(i, id, 0), c0, c1, !now);
                }
            }
        }

        this.state.loading = this._loading();
        this._scheduleAhead();
    }

    // The next step ahead (AHEAD_COARSE, AHEAD_FINE), once the user has looked at the graphs
    // without moving them for AHEAD_IDLE_MS, nothing under way — each window change, each
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
        }, AHEAD_IDLE_MS);
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
                s[l].delete(id); s.askedAt[l].delete(id); s.stale[l].delete(id);
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
        if( !this._requests.length && !this.state.drag && _wait <= 0 ) return true;
        clearTimeout(this._backgroundTid);
        this._backgroundTid = setTimeout(() => { this._backgroundTid = 0; if( !this._requests.length ) this._askMissing(); }, Math.min(AHEAD_GAP_MAX_MS, Math.max(_wait, AHEAD_GAP_MS)));
        return false;
    }

    // May the window's own source (kind) be asked a window on each side — the cache staying
    // under AHEAD_MAX_ROWS with twice the window's rows of it more? If not, never for this window
    _sidesFit(kind)
    {
        if( this.cacheRows() + 2 * this._windowRows([LAYER[kind]]) <= AHEAD_MAX_ROWS ) return true;
        this._aheadFine = false;
        return false;
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
    _askRuns(kind, c0, c1, ids, wants, w0, w1, background = false)
    {
        // (in the background: one run at a time, when Home Assistant is free — _backgroundFree —,
        // the others at a later turn)
        if( background && !this._backgroundFree() ) return;
        let run = null, sent = false;
        const _flush = () => {
            if( run && !( background && sent ) ) { this._ask(kind, run.c0, run.c1, run.ids, null, run.c1 < w0 || run.c0 > w1, background); sent = true; }
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

    // The rows of a kind ('stats', 'fine', 'tail') that slots c0 to c1 lack — in the slots
    // wanted (wants(i)), for entities ids, neither loaded nor under way —, asked in one
    // request (from: see _ask)
    _askRows(kind, c0, c1, ids, wants, from = null)
    {
        const _l = [];
        for( let i = c0; i <= c1; i++ ) if( wants(i) )
            for( const id of ids ) if( this._missing(i, LAYER[kind], id) && !this._askedFor(kind, i, id) ) _l.push([i, id]);
        if( _l.length ) this._ask(kind, Math.min(..._l.map(x => x[0])), Math.max(..._l.map(x => x[0])), new Set(_l.map(x => x[1])), from);
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
        return !s[layer].has(id) || s.stale[layer].has(id);
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
    // 'fine' (5-minute statistics), 'history' or 'tail' (the history from a time, from: in
    // slot c0) —, kept under way until it's answered, or fails (even before it's sent); the
    // answer put in the cache, what's still missing asked, the graphs drawn again
    _ask(kind, c0, c1, ids, from = null, quiet = false, background = false)
    {
        const q = { kind, c0, c1, ids, gen: this._loadGen, at: Date.now(), quiet: quiet || background, background };
        this._requests.push(q);
        const t0 = from !== null ? moment(Math.max(from, msOf(this.cache[c0].start))) : this.cache[c0].start, t1 = this.cache[c1].end, l = [...ids];
        const _period = periodOfKind(kind, this.statistics.period);
        let _p;
        try {
            _p = LAYER[kind] === 'hist' || kind === 'tail' ? this.historyCall(l, t0, t1) : this._askHA(this.statisticsRequest(l, t0, t1, _period));
        } catch( e ) {
            _p = Promise.reject(e);
        }
        _p.then(r => this._answered(q, r), e => this._answered(q, null, e));
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
                const rows = q.kind === 'history' || q.kind === 'tail' ? a.map(x => ({ last_changed: x.lu * 1000, state: x.s })) : a.map(x => this._statisticsRow(x, _period));
                let p = 0;
                for( let i = q.c0; i <= q.c1; i++ ) {
                    const _end = msOf(this.cache[i].end);
                    let k = p;
                    while( k < rows.length && msOf(rows[k].last_changed) < _end ) k++;
                    const s = this.cache[i], _layer = LAYER[q.kind];
                    s[_layer].set(id, rows.slice(p, k));
                    s.stale[_layer].delete(id);
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
            if( !q.quiet ) this._drawSoon();
        }
    }

    // A request of the history or the statistics to Home Assistant — timed, with how many
    // values it gave, while a performance test records (perf)
    _askHA(request)
    {
        const _p = this._hass.callWS(request);
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
        return { last_changed: x.start, state: _v,
                 statistics: { end: x.end ?? msOf(x.start) + period, min: x.min ?? _v, mean: _v, max: x.max ?? _v } };
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

    // What was asked before its day ended — the history, the statistics, the tail — to be
    // asked again: what came since (the refresh): today's, and yesterday's too when it was
    // asked before midnight, however long ago. Kept meanwhile, and drawn: replaced as each
    // entity's answer comes (stale), never something coarser in between
    _forgetToday()
    {
        if( !this.cache.length ) return;
        this._extendToNow();
        for( const s of this.cache ) {
            const _end = msOf(s.end);
            for( const l of LAYERS ) for( const [id, at] of s.askedAt[l] ) if( at < _end ) s.stale[l].add(id);
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
    historyCall(ids, t0, t1 = null)
    {
        const _states = ids.filter(id => !seriesOf(id).attribute);
        const _attrs = ids.filter(id => seriesOf(id).attribute);
        const _entities = [...new Set(_attrs.map(id => seriesOf(id).entity))];
        const _ask = (l, attributes) => l.length
            ? this._askHA({ ...this.historyRequest(l, t0, t1, attributes), ...( attributes ? { significant_changes_only: false } : {} ) })
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
