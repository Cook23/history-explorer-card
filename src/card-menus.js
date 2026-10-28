// The card's menus: the type menu of an entity — the same menu for a graph — and the options
// menu, with their keyboard navigation. The sections of the curves (what they're shown as,
// how they look, how they're interpolated, how they behave) are the same in each, for the
// curves the menu acts on: an entity's, a graph's, the card's. Every menu and submenu is one
// model: what it shows is a list of lines, always written by fillMenuItems from what is true
// now — when it opens, when a submenu opens, after a choice made in it. Part of
// HistoryCardState (added to it in history-explorer-card.js).

import { i18n } from "./languages.js";
import { INTERPOLATIONS, INTERPOLATION_LABELS } from "./history-options.js";
import { CARD_TESTS, openCardTest } from "./card-tests.js";
import { GESTURE_SETTINGS } from "./gesture-settings.js";
import { localGestures, infoPanelEnabled } from "./card-storage.js";
import { keyOf } from "./history-entity-store.js";
const Chart = window.HXLocal_Chart;

// The display types of the type menu (et_N_<index>)
const _TYPE_MENU_DEFS = [
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
// Their display order (indices in _TYPE_MENU_DEFS)
const _TYPE_MENU_ORDER = [6, 1, 0, 2, 3, 4, 5];
// A menu line's style
const _MENU_LINE_STYLE = 'display:block;padding:5px 10px;text-decoration:none;color:inherit;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';

// The sections of the menus acting on curves — an entity's type menu, a graph's, the card's
// options menu (every graph of the card) —, each a line opening its submenu over the menu,
// right-aligned, level with it: what the curves are shown as (open when an entity's or a
// graph's menu opens), how they look, how they are interpolated, how they behave (the
// tooltip, the Y axis lock, their place in the card). The same submenus whatever the menu:
// what they show and what a choice in them does are for the curves the menu acts on
// (_scopeOf)
const _SECTIONS = { rep: 'ui.menu.type_representation', appearance: 'ui.menu.type_appearance', interp: 'ui.menu.type_interpolation',
                    behavior: 'ui.menu.type_behavior' };
// The type menu's lines: the sections, and, last, the tests a user can run to report what
// their browser or app gives the card (card-tests.js)
const _TYPE_SUBMENUS = { ..._SECTIONS, tests: 'ui.menu.type_tests' };
// The submenus only the card's menu has, not the info panel's
const _CARD_ONLY_SUBMENUS = ['tests'];
// The behavior submenu's lines (<prefix>_<key>): the tooltip (▸: its modes, in a submenu over
// it), the Y axis lock (a switch: the graphs' padlocks), and the curves' place in the card —
// for an entity: separate, merge back, cut, delete; for a graph: merge back, cut, delete it
const _BEHAVIOR_ENTRIES = { tooltip: 'ui.menu.tooltip', ylock: 'ui.menu.ylocked', split: 'ui.menu.entity_split',
                            merge: 'ui.menu.entity_merge', cut: 'ui.menu.entity_cut',
                            delete: 'ui.menu.entity_delete', gdelete: 'ui.menu.graph_delete' };
// The tooltip's modes, as the curves show it (see tooltipModeOf): the curves selected (a click
// on one), the one nearest the pointer, both, every one
const _TOOLTIP_MODES = [['selected', 'ui.menu.tooltip_selected'], ['nearest', 'ui.menu.tooltip_nearest'], ['mixed', 'ui.menu.tooltip_mixed'],
                        ['all', 'ui.menu.tooltip_all']];
// The appearance submenu: the curve's color (the browser's color picker), its points and its
// extremes (switches), and three lists, each opened in the submenu itself, over it (← or
// Escape: back) — its fill, its line's width, its line's style. Each line: the entry's field
// it sets, its name; a list's values: the value set, its name
const _APPEARANCE = {
    color:  { label: 'ui.menu.look_color' },
    points: { label: 'ui.menu.look_points' },
    minmax: { field: 'showMinMax', label: 'ui.menu.look_minmax' },
    fill:   { field: 'fill', label: 'ui.menu.look_fill',
              values: [[false, 'ui.menu.fill_none'], [true, 'ui.menu.fill_solid'], ['fade', 'ui.menu.fill_fade']] },
    width:  { field: 'width', label: 'ui.menu.look_width', values: [1, 2, 3, 4, 5].map(w => [w, `${w} px`]) },
    dash:   { field: 'dashMode', label: 'ui.menu.look_dash',
              values: [['solid', 'ui.menu.dash_solid'], ['points', 'ui.menu.dash_points'], ['shortlines', 'ui.menu.dash_shortlines'],
                       ['longlines', 'ui.menu.dash_longlines'], ['pointline', 'ui.menu.dash_pointline']] },
};

// The options menu's lines (the card's toolbar), each opening its submenu: the sections, for
// every curve of the card; what the card exports, what concerns this card (the entities
// added from it), and what concerns every card of the page and every device (the info
// panel — a switch, ei_N —, the gesture thresholds — entered in the submenu itself, kept
// within their bounds) — last, for its submenu to be as wide as it
const _OPTIONS_SUBMENUS = { ..._SECTIONS, export: 'ui.menu.options_export', card: 'ui.menu.options_card', all: 'ui.menu.options_all' };
// The card submenu's actions, each confirmed first in the submenu itself (Confirm / Cancel —
// Cancel marked, so that Enter changes nothing): the graphs added from the card removed
// (defaultGraphs), everything back to the YAML (defaultDisplay)
const _CARD_ACTIONS = { defgraphs: { label: 'ui.menu.default_graphs', run: 'defaultGraphs' },
                        defdisplay: { label: 'ui.menu.default_display', run: 'defaultDisplay' } };

// Wide enough for the type menu's names with a submenu open beside them, over the menu
const _TYPE_MENU_MIN_WIDTH = 260;
const _MENU_BOX_STYLE = 'display:none;position:absolute;text-align:left;border:1px solid #444;box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2);color:var(--primary-text-color);background-color:var(--card-background-color);outline:none';
// A menu's title line
const _TITLE_STYLE = 'margin:1px;padding:4px 9px;font-weight:600;background-color:var(--secondary-background-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

// A menu box (id), empty — filled when it opens (fillMenuItems) — and its submenus' boxes
// (`${id}_${key}_sub`, its siblings: the same positioned parent), each a line wide at least
function menuBoxesHtml(id, keys, minWidth, z)
{
    const box = (bid, width, zi) => `<div id="${bid}" tabindex="0" style="${_MENU_BOX_STYLE};min-width:${width}px;z-index:${zi}"></div>`;
    return box(id, minWidth, z) + keys.map(k => box(`${id}_${k}_sub`, 110, z + 1)).join('');
}

// The type menu et_N and its submenus — the card's (full: the tests submenu too)
// and the info panel's
export function typeMenuHtml(i, full)
{
    return menuBoxesHtml(`et_${i}`, Object.keys(_TYPE_SUBMENUS).filter(k => full || !_CARD_ONLY_SUBMENUS.includes(k)), _TYPE_MENU_MIN_WIDTH, 2);
}

// The options menu eo_N and its submenus
export function optionsMenuHtml(i)
{
    return menuBoxesHtml(`eo_${i}`, Object.keys(_OPTIONS_SUBMENUS), 150, 1);
}

// The magnifier's modes (what the elastic box zooms — Chart.js zoomBoxAxes): the time (↔),
// the Y axes (↕), both (⤢); each one's symbol in the magnifier's glass — and the zoom
// buttons' beside the range selector: out (−), in (+)
export const ZOOM_BOX_MODES = ['x', 'y', 'xy'];
const _ZOOM_BOX_SYMBOLS = { x: 'M6,9.5H13M6,9.5L7.8,7.9M6,9.5L7.8,11.1M13,9.5L11.2,7.9M13,9.5L11.2,11.1',
                            y: 'M9.5,6V13M9.5,6L7.9,7.8M9.5,6L11.1,7.8M9.5,13L7.9,11.2M9.5,13L11.1,11.2',
                            xy: 'M6.8,12.2L12.2,6.8M12.2,6.8H9.8M12.2,6.8V9.2M6.8,12.2H9.2M6.8,12.2V9.8',
                            out: 'M6.5,9.5H12.5', in: 'M6.5,9.5H12.5M9.5,6.5V12.5' };

// A magnifier (magnifierSvg) shown in another mode or color, its elements kept (a click and
// the next one on the same element: a double-click)
export function paintMagnifier(svg, mode, color)
{
    const [_glass, _symbol] = svg.querySelectorAll('path');
    _glass.setAttribute('fill', color);
    _symbol.setAttribute('stroke', color);
    _symbol.setAttribute('d', _ZOOM_BOX_SYMBOLS[mode] ?? _ZOOM_BOX_SYMBOLS.xy);
}

// The magnifier of mode (ZOOM_BOX_MODES, or 'out', 'in'), in color, size px wide: its glass
// and handle, its mode's symbol in the glass
export function magnifierSvg(mode, color = 'var(--primary-text-color)', size = 24)
{
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="vertical-align:middle;">` +
        `<path fill="${color}" d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14Z" />` +
        `<path fill="none" stroke="${color}" stroke-width="1.2" stroke-linecap="round" d="${_ZOOM_BOX_SYMBOLS[mode] ?? _ZOOM_BOX_SYMBOLS.xy}" /></svg>`;
}

// The magnifier's menu ez_N: its modes
export function zoomMenuHtml(i)
{
    return menuBoxesHtml(`ez_${i}`, [], 0, 2);
}

// A menu line with a switch — a choice on or off: its name, then the switch on its right, in
// Home Assistant's shape (a thin track, a larger knob over it), red while off and green while
// on (the theme's colors, as the padlock's) — see setSwitch. Its name in its [data-label]
const SWITCH_LINE_HTML = `<a href="#" role="switch" aria-checked="false" style="${_MENU_LINE_STYLE}">` +
    `<span style="display:flex;align-items:center;justify-content:space-between"><span data-label></span>` +
    `<span data-switch style="position:relative;display:inline-block;flex:none;width:34px;height:14px;margin-left:14px">` +
    `<span style="position:absolute;left:0;top:0;width:100%;height:100%;border-radius:7px;opacity:0.45"></span>` +
    `<span style="position:absolute;top:-3px;width:20px;height:20px;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></span>` +
    `</span></span></a>`;

// A switch line shown on or off
function setSwitch(line, on)
{
    line.setAttribute('aria-checked', on ? 'true' : 'false');
    const [_track, _knob] = line.querySelector('[data-switch]').children;
    const _c = on ? 'var(--success-color, #4caf50)' : 'var(--error-color, #db4437)';
    _track.style.background = _c;
    _knob.style.background = _c;
    _knob.style.left = on ? '16px' : '-2px';
}

// How long a menu stays open after a choice that changed what it shows (a type, an
// interpolation, a switch…): long enough to see the new state, then it closes (see
// _closeMenuSoon)
const MENU_CLOSE_DELAY_MS = 500;

// About the size of a browser's color picker opened under its field (Chrome's), to center it
const PICKER_SIZE = { width: 240, height: 320 };

// How long a closed menu remembers the submenu it had open (see _submenuToOpen)
const SUBMENU_MEMORY_MS = 10000;

export class CardMenus
{
    // --------------------------------------------------------------------------------------
    // A menu, whichever it is — an entity's type menu, a graph's, the options menu: its box
    // (prefix), what it shows — lines(): its own lines; sub(path): a submenu's, path the
    // keys of the lines that lead to it (['appearance', 'fill']) —, how it closes (close)
    // and the kind of menu its open submenu is remembered under (kind). Every one is
    // filled, opened, refreshed after a choice, listened to and closed by the same
    // functions below; its submenus open in a cascade (openInCascade), the selector's too
    // --------------------------------------------------------------------------------------

    _menuOf(prefix, spec)
    {
        this._menus ??= {};
        return this._menus[prefix] ??= { prefix, el: () => this._this.querySelector(`#${prefix}`), ...spec };
    }

    // A line opening submenu path of menu m (▸)
    _submenuLine(m, id, label, path, style)
    {
        return { id, label: label + ' ▸', style, path, choose: line => this._openSubmenu(m, path, line) };
    }

    // Menu m as it is now: its lines, the open submenus' (each closed when the line it
    // opened from is gone, the line in bold otherwise), and the boxes one level ahead of
    // them (_fillBox)
    _fillMenu(m)
    {
        const _el = m.el();
        const _open = _el._cascade?.slice(1) ?? [];
        this._fillBox(m, _el, m.lines());
        for( const _box of _open ) {
            const _line = this._this.querySelector(`#${_box.id.slice(0, -4)}`);
            if( !_line || _line.parentNode !== _box._parentBox ) { this.closeCascade(_el, _el._cascade.indexOf(_box)); break; }
            this._fillBox(m, _box, m.sub(_box._path));
            _box._line = _line;
            _line.style.fontWeight = 'bold';
        }
    }

    // Box of menu m filled with items — and the boxes of the submenus its lines open, closed,
    // made the first time (`${their line's id}_sub`) and filled, theirs too, at any depth: a
    // box is fitted to the submenus over it when it opens (_fitMenuToSubmenus), and each of
    // them to its own — a submenu that opens its own is as wide as it needs from the start
    _fillBox(m, box, items)
    {
        this.fillMenuItems(box, items);
        for( const it of items.filter(it => it.path) ) {
            const _sub = this._this.querySelector(`#${it.id}_sub`) ?? this.cascadeBox(box, `${it.id}_sub`);
            if( _sub.style.display === 'none' ) this._fillBox(m, _sub, m.sub(it.path));
        }
    }

    // Submenu path of menu m, opened from line — over the box of its line, level with it
    // (openInCascade); its box the line's id and '_sub'. → whether the line is there, shown
    // (a line of a menu closed meanwhile opens nothing)
    _openSubmenu(m, path, line)
    {
        if( !line?.offsetParent ) return false;
        const _box = this._this.querySelector(`#${line.id}_sub`) ?? this.cascadeBox(line.parentNode, `${line.id}_sub`);
        this.listenCascadeBox(m.el(), _box);
        _box._path = path;
        _box._parentBox = line.parentNode;
        this._fillBox(m, _box, m.sub(path));
        if( line.parentNode === m.el() ) this._rememberSubmenu(m.kind(), path[0]);
        this.openInCascade(line.parentNode, line, _box);
        return true;
    }

    // Menu m's first submenu key opened (_openSubmenu) → whether the menu has its line
    _openFirstSubmenu(m, key)
    {
        return this._openSubmenu(m, [key], this._this.querySelector(`#${m.prefix}_${key}`));
    }

    // Menu m closed: its submenu remembered, its submenus and itself hidden
    _closeMenu(m)
    {
        const _el = m.el();
        if( !_el ) return;
        this._cancelMenuClose(m.prefix);
        this._menuClosed(m.kind());
        this.closeCascade(_el);
        _el.style.display = 'none';
    }

    // A choice made in menu m, applied: m as it is now (_fillMenu), then closed
    // MENU_CLOSE_DELAY_MS later, the new state seen
    _menuChosen(m)
    {
        if( !m.el() || m.el().style.display === 'none' ) return;
        this._fillMenu(m);
        this._closeMenuSoon(m.prefix, m.close);
    }

    // Menu m opened — whichever it is: its planned close cancelled, its submenus closed, filled
    // as it is now (_fillMenu), shown at the page point `at` ({ x, y }; null: where it is),
    // aligned there (align: openMenu), kept on anchorEl as the page scrolls (followAnchor:
    // closed once out — m.close), given the keyboard. Placed relative to its positioned parent
    // (_menuParent: #tb_N) read directly — not m.el().offsetParent, always null while it's
    // still hidden, as it is here (openMenu shows it)
    _openMenuAt(m, at, align, anchorEl)
    {
        const _el = m.el();
        this._cancelMenuClose(m.prefix);
        this.closeCascade(_el);
        this._fillMenu(m);
        const _tb = this._menuParent(m.index);
        const _p = _tb ? _tb.getBoundingClientRect() : { top: 0, left: 0 };
        this.openMenu(_el, at ? (at.y - _p.top) + 'px' : undefined, at ? (at.x - _p.left) + 'px' : undefined, align);
        this.followAnchor(_el, anchorEl, () => m.close());
        _el.focus();
    }

    // Menu m listened to: the arrows, Enter or → on a line (its submenu), Escape (closed);
    // closed once the focus has left it and its submenus open. Its submenus: see listenCascadeBox
    _listenMenu(m)
    {
        const _el = m.el();
        if( !_el ) return;
        _el.addEventListener('keydown', (e) => {
            const _sel = _el.querySelector('a[data-selected]');
            if( e.key === 'ArrowRight' && _sel?.style.background ) { e.preventDefault(); _sel.click(); return; }
            this.menuKeyDown(e, _el, { onClose: () => m.close() });
        });
        _el._whenLeft = this.whenFocusLeaves(() => _el._cascade ?? [_el], () => m.close());
        _el.addEventListener('focusout', _el._whenLeft);
        for( const k of m.keys ) {
            const _box = this._this.querySelector(`#${m.prefix}_${k}_sub`);
            if( _box ) this.listenCascadeBox(_el, _box);
        }
    }

    // --------------------------------------------------------------------------------------
    // The cascade: a menu and the submenus open over it, each opened from a line of the one
    // before — over it, right-aligned on it, level with the line (openSubmenu): narrower,
    // so the start of its lines still shows and another one can be picked, unless opened
    // from its last line. Never a submenu replacing a menu's lines
    // --------------------------------------------------------------------------------------

    // Submenu box opened over parent — a menu, or a submenu of the same cascade — level with
    // its line: the submenus open after parent closed first; the line in bold while box is
    // open; box given the keyboard
    openInCascade(parent, line, box)
    {
        const _root = parent._root ?? parent;
        _root._cascade ??= [_root];
        this.closeCascade(_root, _root._cascade.indexOf(parent) + 1);
        box._root = _root;
        box._line = line;
        _root._cascade.push(box);
        line.style.fontWeight = 'bold';
        this.openSubmenu(box, line);
        // (where it stands from its line: kept so, its menu scrolled — see followAnchor)
        box._fromLine = box.getBoundingClientRect().top - line.getBoundingClientRect().top;
        box.focus();
    }

    // Menu menuEl, opened from anchorEl, kept on it while it's open — watched each frame
    // (a scroll anywhere, the page's, a dialog's, a menu's, in any shadow tree, is seen):
    // - it follows anchorEl, its submenus with it, as their own parent doesn't (a sticky
    //   toolbar); each submenu follows its line (its menu scrolled);
    // - what goes past its display zone is masked — the page's (_zoneOf) for menuEl; for a
    //   submenu, its menu's top above, the page's bottom below (it may go below its menu);
    // - it closes once its own first line is wholly out of that zone — the page's for
    //   menuEl (close: how), its menu's box for a submenu: a line of margin, so that a
    //   submenu opened from its menu's first or last line isn't closed by the least scroll
    followAnchor(menuEl, anchorEl, close)
    {
        cancelAnimationFrame(menuEl._followRaf);
        if( !anchorEl ) return;
        const _parent = menuEl.parentNode;
        const _zone = this._zoneOf(anchorEl);
        // (opened higher than its zone's top — moved up to fit the screen: down to it)
        const _under = _zone().top - menuEl.getBoundingClientRect().top;
        if( _under > 0 ) this._shiftBox(menuEl, 0, _under);
        let _last = { a: anchorEl.getBoundingClientRect(), p: _parent.getBoundingClientRect() };
        const _watch = () => {
            if( menuEl.style.display === 'none' || !anchorEl.isConnected ) return;
            const _a = anchorEl.getBoundingClientRect(), _p = _parent.getBoundingClientRect();
            const _dx = ( _a.left - _last.a.left ) - ( _p.left - _last.p.left ), _dy = ( _a.top - _last.a.top ) - ( _p.top - _last.p.top );
            _last = { a: _a, p: _p };
            const _boxes = menuEl._cascade ?? [menuEl];
            if( _dx || _dy ) for( const _box of _boxes ) this._shiftBox(_box, _dx, _dy);
            // (a submenu where it stands from its line, its menu scrolled)
            for( const _box of _boxes.slice(1) ) {
                const _off = _box.getBoundingClientRect().top - _box._line.getBoundingClientRect().top - _box._fromLine;
                if( Math.abs(_off) > 0.5 ) this._shiftBox(_box, 0, -_off);
            }
            const _page = _zone();
            for( let k = 0; k < _boxes.length; k++ ) {
                if( !this._firstLineOut(_boxes[k], k ? _boxes[k - 1].getBoundingClientRect() : _page) ) continue;
                if( !k ) return close();
                this.closeCascade(menuEl, k);
                break;
            }
            const _open = menuEl._cascade ?? [menuEl];
            _open.forEach((_box, k) => {
                const _r = _box.getBoundingClientRect();
                const _top = k ? Math.max(_page.top, _open[k - 1].getBoundingClientRect().top) : _page.top;
                const _cutTop = Math.max(0, _top - _r.top), _cutBottom = Math.max(0, _r.bottom - _page.bottom);
                _box.style.clipPath = _cutTop || _cutBottom ? `inset(${_cutTop}px 0 ${_cutBottom}px 0)` : '';
                _box._maskBelow = window.innerHeight - _page.bottom;
            });
            menuEl._followRaf = requestAnimationFrame(_watch);
        };
        menuEl._followRaf = requestAnimationFrame(_watch);
    }

    // Is box's first line — at its top, as high as its first line shown — wholly out of zone?
    _firstLineOut(box, zone)
    {
        const _top = box.getBoundingClientRect().top;
        const _bottom = _top + ( [...box.children].find(c => c.offsetHeight > 0)?.offsetHeight ?? 0 );
        return _bottom <= zone.top || _top >= zone.bottom;
    }

    // A function giving the page's display zone around anchorEl now (its top and bottom): the
    // screen, within every box scrolling anchorEl (a dialog, a panel, in any shadow tree),
    // less what covers it — Home Assistant's header (--header-height) and the card's sticky
    // toolbars (data-sticky) that don't hold anchorEl
    _zoneOf(anchorEl)
    {
        const _clips = [], _sticky = [...this._this.querySelectorAll('[data-sticky]')].filter(s => !s.contains(anchorEl));
        for( let el = anchorEl.parentNode; el && el !== document; el = el.parentNode ?? el.host ) {
            if( el.nodeType !== 1 ) { el = el.host ?? null; if( !el ) break; }
            if( /(auto|scroll)/.test(getComputedStyle(el).overflowY) ) _clips.push(el);
        }
        const _header = parseFloat(getComputedStyle(anchorEl).getPropertyValue('--header-height')) || 0;
        return () => {
            const z = { top: _header, bottom: window.innerHeight };
            for( const el of _clips ) {
                const r = el.getBoundingClientRect();
                z.top = Math.max(z.top, r.top);
                z.bottom = Math.min(z.bottom, r.bottom);
            }
            for( const el of _sticky ) {
                const r = el.getBoundingClientRect();
                if( el.dataset.sticky === 'top' ) z.top = Math.max(z.top, r.bottom);
                else z.bottom = Math.min(z.bottom, r.top);
            }
            return z;
        };
    }

    // A menu box moved by (dx, dy) px — placed by its top, or by its bottom (a menu opened above)
    _shiftBox(box, dx, dy)
    {
        if( dx ) box.style.left = ( ( parseFloat(box.style.left) || 0 ) + dx ) + 'px';
        if( !dy ) return;
        if( box.style.bottom !== '' && box.style.top === '' ) box.style.bottom = ( ( parseFloat(box.style.bottom) || 0 ) - dy ) + 'px';
        else box.style.top = ( ( parseFloat(box.style.top) || 0 ) + dy ) + 'px';
    }

    // The submenus of root's cascade from depth on closed (1: all of them), the lines they
    // were opened from no longer in bold
    closeCascade(root, depth = 1)
    {
        for( const _box of ( root._cascade ?? [] ).splice(Math.max(depth, 1)) ) {
            _box.style.display = 'none';
            // (a line marked — the value in use — stays in bold)
            if( _box._line ) _box._line.style.fontWeight = _box._line.dataset.marked ? 'bold' : '';
        }
    }

    // Submenu box closed — the ones over it too —, the keyboard back to the box before (or to
    // what that one gives it: _focusTarget)
    _backInCascade(box)
    {
        const _root = box._root ?? box;
        const _stack = _root._cascade ?? [];
        const _before = _stack[_stack.indexOf(box) - 1] ?? _root;
        this.closeCascade(_root, _stack.indexOf(box));
        ( _before._focusTarget ?? _before ).focus();
    }

    // A submenu box made beside box after (the same positioned parent, over it), as it is
    // (its style; id: the card's name for it), empty
    cascadeBox(after, id)
    {
        const _t = document.createElement('template');
        _t.innerHTML = `<div id="${id}" tabindex="0"></div>`;
        const _box = _t.content.firstChild;
        _box.style.cssText = after.style.cssText;
        Object.assign(_box.style, { display: 'none', minWidth: '110px', zIndex: ( +after.style.zIndex || 1 ) + 1 });
        after.parentNode.appendChild(_box);
        return _box;
    }

    // A submenu box of root's cascade listened to, once: its lines' keys — an input keeps
    // its own, Escape aside —, ← or Escape closing it (_backInCascade); root's focus check
    // when the focus leaves it
    listenCascadeBox(root, box)
    {
        if( box._listened ) return;
        box._listened = true;
        box.addEventListener('keydown', (e) => {
            const _inInput = e.target.tagName === 'INPUT';
            if( e.key === 'Escape' || ( e.key === 'ArrowLeft' && !_inInput ) ) {
                e.preventDefault();
                e.stopPropagation();
                this._backInCascade(box);
                return;
            }
            if( !_inInput ) this.menuKeyDown(e, box);
        });
        box.addEventListener('focusout', () => root._whenLeft?.());
    }

    // A function to call when the focus moves: close() runs once it has left every one of
    // boxes() — checked a moment later, once it has landed (moving between a menu and its
    // submenus keeps it open). The focused element is read from the boxes' own tree: inside
    // Home Assistant's shadow roots, document.activeElement is only their host
    whenFocusLeaves(boxes, close)
    {
        return () => setTimeout(() => {
            const _boxes = boxes().filter(b => b);
            const _a = _boxes[0]?.getRootNode()?.activeElement;
            const _in = el => el.contains(document.activeElement) || ( _a && el.contains(_a) );
            if( !_boxes.some(_in) ) close();
        }, 150);
    }

    // A menu closed MENU_CLOSE_DELAY_MS from now (key: which one; close: how) — after a choice
    // made in it, for its new state to be seen. Another choice meanwhile starts the delay
    // again; the menu closed any other way, or opened again, first cancels it
    _closeMenuSoon(key, close)
    {
        this._menuCloseTimers ??= {};
        clearTimeout(this._menuCloseTimers[key]);
        this._menuCloseTimers[key] = setTimeout(() => { delete this._menuCloseTimers[key]; close(); }, MENU_CLOSE_DELAY_MS);
    }

    _cancelMenuClose(key)
    {
        if( !this._menuCloseTimers?.[key] ) return;
        clearTimeout(this._menuCloseTimers[key]);
        delete this._menuCloseTimers[key];
    }

    // A choice clicked in a menu, line its line: shown at once — its switch moved, or the
    // line in bold among its box's —, then made (choose) once that's on screen. Every choice
    // shows the same way, whatever it costs: one that takes a while (a graph built again)
    // never holds back what the menu shows
    _choiceMade(line, choose)
    {
        if( line.getAttribute('role') === 'switch' ) setSwitch(line, line.getAttribute('aria-checked') !== 'true');
        else for( const _a of line.parentNode.querySelectorAll('a') ) _a.style.fontWeight = _a === line ? 'bold' : '';
        requestAnimationFrame(() => setTimeout(choose));
    }

    // A menu's lines written in menuEl — { id, label, style, title, marked, on, final, input,
    // choose(line) }: a title (a line of its own, not picked); an input (a number entered
    // there: its GESTURE_SETTINGS bounds, value, labelId, change(value) → the value kept); a
    // line — the marked one in bold and pre-selected (Enter takes it, the first arrow
    // highlights it), one with on (true or false) a switch line showing it, a final one (a
    // choice, not a way to something else) shown chosen at once (_choiceMade). The focus on
    // one of its lines — the one just clicked — is kept in the box: a line taken away with
    // the focus on it would leave it nowhere, and the menu, seeing the focus gone, would
    // close. → the lines
    fillMenuItems(menuEl, items)
    {
        const _focused = menuEl.contains(menuEl.getRootNode().activeElement);
        menuEl.innerHTML = '';
        const _lines = items.map(it => {
            // (its id — the card's own name for it — and an input's name's)
            const _id = it.id ? ` id="${it.id}"` : '';
            const _t = document.createElement('template');
            _t.innerHTML = it.title ? `<div${_id}></div>`
                : it.input ? `<label style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 10px;white-space:nowrap"><span${it.labelId ? ` id="${it.labelId}"` : ''} style="overflow:hidden;text-overflow:ellipsis;min-width:0"></span>` +
                             `<input${_id} type="number" style="width:5em;color:inherit;background:transparent;border:1px solid #888"></label>`
                : it.on !== undefined ? SWITCH_LINE_HTML.replace('<a ', `<a${_id} `)
                : `<a${_id} href="#" style="${_MENU_LINE_STYLE}"></a>`;
            const _line = _t.content.firstChild;
            if( it.title ) {
                _line.style.cssText = _TITLE_STYLE + ( it.style ?? '' );
                _line.textContent = it.label;
            } else if( it.input ) {
                const [_name, _in] = _line.children;
                _name.textContent = it.label;
                Object.assign(_in, { min: it.input.min, max: it.input.max, step: it.input.step, value: it.value });
                _in.addEventListener('change', () => { _in.value = it.change(_in.value); });
            } else {
                // (a line shown by a symbol — an icon of the card's own: its markup)
                if( it.icon ) _line.innerHTML = it.icon;
                else ( _line.querySelector('[data-label]') ?? _line ).textContent = it.label;
                if( it.icon ) _line.title = it.label;
                if( it.on !== undefined ) setSwitch(_line, it.on);
                if( it.style ) _line.style.cssText += it.style;
                if( it.marked ) { _line.style.fontWeight = 'bold'; _line.dataset.selected = _line.dataset.marked = '1'; }
                _line.addEventListener('click', (e) => { e.preventDefault(); if( it.final ) this._choiceMade(_line, () => it.choose(_line)); else it.choose(_line); }, true);
            }
            menuEl.appendChild(_line);
            return _line;
        });
        if( _focused ) menuEl.focus();
        return _lines;
    }

    // --------------------------------------------------------------------------------------
    // The type menu: Display ▸, Appearance ▸, Interpolation ▸, Behavior ▸, Info, Tests ▸ —
    // for a graph, the same sections over all its curves, Behavior ▸ holding its Y axis
    // lock, merge back, cut and delete
    // --------------------------------------------------------------------------------------

    _typeMenu(i)
    {
        return this._menuOf(`et_${i}`, {
            index: i,
            keys: Object.keys(_TYPE_SUBMENUS),
            kind: () => this._typeMenuKind(i),
            lines: () => this._typeLines(i),
            sub: path => this._typeSubmenuLines(i, path),
            close: () => this.hideEntityTypeMenu(i),
        });
    }

    // The graph the type menu acts on: the one it was opened on — else, rebuilt since by a
    // choice made in it (a type, a look), the one showing its curve now; null for an entity
    // being added
    _menuGraph(input_idx)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        if( !_menu?._menuKey ) return null;
        const _holds = g => g.entities.some(e => keyOf(e) === _menu._menuKey);
        const g = this.graphs.find(g => g.id === _menu._menuGraphId && _holds(g)) ?? this.graphs.find(_holds) ?? null;
        if( g ) _menu._menuGraphId = g.id;
        return g;
    }

    // The entities the type menu acts on — the graph's (a graph's menu), or the one entity —
    // and their graph
    _menuTargets(input_idx)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        const g = this._menuGraph(input_idx);
        if( !g ) return { g: null, entities: [] };
        return { g, entities: _menu._menuForGraph ? g.entities : g.entities.filter(e => keyOf(e) === _menu._menuKey) };
    }

    // What menu m acts on: its kind — an entity's type menu ('entity'; 'add' for one being
    // added), a graph's ('graph'), the options menu ('card') — and each graph with the
    // entities of it it acts on (the card's: every graph, all their entities), as they are now
    _scopeOf(m)
    {
        if( m.prefix.startsWith('eo_') ) return { kind: 'card', pairs: this.graphs.map(g => ({ g, entities: g.entities })) };
        const { g, entities } = this._menuTargets(m.index);
        return { kind: this._typeMenuKind(m.index), pairs: g ? [{ g, entities }] : [] };
    }

    // Is entity e of graph g shown as the type menu's entry def? (its own type — a bar
    // graph can also hold line entities)
    _isShownAs(e, g, def)
    {
        return ( e.type ?? g.type ) === def.type && ( def.lineMode === null || this.lineModeOf(e) === def.lineMode );
    }

    // The type menu for an entity: being added (from 'add', graph null; entity_id an array
    // for a wildcard match), or shown in graph — from a long-press on its label ('label', at
    // clientX, clientY), from the entity selector ('duplicate': added again), from the info
    // panel's Type ('panel', under it, align). Opens with its representation submenu.
    showEntityTypeMenu(input_idx, entity_id, graph, { from, clientX = null, clientY = null, align = 'left' })
    {
        if( !this._this.querySelector(`#et_${input_idx}`) ) return;
        // Where it opens: at the label's point, else under the field it belongs to (align)
        const _input = this.ui.inputField[input_idx];
        let _at = null;
        if( from === 'label' ) _at = { x: clientX, y: clientY };
        else if( _input ) {
            const _r = _input.getBoundingClientRect();
            _at = { x: align === 'center' ? _r.left + _r.width / 2 : align === 'right' ? _r.right : _r.left + 30, y: _r.bottom };
        }
        // (entity_id a string — an entity shown, or a new one — or an array: new entities from
        // a wildcard match)
        this._openTypeMenu(input_idx, {
            entityId: entity_id, graphId: graph ? graph.id : null,
            key: graph ? keyOf(graph.entities.find(e => e.entity === entity_id) ?? entity_id) : null,
            forGraph: false, from, anchor: { clientX, clientY },
        }, _at, align, from === 'label' ? graph?.canvas?.parentNode : _input, 'rep');
    }

    // The same menu for a graph — from a long-press (or a right click) on its lock+handle
    // zone at (clientX, clientY): what all its entities are shown as (the types that fit
    // every one of them, the one they share marked), how its curves look, how all its
    // interpolated curves are interpolated, how they behave (their tooltip, the graph's Y
    // axis lock, merge back, cut, delete). Opens with its representation submenu.
    showGraphMenu(input_idx, graph, clientX, clientY)
    {
        // (the info panel's menu has no graph menu: its one graph is its entity's)
        if( !this._this.querySelector(`#et_${input_idx}`) || !this._this.querySelector(`#et_${input_idx}_tests_sub`) ) return;
        this._openTypeMenu(input_idx, {
            entityId: null, graphId: graph.id, key: keyOf(graph.entities[0]),
            forGraph: true, from: 'graph', anchor: { clientX, clientY },
        }, { x: clientX, y: clientY }, 'left', graph.canvas?.parentNode,
           graph.entities.every(e => this.isNumericEntity(e.entity)) ? 'rep' : 'behavior');
    }

    // Type menu input_idx opened for ctx (what its choices act on), at the page point `at`
    // ({ x, y }; null: where it is), kept on anchorEl, its submenu `sub` opened if remembered
    _openTypeMenu(input_idx, ctx, at, align, anchorEl, sub)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        _menu._menuEntityId = ctx.entityId;
        _menu._menuGraphId  = ctx.graphId;
        _menu._menuKey      = ctx.key;
        _menu._menuForGraph = ctx.forGraph;
        _menu._menuFrom     = ctx.from;
        _menu._menuAnchor   = ctx.anchor;
        this._openMenuAt(this._typeMenu(input_idx), at, align, anchorEl);
        this._openRememberedSubmenu(input_idx, sub);
    }

    // The type menu's lines, as its entity — or its graph — is now: its title, then each
    // section that applies (▸), Info (the card's menu, from a long-press on a label) before
    // the tests, set apart
    _typeLines(i)
    {
        const m = this._typeMenu(i);
        const _menu = m.el();
        const { g, entities } = this._menuTargets(i);
        const _e = entities[0];
        const _label = _menu._menuFrom === 'label' && !!_e;
        const _full = !!this._this.querySelector(`#et_${i}_tests_sub`);
        const _lines = [this._typeTitle(i), ...this._sectionLines(m)];
        if( _full && _label )
            _lines.push({ id: `et_${i}_info`, label: i18n('ui.menu.entity_info'), choose: () => { this.hideEntityTypeMenu(i); this.openEntityInfo(_e, g); } });
        if( _full && !_menu._menuForGraph ) _lines.push(this._submenuLine(m, `et_${i}_tests`, i18n(_TYPE_SUBMENUS.tests), ['tests'], ';border-top:1px solid #444'));
        return _lines;
    }

    // The type menu's title: the entity — '*' for a wildcard's —, or the graph's name; in a
    // solid blue box for a new entity about to be added (as a drop allowed), a dashed red one
    // for one added again from the selector (as a duplicate), its line under it otherwise
    _typeTitle(i)
    {
        const _menu = this._this.querySelector(`#et_${i}`);
        const { g } = this._menuTargets(i);
        const _id = _menu._menuEntityId, _from = _menu._menuFrom;
        const _border = _from === 'add' ? 'border:2px solid var(--primary-color,#03a9f4)'
                      : _from === 'duplicate' ? 'border:2px dashed var(--error-color,#f44336)' : 'border-bottom:1px solid #444';
        return { title: true, id: `et_${i}_title`, style: _border,
                 label: _menu._menuForGraph ? ( g ? this._graphMenuTitle(g) : '' ) : Array.isArray(_id) ? '*' : _id };
    }

    // A type submenu's lines (path: see _menuOf): a section's, or the tests
    _typeSubmenuLines(i, path)
    {
        if( path[0] !== 'tests' ) return this._sectionItems(this._typeMenu(i), path);
        return Object.keys(CARD_TESTS).map(k => ({ id: `et_${i}_test_${k}`, label: i18n(CARD_TESTS[k].label),
                                                   choose: () => { this.hideEntityTypeMenu(i); openCardTest(k, this); } }));
    }

    // --------------------------------------------------------------------------------------
    // The sections (_SECTIONS), whichever menu shows them — for the curves it acts on
    // (_scopeOf): one entity, a graph's, the card's
    // --------------------------------------------------------------------------------------

    // The lines of menu m opening the sections that apply to what it acts on: what they're
    // shown as — an entity's, a graph's or the card's all numeric —, how they look — curves —,
    // how they're interpolated — interpolated curves —, how they behave — an entity shown
    // (from its label, or the info panel), a graph, the card
    _sectionLines(m)
    {
        const { kind, pairs } = this._scopeOf(m);
        const _menu = m.el();
        const _all = pairs.flatMap(({ g, entities }) => entities.map(e => ({ g, e })));
        const _shows = {
            rep: kind === 'entity' || kind === 'add' || ( _all.length > 0 && _all.every(({ e }) => this.isNumericEntity(e.entity)) ),
            appearance: this._appearanceLines(m).length > 0,
            interp: _all.some(({ g, e }) => this.isInterpolated(e, g)),
            behavior: kind === 'graph' || ( kind === 'card' && _all.length > 0 ) || ( kind === 'entity' && _all.length > 0 && ['label', 'panel'].includes(_menu._menuFrom) ),
        };
        return Object.keys(_SECTIONS).filter(k => _shows[k]).map(k => this._submenuLine(m, `${m.prefix}_${k}`, i18n(_SECTIONS[k]), [k]));
    }

    // A section's lines in menu m (path: see _menuOf)
    _sectionItems(m, [key, list])
    {
        return { rep: () => this._representationLines(m), appearance: () => this._appearanceItems(m, list ?? null),
                 interp: () => this._interpolationLines(m), behavior: () => this._behaviorItems(m, list ?? null) }[key]();
    }

    // The display types — only Timeline for an entity that isn't numeric —, the one in use
    // in bold: an entity's, the one all a graph's — or the card's — entities share, or, for
    // an entity being added, the most fitting one (what addGraph would pick) — for a
    // wildcard's, "Default" (each its own), unless none is numeric
    _representationLines(m)
    {
        const _menu = m.el();
        const { kind, pairs } = this._scopeOf(m);
        const _id = _menu._menuEntityId, _e = pairs[0]?.entities[0], _g = pairs[0]?.g;
        let _numeric, _active, _default = false;
        if( kind === 'graph' || kind === 'card' ) {
            _numeric = pairs.every(({ g }) => g.entities.every(e => this.isNumericEntity(e.entity)));
            _active = d => pairs.length > 0 && pairs.every(({ g }) => g.entities.every(e => this._isShownAs(e, g, d)));
        } else if( kind === 'entity' ) {
            _numeric = this.isNumericEntity(_id);
            _active = d => !!_e && this._isShownAs(_e, _g, d);
        } else if( Array.isArray(_id) ) {
            _numeric = _id.some(eid => this.isNumericEntity(eid));
            _default = _numeric;
            _active = d => !_numeric && d.type === 'timeline';
        } else {
            _numeric = this.isNumericEntity(_id);
            const _detected = _numeric ? this.detectDefaultType(_id) : { type: 'timeline', lineMode: null };
            _active = d => d.type === _detected.type && ( d.lineMode === null || d.lineMode === _detected.lineMode );
        }
        const _lines = _default ? [{ id: `${m.prefix}_default`, label: i18n('ui.menu.type_default'), marked: true, final: true,
                                     choose: () => this._typeChosen(m, 'default', null) }] : [];
        for( const k of _TYPE_MENU_ORDER ) {
            const d = _TYPE_MENU_DEFS[k];
            if( !_numeric && d.type !== 'timeline' ) continue;
            _lines.push({ id: `${m.prefix}_${k}`, label: i18n(d.label), marked: !_default && _active(d), final: true,
                          choose: () => this._typeChosen(m, d.type, d.lineMode) });
        }
        return _lines;
    }

    // The interpolation algorithms, the one in use in bold — for a graph or the card, the one
    // all their interpolated curves share, if they do
    _interpolationLines(m)
    {
        const { pairs } = this._scopeOf(m);
        const _algos = new Set(pairs.flatMap(({ g, entities }) => entities.filter(e => this.isInterpolated(e, g)).map(e => this.resolveInterpolation(e))));
        const _cur = _algos.size === 1 ? [..._algos][0] : null;
        return INTERPOLATIONS.map(k => ({ id: `${m.prefix}_algo_${k}`, label: INTERPOLATION_LABELS[k], marked: k === _cur, final: true,
                                         choose: () => this._interpolationChosen(m, k) }));
    }

    // The behavior submenu (list null): the tooltip (▸, for curves), the Y axis lock (a
    // switch, when a graph has a lock — an entity's: its graph's —: on when all are locked),
    // and in the card's menu (not the info panel's) the curves' place — for an entity from
    // its label: separate, merge back, cut, delete; for a graph: merge back, cut, delete (one
    // added from the card) — or the tooltip's modes, the one all the curves have in bold
    _behaviorItems(m, list)
    {
        const { kind, pairs } = this._scopeOf(m);
        const _curves = this._menuCurves(m);
        if( list === 'tooltip' ) {
            const _modes = new Set(_curves.map(({ e }) => this.tooltipModeOf(e)));
            const _cur = _modes.size === 1 ? [..._modes][0] : undefined;
            return _TOOLTIP_MODES.map(([v, label]) => ({ id: `${m.prefix}_tooltip_${v}`, label: i18n(label), marked: v === _cur, final: true,
                                                         choose: () => this._behaviorChosen(m, 'tooltip', v) }));
        }
        const _menu = m.el();
        const _full = m.prefix.startsWith('eo_') || !!this._this.querySelector(`#${m.prefix}_tests_sub`);
        const _g = pairs[0]?.g;
        const _locks = this._yLocks(m);
        const _shown = {
            tooltip: _curves.length > 0,
            ylock: _locks.length > 0,
            split: _full && kind === 'entity' && _menu._menuFrom === 'label' && this.canSplitCurve(_g),
            merge: _full && ( kind === 'graph' || ( kind === 'entity' && _menu._menuFrom === 'label' ) ) && this.canMergeGraphUp(_g),
            cut: _full && ( kind === 'graph' || ( kind === 'entity' && _menu._menuFrom === 'label' ) ),
            delete: _full && kind === 'entity' && _menu._menuFrom === 'label',
            gdelete: _full && kind === 'graph' && !_g.isStatic,
        };
        return Object.keys(_BEHAVIOR_ENTRIES).filter(k => _shown[k]).map(k => {
            const _label = i18n(_BEHAVIOR_ENTRIES[k]);
            if( k === 'tooltip' ) return this._submenuLine(m, `${m.prefix}_behavior_tooltip`, _label, ['behavior', 'tooltip']);
            if( k === 'ylock' ) return { id: `${m.prefix}_ylock`, label: _label, on: _locks.every(l => l), final: true, choose: () => this._behaviorChosen(m, k) };
            return { id: `${m.prefix}_${k}`, label: _label, choose: () => this._behaviorChosen(m, k) };
        });
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
        return _menu?._menuForGraph ? 'graph' : _menu?._menuFrom === 'add' ? 'add' : 'entity';
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
        if( !this.showTypeSubmenu(input_idx, this._submenuToOpen(this._typeMenuKind(input_idx), def)) ) this.showTypeSubmenu(input_idx, def);
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
        if( !this._this.querySelector(`#et_${input_idx}`) ) return;
        this._closeMenu(this._typeMenu(input_idx));
        this.resetEntityInput(this.ui.inputField[input_idx]);
    }

    // Opens the type menu's submenu key (see _openSubmenu) → whether the menu has it
    showTypeSubmenu(input_idx, key)
    {
        return this._openFirstSubmenu(this._typeMenu(input_idx), key);
    }

    // Listeners of the type menu et_N and its submenus — the card's and the info panel's
    initEntityTypeMenu(_ii)
    {
        this._listenMenu(this._typeMenu(_ii));
    }

    // --------------------------------------------------------------------------------------
    // The appearance submenu: the color, the points, the extremes, the fill, the line's width
    // and style of the menu's curves (see _APPEARANCE)
    // --------------------------------------------------------------------------------------

    // Each graph of menu m with the curves it acts on there: its entities drawn as curves
    _curvesByGraph(m)
    {
        return this._scopeOf(m).pairs.map(({ g, entities }) => ({ g, curves: entities.filter(e => this.isCurve(g, g.entities.indexOf(e))) }))
            .filter(({ curves }) => curves.length);
    }

    // The same curves one by one, each with its graph
    _menuCurves(m)
    {
        return this._curvesByGraph(m).flatMap(({ g, curves }) => curves.map(e => ({ g, e })));
    }

    // The Y axis lock of each graph menu m acts on that has one (Chart.js hecYAxisLocked)
    _yLocks(m)
    {
        return this._scopeOf(m).pairs.map(({ g }) => g.chart.hecYAxisLocked()).filter(l => l !== undefined);
    }

    // The appearance submenu's lines that apply to what menu m acts on: the color, for one
    // entity, a curve or a bar (not a row of a timeline or an arrowline); the others, for
    // curves
    _appearanceLines(m)
    {
        const { kind, pairs } = this._scopeOf(m);
        const _one = kind === 'entity' && pairs.length === 1 && pairs[0].entities.length > 0 && !this.isRowGraph(pairs[0].g);
        const _curves = this._menuCurves(m).length > 0;
        return Object.keys(_APPEARANCE).filter(k => k === 'color' ? _one : _curves);
    }

    // Curve e's value of appearance list key — its fill: none (false), its color, light (true),
    // fading out ('fade'); its width; its style ('solid' when it has none)
    _lookValue(e, key)
    {
        if( key === 'fill' ) {
            if( e.fill === 'fade' ) return 'fade';
            const _c = Chart.helpers.color(e.fill ?? 'rgba(0,0,0,0)');
            return !( _c.valid && _c.alpha() === 0 );
        }
        if( key === 'width' ) return e.width;
        return e.dashMode ?? 'solid';
    }

    // The appearance submenu (list null): the color (▸: it opens the browser's picker), the
    // points and the extremes (switches: on when all the menu's curves show them), the fill,
    // the width and the style lists (▸, each a submenu over it) — or one list's values, the
    // one all the curves have in bold; a choice applied at once, saved (see setCurvesLook)
    _appearanceItems(m, level)
    {
        const _curves = this._menuCurves(m);
        const _byGraph = this._curvesByGraph(m);
        const _chosen = () => this._menuChosen(m);
        if( level !== null ) {
            const _d = _APPEARANCE[level];
            const _values = new Set(_curves.map(({ e }) => this._lookValue(e, level)));
            const _cur = _values.size === 1 ? [..._values][0] : undefined;
            return _d.values.map(([v, label]) => ({ label: label.startsWith('ui.') ? i18n(label) : label, marked: v === _cur, final: true,
                choose: () => { for( const { g, curves } of _byGraph ) this.setCurvesLook(g, curves, _d.field, v); _chosen(); } }));
        }
        return this._appearanceLines(m).map(k => {
            const _label = i18n(_APPEARANCE[k].label);
            if( k === 'color' ) return { label: _label + ' ▸', choose: () => this._pickCurveColor(m.index) };
            if( k === 'points' ) {
                const _on = _byGraph.every(({ g, curves }) => !!this.curvesShowPoints(g, curves));
                return { label: _label, on: _on, final: true, choose: () => { for( const { g, curves } of _byGraph ) this.setCurvePoints(g, curves, !_on); _chosen(); } };
            }
            if( k === 'minmax' ) {
                const _on = _curves.every(({ e }) => !!e.showMinMax);
                return { label: _label, on: _on, final: true, choose: () => { for( const { g, curves } of _byGraph ) this.setCurvesLook(g, curves, 'showMinMax', !_on); _chosen(); } };
            }
            return this._submenuLine(m, `${m.prefix}_appearance_${k}`, _label, ['appearance', k]);
        });
    }

    // The menu's curve colored as chosen in the browser's color picker — the menu closed (the
    // picker takes over), the curve's color preselected. A browser opening its picker under
    // its field (Chrome, Edge, Safari) opens it in the middle of the screen: the field there,
    // half a picker (PICKER_SIZE) up and left; one opening the system's own (Firefox on
    // Windows) places it as the system does
    _pickCurveColor(input_idx)
    {
        const { entities } = this._menuTargets(input_idx);
        if( !entities.length ) return;
        const _key = keyOf(entities[0]);
        const _tb = this._menuParent(input_idx);
        const _p = _tb.getBoundingClientRect();
        const _c = Chart.helpers.color(this.entityColor(entities[0]) ?? '#000000');
        this.hideEntityTypeMenu(input_idx);
        const _left = Math.max(0, ( window.innerWidth - PICKER_SIZE.width ) / 2) - _p.left;
        const _top = Math.max(0, ( window.innerHeight - PICKER_SIZE.height ) / 2) - _p.top;
        this.openNativePicker(_tb, 'color', _left, _top, _c.valid ? _c.hexString() : '#000000', v => {
            const _g = this.graphs.find(g => g.entities.some(e => keyOf(e) === _key));
            if( _g ) this.setCurvesLook(_g, _g.entities.filter(e => keyOf(e) === _key), 'color', v);
        });
    }

    // --------------------------------------------------------------------------------------
    // The choices made in the sections — for the curves the menu acts on
    // --------------------------------------------------------------------------------------

    // The interpolation algo for menu m's curves — those interpolated
    _interpolationChosen(m, algo)
    {
        for( const { g, entities } of this._scopeOf(m).pairs ) this.setInterpolation(g, entities, algo);
        this._menuChosen(m);
    }

    // Behavior: the tooltip's mode of the curves (value), or the Y axes locked or released
    // (a switch, as a click on the padlock: all the graphs locked, unless they all are) — the
    // menu showing it a moment —; the entity taken out into its own graph (as a double-click
    // on its label), its linked graph merged back into the one above (as a double-click on
    // the chain icon), the entity — or the graph — cut to be put elsewhere (as a drag, see
    // startCut), the entity or the graph deleted — the menu closed at once
    _behaviorChosen(m, action, value)
    {
        const _menu = m.el();
        if( !_menu ) return;
        const { kind, pairs } = this._scopeOf(m);
        if( action === 'tooltip' ) {
            for( const { g, curves } of this._curvesByGraph(m) ) this.setCurvesTooltip(g, curves, value);
            return this._menuChosen(m);
        }
        if( action === 'ylock' ) {
            const _lock = !this._yLocks(m).every(l => l);
            for( const { g } of pairs ) g.chart.hecSetYAxisLocked(_lock);
            return this._menuChosen(m);
        }
        const _g = pairs[0]?.g, _e = pairs[0]?.entities[0];
        const _idx = _g && _e ? _g.entities.indexOf(_e) : -1;
        const _anchor = _menu._menuAnchor;
        m.close();
        if( !_g || ( kind !== 'graph' && _idx < 0 ) ) return;
        if( action === 'merge' ) {
            const _why = this.mergeGraphUp(_g);
            if( _why ) this.showMessage(_why, _anchor.clientX, _anchor.clientY, 'left', _g.canvas);
        }
        else if( action === 'cut' ) this.startCut(_g, kind === 'graph' ? null : _idx);
        else if( action === 'gdelete' ) this.removeGraph(_g);
        else if( action === 'split' ) this.splitCurve(_g, _idx);
        else this.deleteCurve(_g, _idx);
    }

    // A display type chosen: menu m's entity — or its graph's, the card's — shown so, the
    // menu showing it a moment; for an entity being added, added so, the menu closed at once
    // (its work done: a second choice would add it again)
    _typeChosen(m, type, lineMode)
    {
        const _menu = m.el();
        if( !_menu ) return;
        const { kind, pairs } = this._scopeOf(m);
        if( kind === 'add' ) {
            const _entity_id = _menu._menuEntityId;
            m.close();
            // Brand-new entities (a wildcard: several), created now as chosen — their names
            // shown a moment in the selector's field
            return this.showAdded(m.index, this.addCurves(Array.isArray(_entity_id) ? _entity_id : [_entity_id], type, lineMode));
        }
        if( kind === 'graph' || kind === 'card' ) for( const { g } of pairs ) this.setGraphType(g, type, lineMode);
        else if( pairs.length && pairs[0].entities.length ) this.setCurveType(pairs[0].g, pairs[0].g.entities.indexOf(pairs[0].entities[0]), type, lineMode);
        this._menuChosen(m);
    }

    // --------------------------------------------------------------------------------------
    // The options menu (eo_N)
    // --------------------------------------------------------------------------------------

    _optionsMenu(i)
    {
        return this._menuOf(`eo_${i}`, {
            index: i,
            keys: Object.keys(_OPTIONS_SUBMENUS),
            kind: () => 'options',
            lines: () => {
                const m = this._optionsMenu(i);
                return [...this._sectionLines(m), ...['export', 'card', 'all'].map(k => this._submenuLine(m, `eo_${i}_${k}`, i18n(_OPTIONS_SUBMENUS[k]), [k]))];
            },
            sub: path => this._optionsSubmenuLines(i, path),
            close: () => this.menuSetVisibility(i, false),
        });
    }

    // An options submenu's lines (path: see _menuOf): a section's, for every curve of the
    // card; the exports (the statistics with the long-term statistics on); the card's actions
    // (▸: each confirmed first in a submenu over it — Confirm or Cancel, Cancel marked); the
    // info panel's switch and the gesture thresholds, as they are
    _optionsSubmenuLines(i, path)
    {
        const [key, level = null] = path;
        const m = this._optionsMenu(i);
        if( _SECTIONS[key] ) return this._sectionItems(m, path);
        if( key === 'export' )
            return [{ id: `eo_${i}_csv`, label: i18n('ui.menu.export_csv'), choose: () => this.exportFile() },
                    ...( this.statistics?.enabled ? [{ id: `eo_${i}_stats`, label: i18n('ui.menu.export_stats'), choose: () => this.exportStatistics() }] : [] )];
        if( key === 'card' ) {
            if( level === null )
                return Object.keys(_CARD_ACTIONS).map(k => this._submenuLine(m, `eo_${i}_${k}`, i18n(_CARD_ACTIONS[k].label), ['card', k]));
            return [{ id: `eo_${i}_${level}_ok`, label: i18n('ui.menu.confirm_ok'), choose: () => { this.menuSetVisibility(i, false); this[_CARD_ACTIONS[level].run](); } },
                    { id: `eo_${i}_${level}_cancel`, label: i18n('ui.menu.confirm_cancel'), marked: true, choose: line => this._backInCascade(line.parentNode) }];
        }
        const _v = localGestures();
        return [{ id: `ei_${i}`, label: i18n('ui.menu.native_history'), on: infoPanelEnabled, final: true,
                  choose: () => { this.toggleInfoPanel(); this._menuChosen(m); } },
                ...Object.keys(GESTURE_SETTINGS).map(k => ({ input: GESTURE_SETTINGS[k], id: `eo_${i}_g_${k}`, labelId: `eo_${i}_gl_${k}`,
                    label: i18n(GESTURE_SETTINGS[k].label), value: _v[k], change: v => { this.setGesture(k, v); return localGestures()[k]; } }))];
    }

    // The options menus open, as they are now (the info panel switched on another device)
    refreshOptionsMenus()
    {
        for( const i of [0, 1] ) {
            const _el = this._this.querySelector(`#eo_${i}`);
            if( _el && _el.style.display !== 'none' ) this._fillMenu(this._optionsMenu(i));
        }
    }

    // Opens the options menu's submenu key (see _openSubmenu)
    showOptionsSubmenu(i, key)
    {
        return this._openFirstSubmenu(this._optionsMenu(i), key);
    }

    // Listeners of the options menu and its submenus
    initOptionsMenu(i)
    {
        this._listenMenu(this._optionsMenu(i));
    }

    // --------------------------------------------------------------------------------------
    // The magnifier's menu (ez_N): its modes, each its symbol — the one it's in marked
    // --------------------------------------------------------------------------------------

    _zoomMenu(i)
    {
        return this._menuOf(`ez_${i}`, {
            index: i,
            keys: [],
            kind: () => 'zoom',
            lines: () => ZOOM_BOX_MODES.map(mode => ({ id: `ez_${i}_${mode}`, icon: magnifierSvg(mode), label: i18n(`ui.menu.zoom_${mode}`),
                marked: this.state.zoomBox === mode, final: true,
                choose: () => { this.setZoomBoxMode(mode); this._menuChosen(this._zoomMenu(i)); } })),
            sub: () => [],
            close: () => this._closeMenu(this._zoomMenu(i)),
        });
    }

    // The magnifier's menu opened, under it (_menuParent: its positioned parent)
    showZoomMenu(i)
    {
        const m = this._zoomMenu(i), _bz = this._this.querySelector(`#bz_${i}`);
        if( !m.el() || !_bz ) return;
        const _r = _bz.getBoundingClientRect();
        this._openMenuAt(m, { x: _r.left + _r.width / 2, y: _r.bottom }, 'center', _bz);
    }

    // Listeners of the magnifier's menu
    initZoomMenu(i)
    {
        this._listenMenu(this._zoomMenu(i));
    }

    menuSetVisibility(idx, show)
    {
        const dropdown = this._this.querySelector(`#eo_${idx}`);
        if( !dropdown ) return;
        const m = this._optionsMenu(idx), _bo = this._this.querySelector(`#bo_${idx}`);
        _bo.style.transform = show ? 'scale(1,-1)' : 'scale(1,1)';
        if( !show ) return this._closeMenu(m);
        // (below the toggle button)
        const _r = _bo.getBoundingClientRect();
        this._openMenuAt(m, { x: _r.left - 30, y: _r.bottom }, 'left', _bo);
        // (reopened soon after it was closed: with the submenu it had open)
        // (no room for the menu and a submenu beside its lines: the menu alone, read first)
        const _key = this._submenuToOpen('options', null);
        if( _key && !dropdown.dataset.cramped ) this.showOptionsSubmenu(idx, _key);
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
    // entity type menu, options menu) — Escape closes, ArrowUp/ArrowDown move the highlight,
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
        // (a line under the mask at the page's bottom — see followAnchor — scrolled above it)
        _next.style.scrollMarginBottom = ( menuEl._maskBelow ?? 0 ) + 'px';
        _next.scrollIntoView({ block: 'nearest' });
        onHighlight?.(_next);
    }


    // --------------------------------------------------------------------------------------
    // Menu navigation and the entities they act on
    // --------------------------------------------------------------------------------------

    // Generic menu-opening action, shared by the menus (entity selector dropdown, entity
    // type menu, options menu): makes the menu visible, applies the position its caller
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
        menuEl.style.clipPath = '';
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
        return Math.min(this.cardWidth() || Infinity, document.documentElement.clientWidth || Infinity);
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
        // (moved up to fit the screen: never above its menu — its first line within it, see
        // followAnchor —, the rest masked below)
        const _above = _menu.getBoundingClientRect().top - subEl.getBoundingClientRect().top;
        if( _above > 0 ) subEl.style.top = ( ( parseFloat(subEl.style.top) || 0 ) + _above ) + 'px';
    }

    _navigateMenuArrowKey(visible, key)
    {
        // Shared ArrowUp/ArrowDown wraparound highlight logic for the entity type menu
        // (et_N), the entity selector dropdown (es_N), and the options menu (eo_N) — moves
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
