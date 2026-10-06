// What the card keeps between sessions and devices: its local state, Home Assistant's
// user data and the YAML configuration, merged by the "last one to speak wins" rules
// (readLocalState / writeLocalState). Part of HistoryCardState (added to it in
// history-explorer-card.js).

import { i18n } from "./languages.js";
import { infoPanelEnabled, setInfoPanelEnabled } from "./history-explorer-card.js";

export class CardStorage
{
    // --------------------------------------------------------------------------------------
    // Dynamic data storage
    // --------------------------------------------------------------------------------------

    async writeLocalState()
    {
        // HA's image (ha_* below) is deliberately NOT updated with what this device writes:
        // it's only ever updated from what HA itself returns (readLocalState). The write
        // below is asynchronous and may land late or not at all (connection lost, page
        // reloaded first) — had the image already taken the new value, HA still returning
        // the old one would look like a front of HA, and revert this device's own change.
        // This device's own write comes back later as an HA front carrying the value it
        // already has: applying it changes nothing.
        const data = {
            // Active values
            // (an entity dropped where its placement isn't saved: saved where it was — see
            // _moveEntity)
            entities            : this.store.savedList(),
            timeRangeHours      : this.activeRange.timeRangeHours,
            timeRangeMinutes    : this.activeRange.timeRangeMinutes,
            // YAML mirrors (last YAML value seen — detect YAML change across restarts)
            yaml_defaultTimeRange  : this.pconfig.yamlDefaultTimeRange,
            yaml_defaultInfoPanel  : this.pconfig.defaultInfoPanel,
            yaml_entities          : this._pureYamlEntities ?? this.store.statics(),
            // HA user mirrors (last HA user value seen on this device — detect inter-device changes)
            ha_entities         : this._lastHaEntities,
            ha_timeRangeHours   : this._lastHaTimeRangeHours,
            ha_timeRangeMinutes : this._lastHaTimeRangeMinutes,
            ha_infoPanelEnabled : this._lastHaInfoEnabled,
        };
        const _json = JSON.stringify(data);

        // Write to localStorage (source of truth for change detection)
        window.localStorage.removeItem('history-explorer-card');
        window.localStorage.removeItem('history-explorer_card_' + this.id);
        window.localStorage.setItem('history-explorer_card_' + this.id, _json);

        // Write to HA user storage (persists across devices for same user)
        try {
            await this._hass.callWS({ type: 'frontend/set_user_data', key: 'history-explorer_card_' + this.id, value: data });
        } catch(e) {}
    }
    // The saved state merged with the YAML, by the "last one to speak wins" rules: the
    // entities (each field, and the display order), the time range, the info panel's switch
    async readLocalState()
    {
        const { ls: _ls, haCard: _haCard, haInfoEnabled: _haInfoEnabled } = await this._readSavedSources();

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
        const _infoPanelChanged = this._resolveInfoPanel(_ls, _haInfoEnabled, _yamlImage);

        // Update HA user mirrors for next writeLocalState
        this._lastHaEntities         = _haCard?.entities        ?? _ls?.ha_entities        ?? null;
        this._lastHaTimeRangeHours   = _haCard?.timeRangeHours  ?? _ls?.ha_timeRangeHours  ?? null;
        this._lastHaTimeRangeMinutes = _haCard?.timeRangeMinutes?? _ls?.ha_timeRangeMinutes?? null;
        this._lastHaInfoEnabled      = _haInfoEnabled            ?? _ls?.ha_infoPanelEnabled ?? null;

        await this._registerInfoPanelDefault();

        // Persist updated state (mirrors included) before any potential reload
        await this.writeLocalState();

        // Apply infoPanel state last, after everything (including writeLocalState) is done
        if( _infoPanelChanged ) {
            this.applyInfoPanelState();
        }

        return false; // interval redraw handled via pconfig.entities in createContent
    }

    // What was saved: on this device (localStorage — the source of truth for change
    // detection, it holds all the mirrors), in Home Assistant's user data (may come from
    // another device), and the info panel's switch there
    async _readSavedSources()
    {
        const _lsRaw = window.localStorage.getItem('history-explorer_card_' + this.id);
        const ls = _lsRaw ? JSON.parse(_lsRaw) : null;

        let haCard = null;
        try {
            const _result = await this._hass.callWS({ type: 'frontend/get_user_data', key: 'history-explorer_card_' + this.id });
            if( _result?.value ) haCard = _result.value;
        } catch(e) {}

        let haInfoEnabled = undefined;
        try {
            const _ipe = await this._hass.callWS({ type: 'frontend/get_user_data', key: 'history-explorer-infopanel-enabled' });
            if( _ipe?.value?.enabled !== undefined ) haInfoEnabled = !!_ipe.value.enabled;
        } catch(e) {}

        return { ls, haCard, haInfoEnabled };
    }

    // Is persistence category (range, entities, order) on, by the card's options —
    // { multi: on every device, local: on this device }, each defaulting to on when
    // defaultAll and the option isn't set (see _resolvePersistenceDefault)
    _cardPersists(category, defaultAll)
    {
        const _on = raw => this._resolvePersistenceDefault(raw, ['range', 'entities', 'order'], defaultAll).has(category);
        return { multi: _on(this.pconfig.enableMultidevicePersistence), local: _on(this.pconfig.enablePersistence) };
    }

    // --- Last one to speak wins — entities, resolved per entity ---
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
        this._pureYamlEntities = _yamlEntities;
        const _yamlMirror   = _yamlImage?.yaml_entities ?? [];
        const _haMirror     = _ls?.ha_entities ?? [];
        const _ids = (list, isStatic) => list.filter(e => !!e.isStatic === isStatic).map(e => e.entity);

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

