// The card's HTML: its toolbar and menus' entries, the entity selector (with wildcards), the
// interval selector of bar graphs, and their layout as the card resizes. Part of
// HistoryCardState (added to it in history-explorer-card.js).

import { i18n } from "./languages.js";
import { BAR_INTERVALS, TIME_RANGES } from "./history-options.js";
import { typeMenuHtml, optionsMenuHtml, zoomMenuHtml, magnifierSvg } from "./card-menus.js";
const moment = window.HXLocal_moment;
const Chart = window.HXLocal_Chart;


const BUTTON_STYLE = 'margin:0px;border:0px solid black;color:inherit;background-color:#00000000';

// The toolbar's time buttons, its left part (#dl_N's content): '<', the date, '>' — the
// card's and the info panel's. (Side by side, '<' and '>' in bold, the date's padding
// narrower: about as far from each other as the zoom controls are — see rangeControlsHtml)
export function timeButtonsHtml(i)
{
    return `<button id="b1_${i}" style="${BUTTON_STYLE};height:30px;font-weight:bold"><</button>` +
        `<button id="bx_${i}" style="${BUTTON_STYLE};height:30px;padding:1px 5px">-</button>` +
        `<button id="b2_${i}" style="${BUTTON_STYLE};height:30px;font-weight:bold">></button>`;
}

// The toolbar's zoom controls, its right part (#dr_N's content): the magnifier (and its
// modes' menu, ez_N), the magnifier −, the range selector, the magnifier + (their actions
// swapped by invertZoom; the three of the same size) — the card's and the info panel's
export function rangeControlsHtml(i, optionStyle, invertZoom)
{
    // (side by side, about 10 px apart as they're seen — as the time buttons are: margins
    // between the magnifiers; the selector's text centred — by the browser
    // left of its arrow, it would look too far right, between the magnifier − and the arrow)
    // (each magnifier twice as large under the pointer — a mouse, a pen above the screen, a
    // finger while it presses —, drawn over its neighbours, the layout unchanged, so as to see
    // what is clicked: hec-big, see wireToolbar)
    return `<style>.hec-mag svg{position:relative;z-index:2;transition:transform .12s}.hec-mag.hec-big svg{transform:scale(2)}</style>` +
        `<button id="bz_${i}" class="hec-mag" style="${BUTTON_STYLE};margin-right:4px;height:30px;padding:0;vertical-align:top">${magnifierSvg('xy', undefined, 20)}</button>${zoomMenuHtml(i)}` +
        `<button id="b${invertZoom ? 5 : 4}_${i}" class="hec-mag" style="${BUTTON_STYLE};margin-right:2px;height:30px;padding:0;vertical-align:top">${magnifierSvg('out', undefined, 20)}</button>` +
        `<select id="by_${i}" style="${BUTTON_STYLE};height:30px;max-width:83px;text-align:center;text-align-last:center">` +
            TIME_RANGES.map(r => `<option value="${r.hours}" ${optionStyle}${r.menu === false ? ' hidden' : ''}></option>`).join('') +
        `</select>` +
        `<button id="b${invertZoom ? 4 : 5}_${i}" class="hec-mag" style="${BUTTON_STYLE};margin-left:5px;height:30px;padding:0;vertical-align:top">${magnifierSvg('in', undefined, 20)}</button>`;
}

export class CardToolbar
{
    // --------------------------------------------------------------------------------------
    // HTML generation
    // --------------------------------------------------------------------------------------

    // TOOLBAR LAYOUT — CSS Grid, layouts A/B/C/D (its parts shared with the info panel:
    // timeButtonsHtml, rangeControlsHtml)
    // The menus of an entity and of a graph on a card without any entity selector, where
    // they otherwise are: their gestures (a long-press on a label, on the ⠿ zone…) open them
    // the same — #hm_0 is their positioned parent, as #tb_0 is with the selector
    menusOnlyHtml()
    {
        return `<div id="hm_0" style="position:relative;height:0;line-height:normal">${typeMenuHtml(0, true)}</div>`;
    }

