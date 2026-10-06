// What mini-graph-card shows, on the card's graphs: each curve's value now (showState), its
// minimum, average and maximum over the window shown (showStats), the grid hidden
// (showGrid), the Y labels inside the plot (yLabels), a fill fading out (fill: fade), and
// all of it at once with look: mini — the card's own options still winning
const { openCard } = require('./lib.cjs');

const card = (o) => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, ...o });

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };
    // The values over graph i: the states shown, then each stats row (its entity: stat=value)
    const values = (t, i = 0) => t.E(`(()=>{ const el2=el.querySelector('#hv-'+el.instance._allGraphsInDisplayOrder()[${i}].id); if(!el2) return null;
        return { states: [...el2.querySelectorAll('.hec-state')].map(s=>s.dataset.entity.split('.')[1]+'='+s.textContent.trim()),
                 stats: [...el2.querySelectorAll('.hec-stats')].map(r=>r.dataset.entity.split('.')[1]+':'+[...r.querySelectorAll('.hec-stat')].map(c=>c.dataset.stat+'='+c.children[1].textContent).join(',')) }; })()`);
    const num = (s, k) => Number((s.match(new RegExp(k + '=(-?[\\d.]+)')) || [])[1]);

    // ── The Y labels drawn (by default, beside the plot) ──
    // (the pixels drawn where the labels go, right beside the plot of graph 0 — not the
    // unit's title, further left)
    const labelInk = t => t.E(`(()=>{ const c=el.instance.graphs[0].chart; const a=c.chartArea; const r=window.devicePixelRatio||1;
        const d=c.ctx.getImageData((a.left-35)*r, a.top*r, 30*r, (a.bottom-a.top)*r).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>0) n++; return n; })()`);
    let t = await openCard(card({ graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true }, height: 700 });
    await t.wait(1500);
    await t.step('by default the Y labels are drawn beside the plot', async () => {
        const n = await labelInk(t);
        return n > 50 ? true : 'pixels drawn in the label area: ' + n;
    });
    done(await t.close());

    // ── showState, showStats at every level ──
    t = await openCard(card({ showState: true, graphs: [
        { type: 'line', showStats: ['min', 'max'], entities: [{ entity: 'sensor.rain' }, { entity: 'sensor.power', showStats: true }, { entity: 'sensor.power2', showStats: false, showState: false }] },
        { type: 'line', entities: [{ entity: 'sensor.tank' }] }] }), { mock: { series: true }, height: 1100 });
    await t.wait(1500);
    await t.step('showState: each curve\'s value now, in its unit; off on one curve', async () => {
        const v = await values(t);
        return JSON.stringify(v.states) === JSON.stringify(['rain=4 mm', 'power=400 W']) ? true : JSON.stringify(v);
    });
    await t.step('showStats: min and max (the graph\'s), all three (the curve\'s own), none (off on it)', async () => {
        const v = await values(t);
        const r = v.stats.join(' | ');
        const ok = v.stats.length === 2 && /^rain:min=[\d.]+ mm,max=[\d.]+ mm \| power:min=[\d.]+ W,average=[\d.]+ W,max=[\d.]+ W$/.test(r)
            && Math.abs(num(v.stats[0], 'min') - 2) < 0.1 && Math.abs(num(v.stats[0], 'max') - 6) < 0.1
            && Math.abs(num(v.stats[1], 'average') - 400) < 20;
        return ok ? true : r;
    });
    await t.step('the minimum and the maximum with their time', async () => {
        const n = await t.E(`[...el.querySelectorAll('.hec-stat[data-stat="min"], .hec-stat[data-stat="max"]')].filter(c=>/\\d{1,2}:\\d\\d/.test(c.children[2]?.textContent||'')).length`);
        return n === 4 ? true : 'times: ' + n;
    });
    await t.step('only the card\'s showState on the other graph, no stats there', async () => {
        const v = await values(t, 1);
        return JSON.stringify(v) === JSON.stringify({ states: ['tank=800 L'], stats: [] }) ? true : JSON.stringify(v);
    });
    await t.step('a curve hidden from its legend: its values gone', async () => {
        const p = await t.E('legendPt(0,0)'); await t.page.mouse.click(p.x, p.y); await t.wait(600);
        const v = await values(t); await t.page.mouse.click(p.x, p.y); await t.wait(600);
        return !v.states.some(s => s.startsWith('rain')) && !v.stats.some(s => s.startsWith('rain')) ? true : JSON.stringify(v);
    });
    done(await t.close());

    // ── Recomputed for the window shown ──
    t = await openCard(card({ graphs: [{ type: 'line', entities: [{ entity: 'sensor.energy', type: 'line', showStats: true }] }] }), { mock: { series: true }, height: 700 });
    await t.wait(1500);
    await t.step('the window moved back a day: the statistics are the ones of that day', async () => {
        const a = (await values(t)).stats[0];
        await t.E(`el.querySelector('#b1_0').click()`); await t.wait(1500);
        const b = (await values(t)).stats[0];
        return num(b, 'max') < num(a, 'min') ? true : a + ' -> ' + b;
    });
    done(await t.close());

    // ── The grid, the Y labels, the fill ──
    t = await openCard(card({ graphs: [{ type: 'line', showGrid: false, yLabels: 'inside', entities: [{ entity: 'sensor.rain', fill: 'fade' }, { entity: 'sensor.power' }] }] }), { mock: { series: true }, height: 700 });
    await t.wait(1500);
    await t.step('showGrid false: no grid; yLabels inside: the labels in the plot, which takes the whole width; fill fade: a gradient', async () => {
        const r = await t.E(`(()=>{ const c=el.instance.graphs[0].chart; const y=c.scales['y-axis-0'];
            return { grid: [c.options.scales.xAxes[0].gridLines.color, c.options.scales.yAxes[0].gridLines.color].join(), mirror: c.options.scales.yAxes[0].ticks.mirror, width: y.width,
                     fade: c.data.datasets[0].backgroundColor instanceof CanvasGradient, other: typeof c.data.datasets[1].backgroundColor }; })()`);
        return r.grid === 'rgba(0,0,0,0),rgba(0,0,0,0)' && r.mirror === true && r.width === 0 && r.fade && r.other === 'string' ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── look: mini ──
    t = await openCard(card({ look: 'mini', showGrid: true, graphs: [{ type: 'line', title: 'Pluie', entities: [{ entity: 'sensor.rain', color: 'orange' }] }] }), { mock: { series: true }, height: 700 });
    await t.wait(1500);
    await t.step('look: mini — no header, toolbar nor selector; the value now, min and max; time labels hidden; Y labels inside; fading fill; the card\'s own showGrid kept', async () => {
        const r = await t.E(`(()=>{ const c=el.instance.graphs[0].chart;
            return { header: el.querySelector('ha-card').getAttribute('header'), toolbar: !!el.querySelector('#b1_0'), selector: !!el.querySelector('#b7_0'),
                     time: c.options.scales.xAxes[0].ticks.fontColor, mirror: c.options.scales.yAxes[0].ticks.mirror,
                     fade: c.data.datasets[0].backgroundColor instanceof CanvasGradient, grid: c.options.scales.yAxes[0].gridLines.color }; })()`);
        const v = await values(t);
        const ok = !r.header && !r.toolbar && !r.selector && r.time === 'rgba(0,0,0,0)' && r.mirror && r.fade && r.grid !== 'rgba(0,0,0,0)'
            && JSON.stringify(v.states) === JSON.stringify(['rain=4 mm']) && /^rain:min=[\d.]+ mm,max=[\d.]+ mm$/.test(v.stats[0]);
        return ok ? true : JSON.stringify({ r, v });
    });
    done(await t.close());

    return { passed, failed };
};
