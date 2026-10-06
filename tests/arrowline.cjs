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
    return { passed, failed };
};
