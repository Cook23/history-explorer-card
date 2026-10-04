// The card's menus and lists: the entity type menu, the options menu, and the entity
// selector (its dropdown list, also the compact version for phones). Part of
// HistoryCardState (added to it in history-explorer-card.js).

import { i18n } from "./languages.js";
import { INTERPOLATIONS, INTERPOLATION_LABELS } from "./history-options.js";
const moment = window.HXLocal_moment;

// Entity type menu definitions — shared by showEntityTypeMenu and listeners
export const _TYPE_MENU_DEFS = [
    { type: 'line', lineMode: 'lines',   label: 'ui.menu.type_line_straight' },
    { type: 'line', lineMode: 'curves',  label: 'ui.menu.type_line_curves' },
    { type: 'line', lineMode: 'stepped', label: 'ui.menu.type_line_stepped' },
    { type: 'bar',  lineMode: null,      label: 'ui.menu.type_bar' },
    { type: 'arrowline', lineMode: null, label: 'ui.menu.type_arrowline' },
    { type: 'timeline',  lineMode: null, label: 'ui.menu.type_timeline' },
    // Appended rather than inserted, so the existing et_N_<index> ids stay put — shown
    // first (_TYPE_MENU_ORDER)
    { type: 'line', lineMode: 'smart',   label: 'ui.menu.type_line_smart' },
];
// Display order of the type menu's entries (indices in _TYPE_MENU_DEFS), and their style —
// shared by the card's menu and the info panel's
export const _TYPE_MENU_ORDER = [6, 1, 0, 2, 3, 4, 5];
export const _TYPE_MENU_ITEM_STYLE = 'display:block;padding:5px 10px;text-decoration:none;color:inherit';

// The type menu's items, each opening its submenu over the menu, right-aligned, level with
// it: what the entity is shown as (open when the menu opens), how its curve is
// interpolated, and what to do with it in its graph (the card's long-press menu only)
const _TYPE_SUBMENUS = { rep: 'ui.menu.type_representation', interp: 'ui.menu.type_interpolation', org: 'ui.menu.type_organization' };
// The organization submenu's entries (et_N_<key>)
const _ORG_ENTRIES = { split: 'ui.menu.entity_split', merge: 'ui.menu.entity_merge', delete: 'ui.menu.entity_delete' };
// Wide enough for the items' names with a submenu open beside them, over the menu
const _TYPE_MENU_MIN_WIDTH = 260;
const _MENU_BOX_STYLE = 'display:none;position:absolute;text-align:left;border:1px solid #444;box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2);color:var(--primary-text-color);background-color:var(--card-background-color);outline:none';

// The type menu et_N and its submenus et_N_<key>_sub — the card's (full: "Default" for a
// wildcard add, and the organization submenu) and the info panel's
export function typeMenuHtml(i, full)
{
    const a = (id, label, hidden) => `<a id="${id}" href="#et" style="${_TYPE_MENU_ITEM_STYLE}${hidden ? ';display:none' : ''}">${label}</a>`;
    const sub = (key, entries) => `<div id="et_${i}_${key}_sub" tabindex="0" style="${_MENU_BOX_STYLE};min-width:110px;z-index:3">${entries.join('')}</div>`;
    const keys = Object.keys(_TYPE_SUBMENUS).filter(k => full || k !== 'org');
    return `<div id="et_${i}" tabindex="0" style="${_MENU_BOX_STYLE};min-width:${_TYPE_MENU_MIN_WIDTH}px;z-index:2">
            <div id="et_${i}_title" style="margin:1px;padding:4px 9px;font-weight:600;background-color:var(--secondary-background-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
            ${keys.map(k => a(`et_${i}_${k}`, i18n(_TYPE_SUBMENUS[k]) + ' ▸', true)).join('')}
        </div>
        ${sub('rep', [full ? a(`et_${i}_default`, i18n('ui.menu.type_default'), true) : '', ..._TYPE_MENU_ORDER.map(k => a(`et_${i}_${k}`, i18n(_TYPE_MENU_DEFS[k].label)))])}
        ${sub('interp', INTERPOLATIONS.map(k => a(`et_${i}_algo_${k}`, INTERPOLATION_LABELS[k])))}
        ${full ? sub('org', Object.keys(_ORG_ENTRIES).map(k => a(`et_${i}_${k}`, i18n(_ORG_ENTRIES[k]), true))) : ''}`;
}

