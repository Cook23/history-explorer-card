// Curves of an entity's attributes: in the YAML (attribute:), from the entity selector (its
// series submenu: the value first, then the attributes), loaded with their history, kept
const { openCard } = require('./lib.cjs');

const card = (o) => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, ...o });

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };
    // The graphs in display order: type, then each curve's series id and its points
    const shown = t => t.E(`el.instance._allGraphsInDisplayOrder().map(g=>g.type+':'+g.chart.data.datasets.map(d=>d.entity_id+'#'+d.data.length).join('+')).join(' | ')`);

    // ── In the YAML ──
    let t = await openCard(card({ graphs: [
        { type: 'line', entities: [{ entity: 'climate.salon', attribute: 'current_temperature', unit: '°C' }, { entity: 'climate.salon.temperature' }] },
        { type: 'timeline', entities: [{ entity: 'climate.salon' }, { entity: 'climate.salon', attribute: 'hvac_action' }] }] }), { mock: { series: true }, height: 900 });
    await t.wait(1500);
    await t.step('attribute: curves of an entity\'s attributes, beside its own state, each with its history', async () => {
        const v = await shown(t);
        return /^line:climate\.salon\.current_temperature#(\d+)\+climate\.salon\.temperature#\d+ \| timeline:climate\.salon#\d+\+climate\.salon\.hvac_action#\d+$/.test(v) && Number(v.match(/current_temperature#(\d+)/)[1]) > 100 ? true : v;
    });
    await t.step('named after the entity, a colon and the attribute, with its unit — set, or given by the entity (temperature_unit) — the attribute after the entity id the same', async () => {
        const v = await t.E(`el.instance.graphs[0].chart.data.datasets.map(d=>d.name+' / '+d.unit).join(', ')`);
        return v === 'salon : Current temperature / °C, salon : Temperature / °C' ? true : v;
    });
    await t.step('their history asked once per entity, with its attributes and every change; the states as usual', async () => {
        const r = await t.E(`__ws.filter(w=>w.type==='history/history_during_period').map(w=>w.ids.join()+':'+w.attributes+':'+w.allChanges).join(' ; ')`);
        return r === 'climate.salon:false:false ; climate.salon:true:true' ? true : r;
    });
    done(await t.close());

    // ── A number followed by a unit; an attribute holding a curve's color ──
    t = await openCard(card({ graphs: [
        { type: 'line', entities: [{ entity: 'climate.salon', attribute: 'humidity' },
            { entity: 'climate.salon', attribute: 'current_temperature', color: { entity: 'climate.salon', attribute: 'hvac_action', heating: 'red', idle: 'blue' } },
            { entity: 'sensor.power', color: 'climate.salon.led_color' }] }] }), { mock: { series: true }, height: 900 });
    await t.wait(1500);
    await t.step('an attribute "45.2 %": the number, in its unit — a curve', async () => {
        const r = await t.E(`(()=>{ const d=el.instance.graphs[0].chart.data.datasets[0]; return { unit: d.unit, n: d.data.length, y: d.data.slice(0,3).map(p=>typeof p.y) }; })()`);
        return r.unit === '%' && r.n > 100 && r.y.every(x => x === 'number') ? true : JSON.stringify(r);
    });
    await t.step('color from an attribute: thresholds on it (red heating, blue idle along the curve), or the color it holds', async () => {
        const r = await t.E(`(()=>{ const ds=el.instance.graphs[0].chart.data.datasets;
            return { cols: [...new Set((ds[1].colorSteps ?? []).map(s=>s.borderColor))].sort().join(), led: ds[2].borderColor }; })()`);
        return r.cols === 'blue,red' && r.led === 'green' ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── Long-term statistics: an attribute has none ──
    t = await openCard(card({ defaultTimeRange: '1w', statistics: { enabled: true, period: 'hour' },
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'climate.salon', attribute: 'current_temperature' }] }] }), { mock: { series: true, historyDays: 2 } });
    await t.wait(1500);
    await t.step('where the history ends, the statistics take over — never asked for an attribute, its curve where the history is', async () => {
        const st = await t.E(`__ws.filter(w=>w.type==='recorder/statistics_during_period').map(w=>w.ids.join())`);
        const n = await t.E(`el.instance.graphs[0].chart.data.datasets.map(d=>d.data.length)`);
        return st.length >= 1 && st.every(x => x === 'sensor.power') && n[0] > n[1] && n[1] > 20 && !(await t.E('logs')).length ? true : JSON.stringify({ st, n, logs: await t.E('logs') });
    });
    done(await t.close());

    // ── From the entity selector ──
    t = await openCard(card({ graphs: [] }), { mock: { series: true }, height: 1100 });
    await t.wait(800);
    const sub = () => t.E(`(()=>{ const s=el.querySelector('#es_0_series'); return s.style.display==='none' ? 'closed' : [...s.querySelectorAll('a')].map(a=>a.textContent+(a.style.fontWeight==='bold'?'*':'')).join(' | '); })()`);
    const typeMenuFor = () => t.E(`(()=>{ const m=el.querySelector('#et_0'); return m.style.display==='none' ? null : m._hec_entity_id; })()`);
    const entryBold = id => t.E(`el.querySelector('#es_0 a[data-entity="${id}"]').style.fontWeight`);
    const search = async text => { await t.page.click('#b7_0'); await t.page.keyboard.press('Control+A'); await t.page.keyboard.type(text); await t.wait(400); };
    const closeAll = async () => { for( let i = 0; i < 3; i++ ) await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 1090); await t.wait(400); };
    await t.step('an entity with attributes: its series submenu opens — the value first, marked, then the attributes; not a list, Home Assistant\'s own, nor a unit (X_unit: temperature_unit, of every attribute with temperature in its name; visibility_unit, even with no visibility)', async () => {
        await search('salon'); await t.page.click('#es_0 a[data-entity="climate.salon"]'); await t.wait(400);
        const v = await sub(); const b = await entryBold('climate.salon'); const m = await typeMenuFor();
        return v === 'Value (heat)* | Current temperature (19.5 °C) | Temperature (20 °C) | Apparent temperature (21 °C) | Hvac action (heating) | Humidity (45 %) | Led color (green)' && b === 'bold' && m === null ? true : JSON.stringify({ v, b, m });
    });
    await t.step('a weather entity: its attributes in the units Home Assistant shows them in (wind_gust_speed in wind_speed_unit, humidity in %), no X_unit offered', async () => {
        await closeAll(); await search('villeveyrac'); await t.page.click('#es_0 a[data-entity="weather.villeveyrac"]'); await t.wait(400);
        const v = await sub(); await closeAll();
        return v === 'Value (rainy)* | Temperature (21.7 °C) | Apparent temperature (29 °C) | Humidity (85 %) | Pressure (1016.4 hPa) | Wind bearing (130) | Wind gust speed (0 km/h) | Wind speed (14.4 km/h)' ? true : v;
    });
    await search('salon'); await t.page.click('#es_0 a[data-entity="climate.salon"]'); await t.wait(400);
    await t.step('like every submenu: over the dropdown, level with the entry, right edges aligned', async () => {
        const r = await t.E(`(()=>{ const q=s=>el.querySelector(s).getBoundingClientRect(); const d=q('#es_0'), e=q('#es_0 a[data-entity="climate.salon"]'), s=q('#es_0_series');
            return Math.abs(s.right-d.right)<1 && Math.abs(s.top-e.top)<1 ? 'ok' : JSON.stringify({ d, e, s }); })()`);
        return r === 'ok' ? true : r;
    });
    await t.step('Escape: back to the dropdown, still open, the entry no longer in bold', async () => {
        await t.page.keyboard.press('Escape'); await t.wait(300);
        const r = { sub: await sub(), list: await t.E(`el.querySelector('#es_0').style.display`), b: await entryBold('climate.salon') };
        return r.sub === 'closed' && r.list !== 'none' && r.b !== 'bold' ? true : JSON.stringify(r);
    });
    await t.step('Enter right away takes the value: the type menu for the entity itself', async () => {
        await t.page.click('#es_0 a[data-entity="climate.salon"]'); await t.wait(400);
        await t.page.keyboard.press('Enter'); await t.wait(500);
        const m = await typeMenuFor(); await closeAll();
        return m === 'climate.salon' ? true : m;
    });
    await t.step('↓ ↓ Enter: Current temperature, its type menu (a smart line pre-selected), Enter adds it', async () => {
        await search('salon'); await t.page.click('#es_0 a[data-entity="climate.salon"]'); await t.wait(400);
        await t.page.keyboard.press('ArrowDown'); await t.page.keyboard.press('ArrowDown'); await t.page.keyboard.press('Enter'); await t.wait(500);
        const m = await typeMenuFor();
        const bold = await t.E(`[...el.querySelectorAll('#et_0_rep_sub a')].filter(a=>a.style.display!=='none' && a.style.fontWeight==='bold').map(a=>a.textContent).join()`);
        await t.page.keyboard.press('Enter'); await t.wait(1500);
        const v = await shown(t);
        return m === 'climate.salon.current_temperature' && bold === 'Smart' && /^line:climate\.salon\.current_temperature#\d\d+$/.test(v) ? true : JSON.stringify({ m, bold, v });
    });
    await t.step('a text attribute by the mouse: a timeline beside it', async () => {
        await search('salon'); await t.page.click('#es_0 a[data-entity="climate.salon"]'); await t.wait(400);
        await t.page.click('#es_0_series a[data-series="climate.salon.hvac_action"]'); await t.wait(500);
        const m = await typeMenuFor(); await t.page.keyboard.press('Enter'); await t.wait(1500);
        const v = await shown(t);
        return m === 'climate.salon.hvac_action' && /timeline:climate\.salon\.hvac_action#\d+/.test(v) ? true : JSON.stringify({ m, v });
    });
    await t.step('the same attribute again: already shown, said so', async () => {
        await search('salon'); await t.page.click('#es_0 a[data-entity="climate.salon"]'); await t.wait(400);
        await t.page.click('#es_0_series a[data-series="climate.salon.current_temperature"]'); await t.wait(500);
        const tip = await t.E('tip()'); await closeAll();
        return /already|existe/i.test(tip || '') && /current_temperature/.test(tip || '') ? true : tip;
    });
    await t.step('an entity without attributes to show: straight to its type menu', async () => {
        await search('power two'); await t.page.click('#es_0 a[data-entity="sensor.power2"]'); await t.wait(500);
        const r = { sub: await sub(), m: await typeMenuFor() }; await closeAll();
        return r.sub === 'closed' && r.m === 'sensor.power2' ? true : JSON.stringify(r);
    });
    await t.step('kept after a reload, and the selector and its submenu close when the focus leaves', async () => {
        const before = await shown(t);
        await t.page.reload(); await t.wait(3500);
        const after = await shown(t);
        await search('salon'); await t.page.click('#es_0 a[data-entity="climate.salon"]'); await t.wait(400);
        await t.page.mouse.click(5, 1090); await t.wait(500);
        const r = { before, after, sub: await sub(), list: await t.E(`el.querySelector('#es_0').style.display`) };
        return before.replace(/#\d+/g, '') === after.replace(/#\d+/g, '') && /current_temperature/.test(after) && r.sub === 'closed' && r.list === 'none' ? true : JSON.stringify(r);
    });
    done(await t.close());

    return { passed, failed };
};
