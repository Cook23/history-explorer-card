// The time window shown: its range (from the selector, a string, minutes), its moves (a
// day back or forward, today, zoom steps) and the time axis of each graph (ticks, step size,
// the room kept on the right for linked graphs). Part of HistoryCardState (added to it in
// history-explorer-card.js).

import { RIGHT_Y_AXIS } from "./card-charts.js";
import { paintMagnifier } from "./card-menus.js";
import { perf } from "./card-perf.js";
import { ZOOM_BOX_MODES, OPTION_DEFAULTS, TICK_DENSITIES, TIME_RANGES, MAX_RANGE_YEARS, YEAR_HOURS } from "./history-options.js";
const moment = window.HXLocal_moment;
const Chart = window.HXLocal_Chart;

// The time ranges the magnifier's zoom steps through, in hours (TIME_RANGES)
const ranges = TIME_RANGES.filter(r => r.step !== false).map(r => r.hours);
// The room Chart.js keeps between two time labels (autoSkipPadding, card-charts.js)
export const TICK_LABEL_GAP_PX = 8;
// A window ending this close to the end (realTimeEnd) ends there (its end is set to the second)
const END_MS = 1000;
// The toolbar's '<' '>' (stepDay): the window moved by STEP_MOST of it at most — less half a
// graduation —, STEP_LEAST at least: 10 % to 20 % of it still shown after
const STEP_MOST = 0.9, STEP_LEAST = 0.8;
// (its start then on a round time: the coarsest of STEP_UNITS — [unit, how many] — the
// window's length allows, STEP_ROUND_FROM — [length under, in hours; the first of
// STEP_UNITS tried]: under 1 h a minute, under 6 h 10 minutes, under 3 days an hour, under
// 2 weeks a day, under 3 months a week (from Monday), longer a month (from the 1st) —, or a
// finer one when none of its round times keeps the move within STEP_LEAST to STEP_MOST)
const STEP_UNITS = [['month', 1], ['isoWeek', 1], ['day', 1], ['hour', 1], ['minute', 10], ['minute', 1]];
const STEP_ROUND_FROM = [[1, 5], [6, 4], [72, 3], [336, 2], [2184, 1], [Infinity, 0]];

export class CardTimeRange
{
    // --------------------------------------------------------------------------------------
    // Moving the time window
    // --------------------------------------------------------------------------------------

    // The window back to the end (setEndWindow) — gap: the time kept after it, the real
    // time's (state.realTimeGap: following the end, see updateHistoryAutoRefresh)
    today(resetRange = false, gap = 0)
    {
        if( resetRange )
            this.setTimeRangeFromString(this.pconfig.defaultTimeRange);

        this.setEndWindow(gap);
        this.updateHistory(!resetRange);
    }

    // The end — where the window ends in real time; not the present, now, the time the new
    // values come at —: now, moved by realTimeStep (a time after now: the step the new values
    // fill, the window then moved a step on —, or the end of the hour, the day…; a negative
    // one: a time before now, followed), the window going a time-axis graduation past it at
    // most (_settleWindow)
    realTimeEnd()
    {
        let endTime = moment();
        if( this.pconfig.realTimeStep ) {
            const s = this.pconfig.realTimeStep.slice(0, -1);
            switch( this.pconfig.realTimeStep.slice(-1)[0] ) {
                case 'm': endTime = endTime.add(s, 'minute'); break;
                case 'h': endTime = endTime.add(s, 'hour'); break;
                case 'd': endTime = endTime.add(s, 'day'); break;
                case 'w': endTime = endTime.add(s, 'week'); break;
                case 'o': endTime = endTime.add(s, 'month'); break;
                case 'y': endTime = endTime.add(s, 'year'); break;
                case 'H': endTime = moment(endTime.format('YYYY-MM-DDTHH:00:00')).add(s, 'hour'); break;
                case 'D': endTime = moment(endTime.format('YYYY-MM-DDT00:00:00')).add(s, 'day'); break;
                case 'O': endTime = moment(endTime.format('YYYY-MM-01T00:00:00')).add(s, 'month'); break;
                case 'Y': endTime = moment(endTime.format('YYYY-01-01T00:00:00')).add(s, 'year'); break;
            }
        }
        return endTime;
    }

