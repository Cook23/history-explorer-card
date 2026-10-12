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
    const inputs = () => t.E(`Object.fromEntries(['longPress','longPressTouch','precision','precisionTouch'].map(k=>[k, +el.querySelector('#eo_0_g_'+k).value]))`);
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
    await t.step('the options menu: Export ▸, This card ▸, All cards ▸; All cards: the info panel and the four thresholds, as they are', async () => {
        await t.E(`el.querySelector('#bo_0').click()`); await t.wait(300);
        const m = await items('#eo_0');
        await t.E(`el.querySelector('#eo_0_export').click()`); await t.wait(300);
        const ex = await items('#eo_0_export_sub');
        await t.E(`el.querySelector('#eo_0_all').click()`); await t.wait(300);
        const r = { m, ex, exportClosed: !(await shown('#eo_0_export_sub')), all: await items('#eo_0_all_sub'), v: await inputs() };
        await closeMenus();
        return r.m === 'Export ▸ | This card ▸ | All cards ▸' && /CSV/.test(r.ex) && r.exportClosed
            && /panel/i.test(r.all) && /Long press, mouse and pen/.test(r.all) && /Precision, finger/.test(r.all)
            && JSON.stringify(r.v) === JSON.stringify({ longPress: 500, longPressTouch: 500, precision: 8, precisionTouch: 12 }) ? true : JSON.stringify(r);
    });
    await t.step('a value entered is kept within its bounds, and given to Chart.js for every chart', async () => {
        await openAll(); await enter('longPress', 99999); await enter('precision', 1);
        const v = await inputs(), g = JSON.parse(await chartG()); await closeMenus();
        return v.longPress === 2000 && v.precision === 2 && g.mouse.longPressMs === 2000 && g.mouse.slop === 2 && g.touch.longPressMs === 500 ? true : JSON.stringify({ v, g });
    });
    await t.step('the long press duration: 1200 ms — a press of 800 ms opens no type menu, one of 1500 ms does', async () => {
        await openAll(); await enter('longPress', 1200); await enter('precision', 10); await closeMenus();
        await hold(800); const short = await typeMenuOpen(); await closeMenus();
        await hold(1500); const long = await typeMenuOpen(); await closeMenus();
        return !short && long ? true : JSON.stringify({ short, long });
    });
    await t.step('the precision: 40 px — a move of 25 px on the plot is no drag (the time stays), one of 80 px is', async () => {
        await openAll(); await enter('precision', 40); await closeMenus();
        const st = () => t.E('el.instance.startTime');
        const p = await t.E('graphPtAt(0,0.6)');
        const s0 = await st(); await t.drag(p, { x: p.x + 25, y: p.y }); await t.wait(800); const s1 = await st();
        await t.drag(p, { x: p.x + 80, y: p.y }); await t.wait(800); const s2 = await st();
        return s1 === s0 && s2 !== s1 ? true : JSON.stringify({ s0, s1, s2 });
    });
    await t.step('the precision is also how near a target must be: 20 px beside a label, picked at 30 px, not at 8', async () => {
        const beside = async () => { const p = await t.E(`(()=>{ const c=graphAt(0).chart, b=c.legend.legendHitBoxes[1], r=c.canvas.getBoundingClientRect();
            return { x: r.left+b.left+b.width+20, y: r.top+b.top+b.height/2 }; })()`);
            const m = t.page.mouse; await m.move(p.x, p.y); await m.down(); await t.wait(1500); await m.up(); await t.wait(400); };
        await openAll(); await enter('precision', 30); await closeMenus();
        await beside(); const at30 = await typeMenuOpen(); await closeMenus();
        await openAll(); await enter('precision', 8); await closeMenus();
        await beside(); const at8 = await typeMenuOpen(); await closeMenus();
        await openAll(); await enter('precision', 40); await closeMenus();
        return at30 && !at8 ? true : JSON.stringify({ at30, at8 });
    });
    await t.step('saved on every device, without any persistence option: kept after a reload, and on a new device', async () => {
        await reload(); await openAll(); const a = await inputs(); await closeMenus();
        await newDevice(); await openAll(); const b = await inputs(); await closeMenus();
        return a.longPress === 1200 && a.precision === 40 && b.longPress === 1200 && b.precision === 40 ? true : JSON.stringify({ a, b });
    });
    await t.step('the YAML speaks (gestures: longPress 800): it wins; the menu then speaks: it wins, the YAML unchanged', async () => {
        await reload(YAML({ gestures: { longPress: 800 } })); await openAll(); const a = await inputs(); await enter('longPress', 600); await closeMenus();
        await reload(YAML({ gestures: { longPress: 800 } })); await openAll(); const b = await inputs(); await closeMenus();
        return a.longPress === 800 && a.precision === 40 && b.longPress === 600 ? true : JSON.stringify({ a, b });
    });
    await t.step('another device changes it (in Home Assistant): this device takes it at its next load', async () => {
        await t.E(`window.__setUD('history-explorer-gestures', { longPress: 700, longPressTouch: 900, precision: 12, precisionTouch: 20 })`);
        await reload(YAML({ gestures: { longPress: 800 } })); await openAll(); const v = await inputs(); await closeMenus();
        return JSON.stringify(v) === JSON.stringify({ longPress: 700, longPressTouch: 900, precision: 12, precisionTouch: 20 }) ? true : JSON.stringify(v);
    });
    await t.step('the info panel switch: saved on every device without any persistence option', async () => {
        t.page.once('dialog', d => d.accept());
        await openAll(); await t.E(`el.querySelector('#ei_0').click()`); await t.wait(800);
        const on = await t.E(`el.querySelector('#ei_0').textContent`);
        await newDevice(YAML({ gestures: { longPress: 800 } })); await openAll();
        const after = await t.E(`el.querySelector('#ei_0').textContent`); await closeMenus();
        return /disable/i.test(on) && /disable/i.test(after) ? true : JSON.stringify({ on, after });
    });
    done(await t.close());

    return { passed, failed };
};
