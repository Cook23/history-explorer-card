// What the card keeps between sessions and devices: its local state, Home Assistant's
// user data and the YAML configuration, merged by the "last one to speak wins" rules
// (readLocalState / writeLocalState). Part of HistoryCardState (added to it in
// history-explorer-card.js).

import { i18n } from "./languages.js";
import { keyOf } from "./history-entity-store.js";
import { GESTURE_SETTINGS, clampGesture, gestureSettings, applyGestures } from "./gesture-settings.js";

// --------------------------------------------------------------------------------------
// What is kept for the whole page — every card and the info panel, read before any card
// exists: the gesture settings, the info panel's switch and its config. On this device
// (localStorage) and in Home Assistant's user data (every device).
// --------------------------------------------------------------------------------------

const GESTURES_KEY = 'history-explorer-gestures';
// (the info panel's config, { enabled, config }: none when it's off)
const INFO_PANEL_KEY = 'history-explorer-info-panel';
// (Home Assistant only: the switch { enabled }, and the registry of the cards' defaultInfoPanel)
const INFO_PANEL_SWITCH_KEY = 'history-explorer-infopanel-enabled';

const _readLocal = key => { try { return JSON.parse(window.localStorage.getItem(key)); } catch(e) { return null; } };

// The gesture settings in force on this device: { name: value } for each of them
export function localGestures()
{
    return gestureSettings(_readLocal(GESTURES_KEY));
}

// Some gesture settings set on this device (saved, and given to Chart.js); returns whether
// any changed
function keepGestures(values)
{
    const _v = localGestures();
    let _changed = false;
    for( const k in values ) {
        const _c = clampGesture(k, values[k]);
        if( _c !== undefined && _c !== _v[k] ) { _v[k] = _c; _changed = true; }
    }
    if( _changed ) window.localStorage.setItem(GESTURES_KEY, JSON.stringify(_v));
    applyGestures(_v);
    return _changed;
}

// The info panel's config on this device ({ enabled, config }), null when it's off
export function infoPanelData()
{
    return _readLocal(INFO_PANEL_KEY);
}

// Nothing saved on this device: what Home Assistant's user data says, asked once per page;
// on, kept here, then onKept()
export function fetchInfoPanelData(hass, onKept)
{
    if( window.__hxInfoPanelFetched || !hass?.callWS ) return;
    window.__hxInfoPanelFetched = true;
    hass.callWS({ type: 'frontend/get_user_data', key: INFO_PANEL_KEY }).then(r => {
        if( !r?.value || window.localStorage.getItem(INFO_PANEL_KEY) ) return;
        window.localStorage.setItem(INFO_PANEL_KEY, JSON.stringify(r.value));
        onKept?.();
    }, () => {});
}

// Is the info panel on (on this device)?
export let infoPanelEnabled = !!infoPanelData();

// The look of the curve an entity's dialog was opened from (a click on its value, its menu's
// Info): its type, its line mode, its interpolation, its color, its fill, its line's width
// and style, its points and its extremes — for the info panel to show it the same way. Taken
// once, by that entity's panel (takeInfoLook)
let infoLook = null;
export function keepInfoLook(entityId, look)
{
    infoLook = { entityId, look };
}
export function takeInfoLook(entityId)
{
    const _look = infoLook?.entityId === entityId ? infoLook.look : null;
    infoLook = null;
    return _look;
}

// --------------------------------------------------------------------------------------
// Where each field of an entity that can be saved goes — the one place to change it:
//   'devices' — the user finds it on every device (Home Assistant's user data: one user,
//               so the last one to speak wins, with no conflict between people);
//   'local'   — on this device only: a viewing comfort that suits one screen and clutters
//               another (every point of a curve, a verbose curve hidden — fine on a large
//               screen, unreadable or needed on a small one).
// Whether a field is saved at all is set by the persistence options (enable_persistence,
// enable_multidevice_persistence); this only says how far it goes once saved: a 'local'
// field is never taken from another device, whatever enable_multidevice_persistence says.
// --------------------------------------------------------------------------------------
const ENTITY_FIELD_SCOPE = {
    type          : 'devices',
    color         : 'devices',
    fill          : 'devices',
    hidden        : 'local',
    interval      : 'devices',
    name          : 'devices',
    scale         : 'devices',
    siConversionFactor : 'devices',
    dashMode      : 'devices',
    lineMode      : 'devices',
    interpolation : 'devices',
    width         : 'devices',
    showPoints    : 'local',
    largeScreenTooltip : 'local',
    smallScreenTooltip : 'local',
    showMinMax    : 'devices',
    unit          : 'devices',
    process       : 'devices',
    netBars       : 'devices',
    circular      : 'devices',
    groupId       : 'devices',
};
const LOCAL_ONLY_FIELDS = Object.keys(ENTITY_FIELD_SCOPE).filter(f => ENTITY_FIELD_SCOPE[f] === 'local');

