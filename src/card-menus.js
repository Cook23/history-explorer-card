// The card's menus: the type menu of an entity — the same menu for a graph (the display
// and interpolation of all its curves, its Y axis lock, its layout) — and the options
// menu, with their keyboard navigation. Part of HistoryCardState (added to it in
// history-explorer-card.js).

import { i18n } from "./languages.js";
import { INTERPOLATIONS, INTERPOLATION_LABELS } from "./history-options.js";
import { CARD_TESTS, openCardTest } from "./card-tests.js";
const Chart = window.HXLocal_Chart;

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
// interpolated, what to do with it in its graph (from a long-press), and, last, the tests
// a user can run to report what their browser or app gives the card (card-tests.js)
const _TYPE_SUBMENUS = { rep: 'ui.menu.type_representation', interp: 'ui.menu.type_interpolation', layout: 'ui.menu.type_layout', tests: 'ui.menu.type_tests' };
// The submenus only the card's menu has, not the info panel's
const _CARD_ONLY_SUBMENUS = ['layout', 'tests'];
// The layout submenu's entries (et_N_<key>): for an entity (separate, merge back, cut,
// delete) or for a graph (merge back, cut, delete the graph)
const _LAYOUT_ENTRIES = { split: 'ui.menu.entity_split', merge: 'ui.menu.entity_merge', cut: 'ui.menu.entity_cut',
                          delete: 'ui.menu.entity_delete', gdelete: 'ui.menu.graph_delete' };
// Wide enough for the items' names with a submenu open beside them, over the menu
const _TYPE_MENU_MIN_WIDTH = 260;
const _MENU_BOX_STYLE = 'display:none;position:absolute;text-align:left;border:1px solid #444;box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2);color:var(--primary-text-color);background-color:var(--card-background-color);outline:none';

// The type menu et_N and its submenus et_N_<key>_sub — the card's (full: "Default" for a
// wildcard add, the layout and tests submenus, and for a graph the Y axis lock) and the
// info panel's
export function typeMenuHtml(i, full)
{
    const a = (id, label, hidden, style = '') => `<a id="${id}" href="#et" style="${_TYPE_MENU_ITEM_STYLE}${style}${hidden ? ';display:none' : ''}">${label}</a>`;
    const sub = (key, entries) => `<div id="et_${i}_${key}_sub" tabindex="0" style="${_MENU_BOX_STYLE};min-width:110px;z-index:3">${entries.join('')}</div>`;
    const keys = Object.keys(_TYPE_SUBMENUS).filter(k => full || !_CARD_ONLY_SUBMENUS.includes(k));
    // (the tests set apart from what concerns the entity)
    const itemStyle = k => k === 'tests' ? ';border-top:1px solid #444' : '';
    return `<div id="et_${i}" tabindex="0" style="${_MENU_BOX_STYLE};min-width:${_TYPE_MENU_MIN_WIDTH}px;z-index:2">
            <div id="et_${i}_title" style="margin:1px;padding:4px 9px;font-weight:600;background-color:var(--secondary-background-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
            ${keys.map(k => ( k === 'layout' ? a(`et_${i}_ylock`, '', true) : '' ) + a(`et_${i}_${k}`, i18n(_TYPE_SUBMENUS[k]) + ' ▸', true, itemStyle(k))).join('')}
        </div>
        ${sub('rep', [full ? a(`et_${i}_default`, i18n('ui.menu.type_default'), true) : '', ..._TYPE_MENU_ORDER.map(k => a(`et_${i}_${k}`, i18n(_TYPE_MENU_DEFS[k].label)))])}
        ${sub('interp', INTERPOLATIONS.map(k => a(`et_${i}_algo_${k}`, INTERPOLATION_LABELS[k])))}
        ${full ? sub('layout', Object.keys(_LAYOUT_ENTRIES).map(k => a(`et_${i}_${k}`, i18n(_LAYOUT_ENTRIES[k]), true))) : ''}
        ${full ? sub('tests', Object.keys(CARD_TESTS).map(k => a(`et_${i}_test_${k}`, i18n(CARD_TESTS[k].label)))) : ''}`;
}

