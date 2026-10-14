// The card's menus: the type menu of an entity — the same menu for a graph (the display
// and interpolation of all its curves, its Y axis lock, its layout) — and the options
// menu, with their keyboard navigation. Part of HistoryCardState (added to it in
// history-explorer-card.js).

import { i18n } from "./languages.js";
import { INTERPOLATIONS, INTERPOLATION_LABELS } from "./history-options.js";
import { CARD_TESTS, openCardTest } from "./card-tests.js";
import { GESTURE_SETTINGS } from "./gesture-settings.js";
import { localGestures, infoPanelEnabled } from "./card-storage.js";
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
export const _TYPE_MENU_ITEM_STYLE = 'display:block;padding:5px 10px;text-decoration:none;color:inherit;overflow:hidden;text-overflow:ellipsis';

// The type menu's items, each opening its submenu over the menu, right-aligned, level with
// it: what the entity is shown as (open when the menu opens), how its curve is
// interpolated, what to do with it in its graph (from a long-press), and, last, the tests
// a user can run to report what their browser or app gives the card (card-tests.js)
const _TYPE_SUBMENUS = { rep: 'ui.menu.type_representation', interp: 'ui.menu.type_interpolation', layout: 'ui.menu.type_layout', tests: 'ui.menu.type_tests' };
// The submenus only the card's menu has, not the info panel's
const _CARD_ONLY_SUBMENUS = ['layout', 'tests'];
// The layout submenu's entries (et_N_<key>): for an entity (its samples' dots shown or
// hidden, separate, merge back, cut, delete) or for a graph (its curves' dots, its Y axis
// locked or released, merge back, cut, delete the graph). The dots and the lock are named
// by what a click does (shown: their label for now)
const _LAYOUT_ENTRIES = { points: 'ui.menu.points_show', ylock: 'ui.menu.ylock', split: 'ui.menu.entity_split',
                          merge: 'ui.menu.entity_merge', cut: 'ui.menu.entity_cut',
                          delete: 'ui.menu.entity_delete', gdelete: 'ui.menu.graph_delete' };
// Wide enough for the items' names with a submenu open beside them, over the menu
const _TYPE_MENU_MIN_WIDTH = 260;
// A submenu's lines on one line each, whatever the room beside its menu (it opens over it,
// right-aligned on it: see openSubmenu)
const _SUBMENU_STYLE = 'white-space:nowrap';
const _MENU_BOX_STYLE = 'display:none;position:absolute;text-align:left;border:1px solid #444;box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2);color:var(--primary-text-color);background-color:var(--card-background-color);outline:none';

// The type menu et_N and its submenus et_N_<key>_sub — the card's (full: "Default" for a
// wildcard add, the layout and tests submenus) and the info panel's
export function typeMenuHtml(i, full)
{
    const a = (id, label, hidden, style = '') => `<a id="${id}" href="#et" style="${_TYPE_MENU_ITEM_STYLE}${style}${hidden ? ';display:none' : ''}">${label}</a>`;
    const sub = (key, entries) => `<div id="et_${i}_${key}_sub" tabindex="0" style="${_MENU_BOX_STYLE};${_SUBMENU_STYLE};min-width:110px;z-index:3">${entries.join('')}</div>`;
    const keys = Object.keys(_TYPE_SUBMENUS).filter(k => full || !_CARD_ONLY_SUBMENUS.includes(k));
    // (the tests set apart from what concerns the entity)
    const itemStyle = k => k === 'tests' ? ';border-top:1px solid #444' : '';
    // (Info: the entity's dialog, as a click on its value — before the tests; the card's only)
    const line = k => a(`et_${i}_${k}`, i18n(_TYPE_SUBMENUS[k]) + ' ▸', true, itemStyle(k));
    return `<div id="et_${i}" tabindex="0" style="${_MENU_BOX_STYLE};min-width:${_TYPE_MENU_MIN_WIDTH}px;z-index:2">
            <div id="et_${i}_title" style="margin:1px;padding:4px 9px;font-weight:600;background-color:var(--secondary-background-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
            ${keys.filter(k => k !== 'tests').map(line).join('')}${full ? a(`et_${i}_info`, i18n('ui.menu.entity_info'), true) : ''}${keys.includes('tests') ? line('tests') : ''}
        </div>
        ${sub('rep', [full ? a(`et_${i}_default`, i18n('ui.menu.type_default'), true) : '', ..._TYPE_MENU_ORDER.map(k => a(`et_${i}_${k}`, i18n(_TYPE_MENU_DEFS[k].label)))])}
        ${sub('interp', INTERPOLATIONS.map(k => a(`et_${i}_algo_${k}`, INTERPOLATION_LABELS[k])))}
        ${full ? sub('layout', Object.keys(_LAYOUT_ENTRIES).map(k => a(`et_${i}_${k}`, i18n(_LAYOUT_ENTRIES[k]), true))) : ''}
        ${full ? sub('tests', Object.keys(CARD_TESTS).map(k => a(`et_${i}_test_${k}`, i18n(CARD_TESTS[k].label)))) : ''}`;
}

// How long a closed menu remembers the submenu it had open (see _submenuToOpen)
const SUBMENU_MEMORY_MS = 10000;

