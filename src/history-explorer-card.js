
import "../deps/moment.js";
import "../deps/Chart.js";
import "../deps/chart-hec.js";
import "../deps/timeline.js";
import "../deps/md5.js"
import "../deps/FileSaver.js"

import { vertline_plugin, minmaxfill_plugin } from "./history-chart-vline.js";
import { HistoryCSVExporter, StatisticsCSVExporter } from "./history-csv-exporter.js";
import { stateColors, stateColorsDark, defaultColors, parseColor, parseColorRange } from "./history-default-colors.js";
import { setLanguage, i18n } from "./languages.js";
import { EntityStore, entityIdOf } from "./history-entity-store.js";
import { getSIFactor, areSICompatible, chooseSIUnit } from "./history-units.js";
import { CardHistory } from "./card-history.js";
import { CardDatasets } from "./card-datasets.js";
import { CardGestures } from "./card-gestures.js";
import { CardMenus, _TYPE_MENU_DEFS, _TYPE_MENU_ORDER, _TYPE_MENU_ITEM_STYLE } from "./card-menus.js";
import { CardStorage } from "./card-storage.js";
import "./history-info-panel.js"

var Chart = window.HXLocal_Chart;
var moment = window.HXLocal_moment;

const Version = '1.2.0';


// Pure versions of a few HistoryCardState entity-lookup helpers, needed by
// history-info-panel.js before an HistoryCardState instance exists (its very first
// render can happen before _hec_instance is created). HistoryCardState's own methods
// below just delegate to these, so there's one implementation, not two.
export function getDomainForEntityPure(entity)
{
    return entity.substr(0, entity.indexOf("."));
}

export function getDeviceClassPure(hass, entity)
{
    return hass.states[entity]?.attributes?.device_class;
}

export function getEntityOptionsPure(hass, entityOptions, entity)
{
    // Simplified version of HistoryCardState.getEntityOptions: no glob/pattern-list
    // matching, since history-info-panel.js's very first render (before an instance
    // exists) only ever needs the direct entity/device_class/domain lookup.
    let c = entityOptions?.[entity];
    if( !c ) {
        const dc = getDeviceClassPure(hass, entity);
        c = dc ? entityOptions?.[dc] : undefined;
        if( !c ) {
            const dm = getDomainForEntityPure(entity);
            c = dm ? entityOptions?.[dm] : undefined;
        }
    }

    return c ?? undefined;
}

// --------------------------------------------------------------------------------------
// Valid time ranges in hours
// --------------------------------------------------------------------------------------

const ranges = [1, 2, 6, 12, 24, 48, 72, 96, 120, 144, 168, 336, 504, 720, 2184, 4368, 8760];


// --------------------------------------------------------------------------------------
// HA entity history info panel enabled flag
// --------------------------------------------------------------------------------------