export class CardMenus
{
    // --------------------------------------------------------------------------------------
    // Entity type menu: Representation ▸, Interpolation ▸, Layout ▸, Tests ▸ — and, for a
    // graph, Representation ▸ and Interpolation ▸ of all its curves, its Y axis lock and
    // Layout ▸
    // --------------------------------------------------------------------------------------

    // The type menu's names, in the card's language (set once it's known)
    relabelTypeMenu(i)
    {
        const set = (id, text) => { const _el = this._this.querySelector(`#${id}`); if( _el ) _el.innerHTML = text; };
        for( const k in _TYPE_SUBMENUS ) set(`et_${i}_${k}`, i18n(_TYPE_SUBMENUS[k]) + ' ▸');
        set(`et_${i}_default`, i18n('ui.menu.type_default'));
        _TYPE_MENU_DEFS.forEach((d, k) => set(`et_${i}_${k}`, i18n(d.label)));
        for( const k in _LAYOUT_ENTRIES ) set(`et_${i}_${k}`, i18n(_LAYOUT_ENTRIES[k]));
        for( const k in CARD_TESTS ) set(`et_${i}_test_${k}`, i18n(CARD_TESTS[k].label));
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

    // The entities the menu acts on — the graph's (a graph's menu), or the one entity — and
    // their graph
    _menuTargets(input_idx)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        const g = this.graphs.find(g => g.id === _menu?._hec_graph_id);
        if( !g ) return { g: null, entities: [] };
        return { g, entities: _menu._hec_for_graph ? g.entities : g.entities.filter(e => e.entity === _menu._hec_entity_id) };
    }

    // The line mode an entity is drawn with
    _lineModeOf(e)
    {
        return this.normalizeLineMode(e?.lineMode) || this.pconfig.defaultLineMode || 'curves';
    }

    // Is entity e of graph g shown as the type menu's entry def? (its own type — a bar
    // graph can also hold line entities)
    _isShownAs(e, g, def)
    {
        return ( e.type ?? g.type ) === def.type && ( def.lineMode === null || this._lineModeOf(e) === def.lineMode );
    }

    // Is entity e of graph g a curve that's interpolated (curves or smart mode — the only
    // modes interpolation applies to)?
    _isInterpolated(e, g)
    {
        const _mode = this._lineModeOf(e);
        return ( e.type ?? g.type ) === 'line' && ( _mode === 'curves' || _mode === 'smart' );
    }

