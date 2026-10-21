// Every menu's choices, clicked with the mouse as a user does (the line clicked gets the
// focus): one that changes what its menu shows — a type, an interpolation, a look, a switch —
// leaves the menu open half a second, the new state seen, then closed; one that acts
// elsewhere closes it at once
const { openCard } = require('./lib.cjs');

const card = () => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false },
    graphs: [{ type: 'line', entities: [{ entity: 'sensor.power', lineMode: 'smart' }, { entity: 'sensor.power_kw', lineMode: 'smart' }] },
             { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }] }] });

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    // root: the card's elements ('el') or the info panel's ('inst()._this')
    const run = (t, root) => {
        const shown = sel => t.E(`(()=>{ const m=${root}.querySelector('${sel}'); return !!m && m.style.display!=='none'; })()`);
        // A line clicked with the mouse: an id, or [box, text] — the line of box whose name is text
        const click = async target => {
            const q = typeof target === 'string' ? `${root}.querySelector('${target}')`
                : `[...${root}.querySelectorAll('${target[0]} a')].find(a=>a.textContent.trim().replace(/ ▸$/,'')==='${target[1]}')`;
            const p = await t.E(`(()=>{ const a=${q}; if( !a ) return null; const r=a.getBoundingClientRect(); return { x: r.left+Math.min(20, r.width/2), y: r.top+r.height/2 }; })()`);
            if( !p ) return false;
            await t.page.mouse.click(p.x, p.y); return true;
        };
        // A menu opened by open(), the lines of path clicked in turn, the last one a choice: the
        // menu (menuSel) still open 0.4 s after it, closed 1.3 s after it — '' when so
        const choice = async (name, open, path, menuSel = '#et_0') => {
            await open(); await t.wait(250);
            for( const p of path.slice(0, -1) ) { if( !await click(p) ) return `${name}: ${JSON.stringify(p)} not found`; await t.wait(250); }
            if( !await click(path[path.length - 1]) ) return `${name}: ${JSON.stringify(path[path.length - 1])} not found`;
            await t.wait(400); const open04 = await shown(menuSel);
            await t.wait(900); const open13 = await shown(menuSel);
            if( open13 ) { await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.wait(300); }
            return open04 && !open13 ? '' : `${name}: open at 0.4 s ${open04}, at 1.3 s ${open13}`;
        };
        return { choice, click, shown };
    };
    const all = async list => { const out = []; for( const c of list ) { const r = await c(); if( r ) out.push(r); } return out.length ? out.join(' / ') : true; };

    let t = await openCard(card(), { height: 900 });
    const { choice, click, shown } = run(t, 'el');
    const curve = async () => { await t.longPress(await t.E('legendPt(0,0)')); };
    const graph = async () => { await t.longPress(await t.E('moPt(0)')); };
    const A = '#et_0_appearance_sub';
    await t.step('a curve\'s menu: Display, Interpolation, every Appearance choice — open half a second, then closed', async () => all([
        () => choice('Display Curve', curve, ['#et_0_1']),
        () => choice('Display Smart', curve, ['#et_0_6']),
        () => choice('Interpolation Steffen', curve, ['#et_0_interp', '#et_0_algo_steffen']),
        () => choice('Points on', curve, ['#et_0_appearance', [A, 'Points']]),
        () => choice('Points off', curve, ['#et_0_appearance', [A, 'Points']]),
        () => choice('Extremes on', curve, ['#et_0_appearance', [A, 'Extremes']]),
        () => choice('Fill Fade', curve, ['#et_0_appearance', [A, 'Fill'], ['#et_0_appearance_fill_sub', 'Fade']]),
        () => choice('Width 3 px', curve, ['#et_0_appearance', [A, 'Width'], ['#et_0_appearance_width_sub', '3 px']]),
        () => choice('Line style Dots', curve, ['#et_0_appearance', [A, 'Line style'], ['#et_0_appearance_dash_sub', 'Dots']]),
    ]));
    await t.step('the cascade: each submenu over the one it comes from, right edges aligned, narrower — the start of the lines under it still shows (menu → Appearance → Fill)', async () => {
        await curve(); await click('#et_0_appearance'); await t.wait(250); await click([A, 'Fill']); await t.wait(250);
        const r = await t.E(`['#et_0','#et_0_appearance_sub','#et_0_appearance_fill_sub'].map(s=>{ const b=el.querySelector(s); const q=b.getBoundingClientRect(); return { shown: b.style.display!=='none', l: Math.round(q.left), r: Math.round(q.right) }; })`);
        await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 880); await t.wait(300);
        const ok = r.every(b => b.shown) && Math.abs(r[0].r - r[1].r) <= 1 && Math.abs(r[1].r - r[2].r) <= 1 && r[1].l - r[0].l >= 15 && r[2].l - r[1].l >= 15;
        return ok ? true : JSON.stringify(r);
    });
    await t.step('a curve\'s menu: Color, Separate — closed at once', async () => {
        await curve(); await click('#et_0_appearance'); await t.wait(250); await click([A, 'Color']); await t.wait(250);
        const color = await shown('#et_0');
        await t.page.mouse.click(5, 880); await t.wait(300);
        await curve(); await click('#et_0_layout'); await t.wait(250); await click('#et_0_split'); await t.wait(250);
        const split = await shown('#et_0');
        return !color && !split ? true : JSON.stringify({ color, split });
    });
    await t.step('a graph\'s menu: Display, Interpolation, Appearance, Y axis locked — open half a second, then closed', async () => all([
        () => choice('graph Display Curve', graph, ['#et_0_1']),
        () => choice('graph Interpolation Makima', graph, ['#et_0_interp', '#et_0_algo_makima']),
        () => choice('graph Points', graph, ['#et_0_appearance', [A, 'Points']]),
        () => choice('graph Extremes', graph, ['#et_0_appearance', [A, 'Extremes']]),
        () => choice('graph Width 2 px', graph, ['#et_0_appearance', [A, 'Width'], ['#et_0_appearance_width_sub', '2 px']]),
        () => choice('graph Y axis locked', graph, ['#et_0_layout', '#et_0_ylock']),
        () => choice('graph Y axis unlocked', graph, ['#et_0_layout', '#et_0_ylock']),
    ]));
    await t.step('the options menu: Enhanced native history — open half a second, then closed (twice: back as it was)', async () => {
        const options = async () => { await click('#bo_0'); };
        return all([
            () => choice('native history on', options, ['#eo_0_all', '#ei_0'], '#eo_0'),
            () => choice('native history off', options, ['#eo_0_all', '#ei_0'], '#eo_0'),
        ]);
    });
    done(await t.close());

    // ── The info panel's type menu ──
    t = await openCard({}, { page: 'panel.html', panel: {}, mock: { series: true }, height: 800 });
    await t.E(`openPanel('sensor.power')`); await t.wait(2500);
    const P = run(t, 'inst()._this');
    const typeLink = async () => { await P.click('#tf_0'); };
    await t.step('the info panel\'s menu: Display, Appearance, Interpolation — open half a second, then closed', async () => all([
        () => P.choice('panel Display Curve', typeLink, ['#et_0_1']),
        () => P.choice('panel Interpolation Steffen', typeLink, ['#et_0_interp', '#et_0_algo_steffen']),
        () => P.choice('panel Points', typeLink, ['#et_0_appearance', ['#et_0_appearance_sub', 'Points']]),
        () => P.choice('panel Width 3 px', typeLink, ['#et_0_appearance', ['#et_0_appearance_sub', 'Width'], ['#et_0_appearance_width_sub', '3 px']]),
    ]));
    done(await t.close());

    return { passed, failed };
};
