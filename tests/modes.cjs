// Every gesture in every layout: a card at full width and a narrow one (under 300 px: the Y
// labels inside the plot, the controls in boxes over the legend), with a mouse and a finger,
// and look: mini — each gesture still reaching what it's for, by the picking rule
const { openCard } = require('./lib.cjs');

// (the tooltip of the curves selected — a click on one —, on this large screen too: see
// points.cjs for the other modes)
const CFG = { type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, largeScreenTooltip: 'selected',
    graphs: [
        { type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power2' }] },
        { type: 'line', entities: [{ entity: 'sensor.rain' }] },
        { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }, { entity: 'binary_sensor.b' }] }] };
const MINI = { type: 'custom:history-explorer-card', look: 'mini', defaultTimeRange: '24',
    graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power2' }] }] };

// Probes (client coordinates), added to the page
const PROBES = `
// A point on label di of graph gi — its right part: its left one may be under the controls' box
window.labelPt=(gi,di)=>{ const g=graphAt(gi), b=g.chart.legend.legendHitBoxes[di], r=g.canvas.getBoundingClientRect(); return {x:r.left+b.left+b.width*0.75, y:r.top+b.top+b.height/2}; };
// A point where graph gi's left Y axis is dragged: its label column, or the column along its labels inside the plot
window.yDragPt=(gi)=>{ const c=graphAt(gi).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect(), k=c._hecInsideLabelColumns('mouse').find(k=>k.side==='left');
    return k ? {x:r.left+k.left+4, y:r.top+A.top+(A.bottom-A.top)*0.5} : {x:r.left+A.left/2, y:r.top+A.top+(A.bottom-A.top)*0.5}; };
// A value of graph gi's first curve in the middle of the plot, the farthest from its other curves
window.valuePt=(gi)=>{ const c=graphAt(gi).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect(), n=c.data.datasets.length;
    const others=[]; for(let i=1;i<n;i++) others.push(...c.getDatasetMeta(i).data.map(p=>p._view));
    const far=v=>others.length?Math.min(...others.map(w=>Math.hypot(w.x-v.x,w.y-v.y))):99;
    const v=c.getDatasetMeta(0).data.map(p=>p._view).filter(v=>!v.skip&&v.x>A.left+(A.right-A.left)*0.3&&v.x<A.left+(A.right-A.left)*0.7&&v.y>A.top+8&&v.y<A.bottom-8)
        .sort((a,b)=>far(b)-far(a))[0]; return {x:r.left+v.x, y:r.top+v.y}; };
window.menuKind=()=>{ const m=el.querySelector('#et_0'), i=el.querySelector('#et_0_info'); return !m||m.style.display==='none' ? 'closed' : i ? 'entity' : 'graph'; };
window.tipShown=gi=>{ const e=graphAt(gi).chart.tooltip._hecHoverTooltipEl; return !!e && e.isConnected && getComputedStyle(e).display!=='none' && getComputedStyle(e).opacity!=='0'; };
`;

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    for( const touch of [false, true] ) for( const w of [1000, 168] ) {
        const t = await openCard(CFG, { touch, height: 1600, mock: { series: true }, init: PROBES });
        const E = x => t.E(x);
        await E(`(()=>{ document.body.style.width='${w}px'; document.getElementById('host').style.width='${w}px'; })()`); await t.wait(1500);
        const mode = `${touch ? 'finger' : 'mouse'}, ${w === 1000 ? 'full width' : 'narrow card'}`;
        const step = (name, fn) => t.step(`${mode}: ${name}`, fn);
        const close = async () => { await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 5); await t.wait(400); };
        const tap = p => touch ? t.tap(p).then(() => t.wait(600)) : t.page.mouse.click(p.x, p.y).then(() => t.wait(600));
        const longPress = p => touch ? t.touchLongPress(p) : t.longPress(p);
        const dragFrom = (a, c) => touch ? t.tapDrag(a, c) : t.drag(a, c);
        const double = p => touch ? t.doubleTap(p) : t.dblclick(p);
        const release = async () => { if( await E('lockOf(0)') ) { await E('graphAt(0).chart._hecToggleYAxisLock()'); await t.wait(300); } };

        await step('the padlock: a click locks, another releases', async () => {
            const p = await E('lockPt(0)'), l0 = await E('lockOf(0)');
            await tap(p); const l1 = await E('lockOf(0)'); await t.wait(500);
            await tap(p); const l2 = await E('lockOf(0)');
            return !l0 && l1 && !l2 ? true : `lock ${l0} -> ${l1} -> ${l2}`;
        });
        await step('a long-press on the handle opens the graph\'s menu', async () => {
            await longPress(await E('moPt(0)')); const m = await E('menuKind()'); await close();
            return m === 'graph' ? true : m;
        });
        await step('a long-press on a curve\'s label opens its menu', async () => {
            await longPress(await E('labelPt(0,0)')); const m = await E('menuKind()'); await close();
            return m === 'entity' ? true : m;
        });
        await step('a long-press on a timeline\'s row opens its entity\'s menu', async () => {
            await longPress(await E('tlPt(2,1)')); const m = await E('menuKind()'); await close();
            return m === 'entity' ? true : m;
        });
        await step('a drag along the Y labels moves the Y axis', async () => {
            const y0 = await E('yRange(0)'), p = await E('yDragPt(0)');
            await dragFrom(p, { x: p.x, y: p.y + 50 }); await t.wait(300);
            const y1 = await E('yRange(0)'); await release();
            return y0.join() !== y1.join() ? true : 'Y unchanged';
        });
        await step('a click on a value shows its tooltip', async () => {
            await tap(await E('valuePt(0)')); const s = await E('tipShown(0)'); await close(); await t.wait(1500);
            return s ? true : 'no tooltip';
        });
        await step('a long-press on a value shows its curve\'s points', async () => {
            const p = await E('valuePt(0)'), r0 = await E('graphAt(0).chart.data.datasets[0].pointRadius');
            await longPress(p); const r1 = await E('graphAt(0).chart.data.datasets[0].pointRadius');
            await longPress(p);
            return r1 !== r0 ? true : `radius ${r0} -> ${r1}`;
        });
        if( !touch ) await step('a hover on a value shows its dot', async () => {
            const p = await E('valuePt(0)');
            await t.page.mouse.move(p.x + 20, p.y - 15, { steps: 3 }); await t.page.mouse.move(p.x, p.y, { steps: 5 }); await t.wait(300);
            const d = await E('!!graphAt(0).chart._hecHoverDot'); await t.page.mouse.move(5, 5); await t.wait(300);
            return d ? true : 'no dot';
        });
        await step(touch ? 'a horizontal pinch zooms the time' : 'a drag on the plot moves the time', async () => {
            const t0 = await E('timeRange()'), c = await E('graphPtAt(0,0.6)');
            if( touch ) await t.pinch(c, { x: -4, y: 0 }, { x: 4, y: 0 });
            else await t.drag(c, { x: c.x + Math.min(200, w * 0.3), y: c.y });
            const t1 = await E('timeRange()');
            return t0.join() !== t1.join() ? true : 'time unchanged';
        });
        await step('a double-click on a YAML curve\'s label splits it off, a double-click on the chain icon merges it back', async () => {
            await double(await E('labelPt(0,1)'));
            const split = await t.graphs(), chain = await E('chainShown()');
            const c = await E('chainPt(1)'); if( !c ) return 'no chain icon: ' + split.join(' | ');
            await double(c);
            const merged = await t.graphs();
            return split.length === 4 && chain === '0100' && merged.length === 3 ? true : JSON.stringify({ split, chain, merged });
        });
        await step('a curve\'s label dragged onto another graph moves the curve there', async () => {
            const g0 = await t.graphs(), a = await E('labelPt(0,1)'), c = await E('graphPtAt(1,0.5)');
            await dragFrom(a, c);
            const g1 = await t.graphs();
            return /power2/.test(g1[1]) && !/power2/.test(g1[0]) ? true : JSON.stringify({ g0, g1 });
        });
        await step('the handle dragged moves the graph', async () => {
            const g0 = await t.graphs(), a = await E('moPt(2)'), c = await E('graphPtAt(0,0.2)');
            await dragFrom(a, c);
            const g1 = await t.graphs();
            return g1[0] !== g0[0] ? true : 'unchanged ' + g1.join(' | ');
        });
        await step('the saved entities agree with what is shown', async () => (await E('storeProblems()')) || true);
        done(await t.close());
    }

    // ── look: mini, full width and narrow ──
    for( const touch of [false, true] ) for( const w of [374, 168] ) {
        const t = await openCard(MINI, { touch, height: 900, mock: { series: true }, init: PROBES });
        const E = x => t.E(x);
        await E(`(()=>{ document.body.style.width='${w}px'; document.getElementById('host').style.width='${w}px'; })()`); await t.wait(1500);
        const mode = `look: mini, ${touch ? 'finger' : 'mouse'}, ${w} px`;
        const step = (name, fn) => t.step(`${mode}: ${name}`, fn);
        const close = async () => { await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 5); await t.wait(400); };
        const tap = p => touch ? t.tap(p).then(() => t.wait(600)) : t.page.mouse.click(p.x, p.y).then(() => t.wait(600));
        const longPress = p => touch ? t.touchLongPress(p) : t.longPress(p);
        await step('the padlock, a curve\'s label, the Y labels, a value: each its own gesture', async () => {
            const r = {};
            const p = await E('lockPt(0)'); await tap(p); r.locked = await E('lockOf(0)'); await tap(p); r.released = !(await E('lockOf(0)'));
            await longPress(await E('labelPt(0,0)')); r.label = await E('menuKind()'); await close();
            const y0 = await E('yRange(0)'), a = await E('yDragPt(0)');
            await ( touch ? t.tapDrag(a, { x: a.x, y: a.y + 30 }) : t.drag(a, { x: a.x, y: a.y + 30 }) ); await t.wait(300);
            r.y = (await E('yRange(0)')).join() !== y0.join();
            if( await E('lockOf(0)') ) { await E('graphAt(0).chart._hecToggleYAxisLock()'); await t.wait(300); }
            await tap(await E('valuePt(0)')); r.tip = await E('tipShown(0)'); await close();
            return r.locked && r.released && r.label === 'entity' && r.y && r.tip ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    return { passed, failed };
};
