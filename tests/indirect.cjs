// A curve's look from an entity or one of its attributes, chosen in the menus: Appearance ▸
// Color ▸ / Fill ▸ / Length ▸ (an arrowline's) ▸ Entity ▸ — the card's entity selector (the
// same list, filtered as it's typed, filterEntities applied), then Value or Thresholds ▸
const { openCard } = require('./lib.cjs');

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    const card = (graphs, more = {}) => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, graphs, ...more });
    const lines = t => t.E(`[...((el.querySelector('#et_0')._cascade||[]).slice(1).pop()?.querySelectorAll('a') ?? [])].map(a=>a.textContent.trim()+(a.style.fontWeight==='bold'?'*':'')).join(' | ')`);
    const click = (t, sel) => t.E(`el.querySelector('${sel}').click()`);
    const open = async (t, li) => { await t.E(`(()=>{ const I=el.instance, g=I.graphsInDisplayOrder()[0]; I.showEntityCurveMenu(0, g.entities[${li}].entity, g, { from: 'label', clientX: 100, clientY: 100 }); })()`); await t.wait(250); };
    const curveMenu = async (t, li, key) => {
        await open(t, li);
        await click(t, '#et_0_appearance'); await t.wait(200);
        await click(t, `#et_0_appearance_${key}`); await t.wait(200);
        await click(t, `#et_0_appearance_${key}_entity`); await t.wait(250);
    };
    const search = async (t, text) => { await t.page.click('label[id$="_entity_field"] input'); await t.page.keyboard.press('Control+A'); await t.page.keyboard.type(text); await t.wait(400); };
    const listed = (t, k) => t.E(`[...el.querySelectorAll('#es_${k} a')].filter(a=>a.style.display!=='none').map(a=>a.dataset.entity).join()`);
    const enter = (t, id, v) => t.E(`(()=>{ const i=el.querySelector('#${id}'); i.value=${JSON.stringify(v)}; i.dispatchEvent(new Event('change')); })()`);
    const closeMenu = async t => { await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 880); await t.wait(700); };

    let t = await openCard(card([{ type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power_kw' }] }]), { height: 900 });
    await t.step('Color ▸: Choose… and Entity ▸; Entity ▸: the entity selector\'s field — typed, the same entities as the card\'s selector', async () => {
        await open(t, 0); await click(t, '#et_0_appearance'); await t.wait(200); await click(t, '#et_0_appearance_color'); await t.wait(200);
        const l = await lines(t);
        await click(t, '#et_0_appearance_color_entity'); await t.wait(250);
        const field = await t.E(`!!el.querySelector('#et_0_appearance_color_entity_field #b7_2')`);
        await search(t, 'wind');
        const menu = await listed(t, 2);
        await closeMenu(t);
        await t.page.click('#b7_0'); await t.page.keyboard.type('wind'); await t.wait(400);
        const bar = await listed(t, 0);
        await t.page.keyboard.press('Control+A'); await t.page.keyboard.press('Backspace'); await t.page.mouse.click(5, 880); await t.wait(400);
        return l === 'Choose… | Entity ▸' && field && menu !== '' && menu === bar ? true : JSON.stringify({ l, field, menu, bar });
    });
    await t.step('an entity chosen: Value | Thresholds ▸; Value: the curve\'s color is that entity, Entity ▸ then in bold', async () => {
        await curveMenu(t, 0, 'color'); await search(t, 'wind');
        await t.page.click('#es_2 a[data-entity="sensor.wind"]'); await t.wait(300);
        const l = await lines(t);
        await click(t, `#et_0_appearance_color_entity_series_value`); await t.wait(900);
        const saved = await t.E('graphAt(0).entities[0].color');
        await open(t, 0); await click(t, '#et_0_appearance'); await t.wait(200); await click(t, '#et_0_appearance_color'); await t.wait(200);
        const l2 = await lines(t); await closeMenu(t);
        return l === 'Value | Thresholds ▸' && saved === 'sensor.wind' && l2 === 'Choose… | Entity ▸*' ? true : JSON.stringify({ l, saved, l2 });
    });
    await t.step('Thresholds ▸ on the curve\'s own entity: + Add ▸ 100 — a ≥ 100 threshold, saved without entity; Default; Blend: colorTransition smooth', async () => {
        await curveMenu(t, 1, 'color'); await search(t, 'power_kw');
        await t.page.click('#es_2 a[data-entity="sensor.power_kw"]'); await t.wait(300);
        const id = `et_0_appearance_color_entity_series_th`;
        await click(t, '#' + id); await t.wait(250);
        const l0 = await lines(t);
        await click(t, `#${id}_add`); await t.wait(250);
        await enter(t, `${id}_add_value`, '100'); await t.wait(900);
        const saved = await t.E('JSON.stringify(graphAt(0).entities[1].color)');
        await t.page.keyboard.press('Escape'); await t.wait(250);
        const l1 = await lines(t);
        await click(t, `#${id}_blend`); await t.wait(900);
        const blend = await t.E(`graphAt(0).entities[1].colorTransition`);
        return l0 === 'Default  — ▸ | + Add ▸' && /^\{"thresholds":\[\[100,"#[0-9a-f]{6}"\]\]/i.test(saved) && !saved.includes('entity')
            && l1 === '≥ 100 ▸ | Default  — ▸ | + Add ▸ | Blend' && blend === 'smooth' ? true : JSON.stringify({ l0, saved, l1, blend });
    });
    done(await t.close());

    t = await openCard(card([{ type: 'line', entities: [{ entity: 'sensor.power' }] }]), { height: 900 });
    await t.step('Fill ▸ Entity ▸ an attribute — the sun\'s Azimuth: Value; the sun\'s state: its known states in + Add ▸, one chosen: a = state threshold, saved with the entity', async () => {
        await curveMenu(t, 0, 'fill'); await search(t, 'sun');
        const found = await listed(t, 2); if( !found.split(',').includes('sun.sun') ) return 'listed: ' + found;
        await t.page.click('#es_2 a[data-entity="sun.sun"]'); await t.wait(300);
        const series = await t.E(`[...el.querySelectorAll('#es_2_series a')].map(a=>a.textContent).join(' | ')`);
        await t.E(`[...el.querySelectorAll('#es_2_series a')].find(a=>a.textContent.startsWith('Azimuth')).click()`); await t.wait(300);
        const l = await lines(t);
        await click(t, `#et_0_appearance_fill_entity_series_value`); await t.wait(900);
        const a = await t.E('graphAt(0).entities[0].fill');
        await curveMenu(t, 0, 'fill'); await search(t, 'sun');
        await t.page.click('#es_2 a[data-entity="sun.sun"]'); await t.wait(300);
        await t.E(`[...el.querySelectorAll('#es_2_series a')].find(a=>a.textContent.startsWith('Value')).click()`); await t.wait(300);
        const id = `et_0_appearance_fill_entity_series_th`;
        await click(t, '#' + id); await t.wait(250); await click(t, `#${id}_add`); await t.wait(250);
        const add = await lines(t);
        await click(t, `#${id}_add_0`); await t.wait(900);
        const b = await t.E('JSON.stringify(graphAt(0).entities[0].fill)');
        await closeMenu(t);
        return series.includes('Azimuth') && l === 'Value | Thresholds ▸' && a === 'sun.sun.azimuth' && add.includes('above_horizon')
            && b === '{"entity":"sun.sun","thresholds":[],"states":{"above_horizon":true}}' ? true : JSON.stringify({ series, l, a, add, b });
    });
    done(await t.close());

    t = await openCard(card([{ type: 'arrowline', entities: [{ entity: 'sensor.wind' }] }]), { height: 900 });
    await t.step('an arrowline: Length ▸ — Entity ▸ only; thresholds on the power: ≥ 0 → 50: saved as a length in %', async () => {
        await open(t, 0); await click(t, '#et_0_appearance'); await t.wait(200); await click(t, '#et_0_appearance_length'); await t.wait(200);
        const l = await lines(t);
        await click(t, '#et_0_appearance_length_entity'); await t.wait(250); await search(t, 'power');
        await t.page.click('#es_2 a[data-entity="sensor.power"]'); await t.wait(300);
        const id = `et_0_appearance_length_entity_series_th`;
        await click(t, '#' + id); await t.wait(250); await click(t, `#${id}_add`); await t.wait(250);
        await enter(t, `${id}_add_value`, '0'); await t.wait(600);
        await t.page.keyboard.press('Escape'); await t.wait(250);
        await click(t, `#${id}_t0`); await t.wait(250);
        await enter(t, `${id}_t0_length`, '50'); await t.wait(900);
        const saved = await t.E('JSON.stringify(graphAt(0).entities[0].arrowLength)');
        await closeMenu(t);
        return l === 'Entity ▸' && saved === '{"entity":"sensor.power","thresholds":[[0,50]],"states":{}}' ? true : JSON.stringify({ l, saved });
    });
    done(await t.close());

    t = await openCard(card([{ type: 'line', entities: [{ entity: 'sensor.power' }] }], { filterEntities: 'sensor.wind*' }), { height: 900 });
    await t.step('filterEntities: the entities left out of the card\'s selector, left out of Entity ▸ too', async () => {
        await curveMenu(t, 0, 'color'); await search(t, 's');
        const l = (await listed(t, 2)).split(',');
        await closeMenu(t);
        return l.length > 0 && l.every(e => e.startsWith('sensor.wind')) ? true : l.join();
    });
    done(await t.close());

    return { passed, failed };
};
