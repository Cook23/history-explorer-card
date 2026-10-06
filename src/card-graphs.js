// The graphs: each one's chart created (axes, legend, tooltip), filled with its entities
// (two Y axes, SI conversion), placed in the display order, linked to the graphs of its
// group, merged and removed. Part of HistoryCardState (added to it in
// history-explorer-card.js).

import { defaultColors, parseColor, parseColorValue } from "./history-default-colors.js";
import { i18n } from "./languages.js";
import { keyOf } from "./history-entity-store.js";
import { getSIFactor, areSICompatible, chooseSIUnit } from "./history-units.js";
import { normalizeInterpolation, GRAPH_SCOPE_KEYS } from "./history-options.js";
import { baseTypePure } from "./card-config.js";
const Chart = window.HXLocal_Chart;
const moment = window.HXLocal_moment;

// The Y axes of a line or bar graph: on the left (Chart.js's own first Y axis), and on the
// right for a second group of units (see _assignYAxes)
export const LEFT_Y_AXIS = 'y-axis-0';
export const RIGHT_Y_AXIS = 'y-axis-1';

export class CardGraphs
{
    // --------------------------------------------------------------------------------------
    // Return entity label name with current value
    // --------------------------------------------------------------------------------------

    // A curve's legend label: its name, with its value now (showCurrentValues), and a small
    // arrow when it's on the right Y axis
    _legendLabel(d)
    {
        const _label = this.pconfig.showCurrentValues ? this.getFormattedLabelName(d.name, d.entity_id, d.unit, d.shownScale) : d.name;
        return d.yAxisID === RIGHT_Y_AXIS ? _label + ' ▸' : _label;
    }

    getFormattedLabelName(name, entity, unit, shownScale = 1)
    {
        let label = name;
        const p = 10 ** this.pconfig.roundingPrecision;
        const v = Math.round(this.stateOf(entity)?.state * shownScale * p) / p;
        if( !isNaN(v) ) {
            label += ' (' + v + (unit ? ' ' + unit : '') + ')';
        }
        return label;
    }

    // --------------------------------------------------------------------------------------
    // New graph creation
    // --------------------------------------------------------------------------------------

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
        const ctx = canvas.getContext('2d');

        // Any dataset drawn as a curve / as bars (a bar graph can hold both)
        const _hasCurves = ( graphtype == 'line' ) || ( graphtype == 'bar' && datasets.some(d => d.kind === 'line') );
        const _hasBars   = graphtype == 'bar' && datasets.some(d => d.kind === 'bar');

        const _yAxis = id => this._chartYAxis(id, graphtype, datasets, config, _hasCurves && !_hasBars);

