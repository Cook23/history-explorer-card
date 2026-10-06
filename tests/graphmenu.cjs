// A graph's menu — a long-press or a right click on its lock+handle zone: its Y axis locked
// or released, merged back, cut, deleted — and cut and paste: a curve or a graph put
// elsewhere from the menus, as a drag would, the graphs' zones showing where it can go
const { openCard } = require('./lib.cjs');

const card = (o) => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, ...o });
// A block of two linked graphs (a line, its timeline), then two graphs
const GRAPHS = [
    { type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power_kw' }, { entity: 'binary_sensor.a', type: 'timeline' }] },
    { type: 'line', entities: [{ entity: 'sensor.rain' }] },
    { type: 'line', entities: [{ entity: 'sensor.tank' }] },
];

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    let t = await openCard(card({ graphs: GRAPHS }), { height: 1600, mock: { series: true } });
    await t.wait(800);
    // The graphs in display order, each its entities
    const layout = () => t.E(`el.instance._allGraphsInDisplayOrder().map(g=>g.entities.map(e=>e.entity.split('.')[1]).join('+')).join(' | ')`);
    const gi = name => t.E(`el.instance._allGraphsInDisplayOrder().findIndex(g=>g.entities.some(e=>e.entity.split('.')[1]==='${name}'))`);
    // The menu: its title, its items shown (* in bold), the items of its open submenu
    const menu = () => t.E(`(()=>{ const shown=a=>a.style.display!=='none';
        const items=[...el.querySelectorAll('#et_0 > a')].filter(shown).map(a=>a.textContent+(a.style.fontWeight==='bold'?'*':''));
        const sub=[...el.querySelectorAll('[id^="et_0_"][id$="_sub"]')].find(s=>s.style.display!=='none');
        return el.querySelector('#et_0').style.display==='none' ? 'closed' :
            el.querySelector('#et_0_title').textContent+' || '+items.join(' | ')+' || '+(sub?[...sub.querySelectorAll('a')].filter(shown).map(a=>a.textContent).join(' | '):''); })()`);
    const click = id => t.E(`el.querySelector('#et_0_${id}').click()`).then(() => t.wait(500));
    // The buttons of each graph's zone, in display order (- disabled)
    const buttons = () => t.E(`el.instance._allGraphsInDisplayOrder().map(g=>(g.chart.options.handleButtons||[]).map(b=>(b.disabled?'-':'')+b.id).join(',')).join(' | ')`);
    // Where button k of graph i's zone is
    const buttonPt = (i, k) => t.E(`(()=>{ const g=el.instance._allGraphsInDisplayOrder()[${i}]; const n=g.chart.options.handleButtons.length; const w=Math.max(33,n*18)/n;
        const r=g.canvas.getBoundingClientRect(); return {x:r.left+w*(${k}+0.5), y:r.top+14}; })()`);
    const pressButton = async (i, k) => { const p = await buttonPt(i, k); await t.page.mouse.click(p.x, p.y); await t.wait(900); };
    const graphMenu = async name => { await t.longPress(await t.E(`moPt(${await gi(name)})`)); };
    const L0 = 'power+power_kw | a | rain | tank';

    await t.step('a long-press on a graph\'s zone opens its menu: the Y axis, its layout open', async () => {
        await graphMenu('rain');
        const m = await menu();
        return m === 'rain || Lock the Y axis | Layout ▸* || Cut' ? true : m;
    });
    await t.step('Lock the Y axis: locked; the menu then offers to unlock it, which releases it', async () => {
        await click('ylock');
        const r = { locked: await t.E(`lockOf(${await gi('rain')})`) };
        await graphMenu('rain'); r.menu = await menu(); await click('ylock');
        r.released = await t.E(`lockOf(${await gi('rain')})`);
        return r.locked === 1 && r.menu.includes('Unlock the Y axis') && r.released === 0 ? true : JSON.stringify(r);
    });
    await t.step('a right click on the zone opens the same menu', async () => {
        await t.contextMenu(await t.E(`moPt(${await gi('tank')})`)); await t.wait(500);
        const m = await menu(); await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 1590); await t.wait(400);
        return m.startsWith('tank || ') ? true : m;
    });
    await t.step('cut a graph: ✂ where it was; ↓ 📋 ↑ on the others, struck through inside the linked block', async () => {
        await graphMenu('tank'); await click('cut');
        const b = await buttons();
        return b === '-below,clipboard,above | below,clipboard,-above | below,clipboard,above | cancel' ? true : b;
    });
    await t.step('a struck-through button says why, and the cut goes on', async () => {
        await pressButton(0, 0);
        const r = { msg: await t.E(`el.instance.graphs[0].canvas.getRootNode()._hecMessageEl?.textContent ?? ''`), b: await buttons() };
        return /separated/.test(r.msg) && r.b.includes('cancel') ? true : JSON.stringify(r);
    });
    await t.step('↑ on another graph: the cut one inserted above it, the zones back to normal', async () => {
        await pressButton(await gi('rain'), 2);
        const r = { layout: await layout(), b: await buttons() };
        return r.layout === 'power+power_kw | a | tank | rain' && r.b === ' |  |  | ' ? true : JSON.stringify(r);
    });
    await t.step('↓ under the linked block: the graph inserted below it', async () => {
        await graphMenu('rain'); await click('cut');
        await pressButton(await gi('a'), 0);
        const l = await layout();
        return l === 'power+power_kw | a | rain | tank' ? true : l;
    });
    await t.step('a click outside the graphs cancels the cut, Escape too, ✂ too', async () => {
        await graphMenu('tank'); await click('cut');
        await t.page.mouse.click(5, 1590); await t.wait(400);
        const r = { outside: await buttons() };
        await graphMenu('tank'); await click('cut');
        await t.page.keyboard.press('Escape'); await t.wait(400);
        r.escape = await buttons();
        await graphMenu('tank'); await click('cut');
        await pressButton(await gi('tank'), 0);
        r.scissors = await buttons(); r.layout = await layout();
        return [r.outside, r.escape, r.scissors].every(b => b === ' |  |  | ') && r.layout === L0 ? true : JSON.stringify(r);
    });
    await t.step('cut a curve (its type menu, Layout): 📋 on the graphs it can go to, struck through on a timeline', async () => {
        await t.longPress(await t.E(`legendPt(${await gi('rain')},0)`));
        await click('layout'); await click('cut');
        const b = await buttons();
        return b === 'paste | -paste | cancel | paste' ? true : b;
    });
    await t.step('📋 on a graph: the curve moved there, at the end of its legend', async () => {
        await pressButton(0, 0);
        const l = await layout();
        return l === 'power+power_kw+rain | a | tank' ? true : l;
    });
    await t.step('a graph added from the card: its menu can delete it', async () => {
        await t.E(`(()=>{ const I=el.instance; const d=I._detectDefaultType('sensor.wind_rad'); I._createAndPersistEntity('sensor.wind_rad', d.type, d.lineMode); I.updateHistoryWithClearCache(); })()`);
        await t.wait(1200);
        await graphMenu('wind_rad');
        const m = await menu(); await click('gdelete');
        const r = { m, layout: await layout(), stored: await t.E(`el.instance.store.has('sensor.wind_rad')`) };
        return r.m.endsWith('Cut | Delete the graph') && !r.layout.includes('wind_rad') && !r.stored ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── Touch: a long-press on the zone opens the graph's menu ──
    t = await openCard(card({ graphs: GRAPHS }), { touch: true, height: 1600, mock: { series: true } });
    await t.wait(800);
    await t.step('touch: a long-press on a graph\'s zone opens its menu', async () => {
        await t.touchLongPress(await t.E(`moPt(${await gi('tank')})`));
        const m = await menu();
        return m.startsWith('tank || ') ? true : m;
    });
    done(await t.close());

    return { passed, failed };
};
