// Interactions with a pen: its tip as a finger, its barrel button as a mouse's right button,
// and the tooltip opened by a contact, then moved by hovering above the screen
const { openCard } = require('./lib.cjs');

const CFG = { type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false },
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
    return t.close();
};
