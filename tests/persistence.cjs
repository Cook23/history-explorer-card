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
        return { type: g.entities[i].type ?? g.type, interpolation: d?.hecInterpolation ?? null, hidden: !!d?.hidden, graphs: el.instance.graphs.length }; })()`);
    const menu = (id, act) => t.E(`(()=>{ const I=el.instance; const g=I.graphs.find(g=>g.entities.some(e=>e.entity==='${id}'));
        I.showEntityTypeMenu(0, '${id}', g, { from: 'label', clientX: 100, clientY: 100 }); ${act} })()`);
    // (a line of the menu clicked: an algorithm, et_0_algo_<name>; a display type, et_0_<its index> —
    // card-menus.js _TYPE_MENU_DEFS)
    const TYPE_LINE = { 'line/lines': 0, 'line/curves': 1, 'line/stepped': 2, 'bar/null': 3, 'arrowline/null': 4, 'timeline/null': 5, 'line/smart': 6 };
    const clickType = (type, mode) => `el.querySelector('#et_0_${TYPE_LINE[type + '/' + mode]}').click();`;
    const setInterp = (id, a) => menu(id, `el.querySelector('#et_0_algo_${a}').click();`).then(() => t.wait(500));
    const setType = (id, type, mode) => menu(id, clickType(type, mode ?? null)).then(() => t.wait(1500));
    const legendPtOf = id => t.E(`(()=>{ const all=el.instance.graphsInDisplayOrder(); const gi=all.findIndex(g=>g.entities.some(e=>e.entity==='${id}'));
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
    // A snapshot without what stays on its device (a curve hidden: card-storage.js,
    // ENTITY_FIELD_SCOPE)
    const devicesPart = s => JSON.stringify(Object.fromEntries(Object.entries(s).map(([k, e]) => [k, e && { ...e, hidden: undefined }])));
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

    // ── The graph menu: the same as the type menu of each of its entities ──
    // (on the graph of sensor.power: Steffen for its curves, then bars)
    const graphMenu = act => t.E(`(()=>{ const I=el.instance; const g=I.graphs.find(g=>g.entities.some(e=>e.entity==='sensor.power')); I.showGraphMenu(0, g, 100, 100); ${act} })()`);
    const viaGraphMenu = async () => {
        await graphMenu(`el.querySelector('#et_0_algo_steffen').click();`); await t.wait(500);
        await graphMenu(clickType('bar', null)); await t.wait(1500);
    };
    const viaTypeMenus = async () => {
        for( const id of ['sensor.power', 'sensor.power2'] ) await setInterp(id, 'steffen');
        for( const id of ['sensor.power', 'sensor.power2'] ) await setType(id, 'bar', null);
    };
    const both = async () => [await entry('sensor.power'), await entry('sensor.power2')].map(e => [e.type, e.lineMode, e.interpolation].join('/')).join(' ');
    // (bars saved with lineMode lines, as the type menu saves them)
    const asBars = 'bar/lines/steffen bar/lines/steffen';
    const asYaml = 'line/curves/ line/curves/';
    for( const [name, extra] of [['no persistence', {}], ['enable_persistence', { enable_persistence: 'entities' }], ['enable_multidevice_persistence', { enable_multidevice_persistence: 'entities' }]] ) {
        // What the type menus save, on this device and on another one
        t = await openCard(YAML(extra), { mock: { series: true }, height: 1200 });
        await viaTypeMenus(); await reload();
        const typeMenus = { after: await both() };
        await newDevice(); typeMenus.other = await both();
        done(await t.close());
        t = await openCard(YAML(extra), { mock: { series: true }, height: 1200 });
        await t.step(`${name}: the graph menu changes and saves what the type menu of each of its entities does`, async () => {
            await viaGraphMenu(); const now = await both(); const g = (await shown('sensor.power')).graphs;
            await reload(); const after = await both(); const s = [await shown('sensor.power'), await shown('sensor.power2')];
            await newDevice(); const other = await both();
            const kept = name !== 'no persistence';
            const ok = now === asBars && g === 2 && after === typeMenus.after && other === typeMenus.other
                && after === ( kept ? asBars : asYaml ) && other === ( name === 'enable_multidevice_persistence' ? asBars : asYaml )
                && ( !kept || s.every(x => x.type === 'bar' && x.interpolation === 'steffen' && x.graphs === 2) );
            return ok ? true : JSON.stringify({ now, g, after, s, other, typeMenus });
        });
        done(await t.close());
    }

    // ── The graph menu on entities added from the card (combined in one graph): kept, the graph one graph ──
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, combineSameUnits: true, graphs: [] }, { mock: { series: true }, height: 1200 });
    await t.step('entities added from the card: a graph made a timeline from its menu, one timeline after a reload and on another device', async () => {
        await t.E(`(()=>{ const I=el.instance; I.addCurves(['sensor.power','sensor.power_kw'], 'line', 'smart'); })()`);
        await t.wait(2000);
        const look = () => t.E(`el.instance.graphsInDisplayOrder().map(g=>g.type+':'+g.entities.map(e=>e.entity.split('.')[1]).join('+')).join(' | ')`);
        const before = await look();
        await graphMenu(clickType('timeline', null)); await t.wait(1500);
        const now = await look(); await reload(); const after = await look(); await newDevice(); const other = await look();
        return before === 'line:power+power_kw' && now === 'timeline:power+power_kw' && after === now && other === now ? true : JSON.stringify({ before, now, after, other });
    });
    done(await t.close());

    // ── Timelines added from the card, split then grouped again on one device: the other device,
    // which last saw them split, shows them grouped — and keeps them so in Home Assistant ──
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, graphs: [] }, { mock: { series: true }, height: 1200 });
    await t.step('3 timelines split, grouped again by drags on one device: the other device, which saw them split, shows them grouped, Home Assistant too, and so does the first after a reload', async () => {
        for( const id of ['binary_sensor.a', 'binary_sensor.b', 'climate.salon'] ) { await t.E(`el.instance.addCurves(['${id}'], 'default')`); await t.wait(300); }
        await t.wait(1500);
        const look = async () => (await t.graphs()).map(g => g.split('@')[0]).join(' | ');
        const rowOf = async id => t.E(`(()=>{ const all=el.instance.graphsInDisplayOrder(); const gi=all.findIndex(g=>g.entities.some(e=>e.entity==='${id}'));
            return tlPt(gi, all[gi].entities.findIndex(e=>e.entity==='${id}')); })()`);
        const ha = () => t.E(`__getUD('history-explorer_card_' + el.instance.id)`).then(v => (v?.entities ?? []).map(e => e.entity.split('.')[1] + '@' + e.groupId).join(' '));
        const grouped = await look();
        for( const id of ['binary_sensor.b', 'climate.salon'] ) { await t.dblclick(await rowOf(id)); await t.wait(1000); }
        const split = await look();
        // (the other device: it last saw them split)
        const other = await t.E(`localStorage.getItem('history-explorer_card_' + el.instance.id)`);
        for( const id of ['binary_sensor.b', 'climate.salon'] ) { const a = await rowOf(id), c = await rowOf('binary_sensor.a'); await t.drag(a, { x: c.x, y: c.y + 4 }); await t.wait(1000); }
        const regrouped = await look(), haRegrouped = await ha();
        await t.E(`localStorage.setItem('history-explorer_card_' + el.instance.id, ${JSON.stringify('X')}.replace('X', ${JSON.stringify(other)}))`);
        await reload();
        const onOther = await look(), haAfterOther = await ha();
        await reload();
        const back = await look();
        const one = x => /^t:[a-z+]+$/.test(x) && x.split('+').length === 3;
        return one(grouped) && split.split(' | ').length === 3 && one(regrouped) && one(onOther) && haAfterOther === haRegrouped && one(back) ? true
            : JSON.stringify({ grouped, split, regrouped, haRegrouped, onOther, haAfterOther, back });
    });
    done(await t.close());

    // ── A device that only loads the card writes nothing new to Home Assistant: the graphs'
    // places saved as a load rebuilds them (renumberGraphs) ──
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, combineSameUnits: true, graphs: [] }, { mock: { series: true }, height: 1200 });
    await t.step('a curve split, a curve made a timeline, a graph moved on one device: the other device, loading the card, leaves Home Assistant as it was', async () => {
        await t.E(`el.instance.addCurves(['sensor.power', 'sensor.power_kw', 'sensor.rain'], 'default')`); await t.wait(400);
        await t.E(`el.instance.addCurves(['binary_sensor.a', 'binary_sensor.b'], 'default')`); await t.wait(1500);
        const key = 'history-explorer_card_' + await t.E('el.instance.id');
        const ha = async () => JSON.stringify((await t.E(`__getUD(${JSON.stringify(key)})`)).entities.map(e => [e.entity, e.groupId, e.graphIndex, e.type]));
        const r = {};
        for( const [name, act] of [
            ['split', `I.splitCurve(G('sensor.power_kw'), G('sensor.power_kw').entities.findIndex(e => e.entity === 'sensor.power_kw'))`],
            ['timeline', `I.setCurveType(G('sensor.rain'), G('sensor.rain').entities.findIndex(e => e.entity === 'sensor.rain'), 'timeline', null)`],
            ['moved', `I.moveGraph(G('binary_sensor.a'), G('sensor.power'), true)`]] ) {
            const other = await t.E(`localStorage.getItem(${JSON.stringify(key)})`);
            await t.E(`(()=>{ const I = el.instance; const G = id => I.graphsInDisplayOrder().find(g => g.entities.some(e => e.entity === id)); ${act}; })()`); await t.wait(1500);
            const before = await ha();
            await t.E(`localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify('X')}.replace('X', ${JSON.stringify(other)}))`);
            await reload();
            const after = await ha();
            if( after !== before ) r[name] = { before, after };
        }
        return Object.keys(r).length === 0 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── YAML entities, enable_multidevice_persistence ──
    t = await openCard(YAML({ enable_multidevice_persistence: 'entities' }), { mock: { series: true }, height: 1200 });
    await t.step('enable_multidevice_persistence: another device gets every change — a curve hidden aside, kept on its device', async () => {
        await changeAll();
        const a = await snapshot();
        await newDevice();
        const b = await snapshot(); const s = await shown('sensor.power');
        return a.power2.hidden === true && !b.power2.hidden && devicesPart(a) === devicesPart(b) && s.interpolation === 'makima' ? true : JSON.stringify({ a, b, s });
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
    await t.step('the magnifier\'s mode, kept as the range is: chosen on this device (the Y axis), kept after a reload and on another device', async () => {
        const mode = () => t.E('el.instance.state.zoomBox + "/" + graphAt(0).chart.options.zoomBoxAxes');
        const m0 = await mode();
        await t.E(`(()=>{ const r=el.querySelector('#bz_0'); r.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); })()`); await t.wait(300);
        await t.E(`el.querySelector('#ez_0_y').click()`); await t.wait(1500);
        const m1 = await mode();
        await reload(); const m2 = await mode();
        await newDevice(); const m3 = await mode();
        return m0 === 'xy/xy' && m1 === 'y/y' && m2 === 'y/y' && m3 === 'y/y' ? true : [m0, m1, m2, m3].join(' → ');
    });
    await t.step('range: a change of defaultTimeRange in the YAML wins', async () => {
        await reload(YAML({ enable_multidevice_persistence: 'range', defaultTimeRange: '12' }));
        const r = await range();
        return r.startsWith('12:') ? true : r;
    });
    await t.step('the magnifier\'s mode: a change of defaultMagnifierMode in the YAML wins, then the next choice made on the card', async () => {
        const mode = () => t.E('el.instance.state.zoomBox + "/" + graphAt(0).chart.options.zoomBoxAxes');
        await reload(YAML({ enable_multidevice_persistence: 'range', defaultTimeRange: '12', defaultMagnifierMode: 'x' }));
        const m1 = await mode();
        await t.E(`(()=>{ const r=el.querySelector('#bz_0'); r.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); })()`); await t.wait(300);
        await t.E(`el.querySelector('#ez_0_y').click()`); await t.wait(1500);
        await reload(); const m2 = await mode();
        return m1 === 'x/x' && m2 === 'y/y' ? true : [m1, m2].join(' → ');
    });
    done(await t.close());

    // ── The magnifier's mode, nothing persisted: always the YAML's (defaultMagnifierMode) ──
    t = await openCard(YAML({ defaultMagnifierMode: 'y' }), { mock: { series: true }, height: 1200 });
    await t.step('the magnifier\'s mode, nothing persisted: the YAML\'s at each opening, whatever was chosen on the card', async () => {
        const mode = () => t.E('el.instance.state.zoomBox + "/" + graphAt(0).chart.options.zoomBoxAxes');
        const m0 = await mode();
        await t.E(`(()=>{ const r=el.querySelector('#bz_0'); r.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); })()`); await t.wait(300);
        await t.E(`el.querySelector('#ez_0_x').click()`); await t.wait(1500);
        const m1 = await mode();
        await reload(); const m2 = await mode();
        return m0 === 'y/y' && m1 === 'x/x' && m2 === 'y/y' ? true : [m0, m1, m2].join(' → ');
    });
    done(await t.close());

    // ── Entities added from the card: always kept, and on every device ──
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, graphs: [] }, { mock: { series: true }, height: 1200 });
    await t.step('entities added from the card: every change kept on another device — a curve hidden aside', async () => {
        await t.E(`(()=>{ const I=el.instance; I.addCurves(['sensor.power','sensor.power2','sensor.energy'], 'default'); })()`);
        await t.wait(2000);
        await setInterp('sensor.power', 'makima');
        await setType('sensor.power2', 'line', 'stepped');
        await toggleHidden('sensor.power2');
        await setInterval_('sensor.energy', 2);
        const a = await snapshot();
        await newDevice();
        const b = await snapshot(); const s = await shown('sensor.power');
        return a.power.interpolation === 'makima' && a.power2.lineMode === 'stepped' && a.power2.hidden && a.energy.interval === 2 &&
            !b.power2.hidden && devicesPart(a) === devicesPart(b) && s.interpolation === 'makima' ? true : JSON.stringify({ a, b, s });
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
    const add = id => t.E(`(()=>{ const I=el.instance; I.addCurves(['${id}'], 'default'); })()`);
    // Each graph: its entities, in display order
    const layout = () => t.E(`el.instance.graphsInDisplayOrder().map(g=>g.entities.map(e=>e.entity.split('.')[1]).join('+')).join(' | ')`);
    const graphPtOf = id => t.E(`(()=>{ const gi=el.instance.graphsInDisplayOrder().findIndex(g=>g.entities.some(e=>e.entity==='${id}')); return graphPtAt(gi, 0.15); })()`);
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

    // ── Card ▸ Default graphs / Default display, each confirmed in a submenu ──
    t = await openCard(YAML({ enable_multidevice_persistence: 'all' }), { mock: { series: true }, height: 1400 });
    const add2 = id => t.E(`(()=>{ const I=el.instance; I.addCurves(['${id}'], 'default'); })()`);
    const ids = () => t.E(`el.instance.graphs.flatMap(g=>g.entities.map(e=>e.entity.split('.')[1])).sort().join(',')`);
    const visible = sel => t.E(`(()=>{ const e=el.querySelector('${sel}'); return !!e && e.style.display !== 'none'; })()`);
    const cardAction = async k => {
        await t.E(`el.querySelector('#bo_0').click()`); await t.wait(300);
        await t.E(`el.querySelector('#eo_0_card').click()`); await t.wait(300);
        await t.E(`el.querySelector('#eo_0_${k}').click()`); await t.wait(300);
    };
    await add2('sensor.rain'); await t.wait(1200);
    await setInterp('sensor.power', 'makima');
    await t.step('Card ▸ Default graphs: confirmed in a submenu over Card ▸, right-aligned, Cancel marked; Cancel, or Enter: nothing changes', async () => {
        const i0 = await ids();
        await cardAction('defgraphs');
        const r = await t.E(`(()=>{ const c=el.querySelector('#eo_0_defgraphs_sub'), s=el.querySelector('#eo_0_card_sub');
            return { shown: c.style.display !== 'none', right: Math.round(c.getBoundingClientRect().right - s.getBoundingClientRect().right),
                     marked: el.querySelector('#eo_0_defgraphs_cancel').dataset.selected === '1', lines: [...c.children].map(a=>a.textContent).join('|') }; })()`);
        await t.E(`el.querySelector('#eo_0_defgraphs_cancel').click()`); await t.wait(300);
        const afterCancel = { confirm: await visible('#eo_0_defgraphs_sub'), card: await visible('#eo_0_card_sub'), ids: await ids() };
        await t.E(`el.querySelector('#eo_0_defgraphs').click()`); await t.wait(300);
        await t.page.keyboard.press('Enter'); await t.wait(500);
        const afterEnter = await ids();
        await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 5); await t.wait(300);
        return r.shown && r.right === 0 && r.marked && r.lines === 'Confirm|Cancel' && !afterCancel.confirm && afterCancel.card && afterCancel.ids === i0 && afterEnter === i0
            ? true : JSON.stringify({ i0, r, afterCancel, afterEnter });
    });
    await t.step('Default graphs confirmed: the graphs added from the card removed, the YAML\'s kept as changed — on another device too', async () => {
        await cardAction('defgraphs'); await t.E(`el.querySelector('#eo_0_defgraphs_ok').click()`); await t.wait(1200);
        const here = { ids: await ids(), interp: (await entry('sensor.power')).interpolation, menu: await visible('#eo_0') };
        await newDevice(); const other = { ids: await ids(), interp: (await entry('sensor.power')).interpolation };
        return !/rain/.test(here.ids) && here.interp === 'makima' && !here.menu && !/rain/.test(other.ids) && other.interp === 'makima'
            ? true : JSON.stringify({ here, other });
    });
    await t.step('Default display confirmed: back to the YAML — added graphs, changes, hidden curves, time range — on another device too (hidden: this device\'s own)', async () => {
        await add2('sensor.tank'); await t.wait(1200);
        await setType('sensor.power2', 'line', 'stepped'); await toggleHidden('sensor.power');
        await t.E(`(()=>{ el.instance.applyTimeRange(48, true); el.instance.writeLocalState(); })()`); await t.wait(800);
        const before = { ids: await ids(), mode: (await entry('sensor.power2')).lineMode, range: await t.E('el.instance.activeRange.timeRangeHours') };
        await cardAction('defdisplay'); await t.E(`el.querySelector('#eo_0_defdisplay_ok').click()`); await t.wait(1500);
        const here = { ids: await ids(), interp: (await entry('sensor.power')).interpolation, mode: (await entry('sensor.power2')).lineMode,
                       hidden: (await shown('sensor.power')).hidden, range: await t.E('el.instance.activeRange.timeRangeHours') };
        await reload(); const reloaded = { ids: await ids(), interp: (await entry('sensor.power')).interpolation, range: await t.E('el.instance.activeRange.timeRangeHours') };
        await newDevice(); const other = { ids: await ids(), interp: (await entry('sensor.power')).interpolation, mode: (await entry('sensor.power2')).lineMode, range: await t.E('el.instance.activeRange.timeRangeHours') };
        const yaml = x => x.ids === 'energy,power,power2' && x.interp === null && x.range === 24;
        return /tank/.test(before.ids) && before.mode === 'stepped' && before.range === 48 && yaml(here) && here.mode === 'curves' && !here.hidden
            && yaml(reloaded) && yaml(other) && other.mode === 'curves' ? true : JSON.stringify({ before, here, reloaded, other });
    });
    done(await t.close());

    // ── Home Assistant answers as a real one does, not at once: the card is shown from this
    // device's own state, its user data read meanwhile, the history loading ──
    t = await openCard(YAML({ enable_multidevice_persistence: 'all' }), { mock: { series: true, historyDelay: 2000, userDataDelay: 800 }, height: 1200 });
    await t.wait(2500);
    const key = await t.E(`'history-explorer_card_' + el.instance.id`);
    const saved = () => t.E(`(async()=>{ const ha=(await el.instance._hass.callWS({ type: 'frontend/get_user_data', key: '${key}' })).value, l=JSON.parse(localStorage.getItem('${key}'));
        return { shown: el.instance.activeRange.timeRangeHours, ha: ha?.timeRangeHours, local: l?.timeRangeHours, image: l?.ha_timeRangeHours }; })()`);
    const anotherDevice = h => t.E(`(async()=>{ const hs=el.instance._hass, v=(await hs.callWS({ type: 'frontend/get_user_data', key: '${key}' })).value;
        v.timeRangeHours=${h}; v.timeRangeMinutes=0; await hs.callWS({ type: 'frontend/set_user_data', key: '${key}', value: v }); })()`);
    await t.step('slow Home Assistant: another device changed the range, it answers while the history loads — the range taken, Home Assistant not overwritten', async () => {
        await t.E('(()=>{ el.instance.applyTimeRange(6, true); el.instance.writeLocalState(); })()'); await t.wait(3500);
        await anotherDevice(12);
        await t.page.reload(); await t.wait(6000);
        const s = await saved();
        return s.shown === 12 && s.ha === 12 && s.local === 12 && s.image === 12 ? true : JSON.stringify(s);
    });
    await t.step('slow Home Assistant, nothing changed elsewhere (this device\'s own last write coming back): the graphs shown before it answers, and not rebuilt', async () => {
        await t.page.reload(); await t.wait(400);
        const early = await t.E('el.instance.graphs.length > 0 && !!el.instance.graphs[0]?.chart');
        await t.E('window.__chart = el.instance.graphs[0]?.chart');
        await t.wait(5000);
        const same = await t.E('!!window.__chart && window.__chart === el.instance.graphs[0]?.chart'), s = await saved();
        return early && same && s.shown === 12 && s.ha === 12 ? true : JSON.stringify({ early, same, s });
    });
    await t.step('slow Home Assistant: a change made on the card before it answers is kept, and saved there', async () => {
        await t.page.reload(); await t.wait(400);
        await t.E(`(()=>{ const I=el.instance, g=I.graphs.find(g=>g.entities.some(e=>e.entity==='sensor.power')); I.setInterpolation(g, g.entities.filter(e=>e.entity==='sensor.power'), 'makima'); })()`);
        await t.wait(5000);
        const b = await entry('sensor.power');
        const ha = await t.E(`(async()=>{ const v=(await el.instance._hass.callWS({ type: 'frontend/get_user_data', key: '${key}' })).value; return (v.entities||[]).find(e=>(e.entity??e)==='sensor.power')?.interpolation; })()`);
        return b.interpolation === 'makima' && ha === 'makima' ? true : JSON.stringify({ b, ha });
    });
    done(await t.close());

    // ── The Y axes' padlock: locked from the graph's menu or by a gesture on a Y axis, kept on
    // this device with its ranges, as a hidden curve — after a reload, when the graph is built
    // again; not kept without enable_persistence (a YAML card's default) ──
    const DYNAMIC = { type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, combineSameUnits: true, graphs: [] };
    // (graph 0's lock and its left Y axis' range)
    const lock = () => t.E(`(()=>{ const c = graphAt(0).chart; return (c.hecYAxisLocked() ? 'locked ' : 'free ') + yRange(0).join(' '); })()`);
    const menuLock = async () => { await t.longPress(await t.E('moPt(0)')); await t.wait(300); await t.E(`el.querySelector('#et_0_behavior').click()`); await t.wait(300); await t.E(`el.querySelector('#et_0_ylock').click()`); await t.wait(900); };
    t = await openCard(DYNAMIC, { mock: { series: true }, height: 1200 });
    await t.E(`el.instance.addCurves(['sensor.power', 'sensor.power_kw'], 'default')`); await t.wait(1500);
    await t.step('the padlock closed from the graph\'s menu: locked on the same range after a reload; opened: free after a reload', async () => {
        await menuLock(); const a = await lock();
        await reload(); const b = await lock();
        await menuLock(); const c = await lock();
        await reload(); const d = await lock();
        return a.startsWith('locked') && b === a && c.startsWith('free') && d.startsWith('free') ? true : JSON.stringify({ a, b, c, d });
    });
    await t.step('a Y axis dragged (the lock engaged by the gesture): locked on the range dragged to, after a reload and when the graph is built again (its interpolation changed)', async () => {
        const pt = await t.E('yaPt(0,0.5)');
        await t.drag(pt, { x: pt.x, y: pt.y + 60 }); await t.wait(900);
        const a = await lock();
        await reload(); const b = await lock();
        await t.E(`(()=>{ const g = graphAt(0); el.instance.setInterpolation(g, g.entities, 'makima'); })()`); await t.wait(900);
        const c = await lock();
        return a.startsWith('locked') && b === a && c === a ? true : JSON.stringify({ a, b, c });
    });
    done(await t.close());

    t = await openCard(YAML(), { mock: { series: true }, height: 1200 });
    await t.wait(1000);
    await t.step('a YAML card without persistence: the padlock closed, free again after a reload — as a hidden curve', async () => {
        await menuLock(); const a = await lock();
        await reload(); const b = await lock();
        return a.startsWith('locked') && b.startsWith('free') ? true : JSON.stringify({ a, b });
    });
    done(await t.close());

    t = await openCard(YAML({ enable_persistence: 'entities' }), { mock: { series: true }, height: 1200 });
    await t.wait(1000);
    await t.step('a YAML card with enable_persistence: entities — the padlock kept on this device after a reload; a new device (nothing saved on it): free', async () => {
        await menuLock(); const a = await lock();
        await reload(); const b = await lock();
        const key = 'history-explorer_card_' + await t.E('el.instance.id');
        await t.E(`localStorage.removeItem(${JSON.stringify(key)})`); await reload();
        const c = await lock();
        return a.startsWith('locked') && b === a && c.startsWith('free') ? true : JSON.stringify({ a, b, c });
    });
    done(await t.close());

    return { passed, failed };
};
