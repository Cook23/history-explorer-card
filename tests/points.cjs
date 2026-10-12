// A gesture on a curve — the nearest one, picked as a label is: a click or a tap puts it in the
// tooltip mode (several curves can be), a long-press (a right click) shows or hides its
// samples' dots, as the Layout submenu of its menu or of its
// graph's; every dot shown by default of a diameter of the line width + 2 px (Alt's too), the
// hovered one 2 px wider
const { openCard } = require('./lib.cjs');

const card = () => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false },
    graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] },
             { type: 'line', yAxis: 'left', entities: [{ entity: 'sensor.rain' }, { entity: 'sensor.tank' }] },
             // (two curves close to each other: rain drawn 180 times larger)
             { type: 'line', yAxis: 'left', entities: [{ entity: 'sensor.rain', scale: 180 }, { entity: 'sensor.tank' }] },
             // (two curves exactly on top of each other: power (400 W) and rain (4 mm) drawn
             // 100 times larger, both following the same sine, on one axis)
             { type: 'line', yAxis: 'left', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.rain', scale: 100 }] }] });
const near = (a, b) => Math.abs(a - b) < 0.01;

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    // Curve k of graph gi: its dots' radius, its showPoints saved
    const dots = (t, gi, k = 0) => t.E(`(()=>{ const g=el.instance._allGraphsInDisplayOrder()[${gi}];
        const d=g.chart.data.datasets[${k}]; return { r: d.pointRadius, R: (d.borderWidth+2)/2, hover: d.pointHoverRadius, saved: g.entities[${k}].showPoints }; })()`);
    const shown = d => near(d.r, d.R) && near(d.hover, d.R + 1);
    const menuOpen = t => t.E(`el.querySelector('#et_0').style.display !== 'none'`);
    const closeMenu = async t => { await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.wait(300); };
    // A point of graph gi's plot area clearly beside every curve: above or below them at x
    const beside = (t, gi) => t.E(`(()=>{ const c=graphAt(${gi}).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect(), x=(A.left+A.right)/2;
        const ys=c.data.datasets.flatMap((d,i)=>c.getDatasetMeta(i).data.map(p=>p._view)).filter(v=>!v.skip&&Math.abs(v.x-x)<40).map(v=>v.y);
        const y=Math.min(...ys)-A.top > A.bottom-Math.max(...ys) ? A.top+4 : A.bottom-4; return {x:r.left+x, y:r.top+y}; })()`);

    // ── With a mouse ──
    let t = await openCard(card(), { mock: { series: true } });
    await t.wait(800);
    await t.step('a long-press on a curve shows its dots, its diameter the line width + 2 px (hovered: + 2 more), saved; again, hides them', async () => {
        const p = await t.E('pointPt(0,0.5)');
        await t.longPress(p); const on = await dots(t, 0); const menu = await menuOpen(t);
        await t.longPress(p); const off = await dots(t, 0);
        return shown(on) && on.saved === true && !menu && off.r === 0 && off.saved === false ? true : JSON.stringify({ on, off, menu });
    });
    await t.step('a right click on a curve: the same', async () => {
        const p = await t.E('pointPt(0,0.3)');
        await t.contextMenu(p); await t.wait(400); const on = await dots(t, 0);
        await t.contextMenu(p); await t.wait(400); const off = await dots(t, 0);
        return shown(on) && off.r === 0 ? true : JSON.stringify({ on, off });
    });
    await t.step('of two curves, the one under the pointer only', async () => {
        const p = await t.E(`(()=>{ const c=graphAt(1).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect();
            const vs=d=>c.getDatasetMeta(d).data.map(p=>p._view).filter(v=>!v.skip&&v.x>A.left+20&&v.x<A.right-20);
            const rain=vs(0), yOf=x=>rain.reduce((b,v)=>Math.abs(v.x-x)<Math.abs(b.x-x)?v:b).y;
            const v=vs(1).find(v=>Math.abs(v.y-yOf(v.x))>20); return {x:r.left+v.x, y:r.top+v.y}; })()`);
        await t.longPress(p); const a = await dots(t, 1, 0), b = await dots(t, 1, 1);
        await t.longPress(p);
        return a.r === 0 && shown(b) ? true : JSON.stringify({ a, b });
    });
    await t.step('about halfway between two curves, nothing', async () => {
        const p = await t.E(`(()=>{ const c=graphAt(2).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect();
            const vs=d=>c.getDatasetMeta(d).data.map(p=>p._view).filter(v=>!v.skip&&v.x>A.left+20&&v.x<A.right-20);
            const rain=vs(0), near=x=>rain.reduce((b,v)=>Math.abs(v.x-x)<Math.abs(b.x-x)?v:b);
            const v=vs(1).find(v=>{ const w=near(v.x); return Math.abs(v.x-w.x)<0.5 && Math.abs(v.y-w.y)>6 && Math.abs(v.y-w.y)<20; });
            return v && {x:r.left+v.x, y:r.top+(v.y+near(v.x).y)/2}; })()`);
        if( !p ) return 'no place where the two curves are 6 to 20 px apart';
        await t.longPress(p); const a = await dots(t, 2, 0), b = await dots(t, 2, 1);
        return a.r === 0 && b.r === 0 ? true : JSON.stringify({ a, b });
    });
    await t.step('between two curves: the dead zone is the middle third of the gap — 0.3 of it from one curve picks it, 0.45 none', async () => {
        const at = f => t.E(`(()=>{ const c=graphAt(2).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect();
            const vs=d=>c.getDatasetMeta(d).data.map(p=>p._view).filter(v=>!v.skip&&v.x>A.left+20&&v.x<A.right-20);
            const rain=vs(0), near=x=>rain.reduce((b,v)=>Math.abs(v.x-x)<Math.abs(b.x-x)?v:b), tank=vs(1);
            // (where both curves are nearly flat — so the gap is vertical — 15 to 30 px apart)
            const k=tank.findIndex((v,i)=>i>0&&i<tank.length-1&&Math.abs(tank[i+1].y-tank[i-1].y)<1.5&&Math.abs(v.y-near(v.x).y)>15&&Math.abs(v.y-near(v.x).y)<30);
            if( k<0 ) return null; const v=tank[k], w=near(v.x);
            return {x:r.left+v.x, y:r.top+v.y+(w.y-v.y)*${f}}; })()`);
        const p1 = await at(0.3), p2 = await at(0.45);
        if( !p1 ) return 'no place where both curves are flat and 15 to 30 px apart';
        await t.longPress(p1); const a = await dots(t, 2, 1); await t.longPress(p1);
        await t.longPress(p2); const b = [await dots(t, 2, 0), await dots(t, 2, 1)];
        return shown(a) && b[0].r === 0 && b[1].r === 0 ? true : JSON.stringify({ a, b });
    });
    await t.step('two curves exactly on top of each other: the one drawn over', async () => {
        const p = await t.E(`(()=>{ const c=graphAt(3).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect();
            const v=c.getDatasetMeta(1).data.map(p=>p._view).filter(v=>!v.skip&&v.x>A.left+40)[10]; return {x:r.left+v.x, y:r.top+v.y}; })()`);
        await t.longPress(p); const a = await dots(t, 3, 0), b = await dots(t, 3, 1); await t.longPress(p);
        return shown(a) && b.r === 0 ? true : JSON.stringify({ a, b });
    });
    await t.step('clearly beside the curves, nothing', async () => {
        await t.longPress(await beside(t, 0)); const d = await dots(t, 0); const menu = await menuOpen(t);
        return d.r === 0 && !menu ? true : JSON.stringify({ d, menu });
    });
    await t.step('Layout ▸ Show the points, in a curve\'s menu; then Hide the points', async () => {
        const open = async () => { await t.longPress(await t.E('legendPt(0,0)')); await t.E(`el.querySelector('#et_0_layout').click()`); await t.wait(300); };
        await open(); const l1 = await t.E(`el.querySelector('#et_0_points').textContent`);
        await t.E(`el.querySelector('#et_0_points').click()`); await t.wait(400); const on = await dots(t, 0);
        await open(); const l2 = await t.E(`el.querySelector('#et_0_points').textContent`);
        await t.E(`el.querySelector('#et_0_points').click()`); await t.wait(400); const off = await dots(t, 0);
        return l1 === 'Show the points' && l2 === 'Hide the points' && shown(on) && off.r === 0 ? true : JSON.stringify({ l1, l2, on, off });
    });
    await t.step('Layout ▸ Show the points, in a graph\'s menu: every curve of the graph', async () => {
        await t.longPress(await t.E('moPt(1)'));
        await t.E(`el.querySelector('#et_0_points').click()`); await t.wait(400);
        const a = await dots(t, 1, 0), b = await dots(t, 1, 1);
        return shown(a) && shown(b) && a.saved && b.saved ? true : JSON.stringify({ a, b });
    });
    // The tooltip of graph gi: its text, else null
    const tip = gi => t.E(`(()=>{ const el=graphAt(${gi}).chart.tooltip._hecHoverTooltipEl; return el && el.isConnected && getComputedStyle(el).display!=='none' && getComputedStyle(el).opacity!=='0' ? el.textContent : null; })()`);
    // A point of curve k of graph 1 far from the other one, 3 px above the curve between two values
    const nearCurve = k => t.E(`(()=>{ const c=graphAt(1).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect();
        const vs=d=>c.getDatasetMeta(d).data.map(p=>p._view).filter(v=>!v.skip&&v.x>A.left+40&&v.x<A.right-40);
        const o=vs(1-${k}), yOf=x=>o.reduce((b,v)=>Math.abs(v.x-x)<Math.abs(b.x-x)?v:b).y, m=vs(${k});
        const i=m.findIndex((v,i)=>i&&Math.abs(v.y-yOf(v.x))>30); const a=m[i-1], b=m[i];
        return {x:r.left+(a.x+b.x)/2, y:r.top+(a.y+b.y)/2-3}; })()`);
    await t.step('a click near a curve, not on a value: its tooltip only; near the other one: both', async () => {
        await t.page.mouse.click(...Object.values(await nearCurve(1))); await t.wait(400);
        const one = await tip(1);
        await t.page.mouse.click(...Object.values(await nearCurve(0))); await t.wait(400);
        const two = await tip(1);
        return /tank/.test(one || '') && !/rain/.test(one || '') && /tank/.test(two || '') && /rain/.test(two || '') ? true : `${one} / ${two}`;
    });
    await t.step('a click beside the curves changes nothing; leaving the plot area ends the tooltip mode', async () => {
        await t.page.mouse.click(...Object.values(await beside(t, 1))); await t.wait(400);
        const kept = await tip(1);
        const y = await t.E('yaPt(1,0.5)'); await t.page.mouse.move(y.x, y.y, { steps: 10 }); await t.wait(1300);
        const r = { kept, gone: await tip(1), curves: await t.E('graphAt(1).chart._hecTooltipCurves') };
        return /tank/.test(kept || '') && /rain/.test(kept || '') && r.gone === null && !r.curves ? true : JSON.stringify(r);
    });
    await t.step('Alt held: the samples drawn with a diameter of the line width + 2 px', async () => {
        const p = await t.E('graphPtAt(0,0.5)');
        await t.page.keyboard.down('Alt'); await t.page.mouse.move(p.x, p.y, { steps: 5 }); await t.wait(400);
        const R = await t.E(`(graphAt(0).chart.data.datasets[0].borderWidth+2)/2`);
        const r = await t.E(`(()=>{ const c=graphAt(0).chart; return c.getDatasetMeta(0).data.map(p=>p._model.radius).filter(x=>x>0); })()`);
        await t.page.keyboard.up('Alt'); await t.page.mouse.move(p.x, p.y + 3); await t.wait(300);
        return r.length && r.every(x => near(x, R)) ? true : JSON.stringify(r.slice(0, 5));
    });
    done(await t.close());

    // ── With a finger ──
    t = await openCard(card(), { touch: true, mock: { series: true } });
    await t.wait(800);
    await t.step('a long-press of a finger on a curve shows its dots; again, hides them', async () => {
        const p = await t.E('pointPt(0,0.5)');
        await t.touchLongPress(p); const on = await dots(t, 0);
        await t.touchLongPress(p); const off = await dots(t, 0);
        return shown(on) && off.r === 0 ? true : JSON.stringify({ on, off });
    });
    done(await t.close());

    return { passed, failed };
};
