// The smart line mode at the edges of what it's drawn from: a silence of the source (no value
// recorded for longer than usual) drawn as a plateau, the last value held — never a silence
// across statistics (the history of a day next to the statistics of the next ones, the
// history of the last minutes after the statistics), never an ongoing silence after
// statistics, never a point drawn back in time (a silence within a column of pixels).
// The curve's rows are put in the card's cache as Home Assistant would give them (its
// requests made to fail, so that nothing replaces them), then drawn.
const { openCard } = require('./lib.cjs');

const card = (range) => ({ type: 'custom:history-explorer-card', defaultTimeRange: range, statistics: { enabled: true },
    graphs: [{ type: 'line', entities: [{ entity: 'sensor.rain', lineMode: 'smart' }] }] });
const FAIL = ['history/history_during_period', 'recorder/statistics_during_period'];

// In the page: rows (f: a function given the slots' starts — today's last —, now, and the
// rows' makers: H a value of the history, S five minutes of statistics, each { layer, slot,
// rows }) put in the cache, the curve drawn again; then what it shows: its points in time
// order or the first one going back (back), the plateaus' ends (plateaus), the plateau ends
// holding another value than the point before (wrong), the last point a plateau's end (endPlateau)
const draw = f => `(()=>{
    const I = el.instance, id = 'sensor.rain', now = Date.now(), last = I.cache.length - 1;
    for( const s of I.cache ) for( const l of ['hist', 'fine', 'stats'] ) { s[l].delete(id); s.cover[l].delete(id); }
    const day = i => I.cache[last - i].start_m.valueOf();
    const H = (t, v) => ({ last_changed: t, state: String(v) });
    const S = (t, v) => ({ last_changed: t, state: v, statistics: { end: t + 300e3, min: v, mean: v, max: v } });
    // (the history with the hours its rows cover)
    for( const { layer, slot, rows } of (${f})(day, now, H, S) ) { const c = I.cache[last - slot]; c[layer].set(id, rows);
        if( layer === 'hist' && rows.length ) c.cover.hist.set(id, [[rows[0].last_changed, Math.max(rows[rows.length - 1].last_changed + 1, layer === 'hist' && slot === 0 ? now : 0)]]); }
    I.generateGraphDataFromCache();
    const d = I.graphs[0].chart.data.datasets[0].data.filter(p => p.y !== null && p.y !== undefined);
    const t = p => typeof p.x === 'number' ? p.x : Date.parse(p.x);
    return { source: I._sourceNeeded(), n: d.length,
             back: d.findIndex((p, i) => i > 0 && t(p) < t(d[i - 1])),
             plateaus: d.filter(p => p.hecPlateauEnd).length,
             wrong: d.filter((p, i) => i > 0 && p.hecVirtual && p.y !== d[i - 1].y).map(p => p.y),
             endPlateau: !!d[d.length - 1]?.hecPlateauEnd };
})()`;
// (rows every step ms from t0 to t1, each value v(t))
const every = `(t0, t1, step, v, mk) => { const r = []; for( let t = t0; t < t1; t += step ) r.push(mk(t, v(t))); return r; }`;

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    // ── Six days: drawn from the 5-minute statistics ──
    let t = await openCard(card('6d'), { height: 900, mock: { series: true, fail: FAIL } });
    await t.wait(1500);

    await t.step('the history of a day, the statistics of the next ones, the history of the last minutes: no silence across the statistics — no plateau holding the history\'s old value, nothing back in time', async () => {
        const r = await t.E(draw(`(day, now, H, S) => { const every = ${every};
            return [
                // (two days ago, 12:00 to 18:00: a value every 10 minutes, ending at 31)
                { layer: 'hist', slot: 2, rows: every(day(2) + 12 * 3600e3, day(2) + 18 * 3600e3, 600e3, t => 31, H) },
                // (yesterday and today until 20 minutes ago: the 5-minute statistics, 33 then 36)
                { layer: 'fine', slot: 1, rows: every(day(1), day(0), 300e3, t => 33, S) },
                { layer: 'fine', slot: 0, rows: every(day(0), now - 20 * 60e3, 300e3, t => 36, S) },
                // (the last 15 minutes: the history after the statistics, 43 then 44)
                { layer: 'hist', slot: 0, rows: every(now - 15 * 60e3, now, 300e3, t => t < now - 8 * 60e3 ? 43 : 44, H) },
            ]; }`));
        return r.source === 'fine' && r.n > 100 && r.back === -1 && r.wrong.length === 0 && r.plateaus === 0 ? true : JSON.stringify(r);
    });

    await t.step('the statistics up to the end, no history after them: no ongoing silence drawn from the history\'s last value', async () => {
        const r = await t.E(draw(`(day, now, H, S) => { const every = ${every};
            return [
                { layer: 'hist', slot: 2, rows: every(day(2) + 12 * 3600e3, day(2) + 18 * 3600e3, 600e3, t => 31, H) },
                { layer: 'fine', slot: 1, rows: every(day(1), day(0), 300e3, t => 33, S) },
                { layer: 'fine', slot: 0, rows: every(day(0), now - 20 * 60e3, 300e3, t => 36, S) },
            ]; }`));
        return r.n > 100 && r.back === -1 && !r.endPlateau && r.plateaus === 0 ? true : JSON.stringify(r);
    });

    await t.step('a silence shorter than a column of pixels, at every place in a column: nothing drawn back in time', async () => {
        // (the last 24 hours — whatever the time of day: yesterday's part and today's —: a value
        // every minute, a 4-minute pause starting at every minute of the hour)
        const r = await t.E(draw(`(day, now, H, S) => { const rows = [];
            for( let t = now - 24 * 3600e3, k = 0; t < now; t += 60e3, k++ ) {
                rows.push(H(t, 10 + ( k % 7 )));
                if( k % 60 === 30 ) t += ( 3 + ( Math.floor(k / 60) % 10 ) ) * 60e3;
            }
            return [{ layer: 'hist', slot: 1, rows: rows.filter(r => r.last_changed < day(0)) }, { layer: 'hist', slot: 0, rows: rows.filter(r => r.last_changed >= day(0)) }]; }`));
        return r.n > 20 && r.back === -1 && r.wrong.length === 0 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── A day: drawn from the history ──
    t = await openCard(card('24h'), { height: 900, mock: { series: true, fail: FAIL } });
    await t.wait(1500);
    await t.step('the history alone, a source silent three hours: a plateau holding its last value, then the curve again', async () => {
        const r = await t.E(draw(`(day, now, H, S) => { const every = ${every};
            const a = now - 20 * 3600e3, b = now - 8 * 3600e3, c = now - 5 * 3600e3;
            return [{ layer: 'hist', slot: 0, rows: [...every(a, b, 60e3, t => 20 + ( t / 60e3 ) % 5, H), ...every(c, now, 60e3, t => 30 + ( t / 60e3 ) % 5, H)] },
                    { layer: 'hist', slot: 1, rows: [] }]; }`));
        return r.source === 'history' && r.back === -1 && r.wrong.length === 0 && r.plateaus >= 1 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── A silence across midnight: the state in force at the day's start (Home Assistant's
    // answer to a request beginning there) no value of the source ──
    const _noon = () => { const d = new Date(); d.setUTCHours(12, 0, 0, 0); return d.toISOString(); };
    t = await openCard(card('24h'), { height: 900, mock: { series: true, fail: FAIL }, clock: _noon() });
    await t.wait(1500);
    await t.step('a source silent from 22:00 to 02:00, the state in force repeated at midnight: one silence — a plateau holding its last value —, no point at midnight', async () => {
        const r = await t.E(draw(`(day, now, H, S) => { const every = ${every}, m = day(0);
            const yesterday = every(m - 10 * 3600e3, m - 2 * 3600e3, 60e3, t => 20 + ( t / 60e3 ) % 5, H), _last = yesterday[yesterday.length - 1];
            return [{ layer: 'hist', slot: 1, rows: yesterday },
                    { layer: 'hist', slot: 0, rows: [{ ...H(m, _last.state), b: true }, ...every(m + 2 * 3600e3, now, 60e3, t => 30 + ( t / 60e3 ) % 5, H)] }]; }`)
            .replace('return { source', 'const _m = day(0); return { midnight: d.filter(p => t(p) === _m && !p.hecVirtual).length, source'));
        return r.back === -1 && r.wrong.length === 0 && r.plateaus >= 1 && r.midnight === 0 ? true : JSON.stringify(r);
    });

    // ── A silence's end in a column of pixels whose point is drawn before it (the column holds
    // the silence's last part): the plateau ends where that column begins — never left out
    // unless the silence is within the column; whatever the hour (the columns on a grid from
    // 1970, a silence's end anywhere in one) ──
    await t.step('a silence of a day ending in a column of 4 h whose point is drawn an hour before its end: a plateau, ending where the column begins; a silence of 2 h within such a column: none, no point back in time', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, H = 3600e3, T = Date.now() - 10 * 24 * H;
            const run = (ta, tb, from) => {
                const raw = [], s = [];
                for( let x = T; x <= ta; x += H ) { raw.push({ t: x, y: 1 }); s.push({ x, y: 1, columnFrom: x - H / 2, columnTo: x + H / 2 }); }
                for( let x = tb; x < tb + 6 * H; x += H ) raw.push({ t: x, y: 2 });
                s.push({ x: tb - H, y: 1.5, columnFrom: from, columnTo: tb + H });
                for( let x = tb + 2 * H; x < tb + 6 * H; x += H ) s.push({ x, y: 2, columnFrom: x - H / 2, columnTo: x + H / 2 });
                const out = I._applySilencePlateaus(s, raw, false), x = p => p.x;
                return { ends: out.filter(p => p.hecPlateauEnd).map(p => ( x(p) - tb ) / H), back: out.findIndex((p, i) => i > 0 && x(p) < x(out[i - 1])) };
            };
            const ta = T + 5 * 24 * H, tb = ta + 24 * H;
            return { day: run(ta, tb, tb - 3 * H), within: run(tb - 2 * H, tb, tb - 3 * H) }; })()`);
        return r.day.ends.length === 1 && r.day.ends[0] === -3 && r.day.back === -1 && r.within.ends.length === 0 && r.within.back === -1 ? true : JSON.stringify(r);
    });
    done(await t.close());

    return { passed, failed };
};
