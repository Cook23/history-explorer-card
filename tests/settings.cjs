// The options menu (menu and submenus: export, this card, every card) and the settings of
// every card: the gesture thresholds — long press duration and precision, for a mouse
// or a pen and for a finger — entered in the submenu (kept within their bounds), set in the
// YAML (gestures:), the last one to speak winning, saved on every device whatever the
// card's persistence options; the info panel's switch saved the same way
const { openCard } = require('./lib.cjs');

const YAML = (extra = {}) => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false },
    graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.rain' }] }], ...extra });

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };
    let t;

    const shown = sel => t.E(`(()=>{ const e=el.querySelector('${sel}'); return !!e && e.style.display !== 'none'; })()`);
    const items = sel => t.E(`[...el.querySelectorAll('${sel} > a, ${sel} > label')].filter(a=>a.style.display!=='none').map(a=>a.textContent.trim()).join(' | ')`);
    const openAll = async () => { await t.E(`el.querySelector('#bo_0').click()`); await t.wait(300); await t.E(`el.querySelector('#eo_0_all').click()`); await t.wait(300); };
    const enter = async (k, v) => { await t.E(`(()=>{ const i=el.querySelector('#eo_0_g_${k}'); i.value='${v}'; i.dispatchEvent(new Event('change')); })()`); await t.wait(300); };
    const inputs = () => t.E(`Object.fromEntries(['longPress','longPressTouch','precision','precisionTouch','readingTimePerWord'].map(k=>[k, +el.querySelector('#eo_0_g_'+k).value]))`);
    const chartG = () => t.E(`JSON.stringify(graphAt(0).chart.constructor.defaults.global.gestures)`);
    const reload = async (cfg) => {
        if( cfg ) { const name = await t.E('window.CFG.cardName'); await t.page.addInitScript(c => { window.CFG = c; }, { ...cfg, cardName: name }); }
        await t.page.reload(); await t.wait(3500);
    };
    const newDevice = async (cfg) => { await t.E('localStorage.clear()'); await reload(cfg); };
    const typeMenuOpen = () => t.E(`getComputedStyle(el.querySelector('#et_0')).display !== 'none'`);
    const closeMenus = async () => { await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 5); await t.wait(400); };
    // A press held ms on a curve label (mouse)
    const hold = async ms => { const p = await t.E('legendPt(0,0)'); const m = t.page.mouse; await m.move(p.x, p.y); await m.down(); await t.wait(ms); await m.up(); await t.wait(400); };

    t = await openCard(YAML(), { mock: { series: true } });
    await t.wait(800);
    await t.step('the options menu: the sections for every curve of the card (Display ▸, Appearance ▸, Interpolation ▸, Behavior ▸), Export ▸, Card ▸, Global ▸; Global: the info panel, the four thresholds and the reading time of a word, as they are', async () => {
        await t.E(`el.querySelector('#bo_0').click()`); await t.wait(300);
        const m = await items('#eo_0');
        await t.E(`el.querySelector('#eo_0_export').click()`); await t.wait(300);
        const ex = await items('#eo_0_export_sub');
        await t.E(`el.querySelector('#eo_0_all').click()`); await t.wait(300);
        const r = { m, ex, exportClosed: !(await shown('#eo_0_export_sub')), all: await items('#eo_0_all_sub'), v: await inputs() };
        await closeMenus();
        return r.m === 'Display ▸ | Appearance ▸ | Interpolation ▸ | Behavior ▸ | Export ▸ | Card ▸ | Global ▸' && r.ex === 'History' && r.exportClosed
            && /Enhanced native history/.test(r.all) && /Long press, mouse and pen/.test(r.all) && /Precision, finger/.test(r.all) && /Reading time per word/.test(r.all)
            && JSON.stringify(r.v) === JSON.stringify({ longPress: 500, longPressTouch: 500, precision: 8, precisionTouch: 12, readingTimePerWord: 300 }) ? true : JSON.stringify(r);
    });
    // With submenu sub of menu open: '' when the menu's lines are readable beside it (its
    // text clear of the submenu) — the last line's submenu: no wider than the menu —, else
    // what's wrong
    const readable = (menu, sub, last) => t.E(`(()=>{ const m=el.querySelector('${menu}').getBoundingClientRect(), s=el.querySelector('${sub}').getBoundingClientRect();
        if( ${last} ) return s.width <= m.width + 0.5 ? '' : 'last submenu wider than the menu: '+s.width+' > '+m.width;
        const r=document.createRange(); const bad=[...el.querySelector('${menu}').children].filter(a=>a.tagName==='A'&&a.style.display!=='none')
            .filter(a=>{ r.selectNodeContents(a); return r.getBoundingClientRect().right > s.left; }).map(a=>a.textContent.trim());
        return bad.length ? 'hidden by the submenu: '+bad.join(', ') : ''; })()`);
    await t.step('a menu is wider than its submenus: its lines readable beside each — the last line\'s submenu, the menu\'s width at most', async () => {
        const r = {};
        for( const [k, last] of [['export', false], ['card', false], ['all', true]] ) {
            await t.E(`el.querySelector('#bo_0').click()`); await t.wait(300);
            await t.E(`el.querySelector('#eo_0_${k}').click()`); await t.wait(300);
            r[k] = await readable('#eo_0', `#eo_0_${k}_sub`, last); await closeMenus();
        }
        await hold(800); await t.wait(400);
        r.rep = await readable('#et_0', '#et_0_rep_sub', false);
        await t.E(`el.querySelector('#et_0_behavior').click()`); await t.wait(300);
        r.behavior = await readable('#et_0', '#et_0_behavior_sub', false); await closeMenus();
        return Object.values(r).every(v => v === '') ? true : JSON.stringify(r);
    });
    await t.step('a card too narrow for a menu and a submenu beside its lines: the menu opens alone; a submenu opened leaves 48 px and three characters of its lines; Escape or a click beside closes it', async () => {
        await t.E(`(()=>{ document.body.style.width='230px'; document.getElementById('host').style.width='230px'; })()`); await t.wait(1200);
        await hold(800); await t.wait(400);
        const r = await t.E(`(()=>{ const m=el.querySelector('#et_0'); return { cramped: m.dataset.cramped, open: [...el.querySelectorAll('[id^="et_0_"][id$="_sub"]')].filter(s=>s.style.display!=='none').map(s=>s.id) }; })()`);
        await t.E(`el.querySelector('#et_0_rep').click()`); await t.wait(300);
        const strip = await t.E(`(()=>{ const m=el.querySelector('#et_0'), s=el.querySelector('#et_0_rep_sub').getBoundingClientRect(), mr=m.getBoundingClientRect();
            const lines=[...m.children].filter(a=>a.tagName==='A'&&a.style.display!=='none');
            const cut=lines.filter(a=>{ const t=document.createTreeWalker(a,NodeFilter.SHOW_TEXT).nextNode(); const g=document.createRange(); g.setStart(t,0); g.setEnd(t,Math.min(3,t.length)); return g.getBoundingClientRect().right > s.left; }).map(a=>a.textContent);
            return { left: Math.round(s.left - mr.left), cut, within: s.right <= mr.right + 0.5 }; })()`);
        await closeMenus();
        // (opened alone, it has the keyboard: Escape closes it, and so does a click beside it)
        const isOpen = () => t.E(`el.querySelector('#et_0').style.display !== 'none'`);
        await hold(800); await t.wait(300); await t.page.keyboard.press('Escape'); await t.wait(300); const afterEscape = await isOpen();
        await hold(800); await t.wait(300); await t.page.mouse.click(5, 5); await t.wait(400); const afterClick = await isOpen();
        await t.E(`(()=>{ document.body.style.width='1000px'; document.getElementById('host').style.width=''; })()`); await t.wait(1200);
        return r.cramped === '1' && !r.open.length && strip.left >= 48 && !strip.cut.length && strip.within && !afterEscape && !afterClick ? true : JSON.stringify({ r, strip, afterEscape, afterClick });
    });
    await t.step('a value entered is kept within its bounds, and given to Chart.js for every chart', async () => {
        await openAll(); await enter('longPress', 99999); await enter('precision', 1);
        const v = await inputs(), g = JSON.parse(await chartG()); await closeMenus();
        return v.longPress === 2000 && v.precision === 4 && g.mouse.longPressMs === 2000 && g.mouse.slop === 4 && g.touch.longPressMs === 500 ? true : JSON.stringify({ v, g });
    });
    await t.step('the reading time of a word: 300 ms by default — a text of 3 words up 0.5 s + 3 × 300 ms; entered 99999: kept at 1000, given to Chart.js; 400: 0.5 s + 3 × 400 ms', async () => {
        const time = () => t.E(`graphAt(0).chart.constructor.hecUi.readingTime('Outside temperature now')`);
        const d = await time();
        await openAll(); await enter('readingTimePerWord', 99999); const v = await inputs(), g = JSON.parse(await chartG());
        await enter('readingTimePerWord', 400); await closeMenus(); const s = await time();
        return d === 1400 && v.readingTimePerWord === 1000 && g.readingWordMs === 1000 && s === 1700 ? true : JSON.stringify({ d, v, g, s });
    });
    await t.step('the long press duration: 1200 ms — a press of 800 ms opens no type menu, one of 1500 ms does', async () => {
        await openAll(); await enter('longPress', 1200); await enter('precision', 10); await closeMenus();
        await hold(800); const short = await typeMenuOpen(); await closeMenus();
        await hold(1500); const long = await typeMenuOpen(); await closeMenus();
        return !short && long ? true : JSON.stringify({ short, long });
    });
    await t.step('the precision: 20 px — a move of 15 px on the plot is no drag (the time stays), one of 60 px is', async () => {
        await openAll(); await enter('precision', 20); await closeMenus();
        const st = () => t.E('el.instance.startTime');
        const p = await t.E('graphPtAt(0,0.6)');
        const s0 = await st(); await t.drag(p, { x: p.x + 15, y: p.y }); await t.wait(800); const s1 = await st();
        await t.drag(p, { x: p.x + 60, y: p.y }); await t.wait(800); const s2 = await st();
        return s1 === s0 && s2 !== s1 ? true : JSON.stringify({ s0, s1, s2 });
    });
    await t.step('the precision is also how near a target must be: 15 px beside a label, picked at 20 px, not at 8', async () => {
        const beside = async () => { const p = await t.E(`(()=>{ const c=graphAt(0).chart, b=c.legend.legendHitBoxes[1], r=c.canvas.getBoundingClientRect();
            return { x: r.left+b.left+b.width+15, y: r.top+b.top+b.height/2 }; })()`);
            const m = t.page.mouse; await m.move(p.x, p.y); await m.down(); await t.wait(1500); await m.up(); await t.wait(400); };
        await openAll(); await enter('precision', 20); await closeMenus();
        await beside(); const at20 = await typeMenuOpen(); await closeMenus();
        await openAll(); await enter('precision', 8); await closeMenus();
        await beside(); const at8 = await typeMenuOpen(); await closeMenus();
        await openAll(); await enter('precision', 20); await closeMenus();
        return at20 && !at8 ? true : JSON.stringify({ at20, at8 });
    });
    await t.step('saved on every device, without any persistence option: kept after a reload, and on a new device', async () => {
        await reload(); await openAll(); const a = await inputs(); await closeMenus();
        await newDevice(); await openAll(); const b = await inputs(); await closeMenus();
        return a.longPress === 1200 && a.precision === 20 && b.longPress === 1200 && b.precision === 20 ? true : JSON.stringify({ a, b });
    });
    await t.step('the YAML speaks (gestures: longPress 800): it wins; the menu then speaks: it wins, the YAML unchanged', async () => {
        await reload(YAML({ gestures: { longPress: 800 } })); await openAll(); const a = await inputs(); await enter('longPress', 600); await closeMenus();
        await reload(YAML({ gestures: { longPress: 800 } })); await openAll(); const b = await inputs(); await closeMenus();
        return a.longPress === 800 && a.precision === 20 && b.longPress === 600 ? true : JSON.stringify({ a, b });
    });
    await t.step('another device changes it (in Home Assistant): this device takes it at its next load', async () => {
        await t.E(`window.__setUD('history-explorer-gestures', { longPress: 700, longPressTouch: 900, precision: 12, precisionTouch: 20 })`);
        await reload(YAML({ gestures: { longPress: 800 } })); await openAll(); const v = await inputs(); await closeMenus();
        return JSON.stringify(v) === JSON.stringify({ longPress: 700, longPressTouch: 900, precision: 12, precisionTouch: 20, readingTimePerWord: 400 }) ? true : JSON.stringify(v);
    });
    await t.step('the info panel switch (Enhanced native history): no confirmation, a click switches it; saved on every device without any persistence option', async () => {
        const sw = () => t.E(`el.querySelector('#ei_0').getAttribute('aria-checked')`);
        await openAll(); const off = await sw();
        await t.E(`el.querySelector('#ei_0').click()`); await t.wait(800);
        await openAll(); const on = await sw(); const asked = await t.E(`!!el.querySelector('#ei_0_sub')`); await closeMenus();
        await newDevice(YAML({ gestures: { longPress: 800 } })); await openAll();
        const after = await sw(); await closeMenus();
        return off === 'false' && on === 'true' && !asked && after === 'true' ? true : JSON.stringify({ off, on, asked, after });
    });
    done(await t.close());

    // ── Every language's options menu no wider than the French one (the one tried on screen) ──
    t = await openCard(YAML(), { mock: { series: true } });
    await t.step('the options menu and its submenus, a bar graph\'s intervals: in every language, no wider than in French (5 % more at most)', async () => {
        const src = require('fs').readFileSync(require('path').join(__dirname, '../src/languages.js'), 'utf8');
        const MENUS = { options: ['options_export', 'options_card', 'options_all'], export: ['export_csv', 'export_stats'],
                        card: ['default_graphs', 'default_display'], confirm: ['confirm_ok', 'confirm_cancel'],
                        interval: ['_10m', 'hourly', 'daily', 'weekly', 'monthly', 'rawline'] };
        const langs = {};
        for( const m of src.matchAll(/const lang_(\w+) =([\s\S]*?)\n};?\n/g) ) {
            langs[m[1]] = {};
            for( const k of Object.values(MENUS).flat() ) { const r = new RegExp('"' + k + '"\\s*:\\s*"([^"]*)"').exec(m[2]); if( r ) langs[m[1]][k] = r[1]; }
        }
        const wider = await t.E(`(()=>{ const L=${JSON.stringify(langs)}, M=${JSON.stringify(MENUS)}, c=document.createElement('canvas').getContext('2d');
            c.font='14px Roboto, Noto, sans-serif'; const w=(m,t)=>c.measureText(t+(m==='options'?' ▸':'')).width; const out=[];
            for( const m in M ) { const fr=Math.max(...M[m].map(k=>w(m,L.fr[k])));
                for( const l in L ) { const x=Math.max(...M[m].map(k=>w(m,L[l][k]??''))); if( x>fr*1.05 ) out.push(m+' '+l+' '+Math.round(x)+'>'+Math.round(fr)); } }
            return out; })()`);
        return Object.keys(langs).length >= 10 && !wider.length ? true : JSON.stringify(wider);
    });
    done(await t.close());

    return { passed, failed };
};
