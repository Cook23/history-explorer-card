// The card's HTML: its toolbar and menus' entries, the entity selector (with wildcards), the
// interval selector of bar graphs, and their layout as the card resizes. Part of
// HistoryCardState (added to it in history-explorer-card.js).

import { i18n } from "./languages.js";
import { BAR_INTERVALS } from "./history-options.js";
import { typeMenuHtml, optionsMenuHtml } from "./card-menus.js";
const moment = window.HXLocal_moment;
const Chart = window.HXLocal_Chart;

export class CardToolbar
{
    // --------------------------------------------------------------------------------------
    // HTML generation
    // --------------------------------------------------------------------------------------

    // TOOLBAR LAYOUT — CSS Grid, layouts A/B/C/D
    // !! Keep in sync with _hxRender() in history-info-panel.js !!
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
            html = `<div style="position:sticky;${threshold};padding-top:${this.ui.hideHeader ? 0 : 15}px;padding-bottom:10px;margin-top:-${this.ui.hideHeader ? 0 : 15}px;z-index:1;background-color:var(--card-background-color);line-height:0px;">`;
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
            <div id="dl_${i}" style="background-color:${bgcol};padding-left:5px;padding-right:5px;grid-area:dl;justify-self:start;">
                <button id="b1_${i}" style="margin:0px;border:0px solid black;color:inherit;background-color:#00000000;height:30px"><</button>
                <button id="bx_${i}" style="margin:0px;border:0px solid black;color:inherit;background-color:#00000000;height:30px">-</button>
                <button id="b2_${i}" style="margin:0px;border:0px solid black;color:inherit;background-color:#00000000;height:30px">></button>
            </div>`;

        if( selector ) html += `
            <div id='sl_${i}' style="display:none;padding-left:10px;padding-right:10px;text-align:center;grid-area:sl;justify-self:center;min-width:0;overflow:hidden;">
                <input id="b7_${i}" ${inputStyle} autoComplete="off"/>
                <div id="es_${i}" style="display:none;position:absolute;box-sizing:border-box;text-align:left;max-height:50vh;overflow:auto;border:1px solid #444;z-index:1;color:var(--primary-text-color);background-color:var(--card-background-color)"></div>
                <div id="es_${i}_series" tabindex="0" style="display:none;position:absolute;text-align:left;min-width:180px;max-height:50vh;overflow:auto;border:1px solid #444;box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2);z-index:2;color:var(--primary-text-color);background-color:var(--card-background-color);outline:none"></div>
                <div id="es_${i}_choice" tabindex="0" style="display:none;position:absolute;text-align:left;min-width:180px;max-height:50vh;overflow:auto;border:1px solid #444;box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2);z-index:2;color:var(--primary-text-color);background-color:var(--card-background-color);outline:none"></div>
                ${typeMenuHtml(i, true)}
                <button id="bo_${i}" style="border:0px solid black;color:inherit;background-color:#00000000;height:30px;margin-left:1px;margin-right:0px;"><svg width="18" height="18" viewBox="0 0 24 24" style="vertical-align:middle;"><path fill="var(--primary-text-color)" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" /></svg></button>
                ${optionsMenuHtml(i, this.statistics.enabled)}
            </div>`;

        if( tools ) html += `
            <div id="dr_${i}" style="background-color:${bgcol};padding-left:5px;padding-right:5px;grid-area:dr;justify-self:end;">
                <button id="bz_${i}" style="margin:0px;border:0px solid black;color:inherit;background-color:#00000000"><svg width="24" height="24" viewBox="0 0 24 24" style="vertical-align:middle;"><path fill="var(--primary-text-color)" d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z" /></svg></button>
                <button id="b${invertZoom ? 5 : 4}_${i}" style="margin:0px;border:0px solid black;color:inherit;background-color:#00000000;height:30px">-</button>
                <select id="by_${i}" style="margin:0px;border:0px solid black;color:inherit;background-color:#00000000;height:30px;max-width:83px;text-align:center;text-align-last:center">
                    <option value="0" ${optionStyle} hidden></option>
                    <option value="1" ${optionStyle}></option>
                    <option value="2" ${optionStyle}></option>
                    <option value="3" ${optionStyle} hidden></option>
                    <option value="4" ${optionStyle} hidden></option>
                    <option value="5" ${optionStyle} hidden></option>
                    <option value="6" ${optionStyle}></option>
                    <option value="7" ${optionStyle} hidden></option>
                    <option value="8" ${optionStyle} hidden></option>
                    <option value="9" ${optionStyle} hidden></option>
                    <option value="10" ${optionStyle} hidden></option>
                    <option value="11" ${optionStyle} hidden></option>
                    <option value="12" ${optionStyle}></option>
                    <option value="24" ${optionStyle}></option>
                    <option value="48" ${optionStyle}></option>
                    <option value="72" ${optionStyle}></option>
                    <option value="96" ${optionStyle} hidden></option>
                    <option value="120" ${optionStyle} hidden></option>
                    <option value="144" ${optionStyle} hidden></option>
                    <option value="168" ${optionStyle}></option>
                    <option value="336" ${optionStyle}></option>
                    <option value="504" ${optionStyle}></option>
                    <option value="720" ${optionStyle}></option>
                    <option value="2184" ${optionStyle}></option>
                    <option value="4368" ${optionStyle}></option>
                    <option value="8760" ${optionStyle}></option>
                </select>
                <button id="b${invertZoom ? 4 : 5}_${i}" style="margin:0px;border:0px solid black;color:inherit;background-color:#00000000;height:30px">+</button>
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
        this._this.querySelector(`#b1_${i}`)?.addEventListener('click', this.subDay.bind(this), false);
        this._this.querySelector(`#b2_${i}`)?.addEventListener('click', this.addDay.bind(this), false);
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
        // (the magnifier: a double-click — its two clicks toggling the zoom mode back as it was —
        // back to the default range)
        this._this.querySelector(`#bz_${i}`)?.addEventListener('dblclick', this.defaultRange.bind(this), false);
        this._this.querySelector(`#ef_${i}`)?.addEventListener('click', this.exportFile.bind(this), false);
        this._this.querySelector(`#eh_${i}`)?.addEventListener('click', this.exportStatistics.bind(this), false);
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
        this._this.querySelector(`#es_${i}`)?.addEventListener('pointerover', (e) => {
            if( e.pointerType === 'touch' ) return;
            const _a = e.target.closest('a[data-entity]');
            if( _a ) this.previewEntityTooltip(_a.dataset.entity, i);
        });
        // Touch has no hover event at all — preview on pointerdown/pointermove
        // instead, while the finger can still be dragged to a different entry
        // before lifting. Actual selection still only happens on the entry's own
        // click handler (pointerup), unchanged.
        const _touchPreview = (e) => {
            if( e.pointerType !== 'touch' ) return;
            const _a = e.target.closest('a[data-entity]');
            if( _a ) this.previewEntityTooltip(_a.dataset.entity, i);
        };
        this._this.querySelector(`#es_${i}`)?.addEventListener('pointerdown', _touchPreview);
        this._this.querySelector(`#es_${i}`)?.addEventListener('pointermove', _touchPreview);

