// The card's history data: the cache of what Home Assistant returned (history and
// long-term statistics), filled on demand for the time window shown, and the user's own
// state process function. Part of HistoryCardState (added to it in history-explorer-card.js).

import { optionSeriesIdsOf, optionSeriesOf } from "./card-datasets.js";
import { seriesOf, attributeHistories, msOf } from "./history-series.js";
import { STATE_NOT_LISTED, OPTION_DEFAULTS, YEAR_HOURS, MAX_RANGE_YEARS, STATS_EXPORT_PERIODS, INDIRECT_OPTIONS, configWarning } from "./history-options.js";
import { HORIZON } from "./card-yscale.js";
import { perf, REDRAW_CAUSES } from "./card-perf.js";
import { haRequests, HA_WORKERS } from "./ha-requests.js";
import { appendAll, minOf, maxOf } from "./history-arrays.js";
import { isMissingState } from "./history-units.js";
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
// The most rows (periods of its source) a part of phase 1 asked for several entities in a single
// request may hold — larger, in HA_WORKERS groups once the window has moved, a request for each
// entity at a first load (see _askMissing)
const GROUP_MAX_ROWS = 200;
// (the plot's width, a fraction of it: a change smaller ignored before drawing the window again
// whole — see _withinAColumn)
const PX_HYSTERESIS = 0.01;
// (the answers drawn: no sooner than this after the last drawing — see _drawSoon)
const DRAW_GAP_MIN_MS = 100;
// The graphs far from the screen drawn after those on it (see _drawStaleSoon): each when the
// page is free, at most STALE_IDLE_WAIT_MS later; a gesture going on, looked at again every
// STALE_GESTURE_WAIT_MS
const STALE_IDLE_WAIT_MS = 500, STALE_GESTURE_WAIT_MS = 200;
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
// What each probe found (the performance test's report): by entity, { at (when), n, short,
// shortest (its last hour, see _speaks), long (its last day, when asked) } — or { at, kept: true }
// for a verdict read from this device
export const PROBE_INFO = new Map();
// (the verdicts kept on this device read once a page: see card-storage.js keptProbes)
let probesRead = false;
// The caches of the page, by card (pageKey: its name and its YAML — two different cards never
// share one) — { cache, tid }: a card made again on the same page — Home Assistant drawing the
// dashboard again — takes back what its cache held, and asks only what came since (see
// initCache); a card off the page, its cache let go PAGE_CACHE_KEPT_MS later, unless a card
// took it back or it came back (leavePage, backOnPage)
const PAGE_CACHES = new Map(), PAGE_CACHE_KEPT_MS = 10 * 60e3;
const HOUR_MS = 3600e3, DAY_MS = 86400e3;
// Every time in the cache is UTC (ms since 1970) — the local time only for the display. Times
// on a grid of UTC (ms): t at the start of its step, or at the end — the next one, unless t is one
const gridDown = (t, step) => Math.floor(t / step) * step, gridUp = (t, step) => Math.ceil(t / step) * step;
// (a time as Home Assistant is asked: UTC, to the second — "2026-11-24T23:00:00Z")
const utcText = t => new Date(Math.floor(msOf(t) / 1000) * 1000).toISOString().replace('.000Z', 'Z');
// Home Assistant's calendar — its time zone (tz: hass.config.time_zone; none: this device's) —:
// its daily, weekly (from Monday) and monthly statistics are its days, weeks and months
// there → { start(t, unit): the start of the one holding t, add(t, n, unit): n of them after
// the one starting at t } (ms; unit 'day', 'week' or 'month')
const CALENDARS = new Map();
function haCalendar(tz)
{
    if( CALENDARS.has(tz) ) return CALENDARS.get(tz);
    let fmt;
    try { fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz || undefined, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }); }
    catch( e ) { fmt = new Intl.DateTimeFormat('en-US', { hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }); }
    const _parts = t => { const o = {}; for( const p of fmt.formatToParts(new Date(t)) ) o[p.type] = Number(p.value); return o; };
    // (how far the zone's time is from UTC at t; the time of a date's midnight there)
    const _offset = t => { const p = _parts(t); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000; };
    const _midnight = (y, m, d) => { const u = Date.UTC(y, m, d); return u - _offset(u - _offset(u)); };
    const _day = p => new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
    const cal = {
        start(t, unit) {
            const p = _parts(t);
            if( unit === 'month' ) return _midnight(p.year, p.month - 1, 1);
            return _midnight(p.year, p.month - 1, p.day - ( unit === 'week' ? ( _day(p) + 6 ) % 7 : 0 ));
        },
        add(t, n, unit) {
            const p = _parts(t);
            return unit === 'month' ? _midnight(p.year, p.month - 1 + n, 1) : _midnight(p.year, p.month - 1, p.day + n * ( unit === 'week' ? 7 : 1 ));
        },
    };
    CALENDARS.set(tz, cal);
    return cal;
}
// The state in force a request of the history began at (b: see _mergeLayer) — no change of
// the sensor — left out where the row before it gives the same: never drawn, exported or
// counted as a value (a point at midnight that was never recorded, a silence cut in two); kept
// where it tells what nothing before it does (nothing loaded before it, another state, a
// period of statistics whose values varied — its mean isn't the state then). The row before:
// a state, or statistics of a single value (min = mean = max: the value held — Home Assistant's
// made up for a silence, see heldRuns), the same value
const _sameValue = (a, b) => { const x = Number(a), y = Number(b); return a !== '' && b !== '' && !isNaN(x) && !isNaN(y) ? x === y : String(a) === String(b); };
const _repeats = (p, x) => _sameValue(p.state, x.state) && ( !p.statistics || p.statistics.min === p.statistics.max );
// (two rows of the same time: the history's to the µs, a state pushed to the ms)
const _sameTime = (x, y) => Math.abs(msOf(x.last_changed) - msOf(y.last_changed)) < 1;
const withoutRepeats = rows => rows.filter((x, k) => !x.b || !k || !_repeats(rows[k - 1], x));
// Statistics Home Assistant makes up: a period where the sensor sent nothing gets its last
// value — its min, mean and max the same. A run of them, each following the one before, of the
// same period and the same value, is the value held: one row, the first, lasting until the
// run's end (statistics.held; statistics.period: the period of each) — none where it holds
// the value of the row before it. The 5-minute and hourly
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
    // (a run held at the value of the row before it — the silence going on, through a time
    // where nothing was made up: the history kept there, its blocks' joins —: no value of its
    // own, the one before lasting over it)
    return out.filter((x, k) => !( x.statistics?.held && k && _sameValue(out[k - 1].state, x.state) ));
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
// (rows in time order: the index of the first one at time t or later — after: later than t)
function rowIndex(rows, t, after = false)
{
    let lo = 0, hi = rows.length;
    while( lo < hi ) {
        const m = ( lo + hi ) >> 1, x = msOf(rows[m].last_changed);
        if( after ? x <= t : x < t ) lo = m + 1; else hi = m;
    }
    return lo;
}
// (a track's spans — in time order, never overlapping, each { a, b, at, stale }, see the
// cache —: [a, b) set to v, the parts of the others there taken out)
function setSpan(spans, a, b, v)
{
    const out = [];
    for( const s of spans ) {
        if( s.b <= a || s.a >= b ) { out.push(s); continue; }
        if( s.a < a ) out.push({ ...s, b: a });
        if( s.b > b ) out.push({ ...s, a: b });
    }
    out.push({ ...v, a, b });
    return out.sort((p, q) => p.a - q.a);
}
// (spans in time order — those keep takes —: their time as ranges [a, b), those touching joined)
function rangesOf(spans, keep = null)
{
    const out = [];
    for( const s of spans ) {
        if( keep && !keep(s) ) continue;
        const l = out[out.length - 1];
        if( l && s.a <= l[1] ) l[1] = Math.max(l[1], s.b); else out.push([s.a, s.b]);
    }
    return out;
}
// (a span known: not to be asked again — see _forgetToday)
const known = s => !s.stale;
// An empty cache holding the time from `from` (ms) on: by layer, by series, its track (see the cache)
const newStore = from => ({ from, layers: Object.fromEntries(LAYERS.map(l => [l, new Map()])) });
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
// Home Assistant's clock, not this device's (see _haNow): every time Home Assistant gives —
// a state's last update (every state looked at once every HA_CLOCK_SCAN_MS at most), a value
// of its history, the end of a period of its statistics — telling how far its clock is ahead
// of this device's steady one (performance.now: never set) at least: the most it told, kept —
// Home Assistant's now never told earlier than it was before
const HA_CLOCK_SCAN_MS = 5000;
// (this device's steady clock, ms — on the same scale as Date.now when the page opened —: every
// time this device measures — how long since, how long until — never its clock, which may be set)
const steadyNow = () => performance.timeOrigin + performance.now();
// What the page knows of its Home Assistant — one for every card of the page, whatever cache
// each has (a card made again shares its cache, see PAGE_CACHES): how far its clock is ahead of
// this device's steady one at least (ahead — see _noteHaTime), when its states were last looked
// at for it (scanned), and how far it was seen to have compiled its statistics, 5-minute and
// hourly (compiled, by compiledOf — see _answered)
const HA_KNOWN = { ahead: undefined, scanned: -Infinity, compiled: new Map() };
// How late Home Assistant may be with a period's statistics: it compiles them once the
// period has ended (within seconds — room left for it being slow)
const STATS_LAG = 10 * 60e3;
// What Home Assistant compiles: its 5-minute and hourly statistics, once their period has
// ended — its daily, weekly and monthly ones made from the hourly ones when asked (the one
// going on given too, so far). A statistics row final once the 5 minutes, or the hour, holding
// its end were compiled (see _answered)
const compiledOf = name => name === FINE_PERIOD ? FINE_PERIOD : 'hour';
const CALENDAR_UNITS = { day: 'day', week: 'week', month: 'month' };
// The longest Home Assistant's recorder may take to write a state in the history: well above
// its commit_interval (5 s by default) — an empty history for a time ended earlier than that
// before it was asked tells there is none, never one not written yet
const RECORDER_WRITE_MAX_MS = 3600e3;

