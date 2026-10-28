// Tests (beta): diagnostics opened from the type menu's Tests ▸ submenu. Each one runs in
// the card's own context — the browser, or the Home Assistant app's web view, the card
// is shown in, with the user's own entities — so that a user can report what that system
// really gives the card: a dialog over the page, its report copied, or sent as a GitHub
// issue.

import { Version } from "./version.js";
const Chart = window.HXLocal_Chart;

const ISSUE_URL = 'https://github.com/Cook23/history-explorer-card/issues/new';
// (a longer link may be refused: the whole report is in the copied one)
const ISSUE_BODY_MAX = 6000;

// The tests, in the submenu's order: its entry (i18n key), its dialog's title, and
// build(body, card), which fills the dialog's body and returns { report(), dispose() }
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
            <p>Hold the pen still above a zone, then move it away: a pen hovers only while it sends moves (the card ends its hover after ${Chart.hecUi.PEN_HOVER_TIMEOUT / 1000} s without one). Every move with no contact counts, whatever type it's reported as.</p>
            <div class="now mono" id="gaps">— no hover yet —</div></section>
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
    const lastMoveLog = {}; let contact = false, lastSel = 0;
    // The contacts under way (by pointerId), and each zone's last one, ended
    const contacts = {}, lastContact = {};
    const scroller = body.closest('.dlg');
    const scrollPos = () => ( scroller ? scroller.scrollTop : 0 ) + window.scrollY;
    const dist = (a, x, y) => Math.round(Math.hypot(x - a.x, y - a.y));
    // The time between two moves of a pen hovering (on the same zone, no contact, no leaving
    // between them): those shorter than the card's timeout, and how many reached it
    const gaps = [];
    let gapsLong = 0, lastHover = null;
    const gapsText = () => {
        if( !gaps.length && !gapsLong ) return '— no hover yet —';
        const n = gaps.length, mean = n ? gaps.reduce((a, g) => a + g, 0) / n : 0;
        const sd = n ? Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / n) : 0;
        const ms = v => `${Math.round(v)}ms`;
        return n ? `${n} gaps: mean ${ms(mean)}, min ${ms(Math.min(...gaps))}, max ${ms(Math.max(...gaps))}, standard deviation ${ms(sd)}; ${gapsLong} of ${Chart.hecUi.PEN_HOVER_TIMEOUT / 1000} s or more`
                 : `${gapsLong} gaps of ${Chart.hecUi.PEN_HOVER_TIMEOUT / 1000} s or more`;
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
        if( e.type === 'pointermove' && pt && pt !== 'touch' && b === 0 && (e.pressure ?? 0) === 0 ) {
            const _now = performance.now();
            if( lastHover && lastHover.where === where ) {
                const _g = _now - lastHover.t;
                if( _g < Chart.hecUi.PEN_HOVER_TIMEOUT ) gaps.push(_g); else gapsLong++;
                $('gaps').textContent = gapsText();
            }
            lastHover = { where, t: _now };
        }
        if( e.type === 'pointerdown' || e.type === 'pointerleave' || e.type === 'pointercancel' ) lastHover = null;
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
    $('clear').addEventListener('click', () => {
        lines.length = 0;
        gaps.length = 0; gapsLong = 0; lastHover = null;
        $('gaps').textContent = gapsText();
        for( const k in seen ) delete seen[k];
        $('log').textContent = '';
        $('now').textContent = '— nothing yet —';
        renderChecks();
    });
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
// Performance: what the card costs on this device, with these entities — drawing the
// graphs again, loading the window from Home Assistant, the real time — and when the page
// froze meanwhile. The card times its own steps while it runs (setPerfRecorder)
// ──────────────────────────────────────────────────────────────────────────────────────

const PERF_REDRAWS = 3;            // the graphs drawn again that many times
const PERF_LOAD_MAX_S = 300;       // a load given up after that long
const PERF_REALTIME_S = 30;        // the real time watched that long
const PERF_TICK_MS = 50;           // the page's pulse: a pulse late by more than
const PERF_FREEZE_MS = 250;        // this is a freeze

