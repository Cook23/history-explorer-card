// From history data to what the graphs draw: one dataset per entity for the time window
// shown — line modes (smart, stepped...), bars by interval, circular values, timelines.
// Part of HistoryCardState (added to it in history-explorer-card.js).

import { parseColor, parseColorValue, colorForValue } from "./history-default-colors.js";
const Chart = window.HXLocal_Chart;
const moment = window.HXLocal_moment;

// The entity an entity's `color` reads, or null: an entity_id (no CSS color has a dot),
// whose state then holds the color, in any form `color` itself accepts; or the `entity` of
// thresholds, whose value they then compare instead of the value shown
const _ENTITY_ID = /^[a-z_]+\.[a-z0-9_]+$/;
export function colorEntityOf(e)
{
    const c = e?.color;
    const id = ( typeof c === 'string' ? c : ( c && typeof c === 'object' && typeof c.entity === 'string' ) ? c.entity : '' ).trim();
    return _ENTITY_ID.test(id) ? id : null;
}

export class CardDatasets
{
    // --------------------------------------------------------------------------------------
    // Colors: `color` is a value (a color, or thresholds on the value shown), an entity
    // whose state holds one, or thresholds on the value of an entity — then it varies along
    // the curve, with that entity's history. Evaluated at each point (each bar): a curve
    // changes color on a point, never between two.
    // --------------------------------------------------------------------------------------

    // The color of entity e at time t (ms) for the value v, or undefined when none applies
    // (no valid color then): (t, v) => color. null when e's color is a constant — nothing
    // to evaluate. colorHistory: the history of the color entities, by entity_id.
    _colorFunction(e, colorHistory)
    {
        const _ce = colorEntityOf(e);
        const _spec = typeof e.color === 'object' ? parseColorValue(e.color) : null;
        if( !_ce ) return _spec && !_spec.color ? (t, v) => colorForValue(_spec, v) : null;
        // The color entity's states over time, each read once (the calls come in increasing
        // time): thresholds compare them; else each holds a color value
        const _states = ( colorHistory?.[_ce] ?? [] ).map(p => ({ t: moment(p.last_changed).valueOf(), state: p.state,
            spec: _spec ? null : parseColorValue(p.state) }));
        let k = -1;
        return (t, v) => {
            if( k >= 0 && _states[k].t > t ) k = -1;
            while( k + 1 < _states.length && _states[k + 1].t <= t ) k++;
            if( k < 0 ) return undefined;
            return _spec ? colorForValue(_spec, _states[k].state) : colorForValue(_states[k].spec, v);
        };
    }

    // The color of entity e now, for its current value — the legend's, and the curve's until
    // its history is drawn; the palette's (e.paletteColor) when no valid color applies
    _currentColor(e)
    {
        const _ce = colorEntityOf(e);
        const _state = id => this._hass?.states[id]?.state;
        if( _ce && typeof e.color === 'object' ) return colorForValue(parseColorValue(e.color), _state(_ce)) ?? e.paletteColor;
        const _spec = parseColorValue(_ce ? _state(_ce) : e.color);
        return colorForValue(_spec, Number(_state(e.entity))) ?? e.paletteColor;
    }

    // A fill color like `fill` (its transparency), in color c — or undefined when `fill`
    // shows nothing (no fill then)
    _fillLike(c, fill)
    {
        const _f = Chart.helpers.color(fill);
        if( !c || !_f.valid || !_f.alpha() ) return undefined;
        const _c = Chart.helpers.color(c);
        return _c.valid ? _c.alpha(_f.alpha()).rgbString() : undefined;
    }

