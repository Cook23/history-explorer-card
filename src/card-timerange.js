// The time window shown: its range (from the selector, a string, minutes), its moves (a
// day back or forward, today, zoom steps) and the time axis of each graph (ticks, step size,
// the room kept on the right for linked graphs). Part of HistoryCardState (added to it in
// history-explorer-card.js).

import { RIGHT_Y_AXIS } from "./card-charts.js";
const moment = window.HXLocal_moment;

// Valid time ranges in hours
const ranges = [1, 2, 6, 12, 24, 48, 72, 96, 120, 144, 168, 336, 504, 720, 2184, 4368, 8760];
// A window ending this close to the present shows it (its end is set to the second)
const PRESENT_MS = 1000;

export class CardTimeRange
{
    // --------------------------------------------------------------------------------------
    // Moving the time window
    // --------------------------------------------------------------------------------------

    today(resetRange = false)
    {
        if( resetRange )
            this.setTimeRangeFromString(this.pconfig.defaultTimeRange);

        this.setPresentWindow();
        this.updateHistory();
    }

    // The present, as the window shows it: now, moved by defaultTimeOffset (an empty space
    // after now, or the end of the hour, the day…) — no window goes past it
    presentTime()
    {
        let endTime = moment();
        if( this.pconfig.defaultTimeOffset ) {
            const s = this.pconfig.defaultTimeOffset.slice(0, -1);
            switch( this.pconfig.defaultTimeOffset.slice(-1)[0] ) {
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

    // The time window ending at the present (presentTime), over the active range — real
    // time; set before the graphs are first built, so their time axis has it from the start
    setPresentWindow()
    {
        this.endTime = this.presentTime().format('YYYY-MM-DDTHH:mm:ss');
        this.startTime = moment(this.endTime).subtract(this.activeRange.timeRangeHours, "hour").subtract(this.activeRange.timeRangeMinutes, "minute").format('YYYY-MM-DDTHH:mm:ss');
        this._settleWindow();
    }

    // Every window set (a range, a zoom, a drag, a day before or after, the calendar, the
    // present): never past the present — moved back to end there, whatever asked it —, and
    // real time exactly when it ends there (the present on the right, the window following
    // it as new values come); else the history, the window staying where it is. The toolbar
    // shows it ('>' greyed in real time: there's nothing after)
    _settleWindow()
    {
        const _present = this.presentTime(), _over = moment(this.endTime).diff(_present);
        if( _over > 0 ) {
            this.startTime = moment(this.startTime).subtract(_over, 'ms').format('YYYY-MM-DDTHH:mm:ss');
            this.endTime = _present.format('YYYY-MM-DDTHH:mm:ss');
        }
        this.state.autoScroll = moment(this.endTime).diff(_present) > -PRESENT_MS;
        this.showRealTime();
    }

    todayNoReset()
    {
        this.today(false);
    }

    todayReset()
    {
        this.today(true);
    }

    // The window starting at the start of day (YYYY-MM-DD, the calendar — openCalendar), as
    // the toolbar's date shows it, the range kept; reaching the present, real time
    showDay(day)
    {
        if( !day ) return;
        const t0 = moment(day).startOf('day');
        if( moment(t0).add(this.timeRangeSeconds(), 'second') >= this.presentTime() ) return this.todayNoReset();
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

    subDay()
    {
        if( this.activeRange.timeRangeHours < 24 ) this.applyTimeRange(24, false);

        let t0 = moment(this.startTime).subtract(1, ( this.activeRange.timeRangeHours < 720 ) ? "day" : "month");
        let t1 = moment(t0).add(this.activeRange.timeRangeHours, "hour");
        this.startTime = t0.format("YYYY-MM-DD") + "T00:00:00";
        this.endTime = t1.format("YYYY-MM-DD") + "T00:00:00";
        this._settleWindow();

        this.updateHistory();
    }

    addDay()
    {
        if( this.activeRange.timeRangeHours < 24 ) this.applyTimeRange(24, false);

        let t0 = moment(this.startTime).add(1, ( this.activeRange.timeRangeHours < 720 ) ? "day" : "month");
        let t1 = moment(t0).add(this.activeRange.timeRangeHours, "hour");
        this.startTime = t0.format("YYYY-MM-DD") + "T00:00:00";
        this.endTime = t1.format("YYYY-MM-DD") + "T00:00:00";
        this._settleWindow();

        this.updateHistory();
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
        for( const b of this.ui.zoomButton ) {
            const _p = b?.querySelector('path');
            if( _p ) _p.setAttribute('fill', on ? 'var(--success-color, #4caf50)' : 'var(--primary-text-color)');
        }
        // (redrawn: a finger's drag is the box's in the mode — the canvas' touch-action)
        for( const g of this.graphs )
            if( g.chart ) { g.chart.options.zoomSelectMode = on; g.chart.render({ duration: 0, lazy: true }); }
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

    // Is the window showing the present, following it (real time) — rather than the history?
    isLive()
    {
        return !!this.state.autoScroll && moment() >= moment(this.startTime);
    }

    // Where a range change without a point of its own keeps the window: [time, position
    // along it] — the present in real time: it stays on the right; its middle when looking
    // at the history. The one rule of every range change (applyTimeRange,
    // applyTimeRangeMinutes): the buttons, the duration menu, the magnifier's default range,
    // a zoom gesture in real time keeping the present (onTimeZoom)
    _rangeAnchor()
    {
        return this.isLive() ? [this.presentTime(), 1.0] : [moment((moment(this.startTime) + moment(this.endTime)) / 2), 0.5];
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
        const densities = { 'low' : 4, 'medium' : 3, 'high' : 2, 'higher' : 1, 'highest' : 0 };
        let densityLimit = densities[this.pconfig.timeTickDensity];
        if( densityLimit === undefined ) densityLimit = 2;
        if( this.pconfig.timeTickOverride === undefined )
            return Math.max(( width < 650 ) ? 4 : ( width < 1100 ) ? 3 : ( width < 1300 ) ? 2 : ( width < 1900 ) ? 1 : 0, densityLimit);
        else
            return densities[this.pconfig.timeTickOverride] ?? 2;
    }

    setStepSize(update = false, tbw = null)
    {
        const width = this.cardWidth();
        const _tbw = tbw ?? (this._this.querySelector('#tb_0')?.clientWidth || width);

        const tdensity = this.computeTickDensity(width);

        if( this.activeRange.timeRangeHours ) {

            const range = this.activeRange.timeRangeHours;

            const stepSizes = [];
            stepSizes.push({ '1': '2m', '2': '5m', '3': '5m', '4': '5m', '5': '5m', '6': '10m', '7': '10m', '8': '10m', '9': '10m', '10': '15m', '11': '15m', '12': '15m', '24': '30m', '48': '1h', '72': '2h', '96': '2h', '120': '3h', '144': '3h', '168': '6h', '336': '12h', '504': '12h', '720': '1d', '2184': '1o', '4368': '1o', '8760': '1o' });
            stepSizes.push({ '1': '2m', '2': '5m', '3': '10m', '4': '10m', '5': '10m', '6': '15m', '7': '15m', '8': '20m', '9': '20m', '10': '30m', '11': '30m', '12': '30m', '24': '1h', '48': '2h', '72': '3h', '96': '3h', '120': '6h', '144': '6h', '168': '12h', '336': '1d', '504': '1d', '720': '1d', '2184': '1o', '4368': '1o', '8760': '1o' });
            stepSizes.push({ '1': '5m', '2': '10m', '3': '15m', '4': '30m', '5': '30m', '6': '30m', '7': '30m', '8': '30m', '9': '30m', '10': '1h', '11': '1h', '12': '1h', '24': '2h', '48': '4h', '72': '6h', '96': '6h', '120': '12h', '144': '12h', '168': '12h', '336': '1d', '504': '2d', '720': '2d', '2184': '1o', '4368': '1o', '8760': '1o' });
            stepSizes.push({ '1': '10m', '2': '20m', '3': '30m', '4': '1h', '5': '1h', '6': '1h', '7': '1h', '8': '1h', '9': '1h', '10': '2h', '11': '2h', '12': '2h', '24': '4h', '48': '8h', '72': '12h', '96': '1d', '120': '1d', '144': '1d', '168': '2d', '336': '3d', '504': '4d', '720': '7d', '2184': '1o', '4368': '1o', '8760': '1o' });
            stepSizes.push({ '1': '20m', '2': '30m', '3': '1h', '4': '2h', '5': '2h', '6': '2h', '7': '2h', '8': '2h', '9': '2h', '10': '4h', '11': '4h', '12': '4h', '24': '6h', '48': '12h', '72': '1d', '96': '2d', '120': '2d', '144': '2d', '168': '4d', '336': '7d', '504': '7d', '720': '14d', '2184': '1o', '4368': '1o', '8760': '1o' });

            this.activeRange.tickStepSize = stepSizes[tdensity][range].slice(0, -1);
            switch( stepSizes[tdensity][range].slice(-1)[0] ) {
                case 'm': this.activeRange.tickStepUnit = 'minute'; break;
                case 'h': this.activeRange.tickStepUnit = 'hour'; break;
                case 'd': this.activeRange.tickStepUnit = 'day';  break;
                case 'o': this.activeRange.tickStepUnit = 'month';  break;
            }
            // Compact: 1 year on narrow card → 2 months step
            if( range === 8760 && _tbw < 300 ) {
                this.activeRange.tickStepSize = 2;
                this.activeRange.tickStepUnit = 'month';
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

    // --------------------------------------------------------------------------------------
    // Activate a given time range
    // --------------------------------------------------------------------------------------

    validateRange(range, hidden = false)
    {
        if( hidden && range < 12 && range > 0 ) return range;
        let i = ranges.findIndex(e => e >= range);
        if( i < ranges.length-1 && (i < 0 || ranges[i] != range) ) i++;
        return ranges[i];
    }

    // The time range set — from the toolbar, a gesture, the saved state (card-storage.js),
    // whatever is loading: a change asked is always applied, never dropped (the last one to
    // speak wins; the loading follows the window shown). update: the window changed too — around t_center, at
    // t_position along it, else where _rangeAnchor keeps it
    applyTimeRange(range, update, t_center = null, t_position = 0.5)
    {
        if( update && !t_center ) [t_center, t_position] = this._rangeAnchor();

        t_position = Math.min(Math.max(t_position, 0.0), 1.0);

        range = Math.max(range, 1);

        this.activeRange.timeRangeHours = range;
        this.activeRange.timeRangeMinutes = 0;

        this.setStepSize(!update, this._this.querySelector('#tb_0')?.clientWidth || null);

        for( let i of this.ui.rangeSelector ) if( i ) i.value = range;

        if( update ) {

            let t1 = moment(t_center).add(this.activeRange.timeRangeHours * (1.0 - t_position), "hour");
            let t0 = moment(t1).subtract(this.activeRange.timeRangeHours, "hour");
            this.startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
            this.endTime = t1.format("YYYY-MM-DDTHH:mm:ss");
            this._settleWindow();

            this.applyTimeAxes();

            this.updateHistory();

        }
    }

    // Applies the current time window and tick step to graph g's time axis, and redraws it —
    // the only place a graph's time axis is set (a time range set applies it: setStepSize)
    applyTimeAxis(g)
    {
        // (linked graphs keep their time aligned: when one of them has a right Y axis, the
        // others keep the same room on the right)
        const _hasRight = x => x.chart.options.scales.yAxes.some(a => a.id === RIGHT_Y_AXIS);
        const _room = !_hasRight(g) && g.groupId != null && this.graphs.some(x => x.groupId === g.groupId && _hasRight(x));
        g.chart.options.layout.padding.right = _room ? this.pconfig.labelAreaWidth : 0;
        const _time = g.chart.options.scales.xAxes[0].time;
        _time.unit = this.activeRange.tickStepUnit;
        _time.stepSize = this.activeRange.tickStepSize;
        _time.min = this.startTime;
        _time.max = this.endTime;
        const _t = performance.now();
        g.chart.update();
        this.perf?.add('chart', performance.now() - _t);
    }

    applyTimeAxes()
    {
        for( let g of this.graphs ) this.applyTimeAxis(g);
    }

    // (as applyTimeRange)
    applyTimeRangeMinutes(range, update, t_center = null, t_position = 0.5)
    {
        if( update && !t_center ) [t_center, t_position] = this._rangeAnchor();

        t_position = Math.min(Math.max(t_position, 0.0), 1.0);

        range = Math.max(range, 1);

        this.activeRange.timeRangeHours = 0;
        this.activeRange.timeRangeMinutes = range;

        this.setStepSize(!update, this._this.querySelector('#tb_0')?.clientWidth || null);

        for( let i of this.ui.rangeSelector ) if( i ) i.value = "0";

        if( update ) {

            let t1 = moment(t_center).add(this.activeRange.timeRangeMinutes * (1.0 - t_position), "minute");
            let t0 = moment(t1).subtract(this.activeRange.timeRangeMinutes, "minute");
            this.startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
            this.endTime = t1.format("YYYY-MM-DDTHH:mm:ss");
            this._settleWindow();

            this.applyTimeAxes();

            this.updateHistory();

        }
    }

    // The time range `range` in its one form (see normalizeOptions): a number and its unit
    // — m, h, d, w, o (months), y
    setTimeRangeFromString(range, update = false, t_center = null)
    {
        const s = range.slice(0, -1);

        let t = 0;
        switch( range.slice(-1)[0] ) {
            case 'm': t = s*1; break;
            case 'h': t = s*60; break;
            case 'd': t = ( s <= 7 ) ? s*24*60 : ( s <= 14 ) ? 14*24*60 : ( s <= 21 ) ? 21*24*60 : 30*24*60; break;
            case 'w': t = ( s <= 3 ) ? s*7*24*60 : 30*24*60; break;
            case 'o': t = ( s <= 1 ) ? 30*24*60 : ( s <= 3 ) ? 91*24*60 : ( s <= 6 ) ? 182*24*60 : 365*24*60; break;
            case 'y': t = 365*24*60; break;
        }

        const h = Math.floor(t / 60);

        if( h > 0 )
            this.applyTimeRange(this.validateRange(h, true), update, t_center);
        else
            this.applyTimeRangeMinutes(t, update, t_center);
    }

    // Moves the time window (same length) to start at t0, then redraws, what it newly shows
    // asked (whatever is loading)
    moveTimeWindow(t0)
    {
        const t1 = moment(t0).add(this.activeRange.timeRangeHours, "hour").add(this.activeRange.timeRangeMinutes, "minute");
        this.startTime = moment(t0).format("YYYY-MM-DDTHH:mm:ss");
        this.endTime = t1.format("YYYY-MM-DDTHH:mm:ss");
        this._settleWindow();
        this.updateHistory();
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
    // the nearest preset covering it, centred on it
    zoomToSelection(_factor0, _factor1)
    {
        let st0 = this.factorToTimecode(_factor0);
        let st1 = this.factorToTimecode(_factor1);
        if( st1 < st0 ) [st1, st0] = [st0, st1];

        const tm = (moment(st1) + moment(st0)) / 2;

        // Time delta in minutes
        const dt = moment.duration(st1 - st0).asMinutes();

        // Time delta in hours, ceiled
        let d = ( dt >= 60.0 ) ? Math.ceil(dt / 60.0) : 0;

        if( d < 12 ) {

            if( d < 1 )
                this.applyTimeRangeMinutes(Math.ceil(dt), true, tm);
            else
                this.applyTimeRange(d, true, tm);

        } else {

            d = Math.ceil(d / 24.0);

            if( d < 1 ) this.applyTimeRange(12, true, tm); else       // 12 hours
            if( d < 2 ) this.applyTimeRange(24, true, tm); else       // 1 day
            if( d < 3 ) this.applyTimeRange(48, true, tm); else       // 2 days
            if( d < 4 ) this.applyTimeRange(72, true, tm); else       // 3 days
            if( d < 5 ) this.applyTimeRange(96, true, tm); else       // 4 days
            if( d < 6 ) this.applyTimeRange(120, true, tm); else      // 5 days
            if( d < 7 ) this.applyTimeRange(144, true, tm); else      // 6 days
            if( d < 13 ) this.applyTimeRange(168, true, tm); else     // 1 week
            if( d < 20 ) this.applyTimeRange(336, true, tm); else     // 2 weeks
            if( d < 28 ) this.applyTimeRange(504, true, tm); else     // 3 weeks
            if( d < 45 ) this.applyTimeRange(720, true, tm); else     // 1 month
            if( d < 105 ) this.applyTimeRange(2184, true, tm); else   // 3 months
                          this.applyTimeRange(4368, true, tm);        // 6 months

        }

        this.writeLocalState();
    }
}
