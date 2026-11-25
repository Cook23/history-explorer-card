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

// In the page: rows (f: a function given the days' starts — today's: day(0) —, now, and the
// rows' makers: H a value of the history, S five minutes of statistics, each { layer, slot: the
// day, rows }) put in the cache as Home Assistant's answer for that day (today: until now) —
// none: nothing asked there —, the curve drawn again; then what it shows: its points in time
// order or the first one going back (back), the plateaus' ends (plateaus), the plateau ends
// holding another value than the point before (wrong), the last point a plateau's end (endPlateau)
const draw = f => `(()=>{
    const I = el.instance, id = 'sensor.rain', now = Date.now(), M = window.HXLocal_moment;
    for( const l of ['hist', 'fine', 'stats'] ) I.cache.layers[l].delete(id);
    const day = i => M().subtract(i, 'day').startOf('day').valueOf();
    const H = (t, v) => ({ last_changed: t, state: String(v) });
    const S = (t, v) => ({ last_changed: t, state: v, statistics: { end: t + 300e3, min: v, mean: v, max: v } });
    for( const { layer, slot, rows } of (${f})(day, now, H, S) ) if( rows.length ) I._mergeLayer(layer, id, rows, day(slot), slot === 0 ? now : day(slot - 1), now);
    I.generateGraphDataFromCache();
    const d = I.graphs[0].chart.data.datasets[0].data.filter(p => p.y !== null && p.y !== undefined);
    const t = p => typeof p.x === 'number' ? p.x : Date.parse(p.x);
    return { source: I._sourceNeeded(), n: d.length,
             back: d.findIndex((p, i) => i > 0 && t(p) < t(d[i - 1])),
             plateaus: d.filter(p => p.hecPlateauEnd).length,
             wrong: d.filter((p, i) => i > 0 && p.hecPlateauEnd && p.y !== d[i - 1].y).map(p => p.y),
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
                // (the last 15 minutes: the history after the statistics, 43 then 44 — each row in
                // its day's answer, whatever the hour)
                ...[1, 0].map(slot => ({ layer: 'hist', slot, rows: every(now - 15 * 60e3, now, 300e3, t => t < now - 8 * 60e3 ? 43 : 44, H).filter(r => ( r.last_changed < day(0) ) === ( slot === 1 )) })),
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
            // (each row in its day's answer — whatever the hour: the silence may be yesterday's)
            const rows = [...every(a, b, 60e3, t => 20 + ( t / 60e3 ) % 5, H), ...every(c, now, 60e3, t => 30 + ( t / 60e3 ) % 5, H)];
            return [{ layer: 'hist', slot: 1, rows: rows.filter(r => r.last_changed < day(0)) }, { layer: 'hist', slot: 0, rows: rows.filter(r => r.last_changed >= day(0)) }]; }`));
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

    // ── The silences the same whatever the window: worked out on every value the card knows of
    // the sensor, never on the days the window touches — a window of 12 hours from midnight
    // and one across midnight, the same plateaus (issue #293) ──
    {
        // (a sensor sending a value for 2 minutes, then 0: every 6 minutes the day before from
        // 13:00 — both windows load it all, a window on each side —, every 22 minutes from
        // midnight; Berlin time, the page at 12:00 then at 11:00)
        const at = x => Date.parse(x + '+01:00'), rows = [];
        for( let t = at('2026-11-13T13:00:00'); t < at('2026-11-14T00:00:00'); t += 6 * 60e3 ) rows.push([t, '20'], [t + 120e3, '0']);
        for( let t = at('2026-11-14T00:10:00'); t < at('2026-11-14T11:00:00'); t += 22 * 60e3 ) rows.push([t, '20'], [t + 120e3, '0']);
        const open = async now => {
            const NOW = at(now);
            t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '12h', statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.pulse', lineMode: 'smart' }] }] },
                { mock: { states: { 'sensor.pulse': { state: 0, unit: 'W', state_class: 'measurement' } }, rows: { 'sensor.pulse': rows.filter(([x]) => x <= NOW).map(([x, v]) => [(NOW - x) / 1000, v]) } },
                  clock: new Date(NOW).toISOString(), timezone: 'Europe/Berlin' });
            // (until the card knows the day before from 13:00 — its window on each side, loaded in
            // the background one request at a time —, then drawn again)
            for( let i = 0; i < 60 && !( await t.E(`( el.instance.knownHistory('sensor.pulse')[0]?.t ?? Infinity ) <= ${at('2026-11-13T13:00:01')}`) ); i++ ) await t.wait(500);
            await t.wait(2000);
            // (the plateaus' ends from 01:00 to 10:30: shown in both windows)
            return t.E(`graphAt(0).chart.data.datasets[0].data.filter(p => p.hecPlateauEnd && +new Date(p.x) >= ${at('2026-11-14T01:00:00')} && +new Date(p.x) <= ${at('2026-11-14T10:30:00')}).map(p => Math.round(+new Date(p.x) / 60e3))`);
        };
        const fromMidnight = await open('2026-11-14T12:00:00');
        done(await t.close());
        const across = await open('2026-11-14T11:00:00');
        await t.step('the same values, a window of 12 hours from midnight and one across midnight: the same plateaus', async () =>
            fromMidnight.length && JSON.stringify(fromMidnight) === JSON.stringify(across) ? true : JSON.stringify({ fromMidnight, across }));
        done(await t.close());
    }

    // ── A page left open past midnight: the states pushed after it in today's slot ──
    {
        const at = s => Date.parse(s + '+01:00'), NOW = at('2026-11-23T23:55:00');
        const rows = [];
        for( let x = at('2026-11-22T00:05:13'), k = 0; x < NOW; x += 597e3, k++ ) rows.push([( NOW - x ) / 1000, 21 + ( k % 7 ) / 10]);
        t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '1d', graphs: [{ type: 'line', entities: [{ entity: 'sensor.temp', lineMode: 'smart' }] }] },
            { mock: { states: { 'sensor.temp': { state: 21, unit: '°C', state_class: 'measurement' } }, rows: { 'sensor.temp': rows } },
              clock: new Date(NOW).toISOString(), timezone: 'Europe/Berlin' });
        await t.wait(3000);
        // (a state pushed at about 00:02, 00:04, 00:06 — nothing else asked between them)
        for( const [m, v] of [[7, 20.5], [2, 20.4], [2, 20.3]] ) { await t.page.clock.fastForward(m * 60e3); await t.E(`setState('sensor.temp', ${v})`); await t.wait(600); }
        await t.step('states pushed after midnight, the page opened before: in the history in time order, each once', async () => {
            const r = await t.E(`(()=>{ const rows = el.instance.cache.layers.hist.get('sensor.temp').rows, tt = x => +new Date(x.last_changed);
                return { sorted: rows.every((x, k) => !k || tt(x) > tt(rows[k - 1])), after: rows.filter(x => tt(x) > ${at('2026-11-24T00:00:00')}).map(x => +x.state) }; })()`);
            return r.sorted && JSON.stringify(r.after) === '[20.5,20.4,20.3]' ? true : JSON.stringify(r);
        });
        await t.step('then a window across midnight, its days loaded: nothing drawn back in time, the values pushed shown', async () => {
            await t.E(`el.instance.setTimeRangeFromString('1h', true)`); await t.wait(1500);
            await t.E(`el.instance.moveTimeWindow(${at('2026-11-23T23:35:00')})`); await t.wait(3000);
            const r = await t.E(`(()=>{ const d = graphAt(0).chart.data.datasets[0].data.filter(p => p.y !== null && p.y !== undefined), tt = p => +new Date(p.x);
                return { back: d.findIndex((p, i) => i > 0 && tt(p) < tt(d[i - 1])), after: d.filter(p => tt(p) > ${at('2026-11-24T00:00:00')}).map(p => p.y) }; })()`);
            return r.back === -1 && r.after.includes(20.3) ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    // ── A change of daylight saving time (Europe/Paris): every time UTC — the curve continuous,
    // a value every 10 minutes, none missing nor twice; the local time a display convention: in
    // March 1:00 then 3:00 an hour apart (no 2:00), in October 2:00 lasting two hours (a single
    // 2:00 graduation, the tooltip's 2:30 twice) ──
    for( const [clock, spring] of [['2026-03-29T06:00:00+02:00', true], ['2026-10-25T06:00:00+01:00', false]] ) {
        t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '8h', statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] },
            { mock: { series: true, historyStep: 600 }, clock, timezone: 'Europe/Paris' });
        await t.wait(3000);
        const r = await t.E(`(()=>{ const I = el.instance, c = graphAt(0).chart, s = c.scales['x-axis-0'], a = Date.parse('${clock.slice(0, 10)}T00:00:00Z') - 3600e3, b = a + 4 * 3600e3;
            // (the history's values over the night — its recorded ones, a request's start aside —, and the curve's points)
            const rows = I.cache.layers.hist.get('sensor.power').rows.filter(x => !x.b && +x.last_changed >= a && +x.last_changed <= b).map(x => +x.last_changed);
            const xs = c.data.datasets[0].data.filter(p => p.y != null && !p.hecVirtual).map(p => +new Date(p.x));
            const tick = l => { const k = s.ticks.indexOf(l); return k < 0 ? null : s._ticks[k].value; };
            const tip = t => I._tooltipTime({ x: t }, '', false);
            return { steps: [...new Set(rows.slice(1).map((x, k) => x - rows[k]))], n: rows.length, ordered: xs.every((x, k) => !k || x >= xs[k - 1]),
                     t1: tick('1:00 am'), t2: tick('2:00 am'), t3: tick('3:00 am'), tip: [tip(a + 5400e3), tip(a + 9000e3)] }; })()`);
        const H = 3600e3;
        await t.step(spring ? 'the change to summer time (Paris, March): a value every 10 minutes through the night, none missing; 1:00 then 3:00, an hour apart; the tooltip 1:30 then 3:30'
                            : 'the change to winter time (Paris, October): a value every 10 minutes through the night, none twice; 2:00 lasting two hours, graduated once; the tooltip 2:30 for both', async () =>
            JSON.stringify(r.steps) === '[600000]' && r.n === 25 && r.ordered
            && ( spring ? r.t2 === null && r.t3 - r.t1 === H && r.tip[0] !== r.tip[1] : r.t3 - r.t2 === 2 * H && r.tip[0] === r.tip[1] ) ? true : JSON.stringify(r));
        done(await t.close());
    }

    return { passed, failed };
};