    // The time window ending at the end (realTimeEnd), over the active range — real
    // time; set before the graphs are first built, so their time axis has it from the start
    setEndWindow(gap = 0)
    {
        const t1 = this.realTimeEnd().add(gap, 'ms').startOf('second');
        this._setWindow(moment(t1).subtract(this.activeRange.timeRangeHours, "hour").subtract(this.activeRange.timeRangeMinutes, "minute"), t1);
    }

    // The window set from t0 to t1 (to the second), then settled (_settleWindow)
    _setWindow(t0, t1)
    {
        this.startTime = moment(t0).format('YYYY-MM-DDTHH:mm:ss');
        this.endTime = moment(t1).format('YYYY-MM-DDTHH:mm:ss');
        this._settleWindow();
    }

    // Every window set (a range, a zoom, a drag, a day before or after, the calendar, the
    // present): never more than a graduation of the time axis past the end
    // (realTimeEnd) — moved back to end there, whatever asked it: nothing after
    // (state.nothingAfter, '>' greyed) —; real time (state.autoScroll) when the time the new
    // values come to is on screen — from now to the end (realTimeStep: the step filling;
    // none: now; negative: the end, before now) —, the window following them as they
    // come with the time it shows after the end kept (state.realTimeGap); else the
    // history, the window staying where it is. The toolbar shows both (showRealTime)
    _settleWindow()
    {
        const _end = this.realTimeEnd(), _limit = moment(_end).add(this.graduationMs(), 'ms'), _over = moment(this.endTime).diff(_limit);
        if( _over > 0 ) {
            this.startTime = moment(this.startTime).subtract(_over, 'ms').format('YYYY-MM-DDTHH:mm:ss');
            this.endTime = _limit.format('YYYY-MM-DDTHH:mm:ss');
        }
        const _after = moment(this.endTime).diff(_end);
        this.state.nothingAfter = moment(this.endTime).diff(_limit) > -END_MS;
        this.state.autoScroll = _after > -END_MS && moment(this.startTime).diff(moment.min(moment(), _end)) <= END_MS;
        this.state.realTimeGap = this.state.autoScroll ? Math.max(0, _after) : 0;
        this.showRealTime();
    }

    // A graduation of the time axis, in ms: its step, as Chart.js drew it (timeTickStep)
    graduationMs()
    {
        const [n, unit] = this.timeTickStep();
        return moment.duration(n, unit).asMilliseconds() || 0;
    }

    todayNoReset()
    {
        this.today(false);
    }

    // The window starting at the start of day (YYYY-MM-DD, the calendar — openCalendar), as
    // the toolbar's date shows it, the range kept; reaching the end, real time
    showDay(day)
    {
        if( !day ) return;
        const t0 = moment(day).startOf('day');
        if( moment(t0).add(this.timeRangeSeconds(), 'second') >= this.realTimeEnd() ) return this.todayNoReset();
        this.moveTimeWindow(t0);
        this.applyTimeAxes();
    }

    // Back to the default range (defaultTimeRange) — a double-click on the magnifier; in real
    // time, kept there (applyTimeRange)
    defaultRange()
    {
        this.setTimeRangeFromString(this.pconfig.defaultTimeRange, true);
        this.writeLocalState();
    }

