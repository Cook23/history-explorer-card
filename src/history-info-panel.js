
import { defaultGood, defaultInactiveLight, defaultInactiveDark, stateColors, stateColorsDark, buttonsColor } from "./history-default-colors";
import { HistoryCardState } from "./history-explorer-card";
import { getDomainForEntityPure, getDeviceClassPure, getEntityOptionsPure, baseTypePure } from "./card-config.js";
import { typeMenuHtml } from "./card-menus.js";
import { timeButtonsHtml, rangeControlsHtml } from "./card-toolbar.js";
import { i18n } from "./languages.js";
import { infoPanelData, fetchInfoPanelData, takeInfoLook } from "./card-storage.js";

// --------------------------------------------------------------------------------------
// Clone of lit html(), don't want to pull in the entire framework
// --------------------------------------------------------------------------------------

const litHtml = (g) => {
    return (s, ...v) => {
        return {
            _$litType$ : g,
            strings : s,
            values: v
        };
    }
};

const html = litHtml(1);


// --------------------------------------------------------------------------------------
// HA history more info panel override
//
// The history of Home Assistant's entity dialog (ha-more-info-history) is hooked as soon as
// this file runs — by a dashboard showing a card, or earlier on any page through
// `frontend: extra_module_url` — and stays hooked: whether the panel replaces Home
// Assistant's own history is decided at each render, from what the card saves
// (card-storage.js infoPanelData: present = on, with the panel's config), or, on a browser
// where the card never ran, from the same data in Home Assistant's user data
// (fetchInfoPanelData).
// --------------------------------------------------------------------------------------

let hec_panel = {};
    hec_panel.config = null;
    hec_panel.show = undefined;
    hec_panel.entity = null;

// Is the panel on? Its config read along (hec_panel.config)
function panelEnabled()
{
    const data = infoPanelData();
    if( data ) hec_panel.config = data.config;
    return !!data;
}

// Nothing saved in this browser: what Home Assistant's user data says, asked once per page
// (whichever copy of this file asks); on, it's saved here and the dialog rendered again
function fetchPanelState(el)
{
    fetchInfoPanelData(el.hass, () => el.requestUpdate?.());
}