        var chart = new Chart(ctx, {

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
                // graphs, menus — arrives as customEvent gestures (_onGesture).
                panX: (info) => this._onTimePan(info),
                zoomX: (info) => this._onTimeZoom(info),
                zoomSelectMode: this.state.zoomMode,
                legendClickEnabled: false,
                customEvent: (info) => this._onGesture(info),
                scales: {
                    xAxes: [{
                        type: ( graphtype == 'line' || graphtype == 'bar' ) ? 'time' : ( graphtype == 'arrowline' ) ? 'arrowline' : 'timeline',
                        // (half a bar of margin at both ends only when there are bars to show)
                        offset: ( graphtype == 'bar' ) ? _hasBars : undefined,
                        time: {
                            unit: this.activeRange.tickStepUnit,
                            stepSize: this.activeRange.tickStepSize,
                            displayFormats: { 'minute': this.i18n.styleTimeTicks, 'hour': this.i18n.styleTimeTicks, 'day': this.i18n.styleDateTicks, 'month': 'MMM' },
                            tooltipFormat: this.i18n.styleDateTimeTooltip,
                        },
                        ticks: {
                            fontColor: ( config?.showTimeLabels === false ) ? 'rgba(0,0,0,0)' : this.pconfig.graphLabelColor,
                            major: {
                                enabled: true,
                                unit: 'day',
                                fontStyle: 'bold',
                                unitStepSize: 1,
                                displayFormats: { 'day': this.i18n.styleDateTicks },
                            },
                            maxRotation: 0
                        },
                        gridLines: {
                            color: this.pconfig.graphGridColor
                        },
                        stacked: config?.stacked
                    }],
                    yAxes: [_yAxis(LEFT_Y_AXIS), ...( datasets.some(d => d.yAxisID === RIGHT_Y_AXIS) ? [_yAxis(RIGHT_Y_AXIS)] : [] )],
                },
                topClipMargin : 4,
                bottomClipMargin: 4,
                layout: {
                    padding: {
                        top: ( graphtype === 'timeline' || graphtype === 'arrowline' ) ? 24 : 0
                    }
                },
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
                        boxWidth: 0
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
                    font: 'normal 13px "Helvetica Neue", Helvetica, Arial, sans-serif',
                    textPadding: 4,
                    arrowColor: getComputedStyle(document.body).getPropertyValue('--primary-text-color')
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

    _curveDataset(d, graphtype, config)
    {
        // The samples' dots: the entity's showPoints, else the graph's (a radius, true: 4);
        // a hovered one 2px larger (5 when none is shown)
        const _radius = v => v === true ? 4 : +v;
        const _own = d.showPoints, _graph = config?.showPoints;
        const _ownOn = _own !== undefined && _own !== false && _own !== 0;
        const _pointRadius = _own !== undefined ? ( _ownOn ? _radius(_own) : 0 ) : ( _graph ? _radius(_graph) : 0 );
        const _pointHoverRadius = _ownOn ? _radius(_own) + 2 : _graph ? _radius(_graph) + 2 : 5;
        const _dashes = { points: [1, 5], shortlines: [5, 5], longlines: [10, 8], pointline: [15, 3, 3, 3] };
        return {
            // A curve in a bar graph (mixed bar/line): drawn as a line, never stacked
            type: ( graphtype == 'bar' && d.kind === 'line' ) ? 'line' : undefined,
            hecNoStack: graphtype == 'bar' && d.kind === 'line',
            hecCircular: d.circular,
            borderColor: d.bColor,
            backgroundColor: d.fillColor,
            borderWidth: d.width,
            borderDash: Array.isArray(d.dashMode) ? d.dashMode : _dashes[d.dashMode],
            pointRadius: _pointRadius,
            pointStyle: 'circle',
            pointBackgroundColor: d.bColor,
            pointHoverRadius: _pointHoverRadius,
            hitRadius: 5,
            label: this._legendLabel(d),
            yAxisID: d.yAxisID,
            // (stacked bars: those of each Y axis in their own column — stacking
            // values of two scales on each other would mean nothing)
            stack: d.yAxisID,
            name: d.name,
            steppedLine: d.mode === 'stepped',
            cubicInterpolationMode: 'monotone',
            // (the curve interpolation algorithm, curves and smart modes — see deps/chart-hec.js)
            hecInterpolation: d.interpolation,
            lineTension: ( d.mode === 'lines' || d.mode === 'stepped' ) ? 0 : 0.1,
            domain: d.domain,
            entity_id: d.entity_id,
            unit: d.unit,
            shownScale: d.shownScale,
            hecTextFactor: d.shownScale / d.drawScale,
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
        return {
            id,
            position: _right ? 'right' : 'left',
            afterFit: (scaleInstance) => {
                scaleInstance.width = this.pconfig.labelAreaWidth;
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
                period: _period
            },
            gridLines: {
                color: ( graphtype == 'line' || graphtype == 'bar' || datasets.length > 1 ) ? this.pconfig.graphGridColor : 'rgba(0,0,0,0)',
                drawOnChartArea: !_right
            },
            scaleLabel: {
                display: _unit !== undefined && _unit !== '',
                labelString: _unit,
                fontColor: this.pconfig.graphLabelColor
            },
            barThickness: this.pconfig.timelineBarHeight - 4,
            stacked: config?.stacked
        };
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
                        const _tf = data.datasets[item.datasetIndex].hecTextFactor ?? 1;
                        const _circQ = data.datasets[item.datasetIndex].hecCircular;
                        let _v = Math.round(item.yLabel / _siFactor * _tf * p) / p;
                        // (a circular curve shows its real value, in [0, period))
                        if( _circQ ) _v = Math.round(this._wrapCircular(_v, _circQ * Math.abs(_tf)) * p) / p;
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

    // --------------------------------------------------------------------------------------
    // Graphs in the display order
    // --------------------------------------------------------------------------------------

    calcGraphHeight(type, n, h)
    {
        switch( type ) {
            case 'line': return ( h ? h : this.pconfig.lineGraphHeight );
            case 'bar':  return ( h ? h : this.pconfig.barGraphHeight ) + 24;
            default:
                const m = ( this.pconfig.tooltipSize == 'full' ) ? 130 : ( this.pconfig.tooltipSize == 'slim' ) ? 90 : 115;
                return Math.max(34 + n * this.pconfig.timelineBarSpacing, m);
        }
    }

    _graphDiv(g)
    {
        // Returns the wrapper <div> containing a graph's canvas and its overlays
        return g.canvas.parentNode.parentNode;
    }

    _footerAnchor(gl)
    {
        // Returns the top-level child of #graphlist where the bottom toolbar block starts:
        // #tb_1 when the bottom toolbar/selector are shown (it renders before #rf_1), or
        // #rf_1 as a fallback — it's always rendered, even when both are hidden, so this
        // anchor always exists once the bottom section has been rendered at all. Graphs
        // must be inserted before it, never appended after — #graphlist holds both the
        // toolbars and the graphs since the v1.1.27 unified pipeline, unlike the pre-1.1.27
        // layout where toolbars lived outside it.
        const _anchorEl = this._this.querySelector('#tb_1') ?? this._this.querySelector('#rf_1');
        if( !_anchorEl ) return null;
        let _node = _anchorEl;
        while( _node && _node.parentNode !== gl ) _node = _node.parentNode;
        return _node;
    }

    // All graphs on the page, in true display order: pconfig.entities' own order decides
    // between different groupId blocks; within one groupId block (usually a single graph,
    // exceptionally several linked ones), graphIndex decides — position in pconfig.entities
    // does NOT reflect a block's internal graph order, that's the whole reason graphIndex
    // exists.
    // --- GRAPH-level order helpers (groupId + graphIndex — the full on-screen order) ---

    _allGraphsInDisplayOrder()
    {
        const _seen = new Set();
        const _result = [];
        let _blockGroupId = Symbol();
        let _blockGraphs = [];
        const _flushBlock = () => {
            _blockGraphs.sort((a, b) => (a.entities[0]?.graphIndex ?? 0) - (b.entities[0]?.graphIndex ?? 0));
            _result.push(..._blockGraphs);
            _blockGraphs = [];
        };
        for( let en of this.store.list ) {
            if( typeof en !== 'object' ) continue;
            const _g = this.graphs.find(gr => gr.entities.some(e => keyOf(e) === keyOf(en)));
            if( !_g || _seen.has(_g) ) continue;
            if( en.groupId !== _blockGroupId ) { _flushBlock(); _blockGroupId = en.groupId; }
            _seen.add(_g);
            _blockGraphs.push(_g);
        }
        _flushBlock();
        return _result;
    }

    _firstGraph()
    {
        return this._allGraphsInDisplayOrder()[0] ?? null;
    }

    _isFirstGraph(g)
    {
        return this._firstGraph() === g;
    }

    // The graph immediately before/after g on screen — needed to number a new graph's
    // graphIndex correctly in every situation, including inside a solid block of several
    // linked graphs.
    _previousGraph(g)
    {
        const _all = this._allGraphsInDisplayOrder();
        const _idx = _all.indexOf(g);
        return (_idx > 0) ? _all[_idx - 1] : null;
    }

    _nextGraph(g)
    {
        const _all = this._allGraphsInDisplayOrder();
        const _idx = _all.indexOf(g);
        return (_idx >= 0 && _idx < _all.length - 1) ? _all[_idx + 1] : null;
    }

    // --- GROUP-level order helpers (groupId only — a solid block of one or more linked
    // graphs is treated as a single unit; nothing can ever be inserted inside it) ---

    // The graph that follows g's whole group, per pconfig.entities' order — the source of
    // truth for display order (this.graphs is a working structure only, never reliable for
    // order). Scans forward from g's last entity in pconfig.entities for the next entry
    // whose groupId differs from g's — a run of same-groupId entries is one solid block, so
    // the first differing groupId is always the true next group.
    _nextGroup(g)
    {
        const _lastEntity = g.entities[g.entities.length - 1];
        const _list = this.store.list;
        const _startIdx = this.store.indexOf(keyOf(_lastEntity));
        if( _startIdx < 0 ) return null;
        for( let i = _startIdx + 1; i < _list.length; i++ ) {
            const _e = _list[i];
            if( typeof _e !== 'object' || _e.groupId === g.groupId ) continue;
            const _candidateG = this.graphs.find(gr => gr !== g && gr.entities.some(en => keyOf(en) === keyOf(_e)));
            if( _candidateG ) return _candidateG;
        }
        return null;
    }

    // --------------------------------------------------------------------------------------
    // Linked graphs
    // --------------------------------------------------------------------------------------

    _detachGraph(g)
    {
        // Removes a graph's wrapper div from the DOM and from this.graphs. Callers capture
        // the graph right after g in this.graphs BEFORE calling this, to use as addGraph's
        // `before` (insertBefore semantics) for whatever gets rebuilt in its place.
        this._graphDiv(g).remove();
        this.graphs.splice(this.graphs.indexOf(g), 1);
    }

    // Removes g.entities[idx] and detaches g. If any entities remain, rebuilds g's
    // replacement in the same spot (right before whatever graph followed g) with the same
    // groupId — same "remove one entity from a combined graph" shared by _uncombineEntity,
    // the cross-graph legend drag (source side), and entity removal. Callers still handle
    // whatever they do with the removed entity afterward (recreate it elsewhere, drop it,
    // move it into a target graph, etc.) — this only ever rebuilds what's LEFT of g.
    // nextG defaults to _nextGroup(g), computed here — but a caller that mutates
    // pconfig.entities' order or groupIds BEFORE calling this (e.g. _uncombineEntity,
    // regrouping the just-extracted entity under its new groupId first) must compute and
    // pass its own, since _nextGroup's scan depends on that order already being final.
    // Returns the removed entity.
    _detachAndRebuildRemaining(g, idx, nextG = undefined)
    {
        const _entity = g.entities[idx];
        const _remaining = g.entities.filter((_, i) => i !== idx);
        const _origGroupId = g.groupId;
        const _nextG = nextG !== undefined ? nextG : this._nextGroup(g);
        this._detachGraph(g);
        _remaining.forEach(en => { en.siConversionFactor = undefined; });
        this._rebuildGraph(_remaining, _origGroupId, _nextG);
        return _entity;
    }

    _updateMoVisibility()
    {
        const _single = this.graphs.length <= 1;
        for( let g of this.graphs ) {
            if( g.chart ) {
                g.chart.options.moveHandleVisible = !_single;
                g.chart.update();
            }
        }
    }

    // Shows a chain-link icon between two consecutive graphs that share the same non-null
    // groupId (linked graphs — see _wouldSplitGroup) so the link is visible even outside a
    // drag gesture. Called after anything that can change graph composition or order.
    // Takes no vertical space (height:0 wrapper, icon floated up over it) and is always
    // re-inserted at its correct DOM position even if it already existed, as a cheap safety
    // net — addGraph now inserts each graph div directly at its final spot via `before`.
    // Chain icon between two linked graphs (same group, one right below the other): shown
    // by Chart.js on the lower one (linkMarkerVisible); a double-click on it reaches
    // customEvent with linkMarkerZone (see newGraph) and merges them (_mergeLinkedGraph).
    _updateGroupLinkMarkers()
    {
        // Sort by graphIndex — the stable, persisted display-order field — rather than
        // relying on this.graphs' own array order to already match it.
        const _sorted = [...this.graphs].sort((a, b) =>
            (a.entities?.[0]?.graphIndex ?? 0) - (b.entities?.[0]?.graphIndex ?? 0));
        for( let i = 0; i < _sorted.length; i++ ) {
            const g = _sorted[i];
            const _linked = i > 0 && _sorted[i - 1].groupId !== null &&
                            _sorted[i - 1].groupId !== undefined &&
                            _sorted[i - 1].groupId === g.groupId;
            const _opt = g.chart.options;
            if( !!_opt.linkMarkerVisible === _linked ) continue;
            _opt.linkMarkerVisible = _linked;
            _opt.linkMarkerTitle = `${i18n('ui.menu.linked_graphs')} — ${i18n('ui.menu.linked_graphs_merge')}`;
            g.chart.update();
        }
    }

    // Graph g can be merged into the graph right above it (see _mergeLinkedGraph)
    _canMergeLinkedGraph(g)
    {
        const _upper = this._previousGraph(g);
        return !!_upper && this._sameGroup(_upper, g) && this._typesCompatible(_upper.type, g.type);
    }

    // Merges graph g into the graph right above it, when both belong to the same group
    // (linked) — the reverse of a static uncombine or of a type change, whatever the units.
    // Only the chart type can prevent it (a line and a bar/timeline can't share one chart).
    _mergeLinkedGraph(g, info)
    {
        const _upper = this._previousGraph(g);
        if( !_upper || !this._sameGroup(_upper, g) ) return;
        if( !this._typesCompatible(_upper.type, g.type) ) {
            this._showLabelTooltip(`${g.type} ≠ ${_upper.type}`, info.clientX, info.clientY, 'left', g.canvas);
            return;
        }
        const _key = _upper.entities[0].graphKey;
        const _all = [..._upper.entities, ...g.entities];
        _all.forEach(en => { this._setGraphKey(en, _key); en.siConversionFactor = undefined; });
        const _groupId = _upper.groupId;
        const _nextG = this._nextGraph(g);
        this._detachGraph(_upper);
        this._detachGraph(g);
        this._rebuildGraph(_all, _groupId, _nextG);
        this._syncGroupOrder(_groupId);
        this.writeLocalState();
        this.updateHistory();
    }

    // --------------------------------------------------------------------------------------
    // Adding and removing graphs from the view
    // --------------------------------------------------------------------------------------

    // The close button (×) of a graph added from the card
    removeGraph(event)
    {
        const id = event.target.id.substr(event.target.id.indexOf("-") + 1);
        const g = this.graphs.find(g => g.id == id);
        if( g ) this._removeGraph(g);
    }

    // A graph added from the card removed, with its entities
    _removeGraph(g)
    {
        this._graphDiv(g).remove();
        for( let e of g.entities ) this.store.remove(e, true);
        this.graphs.splice(this.graphs.indexOf(g), 1);

        this._updateMoVisibility();
        this._updateGroupLinkMarkers();

        this.updateHistoryWithClearCache();

        this.writeLocalState();
    }

    addGraph(entity_id, { noAutoGroup = false, color = null, fill = null, before = null, hidden = undefined, isStatic = false, interval = null, groupId = null, entry = null } = {})
    {
        // Shows an entity: in a graph of its group it can join (its type, its sub-graph),
        // else — a new entity, without a group — in the last graph if its units are
        // compatible (combineSameUnits), else in a new graph placed right before `before`
        // (last when null). Options:
        //   noAutoGroup  never joins a graph: a new graph
        //   color, fill  the curve's color, else its entry's / entityOptions' / the palette's
        //   hidden       the curve hidden (else as its entry or entityOptions say)
        //   isStatic     a graph defined in YAML (no close button; kept static when rebuilt)
        //   interval     the bar interval of the graph
        //   groupId      the group the entity belongs to
        //   entry        its entry of the entity list (pconfig.entities), when it has one

        if( this.stateOf(entity_id) == undefined ) return;

        const { graphProps: _graphProps, options: entityOptions } = this._optionsInGraph(entity_id, groupId);

        // (let: becomes the graph's type below, once combined)
        let type = ( entry?.type ?? entityOptions?.type ) || baseTypePure(this._hass, entity_id);

        // The entity's single source of truth: entry is already the
        // pconfig.entities entry when the caller has one (the `_pe ?? en` pattern used
        // throughout this file). If not (a genuinely new entity), create one now and use
        // it — g.entities[0] below is this SAME object, never a copy, so there is nothing
        // left to keep in sync between "session" and "persisted" entity data.
        // (an entry that isn't a persisted entry yet — a plain runtime object —
        // is registered as one, rather than leaving a second, disconnected copy)
        const _pcEntry = this.store.add(entry ?? { entity: entity_id });
        _pcEntry.entity = entity_id;
        // The entity's own display type — kept per entity, since a graph can now hold both
        // line and bar entities (see _entityKind)
        _pcEntry.type = type;
        // A YAML entity's graph stays static whichever operation rebuilds it (uncombine,
        // drag, type change...) — not only the initial rebuild, which passes isStatic.
        if( _pcEntry.isStatic ) isStatic = true;

        const _ownFill = this._applyEntityDefaults(_pcEntry, type, entityOptions, { color, fill, hidden });

        let entities = [_pcEntry];

        // Captured so the merged graph can be reinserted at the removed graph's DOM position
        // instead of always landing at the end of #graphlist
        let _combineGl = null;
        let _combineInsertBefore = null;
        let _graphIndex;

        const _cand = noAutoGroup ? null : this._combineTarget(_pcEntry, type, groupId);
        if( _cand ) {

            // If no groupId provided, adopt the target graph's groupId
            if( groupId === null ) groupId = _cand.groupId;

            // Joining an existing graph always adopts its groupId AND its graphIndex —
            // same rule, same reasoning: this is still the same displayed graph, and
            // inserting into a solid block of several linked graphs (the only case where
            // a groupId's members could have different graphIndex values) is forbidden
            // elsewhere, so every entity of _cand already shares one value.
            _graphIndex = _cand.entities[0].graphIndex ?? 1;

            this._freeColorIn(_cand, _pcEntry, _ownFill);

            // Add the new entity to the previous ones
            entities = _cand.entities.concat(entities);

            // Capture the DOM position of the graph being removed
            const _candDiv = this._graphDiv(_cand);
            _combineGl = _candDiv.parentNode;
            let _sib = _candDiv.nextSibling;
            while( _sib && !_combineGl.contains(_sib) ) _sib = _sib.nextSibling;
            _combineInsertBefore = _sib;

            // Delete the old graph, will be regenerated below including the new entity
            _candDiv.remove();
            this.graphs.splice(this.graphs.indexOf(_cand), 1);

        } else {
            _graphIndex = this._newGraphIndex(before);
        }
        for( let e of entities ) e.graphIndex = _graphIndex;

        // entityOptions.groupId was frozen before the combine block resolved the final
        // groupId (e.g. adopting the target graph's groupId when it was null) — resync it
        // here so the graph object built below gets the correct, final groupId. _pcEntry
        // is now g.entities[0] itself (no separate copy), so it must be kept in step too.
        entityOptions.groupId = groupId;
        _pcEntry.groupId = groupId;

        // Y axis bounds: the graph's own options first, else the first entity of the graph
        // that sets them (on its YAML entry), else entityOptions — taken from every entity
        // of the graph, not only the one being added (which used to decide alone).
        for( const _k of GRAPH_SCOPE_KEYS ) {
            if( _graphProps[_k] !== undefined ) continue;
            const _fromEntity = entities.map(e => e[_k]).find(v => v !== undefined && v !== null);
            if( _fromEntity !== undefined ) entityOptions[_k] = _fromEntity;
        }

        // The graph's own type: 'bar' as soon as it holds a bar entity (its line entities
        // then drawn as curves over the bars), otherwise the entities' type
        if( type === 'line' || type === 'bar' )
            type = entities.some(e => e.type === 'bar') ? 'bar' : 'line';
        const _mixed = type === 'bar' && entities.some(e => e.type !== 'bar');
        entityOptions._mixed = _mixed;
        // The bar interval of the graph: the one asked for, else the one saved with its
        // entities (any of them — a line entity rebuilt last must not reset it), else the
        // configured one. Needed before the graph is built: it decides how bar entities
        // are drawn (bars, or raw curves for interval 4).
        const _graphInterval = interval ?? entities.map(e => e.interval).find(v => v !== undefined && v !== null)
            ?? this.parseIntervalConfig(entityOptions?.interval ?? this.pconfig.defaultInterval) ?? 1;
        entityOptions._graphInterval = _graphInterval;

        const _graphHeight = _graphProps.height ?? entityOptions?.height;
        // (a mixed bar/line graph is sized like a line graph, plus the interval selector)
        const h = _mixed ? this.calcGraphHeight('line', entities.length, _graphHeight) + 24 : this.calcGraphHeight(type, entities.length, _graphHeight);

        const e = this._graphElement(type, h, _graphIndex, _graphInterval, _graphProps.title, isStatic);

        let gl = this._this.querySelector('#graphlist');
        const _tgtDiv = ( before && before.canvas?.parentNode ) ? this._graphDiv(before) : null;
        if( _combineInsertBefore && (_combineGl ?? gl).contains(_combineInsertBefore) ) {
            (_combineGl ?? gl).insertBefore(e, _combineInsertBefore);
        } else if( _tgtDiv && _tgtDiv.parentNode ) {
            // Insert right before `before` — "the graph this one belongs right before".
            // `before` null (or no longer valid) falls through to the last-position
            // fallback below, same as "nothing after it, insert last".
            _tgtDiv.parentNode.insertBefore(e, _tgtDiv);
        } else {
            const _footer = this._footerAnchor(gl);
            if( _footer ) gl.insertBefore(e, _footer); else gl.appendChild(e);
        }

        // For bar graphs, connect the interval selector dropdown listener
        if( type == 'bar' && !this.ui.hideInterval )
            this._this.querySelector(`#bd-${this.g_id}`).addEventListener('change', this.selectBarInterval.bind(this));

        // Create the graph
        const _dynGid = this.g_id;
        this.addGraphToCanvas(this.g_id++, type, entities, entityOptions, isStatic);

        // Apply interval override if provided
        const _dynG = this.graphs.find(g => g.id === _dynGid);
        if( _dynG && interval !== null && interval !== undefined ) {
            _dynG.interval = interval;
            const _bd = this._this.querySelector(`#bd-${_dynGid}`);
            if( _bd ) _bd.value = interval;
        }

        // Connect the close button event listener (only for dynamic graphs)
        if( !isStatic )
            this._this.querySelector(`#bc-${_dynGid}`)?.addEventListener('click', this.removeGraph.bind(this));

        // Update legend margins now that elements are in the DOM with real widths
        if( _dynG ) this._updateLegendMargins(_dynG);

        // Update mo/ca visibility based on graph count
        this._updateMoVisibility();
        this._updateGroupLinkMarkers();
    }

    // An entity's options in the graph of group groupId: from the lowest priority to the
    // highest, the card's defaults, entityOptions, the graph's own (YAML) options
    _optionsInGraph(entity_id, groupId)
    {
        const graphProps = (groupId !== null && this.pconfig.graphs[groupId]) ? this.pconfig.graphs[groupId] : {};
        // Only keys the graph actually sets: a plain spread would let every graph-level key
        // left unset in YAML (stored as undefined) wipe the matching entityOptions value.
        const _definedGraphProps = Object.fromEntries(Object.entries(graphProps).filter(([, v]) => v !== undefined));
        return { graphProps, options: { ...this.pconfig.cardGraphDefaults, ...this.getEntityOptions(entity_id), ..._definedGraphProps, groupId } };
    }

    // An entry's display settings it doesn't set itself: the color asked for (color, fill),
    // else the configuration's (colorSet), else the palette's; then each option from
    // entityOptions or the card's defaults. Returns the entry's own fill, as it was before
    // (an explicit per-entity fill always wins over the defaults and the palette's fill).
    _applyEntityDefaults(e, type, entityOptions, { color, fill, hidden })
    {
        const _ownFill = e.fill;

        e.color = e.color ?? "#000000";
        e.fill = e.fill ?? "#00000000";

        // (for every type — a timeline doesn't draw them, but they must round-trip through
        // drag, uncombine and type changes)
        if( color ) {
            e.color = color;
            e.fill = fill ?? 'rgba(0,0,0,0)';
        } else if( entityOptions?.color ) {
            e.color = entityOptions?.color;
            e.fill = _ownFill ?? entityOptions?.fill ?? 'rgba(0,0,0,0)';
            e.colorSet = true;
        } else if( e.color === "#000000" ) {
            const c = this.getNextDefaultColor();
            e.color = c.color;
            e.fill = _ownFill ?? entityOptions?.fill ?? c.fill;
        }
        // A color that isn't a constant (an entity's, thresholds) or isn't valid: the
        // palette's where none applies (see _currentColor)
        if( !parseColorValue(e.color)?.color )
            e.paletteColor = e.paletteColor ?? this.getNextDefaultColor().color;

        e.dashMode   = e.dashMode    ?? entityOptions?.dashMode ?? this.pconfig.defaultDashMode;
        e.width      = e.width       ?? entityOptions?.lineWidth ?? this.pconfig.defaultLineWidth;
        e.lineMode   = this.normalizeLineMode(e.lineMode ?? entityOptions?.lineMode) ?? this.pconfig.defaultLineMode;
        // (interpolation: only an explicit choice is kept on the entity — its YAML entry or
        // the Interpolation submenu — so that changing it on the card, a graph or in
        // entityOptions still applies to it; see _resolveInterpolation)
        e.interpolation = normalizeInterpolation(e.interpolation);
        e.scale      = e.scale       ?? entityOptions?.scale;
        e.hidden     = hidden !== undefined ? hidden : (e.hidden ?? entityOptions?.hidden);
        e.netBars    = e.netBars     ?? entityOptions?.netBars ?? this.pconfig.defaultNetBars;
        e.showPoints = e.showPoints  ?? entityOptions?.showPoints ?? this.pconfig.defaultShowPoints;
        e.decimation = e.decimation  ?? entityOptions?.decimation;
        e.showMinMax = e.showMinMax  ?? entityOptions?.showMinMax ?? this.pconfig.defaultShowMinMax;
        e.name       = e.name        ?? entityOptions?.name;
        e.siConversionFactor = e.siConversionFactor ?? entityOptions?.siConversionFactor;
        e.unit       = e.unit        ?? entityOptions?.unit;
        e.process    = e.process     ?? entityOptions?.process;
        e.circular   = e.circular    ?? entityOptions?.circular;

        if( type == 'bar' ) {
            e.fill = e.color;
            e.lineMode = this.normalizeLineMode(e.lineMode ?? entityOptions?.lineMode) ?? 'lines';
        }

        return _ownFill;
    }

    // The graph an entry joins, if any:
    // - With an explicit groupId (static YAML graph, or any graph being rebuilt): the
    //   graph of that same group showing the same sub-graph (graphKey — see
    //   _uncombineEntity) with a compatible type. Units are deliberately NOT checked here:
    //   the entities of one group are shown together by definition (a YAML graph is the
    //   author's explicit choice, a curve dropped there the user's), on two Y axes or one
    //   (see _assignYAxes). Only the type keeps them apart (a timeline or an arrowline
    //   can't share a chart) — those become linked graphs of the same group instead,
    //   re-combinable later.
    // - Dynamic with no groupId (brand-new entity from the UI): only the last graph is
    //   considered, joined if it has the same type and, for curves, compatible units
    //   (combineSameUnits)
    // Never a graph already showing its series (a curve once per graph)
    _combineTarget(e, type, groupId)
    {
        const _free = g => !g.entities.some(x => x.entity === e.entity);
        if( groupId !== null )
            return this.graphs.filter(g => g.groupId === groupId && _free(g) && this._typesCompatible(g.type, type) && g.entities[0]?.graphKey === e.graphKey && this._sameSavedGraph(g.entities[0], e)).pop() ?? null;

        const _last = this.graphs[this.graphs.length - 1];
        return _last && _free(_last) && _last.type === type &&
               ( type == 'timeline' || this.pconfig.combineSameUnits && areSICompatible(this.getUnitOfMeasure(e.entity, e.unit), this.getUnitOfMeasure(_last.entities[0].entity, _last.entities[0].unit)) )
            ? _last : null;
    }

    // An entry joining graph g with a color another of its curves has: a free color of the
    // palette instead — only for a color the card picked: one the configuration sets
    // (colorSet) is kept. (Checked against the real target, whether or not the caller knew
    // it — e.g. a brand-new entity created from the type menu.)
    _freeColorIn(g, e, ownFill)
    {
        if( e.color === undefined || e.colorSet ) return;
        const _usedColors = g.entities.map(x => x.color);
        if( !_usedColors.includes(e.color) ) return;
        const _free = defaultColors.find(c => !_usedColors.includes(c.color));
        if( _free ) {
            e.color = _free.color;
            e.fill  = ownFill ?? _free.fill;
        }
    }

    // graphIndex of a new graph: a real number giving each graph's display order (1 =
    // topmost page-wide), tracked per entity (all entities of one displayed graph share the
    // same value) since there's no separate per-graph persisted structure. A new graph is
    // placed right before `before` (see addGraph's insertion) — its index is the average of
    // `before`'s index and its true on-screen previous neighbor's (0 if none, i.e. inserting
    // at the very top). `before` null means nothing follows: index is the last on-screen
    // graph's, rounded up, + 1 (or 1 if there are no graphs yet).
    _newGraphIndex(before)
    {
        if( before?.entities?.[0]?.graphIndex !== undefined ) {
            const _prevG = this._previousGraph(before);
            const _beforeIdx = _prevG?.entities?.[0]?.graphIndex ?? 0;
            return (_beforeIdx + before.entities[0].graphIndex) / 2;
        }
        const _all = this._allGraphsInDisplayOrder();
        const _lastIdx = _all[_all.length - 1]?.entities?.[0]?.graphIndex;
        return _lastIdx !== undefined ? Math.ceil(_lastIdx) + 1 : 1;
    }

    // The element of a new graph (its title, canvas, close button, interval selector),
    // not yet in the page
    _graphElement(type, h, graphIndex, graphInterval, title, isStatic)
    {
        let html = '';
        // Spacing between graphs: a margin-top on this graph's own container unless it's
        // the very first one on the page — found by comparing its own graphIndex to the
        // current first graph's (this graph doesn't exist in this.graphs yet, so
        // _isFirstGraph itself doesn't apply here). Not by this.graphs.length (a transient
        // count during construction that doesn't reflect final display order — e.g.
        // rebuilding a graph in the middle of the page still finds this.graphs empty at
        // that moment). Also skipped if the previous graph has showTimeLabels === false.
        // A margin (not a <br> sibling) is structurally part of this graph's own div, so
        // it can never end up misplaced relative to it — same reasoning as the toolbar.
        const _currentFirst = this._firstGraph();
        const _isFirstOnPage = !_currentFirst || graphIndex <= (_currentFirst.entities?.[0]?.graphIndex ?? Infinity);
        const _prevG = _isFirstOnPage ? null : this._allGraphsInDisplayOrder().filter(g => (g.entities?.[0]?.graphIndex ?? Infinity) < graphIndex).pop();
        const _prevShowTimeLabels = _prevG ? (_prevG.showTimeLabels ?? true) : true;
        const _graphMarginTop = (!_isFirstOnPage && _prevShowTimeLabels !== false) ? 8 : 0;
        // Optional title
        if( title !== undefined ) html += `<div style='text-align:center;'>${title}</div>`;
        html += `<div style='height:${h}px;margin-top:${_graphMarginTop}px;position:relative'>`;
        html += `<canvas id="graph${this.g_id}" height="${h}px"></canvas>`;
        if( !isStatic )
            html += `<button id='bc-${this.g_id}' style="position:absolute;right:10px;margin-top:${-h+5}px;color:var(--primary-text-color);background-color:${this.pconfig.closeButtonColor};border:0px solid black;">×</button>`;
        if( type == 'bar' && !this.ui.hideInterval )
            html += this.createIntervalSelectorHtml(this.g_id, h, graphInterval, this.ui.optionStyle, 40);
        html += `</div>`;

        const e = document.createElement('div');
        e.innerHTML = html;
        return e;
    }

    // The legend keeps clear of the buttons drawn over the graph's top right corner (bar
    // interval selector, close button) — Chart.js legend.rightMargin
    _updateLegendMargins(g)
    {
        const _isStatic = g.isStatic;
        const _legend = g.chart.options.legend;
        if( g.type === 'bar' ) {
            const bd = this._this.querySelector(`#bd-${g.id}`);
            if( bd ) _legend.rightMargin = bd.offsetWidth + (_isStatic ? 15 : 45);
        } else {
            _legend.rightMargin = _isStatic ? 25 : 45;
        }
    }

    // Each curve's Y axis (line and bar graphs): one per group of compatible units, at most
    // two — the first group on the left, the second on the right; beyond two, every curve
    // on one shared axis without a unit. `yAxis` (left, right — on the entity, its graph,
    // entityOptions or the card, see _resolveYAxis) puts a curve on that side whatever its
    // unit: `left` on a whole graph keeps it on one axis.
    _assignYAxes(datasets, entities)
    {
        const _groups = [];
        for( const d of datasets ) if( !_groups.some(u => areSICompatible(u, d.unit)) ) _groups.push(d.unit);
        datasets.forEach((d, i) => {
            const _side = this._resolveYAxis(entities[i]);
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
            const _kind = this._entityKind({ type, interval }, d);
            datasets.push({
                "kind": _kind,
                "name": ( d.name === undefined ) ? this.stateOf(d.entity)?.attributes?.friendly_name : d.name,
                "bColor": this._currentColor(d),
                // (a bar entity shown as a raw curve — interval 4 — isn't filled like a bar;
                // a bar is filled with its own color)
                "fillColor": ( d.type === 'bar' && _kind === 'line' ) ? 'rgba(0,0,0,0)' : ( d.fill === d.color ) ? this._currentColor(d) : parseColor(d.fill),
                "dashMode": d.dashMode,
                "mode": this.normalizeLineMode(d.lineMode) || this.pconfig.defaultLineMode,
                "interpolation": this._resolveInterpolation(d),
                "width": d.width || this.pconfig.defaultLineWidth,
                "showPoints": d.showPoints,
                "showMinMax": d.showMinMax,
                // (period of a circular entity in the units shown, before SI conversion)
                "circular": ( _kind === 'line' || _kind === 'bar' ) ? ( this._circularPeriod(d) ?? 0 ) * Math.abs(d.scale ?? 1) || null : null,
                // (an arrowline's values are angles: a full turn is the entity's circular
                // period, 360 when it has none)
                "arrowPeriod": ( _kind === 'arrowline' ) ? ( this._circularPeriod(d) ?? 360 ) : undefined,
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

    // --------------------------------------------------------------------------------------
    // Rebuilding a graph
    // --------------------------------------------------------------------------------------

    // Builds one graph of group groupId from entities (in that order), right before graph
    // nextG (null: at the end) — combined into one graph whatever their units, each with its
    // persisted entry of that group, its color and fill. options: more addGraph options for
    // each (e.g. the graph's interval; fill: null to recompute it for a new type)
    _rebuildGraph(entities, groupId, nextG, options = {})
    {
        const _saved = this.pconfig.combineSameUnits;
        this.pconfig.combineSameUnits = true;
        entities.forEach((en, i) => {
            const _pe = this.store.inGroup(keyOf(en), groupId);
            this.addGraph(en.entity, { noAutoGroup: i === 0, color: en.color, fill: en.fill, before: nextG, groupId, entry: _pe ?? en, ...options });
        });
        this.pconfig.combineSameUnits = _saved;
    }
}
