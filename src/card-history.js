// The card's history data: the cache of what Home Assistant returned (history and
// long-term statistics), filled on demand for the time window shown, and the user's own
// state process function. Part of HistoryCardState (added to it in history-explorer-card.js).

import { colorEntityOf } from "./card-datasets.js";
import { seriesOf, attributeHistories } from "./history-series.js";
const moment = window.HXLocal_moment;

export class CardHistory
{
    // --------------------------------------------------------------------------------------
    // Cache control
    // --------------------------------------------------------------------------------------

    initCache()
    {
        let d = moment().format("YYYY-MM-DD") + "T00:00:00";
        d = moment(d).subtract(this.cacheSize, "day").format("YYYY-MM-DD") + "T00:00:00";

        for( let i = 0; i < this.cacheSize+1; i++ ) {
            let e = moment(d).add(1, "day").format("YYYY-MM-DD") + "T00:00:00";
            this.cache.push({ "start" : d, "end" : e, "start_m" : moment(d), "end_m": moment(e), "data" : [], "valid": false });
            d = e;
        }
    }

    growCache(growSize)
    {
        if( this.cacheSize >= 20 * 365 ) return;

        let e = this.cache[0].start;

        for( let i = 0; i < growSize; i++ ) {
            let d = moment(e).subtract(1, "day").format("YYYY-MM-DD") + "T00:00:00";
            this.cache.unshift({ "start" : d, "end" : e, "start_m" : moment(d), "end_m": moment(e), "data" : [], "valid": false });
            e = d;
        }

        this.cacheSize += growSize;

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

    findCacheEntityIndex(c_id, entity)
    {
        if( !this.cache[c_id].valid ) return -1;

        for( let i = 0; i < this.cache[c_id].entities.length; i++ ) {
            if( this.cache[c_id].entities[i] == entity ) return i;
        }

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

    // An entity's history over cache slots c0 to c1, from the cache — with, first, its last
    // state before c0 when an earlier slot has it, so that the graphs have one value just
    // before the start of their own data (no interpolation issue at the start of a curve,
    // no state disappearing at the start of a timeline). Empty when the cache has none.
    cachedHistory(entity, c0, c1)
    {
        let r = [];
        for( let i = c0; i <= c1; i++ ) {
            const k = this.findCacheEntityIndex(i, entity);
            if( k >= 0 ) r = r.concat(this.cache[i].data[k]);
        }
        for( let i = c0 - 1; i >= 0 && this.cache[i].valid; i-- ) {
            const k = this.findCacheEntityIndex(i, entity);
            const n = k >= 0 ? this.cache[i].data[k].length : 0;
            if( n > 0 ) {
                r.unshift({ "last_changed": this.cache[i].data[k][n-1].last_changed, "state": this.cache[i].data[k][n-1].state });
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
    }


    // --------------------------------------------------------------------------------------
    // Search the first cache slot that contains data for the required timecode (full or partial)
    // --------------------------------------------------------------------------------------

    searchFirstAffectedSlot(a, b, t)
    {
        for( let i = a; i <= b; i++ ) {
            if( this.cache[i].end_m >= t ) return i;
        }
        return undefined;
    }


    // --------------------------------------------------------------------------------------
    // On demand history retrieval
    // --------------------------------------------------------------------------------------

    loaderCallback(result)
    {
        //console.log("database retrieval OK");
        //console.log(result);

        if( this.databaseCallback )
            this.databaseCallback(result.length > 0);

        let reload = false;
        let m = 0;

        // Dynamically check if the data pulled from the history DB is still available, if not switch to statistics and reschedule a retrieval
        if( this.statistics.enabled && !this.loader.loadingStats ) {

            // Get the first slot affected by the returned result
            m = this.cacheSize;
            for( let j of result ) {
                let v = this.searchFirstAffectedSlot(this.loader.startIndex, this.loader.endIndex, moment(j[0].last_changed));
                //console.log(`${j[0].entity_id} -> ${j[0].last_changed} -> slot ${v}`);
                if( v && v < m ) m = v;
            }

            // The entire query was out of valid history, the first valid slot is the one after the end of the query (or later, if this was due to a large jump into the past)
            if( !result.length ) {
                //console.log(`result empty, start=${this.loader.startIndex}, end=${this.loader.endIndex}`);
                m = this.loader.endIndex+1;
            }

            // User defined retention period limits
            if( m > this.loader.startIndex && this.statistics.retention ) {
                const limit = this.cacheSize - this.statistics.retention;
                if( m > limit ) {
                    console.warn(`first partial slot ${m}, first history slot is ${limit}`);
                    m = limit;
                }
            }

            // If the first slot with data doesn't cover the full requested time period, then switch to statistics from the that slot and earlier ones
            // Don't switch to statistics on entities that have less than one day of history (newly added to recorder)
            if( m > this.loader.startIndex && m < this.cacheSize ) {
                m++;        // Replace partially filled slot with statistics data
                this.cache[m-1].valid = false;
                this.limitSlot = m-1;
                reload = true;
                //console.log(`Loader switched to statistics (slot ${this.loader.startIndex} to ${this.loader.endIndex}, first full at ${m})`);
            }

        }

        this.loader.loadingStats = false;

        if( this.loader.startIndex == this.loader.endIndex ) {

            // Retrieved data maps to a single slot directly

            if( this.loader.startIndex >= m ) {
                this.cache[this.loader.startIndex].data = result;
                this.cache[this.loader.startIndex].valid = true;
            }

        } else {

            // Retrieved multiple slots, needs to be split accordingly

            for( let i = this.loader.startIndex; i <= this.loader.endIndex; i++ ) {
                this.cache[i].data = [];
                this.cache[i].valid = i >= m;
            }

            for( let j of result ) {

                let p0 = 0;

                for( let i = this.loader.startIndex; i <= this.loader.endIndex; i++ ) {

                    // Find first index that doesn't fit into cache slot [i] anymore (one after the end of the slot data)
                    let t = moment(this.cache[i].end);
                    let p1 = this.findFirstIndex(j, { start: p0, end: j.length-1 }, function(e) { return moment(e.last_changed) >= t });

                    // If none found, this means that everything up to the end goes into the current slot
                    if( p1 < 0 ) p1 = j.length;

                    // Copy the valid part into the current cache slot
                    let r = j.slice(p0, p1);
                    this.cache[i].data.push(r);

                    // Next slot range
                    p0 = p1;

                }

            }

        }

        // Update the list of entities present in the cache slots (the data is in that order)
        for( let i = this.loader.startIndex; i <= this.loader.endIndex; i++ ) {
            this.cache[i].entities = [];
            for( let j of result ) {
                this.cache[i].entities.push(j[0].entity_id);
            }
        }

        this.generateGraphDataFromCache();

        this.state.loading = false;

        if( reload ) this.updateHistory();
    }

    loaderFailed(error)
    {
        console.log("Database request failure");
        console.log(error);

        if( this.databaseCallback )
            this.databaseCallback(false);

        this.buildChartData(null);

        this.state.loading = false;
    }

    loaderCallbackStats(result)
    {
        const m = this.statistics.mode;

        // Build entity -> showMinMax lookup
        const mmMap = {};
        for( const g of this.graphs )
            for( const e of g.entities )
                if( e.showMinMax ) mmMap[e.entity] = e.showMinMax;

        let r = [];

        for( let entity in result ) {
            const a = result[entity];
            const wantMM = mmMap[entity];
            let j = [];
            const pt0 = {'last_changed' : a[0].start, 'state' : a[0][m] ?? a[0].state, 'entity_id' : entity};
            if( wantMM && a[0].min != null ) { pt0.yMin = a[0].min; pt0.yMax = a[0].max ?? a[0].min; }
            j.push(pt0);
            for( let i = 1; i < a.length; i++ ) {
                const pt = {'last_changed' : a[i].start, 'state' : a[i][m] ?? a[i].state};
                if( wantMM && a[i].min != null ) { pt.yMin = a[i].min; pt.yMax = a[i].max ?? a[i].min; }
                j.push(pt);
            }
            r.push(j);
        }

        this.loader.loadingStats = true;

        this.loaderCallback(r);
    }

    minmaxCallback(result)
    {
        // Store hourly min/max keyed by entity then by hour-aligned timestamp (ms)
        if( !this.minmaxCache ) this.minmaxCache = {};
        for( const entity in result ) {
            this.minmaxCache[entity] = {};
            for( const pt of result[entity] ) {
                if( pt.min != null ) {
                    const ts = moment(pt.start).valueOf();
                    this.minmaxCache[entity][ts] = { yMin: pt.min, yMax: pt.max ?? pt.min };
                }
            }
        }
        // (asked in parallel with the history: arrived after it, the curves are redrawn with
        // their band; before it, the history's arrival draws them)
        if( !this.state.loading ) this.updateHistory();
    }

    loaderCallbackWS(result)
    {
        let r = [];

        for( let entity in result ) {
            const a = result[entity];
            let j = [];
            j.push({'last_changed' : a[0].lu * 1000, 'state' : a[0].s, 'entity_id' : entity});
            for( let i = 1; i < a.length; i++ ) {
                j.push({'last_changed' : a[i].lu * 1000, 'state' : a[i].s});
            }
            r.push(j);
        }

        this.loaderCallback(r);
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

    // --------------------------------------------------------------------------------------
    // Rebuild the charts for the current start and end time, load cache as needed
    // --------------------------------------------------------------------------------------

    findFirstIndex(array, range, predicate)
    {
        let l = range.start - 1;
        while( l++ < range.end ) {
            if( predicate(array[l]) ) return l;
        }
        return -1;
    }

    findLastIndex(array, range, predicate)
    {
        let l = range.end + 1;
        while( l-- > range.start ) {
            if( predicate(array[l]) ) return l;
        }
        return -1;
    }

    updateHistory()
    {
        for( let i of this.ui.dateSelector )
            if( i ) i.innerHTML = moment(this.startTime).format(this.i18n.styleDateSelector);

        // Prime the cache on first call
        if( !this.cache.length ) this.initCache();

        // Check if we need to grow the cache due to an overflow
        if( moment(this.startTime) < this.cache[0].start_m ) this.growCache(365);

        // Get cache slot indices for beginning and end of requested time range
        let c0 = this.mapStartTimeToCacheSlot(this.startTime);
        let c1 = this.mapEndTimeToCacheSlot(this.endTime);

        //console.log(`Slots ${c0} to ${c1}`);

        // Get the cache slot (sub)range that needs to be retrieved from the db
        let l0 = ( c0 >= 0 ) ? this.findFirstIndex(this.cache, { 'start': c0, 'end': c1 }, function(e) { return !e.valid; }) : -1;
        let l1 = ( c1 >= 0 ) ? this.findLastIndex(this.cache, { 'start': c0, 'end': c1 }, function(e) { return !e.valid; }) : -1;

        if( l0 >= 0 ) {

            // Requested data range is not yet loaded. Get it from database first and update the chart data aysnc when fetched.

            // TODO: handle this with a scheduled reload
            if( this.state.loading ) {
                if( l0 >= this.loader.startIndex && l1 <= this.loader.endIndex ) return;
                console.log(`Slots ${l0} to ${l1} need loading`);
                console.log(`Double loading blocked, slots ${this.loader.startIndex} to ${this.loader.endIndex} are currently loading`);
                return;
            }

            //console.log(`Slots ${l0} to ${l1} need loading`);

            this.loader.startTime = this.cache[l0].start;
            this.loader.endTime = this.cache[l1].end;
            this.loader.startIndex = l0;
            this.loader.endIndex = l1;

            // Prepare db retrieval request for all visible entities, and those giving them their color
            let t0 = this.loader.startTime.replace('+', '%2b');
            let t1 = this.loader.endTime.replace('+', '%2b');
            const l = this.historyEntityIds();
            const n = l.length;

            if( n > 0 ) {

                this.state.loading = true;

                if( this.statistics.force )
                    this.limitSlot = this.cacheSize + 1;

                if( !this.statistics.enabled || l0 > this.limitSlot ) {

                    // Issue history retrieval call, initiate async cache loading
                    this.historyCall(l, t0, t1).then(this.loaderCallbackWS.bind(this), this.loaderFailed.bind(this));

                    // Parallel statistics query for entities with showMinMax:'history'/'states'
                    const lmm = [];
                    for( const g of this.graphs )
                        for( const e of g.entities ) {
                            const v = e.showMinMax;
                            // (an attribute has no statistics)
                            if( ( v === 'history' || v === 'states' || v === true || v === 'statistics' ) && !seriesOf(e.entity).attribute )
                                lmm.push(e.entity);
                        }
                    if( lmm.length ) {
                        this._hass.callWS(this.statisticsRequest(lmm, t0, t1, this.statistics.period ?? 'hour')).then(this.minmaxCallback.bind(this), () => {});
                    }

                } else {

                    // Issue statistics retrieval call (an attribute has none: no curve there)
                    this._hass.callWS(this.statisticsRequest(l.filter(id => !seriesOf(id).attribute), t0, t1, this.statistics.period)).then(this.loaderCallbackStats.bind(this), this.loaderFailed.bind(this));

                }

            }

        } else

            // All needed slots already in the cache, generate the chart data
            this.generateGraphDataFromCache();
    }

    // A shown entity changed: refresh its recent history — at most once every 2 s, however
    // often the entities change (the next refresh is never postponed by a further change,
    // and the recent history is only reloaded then, not at each change)
    scheduleAutoRefresh()
    {
        if( this._autoRefreshTid ) return;
        this._autoRefreshTid = setTimeout(() => {
            this._autoRefreshTid = 0;
            this.cache[this.cacheSize].valid = false;
            this.updateHistoryAutoRefresh();
        }, 2000);
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

    updateHistoryWithClearCache()
    {
        if( !this.state.loading ) {
            this.cache.length = 0;
            this.updateHistory();
        }
    }

    updateAxes()
    {
        for( let g of this.graphs ) {
            if( !this.state.updateCanvas || this.state.updateCanvas === g.canvas ) {
                g.chart.options.scales.xAxes[0].time.min = this.startTime;
                g.chart.options.scales.xAxes[0].time.max = this.endTime;
                g.chart.update();
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
            ? this._hass.callWS({ ...this.historyRequest(l, t0, t1, attributes), ...( attributes ? { significant_changes_only: false } : {} ) })
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
}
