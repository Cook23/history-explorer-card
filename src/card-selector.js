// The entity selector: its dropdown (the entities listed, filtered, navigated with the
// keyboard) and what it adds — one entity or every match of a wildcard, through the type
// menu — or removes. Part of HistoryCardState (added to it in history-explorer-card.js).

import { i18n } from "./languages.js";
import { seriesAttributes, seriesId, attributeLabel } from "./history-series.js";
const moment = window.HXLocal_moment;

export class CardSelector
{
    // --------------------------------------------------------------------------------------
    // The entity selector
    // --------------------------------------------------------------------------------------

    setDropdownVisibility(input_idx, show)
    {
        let input = this._this.querySelector(`#b7_${input_idx}`);
        let dropdown = this._this.querySelector(`#es_${input_idx}`);
        if( !input || !dropdown ) return;
        if( show ) {
            dropdown.style['min-width'] = input.clientWidth + 'px';
            // Position relative to input: below if top selector (idx=0), above if bottom selector (idx=1)
            const inputRect = input.getBoundingClientRect();
            // #tb_N directly, not dropdown.offsetParent — offsetParent of a display:none
            // element is always null, and dropdown still has display:none at this exact
            // point (before _openMenu turns it on) on its very first open. #tb_N is already
            // known to be the real positioned ancestor (see its position:relative in the
            // HTML), so there's no need to read it back off an element that isn't shown yet.
            const _tb = this._this.querySelector(`#tb_${input_idx}`);
            const parentRect = _tb ? _tb.getBoundingClientRect() : { top: 0, left: 0 };
            const leftPos = (inputRect.left - parentRect.left) + 'px';
            let topPos;
            if( input_idx === 0 ) {
                // Top selector: show below
                const maxH = Math.min(window.innerHeight * 0.5, window.innerHeight - inputRect.bottom);
                topPos = (inputRect.bottom - parentRect.top) + 'px';
                dropdown.style.bottom = '';
                dropdown.style.maxHeight = Math.max(0, maxH) + 'px';
            } else {
                // Bottom selector: show above
                const maxH = Math.min(window.innerHeight * 0.5, inputRect.top);
                dropdown.style.top = '';
                dropdown.style.bottom = (parentRect.bottom - inputRect.top) + 'px';
                dropdown.style.maxHeight = Math.max(0, maxH) + 'px';
            }
            this._openMenu(dropdown, topPos, leftPos);
            const filter = input.value.toLowerCase();
            const isWildcard = filter.indexOf('*') >= 0;
            const wcRegex = isWildcard ? this.matchWildcardPattern(filter) : null;
            for( let i of dropdown.getElementsByTagName('a') ) {
                const friendly = i.textContent.toLowerCase();
                const entity   = i.dataset.entity?.toLowerCase() || '';
                let match;
                if( !filter ) {
                    match = true;
                } else if( isWildcard ) {
                    match = wcRegex.test(friendly) || wcRegex.test(entity) || wcRegex.test(entity.split('.')[1] || '');
                } else {
                    match = friendly.indexOf(filter) >= 0 || entity.indexOf(filter) >= 0;
                }
                i.style.display = match ? 'block' : 'none';
                i.style.fontWeight = (match && isWildcard) ? 'bold' : 'normal';
            }
            // Filtering means user is searching again — reset selection flag
            if( !this._entitySelected ) this._entitySelected = [false, false];
            this._entitySelected[input_idx] = false;
        } else
            dropdown.style.display = 'none';
    }

    entitySelectorFocus(event)
    {
        if( !event.target ) return;

        const idx = event.target.id.substr(3) * 1;

        this.setDropdownVisibility(idx ^ 1, false);
        this.setDropdownVisibility(idx, true);
    }

    entitySelectorFocusOut(event)
    {
        if( !event.target ) return;
        const idx = event.target.id.substr(3) * 1;
        this._closeSelectorIfLeft(idx);
    }

