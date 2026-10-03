// The options at every level (card, entityOptions, graph, entity) with their synonyms, the
// curve reconstruction (interpolation) and its Reconstruction submenu (keyboard, mouse, touch,
// screen edges, shadow root), automatic refresh (on by default, at most one request every 2 s)
const { openCard } = require('./lib.cjs');

const card = (o) => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, ...o });

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    // ── Every level, every spelling ──
    let t = await openCard(card({
        interpolation: 'makima', ylock: true, height: 300, showSamples: 3,
        entityOptions: [{ match: 'sensor.rain', interpolation: 'steffen', width: 5 }],
        graphs: [
            { type: 'line', lineMode: 'curves', interpolation: 'catmull-rom', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power2', interpolation: 'monotone', lineWidth: 4 }] },
            { type: 'line', options: { ylock: false, height: 200 }, entities: [{ entity: 'sensor.rain', stacked: true }] },
            { type: 'line', entities: [{ entity: 'sensor.wind', height: 222, ystepsize: 45 }] }] }), { mock: { series: true } });
    const graphs = () => t.E(`el.instance.graphs.map(g=>({ ylock:g.ylock, h:g.graphHeight, step:g.chart.options.scales.yAxes[0].ticks.stepSize, stacked:!!g.chart.options.scales.yAxes[0].stacked,
        ds:g.chart.data.datasets.map(d=>[d.entity_id.split('.')[1],d.hecInterpolation,d.borderWidth,d.pointRadius].join(':')).join(',') }))`);
    const g = await graphs();
    await t.step('interpolation: entity → graph (flat on it) → entityOptions → card, synonyms accepted', async () => {
        const v = g.map(x => x.ds).join(' | ');
        return v === 'power:catmullrom:2:3,power2:monotone:4:3 | rain:steffen:5:3 | wind:makima:2:3' ? true : v;
    });
    await t.step('graph options from the card, the graph or an entity: ylock, height, stacked, ystepsize', async () => {
        const v = g.map(x => [x.ylock, x.h, x.stacked, x.step ?? '-'].join(':')).join(' | ');
        return v === 'true:300:false:- | false:200:true:- | true:222:false:45' ? true : v;
    });
    await t.step('automatic refresh is on by default', async () => (await t.E('el.instance.pconfig.refreshEnabled')) === true || 'off');
    done(await t.close());

    // ── The Reconstruction submenu ──
    t = await openCard(card({ graphs: [{ type: 'line', entities: [{ entity: 'sensor.power', lineMode: 'smart' }, { entity: 'sensor.power2', lineMode: 'lines' }] }] }), { height: 900 });
    const menu = `[...el.querySelector('#et_0').querySelectorAll('a')].filter(a=>a.style.display!=='none').map(a=>a.textContent.trim()+(a.style.fontWeight==='bold'?'*':'')).join(' | ')`;
    const sub = `(()=>{const m=el.querySelector('#er_0'); return m.style.display==='none'?'closed':[...m.querySelectorAll('a')].map(a=>a.textContent+(a.style.fontWeight==='bold'?'*':'')).join(' | ');})()`;
    const ds = `el.instance.graphs[0].chart.data.datasets.map(d=>d.hecInterpolation).join(',')`;
    await t.step('a smart curve\'s type menu starts with Reconstruction', async () => {
        await t.longPress(await t.E('legendPt(0,0)'));
        const v = await t.E(menu); return /^Reconstruction ▸ \| Line smart\*/.test(v) ? true : v;
    });
    await t.step('keyboard: ↑ onto Reconstruction, → opens the submenu, the algorithm in use in bold', async () => {
        await t.page.keyboard.press('ArrowDown'); await t.page.keyboard.press('ArrowUp'); await t.page.keyboard.press('ArrowRight'); await t.wait(200);
        const v = await t.E(sub); return v === 'Monotone* | Steffen | Makima | Catmull-Rom' ? true : v;
    });
    await t.step('Escape goes back to the type menu, still open', async () => {
        await t.page.keyboard.press('Escape'); await t.wait(300);
        const v = await t.E(sub); const m = await t.E(`el.querySelector('#et_0').style.display`);
        return v === 'closed' && m === 'block' ? true : v + ' / ' + m;
    });
    await t.step('Enter reopens it; ↓ ↓ Enter picks Steffen, saved with the entity, both menus closed', async () => {
        await t.page.keyboard.press('Enter'); await t.wait(200);
        await t.page.keyboard.press('ArrowDown'); await t.page.keyboard.press('ArrowDown'); await t.page.keyboard.press('Enter'); await t.wait(400);
        const d = await t.E(ds); const p = await t.E(`el.instance.store.entry('sensor.power')?.interpolation`);
        const m = await t.E(`el.querySelector('#et_0').style.display+'/'+el.querySelector('#er_0').style.display`);
        return d.startsWith('steffen') && p === 'steffen' && m === 'none/none' ? true : [d, p, m].join(' ; ');
    });
    await t.step('mouse: click Reconstruction, then Makima', async () => {
        await t.longPress(await t.E('legendPt(0,0)'));
        await t.E(`el.querySelector('#et_0_interp').click()`); await t.wait(200);
        const v = await t.E(sub);
        await t.E(`el.querySelector('#er_0_makima').click()`); await t.wait(300);
        const d = await t.E(ds);
        return v.startsWith('Monotone | Steffen*') && d.startsWith('makima') ? true : v + ' ; ' + d;
    });
    await t.step('no Reconstruction for a straight line', async () => {
        await t.longPress(await t.E('legendPt(0,1)'));
        const v = await t.E(menu); await t.page.keyboard.press('Escape');
        return !/Reconstruction/.test(v) ? true : v;
    });
    done(await t.close());

    // ── Entities added from the UI: the card's default, a menu choice kept after a reload ──
    t = await openCard(card({ cardName: 'p', interpolation: 'steffen', graphs: [] }), { height: 900 });
    const all = `el.instance.graphs.map(g=>g.chart.data.datasets.map(d=>d.entity_id.split('.')[1]+':'+d.hecInterpolation).join(',')).join(' | ')`;
    await t.step('entities added from the UI follow the card\'s interpolation', async () => {
        await t.E(`(()=>{ const I=el.instance; for( const id of ['sensor.power','sensor.rain'] ) I._createAndPersistEntity(id, 'line', 'smart'); I.updateHistoryWithClearCache(); I.writeLocalState(); })()`);
        await t.wait(1500); const v = await t.E(all); return /power:steffen/.test(v) && /rain:steffen/.test(v) ? true : v;
    });
    await t.step('a Reconstruction choice is kept after a reload', async () => {
        await t.longPress(await t.E('legendPt(0,0)'));
        await t.E(`el.querySelector('#et_0_interp').click()`); await t.wait(200);
        await t.E(`el.querySelector('#er_0_makima').click()`); await t.wait(800);
        const before = await t.E(all);
        await t.page.reload(); await t.wait(3500);
        const after = await t.E(all);
        return /makima/.test(before) && after === before ? true : before + ' => ' + after;
    });
    done(await t.close());

    // ── The info panel: same submenu, `interpolation` in its configuration ──
    t = await openCard({}, { page: 'panel.html', panel: { lineMode: 'curves', interpolation: 'steffen' }, mock: { series: true }, height: 800 });
    await t.E(`openPanel('sensor.power')`); await t.wait(2500);
    await t.step('info panel: the Reconstruction submenu, from its configuration\'s interpolation', async () => {
        await t.E(`inst()._this.querySelector('#tf_0').click()`); await t.wait(300);
        await t.E(`inst()._this.querySelector('#et_0_interp').click()`); await t.wait(300);
        const v = await t.E(`[...inst()._this.querySelectorAll('#er_0 a')].map(a=>a.textContent+(a.style.fontWeight==='bold'?'*':'')).join(' | ')`);
        await t.E(`inst()._this.querySelector('#er_0_catmullrom').click()`); await t.wait(300);
        const d = await t.E(`inst().graphs[0].chart.data.datasets[0].hecInterpolation`);
        return v === 'Monotone | Steffen* | Makima | Catmull-Rom' && d === 'catmullrom' ? true : v + ' ; ' + d;
    });
    done(await t.close());

    // ── The submenu at the edges of the screen, inside a shadow root (as in Home
    // Assistant), on a touch screen; the load of the automatic refresh ──
    const LINE = { graphs: [{ type: 'line', entities: [{ entity: 'sensor.power', lineMode: 'smart' }, { entity: 'sensor.power2', lineMode: 'curves' }] }] };
    // Boxes of the type menu, its Reconstruction item and the submenu, and the viewport
    const boxes = (R = 'el') => `(()=>{ const q=s=>${R}.querySelector(s).getBoundingClientRect().toJSON();
        return { m:q('#et_0'), i:q('#et_0_interp'), s:q('#er_0'), vw:innerWidth, vh:innerHeight }; })()`;
    const inView = b => b.left >= 0 && b.top >= 0 && b.right <= b.vw + 0.5 && b.bottom <= b.vh + 0.5;
    const openAt = (x, y) => `(()=>{ const I=el.instance; const g=I.graphs[0]; I.showEntityTypeMenu(0, 'sensor.power', g, ${x}, ${y}); I.showInterpolationMenu(0); })()`;

    // ── Position ──
    t = await openCard(card(LINE), { height: 700 });
    await t.step('in the middle: the submenu on the right of its item, level with it', async () => {
        await t.E(openAt(300, 200)); await t.wait(200);
        const b = await t.E(boxes());
        const ok = Math.abs(b.s.left - b.m.right) < 4 && Math.abs(b.s.top - b.i.top) < 2 && inView({ ...b.s, vw: b.vw, vh: b.vh });
        await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape');
        return ok ? true : JSON.stringify(b);
    });
    await t.step('at the right edge: menu and submenu within the viewport, the submenu on the left of the menu', async () => {
        await t.E(openAt('innerWidth - 20', 200)); await t.wait(200);
        const b = await t.E(boxes());
        const ok = inView({ ...b.m, vw: b.vw, vh: b.vh }) && inView({ ...b.s, vw: b.vw, vh: b.vh }) && b.s.right <= b.m.left + 4;
        await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape');
        return ok ? true : JSON.stringify(b);
    });
    await t.step('at the bottom edge: menu and submenu within the viewport', async () => {
        await t.E(openAt(300, 'innerHeight - 10')); await t.wait(200);
        const b = await t.E(boxes());
        const ok = inView({ ...b.m, vw: b.vw, vh: b.vh }) && inView({ ...b.s, vw: b.vw, vh: b.vh });
        await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape');
        return ok ? true : JSON.stringify(b);
    });
    done(await t.close());

    // ── Inside a shadow root, as in Home Assistant ──
    t = await openCard(card(LINE), { height: 700 });
    await t.E(`(()=>{ const host=document.createElement('div'); document.body.prepend(host); const sr=host.attachShadow({mode:'open'}); sr.appendChild(el); })()`);
    await t.wait(2500);
    await t.step('in a shadow root: focus moves to the submenu, both stay open; keyboard choice applied', async () => {
        await t.longPress(await t.E('legendPt(0,0)'));
        await t.page.keyboard.press('ArrowDown'); await t.page.keyboard.press('ArrowUp'); await t.page.keyboard.press('ArrowRight');
        await t.wait(500);   // (longer than the focusout check)
        const open = await t.E(`el.querySelector('#et_0').style.display + '/' + el.querySelector('#er_0').style.display`);
        await t.page.keyboard.press('ArrowDown'); await t.page.keyboard.press('ArrowDown'); await t.page.keyboard.press('ArrowDown'); await t.page.keyboard.press('Enter');
        await t.wait(400);
        const d = await t.E(`el.instance.graphs[0].chart.data.datasets[0].hecInterpolation`);
        return open === 'block/block' && d === 'makima' ? true : open + ' ; ' + d;
    });
    await t.step('in a shadow root: mouse, item then algorithm', async () => {
        await t.longPress(await t.E('legendPt(0,0)'));
        const i = await t.E(`(()=>{ const r=el.querySelector('#et_0_interp').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
        await t.page.mouse.click(i.x, i.y); await t.wait(500);
        const open = await t.E(`el.querySelector('#et_0').style.display + '/' + el.querySelector('#er_0').style.display`);
        const a = await t.E(`(()=>{ const r=el.querySelector('#er_0_catmullrom').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
        await t.page.mouse.click(a.x, a.y); await t.wait(400);
        const d = await t.E(`el.instance.graphs[0].chart.data.datasets[0].hecInterpolation`);
        return open === 'block/block' && d === 'catmullrom' ? true : open + ' ; ' + d;
    });
    await t.step('in a shadow root: a click outside closes both menus', async () => {
        await t.longPress(await t.E('legendPt(0,0)'));
        await t.E(`el.querySelector('#et_0_interp').click()`); await t.wait(200);
        await t.page.mouse.click(5, 690); await t.wait(500);
        const v = await t.E(`el.querySelector('#et_0').style.display + '/' + el.querySelector('#er_0').style.display`);
        return v === 'none/none' ? true : v;
    });
    done(await t.close());

    // ── Touch ──
    t = await openCard(card(LINE), { touch: true, height: 700 });
    await t.step('touch: long-press the label, tap Reconstruction, tap Steffen', async () => {
        await t.touchLongPress(await t.E('legendPt(0,0)'));
        const i = await t.E(`(()=>{ const r=el.querySelector('#et_0_interp').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
        await t.tap(i); await t.wait(500);
        const open = await t.E(`el.querySelector('#er_0').style.display`);
        const a = await t.E(`(()=>{ const r=el.querySelector('#er_0_steffen').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
        await t.tap(a); await t.wait(500);
        const d = await t.E(`el.instance.graphs[0].chart.data.datasets[0].hecInterpolation`);
        return open === 'block' && d === 'steffen' ? true : open + ' ; ' + d;
    });
    done(await t.close());

    // ── Automatic refresh: at most one history request every 2 s, never starved ──
    for( const showCurrentValues of [true, false] ) {
        t = await openCard(card({ showCurrentValues, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true } });
        await t.wait(1500);
        const n = () => t.E(`__ws.filter(w=>w.type==='history/history_during_period').length`);
        await t.step(`refresh (showCurrentValues ${showCurrentValues}): a value changing every 0.5 s → one request every 2 s`, async () => {
            const n0 = await n();
            for( let i = 0; i < 20; i++ ) { await t.E(`setState('sensor.power', ${400 + i})`); await t.wait(500); }
            const k = (await n()) - n0;
            return k >= 4 && k <= 6 ? true : `${k} requests in 10 s`;
        });
        await t.step(`refresh (showCurrentValues ${showCurrentValues}): one change → one request, within 2 s, none after`, async () => {
            await t.wait(2500); const n0 = await n();
            await t.E(`setState('sensor.power', 999)`); await t.wait(2600);
            const n1 = await n(); await t.wait(3000); const n2 = await n();
            return n1 - n0 === 1 && n2 === n1 ? true : `${n1 - n0} then ${n2 - n1}`;
        });
        done(await t.close());
    }

    // ── The info panel refreshes the same way (same code as the card) ──
    t = await openCard({}, { page: 'panel.html', panel: {}, mock: { series: true }, height: 800 });
    await t.E(`openPanel('sensor.power')`); await t.wait(2500);
    {
        const n = () => t.E(`__ws.filter(w=>w.type==='history/history_during_period').length`);
        await t.step('info panel refresh: a value changing every 0.5 s → one request every 2 s', async () => {
            const n0 = await n();
            for( let i = 0; i < 20; i++ ) { await t.E(`setState('sensor.power', ${400 + i})`); await t.wait(500); }
            const k = (await n()) - n0;
            return k >= 4 && k <= 6 ? true : `${k} requests in 10 s`;
        });
        await t.step('info panel refresh: one change → one request, within 2 s, none after', async () => {
            await t.wait(2500); const n0 = await n();
            await t.E(`setState('sensor.power', 999)`); await t.wait(2600);
            const n1 = await n(); await t.wait(3000); const n2 = await n();
            return n1 - n0 === 1 && n2 === n1 ? true : `${n1 - n0} then ${n2 - n1}`;
        });
    }
    done(await t.close());

    // ── The info panel reads its configuration as the card does (same code) ──
    t = await openCard({}, { page: 'panel.html', panel: { lineMode: 'curve', ylock: true, showSamples: 3 }, mock: { series: true }, height: 800 });
    await t.E(`openPanel('sensor.power')`); await t.wait(2500);
    await t.step('info panel config: lineMode alias, a graph option and a synonym at its root, as on the card', async () => {
        const v = await t.E(`(()=>{ const g=inst().graphs[0]; const d=g.chart.data.datasets[0]; return [inst().pconfig.defaultLineMode, g.ylock, d.pointRadius].join(':'); })()`);
        return v === 'curves:true:3' ? true : v;
    });
    done(await t.close());

    return { passed, failed };
};
