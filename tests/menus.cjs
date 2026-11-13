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
        // A line clicked with the mouse: an id, or [box, text] — the line of box whose name is text;
        // a line with a switch: on its switch (a click on its name doesn't act)
        const click = async target => {
            const q = typeof target === 'string' ? `${root}.querySelector('${target}')`
                : `[...${root}.querySelectorAll('${target[0]} a')].find(a=>a.textContent.trim().replace(/ ▸$/,'')==='${target[1]}')`;
            const p = await t.E(`(()=>{ const a=${q}; if( !a ) return null; const sw=a.querySelector('[data-switch]'), r=(sw??a).getBoundingClientRect(); return sw ? { x: r.left+r.width/2, y: r.top+r.height/2 } : { x: r.left+Math.min(20, r.width/2), y: r.top+r.height/2 }; })()`);
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
        await curve(); await click('#et_0_behavior'); await t.wait(250); await click('#et_0_split'); await t.wait(250);
        const split = await shown('#et_0');
        return !color && !split ? true : JSON.stringify({ color, split });
    });
    await t.step('a graph\'s menu: Display, Interpolation, Appearance, Y axis locked — open half a second, then closed', async () => all([
        () => choice('graph Display Curve', graph, ['#et_0_1']),
        () => choice('graph Interpolation Makima', graph, ['#et_0_interp', '#et_0_algo_makima']),
        () => choice('graph Points', graph, ['#et_0_appearance', [A, 'Points']]),
        () => choice('graph Extremes', graph, ['#et_0_appearance', [A, 'Extremes']]),
        () => choice('graph Width 2 px', graph, ['#et_0_appearance', [A, 'Width'], ['#et_0_appearance_width_sub', '2 px']]),
        () => choice('graph Y axis locked', graph, ['#et_0_behavior', '#et_0_ylock']),
        () => choice('graph Y axis unlocked', graph, ['#et_0_behavior', '#et_0_ylock']),
    ]));
    await t.step('a click on a line closes the submenu another line of its menu opened: Behavior ▸ Tooltip ▸ open over Y axis locked\'s switch, a click on its name closes Tooltip, the lock unchanged; a click on the switch locks', async () => {
        const options = async () => { await click('#bo_0'); };
        // (the menu of the step before closed, its delay over)
        await t.page.mouse.click(5, 880); await t.wait(1500);
        await options(); await t.wait(300); await click('#eo_0_behavior'); await t.wait(300); await click('#eo_0_behavior_tooltip'); await t.wait(300);
        // (the options menu's lock: every graph's that has one)
        const lock = () => t.E('el.instance.graphs.some(g => g.chart.hecYAxisLocked())');
        const a = { tooltip: await shown('#eo_0_behavior_tooltip_sub'), lock: await lock() };
        const p = await t.E(`(()=>{ const r=el.querySelector('#eo_0_ylock').getBoundingClientRect(); return { x: r.left+20, y: r.top+r.height/2 }; })()`);
        await t.page.mouse.click(p.x, p.y); await t.wait(800);
        const b = { tooltip: await shown('#eo_0_behavior_tooltip_sub'), behavior: await shown('#eo_0_behavior_sub'), lock: await lock() };
        await click('#eo_0_ylock'); await t.wait(300);
        const c = { lock: await lock() };
        await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 880); await t.wait(1200);
        if( c.lock ) { await options(); await t.wait(300); await click('#eo_0_behavior'); await t.wait(300); await click('#eo_0_ylock'); await t.wait(1500); }
        return a.tooltip && !a.lock && !b.tooltip && b.behavior && !b.lock && c.lock ? true : JSON.stringify({ a, b, c });
    });
    await t.step('the options menu: Enhanced native history — open half a second, then closed (twice: back as it was)', async () => {
        const options = async () => { await click('#bo_0'); };
        return all([
            () => choice('native history on', options, ['#eo_0_all', '#ei_0'], '#eo_0'),
            () => choice('native history off', options, ['#eo_0_all', '#ei_0'], '#eo_0'),
        ]);
    });
    done(await t.close());

    // ── A menu scrolled: its submenu follows its line, closed once its first line is wholly out of the menu ──
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, graphs: [] }, { mock: { series: true }, height: 500 });
    await t.wait(800);
    await t.step('the selector\'s list scrolled: an attribute submenu open follows its entity\'s line, then closes once its first line is wholly out of the list', async () => {
        await t.page.click('#b7_0'); await t.wait(400);
        const id = await t.E(`(()=>{ const d=el.querySelector('#es_0'), dr=d.getBoundingClientRect(); const a=[...d.querySelectorAll('a[data-entity]')].find(a=>a.textContent.endsWith(' ▸') && a.getBoundingClientRect().top > dr.top + 60 && a.getBoundingClientRect().bottom < dr.bottom); return a ? a.dataset.entity : null; })()`);
        if( !id ) return 'no entity with attributes in view: ' + await t.E(`el.querySelector('#es_0').scrollHeight+'/'+el.querySelector('#es_0').clientHeight`);
        await t.page.click(`#es_0 a[data-entity="${id}"]`); await t.wait(400);
        const level = () => t.E(`(()=>{ const s=el.querySelector('#es_0_series'), l=el.querySelector('#es_0 a[data-entity="${id}"]'); return { shown: s.style.display!=='none', dy: Math.round(s.getBoundingClientRect().top - l.getBoundingClientRect().top) }; })()`);
        const before = await level();
        await t.E(`el.querySelector('#es_0').scrollTop += 30`); await t.wait(200);
        const scrolled = await level();
        await t.E(`el.querySelector('#es_0').scrollTop += 400`); await t.wait(200);
        const gone = await level();
        await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 490); await t.wait(300);
        return before.shown && Math.abs(before.dy) <= 1 && scrolled.shown && Math.abs(scrolled.dy) <= 1 && !gone.shown ? true : JSON.stringify({ id, before, scrolled, gone });
    });
    done(await t.close());

    // ── The page scrolled: a menu stays on what it was opened from, masked past what shows of
    // the page — the screen's edge, or under the sticky toolbar — closed once its first line is
    // wholly past it ──
    for( const sticky of [false, true] ) {
        t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, ...( sticky ? { uiLayout: { sticky: 'top' } } : {} ),
            graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }, { type: 'line', entities: [{ entity: 'sensor.rain' }] }, { type: 'line', entities: [{ entity: 'sensor.tank' }] }] },
            { mock: { series: true }, height: 600 });
        // (room to scroll below the card; Home Assistant's header height, which a sticky
        // toolbar stays under: none here)
        await t.E(`(()=>{ const d=document.createElement('div'); d.style.height='1500px'; document.body.appendChild(d); document.documentElement.style.setProperty('--header-height', '0px'); })()`);
        await t.wait(800);
        await t.step(`${sticky ? 'a sticky toolbar' : 'the page'}: a curve\'s menu follows its label as the page scrolls; its first line partly past ${sticky ? 'the toolbar' : 'the screen\'s top'}: masked there, still open; wholly past: closed; scrolled the other way, its part below the screen masked, still open`, async () => {
            await t.E('scrollTo(0, 0)'); await t.wait(200);
            await t.longPress(await t.E('legendPt(1,0)'));
            const menu = () => t.E(`(()=>{ const m=el.querySelector('#et_0'); if( m.style.display==='none' ) return null; const r=m.getBoundingClientRect(); return { gap: Math.round(r.top - legendPt(1,0).y), top: r.top, bottom: r.bottom, clip: m.style.clipPath }; })()`);
            const zoneTop = () => t.E(`${sticky ? "el.querySelector('[data-sticky]').getBoundingClientRect().bottom" : '0'}`);
            const m0 = await menu();
            await t.E('scrollBy(0, 40)'); await t.wait(250);
            const m1 = await menu();
            // (its top 10 px past the zone's top: that much masked, open; 40 px past, more than
            // its first line: closed)
            await t.E(`scrollBy(0, ${m1.top} - ${await zoneTop()} + 10)`); await t.wait(250);
            const m2 = await menu();
            await t.E('scrollBy(0, 30)'); await t.wait(250);
            const m3 = await menu();
            // (room added above the card; opened again with its label 260 px above the screen's
            // bottom, then the page scrolled up until the menu goes 60 px past the screen's bottom)
            await t.E(`(()=>{ const d=document.createElement('div'); d.style.height='600px'; document.body.prepend(d); scrollTo(0, 0); })()`); await t.wait(200);
            await t.E(`scrollTo(0, legendPt(1,0).y - innerHeight + 260)`); await t.wait(250);
            await t.longPress(await t.E('legendPt(1,0)'));
            const m4 = await menu();
            await t.E(`scrollBy(0, -(innerHeight - ${m4?.bottom ?? 0} + 60))`); await t.wait(250);
            const m5 = await menu();
            await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.E('scrollTo(0, 0)'); await t.wait(300);
            const ok = m0 && m1 && Math.abs(m1.gap - m0.gap) <= 1 && m2 && /inset\((9|10|11)/.test(m2.clip) && !m3 && m4 && m5 && /inset\(0px 0px [1-9]/.test(m5.clip);
            return ok ? true : JSON.stringify({ m0, m1, m2, m3, m4, m5 });
        });
        done(await t.close());
    }

    // ── The info panel's curve menu ──
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

    // ── Every menu, every submenu at any depth, opened in turn (CLAUDE.md, "Menus: a cascade,
    // always visible"): a submenu fits within the menu calling it, hiding no line's text —
    // the last line's too —, when there's room; without room, 2 or 3 characters of each
    // line it covers still show (40 px), the last line's submenu aside (as wide as the menu
    // when it needs it) ──
    // (the lines of box opening a submenu, shown — `${line id}_sub`)
    // (a line greyed — nothing to open: an export with no data — left out)
    const subLines = (t, root, box) => t.E(`[...${root}.querySelectorAll('#${box} a')].filter(a=>a.parentNode.id==='${box}' && a.id && a.offsetParent && !a.getAttribute('aria-disabled') && ${root}.querySelector('#'+a.id+'_sub')).map(a=>a.id)`);
    // (with line's submenu open: the names of box's lines it covers, how much of box shows
    // left of it, whether line is box's last, whether the submenu is as wide as box)
    const covered = (t, root, box, line) => t.E(`(()=>{ const R=${root}, b=R.querySelector('#${box}'), s=R.querySelector('#${line}_sub'), l=R.querySelector('#${line}');
        if( !s || s.style.display==='none' ) return { closed: true };
        const sq=s.getBoundingClientRect(), bq=b.getBoundingClientRect();
        const lines=[...b.querySelectorAll('a')].filter(a=>a.parentNode===b && a.offsetParent);
        const right=a=>{ const n=document.createTreeWalker(a, NodeFilter.SHOW_TEXT).nextNode(); if( !n ) return 0; const r=document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect().right; };
        return { hidden: lines.filter(a=>{ const q=a.getBoundingClientRect(); return q.bottom>sq.top+1 && q.top<sq.bottom-1 && right(a)>sq.left+1; }).map(a=>a.textContent.trim()),
                 shows: Math.round(sq.left-bq.left), last: lines[lines.length-1]===l, full: sq.width>=bq.width-2 }; })()`);
    // (menu box of root walked: each line opening a submenu clicked, the submenu checked, then
    // walked; a fault: the path, what it hides)
    const walk = async (t, R, root, box, path, narrow, faults) => {
        for( const id of await subLines(t, root, box) ) {
            const name = await t.E(`${root}.querySelector('#${id}').textContent.trim().replace(/ ▸$/,'')`);
            await R.click(`#${id}`); await t.wait(300);
            const c = await covered(t, root, box, id), where = [...path, name].join(' ▸ ');
            if( c.closed ) { faults.push(where + ': not opened'); continue; }
            const ok = !c.hidden.length || ( narrow && ( c.shows >= 40 || ( c.last && c.full ) ) );
            if( !ok ) faults.push(`${where}: hides ${c.hidden.join(', ')} (${c.shows} px of its menu show)`);
            await walk(t, R, root, `${id}_sub`, [...path, name], narrow, faults);
        }
    };
    const close = async t => { for( let i = 0; i < 4; i++ ) await t.page.keyboard.press('Escape'); await t.page.mouse.click(3, 3); await t.wait(300); };
    const STATS = () => ({ ...card(), statistics: { enabled: true } });
    for( const width of [1000, 400] ) {
        const narrow = width < 600;
        t = await openCard(STATS(), { height: 900 });
        await t.E(`(()=>{ document.body.style.width='${width}px'; document.getElementById('host').style.width='${width}px'; })()`); await t.wait(1500);
        const R = run(t, 'el');
        await t.step(`${width} px: every submenu of the options menu, a curve's, a graph's and a timeline row's menu — ${narrow ? 'without room: 2 or 3 characters of each line it covers show, the last line\'s as wide as the menu when it needs it' : 'each within the menu calling it, hiding no line\'s text, the last line\'s too'}`, async () => {
            const faults = [];
            await R.click('#bo_0'); await t.wait(400); await walk(t, R, 'el', 'eo_0', ['Options'], narrow, faults); await close(t);
            await t.longPress(await t.E('legendPt(0,0)')); await t.wait(400); await walk(t, R, 'el', 'et_0', ['curve'], narrow, faults); await close(t);
            await t.longPress(await t.E('moPt(0)')); await t.wait(400); await walk(t, R, 'el', 'et_0', ['graph'], narrow, faults); await close(t);
            await t.longPress(await t.E('tlPt(1,0)')); await t.wait(400); await walk(t, R, 'el', 'et_0', ['timeline row'], narrow, faults); await close(t);
            return faults.length ? faults.join(' / ') : true;
        });
        done(await t.close());
        t = await openCard({}, { page: 'panel.html', panel: {}, mock: { series: true }, height: 800 });
        await t.E(`(()=>{ document.body.style.width='${width}px'; })()`); await t.E(`openPanel('sensor.power')`); await t.wait(2500);
        const Q = run(t, 'inst()._this');
        await t.step(`${width} px: every submenu of the info panel's menu, as every menu's`, async () => {
            const faults = [];
            await Q.click('#tf_0'); await t.wait(400); await walk(t, Q, 'inst()._this', 'et_0', ['panel'], narrow, faults);
            return faults.length ? faults.join(' / ') : true;
        });
        done(await t.close());
    }

    return { passed, failed };
};
