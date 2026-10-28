// Drag and drop, captured mid-gesture: a curve's label onto another graph, a graph moved by
// its ⠿ zone, a timeline row onto another timeline, the Y axis dragged
const { openDoc, union } = require('./doclib.cjs');
const { home } = require('./scenes.cjs');

const only = process.argv[2];
const open = () => openDoc(home.cfg, { states: home.states, rows: home.rows, clock: home.clock, width: 900, height: 1100 });
const graph = (d, gi) => d.E(`(()=>{ const r=el.instance.graphsInDisplayOrder()[${gi}].canvas.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()`);
// The mouse pressed at a, moved to c in steps, still held
async function dragTo(d, a, c, steps = 18) {
    const m = d.page.mouse; await m.move(a.x, a.y); await m.down(); await d.wait(60);
    for( let i = 1; i <= steps; i++ ) { await m.move(a.x + (c.x - a.x) * i / steps, a.y + (c.y - a.y) * i / steps); await d.wait(30); }
    await d.wait(400);
}

const scenes = {
    // A curve's label dragged onto another graph: the curve moves there when dropped
    'drag-label': async d => {
        const a = await d.E('legendPt(0,1)'), g1 = await graph(d, 1);
        await dragTo(d, a, { x: g1.x + g1.width * 0.62, y: g1.y + g1.height * 0.45 });
        const r = union(await graph(d, 0), g1);
        await d.annotate([{ arrow: [a.x + 10, a.y + 18, g1.x + g1.width * 0.62 - 8, g1.y + g1.height * 0.45 - 22] }]);
        return r;
    },
    // A graph dragged by its ⠿ zone: the graphs make room where it will go
    'drag-graph': async d => {
        const a = await d.E('moPt(2)'), g0 = await graph(d, 0);
        await dragTo(d, a, { x: a.x + 6, y: g0.y + 40 });
        return union(g0, await graph(d, 1), await graph(d, 2));
    },
    // A timeline row dragged onto another graph
    'drag-row': async d => {
        const a = await d.E('tlPt(2,3)'), g1 = await graph(d, 1);
        await dragTo(d, a, { x: g1.x + g1.width * 0.5, y: g1.y + g1.height * 0.5 });
        return union(g1, await graph(d, 2));
    },
    // The Y axis dragged: the curves move up and down
    'drag-yaxis': async d => {
        const a = await d.E('yaPt(0,0.5)');
        await dragTo(d, a, { x: a.x, y: a.y + 70 }, 10);
        return await graph(d, 0);
    },
};

(async () => {
    for( const [name, f] of Object.entries(scenes) ) {
        if( only && name !== only ) continue;
        const d = await open();
        await d.wait(800);
        try { const r = await f(d); console.log(name, await d.shot(name, r, 6), d.errors.join(' | ')); }
        catch( e ) { console.log(name, 'FAILED', e.message); }
        await d.close();
    }
})();