    // The toolbar's '<' (dir -1) and '>' (dir 1), the range kept: the window moved by
    // max(min(90 % of it, it less half a graduation of the time axis), 80 % of it) — 10 % to
    // 20 % of what was shown still shown —, its start then on the roundest time nearest it
    // that keeps the move within 80 % to 90 % (_roundStart). The end (realTimeEnd) a stop: '>' passing it, or leaving it less
    // than 20 % of the window ahead, stops with it on the right edge, the next one goes after it (a graduation at most, _settleWindow); '<' from
    // after it comes back with it on the right edge
    stepDay(dir)
    {
        const t0 = moment(this.startTime).valueOf(), t1 = moment(this.endTime).valueOf(), span = t1 - t0, G = this.graduationMs();
        const P = this.realTimeEnd().valueOf(), step = Math.max(Math.min(STEP_MOST * span, span - G / 2), STEP_LEAST * span);
        // (at the end: the end on screen — real time, state.autoScroll —, as the window was last
        // set — its real time's moves too, see updateHistoryAutoRefresh: never against now, the
        // window's end behind it until the next one —; after it, the time shown after it,
        // state.realTimeGap)
        let end;
        if( dir > 0 && this.state.autoScroll ) end = P + G;
        else if( dir < 0 && this.state.autoScroll && this.state.realTimeGap > END_MS ) end = P;
        else {
            const start = this._roundStart(t0 + dir * step, span, t0, dir);
            // ('>' leaving the end less than what stays shown — 1 - STEP_LEAST of the window — before
            // it: on it, a move too small for another '>')
            end = dir > 0 ? ( P - ( start + span ) < ( 1 - STEP_LEAST ) * span ? P : start + span ) : start + span;
        }
        this._setWindow(moment(end - span), moment(end));

        this.updateHistory(true);
    }

    // A window's new start near t (a move from t0, dir: -1 back, 1 forward), span ms long: the
    // round time nearest t whose move from t0 is within STEP_LEAST to STEP_MOST of span — of
    // the coarsest unit that has one (STEP_UNITS, from STEP_ROUND_FROM's) —, else t itself
    _roundStart(t, span, t0, dir)
    {
        const _in = x => { const d = dir * ( x - t0 ); return d >= STEP_LEAST * span && d <= STEP_MOST * span; };
        for( const [unit, n] of STEP_UNITS.slice(STEP_ROUND_FROM.find(([h]) => span < h * 3600e3)[1]) ) {
            const m = moment(t).startOf(unit === 'minute' ? 'minute' : unit);
            if( unit === 'minute' ) m.minute(Math.floor(m.minute() / n) * n);
            const a = m.valueOf(), b = a === t ? a : m.add(n, unit === 'isoWeek' ? 'week' : unit).valueOf();
            const fit = [a, b].filter(_in).sort((x, y) => Math.abs(x - t) - Math.abs(y - t));
            if( fit.length ) return fit[0];
        }
        return t;
    }

    // The magnifier — the elastic box's mode: turned on by a click on it, or by a mouse's drag
    // mostly vertical on a graph (Chart.js's zoombox); off by a click on it again,
    // at the end of a gesture on a graph (the box's, or any other — which then goes on as
    // usual), by a press outside the graphs, or Escape. On: every drag on a graph's plot area
    // draws the box, a finger's too (the canvas takes the gesture: Chart.js zoomSelectMode,
    // as the padlock's touch-action), the magnifier green
    toggleZoom()
    {
        if( this.state.zoomMode ) this.endZoomMode(); else this.startZoomMode();
    }

    startZoomMode()
    {
        if( this.state.zoomMode ) return;
        this._setZoomMode(true);
        this._zoomStop = this.listenOutsideGraphs(() => this.endZoomMode(), this.ui.zoomButton);
    }

    endZoomMode()
    {
        if( !this.state.zoomMode ) return;
        this._zoomStop?.();
        this._zoomStop = null;
        this._setZoomMode(false);
    }

    _setZoomMode(on)
    {
        this.state.zoomMode = on;
        this._paintMagnifiers();
        // (redrawn: a finger's drag is the box's in the mode — the canvas' touch-action)
        for( const g of this.graphs )
            if( g.chart ) { g.chart.options.zoomSelectMode = on; g.chart.render({ duration: 0, lazy: true }); }
    }

