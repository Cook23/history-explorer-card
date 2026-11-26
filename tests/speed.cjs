// The time each action keeps the page busy, on a card like a real one (17 graphs, 36 entities, a week, statistics:
// the long tasks it makes, over 1.5 s): every final choice of the card's options menu, of a graph's and of a curve's
// menu (a fresh card for each menu, its Display section last), each menu opened; the pointer moved over a graph, the
// cursor line on every graph, with their tooltips. Budgets: a choice for a graph or a curve 400 ms, for the card (its
// graphs built again together) 1000 ms, a menu opened 100 ms, the pointer moved with the cursor line 100 ms in all
// (the graphs' tooltips opened as it comes) — a choice must never work everything out again for each graph, a move
// never draw a graph again; the window changed — a zoom, the range, '<' —: each graph drawn twice at most (once
// with its new time and data, once for the answers it brings), resized: four times at most
const { openCard } = require('./lib.cjs');

const ids = Array.from({ length: 33 }, (_, k) => 'sensor.s' + (k + 1));
const graphs = []; let k0 = 0;
for( const n of [4, 4, 3, 3, 1, 1, 1, 1, 3, 4, 1, 1, 5, 1] ) { graphs.push({ type: 'line', entities: ids.slice(k0, k0 + n).map(entity => ({ entity })) }); k0 += n; }
graphs.splice(1, 0, { type: 'arrowline', entities: [{ entity: 'sensor.wind' }] });
graphs.splice(4, 0, { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }] });
graphs.splice(12, 0, { type: 'timeline', entities: [{ entity: 'binary_sensor.b' }] });
// (not a choice: a value typed or picked, a curve or graph moved or removed, an export, a panel opened, the settings)
const SKIP = /Cut|Delete|Separate|Merge|Pick|Choose|Entity|Add|Info|Export|Tests|Card ▸|Global ▸/;
const BUDGET = { card: 1000, graph: 400, curve: 400, open: 100, pointer: 100 };