    // The colors of a curve's points (see _colorFunction): the dataset's colorSteps (one
    // where the color changes), and its own colors made those of the point now (the last
    // one at or before now) — the legend's
    _applyPointColors(ds, e, s, colorFn, scale, fill)
    {
        const _steps = [];
        const _now = Date.now();
        let _prev, _current;
        for( const pt of s ) {
            const t = moment(pt.x).valueOf();
            const c = colorFn(t, scale ? pt.y / scale : pt.y) ?? e.paletteColor;
            if( c !== _prev ) _steps.push({ x: t, borderColor: c, backgroundColor: this._fillLike(c, fill) });
            _prev = c;
            if( t <= _now || _current === undefined ) _current = c;
        }
        ds.colorSteps = _steps.length > 1 ? _steps : undefined;
        if( _current ) {
            ds.borderColor = ds.pointBackgroundColor = _current;
            ds.backgroundColor = this._fillLike(_current, fill) ?? ds.backgroundColor;
        }
    }

    // --------------------------------------------------------------------------------------
    // Graph data generation
    // --------------------------------------------------------------------------------------

    momentCache(tc)
    {
        let r;
        if( tc !== undefined ) {
            if( !this.timeCache.has(tc) ) {
                r = moment(tc);
                this.timeCache.set(tc, r);
            } else
                r = this.timeCache.get(tc);
        }
        return r;
    }

    // 'smart' line mode: a curve while the source reports, and a flat plateau — the last
    // known value held — over each of its silences, instead of a diagonal or a spline
    // bridging the gap to the next value. Same rules as the lowpass_dt integration:
    // - the source's usual interval between values is an EMA (alpha 0.1) of the intervals,
    //   seeded with their median (and σ with their median absolute deviation) so that a
    //   first long interval can't skew it;
    // - an interval longer than mean + 3σ + 0.1 s (never under 1 s) is a silence, and only
    //   counts as that limit in the EMA (lowpass_dt's first-sample-after-silence rule);
    // - the curve resumes one usual interval before the value that ends the silence (a
    //   virtual point at t0 − mean on the plateau), so the spline only ever joins values
    //   the source actually reported at its usual rhythm.
    // Plateaus are marked for Chart.js (hecPlateauEnd on the point ending one: straight,
    // dashed segment; hecVirtual: curve-shaping only, never shown or hovered). An ongoing
    // silence (last value to now / the end of the window) is a plateau too.
    // Note: Home Assistant only records a value when it changes, so a "silence" here is
    // "no new value recorded" — a steady source looks the same, and the plateau is
    // equally right for it (the last value still holds).
    _applySilencePlateaus(s, raw, extended)
    {
        if( raw.length < 3 || s.length < 2 ) return s;

        const _dts = [];
        for( let i = 1; i < raw.length; i++ ) {
            const dt = raw[i].t - raw[i - 1].t;
            if( dt > 0 ) _dts.push(dt);
        }
        if( _dts.length < 2 ) return s;
        _dts.sort((a, b) => a - b);
        let mean = _dts[Math.floor(_dts.length / 2)];
        // σ seeded the same robust way: from the median absolute deviation (×1.4826, its
        // ratio to σ for normally distributed values) — not 0, which would make the first
        // limit mean + 0.1 s and turn the first bit of timing jitter into a "silence"
        const _dev = _dts.map(d => Math.abs(d - mean)).sort((a, b) => a - b);
        const sigma0 = 1.4826 * _dev[Math.floor(_dev.length / 2)];
        let m2 = mean * mean + sigma0 * sigma0;
        const _limit = () => Math.max(mean + 3 * Math.sqrt(Math.max(0, m2 - mean * mean)) + 100, 1000);

        const gaps = [];
        for( let i = 1; i < raw.length; i++ ) {
            const dt = raw[i].t - raw[i - 1].t;
            if( dt <= 0 ) continue;
            const limit = _limit();
            let dtStat = dt;
            if( dt > limit ) {
                gaps.push({ ta: raw[i - 1].t, y: raw[i - 1].y, tb: raw[i].t, lead: mean });
                dtStat = limit;
            }
            mean = 0.9 * mean + 0.1 * dtStat;
            m2   = 0.9 * m2   + 0.1 * dtStat * dtStat;
        }

        const tOf = p => moment(p.x).valueOf();
        const out = s.slice();

        // Inserts the plateau start point (the last value before the silence) right before
        // index k, unless it's already there — decimation may have dropped it
        const ensureStart = (k, ta, y) => {
            if( k > 0 && tOf(out[k - 1]) >= ta ) return k;
            out.splice(k, 0, { x: ta, y });
            return k + 1;
        };

        let k = 0;
        for( const gap of gaps ) {
            while( k < out.length && tOf(out[k]) < gap.tb ) k++;
            if( k === 0 || k >= out.length ) continue;
            k = ensureStart(k, gap.ta, gap.y);
            out.splice(k, 0, { x: gap.tb - gap.lead, y: gap.y, hecPlateauEnd: true, hecVirtual: true });
            k++;
        }

        // Ongoing silence: from the last recorded value to the extension point at the end
        const last = raw[raw.length - 1];
        const end = out[out.length - 1];
        if( extended && tOf(end) - last.t > _limit() ) {
            const kEnd = ensureStart(out.length - 1, last.t, last.y);
            out[kEnd].hecPlateauEnd = true;
        }

        return out;
    }

