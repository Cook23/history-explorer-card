// Interactions with a mouse
const { openCard } = require('./lib.cjs');

const CFG = { type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false },
    graphs: [
        { type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power_kw' }, { entity: 'sensor.rain' }] },
        { type: 'line', entities: [{ entity: 'sensor.watering_cycle' }] },
        { type: 'timeline', entities: [{ entity: 'binary_sensor.a', name: 'front door of the garden shed near the pool' }, { entity: 'binary_sensor.b' }] }] };

module.exports = async function()
{
    const t = await openCard(CFG, { mock: { series: true } });
    const E = x => t.E(x);

    // The hover tooltip of graph 0: its text while shown, else null
    const tip = () => E(`(()=>{ const el=graphAt(0).chart.tooltip._hecHoverTooltipEl; return el && el.isConnected && getComputedStyle(el).display!=='none' && getComputedStyle(el).opacity!=='0' ? el.textContent : null; })()`);
    await t.step('hover alone opens no tooltip', async () => {
        const pt = await E('graphPtAt(0,0.6)');
        // (moved the way a mouse does: in small steps)
        await t.page.mouse.move(pt.x - 200, pt.y); await t.page.mouse.move(pt.x, pt.y, { steps: 10 }); await t.wait(600);
        const t1 = await tip();
        return t1 === null ? true : 'tooltip: ' + t1;
    });
    await t.step('a click on the curves opens the tooltip, with the values under the pointer; hovering moves it', async () => {
        const p1 = await E('pointPt(0,0.3)'), p2 = await E('pointPt(0,0.7)');
        await t.page.mouse.click(p1.x, p1.y); await t.wait(500);
        const t1 = await tip();
        await t.page.mouse.move(p2.x, p2.y, { steps: 15 }); await t.wait(500);
        const t2 = await tip();
        return /power|rain/.test(t1 || '') && t2 && t1 !== t2 ? true : `${t1} / ${t2}`;
    });
    await t.step('leaving the curves closes it; back over them, nothing until the next click', async () => {
        const pt = await E('graphPtAt(0,0.6)'); const y = await E('yaPt(0,0.6)');
        await t.page.mouse.move(y.x, y.y, { steps: 15 }); await t.wait(1300);   // (closes with a fade)
        const t1 = await tip();
        await t.page.mouse.move(pt.x, pt.y, { steps: 15 }); await t.wait(500);
        const t2 = await tip();
        return t1 === null && t2 === null ? true : `${t1} / ${t2}`;
    });
    await t.step('picking a label: on it, just beside it; none clearly beside, halfway between two, or on the curves', async () => {
        const r = await E(`(()=>{ const c=graphAt(0).chart; const b=c.legend.legendHitBoxes; const at=(x,y)=>c._hecLegendIndexAt(x,y);
            const a0=b[0], a1=b[1], gap=a1.left-(a0.left+a0.width), my=a0.top+a0.height/2;
            return [at(a0.left+3,my), at(a0.left+a0.width+2,my), at(a1.left-2,my), at(a0.left+a0.width+gap/2,my), at(a0.left-40,my),
                    at(a0.left+3, c.chartArea.top+3), gap].join(); })()`);
        // on 0, beside 0, beside 1, halfway: none, far: none, on the curves under it: none (then the gap)
        return /^0,0,1,-1,-1,-1,/.test(r) ? true : r;
    });
        await t.step('legend click hides then shows a curve', async () => {
        const pt = await E('legendPt(0,1)');
        await t.page.mouse.click(pt.x, pt.y); await t.wait(700); const a = (await t.graphs())[0];
        await t.wait(500);
        await t.page.mouse.click(pt.x, pt.y); await t.wait(700); const c = (await t.graphs())[0];
        return a.includes('power_kw(h)') && !c.includes('(h)') ? true : `${a} / ${c}`;
    });
    await t.step('pan drag on the plot moves the time range', async () => {
        const t0 = await E('timeRange()'); const pt = await E('graphPtAt(0,0.6)');
        await t.drag(pt, { x: pt.x + 200, y: pt.y });
        const t1 = await E('timeRange()');
        return t0[0] !== t1[0] ? true : 'range unchanged';
    });
    await t.step('padlock zone click toggles the Y lock', async () => {
        const pt = await E('lockPt(0)'); const l0 = await E('lockOf(0)');
        await t.page.mouse.click(pt.x, pt.y); await t.wait(600); const l1 = await E('lockOf(0)');
        await t.page.mouse.click(pt.x + 200, pt.y + 300); await t.wait(600);
        await t.page.mouse.click(pt.x, pt.y); await t.wait(600); const l2 = await E('lockOf(0)');
        return !l0 && l1 && !l2 ? true : `lock ${l0} -> ${l1} -> ${l2}`;
    });
    await t.step('Y axis drag pans the Y scale', async () => {
        const y0 = await E('yRange(1)'); const pt = await E('yaPt(1,0.5)');
        await t.drag(pt, { x: pt.x, y: pt.y + 60 });
        const y1 = await E('yRange(1)');
        return y0.join() !== y1.join() ? true : 'Y scale unchanged';
    });
    await t.step('ctrl+wheel zooms the time range, never the page (every tick blocked)', async () => {
        await E(`window.__wh=[]; document.addEventListener('wheel',e=>__wh.push(e.defaultPrevented),{passive:true})`);
        const t0 = await E('timeRange()'); const pt = await E('graphPtAt(0,0.6)');
        await t.page.mouse.move(pt.x, pt.y); await t.page.keyboard.down('Control');
        for( let i = 0; i < 4; i++ ) { await t.page.mouse.wheel(0, -100); await t.wait(40); }
        await t.page.keyboard.up('Control'); await t.wait(800);
        const t1 = await E('timeRange()'); const wh = await E('__wh');
        return t0.join() !== t1.join() && wh.length === 4 && wh.every(x => x) ? true : `range ${t0.join() === t1.join() ? 'unchanged' : 'changed'}, prevented ${JSON.stringify(wh)}`;
    });
    await t.step('double-click a YAML curve label splits it into a linked graph', async () => {
        await t.dblclick(await E('legendPt(0,2)'));
        const g = await t.graphs();
        return g.length === 4 && /rain/.test(g[1]) && g[0].split('@')[1] === g[1].split('@')[1] ? true : g.join(' | ');
    });
    await t.step('the chain icon is shown on the split (lower) graph only', async () => {
        const c = await E('chainShown()');
        return c === '0100' ? true : 'chain flags ' + c;
    });
    await t.step('double-click the chain icon merges the two graphs', async () => {
        await t.dblclick(await E('chainPt(1)'));
        const g = await t.graphs();
        return g.length === 3 && /rain/.test(g[0]) && (await E('chainShown()')) === '000' ? true : g.join(' | ');
    });
    await t.step('split again, then drag the split label back onto its YAML graph merges it', async () => {
        await t.dblclick(await E('legendPt(0,2)'));
        if( (await t.graphs()).length !== 4 ) return 'not split';
        const a = await E('legendPt(1,0)'); const c = await E('legendPt(0,0)');
        await t.drag(a, { x: c.x + 30, y: c.y });
        const g = await t.graphs();
        return g.length === 3 && /rain/.test(g[0]) ? true : g.join(' | ');
    });
    await t.step('drag a curve onto an unrelated graph of another unit is refused, with a message', async () => {
        const a = await E('legendPt(0,0)'); const c = await E('graphPtAt(1,0.1)');
        await t.drag(a, c);
        const g = await t.graphs(); const tip = await E('tip()');
        return /power/.test(g[0]) && !/power/.test(g[1]) && tip ? true : g.join(' | ') + ' message=' + tip;
    });
    await t.step('click a truncated timeline label shows its full name', async () => {
        const i = (await t.graphs()).findIndex(x => x.startsWith('t:'));
        const a = await E(`tlPt(${i},0)`);
        await t.page.mouse.click(a.x, a.y); await t.wait(500);
        const tip = await E('tip()');
        return /garden shed near the pool/.test(tip || '') ? true : 'message=' + tip;
    });
    await t.step('reorder curve labels within a graph (time range untouched)', async () => {
        const g0 = await t.graphs(); const t0 = await E('timeRange()');
        const a = await E('legendPt(0,0)'); const c = await E('legendPt(0,2)');
        await t.drag(a, { x: c.x + 40, y: c.y });
        const g1 = await t.graphs(); const t1 = await E('timeRange()');
        return g1[0] !== g0[0] && t0.join() === t1.join() ? true : 'order ' + g1[0] + ' time ' + (t0.join() === t1.join() ? 'same' : 'moved');
    });
    await t.step('timeline label drag reorders entities', async () => {
        const g0 = await t.graphs(); const a = await E('tlPt(2,1)'); const c = await E('tlPt(2,0)');
        await t.drag(a, { x: c.x, y: c.y - 10 });
        const g1 = await t.graphs();
        return g1[2] !== g0[2] ? true : 'unchanged ' + g1[2];
    });
    await t.step('move handle drag reorders graphs', async () => {
        const g0 = await t.graphs(); const a = await E('moPt(2)'); const c = await E('graphPtAt(0,0.2)');
        await t.drag(a, c);
        const g1 = await t.graphs();
        return g1[0] !== g0[0] ? true : 'unchanged ' + g1.join(' | ');
    });
    await t.step('long-press a curve label opens the type menu', async () => {
        const li = (await t.graphs()).findIndex(x => x.startsWith('l:'));
        await t.longPress(await E(`legendPt(${li},0)`));
        const open = await E('menuOpen()');
        await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 5); await t.wait(400);
        return open ? true : 'menu not open';
    });
    await t.step('zoom mode: a drag over the plot selects a span, the range shrinks, the mode ends', async () => {
        await E('el.instance.toggleZoom()');
        const li = (await t.graphs()).findIndex(x => x.startsWith('l:'));
        const r0 = (await t.state()).range; const a = await E(`graphPtAt(${li},0.6)`);
        await t.drag({ x: a.x - 150, y: a.y }, { x: a.x + 50, y: a.y });
        const r1 = (await t.state()).range;
        const mode = await E('el.instance.state.zoomMode');
        const tooltips = await E(`el.instance._allGraphsInDisplayOrder()[${li}].chart.options.tooltips.enabled`);
        return r1[0] < r0[0] && mode === false && tooltips === true ? true : JSON.stringify({ r0, r1, mode, tooltips });
    });
    await t.step('the persisted entities agree with what is shown', async () => (await E('storeProblems()')) || true);
    return t.close();
};