export class CardHistory
{
    // --------------------------------------------------------------------------------------
    // The cache (this.cache: see newStore), from `from` (cacheSize days ago at first — further
    // back as far as the background fills it, _growCache) on: by layer — the history (hist),
    // the 5-minute statistics (fine), the statistics of the period, hourly by default (stats),
    // the daily, weekly and monthly ones —, by series, a track: its rows in time order —
    // { last_changed, state }, a statistics row also statistics: { end, min, mean, max } —,
    // a row's time its only place, and its spans: the time asked, in order, each { a, b, at:
    // when it was asked, stale: to be asked again }. A span holds every row of its time Home
    // Assistant had when it was asked; the history's first row there, its state at the start,
    // given with each request (a boundary, b: see _mergeLayer). What's lacking is what no known
    // span holds (_lacking); a refresh makes the part of a span asked before its end stale
    // (_forgetToday), its rows kept and drawn until the new ones come; nothing was ever asked
    // where no span is: a gap, never drawn over (see cachedHistory). A state Home Assistant
    // pushes: a row at once (addLiveState). The statistics asked by whole days, the history
    // and the 5-minute ones by whole hours — Home Assistant's periods —, none of it kept by day
    // --------------------------------------------------------------------------------------

    // Is the cache made (initCache)?
    _cacheReady()
    {
        return !!this.cache?.layers;
    }

    // Series id's track in a layer (see the cache) — make: made when there's none; else
    // undefined for none
    _track(layer, id, make = false)
    {
        const m = this.cache.layers[layer];
        let t = m.get(id);
        if( !t && make ) m.set(id, t = { rows: [], spans: [] });
        return t;
    }

    // A time Home Assistant gave (ms): its clock at that time at least (see HA_CLOCK_SCAN_MS)
    _noteHaTime(t)
    {
        if( Number.isFinite(t) ) HA_KNOWN.ahead = Math.max(HA_KNOWN.ahead ?? -Infinity, t - steadyNow());
    }

    // The states Home Assistant gives (hass): their newest last update (see _noteHaTime)
    noteHaClock(hass)
    {
        const _now = steadyNow();
        if( _now - HA_KNOWN.scanned < HA_CLOCK_SCAN_MS ) return;
        HA_KNOWN.scanned = _now;
        let lu = -Infinity;
        for( const st of Object.values(hass?.states ?? {}) ) { const t = Date.parse(st?.last_updated); if( t > lu ) lu = t; }
        this._noteHaTime(lu);
    }

    // Home Assistant's now (ms) — never later than it is: the time an answer is known as of
    // (a span's at), never this device's clock, which may be set otherwise (see _noteHaTime) —
    // this device's, until Home Assistant has given a time
    _haNow()
    {
        return HA_KNOWN.ahead !== undefined ? steadyNow() + HA_KNOWN.ahead : Date.now();
    }

    // How far Home Assistant may have values (ms): the later of this device's now and Home
    // Assistant's (_haNow) — what is asked goes there: asking past what it has costs nothing,
    // knowing it never comes from that (see _haNow)
    askNow()
    {
        return Math.max(Date.now(), this._haNow());
    }

    // What the cache holds against its rules (see the cache), checked after each change
    // while the tests ask for it (window.__HEC_CHECK_CACHE): each broken rule put in
    // window.__HEC_CACHE_ERRORS — where (the change), the layer, the series, what's wrong.
    // In each track: its rows in time order, never two of the same time where one is the
    // card's own (a state pushed, live; a request's start, b) — Home Assistant's alone may
    // share a time, as it gives them —; its spans in order,
    // never overlapping nor empty; every row but a state pushed (live) within a span; the
    // history: no state at a request's start (b) where all the time from the row before it is
    // known — the same, dropped; another, a value recorded there (see _putRows)
    _checkCache(where)
    {
        if( !window.__HEC_CHECK_CACHE || !this._cacheReady() ) return;
        const _err = (l, id, what) => ( window.__HEC_CACHE_ERRORS ??= [] ).push(`${where} ${l} ${id}: ${what}`);
        for( const l of LAYERS ) for( const [id, tr] of this.cache.layers[l] ) {
            const { rows, spans } = tr, _t = k => msOf(rows[k].last_changed);
            for( let k = 1; k < rows.length; k++ ) {
                const d = _t(k) - _t(k - 1), _own = x => x.live || x.b;
                if( !( d >= 0 ) || d < 1 && ( _own(rows[k]) || _own(rows[k - 1]) ) ) { _err(l, id, `rows out of order or of the same time at ${_t(k)}`); break; }
            }
            for( let k = 0; k < spans.length; k++ ) if( !( spans[k].b > spans[k].a ) || k && spans[k].a < spans[k - 1].b ) { _err(l, id, `spans overlapping or empty at ${spans[k].a}`); break; }
            const _all = rangesOf(spans);
            const _out = rows.find(x => !x.live && !_all.some(([a, b]) => a <= msOf(x.last_changed) && msOf(x.last_changed) < b));
            if( _out ) _err(l, id, `a row outside the spans at ${msOf(_out.last_changed)}`);
            if( l === 'hist' ) for( let k = 1; k < rows.length; k++ ) {
                const x = rows[k], p = rows[k - 1], t = _t(k);
                if( x.b && !p.live && this._knownSince(tr, p, x) ) { _err(l, id, `a request's start where the time before it is known at ${t}`); break; }
            }
        }
    }

    initCache()
    {
        // (a card made again: the page's cache of this card, what came since it was asked to
        // be asked again)
        const _page = PAGE_CACHES.get(this.pageKey);
        clearTimeout(_page?.tid);
        if( _page?.cache?.layers ) {
            this.cache = _page.cache;
            PAGE_CACHES.set(this.pageKey, { cache: this.cache });
            this._forgetToday();
            return;
        }
        this.cache = newStore(gridDown(Date.now(), DAY_MS) - this.cacheSize * DAY_MS);
        PAGE_CACHES.set(this.pageKey, { cache: this.cache });
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
        else if( this._cacheReady() && !_page ) PAGE_CACHES.set(this.pageKey, { cache: this.cache });
    }

    // The time the cache holds widened by days days back (CACHE_MAX_DAYS at most)
    _growCache(days)
    {
        if( this.cacheSize >= CACHE_MAX_DAYS ) return;
        this.cache.from -= days * DAY_MS;
        this.cacheSize += days;
    }

    // The last state of entity id (a series id) in the cache that tells something (not
    // isMissingState) — the latest of every layer's rows —; undefined when the cache has none
    // (nothing asked for it: never asked here)
    lastUsableState(id)
    {
        if( !this._cacheReady() ) return undefined;
        let _best;
        for( const layer of LAYERS ) {
            const r = this._track(layer, id)?.rows.findLast(x => x.state !== undefined && x.state !== null && !isMissingState(x.state));
            if( r && ( !_best || msOf(r.last_changed) > msOf(_best.last_changed) ) ) _best = r;
        }
        return _best?.state;
    }

    // The entities whose history is loaded: those shown, and the series a shown entity's
    // options read (see optionSeriesOf: its color, its fill, its arrows' length) — each once
    historyEntityIds()
    {
        const ids = new Set();
        for( const g of this.graphs ) for( const e of g.entities ) ids.add(e.entity);
        for( const id of this.optionSeriesIds() ) ids.add(id);
        return [...ids];
    }

    // The series the shown entities' options read (optionSeriesIdsOf)
    optionSeriesIds()
    {
        const ids = new Set();
        for( const g of this.graphs ) for( const e of g.entities ) for( const id of optionSeriesIdsOf(e) ) ids.add(id);
        return ids;
    }

    // The entities whose long-term statistics are asked: those Home Assistant keeps statistics
    // of (a state_class) — shown or read by a curve's options (optionSeriesOf), however they're shown: a curve,
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
    // one of its uses takes it as such, the entity being in the cache once —, but those of
    // state class measurement_angle: Home Assistant averages the others as plain numbers —
    // wrong across 0 —, so their history is asked besides wherever they're drawn from
    // statistics (see _askMissing); a measurement_angle's statistics are a circular mean
    // (Home Assistant's sensor/recorder.py), drawn as any other's
    _angleIds(statIds)
    {
        const _angles = new Set();
        for( const g of this.graphs ) for( const e of g.entities )
            if( this.circularPeriodOf(e) && this.getStateClass(e.entity) !== 'measurement_angle' ) _angles.add(e.entity);
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
        const _px = Math.max(0, maxOf(this.graphs.map(g => g.chart.hecPlotWidth())));
        const _column = moment(this.endTime).diff(moment(this.startTime)) / ( _px || 1000 );
        for( let k = S.length - 1; k >= 1; k-- ) if( _column >= S[k].ms ) return S[k].kind;
        return this.statistics.force && S[1] ? S[1].kind : 'history';
    }

    // What the window reads (ms) — and so what's asked for it (_askMissing): each curve's time
    // (rowsSpan: the window and the whole groups at its edges), by graph, in its order
    // (curves); each series an option reads (series): over the time of the curves it's read
    // for — a color, a fill —, and for an arrow's length the time around the window its scale
    // looks at too (yScaleRange: as an automatic Y axis); all of them together (all: [from, to])
    readSpans()
    {
        const t0 = msOf(this.startTime), t1 = msOf(this.endTime), Y = this.yScaleRange(), curves = new Map(), series = new Map();
        let A = t0, B = t1;
        const _widen = (id, a, b) => { const x = series.get(id); series.set(id, x ? [Math.min(x[0], a), Math.max(x[1], b)] : [a, b]); };
        for( const g of this.graphs ) curves.set(g, g.entities.map(e => {
            const [a, b] = this.rowsSpan(g, e);
            A = Math.min(A, a); B = Math.max(B, b);
            for( const k of INDIRECT_OPTIONS ) {
                const id = optionSeriesOf(e, k);
                if( id ) _widen(id, k === 'arrowLength' && Y ? Math.min(a, Y[0]) : a, k === 'arrowLength' && Y ? Math.max(b, Y[1]) : b);
            }
            return [a, b];
        }));
        return { curves, series, all: [A, B] };
    }

