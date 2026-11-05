// Every change of what's shown, seen by every device: after the change made on one device,
// that device after a reload, a new device (nothing saved on it) and a device that last saw
// the card before the change (its own storage older) all show the same — and a device that
// only loads the card writes nothing new to Home Assistant (the last one to speak wins: one
// that only loads never speaks). On a card of entities added from it, and on a YAML card
// with enableMultidevicePersistence.
const { openCard } = require('./lib.cjs');

const DYNAMIC = { type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, combineSameUnits: true, graphs: [] };
const YAML = { type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, enableMultidevicePersistence: 'all',
    graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power_kw' }] },
             { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }, { entity: 'binary_sensor.b' }] }] };

// An entity's fields kept on each device, never from another one (card-storage.js
// ENTITY_FIELD_SCOPE 'local')
const LOCAL = ['hidden', 'showPoints', 'largeScreenTooltip', 'smallScreenTooltip', 'largeChartTooltip', 'smallChartTooltip', 'yAxisLock'];

// In the page: I the card, G(id) the graph showing id, X(g, id) its place in g
const H = `const I = el.instance; const G = id => I.graphsInDisplayOrder().find(g => g.entities.some(e => e.entity === id)); const X = (g, id) => g.entities.findIndex(e => e.entity === id);`;
const split = id => `I.splitCurve(G('${id}'), X(G('${id}'), '${id}'))`;
const type = (id, t, mode) => `I.setCurveType(G('${id}'), X(G('${id}'), '${id}'), '${t}', ${mode ? `'${mode}'` : null})`;
const drop = (id, onto, at = -1) => `I.moveCurve(G('${id}'), X(G('${id}'), '${id}'), G('${onto}'), ${at})`;

// [what, done before the other device last saw the card, the change]
const COMMON = [
    ['a curve split', null, split('sensor.power_kw')],
    ['a curve split, then dropped back onto its graph', split('sensor.power_kw'), drop('sensor.power_kw', 'sensor.power')],
    ['a curve split, then merged back by the chain', split('sensor.power_kw'), `I.mergeGraphUp(G('sensor.power_kw'))`],
    ['a timeline row split', null, split('binary_sensor.b')],
    ['a timeline row split, then dropped back', split('binary_sensor.b'), drop('binary_sensor.b', 'binary_sensor.a')],
    ['a curve made bars (a linked graph)', null, type('sensor.power_kw', 'bar')],
    ['a curve made a timeline, then a curve again', type('sensor.power_kw', 'timeline'), type('sensor.power_kw', 'line', 'smart')],
    ['a graph moved above another', null, `I.moveGraph(G('binary_sensor.a'), G('sensor.power'), true)`],
    ['a curve dropped onto a graph of another type', null, drop('sensor.power_kw', 'binary_sensor.a')],
    ['a timeline row moved before another', null, drop('binary_sensor.b', 'binary_sensor.a', 0)],
    ['a curve moved before another', null, drop('sensor.power_kw', 'sensor.power', 0)],
    ['an interpolation', null, `I.setInterpolation(G('sensor.power'), [G('sensor.power').entities[0]], 'makima')`],
    ['a curve added', null, `I.addCurves(['sensor.rain'], 'default')`],
    ['the time range', null, `I.applyTimeRange(48, true); I.writeLocalState()`],
];
const DYNAMIC_ONLY = [
    ['a curve deleted', null, `I.deleteCurve(G('sensor.power_kw'), X(G('sensor.power_kw'), 'sensor.power_kw'))`],
    ['a graph removed', null, `I.removeGraph(G('binary_sensor.a'))`],
    ['a curve split, then a graph moved', split('sensor.power_kw'), `I.moveGraph(G('binary_sensor.a'), G('sensor.power'), true)`],
    ['the magnifier\'s mode', null, `I.setZoomBoxMode('y')`],
];

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    for( const [cfg, label, cases] of [[DYNAMIC, 'entities added from the card', [...COMMON, ...DYNAMIC_ONLY]], [YAML, 'a YAML card, enableMultidevicePersistence', COMMON]] ) {
        for( const [what, before, change] of cases ) {
            const t = await openCard(cfg, { height: 1200, mock: { series: true } });
            if( cfg === DYNAMIC ) {
                await t.E(`el.instance.addCurves(['sensor.power', 'sensor.power_kw'], 'default')`); await t.wait(400);
                await t.E(`el.instance.addCurves(['binary_sensor.a', 'binary_sensor.b'], 'default')`);
            }
            await t.wait(1500);
            const key = 'history-explorer_card_' + await t.E('el.instance.id');
            // (what Home Assistant holds of the card, as the card reads it: each device's images of
            // the sources — ha_*, yaml_* — left out, an entity's fields in any order, those kept on
            // each device — card-storage.js LOCAL_ONLY_FIELDS — left out; what's shown: the graphs,
            // the range, the magnifier's mode)
            const ha = async () => {
                const v = await t.E(`__getUD(${JSON.stringify(key)})`) ?? {};
                const entry = e => typeof e === 'string' ? e : Object.fromEntries(Object.keys(e).filter(k => !LOCAL.includes(k)).sort().map(k => [k, e[k]]));
                return JSON.stringify(Object.keys(v).filter(k => !/^(ha|yaml)_/.test(k)).sort().map(k => [k, k === 'entities' ? v[k].map(entry) : v[k]]));
            };
            const look = async () => (await t.graphs()).map(g => g.split('@')[0]).join(' | ') + ` — ${await t.E('el.instance.activeRange.timeRangeHours')} h, ${await t.E('el.instance.state.zoomBox')}`;
            const local = v => t.E(v === null ? `localStorage.removeItem(${JSON.stringify(key)})` : `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(v)})`);
            const reload = async () => { await t.page.reload(); await t.wait(3500); };
            await t.step(`${label}: ${what} — the same after a reload, on a new device, on a device that saw the card before; Home Assistant left as it was by a device that only loads it`, async () => {
                if( before ) { await t.E(`(()=>{ ${H} ${before}; })()`); await t.wait(1500); }
                const older = await t.E(`localStorage.getItem(${JSON.stringify(key)})`);
                await t.E(`(()=>{ ${H} ${change}; })()`); await t.wait(1500);
                const shown = await look(), saved = await ha();
                const r = {};
                await reload();
                if( await look() !== shown ) r.reload = await look();
                await local(older); await reload();
                if( await look() !== shown ) r.older = await look();
                if( await ha() !== saved ) r.olderWrote = await ha();
                await local(null); await reload();
                if( await look() !== shown ) r.fresh = await look();
                if( await ha() !== saved ) r.freshWrote = await ha();
                return Object.keys(r).length === 0 ? true : JSON.stringify({ shown, ...r });
            });
            done(await t.close());
        }
    }

    return { passed, failed };
};
