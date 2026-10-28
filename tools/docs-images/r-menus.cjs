// The menus, deployed: a curve's, a graph's, a timeline row's, the options menu
const { openDoc, union } = require('./doclib.cjs');
const { home } = require('./scenes.cjs');

const only = process.argv[2];
const open = () => openDoc(home.cfg, { states: home.states, rows: home.rows, clock: home.clock, width: 900, height: 1100 });
async function longPress(d, p) { const m = d.page.mouse; await m.move(p.x, p.y); await m.down(); await d.wait(900); await m.up(); await d.wait(400); }
// The line of box whose name is text (or the element sel): hovered, or clicked
async function line(d, target, clickIt = true) {
    const q = typeof target === 'string' ? `el.querySelector('${target}')`
        : `[...el.querySelectorAll('${target[0]} a')].find(a=>a.textContent.trim().replace(/ ▸$/,'')==='${target[1]}')`;
    const p = await d.E(`(()=>{ const a=${q}; if( !a ) return null; const r=a.getBoundingClientRect(); return { x: r.left+Math.min(30, r.width/2), y: r.top+r.height/2 }; })()`);
    if( !p ) throw new Error('not found ' + JSON.stringify(target));
    if( clickIt ) await d.page.mouse.click(p.x, p.y); else await d.page.mouse.move(p.x, p.y);
    await d.wait(350);
}
// Every menu box shown (#et_0…, #eo_0…): their rectangles
const menus = d => d.E(`[...el.querySelectorAll('[id^=et_0],[id^=eo_0],[id^=es_0]')].filter(b=>b.style.display!=='none' && b.offsetParent && getComputedStyle(b).position==='absolute').map(b=>{ const r=b.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })`);
// The rectangle of graph gi (its canvas)
const graph = (d, gi) => d.E(`(()=>{ const r=el.instance.graphsInDisplayOrder()[${gi}].canvas.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()`);

const scenes = {
    // A curve's menu: a long press (or a right click) on its label, Appearance open
    'menu-curve': async d => {
        await longPress(d, await d.E('legendPt(0,0)'));
        await line(d, '#et_0_appearance');
        return union(await graph(d, 0), ...(await menus(d)));
    },
    // A graph's menu: a long press on its ⠿ zone, Behavior open
    'menu-graph': async d => {
        await longPress(d, await d.E('moPt(0)'));
        await line(d, '#et_0_behavior');
        return union(await graph(d, 0), ...(await menus(d)));
    },
    // A timeline row's menu: a long press on its name
    'menu-timeline': async d => {
        await longPress(d, await d.E('tlPt(2,2)'));
        await line(d, '#et_0_rep');
        return union(await graph(d, 2), ...(await menus(d)));
    },
    // The options menu, Export open: just the menus (CSV export)
    'menu-export': async d => {
        await d.E(`el.querySelector('#bo_0').click()`); await d.wait(350);
        await line(d, '#eo_0_export');
        return union(await d.rect('#bo_0'), ...(await menus(d)));
    },
    // The options menu: the ▾ button by the entity field, Export open
    'menu-options': async d => {
        await d.E(`el.querySelector('#bo_0').click()`); await d.wait(350);
        await line(d, '#eo_0_export');
        return union(await d.rect('#tb_0'), await graph(d, 0), ...(await menus(d)));
    },
};

(async () => {
    for( const [name, f] of Object.entries(scenes) ) {
        if( only && name !== only ) continue;
        const d = await open();
        await d.wait(800);
        try {
            const r = await f(d);
            console.log(name, await d.shot(name, r, 10), d.errors.join(' | '));
        } catch( e ) { console.log(name, 'FAILED', e.message, await d.E(`[...el.querySelectorAll('[id^=et_0]')].map(e=>e.id).slice(0,40).join(' ')`)); }
        await d.close();
    }
})();
