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
    const values = (t, i = 0) => t.E(`(()=>{ const el2=el.instance._allGraphsInDisplayOrder()[${i}].chart._hecValuesEl; if(!el2) return null;
        return { states: [...el2.querySelectorAll('.hec-state')].map(s=>s.dataset.key.split('.')[1]+'='+s.textContent.trim()),
                 stats: [...el2.querySelectorAll('.hec-stats')].map(r=>r.dataset.key.split('.')[1]+':'+[...r.querySelectorAll('.hec-stat')].map(c=>c.dataset.stat+'='+c.children[1].textContent).join(',')) }; })()`);
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

    // (a timeline's and an arrowline's names, in their label column)
    t = await openCard(card({ graphs: [{ type: 'timeline', entities: [{ entity: 'binary_sensor.a' }, { entity: 'binary_sensor.b' }] },
        { type: 'arrowline', entities: [{ entity: 'sensor.wind' }] }] }), { mock: { series: true }, height: 700 });
    await t.wait(1500);
    await t.step('the names of a timeline\'s and an arrowline\'s rows drawn beside them', async () => {
        const n = await t.E(`el.instance._allGraphsInDisplayOrder().map(g=>{ const c=g.chart; const a=c.chartArea; const r=window.devicePixelRatio||1;
            const d=c.ctx.getImageData(0, a.top*r, Math.max(1,(a.left-4)*r), (a.bottom-a.top)*r).data; let k=0; for(let i=3;i<d.length;i+=4) if(d[i]>0) k++; return g.type+':'+k; })`);
        return n.every(x => Number(x.split(':')[1]) > 100) ? true : n.join(' ');
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

    // ── A narrow card: the values as mini-graph-card keeps them ──
    t = await openCard(card({ look: 'mini', graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power2' }] }] }), { mock: { series: true }, height: 700 });
    await t.wait(1500);
    // Each value now: its font size (px), its row (its top, rounded); the statistics' font size
    const layout = () => t.E(`[...el.querySelectorAll('.hec-state')].map(e=>Math.round(parseFloat(getComputedStyle(e).fontSize))+'@'+Math.round(e.getBoundingClientRect().top))
        .concat(Math.round(parseFloat(getComputedStyle(el.querySelector('.hec-stats')).fontSize)))`);
    const widthOf = async w => { await t.E(`(()=>{ document.body.style.width='${w}px'; document.getElementById('host').style.width='${w}px'; })()`); await t.wait(1500); return layout(); };
    await t.step('a narrow card: the first value large, the next one small on its right, the statistics a little smaller; wide again: as before', async () => {
        const wide = await layout(), narrow = await widthOf(200), back = await widthOf(1000);
        const size = x => +x.split('@')[0];
        return size(wide[0]) === size(wide[1]) && size(narrow[1]) < size(narrow[0]) * 0.7 && narrow[2] < wide[2] && JSON.stringify(back) === JSON.stringify(wide)
            ? true : JSON.stringify({ wide, narrow, back });
    });
    done(await t.close());

    // ── A click on a value: the entity's dialog (the info panel, when on) ──
    t = await openCard(card({ showState: true, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.rain' }] }] }), { mock: { series: true }, height: 700 });
    await t.wait(1000);
    await t.E(`window.__mi=[]; document.addEventListener('hass-more-info', e => __mi.push(e.detail.entityId))`);
    const mi = () => t.E('__mi.splice(0)');
    // (a legend label's point, at fraction f of its width; its value's middle — before its mark)
    const labelAt = (i, f) => t.E(`(()=>{ const c=graphAt(0).chart, b=c.legend.legendHitBoxes[${i}], r=c.canvas.getBoundingClientRect(); return { x: r.left+b.left+b.width*${f}, y: r.top+b.top+b.height/2 }; })()`);
    const valueOf = i => t.E(`(()=>{ const c=graphAt(0).chart, b=c.legend.legendHitBoxes[${i}], it=c.legend.legendItems[${i}], r=c.canvas.getBoundingClientRect(), ctx=c.ctx;
        ctx.save(); ctx.font=c._hecLegendFont(); const m=it.hecMark?ctx.measureText(' '+it.hecMark).width:0, v=ctx.measureText(it.hecValue).width; ctx.restore();
        return { x: r.left+b.left+b.width-m-v/2, y: r.top+b.top+b.height/2 }; })()`);
    const hidden = i => t.E(`!!graphAt(0).chart.getDatasetMeta(${i}).hidden`);
    await t.step('a click on a legend label\'s value: its entity\'s dialog, the curve still shown; on its name: the curve hidden', async () => {
        const v = await valueOf(1); await t.page.mouse.click(v.x, v.y); await t.wait(500);
        const onValue = await mi(), h1 = await hidden(1);
        const n = await labelAt(1, 0.4); await t.page.mouse.click(n.x, n.y); await t.wait(500);
        const onName = await mi(), h2 = await hidden(1);
        return onValue.join() === 'sensor.rain' && !h1 && !onName.length && h2 ? true : JSON.stringify({ onValue, h1, onName, h2 });
    });
    await t.step('a curve hidden: its name struck through, not its value', async () => {
        // (the share of the label's middle row inked, over its name and over its value)
        const inked = await t.E(`(()=>{ const c=graphAt(0).chart, L=c.legend, b=L.legendHitBoxes[1], it=L.legendItems[1], k=c.canvas.width/c.canvas.getBoundingClientRect().width, ctx=c.ctx;
            ctx.save(); ctx.font=c._hecLegendFont(); const nw=ctx.measureText(it.text).width, tw=ctx.measureText(legendText(it)).width, vw=ctx.measureText(it.hecValue).width; ctx.restore();
            const left=b.left+b.width-tw, y=Math.round((b.top+L.options.labels.fontSize/2)*k);
            const share=(x0,x1)=>{ const d=c.ctx.getImageData(Math.round(x0*k), y, Math.max(1,Math.round((x1-x0)*k)), 1).data; let n=0; for(let i=0;i<d.length;i+=4) if(d[i+3]>100 && d[i]+d[i+1]+d[i+2]<500) n++; return n/(d.length/4); };
            const vl=left+nw+ctx.measureText(' ').width;
            return { name: share(left+2, left+nw-2), value: share(vl+3, vl+vw-2) }; })()`);
        return inked.name > 0.9 && inked.value < 0.6 ? true : JSON.stringify(inked);
    });
    await t.step('a click on a value over the graph: its entity\'s dialog; the Info of a curve\'s menu: the same', async () => {
        await t.E(`el.querySelector('.hec-state[data-key="sensor.power"]').click()`); await t.wait(300);
        const fromValue = await mi();
        const p = await labelAt(0, 0.3); await t.longPress(p);
        const shown = await t.E(`(()=>{ const i=el.querySelector('#et_0_info'); return !!i && i.style.display!=='none'; })()`);
        await t.E(`el.querySelector('#et_0_info').click()`); await t.wait(300);
        const fromMenu = await mi();
        return fromValue.join() === 'sensor.power' && shown && fromMenu.join() === 'sensor.power' ? true : JSON.stringify({ fromValue, shown, fromMenu });
    });
    done(await t.close());

    // ── A hover: the value it's on in its curve's place, texts cut shown in full, the Y labels near it opaque ──
    t = await openCard(card({ look: 'mini', graphs: [{ type: 'line', entities: [{ entity: 'sensor.power', name: 'Rafales du vent mesurées au sommet du mât' },
        { entity: 'sensor.power2', name: 'Vitesse moyenne du vent mesurée au sommet du mât' }] }] }), { mock: { series: true }, height: 700 });
    await t.E(`(()=>{ document.body.style.width='200px'; document.getElementById('host').style.width='200px'; })()`); await t.wait(1500);
    const first = () => t.E(`(()=>{ const s=graphAt(0).chart._hecValuesEl.querySelector('.hec-state[data-curve="0"]'); return { text: s.textContent, time: !!s.querySelector('.hec-time') }; })()`);
    await t.step('a hover on a curve: its value there, with its time, in place of its value now; leaving it: the value now back', async () => {
        const now = await first();
        const p = await t.E(`(()=>{ const c=graphAt(0).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect(); const v=c.getDatasetMeta(0).data.map(p=>p._view).filter(v=>!v.skip&&!v.hecVirtual&&v.x>A.left+(A.right-A.left)*0.4&&v.x<A.right-10)[0]; return {x:r.left+v.x, y:r.top+v.y}; })()`);
        await t.page.mouse.move(p.x, p.y - 20, { steps: 3 }); await t.page.mouse.move(p.x, p.y, { steps: 4 }); await t.wait(300);
        const hovered = await first();
        await t.page.mouse.move(5, 5, { steps: 3 }); await t.wait(300);
        const back = await first();
        return !now.time && hovered.time && hovered.text !== now.text && back.text === now.text && !back.time ? true : JSON.stringify({ now, hovered, back });
    });
    await t.step('a hover on a statistics name cut: shown in full in place', async () => {
        const n = await t.E(`(()=>{ const c=[...graphAt(0).chart._hecValuesEl.querySelectorAll('.hec-cut')].find(e=>e.scrollWidth>e.clientWidth&&!e.classList.contains('hec-state')); if(!c) return null; const r=c.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2, text:c.textContent}; })()`);
        if( !n ) return 'no name cut';
        await t.page.mouse.move(n.x, n.y, { steps: 3 }); await t.wait(300);
        const shown = await t.E('reveal()'); await t.page.mouse.move(5, 5); await t.wait(300);
        return shown === n.text ? true : JSON.stringify({ n, shown });
    });
    await t.step('the pointer near the Y labels inside the plot: their boxes opaque; away: as before', async () => {
        const col = await t.E(`(()=>{ const c=graphAt(0).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect(), k=c._hecInsideLabelColumns('mouse').find(k=>k.side==='left'); return {x:r.left+k.left+4, y:r.top+(A.top+A.bottom)/2}; })()`);
        await t.page.mouse.move(col.x, col.y, { steps: 3 }); await t.wait(300);
        const near = await t.E(`[graphAt(0).chart._hecLabelsHovered, graphAt(0).chart.options.scales.yAxes[0].ticks.hecBackdrop.hoverColor]`);
        await t.page.mouse.move(5, 5, { steps: 3 }); await t.wait(300);
        const away = await t.E('graphAt(0).chart._hecLabelsHovered');
        return near[0] === 'left' && /,1\)$/.test(near[1]) && !away ? true : JSON.stringify({ near, away });
    });
    done(await t.close());

    t = await openCard(card({ graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }), { mock: { series: true }, height: 700 });
    await t.step('the pointer on a legend label\'s value: the hand cursor; on its name: the move cursor', async () => {
        const at = f => t.E(`(()=>{ const c=graphAt(0).chart, b=c.legend.legendHitBoxes[0], r=c.canvas.getBoundingClientRect(); return { x: r.left+b.left+b.width*${f}, y: r.top+b.top+b.height/2 }; })()`);
        const cursor = async p => { await t.page.mouse.move(p.x, p.y, { steps: 3 }); await t.wait(200); return t.E('graphAt(0).chart.canvas.style.cursor'); };
        const onValue = await cursor(await at(0.95)), onName = await cursor(await at(0.3));
        return onValue === 'pointer' && onName === 'move' ? true : JSON.stringify({ onValue, onName });
    });
    done(await t.close());

    return { passed, failed };
};
