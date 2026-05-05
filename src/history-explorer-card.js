
import "../deps/moment.js";
import "../deps/Chart.js";
import "../deps/timeline.js";
import "../deps/md5.js"
import "../deps/FileSaver.js"

import { vertline_plugin, minmaxfill_plugin } from "./history-chart-vline.js";
import { HistoryCSVExporter, StatisticsCSVExporter } from "./history-csv-exporter.js";
import { stateColors, stateColorsDark, defaultColors, parseColor, parseColorRange } from "./history-default-colors.js";
import { setLanguage, i18n } from "./languages.js";
import "./history-info-panel.js"

var Chart = window.HXLocal_Chart;
var moment = window.HXLocal_moment;

const Version = '1.1.13';

// --------------------------------------------------------------------------------------
// SI prefix helpers
// --------------------------------------------------------------------------------------

const SI_PREFIXES = { 'm': 1e-3, '': 1, 'k': 1e3, 'M': 1e6 };

function getSIFactor(unit) {
    if( !unit ) return { base: unit, factor: 1 };
    for( const [prefix, factor] of Object.entries(SI_PREFIXES) ) {
        if( prefix && unit.startsWith(prefix) && unit.length > prefix.length ) {
            return { base: unit.slice(prefix.length), factor };
        }
    }
    return { base: unit, factor: 1 };
}

function areSICompatible(unitA, unitB) {
    if( unitA === unitB ) return true;
    if( !unitA || !unitB ) return false;
    return getSIFactor(unitA).base === getSIFactor(unitB).base;
}

function chooseSIUnit(unitsWithMax) {
    // unitsWithMax: array of { unit, maxVal }
    // Choose the SI unit that minimises the number of digits for the max value
    // Returns { unit, factor } where factor converts from each entity's unit to the chosen unit
    if( !unitsWithMax.length ) return { unit: '', factor: 1 };
    const base = getSIFactor(unitsWithMax[0].unit).base;
    // Compute global max in base unit
    const globalMaxBase = Math.max(...unitsWithMax.map(u => Math.abs(u.maxVal) * getSIFactor(u.unit).factor));
    if( !isFinite(globalMaxBase) || globalMaxBase === 0 ) return { unit: unitsWithMax[0].unit, factor: 1 / getSIFactor(unitsWithMax[0].unit).factor };
    // Pick prefix that gives value between 1 and 999
    let bestPrefix = '', bestFactor = 1;
    for( const [prefix, factor] of Object.entries(SI_PREFIXES) ) {
        const val = globalMaxBase / factor;
        const bestVal = globalMaxBase / bestFactor;
        if( val >= 1 && ( bestVal < 1 || val < bestVal ) ) {
            bestPrefix = prefix;
            bestFactor = factor;
        }
    }
    return { unit: bestPrefix + base, targetFactor: bestFactor };
}


export const isMobile = navigator.maxTouchPoints > 0;


// --------------------------------------------------------------------------------------
// Valid time ranges in hours
// --------------------------------------------------------------------------------------

const ranges = [1, 2, 6, 12, 24, 48, 72, 96, 120, 144, 168, 336, 504, 720, 2184, 4368, 8760];


// --------------------------------------------------------------------------------------
// Shared panning state
// --------------------------------------------------------------------------------------

var panstate = {};
    panstate.mx = 0;
    panstate.lx = 0;
    panstate.my = 0;
    panstate.ly = 0;
    panstate.tc = 0;
    panstate.g 	= null;
    panstate.overlay = null;
    panstate.st0 = null;
    panstate.st1 = null;
    panstate.yaxis = null;
    panstate.pinch = null;  // { p1, p2, distY, y0, y1 } when two fingers active


// --------------------------------------------------------------------------------------
// HA entity history info panel enabled flag
// --------------------------------------------------------------------------------------

export let infoPanelEnabled = !!JSON.parse(window.localStorage.getItem('history-explorer-info-panel'));


// --------------------------------------------------------------------------------------
// Internal card representation and instance state
// --------------------------------------------------------------------------------------

export class HistoryCardState {

    constructor()
    {

        this.colorMap = new Map();
        this.timeCache = new Map();
        this.stateTexts = new Map();
        this.stateMap = new Map();

        this.csvExporter = new HistoryCSVExporter();
        this.statsExporter = new StatisticsCSVExporter();

        this.stateColors = stateColors;
        this.stateColorsDark = stateColorsDark;

        this.ui = {};
        this.ui.dateSelector  = [];
        this.ui.rangeSelector = [];
        this.ui.zoomButton    = [];
        this.ui.inputField    = [];
        this.ui.darkMode      = false;
        this.ui.spinOverlay   = null;
        this.ui.optionStyle   = '';
        this.ui.hideHeader    = false;
        this.ui.hideInterval  = false;
        this.ui.hideSelector  = false;
        this.ui.stickyTools   = 0;
        this.ui.wideInterval  = false;

        this.i18n = {};
        this.i18n.valid                = false;
        this.i18n.styleDateSelector    = '';
        this.i18n.styleTimeTicks       = '';
        this.i18n.styleDateTicks       = '';
        this.i18n.styleDateTimeTooltip = '';

        this.pconfig = {};
        this.pconfig.graphLabelColor      = '#333';
        this.pconfig.graphGridColor       = '#00000000';
        this.pconfig.cursorLineColor      = '#00000000';
        this.pconfig.lineGraphHeight      = 250;
        this.pconfig.barGraphHeight       = 150;
        this.pconfig.timelineBarHeight    = 24;
        this.pconfig.timelineBarSpacing   = 40;
        this.pconfig.labelAreaWidth       = 65;
        this.pconfig.labelsVisible        = true;
        this.pconfig.cursorMode           = 'auto';
        this.pconfig.cursorTypes          = ['all'];
        this.pconfig.showTooltipColors    = [true, true];
        this.pconfig.tooltipSize          = 'auto';
        this.pconfig.tooltipShowDuration  = false;
        this.pconfig.tooltipShowLabel     = true;
        this.pconfig.tooltipStateTextMode = 'raw';
        this.pconfig.closeButtonColor     = undefined;
        this.pconfig.customStateColors    = undefined;
        this.pconfig.colorSeed            = 137;
        this.pconfig.stateTextMode        = 'raw';
        this.pconfig.graphConfig          = [];
        this.pconfig.entityOptions        = undefined;
        this.pconfig.lockAllGraphs        = false;
        this.pconfig.combineSameUnits     = false;
        this.pconfig.recordedEntitiesOnly = false;
        this.pconfig.filterEntities       = undefined;
        this.pconfig.decimation           = 'fast';
        this.pconfig.roundingPrecision    = 2;
        this.pconfig.defaultLineMode      = undefined;
        this.pconfig.defaultLineWidth     = undefined;
        this.pconfig.nextDefaultColor     = 0;
        this.pconfig.showUnavailable      = true;
        this.pconfig.showCurrentValues    = false;
        this.pconfig.axisAddMarginMin     = true;
        this.pconfig.axisAddMarginMax     = true;
        this.pconfig.defaultTimeRange     = '24';
        this.pconfig.defaultTimeOffset    = undefined;
        this.pconfig.timeTickDensity      = 'high';
        this.pconfig.timeTickOverride     = undefined;
        this.pconfig.timeTickShortDate    = false;
        this.pconfig.refreshEnabled       = false;
        this.pconfig.refreshInterval      = undefined;
        this.pconfig.exportSeparator      = undefined;
        this.pconfig.exportTimeFormat     = undefined;
        this.pconfig.exportStatsPeriod    = undefined;
        this.pconfig.entities             = [];
        this._nextGroupId                  = 1;
        this.pconfig.infoPanelConfig      = null;

        this.loader = {};
        this.loader.startTime    = 0;
        this.loader.endTime      = 0;
        this.loader.startIndex   = -1;
        this.loader.endIndex     = -1;
        this.loader.loadingStats = false;

        this.state = {};
        this.state.drag          = false;
        this.state.selecting     = false;
        this.state.updateCanvas  = null;
        this.state.loading       = false;
        this.state.zoomMode      = false;
        this.state.altGraph      = null;
        this.state.autoScroll    = false;

        this.activeRange = {};
        this.activeRange.timeRangeHours  = 24;
        this.activeRange.timeRangeMinutes= 0;
        this.activeRange.tickStepSize    = 1;
        this.activeRange.tickStepUnit    = 'hour';
        this.activeRange.dataClusterSize = 0;

        this.statistics = {};
        this.statistics.enabled = false;
        this.statistics.retention = undefined;
        this.statistics.mode = '';
        this.statistics.period = 'hour';

        this.id = "";

        this.graphs = [];

        this.g_id = 0;
        this.firstDynamicId = 0;

        this.startTime;
        this.endTime;

        this.limitSlot = 0;

        this.cacheSize = 365 + 1;
        this.cache = [];

        this._hass = null;
        this._this = null;
        this.version = [];
        this.contentValid = false;
        this.entitiesPopulated = false;
        this.iid = 0;
        this.tid = 0;
        this.lastWidth = 0;

        this.defocusCall = this.entitySelectorDefocus.bind(this);

        this.databaseCallback = null;

    }


    // --------------------------------------------------------------------------------------
    // Color queries
    // --------------------------------------------------------------------------------------

    normalizeLineMode(m)
    {
        // Accept singular aliases: 'line' -> 'lines', 'curve' -> 'curves', 'step' -> 'stepped'
        if( m === 'line'  ) return 'lines';
        if( m === 'curve' ) return 'curves';
        if( m === 'step'  ) return 'stepped';
        return m;
    }

    getNextDefaultColor()
    {
        let i = this.pconfig.nextDefaultColor++;
        this.pconfig.nextDefaultColor = this.pconfig.nextDefaultColor % defaultColors.length;
        return defaultColors[i];
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


    // --------------------------------------------------------------------------------------
    // Device class or domain specific state localization
    // --------------------------------------------------------------------------------------

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


    // --------------------------------------------------------------------------------------
    // UI element handlers
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

        if( panstate.overlay ) {
            panstate.overlay.remove();
            panstate.overlay = null;
        }
    }

    decZoom()
    {
        this.decZoomStep();
    }

    incZoom()
    {
        this.incZoomStep();
    }

    timeRangeSelected(event)
    {
        this.setTimeRange(event.target.value, true);
    }

    exportFile()
    {
        this.menuSetVisibility(0, false);
        this.menuSetVisibility(1, false);

        this.csvExporter.exportFile(this);
    }

    exportStatistics()
    {
        this.menuSetVisibility(0, false);
        this.menuSetVisibility(1, false);

        this.statsExporter.exportFile(this);
    }

