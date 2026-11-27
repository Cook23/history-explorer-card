// The card's menus: the curve menu of an entity — the same menu for a graph — and the options
// menu, with their keyboard navigation. The sections of the curves (what they're shown as,
// how they look, how they're interpolated, how they behave) are the same in each, for the
// curves the menu acts on: an entity's, a graph's, the card's. Every menu and submenu is one
// model: what it shows is a list of lines, always written by fillMenuItems from what is true
// now — when it opens, when a submenu opens, after a choice made in it. Part of
// HistoryCardState (added to it in history-explorer-card.js).

import { i18n } from "./languages.js";
import { typesCompatible, INTERPOLATIONS, INTERPOLATION_LABELS, ZOOM_BOX_MODES, STATS_EXPORT_PERIODS, DASH_MODES, TOOLTIP_BEHAVIORS, MIN_MAX_VALUES, minMaxValue, POINTS_VALUES, allPointsShown, FILL_VALUES, LINE_WIDTHS, Y_AXIS_SIDES, LINE_MODES, LINE_MODE_LABELS } from "./history-options.js";
import { CARD_TESTS, openCardTest } from "./card-tests.js";
import { GESTURE_SETTINGS } from "./gesture-settings.js";
import { localGestures, infoPanelEnabled } from "./card-storage.js";
import { keyOf } from "./history-entity-store.js";
import { seriesOfGraphs, seriesOf, seriesId } from "./history-series.js";
import { isColorSeries, colorSpec, isBlendable, NO_FILL } from "./history-default-colors.js";
import { maxOf } from "./history-arrays.js";
import { MENU_SELECTOR, LINE_PAD_X } from "./card-selector.js";
const Chart = window.HXLocal_Chart;

// The display types of the curve menu (et_N_<index>), in the order it shows them: a line in
// each line mode (LINE_MODES), a bar, direction arrows, a timeline
const _CURVE_MENU_DEFS = [
    ...LINE_MODES.map(lineMode => ({ type: 'line', lineMode, label: 'ui.menu.' + LINE_MODE_LABELS[lineMode] })),
    { type: 'bar',  lineMode: null,      label: 'ui.menu.type_bar' },
    { type: 'arrowline', lineMode: null, label: 'ui.menu.type_arrowline' },
    { type: 'timeline',  lineMode: null, label: 'ui.menu.type_timeline' },
];
// A menu line's style
const _MENU_LINE_STYLE = 'display:block;padding:5px 5px;text-decoration:none;color:inherit;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';

// The sections of the menus acting on curves — an entity's curve menu, a graph's, the card's
// options menu (every graph of the card) —, each a line opening its submenu over the menu,
// right-aligned, level with it: what the curves are shown as (open when an entity's or a
// graph's menu opens), how they look, how they are interpolated, how they behave (the
// tooltip, the Y axis lock, their place in the card). The same submenus whatever the menu:
// what they show and what a choice in them does are for the curves the menu acts on
// (_scopeOf)
const _SECTIONS = { rep: 'ui.menu.type_representation', appearance: 'ui.menu.type_appearance', interp: 'ui.menu.type_interpolation',
                    behavior: 'ui.menu.type_behavior' };
// The curve menu's lines: the sections, and its exports (its curve's, its graph's)
const _CURVE_SUBMENUS = { ..._SECTIONS, export: 'ui.menu.options_export' };
// The behavior submenu's lines (<prefix>_<key>): the tooltip (▸: its modes, in a submenu over
// it), the Y axis (▸: its sides, its lock), and the curves' place in the card —
// for an entity: separate, merge back, cut, delete; for a graph: merge back, cut, delete it
const _BEHAVIOR_ENTRIES = { tooltip: 'ui.menu.tooltip', cursor: 'ui.menu.cursor', yaxis: 'ui.menu.yaxis', split: 'ui.menu.entity_split',
                            merge: 'ui.menu.entity_merge', cut: 'ui.menu.entity_cut',
                            delete: 'ui.menu.entity_delete', gdelete: 'ui.menu.graph_delete' };
// The tooltip's behaviors, as the curves show it (see tooltipBehaviorOf): the curves selected (a click
// on one), the one nearest the pointer, both, every one
const _TOOLTIP_BEHAVIORS = TOOLTIP_BEHAVIORS.map(v => [v, 'ui.menu.tooltip_' + v]);
// The cursor submenu's choices — only those that go together (a graph's cursor.mode,
// tooltip.mode — see card-charts.js cursorLineOf): none; on the graph pointed at; on every graph
// in all at once; and their tooltips opened at that time too (never tooltips opened on
// other graphs without the line there). Each: its options (a choice made, for the graph
// whatever its type: cursor.types all), its name
const _CURSOR_CHOICES = {
    hide:     { cursorMode: 'hide', tooltipMode: 'auto' },
    graph:    { cursorMode: 'auto', tooltipMode: 'auto' },
    all:      { cursorMode: 'all', tooltipMode: 'auto' },
    tooltips: { cursorMode: 'all', tooltipMode: 'all' },
};
// The appearance submenu: the curve's color (the browser's color picker), and five lists,
// each opened in the submenu itself, over it (← or Escape: back) — its points (none, the
// hovered one, all), its extremes (its min/max band: none, where, which sides), its fill,
// its line's width, its line's style. Each line: the entry's field
// it sets, its name; a list's values: the value set, its name
const _APPEARANCE = {
    color:  { field: 'color', label: 'ui.menu.look_color' },
    points: { field: 'showPoints', label: 'ui.menu.look_points', values: POINTS_VALUES.map(v => [v, 'ui.menu.points_' + v]) },
    minmax: { field: 'showMinMax', label: 'ui.menu.look_minmax', values: MIN_MAX_VALUES.map(v => [v, 'ui.menu.minmax_' + v]) },
    fill:   { field: 'fill', label: 'ui.menu.look_fill', values: Object.entries(FILL_VALUES).map(([k, v]) => [v, 'ui.menu.fill_' + k]) },
    width:  { field: 'width', label: 'ui.menu.look_width', values: LINE_WIDTHS.map(w => [w, `${w} px`]) },
    dash:   { field: 'dashMode', label: 'ui.menu.look_dash',
              values: Object.keys(DASH_MODES).map(k => [k, 'ui.menu.dash_' + k]) },
    length: { field: 'arrowLength', label: 'ui.menu.look_length' },
    alignment: { field: 'alignment', label: 'ui.menu.look_alignment', values: [['left', 'ui.menu.alignment_left'], ['justified', 'ui.menu.alignment_justified']] },
};
// The appearance lists also set from an entity (Entity ▸): as it is (Value), or by thresholds
// on its value (Thresholds ▸) — the options read indirectly (INDIRECT_OPTIONS)
const _INDIRECT_LOOK = ['color', 'fill', 'length'];
// (a part of a line's id made of an entity_id or an attribute's name: a CSS identifier)

// The options menu's lines (the card's toolbar), each opening its submenu: the sections, for
// every curve of the card; what the card exports, what concerns this card (the entities
// added from it), and what concerns every card of the page and every device (the info
// panel — a switch, ei_N —, the gesture thresholds — entered in the submenu itself, kept
// within their bounds) — last, for its submenu to be as wide as it —, then, set apart, the
// tests a user can run to report what their browser or app gives the card (card-tests.js; the
// card's menu only, not the info panel's)
const _OPTIONS_SUBMENUS = { ..._SECTIONS, export: 'ui.menu.options_export', card: 'ui.menu.options_card', all: 'ui.menu.options_all', tests: 'ui.menu.options_tests' };
// The card submenu's actions, each confirmed first in the submenu itself (Confirm / Cancel —
// Cancel marked, so that Enter changes nothing): the graphs added from the card removed
// (defaultGraphs), everything back to the YAML (defaultDisplay)
const _CARD_ACTIONS = { defgraphs: { label: 'ui.menu.default_graphs', run: 'defaultGraphs' },
                        defdisplay: { label: 'ui.menu.default_display', run: 'defaultDisplay' } };

