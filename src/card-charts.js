// One graph for Chart.js — the card's side of its contract (deps/Chart Custom.js.md): its
// chart made (options, axes, legend, tooltip), its datasets made from its entities (two Y
// axes, SI conversion) and changed (line mode, interpolation, points, hidden, the legend's
// value), its text and controls sized as the card's width says. Part of HistoryCardState
// (added to it in history-explorer-card.js).

import { i18n } from "./languages.js";
import { getSIFactor, areSICompatible, chooseSIUnit } from "./history-units.js";
import { normalizeLineMode } from "./history-options.js";
import { parseColor } from "./history-default-colors.js";
const Chart = window.HXLocal_Chart;
const moment = window.HXLocal_moment;

// The Y axes of a line or bar graph: on the left (Chart.js's own first Y axis), and on the
// right for a second group of units (see _assignYAxes)
export const LEFT_Y_AXIS = 'y-axis-0';
export const RIGHT_Y_AXIS = 'y-axis-1';
// A card narrower than this (px) is narrow: its graphs' Y labels inside their plot (see
// _yLabelsInside), their text a little smaller (NARROW_FONT_PX)
export const NARROW_CARD_PX = 300;
// Where a bar graph's interval selector is: this far from the graph's right edge (px)
export const INTERVAL_SELECTOR_RIGHT_PX = 40;
// The graphs' text, in px: Chart.js's own (12), a timeline's states (13); on a narrow card,
// a little smaller; the Y labels drawn inside the plot at mini-graph-card's size, its
// labels' calc(.15em + 8.5px) of its 14 px — see _textSizes
const FONT_PX = 12, TIMELINE_FONT_PX = 13, NARROW_FONT_PX = 11, INSIDE_Y_LABEL_FONT_PX = 10.5;

export class CardCharts
{

    // A curve's legend label, as distinct parts Chart.js lays out (legend.labels): its name
    // (dataset.label — what's shortened, struck through when hidden, clicked to hide it),
    // its value now ('(400 W)', showCurrentValues — clicked to open its entity's dialog)
    // and a small arrow when it's on the right Y axis
    _legendParts(d)
    {
        return { label: d.name, hecLegendValue: this.pconfig.showCurrentValues ? this._legendValue(d.entity_id, d.unit, d.shownScale) : '',
                 hecLegendMark: d.yAxisID === RIGHT_Y_AXIS ? '▸' : '' };
    }

    // An entity's value now, in its unit, as the legend shows it after its name: '(400 W)' —
    // '' when it isn't a number
    _legendValue(entity, unit, shownScale = 1)
    {
        const p = 10 ** this.pconfig.roundingPrecision;
        const v = Math.round(this.stateOf(entity)?.state * shownScale * p) / p;
        return isNaN(v) ? '' : '(' + v + (unit ? ' ' + unit : '') + ')';
    }

    generateTooltipContents(label, d, mode, n = 1)
    {
        if( this.pconfig.tooltipShowDuration ) {
            let s = "";
            let duration = moment(d[1]).diff(moment(d[0]));
            if( duration >= 24*60*60*1000 ) {
                const days = Math.floor(duration / (24*60*60*1000));
                duration -= days * 24*60*60*1000;
                s = ( days > 1 ) ? `${i18n('ui.ranges.n_days', days)}, ` : `${i18n('ui.ranges.day')}, `;
            }
            s += moment.utc(duration).format('HH:mm:ss');
            label = `${label}  (for ${s})`;
        }

        if( mode == 'compact' || mode == 'slim' || ( mode == 'auto' && n < 2 ) )
            return [label, moment(d[0]).format(this.i18n.styleDateTimeTooltip) + " -- " + moment(d[1]).format(this.i18n.styleDateTimeTooltip)];
        else
            return [label, moment(d[0]).format(this.i18n.styleDateTimeTooltip), moment(d[1]).format(this.i18n.styleDateTimeTooltip)];
    }