    // The magnifiers (#bz_N): their mode's symbol (state.zoomBox), green while the elastic
    // box's mode is on; the magnifiers' outlines in the toolbar's background, opaque: its color
    // (faint) over the card's (--hec-mag-bg)
    _paintMagnifiers()
    {
        for( const b of this.ui.zoomButton ) {
            const _box = b?.parentNode;
            if( _box ) _box.style.setProperty('--hec-mag-bg', Chart.hecUi.opaqueBackground(_box));
            const _svg = b?.querySelector('svg');
            if( _svg ) paintMagnifier(_svg, this.state.zoomBox, this.state.zoomMode ? 'var(--success-color, #4caf50)' : null);
        }
    }

    // The magnifier's mode — what the elastic box zooms: 'x' the time, 'y' the Y axes, 'xy'
    // both (Chart.js zoomBoxAxes) —, chosen in its menu (save: kept, as the time range is) or
    // restored (card-storage.js)
    setZoomBoxMode(mode, save = true)
    {
        this.state.zoomBox = ZOOM_BOX_MODES.includes(mode) ? mode : this.pconfig.defaultMagnifierMode;
        this._paintMagnifiers();
        for( const g of this.graphs ) if( g.chart ) g.chart.options.zoomBoxAxes = this.state.zoomBox;
        if( save ) this.writeLocalState();
    }

    // The zoom buttons and the duration menu: where the window goes, applyTimeRange's rule
    decZoom()
    {
        this.decZoomStep();
        this.writeLocalState();
    }

    incZoom()
    {
        this.incZoomStep();
        this.writeLocalState();
    }

    timeRangeSelected(event)
    {
        this.applyTimeRange(event.target.value, true);
        this.writeLocalState();
    }

    // Is the window following the new values (real time) — rather than the history?
    isLive()
    {
        return !!this.state.autoScroll && moment() >= moment(this.startTime);
    }

    // Where a range change without a point of its own keeps the window: [time, position
    // along it] — the end in real time: it stays where it is (endAnchor); its middle
    // when looking at the history. The one rule of every range change (applyTimeRange,
    // applyTimeRangeMinutes): the buttons, the duration menu, the magnifier's default range,
    // a zoom gesture in real time keeping the end (onTimeZoom)
    _rangeAnchor()
    {
        return this.isLive() ? this.endAnchor() : [moment((moment(this.startTime) + moment(this.endTime)) / 2), 0.5];
    }

    // The end (realTimeEnd) and where it is along the window — [time, position]: on the right, or
    // before the time shown after it (state.realTimeGap)
    endAnchor()
    {
        const t0 = moment(this.startTime), _span = moment(this.endTime).diff(t0), P = this.realTimeEnd();
        return [P, _span > 0 ? Math.min(1, Math.max(0, P.diff(t0) / _span)) : 1.0];
    }

    // --------------------------------------------------------------------------------------
    // Stepped zooming
    // --------------------------------------------------------------------------------------

    decZoomStep(t_center = null, t_position = 0.5)
    {
        if( !this.activeRange.timeRangeHours ) {
            this.activeRange.timeRangeMinutes *= 2;
            if( this.activeRange.timeRangeMinutes >= 60 ) {
                this.activeRange.timeRangeMinutes = 0;
                this.activeRange.timeRangeHours = 0;
            }
        }

        if( !this.activeRange.timeRangeMinutes ) {

            let i = ranges.findIndex(e => e >= this.activeRange.timeRangeHours);
            if( i >= 0 ) {
                if( ranges[i] > this.activeRange.timeRangeHours ) i--;
                if( i < ranges.length-1 )
                    this.applyTimeRange(ranges[i+1], true, t_center, t_position);
            }

        } else

            this.applyTimeRangeMinutes(this.activeRange.timeRangeMinutes, true, t_center, t_position);
    }

