
import "../deps/moment.js";
import "../deps/Chart.js";
import "../deps/chart-hec.js";
import "../deps/timeline.js";
import "../deps/md5.js"
import "../deps/FileSaver.js"

import { HistoryCSVExporter, StatisticsCSVExporter } from "./history-csv-exporter.js";
import { stateColors, stateColorsDark, defaultColors, parseColor } from "./history-default-colors.js";
import { setLanguage, i18n } from "./languages.js";
import { EntityStore, entityIdOf } from "./history-entity-store.js";
import { CardConfig } from "./card-config.js";
import { CardTimeRange } from "./card-timerange.js";
import { CardHistory } from "./card-history.js";
import { CardGraphs } from "./card-graphs.js";
import { CardToolbar } from "./card-toolbar.js";
import { CardSelector } from "./card-selector.js";
import { CardDatasets } from "./card-datasets.js";
import { CardGestures } from "./card-gestures.js";
import { CardMenus } from "./card-menus.js";
import { CardStorage } from "./card-storage.js";
import "./history-info-panel.js"
import { Version } from "./version.js";

var Chart = window.HXLocal_Chart;
var moment = window.HXLocal_moment;


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
        this.pconfig.defaultInterpolation = 'monotone';
        this.pconfig.cardGraphDefaults    = {};
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
        this._autoRefreshTid = 0;
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


    // Dark or light: Home Assistant's theme (or a dark background behind the card), unless
    // uimode says; then the colors of the labels, grid and cursor line (uiColors, else the
    // mode's)
    applyTheme(config, darkBackground = false)
    {
        this.ui.darkMode = !!( (this._hass.selectedTheme && this._hass.selectedTheme.dark) || (this._hass.themes && this._hass.themes.darkMode) ) || darkBackground;
        if( config.uimode === 'dark' ) this.ui.darkMode = true; else
        if( config.uimode === 'light' ) this.ui.darkMode = false;

        this.pconfig.graphLabelColor = parseColor(config.uiColors?.labels ?? (this.ui.darkMode ? '#9b9b9b' : '#333'));
        this.pconfig.graphGridColor  = parseColor(config.uiColors?.gridlines ?? (this.ui.darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"));
        this.pconfig.cursorLineColor = parseColor(config.uiColors?.cursorline ?? this.pconfig.graphGridColor);
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
    // Card content
    // --------------------------------------------------------------------------------------

    async createContent()
    {
        // Initialize the content if it's not there yet.
        if( !this.contentValid ) {

            this.contentValid = true;

            for( let i = 0; i < 2; i++ )
                this.insertUIHtmlText(i);

            let bgcol = getComputedStyle(this._this.querySelector('#maincard')).backgroundColor.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);

            this.applyTheme(this._this.config, !!( bgcol && bgcol.length == 4 && (((+bgcol[1]) + (+bgcol[2]) + (+bgcol[3])) / 3 <= 100) ));

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
                        this.addGraph(_eid, { color: _e.color, fill: _e.fill, hidden: _e.hidden, isStatic: _e.isStatic, interval: _e.interval, groupId: _group.groupId, entry: _e });
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
            let ro = new ResizeObserver(() => { this.resize(); });
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

    // Home Assistant pushed new states: if a shown entity changed, its current value in the
    // legend is updated and the recent history refreshed (scheduleAutoRefresh) — for the card
    // and the info panel alike
    onStatesChanged()
    {
        if( !this.contentValid || !this.handleChangedEntities() ) return;
        if( this.pconfig.showCurrentValues )
            this.updateHistory();
        if( this.pconfig.refreshEnabled )
            this.scheduleAutoRefresh();
    }

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
                        d.label = this._legendLabel(d);
                    }
                    changed = true;
                }
                this.stateMap.set(e.entity, lc);
                i++;
            }
        }
        // (an entity giving a shown entity its color: that curve changes too)
        for( const id of this.colorEntityIds() ) {
            const lc = this._hass.states[id]?.last_changed;
            if( this.stateMap.has(id) && lc != this.stateMap.get(id) ) changed = true;
            this.stateMap.set(id, lc);
        }

        return changed;
    }


}

// HistoryCardState's methods are spread over several files by role (see each file's
// header) — added to it here, as if written in the class itself
for( const part of [CardConfig, CardTimeRange, CardHistory, CardGraphs, CardDatasets, CardToolbar, CardSelector, CardGestures, CardMenus, CardStorage] )
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

        this.instance.onStatesChanged();

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


        this.instance.applyConfig(config);
        // (the card's own: what's saved and how, the CSV export, the info panel)
        this.instance.pconfig.yamlDefaultTimeRange =   config.defaultTimeRange;
        this.instance.pconfig.enableMultidevicePersistence = this.instance.normalizePersistenceCategories(config.enable_multidevice_persistence, ['range', 'entities', 'order']);
        this.instance.pconfig.enablePersistence = this.instance.normalizePersistenceCategories(config.enable_persistence, ['range', 'entities', 'order']);
        this.instance.pconfig.exportSeparator =        config.csv?.separator;
        this.instance.pconfig.exportTimeFormat =       config.csv?.timeFormat;
        this.instance.pconfig.exportAttributes =       config.csv?.exportAttributes;
        this.instance.pconfig.exportStatsPeriod =      config.csv?.statisticsPeriod ?? 'hour';
        this.instance.pconfig.exportNumberLocale =     config.csv?.numberLocale;

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

// (this file may run twice — as a dashboard resource and through frontend: extra_module_url,
// from two URLs: the element is defined once)
if( !customElements.get('history-explorer-card') )
    customElements.define('history-explorer-card', HistoryExplorerCard);

window.customCards = window.customCards || [];
if( !window.customCards.some(c => c.type === 'history-explorer-card') )
    window.customCards.push({ type: 'history-explorer-card', name: 'History Explorer Card', preview: false, description: 'An interactive history viewer card'});
