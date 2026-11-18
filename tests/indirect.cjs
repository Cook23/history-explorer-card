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
    await t.step('Color ▸: Automatic, Choose… and Entity ▸; Entity ▸: the entity selector\'s field — typed, the same entities as the card\'s selector', async () => {
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
        return l === 'Automatic* | Choose… | Entity ▸' && field && menu !== '' && menu === bar ? true : JSON.stringify({ l, field, menu, bar });
    });
    await t.step('an entity chosen: Value | Thresholds ▸; Value: the curve\'s color is that entity, Entity ▸ then in bold', async () => {
        await curveMenu(t, 0, 'color'); await search(t, 'wind');
        await t.page.click('#es_2 a[data-entity="sensor.wind"]'); await t.wait(300);
        const l = await lines(t);
        await click(t, `#et_0_appearance_color_entity_series_value`); await t.wait(900);
        const saved = await t.E('graphAt(0).entities[0].color');
        await open(t, 0); await click(t, '#et_0_appearance'); await t.wait(200); await click(t, '#et_0_appearance_color'); await t.wait(200);
        const l2 = await lines(t); await closeMenu(t);
        return l === 'Value | Thresholds ▸' && saved === 'sensor.wind' && l2 === 'Automatic | Choose… | Entity ▸*' ? true : JSON.stringify({ l, saved, l2 });
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
    await t.step('the cascade fitted: the menu where it is; Entity ▸\'s box as wide as its list\'s names need, the room taken from the menus over it; the list under it, as wide, all right-aligned; back as they were once another line is chosen', async () => {
        const boxes = () => t.E(`(()=>{ const r=el.querySelector('#et_0'); return [...(r._cascade||[r])].map(b=>{ const q=b.getBoundingClientRect(); return { id: b.id, l: Math.round(q.left), r: Math.round(q.right) }; }); })()`);
        await open(t, 0); await click(t, '#et_0_appearance'); await t.wait(200); await click(t, '#et_0_appearance_color'); await t.wait(200);
        const a = await boxes();
        await click(t, '#et_0_appearance_color_entity'); await t.wait(250); await search(t, 's');
        const b = await boxes();
        const list = await t.E(`(()=>{ const q=el.querySelector('#es_2').getBoundingClientRect(); return { l: Math.round(q.left), r: Math.round(q.right) }; })()`);
        await t.E(`(()=>{ el.instance.setDropdownVisibility(2, false); el.querySelector('#et_0_appearance_points').click(); })()`); await t.wait(250);
        const c = await boxes(); await closeMenu(t);
        const _box = b[b.length - 1];
        const ok = b[0].l === a[0].l && b.every(x => x.r === b[0].r) && _box.id === 'et_0_appearance_color_entity_sub' && list.l === _box.l && list.r === _box.r
            && b[1].l < a[1].l && JSON.stringify(c.slice(0, 2)) === JSON.stringify(a.slice(0, 2)) && c[2]?.id === 'et_0_appearance_points_sub';
        return ok ? true : JSON.stringify({ a, b, list, c });
    });
    await t.step('a deep cascade (Color ▸ Entity ▸ power ▸ Thresholds ▸ + Add ▸): each box over the one before leaves the start of its lines — two wide characters —, no more; the last one\'s field within the menu', async () => {
        await curveMenu(t, 0, 'color'); await search(t, 'power');
        await t.page.click('#es_2 a[data-entity="sensor.power"]'); await t.wait(300);
        await click(t, '#et_0_appearance_color_entity_series_th'); await t.wait(250);
        await click(t, '#et_0_appearance_color_entity_series_th_add'); await t.wait(250);
        const r = await t.E(`(()=>{ const r=el.querySelector('#et_0'); const ch=r._cascade; const R=ch[0].getBoundingClientRect().right;
            const box = ch.map(b=>Math.round(b.getBoundingClientRect().left)); const last=ch[ch.length-1].querySelector('input').getBoundingClientRect();
            return { gaps: box.slice(1).map((x,k)=>x-box[k]), inRight: Math.round(last.right), R: Math.round(R), inWidth: Math.round(last.width) }; })()`);
        await closeMenu(t);
        return r.gaps.slice(0, -1).every(g => g > 10 && g < 40) && r.inRight <= r.R && r.inWidth > 20 ? true : JSON.stringify(r);
    });
    await t.step('Entity ▸\'s field and list: the field as wide as its line; the list right under its box; typed, its lines fitted again only when its width changes — never measured line by line', async () => {
        await curveMenu(t, 0, 'color');
        await t.E(`(()=>{ const I=el.instance; I._fitCount=0; const f=I.fitEntityLines.bind(I); I.fitEntityLines=(...a)=>{ I._fitCount++; return f(...a); }; })()`);
        await search(t, 'p'); const n0 = await t.E('el.instance._fitCount');
        await t.page.keyboard.type('ower'); await t.wait(300); const n1 = await t.E('el.instance._fitCount');
        const r = await t.E(`(()=>{ const box=el.querySelector('#et_0_appearance_color_entity_sub'), i=box.querySelector('input'), lab=i.parentElement, l=el.querySelector('#es_2');
            return { boxBottom: Math.round(box.getBoundingClientRect().bottom), listTop: Math.round(l.getBoundingClientRect().top), input: Math.round(i.getBoundingClientRect().width), line: Math.round(lab.getBoundingClientRect().width) }; })()`);
        await t.E(`delete el.instance.fitEntityLines`);
        await closeMenu(t);
        return n0 <= 1 && n1 === n0 && r.listTop === r.boxBottom && r.input >= r.line - 30 ? true : JSON.stringify({ n0, n1, r });
    });
    await t.step('Color ▸ Entity ▸, then Fill ▸ Entity ▸: one field in the menu — the list under Fill\'s box, filtered by what\'s typed there', async () => {
        await curveMenu(t, 0, 'color'); await closeMenu(t);
        await curveMenu(t, 0, 'fill'); await search(t, 'wind');
        const r = await t.E(`(()=>{ const l=el.querySelector('#es_2'); return { fields: [...el.querySelectorAll('input')].filter(i=>i.id==='b7_2').length, listTop: Math.round(l.getBoundingClientRect().top), box: Math.round(el.querySelector('#et_0_appearance_fill_entity_sub').getBoundingClientRect().bottom), shown: [...l.querySelectorAll('a')].filter(a=>a.style.display!=='none').map(a=>a.dataset.entity) }; })()`);
        await closeMenu(t);
        return r.fields === 1 && r.listTop === r.box && r.shown.length > 0 && r.shown.every(e => e.includes('wind')) ? true : JSON.stringify(r);
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
            && b === '{"entity":"sun.sun","thresholds":[],"states":{"above_horizon":"light"}}' ? true : JSON.stringify({ series, l, a, add, b });
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

    // ── End to end, as a user does it, in a page scrolled down (its sticky toolbar holding the
    // menus): on a curve, an arrowline and a timeline, each Entity ▸ after the others in the
    // same menu — the field typed into key by key, the list under its box, filtered, an entity
    // clicked, Value chosen: the option is that entity ──
    t = await openCard(card([
        { type: 'line', entities: [{ entity: 'sensor.power' }] },
        { type: 'line', entities: [{ entity: 'sensor.tank' }] },
        { type: 'arrowline', entities: [{ entity: 'sensor.wind' }] },
        { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }] } ]), { height: 700, mock: { series: true }, scrollRoom: 1500 });
    await t.wait(1000);
    const menuOn = async (gi, entity, key) => {
        await t.E(`(()=>{ const I=el.instance, g=I.graphsInDisplayOrder()[${gi}]; I.graphDiv(g).scrollIntoView({ block: 'center' }); })()`); await t.wait(400);
        const p = await t.E(`(()=>{ const r=el.instance.graphDiv(el.instance.graphsInDisplayOrder()[${gi}]).getBoundingClientRect(); return { x: r.left + 100, y: r.top + 30 }; })()`);
        await t.E(`(()=>{ const I=el.instance, g=I.graphsInDisplayOrder()[${gi}]; I.showEntityCurveMenu(0, '${entity}', g, { from: 'label', clientX: ${p.x}, clientY: ${p.y} }); })()`); await t.wait(250);
        await click(t, '#et_0_appearance'); await t.wait(200);
        await click(t, `#et_0_appearance_${key}`); await t.wait(200);
        await click(t, `#et_0_appearance_${key}_entity`); await t.wait(250);
    };
    const flow = async (gi, entity, key, typed, chosen, field) => {
        await menuOn(gi, entity, key);
        await t.page.click(`#et_0_appearance_${key}_entity_field input`);
        for( const c of typed ) await t.page.keyboard.type(c);
        await t.wait(400);
        const r = await t.E(`(()=>{ const box=el.querySelector('#et_0_appearance_${key}_entity_sub'), l=el.querySelector('#es_2'), q=l.getBoundingClientRect();
            const shown=[...l.querySelectorAll('a')].filter(a=>a.style.display!=='none');
            return { fields: [...el.querySelectorAll('input')].filter(i=>i.id==='b7_2').length, boxBottom: Math.round(box.getBoundingClientRect().bottom), listTop: Math.round(q.top), listLeft: Math.round(q.left), boxLeft: Math.round(box.getBoundingClientRect().left), listRight: Math.round(q.right), boxRight: Math.round(box.getBoundingClientRect().right), listHeight: Math.round(q.height),
                     onScreen: q.top >= 0 && q.top < innerHeight, shown: shown.map(a=>a.dataset.entity), texts: shown.map(a=>(a.dataset.label + ' ' + a.textContent + ' ' + a.dataset.entity).toLowerCase()) }; })()`);
        // (the entity clicked where it's shown — a pointer, as a user)
        const pt = await t.E(`(()=>{ const a=el.querySelector('#es_2 a[data-entity="${chosen}"]'); if(!a || a.style.display==='none') return null; const q=a.getBoundingClientRect(); return { x: q.left + 10, y: q.top + q.height / 2 }; })()`);
        if( pt ) { await t.page.mouse.click(pt.x, pt.y); await t.wait(400); }
        const sub = await lines(t);
        if( sub.startsWith('Value') ) { await click(t, `#et_0_appearance_${key}_entity_series_value`); await t.wait(900); }
        r.sub = sub; r.saved = await t.E(`el.instance.graphsInDisplayOrder()[${gi}].entities[0].${field}`);
        await closeMenu(t);
        const ok = r.fields === 1 && r.listTop === r.boxBottom && r.listLeft === r.boxLeft && r.listRight === r.boxRight && r.listHeight > 20 && r.onScreen && r.shown.length > 0 && r.texts.every(x => x.includes(typed)) && pt && sub === 'Value | Thresholds ▸' && r.saved === chosen;
        return ok ? true : JSON.stringify({ ...r, pt });
    };
    await t.step('end to end, a scrolled page — a curve: Color ▸ Entity ▸, typed, the list under its box, as wide as its field\'s box, both right-aligned, filtered, an entity clicked, Value: the curve\'s color is that entity', () => flow(0, 'sensor.power', 'color', 'wind', 'sensor.wind_rad', 'color'));
    await t.step('then, the same menu — another curve: Fill ▸ Entity ▸, its own field the only one: the same, its fill that entity', () => flow(1, 'sensor.tank', 'fill', 'power', 'sensor.power_kw', 'fill'));
    await t.step('then an arrowline: Length ▸ Entity ▸, the same, its length that entity', () => flow(2, 'sensor.wind', 'length', 'tank', 'sensor.tank', 'arrowLength'));
    await t.step('then an arrowline: Fill ▸ Entity ▸, the same, its fill that entity', () => flow(2, 'sensor.wind', 'fill', 'rain', 'sensor.rain', 'fill'));
    await t.step('then a timeline: Fill ▸ Entity ▸, the same, its fill that entity', () => flow(3, 'binary_sensor.a', 'fill', 'clim', 'sensor.clim_mode', 'fill'));
    await t.step('and back to the first curve: Color ▸ Entity ▸ again, the same', () => flow(0, 'sensor.power', 'color', 'gas', 'sensor.gas', 'color'));
    done(await t.close());

    return { passed, failed };
};