    // An entity's rows from T0 to T1 (ms), with the one before T0 — when nothing between them
    // was never asked: the value in force at T0 (no interpolation issue at the start of a
    // curve, no state disappearing at the start of a timeline) — and the one after T1: the
    // finest it has over the time each source holds — its history, else its 5-minute
    // statistics, its statistics of the period… (layers: those it may be drawn from, the first
    // preferred — see _drawLayers —; else every one, the finest first) —; in a span of a finer
    // one, the coarser ones before its first row and after its last statistics' end (the
    // recorder no longer keeping it there, statistics not compiled yet). What the cache has is
    // drawn at once, however coarse, a finer layer replacing it as it comes. Empty when the
    // cache has none. The times from T0 to T1 (until now) no source it may be drawn from was
    // asked for: their spans [a, b] (notLoaded), gaps never drawn over
    cachedHistory(entity, T0, T1, layers = null)
    {
        const _layers = layers ?? LAYERS, _end = x => msOf(x.statistics?.end ?? x.last_changed);
        // (each layer's rows from the one before T0 to the one after T1, and where it has some:
        // in each of its spans, from its first row there to its last one's end — the history's
        // last one lasting to the span's end, its first from the span's start where the value in
        // force there is known)
        const _parts = _layers.map(l => {
            const tr = this._track(l, entity);
            if( !tr ) return null;
            const i0 = Math.max(0, rowIndex(tr.rows, T0) - 1), i1 = Math.min(tr.rows.length, rowIndex(tr.rows, T1, true) + 1);
            const rows = tr.rows.slice(i0, i1), has = [];
            if( rows.length ) {
                const lo = msOf(rows[0].last_changed), hi = _end(rows[rows.length - 1]);
                for( const s of tr.spans ) {
                    if( s.b <= lo || s.a > hi ) continue;
                    const k0 = rowIndex(tr.rows, s.a), k1 = rowIndex(tr.rows, s.b);
                    // (the history: from the span's start where the value in force there is known —
                    // the row before it, nothing unknown between —, the value lasting; statistics:
                    // their periods there)
                    if( l === 'hist' && k0 && this._knownSince(tr, tr.rows[k0 - 1], { last_changed: s.a }) ) has.push([s.a, s.b]);
                    else if( k1 > k0 ) has.push([msOf(tr.rows[k0].last_changed), tr.rows[k1 - 1].statistics ? _end(tr.rows[k1 - 1]) : s.b]);
                }
            }
            return { rows, has, spans: tr.spans };
        });
        let r;
        for( let k = _parts.length - 1; k >= 0; k-- ) {
            const p = _parts[k];
            if( !p ) continue;
            if( !r?.length ) { r = p.rows; continue; }
            const _kept = r.filter(x => !p.has.some(([f, l]) => msOf(x.last_changed) < l && _end(x) > f));
            r = _kept.length ? mergeRows(_kept, p.rows) : p.rows;
        }
        const all = heldRuns(withoutRepeats(r ?? []));
        // (the time asked of any of the layers)
        const _seen = rangesOf(_parts.flatMap(p => p?.spans ?? []).sort((p, q) => p.a - q.a));
        let i0 = rowIndex(all, T0), i1 = rowIndex(all, T1, true);
        if( i0 > 0 && !outside(msOf(all[i0 - 1].last_changed), T0, _seen).length ) i0--;
        if( i1 < all.length ) i1++;
        const out = all.slice(i0, i1);
        out.notLoaded = outside(T0, Math.min(T1, this.askNow()), _seen);
        return out;
    }

    // The graphs' data for the time window shown, from the cache: one history per shown
    // entity, in the graphs' order (an empty one when the cache has none, so that the
    // indices stay in step with buildChartData), and the color entities' by entity_id.
    // cause: what has them drawn again (REDRAW_CAUSES), told to the performance test.
    // only: the series whose data changed (an answer's) — only the graphs showing one of
    // them, or colored by one, worked out and drawn again; none: every graph. A graph off the
    // screen: drawn after those on it, or when it comes on it (_watchShown)
    generateGraphDataFromCache(cause, only = null, offscreenToo = false)
    {
        const _t = performance.now();
        const t0 = msOf(this.startTime), t1 = msOf(this.endTime);
        // (what waited to be drawn again — see _drawSoon —: drawn now)
        if( !only || only === this._dirty ) this._dirty = undefined;
        this._lastDrawAt = performance.now();
        // (the window the graphs are drawn whole for — see _withinAColumn)
        if( !only ) { const { r, px } = this._geometry(); this._drawnWhole = { s: msOf(this.startTime), r, px, graphs: [...this.graphs] }; }
        let _graphs = only ? this.graphs.filter(g => g.entities.some(e => only.has(e.entity) || optionSeriesIdsOf(e).some(id => only.has(id)))) : null;
        // (a graph off the screen: drawn after those on it — see _drawStaleSoon —, or when it
        // comes on it, see _watchShown)
        const _all = _graphs ?? this.graphs, _near = offscreenToo ? _all : _all.filter(g => !this._offscreen?.has(g));
        if( _near.length < _all.length ) {
            for( const g of _all ) if( this._offscreen.has(g) ) ( this._staleGraphs ??= new Set() ).add(g);
            _graphs = _near;
            this._drawStaleSoon();
        }
        if( _graphs && !_graphs.length ) return;

        // (a window the cache holds some of: after its start)
        if( this._cacheReady() && t1 > this.cache.from ) {
            const result = [];
            // (each from the layers its ladder allows: see _drawLayers — over the time its
            // points are worked out from, rowsSpan —; a graph not drawn again: nothing worked
            // out, its place kept)
            const _tc = performance.now();
            const _layers = this._drawLayers(this._statisticsIds());
            const R = this.readSpans();
            for( const g of this.graphs ) g.entities.forEach((e, j) => result.push(!_graphs || _graphs.includes(g) ? this.cachedHistory(e.entity, ...R.curves.get(g)[j], _layers.get(e.entity)) : null));
            const colorHistory = {};
            for( const [id, span] of R.series ) colorHistory[id] = this.cachedHistory(id, ...span, _layers.get(id));
            // (timed while the performance test records: the rows read from the cache)
            perf.add('from cache', performance.now() - _tc);
            this.buildChartData(result, colorHistory, _graphs);
        } else
            this.buildChartData(null);
        // (how long the graphs took to be drawn again: the pace of the refreshes, see
        // scheduleAutoRefresh)
        this._lastBuildMs = performance.now() - _t;
        perf.add('redraw', this._lastBuildMs, { cause });
    }

    // The graphs far from the screen left to draw (_staleGraphs), drawn after those on it: one
    // at a time, each when the page is free (requestIdleCallback) — a gesture or a touch never
    // held up longer than a graph takes —, never while a gesture moves the window (after it)
    _drawStaleSoon()
    {
        if( this._staleTid || !this._staleGraphs?.size ) return;
        const _next = () => {
            this._staleTid = 0;
            if( !this._staleGraphs?.size ) return;
            // (a gesture going on: after it)
            if( this.state.drag ) return void ( this._staleTid = setTimeout(_next, STALE_GESTURE_WAIT_MS) );
            const g = this._staleGraphs.values().next().value;
            this._staleGraphs.delete(g);
            if( this.graphs.includes(g) ) this.generateGraphDataFromCache(REDRAW_CAUSES.later, new Set(g.entities.map(e => e.entity)), true);
            this._drawStaleSoon();
        };
        this._staleTid = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(_next, { timeout: STALE_IDLE_WAIT_MS }) : setTimeout(_next, 16);
    }

    // The graphs drawn again from the cache as soon as the page is free — once for all the
    // answers that came meanwhile (each answer is a task of its own: those that came while
    // the graphs were drawn are put in the cache before the next drawing)
    _drawSoon(ids = null)
    {
        // (what is to be drawn again — this._dirty: the series changed since the last drawing,
        // null: every graph, undefined: nothing)
        if( !ids || this._dirty === null ) this._dirty = null;
        else { this._dirty ??= new Set(); for( const id of ids ) this._dirty.add(id); }
        if( this._drawTid ) return;
        // (the answers coming close together drawn once: no sooner than DRAW_GAP_MIN_MS — or
        // twice what drawing took — after the last drawing, the page left free in between)
        const _gap = Math.max(DRAW_GAP_MIN_MS, 2 * this._lastBuildMs);
        this._drawTid = setTimeout(() => {
            this._drawTid = 0;
            // (drawn whole meanwhile: nothing left)
            if( this._dirty === undefined ) return;
            this.generateGraphDataFromCache(REDRAW_CAUSES.answers, this._dirty);
        }, Math.max(0, ( this._lastDrawAt ?? -Infinity ) + _gap - performance.now()));
    }

    // --------------------------------------------------------------------------------------
    // Loading the window: what the cache lacks asked to Home Assistant, in phases (BRANCH.md)
    // --------------------------------------------------------------------------------------

    // What the window shown needs from Home Assistant, asked (see _askMissing); the graphs
    // drawn at once from what the cache has — the window asked is the window shown, whatever
    // is loading —, each answer drawing them again. moved: only the window moved — not drawn
    // again while it moved less than a column of pixels since the graphs were drawn whole
    // (_withinAColumn): nothing shown would change by a pixel
    updateHistory(moved = false)
    {
        this.showDate();
        this._askMissing();
        if( moved && this._withinAColumn() ) return;
        this.generateGraphDataFromCache(moved ? REDRAW_CAUSES.moved : REDRAW_CAUSES.window);
    }

    // The graphs resized: their curves worked out again when the plot's width changed by
    // PX_HYSTERESIS or more since they were drawn whole — a point a column of pixels (see
    // card-datasets.js _lineSamples): narrower, more values in a column; wider, fewer
    plotWidthChanged()
    {
        if( this._drawnWhole && !this._withinAColumn() ) this.generateGraphDataFromCache(REDRAW_CAUSES.resized);
    }