export class CardMenus
{
    // --------------------------------------------------------------------------------------
    // Entity type menu: Representation ▸, Interpolation ▸, Organization ▸
    // --------------------------------------------------------------------------------------

    // The type menu's names, in the card's language (set once it's known)
    relabelTypeMenu(i)
    {
        const set = (id, text) => { const _el = this._this.querySelector(`#${id}`); if( _el ) _el.innerHTML = text; };
        for( const k in _TYPE_SUBMENUS ) set(`et_${i}_${k}`, i18n(_TYPE_SUBMENUS[k]) + ' ▸');
        set(`et_${i}_default`, i18n('ui.menu.type_default'));
        _TYPE_MENU_DEFS.forEach((d, k) => set(`et_${i}_${k}`, i18n(d.label)));
        for( const k in _ORG_ENTRIES ) set(`et_${i}_${k}`, i18n(_ORG_ENTRIES[k]));
    }

    // Shows the representation submenu's entries for an entity — only Timeline when it
    // isn't numeric — and marks (bold, hecSelected) the one isActive(def) says is current
    _markTypeMenu(input_idx, numeric, isActive)
    {
        _TYPE_MENU_DEFS.forEach((_def, _idx) => {
            const _el = this._this.querySelector(`#et_${input_idx}_${_idx}`);
            if( !_el ) return;
            if( !numeric && _def.type !== 'timeline' ) { _el.style.display = 'none'; return; }
            _el.style.display = 'block';
            _el.style.background = '';
            const _active = isActive(_def);
            _el.style.fontWeight = _active ? 'bold' : '';
            if( _active ) _el.dataset.hecSelected = '1'; else delete _el.dataset.hecSelected;
        });
    }

