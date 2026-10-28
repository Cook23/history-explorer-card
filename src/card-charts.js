// One graph for Chart.js — the card's side of its contract (deps/Chart Custom.js.md): its
// chart made (options, axes, legend, tooltip), its datasets made from its entities (two Y
// axes, SI conversion) and changed (line mode, interpolation, points, hidden, the legend's
// value), its text and controls sized as the card's width says. Part of HistoryCardState
// (added to it in history-explorer-card.js).

import { i18n } from "./languages.js";
import { stateLabel } from "./history-options.js";
import { getSIFactor, areSICompatible, chooseSIUnit, formatNumber } from "./history-units.js";
import { fillValue } from "./history-default-colors.js";
const Chart = window.HXLocal_Chart;
const moment = window.HXLocal_moment;

// The Y axes of a line or bar graph: on the left (Chart.js's own first Y axis), and on the
// right for a second group of units (see _assignYAxes)
const LEFT_Y_AXIS = 'y-axis-0';
export const RIGHT_Y_AXIS = 'y-axis-1';
// A card narrower than this (px) is narrow: its graphs' Y labels inside their plot (see
// _yLabelsInside), their text a little smaller (NARROW_FONT_PX)
export const NARROW_CARD_PX = 300;

// A card narrower than this (px) is on a small screen — a phone, or a part of a screen no
// wider —: its curves' tooltip follows smallScreenTooltip, else largeScreenTooltip (see
// tooltipModeOf); the info panel is always on a small screen
const SMALL_SCREEN_PX = 600;
// Where a bar graph's interval selector is: this far from the graph's right edge (px)
// The graphs' text, in px: Chart.js's own (12), a timeline's states (13); on a narrow card,
// a little smaller; the Y labels drawn inside the plot at mini-graph-card's size, its
// labels' calc(.15em + 8.5px) of its 14 px — see _textSizes
const FONT_PX = 12, TIMELINE_FONT_PX = 13, NARROW_FONT_PX = 11, INSIDE_Y_LABEL_FONT_PX = 10.5;

export class CardCharts
{

    // A curve's legend label, as distinct parts Chart.js lays out (legend.labels): its name
    // (dataset.label — what's shortened, struck through when hidden, clicked to hide it),
    // its value now ('(400 W)', showCurrentValues: its own, else its graph's… — clicked to
    // open its entity's dialog)
    // and a small arrow when it's on the right Y axis
    _legendParts(d)
    {
        return { label: d.name, hecLegendValue: d.showCurrentValue !== false ? this._legendValue(d.entity_id, d.unit, d.shownScale, d.rounding, d.stateMap) : '',
                 hecLegendMark: d.yAxisID === RIGHT_Y_AXIS ? '▸' : '', hecLegendHidden: !!d.legendHidden };
    }