export let infoPanelEnabled = !!JSON.parse(window.localStorage.getItem('history-explorer-info-panel'));
// (for the other modules: an imported binding can be read, not assigned)
export function setInfoPanelEnabled(v) { infoPanelEnabled = v; }


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
        this.pconfig.graphs               = {};
        this.pconfig.entityOptions        = undefined;
        this.pconfig.lockAllGraphs        = false;
        this.pconfig.combineSameUnits     = false;
        this.pconfig.recordedEntitiesOnly = false;
        this.pconfig.filterEntities       = undefined;
        this.pconfig.excludeFilterEntities = undefined;
        this.pconfig.decimation           = 'fast';
        this.pconfig.roundingPrecision    = 2;
        this.pconfig.defaultLineMode      = undefined;
        this.pconfig.defaultLineWidth     = undefined;
        this.pconfig.defaultDashMode      = undefined;
        this.pconfig.defaultNetBars       = undefined;
        this.pconfig.defaultInterval      = undefined;
        this.pconfig.defaultShowMinMax    = undefined;
        this.pconfig.defaultShowPoints    = undefined;
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
        // Every change to pconfig.entities goes through the store (history-entity-store.js)
        this.store                        = new EntityStore(this.pconfig);
        this.pconfig.infoPanelConfig      = null;
        this.pconfig.defaultInfoPanel     = undefined;

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
        this.state.autoScroll    = false;

        this._drag = null;   // label or graph being dragged (_onDragStart)

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


        this.databaseCallback = null;

    }


    // --------------------------------------------------------------------------------------
    // Color queries
    // --------------------------------------------------------------------------------------

    normalizeLineMode(m)
    {
        // Accept singular aliases: 'line' -> 'lines', 'curve' -> 'curves', 'step' -> 'stepped'
        // ('smart': curves while the source reports, flat dashed plateaus over its
        // silences — see _applySilencePlateaus)
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
            // Persist in dedicated global HA user key (background)
            this._hass.callWS({ type: 'frontend/set_user_data', key: 'history-explorer-infopanel-enabled', value: { enabled: infoPanelEnabled } }).catch(() => {});
            this.applyInfoPanelState();
        }
    }

    applyInfoPanelState()
    {
        const _ls = JSON.parse(window.localStorage.getItem('history-explorer-info-panel') || 'null') || {};
        if( infoPanelEnabled !== !!_ls.enabled ) {
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
        const g = this.graphs.find(gr => gr.id == id);
        if( !g ) return;

        const _value = parseInt(event.target.value);
        const _wasRaw = g.interval == 4;
        const _isRaw = _value == 4;
        g.interval = _value;

        // Persist the interval on every entity of this graph (whichever is rebuilt first
        // carries it — see addGraph's _graphInterval). The entities' own types are left
        // alone: 'raw line' (4) only changes how the bar entities are drawn, never what
        // they are, so picking an interval again turns them back into bars.
        for( let en of g.entities ) {
            const _e = this.store.entry(en.entity);
            if( _e ) _e.interval = _value;
        }

        // Bars <-> raw curves: rebuilt in place, each bar entity's dataset changing kind
        if( _wasRaw !== _isRaw ) {
            const _nextG = this._nextGraph(g);
            const _entities = [...g.entities];
            const _groupId = g.groupId;
            this._detachGraph(g);
            _entities.forEach((en, i) => {
                this.addGraph(en.entity, i === 0, en.color, en.fill, _nextG, undefined, false, _value, _groupId, en);
            });
        }

        this.updateHistory();
        this.writeLocalState();
    }

    createIntervalSelectorHtml(gid, h, selected, optionStyle, rightOffset = 50)
    {
        return `<select id='bd-${gid}' style="position:absolute;right:${rightOffset}px;width:${this.ui.wideInterval ? 100 : 80}px;margin-top:${-h+5}px;color:var(--primary-text-color);background-color:${this.pconfig.closeButtonColor};border:0px solid black;">
                    <option value="0" ${optionStyle} ${selected == 0 ? 'selected' : ''}>${i18n('ui.interval._10m')}</option>
                    <option value="1" ${optionStyle} ${selected == 1 ? 'selected' : ''}>${i18n('ui.interval.hourly')}</option>
                    <option value="2" ${optionStyle} ${selected == 2 ? 'selected' : ''}>${i18n('ui.interval.daily')}</option>
                    <option value="3" ${optionStyle} ${selected == 3 ? 'selected' : ''}>${i18n('ui.interval.monthly')}</option>
                    <option value="4" ${optionStyle} ${selected == 4 ? 'selected' : ''}>${i18n('ui.interval.rawline')}</option>
                </select>`;
    }

    parseIntervalConfig(s)
    {
        const options = { '10m' : 0, 'hourly' : 1, 'daily' : 2, 'monthly' : 3 };
        return options[s];
    }

    // Normalizes a persistence-scope YAML value (string, array, or undefined) into a Set of
    // categories. 'all' expands to every category valid for the given scope; 'none' resolves
    // to an explicitly empty Set — distinct from returning undefined for an unset value, so
    // callers can tell "explicitly disabled" apart from "not configured, use the contextual
    // default" (see _resolvePersistenceDefault).
    normalizePersistenceCategories(value, allCategories)
    {
        if( value === undefined || value === null ) return undefined;
        const _arr = Array.isArray(value) ? value : [value];
        if( _arr.includes('none') ) return new Set();
        return new Set(_arr.includes('all') ? allCategories : _arr.filter(c => allCategories.includes(c)));
    }

    // Resolves the effective category Set for a card-level persistence option, applying the
    // contextual default only when the option was never configured at all (raw === undefined
    // — an explicit 'none' already normalizes to an empty Set, which is left as-is here).
    // The default differs by context: dynamic entities (added through the UI, no YAML entry
    // to fall back to) default to 'all' — restoring the pre-1.1.32 behavior unless explicitly
    // overridden with 'none' — while static entities and range default to 'none', since they
    // always have a YAML value to fall back to.
    _resolvePersistenceDefault(raw, allCategories, defaultAll)
    {
        if( raw !== undefined ) return raw;
        return defaultAll ? new Set(allCategories) : new Set();
    }

    // Resolves the display order of a set of entity ids — static or dynamic — following the
    // exact same "last one to speak wins" priority as any other persisted property, expressed
    // as the same three independent, sequential steps used for a field's own value: YAML
    // wins unconditionally on change; if nothing is enabled, the order stays at its base
    // (YAML's own order for static entities); otherwise HA wins if multidevice is enabled and
    // its order changed since its own mirror, else local wins. `yamlIds` is null for dynamic
    // entities, which have no YAML order concept — steps 1 and the YAML half of step 2 are
    // skipped for them. Ids present in `candidateIds` but missing from the resolved order
    // (e.g. a newly-added entity) are appended at the end; ids in the resolved order but no
    // longer in `candidateIds` (e.g. an entity removed from YAML) are dropped.
    // Order is card-only (see the 'order' category, alongside 'range'/'entities') — not a
    // per-entity field: a position only means something relative to every other entity, so
    // there's no coherent way to persist one entity's position independently of the rest.
    _resolveOrder(candidateIds, yamlIds, yamlIdsMirror, haIds, haIdsMirror, lsIds, orderEnabled, orderMultidevice)
    {
        // YAML front — always wins on change, unconditionally, exactly like any other field
        if( yamlIds ) {
            const _yamlChanged = JSON.stringify(yamlIds) !== JSON.stringify(yamlIdsMirror);
            if( _yamlChanged ) return this._finishOrder(yamlIds, candidateIds);
        }

        // Nothing persists unless explicitly enabled — the order stays at its base (YAML's
        // own order for static entities), mirroring how a field with nothing enabled simply
        // keeps its initial YAML value
        if( !orderEnabled ) return this._finishOrder(yamlIds ?? lsIds, candidateIds);

        // HA front — only when multidevice is enabled, same as for individual fields
        const _haChanged = orderMultidevice && JSON.stringify(haIds) !== JSON.stringify(haIdsMirror);
        return this._finishOrder(_haChanged ? haIds : lsIds, candidateIds);
    }

    // Shared tail for _resolveOrder: drops ids no longer present in candidateIds (e.g. an
    // entity removed from YAML), then appends any candidate missing from the chosen order
    // (e.g. a newly-added entity) at the end.
    _finishOrder(order, candidateIds)
    {
        const _known = new Set(candidateIds);
        const _result = order.filter(id => _known.has(id));
        for( const id of candidateIds ) if( !_result.includes(id) ) _result.push(id);
        return _result;
    }

    // Fields of a static entity that enable_persistence/enable_multidevice_persistence can
    // individually cover via a per-entity field list.
    _entityPersistenceFields()
    {
        return ['color', 'fill', 'hidden', 'interval', 'name', 'scale', 'siConversionFactor',
                'dashMode', 'lineMode', 'width', 'showPoints', 'showMinMax', 'unit', 'process',
                'netBars', 'decimation', 'circular', 'groupId'];
    }

    // Entity-scope persistence option: a list of specific field names, or 'entities'/'all' as
    // a shorthand for all coverable fields (the whole entity), or 'none' to explicitly cover
    // none of them. Shared by enable_multidevice_persistence and enable_persistence
    // entity-level parsing.
    resolveEntityPersistenceFields(value)
    {
        if( value === undefined || value === null ) return undefined;
        const _arr = (Array.isArray(value) ? value : [value]).map(v => v === 'entities' ? 'all' : v);
        return this.normalizePersistenceCategories(_arr, this._entityPersistenceFields());
    }


    // --------------------------------------------------------------------------------------
    // Y axis scale lock / unlock — entirely Chart.js's own responsibility now
    // (_hecUpdateYAxisLockIcon), nothing left for the card here.
    // --------------------------------------------------------------------------------------

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

    newGraph(canvas, graphtype, datasets, config, isStatic = false)
    {
        const ctx = canvas.getContext('2d');

        var datastructure;

        let scaleUnit;

        // (see ticks.period below)
        const _period0 = datasets[0]?.circular;
        const _tickPeriod = ( _period0 && datasets.every(d => d.circular === _period0 && ( d.siConversionFactor ?? 1 ) === 1) ) ? _period0 : undefined;

        if( graphtype == 'line' || graphtype == 'bar' ) {

            datastructure = {
                datasets: []
            };

            for( let d of datasets ) {
                datastructure.datasets.push({
                    // A curve in a bar graph (mixed bar/line): drawn as a line, never stacked
                    type: ( graphtype == 'bar' && d.kind === 'line' ) ? 'line' : undefined,
                    hecNoStack: graphtype == 'bar' && d.kind === 'line',
                    hecCircular: d.circular,
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

            // Incompatible units sharing one graph (a YAML graph mixing e.g. days, mm and a
            // unitless value): no single unit describes the Y axis, so don't label it with
            // whichever came first — the legend and tooltip still show each entity's own unit.
            if( datasets.some(d => !areSICompatible(d.unit, datasets[0].unit)) ) scaleUnit = '';

        } else if( graphtype == 'timeline' || graphtype == 'arrowline' ) {

            datastructure = {
                labels: [ ],
                datasets: [ ]
            };

            for( let d of datasets ) {
                datastructure.labels.push(this.pconfig.labelsVisible ? d.name : '');
                datastructure.datasets.push({
                    domain: d.domain,
                    device_class: d.device_class,
                    entity_id: d.entity_id,
                    unit: d.unit,
                    name: d.name,
                    arrowColor: d.bColor,
                    arrowBackground: d.fillColor,
                    arrowPeriod: d.arrowPeriod,
                    data: [ ]
                });
            }

        }

        // Any dataset drawn as a curve / as bars (a bar graph can hold both)
        const _hasCurves = ( graphtype == 'line' ) || ( graphtype == 'bar' && datasets.some(d => d.kind === 'line') );
        const _hasBars   = graphtype == 'bar' && datasets.some(d => d.kind === 'bar');

        const tooltipSize = this.pconfig.tooltipSize;
        const _self = this; // captured for tooltips.custom below — `this` there is the Chart.js Tooltip instance

        var chart = new Chart(ctx, {

            type: graphtype,

            data: datastructure,

            options: {
                // Static (YAML) graphs have draggable legend/timeline labels too (since
                // v1.1.43): their curves can be split (double-click) and re-combined (drag)
                // within their own group of linked graphs — see _dropCompatibility.
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
                    yAxes: [{
                        afterFit: (scaleInstance) => {
                            scaleInstance.width = this.pconfig.labelAreaWidth;
                        },
                        afterDataLimits: (me) => {
                            const epsilon = 0.0001;
                            if( config?.ymin == null && this.pconfig.axisAddMarginMin && _hasCurves && !_hasBars ) me.min -= epsilon;
                            if( config?.ymax == null && this.pconfig.axisAddMarginMax && _hasCurves && !_hasBars ) me.max += epsilon;
                        },
                        ticks: {
                            fontColor: this.pconfig.graphLabelColor,
                            min: config?.ymin ?? undefined,
                            max: config?.ymax ?? undefined,
                            forceMin: config?.ymin ?? undefined,
                            forceMax: config?.ymax ?? undefined,
                            stepSize: config?.ystepSize ?? undefined,
                            // Graph of circular curves only, all of the same period: the labels
                            // show the real values, in [0, period) (Chart.js ticks.period)
                            period: _tickPeriod
                        },
                        gridLines: {
                            color: ( graphtype == 'line' || graphtype == 'bar' || datasets.length > 1 ) ? this.pconfig.graphGridColor : 'rgba(0,0,0,0)'
                        },
                        scaleLabel: {
                            display: scaleUnit !== undefined && scaleUnit !== '',
                            labelString: scaleUnit,
                            fontColor: this.pconfig.graphLabelColor
                        },
                        barThickness: this.pconfig.timelineBarHeight - 4,
                        stacked: config?.stacked
                    }],
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
                tooltips: {
                    callbacks: {
                        label: (item, data) => {
                            if( graphtype == 'line' || graphtype == 'bar' ) {
                                let label = '';
                                if( this.pconfig.tooltipShowLabel ) label = data.datasets[item.datasetIndex].name || '';
                                if( label ) label += ': ';
                                const p = 10 ** this.pconfig.roundingPrecision;
                                const _siFactor = data.datasets[item.datasetIndex].siConversionFactor ?? 1;
                                const _circQ = data.datasets[item.datasetIndex].hecCircular;
                                let _v = Math.round(item.yLabel / _siFactor * p) / p;
                                // (a circular curve shows its real value, in [0, period))
                                if( _circQ ) _v = Math.round(this._wrapCircular(_v, _circQ) * p) / p;
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
                    displayColors: _hasCurves ? this.pconfig.showTooltipColors[0] : ( graphtype == 'timeline' ) ? this.pconfig.showTooltipColors[1] : false
                },
                hover: {
                    // (mixed bar/line graph: see the hecMixed mode in deps/Chart.js)
                    mode: ( _hasCurves && _hasBars ) ? 'hecMixed' : 'nearest',
                    intersect: !_hasCurves,
                    // Mouse/pen/touch all trigger on genuine contact (down); mouse/pen also
                    // trigger on a pure hover move (no button/contact needed) since
                    // hoverEnabled is true — matching this card's desktop behaviour. See
                    // Chart.Controller.handleEvent / Tooltip.handleEvent in Chart.js: the
                    // hit-test only ever re-runs on a real contact or on a pointer move of at
                    // least 4px since the last one that found something, never as a side
                    // effect of the chart's own data refreshing under a still pointer.
                    hoverEnabled: true,
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
    // Dynamic entity adding
    // --------------------------------------------------------------------------------------

    matchWildcardPattern(s)
    {
        if( typeof s !== 'string' || s === '' ) {
            console.warn(`history-explorer-card: invalid entity pattern in configuration (expected a non-empty string, got ${JSON.stringify(s)}) — ignored`);
            return null;
        }
        s = s.replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\-]', 'g'), '\\$&');
        s = s.replace(/\\\*/g, '.*')
        return new RegExp('^'+s+'$', 'i');
    }

    // Shows the add/already-exists tooltip for a given entity_id, without any of the
    // side effects that come with actually committing to it (no type menu, no graph
    // highlight) — a preview only. Used both on keyboard highlight (see
    // entitySelectorKeyDown's onHighlight) and on pointer hover over a dropdown entry, so
    // an ambiguous or duplicate friendly name can be resolved to its real entity_id before
    // the user commits to a selection. Wildcard patterns aren't previewed here (only single
    // resolved entity_ids reach this, one per dropdown entry).
    _previewEntityTooltip(entity_id, ii)
    {
        if( this._hass.states[entity_id] === undefined ) return;
        const _ir = this.ui.inputField[ii]?.getBoundingClientRect();
        const _exists = this.store.has(entity_id);
        const _existingG = _exists ? this.graphs.find(g => g.entities.some(e => e.entity === entity_id)) : null;
        const _r = _existingG?.canvas.getBoundingClientRect();
        const _tx = _ir ? _ir.left + _ir.width / 2 : (_r ? _r.left + _r.width / 2 : window.innerWidth / 2);
        const _ty = _ir ? _ir.top : (_r ? _r.top + _r.height / 2 : 0);
        const _label = (_exists ? i18n('ui.label.already_exists') : i18n('ui.label.add')) + ': ' + entity_id;
        this._showLabelTooltip(_label, _tx, _ty, 'center', this.ui.inputField[ii] ?? _existingG?.canvas ?? document.body);
    }

    addEntitySelected(ii)
    {
        if( this.state.loading ) return;
        if( ii < 0 || ii === undefined ) return;

        // Resolve entity_id: only if something was actually selected
        const _input = this.ui.inputField[ii];
        const _dropdown = this._this.querySelector(`#es_${ii}`);
        let entity_id;
        if( _input?.dataset.entityId ) {
            entity_id = _input.dataset.entityId;
        } else if( this._entitySelected?.[ii] ) {
            const _firstVisible = _dropdown ? Array.from(_dropdown.getElementsByTagName('a')).find(a => a.style.display !== 'none') : null;
            entity_id = _firstVisible ? _firstVisible.dataset.entity : _input?.value;
        } else {
            return; // Nothing selected, do nothing
        }

        for( let i of this.ui.inputField ) if( i ) { delete i.dataset.entityId; i.style.fontWeight = ''; }
        if( this._entitySelected ) this._entitySelected = [false, false];
        this._justAdded = null;
        const _addedNames = [];

        // Multi-entity from wildcard selection (ids separated by ';')
        if( entity_id.indexOf(';') >= 0 ) {
            const ids = entity_id.split(';').map(s => s.trim()).filter(Boolean);
            const _duplicates = [];
            const _duplicateGraphs = new Set();
            const _newIds = [];
            for( let eid of ids ) {
                if( this._hass.states[eid] === undefined ) continue;
                if( this.store.has(eid) ) {
                    _duplicates.push(eid);
                    const _existingG = this.graphs.find(g => g.entities.some(e => e.entity === eid));
                    if( _existingG ) _duplicateGraphs.add(_existingG);
                    continue;
                }
                _newIds.push(eid);
            }

            // New entities take priority: defer creation, show the type menu for them —
            // always, even if none is numeric (reduced to timeline only in that case)
            if( _newIds.length ) {
                const _ir = this.ui.inputField[ii]?.getBoundingClientRect();
                const _tx = _ir ? _ir.left + _ir.width / 2 : window.innerWidth / 2;
                const _ty = _ir ? _ir.top : 0;
                this._showLabelTooltip(i18n('ui.label.add') + ': ' + _newIds.join('; '), _tx, _ty, 'center', this.ui.inputField[ii] ?? document.body);
                this.showEntityTypeMenu(ii, _newIds.length === 1 ? _newIds[0] : _newIds, null);
            }

            if( _duplicates.length ) {
                const _ir = this.ui.inputField[ii]?.getBoundingClientRect();
                const _tx = _ir ? _ir.left + _ir.width / 2 : window.innerWidth / 2;
                const _ty = _ir ? _ir.top : 0;
                this._showLabelTooltip(i18n('ui.label.already_exists') + ': ' + _duplicates.join('; '), _tx, _ty, 'center', this.ui.inputField[ii] ?? document.body);
                // Show type-change menu for a duplicate only if no new-entity menu is already
                // shown above (avoid two competing menus for one combined action) — shown
                // even for a non-numeric duplicate (reduced to timeline only, nothing to
                // actually change there, but keeps the process standard/homogeneous)
                const _dupG = Array.from(_duplicateGraphs)[0];
                const _dupEntityId = _dupG?.entities.find(e => _duplicates.includes(e.entity))?.entity;
                if( !_newIds.length && _dupEntityId ) {
                    this.showEntityTypeMenu(ii, _dupEntityId, _dupG);
                }
                this._flagGraphs(Array.from(_duplicateGraphs));
            }

            if( _addedNames.length ) {
                this._justAdded = _addedNames.join('; ');
                const _fi1 = this.ui.inputField[ii];
                _fi1.value = this._justAdded;
                _fi1.style.fontWeight = 'bold';
                setTimeout(() => { this._resetEntityInput(_fi1); }, 500);
            }
            this.updateHistoryWithClearCache();
            this.writeLocalState();
            return;
        }

        // Single entity or wildcard pattern ?
        if( entity_id.indexOf('*') >= 0 ) {

            const datalist = this._this.querySelector(`#es_${ii}`);
            if( !datalist ) return;

            // Convert wildcard to regex
            const regex = this.matchWildcardPattern(entity_id);

            // Collect matching, non-duplicate entity ids first — nothing created yet
            const _matchedIds = [];
            for( let e of Array.from(datalist.children) ) {
                const _eid = e.dataset.entity;
                if( !regex.test(_eid) ) continue;
                if( this._hass.states[_eid] == undefined ) continue;
                if( this.store.has(_eid) ) continue;
                _matchedIds.push(_eid);
            }

            if( _matchedIds.length ) {
                // Show the type menu (with "Default"), even if none matched is numeric
                // (reduced to timeline only in that case) — deferred creation of the whole
                // batch until the user chooses
                this.showEntityTypeMenu(ii, _matchedIds.length === 1 ? _matchedIds[0] : _matchedIds, null);
            }

        } else {

            if( this._hass.states[entity_id] == undefined ) return;
            if( this.store.has(entity_id) ) {
                // Entity already exists — show tooltip and highlight containing graph
                const _existingG = this.graphs.find(g => g.entities.some(e => e.entity === entity_id));
                if( _existingG ) {
                    const _r = _existingG.canvas.getBoundingClientRect();
                    const _ir = this.ui.inputField[ii]?.getBoundingClientRect();
                    const _tx = _ir ? _ir.left + _ir.width / 2 : _r.left + _r.width / 2;
                    const _ty = _ir ? _ir.top : _r.top + _r.height / 2;
                    this._showLabelTooltip(i18n('ui.label.already_exists') + ': ' + entity_id, _tx, _ty, 'center', this.ui.inputField[ii] ?? _existingG.canvas);
                    this.showEntityTypeMenu(ii, entity_id, _existingG);
                    this._flagGraphs([_existingG]);
                }
                return;
            }

            // Brand-new entity — nothing created yet. Always show the type menu, even for
            // a non-numeric entity (reduced to timeline only, its one valid representation)
            // — keeps the same two-step add/cancel process homogeneous for every entity.
            const _ir = this.ui.inputField[ii]?.getBoundingClientRect();
            const _tx = _ir ? _ir.left + _ir.width / 2 : window.innerWidth / 2;
            const _ty = _ir ? _ir.top : 0;
            this._showLabelTooltip(i18n('ui.label.add') + ': ' + entity_id, _tx, _ty, 'center', this.ui.inputField[ii] ?? document.body);
            this.showEntityTypeMenu(ii, entity_id, null);

        }

        if( _addedNames.length ) {
            // Reached only when entities were created directly (non-numeric wildcard batch) —
            // numeric cases already show the type menu inline above and return/continue there
            this._justAdded = _addedNames.join('; ');
            const _fi2 = this.ui.inputField[ii];
            _fi2.value = this._justAdded;
            _fi2.style.fontWeight = 'bold';
            setTimeout(() => { this._resetEntityInput(_fi2); }, 500);
        }
        this.updateHistoryWithClearCache();

        this.writeLocalState();
    }

    removeAllEntities()
    {
        this.menuSetVisibility(0, false);
        this.menuSetVisibility(1, false);

        if( !confirm(i18n('ui.popup.remove_all')) ) return;

        // Remove only actually non-fixed graphs, wherever they sit in the array — the old
        // "first non-fixed index, then everything after it" logic predates `isStatic` and
        // assumed statics always came first with dynamics strictly after; that assumption
        // breaks the moment graphs are reordered (drag & drop, or synced order), silently
        // deleting static graphs caught after the first dynamic one while leaving dynamic
        // graphs before it untouched. Iterate backwards so splice() doesn't shift the
        // indices of entries still to be checked.
        for( let i = this.graphs.length - 1; i >= 0; i-- ) {
            if( !this.graphs[i].isStatic ) {
                this._graphDiv(this.graphs[i]).remove();
                this.graphs.splice(i, 1);
            }
        }

        this.store.removeAllDynamic();

        this._updateMoVisibility();
        this._updateGroupLinkMarkers();
        this.writeLocalState();
    }


    // Deletes one entity entirely — removes it from its graph (rebuilding that graph with
    // whatever entities remain, or removing it outright if this was its last entity) AND
    // from pconfig.entities, so it's gone for good rather than split off into its own graph
    // (that's what _uncombineEntity does instead). Currently only reachable via the entity
    // type menu opened by a long-press on a legend/timeline label — deleting from the
    // entity selector's own type menu (a not-yet-created entity) wouldn't make sense there.
    _deleteEntity(g, idx)
    {
        const _entity = this._detachAndRebuildRemaining(g, idx);
        this.store.remove(_entity.entity);
        this._updateMoVisibility();
        this._updateGroupLinkMarkers();
        this.writeLocalState();
        this.updateHistory();
    }

    // --------------------------------------------------------------------------------------
    // Adding and removing graphs from the view
    // --------------------------------------------------------------------------------------

    getDomainForEntity(entity)
    {
        return getDomainForEntityPure(entity);
    }

    getDeviceClass(entity)
    {
        return getDeviceClassPure(this._hass, entity);
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

    // Generic menu-opening action, shared by all 3 menus (entity selector dropdown, entity
    // type menu, export menu): makes the menu visible, applies the position its caller
    // already computed (each menu's own placement logic — above/below, anchored to a
    // button or an input, or at pointer coordinates — stays with the caller, since that
    // part genuinely differs), clears any leftover navigation highlight (background only)
    // from a previous use of this same menu, and clamps the result to the viewport. Never
    // touches hecSelected — that's entirely business logic: each menu's own caller decides
    // whether to pre-select an option (and mark it hecSelected) as part of populating the
    // menu's content, before this function is even called.
    //   align — 'left' (default), 'center', or 'right': the caller passes `left` as the
    //           point to align against (the anchor's left edge, center, or right edge,
    //           whichever makes sense for it) — center/right shift the menu natively via
    //           CSS transform, same mechanism already used for _showLabelTooltip, so there's
    //           no need to measure the menu's rendered width and recompute afterward.
    _openMenu(menuEl, top, left, align = 'left') {
        menuEl.style.display = 'block';
        if( top  !== undefined ) menuEl.style.top  = top;
        if( left !== undefined ) menuEl.style.left = left;
        menuEl.style.transform = align === 'center' ? 'translateX(-50%)' : align === 'right' ? 'translateX(-100%)' : '';
        for( let _a of menuEl.getElementsByTagName('a') ) _a.style.background = '';
        Chart.hecUi.clampToViewport(menuEl, this._this?.querySelector('#maincard'));
    }

    _navigateMenuArrowKey(visible, key)
    {
        // Shared ArrowUp/ArrowDown wraparound highlight logic for the entity type menu
        // (et_N), the entity selector dropdown (es_N), and the export menu (eo_N) — moves
        // the highlighted <a> to the next/previous visible item, wrapping at either end.
        // Only ever touches the navigation highlight (background + hecSelected marker) —
        // never fontWeight, which is menu-specific business state (e.g. the entity type
        // menu's "bold = default/currently active type", or the selector's wildcard-match
        // bolding) set by the caller, not by this generic navigation logic.
        const _cur = visible.find(a => a.dataset.hecSelected);
        // The entity type menu marks its default/active option with hecSelected right when
        // the menu opens (see showEntityTypeMenu), before any key is pressed — no blue
        // highlight is shown yet at that point. So hecSelected alone doesn't mean "there's
        // already a highlight to move from" — check the highlight itself (background) too.
        // The very first arrow key press makes the highlight appear at that starting
        // position instead of moving away from it; only once it's actually showing does a
        // further press move it to the next/previous item.
        let _next;
        if( !_cur || !_cur.style.background ) {
            _next = _cur || (key === 'ArrowDown' ? visible[0] : visible[visible.length - 1]);
        } else {
            const _i = visible.indexOf(_cur);
            _next = key === 'ArrowDown' ? (visible[_i + 1] || visible[0]) : (visible[_i - 1] || visible[visible.length - 1]);
            _cur.style.background = '';
            delete _cur.dataset.hecSelected;
        }
        _next.style.background = 'var(--primary-color, #03a9f4)';
        _next.dataset.hecSelected = '1';
        return _next;
    }

    _resetEntityInput(fi)
    {
        // Clears an entity-selector input field back to its placeholder state
        // after an add/duplicate/error, cancelling any pending "just added" bold highlight
        if( !fi ) return;
        fi.value = '';
        fi.style.fontWeight = '';
        delete fi.dataset.entityId;
        this._justAdded = null;
        // Programmatically setting .value doesn't fire 'input' on its own — dispatch it so
        // the dropdown (if open) refilters/re-populates against the now-empty field, exactly
        // as it would for the user clearing the field by hand.
        fi.dispatchEvent(new Event('input', { bubbles: true }));
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
            const _g = this.graphs.find(gr => gr.entities.some(e => e.entity === en.entity));
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

    _lastGraph()
    {
        const _all = this._allGraphsInDisplayOrder();
        return _all[_all.length - 1] ?? null;
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
        const _startIdx = this.store.indexOf(_lastEntity.entity);
        if( _startIdx < 0 ) return null;
        for( let i = _startIdx + 1; i < _list.length; i++ ) {
            const _e = _list[i];
            if( typeof _e !== 'object' || _e.groupId === g.groupId ) continue;
            const _eid = entityIdOf(_e);
            const _candidateG = this.graphs.find(gr => gr !== g && gr.entities.some(en => en.entity === _eid));
            if( _candidateG ) return _candidateG;
        }
        return null;
    }

    _detachGraph(g)
    {
        // Removes a graph's wrapper div from the DOM and from this.graphs. Callers capture
        // the graph right after g in this.graphs BEFORE calling this, to use as addGraph's
        // targetGraph (insertBefore semantics) for whatever gets rebuilt in its place.
        this._graphDiv(g).remove();
        this.graphs.splice(this.graphs.indexOf(g), 1);
    }

    // Removes g.entities[idx] and detaches g. If any entities remain, rebuilds g's
    // replacement in the same spot (targetGraph = whatever graph followed g) with the same
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

    _isNumericEntity(entity_id)
    {
        // The entity type menu (line/bar/arrowline/timeline) only offers a real choice for
        // entities whose current state can be treated as a number. Non-numeric states
        // (on/off, text) can only ever be represented as a timeline — the menu is still
        // shown for these (see showEntityTypeMenu), just reduced to timeline only.
        const state = this._hass.states[entity_id]?.state;
        return state !== undefined && state !== null && !isNaN(Number(state));
    }

    // The most fitting way to show an entity added from the UI — preselected (bold) in the
    // type menu, and what "Default" gives for a wildcard match. An entity's own options
    // (entityOptions type / lineMode) always win; otherwise:
    //   - an angle (circular: unit °, state class measurement_angle) — arrowline
    //   - a quantity that only adds up (energy, gas, water, volume: state class
    //     total_increasing, or total with such a device class or unit) — bar
    //   - no unit and not a measurement (a state, a count...) — timeline
    //   - any other measurement — line, smart mode (or the card's own lineMode)
    // (YAML graph entities without a type keep addGraph's own simpler rule.)
    _detectDefaultType(entity_id)
    {
        const entityOptions = this.getEntityOptions(entity_id);
        const uom = this.getUnitOfMeasure(entity_id);
        const sc = this.getStateClass(entity_id);
        const dc = this.getDeviceClass(entity_id);
        const _cumulative = sc === 'total_increasing' ||
            ( sc === 'total' && ( ['energy', 'gas', 'water', 'volume'].includes(dc) || /^([kMG]?Wh|m³|L|gal|ft³|CCF)$/.test(uom ?? '') ) );
        const type = entityOptions?.type ? entityOptions.type :
                     this._circularPeriod({ entity: entity_id, circular: entityOptions?.circular }) ? 'arrowline' :
                     _cumulative ? 'bar' :
                     ( uom == undefined && sc !== 'measurement' && sc !== 'measurement_angle' ) ? 'timeline' : 'line';
        const lineMode = this.normalizeLineMode(entityOptions?.lineMode) || this.pconfig.defaultLineMode || 'smart';
        return { type, lineMode };
    }

    _createAndPersistEntity(eid, type, lineMode)
    {
        // Creates one brand-new entity with an explicit type and persists it —
        // shared by the non-numeric direct-create path and the type-menu new-entity path
        // addGraph registers _entry itself as the entity's pconfig.entities entry (and adopts
        // the groupId of the graph it combined into, if any) — it must not be pushed a second
        // time here: a duplicate entry, never displayed, used to carry the groupId instead,
        // leaving the displayed one with none (so a type change couldn't link its graphs).
        const _entry = { type, lineMode };
        this.addGraph(eid, false, null, null, null, undefined, false, null, null, _entry);
        const _g = this.graphs.find(g => g.entities.includes(_entry));
        if( _g && ( _g.groupId === null || _g.groupId === undefined ) ) {
            // A brand-new graph (or one left without a group by that old bug): a group of its own
            const _gid = this.store.newGroupId();
            _g.groupId = _gid;
            _g.entities.forEach(e => { e.groupId = _gid; });
        }
        return this._hass.states[eid]?.attributes?.friendly_name || eid;
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
    // net — addGraph now inserts each graph div directly at its final spot via targetGraph.
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
        _all.forEach((en, i) => {
            this.addGraph(en.entity, i === 0, en.color, en.fill, _nextG, undefined, false, null, _groupId, en);
        });
        this._syncGroupOrder(_groupId);
        this.writeLocalState();
        this.updateHistory();
    }

    removeGraph(event)
    {
        const id = event.target.id.substr(event.target.id.indexOf("-") + 1);

        for( let i = 0; i < this.graphs.length; i++ ) {
            if( this.graphs[i].id == id ) {
                this._graphDiv(this.graphs[i]).remove();
                for( let e of this.graphs[i].entities ) this.store.remove(e.entity, true);
                this.graphs.splice(i, 1);
                break;
            }
        }

        this._updateMoVisibility();
        this._updateGroupLinkMarkers();

        this.updateHistoryWithClearCache();

        this.writeLocalState();
    }

    addGraph(entity_id, noAutoGroup = false, overrideColor = null, overrideFill = null, targetGraph = null, overrideHidden = undefined, isStatic = false, overrideInterval = null, groupId = null, overrideEntityProps = null)
    {
        // Add dynamic entity

        if( this._hass.states[entity_id] == undefined ) return;

        var entityOptions = this.getEntityOptions(entity_id);

        // Merge graph-level properties before type detection so graph.type from YAML wins
        const _graphProps = (groupId !== null && this.pconfig.graphs[groupId]) ? this.pconfig.graphs[groupId] : {};
        // Only keys the graph actually sets: a plain spread would let every graph-level key
        // left unset in YAML (stored as undefined) wipe the matching entityOptions value.
        const _definedGraphProps = Object.fromEntries(Object.entries(_graphProps).filter(([, v]) => v !== undefined));
        entityOptions = { ...entityOptions, ..._definedGraphProps, groupId };

        const uom = this.getUnitOfMeasure(entity_id);
        const sc = this.getStateClass(entity_id);
        const _overrideType = overrideEntityProps?.type ?? entityOptions?.type;
        // (let: becomes the graph's type below, once combined — see _graphType)
        let type = _overrideType ? _overrideType : ( sc === 'total_increasing' ) ? 'bar' : ( uom == undefined && sc !== 'measurement' && sc !== 'measurement_angle' ) ? 'timeline' : 'line';

        // The entity's single source of truth: overrideEntityProps is already the
        // pconfig.entities entry when the caller has one (the `_pe ?? en` pattern used
        // throughout this file). If not (a genuinely new entity), create one now and use
        // it — g.entities[0] below is this SAME object, never a copy, so there is nothing
        // left to keep in sync between "session" and "persisted" entity data.
        // (an overrideEntityProps that isn't a persisted entry yet — a plain runtime object —
        // is registered as one, rather than leaving a second, disconnected copy)
        const _pcEntry = this.store.add(overrideEntityProps ?? { entity: entity_id });
        _pcEntry.entity = entity_id;
        // The entity's own display type — kept per entity, since a graph can now hold both
        // line and bar entities (see _entityKind)
        _pcEntry.type = type;
        // A YAML entity's graph stays static whichever operation rebuilds it (uncombine,
        // drag, type change...) — not only the initial rebuild, which passes isStatic.
        if( _pcEntry.isStatic ) isStatic = true;

        // The entity's own fill (e.g. `fill:` on a YAML graph entity), captured before the
        // defaults below — an explicit per-entity fill always wins over entityOptions/graph
        // defaults and over the auto-assigned default color's fill.
        const _ownFill = _pcEntry.fill;

        let entities = [_pcEntry];
        entities[0].color = entities[0].color ?? "#000000";
        entities[0].fill = entities[0].fill ?? "#00000000";

        // Resolve color/fill for all types — including timeline, whose rendering doesn't use
        // entities[i].color directly but must still round-trip correctly through drag/uncombine/type-switch
        if( type == 'line' || type == 'arrowline' || type == 'bar' || type == 'timeline' ) {

            if( overrideColor ) {
                entities[0].color = overrideColor;
                entities[0].fill = overrideFill ?? 'rgba(0,0,0,0)';
            } else if( entityOptions?.color ) {
                entities[0].color = entityOptions?.color;
                entities[0].fill = _ownFill ?? entityOptions?.fill ?? 'rgba(0,0,0,0)';
            } else if( entities[0].color === "#000000" ) {
                const c = this.getNextDefaultColor();
                entities[0].color = c.color;
                entities[0].fill = _ownFill ?? entityOptions?.fill ?? c.fill;
            }

            entities[0].dashMode   = entities[0].dashMode    ?? entityOptions?.dashMode ?? this.pconfig.defaultDashMode;
            entities[0].width     = entities[0].width       ?? entityOptions?.width ?? entityOptions?.lineWidth ?? this.pconfig.defaultLineWidth;
            entities[0].lineMode  = this.normalizeLineMode(entities[0].lineMode ?? entityOptions?.lineMode) ?? this.pconfig.defaultLineMode;
            entities[0].scale     = entities[0].scale       ?? entityOptions?.scale;
            entities[0].hidden    = overrideHidden !== undefined ? overrideHidden : (entities[0].hidden ?? entityOptions?.hidden);
            entities[0].netBars   = entities[0].netBars    ?? entityOptions?.netBars ?? this.pconfig.defaultNetBars;
            entities[0].showPoints= entities[0].showPoints  ?? entityOptions?.showPoints ?? this.pconfig.defaultShowPoints;
            entities[0].decimation= entities[0].decimation  ?? entityOptions?.decimation;
            entities[0].showMinMax= entities[0].showMinMax  ?? entityOptions?.showMinMax ?? this.pconfig.defaultShowMinMax;
            entities[0].name      = entities[0].name        ?? entityOptions?.name;
            entities[0].siConversionFactor = entities[0].siConversionFactor ?? entityOptions?.siConversionFactor;
            entities[0].unit      = entities[0].unit        ?? entityOptions?.unit;
            entities[0].process   = entities[0].process     ?? entityOptions?.process;
            entities[0].circular  = entities[0].circular    ?? entityOptions?.circular;

            if( type == 'bar' ) {
                entities[0].fill = entities[0].color;
                entities[0].lineMode = this.normalizeLineMode(entities[0].lineMode ?? entityOptions?.lineMode) ?? 'lines';
            }

        }

        // Find a graph to combine with:
        // - With an explicit groupId (static YAML graph, or any graph being rebuilt): the
        //   graph of that same group showing the same sub-graph (graphKey — see
        //   _uncombineEntity) with the same type. Units are deliberately NOT checked here:
        //   the entities of one group are shown together by definition (a YAML graph is the
        //   author's explicit choice; a dynamic group was only ever formed from compatible
        //   units), so mixed units share one graph and one Y axis. Only the type keeps them
        //   apart (line/bar/timeline/arrowline can't share one chart) — those become linked
        //   graphs of the same group instead, re-combinable later.
        // - Dynamic with no groupId (brand-new entity from the UI): only the last graph is
        //   considered, and its groupId is adopted if type and units are compatible
        const _graphKey = _pcEntry.graphKey;
        let _combineIdx = -1;
        if( !noAutoGroup ) {
            _combineIdx = (groupId !== null) ?
                this.graphs.reduce((_last, g, i) => g.groupId === groupId && this._typesCompatible(g.type, type) && g.entities[0]?.graphKey === _graphKey && this._sameSavedGraph(g.entities[0], _pcEntry) ? i : _last, -1) :
                this.graphs.length - 1;
        }

        let combine = false;
        let _cand = null;
        let _adoptedGraphIndex = null;
        if( _combineIdx >= 0 ) {
            _cand = this.graphs[_combineIdx];
            combine = ( groupId !== null ) ? true :
                      _cand.type === type &&
                      ( type == 'timeline' || this.pconfig.combineSameUnits && areSICompatible(this.getUnitOfMeasure(entity_id, _pcEntry.unit), this.getUnitOfMeasure(_cand.entities[0].entity, _cand.entities[0].unit)) );
        }

        // Captured so the merged graph can be reinserted at the removed graph's DOM position
        // instead of always landing at the end of #graphlist
        let _combineGl = null;
        let _combineInsertBefore = null;

        if( combine ) {

            // If no groupId provided, adopt the target graph's groupId
            if( groupId === null ) groupId = _cand.groupId;

            // Joining an existing graph always adopts its groupId AND its graphIndex —
            // same rule, same reasoning: this is still the same displayed graph, and
            // inserting into a solid block of several linked graphs (the only case where
            // a groupId's members could have different graphIndex values) is forbidden
            // elsewhere, so every entity of _cand already shares one value.
            _adoptedGraphIndex = _cand.entities[0].graphIndex;

            // Color conflict check now happens here, against the REAL combine target —
            // works regardless of whether the caller knew about this target in advance
            // (e.g. a brand-new entity created via the type menu, groupId starting null)
            if( entities[0].color !== undefined ) {
                const _usedColors = _cand.entities.map(e => e.color);
                if( _usedColors.includes(entities[0].color) ) {
                    const _free = defaultColors.find(c => !_usedColors.includes(c.color));
                    if( _free ) {
                        entities[0].color = _free.color;
                        entities[0].fill  = _ownFill ?? _free.fill;
                    }
                }
            }

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
            this.graphs.splice(_combineIdx, 1);

        }

        // entityOptions.groupId was frozen before the combine block resolved the final
        // groupId (e.g. adopting the target graph's groupId when it was null) — resync it
        // here so the graph object built below gets the correct, final groupId. _pcEntry
        // is now g.entities[0] itself (no separate copy), so it must be kept in step too.
        entityOptions.groupId = groupId;
        _pcEntry.groupId = groupId;

        // Y axis bounds: the graph's own options first, else the first entity of the graph
        // that sets them (on its YAML entry), else entityOptions — taken from every entity
        // of the graph, not only the one being added (which used to decide alone).
        for( const _k of ['ymin', 'ymax', 'ystepSize'] ) {
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
        const _graphInterval = overrideInterval ?? entities.map(e => e.interval).find(v => v !== undefined && v !== null)
            ?? this.parseIntervalConfig(entityOptions?.interval ?? this.pconfig.defaultInterval) ?? 1;
        entityOptions._graphInterval = _graphInterval;

        // graphIndex: a real number giving each graph's display order (1 = topmost page-
        // wide), tracked per entity (all entities of one displayed graph share the same
        // value) since there's no separate per-graph persisted structure. Combine already
        // adopted the target graph's value above (_adoptedGraphIndex). A genuinely new
        // graph is placed right before targetGraph (see insertion below) — its index is
        // the average of targetGraph's index and its true on-screen previous neighbor's
        // (0 if none, i.e. inserting at the very top). targetGraph=null means nothing
        // follows: index is the last on-screen graph's, rounded up, + 1 (or 1 if there are
        // no graphs yet).
        let _graphIndex;
        if( combine ) {
            _graphIndex = _adoptedGraphIndex ?? 1;
        } else if( targetGraph?.entities?.[0]?.graphIndex !== undefined ) {
            const _prevG = this._previousGraph(targetGraph);
            const _beforeIdx = _prevG?.entities?.[0]?.graphIndex ?? 0;
            _graphIndex = (_beforeIdx + targetGraph.entities[0].graphIndex) / 2;
        } else {
            const _all = this._allGraphsInDisplayOrder();
            const _lastIdx = _all[_all.length - 1]?.entities?.[0]?.graphIndex;
            _graphIndex = _lastIdx !== undefined ? Math.ceil(_lastIdx) + 1 : 1;
        }
        for( let e of entities ) e.graphIndex = _graphIndex;

        const _graphHeight = _graphProps.height ?? entityOptions?.height;
        // (a mixed bar/line graph is sized like a line graph, plus the interval selector)
        const h = _mixed ? this.calcGraphHeight('line', entities.length, _graphHeight) + 24 : this.calcGraphHeight(type, entities.length, _graphHeight);

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
        const _isFirstOnPage = !_currentFirst || _graphIndex <= (_currentFirst.entities?.[0]?.graphIndex ?? Infinity);
        const _prevG = _isFirstOnPage ? null : this._allGraphsInDisplayOrder().filter(g => (g.entities?.[0]?.graphIndex ?? Infinity) < _graphIndex).pop();
        const _prevShowTimeLabels = _prevG ? (this.pconfig.graphs[_prevG.groupId ?? null]?.showTimeLabels ?? true) : true;
        const _graphMarginTop = (!_isFirstOnPage && _prevShowTimeLabels !== false) ? 8 : 0;
        // Optional title
        if( _graphProps.title !== undefined ) html += `<div style='text-align:center;'>${_graphProps.title}</div>`;
        html += `<div style='height:${h}px;margin-top:${_graphMarginTop}px;position:relative'>`;
        html += `<canvas id="graph${this.g_id}" height="${h}px"></canvas>`;
        if( !isStatic )
            html += `<button id='bc-${this.g_id}' style="position:absolute;right:10px;margin-top:${-h+5}px;color:var(--primary-text-color);background-color:${this.pconfig.closeButtonColor};border:0px solid black;">×</button>`;
        if( type == 'bar' && !this.ui.hideInterval )
            html += this.createIntervalSelectorHtml(this.g_id, h, _graphInterval, this.ui.optionStyle, 40);
        html += `</div>`;

        let e = document.createElement('div');
        e.innerHTML = html;

        let gl = this._this.querySelector('#graphlist');
        const _tgtDiv = ( targetGraph && targetGraph.canvas?.parentNode ) ? this._graphDiv(targetGraph) : null;
        if( _combineInsertBefore && (_combineGl ?? gl).contains(_combineInsertBefore) ) {
            (_combineGl ?? gl).insertBefore(e, _combineInsertBefore);
        } else if( _tgtDiv && _tgtDiv.parentNode ) {
            // Insert right before targetGraph — "the graph this one belongs right before".
            // targetGraph=null (or no longer valid) falls through to the last-position
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
        if( _dynG && overrideInterval !== null && overrideInterval !== undefined ) {
            _dynG.interval = overrideInterval;
            const _bd = this._this.querySelector(`#bd-${_dynGid}`);
            if( _bd ) _bd.value = overrideInterval;
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
                "name": ( d.name === undefined ) ? this._hass.states[d.entity]?.attributes?.friendly_name : d.name,
                "bColor": parseColor(d.color),
                // (a bar entity shown as a raw curve — interval 4 — isn't filled like a bar)
                "fillColor": ( d.type === 'bar' && _kind === 'line' ) ? 'rgba(0,0,0,0)' : parseColor(d.fill),
                "dashMode": d.dashMode,
                "mode": this.normalizeLineMode(d.lineMode) || this.pconfig.defaultLineMode,
                "width": d.width || this.pconfig.defaultLineWidth,
                "showPoints": d.showPoints,
                "showMinMax": d.showMinMax,
                // (period of a circular entity in the units shown, before SI conversion)
                "circular": ( _kind === 'line' || _kind === 'bar' ) ? ( this._circularPeriod(d) ?? 0 ) * Math.abs(d.scale ?? 1) || null : null,
                // (an arrowline's values are angles: a full turn is the entity's circular
                // period, 360 when it has none)
                "arrowPeriod": ( _kind === 'arrowline' ) ? ( this._circularPeriod(d) ?? 360 ) : undefined,
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

        const chart = this.newGraph(canvas, type, datasets, config, isStatic);

        const h = config?._mixed ? this.calcGraphHeight('line', entities.length, config?.height) + 24 : this.calcGraphHeight(type, entities.length, config?.height);

        const g = { "id": gid, "type": type, "canvas": canvas, "graphHeight": h, "chart": chart , "entities": entities, "interval": interval, "ylock": config?.ylock ?? false, "isStatic": isStatic, "groupId": config?.groupId ?? null };

        this.graphs.push(g);
    }


    // --------------------------------------------------------------------------------------
    // HTML generation
    // --------------------------------------------------------------------------------------

    // TOOLBAR LAYOUT — CSS Grid, layouts A/B/C
    // !! Keep in sync with _hec_render() in history-info-panel.js !!
    addUIHtml(tools, selector, bgcol, optionStyle, inputStyle, invertZoom, i)
    {
        let html = '';

        if( (tools || selector) && (this.ui.stickyTools & (1<<i)) ) {
            const threshold = i ? 'bottom:0px' : 'top:var(--header-height)';
            html = `<div style="position:sticky;${threshold};padding-top:${this.ui.hideHeader ? 0 : 15}px;padding-bottom:10px;margin-top:-${this.ui.hideHeader ? 0 : 15}px;z-index:1;background-color:var(--card-background-color);line-height:0px;">`;
        } else if( tools || selector ) {
            // Always wrap in a div, sticky or not — _footerAnchor()'s walk-up-to-gl's-
            // direct-child loop already targets this wrapper automatically (same mechanism
            // as the sticky case). The spacing margin lives on the wrapper itself (not a
            // <br> sibling), so it's structurally inseparable from the toolbar — a graph
            // being inserted before this whole block can never end up between them.
            // Bottom toolbar: margin-top (space above it); top toolbar: margin-bottom
            // (space below it). 0 when sticky — the wrapper's own padding already covers it.
            html = `<div style="margin-${i ? 'top' : 'bottom'}:8px;">`;
        }

        if( tools || selector ) html += `<div id="tb_${i}" style="position:relative;margin-left:0px;width:100%;min-height:30px;display:grid;grid-template-columns:1fr auto 1fr;grid-template-areas:'dl sl dr';align-items:center;line-height:normal;">`;

        const eh = `<a id="eh_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>`;

        if( tools ) html += `
            <div id="dl_${i}" style="background-color:${bgcol};padding-left:5px;padding-right:5px;grid-area:dl;justify-self:start;">
                <button id="b1_${i}" style="margin:0px;border:0px solid black;color:inherit;background-color:#00000000;height:30px"><</button>
                <button id="bx_${i}" style="margin:0px;border:0px solid black;color:inherit;background-color:#00000000;height:30px">-</button>
                <button id="b2_${i}" style="margin:0px;border:0px solid black;color:inherit;background-color:#00000000;height:30px">></button>
            </div>`;

        if( selector ) html += `
            <div id='sl_${i}' style="display:none;padding-left:10px;padding-right:10px;text-align:center;grid-area:sl;justify-self:center;min-width:0;overflow:hidden;">
                <input id="b7_${i}" ${inputStyle} autoComplete="off"/>
                <div id="es_${i}" style="display:none;position:absolute;text-align:left;min-width:260px;max-height:50vh;overflow:auto;border:1px solid #444;z-index:1;color:var(--primary-text-color);background-color:var(--card-background-color)"></div>
                <div id="et_${i}" tabindex="0" style="display:none;position:absolute;text-align:left;min-width:130px;border:1px solid #444;box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2);z-index:2;color:var(--primary-text-color);background-color:var(--card-background-color);outline:none">
                    <div id="et_${i}_title" style="margin:1px;padding:4px 9px;font-weight:600;background-color:var(--secondary-background-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
                    <a id="et_${i}_default" href="#et" style="display:none;padding:5px 10px;text-decoration:none;color:inherit">${i18n('ui.menu.type_default')}</a>
                    ${_TYPE_MENU_ORDER.map(k => `<a id="et_${i}_${k}" href="#et" style="${_TYPE_MENU_ITEM_STYLE}">${i18n(_TYPE_MENU_DEFS[k].label)}</a>`).join('')}
                    <a id="et_${i}_delete" href="#et" style="display:none;padding:5px 10px;text-decoration:none;color:inherit;border-top:1px solid #444;">${i18n('ui.menu.entity_delete')}</a>
                </div>
                <button id="bo_${i}" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px;margin-left:1px;margin-right:0px;"><svg width="18" height="18" viewBox="0 0 24 24" style="vertical-align:middle;"><path fill="var(--primary-text-color)" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" /></svg></button>
                <div id="eo_${i}" style="display:none;position:absolute;text-align:left;min-width:150px;overflow:auto;border:1px solid #ddd;box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2);z-index:1;color:var(--primary-text-color);background-color:var(--card-background-color);outline:none">
                    <a id="ef_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>
                    ${this.statistics.enabled ? eh : ''}
                    <a id="eg_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>
                    <a id="ei_${i}" href="#" style="display:block;padding:5px 5px;text-decoration:none;color:inherit"></a>
                </div>
            </div>`;

        if( tools ) html += `
            <div id="dr_${i}" style="background-color:${bgcol};padding-left:5px;padding-right:5px;grid-area:dr;justify-self:end;">
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

        if( tools || selector ) html += `</div>`;

        html += `<div id='rf_${i}' style="margin-left:0px;margin-top:10px;margin-bottom:0px;width:100%;text-align:center;display:none;line-height:normal;"></div>`;

        if( tools || selector ) html += `</div>`;

        return html;
    }

    // Wires toolbar i's controls (the card has two toolbars, top and bottom; the info panel
    // one, with fewer controls — those it lacks are skipped)
    _wireToolbar(i)
    {
        this._this.querySelector(`#b1_${i}`)?.addEventListener('click', this.subDay.bind(this), false);
        this._this.querySelector(`#b2_${i}`)?.addEventListener('click', this.addDay.bind(this), false);
        this._this.querySelector(`#b4_${i}`)?.addEventListener('click', this.decZoom.bind(this), false);
        this._this.querySelector(`#b5_${i}`)?.addEventListener('click', this.incZoom.bind(this), false);
        this._this.querySelector(`#bx_${i}`)?.addEventListener('click', this.todayNoReset.bind(this), false);
        this._this.querySelector(`#bx_${i}`)?.addEventListener('dblclick', this.todayReset.bind(this), false);
        this._this.querySelector(`#by_${i}`)?.addEventListener('change', this.timeRangeSelected.bind(this));
        this._this.querySelector(`#bz_${i}`)?.addEventListener('click', this.toggleZoom.bind(this), false);
        this._this.querySelector(`#ef_${i}`)?.addEventListener('click', this.exportFile.bind(this), false);
        this._this.querySelector(`#eh_${i}`)?.addEventListener('click', this.exportStatistics.bind(this), false);
        this._this.querySelector(`#eg_${i}`)?.addEventListener('click', this.removeAllEntities.bind(this), false);
        this._this.querySelector(`#ei_${i}`)?.addEventListener('click', this.toggleInfoPanel.bind(this), false);
        this._this.querySelector(`#bo_${i}`)?.addEventListener('click', this.menuClicked.bind(this), false);
        // Close on focusout — same as es_N/et_N. eo_N needs a tabIndex to be
        // focusable at all (unlike et_N, it isn't focusable by default in the HTML
        // template), and menuSetVisibility() must call .focus() when opening it, or
        // this listener would never fire in the first place.
        const _eoMenu = this._this.querySelector(`#eo_${i}`);
        if( _eoMenu ) {
            _eoMenu.tabIndex = 0;
            _eoMenu.addEventListener('focusout', () => {
                setTimeout(() => {
                    if( !_eoMenu.contains(document.activeElement) ) this.menuSetVisibility(i, false);
                }, 150);
            });
            // Keyboard navigation — same as es_N/et_N. menuSetVisibility(i,false) as
            // onClose (rather than duplicating display:none here) also resets the
            // toggle button's caret icon back to its closed-state arrow.
            _eoMenu.addEventListener('keydown', (e) => {
                this._menuKeyDown(e, _eoMenu, { onClose: () => this.menuSetVisibility(i, false) });
            });
        }

        this._this.querySelector(`#b7_${i}`)?.addEventListener('focusin', this.entitySelectorFocus.bind(this), true);
        this._this.querySelector(`#b7_${i}`)?.addEventListener('click', this.entitySelectorFocus.bind(this), true);
        this._this.querySelector(`#b7_${i}`)?.addEventListener('focusout', this.entitySelectorFocusOut.bind(this), true);
        this._this.querySelector(`#b7_${i}`)?.addEventListener('input', this.entitySelectorEntered.bind(this), true);
        this._this.querySelector(`#b7_${i}`)?.addEventListener('keydown', this.entitySelectorKeyDown.bind(this), true);
        // Pointer hover preview — mouse/pen only (touch has no hover event; it
        // stays on pointerdown/pointerup, see the dropdown entry's own handling).
        // Delegated on the dropdown container so it survives entries being
        // recreated on every re-filter, instead of re-attaching per entry.
        this._this.querySelector(`#es_${i}`)?.addEventListener('pointerover', (e) => {
            if( e.pointerType === 'touch' ) return;
            const _a = e.target.closest('a[data-entity]');
            if( _a ) this._previewEntityTooltip(_a.dataset.entity, i);
        });
        // Touch has no hover event at all — preview on pointerdown/pointermove
        // instead, while the finger can still be dragged to a different entry
        // before lifting. Actual selection still only happens on the entry's own
        // click handler (pointerup), unchanged.
        const _touchPreview = (e) => {
            if( e.pointerType !== 'touch' ) return;
            const _a = e.target.closest('a[data-entity]');
            if( _a ) this._previewEntityTooltip(_a.dataset.entity, i);
        };
        this._this.querySelector(`#es_${i}`)?.addEventListener('pointerdown', _touchPreview);
        this._this.querySelector(`#es_${i}`)?.addEventListener('pointermove', _touchPreview);

        this.ui.dateSelector[i] = this._this.querySelector(`#bx_${i}`);
        this.ui.rangeSelector[i] = this._this.querySelector(`#by_${i}`);
        this.ui.zoomButton[i] = this._this.querySelector(`#bz_${i}`);
    }

    insertUIHtmlText(i)
    {
        let ef = this._this.querySelector(`#ef_${i}`); if( ef ) ef.innerHTML = i18n('ui.menu.export_csv');
        // Entity type menu labels — updated here so language is already set
        const _etDefault = this._this.querySelector(`#et_${i}_default`); if( _etDefault ) _etDefault.innerHTML = i18n('ui.menu.type_default');
        const _et0 = this._this.querySelector(`#et_${i}_0`); if( _et0 ) _et0.innerHTML = i18n('ui.menu.type_line_straight');
        const _et1 = this._this.querySelector(`#et_${i}_1`); if( _et1 ) _et1.innerHTML = i18n('ui.menu.type_line_curves');
        const _et2 = this._this.querySelector(`#et_${i}_2`); if( _et2 ) _et2.innerHTML = i18n('ui.menu.type_line_stepped');
        const _et6 = this._this.querySelector(`#et_${i}_6`); if( _et6 ) _et6.innerHTML = i18n('ui.menu.type_line_smart');
        const _et3 = this._this.querySelector(`#et_${i}_3`); if( _et3 ) _et3.innerHTML = i18n('ui.menu.type_bar');
        const _et4 = this._this.querySelector(`#et_${i}_4`); if( _et4 ) _et4.innerHTML = i18n('ui.menu.type_arrowline');
        const _et5 = this._this.querySelector(`#et_${i}_5`); if( _et5 ) _et5.innerHTML = i18n('ui.menu.type_timeline');
        const _etDelete = this._this.querySelector(`#et_${i}_delete`); if( _etDelete ) _etDelete.innerHTML = i18n('ui.menu.entity_delete');
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
            const _tbEl = this._this.querySelector('#tb_0');
            if( tickChanged ) this.setStepSize(true, _tbEl?.clientWidth || w);
        }

        this.resizeSelector();
    }

    resizeSelector()
    {
        const w = this._this.querySelector('#maincard').clientWidth;

        for( let i = 0; i < 2; ++i ) {
            const tb = this._this.querySelector(`#tb_${i}`);
            const dl = this._this.querySelector(`#dl_${i}`);
            const dr = this._this.querySelector(`#dr_${i}`);
            const input = this._this.querySelector(`#b7_${i}`);
            const sl = this._this.querySelector(`#sl_${i}`);

            // Common: measure tbw and apply date format before any layout decision
            const tbwNow = tb ? tb.clientWidth : w;
            const _mw = (el) => {
                if( !el ) return 0;
                const pWS = el.style.whiteSpace, pW = el.style.width;
                el.style.whiteSpace = 'nowrap'; el.style.width = 'max-content';
                const nw = el.offsetWidth;
                el.style.whiteSpace = pWS; el.style.width = pW;
                return nw;
            };

            // Measure dl (LONG) and dr (NORMAL: maxWidth=83px)
            const bxEl = this._this.querySelector(`#bx_${i}`);
            const byEl = this._this.querySelector(`#by_${i}`);
            if( bxEl && this.i18n._styleDateLong )
                bxEl.innerHTML = `<a id="eh_${i}" href="#" style="display:block;text-decoration:none;color:inherit">${moment(this.startTime).format(this.i18n._styleDateLong)}</a>`;
            if( byEl ) byEl.style.maxWidth = '83px';
            const dlwLong = _mw(dl);
            const drwLong = _mw(dr);

            // Measure dl (SHORT) and dr (COMPACT: maxWidth=50px)
            if( bxEl && this.i18n._styleDateShort )
                bxEl.innerHTML = `<a id="eh_${i}" href="#" style="display:block;text-decoration:none;color:inherit">${moment(this.startTime).format(this.i18n._styleDateShort)}</a>`;
            if( byEl ) byEl.style.maxWidth = '50px';
            const dlwShort = _mw(dl);
            const drwShort = _mw(dr);

            // Decide format with hysteresis
            if( !this._isCompact ) this._isCompact = [];
            const _prevCompact = this._isCompact[i] || false;
            let isCompact;
            if( dlwLong + drwLong > tbwNow - 10 ) {
                isCompact = true;   // NORMAL doesn't fit → go COMPACT
            } else if( dlwLong + drwLong < tbwNow - 20 ) {
                isCompact = false;  // clearly fits → go NORMAL
            } else {
                isCompact = _prevCompact; // hysteresis zone → keep previous state
            }
            this._isCompact[i] = isCompact;

            const dlwNow = isCompact ? dlwShort : dlwLong;
            const drwNow = isCompact ? drwShort : drwLong;

            // Apply chosen format and range width
            const fmt = isCompact ? this.i18n._styleDateShort : this.i18n._styleDateLong;
            if( bxEl && fmt ) {
                this.i18n.styleDateSelector = fmt;
                bxEl.innerHTML = `<a id="eh_${i}" href="#" style="display:block;text-decoration:none;color:inherit">${moment(this.startTime).format(fmt)}</a>`;
            }
            if( byEl ) byEl.style.maxWidth = isCompact ? '50px' : '83px';


            const totNow = dlwNow + drwNow || 1;
            const dlFrNow = Math.round(dlwNow / totNow * 100);
            const drFrNow = 100 - dlFrNow;

            // Layout C : no selector, just dl and dr
            if( !input || !sl ) {
                if( tb && (dl || dr) ) {
                    tb.style.gridTemplateColumns = `${dlFrNow}fr ${drFrNow}fr`;
                    tb.style.gridTemplateAreas = "'dl dr'";
                }
                continue;
            }

            // Ensure sl is visible and in layout B first so it has dimensions
            if( sl.style.display === 'none' ) {
                if( tb ) {
                    tb.style.gridTemplateColumns = `${dlFrNow}fr ${drFrNow}fr`;
                    tb.style.gridTemplateAreas = "'dl dr' 'sl sl'";
                }
                sl.style.display = 'flex';
                sl.style.alignItems = 'center';
                sl.style.justifyContent = 'center';
                input.style.width = Math.max(150, Math.min(500, (tb ? tb.clientWidth : w) - 80)) + 'px';
                sl.style.display = 'flex';
                sl.style.alignItems = 'center';
                sl.style.justifyContent = 'center';
            }

            // dl and dr already measured above as dlwNow/drwNow
            const dlw = dlwNow;
            const drw = drwNow;

            // sl buttons
            const bo = this._this.querySelector(`#bo_${i}`);
            const bow=_mw(bo);
            const slCSS = getComputedStyle(sl);
            const slPad = parseFloat(slCSS.paddingLeft||0)+parseFloat(slCSS.paddingRight||0);
            const slBtnsW = bow + slPad;

            // Compute input width for layout A and check if total fits
            const tbw = tbwNow;
            // Get actual margins of dl and dr
            const dlMargin = dl ? (parseFloat(getComputedStyle(dl).marginLeft||0)+parseFloat(getComputedStyle(dl).marginRight||0)) : 0;
            const drMargin = dr ? (parseFloat(getComputedStyle(dr).marginLeft||0)+parseFloat(getComputedStyle(dr).marginRight||0)) : 0;
            // unexplained = gaps between flex children in sl (gap:normal resolves to ~5px in HA)
            // Measure it: sl natural width - sum of children - padding
            const CORRECTION = 23; // inputExtra(~8) + flex gap(~5) + safety margin(10)

            const inputWA = Math.max(150, Math.min(500, tbw - 2*(Math.max(dlw, drw) + Math.max(dlMargin, drMargin)) - slBtnsW - CORRECTION));
            if( !this._inputWidth ) this._inputWidth = [];
            this._inputWidth[i] = inputWA;
            const totalA = dlw + 10 + 400 + slBtnsW + drw + 10; // switch at 400px input width

            const colW = Math.round((w - inputWA - slBtnsW) / 2);

            if( totalA + 50 <= w ) {
                // Layout A : dl | sl | dr on one line
                if( tb ) {
                    tb.style.gridTemplateColumns = '1fr auto 1fr';
                    tb.style.gridTemplateAreas = "'dl sl dr'";
                }
                sl.style.display = 'flex';
                sl.style.alignItems = 'center';
                sl.style.justifyContent = 'center';
                input.style.width = inputWA + 'px';
            } else {
                // Layout B : dl | dr on line 1, sl centered on line 2
                if( tb ) {
                    tb.style.gridTemplateColumns = `${dlFrNow}fr ${drFrNow}fr`;
                    tb.style.gridTemplateAreas = "'dl dr' 'sl sl'";
                }
                input.style.width = Math.max(150, Math.min(500, (tb ? tb.clientWidth : w) - 80)) + 'px';
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

            this.resizeSelector();

            for( let i = 0; i < 2; i++ ) this._wireToolbar(i);


            const _needsIntervalRedraw = await this.readLocalState();

            this.pconfig.nextDefaultColor = 0;

            // Rebuild all graphs (static and dynamic) from pconfig.entities
            if( this.store.list ) {
                // Group by groupId, preserving first-occurrence order
                const _groupMap = new Map();
                const _groupOrder = [];
                for( let e of this.store.list ) {
                    const _groupId = typeof e === 'object' ? e.groupId : undefined;
                    const _key = _groupId ?? Symbol();
                    if( !_groupMap.has(_key) ) {
                        _groupMap.set(_key, { groupId: _groupId, entities: [] });
                        _groupOrder.push(_key);
                    }
                    _groupMap.get(_key).entities.push(e);
                }
                // Sort each group's entities by their initial graphIndex — captured here,
                // before any recomputation — so a solid block of several linked graphs
                // (same groupId, different graphIndex) gets rebuilt in the order it was
                // actually displayed in, not pconfig.entities' array order (which must stay
                // untouched below for re-combine to keep working when a type becomes
                // compatible again). Stable sort: entities that already share one
                // graphIndex (one graph) keep their relative order.
                for( let _group of _groupMap.values() )
                    _group.entities.sort((a, b) => (a.graphIndex ?? 0) - (b.graphIndex ?? 0));
                // Physically regroup the persisted list the same way — never interleaved
                // again, so its order stays the single source of truth for display order
                // everywhere else (neighbor lookups, graphIndex averaging).
                this.store.regroup();

                // Rebuild: call addGraph one entity at a time
                // For statics: force combineSameUnits (YAML author responsible for grouping)
                // For dynamics: combine logic in addGraph handles groupId + compatibility
                // The graphIndex each entity had when last saved, captured before addGraph
                // recomputes it: within a group, only entities that were shown in the same
                // graph are combined again (see addGraph). Statics never persist graphIndex,
                // so for them this is always undefined === undefined — graphKey decides.
                this._rebuildGraphIndex = new Map(this.store.list.map(e => [e, e.graphIndex]));
                for( let _key of _groupOrder ) {
                    const _group = _groupMap.get(_key);
                    const _isStaticGroup = _group.entities.some(e => e.isStatic);
                    const _saved = this.pconfig.combineSameUnits;
                    if( _isStaticGroup ) this.pconfig.combineSameUnits = true;
                    // _group.entities is sorted by graphIndex above — walk it in that order
                    // and always pass targetGraph=null: addGraph's own combine logic
                    // (matched by groupId) merges compatible entities regardless, and any
                    // entity that can't combine simply becomes a new graph appended after
                    // whatever's been built so far — correct precisely because we're
                    // walking the group in its true display order already.
                    _group.entities.forEach((_e) => {
                        const _eid = entityIdOf(_e);
                        this.addGraph(_eid, false, _e.color, _e.fill, null, _e.hidden, _e.isStatic, _e.interval, _group.groupId, _e);
                    });
                    if( _isStaticGroup ) this.pconfig.combineSameUnits = _saved;
                }
                this._rebuildGraphIndex = null;
                // The rebuild just recomputed graphIndex (and default colors, etc.) fresh
                // from scratch — persist that result now rather than leaving storage stale
                // until some unrelated later action happens to call writeLocalState.
                this.writeLocalState();
            } else
                this.store.list = [];

            this.today(false);

            // Now that startTime/endTime are initialized, apply interval restoration if needed
            if( _needsIntervalRedraw ) this.updateHistoryWithClearCache();

            // Register observer to resize the graphs whenever the maincard dimensions change
            let ro = new ResizeObserver(entries => { this.resize(); });
            ro.observe(this._this.querySelector('#maincard'));

            // Per-graph interval now restored in readLocalState (last-one-to-speak-wins)

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
        this.i18n._styleDateLong = ds;
        this.i18n._styleDateShort = dt;
        this.i18n.styleDateSelector = ds; // will be updated by resizeSelector

        if( this._hass.locale?.time_format === '24' ) locale = 'en-GB';
        if( this._hass.locale?.time_format === '12' ) locale = 'en-US';

        this.i18n.styleTimeTicks = getLocalizedDateString(locale, { timeStyle: 'short' });
        this.i18n.styleDateTimeTooltip = this.i18n.styleDateTicks + ', ' + getLocalizedDateString(locale, { timeStyle: 'medium' });

        this.i18n.valid = true;
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

    _makeStaticEntityEntry(entity, groupId, ent, interval)
    {
        return {
            entity            : entity,
            groupId           : groupId,
            color             : ent.color,
            fill              : ent.fill,
            hidden            : ent.hidden,
            interval          : this.parseIntervalConfig(ent.interval) ?? interval,
            isStatic          : true,
            name              : ent.name,
            scale             : ent.scale,
            siConversionFactor: ent.siConversionFactor,
            dashMode          : ent.dashMode,
            lineMode          : ent.lineMode,
            width             : ent.width ?? ent.lineWidth,
            type              : ent.type,
            // Y axis bounds set on an entity: the axis is the graph's, so they apply to the
            // graph the entity is shown in (see addGraph)
            ymin              : ent.ymin,
            ymax              : ent.ymax,
            ystepSize         : ent.ystepSize ?? ent.ystepsize,
            showPoints        : ent.showPoints,
            showMinMax        : ent.showMinMax,
            unit              : ent.unit,
            process           : ent.process,
            netBars           : ent.netBars,
            decimation        : ent.decimation,
            circular          : ent.circular,
            enableMultidevicePersistence: this.resolveEntityPersistenceFields(ent.enable_multidevice_persistence),
            enablePersistence: this.resolveEntityPersistenceFields(ent.enable_persistence),
        };
    }

    // Builds the static graph/entity list from the YAML `graphs:` option. Defensive at every
    // level so a single malformed graph or entity is logged and skipped rather than throwing
    // and losing every graph on the card (see history-explorer-card.md changelog for the bug
    // this was written to prevent: a bad `exclude:` entry used to blank the whole card).
    buildGraphListFromConfig(graphs)
    {
        const testEntityExclusionList = function(entity, excludes) { for( let i of excludes ) if( i.test(entity) ) return true; return false; };

        if( !Array.isArray(graphs) ) {
            console.warn(`history-explorer-card: 'graphs' must be a list — got ${JSON.stringify(graphs)}. No graphs loaded.`);
            return;
        }

        for( let graph of graphs ) {
            if( !graph || typeof graph !== 'object' ) {
                console.warn(`history-explorer-card: skipping invalid graph entry (expected an object, got ${JSON.stringify(graph)})`);
                continue;
            }
            if( !Array.isArray(graph.entities) ) {
                if( graph.entities !== undefined )
                    console.warn(`history-explorer-card: graph '${graph.title ?? graph.type ?? '?'}' has an invalid 'entities' (expected a list, got ${JSON.stringify(graph.entities)}) — graph skipped`);
                continue;
            }
            const _gid = this.g_id++;
            const _groupId = _gid; // use graph index as groupId for static graphs
            const _interval = this.parseIntervalConfig(graph.options?.interval) ?? null;

            for( let e of graph.entities ) {
                if( !e || typeof e !== 'object' || typeof e.entity !== 'string' || e.entity === '' ) {
                    console.warn(`history-explorer-card: skipping invalid entity entry in graph '${graph.title ?? graph.type ?? '?'}' (expected an object with a non-empty 'entity' string, got ${JSON.stringify(e)})`);
                    continue;
                }
                if( e.entity.indexOf('*') >= 0 ) {
                    // graph.options.exclude applies to every wildcard entity in this graph;
                    // combined with (not replacing) this entity's own exclude, same pattern
                    // as the other graph-level defaults above.
                    const _graphExclude = graph.options?.exclude;
                    const _combinedExclude = _graphExclude
                        ? [ ...(Array.isArray(_graphExclude) ? _graphExclude : [_graphExclude]),
                            ...(Array.isArray(e.exclude) ? e.exclude : (e.exclude ? [e.exclude] : [])) ]
                        : e.exclude;
                    const regexExcludes = this.buildEntityExclusionList(_combinedExclude);
                    const regex = this.matchWildcardPattern(e.entity);
                    // Collect matches first, then add in natural alphabetical order —
                    // HA's state object iterates in entity creation order, which carries
                    // no meaningful logic a user could rely on (unlike entity_id/friendly_name,
                    // which the user actually names with intent).
                    const _matched = [];
                    for( let s in this._hass.states )
                        if( regex && regex.test(s) && !testEntityExclusionList(s, regexExcludes) )
                            _matched.push(s);
                    _matched.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                    for( let s of _matched ) {
                        const _ent = {...e, 'entity': s};
                        this.store.add(this._makeStaticEntityEntry(s, _groupId, _ent, _interval));
                    }
                } else {
                    this.store.add(this._makeStaticEntityEntry(e.entity, _groupId, e, _interval));
                }
            }
            // Store graph-level properties indexed by groupId — consumed at rebuild, never persisted.
            // fill/showMinMax/dashMode/lineMode/width/showPoints/decimation/netBars act as
            // per-entity defaults here (see addGraph's entityOptions merge) — same role as
            // entityOptions matched by entity_id/device_class/domain, but scoped to entities
            // sharing this graph instead. Deliberately excluded: color/name/scale/
            // siConversionFactor/unit/process/hidden — each is inherently per-entity, a
            // shared default for any of them would be meaningless or actively wrong (e.g. a
            // shared 'hidden' default would hide every entity in the graph by default).
            this.pconfig.graphs[_groupId] = {
                type           : graph.type,
                title          : graph.title,
                showTimeLabels : graph.options?.showTimeLabels,
                height         : graph.options?.height,
                stacked        : graph.options?.stacked,
                ylock          : graph.options?.ylock,
                ymin           : graph.options?.ymin,
                ymax           : graph.options?.ymax,
                // (ystepsize: spelling of the reference config up to 1.1.44, still accepted)
                ystepSize      : graph.options?.ystepSize ?? graph.options?.ystepsize,
                fill           : graph.options?.fill,
                showMinMax     : graph.options?.showMinMax,
                dashMode       : graph.options?.dashMode,
                lineMode       : graph.options?.lineMode,
                width          : graph.options?.width ?? graph.options?.lineWidth,
                showPoints     : graph.options?.showPoints,
                decimation     : graph.options?.decimation,
                netBars        : graph.options?.netBars,
                showSamples    : graph.options?.showSamples,
            };
        }
    }
}

// HistoryCardState's methods are spread over several files by role (see each file's
// header) — added to it here, as if written in the class itself
for( const part of [CardHistory, CardDatasets, CardGestures, CardMenus, CardStorage] )
    for( const name of Object.getOwnPropertyNames(part.prototype) )
        if( name !== 'constructor' )
            Object.defineProperty(HistoryCardState.prototype, name, Object.getOwnPropertyDescriptor(part.prototype, name));


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

        this.instance.pconfig.graphs = {};

        if( config.graphs )
            this.instance.buildGraphListFromConfig(config.graphs)


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
        this.instance.pconfig.defaultLineWidth =       config.lineWidth ?? config.width ?? 2.0;
        this.instance.pconfig.defaultDashMode =        config.dashMode;
        this.instance.pconfig.defaultNetBars =         config.netBars;
        this.instance.pconfig.defaultInterval =        config.interval;
        this.instance.pconfig.defaultShowMinMax =      config.showMinMax;
        this.instance.pconfig.defaultShowPoints =      config.showPoints;
        this.instance.pconfig.showUnavailable =        config.showUnavailable ?? false;
        this.instance.pconfig.showCurrentValues =      config.showCurrentValues ?? true;
        this.instance.pconfig.axisAddMarginMin =     ( config.axisAddMarginMin !== undefined ) ? config.axisAddMarginMin : false;
        this.instance.pconfig.axisAddMarginMax =     ( config.axisAddMarginMax !== undefined ) ? config.axisAddMarginMax : false;
        this.instance.pconfig.recordedEntitiesOnly =   config.recordedEntitiesOnly ?? false;
        this.instance.pconfig.filterEntities  =        config.filterEntities;
        this.instance.pconfig.excludeFilterEntities =   config.excludeFilterEntities;
        this.instance.pconfig.combineSameUnits =       config.combineSameUnits === true;
        this.instance.pconfig.defaultTimeRange =       config.defaultTimeRange ?? '24';
        // What the YAML itself says (undefined if it says nothing) — the only value its
        // front and its image are about; the '24' fallback above isn't the YAML speaking
        this.instance.pconfig.yamlDefaultTimeRange =   config.defaultTimeRange;
        this.instance.pconfig.enableMultidevicePersistence = this.instance.normalizePersistenceCategories(config.enable_multidevice_persistence, ['range', 'entities', 'order']);
        this.instance.pconfig.enablePersistence = this.instance.normalizePersistenceCategories(config.enable_persistence, ['range', 'entities', 'order']);
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
        this.instance.pconfig.defaultInfoPanel = config.defaultInfoPanel;

        this.instance.id = config.cardName ?? "default";
        this.instance.cid = gcid++;

        this.instance.contentValid = false;
        this.instance.entitiesPopulated = false;

        const header = config.header || `History explorer v${Version}`;
        const bgcol = parseColor(config.uiColors?.buttons ?? getComputedStyle(document.body).getPropertyValue('--primary-color') + '1f');

        const bitmask = { 'hide': 0, 'top': 1, 'bottom': 2, 'both': 3 };
        const tools = bitmask[config.uiLayout?.toolbar] ?? 1;
        const selector = bitmask[config.uiLayout?.selector] ?? 1;
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
            <div id='graphlist' class='card-content' style='margin-top:0px;padding-top:0px;'>
            ${this.instance.addUIHtml(tools & 1, selector & 1, bgcol, optionStyle, inputStyle, invertZoom, 0)}
        `;

        // Footer
        // Note: graph canvas elements are created dynamically by addGraphToCanvas (static and dynamic unified)
        html += `
            ${this.instance.addUIHtml(tools & 2, selector & 2, bgcol, optionStyle, inputStyle, invertZoom, 1)}
            </div>
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
