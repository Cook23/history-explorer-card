// Interactions with a mouse
const { openCard } = require('./lib.cjs');

// (the tooltip of the curves selected — a click on one —, on this large screen too: see
// points.cjs for the other modes)
const CFG = { type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, largeScreenTooltip: 'selected',
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
    await t.step('a press on the curves opens nothing until released; a drag from them opens none', async () => {
        const mode = () => E('graphAt(0).chart._hecTooltipMode');
        const p = await E('pointPt(0,0.5)');
        await t.page.mouse.move(p.x, p.y); await t.page.mouse.down(); await t.wait(300);
        const pressed = { tip: await tip(), mode: await mode() };
        await t.page.mouse.move(p.x - 120, p.y, { steps: 10 }); await t.page.mouse.up(); await t.wait(600);
        const dragged = { tip: await tip(), mode: await mode() };
        return pressed.tip === null && !pressed.mode && dragged.tip === null && !dragged.mode ? true : JSON.stringify({ pressed, dragged });
    });
    await t.step('left still, the tooltip stays its reading time (1 s, plus 0.5 s a word), then fades out with the highlighted point', async () => {
        const p1 = await E('pointPt(0,0.4)');
        await t.page.mouse.click(p1.x, p1.y); await t.wait(300);
        // (the graph redrawn once the tooltip goes: without it, the point stays on screen)
        const r0 = await E(`(()=>{ const c=graphAt(0).chart; window.__draws=0; const d=c.draw; c.draw=function(){ window.__draws++; return d.apply(c, arguments); };
            return { text: c.tooltip._hecHoverTooltipEl.textContent }; })()`);
        const ms = await E(`graphAt(0).chart.constructor.hecUi.readingTime(${JSON.stringify(r0.text)})`);
        await t.wait(ms - 800);
        const shown = await tip();
        await t.wait(800 + 1000 + 500);
        const r1 = await E(`(()=>{ const c=graphAt(0).chart; return { active: c.active.length, draws: __draws }; })()`);
        const gone = await tip();
        return ms >= 3000 && shown && gone === null && r1.active === 0 && r1.draws > 0 ? true : JSON.stringify({ ms, shown, gone, r0, r1 });
    });
    await t.step('picking a label: on it, just beside it; none clearly beside, halfway between two, or on the curves', async () => {
        const r = await E(`(()=>{ const c=graphAt(0).chart; const b=c.legend.legendHitBoxes; const at=(x,y)=>c._hecLegendIndexAt(x,y);
            const a0=b[0], a1=b[1], gap=a1.left-(a0.left+a0.width), my=a0.top+a0.height/2;
            return [at(a0.left+3,my), at(a0.left+a0.width+2,my), at(a1.left-2,my), at(a0.left+a0.width+gap/2,my), at(a0.left-40,my),
                    at(a0.left+3, c.chartArea.top+3), gap].join(); })()`);
        // on 0, beside 0, beside 1, halfway: none, far: none, on the curves under it: none (then the gap)
        return /^0,0,1,-1,-1,-1,/.test(r) ? true : r;
    });
        await t.step('right click on a curve label: its type menu, the curve not hidden, no browser menu', async () => {
        const pt = await E('legendPt(0,1)');
        await E(`window.__ctxShown=0; document.addEventListener('contextmenu', e => { if( !e.defaultPrevented ) window.__ctxShown++; }, { once: true })`);
        await t.page.mouse.click(pt.x, pt.y, { button: 'right' }); await t.wait(500);
        const open = await E(`getComputedStyle(el.instance._this.querySelector('#et_0')).display !== 'none'`);
        const g = (await t.graphs())[0]; const shown = await E('window.__ctxShown');
        await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 5); await t.wait(400);
        return open && !/\(h\)/.test(g) && shown === 0 ? true : JSON.stringify({ open, g, shown });
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
    await t.step('drag a curve onto another YAML graph, of another unit: it moves there; dragged back, back in place', async () => {
        const g0 = await t.graphs();
        const a = await E('legendPt(0,0)'); const c = await E('graphPtAt(1,0.1)');
        await t.drag(a, c);
        const g1 = await t.graphs();
        const n = await E('graphAt(1).chart.data.datasets.length');
        const b = await E(`legendPt(1,${n - 1})`); const d = await E('legendPt(0,0)');
        await t.drag(b, { x: d.x - 30, y: d.y });
        const g2 = await t.graphs();
        const names = x => x.replace(/^.:|@.*$/g, '').split('+');
        const name = names(g0[0])[0];
        return !names(g1[0]).includes(name) && names(g1[1]).includes(name) && g2.join() === g0.join() ? true : JSON.stringify({ g0, g1, g2 });
    });
    await t.step('click a truncated timeline label shows its full name, in place', async () => {
        const i = (await t.graphs()).findIndex(x => x.startsWith('t:'));
        const a = await E(`tlPt(${i},0)`);
        await t.page.mouse.click(a.x, a.y); await t.wait(500);
        const tip = await E('reveal()');
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
    await t.step('zoom mode (the magnifier): a drag over the plot, any way, draws the elastic box — the range shrinks, the mode ends', async () => {
        await E('el.instance.toggleZoom()');
        const li = (await t.graphs()).findIndex(x => x.startsWith('l:'));
        const r0 = (await t.state()).range; const a = await E(`graphPtAt(${li},0.6)`);
        await t.drag({ x: a.x - 150, y: a.y }, { x: a.x + 50, y: a.y });
        const r1 = (await t.state()).range;
        const mode = await E('el.instance.state.zoomMode');
        const tooltips = await E(`el.instance.graphsInDisplayOrder()[${li}].chart.options.tooltips.enabled`);
        return r1[0] < r0[0] && mode === false && tooltips === true ? true : JSON.stringify({ r0, r1, mode, tooltips });
    });
    // ── The elastic box: a mouse's or a pen's drag mostly vertical over the plot ──
    const boxGraph = async () => (await t.graphs()).findIndex(x => x.startsWith('l:'));
    const span = r => r[1] - r[0];
    const unlock = gi => E(`graphAt(${gi}).chart.hecSetYAxisLocked(false)`);
    // (the pointer's moves, step by step, with what is drawn halfway — the box's overlay)
    const manualDrag = async (a, c, mid, steps = 14) => {
        const m = t.page.mouse; await m.move(a.x, a.y); await m.down(); let seen;
        for( let i = 1; i <= steps; i++ ) { await m.move(a.x + (c.x - a.x) * i / steps, a.y + (c.y - a.y) * i / steps); if( i === steps >> 1 && mid ) seen = await mid(); await t.wait(15); }
        await m.up(); await t.wait(900); return seen;
    };
    await t.step('a mouse drag mostly vertical over the plot: an elastic box drawn as it goes, the magnifier lit up; released, the time zoomed to it (a round duration around its middle), the Y axis to its values, locked; the magnifier left off', async () => {
        const li = await boxGraph(); await unlock(li);
        const win = () => E('[+new Date(el.instance.startTime), +new Date(el.instance.endTime)]');
        const r0 = await win(), y0 = await E(`yRange(${li})`), a = await E(`graphPtAt(${li},0.4)`);
        const box = await manualDrag({ x: a.x - 40, y: a.y - 40 }, { x: a.x + 40, y: a.y + 60 }, () => E(`!!graphAt(${li}).chart._hecZoomSelectionEl && el.instance.state.zoomMode`));
        const r1 = await win(), y1 = await E(`yRange(${li})`), locked = await E(`!!graphAt(${li}).chart._hecYAxisLock`);
        const gone = await E(`!graphAt(${li}).chart._hecZoomSelectionEl`), mode = await E('el.instance.state.zoomMode');
        await unlock(li);
        await E('el.instance.decZoom()'); await E('el.instance.decZoom()'); await E('el.instance.decZoom()'); await t.wait(600);
        return box && gone && !mode && span(r1) < span(r0) && span(y1) < span(y0) && y1[0] >= y0[0] && y1[1] <= y0[1] && locked ? true : JSON.stringify({ box, gone, mode, r0, r1, y0, y1, locked });
    });
    await t.step('a mouse drag mostly horizontal: the time panned as ever, no box, the Y axis as it was', async () => {
        const li = await boxGraph();
        const win = () => E('[+new Date(el.instance.startTime), +new Date(el.instance.endTime)]');
        const w0 = await win(), y0 = await E(`yRange(${li})`), a = await E(`graphPtAt(${li},0.5)`);
        const box = await manualDrag({ x: a.x, y: a.y }, { x: a.x - 120, y: a.y + 20 }, () => E(`!!graphAt(${li}).chart._hecZoomSelectionEl`));
        const w1 = await win(), y1 = await E(`yRange(${li})`), locked = await E(`!!graphAt(${li}).chart._hecYAxisLock`);
        return !box && w1[0] !== w0[0] && Math.abs(span(w1) - span(w0)) < 2000 && y1.join() === y0.join() && !locked ? true : JSON.stringify({ box, w0, w1, y0, y1, locked });
    });
    await t.step('a tall, narrow box (narrower than the precision): the Y axis zoomed, the time as it was', async () => {
        const li = await boxGraph(); await unlock(li);
        const r0 = (await t.state()).range, y0 = await E(`yRange(${li})`), a = await E(`graphPtAt(${li},0.4)`);
        await manualDrag({ x: a.x, y: a.y - 30 }, { x: a.x + 3, y: a.y + 50 });
        const r1 = (await t.state()).range, y1 = await E(`yRange(${li})`);
        await unlock(li);
        return r1.join() === r0.join() && span(y1) < span(y0) ? true : JSON.stringify({ r0, r1, y0, y1 });
    });
    await t.step('a box the plot area\'s whole height: the time zoomed, the Y axis as it was, the padlock open (a box hardly smaller than the plot area that way leaves it)', async () => {
        const li = await boxGraph(); await unlock(li);
        const win = () => E('[+new Date(el.instance.startTime), +new Date(el.instance.endTime)]');
        const w0 = await win(), y0 = await E(`yRange(${li})`);
        const r = await E(`(()=>{ const c=graphAt(${li}).chart, a=c.chartArea, cr=c.canvas.getBoundingClientRect(); return { x: cr.left+(a.left+a.right)/2, top: cr.top+a.top+1, bottom: cr.top+a.bottom-1 }; })()`);
        await manualDrag({ x: r.x - 40, y: r.top }, { x: r.x + 40, y: r.bottom });
        const w1 = await win(), y1 = await E(`yRange(${li})`), locked = await E(`!!graphAt(${li}).chart._hecYAxisLock`);
        await E('el.instance.decZoom()'); await E('el.instance.decZoom()'); await E('el.instance.decZoom()'); await t.wait(600);
        return span(w1) < span(w0) && y1.join() === y0.join() && !locked ? true : JSON.stringify({ w0, w1, y0, y1, locked });
    });
    await t.step('Escape during the box: nothing applied, the box gone', async () => {
        const li = await boxGraph();
        const r0 = (await t.state()).range, y0 = await E(`yRange(${li})`), a = await E(`graphPtAt(${li},0.4)`);
        await manualDrag({ x: a.x - 40, y: a.y - 40 }, { x: a.x + 40, y: a.y + 60 }, () => t.page.keyboard.press('Escape'));
        const r1 = (await t.state()).range, y1 = await E(`yRange(${li})`), gone = await E(`!graphAt(${li}).chart._hecZoomSelectionEl`);
        return r1.join() === r0.join() && y1.join() === y0.join() && gone ? true : JSON.stringify({ r0, r1, y0, y1, gone });
    });
    await t.step('a pen\'s drag mostly vertical: no box — the page\'s (a pen\'s vertical move scrolls it, as a finger\'s)', async () => {
        const li = await boxGraph(); await unlock(li);
        const y0 = await E(`yRange(${li})`), a = await E(`graphPtAt(${li},0.4)`);
        await t.penDrag({ x: a.x - 20, y: a.y - 30 }, { x: a.x + 20, y: a.y + 60 }); await t.wait(900);
        const y1 = await E(`yRange(${li})`), locked = await E(`!!graphAt(${li}).chart._hecYAxisLock`), on = await E('el.instance.state.zoomMode');
        await unlock(li);
        return y1.join() === y0.join() && !locked && !on ? true : JSON.stringify({ y0, y1, locked, on });
    });
    // ── The magnifier: green while on; off at the end of any gesture on a graph (which goes
    // on as usual), a press outside the graphs, Escape, or a click on it again ──
    const zoomOn = () => E('el.instance.state.zoomMode');
    const glass = () => E(`el.querySelector('#bz_0 path').getAttribute('fill')`);
    await t.step('the magnifier: green while on, in the text\'s color while off; a click on it again turns it off', async () => {
        const off0 = await glass(); await t.page.click('#bz_0'); await t.wait(300);
        const on = await zoomOn(), green = await glass(); await t.page.click('#bz_0'); await t.wait(300);
        const off = !(await zoomOn()), off1 = await glass();
        return /primary-text-color/.test(off0) && on && /success-color/.test(green) && off && off1 === off0 ? true : JSON.stringify({ off0, on, green, off, off1 });
    });
    await t.step('the magnifier on: a click on a legend label turns it off and shows/hides its curve as usual', async () => {
        const li = await boxGraph(); await t.page.click('#bz_0'); await t.wait(300);
        const hidden = () => E(`graphAt(${li}).chart.getDatasetMeta(0).hidden === true || !graphAt(${li}).chart.isDatasetVisible(0)`);
        const h0 = await hidden(); const p = await E(`legendPt(${li},0)`);
        await t.page.mouse.click(p.x, p.y); await t.wait(700);
        const off = !(await zoomOn()), h1 = await hidden();
        if( h1 !== h0 ) { await t.page.mouse.click(p.x, p.y); await t.wait(700); }
        return off && h1 !== h0 ? true : JSON.stringify({ off, h0, h1 });
    });
    await t.step('the magnifier on: a press outside the graphs turns it off; Escape too', async () => {
        await t.page.click('#bz_0'); await t.wait(300);
        await t.page.mouse.click(3, 3); await t.wait(300); const a = !(await zoomOn());
        await t.page.click('#bz_0'); await t.wait(300);
        await t.page.keyboard.press('Escape'); await t.wait(300); const b = !(await zoomOn());
        return a && b ? true : JSON.stringify({ outside: a, escape: b });
    });
    await t.step('a narrow card (the handle over the plot area): a vertical drag on the handle moves its graph — the object first, never the box', async () => {
        const width = w => E(`(()=>{ document.body.style.width='${w}px'; document.getElementById('host').style.width='${w}px'; })()`);
        await width(260); await t.wait(1200);
        const g0 = await t.graphs(), li = g0.findIndex(x => x.startsWith('l:'));
        // (a line graph's legend hidden: its plot area from the top, under the handle)
        const gi = g0.findIndex((x, i) => i > 0 && x.startsWith('l:'));
        await E(`(()=>{ const c=graphAt(${gi}).chart; c.options.legend.display=false; c.update(); })()`); await t.wait(400);
        const r = await E(`(()=>{ const c=graphAt(${gi}).chart, b=c._hecLockAndHandleRect(), cr=c.canvas.getBoundingClientRect(); return { x: cr.left+b.x+b.width/2, y: cr.top+b.y+b.height/2, over: b.x+b.width > c.chartArea.left && b.y+b.height > c.chartArea.top }; })()`);
        const c = await E('graphPtAt(0,0.2)');
        await t.drag(r, { x: r.x, y: c.y });
        const g1 = await t.graphs(), box = await E('el.instance.state.zoomMode'), locked = await E(`!!graphAt(${li}).chart._hecYAxisLock`);
        await E(`(()=>{ for( const g of el.instance.graphs ) { g.chart.options.legend.display=true; g.chart.update(); } })()`);
        await width(1000); await t.wait(1200);
        return r.over && g1.join() !== g0.join() && !box && !locked ? true : JSON.stringify({ over: r.over, g0, g1, box, locked });
    });
    await t.step('the Y axis locked at the range shown (round bounds): its first and last labels kept', async () => {
        const li = await boxGraph(); await unlock(li);
        const labels = () => E(`graphAt(${li}).chart.scales['y-axis-0'].ticks.map(String)`);
        const l0 = await labels(); const p = await E(`lockPt(${li})`);
        await t.page.mouse.click(p.x, p.y); await t.wait(500);
        const l1 = await labels(), locked = await E(`!!graphAt(${li}).chart._hecYAxisLock`);
        await unlock(li);
        return locked && l1[0].trim() !== '' && l1[l1.length - 1].trim() !== '' && l1.join() === l0.join() ? true : JSON.stringify({ l0, l1, locked });
    });
    await t.step('Alt held while moving over a graph shows every sample, moving without it hides them', async () => {
        const li = (await t.graphs()).findIndex(x => x.startsWith('l:'));
        const shown = () => E(`graphAt(${li}).chart.getDatasetMeta(0).data.filter(p=>p._model.radius>0).length`);
        const n0 = await shown(); const a = await E(`graphPtAt(${li},0.5)`);
        await t.page.mouse.move(a.x, a.y); await t.page.keyboard.down('Alt');
        await t.page.mouse.move(a.x + 20, a.y); await t.wait(200); const n1 = await shown();
        await t.page.keyboard.up('Alt'); await t.page.mouse.move(a.x + 40, a.y); await t.wait(200); const n2 = await shown();
        const total = await E(`graphAt(${li}).chart.getDatasetMeta(0).data.length`);
        // (at most the point under the pointer shown before and after: its hover style)
        return n0 <= 1 && n1 > total / 2 && n2 <= 1 ? true : JSON.stringify({ n0, n1, n2, total });
    });
    await t.step('Alt held with the tooltip open: the samples shown, the tooltip on the one point under the pointer', async () => {
        const li = (await t.graphs()).findIndex(x => x.startsWith('l:'));
        const a = await E(`pointPt(${li},0.5)`);
        await t.page.mouse.click(a.x, a.y); await t.wait(300);
        await t.page.keyboard.down('Alt'); await t.page.mouse.move(a.x + 25, a.y, { steps: 5 }); await t.wait(300);
        const r = await E(`(()=>{ const c=graphAt(${li}).chart, el=c.tooltip._hecHoverTooltipEl;
            return { active: c.active.length, rows: el && el.isConnected ? [...el.children].filter(x=>x.textContent).length : 0, dots: c.getDatasetMeta(0).data.filter(p=>p._model.radius>0).length }; })()`);
        await t.page.keyboard.up('Alt'); await t.page.mouse.move(a.x + 40, a.y); await t.wait(200);
        await t.page.mouse.move(5, 5); await t.wait(1500);
        // (one point: the time and its value)
        return r.active === 1 && r.rows === 2 && r.dots > 10 ? true : JSON.stringify(r);
    });
    await t.step('Shift + drag on a graph moves it both ways: the time and the Y axis', async () => {
        const li = (await t.graphs()).findIndex(x => x.startsWith('l:'));
        const st = async () => [await E('el.instance.startTime'), await E(`yRange(${li})`)];
        const s0 = await st(); const c = await E(`graphPtAt(${li},0.5)`);
        await t.page.keyboard.down('Shift'); await t.drag(c, { x: c.x - 150, y: c.y + 50 }); await t.page.keyboard.up('Shift'); await t.wait(1200);
        const s1 = await st();
        const p = await E(`lockPt(${li})`); await t.page.mouse.click(p.x, p.y); await t.wait(400);   // (the Y axis released)
        return s1[0] !== s0[0] && s1[1].join() !== s0[1].join() ? true : JSON.stringify({ s0, s1 });
    });
    await t.step('a click on the toolbar just beside a small button is on it: < one day back', async () => {
        const st = () => E('Date.parse(el.instance.startTime)');
        const r = await E(`(()=>{ const a=el.querySelector('#b1_0').getBoundingClientRect(), d=el.querySelector('#dl_0').getBoundingClientRect();
            return { x: (d.left+a.left)/2, y: a.top+a.height/2 }; })()`);
        // (a click on the button first: the first one also aligns the window on a day)
        const b = await E(`(()=>{ const a=el.querySelector('#b1_0').getBoundingClientRect(); return { x: a.left+a.width/2, y: a.top+a.height/2 }; })()`);
        const s0 = await st(); await t.page.mouse.click(b.x, b.y); await t.wait(900);
        const s1 = await st(); await t.page.mouse.click(r.x, r.y); await t.wait(900); const s2 = await st();
        return s1 < s0 && s1 - s2 === 24 * 3600e3 ? true : JSON.stringify({ r, on: (s0 - s1) / 3600e3, beside: (s1 - s2) / 3600e3 });
    });
    await t.step('the persisted entities agree with what is shown', async () => (await E('storeProblems()')) || true);
    const r = await t.close();

    // ── The padlock: what it keeps when the data changes ──
    const t2 = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '1', statistics: { enabled: false }, refresh: { automatic: false },
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }, { type: 'line', entities: [{ entity: 'sensor.rain' }] }] }, { mock: { series: true } });
    const E2 = x => t2.E(x);
    await t2.wait(800);
    await t2.step('padlock clicked: the Y scale shown is kept when the data changes (the time panned, a new value); released, it follows the data again', async () => {
        // (a value far above the others, as new data brought by a pan or a refresh)
        const spike = () => E2(`(()=>{ const c=graphAt(0).chart, d=c.data.datasets[0].data; d.push({ x: d[d.length-1].x, y: 5000 }); c.update(); })()`);
        const unspike = () => E2(`(()=>{ const c=graphAt(0).chart; c.data.datasets[0].data.pop(); c.update(); })()`);
        const lk = await E2('lockPt(0)');
        const free0 = await E2('yRange(0)'); await spike(); const free1 = await E2('yRange(0)'); await unspike();
        await t2.page.mouse.click(lk.x, lk.y); await t2.wait(600);
        const l0 = await E2('yRange(0)'); await spike(); const l1 = await E2('yRange(0)'), locked = await E2('lockOf(0)');
        await t2.page.mouse.click(lk.x, lk.y); await t2.wait(600);
        const back = await E2('lockOf(0)'), b1 = await E2('yRange(0)');
        return free0.join() !== free1.join() && locked && l0.join() === l1.join() && !back && b1.join() !== l1.join() ? true
            : JSON.stringify({ free0, free1, l0, l1, locked, back, b1 });
    });
    const r2 = await t2.close();

    // ── A text shortened or hidden, shown in full in place: a hover, a click ──
    const t3 = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, graphs: [
        { type: 'line', entities: [{ entity: 'sensor.power', name: 'Ecowitt Vitesse du vent (Filtered)' }, { entity: 'sensor.power2', name: 'Météo-France Villeveyrac Vitesse du vent' }] },
        { type: 'timeline', entities: [{ entity: 'binary_sensor.a', name: 'front door of the garden shed near the pool' }, { entity: 'binary_sensor.b' }] }] }, { mock: { series: true } });
    const E3 = x => t3.E(x);
    await E3(`(()=>{ document.body.style.width='200px'; document.getElementById('host').style.width='200px'; })()`); await t3.wait(1500);
    const away = async () => { await t3.page.mouse.move(5, 5, { steps: 3 }); await t3.wait(300); };
    const hover = async p => { await t3.page.mouse.move(p.x, p.y, { steps: 4 }); await t3.wait(300); return E3('reveal()'); };
    // (where the reveal box is, against where the shortened text starts)
    const box = () => E3(`(()=>{ const e=document.getElementById('hec-reveal'); const r=e.getBoundingClientRect(); return { l: r.left, r: r.right }; })()`);
    await t3.step('a hover on a shortened legend label shows its full name over it, from where it starts; leaving it, gone', async () => {
        const p = await E3(`(()=>{ const c=graphAt(0).chart, b=c.legend.legendHitBoxes[0], r=c.canvas.getBoundingClientRect(); return { x: r.left+b.left+b.width-10, y: r.top+b.top+b.height/2, right: r.left+b.left+b.width, text: c.legend.legendItems[0].text }; })()`);
        const shown = await hover(p), b = await box(); await away(); const after = await E3('reveal()');
        return shown === 'Ecowitt Vitesse du vent (Filtered) (400 W)' && p.text !== shown && b.r > p.right && after === null ? true : JSON.stringify({ p, shown, b, after });
    });
    await t3.step('a hover on a cut timeline row name shows it in full; on one shown whole, nothing', async () => {
        const row = i => E3(`(()=>{ const p=tlPt(1,${i}), c=graphAt(1).chart, r=c.canvas.getBoundingClientRect(); return { x: r.left+c.chartArea.left-15, y: p.y }; })()`);
        const cut = await hover(await row(0)); await away();
        const whole = await hover(await row(1)); await away();
        return /garden shed near the pool/.test(cut || '') && whole === null ? true : JSON.stringify({ cut, whole });
    });
    await t3.step('a hover on a timeline state its bar is too narrow for shows it', async () => {
        const s = await E3(`(()=>{ const c=graphAt(1).chart, r=c.canvas.getBoundingClientRect(); const v=c.getDatasetMeta(0).data.map(p=>p._view).find(v=>v.width>2&&v.width<30&&v.x>c.chartArea.left+5);
            return v ? { x: r.left+v.x+v.width/2, y: r.top+v.y+v.height/2, text: String(v.text) } : null; })()`);
        if( !s ) return 'no narrow state';
        const shown = await hover(s); await away();
        return shown === s.text ? true : JSON.stringify({ s, shown });
    });
    const r3 = await t3.close();
    return { passed: r.passed + r2.passed + r3.passed, failed: r.failed + r2.failed + r3.failed };
};