module.exports = async function()
{
    let passed = 0, failed = 0, t = null;
    const done = r => { passed += r.passed; failed += r.failed; };
    const fresh = async () => {
        if( t ) done(await t.close());
        t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '7d', statistics: { enabled: true }, graphs },
            { height: 1400, mock: { series: true, historyStep: 300, historyDays: 90, clones: 33 }, clock: '2026-11-20T15:07:00+01:00', timezone: 'Europe/Paris' });
        for( let i = 0; i < 240 && await t.E('el.instance.state.loading || el.instance._requests.length > 0'); i++ ) await t.wait(500);
        await t.wait(3000);
        // (the long tasks; a box's visible lines — its own, not a box under it —; a line clicked: a submenu's
        // only when its box isn't open already — a menu reopened soon opens the one it had open)
        await t.E(`(()=>{ window.__lt = []; new PerformanceObserver(l => { for( const e of l.getEntries() ) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: false });
            window.__busy = t0 => { const lt = window.__lt.filter(([s]) => s >= t0); return Math.round(lt.reduce((s, [, d]) => s + d, 0)); };
            window.__lines = id => { const b = el.querySelector('#' + id); return b ? [...b.querySelectorAll('a')].filter(a => a.offsetParent && a.closest('[id$="_sub"], #eo_0, #et_0') === b) : []; };
            window.__click = (id, k, final) => { const l = window.__lines(id), a = typeof k === 'string' ? l.find(x => x.id === k) : l[k]; if( !a ) return false;
                if( final || !a.id || !el.querySelector('#' + a.id + '_sub')?.offsetParent ) a.click(); return true; }; })()`);
    };
    // (the loading around the window in the background held — its answers drawn would count —, the
    // requests under way answered: the gestures measured alone)
    const quiet = async () => { for( let r = 0; r < 2; r++ ) { for( let i = 0; i < 60 && await t.E('el.instance._requests.length > 0'); i++ ) await t.wait(250);
        await t.E('el.instance._backgroundNext = Number.MAX_SAFE_INTEGER'); } await t.wait(1000); };
    const close = async () => { for( let i = 0; i < 4; i++ ) await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 1395); await t.wait(300); };
    const openers = { card: async () => { await t.E(`el.querySelector('#bo_0').click()`); await t.wait(400); return 'eo_0'; },
                      graph: async () => { await t.longPress(await t.E('moPt(0)')); return 'et_0'; },
                      curve: async () => { await t.longPress(await t.E('legendPt(0,0)')); return 'et_0'; } };

    for( const [menu, open] of Object.entries(openers) ) {
        await fresh();
        await t.step(`the ${menu}'s menu opened: ${BUDGET.open} ms busy at most`, async () => {
            await close(); await t.wait(400);
            const t0 = await t.E('performance.now()'); await open(); await t.wait(600);
            const busy = await t.E(`window.__busy(${t0})`);
            return busy <= BUDGET.open ? true : `${busy} ms`;
        });
        // (its choices: its sections' lines, and their submenus' — Display last: it changes the graphs)
        await close(); let root = await open();
        const secs = ( await t.E(`window.__lines('${root}').map(a => [a.textContent, a.id])`) ).sort((x, y) => /Display/.test(x[0]) - /Display/.test(y[0]));
        const choices = [];
        for( const [label, id] of secs ) {
            if( SKIP.test(label) || !label.endsWith('▸') ) continue;
            await close(); root = await open(); await t.E(`window.__click('${root}', '${id}', false)`); await t.wait(300);
            for( const [k1, [lab1, id1]] of ( await t.E(`window.__lines('${id}_sub').map(a => [a.textContent, a.id])`) ).entries() ) {
                if( SKIP.test(lab1) ) continue;
                if( !lab1.endsWith('▸') ) { choices.push({ name: `${label} ${lab1}`, path: [[root, id], [id + '_sub', k1]] }); continue; }
                await close(); root = await open(); await t.E(`window.__click('${root}', '${id}', false)`); await t.wait(250); await t.E(`window.__click('${id}_sub', ${k1}, false)`); await t.wait(300);
                for( const [k2, [lab2]] of ( await t.E(`window.__lines('${id1}_sub').map(a => [a.textContent, a.id])`) ).entries() )
                    if( !SKIP.test(lab2) && !lab2.endsWith('▸') ) choices.push({ name: `${label} ${lab1} ${lab2}`, path: [[root, id], [id + '_sub', k1], [id1 + '_sub', k2]] });
            }
        }
        await t.step(`every choice of the ${menu}'s menu: ${BUDGET[menu]} ms busy at most`, async () => {
            const slow = [];
            let n = 0;
            for( const c of choices ) {
                await close(); await open();
                for( const [b, kk] of c.path.slice(0, -1) ) { await t.E(`window.__click('${b}', ${JSON.stringify(kk)}, false)`); await t.wait(250); }
                const [b, kk] = c.path.at(-1);
                const busy = await t.E(`(async()=>{ const t0 = performance.now(); if( !window.__click('${b}', ${JSON.stringify(kk)}, true) ) return null;
                    await new Promise(r => setTimeout(r, 1500)); return window.__busy(t0); })()`);
                // (none: a line gone — the graphs changed by a choice before it)
                if( busy === null ) continue;
                n++;
                if( busy > BUDGET[menu] ) slow.push(`${c.name}: ${busy} ms`);
            }
            return n >= 20 && !slow.length ? true : JSON.stringify({ measured: n, slow });
        });
    }

    // ── The pointer moved over a graph: its tooltip following it; the cursor line on every graph — with their tooltips ──
    await fresh(); await quiet();
    await t.step(`the pointer moved along a curve (30 moves), its tooltip and its highlighted point following it: ${BUDGET.pointer} ms busy at most in all — the graph never drawn again for it`, async () => {
        await t.E(`(()=>{ const c = graphAt(0).chart; window.__draws = 0; const d = c.draw; c.draw = function() { window.__draws++; return d.apply(this, arguments); }; })()`);
        const pts = await t.E(`(()=>{ const c = graphAt(0).chart, r = c.canvas.getBoundingClientRect(), A = c.chartArea;
            return c.getDatasetMeta(0).data.map(p => p._view).filter(v => !v.skip && v.x > A.left + 20 && v.x < A.right - 20).filter((_, i, a) => i % Math.max(1, Math.floor(a.length / 30)) === 0).slice(0, 30)
                .map(v => ({ x: r.left + v.x, y: r.top + v.y })); })()`);
        await t.page.mouse.move(pts[0].x - 20, pts[0].y); await t.wait(500);
        const t0 = await t.E('performance.now()');
        for( const q of pts ) { await t.page.mouse.move(q.x, q.y); await t.wait(16); }
        await t.wait(500);
        const r = await t.E(`({ busy: window.__busy(${t0}), draws: window.__draws, tip: !!graphAt(0).chart.tooltip._hecHoverTooltipEl?.isConnected, active: graphAt(0).chart.active.length })`);
        await t.page.mouse.move(5, 5); await t.wait(500);
        return r.busy <= BUDGET.pointer && r.draws === 0 && r.tip && r.active > 0 ? true : JSON.stringify(r);
    });
    for( const [mode, tooltipMode] of [['the cursor line on every graph', 'auto'], ['the cursor line and the tooltips on every graph', 'all']] ) {
        // (the pointer coming over the graph opens every graph's tooltip at once — a task, once —: 100 ms in all
        // at most; a graph drawn again at each move, every graph's tooltips opened again at each move, past it)
        await t.step(`the pointer moved over a graph (30 moves), ${mode}: ${BUDGET.pointer} ms busy at most in all — no graph drawn again`, async () => {
            await t.E(`el.instance.setGraphsCursor(el.instance.graphs, { cursorMode: 'all', cursorTypes: ['all'], tooltipMode: '${tooltipMode}' })`);
            const p = await t.E('graphPtAt(0, 0.5)');
            await t.page.mouse.move(p.x - 200, p.y); await t.wait(500);
            const t0 = await t.E('performance.now()');
            for( let i = 0; i < 30; i++ ) { await t.page.mouse.move(p.x - 200 + i * 12, p.y); await t.wait(16); }
            await t.wait(500);
            const busy = await t.E(`window.__busy(${t0})`);
            return busy <= BUDGET.pointer ? true : `${busy} ms`;
        });
    }
    // ── The window changed: each graph drawn once with its new time and data, and once more at most for the
    // answers it brings (never first with the data it had) — resized: once at its new size, once with its
    // points worked out for it ──
    await fresh(); await quiet();
    await t.E(`(()=>{ window.__draws = 0; for( const g of el.instance.graphs ) { const c = g.chart, d = c.draw; c.draw = function() { window.__draws++; return d.apply(this, arguments); }; } })()`);
    const _n = await t.E('el.instance.graphs.length');
    const gestures = [
        ['the wheel (a zoom)', 2, async () => { const p = await t.E('graphPtAt(0, 0.5)'); await t.page.mouse.move(p.x, p.y); await t.page.keyboard.down('Control'); await t.page.mouse.wheel(0, -100); await t.page.keyboard.up('Control'); await t.page.mouse.move(5, 5); }],
        ["the toolbar's zoom +", 2, () => t.E(`el.querySelector('#b5_0').click()`)],
        ['the range menu (48 h)', 2, () => t.E(`(()=>{ const s=el.querySelector('#by_0'); s.value='48'; s.dispatchEvent(new Event('change')); })()`)],
        ["'<'", 2, () => t.E(`el.querySelector('#b1_0').click()`)],
        ['the card 200 px narrower', 4, () => t.E(`document.getElementById('host').style.width='800px'`)],
    ];
    for( const [name, per, f] of gestures )
        await t.step(`${name}: each graph drawn ${per} times at most`, async () => {
            await t.E('window.__draws = 0'); await f(); await t.wait(2000);
            const n = await t.E('window.__draws');
            return n <= per * _n ? true : `${n} draws for ${_n} graphs`;
        });
    done(await t.close());
    return { passed, failed };
};
