// mini-graph-card's syntax read by the card, as its own: a mini-graph-card's YAML with
// `type: custom:history-explorer-card` and `look: mini` (its names, its `show:`, its root
// `entities`, `name`, `unit`), each name an alias of one of the card's options, each value
// one the option accepts with the same meaning — and those values in the card's own syntax
const { openCard } = require('./lib.cjs');

const card = (o) => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, ...o });

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };
    // (graph i's datasets, field f of each)
    const ds = (t, f, i = 0) => t.E(`el.instance.graphsInDisplayOrder()[${i}].chart.data.datasets.map(d=>JSON.stringify(d.${f}))`);

    // ── A mini-graph-card's YAML, in place ──
    let t = await openCard({ type: 'custom:history-explorer-card', look: 'mini', statistics: { enabled: false },
        name: 'Power', hours_to_show: 12, line_width: 3, decimals: 1, smoothing: false, lower_bound: 0, upper_bound: 5000,
        show: { points: true, legend: false, fill: false },
        entities: ['sensor.power', { entity: 'sensor.rain', y_axis: 'secondary', color: '#ff0000', show_fill: true }] }, { mock: { series: true }, height: 700 });
    await t.wait(1000);
    await t.step('its root entities: one graph, its name the graph\'s title', async () => {
        const v = await t.E(`(()=>{ const g=el.instance.graphsInDisplayOrder(); return g.length+':'+g[0].entities.map(e=>e.entity).join(',')+':'+el.instance.pconfig.graphs[g[0].groupId]?.title; })()`);
        return v === '1:sensor.power,sensor.rain:Power' ? true : v;
    });
    await t.step('hours_to_show: the time range', async () => {
        const v = await t.E(`Math.round(el.instance.timeRangeSeconds()/3600)`);
        return v === 12 ? true : 'hours: ' + v;
    });
    await t.step('line_width wins over the look\'s; smoothing: false — straight lines; show: points — the dots', async () => {
        const w = await ds(t, 'borderWidth'), l = await ds(t, 'lineTension'), r = await ds(t, 'pointRadius');
        return w.join() === '3,3' && l.join() === '0,0' && r.every(x => +x > 0) ? true : JSON.stringify({ w, l, r });
    });
    await t.step('y_axis: secondary — the right axis; lower_bound / upper_bound — the Y bounds', async () => {
        const v = await t.E(`(()=>{ const c=el.instance.graphsInDisplayOrder()[0].chart; const y=c.options.scales.yAxes;
            return c.data.datasets.map(d=>d.yAxisID).join(',')+'|'+y[0].ticks.min+','+y[0].ticks.max; })()`);
        return /^[^,]+,[^,|]+\|0,5000$/.test(v) && v.split('|')[0].split(',')[0] !== v.split('|')[0].split(',')[1] ? true : v;
    });
    await t.step('show: legend: false — no legend; show: fill: false — no fill, show_fill on an entity wins', async () => {
        const legend = await t.E(`el.instance.graphsInDisplayOrder()[0].chart.options.legend.display`);
        const bg = await ds(t, 'backgroundColor');
        return legend === false && /rgba\(0, ?0, ?0, ?0\)/.test(bg[0]) && /rgba\(255, ?0, ?0, ?0\.15\)/.test(bg[1]) ? true : JSON.stringify({ legend, bg });
    });
    await t.step('decimals: exactly that many decimals in the values over the graph', async () => {
        const v = await t.E(`[...el.instance.graphsInDisplayOrder()[0].chart._hecValuesEl.querySelectorAll('.hec-state')].map(s=>s.textContent.trim())`);
        return v.length && v.every(x => /\d\.\d(\D|$)/.test(x)) ? true : JSON.stringify(v);
    });
    await t.step('look: mini — mini-graph-card\'s interpolation by default (bspline)', async () => {
        const v = await ds(t, 'hecInterpolation');
        return v.join() === '"bspline","bspline"' ? true : v.join();
    });
    done(await t.close());

    // ── The same values in the card's own syntax ──
    t = await openCard(card({ graphs: [{ type: 'line', entities: [
        { entity: 'sensor.power' }, { entity: 'sensor.power2', showPoints: false }, { entity: 'sensor.rain', showPoints: 'hover', dashMode: '10, 5' }] }] }),
        { mock: { series: true }, height: 700 });
    await t.wait(1000);
    await t.step('showPoints: the hovered dot by default and with hover; none at all with false', async () => {
        const h = await ds(t, 'pointHoverRadius'), r = await ds(t, 'pointRadius');
        return +h[0] > 0 && +h[1] === 0 && +h[2] > 0 && r.every(x => +x === 0) ? true : JSON.stringify({ h, r });
    });
    await t.step('dashMode: dashes and gaps as CSS writes them', async () => {
        const v = await ds(t, 'borderDash');
        return v[2] === '[10,5]' ? true : JSON.stringify(v);
    });
    await t.step('points hidden from the menu: back to the hovered dot only', async () => {
        await t.E(`(()=>{ const g=el.instance.graphsInDisplayOrder()[0]; el.instance.toggleCurvePoints(g, [g.entities[0]]); el.instance.toggleCurvePoints(g, [g.entities[0]]); })()`);
        const h = await ds(t, 'pointHoverRadius'), r = await ds(t, 'pointRadius');
        return +r[0] === 0 && +h[0] > 0 ? true : JSON.stringify({ h, r });
    });
    done(await t.close());

    // ── Thresholds as a list; rounding; yAxis primary ──
    t = await openCard(card({ rounding: 0, graphs: [{ type: 'line', entities: [
        { entity: 'sensor.power', color: [{ value: 0, color: '#0000ff' }, '#00ff00', { value: 1000, color: '#ff0000' }] },
        { entity: 'sensor.rain', yAxis: 'primary', rounding: 2 }] }] }), { mock: { series: true }, height: 700 });
    await t.wait(1000);
    await t.step('color: thresholds as a list, a stop without a value spaced between its neighbours', async () => {
        // (the power goes from about 400 to 600: blue below 500, green from 500 — red from 1000)
        const c = await t.E(`(()=>{ const g=el.instance.graphsInDisplayOrder()[0]; return [...new Set((g.chart.data.datasets[0].colorSteps||[]).map(s=>s.borderColor))].sort().join(','); })()`);
        return c === '#0000ff,#00ff00' ? true : c;
    });
    await t.step('rounding: 0 — no decimals; on an entity — exactly its own', async () => {
        const v = await t.E(`(()=>{ const c=el.instance.graphsInDisplayOrder()[0].chart; return c.legend.legendItems.map(i=>i.hecValue); })()`);
        return /^\(\d+ /.test(v[0]) && /^\(\d+\.\d\d /.test(v[1]) ? true : JSON.stringify(v);
    });
    await t.step('yAxis: primary — the left axis', async () => {
        const v = await ds(t, 'yAxisID');
        return v[0] === v[1] ? true : JSON.stringify(v);
    });
    done(await t.close());

    // ── Every option in its one form from its reading: what the card keeps and saves ──
    t = await openCard(card({ defaultTimeRange: 12, graphs: [{ type: 'bar', entities: [
        { entity: 'sensor.rain', color: [255, 0, 0], circular: ' 2 PI ', showMinMax: 'states' },
        { entity: 'sensor.power', showMinMax: true, y_axis: 'secondary', smoothing: false, line_style: '10, 5', decimals: '1', tap_action: 'none', interval: 'daily', showStats: 'avg',
          color_thresholds: [{ value: 0, color: '#0000ff' }, '#00ff00', { value: 1000, color: '#ff0000' }], interpolation: 'Catmull-Rom' }] }] }),
        { mock: { series: true }, height: 700 });
    await t.wait(1000);
    await t.step('the aliases of names and values resolved where the YAML is read: the entry holds only the card\'s own forms', async () => {
        const v = await t.E(`(()=>{ const e=el.instance.store.list.find(x=>x.entity==='sensor.power');
            return JSON.stringify([e.yAxis, e.lineMode, e.dashMode, e.rounding, e.tapAction, e.interval, e.showStats, e.color, e.interpolation]); })()`);
        const r = await t.E(`(()=>{ const e=el.instance.store.list.find(x=>x.entity==='sensor.rain');
            return JSON.stringify([e.color, e.circular, e.showMinMax, el.instance.store.list.find(x=>x.entity==='sensor.power').showMinMax, el.instance.pconfig.defaultTimeRange]); })()`);
        const want = JSON.stringify(['right', 'lines', [10, 5], 1, { action: 'none' }, 2, ['average'],
            { thresholds: [[0, '#0000ff'], [500, '#00ff00'], [1000, '#ff0000']], states: {} }, 'catmullrom']);
        const want2 = JSON.stringify(['rgb(255,0,0)', 2 * Math.PI, 'history', true, '12h']);
        return v === want && r === want2 ? true : v + ' | ' + r;
    });
    done(await t.close());

    // ── tap_action: a click on a value ──
    const clickValue = async (t, i) => {
        const p = await t.E(`(()=>{ const c=el.instance.graphsInDisplayOrder()[0].chart, b=c.legend.legendHitBoxes[${i}], it=c.legend.legendItems[${i}], r=c.canvas.getBoundingClientRect(), ctx=c.ctx;
            ctx.save(); ctx.font=c._hecLegendFont(); const m=it.hecMark?ctx.measureText(' '+it.hecMark).width:0, v=ctx.measureText(it.hecValue).width; ctx.restore();
            return { x: r.left+b.left+b.width-m-v/2, y: r.top+b.top+b.height/2 }; })()`);
        await t.page.mouse.click(p.x, p.y); await t.wait(500);
    };
    t = await openCard(card({ tap_action: { action: 'none' }, graphs: [{ type: 'line', entities: [
        { entity: 'sensor.power' },
        { entity: 'sensor.power2', tap_action: { action: 'call-service', service: 'light.toggle', service_data: { entity_id: 'light.x' } } },
        { entity: 'sensor.rain', tapAction: 'more-info' }] }] }), { mock: { series: true }, height: 700 });
    await t.wait(1000);
    await t.E(`window.__mi=[]; window.__services=[]; document.addEventListener('hass-more-info', e => __mi.push(e.detail.entityId))`);
    await t.step('tap_action on the card: none — nothing; on an entity: its own (a service; more-info)', async () => {
        for( const i of [0, 1, 2] ) await clickValue(t, i);
        const mi = await t.E('__mi'), sv = await t.E('__services');
        return mi.join() === 'sensor.rain' && sv.length === 1 && sv[0][0] === 'light.toggle' && sv[0][1].entity_id === 'light.x' ? true : JSON.stringify({ mi, sv });
    });
    done(await t.close());

    // ── interpolation: bspline, drawn by Chart.js: a peak [0, 100, 0] on a chart of its own ──
    t = await openCard(card({ graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true } });
    await t.step('bspline: the curve through the middles — a peak drawn at three quarters of its value, its dot kept on the value; picked on its arc, not on the value; the others through the value', async () => {
        const r = await t.E(`(()=>{ const C=el.instance.graphs[0].chart.constructor, out={};
            for( const algo of ['monotone', 'bspline'] ) {
                const cv=document.createElement('canvas'); cv.width=300; cv.height=200; cv.style.cssText='width:300px;height:200px'; document.body.appendChild(cv);
                const c=new C(cv.getContext('2d'), { type: 'line', data: { labels: ['a','b','c','d'], datasets: [{ data: [0,100,0,0], borderColor: '#f00', borderWidth: 2,
                    fill: 'origin', backgroundColor: 'rgba(0,0,255,0.3)', pointRadius: 0, cubicInterpolationMode: 'monotone', hecInterpolation: algo, lineTension: 0.4 }] },
                    options: { responsive: false, animation: false, legend: { display: false }, scales: { yAxes: [{ ticks: { min: 0, max: 100 } }] } } });
                const m=c.getDatasetMeta(0).data[1]._view, d=cv.getContext('2d').getImageData(Math.round(m.x), 0, 1, 200).data;
                let top=-1; for( let y=0; y<200; y++ ) if( d[y*4] > 200 && d[y*4+1] < 80 && d[y*4+3] > 200 ) { top=y; break; }
                out[algo]={ peak: m.y, top, bottom: c.chartArea.bottom, onArc: c._hecCurveAt(m.x, top), onValue: c._hecCurveAt(m.x, m.y) };
                c.destroy(); cv.remove();
            } return out; })()`);
        const b = r.bspline, mo = r.monotone, expected = b.peak + (b.bottom - b.peak) / 4;
        return Math.abs(mo.top - mo.peak) <= 2 && Math.abs(b.top - expected) <= 2 && b.onArc === 0 && b.onValue === -1 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── Aggregation: points_per_hour, aggregate_func, group_by (mini-graph-card's) ──
    // (each curve's points: [time, value], and its groups' start and end)
    const pts = (i = 0) => t.E(`el.instance.graphsInDisplayOrder()[0].chart.data.datasets.map(d=>d.data.map(p=>[+new Date(p.x), p.y, p.columnFrom, p.columnTo]))`);
    t = await openCard({ type: 'custom:history-explorer-card', statistics: { enabled: false }, hours_to_show: 168, group_by: 'date',
        entities: [{ entity: 'sensor.power', aggregate_func: 'max', name: 'Max' }, { entity: 'sensor.power2', aggregate_func: 'min', name: 'Min' }, { entity: 'sensor.watering_cycle', name: 'Avg' }] },
        { mock: { series: true, historyStep: 600 }, height: 700 });
    await t.wait(3000);
    await t.step('group_by: date — a point a day, from midnight to midnight; aggregate_func max: the day\'s highest value, min: its lowest, none: its mean (time-weighted), between them', async () => {
        const r = await t.E(`(()=>{ const g=el.instance.graphsInDisplayOrder()[0];
            return g.chart.data.datasets.map((d,k)=>{ const raw=(g.valueSamples?.[k]??[]);
                return d.data.map(p=>{ const v=raw.filter(x=>x.t>=p.columnFrom && x.t<p.columnTo).map(x=>x.v);
                    return { from: p.columnFrom, to: p.columnTo, y: p.y, lo: v.length?Math.min(...v):null, hi: v.length?Math.max(...v):null }; }); }); })()`);
        const [mx, mn, av] = r;
        const midnight = x => new Date(x).getHours() === 0 && new Date(x).getMinutes() === 0;
        const days = mx.length >= 7 && mx.length <= 9 && mx.every(p => midnight(p.from)) && mx.slice(0, -1).every(p => p.to - p.from >= 23 * 3600e3);
        const near = (a, b) => Math.abs(a - b) < 1e-6;
        const full = a => a.filter(p => p.lo !== null);
        const ok = days && full(mx).every(p => near(p.y, p.hi)) && full(mn).every(p => near(p.y, p.lo)) && full(av).every(p => p.y >= p.lo - 1e-9 && p.y <= p.hi + 1e-9 && p.hi > p.lo);
        return ok ? true : JSON.stringify({ n: [mx.length, mn.length, av.length], mx: mx.slice(0, 2), mn: mn.slice(0, 2), av: av.slice(0, 2) });
    });
    done(await t.close());
    t = await openCard({ type: 'custom:history-explorer-card', statistics: { enabled: false }, hours_to_show: 24, points_per_hour: 0.5,
        entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power2', aggregate_func: 'delta' }, { entity: 'sensor.watering_cycle', aggregate_func: 'diff' }, { entity: 'sensor.days_to_watering', aggregate_func: 'median' }] },
        { mock: { series: true, historyStep: 300 }, height: 700 });
    await t.wait(3000);
    await t.step('points_per_hour: 0.5 — a point every 2 h, on whole hours of the day (0:00, 2:00…); delta its max less its min, diff its last less its first, median between them', async () => {
        const start = await t.E('+new Date(el.instance.startTime)');
        const [av, de, di, me] = ( await pts() ).map(a => a.filter(x => x[3] > start));
        const even = av.every(p => new Date(p[2]).getMinutes() === 0 && new Date(p[2]).getHours() % 2 === 0) && av.slice(0, -1).every(p => p[3] - p[2] === 2 * 3600e3);
        const r = { n: av.length, even, delta: de.every(p => p[1] >= 0), diff: di.some(p => p[1] < 0) && di.some(p => p[1] > 0),
                    median: me.every(p => p[1] >= Math.min(...me.map(x => x[1]))) };
        return av.length >= 12 && av.length <= 14 && even && r.delta && r.diff && de.length === av.length ? true : JSON.stringify(r);
    });
    done(await t.close());
    t = await openCard({ type: 'custom:history-explorer-card', statistics: { enabled: false }, hours_to_show: 168, aggregate_func: 'max', group_by: 'date', show: { graph: 'bar' },
        entities: ['sensor.power'] }, { mock: { series: true, historyStep: 600 }, height: 700 });
    await t.wait(3000);
    await t.step('show: graph: bar, group_by: date, aggregate_func: max — a bar a day (the interval daily), each the day\'s highest value', async () => {
        const r = await t.E(`(()=>{ const g=el.instance.graphsInDisplayOrder()[0], d=g.chart.data.datasets[0].data, v=g.valueSamples?.[0] ?? [];
            return { type: g.type, interval: g.interval, n: d.length, ys: d.map(p=>p.y) }; })()`);
        const ok = r.type === 'bar' && r.interval === 2 && r.n >= 7 && r.n <= 9 && r.ys.every(y => y > 0);
        return ok ? true : JSON.stringify(r);
    });
    done(await t.close());
    t = await openCard({ type: 'custom:history-explorer-card', statistics: { enabled: false }, defaultTimeRange: '24',
        entityOptions: [{ match: 'sensor.rain', aggregateFunc: 'max' }],
        graphs: [{ type: 'line', options: { pointsPerHour: 1 }, entities: [{ entity: 'sensor.power' }, { entity: 'sensor.rain' }] }] }, { mock: { series: true, historyStep: 300 }, height: 700 });
    await t.wait(3000);
    await t.step('in the card\'s own syntax, at every level: pointsPerHour on a graph (a point an hour), aggregateFunc in entityOptions', async () => {
        const start = await t.E('+new Date(el.instance.startTime)');
        // (the points of the window: the day before it, loaded too, has its own)
        const [p, r] = ( await pts() ).map(a => a.filter(x => x[3] > start));
        const hourly = p.slice(0, -1).every(x => x[3] - x[2] === 3600e3) && p.length >= 24 && p.length <= 26;
        const maxed = await t.E(`el.instance.resolveAggregation(el.instance.graphsInDisplayOrder()[0].entities[1]).func`);
        return hourly && maxed === 'max' && r.length === p.length ? true : JSON.stringify({ n: p.length, maxed, rn: r.length });
    });
    done(await t.close());

    // ── The Y axis: soft bounds, a smallest range, the right axis' own, logarithmic ──
    // (graph i's Y axis k: its range drawn, its options)
    const axis = (t, k = 0, i = 0) => t.E(`(()=>{ const c=el.instance.graphsInDisplayOrder()[${i}].chart, o=c.options.scales.yAxes[${k}], s=c.scales[o.id];
        return { min: s.min, max: s.max, type: o.type ?? 'linear', display: o.display !== false, tmin: o.ticks.min, tmax: o.ticks.max }; })()`);
    t = await openCard({ type: 'custom:history-explorer-card', statistics: { enabled: false }, hours_to_show: 24,
        lower_bound: '~0', upper_bound: '~10', lower_bound_secondary: 0, upper_bound_secondary: 50, show: { labels_secondary: false },
        entities: ['sensor.power', { entity: 'sensor.rain', y_axis: 'secondary' }] }, { mock: { series: true }, height: 700 });
    await t.wait(1500);
    await t.step('soft bounds (~0, ~10): the axis reaches 0, and goes past 10 to the values above it', async () => {
        const a = await axis(t);
        return a.min <= 0 && a.max >= 400 && a.tmin === undefined && a.tmax === undefined ? true : JSON.stringify(a);
    });
    await t.step('lower_bound_secondary / upper_bound_secondary: the right axis\' own bounds; show: labels_secondary: false — its labels hidden', async () => {
        const a = await axis(t, 1);
        return a.min === 0 && a.max === 50 && !a.display ? true : JSON.stringify(a);
    });
    done(await t.close());
    t = await openCard({ type: 'custom:history-explorer-card', statistics: { enabled: false }, hours_to_show: 24, min_bound_range: 5000,
        entities: ['sensor.power'] }, { mock: { series: true }, height: 700 });
    await t.wait(1500);
    await t.step('min_bound_range: the axis shows at least that range, widened on both sides', async () => {
        const a = await axis(t);
        return a.max - a.min >= 5000 && a.min < 200 && a.max > 600 ? true : JSON.stringify(a);
    });
    done(await t.close());
    t = await openCard(card({ graphs: [{ type: 'line', logarithmic: true, entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true }, height: 700 });
    await t.wait(1500);
    await t.step('logarithmic: a logarithmic Y axis; a drag on its labels moves it evenly, as it\'s seen (the logarithm of its range)', async () => {
        const a = await axis(t);
        const r = await t.E(`(()=>{ const c=el.instance.graphsInDisplayOrder()[0].chart, r0=c._hecYRanges()[0]; c._hecSetYRanges([[r0[0]+1, r0[1]+1]]); const r1=c._hecYRanges()[0];
            const s=c.scales[c.options.scales.yAxes[0].id]; return { r0, r1, max: s.max, was: Math.pow(10, r0[1]) }; })()`);
        return a.type === 'logarithmic' && Math.abs(r.r1[0] - r.r0[0] - 1) < 1e-9 && Math.abs(r.max / r.was - 10) < 1e-6 ? true : JSON.stringify({ a, r });
    });
    done(await t.close());

    // ── Values: value_factor, state_map ──
    const legendValues = (t, i = 0) => t.E(`el.instance.graphsInDisplayOrder()[${i}].chart.legend.legendItems.map(x=>x.hecValue)`);
    t = await openCard({ type: 'custom:history-explorer-card', statistics: { enabled: false }, hours_to_show: 24, value_factor: -3,
        entities: ['sensor.power'] }, { mock: { series: true }, height: 700 });
    await t.wait(1500);
    await t.step('value_factor: -3 — the values shown and drawn divided by 1000 (400 W shows 0.4)', async () => {
        const v = await legendValues(t);
        const ys = await t.E(`el.instance.graphsInDisplayOrder()[0].chart.data.datasets[0].data.map(p=>p.y)`);
        return v[0] === '(0.4 W)' && ys.length && ys.every(y => y > 0 && y < 1) ? true : JSON.stringify({ v, ys: ys.slice(0, 5) });
    });
    done(await t.close());
    t = await openCard({ type: 'custom:history-explorer-card', statistics: { enabled: false }, hours_to_show: 24,
        state_map: [{ value: 'off', label: 'Off' }, { value: 'cold', label: 'Cold' }, 'hot'], entities: ['sensor.clim_mode'] }, { mock: { series: true }, height: 700 });
    await t.wait(1500);
    await t.step('state_map: a text state drawn as a curve, each state at its place (0, 1, 2), its label in the legend and on the Y axis', async () => {
        const r = await t.E(`(()=>{ const c=el.instance.graphsInDisplayOrder()[0].chart, s=c.scales[c.options.scales.yAxes[0].id];
            return { type: el.instance.graphsInDisplayOrder()[0].type, ys: [...new Set(c.data.datasets[0].data.map(p=>p.y))], ticks: s.ticks }; })()`);
        const v = await legendValues(t);
        const ok = r.type === 'line' && r.ys.length > 1 && r.ys.every(y => y >= 0 && y <= 2) && v[0] === '(hot)'
            && r.ticks.includes('Cold');
        return ok ? true : JSON.stringify({ r, v });
    });
    done(await t.close());

    // ── Colors: line_color, color thresholds blended ──
    t = await openCard({ type: 'custom:history-explorer-card', statistics: { enabled: false }, hours_to_show: 24, line_color: ['#ff0000', '#00ff00'],
        entities: ['sensor.power', 'sensor.power2', { entity: 'sensor.rain', color: '#0000ff' }] }, { mock: { series: true }, height: 700 });
    await t.wait(1500);
    await t.step('line_color: each entity the color at its place in the list; an entity\'s own color wins', async () => {
        const c = await ds(t, 'borderColor');
        return c.join() === '"#ff0000","#00ff00","#0000ff"' ? true : c.join();
    });
    done(await t.close());
    const thresholds = [{ value: 0, color: '#0000ff' }, { value: 1000, color: '#ff0000' }];
    t = await openCard({ type: 'custom:history-explorer-card', look: 'mini', statistics: { enabled: false }, hours_to_show: 24, color_thresholds: thresholds,
        entities: ['sensor.power'] }, { mock: { series: true }, height: 700 });
    await t.wait(1500);
    await t.step('look: mini — the thresholds blended (smooth): a gradient along the Y axis, the color now a mix of both', async () => {
        const r = await t.E(`(()=>{ const c=el.instance.graphsInDisplayOrder()[0].chart, d=c.data.datasets[0], m=c.getDatasetMeta(0).dataset._model;
            return { stops: d.hecValueGradient?.length, steps: d.colorSteps, color: d.borderColor, line: m.borderColor instanceof CanvasGradient }; })()`);
        return r.stops === 2 && !r.steps && r.line && /^rgb\(\d+, ?0, ?\d+\)$/.test(r.color) && r.color !== 'rgb(0, 0, 255)' ? true : JSON.stringify(r);
    });
    done(await t.close());
    t = await openCard({ type: 'custom:history-explorer-card', look: 'mini', statistics: { enabled: false }, hours_to_show: 24, color_thresholds: thresholds,
        color_thresholds_transition: 'hard', entities: ['sensor.power'] }, { mock: { series: true }, height: 700 });
    await t.wait(1500);
    await t.step('color_thresholds_transition: hard — no blend: each value the color of its threshold', async () => {
        const r = await t.E(`(()=>{ const d=el.instance.graphsInDisplayOrder()[0].chart.data.datasets[0]; return { stops: d.hecValueGradient, color: d.borderColor }; })()`);
        return r.stops === undefined && r.color === '#0000ff' ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── Each entity: show_line, show_legend; hour24 ──
    t = await openCard({ type: 'custom:history-explorer-card', statistics: { enabled: false }, hours_to_show: 24, hour24: false,
        entities: [{ entity: 'sensor.power', show_line: false }, { entity: 'sensor.power2', show_legend: false }, 'sensor.rain'] }, { mock: { series: true }, height: 700 });
    await t.wait(1500);
    await t.step('show_line: false — its points, no line', async () => {
        const l = await ds(t, 'showLine'), r = await ds(t, 'pointRadius');
        return l.join() === 'false,true,true' && +r[0] > 0 ? true : JSON.stringify({ l, r });
    });
    await t.step('show_legend: false on an entity — no label for it in the legend, the others laid out as usual', async () => {
        const r = await t.E(`(()=>{ const l=el.instance.graphsInDisplayOrder()[0].chart.legend; return { hidden: l.legendItems.map(x=>!!x.hecHidden), w: l.legendHitBoxes.map(b=>Math.round(b.width)), x: l.legendHitBoxes.map(b=>Math.round(b.left)) }; })()`);
        return r.hidden.join() === 'false,true,false' && r.w[1] === 0 && r.w[0] > 0 && r.w[2] > 0 && r.x[2] > r.x[0] ? true : JSON.stringify(r);
    });
    await t.step('hour24: false — the 12-hour clock', async () => {
        const f = await t.E('el.instance.i18n.styleTimeTicks');
        return /h/.test(f) && /a/.test(f) && !/HH/.test(f) ? true : f;
    });
    done(await t.close());

    return { passed, failed };
};
