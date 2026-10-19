// The card's history data: the cache of what Home Assistant returned (history and
// long-term statistics), filled on demand for the time window shown, and the user's own
// state process function. Part of HistoryCardState (added to it in history-explorer-card.js).

import { colorEntityOf } from "./card-datasets.js";
import { seriesOf, attributeHistories, msOf } from "./history-series.js";
const moment = window.HXLocal_moment;

// The period of the long-term statistics asked, in ms (statistics.period: 'hour' unless set)
const PERIOD_MS = { '5minute': 300e3, hour: 3600e3, day: 86400e3, week: 7 * 86400e3, month: 30 * 86400e3 };
// History parts asked at once (Home Assistant answers two together a quarter sooner)
const HISTORY_REQUESTS = 2;
// The recent time always taken from the history, the statistics not compiled for it yet
const RECENT_MS = 2 * 3600e3;

export class CardHistory
{
    // --------------------------------------------------------------------------------------
    // The cache: a slot a day, from cacheSize days ago to today (the last one). In each, by
    // entity, its history (hist) and its hourly statistics (stats), as rows — { last_changed,
    // state }, a statistics row also statistics: { end, min, mean, max } —, an entity's rows
    // there only once loaded (an empty list: loaded, nothing in it)
    // --------------------------------------------------------------------------------------

    _slot(d, e)
    {
        return { start: d, end: e, start_m: moment(d), end_m: moment(e), hist: new Map(), stats: new Map() };
    }

    initCache()
    {
        let d = moment().format("YYYY-MM-DD") + "T00:00:00";
        d = moment(d).subtract(this.cacheSize, "day").format("YYYY-MM-DD") + "T00:00:00";

        for( let i = 0; i < this.cacheSize+1; i++ ) {
            let e = moment(d).add(1, "day").format("YYYY-MM-DD") + "T00:00:00";
            this.cache.push(this._slot(d, e));
            d = e;
        }
    }