    // The dropdown of selector idx (and its series submenu) closed, unless the focus is
    // still in it, in the submenu or in the input field — checked once the focus has moved
    _closeSelectorIfLeft(idx)
    {
        const dropdown = this._this.querySelector(`#es_${idx}`);
        const _sub = this._this.querySelector(`#es_${idx}_series`);
        const _input = this._this.querySelector(`#b7_${idx}`);
        setTimeout(() => {
            // (the focused element as seen from the dropdown's own tree: inside Home
            // Assistant's shadow roots, document.activeElement is only their host)
            const _a = dropdown.getRootNode()?.activeElement;
            const _in = el => el && ( el.contains(document.activeElement) || ( _a && el.contains(_a) ) );
            if( ![dropdown, _sub, _input].some(_in) ) {
                this.hideSeriesMenu(idx);
                this.setDropdownVisibility(idx, false);
            }
        }, 150);
    }

    entitySelectorEntered(event)
    {
        if( !event.target ) return;

        const idx = event.target.id.substr(3) * 1;
        const dropdown = this._this.querySelector(`#es_${idx}`);

        // Refilter if already open (typing, paste, voice input, autofill, or a script
        // setting .value and firing this same event to keep the dropdown in sync). Only
        // reopen a closed dropdown if the field genuinely has focus — a synthetic 'input'
        // fired by _resetEntityInput after the user has already moved away from the field
        // must not pop the dropdown back open.
        if( dropdown.style.display === 'none' && document.activeElement !== event.target ) return;
        this.setDropdownVisibility(idx, true);

        // Clear keyboard highlight on text change
        const _highlighted = dropdown.querySelector('a[data-hec-selected]');
        if( _highlighted ) {
            _highlighted.style.background = '';
            delete _highlighted.dataset.hecSelected;
        }
    }

    entitySelectorKeyDown(event)
    {
        if( !event.target ) return;

        const idx = event.target.id.substr(3) * 1;
        const dropdown = this._this.querySelector(`#es_${idx}`);
        const input    = this._this.querySelector(`#b7_${idx}`);

        // Entity selector-specific: Enter with an entity already selected triggers add
        // regardless of whether the dropdown happens to be open or closed — checked before
        // the generic menu navigation below, which only acts on an open menu.
        if( event.key === 'Enter' && this._entitySelected?.[idx] ) {
            event.preventDefault();
            this.addEntitySelected(idx);
            return;
        }

        this._menuKeyDown(event, dropdown, {
            onClose: () => {
                input.value = '';
                input.style.fontWeight = '';
                delete input.dataset.entityId;
                if( this._entitySelected ) this._entitySelected[idx] = false;
            },
            onEnter: (_sel) => {
                if( !this._entitySelected ) this._entitySelected = [false, false];
                // Entity selector-specific: a wildcard pattern selects every currently
                // visible entity at once, instead of activating a single item.
                if( input.value.indexOf('*') >= 0 ) {
                    const visible = Array.from(dropdown.getElementsByTagName('a')).filter(a => a.style.display !== 'none');
                    const ids   = visible.map(a => a.dataset.entity);
                    const names = visible.map(a => a.textContent);
                    input.value = names.join('; ');
                    input.dataset.entityId = ids.join(';');
                    this._entitySelected[idx] = true;
                    dropdown.style.display = 'none';
                    return true; // handled — don't also click _sel
                }
                return false; // let the default click on _sel happen
            },
            onHighlight: (_el) => {
                this._previewEntityTooltip(_el.dataset.entity, idx);
            },
        });
    }

    entitySelectorEntryClicked(event)
    {
        const idx = event.target.href.slice(-1) * 1;
        const entity_id = event.target.dataset.entity;
        // (an entity with attributes that can be shown: which one — its value or one of
        // them — chosen first)
        if( seriesAttributes(this._hass.states[entity_id]).length ) return this.showSeriesMenu(idx, event.target);
        this._selectSeries(idx, entity_id, event.target.textContent);
    }