    // Marks (bold, hecSelected) the interpolation algorithm in use for the menu's entity —
    // for a graph, the one all its interpolated curves share, if they do
    _markInterpolationMenu(input_idx)
    {
        const { g, entities } = this._menuTargets(input_idx);
        const _algos = new Set(entities.filter(e => this._isInterpolated(e, g)).map(e => this._resolveInterpolation(e)));
        const _cur = _algos.size === 1 ? [..._algos][0] : null;
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
        _menu._hec_for_graph = false;
        _menu._hec_anchor    = { clientX: anchorClientX, clientY: anchorClientY };
        this.hideTypeSubmenus(input_idx);

        const _isWildcard = Array.isArray(entity_id);
        const _e = graph?.entities.find(e => e.entity === entity_id);
        // Interpolation: for an entity already shown as an interpolated curve
        show(q('interp'), !!_e && this._isInterpolated(_e, graph));
        // Layout: an entity already in a graph, from a long-press on its own label
        const _longPress = !!graph && anchorClientX !== null && anchorClientY !== null;
        show(q('layout'), _longPress);
        show(q('split'), _longPress && this._canUncombine(graph));
        show(q('merge'), _longPress && this._canMergeLinkedGraph(graph));
        show(q('cut'), _longPress);
        show(q('delete'), _longPress);
        show(q('gdelete'), false);
        show(q('ylock'), false);
        show(q('rep'), true);
        show(q('tests'), true);

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
            this._markTypeMenu(input_idx, this._isNumericEntity(entity_id), d => !!_e && this._isShownAs(_e, graph, d));
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

    // The same menu for a graph — from a long-press (or a right click) on its lock+handle
    // zone at (clientX, clientY): what all its entities are shown as (the types that fit
    // every one of them, the one they share marked), how all its interpolated curves are
    // interpolated, its Y axis locked or released (yAxisLocked: its state, undefined when
    // it has no lock), and its layout — merge back, cut, delete. Opens with its layout
    // submenu.
    showGraphMenu(input_idx, graph, clientX, clientY, yAxisLocked)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        const q = id => this._this.querySelector(`#et_${input_idx}_${id}`);
        // (the info panel's menu has no layout: no graph menu there)
        if( !_menu || !q('layout') ) return;
        const show = (el, on) => { if( el ) el.style.display = on ? 'block' : 'none'; };

        _menu._hec_entity_id = null;
        _menu._hec_graph_id  = graph.id;
        _menu._hec_for_graph = true;
        _menu._hec_anchor    = { clientX, clientY };
        this.hideTypeSubmenus(input_idx);

        for( const k of ['tests', 'split', 'delete', 'default'] ) show(q(k), false);
        // (entities not all numeric: timeline the only choice — nothing to choose)
        const _numeric = graph.entities.every(e => this._isNumericEntity(e.entity));
        show(q('rep'), _numeric);
        this._markTypeMenu(input_idx, _numeric, d => graph.entities.every(e => this._isShownAs(e, graph, d)));
        show(q('interp'), graph.entities.some(e => this._isInterpolated(e, graph)));
        show(q('layout'), true);
        show(q('merge'), this._canMergeLinkedGraph(graph));
        show(q('cut'), true);
        show(q('gdelete'), !graph.isStatic);
        const _lock = q('ylock');
        show(_lock, yAxisLocked !== undefined);
        if( _lock ) {
            _lock.textContent = i18n(yAxisLocked ? 'ui.menu.yunlock' : 'ui.menu.ylock');
            _lock.dataset.hecLocked = yAxisLocked ? '1' : '';
        }

        const _titleEl = q('title');
        if( _titleEl ) {
            _titleEl.textContent = this._graphMenuTitle(graph);
            _titleEl.style.border = '';
            _titleEl.style.borderBottom = '1px solid #444';
        }

        const _tb = this._this.querySelector(`#tb_${input_idx}`);
        const _parentRect = _tb ? _tb.getBoundingClientRect() : { top: 0, left: 0 };
        this._openMenu(_menu, (clientY - _parentRect.top) + 'px', (clientX - _parentRect.left) + 'px');
        this.showTypeSubmenu(input_idx, 'layout');
    }

    // A graph's name at the top of its menu: its title, else the start of its curves' names
    // — their first two words, '...' when cut — each start once
    _graphMenuTitle(graph)
    {
        const _title = this.pconfig.graphs[graph.groupId]?.title;
        if( _title ) return _title;
        const _starts = graph.entities.map(e => {
            const _words = String(e.name ?? this.stateOf(e.entity)?.attributes?.friendly_name ?? e.entity).trim().split(/\s+/);
            return _words.slice(0, 2).join(' ') + ( _words.length > 2 ? '...' : '' );
        });
        return [...new Set(_starts)].join(', ');
    }

    // The graph menu's Y axis entry: the graph's Y axes locked or released
    graphLockClicked(input_idx)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        const _g = this.graphs.find(g => g.id === _menu?._hec_graph_id);
        const _locked = !!this._this.querySelector(`#et_${input_idx}_ylock`)?.dataset.hecLocked;
        this.hideEntityTypeMenu(input_idx);
        _g?.chart.hecSetYAxisLocked(!_locked);
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

    // The type menu's submenus present in this menu (the info panel's has no layout, no tests)
    _typeSubmenus(input_idx)
    {
        return Object.keys(_TYPE_SUBMENUS).map(k => this._this.querySelector(`#et_${input_idx}_${k}_sub`)).filter(s => s);
    }

    // Opens the type menu's submenu key over the menu, level with its item — the one
    // open before closes — and gives it the keyboard: the first arrow key highlights its
    // marked entry, Enter takes it right away. Its item in the menu is in bold while it's open
    showTypeSubmenu(input_idx, key)
    {
        const _item = this._this.querySelector(`#et_${input_idx}_${key}`);
        const _sub  = this._this.querySelector(`#et_${input_idx}_${key}_sub`);
        if( !_item || !_sub || _item.style.display === 'none' ) return;
        this.hideTypeSubmenus(input_idx);
        if( key === 'interp' ) this._markInterpolationMenu(input_idx);
        _item.style.fontWeight = 'bold';
        this._openSubmenu(_sub, _item);
        _sub.focus();
    }

