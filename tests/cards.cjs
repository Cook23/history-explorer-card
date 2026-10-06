// Two cards on one page, the entity type menu, an entity added twice, graphs added from the UI
const { openCard } = require('./lib.cjs');

const card = (graphs) => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, graphs });

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    // ── Two cards: a drag never reaches the other card ──
    let t = await openCard(card([{ type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power_kw' }] }]));
    await t.page.evaluate(c => {
        const e2 = document.createElement('history-explorer-card'); e2.setConfig(c);
        document.getElementById('host').appendChild(e2); e2.hass = mkHass(); window.el2 = e2;
    }, { ...card([{ type: 'line', entities: [{ entity: 'sensor.rain' }] }]), cardName: 'second' + Date.now() });
    await t.wait(2200);
    await t.step('a curve dragged onto another card\'s graph never reaches that card', async () => {
        await t.E(`(()=>{ window.__seen=0; const c=el2.instance.graphs[0].chart; const o=c.options.customEvent;
            c.options.customEvent=function(i){ if(i.gestureType==='dragovergraph') __seen++; return o.apply(this,arguments); };
            window.__outl=[]; const w=el2.instance.graphs[0].canvas.parentNode;
            new MutationObserver(()=>{ if(w.style.outline) __outl.push(w.style.outline); }).observe(w,{attributes:true,attributeFilter:['style']}); })()`);
        const a = await t.E('legendPt(0,1)');
        const r = await t.E('el2.instance.graphs[0].canvas.getBoundingClientRect().toJSON()');
        await t.drag(a, { x: r.x + r.width / 2, y: r.y + r.height / 2 }, 16);
        const seen = await t.E('__seen'); const outl = await t.E('__outl');
        const g1 = await t.graphs(); const e2 = await t.E(`el2.instance.graphs.map(g=>g.entities.map(e=>e.entity)).join('|')`);
        return seen === 0 && outl.length === 0 && g1.join() === 'l:power+power_kw@0' && e2 === 'sensor.rain' ? true : JSON.stringify({ seen, outl, g1, e2 });
    });
    done(await t.close());

    // ── The type menu offers what fits the entity, its current type marked ──
    t = await openCard(card([{ type: 'line', entities: [{ entity: 'sensor.power', lineMode: 'smart' }] }, { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }] }]), { height: 900 });
    // The entries shown in the menu (the marked one with *)
    const menu = `[...el.querySelectorAll('#et_0 a')].filter(a=>a.style.display!=='none').map(a=>a.textContent.trim()+(a.style.fontWeight==='bold'?'*':'')).join(' | ')`;
    const closeMenu = async () => { await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 880); await t.wait(300); };
    await t.step('type menu of a numeric curve: Interpolation, every type (smart marked), Delete', async () => {
        await t.longPress(await t.E('legendPt(0,0)'));
        const m = await t.E(menu);
        await closeMenu();
        return m === 'Interpolation ▸ | Smart* | Curve | Straight | Stepped | Bar | Direction | Timeline | Delete' ? true : m;
    });
    await t.step('type menu of a binary sensor: timeline only, Delete', async () => {
        await t.longPress(await t.E('tlPt(1,0)'));
        const m = await t.E(menu);
        await closeMenu();
        return m === 'Timeline* | Delete' ? true : m;
    });
    done(await t.close());

    // ── Adding an entity already shown: a message, and that graph outlined for a moment ──
    t = await openCard(card([{ type: 'line', entities: [{ entity: 'sensor.power' }] }, { type: 'line', entities: [{ entity: 'sensor.rain' }] }]), { height: 900 });
    const outlines = () => t.E(`el.instance._allGraphsInDisplayOrder().map(g=>g.canvas.parentNode.style.outline||'-').join(' / ')`);
    await t.step('adding an entity already shown says so and outlines its graph, cleared soon after', async () => {
        await t.E(`(()=>{ const f=el.instance.ui.inputField[0]; f.value='sensor.rain'; f.dataset.entityId='sensor.rain'; el.instance.addEntitySelected(0); })()`);
        await t.wait(300);
        const msg = await t.E('tip()'); const o1 = await outlines();
        await t.wait(2200); const o2 = await outlines();
        return /sensor\.rain/.test(msg || '') && /^- \/ 2px dashed/.test(o1) && o2 === '- / -' ? true : JSON.stringify({ msg, o1, o2 });
    });
    done(await t.close());

    // ── Graphs added from the UI: split, move a curve across groups, delete ──
    t = await openCard({ ...card([]), combineSameUnits: true }, { height: 1200 });
    const add = id => t.E(`(()=>{ const I=el.instance; const d=I._detectDefaultType('${id}'); I._createAndPersistEntity('${id}', d.type, d.lineMode); I.updateHistoryWithClearCache(); I.writeLocalState(); })()`);
    const check = async () => (await t.E('storeProblems()')) || true;
    await t.step('entities added from the UI: combined by unit, persisted in display order', async () => {
        for( const id of ['sensor.power', 'sensor.power_kw', 'sensor.rain', 'binary_sensor.a', 'binary_sensor.b'] ) { await add(id); await t.wait(300); }
        await t.wait(800);
        const g = await t.graphs();
        return g.length === 3 && /power\+power_kw/.test(g[0]) ? (await check()) : g.join(' | ');
    });
    await t.step('double-click a curve label takes it into a graph of its own, in a new group', async () => {
        await t.dblclick(await t.E('legendPt(0,1)'));
        const g = await t.graphs();
        return g.length === 4 && /^l:power_kw@/.test(g[1]) && g[0].split('@')[1] !== g[1].split('@')[1] ? (await check()) : g.join(' | ');
    });
    await t.step('dragged onto the rain graph below (another unit): refused, nothing moves', async () => {
        const g0 = await t.graphs();
        await t.drag(await t.E('legendPt(1,0)'), await t.E('graphPtAt(2,0.15)'));
        const g = await t.graphs();
        return g.join() === g0.join() ? (await check()) : g0.join(' | ') + ' -> ' + g.join(' | ');
    });
    await t.step('then onto the power graph above: merged with it', async () => {
        const n = await t.E('graphAt(1).chart.data.datasets.findIndex(d=>d.entity_id===\'sensor.power_kw\')');
        const a = await t.E(`legendPt(1,${n})`); const c = await t.E('legendPt(0,0)');
        await t.drag(a, { x: c.x + 30, y: c.y });
        const g = await t.graphs();
        return g.length === 3 && /power\+power_kw|power_kw\+power/.test(g[0]) ? (await check()) : g.join(' | ');
    });
    await t.step('a timeline row moved to its own graph, then dropped back', async () => {
        const i = (await t.graphs()).findIndex(x => x.startsWith('t:'));
        await t.dblclick(await t.E(`tlPt(${i},1)`));
        const g1 = await t.graphs();
        if( g1.length !== 4 ) return 'not split: ' + g1.join(' | ');
        const a = await t.E(`tlPt(${i + 1},0)`); const c = await t.E(`tlPt(${i},0)`);
        await t.page.mouse.dblclick(a.x, a.y); await t.wait(100);
        await t.drag(a, { x: c.x, y: c.y + 4 });
        const g2 = await t.graphs();
        return g2.length === 3 && /t:(a\+b|b\+a)/.test(g2.join()) ? (await check()) : g2.join(' | ');
    });
    await t.step('the type menu\'s delete removes the entity for good', async () => {
        await t.longPress(await t.E('legendPt(0,0)'));
        await t.E(`el.querySelector('#et_0_delete').click()`); await t.wait(600);
        const g = await t.graphs();
        const gone = !g.some(x => /(^l:|\+)power(\+|@|\[)/.test(x)) && !(await t.E(`el.instance.pconfig.entities.some(e=>(e.entity??e)==='sensor.power')`));
        return g.length === 3 && gone ? (await check()) : g.join(' | ');
    });
    done(await t.close());

    // ── A curve dropped on a graph of another group, below it: graphs stay in place ──
    t = await openCard({ ...card([]), combineSameUnits: true }, { height: 1200 });
    const add2 = id => t.E(`(()=>{ const I=el.instance; const d=I._detectDefaultType('${id}'); I._createAndPersistEntity('${id}', d.type, d.lineMode); I.updateHistoryWithClearCache(); I.writeLocalState(); })()`);
    await t.step('a curve dropped on the graph split off below its own: the graphs keep their order', async () => {
        for( const id of ['sensor.power', 'sensor.power_kw', 'sensor.power2', 'sensor.rain'] ) { await add2(id); await t.wait(300); }
        await t.wait(800);
        await t.dblclick(await t.E('legendPt(0,2)'));
        const g0 = await t.graphs();
        if( g0.length !== 3 ) return 'not split: ' + g0.join(' | ');
        const a = await t.E('legendPt(0,0)'); const c = await t.E('legendPt(1,0)');
        await t.drag(a, { x: c.x + 30, y: c.y });
        const g1 = await t.graphs();
        return /^l:power_kw@/.test(g1[0]) && /power2\+power@/.test(g1[1]) ? ((await t.E('storeProblems()')) || true) : g1.join(' | ');
    });
    done(await t.close());

    return { passed, failed };
};