    buildChartData(result, colorHistory)
    {
        let m_now = moment();
        let m_start = moment(this.startTime);
        let m_end = moment(this.endTime);

        const isDataValid = state => this.pconfig.showUnavailable || !['unavailable', 'unknown'].includes(state);

        let id = 0;

        for( let g of this.graphs ) {

            let updated = false;

            for( let j = 0; j < g.entities.length; j++, id++ ) {

                if( this.state.updateCanvas && this.state.updateCanvas !== g.canvas ) continue;

                var s = [];
                var bcol = [];

                if( result && result.length > id ) {

                    var n = result[id].length;

                    const process = this.buildProcessFunction(g.entities[j].process);

                    // Per entity: a bar graph can hold curves too (see _entityKind)
                    const _kind = this._entityKind(g, g.entities[j]);

                    // Circular values (angles): a continuous curve, see _unwrapCircular
                    const _circP = ( _kind == 'line' || _kind == 'bar' ) ? this._circularPeriod(g.entities[j]) : null;
                    let _circBand = false;
                    if( _circP ) ({ data: result[id], band: _circBand } = this._unwrapCircular(result[id], _circP));

                    if( _kind == 'line' ) {

                        // Fill line chart buffer

                        const scale = (g.entities[j].scale ?? 1.0) * (g.entities[j].siConversionFactor ?? 1.0);

                        const clusterMode = g.entities[j].decimation ?? this.pconfig.decimation ?? 'fast';

                        if( n > 2 && clusterMode && this.activeRange.dataClusterSize > 0 ) {

                            let last_time = this.momentCache(result[id][0].last_changed);
                            let max_state = null, max_time = null;
                            let min_state = null, min_time = null;

                            for( let i = 0; i < n; i++ ) {
                                let state = this.process(result[id][i].state, process);
                                if( isDataValid(state) ) {
                                    state *= scale;
                                    let this_time = this.momentCache(result[id][i].last_changed);
                                    if( clusterMode == 'accurate' ) {
                                        if( max_state === null || state > max_state ) { max_state = state; max_time = this_time; }
                                        if( min_state === null || state < min_state ) { min_state = state; min_time = this_time; }
                                    }
                                    if( !i || this_time.diff(last_time) >= this.activeRange.dataClusterSize ) {
                                        if( clusterMode == 'accurate' ) {
                                            if( min_time < max_time ) {
                                                s.push({ x: min_time, y: min_state});
                                                s.push({ x: max_time, y: max_state});
                                            } else {
                                                s.push({ x: max_time, y: max_state});
                                                s.push({ x: min_time, y: min_state});
                                            }
                                        } else
                                            s.push({ x: this_time, y: state});
                                        last_time = this_time;
                                        max_state = min_state = null;
                                    }
                                }
                            }

                        } else {

                            for( let i = 0; i < n; i++ ) {
                                const state = this.process(result[id][i].state, process);
                                if( isDataValid(state) ) {
                                    {
                                    const pt = { x: result[id][i].last_changed, y: state * scale };
                                    const showMM = g.entities[j].showMinMax;
                                    if( showMM ) {
                                        if( result[id][i].yMin != null ) {
                                            pt.yMin = result[id][i].yMin * scale;
                                            pt.yMax = result[id][i].yMax * scale;
                                        } else if( (showMM === 'history' || showMM === 'states') && this.minmaxCache?.[g.entities[j].entity] ) {
                                            const mm = this.minmaxCache[g.entities[j].entity];
                                            const ts = moment(result[id][i].last_changed).valueOf();
                                            const bucket = Math.floor(ts / 3600000) * 3600000;
                                            const slot = mm[bucket] ?? mm[bucket - 3600000];
                                            if( slot ) { pt.yMin = slot.yMin * scale; pt.yMax = slot.yMax * scale; }
                                        }
                                    }
                                    s.push(pt);
                                }
                                }
                            }
                        }

                        let _extended = false;
                        if( m_now > m_end && s.length > 0 && moment(s[s.length-1].x) < m_end ) {
                            const state = this.process(result[id][n-1].state, process);
                            if( isDataValid(state) ) {
                                const pt = { x: m_end, y: state * scale };
                                const showMM = g.entities[j].showMinMax;
                                if( showMM && result[id][n-1].yMin != null ) { pt.yMin = result[id][n-1].yMin * scale; pt.yMax = result[id][n-1].yMax * scale; }
                                s.push(pt);
                                _extended = true;
                            }
                        } else if( m_now <= m_end && s.length > 0 && moment(s[s.length-1].x) < m_now ) {
                            const state = this.process(result[id][n-1].state, process);
                            if( isDataValid(state) ) {
                                const pt = { x: m_now, y: state * scale };
                                const showMM = g.entities[j].showMinMax;
                                if( showMM && result[id][n-1].yMin != null ) { pt.yMin = result[id][n-1].yMin * scale; pt.yMax = result[id][n-1].yMax * scale; }
                                s.push(pt);
                                _extended = true;
                            }
                        }

                        if( (this.normalizeLineMode(g.entities[j].lineMode) || this.pconfig.defaultLineMode) === 'smart' ) {
                            // Silences are detected on every recorded value (before decimation)
                            const _raw = [];
                            for( let i = 0; i < n; i++ ) {
                                const state = this.process(result[id][i].state, process);
                                if( !isDataValid(state) ) continue;
                                const y = state * scale;
                                if( !isNaN(y) ) _raw.push({ t: moment(result[id][i].last_changed).valueOf(), y });
                            }
                            s = this._applySilencePlateaus(s, _raw, _extended);
                        }

                        if( _circBand ) this._markCircularJumps(s, _circP * Math.abs(scale));

                        const _colorFn = this._colorFunction(g.entities[j], colorHistory);
                        if( _colorFn ) this._applyPointColors(g.chart.data.datasets[j], g.entities[j], s, _colorFn, scale, parseColor(g.entities[j].fill));

                    } else if( _kind == 'bar' && n > 0 ) {

                        const scale = (g.entities[j].scale ?? 1.0) * (g.entities[j].siConversionFactor ?? 1.0);
                        const netBars = g.entities[j].netBars ?? false;

                        const _colorFn = this._colorFunction(g.entities[j], colorHistory);

                        let td;
                        if( g.interval == 0 ) td = moment.duration(10, "minute"); else
                        if( g.interval == 1 ) td = moment.duration(1, "hour"); else
                        if( g.interval == 2 ) td = moment.duration(1, "day"); else
                        if( g.interval == 3 ) td = moment.duration(1, "month");

                        let i = 0;
                        let y0 = this.process(result[id][0].state, process) * 1.0;
                        let y1 = y0;

                        // Start time of the range, snapped to interval boundary
                        const f = ( g.interval <= 1 ) ? 'YYYY-MM-DDTHH[:00:00]' : ( g.interval <= 2 ) ? 'YYYY-MM-DDT[00:00:00]' : 'YYYY-MM-[01]T[00:00:00]';
                        let t = moment(moment(m_start).format(f));

                        // Search for the first state in the time range
                        while( i < n && moment(result[id][i].last_changed) <= t ) {
                            y0 = this.process(result[id][i++].state, process) * 1.0;
                        }

                        // Calculate differentials over the time range in interval sized stacks, add a half interval at the end so that the last bar doesn't jump
                        // Add them to the graph with a half interval time offset, so that the stacks align at the center of their respective intervals
                        for( ; t <= m_end + td; ) {
                            let te = moment(t).add(td);
                            y1 = y0;
                            let d = 0;
                            while( i < n && this.momentCache(result[id][i].last_changed) < te ) {
                                const state = this.process(result[id][i].state, process) * 1.0;
                                if( !isNaN(state) ) {
                                    if( !netBars && state < y1 ) {
                                        d += y1 - y0;
                                        y0 = state;
                                    }
                                    y1 = state;
                                }
                                i++;
                            }
                            d += y1 - y0;
                            s.push({ x: t + td / 2.0, y: d * scale});
                            if( _colorFn )
                                bcol.push(_colorFn(t + td / 2.0, d) ?? g.entities[j].paletteColor);
                            t = te;
                            y0 = y1;
                        }

                    } else if( g.type == 'timeline' || g.type == 'arrowline' ) {

                        // Fill timeline chart buffer

                        const clusterMode = g.entities[j].decimation ?? this.pconfig.decimation ?? 'fast';
                        let enableClustering = clusterMode != false;

                        if( g.type == 'arrowline' || process ) enableClustering = false;

                        let merged = 0;
                        let mt0, mt1;
                        let state;

                        const m_max = ( m_now < m_end ) ? m_now : m_end;

                        for( let i = 0; i < n; i++ ) {

                            // Start and end timecode of current state block
                            let t0 = result[id][i].last_changed;
                            let t1 = ( i < n-1 ) ? result[id][i+1].last_changed : m_max;

                            // Not currently merging small blocks ?
                            if( !merged ) {

                                // State of the current block
                                state = this.processRaw(result[id][i].state, process);

                                // Skip noop state changes (can happen at cache slot boundaries)
                                while( i < n-1 && this.processRaw(result[id][i].state, process) == this.processRaw(result[id][i+1].state, process) ) {
                                    ++i;
                                    t1 = ( i < n-1 ) ? result[id][i+1].last_changed : m_max;
                                }

                            }

                            let moment_t0 = this.momentCache(t0);
                            let moment_t1 = ( t1 === m_max ) ? moment(t1) : this.momentCache(t1);

                            if( !enableClustering || moment_t1.diff(moment_t0) >= this.activeRange.dataClusterSize || i == n-1 ) {
                                // Larger than merge limit, finish a potential current merge before proceeding with new block
                                // Also stop merging when hitting the last state block regardless of size, otherwise it wont be committed
                                if( merged > 0 ) {
                                    t0 = mt0;
                                    t1 = mt1;
                                    moment_t0 = moment(t0);
                                    moment_t1 = moment(t1);
                                    i--;
                                }
                            } else {
                                // Below merge limit, start merge (keep the first state for possible single block merges) or extend current one
                                if( !merged ) { mt0 = t0; state = this.processRaw(result[id][i].state, process); }
                                mt1 = t1;
                                merged++;
                                continue;
                            }

                            // Add the current block to the graph
                            if( moment_t1 >= m_start ) {
                                if( moment_t1 > m_end ) t1 = this.endTime;
                                if( moment_t0 > m_end ) break;
                                if( moment_t0 < m_start ) t0 = this.startTime;
                                let e = [];
                                e.push(t0);
                                e.push(t1);
                                e.push(( merged > 1 ) ? 'multiple' : String(state));
                                s.push(e);
                            }

                            // Merging always stops when a block was added
                            merged = 0;

                        }

                    }

                }

                g.chart.data.datasets[j].data = s;

                if( bcol.length > 0 ) {
                    g.chart.data.datasets[j].backgroundColor = bcol;
                    g.chart.data.datasets[j].borderColor = bcol;
                }

                updated = true;

            }

            if( updated ) this._applyTimeAxis(g);

        }
    }
}
