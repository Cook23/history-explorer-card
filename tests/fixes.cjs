// Bugs fixed, kept fixed: each test reproduces what went wrong before its fix
const { openCard } = require('./lib.cjs');

const card = (o) => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24h', statistics: { enabled: false }, ...o });

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };
    const layout = t => t.E(`el.instance._allGraphsInDisplayOrder().map(g=>g.type+':'+g.entities.map(e=>e.entity.split('.')[1]).join('+')).join(' | ')`);

    // ── 1.1.52: a curve dropped onto the first graph of a block of linked graphs ──
    let t = await openCard(card({ combineSameUnits: true, graphs: [] }), { height: 1400, mock: { series: true } });
    await t.wait(800);
    const add = async id => { await t.E(`(()=>{ const I=el.instance; I._createAndPersistEntity('${id}', 'line', 'smart'); I.updateHistoryWithClearCache(); })()`); await t.wait(900); };
    await t.step('a curve dropped onto the first graph of a linked block: the block keeps its order', async () => {
        await add('sensor.power'); await add('sensor.power_kw');
        // (power_kw changed to a timeline: a linked graph below power's)
        await t.E(`(()=>{ const I=el.instance; const g=I._allGraphsInDisplayOrder()[0]; I.showEntityTypeMenu(0,'sensor.power_kw',g,100,100); I.entityTypeMenuClicked(0,'timeline',null); })()`); await t.wait(900);
        await add('sensor.power2');
        const before = await layout(t);
        await t.drag(await t.E('legendPt(2,0)'), await t.E('graphPtAt(0,0.15)')); await t.wait(1000);
        const after = await layout(t);
        return before === 'line:power | timeline:power_kw | line:power2' && after === 'line:power+power2 | timeline:power_kw' ? true : JSON.stringify({ before, after });
    });
    done(await t.close());

    // ── 1.1.52: the min/max band shown as soon as its values arrive ──
    t = await openCard(card({ graphs: [{ type: 'line', entities: [{ entity: 'sensor.power', showMinMax: 'history' }] }] }), { height: 700, mock: { series: true } });
    await t.wait(1500);
    await t.step('the min/max band there at load, without waiting for a refresh', async () => {
        const n = await t.E(`el.instance.graphs[0].chart.data.datasets[0].data.filter(p=>p.yMin!=null).length`);
        return n > 1 ? true : `points with min/max: ${n}`;
    });
    done(await t.close());

    // ── 1.1.52: Alt shows the samples on the move itself ──
    t = await openCard(card({ graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { height: 700, mock: { series: true } });
    await t.wait(800);
    await t.step('Alt held: the samples shown on the first move, hidden on the first move once released', async () => {
        const shown = () => t.E(`el.instance.graphs[0].chart.getDatasetMeta(0).data.filter(p=>p._model.radius>0).length`);
        const a = await t.E('graphPtAt(0,0.5)');
        await t.page.mouse.move(a.x, a.y); await t.wait(300);
        await t.page.keyboard.down('Alt'); await t.page.mouse.move(a.x + 20, a.y); await t.wait(1000);
        const n = await shown(); const total = await t.E(`el.instance.graphs[0].chart.getDatasetMeta(0).data.length`);
        await t.page.keyboard.up('Alt'); await t.page.mouse.move(a.x + 40, a.y); await t.wait(1000);
        const after = await shown();
        return n > total / 2 && after <= 1 ? true : JSON.stringify({ n, after, total });
    });
    done(await t.close());

    // ── 1.1.53: Alt released, a graph of curves and bars gets its own hover mode back ──
    t = await openCard(card({ graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.energy', type: 'bar' }] }] }), { height: 700, mock: { series: true } });
    await t.wait(800);
    await t.step('Alt pressed then released on curves and bars: their hover mode back', async () => {
        const mode = () => t.E(`el.instance.graphs[0].chart.options.hover.mode`);
        const m0 = await mode(); const a = await t.E('graphPtAt(0,0.5)');
        await t.page.mouse.move(a.x, a.y); await t.wait(300);
        await t.page.keyboard.down('Alt'); await t.page.mouse.move(a.x + 20, a.y); await t.wait(300); const m1 = await mode();
        await t.page.keyboard.up('Alt'); await t.page.mouse.move(a.x + 40, a.y); await t.wait(300); const m2 = await mode();
        return m0 === 'hecMixed' && m1 === 'dataset' && m2 === m0 ? true : [m0, m1, m2].join(' -> ');
    });
    done(await t.close());

    // ── 1.1.52: recordedEntitiesOnly asks for the last hour with its time zone ──
    t = await openCard(card({ recordedEntitiesOnly: true, graphs: [] }), { mock: { series: true } });
    await t.wait(800);
    await t.step('recorded entities only: the last hour asked with its time zone, the entities found listed', async () => {
        const r = await t.E(`(()=>{ const q=__ws.find(w=>w.type==='history/history_during_period' && !w.end);
            return { start: q?.start ?? null, ago: q ? Date.now() - Date.parse(q.start) : null, listed: el.querySelectorAll('#es_0 a[data-entity]').length }; })()`);
        return /([+-]\d\d:\d\d|Z)$/.test(r.start ?? '') && r.ago > 3500e3 && r.ago < 3700e3 && r.listed > 0 ? true : JSON.stringify(r);
    });
    done(await t.close());

    return { passed, failed };
};
