// Persistence of what can be changed from the card itself (interpolation, line mode, display
// type, hidden, bar interval, split into a linked graph), and "last one to speak wins"
// between the YAML, this device (localStorage) and Home Assistant (the other devices)
const { openCard } = require('./lib.cjs');

const YAML = (extra = {}, power = {}) => ({
    type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, ...extra,
    graphs: [
        { type: 'line', entities: [{ entity: 'sensor.power', lineMode: 'curves', ...power }, { entity: 'sensor.power2', lineMode: 'curves' }] },
        { type: 'bar', entities: [{ entity: 'sensor.energy' }] },
    ],
});

// The fields of an entity that can be changed from the card
const FIELDS = ['type', 'lineMode', 'interpolation', 'hidden', 'interval', 'groupId'];

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };
    let t;

    // ── Helpers (t is the current page) ──
    const entry = id => t.E(`(()=>{ const e=el.instance.pconfig.entities.find(x=>x.entity==='${id}'); return e ? Object.fromEntries(${JSON.stringify(FIELDS)}.map(k=>[k, e[k] ?? null])) : null; })()`);
    const shown = id => t.E(`(()=>{ const g=el.instance.graphs.find(g=>g.entities.some(e=>e.entity==='${id}')); if( !g ) return null;
        const i=g.entities.findIndex(e=>e.entity==='${id}'); const d=g.chart.data.datasets[i];
        return { type: g.entities[i].type ?? g.type, interpolation: d?.hecInterpolation ?? null, hidden: !!(g.chart.getDatasetMeta(i).hidden ?? d?.hidden), graphs: el.instance.graphs.length }; })()`);
    const menu = (id, act) => t.E(`(()=>{ const I=el.instance; const g=I.graphs.find(g=>g.entities.some(e=>e.entity==='${id}'));
        I.showEntityTypeMenu(0, '${id}', g, 100, 100); ${act} })()`);
    const setInterp = (id, a) => menu(id, `I.entityInterpolationClicked(0, '${a}');`).then(() => t.wait(500));
    const setType = (id, type, mode) => menu(id, `I.entityTypeMenuClicked(0, '${type}', ${mode ? `'${mode}'` : 'null'});`).then(() => t.wait(1500));
    const legendPtOf = id => t.E(`(()=>{ const all=el.instance._allGraphsInDisplayOrder(); const gi=all.findIndex(g=>g.entities.some(e=>e.entity==='${id}'));
        return legendPt(gi, all[gi].entities.findIndex(e=>e.entity==='${id}')); })()`);
    const toggleHidden = async id => { const p = await legendPtOf(id); await t.page.mouse.click(p.x, p.y); await t.wait(800); };
    const split = async id => { await t.dblclick(await legendPtOf(id)); await t.wait(800); };
    const setInterval_ = (id, v) => t.E(`(()=>{ const g=el.instance.graphs.find(g=>g.entities.some(e=>e.entity==='${id}'));
        const s=el.instance._this.querySelector('#bd-'+g.id); s.value='${v}'; s.dispatchEvent(new Event('change')); })()`).then(() => t.wait(1500));
    const reload = async (cfg) => {
        if( cfg ) { const name = await t.E('window.CFG.cardName'); await t.page.addInitScript(c => { window.CFG = c; }, { ...cfg, cardName: name }); }
        await t.page.reload(); await t.wait(3500);
    };
    const newDevice = async () => { await t.E('localStorage.clear()'); await reload(); };
    // Every change made from the card, on sensor.power (line) and sensor.energy (bar)
    const changeAll = async () => {
        await setInterp('sensor.power', 'makima');
        await setType('sensor.power2', 'line', 'stepped');
        await toggleHidden('sensor.power2');
        await setInterval_('sensor.energy', 2);
        await split('sensor.power');
    };
    const snapshot = async () => ({ power: await entry('sensor.power'), power2: await entry('sensor.power2'), energy: await entry('sensor.energy') });
    const changed = s => s.power.interpolation === 'makima' && s.power2.lineMode === 'stepped' && s.power2.hidden === true && s.energy.interval === 2;
    const yamlLike = s => s.power.interpolation === null && s.power2.lineMode === 'curves' && !s.power2.hidden && s.energy.interval !== 2;

    // ── YAML entities, no persistence: the YAML comes back on reload ──
    t = await openCard(YAML(), { mock: { series: true }, height: 1200 });
    await t.step('YAML entities, no persistence: every change made, then the YAML back after a reload', async () => {
        await changeAll();
        const a = await snapshot(); const g0 = (await shown('sensor.power')).graphs;
        await reload();
        const b = await snapshot(); const g1 = (await shown('sensor.power')).graphs;
        return changed(a) && g0 === 3 && yamlLike(b) && g1 === 2 ? true : JSON.stringify({ a, g0, b, g1 });
    });
    done(await t.close());

    // ── YAML entities, enable_persistence: kept on this device only ──
    t = await openCard(YAML({ enable_persistence: 'entities' }), { mock: { series: true }, height: 1200 });
    await t.step('enable_persistence: every change kept after a reload, and shown', async () => {
        await changeAll();
        const a = await snapshot();
        await reload();
        const b = await snapshot(); const s = await shown('sensor.power'); const s2 = await shown('sensor.power2');
        return changed(b) && JSON.stringify(a) === JSON.stringify(b) && s.interpolation === 'makima' && s.graphs === 3 && s2.hidden ? true : JSON.stringify({ a, b, s, s2 });
    });
    await t.step('enable_persistence: a type change of a YAML entity kept (curve to bars)', async () => {
        await setType('sensor.power2', 'bar', null);
        await reload();
        const b = await entry('sensor.power2'); const s = await shown('sensor.power2');
        return b.type === 'bar' && s.type === 'bar' ? true : JSON.stringify({ b, s });
    });
    await t.step('enable_persistence: another device (empty local storage) gets the YAML', async () => {
        await newDevice();
        const b = await snapshot();
        return yamlLike(b) ? true : JSON.stringify(b);
    });
    done(await t.close());

    // ── YAML entities, enable_multidevice_persistence ──
    t = await openCard(YAML({ enable_multidevice_persistence: 'entities' }), { mock: { series: true }, height: 1200 });
    await t.step('enable_multidevice_persistence: another device gets every change', async () => {
        await changeAll();
        const a = await snapshot();
        await newDevice();
        const b = await snapshot(); const s = await shown('sensor.power');
        return changed(b) && JSON.stringify(a) === JSON.stringify(b) && s.interpolation === 'makima' ? true : JSON.stringify({ a, b, s });
    });
    await t.step('last one to speak: a change made on another device wins over this device\'s own state', async () => {
        const mine = await t.E(`localStorage.getItem('history-explorer_card_' + el.instance.id)`);
        await setInterp('sensor.power', 'catmullrom');          // the other device speaks (HA)
        await t.E(`localStorage.setItem('history-explorer_card_' + el.instance.id, ${JSON.stringify('X')}.replace('X', ${JSON.stringify(mine)}))`);
        await reload();                                          // this device, with its older state
        const b = await entry('sensor.power');
        return b.interpolation === 'catmullrom' ? true : JSON.stringify(b);
    });
    await t.step('last one to speak: a change of the YAML wins over what was saved', async () => {
        await reload(YAML({ enable_multidevice_persistence: 'entities' }, { interpolation: 'steffen', lineMode: 'smart' }));
        const b = await entry('sensor.power'); const s = await shown('sensor.power');
        return b.interpolation === 'steffen' && b.lineMode === 'smart' && s.interpolation === 'steffen' ? true : JSON.stringify({ b, s });
    });
    await t.step('...and the next change made on the card wins again over that YAML', async () => {
        await setInterp('sensor.power', 'monotone');
        await reload();
        const b = await entry('sensor.power');
        return b.interpolation === 'monotone' ? true : JSON.stringify(b);
    });
    await t.step('a new device, the YAML changed since the last save: the YAML wins there too', async () => {
        await t.E('localStorage.clear()');
        await reload(YAML({ enable_multidevice_persistence: 'entities' }, { interpolation: 'catmullrom' }));
        const b = await entry('sensor.power');
        return b.interpolation === 'catmullrom' ? true : JSON.stringify(b);
    });
    done(await t.close());

    // ── The time range, enable_multidevice_persistence: range ──
    t = await openCard(YAML({ enable_multidevice_persistence: 'range', defaultTimeRange: '24' }), { mock: { series: true }, height: 1200 });
    const range = () => t.E('[el.instance.activeRange.timeRangeHours, el.instance.activeRange.timeRangeMinutes].join(":")');
    await t.step('range: zoomed out on this device, kept after a reload and on another device', async () => {
        const r0 = await range();
        await t.E('el.instance.decZoom()'); await t.wait(1500);
        const r1 = await range();
        await reload(); const r2 = await range();
        await newDevice(); const r3 = await range();
        return r1 !== r0 && r2 === r1 && r3 === r1 ? true : [r0, r1, r2, r3].join(' → ');
    });
    await t.step('range: a change of defaultTimeRange in the YAML wins', async () => {
        await reload(YAML({ enable_multidevice_persistence: 'range', defaultTimeRange: '12' }));
        const r = await range();
        return r.startsWith('12:') ? true : r;
    });
    done(await t.close());

    // ── Entities added from the card: always kept, and on every device ──
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, graphs: [] }, { mock: { series: true }, height: 1200 });
    await t.step('entities added from the card: every change kept on another device', async () => {
        await t.E(`(()=>{ const I=el.instance; for( const id of ['sensor.power','sensor.power2','sensor.energy'] ) { const d=I._detectDefaultType(id); I._createAndPersistEntity(id, d.type, d.lineMode); } I.updateHistoryWithClearCache(); I.writeLocalState(); })()`);
        await t.wait(2000);
        await setInterp('sensor.power', 'makima');
        await setType('sensor.power2', 'line', 'stepped');
        await toggleHidden('sensor.power2');
        await setInterval_('sensor.energy', 2);
        const a = await snapshot();
        await newDevice();
        const b = await snapshot(); const s = await shown('sensor.power');
        return a.power.interpolation === 'makima' && a.power2.lineMode === 'stepped' && a.power2.hidden && a.energy.interval === 2 &&
            JSON.stringify(a) === JSON.stringify(b) && s.interpolation === 'makima' ? true : JSON.stringify({ a, b, s });
    });
    await t.step('entities added from the card: a type change kept (curve to bars)', async () => {
        await setType('sensor.power2', 'bar', null);
        await reload();
        const b = await entry('sensor.power2'); const s = await shown('sensor.power2');
        return b.type === 'bar' && s.type === 'bar' ? true : JSON.stringify({ b, s });
    });
    done(await t.close());

    // ── A curve dragged onto another graph: saved only when both graphs' placements are ──
    t = await openCard({ ...YAML(), graphs: [YAML().graphs[0]] }, { mock: { series: true }, height: 1400 });
    const add = id => t.E(`(()=>{ const I=el.instance; const d=I._detectDefaultType('${id}'); I._createAndPersistEntity('${id}', d.type, d.lineMode); I.updateHistoryWithClearCache(); I.writeLocalState(); })()`);
    // Each graph: its entities, in display order
    const layout = () => t.E(`el.instance._allGraphsInDisplayOrder().map(g=>g.entities.map(e=>e.entity.split('.')[1]).join('+')).join(' | ')`);
    const graphPtOf = id => t.E(`(()=>{ const gi=el.instance._allGraphsInDisplayOrder().findIndex(g=>g.entities.some(e=>e.entity==='${id}')); return graphPtAt(gi, 0.15); })()`);
    const dragOnto = async (id, ontoId) => { await t.drag(await legendPtOf(id), await graphPtOf(ontoId)); await t.wait(800); };
    await add('sensor.rain'); await t.wait(400); await add('sensor.tank'); await t.wait(1200);
    const initial = await layout();
    await t.step('a curve added from the card dropped onto a YAML graph: shown there, back in its own graph after a reload', async () => {
        await dragOnto('sensor.rain', 'sensor.power');
        const l1 = await layout(); await reload(); const l2 = await layout();
        return /power\+power2\+rain/.test(l1) && l2 === initial ? true : JSON.stringify({ initial, l1, l2 });
    });
    await t.step('a YAML curve dropped onto a graph added from the card: shown there, back in its YAML graph after a reload, no duplicate', async () => {
        await dragOnto('sensor.power2', 'sensor.rain');
        const l1 = await layout(); await reload(); const l2 = await layout();
        return /rain\+power2|power2\+rain/.test(l1) && l2 === initial ? true : JSON.stringify({ initial, l1, l2 });
    });
    await t.step('between two graphs added from the card: the drop is saved', async () => {
        await dragOnto('sensor.rain', 'sensor.tank');
        const l1 = await layout(); await reload(); const l2 = await layout();
        return /tank\+rain|rain\+tank/.test(l1) && l2 === l1 ? true : JSON.stringify({ l1, l2 });
    });
    done(await t.close());

    return { passed, failed };
};