export class CardStorage
{
    // --------------------------------------------------------------------------------------
    // Dynamic data storage
    // --------------------------------------------------------------------------------------

    async writeLocalState()
    {
        // (never before Home Assistant's user data is read: what this device writes would
        // overwrite what another device saved there and this one hasn't seen yet — see
        // readLocalState)
        if( this._haSavedRead ) await this._haSavedRead;
        const data = this._keepLocal();

        // Write to HA user storage (persists across devices for same user). HA's image (ha_*)
        // is what HA holds: the value written once the write succeeded — this device's own
        // write never comes back as another device's change, and a newer change made here
        // meanwhile isn't undone by it. A write that failed leaves it as it was.
        try {
            await this._hass.callWS({ type: 'frontend/set_user_data', key: 'history-explorer_card_' + this.id, value: data });
            this._lastHaEntities         = data.entities;
            this._lastHaTimeRangeHours   = data.timeRangeHours;
            this._lastHaTimeRangeMinutes = data.timeRangeMinutes;
            this._lastHaZoomBox          = data.zoomBox;
            this._keepLocal();
        } catch(e) {}
    }

    // What this device saves (_savedNow) written on this device (localStorage — the source
    // of truth for change detection: it holds the sources' images) → what was written
    _keepLocal()
    {
        const data = this._savedNow();
        window.localStorage.removeItem('history-explorer-card');
        window.localStorage.setItem('history-explorer_card_' + this.id, JSON.stringify(data));
        return data;
    }
    // What this device saves (writeLocalState): its state as shown, and its images of the
    // sources — the YAML's and Home Assistant's, as last seen
    _savedNow()
    {
        return {
            // Active values
            // (an entity dropped where its placement isn't saved: saved where it was — see
            // moveCurve)
            entities            : this.store.savedList(),
            timeRangeHours      : this.activeRange.timeRangeHours,
            timeRangeMinutes    : this.activeRange.timeRangeMinutes,
            // (the magnifier's mode: kept as the time range is — _resolveZoomBox)
            zoomBox             : this.state.zoomBox,
            // YAML mirrors (last YAML value seen — detect YAML change across restarts)
            yaml_defaultTimeRange  : this.pconfig.yamlDefaultTimeRange,
            yaml_defaultInfoPanel  : this.pconfig.defaultInfoPanel,
            yaml_gestures          : this.pconfig.gestures,
            yaml_entities          : this._pureYamlEntities ?? this.store.statics(),
            // HA user mirrors (last HA user value seen on this device — detect inter-device changes)
            ha_entities         : this._lastHaEntities,
            ha_timeRangeHours   : this._lastHaTimeRangeHours,
            ha_timeRangeMinutes : this._lastHaTimeRangeMinutes,
            ha_zoomBox          : this._lastHaZoomBox,
            ha_infoPanelEnabled : this._lastHaInfoEnabled,
            ha_gestures         : this._lastHaGestures,
        };
    }

