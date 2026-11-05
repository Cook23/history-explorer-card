const { openCard } = require('./lib.cjs');
const H = 3600;
(async () => {
    const t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, graphs: [
        { type: 'timeline', entities: [{ entity: 'sensor.power', process: 'state > 300 ? "high" : "low"' }] },
        { type: 'line', entities: [{ entity: 'climate.salon', stateMap: [{ value: 'off', label: 'Off' }, 'heat', 'cool'] }] },
        { type: 'line', entities: [{ entity: 'sensor.power_kw', valueFactor: -3 }] },
        { type: 'bar', entities: [{ entity: 'sensor.net_energy', netBars: true }, { entity: 'sensor.energy' }] } ] },
        { height: 1400, mock: { rows: {
            'sensor.power': [[10*H, '100'], [6*H, '400'], [2*H, '200']],
            'sensor.power_kw': [[10*H, '400'], [6*H, 'unavailable'], [2*H, '800']],
            'climate.salon': [[10*H, 'off'], [8*H, 'heat'], [6*H, 'cool'], [4*H, 'dry'], [2*H, 'off']],
            'sensor.net_energy': [[10*H, '10'], [8*H, '12'], [6*H, '11'], [4*H, '15']],
            'sensor.energy': [[10*H, '10'], [8*H, '12'], [6*H, '11'], [4*H, '15']] } } });
    await t.wait(2500);
    const r = await t.E(`(()=>{ const ds = i => graphAt(i).chart.data.datasets; return {
        tl: ds(0)[0].data.map(d => d[2]),
        sm: ds(1)[0].data.map(p => Math.round((Date.now() - new Date(p.x)) / 36e5 * 10) / 10 + "h:" + p.y), smLegend: graphAt(1).chart.legend.legendItems.map(i => i.text),
        vf: ds(2)[0].data.map(p => Math.round((Date.now() - new Date(p.x)) / 36e5 * 10) / 10 + "h:" + p.y), vfLegend: graphAt(2).chart.legend.legendItems.map(i => i.text),
        net: ds(3).map(d => d.label + ':' + d.data.map(p => Math.round((p.y ?? p) * 100) / 100).join(',')) }; })()`);
    console.log(JSON.stringify(r, null, 1));
    await t.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
