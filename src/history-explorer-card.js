
import "../deps/moment.js";
import "../deps/Chart.js";
import "../deps/chart-hec.js";
import "../deps/timeline.js";
import "../deps/md5.js"
import "../deps/FileSaver.js"

import { HistoryCSVExporter, StatisticsCSVExporter } from "./history-csv-exporter.js";
import { stateColors, stateColorsDark, parseColor, buttonsColor, UI_COLOR_DEFAULTS } from "./history-default-colors.js";
import { setLanguage, i18n } from "./languages.js";
import { EntityStore } from "./history-entity-store.js";
import { CardConfig } from "./card-config.js";
import { CardTimeRange } from "./card-timerange.js";
import { CardHistory } from "./card-history.js";
import { CardGraphs } from "./card-graphs.js";
import { CardCharts } from "./card-charts.js";
import { CardOperations } from "./card-operations.js";
import { CardToolbar, SELECTOR_LIST_MAX_HEIGHT } from "./card-toolbar.js";
import { CardSelector } from "./card-selector.js";
import { CardDatasets } from "./card-datasets.js";
import { seriesOf } from "./history-series.js";
import { CardGestures } from "./card-gestures.js";
import { CardMenus } from "./card-menus.js";
import { CardStorage } from "./card-storage.js";
import { CardValues } from "./card-values.js";
import { CardYaml } from "./card-yaml.js";
import { withLook, OPTION_DEFAULTS, PERSISTENCE_CATEGORIES, UI_PLACES } from "./history-options.js";
import { GESTURE_SETTINGS, clampGesture, applyGestures } from "./gesture-settings.js";
import { localGestures, versionIsNew } from "./card-storage.js";
import "./history-info-panel.js"
import { Version } from "./version.js";
import { perf } from "./card-perf.js";

// --------------------------------------------------------------------------------------
// Internal card representation and instance state
// --------------------------------------------------------------------------------------

export class HistoryCardState {

