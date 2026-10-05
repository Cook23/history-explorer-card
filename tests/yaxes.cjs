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
        right: Math.round(g.chart.chartArea.right), curves: g.chart.data.datasets.map(d=>(d.yAxisID ?? '')+'|'+d.label) }))`);

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

    return { passed, failed };
};