    addUIHtml(tools, selector, bgcol, optionStyle, inputStyle, invertZoom, i)
    {
        let html = '';

        if( (tools || selector) && (this.ui.stickyTools & (1<<i)) ) {
            const threshold = i ? 'bottom:0px' : 'top:var(--header-height)';
            html = `<div data-sticky="${i ? 'bottom' : 'top'}" style="position:sticky;${threshold};padding-top:${this.ui.hideHeader ? 0 : 15}px;padding-bottom:10px;margin-top:-${this.ui.hideHeader ? 0 : 15}px;z-index:1;background-color:var(--card-background-color);line-height:0px;">`;
        } else if( tools || selector ) {
            // Always wrap in a div, sticky or not — _footerAnchor()'s walk-up-to-gl's-
            // direct-child loop already targets this wrapper automatically (same mechanism
            // as the sticky case). The spacing margin lives on the wrapper itself (not a
            // <br> sibling), so it's structurally inseparable from the toolbar — a graph
            // being inserted before this whole block can never end up between them.
            // Bottom toolbar: margin-top (space above it); top toolbar: margin-bottom
            // (space below it). 0 when sticky — the wrapper's own padding already covers it.
            html = `<div style="margin-${i ? 'top' : 'bottom'}:8px;">`;
        }

        if( tools || selector ) html += `<div id="tb_${i}" style="position:relative;margin-left:0px;width:100%;min-height:30px;display:grid;grid-template-columns:1fr auto 1fr;grid-template-areas:'dl sl dr';align-items:center;line-height:normal;">`;

        if( tools ) html += `
            <div id="dl_${i}" style="background-color:${bgcol};padding-left:5px;padding-right:5px;grid-area:dl;justify-self:start;">${timeButtonsHtml(i)}
            </div>`;

        if( selector ) html += `
            <div id='sl_${i}' style="display:none;padding-left:10px;padding-right:10px;text-align:center;grid-area:sl;justify-self:center;min-width:0;overflow:hidden;">
                <input id="b7_${i}" ${inputStyle} autoComplete="off"/>
                <div id="es_${i}" style="display:none;position:absolute;box-sizing:border-box;text-align:left;max-height:50vh;overflow:auto;border:1px solid #444;z-index:1;color:var(--primary-text-color);background-color:var(--card-background-color)"></div>
                <div id="es_${i}_series" tabindex="0" style="display:none;position:absolute;text-align:left;min-width:180px;max-height:50vh;overflow:auto;border:1px solid #444;box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2);z-index:2;color:var(--primary-text-color);background-color:var(--card-background-color);outline:none"></div>
                <div id="es_${i}_choice" tabindex="0" style="display:none;position:absolute;text-align:left;min-width:180px;max-height:50vh;overflow:auto;border:1px solid #444;box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2);z-index:2;color:var(--primary-text-color);background-color:var(--card-background-color);outline:none"></div>
                ${typeMenuHtml(i, true)}
                <button id="bo_${i}" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px;margin-left:1px;margin-right:0px;"><svg width="18" height="18" viewBox="0 0 24 24" style="vertical-align:middle;"><path fill="var(--primary-text-color)" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" /></svg></button>
                ${optionsMenuHtml(i)}
            </div>`;

        if( tools ) html += `
            <div id="dr_${i}" style="background-color:${bgcol};padding-left:5px;padding-right:5px;grid-area:dr;justify-self:end;">${rangeControlsHtml(i, optionStyle, invertZoom)}
            </div>`;

        if( tools || selector ) html += `</div>`;

        html += `<div id='rf_${i}' style="margin-left:0px;margin-top:10px;margin-bottom:0px;width:100%;text-align:center;display:none;line-height:normal;"></div>`;

        if( tools || selector ) html += `</div>`;

        return html;
    }

    // Real time shown in the toolbars: their '>' greyed and inactive — the window ends at the
    // present, there's nothing after it (see _settleWindow)
    showRealTime()
    {
        for( let i = 0; i < 2; i++ ) {
            const _b = this._this?.querySelector(`#b2_${i}`);
            if( !_b ) continue;
            _b.disabled = !!this.state.autoScroll;
            _b.style.opacity = this.state.autoScroll ? '0.38' : '';
            _b.style.cursor = this.state.autoScroll ? 'default' : '';
        }
    }