    // The saved state merged with the YAML, by the "last one to speak wins" rules: the
    // entities (each field, and the display order), the time range, the info panel's
    // switch, the gesture thresholds — each source compared with its own image, a change
    // (a front) applied and its image updated together (_restoreSaved, synchronous: one
    // never without the other). This device's own state first, shown at once: Home
    // Assistant's user data is read meanwhile, then merged the same way with the images as
    // they now are — only its own front can show there; what's shown is taken again from it
    // only when that changed it (showSaved). Nothing is written before it's read. A new
    // device (nothing saved here) waits for it.
    async readLocalState()
    {
        const _ls = this._readLocalSaved();
        const _haRead = this._readHaSaved();
        // (on its own, meanwhile — see there)
        this._registerInfoPanelDefault();
        if( !_ls ) {
            const _infoPanelChanged = this._restoreSaved(null, await _haRead);
            await this.writeLocalState();
            if( _infoPanelChanged ) this.applyInfoPanelState();
            return false;
        }
        this._haSavedRead = _haRead.then(ha => {
            const _list = this.store.list, _now = this._savedNow();
            // (merged again from the YAML as it is, not from what the first merge made of it;
            // what it gives compared with the same merge of Home Assistant as last seen: the
            // same — nothing from it changed what's shown)
            const _merged = h => {
                this.store.reset(JSON.parse(JSON.stringify(this._pureYamlEntities ?? [])));
                const _changed = this._restoreSaved(_now, h);
                return { shown: JSON.stringify([this.store.savedList(), this.activeRange.timeRangeHours, this.activeRange.timeRangeMinutes]), infoPanel: _changed };
            };
            const _seen = _merged(this._haAsLastSeen(_now)), _read = _merged(ha);
            if( _read.shown !== _seen.shown ) this.showSaved();
            // (nothing changed: the entries the graphs hold kept — the same values)
            else this.store.reset(_list);
            if( _read.infoPanel ) this.applyInfoPanelState();
        });
        // (then saved — writeLocalState waited for it until here)
        this._haSavedRead.then(() => { this._haSavedRead = null; this.writeLocalState(); });
        const _infoPanelChanged = this._restoreSaved(_ls, this._haAsLastSeen(_ls));
        if( _infoPanelChanged ) this.applyInfoPanelState();
        return false;
    }

    // Home Assistant's user data as this device last saw it (its images on this device)
    _haAsLastSeen(_ls)
    {
        return {
            haCard: _ls.ha_entities === undefined && _ls.ha_timeRangeHours === undefined ? null
                : { entities: _ls.ha_entities, timeRangeHours: _ls.ha_timeRangeHours, timeRangeMinutes: _ls.ha_timeRangeMinutes, zoomBox: _ls.ha_zoomBox },
            haInfoEnabled: _ls.ha_infoPanelEnabled ?? undefined,
            haGestures: _ls.ha_gestures ?? undefined,
        };
    }

    // This device's images of Home Assistant's user data (ha, else as _ls had them), for
    // the next writeLocalState
    _keepHaImages(_ls, { haCard: _haCard, haInfoEnabled: _haInfoEnabled, haGestures: _haGestures })
    {
        this._lastHaEntities         = _haCard?.entities        ?? _ls?.ha_entities        ?? null;
        this._lastHaTimeRangeHours   = _haCard?.timeRangeHours  ?? _ls?.ha_timeRangeHours  ?? null;
        this._lastHaTimeRangeMinutes = _haCard?.timeRangeMinutes?? _ls?.ha_timeRangeMinutes?? null;
        this._lastHaZoomBox          = _haCard?.zoomBox         ?? _ls?.ha_zoomBox         ?? null;
        this._lastHaInfoEnabled      = _haInfoEnabled            ?? _ls?.ha_infoPanelEnabled ?? null;
        this._lastHaGestures         = _haGestures               ?? _ls?.ha_gestures        ?? null;
    }

    // The saved state (_ls: this device's, with its images of the sources; ha: Home
    // Assistant's user data) merged with the YAML: each change applied and its source's image
    // updated, together — synchronous, nothing in between can stop one without the other.
    // → whether the info panel's switch changed (applyInfoPanelState: the caller's, after)
    _restoreSaved(_ls, { haCard: _haCard, haInfoEnabled: _haInfoEnabled, haGestures: _haGestures })
    {
        // The YAML as last seen — by this device, else (a new device: nothing stored here yet)
        // by the device that last saved to HA, which stored the same image: without it, a
        // new device would take the YAML as changed and let it win over everything saved.
        // Each source is only ever compared with its own image (its mirror): YAML with what
        // YAML said last time on this device, HA with what this device last knew of HA. On
        // this device's first load the YAML image is empty, so YAML has spoken here — it
        // wins, then reaches HA (and the other devices) like any other YAML change.
        const _yamlImage = _ls ?? _haCard;

        // A card with no static entities at all has nothing fixed to anchor to: its range
        // and its order default to persisted ('all') instead of the usual 'none' — same
        // reasoning as dynamic entities defaulting to 'all'
        const _noStatics = this.store.statics().length === 0;

        this._resolveEntities(_ls, _haCard, _yamlImage, _noStatics);
        this._resolveTimeRange(_ls, _haCard, _yamlImage, _noStatics);
        this._resolveZoomBox(_ls, _haCard, _noStatics);
        const _infoPanelChanged = this._resolveInfoPanel(_ls, _haInfoEnabled, _yamlImage);
        this._resolveGestures(_ls, _haGestures, _yamlImage);

        // Update HA user mirrors for next writeLocalState
        this._keepHaImages(_ls, { haCard: _haCard, haInfoEnabled: _haInfoEnabled, haGestures: _haGestures });

        return _infoPanelChanged;
    }