// The symbols before the Export lines' names: what is saved to a file (a floppy disk: its
// shutter at the top, its label at the bottom), what goes to the clipboard (a clipboard) —
// in the text's color
const _LEAD = d => `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style="vertical-align:-2px;margin-right:6px"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
const _FILE_ICON = _LEAD('M4 3h13l4 4v14H4z M8 3v5h8V3 M7 21v-7h10v7');
const _CLIPBOARD_ICON = _LEAD('M9 4H6v18h12V4h-3 M9 2h6v4H9z');

// Wide enough for the curve menu's names with a submenu open beside them, over the menu
const _CURVE_MENU_MIN_WIDTH = 260;
const _MENU_BOX_STYLE = 'display:none;position:absolute;text-align:left;border:1px solid #444;box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2);color:var(--primary-text-color);background-color:var(--card-background-color);outline:none';
// A menu's title line
const _TITLE_STYLE = 'margin:1px;padding:4px 4px;font-weight:600;background-color:var(--secondary-background-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

// A menu box (id), empty — filled when it opens (fillMenuItems) — and its submenus' boxes
// (`${id}_${key}_sub`, its siblings: the same positioned parent), each a line wide at least;
// attrs: the menu box's own attributes
function menuBoxesHtml(id, keys, minWidth, z, attrs = '')
{
    const box = (bid, width, zi, a = '') => `<div id="${bid}"${a} tabindex="0" style="${_MENU_BOX_STYLE};min-width:${width}px;z-index:${zi}"></div>`;
    return box(id, minWidth, z, attrs) + keys.map(k => box(`${id}_${k}_sub`, 110, z + 1)).join('');
}

// Where Home Assistant's header ends, from the top of the page (CSS): its height, and the room
// above it — the phone's status bar, when the page goes under it (the companion app) — as Home
// Assistant places its views below it (hui-root.ts: --header-height + --safe-area-inset-top)
export const HEADER_BOTTOM = 'calc(var(--header-height, 0px) + var(--safe-area-inset-top, 0px))';

// The curve menu et_N and its submenus — the card's (full: marked so, data-card — what only
// the card's offers: Info, the curves' place) and the info panel's
export function curveMenuHtml(i, full)
{
    return menuBoxesHtml(`et_${i}`, Object.keys(_CURVE_SUBMENUS), _CURVE_MENU_MIN_WIDTH, 2, full ? ' data-card' : '');
}

// The options menu eo_N and its submenus
export function optionsMenuHtml(i)
{
    return menuBoxesHtml(`eo_${i}`, Object.keys(_OPTIONS_SUBMENUS), 150, 1);
}

// The symbol of each magnifier's mode (ZOOM_BOX_MODES) in its glass: the time (↔), the Y axes
// (↕), both (⤢) — and the zoom buttons' beside the range selector: out (−), in (+)
// (the symbol within the glass's hole, clear of its ring — its stroke and outline included —:
// the glass grey, the symbol in the text's color)
// (each arrowhead one line through its tip: a sharp point there — the stroke's joins, mitred)
const _ZOOM_BOX_SYMBOLS = { x: 'M5.24,9.5H13.76M7,7.74L5.24,9.5L7,11.26M12,7.74L13.76,9.5L12,11.26',
                            y: 'M9.5,5.24V13.76M7.74,7L9.5,5.24L11.26,7M7.74,12L9.5,13.76L11.26,12',
                            xy: 'M6.24,12.76L12.76,6.24M10.51,6.24H12.76V8.49M8.49,12.76H6.24V10.51',
                            out: 'M5.24,9.5H13.76', in: 'M5.24,9.5H13.76M9.5,5.24V13.76' };
// A magnifier's colors: its glass grey, its symbol in the text's color — or both in color —,
// outlined in the background's (--hec-mag-bg: the toolbar's, opaque — see _paintMagnifiers)
const _GLASS = 'var(--secondary-text-color)', _SYMBOL = 'var(--primary-text-color)';
const _OUTLINE = 'var(--hec-mag-bg, var(--card-background-color))';
// The symbol's stroke and its outline's (the stroke and a border on each side), each a whole
// number of the screen's pixels: in the 24 units of a magnifier size px wide
function _magnifierStrokes(size)
{
    const dpr = window.devicePixelRatio || 1, units = px => px / dpr * 24 / size;
    // (the stroke about a CSS pixel, as the toolbar's '<' and '>')
    const _line = Math.max(1, Math.round(dpr)), _border = Math.max(1, Math.round(3 / 4 * dpr));
    return { line: units(_line), outline: units(_line + 2 * _border) };
}

// A magnifier (magnifierSvg) shown in another mode or color (none: its own colors), its
// elements kept (a click and the next one on the same element: a double-click)
export function paintMagnifier(svg, mode, color)
{
    const [_glass, _outline, _symbol] = svg.querySelectorAll('path');
    _glass.setAttribute('fill', color ?? _GLASS);
    _symbol.setAttribute('stroke', color ?? _SYMBOL);
    for( const p of [_outline, _symbol] ) p.setAttribute('d', _ZOOM_BOX_SYMBOLS[mode] ?? _ZOOM_BOX_SYMBOLS.xy);
}

// The magnifier of mode (ZOOM_BOX_MODES, or 'out', 'in'), size px wide: its glass and handle
// grey, its mode's symbol over the glass in the text's color — or both in color —, outlined;
// drawn 2 px lower and 1 px to the right in its box (the drawing in the top left of its 24
// units: centred, about)
export function magnifierSvg(mode, color, size = 24)
{
    const _d = _ZOOM_BOX_SYMBOLS[mode] ?? _ZOOM_BOX_SYMBOLS.xy, _w = _magnifierStrokes(size);
    return `<svg width="${size}" height="${size}" viewBox="${-24 / size} ${-2 * 24 / size} 24 24" style="vertical-align:middle;">` +
        `<path fill="${color ?? _GLASS}" d="M15.9,14.27L19.22,17.6L17.6,19.22L14.27,15.9ZM9.5,1A8.5,8.5 0 1,1 9.5,18A8.5,8.5 0 1,1 9.5,1ZM9.5,3A6.5,6.5 0 1,0 9.5,16A6.5,6.5 0 1,0 9.5,3Z" />` +
        `<path fill="none" stroke="${_OUTLINE}" stroke-width="${_w.outline}" stroke-linecap="round" d="${_d}" />` +
        `<path fill="none" stroke="${color ?? _SYMBOL}" stroke-width="${_w.line}" stroke-linecap="round" d="${_d}" /></svg>`;
}

// Real time's mark (under the toolbar's '>', see card-toolbar.js timeButtonsHtml): three
// quarters of the magnifier's ring — its size at size px, its stroke, its color —, turning
export function realTimeSvg(size = 24)
{
    const r = 7.5, _arc = 0.75 * 2 * Math.PI * r;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="display:block">` +
        `<circle cx="12" cy="12" r="${r}" fill="none" stroke="${_GLASS}" stroke-width="2" stroke-dasharray="${_arc} ${2 * Math.PI * r}" /></svg>`;
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
    // A menu, whichever it is — an entity's curve menu, a graph's, the options menu: its box
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
        // (a lazy line's submenu filled only when it's opened: one of many — an entity found)
        for( const it of items.filter(it => it.path && !it.lazy) ) {
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

    // The boxes of menu i's entity selector shown (its list, its series submenus)
    _menuSelectorBoxes(i)
    {
        const _list = this._this.querySelector(`#es_${MENU_SELECTOR + i}`);
        return _list ? ( _list._cascade ?? [_list] ) : [];
    }

    // Menu m closed: its submenu remembered, its submenus and itself hidden — its entity
    // selector's lists too
    _closeMenu(m)
    {
        const _el = m.el();
        if( !_el ) return;
        if( this._this.querySelector(`#es_${MENU_SELECTOR + m.index}`) ) { this.hideSeriesMenu(MENU_SELECTOR + m.index); this.setDropdownVisibility(MENU_SELECTOR + m.index, false); }
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
    // (menuParent: #tb_N) read directly — not m.el().offsetParent, always null while it's
    // still hidden, as it is here (openMenu shows it)
    _openMenuAt(m, at, align, anchorEl)
    {
        const _el = m.el();
        this._cancelMenuClose(m.prefix);
        this.closeCascade(_el);
        this._fillMenu(m);
        const _tb = this.menuParent(m.index);
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
        // (its entity selector's lists — Entity ▸ — are its own too)
        _el._whenLeft = this.whenFocusLeaves(() => [...( _el._cascade ?? [_el] ), ...this._menuSelectorBoxes(m.index)], () => m.close());
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
        // (its width as opened — its own —, the one the cascade's fit starts from)
        box._base = { minWidth: box.style.minWidth, maxWidth: box.style.maxWidth, width: box.style.width };
        this.fitCascade(box);
        // (where it stands from its line: kept so, its menu scrolled — see followAnchor)
        box._fromLine = box.getBoundingClientRect().top - line.getBoundingClientRect().top;
        box.focus();
    }

    // The cascade box belongs to fitted, the boxes opened one over the other (the menu, its
    // submenus, the entity selector's list of an Entity ▸ and its own submenus), all
    // right-aligned: the menu stays as it is; each box opened after it takes its own width,
    // one after the other — the room the last one lacks taken from the boxes over it, the
    // farthest one first (the menu's lines shown beside the box over it reduced to their
    // first three characters, _menuStrip), then the next one, and so on down; only once all of
    // them show no more than that, the last one's lines cut ('…', an entity's name shortened)
    fitCascade(box)
    {
        const _root = box?._root ?? box;
        if( !_root ) return;
        const _chain = [...( _root._cascade ?? [_root] )];
        // (each back to its width as opened)
        for( const b of _chain.slice(1) ) if( b._base ) Object.assign(b.style, b._base);
        if( _chain.length < 2 ) return;
        const R = _chain[0].getBoundingClientRect().right;
        // (a box wanting more than its lines: one holding an Entity ▸'s field, as wide as its
        // list's names whole — the field's _wantWidth)
        const _natural = _chain.map(b => Math.max(b.getBoundingClientRect().width, [...b.querySelectorAll('input')].reduce((w, i) => Math.max(w, i._wantWidth?.() ?? 0), 0)));
        const _strip = _chain.map(b => this._menuStrip(b));
        const L = [_chain[0].getBoundingClientRect().left];
        for( let k = 1; k < _chain.length; k++ ) {
            // (what each box over it shows of its lines: up to the next box; the one under
            // it, its lines' text)
            const _shown = L.map((x, j) => j < k - 1 ? L[j + 1] - x : this._readableWidth(_chain[j]));
            let _lack = _natural[k] - ( R - L[k - 1] - _shown[k - 1] );
            if( _lack <= 0 ) { L[k] = R - _natural[k]; continue; }
            const _cut = _shown.map((v, j) => { const t = Math.max(0, Math.min(_lack, v - _strip[j])); _lack -= t; return t; });
            for( let j = 1; j <= k; j++ ) L[j] = L[j - 1] + _shown[j - 1] - _cut[j - 1];
        }
        for( let k = 1; k < _chain.length; k++ ) {
            const b = _chain[k], w = Math.max(0, Math.floor(R - L[k])) + 'px';
            b.style.boxSizing = 'border-box';
            Object.assign(b.style, { minWidth: w, maxWidth: w });
        }
    }

    // Selector idx's field's text where its list's lines' text starts: its left padding from
    // its border's end to there — the list's left edge (a toolbar's: the field's; a menu's: its
    // field's box's, see setDropdownVisibility), its border, its lines' padding
    alignFieldText(idx)
    {
        const input = this._this.querySelector(`#b7_${idx}`), list = this._this.querySelector(`#es_${idx}`);
        if( !input?.isConnected || !list ) return;
        const _left = ( idx >= MENU_SELECTOR ? input.closest('[id$="_sub"]') : input ).getBoundingClientRect().left;
        const _textAt = _left + ( parseFloat(getComputedStyle(list).borderLeftWidth) || 0 ) + LINE_PAD_X;
        input.style.paddingLeft = Math.max(0, _textAt - input.getBoundingClientRect().left - ( parseFloat(getComputedStyle(input).borderLeftWidth) || 0 )) + 'px';
    }

    // A box's lines' text, its widest — what it shows of them beside a box over it
    _readableWidth(box)
    {
        return Math.max(0, maxOf(this._stripLines(box).map(a => this._lineTextWidth(a))));
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
                _box._maskBelow = Chart.hecUi.shownRect().bottom - _page.bottom;
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
    // less what covers it — Home Assistant's header (HEADER_BOTTOM) and the card's sticky
    // toolbars (data-sticky) that don't hold anchorEl
    _zoneOf(anchorEl)
    {
        const _clips = [], _sticky = [...this._this.querySelectorAll('[data-sticky]')].filter(s => !s.contains(anchorEl));
        for( let el = anchorEl.parentNode; el && el !== document; el = el.parentNode ?? el.host ) {
            if( el.nodeType !== 1 ) { el = el.host ?? null; if( !el ) break; }
            if( /(auto|scroll)/.test(getComputedStyle(el).overflowY) ) _clips.push(el);
        }
        // (the header's bottom as the page has it there, in px: a box that high measured)
        const _probe = document.createElement('div');
        _probe.style.cssText = `position:absolute;visibility:hidden;width:0;height:${HEADER_BOTTOM}`;
        anchorEl.parentNode.appendChild(_probe);
        const _header = _probe.offsetHeight;
        _probe.remove();
        return () => {
            const z = { top: _header, bottom: Chart.hecUi.shownRect().bottom };
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
        const _closed = ( root._cascade ?? [] ).splice(Math.max(depth, 1));
        for( const _box of _closed ) {
            _box.style.display = 'none';
            // (a line marked — the value in use — stays in bold)
            if( _box._line ) _box._line.style.fontWeight = _box._line.dataset.marked ? 'bold' : '';
        }
        // (the boxes left back to the width they take without them)
        if( _closed.length ) this.fitCascade(root);
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

    // A menu's lines written in menuEl — { id, label, lead, style, title, marked, markedItalic,
    // strong, disabled, on, final, input, choose(line) }: a title (a line of its own, not picked); an input (a number entered
    // there: its GESTURE_SETTINGS bounds, value, labelId, change(value) → the value kept); a
    // line — the marked one in bold (in italic: markedItalic) and pre-selected (Enter takes
    // it, the first arrow highlights it), a strong one in bold, a disabled one greyed (nothing
    // to do there: a click does nothing), one with on (true or false) a switch line showing it, a final one (a
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
                : it.input ? `<label${it.lineId ? ` id="${it.lineId}"` : ''} style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 5px;white-space:nowrap"><span${it.labelId ? ` id="${it.labelId}"` : ''} style="overflow:hidden;text-overflow:ellipsis;min-width:0"></span>` +
                             `<input${_id} type="${it.input.text ? 'text' : 'number'}" style="${it.input.text ? 'flex:1 1 10em;width:10em' : 'flex:0 1 auto;width:5em'};min-width:3em;color:inherit;background:transparent;border:1px solid #888"></label>`
                : it.on !== undefined ? SWITCH_LINE_HTML.replace('<a ', `<a${_id} `)
                : `<a${_id} href="#" style="${_MENU_LINE_STYLE}"></a>`;
            const _line = _t.content.firstChild;
            if( it.title ) {
                _line.style.cssText = _TITLE_STYLE + ( it.style ?? '' );
                _line.textContent = it.label;
            } else if( it.input ) {
                const [_name, _in] = _line.children;
                _name.textContent = it.label;
                // (a field without a name — the entity selector's —: the field alone, its line's
                // width — its text placed as its list's lines', see setDropdownVisibility)
                if( !it.label ) { _name.remove(); _line.style.paddingLeft = _line.style.paddingRight = '0'; }
                Object.assign(_in, { min: it.input.min, max: it.input.max, step: it.input.step, value: it.value ?? '' });
                if( it.input.placeholder ) _in.placeholder = it.input.placeholder;
                // (a text searched: each change at once — live —; a value: once entered)
                if( it.change ) _in.addEventListener(it.input.live ? 'input' : 'change', () => { const v = it.change(_in.value); if( !it.input.live ) _in.value = v; });
                // (a field another part of the card listens to: the entity selector's)
                if( it.bind ) it.bind(_in);
            } else {
                // (a line shown by a symbol — an icon of the card's own: its markup)
                if( it.icon ) _line.innerHTML = it.icon;
                else ( _line.querySelector('[data-label]') ?? _line ).textContent = it.label;
                // (a symbol before its name: lead's markup)
                if( it.lead ) _line.insertAdjacentHTML('afterbegin', it.lead);
                if( it.icon ) _line.title = it.label;
                if( it.on !== undefined ) setSwitch(_line, it.on);
                if( it.style ) _line.style.cssText += it.style;
                if( it.marked ) { _line.style[it.markedItalic ? 'fontStyle' : 'fontWeight'] = it.markedItalic ? 'italic' : 'bold'; _line.dataset.selected = '1'; if( !it.markedItalic ) _line.dataset.marked = '1'; }
                if( it.strong ) { _line.style.fontWeight = 'bold'; _line.dataset.marked = '1'; }
                if( it.disabled ) { _line.style.opacity = '0.45'; _line.setAttribute('aria-disabled', 'true'); }
                // (a long press — or a right click — on the line: longPress, its click then nothing)
                if( it.longPress ) this.listenLongPress(_line, () => it.longPress(_line));
                _line.addEventListener('click', (e) => {
                    e.preventDefault();
                    if( it.disabled ) return;
                    // (a click on a line closes the submenus its menu's other lines opened —
                    // a line with a submenu then opens its own)
                    const _box = _line.parentNode, _root = _box?._root ?? _box;
                    if( _root?._cascade ) this.closeCascade(_root, _root._cascade.indexOf(_box) + 1);
                    // (a switch acts by a click on the switch itself — or the keyboard: a click
                    // with no pointer, detail 0 —, never by one on its line's name)
                    if( it.on !== undefined && e.detail !== 0 && !e.target.closest?.('[data-switch]') ) return;
                    if( it.final ) this._choiceMade(_line, () => it.choose(_line)); else it.choose(_line);
                }, true);
            }
            menuEl.appendChild(_line);
            return _line;
        });
        if( _focused ) menuEl.focus();
        return _lines;
    }

    // --------------------------------------------------------------------------------------
    // The curve menu: Display ▸, Appearance ▸, Interpolation ▸, Behavior ▸, Info, Tests ▸ —
    // for a graph, the same sections over all its curves, Behavior ▸ holding its Y axis
    // lock, merge back, cut and delete
    // --------------------------------------------------------------------------------------

    _curveMenu(i)
    {
        return this._menuOf(`et_${i}`, {
            index: i,
            keys: Object.keys(_CURVE_SUBMENUS),
            kind: () => this._curveMenuKind(i),
            lines: () => this._typeLines(i),
            sub: path => this._typeSubmenuLines(i, path),
            close: () => this.hideEntityCurveMenu(i),
        });
    }

    // The graph the curve menu acts on: the one it was opened on — else, rebuilt since by a
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

    // The entities the curve menu acts on — the graph's (a graph's menu), or the one entity —
    // and their graph
    _menuTargets(input_idx)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        const g = this._menuGraph(input_idx);
        if( !g ) return { g: null, entities: [] };
        return { g, entities: _menu._menuForGraph ? g.entities : g.entities.filter(e => keyOf(e) === _menu._menuKey) };
    }

    // What menu m acts on: its kind — an entity's curve menu ('entity'; 'add' for one being
    // added), a graph's ('graph'), the options menu ('card') — and each graph with the
    // entities of it it acts on (the card's: every graph, all their entities), as they are now
    _scopeOf(m)
    {
        if( m.prefix.startsWith('eo_') ) return { kind: 'card', pairs: this.graphs.map(g => ({ g, entities: g.entities })) };
        const { g, entities } = this._menuTargets(m.index);
        return { kind: this._curveMenuKind(m.index), pairs: g ? [{ g, entities }] : [] };
    }

    // Is entity e of graph g shown as the curve menu's entry def? (its own type — a bar
    // graph can also hold line entities)
    _isShownAs(e, g, def)
    {
        return ( e.type ?? g.type ) === def.type && ( def.lineMode === null || this.lineModeOf(e) === def.lineMode );
    }

    // The curve menu for an entity: being added (from 'add', graph null; entity_id an array
    // for a wildcard match), or shown in graph — from a long-press on its label ('label', at
    // clientX, clientY), from the entity selector ('duplicate': added again), from the info
    // panel's Type ('panel', under it, align). Opens with its representation submenu.
    showEntityCurveMenu(input_idx, entity_id, graph, { from, clientX = null, clientY = null, align = 'left' })
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
        this._openCurveMenu(input_idx, {
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
        if( !this._this.querySelector(`#et_${input_idx}`) || !this._cardsCurveMenu(`et_${input_idx}`) ) return;
        this._openCurveMenu(input_idx, {
            entityId: null, graphId: graph.id, key: keyOf(graph.entities[0]),
            forGraph: true, from: 'graph', anchor: { clientX, clientY },
        }, { x: clientX, y: clientY }, 'left', graph.canvas?.parentNode,
           graph.entities.every(e => this.isNumericEntity(e.entity)) ? 'rep' : 'behavior');
    }

    // Curve menu input_idx opened for ctx (what its choices act on), at the page point `at`
    // ({ x, y }; null: where it is), kept on anchorEl, its submenu `sub` opened if remembered
    _openCurveMenu(input_idx, ctx, at, align, anchorEl, sub)
    {
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        _menu._menuEntityId = ctx.entityId;
        _menu._menuGraphId  = ctx.graphId;
        _menu._menuKey      = ctx.key;
        _menu._menuForGraph = ctx.forGraph;
        _menu._menuFrom     = ctx.from;
        _menu._menuAnchor   = ctx.anchor;
        _menu._menuAddTo    = ctx.addTo ?? null;
        this._openMenuAt(this._curveMenu(input_idx), at, align, anchorEl);
        this._openRememberedSubmenu(input_idx, sub);
    }

    // Is the curve menu id the card's — not the info panel's (curveMenuHtml full: data-card)?
    _cardsCurveMenu(id)
    {
        return !!this._this.querySelector(`#${id}`)?.hasAttribute('data-card');
    }

    // The curve menu's lines, as its entity — or its graph — is now: its title, then each
    // section that applies (▸), Info (the card's menu, from a long-press on a label), a graph's
    // exports
    _typeLines(i)
    {
        const m = this._curveMenu(i);
        const _menu = m.el();
        const { g, entities } = this._menuTargets(i);
        const _e = entities[0];
        const _label = _menu._menuFrom === 'label' && !!_e;
        const _full = this._cardsCurveMenu(`et_${i}`);
        // (a graph's, in the card: Add ▸ first — an entity added to that graph)
        const _add = _full && _menu._menuForGraph && g ? [{ ...this._submenuLine(m, `et_${i}_add`, i18n('ui.label.add'), ['add']), lazy: true }] : [];
        const _lines = [this._typeTitle(i), ..._add, ...this._sectionLines(m)];
        if( _full && _label )
            _lines.push({ id: `et_${i}_info`, label: i18n('ui.menu.entity_info'), choose: () => { this.hideEntityCurveMenu(i); this.openEntityInfo(_e, g); } });
        // (its exports: its curve's, its graph's — as the options menu's, every curve's)
        if( entities.length ) _lines.push(this._submenuLine(m, `et_${i}_export`, i18n(_CURVE_SUBMENUS.export), ['export']));
        return _lines;
    }

    // The curve menu's title: the entity — '*' for a wildcard's —, or the graph's name; in a
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

    // A type submenu's lines (path: see _menuOf): a section's, or the graph's exports
    _typeSubmenuLines(i, path)
    {
        if( path[0] === 'add' ) return this._graphAddItems(this._curveMenu(i), path);
        if( path[0] === 'export' ) {
            const { g, entities } = this._menuTargets(i);
            const _scope = this._this.querySelector(`#et_${i}`)._menuForGraph ? { kind: 'graph', g } : { kind: 'curve', g, e: entities[0] };
            return this._exportLines(this._curveMenu(i), path[1] ?? null, entities.map(e => e.entity), _scope);
        }
        return this._sectionItems(this._curveMenu(i), path);
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
    _sectionItems(m, path)
    {
        const [key, list] = path;
        return { rep: () => this._representationLines(m), appearance: () => this._appearanceItems(m, path.slice(1)),
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
        // (an entity being added to a graph — its Add ▸ —: only the types that graph takes)
        const _into = kind === 'add' && _menu._menuAddTo ? this.graphs.find(x => x.id === _menu._menuAddTo) ?? null : null;
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
            let _detected = _numeric ? this.detectDefaultType(_id) : { type: 'timeline', lineMode: null };
            // (added to a graph: as that graph would show it — shownIn)
            if( _into ) _detected = this.shownIn(_id, _detected.type, _detected.lineMode, _into) ?? _detected;
            _active = d => d.type === _detected.type && ( d.lineMode === null || d.lineMode === _detected.lineMode );
        }
        const _lines = _default ? [{ id: `${m.prefix}_default`, label: i18n('ui.menu.type_default'), marked: true, final: true,
                                     choose: () => this._typeChosen(m, 'default', null) }] : [];
        for( const [k, d] of _CURVE_MENU_DEFS.entries() ) {
            if( !_numeric && d.type !== 'timeline' ) continue;
            if( _into && !typesCompatible(d.type, _into.type) ) continue;
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

    // The behavior submenu (list null): the tooltip (▸, for curves), the cursor (▸, for a graph
    // or the card: its choices, _CURSOR_CHOICES — the one all their graphs have in bold), the Y axis (▸: for curves,
    // left, right — the one they all are on in bold —; when a graph has a lock — an entity's:
    // its graph's —, the lock, a switch on when all are locked), and in the card's menu (not the info panel's) the curves' place — for an entity from
    // its label: separate, merge back, cut, delete; for a graph: merge back, cut, delete (one
    // added from the card) — or the tooltip's behaviors, the one all the curves have in bold
    _behaviorItems(m, list)
    {
        const { kind, pairs } = this._scopeOf(m);
        const _curves = this._menuCurves(m);
        if( list === 'tooltip' ) {
            const _behaviors = new Set(_curves.map(({ e }) => this.tooltipBehaviorOf(e)));
            const _cur = _behaviors.size === 1 ? [..._behaviors][0] : undefined;
            return _TOOLTIP_BEHAVIORS.map(([v, label]) => ({ id: `${m.prefix}_tooltip_${v}`, label: i18n(label), marked: v === _cur, final: true,
                                                         choose: () => this._behaviorChosen(m, 'tooltip', v) }));
        }
        if( list === 'cursor' ) {
            const _now = new Set(pairs.map(({ g }) => this._cursorChoiceOf(g)));
            const _cur = _now.size === 1 ? [..._now][0] : undefined;
            return Object.keys(_CURSOR_CHOICES).map(v => ({ id: `${m.prefix}_cursor_${v}`, label: i18n('ui.menu.cursor_' + v), marked: v === _cur, final: true,
                                                           choose: () => this._behaviorChosen(m, 'cursor', v) }));
        }
        if( list === 'yaxis' ) {
            const _sides = new Set(_curves.map(({ g, e }) => this.yAxisSideOf(g, e)));
            const _cur = _sides.size === 1 ? [..._sides][0] : undefined;
            const _locks = this._yLocks(m);
            return [
                ...( _curves.length ? Y_AXIS_SIDES.map(v => ({ id: `${m.prefix}_yaxis_${v}`, label: i18n('ui.menu.yaxis_' + v), marked: v === _cur, final: true,
                                                               choose: () => this._behaviorChosen(m, 'yaxis', v) })) : [] ),
                ...( _locks.length ? [{ id: `${m.prefix}_ylock`, label: i18n('ui.menu.ylocked'), on: _locks.every(l => l), final: true,
                                        choose: () => this._behaviorChosen(m, 'ylock') }] : [] ),
            ];
        }
        const _menu = m.el();
        const _full = m.prefix.startsWith('eo_') || this._cardsCurveMenu(m.prefix);
        const _g = pairs[0]?.g;
        const _locks = this._yLocks(m);
        const _shown = {
            tooltip: _curves.length > 0,
            cursor: ( kind === 'graph' || kind === 'card' ) && pairs.length > 0,
            yaxis: _curves.length > 0 || _locks.length > 0,
            split: _full && kind === 'entity' && _menu._menuFrom === 'label' && this.canSplitCurve(_g),
            merge: _full && ( kind === 'graph' || ( kind === 'entity' && _menu._menuFrom === 'label' ) ) && this.canMergeGraphUp(_g),
            cut: _full && ( kind === 'graph' || ( kind === 'entity' && _menu._menuFrom === 'label' ) ),
            delete: _full && kind === 'entity' && _menu._menuFrom === 'label',
            gdelete: _full && kind === 'graph' && !_g.isStatic,
        };
        return Object.keys(_BEHAVIOR_ENTRIES).filter(k => _shown[k]).map(k => {
            const _label = i18n(_BEHAVIOR_ENTRIES[k]);
            if( k === 'tooltip' || k === 'cursor' || k === 'yaxis' ) return this._submenuLine(m, `${m.prefix}_behavior_${k}`, _label, ['behavior', k]);
            return { id: `${m.prefix}_${k}`, label: _label, choose: () => this._behaviorChosen(m, k) };
        });
    }

    // Graph g's choice of the cursor submenu (_CURSOR_CHOICES), as its options draw it now
    // (cursorLineOf): none, on it, on every graph in all, and their tooltips too
    _cursorChoiceOf(g)
    {
        const c = this.cursorLineOf(g.type, g.entities[0]);
        return c.tooltips ? 'tooltips' : c.shared ? 'all' : c.show ? 'graph' : 'hide';
    }

    // --------------------------------------------------------------------------------------
    // A menu reopened soon after it was closed opens the submenu it had open, rather than
    // its default one: each kind of menu (an entity's curve menu, a graph's, the options
    // menu) remembers its last open submenu, for SUBMENU_MEMORY_MS once closed. A new
    // entity's curve menu always opens on its display types: it's there to pick one
    // --------------------------------------------------------------------------------------

    // The kind of curve menu input_idx is showing now
    _curveMenuKind(input_idx)
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

    // Opens the curve menu's remembered submenu — else def — once the menu is open (a
    // remembered submenu this menu doesn't show: def)
    _openRememberedSubmenu(input_idx, def)
    {
        // (no room for the menu and a submenu beside its lines: the menu alone, read first —
        // with the keyboard, so that Escape, or the focus leaving it, closes it)
        const _menu = this._this.querySelector(`#et_${input_idx}`);
        if( _menu?.dataset.cramped ) { _menu.focus(); return; }
        if( !this.showCurveSubmenu(input_idx, this._submenuToOpen(this._curveMenuKind(input_idx), def)) ) this.showCurveSubmenu(input_idx, def);
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

    hideEntityCurveMenu(input_idx)
    {
        if( !this._this.querySelector(`#et_${input_idx}`) ) return;
        this._closeMenu(this._curveMenu(input_idx));
        this.resetEntityInput(this.ui.inputField[input_idx]);
    }

    // Opens the curve menu's submenu key (see _openSubmenu) → whether the menu has it
    showCurveSubmenu(input_idx, key)
    {
        return this._openFirstSubmenu(this._curveMenu(input_idx), key);
    }

    // Listeners of the curve menu et_N and its submenus — the card's and the info panel's
    initEntityCurveMenu(_ii)
    {
        this._listenMenu(this._curveMenu(_ii));
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

    // What the appearance list key acts on, graph by graph: its color and its fill, all but a
    // timeline's rows (their colors are their states'; they draw no fill) — curves, bars, an
    // arrowline's rows (its arrows, the band under them); its length, an arrowline's rows; the
    // others, the curves
    _lookByGraph(m, key)
    {
        const _takes = (g, e) => key === 'fill' || key === 'alignment' ? true : key === 'color' ? g.type !== 'timeline' : key === 'length' ? g.type === 'arrowline'
            : key === 'minmax' && g.type === 'arrowline' ? true : this.isCurve(g, g.entities.indexOf(e));
        return this._scopeOf(m).pairs.map(({ g, entities }) => ({ g, curves: entities.filter(e => _takes(g, e)) }))
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
    // entity — a curve, a bar or an arrowline's row (not a timeline's: its colors are its
    // states') — or for arrowline rows only (each on a row of its own: one color for them all
    // still tells them apart); the fill, for all; the length, for arrowline rows; the extremes,
    // for curves and arrowline rows; the others, for curves
    _appearanceLines(m)
    {
        const { kind, pairs } = this._scopeOf(m);
        const _one = kind === 'entity' && pairs.length === 1 && pairs[0].entities.length > 0 && pairs[0].g.type !== 'timeline';
        const _arrowsOnly = pairs.length > 0 && pairs.every(({ g }) => g.type === 'arrowline');
        return Object.keys(_APPEARANCE).filter(k => k === 'color' ? ( _one || _arrowsOnly ) && this._lookByGraph(m, k).length > 0
            : k === 'alignment' ? ( kind === 'graph' || kind === 'card' ) && this._lookByGraph(m, k).length > 0 : this._lookByGraph(m, k).length > 0);
    }

    // Curve e's value of appearance list key — its points (POINTS_VALUES); its extremes
    // (MIN_MAX_VALUES, none: false); its
    // fill: none (false), its color, light (true), fading out ('fade'); its width; its style
    // ('solid' when it has none)
    _lookValue(e, key)
    {
        if( key === 'fill' ) {
            // (its value: none, fade, light, solid — a color of its own, or read indirectly:
            // none of the list's)
            if( e.fill === NO_FILL || e.fill === false ) return false;
            return Object.values(FILL_VALUES).includes(e.fill) ? e.fill : undefined;
        }
        if( key === 'width' ) return e.width;
        if( key === 'minmax' ) return minMaxValue(e.showMinMax) ?? false;
        if( key === 'alignment' ) return this.resolveOption(e, 'alignment');
        if( key === 'points' ) { const v = this.resolveOption(e, 'showPoints'); return allPointsShown(v) ? true : v; }
        return this.resolveOption(e, 'dashMode');
    }

    // The appearance submenu (list null): the color (▸: it opens the browser's picker), the
    // points, the extremes, the fill, the width and the style lists (▸, each a submenu over it) — or one list's values, the
    // one all the curves have in bold; a choice applied at once, saved (see setCurvesLook)
    _appearanceItems(m, [level = null, ...rest])
    {
        const _chosen = () => this._menuChosen(m);
        if( level === null )
            return this._appearanceLines(m).map(k => this._submenuLine(m, `${m.prefix}_appearance_${k}`, i18n(_APPEARANCE[k].label), ['appearance', k]));
        if( rest[0] === 'entity' ) return this._indirectItems(m, level, rest.slice(1));
        const _byGraph = this._lookByGraph(m, level);
        const _curves = _byGraph.flatMap(({ g, curves }) => curves.map(e => ({ g, e })));
        const _d = _APPEARANCE[level];
        const _values = new Set(_curves.map(({ e }) => this._lookValue(e, level)));
        const _cur = _values.size === 1 ? [..._values][0] : undefined;
        // (the color: Automatic — the configuration's, else the class's: in bold when the curves
        // have it —, the browser's picker; the others, their list's values)
        const _lines = level === 'color' ? [
                { id: `${m.prefix}_appearance_color_auto`, label: i18n('ui.menu.look_auto'), final: true, marked: _curves.length > 0 && _curves.every(({ e }) => { const c = this.configuredColor(e); return c !== undefined ? JSON.stringify(c) === JSON.stringify(e.color) : !e.colorSet; }),
                  choose: () => { this.setCurvesAutoColor(_byGraph); _chosen(); } },
                { id: `${m.prefix}_appearance_color_pick`, label: i18n('ui.menu.look_pick'), choose: () => this._pickCurveColor(m.index) }]
            : ( _d.values ?? [] ).map(([v, label]) => ({ label: label.startsWith('ui.') ? i18n(label) : label, marked: v === _cur, final: true,
                choose: () => { this.setCurvesLook(_byGraph, _d.field, v); _chosen(); } }));
        // (from an entity — the one in use in bold)
        if( _INDIRECT_LOOK.includes(level) )
            // (lazy: its box — the entity selector's field, one per menu — filled only when opened)
            _lines.push({ ...this._submenuLine(m, `${m.prefix}_appearance_${level}_entity`, i18n('ui.menu.look_entity'), ['appearance', level, 'entity']), lazy: true,
                          marked: _curves.length > 0 && this._sharedIndirect(_curves, _d.field) !== null });
        return _lines;
    }

    // --------------------------------------------------------------------------------------
    // A look from an entity (Entity ▸ of Color, Fill, Length): the entity searched, then its
    // value or one of its attributes, then Value (the option is that series) or Thresholds ▸
    // (thresholds on its value give the option: each threshold, its value and what it gives;
    // Default; + Add; Blend — a color's number thresholds on the curve's own value)
    // --------------------------------------------------------------------------------------

    // What the curves (of { g, e }) read option field from, if they all read it from the same
    // series the same way: { sid, how: 'value' | 'thresholds', spec } — a curve's own
    // thresholds (no entity) on its own series —; else null
    _sharedIndirect(curves, field)
    {
        const _of = e => {
            const v = e[field];
            if( typeof v === 'string' && isColorSeries(v) ) return { sid: v.trim(), how: 'value' };
            if( v && typeof v === 'object' && Array.isArray(v.thresholds) )
                return { sid: v.entity !== undefined ? seriesId(v.entity, v.attribute) : e.entity, how: 'thresholds', spec: v };
            return null;
        };
        const _all = curves.map(({ e }) => _of(e));
        const _first = _all[0];
        return _first && _all.every(x => x && x.sid === _first.sid && x.how === _first.how && JSON.stringify(x.spec) === JSON.stringify(_first.spec)) ? _first : null;
    }

    // Entity ▸'s lines of list key (path: what is chosen after it — the entity, its series, …)
    _indirectItems(m, key, path)
    {
        const _base = ['appearance', key, 'entity'];
        const _id = `${m.prefix}_appearance_${key}_entity`;
        const _field = _APPEARANCE[key].field;
        const _curves = this._lookByGraph(m, key).flatMap(({ g, curves }) => curves.map(e => ({ g, e })));
        const _cur = this._sharedIndirect(_curves, _field);
        const [eid, sid, th, item] = path;
        // The entity: the entity selector's field (the menu's own, MENU_SELECTOR + its index —
        // the same list, filtered as it's typed, its attributes ▸), the series chosen going on
        // with what is done with it (menuSeriesChosen)
        if( eid === undefined ) {
            const k = this.menuSelector(m.index);
            // (one field a menu: another Entity ▸'s — of another list, opened before — emptied,
            // so the selector reads this one — see setDropdownVisibility, #b7_k)
            for( const other of _INDIRECT_LOOK ) if( other !== key ) this._this.querySelector(`#${m.prefix}_appearance_${other}_entity_sub`)?.replaceChildren();
            this._this.querySelector(`#${m.prefix}_add_sub`)?.replaceChildren();
            this._menuSource = { m, key };
            return [{ id: `b7_${k}`, lineId: `${_id}_field`, label: '', input: { text: true, placeholder: i18n('ui.label.type_to_search') }, value: '',
                      bind: el => {
                          this.bindEntitySelector(k, el);
                          // (its box as wide as the list under it needs, its names whole — the list as
                          // wide as the box, see setDropdownVisibility and fitCascade)
                          el._wantWidth = () => Math.ceil(this.entityLineWidths().all);
                      } }];
        }
        // (its lines' ids the card's own names, never the series': one series chosen at a time)
        const _sid = `${_id}_series`;
        // What is done with the series: its value as it is, or thresholds on it
        if( th === undefined )
            return [{ id: `${_sid}_value`, label: i18n('ui.menu.series_value'), marked: _cur?.sid === sid && _cur.how === 'value', final: true,
                      choose: () => { this._setIndirect(m, key, () => sid); this._menuChosen(m); } },
                    { ...this._submenuLine(m, `${_sid}_th`, i18n('ui.menu.look_thresholds'), [..._base, eid, sid, 'th']),
                      marked: _cur?.sid === sid && _cur.how === 'thresholds' }];
        return this._thresholdItems(m, key, sid, `${_sid}_th`, [..._base, eid, sid, 'th'], item, _cur);
    }

    // Series sid chosen in menu i's entity selector (Entity ▸ of list key): what is done with
    // it opened over the field — Value, Thresholds ▸
    menuSeriesChosen(i, sid)
    {
        const { m, key, add } = this._menuSource ?? {};
        if( add ) return this.graphAddChosen(m, [sid]);
        const _line = m && this._this.querySelector(`#${m.prefix}_appearance_${key}_entity_field`);
        if( _line ) this._openSubmenu(m, ['appearance', key, 'entity', seriesOf(sid).entity, sid], _line);
    }

    // --------------------------------------------------------------------------------------
    // A graph's Add ▸: an entity added to that graph — the card's selector, the same steps
    // (its field, its attributes ▸, a wildcard), the graph taking it as a curve dragged onto
    // it (shownIn): refused when it shows it already or can't show it; one shown in another
    // graph, Cancel or a second curve; else its display types, those the graph takes
    // --------------------------------------------------------------------------------------

    // Add ▸'s lines (path ['add']: the entity selector's field, the menu's own — the same as
    // Entity ▸'s —; ['add', id]: id shown in another graph — Cancel, a second curve)
    _graphAddItems(m, path)
    {
        const [, dup] = path;
        if( dup !== undefined )
            return [{ id: `${m.prefix}_add_cancel`, label: i18n('ui.menu.duplicate_cancel'), marked: true, final: true, choose: () => m.close() },
                    { id: `${m.prefix}_add_second`, label: i18n('ui.menu.duplicate_create'), final: true, choose: () => this._graphAddTypes(m, [dup]) }];
        const k = this.menuSelector(m.index);
        // (one field a menu: an Entity ▸'s opened before emptied — see _indirectItems)
        for( const key of _INDIRECT_LOOK ) this._this.querySelector(`#${m.prefix}_appearance_${key}_entity_sub`)?.replaceChildren();
        this._menuSource = { m, add: true };
        return [{ id: `b7_${k}`, lineId: `${m.prefix}_add_field`, label: '', input: { text: true, placeholder: i18n('ui.label.type_to_search') }, value: '',
                  bind: el => {
                      this.bindEntitySelector(k, el);
                      el._wantWidth = () => Math.ceil(this.entityLineWidths().all);
                  } }];
    }

    // Is selector idx the field of a graph's Add ▸? (its Enter as the card's: a wildcard
    // takes every entity it shows — see card-selector.js)
    addsToGraph(idx)
    {
        const s = this._menuSource;
        return idx >= MENU_SELECTOR && !!s?.add && s.m.index === idx - MENU_SELECTOR;
    }

    // Series ids chosen in Add ▸ of menu m (a wildcard: several): those its graph shows already,
    // or can't show (a state that isn't a number elsewhere than on a timeline), refused as a
    // curve dragged onto it — said, the graph outlined —; one shown in another graph: Cancel
    // or a second curve (several: left out, said, their graphs outlined, as the card's); the
    // others, their display types
    graphAddChosen(m, ids)
    {
        const { g } = this._menuTargets(m.index);
        if( !g ) return;
        const _line = this._this.querySelector(`#${m.prefix}_add_field`);
        const _r = _line?.getBoundingClientRect();
        const _say = text => this.showMessage(text, _r ? _r.left : 0, _r ? _r.bottom : 0, 'left', _line ?? document.body);
        const _here = ids.filter(id => g.entities.some(e => e.entity === id));
        const _cant = ids.filter(id => !_here.includes(id) && !this.isNumericEntity(id) && g.type !== 'timeline');
        const _elsewhere = ids.filter(id => !_here.includes(id) && !_cant.includes(id) && this.store.curvesOf(id).length);
        const _new = ids.filter(id => !_here.includes(id) && !_cant.includes(id) && !_elsewhere.includes(id));
        const _said = [];
        if( _here.length ) { this.flagGraphs([g]); _said.push(i18n('ui.label.already_exists') + ': ' + _here.join('; ')); }
        if( _cant.length ) _said.push(`timeline ≠ ${g.type}: ` + _cant.join('; '));
        if( _elsewhere.length ) {
            this.flagGraphs(this.graphs.filter(x => x.entities.some(e => _elsewhere.includes(e.entity))));
            if( ids.length > 1 ) _said.push(i18n('ui.label.already_exists') + ': ' + _elsewhere.join('; '));
        }
        if( _said.length ) _say(_said.join(' — '));
        if( _new.length ) return this._graphAddTypes(m, _new);
        if( ids.length === 1 && _elsewhere.length && _line ) this._openSubmenu(m, ['add', _elsewhere[0]], _line);
    }

    // The display types of series ids being added to the graph of menu m: the curve menu of
    // an entity being added, for that graph (addTo — its types those it takes)
    _graphAddTypes(m, ids)
    {
        const { g } = this._menuTargets(m.index);
        if( !g ) return;
        const _menu = m.el(), _r = _menu.getBoundingClientRect();
        this._openCurveMenu(m.index, {
            entityId: ids.length === 1 ? ids[0] : ids, graphId: null, key: null,
            forGraph: false, from: 'add', anchor: _menu._menuAnchor ?? null, addTo: g.id,
        }, { x: _r.left, y: _r.top }, 'left', g.canvas?.parentNode, 'rep');
    }

    // The thresholds being chosen for list key on series sid: the curves' own when they read
    // it so (cur), else the ones being written (m._draft), else none yet
    _thresholdsOf(m, key, sid, cur)
    {
        if( cur?.sid === sid && cur.how === 'thresholds' ) return cur.spec;
        const d = m._draft;
        return d?.key === key && d.sid === sid ? d.spec : { thresholds: [], states: {}, default: undefined };
    }

    // Thresholds ▸ (item undefined): each threshold — `≥ value`, a state `= state` — and what it
    // gives (▸: its own submenu; a long press deletes it), Default ▸, + Add ▸, Blend (a
    // color's number thresholds on the curve's own value: colorTransition smooth); a
    // threshold's submenu (item: 't' and its index, 's' and its state's, 'd' the default, 'add')
    _thresholdItems(m, key, sid, id, path, item, cur)
    {
        const spec = this._thresholdsOf(m, key, sid, cur);
        const _states = Object.keys(spec.states ?? {});
        const _write = s => this._writeThresholds(m, key, sid, s);
        const _copy = () => ({ thresholds: spec.thresholds.map(t => [...t]), states: { ...spec.states }, default: spec.default });
        if( item === undefined ) {
            const _line = (k, label, v) => { const _t = this._resultText(key, v); return { ...this._submenuLine(m, `${id}_${k}`, _t ? `${label}  ${_t}` : label, [...path, k]), lead: this._resultSwatch(key, v) }; };
            const _lines = [
                ...spec.thresholds.map(([t, v], i) => ({ ..._line('t' + i, `≥ ${t}`, v),
                    longPress: () => { const s = _copy(); s.thresholds.splice(i, 1); _write(s); } })),
                ..._states.map((st, i) => ({ ..._line('s' + i, `= ${st}`, spec.states[st]),
                    longPress: () => { const s = _copy(); delete s.states[st]; _write(s); } })),
                _line('d', i18n('ui.menu.look_default'), spec.default),
                this._submenuLine(m, `${id}_add`, i18n('ui.menu.look_add'), [...path, 'add']),
            ];
            const _own = { ...spec, entity: undefined };
            if( key === 'color' && isBlendable(_own) && !spec.entity ) {
                const _curves = this._lookByGraph(m, key).flatMap(({ g, curves }) => curves.map(e => ({ g, e })));
                const _on = _curves.length > 0 && _curves.every(({ e }) => this.resolveOption(e, 'colorTransition') === 'smooth');
                _lines.push({ id: `${id}_blend`, label: i18n('ui.menu.look_blend'), on: _on,
                    choose: () => { this.setCurvesLook(this._lookByGraph(m, key), 'colorTransition', _on ? 'hard' : 'smooth'); this._fillMenu(m); } });
            }
            return _lines;
        }
        // + Add: a value typed (a number: a threshold; a text: a state), or one of the series'
        // known states — what it gives, the curve's own for now (changed in its own submenu)
        if( item === 'add' ) {
            const _add = v => {
                const s = _copy(), n = Number(v), r = this._newResult(m, key);
                if( v === '' || v === null || v === undefined ) return;
                if( String(v).trim() !== '' && isFinite(n) ) { s.thresholds = s.thresholds.filter(t => t[0] !== n); s.thresholds.push([n, r]); s.thresholds.sort((a, b) => a[0] - b[0]); }
                else s.states[String(v).trim()] = r;
                _write(s);
            };
            return [{ id: `${id}_add_value`, label: i18n('ui.menu.series_value'), input: { text: true }, value: '', change: v => { _add(v); return ''; } },
                    ...this._knownStates(sid).filter(st => !( st in ( spec.states ?? {} ) )).map((st, i) => ({ id: `${id}_add_${i}`, label: st, final: true, choose: () => _add(st) }))];
        }
        // A threshold's own submenu: its value (not the default's), what it gives
        const _t = item[0] === 't' ? spec.thresholds[Number(item.slice(1))] : null;
        const _st = item[0] === 's' ? _states[Number(item.slice(1))] : null;
        const _v = _t ? _t[1] : _st !== null ? spec.states[_st] : spec.default;
        const _set = r => {
            const s = _copy();
            if( _t ) s.thresholds[Number(item.slice(1))][1] = r; else if( _st !== null ) s.states[_st] = r; else s.default = r;
            _write(s);
        };
        const _lines = [];
        if( _t || _st !== null ) _lines.push({ id: `${id}_${item}_value`, label: i18n('ui.menu.series_value'), input: { text: true }, value: _t ? String(_t[0]) : _st,
            change: v => {
                const s = _copy(), n = Number(v), r = _v;
                if( _t ) s.thresholds.splice(Number(item.slice(1)), 1); else delete s.states[_st];
                if( String(v).trim() !== '' && isFinite(n) ) { s.thresholds.push([n, r]); s.thresholds.sort((a, b) => a[0] - b[0]); }
                else if( String(v).trim() !== '' ) s.states[String(v).trim()] = r;
                _write(s); return v; } });
        return [..._lines, ...this._resultLines(m, key, `${id}_${item}`, _v, _set)];
    }

    // What a threshold of list key gives, its lines: a color, the picker; a fill, its list's
    // values and the picker; a length, a number from 0 to 100
    _resultLines(m, key, id, v, set)
    {
        const _pick = { id: `${id}_pick`, label: i18n('ui.menu.look_pick'), choose: () => this._pickColor(m.index, typeof v === 'string' ? v : null, c => set(c)) };
        if( key === 'color' ) return [_pick];
        if( key === 'fill' ) return [...Object.entries(FILL_VALUES).map(([k, f]) => ({ id: `${id}_${k}`, label: i18n('ui.menu.fill_' + k), marked: v === f, final: true, choose: () => set(f) })), _pick];
        return [{ id: `${id}_length`, label: i18n('ui.menu.look_length'), input: { min: 0, max: 100, step: 1 }, value: v ?? '',
                  change: x => { const n = Math.min(100, Math.max(0, Number(x))); if( isFinite(n) ) set(n); return n; } }];
    }

    // What a threshold gives, as a line shows it: a length in %, a fill's name; a color: none
    // (its swatch, _resultSwatch); nothing given: —
    _resultText(key, v)
    {
        if( v === undefined ) return '—';
        if( key === 'length' ) return `${v} %`;
        if( key === 'fill' ) { const k = Object.keys(FILL_VALUES).find(k => FILL_VALUES[k] === v); if( k ) return i18n('ui.menu.fill_' + k); }
        return '';
    }

    // A threshold's color, as a swatch before its line (a color or a fill's color)
    _resultSwatch(key, v)
    {
        const c = key !== 'length' && typeof v === 'string' && !Object.values(FILL_VALUES).includes(v) ? colorSpec(v)?.color : null;
        return c ? `<span style="display:inline-block;width:10px;height:10px;margin-right:6px;border-radius:2px;border:1px solid #888;background:${c}"></span>` : '';
    }

    // What a new threshold of list key gives at first: the curves' color, a light fill, the
    // whole length
    _newResult(m, key)
    {
        const _e = this._lookByGraph(m, key)[0]?.curves[0];
        return key === 'color' ? ( colorSpec(this.entityColor(_e))?.color ?? '#000000' ) : key === 'fill' ? 'light' : 100;
    }

    // The states series sid is known to take: its options (a select's), else its state now
    _knownStates(sid)
    {
        const { entity, attribute } = seriesOf(sid);
        const _s = this.stateOf(entity);
        const _now = attribute ? _s?.attributes?.[attribute] : _s?.state;
        const _opts = !attribute && Array.isArray(_s?.attributes?.options) ? _s.attributes.options : [];
        return [...new Set([..._opts, _now].filter(x => typeof x === 'string' && x !== '' && !isFinite(Number(x))))];
    }

    // Thresholds s on series sid written for list key of menu m's curves — on each its own
    // series, without an entity; on another, with it —, the menu showing them at once; none yet
    // (no threshold, no default): kept being written (m._draft) until there is one
    _writeThresholds(m, key, sid, s)
    {
        m._draft = { key, sid, spec: s };
        if( s.thresholds.length || Object.keys(s.states).length || s.default !== undefined ) {
            const { entity, attribute } = seriesOf(sid);
            this._setIndirect(m, key, e => e.entity === sid ? { ...s } : { entity, ...( attribute ? { attribute } : {} ), ...s });
        }
        this._fillMenu(m);
    }

    // List key of menu m's curves set to what valueOf(curve) gives (the curves given the same
    // value together, in every graph: one change each)
    _setIndirect(m, key, valueOf)
    {
        const _field = _APPEARANCE[key].field, _by = new Map();
        for( const { g, curves } of this._lookByGraph(m, key) ) for( const e of curves ) {
            const v = valueOf(e), k = JSON.stringify(v);
            if( !_by.has(k) ) _by.set(k, { v, pairs: new Map() });
            const P = _by.get(k).pairs;
            if( !P.has(g) ) P.set(g, []);
            P.get(g).push(e);
        }
        for( const { v, pairs } of _by.values() ) this.setCurvesLook([...pairs].map(([g, curves]) => ({ g, curves })), _field, v);
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
        // (every entity the menu acts on: one, or a graph's arrowline rows)
        const _keys = entities.map(keyOf);
        this._pickColor(input_idx, this.entityColor(entities[0]), v => {
            this.setCurvesLook(this.graphs.map(g => ({ g, curves: g.entities.filter(e => _keys.includes(keyOf(e))) })).filter(p => p.curves.length), 'color', v);
        });
    }

    // A color chosen in the browser's picker, opened from menu input_idx (closed: the picker
    // takes over) on color (null: black) — then apply(it)
    _pickColor(input_idx, color, apply)
    {
        const _tb = this.menuParent(input_idx);
        const _p = _tb.getBoundingClientRect();
        const _c = Chart.helpers.color(color ?? '#000000');
        this.hideEntityCurveMenu(input_idx);
        // (centred in the part of the screen the page is shown on — shownRect)
        const _s = Chart.hecUi.shownRect();
        const _left = _s.left + Math.max(0, ( _s.right - _s.left - PICKER_SIZE.width ) / 2) - _p.left;
        const _top = _s.top + Math.max(0, ( _s.bottom - _s.top - PICKER_SIZE.height ) / 2) - _p.top;
        this.openNativePicker(_tb, 'color', _left, _top, _c.valid ? _c.hexString() : '#000000', apply);
    }

    // --------------------------------------------------------------------------------------
    // The choices made in the sections — for the curves the menu acts on
    // --------------------------------------------------------------------------------------

    // The interpolation algo for menu m's curves — those interpolated
    _interpolationChosen(m, algo)
    {
        this.setInterpolation(this._scopeOf(m).pairs, algo);
        this._menuChosen(m);
    }

    // Behavior: the tooltip's behavior of the curves (value), the graphs' cursor (a choice of
    // _CURSOR_CHOICES), or the Y axes locked or released
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
            this.setCurvesTooltip(this._curvesByGraph(m), value);
            return this._menuChosen(m);
        }
        if( action === 'cursor' ) {
            this.setGraphsCursor(pairs.map(p => p.g), { ..._CURSOR_CHOICES[value], cursorTypes: value === 'hide' ? undefined : ['all'] });
            return this._menuChosen(m);
        }
        if( action === 'yaxis' ) {
            this.setCurvesLook(this._curvesByGraph(m), 'yAxis', value);
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
            const _entity_id = _menu._menuEntityId, _into = _menu._menuAddTo ? this.graphs.find(x => x.id === _menu._menuAddTo) : null;
            m.close();
            // (a graph's Add ▸: into that graph)
            if( _into ) return this.showAdded(m.index, this.addCurvesTo(_into, Array.isArray(_entity_id) ? _entity_id : [_entity_id], type, lineMode));
            // Brand-new entities (a wildcard: several), created now as chosen — their names
            // shown a moment in the selector's field
            return this.showAdded(m.index, this.addCurves(Array.isArray(_entity_id) ? _entity_id : [_entity_id], type, lineMode));
        }
        if( kind === 'graph' || kind === 'card' ) this.setGraphsType(pairs.map(p => p.g), type, lineMode);
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
                return [...this._sectionLines(m), ...['export', 'card', 'all'].map(k => this._submenuLine(m, `eo_${i}_${k}`, i18n(_OPTIONS_SUBMENUS[k]), [k])),
                        ...( this.infoPanel ? [] : [this._submenuLine(m, `eo_${i}_tests`, i18n(_OPTIONS_SUBMENUS.tests), ['tests'], ';border-top:1px solid #444')] )];
            },
            sub: path => this._optionsSubmenuLines(i, path),
            close: () => this.menuSetVisibility(i, false),
        });
    }

    // An options submenu's lines (path: see _menuOf): a section's, for every curve of the
    // card; the exports (the statistics with the long-term statistics on — ▸ their periods); the tests; the card's actions
    // (▸: each confirmed first in a submenu over it — Confirm or Cancel, Cancel marked); the
    // info panel's switch and the gesture thresholds, as they are
    _optionsSubmenuLines(i, path)
    {
        const [key, level = null] = path;
        const m = this._optionsMenu(i);
        if( _SECTIONS[key] ) return this._sectionItems(m, path);
        if( key === 'export' ) return this._exportLines(m, level, seriesOfGraphs(this.graphs), { kind: 'card' });
        if( key === 'tests' ) return Object.keys(CARD_TESTS).map(k => ({ id: `eo_${i}_test_${k}`, label: i18n(CARD_TESTS[k].label),
                                                                         choose: () => { this.menuSetVisibility(i, false); openCardTest(k, this); } }));
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

    // The Export submenu of menu m — the options menu's (every curve), a graph's, a curve's: ids,
    // their series; scope, what its YAML is (see CardYaml.yamlText) —, level null: its history
    // and ▸ its statistics (with the long-term statistics on) — files (_FILE_ICON) —, ▸ its YAML
    // (copied: _CLIPBOARD_ICON); level 'stats': their periods — each exported for ids, over the
    // window shown; level 'yaml': simplified, complete — the message saying it's copied where
    // the line was. Each file line says how many of them have data there, at least in part
    // (greyed, none: see exportAvailability); a period the cache holds over the whole window in
    // bold, the one chosen last time in italic
    _exportLines(m, level, ids, scope)
    {
        const a = this.exportAvailability(ids), _n = (label, n) => `${label} (${n})`;
        if( level === 'stats' )
            return STATS_EXPORT_PERIODS.map(p => ({ id: `${m.prefix}_stats_${p.period}`, label: _n(i18n(`ui.interval.${p.label}`), a.periods[p.period]),
                                                    marked: p.period === this.exportStatsPeriod(), markedItalic: true, strong: a.cached[p.period], disabled: !a.periods[p.period],
                                                    choose: () => { m.close(); this.exportStatistics(p.period, ids); } }));
        if( level === 'yaml' )
            return [['simple', false], ['full', true]].map(([k, full]) => ({ id: `${m.prefix}_yaml_${k}`, label: i18n(`ui.menu.export_yaml_${k}`),
                choose: line => { const r = line.getBoundingClientRect(); m.close(); this.exportYaml(scope, full, { clientX: r.left, clientY: r.top + r.height / 2 }); } }));
        return [{ id: `${m.prefix}_csv`, lead: _FILE_ICON, label: _n(i18n('ui.menu.export_csv'), a.history), disabled: !a.history, choose: () => { m.close(); this.exportFile(ids); } },
                ...( this.statistics?.enabled ? [{ ...this._submenuLine(m, `${m.prefix}_stats`, _n(i18n('ui.menu.export_stats'), a.statistics), ['export', 'stats']), lead: _FILE_ICON, disabled: !a.statistics }] : [] ),
                { ...this._submenuLine(m, `${m.prefix}_yaml`, i18n('ui.menu.export_yaml'), ['export', 'yaml']), lead: _CLIPBOARD_ICON }];
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

    // The magnifier's menu opened, under it (menuParent: its positioned parent)
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
    // entity curve menu, options menu) — Escape closes, ArrowUp/ArrowDown move the highlight,
    // Enter activates the highlighted item (or the first visible one). This is purely menu
    // navigation, the same regardless of what the menu actually contains — any
    // menu-specific business logic (e.g. the entity selector's wildcard/multi-select/
    // already-selected handling, or the entity curve menu's default/active-type bolding)
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
            // entity curve menu's "bold = currently active type") set by the caller, not by
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
    // curve menu, options menu): makes the menu visible, applies the position its caller
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
    menuParent(i)
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
    // the last line's submenu too; only with no room for that, as wide as the menu at most
    // (it hides no line below it). Set when the menu opens (with what it shows then), so it keeps its width. With
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
        const _need = Math.max(+menuEl.dataset.minWidth, _hasSubs ? this._menuNeed(menuEl, _room) : 0);
        menuEl.style.maxWidth = Math.floor(_room) + 'px';
        menuEl.style.minWidth = Math.floor(Math.min(_need, _room)) + 'px';
        menuEl.dataset.cramped = _need > _room ? '1' : '';
    }

    // The room a menu has: the card's width, within the screen's
    _menuRoom()
    {
        return Math.min(this.cardWidth() || Infinity, document.documentElement.clientWidth || Infinity);
    }

    // The width menuEl needs to stay readable under its submenus (its own, without any): each
    // submenu fitting within it beside its lines, the last line's too — only when there's no
    // room for that (room: what the menu may take), the last line's submenu as wide as the
    // menu (it hides no other line)
    _menuNeed(menuEl, room = this._menuRoom())
    {
        return this._laidOut(menuEl, () => {
            const _lines = this._menuLines(menuEl);
            const _withSub = _lines.filter(a => this._submenuOf(a));
            if( !_withSub.length ) return menuEl.offsetWidth;
            const _readable = maxOf(_lines.map(a => this._lineTextWidth(a)));
            const _last = _lines[_lines.length - 1];
            return Math.max(menuEl.offsetWidth, maxOf(_withSub.map(a => {
                const _sub = this._menuNeed(this._submenuOf(a), room);
                return a === _last && _sub + _readable > room ? _sub : _sub + _readable;
            })));
        });
    }

    // What a submenu leaves of its menu's lines, at least: the start of their text, the width
    // of two wide characters ('MM', in the line's font) — in a proportional font, two of them
    // at least, two and a half or three most often; a field's: of its input (a box without
    // lines: nothing)
    _menuStrip(menuEl)
    {
        return Math.max(0, maxOf(this._stripLines(menuEl).map(a => this._lineStart(a) + this._wideChars(a, 2))));
    }

    // Where a line's text starts, from the line's left edge: after its left padding and a
    // symbol (lead) — a field's: its input's text
    _lineStart(line)
    {
        const _in = line.querySelector('input');
        if( _in ) return _in.getBoundingClientRect().left - line.getBoundingClientRect().left + ( parseFloat(getComputedStyle(_in).paddingLeft) || 0 );
        const _text = document.createTreeWalker(line, NodeFilter.SHOW_TEXT).nextNode();
        if( !_text ) return 0;
        const _range = document.createRange();
        _range.setStart(_text, 0);
        _range.setEnd(_text, 0);
        return _range.getBoundingClientRect().left - line.getBoundingClientRect().left;
    }

    // The width of n wide characters ('M') in line's font — its input's for a field
    _wideChars(line, n)
    {
        const _s = document.createElement('span');
        _s.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${getComputedStyle(line.querySelector('input') ?? line).font}`;
        _s.textContent = 'M'.repeat(n);
        line.appendChild(_s);
        const _w = _s.getBoundingClientRect().width;
        _s.remove();
        return _w;
    }

    // A menu's lines shown, and the submenu a line opens
    _menuLines(menuEl)
    {
        return [...menuEl.children].filter(a => a.tagName === 'A' && a.style.display !== 'none');
    }
    // (and its fields' lines: what a box over it leaves of each, see _menuStrip)
    _stripLines(menuEl)
    {
        return [...menuEl.children].filter(a => ( a.tagName === 'A' || a.tagName === 'LABEL' ) && a.style.display !== 'none');
    }
    _submenuOf(line)
    {
        return line.id ? line.parentNode?.parentNode?.querySelector(`#${line.id}_sub`) : null;
    }

    // A line's width up to its text's end (its first n characters) — what's before the text
    // with it: its left padding, a symbol (lead) —, and a gap after its whole text
    _lineTextWidth(line, n = Infinity)
    {
        // (a field's line: its strip, whatever n — a box over it covers what's typed but its start)
        if( line.querySelector('input') ) return this._lineStart(line) + this._wideChars(line, 2);
        const _text = document.createTreeWalker(line, NodeFilter.SHOW_TEXT).nextNode();
        if( !_text ) return 0;
        const _range = document.createRange();
        _range.setStart(_text, 0);
        _range.setEnd(_text, Math.min(n, _text.length));
        // (its first characters: no more — a box over it starts right after; its whole text: a gap)
        return _range.getBoundingClientRect().right - line.getBoundingClientRect().left + ( n === Infinity ? 8 : 0 );
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
    // Its own width; the cascade then fitted (fitCascade): the room it lacks taken from the
    // boxes over it, its lines cut ('…') only when they can give no more
    openSubmenu(subEl, itemEl)
    {
        const _menu = itemEl.offsetParent;
        const _cb = (_menu?.offsetParent ?? document.body).getBoundingClientRect();
        const _item = itemEl.getBoundingClientRect();
        // (its own width — the cascade fitted after, fitCascade)
        subEl.dataset.room = this._menuRoom();
        this.openMenu(subEl, (_item.top - _cb.top) + 'px', (_menu.getBoundingClientRect().right - _cb.left) + 'px', 'right');
        // (moved up to fit the screen: never above its menu — its first line within it, see
        // followAnchor —, the rest masked below)
        const _above = _menu.getBoundingClientRect().top - subEl.getBoundingClientRect().top;
        if( _above > 0 ) subEl.style.top = ( ( parseFloat(subEl.style.top) || 0 ) + _above ) + 'px';
    }

    _navigateMenuArrowKey(visible, key)
    {
        // Shared ArrowUp/ArrowDown wraparound highlight logic for the entity curve menu
        // (et_N), the entity selector dropdown (es_N), and the options menu (eo_N) — moves
        // the highlighted <a> to the next/previous visible item, wrapping at either end.
        // Only ever touches the navigation highlight (background + selected marker) —
        // never fontWeight, which is menu-specific business state (e.g. the entity type
        // menu's "bold = default/currently active type", or the selector's wildcard-match
        // bolding) set by the caller, not by this generic navigation logic.
        const _cur = visible.find(a => a.dataset.selected);
        // The entity curve menu marks its default/active option with selected right when
        // the menu opens (see showEntityCurveMenu), before any key is pressed — no blue
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
