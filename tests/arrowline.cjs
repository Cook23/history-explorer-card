// Arrowline graphs: the arrows turn by value / period of a full turn (circular), 360 by default
const { openCard } = require('./lib.cjs');

const card = graphs => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24h', statistics: { enabled: false },
    graphs: graphs.map(e => ({ type: 'arrowline', entities: [e] })) });

module.exports = async function()
{
    let passed = 0, failed = 0;
    const run = async (graphs, cases) => {
        const t = await openCard(card(graphs));
        // Angles (degrees, in [0, 360), the way up being 0) the arrows of graph gi are drawn at
        // (rotate(0) calls aren't arrows)
        const drawn = gi => t.E(`(()=>{ const c=graphAt(${gi}).chart; const ctx=c.ctx; const o=ctx.rotate; const r=new Set();
            ctx.rotate=function(a){ if(a) r.add(Math.round(((a*180/Math.PI-180)%360+360)%360)); return o.call(this,a); };
            c.render(0); ctx.rotate=o; return [...r]; })()`);
        for( const [gi, want, what] of cases )
            await t.step(`arrows: ${what}`, async () => {
                const a = await drawn(gi);
                return a.length >= 1 && a.every(x => x === want) ? true : 'drawn at ' + JSON.stringify(a);
            });
        const r = await t.close(); passed += r.passed; failed += r.failed;
    };
    await run([{ entity: 'sensor.wind' }, { entity: 'sensor.wind_rad', circular: '2pi' }, { entity: 'sensor.wind_grad', circular: 400 }], [
        [0, 350, 'degrees (unit °, auto): 350 is 350°'],
        [1, 90, 'radians (circular: 2pi): 1.5708 is 90°'],
        [2, 90, 'grads (circular: 400): 100 is 90°'] ]);
    await run([{ entity: 'sensor.wind_rad' }, { entity: 'sensor.wind', circular: false }], [
        [0, 2, 'no circular, unit rad: a full turn is 360 (1.5708 is 1.57°)'],
        [1, 350, 'circular: false: a full turn is still 360'] ]);
    // A week of a value a minute: a block at most per pixel column, each column's middle
    // showing the value in force there — the arrow drawn there the same as without it
    {
        const t = await openCard({ ...card([{ entity: 'sensor.wind' }]), defaultTimeRange: '7d' }, { mock: { series: true, historyStep: 60 } });
        await t.wait(4000);
        await t.step('a week of a value a minute: a block at most per pixel column, none of the window without one', async () => {
            const r = await t.E(`(()=>{ const c=graphAt(0).chart, d=c.data.datasets[0].data, w=c.hecPlotWidth(), t0=+new Date(el.instance.startTime), t1=+new Date(el.instance.endTime);
                const gaps=d.slice(1).filter((x,k)=>+new Date(x[0])!==+new Date(d[k][1])).length;
                return { n: d.length, w, gaps, from: +new Date(d[0][0]) - t0 }; })()`);
            return r.n > 50 && r.n <= r.w + 2 && r.gaps === 0 && r.from <= 0 ? true : JSON.stringify(r);
        });
        await t.step('blocks narrower than a column: at each column\'s middle, the value in force there — the one its arrow shows', async () => {
            const r = await t.E(`(()=>{ const t0=Date.parse('2026-01-01T00:00:00Z'), t1=t0+7*86400e3, w=500, cw=(t1-t0)/w, s=[];
                for( let t=t0, k=0; t<t1; t+=60e3, k++ ) s.push([t, t+60e3, String(k)]);
                const o=el.instance._arrowColumns(s, t0, t1, w), at=(a,m)=>a.find(x=>+x[0]<=m && m<+x[1])?.[2];
                let wrong=0; for( let i=0; i<w; i++ ){ const m=t0+(i+0.5)*cw; if( at(o,m)!==at(s,m) ) wrong++; }
                return { n: o.length, wrong }; })()`);
            return r.n <= 501 && r.wrong === 0 ? true : JSON.stringify(r);
        });
        const r = await t.close(); passed += r.passed; failed += r.failed;
    }
    // ── The arrows' length (arrowLength, arrowMax) ──
    {
        const t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24h', statistics: { enabled: false }, graphs: [
            { type: 'arrowline', entities: [{ entity: 'sensor.wind' }] },
            { type: 'arrowline', entities: [{ entity: 'sensor.wind', arrowLength: 50 }] },
            { type: 'arrowline', entities: [{ entity: 'sensor.wind', arrowLength: 'sensor.power' }] },
            { type: 'arrowline', arrowMax: 1200, entities: [{ entity: 'sensor.wind', arrowLength: 'sensor.power' }] },
            { type: 'arrowline', arrowMax: '~2400', entities: [{ entity: 'sensor.wind', arrowLength: 'sensor.power' }] },
            { type: 'arrowline', entities: [{ entity: 'sensor.wind', arrowLength: 'sensor.nothing_here' }] },
            { type: 'arrowline', arrowLength: 0, entities: [{ entity: 'sensor.wind' }] },
            { type: 'arrowline', entities: [{ entity: 'sensor.wind', color: { entity: 'sensor.power', 0: '#0000ff', 400: '#ff0000' },
                                              fill: { entity: 'sensor.power', 0: false, 400: 'rgba(255,0,0,0.25)' } }] },
        ] }, { mock: { series: true }, height: 1600 });
        await t.wait(1500);
        // (how graph gi's arrows are drawn: their scales — each arrow's length, 1 its whole
        // length —, the dashed ones, the points)
        const drawn = gi => t.E(`(()=>{ const c=graphAt(${gi}).chart, ctx=c.ctx, r={ k: [], dashed: 0, points: 0 };
            const o={ scale: ctx.scale, setLineDash: ctx.setLineDash, arc: ctx.arc };
            ctx.scale=function(a,b){ r.k.push(Math.round(a*100)/100); return o.scale.call(this,a,b); };
            ctx.setLineDash=function(d){ if(d.length) r.dashed++; return o.setLineDash.call(this,d); };
            ctx.arc=function(...a){ r.points++; return o.arc.apply(this,a); };
            c.render(0); Object.assign(ctx, o); delete ctx.scale; delete ctx.setLineDash; delete ctx.arc; return r; })()`);
        await t.step('arrowLength unset: every arrow its whole length', async () => {
            const r = await drawn(0);
            return r.k.length > 5 && r.k.every(k => k === 1) && !r.dashed && !r.points ? true : JSON.stringify(r);
        });
        await t.step('arrowLength: 50 — every arrow half its whole length; 0 (on the graph): a point each', async () => {
            const a = await drawn(1), b = await drawn(6);
            return a.k.length > 5 && a.k.every(k => k === 0.5) && b.points > 5 && !b.k.length ? true : JSON.stringify({ a, b });
        });
        await t.step('arrowLength: an entity — each arrow its value over the scale chosen automatically (its largest value around the window: the whole length)', async () => {
            const r = await drawn(2), m = await t.E(`graphAt(2).chart.data.datasets[0].arrowLength`);
            return r.k.length > 5 && Math.max(...r.k) > 0.9 && Math.min(...r.k) < 0.5 && r.k.every(k => k > 0 && k <= 1) && m.max >= 590 && m.max <= 700 && m.unit === 'W' ? true : JSON.stringify({ r, m });
        });
        await t.step('arrowMax: 1200 — the whole length at 1200, no automatic scale; ~2400: at least 2400', async () => {
            const a = await drawn(3), m3 = await t.E(`graphAt(3).chart.data.datasets[0].arrowLength.max`), m4 = await t.E(`graphAt(4).chart.data.datasets[0].arrowLength.max`);
            return m3 === 1200 && m4 >= 2400 && a.k.every(k => k <= 0.51) ? true : JSON.stringify({ a, m3, m4 });
        });
        await t.step('a negative value: drawn by its absolute value, signed in the tooltip', async () => {
            await t.E(`(()=>{ for( const b of graphAt(3).chart.data.datasets[0].data ) b[3] = -600; })()`);
            const a = await drawn(3), tip = await t.E(`el.instance._tooltipValue('arrowline', graphAt(3).chart.data.datasets[0], { index: 5 })`);
            return a.k.length > 5 && a.k.every(k => k === 0.5) && / · -600 W$/.test(tip) ? true : JSON.stringify({ a, tip });
        });
        await t.step('color and fill read indirectly: each arrow the color of the time it shows, the band under it its own fill', async () => {
            const r = await t.E(`(()=>{ const ds=graphAt(7).chart.data.datasets[0]; return { c: [...new Set(ds.arrowColors ?? [])], f: [...new Set(ds.arrowBackgrounds ?? [])] }; })()`);
            return r.c.length === 2 && r.c.includes('#ff0000') && r.c.includes('#0000ff') && r.f.length >= 2 ? true : JSON.stringify(r);
        });
        await t.step('arrowLength from an entity without a value there: each arrow its whole length, dashed', async () => {
            const r = await drawn(5);
            return r.dashed > 5 && r.k.every(k => k === 1) ? true : JSON.stringify(r);
        });
        await t.step('the tooltip: the direction, then the length\'s value, signed, in its unit', async () => {
            const tip = await t.E(`(()=>{ const ds=graphAt(2).chart.data.datasets[0]; return el.instance._tooltipValue('arrowline', ds, { index: 5 }) + ' | ' + ds.data[5][3]; })()`);
            const [text, v] = tip.split(' | ');
            return new RegExp('^-?[\\d.]+ ° · ' + v.replace('.', '\\.') + ' W$').test(text) ? true : tip;
        });
        const r = await t.close(); passed += r.passed; failed += r.failed;
    }
    // ── fill: solid ignored on an arrowline (it would hide the arrows): its default instead ──
    {
        const t = await openCard(card([{ entity: 'sensor.wind', fill: 'solid' }, { entity: 'sensor.wind', color: '#ff0000', fill: 'solid' }]));
        await t.step('fill: solid ignored on an arrowline — the arrows\' band light (its color not defined), none (its color defined)', async () => {
            const r = await t.E(`[0,1].map(i=>{ const d=graphAt(i).chart.data.datasets[0]; return [d.arrowColor, d.arrowBackground]; })`);
            const light = c => /rgba\(.*0\.15\)/.test(c ?? '');
            return light(r[0][1]) && r[0][1] !== r[0][0] && /rgba\(0,\s*0,\s*0,\s*0\)/.test(r[1][1]) ? true : JSON.stringify(r);
        });
        const r = await t.close(); passed += r.passed; failed += r.failed;
    }
    // ── fill: fade on an arrowline: the band fading out, not light ──
    {
        const t = await openCard(card([{ entity: 'sensor.wind', fill: 'fade' }, { entity: 'sensor.wind', fill: { 0: 'fade', 200: 'light' } }]), { mock: { series: true } });
        await t.wait(800);
        await t.step('fill: fade on an arrowline — the band fading out (arrowFade), each block\'s too when it\'s read indirectly', async () => {
            const r = await t.E(`[graphAt(0).chart.data.datasets[0].arrowFade, (graphAt(1).chart.data.datasets[0].arrowBackgrounds ?? []).some(f => typeof f === 'object' && f.fade)]`);
            return typeof r[0] === 'string' && r[1] === true ? true : JSON.stringify(r);
        });
        const r = await t.close(); passed += r.passed; failed += r.failed;
    }
    return { passed, failed };
};