    growCache(growSize)
    {
        if( this.cacheSize >= 20 * 365 ) return;

        let e = this.cache[0].start;

        for( let i = 0; i < growSize; i++ ) {
            let d = moment(e).subtract(1, "day").format("YYYY-MM-DD") + "T00:00:00";
            this.cache.unshift(this._slot(d, e));
            e = d;
        }

        this.cacheSize += growSize;
        // (the requests under way name their slots by index: moved with them)
        for( const q of this._requests ) { q.c0 += growSize; q.c1 += growSize; }

        console.log(`Cache grown from ${this.cacheSize - growSize} to ${this.cacheSize} days`);
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

    // Does the history tell more than the statistics, at the window's resolution — a column
    // of pixels shorter than the statistics' period? (the statistics give each column its
    // min, mean and max as exactly as the history then — to 1 px). Always, the statistics
    // off; never, forced (statistics.force)
    _historyTellsMore()
    {
        if( !this.statistics.enabled ) return true;
        if( this.statistics.force ) return false;
        const _px = Math.max(0, ...this.graphs.map(g => g.chart.hecPlotWidth()));
        const _column = moment(this.endTime).diff(moment(this.startTime)) / ( _px || 1000 );
        return _column < ( PERIOD_MS[this.statistics.period] ?? PERIOD_MS.hour );
    }

    // An entity's rows over cache slots c0 to c1 — each slot's history, and its statistics
    // before the history's first value (where the recorder no longer keeps it: a day past its
    // retention, or the day it begins) — with, first, its last value before c0 when an earlier slot has it, so that the
    // graphs have one value just before the start of their own data (no interpolation issue
    // at the start of a curve, no state disappearing at the start of a timeline). Empty when
    // the cache has none
    cachedHistory(entity, c0, c1)
    {
        const _rows = s => {
            const h = s.hist.get(entity), st = s.stats.get(entity);
            if( !h || !st?.length ) return h ?? st;
            const _first = h.length ? msOf(h[0].last_changed) : Infinity;
            const _before = st.filter(x => msOf(x.statistics.end) <= _first);
            return _before.length ? _before.concat(h) : h;
        };
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
                r.unshift({ last_changed: _last.statistics?.end ?? _last.last_changed, state: _last.state });
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

    // What the window shown needs from Home Assistant, asked — the statistics first, the
    // history only where it tells more:
    // - the hourly statistics of the window, in one request, for the entities that have
    //   some (_statisticsIds): drawn at once, the whole window;
    // - meanwhile the history of the days of the last two hours — what the statistics
    //   don't have yet (an hour's are compiled once it's ended): today, and yesterday until
    //   2:00 —, of yesterday too when its statistics stop before its end (Home Assistant late
    //   with them); and the history of the entities without statistics, everywhere;
    // - the history of the whole window when it tells more than the statistics
    //   (_historyTellsMore: a column of pixels shorter than an hour), a few days at a
    //   time, the most recent first, two parts at once; each part replaces the statistics
    //   over its days as it comes.
    // Nothing is asked twice: what the cache has, or a request under way will bring. The
    // graphs are drawn once everything is there; each answer draws them again meanwhile
    updateHistory()
    {
        this.showDate();
        if( !this._askMissing() ) this.generateGraphDataFromCache();
    }

    // What the window lacks asked (see updateHistory) → whether anything is missing
    _askMissing()
    {

        // Prime the cache on first call
        if( !this.cache.length ) this.initCache();

        // Check if we need to grow the cache due to an overflow
        if( moment(this.startTime) < this.cache[0].start_m ) this.growCache(365);

        const c0 = this.mapStartTimeToCacheSlot(this.startTime);
        const c1 = this.mapEndTimeToCacheSlot(this.endTime);
        const _ids = this.historyEntityIds();
        if( c0 < 0 || c1 < 0 || !_ids.length ) return false;
        const _statIds = this._statisticsIds(), _hasStats = new Set(_statIds);
        const _asked = (kind, i, id) => this._requests.some(q => q.kind === kind && q.c0 <= i && i <= q.c1 && q.ids.has(id));
        let _missing = false;

        // The statistics of the window, in one request
        const _stats = [];
        for( let i = c0; i <= c1; i++ )
            for( const id of _statIds ) if( !this.cache[i].stats.has(id) ) { _missing = true; if( !_asked('stats', i, id) ) _stats.push([i, id]); }
        if( _stats.length ) this._ask('stats', Math.min(..._stats.map(x => x[0])), Math.max(..._stats.map(x => x[0])), new Set(_stats.map(x => x[1])));

        // The history each day needs: everything when it tells more; else the entities
        // without statistics, and the most recent days' (today, yesterday when its
        // statistics stop early)
        const _all = this._historyTellsMore();
        // (the history of the last two hours — the statistics of an hour come once it's
        // ended — asked with them, not after: today's day, and yesterday's too until 2:00;
        // yesterday's as well when its statistics stop before its end)
        const _recentFrom = Date.now() - RECENT_MS;
        const _recent = (i, id) => msOf(this.cache[i].end) > _recentFrom || ( i === this.cacheSize - 1 && this._statisticsStopEarly(this.cache[i], id) );
        const _needs = i => _ids.filter(id => !this.cache[i].hist.has(id) && ( _all || !_hasStats.has(id) || _recent(i, id) ));
        // (a few days at a time — at most 8 parts for the window —, the most recent first)
        const _days = Math.max(1, Math.ceil(( c1 - c0 + 1 ) / 8));
        let i = c1;
        while( i >= c0 ) {
            const _n = _needs(i).filter(id => !_asked('history', i, id));
            if( _needs(i).length ) _missing = true;
            if( !_n.length ) { i--; continue; }
            if( this._requests.filter(q => q.kind === 'history').length >= HISTORY_REQUESTS ) break;
            // (the days before it needing exactly the same entities, up to a part's length: a
            // curve's recent days never asked with weeks of a timeline's)
            const _key = k => _needs(k).filter(id => !_asked('history', k, id)).join();
            let j = i;
            while( j - 1 >= c0 && i - ( j - 1 ) < _days && _key(j - 1) === _n.join() ) j--;
            this._ask('history', j, i, new Set(_n));
            i = j - 1;
        }

        this.state.loading = this._requests.length > 0;
        return _missing;
    }

    // Do entity id's statistics stop before the end of slot s — loaded, its last hour ending
    // before the slot's end (or now)?
    _statisticsStopEarly(s, id)
    {
        const a = s.stats.get(id);
        if( !a ) return false;
        const _end = a.length ? msOf(a[a.length - 1].statistics.end) : msOf(s.start);
        return _end < Math.min(msOf(s.end), Date.now());
    }

    // A request to Home Assistant for slots c0 to c1 and entities ids — kind 'stats' or
    // 'history' —, kept under way until it's answered; the answer put in the cache, what's
    // still missing asked, the graphs drawn again
    _ask(kind, c0, c1, ids)
    {
        const q = { kind, c0, c1, ids, gen: this._loadGen };
        this._requests.push(q);
        const t0 = this.cache[c0].start, t1 = this.cache[c1].end, l = [...ids];
        const _p = kind === 'stats'
            ? this._askHA(this.statisticsRequest(l, t0, t1, this.statistics.period ?? 'hour'))
            : this.historyCall(l, t0, t1);
        _p.then(r => this._answered(q, r), e => this._answered(q, null, e));
    }

    _answered(q, result, error)
    {
        this._requests = this._requests.filter(x => x !== q);
        // (an answer for a cache since cleared — reloadHistory —: ignored)
        if( q.gen !== this._loadGen ) return;
        if( error ) {
            console.log("Database request failure");
            console.log(error);
        }
        const _t = performance.now();
        if( this.databaseCallback ) this.databaseCallback(!error);
        // (what each entity asked got, split by day: an entity absent from the answer has
        // nothing there — kept as such, not asked again; a failure: nothing kept)
        if( !error ) for( const id of q.ids ) {
            const a = result?.[id] ?? [];
            const rows = q.kind === 'stats' ? a.map(x => this._statisticsRow(x)) : a.map(x => ({ last_changed: x.lu * 1000, state: x.s }));
            let p = 0;
            for( let i = q.c0; i <= q.c1; i++ ) {
                const _end = msOf(this.cache[i].end);
                let k = p;
                while( k < rows.length && msOf(rows[k].last_changed) < _end ) k++;
                this.cache[i][q.kind === 'stats' ? 'stats' : 'hist'].set(id, rows.slice(p, k));
                p = k;
            }
        }
        this.perf?.add('part', performance.now() - _t);
        this.state.loading = this._requests.length > 0;
        // (what's still missing asked at once, before this answer is drawn: Home Assistant
        // works on it meanwhile)
        if( !error ) this._askMissing();
        this._drawSoon();
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
    _statisticsRow(x)
    {
        const _v = x.mean ?? x.state ?? x.sum;
        return { last_changed: x.start, state: _v,
                 statistics: { end: x.end ?? msOf(x.start) + 3600e3, min: x.min ?? _v, mean: _v, max: x.max ?? _v } };
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
            this._forgetToday();
            this.updateHistoryAutoRefresh();
        }, Math.max(2000, 5 * ( this._lastBuildMs ?? 0 )));
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

    updateHistoryWithClearCache()
    {
        if( !this.state.loading ) {
            this.cache.length = 0;
            this.updateHistory();
        }
    }

    // Today's history forgotten, to be asked again — what's new since (the refresh). Its
    // statistics aren't: today is drawn from its history
    _forgetToday()
    {
        this.cache[this.cacheSize]?.hist.clear();
    }

    updateAxes()
    {
        for( let g of this.graphs ) {
            if( !this.state.updateCanvas || this.state.updateCanvas === g.canvas ) {
                this.applyTimeAxis(g);
                this.showValues(g);
            }
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

    // The automatic refresh: the newest part of the cache asked again
    refresh()
    {
        this._forgetToday();
        this.updateHistory();
    }
}