    incZoomStep(t_center = null, t_position = 0.5)
    {
        const i = ranges.findIndex(e => e >= this.activeRange.timeRangeHours);
        if( i > 0 )
            this.applyTimeRange(ranges[i-1], true, t_center, t_position);
        else
            this.applyTimeRangeMinutes((this.activeRange.timeRangeHours * 60 + this.activeRange.timeRangeMinutes) / 2, true, t_center, t_position);
    }

    // --------------------------------------------------------------------------------------
    // Time ticks and step size
    // --------------------------------------------------------------------------------------

    computeTickDensity(width)
    {
        // (not set: the default density)
        const _density = k => TICK_DENSITIES[k] ?? TICK_DENSITIES[OPTION_DEFAULTS.timeTicks.density];
        if( this.pconfig.timeTickOverride === undefined )
            return Math.max(( width < 650 ) ? 4 : ( width < 1100 ) ? 3 : ( width < 1300 ) ? 2 : ( width < 1900 ) ? 1 : 0, _density(this.pconfig.timeTickDensity));
        else
            return _density(this.pconfig.timeTickOverride);
    }

    // The time axis' step asked for the range now set — the step Chart.js drew the one before
    // with let go (timeTickStep: this one's until it draws it, its graduation the window's
    // limit, see _settleWindow)
    setStepSize(update = false)
    {
        this.timeTicksAsked();
        const width = this.cardWidth();

        const tdensity = this.computeTickDensity(width);

        if( this.activeRange.timeRangeHours ) {

            const range = this.activeRange.timeRangeHours;

            const stepSizes = [];
            stepSizes.push({ '1': '2m', '2': '5m', '3': '5m', '4': '5m', '5': '5m', '6': '10m', '7': '10m', '8': '10m', '9': '10m', '10': '15m', '11': '15m', '12': '15m', '24': '30m', '48': '1h', '72': '2h', '96': '2h', '120': '3h', '144': '3h', '168': '6h', '336': '12h', '504': '12h', '720': '1d', '2184': '1o', '4368': '1o', '8760': '1o' });
            stepSizes.push({ '1': '2m', '2': '5m', '3': '10m', '4': '10m', '5': '10m', '6': '15m', '7': '15m', '8': '20m', '9': '20m', '10': '30m', '11': '30m', '12': '30m', '24': '1h', '48': '2h', '72': '3h', '96': '3h', '120': '6h', '144': '6h', '168': '12h', '336': '1d', '504': '1d', '720': '1d', '2184': '1o', '4368': '1o', '8760': '1o' });
            stepSizes.push({ '1': '5m', '2': '10m', '3': '15m', '4': '30m', '5': '30m', '6': '30m', '7': '30m', '8': '30m', '9': '30m', '10': '1h', '11': '1h', '12': '1h', '24': '2h', '48': '4h', '72': '6h', '96': '6h', '120': '12h', '144': '12h', '168': '12h', '336': '1d', '504': '2d', '720': '2d', '2184': '1o', '4368': '1o', '8760': '1o' });
            stepSizes.push({ '1': '10m', '2': '20m', '3': '30m', '4': '1h', '5': '1h', '6': '1h', '7': '1h', '8': '1h', '9': '1h', '10': '2h', '11': '2h', '12': '2h', '24': '4h', '48': '8h', '72': '12h', '96': '1d', '120': '1d', '144': '1d', '168': '2d', '336': '3d', '504': '4d', '720': '7d', '2184': '1o', '4368': '1o', '8760': '1o' });
            stepSizes.push({ '1': '20m', '2': '30m', '3': '1h', '4': '2h', '5': '2h', '6': '2h', '7': '2h', '8': '2h', '9': '2h', '10': '4h', '11': '4h', '12': '4h', '24': '6h', '48': '12h', '72': '1d', '96': '2d', '120': '2d', '144': '2d', '168': '4d', '336': '7d', '504': '7d', '720': '14d', '2184': '1o', '4368': '1o', '8760': '1o' });

            // (beyond a year: a tick every few months — 1, 2, 3, 6 or 12 —, about as many per
            // year as a year's own at this density, spread over the years)
            const _perYear = [12, 12, 8, 6, 4][tdensity], _years = range / YEAR_HOURS;
            const _step = stepSizes[tdensity][range] ?? ( [1, 2, 3, 6, 12].find(m => 12 / m * _years <= _perYear * 1.5) ?? 12 ) + 'o';
            this.activeRange.tickStepSize = _step.slice(0, -1);
            switch( _step.slice(-1)[0] ) {
                case 'm': this.activeRange.tickStepUnit = 'minute'; break;
                case 'h': this.activeRange.tickStepUnit = 'hour'; break;
                case 'd': this.activeRange.tickStepUnit = 'day';  break;
                case 'o': this.activeRange.tickStepUnit = 'month';  break;
            }

        } else if( this.activeRange.timeRangeMinutes ) {

            switch( tdensity ) {
                case 0: this.activeRange.tickStepSize = 1; break;
                case 1: this.activeRange.tickStepSize = 1; break;
                case 2: this.activeRange.tickStepSize = ( this.activeRange.timeRangeMinutes <= 20 ) ? 1 : 5; break;
                case 3: this.activeRange.tickStepSize = ( this.activeRange.timeRangeMinutes <= 10 ) ? 1 : ( this.activeRange.timeRangeMinutes < 30 ) ? 5 : 10; break;
                case 4: this.activeRange.tickStepSize = ( this.activeRange.timeRangeMinutes <= 5 ) ? 1 : ( this.activeRange.timeRangeMinutes < 25 ) ? 5 : 10; break;
            }
            this.activeRange.tickStepUnit = 'minute';

        } else {

            this.activeRange.tickStepSize = 24;
            this.activeRange.tickStepUnit = 'hour';

        }

        if( update ) {
            for( let g of this.graphs ) this.applyTimeAxis(g);
        }
    }

