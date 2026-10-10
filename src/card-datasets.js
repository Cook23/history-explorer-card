// From history data to what the graphs draw: one dataset per entity for the time window
// shown — line modes (smart, stepped...), bars by interval, circular values, timelines.
// Part of HistoryCardState (added to it in history-explorer-card.js).

import { parseColor, parseColorValue, colorForValue } from "./history-default-colors.js";
import { seriesId, seriesOf, isDirectionAttribute } from "./history-series.js";
const Chart = window.HXLocal_Chart;
const moment = window.HXLocal_moment;

// The series an entity's `color` reads, or null: an entity_id (no CSS color has a dot) —
// or one of its attributes, after it (climate.salon.hvac_action) — whose state then holds
// the color, in any form `color` itself accepts; or the `entity` (and `attribute`) of
// thresholds, whose value they then compare instead of the value shown
const _SERIES_ID = /^[a-z_]+\.[a-z0-9_]+(\.[A-Za-z0-9_]+)?$/;
export function colorEntityOf(e)
{
    const c = e?.color;
    const id = ( typeof c === 'string' ? c : ( c && typeof c === 'object' && typeof c.entity === 'string' ) ? seriesId(c.entity, c.attribute) : '' ).trim();
    return _SERIES_ID.test(id) ? id : null;
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
        const _state = id => this.stateOf(id)?.state;
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
        // The time window drawn: now, its start and end, and which states are drawn
        const w = {
            now: moment(), start: moment(this.startTime), end: moment(this.endTime),
            isValid: state => this.pconfig.showUnavailable || !['unavailable', 'unknown'].includes(state)
        };

        let id = 0;

        for( let g of this.graphs ) {

            let updated = false;

            for( let j = 0; j < g.entities.length; j++, id++ ) {

                if( this.state.updateCanvas && this.state.updateCanvas !== g.canvas ) continue;

                const e = g.entities[j];
                const _dataset = g.chart.data.datasets[j];
                let s = [];
                let bcol = [];

                if( result && result.length > id ) {

                    const process = this.buildProcessFunction(e.process);

                    // Per entity: a bar graph can hold curves too (see _entityKind)
                    const _kind = this._entityKind(g, e);

                    // Circular values (angles): a continuous curve, see _unwrapCircular
                    const _circP = ( _kind == 'line' || _kind == 'bar' ) ? this._circularPeriod(e) : null;
                    let _circBand = false;
                    if( _circP ) ({ data: result[id], band: _circBand } = this._unwrapCircular(result[id], _circP));

                    if( _kind == 'line' ) this._keepValueSamples(g, j, result[id], process);

                    if( _kind == 'line' ) {
                        const scale = (e.scale ?? 1.0) * (e.siConversionFactor ?? 1.0);
                        s = this._lineSamples(e, result[id], process, scale, w);
                        if( _circBand ) this._markCircularJumps(s, _circP * Math.abs(scale));
                        const _colorFn = this._colorFunction(e, colorHistory);
                        if( _colorFn ) this._applyPointColors(_dataset, e, s, _colorFn, scale, parseColor(e.fill));
                    } else if( _kind == 'bar' && result[id].length > 0 ) {
                        ({ s, bcol } = this._barSamples(g, e, result[id], process, w, this._colorFunction(e, colorHistory)));
                    } else if( g.type == 'timeline' || g.type == 'arrowline' ) {
                        s = this._timelineRows(g, e, result[id], process, w);
                    }

                }

                _dataset.data = s;

                if( bcol.length > 0 ) {
                    _dataset.backgroundColor = bcol;
                    _dataset.borderColor = bcol;
                }

                updated = true;

            }

            if( updated ) { this._applyTimeAxis(g); this._showValues(g); }

        }
    }

    // A point's min/max band (showMinMax): the sample's own (long-term statistics), else —
    // for 'history' / 'states' — the hour's from the min/max cache
    _withMinMax(pt, e, sample, scale, fromCache = true)
    {
        const showMM = e.showMinMax;
        if( !showMM ) return pt;
        if( sample.yMin != null ) {
            pt.yMin = sample.yMin * scale;
            pt.yMax = sample.yMax * scale;
        } else if( fromCache && (showMM === 'history' || showMM === 'states') && this.minmaxCache?.[e.entity] ) {
            const mm = this.minmaxCache[e.entity];
            const ts = moment(sample.last_changed).valueOf();
            const bucket = Math.floor(ts / 3600000) * 3600000;
            const slot = mm[bucket] ?? mm[bucket - 3600000];
            if( slot ) { pt.yMin = slot.yMin * scale; pt.yMax = slot.yMax * scale; }
        }
        return pt;
    }

    // A curve's points: its samples (decimated to the cluster size, 'fast' or 'accurate'),
    // its last value carried to the end of the window (or now), its silences as plateaus in
    // smart mode
    _lineSamples(e, data, process, scale, w)
    {
        const n = data.length;
        let s = [];
        const clusterMode = e.decimation ?? this.pconfig.decimation ?? 'fast';

        if( n > 2 && clusterMode && this.activeRange.dataClusterSize > 0 ) {

            let last_time = this.momentCache(data[0].last_changed);
            let max_state = null, max_time = null;
            let min_state = null, min_time = null;

            for( let i = 0; i < n; i++ ) {
                let state = this.process(data[i].state, process);
                if( w.isValid(state) ) {
                    state *= scale;
                    let this_time = this.momentCache(data[i].last_changed);
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
                const state = this.process(data[i].state, process);
                if( w.isValid(state) )
                    s.push(this._withMinMax({ x: data[i].last_changed, y: state * scale }, e, data[i], scale));
            }
        }

        // The last value carried to the end of the window, or to now when the window
        // reaches it
        let _extended = false;
        const _until = ( w.now > w.end ) ? w.end : w.now;
        if( s.length > 0 && moment(s[s.length-1].x) < _until ) {
            const state = this.process(data[n-1].state, process);
            if( w.isValid(state) ) {
                s.push(this._withMinMax({ x: _until, y: state * scale }, e, data[n-1], scale, false));
                _extended = true;
            }
        }

        if( (this.normalizeLineMode(e.lineMode) || this.pconfig.defaultLineMode) === 'smart' ) {
            // Silences are detected on every recorded value (before decimation)
            const _raw = [];
            for( let i = 0; i < n; i++ ) {
                const state = this.process(data[i].state, process);
                if( !w.isValid(state) ) continue;
                const y = state * scale;
                if( !isNaN(y) ) _raw.push({ t: moment(data[i].last_changed).valueOf(), y });
            }
            s = this._applySilencePlateaus(s, _raw, _extended);
        }

        return s;
    }

    // A bar entity's bars: what it added over each interval of the graph (10 minutes, an
    // hour, a day, a month) — a counter reset starting again from its new value, unless
    // netBars — each bar at the middle of its interval; its colors when they vary (colorFn)
    _barSamples(g, e, data, process, w, colorFn)
    {
        const n = data.length;
        const s = [], bcol = [];
        const scale = (e.scale ?? 1.0) * (e.siConversionFactor ?? 1.0);
        const netBars = e.netBars ?? false;

        let td;
        if( g.interval == 0 ) td = moment.duration(10, "minute"); else
        if( g.interval == 1 ) td = moment.duration(1, "hour"); else
        if( g.interval == 2 ) td = moment.duration(1, "day"); else
        if( g.interval == 3 ) td = moment.duration(1, "month");

        let i = 0;
        let y0 = this.process(data[0].state, process) * 1.0;
        let y1 = y0;

        // Start time of the range, snapped to interval boundary
        const f = ( g.interval <= 1 ) ? 'YYYY-MM-DDTHH[:00:00]' : ( g.interval <= 2 ) ? 'YYYY-MM-DDT[00:00:00]' : 'YYYY-MM-[01]T[00:00:00]';
        let t = moment(moment(w.start).format(f));

        // Search for the first state in the time range
        while( i < n && moment(data[i].last_changed) <= t ) {
            y0 = this.process(data[i++].state, process) * 1.0;
        }

        // Calculate differentials over the time range in interval sized stacks, add a half interval at the end so that the last bar doesn't jump
        // Add them to the graph with a half interval time offset, so that the stacks align at the center of their respective intervals
        for( ; t <= w.end + td; ) {
            let te = moment(t).add(td);
            y1 = y0;
            let d = 0;
            while( i < n && this.momentCache(data[i].last_changed) < te ) {
                const state = this.process(data[i].state, process) * 1.0;
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
            if( colorFn )
                bcol.push(colorFn(t + td / 2.0, d) ?? e.paletteColor);
            t = te;
            y0 = y1;
        }

        return { s, bcol };
    }

    // A timeline's or arrowline's rows: [start, end, state] blocks within the window, the
    // blocks shorter than the cluster size merged into one ('multiple') on a timeline
    _timelineRows(g, e, data, process, w)
    {
        const n = data.length;
        const s = [];
        const clusterMode = e.decimation ?? this.pconfig.decimation ?? 'fast';
        let enableClustering = clusterMode != false;

        if( g.type == 'arrowline' || process ) enableClustering = false;

        let merged = 0;
        let mt0, mt1;
        let state;

        const m_max = ( w.now < w.end ) ? w.now : w.end;

        for( let i = 0; i < n; i++ ) {

            // Start and end timecode of current state block
            let t0 = data[i].last_changed;
            let t1 = ( i < n-1 ) ? data[i+1].last_changed : m_max;

            // Not currently merging small blocks ?
            if( !merged ) {

                // State of the current block
                state = this.processRaw(data[i].state, process);

                // Skip noop state changes (can happen at cache slot boundaries)
                while( i < n-1 && this.processRaw(data[i].state, process) == this.processRaw(data[i+1].state, process) ) {
                    ++i;
                    t1 = ( i < n-1 ) ? data[i+1].last_changed : m_max;
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
                if( !merged ) { mt0 = t0; state = this.processRaw(data[i].state, process); }
                mt1 = t1;
                merged++;
                continue;
            }

            // Add the current block to the graph
            if( moment_t1 >= w.start ) {
                if( moment_t1 > w.end ) t1 = this.endTime;
                if( moment_t0 > w.end ) break;
                if( moment_t0 < w.start ) t0 = this.startTime;
                s.push([t0, t1, ( merged > 1 ) ? 'multiple' : String(state)]);
            }

            // Merging always stops when a block was added
            merged = 0;

        }

        return s;
    }

    // --------------------------------------------------------------------------------------
    // How an entity is drawn: as a curve, bars or rows; circular values
    // --------------------------------------------------------------------------------------

    // How one entity of graph g is drawn: its bars, unless the graph's interval is 'raw
    // line' (4) — which only ever turns its bar entities into raw curves. A graph holding
    // at least one bar entity is a 'bar' graph (interval selector), its line entities
    // being drawn as curves over the bars.
    _entityKind(g, e)
    {
        if( g.type !== 'line' && g.type !== 'bar' ) return g.type;
        return ( g.type === 'bar' && e?.type === 'bar' && g.interval != 4 ) ? 'bar' : 'line';
    }

    // Period of a circular entity (an angle: 0 and 360 are the same direction), or null.
    // `circular` (per entity, same values as lowpass_dt): absent / null / 'none' auto-detects
    // (state_class measurement_angle, or a unit of exactly '°' — not °C/°F — gives 360; for an
    // attribute, the unit ° only when its name says it's a direction: see isDirectionAttribute), false
    // never, a number or numeric string gives the period, '2pi' gives 2π. Anything else, or a
    // period <= 0, disables it with a warning.
    _circularPeriod(e)
    {
        const c = e?.circular;
        if( c === false ) return null;
        if( c === undefined || c === null || ( typeof c === 'string' && c.trim().toLowerCase() === 'none' ) ) {
            if( this.getStateClass(e.entity) === 'measurement_angle' ) return 360;
            if( this.getUnitOfMeasure(e.entity, e.unit) !== '°' ) return null;
            const { attribute } = seriesOf(e.entity);
            return ( !attribute || isDirectionAttribute(attribute) ) ? 360 : null;
        }
        let P = NaN;
        if( typeof c === 'number' ) P = c;
        else if( typeof c === 'string' ) {
            const t = c.replace(/\s+/g, '').toLowerCase();
            P = ( t === '2pi' ) ? 2 * Math.PI : ( t === '' ? NaN : Number(t) );
        }
        if( !isFinite(P) || P <= 0 ) {
            this._circularWarned = this._circularWarned ?? new Set();
            if( !this._circularWarned.has(e.entity) ) {
                this._circularWarned.add(e.entity);
                console.warn(`history-explorer-card: invalid 'circular' value ${JSON.stringify(c)} for ${e.entity} — expected false, none, a period > 0 or '2pi'. Circular display disabled.`);
            }
            return null;
        }
        return P;
    }

    // Circular values (period P) made into a continuous curve, on a copy of the samples (they
    // are shared with the cache). Each value is first brought into [0, P), then a step of more
    // than P/2 from the previous valid value is taken as a crossing of 0 (3, 1, 359 → 3, 1, -1).
    // The whole curve is then moved by a multiple of P to sit around its circular mean c in
    // [0, P). Should it span more than a turn (it went round several times), every value is put
    // in the one-turn band [c - P/2, c + P/2) instead: band is then true, and its jumps get
    // dashed (_markCircularJumps).
    _unwrapCircular(data, P)
    {
        const mod = v => ( ( v % P ) + P ) % P;
        const idx = [], raw = [], un = [];
        let prev = null, offset = 0, sumS = 0, sumC = 0;
        for( let i = 0; i < data.length; i++ ) {
            const st = data[i].state;
            if( st === null || st === undefined || st === '' ) continue;
            const v = Number(st);
            if( !isFinite(v) ) continue;
            const r = mod(v);
            if( prev !== null ) {
                if( r - prev > P / 2 ) offset -= P; else
                if( r - prev < -P / 2 ) offset += P;
            }
            prev = r;
            idx.push(i); raw.push(r); un.push(r + offset);
            sumS += Math.sin(r / P * 2 * Math.PI);
            sumC += Math.cos(r / P * 2 * Math.PI);
        }
        if( !idx.length ) return { data, band: false };

        const c = ( Math.abs(sumS) + Math.abs(sumC) > 1e-9 ) ? mod(Math.atan2(sumS, sumC) / ( 2 * Math.PI ) * P) : raw[0];
        const mean = un.reduce((a, v) => a + v, 0) / un.length;
        const k = Math.round(( c - mean ) / P) * P;
        let lo = Infinity, hi = -Infinity;
        for( let m = 0; m < un.length; m++ ) { un[m] += k; lo = Math.min(lo, un[m]); hi = Math.max(hi, un[m]); }
        const band = ( hi - lo > P );
        if( band ) for( let m = 0; m < un.length; m++ ) un[m] = ( c - P / 2 ) + mod(raw[m] - ( c - P / 2 ));

        const out = data.slice();
        for( let m = 0; m < idx.length; m++ ) {
            const p = data[idx[m]];
            const q = { ...p, state: un[m] };
            // (a min/max carried by the sample moves with it)
            const shift = un[m] - Number(p.state);
            if( p.yMin != null ) q.yMin = p.yMin + shift;
            if( p.yMax != null ) q.yMax = p.yMax + shift;
            out[idx[m]] = q;
        }
        return { data: out, band };
    }

    // A circular curve put in a one-turn band jumps where it crosses the band's edge: the
    // segment is drawn as a straight dashed line, like the plateaus of the smart line mode.
    // Q: the period in chart units.
    _markCircularJumps(s, Q)
    {
        for( let k = 1; k < s.length; k++ )
            if( Math.abs(s[k].y - s[k-1].y) > Q / 2 ) s[k].hecPlateauEnd = true;
    }

    // A value of a circular curve as shown (tooltip, Y axis labels): back into [0, Q)
    _wrapCircular(v, Q)
    {
        return ( ( v % Q ) + Q ) % Q;
    }
}