    toggleInfoPanel()
    {
        this.menuSetVisibility(0, false);
        this.menuSetVisibility(1, false);

        if( confirm(infoPanelEnabled ? i18n('ui.popup.disable_panel') : i18n('ui.popup.enable_panel')) ) {
            infoPanelEnabled = !infoPanelEnabled;
            this.writeInfoPanelConfig(true);
            location.reload();
        }
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
    // Display interval for accumulating bar graphs
    // --------------------------------------------------------------------------------------

    selectBarInterval(event)
    {
        const id = event.target.id.substr(event.target.id.indexOf("-") + 1);

        for( let i = 0; i < this.graphs.length; i++ ) {
            if( this.graphs[i].id == id ) {

                this.graphs[i].interval = event.target.value;

                const ntype = ( event.target.value == 4 ) ? 'line' : 'bar';

                if( ntype !== this.graphs[i].type ) {
                    if( ntype == 'line' ) {
                        for( let d of this.graphs[i].chart.data.datasets ) {
                            d.backgroundColor = 'rgba(0,0,0,0)';
                            if( d.borderColor && Array.isArray(d.borderColor) ) d.borderColor = d.borderColor[0];
                        }
                    } else {
                        for( let d of this.graphs[i].chart.data.datasets ) d.backgroundColor = d.borderColor;
                    }

                    this.graphs[i].chart.type = this.graphs[i].chart.config.type = this.graphs[i].type = ntype;
                    this.graphs[i].chart.update();

                    if( this.graphs[i].yaxisLock ) this.scaleLockClicked({currentTarget:{id:`-${i}`}});
                }

                break;
            }
        }

        this.updateHistory();
    }

    createIntervalSelectorHtml(gid, h, selected, optionStyle)
    {
        if( selected === undefined ) selected = 1;

        return `<select id='bd-${gid}' style="position:absolute;right:50px;width:${this.ui.wideInterval ? 100 : 80}px;margin-top:${-h+5}px;color:var(--primary-text-color);background-color:${this.pconfig.closeButtonColor};border:0px solid black;">
                    <option value="0" ${optionStyle} ${(selected == 0) ? 'selected' : ''}>${i18n('ui.interval._10m')}</option>
                    <option value="1" ${optionStyle} ${(selected == 1) ? 'selected' : ''}>${i18n('ui.interval.hourly')}</option>
                    <option value="2" ${optionStyle} ${(selected == 2) ? 'selected' : ''}>${i18n('ui.interval.daily')}</option>
                    <option value="3" ${optionStyle} ${(selected == 3) ? 'selected' : ''}>${i18n('ui.interval.monthly')}</option>
                    <option value="4" ${optionStyle} ${(selected == 4) ? 'selected' : ''}>${i18n('ui.interval.rawline')}</option>
                </select>`;
    }

    parseIntervalConfig(s)
    {
        const options = { '10m' : 0, 'hourly' : 1, 'daily' : 2, 'monthly' : 3 };
        return options[s];
    }


    // --------------------------------------------------------------------------------------
    // Y axis scale lock / unlock
    // --------------------------------------------------------------------------------------

    scaleLockClicked(event)
    {
        const id = event.currentTarget.id.substr(event.currentTarget.id.indexOf("-") + 1);

        for( let i = 0; i < this.graphs.length; i++ ) {
            if( this.graphs[i].id == id ) {
                let c = this.graphs[i].chart;

                if( this.graphs[i].yaxisLock ) {
                    c.options.scales.yAxes[0].ticks.min = c.options.scales.yAxes[0].ticks.forceMin;
                    c.options.scales.yAxes[0].ticks.removeEdgeTicks = false;
                    c.options.scales.yAxes[0].ticks.max = c.options.scales.yAxes[0].ticks.forceMax;
                    c.options.scales.yAxes[0].ticks.removeEdgeTicks = false;
                    this.graphs[i].yaxisLock = 0;
                } else
                    this.graphs[i].yaxisLock = 1;

                this.updateScaleLockState(this.graphs[i], false);

                break;
            }
        }

        this.updateHistory();
    }

    createScaleLockIconHtml(gid, h)
    {
        return `<button id='ca-${gid}' style="position:absolute;left:${(this.pconfig.labelAreaWidth-18) * 0 + 10}px;margin-top:${-h+5}px;background:none;opacity:1.0;border:0px solid black;">
            <svg style='display:none' width="18" height="18" viewBox="0 0 24 24"><path fill="var(--primary-text-color)" d="M12,17C10.89,17 10,16.1 10,15C10,13.89 10.89,13 12,13A2,2 0 0,1 14,15A2,2 0 0,1 12,17M18,20V10H6V20H18M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V10C4,8.89 4.89,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z" /></svg>
            </button>`;
    }

    updateScaleLockState(g, axisInteraction)
    {
        const fixedScale = ( g.chart.options.scales.yAxes[0].ticks.forceMin && g.chart.options.scales.yAxes[0].ticks.forceMax );

        let e = this._this.querySelector(`#ca-${g.id}`);
        if( e ) {
            e.children[0].style.display = ( fixedScale && !axisInteraction ) ? 'none' : 'inherit';
            e.style.opacity = ( axisInteraction || g.yaxisLock ) ? 1.0 : 0.3;
        }
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

    setStepSize(update = false)
    {
        const width = this._this.querySelector('#maincard').clientWidth;

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

        this.setStepSize(!update);

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

            for( let g of this.graphs ) {
                g.chart.options.scales.xAxes[0].time.unit = this.activeRange.tickStepUnit;
                g.chart.options.scales.xAxes[0].time.stepSize = this.activeRange.tickStepSize;
                g.chart.options.scales.xAxes[0].time.min = this.startTime;
                g.chart.options.scales.xAxes[0].time.max = this.endTime;
                g.chart.update();
            }

            this.updateHistory();

        }
    }

    setTimeRangeMinutes(range, update, t_center, t_position = 0.5)
    {
        if( this.state.loading ) return;

        t_position = Math.min(Math.max(t_position, 0.0), 1.0);

        range = Math.max(range, 1);

        this.activeRange.dataClusterSize = 0;

        this.activeRange.timeRangeHours = 0;
        this.activeRange.timeRangeMinutes = range;

        this.setStepSize(!update);

        for( let i of this.ui.rangeSelector ) if( i ) i.value = "0";

        if( update ) {

            if( !t_center )
                t_center = (moment(this.startTime) + moment(this.endTime)) / 2;

            let t1 = moment(t_center).add(this.activeRange.timeRangeMinutes * (1.0 - t_position), "minute");
            let t0 = moment(t1).subtract(this.activeRange.timeRangeMinutes, "minute");
            this.startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
            this.endTime = t1.format("YYYY-MM-DDTHH:mm:ss");

            for( let g of this.graphs ) {
                g.chart.options.scales.xAxes[0].time.unit = this.activeRange.tickStepUnit;
                g.chart.options.scales.xAxes[0].time.stepSize = this.activeRange.tickStepSize;
                g.chart.options.scales.xAxes[0].time.min = this.startTime;
                g.chart.options.scales.xAxes[0].time.max = this.endTime;
                g.chart.update();
            }

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


    // --------------------------------------------------------------------------------------
    // Helper functions
    // --------------------------------------------------------------------------------------

    findFirstIndex(array, range, predicate)
    {
        let l = range.start - 1;
        while( l++ < range.end ) {
            if( predicate(array[l]) ) return l;
        }
        return -1;
    }

    findLastIndex(array, range, predicate)
    {
        let l = range.end + 1;
        while( l-- > range.start ) {
            if( predicate(array[l]) ) return l;
        }
        return -1;
    }


    // --------------------------------------------------------------------------------------
    // Return entity label name with current value
    // --------------------------------------------------------------------------------------

    getFormattedLabelName(name, entity, unit)
    {
        let label = name;
        const p = 10 ** this.pconfig.roundingPrecision;
        const v = Math.round(this._hass.states[entity].state * p) / p;
        if( !isNaN(v) ) {
            label += ' (' + v + (unit ? ' ' + unit : '') + ')';
        }
        return label;
    }


    // --------------------------------------------------------------------------------------
    // Cache control
    // --------------------------------------------------------------------------------------

    initCache()
    {
        let d = moment().format("YYYY-MM-DD") + "T00:00:00";
        d = moment(d).subtract(this.cacheSize, "day").format("YYYY-MM-DD") + "T00:00:00";

        for( let i = 0; i < this.cacheSize+1; i++ ) {
            let e = moment(d).add(1, "day").format("YYYY-MM-DD") + "T00:00:00";
            this.cache.push({ "start" : d, "end" : e, "start_m" : moment(d), "end_m": moment(e), "data" : [], "valid": false });
            d = e;
        }
    }

    growCache(growSize)
    {
        if( this.cacheSize >= 20 * 365 ) return;

        let e = this.cache[0].start;

        for( let i = 0; i < growSize; i++ ) {
            let d = moment(e).subtract(1, "day").format("YYYY-MM-DD") + "T00:00:00";
            this.cache.unshift({ "start" : d, "end" : e, "start_m" : moment(d), "end_m": moment(e), "data" : [], "valid": false });
            e = d;
        }

        this.cacheSize += growSize;

        console.log(`Cache grown from ${this.cacheSize - growSize} to ${this.cacheSize} days`);
    }

    mapStartTimeToCacheSlot(t)
    {
        let mt = moment(t);

        for( let i = 0; i < this.cacheSize+1; i++ ) {
            if( mt >= this.cache[i].start_m && mt < this.cache[i].end_m ) return i;
        }

        if( mt < this.cache[0].start_m ) return 0;

        return -1;
    }

    mapEndTimeToCacheSlot(t)
    {
        let mt = moment(t);

        for( let i = 0; i < this.cacheSize+1; i++ ) {
            if( mt > this.cache[i].start_m && mt <= this.cache[i].end_m ) return i;
        }

        if( mt > this.cache[this.cacheSize].end_m ) return this.cacheSize;

        return -1;
    }

    findCacheEntityIndex(c_id, entity)
    {
        if( !this.cache[c_id].valid ) return -1;

        for( let i = 0; i < this.cache[c_id].entities.length; i++ ) {
            if( this.cache[c_id].entities[i] == entity ) return i;
        }

        return -1;
    }

    generateGraphDataFromCache()
    {
        let c0 = this.mapStartTimeToCacheSlot(this.startTime);
        let c1 = this.mapEndTimeToCacheSlot(this.endTime);

        if( c0 >= 0 && c1 >= 0 ) {

            //console.log(`merge from ${c0} to ${c1}`);

            // Build partial data
            // The result data for the charts is expected in order of the charts entities, but the cache might not hold data
            // for all the entities or it might be in a different order. So for every chart entity, search the cache for a match.
            // If no match found, then add en empty record into the result, so to keep the indices in sync for buildChartData().
            let result = [];
            for( let i = c0; i <= c1; i++ ) {
                let j = 0;
                for( let g of this.graphs ) {
                    for( let e of g.entities ) {
                    if( result[j] == undefined ) result[j] = [];
                        const k = this.findCacheEntityIndex(i, e.entity);
                        if( k >= 0 )
                            result[j] = result[j].concat(this.cache[i].data[k]);
                        j++;
                    }
                }
            }

            // Add the very last state from the cache slot just before the requested one, if possible.
            // This is to ensure that the charts have one data point just before the start of their own data
            // This avoids interpolation issues at the chart start and disappearing states at the beginning of timelines.
            if( c0 > 0 && this.cache[c0-1].valid ) {
                let j = 0;
                for( let g of this.graphs ) {
                    for( let e of g.entities ) {
                        for( let i = c0-1; i >= 0 && this.cache[i].valid; i-- ) {
                            const k = this.findCacheEntityIndex(i, e.entity);
                            if( k >= 0 ) {
                                let n = this.cache[i].data[k].length;
                                if( n > 0 ) {
                                    result[j].unshift({ "last_changed": this.cache[i].data[k][n-1].last_changed, "state": this.cache[i].data[k][n-1].state });
                                    break;
                                }
                            }
                        }
                        j++;
                    }
                }

            }

            this.buildChartData(result);

        } else

            this.buildChartData(null);
    }


    // --------------------------------------------------------------------------------------
    // Search the first cache slot that contains data for the required timecode (full or partial)
    // --------------------------------------------------------------------------------------

    searchFirstAffectedSlot(a, b, t)
    {
        for( let i = a; i <= b; i++ ) {
            if( this.cache[i].end_m >= t ) return i;
        }
        return undefined;
    }


    // --------------------------------------------------------------------------------------
    // On demand history retrieval
    // --------------------------------------------------------------------------------------

    loaderCallback(result)
    {
        //console.log("database retrieval OK");
        //console.log(result);

        if( this.databaseCallback )
            this.databaseCallback(result.length > 0);

        let reload = false;
        let m = 0;

        // Dynamically check if the data pulled from the history DB is still available, if not switch to statistics and reschedule a retrieval
        if( this.statistics.enabled && !this.loader.loadingStats ) {

            // Get the first slot affected by the returned result
            m = this.cacheSize;
            for( let j of result ) {
                let v = this.searchFirstAffectedSlot(this.loader.startIndex, this.loader.endIndex, moment(j[0].last_changed));
                //console.log(`${j[0].entity_id} -> ${j[0].last_changed} -> slot ${v}`);
                if( v && v < m ) m = v;
            }

            // The entire query was out of valid history, the first valid slot is the one after the end of the query (or later, if this was due to a large jump into the past)
            if( !result.length ) {
                //console.log(`result empty, start=${this.loader.startIndex}, end=${this.loader.endIndex}`);
                m = this.loader.endIndex+1;
            }

            // User defined retention period limits
            if( m > this.loader.startIndex && this.statistics.retention ) {
                const limit = this.cacheSize - this.statistics.retention;
                if( m > limit ) {
                    console.warn(`first partial slot ${m}, first history slot is ${limit}`);
                    m = limit;
                }
            }

            // If the first slot with data doesn't cover the full requested time period, then switch to statistics from the that slot and earlier ones
            // Don't switch to statistics on entities that have less than one day of history (newly added to recorder)
            if( m > this.loader.startIndex && m < this.cacheSize ) {
                m++;        // Replace partially filled slot with statistics data
                this.cache[m-1].valid = false;
                this.limitSlot = m-1;
                reload = true;
                //console.log(`Loader switched to statistics (slot ${this.loader.startIndex} to ${this.loader.endIndex}, first full at ${m})`);
            }

        }

        this.loader.loadingStats = false;

        if( this.loader.startIndex == this.loader.endIndex ) {

            // Retrieved data maps to a single slot directly

            if( this.loader.startIndex >= m ) {
                this.cache[this.loader.startIndex].data = result;
                this.cache[this.loader.startIndex].valid = true;
            }

        } else {

            // Retrieved multiple slots, needs to be split accordingly

            for( let i = this.loader.startIndex; i <= this.loader.endIndex; i++ ) {
                this.cache[i].data = [];
                this.cache[i].valid = i >= m;
            }

            for( let j of result ) {

                let p0 = 0;

                for( let i = this.loader.startIndex; i <= this.loader.endIndex; i++ ) {

                    // Find first index that doesn't fit into cache slot [i] anymore (one after the end of the slot data)
                    let t = moment(this.cache[i].end);
                    let p1 = this.findFirstIndex(j, { start: p0, end: j.length-1 }, function(e) { return moment(e.last_changed) >= t });

                    // If none found, this means that everything up to the end goes into the current slot
                    if( p1 < 0 ) p1 = j.length;

                    // Copy the valid part into the current cache slot
                    let r = j.slice(p0, p1);
                    this.cache[i].data.push(r);

                    // Next slot range
                    p0 = p1;

                }

            }

        }

        // Update the list of entities present in the cache slots (the data is in that order)
        for( let i = this.loader.startIndex; i <= this.loader.endIndex; i++ ) {
            this.cache[i].entities = [];
            for( let j of result ) {
                this.cache[i].entities.push(j[0].entity_id);
            }
        }

        this.generateGraphDataFromCache();

        this.state.loading = false;

        if( reload ) this.updateHistory();
    }

    loaderFailed(error)
    {
        console.log("Database request failure");
        console.log(error);

        if( this.databaseCallback )
            this.databaseCallback(false);

        this.buildChartData(null);

        this.state.loading = false;
    }

    loaderCallbackStats(result)
    {
        const m = this.statistics.mode;

        // Build entity -> showMinMax lookup
        const mmMap = {};
        for( const g of this.graphs )
            for( const e of g.entities )
                if( e.showMinMax ) mmMap[e.entity] = e.showMinMax;

        let r = [];

        for( let entity in result ) {
            const a = result[entity];
            const wantMM = mmMap[entity];
            let j = [];
            const pt0 = {'last_changed' : a[0].start, 'state' : a[0][m] ?? a[0].state, 'entity_id' : entity};
            if( wantMM && a[0].min != null ) { pt0.yMin = a[0].min; pt0.yMax = a[0].max ?? a[0].min; }
            j.push(pt0);
            for( let i = 1; i < a.length; i++ ) {
                const pt = {'last_changed' : a[i].start, 'state' : a[i][m] ?? a[i].state};
                if( wantMM && a[i].min != null ) { pt.yMin = a[i].min; pt.yMax = a[i].max ?? a[i].min; }
                j.push(pt);
            }
            r.push(j);
        }

        this.loader.loadingStats = true;

        this.loaderCallback(r);
    }

    minmaxCallback(result)
    {
        // Store hourly min/max keyed by entity then by hour-aligned timestamp (ms)
        if( !this.minmaxCache ) this.minmaxCache = {};
        for( const entity in result ) {
            this.minmaxCache[entity] = {};
            for( const pt of result[entity] ) {
                if( pt.min != null ) {
                    const ts = moment(pt.start).valueOf();
                    this.minmaxCache[entity][ts] = { yMin: pt.min, yMax: pt.max ?? pt.min };
                }
            }
        }
    }

    loaderCallbackWS(result)
    {
        let r = [];

        for( let entity in result ) {
            const a = result[entity];
            let j = [];
            j.push({'last_changed' : a[0].lu * 1000, 'state' : a[0].s, 'entity_id' : entity});
            for( let i = 1; i < a.length; i++ ) {
                j.push({'last_changed' : a[i].lu * 1000, 'state' : a[i].s});
            }
            r.push(j);
        }

        this.loaderCallback(r);
    }


    // --------------------------------------------------------------------------------------
    // User defined state process function
    // --------------------------------------------------------------------------------------

    process(sample, process)
    {
        if( sample === '' || sample === null || sample === undefined ) {
            sample = 'unavailable';
        }

        if( process ) {
            let v = sample * 1.0;
            if( isNaN(v) ) v = sample;
            return process(v);
        } else
            return sample;
    }

    processRaw(sample, process)
    {
        if( sample === null || sample === undefined ) {
            sample = 'unavailable';
        }

        return process ? process(sample) : sample;
    }

    buildProcessFunction(p)
    {
        if( !p ) return null;

        try {
            const f = new Function('state', `"use strict";return (${p});`);
            f('undefined');
            return f;
        } catch( e ) {
            console.warn(e.message);
            return null;
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

    buildChartData(result)
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

                    if( g.type == 'line' ) {

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

                        if( m_now > m_end && s.length > 0 && moment(s[s.length-1].x) < m_end ) {
                            const state = this.process(result[id][n-1].state, process);
                            if( isDataValid(state) ) {
                                const pt = { x: m_end, y: state * scale };
                                const showMM = g.entities[j].showMinMax;
                                if( showMM && result[id][n-1].yMin != null ) { pt.yMin = result[id][n-1].yMin * scale; pt.yMax = result[id][n-1].yMax * scale; }
                                s.push(pt);
                            }
                        } else if( m_now <= m_end && s.length > 0 && moment(s[s.length-1].x) < m_now ) {
                            const state = this.process(result[id][n-1].state, process);
                            if( isDataValid(state) ) {
                                const pt = { x: m_now, y: state * scale };
                                const showMM = g.entities[j].showMinMax;
                                if( showMM && result[id][n-1].yMin != null ) { pt.yMin = result[id][n-1].yMin * scale; pt.yMax = result[id][n-1].yMax * scale; }
                                s.push(pt);
                            }
                        }

                    } else if( g.type == 'bar' && n > 0 ) {

                        const scale = (g.entities[j].scale ?? 1.0) * (g.entities[j].siConversionFactor ?? 1.0);
                        const netBars = g.entities[j].netBars ?? false;

                        const colorRange = ( g.entities[j].color && g.entities[j].color.constructor == Object ) ? g.entities[j].color : null;

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
                            if( colorRange )
                                bcol.push(parseColorRange(colorRange, d));
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

            if( updated ) {
                g.chart.options.scales.xAxes[0].time.unit = this.activeRange.tickStepUnit;
                g.chart.options.scales.xAxes[0].time.stepSize = this.activeRange.tickStepSize;
                g.chart.options.scales.xAxes[0].time.min = this.startTime;
                g.chart.options.scales.xAxes[0].time.max = this.endTime;
                g.chart.update();
            }

        }
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

        var datastructure;

        let scaleUnit;

        if( graphtype == 'line' || graphtype == 'bar' ) {

            datastructure = {
                datasets: []
            };

            for( let d of datasets ) {
                datastructure.datasets.push({
                    borderColor: d.bColor,
                    backgroundColor: d.fillColor,
                    borderWidth: d.width,
                    borderDash: Array.isArray(d.dashMode) ? d.dashMode : ( d.dashMode === 'points' ) ? [1, 5] : ( d.dashMode === 'shortlines' ) ? [5, 5] : ( d.dashMode === 'longlines' ) ? [10, 8] : ( d.dashMode === 'pointline' ) ? [15, 3, 3, 3] : undefined,
                    pointRadius: (() => {
                        if( d.showPoints !== undefined ) {
                            if( d.showPoints === false || d.showPoints === 0 ) return 0;
                            if( d.showPoints === true ) return 4;
                            return +d.showPoints;
                        }
                        return config?.showSamples ? ( config.showSamples === true ? 4 : +config.showSamples ) : 0;
                    })(),
                    pointStyle: 'circle',
                    pointBackgroundColor: d.bColor,
                    pointHoverRadius: (() => {
                        if( d.showPoints !== undefined && d.showPoints !== false && d.showPoints !== 0 ) {
                            const r = d.showPoints === true ? 4 : +d.showPoints;
                            return r + 2;
                        }
                        return config?.showSamples ? ( config.showSamples === true ? 6 : +config.showSamples + 2 ) : 5;
                    })(),
                    hitRadius: 5,
                    label: this.pconfig.showCurrentValues ? this.getFormattedLabelName(d.name, d.entity_id, d.unit) : d.name,
                    name: d.name,
                    steppedLine: d.mode === 'stepped',
                    cubicInterpolationMode: 'monotone',
                    lineTension: ( d.mode === 'lines' || d.mode === 'stepped' ) ? 0 : 0.1,
                    domain: d.domain,
                    entity_id: d.entity_id,
                    unit: d.unit,
                    hidden: d.hidden,
                    showMinMax: d.showMinMax ? true : false,
                    siConversionFactor: d.siConversionFactor,
                    borderJoinStyle: 'round',
                    borderCapStyle: 'round',
                    data: { }
                });
                scaleUnit = scaleUnit ?? d.unit;
                if( d.siConversionFactor !== undefined && datasets._siRefUnit ) scaleUnit = datasets._siRefUnit;
            }

        } else if( graphtype == 'timeline' || graphtype == 'arrowline' ) {

            datastructure = {
                labels: [ ],
                datasets: [ ]
            };

            // Helper: wrap label to 2 lines if too long for labelAreaWidth
            const _wrapLabel = (name) => {
                if( !name || !this.pconfig.labelsVisible ) return '';
                const _availW = this.pconfig.labelAreaWidth - 8;
                // Use an offscreen canvas to measure text accurately
                const _mc = document.createElement('canvas').getContext('2d');
                _mc.font = '12px "Helvetica Neue", Helvetica, Arial, sans-serif';
                if( _mc.measureText(name).width <= _availW ) return name;
                // Try to split at a word boundary
                const _words = name.split(' ');
                if( _words.length > 1 ) {
                    let _line1 = '', _line2 = '';
                    for( let _wi = 0; _wi < _words.length; _wi++ ) {
                        const _try = _line1 ? _line1 + ' ' + _words[_wi] : _words[_wi];
                        if( _mc.measureText(_try).width <= _availW ) {
                            _line1 = _try;
                        } else {
                            _line2 = _words.slice(_wi).join(' ');
                            break;
                        }
                    }
                    if( _line1 && _line2 ) return [_line1, _line2];
                }
                // No word boundary — split at character level
                let _split = 0;
                for( let _ci = 1; _ci <= name.length; _ci++ ) {
                    if( _mc.measureText(name.substring(0, _ci)).width <= _availW ) _split = _ci;
                    else break;
                }
                return [name.substring(0, _split), name.substring(_split)];
            };

            for( let d of datasets ) {
                datastructure.labels.push(this.pconfig.labelsVisible ? _wrapLabel(d.name) : '');
                datastructure.datasets.push({
                    domain: d.domain,
                    device_class: d.device_class,
                    entity_id: d.entity_id,
                    unit: d.unit,
                    arrowColor: d.bColor,
                    arrowBackground: d.fillColor,
                    data: [ ]
                });
            }

        }

        const tooltipSize = this.pconfig.tooltipSize;

        var chart = new Chart(ctx, {

            type: graphtype,

            data: datastructure,

            options: {
                scales: {
                    xAxes: [{
                        type: ( graphtype == 'line' || graphtype == 'bar' ) ? 'time' : ( graphtype == 'arrowline' ) ? 'arrowline' : 'timeline',
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
                    yAxes: [{
                        afterFit: (scaleInstance) => {
                            scaleInstance.width = this.pconfig.labelAreaWidth;
                        },
                        afterDataLimits: (me) => {
                            const epsilon = 0.0001;
                            if( config?.ymin == null && this.pconfig.axisAddMarginMin && graphtype == 'line' ) me.min -= epsilon;
                            if( config?.ymax == null && this.pconfig.axisAddMarginMax && graphtype == 'line' ) me.max += epsilon;
                        },
                        ticks: {
                            fontColor: this.pconfig.graphLabelColor,
                            min: config?.ymin ?? undefined,
                            max: config?.ymax ?? undefined,
                            forceMin: config?.ymin ?? undefined,
                            forceMax: config?.ymax ?? undefined,
                            stepSize: config?.ystepSize ?? undefined
                        },
                        gridLines: {
                            color: ( graphtype == 'line' || graphtype == 'bar' || datasets.length > 1 ) ? this.pconfig.graphGridColor : 'rgba(0,0,0,0)'
                        },
                        scaleLabel: {
                            display: scaleUnit !== undefined && scaleUnit !== '' && this.pconfig.labelsVisible,
                            labelString: scaleUnit,
                            fontColor: this.pconfig.graphLabelColor
                        },
                        barThickness: this.pconfig.timelineBarHeight - 4,
                        stacked: config?.stacked
                    }],
                },
                topClipMargin : ( config?.ymax == null ) ? 4 : 1,
                bottomClipMargin: ( config?.ymin == null ) ? 4 : 1,
                layout: {
                    padding: {
                        top: ( graphtype === 'timeline' || graphtype === 'arrowline' ) ? 24 : 0
                    }
                },
                animation: {
                    duration: 0
                },
                tooltips: {
                    callbacks: {
                        label: (item, data) => {
                            if( graphtype == 'line' || graphtype == 'bar' ) {
                                let label = '';
                                if( this.pconfig.tooltipShowLabel ) label = data.datasets[item.datasetIndex].name || '';
                                if( label ) label += ': ';
                                const p = 10 ** this.pconfig.roundingPrecision;
                                const _siFactor = data.datasets[item.datasetIndex].siConversionFactor ?? 1;
                                label += Math.round(item.yLabel / _siFactor * p) / p;
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
                                    let d = data.labels[tooltipItems[0].datasetIndex];
                                    title = ( tooltipSize !== 'slim' ) ? d : '';
                                }
                            }
                            return title;
                        }
                    },
                    yAlign: ( graphtype == 'line' || graphtype == 'bar' ) ? undefined : 'nocenter',
                    caretPadding: 8,
                    displayColors: ( graphtype == 'line' ) ? this.pconfig.showTooltipColors[0] : ( graphtype == 'timeline' ) ? this.pconfig.showTooltipColors[1] : false
                },
                hover: {
                    mode: 'nearest',
                    intersect: graphtype != 'line'
                },
                legend: {
                    display: ( graphtype == 'line' || graphtype == 'bar' ) && this.pconfig.hideLegend != true,
                    labels: {
                        fontColor: this.pconfig.graphLabelColor,
                        usePointStyle: ( graphtype == 'line' || (graphtype == 'bar' && datasets.length > 1) ),
                        boxWidth: 0
                    },
                    onClick: (e, legendItem) => {
                        // Double-click: uncombine the dataset into its own graph
                        // Single-click: toggle visibility (default Chart.js behavior)
                        const now = Date.now();
                        const canvas = e.target?.closest('canvas');
                        if( !canvas ) return;
                        const g = this.graphs.find(g => g.canvas === canvas);
                        const chart = g?.chart;
                        if( !chart ) return;
                        if( !g ) return;
                        const idx = legendItem.datasetIndex;
                        if( !this._uncombineInProgress && g._lastLegendClick && g._lastLegendClickIdx === idx && now - g._lastLegendClick < 400 ) {
                            // Double-click — uncombine
                            g._lastLegendClick = null;
                            this._uncombineInProgress = true;
                            setTimeout(() => { this._uncombineInProgress = false; }, 500);
                            if( g.entities.length > 1 ) {
                                const entity = g.entities[idx];
                                const newEntities = g.entities.filter((_, i) => i !== idx);
                                // Reset SI conversion factors
                                entity.siConversionFactor = undefined;
                                newEntities.forEach(en => { en.siConversionFactor = undefined; });
                                // Assign a new unique groupId to the extracted entity
                                const _newGroupId = this._nextGroupId++;
                                const _eIdx = this.pconfig.entities.findIndex(en => (typeof en === 'string' ? en : en.entity) === entity.entity);

                                if( _eIdx >= 0 ) this.pconfig.entities[_eIdx] = { entity: entity.entity, groupId: _newGroupId, color: entity.color, fill: entity.fill };

                                this.writeLocalState();
                                // Remember insertion point before removing
                                const _graphDiv = g.canvas.parentNode.parentNode; // wrapper e
                                const _gl = _graphDiv.parentNode; // #graphlist
                                // Find next sibling that is still in DOM (skip stale refs)
                                let _nextSibling = _graphDiv.nextSibling;
                                while( _nextSibling && !_gl.contains(_nextSibling) )
                                    _nextSibling = _nextSibling.nextSibling;
                                const _insertIdx = this.graphs.indexOf(g);
                                // Remove current graph from DOM and graph list
                                _graphDiv.remove();
                                this.graphs.splice(_insertIdx, 1);
                                // Re-add remaining entities then extracted entity (appended to end)
                                const _graphsBefore = this.graphs.length;
                                const _savedCombine = this.pconfig.combineSameUnits;
                                this.pconfig.combineSameUnits = true;
                                newEntities.forEach((en, i) => {
                                this.addDynamicGraph(en.entity, i === 0, en.color, en.fill, i === 0 ? null : this.graphs[this.graphs.length - 1]);
                            });
                                this.pconfig.combineSameUnits = _savedCombine;
                                this.addDynamicGraph(entity.entity, true, entity.color, entity.fill);
                                // Move newly created graph divs to correct position
                                const _newDivs = [];
                                for( let i = _graphsBefore; i < this.graphs.length; i++ )
                                    _newDivs.push(this.graphs[i].canvas.parentNode.parentNode); // wrapper e
                                for( let _div of _newDivs ) {
                                    if( _nextSibling && _gl.contains(_nextSibling) ) _gl.insertBefore(_div, _nextSibling);
                                    else _gl.appendChild(_div);
                                }
                                this.updateHistory();
                            }
                        } else {
                            // Single-click — default toggle visibility
                            g._lastLegendClick = now;
                            g._lastLegendClickIdx = idx;
                            const meta = chart.getDatasetMeta(idx);
                            meta.hidden = meta.hidden === null ? !chart.data.datasets[idx].hidden : null;
                            chart.update();
                            // Persist hidden state
                            const _hiddenState = meta.hidden !== null ? meta.hidden : chart.data.datasets[idx].hidden;
                            const _eIdx = this.pconfig.entities.findIndex(en => (typeof en === 'string' ? en : en.entity) === g.entities[idx].entity);
                            if( _eIdx >= 0 ) this.pconfig.entities[_eIdx].hidden = _hiddenState || undefined;
                            this.writeLocalState();
                        }
                    }
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
                    vertline: {
                        color: this.pconfig.cursorLineColor
                    }
                }
            },

            plugins: [vertline_plugin, minmaxfill_plugin]

        });

        chart.callerInstance = this;

        return chart;
    }


    // --------------------------------------------------------------------------------------
    // Rebuild the charts for the current start and end time, load cache as needed
    // --------------------------------------------------------------------------------------

    updateHistory()
    {
        if( this.tid ) {
            clearTimeout(this.tid);
            this.tid = 0;
        }

        for( let i of this.ui.dateSelector )
            if( i ) i.innerHTML = moment(this.startTime).format(this.i18n.styleDateSelector);

        // Prime the cache on first call
        if( !this.cache.length ) this.initCache();

        // Check if we need to grow the cache due to an overflow
        if( moment(this.startTime) < this.cache[0].start_m ) this.growCache(365);

        // Get cache slot indices for beginning and end of requested time range
        let c0 = this.mapStartTimeToCacheSlot(this.startTime);
        let c1 = this.mapEndTimeToCacheSlot(this.endTime);

        //console.log(`Slots ${c0} to ${c1}`);

        // Get the cache slot (sub)range that needs to be retrieved from the db
        let l0 = ( c0 >= 0 ) ? this.findFirstIndex(this.cache, { 'start': c0, 'end': c1 }, function(e) { return !e.valid; }) : -1;
        let l1 = ( c1 >= 0 ) ? this.findLastIndex(this.cache, { 'start': c0, 'end': c1 }, function(e) { return !e.valid; }) : -1;

        if( l0 >= 0 ) {

            // Requested data range is not yet loaded. Get it from database first and update the chart data aysnc when fetched.

            // TODO: handle this with a scheduled reload
            if( this.state.loading ) {
                if( l0 >= this.loader.startIndex && l1 <= this.loader.endIndex ) return;
                console.log(`Slots ${l0} to ${l1} need loading`);
                console.log(`Double loading blocked, slots ${this.loader.startIndex} to ${this.loader.endIndex} are currently loading`);
                return;
            }

            //console.log(`Slots ${l0} to ${l1} need loading`);

            this.loader.startTime = this.cache[l0].start;
            this.loader.endTime = this.cache[l1].end;
            this.loader.startIndex = l0;
            this.loader.endIndex = l1;

            // Prepare db retrieval request for all visible entities
            let n = 0;
            let t0 = this.loader.startTime.replace('+', '%2b');
            let t1 = this.loader.endTime.replace('+', '%2b');
            let l = [];
            for( let g of this.graphs ) {
                for( let e of g.entities ) {
                    l.push(e.entity);
                    n++;
                }
            }

            if( n > 0 ) {

                this.state.loading = true;

                if( this.statistics.force )
                    this.limitSlot = this.cacheSize + 1;

                if( !this.statistics.enabled || l0 > this.limitSlot ) {

                    // Issue history retrieval call, initiate async cache loading
                    const d = {
                        type: "history/history_during_period",
                        start_time: moment(t0).format('YYYY-MM-DDTHH:mm:ssZ'),
                        end_time: moment(t1).format('YYYY-MM-DDTHH:mm:ssZ'),
                        minimal_response: true,
                        no_attributes: true,
                        entity_ids: l
                    };
                    this._hass.callWS(d).then(this.loaderCallbackWS.bind(this), this.loaderFailed.bind(this));

                    // Parallel statistics query for entities with showMinMax:'history'/'states'
                    const lmm = [];
                    for( const g of this.graphs )
                        for( const e of g.entities ) {
                            const v = e.showMinMax;
                            if( v === 'history' || v === 'states' || v === true || v === 'statistics' )
                                lmm.push(e.entity);
                        }
                    if( lmm.length ) {
                        const dmm = {
                            type: ( this.version[0] > 2022 || this.version[1] >= 11 ) ? 'recorder/statistics_during_period' : 'history/statistics_during_period',
                            start_time: moment(t0).format('YYYY-MM-DDTHH:mm:ssZ'),
                            end_time: moment(t1).format('YYYY-MM-DDTHH:mm:ssZ'),
                            period: this.statistics.period ?? 'hour',
                            statistic_ids: lmm
                        };
                        this._hass.callWS(dmm).then(this.minmaxCallback.bind(this), () => {});
                    }

                } else {

                    // Issue statistics retrieval call
                    const d = {
                        type: ( this.version[0] > 2022 || this.version[1] >= 11 ) ? "recorder/statistics_during_period" : "history/statistics_during_period",
                        start_time: moment(t0).format('YYYY-MM-DDTHH:mm:ssZ'),
                        end_time: moment(t1).format('YYYY-MM-DDTHH:mm:ssZ'),
                        period: this.statistics.period,
                        statistic_ids: l
                    };
                    this._hass.callWS(d).then(this.loaderCallbackStats.bind(this), this.loaderFailed.bind(this));

                }

            }

        } else

            // All needed slots already in the cache, generate the chart data
            this.generateGraphDataFromCache();
    }

    updateHistoryAutoRefresh()
    {
        const now = moment();
        const last = moment(this.endTime);

        // If auto scroll is allowed (scrolled at or past the previous last event) then adjust the x position
        // if the new event is past the visible graph area.
        if( this.state.autoScroll && last < now ) {
            this.today();
        } else {
            this.updateHistory();
        }
    }

    updateHistoryWithClearCache()
    {
        if( !this.state.loading ) {
            this.cache.length = 0;
            this.updateHistory();
        }
    }

    updateAxes()
    {
        for( let g of this.graphs ) {
            if( !this.state.updateCanvas || this.state.updateCanvas === g.canvas ) {
                g.chart.options.scales.xAxes[0].time.min = this.startTime;
                g.chart.options.scales.xAxes[0].time.max = this.endTime;
                g.chart.update();
            }
        }
    }


    // --------------------------------------------------------------------------------------
    // Panning
    // --------------------------------------------------------------------------------------


    pixelPositionToTimecode(x)
    {
        const f = (x - panstate.g.chart.chartArea.left) / (panstate.g.chart.chartArea.right - panstate.g.chart.chartArea.left);

        return this.factorToTimecode(f);
    }

    factorToTimecode(f)
    {
        return moment(this.startTime) + moment(this.endTime).diff(this.startTime) * f;
    }

    yAxisPointerDown(event)
    {
        try { event.target.setPointerCapture(event.pointerId); } catch(e) {}
        for( let g of this.graphs ) {
            if( this._this.querySelector(`#ya-${g.id}`) === event.target ) {
                panstate.yaxis = {
                    g,
                    startY: event.clientY,
                    y0: g.chart.scales['y-axis-0'].min,
                    y1: g.chart.scales['y-axis-0'].max
                };
                break;
            }
        }
        event.preventDefault();
        event.stopPropagation();
    }

    yAxisPointerMove(event)
    {
        if( !panstate.yaxis ) return;
        const p     = panstate.yaxis;
        const g     = p.g;
        const h     = g.chart.chartArea.bottom - g.chart.chartArea.top;
        const dy    = event.clientY - p.startY;
        const shift = dy * (p.y1 - p.y0) / h;
        g.chart.options.scales.yAxes[0].ticks.min = p.y0 + shift;
        g.chart.options.scales.yAxes[0].ticks.max = p.y1 + shift;
        g.chart.options.scales.yAxes[0].ticks.removeEdgeTicks = true;
        if( g.yaxisLock !== 2 ) this.updateScaleLockState(g, true);
        g.yaxisLock = 2;
        g.chart.update();
    }

    yAxisPointerUp(event)
    {
        panstate.yaxis = null;
    }

    _showLabelTooltip(label, clientX, clientY) {
        const _existing = document.getElementById('hec-label-tooltip');
        if( _existing ) _existing.remove();
        const _tip = document.createElement('div');
        _tip.id = 'hec-label-tooltip';
        _tip.textContent = label;
        _tip.style.cssText = 'position:fixed;z-index:9999;background:var(--card-background-color,#fff);color:var(--primary-text-color,#333);border:1px solid var(--divider-color,#ccc);border-radius:4px;padding:4px 8px;font-size:12px;pointer-events:none;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2);transition:opacity 1.5s ease;opacity:1;';
        _tip.style.left = (clientX + 10) + 'px';
        _tip.style.top  = (clientY - 16) + 'px';
        document.body.appendChild(_tip);
        setTimeout(() => { _tip.style.opacity = '0'; }, 500);
        setTimeout(() => { if( _tip.parentNode ) _tip.remove(); }, 2000);
    }

    _getScrollContainer() {
        return document.scrollingElement || document.documentElement;
    }

    // ── Drag visual feedback helpers ──────────────────────────────────────────

    _createGhost(text, width, height, clientX, clientY, anchor='center', color=null) {
        this._destroyGhost();
        const el = document.createElement('div');
        el.id = '_hec_ghost';
        el.dataset.anchor = anchor;
        const _transform = anchor === 'topleft' ? 'translate(-9px,-18px)' : 'translate(-50%,-50%)';
        const _borderColor = color || 'var(--primary-color,#03a9f4)';
        el.style.cssText = `position:fixed;pointer-events:none;z-index:9999;opacity:0.65;` +
            `background:var(--card-background-color,#fff);border:2px solid ${_borderColor};` +
            `border-radius:4px;padding:2px 8px;font-size:12px;white-space:nowrap;` +
            `box-shadow:0 2px 8px rgba(0,0,0,0.25);transform:${_transform};` +
            `width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;` +
            `overflow:hidden;text-overflow:ellipsis;`;
        el.textContent = text || '';
        document.body.appendChild(el);
        this._moveGhost(clientX, clientY);
        return el;
    }

    _moveGhost(clientX, clientY) {
        const el = document.getElementById('_hec_ghost');
        if( el ) { el.style.left = clientX + 'px'; el.style.top = clientY + 'px'; }
    }

    _destroyGhost() {
        const el = document.getElementById('_hec_ghost');
        if( el ) el.remove();
    }

    _showInsertionMarker(x, y, width, height, horizontal, color) {
        let el = document.getElementById('_hec_insert');
        if( !el ) {
            el = document.createElement('div');
            el.id = '_hec_insert';
            document.body.appendChild(el);
        }
        const _c = color || 'var(--primary-color,#03a9f4)';
        if( horizontal ) {
            // Horizontal line for timeline/arrowline and graph drag (top/bottom insertion)
            el.style.cssText = `position:fixed;pointer-events:none;z-index:9999;` +
                `left:${x}px;top:${y - 1}px;width:${width}px;height:3px;` +
                `background:${_c};border-radius:2px;`;
            el.innerHTML = `<div style="position:absolute;left:-8px;top:-4px;width:0;height:0;` +
                `border-top:5px solid transparent;border-bottom:5px solid transparent;` +
                `border-left:8px solid ${_c};"></div>`;
        } else {
            // Vertical line for legend (left/right insertion) — 1.5x height, offset left to avoid color dot
            const _h15 = Math.round(height * 1.5);
            const _yOff = Math.round((height - _h15) / 2);
            el.style.cssText = `position:fixed;pointer-events:none;z-index:9999;` +
                `left:${x - 6}px;top:${y + _yOff}px;width:3px;height:${_h15}px;` +
                `background:${_c};border-radius:2px;`;
            el.innerHTML = `<div style="position:absolute;top:-2px;left:-4px;width:0;height:0;` +
                `border-left:5px solid transparent;border-right:5px solid transparent;` +
                `border-top:5px solid ${_c};"></div>`;
        }
    }

    _hideInsertionMarker() {
        const el = document.getElementById('_hec_insert');
        if( el ) el.remove();
    }

    _highlightDropTarget(canvasEl, valid) {
        this._clearDropHighlight();
        if( !canvasEl ) return;
        const wrapper = canvasEl.parentNode;
        if( !wrapper ) return;
        wrapper._hec_prev_outline = wrapper.style.outline;
        wrapper._hec_prev_outline_offset = wrapper.style.outlineOffset;
        wrapper.style.outline = `2px ${valid ? 'solid' : 'dashed'} ${valid ? 'var(--primary-color,#03a9f4)' : 'var(--error-color,#f44336)'}`;
        wrapper.style.outlineOffset = '-2px';
        this._hec_highlight_el = wrapper;
    }

    _clearDropHighlight() {
        if( this._hec_highlight_el ) {
            this._hec_highlight_el.style.outline = this._hec_highlight_el._hec_prev_outline || '';
            this._hec_highlight_el.style.outlineOffset = this._hec_highlight_el._hec_prev_outline_offset || '';
            this._hec_highlight_el = null;
        }
    }

    _clearAllDragFeedback() {
        this._destroyGhost();
        this._hideInsertionMarker();
        this._clearDropHighlight();
        this._unfreezeChart();
    }

    _freezeChart(g) {
        if( this._frozenChart === g ) return;
        this._frozenChart = g || null;
    }

    _unfreezeChart() {
        this._frozenChart = null;
    }

    // Find legend label index using closest-Y then closest-X logic
    // Returns { idx, insertBefore, markerX, markerY, markerH } or null
    // Find legend label by closest-Y then closest-X
    // target=false: finding the source to grab (no no-op check, strict X bounds)
    // target=true:  finding the insertion target (no-op check, excludeIdx = source)
    _findLegendLabel(hitBoxes, cx, cy, excludeIdx, target) {
        if( !hitBoxes || hitBoxes.length === 0 ) return null;

        // Group labels by line (same top ± 4px tolerance), excluding source when finding target
        const lines = [];
        for( let i = 0; i < hitBoxes.length; i++ ) {
            if( target && i === excludeIdx ) continue;
            const b = hitBoxes[i];
            let line = lines.find(l => Math.abs(l.top - b.top) <= 4);
            if( !line ) { line = { top: b.top, height: b.height, items: [] }; lines.push(line); }
            line.items.push({ b, i });
        }
        if( lines.length === 0 ) return null;

        // Find closest line by Y — must be within the Y band of that line
        let closestLine = null, closestDistY = Infinity;
        for( let line of lines ) {
            const midY = line.top + line.height / 2;
            const dist = Math.abs(cy - midY);
            if( dist < closestDistY ) { closestDistY = dist; closestLine = line; }
        }
        if( !closestLine ) return null;
        if( cy < closestLine.top || cy > closestLine.top + closestLine.height ) return null;

        // Limit X to the bounds of the line (leftmost label left, rightmost label right)
        const lineLeft  = Math.min(...closestLine.items.map(x => x.b.left));
        const lineRight = Math.max(...closestLine.items.map(x => x.b.left + x.b.width));
        if( cx < lineLeft || cx > lineRight ) return null;

        // Find closest label by X on this line
        let closest = null, closestDistX = Infinity;
        for( let item of closestLine.items ) {
            const midX = item.b.left + item.b.width / 2;
            const dist = Math.abs(cx - midX);
            if( dist < closestDistX ) { closestDistX = dist; closest = item; }
        }
        if( !closest ) return null;

        const insertBefore = cx < closest.b.left + closest.b.width / 2;

        if( !target ) {
            // Source grab — just return the found label, no marker, no no-op check
            return { idx: closest.i };
        }

        // Marker X: midpoint between neighbors on the same line, or margin for first/last
        const MARGIN = 6;
        let markerX;
        if( insertBefore ) {
            const leftNeighbor = closestLine.items
                .filter(x => x.i !== closest.i && x.b.left + x.b.width <= closest.b.left)
                .sort((a, b) => b.b.left - a.b.left)[0];
            markerX = leftNeighbor
                ? (leftNeighbor.b.left + leftNeighbor.b.width + closest.b.left) / 2
                : closest.b.left - MARGIN;
        } else {
            const rightNeighbor = closestLine.items
                .filter(x => x.i !== closest.i && x.b.left >= closest.b.left + closest.b.width)
                .sort((a, b) => a.b.left - b.b.left)[0];
            markerX = rightNeighbor
                ? (closest.b.left + closest.b.width + rightNeighbor.b.left) / 2
                : closest.b.left + closest.b.width + MARGIN;
        }

        // No-op detection: same logic as pointerUp _insertAt calculation
        const tgt = closest.i;
        const src = excludeIdx;
        let insertAt;
        if( tgt > src ) insertAt = insertBefore ? tgt - 1 : tgt;
        else            insertAt = insertBefore ? tgt : tgt + 1;
        if( insertAt === src ) return null;

        return { idx: closest.i, insertBefore, markerX, markerY: closestLine.top, markerH: closestLine.height };
    }

    _startAutoScroll(event) {
        this._stopAutoScroll();
        const _scroll = () => {
            if( !this._autoScrollActive ) return;
            const _container = this._getScrollContainer();
            if( !_container ) { this._autoScrollRaf = requestAnimationFrame(_scroll); return; }
            const _threshold = 80;
            const _y = this._autoScrollY;
            const _viewH = window.innerHeight;
            let _speed = 0;
            if( _y < _threshold )
                _speed = -Math.round((_threshold - _y) / 4);
            else if( _y > _viewH - _threshold )
                _speed = Math.round((_threshold - (_viewH - _y)) / 4);
            if( _speed !== 0 ) _container.scrollTop += _speed;
            this._autoScrollRaf = requestAnimationFrame(_scroll);
        };
        this._autoScrollActive = true;
        this._autoScrollY = event.clientY;
        this._autoScrollRaf = requestAnimationFrame(_scroll);
    }

    _stopAutoScroll() {
        this._autoScrollActive = false;
        if( this._autoScrollRaf ) { cancelAnimationFrame(this._autoScrollRaf); this._autoScrollRaf = null; }
    }

    graphMoveStart(event)
    {
        event.preventDefault();
        event.stopPropagation();
        try { event.target.setPointerCapture(event.pointerId); } catch(e) {}
        // Find which graph this mo overlay belongs to
        for( let g of this.graphs ) {
            if( this._this.querySelector(`#mo-${g.id}`) === event.target ) {
                panstate.moveGraph = { g, startX: event.clientX, startY: event.clientY };
                event.target.style.cursor = 'grabbing';
                // Ghost: full graph size, anchored at top-left (domino position)
                const _gRect = g.canvas.getBoundingClientRect();
                this._createGhost('', _gRect.width, _gRect.height, event.clientX, event.clientY, 'topleft');
                this._startAutoScroll(event);
                break;
            }
        }
    }

    graphMoveMove(event)
    {
        if( !panstate.moveGraph ) return;
        event.preventDefault();
        event.stopPropagation();
        event.target.style.cursor = 'grabbing';
        this._autoScrollY = event.clientY;
        this._moveGhost(event.clientX, event.clientY);
        // Find graph under pointer for insertion marker
        let _found = false;
        for( let g of this.graphs ) {
            if( g === panstate.moveGraph.g ) continue;
            const _r = g.canvas.getBoundingClientRect();
            if( event.clientX >= _r.left && event.clientX <= _r.right &&
                event.clientY >= _r.top  && event.clientY <= _r.bottom ) {
                const _insertBefore = event.clientY < _r.top + _r.height / 2;
                const _y = _insertBefore ? _r.top : _r.bottom;
                this._showInsertionMarker(_r.left, _y, _r.width, 3, true);
                _found = true;
                break;
            }
        }
        if( !_found ) { this._hideInsertionMarker(); this._clearDropHighlight(); }
    }

    graphMoveEnd(event)
    {
        if( !panstate.moveGraph ) return;
        event.preventDefault();
        event.stopPropagation();
        const _srcG = panstate.moveGraph.g;
        const _moveStartX = panstate.moveGraph.startX;
        const _moveStartY = panstate.moveGraph.startY;
        panstate.moveGraph = null;
        event.target.style.cursor = 'grab';
        this._stopAutoScroll();
        this._clearAllDragFeedback();

        // If movement < 5px, treat as click — forward to padlock
        const _dx = Math.abs(event.clientX - _moveStartX);
        const _dy = Math.abs(event.clientY - _moveStartY);
        if( _dx < 5 && _dy < 5 ) {
            this._this.querySelector(`#ca-${_srcG.id}`)?.click();
            return;
        }

        // Find target graph under pointer
        let _tgtG = null;
        let _insertBefore = true; // above or below midpoint
        for( let g of this.graphs ) {
            if( g === _srcG ) continue;
            const _rect = g.canvas.getBoundingClientRect();
            if( event.clientX >= _rect.left && event.clientX <= _rect.right &&
                event.clientY >= _rect.top  && event.clientY <= _rect.bottom ) {
                _tgtG = g;
                _insertBefore = event.clientY < _rect.top + _rect.height / 2;
                break;
            }
        }

        if( !_tgtG || _tgtG === _srcG ) return;

        // Reorder in DOM — re-query by ID to get fresh refs after potential HA re-render
        const _gl = this._this.querySelector('#graphlist');
        const _srcCanvas = this._this.querySelector(`#graph${_srcG.id}`);
        const _tgtCanvas = this._this.querySelector(`#graph${_tgtG.id}`);
        if( !_srcCanvas || !_tgtCanvas || !_gl ) return;
        // Canvas -> position:relative div -> wrapper div (direct child of #graphlist)
        const _srcDiv = _srcCanvas.parentNode.parentNode;
        const _tgtDiv = _tgtCanvas.parentNode.parentNode;
        if( _srcDiv.parentNode !== _gl || _tgtDiv.parentNode !== _gl ) return;
        if( _insertBefore ) {
            _gl.insertBefore(_srcDiv, _tgtDiv);
        } else {
            const _next = _tgtDiv.nextSibling;
            if( _next && _next.parentNode === _gl ) {
                _gl.insertBefore(_srcDiv, _next);
            } else {
                _gl.appendChild(_srcDiv);
            }
        }

        // Reorder in this.graphs
        const _srcIdx = this.graphs.indexOf(_srcG);
        const _tgtIdx = this.graphs.indexOf(_tgtG);
        this.graphs.splice(_srcIdx, 1);
        const _newTgtIdx = this.graphs.indexOf(_tgtG);
        if( _insertBefore ) {
            this.graphs.splice(_newTgtIdx, 0, _srcG);
        } else {
            this.graphs.splice(_newTgtIdx + 1, 0, _srcG);
        }

        // Reorder pconfig.entities to match new graph order
        // Only reorder dynamic entities (those in pconfig.entities)
        const _orderedEntities = [];
        for( let g of this.graphs ) {
            for( let en of g.entities ) {
                const _found = this.pconfig.entities.find(e => (typeof e === 'string' ? e : e.entity) === en.entity);
                if( _found ) _orderedEntities.push(_found);
            }
        }
        // Keep any entities not in graphs (shouldn't happen but safety net)
        for( let e of this.pconfig.entities ) {
            const _eid = typeof e === 'string' ? e : e.entity;
            if( !_orderedEntities.find(o => (typeof o === 'string' ? o : o.entity) === _eid) )
                _orderedEntities.push(e);
        }
        this.pconfig.entities = _orderedEntities;
        this.writeLocalState();
    }

    pointerDown(event)
    {
        panstate.g = null;

        for( let g of this.graphs ) {
            if( g.canvas === event.target ) {
                panstate.g = g;
                g.chart.options.tooltips.enabled = false;
                if( g.type !== 'timeline' && g.type !== 'arrowline' ) {
                    g.chart.options.scales.yAxes[0].ticks.min = panstate.y0 = g.chart.scales["y-axis-0"].min;
                    g.chart.options.scales.yAxes[0].ticks.max = panstate.y1 = g.chart.scales["y-axis-0"].max;
                }
                g.chart.options.topClipMargin = 0;
                g.chart.options.bottomClipMargin = 0;
                break;
            }
        }

        if( panstate.g ) {

            this.state.autoScroll = false;

            panstate.mx = event.clientX;
            panstate.lx = event.clientX;
            panstate.my = event.clientY;
            panstate.ly = event.clientY;

            event.target?.setPointerCapture(event.pointerId);

            // Check if click is on a legend item — start drag if so
            panstate.dragDataset = null;
            const _chart = panstate.g.chart;

            // Check if click is on the label area of a timeline/arrowline graph
            if( panstate.g.type === 'timeline' || panstate.g.type === 'arrowline' ) {
                const _rect2 = event.target.getBoundingClientRect();
                const _cx2 = event.clientX - _rect2.left;
                const _cy2 = event.clientY - _rect2.top;
                if( _chart.chartArea && _cx2 < _chart.chartArea.left ) {
                    const _yScale = _chart.scales['y-axis-0'];
                    if( _yScale && _chart.data.labels ) {
                        let _closestIdx = -1;
                        let _closestDist = Infinity;
                        for( let _li = 0; _li < _chart.data.labels.length; _li++ ) {
                            const _py = _yScale.getPixelForValue(null, _li, _li);
                            const _dist = Math.abs(_cy2 - _py);
                            if( _dist < _closestDist ) { _closestDist = _dist; _closestIdx = _li; }
                        }
                        if( _closestIdx >= 0 ) {
                            const _lbl = _chart.data.labels[_closestIdx];
                            const _labelStr = Array.isArray(_lbl) ? _lbl.join(' ') : _lbl;
                            // Show tooltip if label is truncated
                            const _ctx2 = event.target.getContext('2d');
                            _ctx2.save();
                            _ctx2.font = '12px "Helvetica Neue", Helvetica, Arial, sans-serif';
                            const _textW = _ctx2.measureText(_labelStr).width;
                            _ctx2.restore();
                            const _availW = _chart.chartArea.left - 8;
                            if( _textW > _availW ) {
                                this._showLabelTooltip(_labelStr, event.clientX, event.clientY);
                            }
                            // Start timeline entity drag
                            panstate.dragTimelineEntity = { g: panstate.g, entityIdx: _closestIdx };
                            event.target.style.cursor = 'grabbing';
                            // Ghost from label area
                            const _tlRect2 = event.target.getBoundingClientRect();
                            const _tlLabelW = _chart.chartArea ? _chart.chartArea.left : 65;
                            this._createGhost(_labelStr, _tlLabelW, 20, event.clientX, event.clientY);
                            this._startAutoScroll(event);
                            return;
                        }
                    }
                }
            }

            if( _chart.legend && _chart.legend.legendHitBoxes ) {
                const _rect = event.target.getBoundingClientRect();
                const _cx = event.clientX - _rect.left;
                const _cy = event.clientY - _rect.top;
                const _hitBoxes = _chart.legend.legendHitBoxes;
                // Use closest-Y then closest-X to find grabbed label
                const _grabbed = this._findLegendLabel(_hitBoxes, _cx, _cy, -1, false);
                if( _grabbed && _chart.data.datasets[_grabbed.idx] ) {
                    const _i = _grabbed.idx;
                    const _box = _hitBoxes[_i];
                    const _lgText = _chart.legend.legendItems[_i]?.text || '';
                    const _lgColor = _chart.data.datasets[_i]?.borderColor || null;
                    // Store pending drag — ghost and activation deferred until threshold moved
                    panstate.pendingDragDataset = {
                        g: panstate.g, datasetIdx: _i, color: _lgColor,
                        text: _lgText, boxW: _box.width, boxH: _box.height,
                        startX: event.clientX, startY: event.clientY
                    };
                    return; // Don't start pan
                }
            }

            if( !this.state.zoomMode ) {

                if( this.state.drag && !panstate.pinch ) {
                    // Second finger while panning — start vertical pinch zoom (line/bar only)
                    const p1 = { x: panstate.mx, y: panstate.my };
                    const p2 = { x: event.clientX, y: event.clientY };
                    const g  = panstate.g;
                    if( g.type !== 'timeline' && g.type !== 'arrowline' ) {
                        panstate.pinch = {
                            p1, p2,
                            distY: Math.abs(p2.y - p1.y),
                            y0: g.chart.scales['y-axis-0'].min,
                            y1: g.chart.scales['y-axis-0'].max
                        };
                    }
                } else if( !panstate.pinch ) {
                    // First finger — start pan
                    this.state.drag = true;
                    panstate.tc = this.startTime;
                    this.state.updateCanvas = this.pconfig.lockAllGraphs ? null : event.target;
                }

            } else if( this.state.zoomMode ) {

                const x0 = panstate.mx - panstate.g.canvas.getBoundingClientRect().left;

                if( x0 > panstate.g.chart.chartArea.left && x0 < panstate.g.chart.chartArea.right ) {

                    if( !panstate.overlay ) {

                        let e = document.createElement('canvas');
                        e.style = 'position:absolute;pointer-events:none;';
                        e.width = panstate.g.canvas.width;
                        e.height = panstate.g.canvas.height;

                        panstate.g.canvas.parentNode.insertBefore(e, panstate.g.canvas);

                        panstate.overlay = e;

                    }

                    panstate.st0 = this.pixelPositionToTimecode(x0);

                    this.state.selecting = true;

                }

            }

        }
    }

    pointerMove(event)
    {
        // Activate pending legend drag once pointer has moved enough
        if( panstate.pendingDragDataset ) {
            const _p = panstate.pendingDragDataset;
            const _dist = Math.abs(event.clientX - _p.startX) + Math.abs(event.clientY - _p.startY);
            if( _dist > 5 ) {
                panstate.dragDataset = { g: _p.g, datasetIdx: _p.datasetIdx, color: _p.color };
                panstate.pendingDragDataset = null;
                this._createGhost(_p.text, _p.boxW, _p.boxH, event.clientX, event.clientY, 'center', _p.color);
                this._startAutoScroll(event);
                // Block the click event that will follow pointerUp
                event.target.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); }, { capture: true, once: true });
            }
            return;
        }

        if( panstate.dragDataset ) {
            this._autoScrollY = event.clientY;
            this._moveGhost(event.clientX, event.clientY);
            const _src = panstate.dragDataset.g;
            const _srcIdx = panstate.dragDataset.datasetIdx;
            // Find graph under pointer
            let _overG = null;
            for( let g of this.graphs ) {
                const _r = g.canvas.getBoundingClientRect();
                if( event.clientX >= _r.left && event.clientX <= _r.right &&
                    event.clientY >= _r.top  && event.clientY <= _r.bottom ) {
                    _overG = g; break;
                }
            }
            if( _overG && _overG !== _src ) {
                // Inter-graph: check compatibility
                const _srcUnit = _src.entities[_srcIdx] ? this.getUnitOfMeasure(_src.entities[_srcIdx].entity, _src.entities[_srcIdx].unit) : undefined;
                const _tgtUnit = _overG.entities[0] ? this.getUnitOfMeasure(_overG.entities[0].entity, _overG.entities[0].unit) : undefined;
                const _compatible = _overG.type === _src.type && (_srcUnit === undefined || _tgtUnit === undefined || areSICompatible(_srcUnit, _tgtUnit));
                event.target.style.cursor = _compatible ? 'grabbing' : 'not-allowed';
                this._highlightDropTarget(_overG.canvas, _compatible);
                this._hideInsertionMarker();
                // Freeze target chart when over its legend overlay
                const _lgEl = this._this.querySelector(`#lg-${_overG.id}`);
                if( _lgEl ) {
                    const _lgR = _lgEl.getBoundingClientRect();
                    if( event.clientY >= _lgR.top && event.clientY <= _lgR.bottom )
                        this._freezeChart(_overG);
                    else
                        this._unfreezeChart();
                }
            } else if( _overG === _src ) {
                // Intra-graph: show vertical insertion marker between legend labels
                event.target.style.cursor = 'grabbing';
                this._clearDropHighlight();
                // Freeze when over legend overlay
                const _lgElSrc = this._this.querySelector(`#lg-${_src.id}`);
                if( _lgElSrc ) {
                    const _lgRSrc = _lgElSrc.getBoundingClientRect();
                    if( event.clientY >= _lgRSrc.top && event.clientY <= _lgRSrc.bottom )
                        this._freezeChart(_src);
                    else
                        this._unfreezeChart();
                }
                const _hitBoxes = _src.chart.legend?.legendHitBoxes;
                if( _hitBoxes && _hitBoxes.length > 1 ) {
                    const _r = _src.canvas.getBoundingClientRect();
                    const _cx = event.clientX - _r.left;
                    const _cy = event.clientY - _r.top;
                    const _found = this._findLegendLabel(_hitBoxes, _cx, _cy, _srcIdx, true);
                    if( _found ) {
                        this._showInsertionMarker(
                            _r.left + _found.markerX + 2, _r.top + _found.markerY,
                            3, _found.markerH, false, panstate.dragDataset?.color);
                    } else {
                        this._hideInsertionMarker();
                    }
                }
            } else {
                event.target.style.cursor = 'grabbing';
                this._clearDropHighlight();
                this._hideInsertionMarker();
                this._unfreezeChart();
            }
            return;
        }
        if( panstate.pendingDragDataset ) {
            panstate.pendingDragDataset = null;
        }
        if( panstate.dragTimelineEntity ) {
            this._autoScrollY = event.clientY;
            this._moveGhost(event.clientX, event.clientY);
            const _srcTL = panstate.dragTimelineEntity.g;
            const _srcIdxTL = panstate.dragTimelineEntity.entityIdx;
            let _overGTL = null;
            for( let g of this.graphs ) {
                const _r = g.canvas.getBoundingClientRect();
                if( event.clientX >= _r.left && event.clientX <= _r.right &&
                    event.clientY >= _r.top  && event.clientY <= _r.bottom ) {
                    _overGTL = g; break;
                }
            }
            if( _overGTL && _overGTL !== _srcTL ) {
                // Inter-graph
                const _compatible = _overGTL.type === _srcTL.type;
                event.target.style.cursor = _compatible ? 'grabbing' : 'not-allowed';
                this._highlightDropTarget(_overGTL.canvas, _compatible);
                this._hideInsertionMarker();
            } else if( _overGTL === _srcTL ) {
                // Intra-graph: horizontal insertion marker
                event.target.style.cursor = 'grabbing';
                this._clearDropHighlight();
                const _yScale = _srcTL.chart.scales['y-axis-0'];
                if( _yScale ) {
                    const _r = _srcTL.canvas.getBoundingClientRect();
                    const _cy = event.clientY - _r.top;
                    let _markerShown = false;
                    for( let _ei = 0; _ei < _srcTL.entities.length; _ei++ ) {
                        if( _ei === _srcIdxTL ) continue;
                        const _py = _yScale.getPixelForValue(null, _ei, _ei);
                        const _halfH = (_yScale.height / _srcTL.entities.length) / 2;
                        if( Math.abs(_cy - _py) < _halfH ) {
                            const _insertBefore = _cy < _py;
                            const _my = _r.top + _py + (_insertBefore ? -_halfH : _halfH);
                            this._showInsertionMarker(_r.left, _my, _r.width, 3, true);
                            _markerShown = true;
                            break;
                        }
                    }
                    if( !_markerShown ) this._hideInsertionMarker();
                }
            } else {
                event.target.style.cursor = 'grabbing';
                this._clearDropHighlight();
                this._hideInsertionMarker();
            }
            return;
        }

        // Hover cursor: move over draggable legend or timeline label areas
        if( !this.state.drag && !panstate.pinch ) {
            let _hoverG = null;
            for( let g of this.graphs ) {
                if( g.canvas === event.target ) { _hoverG = g; break; }
            }
            if( _hoverG ) {
                const _chart = _hoverG.chart;
                const _rect = event.target.getBoundingClientRect();
                const _cx = event.clientX - _rect.left;
                const _cy = event.clientY - _rect.top;
                let _onDraggable = false;
                if( _hoverG.type === 'timeline' || _hoverG.type === 'arrowline' ) {
                    if( _chart.chartArea && _cx < _chart.chartArea.left ) _onDraggable = true;
                } else if( _chart.legend && _chart.legend.legendHitBoxes ) {
                    for( let _box of _chart.legend.legendHitBoxes ) {
                        if( _cx >= _box.left && _cx <= _box.left + _box.width &&
                            _cy >= _box.top  && _cy <= _box.top  + _box.height ) {
                            _onDraggable = true;
                            break;
                        }
                    }
                }
                event.target.style.cursor = _onDraggable ? 'move' : '';
            }
        }

        if( this.state.drag ) {

            if( Math.abs(event.clientX - panstate.lx) > 0 ) {

                panstate.lx = event.clientX;

                const w = panstate.g.chart.chartArea.right - panstate.g.chart.chartArea.left;

                const x = Math.floor((event.clientX - panstate.mx) * ((3600.0 * this.activeRange.timeRangeHours + 60.0 * this.activeRange.timeRangeMinutes) / w));

                if( x < 0 ) {
                    let t0 = moment(panstate.tc).add(-x, "second");
                    let t1 = moment(t0).add(this.activeRange.timeRangeHours, "hour").add(this.activeRange.timeRangeMinutes, "minute");
                    this.startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
                    this.endTime = t1.format("YYYY-MM-DDTHH:mm:ss");
                } else if( x > 0 ) {
                    let t0 = moment(panstate.tc).subtract(x, "second");
                    let t1 = moment(t0).add(this.activeRange.timeRangeHours, "hour").add(this.activeRange.timeRangeMinutes, "minute");;
                    this.startTime = t0.format("YYYY-MM-DDTHH:mm:ss");
                    this.endTime = t1.format("YYYY-MM-DDTHH:mm:ss");
                }

                if( !this.state.loading )
                    this.updateHistory();
                else
                    this.updateAxes();

            }

            // Two-finger gestures: pinch zoom Y + pan Y
            if( panstate.pinch ) {
                const p = panstate.pinch;

                // Track center of the two fingers before update
                const prevCenterY = (p.p1.y + p.p2.y) / 2;

                // Update whichever finger moved
                const d1 = Math.abs(event.clientY - p.p1.y);
                const d2 = Math.abs(event.clientY - p.p2.y);
                if( d1 < d2 ) p.p1 = { x: event.clientX, y: event.clientY };
                else           p.p2 = { x: event.clientX, y: event.clientY };

                const newDistY   = Math.abs(p.p2.y - p.p1.y);
                const newCenterY = (p.p1.y + p.p2.y) / 2;
                const g          = panstate.g;
                const h          = g.chart.chartArea.bottom - g.chart.chartArea.top;

                // Pan Y: translate axis by center movement
                const panDY = newCenterY - prevCenterY;
                if( Math.abs(panDY) > 0 ) {
                    const shift = panDY * (p.y1 - p.y0) / h;
                    p.y0 -= shift;
                    p.y1 -= shift;
                    g.chart.options.scales.yAxes[0].ticks.min = p.y0;
                    g.chart.options.scales.yAxes[0].ticks.max = p.y1;
                    g.chart.options.scales.yAxes[0].ticks.removeEdgeTicks = true;
                    if( g.yaxisLock !== 2 ) this.updateScaleLockState(g, true);
                    g.yaxisLock = 2;
                    g.chart.update();
                }

                // Zoom Y: scale axis by finger spread change
                if( p.distY > 5 && newDistY > 5 ) {
                    const scale = p.distY / newDistY;
                    const mid   = (p.y0 + p.y1) / 2;
                    const half  = (p.y1 - p.y0) / 2 * scale;
                    p.y0 = mid - half;
                    p.y1 = mid + half;
                    g.chart.options.scales.yAxes[0].ticks.min = p.y0;
                    g.chart.options.scales.yAxes[0].ticks.max = p.y1;
                    g.chart.options.scales.yAxes[0].ticks.removeEdgeTicks = true;
                    if( g.yaxisLock !== 2 ) this.updateScaleLockState(g, true);
                    g.yaxisLock = 2;
                    g.chart.update();
                }

                p.distY = newDistY;
                return;
            }

            // Y drag — pan vertical axis (Shift+drag on desktop only, touch devices use #ya-N overlay)
            if( event.shiftKey && panstate.g.type !== 'timeline' && panstate.g.type !== 'arrowline'
                && Math.abs(event.clientY - panstate.ly) > 0 ) {

                panstate.ly = event.clientY;

                const h = panstate.g.chart.chartArea.bottom - panstate.g.chart.chartArea.top;
                const y = (event.clientY - panstate.my) * (panstate.y1 - panstate.y0) / h;

                panstate.g.chart.options.scales.yAxes[0].ticks.min = panstate.y0 + y;
                panstate.g.chart.options.scales.yAxes[0].ticks.max = panstate.y1 + y;
                panstate.g.chart.options.scales.yAxes[0].ticks.removeEdgeTicks = true;
                panstate.g.chart.update();

                if( panstate.g.yaxisLock !== 2 ) this.updateScaleLockState(panstate.g, true);
                panstate.g.yaxisLock = 2;

            }

        } else if( this.state.selecting && panstate.overlay ) {

            // Selection rectangle dragging

            let ctx = panstate.overlay.getContext('2d');
            ctx.clearRect(0, 0, panstate.overlay.width, panstate.overlay.height);

            const rect = panstate.overlay.getBoundingClientRect();
            const x0 = panstate.mx - rect.left;
            const x1 = Math.max(Math.min(event.clientX - rect.left, panstate.g.chart.chartArea.right), panstate.g.chart.chartArea.left);

            ctx.fillStyle = this.ui.darkMode ? '#ffffff20' : '#00000020';
            ctx.fillRect(x0, panstate.g.chart.chartArea.top, x1-x0, panstate.g.chart.chartArea.bottom - panstate.g.chart.chartArea.top);

            panstate.st1 = this.pixelPositionToTimecode(x1);

        } else if( !this.state.altGraph && event.altKey ) {

            // Alt key pressed, show individual samples

            for( let g of this.graphs ) {
                if( g.canvas === event.target ) {
                    this.state.altGraph = g;
                    g.chart.options.hover.mode = 'dataset';
                    break;
                }
            }

        } else if( this.state.altGraph && !event.altKey ) {

            // Alt not pressed, hide samples

            this.state.altGraph.chart.options.hover.mode = 'nearest';
            this.state.altGraph = null;

        }
    }

    pointerUp(event)
    {
        // Handle timeline/arrowline entity drag & drop
        if( panstate.pendingDragDataset ) {
            panstate.pendingDragDataset = null;
        }
        if( panstate.dragTimelineEntity ) {
            const _src = panstate.dragTimelineEntity.g;
            const _srcIdx = panstate.dragTimelineEntity.entityIdx;
            panstate.dragTimelineEntity = null;
            event.target.style.cursor = '';
            this._stopAutoScroll();
            this._clearAllDragFeedback();

            // Find target graph under pointer — same type only
            let _tgt = null;
            let _tgtWrongType = null; // graph found but wrong type
            let _tgtInsertIdx = -1; // index in target entities to insert before (-1 = append)
            for( let g of this.graphs ) {
                const _rect0 = g.canvas.getBoundingClientRect();
                if( event.clientX >= _rect0.left && event.clientX <= _rect0.right &&
                    event.clientY >= _rect0.top  && event.clientY <= _rect0.bottom ) {
                    if( g.type !== _src.type ) { _tgtWrongType = g; break; }
                }
                if( g.type !== _src.type ) continue;
                const _rect = g.canvas.getBoundingClientRect();
                if( event.clientX >= _rect.left && event.clientX <= _rect.right &&
                    event.clientY >= _rect.top  && event.clientY <= _rect.bottom ) {
                    _tgt = g;
                    // Determine insertion position by Y proximity to each entity bar
                    const _yScale = g.chart.scales['y-axis-0'];
                    if( _yScale ) {
                        let _closestDist = Infinity;
                        let _closestI = 0;
                        let _insertBefore = true;
                        const _cy = event.clientY - _rect.top;
                        for( let _ei = 0; _ei < g.entities.length; _ei++ ) {
                            const _py = _yScale.getPixelForValue(null, _ei, _ei);
                            const _dist = Math.abs(_cy - _py);
                            if( _dist < _closestDist ) {
                                _closestDist = _dist;
                                _closestI = _ei;
                                _insertBefore = _cy < _py;
                            }
                        }
                        _tgtInsertIdx = _insertBefore ? _closestI : _closestI + 1;
                    }
                    break;
                }
            }

            if( !_tgt ) {
                if( _tgtWrongType ) this._showLabelTooltip(`${_src.type} ≠ ${_tgtWrongType.type}`, event.clientX, event.clientY);
                return;
            }

            const _entity = _src.entities[_srcIdx];
            const _srcEmpty = _src.entities.length === 1;
            const _isSameGraph = _tgt === _src;

            // Update pconfig.entities groupId and move entity adjacent to target group
            if( !_isSameGraph ) {
                const _tgtGroupId = this.pconfig.entities.find(en => (typeof en === 'string' ? en : en.entity) === _tgt.entities[0].entity)?.groupId;
                const _eIdx = this.pconfig.entities.findIndex(en => (typeof en === 'string' ? en : en.entity) === _entity.entity);
                if( _eIdx >= 0 && _tgtGroupId !== undefined ) {
                    const _updatedEntry = { entity: _entity.entity, groupId: _tgtGroupId, color: _entity.color, fill: _entity.fill };
                    // Remove entity from its current position
                    this.pconfig.entities.splice(_eIdx, 1);
                    // Find insertion position: after last member of target group
                    const _tgtLastIdx = this.pconfig.entities.reduce((acc, en, i) =>
                        (typeof en === 'object' && en.groupId === _tgtGroupId) ? i : acc, -1);
                    if( _tgtLastIdx >= 0 ) {
                        this.pconfig.entities.splice(_tgtLastIdx + 1, 0, _updatedEntry);
                    } else {
                        // Target group not found (shouldn't happen) — append
                        this.pconfig.entities.push(_updatedEntry);
                    }
                }
            }

            // Rebuild source (remove entity)
            const _gl = this._this.querySelector('#graphlist');
            const _srcDiv = _src.canvas.parentNode.parentNode;
            const _srcNext = _srcDiv.nextSibling;
            _srcDiv.remove();
            this.graphs.splice(this.graphs.indexOf(_src), 1);

            // New entity lists
            const _srcRemaining = _src.entities.filter((_, i) => i !== _srcIdx);
            const _allTgtEntities = _isSameGraph
                ? (() => {
                    const _arr = _src.entities.filter((_, i) => i !== _srcIdx);
                    const _insertAt = _tgtInsertIdx > _srcIdx ? _tgtInsertIdx - 1 : _tgtInsertIdx;
                    _arr.splice(_insertAt < 0 ? _arr.length : _insertAt, 0, _entity);
                    return _arr;
                })()
                : null;

            if( !_isSameGraph ) {
                // Rebuild source without entity (if not empty)
                if( !_srcEmpty ) {
                    const _countBefore = this.graphs.length;
                    const _saved = this.pconfig.combineSameUnits;
                    this.pconfig.combineSameUnits = true;
                    _srcRemaining.forEach((en, i) => {
                                this.addDynamicGraph(en.entity, i === 0, en.color, en.fill, i === 0 ? null : this.graphs[this.graphs.length - 1]);
                            });
                    this.pconfig.combineSameUnits = _saved;
                    for( let i = _countBefore; i < this.graphs.length; i++ )
                        _gl.insertBefore(this.graphs[i].canvas.parentNode.parentNode, _srcNext);
                }
                // Rebuild target with added entity at correct position
                const _tgtDiv = _tgt.canvas.parentNode.parentNode;
                const _tgtNext = _tgtDiv.nextSibling;
                _tgtDiv.remove();
                this.graphs.splice(this.graphs.indexOf(_tgt), 1);
                const _newTgtEntities = [..._tgt.entities];
                _newTgtEntities.splice(_tgtInsertIdx < 0 ? _newTgtEntities.length : _tgtInsertIdx, 0, _entity);
                const _countBefore2 = this.graphs.length;
                const _saved2 = this.pconfig.combineSameUnits;
                this.pconfig.combineSameUnits = true;
                _newTgtEntities.forEach((en, i) => {
                                this.addDynamicGraph(en.entity, i === 0, en.color, en.fill, i === 0 ? null : this.graphs[this.graphs.length - 1]);
                            });
                this.pconfig.combineSameUnits = _saved2;
                for( let i = _countBefore2; i < this.graphs.length; i++ ) {
                    const _d = this.graphs[i].canvas.parentNode.parentNode;
                    if( _tgtNext && _gl.contains(_tgtNext) ) _gl.insertBefore(_d, _tgtNext);
                    else _gl.appendChild(_d);
                }
            } else {
                // Same graph reorder — rebuild with new entity order
                // Reorder pconfig.entities to match new order within the group
                const _groupId = this.pconfig.entities.find(en => (typeof en === 'string' ? en : en.entity) === _allTgtEntities[0].entity)?.groupId;
                if( _groupId !== undefined ) {
                    // Remove all entities of this group from pconfig.entities
                    const _groupEntries = this.pconfig.entities.filter(en => (typeof en === 'string' ? false : en.groupId === _groupId));
                    const _firstIdx = this.pconfig.entities.findIndex(en => (typeof en === 'string' ? false : en.groupId === _groupId));
                    this.pconfig.entities = this.pconfig.entities.filter(en => (typeof en === 'string' ? true : en.groupId !== _groupId));
                    // Re-insert in new order
                    const _reordered = _allTgtEntities.map(en => _groupEntries.find(e => e.entity === en.entity) || { entity: en.entity, groupId: _groupId, color: en.color, fill: en.fill });
                    this.pconfig.entities.splice(_firstIdx, 0, ..._reordered);
                }
                const _countBefore = this.graphs.length;
                const _saved = this.pconfig.combineSameUnits;
                this.pconfig.combineSameUnits = true;
                _allTgtEntities.forEach((en, i) => {
                                this.addDynamicGraph(en.entity, i === 0, en.color, en.fill, i === 0 ? null : this.graphs[this.graphs.length - 1]);
                            });
                this.pconfig.combineSameUnits = _saved;
                for( let i = _countBefore; i < this.graphs.length; i++ )
                    _gl.insertBefore(this.graphs[i].canvas.parentNode.parentNode, _srcNext);
            }

            this.writeLocalState();
            this.updateHistory();
            return;
        }

        // Handle legend drag & drop
        // Clear pending drag if pointer released before threshold (normal click)
        if( panstate.pendingDragDataset ) {
            panstate.pendingDragDataset = null;
        }

        if( panstate.dragDataset ) {
            const _src = panstate.dragDataset.g;
            const _srcIdx = panstate.dragDataset.datasetIdx;
            panstate.dragDataset = null;
            event.target.style.cursor = '';
            this._stopAutoScroll();
            this._clearAllDragFeedback();

            // Find target graph under pointer
            let _tgt = null;
            for( let g of this.graphs ) {
                if( g === _src ) continue;
                const _rect = g.canvas.getBoundingClientRect();
                if( event.clientX >= _rect.left && event.clientX <= _rect.right &&
                    event.clientY >= _rect.top  && event.clientY <= _rect.bottom ) {
                    _tgt = g;
                    break;
                }
            }
            // Intra-graph reorder: drop on same graph canvas
            if( !_tgt ) {
                // Check if drop is on the source graph itself (same canvas)
                const _srcRect = _src.canvas.getBoundingClientRect();
                if( event.clientX >= _srcRect.left && event.clientX <= _srcRect.right &&
                    event.clientY >= _srcRect.top  && event.clientY <= _srcRect.bottom ) {
                    // Find target label by X position in legend
                    const _hitBoxes = _src.chart.legend?.legendHitBoxes;
                    if( _hitBoxes && _hitBoxes.length > 1 ) {
                        const _rect = _src.canvas.getBoundingClientRect();
                        const _cx = event.clientX - _rect.left;
                        const _cy2 = event.clientY - _rect.top;
                        const _dropTarget = this._findLegendLabel(_hitBoxes, _cx, _cy2, _srcIdx, true);
                        let _tgtLabelIdx = _dropTarget ? _dropTarget.idx : -1;
                        let _insertBefore = _dropTarget ? _dropTarget.insertBefore : true;
                        if( _tgtLabelIdx >= 0 ) {
                            // Reorder entities
                            const _newEntities = [..._src.entities];
                            const [_moved] = _newEntities.splice(_srcIdx, 1);
                            const _insertAt = _tgtLabelIdx > _srcIdx
                                ? (_insertBefore ? _tgtLabelIdx - 1 : _tgtLabelIdx)
                                : (_insertBefore ? _tgtLabelIdx : _tgtLabelIdx + 1);
                            _newEntities.splice(_insertAt, 0, _moved);
                            // Persist in pconfig.entities
                            const _groupId = this.pconfig.entities.find(en => (typeof en === 'string' ? en : en.entity) === _newEntities[0].entity)?.groupId;
                            if( _groupId !== undefined ) {
                                const _groupEntries = this.pconfig.entities.filter(en => typeof en === 'object' && en.groupId === _groupId);
                                const _firstIdx = this.pconfig.entities.findIndex(en => typeof en === 'object' && en.groupId === _groupId);
                                this.pconfig.entities = this.pconfig.entities.filter(en => typeof en === 'object' ? en.groupId !== _groupId : true);
                                const _reordered = _newEntities.map(en => _groupEntries.find(e => e.entity === en.entity) || { entity: en.entity, groupId: _groupId, color: en.color, fill: en.fill });
                                this.pconfig.entities.splice(_firstIdx, 0, ..._reordered);
                            }
                            // Rebuild graph
                            const _gl = this._this.querySelector('#graphlist');
                            const _srcDiv = _src.canvas.parentNode.parentNode;
                            const _srcNext = _srcDiv.nextSibling;
                            _srcDiv.remove();
                            this.graphs.splice(this.graphs.indexOf(_src), 1);
                            const _countBefore = this.graphs.length;
                            const _saved = this.pconfig.combineSameUnits;
                            this.pconfig.combineSameUnits = true;
                            let _rebuildTargetG = null;
                            _newEntities.forEach((en, i) => {
                                this.addDynamicGraph(en.entity, i === 0, en.color, en.fill, _rebuildTargetG);
                                if( i === 0 ) _rebuildTargetG = this.graphs[this.graphs.length - 1];
                            });
                            this.pconfig.combineSameUnits = _saved;
                            for( let i = _countBefore; i < this.graphs.length; i++ ) {
                                const _d = this.graphs[i].canvas.parentNode.parentNode;
                                if( _srcNext && _gl.contains(_srcNext) ) _gl.insertBefore(_d, _srcNext);
                                else _gl.appendChild(_d);
                            }
                            this.writeLocalState();
                            this.updateHistory();
                        }
                    }
                }
                return;
            }

            if( _tgt && _tgt.type !== _src.type ) {
                this._showLabelTooltip(`${_src.type} ≠ ${_tgt.type}`, event.clientX, event.clientY);
                return;
            }

            if( _tgt && _tgt.type === _src.type ) {
                // Check SI compatibility
                const _srcUnit = _src.entities[_srcIdx] ? this.getUnitOfMeasure(_src.entities[_srcIdx].entity, _src.entities[_srcIdx].unit) : undefined;
                const _tgtUnit = _tgt.entities[0] ? this.getUnitOfMeasure(_tgt.entities[0].entity, _tgt.entities[0].unit) : undefined;
                if( _srcUnit !== undefined && _tgtUnit !== undefined && !areSICompatible(_srcUnit, _tgtUnit) ) {
                    // Show incompatibility tooltip
                    const _srcBase = getSIFactor(_srcUnit).base || _srcUnit;
                    const _tgtBase = getSIFactor(_tgtUnit).base || _tgtUnit;
                    this._showLabelTooltip(`${_srcBase} ≠ ${_tgtBase}`, event.clientX, event.clientY);
                    return;
                }
                if( _srcUnit === undefined || _tgtUnit === undefined || areSICompatible(_srcUnit, _tgtUnit) ) {
                    // Move entity from source to target
                    const _entity = _src.entities[_srcIdx];
                    // Update groupId in pconfig.entities
                    const _tgtGroupId = this.pconfig.entities.find(en => (typeof en === 'string' ? en : en.entity) === _tgt.entities[0].entity)?.groupId;
                    const _eIdx = this.pconfig.entities.findIndex(en => (typeof en === 'string' ? en : en.entity) === _entity.entity);
                    if( _eIdx >= 0 && _tgtGroupId !== undefined ) {
                        this.pconfig.entities[_eIdx] = { entity: _entity.entity, groupId: _tgtGroupId, color: _entity.color, fill: _entity.fill };
                    }
                    this.writeLocalState();
                    // Rebuild: remove source graph if it becomes empty
                    const _srcEmpty = _src.entities.length === 1;
                    // Rebuild source graph without the moved entity
                    const _srcRemaining = _src.entities.filter((_, i) => i !== _srcIdx);
                    const _srcDiv = _src.canvas.parentNode.parentNode; // wrapper e
                    const _srcNext = _srcDiv.nextSibling;
                    const _gl = _srcDiv.parentNode; // #graphlist
                    _srcDiv.remove();
                    this.graphs.splice(this.graphs.indexOf(_src), 1);
                    if( !_srcEmpty ) {
                        // Recreate source graph with remaining entities
                        _srcRemaining.forEach(en => { en.siConversionFactor = undefined; });
                        const _countBefore = this.graphs.length;
                        const _savedCombine = this.pconfig.combineSameUnits;
                        this.pconfig.combineSameUnits = true;
                        _srcRemaining.forEach((en, i) => {
                                this.addDynamicGraph(en.entity, i === 0, en.color, en.fill, i === 0 ? null : this.graphs[this.graphs.length - 1]);
                            });
                        this.pconfig.combineSameUnits = _savedCombine;
                        // Move to correct position
                        for( let i = _countBefore; i < this.graphs.length; i++ )
                            _gl.insertBefore(this.graphs[i].canvas.parentNode.parentNode, _srcNext);
                    }
                    // Rebuild target graph with added entity
                    _entity.siConversionFactor = undefined;
                    _tgt.entities.forEach(en => { en.siConversionFactor = undefined; });
                    const _tgtDiv = _tgt.canvas.parentNode.parentNode; // wrapper e
                    const _tgtNext = _tgtDiv.nextSibling;
                    _tgtDiv.remove();
                    this.graphs.splice(this.graphs.indexOf(_tgt), 1);
                    const _allTgtEntities = [..._tgt.entities, _entity];
                    const _countBefore2 = this.graphs.length;
                    const _savedCombine2 = this.pconfig.combineSameUnits;
                    this.pconfig.combineSameUnits = true;
                    _allTgtEntities.forEach((en, i) => {
                                this.addDynamicGraph(en.entity, i === 0, en.color, en.fill, i === 0 ? null : this.graphs[this.graphs.length - 1]);
                            });
                    this.pconfig.combineSameUnits = _savedCombine2;
                    for( let i = _countBefore2; i < this.graphs.length; i++ )
                        _gl.insertBefore(this.graphs[i].canvas.parentNode.parentNode, _tgtNext);
                    this.updateHistory();
                }
            }
            return;
        }

        if( panstate.pinch ) {
            panstate.pinch = null;
            // Resume pan with remaining finger
            panstate.mx = event.clientX;
            panstate.lx = event.clientX;
            panstate.my = event.clientY;
            panstate.ly = event.clientY;
            panstate.tc = this.startTime;
            return;
        }

        if( this.state.drag ) {

            this.state.drag = false;
            this.state.updateCanvas = null;

            panstate.g.chart.options.tooltips.enabled = true;

            if( panstate.g.type !== 'timeline' && panstate.g.type !== 'arrowline' ) {
                if( panstate.g.chart.options.scales.yAxes[0].ticks.forceMin === undefined && !panstate.g.yaxisLock ) {
                    panstate.g.chart.options.scales.yAxes[0].ticks.min = undefined;
                    panstate.g.chart.options.bottomClipMargin = 4;
                } else
                    panstate.g.chart.options.bottomClipMargin = 1;

                if( panstate.g.chart.options.scales.yAxes[0].ticks.forceMax === undefined && !panstate.g.yaxisLock ) {
                    panstate.g.chart.options.scales.yAxes[0].ticks.max = undefined;
                    panstate.g.chart.options.topClipMargin = 4;
                } else
                    panstate.g.chart.options.topClipMargin = 1;
            }

            this.updateHistory();

        }

        if( this.state.selecting ) {

            this.state.selecting = false;

            panstate.g.chart.options.tooltips.enabled = true;

            panstate.overlay.remove();
            panstate.overlay = null;

            if( panstate.st1 < panstate.st0 ) [panstate.st1, panstate.st0] = [panstate.st0, panstate.st1];

            const tm = (moment(panstate.st1) + moment(panstate.st0)) / 2;

            // Time delta in minutes
            const dt = moment.duration(panstate.st1 - panstate.st0).asMinutes();

            // Time delta in hours, ceiled
            let d = ( dt >= 60.0 ) ? Math.ceil(dt / 60.0) : 0;

            if( d < 12 ) {

                if( d < 1 )
                    this.setTimeRangeMinutes(Math.ceil(dt), true, tm);
                else
                    this.setTimeRange(d, true, tm);

            } else {

                d = Math.ceil(d / 24.0);

                if( d < 1 ) this.setTimeRange(12, true, tm); else       // 12 hours
                if( d < 2 ) this.setTimeRange(24, true, tm); else       // 1 day
                if( d < 3 ) this.setTimeRange(48, true, tm); else       // 2 days
                if( d < 4 ) this.setTimeRange(72, true, tm); else       // 3 days
                if( d < 5 ) this.setTimeRange(96, true, tm); else       // 4 days
                if( d < 6 ) this.setTimeRange(120, true, tm); else      // 5 days
                if( d < 7 ) this.setTimeRange(144, true, tm); else      // 6 days
                if( d < 13 ) this.setTimeRange(168, true, tm); else     // 1 week
                if( d < 20 ) this.setTimeRange(336, true, tm); else     // 2 weeks
                if( d < 28 ) this.setTimeRange(504, true, tm); else     // 3 weeks
                if( d < 45 ) this.setTimeRange(720, true, tm); else     // 1 month
                if( d < 105 ) this.setTimeRange(2184, true, tm); else   // 3 months
                              this.setTimeRange(4368, true, tm);        // 6 months

            }

            this.toggleZoom();

        }

        panstate.g = null;

        // Allow auto scroll on refresh if the user dragged at or past the current time
        this.state.autoScroll = moment() <= moment(this.endTime);
    }

    pointerCancel(event)
    {
        if( panstate.pendingDragDataset ) {
            panstate.pendingDragDataset = null;
        }
        if( panstate.dragTimelineEntity ) {
            panstate.dragTimelineEntity = null;
            event.target.style.cursor = '';
            this._stopAutoScroll();
            this._clearAllDragFeedback();
        }
        if( panstate.pinch ) {
            panstate.pinch = null;
            return;
        }

        if( this.state.drag ) {

            this.state.drag = false;
            this.state.updateCanvas = null;

            panstate.g.chart.options.tooltips.enabled = true;
            if( panstate.g.type !== 'timeline' && panstate.g.type !== 'arrowline' ) {
                panstate.g.chart.options.scales.yAxes[0].ticks.min = undefined;
                panstate.g.chart.options.scales.yAxes[0].ticks.max = undefined;
            }
            panstate.g.chart.options.topClipMargin = 4;
            panstate.g.chart.options.bottomClipMargin = 4;

        }

        if( this.state.selecting ) {

            this.state.selecting = false;

            panstate.g.chart.options.tooltips.enabled = true;

            panstate.overlay.remove();
            panstate.overlay = null;

        }

        panstate.g = null;

        // Allow auto scroll on refresh if the user dragged at or past the current time
        this.state.autoScroll = moment() <= moment(this.endTime);
    }

    wheelScrolled(event)
    {
        const now = Date.now();
        if( this._wheelLast && now - this._wheelLast < 150 ) return;
        this._wheelLast = now;

        // Zoom x time scale
        if( event.ctrlKey ) {
            event.preventDefault();
            if( !this.graphs.length || this.state.loading ) return;
            const rect = this.graphs[0].canvas.getBoundingClientRect();
            const chartArea = this.graphs[0].chart.chartArea;
            const x0 = event.clientX - rect.left - chartArea.left;
            const f = x0 / (chartArea.right - chartArea.left);
            const tc = this.factorToTimecode(f);
            if( event.deltaY < 0 ) this.incZoomStep(tc, f); else
            if( event.deltaY > 0 ) this.decZoomStep(tc, f);
        }

        // Zoom Y axis
        if( event.shiftKey ) {
            let wd = ( Math.abs(event.deltaX) > Math.abs(event.deltaY) ) ? event.deltaX : event.deltaY;
            if( wd === 0 ) return;
            for( let g of this.graphs ) {
                if( g.type === 'timeline' || g.type === 'arrowline' ) continue;
                const rect = g.canvas.getBoundingClientRect();
                if( event.clientY >= rect.top && event.clientY <= rect.bottom ) {

                    let f = ( wd < 0 ) ? 0.9 : 1.0/0.9;

                    let t = g.chart.options.scales.yAxes[0].ticks;
                    if( t.min === undefined )
                        t.min = g.chart.scales["y-axis-0"].min;
                    if( t.max === undefined )
                        t.max = g.chart.scales["y-axis-0"].max;

                    let d = t.max - t.min;
                    d = d - (d * f);
                    t.max -= d * 0.5;
                    t.min += d * 0.5;

                    if( !g.yaxisLock ) {
                        g.yaxisLock = 2;
                        this.updateScaleLockState(g, true);
                    }

                    g.chart.options.scales.yAxes[0].ticks.removeEdgeTicks = true;

                    g.chart.update();
                    break;
                }
            }
        }
    }


    // --------------------------------------------------------------------------------------
    // Dynamic entity adding
    // --------------------------------------------------------------------------------------

    matchWildcardPattern(s)
    {
        s = s.replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\-]', 'g'), '\\$&');
        s = s.replace(/\\\*/g, '.*')
        return new RegExp('^'+s+'$', 'i');
    }

    addEntitySelected(event)
    {
        if( this.state.loading ) return;

        let ii = event.target ? ( event.target.id == 'b8_0' ) ? 0 : 1 : -1;
        if( ii < 0 ) return;

        const entity_id = this.ui.inputField[ii]?.value;

        for( let i of this.ui.inputField ) if( i ) i.value = "";

        // Single entity or wildcard ?
        if( entity_id.indexOf('*') >= 0 ) {

            const datalist = this._this.querySelector(isMobile ? `#es_${ii}` : `#b6_${this.cid}`);
            if( !datalist ) return;

            // Convert wildcard to regex
            const regex = this.matchWildcardPattern(entity_id);

            for( let e of Array.from(datalist.children) ) {
                const entity_id = e.innerText;
                if( regex.test(entity_id) ) {
                    if( this._hass.states[entity_id] == undefined ) continue;
                    if( this.pconfig.entities.some(en => (typeof en === 'string' ? en : en.entity) === entity_id) ) continue;
                    const _prevCount1 = this.graphs.length;
                    this.addDynamicGraph(entity_id);
                    const _wasCombined1 = this.graphs.length === _prevCount1;
                    const _gid1 = _wasCombined1 ? this.pconfig.entities[this.pconfig.entities.length-1]?.groupId : this._nextGroupId++;
                    const _lastG1 = this.graphs[this.graphs.length-1];
                    const _addedEntity1 = _lastG1?.entities.find(e => e.entity === entity_id);
                    this.pconfig.entities.push({ entity: entity_id, groupId: _gid1, color: _addedEntity1?.color, fill: _addedEntity1?.fill });
                }
            }

        } else {

            if( this._hass.states[entity_id] == undefined ) return;
            if( this.pconfig.entities.some(en => (typeof en === 'string' ? en : en.entity) === entity_id) ) return;

            const _prevGraphCount = this.graphs.length;
            this.addDynamicGraph(entity_id);
            // If graphs.length didn't increase, entity was combined with previous graph
            const _wasCombined = this.graphs.length === _prevGraphCount;
            const _gid = _wasCombined ? this.pconfig.entities[this.pconfig.entities.length-1]?.groupId : this._nextGroupId++;
            const _lastG = this.graphs[this.graphs.length-1];
            const _addedEntity = _lastG?.entities.find(e => e.entity === entity_id);
            this.pconfig.entities.push({ entity: entity_id, groupId: _gid, color: _addedEntity?.color, fill: _addedEntity?.fill });

        }

        this.updateHistoryWithClearCache();

        this.writeLocalState();
    }

    removeAllEntities()
    {
        this.menuSetVisibility(0, false);
        this.menuSetVisibility(1, false);

        if( !confirm(i18n('ui.popup.remove_all')) ) return;

        let a = 0;
        for( a = 0; a < this.graphs.length; a++ )
            if( this.graphs[a].id >= this.firstDynamicId ) break;

        for( let i = a; i < this.graphs.length; i++ )
            this.graphs[i].canvas.parentNode.parentNode.remove();

        this.graphs.splice(a);
        this.pconfig.entities = [];

        this.writeLocalState();
    }


    // --------------------------------------------------------------------------------------
    // Adding and removing graphs from the view
    // --------------------------------------------------------------------------------------

    getDomainForEntity(entity)
    {
        return entity.substr(0, entity.indexOf("."));
    }

    getDeviceClass(entity)
    {
        return this._hass.states[entity]?.attributes?.device_class;
    }

    getUnitOfMeasure(entity, manualUnit)
    {
        return ( manualUnit === undefined ) ? this._hass.states[entity]?.attributes?.unit_of_measurement : manualUnit;
    }

    getStateClass(entity)
    {
        return this._hass.states[entity]?.attributes?.state_class;
    }

    getEntityOptions(entity)
    {
        let c = this.pconfig.entityOptions?.[entity];
        if( !c ) {
            const dc = this.getDeviceClass(entity);
            c = dc ? this.pconfig.entityOptions?.[dc] : undefined;
            if( !c ) {
                const dm = this.getDomainForEntity(entity);
                c = dm ? this.pconfig.entityOptions?.[dm] : undefined;
            }
        }

        // If entityOptions is a list, apply glob matching (same logic as former entityPatterns)
        if( Array.isArray(this.pconfig.entityOptions) ) {
            let patched = {};
            for( const p of this.pconfig.entityOptions ) {
                const key = p.match ?? p.entity;
                if( !key ) continue;
                if( this._matchGlob(entity, key) ) {
                    const { match, entity: _e, ...opts } = p;
                    for( const k in opts ) {
                        if( !(k in patched) ) patched[k] = opts[k];
                    }
                }
            }
            if( Object.keys(patched).length ) {
                c = Object.assign({}, patched, c ?? {});
            }
        }

        return c ?? undefined;
    }

    _matchGlob(str, pattern)
    {
        // Supports * (any chars) and ? (single char); pattern can be a string or array of strings
        if( Array.isArray(pattern) ) return pattern.some(p => this._matchGlob(str, p));
        const parts = pattern.split('*');
        const escaped = parts.map(function(seg) {
            return seg.split('?').map(function(part) {
                return part.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
            }).join('.');
        });
        return new RegExp('^' + escaped.join('.*') + '$').test(str);
    }

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

    removeGraph(event)
    {
        const id = event.target.id.substr(event.target.id.indexOf("-") + 1);

        for( let i = 0; i < this.graphs.length; i++ ) {
            if( this.graphs[i].id == id ) {
                this.graphs[i].canvas.parentNode.parentNode.remove();
                for( let e of this.graphs[i].entities ) {
                    const j = this.pconfig.entities.findIndex(en => (typeof en === 'string' ? en : en.entity) === e.entity);
                    if( j >= 0 ) this.pconfig.entities.splice(j, 1);
                }
                this.graphs.splice(i, 1);
                break;
            }
        }

        this.updateHistoryWithClearCache();

        this.writeLocalState();
    }

    addFixedGraph(g)
    {
        // Add fixed graphs from YAML
        if( g.graph.type == 'line' || g.graph.type == 'bar' ) {

            let entities = [];
            for( let d of g.graph.entities ) {
                const dc = this.getNextDefaultColor();
                const color = d.color ?? dc.color;
                let fill = d.fill ?? (d.color ? 'rgba(0,0,0,0)' : dc.fill);
                if( g.graph.type == 'bar' ) fill = color;
                entities.push({ ...d, 'color' : color, 'fill' : fill });
            }

            this.addGraphToCanvas(g.id, g.graph.type, entities, g.graph.options);

        } else {

            this.addGraphToCanvas(g.id, g.graph.type, g.graph.entities, g.graph.options);

        }

        // For bar graphs, connect the interval selector dropdown listener
        if( g.graph.type == 'bar' ) {
            this._this.querySelector(`#bd-${g.id}`)?.addEventListener('change', this.selectBarInterval.bind(this));
        }

        // For line and bar graphs connect the scale lock button listener
        if( g.graph.type == 'line' || g.graph.type == 'bar' ) {
            this._this.querySelector(`#ca-${g.id}`)?.addEventListener('click', this.scaleLockClicked.bind(this));
            const yaEl1 = this._this.querySelector(`#ya-${g.id}`);
            if( yaEl1 ) {
                yaEl1.addEventListener('pointerdown', this.yAxisPointerDown.bind(this));
                yaEl1.addEventListener('pointermove', this.yAxisPointerMove.bind(this));
                yaEl1.addEventListener('pointerup',   this.yAxisPointerUp.bind(this));

            }
        }
    }

    addDynamicGraph(entity_id, noAutoGroup = false, overrideColor = null, overrideFill = null, targetGraph = null, overrideHidden = undefined)
    {
        // Add dynamic entity

        if( this._hass.states[entity_id] == undefined ) return;

        var entityOptions = this.getEntityOptions(entity_id);

        const uom = this.getUnitOfMeasure(entity_id);
        const sc = this.getStateClass(entity_id);
        const type = entityOptions?.type ? entityOptions.type : ( sc === 'total_increasing' ) ? 'bar' : ( uom == undefined && sc !== 'measurement' ) ? 'timeline' : 'line';

        let entities = [{ "entity": entity_id, "color": "#000000", "fill": "#00000000", "process": entityOptions?.process }];

        // Get the options for line and arrow graphs (use per device_class options if available, otherwise use defaults)
        if( type == 'line' || type == 'arrowline' || type == 'bar' ) {

            if( overrideColor ) {
                // Only check for color conflicts when combining with an existing graph (targetGraph known)
                // When noAutoGroup=true (first entity of a group), there is no target graph yet — no conflict possible
                if( targetGraph ) {
                    const _usedColors = targetGraph.entities.map(e => e.color);
                    if( _usedColors.includes(overrideColor) ) {
                        const _free = defaultColors.find(c => !_usedColors.includes(c.color));
                        entities[0].color = _free ? _free.color : overrideColor;
                        entities[0].fill = _free ? _free.fill : (overrideFill ?? 'rgba(0,0,0,0)');
                    } else {
                        entities[0].color = overrideColor;
                        entities[0].fill = overrideFill ?? 'rgba(0,0,0,0)';
                    }
                } else {
                    // First entity of a group — no conflict possible, use color as-is
                    entities[0].color = overrideColor;
                    entities[0].fill = overrideFill ?? 'rgba(0,0,0,0)';
                }
            } else if( entityOptions?.color ) {
                entities[0].color = entityOptions?.color;
                entities[0].fill = entityOptions?.fill ?? 'rgba(0,0,0,0)';
            } else {
                const c = this.getNextDefaultColor();
                entities[0].color = c.color;
                entities[0].fill = entityOptions?.fill ?? c.fill;
            }

            entities[0].dashMode = entityOptions?.dashMode;
            entities[0].width = entityOptions?.width;
            entities[0].lineMode = this.normalizeLineMode(entityOptions?.lineMode);
            entities[0].scale = entityOptions?.scale;
            entities[0].hidden = overrideHidden !== undefined ? overrideHidden : entityOptions?.hidden;
            entities[0].netBars = entityOptions?.netBars;
            entities[0].showPoints = entityOptions?.showPoints;
            entities[0].decimation = entityOptions?.decimation;
            entities[0].showMinMax = entityOptions?.showMinMax;

            if( type == 'bar' ) {
                entities[0].fill = entities[0].color;
                entities[0].lineMode = this.normalizeLineMode(entityOptions?.lineMode) ?? 'lines';
            }

        }

        const last = this.graphs.length - 1;

        // Add to an existing timeline graph and compatible line graph if possible
        let combine = !noAutoGroup &&
                      last >= 0 &&
                      type != 'bar' &&
                      this.graphs[last].type === type &&
                      ( type == 'timeline' || this.pconfig.combineSameUnits && areSICompatible(this.getUnitOfMeasure(entity_id), this.getUnitOfMeasure(this.graphs[last].entities[0].entity)) );

        if( combine ) {

            // Add the new entity to the previous ones
            entities = this.graphs[this.graphs.length-1].entities.concat(entities);

            // Delete the old graph, will be regenerated below including the new entity
            this.graphs[this.graphs.length-1].canvas.parentNode.parentNode.remove();
            this.graphs.length--;

        }

        const h = this.calcGraphHeight(type, entities.length, entityOptions?.height);

        let html = '';
        html += `<div style='height:${h}px;position:relative'>`;
        html += `<canvas id="graph${this.g_id}" height="${h}px" style='touch-action:pan-y'></canvas>`;
        html += `<button id='bc-${this.g_id}' style="position:absolute;right:20px;margin-top:${-h+5}px;color:var(--primary-text-color);background-color:${this.pconfig.closeButtonColor};border:0px solid black;">×</button>`;
        if( type == 'bar' && !this.ui.hideInterval )
            html += this.createIntervalSelectorHtml(this.g_id, h, this.parseIntervalConfig(entityOptions?.interval), this.ui.optionStyle);
        if( type == 'line' || type == 'bar' )
            html += this.createScaleLockIconHtml(this.g_id, h);
        if( type == 'line' || type == 'bar' )
            html += `<div id="ya-${this.g_id}" style="position:absolute;left:0;top:28px;width:${this.pconfig.labelAreaWidth}px;height:${h-28}px;touch-action:none;cursor:ns-resize;"></div>`;
            html += `<div id="mo-${this.g_id}" style="position:absolute;left:0;top:0;width:30px;height:28px;touch-action:none;cursor:grab;z-index:1;display:flex;align-items:flex-end;padding-left:2px;padding-bottom:3px;color:var(--secondary-text-color);font-size:14px;opacity:0.5;user-select:none;">&#x283F;</div>`;
            if( type == 'line' || type == 'bar' )
                html += `<div id="lg-${this.g_id}" style="position:absolute;left:0;top:0;width:100%;height:0px;touch-action:none;pointer-events:none;"></div>`;
        html += `</div>`;

        let e = document.createElement('div');
        e.innerHTML = html;

        let gl = this._this.querySelector('#graphlist');
        gl.appendChild(e);

        // For bar graphs, connect the interval selector dropdown listener
        if( type == 'bar' && !this.ui.hideInterval )
            this._this.querySelector(`#bd-${this.g_id}`).addEventListener('change', this.selectBarInterval.bind(this));

        // For line and bar graphs connect the scale lock button listener
        if( type == 'line' || type == 'bar' ) {
            this._this.querySelector(`#ca-${this.g_id}`)?.addEventListener('click', this.scaleLockClicked.bind(this));
            const yaEl2 = this._this.querySelector(`#ya-${this.g_id}`);
            if( yaEl2 ) {
                yaEl2.addEventListener('pointerdown', this.yAxisPointerDown.bind(this));
                yaEl2.addEventListener('pointermove', this.yAxisPointerMove.bind(this));
                yaEl2.addEventListener('pointerup',   this.yAxisPointerUp.bind(this));
            }
        }
        // Connect graph move listeners for all graph types
        const moEl2 = this._this.querySelector(`#mo-${this.g_id}`);
        if( moEl2 ) {
            moEl2.addEventListener('pointerdown', this.graphMoveStart.bind(this));
            moEl2.addEventListener('pointermove', this.graphMoveMove.bind(this));
            moEl2.addEventListener('pointerup',   this.graphMoveEnd.bind(this));
        }

        // Connect the close button event listener
        this._this.querySelector(`#bc-${this.g_id}`).addEventListener('click', this.removeGraph.bind(this));

        // Create the graph
        this.addGraphToCanvas(this.g_id++, type, entities, entityOptions);
    }

    addGraphToCanvas(gid, type, entities, config)
    {
        const canvas = this._this.querySelector(`#graph${gid}`);

        let datasets = [];
        for( let d of entities ) {
            datasets.push({
                "name": ( d.name === undefined ) ? this._hass.states[d.entity]?.attributes?.friendly_name : d.name,
                "bColor": parseColor(d.color),
                "fillColor": parseColor(d.fill),
                "dashMode": d.dashMode,
                "mode": this.normalizeLineMode(d.lineMode) || this.pconfig.defaultLineMode,
                "width": d.width || this.pconfig.defaultLineWidth,
                "showPoints": d.showPoints,
                "showMinMax": d.showMinMax,
                "unit": this.getUnitOfMeasure(d.entity, d.unit),
                "domain": this.getDomainForEntity(d.entity),
                "device_class": this.getDeviceClass(d.entity),
                "hidden": d.hidden,
                "entity_id" : d.entity
            });
        }

        // Compute SI conversion factors if all datasets share the same base SI unit
        if( type === 'line' || type === 'bar' ) {
            const _units = datasets.map(d => d.unit);
            if( _units.length > 0 && _units.every(u => areSICompatible(u, _units[0])) && _units.some((u,i,a) => u !== a[0]) ) {
                // Estimate max value from current HA state for each entity
                const _unitsWithMax = datasets.map(d => ({
                    unit: d.unit,
                    maxVal: Math.abs(parseFloat(this._hass.states[d.entity_id]?.state) || 0)
                }));
                const { unit: _refUnit, targetFactor: _targetFactor } = chooseSIUnit(_unitsWithMax);
                for( let i = 0; i < datasets.length; i++ ) {
                    const { factor: _srcFactor } = getSIFactor(datasets[i].unit);
                    datasets[i].siConversionFactor = _srcFactor / _targetFactor;
                    entities[i].siConversionFactor = datasets[i].siConversionFactor;
                }
                datasets._siRefUnit = _refUnit;
            }
        }

        const chart = this.newGraph(canvas, type, datasets, config);

        // Update legend overlay height now that chart has been rendered
        if( type === 'line' || type === 'bar' ) {
            const lgEl = this._this.querySelector(`#lg-${gid}`);
            if( lgEl && chart.legend ) {
                lgEl.style.height = (chart.legend.height || 0) + 'px';
            }
        }

        const h = this.calcGraphHeight(type, entities.length, config?.height);

        const interval = this.parseIntervalConfig(config?.interval) ?? 1;

        const g = { "id": gid, "type": type, "canvas": canvas, "graphHeight": h, "chart": chart , "entities": entities, "interval": interval };

        this.graphs.push(g);

        canvas.addEventListener('pointerdown', this.pointerDown.bind(this));
        canvas.addEventListener('pointermove', this.pointerMove.bind(this));
        canvas.addEventListener('pointerup', this.pointerUp.bind(this));
        canvas.addEventListener('pointercancel', this.pointerCancel.bind(this));

        if( type == 'line' || type == 'bar' )
            this.updateScaleLockState(g, false);
    }


    // --------------------------------------------------------------------------------------
    // HTML generation
    // --------------------------------------------------------------------------------------

    addUIHtml(timeline, selector, bgcol, optionStyle, inputStyle, invertZoom, i)
    {
        let html = '';

        if( (timeline || selector) && (this.ui.stickyTools & (1<<i)) ) {
            const threshold = i ? 'bottom:0px' : 'top:var(--header-height)';
            html = `<div style="position:sticky;${threshold};padding-top:${this.ui.hideHeader ? 0 : 15}px;padding-bottom:10px;margin-top:-${this.ui.hideHeader ? 0 : 15}px;z-index:1;background-color:var(--card-background-color);line-height:0px;">`;
        }

        if( timeline || selector ) html += `<div style="margin-left:0px;width:100%;min-height:30px;text-align:center;display:block;line-height:normal;">`;

        const eh = `<a id="eh_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>`;

        if( timeline ) html += `
            <div id="dl_${i}" style="background-color:${bgcol};float:left;margin-left:10px;display:inline-block;padding-left:10px;padding-right:10px;">
                <button id="b1_${i}" style="margin:0px;border:0px solid black;color:inherit;background-color:#00000000;height:30px"><</button>
                <button id="bx_${i}" style="margin:0px;border:0px solid black;color:inherit;background-color:#00000000;height:30px">-</button>
                <button id="b2_${i}" style="margin:0px;border:0px solid black;color:inherit;background-color:#00000000;height:30px">></button>
            </div>`;

        if( selector && isMobile ) html += `
            <div id='sl_${i}' style="background-color:${bgcol};display:none;padding-left:10px;padding-right:10px;">
                <input id="b7_${i}" ${inputStyle} autoComplete="on"/>
                <div id="es_${i}" style="display:none;position:absolute;text-align:left;min-width:260px;max-height:150px;overflow:auto;border:1px solid #444;z-index:1;color:var(--primary-text-color);background-color:var(--card-background-color)"></div>
                <button id="b8_${i}" style="border:0px solid black;color:inherit;background-color:#00000000;height:34px;margin-left:5px;">+</button>
                <button id="bo_${i}" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px;margin-left:1px;margin-right:0px;"><svg width="18" height="18" viewBox="0 0 24 24" style="vertical-align:middle;"><path fill="var(--primary-text-color)" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" /></svg></button>
                <div id="eo_${i}" style="display:none;position:absolute;text-align:left;min-width:150px;overflow:auto;border:1px solid #ddd;box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2);z-index:1;color:var(--primary-text-color);background-color:var(--card-background-color)">
                    <a id="ef_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>
                    ${this.statistics.enabled ? eh : ''}
                    <a id="eg_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>
                    <a id="ei_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>
                </div>
            </div>`;

        if( selector && !isMobile ) html += `
            <div id='sl_${i}' style="background-color:${bgcol};display:none;padding-left:10px;padding-right:10px;">
                <input id="b7_${i}" ${inputStyle} autoComplete="on" placeholder="Type to search for an entity to add"/>
                <button id="b8_${i}" style="border:0px solid black;color:inherit;background-color:#00000000;height:34px;margin-left:5px;">+</button>
                <button id="bo_${i}" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px;margin-left:1px;margin-right:0px;"><svg width="18" height="18" viewBox="0 0 24 24" style="vertical-align:middle;"><path fill="var(--primary-text-color)" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" /></svg></button>
                <div id="eo_${i}" style="display:none;position:absolute;text-align:left;min-width:150px;overflow:auto;border:1px solid #ddd;box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2);z-index:1;color:var(--primary-text-color);background-color:var(--card-background-color)">
                    <a id="ef_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>
                    ${this.statistics.enabled ? eh : ''}
                    <a id="eg_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>
                    <a id="ei_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>
                </div>
            </div>`;

        if( timeline ) html += `
            <div id="dr_${i}" style="background-color:${bgcol};float:right;margin-right:10px;display:inline-block;padding-left:10px;padding-right:10px;">
                <button id="bz_${i}" style="margin:0px;border:0px solid black;color:inherit;background-color:#00000000"><svg width="24" height="24" viewBox="0 0 24 24" style="vertical-align:middle;"><path fill="var(--primary-text-color)" d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z" /></svg></button>
                <button id="b${invertZoom ? 5 : 4}_${i}" style="margin:0px;border:0px solid black;color:inherit;background-color:#00000000;height:30px">-</button>
                <select id="by_${i}" style="margin:0px;border:0px solid black;color:inherit;background-color:#00000000;height:30px;max-width:83px">
                    <option value="0" ${optionStyle} hidden></option>
                    <option value="1" ${optionStyle}></option>
                    <option value="2" ${optionStyle}></option>
                    <option value="3" ${optionStyle} hidden></option>
                    <option value="4" ${optionStyle} hidden></option>
                    <option value="5" ${optionStyle} hidden></option>
                    <option value="6" ${optionStyle}></option>
                    <option value="7" ${optionStyle} hidden></option>
                    <option value="8" ${optionStyle} hidden></option>
                    <option value="9" ${optionStyle} hidden></option>
                    <option value="10" ${optionStyle} hidden></option>
                    <option value="11" ${optionStyle} hidden></option>
                    <option value="12" ${optionStyle}></option>
                    <option value="24" ${optionStyle}></option>
                    <option value="48" ${optionStyle}></option>
                    <option value="72" ${optionStyle}></option>
                    <option value="96" ${optionStyle} hidden></option>
                    <option value="120" ${optionStyle} hidden></option>
                    <option value="144" ${optionStyle} hidden></option>
                    <option value="168" ${optionStyle}></option>
                    <option value="336" ${optionStyle}></option>
                    <option value="504" ${optionStyle}></option>
                    <option value="720" ${optionStyle}></option>
                    <option value="2184" ${optionStyle}></option>
                    <option value="4368" ${optionStyle}></option>
                    <option value="8760" ${optionStyle}></option>
                </select>
                <button id="b${invertZoom ? 4 : 5}_${i}" style="margin:0px;border:0px solid black;color:inherit;background-color:#00000000;height:30px">+</button>
            </div>`;

        if( timeline || selector ) html += `</div>`;

        html += `<div id='rf_${i}' style="margin-left:0px;margin-top:10px;margin-bottom:0px;width:100%;text-align:center;display:none;line-height:normal;"></div>`;

        if( (timeline || selector) && (this.ui.stickyTools & (1<<i)) ) html += `</div>`;

        return html;
    }

    insertUIHtmlText(i)
    {
        let ef = this._this.querySelector(`#ef_${i}`); if( ef ) ef.innerHTML = i18n('ui.menu.export_csv');
        let eh = this._this.querySelector(`#eh_${i}`); if( eh ) eh.innerHTML = i18n('ui.menu.export_stats');
        let eg = this._this.querySelector(`#eg_${i}`); if( eg ) eg.innerHTML = i18n('ui.menu.remove_all');
        let ei = this._this.querySelector(`#ei_${i}`); if( ei ) ei.innerHTML = infoPanelEnabled ? i18n('ui.menu.disable_panel') : i18n('ui.menu.enable_panel');
        let by = this._this.querySelector(`#by_${i}`);
        if( by ) {
            by.children[0].innerHTML = i18n('ui.ranges.l_hour');
            by.children[1].innerHTML = i18n('ui.ranges.hour');
            by.children[2].innerHTML = i18n('ui.ranges.n_hours', 2);
            by.children[3].innerHTML = i18n('ui.ranges.n_hours', 3);
            by.children[4].innerHTML = i18n('ui.ranges.n_hours', 4);
            by.children[5].innerHTML = i18n('ui.ranges.n_hours', 5);
            by.children[6].innerHTML = i18n('ui.ranges.n_hours', 6);
            by.children[7].innerHTML = i18n('ui.ranges.n_hours', 7);
            by.children[8].innerHTML = i18n('ui.ranges.n_hours', 8);
            by.children[9].innerHTML = i18n('ui.ranges.n_hours', 9);
            by.children[10].innerHTML = i18n('ui.ranges.n_hours', 10);
            by.children[11].innerHTML = i18n('ui.ranges.n_hours', 11);
            by.children[12].innerHTML = i18n('ui.ranges.n_hours', 12);
            by.children[13].innerHTML = i18n('ui.ranges.day');
            by.children[14].innerHTML = i18n('ui.ranges.n_days', 2);
            by.children[15].innerHTML = i18n('ui.ranges.n_days', 3);
            by.children[16].innerHTML = i18n('ui.ranges.n_days', 4);
            by.children[17].innerHTML = i18n('ui.ranges.n_days', 5);
            by.children[18].innerHTML = i18n('ui.ranges.n_days', 6);
            by.children[19].innerHTML = i18n('ui.ranges.week');
            by.children[20].innerHTML = i18n('ui.ranges.n_weeks', 2);
            by.children[21].innerHTML = i18n('ui.ranges.n_weeks', 3);
            by.children[22].innerHTML = i18n('ui.ranges.month');
            by.children[23].innerHTML = i18n('ui.ranges.n_months', 3);
            by.children[24].innerHTML = i18n('ui.ranges.n_months', 6);
            by.children[25].innerHTML = i18n('ui.ranges.year');
        }
    }

    resize()
    {
        const w = this._this.querySelector('#maincard').clientWidth;

        if( Math.abs(this.lastWidth - w) > 2 ) {
            const tickChanged = this.computeTickDensity(w) != this.computeTickDensity(this.lastWidth);
            this.lastWidth = w;
            for( let g of this.graphs ) g.chart.resize(undefined, g.graphHeight);
            if( tickChanged ) this.setStepSize(true);
        }

        this.resizeSelector();
    }

    adjustSelectorPosition(reflow, i)
    {
        const rfdiv = this._this.querySelector(`#rf_${i}`);
        const selector = this._this.querySelector(`#sl_${i}`);

        selector.style.display = 'inline-block';

        const isReflown = rfdiv.style.display !== 'none';

        if( !reflow && isReflown ) {
            rfdiv.style.display = 'none';
            const anchor = this._this.querySelector(`#dl_${i}`);
            anchor.after(selector);
        } else if( reflow && !isReflown ) {
            rfdiv.style.display = 'block';
            rfdiv.appendChild(selector);
        }
    }

    resizeSelector()
    {
        const button_size = 120;
        const min_selector_size = 220;
        const max_selector_size = 500;

        const w = this._this.querySelector('#maincard').clientWidth;

        for( let i = 0; i < 2; ++i ) {
            const input = this._this.querySelector(`#b7_${i}`);
            if( input ) {
                let xw = w - button_size - (this._this.querySelector(`#dl_${i}`)?.clientWidth ?? 0) - (this._this.querySelector(`#dr_${i}`)?.clientWidth ?? 0);
                const reflow = ( xw < min_selector_size && this._this.querySelector(`#dl_${i}`) != null );
                this.adjustSelectorPosition(reflow, i);
                if( !reflow ) {
                    xw = Math.min(xw, max_selector_size);
                    input.style.width = xw + "px";
                } else
                    input.style.width = (w - 108) + "px";
            }
        }
    }

    async createContent()
    {
        // Initialize the content if it's not there yet.
        if( !this.contentValid ) {

            this.contentValid = true;

            for( let i = 0; i < 2; i++ )
                this.insertUIHtmlText(i);

            let bgcol = getComputedStyle(this._this.querySelector('#maincard')).backgroundColor.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);

            this.ui.darkMode = (this._hass.selectedTheme && this._hass.selectedTheme.dark) || (this._hass.themes && this._hass.themes.darkMode);
            this.ui.darkMode |= bgcol && bgcol.length == 4 && (((+bgcol[1]) + (+bgcol[2]) + (+bgcol[3])) / 3 <= 100);
            if( this._this.config.uimode ) {
                if( this._this.config.uimode === 'dark' ) this.ui.darkMode = true; else
                if( this._this.config.uimode === 'light' ) this.ui.darkMode = false;
            }

            this.pconfig.graphLabelColor = parseColor(this._this.config.uiColors?.labels ?? (this.ui.darkMode ? '#9b9b9b' : '#333'));
            this.pconfig.graphGridColor  = parseColor(this._this.config.uiColors?.gridlines ?? (this.ui.darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"));
            this.pconfig.cursorLineColor = parseColor(this._this.config.uiColors?.cursorline ?? this.pconfig.graphGridColor);

            this.pconfig.nextDefaultColor = 0;

            this.graphs = [];

            // Add fixed YAML defined graphs
            for( let g of this.pconfig.graphConfig ) this.addFixedGraph(g);

            this.resizeSelector();

            ///
            for( let i = 0; i < 2; i++ ) {

                this._this.querySelector(`#b1_${i}`)?.addEventListener('click', this.subDay.bind(this), false);
                this._this.querySelector(`#b2_${i}`)?.addEventListener('click', this.addDay.bind(this), false);
                this._this.querySelector(`#b4_${i}`)?.addEventListener('click', this.decZoom.bind(this), false);
                this._this.querySelector(`#b5_${i}`)?.addEventListener('click', this.incZoom.bind(this), false);
                this._this.querySelector(`#b8_${i}`)?.addEventListener('click', this.addEntitySelected.bind(this));
                this._this.querySelector(`#bx_${i}`)?.addEventListener('click', this.todayNoReset.bind(this), false);
                this._this.querySelector(`#bx_${i}`)?.addEventListener('dblclick', this.todayReset.bind(this), false);
                this._this.querySelector(`#by_${i}`)?.addEventListener('change', this.timeRangeSelected.bind(this));
                this._this.querySelector(`#bz_${i}`)?.addEventListener('click', this.toggleZoom.bind(this), false);
                this._this.querySelector(`#ef_${i}`)?.addEventListener('click', this.exportFile.bind(this), false);
                this._this.querySelector(`#eh_${i}`)?.addEventListener('click', this.exportStatistics.bind(this), false);
                this._this.querySelector(`#eg_${i}`)?.addEventListener('click', this.removeAllEntities.bind(this), false);
                this._this.querySelector(`#ei_${i}`)?.addEventListener('click', this.toggleInfoPanel.bind(this), false);
                this._this.querySelector(`#bo_${i}`)?.addEventListener('click', this.menuClicked.bind(this), false);

                if( isMobile ) {
                    this._this.querySelector(`#b7_${i}`)?.addEventListener('focusin', this.entitySelectorFocus.bind(this), true);
                    this._this.querySelector(`#b7_${i}`)?.addEventListener('keyup', this.entitySelectorEntered.bind(this), true);
                }

                this.ui.dateSelector[i] = this._this.querySelector(`#bx_${i}`);
                this.ui.rangeSelector[i] = this._this.querySelector(`#by_${i}`);
                this.ui.zoomButton[i] = this._this.querySelector(`#bz_${i}`);

            }

            if( !isMobile ) {
                this._this.querySelector('#maincard').addEventListener('wheel', this.wheelScrolled.bind(this), { passive: false });
                for( let i = 0; i < 2; ++i ) {
                    const input = this._this.querySelector(`#b7_${i}`);
                    if( input ) {
                        input.addEventListener('keyup', () => {
                            if( input.value && !input.getAttribute('list') )
                                input.setAttribute('list', `b6_${this.cid}`);
                        }, true);
                        input.addEventListener('focusout', () => {
                            input.removeAttribute('list');
                        }, true);
                    }
                }
            }

            await this.readLocalState();

            this.pconfig.nextDefaultColor = 0;

            // Add dynamically added graphs
            if( this.pconfig.entities ) {
                // Group by groupId, preserving first-occurrence order
                const _groupMap = new Map();
                const _groupOrder = [];
                for( let e of this.pconfig.entities ) {
                    const _groupId = typeof e === 'object' ? e.groupId : undefined;
                    const _key = _groupId ?? Symbol(); // undefined groupId = unique group
                    if( !_groupMap.has(_key) ) {
                        _groupMap.set(_key, { groupId: _groupId, entities: [] });
                        _groupOrder.push(_key);
                    }
                    _groupMap.get(_key).entities.push(e);
                }
                // Add each group as a single graph, in first-occurrence order
                for( let _key of _groupOrder ) {
                    const _group = _groupMap.get(_key);
                    if( _group.entities.length === 1 ) {
                        const _e = _group.entities[0];
                        this.addDynamicGraph(typeof _e === 'string' ? _e : _e.entity, true, _e.color, _e.fill, null, _e.hidden);
                    } else {
                        // Multiple entities in same group — force-combine
                        const _saved = this.pconfig.combineSameUnits;
                        this.pconfig.combineSameUnits = true;
                        _group.entities.forEach((_e, _i) => {
                            const _eid = typeof _e === 'string' ? _e : _e.entity;
                            this.addDynamicGraph(_eid, _i === 0, _e.color, _e.fill, _i === 0 ? null : this.graphs[this.graphs.length - 1], _e.hidden);
                        });
                        this.pconfig.combineSameUnits = _saved;
                    }
                }
            } else
                this.pconfig.entities = [];

            this.setTimeRangeFromString(String(this.pconfig.defaultTimeRange));

            this.today(false);

            // Register observer to resize the graphs whenever the maincard dimensions change
            let ro = new ResizeObserver(entries => { this.resize(); });
            ro.observe(this._this.querySelector('#maincard'));

            // Update the info panel config in the browser local storage to sync with the YAML
            this.writeInfoPanelConfig();

            // Set auto refresh interval, if any
            if( this.pconfig.refreshInterval )
                setInterval(this.refresh.bind(this), this.pconfig.refreshInterval * 1000);

        }
    }

    refresh()
    {
        this.cache[this.cacheSize].valid = false;
        this.updateHistory();
    }

    updateContent()
    {
        if( !this.contentValid ) {
            let width = this._this.querySelector('#maincard').clientWidth;
            if( width > 0 ) {
                clearInterval(this.iid);
                this.createContent().catch(e => console.error('history-explorer-card createContent error:', e));
                this.iid = null;
            }
        }
    }


    // --------------------------------------------------------------------------------------
    // Entity option dropdown menu
    // --------------------------------------------------------------------------------------

    menuSetVisibility(idx, show)
    {
        const dropdown = this._this.querySelector(`#eo_${idx}`);
        if( !dropdown ) return;

        this._this.querySelector(`#bo_${idx}`).style.transform = show ? 'scale(1,-1)' : 'scale(1,1)';

        if( show ) {
            dropdown.style.display = 'block';
            const w = this._this.querySelector('#maincard').clientWidth - 4;
            let p = this._this.querySelector(`#bo_${idx}`).offsetLeft - 30;
            if( p + dropdown.clientWidth >= w ) {
                p = w - dropdown.clientWidth;
            }
            dropdown.style.left = p + "px";
        } else
            dropdown.style.display = 'none';
    }

    menuClicked(event)
    {
        if( !event.currentTarget ) return;
        const idx = event.currentTarget.id.substr(3) * 1;
        this.menuSetVisibility(idx, this._this.querySelector(`#eo_${idx}`)?.style.display == 'none');
    }


    // --------------------------------------------------------------------------------------
    // Alternative compact dropdown list implementation for mobile browsers and apps
    // --------------------------------------------------------------------------------------

    setDropdownVisibility(input_idx, show)
    {
        let input = this._this.querySelector(`#b7_${input_idx}`);
        let dropdown = this._this.querySelector(`#es_${input_idx}`);
        if( !input || !dropdown ) return;
        if( show ) {
            dropdown.style['min-width'] = input.clientWidth + 'px';
            dropdown.style.display = 'block';
            for( let i of dropdown.getElementsByTagName('a') ) i.style.display = 'block';
        } else
            dropdown.style.display = 'none';
    }

    entitySelectorFocus(event)
    {
        if( !event.target ) return;

        const idx = event.target.id.substr(3) * 1;

        this.setDropdownVisibility(idx ^ 1, false);
        this.setDropdownVisibility(idx, true);

        this.focusClick = true;

        if( !this.focusListener ) {
            this.focusListener = true;
            window.addEventListener('click', this.defocusCall);
        }
    }

    entitySelectorDefocus(event)
    {
        if( !this.focusClick ) {
            window.removeEventListener('click', this.defocusCall);
            this.focusListener = undefined;
            this.setDropdownVisibility(0, false);
            this.setDropdownVisibility(1, false);
        } else
            this.focusClick = undefined;
    }

    entitySelectorEntered(event)
    {
        if( !event.target ) return;

        const idx = event.target.id.substr(3) * 1;

        let dropdown = this._this.querySelector(`#es_${idx}`);
        let input = this._this.querySelector(`#b7_${idx}`);
        let filter = input.value.toLowerCase();
        let tags = dropdown.getElementsByTagName('a');
        for( let i of tags ) {
            let txt = i.textContent;
            if( txt.toLowerCase().indexOf(filter) >= 0 )
                i.style.display = 'block';
            else
                i.style.display = 'none';
        }
    }

    entitySelectorEntryClicked(event)
    {
        window.removeEventListener('click', this.defocusCall);
        this.focusListener = undefined;
        const idx = event.target.href.slice(-1);
        let input = this._this.querySelector(`#b7_${idx}`);
        let dropdown = this._this.querySelector(`#es_${idx}`);
        input.value = event.target.id;
        dropdown.style.display = 'none';
    }


    // --------------------------------------------------------------------------------------
    // Entity listbox populators
    // --------------------------------------------------------------------------------------

    buildFilterRegexList()
    {
        let regex = [];
        if( this.pconfig.filterEntities ) {
            if( Array.isArray(this.pconfig.filterEntities) ) {
                for( let j of this.pconfig.filterEntities ) if( j ) regex.push(this.matchWildcardPattern(j));
            } else
                regex.push(this.matchWildcardPattern(this.pconfig.filterEntities));
        }
        return regex;
    }

    matchRegexList(regex, v)
    {
        if( !regex.length ) return true;
        for( let j of regex ) if( j.test(v) ) return true;
        return false;
    }

    entityCollectorCallback(result)
    {
        for( let i = 0; i < (isMobile ? 2 : 1); ++i ) {

            const datalist = this._this.querySelector(isMobile ? `#es_${i}` : `#b6_${this.cid}`);
            if( !datalist ) continue;

            while( datalist.firstChild ) datalist.removeChild(datalist.firstChild);

            const regex = this.buildFilterRegexList();

            let entities = [];
            for( let entity in result ) {
                if( this.matchRegexList(regex, entity) ) entities.push(entity);
            }

            entities.sort();

            for( let entity of entities ) {
                let o;
                if( isMobile ) {
                    o = document.createElement('a');
                    o.href = `#s_${i}`;
                    o.id = entity;
                    o.style = "display:block;padding:2px 5px;text-decoration:none;color:inherit";
                    o.addEventListener('click', this.entitySelectorEntryClicked.bind(this), true);
                } else
                    o = document.createElement('option');
                o.innerHTML = entity;
                datalist.appendChild(o);
            }

        }

        for( let i of this.ui.inputField )
            if( i ) i.placeholder = i18n("ui.label.type_to_search");
    }

    entityCollectorFailed(error)
    {
        console.log(error);

        this.entityCollectAll();

        for( let i of this.ui.inputField )
            if( i ) i.placeholder = i18n("ui.label.error_retreiving");
    }

    entityCollectAll()
    {
        for( let i = 0; i < (isMobile ? 2 : 1); ++i ) {

            const datalist = this._this.querySelector(isMobile ? `#es_${i}` : `#b6_${this.cid}`);
            if( !datalist ) continue;

            while( datalist.firstChild ) datalist.removeChild(datalist.firstChild);

            const regex = this.buildFilterRegexList();

            let entities = [];
            for( let e in this._hass.states ) {
                if( !this.matchRegexList(regex, e) ) continue;
                const d = this.getDomainForEntity(e);
                if( !['automation', 'script', 'zone', 'camera', 'persistent_notification', 'timer'].includes(d) ) {
                    entities.push(e);
                }
            }

            entities.sort();

            for( let entity of entities ) {
                let o;
                if( isMobile ) {
                    o = document.createElement('a');
                    o.href = `#s_${i}`;
                    o.id = entity;
                    o.style = "display:block;padding:2px 5px;text-decoration:none;color:inherit";
                    o.addEventListener('click', this.entitySelectorEntryClicked.bind(this), true);
                } else
                    o = document.createElement('option');
                o.innerHTML = entity;
                datalist.appendChild(o);
            }

        }

        for( let i of this.ui.inputField )
            if( i ) i.placeholder = i18n("ui.label.type_to_search");
    }

    requestEntityCollection()
    {
        if( this.entitiesPopulated ) return;

        this.entitiesPopulated = true;

        // No point populating the datalist if the selector is not visible
        if( this.ui.hideSelector ) return;

        this.ui.inputField[0] = this._this.querySelector(`#b7_0`);
        this.ui.inputField[1] = this._this.querySelector(`#b7_1`);

        if( this.pconfig.recordedEntitiesOnly ) {

            for( let i of this.ui.inputField )
                if( i ) i.placeholder = i18n("ui.label.loading");

            const t0 = moment().subtract(1, "hour").format('YYYY-MM-DDTHH:mm:ss');

            const regex = this.buildFilterRegexList();

            let l = [];
            for( let e in this._hass.states ) {
                if( !this.matchRegexList(regex, e) ) continue;
                const d = this.getDomainForEntity(e);
                if( !['automation', 'script', 'zone', 'camera', 'persistent_notification', 'timer'].includes(d) ) l.push(e);
            }

            const d = {
                type: "history/history_during_period",
                start_time: t0,
                minimal_response: true,
                no_attributes: true,
                entity_ids: l

            };
            this._hass.callWS(d).then(this.entityCollectorCallback.bind(this), this.entityCollectorFailed.bind(this));

        } else

            this.entityCollectAll();

    }


    // --------------------------------------------------------------------------------------
    // Localization
    // --------------------------------------------------------------------------------------

    initLocalization()
    {
        if( this.i18n.valid ) return;

        let locale = this._hass.language ? this._hass.language : 'en-GB';

        setLanguage(locale);

        this.ui.wideInterval = ['da', 'nl', 'sv', 'sk', 'ru'].includes(locale);

        const ds = getLocalizedDateString(locale, { dateStyle: 'medium' });
        const dt = ( ds[0] == 'D' ) ? 'D MMM' : 'MMM D';
        this.i18n.styleDateTicks = this.pconfig.timeTickShortDate ? 'D' : dt;
        this.i18n.styleDateSelector = isMobile ? dt : ds;

        if( this._hass.locale?.time_format === '24' ) locale = 'en-GB';
        if( this._hass.locale?.time_format === '12' ) locale = 'en-US';

        this.i18n.styleTimeTicks = getLocalizedDateString(locale, { timeStyle: 'short' });
        this.i18n.styleDateTimeTooltip = this.i18n.styleDateTicks + ', ' + getLocalizedDateString(locale, { timeStyle: 'medium' });

        this.i18n.valid = true;
    }


    // --------------------------------------------------------------------------------------
    // Dynamic data storage
    // --------------------------------------------------------------------------------------

    async writeLocalState()
    {
        const data = { "version" : 1, "entities" : this.pconfig.entities };
        const _json = JSON.stringify(data);

        // Write to localStorage as backup
        window.localStorage.removeItem('history-explorer-card');
        window.localStorage.removeItem('history-explorer_card_' + this.id);
        window.localStorage.setItem('history-explorer_card_' + this.id, _json);

        // Write to HA user storage (persists across devices for same user)
        try {
            await this._hass.callWS({ type: 'frontend/set_user_data', key: 'history-explorer_card_' + this.id, value: data });
        } catch(e) {}
    }

    async readLocalState()
    {
        let data = null;

        // Try HA user storage first
        try {
            const _result = await this._hass.callWS({ type: 'frontend/get_user_data', key: 'history-explorer_card_' + this.id });
            if( _result?.value ) data = _result.value;
        } catch(e) {}

        // Fallback to localStorage
        if( !data ) {
            const _local = window.localStorage.getItem('history-explorer_card_' + this.id);
            if( _local ) {
                data = JSON.parse(_local);
                // Migrate to HA storage
                if( data ) {
                    try { await this._hass.callWS({ type: 'frontend/set_user_data', key: 'history-explorer_card_' + this.id, value: data }); } catch(e) {}
                }
            }
        }

        if( data && data.version === 1 ) {
            this.pconfig.entities = data.entities.map(e => typeof e === 'string' ? { entity: e } : e);
        } else {
            // Legacy format fallback
            const _legacy = window.localStorage.getItem('history-explorer-card');
            if( _legacy ) {
                const _legacyData = JSON.parse(_legacy);
                if( _legacyData )
                    this.pconfig.entities = _legacyData.map(e => typeof e === 'string' ? { entity: e } : e);
                else
                    this.pconfig.entities = [];
            } else {
                this.pconfig.entities = [];
            }
        }
        // Set _nextGroupId to max existing groupId + 1
        const _maxGroupId = Math.max(0, ...this.pconfig.entities.map(e => e.groupId ?? 0));
        this._nextGroupId = _maxGroupId + 1;
    }

    async writeInfoPanelConfig(forceUpdate = false)
    {
        if( !infoPanelEnabled ) {
            window.localStorage.removeItem('history-explorer-info-panel');
            try { await this._hass.callWS({ type: 'frontend/set_user_data', key: 'history-explorer-info-panel', value: null }); } catch(e) {}
        } else if( infoPanelEnabled && (this.pconfig.infoPanelConfig || forceUpdate) ) {
            let _data = {};
            _data.enabled = true;
            _data.config = this.pconfig.infoPanelConfig;
            window.localStorage.removeItem('history-explorer-info-panel');
            window.localStorage.setItem('history-explorer-info-panel', JSON.stringify(_data));
            try { await this._hass.callWS({ type: 'frontend/set_user_data', key: 'history-explorer-info-panel', value: _data }); } catch(e) {}
        }
    }


    // --------------------------------------------------------------------------------------
    // On demand refresh handling
    // --------------------------------------------------------------------------------------

    handleChangedEntities()
    {
        if( !this.pconfig.showCurrentValues && !this.pconfig.refreshEnabled ) return false;

        let changed = false;

        for( let g of this.graphs ) {
            let i = 0;
            for( let e of g.entities ) {
                const lc = this._hass.states[e.entity].last_changed;
                if( this.stateMap.has(e.entity) && lc != this.stateMap.get(e.entity) ) {
                    if( this.pconfig.showCurrentValues && g !== this._frozenChart ) {
                        let d = g.chart.data.datasets[i];
                        d.label = this.getFormattedLabelName(d.name, e.entity, d.unit);
                    }
                    changed = true;
                }
                this.stateMap.set(e.entity, lc);
                i++;
            }
        }

        return changed;
    }


    // --------------------------------------------------------------------------------------
    // Build initial graph list from YAML
    // --------------------------------------------------------------------------------------

    buildEntityExclusionList(exclude)
    {
        let exregex = [];

        if( exclude )
            for( let i of exclude ) {
                const regex = this.matchWildcardPattern(i.entity);
                if( regex ) exregex.push(regex);
            }

        return exregex;
    }

    buildGraphListFromConfig(graphs)
    {
        const testEntityExclusionList = function(entity, excludes) { for( let i of excludes ) if( i.test(entity) ) return true; return false; };

        for( let graph of graphs ) {
            if( !graph.entities ) continue;
            let l = { ...graph, 'entities' : [] };
            for( let e of graph.entities ) {
                if( e.entity.indexOf('*') >= 0 ) {
                    const regexExcludes = this.buildEntityExclusionList(e.exclude);
                    const regex = this.matchWildcardPattern(e.entity);
                    for( let s in this._hass.states ) {
                        if( regex && regex.test(s) && !testEntityExclusionList(s, regexExcludes) ) {
                            l.entities.push({...e, 'entity' : s});
                        }
                    }
                } else
                    l.entities.push(e);
            }
            this.pconfig.graphConfig.push({ graph: l, id:this.g_id++ });
        }
    }
}


// --------------------------------------------------------------------------------------
// Get time and date formating strings for a given locale
// --------------------------------------------------------------------------------------

function isSingleSymbol(s)
{
    return s.length == 1 && s[0].toLowerCase() == s[0].toUpperCase();
}

function getLocalizedDateString(locale, style)
{
    let s = new Intl.DateTimeFormat(locale, style).formatToParts(new Date());

    return s.map(part => {
        switch( part.type ) {
            case 'year': return 'YYYY';
            case 'month': return 'MMM';
            case 'day': return 'D';
            case 'hour': return ( s.findIndex((e) => e.type == 'dayPeriod') >= 0 ) ? 'h' : 'HH';
            case 'minute': return 'mm';
            case 'second': return 'ss';
            case 'dayPeriod': return 'a';
            default: return ( ['.', ',', '/', '-'].includes(part.value) || !isSingleSymbol(part.value) ) ? ' ' : part.value;
        }
    }).join("");
}


// --------------------------------------------------------------------------------------
// Main card custom HTML element
// --------------------------------------------------------------------------------------

var gcid = 0;

class HistoryExplorerCard extends HTMLElement
{
    instance = null;
    configSet = false;

    // Whenever the state changes, a new `hass` object is set. Use this to update your content.
    set hass(hass)
    {
        if( this.configSet ) {
            this.configSet = false;
            this.InitWithConfig(hass);
        }

        if( !this.instance ) return;

        this.instance._this = this;
        this.instance._hass = hass;

        this.instance.version = hass.config.version.split('.').map(Number);

        if( !this.instance.i18n.valid )
            this.instance.initLocalization();

        if( !this.instance.entitiesPopulated )
            this.instance.requestEntityCollection();

        if( !this.instance.contentValid && !this.instance.iid )
            this.instance.iid = setInterval(this.instance.updateContent.bind(this.instance), 100);

        if( this.instance.contentValid && this.instance.handleChangedEntities() ) {
            if( this.instance.pconfig.showCurrentValues )
                this.instance.updateHistory();
            if( this.instance.pconfig.refreshEnabled ) {
                this.instance.cache[this.instance.cacheSize].valid = false;
                if( this.instance.tid ) clearTimeout(this.instance.tid);
                this.instance.tid = setTimeout(this.instance.updateHistoryAutoRefresh.bind(this.instance), 2000);
            }
        }

    }

    set panel(panel)
    {
        this.setConfig(panel.config);
    }

    // The user supplied configuration. Throw an exception and Lovelace will render an error card.
    setConfig(config)
    {
        this.config = config;
        this.configSet = true;
    }

    InitWithConfig(hass)
    {
        const config = this.config;

        if( !this.instance )
            this.instance = new HistoryCardState();

        this.instance._hass = hass;

        this.instance.g_id = 0;

        this.instance.pconfig.graphConfig = [];

        if( config.graphs )
            this.instance.buildGraphListFromConfig(config.graphs)

        this.instance.firstDynamicId = this.instance.g_id;

        this.instance.pconfig.customStateColors = {};

        if( config.stateColors ) {
            for( let i in config.stateColors ) {
                this.instance.pconfig.customStateColors[i] = parseColor(config.stateColors[i]);
            }
        }

        this.instance.pconfig.entityOptions = config.entityOptions;

        this.instance.pconfig.labelAreaWidth =         config.labelAreaWidth ?? 65;
        this.instance.pconfig.labelsVisible =          config.labelsVisible ?? true;
        this.instance.pconfig.hideLegend =           ( config.legendVisible == false ) ? true : undefined;
        this.instance.pconfig.cursorMode =             config.cursor?.mode ?? 'auto';
        this.instance.pconfig.cursorTypes =            config.cursor?.types ?? ['timeline'];
        this.instance.pconfig.showTooltipColors[0] =   config.tooltip?.showColorsLine ?? config.showTooltipColorsLine ?? true;
        this.instance.pconfig.showTooltipColors[1] =   config.tooltip?.showColorsTimeline ?? config.showTooltipColorsTimeline ?? true;
        this.instance.pconfig.tooltipSize =            config.tooltip?.size ?? config.tooltipSize ?? 'auto';
        this.instance.pconfig.tooltipShowDuration =    config.tooltip?.showDuration ?? config.tooltipShowDuration ?? false;
        this.instance.pconfig.tooltipShowLabel =       config.tooltip?.showLabel ?? true;
        this.instance.pconfig.tooltipStateTextMode =   config.tooltip?.stateTextMode ?? config.stateTextMode ?? 'auto';
        this.instance.pconfig.colorSeed =              config.stateColorSeed ?? 137;
        this.instance.pconfig.stateTextMode =          config.stateTextMode ?? 'auto';
        this.instance.pconfig.decimation =             config.decimation;
        this.instance.pconfig.roundingPrecision =      config.rounding || 2;
        this.instance.pconfig.defaultLineMode =        this.instance.normalizeLineMode(config.lineMode);
        this.instance.pconfig.defaultLineWidth =       config.lineWidth ?? 2.0;
        this.instance.pconfig.showUnavailable =        config.showUnavailable ?? false;
        this.instance.pconfig.showCurrentValues =      config.showCurrentValues ?? true;
        this.instance.pconfig.axisAddMarginMin =     ( config.axisAddMarginMin !== undefined ) ? config.axisAddMarginMin : false;
        this.instance.pconfig.axisAddMarginMax =     ( config.axisAddMarginMax !== undefined ) ? config.axisAddMarginMax : false;
        this.instance.pconfig.recordedEntitiesOnly =   config.recordedEntitiesOnly ?? false;
        this.instance.pconfig.filterEntities  =        config.filterEntities;
        this.instance.pconfig.combineSameUnits =       config.combineSameUnits === true;
        this.instance.pconfig.defaultTimeRange =       config.defaultTimeRange ?? '24';
        this.instance.pconfig.defaultTimeOffset =      config.defaultTimeOffset ?? undefined;
        this.instance.pconfig.timeTickDensity =        config.timeTicks?.density ?? config.timeTickDensity ?? 'high';
        this.instance.pconfig.timeTickOverride =       config.timeTicks?.densityOverride ?? undefined;
        this.instance.pconfig.timeTickShortDate =      config.timeTicks?.dateFormat === 'short';
        this.instance.pconfig.lineGraphHeight =      ( config.lineGraphHeight ?? 250 ) * 1;
        this.instance.pconfig.barGraphHeight =       ( config.barGraphHeight ?? 150 ) * 1;
        this.instance.pconfig.timelineBarHeight =    ( config.timelineBarHeight ?? 24 ) * 1;
        this.instance.pconfig.timelineBarSpacing =   ( config.timelineBarSpacing ?? 40 ) * 1;
        this.instance.pconfig.refreshEnabled =         config.refresh?.automatic ?? false;
        this.instance.pconfig.refreshInterval =        config.refresh?.interval ?? undefined;
        this.instance.pconfig.exportSeparator =        config.csv?.separator;
        this.instance.pconfig.exportTimeFormat =       config.csv?.timeFormat;
        this.instance.pconfig.exportAttributes =       config.csv?.exportAttributes;
        this.instance.pconfig.exportStatsPeriod =      config.csv?.statisticsPeriod ?? 'hour';
        this.instance.pconfig.exportNumberLocale =     config.csv?.numberLocale;
        this.instance.statistics.enabled =             config.statistics?.enabled ?? true;
        this.instance.statistics.mode =                config.statistics?.mode ?? 'mean';
        this.instance.statistics.retention =           config.statistics?.retention ?? undefined;
        this.instance.statistics.period =              config.statistics?.period ?? 'hour';
        this.instance.statistics.force =               config.statistics?.force ?? undefined;

        this.instance.pconfig.closeButtonColor = parseColor(config.uiColors?.closeButton ?? '#0000001f');

        this.instance.pconfig.infoPanelConfig = config.infoPanel;

        this.instance.id = config.cardName ?? "default";
        this.instance.cid = gcid++;

        this.instance.contentValid = false;
        this.instance.entitiesPopulated = false;

        const header = config.header || `History explorer v${Version}`;
        const bgcol = parseColor(config.uiColors?.buttons ?? getComputedStyle(document.body).getPropertyValue('--primary-color') + '1f');

        const bitmask = { 'hide': 0, 'top': 1, 'bottom': 2, 'both': 3 };
        const tools = bitmask[config.uiLayout?.toolbar] ?? 1;
        const selector = bitmask[config.uiLayout?.selector] ?? 2;
        this.instance.ui.stickyTools = bitmask[config.uiLayout?.sticky] ?? 0;
        this.instance.ui.hideSelector = selector === 0;

        const invertZoom = config.uiLayout?.invertZoom === true;

        const optionStyle = `style="color:var(--primary-text-color);background-color:var(--card-background-color)"`;
        const inputStyle = config.uiColors?.selector ? `style="color:var(--primary-text-color);background-color:${config.uiColors.selector};border:1px solid black;"` : '';

        this.instance.ui.optionStyle = optionStyle;
        this.instance.ui.hideHeader = header === 'hide';
        this.instance.ui.hideInterval = config.uiLayout?.interval === 'hide';

        // Generate card html

        // Header
        let html = `
            <ha-card id="maincard" header="${this.instance.ui.hideHeader ? '' : header}">
            ${this.instance.addUIHtml(tools & 1, selector & 1, bgcol, optionStyle, inputStyle, invertZoom, 0)}
            <div id='graphlist' class='card-content' style='margin-top:${(this.instance.ui.stickyTools & 1) ? '0px' : '8px'};'>
        `;

        // Graph area
        let spacing = true;
        for( let g of this.instance.pconfig.graphConfig ) {
            if( g.id > 0 && spacing ) html += '<br>';
            if( g.graph.title !== undefined ) html += `<div style='text-align:center;'>${g.graph.title}</div>`;
            const h = this.instance.calcGraphHeight(g.graph.type, g.graph.entities.length, g.graph.options?.height);
            html += `<div style='height:${h}px;position:relative'>`;
            html += `<canvas id="graph${g.id}" height="${h}px" style='touch-action:pan-y'></canvas>`;
            if( g.graph.type == 'bar' && !this.instance.ui.hideInterval )
                html += this.instance.createIntervalSelectorHtml(g.id, h, this.instance.parseIntervalConfig(g.graph.options?.interval), optionStyle);
            if( g.graph.type == 'line' || g.graph.type == 'bar' )
                html += this.instance.createScaleLockIconHtml(g.id, h);
            if( g.graph.type == 'line' || g.graph.type == 'bar' )
                html += `<div id="ya-${g.id}" style="position:absolute;left:0;top:28px;width:${this.instance.pconfig.labelAreaWidth}px;height:${h-28}px;touch-action:none;cursor:ns-resize;"></div>`;
                html += `<div id="mo-${g.id}" style="position:absolute;left:0;top:0;width:30px;height:28px;touch-action:none;cursor:grab;z-index:1;display:flex;align-items:flex-end;padding-left:2px;padding-bottom:3px;color:var(--secondary-text-color);font-size:14px;opacity:0.5;user-select:none;">&#x283F;</div>`;
                if( type == 'line' || type == 'bar' )
                    html += `<div id="lg-${g.id}" style="position:absolute;left:0;top:0;width:100%;height:0px;touch-action:none;pointer-events:none;"></div>`;
            html += `</div>`;
            spacing = !( g.graph.options?.showTimeLabels === false );
        }

        // Footer
        html += `
            </div>
            ${this.instance.addUIHtml(tools & 2, selector & 2, bgcol, optionStyle, inputStyle, invertZoom, 1)}
            ${(((tools | selector) & 2) && !(this.instance.ui.stickyTools & 2)) ? '<br>' : ''}
            <datalist id="b6_${this.instance.cid}"></datalist>
            </ha-card>
        `;

        this.innerHTML = html;

        // Processing spinner (not added to DOM by default)
        this.instance.ui.spinOverlay = document.createElement('div');
        this.instance.ui.spinOverlay.style = 'position:fixed;display:block;width:100%;height:100%;top:0;left:0;right:0;bottom:0;background-color:rgba(0,0,0,0.5);z-index:2;backdrop-filter:blur(5px)';
        this.instance.ui.spinOverlay.innerHTML = `<svg width="38" height="38" viewBox="0 0 38 38" stroke="#fff" style="position:fixed;left:calc(50% - 20px);top:calc(50% - 20px);"><g fill="none" fill-rule="evenodd"><g transform="translate(1 1)" stroke-width="2"><circle stroke-opacity="0.5" cx="18" cy="18" r="18"/><path d="M36 18c0-9.94-8.06-18-18-18"><animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite"/></path></g></g></svg>`;

    }

    // The height of your card. Home Assistant uses this to automatically distribute all cards over the available columns.
    getCardSize()
    {
        return 3;
    }

    static getStubConfig()
    {
        return { "cardName": "historycard-" + Math.floor(Math.random() * 99999999 + 1) };
    }

}

console.info(`%c HISTORY-EXPLORER-CARD %c Version ${Version}`, "color:white;background:blue;font-weight:bold", "color:black;background:white;font-weight:bold");

customElements.define('history-explorer-card', HistoryExplorerCard);

window.customCards = window.customCards || [];
window.customCards.push({ type: 'history-explorer-card', name: 'History Explorer Card', preview: false, description: 'An interactive history viewer card'});
