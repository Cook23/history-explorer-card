// From history data to what the graphs draw: one dataset per entity for the time window
// shown — line modes (smart, stepped...), bars by interval, circular values, timelines.
// Part of HistoryCardState (added to it in history-explorer-card.js).

import { parseColorValue, parseFillValue, fillValue, NO_FILL, colorForValue, isColorSeries, isBlendable, blendedColorForValue } from "./history-default-colors.js";
import { seriesId, seriesOf, isDirectionAttribute, msOf } from "./history-series.js";
import { barInterval, RAW_INTERVAL, STATE_NOT_LISTED, minMaxBand, INDIRECT_OPTIONS } from "./history-options.js";
import { timeWeightedMean, circularMean } from "./history-stats.js";
import { perf } from "./card-perf.js";
import { minOf, maxOf, insertAll } from "./history-arrays.js";
import { isMissingState } from "./history-units.js";
import { chooseYAxis, rangeIndex } from "./card-yscale.js";
import { keyOf } from "./history-entity-store.js";

// The steadiness of the scale of an arrowline's arrows' length (see arrowLengthMax): as the
// automatic Y axis' yScaleSteadiness, its default — fixed
const ARROW_SCALE_STEADY = 0.5;
// The room between two arrows of an arrowline, in px — each arrow the mean of that zone
// (Chart.js, deps/timeline.js: the dataset's arrowSpacing; the length's scale, arrowLengthMax)
const ARROW_SPACING_PX = 30;

// (the functions of a group other than its mean — see _aggregate)
const AGGREGATES_NOT_MEAN = new Set(['min', 'max', 'first', 'last', 'sum', 'delta', 'diff', 'median']);
const Chart = window.HXLocal_Chart;
const moment = window.HXLocal_moment;

// Pixels under which a timeline's states following each other are merged ('multiple',
// _timelineRows)
const MERGE_PX = 2;

// The series option k of entity e reads (k: one of INDIRECT_OPTIONS, in its one form), or
// null: an entity_id — or one of its attributes, after it (climate.salon.hvac_action) — whose
// state then holds the value; or the `entity` (and `attribute`) of thresholds, whose value
// they then compare instead of the value shown
export function optionSeriesOf(e, k)
{
    const c = e?.[k];
    const id = typeof c === 'string' ? c : ( c && typeof c === 'object' && typeof c.entity === 'string' ) ? seriesId(c.entity, c.attribute) : '';
    return isColorSeries(id) ? id : null;
}

// The series entity e's options read (optionSeriesOf), each once
export function optionSeriesIdsOf(e)
{
    return [...new Set(INDIRECT_OPTIONS.map(k => optionSeriesOf(e, k)).filter(Boolean))];
}

// The parsers of a value an entity's state holds, by option (see _optionFunction): a color's,
// a fill's; an arrows' length's, a number
const _STATE_VALUE = {
    color: parseColorValue,
    fill: parseFillValue,
    arrowLength: v => { const n = Number(v); return v !== '' && v !== null && Number.isFinite(n) ? { color: n } : null; },
};

export class CardDatasets
{
    // --------------------------------------------------------------------------------------
    // Colors: `color` is a value (a color, or thresholds on the value shown), an entity
    // whose state holds one, or thresholds on the value of an entity — then it varies along
    // the curve, with that entity's history. Evaluated at each point (each bar): a curve
    // changes color on a point, never between two.
    // --------------------------------------------------------------------------------------

    // Option k of entity e (INDIRECT_OPTIONS) at time t (ms) for the value v, or undefined
    // when none applies: (t, v) => its value — thresholds compare v, or the series' value they
    // name; a series' state holds it. null when e's option is a value itself — nothing to
    // evaluate. history: the history of the series read, by id (see optionSeriesIds)
    _optionFunction(e, k, history)
    {
        const _ce = optionSeriesOf(e, k);
        const _spec = typeof e[k] === 'object' && e[k] !== null ? e[k] : null;
        if( !_ce ) return _spec && !( 'color' in _spec ) ? (t, v) => colorForValue(_spec, v) : null;
        // (the series' states over time, each read once — the calls come in increasing time:
        // thresholds compare them; else each holds a value)
        const _states = ( history?.[_ce] ?? [] ).map(p => ({ t: msOf(p.last_changed), state: p.state,
            spec: _spec ? null : _STATE_VALUE[k](p.state) }));
        let i = -1;
        return (t, v) => {
            if( i >= 0 && _states[i].t > t ) i = -1;
            while( i + 1 < _states.length && _states[i + 1].t <= t ) i++;
            if( i < 0 ) return undefined;
            return _spec ? colorForValue(_spec, _states[i].state) : colorForValue(_states[i].spec, v);
        };
    }

    // The color of entity e at time t for the value v (see _optionFunction)
    _colorFunction(e, history)
    {
        return this._optionFunction(e, 'color', history);
    }

    // Option k of entity e now (INDIRECT_OPTIONS), for its current value: thresholds on it, or
    // on the series' value now; the value the series holds now; else the option's value
    // itself — undefined when none applies. blend: thresholds blended (colorTransition: smooth)
    optionNow(e, k, blend)
    {
        const _ce = optionSeriesOf(e, k);
        const _state = id => this.stateOf(id)?.state;
        if( _ce && typeof e[k] === 'object' ) return colorForValue(e[k], _state(_ce));
        const _spec = _ce ? _STATE_VALUE[k](_state(_ce)) : typeof e[k] === 'object' && e[k] !== null ? e[k] : e[k] === undefined ? null : { color: e[k] };
        return ( blend ? blendedColorForValue : colorForValue )(_spec, Number(_state(e.entity)));
    }

    // The color of entity e now, for its current value — the legend's, and the curve's until
    // its history is drawn; the palette's (e.paletteColor) when no valid color applies
    entityColor(e)
    {
        const _blend = !optionSeriesOf(e, 'color') && this.resolveOption(e, 'colorTransition') === 'smooth';
        const c = this.optionNow(e, 'color', _blend);
        return typeof c === 'string' ? c : e.paletteColor;
    }