    // The widths the entity selector's lines needed the last time its list was built on this
    // device ({ most, all } — see entityLineWidths), or null: the toolbar laid out with them
    // before the list is built again. On this device only (its fonts)
    savedSelectorWidths()
    {
        return _readLocal('history-explorer_selector_' + this.id);
    }

    keepSelectorWidths(w)
    {
        try { window.localStorage.setItem('history-explorer_selector_' + this.id, JSON.stringify({ most: w.most, all: w.all })); } catch(e) {}
    }

    // The shorter forms of the entity selector's lines (shortNameForms), as computed the
    // last time on this device — { entity_id: { name, forms } }, or null: used at once,
    // before they're computed again. On this device only
    savedEntityForms()
    {
        return _readLocal('history-explorer_selector_forms_' + this.id);
    }

    keepEntityForms(forms)
    {
        try { window.localStorage.setItem('history-explorer_selector_forms_' + this.id, JSON.stringify(forms)); } catch(e) {}
    }

    // What was saved on this device (localStorage — the source of truth for change
    // detection, it holds all the mirrors), or null
    _readLocalSaved()
    {
        const _lsRaw = window.localStorage.getItem('history-explorer_card_' + this.id);
        return _lsRaw ? JSON.parse(_lsRaw) : null;
    }

    // What Home Assistant's user data holds (may come from another device): the card's, the
    // info panel's switch, the gesture thresholds — read together
    async _readHaSaved()
    {
        const _get = key => this._hass.callWS({ type: 'frontend/get_user_data', key }).then(r => r?.value, () => undefined);
        const [_card, _ipe, _g] = await Promise.all([_get('history-explorer_card_' + this.id), _get(INFO_PANEL_SWITCH_KEY), _get(GESTURES_KEY)]);
        return {
            haCard: _card || null,
            haInfoEnabled: _ipe?.enabled !== undefined ? !!_ipe.enabled : undefined,
            haGestures: _g || undefined,
        };
    }

    // Is persistence category (range, entities, order) on, by the card's options —
    // { multi: on every device, local: on this device }, each defaulting to on when
    // defaultAll and the option isn't set (see _resolvePersistenceDefault)
    _cardPersists(category, defaultAll)
    {
        const _on = raw => this._resolvePersistenceDefault(raw, ['range', 'entities', 'order'], defaultAll).has(category);
        return { multi: _on(this.pconfig.enableMultidevicePersistence), local: _on(this.pconfig.enablePersistence) };
    }

