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

    t = await openCard(card('3h', { yScaleSteadinessLeft: 100 }), { height: 900, mock: { series: true, fail: FAIL }, init: AXIS });
    await t.wait(1500);
    await t.step('yScaleSteadiness: 100 on the card (as yScaleSteadinessLeft, its synonym) — a steady scale first: the spike six hours ago, which a pan would show, held in the axis', async () => {
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

    // ── Statistics relevant only where the mean time between the values is 60 % of their
    // period at most: measured again each time the history comes ──
    t = await openCard(card('7d', { statistics: { enabled: true } }), { height: 900, mock: { series: true, historyStep: 7200 } });
    await t.wait(5000);
    await t.step('a value every 2 hours: neither its 5-minute nor its hourly statistics drawn, counted in Export ▸ Statistics ▸ or exported — the daily ones still', async () => {
        const r = await t.E(`(async()=>{ const I = el.instance, id = 'sensor.power', t0 = Date.parse(I.startTime);
            const x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x);
            const d = I.graphs[0].chart.data.datasets[0].data.filter(p => p.y !== null && x(p) >= t0);
            const a = I.exportAvailability([id]), rows = await I.exportRows('hour', [id]), fine = await I.exportRows('5minute', [id]);
            return { finer: d.filter(p => p.statistics && p.statisticsPeriod <= 3600e3).length, n: d.length, periods: a.periods, hour: Object.keys(rows).length, fine: Object.keys(fine).length }; })()`);
        return r.n > 0 && r.finer === 0 && r.periods['5minute'] === 0 && r.periods.hour === 0 && r.periods.day === 1 && r.hour === 0 && r.fine === 0 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── Few values in the last hour: its last 8 probed — its hourly statistics valid only
    // with a value every 48 minutes at least there ──
    t = await openCard(card('6o', { statistics: { enabled: true } }), { height: 900, mock: { series: true, historyStep: 7200 } });
    await t.wait(6000);
    await t.step('a value every 2 hours: its last hour, then its last 8, probed before any statistics; its hourly statistics never drawn nor counted — the daily ones still', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, id = 'sensor.power', t0 = Date.parse(I.startTime);
            const k = __ws.findIndex(w => w.type === 'recorder/statistics_during_period');
            const long = __ws.findIndex(w => w.type === 'history/history_during_period' && Date.now() - Date.parse(w.start) >= 8 * 3600e3 && Date.now() - Date.parse(w.start) < 10 * 3600e3);
            const x = p => typeof p.x === 'number' ? p.x : Date.parse(p.x);
            const d = I.graphs[0].chart.data.datasets[0].data.filter(p => p.y !== null && x(p) >= t0);
            const a = I.exportAvailability([id]);
            return { long, k, hourly: d.filter(p => p.statistics && p.statisticsPeriod <= 3600e3).length, n: d.length, hour: a.periods.hour, day: a.periods.day }; })()`);
        return r.long >= 0 && r.long < r.k && r.hourly === 0 && r.n > 0 && r.hour === 0 && r.day === 1 ? true : JSON.stringify(r);
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
        const r = await t.E(`(()=>{ const I = el.instance, day0 = I.cache[I.mapStartTimeToCacheSlot(I.startTime)].start_m.valueOf();
            const h = __ws.filter(w => w.type === 'history/history_during_period');
            const win = h.filter(w => Date.parse(w.end) > day0), side = h.find(w => Date.parse(w.end) <= day0);
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

    // ── The cache purged past 500 000 rows: the history of the farthest days first, then their
    // 5-minute statistics; the hourly ones kept; never the window nor a window on each side ──
    t = await openCard(card('24h', { statistics: { enabled: true } }), { height: 900, mock: { series: true } });
    await t.wait(3000);
    await t.step('past 500 000 rows: purged back under 300 000 — the farthest days\' history first, then their 5-minute statistics; the hourly ones kept; the window and a day on each side untouched', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, id = 'sensor.power', c0 = I.mapStartTimeToCacheSlot(I.startTime);
            const rows = (n, t) => Array.from({ length: n }, (_, k) => ({ last_changed: t + k, state: '1' }));
            const win = I._windowRows(['hist', 'fine', 'stats', 'day']);
            // (40 days before the window: 13 000 rows of history each, 288 of 5-minute statistics, 24 hourly)
            for( let d = 3; d < 43; d++ ) { const s = I.cache[c0 - d], t = s.start_m.valueOf();
                s.hist.set(id, rows(13000, t)); s.fine.set(id, rows(288, t)); s.stats.set(id, rows(24, t)); }
            const before = I.cacheRows(); I._purge(); const after = I.cacheRows();
            const kept = d => ['hist', 'fine', 'stats'].map(l => I.cache[c0 - d][l].has(id) ? 1 : 0).join('');
            return { before, after, win: I._windowRows(['hist', 'fine', 'stats', 'day']) === win, near: kept(3), far: kept(42), hourlyFar: I.cache[c0 - 42].stats.has(id) }; })()`);
        return r.before > 500000 && r.after <= 300000 && r.win && r.near === '111' && r.far[0] === '0' && r.hourlyFar ? true : JSON.stringify(r);
    });
    done(await t.close());

    return { passed, failed };
};