        this.ui.dateSelector[i] = this._this.querySelector(`#bx_${i}`);
        this.ui.rangeSelector[i] = this._this.querySelector(`#by_${i}`);
        this.ui.zoomButton[i] = this._this.querySelector(`#bz_${i}`);
    }

    insertUIHtmlText(i)
    {
        // The entity field's prompt: "Loading…" until its list is built (see requestEntityCollection)
        const _in = this._this.querySelector(`#b7_${i}`);
        if( _in ) _in.placeholder = i18n(this.entityListReady() ? 'ui.label.type_to_search' : 'ui.label.loading');
        // The menus' labels — updated here so language is already set
        this.relabelTypeMenu(i);
        this.relabelOptionsMenu(i);
        let by = this._this.querySelector(`#by_${i}`);
        if( by ) {
            by.children[0].innerHTML = i18n('ui.ranges.l_hour');
            by.children[1].innerHTML = i18n('ui.ranges.hour');
            by.children[2].innerHTML = i18n('ui.ranges.n_hours', 2);
            by.children[3].innerHTML = i18n('ui.ranges.n_hours', 3);
            by.children[4].innerHTML = i18n('ui.ranges.n_hours', 4);
            by.children[5].innerHTML = i18n('ui.ranges.n_hours', 5);
            by.children[6].innerHTML = i18n('ui.ranges.n_hours', 6);
            by.children[7].innerHTML = i18n('ui.ranges.n_hours', 7);
            by.children[8].innerHTML = i18n('ui.ranges.n_hours', 8);
            by.children[9].innerHTML = i18n('ui.ranges.n_hours', 9);
            by.children[10].innerHTML = i18n('ui.ranges.n_hours', 10);
            by.children[11].innerHTML = i18n('ui.ranges.n_hours', 11);
            by.children[12].innerHTML = i18n('ui.ranges.n_hours', 12);
            by.children[13].innerHTML = i18n('ui.ranges.day');
            by.children[14].innerHTML = i18n('ui.ranges.n_days', 2);
            by.children[15].innerHTML = i18n('ui.ranges.n_days', 3);
            by.children[16].innerHTML = i18n('ui.ranges.n_days', 4);
            by.children[17].innerHTML = i18n('ui.ranges.n_days', 5);
            by.children[18].innerHTML = i18n('ui.ranges.n_days', 6);
            by.children[19].innerHTML = i18n('ui.ranges.week');
            by.children[20].innerHTML = i18n('ui.ranges.n_weeks', 2);
            by.children[21].innerHTML = i18n('ui.ranges.n_weeks', 3);
            by.children[22].innerHTML = i18n('ui.ranges.month');
            by.children[23].innerHTML = i18n('ui.ranges.n_months', 3);
            by.children[24].innerHTML = i18n('ui.ranges.n_months', 6);
            by.children[25].innerHTML = i18n('ui.ranges.year');
        }
    }

    resize()
    {
        const w = this._this.querySelector('#maincard').clientWidth;

        if( Math.abs(this.lastWidth - w) > 2 ) {
            const tickChanged = this.computeTickDensity(w) != this.computeTickDensity(this.lastWidth);
            this.lastWidth = w;
            for( let g of this.graphs ) g.chart.resize(undefined, g.graphHeight);
            // (a card crossing NARROW_CARD_PX: its Y labels inside or beside the plot, its text sized)
            this.fitToCardWidth();
            const _tbEl = this._this.querySelector('#tb_0');
            if( tickChanged ) this.setStepSize(true, _tbEl?.clientWidth || w);
        }

        this.resizeSelector();
    }

    resizeSelector()
    {
        const w = this._this.querySelector('#maincard').clientWidth;

        for( let i = 0; i < 2; ++i ) {
            const tb = this._this.querySelector(`#tb_${i}`);
            const dl = this._this.querySelector(`#dl_${i}`);
            const dr = this._this.querySelector(`#dr_${i}`);
            const input = this._this.querySelector(`#b7_${i}`);
            const sl = this._this.querySelector(`#sl_${i}`);

            // Common: measure tbw and apply date format before any layout decision
            const tbwNow = tb ? tb.clientWidth : w;
            const _mw = (el) => {
                if( !el ) return 0;
                const pWS = el.style.whiteSpace, pW = el.style.width;
                el.style.whiteSpace = 'nowrap'; el.style.width = 'max-content';
                const nw = el.offsetWidth;
                el.style.whiteSpace = pWS; el.style.width = pW;
                return nw;
            };

            // Measure dl (LONG) and dr (NORMAL: maxWidth=83px)
            const bxEl = this._this.querySelector(`#bx_${i}`);
            const byEl = this._this.querySelector(`#by_${i}`);
            if( bxEl && this.i18n._styleDateLong )
                bxEl.innerHTML = `<a id="eh_${i}" href="#" style="display:block;text-decoration:none;color:inherit">${moment(this.startTime).format(this.i18n._styleDateLong)}</a>`;
            if( byEl ) byEl.style.maxWidth = '83px';
            const dlwLong = _mw(dl);
            const drwLong = _mw(dr);

            // Measure dl (SHORT) and dr (COMPACT: maxWidth=50px)
            if( bxEl && this.i18n._styleDateShort )
                bxEl.innerHTML = `<a id="eh_${i}" href="#" style="display:block;text-decoration:none;color:inherit">${moment(this.startTime).format(this.i18n._styleDateShort)}</a>`;
            if( byEl ) byEl.style.maxWidth = '50px';
            const dlwShort = _mw(dl);
            const drwShort = _mw(dr);

            // Decide format with hysteresis
            if( !this._isCompact ) this._isCompact = [];
            const _prevCompact = this._isCompact[i] || false;
            let isCompact;
            if( dlwLong + drwLong > tbwNow - 10 ) {
                isCompact = true;   // NORMAL doesn't fit → go COMPACT
            } else if( dlwLong + drwLong < tbwNow - 20 ) {
                isCompact = false;  // clearly fits → go NORMAL
            } else {
                isCompact = _prevCompact; // hysteresis zone → keep previous state
            }
            this._isCompact[i] = isCompact;

            const dlwNow = isCompact ? dlwShort : dlwLong;
            const drwNow = isCompact ? drwShort : drwLong;

            // Apply chosen format and range width
            const fmt = isCompact ? this.i18n._styleDateShort : this.i18n._styleDateLong;
            if( bxEl && fmt ) {
                this.ui.dateFormat = fmt;
                bxEl.innerHTML = `<a id="eh_${i}" href="#" style="display:block;text-decoration:none;color:inherit">${moment(this.startTime).format(fmt)}</a>`;
            }
            if( byEl ) byEl.style.maxWidth = isCompact ? '50px' : '83px';


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
                sl.style.display = 'flex';
                sl.style.alignItems = 'center';
                sl.style.justifyContent = 'center';
            }

            // dl and dr already measured above as dlwNow/drwNow
            const dlw = dlwNow;
            const drw = drwNow;

            // sl buttons
            const bo = this._this.querySelector(`#bo_${i}`);
            const bow=_mw(bo);
            const slCSS = getComputedStyle(sl);
            const slPad = parseFloat(slCSS.paddingLeft||0)+parseFloat(slCSS.paddingRight||0);
            const slBtnsW = bow + slPad;

            // Compute input width for layout A and check if total fits
            const tbw = tbwNow;
            // Get actual margins of dl and dr
            const dlMargin = dl ? (parseFloat(getComputedStyle(dl).marginLeft||0)+parseFloat(getComputedStyle(dl).marginRight||0)) : 0;
            const drMargin = dr ? (parseFloat(getComputedStyle(dr).marginLeft||0)+parseFloat(getComputedStyle(dr).marginRight||0)) : 0;
            // unexplained = gaps between flex children in sl (gap:normal resolves to ~5px in HA)
            // Measure it: sl natural width - sum of children - padding
            const CORRECTION = 23; // inputExtra(~8) + flex gap(~5) + safety margin(10)

            // (the room between the date and the range, the toolbar's middle column centered)
            const roomA = tbw - 2*(Math.max(dlw, drw) + Math.max(dlMargin, drMargin)) - slBtnsW - CORRECTION;

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

    exportFile()
    {
        this.menuSetVisibility(0, false);
        this.menuSetVisibility(1, false);

        this.csvExporter.exportFile(this);
    }

    exportStatistics()
    {
        this.menuSetVisibility(0, false);
        this.menuSetVisibility(1, false);

        this.statsExporter.exportFile(this);
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
        try { _in.showPicker(); } catch( e ) { _in.focus(); _in.click(); }
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