    // --- Last one to speak wins — entities, resolved per entity (per curve: an entity's
    // second curve in another graph — see keyOf — is resolved on its own) ---
    // YAML source: static entities from pconfig (initialized from YAML before this call).
    //              Always wins for a given entity when changed — never blocked.
    // HA user source: compared to ha_entities mirror in localStorage — may come from
    //              another device. Blocked per entity via disable_multidevice_persistence
    //              (entity-level `disable_multidevice_persistence`, falling back to the
    //              card-level option) — a device then never adopts another device's HA
    //              value for that entity, though it still keeps writing its own local changes.
    // UI source: localStorage active value — wins if no YAML or (unblocked) HA front.
    _resolveEntities(_ls, _haCard, _yamlImage, _noStaticsDefaultAll)
    {
        const _lsEntities   = (_ls?.entities ?? []).map(e => typeof e === 'string' ? { entity: e } : e);
        const _haEntities   = (_haCard?.entities ?? []).map(e => typeof e === 'string' ? { entity: e } : e);
        const _yamlEntities = this.store.statics();
        // Saved as-is (pure, pre-merge) for writeLocalState — the yaml_entities mirror must
        // reflect only what YAML said, uncontaminated by whichever field values HA/local
        // ended up winning below, or the YAML-changed detection breaks: a field overridden
        // once by HA/local would get baked into the mirror, permanently masking later
        // genuine YAML edits to that same field.
        // (a copy: the entries themselves go on living in the card — also what the card goes
        // back to, see defaultDisplay)
        this._pureYamlEntities = JSON.parse(JSON.stringify(_yamlEntities));
        const _yamlMirror   = _yamlImage?.yaml_entities ?? [];
        const _haMirror     = _ls?.ha_entities ?? [];
        const _ids = (list, isStatic) => list.filter(e => !!e.isStatic === isStatic).map(keyOf);

        // Union of entity ids to resolve: current YAML statics, always. A genuinely dynamic
        // entity (isStatic falsy, known only from localStorage or HA) has no YAML entry to
        // fall back to, so — unlike static entities — it defaults to full persistence
        // ('all') when the card-level option isn't configured at all, restoring the
        // pre-1.1.32 behavior; an explicit `enable_multidevice_persistence: none` (or
        // `enable_persistence: none`) opts back out. A static entity removed from YAML is
        // dropped either way — never resurrected from a stale local/HA snapshot.
        const _dynamicEntities = this._cardPersists('entities', true);

        // Display order (which id comes before which — not a per-entity field, see 'order'
        // in _resolveOrder) follows the same last-one-to-speak-wins priority as anything
        // else, resolved separately for statics (YAML order as the base, default 'none'
        // unless the card has no statics at all — same rule as range) and dynamics (no YAML
        // order concept, default 'all' like their own field persistence).
        const _dynamicOrder = this._cardPersists('order', true);
        const _staticOrder = this._cardPersists('order', _noStaticsDefaultAll);

        const _yamlIds = _yamlEntities.map(keyOf);
        const _staticIds = this._resolveOrder(
            _yamlIds, _yamlIds, _yamlMirror.map(keyOf),
            _ids(_haEntities, true), _ids(_haMirror, true), _ids(_lsEntities, true),
            _staticOrder.multi || _staticOrder.local, _staticOrder.multi
        );

        // Dynamic entities another device added only reach this device if multi-device
        // persistence covers entities — with enable_persistence alone, this device only
        // ever knows the ones it added itself.
        // Removed on another device (last one to speak): an entity this device had already
        // seen in HA (in its HA mirror) but that's gone from HA now was deleted elsewhere —
        // dropped here too. One missing from both is a local addition not synced yet — kept.
        const _haIdsNow    = new Set(_haEntities.map(keyOf));
        const _haIdsMirror = new Set(_haMirror.map(keyOf));
        const _removedElsewhere = id => _dynamicEntities.multi && _haCard !== null && _haIdsMirror.has(id) && !_haIdsNow.has(id);
        const _dynamicCandidates = [...new Set([
            ..._ids(_lsEntities, false).filter(id => !_removedElsewhere(id)),
            ...( _dynamicEntities.multi ? _ids(_haEntities, false) : [] ),
        ])];
        const _dynamicIds = this._resolveOrder(
            _dynamicCandidates, null, null,
            _ids(_haEntities, false), _ids(_haMirror, false), _ids(_lsEntities, false),
            _dynamicOrder.multi || _dynamicOrder.local, _dynamicOrder.multi
        );

        const _entityIds = new Set([
            ..._staticIds,
            ...(( _dynamicEntities.multi || _dynamicEntities.local ) ? _dynamicIds : []),
        ]);

        const _find = (arr, key) => arr.find(e => keyOf(e) === key);
        this.store.reset([..._entityIds].map(id => this._resolveEntity(
            _find(_yamlEntities, id), _find(_yamlMirror, id), _find(_haEntities, id), _find(_haMirror, id), _find(_lsEntities, id))));

        // Group ids left wrong by older versions repaired; next free dynamic group id set
        this.store.normalizeGroupIds(e => e.type ?? this.detectDefaultType(e.entity).type);
    }

