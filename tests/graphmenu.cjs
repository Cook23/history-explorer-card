// A graph's menu — a long-press or a right click on its lock+handle zone: the display and
// interpolation of all its curves, its Y axis locked or released, merged back, cut, deleted — and cut and paste: a curve or a graph put
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

    await t.step('a long-press on a graph\'s zone opens its menu: display, interpolation, the Y axis, its layout open', async () => {
        await graphMenu('rain');
        const m = await menu();
        return m === 'rain || Display ▸ | Interpolation ▸ | Lock the Y axis | Layout ▸* || Cut' ? true : m;
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
    // A point of graph i's zone: x px from its left, y px from its top
    const zonePt = (i, x, y) => t.E(`(()=>{ const r=el.instance._allGraphsInDisplayOrder()[${i}].canvas.getBoundingClientRect(); return {x:r.left+${x}, y:r.top+${y}}; })()`);
    const clickAt = async p => { await t.page.mouse.click(p.x, p.y); await t.wait(900); };
    await t.step('just beside a button (under ↓): that button', async () => {
        await graphMenu('tank'); await click('cut');
        await clickAt(await zonePt(await gi('rain'), 9, 32));
        const l = await layout();
        return l === 'power+power_kw | a | rain | tank' ? true : l;
    });
    await t.step('about halfway between two buttons: nothing, the cut goes on', async () => {
        await graphMenu('tank'); await click('cut');
        await clickAt(await zonePt(await gi('rain'), 18, 14));
        const r = { b: await buttons(), layout: await layout() };
        return r.b.includes('cancel') && r.layout === 'power+power_kw | a | rain | tank' ? true : JSON.stringify(r);
    });
    await t.step('clearly away from the buttons, on a graph: the cut cancelled', async () => {
        await clickAt(await t.E(`graphPtAt(${await gi('rain')},0.6)`));
        const b = await buttons();
        await graphMenu('tank'); await click('cut'); await pressButton(await gi('rain'), 0);   // (back as it was)
        return b === ' |  |  | ' && (await layout()) === L0 ? true : b + ' / ' + (await layout());
    });
    const swipeOn = async (i, dy) => { const a = await buttonPt(i, 1); await t.drag(a, { x: a.x, y: a.y + dy }); await t.wait(900); };
    await t.step('a swipe up on a graph\'s buttons inserts above it, a swipe down below it', async () => {
        await graphMenu('tank'); await click('cut');
        await swipeOn(await gi('rain'), -40);
        const r = { up: await layout() };
        await graphMenu('tank'); await click('cut');
        await swipeOn(await gi('rain'), 40);
        r.down = await layout();
        return r.up === 'power+power_kw | a | tank | rain' && r.down === L0 ? true : JSON.stringify(r);
    });
    await t.step('a swipe where insertion is refused (inside the linked block): says why, the cut goes on', async () => {
        await graphMenu('tank'); await click('cut');
        await swipeOn(await gi('a'), -40);
        const r = { msg: await t.E(`el.instance.graphs[0].canvas.getRootNode()._hecMessageEl?.textContent ?? ''`), b: await buttons(), layout: await layout() };
        await t.page.keyboard.press('Escape'); await t.wait(400);
        return /separated/.test(r.msg) && r.b.includes('cancel') && r.layout === L0 ? true : JSON.stringify(r);
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

    // ── Display and Interpolation for all the curves of a graph ──
    t = await openCard(card({ graphs: [
        { type: 'line', entities: [{ entity: 'sensor.power', lineMode: 'smart' }, { entity: 'sensor.power2', lineMode: 'smart' }] },
        { type: 'line', entities: [{ entity: 'sensor.rain', lineMode: 'smart' }, { entity: 'sensor.tank', lineMode: 'lines' }] },
        { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }, { entity: 'binary_sensor.b' }] }] }), { height: 1400, mock: { series: true } });
    await t.wait(800);
    // The graphs in display order: type, then each entity with its line mode and interpolation
    const shown = () => t.E(`el.instance._allGraphsInDisplayOrder().map(g=>g.type+':'+g.entities.map(e=>e.entity.split('.')[1]+(e.lineMode?'/'+e.lineMode:'')+(e.interpolation?'/'+e.interpolation:'')).join('+')).join(' | ')`);
    // The entries of submenu key shown, the marked one(s) with *
    const subOf = key => t.E(`[...el.querySelectorAll('#et_0_${key}_sub a')].filter(a=>a.style.display!=='none').map(a=>a.textContent+(a.style.fontWeight==='bold'?'*':'')).join(' | ')`);
    const items = () => t.E(`[...el.querySelectorAll('#et_0 > a')].filter(a=>a.style.display!=='none').map(a=>a.textContent).join(' | ')`);
    const closeAll = async () => { await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 1390); await t.wait(400); };
    const pick = async (gIdx, key, id) => { await t.longPress(await t.E(`moPt(${gIdx})`)); await click(key); await click(id); };
    await t.step('Display on a graph: every type, the one all its curves share marked', async () => {
        await t.longPress(await t.E('moPt(0)')); await click('rep');
        const v = await subOf('rep'); await closeAll();
        return v === 'Smart* | Curve | Straight | Stepped | Bar | Direction | Timeline' ? true : v;
    });
    await t.step('its submenus as everywhere: over the menu, right edges aligned, level with their item, the item in bold', async () => {
        const r = [];
        for( const k of ['rep', 'interp'] ) {
            await t.longPress(await t.E('moPt(0)')); await click(k);
            r.push(await t.E(`(()=>{ const q=s=>el.querySelector(s); const m=q('#et_0').getBoundingClientRect(), i=q('#et_0_${k}').getBoundingClientRect(), s=q('#et_0_${k}_sub').getBoundingClientRect();
                const bold=[...el.querySelectorAll('#et_0 > a')].filter(a=>a.style.fontWeight==='bold').map(a=>a.id).join();
                return Math.abs(s.right-m.right)<1 && Math.abs(s.top-i.top)<1 && s.left>=m.left && bold==='et_0_${k}' ? 'ok' : JSON.stringify({ m, i, s, bold }); })()`));
            await closeAll();
        }
        return r.every(x => x === 'ok') ? true : r.join(' ; ');
    });
    await t.step('curves drawn differently: none marked', async () => {
        await t.longPress(await t.E('moPt(1)')); await click('rep');
        const v = await subOf('rep'); await closeAll();
        return !v.includes('*') ? true : v;
    });
    await t.step('Straight: every curve of the graph straight, in its graph, saved with each', async () => {
        await pick(0, 'rep', '0');
        const r = { shown: await shown(), saved: await t.E(`['sensor.power','sensor.power2'].map(id=>el.instance.store.entry(id).lineMode).join()`) };
        return r.shown.startsWith('line:power/lines+power2/lines | ') && r.saved === 'lines,lines' ? true : JSON.stringify(r);
    });
    await t.step('Bar: one bar graph of them, in its place', async () => {
        await pick(0, 'rep', '3');
        const v = await shown();
        return /^bar:power[^+|]*\+power2[^|]* \| line:rain/.test(v) ? true : v;
    });
    await t.step('Timeline: one timeline of them, in its place', async () => {
        await pick(0, 'rep', '5');
        const v = await shown();
        return /^timeline:power[^+|]*\+power2[^|]* \| line:rain/.test(v) ? true : v;
    });
    await t.step('Smart again: one graph of curves again', async () => {
        await pick(0, 'rep', '6');
        const v = await shown();
        return /^line:power\/smart\+power2\/smart \| line:rain/.test(v) ? true : v;
    });
    await t.step('Interpolation on a graph: applied to its interpolated curves only, then marked', async () => {
        await pick(1, 'interp', 'algo_steffen');
        const v = await shown();
        await t.longPress(await t.E('moPt(1)')); await click('interp');
        const m = await subOf('interp'); await closeAll();
        return / \| line:rain\/smart\/steffen\+tank\/lines \| /.test(v) && m.includes('Steffen*') ? true : v + ' ; ' + m;
    });
    await t.step('a graph of states: no Display, no Interpolation', async () => {
        await t.longPress(await t.E('moPt(2)'));
        const v = await items(); await closeAll();
        return !/Display|Interpolation/.test(v) ? true : v;
    });
    done(await t.close());

    // ── The menu's title: the graph's title, else the start of its curves' names ──
    const METEO = 'Météo-France forecast for city Villeveyrac - Languedoc-Roussillon (34) - FR Villeveyrac Temperature';
    t = await openCard(card({ graphs: [
        { type: 'line', title: 'Outside', entities: [{ entity: 'sensor.power' }] },
        { type: 'line', entities: [{ entity: 'sensor.rain', name: METEO }, { entity: 'sensor.tank', name: METEO + ' (Filtered)' },
            { entity: 'sensor.power_kw', name: 'GW2000A-WIFI7FFF Température extérieure (Filtered)' }] },
        { type: 'line', entities: [{ entity: 'sensor.power2', name: 'Salon' }, { entity: 'sensor.watering_cycle', name: 'Cuisine sud' }] }] }), { height: 1200, mock: { series: true } });
    await t.wait(800);
    const title = async i => { await t.longPress(await t.E(`moPt(${i})`)); const v = await t.E(`el.querySelector('#et_0_title').textContent`);
        await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 1190); await t.wait(400); return v; };
    await t.step('the menu\'s title: the graph\'s title when it has one', async () => {
        const v = await title(0); return v === 'Outside' ? true : v;
    });
    await t.step('else the first two words of each curve\'s name, \'...\' when cut, each start once', async () => {
        const v = await title(1); return v === 'Météo-France forecast..., GW2000A-WIFI7FFF Température...' ? true : v;
    });
    await t.step('short names whole', async () => {
        const v = await title(2); return v === 'Salon, Cuisine sud' ? true : v;
    });
    done(await t.close());

    // ── Touch: a long-press on the zone opens the graph's menu ──
    t = await openCard(card({ graphs: GRAPHS }), { touch: true, height: 1600, scrollRoom: 1500, mock: { series: true } });
    await t.wait(800);
    await t.step('touch: a long-press on a graph\'s zone opens its menu', async () => {
        await t.touchLongPress(await t.E(`moPt(${await gi('tank')})`));
        const m = await menu();
        return m.startsWith('tank || ') ? true : m;
    });
    await t.step('touch: cut a graph, a swipe up on another graph\'s buttons inserts it above (the page doesn\'t scroll)', async () => {
        await click('cut');
        const a = await buttonPt(await gi('rain'), 1);
        await t.swipe(a, { x: a.x, y: a.y - 60 });
        const r = { layout: await layout(), y: await t.scrollY() };
        return r.layout === 'power+power_kw | a | tank | rain' && r.y === 0 ? true : JSON.stringify(r);
    });
    done(await t.close());

    return { passed, failed };
};
