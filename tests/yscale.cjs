// The automatic Y axis (card-yscale.js, card-charts.js _autoYAxis), an automatic gain: what
// is shown first — always in the axis, filling at least half its height at rest —, a steady
// scale second — a small pan keeps it; a pan towards a value grows it in round steps before it
// shows, a pan away narrows it a step at a time —; yScaleSteadiness at the card's and at a
// graph's level; a rain at 0 shown from 0.
// The curve's rows are put in the card's cache as Home Assistant would give them (its
// requests made to fail, so that nothing replaces them), then drawn.
const { openCard } = require('./lib.cjs');
const dataset = require('./dataset.cjs');

const FAIL = ['history/history_during_period', 'recorder/statistics_during_period'];
const card = (range, more = {}, graph = {}) => ({ type: 'custom:history-explorer-card', defaultTimeRange: range, statistics: { enabled: false }, ...more,
    graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }], ...graph }] });

// In the page: rows (f: a function given now and the rows' maker H) put in today's and
// yesterday's slots, the curve drawn again; then the left axis' bounds and what is shown
// in the window
const draw = f => `(()=>{
    const I = el.instance, id = 'sensor.power', now = Date.now(), last = I.cache.length - 1;
    for( const s of I.cache ) for( const l of ['hist', 'fine', 'stats', 'day'] ) s[l].delete(id);
    const H = (t, v) => ({ last_changed: t, state: String(v) });
    const rows = (${f})(now, H);
    for( const k of [0, 1] ) {
        const s = I.cache[last - k], a = s.start_m.valueOf(), b = s.end_m.valueOf();
        s.hist.set(id, rows.filter(r => r.last_changed >= a && r.last_changed < b)); s.cover.hist.set(id, [[a, b]]);
    }
    I.generateGraphDataFromCache();
    return axis();
})()`;
const AXIS = `window.axis = () => {
    const I = el.instance, c = I.graphs[0].chart, sc = c.scales['y-axis-0'];
    const t0 = Date.parse(I.startTime), t1 = Date.parse(I.endTime);
    const v = c.data.datasets[0].data.filter(p => p.y !== null && p.x >= t0 && p.x <= t1).map(p => p.y);
    return { min: sc.min, max: sc.max, step: sc._hecStep, lo: Math.min(...v), hi: Math.max(...v) };
};`;
// (a value every 5 minutes over the last two days, v(t); a spike of 10843 six hours ago)
const SPIKE = `(now, H) => { const r = []; for( let t = now - 47 * 3600e3; t < now; t += 300e3 ) r.push(H(t, Math.abs(t - ( now - 6 * 3600e3 )) < 600e3 ? 10843 : 26.8 + ( Math.floor(t / 300e3) % 7 ) * 932)); return r; }`;
const fills = a => ( a.hi - a.lo ) / ( a.max - a.min );

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    // ── The bounds the card gives: values, never rounded — the ticks (round bounds, their step)
    // are Chart.js' (card-yscale.js chooseYAxis, card-charts.js _autoYAxis) ──
    {
        const { chooseYAxis } = await import('../src/card-yscale.js');
        const step = (name, ok) => { if( ok === true ) { passed++; console.log('  ✓ ' + name); } else { failed++; console.log('  ✗ ' + name + '  -> ' + ok); } };
        const _a = a => `${a.min}..${a.max}`;
        // (a year -3 to 37.6, a value of 42.4 at 5.8 months after its end, in the zone on its right)
        const Y = 365 * 864e5, t0 = 0, t1 = Y, side = t1 + 5.8 / 12 * Y;
        const rangeOf = (a, b) => { const v = []; if( a < t1 && b > t0 ) v.push(-3, 37.6); if( a <= side && side < b ) v.push(42.4); return v.length ? { lo: Math.min(...v), hi: Math.max(...v) } : null; };
        const f = chooseYAxis(null, rangeOf, t0, t1, { steady: 0 });
        step('steady 0: the bounds are the values shown, as they are (-3 to 37.6), never rounded', f.min === -3 && f.max === 37.6 ? true : _a(f));
        const g = chooseYAxis({ min: -3, max: 37.6, t0, t1 }, rangeOf, t0, t1);
        step('the year -3 to 37.6, 42.4 in the zone on its right: the bounds grown towards it, by its weight — values, not a round axis', g.min === -3 && g.max > 37.6 && g.max < 42.4 && !Number.isInteger(g.max) ? true : _a(g));
    }

    // ── Chart.js' ticks of an axis given neither a step nor a bound (deps/chart-hec.js
    // Chart.hecNiceTicks): the tightest round axis holding the values, within the ticks its
    // height allows — whatever the values ──
    {
        let t = await openCard(card('3h'), { height: 900, mock: { series: true, fail: FAIL } });
        await t.step('any values — every size from 1e-12 to 1e15 and 1e±300, either sign, equal, a span a billionth of them — and 2 to 11 ticks: ticks of one step of 1, 2, 5 × 10ⁿ, its exact multiples, holding the values, within a step of them, as many as allowed (3 across 0), the next step down needing more', async () => {
            const r = await t.E(`(()=>{
                const T = window.HXLocal_Chart.hecNiceTicks, bad = [];
                let seed = 7; const rnd = () => ( seed = ( seed * 1103515245 + 12345 ) % 2147483648 ) / 2147483648;
                const cases = [[-3, 42.4], [0, 2900], [0, 0], [5, 5], [-5, -5], [0.1, 0.3], [-1e-300, 1e-300], [1e300, 1.5e300]];
                for( const m of [1e-12, 1e-6, 0.02, 0.5, 1, 7, 42.4, 100, 12345, 1e9, 1e15] ) for( const sp of [1e-9, 1e-4, 0.1, 1, 1.5, 3, 1e3] ) for( const sg of [-1, 0, 1] ) cases.push([sg * m, sg * m + sp * m]);
                for( let k = 0; k < 20000; k++ ) { const e = Math.floor(rnd() * 30) - 14, a = ( rnd() * 2 - 1 ) * Math.pow(10, e); cases.push([a, a + rnd() * Math.pow(10, e + Math.floor(rnd() * 4) - 2)]); }
                const down = s => { const e = Math.floor(Math.log10(s) + 1e-12), f = Math.round(s / Math.pow(10, e)); return f === 5 ? 2 * s / 5 : s / 2; };
                for( const [lo, hi] of cases ) for( let mt = 2; mt <= 11; mt++ ) {
                    const tk = T(lo, hi, mt), fail = why => { if( bad.length < 5 ) bad.push({ lo, hi, mt, tk, why }); };
                    if( lo === hi ) continue;
                    const most = Math.max(mt, lo < 0 && hi > 0 ? 3 : 2);
                    if( !tk || tk.length < 2 || tk.length > most ) { fail('count'); continue; }
                    const s0 = ( tk[tk.length - 1] - tk[0] ) / ( tk.length - 1 ), e0 = Math.floor(Math.log10(s0) + 1e-12);
                    const s = [1, 2, 5, 10].reduce((b, f) => Math.abs(f - s0 / Math.pow(10, e0)) < Math.abs(b - s0 / Math.pow(10, e0)) ? f : b) * Math.pow(10, e0);
                    if( Math.abs(s0 - s) > s * 1e-3 || tk.some((x, i) => i && Math.abs(x - tk[i - 1] - s) > s * 1e-3) ) { fail('step'); continue; }
                    if( tk.some(x => Math.abs(x / s - Math.round(x / s)) > 1e-3 || x !== parseFloat(x.toPrecision(15))) ) { fail('multiples'); continue; }
                    const tol = Math.max(Math.abs(lo), Math.abs(hi)) * 1e-12;
                    if( tk[0] > lo + tol || tk[tk.length - 1] < hi - tol || ( hi > lo && ( tk[0] <= lo - s + tol || tk[tk.length - 1] >= hi + s - tol ) ) ) { fail('bounds'); continue; }
                    const s2 = down(s);
                    if( hi > lo && Math.ceil(hi / s2 - 1e-9) - Math.floor(lo / s2 + 1e-9) + 1 <= most ) { fail('not the tightest'); continue; }
                }
                return { n: cases.length * 10, bad }; })()`);
            return r.n > 200000 && !r.bad.length ? true : JSON.stringify(r.bad);
        });
        await t.step('any parameters — dataMin / dataMax, min / max, both (a soft bound), a smallest range (hecMinRange), margins (hecMarginMin / Max), a stepSize or not, 2 to 11 ticks —: each side the lowest of dataMin and min (the highest of dataMax and max), imposed as it is where it is min (max), else rounded out to a multiple of the step; never two labels nearer than the axis over maxTicks - 1; stepSize kept unless its labels overlap; else the tightest step of 1, 2, 5 × 10ⁿ', async () => {
            const r = await t.E(`(()=>{
                const A = window.HXLocal_Chart.hecAxisTicks, bad = [], def = v => typeof v === 'number' && isFinite(v);
                let seed = 11; const rnd = () => ( seed = ( seed * 1103515245 + 12345 ) % 2147483648 ) / 2147483648, pick = a => a[Math.floor(rnd() * a.length)];
                const isNat = s => { const e = Math.floor(Math.log10(s) + 1e-12), f = s / Math.pow(10, e); return [1, 2, 5, 10].some(x => Math.abs(f - x) < 1e-6); };
                const down = s => { const e = Math.floor(Math.log10(s) + 1e-12), f = Math.round(s / Math.pow(10, e)); return f === 5 ? 2 * s / 5 : s / 2; };
                let n = 0;
                for( let c = 0; c < 30000; c++ ) {
                    const m = Math.pow(10, Math.floor(rnd() * 12) - 5), v1 = ( rnd() * 2 - 1 ) * 10 * m, v2 = v1 + rnd() * 10 * m * pick([0.01, 0.3, 1, 3]), o = {}, mode = pick(['auto', 'fixed', 'soft', 'mixed']);
                    if( mode !== 'fixed' ) { o.dataMin = v1; o.dataMax = v2; }
                    if( mode === 'fixed' || mode === 'soft' ) { o.min = v1 + ( rnd() - 0.5 ) * 4 * m; o.max = v2 + ( rnd() - 0.5 ) * 4 * m; if( o.max <= o.min ) o.max = o.min + m; }
                    if( mode === 'mixed' ) { if( rnd() < 0.5 ) o.min = v1 + ( rnd() - 0.5 ) * 4 * m; else o.max = v2 + ( rnd() - 0.5 ) * 4 * m; }
                    if( rnd() < 0.4 ) o.stepSize = pick([1, 2, 5, 3, 0.7, 2.5, 25]) * m * pick([0.1, 1, 10]);
                    if( rnd() < 0.3 ) o.minRange = rnd() * 40 * m;
                    if( rnd() < 0.3 ) o.marginMin = true;
                    if( rnd() < 0.3 ) o.marginMax = true;
                    let lo, fixLo, hi, fixHi;
                    if( def(o.dataMin) && def(o.min) ) { lo = Math.min(o.dataMin, o.min); fixLo = o.dataMin > o.min; } else if( def(o.min) ) { lo = o.min; fixLo = true; } else { lo = o.dataMin; fixLo = false; }
                    if( def(o.dataMax) && def(o.max) ) { hi = Math.max(o.dataMax, o.max); fixHi = o.dataMax < o.max; } else if( def(o.max) ) { hi = o.max; fixHi = true; } else { hi = o.dataMax; fixHi = false; }
                    if( hi <= lo ) continue;
                    // (the smallest range, minRange: reached by the free sides, unless 0 stops it — never across it)
                    const sd = window.HXLocal_Chart.hecAxisSides(o), w0 = lo, w1 = hi;
                    ({ lo, hi, fixLo, fixHi } = sd);
                    if( o.minRange > 0 && !( fixLo && fixHi ) ) {
                        const zeroStop = ( w0 >= 0 && !fixLo && lo === 0 ) || ( w1 <= 0 && !fixHi && hi === 0 );
                        if( ( hi - lo < o.minRange * ( 1 - 1e-9 ) && !zeroStop ) || ( w0 >= 0 && lo < 0 ) || ( w1 <= 0 && hi > 0 ) ) { if( bad.length < 4 ) bad.push({ o, sd, why: 'minRange' }); continue; }
                    }
                    for( let mt = 2; mt <= 11; mt++ ) {
                        n++;
                        const tk = A(o, mt), fail = why => { if( bad.length < 4 ) bad.push({ o, mt, tk, why }); };
                        if( !tk ) { fail('none'); continue; }
                        const s = tk.step, a = tk[0], b = tk[tk.length - 1], tol = ( Math.abs(lo) + Math.abs(hi) ) * 1e-12 + s * 1e-9, mult = x => Math.abs(x / s - Math.round(x / s)) < 1e-6;
                        if( fixLo ? a !== lo : !( a <= lo + tol && a > lo - s * ( o.marginMin ? 1.5 : 1 ) - tol && mult(a) ) ) { fail('bottom'); continue; }
                        if( fixHi ? b !== hi : !( b >= hi - tol && b < hi + s * ( o.marginMax ? 1.5 : 1 ) + tol && mult(b) ) ) { fail('top'); continue; }
                        if( ( o.marginMin && !fixLo && lo - a < s / 2 - tol ) || ( o.marginMax && !fixHi && b - hi < s / 2 - tol ) ) { fail('margin'); continue; }
                        const most = Math.max(mt, ( !fixLo || !fixHi ) && lo < 0 && hi > 0 ? 3 : 2), gap = ( b - a ) / ( most - 1 );
                        if( tk.some((x, i) => i && x - tk[i - 1] < gap * ( 1 - 1e-6 ) - tol) ) { fail('labels overlap'); continue; }
                        if( tk.slice(1, -1).some(x => !mult(x) || x !== parseFloat(x.toPrecision(15))) ) { fail('not multiples'); continue; }
                        if( o.stepSize > 0 && s === o.stepSize ) continue;
                        if( !isNat(s) ) { fail('step'); continue; }
                        if( o.marginMin || o.marginMax ) continue;
                        const fits = s2 => { const a2 = fixLo ? lo : Math.floor(lo / s2 + 1e-9) * s2, b2 = fixHi ? hi : Math.ceil(hi / s2 - 1e-9) * s2; return s2 >= ( b2 - a2 ) / ( most - 1 ) * ( 1 + 1e-6 ); };
                        if( o.stepSize > 0 && fits(o.stepSize) ) { fail('stepSize refused though its labels have room'); continue; }
                        if( fits(down(s)) ) { fail('not the tightest'); continue; }
                    }
                }
                return { n, bad }; })()`);
            return r.n > 200000 && !r.bad.length ? true : JSON.stringify(r.bad);
        });
        await t.step('Chart.js charts 40 to 500 px high given these parameters: each axis drawn with the ticks of the rule for the length it is drawn over — never the half height it is laid out at first, nor its box before the half labels above and below are taken off —, the step applied told (ticks.hecTicksApplied)', async () => {
            const r = await t.E(`(()=>{
                const Chart = window.HXLocal_Chart, bad = [];
                let seed = 5; const rnd = () => ( seed = ( seed * 1103515245 + 12345 ) % 2147483648 ) / 2147483648, pick = a => a[Math.floor(rnd() * a.length)];
                let n = 0;
                for( const h of [40, 50, 65, 80, 100, 120, 150, 200, 260, 320, 500] ) for( let c = 0; c < 25; c++ ) {
                    const box = document.createElement('div'); box.style.cssText = 'width:600px;height:' + h + 'px'; document.body.appendChild(box);
                    const cv = document.createElement('canvas'); box.appendChild(cv);
                    const m = Math.pow(10, Math.floor(rnd() * 8) - 3), v1 = ( rnd() * 2 - 1 ) * 10 * m, v2 = v1 + rnd() * 10 * m, o = {}, mode = pick(['auto', 'fixed', 'soft', 'data']);
                    if( mode === 'auto' || mode === 'soft' ) { o.dataMin = v1; o.dataMax = v2; }
                    if( mode === 'fixed' || mode === 'soft' ) { o.min = v1 + ( rnd() - 0.5 ) * 4 * m; o.max = Math.max(o.min + m, v2 + ( rnd() - 0.5 ) * 4 * m); }
                    if( rnd() < 0.4 ) o.stepSize = pick([1, 2, 5, 3, 0.7]) * m;
                    let told;
                    const chart = new Chart(cv, { type: 'line', data: { datasets: [{ data: [{ x: 0, y: v1 }, { x: 1, y: v2 }] }] },
                        options: { responsive: true, maintainAspectRatio: false, animation: false, legend: { display: false },
                            scales: { xAxes: [{ type: 'linear', display: false }], yAxes: [{ id: 'y', ticks: Object.assign({ hecTicksApplied: x => { told = x.step; } }, o) }] } } });
                    const sc = chart.scales.y, tk = sc.ticksAsNumbers.slice().sort((x, y) => x - y), lim = Math.max(2, Math.min(11, Math.ceil(sc.height / 24)));
                    // (no parameter on a side: the data's)
                    const want = Chart.hecAxisTicks(Object.assign({ dataMin: mode === 'data' ? Math.min(v1, v2) : undefined, dataMax: mode === 'data' ? Math.max(v1, v2) : undefined }, o), lim);
                    n++;
                    if( JSON.stringify(tk) !== JSON.stringify(want.slice()) || told !== want.step ) bad.push({ h: sc.height, o, tk, want: want.slice(), told, step: want.step });
                    chart.destroy(); box.remove();
                }
                return { n, bad: bad.slice(0, 4) }; })()`);
            return r.n === 275 && !r.bad.length ? true : JSON.stringify(r.bad);
        });
        await t.step('Chart.js\' other parameters: a Y axis\' width (hecWidth: 65, 0); the room of a right axis kept (hecRightAxisRoom); the Y lock its own state — the range imposed as it is, the parameters never changed, the axis back to them once released; a time axis\' step kept unless its labels, measured, don\'t fit side by side — then a longer one, told (time.hecTicksApplied)', async () => {
            const r = await t.E(`(()=>{
                const Chart = window.HXLocal_Chart, out = {};
                const mk = (h, w, opts) => { const box = document.createElement('div'); box.style.cssText = 'width:' + w + 'px;height:' + h + 'px'; document.body.appendChild(box); const cv = document.createElement('canvas'); box.appendChild(cv); const c = new Chart(cv, opts); c.hecBox = box; return c; };
                const done = c => { c.destroy(); c.hecBox.remove(); };
                const base = (y, extra) => ({ type: 'line', data: { datasets: [{ data: [{ x: 0, y: 3 }, { x: 1, y: 42 }] }] }, options: Object.assign({ responsive: true, maintainAspectRatio: false, animation: false, legend: { display: false },
                    scales: { xAxes: [{ type: 'linear', display: false }], yAxes: [Object.assign({ id: 'y' }, y)] } }, extra || {}) });
                let c = mk(200, 600, base({ hecWidth: 65 })); out.w65 = c.scales.y.width; const r0 = c.chartArea.right; done(c);
                c = mk(200, 600, base({ hecWidth: 0 })); out.w0 = c.scales.y.width; done(c);
                c = mk(200, 600, base({ hecWidth: 65 }, { hecRightAxisRoom: true })); out.room = r0 - c.chartArea.right; done(c);
                c = mk(200, 600, base({ hecWidth: 65, ticks: { dataMin: 3, dataMax: 42 } }));
                const before = [c.scales.y.min, c.scales.y.max], t = c.options.scales.yAxes[0].ticks;
                c.hecSetYAxisLocked(true, [[12.37, 31.5]]);
                out.lock = [c.scales.y.min, c.scales.y.max, t.min, t.max, t.dataMin, t.dataMax];
                c.hecSetYAxisLocked(false); c.update();
                out.released = [before, [c.scales.y.min, c.scales.y.max]]; done(c);
                out.time = [];
                for( const w of [300, 500, 800, 1200] ) for( const [hours, n, unit] of [[24, 30, 'minute'], [168, 6, 'hour'], [720, 1, 'day'], [8760, 1, 'month']] ) {
                    let told; const t1 = Date.parse('2026-11-11T00:00:00'), t0 = t1 - hours * 3600e3;
                    c = mk(150, w, { type: 'line', data: { datasets: [{ data: [{ x: t0, y: 1 }, { x: t1, y: 2 }] }] }, options: { responsive: true, maintainAspectRatio: false, animation: false, legend: { display: false },
                        scales: { xAxes: [{ id: 'x', type: 'time', time: { min: t0, max: t1, unit, stepSize: n, displayFormats: { minute: 'HH:mm', hour: 'HH:mm', day: 'D MMM', month: 'MMM' }, hecTicksApplied: x => { told = x; } },
                            ticks: { autoSkipPadding: 8, maxRotation: 0, major: { enabled: true, unit: 'day', fontStyle: 'bold' } } }], yAxes: [{ hecWidth: 65 }] } } });
                    const sc = c.scales.x, ctx = c.ctx, steps = Chart.hecTimeSteps.map(s => s.join(' ')), i = steps.indexOf(n + ' ' + unit), j = told ? steps.indexOf(told.stepSize + ' ' + told.unit) : -1;
                    let tight = true;
                    for( let k = 1; k < sc._ticks.length; k++ ) {
                        ctx.font = sc._ticks[k].major ? 'bold 12px sans-serif' : '12px sans-serif';
                        if( sc.getPixelForTick(k) - sc.getPixelForTick(k - 1) < ctx.measureText(String(sc.ticks[k])).width ) tight = false;
                    }
                    out.time.push({ w, hours, asked: i, applied: j, tight });
                    done(c);
                }
                return out; })()`);
            const ok = r.w65 === 65 && r.w0 === 0 && r.room === 65 && r.lock.join() === '12.37,31.5,,,3,42' && r.released[0].join() === r.released[1].join()
                && r.time.every(x => x.applied >= x.asked && x.tight) && r.time.some(x => x.applied > x.asked) && r.time.some(x => x.applied === x.asked);
            return ok ? true : JSON.stringify(r);
        });
        done(await t.close());
        // (graphs 60 to 600 px high: Chart.js lays an axis out in passes — half its height first
        // —, the ticks made once more at each, from the values given: the last one's, for its
        // final height)
        const H = [60, 90, 130, 180, 250, 400, 600];
        t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '3h', statistics: { enabled: false }, yScaleSteadiness: 0,
            graphs: H.map(h => ({ type: 'line', height: h, entities: [{ entity: 'sensor.power' }] })) }, { height: 3000, mock: { series: true, fail: FAIL } });
        await t.wait(1500);
        await t.step('graphs 60 to 600 px high, values from -3 to 42.4, 0 to 2900, 1e6 to 1e6 + 3, a single one…: each axis drawn with the ticks of the values given for its final height — never those of the half height Chart.js lays it out at first —, holding them, within the ticks it allows', async () => {
            const r = await t.E(`(()=>{
                const I = el.instance, id = 'sensor.power', now = Date.now(), last = I.cache.length - 1, bad = [];
                for( const [lo, hi] of [[-3, 42.4], [0, 2900], [0.02, 0.031], [-1500, -1450], [1e6, 1e6 + 3], [-0.004, 0.0021], [17, 17], [-7e9, 3e10]] ) {
                    for( const s of I.cache ) for( const l of ['hist', 'fine', 'stats', 'day'] ) s[l].delete(id);
                    const rows = []; for( let t = now - 47 * 3600e3, k = 0; t < now; t += 300e3, k++ ) rows.push({ last_changed: t, state: String([lo, hi, ( lo + hi ) / 2][k % 3]) });
                    for( const k of [0, 1] ) { const s = I.cache[last - k], a = s.start_m.valueOf(), b = s.end_m.valueOf(); s.hist.set(id, rows.filter(r => r.last_changed >= a && r.last_changed < b)); s.cover.hist.set(id, [[a, b]]); }
                    I.generateGraphDataFromCache('the test', null, true);
                    for( const g of I.graphs ) {
                        const sc = g.chart.scales['y-axis-0'], tk = sc.ticksAsNumbers.slice().sort((x, y) => x - y), lim = Math.max(2, Math.min(11, Math.ceil(sc.height / 24)));
                        const t = sc.options.ticks, want = window.HXLocal_Chart.hecAxisTicks({ dataMin: t.dataMin, dataMax: t.dataMax, min: t.min, max: t.max, minRange: t.hecMinRange }, lim, sc._hecDataLimits.min, sc._hecDataLimits.max);
                        if( JSON.stringify(tk) !== JSON.stringify(want) || tk[0] > Math.min(lo, hi) || tk[tk.length - 1] < Math.max(lo, hi) ) bad.push({ lo, hi, h: sc.height, tk, want });
                    }
                }
                return bad; })()`);
            return !r.length ? true : JSON.stringify(r.slice(0, 4));
        });
        done(await t.close());
        // (ystepSize 5 on graphs 60 to 600 px high)
        t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '3h', statistics: { enabled: false }, yScaleSteadiness: 0,
            graphs: H.map(h => ({ type: 'line', title: 'g' + h, height: h, ystepSize: 5, entities: [{ entity: 'sensor.power' }] })) },
            { height: 3000, mock: { series: true, fail: FAIL }, init: 'window.__warns = []; { const w = console.warn; console.warn = (...a) => { __warns.push(a.join(" ")); w(...a); }; }' });
        await t.wait(1500);
        await t.step('ystepSize 5: obeyed where its labels have room at the graph\'s height; where they would overlap, the axis\' automatic ticks — and the card warns once for that graph, never again at the next drawings', async () => {
            const r = await t.E(`(()=>{
                const I = el.instance, id = 'sensor.power', now = Date.now(), last = I.cache.length - 1, bad = [], ignored = new Set();
                for( const [lo, hi] of [[-3, 42.4], [0, 12], [0, 2900], [-3, 42.4]] ) {
                    for( const s of I.cache ) for( const l of ['hist', 'fine', 'stats', 'day'] ) s[l].delete(id);
                    const rows = []; for( let t = now - 47 * 3600e3, k = 0; t < now; t += 300e3, k++ ) rows.push({ last_changed: t, state: String([lo, hi][k % 2]) });
                    for( const k of [0, 1] ) { const s = I.cache[last - k], a = s.start_m.valueOf(), b = s.end_m.valueOf(); s.hist.set(id, rows.filter(r => r.last_changed >= a && r.last_changed < b)); s.cover.hist.set(id, [[a, b]]); }
                    I.generateGraphDataFromCache('the test', null, true);
                    for( const g of I.graphs ) {
                        const sc = g.chart.scales['y-axis-0'], tk = sc.ticksAsNumbers.slice().sort((x, y) => x - y), lim = Math.max(2, Math.min(11, Math.ceil(sc.height / 24)));
                        const d = { min: sc.options.ticks.dataMin ?? sc._hecDataLimits.min, max: sc.options.ticks.dataMax ?? sc._hecDataLimits.max }, fits = Math.ceil(d.max / 5 - 1e-9) - Math.floor(d.min / 5 + 1e-9) + 1 <= lim;
                        if( fits ? sc._hecStep !== 5 || tk.some(x => x % 5) : JSON.stringify(tk) !== JSON.stringify(window.HXLocal_Chart.hecNiceTicks(d.min, d.max, lim)) ) bad.push({ lo, hi, h: sc.height, tk, fits });
                        if( !fits ) ignored.add(I.graphs.indexOf(g));
                    }
                }
                return { bad, ignored: ignored.size, warns: __warns.filter(w => /ystepSize 5 ignored/.test(w)) }; })()`);
            const once = new Set(r.warns).size === r.warns.length;
            return !r.bad.length && r.ignored > 0 && r.warns.length === r.ignored && once ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    let t = await openCard(card('3h'), { height: 900, mock: { series: true, fail: FAIL }, init: AXIS });
    await t.wait(1500);
    await t.step('a spike six hours ago, outside the 3 h window: the axis follows what is shown, which fills at least half its height', async () => {
        const a = await t.E(draw(SPIKE));
        return a.hi < 6000 && a.max < 10843 && a.max >= a.hi && a.min <= a.lo && fills(a) >= 0.5 ? true : JSON.stringify(a);
    });
    await t.step('a pan of a few minutes: the same axis', async () => {
        const a = await t.E('axis()');
        const b = await t.E(`(()=>{ const I = el.instance; I.moveTimeWindow(window.HXLocal_moment(I.startTime).subtract(10, 'minute')); I.generateGraphDataFromCache(); return axis(); })()`);
        return a.min === b.min && a.max === b.max ? true : JSON.stringify({ a, b });
    });
    await t.step('while a gesture moves the window far, the axis narrows a step at a time — still holding what is shown —; at its end, at once to the tightest', async () => {
        // (a big swing until 12 hours ago, small values since: the window moved from one to the other)
        const a = await t.E(draw(`(now, H) => { const r = []; for( let t = now - 47 * 3600e3; t < now; t += 300e3 ) r.push(H(t, t < now - 12 * 3600e3 ? ( Math.floor(t / 300e3) % 2 ? 1000 : 0 ) : 500 + ( Math.floor(t / 300e3) % 2 ) * 20)); return r; }`)
            .replace('I.generateGraphDataFromCache();', `I.state.drag = false; I._setWindow(window.HXLocal_moment(now).subtract(16, 'hour'), window.HXLocal_moment(now).subtract(13, 'hour')); I.generateGraphDataFromCache();`));
        const b = await t.E(`(()=>{ const I = el.instance, now = Date.now(); I.state.drag = true; I._setWindow(window.HXLocal_moment(now).subtract(4, 'hour'), window.HXLocal_moment(now).subtract(1, 'hour')); I.generateGraphDataFromCache(); return axis(); })()`);
        const c = await t.E(`(()=>{ const I = el.instance; I.state.drag = false; I.generateGraphDataFromCache(); return axis(); })()`);
        return a.max >= 1000 && a.min <= 0 && b.max - b.min < a.max - a.min && b.max - b.min >= ( a.max - a.min ) / 2.5 - 1e-9 && b.min <= 500 && b.max >= 520
            && c.max - c.min < 100 && fills(c) >= 0.5 && c.min <= 500 && c.max >= 520 ? true : JSON.stringify({ a, b, c });
    });
    await t.step('a rain at 0: the axis from 0, not from -1', async () => {
        const a = await t.E(draw(`(now, H) => { const r = []; for( let t = now - 47 * 3600e3; t < now; t += 300e3 ) r.push(H(t, 0)); return r; }`));
        return a.min === 0 && a.max > 0 ? true : JSON.stringify(a);
    });
    await t.step('values -3 to 42.4: the card gives them as they are; Chart.js makes the ticks — round bounds holding them, one step from 1, 2, 5 × 10ⁿ between all of them, the bounds within a step of the values', async () => {
        const a = await t.E(draw(`(now, H) => { const r = []; for( let t = now - 47 * 3600e3; t < now; t += 300e3 ) r.push(H(t, [-3, 20, 42.4][Math.floor(t / 300e3) % 3])); return r; }`));
        const r = await t.E(`(()=>{ const I = el.instance, sc = I.graphs[0].chart.scales['y-axis-0'], v = sc.ticksAsNumbers.slice().sort((x, y) => x - y);
            const kept = Object.values(I._yAxesKept)[0]['y-axis-0'];
            return { kept: [kept.min, kept.max], steps: [...new Set(v.slice(1).map((x, k) => +( x - v[k] ).toPrecision(12)))] }; })()`);
        const s = r.steps[0], e = s && Math.floor(Math.log10(s)), round = r.steps.length === 1 && [1, 2, 5].includes(+( s / Math.pow(10, e) ).toPrecision(12));
        return r.kept[0] === -3 && r.kept[1] === 42.4 && round && a.min <= -3 && a.max >= 42.4 && a.min > -3 - s && a.max < 42.4 + s ? true : JSON.stringify({ a, r });
    });
    done(await t.close());

    // ── The automatic gain (yScaleSteadiness 50): a pan towards a spike, past it, and to and fro ──
    // (a pump: 0 to 0.01 every 5 minutes, a spike of 0.1 twelve hours ago)
    t = await openCard(card('3h'), { height: 900, mock: { series: true, fail: FAIL }, init: AXIS });
    await t.wait(1500);
    // (the window panned back by 10 minutes a frame, a gesture going on: each frame's axis, and what it shows)
    const PAN = (from, frames, dir = 1) => `(()=>{ const I = el.instance, now = Date.now(), out = []; I.state.drag = true;
        for( let k = 0; k <= ${frames}; k++ ) { const e = now - ( ${from} + ${dir} * 10 * k ) * 60e3; I._setWindow(window.HXLocal_moment(e - 3 * 3600e3), window.HXLocal_moment(e)); I.generateGraphDataFromCache(); out.push(axis()); }
        I.state.drag = false; return out; })()`;
    const steps = l => l.map(a => a.max).filter((m, k, all) => !k || m !== all[k - 1]);
    await t.step('a pan towards a spike: the axis grows before it shows — never back down —, what is shown always in it, its ends on its ticks (multiples of its step: Chart.js\' graduation)', async () => {
        await t.E(draw(`(now, H) => { const r = []; for( let t = now - 47 * 3600e3; t < now; t += 300e3 ) r.push(H(t, Math.abs(t - ( now - 12 * 3600e3 )) < 600e3 ? 0.1 : ( Math.floor(t / 300e3) % 3 ) * 0.005)); return r; }`));
        const l = await t.E(PAN(0, 54)), m = steps(l), ahead = l.filter((a, k) => k < 48 && a.hi < 0.05);
        const onTicks = a => [a.min, a.max].every(x => Math.abs(x / a.step - Math.round(x / a.step)) < 1e-6);
        return m.length >= 3 && m.every((x, k) => !k || x > m[k - 1]) && l.every(a => a.max >= a.hi && a.min <= a.lo) && ahead.some(a => a.max > 2 * a.hi) && l.every(onTicks) ? true : JSON.stringify(m);
    });
    await t.step('a pan away from it: the axis narrows a step at a time — never more than a step down at once, never back up —; to and fro a little: the same axis', async () => {
        const l = await t.E(PAN(9 * 60, 54, -1)), m = steps(l);
        const back = await t.E(`(()=>{ const I = el.instance, now = Date.now(), out = []; I.state.drag = true;
            for( let k = 0; k < 12; k++ ) { const e = now - ( 2 * 60 + ( k % 2 ) * 10 ) * 60e3; I._setWindow(window.HXLocal_moment(e - 3 * 3600e3), window.HXLocal_moment(e)); I.generateGraphDataFromCache(); out.push(axis().max); }
            I.state.drag = false; return out; })()`);
        return m.length >= 3 && m.every((x, k) => !k || ( x < m[k - 1] && x >= m[k - 1] / 2.5 - 1e-9 )) && l.every(a => a.max >= a.hi) && new Set(back).size === 1 ? true : JSON.stringify({ m, back });
    });
    done(await t.close());

    t = await openCard(card('3h', { yScaleSteadinessLeft: 100 }), { height: 900, mock: { series: true, fail: FAIL }, init: AXIS });
    await t.wait(1500);
    await t.step('yScaleSteadiness: 100 on the card (as yScaleSteadinessLeft, its synonym) — a steady scale first: the axis grown towards the spike six hours ago before it shows; once shown, kept after it — never narrowed', async () => {
        const a = await t.E(draw(SPIKE));
        const b = await t.E(`(()=>{ const I = el.instance, now = Date.now(); I._setWindow(window.HXLocal_moment(now).subtract(7, 'hour'), window.HXLocal_moment(now).subtract(4, 'hour')); I.generateGraphDataFromCache();
            const s = axis(); I.state.drag = true; for( let k = 1; k <= 24; k++ ) { I._setWindow(window.HXLocal_moment(now).subtract(7 * 60 - 10 * k, 'minute'), window.HXLocal_moment(now).subtract(4 * 60 - 10 * k, 'minute')); I.generateGraphDataFromCache(); }
            I.state.drag = false; I.generateGraphDataFromCache(); return { s, e: axis() }; })()`);
        return a.max > a.hi && a.min <= a.lo && b.s.max >= 10843 && b.e.max === b.s.max ? true : JSON.stringify({ a, b });
    });
    done(await t.close());

    t = await openCard(card('3h', { yScaleSteadiness: 0 }), { height: 900, mock: { series: true, fail: FAIL }, init: AXIS });
    await t.wait(1500);
    await t.step('yScaleSteadiness: 0 — what is shown, at every frame: tightened while a gesture still moves the window', async () => {
        const a = await t.E(draw(`(now, H) => { const r = []; for( let t = now - 47 * 3600e3; t < now; t += 300e3 ) r.push(H(t, t < now - 12 * 3600e3 ? ( Math.floor(t / 300e3) % 2 ? 1000 : 0 ) : 500 + ( Math.floor(t / 300e3) % 2 ) * 20)); return r; }`)
            .replace('I.generateGraphDataFromCache();', `I.state.drag = false; I._setWindow(window.HXLocal_moment(now).subtract(16, 'hour'), window.HXLocal_moment(now).subtract(13, 'hour')); I.generateGraphDataFromCache();`));
        const b = await t.E(`(()=>{ const I = el.instance, now = Date.now(); I.state.drag = true; I._setWindow(window.HXLocal_moment(now).subtract(4, 'hour'), window.HXLocal_moment(now).subtract(1, 'hour')); I.generateGraphDataFromCache(); const r = axis(); I.state.drag = false; return r; })()`);
        return a.max >= 1000 && b.max - b.min < 100 && fills(b) >= 0.5 ? true : JSON.stringify({ a, b });
    });
    done(await t.close());

    t = await openCard(card('3h', { yScaleSteadiness: 100 }, { yScaleSteadiness: '0%' }), { height: 900, mock: { series: true, fail: FAIL }, init: AXIS });
    await t.wait(1500);
    await t.step('yScaleSteadiness: \'0%\' on the graph wins over the card\'s 100: what is shown first', async () => {
        const a = await t.E(draw(SPIKE));
        return a.max < 10843 && fills(a) >= 0.5 ? true : JSON.stringify(a);
    });
    done(await t.close());

    // ── The window in phases (BRANCH.md): 0. the probe; 1. the coarse source, an entity a
    // request, over the window and a window on each side (a month at most, in real time the
    // left one); 2. the fine source over the window, in blocks from the right; then the
    // background ──
    // (a value a minute: the 5-minute statistics valid — see the probe below)
    for( const [range, coarse, side, fine, block] of [['24h', null, 0, 'history', 1], ['7d', 'hour', 7, '5minute', 1], ['30d', 'hour', 30, '5minute', 3]] ) {
        t = await openCard(card(range, { statistics: { enabled: true } }), { height: 900, mock: { series: true, historyStep: 60 } });
        await t.wait(3000);
        await t.step(`a window of ${range}: 0. the probe first (the last hour's history); 1. ${coarse ? `the ${coarse} statistics over it and ${side} days before it, in one request` : 'nothing (too short for a hundred hourly values)'}; 2. its ${fine} in blocks of ${block} day${block > 1 ? 's' : ''} at most, from the right, after phase 1`, async () => {
            const r = await t.E(`(()=>{ const I = el.instance, t0 = Date.parse(I.startTime), t1 = Date.parse(I.endTime);
                const st = __ws.map((w, k) => ({ ...w, k })).filter(w => /during_period/.test(w.type));
                const probe = st[0];
                const isFine = w => '${fine}' === 'history' ? w.type === 'history/history_during_period' && w.k > probe.k && Date.parse(w.start) < Date.now() - 2 * 3600e3 : w.period === '${fine}';
                const p2 = st.filter(w => isFine(w) && Date.parse(w.end) > t0 && Date.parse(w.start) < t1);
                // (phase 1: before phase 2 — the background's after it)
                const p1 = st.filter(w => w.period === 'hour' && Date.parse(w.end) > t0 && w.k < ( p2[0]?.k ?? Infinity ));
                return { probe: probe?.type === 'history/history_during_period' && ( Date.now() - Date.parse(probe.start) ) / 3600e3 <= 2.05,
                         p1: p1.map(w => [w.k, Math.round(( t0 - Date.parse(w.start) ) / 864e5)]), p2: p2.map(w => [w.k, ( Date.parse(w.end) - Date.parse(w.start) ) / 864e5]),
                         fromRight: p2.every((w, k) => !k || Date.parse(w.end) <= Date.parse(p2[k - 1].start) + 1000), covered: p2.some(w => Date.parse(w.start) <= t0) }; })()`);
            const ok = r.probe && r.p2.length >= 1 && r.fromRight && r.covered && r.p2.every(([, d]) => d <= block + 1 / 24 + 1e-9)
                && ( coarse ? r.p1.length === 1 && Math.abs(r.p1[0][1] - side) <= 1 && r.p2.every(([k]) => k > r.p1[0][0]) : !r.p1.length );
            return ok ? true : JSON.stringify(r);
        });
        if( range === '24h' ) await t.step('the user idle: the history of the day before the window, quietly, in the background; one request at a time, a second at least between two', async () => {
            await t.wait(20000);
            const r = await t.E(`(()=>{ const I = el.instance, t0 = Date.parse(I.startTime);
                const fine = __ws.some(w => w.type === 'history/history_during_period' && Date.parse(w.end) <= t0 + 3600e3 && Date.parse(w.start) < t0 - 3600e3);
                // (the background: what's asked after the first display's requests, a second at least after them)
                const all = __ws.filter(w => /during_period/.test(w.type)).map(w => w.at), k0 = all.findIndex((a, k) => k && a - all[k - 1] >= 900), at = k0 < 0 ? [] : all.slice(k0), gaps = at.slice(1).map((a, k) => a - at[k]);
                return { fine, loading: I.state.loading, n: at.length, minGap: gaps.length ? Math.min(...gaps) : null }; })()`);
            return r.fine && !r.loading && r.n >= 2 && r.minGap >= 950 ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    // ── An entity without statistics, beside one with: its history in phase 2, block by block
    // with the other's 5-minute statistics ──
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '7d', statistics: { enabled: true },
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }, { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }] }] }, { height: 900, mock: { series: true, historyStep: 60, historyDelay: 300 } });
    await t.wait(6000);
    await t.step('an entity without statistics: its history in phase 2, in blocks of a day from the right, block by block with the other\'s 5-minute statistics — after phase 1 —, all of it at the end', async () => {
        const r = await t.E(`(()=>{ const t0 = Date.parse(el.instance.startTime), t1 = Date.parse(el.instance.endTime), W = __ws.filter(w => /during_period/.test(w.type));
            const p1 = W.findIndex(w => w.period === 'hour'), mine = W.filter(w => w.type === 'history/history_during_period' && w.ids.includes('binary_sensor.a') && Date.parse(w.end) > t0 && Date.parse(w.start) < t1);
            const order = W.filter(w => ( w.period === '5minute' || mine.includes(w) ) && Date.parse(w.end) > t0).map(w => w.period ? 'f' : 'h').join('');
            return { p1, first: W.indexOf(mine[0]), blocks: mine.length, order, fromRight: mine.every((w, k) => !k || Date.parse(w.end) <= Date.parse(mine[k - 1].start) + 1000),
                     covered: mine.some(w => Date.parse(w.start) <= t0), loading: el.instance.state.loading }; })()`);
        return r.first > r.p1 && r.blocks >= 7 && r.fromRight && /^(fh)+/.test(r.order) && r.order.startsWith('fhfh') && r.covered && !r.loading ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The 5-minute statistics only where the history is as dense: each entity's last hour
    // of history asked first, once a session ──
    for( const [step, fine] of [[600, false], [60, true]] ) {
        t = await openCard(card('7d', { statistics: { enabled: true } }), { height: 900, mock: { series: true, historyStep: step } });
        await t.wait(3000);
        await t.step(`a value every ${step / 60} min: the last hour of history asked first, before any statistics; the hourly statistics (phase 1) valid${fine ? ', the 5-minute ones too (phase 2)' : ' (under 15 min between values), the 5-minute ones never asked — phase 2 from the history'}`, async () => {
            const r = await t.E(`(()=>{ const t0 = Date.parse(el.instance.startTime), k = __ws.findIndex(w => w.type === 'recorder/statistics_during_period' && Date.parse(w.end) > t0), h = __ws.findIndex(w => w.type === 'history/history_during_period');
                const probe = __ws[h], hour = probe ? ( Date.now() - Date.parse(probe.start) ) / 3600e3 : null;
                return { probeFirst: h >= 0 && h < k, hour, fine: __ws.some(w => w.period === '5minute'), coarse: __ws[k]?.period }; })()`);
            return r.probeFirst && r.hour >= 1 && r.hour <= 2.05 && r.fine === fine && r.coarse === 'hour' ? true : JSON.stringify(r);
        });
        if( !fine ) await t.step('a value every 10 min: its 5-minute statistics in the cache never drawn — a zoom out and back, the probe not asked again', async () => {
            const r = await t.E(`(()=>{ const I = el.instance, id = 'sensor.power', c1 = I.mapEndTimeToCacheSlot(I.endTime), s = I.cache[c1], a = s.start_m.valueOf();
                s.fine.set(id, Array.from({ length: 12 }, (_, k) => ({ last_changed: a + k * 300e3, state: 999, statistics: { end: a + ( k + 1 ) * 300e3, min: 999, mean: 999, max: 999 } })));
                s.hist.delete(id); s.cover.hist.delete(id);
                I.generateGraphDataFromCache();
                return { drawn999: I.graphs[0].chart.data.datasets[0].data.some(p => p.y === 999), probes: __ws.filter(w => w.type === 'history/history_during_period' && ( Date.parse(w.end ?? 0) - Date.parse(w.start) ) < 3 * 3600e3 && w.start === __ws.find(x => x.type === 'history/history_during_period').start).length }; })()`);
            return !r.drawn999 ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    // ── A sensor sparser than the probe allows (a value every 3 hours): neither its 5-minute
    // nor its hourly statistics used ──
    t = await openCard(card('7d', { statistics: { enabled: true } }), { height: 900, mock: { series: true, historyStep: 10800 } });
    await t.wait(5000);
    await t.step('a value every 3 hours: neither its 5-minute nor its hourly statistics drawn — its history drawn where kept —; its 5-minute ones never counted in Export ▸ Statistics ▸ nor exported, its hourly ones always (Home Assistant has them)', async () => {
        const r = await t.E(`(async()=>{ const I = el.instance, id = 'sensor.power', t0 = Date.parse(I.startTime);
            const x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x);
            const d = I.graphs[0].chart.data.datasets[0].data.filter(p => p.y !== null && x(p) >= t0);
            const a = I.exportAvailability([id]), rows = await I.exportRows('hour', [id]), fine = await I.exportRows('5minute', [id]);
            return { finer: d.filter(p => p.statistics && p.statisticsPeriod <= 3600e3).length, n: d.length, periods: a.periods, hour: Object.keys(rows).length, fine: Object.keys(fine).length }; })()`);
        return r.n > 0 && r.finer === 0 && r.periods['5minute'] === 0 && r.periods.hour === 1 && r.periods.day === 1 && r.hour === 1 && r.fine === 0 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── Few values in the last hour: its last 24 probed — its hourly statistics valid only
    // with 5 intervals under 50 minutes there ──
    t = await openCard(card('6o', { statistics: { enabled: true } }), { height: 900, mock: { series: true, historyStep: 10800 } });
    await t.wait(6000);
    await t.step('a value every 3 hours: its last hour, then its last 24, probed before any statistics; its hourly statistics never drawn where its history is kept — counted in Export ▸ Statistics ▸ still', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, id = 'sensor.power', t0 = Date.parse(I.startTime);
            const k = __ws.findIndex(w => w.type === 'recorder/statistics_during_period');
            const long = __ws.findIndex(w => w.type === 'history/history_during_period' && Date.now() - Date.parse(w.start) >= 24 * 3600e3 && Date.now() - Date.parse(w.start) < 26 * 3600e3);
            const x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x);
            const d = I.graphs[0].chart.data.datasets[0].data.filter(p => p.y !== null && x(p) >= t0);
            const a = I.exportAvailability([id]);
            return { long, k, hourly: d.filter(p => p.statistics && p.statisticsPeriod <= 3600e3).length, n: d.length, hour: a.periods.hour, day: a.periods.day }; })()`);
        return r.long >= 0 && r.long < r.k && r.hourly === 0 && r.n > 0 && r.hour === 1 && r.day === 1 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The history's retention learned while requests wait (Home Assistant answers a few at a
    // time): a request planned before it was known asks no more than Home Assistant keeps ──
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '1y', statistics: { enabled: true },
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }, { type: 'line', entities: [{ entity: 'sensor.tank' }] }] },
        { height: 900, mock: { series: true, historyStep: 10800, historyDays: 30, cost: { base: 300, history: 0.001, statistics: 0.001, workers: 4 } } });
    await t.wait(1500);
    await t.step('a year loaded again, 30 days of history kept, its blocks of history waiting their turn: once an answer tells where the history begins, the blocks before it are never sent — only those sent before (4 workers: a few)', async () => {
        await t.E('window.__ws.length = 0; el.instance.reloadHistory()');
        for( let k = 0; k < 60 && await t.E('el.instance._requests.length > 0 || window.__ws.length === 0'); k++ ) await t.wait(500);
        const r = await t.E(`(()=>{ const edge = Date.now() - 30 * 86400e3 - 3600e3, h = window.__ws.filter(q => q.type === 'history/history_during_period');
            return { history: h.length, before: h.filter(q => q.end && Date.parse(q.end) < edge).length }; })()`);
        return r.history > 0 && r.before <= 4 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── Hourly statistics not valid, past the history's retention: the hourly ones drawn there
    // — their periods made up held —, never daily ones coarser than a column of pixels ──
    t = await openCard(card('6o', { statistics: { enabled: true } }), { height: 900, mock: { series: true, historyStep: 10800, historyDays: 30 } });
    await t.wait(6000);
    await t.step('a value every 3 hours, 30 days of history, 6 months (a column of some 5 hours): its history where kept; before, its hourly statistics (their runs at the same value held) — no daily ones', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x), t0 = Date.parse(I.startTime);
            const d = I.graphs[0].chart.data.datasets[0].data.filter(p => p.y !== null && !p.hecVirtual && x(p) >= t0);
            const old = d.filter(p => x(p) < Date.now() - 32 * 86400e3), recent = d.filter(p => x(p) > Date.now() - 28 * 86400e3 && x(p) < Date.now() - 86400e3);
            return { valid: I._relevant('sensor.power', 3600e3), old: old.length, hourly: old.filter(p => p.statisticsPeriod === 3600e3).length, daily: d.filter(p => p.statisticsPeriod >= 86400e3).length,
                     recentStats: recent.filter(p => p.statistics).length, recent: recent.length }; })()`);
        return !r.valid && r.old > 100 && r.hourly === r.old && r.daily === 0 && r.recent > 50 && r.recentStats === 0 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── A real data set (dataset.cjs: a month of a Home Assistant's history — private, on the
    // machine running the tests only: skipped without it): each sensor's statistics told by how
    // often it speaks when it speaks, whatever its silences ──
    if( !dataset.available() ) console.log('  - skipped: a real month of history — tests/data/history-month.csv is not on this machine (private, see dataset.cjs)');
    else {
        const D = { 'sensor.lp_puissance_1': [1, 1], 'sensor.lp_ecowitt_wind_direction': [1, 1], 'sensor.lp_puissance_prioritaires': [0, 1], 'sensor.sun_azimuth': [0, 1],
                    'sensor.lp_ecowitt_solar_irradiance': [0, 1], 'sensor.lp_puissance_var_piscine': [0, 1], 'sensor.lp_mesure_thermostat_bureau_ma_lin': [0, 1],
                    'sensor.lp_villeveyrac_temperature': [0, 0], 'sensor.consigne_thermostat_mezzanine': [0, 0], 'sensor.lp_ecowitt_rain_rate': [0, 0] };
        const { rows, states } = dataset(Object.keys(D));
        t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '7d', statistics: { enabled: true }, graphs: [{ type: 'line', entities: Object.keys(D).map(entity => ( { entity } )) }] },
            { height: 900, mock: { series: true, fastStats: true, rows, states } });
        await t.wait(5000);
        await t.step('a real month of history: 5 intervals under 4 min in its last hour, the 5-minute and hourly statistics valid (a power every minute, the wind); a mean under 15 min, the hourly ones (the sun, a power every 5 min); else its last 24 hours, 5 intervals under 50 minutes, the hourly ones — silent the last hour (the sun\'s irradiance at night, a pump stopped, a thermostat); never for a reading every hour, a setting, a rain', async () => {
            const r = await t.E(`(()=>{ const I = el.instance; return Object.fromEntries(${JSON.stringify(Object.keys(D))}.map(id => [id, [I._relevant(id, 300e3) ? 1 : 0, I._relevant(id, 3600e3) ? 1 : 0]])); })()`);
            const bad = Object.keys(D).filter(id => r[id][0] !== D[id][0] || r[id][1] !== D[id][1]);
            return !bad.length ? true : JSON.stringify(bad.map(id => [id, r[id], D[id]]));
        });
        done(await t.close());
    }

    // ── Statistics Home Assistant made up — a sensor silent, its last value carried —: a run of
    // them one value held, a silence of smart mode ──
    t = await openCard(card('24h', { statistics: { enabled: true }, lineMode: 'smart' }), { height: 900, mock: { series: true, fail: FAIL } });
    await t.wait(1500);
    await t.step('six hours of hourly statistics all at the same value, min = mean = max (the sensor silent): one value held over them — a plateau to their end in smart mode, no point in it', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, id = 'sensor.power', a = Math.floor(( Date.now() - 20 * 3600e3 ) / 3600e3) * 3600e3;
            for( const x of I.cache ) for( const l of ['hist', 'fine', 'stats', 'day', 'week', 'month'] ) { x[l].delete(id); x.cover[l].delete(id); }
            const st = (k, v, lo = v, hi = v) => ({ last_changed: a + k * 3600e3, state: v, statistics: { end: a + ( k + 1 ) * 3600e3, min: lo, mean: v, max: hi, raw: { mean: v, min: lo, max: hi } } });
            const rows = [st(0, 300, 200, 400), st(1, 350, 300, 420)];
            for( let k = 2; k < 8; k++ ) rows.push(st(k, 380));
            for( let k = 8; k < 19; k++ ) rows.push(st(k, 300 + k, 250, 450));
            for( const x of rows ) { const s = I.cache[I._slotAt(x.last_changed)]; if( !s.stats.has(id) ) { s.stats.set(id, []); s.cover.stats.set(id, [[s.start_m.valueOf(), s.end_m.valueOf()]]); } s.stats.get(id).push(x); }
            const c = I.cachedHistory(id, I._slotAt(a), I.cache.length - 1), held = c.find(x => x.statistics?.held);
            I.generateGraphDataFromCache();
            const x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x), d = I.graphs[0].chart.data.datasets[0].data;
            const inRun = d.filter(p => !p.hecVirtual && x(p) > a + 3 * 3600e3 && x(p) < a + 8 * 3600e3).length;
            const plateau = d.find(p => p.hecPlateauEnd && Math.abs(x(p) - ( a + 8 * 3600e3 )) < 1000);
            return { rows: c.length, held: held ? [( held.last_changed - a ) / 3600e3, held.statistics.end - a] : null, inRun, plateau: !!plateau }; })()`);
        return r.rows === 14 && r.held && r.held[0] === 2 && r.held[1] === 8 * 3600e3 && r.inRun === 0 && r.plateau ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The requests of the graphs on the screen first: within a phase, those of the graphs
    // on it or near it in groups of their own, sent before the others' ──
    {
        const E = ['sensor.power', 'sensor.power2', 'sensor.tank', 'sensor.rain', 'sensor.power_kw', 'sensor.wind', 'sensor.watering_cycle', 'sensor.days_to_watering'];
        t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '1y', statistics: { enabled: true }, graphs: E.map(e => ({ type: 'line', entities: [{ entity: e }] })) },
            { height: 500, mock: { series: true, fastStats: true, cost: { base: 300, history: 0.001, statistics: 0.001, workers: 4 } } });
        await t.wait(12000);
        await t.step('8 graphs on a 500 px screen, scrolled to the last ones, the window moved back 3 months: phase 1\'s requests of the graphs on the screen sent first, in groups of their own — never mixed with the others\', nor after them', async () => {
            const r = await t.E(`(async()=>{ const I = el.instance, w = ms => new Promise(r => setTimeout(r, ms)), g = I.graphs;
                g[g.length - 1].canvas.scrollIntoView(); await w(1500);
                const s = new Set(I.graphs.filter(x => I.graphShown(x)).map(x => x.entities[0].entity));
                window.__ws.length = 0; I.moveTimeWindow(window.HXLocal_moment(I.startTime).subtract(3, 'month')); await w(8000);
                // (phase 1's: the hourly statistics over the window and its sides)
                return { shown: [...s], order: window.__ws.filter(q => /statistics/.test(q.type) && q.period === 'hour').map(q => ( q.ids || [] ).map(id => s.has(id) ? 'S' : 'h').join('')) }; })()`);
            const first = r.order.slice(0, r.order.findIndex(x => /h/.test(x)));
            return r.shown.length > 0 && r.shown.length < 8 && first.length > 0 && first.every(x => /^S+$/.test(x)) && r.order.every(x => /^S+$|^h+$/.test(x)) ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    // ── A time the cache has nothing of yet (purged, asked again): a gap — the curve never drawn
    // over it, filled as its answers come ──
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '1y', statistics: { enabled: true },
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }, { type: 'line', entities: [{ entity: 'sensor.tank' }] }] },
        { height: 900, mock: { series: true, fastStats: true, historyDays: 90 } });
    await t.wait(6000);
    await t.step('a year: its last 5 months gone from the cache (as a purge leaves them), the window drawn again, Home Assistant slow to answer: the curve stops where nothing is loaded yet — no line over the months asked again —; their answers come: drawn', async () => {
        const look = `(()=>{ const c = el.instance.graphs[0].chart, now = Date.now(), x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x), d = c.data.datasets[0].data;
            return { last5: d.filter(p => p.y !== null && x(p) > now - 150 * 864e5).length, before: d.filter(p => p.y !== null && x(p) < now - 190 * 864e5).length, gaps: d.filter(p => p.y === null).length }; })()`;
        // (the last 5 months emptied from the cache — as a purge leaves them —, the year before
        // them loaded; then the window shown again, Home Assistant slow to answer)
        await t.E(`(async()=>{ const I = el.instance, from = Date.now() - 150 * 864e5;
            for( const s of I.cache ) if( s.b > from ) for( const l of ['hist', 'fine', 'stats', 'day', 'week', 'month'] ) { s[l].clear(); s.cover[l].clear(); s.askedAt[l].clear(); }
            I._cacheVersion = I.cacheVersion() + 1; window.MOCK.historyDelay = 4000; I.updateHistory(); })()`);
        await t.wait(800);
        const a = await t.E(look);
        await t.wait(12000);
        const b = await t.E(look);
        return a.last5 === 0 && a.before > 0 && a.gaps > 0 && b.last5 > 0 && b.gaps === 0 ? true : JSON.stringify({ a, b });
    });
    done(await t.close());

    // ── A silence of 60 days, statistics on, smart mode: one plateau — never cut where the
    // history's blocks join (the state in force at a request's start), nor where a run of
    // statistics Home Assistant made up starts again at the same value ──
    {
        const rows = []; for( let h = 180 * 24; h > 0; h-- ) { const d = h / 24; if( d < 120 && d > 60 ) continue; rows.push([h * 3600, String(100 + ( h % 7 ) * 50)]); }
        t = await openCard(card('6o', { statistics: { enabled: true }, lineMode: 'smart' }), { height: 900, mock: { series: true, rows: { 'sensor.power': rows } } });
        await t.wait(8000);
        await t.step('6 months, a sensor silent from 120 to 60 days ago, statistics on, smart mode: one dashed plateau over the silence — no point in it, its end where the sensor speaks again', async () => {
            const r = await t.E(`(()=>{ const c = el.instance.graphs[0].chart, now = Date.now(), x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x);
                const d = c.data.datasets[0].data, inside = d.filter(p => p.y !== null && x(p) > now - 118 * 864e5 && x(p) < now - 62 * 864e5);
                return { inside: inside.length, ends: d.filter(p => p.hecPlateauEnd && x(p) > now - 125 * 864e5 && x(p) < now - 55 * 864e5).map(p => Math.round(( now - x(p) ) / 864e5)) }; })()`);
            return r.inside === 0 && r.ends.length === 1 && r.ends[0] === 60 ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    // ── The min/max band of a point over its own time only: none along a plateau of smart mode ──
    t = await openCard(card('3d', { statistics: { enabled: false }, lineMode: 'smart', showMinMax: true }),
        { height: 900, mock: { series: true, rows: { 'sensor.power': Array.from({ length: 3 * 24 * 60 }, (_, k) => [k * 60, ( Math.floor(k / 60) % 6 ) < 2 ? 0 : String(100 + ( k * 37 ) % 200)]).filter(([ago]) => Math.floor(ago / 3600) % 6 >= 2 || ago % 3600 === 0) } } });
    await t.wait(3000);
    await t.step('smart mode, a sensor silent 2 hours in 6, showMinMax: a point of a plateau has no band (nothing varies in a silence); a point with a band, its span — its time —, the spans of the points before and after a plateau not meeting: no band stretched over it', async () => {
        const r = await t.E(`(()=>{ const d = el.instance.graphs[0].chart.data.datasets[0].data;
            const x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x), b = d.filter(p => p.yMin != null);
            const plateaus = d.filter(p => p.hecPlateauEnd), spans = b.filter(p => p.xMin <= x(p) && x(p) <= p.xMax).length;
            // (the points with a band on each side of a plateau's end past the column before it —
            // a silence ending within a column: that column's span holds it —: their spans don't meet)
            const across = plateaus.filter(p => { const k = d.indexOf(p), u = d.slice(0, k).reverse().find(q => q.yMin != null), v = d.slice(k + 1).find(q => q.yMin != null); return u && v && x(p) > u.xMax && v.xMin <= u.xMax; }).length;
            return { plateaus: plateaus.length, banded: plateaus.filter(p => p.yMin != null).length, band: b.length, spans, across }; })()`);
        return r.plateaus >= 3 && r.banded === 0 && r.band > 100 && r.spans === r.band && r.across === 0 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The source drawn: the coarsest a column of pixels holds, the finer ones only where it
    // lacks ──
    t = await openCard(card('6o', { statistics: { enabled: true } }), { height: 900, mock: { series: true, historyStep: 60 } });
    await t.wait(5000);
    await t.step('6 months (a column of some 5 hours), the history of a week ago in the cache too: the hourly statistics drawn there — not the history, worked out again for nothing —; the last minutes, not compiled yet, from the history', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, id = 'sensor.power', k = I.cache.length - 8, s = I.cache[k], a = s.start_m.valueOf(), b = s.end_m.valueOf();
            s.hist.set(id, Array.from({ length: 1440 }, (_, m) => ({ last_changed: a + m * 60e3, state: '999' }))); s.cover.hist.set(id, [[a, b]]);
            I.generateGraphDataFromCache();
            const x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x), d = I.graphs[0].chart.data.datasets[0].data.filter(p => p.y !== null);
            const day = d.filter(p => x(p) >= a && x(p) < b), last = d.filter(p => x(p) > Date.now() - 20 * 60e3 && !p.hecVirtual);
            return { day: day.length, fromStats: day.filter(p => p.statistics).length, h999: day.filter(p => p.y === 999).length, last: last.map(p => !!p.statistics) }; })()`);
        return r.day > 0 && r.fromStats === r.day && r.h999 === 0 && r.last.length >= 1 && r.last.some(s => !s) ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── Coarser statistics in the cache, loaded for another window: never drawn ──
    t = await openCard(card('24h', { statistics: { enabled: true } }), { height: 900, mock: { series: true, fail: FAIL }, init: AXIS });
    await t.wait(1500);
    await t.step('statistics coarser than the window\'s own sources (a month\'s, loaded for another window): never drawn — no curve over the window from them, the window\'s own not there yet', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, id = 'sensor.power', c0 = I.mapStartTimeToCacheSlot(I.startTime);
            for( const s of I.cache ) for( const l of ['hist', 'fine', 'stats', 'day', 'week', 'month'] ) s[l].delete(id);
            const s = I.cache[c0 - 1], a = s.start_m.valueOf();
            s.month.set(id, [{ last_changed: a, state: 555, statistics: { end: a + 86400e3, min: 555, mean: 555, max: 555 } }]);
            I.generateGraphDataFromCache();
            return { drawn: I.graphs[0].chart.data.datasets[0].data.filter(p => p.y !== null).map(p => p.y) }; })()`);
        return !r.drawn.includes(555) ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── Phase 1 alone where a column of pixels lasts an hour or more: the hourly statistics for
    // a year, the weekly ones when it lasts a week ──
    t = await openCard(card('1y', { statistics: { enabled: true } }), { height: 900, mock: { series: true } });
    await t.wait(2500);
    await t.step('a year: the hourly statistics (a column of pixels of some 10 hours holds an hour, not a day) in one request over the window and a month before it; no phase 2 — nothing finer', async () => {
        const r = await t.E(`(()=>{ const t0 = Date.parse(el.instance.startTime), s = __ws.filter(w => w.type === 'recorder/statistics_during_period' && Date.parse(w.end) > t0);
            return { periods: s.map(w => w.period), side: s[0] ? Math.round(( t0 - Date.parse(s[0].start) ) / 864e5) : null, source: el.instance._sourceNeeded() }; })()`);
        return r.periods.join() === 'hour' && r.side >= 29 && r.side <= 32 && r.source === 'stats' ? true : JSON.stringify(r);
    });
    await t.step('10 years on a narrow card (a column of pixels of a week or more): drawn from the weekly statistics', async () => {
        await t.E(`(()=>{ document.body.style.width='400px'; document.getElementById('host').style.width='400px'; })()`); await t.wait(800);
        await t.E(`el.instance.setTimeRangeFromString('10y', true)`); await t.wait(3000);
        const r = await t.E(`(()=>{ const I = el.instance; return { source: I._sourceNeeded(), week: __ws.some(w => w.period === 'week'), hours: I.activeRange.timeRangeHours }; })()`);
        return r.source === 'week' && r.week ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── What there is, drawn: the history where the statistics are missing (a unit changed 3 days
    // ago), the history first however sparse ──
    t = await openCard(card('7d', { statistics: { enabled: true } }), { height: 900, mock: { series: true, statsFrom: { 'sensor.power': 3 } } });
    await t.wait(4000);
    await t.step('statistics only for the last 3 days (a unit changed): the days before — their hourly and 5-minute statistics empty — drawn from the history — the whole window shown', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, t0 = Date.parse(I.startTime), d = I.graphs[0].chart.data.datasets[0].data.filter(p => p.y !== null);
            const x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x);
            return { asked: __ws.some(w => w.type === 'history/history_during_period' && w.ids.includes('sensor.power') && Date.parse(w.start) < Date.now() - 4 * 86400e3),
                     first: d.length ? ( x(d[0]) - t0 ) / 3600e3 : null }; })()`);
        return r.asked && r.first !== null && r.first <= 24 ? true : JSON.stringify(r);
    });
    done(await t.close());
    // ── The window moved while its requests are on their way (Home Assistant slow, a request at a
    // time): what brings some of the window shown first, whatever window asked it — then what
    // doesn't (the sides, the background) —; the window shown loading until it's whole ──
    {
        const ents = ['sensor.power', 'sensor.s1', 'sensor.s2', 'sensor.s3'];
        t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24h', statistics: { enabled: true }, graphs: ents.map(entity => ({ type: 'line', entities: [{ entity }] })) },
            { height: 900, mock: { series: true, historyStep: 60, historyDays: 90, fastStats: true, clones: 3, cost: { base: 300, history: 0.01, statistics: 0.03, workers: 1 } } });
        await t.wait(4000);
        // (a window of h hours 200 days back, loaded; then moved — move: a function of the card —; the
        // requests sent after its last move, each bringing some of the window shown (v) or not (o);
        // whether the window was ever not loading before it was whole)
        const moved = (h, move) => t.E(`(async()=>{ const I = el.instance, D = 86400e3, m = window.HXLocal_moment, H = ${h} * 3600e3;
            I.applyTimeRange(${h}, false); const end = Date.now() - 200 * D; I._setWindow(m(end - H), m(end)); I.updateHistory();
            for( let k = 0; k < 200 && ( I.state.loading || I._requests.length ); k++ ) await new Promise(r => setTimeout(r, 200));
            await (${move})(I, m, H);
            const t0 = Date.parse(I.startTime), t1 = Date.parse(I.endTime), n1 = __ws.length;
            const whole = () => I.graphs.every(g => { const x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x), xs = g.chart.data.datasets[0].data.filter(p => p.y !== null).map(x).sort((a, b) => a - b);
                if( xs.length < 10 ) return false; let gap = 0; for( let i = 1; i < xs.length; i++ ) if( xs[i] > t0 && xs[i - 1] < t1 ) gap = Math.max(gap, Math.min(xs[i], t1) - Math.max(xs[i - 1], t0)); return gap < H / 20; });
            let early = false, done = false;
            for( let k = 0; k < 300 && !done; k++ ) { const w = whole(); if( !w && !I.state.loading ) early = true; done = w && !I._requests.length; await new Promise(r => setTimeout(r, 100)); }
            // (the exports' probe — 5-minute statistics, in the background — left out)
            const seq = __ws.slice(n1).filter(w => /during_period/.test(w.type) && w.period !== '5minute').map(w => Date.parse(w.start) < t1 && ( w.end ? Date.parse(w.end) : Date.now() ) > t0 ? 'v' : 'o').join('');
            return { seq, early, whole: whole() }; })()`);
        await t.step('3 months, \'<\' clicked 3 times in a row (a month back each time): what brings some of the window shown sent first — the month a click before asked for its side, now in the window, too —, the sides and the background after', async () => {
            const r = await moved(2184, `async (I) => { for( let k = 0; k < 3; k++ ) { I.stepDay(-1); await new Promise(r => setTimeout(r, 250)); } }`);
            return /^v*o*$/.test(r.seq) && r.seq.includes('v') && r.whole ? true : JSON.stringify(r);
        });
        await t.step('6 months, the window dragged back (8 moves of a tenth of it): never shown as loaded before it is whole; what brings some of it sent first', async () => {
            const r = await moved(4368, `async (I, m, H) => { I.state.drag = true; for( let k = 0; k < 8; k++ ) { I.moveTimeWindow(m(Date.parse(I.startTime) - H / 10)); I.updateHistory(); await new Promise(r => setTimeout(r, 120)); } I.state.drag = false; I.updateHistory(); }`);
            return !r.early && /^v*o*$/.test(r.seq) && r.whole ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    // ── What there is, drawn: past the recorder's retention, a sensor whose 5-minute statistics
    // aren't valid (a value every 20 minutes) — its history the fine source, empty there: its
    // hourly statistics there, without phase 1 (2 days: too short for a hundred hourly values) ──
    t = await openCard(card('2d', { statistics: { enabled: true } }), { height: 900, mock: { series: true, historyStep: 1200, historyDays: 10 } });
    await t.wait(3000);
    // (the window moved to [now − to − 2 days, now − to], loaded, then its points: how many, and how many before a time)
    const moveTo = (to, before) => t.E(`(async()=>{ const I = el.instance, now = Date.now(), m = window.HXLocal_moment;
        I._setWindow(m(now - ( ${to} + 2 ) * 86400e3), m(now - ${to} * 86400e3)); I.updateHistory();
        await new Promise(r => setTimeout(r, 4000));
        const t0 = Date.parse(I.startTime), t1 = Date.parse(I.endTime), x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x);
        const d = I.graphs[0].chart.data.datasets[0].data.filter(p => p.y !== null && x(p) >= t0 && x(p) <= t1);
        return { fine: I._relevant('sensor.power', 300e3), hour: I._relevant('sensor.power', 3600e3), n: d.length, before: d.filter(p => x(p) < now - ${before} * 86400e3).length,
                 hourly: __ws.some(w => w.period === 'hour' && Date.parse(w.start) < t1 && Date.parse(w.end) > t0) }; })()`);
    await t.step('5-minute statistics not valid, a 2-day window 20 days back — past the history\'s retention (10 days): its hourly statistics drawn', async () => {
        const r = await moveTo(20, 0);
        return !r.fine && r.hour && r.hourly && r.n >= 40 ? true : JSON.stringify(r);
    });
    await t.step('the same window across the retention\'s edge (11 to 9 days back): the day before the edge drawn from the hourly statistics, the one after from the history', async () => {
        const r = await moveTo(9, 10);
        return r.before >= 20 && r.n - r.before >= 20 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── What there is, drawn: without phase 2 (60 days: a column of an hour or more), statistics
    // only for the last 20 days (a unit changed) — the history before them asked and drawn ──
    t = await openCard(card('60d', { statistics: { enabled: true } }), { height: 900, mock: { series: true, statsFrom: { 'sensor.power': 20 } } });
    await t.wait(5000);
    await t.step('60 days, statistics only for the last 20 (a unit changed): the 40 days before drawn from the history', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, t0 = Date.parse(I.startTime), G = I._geometry(), x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x);
            const d = I.graphs[0].chart.data.datasets[0].data.filter(p => p.y !== null && x(p) >= t0);
            return { column: G.column / 3600e3, asked: __ws.some(w => w.type === 'history/history_during_period' && Date.parse(w.start) <= t0 + 3600e3 && Date.parse(w.end ?? Date.now()) > Date.now() - 25 * 86400e3),
                     first: d.length ? ( x(d[0]) - t0 ) / 86400e3 : null, before: d.filter(p => x(p) < Date.now() - 21 * 86400e3).length }; })()`);
        return r.column >= 1 && r.asked && r.first !== null && r.first <= 1 && r.before >= 100 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The mean of an angle: lowpass_dt's rule (CLAUDE.md) — each value by its difference to
    // the mean the shortest way round ──
    t = await openCard(card('24h', {}, { entities: [{ entity: 'sensor.wind', lineMode: 'lines' }] }), { height: 900, mock: { series: true, fail: FAIL } });
    await t.wait(1500);
    await t.step('an angle, a column of pixels holding 0°, 170°, 340° and 350° a quarter of it each: its point the mean of lowpass_dt — 305°, each value by its difference to it the shortest way round (215° unwrapped one after the other)', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, id = 'sensor.wind', now = Date.now(), last = I.cache.length - 1;
            for( const l of ['hist', 'fine', 'stats', 'day', 'week', 'month'] ) for( const x of I.cache ) x[l].delete(id);
            const w = ( Date.parse(I.endTime) - Date.parse(I.startTime) ) / I.graphs[0].chart.hecPlotWidth(), g = Math.floor(( now - 6 * 3600e3 ) / w) * w;
            const rows = [[g - 2 * 3600e3, 0], [g, 0], [g + w / 4, 170], [g + w / 2, 340], [g + 3 * w / 4, 350], [g + w, 350]].map(([t, v]) => ({ last_changed: t, state: String(v) }));
            for( const k of [0, 1] ) { const s = I.cache[last - k]; s.hist.set(id, rows.filter(r => r.last_changed >= s.start_m.valueOf() && r.last_changed < s.end_m.valueOf())); s.cover.hist.set(id, [[s.start_m.valueOf(), s.end_m.valueOf()]]); }
            I.generateGraphDataFromCache();
            const x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x), p = I.graphs[0].chart.data.datasets[0].data.find(q => q.y !== null && x(q) > g && x(q) < g + w);
            return p ? { y: ( ( p.y % 360 ) + 360 ) % 360, lo: p.yMin ?? null } : null; })()`);
        return r && Math.abs(r.y - 305) < 1e-6 ? true : JSON.stringify(r);
    });
    done(await t.close());

    t = await openCard(card('24h', { statistics: { enabled: true } }), { height: 900, mock: { series: true, fail: FAIL } });
    await t.wait(1500);
    await t.step('a day with its history (6 values) and its 5-minute statistics (288): the history drawn — the reality, however sparse', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, id = 'sensor.power', last = I.cache.length - 1, s = I.cache[last - 1], a = s.start_m.valueOf();
            for( const l of ['hist', 'fine', 'stats', 'day', 'week', 'month'] ) for( const x of I.cache ) x[l].delete(id);
            s.hist.set(id, Array.from({ length: 6 }, (_, k) => ({ last_changed: a + k * 4 * 3600e3, state: String(100 + k) }))); s.cover.hist.set(id, [[a, s.end_m.valueOf()]]);
            s.fine.set(id, Array.from({ length: 288 }, (_, k) => ({ last_changed: a + k * 300e3, state: 999, statistics: { end: a + ( k + 1 ) * 300e3, min: 999, mean: 999, max: 999 } })));
            I.generateGraphDataFromCache();
            const b = s.end_m.valueOf(), d = I.graphs[0].chart.data.datasets[0].data.filter(p => p.y !== null && p.x >= a && p.x < b);
            return { n: d.length, stats: d.filter(p => p.statistics || p.y === 999).length }; })()`);
        return r.n >= 1 && r.stats === 0 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The display is only the display: an entity with statistics shown as a timeline or an
    // arrowline loaded as a curve is ──
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '6o', statistics: { enabled: true },
        graphs: [{ type: 'timeline', entities: [{ entity: 'sensor.power' }] }, { type: 'arrowline', entities: [{ entity: 'sensor.power2' }] }] }, { height: 900, mock: { series: true } });
    await t.wait(3500);
    await t.step('a timeline and an arrowline of entities with statistics: their statistics asked and drawn — no history but the last minutes —; their export counts them', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, st = __ws.filter(w => w.type === 'recorder/statistics_during_period');
            const old = __ws.filter(w => w.type === 'history/history_during_period' && Date.parse(w.start) < Date.now() - 26 * 3600e3);
            return { stats: ['sensor.power', 'sensor.power2'].every(id => st.some(w => w.ids.includes(id))), old: old.length,
                     drawn: I.graphs.map(g => g.chart.data.datasets[0].data.length), exp: I.exportAvailability(['sensor.power', 'sensor.power2']).statistics }; })()`);
        return r.stats && r.old === 0 && r.drawn.every(n => n > 0) && r.exp === 2 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The same mechanism for every entity: one giving a curve its color loaded as a curve
    // is; an angle too, its history asked besides, the window's first, from the right ──
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '6o', statistics: { enabled: true },
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power', color: { entity: 'sensor.power2', 0: 'green', 400: 'red' } }] }] }, { height: 900, mock: { series: true } });
    await t.wait(3500);
    await t.step('an entity giving a curve its color, with statistics: its statistics asked — no history but the last minutes', async () => {
        const r = await t.E(`(()=>{ const st = __ws.filter(w => w.type === 'recorder/statistics_during_period' && w.ids.includes('sensor.power2'));
            const old = __ws.filter(w => w.type === 'history/history_during_period' && w.ids.includes('sensor.power2') && Date.parse(w.start) < Date.now() - 26 * 3600e3);
            return { stats: st.length, old: old.length }; })()`);
        return r.stats >= 1 && r.old === 0 ? true : JSON.stringify(r);
    });
    done(await t.close());
    // (30 days on a narrow card, drawn from the hourly statistics: its history in 30 blocks of a day, a second at least apart)
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '30d', statistics: { enabled: true },
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.wind' }, { entity: 'sensor.power' }] }] },
        { height: 900, mock: { series: true }, init: "document.addEventListener('DOMContentLoaded', ()=>{ document.body.style.width='400px'; const h=document.getElementById('host'); if( h ) h.style.width='400px'; })" });
    await t.wait(45000);
    await t.step('an angle drawn from statistics: drawn from them as the rest (phase 1), then its history over the window first of the background — from the right, one request at a time, a second at least between two —, the other curve\'s not; drawn as it comes', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, t0 = Date.parse(I.startTime), t1 = Date.parse(I.endTime);
            const st = __ws.filter(w => w.type === 'recorder/statistics_during_period' && w.ids.includes('sensor.wind'));
            const _old = w => w.type === 'history/history_during_period' && Date.parse(w.start) < Date.now() - 26 * 3600e3;
            const h = __ws.filter(w => _old(w) && w.ids.includes('sensor.wind') && Date.parse(w.end) > t0 + 3600e3);
            const other = __ws.filter(w => _old(w) && w.ids.includes('sensor.power'));
            // (between the window's first part and its last, nothing else in the background)
            const i0 = __ws.indexOf(h[0]), i1 = __ws.indexOf(h[h.length - 1]), between = __ws.slice(i0, i1 + 1).filter(w => !h.includes(w));
            const at = h.map(w => w.at), gaps = at.slice(1).map((a, k) => a - at[k]);
            const x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x);
            const d = I.graphs[0].chart.data.datasets[0].data.filter(p => p.y !== null && x(p) >= t0 && x(p) <= t1);
            return { stats: st.length, firstStats: __ws.indexOf(st[0]) < i0, hist: h.length, right: h.length ? ( Date.now() - Date.parse(h[0].end) ) / 86400e3 : null,
                     fromRight: h.every((w, k) => !k || Date.parse(w.end) <= Date.parse(h[k - 1].start) + 1000),
                     reach: h.length ? ( Math.min(...h.map(w => Date.parse(w.start))) - t0 ) / 86400e3 : null, other: other.length,
                     between: between.map(w => w.type[0] + ' ' + ( w.period ?? '' ) + ' ' + w.start), minGap: gaps.length ? Math.min(...gaps) : null,
                     drawn: d.length, fromStats: d.filter(p => p.statistics).length, source: I._sourceNeeded() }; })()`);
        return r.source !== 'history' && r.stats >= 1 && r.firstStats && r.hist >= 2 && r.right < 2 && r.fromRight && r.reach <= 1 && r.other === 0
            && !r.between.length && r.minGap >= 950 && r.drawn > 0 && r.fromStats === 0 ? true : JSON.stringify(r);
    });
    await t.step('the user idle: the hourly statistics further before the window (phase 1\'s source, in blocks 10 times as large), both curves in one request; the angle\'s history only over the window', async () => {
        await t.wait(10000);
        const r = await t.E(`(()=>{ const I = el.instance, t0 = Date.parse(I.startTime);
            const far = __ws.filter(w => w.period === 'hour' && Date.parse(w.end) <= t0 - 29 * 86400e3);
            return { far: far.map(w => [w.ids.length, Math.round(( Date.parse(w.end) - Date.parse(w.start) ) / 864e5)]),
                     before: __ws.some(w => w.type === 'history/history_during_period' && w.ids.includes('sensor.wind') && Date.parse(w.end) <= t0), loading: I.state.loading }; })()`);
        return r.far.length >= 1 && r.far[0][0] === 2 && r.far[0][1] >= 29 && !r.before && !r.loading ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The requests regulated (ha-requests.js): in order, at once, as many in flight as Home
    // Assistant's workers ──
    t = await openCard(card('6o', { statistics: { enabled: false } }), { height: 900, mock: { series: true, cost: { base: 100, history: 0.02, statistics: 0.05, workers: 4 } } });
    await t.wait(4000);
    await t.step('6 months of history, Home Assistant answering 4 at a time: its parts sent from the right, at once, 4 in flight at most — none waiting there (a millisecond at most) —; the window drawn', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, t0 = Date.parse(I.startTime);
            const h = __ws.filter(w => w.type === 'history/history_during_period' && Date.parse(w.end) > t0 && Date.parse(w.start) < Date.now() - 86400e3);
            const x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x), d = I.graphs[0].chart.data.datasets[0].data.filter(p => p.y !== null);
            return { parts: h.length, fromRight: h.every((w, k) => !k || Date.parse(w.end) <= Date.parse(h[k - 1].start) + 1000), first: h.filter(w => w.at < h[0].at + 50).length,
                     waiting: window.__mockWaiting || 0, loading: I.state.loading, drawn: d.length ? ( x(d[0]) - t0 ) / 86400e3 : null }; })()`);
        // (waiting: at most one, for the millisecond between an answer and the request it frees)
        return r.parts >= 6 && r.fromRight && r.first === 4 && r.waiting <= 1 && !r.loading && r.drawn !== null && r.drawn < 2 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The statistics off: the window first, then its sides in the background ──
    t = await openCard(card('24h', { statistics: { enabled: false } }), { height: 900, mock: { series: true, historyDelay: 300 } });
    await t.wait(2500);
    await t.step('the statistics off: the window\'s history first; then the day before it, in the background — a second after the window was shown', async () => {
        // (the block before the window: ending where the window starts, at its whole hour)
        const r = await t.E(`(()=>{ const I = el.instance, t0 = Date.parse(I.startTime);
            const h = __ws.filter(w => w.type === 'history/history_during_period');
            const win = h.filter(w => Date.parse(w.end) > t0 + 3600e3), side = h.find(w => Date.parse(w.end) <= t0 + 3600e3);
            return { win: win.length, last: win.length ? Math.max(...win.map(w => w.at)) : null, side: side ? side.at : null }; })()`);
        return r.win >= 1 && r.side !== null && r.side > r.last ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The cache kept reasonable: the background stops once it holds AHEAD_MAX_ROWS rows (a
    // chatty sensor: a value every 2 s) ──
    t = await openCard(card('3d', { statistics: { enabled: true } }), { height: 900, mock: { series: true, historyStep: 2 } });
    await t.wait(4000);
    await t.step('a value every 2 s over a window of 3 days: the window drawn; the background filling around it never past 300 000 rows in the cache (a block more at most)', async () => {
        await t.wait(25000);
        const r = await t.E(`(()=>{ const I = el.instance; I.cacheRows = () => 299999 + 1; const n0 = __ws.length; I._askMissing();
            return { rows: I.__proto__.cacheRows.call(I), asked: __ws.length - n0, n: I.graphs[0].chart.data.datasets[0].data.length }; })()`);
        return r.rows > 100000 && r.rows < 300000 + 43200 && r.asked === 0 && r.n > 100 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── An angle's turn chosen by its circular mean over the window — lowpass_dt's rule, each
    // value weighted by how long it's in force (CLAUDE.md, the one mean of an angle) ──
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24h', statistics: { enabled: false },
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.wind' }] }] }, { height: 700, mock: { rows: { 'sensor.wind': [[30 * 3600, '350'], [3600, '20']] } } });
    await t.wait(2500);
    await t.step('an angle at 350° for 23 h of the window, then 20° for its last hour: the curve around 350° — its mean weighted by time (some 351°) —, the 20° drawn as 380°, never 350° as -10°', async () => {
        const ys = await t.E(`el.instance.graphs[0].chart.data.datasets[0].data.filter(p => p.y != null).map(p => p.y)`);
        return ys.length && ys.every(y => y >= 340 && y <= 390) && ys.some(y => y > 370) ? true : JSON.stringify(ys);
    });
    done(await t.close());

    // ── statistics.period: 5minute — the 5-minute statistics the card's period: the probe made
    // all the same, the 5-minute statistics used only where valid ──
    for( const [step, valid] of [[3600, false], [60, true]] ) {
        t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '7d', statistics: { enabled: true, period: '5minute' },
            graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }, { height: 700, mock: { series: true, historyStep: step } });
        await t.wait(5000);
        await t.step(`statistics.period: 5minute, a value every ${step / 60} min: the probe made — the 5-minute statistics ${valid ? 'valid: asked and drawn' : 'not valid: never asked nor drawn'}`, async () => {
            const r = await t.E(`(()=>{ const I = el.instance, d = I.graphs[0].chart.data.datasets[0].data;
                return { fine: I._relevant('sensor.power', 300e3), asked: window.__ws.some(w => w.period === '5minute'), stats: d.filter(p => p.statistics).length }; })()`);
            return r.fine === valid && r.asked === valid && ( valid ? r.stats > 0 : r.stats === 0 ) ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    // ── A dense curve (a value every 2 s): its neighbours in the cache near what a browser takes
    // as a call's arguments (some 130 000) — the axis worked out all the same (history-arrays.js) ──
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '3d', statistics: { enabled: false },
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }, { height: 700, mock: { series: true, historyStep: 2 } });
    await t.step('a value every 2 s, 3 days, the background filling the days around them: more than 120 000 rows near the window (the old spread failed there) — drawn again, no error, the Y axis worked out', async () => {
        let n = 0;
        for( let k = 0; k < 40 && n <= 120000; k++ ) { await t.wait(3000);
            n = await t.E(`Math.max(0, ...[...el.instance._yScaleNeighbours(el.instance.graphs[0].chart, 'y-axis-0', y => y).values()].map(a => a.length))`); }
        const r = await t.E(`(()=>{ try { el.instance.generateGraphDataFromCache('the test'); } catch(e) { return { error: e.message }; }
            const s = el.instance.graphs[0].chart.scales['y-axis-0']; return { min: s.min, max: s.max }; })()`);
        return n > 120000 && !r.error && isFinite(r.min) && isFinite(r.max) && r.max > r.min && !t.errors.length ? true : JSON.stringify({ n, r, errors: t.errors });
    });
    done(await t.close());

    // ── The cache purged past 500 000 rows: the history of the farthest days first, then their
    // 5-minute statistics; the hourly ones kept; never the window nor a window on each side ──
    t = await openCard(card('24h', { statistics: { enabled: true } }), { height: 900, mock: { series: true } });
    await t.wait(3000);
    await t.step('past 500 000 rows: purged back under 300 000 — the farthest days\' history first, then their 5-minute statistics; the hourly ones kept; the window and a day on each side untouched', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, id = 'sensor.power', c0 = I.mapStartTimeToCacheSlot(I.startTime);
            const rows = (n, t) => Array.from({ length: n }, (_, k) => ({ last_changed: t + k, state: '1' }));
            // (the rows of the window's slots, in those layers)
            const _win = layers => { const c1 = I.mapEndTimeToCacheSlot(I.endTime); let n = 0;
                for( let i = Math.max(0, c0); i <= c1; i++ ) for( const l of layers ) for( const a of I.cache[i][l].values() ) n += a.length; return n; };
            const win = _win(['hist', 'fine', 'stats', 'day']);
            // (40 days before the window: 13 000 rows of history each, 288 of 5-minute statistics, 24 hourly)
            for( let d = 3; d < 43; d++ ) { const s = I.cache[c0 - d], t = s.start_m.valueOf();
                s.hist.set(id, rows(13000, t)); s.fine.set(id, rows(288, t)); s.stats.set(id, rows(24, t)); }
            const before = I.cacheRows(); I._purge(); const after = I.cacheRows();
            const kept = d => ['hist', 'fine', 'stats'].map(l => I.cache[c0 - d][l].has(id) ? 1 : 0).join('');
            return { before, after, win: _win(['hist', 'fine', 'stats', 'day']) === win, near: kept(3), far: kept(42), hourlyFar: I.cache[c0 - 42].stats.has(id) }; })()`);
        return r.before > 500000 && r.after <= 300000 && r.win && r.near === '111' && r.far[0] === '0' && r.hourlyFar ? true : JSON.stringify(r);
    });
    await t.step('a window of 60 days: its sides kept a month each — the zone phase 1 asks —, never a width each: past 500 000 rows, history 45 days before the window purged, 20 days before it kept', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, id = 'sensor.power'; I.applyTimeRange(1440, true); const c0 = I.mapStartTimeToCacheSlot(I.startTime);
            const rows = (n, t) => Array.from({ length: n }, (_, k) => ({ last_changed: t + k, state: '1' }));
            for( const d of [20, 45] ) { const s = I.cache[c0 - d]; s.hist.set(id, rows(300000, s.start_m.valueOf())); }
            I._purge(); return { d20: I.cache[c0 - 20].hist.has(id), d45: I.cache[c0 - 45].hist.has(id) }; })()`);
        return r.d20 && !r.d45 ? true : JSON.stringify(r);
    });
    done(await t.close());

    return { passed, failed };
};