    // One entity's entry, from its YAML entry and its image, its HA entry and its image, and
    // its entry on this device
    _resolveEntity(_yamlE, _yamlImageE, _haE, _haImageE, _lsE)
    {
        // YAML front — per entity, always wins on change, unaffected by the enable flags
        // (a copy — the live entry gets mutated later, e.g. graphKey, and _yamlE itself
        // is also the pure YAML mirror saved by writeLocalState)
        if( _yamlE && JSON.stringify(_yamlE) !== JSON.stringify(_yamlImageE ?? null) )
            return { ..._yamlE };

        // Resolve which fields have persistence enabled at all — entity-level first,
        // falling back to the card-level 'entities' switch, itself defaulting to 'all'
        // for a dynamic entity (no YAML to fall back to) or 'none' for a static one (see
        // _resolvePersistenceDefault) when the card-level option isn't configured at all.
        // enable_multidevice_persistence additionally allows the HA/cross-device front to
        // win for its fields; enable_persistence only allows this device's own local
        // storage — multidevice always wins over local for whatever it covers, since a
        // field enabled by either ends up in _enabledFields regardless, while only
        // _multiFields fields can also be won by the HA front below.
        const { multi: _multiFields, local: _localFields } = this._persistedFieldSets(_yamlE);
        const _enabledFields = new Set([..._multiFields, ..._localFields]);

        const _haChanged = _haE && JSON.stringify(_haE) !== JSON.stringify(_haImageE ?? null);
        const _localE = _lsE ?? _yamlE ?? _haE;

        // Base: the YAML value for every field — nothing persists unless explicitly
        // enabled. Then layer in the local value for fields with some persistence
        // enabled, then further layer in the HA value for the multidevice-enabled subset
        // if it actually changed. A dynamic entity has no YAML value; its base is the
        // local/HA snapshot instead — it only exists here at all because persistence was
        // enabled for it (see _resolveEntities), so there's always something to base on.
        const _result = _yamlE ? { ..._yamlE } : { ..._localE };
        // A field missing from a stored entry is a field that was cleared (e.g. hidden
        // back to visible drops 'hidden' from the saved JSON) — taken over as cleared
        // too, not skipped: skipping it would silently lose that source's change.
        const _take = (_src, _f) => {
            if( _src[_f] === undefined ) delete _result[_f];
            else _result[_f] = _src[_f];
        };
        for( const _f of _enabledFields )
            if( _localE ) _take(_localE, _f);
        if( _haChanged )
            for( const _f of _multiFields )
                _take(_haE, _f);
        // graphKey (which linked graph of its group the entity is shown in — see
        // splitCurve) isn't a field of its own: it's part of the grouping, so it
        // follows whichever source won groupId above. graphIndex is NOT taken over per
        // entity: it's a position relative to the other graphs of the block, so taking
        // it from different sources for different entities would mix two coordinate
        // systems and shuffle the block. The order inside a block is carried by the
        // entities' order instead (resolved as a whole, see 'order' — and kept in step
        // with the display by _syncGroupOrder).
        // A field kept on this device only: this device's own value when saved here, else
        // the YAML's — never one that came from another device
        for( const _f of LOCAL_ONLY_FIELDS ) {
            if( _lsE && _localFields.has(_f) ) continue;
            if( _yamlE?.[_f] !== undefined ) _result[_f] = _yamlE[_f];
            else delete _result[_f];
        }
        const _keySrc = ( _haChanged && _multiFields.has('groupId') ) ? _haE :
                        ( _enabledFields.has('groupId') ? _localE : null );
        if( _keySrc ) {
            if( _keySrc.graphKey !== undefined ) _result.graphKey = _keySrc.graphKey;
            else delete _result.graphKey;
        }
        return _result;
    }

    // --- Last one to speak wins — the time range ---
    // Persisted by default only on a card without static entities (noStatics)
    _resolveTimeRange(_ls, _haCard, _yamlImage, noStatics)
    {
        const _range = this._cardPersists('range', noStatics);
        // HA user front (compare HA user value to its mirror in localStorage)
        const _haTimeChanged = _range.multi &&
            _haCard?.timeRangeHours !== undefined && (
            _haCard.timeRangeHours   !== _ls?.ha_timeRangeHours ||
            _haCard.timeRangeMinutes !== _ls?.ha_timeRangeMinutes
        );
        // YAML front — compared with the YAML image only
        const _yamlTimeChanged = this.pconfig.yamlDefaultTimeRange !== undefined &&
                                 this.pconfig.yamlDefaultTimeRange !== _yamlImage?.yaml_defaultTimeRange;

        if( !_range.multi && !_range.local ) {
            // Nothing enabled for range — nothing persists, always the YAML default
            this.setTimeRangeFromString(this.pconfig.defaultTimeRange);
        } else if( _yamlTimeChanged || _haTimeChanged ) {
            // YAML wins if both changed
            if( _yamlTimeChanged ) {
                this.setTimeRangeFromString(this.pconfig.defaultTimeRange);
            } else {
                // HA user wins (only reachable when enable_multidevice_persistence covers range)
                if( _haCard.timeRangeHours > 0 )
                    this.applyTimeRange(this.validateRange(_haCard.timeRangeHours, true));
                else if( _haCard.timeRangeMinutes > 0 )
                    this.applyTimeRangeMinutes(_haCard.timeRangeMinutes);
            }
        } else {
            // Local restore — reachable since at least one of the two options is enabled
            if( _ls?.timeRangeHours > 0 )
                this.applyTimeRange(this.validateRange(_ls.timeRangeHours, true));
            else if( _ls?.timeRangeMinutes > 0 )
                this.applyTimeRangeMinutes(_ls.timeRangeMinutes);
        }
    }