    // Marks (bold, hecSelected) the interpolation algorithm in use for the menu's entity
    _markInterpolationMenu(input_idx)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        const _g = this.graphs.find(g => g.id === _menu?._hec_graph_id);
        const _cur = this._resolveInterpolation(_g?.entities.find(e => e.entity === _menu?._hec_entity_id));
        INTERPOLATIONS.forEach(k => {
            const _el = this._this.querySelector(`#et_${input_idx}_algo_${k}`);
            if( !_el ) return;
            _el.style.fontWeight = k === _cur ? 'bold' : '';
            if( k === _cur ) _el.dataset.hecSelected = '1'; else delete _el.dataset.hecSelected;
        });
    }

    // The type menu, for an entity being added (graph null; entity_id an array for a
    // wildcard match), or for an entity shown in graph — from a long-press on its label
    // (anchorClientX/Y: where), or from the entity selector (a duplicate). Opens with its
    // representation submenu.
    showEntityTypeMenu(input_idx, entity_id, graph, anchorClientX = null, anchorClientY = null, align = 'left')
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        const _input = this.ui.inputField[input_idx];
        if( !_menu ) return;
        const q = id => this._this.querySelector(`#et_${input_idx}_${id}`);
        const show = (el, on) => { if( el ) el.style.display = on ? 'block' : 'none'; };

        // Store context for click handler — entity_id is a string (existing entity, or
        // new single entity) or an array (new entities from a wildcard match)
        _menu._hec_entity_id = entity_id;
        _menu._hec_graph_id  = graph ? graph.id : null;
        _menu._hec_anchor    = { clientX: anchorClientX, clientY: anchorClientY };
        this.hideTypeSubmenus(input_idx);

        const _isWildcard = Array.isArray(entity_id);
        const _e = graph?.entities.find(e => e.entity === entity_id);
        // Interpolation: for an entity already shown as a curve in curves or smart mode —
        // the only modes it applies to
        const _mode = this.normalizeLineMode(_e?.lineMode) || this.pconfig.defaultLineMode || 'curves';
        show(q('interp'), !!_e && ( _e.type ?? graph.type ) === 'line' && ( _mode === 'curves' || _mode === 'smart' ));
        // Organization: an entity already in a graph, from a long-press on its own label
        const _longPress = !!graph && anchorClientX !== null && anchorClientY !== null;
        show(q('org'), _longPress);
        show(q('split'), _longPress && this._canUncombine(graph));
        show(q('merge'), _longPress && this._canMergeLinkedGraph(graph));
        show(q('delete'), _longPress);
        show(q('rep'), true);

        const _titleEl = q('title');
        if( _titleEl ) {
            _titleEl.textContent = _isWildcard ? '*' : entity_id;
            // Title border — same blue/red convention used elsewhere for allowed/forbidden
            // drag targets: solid blue for a brand-new entity about to be added, dashed red
            // for a duplicate found in the entity selector, none from a long-press
            const _border = !graph ? '2px solid var(--primary-color,#03a9f4)'
                          : !_longPress ? '2px dashed var(--error-color,#f44336)' : null;
            _titleEl.style.border = '';
            if( _border ) _titleEl.style.border = _border;
            else _titleEl.style.borderBottom = '1px solid #444';
        }

        const _defaultEl = q('default');
        show(_defaultEl, false);
        if( graph ) {
            // Existing entity — change type. Non-numeric entity (only ever timeline): the
            // only choice is timeline itself.
            // (the entity's own type — a bar graph can also hold line entities)
            const _curType = _e?.type ?? graph.type;
            this._markTypeMenu(input_idx, this._isNumericEntity(entity_id), d => d.type === _curType && (d.lineMode === null || d.lineMode === _mode));
        } else if( _isWildcard ) {
            // Brand-new entities from a wildcard match: "Default" (each entity's own
            // auto-detected type) offered and pre-selected — unless none of them is
            // numeric, timeline then being the only possible outcome
            const _anyNumeric = entity_id.some(eid => this._isNumericEntity(eid));
            if( _defaultEl && _anyNumeric ) {
                show(_defaultEl, true);
                _defaultEl.style.background = '';
                _defaultEl.style.fontWeight = 'bold';
                _defaultEl.dataset.hecSelected = '1';
            }
            this._markTypeMenu(input_idx, _anyNumeric, d => !_anyNumeric && d.type === 'timeline');
        } else {
            // Brand-new single entity: its own auto-detected type (YAML/state/unit)
            // pre-selected, same as what addGraph would pick
            const _numeric = this._isNumericEntity(entity_id);
            const _detected = _numeric ? this._detectDefaultType(entity_id) : { type: 'timeline', lineMode: null };
            this._markTypeMenu(input_idx, _numeric, d => d.type === _detected.type && (d.lineMode === null || d.lineMode === _detected.lineMode));
        }

        // Position — #tb_N directly, not _menu.offsetParent — offsetParent of a display:none
        // element is always null, and _menu still has display:none at this exact point
        // (before _openMenu turns it on). #tb_N is already known to be the real positioned
        // ancestor (see its position:relative in the HTML), no need to read it back off an
        // element that isn't shown yet.
        const _tb = this._this.querySelector(`#tb_${input_idx}`);
        const _parentRect = _tb ? _tb.getBoundingClientRect() : { top: 0, left: 0 };
        let _top, _left;
        if( _longPress ) {
            _top  = (anchorClientY - _parentRect.top)  + 'px';
            _left = (anchorClientX - _parentRect.left) + 'px';
        } else if( _input ) {
            const _inputRect = _input.getBoundingClientRect();
            _top = (_inputRect.bottom - _parentRect.top) + 'px';
            const _anchorX = align === 'center' ? (_inputRect.left + _inputRect.width / 2)
                            : align === 'right'  ? _inputRect.right
                            : _inputRect.left + 30;
            _left = (_anchorX - _parentRect.left) + 'px';
        }
        this._openMenu(_menu, _top, _left, align);
        this.showTypeSubmenu(input_idx, 'rep');
    }

    hideEntityTypeMenu(input_idx)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        if( !_menu ) return;
        this.hideTypeSubmenus(input_idx);
        // Clear highlight and marks, the submenus' included
        for( const _box of [_menu, ...this._typeSubmenus(input_idx)] )
            for( let _a of _box.getElementsByTagName('a') ) {
                _a.style.background = '';
                _a.style.fontWeight = '';
                delete _a.dataset.hecSelected;
            }
        _menu.style.display = 'none';
        this._resetEntityInput(this.ui.inputField[input_idx]);
    }

    // The type menu's submenus present in this menu (the info panel's has no organization)
    _typeSubmenus(input_idx)
    {
        return Object.keys(_TYPE_SUBMENUS).map(k => this._this.querySelector(`#et_${input_idx}_${k}_sub`)).filter(s => s);
    }

    // Opens the type menu's submenu key over the menu, level with its item — the one
    // open before closes — and gives it the keyboard: the first arrow key highlights its
    // marked entry, Enter takes it right away
    showTypeSubmenu(input_idx, key)
    {
        const _item = this._this.querySelector(`#et_${input_idx}_${key}`);
        const _sub  = this._this.querySelector(`#et_${input_idx}_${key}_sub`);
        if( !_item || !_sub || _item.style.display === 'none' ) return;
        this.hideTypeSubmenus(input_idx);
        if( key === 'interp' ) this._markInterpolationMenu(input_idx);
        this._openSubmenu(_sub, _item);
        _sub.focus();
    }

    // Closes the type menu's submenus (their keyboard highlight cleared, their marks kept),
    // and with backToMenu gives the keyboard back to the menu
    hideTypeSubmenus(input_idx, backToMenu = false)
    {
        for( const _sub of this._typeSubmenus(input_idx) ) {
            for( let _a of _sub.getElementsByTagName('a') ) _a.style.background = '';
            _sub.style.display = 'none';
        }
        if( backToMenu ) this._this.querySelector(`#et_${input_idx}`)?.focus();
    }

    // Listeners of the type menu et_N and its submenus — shared by the card and the info
    // panel (whose menu has no "Default" and no organization)
    _initEntityTypeMenu(_ii)
    {
        const _etMenu = this._this.querySelector(`#et_${_ii}`);
        if( !_etMenu ) return;
        const _subs = this._typeSubmenus(_ii);
        const _on = (id, fn) => this._this.querySelector(`#et_${_ii}_${id}`)?.addEventListener('click', (e) => { e.preventDefault(); fn(); }, true);
        // Click on options — capture:true like es_N
        for( const k in _TYPE_SUBMENUS ) _on(k, () => this.showTypeSubmenu(_ii, k));
        _on('default', () => this.entityTypeMenuClicked(_ii, 'default', null));
        _TYPE_MENU_DEFS.forEach((_def, _idx) => _on(_idx, () => this.entityTypeMenuClicked(_ii, _def.type, _def.lineMode)));
        INTERPOLATIONS.forEach(k => _on(`algo_${k}`, () => this.entityInterpolationClicked(_ii, k)));
        for( const k in _ORG_ENTRIES ) _on(k, () => this.entityOrganizationClicked(_ii, k));
        // Keyboard navigation — Enter or → on an item opens its submenu
        _etMenu.addEventListener('keydown', (e) => {
            const _sel = _etMenu.querySelector('a[data-hec-selected]');
            if( e.key === 'ArrowRight' && _sel?.style.background ) {
                e.preventDefault();
                _sel.click();
                return;
            }
            this._menuKeyDown(e, _etMenu, {
                onClose: () => { this.hideTypeSubmenus(_ii); this._resetEntityInput(this.ui.inputField[_ii]); },
            });
        });
        // A submenu: same navigation; Escape or ← goes back to the menu
        for( const _sub of _subs ) _sub.addEventListener('keydown', (e) => {
            if( e.key === 'ArrowLeft' || e.key === 'Escape' ) {
                e.preventDefault();
                e.stopPropagation();
                this.hideTypeSubmenus(_ii, true);
                return;
            }
            this._menuKeyDown(e, _sub);
        });
        // Close on focusout — same as es_N; moving between the menu and its submenus
        // keeps them open
        const _closeIfLeft = () => {
            setTimeout(() => {
                // (the focused element as seen from the menu's own tree: inside Home
                // Assistant's shadow roots, document.activeElement is only their host)
                const _a = _etMenu.getRootNode()?.activeElement;
                const _in = el => el && ( el.contains(document.activeElement) || ( _a && el.contains(_a) ) );
                if( ![_etMenu, ..._subs].some(_in) ) this.hideEntityTypeMenu(_ii);
            }, 150);
        };
        for( const _box of [_etMenu, ..._subs] ) _box.addEventListener('focusout', _closeIfLeft);
    }

    entityInterpolationClicked(input_idx, algo)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        if( !_menu ) return;
        const _entity_id = _menu._hec_entity_id;
        const _graph_id  = _menu._hec_graph_id;
        this.hideEntityTypeMenu(input_idx);
        const _g = this.graphs.find(g => g.id === _graph_id);
        if( !_g ) return;
        const _entIdx = _g.entities.findIndex(e => e.entity === _entity_id);
        if( _entIdx < 0 ) return;
        // (g.entities[i] is the entity's entry in the store itself: saved with it)
        _g.entities[_entIdx].interpolation = algo;
        if( _g.chart.data.datasets[_entIdx] ) _g.chart.data.datasets[_entIdx].hecInterpolation = algo;
        _g.chart.update();
        this.writeLocalState();
    }

    // Organization: the entity taken out into its own graph (as a double-click on its
    // label), its linked graph merged back into the one above (as a double-click on the
    // chain icon), or the entity deleted
    entityOrganizationClicked(input_idx, action)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        if( !_menu ) return;
        const _g = this.graphs.find(g => g.id === _menu._hec_graph_id);
        const _idx = _g ? _g.entities.findIndex(e => e.entity === _menu._hec_entity_id) : -1;
        const _anchor = _menu._hec_anchor;
        this.hideEntityTypeMenu(input_idx);
        if( _idx < 0 ) return;
        if( action === 'split' ) this._uncombineEntity(_g, _idx);
        else if( action === 'merge' ) this._mergeLinkedGraph(_g, _anchor);
        else this._deleteEntity(_g, _idx);
    }

    entityTypeMenuClicked(input_idx, type, lineMode)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        if( !_menu ) return;
        const _entity_id = _menu._hec_entity_id;
        const _graph_id  = _menu._hec_graph_id;
        this.hideEntityTypeMenu(input_idx);

        if( !_entity_id ) return;

        if( _graph_id === null ) {
            // Brand-new entity/entities — nothing created yet, this click both defines
            // the type and performs the creation. _entity_id is a string (single) or
            // an array (wildcard match).
            const _ids = Array.isArray(_entity_id) ? _entity_id : [_entity_id];
            const _addedNames = [];
            for( let eid of _ids ) {
                // Guard: a non-numeric-convertible entity can only ever be represented
                // as a timeline, regardless of what was chosen (including "default")
                const _isNumeric = this._isNumericEntity(eid);
                let _finalType, _finalLineMode;
                if( !_isNumeric ) {
                    _finalType = 'timeline';
                    _finalLineMode = null;
                } else if( type === 'default' ) {
                    const _det = this._detectDefaultType(eid);
                    _finalType = _det.type;
                    _finalLineMode = _det.lineMode;
                } else {
                    _finalType = type;
                    _finalLineMode = lineMode;
                }
                _addedNames.push(this._createAndPersistEntity(eid, _finalType, _finalLineMode));
            }
            if( _addedNames.length ) {
                this._justAdded = _addedNames.join('; ');
                const _fi = this.ui.inputField[input_idx];
                if( _fi ) {
                    _fi.value = this._justAdded;
                    _fi.style.fontWeight = 'bold';
                    setTimeout(() => { this._resetEntityInput(_fi); }, 500);
                }
            }
            this.updateHistoryWithClearCache();
            this.writeLocalState();
            return;
        }

        // Update pconfig.entities — persist lineMode and type
        const _pcEntry = this.store.entry(_entity_id);
        // The entity's own type before this change (a bar graph can also hold line entities)
        const _gOld = this.graphs.find(g => g.id === _graph_id);
        const _oldType = _gOld?.entities.find(e => e.entity === _entity_id)?.type ?? _gOld?.type;
        if( _pcEntry ) {
            _pcEntry.lineMode = lineMode;
            _pcEntry.type     = type;
        }

        const _g = this.graphs.find(g => g.id === _graph_id);
        if( _g ) {
            if( _oldType === type ) {
                // Same type — update lineMode on the specific entity's dataset only
                const _mode = this.normalizeLineMode(lineMode);
                const _entIdx = _g.entities.findIndex(e => e.entity === _entity_id);
                if( _entIdx >= 0 && _g.chart.data.datasets[_entIdx] ) {
                    _g.chart.data.datasets[_entIdx].steppedLine = _mode === 'stepped';
                    _g.chart.data.datasets[_entIdx].lineTension = (_mode === 'lines' || _mode === 'stepped') ? 0 : 0.1;
                }
                // Update in-memory entity so pre-selection is correct next time
                const _ent = _g.entities[_entIdx];
                if( _ent ) _ent.lineMode = _mode;
                _g.chart.update();
                this.updateHistory();
            } else {
                // Type change (line/bar/arrowline/timeline) — extract entity and re-add with new type
                // Same as uncombine but without noAutoGroup flag so re-combine is allowed
                const _entIdx    = _g.entities.findIndex(e => e.entity === _entity_id);
                const _entity    = _g.entities[_entIdx];
                const _newEntities = _g.entities.filter((_, i) => i !== _entIdx);
                // Reset SI conversion factors
                _entity.siConversionFactor = undefined;
                _newEntities.forEach(en => { en.siConversionFactor = undefined; });
                // Keep original groupId — noAutoGroup=false allows natural re-combine
                // A new groupId would prevent re-combine after refresh
                const _origGroupId = _g.groupId;
                const _nextG = this._nextGroup(_g);
                this._detachGraph(_g);
                // Re-add remaining entities — color from pconfig.entities (g.entities' color
                // is meaningless, always black, coming from a timeline graph); fill recomputed below
                const _savedCombine = this.pconfig.combineSameUnits;
                this.pconfig.combineSameUnits = true;
                _newEntities.forEach((en, i) => {
                    const _pe = this.store.inGroup(en.entity, _origGroupId);
                    // fill is not persisted across a type change: it's derived from color+type,
                    // not a type-independent value. Pass null so addGraph recomputes it correctly
                    // for the target type (transparent for line/arrowline/timeline, solid for bar).
                    this.addGraph(en.entity, i === 0, _pe?.color ?? en.color, null, _nextG, undefined, false, null, _origGroupId, _pe ?? en);
                });
                this.pconfig.combineSameUnits = _savedCombine;
                // Re-add extracted entity — color only; fill recomputed for the new type (see
                // above). Goes right before whatever followed the original graph _g — i.e.
                // right after the just-rebuilt remaining-entities graph.
                this.addGraph(_entity.entity, false, _pcEntry?.color ?? _entity.color, null, _nextG, undefined, false, _entity.interval ?? null, _origGroupId, _pcEntry ?? _entity);
                // Sync the freshly-computed fill (correct for the NEW type) back into
                // pconfig.entities, so persistence stays consistent with what the next
                // rebuild will read as overrideFill — no need to special-case fill at rebuild time
                if( _pcEntry ) {
                    const _updatedG = this.graphs.find(g => g.entities.some(e => e.entity === _entity.entity));
                    const _updatedEntity = _updatedG?.entities.find(e => e.entity === _entity.entity);
                    if( _updatedEntity ) _pcEntry.fill = _updatedEntity.fill;
                }
                this._updateMoVisibility();
                this._updateGroupLinkMarkers();
                this.updateHistoryWithClearCache();
            }
        }
        this.writeLocalState();
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
            // Position below the toggle button, same pattern as et_N (getBoundingClientRect
            // converted through offsetParent) — previously only `left` was set, `top` stayed
            // at its default "auto" (static-flow) position, which could land the menu
            // directly over the button instead of below it, making the button unclickable
            // to close the menu while it's open.
            const _boRect = this._this.querySelector(`#bo_${idx}`).getBoundingClientRect();
            // #tb_N directly, not dropdown.offsetParent — same reason as setDropdownVisibility
            // and showEntityTypeMenu: dropdown still has display:none at this exact point.
            const _tb = this._this.querySelector(`#tb_${idx}`);
            const _parentRect = _tb ? _tb.getBoundingClientRect() : { top: 0, left: 0 };
            const _top  = (_boRect.bottom - _parentRect.top) + 'px';
            const _left = (_boRect.left   - _parentRect.left - 30) + 'px';
            this._openMenu(dropdown, _top, _left);
            dropdown.focus();
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
        const dropdown = this._this.querySelector(`#es_${idx}`);
        setTimeout(() => {
            if( !dropdown.contains(document.activeElement) ) {
                this.setDropdownVisibility(idx, false);
            }
        }, 150);
    }

    // Shared keyboard navigation for any open floating menu (entity selector dropdown,
    // entity type menu, export menu) — Escape closes, ArrowUp/ArrowDown move the highlight,
    // Enter activates the highlighted item (or the first visible one). This is purely menu
    // navigation, the same regardless of what the menu actually contains — any
    // menu-specific business logic (e.g. the entity selector's wildcard/multi-select/
    // already-selected handling, or the entity type menu's default/active-type bolding)
    // stays with the caller, hooked in via the optional callbacks rather than living inside
    // this function. Never touches fontWeight anywhere — that's business state, not
    // navigation state.
    //   menuEl        — the menu container to read visible <a> items from
    //   onClose()     — called after Escape closes+clears the menu; caller does its own
    //                   extra cleanup on top (e.g. clearing the selector's text field)
    //   onEnter(sel)  — called instead of the default sel.click() if provided; return true
    //                   to signal "handled, don't also click" (used by the entity selector
    //                   for its wildcard/already-selected cases), or false/undefined to let
    //                   the default click still happen
    //   onHighlight(el) — called with the newly highlighted item after ArrowUp/ArrowDown,
    //                   whether it just appeared (first press) or moved. This is still
    //                   generic menu behavior — the menu already knows which item is
    //                   highlighted — only the entity selector currently uses it, to preview
    //                   what an ambiguous friendly name actually resolves to before the user
    //                   commits, but nothing here is specific to that use.
    _menuKeyDown(event, menuEl, { onClose, onEnter, onHighlight } = {}) {
        if( !['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key) ) return;
        if( !menuEl || menuEl.style.display === 'none' ) return;

        if( event.key === 'Escape' ) {
            event.preventDefault();
            // Clears the keyboard-navigation highlight only (background + hecSelected
            // marker) — never fontWeight, which is menu-specific business state (e.g. the
            // entity type menu's "bold = currently active type") set by the caller, not by
            // this generic navigation logic, and must survive closing/reopening the menu.
            for( let _a of menuEl.getElementsByTagName('a') ) {
                _a.style.background = '';
                delete _a.dataset.hecSelected;
            }
            menuEl.style.display = 'none';
            onClose?.();
            return;
        }

        const _visible = Array.from(menuEl.getElementsByTagName('a')).filter(a => a.style.display !== 'none');
        if( !_visible.length ) return;

        if( event.key === 'Enter' ) {
            event.preventDefault();
            const _sel = menuEl.querySelector('a[data-hec-selected]');
            if( !_sel ) return;
            if( onEnter?.(_sel) ) return;
            _sel.click();
            return;
        }

        // ArrowDown / ArrowUp
        event.preventDefault();
        const _next = this._navigateMenuArrowKey(_visible, event.key);
        _next.scrollIntoView({ block: 'nearest' });
        onHighlight?.(_next);
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
        const idx = event.target.href.slice(-1);
        let input = this._this.querySelector(`#b7_${idx}`);
        let dropdown = this._this.querySelector(`#es_${idx}`);
        const entity_id = event.target.dataset.entity;
        const friendly = event.target.textContent;
        input.value = friendly;
        input.dataset.entityId = entity_id;
        if( !this._entitySelected ) this._entitySelected = [false, false];
        this._entitySelected[idx * 1] = true;
        dropdown.style.display = 'none';

        // Pointer selection of a specific entry is unambiguous (unlike keyboard entry, which
        // may still be a wildcard pattern needing a preview step) — add immediately.
        this.addEntitySelected(idx * 1);
    }


    // --------------------------------------------------------------------------------------
    // Entity listbox populators
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
            const fa = this._hass.states[a]?.attributes?.friendly_name || a;
            const fb = this._hass.states[b]?.attributes?.friendly_name || b;
            if( fa !== fb ) return fa.localeCompare(fb);
            return a.localeCompare(b);
        });

        for( let i = 0; i < 2; ++i ) {

            const datalist = this._this.querySelector(`#es_${i}`);
            if( !datalist ) continue;

            while( datalist.firstChild ) datalist.removeChild(datalist.firstChild);

            for( let entity of entities ) {
                const friendly = this._hass.states[entity]?.attributes?.friendly_name || entity;
                const _state = this._hass.states[entity];
                const _stateVal = _state?.state;
                const _unit = _state?.attributes?.unit_of_measurement;
                // Format value like legend labels: rounded to roundingPrecision
                let _valStr = '';
                try {
                    if( _stateVal !== undefined && _stateVal !== 'unavailable' && _stateVal !== 'unknown' ) {
                        const _p = 10 ** this.pconfig.roundingPrecision;
                        const _numVal = Number(_stateVal);
                        const _v = Math.round(_numVal * _p) / _p;
                        if( isNaN(_numVal) ) {
                            // Try to parse as date and show HH:MM
                            const _d = new Date(_stateVal);
                            _valStr = isNaN(_d.getTime()) ? _stateVal : (_d.getHours().toString().padStart(2,'0') + ':' + _d.getMinutes().toString().padStart(2,'0'));
                        } else {
                            _valStr = _v + (_unit ? ' ' + _unit : '');
                        }
                    }
                } catch(e) { _valStr = ''; }
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

            const t0 = moment().subtract(1, "hour").format('YYYY-MM-DDTHH:mm:ss');

            const regex = this.buildFilterRegexList(this.pconfig.filterEntities);
            const excludeRegex = this.buildFilterRegexList(this.pconfig.excludeFilterEntities);

            let l = [];
            for( let e in this._hass.states ) {
                if( !this.matchRegexList(regex, e) || this.matchExcludeRegexList(excludeRegex, e) ) continue;
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
}
