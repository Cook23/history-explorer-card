// Two Y axes on a line or bar graph: one per group of compatible units, at most two (the
// first group on the left, the second on the right), an entity's `yAxis` choosing its side;
// a small arrow in the legend for the curves of the right axis; linked graphs keep the
// same room on the right, so that their time stays aligned
const { openCard } = require('./lib.cjs');

const card = (o) => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, ...o });

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };
    // Each graph: its type, its Y axes (id:unit), its plot area's right edge, each curve's axis and legend label
    const graphs = t => t.E(`el.instance.graphs.map(g=>({ type: g.type, group: g.groupId, axes: g.chart.options.scales.yAxes.map(a=>a.id+':'+(a.scaleLabel.labelString ?? '')).join(),
        right: Math.round(g.chart.chartArea.right), curves: g.chart.data.datasets.map(d=>(d.yAxisID ?? '')+'|'+legendText(d)) }))`);

    let t = await openCard(card({ graphs: [
        { type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power_kw' }, { entity: 'sensor.rain' }, { entity: 'binary_sensor.a', type: 'timeline' }] },
        { type: 'line', entities: [{ entity: 'sensor.watering_cycle' }, { entity: 'sensor.wind_rad' }, { entity: 'input_number.watering_in_progress' }] },
        { type: 'line', entities: [{ entity: 'sensor.power2' }, { entity: 'sensor.tank', yAxis: 'left' }, { entity: 'sensor.wind', yAxis: 'right' }] },
        { type: 'line', entities: [{ entity: 'sensor.days_to_watering' }] },
    ] }), { height: 1600, mock: { series: true } });
    await t.wait(800);
    const g = await graphs(t);

    await t.step('two groups of units: the first on the left (W and kW: in kW), the second on the right', async () => {
        const x = g[0];
        return x.axes === 'y-axis-0:kW,y-axis-1:mm' && x.curves.join() === 'y-axis-0|power (400 W),y-axis-0|power kw (1.2 kW),y-axis-1|rain (4 mm) ▸' ? true : JSON.stringify(x);
    });
    await t.step('three groups of units: one shared axis, without a unit, no arrow', async () => {
        const x = g[2];   // (the second YAML graph, after the first one's linked timeline)
        return x.axes === 'y-axis-0:' && x.curves.every(c => c.startsWith('y-axis-0|') && !c.endsWith('▸')) ? true : JSON.stringify(x);
    });
    await t.step('an entity\'s yAxis chooses its side, whatever its unit', async () => {
        const x = g[3];
        return x.axes === 'y-axis-0:,y-axis-1:°' && x.curves.join() === 'y-axis-0|power two (300 W),y-axis-0|tank (800 L),y-axis-1|wind direction (350 °) ▸' ? true : JSON.stringify(x);
    });
    await t.step('linked graphs: the timeline keeps the right axis\' room, an independent graph doesn\'t', async () => {
        const [line, timeline, , , alone] = g;
        return timeline.type === 'timeline' && timeline.group === line.group && timeline.right === line.right && alone.right > line.right + 20
            ? true : JSON.stringify(g.map(x => [x.type, x.group, x.right]));
    });
    await t.step('a curve of the right axis is drawn on its own scale', async () => {
        // (rain, 2 to 6 mm: on its own axis it spans the plot area's height, not a sliver at the bottom)
        const r = await t.E(`(()=>{ const c=graphAt(0).chart, m=c.getDatasetMeta(2).data.map(p=>p._model.y); return [Math.min(...m), Math.max(...m), c.chartArea.top, c.chartArea.bottom]; })()`);
        const [lo, hi, top, bottom] = r;
        return hi - lo > (bottom - top) * 0.8 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── From entityOptions too ──
    t = await openCard(card({ entityOptions: [{ match: 'sensor.power2', yAxis: 'right' }],
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power2' }] }] }), { height: 800, mock: { series: true } });
    await t.step('entityOptions: yAxis right puts the curve on the right axis', async () => {
        const x = (await graphs(t))[0];
        return x.axes === 'y-axis-0:W,y-axis-1:W' && x.curves[1].startsWith('y-axis-1|') ? true : JSON.stringify(x);
    });
    done(await t.close());

    // ── yAxis on a graph and on the card: one axis, an entity choosing its own side ──
    t = await openCard(card({ graphs: [
        { type: 'line', yAxis: 'left', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.rain' }] },
        { type: 'line', options: { yAxis: 'left' }, entities: [{ entity: 'sensor.power2' }, { entity: 'sensor.tank', yAxis: 'right' }] },
        { type: 'line', entities: [{ entity: 'sensor.days_to_watering' }, { entity: 'sensor.wind' }] },
        { type: 'line', entities: [{ entity: 'sensor.power_kw' }] },
    ] }), { height: 1500, mock: { series: true } });
    await t.wait(800);
    let gs = await graphs(t);
    await t.step('yAxis: left on a graph: every curve on one axis, whatever their units', async () => {
        const x = gs[0];
        return x.axes === 'y-axis-0:' && x.curves.every(c => c.startsWith('y-axis-0|') && !c.endsWith('▸')) ? true : JSON.stringify(x);
    });
    await t.step('yAxis under the graph\'s options: the same; an entity\'s own yAxis wins over it', async () => {
        const x = gs[1];
        return x.curves[0].startsWith('y-axis-0|') && x.curves[1].startsWith('y-axis-1|') ? true : JSON.stringify(x);
    });
    await t.step('a graph without yAxis: an axis per group of units, as by default', async () => {
        const x = gs[2];
        return x.curves[0].startsWith('y-axis-0|') && x.curves[1].startsWith('y-axis-1|') ? true : JSON.stringify(x);
    });
    await t.step('a curve dragged out of a graph set to left: it takes the graph it lands in\'s axes', async () => {
        // (rain, in mm, onto a graph of kW only: two groups of units, rain on the right)
        await t.drag(await t.E('legendPt(0, 1)'), await t.E('graphPtAt(3, 0.15)')); await t.wait(800);
        const x = (await graphs(t)).find(g => g.curves.some(c => c.includes('rain')));
        return x.curves.length === 2 && x.curves[0].startsWith('y-axis-0|') && x.curves[1].startsWith('y-axis-1|') ? true : JSON.stringify(x);
    });
    done(await t.close());

    t = await openCard(card({ yAxis: 'left', graphs: [
        { type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.rain' }] },
        { type: 'line', entities: [{ entity: 'sensor.power2' }, { entity: 'sensor.wind', yAxis: 'auto' }] },
    ] }), { height: 1000, mock: { series: true } });
    await t.wait(800);
    gs = await graphs(t);
    await t.step('yAxis: left on the card: one axis on every graph; an entity\'s yAxis: auto, by its unit', async () => {
        return gs[0].axes === 'y-axis-0:' && gs[1].curves[0].startsWith('y-axis-0|') && gs[1].curves[1].startsWith('y-axis-1|')
            ? true : JSON.stringify(gs.map(x => x.curves));
    });
    done(await t.close());

    // ── Circular labels and stacked bars, per axis ──
    t = await openCard(card({ graphs: [
        { type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.wind' }] },
        { type: 'bar', stacked: true, entities: [{ entity: 'sensor.energy' }, { entity: 'sensor.energy2' }, { entity: 'sensor.gas' }] },
    ] }), { height: 1000, mock: { series: true } });
    await t.step('a circular curve on the right axis: that axis\' labels wrap around (period 360), the left one\'s don\'t', async () => {
        const p = await t.E(`graphAt(0).chart.options.scales.yAxes.map(a=>a.ticks.period ?? null)`);
        return p[0] === null && p[1] === 360 ? true : JSON.stringify(p);
    });
    await t.step('stacked bars on two axes: each axis\' bars stacked in their own column', async () => {
        const r = await t.E(`(()=>{ const c=graphAt(1).chart; const x=i=>c.getDatasetMeta(i).data.map(b=>Math.round(b._model.x)); const base=i=>c.getDatasetMeta(i).data.map(b=>Math.round(b._model.base));
            return { axes: c.data.datasets.map(d=>d.yAxisID), x0: x(0)[5], x1: x(1)[5], x2: x(2)[5], top0: Math.round(c.getDatasetMeta(0).data[5]._model.y), base1: base(1)[5] }; })()`);
        // (energy and energy2, in kWh, on the left: one column, energy2 on top of energy; gas, in m³, on the right: a column of its own)
        return r.axes.join() === 'y-axis-0,y-axis-0,y-axis-1' && r.x0 === r.x1 && r.x2 !== r.x0 && r.base1 === r.top0 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── Gestures: an axis' label column moves that axis; Shift, a pinch, the padlock: both ──
    const twoAxes = card({ graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.rain' }] }] });
    const ranges = () => t.E('[yRange(0), yRangeRight(0)]');
    const same = (a, b) => a[0] === b[0] && a[1] === b[1];
    t = await openCard(twoAxes, { height: 800, mock: { series: true } });
    let r0 = await ranges();
    await t.step('mouse: dragging the left labels moves the left axis only', async () => {
        const a = await t.E('yaPt(0, 0.5)');
        await t.drag(a, { x: a.x, y: a.y + 60 }); await t.wait(300);
        const r = await ranges();
        return !same(r[0], r0[0]) && same(r[1], r0[1]) ? true : JSON.stringify({ r0, r });
    });
    await t.step('mouse: dragging the right labels moves the right axis only', async () => {
        const r1 = await ranges(); const a = await t.E('yaRightPt(0, 0.5)');
        await t.drag(a, { x: a.x, y: a.y + 60 }); await t.wait(300);
        const r = await ranges();
        return same(r[0], r1[0]) && !same(r[1], r1[1]) && r[1][0] > r1[1][0] ? true : JSON.stringify({ r1, r });
    });
    await t.step('the padlock releases both axes', async () => {
        const p = await t.E('lockPt(0)'); await t.page.mouse.click(p.x, p.y); await t.wait(400);
        const r = await ranges();
        return same(r[0], r0[0]) && same(r[1], r0[1]) ? true : JSON.stringify({ r0, r });
    });
    await t.step('Shift + drag on the curves moves both axes', async () => {
        const r1 = await ranges(); const c = await t.E('graphPtAt(0, 0.5)');
        await t.page.keyboard.down('Shift'); await t.drag(c, { x: c.x, y: c.y + 50 }); await t.page.keyboard.up('Shift'); await t.wait(300);
        const r = await ranges();
        const p = await t.E('lockPt(0)'); await t.page.mouse.click(p.x, p.y); await t.wait(400);   // (released again)
        return !same(r[0], r1[0]) && !same(r[1], r1[1]) ? true : JSON.stringify({ r1, r });
    });
    await t.step('Shift + wheel zooms both axes, each around its own middle', async () => {
        const c = await t.E('graphPtAt(0, 0.5)');
        await t.page.mouse.move(c.x, c.y); await t.page.keyboard.down('Shift');
        await t.page.mouse.wheel(0, -100); await t.wait(300); await t.page.keyboard.up('Shift');
        const r = await ranges();
        const narrower = (a, b) => a[1] - a[0] < b[1] - b[0] - 1e-6;
        const mid = a => (a[0] + a[1]) / 2;
        return narrower(r[0], r0[0]) && narrower(r[1], r0[1]) && Math.abs(mid(r[1]) - mid(r0[1])) < 0.05 * (r0[1][1] - r0[1][0]) ? true : JSON.stringify({ r0, r });
    });
    done(await t.close());

    t = await openCard(twoAxes, { touch: true, height: 800, scrollRoom: 1500, mock: { series: true } });
    r0 = await ranges();
    await t.step('touch: tap the right labels, then press again and drag: the right axis moves, the page doesn\'t scroll', async () => {
        const a = await t.E('yaRightPt(0, 0.5)');
        await t.tapDrag(a, { x: a.x, y: a.y + 60 });
        const r = await ranges(); const y = await t.scrollY();
        return same(r[0], r0[0]) && !same(r[1], r0[1]) && y === 0 ? true : JSON.stringify({ r0, r, y });
    });
    await t.step('touch: a vertical pinch zooms both axes', async () => {
        await t.E('graphAt(0).chart._hecToggleYAxisLock()'); await t.wait(300);   // (released: back to the auto ranges)
        const r1 = await ranges(); const c = await t.E('graphPtAt(0, 0.5)');
        await t.pinch(c, { x: 0, y: -4 }, { x: 0, y: 4 });
        const r = await ranges();
        const narrower = (a, b) => a[1] - a[0] < b[1] - b[0] - 1e-6;
        return narrower(r[0], r1[0]) && narrower(r[1], r1[1]) ? true : JSON.stringify({ r1, r });
    });
    done(await t.close());

    // ── The labels drawn inside the plot (a narrow card): near them, the gesture decides — a
    // drag (a finger's or a pen's after a tap) is the axis', a click, a long press, a hover the curves' ──
    const narrow = async () => { await t.E(`(()=>{ document.body.style.width='260px'; document.getElementById('host').style.width='260px'; })()`); await t.wait(1500); };
    // A point of the column along the labels of side ('left', 'right'), at frac of the plot's height
    const colPt = (side, frac) => t.E(`(()=>{ const c=graphAt(0).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect(), k=c._hecInsideLabelColumns('mouse').find(k=>k.side==='${side}');
        return k ? { x: r.left+(${side === 'left'} ? k.left+4 : k.right-4), y: r.top+A.top+(A.bottom-A.top)*${frac} } : null; })()`);
    // A value of the curve of side's axis (power on the left, rain on the right) within its column — under a label's box
    // or not: the labels aren't targets — the farthest from the other curve (the two drawn alike, the right axis moved to set them apart)
    const valueInCol = (side = 'left') => t.E(`(()=>{ const c=graphAt(0).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect(), k=c._hecInsideLabelColumns('mouse').find(k=>k.side==='${side}');
        const i=${side === 'left' ? 0 : 1};
        const o=c.getDatasetMeta(1-i).data.map(p=>p._view), far=v=>Math.min(...o.map(w=>Math.hypot(w.x-v.x, w.y-v.y)));
        const v=c.getDatasetMeta(i).data.map(p=>p._view).filter(v=>!v.skip&&v.x>k.left+2&&v.x<k.right-2&&v.y>A.top+10&&v.y<A.bottom-10&&far(v)>6)
            .sort((a,b)=>far(b)-far(a))[0];
        return v ? { x: r.left+v.x, y: r.top+v.y } : null; })()`);
    const tipOf = () => t.E(`(()=>{ const el=graphAt(0).chart.tooltip._hecHoverTooltipEl; return el && el.isConnected && getComputedStyle(el).display!=='none' && getComputedStyle(el).opacity!=='0' ? el.textContent : null; })()`);
    const pointsOf = (i = 0) => t.E(`graphAt(0).chart.data.datasets[${i}].pointRadius`);
    const lock = () => t.E('!!graphAt(0).chart._hecYAxisLock');
    const release = async () => { if( await lock() ) { await t.E('graphAt(0).chart._hecToggleYAxisLock()'); await t.wait(300); } };
    const time = () => t.E('JSON.stringify(timeRange())');
    // Where curve 0 (power, left axis) and curve 1 (rain, right axis) are drawn: a value's height of each
    const drawn = () => t.E(`[0,1].map(i=>{ const d=graphAt(0).chart.getDatasetMeta(i).data.filter(p=>!p._model.skip); return Math.round(d[Math.floor(d.length/2)]._model.y); })`);

    t = await openCard(twoAxes, { height: 800, mock: { series: true } });
    await narrow();
    await t.step('labels inside: a column along each axis\' labels, as wide as their boxes and the pointer\'s precision', async () => {
        const r = await t.E(`(()=>{ const c=graphAt(0).chart, A=c.chartArea, m=c._hecInsideLabelColumns('mouse'), f=c._hecInsideLabelColumns('touch'), b=c.scales['y-axis-0']._hecLabelBoxes||[];
            return { mirror: c.options.scales.yAxes[0].ticks.mirror, sides: m.map(k=>k.side).join(), mw: Math.round(m[0].right-m[0].left), fw: Math.round(f[0].right-f[0].left),
                     box: Math.round(Math.max(...b.map(q=>q.x+q.w-A.left))), left: Math.round(m[0].left-A.left) }; })()`);
        return r.mirror && r.sides === 'left,right' && r.left === 0 && r.mw >= r.box && r.fw > r.mw ? true : JSON.stringify(r);
    });
    r0 = await ranges();
    await t.step('mouse: a drag near the left labels moves the left axis and its curve, not the time', async () => {
        const a = await colPt('left', 0.5), t0 = await time(), y0 = await drawn();
        await t.drag(a, { x: a.x, y: a.y + 50 }); await t.wait(300);
        const r = await ranges(), t1 = await time(), y = await drawn(); await release();
        return !same(r[0], r0[0]) && same(r[1], r0[1]) && t1 === t0 && y[0] - y0[0] > 20 && y[1] === y0[1] ? true : JSON.stringify({ r0, r, t0, t1, y0, y });
    });
    await t.step('mouse: a drag near the right labels moves the right axis and its curve', async () => {
        const r1 = await ranges(), a = await colPt('right', 0.5), y0 = await drawn();
        await t.drag(a, { x: a.x, y: a.y + 50 }); await t.wait(300);
        const r = await ranges(), y = await drawn();
        return same(r[0], r1[0]) && !same(r[1], r1[1]) && y[0] === y0[0] && y[1] - y0[1] > 20 ? true : JSON.stringify({ r1, r, y0, y });
    });
    await t.step('mouse: a hover on a value near the labels shows its dot', async () => {
        const v = await valueInCol(); if( !v ) return 'no value near the labels';
        await t.page.mouse.move(v.x + 30, v.y - 20, { steps: 3 }); await t.page.mouse.move(v.x, v.y, { steps: 5 }); await t.wait(300);
        const d = await t.E('(()=>{ const d=graphAt(0).chart._hecHoverDot; return d ? d._datasetIndex : null; })()');
        return d === 0 ? true : JSON.stringify({ d });
    });
    await t.step('mouse: a click on a value near the labels shows its tooltip, the axis untouched', async () => {
        const v = await valueInCol(), r1 = await ranges();
        await t.page.mouse.click(v.x, v.y); await t.wait(400);
        const tip = await tipOf(), r = await ranges();
        await t.page.keyboard.press('Escape'); await t.page.mouse.move(5, 5); await t.wait(300);
        return tip && same(r[0], r1[0]) && same(r[1], r1[1]) ? true : JSON.stringify({ tip, r1, r });
    });
    for( const [side, i] of [['left', 0], ['right', 1]] ) {
        await t.step(`mouse: a long press on a value near the ${side} labels shows its curve\'s points, the axis untouched`, async () => {
            const v = await valueInCol(side); if( !v ) return 'no value near the labels';
            const p0 = await pointsOf(i), r1 = await ranges();
            await t.longPress(v);
            const p1 = await pointsOf(i), r = await ranges();
            await t.longPress(v);
            return p1 !== p0 && same(r[0], r1[0]) && same(r[1], r1[1]) ? true : JSON.stringify({ p0, p1, r1, r });
        });
    }
    await t.step('mouse: a click on a value near the right labels shows its tooltip', async () => {
        const v = await valueInCol('right'); if( !v ) return 'no value near the labels';
        await t.page.mouse.click(v.x, v.y); await t.wait(400);
        const tip = await tipOf();
        await t.page.keyboard.press('Escape'); await t.page.mouse.move(5, 5); await t.wait(300);
        return tip ? true : JSON.stringify({ tip });
    });
    await release();
    done(await t.close());

    t = await openCard(twoAxes, { touch: true, height: 800, scrollRoom: 1500, mock: { series: true } });
    await narrow();
    r0 = await ranges();
    await t.step('touch: a swipe near the labels is not the axis\'', async () => {
        const a = await colPt('left', 0.3);
        await t.swipe(a, { x: a.x, y: a.y + 60 }); await t.scrollTop();
        const r = await ranges();
        return same(r[0], r0[0]) && !(await lock()) ? true : JSON.stringify({ r0, r });
    });
    await t.step('touch: a tap near the left labels, then press again and drag: the left axis and its curve move, the page doesn\'t scroll', async () => {
        const a = await colPt('left', 0.5), y0 = await drawn();
        await t.tapDrag(a, { x: a.x, y: a.y + 60 });
        const r = await ranges(), y = await t.scrollY(), d = await drawn(); await release();
        return !same(r[0], r0[0]) && same(r[1], r0[1]) && y === 0 && d[0] - y0[0] > 20 && d[1] === y0[1] ? true : JSON.stringify({ r0, r, y, y0, d });
    });
    await t.step('touch: the same near the right labels moves the right axis and its curve', async () => {
        const r1 = await ranges(), a = await colPt('right', 0.5), y0 = await drawn();
        await t.tapDrag(a, { x: a.x, y: a.y + 60 });
        const r = await ranges(), d = await drawn();
        return same(r[0], r1[0]) && !same(r[1], r1[1]) && d[0] === y0[0] && d[1] - y0[1] > 20 ? true : JSON.stringify({ r1, r, y0, d });
    });
    await t.step('touch: a long press on a value near the labels shows the curve\'s points, the axis untouched', async () => {
        const v = await valueInCol(), p0 = await pointsOf(), r1 = await ranges();
        await t.touchLongPress(v);
        const p1 = await pointsOf(), r = await ranges();
        await t.touchLongPress(v);
        return p1 !== p0 && same(r[0], r1[0]) && same(r[1], r1[1]) ? true : JSON.stringify({ p0, p1, r1, r });
    });
    await t.step('touch: a tap on a value near the labels shows its tooltip', async () => {
        const v = await valueInCol(), r1 = await ranges();
        await t.tap(v); await t.wait(700);
        const tip = await tipOf(), r = await ranges(); await release();
        return tip && same(r[0], r1[0]) && same(r[1], r1[1]) ? true : JSON.stringify({ tip, r1, r });
    });
    done(await t.close());

    t = await openCard(twoAxes, { height: 800, mock: { series: true } });
    await narrow();
    r0 = await ranges();
    await t.step('pen: a drag near the labels is not the axis\'; a tap, then press again and drag: it is', async () => {
        const a = await colPt('left', 0.5);
        await t.penDrag(a, { x: a.x, y: a.y + 50 }); await t.wait(300);
        const r1 = await ranges();
        await t.penTap(a); await t.wait(120); await t.penDrag(a, { x: a.x, y: a.y + 50 }); await t.wait(300);
        const r2 = await ranges(); await release();
        return same(r1[0], r0[0]) && !same(r2[0], r0[0]) && same(r2[1], r0[1]) ? true : JSON.stringify({ r0, r1, r2 });
    });
    await t.step('pen: the same near the right labels moves the right axis', async () => {
        const r1 = await ranges(), a = await colPt('right', 0.5);
        await t.penTap(a); await t.wait(120); await t.penDrag(a, { x: a.x, y: a.y + 50 }); await t.wait(300);
        const r = await ranges(); await release();
        return same(r[0], r1[0]) && !same(r[1], r1[1]) ? true : JSON.stringify({ r1, r });
    });
    done(await t.close());

    // ── A circular curve: the turn shown chosen on the window shown; a Y range set by hand
    // chooses it then ──
    // (a wind turning 20° every half hour, for two days: 960° a day — the last 4 h cross 0:
    // 320, 340, 0, 20 … 120)
    const wind = Array.from({ length: 97 }, (_, k) => [( 96 - k ) * 1800, String(( 240 + 20 * ( k - 48 ) + 3600 ) % 360)]);
    // (the points of the window shown: their values, the jumps marked, the Y axis' range)
    const shownCurve = () => t.E(`(()=>{ const c=graphAt(0).chart, x=c.scales['x-axis-0'], ys=c.scales['y-axis-0'];
        const p=c.data.datasets[0].data.filter(q=>q && typeof q.y==='number' && q.x>=x.min && q.x<=x.max);
        const y=p.map(q=>q.y); return { n: p.length, lo: Math.min(...y), hi: Math.max(...y), jumps: p.filter((q,i)=>i && q.hecCircularJump).length,
            steps: p.filter((q,i)=>i && Math.abs(q.y-p[i-1].y)>180).length, axis: [ys.min, ys.max] }; })()`);
    const windCard = range => card({ defaultTimeRange: range, statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.wind', type: 'line', lineMode: 'lines' }] }] });
    t = await openCard(windCard('24h'), { height: 700, mock: { series: true, rows: { 'sensor.wind': wind } } });
    await t.wait(1500);
    await t.step('a circular curve going round more than a turn in the window: put in one turn, its jumps dashed', async () => {
        const r = await shownCurve();
        return r.hi - r.lo <= 360 && r.jumps >= 2 && r.jumps === r.steps ? true : JSON.stringify(r);
    });
    await t.step('zoomed to the last 4 h, where it crosses 0 (more than a turn before them): continuous there — 320, 340, 360, 380 …', async () => {
        await t.E(`(()=>{ const s=el.querySelector('#by_0'); s.value='4'; s.dispatchEvent(new Event('change')); })()`); await t.wait(1500);
        const r = await shownCurve();
        return r.n >= 8 && r.hi - r.lo <= 360 && !r.jumps && !r.steps ? true : JSON.stringify(r);
    });
    await t.step('the Y axis moved by hand a turn up: the curve with it, a turn up, still continuous', async () => {
        const r0 = await shownCurve();
        await t.E(`(()=>{ const c=graphAt(0).chart; c._hecSetYRanges([[c.scales['y-axis-0'].min+360, c.scales['y-axis-0'].max+360]]); })()`); await t.wait(300);
        const r1 = await shownCurve();
        return Math.abs(r1.lo - r0.lo - 360) < 1e-6 && Math.abs(r1.hi - r0.hi - 360) < 1e-6 && !r1.jumps && !r1.steps ? true : JSON.stringify({ r0, r1 });
    });
    await t.step('the padlock released: the curve back where it was', async () => {
        await t.E(`(()=>{ const c=graphAt(0).chart; c.hecSetYAxisLocked(false); c.update(); })()`); await t.wait(300);
        const r = await shownCurve();
        return r.lo < 360 && r.hi - r.lo <= 360 && !r.jumps && !r.steps ? true : JSON.stringify(r);
    });
    await t.step('back to 24 h, the Y axis moved by hand: every value in the turn around the range\'s middle, its jumps dashed there', async () => {
        await t.E(`(()=>{ const s=el.querySelector('#by_0'); s.value='24'; s.dispatchEvent(new Event('change')); })()`); await t.wait(1500);
        await t.E(`graphAt(0).chart._hecSetYRanges([[500, 860]])`); await t.wait(300);
        const r = await shownCurve();
        return r.lo >= 500 && r.hi < 860 && r.jumps >= 2 && r.jumps === r.steps ? true : JSON.stringify(r);
    });
    done(await t.close());

    return { passed, failed };
};