    // The time labels' step drawn: Chart.js' — the one asked (setStepSize), unless its labels
    // don't fit side by side along the plot: a longer one (time.hecTicksApplied) —, else the
    // one asked → [stepSize, unit]
    timeTickStep()
    {
        const a = this._timeTickApplied;
        return a ? [a.stepSize, a.unit] : [+this.activeRange.tickStepSize, this.activeRange.tickStepUnit];
    }

    // --------------------------------------------------------------------------------------
    // Activate a given time range
    // --------------------------------------------------------------------------------------

    // The range of `range` hours: itself under 12 hours (an hour, or one the selector holds
    // unlisted), else the shortest of the ranges at least that long — the longest at most
    validateRange(range)
    {
        if( range > 0 && range < 12 ) return range;
        return ranges.find(r => r >= range) ?? ranges[ranges.length - 1];
    }

    // The time range set — from the toolbar, a gesture, the saved state (card-storage.js),
    // whatever is loading: a change asked is always applied, never dropped (the last one to
    // speak wins; the loading follows the window shown). update: the window changed too — around t_center, at
    // t_position along it, else where _rangeAnchor keeps it
    applyTimeRange(range, update, t_center = null, t_position = 0.5)
    {
        range = Math.max(range, 1);
        this._applyRange(range, 0, range, update, t_center, t_position);
    }

    // (as applyTimeRange)
    applyTimeRangeMinutes(range, update, t_center = null, t_position = 0.5)
    {
        this._applyRange(0, Math.max(range, 1), "0", update, t_center, t_position);
    }

    // The range of `hours` and `minutes` set, the range selectors showing `selected`
    _applyRange(hours, minutes, selected, update, t_center, t_position)
    {
        if( update && !t_center ) [t_center, t_position] = this._rangeAnchor();

        t_position = Math.min(Math.max(t_position, 0.0), 1.0);

        this.activeRange.timeRangeHours = hours;
        this.activeRange.timeRangeMinutes = minutes;

        this.setStepSize(!update);

        for( let i of this.ui.rangeSelector ) if( i ) i.value = selected;

        if( update ) {

            const _unit = hours ? "hour" : "minute", _length = hours || minutes;
            const t1 = moment(t_center).add(_length * (1.0 - t_position), _unit);
            this._setWindow(moment(t1).subtract(_length, _unit), t1);

            this.applyTimeAxes();

            this.updateHistory();

        }
    }

