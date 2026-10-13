// What the card does with Home Assistant's data: history, long-term statistics, CSV
// export, refresh, current values, the entity selector, dark mode, other languages
const { openCard } = require('./lib.cjs');

const card = (extra) => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24h', ...extra });
const HOUR = 3600e3;

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };
    const wsOf = (t, type) => t.E(`__ws.filter(w=>w.type==='${type}')`);

    // ── History ──
    let t = await openCard(card({ statistics: { enabled: false }, graphs: [
        { type: 'line', entities: [{ entity: 'sensor.power' }] },
        { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }] }] }), { mock: { series: true } });
    await t.step('history: one request for every entity, over the time window shown', async () => {
        const ws = await wsOf(t, 'history/history_during_period');
        const span = ws.length ? (Date.parse(ws[0].end) - Date.parse(ws[0].start)) / HOUR : 0;
        return ws.length >= 1 && ws[0].ids.includes('sensor.power') && ws[0].ids.includes('binary_sensor.a') && span >= 24 ? true : JSON.stringify(ws);
    });
    await t.step('history: the curve gets every point, the timeline its state changes', async () => {
        const c = (await t.E('datasets(0)'))[0]; const tl = await t.E('datasets(1)');
        return c.n > 100 && tl[0].n > 5 ? true : JSON.stringify({ c, tl });
    });
    await t.step('history: moving back one day fetches that day', async () => {
        const n0 = (await wsOf(t, 'history/history_during_period')).length;
        await t.E(`el.querySelector('#b1_0').click()`); await t.wait(1200);
        const ws = await wsOf(t, 'history/history_during_period');
        const last = ws[ws.length - 1];
        return ws.length > n0 && Date.parse(last.start) < Date.now() - 40 * HOUR ? true : JSON.stringify(ws.slice(n0));
    });
    done(await t.close());

    // ── Long-term statistics ──
    t = await openCard(card({ defaultTimeRange: '1w', statistics: { enabled: true, period: 'hour' },
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true, historyDays: 2 } });
    await t.wait(1500);
    await t.step('statistics: where the history ends (2 days back), the statistics take over', async () => {
        const st = await wsOf(t, 'recorder/statistics_during_period');
        const d = (await t.E('datasets(0)'))[0];
        const back = d.x0 ? (Date.now() - d.x0) / HOUR : 0;
        return st.length >= 1 && st[0].ids.includes('sensor.power') && back > 24 * 5 ? true : JSON.stringify({ st, d, backHours: back });
    });
    done(await t.close());

    t = await openCard(card({ defaultTimeRange: '2d', statistics: { enabled: true, period: 'hour', force: true },
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true } });
    await t.step('statistics forced: statistics only, no history request', async () => {
        const st = await wsOf(t, 'recorder/statistics_during_period'); const h = await wsOf(t, 'history/history_during_period');
        const d = (await t.E('datasets(0)'))[0];
        return st.length >= 1 && h.length === 0 && d.n > 20 ? true : JSON.stringify({ st: st.length, h: h.length, d });
    });
    done(await t.close());

    // ── CSV export ──
    t = await openCard(card({ statistics: { enabled: true }, csv: { separator: ';' },
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.rain' }] }] }), { mock: { series: true } });
    const save = async (fn) => { await t.E('captureSave()'); await t.E(fn); for( let i = 0; i < 20 && !(await t.E('__saved')); i++ ) await t.wait(100); return t.E('__saved'); };
    await t.step('CSV export of the history: every entity, every point, the separator configured', async () => {
        const f = await save('el.instance.exportFile()');
        if( !f ) return 'nothing saved';
        const lines = f.text.split('\r\n');
        const spinner = await t.E(`!!(el.instance.ui.spinOverlay && el.instance.ui.spinOverlay.isConnected)`);
        return /\.csv$/.test(f.name) && lines[0] === 'Time stamp;State' && lines.includes('sensor.power') && lines.includes('sensor.rain') &&
            lines.filter(l => /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d;/.test(l)).length > 200 && !spinner ? true : f.name + ' ' + lines.slice(0, 4).join(' | ') + ' spinner ' + spinner;
    });
    await t.step('CSV export of the statistics: mean, min and max per hour', async () => {
        const f = await save('el.instance.exportStatistics()');
        if( !f ) return 'nothing saved';
        const lines = f.text.split('\r\n');
        return lines[0] === 'Time stamp;State;Mean;Min;Max' && lines.includes('sensor.power') && lines.filter(l => l.split(';').length === 5).length > 20 ? true : lines.slice(0, 4).join(' | ');
    });
    done(await t.close());

    t = await openCard(card({ statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true } });
    await t.step('CSV export failing: no error, the spinner goes away', async () => {
        await t.E(`MOCK.fail=['history/history_during_period']`);
        await t.E('captureSave()'); await t.E('el.instance.exportFile()'); await t.wait(800);
        const spinner = await t.E(`!!(el.instance.ui.spinOverlay && el.instance.ui.spinOverlay.isConnected)`);
        await t.E(`MOCK.fail=[]`);
        return !spinner && !(await t.E('__saved')) ? true : 'spinner left: ' + spinner;
    });
    done(await t.close());

    // ── Current values, automatic refresh ──
    t = await openCard(card({ statistics: { enabled: false }, refresh: { automatic: true },
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true } });
    await t.step('current value shown in the legend, updated when the state changes', async () => {
        // (Home Assistant pushes its state again and again: the card compares each push with
        // the previous one)
        await t.E('el.hass = mkHass()'); await t.wait(200);
        const l0 = (await t.E('datasets(0)'))[0].label;
        await t.E(`setState('sensor.power', 555)`); await t.wait(600);
        const l1 = (await t.E('datasets(0)'))[0].label;
        return /\(400 W\)/.test(l0) && /\(555 W\)/.test(l1) ? true : `${l0} -> ${l1}`;
    });
    await t.step('automatic refresh: a state change fetches the history again', async () => {
        const n0 = (await wsOf(t, 'history/history_during_period')).length;
        await t.E(`setState('sensor.power', 610)`); await t.wait(3000);
        const n1 = (await wsOf(t, 'history/history_during_period')).length;
        return n1 > n0 ? true : `requests ${n0} -> ${n1}`;
    });
    done(await t.close());

    t = await openCard(card({ statistics: { enabled: false }, refresh: { interval: 1 },
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true } });
    await t.step('refresh interval: the history is fetched again every interval', async () => {
        const n0 = (await wsOf(t, 'history/history_during_period')).length;
        await t.wait(3500);
        const n1 = (await wsOf(t, 'history/history_during_period')).length;
        return n1 >= n0 + 2 ? true : `requests ${n0} -> ${n1}`;
    });
    done(await t.close());

    // ── Entity selector ──
    t = await openCard(card({ statistics: { enabled: false }, graphs: [] }), { mock: { series: true }, height: 1100 });
    const openEntries = () => t.E(`[...el.querySelectorAll('#es_0 a')].filter(a=>a.style.display!=='none').map(a=>a.dataset.entity)`);
    await t.step('entity selector: typing filters the list', async () => {
        await t.page.click('#b7_0'); await t.page.keyboard.type('power'); await t.wait(500);
        const e = await openEntries();
        return e.includes('sensor.power') && e.includes('sensor.power_kw') && !e.includes('sensor.rain') ? true : JSON.stringify(e);
    });
    await t.step('entity selector: Enter on an entry, then a type, adds the entity', async () => {
        await t.page.keyboard.press('ArrowDown'); await t.page.keyboard.press('Enter'); await t.wait(500);
        const menu = await t.E('menuOpen()');
        if( !menu ) return 'type menu not open';
        await t.E(`el.querySelector('#et_0_1').click()`); await t.wait(1200);
        const g = await t.graphs();
        return g.length === 1 && /^l:power/.test(g[0]) && (await t.E(`el.instance.store.has('sensor.power')`)) ? true : g.join(' | ');
    });
    await t.step('entity selector: clicking an entry, then a type, adds it', async () => {
        await t.page.click('#b7_0'); await t.page.keyboard.press('Control+A'); await t.page.keyboard.type('rain'); await t.wait(400);
        await t.page.click(`#es_0 a[data-entity="sensor.rain"]`); await t.wait(500);
        if( !(await t.E('menuOpen()')) ) return 'type menu not open';
        await t.E(`el.querySelector('#et_0_1').click()`); await t.wait(1200);
        return (await t.E(`el.instance.store.has('sensor.rain')`)) ? true : (await t.graphs()).join(' | ');
    });
    await t.step('entity selector: a pattern adds every match not shown yet', async () => {
        await t.page.click('#b7_0'); await t.page.keyboard.press('Control+A'); await t.page.keyboard.type('sensor.energy*'); await t.wait(400);
        // (an entry highlighted, a first Enter selects every match, the second adds them)
        await t.page.keyboard.press('ArrowDown'); await t.page.keyboard.press('Enter'); await t.wait(300);
        await t.page.keyboard.press('Enter'); await t.wait(500);
        await t.E(`el.querySelector('#et_0_default').click()`); await t.wait(1200);
        const has = await t.E(`['sensor.energy','sensor.energy2'].map(id=>el.instance.store.has(id))`);
        return has.every(x => x) ? ((await t.E('storeProblems()')) || true) : JSON.stringify({ has, g: await t.graphs() });
    });
    done(await t.close());

    // ── recordedEntitiesOnly: only the entities recorded in the last hour are listed ──
    t = await openCard(card({ statistics: { enabled: false }, recordedEntitiesOnly: true, graphs: [] }), { mock: { series: true } });
    await t.wait(800);
    await t.step('recorded entities only: the last hour asked with its time zone, the entities found listed', async () => {
        const r = await t.E(`(()=>{ const q=__ws.find(w=>w.type==='history/history_during_period' && !w.end);
            return { start: q?.start ?? null, ago: q ? Date.now() - Date.parse(q.start) : null, listed: el.querySelectorAll('#es_0 a[data-entity]').length }; })()`);
        // (an hour ago, give or take the time the card took to start)
        return /([+-]\d\d:\d\d|Z)$/.test(r.start ?? '') && r.ago > 3500e3 && r.ago < 3700e3 && r.listed > 0 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The cursor line (cursor.mode, cursor.types), the min/max band (showMinMax) ──
    const cursorCard = mode => card({ statistics: { enabled: false }, cursor: { mode, types: ['line'] }, graphs: [
        { type: 'line', entities: [{ entity: 'sensor.power', showMinMax: 'history' }] },
        { type: 'line', entities: [{ entity: 'sensor.tank' }] },
        { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }] } ] });
    // Over graph 0's curves: which graphs draw the cursor line
    const cursorDrawn = async () => { const c = await t.E('graphPtAt(0, 0.5)'); await t.page.mouse.move(c.x, c.y); await t.page.mouse.move(c.x + 5, c.y); await t.wait(300);
        return t.E(`el.instance._allGraphsInDisplayOrder().map(g=>g.chart._hecCursorLine?.draw?1:0).join('')`); };
    t = await openCard(cursorCard('auto'), { height: 1200, mock: { series: true } }); await t.wait(800);
    await t.step('cursor auto: the line drawn on the graph under the pointer only', async () => {
        const d = await cursorDrawn(); return d === '100' ? true : d;
    });
    await t.step('min/max band: drawn between the points\' min and max (showMinMax: history)', async () => {
        const r = await t.E(`(()=>{ const c=graphAt(0).chart, ds=c.data.datasets[0]; const withMM=ds.data.filter(p=>p.yMin!=null).length;
            const count=()=>{ let n=0; const f=c.ctx.fill; c.ctx.fill=function(){ n++; return f.apply(this,arguments); }; c.draw(); c.ctx.fill=f; return n; };
            const on=count(); ds.showMinMax=false; const off=count(); ds.showMinMax=true; return { withMM, on, off }; })()`);
        return r.withMM > 1 && r.on > r.off ? true : JSON.stringify(r);
    });
    done(await t.close());
    t = await openCard(cursorCard('all'), { height: 1200, mock: { series: true } }); await t.wait(800);
    await t.step('cursor all: the line drawn on every graph of the card at once', async () => {
        const d = await cursorDrawn(); return d === '111' ? true : d;
    });
    done(await t.close());
    t = await openCard(cursorCard('hide'), { height: 1200, mock: { series: true } }); await t.wait(800);
    await t.step('cursor hide: no line', async () => {
        const d = await cursorDrawn(); return d === '000' ? true : d;
    });
    done(await t.close());

    // ── A legend too narrow for its labels: shortened, the value kept ──
    t = await openCard(card({ statistics: { enabled: false }, graphs: [{ type: 'line', entities: [
        { entity: 'sensor.power', name: 'Ecowitt Vitesse du vent (Filtered)' }, { entity: 'sensor.power2', name: 'Météo-France Villeveyrac Vitesse du vent' }] }] }),
        { mock: { series: true, language: 'fr' } });
    const legendAt = async w => {
        await t.E(`(()=>{ document.body.style.width='${w}px'; document.getElementById('host').style.width='${w}px'; })()`); await t.wait(1500);
        return t.E(`(()=>{ const c=graphAt(0).chart, L=c.legend;
            return { texts: L.legendItems.map(i=>i.text), within: L.legendHitBoxes.every(b=>b.left>=0 && b.left+b.width<=c.width+1) }; })()`);
    };
    await t.step('a legend too narrow: every name at the same step (the device removed for both), then cut before the value — the lines below the first on the whole width; full width: as it is', async () => {
        const wide = await legendAt(1000), mid = await legendAt(374), narrow = await legendAt(168);
        await legendAt(1000);
        return wide.texts[0] === 'Ecowitt Vitesse du vent (Filtered) (400 W)' && wide.texts[1] === 'Météo-France Villeveyrac Vitesse du vent (300 W)'
            && mid.texts[0] === 'Vitesse du vent (Filtered) (400 W)' && mid.texts[1] === 'Vitesse du vent (300 W)'
            && narrow.texts.every((x, i) => x.endsWith(i ? '(300 W)' : '(400 W)') && x !== wide.texts[i]) && narrow.texts.some(x => /…/.test(x)) && narrow.within ? true : JSON.stringify({ wide, mid, narrow });
    });
    await t.step('a qualifier many entities of Home Assistant carry ((Filtered), 3 of them): its initials first, (F); the other curve at the same step', async () => {
        await t.E(`(()=>{ for( const [k, n] of ['Température', 'Humidité', 'Pression'].entries() ) { const id='sensor.f_'+k;
            STATES[id]={ entity_id:id, state:'1', last_changed:lc, last_updated:lc, attributes:{ friendly_name:'Ecowitt '+n+' (Filtered)', unit_of_measurement:'x' } }; }
            el.hass=mkHass(); })()`);
        const mid = await legendAt(374);
        await legendAt(1000);
        return mid.texts[0] === 'Ecowitt Vitesse du vent (F) (400 W)' && mid.texts[1] === 'Météo-France Villeveyrac Vitesse du vent (300 W)'
            || mid.texts[0] === 'Vitesse du vent (F) (400 W)' && mid.texts[1] === 'Vitesse du vent (300 W)' ? true : JSON.stringify(mid);
    });
    done(await t.close());

    // ── A bar graph's legend clear of its interval selector ──
    t = await openCard(card({ statistics: { enabled: false }, graphs: [{ type: 'bar', entities: [{ entity: 'sensor.energy', name: 'Énergie consommée maison' }] }] }),
        { mock: { series: true, language: 'fr' } });
    await t.step('a bar graph: its legend labels never under its interval selector — 1000, 374 and 230 px', async () => {
        const r = [];
        for( const w of [1000, 374, 230] ) {
            await t.E(`(()=>{ document.body.style.width='${w}px'; document.getElementById('host').style.width='${w}px'; })()`); await t.wait(1500);
            r.push(await t.E(`(()=>{ const g=el.instance.graphs[0], c=g.chart, cr=c.canvas.getBoundingClientRect(), bd=el.querySelector('#bd-'+g.id).getBoundingClientRect();
                return c.legend.legendHitBoxes.some(h => cr.left+h.left+h.width > bd.left && cr.left+h.left < bd.right && cr.top+h.top < bd.bottom && cr.top+h.top+h.height > bd.top) ? '${w}: under' : ''; })()`));
        }
        return r.every(x => x === '') ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── A narrow card (under 300 px): the toolbar on lines of its own, the Y labels inside ──
    t = await openCard(card({ statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] },
        { type: 'line', yLabels: 'outside', entities: [{ entity: 'sensor.rain' }] }] }), { mock: { series: true, language: 'fr' } });
    const narrowAt = async w => {
        await t.E(`(()=>{ document.body.style.width='${w}px'; document.getElementById('host').style.width='${w}px'; })()`); await t.wait(1500);
        return t.E(`(()=>{ const card=el.querySelector('#maincard').getBoundingClientRect();
            const els=[...el.querySelectorAll('#tb_0 button, #tb_0 select, #tb_0 input')].filter(b=>b.offsetParent);
            const out=els.filter(b=>{ const r=b.getBoundingClientRect(); return r.left<card.left-1||r.right>card.right+1; }).map(b=>b.id);
            const rows=new Set(els.filter(b=>b.id!=='b7_0'&&b.id!=='bo_0').map(b=>Math.round(b.getBoundingClientRect().top/10))).size;
            const c=graphAt(0).chart, A=c.chartArea, s0=c.scales['y-axis-0'];
            return { out, rows, inside: c.options.scales.yAxes[0].ticks.mirror, outsideKept: !graphAt(1).chart.options.scales.yAxes[0].ticks.mirror,
                     plotLeft: Math.round(A.left), boxes: (s0._hecDeferredLabels||[]).length, boxColor: c.options.scales.yAxes[0].ticks.hecBackdrop?.color ?? null,
                     fonts: [c.options.scales.yAxes[0].ticks.minor.fontSize, graphAt(1).chart.options.scales.yAxes[0].ticks.minor.fontSize, c.options.scales.xAxes[0].ticks.minor.fontSize, c.options.legend.labels.fontSize].join() }; })()`);
    };
    await t.step('a narrow card (168 px): the date, the range and the search each on a line, nothing out of the card; the Y labels inside, each in a box of the card\'s background, 80 % opaque, at mini-graph-card\'s size (yLabels: outside kept), the text a little smaller; wide again: as before', async () => {
        const wide = await narrowAt(1000), narrow = await narrowAt(168), back = await narrowAt(1000);
        return !wide.inside && wide.rows === 1 && !wide.boxes && !narrow.out.length && narrow.rows === 2 && narrow.inside && narrow.outsideKept && narrow.plotLeft < 30
            && narrow.boxes > 1 && /^rgba\(.*,0\.8\)$/.test(narrow.boxColor) && !back.inside && back.rows === 1 && !back.boxes
            && wide.fonts === '12,12,12,12' && narrow.fonts === '10.5,11,11,11' && back.fonts === wide.fonts ? true : JSON.stringify({ wide, narrow, back });
    });
    done(await t.close());

    // ── Dark mode, language ──
    t = await openCard(card({ statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { dark: true, language: 'fr' } });
    await t.step('dark theme: light labels on the graphs', async () => {
        const c = await t.E(`[el.instance.ui.darkMode, graphAt(0).chart.options.scales.yAxes[0].ticks.fontColor]`);
        return !!c[0] && /9b9b9b|155, ?155, ?155/i.test(String(c[1])) ? true : JSON.stringify(c);
    });
    await t.step('dark theme: the entity selector in the theme\'s colors, not the browser\'s white field', async () => {
        const c = await t.E(`(()=>{ const s=getComputedStyle(el.querySelector('#b7_0')); return [s.backgroundColor, s.color]; })()`);
        return !/255, ?255, ?255/.test(c[0]) ? true : JSON.stringify(c);
    });
    await t.step('French: the menus are in French', async () => {
        const txt = await t.E(`el.querySelector('#ef_0')?.textContent`);
        return txt === 'Historique' ? true : JSON.stringify(txt);
    });
    done(await t.close());

    return { passed, failed };
};
