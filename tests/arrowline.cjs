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
        await t.step('values narrower than a column: a row a column — their circular mean, weighted by how long each lasts, with their lowest and highest around it (350° and 10° each a minute, 20-minute columns: 0°, −10°, +10°)', async () => {
            const r = await t.E(`(()=>{ const t0=Date.parse('2026-01-01T00:00:00Z'), t1=t0+7*86400e3, data=[];
                for( let t=t0, k=0; t<t1; t+=60e3, k++ ) data.push({ last_changed: t, state: String(k % 2 ? 10 : 350) });
                const o=el.instance._arrowColumns({ entity: 'sensor.wind' }, data, undefined, { start: t0, end: t1, now: t1 }, 504);
                const d=v=>Math.min(Math.abs(v), Math.abs(360-v));
                return { n: o.length, mean: Math.max(...o.map(x=>d(x[2]))), lo: Math.max(...o.map(x=>Math.abs(x[4].lo+10))), hi: Math.max(...o.map(x=>Math.abs(x[4].hi-10))) }; })()`);
            return r.n === 504 && r.mean < 1e-6 && r.lo < 1e-6 && r.hi < 1e-6 ? true : JSON.stringify(r);
        });
        await t.step('an entity that isn\'t circular (circular: false): a number\'s mean, lowest and highest — 350 and 10: 180, 10, 350; circular: 400 (grads) — 390 and 10: 0, in its own period', async () => {
            const r = await t.E(`(()=>{ const t0=Date.parse('2026-01-01T00:00:00Z'), t1=t0+7*86400e3, mk=(a,b)=>{ const d=[]; for( let t=t0, k=0; t<t1; t+=60e3, k++ ) d.push({ last_changed: t, state: String(k % 2 ? b : a) }); return d; };
                const w={ start: t0, end: t1, now: t1 }, I=el.instance;
                const p=I._arrowColumns({ entity: 'sensor.wind', circular: false }, mk(350, 10), undefined, w, 504)[3];
                const g=I._arrowColumns({ entity: 'sensor.wind_grad', circular: 400 }, mk(390, 10), undefined, w, 504)[3];
                return { plain: [p[2], p[2]+p[4].lo, p[2]+p[4].hi].map(v=>Math.round(v*1000)/1000), grads: Math.round(Math.min(g[2], 400-g[2])*1000)/1000 }; })()`);
            return JSON.stringify(r.plain) === '[180,10,350]' && r.grads === 0 ? true : JSON.stringify(r);
        });
        await t.step('a value alone over several columns: one row, as long as it lasts (its own, as the tooltip shows it)', async () => {
            const r = await t.E(`(()=>{ const t0=Date.parse('2026-01-01T00:00:00Z'), t1=t0+86400e3, h=3600e3;
                const data=[{ last_changed: t0, state: '90' }, { last_changed: t0+6*h, state: '180' }, { last_changed: t0+6*h+60e3, state: '270' }];
                const o=el.instance._arrowColumns({ entity: 'sensor.wind' }, data, undefined, { start: t0, end: t1, now: t1 }, 480);
                return o.map(x=>[(x[0]-t0)/60e3, (x[1]-t0)/60e3, Math.round(x[2])]); })()`);
            // (480 columns of 3 min: 90 alone to 6 h; the column of 6 h — 180 a minute, then 270 —, one row; 270 alone after it)
            const s = JSON.stringify(r);
            return r.length === 3 && s.startsWith('[[0,360,90],[360,363,') && JSON.stringify(r[2]) === '[363,1440,270]' ? true : s;
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
        await t.step('arrowLength unset: every arrow 80 % of its whole length', async () => {
            const r = await drawn(0);
            return r.k.length > 5 && r.k.every(k => k === 0.8) && !r.dashed && !r.points ? true : JSON.stringify(r);
        });
        await t.step('arrowLength: 50 — every arrow half its whole length; 0 (on the graph): a point each', async () => {
            const a = await drawn(1), b = await drawn(6);
            return a.k.length > 5 && a.k.every(k => k === 0.5) && b.points > 5 && !b.k.length ? true : JSON.stringify({ a, b });
        });
        await t.step('arrowLength: an entity — each arrow its mean over the scale chosen automatically (the largest mean of an arrow\'s zone around the window: the whole length, the longest arrow at it or nearly)', async () => {
            const r = await drawn(2), m = await t.E(`graphAt(2).chart.data.datasets[0].arrowLength`);
            return r.k.length > 5 && Math.max(...r.k) > 0.9 && Math.min(...r.k) < 0.5 && r.k.every(k => k > 0 && k <= 1) && Math.max(...r.k) >= 0.95 && m.max >= 500 && m.max <= 700 && m.unit === 'W' ? true : JSON.stringify({ r, m });
        });
        await t.step('arrowMax: 1200 — the whole length at 1200, no automatic scale; ~2400: at least 2400', async () => {
            const a = await drawn(3), m3 = await t.E(`graphAt(3).chart.data.datasets[0].arrowLength.max`), m4 = await t.E(`graphAt(4).chart.data.datasets[0].arrowLength.max`);
            return m3 === 1200 && m4 >= 2400 && a.k.every(k => k <= 0.51) ? true : JSON.stringify({ a, m3, m4 });
        });
        await t.step('a negative value: drawn by its absolute value, signed in the tooltip', async () => {
            await t.E(`(()=>{ for( const b of graphAt(3).chart.data.datasets[0].data ) { b[3] = -600; b[4].lenMin = b[4].lenMax = -600; } })()`);
            const a = await drawn(3), tip = await t.E(`el.instance._tooltipValue('arrowline', graphAt(3).chart.data.datasets[0], { index: 5 })`);
            return a.k.length > 5 && a.k.every(k => k === 0.5) && / · -600 W$/.test(tip) ? true : JSON.stringify({ a, tip });
        });
        await t.step('color and fill read indirectly: each arrow the color of the time it shows, the band under it its own fill', async () => {
            const r = await t.E(`(()=>{ const ds=graphAt(7).chart.data.datasets[0]; return { c: [...new Set(ds.arrowColors ?? [])], f: [...new Set(ds.arrowBackgrounds ?? [])] }; })()`);
            return r.c.length === 2 && r.c.includes('#ff0000') && r.c.includes('#0000ff') && r.f.length >= 2 ? true : JSON.stringify(r);
        });
        await t.step('arrowLength from an entity without a value there: each arrow 80 % of its whole length, dashed', async () => {
            const r = await drawn(5);
            return r.dashed > 5 && r.k.every(k => k === 0.8) ? true : JSON.stringify(r);
        });
        await t.step('the tooltip: the direction, then the length — each its column\'s min / mean / max, as a curve\'s (one value: itself) —, in its unit', async () => {
            const r = await t.E(`(()=>{ const ds=graphAt(2).chart.data.datasets[0], P=360, w=v=>((v%P)+P)%P;
                const k=ds.data.findIndex(x=>x[4].lenMax-x[4].lenMin>1 && x[4].hi-x[4].lo>0.1), one=ds.data.findIndex(x=>x[4].lenMin===x[4].lenMax && x[4].lo===0 && x[4].hi===0);
                const x=ds.data[k], y=ds.data[one];
                return { tip: el.instance._tooltipValue('arrowline', ds, { index: k }), want: [w(x[2]+x[4].lo), x[2], w(x[2]+x[4].hi), x[4].lenMin, x[3], x[4].lenMax],
                         tip1: el.instance._tooltipValue('arrowline', ds, { index: one }), want1: [y[2], y[3]] }; })()`);
            const nums = s => ( s.match(/-?[\d.]+/g) ?? [] ).map(Number), near = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= 0.01);
            return /^[\d.]+ \/ [\d.]+ \/ [\d.]+ ° · [\d.]+ \/ [\d.]+ \/ [\d.]+ W$/.test(r.tip) && near(nums(r.tip), r.want)
                && /^[\d.]+ ° · [\d.]+ W$/.test(r.tip1) && near(nums(r.tip1), r.want1) ? true : JSON.stringify(r);
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
    // ── Each arrow: the mean of its zone (the rows under it), weighted by how long — times the
    // length (arrowWeighting: length, the default) —; its extremes a triangle each side ──
    {
        const t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24h', statistics: { enabled: false }, graphs: [
            { type: 'arrowline', entities: [{ entity: 'sensor.wind' }] },
            { type: 'arrowline', entities: [{ entity: 'sensor.wind', arrowLength: 'sensor.power' }] },
            { type: 'arrowline', entities: [{ entity: 'sensor.wind', arrowLength: 'sensor.power', arrowWeighting: 'none' }] },
            { type: 'arrowline', entities: [{ entity: 'sensor.wind' }] },
            { type: 'arrowline', entities: [{ entity: 'sensor.wind', showMinMax: true }] },
            { type: 'arrowline', entities: [{ entity: 'sensor.wind', circular: false }] },
        ] }, { mock: { series: true }, height: 1600 });
        await t.wait(1500);
        // (graph gi's rows made up: n of the same length over the window, each its direction
        // and length (k: its place) — none wider than a pixel column; sides: showMinMax's)
        const rows = (gi, dir, len, sides) => t.E(`(()=>{ const c=graphAt(${gi}).chart, ds=c.data.datasets[0], t0=+new Date(el.instance.startTime), t1=+new Date(el.instance.endTime), n=4000, d=(t1-t0)/n;
            const dir=${dir}, len=${len};
            ds.data=Array.from({ length: n }, (_, k)=>{ const v=dir(k), L=len(k); return [t0+k*d, t0+(k+1)*d, v, L,
                { lo: 0, hi: 0, lenMin: L, lenMax: L, span: d, lenSpan: L===undefined?0:d, lenWeight: L===undefined?0:d*Math.abs(L), byLen: v, sides: ${JSON.stringify(sides ?? null)}, turn: { first: v, lo: 0, hi: 0, last: 0 } }]; });
            c.update(0); })()`);
        // (the angles its arrows are drawn at; the light sectors drawn: their arcs — centre,
        // radius, angles from and to, the canvas' (0 to the right, clockwise) —, from the arrow's middle)
        const drawn = gi => t.E(`(()=>{ const c=graphAt(${gi}).chart, ctx=c.ctx, r={ a: new Set(), sec: [], style: new Set() }, o={ rotate: ctx.rotate, moveTo: ctx.moveTo, arc: ctx.arc, fill: ctx.fill, beginPath: ctx.beginPath };
            let path=[];
            ctx.rotate=function(a){ if(a) r.a.add(Math.round(((a*180/Math.PI-180)%360+360)%360)); return o.rotate.call(this,a); };
            ctx.moveTo=function(x,y){ path=[['m',x,y]]; return o.moveTo.call(this,x,y); };
            ctx.arc=function(...a){ path.push(a); return o.arc.apply(this,a); };
            ctx.fill=function(...a){ const arc=path.find(p=>p.length===5); if( !a.length && arc && path.length<=2 && /0[.]3[)]$/.test(String(this.fillStyle)) ) { r.sec.push(arc.map(v=>Math.round(v*1000)/1000)); r.style.add(String(this.fillStyle)); } path=[]; return o.fill.apply(this,a); };
            ctx.beginPath=function(){ path=[]; return o.beginPath.call(this); };
            c.render(0); for( const k in o ) delete ctx[k]; return { a: [...r.a], sec: r.sec, style: [...r.style] }; })()`);
        await t.step('an arrow\'s direction: the mean of the rows in its zone, each weighted by how long — 350° and 10° alternating: 0°', async () => {
            await rows(0, 'k=>k%2?10:350', 'k=>undefined');
            const r = await drawn(0);
            return r.a.length >= 1 && r.a.every(x => x === 0 || x === 360) ? true : JSON.stringify(r);
        });
        await t.step('Chart.js told whether the entity is circular (circularPeriod, never guessed): circular — 360 —, 350° and 10°: 0°; not circular (circular: false: null), a number\'s mean: 180', async () => {
            const P = await t.E(`[graphAt(0).chart.data.datasets[0].circularPeriod, graphAt(5).chart.data.datasets[0].circularPeriod, graphAt(5).chart.data.datasets[0].arrowPeriod]`);
            await rows(5, 'k=>k%2?10:350', 'k=>undefined');
            const r = await drawn(5);
            // (an arrow at the window's edge: its zone partly covered — a row more of one value, a degree off)
            return JSON.stringify(P) === '[360,null,360]' && r.a.includes(180) && r.a.every(a => Math.abs(a - 180) <= 1) ? true : JSON.stringify({ P, r });
        });
        await t.step('arrowWeighting: length (the default) — each also weighted by its length: 350° of 3 and 10° of 1, 355°; none: 0°', async () => {
            await rows(1, 'k=>k%2?10:350', 'k=>k%2?1:3'); await rows(2, 'k=>k%2?10:350', 'k=>k%2?1:3');
            const a = await drawn(1), b = await drawn(2);
            return JSON.stringify(a.a) === '[355]' && b.a.length >= 1 && b.a.every(x => x === 0 || x === 360) ? true : JSON.stringify({ a, b });
        });
        await t.step('extremes (showMinMax: all): a sector of a disc each side of the arrow, from its base, in its color at the min/max band\'s alpha (0.3); max only: the clockwise one', async () => {
            await rows(3, 'k=>k%2?10:350', 'k=>undefined', { min: true, max: true });
            const both = await drawn(3);
            await rows(3, 'k=>k%2?10:350', 'k=>undefined', { min: false, max: true });
            const max = await drawn(3);
            // (the arrow at 0° points down — the wind coming from the north —: down is π/2 on the
            // canvas; clockwise, towards the left, its angle growing: max from π/2 to π/2 + 10°)
            const _cw = s => s.every(x => Math.abs(( x[3] % ( 2 * Math.PI ) ) - Math.PI / 2) < 0.01 && Math.abs(x[4] - x[3] - Math.PI / 18) < 0.01 && x[2] > 10);
            return both.sec.length > 5 && both.sec.length % 2 === 0 && max.sec.length * 2 === both.sec.length
                && _cw(max.sec) && both.style.every(c => /, ?0\.3\)$/.test(c)) ? true : JSON.stringify({ both: both.sec.length, max: max.sec.slice(0, 2), style: both.style });
        });
        await t.step('extremes far longer than the arrow (its zone\'s longest length 10 times its mean): the sector\'s radius within the band — at most from the foot of an upright arrow as long to the band\'s top', async () => {
            await rows(1, 'k=>k%2?10:350', 'k=>k%2?1:3', { min: true, max: true });
            await t.E(`(()=>{ const c=graphAt(1).chart; for( const r of c.data.datasets[0].data ) r[4].lenMax = 10 * r[3]; c.update(0); })()`);
            const r = await drawn(1);
            // (from the arrow's middle: its foot at hypot(x, y); the band 30 px high)
            const over = r.sec.filter(x => x[2] > 15 + Math.hypot(x[0], x[1]) + 0.01);
            return r.sec.length > 5 && !over.length ? true : JSON.stringify({ n: r.sec.length, over: over.slice(0, 3) });
        });
        await t.step('a whole turn or more in an arrow\'s zone (10° more each row): the extremes a whole disc about the arrow\'s middle, within the band — no length given: 80 % of it, 12 px —; the arrow still its mean direction', async () => {
            await rows(3, 'k=>(k*10)%360', 'k=>undefined', { min: true, max: true });
            const r = await drawn(3);
            const discs = r.sec.filter(x => Math.abs(x[3]) < 1e-3 && Math.abs(x[4] - 2 * Math.PI) < 1e-3 && x[0] === 0 && x[1] === 0);
            return discs.length > 5 && discs.every(x => x[2] === 12) && r.a.length > 0 ? true : JSON.stringify({ discs: discs.length, sec: r.sec.slice(0, 2), a: r.a.length });
        });
        await t.step('the extremes cut at the graph\'s area — the sectors and the whole disc drawn within a clip of the chart area, the arrows outside of it', async () => {
            const clipped = gi => t.E(`(()=>{ const c=graphAt(${gi}).chart, ctx=c.ctx, A=c.chartArea, r={ inClip: 0, outClip: 0, arrowsInClip: 0, arrows: 0 }, o={ rect: ctx.rect, clip: ctx.clip, save: ctx.save, restore: ctx.restore, fill: ctx.fill };
                let last=null, depth=0, clipAt=-1;
                ctx.rect=function(...a){ last=a; return o.rect.apply(this,a); };
                ctx.clip=function(...a){ const ok=last && Math.abs(last[0]-A.left)<0.5 && Math.abs(last[1]-A.top)<0.5 && Math.abs(last[0]+last[2]-A.right)<0.5 && Math.abs(last[1]+last[3]-A.bottom)<0.5; if( ok ) clipAt=depth; return o.clip.apply(this,a); };
                ctx.save=function(){ depth++; return o.save.call(this); };
                ctx.restore=function(){ if( clipAt===depth ) clipAt=-1; depth--; return o.restore.call(this); };
                ctx.fill=function(...a){ const light=/0[.]3[)]$/.test(String(this.fillStyle)); if( a.length ) { r.arrows++; if( clipAt>=0 ) r.arrowsInClip++; } else if( light ) { if( clipAt>=0 ) r.inClip++; else r.outClip++; } return o.fill.apply(this,a); };
                c.render(0); for( const k in o ) delete ctx[k]; return r; })()`);
            await rows(3, 'k=>(k*10)%360', 'k=>undefined', { min: true, max: true });
            const disc = await clipped(3);
            await rows(3, 'k=>k%2?10:350', 'k=>undefined', { min: true, max: true });
            const sec = await clipped(3);
            return [disc, sec].every(r => r.inClip > 5 && !r.outClip && r.arrows > 5 && !r.arrowsInClip) ? true : JSON.stringify({ disc, sec });
        });
        await t.step('extremes from the YAML (showMinMax: true) on real values: sectors drawn where the values vary in an arrow\'s zone', async () => {
            const r = await drawn(4);
            return r.sec.length > 5 ? true : JSON.stringify({ sec: r.sec.length });
        });
        const r = await t.close(); passed += r.passed; failed += r.failed;
    }
    // ── Appearance ▸ Extremes on an arrowline ──
    {
        const t = await openCard(card([{ entity: 'sensor.wind' }]), { mock: { series: true } });
        await t.wait(800);
        await t.step('Appearance ▸ Extremes on an arrowline: the curves\' list; Maximum chosen: saved as max, triangles drawn', async () => {
            await t.E(`(()=>{ const I=el.instance, g=I.graphsInDisplayOrder()[0]; I.showEntityCurveMenu(0, g.entities[0].entity, g, { from: 'label', clientX: 100, clientY: 100 }); })()`); await t.wait(250);
            await t.E(`el.querySelector('#et_0_appearance').click()`); await t.wait(200);
            const has = await t.E(`!!el.querySelector('#et_0_appearance_minmax')`);
            await t.E(`el.querySelector('#et_0_appearance_minmax').click()`); await t.wait(200);
            const l = await t.E(`[...el.querySelectorAll('#et_0_appearance_minmax_sub a')].map(a=>a.textContent).join(' | ')`);
            await t.E(`[...el.querySelectorAll('#et_0_appearance_minmax_sub a')].find(a=>a.textContent==='Maximum').click()`); await t.wait(1200);
            const saved = await t.E('graphAt(0).entities[0].showMinMax'), sides = await t.E(`graphAt(0).chart.data.datasets[0].data.some(x=>x[4].sides?.max && !x[4].sides.min)`);
            return has && l === 'None | All | Maximum | Minimum | Statistics | History' && saved === 'max' && sides ? true : JSON.stringify({ has, l, saved, sides });
        });
        const r = await t.close(); passed += r.passed; failed += r.failed;
    }
    return { passed, failed };
};
