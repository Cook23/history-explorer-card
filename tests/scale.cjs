// `scale`: without `unit`, it only changes how a curve is drawn (the legend and tooltip show
// the entity's real value); with `unit`, it's a conversion (the converted value is shown)
const { openCard } = require('./lib.cjs');

module.exports = async function()
{
    const t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false },
        graphs: [
            { type: 'line', entities: [{ entity: 'sensor.rain', scale: -1 }, { entity: 'sensor.power', scale: 0.001, unit: 'kW' }] },
            { type: 'line', entities: [{ entity: 'sensor.power2', scale: 2 }, { entity: 'sensor.power_kw' }] },
            { type: 'line', entities: [{ entity: 'sensor.wind', scale: -1 }] }] }, { mock: { series: true } });
    // For each curve of graph G: its legend label, a point as drawn, and the tooltip's value for it
    const curves = G => t.E(`(()=>{ const c=el.instance.graphs[${G}].chart; const cb=c.options.tooltips.callbacks.label;
        return c.data.datasets.map((d,i)=>{ const pt=d.data.find(p=>p.y!=null);
            return { label: d.label, y: pt.y, tip: cb({ datasetIndex: i, yLabel: pt.y }, c.data).replace(/^.*: /, '') }; }); })()`);
    const near = (a, b) => Math.abs(a - b) < 0.011;

    await t.step('without unit: drawn scaled, the real value in the legend and tooltip', async () => {
        const [rain] = await curves(0);
        return rain.y < 0 && near(parseFloat(rain.tip), -rain.y) && / mm$/.test(rain.tip) && /\(4 mm\)/.test(rain.label) ? true : JSON.stringify(rain);
    });
    await t.step('with unit: the converted value in the legend and tooltip', async () => {
        const [, power] = await curves(0);
        return near(parseFloat(power.tip), power.y) && / kW$/.test(power.tip) && /\(0\.4 kW\)/.test(power.label) ? true : JSON.stringify(power);
    });
    await t.step('with an SI conversion too: the real value, in the entity\'s own unit', async () => {
        const [p2, kw] = await curves(1);
        // (both drawn in kW: power2's W divided by 1000, times 2)
        return near(parseFloat(p2.tip), p2.y * 1000 / 2) && / W$/.test(p2.tip) && near(parseFloat(kw.tip), kw.y) && / kW$/.test(kw.tip) ? true : JSON.stringify([p2, kw]);
    });
    await t.step('an angle with a negative scale: its real value, in [0, 360)', async () => {
        const [wind] = await curves(2);
        const v = parseFloat(wind.tip), real = ((-wind.y % 360) + 360) % 360;
        return v >= 0 && v < 360 && near(v, real) ? true : JSON.stringify(wind);
    });
    return t.close();
};