    // Wires toolbar i's controls (the card has two toolbars, top and bottom; the info panel
    // one, with fewer controls — those it lacks are skipped)
    wireToolbar(i)
    {
        this._this.querySelector(`#b1_${i}`)?.addEventListener('click', () => this.stepDay(-1), false);
        this._this.querySelector(`#b2_${i}`)?.addEventListener('click', () => this.stepDay(1), false);
        this.showRealTime();
        this._this.querySelector(`#b4_${i}`)?.addEventListener('click', this.decZoom.bind(this), false);
        this._this.querySelector(`#b5_${i}`)?.addEventListener('click', this.incZoom.bind(this), false);
        // (the date: a click opens the calendar, a double-click goes back to real time — the
        // calendar only once a double-click can't follow any more: the long press' delay)
        this._this.querySelector(`#bx_${i}`)?.addEventListener('click', () => {
            clearTimeout(this._dateClickTimer);
            this._dateClickTimer = setTimeout(() => this.openCalendar(i), Chart.hecGestures('mouse').longPressMs);
        }, false);
        this._this.querySelector(`#bx_${i}`)?.addEventListener('dblclick', () => { clearTimeout(this._dateClickTimer); this.todayNoReset(); }, false);
        this._this.querySelector(`#by_${i}`)?.addEventListener('change', this.timeRangeSelected.bind(this));
        this._this.querySelector(`#bz_${i}`)?.addEventListener('click', this.toggleZoom.bind(this), false);
        // (a magnifier under the pointer shown twice as large — every pointer: a CSS hover rule
        // would follow the device's primary pointer only, a tablet's pen left out; a pen still
        // or gone out of range: back to its size, moving again: large again — Chart.hecUi.hover)
        for( const id of ['bz', 'b4', 'b5'] ) {
            const b = this._this.querySelector(`#${id}_${i}`);
            if( b ) Chart.hecUi.hover(b, () => b.classList.add('hec-big'), () => b.classList.remove('hec-big'));
        }
        // (the magnifier: a double-click — its two clicks toggling the zoom mode back as it was —
        // back to the default range)
        this._this.querySelector(`#bz_${i}`)?.addEventListener('dblclick', this.defaultRange.bind(this), false);
        // (the magnifier: a long press — or a right click, a pen's button — the menu of its
        // modes, ez_N: what the elastic box zooms)
        this.listenLongPress(this._this.querySelector(`#bz_${i}`), () => this.showZoomMenu(i));
        this.initZoomMenu(i);
        this._this.querySelector(`#bo_${i}`)?.addEventListener('click', this.menuClicked.bind(this), false);
        // A click on the toolbar beside its small buttons — none under it: the one picked
        // (Chart.hecUi.pick: the nearest, unless about halfway between two)
        this._this.querySelector(`#tb_${i}`)?.addEventListener('click', (e) => {
            if( ![`tb_${i}`, `dl_${i}`, `dr_${i}`].includes(e.target.id) ) return;
            const _buttons = [...this._this.querySelectorAll(`#dl_${i} button, #dr_${i} button`)].filter(b => b.offsetParent);
            const _k = Chart.hecUi.pick(e.clientX, e.clientY, _buttons, e.pointerType || 'mouse');
            if( _k >= 0 ) _buttons[_k].click();
        }, false);
        this.initOptionsMenu(i);

        this._this.querySelector(`#b7_${i}`)?.addEventListener('focusin', this.entitySelectorFocus.bind(this), true);
        this._this.querySelector(`#b7_${i}`)?.addEventListener('click', this.entitySelectorFocus.bind(this), true);
        this._this.querySelector(`#b7_${i}`)?.addEventListener('focusout', this.entitySelectorFocusOut.bind(this), true);
        this._this.querySelector(`#b7_${i}`)?.addEventListener('input', this.entitySelectorEntered.bind(this), true);
        this._this.querySelector(`#b7_${i}`)?.addEventListener('keydown', this.entitySelectorKeyDown.bind(this), true);
        // Pointer hover preview — mouse/pen only (touch has no hover event; it
        // stays on pointerdown/pointerup, see the dropdown entry's own handling).
        // Delegated on the dropdown container so it survives entries being
        // recreated on every re-filter, instead of re-attaching per entry.
        // (the entry a pointer is over previewed — once per entry —, on a sign that a pointer
        // is there: a move — a mouse's or a pen's hover, a finger dragged along the list —, or
        // a contact; never on an entry the list's scrolling brings under a pointer still or
        // gone. Choosing still happens on the entry's own click)
        const _list = this._this.querySelector(`#es_${i}`);
        let _previewed = null;
        const _preview = (e) => {
            const _a = e.target.closest('a[data-entity]');
            if( _a && _a !== _previewed ) { _previewed = _a; this.previewEntityTooltip(_a.dataset.entity, i); }
        };
        for( const t of ['pointerdown', 'pointermove'] ) _list?.addEventListener(t, _preview);
        for( const t of ['pointerleave', 'pointercancel'] ) _list?.addEventListener(t, () => { _previewed = null; });

        this.ui.dateSelector[i] = this._this.querySelector(`#bx_${i}`);
        this.ui.rangeSelector[i] = this._this.querySelector(`#by_${i}`);
        this.ui.zoomButton[i] = this._this.querySelector(`#bz_${i}`);
    }