    newGraph(canvas, graphtype, datasets, config)
    {
        // Any dataset drawn as a curve / as bars (a bar graph can hold both)
        const _hasCurves = ( graphtype == 'line' ) || ( graphtype == 'bar' && datasets.some(d => d.kind === 'line') );
        const _hasBars   = graphtype == 'bar' && datasets.some(d => d.kind === 'bar');

        const _yAxis = id => this._chartYAxis(id, graphtype, datasets, config, _hasCurves && !_hasBars);

        var chart = new Chart(canvas, {

            type: graphtype,

            data: this._chartData(graphtype, datasets, config),

            options: {
                // Static (YAML) graphs have draggable legend/timeline labels too: their
                // curves can be split (double-click) and dropped onto another graph — see
                // _dropCompatibility.
                cursorEnabled: true,
                // Chart.js's floating tooltips stay within the card (see Chart.hecUi.clampToViewport)
                floatingBoundsSelector: '#maincard',
                // A drag only reaches this card's own graphs (Chart.js dragScope), not those
                // of another card on the same page
                dragScope: this._dragScope ??= 'hec-' + Math.random().toString(36).slice(2),
                // Gestures (deps/Chart Custom.js.md): Chart.js detects them all and says
                // where they happen; the card decides what they mean. The time axis, shared
                // by every graph, is moved through panX/zoomX; everything else — labels,
                // graphs, menus — arrives as customEvent gestures (onGesture).
                panX: (info) => this.onTimePan(info),
                zoomX: (info) => this.onTimeZoom(info),
                zoomSelectMode: this.state.zoomMode,
                legendClickEnabled: false,
                // ylock: the Y axis can't be moved nor zoomed by hand (the padlock still works)
                yAxisPanEnabled: !config?.ylock,
                zoomYEnabled: !config?.ylock,
                customEvent: (info) => this.onGesture(info),
                scales: {
                    xAxes: [{
                        type: ( graphtype == 'line' || graphtype == 'bar' ) ? 'time' : ( graphtype == 'arrowline' ) ? 'arrowline' : 'timeline',
                        // (half a bar of margin at both ends only when there are bars to show)
                        offset: ( graphtype == 'bar' ) ? _hasBars : undefined,
                        time: {
                            // (the time window from the start: without it, the axis would
                            // span the data first, ticked every few minutes — thousands of
                            // labels over each other until the window is set)
                            min: this.startTime,
                            max: this.endTime,
                            unit: this.activeRange.tickStepUnit,
                            stepSize: this.activeRange.tickStepSize,
                            displayFormats: { 'minute': this.i18n.styleTimeTicks, 'hour': this.i18n.styleTimeTicks, 'day': this.i18n.styleDateTicks, 'month': 'MMM' },
                            tooltipFormat: this.i18n.styleDateTimeTooltip,
                        },
                        ticks: {
                            fontColor: ( config?.showTimeLabels === false ) ? 'rgba(0,0,0,0)' : this.pconfig.graphLabelColor,
                            fontSize: this._textSizes().text,
                            major: {
                                enabled: true,
                                unit: 'day',
                                fontStyle: 'bold',
                                unitStepSize: 1,
                                displayFormats: { 'day': this.i18n.styleDateTicks },
                            },
                            maxRotation: 0,
                            // (labels that don't fit side by side — a narrow plot — skipped,
                            // never drawn over each other)
                            autoSkip: true,
                            autoSkipPadding: 8
                        },
                        gridLines: {
                            color: ( config?.showGrid === false ) ? 'rgba(0,0,0,0)' : this.pconfig.graphGridColor
                        },
                        stacked: config?.stacked
                    }],
                    yAxes: [_yAxis(LEFT_Y_AXIS), ...( datasets.some(d => d.yAxisID === RIGHT_Y_AXIS) ? [_yAxis(RIGHT_Y_AXIS)] : [] )],
                },
                topClipMargin : 4,
                bottomClipMargin: 4,
                // (a timeline's or an arrowline's room for the handle, above its rows — none on a
                // narrow card, where it's in a box over them: _controlsBackdrop)
                layout: {
                    padding: {
                        top: this._controlsRoom(graphtype)
                    }
                },
                hecControlsBackdrop: this._controlsBackdrop(),
                animation: {
                    duration: 0
                },
                tooltips: this._chartTooltips(graphtype, datasets, _hasCurves),
                hover: {
                    // (mixed bar/line graph: see the hecMixed mode in deps/Chart.js)
                    mode: ( _hasCurves && _hasBars ) ? 'hecMixed' : 'nearest',
                    intersect: !_hasCurves,
                    // The tooltip opens on a contact (click, tap) on the plot area; a hover
                    // move — mouse, or a pen above the screen — then moves it, until the
                    // pointer leaves the plot area or the canvas (activateOnContact, see
                    // Chart.Controller.handleEvent in Chart.js). The hit-test only ever
                    // re-runs on a real contact or on a pointer move of at least 4px since
                    // the last one that found something, never as a side effect of the
                    // chart's own data refreshing under a still pointer.
                    hoverEnabled: true,
                    activateOnContact: true,
                    // (outside the tooltip mode, a hover on a value shows its dot)
                    dotOnHover: true,
                    // Default is 400ms — was likely relied on as a rough anti-flicker delay
                    // before handleEvent's own move-threshold existed; that threshold is now
                    // what actually prevents flicker, so this generic delay is just latency
                    // with no remaining purpose. Also governs hover style updates (point/line
                    // highlighting), not just the tooltip.
                    animationDuration: 0
                },
                legend: {
                    display: ( graphtype == 'line' || graphtype == 'bar' ) && this.pconfig.hideLegend != true,
                    labels: {
                        fontColor: this.pconfig.graphLabelColor,
                        usePointStyle: ( graphtype == 'line' || graphtype == 'bar' ),
                        boxWidth: 0,
                        fontSize: this._textSizes().text,
                        // (a label wider than the legend: shortened, its value kept)
                        hecShortNames: datasets => this.shortNameForms(datasets)
                    },
                },
                elements: {
                    textFunction: (text, datasets, index) => {
                        switch( this.pconfig.stateTextMode ) {
                          case 'auto' : return this.getLocalizedState(text, datasets[index].domain, datasets[index].device_class, datasets[index].entity_id);
                          case 'hide' : return '';
                          default: return text;
                        }
                    },
                    colorFunction: (text, data, datasets, index) => {
                        // * check device_class.state first (if it exists)
                        // * if not found, then check domain.state
                        // * if not found, check global state
                        return this.getStateColor(datasets[index].domain, datasets[index].device_class, datasets[index].entity_id, data[2]);
                    },
                    showText: true,
                    font: this._textSizes().timeline,
                    textPadding: 4
                },
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    // The cursor line (cursor.mode, cursor.types): on this graph, or on
                    // every graph of the card at once
                    hecCursorLine: {
                        show: this.pconfig.cursorMode !== 'hide' &&
                              ( this.pconfig.cursorTypes.includes('all') || this.pconfig.cursorTypes.includes(graphtype) ),
                        shared: this.pconfig.cursorMode === 'all',
                        color: this.pconfig.cursorLineColor
                    }
                }
            }

        });