    // Applies the current time window and tick step to graph g's time axis, and redraws it —
    // the only place a graph's time axis is set (a time range set applies it: setStepSize)
    applyTimeAxis(g)
    {
        // (linked graphs keep their time aligned: when one of them has a right Y axis, the
        // others keep the room of one — Chart.js hecRightAxisRoom)
        const _hasRight = x => x.chart.options.scales.yAxes.some(a => a.id === RIGHT_Y_AXIS);
        g.chart.options.hecRightAxisRoom = g.groupId != null && this.graphs.some(x => x !== g && x.groupId === g.groupId && _hasRight(x));
        const _time = g.chart.options.scales.xAxes[0].time;
        _time.unit = this.activeRange.tickStepUnit;
        _time.stepSize = this.activeRange.tickStepSize;
        _time.min = this.startTime;
        _time.max = this.endTime;
        const _t = performance.now();
        this.redrawChart(g);
        perf.add('chart', performance.now() - _t, { graph: this.graphs.indexOf(g) });
    }

    applyTimeAxes()
    {
        for( let g of this.graphs ) this.applyTimeAxis(g);
    }

    // The time range `range` in its one form (see normalizeOptions): a number and its unit
    // — m, h, d, w, o (months), y
    setTimeRangeFromString(range, update = false, t_center = null)
    {
        const s = range.slice(0, -1);

        // (in minutes — a month 30 days, a year 365 —, at most the longest range; an hour or
        // more: the shortest range at least that long — validateRange)
        const _minutes = { m: 1, h: 60, d: 24*60, w: 7*24*60, o: 30*24*60, y: YEAR_HOURS*60 }[range.slice(-1)[0]] ?? 0;
        const t = Math.min(Math.max(s*1, 0) * _minutes, MAX_RANGE_YEARS*YEAR_HOURS*60);

        const h = Math.floor(t / 60);

        if( h > 0 )
            this.applyTimeRange(this.validateRange(h), update, t_center);
        else
            this.applyTimeRangeMinutes(t, update, t_center);
    }

    // Moves the time window (same length) to start at t0, then redraws, what it newly shows
    // asked (whatever is loading)
    moveTimeWindow(t0)
    {
        this._setWindow(t0, moment(t0).add(this.activeRange.timeRangeHours, "hour").add(this.activeRange.timeRangeMinutes, "minute"));
        this.updateHistory(true);
    }

    // Length of the time window, in seconds
    timeRangeSeconds()
    {
        return 3600.0 * this.activeRange.timeRangeHours + 60.0 * this.activeRange.timeRangeMinutes;
    }

    factorToTimecode(f)
    {
        return moment(this.startTime) + moment(this.endTime).diff(this.startTime) * f;
    }

    // The elastic box's time (the magnifier's, or a mouse's drag mostly
    // vertical), between factor0 and factor1 along the time axis: the time range becomes
    // the first of TIME_RANGES covering it — under an hour, its minutes —, centred on it
    zoomToSelection(_factor0, _factor1)
    {
        let st0 = this.factorToTimecode(_factor0);
        let st1 = this.factorToTimecode(_factor1);
        if( st1 < st0 ) [st1, st0] = [st0, st1];

        const tm = (moment(st1) + moment(st0)) / 2;
        const dt = moment.duration(st1 - st0).asMinutes();

        if( dt < 60 ) this.applyTimeRangeMinutes(Math.ceil(dt), true, tm);
        else {
            const _covering = TIME_RANGES.filter(r => r.hours > 0 && r.hours * 60 >= dt);
            this.applyTimeRange(( _covering[0] ?? TIME_RANGES[TIME_RANGES.length - 1] ).hours, true, tm);
        }

        this.writeLocalState();
    }
}