    constructor()
    {

        this.colorMap = new Map();
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
        this.ui.optionStyle   = '';
        this.ui.hideHeader    = false;
        this.ui.hideInterval  = false;
        this.ui.hideSelector  = false;
        this.ui.stickyTools   = 0;
        this.ui.wideInterval  = false;

        this.i18n = {};
        this.i18n.valid                = false;
        this.i18n.styleTimeTicks       = '';
        this.i18n.styleDateTicks       = '';
        this.i18n.styleDateTimeTooltip = '';
        this.i18n.styleTimeTooltip     = '';

        this.pconfig = {};
        this.pconfig.graphLabelColor      = '#333';
        this.pconfig.graphGridColor       = '#00000000';
        this.pconfig.cursorLineColor      = '#00000000';
        this.pconfig.showTooltipColors    = [true, true];
        this.pconfig.closeButtonColor     = undefined;
        this.pconfig.graphs               = {};
        this.pconfig.lockAllGraphs        = false;
        this.pconfig.nextDefaultColor     = 0;
        this.pconfig.entities             = [];
        // Every change to pconfig.entities goes through the store (history-entity-store.js)
        this.store                        = new EntityStore(this.pconfig);
        this.pconfig.infoPanelConfig      = null;
        this.pconfig.defaultInfoPanel     = undefined;
        this.pconfig.gestures             = {};

        this._requests = [];     // the requests to Home Assistant under way (card-history.js _ask)

        this.state = {};
        this.state.drag          = false;
        this.state.selecting     = false;
        this.state.updateCanvas  = null;
        this.state.loading       = false;
        this.state.zoomMode      = false;
        // (the magnifier's mode: what the elastic box zooms — 'x' the time, 'y' the Y axes, 'xy' both)
        this.state.zoomBox       = OPTION_DEFAULTS.defaultMagnifierMode;
        // (the statistics export's period chosen in its menu — null: the YAML's; see
        // exportStatsPeriod)
        this.state.exportStatsPeriod = null;
        this.state.autoScroll    = false;
        // (see card-timerange.js _settleWindow: nothing after the window — '>' greyed —; the time
        // shown after the present, kept in real time)
        this.state.nothingAfter  = false;
        this.state.realTimeGap   = 0;

        this._drag = null;   // label or graph being dragged (_onDragStart)
        this._lastBuildMs = 0;   // what drawing the graphs again last took (scheduleAutoRefresh)
        this._drawTid = 0;       // the graphs to be drawn again from the cache (_drawSoon)

        this.activeRange = {};
        this.activeRange.timeRangeHours  = 24;
        this.activeRange.timeRangeMinutes= 0;
        this.activeRange.tickStepSize    = 1;
        this.activeRange.tickStepUnit    = 'hour';

        this.statistics = {};
        this.statistics.enabled = false;
        this.statistics.retention = undefined;
        this.statistics.mode = '';
        this.statistics.period = undefined;

        this.id = "";

        this.graphs = [];

        this.g_id = 0;

        this.startTime;
        this.endTime;


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


    // Dark or light: Home Assistant's theme (or a dark background behind the card), unless
    // uimode says; then the colors of the labels, grid and cursor line (uiColors, else the
    // mode's)
    applyTheme(darkBackground = false)
    {
        const P = this.pconfig;
        this.ui.darkMode = this.themeIsDark(darkBackground);

        const _theme = this.ui.darkMode ? 'dark' : 'light';
        P.graphLabelColor = parseColor(P.uiColors.labels ?? UI_COLOR_DEFAULTS.labels[_theme]);
        P.graphGridColor  = parseColor(P.uiColors.gridLines ?? UI_COLOR_DEFAULTS.gridLines[_theme]);
        P.cursorLineColor = parseColor(P.uiColors.cursorLine ?? P.graphGridColor);
    }

    // Dark or not: Home Assistant's theme (or a dark background behind the card), unless
    // uimode says
    themeIsDark(darkBackground = false)
    {
        const P = this.pconfig;
        if( P.uimode === 'dark' ) return true;
        if( P.uimode === 'light' ) return false;
        return !!( this._hass.selectedTheme?.dark || this._hass.themes?.darkMode ) || darkBackground;
    }

    // Is the card's background dark (its mean channel at most 100)? — a dark theme Home
    // Assistant doesn't say is
    _darkBackground()
    {
        const bgcol = getComputedStyle(this._this.querySelector('#maincard')).backgroundColor.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
        return !!( bgcol && bgcol.length == 4 && (((+bgcol[1]) + (+bgcol[2]) + (+bgcol[3])) / 3 <= 100) );
    }

    // Home Assistant's theme switched (dark ↔ light) once the graphs are shown — the card's
    // (darkBackground: its background dark), the info panel's: their colors — labels, grid,
    // cursor line, states — those of the new one, every graph built again in them, in its place
    followTheme(darkBackground = false)
    {
        if( this.themeIsDark(darkBackground) === this.ui.darkMode ) return;
        this.applyTheme(darkBackground);
        this.rebuildGraphsInPlace();
    }

    // --------------------------------------------------------------------------------------
    // Device class or domain specific state localization
    // --------------------------------------------------------------------------------------

    // --------------------------------------------------------------------------------------
    // Card content
    // --------------------------------------------------------------------------------------

    async createContent()
    {
        // Initialize the content if it's not there yet.
        if( !this.contentValid ) {

            this.contentValid = true;
            // (its steps timed while the performance test records, from when it was made: its
            // width known, its toolbar, its saved state read, its graphs built, drawn)
            let _t = this._madeAt ?? performance.now();
            const _step = step => { const n = performance.now(); perf.add('card', n - _t, { step, card: this.cid }); _t = n; };
            _step('width');

            for( let i = 0; i < 2; i++ )
                this.insertUIHtmlText(i);

            this.applyTheme(this._darkBackground());
            // (the card's background changing in a fade when the theme switches — Home
            // Assistant's ha-card: transition all 0.3 s —: read again once at its color, the
            // frame after the switch finding it still dark, see followTheme)
            this._this.querySelector('#maincard')?.addEventListener('transitionend', e => {
                if( e.target.id === 'maincard' && /background/.test(e.propertyName) && this.contentValid ) this.followTheme(this._darkBackground());
            });

            this.clearGraphs();

            this.resizeSelector();

            for( let i = 0; i < 2; i++ ) this.wireToolbar(i);


            _step('toolbar');
            const _needsIntervalRedraw = await this.readLocalState();
            _step('saved state');
            // (the info panel's switch as read: the options menu shows it)
            this.refreshOptionsMenus();

            // (the time window known before the graphs are built: their time axis has it
            // from the first drawing — without it, it spans the data, ticked for the
            // window's range: thousands of labels over each other until the window is set)
            this.setEndWindow();

            // Every graph (static and dynamic) built from the entity list
            if( this.store.list ) this.buildGraphsFromStore();
            else this.store.reset([]);
            _step('graphs built');

            // (the entity selector's list built once the card is drawn: until then its field
            // reads "Loading…", sized as the list needed the last time — savedSelectorWidths)
            requestAnimationFrame(() => setTimeout(() => this.requestEntityCollection(), 0));

            this.today(false);
            _step('drawn');

            // Now that startTime/endTime are initialized, apply interval restoration if needed
            if( _needsIntervalRedraw ) this.updateHistory();

            // Register observer to resize the graphs whenever the maincard dimensions change
            let ro = new ResizeObserver(() => { this.resize(); });
            ro.observe(this._this.querySelector('#maincard'));

            // Update the info panel config in the browser local storage to sync with the YAML
            this.writeInfoPanelConfig();

            // Set auto refresh interval, if any
            if( this.pconfig.refreshInterval )
                setInterval(this.refresh.bind(this), this.pconfig.refreshInterval * 1000);

        }
    }

    updateContent()
    {
        if( !this.contentValid ) {
            let width = this.cardWidth();
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
        // (the default title in the user's language: "(new)" translated)
        if( this.ui.defaultTitle && versionIsNew ) this._this?.querySelector('#maincard')?.setAttribute('header', defaultTitle());

        this.ui.wideInterval = ['da', 'nl', 'sv', 'sk', 'ru'].includes(locale);

        const ds = getLocalizedDateString(locale, { dateStyle: 'medium' });
        const dt = ( ds[0] == 'D' ) ? 'D MMM' : 'MMM D';
        this.i18n.styleDateTicks = this.pconfig.timeTickShortDate ? 'D' : dt;
        this.i18n._styleDateLong = ds;
        this.i18n._styleDateShort = dt;

        if( this._hass.locale?.time_format === '24' ) locale = 'en-GB';
        if( this._hass.locale?.time_format === '12' ) locale = 'en-US';
        // (mini-graph-card's hour24: the 24-hour clock, or the 12-hour one — not set: Home
        // Assistant's own setting)
        if( this.pconfig.hour24 === true ) locale = 'en-GB';
        if( this.pconfig.hour24 === false ) locale = 'en-US';

        this.i18n.styleTimeTicks = getLocalizedDateString(locale, { timeStyle: 'short' });
        this.i18n.styleTimeTooltip = getLocalizedDateString(locale, { timeStyle: 'medium' });
        this.i18n.styleDateTimeTooltip = this.i18n.styleDateTicks + ', ' + this.i18n.styleTimeTooltip;

        this.i18n.valid = true;
    }


    // --------------------------------------------------------------------------------------
    // On demand refresh handling
    // --------------------------------------------------------------------------------------

    // Home Assistant pushed new states: if a shown entity changed, its current value is
    // updated at once (handleChangedEntities) and the recent history refreshed, paced
    // (scheduleAutoRefresh) — for the card and the info panel alike
    onStatesChanged()
    {
        if( !this.contentValid || !this.handleChangedEntities() ) return;
        if( this.pconfig.refreshEnabled )
            this.scheduleAutoRefresh();
    }

    handleChangedEntities()
    {
        let changed = false;

        for( let g of this.graphs ) {
            const _changed = [];
            g.entities.forEach((e, i) => { if( this._seeState(e.entity) ) _changed.push(i); });
            if( !_changed.length ) continue;
            changed = true;
            // (the values now: in the legend — each entity's own showCurrentValues — and over the graph)
            if( g !== this._frozenChart ) this.refreshCurrentValues(g, _changed);
        }
        // (an entity giving a shown entity its color: looked at as the others — that curve changes too)
        for( const id of this.optionSeriesIds() ) if( this._seeState(id) ) changed = true;

        return changed;
    }

    // The state of series id Home Assistant gives now, looked at: new to the card — a time
    // (last_changed) it hadn't seen —, a row of its history (addLiveState); whether it changed
    // since the card last looked (none yet: no)
    _seeState(id)
    {
        const _s = this.stateOf(id), lc = _s?.last_changed, _changed = this.stateMap.has(id) && lc != this.stateMap.get(id);
        if( _s && lc != this.stateMap.get(id) ) this.addLiveState(id, lc, _s.state);
        this.stateMap.set(id, lc);
        return _changed;
    }

    // The states of the shown entities a request asks — those giving a curve its color too —,
    // looked at when it's sent (_seeState): a change after it — one it can't bring — seen as a
    // change
    noteAskedStates(request)
    {
        const _ids = new Set(request.entity_ids ?? request.statistic_ids ?? []);
        for( const id of [...this.graphs.flatMap(g => g.entities.map(e => e.entity)), ...this.optionSeriesIds()] ) if( _ids.has(seriesOf(id).entity) ) this._seeState(id);
    }


}

// HistoryCardState's methods are spread over several files by role (see each file's
// header) — added to it here, as if written in the class itself
for( const part of [CardConfig, CardTimeRange, CardHistory, CardGraphs, CardCharts, CardOperations, CardDatasets, CardToolbar, CardSelector, CardGestures, CardMenus, CardStorage, CardValues, CardYaml] )
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

// The cards off the page, drawn, by what they are (pageKey: name and YAML) — [{ el, tid }]: a
// card made again on the page takes back the content of one (see _takeBack), until
// PAGE_CARD_KEPT_MS after it left
const PAGE_CARDS = new Map(), PAGE_CARD_KEPT_MS = 10 * 60e3;

// The card's title, unless the YAML gives one: its version — "(new)" after it the first time
// this device runs it (see card-storage.js versionIsNew), in the user's language once known
const defaultTitle = () => `History explorer v${Version}` + ( versionIsNew ? ` (${i18n('ui.label.new_version')})` : '' );

class HistoryExplorerCard extends HTMLElement
{
    instance = null;
    configSet = false;
    yamlConfig = null;
    // (Home Assistant's theme as the last hass said it — see set hass)
    _theme = undefined;

    // (the card off the page — Home Assistant drawing the dashboard again, another view —, or
    // back on it: its cache kept for a card made again meanwhile, see card-history.js)
    disconnectedCallback()
    {
        perf.add('card', 0, { step: 'off the page', card: this.instance?.cid });
        this.instance?.leavePage();
        // (drawn: kept for a card made again on the page with the same name and YAML — it
        // takes this one's content as it is, see InitWithConfig —, let go PAGE_CARD_KEPT_MS later)
        if( !this.instance?.contentValid ) return;
        const k = this.instance.pageKey, l = PAGE_CARDS.get(k) ?? [];
        if( l.some(x => x.el === this) ) return;
        const x = { el: this, tid: setTimeout(() => { const m = PAGE_CARDS.get(k)?.filter(y => y !== x); if( m?.length ) PAGE_CARDS.set(k, m); else PAGE_CARDS.delete(k); }, PAGE_CARD_KEPT_MS) };
        PAGE_CARDS.set(k, [...l, x]);
    }

    connectedCallback()
    {
        this._keepEditorRoom();
        // (made off the page: built now — or the card it replaces, off the page by now, taken back)
        if( this._pendingHass ) { const h = this._pendingHass; this._pendingHass = null; this.hass = h; }
        perf.add('card', 0, { step: 'on the page', card: this.instance?.cid });
        this.instance?.backOnPage();
        // (back itself: no longer for a card made again)
        const k = this.instance?.pageKey, l = PAGE_CARDS.get(k);
        const x = l?.find(y => y.el === this);
        if( x ) { clearTimeout(x.tid); if( l.length > 1 ) PAGE_CARDS.set(k, l.filter(y => y !== x)); else PAGE_CARDS.delete(k); }
    }

    // A card of the same name and YAML (key) off the page, drawn (see disconnectedCallback):
    // its content moved into this one — its graphs as they are, drawn, its cache, its state —,
    // nothing built or drawn again, its width not waited for → whether one was taken
    _takeBack(key)
    {
        const l = PAGE_CARDS.get(key), x = l?.find(y => !y.el.isConnected && y.el.instance?.contentValid);
        if( !x ) return false;
        clearTimeout(x.tid);
        if( l.length > 1 ) PAGE_CARDS.set(key, l.filter(y => y !== x)); else PAGE_CARDS.delete(key);
        const _t = performance.now();
        this.instance = x.el.instance;
        x.el.instance = null;
        this.replaceChildren(...x.el.childNodes);
        this.instance._this = this;
        this.instance.backOnPage();
        // (timed while the performance test records: its graphs moved here, then shown — the
        // page's first frame after it)
        const _cid = this.instance.cid;
        perf.add('card', performance.now() - _t, { step: 'taken back', card: _cid });
        if( perf.on ) requestAnimationFrame(() => perf.add('card', performance.now() - _t, { step: 'first frame after it', card: _cid }));
        this._tookBack = true;
        return true;
    }

    // Home Assistant gives a card preview: true in its card editor's window (hui-dialog-edit-
    // card.ts), and also on the dashboard while it's edited (hui-view.ts, hui-section.ts,
    // hui-panel-view.ts) — so not used for the room. In the card editor's window only, room
    // kept under the card for its menus and the entity selector's lists to open in: its
    // preview scrolls, and is no higher than the card when its YAML is short — a menu that
    // doesn't fit in it closes at once (card-menus.js followAnchor); on the dashboard, none
    set preview(on)
    {
        this._preview = !!on;
    }
    get preview() { return !!this._preview; }

    // Whether the card is in Home Assistant's card editor's window: one of its parents, through
    // the shadow roots, is it
    _inCardEditor()
    {
        for( let n = this.parentNode ?? this.getRootNode()?.host; n; n = n.parentNode ?? n.host )
            if( n.localName === 'hui-dialog-edit-card' ) return true;
        return false;
    }

    // The room under the card in the card editor's window (see preview), on or off
    _keepEditorRoom()
    {
        const on = this._inCardEditor();
        this.style.display = on ? 'block' : '';
        this.style.paddingBottom = on ? SELECTOR_LIST_MAX_HEIGHT : '';
    }

    // Whenever the state changes, a new `hass` object is set. Use this to update your content.
    set hass(hass)
    {
        // (a card made, not on the page yet — Home Assistant makes the new one before it takes
        // the one it replaces off the page —: nothing built until it's put on the page, where
        // it takes the one it replaces back, see connectedCallback)
        if( this.configSet && !this.instance && !this.isConnected ) { this._pendingHass = hass; return; }
        if( this.configSet ) {
            this.configSet = false;
            this.InitWithConfig(hass);
        }

        if( !this.instance ) return;

        this.instance._this = this;
        // (Home Assistant's theme switched, dark ↔ light: followed once its colors are on the
        // page — the next frame)
        const _theme = `${hass.selectedTheme?.dark}|${hass.themes?.darkMode}`;
        if( this._theme !== undefined && _theme !== this._theme ) requestAnimationFrame(() => this.instance?.contentValid && this.instance.followTheme(this.instance._darkBackground()));
        this._theme = _theme;
        this.instance._hass = hass;
        // (a card taken back: what came while it was off the page asked, as a refresh does —
        // the same one as for the states changed meanwhile, see scheduleAutoRefresh: one refresh)
        if( this._tookBack ) { this._tookBack = false; this.instance.scheduleAutoRefresh(); }

        this.instance.version = hass.config.version.split('.').map(Number);

        if( !this.instance.i18n.valid )
            this.instance.initLocalization();

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
        // (look: a set of options given at once — see history-options.js)
        this.config = withLook(config);
        // (as written — what the YAML export compares with, see card-yaml.js)
        this.yamlConfig = config;
        this.configSet = true;
    }

    InitWithConfig(hass)
    {
        const config = this.config;

        // (a card made again — Home Assistant drawing the dashboard again —: the one it
        // replaces taken back, if it was drawn)
        if( !this.instance && this._takeBack(( config.cardName ?? 'default' ) + ' ' + JSON.stringify(config)) ) return;

        if( !this.instance )
            this.instance = new HistoryCardState();

        this.instance._hass = hass;

        this.instance.g_id = 0;

        this.instance.pconfig.graphs = {};

        const _graphs = this.instance.yamlGraphs(config);
        if( _graphs )
            this.instance.buildGraphListFromConfig(_graphs);


        this.instance.applyConfig(config);
        // (the card's own: what's saved and how, the info panel)
        this.instance.pconfig.yamlDefaultTimeRange =   config.defaultTimeRange;
        this.instance.pconfig.yamlDefaultMagnifierMode = config.defaultMagnifierMode;
        this.instance.pconfig.enableMultidevicePersistence = this.instance.normalizePersistenceCategories(config.enableMultidevicePersistence, PERSISTENCE_CATEGORIES, 'enableMultidevicePersistence');
        this.instance.pconfig.enablePersistence = this.instance.normalizePersistenceCategories(config.enablePersistence, PERSISTENCE_CATEGORIES, 'enablePersistence');

        this.instance.pconfig.closeButtonColor = parseColor(config.uiColors?.closeButton ?? UI_COLOR_DEFAULTS.closeButton);

        this.instance.pconfig.infoPanelConfig = config.infoPanel;
        this.instance.pconfig.defaultInfoPanel = config.defaultInfoPanel;
        // (the gesture thresholds: super-global, see gesture-settings.js)
        this.instance.pconfig.gestures = Object.fromEntries(Object.keys(GESTURE_SETTINGS)
            .map(k => [k, clampGesture(k, config.gestures?.[k])]).filter(([k, v]) => v !== undefined));

        this.instance.id = config.cardName ?? "default";
        // (what the card is: its name and its YAML — its cache on the page, see card-history.js initCache)
        this.instance.pageKey = this.instance.id + ' ' + JSON.stringify(config);
        this.instance.cid = gcid++;
        this.instance._madeAt = performance.now();
        perf.add('card', 0, { step: 'made', card: this.instance.cid });

        this.instance.contentValid = false;
        this.instance.entitiesPopulated = false;

        const header = config.header || defaultTitle();
        this.instance.ui.defaultTitle = !config.header;
        const bgcol = buttonsColor(config.uiColors);

        const _layout = k => UI_PLACES[config.uiLayout?.[k]] ?? UI_PLACES[OPTION_DEFAULTS.uiLayout[k]];
        const tools = _layout('toolbar');
        const selector = _layout('selector');
        this.instance.ui.stickyTools = _layout('sticky');
        this.instance.ui.hideSelector = selector === 0;

        const invertZoom = config.uiLayout?.invertZoom === true;

        const optionStyle = `style="color:var(--primary-text-color);background-color:var(--card-background-color)"`;
        // (the entity selector in the theme's colors — the browser's own white field glared on
        // a dark theme — or in uiColors.selector)
        const inputStyle = config.uiColors?.selector ? `style="color:var(--primary-text-color);background-color:${config.uiColors.selector};border:1px solid black;"`
                         : `style="color:var(--primary-text-color);background-color:var(--card-background-color);border:1px solid var(--secondary-text-color,#888);border-radius:2px"`;

        this.instance.ui.optionStyle = optionStyle;
        this.instance.ui.hideHeader = header === 'hide';
        this.instance.ui.hideInterval = config.uiLayout?.interval === 'hide';

        // Generate card html

        // Header
        let html = `
            <ha-card id="maincard" header="${this.instance.ui.hideHeader ? '' : header}">
            <div id='graphlist' class='card-content' style='margin-top:0px;padding-top:0px;'>
            ${this.instance.addUIHtml(tools & 1, selector & 1, bgcol, optionStyle, inputStyle, invertZoom, 0)}
            ${selector ? '' : this.instance.menusOnlyHtml()}
        `;

        // Footer
        // Note: graph canvas elements are created dynamically by addGraphToCanvas (static and dynamic unified)
        html += `
            ${this.instance.addUIHtml(tools & 2, selector & 2, bgcol, optionStyle, inputStyle, invertZoom, 1)}
            </div>
            </ha-card>
        `;

        this.innerHTML = html;
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

// The gesture settings of this device given to Chart.js, before any chart exists
applyGestures(localGestures());

console.info(`%c HISTORY-EXPLORER-CARD %c Version ${Version}`, "color:white;background:blue;font-weight:bold", "color:black;background:white;font-weight:bold");

// (this file may run twice — as a dashboard resource and through frontend: extra_module_url,
// from two URLs: the element is defined once)
if( !customElements.get('history-explorer-card') )
    customElements.define('history-explorer-card', HistoryExplorerCard);

window.customCards = window.customCards || [];
if( !window.customCards.some(c => c.type === 'history-explorer-card') )
    window.customCards.push({ type: 'history-explorer-card', name: 'History Explorer Card', preview: false, description: 'An interactive history viewer card'});
