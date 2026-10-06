// Interactions with fingers (CDP touch: touch-action and native scrolling apply)
const { openCard } = require('./lib.cjs');

const CFG = { type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false },
    graphs: [
        { type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power_kw' }, { entity: 'sensor.rain' }] },
        { type: 'line', entities: [{ entity: 'sensor.watering_cycle' }] },
        { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }, { entity: 'binary_sensor.b' }] },
        { type: 'line', entities: [{ entity: 'sensor.days_to_watering' }] }] };

module.exports = async function()
{
    const t = await openCard(CFG, { touch: true, height: 1300 });
    const E = x => t.E(x);
    const lineGraph = async () => (await t.graphs()).findIndex(x => x.startsWith('l:'));
    // (the curves of a graph, whatever their order)
    const curves = x => x.replace(/^.:|@.*$/g, '').split('+').sort().join();

    await t.step('tap a curve label hides it, tap again shows it', async () => {
        const a = await E('legendPt(0,1)');
        await t.tap(a); await t.wait(800); const g1 = (await t.graphs())[0];
        await t.wait(500);
        await t.tap(a); await t.wait(800); const g2 = (await t.graphs())[0];
        return /power_kw\(h\)/.test(g1) && !/\(h\)/.test(g2) ? true : `${g1} / ${g2}`;
    });
    await t.step('drag a curve label reorders it, never split', async () => {
        const g0 = await t.graphs(); const a = await E('legendPt(0,0)'); const c = await E('legendPt(0,2)');
        await t.touchDrag(a, { x: c.x + 5, y: c.y });
        const g1 = await t.graphs();
        return g1.length === g0.length && g1[0] !== g0[0] && curves(g1[0]) === curves(g0[0]) ? true : `${g0.join(' | ')} -> ${g1.join(' | ')}`;
    });
    await t.step('Y axis pressed half a second, then dragged: the Y scale pans', async () => {
        const r0 = await E('yRange(1)'); const a = await E('yaPt(1,0.5)');
        await t.touchDrag(a, { x: a.x, y: a.y + 60 }, 700);
        const r1 = await E('yRange(1)');
        return r0.join() !== r1.join() ? true : `y ${r0} -> ${r1}`;
    });
    await t.step('drag the move handle reorders graphs', async () => {
        const g0 = await t.graphs();
        await t.touchDrag(await E('moPt(3)'), await E('graphPtAt(0,0.2)'));
        const g1 = await t.graphs();
        return g1[0] !== g0[0] ? true : g1.join(' | ');
    });
    await t.step('drag a timeline label reorders entities', async () => {
        const i = (await t.graphs()).findIndex(x => x.startsWith('t:'));
        const s0 = (await t.graphs())[i]; const a = await E(`tlPt(${i},1)`); const c = await E(`tlPt(${i},0)`);
        await t.touchDrag(a, { x: c.x, y: c.y - 10 });
        const s1 = (await t.graphs()).find(x => x.startsWith('t:'));
        return s1 !== s0 ? true : `${s0} -> ${s1}`;
    });
    await t.step('double-tap a YAML curve label splits it into a linked graph, every curve still shown', async () => {
        const g0 = await t.graphs(); const gi = g0.findIndex(x => /power/.test(x));
        await t.doubleTap(await E(`legendPt(${gi},0)`));
        const g1 = await t.graphs();
        return g1.length === g0.length + 1 && !g1.some(x => /\(h\)/.test(x)) ? true : `${g0.join(' | ')} -> ${g1.join(' | ')}`;
    });
    await t.step('double-tap the chain icon merges the linked graphs', async () => {
        const c = await E('chainShown()'); const gi = c.indexOf('1');
        if( gi < 0 ) return 'no chain icon: ' + c;
        const n0 = (await t.graphs()).length;
        await t.doubleTap(await E(`chainPt(${gi})`));
        const n1 = (await t.graphs()).length;
        return n1 === n0 - 1 ? true : `graphs ${n0} -> ${n1}`;
    });
    await t.step('long-press a curve label opens the type menu', async () => {
        await t.touchLongPress(await E(`legendPt(${await lineGraph()},0)`));
        const open = await E('menuOpen()');
        await t.page.keyboard.press('Escape'); await t.tap({ x: 5, y: 5 }); await t.wait(400);
        return open ? true : 'menu not open';
    });
    await t.step('one-finger horizontal drag on the plot pans the time range', async () => {
        const t0 = await E('timeRange()'); const a = await E('graphPtAt(0,0.7)');
        await t.touchDrag(a, { x: a.x + 200, y: a.y });
        const t1 = await E('timeRange()');
        return t0[0] !== t1[0] ? true : 'unchanged';
    });
    await t.step('two-finger vertical pinch zooms the Y axis', async () => {
        const li = await lineGraph(); const r0 = await E(`yRange(${li})`);
        await t.pinch(await E(`graphPtAt(${li},0.6)`), { x: 0, y: -6 }, { x: 0, y: 6 }, 10);
        const r1 = await E(`yRange(${li})`);
        return r0.join() !== r1.join() ? true : `y ${r0} -> ${r1}`;
    });
    await t.step('entity selector: tapping an entry of the list opens the type menu for it', async () => {
        const inp = await E(`(()=>{ const r=el.querySelector('#b7_0').getBoundingClientRect(); return {x:r.left+20,y:r.top+r.height/2}; })()`);
        await t.tap(inp); await t.wait(400);
        await t.page.keyboard.type('energy'); await t.wait(500);
        const pt = await E(`(()=>{ const a=el.querySelector('#es_0 a[data-entity="sensor.energy"]'); if(!a||a.style.display==='none') return null; const r=a.getBoundingClientRect(); return {x:r.left+10,y:r.top+r.height/2}; })()`);
        if( !pt ) return 'entry not listed';
        await t.tap(pt); await t.wait(600);
        const open = await E('menuOpen()');
        await t.page.keyboard.press('Escape'); await t.tap({ x: 5, y: 5 }); await t.wait(300);
        return open ? true : 'type menu not open';
    });
    await t.step('the persisted entities agree with what is shown', async () => (await E('storeProblems()')) || true);
    return t.close();
};