    // Closes the type menu's submenus (their keyboard highlight cleared, their marks kept,
    // their items in the menu no longer in bold), and with backToMenu gives the keyboard
    // back to the menu
    hideTypeSubmenus(input_idx, backToMenu = false)
    {
        for( const _sub of this._typeSubmenus(input_idx) ) {
            for( let _a of _sub.getElementsByTagName('a') ) _a.style.background = '';
            _sub.style.display = 'none';
        }
        for( const k in _TYPE_SUBMENUS ) {
            const _item = this._this.querySelector(`#et_${input_idx}_${k}`);
            if( _item ) _item.style.fontWeight = '';
        }
        if( backToMenu ) this._this.querySelector(`#et_${input_idx}`)?.focus();
    }

    // Listeners of the type menu et_N and its submenus — shared by the card and the info
    // panel (whose menu has no "Default", no layout and no tests)
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
        for( const k in _LAYOUT_ENTRIES ) _on(k, () => this.entityLayoutClicked(_ii, k));
        _on('ylock', () => this.graphLockClicked(_ii));
        for( const k in CARD_TESTS ) _on(`test_${k}`, () => { this.hideEntityTypeMenu(_ii); openCardTest(k); });
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

    // The interpolation algo for the menu's entity — for a graph, for all its interpolated
    // curves
    entityInterpolationClicked(input_idx, algo)
    {
        const { g, entities } = this._menuTargets(input_idx);
        this.hideEntityTypeMenu(input_idx);
        if( !g ) return;
        for( const e of entities ) {
            if( !this._isInterpolated(e, g) ) continue;
            // (g.entities[i] is the entity's entry in the store itself: saved with it)
            e.interpolation = algo;
            const _ds = g.chart.data.datasets[g.entities.indexOf(e)];
            if( _ds ) _ds.hecInterpolation = algo;
        }
        g.chart.update();
        this.writeLocalState();
    }

