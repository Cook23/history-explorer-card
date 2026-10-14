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

    return { passed, failed };
};
