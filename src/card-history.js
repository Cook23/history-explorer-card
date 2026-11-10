// The card's history data: the cache of what Home Assistant returned (history and
// long-term statistics), filled on demand for the time window shown, and the user's own
// state process function. Part of HistoryCardState (added to it in history-explorer-card.js).

import { colorEntityOf } from "./card-datasets.js";
import { seriesOf, attributeHistories, msOf } from "./history-series.js";
import { STATE_NOT_LISTED, OPTION_DEFAULTS, YEAR_HOURS, MAX_RANGE_YEARS, STATS_EXPORT_PERIODS } from "./history-options.js";
import { HORIZON } from "./card-yscale.js";
import { perf } from "./card-perf.js";
import { haRequests, HA_WORKERS } from "./ha-requests.js";
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
// Phase 1's source gives the window COARSE_POINTS values at least (see _planOf)
const COARSE_POINTS = 100;
// (the phase of phase 1's parts wholly outside the window shown: sent after phase 2's)
const PHASE_SIDES = 3;
// Statistics of a period shorter than an entity's own would make up values between its own
// (a value held, drawn as twelve the same, then a step): told once a session, at the start, by
// probing its history (_probeFine) — its last PROBE_MS (short: a sensor flooding its history
// costs little): its 5-minute statistics valid where PROBE_COUNT intervals between its values
// there are each under FINE_GAP_MS (how often it speaks when it speaks, whatever its
// silences), its hourly ones too, or where the mean time between its values (that time divided
// by their count; none: infinite) is under HOUR_GAP_SHORT_MS; else — a sparse sensor, never one
// flooding — its last PROBE_LONG_MS: its hourly ones valid where PROBE_COUNT intervals there
// are each under HOUR_GAP_MS — the daily, weekly and monthly ones always. Only the intervals
// between two numbers count (an unavailable state and the value after it, a restart, tell
// nothing of the sensor). Statistics not valid never used, drawn or exported (see
// _relevant). SENSOR_GAPS: by entity, { fine, hour } — whether they're valid; PROBES: by
// entity, its probe under way (a promise)
const PROBE_MS = 3600e3, PROBE_LONG_MS = 24 * 3600e3, PROBE_COUNT = 5, FINE_GAP_MS = 4 * 60e3, HOUR_GAP_SHORT_MS = 15 * 60e3, HOUR_GAP_MS = 50 * 60e3;
const SENSOR_GAPS = new Map(), PROBES = new Map();
// (the verdicts kept on this device read once a page: see card-storage.js keptProbes)
let probesRead = false;
// The caches of the page, by card (pageKey: its name and its YAML — two different cards never
// share one) — { cache, tid }: a card made again on the same page — Home Assistant drawing the
// dashboard again — takes back what its cache held, and asks only what came since (see
// initCache); a card off the page, its cache let go PAGE_CACHE_KEPT_MS later, unless a card
// took it back or it came back (leavePage, backOnPage)
const PAGE_CACHES = new Map(), PAGE_CACHE_KEPT_MS = 10 * 60e3;
const HOUR_MS = 3600e3, DAY_MS = 86400e3;
// (time t, ms, at the start of its hour — days: of its day, at local midnight —, or at the
// end: the next one, unless t is one)
const alignDown = (t, days) => days ? moment(t).startOf('day').valueOf() : Math.floor(t / HOUR_MS) * HOUR_MS;
const alignUp = (t, days) => { const f = alignDown(t, days); return f < t ? ( days ? moment(f).add(1, 'day').valueOf() : f + HOUR_MS ) : f; };
// Statistics Home Assistant makes up: a period where the sensor sent nothing gets its last
// value — its min, mean and max the same. A run of them, each following the one before, of the
// same period and the same value, is the value held: one row, the first, lasting until the
// run's end (statistics.held; statistics.period: the period of each). The 5-minute and hourly
// statistics of a measurement only (a total's state is a level, not a value made up)
function heldRuns(rows)
{
    const _flat = st => st?.raw && st.raw.mean !== undefined && st.raw.mean !== null && st.min === st.max && st.max === st.mean;
    const out = [];
    for( const x of rows ) {
        const p = out[out.length - 1], st = x.statistics, ps = p?.statistics;
        if( _flat(st) && _flat(ps) && st.mean === ps.mean ) {
            const P = ( ps.period ?? msOf(ps.end) - msOf(p.last_changed) ), Q = msOf(st.end) - msOf(x.last_changed);
            if( P === Q && P <= HOUR_MS && msOf(x.last_changed) === msOf(ps.end) ) {
                out[out.length - 1] = { ...p, statistics: { ...ps, end: st.end, held: true, period: P } };
                continue;
            }
        }
        out.push(x);
    }
    return out;
}
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
// The background never loads Home Assistant: one request at a time, only when nothing else is
// under way nor a gesture going on, AHEAD_GAP_MS after the window last changed, then twice
// what the last one took after it ended (Home Assistant busy for it a third of the time at
// most) — AHEAD_GAP_MS to AHEAD_GAP_MAX_MS (see _background)
const AHEAD_GAP_MS = 1000, AHEAD_GAP_MAX_MS = 30000;
// The cache filled around the window in the background only while it holds fewer rows than
// this, all entities and layers together (a row: some 100 bytes)
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
    // lacking is what isn't covered (_lacking), a refresh cutting each one's cover at the
    // time it was asked (_forgetToday), the rows there kept and drawn until the new ones
    // come; the hourly statistics and coarser by whole days, the history and the 5-minute
    // ones as they're asked — by whole hours, a refresh what came since (the history's blocks:
    // their state at the start, given with each, a boundary, b)
    // --------------------------------------------------------------------------------------

    _slot(d, e)
    {
        const _by = f => Object.fromEntries(LAYERS.map(l => [l, f()]));
        return { start: d, end: e, start_m: moment(d), end_m: moment(e), a: msOf(d), b: msOf(e), ..._by(() => new Map()), askedAt: _by(() => new Map()), cover: _by(() => new Map()) };
    }

    initCache()
    {
        // (a card made again: the page's cache of this card — a copy of its list of slots, the
        // slots shared —, what came since it was asked to be asked again)
        const _page = PAGE_CACHES.get(this.pageKey);
        clearTimeout(_page?.tid);
        if( _page?.cache.length ) {
            this.cache.push(..._page.cache);
            this.cacheSize = this.cache.length - 1;
            PAGE_CACHES.set(this.pageKey, { cache: this.cache });
            this._forgetToday();
            return;
        }
        PAGE_CACHES.set(this.pageKey, { cache: this.cache });
        let d = dayAfter(moment(), -this.cacheSize);

        for( let i = 0; i < this.cacheSize+1; i++ ) {
            let e = dayAfter(d, 1);
            this.cache.push(this._slot(d, e));
            d = e;
        }
    }

    // The card off the page: its cache let go PAGE_CACHE_KEPT_MS later — unless a card made
    // again took it back, or this one came back (backOnPage)
    leavePage()
    {
        const _page = PAGE_CACHES.get(this.pageKey);
        if( !_page || _page.cache !== this.cache ) return;
        clearTimeout(_page.tid);
        _page.tid = setTimeout(() => { if( PAGE_CACHES.get(this.pageKey) === _page ) PAGE_CACHES.delete(this.pageKey); }, PAGE_CACHE_KEPT_MS);
    }

    // The card back on the page: its cache kept again
    backOnPage()
    {
        const _page = PAGE_CACHES.get(this.pageKey);
        if( _page?.cache === this.cache ) clearTimeout(_page.tid);
        else if( this.cache.length && !_page ) PAGE_CACHES.set(this.pageKey, { cache: this.cache });
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
    // (the same within a ladder of sources S, from the finest)
    _sourceIn(S)
    {
        if( !this.statistics.enabled ) return 'history';
        const _px = Math.max(0, ...this.graphs.map(g => g.chart.hecPlotWidth()));
        const _column = moment(this.endTime).diff(moment(this.startTime)) / ( _px || 1000 );
        for( let k = S.length - 1; k >= 1; k-- ) if( _column >= S[k].ms ) return S[k].kind;
        return this.statistics.force && S[1] ? S[1].kind : 'history';
    }

    // An entity's rows over cache slots c0 to c1 — in each slot, the finest it has over the
    // time each source covers: its history, else its 5-minute statistics, its statistics of
    // the period…; and before the first row of a finer one, the coarser ones (where the
    // recorder no longer keeps the history or the 5-minute statistics: a day past their
    // retention, or the day it begins) — with, first, its last value before c0 when an earlier slot has it, so that
    // the graphs have one value just before the start of their own data (no interpolation
    // issue at the start of a curve, no state disappearing at the start of a timeline).
    // Empty when the cache has none. What the cache has is drawn at once, however coarse —
    // the daily statistics, the hourly ones, the 5-minute ones —, a finer layer replacing it
    // as it comes
    cachedHistory(entity, c0, c1, layers = null)
    {
        const _end = x => msOf(x.statistics?.end ?? x.last_changed);
        // (layers: those it may be drawn from, the first preferred — see _drawLayers —; else
        // every one, the finest first)
        const _layers = layers ?? LAYERS;
        const _rows = s => _layers.reduceRight((under, layer) => {
            const a = s[layer].get(entity);
            if( !a || !under?.length ) return a ?? under;
            // (the ones after where it doesn't cover, before its first row there — the recorder
            // no longer keeping it —, or after its last statistics — not compiled yet)
            const cov = s.cover[layer].get(entity) ?? [], _first = a.length ? msOf(a[0].last_changed) : Infinity;
            const _last = a.length && a[a.length - 1].statistics ? _end(a[a.length - 1]) : Infinity;
            const out = under.filter(x => _end(x) <= _first || msOf(x.last_changed) >= _last || !cov.some(([p, q]) => msOf(x.last_changed) < q && _end(x) > p));
            return out.length ? mergeRows(out, a) : a;
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
        return heldRuns(r);
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
        perf.add('redraw', this._lastBuildMs);
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
    // Loading the window: what the cache lacks asked to Home Assistant, in phases (BRANCH.md)
    // --------------------------------------------------------------------------------------

    // What the window shown needs from Home Assistant, asked (see _askMissing); the graphs
    // drawn at once from what the cache has — the window asked is the window shown, whatever
    // is loading —, each answer drawing them again
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

    // The window's length r (ms), its plot's width px (the widest graph's) and a column of
    // pixels' time (ms)
    _geometry()
    {
        const r = msOf(this.endTime) - msOf(this.startTime), px = Math.max(0, ...this.graphs.map(g => g.chart.hecPlotWidth())) || 1000;
        return { r, px, column: r / px };
    }

    // How an entity's window is loaded (BRANCH.md) — hasStats: it has statistics —: { fam:
    // its statistics of the hourly family (the hourly ones, the daily, weekly and monthly),
    // from the finest — the hourly ones even when not valid for it (_relevant): drawn only
    // where its history isn't kept then (see _drawLayers), better than daily ones coarser than
    // a column —; p1: phase 1's source — the coarsest of fam a column of pixels holds whole
    // (never finer than a column shows), else fam's finest —, when it gives the window
    // COARSE_POINTS values (a column's count at most); p2: phase 2's — the 5-minute statistics
    // where a column holds them whole and they're valid (forced: statistics.force, the
    // statistics wherever valid), else the history —, when a column lasts less than the finest
    // of fam valid for it (an hour; the hourly ones not valid, a day; without statistics:
    // always) } — null: none
    _planOf(id, hasStats, { r, px, column })
    {
        const fam = hasStats ? this._sources().filter(x => x.ms >= HOUR_MS) : [], valid = fam.filter(x => this._relevant(id, x.ms));
        let p1 = null, p2 = null;
        if( fam.length ) {
            const k = Math.max(0, fam.findLastIndex(x => x.ms <= column));
            if( r / fam[k].ms >= Math.min(COARSE_POINTS, px) ) p1 = fam[k];
        }
        if( column < ( valid[0]?.ms ?? Infinity ) ) {
            const fine = hasStats ? this._sources().find(x => x.ms === PERIOD_MS[FINE_PERIOD] && this._relevant(id, x.ms)) : null;
            p2 = fine && ( this.statistics.force || column >= fine.ms ) ? fine : this.statistics.force && valid[0] ? valid[0] : { kind: 'history', ms: 0 };
        }
        return { fam, p1, p2 };
    }

    // Phase 2's blocks for a window r ms long (BRANCH.md), n times as large (the background's
    // coarse ones: 10): up to a day, the width in whole hours (an hour at least); up to 10
    // days, a day; beyond, a tenth of the width in whole days, a calendar month at most —
    // { hours }, { days } or { months }
    _blockOf(r, n = 1)
    {
        if( r <= DAY_MS ) return { hours: n * Math.max(1, Math.ceil(r / HOUR_MS)) };
        const d = r <= 10 * DAY_MS ? 1 : Math.max(1, Math.round(r / 10 / DAY_MS));
        return d >= 30 ? { months: n } : { days: n * d };
    }

    // Blocks of a size (_blockOf) over A to B (ms) widened to whole hours (whole days for
    // blocks of days or months, at local midnight) → [[a, b]], from B — fromLeft: from A
    _blocks(A, B, size, fromLeft = false)
    {
        const _unit = size.hours ? 'hour' : size.days ? 'day' : 'month', _n = size.hours ?? size.days ?? size.months;
        const A0 = alignDown(A, !size.hours), B0 = alignUp(B, !size.hours), out = [];
        // (blocks of the width — up to a day —: the width rounded out to whole hours, one block)
        if( size.hours && B0 - A0 <= ( size.hours + 1 ) * HOUR_MS ) return B0 > A0 ? [[A0, B0]] : out;
        // (a bound for safety: 10 years of a window's blocks)
        if( fromLeft ) for( let a = A0; a < B0 && out.length < 5000; ) { const b = moment(a).add(_n, _unit).valueOf(); out.push([a, Math.min(b, B0)]); a = b; }
        else for( let b = B0; b > A0 && out.length < 5000; ) { const a = moment(b).subtract(_n, _unit).valueOf(); out.push([Math.max(a, A0), b]); b = a; }
        return out;
    }

    // The slot holding time t (ms): its index — the first's, the last's beyond the cache
    _slotAt(t)
    {
        let lo = 0, hi = this.cache.length - 1;
        while( lo < hi ) { const m = ( lo + hi + 1 ) >> 1; if( this.cache[m].a <= t ) lo = m; else hi = m - 1; }
        return lo;
    }

    // The parts of A to B (ms; until now) entity id's layer lacks — not in the cache, nor asked
    // (flying: false, asked or not)
    _lacking(layer, id, A, B, flying = true)
    {
        if( !this.cache.length ) return [];
        A = Math.max(A, this.cache[0].a); B = Math.min(B, Date.now());
        if( B <= A ) return [];
        const cov = flying ? [...( this._flying?.get(layer + ' ' + id) ?? [] )] : [];
        for( let i = this._slotAt(A), i1 = this._slotAt(B - 1); i <= i1; i++ ) for( const x of this.cache[i].cover[layer].get(id) ?? [] ) cov.push(x);
        return outside(A, B, cov);
    }

    // Did entity id's source x (a kind of _sources) come back from a to b empty, or starting
    // well after a (a period of it, a minute for the history) — the recorder no longer keeps
    // it there? Not once all of it has come: no
    _emptyIn(x, id, a, b)
    {
        const t = this._firstIn(x, id, a, b);
        return t !== null && t > a + Math.max(x.ms, 60e3);
    }

    // When entity id's source x (a kind of _sources) begins from a to b (ms): the time of its
    // first row there, b for none (until now); null while some of it hasn't come
    _firstIn(x, id, a, b)
    {
        const layer = LAYER[x.kind];
        if( this._lacking(layer, id, a, b, false).length ) return null;
        b = Math.min(b, Date.now());
        for( let i = this._slotAt(a), i1 = this._slotAt(b - 1); i <= i1; i++ ) for( const row of this.cache[i][layer].get(id) ?? [] ) {
            const t = msOf(row.last_changed);
            if( t >= a && t < b ) return t;
        }
        return b;
    }

    // (a request of a kind widened to whole days — the statistics of the hourly family: their
    // periods whole —, else from where it lacks — a refresh asks only what came since —, until
    // the end of the hour when it reaches now: what comes later asked by a refresh, see
    // _forgetToday — never the last seconds again at each answer)
    _span(kind, a, b)
    {
        if( kind !== 'history' && periodMs(periodOfKind(kind, this.statistics.period)) >= HOUR_MS ) return [alignDown(a, true), alignUp(b, true)];
        return [a, b >= Date.now() - 1000 ? alignUp(b, false) : b];
    }

    // Entity id's source kind (an entity's attributes: together, see _histUnits) asked from A
    // to B (ms) where it lacks it (_lacking): a request for each part lacking (see _span); o:
    // see _ask → a promise of the first error, null for none
    _askSpan(kind, id, A, B, o = {})
    {
        const ids = Array.isArray(id) ? id : [id];
        return Promise.all(this._lacking(LAYER[kind], ids[0], A, B).map(([a, b]) => this._ask(kind, ...this._span(kind, a, b), ids, o))).then(e => e.find(Boolean) ?? null);
    }

    // Series ids' source kind asked from A to B (ms) together, in a single request — those
    // lacking some of it (_lacking), from the first part lacking to the last (see _span); o:
    // see _ask → a promise of its error, null for none
    _askGroup(kind, ids, A, B, o = {})
    {
        let a = Infinity, b = -Infinity;
        const _need = ids.filter(id => {
            const p = this._lacking(LAYER[kind], id, A, B);
            if( p.length ) { a = Math.min(a, p[0][0]); b = Math.max(b, p[p.length - 1][1]); }
            return p.length > 0;
        });
        if( !_need.length ) return Promise.resolve(null);
        return this._ask(kind, ...this._span(kind, a, b), _need, o);
    }

    // Units (see _histUnits) in at most HA_WORKERS groups, in their order — Home Assistant's
    // workers all busy, a request each, and as few requests as that
    _requestGroups(units)
    {
        const n = Math.ceil(units.length / HA_WORKERS), out = [];
        for( let k = 0; k < units.length; k += n ) out.push(units.slice(k, k + n).flat());
        return out;
    }

    // Whether statistics of a period ms long are valid for entity id (see SENSOR_GAPS): not
    // probed yet, or the daily, weekly and monthly ones: valid
    _relevant(id, ms)
    {
        const g = SENSOR_GAPS.get(id);
        if( !g || ms >= PERIOD_MS.day ) return true;
        return ms <= PERIOD_MS[FINE_PERIOD] ? g.fine : g.hour;
    }

    // Entity id's history in the cache from t to now — the state at a block's start, given
    // with it, left out —: { n: how many numbers, short: how many intervals between two numbers
    // following each other are under gap — counted up to PROBE_COUNT, no further }
    _speaks(id, t, gap)
    {
        const _now = Date.now();
        let n = 0, short = 0, prev = null;
        for( let i = this._slotAt(t); i < this.cache.length; i++ ) for( const x of this.cache[i].hist.get(id) ?? [] ) {
            const v = msOf(x.last_changed);
            if( x.b || v <= t || v > _now ) continue;
            if( x.state === '' || x.state === null || isNaN(Number(x.state)) ) { prev = null; continue; }
            n++;
            if( prev !== null && short < PROBE_COUNT && v - prev < gap ) short++;
            prev = v;
        }
        return { n, short };
    }

    // Phase 0: whether the statistics of entities ids are valid (SENSOR_GAPS), before any is
    // used — once a session, for the page (PROBES: an entity's under way) —, all of them in one
    // request: their history's last PROBE_MS, their 5-minute ones and their hourly ones told by
    // it; the others (their hourly ones not valid there) then their last PROBE_LONG_MS (the hour
    // already there not asked again), in one request, their hourly ones told by it — see
    // SENSOR_GAPS.
    // No answer: every statistics valid. The window's loading taken up again once they've come
    _probeFine(ids)
    {
        const _fresh = ids.filter(id => !PROBES.has(id));
        if( _fresh.length ) {
            const _now = Date.now();
            const _valid = l => l.forEach(id => SENSOR_GAPS.set(id, { fine: true, hour: true }));
            // (kept on this device only when told by the history — Home Assistant failing: every
            // statistics valid for this page only)
            let _told = false;
            const p = this._askGroup('history', _fresh, _now - PROBE_MS, _now, { phase: 0 }).then(e => {
                if( e ) return _valid(_fresh);
                _told = true;
                const _sparse = [];
                for( const id of _fresh ) {
                    const s = this._speaks(id, _now - PROBE_MS, FINE_GAP_MS), fine = s.short >= PROBE_COUNT;
                    // (the 5-minute statistics valid: the hourly ones too)
                    SENSOR_GAPS.set(id, { fine, hour: fine || ( s.n > 0 && PROBE_MS / s.n < HOUR_GAP_SHORT_MS ) });
                    if( !SENSOR_GAPS.get(id).hour ) _sparse.push(id);
                }
                if( _sparse.length ) return this._askGroup('history', _sparse, _now - PROBE_LONG_MS, _now, { phase: 0 }).then(e2 => {
                    _told = !e2;
                    for( const id of _sparse ) SENSOR_GAPS.get(id).hour = e2 ? true : this._speaks(id, _now - PROBE_LONG_MS, HOUR_GAP_MS).short >= PROBE_COUNT;
                });
            }).catch(() => { _told = false; _valid(_fresh); }).finally(() => {
                _fresh.forEach(id => PROBES.delete(id));
                if( _told ) this.keepProbes(_fresh.map(id => [id, SENSOR_GAPS.get(id)]));
            });
            for( const id of _fresh ) PROBES.set(id, p);
        }
        // (each probe this card waits for, once)
        this._probeWaits ??= new Set();
        for( const p of new Set(ids.map(id => PROBES.get(id))) ) if( p && !this._probeWaits.has(p) ) {
            this._probeWaits.add(p);
            p.finally(() => { this._probeWaits.delete(p); this._askMissing(); this._drawSoon(); });
        }
    }

    // The layers of the cache an entity's curve is drawn from, the window shown (see
    // _planOf), in their order: first the coarsest whose period a column of pixels holds —
    // what the screen can show, with the fewest values to work out a column from —, then the
    // finer ones where it lacks (the last minutes, not compiled yet), from the coarsest, then
    // the coarser ones (where the recorder keeps no finer one). Among the history, phase 2's
    // source, fam from its finest to phase 1's source (no phase 1: fam's finest, where phase
    // 2's comes back empty) — never statistics not valid for it, nor coarser ones loaded for
    // another window. An angle: the finest first — its history asked to correct the
    // statistics (Home Assistant averages angles as plain numbers, see _background); hourly
    // statistics not valid for it too: its history first, the hourly ones where it isn't kept
    // (past the recorder's retention) — their periods made up held (heldRuns). An entity
    // without statistics: every one (its history only)
    _drawLayers(statIds)
    {
        const G = this._geometry(), out = new Map(), _angles = new Set(this._angleIds(statIds));
        for( const id of statIds ) {
            const { fam, p1, p2 } = this._planOf(id, true, G);
            const V = [{ kind: 'history', ms: 0 }, ...( p2 && p2.kind !== 'history' ? [p2] : [] ), ...fam.slice(0, p1 ? fam.indexOf(p1) + 1 : 1)]
                .filter((x, k, a) => a.findIndex(y => y.kind === x.kind) === k).sort((x, y) => x.ms - y.ms);
            // (an angle, or hourly statistics not valid for it: its history first, where it's kept)
            const k = _angles.has(id) || !this._relevant(id, HOUR_MS) ? 0 : V.findLastIndex(x => x.ms <= G.column);
            out.set(id, [...V.slice(0, k + 1).reverse(), ...V.slice(k + 1)].map(x => LAYER[x.kind]));
        }
        return out;
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

    // Rows put in slot i's layer for entity id from a to b (ms): in place of those there
    // between them (and of those of the same time) — the history's first, the state at a
    // given with it, a boundary (b), dropped where the hours before it are covered too —, the
    // time covered (cover) joined
    _mergeLayer(layer, i, id, rows, a, b)
    {
        const s = this.cache[i], old = s[layer].get(id) ?? [], _hist = layer === 'hist';
        const _add = _hist ? rows.map((x, k) => !k && msOf(x.last_changed) <= a ? { ...x, b: true } : x) : rows;
        const cov = addRange(s.cover[layer].get(id) ?? [], a, b), _new = new Set(_add.map(x => msOf(x.last_changed)));
        const _keep = old.filter(x => { const t = msOf(x.last_changed); return ( t < a || t >= b ) && !_new.has(t); });
        const out = mergeRows(_keep, _add);
        s[layer].set(id, _hist ? out.filter(x => !x.b || !cov.some(([p, q]) => p < msOf(x.last_changed) && msOf(x.last_changed) <= q)) : out);
        s.cover[layer].set(id, cov);
    }

    // The slots from t0 to t1 (ms; until now, from the cache's first): [first, last]
    _slotsOf(t0, t1)
    {
        return [this.mapStartTimeToCacheSlot(Math.max(t0, this.cache[0].start_m.valueOf())), this.mapEndTimeToCacheSlot(Math.min(t1, Date.now()))];
    }

    // Where entity id's statistics of a layer stop, over the last two days: the end of their
    // last row there — the start of those days, loaded without any; null: not loaded there
    _statsEnd(layer, id)
    {
        let end = null;
        for( let i = Math.max(0, this.cache.length - 2); i < this.cache.length; i++ ) {
            const a = this.cache[i][layer].get(id);
            if( a ) end = a.length ? msOf(a[a.length - 1].statistics.end) : end ?? this.cache[i].a;
        }
        return end;
    }

    // What the window lacks asked (BRANCH.md), each entity by its plan (_planOf), sent by
    // phase, then in the graphs' order (see ha-requests.js), each drawn as soon as it comes:
    // - phase 0, once a session: each entity with statistics probed (_probeFine) — nothing
    //   else asked meanwhile (one short request);
    // - phase 1: its coarse source over the window and a width on each side (a month at most;
    //   until now), in one request — where it isn't compiled yet (its period and STATS_LAG
    //   ago), the finer ones of its family, down to the finest;
    // - phase 2: its fine source over the window, in blocks (_blockOf, _blocks) from the
    //   right — without phase 1, where it comes back empty or starting late (past the
    //   recorder's retention), its family's finest there;
    // - the history after the finest statistics drawn (what Home Assistant hasn't compiled
    //   yet, or where they stop early: Home Assistant late with them), in one request;
    // - once the window has come — phases 1 and 2 —: the background (_background).
    // Nothing is asked twice: what the cache has, or a request under way will bring
    _askMissing()
    {
        // Prime the cache on first call; a slot for each day begun since
        if( !this.cache.length ) this.initCache();
        this._extendToNow();

        const t0 = msOf(this.startTime), t1 = msOf(this.endTime), _now = Date.now(), G = this._geometry(), r = G.r;
        // (a new window, or new curves: the background no sooner than AHEAD_GAP_MS after it — a gesture going on)
        const _key = [this.startTime, this.endTime, ...this.historyEntityIds()].join();
        if( _key !== this._aheadKey ) { this._aheadKey = _key; this._backgroundNext = Math.max(this._backgroundNext ?? 0, _now + AHEAD_GAP_MS); }

        // (the cache grown, a year at a time, as far as the background fills it: HORIZON
        // windows before the window — 10 years at most, see growCache)
        while( t0 - HORIZON * r < this.cache[0].a && this.cacheSize < CACHE_MAX_DAYS ) this.growCache(YEAR_DAYS);

        const _ids = this.historyEntityIds();
        if( !_ids.length || r <= 0 ) return;
        const _statIds = this._statisticsIds(), _hasStats = new Set(_statIds);

        // Phase 0: the entities with statistics not probed yet (none needed without the
        // 5-minute ones among the sources) — nothing else asked meanwhile: the phases in their
        // order, the probe one short request
        if( !probesRead ) { probesRead = true; for( const [id, v] of this.keptProbes() ) if( !SENSOR_GAPS.has(id) ) SENSOR_GAPS.set(id, v); }
        const _probing = new Set(this._sources().some(x => x.kind === 'fine') ? _statIds.filter(id => !SENSOR_GAPS.has(id)) : []);
        this._probeFine([..._probing]);
        if( _probing.size ) { this.state.loading = this._loading(); return; }

        // (each request unit's plan — an entity, its attributes together)
        const plans = new Map();
        for( const u of this._histUnits(_ids) ) plans.set(u[0], { u, ...this._planOf(u[0], _hasStats.has(u[0]), G) });
        const _side = Math.min(r, PERIOD_MS[MONTH_PERIOD]), _size = this._blockOf(r);

        // Phase 1: the coarse source over the window and a width on each side — where it isn't
        // compiled yet, the finer ones of its family. A part it lacks wholly outside the window
        // (a side, the window moved): after phase 2 (PHASE_SIDES) — the window shown first
        for( const { u, fam, p1 } of plans.values() ) {
            if( !p1 ) continue;
            for( const [a, b] of this._lacking(LAYER[p1.kind], u[0], t0 - _side, t1 + _side) )
                this._ask(p1.kind, ...this._span(p1.kind, a, b), [u[0]], { phase: this._inWindow(a, b) ? 1 : PHASE_SIDES });
            for( let k = fam.indexOf(p1); k > 0; k-- ) {
                const _from = _now - fam[k].ms - STATS_LAG;
                if( _from >= t1 + _side ) break;
                this._askSpan(fam[k - 1].kind, u[0], Math.max(_from, t0 - _side), t1 + _side, { phase: 1 });
            }
        }

        // Phase 2: the fine source over the window, in blocks from the right — block by block,
        // the entities of a source in groups (_requestGroups), a request each. Where it comes
        // back empty or starting late — the 5-minute statistics, or the history (past the
        // recorder's retention) —: without phase 1, the family's finest there; where the
        // 5-minute ones and those come back empty too (deleted, or begun later, after a change
        // of unit), the history there — the same way
        const _bySource = new Map();
        for( const p of plans.values() ) if( p.p2 ) { if( !_bySource.has(p.p2.kind) ) _bySource.set(p.p2.kind, []); _bySource.get(p.p2.kind).push(p); }
        const _series = (kind, l) => l.flatMap(p => kind === 'history' ? p.u : [p.u[0]]);
        this._blocks(t0, Math.min(t1, _now), _size).forEach(([a, b], k) => {
            for( const [kind, l] of _bySource ) for( const g of this._requestGroups(l.map(p => [p])) ) {
                this._askGroup(kind, _series(kind, g), a, b, { phase: 2, rank: k });
                const _empty = new Map(), _add = (f, ids) => { if( !_empty.has(f) ) _empty.set(f, []); _empty.get(f).push(...ids); };
                for( const p of g ) {
                    if( !this._emptyIn(p.p2, p.u[0], a, b) ) continue;
                    const c = p.p1 ?? p.fam[0];
                    if( !p.p1 && c ) _add(c.kind, [p.u[0]]);
                    if( p.p2.kind !== 'history' && ( !c || this._emptyIn(c, p.u[0], a, b) ) ) _add('history', p.u);
                }
                for( const [f, ids] of _empty ) this._askGroup(f, ids, a, b, { phase: 2, rank: k });
            }
        });

        // Without phase 2: where phase 1's statistics begin late within the window (begun
        // after its start — a state class given later, a change of unit), the history before
        // them, in one request
        for( const p of plans.values() ) {
            if( p.p2 || !p.p1 ) continue;
            const _first = this._firstIn(p.p1, p.u[0], t0, t1);
            if( _first !== null && _first > t0 + p.p1.ms ) this._askGroup('history', p.u, t0, _first, { phase: 2 });
        }

        // The history after the finest statistics drawn — phase 2's, else the family's finest —,
        // the entities from the same time together, in one request
        const _after = new Map();
        for( const { u, fam, p1, p2 } of plans.values() ) {
            const f = p2 ? ( p2.kind === 'history' ? null : p2 ) : p1 ? fam[0] : null;
            if( !f ) continue;
            const _from = alignDown(Math.max(t0, Math.min(_now - f.ms - STATS_LAG, this._statsEnd(LAYER[f.kind], u[0]) ?? Infinity)), false);
            if( _from >= t1 ) continue;
            const _k = _from + ' ' + ( p2 ? 2 : 1 );
            if( !_after.has(_k) ) _after.set(_k, { from: _from, phase: p2 ? 2 : 1, ids: [] });
            _after.get(_k).ids.push(...u);
        }
        for( const x of _after.values() ) this._askGroup('history', x.ids, x.from, t1, { phase: x.phase });

        // (the window come — phases 1 and 2 —: the background)
        if( !this._requests.some(q => !q.background && q.key === _key && q.phase !== undefined) )
            this._background(plans, t0, t1, G, _side, _size);
        this.state.loading = this._loading();
    }

    // Once the window has come, in the background — one request at a time, Home Assistant
    // free (_backgroundFree), the entities of a source together —: first, the history of the
    // angles drawn from statistics (Home Assistant may average them as plain numbers — wrong
    // across 0) over the window, a block at a time from the right; then each side widened,
    // the block nearest the window first: phase 2's source a window on each side, in its
    // blocks; phase 1's beyond what phase 1 asked, up to HORIZON windows, in blocks 10 times
    // as large — while the cache holds fewer than AHEAD_MAX_ROWS rows. What the exports can't
    // tell yet (_probeExports) before the sides
    _background(plans, t0, t1, G, side, size)
    {
        if( !this._backgroundFree() ) return;
        const _now = Date.now(), r = G.r;
        // (the first block some of ids lack: { a, b }, null for none)
        const _first = (kind, ids, blocks) => { for( const [a, b] of blocks ) if( ids.some(id => this._lacking(LAYER[kind], id, a, b).length) ) return { a, b }; return null; };
        const _angles = new Set(this._angleIds([...plans.values()].filter(p => p.fam.length).map(p => p.u[0])));
        const A = [...plans.values()].filter(p => _angles.has(p.u[0]) && p.p2?.kind !== 'history').flatMap(p => p.u);
        const f = A.length ? _first('history', A, this._blocks(t0, Math.min(t1, _now), size)) : null;
        if( f ) return void this._askGroup('history', A, f.a, f.b, { background: true });
        // (what the exports can't tell yet: a request at most, the menu right at once)
        if( this._probeExports([...plans.values()].filter(p => p.fam.length).map(p => p.u[0])) ) return;
        if( this.cacheRows() < AHEAD_MAX_ROWS ) {
            // (the entities by source: phase 2's, fine; phase 1's, coarse)
            const S = new Map(), _add = (x, coarse, ids) => { const k = x.kind + ' ' + coarse; if( !S.has(k) ) S.set(k, { kind: x.kind, coarse, ids: [] }); S.get(k).ids.push(...ids); };
            for( const { u, p1, p2 } of plans.values() ) { if( p2 ) _add(p2, false, p2.kind === 'history' ? u : [u[0]]); if( p1 ) _add(p1, true, [u[0]]); }
            let best = null;
            const _consider = (s, blocks, dist) => { const f = _first(s.kind, s.ids, blocks); if( f && ( !best || dist(f) < best.d ) ) best = { s, f, d: dist(f) }; };
            const _left = f => t0 - f.b, _right = f => f.a - t1, _big = this._blockOf(r, 10);
            for( const s of S.values() ) {
                if( !s.coarse ) { _consider(s, this._blocks(t0 - r, t0, size), _left); _consider(s, this._blocks(t1, Math.min(t1 + r, _now), size, true), _right); }
                else { _consider(s, this._blocks(t0 - HORIZON * r, t0 - side, _big), _left); _consider(s, this._blocks(t1 + side, Math.min(t1 + HORIZON * r, _now), _big, true), _right); }
            }
            if( best ) this._askGroup(best.s.kind, best.s.ids, best.f.a, best.f.b, { background: true });
        }
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

    // Whether entity id's statistics of a period are exported: the 5-minute ones only where
    // valid for it (_relevant: never valid, they'd make up values between its own, which its
    // history holds as long); the others wherever Home Assistant has them
    _exportable(id, period)
    {
        return period !== FINE_PERIOD || this._relevant(id, PERIOD_MS[FINE_PERIOD]);
    }

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
        // (an attribute: no statistics, Home Assistant keeps none; 5-minute statistics not valid
        // for an entity — see _exportable —: none of them, they would make up values)
        if( source !== 'history' ) ids = ids.filter(id => !seriesOf(id).attribute && this._exportable(id, source));
        const t0 = msOf(this.startTime), t1 = msOf(this.endTime), _src = this._exportSource(source);
        if( !ids.length ) return Promise.resolve({});
        // (in the order asked: the graphs')
        const _ordered = r => Object.fromEntries(ids.filter(id => r[id]).map(id => [id, r[id]]));
        // (with the attributes: an entity's state asked with all of them; an attribute shown, its
        // own values — as its curve draws them)
        if( source === 'history' && withAttributes ) {
            const _states = ids.filter(id => !seriesOf(id).attribute), _attrs = ids.filter(id => seriesOf(id).attribute);
            return Promise.all([_states.length ? this._askHA(this.historyRequest(_states, moment(t0), moment(t1), true)) : {}, this.exportRows('history', _attrs)])
                          .then(([a, b]) => _ordered({ ...a, ...b }));
        }
        if( !this.cache.length || !_src )
            return ( source === 'history' ? this.historyCall(ids, moment(t0), moment(t1)) : this._askHA(this.statisticsRequest(ids, moment(t0), moment(t1), source)) ).then(_ordered);
        const c0 = this.mapStartTimeToCacheSlot(this.startTime), c1 = this.mapEndTimeToCacheSlot(this.endTime);
        // (what each entity lacks over the window asked — see _askSpan —, what's under way waited for)
        const _waits = ( _src.kind === 'history' ? this._histUnits(ids) : ids.map(id => [id]) ).map(u => this._askSpan(_src.kind, _src.kind === 'history' ? u : u[0], t0, t1));
        const _under = () => ids.some(id => ( this._flying?.get(_src.layer + ' ' + id) ?? [] ).some(([a, b]) => a < t1 && b > t0));
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

    // What the window has, at least in part, for each export (ids: the series exported — an
    // entity's state, an attribute):
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
            // (a period counted only where exported for it: see _exportable)
            const _fine = a.short && _stats.has(id) && this._exportable(id, '5minute'), _long = ['hour', 'day', 'week', 'month'].filter(p => a.long && this._exportable(id, p));
            if( _fine ) out.periods['5minute']++;
            for( const p of _long ) out.periods[p]++;
            if( _fine || _long.length ) out.statistics++;
        }
        for( const p of STATS_EXPORT_PERIODS.map(x => x.period) ) {
            const _src = this._exportSource(p), _with = ids.filter(id => _stats.has(id) && this._exportable(id, p));
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
    // the entities shown (statIds: those with statistics): their long-term statistics over the
    // window, of the coarsest period the window holds twice (an hour, a day, a week, a month:
    // few rows, one ended at least), their 5-minute statistics — or, without statistics, their
    // history — on its last day; a request at a time (the background's) → whether one was asked
    _probeExports(statIds)
    {
        const c0 = this.mapStartTimeToCacheSlot(this.startTime), c1 = this.mapEndTimeToCacheSlot(this.endTime);
        if( c0 < 0 || c1 < 0 ) return false;
        const _stats = new Set(statIds), _long = [], _fine = [], _hist = [];
        for( const id of this.historyEntityIds() ) {
            const a = this._availability(id, c0, c1, _stats.has(id));
            if( !a.longKnown ) _long.push(id);
            if( !a.shortKnown ) ( _stats.has(id) ? _fine : _hist ).push(id);
        }
        // (a period the window holds twice: one of them whole within it, whatever its alignment)
        const r = msOf(this.endTime) - msOf(this.startTime), _longKind = this._sources().filter(x => !['history', 'fine'].includes(x.kind) && 2 * x.ms <= r).pop()?.kind ?? 'stats';
        // (each kind once: what came, or is coming, not asked again)
        const _lacks = (kind, a, b) => id => this._lacking(LAYER[kind], id, a, b).length > 0;
        const L = _long.filter(_lacks(_longKind, this.cache[c0].a, this.cache[c1].b)), F = _fine.filter(_lacks('fine', this.cache[c1].a, this.cache[c1].b));
        if( L.length ) this._ask(_longKind, this.cache[c0].a, this.cache[c1].b, L, { background: true });
        else if( F.length ) this._ask('fine', this.cache[c1].a, this.cache[c1].b, F, { background: true });
        else if( _hist.some(id => this._lacking('hist', id, msOf(this.endTime) - HOUR_MS, msOf(this.endTime)).length) )
            this._askGroup('history', _hist, msOf(this.endTime) - HOUR_MS, msOf(this.endTime), { background: true });
        else return false;
        return true;
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

    // Is the window loading — a request under way for it (not one for the values around it)?
    _loading()
    {
        return this._requests.some(q => this._serves(q));
    }

    // Does a to b (ms) meet the window shown — the window shown now, whenever it's asked?
    _inWindow(a, b)
    {
        return a < msOf(this.endTime) && b > msOf(this.startTime);
    }

    // Does request q bring some of the window shown now — not in the background, for the cache
    // as it is (not one since cleared), its time in the window shown —, whatever window it was
    // asked for: the window shown is loading while one does; one that doesn't is sent after
    // those that do (see ha-requests.js stale)
    _serves(q)
    {
        return !q.background && q.gen === this._loadGen && this._inWindow(q.b0, q.b1);
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

    // Are entity id's rows of a layer missing in slot i — never loaded, or to be asked again?
    _missing(i, layer, id)
    {
        const s = this.cache[i];
        // (its cover over the day, until now: the statistics by whole days — see _forgetToday)
        const cov = s.cover[layer].get(id);
        return !cov || outside(msOf(s.start), Math.min(msOf(s.end), Date.now()), cov).length > 0;
    }

    // A request to Home Assistant for entities ids from a to b (ms) — kind 'history', 'fine'
    // (5-minute statistics), 'stats' (those of the period), 'day', 'week' or 'month' —, kept
    // under way until it's answered, or fails (even before it's sent); o: { phase (0 to 2:
    // see _askMissing; none: an export's), rank (phase 2's block, from the right), background }.
    // Sent by phase, then by rank, then in the graphs' order — a window no longer shown's
    // after (see ha-requests.js). The answer put in the
    // cache, what's still lacking asked, the graphs drawn again → a promise of its error,
    // null for none (an export waits for it)
    _ask(kind, a, b, ids, o = {})
    {
        const q = { kind, ids: new Set(ids), b0: a, b1: b, gen: this._loadGen, at: Date.now(), background: !!o.background, phase: o.phase, key: this._aheadKey };
        this._requests.push(q);
        // (what it will bring, by layer and entity: see _lacking)
        this._flying ??= new Map();
        for( const id of ids ) { const k = LAYER[kind] + ' ' + id; if( !this._flying.has(k) ) this._flying.set(k, []); this._flying.get(k).push([a, b]); }
        let _p;
        try {
            const _at = Math.min(...ids.map(id => { const k = this.historyEntityIds().indexOf(id); return k < 0 ? 999 : k; }));
            const _o = { order: q.background ? Infinity : ( o.phase ?? 9 ) * 1e6 + ( o.rank ?? 0 ) * 1000 + _at, stale: () => !this._serves(q),
                         info: { phase: o.phase ?? null, background: q.background } };
            _p = kind === 'history' ? this.historyCall(ids, moment(a), moment(b), _o)
                                    : this._askHA(this.statisticsRequest(ids, moment(a), moment(b), periodOfKind(kind, this.statistics.period)), _o);
        } catch( e ) {
            _p = Promise.reject(e);
        }
        return _p.then(r => { this._answered(q, r); return null; }, e => { this._answered(q, null, e); return e ?? new Error('request failed'); });
    }

    // Request q answered (result), or failed (error). Whatever happens in between, the
    // request is no longer under way, the loading state says so, and the graphs are drawn
    // again: never a request left waiting for good, nor a loading state that never ends
    _answered(q, result, error)
    {
        this._requests = this._requests.filter(x => x !== q);
        for( const id of q.ids ) {
            const l = this._flying?.get(LAYER[q.kind] + ' ' + id), k = l?.findIndex(x => x[0] === q.b0 && x[1] === q.b1) ?? -1;
            if( k >= 0 ) l.splice(k, 1);
        }
        // (a request in the background: the next one no sooner than twice what it took)
        if( q.background ) this._backgroundNext = Date.now() + Math.min(AHEAD_GAP_MAX_MS, Math.max(AHEAD_GAP_MS, 2 * ( Date.now() - q.at )));
        try {
            // (an answer for a cache since cleared — reloadHistory —: ignored)
            if( q.gen !== this._loadGen || !this.cache.length ) return;
            if( error ) console.error('history-explorer-card: history request failed', error);
            const _t = performance.now();
            if( this.databaseCallback ) this.databaseCallback(!error);
            // (what each entity asked got, split by day, over the time asked: an entity absent
            // from the answer has nothing there — kept as such, not asked again; a failure:
            // nothing kept, asked again at the next update)
            if( !error ) for( const id of q.ids ) {
                const a = result?.[id] ?? [];
                const _period = periodMs(periodOfKind(q.kind, this.statistics.period));
                const rows = q.kind === 'history' ? a.map(x => ({ last_changed: x.lu * 1000, state: x.s })) : a.map(x => this._statisticsRow(x, _period));
                const _layer = LAYER[q.kind];
                let p = 0;
                for( let i = this._slotAt(q.b0), i1 = this._slotAt(q.b1 - 1); i <= i1; i++ ) {
                    const s = this.cache[i];
                    let k = p;
                    while( k < rows.length && msOf(rows[k].last_changed) < s.b ) k++;
                    this._mergeLayer(_layer, i, id, rows.slice(p, k), Math.max(q.b0, s.a), Math.min(q.b1, s.b));
                    s.askedAt[_layer].set(id, q.at);
                    p = k;
                }
            }
            perf.add('part', performance.now() - _t);
            this._cacheVersion = this.cacheVersion() + 1;
            if( !error ) this._purge();
            // (what's still lacking asked at once, before this answer is drawn: Home Assistant
            // works on it meanwhile)
            if( !error ) this._askMissing();
        } finally {
            this.state.loading = this._loading();
            // (an answer for the time outside the window shown changes nothing shown: not drawn
            // again, a hover, a tooltip left as they are; the next drawing takes it)
            if( q.gen === this._loadGen && this._inWindow(q.b0, q.b1) ) this._drawSoon();
        }
    }

    // The performance test's recorder for the page — { add(kind, ms, info) }, null: none —,
    // every card's steps reported to it (see card-perf.js)
    setPerfRecorder(recorder)
    {
        perf.set(recorder);
    }

    // A request of the history or the statistics to Home Assistant, through the page's
    // regulator (o: see ha-requests.js) — timed, with how many values it gave, while a
    // performance test records (perf)
    _askHA(request, o = {})
    {
        if( !perf.on ) return haRequests.request(() => this._hass.callWS(request), o);
        // (timed while the performance test records: how long it waited in the queue, how long
        // Home Assistant took, what it asked and gave, whether it brought some of the window
        // shown when sent — o.info: its phase, whether it's the background's)
        const _t = performance.now();
        let _sent = _t, _shown = null;
        // (whether it brought some of the window shown when it was sent: see _serves)
        return haRequests.request(() => { _sent = performance.now(); _shown = o.stale ? !o.stale() : null; return this._hass.callWS(request); }, o).then(r => {
            const _values = Object.values(r ?? {}).reduce((n, a) => n + ( Array.isArray(a) ? a.length : 0 ), 0);
            perf.add('request', performance.now() - _sent, { type: request.type, period: request.period ?? null, start: request.start_time, end: request.end_time ?? null,
                entities: ( request.entity_ids ?? request.statistic_ids ?? [] ).length, values: _values, waited: _sent - _t, shown: _shown, ...( o.info ?? {} ) });
            return r;
        });
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
        this._flying = new Map();
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
            // statistics their whole day, the history its hours from then — see _lacking)
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
