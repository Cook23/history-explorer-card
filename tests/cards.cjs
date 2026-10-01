// Two cards on one page, the entity type menu, an entity added twice
const { openCard } = require('./lib.cjs');

const card = (graphs) => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, graphs });

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    // ── Two cards: a drag never reaches the other card ──
    let t = await openCard(card([{ type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power_kw' }] }]));
    await t.page.evaluate(c => {
        const e2 = document.createElement('history-explorer-card'); e2.setConfig(c);
        document.getElementById('host').appendChild(e2); e2.hass = mkHass(); window.el2 = e2;
    }, { ...card([{ type: 'line', entities: [{ entity: 'sensor.rain' }] }]), cardName: 'second' + Date.now() });
    await t.wait(2200);
    await t.step('a curve dragged onto another card\'s graph never reaches that card', async () => {
        await t.E(`(()=>{ window.__seen=0; const c=el2.instance.graphs[0].chart; const o=c.options.customEvent;
            c.options.customEvent=function(i){ if(i.gestureType==='dragovergraph') __seen++; return o.apply(this,arguments); };
            window.__outl=[]; const w=el2.instance.graphs[0].canvas.parentNode;
            new MutationObserver(()=>{ if(w.style.outline) __outl.push(w.style.outline); }).observe(w,{attributes:true,attributeFilter:['style']}); })()`);
        const a = await t.E('legendPt(0,1)');
        const r = await t.E('el2.instance.graphs[0].canvas.getBoundingClientRect().toJSON()');
        await t.drag(a, { x: r.x + r.width / 2, y: r.y + r.height / 2 }, 16);
        const seen = await t.E('__seen'); const outl = await t.E('__outl');
        const g1 = await t.graphs(); const e2 = await t.E(`el2.instance.graphs.map(g=>g.entities.map(e=>e.entity)).join('|')`);
        return seen === 0 && outl.length === 0 && g1.join() === 'l:power+power_kw@0' && e2 === 'sensor.rain' ? true : JSON.stringify({ seen, outl, g1, e2 });
    });
    done(await t.close());

    // ── The type menu offers what fits the entity, its current type marked ──
    t = await openCard(card([{ type: 'line', entities: [{ entity: 'sensor.power', lineMode: 'smart' }] }, { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }] }]), { height: 900 });
    const menu = `(()=>{ const m=el.querySelector('#et_0'); return [...m.querySelectorAll('a')].filter(a=>a.style.display!=='none').map(a=>a.textContent+(a.style.fontWeight==='bold'?'*':'')).join(' | '); })()`;
    await t.step('type menu of a numeric curve: every type, smart marked', async () => {
        await t.longPress(await t.E('legendPt(0,0)'));
        const m = await t.E(menu);
        await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 880); await t.wait(300);
        return m === 'Line straight | Line curves | Line stepped | Line smart* | Bar | Arrowline | Timeline | Delete' ? true : m;
    });
    await t.step('type menu of a binary sensor: timeline only', async () => {
        await t.longPress(await t.E('tlPt(1,0)'));
        const m = await t.E(menu);
        return m === 'Timeline* | Delete' ? true : m;
    });
    done(await t.close());

    // ── Adding an entity already shown: a message, and that graph outlined for a moment ──
    t = await openCard(card([{ type: 'line', entities: [{ entity: 'sensor.power' }] }, { type: 'line', entities: [{ entity: 'sensor.rain' }] }]), { height: 900 });
    const outlines = () => t.E(`el.instance._allGraphsInDisplayOrder().map(g=>g.canvas.parentNode.style.outline||'-').join(' / ')`);
    await t.step('adding an entity already shown says so and outlines its graph, cleared soon after', async () => {
        await t.E(`(()=>{ const f=el.instance.ui.inputField[0]; f.value='sensor.rain'; f.dataset.entityId='sensor.rain'; el.instance.addEntitySelected(0); })()`);
        await t.wait(300);
        const msg = await t.E('tip()'); const o1 = await outlines();
        await t.wait(2200); const o2 = await outlines();
        return /sensor\.rain/.test(msg || '') && /^- \/ 2px dashed/.test(o1) && o2 === '- / -' ? true : JSON.stringify({ msg, o1, o2 });
    });
    done(await t.close());

    return { passed, failed };
};
