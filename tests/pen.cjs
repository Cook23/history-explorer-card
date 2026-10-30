// Interactions with a pen: its tip as a finger, its barrel button as a mouse's right button,
// and the tooltip opened by a contact, then moved by hovering above the screen
const { openCard } = require('./lib.cjs');

// (the tooltip of the curves selected — a click on one —, on this large screen too: see
// points.cjs for the other modes)
const CFG = { type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, largeScreenTooltip: 'selected',
    graphs: [
        { type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power_kw' }, { entity: 'sensor.rain' }] },
        { type: 'line', entities: [{ entity: 'sensor.watering_cycle' }] },
        { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }, { entity: 'binary_sensor.b' }] }] };

// The hover tooltip of graph gi: its text while shown, else null
const TIP = gi => `(()=>{ const el=graphAt(${gi}).chart.tooltip._hecHoverTooltipEl; return el && el.isConnected && getComputedStyle(el).display!=='none' && getComputedStyle(el).opacity!=='0' ? el.textContent : null; })()`;

module.exports = async function()
{
    const t = await openCard(CFG, { height: 1300, mock: { series: true } });
    const E = x => t.E(x);
    const names = s => s.replace(/^.:|@.*$/g, '').split('+').sort().join();

    await t.step('barrel button held: a drag moves a curve label right away (no tap first)', async () => {
        const g0 = await t.graphs(); const a = await E('legendPt(0,0)'); const c = await E('legendPt(0,2)');
        await t.penDrag(a, { x: c.x + 5, y: c.y }, true);
        const g1 = await t.graphs();
        return g1.length === g0.length && g1[0] !== g0[0] && names(g1[0]) === names(g0[0]) && !/\(h\)/.test(g1[0]) ? true : `${g0[0]} -> ${g1.join(' | ')}`;
    });
    await t.step('barrel button held: a tap on a curve label opens its type menu, no browser menu', async () => {
        const a = await E('legendPt(0,1)');
        await E(`window.__ctx=0; document.addEventListener('contextmenu', e => { if( !e.defaultPrevented ) window.__ctx++; }, { once: true })`);
        await t.penTap(a, true);
        await E(`graphAt(0).canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: ${a.x}, clientY: ${a.y} }))`);
        await t.wait(400);
        const open = await E(`getComputedStyle(el.instance._this.querySelector('#et_0')).display !== 'none'`);
        const ctx = await E('window.__ctx');
        await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.wait(300);
        return open && ctx === 0 ? true : `menu open: ${open}, browser menu: ${ctx}`;
    });
    await t.step('tip on a YAML curve label, barrel button pressed twice: split into a linked graph', async () => {
        const n0 = (await t.graphs()).length;
        await t.penBarrelDouble(await E('legendPt(0,0)'));
        const g1 = await t.graphs();
        return g1.length === n0 + 1 && !g1.some(x => /\(h\)/.test(x)) ? true : g1.join(' | ');
    });
    await t.step('tip tap on a curve label: shows/hides it, as a finger does', async () => {
        const a = await E('legendPt(0,0)');
        await t.penTap(a); await t.wait(800); const g1 = (await t.graphs())[0];
        await t.wait(500);
        await t.penTap(a); await t.wait(800); const g2 = (await t.graphs())[0];
        return /\(h\)/.test(g1) && !/\(h\)/.test(g2) ? true : `${g1} / ${g2}`;
    });

    // ── The tooltip: opened by a contact on the plot area, moved by hovering ──
    const gi = 0;   // power_kw and rain, many values
    await t.step('hovering above the curves opens no tooltip', async () => {
        const a = await E(`graphPtAt(${gi},0.5)`);
        await t.penHover({ x: a.x - 150, y: a.y }, a); await t.wait(500);
        const tip = await E(TIP(gi));
        return tip === null ? true : 'tooltip: ' + tip;
    });
    await t.step('a tap on the curves opens it, hovering then moves it', async () => {
        const p1 = await E(`pointPt(${gi},0.3)`), p2 = await E(`pointPt(${gi},0.7)`);
        await t.penTap(p1); await t.wait(400);
        const t1 = await E(TIP(gi));
        await t.penHover(p1, p2); await t.wait(400);
        const t2 = await E(TIP(gi));
        return t1 && t2 && t1 !== t2 ? true : `${t1} / ${t2}`;
    });
    await t.step('the pen leaving hover range closes it, and hovering back opens nothing', async () => {
        const a = await E(`graphPtAt(${gi},0.5)`);
        await t.pen('pointerout', a, 0); await t.pen('pointerleave', a, 0); await t.wait(1300);   // (closes with a fade)
        const t1 = await E(TIP(gi));
        await t.penHover({ x: a.x - 100, y: a.y }, a); await t.wait(400);
        const t2 = await E(TIP(gi));
        return t1 === null && t2 === null ? true : `${t1} / ${t2}`;
    });
    await t.step('the pen gone out of hover range without leaving (no more moves, no pointerleave): what its hover showed ends 0.5 s after its last move, as if it had left', async () => {
        const p1 = await E(`pointPt(${gi},0.3)`), p2 = await E(`pointPt(${gi},0.7)`);
        await t.penTap(p1); await t.wait(400);
        await t.penHover(p1, p2); await t.wait(250);
        const t1 = await E(TIP(gi));                        // (still hovering: 0.25 s after its last move)
        await t.wait(1600);                                  // (0.5 s, then the tooltip's fade)
        const t2 = await E(TIP(gi)), dot = await E(`graphAt(${gi}).chart._hecHoverDot ?? null`);
        await t.penHover({ x: p2.x - 100, y: p2.y }, p2); await t.wait(400);
        const t3 = await E(TIP(gi));                         // (its mode ended: hovering back opens nothing)
        return t1 && t2 === null && t3 === null && !dot ? true : JSON.stringify({ t1, t2, t3, dot });
    });
    await t.step('a tap the browser takes over (pointercancel), then a hover reported as a mouse: the tooltip stays open and follows', async () => {
        const p1 = await E(`pointPt(${gi},0.3)`), p2 = await E(`pointPt(${gi},0.7)`);
        await t.pen('pointerdown', p1, 1, 0); await t.pen('pointermove', { x: p1.x + 2, y: p1.y }, 1);
        await t.pen('pointercancel', p1, 0, 0); await t.pen('pointerout', p1, 0, 0); await t.pen('pointerleave', p1, 0, 0);
        await t.wait(400); const t1 = await E(TIP(gi));
        await t.penHover(p1, p2, 10, 'mouse'); await t.wait(400); const t2 = await E(TIP(gi));
        await t.pen('pointerout', p2, 0, -1, 'mouse'); await t.wait(1300);
        return t1 && t2 && t1 !== t2 ? true : `${t1} / ${t2}`;
    });
    // ── A hover the browser reports oddly ──
    // Chrome 158 (Android, a Samsung tablet): the pen's moves as "pen" (pointerId 7), its
    // pointerover / pointerenter / pointerout / pointerleave as "mouse" (pointerId 1), and a
    // mousemove after each move. Firefox: the pen's hover as a mouse — pointer events typed
    // "mouse", each followed by its mouse event.
    const mag = id => E(`(()=>{ const r=el.querySelector('#${id}_0').getBoundingClientRect(); return { x: r.left+r.width/2, y: r.top+r.height/2 }; })()`);
    const big = id => E(`el.querySelector('#${id}_0').classList.contains('hec-big')`);
    // (a Chrome hover from a to c: each pen move followed by its mousemove)
    const chromeHover = async (a, c, steps = 10) => {
        for( let i = 1; i <= steps; i++ ) {
            const q = { x: a.x + (c.x - a.x) * i / steps, y: a.y + (c.y - a.y) * i / steps };
            await t.pen('pointermove', q, 0, -1, 'pen', 7); await t.mouseEv('mousemove', q); await t.wait(25);
        }
    };
    await t.step('Chrome: a magnifier entered by a "mouse", hovered by a "pen": twice as large; left by a "mouse": back to its size', async () => {
        const b = await mag('b5');
        await t.pen('pointerover', b, 0, -1, 'mouse', 1); await t.pen('pointerenter', b, 0, -1, 'mouse', 1);
        await chromeHover({ x: b.x - 3, y: b.y }, { x: b.x + 3, y: b.y }, 4);
        const on = await big('b5');
        await t.pen('pointerout', b, 0, -1, 'mouse', 1); await t.pen('pointerleave', b, 0, -1, 'mouse', 1); await t.wait(200);
        const off = await big('b5');
        return on && !off ? true : JSON.stringify({ on, off });
    });
    await t.step('Chrome: a magnifier entered by a "mouse", the "pen" gone out of range without leaving: back to its size 0.5 s after its last move', async () => {
        const b = await mag('b5');
        await t.pen('pointerover', b, 0, -1, 'mouse', 1); await t.pen('pointerenter', b, 0, -1, 'mouse', 1);
        await chromeHover({ x: b.x - 3, y: b.y }, { x: b.x + 3, y: b.y }, 4);
        await t.wait(250); const still = await big('b5');
        await t.wait(500); const after = await big('b5');
        return still && !after ? true : JSON.stringify({ still, after });
    });
    await t.step('Chrome: a magnifier the "pen" went out of range of, back to its size; the pen back in range above it (moves, no new entry): twice as large again', async () => {
        const b = await mag('b5');
        await t.pen('pointerover', b, 0, -1, 'mouse', 1); await t.pen('pointerenter', b, 0, -1, 'mouse', 1);
        await chromeHover({ x: b.x - 3, y: b.y }, { x: b.x + 3, y: b.y }, 4);
        await t.wait(1400); const gone = await big('b5');
        await chromeHover({ x: b.x + 3, y: b.y }, { x: b.x - 3, y: b.y }, 4);
        const back = await big('b5');
        await t.pen('pointerout', b, 0, -1, 'mouse', 1); await t.pen('pointerleave', b, 0, -1, 'mouse', 1); await t.wait(200);
        return !gone && back ? true : JSON.stringify({ gone, back });
    });
    await t.step('a pen held still above a magnifier (a hovering pen never is): back to its size after 0.5 s; moving again: twice as large again', async () => {
        const b = await mag('b4');
        await t.pen('pointerenter', b, 0, -1, 'pen', 7);
        await t.penHover({ x: b.x - 3, y: b.y }, { x: b.x + 3, y: b.y }, 4);
        const on = await big('b4');
        await t.wait(1300); const still = await big('b4');
        await t.penHover({ x: b.x + 3, y: b.y }, { x: b.x - 3, y: b.y }, 4); const again = await big('b4');
        await t.pen('pointerleave', b, 0, -1, 'pen', 7); await t.wait(200);
        return on && !still && again ? true : JSON.stringify({ on, still, again });
    });
    await t.step('a pen held still above a graph: its hover dot goes after 0.5 s; moving again: the dot of the value under it again', async () => {
        const p1 = await E(`pointPt(${gi},0.4)`), p2 = await E(`pointPt(${gi},0.45)`);
        const dot = () => E(`graphAt(${gi}).chart._hecHoverDot ? true : false`);
        await t.penHover({ x: p1.x - 30, y: p1.y }, p1); await t.wait(200);
        const on = await dot();
        await t.wait(1300); const still = await dot();
        await t.penHover(p1, p2); await t.wait(200); const again = await dot();
        await t.pen('pointerout', p2, 0, -1, 'pen', 7); await t.pen('pointerleave', p2, 0, -1, 'pen', 7); await t.wait(300);
        return on && !still && again ? true : JSON.stringify({ on, still, again });
    });
    await t.step('Chrome: the tooltip opened by a tap follows a "pen" hover entered by a "mouse", with its mousemoves; left by a "mouse": it closes', async () => {
        const p1 = await E(`pointPt(${gi},0.3)`), p2 = await E(`pointPt(${gi},0.7)`);
        await t.penTap(p1); await t.wait(400);
        const t1 = await E(TIP(gi));
        await t.pen('pointerover', p1, 0, -1, 'mouse', 1); await t.pen('pointerenter', p1, 0, -1, 'mouse', 1);
        await chromeHover(p1, p2); await t.wait(400);
        const t2 = await E(TIP(gi));
        await t.pen('pointerout', p2, 0, -1, 'mouse', 1); await t.pen('pointerleave', p2, 0, -1, 'mouse', 1); await t.wait(1300);
        const t3 = await E(TIP(gi));
        return t1 && t2 && t1 !== t2 && t3 === null ? true : JSON.stringify({ t1, t2, t3 });
    });
    await t.step('Firefox: a magnifier hovered by a pen reported as a mouse: twice as large; left: back to its size', async () => {
        const b = await mag('b4');
        await t.pen('pointerover', b, 0, -1, 'mouse', 0); await t.pen('pointerenter', b, 0, -1, 'mouse', 0);
        await t.pen('pointermove', b, 0, -1, 'mouse', 0); await t.mouseEv('mousemove', b);
        const on = await big('b4');
        await t.pen('pointerout', b, 0, -1, 'mouse', 0); await t.pen('pointerleave', b, 0, -1, 'mouse', 0); await t.wait(200);
        const off = await big('b4');
        return on && !off ? true : JSON.stringify({ on, off });
    });
    await t.step('Firefox: the tooltip opened by a tap follows a pen hover reported as a mouse, pointer and mouse events', async () => {
        const p1 = await E(`pointPt(${gi},0.3)`), p2 = await E(`pointPt(${gi},0.7)`);
        await t.penTap(p1); await t.wait(400);
        const t1 = await E(TIP(gi));
        for( let i = 1; i <= 10; i++ ) {
            const q = { x: p1.x + (p2.x - p1.x) * i / 10, y: p1.y + (p2.y - p1.y) * i / 10 };
            await t.pen('pointermove', q, 0, -1, 'mouse', 0); await t.mouseEv('mousemove', q); await t.wait(25);
        }
        await t.wait(400); const t2 = await E(TIP(gi));
        await t.pen('pointerout', p2, 0, -1, 'mouse', 0); await t.pen('pointerleave', p2, 0, -1, 'mouse', 0); await t.wait(1300);
        return t1 && t2 && t1 !== t2 ? true : JSON.stringify({ t1, t2 });
    });

    // A tap with the pen's button (Chrome and its web views, the Home Assistant app): no
    // contact reported at all, only a context menu, a moment later, where the pen is
    const menuOpen = () => E(`getComputedStyle(el.instance._this.querySelector('#et_0')).display !== 'none'`);
    const closeMenu = async () => { await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.wait(300); };
    await t.step('a tap with the pen\'s button on a curve label (only a context menu): its type menu, no browser menu', async () => {
        const a = await E('legendPt(0,0)');
        const prevented = await t.contextMenu(a); await t.wait(400);
        const open = await menuOpen(); const g = await t.graphs();
        await closeMenu();
        return open && prevented && !g.some(x => /\(h\)/.test(x)) ? true : JSON.stringify({ open, prevented, g });
    });
    await t.step('a tap on a curve label, then a tap with the pen\'s button on it: the curve stays hidden, its type menu', async () => {
        const a = await E('legendPt(0,0)');
        await t.penTap(a); await t.wait(800);
        const g1 = await t.graphs();
        await t.contextMenu(a); await t.wait(400);
        const open = await menuOpen(); const g2 = await t.graphs();
        await closeMenu();
        await t.penTap(a); await t.wait(800);   // (shown again for the next steps)
        return open && /\(h\)/.test(g1[0]) && g2[0] === g1[0] ? true : JSON.stringify({ open, g1, g2 });
    });
    await t.step('a long press, then the context menu a browser reports at the release: one long press only', async () => {
        const a = await E('legendPt(0,1)');
        await E(`(()=>{ window.__lp=0; const c=graphAt(0).chart; const f=c.options.customEvent; c.options.customEvent=(p)=>{ if( p.gestureType==='longpress' ) window.__lp++; return f(p); }; })()`);
        await t.pen('pointerdown', a, 1, 0); await t.wait(900); await t.pen('pointerup', a, 0, 0);
        await t.contextMenu(a); await t.wait(400);
        const n = await E('window.__lp'); const open = await menuOpen();
        await closeMenu();
        return n === 1 && open ? true : JSON.stringify({ n, open });
    });
    return t.close();
};
