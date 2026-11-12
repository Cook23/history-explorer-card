// Tests (beta): diagnostics opened from the card's menu's Tests ▸ submenu. Each one runs in
// the card's own context — the browser, or the Home Assistant app's web view, the card
// is shown in, with the user's own entities — so that a user can report what that system
// really gives the card: a dialog over the page, its report copied, or sent as a GitHub
// issue.

import { Version } from "./version.js";
import { PROBE_INFO } from "./card-history.js";
import { REDRAW_CAUSES } from "./card-perf.js";
const Chart = window.HXLocal_Chart;

const ISSUE_URL = 'https://github.com/Cook23/history-explorer-card/issues/new';
// (a longer link may be refused: the whole report is in the copied one)
const ISSUE_BODY_MAX = 6000;

// The tests, in the submenu's order: its entry (i18n key), its dialog's title, and
// build(body, card), which fills the dialog's body and returns { report(), dispose() }

// text copied to the clipboard, hint (an element) saying so — the clipboard refused (outside
// a secure context): copied through a selection, in a text box in hint's place
function copyText(text, hint)
{
    const done = () => { hint.textContent = 'Copied.'; };
    const byHand = () => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.className = 'mono';
        ta.rows = 8;
        hint.replaceWith(ta);
        ta.select();
        if( !document.execCommand?.('copy') ) ta.insertAdjacentHTML('afterend', '<span class="hint">Copy it by hand.</span>');
    };
    if( navigator.clipboard?.writeText ) navigator.clipboard.writeText(text).then(done, byHand);
    else byHand();
}
export const CARD_TESTS = {
    pen: { label: 'ui.menu.test_pen', title: 'Pen events', build: buildPenEventsTest },
    perf: { label: 'ui.menu.test_perf', title: 'Performance', build: buildPerformanceTest },
};

// ──────────────────────────────────────────────────────────────────────────────────────
// The dialog every test opens in: over the whole page, in its own shadow root (the
// page's styles don't reach it), in the Home Assistant theme's colors
// ──────────────────────────────────────────────────────────────────────────────────────

const DIALOG_CSS = `
.dlg { position: absolute; inset: 0; overflow: auto; overscroll-behavior: contain; outline: none;
  background: var(--primary-background-color, #f4f6f8); color: var(--primary-text-color, #1b2530);
  font-family: var(--ha-font-family-body, var(--primary-font-family, system-ui, sans-serif)); font-size: 15px; }
header { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: 12px; padding: 10px 16px;
  background: var(--app-header-background-color, var(--primary-color, #03a9f4)); color: var(--app-header-text-color, #fff); }
h1 { flex: 1; margin: 0; font-size: 1.15rem; font-weight: 600; }
header button { color: inherit; border-color: currentColor; }
.body { max-width: 760px; margin: 0 auto; padding: 16px; display: grid; gap: 14px; }
.lead { margin: 0; color: var(--secondary-text-color, #5d6b79); line-height: 1.5; }
.box { background: var(--card-background-color, #fff); border: 1px solid var(--divider-color, #d5dde5); border-radius: 8px;
  padding: 12px 14px; display: grid; gap: 8px; min-width: 0; }
h2 { margin: 0; font-size: .78rem; text-transform: uppercase; letter-spacing: .06em; color: var(--secondary-text-color, #5d6b79); }
.row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
button, a.btn { font: inherit; font-size: .9rem; padding: 6px 14px; border-radius: 6px; cursor: pointer; text-decoration: none;
  border: 1px solid var(--primary-color, #03a9f4); background: transparent; color: var(--primary-color, #03a9f4); }
.hint { font-size: .82rem; color: var(--secondary-text-color, #5d6b79); }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .76rem; font-variant-numeric: tabular-nums; }
`;

