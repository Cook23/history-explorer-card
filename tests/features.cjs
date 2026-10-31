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
    await t.step('statistics forced: the statistics only — hourly and 5-minute ones (a column of pixels shorter than 5 minutes), the history only after the 5-minute ones (the last 20 minutes)', async () => {
        const st = await wsOf(t, 'recorder/statistics_during_period'); const h = await wsOf(t, 'history/history_during_period');
        const d = (await t.E('datasets(0)'))[0];
        const recent = h.every(w => Date.parse(w.start) >= Date.now() - 25 * 60e3);
        return st.map(w => w.period).sort().join() === '5minute,hour' && h.length <= 1 && recent && d.n > 20 ? true : JSON.stringify({ st, h, d });
    });
    await t.step('the tooltip of a point of the 5-minute statistics: "Statistics 5 min" and the time it covers', async () => {
        const r = await t.E(`(()=>{ const c=graphAt(0).chart, ds=c.data.datasets[0], cb=c.options.tooltips.callbacks;
            const i=ds.data.findIndex(p=>p.statisticsPeriod===300e3); if( i<0 ) return null;
            return cb.title([{ datasetIndex:0, index:i, xLabel:'X', yLabel:ds.data[i].y }], c.data); })()`);
        return /^Statistics 5 min: .+ – /.test(r ?? '') ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── 6 months: the statistics for the curves; an entity without statistics (a timeline)
    // from the history; the tooltip telling where a point comes from ──
    t = await openCard(card({ defaultTimeRange: '6o', statistics: { enabled: true },
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }, { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }] }] }), { mock: { series: true } });
    await t.wait(3000);
    await t.step('6 months: the statistics asked for the curve only — hourly over the window, 5-minute ones for the day the hourly ones don\'t cover yet; the timeline (no statistics) from the history, over the whole window; the curve\'s history only after the 5-minute statistics (the last 20 minutes)', async () => {
        const st = await wsOf(t, 'recorder/statistics_during_period'), h = await wsOf(t, 'history/history_during_period');
        const hourly = st.filter(w => w.period === 'hour'), fine = st.filter(w => w.period === '5minute');
        const old = h.filter(w => Date.parse(w.start) < Date.now() - 26 * HOUR), curve = h.filter(w => w.ids.includes('sensor.power'));
        const ok = hourly.length === 1 && hourly[0].ids.join() === 'sensor.power' && fine.length === 1 && Date.parse(fine[0].start) >= Date.now() - 26 * HOUR
            && old.length >= 1 && old.every(w => !w.ids.includes('sensor.power') && w.ids.includes('binary_sensor.a'))
            && curve.length >= 1 && curve.every(w => Date.parse(w.start) >= Date.now() - 25 * 60e3);
        return ok ? true : JSON.stringify({ st, h: h.map(w => [w.start, w.ids]) });
    });
    await t.step('the tooltip: "Statistics" and the time a point covers, from – to, min / mean / max with the unit; "History" on the recent points', async () => {
        const r = await t.E(`(()=>{ const c=graphAt(0).chart, ds=c.data.datasets[0], cb=c.options.tooltips.callbacks;
            const tip=i=>{ const p=ds.data[i], it={ datasetIndex:0, index:i, xLabel:'X', yLabel:p.y }; return [cb.title([it], c.data), cb.label(it, c.data)]; };
            const si=ds.data.findIndex(p=>p.statistics && p.columnFrom!=null), hi=ds.data.map((p,i)=>!p.statistics?i:-1).filter(i=>i>=0).pop();
            return { s: si>=0 ? tip(si) : null, h: hi!=null ? tip(hi) : null, unit: ds.unit }; })()`);
        const ok = r.s && /^Statistics 1 h: .+ – [\d:]+:00(\s?[ap]m)?$/i.test(r.s[0]) && new RegExp('^(.+: )?-?[\\d.,]+ / -?[\\d.,]+ / -?[\\d.,]+ ' + r.unit + '$').test(r.s[1]) && r.h && /^History: /.test(r.h[0]);
        return ok ? true : JSON.stringify(r);
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

    // ── The search, with an entity_id that isn't a valid CSS identifier (a part starting with a digit) ──
    t = await openCard(card({ graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true, extraStates: {
        'binary_sensor.434110536434007616_bsh_common_setting_childlock': { entity_id: 'binary_sensor.434110536434007616_bsh_common_setting_childlock', state: 'off',
            attributes: { friendly_name: 'Lave-vaisselle Sécurité enfants' }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString() } } } });
    await t.wait(800);
    await t.step('entity selector: typing filters the list, whatever the entity_ids listed', async () => {
        await t.page.click('#b7_0'); await t.page.keyboard.type('power'); await t.wait(500);
        const e = await openEntries(), errors = t.errors.filter(m => /selector/.test(m));
        return e.includes('sensor.power') && !e.includes('sensor.rain') && !errors.length ? true : JSON.stringify({ e, errors });
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
        return t.E(`el.instance.graphsInDisplayOrder().map(g=>g.chart._hecCursorLine?.draw?1:0).join('')`); };
    t = await openCard(cursorCard('auto'), { height: 1200, mock: { series: true } }); await t.wait(800);
    await t.step('cursor auto: the line drawn on the graph under the pointer only', async () => {
        const d = await cursorDrawn(); return d === '100' ? true : d;
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
            return { texts: L.legendItems.map(legendText), within: L.legendHitBoxes.every(b=>b.left>=0 && b.left+b.width<=c.width+1) }; })()`);
    };
    await t.step('a legend too narrow: every name at the same step (the device abbreviated for both), then cut before the value — the lines below the first on the whole width; full width: as it is', async () => {
        const wide = await legendAt(1000), mid = await legendAt(260), narrow = await legendAt(168);
        await legendAt(1000);
        return wide.texts[0] === 'Ecowitt Vitesse du vent (Filtered) (400 W)' && wide.texts[1] === 'Météo-France Villeveyrac Vitesse du vent (300 W)'
            && mid.texts[0] === 'E Vitesse du vent (Filtered) (400 W)' && mid.texts[1] === 'M-F V… Vitesse du vent (300 W)'
            && narrow.texts.every((x, i) => x.endsWith(i ? '(300 W)' : '(400 W)') && x !== wide.texts[i]) && narrow.texts.some(x => /…/.test(x)) && narrow.within ? true : JSON.stringify({ wide, mid, narrow });
    });
    await t.step('a qualifier many entities of Home Assistant carry ((Filtered), 3 of them): its initials first, (F); the other curve at the same step', async () => {
        await t.E(`(()=>{ for( const [k, n] of ['Température', 'Humidité', 'Pression'].entries() ) { const id='sensor.f_'+k;
            STATES[id]={ entity_id:id, state:'1', last_changed:lc, last_updated:lc, attributes:{ friendly_name:'Ecowitt '+n+' (Filtered)', unit_of_measurement:'x' } }; }
            el.hass=mkHass(); })()`);
        const mid = await legendAt(260);
        await legendAt(1000);
        return mid.texts[0] === 'Ecowitt Vitesse du vent (F) (400 W)' && mid.texts[1] === 'Météo-France Villeveyrac Vitesse du vent (300 W)'
            || mid.texts[0] === 'E Vitesse du vent (F) (400 W)' && mid.texts[1] === 'M-F V… Vitesse du vent (300 W)' ? true : JSON.stringify(mid);
    });
    done(await t.close());

    // ── Bars by week: from Monday, each the sum of its week ──
    t = await openCard(card({ statistics: { enabled: false }, defaultTimeRange: '30d', graphs: [{ type: 'bar', interval: 'weekly', entities: [{ entity: 'sensor.energy' }] }] }),
        { mock: { series: true } });
    await t.step('interval: weekly — the selector on Week, a bar each week, from Monday; Day picked: a bar each day, saved', async () => {
        const bars = () => t.E(`(()=>{ const g=el.instance.graphs[0], x=g.chart.data.datasets[0].data.map(p=>+p.x);
            return { sel: el.querySelector('#bd-'+g.id).value, label: el.querySelector('#bd-'+g.id).selectedOptions[0].textContent, step: (x[1]-x[0])/864e5,
                     monday: x.every(v=>{ const m=window.HXLocal_moment(v-(x[1]-x[0])/2); return m.isoWeekday()===1 && m.hours()===0 && m.minutes()===0; }), n: x.length,
                     saved: el.instance.pconfig.entities.find(e=>e.entity==='sensor.energy')?.interval }; })()`);
        const week = await bars();
        await t.E(`(()=>{ const g=el.instance.graphs[0], s=el.querySelector('#bd-'+g.id); s.value='2'; s.dispatchEvent(new Event('change')); })()`); await t.wait(1500);
        const day = await bars();
        return week.sel === '5' && week.label === 'Week' && week.step === 7 && week.monday && week.n >= 4 && day.sel === '2' && day.step === 1 && day.saved === 2
            ? true : JSON.stringify({ week, day });
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
    await t.step('the interval selector in the top row: on the right (before the ×, if any) when the first label fits beside it (1000 px); else centred between the handle and the right, the legend starting below it (340 px)', async () => {
        const r = {};
        for( const w of [1000, 340] ) {
            await t.E(`(()=>{ document.body.style.width='${w}px'; document.getElementById('host').style.width='${w}px'; })()`); await t.wait(1500);
            r[w] = await t.E(`(()=>{ const g=el.instance.graphs[0], c=g.chart, cr=c.canvas.getBoundingClientRect(), bd=el.querySelector('#bd-'+g.id).getBoundingClientRect();
                const cb=c._hecCloseButtonRect(), lh=c._hecLockAndHandleRect(), h=c.legend.legendHitBoxes[0], R=cb?cb.x-8:c.width-4;
                return { reserved: !!c._hecTopRowReserved, right: Math.round(cr.left+R-bd.right), mid: Math.round((bd.left+bd.right)/2-(cr.left+((lh?lh.x+lh.width:0)+R)/2)),
                         top: Math.round((bd.top+bd.bottom)/2-(cr.top+11.5)), below: cr.top+h.top >= bd.bottom-1 }; })()`);
        }
        const wide = r[1000], narrow = r[340];
        const ok = !wide.reserved && Math.abs(wide.right) <= 1 && Math.abs(wide.top) <= 1 && narrow.reserved && Math.abs(narrow.mid) <= 1 && Math.abs(narrow.top) <= 1 && narrow.below;
        return ok ? true : JSON.stringify(r);
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
                     plotLeft: Math.round(A.left), boxes: (s0._hecDeferredLabels||[]).length, boxColor: c.options.scales.yAxes[0].ticks.hecBackdrop ? c.constructor.hecUi.background(c.canvas, c.constructor.hecUi.BOX_OPACITY) : null,
                     fonts: [c.options.scales.yAxes[0].ticks.minor.fontSize, graphAt(1).chart.options.scales.yAxes[0].ticks.minor.fontSize, c.options.scales.xAxes[0].ticks.minor.fontSize, c.options.legend.labels.fontSize].join() }; })()`);
    };
    await t.step('a narrow card (168 px): the date, the range and the search each on a line, nothing out of the card; the Y labels inside, each in a box of the card\'s background, 80 % opaque, at mini-graph-card\'s size (yLabels: outside kept), the text a little smaller; wide again: as before', async () => {
        const wide = await narrowAt(1000), narrow = await narrowAt(168), back = await narrowAt(1000);
        return !wide.inside && wide.rows === 1 && !wide.boxes && !narrow.out.length && narrow.rows === 2 && narrow.inside && narrow.outsideKept && narrow.plotLeft < 30
            && narrow.boxes > 1 && /^rgba\(.*,0\.8\)$/.test(narrow.boxColor) && !back.inside && back.rows === 1 && !back.boxes
            && wide.fonts === '12,12,12,12' && narrow.fonts === '10.5,11,11,11' && back.fonts === wide.fonts ? true : JSON.stringify({ wide, narrow, back });
    });
    done(await t.close());

    // ── The controls at a graph's top left (handle, padlock, chain icon): never any room of their own ──
    t = await openCard(card({ statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'binary_sensor.a', type: 'timeline' }] },
        { type: 'line', entities: [{ entity: 'sensor.rain' }] }] }), { mock: { series: true } });
    const controlsAt = async w => {
        await t.E(`(()=>{ document.body.style.width='${w}px'; document.getElementById('host').style.width='${w}px'; })()`); await t.wait(1500);
        return t.E(`(()=>{ const c=i=>graphAt(i).chart, bd=i=>c(i)._hecControlsBackdropEl, shown=e=>!!e&&e.style.display!=='none';
            const lm=c(1)._hecLinkMarkerRect();
            return { boxes: [0,1,2].map(i=>shown(bd(i))).join(), boxColor: shown(bd(0)) ? getComputedStyle(bd(0)).backgroundColor : null,
                     chainColor: getComputedStyle(c(1)._hecLinkMarkerEl).backgroundColor, chainLeft: lm && lm.left, zone: c(1)._hecLockAndHandleWidth(), box: (b => b && b.x + b.width)(c(1)._hecLockAndHandleRect()),
                     firstLabel: Math.round(c(0).legend.legendHitBoxes[0].left), firstTop: Math.round(c(0).legend.legendHitBoxes[0].top),
                     timelineTop: Math.round(c(1).chartArea.top), legendH: Math.round(c(0).legend.height), legendLeft: c(0).legend.leftMargin, boxRight: (b => b.x + b.width)(c(0)._hecLockAndHandleRect()),
                     unit: c(0).options.scales.yAxes[0].scaleLabel.display, yColumn: Math.round(c(0).chartArea.left) }; })()`);
    };
    await t.step('the chain icon takes no room: hidden or shown, nothing moves; it stays right of the handle and the padlock\'s box, far enough for their sensitive zones never to meet', async () => {
        const tops = () => t.E(`[0,1,2].map(i=>Math.round(graphAt(i).canvas.getBoundingClientRect().top)+'/'+Math.round(graphAt(i).chart.chartArea.top)).join()`);
        const shown = await tops(), r = await controlsAt(1000);
        await t.E('(()=>{ const c=graphAt(1).chart; c.options.linkMarkerVisible=false; c.update(); })()'); await t.wait(300);
        const hidden = await tops();
        await t.E('(()=>{ const c=graphAt(1).chart; c.options.linkMarkerVisible=true; c.update(); })()'); await t.wait(300);
        const gap = await t.E(`(C => Math.max(C.hecGestures('mouse').slop, C.hecGestures('touch').slop))(graphAt(0).chart.constructor)`);
        return shown === hidden && r.chainLeft >= r.box + gap ? true : JSON.stringify({ shown, hidden, gap, r });
    });
    await t.step('a narrow card: the handle, the padlock and the chain icon in boxes as opaque as the Y labels\', over the legend or the rows, which keep no room for them; wider: half see-through boxes, beside the legend\'s first line, the room they need, the Y axis\' unit and labels kept, a timeline\'s first row at its top, the handle over it; wide again: as before', async () => {
        const wide = await controlsAt(1000), narrow = await controlsAt(168), back = await controlsAt(1000);
        return wide.boxes === 'true,true,true' && wide.chainColor === wide.boxColor && wide.boxColor !== narrow.boxColor && wide.legendLeft === wide.boxRight + 4 && wide.timelineTop < 10 && wide.unit && wide.yColumn > 40
            && narrow.boxes === 'true,true,true' && /^rgba\(.*, 0\.8\)$/.test(narrow.boxColor) && narrow.chainColor === narrow.boxColor
            && narrow.legendLeft === 4 && narrow.firstLabel < wide.firstLabel && narrow.firstTop < 12 && narrow.timelineTop < 10 && !narrow.unit
            && JSON.stringify(back) === JSON.stringify(wide) ? true : JSON.stringify({ wide, narrow, back });
    });
    await t.step('a narrow card: on the box (over a label), a gesture is the controls\' (a click on the padlock locks, a long-press opens the graph\'s menu), on the label beside it, the label\'s', async () => {
        await controlsAt(168);
        const locked = () => t.E('!!graphAt(0).chart._hecYAxisLock');
        const graphMenu = () => t.E(`(()=>{ const m=el.querySelector('#et_0'), i=el.querySelector('#et_0_info'); return !m||m.style.display==='none' ? 'closed' : i ? 'entity' : 'graph'; })()`);
        const close = async () => { await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 5); await t.wait(400); };
        const p = await t.E('lockPt(0)'), l0 = await locked();
        await t.page.mouse.click(p.x, p.y); await t.wait(400); const l1 = await locked();
        await t.page.mouse.click(p.x, p.y); await t.wait(400);
        await t.longPress(p); const onBox = await graphMenu(); await close();
        const lb = await t.E(`(()=>{ const c=graphAt(0).chart, b=c.legend.legendHitBoxes[0], r=c.canvas.getBoundingClientRect(); return { x: r.left+b.left+b.width-6, y: r.top+b.top+b.height/2 }; })()`);
        await t.longPress(lb); const onLabel = await graphMenu(); await close();
        return !l0 && l1 && onBox === 'graph' && onLabel === 'entity' ? true : JSON.stringify({ l0, l1, onBox, onLabel });
    });
    await t.step('the handle and the padlock are a floating icon: where they are drawn, over the plot area too (no legend), a click on the padlock locks; in an oblong box, the padlock alone in a round one as the chain icon\'s; not drawn, the corner is what is under it', async () => {
        await controlsAt(1000);
        const set = o => t.E(`(()=>{ const c=graphAt(0).chart; Object.assign(c.options, ${JSON.stringify(o)}); c.update(); })()`);
        await t.E('(()=>{ const c=graphAt(0).chart; c.options.legend.display=false; c.update(); })()'); await t.wait(300);
        const top = await t.E('Math.round(graphAt(0).chart.chartArea.top)');
        const p = await t.E('lockPt(0)'), l0 = await t.E('!!graphAt(0).chart._hecYAxisLock');
        await t.page.mouse.click(p.x, p.y); await t.wait(400); const l1 = await t.E('!!graphAt(0).chart._hecYAxisLock');
        await t.page.mouse.click(p.x, p.y); await t.wait(400);
        await t.E('(()=>{ const c=graphAt(0).chart; c.options.legend.display=true; c.update(); })()'); await t.wait(300);
        const box = () => t.E(`(()=>{ const s=getComputedStyle(graphAt(0).chart._hecControlsBackdropEl); return s.width+' '+s.height+' '+s.borderRadius; })()`);
        const chain = await t.E(`(()=>{ const s=getComputedStyle(graphAt(1).chart._hecLinkMarkerEl); return s.width+' '+s.height; })()`);
        const both = await box();
        await set({ moveHandleVisible: false }); await t.wait(300); const lockOnly = await box();
        await t.E('(()=>{ const c=graphAt(0).chart; c.options.yAxisLockEnabled=false; c.update(); })()'); await t.wait(300);
        const none = await t.E('graphAt(0).chart._hecTopTargetAt(20, 14)');
        await set({ moveHandleVisible: true, yAxisLockEnabled: true }); await t.wait(300);
        return top < 28 && !l0 && l1 && none !== 'lockAndHandle' && lockOnly === '16px 17px 8.5px' && chain === '16px 17px' && both === '27px 17px 8.5px'
            ? true : JSON.stringify({ top, l0, l1, none, both, lockOnly, chain });
    });
    await t.step('the padlock open and green while the Y axis follows the curves, closed and red once locked (the theme\'s colors); the handle in the text\'s color, not faded', async () => {
        const look = () => t.E(`(()=>{ const c=graphAt(0).chart, p=c._hecLockIconEl.querySelector('path'), h=c._hecMoveHandleIconEl;
            return { locked: !!c._hecYAxisLock, d: p.getAttribute('d').slice(0, 12), fill: p.getAttribute('fill'), opacity: getComputedStyle(c._hecLockIconEl).opacity,
                     handle: getComputedStyle(h).opacity + ' ' + h.querySelector('svg').getAttribute('fill') }; })()`);
        const p = await t.E('lockPt(0)'), first = await look();
        await t.page.mouse.click(p.x, p.y); await t.wait(400); const second = await look();
        await t.page.mouse.click(p.x, p.y); await t.wait(400);
        const [open, closed] = first.locked ? [second, first] : [first, second];
        const ok = !open.locked && closed.locked && /success-color/.test(open.fill) && /error-color/.test(closed.fill) && open.d !== closed.d && open.opacity === '1' && closed.opacity === '1'
            && open.handle === '1 var(--primary-text-color)';
        return ok ? true : JSON.stringify({ open, closed });
    });
    await t.step('a legend label\'s dot filled as its curve: with showMinMax, its band\'s color (30 %); with fill: fade, the fill color it kept; with fill, its fill; else empty', async () => {
        const r = await t.E(`(()=>{ const C=graphAt(0).chart.constructor, f=(d,fill)=>C.hecLegendFill(d, 'rgb(10,20,30)', fill);
            return [f({ showMinMax: true }, 'rgba(0,0,0,0)'), f({ hecFillFade: true, hecFillColor: 'rgba(10, 20, 30, 0.15)' }, {}), f({}, 'rgba(1,2,3,0.15)'), f({}, 'rgba(0,0,0,0)')].join(' | '); })()`);
        return r === 'rgba(10, 20, 30, 0.3) | rgba(10, 20, 30, 0.15) | rgba(1,2,3,0.15) | rgba(0,0,0,0)' ? true : r;
    });
    await t.step('a graph added from the card: its close button a floating icon at the top right, mirroring the handle\'s box — beside the legend\'s first line on a wide card, over it on a narrow one; none on a YAML graph; a click on it removes the graph', async () => {
        await controlsAt(1000);
        await t.E(`el.instance.addCurves(['sensor.wind_rad'], 'default')`); await t.wait(1500);
        const look = () => t.E(`(()=>{ const g=el.instance.graphsInDisplayOrder(), c=g[g.length-1].chart, e=c._hecCloseButtonEl, s=e&&getComputedStyle(e), r=c._hecCloseButtonRect(), cr=c.canvas.getBoundingClientRect(), er=e.getBoundingClientRect();
            return { yaml: g.slice(0,-1).map(x=>!!x.chart._hecCloseButtonRect()||!!(x.chart._hecCloseButtonEl&&x.chart._hecCloseButtonEl.style.display!=='none')).join(), text: e.querySelector('svg path') ? '×' : e.textContent, symbol: (r => r.width+'x'+r.height)(e.querySelector('svg').getBoundingClientRect()), box: s.width+' '+s.height+' '+s.borderRadius,
                     right: Math.round(cr.right-er.right), edge: (C => Math.max(C.hecGestures('mouse').slop, C.hecGestures('touch').slop) / 2)(c.constructor), top: Math.round(er.top-cr.top), margin: c.legend.rightMargin, zone: c._hecTopTargetAt(r.x+12, r.y+12), old: !!el.querySelector('[id^="bc-"]') }; })()`);
        const wide = await look();
        await controlsAt(168); const narrow = await look(); await controlsAt(1000);
        const p = await t.E(`(()=>{ const g=el.instance.graphsInDisplayOrder(), c=g[g.length-1].chart, r=c._hecCloseButtonRect(), b=c.canvas.getBoundingClientRect(); return { x: b.left+r.x+12, y: b.top+r.y+12 }; })()`);
        const n0 = await t.E('el.instance.graphs.length');
        await t.page.mouse.click(p.x, p.y); await t.wait(1200);
        const n1 = await t.E('el.instance.graphs.length'), stored = await t.E(`el.instance.store.has('sensor.wind_rad')`);
        return wide.yaml === 'false,false,false' && wide.text === '×' && wide.box === '16px 17px 8.5px' && wide.symbol === '8x8' && wide.right === wide.edge && wide.top === 3 && wide.margin === 16 + wide.edge + 4 && wide.zone === 'closeButton' && !wide.old
            && narrow.margin === 4 && narrow.zone === 'closeButton' && n1 === n0 - 1 && !stored ? true : JSON.stringify({ wide, narrow, n0, n1, stored });
    });
    await t.step('the legend\'s first line never left empty: its first label, value included, too wide beside the controls — a shorter form there', async () => {
        await t.E(`el.instance.addCurves(['sensor.power2'], 'default')`); await t.wait(1500);
        const lines = [];
        for( let w = 260; w <= 520; w += 20 ) {
            await t.E(`(()=>{ document.body.style.width='${w}px'; document.getElementById('host').style.width='${w}px'; })()`); await t.wait(500);
            lines.push(await t.E(`el.instance.graphsInDisplayOrder().map(g=>{ const l=g.chart.legend, b=l.legendHitBoxes[0]; return b ? Math.round(b.top - l.top) : 0; }).join()`));
        }
        await controlsAt(1000);
        return lines.every(l => l.split(',').every(v => +v < 14)) ? true : JSON.stringify(lines);
    });
    done(await t.close());

    // ── The floating icons: under what covers the graph when scrolled there; over the legend's
    // labels when its first label doesn't fit beside them ──
    t = await openCard(card({ uiLayout: { sticky: 'top' }, statistics: { enabled: false }, graphs: [
            { type: 'line', entities: [{ entity: 'sensor.power', name: 'Mesure Thermostat Bureau Ma Lin (Filtered)' }] },
            { type: 'line', entities: [{ entity: 'sensor.power2', name: 'Consigne Thermostat Mezzanine' }] }] }),
        { mock: { series: true }, scrollRoom: 3000, height: 700, init: "document.addEventListener('DOMContentLoaded',()=>document.documentElement.style.setProperty('--header-height','0px'));" });
    await t.step('the floating icons scrolled under the sticky toolbar: hidden by it, as the graph is (never over the page\'s header)', async () => {
        await t.E(`el.instance.addCurves(['sensor.wind_rad'], 'default')`); await t.wait(1500);
        const last = 'el.instance.graphsInDisplayOrder().slice(-1)[0]';
        const top = await t.E(`${last}.canvas.getBoundingClientRect().top`);
        await t.E(`window.scrollBy(0, ${top} - 10)`); await t.wait(500);
        const r = await t.E(`(()=>{ const c=${last}.chart, tb=el.querySelector('div[style*="position:sticky"]'), b=c._hecCloseButtonEl.getBoundingClientRect();
            const hit=document.elementFromPoint(b.left+b.width/2, b.top+b.height/2), t2=tb.getBoundingClientRect();
            return { under: b.top < t2.bottom, hidden: !!hit && tb.contains(hit) }; })()`);
        await t.E('window.scrollTo(0, 0)'); await t.wait(300);
        return r.under && r.hidden ? true : JSON.stringify(r);
    });
    await t.step('a first label too wide beside the handle and the close button: no room kept for them, the icons over the labels in opaque boxes — the label on the first line; wide enough: room kept beside it, half see-through boxes', async () => {
        const at = async w => { await t.E(`(()=>{ document.body.style.width='${w}px'; document.getElementById('host').style.width='${w}px'; })()`); await t.wait(1200);
            return t.E(`(()=>{ const c=graphAt(0).chart, L=c.legend, b=L.legendHitBoxes[0];
                return { line: Math.round(b.top - L.top), margins: L.leftMargin+'/'+L.rightMargin, boxRight: (r => r.x + r.width)(c._hecLockAndHandleRect()), box: getComputedStyle(c._hecControlsBackdropEl).backgroundColor }; })()`); };
        const narrowish = await at(330), wide = await at(1000);
        return narrowish.line < 14 && narrowish.margins === '4/4' && /rgba\(.*, 0\.8\)$/.test(narrowish.box) && wide.line < 14 && wide.margins === (wide.boxRight + 4) + '/4' && wide.box !== narrowish.box
            ? true : JSON.stringify({ narrowish, wide });
    });
    done(await t.close());

    // ── The date: a click opens the calendar, a double-click goes back to real time; the
    // magnifier: a double-click brings the default range back ──
    t = await openCard(card({ defaultTimeRange: '24', statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true } });
    const win = () => t.E(`[el.instance.startTime, el.instance.endTime, el.instance.activeRange.timeRangeHours]`);
    const at = sel => t.E(`(()=>{ const r=el.querySelector('${sel}').getBoundingClientRect(); return { x: r.left+r.width/2, y: r.top+r.height/2 }; })()`);
    await t.step('a click on the date: the browser\'s calendar, once a double-click can\'t follow, the window\'s first day preselected; the day chosen starts the window, the range kept', async () => {
        await t.E(`(()=>{ window.__picker=0; HTMLInputElement.prototype.showPicker = function(){ __picker++; }; })()`);
        const d = await at('#bx_0'); await t.page.mouse.click(d.x, d.y);
        const soon = await t.E('__picker'); await t.wait(900); const later = await t.E('__picker');
        const shown = await t.E(`[el.querySelector('#bx_0').parentNode._pickers.date.value, el.instance.startTime.slice(0, 10)]`);
        // (three days ago: a local date)
        const day = await t.E(`(()=>{ const d=new Date(); d.setDate(d.getDate()-3); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })()`);
        await t.E(`(()=>{ const i=el.querySelector('#bx_0').parentNode._pickers.date; i.value='${day}'; i.dispatchEvent(new Event('change')); })()`); await t.wait(1200);
        const [t0, t1, h] = await win(), live = await t.E('el.instance.isLive()');
        return soon === 0 && later === 1 && shown[0] === shown[1] && t0 === day + 'T00:00:00' && h === 24 && !live ? true : JSON.stringify({ soon, later, shown, t0, t1, day, h, live });
    });
    await t.step('the calendar: a day whose window reaches the present — real time, the range kept', async () => {
        const day = await t.E(`(()=>{ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })()`);
        await t.E(`(()=>{ const i=el.querySelector('#bx_0').parentNode._pickers.date; i.value='${day}'; i.dispatchEvent(new Event('change')); })()`); await t.wait(1200);
        const [, t1, h] = await win(), live = await t.E('el.instance.isLive()');
        const late = await t.E(`Math.abs(Date.now() - new Date(${JSON.stringify(t1)}).getTime())`);
        return live && late < 3 * 3600e3 && h === 24 ? true : JSON.stringify({ t1, late, h, live });
    });
    await t.step('a double-click on the date: back to real time, the range kept, no calendar', async () => {
        await t.E('el.instance.showDay("2026-01-10")'); await t.wait(1200);
        await t.E('__picker=0');
        const d = await at('#bx_0'); await t.page.mouse.dblclick(d.x, d.y); await t.wait(900);
        const [, t1, h] = await win(), p = await t.E('__picker');
        const late = await t.E(`Math.abs(Date.now() - new Date(${JSON.stringify(t1)}).getTime())`);
        return late < 3 * 3600e3 && h === 24 && p === 0 ? true : JSON.stringify({ t1, late, h, p });
    });
    await t.step('a double-click on the magnifier: the default range back, the zoom mode as it was; in real time, kept there — as every range change: the buttons, the duration menu', async () => {
        const live = async () => { const [, t1] = await win(); return await t.E('el.instance.isLive()') && await t.E(`Math.abs(Date.now() - new Date(${JSON.stringify(t1)}).getTime()) < 120e3`); };
        await t.E('el.instance.todayNoReset()'); await t.wait(1200);
        await t.E('(()=>{ el.instance.applyTimeRange(6, true); })()'); await t.wait(1200);
        const l6 = await live();
        const z = await at('#bz_0'); await t.page.mouse.dblclick(z.x, z.y); await t.wait(1200);
        const [, , h] = await win(), mode = await t.E('!!el.instance.state.zoomMode'), l24 = await live();
        await t.E('el.instance.incZoom()'); await t.wait(1200); const lInc = await live();
        await t.E('el.instance.decZoom()'); await t.wait(1200); const lDec = await live();
        // (looking at the history: the window keeps its middle)
        await t.E('el.instance.showDay("2026-01-10")'); await t.wait(1200);
        await t.E('el.instance.decZoom()'); await t.wait(1200);
        const [h0, h1] = await win();
        return h === 24 && mode === false && l6 && l24 && lInc && lDec && h0 === '2026-01-09T12:00:00' && h1 === '2026-01-11T12:00:00' ? true : JSON.stringify({ h, mode, l6, l24, lInc, lDec, h0, h1 });
    });
    await t.step('the three magnifiers, 20 px: each twice as large under the mouse, drawn over its neighbours — every box of the toolbar keeping its place and its size; back to its size once left', async () => {
        const size = id => t.E(`(()=>{ const r=el.querySelector('#${id} svg').getBoundingClientRect(); return Math.round(r.width); })()`);
        const box = () => t.E(`JSON.stringify(['dl_0','dr_0','bz_0','b4_0','by_0','b5_0'].map(id=>{ const r=el.querySelector('#'+id).getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; }))`);
        const r = {};
        await t.page.mouse.move(5, 5); await t.wait(400);
        const b0 = await box();
        for( const id of ['bz_0', 'b4_0', 'b5_0'] ) {
            const rest = await size(id);
            const c = await at('#' + id); await t.page.mouse.move(c.x, c.y); await t.wait(400);
            const hover = await size(id), b1 = await box();
            await t.page.mouse.move(5, 5); await t.wait(400);
            r[id] = [rest, hover, await size(id), b1 === b0];
        }
        return Object.values(r).every(([a, b, c, same]) => a === 20 && b === 40 && c === 20 && same) ? true : JSON.stringify(r);
    });
    await t.step('a pen above the screen, a finger while it presses: the magnifier twice as large too, back to its size once left', async () => {
        const size = () => t.E(`Math.round(el.querySelector('#b5_0 svg').getBoundingClientRect().width)`);
        const send = (type, pointerType) => t.E(`el.querySelector('#b5_0').dispatchEvent(new PointerEvent('${type}', { pointerId: 7, pointerType: '${pointerType}', isPrimary: true, buttons: 0 }))`);
        await t.page.mouse.move(5, 5); await t.wait(300);
        await send('pointerenter', 'pen'); await t.wait(400); const pen = await size();
        await send('pointerleave', 'pen'); await t.wait(400); const left = await size();
        await send('pointerenter', 'touch'); await t.wait(400); const finger = await size();
        await send('pointerleave', 'touch'); await t.wait(400); const up = await size();
        return pen === 40 && left === 20 && finger === 40 && up === 20 ? true : JSON.stringify({ pen, left, finger, up });
    });
    await t.step('a pen gone out of hover range over a magnifier (no more moves, no pointerleave): back to its size 0.5 s after its last move', async () => {
        const size = () => t.E(`Math.round(el.querySelector('#b5_0 svg').getBoundingClientRect().width)`);
        const send = (type) => t.E(`el.querySelector('#b5_0').dispatchEvent(new PointerEvent('${type}', { pointerId: 7, pointerType: 'pen', isPrimary: true, buttons: 0 }))`);
        await send('pointerenter'); await send('pointermove'); await t.wait(250); const still = await size();
        await t.wait(500); const gone = await size();
        return still === 40 && gone === 20 ? true : JSON.stringify({ still, gone });
    });
    done(await t.close());

    // ── One point per column of pixels: the mean of its values (weighted by how long each
    // lasted), their min and max kept — whatever decimation says ──
    const columns = async (dec, showMinMax) => {
        const t = await openCard(card({ defaultTimeRange: '7d', decimation: dec, statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power', showMinMax }] }] }),
            { mock: { series: true, historyStep: 60 } });
        await t.wait(4000);
        const r = await t.E(`(()=>{ const g=graphAt(0), c=g.chart, ds=c.data.datasets[0], d=ds.data, A=c.chartArea, v=g.valueSamples[0].map(p=>p.v);
            const agg=d.filter(p=>p.columnFrom!=null);
            const count=()=>{ let n=0; const f=c.ctx.fill; c.ctx.fill=function(){ n++; return f.apply(this,arguments); }; c.draw(); c.ctx.fill=f; return n; };
            const on=count(); const _m=ds.showMinMax; ds.showMinMax=false; const off=count(); ds.showMinMax=_m;
            const t0=+new Date(el.instance.startTime), t1=+new Date(el.instance.endTime);
            return { n: d.filter(p=>p.x>=t0&&p.x<=t1).length, values: v.length, cols: Math.round(A.right-A.left), numbers: d.every(p=>typeof p.x==='number'),
                     agg: agg.length, inside: agg.every(p=>p.columnMin<=p.y+1e-9 && p.y<=p.columnMax+1e-9 && p.columnFrom<=p.x && p.x<=p.columnTo),
                     extremes: Math.min(...agg.map(p=>p.columnMin))===Math.min(...v) && Math.max(...agg.map(p=>p.columnMax))===Math.max(...v),
                     band: d.filter(p=>p.yMin!=null).length, on, off, ordered: d.every((p,i)=>!i||p.x>=d[i-1].x) }; })()`);
        await t.close();
        return r;
    };
    // (the steps below on a page of their own: each test opens its card)
    t = await openCard(card({ statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }));
    await t.step('a column\'s tooltip value: min / mean / max when they differ as shown (rounded); all three the same as shown: the mean alone', async () => {
        const r = await t.E(`(()=>{ const I=el.instance, ds={ unit: 'kW', rounding: 2, data: [{ y: 1.331, columnMin: 1.32, columnMax: 1.333 }, { y: 1.331, columnMin: 1.329, columnMax: 1.334 }, { y: 1.331 }] };
            return [0, 1, 2].map(i => I._tooltipValue('line', ds, { index: i, yLabel: ds.data[i].y })); })()`);
        return r[0] === '1.32 / 1.33 / 1.33 kW' && r[1] === '1.33 kW' && r[2] === '1.33 kW' ? true : JSON.stringify(r);
    });
    for( const dec of ['fast', false] )
        await t.step(`decimation ${dec} (ignored): one point per column of pixels — the mean of its values, between their min and max; the lowest and highest of the window kept; no band without showMinMax`, async () => {
            const r = await columns(dec);
            return r.values > 4 * r.cols && r.n <= r.cols + 2 && r.agg > r.cols / 2 && r.inside && r.extremes && r.ordered && r.numbers && r.band === 0 ? true : JSON.stringify(r);
        });
    await t.step('showMinMax: true — the band drawn between each column\'s min and max', async () => {
        const r = await columns(undefined, true);
        return r.band === r.agg && r.agg > 0 && r.on > r.off ? true : JSON.stringify(r);
    });
    await t.step('showMinMax: history — the band on the history\'s columns; statistics — none (the statistics off)', async () => {
        const h = await columns(undefined, 'history'), st = await columns(undefined, 'statistics');
        return h.band === h.agg && h.agg > 0 && st.band === 0 ? true : JSON.stringify({ h, st });
    });

    // ── The band's color: the line's, at opacity 0.3 — a gradient where the line's color varies ──
    // (each fill of the band: its fill style and opacity, from a draw with the band less one without
    // — the legend's dot, filled in the band's color at full opacity, left out)
    const bandFills = tb => tb.E(`(()=>{ const c=graphAt(0).chart, ds=c.data.datasets[0], ctx=c.ctx; const rec=()=>{ const out=[]; const f=ctx.fill;
            ctx.fill=function(){ out.push({ style: typeof ctx.fillStyle==='string' ? ctx.fillStyle : 'gradient', alpha: ctx.globalAlpha }); return f.apply(this,arguments); }; c.draw(); ctx.fill=f; return out; };
        const on=rec(); ds.showMinMax=false; const off=rec(); ds.showMinMax=true;
        return on.filter(x=>x.alpha!==1 && !off.some(y=>y.style===x.style && y.alpha===x.alpha)); })()`);
    let tb = await openCard(card({ statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power', color: '#ff0000', showMinMax: true }] }] }),
        { mock: { series: true, historyStep: 60 } });
    await tb.wait(2500);
    await tb.step('showMinMax: the band in the curve\'s color at opacity 0.3', async () => {
        const f = await bandFills(tb);
        return f.length && f.every(x => /^#ff0000$|rgba?\(255, ?0, ?0(, ?1)?\)/.test(x.style) && Math.abs(x.alpha - 0.3) < 1e-9) ? true : JSON.stringify(f);
    });
    await tb.step('showMinMax, the curve hidden (its legend label clicked): its band hidden with it; shown again: back', async () => {
        await tb.E('el.instance.toggleDatasetHidden(graphAt(0), 0)'); await tb.wait(200);
        const hidden = await bandFills(tb);
        await tb.E('el.instance.toggleDatasetHidden(graphAt(0), 0)'); await tb.wait(200);
        const shown = await bandFills(tb);
        return hidden.length === 0 && shown.length ? true : JSON.stringify({ hidden, shown });
    });
    done(await tb.close());
    tb = await openCard(card({ statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power', showMinMax: true, colorTransition: 'smooth',
        color: { '0': '#0000ff', '1000': '#ff0000' } }] }] }), { mock: { series: true, historyStep: 60 } });
    await tb.wait(2500);
    await tb.step('showMinMax with a color that varies (thresholds blended): the band in the line\'s gradient, not in black', async () => {
        const f = await bandFills(tb);
        return f.length && f.every(x => x.style === 'gradient' && Math.abs(x.alpha - 0.3) < 1e-9) ? true : JSON.stringify(f);
    });
    done(await tb.close());

    // ── A timeline over a week: only states too thin to see merged (narrower than 2 px) ──
    const H = 3600, D = 86400;
    const rows = [[7 * D + H, 'off'],
        [5 * D, 'on'], [5 * D - 40 * 60, 'off'],                                          // 40 min: some 4 px
        ...Array.from({ length: 6 }, (_, k) => [3 * D - k * 30, k % 2 ? 'off' : 'on']),   // 30 s each, in a row
        [2 * D, 'off'], [D, 'on'], [D - 30, 'off']];                                         // 30 s alone
    const timeline = async dec => {
        const t = await openCard(card({ defaultTimeRange: '7d', ...( dec === undefined ? {} : { decimation: dec } ), statistics: { enabled: false },
            graphs: [{ type: 'timeline', entities: [{ entity: 'binary_sensor.a' }] }] }), { mock: { series: true, rows: { 'binary_sensor.a': rows } } });
        await t.wait(1500);
        const r = await t.E(`graphAt(0).chart.data.datasets[0].data.map(b=>b[2]).join()`);
        await t.close();
        return r;
    };
    await t.step('a timeline over a week: a state some 4 px wide drawn; states of 30 s in a row merged (multiple); a short one alone keeps its state; decimation: false, the same (ignored)', async () => {
        const auto = await timeline(), off = await timeline(false);
        return auto === 'off,on,off,multiple,off,on,off' && off === auto ? true : JSON.stringify({ auto, off });
    });
    done(await t.close());

    // ── The history's groups computed as Home Assistant compiles its statistics (the value in
    // force at a group's start counts in it): an hour of the history, the hour's statistics ──
    t = await openCard(card({ defaultTimeRange: '24h', statistics: { enabled: false }, pointsPerHour: 1, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }),
        { mock: { series: true, historyStep: 1700 } });
    await t.wait(2500);
    await t.step('an hour of the history (pointsPerHour 1, values every 28 min 20 s): the same mean, min and max as Home Assistant\'s statistics of that hour', async () => {
        const r = await t.E(`(async()=>{ const I=el.instance, d=I.graphs[0].chart.data.datasets[0].data.filter(p=>p.columnFrom!=null);
            const t0=d[0].columnFrom, t1=Date.now()-3*3600e3;
            const st=(await I._hass.callWS({ type:'recorder/statistics_during_period', start_time:new Date(t0).toISOString(), end_time:new Date(t1).toISOString(), period:'hour', statistic_ids:['sensor.power'] }))['sensor.power'];
            const byStart=Object.fromEntries(st.map(x=>[x.start, x]));
            const cmp=d.filter(p=>byStart[p.columnFrom]).map(p=>{ const x=byStart[p.columnFrom]; return [p.y-x.mean, p.columnMin-x.min, p.columnMax-x.max]; });
            return { n: cmp.length, worst: Math.max(0, ...cmp.flat().map(Math.abs)) }; })()`);
        return r.n >= 15 && r.worst < 1e-6 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The real time paced by what drawing the graphs costs ──
    t = await openCard(card({ defaultTimeRange: '24', statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true } });
    await t.E(`setState('sensor.power', '1')`); await t.wait(3000);   // (the card's first look at the states)
    await t.step('a change: its value in the legend at once, the curves not worked out again until the refresh', async () => {
        await t.E(`(()=>{ window.__k=[]; el.instance.setPerfRecorder({ add: k => __k.push(k) }); })()`);
        await t.E(`setState('sensor.power', '777')`); await t.wait(500);
        const r = { legend: await t.E('legendText(graphAt(0).chart.legend.legendItems[0])'), soon: await t.E(`__k.filter(k=>k==='redraw').length`) };
        await t.wait(2500);
        r.later = await t.E(`__k.filter(k=>k==='redraw').length`);
        await t.E('el.instance.setPerfRecorder(null)');
        return /777/.test(r.legend) && r.soon === 0 && r.later >= 1 ? true : JSON.stringify(r);
    });
    await t.step('a refresh no sooner than 2 s after a change — and than five times what drawing the graphs again last took', async () => {
        const asked = () => t.E(`__ws.filter(w=>w.type==='history/history_during_period').length`);
        const after = async () => { const n0 = await asked(); await t.E(`setState('sensor.power', String(Math.random()*100))`);
            const r = []; for( let k = 0; k < 4; k++ ) { await t.wait(1500); r.push(await asked() - n0); } return r.join(); };
        await t.wait(3000);
        const quick = await after();
        await t.wait(3000);
        await t.E('el.instance._lastBuildMs = 1000');
        const slow = await after();
        return quick === '0,1,1,1' && slow === '0,0,0,1' ? true : JSON.stringify({ quick, slow });
    });
    done(await t.close());

    // ── A long window loaded a few days at a time, the most recent first: each part drawn as
    // it comes (Home Assistant taking its time, as a real one does) ──
    const growing = async (range, samples, every) => {
        const t = await openCard(card({ defaultTimeRange: range, statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true, historyDelay: 400 } });
        await t.E('__ws.length = 0'); await t.page.reload();
        const firsts = [];
        for( let k = 0; k < samples; k++ ) { await t.wait(every); firsts.push(await t.E(`(()=>{ const d=el.instance.graphs[0]?.chart.data.datasets[0]?.data||[]; return d.length ? +new Date(d[0].x) : null; })()`)); }
        const seen = [...new Set(firsts.filter(x => x !== null))];
        const ws = await t.E(`__ws.filter(w=>w.type==='history/history_during_period').map(w=>[w.start, w.end])`);
        const starts = ws.map(w => Date.parse(w[0])), newestFirst = starts.every((v, i) => !i || v < starts[i - 1]);
        const once = new Set(ws.map(w => w[0])).size === ws.length && ws.every((w, i) => !i || w[1] === ws[i - 1][0]);
        const covered = await t.E(`(()=>{ const d=el.instance.graphs[0].chart.data.datasets[0].data; return +new Date(d[0].x) <= +new Date(el.instance.startTime) + 86400e3; })()`);
        await t.close();
        return seen.length >= 4 && seen.every((v, i) => !i || v < seen[i - 1]) && ws.length <= 8 && newestFirst && once && covered
            ? true : JSON.stringify({ seen: seen.length, ws, newestFirst, once, covered });
    };
    t = await openCard(card(), { mock: { series: true } });
    await t.step('a window of 7 days: the curve grows back in time as each day arrives; each day asked once, the most recent first; the whole window at the end', () => growing('7d', 16, 250));
    await t.step('a window of 6 months: at most 8 requests, the most recent first, the curve growing back in time; the whole window at the end', () => growing('6o', 30, 300));
    await t.step('two parts of a long window asked at once; the next one asked as soon as one is answered — before it is drawn; the parts that came meanwhile drawn once', async () => {
        const p = await openCard(card({ defaultTimeRange: '7d', statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }),
            { mock: { series: true, historyDelay: 300 }, init: `document.addEventListener('DOMContentLoaded', ()=>setTimeout(()=>{ const I=el.instance; window.__trace=[];
                const asked=()=>__ws.filter(w=>w.type==='history/history_during_period').length;
                const a=I._answered, d=I.generateGraphDataFromCache;
                I._answered=function(){ const r=a.apply(this, arguments); __trace.push('answer:'+asked()); return r; };
                I.generateGraphDataFromCache=function(){ __trace.push('draw'); return d.apply(this, arguments); }; }, 0));` });
        await p.E('__ws.length = 0; __trace.length = 0; el.instance.reloadHistory()'); await p.wait(4500);
        const trace = await p.E('__trace.join(" ")'), asked = await p.E(`__ws.filter(w=>w.type==='history/history_during_period').length`);
        await p.close();
        // (each answer but the last two: the part after the next already asked — answer:k+3 —
        // when it's put in the cache, before its drawing)
        const answers = trace.split(' ').filter(x => x.startsWith('answer:')).map(x => +x.slice(7));
        const ahead = answers.slice(0, -2).every((n, k) => n === k + 3);
        return asked > 2 && answers.length === asked && ahead && trace.endsWith('draw') ? true : JSON.stringify({ trace, asked });
    });
    done(await t.close());

    // ── The parts of a window, whatever the history holds: a counter rising with time (each
    // older part lower), loaded as Home Assistant takes its time — sampled as it grows ──
    const watch = async (range, cfg, mock, samples, every, lockAfterFirst = false) => {
        const t = await openCard(card({ defaultTimeRange: range, graphs: [{ type: 'line', entities: [{ entity: 'sensor.energy', type: 'line' }] }], ...cfg }), { mock: { series: true, historyDelay: 400, ...mock } });
        await t.E('__ws.length = 0'); await t.page.reload();
        const trace = [];
        for( let k = 0; k < samples; k++ ) {
            await t.wait(every);
            if( lockAfterFirst && trace.length === 1 && !trace.locked ) { await t.E('el.instance.graphs[0].chart._hecToggleYAxisLock()'); trace.locked = true; await t.wait(50); }
            trace.push(await t.E(`(()=>{ const c=el.instance.graphs[0]?.chart, d=c?.data.datasets[0]?.data||[]; if( !d.length ) return null;
                const y=c.scales[c.options.scales.yAxes[0].id], v=d.map(p=>+p.y).filter(Number.isFinite);
                return { first: +new Date(d[0].x), n: d.length, min: y.min, max: y.max, vmin: Math.min(...v), vmax: Math.max(...v) }; })()`));
        }
        const pts = await t.E(`el.instance.graphs[0].chart.data.datasets[0].data.map(p=>[+new Date(p.x), +p.y])`);
        const ws = await t.E(`__ws.filter(w=>w.type==='history/history_during_period'||w.type==='recorder/statistics_during_period').map(w=>[w.period==='5minute'?'f':w.type[0], w.start, w.end])`);
        const start = await t.E('+new Date(el.instance.startTime)');
        // (the time of a column of pixels: a curve has at most one point in each)
        const column = await t.E(`(()=>{ const c=el.instance.graphs[0].chart, A=c.chartArea; return ( +new Date(el.instance.endTime) - +new Date(el.instance.startTime) ) / ( A.right - A.left ); })()`);
        await t.close();
        const seen = trace.filter(Boolean);
        // (the parts joined: in time order, no point twice, no gap much longer than the usual one
        // — or than two columns of pixels)
        const gaps = pts.slice(1).map((p, i) => p[0] - pts[i][0]).sort((a, b) => a - b);
        const joined = gaps.every(g => g > 0) && gaps[gaps.length - 1] <= Math.max(3 * gaps[gaps.length >> 1], 2 * column) + 1;
        // (each request's period asked once; history then statistics, each the most recent first)
        const once = new Set(ws.map(w => w[0] + w[1])).size === ws.length;
        // (the Y scale holding the values loaded each time — or kept as it was, locked)
        const fits = seen.every(x => x.min <= x.vmin && x.max >= x.vmax);
        return { seen, pts, ws, start, joined, once, fits };
    };
    t = await openCard(card(), { mock: { series: true } });
    await t.step('little history (2 days, no statistics) in a window of 7: the days held shown, nothing asked twice, it ends; the parts joined; the Y scale following', async () => {
        const r = await watch('7d', { statistics: { enabled: false } }, { historyDays: 2 }, 14, 300);
        const last = r.seen[r.seen.length - 1], firstShown = r.seen[0];
        const ends = r.ws.length <= 8, recent = last.first >= Date.now() - 3 * 86400e3;
        return r.joined && r.once && r.fits && ends && recent ? true : JSON.stringify({ joined: r.joined, once: r.once, fits: r.fits, ws: r.ws, last, firstShown });
    });
    await t.step('a window of 30 days, 10 of history (a column of pixels of some 50 minutes): the hourly statistics of the whole window, then its 5-minute ones, each in one request; the history only after them (the last 20 minutes); past the 10 days the 5-minute statistics are kept, the hourly ones; the whole window, joined; nothing asked twice', async () => {
        const r = await watch('30d', { statistics: { enabled: true } }, { historyDays: 10 }, 12, 300);
        const types = r.ws.map(w => w[0]).join(''), last = r.seen[r.seen.length - 1];
        const recent = r.ws.filter(w => w[0] === 'h').every(w => Date.parse(w[1]) >= Date.now() - 25 * 60e3);
        const order = /^rfh$/.test(types), covered = last.first <= r.start + 86400e3;
        // (past 10 days, an hour a point at most — the hourly statistics; within them, finer)
        const old = r.pts.filter(p => p[0] < Date.now() - 11 * 86400e3), recentPts = r.pts.filter(p => p[0] > Date.now() - 9 * 86400e3 && p[0] < Date.now() - 86400e3);
        const gap = a => a.length > 1 ? ( a[a.length - 1][0] - a[0][0] ) / ( a.length - 1 ) : 0;
        const finer = gap(recentPts) < gap(old);
        return r.joined && r.once && r.fits && order && recent && covered && finer ? true : JSON.stringify({ joined: r.joined, once: r.once, fits: r.fits, types, recent, covered, gaps: [gap(old), gap(recentPts)] });
    });
    await t.step('a window of 6 months: the statistics in one request, drawn at once; the 5-minute ones only for the day the hourly ones don\'t cover yet; the history only after them (the last 20 minutes)', async () => {
        const r = await watch('6o', { statistics: { enabled: true } }, {}, 8, 300);
        const st = r.ws.filter(w => w[0] === 'r'), h = r.ws.filter(w => w[0] === 'h'), last = r.seen[r.seen.length - 1];
        const recent = h.every(w => Date.parse(w[1]) >= Date.now() - 25 * 60e3), covered = last.first <= r.start + 86400e3;
        const fine = r.ws.filter(w => w[0] === 'f').every(w => Date.parse(w[1]) >= Date.now() - 26 * HOUR);
        return st.length === 1 && fine && h.length === 1 && recent && covered && r.joined ? true : JSON.stringify({ ws: r.ws, covered, joined: r.joined });
    });
    await t.step('a lot of history (6 months): the parts joined, the Y scale widening as each older, lower part comes', async () => {
        const r = await watch('6o', { statistics: { enabled: false } }, {}, 30, 300);
        const last = r.seen[r.seen.length - 1], widened = r.seen[0].min > last.min;
        return r.joined && r.once && r.fits && widened ? true : JSON.stringify({ joined: r.joined, once: r.once, fits: r.fits, widened, seen: r.seen.map(x => [x.n, x.min, x.vmin]) });
    });
    await t.step('the Y axis locked once the first part is shown: its scale kept as the older parts come', async () => {
        const r = await watch('7d', { statistics: { enabled: false } }, {}, 16, 250, true);
        const after = r.seen.slice(1), kept = after.every(x => x.min === after[0].min && x.max === after[0].max);
        return kept && r.joined ? true : JSON.stringify({ kept, seen: r.seen.map(x => [x.n, x.min, x.max]) });
    });
    done(await t.close());

    // ── The last one to speak wins, whatever is loading: an action taken at once — what it
    // shows (the range selector) and what's done (the window, its data) always together ──
    const slowCard = () => openCard(card({ defaultTimeRange: '24h', statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }),
        { mock: { series: true, historyDelay: 1500 } });
    const firstShown = p => p.E(`(()=>{ const d=el.instance.graphs[0].chart.data.datasets[0].data; return { first: d.length ? +new Date(d[0].x) : null, last: d.length ? +new Date(d[d.length-1].x) : null,
        start: +new Date(el.instance.startTime), end: +new Date(el.instance.endTime), loading: el.instance.state.loading }; })()`);
    t = await slowCard();
    await t.step('the range chosen while the history loads (Home Assistant slow): the selector, the range and the window the new one at once; its data asked, and drawn', async () => {
        await t.wait(500);
        await t.E('el.instance.reloadHistory()'); await t.wait(100);
        const loading = await t.E('el.instance.state.loading');
        await t.E(`(()=>{ const s=el.querySelector('#by_0'); s.value='168'; s.dispatchEvent(new Event('change')); })()`); await t.wait(200);
        const now = await t.E(`({ h: el.instance.activeRange.timeRangeHours, sel: el.querySelector('#by_0').value, span: Math.round((+new Date(el.instance.endTime) - +new Date(el.instance.startTime)) / 36e5) })`);
        await t.wait(8000);
        const r = await firstShown(t);
        return loading && now.h === 168 && now.sel === '168' && now.span === 168 && r.first !== null && r.first <= r.start + 86400e3 && !r.loading ? true : JSON.stringify({ loading, now, r });
    });
    await t.step('the window dragged back while the history loads: the days it now shows asked, and drawn', async () => {
        await t.E('el.instance.reloadHistory()'); await t.wait(100);
        await t.E(`el.instance.moveTimeWindow(new Date(+new Date(el.instance.startTime) - 5 * 864e5))`); await t.wait(8000);
        const r = await firstShown(t);
        return r.first !== null && r.first <= r.start + 3600e3 && r.last >= r.end - 3600e3 && !r.loading ? true : JSON.stringify(r);
    });
    await t.step('a curve added while the history loads: drawn, its history asked', async () => {
        await t.E('el.instance.reloadHistory()'); await t.wait(100);
        await t.E(`el.instance.addCurves(['sensor.rain'], 'default', null)`); await t.wait(8000);
        const r = await t.E(`(()=>{ const g=el.instance.graphs.find(g=>g.entities.some(e=>e.entity==='sensor.rain')); return { shown: !!g, n: g?.chart.data.datasets.find(d=>d.entity_id==='sensor.rain')?.data.length ?? g?.chart.data.datasets[0]?.data.length ?? 0,
            asked: __ws.some(w=>w.type==='history/history_during_period'&&w.ids.includes('sensor.rain')), loading: el.instance.state.loading }; })()`);
        return r.shown && r.n > 10 && r.asked && !r.loading ? true : JSON.stringify(r);
    });
    await t.step('a request failing (Home Assistant down for a moment): no longer under way, the loading ends; asked again at the next update', async () => {
        await t.E(`(()=>{ MOCK.fail=['history/history_during_period']; el.instance.reloadHistory(); })()`); await t.wait(2500);
        const failed = await t.E('({ loading: el.instance.state.loading, requests: el.instance._requests.length })');
        await t.E(`(()=>{ MOCK.fail=[]; el.instance.updateHistory(); })()`); await t.wait(10000);
        const r = await firstShown(t);
        return !failed.loading && failed.requests === 0 && r.first !== null && !r.loading ? true : JSON.stringify({ failed, r });
    });
    await t.step('a page left open past midnight: a day added to the cache, the new day\'s history asked at the refresh', async () => {
        // (the cache as made yesterday: its last day ending today at 0:00)
        await t.E('el.instance.today()'); await t.wait(4000);
        await t.E(`(()=>{ const I=el.instance; I.cache.pop(); I.cacheSize--; __ws.length=0; I.refresh(); })()`); await t.wait(3000);
        const r = await t.E(`(()=>{ const I=el.instance, last=I.cache[I.cache.length-1]; return { size: I.cacheSize === I.cache.length - 1, lastEnd: +new Date(last.end) > Date.now(),
            today: __ws.some(w=>w.type==='history/history_during_period' && Date.parse(w.end) > Date.now()) }; })()`);
        return r.size && r.lastEnd && r.today ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The history after the statistics: the last minutes only, asked again at each
    // refresh with today's statistics; the whole day's when Home Assistant is late ──
    t = await openCard(card({ defaultTimeRange: '1w', statistics: { enabled: true }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true } });
    await t.wait(3000);
    await t.step('a week (the 5-minute statistics): the curve up to now, its last minutes from the history; a refresh asks again the history after the statistics and today\'s statistics, never the day\'s history', async () => {
        const d0 = (await t.E('datasets(0)'))[0];
        await t.E('(()=>{ __ws.length=0; el.instance.refresh(); })()'); await t.wait(2500);
        const ws = await t.E('__ws'), d1 = (await t.E('datasets(0)'))[0];
        const h = ws.filter(w => w.type === 'history/history_during_period'), st = ws.filter(w => w.type === 'recorder/statistics_during_period');
        const today = Date.parse(await t.E('el.instance.cache[el.instance.cache.length-1].start'));
        const ok = d0.x1 >= Date.now() - 5 * 60e3 && d1.x1 >= Date.now() - 5 * 60e3 && h.length >= 1 && h.every(w => Date.parse(w.start) >= Date.now() - 25 * 60e3)
            && st.length >= 1 && st.every(w => Date.parse(w.start) >= today);
        return ok ? true : JSON.stringify({ d0, d1, ws });
    });
    done(await t.close());

    t = await openCard(card({ defaultTimeRange: '1w', statistics: { enabled: true }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true, statsLag: 3 * 3600 } });
    await t.wait(3000);
    await t.step('Home Assistant late with its statistics (3 hours): the 5-minute ones stopping early, the whole day\'s history asked — the curve still up to now', async () => {
        const h = await wsOf(t, 'history/history_during_period'), d = (await t.E('datasets(0)'))[0];
        const today = Date.parse(await t.E('el.instance.cache[el.instance.cache.length-1].start'));
        return h.some(w => Date.parse(w.start) === today) && d.x1 >= Date.now() - 5 * 60e3 ? true : JSON.stringify({ h, d });
    });
    done(await t.close());

    // ── The refresh: today's history kept, and drawn, until its new answer replaces it —
    // never the statistics in between (Home Assistant slow) ──
    t = await openCard(card({ defaultTimeRange: '24h', statistics: { enabled: true }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }),
        { mock: { series: true, historyDelay: 1500 } });
    await t.wait(5000);
    await t.step('a refresh with Home Assistant slow: the curve stays drawn from the history all along — never from the statistics —, as many points', async () => {
        const pts = () => t.E(`(()=>{ const d=el.instance.graphs[0].chart.data.datasets[0].data; return { n: d.length, stat: d.filter(p=>p.statistics).length }; })()`);
        const before = await pts();
        await t.E('el.instance.refresh()');
        const during = [];
        for( let k = 0; k < 6; k++ ) { await t.wait(250); during.push(await pts()); }
        await t.wait(2500);
        const after = await pts(), asked = await t.E(`__ws.filter(w=>w.type==='history/history_during_period').length`);
        const ok = before.stat === 0 && during.every(x => x.stat === 0 && x.n >= before.n * 0.9) && after.stat === 0 && asked >= 2;
        return ok ? true : JSON.stringify({ before, during, after, asked });
    });
    done(await t.close());

    // ── A column of pixels shorter than 5 minutes: the history only, never the statistics
    // first (Home Assistant slow) — they're there only for what the history no longer keeps ──
    t = await openCard(card({ defaultTimeRange: '24h', statistics: { enabled: true }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }),
        { mock: { series: true, historyDelay: 2000 } });
    await t.step('a day on 900 pixels (a column of 1.6 min), Home Assistant slow: no point of the statistics while the history comes, nor after', async () => {
        const seen = [];
        for( let k = 0; k < 12; k++ ) { await t.wait(400); seen.push(await t.E(`(()=>{ const d=el.instance.graphs[0]?.chart.data.datasets[0]?.data ?? []; return [d.length, d.filter(p=>p.statistics).length]; })()`)); }
        const r = { seen, stats: await t.E(`__ws.filter(w=>w.type==='recorder/statistics_during_period').length`) };
        return seen.every(x => x[1] === 0) && seen[seen.length - 1][0] > 50 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── Real time: the present always on the right, never past it; the history: the window
    // staying where it is; '>' greyed in real time ──
    t = await openCard(card({ defaultTimeRange: '24h', statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true } });
    await t.wait(1500);
    const liveWin = () => t.E(`(()=>{ const I=el.instance, b=el.querySelector('#b2_0'); return { live: !!I.state.autoScroll, toNow: Math.round((+new Date(I.endTime) - Date.now()) / 1000),
        span: Math.round((+new Date(I.endTime) - +new Date(I.startTime)) / 1000), next: b.disabled }; })()`);
    await t.step('real time: the window ends at the present, \'>\' greyed; dragged towards the future, it stays there', async () => {
        const r0 = await liveWin();
        await t.E(`el.instance.moveTimeWindow(new Date(+new Date(el.instance.startTime) + 3 * 3600e3))`);
        const r1 = await liveWin();
        await t.E('el.instance.stepDay(1)');
        const r2 = await liveWin();
        // (the window set when the card opened: the present then, a few seconds ago)
        const ok = r0.live && r0.next && r0.toNow <= 1 && [r1, r2].every(r => r.live && r.next && r.toNow <= 1 && r.toNow >= -2 && r.span === 86400);
        return ok ? true : JSON.stringify({ r0, r1, r2 });
    });
    await t.step('zoomed out or in, in real time: the present kept on the right', async () => {
        await t.E('el.instance.decZoom()'); const out = await liveWin();
        await t.E('el.instance.incZoom()'); const back = await liveWin();
        return out.live && back.live && Math.abs(out.toNow) <= 2 && Math.abs(back.toNow) <= 2 && out.span === 2 * 86400 && back.span === 86400 ? true : JSON.stringify({ out, back });
    });
    await t.step('dragged back: the history — \'>\' active, the window kept as new values come; dragged forward past the present: real time again, on the right', async () => {
        await t.E(`el.instance.moveTimeWindow(new Date(+new Date(el.instance.startTime) - 2 * 3600e3))`);
        const past = await liveWin(), end0 = await t.E('el.instance.endTime');
        await t.E(`setState('sensor.power', '321')`); await t.wait(3500);
        const kept = await t.E('el.instance.endTime') === end0;
        await t.E(`el.instance.moveTimeWindow(new Date(+new Date(el.instance.startTime) + 5 * 3600e3))`);
        const again = await liveWin();
        const ok = !past.live && !past.next && past.toNow <= -7000 && kept && again.live && again.next && Math.abs(again.toNow) <= 2;
        return ok ? true : JSON.stringify({ past, kept, again });
    });
    await t.step('the day before then the day after: back in real time when it reaches the present, never past it', async () => {
        await t.E('el.instance.today()');
        await t.E('el.instance.stepDay(-1)'); const before = await liveWin();
        await t.E('el.instance.stepDay(1)'); const after = await liveWin();
        await t.E('el.instance.stepDay(1)'); const again = await liveWin();
        const ok = !before.live && !before.next && after.toNow <= 2 && again.live && again.next && Math.abs(again.toNow) <= 2;
        return ok ? true : JSON.stringify({ before, after, again });
    });
    done(await t.close());

    // ── Midnight, in the browser's time zone (Paris: a day starting 2 h before UTC's) ──
    {
        const now = Date.parse('2026-10-19T18:19:00+02:00') / 1000, ago = iso => now - Date.parse(iso) / 1000;
        const rows = [['2026-10-18T10:00:00+02:00', '17'], ['2026-10-18T22:40:00+02:00', '14'], ['2026-10-18T23:10:00+02:00', '13'], ['2026-10-19T01:00:00+02:00', '14'], ['2026-10-19T02:00:00+02:00', '13']]
            .map(([iso, v]) => [ago(iso), v]);
        t = await openCard(card({ defaultTimeRange: '24h', statistics: { enabled: true }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }),
            { mock: { series: true, rows: { 'sensor.power': rows } }, clock: '2026-10-19T18:19:00+02:00', timezone: 'Europe/Paris' });
        await t.wait(1500);
        const around = () => t.E(`(()=>{ const d=el.instance.graphs[0].chart.data.datasets[0].data, x=d.map(p=>+new Date(p.x));
            const at=iso=>{ const t0=Date.parse(iso); let v; for( let i=0; i<x.length && x[i]<=t0; i++ ) v=d[i].y; return v; };
            return { ordered: x.every((v,i)=>!i||v>=x[i-1]), at2300: at('2026-10-18T23:00:00+02:00'), at2330: at('2026-10-18T23:30:00+02:00'), at0030: at('2026-10-19T00:30:00+02:00'), at0130: at('2026-10-19T01:30:00+02:00') }; })()`);
        await t.step('Paris time: a change at 23:10 drawn at 23:10, the day after joined at midnight, in time order — before and after a refresh', async () => {
            const a = await around();
            await t.E('el.instance.refresh()'); await t.wait(1500);
            const b = await around();
            const ok = r => r.ordered && r.at2300 == 14 && r.at2330 == 13 && r.at0030 == 13 && r.at0130 == 14;
            return ok(a) && ok(b) ? true : JSON.stringify({ a, b });
        });
        done(await t.close());
    }
    t = await openCard(card({ defaultTimeRange: '2h', statistics: { enabled: true }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }),
        { mock: { series: true, historyStep: 300 }, clock: '2026-10-18T23:40:00+02:00', timezone: 'Europe/Paris' });
    await t.wait(3000);
    await t.step('Paris time, the page opened at 23:40 and still open at 0:10: the evening\'s end asked again at the first refresh after midnight, with the new day; the curve without a gap', async () => {
        await t.page.clock.fastForward('30:00'); await t.wait(500);
        await t.E('__ws.length = 0; el.instance.refresh()'); await t.wait(2500);
        const r = await t.E(`(()=>{ const I=el.instance, d=I.graphs[0].chart.data.datasets[0].data, x=d.map(p=>+new Date(p.x));
            const h=__ws.filter(w=>w.type==='history/history_during_period').map(w=>w.start);
            const evening=x.filter(v=>v>Date.parse('2026-10-18T23:41:00+02:00') && v<Date.parse('2026-10-19T00:00:00+02:00')).length;
            return { h, evening, live: I.state.autoScroll, slots: I.cache.length - 1 === I.cacheSize }; })()`);
        const ok = r.h.includes('2026-10-18T00:00:00+02:00') && r.h.includes('2026-10-19T00:00:00+02:00') && r.evening >= 3 && r.live && r.slots;
        return ok ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The time axis across a change of daylight saving time (Paris): every midnight ticked
    // and labelled with its day, the hours stepped by the clock ──
    for( const [clock, label] of [['2026-10-28T05:44:00+01:00', 'October (a day of 25 h)'], ['2026-03-31T05:44:00+02:00', 'March (a day of 23 h)']] ) {
        t = await openCard(card({ defaultTimeRange: '3d', statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }),
            { mock: { series: true }, clock, timezone: 'Europe/Paris' });
        await t.wait(1500);
        await t.step(`3 days over the change of time in ${label}: every midnight a tick of the day, the hours on the clock's`, async () => {
            const r = await t.E(`(()=>{ const c=graphAt(0).chart, sc=c.scales[c.options.scales.xAxes[0].id], I=el.instance;
                const at=v=>{ const d=new Date(v); return d.getDate()+' '+d.getHours()+':'+String(d.getMinutes()).padStart(2,'0'); };
                const ticks=sc._ticks.map(k=>({ v:k.value, major:k.major, at:at(k.value) }));
                const nights=[], d=new Date(I.startTime); d.setHours(0,0,0,0);
                for( d.setDate(d.getDate()+1); +d<+new Date(I.endTime); d.setDate(d.getDate()+1) ) nights.push(+d);
                return { step: I.activeRange.tickStepSize + I.activeRange.tickStepUnit, at: ticks.map(k=>k.at),
                         missing: nights.filter(n=>!ticks.some(k=>k.v===n && k.major)).map(at),
                         offClock: ticks.filter(k=>new Date(k.v).getHours() % +I.activeRange.tickStepSize || new Date(k.v).getMinutes()).map(k=>k.at) }; })()`);
            return r.missing.length === 0 && r.offClock.length === 0 && /h|hour/.test(r.step) ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    // ── The year of the window's left end, in the margin left of the plot (Chart.js
    // hecLeftLabel): a window from December 2025 to January 2026 ──
    const yearCard = o => openCard(card({ defaultTimeRange: '3d', statistics: { enabled: false }, graphs: [{ type: 'line', ...o, entities: [{ entity: 'sensor.power' }] },
            { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }] }] }), { mock: { series: true }, clock: '2026-01-01T05:44:00+01:00', timezone: 'Europe/Paris' });
    // (the texts graph gi draws, as it's redrawn: each with its place, font and alignment; its
    // plot's left, the line of its time labels)
    const drawnTexts = gi => t.E(`(()=>{ const c=graphAt(${gi}).chart, P=CanvasRenderingContext2D.prototype, f=P.fillText, out=[];
        P.fillText=function(s,x,y){ if( this.canvas===c.canvas ) out.push({ text:String(s), x, y, font:this.font, align:this.textAlign, w:this.measureText(String(s)).width }); return f.apply(this,arguments); };
        try { c.render({ duration: 0 }); } finally { P.fillText=f; }
        const xs=c.scales[c.options.scales.xAxes[0].id], o=xs.options;
        return { texts: out, left: c.chartArea.left, line: xs.top+(o.gridLines.drawTicks?o.gridLines.tickMarkLength:0)+o.ticks.padding }; })()`);
    t = await yearCard({});
    await t.wait(1500);
    await t.step('the year of the window\'s left end (2025, the window ending in 2026) on every graph: in bold, in the margin left of the plot, on the line of the time labels', async () => {
        const r = [await drawnTexts(0), await drawnTexts(1)].map(d => ({ year: d.texts.filter(x => /^\d{4}$/.test(x.text)), left: d.left, line: d.line }));
        const ok = r.every(d => d.year.length === 1 && d.year[0].text === '2025' && /bold/.test(d.year[0].font) && d.year[0].align === 'right'
            && d.year[0].x <= d.left && d.year[0].x - d.year[0].w >= 0 && Math.abs(d.year[0].y - d.line) < 0.5);
        return ok ? true : JSON.stringify(r);
    });
    // (graph gi from start to end, ticked by month — its labels as Chart.js gives them)
    const sixMonths = (gi, start, end) => t.E(`(()=>{ const c=graphAt(${gi}).chart, tm=c.options.scales.xAxes[0].time;
        Object.assign(tm, { min: '${start}', max: '${end}', unit: 'month', stepSize: 1 }); c.update(0); })()`);
    const firstLabel = gi => t.E(`(()=>{ const c=graphAt(${gi}).chart, xs=c.scales[c.options.scales.xAxes[0].id], k=xs.getTicks().findIndex((k,i)=>k.label!=null && xs.getPixelForTick(i)>=c.chartArea.left-1); return k<0?null:String(xs.getTicks()[k].label); })()`);
    await t.step('a month axis whose year changes after its left end (25 Dec 2025): its year 2026 on the axis, the margin\'s 2025 — the left end\'s', async () => {
        await sixMonths(0, '2025-12-25T00:00:00', '2026-06-25T00:00:00');
        const year = (await drawnTexts(0)).texts.filter(x => /^\d{4}$/.test(x.text)).map(x => x.text).sort().join(), first = await firstLabel(0);
        return year === '2025,2026' && first === '2026' ? true : JSON.stringify({ year, first });
    });
    await t.step('a month axis starting with its year (1 Jan 2026): the year at its left end, none in the margin — never twice side by side', async () => {
        await sixMonths(0, '2026-01-01T00:00:00', '2026-07-01T00:00:00');
        const year = (await drawnTexts(0)).texts.filter(x => /^\d{4}$/.test(x.text)).map(x => x.text).join(), first = await firstLabel(0);
        return year === '2026' && first === '2026' ? true : JSON.stringify({ year, first });
    });
    await t.step('no room — a card so narrow its Y labels are inside the plot: no year on its curves\' graph, the timeline\'s (its rows\' names beside it) still has it', async () => {
        await t.E(`(()=>{ document.body.style.width='260px'; document.getElementById('host').style.width='260px'; })()`); await t.wait(1500);
        const r = [await drawnTexts(0), await drawnTexts(1)].map(d => d.texts.filter(x => /^\d{4}$/.test(x.text)).map(x => x.text).join());
        return r[0] === '' && r[1] === '2025' ? true : JSON.stringify(r);
    });
    done(await t.close());
    t = await yearCard({ showTimeLabels: false });
    await t.wait(1500);
    await t.step('no time labels (showTimeLabels: false): no year', async () => {
        const r = (await drawnTexts(0)).texts.filter(x => /^\d{4}$/.test(x.text)).map(x => x.text).join();
        return r === '' ? true : r;
    });
    done(await t.close());

    // ── The tooltip's size: full, compact, slim — auto as the card's width says ──
    t = await openCard(card({ defaultTimeRange: '24h', statistics: { enabled: false }, graphs: [{ type: 'line', entities: [
            { entity: 'sensor.power', name: 'Météo-France Villeveyrac Temperature (Filtered)' },
            { entity: 'sensor.rain', name: 'Météo-France Villeveyrac Temperature' }] }] }),
        { mock: { series: true }, clock: '2026-10-19T18:19:00+02:00', timezone: 'Europe/Paris' });
    await t.wait(1500);
    const tipAt = (w) => t.E(`(async()=>{ el.style.display='block'; el.style.width='${w}'; await new Promise(r=>setTimeout(r,400));
        const I=el.instance, c=graphAt(0).chart, cb=c.options.tooltips.callbacks, ds=c.data.datasets[0], i=Math.floor(ds.data.length/2);
        const it={ datasetIndex:0, index:i, xLabel:'X', yLabel:ds.data[i].y };
        return { size: I.tooltipSize(), title: cb.title([it], c.data), label: cb.label(it, c.data), firstOnly: !!c.options.tooltips.hecFirstOnly }; })()`);
    await t.step('auto, a large screen (600 px or more): full — the source and the time, the whole name and the value', async () => {
        const r = await tipAt('');
        return r.size === 'full' && r.title === 'History: X' && /^Météo-France Villeveyrac Temperature \(Filtered\): /.test(r.label) && !r.firstOnly ? true : JSON.stringify(r);
    });
    await t.step('auto, a small screen (300 to 600 px): compact — the time alone, the name at its shortest, the value', async () => {
        const r = await tipAt('450px');
        return r.size === 'compact' && r.title === 'X' && /^Temperature \(Filtered\): /.test(r.label) && !r.firstOnly ? true : JSON.stringify(r);
    });
    await t.step('auto, a narrow card (under 300 px): slim — no title, the first value alone, its time without its date (one day shown, the hours on the X axis) and its value', async () => {
        const r = await tipAt('280px');
        return r.size === 'slim' && r.title === '' && /^\d\d?:\d\d(:\d\d)?(\s?[ap]m)?\u00a0\u00a0-?[\d.,]+ /i.test(r.label) && r.firstOnly ? true : JSON.stringify(r);
    });
    await t.step('slim: one value only, whatever the tooltip mode (all) — a hover shows the first point alone', async () => {
        const r = await t.E(`(()=>{ const c=graphAt(0).chart; c.data.datasets.forEach(d=>d.hecTooltip='all'); c.update(0);
            const m=c.getDatasetMeta(0).data, p=m[Math.floor(m.length/2)]._view, b=c.canvas.getBoundingClientRect();
            return c._hecHoverElements({ x:p.x, y:p.y }).length; })()`);
        return r === 1 ? true : JSON.stringify(r);
    });
    await t.step('tooltip.size set: the same at every width', async () => {
        await t.E(`(()=>{ el.instance.pconfig.tooltipSize='compact'; })()`);
        const a = await tipAt(''), b = await tipAt('280px');
        await t.E(`(()=>{ el.instance.pconfig.tooltipSize='auto'; el.style.width=''; })()`);
        return a.size === 'compact' && b.size === 'compact' && !b.firstOnly ? true : JSON.stringify({ a, b });
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
    await t.step('French, the card narrowed: the date shortened first, the range ("1 Jour") only once the short date and the whole range don\'t fit', async () => {
        const r = [];
        for( const w of [700, 600, 500, 450, 420, 400, 380, 360, 340, 320, 300, 280, 270, 260] ) {
            await t.E(`(()=>{ el.style.display='block'; el.style.width='${w}px'; })()`); await t.wait(300);
            r.push(await t.E(`[${w}, el.instance._toolbarForm[0], el.querySelector('#by_0').style.maxWidth]`));
        }
        await t.E(`el.style.width=''`); await t.wait(300);
        const forms = r.map(x => x[1]);
        const ok = forms.every((f, k) => k === 0 || f >= forms[k - 1]) && forms.includes(1) && r.every(x => x[2] === ( x[1] === 2 ? '50px' : '83px' ));
        return ok ? true : JSON.stringify(r);
    });
    await t.step('French: the menus are in French', async () => {
        await t.E(`el.querySelector('#bo_0').click()`); await t.wait(300); await t.E(`el.instance.showOptionsSubmenu(0, 'export')`); await t.wait(200);
        const txt = await t.E(`el.querySelector('#eo_0_csv')?.textContent`);
        await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.wait(300);
        return txt === 'Historique' ? true : JSON.stringify(txt);
    });
    done(await t.close());

    // ── The entity selector sized from its list: the layout chosen from the width 90 % of its
    // lines need, the field then as wide as the room, up to the width every line needs; the
    // menu as wide as the field, a line too long shortened (else on two lines) ──
    const _st = (k, name, val) => ({ entity_id: 'sensor.l' + k, state: val, last_changed: new Date().toISOString(), last_updated: new Date().toISOString(), attributes: { friendly_name: name } });
    const LISTS = {
        short: Object.fromEntries(['Salon', 'Cuisine', 'Bureau', 'Entrée', 'Garage'].map((n, k) => ['sensor.l' + k, _st(k, n, String(k))])),
        // (a realistic installation: names from usual Home Assistant patterns, a device's name
        // in front of some of them, a few much longer)
        real: (() => { const r = {}, rooms = ['Salon', 'Cuisine', 'Chambre parents', 'Bureau', 'Salle de bain', 'Garage', 'Jardin', 'Piscine'],
            things = ['Température', 'Humidité', 'Luminosité', 'Mouvement', 'Porte', 'Lampe', 'Prise', 'Volet', 'Puissance', 'Énergie', 'Batterie', 'Signal Wi-Fi'],
            devs = ['Shelly Plus 1PM ', 'Aqara ', 'Zigbee2MQTT ', 'Philips Hue ']; let k = 0;
            for( const room of rooms ) for( const th of things ) { r['sensor.l' + k] = _st(k, ( k % 5 === 0 ? devs[k % 4] : '' ) + room + ' ' + th + ( k % 9 === 0 ? ' (Filtered)' : '' ), String(k % 50)); k++; }
            for( const n of ['Shelly Pro 3EM Compteur Général Maison Phase A Puissance Active', 'Météo-France Villeveyrac Probabilité de pluie dans la prochaine heure'] ) { r['sensor.l' + k] = _st(k, n, '1'); k++; }
            return r; })(),
    };
    for( const [ln, states] of Object.entries(LISTS) ) {
        t = await openCard(card({ graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true, language: 'fr', extraStates: states } });
        for( const w of [344, 480, 683, 1000, 1600] ) {
            await t.page.setViewportSize({ width: w + 20, height: 900 });
            await t.E(`(()=>{ document.body.style.width='${w}px'; document.getElementById('host').style.width='${w}px'; })()`); await t.wait(1200);
            await t.step(`the selector, ${ln} names, a ${w} px card: on the date's line when 90 % of its lines fit there, as wide as the room up to every line's width; its menu as wide, its lines fitted, none twice, nothing out of the card`, async () => {
                const p = await t.E(`(()=>{ const r=el.querySelector('#b7_0').getBoundingClientRect(); return {x:r.left+10,y:r.top+r.height/2}; })()`);
                await t.page.mouse.click(p.x, p.y); await t.wait(400);
                const r = await t.E(`(()=>{ const I=el.instance, q=s=>el.querySelector(s), card=q('#maincard').getBoundingClientRect(), f=q('#b7_0').getBoundingClientRect(),
                    dl=q('#dl_0').getBoundingClientRect(), dr=q('#dr_0').getBoundingClientRect(), bo=q('#bo_0').getBoundingClientRect(), es=q('#es_0'), m=es.getBoundingClientRect(), W=I.entityLineWidths();
                    const lines=[...es.children], lh=parseFloat(getComputedStyle(lines[0]).lineHeight)||16;
                    return { most: W.most, all: W.all, field: Math.round(f.width), oneLine: Math.abs(f.top-dl.top) < 20 && f.left > dl.right && f.right < dr.left,
                        gap: Math.round(dr.left - dl.right - bo.width), menu: Math.round(m.width), out: f.right > card.right + 1 || m.right > card.right + 1 || f.left < card.left - 1,
                        twice: lines.length - new Set(lines.map(a=>a.textContent)).size, tall: lines.filter(a => a.scrollHeight > 2.5 * lh).length,
                        short: lines.filter(a => a.textContent !== a.dataset.name + a.dataset.tail).map(a => a.dataset.name).slice(0, 1) }; })()`);
                await t.page.keyboard.press('Escape'); await t.page.mouse.click(2, 2); await t.wait(200);
                const _layout = r.oneLine ? r.gap >= r.most - 30 : r.gap < r.most + 30;
                const _width = r.field <= r.all + 4 && ( r.field >= r.all - 4 || r.field >= Math.min(r.most, w - 80) - 4 );
                return r.most > 0 && _layout && _width && Math.abs(r.menu - r.field) <= 2 && !r.out && !r.twice && !r.tall ? true : JSON.stringify(r);
            });
        }
        if( ln === 'real' ) await t.step('the widths its list needs and its lines\' shorter forms kept on this device: the field sized from them, reading "Loading…", before the list is built again; the forms ready before the menu opens', async () => {
            const r = await t.E(`(()=>{ const I=el.instance, k=Object.keys(localStorage).find(k=>k.startsWith('history-explorer_selector_') && !k.includes('_forms_'));
                const saved=k && JSON.parse(localStorage.getItem(k)), now=I.entityLineWidths();
                const fk=Object.keys(localStorage).find(k=>k.startsWith('history-explorer_selector_forms_')), f=fk && JSON.parse(localStorage.getItem(fk));
                const forms = f && f['sensor.l54'];
                const L=I._entityList; I._entityList=null; I.insertUIHtmlText(0); const before=I.entityLineWidths(), ph=el.querySelector('#b7_0').placeholder;
                I._entityList=L; I.insertUIHtmlText(0);
                return { saved, now, before, ph, after: el.querySelector('#b7_0').placeholder, forms, ready: !!I._entityList.forms }; })()`);
            return r.saved && r.saved.all >= r.saved.most && r.saved.most > 0 && JSON.stringify(r.saved) === JSON.stringify(r.now) && JSON.stringify(r.before) === JSON.stringify(r.saved)
                && /^(Loading|Chargement)…$/.test(r.ph) && r.after !== r.ph
                && r.forms?.name === 'Salle de bain Prise (Filtered)' && r.forms.forms[2] === 'S B… Prise (F)' && r.ready ? true : JSON.stringify(r);
        });
        if( ln === 'real' ) await t.step('a line shortened in the menu is still found by its full name', async () => {
            await t.page.setViewportSize({ width: 364, height: 900 });
            await t.E(`(()=>{ document.body.style.width='344px'; document.getElementById('host').style.width='344px'; })()`); await t.wait(1200);
            // (the lines fitted to the field when the menu opens)
            const p = await t.E(`(()=>{ const r=el.querySelector('#b7_0').getBoundingClientRect(); return {x:r.left+10,y:r.top+r.height/2}; })()`);
            await t.page.mouse.click(p.x, p.y); await t.wait(300);
            const full = await t.E(`(()=>{ const a=[...el.querySelector('#es_0').children].find(a => a.textContent !== a.dataset.name + a.dataset.tail); return a ? a.dataset.name : null; })()`);
            if( !full ) return 'no line shortened at 344 px';
            await t.page.keyboard.type(full.slice(0, 18)); await t.wait(400);
            const shown = await t.E(`[...el.querySelector('#es_0').children].filter(a => a.style.display !== 'none').map(a => a.dataset.name)`);
            return shown.includes(full) ? true : JSON.stringify({ full, shown: shown.slice(0, 5) });
        });
        done(await t.close());
    }

    return { passed, failed };
};
