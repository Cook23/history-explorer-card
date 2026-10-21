// The type menu's Appearance submenu — a curve's color, points, extremes, fill, line width
// and style, or every curve's of a graph —, the switches, the menus showing a choice half a
// second before they close, and the info panel showing a curve as it looks on the card
const { openCard } = require('./lib.cjs');

const card = () => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false },
    graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power_kw' }] },
             { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }] }] });

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    // The appearance submenu's lines: name, then (on) / (off) for a switch, * when in bold
    const lines = t => t.E(`[...el.querySelectorAll('#et_0_appearance_sub a')].map(a=>a.textContent+(a.getAttribute('role')==='switch'?' ('+(a.getAttribute('aria-checked')==='true'?'on':'off')+')':'')+(a.style.fontWeight==='bold'?'*':'')).join(' | ')`);
    const line = (t, i) => t.E(`el.querySelector('#et_0_appearance_sub').querySelectorAll('a')[${i}].click()`);
    const menuOpen = t => t.E(`el.querySelector('#et_0').style.display !== 'none'`);
    const ds = (t, gi, k) => t.E(`(()=>{ const d=graphAt(${gi}).chart.data.datasets[${k}]; return { color: d.borderColor, width: d.borderWidth, dash: d.borderDash ?? null, fade: !!d.hecFillFade, fill: d.backgroundColor, minmax: d.showMinMax, r: d.pointRadius }; })()`);
    const curveMenu = async (t, gi, li) => {
        await t.longPress(await t.E(`legendPt(${gi},${li})`));
        await t.E(`el.querySelector('#et_0_appearance').click()`); await t.wait(200);
    };
    const closeMenu = async t => { await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 880); await t.wait(700); };

    let t = await openCard(card(), { height: 900 });
    await t.step('a curve\'s menu: Appearance after Display; its lines — Color, Points and Extremes (switches, off), Fill, Width, Line style', async () => {
        await curveMenu(t, 0, 0);
        const m = await t.E(`[...el.querySelectorAll('#et_0 > a')].filter(a=>a.style.display!=='none').map(a=>a.textContent).join(' | ')`);
        const l = await lines(t); await closeMenu(t);
        return m.startsWith('Display ▸ | Appearance ▸ | Interpolation ▸ | Layout ▸') && l === 'Color | Points (off) | Extremes (off) | Fill ▸ | Width ▸ | Line style ▸' ? true : `${m} / ${l}`;
    });
    await t.step('Points: the curve\'s dots shown, the switch on, the menu open half a second, then closed; again: hidden', async () => {
        await curveMenu(t, 0, 0); await line(t, 1); await t.wait(150);
        const r = { l: await lines(t), open: await menuOpen(t), dots: (await ds(t, 0, 0)).r };
        await t.wait(700); r.later = await menuOpen(t);
        await curveMenu(t, 0, 0); await line(t, 1); await t.wait(800); r.off = (await ds(t, 0, 0)).r;
        return r.l.includes('Points (on)') && r.open && r.dots > 0 && !r.later && r.off === 0 ? true : JSON.stringify(r);
    });
    await t.step('Extremes: the min/max band on, saved; the other curve as it was', async () => {
        await curveMenu(t, 0, 0); await line(t, 2); await t.wait(150);
        const l = await lines(t); await t.wait(800);
        const a = await ds(t, 0, 0), b = await ds(t, 0, 1), saved = await t.E('graphAt(0).entities[0].showMinMax');
        return l.includes('Extremes (on)') && a.minmax === true && !b.minmax && saved === true ? true : JSON.stringify({ l, a, b, saved });
    });
    await t.step('Fill ▸: its list in the submenu itself (the palette\'s fill: Solid in bold); Fade chosen: the curve fading out; Escape back to the lines', async () => {
        await curveMenu(t, 0, 0); await line(t, 3); await t.wait(150);
        const l0 = await lines(t);
        await t.E(`[...el.querySelectorAll('#et_0_appearance_sub a')].find(a=>a.textContent==='Fade').click()`); await t.wait(150);
        const l1 = await lines(t);
        await t.page.keyboard.press('Escape'); await t.wait(150);
        const l2 = await lines(t); await t.wait(800);
        const d = await ds(t, 0, 0), saved = await t.E('graphAt(0).entities[0].fill');
        return l0 === 'None | Solid* | Fade' && l1 === 'None | Solid | Fade*' && l2.startsWith('Color |') && d.fade && saved === 'fade' ? true : JSON.stringify({ l0, l1, l2, d, saved });
    });
    await t.step('Width ▸ 4 px and Line style ▸ Short dashes: the curve drawn so', async () => {
        await curveMenu(t, 0, 0); await line(t, 4); await t.wait(150);
        const w = await lines(t);
        await t.E(`[...el.querySelectorAll('#et_0_appearance_sub a')].find(a=>a.textContent==='4 px').click()`); await t.wait(800);
        await curveMenu(t, 0, 0); await line(t, 5); await t.wait(150);
        const s = await lines(t);
        await t.E(`[...el.querySelectorAll('#et_0_appearance_sub a')].find(a=>a.textContent==='Short dashes').click()`); await t.wait(800);
        const d = await ds(t, 0, 0);
        return w === '1 px | 2 px* | 3 px | 4 px | 5 px' && s === 'Solid* | Dots | Short dashes | Long dashes | Dash-dot' && d.width === 4 && d.dash?.join() === '5,5' ? true : JSON.stringify({ w, s, d });
    });
    await t.step('Color: the browser\'s color picker, the curve\'s color preselected, the menu closed; a color picked: the curve\'s', async () => {
        await curveMenu(t, 0, 1); await line(t, 0); await t.wait(300);
        const p = await t.E(`(()=>{ const i=el.querySelector('#tb_0')._pickers?.color; return i ? { type: i.type, value: i.value } : null; })()`);
        const open = await menuOpen(t);
        await t.E(`(()=>{ const i=el.querySelector('#tb_0')._pickers.color; i.value='#ff0000'; i.dispatchEvent(new Event('change')); })()`); await t.wait(800);
        const d = await ds(t, 0, 1), saved = await t.E('graphAt(0).entities[1].color');
        return p?.type === 'color' && /^#[0-9a-f]{6}$/i.test(p.value) && !open && /255,\s*0,\s*0|#ff0000/i.test(d.color) && saved === '#ff0000' ? true : JSON.stringify({ p, open, d, saved });
    });
    await t.step('a timeline row\'s menu: no Appearance', async () => {
        await t.longPress(await t.E('tlPt(1,0)'));
        const a = await t.E(`el.querySelector('#et_0_appearance').style.display`); await closeMenu(t);
        return a === 'none' ? true : a;
    });
    await t.step('the graph\'s menu: Appearance without Color, for every curve; Width 3 px: both curves', async () => {
        await t.E(`(()=>{ const I=el.instance; I.showGraphMenu(0, I.graphsInDisplayOrder()[0], 100, 100, false); I.showTypeSubmenu(0, 'appearance'); })()`); await t.wait(200);
        const l = await lines(t); await line(t, 3); await t.wait(150);
        await t.E(`[...el.querySelectorAll('#et_0_appearance_sub a')].find(a=>a.textContent==='3 px').click()`); await t.wait(800);
        const a = await ds(t, 0, 0), b = await ds(t, 0, 1);
        return l === 'Points (off) | Extremes (off) | Fill ▸ | Width ▸ | Line style ▸' && a.width === 3 && b.width === 3 ? true : JSON.stringify({ l, a, b });
    });
    await t.step('the graph\'s menu: Y axis locked, a switch — on: the axis locked, the menu open half a second', async () => {
        await t.E(`(()=>{ const I=el.instance; I.showGraphMenu(0, I.graphsInDisplayOrder()[0], 100, 100, false); I.showTypeSubmenu(0, 'layout'); })()`); await t.wait(200);
        const s0 = await t.E(`el.querySelector('#et_0_ylock').getAttribute('aria-checked')`);
        await t.E(`el.querySelector('#et_0_ylock').click()`); await t.wait(150);
        const r = { s0, s1: await t.E(`el.querySelector('#et_0_ylock').getAttribute('aria-checked')`), open: await menuOpen(t), locked: await t.E('!!graphAt(0).chart._hecYAxisLock') };
        await t.wait(700); r.later = await menuOpen(t);
        await t.E('graphAt(0).chart.hecSetYAxisLocked(false)');
        return r.s0 === 'false' && r.s1 === 'true' && r.open && r.locked && !r.later ? true : JSON.stringify(r);
    });
    await t.step('Global ▸ Enhanced native history: a switch, no confirmation; clicked: the info panel switched, the menu open half a second', async () => {
        await t.E(`el.querySelector('#bo_0').click()`); await t.wait(200);
        await t.E(`el.instance.showOptionsSubmenu(0, 'all')`); await t.wait(200);
        const ei = () => t.E(`[el.querySelector('#ei_0').textContent, el.querySelector('#ei_0').getAttribute('aria-checked')]`);
        const a = await ei();
        await t.E(`el.querySelector('#ei_0').click()`); await t.wait(150);
        const b = await ei(), open = await t.E(`el.querySelector('#eo_0').style.display !== 'none'`), sub = await t.E(`!!el.querySelector('#ei_0_sub')`);
        await t.wait(700); const later = await t.E(`el.querySelector('#eo_0').style.display !== 'none'`);
        await t.E(`el.querySelector('#bo_0').click()`); await t.wait(200); await t.E(`el.instance.showOptionsSubmenu(0, 'all')`); await t.wait(200);
        await t.E(`el.querySelector('#ei_0').click()`); await t.wait(800); const c = await ei();
        return a[0] === 'Enhanced native history' && a[1] !== b[1] && c[1] === a[1] && open && !sub && !later ? true : JSON.stringify({ a, b, c, open, sub, later });
    });
    done(await t.close());

    // ── The info panel: its type menu's title, and a curve shown as it looks on the card ──
    t = await openCard({}, { page: 'panel.html', panel: {}, mock: { series: true }, height: 800 });
    await t.E(`openPanel('sensor.power')`); await t.wait(2500);
    await t.step('the info panel\'s type menu: its title with its line under it, never in a box (a box: an entity being added, or added again)', async () => {
        await t.E(`(()=>{ const I=inst(); const g=I.graphs[0]; I.showEntityTypeMenu(0, g.entities[0].entity, g, { from: 'panel', align: 'center' }); })()`); await t.wait(200);
        const b = await t.E(`(()=>{ const s=inst()._this.querySelector('#et_0_title').style; return [s.borderTopStyle||'', s.borderBottomStyle||'']; })()`);
        const ap = await t.E(`inst()._this.querySelector('#et_0_appearance').style.display`);
        return b[0] === '' && b[1] === 'solid' && ap !== 'none' ? true : JSON.stringify({ b, ap });
    });
    await t.step('opened from a curve of the card: the panel shows it as it looks there — its line mode, color, width, style, fill and extremes; opened again from elsewhere: as before', async () => {
        await t.E(`(()=>{ const I=inst(); I.openEntityInfo({ entity: 'sensor.power', type: 'line', lineMode: 'stepped', color: '#ff0000', width: 4, dashMode: 'shortlines', fill: 'fade', showMinMax: true }, I.graphs[0]);
            P.remove(); openPanel('sensor.power'); })()`); await t.wait(2500);
        const d = await t.E(`(()=>{ const d=inst().graphs[0].chart.data.datasets[0]; return { color: d.borderColor, width: d.borderWidth, dash: (d.borderDash||[]).join(), fade: !!d.hecFillFade, minmax: d.showMinMax, mode: inst().graphs[0].entities[0].lineMode }; })()`);
        await t.E(`(()=>{ P.remove(); openPanel('sensor.power'); })()`); await t.wait(2500);
        const e = await t.E(`(()=>{ const d=inst().graphs[0].chart.data.datasets[0]; return { width: d.borderWidth, dash: (d.borderDash||[]).join(), fade: !!d.hecFillFade }; })()`);
        return /255,\s*0,\s*0|#ff0000/i.test(d.color) && d.width === 4 && d.dash === '5,5' && d.fade && d.minmax && d.mode === 'stepped' && e.width !== 4 && e.dash === '' && !e.fade ? true : JSON.stringify({ d, e });
    });
    done(await t.close());

    return { passed, failed };
};