    // --- Last one to speak wins — the magnifier's mode ---
    // Kept as the time range is (_cardPersists('range')): Home Assistant's value when it
    // changed (persisted across devices), else this device's; nothing kept: both axes
    _resolveZoomBox(_ls, _haCard, noStatics)
    {
        const _range = this._cardPersists('range', noStatics);
        const _haChanged = _range.multi && _haCard?.zoomBox !== undefined && _haCard.zoomBox !== _ls?.ha_zoomBox;
        const _mode = _haChanged ? _haCard.zoomBox : ( _range.multi || _range.local ) ? _ls?.zoomBox : undefined;
        this.setZoomBoxMode(_mode ?? 'xy', false);
    }

    // --- Last one to speak wins — the info panel's switch ---
    // Its YAML value (defaultInfoPanel) and its HA value each compared with their image,
    // YAML winning if both changed. Returns whether the switch changed here.
    _resolveInfoPanel(_ls, _haInfoEnabled, _yamlImage)
    {
        const _haInfoChanged = _haInfoEnabled !== undefined &&
                               _haInfoEnabled !== _ls?.ha_infoPanelEnabled;
        const _yamlInfoChanged = this.pconfig.defaultInfoPanel !== undefined &&
                                 this.pconfig.defaultInfoPanel !== _yamlImage?.yaml_defaultInfoPanel;
        // (neither changed: the switch stays as read from localStorage when the module loaded)
        if( !_yamlInfoChanged && !_haInfoChanged ) return false;

        const _active = _yamlInfoChanged ? !!this.pconfig.defaultInfoPanel : _haInfoEnabled;
        if( _active === infoPanelEnabled ) return false;
        infoPanelEnabled = _active;
        return true;
    }

    // --- Last one to speak wins — the gesture thresholds (super-global) ---
    // Each of them on its own: its YAML value (gestures:) and its HA value (set from the
    // options menu, on any device, by any card) each compared with their image, YAML
    // winning if both changed; else it stays as this device has it
    _resolveGestures(_ls, _haGestures, _yamlImage)
    {
        const _set = {};
        for( const k in GESTURE_SETTINGS ) {
            const _yaml = this.pconfig.gestures?.[k];
            const _yamlChanged = _yaml !== undefined && _yaml !== _yamlImage?.yaml_gestures?.[k];
            const _ha = _haGestures?.[k];
            const _haChanged = _ha !== undefined && _ha !== _ls?.ha_gestures?.[k];
            if( _yamlChanged ) _set[k] = _yaml;
            else if( _haChanged ) _set[k] = _ha;
        }
        keepGestures(_set);
    }

    // A gesture threshold set from the options menu: on this device, and in Home
    // Assistant's user data for every other device (and card)
    setGesture(name, value)
    {
        keepGestures({ [name]: value });
        // (HA's image: what it holds, once written — see writeLocalState)
        const _v = localGestures();
        this._hass.callWS({ type: 'frontend/set_user_data', key: GESTURES_KEY, value: _v })
            .then(() => { this._lastHaGestures = _v; this._keepLocal(); }, () => {});
    }