    // Layout: the entity taken out into its own graph (as a double-click on its
    // label), its linked graph merged back into the one above (as a double-click on the
    // chain icon), the entity — or, from the graph menu, the graph — cut to be put
    // elsewhere (as a drag, see _startCut), the entity or the graph deleted
    entityLayoutClicked(input_idx, action)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        if( !_menu ) return;
        const _g = this.graphs.find(g => g.id === _menu._hec_graph_id);
        const _forGraph = _menu._hec_for_graph;
        const _idx = _g ? _g.entities.findIndex(e => e.entity === _menu._hec_entity_id) : -1;
        const _anchor = _menu._hec_anchor;
        this.hideEntityTypeMenu(input_idx);
        if( !_g || ( !_forGraph && _idx < 0 ) ) return;
        if( action === 'merge' ) this._mergeLinkedGraph(_g, _anchor);
        else if( action === 'cut' ) this._startCut(_g, _forGraph ? null : _idx);
        else if( action === 'gdelete' ) this._removeGraph(_g);
        else if( action === 'split' ) this._uncombineEntity(_g, _idx);
        else this._deleteEntity(_g, _idx);
    }

    entityTypeMenuClicked(input_idx, type, lineMode)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        if( !_menu ) return;
        const _entity_id = _menu._hec_entity_id;
        const _graph_id  = _menu._hec_graph_id;
        const _forGraph  = _menu._hec_for_graph;
        this.hideEntityTypeMenu(input_idx);

        if( _forGraph ) return this._setGraphType(this.graphs.find(g => g.id === _graph_id), type, lineMode);
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
                this._setLineMode(_g, _g.entities.findIndex(e => e.entity === _entity_id), lineMode);
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
                // Re-add remaining entities. fill is not kept across a type change: it's derived
                // from color+type, not a type-independent value — null, so addGraph recomputes
                // it for the target type (transparent for line/arrowline/timeline, solid for bar).
                this._rebuildGraph(_newEntities, _origGroupId, _nextG, { fill: null });
                // Re-add extracted entity — color only; fill recomputed for the new type (see
                // above). Goes right before whatever followed the original graph _g — i.e.
                // right after the just-rebuilt remaining-entities graph.
                this.addGraph(_entity.entity, { color: _pcEntry?.color ?? _entity.color, before: _nextG, interval: _entity.interval, groupId: _origGroupId, entry: _pcEntry ?? _entity });
                // Sync the freshly-computed fill (correct for the NEW type) back into
                // pconfig.entities, so persistence stays consistent with what the next
                // rebuild will read as its fill — no need to special-case fill at rebuild time
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

    // Entity idx of graph g drawn in lineMode, its type unchanged
    _setLineMode(g, idx, lineMode)
    {
        const _mode = this.normalizeLineMode(lineMode);
        const _ds = g.chart.data.datasets[idx];
        if( _ds ) {
            _ds.steppedLine = _mode === 'stepped';
            _ds.lineTension = (_mode === 'lines' || _mode === 'stepped') ? 0 : 0.1;
        }
        // (in memory too, so the menu marks it next time)
        if( g.entities[idx] ) g.entities[idx].lineMode = _mode;
    }

    // From a graph's menu: every entity of graph g shown as type (lineMode), saved with
    // each — the graph rebuilt once, in its place, when their types change
    _setGraphType(g, type, lineMode)
    {
        if( !g ) return;
        const _sameType = g.entities.every(e => ( e.type ?? g.type ) === type);
        for( const e of g.entities ) {
            const _entry = this.store.entry(e.entity);
            if( _entry ) { _entry.type = type; _entry.lineMode = lineMode; }
        }
        if( _sameType ) {
            g.entities.forEach((e, i) => this._setLineMode(g, i, lineMode));
            g.chart.update();
            this.updateHistory();
        } else {
            const _entities = g.entities;
            const _nextG = this._nextGraph(g);
            this._detachGraph(g);
            // (fill recomputed for the new type, as for one entity — see entityTypeMenuClicked)
            _entities.forEach(e => { e.type = type; e.lineMode = lineMode; e.siConversionFactor = undefined; });
            this._rebuildGraph(_entities, g.groupId, _nextG, { fill: null });
            for( const e of _entities ) {
                const _entry = this.store.entry(e.entity);
                const _shown = this.graphs.find(_g => _g.entities.some(x => x.entity === e.entity))?.entities.find(x => x.entity === e.entity);
                if( _entry && _shown ) _entry.fill = _shown.fill;
            }
            this._updateMoVisibility();
            this._updateGroupLinkMarkers();
            this.updateHistoryWithClearCache();
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
    // Keyboard navigation in the menus
    // --------------------------------------------------------------------------------------

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


    // --------------------------------------------------------------------------------------
    // Menu navigation and the entities they act on
    // --------------------------------------------------------------------------------------

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

    // Opens a submenu over its menu, level with the item that opens it, its right edge on the
    // menu's right edge — so it takes no room beside the menu — and, like every menu
    // (_openMenu), kept within the card and the viewport. The submenu must share the menu's
    // positioned parent (both are its children).
    _openSubmenu(subEl, itemEl)
    {
        const _menu = itemEl.offsetParent;
        const _cb = (_menu?.offsetParent ?? document.body).getBoundingClientRect();
        const _item = itemEl.getBoundingClientRect();
        this._openMenu(subEl, (_item.top - _cb.top) + 'px', (_menu.getBoundingClientRect().right - _cb.left) + 'px', 'right');
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

    _createAndPersistEntity(eid, type, lineMode)
    {
        // Creates one brand-new entity with an explicit type and persists it —
        // shared by the non-numeric direct-create path and the type-menu new-entity path
        // addGraph registers _entry itself as the entity's pconfig.entities entry (and adopts
        // the groupId of the graph it combined into, if any) — it must not be pushed a second
        // time here: a duplicate entry, never displayed, used to carry the groupId instead,
        // leaving the displayed one with none (so a type change couldn't link its graphs).
        const _entry = { type, lineMode };
        this.addGraph(eid, { entry: _entry });
        const _g = this.graphs.find(g => g.entities.includes(_entry));
        if( _g && ( _g.groupId === null || _g.groupId === undefined ) ) {
            // A brand-new graph (or one left without a group by that old bug): a group of its own
            const _gid = this.store.newGroupId();
            _g.groupId = _gid;
            _g.entities.forEach(e => { e.groupId = _gid; });
        }
        return this.stateOf(eid)?.attributes?.friendly_name || eid;
    }
}
