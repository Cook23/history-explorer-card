// A curve's samples' dots: shown or hidden by a long-press (a right click) on the curve — the
// nearest one, picked as a label is — or from the Layout submenu of its menu or of its
// graph's; every dot shown by default of a diameter of the line width + 2 px (Alt's too), the
// hovered one 2 px wider
const { openCard } = require('./lib.cjs');

const card = () => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false },
    graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] },
             { type: 'line', yAxis: 'left', entities: [{ entity: 'sensor.rain' }, { entity: 'sensor.tank' }] },
             // (two curves close to each other: rain drawn 180 times larger)
             { type: 'line', yAxis: 'left', entities: [{ entity: 'sensor.rain', scale: 180 }, { entity: 'sensor.tank' }] }] });
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
