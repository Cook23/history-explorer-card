// The automatic Y axis (card-yscale.js, card-charts.js _autoYAxis): what is shown first —
// a value outside the time window never stretches the axis, what is shown fills at least
// half its height —, a steady scale second — a small pan keeps it, while a gesture moves
// the window it only grows, tightened at the gesture's end —; yScaleSteadiness at the
// card's and at a graph's level; a rain at 0 shown from 0.
// The curve's rows are put in the card's cache as Home Assistant would give them (its
// requests made to fail, so that nothing replaces them), then drawn.
const { openCard } = require('./lib.cjs');

const FAIL = ['history/history_during_period', 'recorder/statistics_during_period'];
const card = (range, more = {}, graph = {}) => ({ type: 'custom:history-explorer-card', defaultTimeRange: range, statistics: { enabled: false }, ...more,
    graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }], ...graph }] });

// In the page: rows (f: a function given now and the rows' maker H) put in today's and
// yesterday's slots, the curve drawn again; then the left axis' bounds and what is shown
// in the window
const draw = f => `(()=>{
    const I = el.instance, id = 'sensor.power', now = Date.now(), last = I.cache.length - 1;
    for( const s of I.cache ) for( const l of ['hist', 'tail', 'fine', 'stats', 'day'] ) s[l].delete(id);
    const H = (t, v) => ({ last_changed: t, state: String(v) });
    const rows = (${f})(now, H);
    for( const k of [0, 1] ) {
        const s = I.cache[last - k], a = s.start_m.valueOf(), b = s.end_m.valueOf();
        s.hist.set(id, rows.filter(r => r.last_changed >= a && r.last_changed < b));
    }
    I.generateGraphDataFromCache();
    return axis();
})()`;
const AXIS = `window.axis = () => {
    const I = el.instance, c = I.graphs[0].chart, sc = c.scales['y-axis-0'];
    const t0 = Date.parse(I.startTime), t1 = Date.parse(I.endTime);
    const v = c.data.datasets[0].data.filter(p => p.y !== null && p.x >= t0 && p.x <= t1).map(p => p.y);
    return { min: sc.min, max: sc.max, lo: Math.min(...v), hi: Math.max(...v) };
};`;
// (a value every 5 minutes over the last two days, v(t); a spike of 10843 six hours ago)
const SPIKE = `(now, H) => { const r = []; for( let t = now - 47 * 3600e3; t < now; t += 300e3 ) r.push(H(t, Math.abs(t - ( now - 6 * 3600e3 )) < 600e3 ? 10843 : 26.8 + ( Math.floor(t / 300e3) % 7 ) * 932)); return r; }`;
const fills = a => ( a.hi - a.lo ) / ( a.max - a.min );

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

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
    await t.step('while a gesture moves the window, the axis is kept as long as what is shown stays in it; tightened at its end', async () => {
        // (a big swing until 12 hours ago, small values since: the window moved from one to the other)
        const a = await t.E(draw(`(now, H) => { const r = []; for( let t = now - 47 * 3600e3; t < now; t += 300e3 ) r.push(H(t, t < now - 12 * 3600e3 ? ( Math.floor(t / 300e3) % 2 ? 1000 : 0 ) : 500 + ( Math.floor(t / 300e3) % 2 ) * 20)); return r; }`)
            .replace('I.generateGraphDataFromCache();', `I.state.drag = false; I._setWindow(window.HXLocal_moment(now).subtract(16, 'hour'), window.HXLocal_moment(now).subtract(13, 'hour')); I.generateGraphDataFromCache();`));
        const b = await t.E(`(()=>{ const I = el.instance, now = Date.now(); I.state.drag = true; I._setWindow(window.HXLocal_moment(now).subtract(4, 'hour'), window.HXLocal_moment(now).subtract(1, 'hour')); I.generateGraphDataFromCache(); return axis(); })()`);
        const c = await t.E(`(()=>{ const I = el.instance; I.state.drag = false; I.generateGraphDataFromCache(); return axis(); })()`);
        return a.max >= 1000 && a.min <= 0 && b.min === a.min && b.max === a.max && c.max - c.min < 100 && fills(c) >= 0.5 && c.min <= 500 && c.max >= 520
            ? true : JSON.stringify({ a, b, c });
    });
    await t.step('a rain at 0: the axis from 0, not from -1', async () => {
        const a = await t.E(draw(`(now, H) => { const r = []; for( let t = now - 47 * 3600e3; t < now; t += 300e3 ) r.push(H(t, 0)); return r; }`));
        return a.min === 0 && a.max > 0 ? true : JSON.stringify(a);
    });
    done(await t.close());

    t = await openCard(card('3h', { yScaleSteadiness: 100 }), { height: 900, mock: { series: true, fail: FAIL }, init: AXIS });
    await t.wait(1500);
    await t.step('yScaleSteadiness: 100 on the card — a steady scale first: the spike six hours ago, which a pan would show, held in the axis', async () => {
        const a = await t.E(draw(SPIKE));
        return a.max >= 10843 && a.min <= a.lo ? true : JSON.stringify(a);
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

    // ── Drawn at once, then refined: the statistics a step coarser over the window and a
    // window on each side, first; the cache filled further around it while the user looks ──
    for( const [range, period, days] of [['24h', 'hour', 1], ['7d', 'hour', 7], ['3h', '5minute', 0]] ) {
        t = await openCard(card(range, { statistics: { enabled: true } }), { height: 900, mock: { series: true } });
        await t.wait(1500);
        await t.step(`a window of ${range}: the ${period} statistics — the coarsest still giving it 10 values — asked over it and ${days} day(s) before it`, async () => {
            const r = await t.E(`(()=>{ const I = el.instance, t0 = Date.parse(I.startTime);
                const q = __ws.filter(w => w.type === 'recorder/statistics_during_period' && w.period === '${period}' && w.ids.includes('sensor.power') && Date.parse(w.start) <= t0 - ${days} * 86400e3 + 86400e3);
                return { asked: q.length, all: __ws.map(w => w.type[0] + ' ' + ( w.period ?? '' ) + ' ' + w.start + ' ' + w.end) }; })()`);
            return r.asked >= 1 ? true : JSON.stringify(r);
        });
        if( range === '24h' ) await t.step('the user idle: the cache filled further — the hourly statistics 4 windows before, the history of the day before the window, quietly; one request at a time, a second at least between two', async () => {
            const since = await t.E('Date.now()');
            await t.wait(20000);
            const r = await t.E(`(()=>{ const I = el.instance, t0 = Date.parse(I.startTime);
                const coarse = __ws.some(w => w.period === 'hour' && Date.parse(w.start) <= t0 - 3 * 86400e3);
                const fine = __ws.some(w => w.type === 'history/history_during_period' && Date.parse(w.end) <= t0 + 86400e3 && Date.parse(w.start) < t0 - 3600e3);
                const at = __ws.filter(w => w.at > ${since}).map(w => w.at), gaps = at.slice(1).map((a, k) => a - at[k]);
                return { coarse, fine, loading: I.state.loading, n: at.length, minGap: gaps.length ? Math.min(...gaps) : null }; })()`);
            return r.coarse && r.fine && !r.loading && r.n >= 2 && r.minGap >= 950 ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    // ── The weekly and monthly statistics: the coarse source of a year, the window's own when a
    // column of pixels lasts a week ──
    t = await openCard(card('1y', { statistics: { enabled: true } }), { height: 900, mock: { series: true } });
    await t.wait(2500);
    await t.step('a year: the monthly statistics asked first — the coarsest still giving it 10 values —, the hourly ones for the window', async () => {
        const r = await t.E(`(()=>{ const s = __ws.filter(w => w.type === 'recorder/statistics_during_period');
            return { first: s[0]?.period, periods: [...new Set(s.map(w => w.period))], source: el.instance._sourceNeeded() }; })()`);
        return r.first === 'month' && r.periods.includes('hour') && r.source === 'stats' ? true : JSON.stringify(r);
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
    await t.step('statistics only for the last 3 days (a unit changed): the days before drawn from the history — the whole window shown', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, t0 = Date.parse(I.startTime), d = I.graphs[0].chart.data.datasets[0].data.filter(p => p.y !== null);
            const x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x);
            return { asked: __ws.some(w => w.type === 'history/history_during_period' && w.ids.includes('sensor.power') && Date.parse(w.start) < Date.now() - 4 * 86400e3),
                     first: d.length ? ( x(d[0]) - t0 ) / 3600e3 : null }; })()`);
        return r.asked && r.first !== null && r.first <= 24 ? true : JSON.stringify(r);
    });
    done(await t.close());
    t = await openCard(card('24h', { statistics: { enabled: true } }), { height: 900, mock: { series: true, fail: FAIL } });
    await t.wait(1500);
    await t.step('a day with its history (6 values) and its 5-minute statistics (288): the history drawn — the reality, however sparse', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, id = 'sensor.power', last = I.cache.length - 1, s = I.cache[last - 1], a = s.start_m.valueOf();
            for( const l of ['hist', 'tail', 'fine', 'stats', 'day', 'week', 'month'] ) for( const x of I.cache ) x[l].delete(id);
            s.hist.set(id, Array.from({ length: 6 }, (_, k) => ({ last_changed: a + k * 4 * 3600e3, state: String(100 + k) })));
            s.fine.set(id, Array.from({ length: 288 }, (_, k) => ({ last_changed: a + k * 300e3, state: 999, statistics: { end: a + ( k + 1 ) * 300e3, min: 999, mean: 999, max: 999 } })));
            I.generateGraphDataFromCache();
            const b = s.end_m.valueOf(), d = I.graphs[0].chart.data.datasets[0].data.filter(p => p.y !== null && p.x >= a && p.x < b);
            return { n: d.length, stats: d.filter(p => p.statistics || p.y === 999).length }; })()`);
        return r.n >= 1 && r.stats === 0 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── No coarse pass (the statistics off): the window first, then its sides at once ──
    t = await openCard(card('24h', { statistics: { enabled: false } }), { height: 900, mock: { series: true, historyDelay: 300 } });
    await t.wait(2500);
    await t.step('no coarse pass (the statistics off): the window\'s history first, then the day before it at once — not after the 2 s of the user idle', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, day0 = I.cache[I.mapStartTimeToCacheSlot(I.startTime)].start_m.valueOf();
            const h = __ws.filter(w => w.type === 'history/history_during_period');
            const win = h.filter(w => Date.parse(w.end) > day0), side = h.find(w => Date.parse(w.end) <= day0);
            return { win: win.length, last: win.length ? Math.max(...win.map(w => w.at)) : null, side: side ? side.at : null }; })()`);
        return r.win >= 1 && r.side !== null && r.side > r.last && r.side - r.last < 1500 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The cache kept reasonable: a chatty sensor's history (a value every 2 s) never filled
    // ahead past AHEAD_MAX_ROWS rows ──
    t = await openCard(card('3d', { statistics: { enabled: true } }), { height: 900, mock: { series: true, historyStep: 2 } });
    await t.wait(4000);
    await t.step('a value every 2 s over a window of 3 days: the window drawn, its history not filled ahead, its hourly statistics still, up to 4 windows before — the cache under 300 000 rows', async () => {
        await t.wait(25000);
        const r = await t.E(`(()=>{ const I = el.instance, day0 = I.cache[I.mapStartTimeToCacheSlot(I.startTime)].start_m.valueOf();
            return { rows: I.cacheRows(), ahead: __ws.some(w => w.type === 'history/history_during_period' && Date.parse(w.end) <= day0),
                     coarse: __ws.some(w => w.period === 'hour' && Date.parse(w.start) <= day0 - 9 * 86400e3), n: I.graphs[0].chart.data.datasets[0].data.length }; })()`);
        return r.rows > 100000 && r.rows < 300000 && !r.ahead && r.coarse && r.n > 100 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The cache purged past 500 000 rows: the history of the farthest days first, then their
    // 5-minute statistics; the hourly ones kept; never the window nor a window on each side ──
    t = await openCard(card('24h', { statistics: { enabled: true } }), { height: 900, mock: { series: true } });
    await t.wait(3000);
    await t.step('past 500 000 rows: purged back under 300 000 — the farthest days\' history first, then their 5-minute statistics; the hourly ones kept; the window and a day on each side untouched', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, id = 'sensor.power', c0 = I.mapStartTimeToCacheSlot(I.startTime);
            const rows = (n, t) => Array.from({ length: n }, (_, k) => ({ last_changed: t + k, state: '1' }));
            const win = I._windowRows(['hist', 'tail', 'fine', 'stats', 'day']);
            // (40 days before the window: 13 000 rows of history each, 288 of 5-minute statistics, 24 hourly)
            for( let d = 3; d < 43; d++ ) { const s = I.cache[c0 - d], t = s.start_m.valueOf();
                s.hist.set(id, rows(13000, t)); s.fine.set(id, rows(288, t)); s.stats.set(id, rows(24, t)); }
            const before = I.cacheRows(); I._purge(); const after = I.cacheRows();
            const kept = d => ['hist', 'fine', 'stats'].map(l => I.cache[c0 - d][l].has(id) ? 1 : 0).join('');
            return { before, after, win: I._windowRows(['hist', 'tail', 'fine', 'stats', 'day']) === win, near: kept(3), far: kept(42), hourlyFar: I.cache[c0 - 42].stats.has(id) }; })()`);
        return r.before > 500000 && r.after <= 300000 && r.win && r.near === '111' && r.far[0] === '0' && r.hourlyFar ? true : JSON.stringify(r);
    });
    done(await t.close());

    return { passed, failed };
};