    // An entity's value now, in its unit, as the legend shows it after its name: '(400 W)' —
    // with a stateMap, its state's label; '' when it isn't a number
    _legendValue(entity, unit, shownScale = 1, rounding, stateMap)
    {
        if( stateMap?.length ) { const _l = stateLabel(stateMap, this.stateOf(entity)?.state); return _l === undefined ? '' : '(' + _l + ')'; }
        const v = Number(this.stateOf(entity)?.state) * shownScale;
        return isNaN(v) ? '' : '(' + formatNumber(v, rounding) + (unit ? ' ' + unit : '') + ')';
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
                // curveMoveRefusal.
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
                // (what the elastic box zooms: the magnifier's mode — setZoomBoxMode)
                zoomBoxAxes: this.state.zoomBox,
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
                        // (barSpacing — mini-graph-card's bar_spacing: the room between two
                        // bars, in px; Chart.js hecBarSpacing)
                        ...( graphtype == 'bar' && config?.barSpacing !== undefined ? { hecBarSpacing: config.barSpacing } : {} ),
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
                            fontColor: config.showTimeLabels ? this.pconfig.graphLabelColor : 'rgba(0,0,0,0)',
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
                            color: config.showGrid ? this.pconfig.graphGridColor : 'rgba(0,0,0,0)'
                        },
                        stacked: config?.stacked
                    }],
                    yAxes: [_yAxis(LEFT_Y_AXIS), ...( datasets.some(d => d.yAxisID === RIGHT_Y_AXIS) ? [_yAxis(RIGHT_Y_AXIS)] : [] )],
                },
                topClipMargin : 4,
                bottomClipMargin: 4,
                hecControlsBackdrop: this._controlsBackdrop(),
                animation: {
                    duration: 0
                },
                tooltips: this._chartTooltips(graphtype),
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
                    // No delay (Chart.js's default is 400ms): handleEvent's move-threshold is
                    // what prevents flicker, a delay would only add latency. Also governs hover
                    // style updates (point/line highlighting), not just the tooltip.
                    animationDuration: 0
                },
                legend: {
                    display: ( graphtype == 'line' || graphtype == 'bar' ) && this.pconfig.hideLegend != true &&
                             // (legendVisible: auto — only for several labels in it)
                             ( !this.pconfig.legendAuto || datasets.filter(d => !d.legendHidden).length > 1 ),
                    labels: {
                        fontColor: this.pconfig.graphLabelColor,
                        usePointStyle: ( graphtype == 'line' || graphtype == 'bar' ),
                        boxWidth: 0,
                        // (the room around each label: as little as keeps them apart — the
                        // curves keep the rest)
                        padding: 6,
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
                rounding: d.rounding,
                name: d.name,
                arrowColor: d.bColor,
                arrowBackground: d.fillColor,
                arrowPeriod: d.arrowPeriod,
                // (its row's tooltip, as a curve's: Chart.js hecTooltip)
                hecTooltip: d.tooltip,
                data: [ ]
            }))
        };
    }

    // The samples' dots of a curve of line width `width`: the entity's showPoints, else the
    // graph's — true: a diameter of the line width + 2 px, as every dot shown by default
    // (Alt's too, see deps/chart-hec.js); a number: that radius; hover (the default): only
    // the hovered dot — the one the tooltip shows, 2 px wider than the dots shown (than the
    // default ones when none is); false: none, not even the hovered one
    _pointRadii(own, graph, width)
    {
        const _v = own !== undefined ? own : graph;
        const _default = ( (+width || 0) + 2 ) / 2;
        if( _v === false ) return { pointRadius: 0, pointHoverRadius: 0 };
        const _radius = _v === true ? _default : ( +_v > 0 ? +_v : 0 );
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

    // Graph g's values now brought up to date after its entities `indices` changed: their
    // legend labels' ('(400 W)') and the values over the graph (showValues) — the graph
    // redrawn as it is, its curves not worked out again (the refresh does, paced:
    // scheduleAutoRefresh)
    refreshCurrentValues(g, indices)
    {
        for( const i of indices ) {
            const d = g.chart.data.datasets[i];
            if( d ) Object.assign(d, this._legendParts(d));
        }
        g.chart.update();
        this.showValues(g);
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
        for( const i of indices ) {
            const _ds = g.chart.data.datasets[i];
            if( _ds ) Object.assign(_ds, this._lineModeStyle(lineMode));
            if( g.entities[i] ) g.entities[i].lineMode = lineMode;
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
        // (without its line: its points, unless they're asked for otherwise)
        const _points = !d.showLine && d.pointsMode === 'hover' ? true : d.showPoints;
        const { pointRadius: _pointRadius, pointHoverRadius: _pointHoverRadius } = this._pointRadii(_points, config?.showPoints, d.width);
        // (dashMode: a style's name, or its dashes and gaps)
        const _dashes = { points: [1, 5], shortlines: [5, 5], longlines: [10, 8], pointline: [15, 3, 3, 3] };
        return {
            // A curve in a bar graph (mixed bar/line): drawn as a line, never stacked
            type: ( graphtype == 'bar' && d.kind === 'line' ) ? 'line' : undefined,
            hecNoStack: graphtype == 'bar' && d.kind === 'line',
            circularPeriod: d.circular,
            hecTooltip: d.tooltip,
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
            showLine: d.showLine,
            stateMap: d.stateMap,
            showCurrentValue: d.showCurrentValue,
            ...this._legendParts(d),
            yAxisID: d.yAxisID,
            // (stacked bars: those of each Y axis in their own column — stacking
            // values of two scales on each other would mean nothing; not stacked, the default:
            // each its own column, side by side — a stack given would stack them)
            stack: config.stacked ? d.yAxisID : undefined,
            name: d.name,
            cubicInterpolationMode: 'monotone',
            // (the curve interpolation algorithm, curves and smart modes — see deps/chart-hec.js)
            hecInterpolation: d.interpolation,
            ...this._lineModeStyle(d.mode),
            domain: d.domain,
            entity_id: d.entity_id,
            unit: d.unit,
            rounding: d.rounding,
            shownScale: d.shownScale,
            textFactor: d.shownScale / d.drawScale,
            // (not drawn — showGraph: false —: hidden, out of the legend, its value kept over
            // the graph: see showValues)
            hidden: d.hidden || d.notDrawn,
            notDrawn: d.notDrawn,
            legendHidden: d.legendHidden,
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
        // Its bounds — the right axis' own (yminRight, ymaxRight, yrangeRight), else the
        // graph's: a number is fixed; { soft } is a bound unless the values go past it; its
        // range (yrange): the smallest the axis shows, widened on the sides not fixed
        const _own = k => _right ? ( config?.[k + 'Right'] ?? config?.[k] ) : config?.[k];
        const _lo = _own('ymin'), _hi = _own('ymax'), _range = _own('yrange');
        const _fixedLo = typeof _lo === 'number' ? _lo : undefined, _fixedHi = typeof _hi === 'number' ? _hi : undefined;
        // (a state_map's curves only, all with the same one: its labels, at their places)
        const _map = _list.length && _list.every(d => d.stateMap?.length && JSON.stringify(d.stateMap) === JSON.stringify(_list[0].stateMap)) ? _list[0].stateMap : null;
        // (a logarithmic axis: curves only)
        const _log = config.logarithmic && graphtype == 'line' && !_period && !_map;
        // (its labels — labelsLeft / labelsRight, mini-graph-card's show.labels(_secondary):
        // false, none, the plot taking their room; hover, shown while the pointer is over the
        // graph — Chart.js ticks.hecShowOnHover)
        const _shown = ( graphtype == 'line' || graphtype == 'bar' ) ? config?.[_right ? 'labelsRight' : 'labelsLeft'] : true;
        return {
            id,
            ...( _log ? { type: 'logarithmic' } : {} ),
            position: _right ? 'right' : 'left',
            yLabelsMode: config?.yLabels,
            labelUnit: _unit,
            labelsShown: _shown,
            afterFit: (scaleInstance) => {
                scaleInstance.width = ( scaleInstance.options.ticks.mirror || _shown === false ) ? 0 : this.pconfig.labelAreaWidth;
            },
            afterDataLimits: (me) => {
                // (a side set by hand — the padlock, a drag, a pinch — or fixed: as it is)
                const _freeLo = me.options.ticks.min == null, _freeHi = me.options.ticks.max == null;
                if( _freeLo && _lo?.soft !== undefined ) me.min = Math.min(me.min, _lo.soft);
                if( _freeHi && _hi?.soft !== undefined ) me.max = Math.max(me.max, _hi.soft);
                const _short = ( _range ?? 0 ) - ( me.max - me.min );
                if( _short > 0 && ( _freeLo || _freeHi ) ) {
                    if( _freeLo && _freeHi ) { me.min -= _short / 2; me.max += _short / 2; }
                    else if( _freeLo ) me.min -= _short;
                    else me.max += _short;
                }
                const epsilon = 0.0001;
                if( _freeLo && this.pconfig.axisAddMarginMin && curvesOnly ) me.min -= epsilon;
                if( _freeHi && this.pconfig.axisAddMarginMax && curvesOnly ) me.max += epsilon;
            },
            ticks: {
                fontColor: this.pconfig.graphLabelColor,
                min: _fixedLo,
                max: _fixedHi,
                forceMin: _fixedLo,
                forceMax: _fixedHi,
                stepSize: _map ? 1 : config?.ystepSize ?? undefined,
                period: _period,
                // (a state_map's labels, at their places; nothing between them)
                ...( _map ? { callback: v => Number.isInteger(v) ? ( _map[v]?.label ?? '' ) : '' } : {} ),
                ...this._yLabelTicks(_inside),
                display: _shown !== false,
                hecShowOnHover: _shown === 'hover'
            },
            gridLines: {
                color: ( config.showGrid && ( graphtype == 'line' || graphtype == 'bar' || datasets.length > 1 ) ) ? this.pconfig.graphGridColor : 'rgba(0,0,0,0)',
                drawOnChartArea: !_right
            },
            scaleLabel: {
                display: !_inside && _shown !== false && _unit !== undefined && _unit !== '',
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

    // The card's width (px): what every choice made from it reads — narrow (NARROW_CARD_PX),
    // a small screen (SMALL_SCREEN_PX), the toolbar's forms, the time labels, a menu's room;
    // 0 before it's laid out
    cardWidth()
    {
        return this._this?.querySelector('#maincard')?.clientWidth || 0;
    }

    // Whether the card is narrower than NARROW_CARD_PX
    narrowCard()
    {
        return ( this.cardWidth() || Infinity ) < NARROW_CARD_PX;
    }

    // The option the curves' tooltip follows on the screen the card is on now: the info
    // panel's, or a card narrower than SMALL_SCREEN_PX — smallScreenTooltip —, else
    // largeScreenTooltip
    tooltipField()
    {
        const _w = this.cardWidth() || Infinity;
        return this.infoPanel || _w < SMALL_SCREEN_PX ? 'smallScreenTooltip' : 'largeScreenTooltip';
    }

    // How entity e's curve enters its graph's tooltip, on the screen the card is on now
    // (tooltipField) — its own mode, else its graph's, its entityOptions', the card's, else
    // that screen's default (resolveOption): 'selected' — once a click on it selected it —,
    // 'nearest' — while it's the curve nearest the pointer —, 'mixed' — either —, 'all' —
    // whenever a curve is that near (Chart.js hecTooltip)
    tooltipModeOf(e)
    {
        const _f = this.tooltipField();
        return this.resolveOption(e, _f);
    }

    // Graph g's curves given their tooltip mode as it is now (tooltipModeOf) — each graph's
    // when g is null: the card changed screens
    applyTooltipModes(g = null)
    {
        for( const _g of g ? [g] : this.graphs ) {
            _g.chart.data.datasets.forEach((ds, i) => { if( _g.entities[i] ) ds.hecTooltip = this.tooltipModeOf(_g.entities[i]); });
            _g.chart.hecEndTooltip();
        }
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
    // narrow card: their boxes as opaque as the Y labels', over the legend or the rows
    // (Chart.js hecControlsBackdrop) — else false: half see-through, dimming what is under
    // them (a timeline's first row, the Y labels), beside the legend's first line when it
    // fits there. Never any room of their own
    _controlsBackdrop()
    {
        return this.narrowCard();
    }

    // Each graph's Y labels placed, its text sized, its controls laid out and its tooltip
    // sized as the card's width now says (_yLabelsInside, _textSizes, _controlsBackdrop,
    // tooltipSize) — when the card crosses NARROW_CARD_PX or SMALL_SCREEN_PX
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
                _set(ax.scaleLabel, { display: !_inside && ax.labelsShown !== false && ax.labelUnit !== undefined && ax.labelUnit !== '' });
            }
            for( const ax of o.scales?.xAxes ?? [] ) _set(ax.ticks, { fontSize: _sizes.text });
            _set(o, { hecControlsBackdrop: this._controlsBackdrop() });
            _set(o.tooltips, { hecFirstOnly: this.tooltipSize() === 'slim' });
            _set(o.legend?.labels, { fontSize: _sizes.text });
            _set(o.elements, { font: _sizes.timeline });
            if( _changed ) g.chart.update(0);
            // (the values over it laid out for that width too — see showValues)
            if( _changed && g.valueSamples ) this.showValues(g);
        }
    }

    // The size of the tooltips (tooltip.size): 'full', 'compact' or 'slim' — 'auto' as the
    // card's width now says: full on a large screen (SMALL_SCREEN_PX), compact on a small one
    // (and in the info panel), slim on a narrow card (NARROW_CARD_PX)
    tooltipSize()
    {
        const s = this.pconfig.tooltipSize;
        if( s === 'full' || s === 'compact' || s === 'slim' ) return s;
        const _w = this.cardWidth() || Infinity;
        return _w < NARROW_CARD_PX ? 'slim' : this.infoPanel || _w < SMALL_SCREEN_PX ? 'compact' : 'full';
    }

    // The tooltip of a chart — every type alike, as a curve's —, as its size says
    // (tooltipSize, read each time it's shown):
    //   full — its title: where its first element comes from and its time (_tooltipTitle);
    //     a line per element shown, its series' name (tooltip.showLabel) and its value
    //     (_tooltipValue);
    //   compact — its title: the time alone; a line per element, its series' name at its
    //     shortest (the legend's shortened forms — src/legend-names.js —, the last one) and
    //     its value;
    //   slim — no title; its first element alone (Chart.js tooltips.hecFirstOnly, see
    //     fitToCardWidth), on one line: its time — without its date when the X axis shows
    //     the days (_tooltipDated) — and its value.
    // Colors: a timeline's as tooltip.showColorsTimeline says, every other's as
    // tooltip.showColorsLine
    _chartTooltips(graphtype)
    {
        const _point = (data, item) => data.datasets[item.datasetIndex]?.data[item.index];
        return {
            callbacks: {
                label: (item, data) => {
                    const _ds = data.datasets[item.datasetIndex], _value = this._tooltipValue(graphtype, _ds, item);
                    const _size = this.tooltipSize();
                    if( _size === 'slim' ) return `${this._tooltipTime(_point(data, item), item.xLabel, this._tooltipDated())}\u00a0\u00a0${_value}`;
                    const _name = !this.pconfig.tooltipShowLabel ? '' :
                                  _size === 'compact' ? this.shortNameForms(data.datasets)[item.datasetIndex]?.[3] ?? _ds.name : _ds.name;
                    return ( _name ? _name + ': ' : '' ) + _value;
                },
                title: (items, data) => {
                    const _size = this.tooltipSize();
                    if( !items.length || _size === 'slim' ) return '';
                    const p = _point(data, items[0]);
                    return _size === 'compact' ? this._tooltipTime(p, items[0].xLabel) : this._tooltipTitle(p, items[0].xLabel);
                }
            },
            hecFirstOnly: this.tooltipSize() === 'slim',
            yAlign: ( graphtype == 'line' || graphtype == 'bar' ) ? undefined : 'nocenter',
            caretPadding: 8,
            displayColors: this.pconfig.showTooltipColors[graphtype == 'timeline' ? 1 : 0]
        };
    }

    // Whether a slim tooltip's time shows its date: not when the window is a single day,
    // nor when the X axis shows each day (its ticks in minutes or hours: every midnight
    // ticked, its day labelled — see generate in deps/Chart.js)
    _tooltipDated()
    {
        const _oneDay = moment(this.startTime).isSame(moment(this.endTime).subtract(1, 'ms'), 'day');
        return !_oneDay && !['minute', 'hour'].includes(this.activeRange.tickStepUnit);
    }

    // An element's value in its tooltip: a curve's or a bar's in its unit (circular ones in
    // [0, period); a column of values: their min / mean / max — see _lineSamples), a
    // timeline's state (named as Home Assistant names it: tooltip.stateTextMode auto), an
    // arrowline's value in its unit
    _tooltipValue(graphtype, ds, item)
    {
        const _unit = ' ' + ( ds.unit || '' );
        if( graphtype == 'timeline' || graphtype == 'arrowline' ) {
            const _state = ds.data[item.index][2];
            if( graphtype == 'arrowline' ) return formatNumber(_state, ds.rounding) + _unit;
            return this.pconfig.tooltipStateTextMode == 'auto' ? this.getLocalizedState(_state, ds.domain, ds.device_class, ds.entity_id) : _state;
        }
        const _siFactor = ds.siConversionFactor ?? 1;
        // (from the value drawn back to the value shown: see shownScale)
        const _tf = ds.textFactor ?? 1;
        const _circQ = ds.circularPeriod;
        const _shown = y => {
            if( ds.stateMap?.length ) return stateLabel(ds.stateMap, Math.round(y)) ?? '';
            const v = y / _siFactor * _tf;
            // (a circular curve shows its real value, in [0, period))
            return formatNumber(_circQ ? Chart.hecCircular.wrap(v, _circQ * Math.abs(_tf)) : v, ds.rounding);
        };
        const _p = ds.data[item.index];
        return ( _p?.columnMin != null ? `${_shown(_p.columnMin)} / ${_shown(item.yLabel)} / ${_shown(_p.columnMax)}` : _shown(item.yLabel) ) + _unit;
    }

    // A tooltip's title: where its first element comes from — the history, or the statistics
    // and their period (5 min, 1 h) — and its time (_tooltipTime)
    _tooltipTitle(p, xLabel)
    {
        const _time = this._tooltipTime(p, xLabel);
        // (a timeline's or arrowline's state, [start, end, state]: from the history)
        if( Array.isArray(p) ) p = { x: p[0] };
        if( !p || typeof p !== 'object' || ( p.x === undefined && p.columnFrom == null ) ) return _time;
        // (statistics: their period too — 5 min, 1 h)
        const _period = ms => ms < 3600e3 ? `${Math.round(ms / 60e3)} min` : ms < 86400e3 ? `${Math.round(ms / 3600e3)} h` : moment.duration(ms).humanize();
        const _source = p.statistics ? `${i18n('ui.label.source_statistics')}${p.statisticsPeriod ? ' ' + _period(p.statisticsPeriod) : ''}` : i18n('ui.label.source_history');
        return `${_source}${i18n('ui.label.source_separator')}${_time}`;
    }

    // An element's time in its tooltip: a value's own (xLabel); the time a column of values,
    // a bar, a timeline's or arrowline's state covers — a state's duration after it with
    // tooltip.showDuration. With its date (dated), else its time of day alone — a span over
    // several days keeps its dates; its end's date only when it's another day
    _tooltipTime(p, xLabel, dated = true)
    {
        const _state = Array.isArray(p);
        if( _state ) p = { columnFrom: moment(p[0]).valueOf(), columnTo: moment(p[1]).valueOf() };
        if( !p || typeof p !== 'object' || ( p.x === undefined && p.columnFrom == null ) ) return xLabel;
        const _fmt = this.i18n.styleDateTimeTooltip, _hour = this.i18n.styleTimeTooltip;
        if( p.columnFrom == null ) return dated ? xLabel : moment(p.x).format(_hour);
        const _from = moment(p.columnFrom), _to = moment(p.columnTo), _sameDay = _from.isSame(_to, 'day');
        const _duration = _state && this.pconfig.tooltipShowDuration ? ` (${this._durationText(p.columnTo - p.columnFrom)})` : '';
        return `${_from.format(dated || !_sameDay ? _fmt : _hour)} – ${_to.format(_sameDay ? _hour : _fmt)}${_duration}`;
    }

    // A duration as a tooltip shows it: its days (1 day, 2 days…), then hh:mm:ss
    _durationText(ms)
    {
        const _days = Math.floor(ms / 86400e3);
        const _rest = moment.utc(ms - _days * 86400e3).format('HH:mm:ss');
        return _days ? `${_days > 1 ? i18n('ui.ranges.n_days', _days) : i18n('ui.ranges.day')}, ${_rest}` : _rest;
    }

    // Graph g's top control (Chart.js hecTopControl): its bar interval selector, placed by
    // its chart in its top row, between the handle and the close button — none: null
    setTopControl(g, el)
    {
        g.chart.options.hecTopControl = el ?? null;
        g.chart.update();
    }

    // How many points graph g draws, all its datasets together (the performance test)
    pointsShown(g)
    {
        return g.chart.data.datasets.reduce((a, d) => a + ( d.data?.length ?? 0 ), 0);
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
        const interval = config._graphInterval;

        let datasets = [];
        for( let d of entities ) {
            const _kind = this.entityKind({ type, interval }, d);
            datasets.push({
                "kind": _kind,
                "name": ( d.name === undefined ) ? this.stateOf(d.entity)?.attributes?.friendly_name : d.name,
                "bColor": this.entityColor(d),
                // (a bar entity shown as a raw curve — interval 4 — isn't filled like a bar;
                // a bar is filled with its own color)
                "fillColor": ( d.type === 'bar' && _kind === 'line' ) ? 'rgba(0,0,0,0)' : ( d.fill === d.color ) ? this.entityColor(d) : d.fill === 'fade' ? fillValue(true, this.entityColor(d)) : d.fill,
                "fillFade": d.fill === 'fade',
                "dashMode": d.dashMode,
                "mode": d.lineMode || this.pconfig.defaultLineMode,
                "interpolation": this.resolveInterpolation(d),
                "width": d.width || this.pconfig.defaultLineWidth,
                "showPoints": d.showPoints,
                // (its points as resolved — hover, the default: only the one hovered)
                "pointsMode": this.resolveOption(d, 'showPoints'),
                "showMinMax": d.showMinMax,
                "tooltip": this.tooltipModeOf(d),
                // (period of a circular entity in the units shown, before SI conversion)
                "circular": ( _kind === 'line' || _kind === 'bar' ) ? ( this.circularPeriodOf(d) ?? 0 ) * Math.abs(this.drawScaleOf(d)) || null : null,
                // (an arrowline's values are angles: a full turn is the entity's circular
                // period, 360 when it has none)
                "arrowPeriod": ( _kind === 'arrowline' ) ? ( this.circularPeriodOf(d) ?? 360 ) : undefined,
                "unit": this.getUnitOfMeasure(d.entity, d.unit),
                "rounding": this.roundingOf(d),
                // (the factor between the entity's value and the value shown in the legend and
                // tooltip: with its own `unit`, `scale` is a conversion and the converted value
                // is shown; without, it only changes how the curve is drawn and the entity's
                // real value is shown)
                "shownScale": this.shownScaleOf(d),
                "drawScale": this.drawScaleOf(d) || 1,
                // (mini-graph-card's state_map: each state drawn at its place in the list, its
                // label shown — see processOf)
                "stateMap": ( _kind === 'line' ) ? this.resolveOption(d, 'stateMap') : undefined,
                // (show_line: false — its points only)
                "showLine": this.resolveOption(d, 'showLine'),
                // (show_graph: false — not drawn)
                "notDrawn": !this.resolveOption(d, 'showGraph'),
                // (show_legend: false on the entity — no label in the legend; nor when not drawn)
                "legendHidden": ( d.legendVisible ?? this.getEntityOptions(d.entity)?.legendVisible ) === false || !this.resolveOption(d, 'showGraph'),
                // (its value now after its name in the legend: see showsCurrentValue)
                "showCurrentValue": this.showsCurrentValue(d),
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
        // (a graph added from the card: its close button, Chart.js' floating icon — a click on
        // it removes the graph, _onGraphClick)
        chart.options.closeButtonVisible = !isStatic;
        chart.options.closeButtonTitle = i18n('ui.menu.graph_delete');

        const h = config?._mixed ? this.calcGraphHeight('line', entities.length, config?.height) + 24 : this.calcGraphHeight(type, entities.length, config?.height);

        const g = { "id": gid, "type": type, "canvas": canvas, "graphHeight": h, "chart": chart , "entities": entities, "interval": interval, "ylock": config.ylock, "showTimeLabels": config.showTimeLabels, "isStatic": isStatic, "groupId": config?.groupId ?? null };

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