        return chart;
    }

    // The datasets of a chart: a line or bar graph's curves and bars (each drawn on its Y
    // axis, stacked per axis), a timeline's or arrowline's rows
    _chartData(graphtype, datasets, config)
    {
        if( graphtype == 'line' || graphtype == 'bar' )
            return { datasets: datasets.map(d => this._curveDataset(d, graphtype, config)) };

        return {
            labels: datasets.map(d => this.pconfig.labelsVisible ? d.name : ''),
            datasets: datasets.map(d => ({
                domain: d.domain,
                device_class: d.device_class,
                entity_id: d.entity_id,
                unit: d.unit,
                name: d.name,
                arrowColor: d.bColor,
                arrowBackground: d.fillColor,
                arrowPeriod: d.arrowPeriod,
                data: [ ]
            }))
        };
    }

    // The samples' dots of a curve of line width `width`: the entity's showPoints, else the
    // graph's — true: a diameter of the line width + 2 px, as every dot shown by default
    // (Alt's too, see deps/chart-hec.js); a number: that radius. The hovered dot — the one
    // the tooltip shows — 2 px wider than the dots shown (than the default ones when none is)
    _pointRadii(own, graph, width)
    {
        const _v = own !== undefined ? own : graph;
        const _default = ( (+width || 0) + 2 ) / 2;
        const _radius = ( _v === undefined || _v === null || _v === false || _v === 0 ) ? 0 : _v === true ? _default : +_v;
        return { pointRadius: _radius, pointHoverRadius: ( _radius || _default ) + 1 };
    }

    // Whether entity i of graph g is drawn as a curve (not a bar, not a timeline's row)
    isCurve(g, i)
    {
        const _ds = g.chart.data.datasets[i];
        return !!_ds && !this.isRowGraph(g) && ( g.type === 'line' || _ds.type === 'line' );
    }

    // Whether every curve of graph g — of its entities given — shows its samples' dots
    // (none: undefined)
    curvesShowPoints(g, entities = g.entities)
    {
        if( this.isRowGraph(g) ) return undefined;
        const _idx = entities.map(e => g.entities.indexOf(e)).filter(i => this.isCurve(g, i));
        return _idx.length ? _idx.every(i => g.chart.data.datasets[i].pointRadius > 0) : undefined;
    }

    // Entity idx of graph g shown or hidden, the other way round (its dataset's hidden);
    // → whether it's hidden now
    toggleDatasetHidden(g, idx)
    {
        const _ds = g.chart.data.datasets[idx];
        _ds.hidden = !_ds.hidden;
        g.chart.update();
        return _ds.hidden;
    }

    // Entity i of graph g's legend label brought up to date (its value now)
    refreshLegendParts(g, i)
    {
        const d = g.chart.data.datasets[i];
        if( d ) Object.assign(d, this._legendParts(d));
    }

    // How a curve drawn in line mode `mode` bends
    _lineModeStyle(mode)
    {
        return { steppedLine: mode === 'stepped', lineTension: ( mode === 'lines' || mode === 'stepped' ) ? 0 : 0.1 };
    }

    // Entities indices of graph g drawn in lineMode, their type unchanged (their entries
    // keep it: the menu marks it next time, and it's saved with them)
    setLineMode(g, indices, lineMode)
    {
        const _mode = normalizeLineMode(lineMode);
        for( const i of indices ) {
            const _ds = g.chart.data.datasets[i];
            if( _ds ) Object.assign(_ds, this._lineModeStyle(_mode));
            if( g.entities[i] ) g.entities[i].lineMode = _mode;
        }
        g.chart.update();
    }

    // Entities of graph g drawn with the interpolation algorithm algo
    setCurvesInterpolation(g, entities, algo)
    {
        for( const e of entities ) {
            const _ds = g.chart.data.datasets[g.entities.indexOf(e)];
            if( _ds ) _ds.hecInterpolation = algo;
        }
        g.chart.update();
    }

    // The samples' dots of entities (curves) of graph g shown (show) or hidden
    showCurvePoints(g, entities, show)
    {
        for( const e of entities ) {
            const _ds = g.chart.data.datasets[g.entities.indexOf(e)];
            if( _ds ) Object.assign(_ds, this._pointRadii(show, undefined, _ds.borderWidth));
        }
        g.chart.update();
    }

    _curveDataset(d, graphtype, config)
    {
        const { pointRadius: _pointRadius, pointHoverRadius: _pointHoverRadius } = this._pointRadii(d.showPoints, config?.showPoints, d.width);
        const _dashes = { points: [1, 5], shortlines: [5, 5], longlines: [10, 8], pointline: [15, 3, 3, 3] };
        return {
            // A curve in a bar graph (mixed bar/line): drawn as a line, never stacked
            type: ( graphtype == 'bar' && d.kind === 'line' ) ? 'line' : undefined,
            hecNoStack: graphtype == 'bar' && d.kind === 'line',
            circularPeriod: d.circular,
            borderColor: d.bColor,
            backgroundColor: d.fillColor,
            // (fill: fade — its own color fading out downwards, see deps/chart-hec.js)
            hecFillFade: d.fillFade && d.kind === 'line',
            borderWidth: d.width,
            borderDash: Array.isArray(d.dashMode) ? d.dashMode : _dashes[d.dashMode],
            pointRadius: _pointRadius,
            pointStyle: 'circle',
            pointBackgroundColor: d.bColor,
            pointHoverRadius: _pointHoverRadius,
            hitRadius: 5,
            ...this._legendParts(d),
            yAxisID: d.yAxisID,
            // (stacked bars: those of each Y axis in their own column — stacking
            // values of two scales on each other would mean nothing)
            stack: d.yAxisID,
            name: d.name,
            cubicInterpolationMode: 'monotone',
            // (the curve interpolation algorithm, curves and smart modes — see deps/chart-hec.js)
            hecInterpolation: d.interpolation,
            ...this._lineModeStyle(d.mode),
            domain: d.domain,
            entity_id: d.entity_id,
            unit: d.unit,
            shownScale: d.shownScale,
            textFactor: d.shownScale / d.drawScale,
            hidden: d.hidden,
            showMinMax: d.showMinMax ? true : false,
            siConversionFactor: d.siConversionFactor,
            borderJoinStyle: 'round',
            borderCapStyle: 'round',
            data: { }
        };
    }

    // A Y axis, left or right (the right one only for a line or bar graph with a second
    // group of units — see _assignYAxes): the same bounds and step (ymin, ymax, ystepSize)
    // for both, its own unit and circular labels; the grid is the left axis'.
    // curvesOnly: a margin may be added below and above (axisAddMarginMin / Max)
    _chartYAxis(id, graphtype, datasets, config, curvesOnly)
    {
        // The curves of the axis (see _assignYAxes)
        const _list = datasets.filter(d => ( d.yAxisID ?? LEFT_Y_AXIS ) === id);
        // Its unit: its curves' (converted to one SI unit: see _applySIConversion) — none
        // when they have incompatible units: no single unit describes the axis then, the
        // legend and tooltip still show each entity's own
        const _unit = ( graphtype == 'line' || graphtype == 'bar' )
            ? ( _list.some(d => !areSICompatible(d.unit, _list[0].unit)) ? '' : ( _list[0]?.axisUnit ?? _list[0]?.unit ) )
            : undefined;
        // An axis of circular curves only, all of the same period: its labels show the real
        // values, in [0, period) (Chart.js ticks.period)
        const _p0 = _list[0]?.circular;
        const _period = ( _p0 && _list.every(d => d.circular === _p0 && ( d.siConversionFactor ?? 1 ) === 1) ) ? _p0 : undefined;
        const _right = id === RIGHT_Y_AXIS;
        // (the labels drawn inside the plot, which then takes the whole width: yLabels: inside,
        // or a narrow card — see _yLabelsInside; yLabelsMode, labelUnit: what fitToCardWidth reads)
        const _inside = this._yLabelsInside(config?.yLabels, graphtype);
        return {
            id,
            position: _right ? 'right' : 'left',
            yLabelsMode: config?.yLabels,
            labelUnit: _unit,
            afterFit: (scaleInstance) => {
                scaleInstance.width = scaleInstance.options.ticks.mirror ? 0 : this.pconfig.labelAreaWidth;
            },
            afterDataLimits: (me) => {
                const epsilon = 0.0001;
                if( config?.ymin == null && this.pconfig.axisAddMarginMin && curvesOnly ) me.min -= epsilon;
                if( config?.ymax == null && this.pconfig.axisAddMarginMax && curvesOnly ) me.max += epsilon;
            },
            ticks: {
                fontColor: this.pconfig.graphLabelColor,
                min: config?.ymin ?? undefined,
                max: config?.ymax ?? undefined,
                forceMin: config?.ymin ?? undefined,
                forceMax: config?.ymax ?? undefined,
                stepSize: config?.ystepSize ?? undefined,
                period: _period,
                ...this._yLabelTicks(_inside)
            },
            gridLines: {
                color: ( config?.showGrid !== false && ( graphtype == 'line' || graphtype == 'bar' || datasets.length > 1 ) ) ? this.pconfig.graphGridColor : 'rgba(0,0,0,0)',
                drawOnChartArea: !_right
            },
            scaleLabel: {
                display: !_inside && _unit !== undefined && _unit !== '',
                labelString: _unit,
                fontColor: this.pconfig.graphLabelColor
            },
            barThickness: this.pconfig.timelineBarHeight - 4,
            stacked: config?.stacked
        };
    }

    // Whether a graph's Y labels are drawn inside its plot: yLabels: inside; on a card
    // narrower than NARROW_CARD_PX too — the plot keeps its width there — unless yLabels:
    // outside. A curve's or a bar's axis only (a timeline's labels are its rows' names)
    _yLabelsInside(yLabels, graphtype)
    {
        if( yLabels === 'inside' ) return true;
        if( yLabels === 'outside' || !( graphtype == 'line' || graphtype == 'bar' ) ) return false;
        return this.narrowCard();
    }

    // Whether the card is narrower than NARROW_CARD_PX
    narrowCard()
    {
        return ( this._this?.querySelector('#maincard')?.clientWidth || Infinity ) < NARROW_CARD_PX;
    }

    // The size of the graphs' text, as the card's width says: text (the legend, the time
    // labels, a timeline's names), timeline (its states, a canvas font), yLabels(inside)
    _textSizes()
    {
        const _narrow = this.narrowCard();
        const _text = _narrow ? NARROW_FONT_PX : FONT_PX;
        return { text: _text,
                 timeline: `normal ${_narrow ? NARROW_FONT_PX : TIMELINE_FONT_PX}px "Helvetica Neue", Helvetica, Arial, sans-serif`,
                 yLabels: inside => inside ? INSIDE_Y_LABEL_FONT_PX : _text };
    }

    // The Y labels' ticks options, inside the plot — just above their grid line, so that the
    // lowest one keeps clear of the time labels, each in a box (Chart.js ticks.hecBackdrop:
    // its color and opacity are Chart.js's) — or beside it
    _yLabelTicks(inside)
    {
        return { mirror: inside, padding: inside ? -6 : 0, labelOffset: inside ? -7 : 0, fontSize: this._textSizes().yLabels(inside),
                 hecBackdrop: inside };
    }

    // The controls at a graph's top left (the handle, the padlock, the chain icon) on a
    // narrow card: each in a box like the Y labels', over the legend or the rows, taking no
    // room (Chart.js hecControlsBackdrop) — else false: beside the legend's first line, as
    // much room as they need (the Y axes' labels and units keep theirs)
    _controlsBackdrop()
    {
        return this.narrowCard();
    }

    // The room above a timeline's or an arrowline's rows for its handle (px): none on a
    // narrow card (_controlsBackdrop)
    _controlsRoom(graphtype)
    {
        return ( graphtype === 'timeline' || graphtype === 'arrowline' ) && !this.narrowCard() ? 24 : 0;
    }

    // Each graph's Y labels placed, its text sized and its controls laid out as the card's
    // width now says (_yLabelsInside, _textSizes, _controlsBackdrop) — when the card
    // crosses NARROW_CARD_PX
    fitToCardWidth()
    {
        const _sizes = this._textSizes();
        for( const g of this.graphs ) {
            const o = g.chart.options;
            let _changed = false;
            // (values set on an options object where they differ)
            const _set = (obj, values) => {
                if( obj ) for( const [k, v] of Object.entries(values) )
                    if( JSON.stringify(obj[k]) !== JSON.stringify(v) ) { obj[k] = v; _changed = true; }
            };
            for( const ax of o.scales?.yAxes ?? [] ) {
                const _inside = this._yLabelsInside(ax.yLabelsMode, g.chart.config.type);
                _set(ax.ticks, this._yLabelTicks(_inside));
                _set(ax.scaleLabel, { display: !_inside && ax.labelUnit !== undefined && ax.labelUnit !== '' });
            }
            for( const ax of o.scales?.xAxes ?? [] ) _set(ax.ticks, { fontSize: _sizes.text });
            _set(o, { hecControlsBackdrop: this._controlsBackdrop() });
            _set(o.layout?.padding, { top: this._controlsRoom(g.chart.config.type) });
            _set(o.legend?.labels, { fontSize: _sizes.text });
            _set(o.elements, { font: _sizes.timeline });
            if( _changed ) g.chart.update(0);
            // (the values over it laid out for that width too — see showValues)
            if( _changed && g.valueSamples ) this.showValues(g);
        }
    }

    // The tooltip of a chart: a curve's value in its unit (circular ones in [0, period)), a
    // timeline's state and its time span, an arrowline's value
    _chartTooltips(graphtype, datasets, hasCurves)
    {
        const tooltipSize = this.pconfig.tooltipSize;
        return {
            callbacks: {
                label: (item, data) => {
                    if( graphtype == 'line' || graphtype == 'bar' ) {
                        let label = '';
                        if( this.pconfig.tooltipShowLabel ) label = data.datasets[item.datasetIndex].name || '';
                        if( label ) label += ': ';
                        const p = 10 ** this.pconfig.roundingPrecision;
                        const _siFactor = data.datasets[item.datasetIndex].siConversionFactor ?? 1;
                        // (from the value drawn back to the value shown: see shownScale)
                        const _tf = data.datasets[item.datasetIndex].textFactor ?? 1;
                        const _circQ = data.datasets[item.datasetIndex].circularPeriod;
                        let _v = Math.round(item.yLabel / _siFactor * _tf * p) / p;
                        // (a circular curve shows its real value, in [0, period))
                        if( _circQ ) _v = Math.round(this.wrapCircular(_v, _circQ * Math.abs(_tf)) * p) / p;
                        label += _v;
                        label += ' ' + (data.datasets[item.datasetIndex].unit || '');
                        return label;
                    } else if( graphtype == 'timeline' ) {
                        const dataset = data.datasets[item.datasetIndex];
                        const d = dataset.data[item.index];
                        let label = d[2];
                        if( this.pconfig.tooltipStateTextMode == 'auto' )
                            label = this.getLocalizedState(label, dataset.domain, dataset.device_class, dataset.entity_id);
                        return this.generateTooltipContents(label, d, tooltipSize, datasets.length);
                    } else if( graphtype == 'arrowline' ) {
                        const d = data.datasets[item.datasetIndex].data[item.index];
                        const p = 10 ** this.pconfig.roundingPrecision;
                        let label = Math.round(d[2] * p) / p;
                        label += ' ' + (data.datasets[item.datasetIndex].unit || '');
                        return this.generateTooltipContents(label, d, 'slim');
                    }
                },
                title: function(tooltipItems, data) {
                    let title = '';
                    if( tooltipItems.length > 0 ) {
                        if( graphtype == 'line' || graphtype == 'bar' ) {
                            title = tooltipItems[0].xLabel;
                        } else {
                            title = ( tooltipSize !== 'slim' ) ? ( data.datasets[tooltipItems[0].datasetIndex]?.name ?? '' ) : '';
                        }
                    }
                    return title;
                }
            },
            yAlign: ( graphtype == 'line' || graphtype == 'bar' ) ? undefined : 'nocenter',
            caretPadding: 8,
            displayColors: hasCurves ? this.pconfig.showTooltipColors[0] : ( graphtype == 'timeline' ) ? this.pconfig.showTooltipColors[1] : false
        };
    }

    // The legend keeps clear of the buttons drawn over the graph's top right corner (bar
    // interval selector, close button) — Chart.js legend.rightMargin
    updateLegendMargins(g)
    {
        const _isStatic = g.isStatic;
        const _legend = g.chart.options.legend;
        if( g.type === 'bar' && !this.ui.hideInterval ) {
            // (from where the card puts the interval selector — not against the graph's right
            // edge: its left edge, a gap before it)
            _legend.rightMargin = Math.max(INTERVAL_SELECTOR_RIGHT_PX + this.intervalSelectorWidth() + 8, _isStatic ? 25 : 45);
        } else {
            // (nothing over a YAML graph's top right: no room kept there)
            _legend.rightMargin = _isStatic ? 4 : 45;
        }
    }

    // Each curve's Y axis (line and bar graphs): one per group of compatible units, at most
    // two — the first group on the left, the second on the right; beyond two, every curve
    // on one shared axis without a unit. `yAxis` (left, right — on the entity, its graph,
    // entityOptions or the card, see resolveYAxis) puts a curve on that side whatever its
    // unit: `left` on a whole graph keeps it on one axis.
    _assignYAxes(datasets, entities)
    {
        const _groups = [];
        for( const d of datasets ) if( !_groups.some(u => areSICompatible(u, d.unit)) ) _groups.push(d.unit);
        datasets.forEach((d, i) => {
            const _side = this.resolveYAxis(entities[i]);
            const _right = ( _side === 'right' || _side === 'left' ) ? _side === 'right' : _groups.length === 2 && !areSICompatible(d.unit, _groups[0]);
            d.yAxisID = _right ? RIGHT_Y_AXIS : LEFT_Y_AXIS;
        });
    }

    // The curves of one Y axis converted to one SI unit (W and kW: kW, from their values
    // now), when they all share one base unit and not all the same unit: each one's
    // siConversionFactor, and the axis' unit (axisUnit)
    _applySIConversion(list, entities)
    {
        const _units = list.map(d => d.unit);
        if( !_units.length || !_units.every(u => areSICompatible(u, _units[0])) || _units.every(u => u === _units[0]) ) return;
        const { unit: _refUnit, targetFactor: _targetFactor } = chooseSIUnit(list.map(d => ({
            unit: d.unit,
            maxVal: Math.abs(parseFloat(this.stateOf(d.entity_id)?.state) || 0)
        })));
        list.forEach((d, i) => {
            d.siConversionFactor = getSIFactor(d.unit).factor / _targetFactor;
            entities[i].siConversionFactor = d.siConversionFactor;
            d.axisUnit = _refUnit;
        });
    }

    addGraphToCanvas(gid, type, entities, config, isStatic = false)
    {
        const canvas = this._this.querySelector(`#graph${gid}`);

        // Needed before building the datasets: it decides how each bar entity is drawn
        const interval = config?._graphInterval ?? this.parseIntervalConfig(config?.interval) ?? 1;

        let datasets = [];
        for( let d of entities ) {
            const _kind = this.entityKind({ type, interval }, d);
            datasets.push({
                "kind": _kind,
                "name": ( d.name === undefined ) ? this.stateOf(d.entity)?.attributes?.friendly_name : d.name,
                "bColor": this.entityColor(d),
                // (a bar entity shown as a raw curve — interval 4 — isn't filled like a bar;
                // a bar is filled with its own color)
                "fillColor": ( d.type === 'bar' && _kind === 'line' ) ? 'rgba(0,0,0,0)' : ( d.fill === d.color ) ? this.entityColor(d) : parseColor(d.fill),
                "fillFade": d.fill === 'fade',
                "dashMode": d.dashMode,
                "mode": normalizeLineMode(d.lineMode) || this.pconfig.defaultLineMode,
                "interpolation": this.resolveInterpolation(d),
                "width": d.width || this.pconfig.defaultLineWidth,
                "showPoints": d.showPoints,
                "showMinMax": d.showMinMax,
                // (period of a circular entity in the units shown, before SI conversion)
                "circular": ( _kind === 'line' || _kind === 'bar' ) ? ( this.circularPeriodOf(d) ?? 0 ) * Math.abs(d.scale ?? 1) || null : null,
                // (an arrowline's values are angles: a full turn is the entity's circular
                // period, 360 when it has none)
                "arrowPeriod": ( _kind === 'arrowline' ) ? ( this.circularPeriodOf(d) ?? 360 ) : undefined,
                "unit": this.getUnitOfMeasure(d.entity, d.unit),
                // (the factor between the entity's value and the value shown in the legend and
                // tooltip: with its own `unit`, `scale` is a conversion and the converted value
                // is shown; without, it only changes how the curve is drawn and the entity's
                // real value is shown)
                "shownScale": ( d.unit !== undefined ) ? ( d.scale ?? 1 ) : 1,
                "drawScale": d.scale || 1,
                "domain": this.getDomainForEntity(d.entity),
                "device_class": this.getDeviceClass(d.entity),
                "hidden": d.hidden,
                "entity_id" : d.entity
            });
        }

        // The Y axes, and on each one, its curves converted to one SI unit
        if( type === 'line' || type === 'bar' ) {
            this._assignYAxes(datasets, entities);
            for( const id of [LEFT_Y_AXIS, RIGHT_Y_AXIS] ) {
                const _idx = datasets.map((d, i) => d.yAxisID === id ? i : -1).filter(i => i >= 0);
                this._applySIConversion(_idx.map(i => datasets[i]), _idx.map(i => entities[i]));
            }
        }

        const chart = this.newGraph(canvas, type, datasets, config);

        const h = config?._mixed ? this.calcGraphHeight('line', entities.length, config?.height) + 24 : this.calcGraphHeight(type, entities.length, config?.height);

        const g = { "id": gid, "type": type, "canvas": canvas, "graphHeight": h, "chart": chart , "entities": entities, "interval": interval, "ylock": config?.ylock ?? false, "showTimeLabels": config?.showTimeLabels, "isStatic": isStatic, "groupId": config?.groupId ?? null };

        this.graphs.push(g);
    }

    getStateColor(domain, device_class, entity_id, value)
    {
        let c;

        if( value === undefined || value === null || value === '' ) value = 'unknown';

        // entity_id.state override
        if( entity_id ) {
            const v = entity_id + '.' + value;
            c = this.pconfig.customStateColors?.[v];
            if( !c ) c = this.pconfig.customStateColors?.[entity_id];
        }

        // device_class.state override
        if( !c && device_class ) {
            const v = device_class + '.' + value;
            c = this.pconfig.customStateColors?.[v];
            if( !c ) c = this.pconfig.customStateColors?.[device_class];
        }

        // domain.state override
        if( !c && domain ) {
            const v = domain + '.' + value;
            c = this.pconfig.customStateColors?.[v];
            if( !c ) c = this.pconfig.customStateColors?.[domain];
        }

        // global state override
        if( !c ) {
            c = this.pconfig.customStateColors?.[value];
        }

        // device_class.state defaults
        if( !c && device_class ) {
            const v = device_class + '.' + value;
            c = (( this.ui.darkMode && this.stateColorsDark[v] ) ? this.stateColorsDark[v] : this.stateColors[v]);
        }

        // domain.state defaults
        if( !c && domain ) {
            const v = domain + '.' + value;
            c = (( this.ui.darkMode && this.stateColorsDark[v] ) ? this.stateColorsDark[v] : this.stateColors[v]);
        }

        // global state defaults
        if( !c ) {
            c = (( this.ui.darkMode && this.stateColorsDark[value] ) ? this.stateColorsDark[value] : this.stateColors[value]);
        }

        // general fallback if state color is not defined anywhere, generate color from the MD5 hash of the state name
        if( !c ) {
            if( !this.colorMap.has(value) ) {
                const md = md5hx(value);
                const h = ((md[0] & 0x7FFFFFFF) * this.pconfig.colorSeed) % 359;
                const s = Math.ceil(45.0 + (30.0 * (((md[1] & 0x7FFFFFFF) % 255) / 255.0))) - (this.ui.darkMode ? 13 : 0);
                const l = Math.ceil(55.0 + (10.0 * (((md[1] & 0x7FFFFFFF) % 255) / 255.0))) - (this.ui.darkMode ? 5 : 0);
                c = 'hsl(' + h +',' + s + '%,' + l + '%)';
                this.colorMap.set(value, c);
            } else
               c = this.colorMap.get(value);
        }

        return c;
    }

    getLocalizedState(state, domain, device_class, entity)
    {
        const s = entity + state;

        let v = this.stateTexts.get(s);
        if( !v ) {
            v = ( device_class && this._hass.localize(`component.${domain}.entity_component.${device_class}.state.${state}`) ) ||
                  this._hass.localize(`component.${domain}.entity_component._.state.${state}`) ||
                ( device_class && this._hass.localize(`component.${domain}.state.${device_class}.${state}`) ) ||
                  this._hass.localize(`component.${domain}.state._.${state}`) ||
                  state;
            this.stateTexts.set(s, v);
        }

        return v;
    }
}
