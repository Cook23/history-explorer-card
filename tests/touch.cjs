// Interactions with fingers (CDP touch: touch-action and native scrolling apply)
const { openCard, spanHours } = require('./lib.cjs');

const CFG = { type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false },
    graphs: [
        { type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power_kw' }, { entity: 'sensor.rain' }] },
        { type: 'line', entities: [{ entity: 'sensor.watering_cycle' }] },
        { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }, { entity: 'binary_sensor.b' }] },
        { type: 'line', entities: [{ entity: 'sensor.days_to_watering' }] }] };

module.exports = async function()
{
    const t = await openCard(CFG, { touch: true, height: 1300, scrollRoom: 2500 });
    const E = x => t.E(x);
    const step = (name, fn) => t.step(name, async () => { await t.scrollTop(); return fn(); });
    const lineGraph = async () => (await t.graphs()).findIndex(x => x.startsWith('l:'));

    // A vertical swipe starting on any interactive zone still scrolls the page
    const swipeScrolls = (name, ptExpr, probe) => step(name, async () => {
        const v0 = await probe(); const a = await E(ptExpr);
        await t.swipe(a, { x: a.x, y: a.y - 250 });
        const y = await t.scrollY(); const v1 = await probe();
        return y > 50 && v0 === v1 ? true : `scrollY=${y} ${v0} -> ${v1}`;
    });
    const order = async () => (await t.graphs()).join(' | ');
    await swipeScrolls('swipe up on a curve label scrolls the page, moves nothing', 'legendPt(0,1)', order);
    await swipeScrolls('swipe up on the Y axis scrolls the page, Y scale unchanged', 'yaPt(0,0.7)', async () => (await E('yRange(0)')).join());
    await swipeScrolls('swipe up on the move handle scrolls the page, order unchanged', 'moPt(1)', order);
    await swipeScrolls('swipe up on a timeline label scrolls the page, order unchanged', 'tlPt(2,1)', order);

    await step('tap a curve label hides it, tap again shows it', async () => {
        const a = await E('legendPt(0,1)');
        await t.tap(a); await t.wait(800); const g1 = (await t.graphs())[0];
        await t.wait(500);
        await t.tap(a); await t.wait(800); const g2 = (await t.graphs())[0];
        return /power_kw\(h\)/.test(g1) && !/\(h\)/.test(g2) ? true : `${g1} / ${g2}`;
    });
    await step('tap then drag a curve label reorders it, never split, page not scrolled', async () => {
        const g0 = await t.graphs(); const a = await E('legendPt(0,0)'); const c = await E('legendPt(0,2)');
        await t.tapDrag(a, { x: c.x + 5, y: c.y });
        const y = await t.scrollY(); const g1 = await t.graphs();
        // same graphs, the first one's curves only reordered (a double-tap would split one off)
        const same = (x, z) => [x, z].map(v => v.replace(/^.:|@.*$/g, '').split('+').sort().join()).reduce((p, q) => p === q);
        return g1.length === g0.length && g1[0] !== g0[0] && same(g1[0], g0[0]) && y === 0 ? true : `scrollY=${y} ${g0.join(' | ')} -> ${g1.join(' | ')}`;
    });
    await step('tap then drag a timeline label of a YAML graph: moved, never split', async () => {
        const n0 = (await t.graphs()).length; const i = (await t.graphs()).findIndex(x => x.startsWith('t:'));
        const s0 = (await t.graphs())[i]; const a = await E(`tlPt(${i},0)`); const c = await E(`tlPt(${i},1)`);
        await t.tapDrag(a, { x: c.x, y: c.y + 10 });
        const g1 = await t.graphs();
        return g1.length === n0 && g1[i] !== s0 ? true : `${s0} -> ${g1.join(' | ')}`;
    });
    await step('tap then drag on the Y axis pans the Y scale, page not scrolled', async () => {
        const r0 = await E('yRange(1)'); const a = await E('yaPt(1,0.5)');
        await t.tapDrag(a, { x: a.x, y: a.y + 60 });
        const y = await t.scrollY(); const r1 = await E('yRange(1)');
        return r0.join() !== r1.join() && y === 0 ? true : `scrollY=${y} y ${r0} -> ${r1}`;
    });
    await step('tap then drag the move handle reorders graphs', async () => {
        const g0 = await t.graphs();
        await t.tapDrag(await E('moPt(3)'), await E('graphPtAt(0,0.2)'));
        const g1 = await t.graphs();
        return g1[0] !== g0[0] ? true : g1.join(' | ');
    });
    await step('tap then drag a timeline label reorders entities', async () => {
        const i = (await t.graphs()).findIndex(x => x.startsWith('t:'));
        const s0 = (await t.graphs())[i]; const a = await E(`tlPt(${i},1)`); const c = await E(`tlPt(${i},0)`);
        await t.tapDrag(a, { x: c.x, y: c.y - 10 });
        const s1 = (await t.graphs()).find(x => x.startsWith('t:'));
        return s1 !== s0 ? true : `${s0} -> ${s1}`;
    });
    await step('double-tap a YAML curve label splits it into a linked graph, every curve still shown', async () => {
        const g0 = await t.graphs(); const gi = g0.findIndex(x => /power/.test(x));
        await t.doubleTap(await E(`legendPt(${gi},0)`));
        const g1 = await t.graphs();
        return g1.length === g0.length + 1 && !g1.some(x => /\(h\)/.test(x)) ? true : `${g0.join(' | ')} -> ${g1.join(' | ')}`;
    });
    await step('double-tap the chain icon merges the linked graphs', async () => {
        const c = await E('chainShown()'); const gi = c.indexOf('1');
        if( gi < 0 ) return 'no chain icon: ' + c;
        const n0 = (await t.graphs()).length;
        await t.doubleTap(await E(`chainPt(${gi})`));
        const n1 = (await t.graphs()).length;
        return n1 === n0 - 1 ? true : `graphs ${n0} -> ${n1}`;
    });
    await step('long-press a curve label opens the type menu', async () => {
        await t.touchLongPress(await E(`legendPt(${await lineGraph()},0)`));
        const open = await E('menuOpen()');
        await t.page.keyboard.press('Escape'); await t.tap({ x: 5, y: 5 }); await t.wait(400);
        return open ? true : 'menu not open';
    });
    await step('one-finger horizontal drag on the plot pans the time range', async () => {
        const t0 = await E('timeRange()'); const a = await E('graphPtAt(0,0.7)');
        await t.touch('touchStart', [a]); await t.wait(40); await t.touchMove(a, { x: a.x + 200, y: a.y }); await t.touch('touchEnd', []); await t.wait(900);
        const t1 = await E('timeRange()');
        return t0[0] !== t1[0] ? true : 'unchanged';
    });
    await step('two-finger vertical pinch zooms the Y axis, page not scrolled', async () => {
        const li = await lineGraph(); const r0 = await E(`yRange(${li})`);
        await t.pinch(await E(`graphPtAt(${li},0.6)`), { x: 0, y: -6 }, { x: 0, y: 6 }, 10);
        const r1 = await E(`yRange(${li})`); const y = await t.scrollY();
        return r0.join() !== r1.join() && y === 0 ? true : `y ${r0} -> ${r1} scrollY=${y}`;
    });
    await step('pinch: fingers apart horizontally zoom the time in (by zoom steps)', async () => {
        const t0 = await E('timeRange()');
        await t.pinch(await E(`graphPtAt(${await lineGraph()},0.6)`), { x: -10, y: 0 }, { x: 10, y: 0 });
        const t1 = await E('timeRange()');
        return spanHours(t1) < spanHours(t0) && (await t.scrollY()) === 0 ? true : `${spanHours(t0)}h -> ${spanHours(t1)}h`;
    });
    await step('pinch: fingers together horizontally zoom the time out', async () => {
        const t0 = await E('timeRange()');
        await t.pinch(await E(`graphPtAt(${await lineGraph()},0.6)`), { x: 4, y: 0 }, { x: -4, y: 0 }, 10);
        const t1 = await E('timeRange()');
        return spanHours(t1) > spanHours(t0) ? true : `${spanHours(t0)}h -> ${spanHours(t1)}h`;
    });
    await step('pinch: two fingers moving right pan the time (same span)', async () => {
        const t0 = await E('timeRange()');
        await t.pinch(await E(`graphPtAt(${await lineGraph()},0.6)`), { x: 12, y: 0 }, { x: 12, y: 0 });
        const t1 = await E('timeRange()');
        return Date.parse(t1[0]) < Date.parse(t0[0]) && Math.abs(spanHours(t1) - spanHours(t0)) < 0.01 ? true : `${t0.join(' / ')} -> ${t1.join(' / ')}`;
    });
    await step('pinch: two fingers moving down pan the Y axis (content follows), page not scrolled', async () => {
        const li = await lineGraph(); const r0 = await E(`yRange(${li})`);
        await t.pinch(await E(`graphPtAt(${li},0.5)`), { x: 0, y: 4 }, { x: 0, y: 4 }, 8);
        const r1 = await E(`yRange(${li})`);
        return r1[0] > r0[0] && r1[1] > r0[1] && (await t.scrollY()) === 0 ? true : `y ${r0} -> ${r1} scrollY=${await t.scrollY()}`;
    });
    await step('entity selector: tapping an entry of the list opens the type menu for it', async () => {
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
