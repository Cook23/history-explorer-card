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

    return { passed, failed };
};