function hxHookInfoPanel()
{
    let __fn = customElements.get("ha-more-info-history");
    // (hooked once: another copy of this file — loaded from another URL — leaves it as it is;
    // hooking it twice would make _oldUpdated call itself)
    if( !__fn || __fn.prototype._hxInfoPanelHooked ) return;
    __fn.prototype._hxInfoPanelHooked = true;

    __fn.prototype._databaseCallback = function(valid)
    {
        if( hec_panel.show === undefined ) {

            hec_panel.show = valid;

            if( !valid ) {
                let selector = this.shadowRoot.querySelector('#maincard');
                if( selector )
                    selector.style.display = 'none';
            }

        }
    }

    __fn.prototype._setEntityOptions = function(instance)
    {
        const entity_id = this.entityId;

        const entityOptions = instance.getEntityOptions(entity_id);

        // Opened from a card's curve: shown as it looks there — its type, its color, its fill,
        // its line, its points, its extremes (keepInfoLook) —, else as the panel's options say
        const _look = takeInfoLook(entity_id) ?? {};

        const type = _look.type || entityOptions?.type || baseTypePure(instance._hass, entity_id);

        // Make sure the panel always starts with the same default graph color
        instance.pconfig.nextDefaultColor = 0;

        // No label area for timelines
        instance.pconfig.labelAreaWidth = ( type == 'timeline' || type == 'arrowline' ) ? 0 : 55;

        // Unified pipeline — static graph = dynamic graph with isStatic:true
        instance.pconfig.graphs = {};
        instance.pconfig.graphs[instance.g_id] = {
            title          : undefined,
            showTimeLabels : entityOptions?.showTimeLabels,
            height         : entityOptions?.height,
            stacked        : entityOptions?.stacked,
            ylock          : entityOptions?.ylock,
        };

        // Not persisted (this panel has nothing to save) — same pconfig.entities shape as
        // history-explorer-card, just never written to storage. addGraph computes color,
        // fill, lineMode, scale, process, etc. itself (via its own getEntityOptions call)
        // and writes them into this same entry — the single source for entity
        // data, no separate copy. width is set explicitly here: this panel's default
        // (1.001) differs from the main card's (pconfig.defaultLineWidth, 2.0). lineWidth
        // is accepted as a synonym of width, same as the main card.
        const _pcEntry = {
            entity   : entity_id,
            groupId  : instance.g_id,
            type     : _look.type,
            lineMode : _look.lineMode,
            interpolation : _look.interpolation,
            dashMode : _look.dashMode,
            showPoints : _look.showPoints,
            showMinMax : _look.showMinMax,
            width    : ( type == 'line' || type == 'arrowline' || type == 'bar' ) ? (_look.width ?? entityOptions?.lineWidth ?? 1.001) : undefined,
            interval : entityOptions?.interval ?? null,
            isStatic : true,
        };
        instance.store.reset([_pcEntry]);

        instance.graphs = [];
        instance.addGraph(entity_id, { noAutoGroup: true, color: _look.color ?? entityOptions?.color, fill: _look.fill ?? entityOptions?.fill, isStatic: true,
                                       interval: entityOptions?.interval, groupId: instance.g_id, entry: _pcEntry });
    }

    __fn.prototype._injectHistoryExplorer = function(instance)
    {
        instance.initLocalization();

        // (always on a small screen: its curve's tooltip as smallScreenTooltip says)
        instance.infoPanel = true;

        // (the toolbar's buttons and range selector: the card's markup)
        const _dl = instance._this.querySelector('#dl_0'), _dr = instance._this.querySelector('#dr_0');
        if( _dl ) _dl.innerHTML = timeButtonsHtml(0);
        if( _dr ) _dr.innerHTML = rangeControlsHtml(0, 'style="color:var(--primary-text-color);background-color:var(--card-background-color)"', hec_panel?.config?.uiLayout?.invertZoom === true);

        instance.insertUIHtmlText(0);

        instance.wireToolbar(0);

        const config = hec_panel.config ?? {};

        instance.g_id = 0;

        instance.stateColors = { ...stateColors };
        instance.stateColorsDark = { ...stateColorsDark };

        instance.stateColors['off']                      = defaultGood;
        instance.stateColors['binary_sensor.multiple']   = '#e5ad23';
        instance.stateColors['battery_charging.off']     = defaultInactiveLight;
        instance.stateColors['plug.off']                 = defaultInactiveLight;
        instance.stateColors['running.off']              = defaultInactiveLight;
        instance.stateColors['update.on']                = defaultInactiveLight;
        instance.stateColorsDark['battery_charging.off'] = defaultInactiveDark;
        instance.stateColorsDark['plug.off']             = defaultInactiveDark;
        instance.stateColorsDark['running.off']          = defaultInactiveDark;
        instance.stateColorsDark['update.on']            = defaultInactiveDark;

        // The configuration, read as the card reads its own — with the panel's own defaults,
        // and what the panel decides whatever its configuration says
        instance.applyConfig(config, {
            defaults: { cursorMode: 'hide', cursorTypes: ['all'], tooltipShowDuration: true, defaultLineMode: 'lines' },
            fixed: { labelsVisible: false, hideLegend: true, showCurrentValues: false, recordedEntitiesOnly: false,
                     filterEntities: null, excludeFilterEntities: null, combineSameUnits: false, timelineBarSpacing: 40,
                     // (no refresh.interval: the panel only lives while its dialog is open)
                     refreshInterval: undefined },
        });
        instance.statistics.force = undefined;

        instance.applyTheme(config);

        this._setEntityOptions(instance);

        // Entity type menu — "Type" link click opens the same menu as the main card,
        // conditioned identically (numeric entity state → full menu, otherwise not rendered)
        const _tf0 = instance._this.querySelector('#tf_0');
        if( _tf0 ) {
            instance.ui.inputField[0] = _tf0;
            // (the card's menu markup, without what only the card offers)
            const _etw = instance._this.querySelector('#etw_0');
            if( _etw ) _etw.innerHTML = typeMenuHtml(0, false);
            instance.initEntityTypeMenu(0);
            _tf0.addEventListener('click', () => {
                const _g = instance.graphs[0];
                if( _g ) instance.showEntityTypeMenu(0, _g.entities[0].entity, _g, { from: 'panel', align: 'center' });
            });
        }

        instance.contentValid = true;

        instance.databaseCallback = this._databaseCallback.bind(this);

        instance.setTimeRangeFromString(instance.pconfig.defaultTimeRange);

        instance.today(false);

        // Apply correct toolbar layout (always layout C in info-panel — no sl)
        instance.resizeSelector();

        let ro = new ResizeObserver(() => {
            for( let g of instance.graphs ) g.chart.resize(undefined, g.graphHeight);
            instance.setStepSize(true, instance._this.querySelector('#tb_0')?.clientWidth || null);
            instance.resizeSelector();
        });
        ro.observe(this);
    };

    function isExcluded(hass, entity_id)
    {
        if( hec_panel?.config?.exclude ) {
            return hec_panel.config.exclude[entity_id] ||
                   hec_panel.config.exclude[getDomainForEntityPure(entity_id)] ||
                   hec_panel.config.exclude[getDeviceClassPure(hass, entity_id)];
        }
        return false;
    }

    __fn.prototype._hxUpdated = function(changedProps)
    {
        if( !panelEnabled() ) return this._oldUpdated(changedProps);

        if( !this.hec_instance ) {

            hec_panel.show = undefined;

            this.hec_instance = new HistoryCardState();

            this.hec_instance._this = this.shadowRoot;
            this.hec_instance._hass = this.hass;

            this.hec_instance.version = this.hass.config.version.split('.').map(Number);

            if( isExcluded(this.hass, this.entityId) ) {
                return this._oldUpdated(changedProps);
            }

            this._injectHistoryExplorer(this.hec_instance);


        } else {

            // If the entity changed without reopening the popup, then create a new graph with new settings
            if( this._recreate ) {
                this._recreate = false;
                this._setEntityOptions(this.hec_instance);
                this.hec_instance.updateHistory();
            }

            // New states, as for the card
            this.hec_instance._hass = this.hass;
            this.hec_instance.onStatesChanged();

        }
    };

    __fn.prototype._hxRender = function()
    {
        if( !panelEnabled() ) {
            fetchPanelState(this);
            return this._oldRender();
        }

        const entity_id = this.entityId;

        if( isExcluded(this.hass, entity_id) ) {
            return this._oldRender();
        }

        const entityOptions = getEntityOptionsPure(this.hass, hec_panel?.config?.entityOptions, entity_id);

        const type = entityOptions?.type || baseTypePure(this.hass, entity_id);

        // Entity type menu access — same all-or-nothing rule as the main card:
        // only offered when the entity's current state is numeric-convertible
        const _state = this.hass.states[entity_id]?.state;
        const _isNumeric = _state !== undefined && _state !== null && !isNaN(Number(_state));

        const bgcol = buttonsColor(hec_panel?.config?.uiColors);
        const tools = hec_panel?.config?.uiLayout?.toolbar != 'hide';

        if( hec_panel.entity !== this.entityId ) {
            hec_panel.entity = this.entityId;
            hec_panel.show = undefined;
            if( this.hec_instance ) this._recreate = true;
        }

        const i = 0;

        // The toolbar: the card's (its time buttons and zoom controls filled in by
        // _injectHistoryExplorer — this template renders no HTML string)
        if( tools ) {

            return html`
                <div id="maincard" style="display:${(hec_panel.show === false) ? 'none' : 'block'};margin-bottom: 16px">
                <div id="tb_${i}" style="position:relative;margin-left:0px;width:100%;min-height:30px;margin-bottom:10px;display:flex;align-items:center;line-height:normal;">
                    <div id="dl_${i}" style="background-color:${bgcol};padding-left:5px;padding-right:5px;flex:0 0 auto;"></div>
                    <div id="sl_${i}" style="flex:1 1 auto;display:flex;justify-content:center;">
                    ${_isNumeric ? html`
                        <span id="tf_${i}" style="cursor:pointer;text-decoration:underline;color:var(--primary-text-color);">${i18n('ui.menu.type_label')}</span>
                        <div id="etw_${i}" style="display:contents"></div>
                    ` : ''}
                    </div>
                    <div id="dr_${i}" style="background-color:${bgcol};padding-left:5px;padding-right:5px;flex:0 0 auto;"></div>
                </div>
                <div id='graphlist' style="margin-left:-2px;margin-right:-10px">
                </div>
                </div>
                `;

        } else {

            return html`
                <div id="maincard" style="display:${(hec_panel.show === false) ? 'none' : 'block'};margin-bottom: 16px">
                <div id='graphlist' style="margin-left:-2px;margin-right:-10px">
                </div>
                </div>
                `;

        }
    };

    __fn.prototype._oldUpdated = __fn.prototype.updated;
    __fn.prototype._oldRender = __fn.prototype.render;
    __fn.prototype.updated = __fn.prototype._hxUpdated;
    __fn.prototype.render = __fn.prototype._hxRender;
}

customElements.whenDefined('ha-more-info-history').then(hxHookInfoPanel);