// The options menu eo_N (the card's toolbar): its items, each opening its submenu
// eo_N_<key>_sub — what the card exports, what concerns this card (the entities added from
// it), and what concerns every card of the page and every device (the info panel, the
// gesture thresholds — entered in the submenu itself, kept within their bounds)
const _OPTIONS_SUBMENUS = { export: 'ui.menu.options_export', card: 'ui.menu.options_card', all: 'ui.menu.options_all' };
// The options menu's actions confirmed first, each in a submenu of its own over the
// submenu its line is in (`${line}_sub`: Confirm / Cancel — Cancel marked, so that Enter
// changes nothing): in Card ▸, the graphs added from the card removed (defaultGraphs) and
// everything back to the YAML (defaultDisplay); in Global ▸, the info panel switched
// (toggleInfoPanel). line: the line's id; label: its name (none: named by its owner)
const _CARD_ACTIONS = { defgraphs: { label: 'ui.menu.default_graphs', run: 'defaultGraphs' },
                        defdisplay: { label: 'ui.menu.default_display', run: 'defaultDisplay' } };
const _CONFIRMED = i => [
    ...Object.keys(_CARD_ACTIONS).map(k => ({ line: `eo_${i}_${k}`, in: 'card', ..._CARD_ACTIONS[k] })),
    { line: `ei_${i}`, in: 'all', run: 'toggleInfoPanel' },
];
export function optionsMenuHtml(i, statistics)
{
    const a = (id, label = '') => `<a id="${id}" href="#" style="${_TYPE_MENU_ITEM_STYLE}">${label}</a>`;
    const sub = (key, entries) => `<div id="eo_${i}_${key}_sub" tabindex="0" style="${_MENU_BOX_STYLE};${_SUBMENU_STYLE};min-width:150px;z-index:3">${entries.join('')}</div>`;
    const input = k => { const s = GESTURE_SETTINGS[k];
        return `<label style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 10px;white-space:nowrap"><span id="eo_${i}_gl_${k}" style="overflow:hidden;text-overflow:ellipsis;min-width:0">${i18n(s.label)}</span>` +
               `<input id="eo_${i}_g_${k}" type="number" min="${s.min}" max="${s.max}" step="${s.step}" style="width:5em;color:inherit;background:transparent;border:1px solid #888"></label>`; };
    return `<div id="eo_${i}" tabindex="0" style="${_MENU_BOX_STYLE};min-width:150px;z-index:1">
            ${Object.keys(_OPTIONS_SUBMENUS).map(k => a(`eo_${i}_${k}`, i18n(_OPTIONS_SUBMENUS[k]) + ' ▸')).join('')}
        </div>
        ${sub('export', [a(`ef_${i}`), statistics ? a(`eh_${i}`) : ''])}
        ${sub('card', Object.keys(_CARD_ACTIONS).map(k => a(`eo_${i}_${k}`, i18n(_CARD_ACTIONS[k].label))))}
        ${sub('all', [a(`ei_${i}`), ...Object.keys(GESTURE_SETTINGS).map(input)])}
        ${_CONFIRMED(i).map(c => `<div id="${c.line}_sub" tabindex="0" style="${_MENU_BOX_STYLE};${_SUBMENU_STYLE};z-index:4">` +
            a(`${c.line}_ok`, i18n('ui.menu.confirm_ok')) + a(`${c.line}_cancel`, i18n('ui.menu.confirm_cancel')) + `</div>`).join('')}`;
}

