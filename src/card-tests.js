// Tests (beta): diagnostics opened from the type menu's Tests ▸ submenu. Each one runs in
// the card's own context — the browser, or the Home Assistant app's web view, the card
// is shown in — so that a user can report what that system really gives the card: a
// dialog over the page, its report copied, or sent as a GitHub issue.

import { Version } from "./version.js";

const ISSUE_URL = 'https://github.com/Cook23/history-explorer-card/issues/new';
// (a longer link may be refused: the whole report is in the copied one)
const ISSUE_BODY_MAX = 6000;

// The tests, in the submenu's order: its entry (i18n key), its dialog's title, and
// build(body), which fills the dialog's body and returns { report(), dispose() }
export const CARD_TESTS = {
    pen: { label: 'ui.menu.test_pen', title: 'Pen events', build: buildPenEventsTest },
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

export function openCardTest(key)
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
    const test = def.build(root.querySelector('.body'));
    const report = () => `${def.title} — history-explorer-card ${Version}\n${navigator.userAgent}\n\n${test.report()}`;

    $('copy').addEventListener('click', () => {
        const text = report();
        const done = () => { $('reportHint').textContent = 'Copied.'; };
        // (the clipboard is refused outside a secure context: copied through a selection)
        const byHand = () => {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.className = 'mono';
            ta.rows = 8;
            $('reportHint').replaceWith(ta);
            ta.select();
            if( !document.execCommand?.('copy') ) ta.insertAdjacentHTML('afterend', '<span class="hint">Copy it by hand.</span>');
        };
        if( navigator.clipboard?.writeText ) navigator.clipboard.writeText(text).then(done, byHand);
        else byHand();
    });
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
];
const PEN_PAD_EVENTS = ['pointerover', 'pointerenter', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerout', 'pointerleave',
                        'contextmenu', 'mousedown', 'mouseup', 'click', 'auxclick', 'dblclick'];
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
    const t0 = performance.now();
    let lastMoveLog = 0, contact = false, lastSel = 0;
    // The contacts under way (by pointerId), and each zone's last one, ended
    const contacts = {}, lastContact = {};
    const scroller = body.closest('.dlg');
    const scrollPos = () => ( scroller ? scroller.scrollTop : 0 ) + window.scrollY;
    const dist = (a, x, y) => Math.round(Math.hypot(x - a.x, y - a.y));

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
        return `${stamp()} ${where.padEnd(6)} ${e.type.padEnd(15)} ${String(e.pointerType ?? '-').padEnd(5)} btn=${String(e.button ?? '-').padStart(2)} btns=${String(e.buttons ?? '-').padStart(2)} p=${(e.pressure ?? 0).toFixed(2)}${_extra}`;
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
        if( e.type === 'pointerdown' && (b & 2) ) seen.barrelDown = true;
        if( e.type === 'pointermove' && (lastBtns[e.pointerId] & 1) && (b & 2) && !(lastBtns[e.pointerId] & 2) ) seen.barrelChord = true;
        if( b & 32 ) seen.eraser = true;
        if( e.type === 'pointercancel' ) seen.cancel = true;
        if( ( e.type === 'pointerleave' || e.type === 'pointerout' ) && b === 0 ) seen.leave = true;
        if( e.type === 'contextmenu' ) { seen.ctx = true; e.preventDefault(); }
        if( e.pointerId !== undefined ) lastBtns[e.pointerId] = b;
        $('now').textContent = line(e, where, _extra);
        const _now = performance.now();
        if( e.type !== 'pointermove' || _now - lastMoveLog > PEN_MOVE_LOG_MS || ( b !== 0 && e.button >= 0 ) ) {
            if( e.type === 'pointermove' ) lastMoveLog = _now;
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
    $('clear').addEventListener('click', () => {
        lines.length = 0;
        for( const k in seen ) delete seen[k];
        $('log').textContent = '';
        $('now').textContent = '— nothing yet —';
        renderChecks();
    });
    renderChecks();

    return {
        report: () => PEN_CHECKS.map(([k, l]) => `${seen[k] ? 'YES' : ' - '}  ${l}`).join('\n') + '\n\n' + lines.join('\n'),
        dispose: () => {
            for( const t of PEN_PAGE_EVENTS ) document.removeEventListener(t, onEvent);
            document.removeEventListener('selectionchange', onSelectionChange);
        },
    };
}