    // A long press on a button (the pointer's long-press delay, as the graphs' gestures), or
    // the browser's context menu on it (a right click, a pen's button): onLong — the click
    // the press then ends in does nothing
    listenLongPress(el, onLong)
    {
        if( !el ) return;
        let _timer = null;
        const _cancel = () => { clearTimeout(_timer); _timer = null; };
        el.addEventListener('pointerdown', (e) => {
            if( e.button > 0 ) return;
            _cancel();
            el._longPressed = false;
            _timer = setTimeout(() => { _timer = null; el._longPressed = true; onLong(); }, Chart.hecGestures(e.pointerType || 'mouse').longPressMs);
        });
        for( const t of ['pointerup', 'pointercancel', 'pointerleave'] ) el.addEventListener(t, _cancel);
        el.addEventListener('click', (e) => { if( el._longPressed ) { el._longPressed = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
        el.addEventListener('contextmenu', (e) => { e.preventDefault(); _cancel(); onLong(); });
    }

    insertUIHtmlText(i)
    {
        // The entity field's prompt: "Loading…" until its list is built (see requestEntityCollection)
        const _in = this._this.querySelector(`#b7_${i}`);
        if( _in ) _in.placeholder = i18n(this.entityListReady() ? 'ui.label.type_to_search' : 'ui.label.loading');
        let by = this._this.querySelector(`#by_${i}`);
        if( by ) {
            TIME_RANGES.forEach((r, k) => { by.children[k].innerHTML = i18n('ui.ranges.' + r.label, r.n); });
        }
    }

    resize()
    {
        const w = this.cardWidth();

        if( Math.abs(this.lastWidth - w) > 2 ) {
            this.lastWidth = w;
            for( let g of this.graphs ) g.chart.resize(undefined, g.graphHeight);
            // (a card crossing NARROW_CARD_PX: its Y labels inside or beside the plot, its text sized)
            this.fitToCardWidth();
            // (a card crossing SMALL_CHART_PX, a window SMALL_SCREEN_PX: its curves' tooltip as there)
            const _tf = Object.values(this.tooltipFields()).join();
            if( this._tooltipFields !== _tf ) { this._tooltipFields = _tf; this.applyTooltipModes(); }
            // (the time labels' step: as the density and the plot's width allow — setStepSize)
            this.setStepSize(true);
        }

        this.resizeSelector();
    }
    // The width of el on one line, unwrapped
    _naturalWidth(el)
    {
        if( !el ) return 0;
        const pWS = el.style.whiteSpace, pW = el.style.width;
        el.style.whiteSpace = 'nowrap'; el.style.width = 'max-content';
        const nw = el.offsetWidth;
        el.style.whiteSpace = pWS; el.style.width = pW;
        return nw;
    }

    // The start date of toolbar i shown in format fmt
    _showStartDate(bxEl, i, fmt)
    {
        bxEl.innerHTML = `<a id="eh_${i}" href="#" style="display:block;text-decoration:none;color:inherit">${moment(this.startTime).format(fmt)}</a>`;
    }

    // The form of toolbar i's date (dl) and range (dr) for its width tbw: the first that fits
    // of the long date and the whole range, the short date and the whole range, the short date
    // and the short range — each shortened only when needed. Back to a longer form only once
    // it clearly fits (a hysteresis: no flicker at the edge). → the widths of the date and
    // the range in the form chosen, and in the shortest one
    _fitDateForm(i, tbw, dl, dr, bxEl, byEl)
    {
        const _mw = el => this._naturalWidth(el);
        // (measured long — the range's maxWidth 83px —, then short — 50px)
        if( bxEl && this.i18n._styleDateLong ) this._showStartDate(bxEl, i, this.i18n._styleDateLong);
        if( byEl ) byEl.style.maxWidth = '83px';
        const dlwLong = _mw(dl);
        const drwLong = _mw(dr);
        if( bxEl && this.i18n._styleDateShort ) this._showStartDate(bxEl, i, this.i18n._styleDateShort);
        if( byEl ) byEl.style.maxWidth = '50px';
        const dlwShort = _mw(dl);
        const drwShort = _mw(dr);

        const _forms = [{ need: dlwLong + drwLong, fmt: this.i18n._styleDateLong, range: '83px', dlw: dlwLong, drw: drwLong },
                        { need: dlwShort + drwLong, fmt: this.i18n._styleDateShort, range: '83px', dlw: dlwShort, drw: drwLong },
                        { need: dlwShort + drwShort, fmt: this.i18n._styleDateShort, range: '50px', dlw: dlwShort, drw: drwShort }];
        this._toolbarForm ??= [];
        const _prev = this._toolbarForm[i] ?? 0;
        let _k = _forms.findIndex((f, k) => f.need <= tbw - ( k < _prev ? 20 : 10 ));
        if( _k < 0 ) _k = _forms.length - 1;
        this._toolbarForm[i] = _k;
        const { fmt, dlw, drw, range } = _forms[_k];
        if( bxEl && fmt ) {
            this.ui.dateFormat = fmt;
            this._showStartDate(bxEl, i, fmt);
        }
        if( byEl ) byEl.style.maxWidth = range;
        return { dlwNow: dlw, drwNow: drw, dlwShort, drwShort };
    }


    resizeSelector()
    {
        const w = this.cardWidth();

        for( let i = 0; i < 2; ++i ) {
            const tb = this._this.querySelector(`#tb_${i}`);
            const dl = this._this.querySelector(`#dl_${i}`);
            const dr = this._this.querySelector(`#dr_${i}`);
            const input = this._this.querySelector(`#b7_${i}`);
            const sl = this._this.querySelector(`#sl_${i}`);

            const tbwNow = tb ? tb.clientWidth : w;
            const bxEl = this._this.querySelector(`#bx_${i}`);
            const byEl = this._this.querySelector(`#by_${i}`);
            const { dlwNow, drwNow, dlwShort, drwShort } = this._fitDateForm(i, tbwNow, dl, dr, bxEl, byEl);

            const totNow = dlwNow + drwNow || 1;
            const dlFrNow = Math.round(dlwNow / totNow * 100);
            const drFrNow = 100 - dlFrNow;

            // (a narrow card — even the compact date and range don't fit side by side: each on
            // a line of its own, centered, never wrapped — layout D below)
            const narrow = dlwShort + drwShort > tbwNow - 10;
            // (the range on a line of its own: its whole name)
            if( narrow && byEl ) byEl.style.maxWidth = '83px';
            for( const [el, side] of [[dl, 'start'], [dr, 'end']] ) if( el ) {
                el.style.justifySelf = narrow ? 'center' : side;
                el.style.whiteSpace = narrow ? 'nowrap' : '';
            }
            // (the entity selector's field: the layout chosen from the width 90 % of its list's
            // lines need — its placeholder's at least —; then as wide as the room there, up to
            // the width every line needs; the lines still too long shortened — fitEntityLines)
            const _lw = this.entityLineWidths();
            const _minW = input ? Math.max(this._placeholderWidth(input), _lw.most) : 0;
            const _maxW = Math.max(_minW, _lw.all);
            const _inputW = room => Math.max(0, Math.min(room, _maxW));
            // (the menu as wide as the field: its lines fitted to the field when it opens, and
            // as the field changes while it's open)
            const _setInputW = room => {
                input.style.boxSizing = 'border-box'; input.style.width = _inputW(room) + 'px';
                if( this._this.querySelector(`#es_${i}`)?.style.display === 'block' ) this.fitEntityLines(i, input.getBoundingClientRect().width);
            };

            // Layout C : no selector, just dl and dr
            if( !input || !sl ) {
                if( tb && (dl || dr) ) {
                    tb.style.gridTemplateColumns = narrow ? '1fr' : `${dlFrNow}fr ${drFrNow}fr`;
                    tb.style.gridTemplateAreas = narrow ? "'dl' 'dr'" : "'dl dr'";
                }
                continue;
            }

            // Ensure sl is visible and in layout B first so it has dimensions
            if( sl.style.display === 'none' ) {
                if( tb ) {
                    tb.style.gridTemplateColumns = `${dlFrNow}fr ${drFrNow}fr`;
                    tb.style.gridTemplateAreas = "'dl dr' 'sl sl'";
                }
                sl.style.display = 'flex';
                sl.style.alignItems = 'center';
                sl.style.justifyContent = 'center';
                input.style.width = _inputW((tb ? tb.clientWidth : w) - 80) + 'px';
            }

            // sl buttons
            const bo = this._this.querySelector(`#bo_${i}`);
            const bow = this._naturalWidth(bo);
            const slCSS = getComputedStyle(sl);
            const slPad = parseFloat(slCSS.paddingLeft||0)+parseFloat(slCSS.paddingRight||0);
            const slBtnsW = bow + slPad;

            // Get actual margins of dl and dr
            const dlMargin = dl ? (parseFloat(getComputedStyle(dl).marginLeft||0)+parseFloat(getComputedStyle(dl).marginRight||0)) : 0;
            const drMargin = dr ? (parseFloat(getComputedStyle(dr).marginLeft||0)+parseFloat(getComputedStyle(dr).marginRight||0)) : 0;
            // unexplained = gaps between flex children in sl (gap:normal resolves to ~5px in HA)
            // Measure it: sl natural width - sum of children - padding
            const CORRECTION = 23; // inputExtra(~8) + flex gap(~5) + safety margin(10)

            // (the room between the date and the range, the toolbar's middle column centered)
            const roomA = tbwNow - 2*(Math.max(dlwNow, drwNow) + Math.max(dlMargin, drMargin)) - slBtnsW - CORRECTION;

            if( roomA >= _minW ) {
                // Layout A : dl | sl | dr on one line
                if( tb ) {
                    tb.style.gridTemplateColumns = '1fr auto 1fr';
                    tb.style.gridTemplateAreas = "'dl sl dr'";
                }
                sl.style.display = 'flex';
                sl.style.alignItems = 'center';
                sl.style.justifyContent = 'center';
                _setInputW(roomA);
            } else if( !narrow ) {
                // Layout B : dl | dr on line 1, sl centered on line 2
                if( tb ) {
                    tb.style.gridTemplateColumns = `${dlFrNow}fr ${drFrNow}fr`;
                    tb.style.gridTemplateAreas = "'dl dr' 'sl sl'";
                }
                _setInputW((tb ? tb.clientWidth : w) - slBtnsW - CORRECTION);
            } else {
                // Layout D (a narrow card) : dl, dr and sl each on a line, the input as wide
                // as the card leaves beside the options button
                if( tb ) {
                    tb.style.gridTemplateColumns = '1fr';
                    tb.style.gridTemplateAreas = "'dl' 'dr' 'sl'";
                }
                _setInputW((tb ? tb.clientWidth : w) - slBtnsW - 16);
            }
        }
    }

    // The width the entity selector's field needs to be read (px): its placeholder's text,
    // in its own font, with its padding and border
    _placeholderWidth(input)
    {
        const cs = getComputedStyle(input);
        const s = document.createElement('span');
        s.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font};letter-spacing:${cs.letterSpacing}`;
        s.textContent = input.placeholder || '';
        input.parentNode.appendChild(s);
        const _text = s.getBoundingClientRect().width;
        s.remove();
        const _box = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce((a, k) => a + ( parseFloat(cs[k]) || 0 ), 0);
        return Math.ceil(_text + _box);
    }

    // --------------------------------------------------------------------------------------
    // Toolbar menu entries
    // --------------------------------------------------------------------------------------

    // The history of graphs' entities exported (every graph's by default)
    exportFile(graphs = this.graphs)
    {
        this.menuSetVisibility(0, false);
        this.menuSetVisibility(1, false);

        this.csvExporter.exportFile(this, graphs);
    }

    // The statistics of graphs' entities (every graph's by default) exported for period
    // (STATS_EXPORT_PERIODS — the menu's by default), the period kept as the menu's
    // (setExportStatsPeriod)
    exportStatistics(period = this.exportStatsPeriod(), graphs = this.graphs)
    {
        this.menuSetVisibility(0, false);
        this.menuSetVisibility(1, false);

        this.setExportStatsPeriod(period);
        this.statsExporter.exportFile(this, graphs, period);
    }

    // The statistics export menu's period: the one chosen there, else the YAML's
    // (csv.statisticsPeriod)
    exportStatsPeriod()
    {
        return this.state.exportStatsPeriod ?? this.pconfig.exportStatsPeriod;
    }


    // --------------------------------------------------------------------------------------
    // Display interval for accumulating bar graphs
    // --------------------------------------------------------------------------------------

    selectBarInterval(event)
    {
        const id = event.target.id.substr(event.target.id.indexOf("-") + 1);
        const g = this.graphs.find(gr => gr.id == id);
        if( g ) this.setBarInterval(g, parseInt(event.target.value));
    }

    // The browser's calendar, under toolbar i's date: the day chosen starts the window shown
    // (showDay), as the date reads; the first day shown preselected, no later than today
    openCalendar(i)
    {
        const _bx = this._this.querySelector(`#bx_${i}`);
        if( !_bx ) return;
        this.openNativePicker(_bx.parentNode, 'date', _bx.offsetLeft, _bx.offsetTop + _bx.offsetHeight,
                              moment(this.startTime).format('YYYY-MM-DD'), v => this.showDay(v), { max: moment().format('YYYY-MM-DD') });
    }

    // The browser's own picker of an input of type (date, color), at (left, top) in parent —
    // an invisible input there, one per type, kept —, value preselected (attrs: more of the
    // input's attributes, as max); onPick(value) once one is chosen
    openNativePicker(parent, type, left, top, value, onPick, attrs = {})
    {
        parent._pickers ??= {};
        let _in = parent._pickers[type];
        if( !_in?.isConnected ) {
            _in = parent._pickers[type] = document.createElement('input');
            _in.type = type;
            _in.tabIndex = -1;
            _in.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;padding:0';
            _in.addEventListener('change', () => _in._onPick?.(_in.value));
            if( getComputedStyle(parent).position === 'static' ) parent.style.position = 'relative';
            parent.appendChild(_in);
        }
        _in.style.left = left + 'px';
        _in.style.top = top + 'px';
        Object.assign(_in, attrs);
        _in.value = value;
        _in._onPick = onPick;
        // (opened once laid out at its place: a field just added has none yet — Chrome then
        // opens its picker at the page's top left)
        requestAnimationFrame(() => { try { _in.showPicker(); } catch( e ) { _in.focus(); _in.click(); } });
    }

    // The toolbar's date: the time window's start, as long as its room allows (resizeSelector)
    showDate()
    {
        for( const i of this.ui.dateSelector )
            if( i ) i.innerHTML = moment(this.startTime).format(this.ui.dateFormat ?? this.i18n._styleDateLong);
    }

    // The width of a bar graph's interval selector (px)
    intervalSelectorWidth()
    {
        return this.ui.wideInterval ? 100 : 80;
    }

    // A bar graph's interval selector — placed by its chart, in its top row (Chart.js
    // hecTopControl)
    createIntervalSelectorHtml(gid, selected, optionStyle)
    {
        return `<select id='bd-${gid}' style="position:absolute;left:0;top:0;width:${this.intervalSelectorWidth()}px;color:var(--primary-text-color);background-color:${this.pconfig.closeButtonColor};border:0px solid black;">
                    ${BAR_INTERVALS.map(i => `<option value="${i.code}" ${optionStyle} ${selected == i.code ? 'selected' : ''}>${i18n('ui.interval.' + i.label)}</option>`).join('')}
                </select>`;
    }

}