        const _yamlIds = _yamlEntities.map(e => e.entity);
        const _staticIds = this._resolveOrder(
            _yamlIds, _yamlIds, _yamlMirror.map(e => e.entity),
            _ids(_haEntities, true), _ids(_haMirror, true), _ids(_lsEntities, true),
            _staticOrder.multi || _staticOrder.local, _staticOrder.multi
        );

        // Dynamic entities another device added only reach this device if multi-device
        // persistence covers entities — with enable_persistence alone, this device only
        // ever knows the ones it added itself.
        // Removed on another device (last one to speak): an entity this device had already
        // seen in HA (in its HA mirror) but that's gone from HA now was deleted elsewhere —
        // dropped here too. One missing from both is a local addition not synced yet — kept.
        const _haIdsNow    = new Set(_haEntities.map(e => e.entity));
        const _haIdsMirror = new Set(_haMirror.map(e => e.entity));
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

        const _find = (arr, id) => arr.find(e => e.entity === id);
        this.store.list = [..._entityIds].map(id => this._resolveEntity(
            _find(_yamlEntities, id), _find(_yamlMirror, id), _find(_haEntities, id), _find(_haMirror, id), _find(_lsEntities, id)));

        // Group ids left wrong by older versions repaired; next free dynamic group id set
        this.store.normalizeGroupIds(e => e.type ?? this._detectDefaultType(e.entity).type);
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
        // _uncombineEntity) isn't a field of its own: it's part of the grouping, so it
        // follows whichever source won groupId above. graphIndex is NOT taken over per
        // entity: it's a position relative to the other graphs of the block, so taking
        // it from different sources for different entities would mix two coordinate
        // systems and shuffle the block. The order inside a block is carried by the
        // entities' order instead (resolved as a whole, see 'order' — and kept in step
        // with the display by _syncGroupOrder).
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
                                 String(this.pconfig.yamlDefaultTimeRange) !== String(_yamlImage?.yaml_defaultTimeRange);

        if( !_range.multi && !_range.local ) {
            // Nothing enabled for range — nothing persists, always the YAML default
            this.setTimeRangeFromString(String(this.pconfig.defaultTimeRange));
        } else if( _yamlTimeChanged || _haTimeChanged ) {
            // YAML wins if both changed
            if( _yamlTimeChanged ) {
                this.setTimeRangeFromString(String(this.pconfig.defaultTimeRange));
            } else {
                // HA user wins (only reachable when enable_multidevice_persistence covers range)
                if( _haCard.timeRangeHours > 0 )
                    this.setTimeRange(this.validateRange(_haCard.timeRangeHours, true));
                else if( _haCard.timeRangeMinutes > 0 )
                    this.setTimeRangeMinutes(_haCard.timeRangeMinutes);
            }
        } else {
            // Local restore — reachable since at least one of the two options is enabled
            if( _ls?.timeRangeHours > 0 )
                this.setTimeRange(this.validateRange(_ls.timeRangeHours, true));
            else if( _ls?.timeRangeMinutes > 0 )
                this.setTimeRangeMinutes(_ls.timeRangeMinutes);
        }

        // Sync time.min/time.max on all charts so determineDataLimits is constrained
        // by the active time window before any updateHistory call (prevents stale data
        // from previous session from extending the X axis range)
        for( let g of this.graphs ) {
            g.chart.options.scales.xAxes[0].time.min = this.startTime;
            g.chart.options.scales.xAxes[0].time.max = this.endTime;
        }
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
        setInfoPanelEnabled(_active);
        return true;
    }

    // Register defaultInfoPanel with HA user key and detect conflicts across cards.
    // This re-registers with a fresh timestamp on every load, unconditionally — that's
    // required for cleanup of stale/removed cards to work at all (deleting a card/view
    // generates no HA event, so only surviving cards reasserting themselves can ever
    // detect and clean up a stale entry). Independent of _resolveInfoPanel.
    async _registerInfoPanelDefault()
    {
        try {
            const _ipe2 = await this._hass.callWS({ type: 'frontend/get_user_data', key: 'history-explorer-infopanel-enabled' });
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
                await this._hass.callWS({ type: 'frontend/set_user_data', key: 'history-explorer-infopanel-enabled', value: _globalData });
            }

            // Update info panel menu label
            for( let i = 0; i < 2; i++ ) {
                const ei = this._this.querySelector(`#ei_${i}`);
                if( ei ) ei.innerHTML = infoPanelEnabled ? i18n('ui.menu.disable_panel') : i18n('ui.menu.enable_panel');
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
        return { multi: _resolve(staticEntry?.enableMultidevicePersistence, this.pconfig.enableMultidevicePersistence),
                 local: _resolve(staticEntry?.enablePersistence, this.pconfig.enablePersistence) };
    }

    // Is what graph g holds — its entities' group — saved? A YAML graph's (one holding a
    // YAML entity) follows that entity's options — not saved, by default; a graph added
    // from the card is
    _graphPlacementPersisted(g)
    {
        const _e = g.entities.find(e => e.isStatic);
        const { multi, local } = this._persistedFieldSets(_e ?? null);
        return multi.has('groupId') || local.has('groupId');
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
        return ['type', 'color', 'fill', 'hidden', 'interval', 'name', 'scale', 'siConversionFactor',
                'dashMode', 'lineMode', 'interpolation', 'width', 'showPoints', 'showMinMax', 'unit', 'process',
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
