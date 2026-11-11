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
    return { passed, failed };
};
