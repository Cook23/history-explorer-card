// The time window shown: its range (from the selector, a string, minutes), its moves (a
// day back or forward, today, zoom steps) and the time axis of each graph (ticks, step size,
// the room kept on the right for linked graphs). Part of HistoryCardState (added to it in
// history-explorer-card.js).

import { RIGHT_Y_AXIS } from "./card-graphs.js";
const moment = window.HXLocal_moment;

// Valid time ranges in hours
const ranges = [1, 2, 6, 12, 24, 48, 72, 96, 120, 144, 168, 336, 504, 720, 2184, 4368, 8760];

export class CardTimeRange
{
    // --------------------------------------------------------------------------------------
    // Moving the time window
    // --------------------------------------------------------------------------------------

    today(resetRange = false)
    {
        if( !this.state.loading ) {

            if( resetRange )
                this.setTimeRangeFromString(String(this.pconfig.defaultTimeRange));

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

            this.endTime = endTime.format('YYYY-MM-DDTHH:mm:ss');
            this.startTime = moment(this.endTime).subtract(this.activeRange.timeRangeHours, "hour").subtract(this.activeRange.timeRangeMinutes, "minute").format('YYYY-MM-DDTHH:mm:ss');

            this.updateHistory();

        }

        // Allow auto scroll if auto refresh is enabled
        this.state.autoScroll = true;
    }

    todayNoReset()
    {
        this.today(false);
    }

    todayReset()
    {
        this.today(true);
    }

    subDay()
    {
        if( !this.state.loading ) {

            if( this.activeRange.timeRangeHours < 24 ) this.setTimeRange(24, false);

            let t0 = moment(this.startTime).subtract(1, ( this.activeRange.timeRangeHours < 720 ) ? "day" : "month");
            let t1 = moment(t0).add(this.activeRange.timeRangeHours, "hour");
            this.startTime = t0.format("YYYY-MM-DD") + "T00:00:00";
            this.endTime = t1.format("YYYY-MM-DD") + "T00:00:00";

            this.updateHistory();

        }
    }

    addDay()
    {
        if( !this.state.loading ) {

            if( this.activeRange.timeRangeHours < 24 ) this.setTimeRange(24, false);

            let t0 = moment(this.startTime).add(1, ( this.activeRange.timeRangeHours < 720 ) ? "day" : "month");
            let t1 = moment(t0).add(this.activeRange.timeRangeHours, "hour");
            this.startTime = t0.format("YYYY-MM-DD") + "T00:00:00";
            this.endTime = t1.format("YYYY-MM-DD") + "T00:00:00";

            this.updateHistory();

        }
    }

    toggleZoom()
    {
        this.state.zoomMode = !this.state.zoomMode;

        for( let i of this.ui.zoomButton )
            if( i ) i.style.backgroundColor = this.state.zoomMode ? this.ui.darkMode ? '#ffffff3a' : '#0000003a' : '#0000';

        for( let g of this.graphs )
            if( g.chart ) g.chart.options.zoomSelectMode = this.state.zoomMode;
    }

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
        this.setTimeRange(event.target.value, true);
        this.writeLocalState();
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
                    this.setTimeRange(ranges[i+1], true, t_center, t_position);
            }

        } else

            this.setTimeRangeMinutes(this.activeRange.timeRangeMinutes, true, t_center, t_position);
    }

    incZoomStep(t_center = null, t_position = 0.5)
    {
        const i = ranges.findIndex(e => e >= this.activeRange.timeRangeHours);
        if( i > 0 )
            this.setTimeRange(ranges[i-1], true, t_center, t_position);
        else
            this.setTimeRangeMinutes((this.activeRange.timeRangeHours * 60 + this.activeRange.timeRangeMinutes) / 2, true, t_center, t_position);
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
        const width = this._this.querySelector('#maincard').clientWidth;
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
            for( let g of this.graphs ) {
                g.chart.options.scales.xAxes[0].time.unit = this.activeRange.tickStepUnit;
                g.chart.options.scales.xAxes[0].time.stepSize = this.activeRange.tickStepSize;
                g.chart.update();
            }
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

    setTimeRange(range, update, t_center = null, t_position = 0.5)
    {
        if( this.state.loading ) return;

        this.timeCache.clear();

        t_position = Math.min(Math.max(t_position, 0.0), 1.0);

        range = Math.max(range, 1);

        const dataClusterSizes = { '48': 2, '72': 5, '96': 10, '120': 30, '144': 30, '168': 60, '336': 60, '504': 120, '720': 240, '2184': 240, '4368': 240, '8760': 360 };
        const minute = 60000;

        this.activeRange.dataClusterSize = ( range >= 48 ) ? dataClusterSizes[range] * minute : 0;

        this.activeRange.timeRangeHours = range;
        this.activeRange.timeRangeMinutes = 0;

        this.setStepSize(!update, this._this.querySelector('#tb_0')?.clientWidth || null);

        for( let i of this.ui.rangeSelector ) if( i ) i.value = range;

        if( update ) {

            if( t_center ) {

                let t1 = moment(t_center).add(this.activeRange.timeRangeHours * (1.0 - t_position), "hour");
                let t0 = moment(t1).subtract(this.activeRange.timeRangeHours, "hour");
                this.startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
                this.endTime = t1.format("YYYY-MM-DDTHH:mm:ss");

            } else if( this.activeRange.timeRangeHours > 24 ) {

                let t1 = moment(this.endTime);
                let t0 = moment(t1).subtract(this.activeRange.timeRangeHours, "hour");
                this.startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
                this.endTime = t1.format("YYYY-MM-DDTHH:mm:ss");

            } else {

                let tm = (moment(this.endTime) + moment(this.startTime)) / 2;
                let t1 = moment(tm).add(this.activeRange.timeRangeHours / 2, "hour");
                let t0 = moment(t1).subtract(this.activeRange.timeRangeHours, "hour");
                this.startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
                this.endTime = t1.format("YYYY-MM-DDTHH:mm:ss");

            }

            this._applyTimeAxes();

            this.updateHistory();

        }
    }

    // Applies the current time window and tick step to a graph's time axis — or to every
    // graph's
    _applyTimeAxis(g)
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
        g.chart.update();
    }

    _applyTimeAxes()
    {
        for( let g of this.graphs ) this._applyTimeAxis(g);
    }

    setTimeRangeMinutes(range, update, t_center, t_position = 0.5)
    {
        if( this.state.loading ) return;

        t_position = Math.min(Math.max(t_position, 0.0), 1.0);

        range = Math.max(range, 1);

        this.activeRange.dataClusterSize = 0;

        this.activeRange.timeRangeHours = 0;
        this.activeRange.timeRangeMinutes = range;

        this.setStepSize(!update, this._this.querySelector('#tb_0')?.clientWidth || null);

        for( let i of this.ui.rangeSelector ) if( i ) i.value = "0";

        if( update ) {

            if( !t_center )
                t_center = (moment(this.startTime) + moment(this.endTime)) / 2;

            let t1 = moment(t_center).add(this.activeRange.timeRangeMinutes * (1.0 - t_position), "minute");
            let t0 = moment(t1).subtract(this.activeRange.timeRangeMinutes, "minute");
            this.startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
            this.endTime = t1.format("YYYY-MM-DDTHH:mm:ss");

            this._applyTimeAxes();

            this.updateHistory();

        }
    }

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
            default: t = range*60; break;
        }

        const h = Math.floor(t / 60);

        if( h > 0 )
            this.setTimeRange(this.validateRange(h, true), update, t_center);
        else
            this.setTimeRangeMinutes(t, update, t_center);
    }
}