    // Whether the window is still, to a column of pixels, the one the graphs were last drawn
    // whole for (_drawnWhole): the same length, the same graphs as wide, its start moved less
    // than a column since — its answers drawing their own graphs meanwhile
    _withinAColumn()
    {
        const d = this._drawnWhole;
        if( !d ) return false;
        const { r, px, column } = this._geometry(), s = msOf(this.startTime);
        // (the plot's width: a change of less than PX_HYSTERESIS of it ignored — its labels' a few
        // pixels: nothing drawn moves by a pixel)
        return Math.abs(px - d.px) < PX_HYSTERESIS * d.px && Math.abs(r - d.r) < 1 && Math.abs(s - d.s) < column && d.graphs.length === this.graphs.length && d.graphs.every((g, k) => g === this.graphs[k]);
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
        const r = msOf(this.endTime) - msOf(this.startTime), px = Math.max(0, maxOf(this.graphs.map(g => g.chart.hecPlotWidth()))) || 1000;
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

    // Blocks of a size (_blockOf) over A to B (ms) widened to whole hours (whole UTC days for
    // blocks of days, of 30 days for blocks of months) → [[a, b]], from B — fromLeft: from A
    _blocks(A, B, size, fromLeft = false)
    {
        const _unit = size.hours ? HOUR_MS : size.days ? DAY_MS : PERIOD_MS[MONTH_PERIOD], _step = ( size.hours ?? size.days ?? size.months ) * _unit;
        const A0 = gridDown(A, _unit), B0 = gridUp(B, _unit), out = [];
        // (blocks of the width — up to a day —: the width rounded out to whole hours, one block)
        if( size.hours && B0 - A0 <= ( size.hours + 1 ) * HOUR_MS ) return B0 > A0 ? [[A0, B0]] : out;
        // (a bound for safety: 10 years of a window's blocks)
        if( fromLeft ) for( let a = A0; a < B0 && out.length < 5000; a += _step ) out.push([a, Math.min(a + _step, B0)]);
        else for( let b = B0; b > A0 && out.length < 5000; b -= _step ) out.push([Math.max(b - _step, A0), b]);
        return out;
    }

    // A side of a window r long (ms): the time phase 1 asks before and after it, and the purge
    // never touches — a width, a month at most (the zone: min(3 widths, width + 2 months))
    _sideOf(r)
    {
        return Math.min(r, PERIOD_MS[MONTH_PERIOD]);
    }

    // The parts of A to B (ms; until now) entity id's layer lacks — no known span holds, nor
    // asked (flying: false, asked or not); never before the cache's start, the history never
    // before where Home Assistant was seen to keep none (_histFrom)
    _lacking(layer, id, A, B, flying = true)
    {
        if( !this._cacheReady() ) return [];
        A = Math.max(A, this.cache.from, layer === 'hist' ? this._histFrom?.get(id) ?? -Infinity : -Infinity); B = Math.min(B, this.askNow());
        if( B <= A ) return [];
        const cov = flying ? [...( this._flying?.get(layer + ' ' + id) ?? [] )] : [];
        appendAll(cov, rangesOf(this._track(layer, id)?.spans ?? [], known));
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
        // (the history known just before a, without a break: it doesn't begin at a — its
        // state at a, the one in force, not kept, see _mergeLayer)
        const rows = this._track(layer, id)?.rows ?? [];
        if( layer === 'hist' ) {
            const r = rangesOf(this._track(layer, id)?.spans ?? [], known).find(([p, q]) => p < a && a <= q), k = r ? rowIndex(rows, r[0]) : rows.length;
            if( k < rows.length && msOf(rows[k].last_changed) < a ) return a;
        }
        b = Math.min(b, this.askNow());
        const k = rowIndex(rows, a);
        return k < rows.length && msOf(rows[k].last_changed) < b ? msOf(rows[k].last_changed) : b;
    }

    // (a request of a kind: statistics whole periods of theirs — Home Assistant gives a period
    // by its start, a day, a week, a month asked in part made of that part —, the history from
    // where it lacks — a refresh asks only what came since —, until the end of the hour when it
    // reaches now: what comes later asked by a refresh, see _forgetToday — never the last
    // seconds again at each answer)
    _span(kind, a, b)
    {
        if( kind !== 'history' ) return this._periodsOver(periodOfKind(kind, this.statistics.period), a, b);
        return [a, b >= this.askNow() - 1000 ? gridUp(b, HOUR_MS) : b];
    }

    // The whole periods of statistics of a period ('5minute', 'hour', 'day', 'week', 'month')
    // over a to b (ms) — 5 minutes and hours on UTC's grid, days, weeks and months on Home
    // Assistant's calendar (haCalendar) —: [start of the first, end of the last]
    _periodsOver(name, a, b)
    {
        const u = CALENDAR_UNITS[name];
        if( !u ) { const P = periodMs(name); return [gridDown(a, P), gridUp(b, P)]; }
        const cal = haCalendar(this._hass?.config?.time_zone), e = cal.start(b, u);
        return [cal.start(a, u), e < b ? cal.add(e, 1, u) : e];
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

    // Units (see _histUnits — of series ids, or of plans, see _planOf) in at most HA_WORKERS
    // groups, in their order — Home Assistant's workers all busy, a request each, and as few
    // requests as that —: those of the graphs on the screen (shownSeries) first, in
    // groups of their own — never held up by the others —, then the others'
    _requestGroups(units)
    {
        const _s = this.shownSeries(), _on = u => u.some(x => _s.has(typeof x === 'string' ? x : x.u[0]));
        const _groups = l => { const n = Math.ceil(l.length / HA_WORKERS), out = []; for( let k = 0; k < l.length; k += n ) out.push(l.slice(k, k + n).flat()); return out; };
        return [..._groups(units.filter(_on)), ..._groups(units.filter(u => !_on(u)))];
    }

    // Whether statistics of a period ms long are valid for entity id (see SENSOR_GAPS): not
    // probed yet, or the daily, weekly and monthly ones: valid
    _relevant(id, ms)
    {
        const g = SENSOR_GAPS.get(id);
        if( !g || ms >= PERIOD_MS.day ) return true;
        return ms <= PERIOD_MS[FINE_PERIOD] ? g.fine : g.hour;
    }

    // An entity's history as Home Assistant answered the probe (rows: its compressed rows, see
    // historyCall) from t to now — its state at t, given with it, left out —: { n: how many
    // numbers, short: how many intervals between two numbers following each other are under
    // gap — counted up to PROBE_COUNT, no further —, shortest: the shortest of them (ms, null
    // for none) }. From the answer itself, never from the cache: what the cache holds then
    // isn't the probe's to know (a load started again meanwhile empties it, another request
    // may bring the same hours later)
    _speaks(rows, t, gap)
    {
        const _now = this.askNow();
        let n = 0, short = 0, shortest = null, prev = null;
        for( const x of rows ?? [] ) {
            const v = x.lu * 1000;
            if( !( v > t ) || v > _now ) continue;
            if( x.s === '' || x.s === null || isNaN(Number(x.s)) ) { prev = null; continue; }
            n++;
            if( prev !== null ) {
                const d = v - prev;
                if( shortest === null || d < shortest ) shortest = d;
                if( short < PROBE_COUNT && d < gap ) short++;
            }
            prev = v;
        }
        return { n, short, shortest };
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
            const _now = this.askNow();
            const _valid = l => l.forEach(id => SENSOR_GAPS.set(id, { fine: true, hour: true }));
            // (kept on this device only when told by the history — Home Assistant failing: every
            // statistics valid for this page only)
            let _told = false;
            // (asked as any request — put in the cache too —, judged from its own answer, see _speaks)
            const _ask = (ids, from) => this._ask('history', ...this._span('history', from, _now), ids, { phase: 0, raw: true }).then(x => { if( x.error ) throw x.error; return x.result; });
            const p = _ask(_fresh, _now - PROBE_MS).then(r => {
                _told = true;
                const _sparse = [];
                for( const id of _fresh ) {
                    const s = this._speaks(r?.[id], _now - PROBE_MS, FINE_GAP_MS), fine = s.short >= PROBE_COUNT;
                    // (the 5-minute statistics valid: the hourly ones too)
                    SENSOR_GAPS.set(id, { fine, hour: fine || ( s.n > 0 && PROBE_MS / s.n < HOUR_GAP_SHORT_MS ) });
                    PROBE_INFO.set(id, { at: _now, n: s.n, short: s.short, shortest: s.shortest, hours: 1 });
                    if( !SENSOR_GAPS.get(id).hour ) _sparse.push(id);
                }
                if( _sparse.length ) return _ask(_sparse, _now - PROBE_LONG_MS).then(r2 => {
                    for( const id of _sparse ) {
                        const s = this._speaks(r2?.[id], _now - PROBE_LONG_MS, HOUR_GAP_MS);
                        SENSOR_GAPS.get(id).hour = s.short >= PROBE_COUNT;
                        PROBE_INFO.set(id, { ...PROBE_INFO.get(id), long: { n: s.n, short: s.short, shortest: s.shortest } });
                    }
                }, () => { _told = false; for( const id of _sparse ) SENSOR_GAPS.get(id).hour = true; });
            }).catch(() => { _told = false; _valid(_fresh); }).finally(() => {
                _fresh.forEach(id => PROBES.delete(id));
                if( _told ) this.keepProbes(_fresh.map(id => [id, SENSOR_GAPS.get(id)]));
            });
            for( const id of _fresh ) PROBES.set(id, p);
        }
        // (each probe this card waits for, once — its verdicts change the sources of its own
        // entities only: their graphs drawn again)
        this._probeWaits ??= new Set();
        for( const p of new Set(ids.map(id => PROBES.get(id))) ) if( p && !this._probeWaits.has(p) ) {
            this._probeWaits.add(p);
            const _probed = ids.filter(id => PROBES.get(id) === p);
            p.finally(() => { this._probeWaits.delete(p); this._askMissing(); this._drawSoon(_probed); });
        }
    }

    // The layers of the cache an entity's curve is drawn from, the window shown (see
    // _planOf), in their order: first the coarsest whose period a column of pixels holds —
    // what the screen can show, with the fewest values to work out a column from —, then the
    // finer ones where it lacks (the last minutes, not compiled yet), from the coarsest, then
    // the coarser ones (where the recorder keeps no finer one). Among the history, phase 2's
    // source, fam from its finest to phase 1's source (no phase 1: fam's finest, where phase
    // 2's comes back empty) — never statistics not valid for it, nor coarser ones loaded for
    // another window. An angle (_angleIds: not a measurement_angle): the finest first — its history asked to correct the
    // statistics (Home Assistant averages them as plain numbers, see _angleIds, _background); hourly
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

    // An answer's rows put in entity id's track of a layer, from a to b (ms), asked at `at`,
    // final until upto, as of what Home Assistant had compiled then (proof — see _answered;
    // none: at):
    // at each time, what's known as of the latest time stays — the answer put only where no
    // span is known as of a later time (answers coming in any order), there in place of the
    // rows (and of those of the same time), the span known as of `at`. The history's: with the
    // states the card was given there (live) the answer doesn't have yet — not written yet:
    // kept (see addLiveState) —; its first row, the state at a given with it, a boundary (b),
    // dropped where the time before it is known and the row before it gives the same (see
    // withoutRepeats) — so is the first row after a part put when it's such a boundary —, and
    // a state given the same as the row before it (no change: an attribute's time is its
    // entity's last update, whatever changed)
    _mergeLayer(layer, id, rows, a, b, at, upto = at, proof = upto)
    {
        const tr = this._track(layer, id, true), _hist = layer === 'hist';
        if( _hist ) rows = rows.map((x, k) => !k && msOf(x.last_changed) <= a ? { ...x, b: true } : x);
        for( const [p, q] of outside(a, b, tr.spans.filter(s => s.at > at).map(s => [s.a, s.b])) )
            this._putRows(tr, _hist, rows.filter(x => { const t = msOf(x.last_changed); return t >= p && t < q || x.b && p === a; }), p, q, at, upto, proof);
    }

    // (an answer's rows from a to b — where it's the newest — put in track tr: see _mergeLayer)
    _putRows(tr, _hist, rows, a, b, at, upto, proof)
    {
        const old = tr.rows, i0 = rowIndex(old, a), i1 = rowIndex(old, b), _new = new Set(rows.map(x => msOf(x.last_changed)));
        const _given = _hist ? old.slice(i0, i1).filter(x => x.live && !rows.some(y => _sameTime(y, x))) : [];
        const _add = _hist ? mergeRows(rows, _given) : rows;
        const out = mergeRows(old.filter((x, k) => ( k < i0 || k >= i1 ) && !_new.has(msOf(x.last_changed))), _add);
        tr.spans = setSpan(tr.spans, a, b, { at, upto, proof });
        if( !_hist ) { tr.rows = out; return; }
        // (from the part's first row — a, or its boundary before — to the first row after b: a
        // state given the same as the row before it, no change; a request's start where all the
        // time from the row before it is known — see _knownSince —: the same, nothing; another,
        // a change there — nothing could hide between them —, a value recorded)
        const j0 = rowIndex(out, Math.min(a, _add.length ? msOf(_add[0].last_changed) : a)), j1 = Math.min(out.length, rowIndex(out, b, true) + 1), _kept = [];
        out.forEach((x, k) => {
            if( k < j0 || k >= j1 ) return void _kept.push(x);
            const p = k ? out[k - 1] : null;
            if( x.live ) { if( !p || !_sameValue(p.state, x.state) ) _kept.push(x); return; }
            if( !x.b || !p || p.live || !this._knownSince(tr, p, x) ) return void _kept.push(x);
            if( !_repeats(p, x) ) { const { b: _b, ...y } = x; _kept.push(y); }
        });
        tr.rows = _kept;
    }

    // (track tr known — every change — from row p to row x: their time within a known span, up
    // to where it's sure — see the cache)
    _knownSince(tr, p, x)
    {
        const t0 = msOf(p.last_changed), t1 = msOf(x.last_changed);
        return !outside(t0, t1 + 1, rangesOf(tr.spans.filter(known).map(s => ({ a: s.a, b: Math.min(s.b, Math.max(s.upto ?? s.at, s.a)) })).filter(s => s.b > s.a))).length;
    }

    // A state of series id Home Assistant gave the card — pushed, or the one it had when the
    // card looked —, at its time (last_changed): a row of its history (live), known before its
    // recorder writes it (every commit_interval) — an answer of the history without it tells
    // only that it isn't written yet: kept, until one has it (_mergeLayer). None where the
    // history has a row of that time, or the row before it gives the same (no change)
    addLiveState(id, lastChanged, state)
    {
        if( !this._cacheReady() ) this.initCache();
        const tr = this._track('hist', id, true), row = { last_changed: msOf(lastChanged), state, live: true }, k = rowIndex(tr.rows, row.last_changed);
        if( k < tr.rows.length && _sameTime(tr.rows[k], row) || k > 0 && _sameTime(tr.rows[k - 1], row) ) return;
        if( k > 0 && _sameValue(tr.rows[k - 1].state, row.state) ) return;
        tr.rows.splice(k, 0, row);
        this._checkCache('live');
    }

    // The values of series id's history the cache knows, in order — every one recorded, or
    // given by Home Assistant (live); not the state in force repeated at a request's start
    // (b) —: { t, state, afterGap: the time since the one before not all known — not loaded
    // between them (a time after the last answer, pushed by Home Assistant since: known, see
    // addLiveState) }
    knownHistory(id)
    {
        const tr = this._cacheReady() ? this._track('hist', id) : null;
        if( !tr ) return [];
        const cov = rangesOf(tr.spans, known), _known = cov.length ? cov[cov.length - 1][1] : -Infinity;
        const out = [];
        let c = 0, prev = null;
        for( const x of tr.rows ) {
            if( x.b ) continue;
            const t = msOf(x.last_changed);
            if( prev !== null ) while( c < cov.length && cov[c][1] < prev ) c++;
            const _r = prev !== null && c < cov.length && cov[c][0] <= prev ? cov[c] : null;
            out.push({ t, state: x.state, afterGap: prev !== null && !( _r && _r[1] >= Math.min(t, _known) ) });
            prev = t;
        }
        return out;
    }

    // Entity id's last row of a layer before time t (ms), when everything from it to t was
    // asked — the value in force at t —; null for none
    _rowBefore(layer, id, t)
    {
        const tr = this._track(layer, id), k = tr ? rowIndex(tr.rows, t) : 0;
        if( !k ) return null;
        const x = tr.rows[k - 1];
        return outside(msOf(x.last_changed), t, rangesOf(tr.spans)).length ? null : x;
    }

    // Where entity id's statistics of a layer stop, over the last two days: the end of their
    // last row since then — where they were asked since then, without any; null: not asked then
    _statsEnd(layer, id)
    {
        const tr = this._track(layer, id), Z = this.askNow() - 2 * DAY_MS;
        if( !tr ) return null;
        if( rowIndex(tr.rows, Z) < tr.rows.length ) return msOf(tr.rows[tr.rows.length - 1].statistics.end);
        const s = tr.spans.find(x => x.b > Z);
        return s ? Math.max(Z, s.a) : null;
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
        // (the cache made on the first call)
        if( !this._cacheReady() ) this.initCache();

        // (how far Home Assistant may have values: see askNow)
        const t0 = msOf(this.startTime), t1 = msOf(this.endTime), _now = this.askNow(), G = this._geometry(), r = G.r;
        // (a new window, or new curves: the background no sooner than AHEAD_GAP_MS after it — a gesture going on)
        const _key = [this.startTime, this.endTime, ...this.historyEntityIds()].join();
        if( _key !== this._aheadKey ) { this._aheadKey = _key; this._backgroundNext = Math.max(this._backgroundNext ?? 0, steadyNow() + AHEAD_GAP_MS); }

        // (the cache grown, a year at a time, as far as the background fills it: HORIZON
        // windows before the window — 10 years at most, see growCache)
        while( t0 - HORIZON * r < this.cache.from && this.cacheSize < CACHE_MAX_DAYS ) this._growCache(YEAR_DAYS);

        const _ids = this.historyEntityIds();
        if( !_ids.length || r <= 0 ) return;
        const _statIds = this._statisticsIds(), _hasStats = new Set(_statIds);

        // Phase 0: the entities with statistics not probed yet — needed when statistics shorter
        // than a day are among the sources (the 5-minute ones, the hourly ones: see _relevant),
        // whatever their period (statistics.period) — nothing else asked meanwhile: the phases
        // in their order, the probe one short request
        if( !probesRead ) { probesRead = true; for( const [id, v] of this.keptProbes() ) if( !SENSOR_GAPS.has(id) ) { SENSOR_GAPS.set(id, { fine: v.fine, hour: v.hour }); PROBE_INFO.set(id, { at: v.at, kept: true }); } }
        const _probing = new Set(this._sources().some(x => x.kind !== 'history' && x.ms < PERIOD_MS[DAY_PERIOD]) ? _statIds.filter(id => !SENSOR_GAPS.has(id)) : []);
        this._probeFine([..._probing]);
        if( _probing.size ) { this.state.loading = this._loading(); return; }

        // (each request unit's plan — an entity, its attributes together)
        const plans = new Map();
        for( const u of this._histUnits(_ids) ) plans.set(u[0], { u, ...this._planOf(u[0], _hasStats.has(u[0]), G) });
        const _side = this._sideOf(r), _size = this._blockOf(r);

        // Phase 1: the coarse source over the window and a width on each side — where it isn't
        // compiled yet, the finer ones of its family. A part it lacks wholly outside the window
        // (a side, the window moved): after phase 2 (PHASE_SIDES) — the window shown first
        // A part the same for several entities: a short one (GROUP_MAX_ROWS rows at most: a day,
        // a side, the hours since the last compiling), a single request for them all; a large
        // one, the window moved (the entity has some of it already), in HA_WORKERS groups —
        // every worker busy, a request each (_requestGroups); a large one of a first load, a
        // request for each entity
        const _short = new Map(), _large = new Map(), _part = (kind, A, B, id, phase, first) => {
            const [a, b] = this._span(kind, A, B), k = [kind, a, b, phase].join(' ');
            const _big = ( b - a ) / periodMs(periodOfKind(kind, this.statistics.period)) > GROUP_MAX_ROWS;
            if( _big && first ) return void this._ask(kind, a, b, [id], { phase });
            const m = _big ? _large : _short;
            if( !m.has(k) ) m.set(k, { kind, a, b, phase, ids: [] });
            m.get(k).ids.push(id);
        };
        for( const { u, fam, p1 } of plans.values() ) {
            if( !p1 ) continue;
            const _lack = this._lacking(LAYER[p1.kind], u[0], t0 - _side, t1 + _side);
            // (a first load: nothing of it there, nor asked)
            const _first = _lack.length === 1 && _lack[0][0] <= Math.max(t0 - _side, this.cache.from) && _lack[0][1] >= Math.min(t1 + _side, _now);
            for( const [a, b] of _lack )
                _part(p1.kind, a, b, u[0], this._inWindow(a, b) ? 1 : PHASE_SIDES, _first);
            for( let k = fam.indexOf(p1); k > 0; k-- ) {
                const _from = _now - fam[k].ms - STATS_LAG;
                if( _from >= t1 + _side ) break;
                for( const [a, b] of this._lacking(LAYER[fam[k - 1].kind], u[0], Math.max(_from, t0 - _side), t1 + _side) )
                    _part(fam[k - 1].kind, a, b, u[0], 1, _first);
            }
        }
        for( const x of _short.values() ) this._ask(x.kind, x.a, x.b, x.ids, { phase: x.phase });
        for( const x of _large.values() ) for( const ids of this._requestGroups(x.ids.map(id => [id])) ) this._ask(x.kind, x.a, x.b, ids, { phase: x.phase });

        // Phase 2: the fine source over the window, in blocks from the right — block by block,
        // the entities of a source in groups (_requestGroups), a request each. Where it comes
        // back empty or starting late — the 5-minute statistics, or the history (past the
        // recorder's retention) —: without phase 1, the family's finest there; where the
        // 5-minute ones and those come back empty too (deleted, or begun later, after a change
        // of unit), the history there — the same way
        const _bySource = new Map();
        for( const p of plans.values() ) if( p.p2 ) { if( !_bySource.has(p.p2.kind) ) _bySource.set(p.p2.kind, []); _bySource.get(p.p2.kind).push(p); }
        const _series = (kind, l) => l.flatMap(p => kind === 'history' ? p.u : [p.u[0]]);
        // (over what the window reads: its curves' groups at its edges — see readSpans)
        const [R0, R1] = this.readSpans().all;
        this._blocks(R0, Math.min(R1, _now), _size).forEach(([a, b], k) => {
            for( const [kind, l] of _bySource ) for( const g of this._requestGroups(l.map(p => [p])) ) {
                this._askGroup(kind, _series(kind, g), a, b, { phase: 2, rank: k });
                const _empty = new Map(), _add = (f, ids) => { if( !_empty.has(f) ) _empty.set(f, []); appendAll(_empty.get(f), ids); };
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
            const _from = gridDown(Math.max(t0, Math.min(_now - f.ms - STATS_LAG, this._statsEnd(LAYER[f.kind], u[0]) ?? Infinity)), HOUR_MS);
            if( _from >= t1 ) continue;
            const _k = _from + ' ' + ( p2 ? 2 : 1 );
            if( !_after.has(_k) ) _after.set(_k, { from: _from, phase: p2 ? 2 : 1, ids: [] });
            appendAll(_after.get(_k).ids, u);
        }
        for( const x of _after.values() ) this._askGroup('history', x.ids, x.from, t1, { phase: x.phase });

        // (the window come — phases 1 and 2 —: the background)
        if( !this._requests.some(q => !q.background && q.key === _key && q.phase !== undefined) )
            this._background(plans, t0, t1, G, _side, _size);
        this.state.loading = this._loading();
    }

    // Once the window has come, in the background — one request at a time, Home Assistant
    // free (_backgroundFree), the entities of a source together —: first, the history of the
    // angles drawn from statistics (_angleIds: Home Assistant may average them as plain numbers — wrong
    // across 0) over the window, a block at a time from the right; then each side widened,
    // the block nearest the window first: phase 2's source a window on each side, in its
    // blocks; phase 1's beyond what phase 1 asked, up to HORIZON windows, in blocks 10 times
    // as large — while the cache holds fewer than AHEAD_MAX_ROWS rows. What the exports can't
    // tell yet (_probeExports) before the sides
    _background(plans, t0, t1, G, side, size)
    {
        if( !this._backgroundFree() ) return;
        const _now = this.askNow(), r = G.r;
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
            const S = new Map(), _add = (x, coarse, ids) => { const k = x.kind + ' ' + coarse; if( !S.has(k) ) S.set(k, { kind: x.kind, coarse, ids: [] }); appendAll(S.get(k).ids, ids); };
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

    // The cache kept under CACHE_MAX_ROWS rows: past it, the least useful purged until it's
    // back under AHEAD_MAX_ROWS (see CACHE_MAX_ROWS) — the rows farthest from the window first,
    // layer by layer from the finest (the biggest), their spans cut where they are: asked again
    // when they're needed, drawn meanwhile from the coarser statistics kept —, never in the
    // window nor its sides (_sideOf): a long window may keep it past CACHE_MAX_ROWS
    _purge()
    {
        let n = this.cacheRows();
        if( n <= CACHE_MAX_ROWS ) return;
        const t0 = msOf(this.startTime), t1 = msOf(this.endTime), side = this._sideOf(t1 - t0), Z0 = t0 - side, Z1 = t1 + side;
        const _far = t => t < Z0 ? Z0 - t : t > Z1 ? t - Z1 : 0;
        for( const l of LAYERS ) {
            // (how far the rows outside the zone are: the farthest kept no farther than D — those
            // needed gone, a few more of the same distance)
            const _d = [];
            for( const tr of this.cache.layers[l].values() ) for( const x of tr.rows ) { const d = _far(msOf(x.last_changed)); if( d > 0 ) _d.push(d); }
            if( !_d.length ) continue;
            _d.sort((x, y) => y - x);
            // (kept: from A to B — the rows there, every span cut there; a row's time may hold a
            // fraction of a ms, the history's —, a row more for each series of the history: the
            // state in force where it's cut, kept)
            const D = _d[Math.min(n - AHEAD_MAX_ROWS + ( l === 'hist' ? this.cache.layers[l].size : 0 ), _d.length) - 1], A = Z0 - D + 1, B = Z1 + D;
            for( const tr of this.cache.layers[l].values() ) {
                const k0 = rowIndex(tr.rows, A), k1 = rowIndex(tr.rows, B);
                if( k0 === 0 && k1 === tr.rows.length ) continue;
                const rows = tr.rows.slice(k0, k1), _prev = k0 ? tr.rows[k0 - 1] : null;
                // (the history: its state at the start of what's kept, as a request's start gives it,
                // where it was known from that row on)
                // (a request's start there giving the same: moved to it)
                if( l === 'hist' && _prev && !outside(msOf(_prev.last_changed), A, rangesOf(tr.spans)).length && !( rows.length && msOf(rows[0].last_changed) === A ) ) {
                    if( rows[0]?.b && _repeats(_prev, rows[0]) ) rows[0] = { ...rows[0], last_changed: A };
                    else rows.unshift({ last_changed: A, state: _prev.state, b: true });
                }
                n -= tr.rows.length - rows.length;
                tr.rows = rows;
                tr.spans = tr.spans.map(s => ({ ...s, a: Math.max(s.a, A), b: Math.min(s.b, B) })).filter(s => s.b > s.a);
            }
            this._cacheVersion = this.cacheVersion() + 1;
            if( n <= AHEAD_MAX_ROWS ) return;
        }
    }

    // May a request be made in the background now — nothing under way, no gesture going on,
    // the pause after the last one over? If not, the cache is looked at again once it is
    _backgroundFree()
    {
        const _wait = ( this._backgroundNext ?? 0 ) - steadyNow();
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
    // (and kept there); with the attributes, or a source the cache doesn't keep, all asked;
    // the history loaded again meanwhile, asked again once (retried) → a promise of { id: rows }
    exportRows(source, ids, withAttributes = false, retried = false)
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
        if( !this._cacheReady() || !_src )
            return ( source === 'history' ? this.historyCall(ids, moment(t0), moment(t1)) : this._askHA(this.statisticsRequest(ids, moment(t0), moment(t1), source)) ).then(_ordered);
        const _gen = this._loadGen;
        // (what each entity lacks over the window asked — see _askSpan —, what's under way waited for)
        const _waits = ( _src.kind === 'history' ? this._histUnits(ids) : ids.map(id => [id]) ).map(u => this._askSpan(_src.kind, _src.kind === 'history' ? u : u[0], t0, t1));
        const _under = () => ids.some(id => ( this._flying?.get(_src.layer + ' ' + id) ?? [] ).some(([a, b]) => a < t1 && b > t0));
        const _wait = () => new Promise(r => { const _k = () => _under() ? setTimeout(_k, 50) : r(); _k(); });
        // (a request of it failing: the export fails — no file of what came)
        return Promise.all(_waits).then(errors => { const e = errors.find(Boolean); if( e ) throw e; }).then(_wait).then(() => {
            // (the history loaded again meanwhile — the cache emptied, the answers waited for
            // dropped: asked again, from the cache as it now is; once)
            if( this._loadGen !== _gen ) {
                if( retried ) throw new Error('the history was loaded again during the export');
                return this.exportRows(source, ids, withAttributes, true);
            }
            const out = {};
            for( const id of ids ) {
                const _all = this._track(_src.layer, id)?.rows ?? [];
                let rows = _all.slice(rowIndex(_all, t0), rowIndex(_all, t1));
                if( source === 'history' ) {
                    // (the row before the window — the state in force at its start —: see _rowBefore)
                    const _prev = this._rowBefore('hist', id, t0);
                    if( _prev ) rows.unshift(_prev);
                    rows = withoutRepeats(rows);
                    // (as Home Assistant gives it: the state in force at the start, at the start's time
                    // — a series without a value within the window: nothing exported, see _availability)
                    const _in = rows.filter(x => msOf(x.last_changed) >= t0 && msOf(x.last_changed) < t1).map(x => ({ lu: msOf(x.last_changed) / 1000, s: x.state }));
                    if( !_in.length ) continue;
                    const _before = rows.filter(x => msOf(x.last_changed) < t0).pop();
                    if( _before && _in[0].lu * 1000 !== t0 ) _in.unshift({ lu: t0 / 1000, s: _before.state });
                    out[id] = _in;
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
        if( !this._cacheReady() ) return out;
        const _stats = new Set(this._statisticsIds());
        for( const id of ids ) {
            const a = this._availability(id, _stats.has(id));
            if( a.short ) out.history++;
            // (a period counted only where exported for it: see _exportable)
            const _fine = a.short && _stats.has(id) && this._exportable(id, '5minute'), _long = ['hour', 'day', 'week', 'month'].filter(p => a.long && this._exportable(id, p));
            if( _fine ) out.periods['5minute']++;
            for( const p of _long ) out.periods[p]++;
            if( _fine || _long.length ) out.statistics++;
        }
        for( const p of STATS_EXPORT_PERIODS.map(x => x.period) ) {
            const _src = this._exportSource(p), _with = ids.filter(id => _stats.has(id) && this._exportable(id, p));
            out.cached[p] = !!_src && out.periods[p] > 0 && _with.every(id => !this._lacking(_src.layer, id, msOf(this.startTime), msOf(this.endTime), false).length);
        }
        return out;
    }

    // Has entity id's window data of the short-term family — its history, its
    // 5-minute statistics (stats: it has statistics) — and of the long-term one, at least in
    // part? { short, long, shortKnown, longKnown } — has: a value within the window's time — a
    // row of the history there (not the state in force repeated, see withoutRepeats), a period
    // of statistics beginning there: what its export holds —, not only around it; known: some
    // layer of it asked there
    _availability(id, stats)
    {
        // (a layer loaded and empty tells only when its period can end within the window: a
        // month's, empty over a day, tells nothing)
        const t0 = msOf(this.startTime), t1 = msOf(this.endTime), r = t1 - t0, _ms = { stats: periodMs(this.statistics.period), day: PERIOD_MS[DAY_PERIOD], week: PERIOD_MS[WEEK_PERIOD], month: PERIOD_MS[MONTH_PERIOD] };
        const _in = x => { const a = msOf(x.last_changed); return a >= t0 && a < t1; };
        // (a layer's rows over the window, the row before it first — see exportRows)
        const _rows = l => { const _all = this._track(l, id)?.rows ?? [], out = [];
            const _prev = this._rowBefore(l, id, t0);
            if( _prev ) out.push(_prev);
            appendAll(out, _all.slice(rowIndex(_all, t0), rowIndex(_all, t1)));
            return withoutRepeats(out); };
        // (a layer asked within the window, with a row lasting into it — or its period short enough)
        const _asked = l => { const tr = this._track(l, id);
            if( !tr?.spans.some(s => s.a < t1 && s.b > t0) ) return false;
            const k = rowIndex(tr.rows, t1), p = k ? tr.rows[k - 1] : null;
            return !!p && msOf(p.statistics?.end ?? p.last_changed) >= t0 || ( _ms[l] ?? 0 ) <= r; };
        const _of = layers => { let known = false, has = false;
            for( const l of layers ) {
                if( _rows(l).some(_in) ) { has = known = true; continue; }
                if( _asked(l) ) known = true;
            }
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
        if( !this._cacheReady() ) return false;
        const _stats = new Set(statIds), _long = [], _fine = [], _hist = [];
        for( const id of this.historyEntityIds() ) {
            const a = this._availability(id, _stats.has(id));
            if( !a.longKnown ) _long.push(id);
            if( !a.shortKnown ) ( _stats.has(id) ? _fine : _hist ).push(id);
        }
        // (a period the window holds twice: one of them whole within it, whatever its alignment)
        const r = msOf(this.endTime) - msOf(this.startTime), _longKind = this._sources().filter(x => !['history', 'fine'].includes(x.kind) && 2 * x.ms <= r).pop()?.kind ?? 'stats';
        // (each kind once: what came, or is coming, not asked again)
        const _lacks = (kind, a, b) => id => this._lacking(LAYER[kind], id, a, b).length > 0;
        // (over the window's periods; the 5-minute ones over its last day — until now)
        const _e = Math.min(msOf(this.endTime), this.askNow()), [a0, b0] = this._span(_longKind, msOf(this.startTime), _e), [a1, b1] = this._span('fine', _e - DAY_MS, _e);
        const L = _long.filter(_lacks(_longKind, a0, b0)), F = _fine.filter(_lacks('fine', a1, b1));
        if( L.length ) this._ask(_longKind, a0, b0, L, { background: true });
        else if( F.length ) this._ask('fine', a1, b1, F, { background: true });
        else if( _hist.some(id => this._lacking('hist', id, msOf(this.endTime) - HOUR_MS, msOf(this.endTime)).length) )
            this._askGroup('history', _hist, msOf(this.endTime) - HOUR_MS, msOf(this.endTime), { background: true });
        else return false;
        return true;
    }

    // How many rows the cache holds, every entity and layer together
    cacheRows()
    {
        let n = 0;
        if( this._cacheReady() ) for( const l of LAYERS ) for( const tr of this.cache.layers[l].values() ) n += tr.rows.length;
        return n;
    }

    // Is the window loading — a request under way for it (not one for the values around it)?
    _loading()
    {
        return this._requests.some(q => this._serves(q));
    }

    // How many times the window shown has been loaded — its requests all answered — since the
    // card was made
    windowLoads()
    {
        return this._windowLoads ?? 0;
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

    // The time around the window the automatic Y axes look at (card-yscale.js): HORIZON
    // windows on each side, from the cache's start — on a grid of the window's length: the same
    // while the window moves within it, or time passes (what's read from it kept, see
    // _yScaleNeighbours) — [from, to] (ms), null for none
    yScaleRange()
    {
        if( !this._cacheReady() ) return null;
        const t0 = msOf(this.startTime), t1 = msOf(this.endTime), r = Math.max(1, t1 - t0);
        const a = Math.max(Math.floor(( t0 - HORIZON * r ) / r) * r, this.cache.from), b = Math.ceil(( t1 + HORIZON * r ) / r) * r;
        return b > a ? [a, b] : null;
    }

    // How many answers the cache has taken: what was read from it is still up to date while
    // this doesn't change
    cacheVersion()
    {
        return this._cacheVersion ?? 0;
    }

    // A request to Home Assistant for entities ids from a to b (ms) — kind 'history', 'fine'
    // (5-minute statistics), 'stats' (those of the period), 'day', 'week' or 'month' —, kept
    // under way until it's answered, or fails (even before it's sent); o: { phase (0 to 2:
    // see _askMissing; none: an export's), rank (phase 2's block, from the right), background,
    // raw (the promise gives { error, result }: the answer itself — the probe's) }.
    // Sent by phase, then by rank, then those of the graphs on the screen first, in the graphs' order — a window no longer shown's
    // after (see ha-requests.js). The answer put in the
    // cache, what's still lacking asked, the graphs drawn again → a promise of its error,
    // null for none (an export waits for it). Its time whole seconds — as Home Assistant is
    // asked (historyRequest, statisticsRequest): its start the second it's in, its end the
    // next one — the span its answer holds, exactly
    _ask(kind, a, b, ids, o = {})
    {
        a = Math.floor(a / 1000) * 1000; b = Math.ceil(b / 1000) * 1000;
        // (at: Home Assistant's now when it's sent, at least — see _haNow; compiled: how far it
        // was seen to have compiled the statistics it's made of, then — see _answered)
        const _compiledNow = () => kind === 'history' ? null : HA_KNOWN.compiled.get(compiledOf(periodOfKind(kind, this.statistics.period))) ?? null;
        const q = { kind, ids: new Set(ids), b0: a, b1: b, gen: this._loadGen, at: this._haNow(), sent: steadyNow(), background: !!o.background, phase: o.phase, key: this._aheadKey, compiled: _compiledNow() };
        this._requests.push(q);
        // (what it will bring, by layer and entity: see _lacking)
        this._flying ??= new Map();
        for( const id of ids ) { const k = LAYER[kind] + ' ' + id; if( !this._flying.has(k) ) this._flying.set(k, []); this._flying.get(k).push([a, b]); }
        let _p;
        try {
            // (within a phase and a block: those of the graphs on the screen first —
            // see shownSeries —, then in the graphs' order)
            const _at = minOf(ids.map(id => { const k = this.historyEntityIds().indexOf(id); return k < 0 ? 499 : Math.min(k, 499); }));
            const _s = this.shownSeries(), _off = ids.some(id => _s.has(id)) ? 0 : 500;
            const _o = { order: q.background ? Infinity : ( o.phase ?? 9 ) * 1e6 + ( o.rank ?? 0 ) * 1000 + _off + _at, stale: () => !this._serves(q),
                         info: { phase: o.phase ?? null, background: q.background },
                         // (sent: what it's known as of, and what was seen compiled, then)
                         sent: () => { q.at = this._haNow(); q.sent = steadyNow(); q.compiled = _compiledNow(); } };
            _p = kind === 'history' ? this.historyCall(ids, moment(a), moment(b), _o)
                                    : this._askHA(this.statisticsRequest(ids, moment(a), moment(b), periodOfKind(kind, this.statistics.period)), _o);
        } catch( e ) {
            _p = Promise.reject(e);
        }
        // (o.raw: { error, result } — Home Assistant's answer itself, whatever the cache made of it)
        if( o.raw ) return _p.then(r => { this._answered(q, r); return { error: null, result: r }; }, e => { this._answered(q, null, e); return { error: e ?? new Error('request failed'), result: null }; });
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
        if( q.background ) this._backgroundNext = steadyNow() + Math.min(AHEAD_GAP_MAX_MS, Math.max(AHEAD_GAP_MS, 2 * ( steadyNow() - q.sent )));
        try {
            // (an answer for a cache since cleared — reloadHistory —: ignored)
            if( q.gen !== this._loadGen || !this._cacheReady() ) return;
            if( error ) console.error('history-explorer-card: history request failed', error);
            const _t = performance.now();
            if( this.databaseCallback ) this.databaseCallback(!error);
            // (what each entity asked got, over the time asked: an entity absent
            // from the answer has nothing there — kept as such, not asked again; a failure:
            // nothing kept, asked again at the next update)
            const _rows = new Map();
            if( !error ) for( const id of q.ids ) {
                const a = result?.[id] ?? [];
                // (an entity's history — its state at the start included, see historyRequest —
                // beginning well after the start, or empty: Home Assistant keeps none before —
                // the recorder's retention, the entity created later —, never asked there again.
                // Empty, only for a time ended RECORDER_WRITE_MAX_MS before it was asked: near
                // then, its first rows may not be written yet — the recorder writes them every
                // commit_interval)
                // (an attribute: where its entity's history begins — historyCall's entityFirst)
                const _attr = seriesOf(id).attribute, _lu = _attr ? result?.entityFirst?.[id] : a[0]?.lu;
                if( q.kind === 'history' && ( !_attr || result?.entityFirst && id in result.entityFirst ) ) {
                    const _from = _lu != null ? _lu * 1000 : q.b1 <= q.at - RECORDER_WRITE_MAX_MS ? q.b1 : null;
                    if( _from !== null && _from > q.b0 + 60e3 && _from > ( this._histFrom?.get(id) ?? -Infinity ) ) ( this._histFrom ??= new Map() ).set(id, _from);
                }
                const _period = periodMs(periodOfKind(q.kind, this.statistics.period));
                _rows.set(id, q.kind === 'history' ? a.map(x => ({ last_changed: x.lu * 1000, state: x.s })) : a.map(x => this._statisticsRow(x, _period)));
            }
            if( !error ) {
                // (how far it's known: the history as of when it was asked; statistics as of what Home
                // Assistant had compiled — the latest end of its 5-minute or hourly ones it gave, or was
                // seen to have given before it was asked, or ended RECORDER_WRITE_MAX_MS before —, final
                // until the period holding that — the day, week, month going on: so far)
                const _name = q.kind === 'history' ? null : periodOfKind(q.kind, this.statistics.period), _c = _name ? compiledOf(_name) : null;
                let _seen = -Infinity;
                for( const rows of _rows.values() ) {
                    const _l = rows[rows.length - 1];
                    // (the last time Home Assistant dated — a value recorded, never the state in force
                    // at the request's start, dated by the card; the end of a period it compiled —: its
                    // clock there at least, see _noteHaTime)
                    if( _l && ( _name ? _name === _c : msOf(_l.last_changed) > q.b0 ) ) _seen = Math.max(_seen, msOf(_l.statistics?.end ?? _l.last_changed));
                }
                this._noteHaTime(_seen);
                let upto = q.at, proof = q.at;
                if( _name ) {
                    if( _name === _c && _seen > ( HA_KNOWN.compiled.get(_c) ?? -Infinity ) ) HA_KNOWN.compiled.set(_c, _seen);
                    proof = Math.max(q.compiled ?? -Infinity, _name === _c ? _seen : -Infinity, q.at - RECORDER_WRITE_MAX_MS);
                    upto = Math.max(q.b0, Math.min(q.b1, this._periodsOver(_name, proof, proof)[0]));
                }
                for( const [id, rows] of _rows ) this._mergeLayer(LAYER[q.kind], id, rows, q.b0, q.b1, q.at, upto, proof);
            }
            perf.add('part', performance.now() - _t);
            this._checkCache('answer');
            this._cacheVersion = this.cacheVersion() + 1;
            // (each timed while the performance test records)
            if( !error ) { const _tp = performance.now(); this._purge(); perf.add('purge', performance.now() - _tp); this._checkCache('purge'); }
            // (what's still lacking asked at once, before this answer is drawn: Home Assistant
            // works on it meanwhile)
            if( !error ) { const _ta = performance.now(); this._askMissing(); perf.add('ask', performance.now() - _ta); }
        } finally {
            // (the window loaded: one load more — see windowLoads)
            const _was = this.state.loading;
            this.state.loading = this._loading();
            if( _was && !this.state.loading ) this._windowLoads = ( this._windowLoads ?? 0 ) + 1;
            // (an answer for the time outside the window shown changes nothing shown: not drawn
            // again, a hover, a tooltip left as they are; the next drawing takes it — but the
            // history of a curve in smart mode: its silences are worked out on all the cache
            // knows of it, see card-datasets.js knownHistory — drawn again, those curves' graphs)
            if( q.gen === this._loadGen ) {
                if( this._inWindow(q.b0, q.b1) ) this._drawSoon(q.ids);
                else if( q.kind === 'history' ) { const _smart = Array.from(q.ids).filter(id => this.drawnFromKnownHistory(id)); if( _smart.length ) this._drawSoon(_smart); }
            }
        }
    }

    // The performance test's recorder for the page — { add(kind, ms, info) }, null: none —,
    // every card's steps reported to it (see card-perf.js)
    setPerfRecorder(recorder)
    {
        perf.set(recorder);
    }

    // A request of the history or the statistics to Home Assistant, through the page's
    // regulator (o: see ha-requests.js) — request: the request, or a function making it when
    // it's sent (null: nothing left to ask, answered empty without Home Assistant) —, timed,
    // with how many values it gave, while a performance test records (perf)
    _askHA(request, o = {})
    {
        // (made when it's sent: the states of the entities it asks noted then — noteAskedStates)
        // (o.sent: told when it's sent)
        const _make = () => { const r = typeof request === 'function' ? request() : request; if( r ) { this.noteAskedStates(r); o.sent?.(); } return r; };
        if( !perf.on ) return haRequests.request(() => { const r = _make(); return r ? this._hass.callWS(r) : {}; }, o);
        // (timed while the performance test records: how long it waited in the queue, how long
        // Home Assistant took, what it asked and gave, whether it brought some of the window
        // shown when sent — o.info: its phase, whether it's the background's)
        const _t = performance.now();
        let _sent = _t, _shown = null, _onScreen;
        // (whether it brought some of the window shown when it was sent: see _serves)
        // (and how many of its entities are in a graph on the screen when it's sent —
        // see shownSeries)
        return haRequests.request(() => {
            _sent = performance.now(); _shown = o.stale ? !o.stale() : null; request = _make();
            if( request ) { const _s = this.shownSeries(); _onScreen = ( request.entity_ids ?? request.statistic_ids ?? [] ).filter(id => _s.has(id)).length; }
            return request ? this._hass.callWS(request) : {};
        }, o).then(r => {
            if( !request ) return r;
            const _values = Object.values(r ?? {}).reduce((n, a) => n + ( Array.isArray(a) ? a.length : 0 ), 0);
            perf.add('request', performance.now() - _sent, { type: request.type, period: request.period ?? null, start: request.start_time, end: request.end_time ?? null,
                entities: ( request.entity_ids ?? request.statistic_ids ?? [] ).length, onScreen: _onScreen, values: _values, waited: _sent - _t, shown: _shown, ...( o.info ?? {} ) });
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
            configWarning('process', p, `not a valid expression (${e.message}) — ignored`);
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
        const now = moment(this.askNow());
        const last = moment(this.endTime);

        // If auto scroll is allowed (scrolled at or past the previous last event) then adjust the x position
        // if the new event is past the visible graph area.
        // (the window moved to now: drawn again whole, its time axis moved; else nothing shown
        // changes until an answer comes: only asked — each answer draws its own graphs again,
        // see _answered)
        // (the time shown after the end — realTimeGap — kept: the window moved once the end
        // (realTimeEnd) reached, not the window's end)
        if( this.state.autoScroll && moment(last).subtract(this.state.realTimeGap ?? 0, 'ms') < now ) {
            this.today(false, this.state.realTimeGap ?? 0);
        } else {
            this._askMissing();
        }
    }

    // The history loaded again from nothing, now, whatever is loading: a load in progress is
    // superseded — its answer, when it comes, ignored (_loadGen)
    reloadHistory()
    {
        this._loadGen = ( this._loadGen ?? 0 ) + 1;
        this._requests = [];
        this._flying = new Map();
        this._histFrom = new Map();
        this.state.loading = false;
        // (from nothing: a new cache, the page's cache of this card — never one another card of
        // the same name and YAML put there, see initCache)
        this.cache = newStore(gridDown(Date.now(), DAY_MS) - this.cacheSize * DAY_MS);
        if( this.pageKey ) { clearTimeout(PAGE_CACHES.get(this.pageKey)?.tid); PAGE_CACHES.set(this.pageKey, { cache: this.cache }); }
        this.updateHistory();
    }

    // What may have come since it was asked, to be asked again (the refresh): each known span's
    // part from where it's final to its end made stale (see the cache) — the history's from
    // when it was asked, at once; the 5-minute and hourly statistics' from upto, past the
    // periods the entity's history shows without a number (Home Assistant compiles none there:
    // final too, see _withoutNumber), once Home Assistant may have compiled the next one (its
    // end, and STATS_LAG); the daily, weekly and monthly ones' — the one going on so far — from
    // upto, once it may have compiled an hour more since (proof). Asked again at each refresh
    // until it has. Its rows kept meanwhile, and drawn: replaced as each entity's answer comes,
    // never something coarser in between
    _forgetToday()
    {
        if( !this._cacheReady() ) return;
        const _now = this.askNow();
        for( const l of LAYERS ) {
            const _name = l === 'hist' ? null : periodOfKind(Object.keys(LAYER).find(k => LAYER[k] === l), this.statistics.period), _P = _name ? periodMs(_name) : 0;
            for( const [id, tr] of this.cache.layers[l] ) {
                let spans = tr.spans;
                for( const s of tr.spans ) {
                    if( s.stale ) continue;
                    let from = Math.max(s.a, s.upto ?? s.at), due = from;
                    if( _name && !CALENDAR_UNITS[_name] ) {
                        while( from < s.b && this._withoutNumber(id, from, from + _P) ) from += _P;
                        due = from + _P + STATS_LAG;
                    } else if( _name ) due = ( s.proof ?? from ) + HOUR_MS + STATS_LAG;
                    if( from < s.b && _now >= due ) spans = setSpan(spans, from, s.b, { ...s, stale: true });
                }
                tr.spans = spans;
            }
        }
        this._checkCache('refresh');
    }

    // Does entity id's history show no number from a to b (ms) — known to the end of it (asked
    // after b: see the cache), every state in force there unavailable, unknown…? Home Assistant
    // compiles no statistics there
    _withoutNumber(id, a, b)
    {
        const tr = this._track('hist', id);
        if( !tr || outside(a, b, tr.spans.filter(known).map(s => [s.a, Math.min(s.b, s.upto ?? s.at)])).length ) return false;
        const k = rowIndex(tr.rows, a, true);
        return [k ? tr.rows[k - 1] : null, ...tr.rows.slice(k, rowIndex(tr.rows, b))].every(x => !x || x.state === '' || x.state === null || isNaN(Number(x.state)));
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
            start_time: utcText(t0),
            ...( t1 !== null ? { end_time: utcText(t1) } : {} ),
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
        // (each request made when it's sent: from where Home Assistant keeps the history of
        // its series by then — _histFrom, learned from the answers before it —, none when it
        // keeps none of t0 to t1: a request planned before it was known asks no more than that)
        const _ask = (l, series, attributes) => l.length
            ? this._askHA(() => {
                const _from = Math.max(msOf(t0), minOf(series.map(id => this._histFrom?.get(id) ?? -Infinity)));
                if( t1 !== null && _from >= msOf(t1) ) return null;
                return { ...this.historyRequest(l, moment(_from), t1, attributes), ...( attributes ? { significant_changes_only: false } : {} ) };
            }, o)
            : Promise.resolve({});
        // (an attribute's own rows say nothing of where its entity's history begins — an
        // attribute may be missing where the entity's state is there —: that told for each
        // attribute by its entity's first row, its time (s), null for none — see _answered)
        return Promise.all([_ask(_states, _states, false), _ask(_entities, _attrs, true)])
            .then(([r, ra]) => Object.defineProperty({ ...r, ...attributeHistories(_attrs, ra) }, 'entityFirst',
                { value: Object.fromEntries(_attrs.map(id => [id, ra?.[seriesOf(id).entity]?.[0]?.lu ?? null])) }));
    }

    // The request for the long-term statistics of ids from t0 to t1, by period
    statisticsRequest(ids, t0, t1, period)
    {
        return {
            type: ( this.version[0] > 2022 || this.version[1] >= 11 ) ? "recorder/statistics_during_period" : "history/statistics_during_period",
            start_time: utcText(t0),
            end_time: utcText(t1),
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