export class CardMenus
{
    // --------------------------------------------------------------------------------------
    // Entity type menu: Representation ▸, Interpolation ▸, Layout ▸, Tests ▸ — and, for a
    // graph, Representation ▸ and Interpolation ▸ of all its curves, and Layout ▸ (its
    // curves' dots, its Y axis lock)
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
        set(`et_${i}_info`, i18n('ui.menu.entity_info'));
    }

    // Shows the representation submenu's entries for an entity — only Timeline when it
    // isn't numeric — and marks (bold, selected) the one isActive(def) says is current
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
            if( _active ) _el.dataset.selected = '1'; else delete _el.dataset.selected;
        });
    }

    // The entities the menu acts on — the graph's (a graph's menu), or the one entity — and
    // their graph
    _menuTargets(input_idx)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        const g = this.graphs.find(g => g.id === _menu?._menuGraphId);
        if( !g ) return { g: null, entities: [] };
        return { g, entities: _menu._menuForGraph ? g.entities : g.entities.filter(e => e.entity === _menu._menuEntityId) };
    }

    // Is entity e of graph g shown as the type menu's entry def? (its own type — a bar
    // graph can also hold line entities)
    _isShownAs(e, g, def)
    {
        return ( e.type ?? g.type ) === def.type && ( def.lineMode === null || this.lineModeOf(e) === def.lineMode );
    }

    // Marks (bold, selected) the interpolation algorithm in use for the menu's entity —
    // for a graph, the one all its interpolated curves share, if they do
    _markInterpolationMenu(input_idx)
    {
        const { g, entities } = this._menuTargets(input_idx);
        const _algos = new Set(entities.filter(e => this.isInterpolated(e, g)).map(e => this.resolveInterpolation(e)));
        const _cur = _algos.size === 1 ? [..._algos][0] : null;
        INTERPOLATIONS.forEach(k => {
            const _el = this._this.querySelector(`#et_${input_idx}_algo_${k}`);
            if( !_el ) return;
            _el.style.fontWeight = k === _cur ? 'bold' : '';
            if( k === _cur ) _el.dataset.selected = '1'; else delete _el.dataset.selected;
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
        _menu._menuEntityId = entity_id;
        _menu._menuGraphId  = graph ? graph.id : null;
        _menu._menuForGraph = false;
        _menu._menuAnchor    = { clientX: anchorClientX, clientY: anchorClientY };
        this.hideTypeSubmenus(input_idx);

        const _isWildcard = Array.isArray(entity_id);
        const _e = graph?.entities.find(e => e.entity === entity_id);
        // Interpolation: for an entity already shown as an interpolated curve
        show(q('interp'), !!_e && this.isInterpolated(_e, graph));
        // Layout: an entity already in a graph, from a long-press on its own label
        const _longPress = !!graph && anchorClientX !== null && anchorClientY !== null;
        show(q('layout'), _longPress);
        show(q('split'), _longPress && this.canSplitCurve(graph));
        show(q('merge'), _longPress && this.canMergeGraphUp(graph));
        show(q('cut'), _longPress);
        show(q('delete'), _longPress);
        show(q('gdelete'), false);
        show(q('ylock'), false);
        // (Info: an entity shown, from its label)
        show(q('info'), _longPress);
        // (a curve: its samples' dots)
        const _points = q('points');
        const isCurve = _longPress && !!_e && this.isCurve(graph, graph.entities.indexOf(_e));
        show(_points, isCurve);
        if( _points && isCurve )
            _points.textContent = i18n(this.curvesShowPoints(graph, [_e]) ? 'ui.menu.points_hide' : 'ui.menu.points_show');
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
            this._markTypeMenu(input_idx, this.isNumericEntity(entity_id), d => !!_e && this._isShownAs(_e, graph, d));
        } else if( _isWildcard ) {
            // Brand-new entities from a wildcard match: "Default" (each entity's own
            // auto-detected type) offered and pre-selected — unless none of them is
            // numeric, timeline then being the only possible outcome
            const _anyNumeric = entity_id.some(eid => this.isNumericEntity(eid));
            if( _defaultEl && _anyNumeric ) {
                show(_defaultEl, true);
                _defaultEl.style.background = '';
                _defaultEl.style.fontWeight = 'bold';
                _defaultEl.dataset.selected = '1';
            }
            this._markTypeMenu(input_idx, _anyNumeric, d => !_anyNumeric && d.type === 'timeline');
        } else {
            // Brand-new single entity: its own auto-detected type (YAML/state/unit)
            // pre-selected, same as what addGraph would pick
            const _numeric = this.isNumericEntity(entity_id);
            const _detected = _numeric ? this.detectDefaultType(entity_id) : { type: 'timeline', lineMode: null };
            this._markTypeMenu(input_idx, _numeric, d => d.type === _detected.type && (d.lineMode === null || d.lineMode === _detected.lineMode));
        }

        // Position — #tb_N directly, not _menu.offsetParent — offsetParent of a display:none
        // element is always null, and _menu still has display:none at this exact point
        // (before openMenu turns it on). #tb_N is already known to be the real positioned
        // ancestor (see its position:relative in the HTML), no need to read it back off an
        // element that isn't shown yet.
        const _tb = this._menuParent(input_idx);
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
        this.openMenu(_menu, _top, _left, align);
        this._openRememberedSubmenu(input_idx, 'rep');
    }

    // The same menu for a graph — from a long-press (or a right click) on its lock+handle
    // zone at (clientX, clientY): what all its entities are shown as (the types that fit
    // every one of them, the one they share marked), how all its interpolated curves are
    // interpolated, and its layout — its curves' dots shown or hidden, its Y axis locked or
    // released (yAxisLocked: its state, undefined when it has no lock), merge back, cut,
    // delete. Opens with its layout submenu.
    showGraphMenu(input_idx, graph, clientX, clientY, yAxisLocked)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        const q = id => this._this.querySelector(`#et_${input_idx}_${id}`);
        // (the info panel's menu has no layout: no graph menu there)
        if( !_menu || !q('layout') ) return;
        const show = (el, on) => { if( el ) el.style.display = on ? 'block' : 'none'; };

        _menu._menuEntityId = null;
        _menu._menuGraphId  = graph.id;
        _menu._menuForGraph = true;
        _menu._menuAnchor    = { clientX, clientY };
        this.hideTypeSubmenus(input_idx);

        for( const k of ['tests', 'split', 'delete', 'default', 'info'] ) show(q(k), false);
        // (entities not all numeric: timeline the only choice — nothing to choose)
        const _numeric = graph.entities.every(e => this.isNumericEntity(e.entity));
        show(q('rep'), _numeric);
        this._markTypeMenu(input_idx, _numeric, d => graph.entities.every(e => this._isShownAs(e, graph, d)));
        show(q('interp'), graph.entities.some(e => this.isInterpolated(e, graph)));
        show(q('layout'), true);
        show(q('merge'), this.canMergeGraphUp(graph));
        show(q('cut'), true);
        show(q('gdelete'), !graph.isStatic);
        const _points = q('points'), _shown = this.curvesShowPoints(graph);
        show(_points, _shown !== undefined);
        if( _points ) _points.textContent = i18n(_shown ? 'ui.menu.points_hide' : 'ui.menu.points_show');
        const _lock = q('ylock');
        show(_lock, yAxisLocked !== undefined);
        if( _lock ) {
            _lock.textContent = i18n(yAxisLocked ? 'ui.menu.yunlock' : 'ui.menu.ylock');
            _lock.dataset.locked = yAxisLocked ? '1' : '';
        }

        const _titleEl = q('title');
        if( _titleEl ) {
            _titleEl.textContent = this._graphMenuTitle(graph);
            _titleEl.style.border = '';
            _titleEl.style.borderBottom = '1px solid #444';
        }

        const _tb = this._menuParent(input_idx);
        const _parentRect = _tb ? _tb.getBoundingClientRect() : { top: 0, left: 0 };
        this.openMenu(_menu, (clientY - _parentRect.top) + 'px', (clientX - _parentRect.left) + 'px');
        this._openRememberedSubmenu(input_idx, _numeric ? 'rep' : 'layout');
    }

    // --------------------------------------------------------------------------------------
    // A menu reopened soon after it was closed opens the submenu it had open, rather than
    // its default one: each kind of menu (an entity's type menu, a graph's, the options
    // menu) remembers its last open submenu, for SUBMENU_MEMORY_MS once closed. A new
    // entity's type menu always opens on its display types: it's there to pick one
    // --------------------------------------------------------------------------------------

    // The kind of type menu input_idx is showing now
    _typeMenuKind(input_idx)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        return _menu?._menuForGraph ? 'graph' : _menu?._menuGraphId === null ? 'add' : 'entity';
    }

    // The submenu a menu of this kind should open with: the one it had open, if it was
    // closed less than SUBMENU_MEMORY_MS ago, else def
    _submenuToOpen(kind, def)
    {
        if( kind === 'add' ) return def;
        const _m = this._menuMemory?.[kind];
        return _m?.key && _m.closedAt && Date.now() - _m.closedAt < SUBMENU_MEMORY_MS ? _m.key : def;
    }

    _rememberSubmenu(kind, key)
    {
        this._menuMemory ??= {};
        this._menuMemory[kind] = { key, closedAt: null };
    }

    // (a menu closed: from then on, its open submenu is remembered for SUBMENU_MEMORY_MS —
    // called again once closed, it changes nothing)
    _menuClosed(kind)
    {
        const _m = this._menuMemory?.[kind];
        if( _m && !_m.closedAt ) _m.closedAt = Date.now();
    }

    // Opens the type menu's remembered submenu — else def — once the menu is open (a
    // remembered submenu this menu doesn't show: def)
    _openRememberedSubmenu(input_idx, def)
    {
        // (no room for the menu and a submenu beside its lines: the menu alone, read first —
        // with the keyboard, so that Escape, or the focus leaving it, closes it)
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        if( _menu?.dataset.cramped ) { _menu.focus(); return; }
        const _key = this._submenuToOpen(this._typeMenuKind(input_idx), def);
        this.showTypeSubmenu(input_idx, _key);
        if( _key !== def && this._this.querySelector(`#et_${input_idx}_${_key}_sub`)?.style.display === 'none' )
            this.showTypeSubmenu(input_idx, def);
    }

    // A graph's name at the top of its menu: its title, else the start of its curves' names
    // — up to their second word (Chart.hecUi.isWord), '...' when cut — each start once
    _graphMenuTitle(graph)
    {
        const _title = this.pconfig.graphs[graph.groupId]?.title;
        if( _title ) return _title;
        const _starts = graph.entities.map(e => {
            // (words as Chart.hecUi.isWord counts them: an attribute's ':' between its
            // entity's name and its own is kept, not counted — "salon : Current...")
            const _words = String(e.name ?? this.stateOf(e.entity)?.attributes?.friendly_name ?? e.entity).trim().split(/\s+/);
            const _counted = _words.map((w, i) => _words.slice(0, i + 1).filter(Chart.hecUi.isWord).length);
            const _n = _counted.indexOf(2) + 1 || _words.length;
            return _words.slice(0, _n).join(' ') + ( _n < _words.length ? '...' : '' );
        });
        return [...new Set(_starts)].join(', ');
    }

    hideEntityTypeMenu(input_idx)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        if( !_menu ) return;
        this._menuClosed(this._typeMenuKind(input_idx));
        this.hideTypeSubmenus(input_idx);
        // Clear highlight and marks, the submenus' included
        for( const _box of [_menu, ...this._typeSubmenus(input_idx)] )
            for( let _a of _box.getElementsByTagName('a') ) {
                _a.style.background = '';
                _a.style.fontWeight = '';
                delete _a.dataset.selected;
            }
        _menu.style.display = 'none';
        this.resetEntityInput(this.ui.inputField[input_idx]);
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
        this._rememberSubmenu(this._typeMenuKind(input_idx), key);
        _item.style.fontWeight = 'bold';
        this.openSubmenu(_sub, _item);
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
    initEntityTypeMenu(_ii)
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
        for( const k in CARD_TESTS ) _on(`test_${k}`, () => { this.hideEntityTypeMenu(_ii); openCardTest(k); });
        _on('info', () => { const _id = _etMenu._menuEntityId; this.hideEntityTypeMenu(_ii); this.openEntityInfo(_id); });
        // Keyboard navigation — Enter or → on an item opens its submenu
        _etMenu.addEventListener('keydown', (e) => {
            const _sel = _etMenu.querySelector('a[data-selected]');
            if( e.key === 'ArrowRight' && _sel?.style.background ) {
                e.preventDefault();
                _sel.click();
                return;
            }
            this.menuKeyDown(e, _etMenu, {
                onClose: () => { this._menuClosed(this._typeMenuKind(_ii)); this.hideTypeSubmenus(_ii); this.resetEntityInput(this.ui.inputField[_ii]); },
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
            this.menuKeyDown(e, _sub);
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
        if( g ) this.setInterpolation(g, entities, algo);
    }

    // Layout: the entity's samples' dots — or, from the graph menu, its curves' — shown or
    // hidden (as a long-press on a curve), the graph's Y axes locked or released (as a
    // click on the padlock), the entity taken out into its own graph (as a double-click on
    // its label), its linked graph merged back into the one above (as a double-click on the
    // chain icon), the entity — or the graph — cut to be put elsewhere (as a drag, see
    // startCut), the entity or the graph deleted
    entityLayoutClicked(input_idx, action)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        if( !_menu ) return;
        const _g = this.graphs.find(g => g.id === _menu._menuGraphId);
        const _forGraph = _menu._menuForGraph;
        const _idx = _g ? _g.entities.findIndex(e => e.entity === _menu._menuEntityId) : -1;
        const _anchor = _menu._menuAnchor;
        const _locked = !!this._this.querySelector(`#et_${input_idx}_ylock`)?.dataset.locked;
        this.hideEntityTypeMenu(input_idx);
        if( !_g || ( !_forGraph && _idx < 0 ) ) return;
        if( action === 'points' ) this.toggleCurvePoints(_g, _forGraph ? _g.entities : [_g.entities[_idx]]);
        else if( action === 'ylock' ) _g.chart.hecSetYAxisLocked(!_locked);
        else if( action === 'merge' ) {
            const _why = this.mergeGraphUp(_g);
            if( _why ) this.showMessage(_why, _anchor.clientX, _anchor.clientY, 'left', _g.canvas);
        }
        else if( action === 'cut' ) this.startCut(_g, _forGraph ? null : _idx);
        else if( action === 'gdelete' ) this.removeGraph(_g);
        else if( action === 'split' ) this.splitCurve(_g, _idx);
        else this.deleteCurve(_g, _idx);
    }

    entityTypeMenuClicked(input_idx, type, lineMode)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        if( !_menu ) return;
        const _entity_id = _menu._menuEntityId;
        const _graph_id  = _menu._menuGraphId;
        const _forGraph  = _menu._menuForGraph;
        this.hideEntityTypeMenu(input_idx);
        const _g = this.graphs.find(g => g.id === _graph_id);
        if( _forGraph ) return _g && this.setGraphType(_g, type, lineMode);
        if( !_entity_id ) return;
        if( _graph_id === null ) {
            // Brand-new entities (a wildcard: several), created now as chosen — their names
            // shown a moment in the selector's field
            return this.showAdded(input_idx, this.addCurves(Array.isArray(_entity_id) ? _entity_id : [_entity_id], type, lineMode));
        }
        const _idx = _g ? _g.entities.findIndex(e => e.entity === _entity_id) : -1;
        if( _idx >= 0 ) this.setCurveType(_g, _idx, type, lineMode);
    }

    // --------------------------------------------------------------------------------------
    // Entity option dropdown menu
    // --------------------------------------------------------------------------------------

    // --------------------------------------------------------------------------------------
    // The options menu (eo_N, see optionsMenuHtml)
    // --------------------------------------------------------------------------------------

    // The options menu's submenus, the confirmations included
    _optionsSubmenus(i)
    {
        return [...Object.keys(_OPTIONS_SUBMENUS).map(k => `eo_${i}_${k}_sub`), ..._CONFIRMED(i).map(c => `${c.line}_sub`)]
            .map(id => this._this.querySelector(`#${id}`)).filter(s => s);
    }

    // Asks for the confirmation of action c over the submenu its line is in (Cancel marked)
    _confirmAction(i, c)
    {
        const _item = this._this.querySelector(`#${c.line}`);
        const _sub  = this._this.querySelector(`#${c.line}_sub`);
        if( !_item || !_sub ) return;
        for( const o of _CONFIRMED(i) ) if( o !== c ) this._this.querySelector(`#${o.line}_sub`).style.display = 'none';
        this.openSubmenu(_sub, _item);
        delete this._this.querySelector(`#${c.line}_ok`).dataset.selected;
        this._this.querySelector(`#${c.line}_cancel`).dataset.selected = '1';
        _sub.focus();
    }

    // The options menu's names, in the card's language
    relabelOptionsMenu(i)
    {
        for( const k in _OPTIONS_SUBMENUS ) { const _el = this._this.querySelector(`#eo_${i}_${k}`); if( _el ) _el.textContent = i18n(_OPTIONS_SUBMENUS[k]) + ' ▸'; }
        const set = (id, text) => { const _el = this._this.querySelector(`#${id}`); if( _el ) _el.textContent = text; };
        for( const c of _CONFIRMED(i) ) {
            if( c.label ) set(c.line, i18n(c.label));
            set(`${c.line}_ok`, i18n('ui.menu.confirm_ok'));
            set(`${c.line}_cancel`, i18n('ui.menu.confirm_cancel'));
        }
        for( const k in GESTURE_SETTINGS ) { const _el = this._this.querySelector(`#eo_${i}_gl_${k}`); if( _el ) _el.textContent = i18n(GESTURE_SETTINGS[k].label); }
        set(`ef_${i}`, i18n('ui.menu.export_csv'));
        set(`eh_${i}`, i18n('ui.menu.export_stats'));
        this.showInfoPanelSwitch();
    }

    // The options menu's info panel line, as the panel is (on: to switch it off)
    showInfoPanelSwitch()
    {
        for( const ei of [...this._this.querySelectorAll('[id^="ei_"]')].filter(e => /^ei_\d+$/.test(e.id)) )
            ei.textContent = i18n(infoPanelEnabled ? 'ui.menu.disable_panel' : 'ui.menu.enable_panel');
    }

    // Opens the options menu's submenu key over the menu, level with its item (the
    // gesture thresholds shown as they are now)
    showOptionsSubmenu(i, key)
    {
        const _item = this._this.querySelector(`#eo_${i}_${key}`);
        const _sub  = this._this.querySelector(`#eo_${i}_${key}_sub`);
        if( !_item || !_sub ) return;
        for( const _s of this._optionsSubmenus(i) ) _s.style.display = 'none';
        this._rememberSubmenu('options', key);
        const _v = localGestures();
        for( const k in GESTURE_SETTINGS ) { const _in = this._this.querySelector(`#eo_${i}_g_${k}`); if( _in ) _in.value = _v[k]; }
        this.openSubmenu(_sub, _item);
        _sub.focus();
    }

    // Listeners of the options menu and its submenus
    initOptionsMenu(i)
    {
        const _menu = this._this.querySelector(`#eo_${i}`);
        if( !_menu ) return;
        const _subs = this._optionsSubmenus(i);
        for( const k in _OPTIONS_SUBMENUS )
            this._this.querySelector(`#eo_${i}_${k}`)?.addEventListener('click', (e) => { e.preventDefault(); this.showOptionsSubmenu(i, k); }, true);
        // The actions confirmed first — Confirm runs it, the menu closed; Cancel goes back
        // to the submenu its line is in
        for( const c of _CONFIRMED(i) ) {
            const _on = (id, fn) => this._this.querySelector(`#${id}`)?.addEventListener('click', (e) => { e.preventDefault(); fn(); }, true);
            _on(c.line, () => this._confirmAction(i, c));
            _on(`${c.line}_ok`, () => { this.menuSetVisibility(i, false); this[c.run](); this.showInfoPanelSwitch(); });
            _on(`${c.line}_cancel`, () => { this._this.querySelector(`#${c.line}_sub`).style.display = 'none'; this._this.querySelector(`#eo_${i}_${c.in}_sub`)?.focus(); });
        }
        // A gesture threshold entered: kept within its bounds, then set for every card
        for( const k in GESTURE_SETTINGS ) {
            const _in = this._this.querySelector(`#eo_${i}_g_${k}`);
            _in?.addEventListener('change', () => {
                this.setGesture(k, _in.value);
                _in.value = localGestures()[k];
            });
        }
        // Keyboard: Enter or → on an item opens its submenu; in a submenu, ← or Escape goes
        // back to the menu (an input keeps its own keys, Escape aside)
        _menu.addEventListener('keydown', (e) => {
            const _sel = _menu.querySelector('a[data-selected]');
            if( e.key === 'ArrowRight' && _sel?.style.background ) { e.preventDefault(); _sel.click(); return; }
            this.menuKeyDown(e, _menu, { onClose: () => this.menuSetVisibility(i, false) });
        });
        // (a confirmation goes back to the submenu its line is in, a submenu to the menu)
        const _parentOf = sub => { const c = _CONFIRMED(i).find(c => sub.id === `${c.line}_sub`);
                                   return c ? this._this.querySelector(`#eo_${i}_${c.in}_sub`) : _menu; };
        for( const _sub of _subs ) _sub.addEventListener('keydown', (e) => {
            const _inInput = e.target.tagName === 'INPUT';
            if( e.key === 'Escape' || ( e.key === 'ArrowLeft' && !_inInput ) ) {
                e.preventDefault();
                e.stopPropagation();
                _sub.style.display = 'none';
                _parentOf(_sub).focus();
                return;
            }
            if( !_inInput ) this.menuKeyDown(e, _sub);
        });
        // Closed once the focus has left the menu and its submenus
        const _closeIfLeft = () => setTimeout(() => {
            const _a = _menu.getRootNode()?.activeElement;
            const _in = el => el && ( el.contains(document.activeElement) || ( _a && el.contains(_a) ) );
            if( ![_menu, ..._subs].some(_in) ) this.menuSetVisibility(i, false);
        }, 150);
        for( const _box of [_menu, ..._subs] ) _box.addEventListener('focusout', _closeIfLeft);
    }

    menuSetVisibility(idx, show)
    {
        const dropdown = this._this.querySelector(`#eo_${idx}`);
        if( !dropdown ) return;
        if( !show ) this._menuClosed('options');
        for( const _s of this._optionsSubmenus(idx) ) _s.style.display = 'none';

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
            this.openMenu(dropdown, _top, _left);
            dropdown.focus();
            // (reopened soon after it was closed: with the submenu it had open)
            // (no room for the menu and a submenu beside its lines: the menu alone, read first)
            const _key = this._submenuToOpen('options', null);
            if( _key && !dropdown.dataset.cramped ) this.showOptionsSubmenu(idx, _key);
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
    menuKeyDown(event, menuEl, { onClose, onEnter, onHighlight } = {}) {
        if( !['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key) ) return;
        if( !menuEl || menuEl.style.display === 'none' ) return;

        if( event.key === 'Escape' ) {
            event.preventDefault();
            // Clears the keyboard-navigation highlight only (background + selected
            // marker) — never fontWeight, which is menu-specific business state (e.g. the
            // entity type menu's "bold = currently active type") set by the caller, not by
            // this generic navigation logic, and must survive closing/reopening the menu.
            for( let _a of menuEl.getElementsByTagName('a') ) {
                _a.style.background = '';
                delete _a.dataset.selected;
            }
            menuEl.style.display = 'none';
            onClose?.();
            return;
        }

        const _visible = Array.from(menuEl.getElementsByTagName('a')).filter(a => a.style.display !== 'none');
        if( !_visible.length ) return;

        if( event.key === 'Enter' ) {
            event.preventDefault();
            const _sel = menuEl.querySelector('a[data-selected]');
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
    // touches selected — that's entirely business logic: each menu's own caller decides
    // whether to pre-select an option (and mark it selected) as part of populating the
    // menu's content, before this function is even called.
    //   align — 'left' (default), 'center', or 'right': the caller passes `left` as the
    //           point to align against (the anchor's left edge, center, or right edge,
    //           whichever makes sense for it) — center/right shift the menu natively via
    //           CSS transform, same mechanism already used for showMessage, so there's
    //           no need to measure the menu's rendered width and recompute afterward.
    // The positioned parent of the menus of toolbar i: the toolbar, or on a card without any
    // entity selector, their own (menusOnlyHtml)
    _menuParent(i)
    {
        return this._this.querySelector(`#tb_${i}`) ?? this._this.querySelector(`#hm_${i}`);
    }

    openMenu(menuEl, top, left, align = 'left') {
        // (a curve's tooltip closes: a menu opened is never under it)
        for( const g of this.graphs ?? [] ) g.chart?.hecEndTooltip();
        menuEl.style.display = 'block';
        if( top  !== undefined ) menuEl.style.top  = top;
        if( left !== undefined ) menuEl.style.left = left;
        menuEl.style.transform = align === 'center' ? 'translateX(-50%)' : align === 'right' ? 'translateX(-100%)' : '';
        for( let _a of menuEl.getElementsByTagName('a') ) _a.style.background = '';
        this._fitMenuToSubmenus(menuEl);
        Chart.hecUi.clampToViewport(menuEl, this._this?.querySelector('#maincard'));
    }

    // A menu stays readable under its submenus (each opened over it, right-aligned on it,
    // level with its line, see openSubmenu): wider than each of them by its widest line's
    // text, so that its lines show beside the submenu open and another one can be picked —
    // the last line's submenu aside, which hides no line below it: as wide as the menu at
    // most. Set when the menu opens (with what it shows then), so it keeps its width. With
    // no room for that (a small card or screen: menuEl.dataset.cramped), the menu takes
    // the room there is, opens with no submenu (its lines read first), and a submenu opened
    // leaves a strip of its lines (_menuStrip). A menu's lines open the submenus
    // `${line id}_sub`, its siblings
    _fitMenuToSubmenus(menuEl)
    {
        // (a menu without submenus, not one itself: as built)
        const _hasSubs = this._menuLines(menuEl).some(a => this._submenuOf(a));
        if( !_hasSubs && !menuEl.dataset.room ) return;
        menuEl.dataset.minWidth ??= parseFloat(menuEl.style.minWidth) || 0;
        // (its widths with its border: never wider than the room, border included)
        menuEl.style.boxSizing = 'border-box';
        const _room = Math.min(this._menuRoom(), +menuEl.dataset.room || Infinity);
        const _need = Math.max(+menuEl.dataset.minWidth, _hasSubs ? this._menuNeed(menuEl) : 0);
        menuEl.style.maxWidth = Math.floor(_room) + 'px';
        menuEl.style.minWidth = Math.floor(Math.min(_need, _room)) + 'px';
        menuEl.dataset.cramped = _need > _room ? '1' : '';
    }

    // The room a menu has: the card's width, within the screen's
    _menuRoom()
    {
        const _card = this._this?.querySelector('#maincard');
        return Math.min(_card?.clientWidth || Infinity, document.documentElement.clientWidth || Infinity);
    }

    // The width menuEl needs to stay readable under its submenus (its own, without any)
    _menuNeed(menuEl)
    {
        return this._laidOut(menuEl, () => {
            const _lines = this._menuLines(menuEl);
            const _withSub = _lines.filter(a => this._submenuOf(a));
            if( !_withSub.length ) return menuEl.offsetWidth;
            const _readable = Math.max(..._lines.map(a => this._lineTextWidth(a)));
            const _last = _lines[_lines.length - 1];
            return Math.max(menuEl.offsetWidth, ..._withSub.map(a => this._menuNeed(this._submenuOf(a)) + ( a === _last ? 0 : _readable )));
        });
    }

    // What a submenu leaves of its menu's lines, at least: their first three characters, and
    // 48 px — what a finger can still pick
    _menuStrip(menuEl)
    {
        return Math.max(48, ...this._menuLines(menuEl).map(a => this._lineTextWidth(a, 3)));
    }

    // A menu's lines shown, and the submenu a line opens
    _menuLines(menuEl)
    {
        return [...menuEl.children].filter(a => a.tagName === 'A' && a.style.display !== 'none');
    }
    _submenuOf(line)
    {
        return line.id ? line.parentNode?.parentNode?.querySelector(`#${line.id}_sub`) : null;
    }

    // A line's text width (its first n characters), with its left padding and a gap
    _lineTextWidth(line, n = Infinity)
    {
        const _text = document.createTreeWalker(line, NodeFilter.SHOW_TEXT).nextNode();
        if( !_text ) return 0;
        const _range = document.createRange();
        _range.setStart(_text, 0);
        _range.setEnd(_text, Math.min(n, _text.length));
        return _range.getBoundingClientRect().width + ( parseFloat(getComputedStyle(line).paddingLeft) || 0 ) + 8;
    }

    // fn() run with el laid out at its own width — shown (hidden from sight) if it isn't,
    // its own minimum width (as built) rather than the one a fit gave it — then put back
    _laidOut(el, fn)
    {
        const _s = el.style;
        el.dataset.minWidth ??= parseFloat(_s.minWidth) || 0;
        const _saved = { display: _s.display, visibility: _s.visibility, left: _s.left, transform: _s.transform, minWidth: _s.minWidth, maxWidth: _s.maxWidth };
        if( _s.display === 'none' ) Object.assign(_s, { visibility: 'hidden', display: 'block', left: '0px', transform: '' });
        Object.assign(_s, { minWidth: el.dataset.minWidth + 'px', maxWidth: '' });
        try { return fn(); } finally { Object.assign(_s, _saved); }
    }

    // Opens a submenu over its menu, level with the item that opens it, its right edge on the
    // menu's right edge — so it takes no room beside the menu — and, like every menu
    // (openMenu), kept within the card and the viewport. The submenu must share the menu's
    // positioned parent (both are its children).
    // At most as wide as the menu less the strip of its lines it must leave (_menuStrip) —
    // the last line's submenu: as wide as the menu —, its lines cut ('…') if they don't fit
    openSubmenu(subEl, itemEl)
    {
        const _menu = itemEl.offsetParent;
        const _cb = (_menu?.offsetParent ?? document.body).getBoundingClientRect();
        const _item = itemEl.getBoundingClientRect();
        const _lines = this._menuLines(_menu);
        subEl.dataset.room = _menu.offsetWidth - ( itemEl === _lines[_lines.length - 1] ? 0 : this._menuStrip(_menu) );
        this.openMenu(subEl, (_item.top - _cb.top) + 'px', (_menu.getBoundingClientRect().right - _cb.left) + 'px', 'right');
    }

    _navigateMenuArrowKey(visible, key)
    {
        // Shared ArrowUp/ArrowDown wraparound highlight logic for the entity type menu
        // (et_N), the entity selector dropdown (es_N), and the export menu (eo_N) — moves
        // the highlighted <a> to the next/previous visible item, wrapping at either end.
        // Only ever touches the navigation highlight (background + selected marker) —
        // never fontWeight, which is menu-specific business state (e.g. the entity type
        // menu's "bold = default/currently active type", or the selector's wildcard-match
        // bolding) set by the caller, not by this generic navigation logic.
        const _cur = visible.find(a => a.dataset.selected);
        // The entity type menu marks its default/active option with selected right when
        // the menu opens (see showEntityTypeMenu), before any key is pressed — no blue
        // highlight is shown yet at that point. So selected alone doesn't mean "there's
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
            delete _cur.dataset.selected;
        }
        _next.style.background = 'var(--primary-color, #03a9f4)';
        _next.dataset.selected = '1';
        return _next;
    }

}
