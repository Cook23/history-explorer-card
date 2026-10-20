// From history data to what the graphs draw: one dataset per entity for the time window
// shown — line modes (smart, stepped...), bars by interval, circular values, timelines.
// Part of HistoryCardState (added to it in history-explorer-card.js).

import { parseColorValue, colorSpec, colorForValue, isColorSeries, isBlendable, blendedColorForValue } from "./history-default-colors.js";
import { seriesId, seriesOf, isDirectionAttribute, msOf } from "./history-series.js";
import { barInterval, RAW_INTERVAL } from "./history-options.js";
import { timeWeightedMean } from "./history-stats.js";
const Chart = window.HXLocal_Chart;
const moment = window.HXLocal_moment;

// Pixels under which a timeline's states following each other are merged ('multiple',
// _timelineRows)
const MERGE_PX = 2;

// The series an entity's `color` (in its one form, see normalizeColor) reads, or null: an
// entity_id — or one of its attributes, after it (climate.salon.hvac_action) — whose state
// then holds the color, in any form `color` itself accepts; or the `entity` (and
// `attribute`) of thresholds, whose value they then compare instead of the value shown
export function colorEntityOf(e)
{
    const c = e?.color;
    const id = typeof c === 'string' ? c : ( c && typeof c === 'object' && typeof c.entity === 'string' ) ? seriesId(c.entity, c.attribute) : '';
    return isColorSeries(id) ? id : null;
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
        const _spec = typeof e.color === 'object' ? e.color : null;
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
    entityColor(e)
    {
        const _ce = colorEntityOf(e);
        const _state = id => this.stateOf(id)?.state;
        if( _ce && typeof e.color === 'object' ) return colorForValue(e.color, _state(_ce)) ?? e.paletteColor;
        const _spec = _ce ? parseColorValue(_state(_ce)) : colorSpec(e.color);
        const _of = !_ce && this.resolveOption(e, 'colorTransition') === 'smooth' ? blendedColorForValue : colorForValue;
        return _of(_spec, Number(_state(e.entity))) ?? e.paletteColor;
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
    // — or, thresholds blended (colorTransition: smooth, see isBlendable), the stops of the
    // dataset's gradient over its Y axis (hecValueGradient: Chart.js draws it) and each
    // point's own color
    _applyPointColors(ds, e, s, colorFn, scale, fill)
    {
        const _spec = typeof e.color === 'object' ? e.color : null;
        ds.hecValueGradient = undefined;
        if( this.resolveOption(e, 'colorTransition') === 'smooth' && !colorEntityOf(e) && isBlendable(_spec) ) {
            const _f = scale || 1;
            ds.colorSteps = undefined;
            ds.hecValueGradient = _spec.thresholds.map(([k, c]) => ({ value: k * _f, color: c, fill: this._fillLike(c, fill) }));
            ds.pointBackgroundColor = s.map(pt => blendedColorForValue(_spec, pt.y / _f) ?? e.paletteColor);
            const _now = Date.now(), _last = [...s].reverse().find(pt => moment(pt.x).valueOf() <= _now) ?? s[0];
            const _current = _last ? blendedColorForValue(_spec, _last.y / _f) : undefined;
            if( _current ) {
                ds.borderColor = _current;
                ds.backgroundColor = this._fillLike(_current, fill) ?? ds.backgroundColor;
            }
            return;
        }
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

        const tOf = p => msOf(p.x);
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

    // The graphs' datasets from the history (result: each entity's, in the graphs' order)
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

                    // Per entity: a bar graph can hold curves too (see entityKind)
                    const _kind = this.entityKind(g, e);
                    // (its states as the values drawn — a timeline's and an arrowline's own,
                    // without a state_map: see processOf)
                    const process = ( _kind == 'line' || _kind == 'bar' ) ? this.processOf(e) : this.buildProcessFunction(e.process);

                    // Circular values (angles): a continuous curve, see _unwrapCircular
                    const _circP = ( _kind == 'line' || _kind == 'bar' ) ? this.circularPeriodOf(e) : null;
                    let _circBand = false;
                    if( _circP ) ({ data: result[id], band: _circBand } = this._unwrapCircular(result[id], _circP));

                    if( _kind == 'line' ) this.keepValueSamples(g, j, result[id], process);

                    if( _kind == 'line' ) {
                        const scale = this.drawScaleOf(e) * (e.siConversionFactor ?? 1.0);
                        s = this._lineSamples(e, result[id], process, scale, w, g.chart.hecPlotWidth());
                        if( _circBand ) this._markCircularJumps(s, _circP * Math.abs(scale));
                        const _colorFn = this._colorFunction(e, colorHistory);
                        if( _colorFn ) this._applyPointColors(_dataset, e, s, _colorFn, scale, e.fill);
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

            if( updated ) { this.applyTimeAxis(g); this.showValues(g); }

        }
    }

    // Whether entity e's band (showMinMax) is drawn for a point of a column with count
    // values — stat: statistics in it: true, everywhere; 'statistics', on the statistics
    // only; 'history' ('states'), on the history only; nowhere else (a single value of the
    // history has no band: what's shown is what was recorded)
    _bandWanted(e, stat, count)
    {
        const m = e.showMinMax;
        if( !m ) return false;
        if( !stat && count < 2 ) return false;
        return m === true || ( m === 'statistics' ? stat : ( m === 'history' || m === 'states' ) ? !stat : false );
    }

    // A curve's points: its values — or, in each column of pixels of the plot area
    // (columns) holding more than one (or an hour of statistics, its rows marked statistics),
    // one point: their mean (weighted by how long each lasted) at the middle of the time
    // they cover, with their min and max (columnMin, columnMax), that time (columnFrom, columnTo) and
    // whether statistics are in it (statistics: their period, statisticsPeriod) — what the screen can show of them, the
    // columns on a grid of time fixed from 1970 (the same from one refresh, or one part of
    // a long window, to the next); the band between their min and max (yMin, yMax) where
    // showMinMax wants it (_bandWanted) —, its last value carried to the end of the window
    // (or now), its silences as plateaus in smart mode
    _lineSamples(e, data, process, scale, w, columns)
    {
        const n = data.length;
        let s = [];
        const _width = columns > 0 ? ( w.end.valueOf() - w.start.valueOf() ) / columns : 0;
        const _until = ( w.now > w.end ? w.end : w.now ).valueOf();
        const _num = v => { const x = this.process(v, process); return w.isValid(x) ? x * scale : NaN; };

        // (each valid value: its time, the time it lasts until, its value — statistics: its
        // mean, min and max)
        const _values = [];
        for( let i = 0; i < n; i++ ) {
            const y = _num(data[i].state);
            if( isNaN(y) ) continue;
            const st = data[i].statistics;
            const v = { t: msOf(data[i].last_changed), y, min: y, max: y, stat: !!st };
            if( st ) { v.min = Math.min(_num(st.min), y); v.max = Math.max(_num(st.max), y); v.end = msOf(st.end); v.period = v.end - v.t; }
            _values.push(v);
        }
        // (fixedValue — mini-graph-card's fixed_value: its last value, flat over the whole
        // window)
        if( this.resolveOption(e, 'fixedValue') === true && _values.length ) {
            const _l = _values[_values.length - 1];
            _values.splice(0, _values.length, { t: w.start.valueOf(), y: _l.y, min: _l.y, max: _l.y, stat: false });
        }
        _values.forEach((v, k) => { v.end ??= k + 1 < _values.length ? _values[k + 1].t : Math.max(_until, v.t); });

        // (the groups the values are put in: each column of pixels — or, aggregated
        // (_groupsOf), the groups asked, never narrower than a column)
        const _agg = this.resolveAggregation(e);
        const _groups = this._groupsOf(_agg, _width);
        // (as Home Assistant compiles its statistics: the value of the history in force when a
        // group starts counts in it — from its start, in its mean, its min, its max —, a group
        // with no value of its own has that one; see _carried)
        const _carried = (prev, gs) => prev && !prev.stat && prev.end > gs ? { t: gs, y: prev.y, min: prev.y, max: prev.y, end: prev.end, stat: false, carried: true } : null;
        const _flush = (group, gs, ge) => {
            // (a single value of its own drawn as recorded, unless aggregated)
            const _own = group.filter(v => !v.carried);
            if( !_agg.explicit && _own.length === 1 && !_own[0].stat ) { s.push({ x: _own[0].t, y: _own[0].y }); return; }
            // (a value of the history counts until the group's end at most; an hour of
            // statistics, whole — it belongs to the group where it starts)
            const _end = v => v.stat || !_width ? v.end : Math.min(v.end, ge);
            let min = Infinity, max = -Infinity, stat = false, period = 0;
            for( const v of group ) {
                min = Math.min(min, v.min); max = Math.max(max, v.max); stat ||= v.stat;
                if( v.period ) period = Math.max(period, v.period);
            }
            const _from = _agg.explicit ? gs : group[0].t;
            const _to = _agg.explicit ? Math.min(ge, Math.max(_until, gs)) : Math.max(_from, _end(group[group.length - 1]));
            const p = { x: ( _from + _to ) / 2, y: this._aggregate(_agg.func, group, _end, min, max), columnMin: min, columnMax: max, columnFrom: _from, columnTo: _to, statistics: stat };
            // (the statistics' period: 5 minutes, an hour — the coarsest in the column)
            if( period ) p.statisticsPeriod = period;
            if( this._bandWanted(e, stat, _agg.explicit ? 2 : group.length) ) { p.yMin = min; p.yMax = max; }
            s.push(p);
        };
        // (aggregated, a group without values of its own: the value in force (_carried) — or,
        // after statistics, the point before; none for a difference: delta, diff —, as
        // mini-graph-card does)
        const _empty = (prev, gs, ge) => {
            const _c = _carried(prev, gs);
            if( _c ) return _flush([_c], gs, ge);
            const _y = _agg.func === 'delta' || _agg.func === 'diff' ? 0 : s[s.length - 1]?.y;
            if( _y !== undefined ) s.push({ x: ( gs + Math.min(ge, Math.max(_until, gs)) ) / 2, y: _y });
        };
        let group = [], gs = null, prev = null;
        for( const v of _values ) {
            const _gs = _groups.start(v.t);
            if( _gs !== gs ) {
                if( group.length ) {
                    _flush(group, gs, _groups.next(gs));
                    if( _agg.explicit ) for( let g = _groups.next(gs); g < _gs; g = _groups.next(g) ) _empty(prev, g, _groups.next(g));
                }
                group = [];
                gs = _gs;
                const _c = v.t > gs ? _carried(prev, gs) : null;
                if( _c ) group.push(_c);
            }
            group.push(v);
            prev = v;
        }
        if( group.length ) {
            _flush(group, gs, _groups.next(gs));
            if( _agg.explicit ) for( let g = _groups.next(gs); g < _until; g = _groups.next(g) ) _empty(prev, g, _groups.next(g));
        }

        // The last value carried to the end of the window, or to now when the window
        // reaches it (aggregated: its groups go there)
        let _extended = false;
        if( !_agg.explicit && s.length > 0 && s[s.length-1].x < _until && _values.length ) {
            s.push({ x: _until, y: _values[_values.length - 1].y });
            _extended = true;
        }

        if( !_agg.explicit && (e.lineMode || this.pconfig.defaultLineMode) === 'smart' ) {
            // Silences are detected on every value recorded (not on the columns, nor on the
            // statistics: an hour of them is no silence)
            const _raw = _values.filter(v => !v.stat).map(v => ({ t: v.t, y: v.y }));
            s = this._applySilencePlateaus(s, _raw, _extended);
        }

        return s;
    }

    // The groups a curve's values are put in, each one point: { start(t) — the start of the
    // group of time t —, next(start) — the start of the one after }. A column of pixels each,
    // on a grid of time fixed from 1970 (the same from one refresh, or one part of a long
    // window, to the next) — or, aggregated (resolveAggregation): a day (date), an hour
    // (hour), 1 / pointsPerHour hours on the local day's grid (2 h: 0:00, 2:00…); never
    // narrower than a column, nothing is drawn under a pixel
    _groupsOf(agg, width)
    {
        const _columns = { start: t => width > 0 ? Math.floor(t / width) * width : t, next: t => width > 0 ? t + width : t + 1 };
        if( agg.groupBy === 'date' && width <= 86400e3 )
            return { start: t => moment(t).startOf('day').valueOf(), next: t => moment(t).add(1, 'day').valueOf() };
        const _w = agg.groupBy === 'hour' ? 3600e3 : agg.pointsPerHour > 0 ? 3600e3 / agg.pointsPerHour : 0;
        if( !_w || _w < width ) return _columns;
        const _local = t => moment(t).utcOffset() * 60e3;
        return { start: t => Math.floor(( t + _local(t) ) / _w) * _w - _local(t), next: t => t + _w };
    }

    // A group's value (func — aggregateFunc; none: avg): avg its mean, each value weighted by
    // how long it lasted (end: until when, within the group); min, max its lowest, highest
    // (the statistics' own); median the middle of its values; first, last; sum their sum;
    // delta its highest less its lowest; diff its last less its first. An hour of statistics
    // counts as one value, its mean
    _aggregate(func, group, end, min, max)
    {
        const _ys = group.map(v => v.y);
        switch( func ) {
            case 'min': return min;
            case 'max': return max;
            case 'first': return _ys[0];
            case 'last': return _ys[_ys.length - 1];
            case 'sum': return _ys.reduce((a, b) => a + b, 0);
            case 'delta': return max - min;
            case 'diff': return _ys[_ys.length - 1] - _ys[0];
            case 'median': {
                const _s = [..._ys].sort((a, b) => a - b), _m = _s.length >> 1;
                return _s.length % 2 ? _s[_m] : ( _s[_m - 1] + _s[_m] ) / 2;
            }
        }
        return timeWeightedMean(group, v => v.y, v => v.t, end);
    }

    // A bar entity's bars: what it added over each interval of the graph (10 minutes, an
    // hour, a day, a week — from Monday — a month: BAR_INTERVALS) — a counter reset starting again from its new value, unless
    // netBars — each bar at the middle of its interval; its colors when they vary (colorFn).
    // With aggregateFunc, each bar its function over the interval's values (_aggregate:
    // max, a daily counter's total) — an interval without values carrying the bar before (a
    // difference, 0)
    _barSamples(g, e, data, process, w, colorFn)
    {
        const _func = this.resolveAggregation(e).func;
        if( _func ) return this._aggregatedBars(g, e, data, process, w, colorFn, _func);
        const n = data.length;
        const s = [], bcol = [];
        const scale = this.drawScaleOf(e) * (e.siConversionFactor ?? 1.0);
        const netBars = e.netBars ?? false;

        const _interval = barInterval(g.interval)?.length ? barInterval(g.interval) : barInterval(1);
        const td = moment.duration(..._interval.length);

        let i = 0;
        let y0 = this.process(data[0].state, process) * 1.0;
        let y1 = y0;

        // Start time of the range, snapped to interval boundary
        let t = moment(w.start).startOf(_interval.start);

        // Search for the first state in the time range
        while( i < n && msOf(data[i].last_changed) <= t.valueOf() ) {
            y0 = this.process(data[i++].state, process) * 1.0;
        }

        // Calculate differentials over the time range in interval sized stacks, add a half interval at the end so that the last bar doesn't jump
        // Add them to the graph with a half interval time offset, so that the stacks align at the center of their respective intervals
        for( ; t <= w.end + td; ) {
            let te = moment(t).add(td);
            const _te = te.valueOf();
            y1 = y0;
            let d = 0;
            while( i < n && msOf(data[i].last_changed) < _te ) {
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

    // A bar entity's bars by aggregateFunc (see _barSamples)
    _aggregatedBars(g, e, data, process, w, colorFn, func)
    {
        const s = [], bcol = [];
        const scale = this.drawScaleOf(e) * (e.siConversionFactor ?? 1.0);
        const _interval = barInterval(g.interval)?.length ? barInterval(g.interval) : barInterval(1);
        const td = moment.duration(..._interval.length);
        const _values = [];
        for( let i = 0; i < data.length; i++ ) {
            const y = this.process(data[i].state, process) * 1.0;
            if( isNaN(y) ) continue;
            const st = data[i].statistics;
            _values.push({ t: msOf(data[i].last_changed), y, min: st ? Math.min(st.min * 1.0, y) : y, max: st ? Math.max(st.max * 1.0, y) : y });
        }
        _values.forEach((v, k) => { v.end = k + 1 < _values.length ? _values[k + 1].t : Math.max(w.now.valueOf(), v.t); });
        let k = 0, last;
        for( let t = moment(w.start).startOf(_interval.start); t <= w.end + td; ) {
            const te = moment(t).add(td), _t0 = t.valueOf(), _te = te.valueOf();
            while( k < _values.length && _values[k].t < _t0 ) k++;
            const group = [];
            // (the value in force when the interval starts counts in it, as Home Assistant
            // compiles its statistics — see _lineSamples)
            const _prev = k > 0 ? _values[k - 1] : null;
            if( _prev && _prev.end > _t0 && !( k < _values.length && _values[k].t === _t0 ) )
                group.push({ t: _t0, y: _prev.y, min: _prev.y, max: _prev.y, end: _prev.end });
            for( let j = k; j < _values.length && _values[j].t < _te; j++ ) group.push(_values[j]);
            let y;
            if( group.length ) {
                y = this._aggregate(func, group, v => Math.min(v.end, _te), Math.min(...group.map(v => v.min)), Math.max(...group.map(v => v.max)));
                last = y;
            } else
                y = func === 'delta' || func === 'diff' ? 0 : last;
            if( y !== undefined ) {
                s.push({ x: t + td / 2.0, y: y * scale });
                if( colorFn ) bcol.push(colorFn(t + td / 2.0, y) ?? e.paletteColor);
            }
            t = te;
        }
        return { s, bcol };
    }

    // A timeline's or arrowline's rows: [start, end, state] blocks within the window — on a
    // timeline, states following each other that are each narrower than MERGE_PX pixels
    // merged into one block ('multiple'): too thin to tell apart or to point at, unlike a
    // wider one, always drawn; a short state alone keeps its own. Never on an arrowline,
    // nor with a process function (its states aren't shown as such)
    _timelineRows(g, e, data, process, w)
    {
        const n = data.length;
        const s = [];
        const _start = w.start.valueOf(), _end = w.end.valueOf();
        const _merge = g.type == 'arrowline' || process ? 0 : MERGE_PX * ( _end - _start ) / Math.max(1, g.chart.hecPlotWidth());

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

            if( msOf(t1) - msOf(t0) >= _merge || i == n-1 ) {
                // Wide enough, finish a potential current merge before proceeding with new block
                // Also stop merging when hitting the last state block regardless of size, otherwise it wont be committed
                if( merged > 0 ) {
                    t0 = mt0;
                    t1 = mt1;
                    i--;
                }
            } else {
                // Too narrow, start merge (keep the first state for possible single block merges) or extend current one
                if( !merged ) { mt0 = t0; state = this.processRaw(data[i].state, process); }
                mt1 = t1;
                merged++;
                continue;
            }

            // Add the current block to the graph
            if( msOf(t1) >= _start ) {
                if( msOf(t1) > _end ) t1 = this.endTime;
                if( msOf(t0) > _end ) break;
                if( msOf(t0) < _start ) t0 = this.startTime;
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
    entityKind(g, e)
    {
        if( g.type !== 'line' && g.type !== 'bar' ) return g.type;
        return ( g.type === 'bar' && e?.type === 'bar' && g.interval != RAW_INTERVAL ) ? 'bar' : 'line';
    }

    // Period of a circular entity (an angle: 0 and 360 are the same direction), or null —
    // `circular` in its one form (see normalizeOptions): false never; a period; absent
    // auto-detects (state_class measurement_angle, or a unit of exactly '°' — not °C/°F —
    // gives 360; for an attribute, the unit ° only when its name says it's a direction: see
    // isDirectionAttribute)
    circularPeriodOf(e)
    {
        const c = e?.circular;
        if( c === false ) return null;
        if( typeof c === 'number' ) return c;
        if( this.getStateClass(e.entity) === 'measurement_angle' ) return 360;
        if( this.getUnitOfMeasure(e.entity, e.unit) !== '°' ) return null;
        const { attribute } = seriesOf(e.entity);
        return ( !attribute || isDirectionAttribute(attribute) ) ? 360 : null;
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
    wrapCircular(v, Q)
    {
        return ( ( v % Q ) + Q ) % Q;
    }
}