function buildPerformanceTest(body, card)
{
    body.insertAdjacentHTML('beforeend', `
        <p class="lead">Measures what this card costs on this device, with its entities and its time window as they are now: the graphs drawn again (${PERF_REDRAWS} times), the window loaded again from Home Assistant, then ${PERF_REALTIME_S} s of real time. A freeze is a moment the page couldn't answer. Set the time window you want to measure first (the one that is slow); the test takes a minute or more — the page may freeze while it runs.</p>
        <section class="box"><div class="row"><button id="start" type="button">Start</button><span class="hint" id="step"></span></div></section>
        <section class="box"><h2>Results</h2><pre class="log mono" id="out" style="max-height:none;white-space:pre-wrap">— not run yet —</pre></section>`);
    const $ = id => body.querySelector(`#${id}`);
    const lines = [];
    const out = text => { lines.push(text); $('out').textContent = lines.join('\n'); };
    const ms = x => Math.round(x) + ' ms';
    const sec = x => ( x / 1000 ).toFixed(1) + ' s';
    let stopped = false, pulse = 0;

    // (what is recorded: the card's steps, and the freezes of the page)
    let rec = null;
    const recorder = { add: (kind, t, info) => rec && rec.events.push({ kind, ms: t, info, at: performance.now() }) };
    const record = () => {
        rec = { events: [], freezes: [], t0: performance.now() };
        let _last = performance.now();
        clearInterval(pulse);
        pulse = setInterval(() => { const n = performance.now(); if( n - _last > PERF_FREEZE_MS + PERF_TICK_MS ) rec.freezes.push(n - _last - PERF_TICK_MS); _last = n; }, PERF_TICK_MS);
        card.setPerfRecorder(recorder);
    };
    const stop = () => { const r = rec; card.setPerfRecorder(null); clearInterval(pulse); rec = null; if( r ) r.ms = performance.now() - r.t0; return r; };
    const of = (r, kind) => r.events.filter(e => e.kind === kind);
    const sum = l => l.reduce((a, e) => a + ( e.ms ?? e ), 0);
    const max = l => l.reduce((a, e) => Math.max(a, e.ms ?? e), 0);
    const freezes = r => `${r.freezes.length} freezes, ${sec(sum(r.freezes))} in all (${Math.round(100 * sum(r.freezes) / r.ms)} % of the time), the longest ${ms(max(r.freezes))}`;
    const wait = t => new Promise(res => setTimeout(res, t));
    const step = text => { $('step').textContent = text; };

    const setup = () => {
        const P = card.pconfig, g = card.graphs;
        const points = x => card.pointsShown(x);
        out(`Window: ${card.startTime} → ${card.endTime}`);
        out(`Options: refresh ${P.refreshEnabled ? 'automatic' : 'off'}, statistics ${card.statistics?.enabled ? 'on' : 'off'}`);
        out(`Device: ${navigator.hardwareConcurrency ?? '?'} cores, ${window.innerWidth}×${window.innerHeight} px, pixel ratio ${window.devicePixelRatio}`);
        out(`Graphs: ${g.length}, entities: ${g.reduce((a, x) => a + x.entities.length, 0)}, points drawn: ${g.reduce((a, x) => a + points(x), 0)}`);
        for( const x of g ) out(`  ${x.type} — ${x.entities.length} entities, ${points(x)} points`);
    };

    const redraws = async () => {
        out(`\n== The graphs drawn again (${PERF_REDRAWS} times)`);
        for( let k = 0; k < PERF_REDRAWS && !stopped; k++ ) {
            step(`Drawing again (${k + 1}/${PERF_REDRAWS})…`);
            await wait(300);
            record();
            card.generateGraphDataFromCache();
            const r = stop();
            const _all = sum(of(r, 'redraw')), _chart = sum(of(r, 'chart'));
            out(`  ${ms(_all)}: the card ${ms(_all - _chart)}, Chart.js ${ms(_chart)} (${of(r, 'chart').length} updates, the longest ${ms(max(of(r, 'chart')))})`);
        }
    };

    const load = async () => {
        out('\n== The window loaded again from Home Assistant');
        step('Loading…');
        record();
        card.reloadHistory();
        // (done once nothing has loaded for a second: the window's parts and its statistics)
        let _idle = 0;
        while( !stopped && _idle < 1000 && performance.now() - rec.t0 < PERF_LOAD_MAX_S * 1000 ) {
            await wait(200);
            _idle = card.state.loading ? 0 : _idle + 200;
        }
        const r = stop();
        if( !r ) return;
        const _req = of(r, 'request'), _parts = of(r, 'part');
        out(`  ${sec(r.ms - _idle)} in all`);
        for( const q of _req ) out(`  ${q.info.type}: ${q.info.entities} entities, ${q.info.values} values, answered in ${sec(q.ms)}`);
        const _draws = of(r, 'redraw');
        out(`  ${_parts.length} parts put in the cache: ${ms(sum(_parts))} in all`);
        out(`  the graphs drawn again ${_draws.length} times: ${ms(sum(_draws))} in all, the longest ${ms(max(_draws))} — Chart.js ${ms(sum(of(r, 'chart')))} of it`);
        out(`  ${freezes(r)}`);
    };

    const realtime = async () => {
        out(`\n== ${PERF_REALTIME_S} s of real time`);
        step(`Watching the real time (${PERF_REALTIME_S} s)…`);
        record();
        for( let k = 0; k < PERF_REALTIME_S && !stopped; k++ ) await wait(1000);
        const r = stop();
        if( !r ) return;
        const _d = of(r, 'redraw');
        out(`  ${of(r, 'request').length} refreshes asked, the graphs drawn again ${_d.length} times: ${ms(sum(_d))} in all, the longest ${ms(max(_d))}`);
        out(`  ${freezes(r)}`);
    };

    $('start').addEventListener('click', async () => {
        $('start').disabled = true;
        lines.length = 0;
        setup();
        await redraws();
        if( !stopped ) await load();
        if( !stopped ) await realtime();
        step(stopped ? 'Stopped.' : 'Done: copy the report below.');
        $('start').disabled = false;
    });

    return {
        report: () => lines.join('\n'),
        dispose: () => { stopped = true; stop(); },
    };
}