    // Register defaultInfoPanel with HA user key and detect conflicts across cards.
    // This re-registers with a fresh timestamp on every load, unconditionally — that's
    // required for cleanup of stale/removed cards to work at all (deleting a card/view
    // generates no HA event, so only surviving cards reasserting themselves can ever
    // detect and clean up a stale entry). Independent of _resolveInfoPanel.
    async _registerInfoPanelDefault()
    {
        try {
            const _ipe2 = await this._hass.callWS({ type: 'frontend/get_user_data', key: INFO_PANEL_SWITCH_KEY });
            const _globalData = _ipe2?.value || {};
            if( !_globalData.registry ) _globalData.registry = {};

            const _yamlActiveVal = this.pconfig.defaultInfoPanel;
            let _registryChanged = false;

            if( _yamlActiveVal === undefined ) {
                if( this.id in _globalData.registry ) {
                    delete _globalData.registry[this.id];
                    _registryChanged = true;
                }
            } else {
                _globalData.registry[this.id] = { value: _yamlActiveVal, ts: Date.now() };
                _registryChanged = true;

                const _entries = Object.entries(_globalData.registry);
                const _vals = _entries.map(([, e]) => e.value);
                const _hasConflict = _vals.some(v => v !== _vals[0]);
                if( _hasConflict ) {
                    const _conflictList = _entries.map(([id, e]) => id + ': ' + e.value).join('\n');
                    alert(i18n('ui.label.infopanel_conflict') + '\n' + _conflictList);
                    const _conflicting = _entries.filter(([id, e]) => id !== this.id && e.value !== _yamlActiveVal);
                    if( _conflicting.length ) {
                        const _oldest = _conflicting.reduce((a, b) => a[1].ts < b[1].ts ? a : b);
                        delete _globalData.registry[_oldest[0]];
                    }
                }
            }

            if( _registryChanged ) {
                await this._hass.callWS({ type: 'frontend/set_user_data', key: INFO_PANEL_SWITCH_KEY, value: _globalData });
            }
        } catch(e) {}
    }
    // The fields of an entity whose value is saved: { multi (on every device), local (on
    // this device) } — the YAML entity's own enable_* options (staticEntry), else the card's
    // 'entities' switch, which defaults to every field for an entity added from the card
    // (no YAML value to fall back to) and to none for a YAML one
    _persistedFieldSets(staticEntry)
    {
        const _resolve = (_entityFields, _cardRaw) => {
            if( _entityFields !== undefined ) return _entityFields;
            const _cardSet = this._resolvePersistenceDefault(_cardRaw, ['range', 'entities', 'order'], !staticEntry);
            return _cardSet.has('entities') ? new Set(this._entityPersistenceFields()) : new Set();
        };
        // (a field kept on this device only — see ENTITY_FIELD_SCOPE: never taken from
        // another device, whatever the options)
        const _multi = new Set(_resolve(staticEntry?.enableMultidevicePersistence, this.pconfig.enableMultidevicePersistence));
        for( const _f of LOCAL_ONLY_FIELDS ) _multi.delete(_f);
        return { multi: _multi, local: _resolve(staticEntry?.enablePersistence, this.pconfig.enablePersistence) };
    }

    // Is what graph g holds — its entities' group — saved? A YAML graph's (one holding a
    // YAML entity) follows that entity's options — not saved, by default; a graph added
    // from the card is
    graphPlacementPersisted(g)
    {
        const _e = g.entities.find(e => e.isStatic);
        const { multi, local } = this._persistedFieldSets(_e ?? null);
        return multi.has('groupId') || local.has('groupId');
    }

    // The info panel switched on or off (the options menu): on every device, and saved where
    // the panel reads it
    toggleInfoPanel()
    {
        infoPanelEnabled = !infoPanelEnabled;
        // (HA's image: what it holds, once written — see writeLocalState)
        const _v = infoPanelEnabled;
        this._hass.callWS({ type: 'frontend/set_user_data', key: INFO_PANEL_SWITCH_KEY, value: { enabled: _v } })
            .then(() => { this._lastHaInfoEnabled = _v; this._keepLocal(); }, () => {});
        this.applyInfoPanelState();
    }

    // The panel switched on or off (here, or on another device): saved where the panel reads
    // it at each render — it applies the next time an entity's dialog shows its history,
    // without reloading the page
    applyInfoPanelState()
    {
        if( infoPanelEnabled !== !!infoPanelData() ) this.writeInfoPanelConfig(true);
    }

    // The info panel's config (the card's infoPanelConfig) saved where the panel reads it —
    // removed when it's off
    async writeInfoPanelConfig(forceUpdate = false)
    {
        if( !infoPanelEnabled ) {
            window.localStorage.removeItem(INFO_PANEL_KEY);
            try { await this._hass.callWS({ type: 'frontend/set_user_data', key: INFO_PANEL_KEY, value: null }); } catch(e) {}
        } else if( infoPanelEnabled && (this.pconfig.infoPanelConfig || forceUpdate) ) {
            let _data = {};
            _data.enabled = true;
            _data.config = this.pconfig.infoPanelConfig;
            window.localStorage.setItem(INFO_PANEL_KEY, JSON.stringify(_data));
            try { await this._hass.callWS({ type: 'frontend/set_user_data', key: INFO_PANEL_KEY, value: _data }); } catch(e) {}
        }
    }

    // --------------------------------------------------------------------------------------
    // Persistence scopes
    // --------------------------------------------------------------------------------------

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

    // Fields of a static entity that enable_persistence/enable_multidevice_persistence can
    // individually cover via a per-entity field list.
    _entityPersistenceFields()
    {
        return Object.keys(ENTITY_FIELD_SCOPE);
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
}
