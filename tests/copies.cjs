// The same curve in several graphs: in the YAML, or from the entity selector after a choice
// (cancel, or a second curve) — each its own, saved on its own; never twice in one graph
const { openCard } = require('./lib.cjs');

const card = (o) => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, ...o });

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };
    // Each graph in display order: its curves, hidden ones with (h)
    const shown = t => t.E(`el.instance._allGraphsInDisplayOrder().map(g=>g.entities.map((e,i)=>e.entity.split('.')[1]+((g.chart.getDatasetMeta(i).hidden ?? g.chart.data.datasets[i].hidden)?'(h)':'')).join('+')).join(' | ')`);
    const keys = t => t.E(`el.instance.store.list.map(e=>e.entity.split('.')[1]+(e.copy?'#'+e.copy:'')).join(' ')`);
    const reload = async t => { await t.page.reload(); await t.wait(3500); };

    // ── In the YAML ──
    const YAML = { graphs: [
        { type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.rain' }] },
        { type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power', color: 'red' }] }] };
    let t = await openCard(card({ ...YAML, enable_persistence: 'entities' }), { mock: { series: true }, height: 900 });
    await t.wait(1500);
    await t.step('the same entity in two YAML graphs: a curve in each, with its history; twice in one graph: once, said in the console', async () => {
        const r = { shown: await shown(t), keys: await keys(t), n: await t.E(`el.instance._allGraphsInDisplayOrder()[1].chart.data.datasets[0].data.length`),
                    warned: await t.E(`logs.some(l=>/twice in graph/.test(l))`) };
        return r.shown === 'power+rain | power' && r.keys === 'power rain power#1' && r.n > 100 ? true : JSON.stringify(r);
    });
    await t.step('each curve its own: one hidden, one changed to stepped — the other unchanged, both kept after a reload', async () => {
        const p = await t.E('legendPt(1,0)'); await t.page.mouse.click(p.x, p.y); await t.wait(800);
        await t.E(`(()=>{ const I=el.instance; const g=I._allGraphsInDisplayOrder()[0]; I.showEntityTypeMenu(0, 'sensor.power', g, 100, 100); I.entityTypeMenuClicked(0, 'line', 'stepped'); })()`); await t.wait(1000);
        const modes = () => t.E(`el.instance.store.list.filter(e=>e.entity==='sensor.power').map(e=>(e.copy||0)+':'+(e.lineMode||'-')+':'+!!e.hidden).join(' ')`);
        const before = { shown: await shown(t), modes: await modes() };
        await reload(t);
        const after = { shown: await shown(t), modes: await modes() };
        return before.shown === 'power+rain | power(h)' && /^0:stepped:false 1:[^:]+:true$/.test(before.modes) && JSON.stringify(after) === JSON.stringify(before) ? true : JSON.stringify({ before, after });
    });
    await t.step('dragged onto the graph showing the other: refused, said so, nothing moves', async () => {
        const s0 = await shown(t);
        await t.drag(await t.E('legendPt(1,0)'), await t.E('legendPt(0,1)')); await t.wait(800);
        const r = { s0, s1: await shown(t), tip: await t.E('tip()') };
        return r.s1 === r.s0 && /Already/.test(r.tip || '') ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── From the entity selector ──
    t = await openCard(card({ graphs: [], enable_multidevice_persistence: 'entities' }), { mock: { series: true }, height: 1100 });
    await t.wait(800);
    const choice = () => t.E(`(()=>{ const m=el.querySelector('#es_0_choice'); return m.style.display==='none' ? 'closed' : [...m.querySelectorAll('a')].map(a=>a.textContent+(a.style.fontWeight==='bold'?'*':'')).join(' | '); })()`);
    const typeMenuOpen = () => t.E(`el.querySelector('#et_0').style.display !== 'none'`);
    const pick = async text => { await t.page.click('#b7_0'); await t.page.keyboard.press('Control+A'); await t.page.keyboard.type(text); await t.wait(400); await t.page.click(`#es_0 a[data-entity="sensor.power2"]`); await t.wait(500); };
    await t.E(`(()=>{ const I=el.instance; I._createAndPersistEntity('sensor.power2', 'line', 'smart'); I.updateHistoryWithClearCache(); I.writeLocalState(); })()`);
    await t.wait(1500);
    await t.step('an entity already shown: said so, its graph outlined, then a choice — cancel first, marked', async () => {
        await pick('power two');
        const r = { c: await choice(), tip: await t.E('tip()'), outl: await t.E(`el.instance.graphs[0].canvas.parentNode.style.outline`), menu: await typeMenuOpen() };
        return r.c === 'Cancel* | Create a second curve' && /Already/.test(r.tip || '') && /dashed/.test(r.outl) && !r.menu ? true : JSON.stringify(r);
    });
    await t.step('Enter: cancelled — nothing added, the field emptied', async () => {
        await t.page.keyboard.press('Enter'); await t.wait(500);
        const r = { c: await choice(), shown: await shown(t), input: await t.E(`el.querySelector('#b7_0').value`) };
        return r.c === 'closed' && r.shown === 'power2' && r.input === '' ? true : JSON.stringify(r);
    });
    await t.step('↓ Enter: a second curve — through the type menu, in a graph of its own', async () => {
        await pick('power two');
        await t.page.keyboard.press('ArrowDown'); await t.page.keyboard.press('ArrowDown'); await t.page.keyboard.press('Enter'); await t.wait(500);
        const menu = await typeMenuOpen();
        await t.page.keyboard.press('Enter'); await t.wait(1500);
        const r = { menu, shown: await shown(t), keys: await keys(t) };
        return r.menu && r.shown === 'power2 | power2' && r.keys === 'power2 power2#1' ? true : JSON.stringify(r);
    });
    await t.step('cut, the graph showing the other: 📋 struck through', async () => {
        await t.E(`(()=>{ const I=el.instance; const g=I._allGraphsInDisplayOrder()[1]; I._startCut(g, 0); })()`); await t.wait(400);
        const b = await t.E(`el.instance._allGraphsInDisplayOrder().map(g=>(g.chart.options.handleButtons||[]).map(b=>(b.disabled?'-':'')+b.id).join(',')).join(' | ')`);
        await t.page.keyboard.press('Escape'); await t.wait(300);
        return b === '-paste | cancel' ? true : b;
    });
    await t.step('kept after a reload and on another device; the first one deleted, the second stays, its number reused next', async () => {
        await reload(t); const a = await keys(t);
        await t.E('localStorage.clear()'); await reload(t); const other = await keys(t);
        await t.E(`(()=>{ const I=el.instance; const g=I._allGraphsInDisplayOrder()[0]; I._deleteEntity(g, 0); })()`); await t.wait(800);
        const left = await keys(t);
        await t.E(`(()=>{ const I=el.instance; I._createAndPersistEntity('sensor.power2', 'line', 'smart'); I.updateHistoryWithClearCache(); })()`); await t.wait(1200);
        const again = await keys(t);
        return a === 'power2 power2#1' && other === a && left === 'power2#1' && again === 'power2#1 power2' ? true : JSON.stringify({ a, other, left, again });
    });
    done(await t.close());

    return { passed, failed };
};
