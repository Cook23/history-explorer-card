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

    return { passed, failed };
};