    // The fill of entity e as a style, f its fill's value (see fillLeaf) and c its color there
    // — true, its color light; false, none; fade, { fade: c } (its color fading out downwards);
    // a color: that one — in color c when its color varies (varies: its transparency, see
    // _fillLike) —; undefined when none applies
    fillStyle(f, c, varies)
    {
        if( f === undefined || f === false ) return undefined;
        if( f === 'fade' ) return { fade: c };
        if( f === 'solid' ) return c;
        const _f = fillValue(f, c);
        return varies ? this._fillLike(c, _f) : _f;
    }

    // A fill style (see fillStyle) as one color: a fill fading out, its color light (as the
    // top of its gradient); none, transparent
    fillAsColor(f)
    {
        return typeof f === 'object' ? fillValue(true, f.fade) : f ?? NO_FILL;
    }

    // The fill of entity e now, as a style (see fillStyle): what its legend shows, an
    // arrowline's background
    entityFill(e)
    {
        const f = optionSeriesOf(e, 'fill') || typeof e.fill === 'object' ? this.optionNow(e, 'fill') : e.fill;
        return this.fillStyle(f, this.entityColor(e), false);
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

    // The colors of a curve's points (see _optionFunction — colorFn its color's, fillFn its
    // fill's, one of them at least): the dataset's colorSteps (one where its color or its fill
    // changes), and its own colors made those of the point now (the last one at or before now)
    // — the legend's
    // — or, its color's thresholds blended (colorTransition: smooth, see isBlendable), the
    // stops of the dataset's gradient over its Y axis (hecValueGradient: Chart.js draws it) and
    // each point's own color, its fill's steps along the time when it varies
    _applyPointColors(ds, e, s, colorFn, fillFn, scale)
    {
        const _spec = typeof e.color === 'object' ? e.color : null;
        const _f = scale || 1;
        const _blend = this.resolveOption(e, 'colorTransition') === 'smooth' && !optionSeriesOf(e, 'color') && isBlendable(_spec);
        const _fixed = this.entityColor(e);
        // (a point's color, its fill — the curve's own fill when it doesn't vary: in its color,
        // see _fillLike —, a fill applying nothing: none)
        const _colorAt = (t, v) => _blend ? blendedColorForValue(_spec, v) ?? e.paletteColor : colorFn ? colorFn(t, v) ?? e.paletteColor : _fixed;
        const _fillAt = (c, t, v) => fillFn ? this.fillStyle(fillFn(t, v), c, !!colorFn || _blend) ?? NO_FILL : this._fillLike(c, e.fill);
        ds.hecValueGradient = undefined;
        if( _blend ) {
            ds.hecValueGradient = _spec.thresholds.map(([k, c]) => ({ value: k * _f, color: c, fill: fillFn ? undefined : this._fillLike(c, e.fill) }));
            ds.pointBackgroundColor = s.map(pt => _colorAt(msOf(pt.x), pt.y / _f));
        }
        const _steps = [];
        const _now = Date.now();
        let _prev, _current;
        for( const pt of s ) {
            const t = msOf(pt.x), v = pt.y / _f;
            const c = _colorAt(t, v), fill = _fillAt(c, t, v);
            const _key = c + '|' + ( typeof fill === 'object' ? 'fade:' + fill.fade : fill );
            if( _key !== _prev ) _steps.push({ x: t, borderColor: _blend ? undefined : c, backgroundColor: fill });
            _prev = _key;
            if( t <= _now || _current === undefined ) _current = { c, fill };
        }
        // (thresholds blended: the steps only for a fill that varies)
        ds.colorSteps = _steps.length > 1 && ( !_blend || fillFn ) ? _steps : undefined;
        if( _current ) {
            ds.borderColor = _current.c;
            if( !_blend ) ds.pointBackgroundColor = _current.c;
            const _cf = typeof _current.fill === 'object' ? fillValue(true, _current.c) : _current.fill;
            ds.backgroundColor = _cf ?? ds.backgroundColor;
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
        // (an interval with statistics in it — raw[i].afterStats — is no interval of the source:
        // neither a silence nor counted in its usual interval)
        for( let i = 1; i < raw.length; i++ ) {
            const dt = raw[i].t - raw[i - 1].t;
            if( dt > 0 && !raw[i].afterStats ) _dts.push(dt);
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

        const tOf = p => msOf(p.x);
        // (the values known may go past what's drawn — a window in the past —: the ongoing
        // silence judged at the last value at or before the end drawn, by the limit then)
        const _endT = tOf(s[s.length - 1]);
        let _limitEnd = _limit(), _lastIn = raw[0].t <= _endT ? raw[0] : null;
        const gaps = [];
        for( let i = 1; i < raw.length; i++ ) {
            const dt = raw[i].t - raw[i - 1].t;
            if( dt <= 0 || raw[i].afterStats ) continue;
            const limit = _limit();
            let dtStat = dt;
            if( dt > limit ) {
                gaps.push({ ta: raw[i - 1].t, y: raw[i - 1].y, tb: raw[i].t, lead: mean });
                dtStat = limit;
            }
            mean = 0.9 * mean + 0.1 * dtStat;
            m2   = 0.9 * m2   + 0.1 * dtStat * dtStat;
            if( raw[i].t <= _endT ) { _limitEnd = _limit(); _lastIn = raw[i]; }
        }

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
            // (the point drawn before the value ending the silence already past the plateau's
            // end: the column of pixels holding that value — its point drawn at the middle of
            // the time its values cover, the silence's last part included. The plateau ends
            // where that column begins; a silence within a column — it begins before the
            // silence does —: nothing to show, a point put there would go back in time)
            let _at = k, _end = gap.tb - gap.lead;
            if( tOf(out[k - 1]) >= _end ) {
                const _from = out[k - 1].columnFrom;
                if( _from == null || _from <= gap.ta ) continue;
                _at = k - 1; _end = _from;
            }
            _at = ensureStart(_at, gap.ta, gap.y);
            // (flat: the value of the point before it — the value held, ensureStart; or, the
            // silence beginning within a column of pixels, the value drawn for that column)
            out.splice(_at, 0, { x: _end, y: out[_at - 1].y, hecPlateauEnd: true, hecVirtual: true });
            k = _at + 1;
        }

        // Ongoing silence: from the last recorded value to the extension point at the end
        const last = _lastIn;
        const end = out[out.length - 1];
        if( extended && last && tOf(end) - last.t > _limitEnd ) {
            const kEnd = ensureStart(out.length - 1, last.t, last.y);
            out[kEnd].hecPlateauEnd = true;
        }

        return out;
    }

    // The graphs' datasets from the history (result: each entity's, in the graphs' order) —
    // graphs: only those (the others as they are), none: every one
    buildChartData(result, colorHistory, graphs = null)
    {
        // The time window drawn: now, its start and end; a state without a value is a gap in a
        // curve (isGap) — unavailable or unknown with showUnavailable, one a stateMap doesn't
        // list with showMissingState —; else the curve goes over it
        const w = {
            now: moment(), start: moment(this.startTime), end: moment(this.endTime),
            isValid: state => !isMissingState(state) && state !== STATE_NOT_LISTED,
            isGap: state => state === STATE_NOT_LISTED ? this.pconfig.showMissingState : this.pconfig.showUnavailable && isMissingState(state),
        };

        let id = 0;

        for( let g of this.graphs ) {

            if( graphs && !graphs.includes(g) ) { id += g.entities.length; continue; }

            let updated = false;

            for( let j = 0; j < g.entities.length; j++, id++ ) {

                if( this.state.updateCanvas && this.state.updateCanvas !== g.canvas ) continue;

                const e = g.entities[j];
                const _dataset = g.chart.data.datasets[j];
                let s = [];
                let bcol = [];
                const _tp = performance.now();

                if( result && result.length > id ) {

                    // Per entity: a bar graph can hold curves too (see entityKind)
                    const _kind = this.entityKind(g, e);
                    // (its states as the values drawn — a timeline's and an arrowline's own,
                    // without a state_map: see processOf)
                    const process = ( _kind == 'line' || _kind == 'bar' ) ? this.processOf(e) : this.buildProcessFunction(e.process);

                    // Circular values (angles): a continuous curve, see _unwrapCircular
                    const _circP = ( _kind == 'line' || _kind == 'bar' ) ? this.circularPeriodOf(e) : null;
                    let _circBand = false;
                    if( _circP ) ({ data: result[id], band: _circBand } = this._unwrapCircular(result[id], _circP, w));

                    if( _kind == 'line' ) this.keepValueSamples(g, j, result[id], process);

                    if( _kind == 'line' ) {
                        const scale = this.drawScaleOf(e) * (e.siConversionFactor ?? 1.0);
                        s = this._lineSamples(e, result[id], process, scale, w, g.chart.hecPlotWidth());
                        if( _circBand ) this._markCircularJumps(s, _circP * Math.abs(scale));
                        const _colorFn = this._colorFunction(e, colorHistory), _fillFn = this._optionFunction(e, 'fill', colorHistory);
                        if( _colorFn || _fillFn || isBlendable(typeof e.color === 'object' ? e.color : null) && this.resolveOption(e, 'colorTransition') === 'smooth' )
                            this._applyPointColors(_dataset, e, s, _colorFn, _fillFn, scale);
                    } else if( _kind == 'bar' && result[id].length > 0 ) {
                        ({ s, bcol } = this._barSamples(g, e, result[id], process, w, this._colorFunction(e, colorHistory)));
                    } else if( g.type == 'timeline' ) {
                        s = this._timelineRows(g, e, result[id], process, w);
                        _dataset.blockFills = this._timelineFills(e, s, colorHistory);
                    } else if( g.type == 'arrowline' ) {
                        const _len = this._arrowLengths(g, e, colorHistory);
                        s = this._arrowColumns(e, result[id], process, w, g.chart.hecPlotWidth(), _len);
                        _dataset.arrowLength = _len?.drawn;
                        _dataset.arrowWeighting = this.resolveOption(e, 'arrowWeighting');
                        _dataset.arrowSpacing = ARROW_SPACING_PX;
                        Object.assign(_dataset, this._arrowColors(e, s, colorHistory));
                    }

                }

                _dataset.data = s;
                // (timed while the performance test records: the points worked out from the rows)
                perf.add('points', performance.now() - _tp);

                if( bcol.length > 0 ) {
                    _dataset.backgroundColor = bcol;
                    _dataset.borderColor = bcol;
                }

                updated = true;

            }

            if( updated ) { this.applyTimeAxis(g); this.showValues(g); }

        }
    }

    // Is series id drawn from all the cache knows of it (knownHistory) — a curve in smart mode,
    // its silences worked out there: drawn again when its history outside the window comes
    drawnFromKnownHistory(id)
    {
        return this.graphs.some(g => g.entities.some(e => e.entity === id && this.lineModeOf(e) === 'smart'));
    }

    // Entity e's band (showMinMax, see minMaxBand) for a point of a column with count values —
    // stat: statistics in it —: drawn everywhere ('all', 'min', 'max'), on the statistics only,
    // on the history only; nowhere else (a single value of the history has no band: what's
    // shown is what was recorded) → its sides ({ min, max }), null: none
    bandWanted(e, stat, count)
    {
        const b = minMaxBand(e.showMinMax);
        if( !b || ( !stat && count < 2 ) ) return null;
        return b.where === 'all' || ( b.where === 'statistics' ) === !!stat ? b : null;
    }

    // A curve's points: its values — or, in each column of pixels of the plot area
    // (columns) holding more than one (or an hour of statistics, its rows marked statistics),
    // one point: their mean (weighted by how long each lasted) at the middle of the time
    // they cover, with their min and max (columnMin, columnMax), that time (columnFrom, columnTo) and
    // whether statistics are in it (statistics: their period, statisticsPeriod) — what the screen can show of them, the
    // columns on a grid of time fixed from 1970 (the same from one refresh, or one part of
    // a long window, to the next); the band between their min and max (yMin, yMax) where
    // showMinMax wants it (bandWanted) —, its last value carried to the end of the window
    // (or now), its silences as plateaus in smart mode
    _lineSamples(e, data, process, scale, w, columns)
    {
        const n = data.length;
        let s = [];
        const _width = columns > 0 ? ( w.end.valueOf() - w.start.valueOf() ) / columns : 0;
        // (an angle: its period in the curve's units — its mean by lowpass_dt's rule, see _flush)
        const _P = ( this.circularPeriodOf(e) ?? 0 ) * Math.abs(scale);
        const _until = ( w.now > w.end ? w.end : w.now ).valueOf();
        const _num = v => { const x = this.process(v, process); return w.isValid(x) ? x * scale : NaN; };

        // (each valid value: its time, the time it lasts until, its value — statistics: its
        // mean, min and max; the times of the gaps — w.isGap —, the first after a value only)
        const _values = [], _gaps = [];
        for( let i = 0; i < n; i++ ) {
            const y = _num(data[i].state);
            if( isNaN(y) ) {
                const _t = msOf(data[i].last_changed);
                if( w.isGap(this.process(data[i].state, process)) && _values.length && !( _gaps.length && _gaps[_gaps.length - 1] > _values[_values.length - 1].t ) ) _gaps.push(_t);
                continue;
            }
            const st = data[i].statistics;
            const v = { t: msOf(data[i].last_changed), y, min: y, max: y, stat: !!st };
            // (a run of periods made up by Home Assistant, held: see card-history.js heldRuns)
            if( st ) { v.min = Math.min(_num(st.min), y); v.max = Math.max(_num(st.max), y); v.end = msOf(st.end); v.period = st.period ?? v.end - v.t; v.held = !!st.held; }
            _values.push(v);
        }
        // (fixedValue — mini-graph-card's fixed_value: its last value, flat over the whole
        // window)
        if( this.resolveOption(e, 'fixedValue') && _values.length ) {
            const _l = _values[_values.length - 1];
            _values.splice(0, _values.length, { t: w.start.valueOf(), y: _l.y, min: _l.y, max: _l.y, stat: false });
        }
        // (a time the cache has nothing of yet — not loaded, see card-history.js cachedHistory
        // notLoaded —: a gap, the curve never drawn over it; filled as its answers come)
        for( const [a] of data.notLoaded ?? [] ) if( _values.some(v => v.t < a) && !_gaps.includes(a) ) _gaps.push(a);
        _gaps.sort((p, q) => p - q);
        // (a value lasts until the next one, or a gap)
        const _gapAfter = t => _gaps.find(g => g > t);
        _values.forEach((v, k) => { v.end ??= Math.min(k + 1 < _values.length ? _values[k + 1].t : Math.max(_until, v.t), _gapAfter(v.t) ?? Infinity); });

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
            // statistics, whole — it belongs to the group where it starts —, a run of them held,
            // its first period: the rest is a silence, drawn as such — see _heldPlateaus)
            const _end = v => v.held ? v.t + v.period : v.stat || !_width ? v.end : Math.min(v.end, ge);
            let min = Infinity, max = -Infinity, stat = false, period = 0;
            for( const v of group ) {
                min = Math.min(min, v.min); max = Math.max(max, v.max); stat ||= v.stat;
                if( v.period ) period = Math.max(period, v.period);
            }
            const _from = _agg.explicit ? gs : group[0].t;
            const _to = _agg.explicit ? Math.min(ge, Math.max(_until, gs)) : Math.max(_from, _end(group[group.length - 1]));
            let y = this._aggregate(_agg.func, group, _end, min, max);
            // (an angle's mean, and its min and max around it: lowpass_dt's rule — the
            // differences by the shortest way round —, in the turn of the values unwrapped)
            if( _P > 0 && !AGGREGATES_NOT_MEAN.has(_agg.func) ) {
                const c = circularMean(group, v => v.y, v => v.t, _end, _P, y, v => v.min, v => v.max);
                if( c ) ({ mean: y, lo: min, hi: max } = c);
            }
            const p = { x: ( _from + _to ) / 2, y, columnMin: min, columnMax: max, columnFrom: _from, columnTo: _to, statistics: stat };
            // (the statistics' period: 5 minutes, an hour — the coarsest in the column)
            if( period ) p.statisticsPeriod = period;
            // (its band over its time only: Chart.js links it to the next point's only where
            // their times meet — see showMinMax)
            // (one side only — min, max —: from the curve to that side)
            const _band = this.bandWanted(e, stat, _agg.explicit ? 2 : group.length);
            if( _band ) Object.assign(p, { yMin: _band.min ? min : y, yMax: _band.max ? max : y, xMin: _from, xMax: _to });
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
        // (a column of pixels drawn as one point of several values — their mean, not the value
        // in force after it —, the next one without values of its own: the value in force
        // from its start — as an aggregated group's (_empty), _carried —, without it the curve
        // would go from the mean to the next point drawn, never at the value in force between
        // them. No value recorded there: drawing only, never shown nor hovered — hecVirtual)
        const _afterMean = (group, gs, until) => {
            const g = _groups.next(gs), _c = !_agg.explicit && group.length > 1 && g < until ? _carried(prev, g) : null;
            if( _c ) s.push({ x: g, y: _c.y, hecVirtual: true });
        };
        let group = [], gs = null, prev = null;
        for( const v of _values ) {
            const _gs = _groups.start(v.t);
            if( _gs !== gs ) {
                if( group.length ) {
                    _flush(group, gs, _groups.next(gs));
                    _afterMean(group, gs, _gs);
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
            _afterMean(group, gs, _until);
            if( _agg.explicit ) for( let g = _groups.next(gs); g < _until; g = _groups.next(g) ) _empty(prev, g, _groups.next(g));
        }

        // The last value carried to the end of the window, or to now when the window
        // reaches it (aggregated: its groups go there)
        let _extended = false;
        if( !_agg.explicit && s.length > 0 && s[s.length-1].x < _until && _values.length && _gapAfter(_values[_values.length - 1].t) === undefined ) {
            s.push({ x: _until, y: _values[_values.length - 1].y });
            _extended = true;
        }

        if( !_agg.explicit && this.lineModeOf(e) === 'smart' ) {
            // Silences are detected on every value of the history the cache knows of the entity
            // (card-history.js knownHistory) — not on the columns, nor on the statistics (an hour of them is no
            // silence), nor only on the days the window touches: the same limits whatever the
            // window, changing only as the cache fills. Never across a time the cache doesn't
            // know (not loaded — drawn from statistics, or not asked yet): no interval there
            const _raw = [];
            for( const x of this.knownHistory(e.entity) ) {
                const y = _num(x.state);
                if( !isNaN(y) ) _raw.push({ t: x.t, y, afterStats: x.afterGap });
            }
            // (an ongoing silence only after a value of the history: statistics last until
            // their end)
            const _last = _values[_values.length - 1];
            s = this._applySilencePlateaus(s, _raw, _extended && !!_last && !_last.stat);
            s = this._heldPlateaus(s, _values);
        }

        return this._withGaps(s, _values, _gaps, _until);
    }

    // The statistics Home Assistant made up — a run of periods where the sensor sent nothing,
    // held (see card-history.js heldRuns) — a silence too in smart mode: a plateau from the
    // point drawn for it to the run's end, its value kept, without a band — nothing varies in
    // a silence — (drawing only: no point of its own, hecVirtual) — unless the next point drawn is already past it
    // (a run within a column of pixels)
    _heldPlateaus(s, values)
    {
        const out = s.slice();
        for( const v of values ) {
            if( !v.stat || !v.held ) continue;
            const j = out.findIndex(p => msOf(p.x) >= v.end);
            if( j <= 0 ) continue;
            const p = out[j - 1];
            if( p.hecVirtual || ( p.columnTo ?? msOf(p.x) ) < v.t ) continue;
            out.splice(j, 0, { x: v.end, y: p.y, hecPlateauEnd: true, hecVirtual: true });
        }
        return out;
    }

    // A curve's points s broken at each gap (its time, after a value — see _lineSamples): the
    // value before it held until it, then nothing until the next value (a null point: Chart.js
    // breaks the line there); no point drawn within it
    _withGaps(s, values, gaps, until)
    {
        for( const g of gaps ) {
            const _next = values.find(v => v.t > g)?.t ?? until;
            const _prev = values.filter(v => v.t < g).pop();
            s = s.filter(p => p.x <= g || p.x >= _next);
            const i = s.findIndex(p => p.x > g);
            insertAll(s, i < 0 ? s.length : i, _prev ? [{ x: g, y: _prev.y }, { x: g, y: null }] : [{ x: g, y: null }]);
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
        const netBars = this.resolveOption(e, 'netBars');

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
            let d = 0, stat = false;
            while( i < n && msOf(data[i].last_changed) < _te ) {
                stat ||= !!data[i].statistics;
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
            // (the time it covers, as a curve's column — its tooltip's title)
            s.push({ x: t + td / 2.0, y: d * scale, columnFrom: t.valueOf(), columnTo: _te, statistics: stat });
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
            _values.push({ t: msOf(data[i].last_changed), y, min: st ? Math.min(st.min * 1.0, y) : y, max: st ? Math.max(st.max * 1.0, y) : y, stat: !!st });
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
                y = this._aggregate(func, group, v => Math.min(v.end, _te), minOf(group.map(v => v.min)), maxOf(group.map(v => v.max)));
                last = y;
            } else
                y = func === 'delta' || func === 'diff' ? 0 : last;
            if( y !== undefined ) {
                s.push({ x: t + td / 2.0, y: y * scale, columnFrom: _t0, columnTo: _te, statistics: group.some(v => v.stat) });
                if( colorFn ) bcol.push(colorFn(t + td / 2.0, y) ?? e.paletteColor);
            }
            t = te;
        }
        return { s, bcol };
    }

    // A timeline's rows: [start, end, state] blocks within the window — states following
    // each other that are each narrower than MERGE_PX pixels merged into one block
    // ('multiple'): too thin to tell apart or to point at, unlike a wider one, always drawn; a
    // short state alone keeps its own. Never with a process function (its states aren't shown
    // as such)
    _timelineRows(g, e, data, process, w)
    {
        const n = data.length;
        const s = [];
        const _start = w.start.valueOf(), _end = w.end.valueOf();
        const _merge = process ? 0 : MERGE_PX * ( _end - _start ) / Math.max(1, g.chart.hecPlotWidth());

        let merged = 0;
        let mt0, mt1;
        let state;

        const m_max = ( w.now < w.end ) ? w.now : w.end;

        for( let i = 0; i < n; i++ ) {

            // Start and end timecode of current state block
            let t0 = data[i].last_changed;
            let t1 = ( i < n-1 ) ? data[i+1].last_changed : m_max;

            // State of the current block (a merge under way keeps its first one); where it begins
            if( !merged ) state = this.processRaw(data[i].state, process);
            const i0 = i;

            // Skip noop state changes (the state in force repeated at a cache slot's start,
            // local midnight): a block judged by its whole length, merging or not
            while( i < n-1 && this.processRaw(data[i].state, process) == this.processRaw(data[i+1].state, process) ) {
                ++i;
                t1 = ( i < n-1 ) ? data[i+1].last_changed : m_max;
            }

            if( msOf(t1) - msOf(t0) >= _merge || i == n-1 ) {
                // Wide enough, finish a potential current merge before proceeding with new block
                // Also stop merging when hitting the last state block regardless of size, otherwise it wont be committed
                if( merged > 0 ) {
                    t0 = mt0;
                    t1 = mt1;
                    i = i0 - 1;
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

    // An arrowline's arrows' length (arrowLength) for entity e of graph g: undefined, none set
    // (their whole length); else { drawn } — the dataset's arrowLength, see deps/timeline.js.md:
    // { fraction }, a number (that part of it, in %); { max, unit }, a series or thresholds,
    // max its value giving the whole length (arrowLengthMax; thresholds: 100, each a length
    // in %), unit its unit (the tooltip's) —, with, read from a series or thresholds, at(t, v)
    // its value at time t for the value v (a number, else undefined; the calls in increasing
    // time) and the times its series changes (times: the values of an arrow's zone split
    // there, see _arrowColumns). history: the history of the series read, by id
    _arrowLengths(g, e, history)
    {
        const L = this.resolveOption(e, 'arrowLength');
        if( L === undefined || L === null ) return undefined;
        if( typeof L === 'number' ) return { drawn: { fraction: L / 100 } };
        const _e = { ...e, arrowLength: L }, fn = this._optionFunction(_e, 'arrowLength', history);
        const _times = ( history?.[optionSeriesOf(_e, 'arrowLength')] ?? [] ).map(p => msOf(p.last_changed));
        const at = (t, v) => { const x = fn(t, v); return typeof x === 'number' ? x : undefined; };
        // (thresholds: each gives a length itself, in % of the whole one)
        const drawn = typeof L === 'object' ? { max: 100, unit: '%' } : { max: this.arrowLengthMax(g, e, L, history), unit: this.getUnitOfMeasure(L) };
        return { drawn, at, times: _times };
    }

    // The means of a series' rows (in time order; each value lasting until the next one, the
    // last one until now) by zones Z ms long on a grid of time fixed from 1970, each value
    // weighted by how long it lasts in the zone (one lasting no time: nothing, as timeWeightedMean) → [{ t: the zone's start, mean }], the zones
    // holding a value only
    _zoneMeans(rows, Z)
    {
        const out = [], _until = Date.now();
        let k0 = null, sum = 0, span = 0;
        const _flush = () => { if( span > 0 ) out.push({ t: k0 * Z, mean: sum / span }); sum = 0; span = 0; };
        for( let i = 0; i < rows.length; i++ ) {
            const v = Number(rows[i].state);
            if( rows[i].state === '' || rows[i].state === null || !Number.isFinite(v) ) continue;
            const a = msOf(rows[i].last_changed), b = i + 1 < rows.length ? msOf(rows[i + 1].last_changed) : Math.max(a, _until);
            for( let t = a; t < b; ) {
                let k = Math.floor(t / Z);
                if( ( k + 1 ) * Z <= t ) k++;
                const e = Math.min(b, ( k + 1 ) * Z);
                if( k !== k0 ) { _flush(); k0 = k; }
                sum += v * ( e - t ); span += e - t;
                t = e;
            }
        }
        _flush();
        return out;
    }

    // An arrowline's arrows' colors and backgrounds, each block's (its rows s, [start, end,
    // state]: at its middle, for its value — as a curve's points', see _optionFunction): the
    // dataset's arrowColors and arrowBackgrounds (deps/timeline.js.md) — each undefined when
    // e's color, its fill, is a value itself (the dataset's arrowColor, arrowBackground: the
    // same for every arrow). history: the history of the series read, by id
    _arrowColors(e, s, history)
    {
        const colorFn = this._colorFunction(e, history), fillFn = this._optionFunction(e, 'fill', history);
        if( !colorFn && !fillFn ) return { arrowColors: undefined, arrowBackgrounds: undefined };
        const _fixed = this.entityColor(e), colors = [], fills = [];
        for( const b of s ) {
            const t = ( msOf(b[0]) + msOf(b[1]) ) / 2, v = Number(b[2]);
            const c = colorFn ? colorFn(t, v) ?? e.paletteColor : _fixed;
            colors.push(c);
            // (a fill fading out: its color light, as an arrowline's fill: fade — see fillAsColor)
            // (a fill fading out: as it is — { fade: its color }, drawn so, see deps/timeline.js.md)
            const _st = fillFn ? this.fillStyle(this.arrowFillOf(e, fillFn(t, v)), c, !!colorFn) : undefined;
            fills.push(fillFn ? ( typeof _st === 'object' ? _st : this.fillAsColor(_st) ) : undefined);
        }
        return { arrowColors: colorFn ? colors : undefined, arrowBackgrounds: fillFn ? fills : undefined };
    }

    // An arrowline's fill f (of curve e): solid ignored — it would hide the arrows —, the
    // default fill of an arrowline instead (light; none with its color defined)
    arrowFillOf(e, f)
    {
        return f === 'solid' ? ( e.colorSet ? false : 'light' ) : f;
    }

    // A timeline's blocks' fill, each block's (its rows s, [start, end, state]: at its middle,
    // as an arrowline's): the dataset's blockFills (deps/timeline.js.md) — undefined when e's
    // fill is a value itself (the dataset's blockFill, the same for every block). history:
    // the history of the series read, by id
    _timelineFills(e, s, history)
    {
        const fillFn = this._optionFunction(e, 'fill', history);
        return fillFn ? s.map(b => this.blockFillOf(fillFn(( msOf(b[0]) + msOf(b[1]) ) / 2, Number(b[2])))) : undefined;
    }

    // A timeline block's fill, from a fill value: none, fade, light, solid — any other (a color
    // of its own, none given) ignored: solid, a timeline's default
    blockFillOf(f)
    {
        if( f === false || f === NO_FILL ) return 'none';
        return f === 'fade' || f === 'light' ? f : 'solid';
    }

    // The value of series id giving entity e's arrows (of graph g) their whole length: arrowMax
    // set — a number —, that one; else chosen as the automatic Y axis chooses its top (see
    // card-yscale.js chooseYAxis: what is shown first, a steady scale second, at
    // ARROW_SCALE_STEADY), from the series over the time window and around it (history: the
    // series' history, by id) as the arrows show it: its means by the time of an arrow's zone
    // (ARROW_SPACING_PX of the plot — on a grid of time fixed from 1970 —, each value weighted by
    // how long it lasts there), their absolute values — the longest arrow at its whole length,
    // or nearly —, 0 at the bottom; a soft arrowMax (~value) reached at least. Kept for the next
    // update, by graph and curve
    arrowLengthMax(g, e, id, history)
    {
        const M = this.resolveOption(e, 'arrowMax');
        if( typeof M === 'number' ) return Math.abs(M);
        const _soft = M?.soft !== undefined ? Math.abs(M.soft) : undefined;
        const Z = ARROW_SPACING_PX * ( msOf(this.endTime) - msOf(this.startTime) ) / Math.max(1, g.chart.hecPlotWidth());
        const entries = this._zoneMeans(history?.[id] ?? [], Z).map(({ t, mean }) => ({ x: t, lo: 0, hi: Math.abs(mean) }));
        const _index = rangeIndex([entries]);
        const rangeOf = (t0, t1) => {
            const r = _index(t0, t1);
            return _soft === undefined ? r : { lo: 0, hi: Math.max(r?.hi ?? 0, _soft) };
        };
        this._arrowScales ??= new Map();
        const _key = g.id + ':' + keyOf(e);
        const a = chooseYAxis(this._arrowScales.get(_key), rangeOf, msOf(this.startTime), msOf(this.endTime),
                              { steady: ARROW_SCALE_STEADY, moving: !!this.state.drag, zero: true });
        if( a ) this._arrowScales.set(_key, a);
        return a?.max;
    }

    // An arrowline's rows, from the values of its entity (data; process: its process
    // function) within the time window w, in the columns of pixels of its plot (columns of
    // them; as a curve's, on a grid of time fixed from 1970) — what Chart.js averages over
    // each arrow's zone, and the tooltip shows (deps/timeline.js.md): a value alone in its
    // columns, its own row — over the columns it fills alone, joined —; a column holding
    // several, one row: their mean — each value weighted by how long it lasts in the column;
    // a circular entity's (circularPeriodOf) circular, the one rule, circularMean —, with
    // their lowest and highest around it (the statistics' own min and max), as a curve's.
    // Each row [from, to, mean (a circular entity's in [0, period)), its length's mean (len: _arrowLengths, its values split where its
    // series changes; undefined: none), { lo, hi — the lowest and highest, as differences
    // to the mean —, lenMin, lenMax, span — how long its values last —, lenSpan — those
    // with a length —, lenWeight — Σ how long × |length| —, byLen — their mean weighted by
    // it (arrowWeighting: length) —, statistics, statisticsPeriod, sides — showMinMax's
    // sides there (bandWanted) }]. A value that isn't a number: no row (a gap)
    _arrowColumns(e, data, process, w, columns, len)
    {
        // (its means circular for a circular entity only — see circularPeriodOf; null: as a number's)
        const P = this.circularPeriodOf(e);
        const _start = msOf(w.start), _end = msOf(w.end), _until = Math.min(_end, msOf(w.now));
        const cw = ( _end - _start ) / Math.max(1, columns);
        const _num = x => { if( x === null || x === undefined || x === '' ) return undefined; const v = Number(this.processRaw(x, process)); return Number.isFinite(v) ? v : undefined; };
        // (each value's parts: its time within the window, cut where its length's series
        // changes, each with its length there)
        const _parts = [], _cuts = len?.times ?? [];
        let c = 0;
        for( let i = 0; i < data.length; i++ ) {
            const v = _num(data[i].state);
            if( v === undefined ) continue;
            const a = Math.max(_start, msOf(data[i].last_changed)), b = Math.min(_until, i + 1 < data.length ? msOf(data[i + 1].last_changed) : _until);
            if( b <= a ) continue;
            const st = data[i].statistics;
            const value = { v, lo: st ? _num(st.min) ?? v : v, hi: st ? _num(st.max) ?? v : v, statistics: !!st, period: st ? st.period ?? msOf(st.end) - msOf(data[i].last_changed) : 0 };
            while( c < _cuts.length && _cuts[c] <= a ) c++;
            let t = a;
            for( let k = c; k < _cuts.length && _cuts[k] < b; k++ ) { _parts.push({ ...value, a: t, b: _cuts[k] }); t = _cuts[k]; }
            _parts.push({ ...value, a: t, b });
        }
        for( const p of _parts ) p.len = len?.at ? len.at(( p.a + p.b ) / 2, p.v) : undefined;
        // (each column's parts: a part cut where a column ends)
        const out = [];
        let col = [], k0 = null;
        const _flush = () => {
            if( !col.length ) return;
            const _last = out[out.length - 1];
            // (a value alone in its column, after itself alone in the one before: the same row)
            if( col.length === 1 && _last?.[4].alone === col[0].of && _last[1] === col[0].a ) {
                const x = col[0], d = x.b - x.a, r = _last[4];
                _last[1] = x.b; r.span += d;
                if( x.len !== undefined ) { r.lenSpan += d; r.lenWeight += d * Math.abs(x.len); }
            } else out.push(this._arrowRow(e, col, P));
        };
        for( const p of _parts ) {
            for( let a = p.a; a < p.b; ) {
                let k = Math.floor(a / cw);
                if( ( k + 1 ) * cw <= a ) k++;
                const b = Math.min(p.b, ( k + 1 ) * cw);
                if( k !== k0 ) { _flush(); col = []; k0 = k; }
                col.push({ ...p, a, b, of: p });
                a = b;
            }
        }
        _flush();
        return out;
    }

    // An arrowline's row (see _arrowColumns) of the parts of its values in a column (each: its
    // time a to b, its value v, its lowest and highest lo, hi, its length len), P its entity's
    // circular period — its means circular (the one rule, circularMean) —, null: a number's
    // (timeWeightedMean, its lowest and highest as they are)
    _arrowRow(e, parts, P)
    {
        const _d = x => x.b - x.a, _withLen = parts.filter(x => x.len !== undefined);
        // (the mean of items, each weighted by w — with its lowest and highest around it)
        const _mean = (items, value, w, low, high) => P ? circularMean(items, value, () => 0, w, P, value(items[0]), low, high)
            : { mean: timeWeightedMean(items, value, () => 0, w), lo: low ? minOf(items.map(low)) : undefined, hi: high ? maxOf(items.map(high)) : undefined };
        const m = _mean(parts, x => x.v, _d, x => x.lo, x => x.hi);
        const lenWeight = _withLen.reduce((s, x) => s + _d(x) * Math.abs(x.len), 0);
        // (the direction weighted by how long × |length|: each part's weight its own)
        const byLen = lenWeight > 0 ? _mean(_withLen, x => x.v, x => _d(x) * Math.abs(x.len)).mean : undefined;
        const _shown = v => P ? Chart.hecCircular.wrap(v, P) : v;
        const statistics = parts.some(x => x.statistics), statisticsPeriod = maxOf(parts.map(x => x.period));
        return [parts[0].a, parts[parts.length - 1].b, _shown(m.mean),
                _withLen.length ? timeWeightedMean(_withLen, x => x.len, x => x.a, x => x.b) : undefined,
                { lo: m.lo - m.mean, hi: m.hi - m.mean,
                  lenMin: _withLen.length ? minOf(_withLen.map(x => x.len)) : undefined, lenMax: _withLen.length ? maxOf(_withLen.map(x => x.len)) : undefined,
                  span: parts.reduce((s, x) => s + _d(x), 0), lenSpan: _withLen.reduce((s, x) => s + _d(x), 0), lenWeight,
                  byLen: byLen === undefined ? undefined : _shown(byLen),
                  statistics, ...( statisticsPeriod ? { statisticsPeriod } : {} ), sides: this.bandWanted(e, statistics, 2),
                  // (a value alone: which one — its row joined to the next column's when it's alone there too)
                  alone: parts.length === 1 ? parts[0].of : undefined }];
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

    // Circular values (period P) placed for the time window shown (w), on a copy of the
    // samples (they are shared with the cache) — before they're grouped by column: a mean
    // across 0 needs them continuous. The rule is Chart.js's, the one for every circular
    // curve (Chart.hecCircular.place: continuous, around the circular mean of the window
    // shown — from the value in force at its start to the first one after its end, each
    // weighted by how long it is in force in it: the one rule, circularMean —, what is
    // loaded around it in the same turn; more than a turn there: each value in the turn
    // around that mean, band true, its jumps dashed by _markCircularJumps). A Y range set by
    // hand places them again around its middle (Chart.js, dataset option circularPeriod).
    _unwrapCircular(data, P, w)
    {
        const idx = [], vals = [];
        for( let i = 0; i < data.length; i++ ) {
            const st = data[i].state;
            if( st === null || st === undefined || st === '' ) continue;
            const v = Number(st);
            if( !isFinite(v) ) continue;
            idx.push(i); vals.push(v);
        }
        if( !idx.length ) return { data, band: false };

        const _t0 = w ? w.start.valueOf() : -Infinity, _t1 = w ? w.end.valueOf() : Infinity;
        let _first = 0, _last = idx.length - 1;
        for( let m = 0; m < idx.length; m++ ) {
            const t = msOf(data[idx[m]].last_changed);
            if( t <= _t0 ) _first = m;
            if( t > _t1 ) { _last = m; break; }
        }
        // (their circular mean over the window: each value weighted by how long it's in force
        // there — the one rule, circularMean)
        const _until = Math.min(_t1, Date.now()), _at = m => msOf(data[idx[m]].last_changed);
        const _win = Array.from({ length: _last - _first + 1 }, (_, k) => _first + k);
        const _mean = circularMean(_win, m => vals[m], m => Math.max(_at(m), _t0), m => Math.min(m < _last ? _at(m + 1) : _until, _t1), P, vals[_first])?.mean;
        const { values, band } = Chart.hecCircular.place(vals, P, _first, _last, undefined, _mean);

        const out = data.slice();
        idx.forEach((i, m) => {
            const p = data[i];
            const q = { ...p, state: values[m] };
            // (a min/max carried by the sample moves with it)
            const shift = values[m] - Number(p.state);
            if( p.yMin != null ) q.yMin = p.yMin + shift;
            if( p.yMax != null ) q.yMax = p.yMax + shift;
            out[i] = q;
        });
        return { data: out, band };
    }

    // A circular curve put in a one-turn band jumps where it crosses the band's edge (the
    // rule: Chart.hecCircular.jumps): the segment is drawn as a straight dashed line, like the
    // plateaus of the smart line mode — marked as a jump too (hecCircularJump), which Chart.js
    // unmarks when it puts the curve in another turn (circularPeriod). Q: the period in chart
    // units.
    _markCircularJumps(s, Q)
    {
        for( let k = 1; k < s.length; k++ )
            if( Chart.hecCircular.jumps(s[k - 1].y, s[k].y, Q) ) { s[k].hecPlateauEnd = true; s[k].hecCircularJump = true; }
    }
}