export function openCardTest(key, card)
{
    const def = CARD_TESTS[key];
    if( !def ) return;
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:10000';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${DIALOG_CSS}</style>
        <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="title" tabindex="-1">
            <header><h1 id="title"></h1><button id="close" type="button" aria-label="Close">✕</button></header>
            <div class="body"></div>
            <div class="body">
                <section class="box">
                    <h2>Report</h2>
                    <div class="row">
                        <button id="copy" type="button">Copy the report</button>
                        <a id="issue" class="btn" href="${ISSUE_URL}" target="_blank" rel="noopener">Report on GitHub</a>
                    </div>
                    <span class="hint" id="reportHint">The report gives the card's version, the browser (or app) and what it reported. On GitHub, say which device, system and browser or app you used.</span>
                </section>
            </div>
        </div>`;
    const $ = id => root.getElementById(id);
    $('title').textContent = def.title;
    const test = def.build(root.querySelector('.body'), card);
    const report = () => `${def.title} — history-explorer-card ${Version}\n${navigator.userAgent}\n\n${test.report()}`;

    $('copy').addEventListener('click', () => copyText(report(), $('reportHint')));
    $('issue').addEventListener('click', () => {
        let body = report();
        if( body.length > ISSUE_BODY_MAX ) body = body.slice(0, ISSUE_BODY_MAX) + '\n… (cut: paste the copied report for the whole log)';
        $('issue').href = `${ISSUE_URL}?title=${encodeURIComponent(`[Test] ${def.title}`)}&body=${encodeURIComponent('```\n' + body + '\n```\n\nDevice, system, browser or app: ')}`;
    });

    const onKey = (e) => { if( e.key === 'Escape' ) close(); };
    const close = () => {
        document.removeEventListener('keydown', onKey);
        test.dispose();
        host.remove();
    };
    $('close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(host);
    root.querySelector('.dlg').focus();
}

// ──────────────────────────────────────────────────────────────────────────────────────
// Pen events: what the browser reports of a pen — its type, hover, its button, a long
// press — on a zone that scrolls vertically like a graph and on one that doesn't
// ──────────────────────────────────────────────────────────────────────────────────────

const PEN_CSS = `
ul.checks { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
ul.checks li { display: flex; gap: 10px; align-items: baseline; }
.pill { padding: 1px 8px; border-radius: 99px; border: 1px solid var(--divider-color, #d5dde5);
  color: var(--secondary-text-color, #5d6b79); min-width: 3.2em; text-align: center; flex: none; }
.pill.yes { color: var(--success-color, #1d7a46); border-color: currentColor; }
.pill.warn { color: var(--error-color, #a33a2c); border-color: currentColor; }
.pads { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 520px) { .pads { grid-template-columns: 1fr; } }
.pad { background: var(--secondary-background-color, #e8eef4); border: 1px dashed var(--divider-color, #d5dde5); border-radius: 8px;
  height: 180px; display: grid; place-items: center; text-align: center; padding: 10px; font-size: .9rem;
  color: var(--secondary-text-color, #5d6b79); user-select: none; -webkit-user-select: none; }
.pad b { color: var(--primary-text-color, #1b2530); display: block; margin-bottom: 4px; }
#padScroll { touch-action: pan-y; }
#padFree { touch-action: none; }
.now { overflow-x: auto; white-space: nowrap; }
.log { max-height: 260px; overflow: auto; margin: 0; white-space: pre; line-height: 1.45; }
`;

const PEN_CHECKS = [
    ['penType',     'pointerType "pen" seen'],
    ['touchType',   'pointerType "touch" seen while using the pen (the pen reported as a finger)'],
    ['mouseType',   'pointerType "mouse" seen'],
    ['hover',       'pen hover: moves with no contact (buttons 0)'],
    ['hoverAny',    'hover reported as another type (moves with no contact, not "pen")'],
    ['barrelDown',  'pen button held at contact (buttons has 2)'],
    ['barrelChord', 'pen button pressed while the tip is down (buttons 1 → 3)'],
    ['eraser',      'eraser (buttons has 32)'],
    ['cancel',      'pointercancel: the browser took the gesture (scrolling)'],
    ['tapCancel',   'a contact cancelled with nothing scrolled and within 10px (a tap the browser took over)'],
    ['ctx',         'contextmenu event'],
    ['mouseBtn2',   'mousedown / mouseup / auxclick with the secondary button (button 2)'],
    ['keys',        'key event (keydown / keyup) — some pens send their button as a key'],
    ['select',      'text selection started (selectstart / selectionchange)'],
    ['leave',       'pointerleave / pointerout with no contact (pen moved away)'],
    ['mouseHover',  'mousemove with no button (a hover sent as mouse events)'],
    ['mozPen',      'Firefox: mozInputSource 2 (a pen) on an event'],
    ['touchCaps',   'sourceCapabilities.firesTouchEvents true on a hover move (no contact)'],
    ['leaveNull',   'pointerleave / pointerout with no contact and no element entered (relatedTarget null: the pen gone from the screen)'],
];
const PEN_PAD_EVENTS = ['pointerover', 'pointerenter', 'pointerdown', 'pointermove', 'pointerrawupdate', 'pointerup', 'pointercancel', 'pointerout', 'pointerleave',
                        'gotpointercapture', 'lostpointercapture',
                        'mouseover', 'mouseenter', 'mousemove', 'mousedown', 'mouseup', 'mouseout', 'mouseleave', 'click', 'auxclick', 'dblclick', 'contextmenu',
                        'touchstart', 'touchmove', 'touchend', 'touchcancel'];
const PEN_PAGE_EVENTS = ['keydown', 'keyup', 'selectstart'];
const PEN_LOG_MAX = 300;
const PEN_MOVE_LOG_MS = 120;   // (moves logged at most this often, so that the log stays readable)
const PEN_TAP_SLOP = 10;       // px: within this, a contact is a tap (the card's drag threshold)
const PEN_SCROLL_CHECK_MS = 250;   // after a cancel: has anything scrolled by then?
// The trials, each with its "Mark" button
const PEN_MARKS = [
    ['taps', 'taps with the tip'], ['swipes', 'short swipes up'], ['long', 'long press with the tip'],
    ['btnTap', 'taps with the pen\'s button held'], ['btnAlone', 'the pen\'s button alone, tip down'], ['hover', 'hovering'],
];

function buildPenEventsTest(body)
{
    body.insertAdjacentHTML('beforeend', `<style>${PEN_CSS}</style>
        <p class="lead">Use the pen on the two zones below, one trial at a time: before each, tap its "Mark" button so that the log shows where it starts. Each contact's release gives how far the tip went (d: from its start to its end, max: the farthest) and how long it lasted; a contact the browser takes over says whether anything really scrolled; a context menu says how long after, and how far from, the last contact on its zone. The checklist fills in with what this browser or app really reports.</p>
        <section class="box"><h2>What this browser reports</h2><ul class="checks" id="checks"></ul></section>
        <div class="pads">
            <div class="pad" id="padScroll"><div><b>Like a graph</b>a vertical swipe may scroll</div></div>
            <div class="pad" id="padFree"><div><b>No scrolling</b>every gesture reaches the card</div></div>
        </div>
        <section class="box"><h2>Device</h2><pre class="log mono" id="device"></pre></section>
        <section class="box"><h2>Hover: time between two moves</h2>
            <p>Hold the pen still above a zone, then move it away: a pen hovers only while it sends moves (the card ends its hover after ${Chart.hecUi.PEN_HOVER_TIMEOUT / 1000} s without one). Every move with no contact counts, whatever type it's reported as, each kind of event apart.</p>
            <div class="now mono" id="gaps" style="white-space:pre-line">— no hover yet —</div>
            <div class="row">
                <button id="copyStats" type="button">Copy the stats</button>
                <button id="restart" type="button">Clear all, start again</button>
            </div>
            <span class="hint" id="statsHint"></span></section>
        <section class="box"><h2>Last event</h2><div class="now mono" id="now">— nothing yet —</div></section>
        <section class="box">
            <h2>Event log (newest first)</h2>
            <pre class="log mono" id="log"></pre>
            <div class="row">
                ${PEN_MARKS.map(([k, l]) => `<button id="mark_${k}" type="button">Mark: ${l}</button>`).join('')}
                <button id="clear" type="button">Clear</button>
            </div>
        </section>`);
    const $ = id => body.querySelector(`#${id}`);
    const seen = {};
    const lines = [];
    const lastBtns = {};
    let t0 = performance.now();
    const lastMoveLog = {}; let contact = false, lastSel = 0;
    // The contacts under way (by pointerId), and each zone's last one, ended
    const contacts = {}, lastContact = {};
    const scroller = body.closest('.dlg');
    const scrollPos = () => ( scroller ? scroller.scrollTop : 0 ) + window.scrollY;
    const dist = (a, x, y) => Math.round(Math.hypot(x - a.x, y - a.y));
    // The time between two hover moves (on the same zone, no contact, no leaving between
    // them), for each kind of event apart — pointermove, pointerrawupdate, mousemove: those
    // shorter than the card's timeout, and how many reached it
    const GAP_TYPES = ['pointermove', 'pointerrawupdate', 'mousemove'];
    const gapsOf = {};
    const gapsReset = () => { for( const k of GAP_TYPES ) gapsOf[k] = { gaps: [], long: 0, last: null }; };
    gapsReset();
    // (count, mean and standard deviation of values)
    const gapStats = v => { const n = v.length, m = v.reduce((a, g) => a + g, 0) / n;
        return { n, mean: m, sd: Math.sqrt(v.reduce((a, g) => a + (g - m) ** 2, 0) / n) }; };
    // Two regimes in gaps (the pen moving, the pen nearly still), when they look like two
    // gaussians: the split of the sorted gaps leaving the least spread within each side; kept
    // when each side holds 5 % of them at least and they stand apart — Ashman's D, the gap
    // between their means against their spreads, above 4 (one gaussian split at its mean
    // already gives 2.65, a skewed single regime more). Else null: one regime
    const gapRegimes = gaps => {
        const v = [...gaps].sort((a, b) => a - b), n = v.length;
        if( n < 20 ) return null;
        let best = null, sum = 0, sq = 0;
        const tot = v.reduce((a, g) => a + g, 0), totSq = v.reduce((a, g) => a + g * g, 0);
        for( let i = 1; i < n; i++ ) {
            sum += v[i - 1]; sq += v[i - 1] ** 2;
            const _within = (sq - sum * sum / i) + ((totSq - sq) - (tot - sum) ** 2 / (n - i));
            if( !best || _within < best.w ) best = { w: _within, i };
        }
        const lo = gapStats(v.slice(0, best.i)), hi = gapStats(v.slice(best.i));
        const d = Math.SQRT2 * Math.abs(hi.mean - lo.mean) / Math.sqrt(lo.sd ** 2 + hi.sd ** 2 || 1);
        return lo.n >= n * 0.05 && hi.n >= n * 0.05 && d > 4 ? [lo, hi] : null;
    };
    const gapsText = () => {
        const ms = v => `${Math.round(v)}ms`, _t = Chart.hecUi.PEN_HOVER_TIMEOUT / 1000;
        const _lines = GAP_TYPES.filter(k => gapsOf[k].gaps.length || gapsOf[k].long).map(k => {
            const { gaps, long } = gapsOf[k];
            if( !gaps.length ) return `${k}: ${long} gaps of ${_t} s or more`;
            const all = gapStats(gaps), two = gapRegimes(gaps);
            const regime = r => `${r.n} gaps (${Math.round(100 * r.n / all.n)} %): mean ${ms(r.mean)}, standard deviation ${ms(r.sd)}`;
            return `${k}: ${all.n} gaps: mean ${ms(all.mean)}, min ${ms(Math.min(...gaps))}, max ${ms(Math.max(...gaps))}, standard deviation ${ms(all.sd)}; ${long} of ${_t} s or more`
                + ( two ? `\n  two regimes — fast: ${regime(two[0])}; slow: ${regime(two[1])}` : '' );
        });
        return _lines.length ? _lines.join('\n') : '— no hover yet —';
    };

    const renderChecks = () => {
        $('checks').innerHTML = PEN_CHECKS.map(([k, label]) => {
            const _warn = ( k === 'touchType' || k === 'cancel' || k === 'tapCancel' ) && seen[k];
            return `<li><span class="pill mono${seen[k] ? ( _warn ? ' warn' : ' yes' ) : ''}">${seen[k] ? 'yes' : '—'}</span><span>${label}</span></li>`;
        }).join('');
    };
    const stamp = () => String(Math.round(performance.now() - t0)).padStart(6) + 'ms';
    const line = (e, where, extra = '') => {
        let _extra = extra;
        if( e.type.startsWith('key') ) _extra = ` key=${e.key} code=${e.code}`;
        if( e.type === 'contextmenu' ) {
            const _l = lastContact[where];
            _extra = ` contact=${contact}, ` + ( _l ? `${Math.round(performance.now() - _l.t)}ms after the last contact here ended, ${dist(_l, e.clientX, e.clientY)}px from it` : 'no contact here yet' );
        }
        // (a pointer's id, tilt, altitude and contact size: what may tell a pen reported as
        // a mouse; what a pointer leaving went to — null: it left the screen)
        const _p = e.pointerId === undefined ? '' : ` id=${e.pointerId} tilt=${e.tiltX ?? '-'},${e.tiltY ?? '-'} alt=${e.altitudeAngle === undefined ? '-' : e.altitudeAngle.toFixed(2)} wh=${Math.round(e.width ?? 0)}x${Math.round(e.height ?? 0)}`;
        // (Firefox: the event's real source — 1 mouse, 2 pen, 5 touch; Chromium: whether its
        // device fires touch events)
        const _src = ( e.mozInputSource !== undefined ? ` moz=${e.mozInputSource}` : '' ) +
                     ( e.sourceCapabilities ? ` touchCaps=${e.sourceCapabilities.firesTouchEvents}` : '' ) +
                     ( e.touches ? ` touches=${e.touches.length}${e.touches[0]?.touchType ? ' ' + e.touches[0].touchType : ''}${e.touches[0]?.force !== undefined ? ' f=' + e.touches[0].force.toFixed(2) : ''}` : '' );
        const _to = /^(pointer|mouse)(out|leave)$/.test(e.type) ? ` to=${e.relatedTarget ? ( e.relatedTarget.id || e.relatedTarget.tagName?.toLowerCase() ) : 'null'}` : '';
        return `${stamp()} ${where.padEnd(6)} ${e.type.padEnd(15)} ${String(e.pointerType ?? '-').padEnd(5)} btn=${String(e.button ?? '-').padStart(2)} btns=${String(e.buttons ?? '-').padStart(2)} p=${(e.pressure ?? 0).toFixed(2)}${_p}${_src}${_to}${_extra}`;
    };
    const push = (text) => {
        lines.unshift(text);
        if( lines.length > PEN_LOG_MAX ) lines.pop();
        $('log').textContent = lines.join('\n');
    };
    const onEvent = (e) => {
        const where = e.currentTarget?.id === 'padScroll' ? 'graph' : e.currentTarget?.id === 'padFree' ? 'free' : 'page';
        const pt = e.pointerType, b = e.buttons ?? 0;
        // A contact: how far and how long, and, taken over by the browser, did anything scroll
        let _extra = '';
        if( e.type === 'pointerdown' ) {
            contact = true;
            contacts[e.pointerId] = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), max: 0, scroll: scrollPos() };
        }
        const _c = contacts[e.pointerId];
        if( _c && e.type === 'pointermove' ) { _c.lx = e.clientX; _c.ly = e.clientY; _c.max = Math.max(_c.max, dist(_c, e.clientX, e.clientY)); }
        if( _c && ( e.type === 'pointerup' || e.type === 'pointercancel' ) ) {
            contact = false;
            delete contacts[e.pointerId];
            // (a pointercancel's own position isn't reliable, often 0: its contact's last one)
            const _ex = e.type === 'pointercancel' ? _c.lx : e.clientX, _ey = e.type === 'pointercancel' ? _c.ly : e.clientY;
            const _d = dist(_c, _ex, _ey);
            _c.max = Math.max(_c.max, _d);
            _extra = ` d=${_d}px max=${_c.max}px ${Math.round(performance.now() - _c.t)}ms`;
            lastContact[where] = { x: _ex, y: _ey, t: performance.now() };
            if( e.type === 'pointercancel' ) setTimeout(() => {
                const _s = Math.round(scrollPos() - _c.scroll);
                if( _s === 0 && _c.max <= PEN_TAP_SLOP ) seen.tapCancel = true;
                push(`${stamp()} ${where.padEnd(6)} (after the cancel: ${_s ? `scrolled ${_s}px` : 'nothing scrolled'})`);
                renderChecks();
            }, PEN_SCROLL_CHECK_MS);
        }
        if( e.type === 'pointermove' && pt && pt !== 'pen' && b === 0 && (e.pressure ?? 0) === 0 ) seen.hoverAny = true;
        if( /^(mousedown|mouseup|auxclick)$/.test(e.type) && e.button === 2 ) seen.mouseBtn2 = true;
        if( e.type.startsWith('key') ) seen.keys = true;
        if( e.type === 'selectstart' || e.type === 'selectionchange' ) seen.select = true;
        if( pt === 'pen' ) seen.penType = true;
        if( pt === 'touch' && seen.penType ) seen.touchType = true;
        if( pt === 'mouse' ) seen.mouseType = true;
        if( e.type === 'pointermove' && pt === 'pen' && b === 0 ) seen.hover = true;
        // (a hover move: no contact — a pointer event not from a finger, or a mouse event)
        if( gapsOf[e.type] && b === 0 && (pt ? pt !== 'touch' && (e.pressure ?? 0) === 0 : true) ) {
            const _g = gapsOf[e.type], _now = performance.now();
            if( _g.last && _g.last.where === where ) {
                const _d = _now - _g.last.t;
                if( _d < Chart.hecUi.PEN_HOVER_TIMEOUT ) _g.gaps.push(_d); else _g.long++;
                $('gaps').textContent = gapsText();
            }
            _g.last = { where, t: _now };
        }
        if( e.type === 'pointerdown' || e.type === 'pointerleave' || e.type === 'pointercancel' ) for( const k of GAP_TYPES ) gapsOf[k].last = null;
        if( e.type === 'pointerdown' && (b & 2) ) seen.barrelDown = true;
        if( e.type === 'pointermove' && (lastBtns[e.pointerId] & 1) && (b & 2) && !(lastBtns[e.pointerId] & 2) ) seen.barrelChord = true;
        if( b & 32 ) seen.eraser = true;
        if( e.type === 'pointercancel' ) seen.cancel = true;
        if( ( e.type === 'pointerleave' || e.type === 'pointerout' ) && b === 0 ) seen.leave = true;
        if( ( e.type === 'pointerleave' || e.type === 'pointerout' ) && b === 0 && !e.relatedTarget ) seen.leaveNull = true;
        if( e.type === 'mousemove' && b === 0 ) seen.mouseHover = true;
        if( e.mozInputSource === 2 ) seen.mozPen = true;
        if( /move$/.test(e.type) && b === 0 && e.sourceCapabilities?.firesTouchEvents ) seen.touchCaps = true;
        if( e.type === 'contextmenu' ) { seen.ctx = true; e.preventDefault(); }
        if( e.pointerId !== undefined ) lastBtns[e.pointerId] = b;
        $('now').textContent = line(e, where, _extra);
        const _now = performance.now();
        const _move = /(move|rawupdate)$/.test(e.type);
        if( !_move || _now - ( lastMoveLog[e.type] ?? 0 ) > PEN_MOVE_LOG_MS || ( b !== 0 && e.button >= 0 ) ) {
            if( _move ) lastMoveLog[e.type] = _now;
            push(line(e, where, _extra));
        }
        renderChecks();
    };
    const onSelectionChange = (e) => { const _n = performance.now(); if( _n - lastSel > 300 ) { lastSel = _n; onEvent(e); } };

    for( const id of ['padScroll', 'padFree'] ) for( const t of PEN_PAD_EVENTS ) $(id).addEventListener(t, onEvent);
    // (keys, and a text selection starting anywhere, don't belong to a zone)
    for( const t of PEN_PAGE_EVENTS ) document.addEventListener(t, onEvent);
    document.addEventListener('selectionchange', onSelectionChange);
    const mark = (text) => push(`${stamp()} ---- ${text} ----`);
    for( const [k, l] of PEN_MARKS ) $(`mark_${k}`).addEventListener('click', () => mark(`next: ${l}`));
    // (everything cleared, the acquisition started again from 0 — its clock too)
    const restart = () => {
        lines.length = 0;
        gapsReset();
        $('gaps').textContent = gapsText();
        for( const o of [seen, lastBtns, lastMoveLog, contacts, lastContact] ) for( const k in o ) delete o[k];
        contact = false; lastSel = 0;
        t0 = performance.now();
        $('log').textContent = '';
        $('now').textContent = '— nothing yet —';
        $('statsHint').textContent = '';
        renderChecks();
    };
    $('clear').addEventListener('click', restart);
    $('restart').addEventListener('click', restart);
    $('copyStats').addEventListener('click', () => copyText('Hover, time between two moves:\n' + gapsText(), $('statsHint')));
    // What the browser says of its pointers (the media queries) and of the device
    const _mq = q => window.matchMedia(q).matches;
    const deviceText = ['pointer', 'any-pointer'].map(f => `${f}: ${['coarse', 'fine', 'none'].filter(v => _mq(`(${f}: ${v})`)).join(' ') || '-'}`)
        .concat(['hover', 'any-hover'].map(f => `${f}: ${['hover', 'none'].filter(v => _mq(`(${f}: ${v})`)).join(' ') || '-'}`))
        .concat([`maxTouchPoints: ${navigator.maxTouchPoints}`, `devicePixelRatio: ${window.devicePixelRatio}`, navigator.userAgent]).join('\n');
    $('device').textContent = deviceText;
    renderChecks();

    return {
        report: () => PEN_CHECKS.map(([k, l]) => `${seen[k] ? 'YES' : ' - '}  ${l}`).join('\n') + '\n\nDevice:\n' + deviceText + '\n\nHover, time between two moves: ' + gapsText() + '\n\n' + lines.join('\n'),
        dispose: () => {
            for( const t of PEN_PAGE_EVENTS ) document.removeEventListener(t, onEvent);
            document.removeEventListener('selectionchange', onSelectionChange);
        },
    };
}

// ──────────────────────────────────────────────────────────────────────────────────────
// Performance: what the card costs on this device, with these entities and this Home
// Assistant, each step timed by the card itself (card-perf.js — every card of the page, one
// made again by Home Assistant too), and when the page froze meanwhile:
// 1. the card as it is: its graphs, its points, the statistics' verdicts;
// 2. its graphs drawn again: the card's own work, Chart.js's for each graph;
// 3. the window loaded again from nothing: each request — its phase, its source, the time it
//    asks, its entities and values, how long it waited in the queue, how long Home Assistant
//    took —, until the window is whole;
// 4. the window moved — '<' 3 times, '>' 3 times, dragged back —: each until whole, the
//    requests sent meanwhile, whether each brought some of the window shown;
// 5. the real time;
// and, on its own button, back on the page: the user leaves the app and comes back — Home
// Assistant's connection, the card taken off the page and made again or not, each of its
// steps until drawn, the freezes
// ──────────────────────────────────────────────────────────────────────────────────────

const PERF_REDRAWS = 3;            // the graphs drawn again that many times
const PERF_LOAD_MAX_S = 300;       // a load given up after that long
const PERF_IDLE_MS = 1000;         // a load done once nothing has loaded for that long
const PERF_REALTIME_S = 30;        // the real time watched that long
const PERF_BACK_WATCH_S = 15;      // back on the page: watched that long
const PERF_TICK_MS = 50;           // the page's pulse: a pulse late by more than
const PERF_FREEZE_MS = 250;        // this is a freeze

// The browser of a user agent: the Home Assistant app (its version, the web view it runs in),
// Firefox, Edge, Opera, Samsung Internet, Chrome, Safari — its name and version
export function browserOf(ua)
{
    const v = re => ua.match(re)?.[1];
    const _chrome = v(/Chrome\/(\d+)/);
    if( v(/Home Assistant\/([\d.]+)/) ) return `Home Assistant app ${v(/Home Assistant\/([\d.]+)/)}` + ( _chrome ? ` (web view: Chrome ${_chrome})` : / Safari\//.test(ua) || /AppleWebKit/.test(ua) ? ' (web view: WebKit)' : '' );
    if( v(/Firefox\/(\d+)/) ) return `Firefox ${v(/Firefox\/(\d+)/)}`;
    if( v(/Edg\w*\/(\d+)/) ) return `Edge ${v(/Edg\w*\/(\d+)/)}`;
    if( v(/OPR\/(\d+)/) ) return `Opera ${v(/OPR\/(\d+)/)}`;
    if( v(/SamsungBrowser\/([\d.]+)/) ) return `Samsung Internet ${v(/SamsungBrowser\/([\d.]+)/)}`;
    if( _chrome ) return `Chrome ${_chrome}`;
    if( v(/Version\/([\d.]+).*Safari/) ) return `Safari ${v(/Version\/([\d.]+).*Safari/)}`;
    return 'unknown';
}

function buildPerformanceTest(body, card)
{
    body.insertAdjacentHTML('beforeend', `
        <p class="lead">Measures what this card costs on this device, with its entities, its time window and this Home Assistant: the graphs drawn again, the window loaded again from nothing (each request to Home Assistant), the window moved ('&lt;' and '&gt;' 3 times each, a drag), ${PERF_REALTIME_S} s of real time. A freeze is a moment the page couldn't answer. Set the time window you want to measure first; the test takes a few minutes — the page may freeze while it runs.</p>
        <section class="box"><div class="row"><button id="start" type="button">Start</button><span class="hint" id="step"></span></div></section>
        <section class="box"><h2>Back on the page</h2><p class="lead">Press the button, switch to another app for a while (a few minutes: long enough for the page to go blank when you come back), then come back here: what happens then is measured for ${PERF_BACK_WATCH_S} s.</p>
            <div class="row"><button id="back" type="button">Measure a return</button><span class="hint" id="backStep"></span></div></section>
        <section class="box"><h2>Results</h2><pre class="log mono" id="out" style="max-height:none;white-space:pre-wrap">— not run yet —</pre></section>`);
    const $ = id => body.querySelector(`#${id}`);
    const lines = [];
    const out = text => { lines.push(text); $('out').textContent = lines.join('\n'); };
    const ms = x => Math.round(x) + ' ms';
    const sec = x => ( x / 1000 ).toFixed(1) + ' s';
    let stopped = false, pulse = 0;

    // (what is recorded: every card's steps, each with its time, and the freezes of the page)
    let rec = null;
    const recorder = { add: (kind, t, info) => rec && rec.events.push({ kind, ms: t, info, at: performance.now() }) };
    const record = () => {
        rec = { events: [], freezes: [], t0: performance.now() };
        let _last = performance.now();
        clearInterval(pulse);
        pulse = setInterval(() => { const n = performance.now(); if( n - _last > PERF_FREEZE_MS + PERF_TICK_MS ) rec.freezes.push({ ms: n - _last - PERF_TICK_MS, at: n }); _last = n; }, PERF_TICK_MS);
        card.setPerfRecorder(recorder);
    };
    const stop = () => { const r = rec; card.setPerfRecorder(null); clearInterval(pulse); rec = null; if( r ) r.ms = performance.now() - r.t0; return r; };
    const of = (r, kind) => r.events.filter(e => e.kind === kind);
    const sum = l => l.reduce((a, e) => a + ( e.ms ?? e ), 0);
    const max = l => l.reduce((a, e) => Math.max(a, e.ms ?? e), 0);
    const freezes = r => `${r.freezes.length} freezes, ${sec(sum(r.freezes))} in all (${Math.round(100 * sum(r.freezes) / Math.max(1, r.ms))} % of the time), the longest ${ms(max(r.freezes))}`;
    // (the graphs drawn again in record r: how many times, how long, and what had them drawn — each cause, how many times)
    const drawn = r => {
        const d = of(r, 'redraw'), n = new Map();
        for( const e of d ) n.set(e.info?.cause, ( n.get(e.info?.cause) ?? 0 ) + 1);
        return `the graphs drawn again ${d.length} times${d.length ? `: ${ms(sum(d))} in all, the longest ${ms(max(d))} (${[...n].map(([c, k]) => `${c} ${k}`).join(', ')})` : ''}`;
    };
    const wait = t => new Promise(res => setTimeout(res, t));
    const step = text => { $('step').textContent = text; };
    // (a time of Home Assistant's, in days from the window's start)
    const day = (t, t0) => { if( !t ) return 'now'; const d = ( Date.parse(t) - t0 ) / 864e5; return ( d >= 0 ? '+' : '' ) + d.toFixed(Math.abs(d) < 10 ? 1 : 0) + ' d'; };
    // (the requests of record r, one line each, in the order they were sent)
    const requests = (r, t0) => {
        const _req = of(r, 'request').sort((a, b) => ( a.at - a.ms ) - ( b.at - b.ms ));
        for( const q of _req ) {
            const i = q.info, src = i.type.startsWith('history') ? 'history' : String(i.period);
            const who = i.background ? 'background' : i.phase === null || i.phase === undefined ? 'export' : 'phase ' + i.phase;
            out(`  ${who.padEnd(10)} ${src.padEnd(7)} ${day(i.start, t0)} → ${day(i.end, t0)}  ${i.entities} entities${i.onScreen !== undefined ? ` (${i.onScreen} on the screen)` : ''}, ${i.values} values — waited ${sec(i.waited)}, took ${sec(q.ms)}${i.shown === false ? '  (not for the window shown)' : ''}`);
        }
        return _req;
    };
    // (done once nothing has loaded for a while — or after PERF_LOAD_MAX_S: true if loaded)
    const loaded = async t0 => {
        let _idle = 0;
        while( !stopped && _idle < PERF_IDLE_MS && performance.now() - t0 < PERF_LOAD_MAX_S * 1000 ) {
            await wait(100);
            _idle = card.state.loading ? 0 : _idle + 100;
        }
        return _idle >= PERF_IDLE_MS ? performance.now() - t0 - _idle : null;
    };

    // The systems the test runs on — first in the report: Home Assistant (its version, its
    // installation, the hardware it runs on, its database: its system health and hardware
    // integration — an administrator's; else unknown) and this device (its browser, its
    // processor, memory, graphics, screen)
    const _answer = p => Promise.race([p, wait(4000).then(() => { throw new Error('no answer'); })]);
    const _health = () => new Promise(res => {
        const info = {}, _c = card._hass?.connection;
        if( !_c?.subscribeMessage ) return res(info);
        let _un = null, _done = false;
        const _end = () => { if( _done ) return; _done = true; Promise.resolve(_un).then(u => u?.()).catch(() => {}); res(info); };
        setTimeout(_end, 4000);
        const _v = x => x === null || typeof x !== 'object' ? x : undefined;
        try { _un = _c.subscribeMessage(m => {
            if( m?.type === 'initial' ) for( const [d, x] of Object.entries(m.data ?? {}) ) for( const [k, v] of Object.entries(x?.info ?? {}) ) { if( _v(v) !== undefined ) ( info[d] ??= {} )[k] = v; }
            else if( m?.type === 'update' && m.success && _v(m.data) !== undefined ) ( info[m.domain] ??= {} )[m.key] = m.data;
            else if( m?.type === 'finish' ) _end();
        }, { type: 'system_health/info' }); } catch( e ) { _end(); }
        Promise.resolve(_un).catch(_end);
    });
    const _status = () => new Promise(res => {
        const _c = card._hass?.connection;
        if( !_c?.subscribeMessage ) return res(null);
        let _un = null, _done = false;
        const _end = x => { if( _done ) return; _done = true; Promise.resolve(_un).then(u => u?.()).catch(() => {}); res(x); };
        // (Home Assistant sends it every few seconds: waited for longer)
        setTimeout(() => _end(null), 8000);
        try { _un = _c.subscribeMessage(m => _end(m), { type: 'hardware/subscribe_system_status' }); } catch( e ) { _end(null); }
        Promise.resolve(_un).catch(() => _end(null));
    });
    const systems = async () => {
        step('Asking Home Assistant what it runs on…');
        const [h, hw, st] = await Promise.all([_health(), _answer(Promise.resolve().then(() => card._hass.callWS({ type: 'hardware/info' }))).catch(() => null), _status()]);
        const ha = h.homeassistant ?? {}, sv = h.hassio ?? {}, rec = h.recorder ?? {};
        const _board = ( hw?.hardware ?? [] ).map(x => x.name ?? x.board?.model).filter(Boolean).join(', ') || sv.board;
        const _mem = st && Number.isFinite(st.memory_used_mb) && Number.isFinite(st.memory_free_mb) ? `${( ( st.memory_used_mb + st.memory_free_mb ) / 1024 ).toFixed(1)} GB memory (${Math.round(st.memory_used_percent ?? 0)} % used)` : null;
        // (Home Assistant names MariaDB and MySQL alike, 'mysql': MariaDB's versions are 10 and over)
        const _engine = e => e === 'mysql' ? ( parseInt(rec.database_version) >= 10 ? 'MariaDB' : 'MySQL' ) : ( { sqlite: 'SQLite', postgresql: 'PostgreSQL' } )[e] ?? e;
        const _db = rec.database_engine ? `database ${_engine(rec.database_engine)}${rec.database_version ? ' ' + rec.database_version : ''}${rec.estimated_db_size ? ' (' + rec.estimated_db_size + ')' : ''}` : null;
        const _os = ha.os_name ? `${ha.installation_type ?? ''} on ${sv.host_os ?? ha.os_name + ' ' + ( ha.os_version ?? '' )}`.trim() : ha.installation_type;
        // (Home Assistant's sizes with their unit, or bare: then GB)
        const _gb = v => /[a-z]/i.test(String(v)) ? String(v) : `${v} GB`;
        const _disk = sv.disk_total ? `disk ${_gb(sv.disk_used ?? '?')} / ${_gb(sv.disk_total)}` : null;
        const _ha = [_os, ha.arch, _board, _mem, _disk, _db].filter(Boolean);
        out(`Home Assistant ${card._hass?.config?.version ?? '?'}${_ha.length ? ': ' + _ha.join(', ') : ' (what it runs on unknown: an administrator\'s account tells it)'}`);
        // (this device: the browser's hints — model, platform —, its graphics, its screen)
        let _ua = null;
        try { _ua = await _answer(navigator.userAgentData?.getHighEntropyValues?.(['model', 'platform', 'platformVersion', 'architecture']) ?? Promise.resolve(null)); } catch( e ) { _ua = null; }
        let _gpu = null;
        try {
            const gl = document.createElement('canvas').getContext('webgl'), x = gl?.getExtension('WEBGL_debug_renderer_info');
            _gpu = x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) ?? null;
            gl?.getExtension('WEBGL_lose_context')?.loseContext();
        } catch( e ) { _gpu = null; }
        const _dev = [_ua?.model, _ua?.platform ? `${_ua.platform} ${_ua.platformVersion ?? ''}`.trim() : null, _ua?.architecture,
                      `${navigator.hardwareConcurrency ?? '?'} cores`, navigator.deviceMemory ? `${navigator.deviceMemory} GB memory or more` : null, _gpu ? `graphics ${_gpu}` : null,
                      `screen ${screen.width}×${screen.height} px, window ${window.innerWidth}×${window.innerHeight} px, pixel ratio ${window.devicePixelRatio}`].filter(Boolean);
        out(`This device: ${_dev.join(', ')}`);
        out(`Browser: ${browserOf(navigator.userAgent)}\n`);
    };

    const setup = () => {
        const P = card.pconfig, g = card.graphs, ids = card.historyEntityIds(), stats = new Set(card._statisticsIds());
        const points = x => card.pointsShown(x);
        const G = card._geometry();
        out(`Window: ${card.startTime} → ${card.endTime} (${( G.r / 864e5 ).toFixed(1)} days), a column of pixels: ${( G.column / 60e3 ).toFixed(1)} min`);
        out(`Options: refresh ${P.refreshEnabled ? 'automatic' : 'off'}, statistics ${card.statistics?.enabled ? `on (their period: ${card.statistics.period})` : 'off'}`);
        out(`Graphs: ${g.length}, entities: ${ids.length} (${stats.size} with statistics), points drawn: ${g.reduce((a, x) => a + points(x), 0)}`);
        // (on the screen: on it or within a screen's height — drawn first, see card-charts.js graphShown)
        for( const x of g ) out(`  ${x.type} — ${x.entities.length} entities, ${points(x)} points${card.graphShown(x) ? ', on the screen' : ''}`);
        // (the statistics probe's verdicts: see card-history.js SENSOR_GAPS)
        // (and what each found: when, its values and its short intervals — see card-history.js _speaks)
        const _hm = t => window.HXLocal_moment(t).format('HH:mm');
        const _found = id => {
            const i = PROBE_INFO.get(id);
            if( !i ) return 'not probed';
            if( i.kept ) return `kept on this device since ${_hm(i.at)}`;
            const _long = i.long ? `; last 24 h: ${i.long.n} values, ${i.long.short}${i.long.short >= 5 ? '+' : ''} intervals under 50 min` : '';
            return `probed at ${_hm(i.at)}: last hour ${i.n} values, ${i.short}${i.short >= 5 ? '+' : ''} intervals under 4 min, the shortest ${i.shortest === null ? '—' : Math.round(i.shortest / 1000) + ' s'}${_long}`;
        };
        const _v = ids.filter(id => stats.has(id)).map(id => `${id}: 5 min ${card._relevant(id, 300e3) ? 'valid' : 'not valid'}, hourly ${card._relevant(id, 3600e3) ? 'valid' : 'not valid'} (${_found(id)})`);
        if( _v.length ) { out('Statistics valid (the probe):'); for( const x of _v ) out('  ' + x); }
    };

    const redraws = async () => {
        out(`\n== The graphs drawn again (${PERF_REDRAWS} times)`);
        for( let k = 0; k < PERF_REDRAWS && !stopped; k++ ) {
            step(`Drawing again (${k + 1}/${PERF_REDRAWS})…`);
            await wait(300);
            record();
            card.generateGraphDataFromCache(REDRAW_CAUSES.test);
            const r = stop();
            const _all = sum(of(r, 'redraw')), _charts = of(r, 'chart'), _card = _all - sum(_charts), _rows = sum(of(r, 'from cache')), _pts = sum(of(r, 'points'));
            out(`  ${ms(_all)}: the card ${ms(_card)} (the rows read from the cache ${ms(_rows)}, the points worked out ${ms(_pts)}, the rest ${ms(Math.max(0, _card - _rows - _pts))}), Chart.js ${ms(sum(_charts))} — by graph: ${_charts.map(c => ms(c.ms)).join(', ')}`);
        }
    };

    const load = async () => {
        out('\n== The window loaded again from nothing');
        step('Loading…');
        const t0 = Date.parse(card.startTime);
        record();
        const _start = performance.now();
        card.reloadHistory();
        const _whole = await loaded(_start);
        const r = stop();
        if( !r ) return;
        const _req = requests(r, t0);
        out(`  ${_whole === null ? `not whole after ${PERF_LOAD_MAX_S} s` : `whole after ${sec(_whole)}`}: ${_req.length} requests, ${_req.reduce((n, q) => n + q.info.values, 0)} values`);
        const _parts = of(r, 'part');
        out(`  ${_parts.length} answers put in the cache: ${ms(sum(_parts))} in all; ${drawn(r)} — Chart.js ${ms(sum(of(r, 'chart')))} of it`);
        out(`  ${freezes(r)}`);
    };

    // (the window moved by how — a function of the card —, then watched until whole)
    const moved = async (label, how) => {
        if( stopped ) return;
        step(`${label}…`);
        record();
        const _start = performance.now();
        await how();
        const _whole = await loaded(_start);
        const r = stop();
        if( !r ) return;
        out(`\n== ${label}: ${_whole === null ? `not whole after ${PERF_LOAD_MAX_S} s` : `whole after ${sec(_whole)}`}`);
        out(`  window: ${card.startTime} → ${card.endTime}`);
        requests(r, Date.parse(card.startTime));
        out(`  ${drawn(r)}`);
        out(`  ${freezes(r)}`);
    };
    const moves = async () => {
        const _clicks = dir => async () => { for( let k = 0; k < 3; k++ ) { card.stepDay(dir); await wait(250); } };
        await moved("'<' clicked 3 times", _clicks(-1));
        await moved("'>' clicked 3 times", _clicks(1));
        await moved('dragged back (8 moves of a tenth of the window)', async () => {
            const m = window.HXLocal_moment, r = Date.parse(card.endTime) - Date.parse(card.startTime);
            // (as a finger's drag does — see card-gestures.js —: each move only moves the window, the end draws it whole)
            card.state.drag = true;
            for( let k = 0; k < 8; k++ ) { card.moveTimeWindow(m(Date.parse(card.startTime) - r / 10)); await wait(120); }
            card.state.drag = false;
            card.updateHistory();
        });
    };

    const realtime = async () => {
        out(`\n== ${PERF_REALTIME_S} s of real time`);
        step(`Watching the real time (${PERF_REALTIME_S} s)…`);
        card.today(false);
        record();
        for( let k = 0; k < PERF_REALTIME_S && !stopped; k++ ) await wait(1000);
        const r = stop();
        if( !r ) return;
        out(`  ${of(r, 'request').length} requests, ${drawn(r)}`);
        out(`  ${freezes(r)}`);
    };

    // Back on the page: armed; the page hidden, then shown again — watched PERF_BACK_WATCH_S
    // from then: Home Assistant's connection, each card's steps, the freezes
    let _onVis = null, _conn = null, _onConn = null;
    const back = head => {
        $('back').disabled = true;
        $('backStep').textContent = 'Waiting: switch to another app, then come back.';
        const _hass = card._hass, _c = _hass?.connection;
        let _hidden = null;
        const _events = [];
        // (Home Assistant's connection: lost, back)
        if( _c?.addEventListener ) {
            _conn = _c;
            _onConn = name => () => _events.push({ at: performance.now(), what: `Home Assistant's connection: ${name}` });
            _onConn.fns = { ready: _onConn('ready again'), disconnected: _onConn('lost') };
            for( const k in _onConn.fns ) _c.addEventListener(k, _onConn.fns[k]);
        }
        record();
        _onVis = async () => {
            if( document.visibilityState === 'hidden' ) { _hidden = performance.now(); return; }
            if( _hidden === null ) return;
            document.removeEventListener('visibilitychange', _onVis);
            const _shown = performance.now();
            $('backStep').textContent = `Back: watching for ${PERF_BACK_WATCH_S} s…`;
            await wait(PERF_BACK_WATCH_S * 1000);
            const r = stop();
            if( _conn ) for( const k in _onConn.fns ) _conn.removeEventListener(k, _onConn.fns[k]);
            _conn = null;
            if( !r ) return;
            await head;
            out(`\n== Back on the page, after ${sec(_shown - _hidden)} away`);
            const _all = [...r.events.filter(e => e.kind === 'card').map(e => ({ at: e.at, what: `card ${e.info.card}: ${e.info.step}${e.ms ? ` (${ms(e.ms)})` : ''}` })),
                          ..._events, ...r.freezes.map(f => ({ at: f.at, what: `the page froze ${ms(f.ms)}` })),
                          ...of(r, 'redraw').map(e => ({ at: e.at, what: `graphs drawn again (${ms(e.ms)}): ${e.info?.cause}` })),
                          ...of(r, 'request').map(e => ({ at: e.at, what: `answer: ${e.info.type.startsWith('history') ? 'history' : e.info.period} (${e.info.values} values, ${sec(e.ms)})` }))]
                .filter(e => e.at >= _hidden).sort((a, b) => a.at - b.at);
            for( const e of _all ) out(`  ${( e.at < _shown ? '-' : '+' ) + sec(Math.abs(e.at - _shown))}  ${e.what}`);
            if( !_all.length ) out('  nothing happened: the card stayed as it was');
            $('backStep').textContent = 'Done: copy the report below.';
            $('back').disabled = false;
        };
        document.addEventListener('visibilitychange', _onVis);
    };
    // (armed at once — the page may be left right away —, the report's first lines written meanwhile)
    $('back').addEventListener('click', () => { back(lines.length === 0 || lines[0].startsWith('—') ? ( lines.length = 0, systems().then(setup) ) : null); });

    $('start').addEventListener('click', async () => {
        $('start').disabled = true;
        lines.length = 0;
        await systems();
        setup();
        await redraws();
        if( !stopped ) await load();
        if( !stopped ) await moves();
        if( !stopped ) await realtime();
        step(stopped ? 'Stopped.' : 'Done: copy the report below.');
        $('start').disabled = false;
    });

    return {
        report: () => lines.join('\n'),
        dispose: () => {
            stopped = true; stop();
            if( _onVis ) document.removeEventListener('visibilitychange', _onVis);
            if( _conn ) for( const k in _onConn.fns ) _conn.removeEventListener(k, _onConn.fns[k]);
        },
    };
}
