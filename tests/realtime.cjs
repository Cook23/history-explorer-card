// Zooming the time in real time (the present shown) or looking at the history: the zoom
// buttons and the duration menu keep the present on the right in real time, the middle
// otherwise; the wheel and a pinch keep the present on the right only from the right of the
// plot area (10 % for the wheel, 20 % for a finger), else zoom around their own point
const { openCard } = require('./lib.cjs');

const card = extra => ({ type: 'custom:history-explorer-card', defaultTimeRange: '6', statistics: { enabled: false },
    graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }, { type: 'line', entities: [{ entity: 'sensor.rain' }] }], ...extra });

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    // The window: its start, end, middle (ms), whether it follows the present, how far its end is from now
    const win = t => t.E(`(()=>{ const i=el.instance, s=Date.parse(i.startTime), e=Date.parse(i.endTime);
        return { s, e, mid: (s + e) / 2, live: !!i.state.autoScroll && Date.now() >= s, fromNow: Math.round((Date.now() - e) / 1000) }; })()`);
    // A point of the plot area of graph 0, at factor f along it
    const plotPt = (t, f) => t.E(`(()=>{ const c=graphAt(0).chart, r=c.canvas.getBoundingClientRect(), A=c.chartArea;
        return { x: r.left + A.left + (A.right - A.left) * ${f}, y: r.top + (A.top + A.bottom) / 2 }; })()`);
    const select = (t, v) => t.E(`(()=>{ const s=el.querySelector('#by_0'); s.value='${v}'; s.dispatchEvent(new Event('change')); })()`);
    const toHistory = async t => { const p = await plotPt(t, 0.5); await t.drag(p, { x: p.x + 300, y: p.y }); await t.wait(1200); };
    const near = (a, b) => Math.abs(a - b) < 2000;

    // ── With a mouse ──
    let t = await openCard(card(), { mock: { series: true } });
    await t.wait(800);
    await t.step('real time: the zoom buttons and the duration menu keep the present on the right', async () => {
        const w0 = await win(t);
        await t.page.click('#b5_0'); await t.wait(800); const w1 = await win(t);
        await select(t, '48'); await t.wait(800); const w2 = await win(t);
        return w0.live && w1.live && w2.live && w1.e === w0.e && w2.e === w0.e && w1.e - w1.s < w0.e - w0.s ? true : JSON.stringify({ w0, w1, w2 });
    });
    await t.step('the history: the zoom buttons and the duration menu keep the middle — whatever the duration, 48 h as 3 h', async () => {
        await toHistory(t);
        const w0 = await win(t);
        await select(t, '3'); await t.wait(800); const w1 = await win(t);
        await t.page.click('#b4_0'); await t.wait(800); const w2 = await win(t);
        await select(t, '48'); await t.wait(800); const w3 = await win(t);
        return !w0.live && near(w1.mid, w0.mid) && near(w2.mid, w0.mid) && near(w3.mid, w0.mid) ? true : JSON.stringify({ w0, w1, w2, w3 });
    });
    const wheel = async f => { const p = await plotPt(t, f); await t.page.mouse.move(p.x, p.y); await t.page.keyboard.down('Control');
        await t.page.mouse.wheel(0, -100); await t.page.keyboard.up('Control'); await t.wait(1000); };
    await t.step('real time: the wheel in the right 10 % of the plot area keeps the present on the right', async () => {
        await t.E('el.instance.today()'); await t.wait(800);
        const w0 = await win(t); await wheel(0.95); const w1 = await win(t);
        return w0.live && w1.live && w1.e === w0.e && w1.e - w1.s < w0.e - w0.s ? true : JSON.stringify({ w0, w1 });
    });
    await t.step('real time: the wheel elsewhere zooms around the pointer, and leaves real time', async () => {
        await t.E('el.instance.today()'); await t.wait(800);
        const w0 = await win(t); await wheel(0.5); const w1 = await win(t);
        return w0.live && !w1.live && w1.e < w0.e ? true : JSON.stringify({ w0, w1 });
    });
    done(await t.close());

    // ── With fingers ──
    t = await openCard(card(), { touch: true, mock: { series: true } });
    await t.wait(800);
    // (two fingers 80 px apart around factor f, moving apart: a zoom in)
    const pinch = async f => { const c = await plotPt(t, f); await t.pinch(c, { x: -10, y: 0 }, { x: 10, y: 0 }); };
    await t.step('real time: a pinch with a finger in the right 20 % of the plot area keeps the present on the right', async () => {
        const w0 = await win(t); await pinch(0.85); const w1 = await win(t);
        return w0.live && w1.live && Math.abs(w1.fromNow) < 120 && w1.e - w1.s < w0.e - w0.s ? true : JSON.stringify({ w0, w1 });
    });
    await t.step('real time: a pinch elsewhere zooms around the fingers, and leaves real time', async () => {
        await t.E('el.instance.today()'); await t.wait(800);
        const w0 = await win(t); await pinch(0.4); const w1 = await win(t);
        return w0.live && !w1.live && w1.e - w1.s < w0.e - w0.s ? true : JSON.stringify({ w0, w1 });
    });
    done(await t.close());

    // ── From the first drawing ──
    // (the first layout of each chart: its time axis' span, in hours)
    const INIT = `(()=>{ let C; window.__first = {}; Object.defineProperty(window, 'HXLocal_Chart', { configurable: true,
        get(){ return C; }, set(v){ C = v; v.plugins.register({ afterLayout(c){ const s = c.scales && c.scales['x-axis-0'];
            if( s && !(c.id in window.__first) ) window.__first[c.id] = { h: (s.max - s.min) / 3600e3, ticks: s.ticks.length }; } }); } }); })();`;
    t = await openCard(card({ defaultTimeRange: '30m' }), { mock: { series: true }, init: INIT });
    await t.wait(800);
    await t.step('from the first drawing, the time axis shows the window (30 min) — not a whole day ticked every few minutes, hundreds of labels over each other', async () => {
        const f = Object.values(await t.E('window.__first'));
        return f.length && f.every(x => Math.abs(x.h - 0.5) < 0.02 && x.ticks <= 40) ? true : JSON.stringify(f);
    });
    done(await t.close());

    // ── A narrow card: the time labels that don't fit skipped ──
    t = await openCard(card(), { mock: { series: true } });
    await t.wait(800);
    // (each graph's time labels drawn: [their number, whether two of them overlap])
    const labels = () => t.E(`el.instance.graphsInDisplayOrder().map(g=>{ const s=g.chart.scales['x-axis-0'], ctx=g.chart.ctx;
        const shown=s.getTicks().map((k,i)=>({ x:s.getPixelForTick(i), l:k.label })).filter(k=>k.l!==undefined&&k.l!==null&&k.l!=='');
        ctx.save(); ctx.font='12px sans-serif'; const w=shown.map(k=>ctx.measureText(String(k.l)).width); ctx.restore();
        return [shown.length, shown.some((k,i)=>i>0 && k.x-shown[i-1].x < (w[i]+w[i-1])/2)]; })`);
    await t.step('a narrow card (168 px): the time labels that would overlap skipped — at full width, all of them', async () => {
        const wide = await labels();
        await t.E(`(()=>{ document.body.style.width='168px'; document.getElementById('host').style.width='168px'; })()`); await t.wait(1500);
        const narrow = await labels();
        return wide.every(([n, o]) => n >= 4 && !o) && narrow.every(([n, o]) => n >= 1 && !o) && narrow.some(([n], i) => n < wide[i][0]) ? true : JSON.stringify({ wide, narrow });
    });
    done(await t.close());

    return { passed, failed };
};
