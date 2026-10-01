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
            entities            : this.pconfig.entities,
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
    async readLocalState()
    {
        // Read localStorage (source of truth for change detection — contains all mirrors)
        const _lsRaw = window.localStorage.getItem('history-explorer_card_' + this.id);
        const _ls = _lsRaw ? JSON.parse(_lsRaw) : null;

        // Read HA user storage for card state (timeRange, entities — may come from another device)
        let _haCard = null;
        try {
            const _result = await this._hass.callWS({ type: 'frontend/get_user_data', key: 'history-explorer_card_' + this.id });
            if( _result?.value ) _haCard = _result.value;
        } catch(e) {}

        // Read HA user storage for infoPanelEnabled (may come from another device)
        let _haInfoEnabled = undefined;
        try {
            const _ipe = await this._hass.callWS({ type: 'frontend/get_user_data', key: 'history-explorer-infopanel-enabled' });
            if( _ipe?.value?.enabled !== undefined ) _haInfoEnabled = !!_ipe.value.enabled;
        } catch(e) {}

        // --- Last one to speak wins — entities, resolved per entity ---
        // YAML source: static entities from pconfig (initialized from YAML before this call).
        //              Always wins for a given entity when changed — never blocked.
        // HA user source: compared to ha_entities mirror in localStorage — may come from
        //              another device. Blocked per entity via disable_multidevice_persistence
        //              (entity-level `disable_multidevice_persistence`, falling back to the
        //              card-level option) — a device then never adopts another device's HA
        //              value for that entity, though it still keeps writing its own local changes.
        // UI source: localStorage active value — wins if no YAML or (unblocked) HA front.
        const _lsEntities   = (_ls?.entities ?? []).map(e => typeof e === 'string' ? { entity: e } : e);
        const _haEntities   = (_haCard?.entities ?? []).map(e => typeof e === 'string' ? { entity: e } : e);
        const _yamlEntities = this.store.statics();
        // Shared by range and order below: a card with no static entities at all has nothing
        // fixed to anchor to, so both default to 'all' (persist by default) instead of the
        // usual 'none' — same reasoning as dynamic entities defaulting to 'all'.
        const _noStaticsDefaultAll = _yamlEntities.length === 0;
        // Saved as-is (pure, pre-merge) for writeLocalState — the yaml_entities mirror must
        // reflect only what YAML said, uncontaminated by whichever field values HA/local
        // ended up winning below, or the YAML-changed detection breaks: a field overridden
        // once by HA/local would get baked into the mirror, permanently masking later
        // genuine YAML edits to that same field.
        this._pureYamlEntities = _yamlEntities;
        // Each source is only ever compared with its own image (its mirror): YAML with what
        // YAML said last time on this device, HA with what this device last knew of HA. On
        // this device's first load the YAML image is empty, so YAML has spoken here — it
        // wins, then reaches HA (and the other devices) like any other YAML change.
        const _yamlMirror   = _ls?.yaml_entities ?? [];
        const _haMirror     = _ls?.ha_entities ?? [];

        const _findEntity = (arr, id) => arr.find(e => e.entity === id);

        // Union of entity ids to resolve: current YAML statics, always. A genuinely dynamic
        // entity (isStatic falsy, known only from localStorage or HA) has no YAML entry to
        // fall back to, so — unlike static entities — it defaults to full persistence
        // ('all') when the card-level option isn't configured at all, restoring the
        // pre-1.1.32 behavior; an explicit `enable_multidevice_persistence: none` (or
        // `enable_persistence: none`) opts back out. A static entity removed from YAML is
        // dropped either way — never resurrected from a stale local/HA snapshot.
        const _dynamicEntitiesAllowed =
            this._resolvePersistenceDefault(this.pconfig.enableMultidevicePersistence, ['range', 'entities', 'order'], true).has('entities') ||
            this._resolvePersistenceDefault(this.pconfig.enablePersistence, ['range', 'entities', 'order'], true).has('entities');

        // Display order (which id comes before which — not a per-entity field, see 'order'
        // in _resolveOrder above) follows the same last-one-to-speak-wins priority as
        // anything else, resolved separately for statics (YAML order as the base, default
        // 'none' unless the card has no statics at all — same rule as range) and dynamics
        // (no YAML order concept, default 'all' like their own field persistence).
        const _dynamicOrderMultidevice = this._resolvePersistenceDefault(this.pconfig.enableMultidevicePersistence, ['range', 'entities', 'order'], true).has('order');
        const _dynamicOrderEnabled =
            _dynamicOrderMultidevice ||
            this._resolvePersistenceDefault(this.pconfig.enablePersistence, ['range', 'entities', 'order'], true).has('order');
        const _staticOrderMultidevice = this._resolvePersistenceDefault(this.pconfig.enableMultidevicePersistence, ['range', 'entities', 'order'], _noStaticsDefaultAll).has('order');
        const _staticOrderEnabled =
            _staticOrderMultidevice ||
            this._resolvePersistenceDefault(this.pconfig.enablePersistence, ['range', 'entities', 'order'], _noStaticsDefaultAll).has('order');

        const _yamlIds = _yamlEntities.map(e => e.entity);
        const _staticOrder = this._resolveOrder(
            _yamlIds, _yamlIds, _yamlMirror.map(e => e.entity),
            _haEntities.filter(e => e.isStatic).map(e => e.entity),
            (_ls?.ha_entities ?? []).filter(e => e.isStatic).map(e => e.entity),
            _lsEntities.filter(e => e.isStatic).map(e => e.entity),
            _staticOrderEnabled, _staticOrderMultidevice
        );

        // Dynamic entities another device added only reach this device if multi-device
        // persistence covers entities — with enable_persistence alone, this device only
        // ever knows the ones it added itself.
        const _dynamicMultidevice = this._resolvePersistenceDefault(this.pconfig.enableMultidevicePersistence, ['range', 'entities', 'order'], true).has('entities');
        // Removed on another device (last one to speak): an entity this device had already
        // seen in HA (in its HA mirror) but that's gone from HA now was deleted elsewhere —
        // dropped here too. One missing from both is a local addition not synced yet — kept.
        const _haIdsNow    = new Set(_haEntities.map(e => e.entity));
        const _haIdsMirror = new Set(_haMirror.map(e => e.entity));
        const _removedElsewhere = id => _dynamicMultidevice && _haCard !== null && _haIdsMirror.has(id) && !_haIdsNow.has(id);
        const _dynamicCandidates = [...new Set([
            ..._lsEntities.filter(e => !e.isStatic && !_removedElsewhere(e.entity)).map(e => e.entity),
            ...( _dynamicMultidevice ? _haEntities.filter(e => !e.isStatic).map(e => e.entity) : [] ),
        ])];
        const _dynamicOrder = this._resolveOrder(
            _dynamicCandidates, null, null,
            _haEntities.filter(e => !e.isStatic).map(e => e.entity),
            (_ls?.ha_entities ?? []).filter(e => !e.isStatic).map(e => e.entity),
            _lsEntities.filter(e => !e.isStatic).map(e => e.entity),
            _dynamicOrderEnabled, _dynamicOrderMultidevice
        );

        const _entityIds = new Set([
            ..._staticOrder,
            ...(_dynamicEntitiesAllowed ? _dynamicOrder : []),
        ]);

        this.store.list = [..._entityIds].map(id => {
            const _yamlE = _findEntity(_yamlEntities, id);

            // YAML front — per entity, always wins on change, unaffected by the enable flags
            // (a copy — the live entry gets mutated later, e.g. graphKey, and _yamlE itself
            // is also the pure YAML mirror saved by writeLocalState)
            if( _yamlE && JSON.stringify(_yamlE) !== JSON.stringify(_findEntity(_yamlMirror, id) ?? null) )
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
            const _resolveEnabledFields = (_entityFields, _cardRaw) => {
                if( _entityFields !== undefined ) return _entityFields;
                const _cardSet = this._resolvePersistenceDefault(_cardRaw, ['range', 'entities', 'order'], !_yamlE);
                return _cardSet.has('entities') ? new Set(this._entityPersistenceFields()) : new Set();
            };
            const _multiFields = _resolveEnabledFields(_yamlE?.enableMultidevicePersistence, this.pconfig.enableMultidevicePersistence);
            const _localFields = _resolveEnabledFields(_yamlE?.enablePersistence, this.pconfig.enablePersistence);
            const _enabledFields = new Set([..._multiFields, ..._localFields]);

            const _haE = _findEntity(_haEntities, id);
            const _haChanged = _haE && JSON.stringify(_haE) !== JSON.stringify(_findEntity(_haMirror, id) ?? null);
            const _localE = _findEntity(_lsEntities, id) ?? _yamlE ?? _haE;

            // Base: the YAML value for every field — nothing persists unless explicitly
            // enabled. Then layer in the local value for fields with some persistence
            // enabled, then further layer in the HA value for the multidevice-enabled subset
            // if it actually changed. A dynamic entity has no YAML value; its base is the
            // local/HA snapshot instead — it only exists here at all because persistence was
            // enabled for it (see _entityIds above), so there's always something to base on.
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
        });

        // Group ids left wrong by older versions repaired; next free dynamic group id set
        this.store.normalizeGroupIds(e => e.type ?? this._detectDefaultType(e.entity).type);

        // --- Last one to speak wins — timeRange ---
        // infoPanelEnabled is handled separately below — see the warning comment there,
        // it deliberately does NOT follow this pattern.


        // HA user front (compare HA user value to its mirror in localStorage)
        // range defaults to 'all' when this card has no static (YAML) entities at all —
        // a purely dynamic card has nothing fixed to anchor to, so it's treated the same
        // way dynamic entities are: persist by default. A card with at least one static
        // entity still defaults to 'none' for range, same as before. See _noStaticsDefaultAll
        // above (shared with order — same reasoning applies to both).
        const _multiRange = this._resolvePersistenceDefault(this.pconfig.enableMultidevicePersistence, ['range', 'entities', 'order'], _noStaticsDefaultAll).has('range');
        const _localRange = this._resolvePersistenceDefault(this.pconfig.enablePersistence, ['range', 'entities', 'order'], _noStaticsDefaultAll).has('range');
        const _haTimeChanged = _multiRange &&
            _haCard?.timeRangeHours !== undefined && (
            _haCard.timeRangeHours   !== _ls?.ha_timeRangeHours ||
            _haCard.timeRangeMinutes !== _ls?.ha_timeRangeMinutes
        );

        // YAML front — compared with the YAML image only
        const _yamlTimeChanged = this.pconfig.yamlDefaultTimeRange !== undefined &&
                                 String(this.pconfig.yamlDefaultTimeRange) !== String(_ls?.yaml_defaultTimeRange);

        // infoPanelEnabled — proper mirror-compared "last one to speak wins", same pattern
        // as everything else. This was broken as an unrelated side effect of the v1.1.27
        // storage-format simplification (which dropped `yaml_defaultInfoPanel` from the
        // persisted payload while unifying the static/dynamic graph pipeline — info panel
        // was never the target of that refactor and was never re-tested after it), then
        // "fixed" back to a permanently-true comparison mid-session under the mistaken
        // belief that the cross-card conflict-detection registry below (in
        // `history-explorer-infopanel-enabled`.registry) needed it to always fire in order
        // to keep re-registering and cleaning up stale/removed cards. It doesn't: that
        // registry block is entirely unconditional already (re-registers with a fresh
        // timestamp on every load regardless of this comparison, see below) — verified
        // against the last version with a properly tested info panel (v1.1.19), which used
        // this exact mirror comparison.
        const _haInfoChanged = _haInfoEnabled !== undefined &&
                               _haInfoEnabled !== _ls?.ha_infoPanelEnabled;
        const _yamlInfoChanged = this.pconfig.defaultInfoPanel !== undefined &&
                                 this.pconfig.defaultInfoPanel !== _ls?.yaml_defaultInfoPanel;

        // Apply winning value to active variables — YAML wins if both changed simultaneously
        let _infoPanelChanged = false;

        if( _yamlInfoChanged || _haInfoChanged ) {
            // YAML wins if both changed
            const active_infoPanelEnabled = _yamlInfoChanged ? !!this.pconfig.defaultInfoPanel : _haInfoEnabled;
            if( active_infoPanelEnabled !== infoPanelEnabled ) {
                setInfoPanelEnabled(active_infoPanelEnabled);
                _infoPanelChanged = true;
            }
        } else {
            // No front — infoPanelEnabled already correctly set from localStorage at module load (line 96)
        }

        if( !_multiRange && !_localRange ) {
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

        // Update HA user mirrors for next writeLocalState
        this._lastHaEntities         = _haCard?.entities        ?? _ls?.ha_entities        ?? null;
        this._lastHaTimeRangeHours   = _haCard?.timeRangeHours  ?? _ls?.ha_timeRangeHours  ?? null;
        this._lastHaTimeRangeMinutes = _haCard?.timeRangeMinutes?? _ls?.ha_timeRangeMinutes?? null;
        this._lastHaInfoEnabled      = _haInfoEnabled            ?? _ls?.ha_infoPanelEnabled ?? null;


        // Register defaultInfoPanel with HA user key and detect conflicts across cards.
        // This re-registers with a fresh timestamp on every load, unconditionally — that's
        // required for cleanup of stale/removed cards to work at all (deleting a card/view
        // generates no HA event, so only surviving cards reasserting themselves can ever
        // detect and clean up a stale entry). This is entirely independent of
        // _yamlInfoChanged/_haInfoChanged above — it never reads them, and never needed to.
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

        // Persist updated state (mirrors included) before any potential reload
        await this.writeLocalState();

        // Apply infoPanel state last, after everything (including writeLocalState) is done
        if( _infoPanelChanged ) {
            this.applyInfoPanelState();
        }

        return false; // interval redraw handled via pconfig.entities in createContent
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
}