    // Series id chosen in selector idx (an entity, or one of its attributes), shown as
    // label in its input field: added, through the type menu. A choice in the dropdown is
    // unambiguous (unlike a keyboard entry, which may still be a wildcard pattern needing a
    // preview step) — added at once.
    _selectSeries(idx, id, label)
    {
        const input = this._this.querySelector(`#b7_${idx}`);
        input.value = label;
        input.dataset.entityId = id;
        if( !this._entitySelected ) this._entitySelected = [false, false];
        this._entitySelected[idx] = true;
        this.hideSeriesMenu(idx);
        this._this.querySelector(`#es_${idx}`).style.display = 'none';
        this.addEntitySelected(idx);
    }

    // The series submenu of selector idx, for the entity of dropdown entry entryEl: its
    // value first — marked and pre-selected, Enter takes it — then its attributes, each with
    // its current value. Like the type menu's submenus: over the dropdown, level with the
    // entry, right edges aligned, the entry in bold while it's open; ← or Escape back to the
    // dropdown.
    showSeriesMenu(idx, entryEl)
    {
        const _sub = this._this.querySelector(`#es_${idx}_series`);
        if( !_sub ) return;
        const entity_id = entryEl.dataset.entity;
        const _state = this._hass.states[entity_id];
        const _friendly = _state?.attributes?.friendly_name || entity_id;
        _sub.innerHTML = '';
        const _item = (id, label, value, label0) => {
            const _a = document.createElement('a');
            _a.href = '#es';
            _a.dataset.series = id;
            _a.style = 'display:block;padding:5px 10px;text-decoration:none;color:inherit;white-space:nowrap';
            _a.textContent = value ? `${label} (${value})` : label;
            _a.addEventListener('click', (e) => { e.preventDefault(); this._selectSeries(idx, id, label0); }, true);
            _sub.appendChild(_a);
            return _a;
        };
        const _value = _item(entity_id, i18n('ui.menu.series_value'), this._valueText(_state), _friendly);
        _value.style.fontWeight = 'bold';
        _value.dataset.hecSelected = '1';
        for( const k of seriesAttributes(_state) ) {
            const _id = seriesId(entity_id, k);
            _item(_id, attributeLabel(k), this._valueText(this.stateOf(_id)), this.stateOf(_id).attributes.friendly_name);
        }
        this.hideSeriesMenu(idx);
        entryEl.style.fontWeight = 'bold';
        _sub._hecEntry = entryEl;
        this._openSubmenu(_sub, entryEl);
        _sub.focus();
        if( !_sub._hecListening ) {
            _sub._hecListening = true;
            _sub.addEventListener('keydown', (e) => {
                if( e.key === 'ArrowLeft' || e.key === 'Escape' ) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.hideSeriesMenu(idx);
                    this._this.querySelector(`#b7_${idx}`)?.focus();
                    return;
                }
                this._menuKeyDown(e, _sub);
            });
            _sub.addEventListener('focusout', () => this._closeSelectorIfLeft(idx));
        }
    }

    hideSeriesMenu(idx)
    {
        const _sub = this._this.querySelector(`#es_${idx}_series`);
        if( !_sub ) return;
        _sub.style.display = 'none';
        if( _sub._hecEntry ) { _sub._hecEntry.style.fontWeight = ''; _sub._hecEntry = null; }
    }

    // --------------------------------------------------------------------------------------
    // The entities listed: filters and collection
    // --------------------------------------------------------------------------------------

    // Normalizes a YAML entity-pattern option into a list of compiled regexes. Accepts, for
    // each element (or the value itself, if not an array): a plain string pattern, or an
    // object with an 'entity' string field (the older `- entity: ...` form still used by
    // per-entity `exclude:`). Anything else is logged and skipped rather than thrown —
    // one malformed element never prevents the valid ones around it from working.
    // Used for both the global filterEntities/excludeFilterEntities options and the
    // per-entity exclude option, so both accept the same set of formats.
    buildFilterRegexList(filterValue)
    {
        let regex = [];
        if( filterValue ) {
            const _list = Array.isArray(filterValue) ? filterValue : [filterValue];
            for( let j of _list ) {
                if( !j ) continue;
                const _pattern = (typeof j === 'object') ? j.entity : j;
                if( typeof _pattern !== 'string' || _pattern === '' ) {
                    console.warn(`history-explorer-card: invalid entry in entity filter/exclude list (expected a string or {entity: string}, got ${JSON.stringify(j)}) — ignored`);
                    continue;
                }
                const _regex = this.matchWildcardPattern(_pattern);
                if( _regex ) regex.push(_regex);
            }
        }
        return regex;
    }

    // Back-compat alias: per-entity `exclude:` used to require a distinct function name,
    // but the normalization logic is now identical to buildFilterRegexList.
    buildEntityExclusionList(exclude)
    {
        return this.buildFilterRegexList(exclude);
    }

    matchRegexList(regex, v)
    {
        if( !regex.length ) return true;
        for( let j of regex ) if( j.test(v) ) return true;
        return false;
    }

    // Distinct from matchRegexList: an empty exclude list must mean "exclude nothing", not
    // "matches everything" (which is matchRegexList's behavior for an empty include list —
    // reusing it directly here would have excluded every entity for anyone who hasn't set
    // excludeFilterEntities at all).
    matchExcludeRegexList(regex, v)
    {
        if( !regex.length ) return false;
        for( let j of regex ) if( j.test(v) ) return true;
        return false;
    }

    entityCollectorCallback(result)
    {
        this._fillEntitySelectors(Object.keys(result));
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
        const _hidden = ['automation', 'script', 'zone', 'camera', 'persistent_notification', 'timer'];
        this._fillEntitySelectors(Object.keys(this._hass.states).filter(e => !_hidden.includes(this.getDomainForEntity(e))));
    }

    // Fills the entity selectors' dropdowns with the candidate entities the card's
    // filterEntities / excludeFilterEntities keep, sorted by domain, friendly name and
    // entity id, each shown with its current value.
    _fillEntitySelectors(candidates)
    {
        const regex = this.buildFilterRegexList(this.pconfig.filterEntities);
        const excludeRegex = this.buildFilterRegexList(this.pconfig.excludeFilterEntities);
        const entities = candidates.filter(e => this.matchRegexList(regex, e) && !this.matchExcludeRegexList(excludeRegex, e));

        // Sort by domain / friendly name / entity_id
        entities.sort((a, b) => {
            const da = a.split('.')[0], db = b.split('.')[0];
            if( da !== db ) return da.localeCompare(db);
            const fa = this.stateOf(a)?.attributes?.friendly_name || a;
            const fb = this.stateOf(b)?.attributes?.friendly_name || b;
            if( fa !== fb ) return fa.localeCompare(fb);
            return a.localeCompare(b);
        });

        for( let i = 0; i < 2; ++i ) {

            const datalist = this._this.querySelector(`#es_${i}`);
            if( !datalist ) continue;

            while( datalist.firstChild ) datalist.removeChild(datalist.firstChild);

            for( let entity of entities ) {
                const friendly = this.stateOf(entity)?.attributes?.friendly_name || entity;
                const _valStr = this._valueText(this.stateOf(entity));
                const _label = _valStr ? `${friendly} (${_valStr})` : friendly;
                const o = document.createElement('a');
                o.href = `#s_${i}`;
                o.id = entity;
                o.dataset.entity = entity;
                o.style = "display:block;padding:2px 5px;text-decoration:none;color:inherit;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden";
                o.innerHTML = _label;
                o.addEventListener('click', this.entitySelectorEntryClicked.bind(this), true);
                datalist.appendChild(o);
            }

        }

        for( let i of this.ui.inputField )
            if( i ) i.placeholder = i18n("ui.label.type_to_search");
    }

    // The value of a state as the selector shows it: like the legend's labels, rounded to
    // roundingPrecision, with its unit; a date as HH:MM; '' when there's none
    _valueText(state)
    {
        const _stateVal = state?.state;
        const _unit = state?.attributes?.unit_of_measurement;
        if( _stateVal === undefined || _stateVal === 'unavailable' || _stateVal === 'unknown' ) return '';
        const _p = 10 ** this.pconfig.roundingPrecision;
        const _numVal = Number(_stateVal);
        if( !isNaN(_numVal) ) return Math.round(_numVal * _p) / _p + (_unit ? ' ' + _unit : '');
        // Try to parse as date and show HH:MM
        const _d = new Date(_stateVal);
        return isNaN(_d.getTime()) ? _stateVal : (_d.getHours().toString().padStart(2,'0') + ':' + _d.getMinutes().toString().padStart(2,'0'));
    }

    requestEntityCollection()
    {
        if( this.entitiesPopulated ) return;

        this.entitiesPopulated = true;

        // No point populating the datalist if the selector is not visible
        if( this.ui.hideSelector ) return;

        this.ui.inputField[0] = this._this.querySelector(`#b7_0`);
        this.ui.inputField[1] = this._this.querySelector(`#b7_1`);

        // Entity type menu listeners
        for( let _ii = 0; _ii < 2; _ii++ ) this._initEntityTypeMenu(_ii);

        if( this.pconfig.recordedEntitiesOnly ) {

            for( let i of this.ui.inputField )
                if( i ) i.placeholder = i18n("ui.label.loading");

            const t0 = moment().subtract(1, "hour");

            const regex = this.buildFilterRegexList(this.pconfig.filterEntities);
            const excludeRegex = this.buildFilterRegexList(this.pconfig.excludeFilterEntities);

            let l = [];
            for( let e in this._hass.states ) {
                if( !this.matchRegexList(regex, e) || this.matchExcludeRegexList(excludeRegex, e) ) continue;
                const d = this.getDomainForEntity(e);
                if( !['automation', 'script', 'zone', 'camera', 'persistent_notification', 'timer'].includes(d) ) l.push(e);
            }

            this._hass.callWS(this.historyRequest(l, t0)).then(this.entityCollectorCallback.bind(this), this.entityCollectorFailed.bind(this));

        } else

            this.entityCollectAll();

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
        if( this.stateOf(entity_id) === undefined ) return;
        const _exists = this.store.has(entity_id);
        const _existingG = _exists ? this.graphs.find(g => g.entities.some(e => e.entity === entity_id)) : null;
        this._selectorTooltip(ii, (_exists ? i18n('ui.label.already_exists') : i18n('ui.label.add')) + ': ' + entity_id, _existingG);
    }

    // A message over entity selector ii (centered above its input field), else over graph g,
    // else at the top of the window
    _selectorTooltip(ii, text, g = null)
    {
        const _ir = this.ui.inputField[ii]?.getBoundingClientRect();
        const _r = g?.canvas.getBoundingClientRect();
        const _tx = _ir ? _ir.left + _ir.width / 2 : (_r ? _r.left + _r.width / 2 : window.innerWidth / 2);
        const _ty = _ir ? _ir.top : (_r ? _r.top + _r.height / 2 : 0);
        this._showLabelTooltip(text, _tx, _ty, 'center', this.ui.inputField[ii] ?? g?.canvas ?? document.body);
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
                if( this.stateOf(eid) === undefined ) continue;
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
                this._selectorTooltip(ii, i18n('ui.label.add') + ': ' + _newIds.join('; '));
                this.showEntityTypeMenu(ii, _newIds.length === 1 ? _newIds[0] : _newIds, null);
            }

            if( _duplicates.length ) {
                this._selectorTooltip(ii, i18n('ui.label.already_exists') + ': ' + _duplicates.join('; '));
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
                if( this.stateOf(_eid) == undefined ) continue;
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

            if( this.stateOf(entity_id) == undefined ) return;
            if( this.store.has(entity_id) ) {
                // Entity already exists — show tooltip and highlight containing graph
                const _existingG = this.graphs.find(g => g.entities.some(e => e.entity === entity_id));
                if( _existingG ) {
                    this._selectorTooltip(ii, i18n('ui.label.already_exists') + ': ' + entity_id, _existingG);
                    this.showEntityTypeMenu(ii, entity_id, _existingG);
                    this._flagGraphs([_existingG]);
                }
                return;
            }

            // Brand-new entity — nothing created yet. Always show the type menu, even for
            // a non-numeric entity (reduced to timeline only, its one valid representation)
            // — keeps the same two-step add/cancel process homogeneous for every entity.
            this._selectorTooltip(ii, i18n('ui.label.add') + ': ' + entity_id);
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
}
