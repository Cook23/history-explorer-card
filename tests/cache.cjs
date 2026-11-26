// The cache (card-history.js): by series and source, values in time order, the time asked
// (spans) — its logic against the odd cases: answers coming out of order, a request's start
// and end, values Home Assistant gives outside what was asked, states pushed late or twice,
// this device's clock set otherwise than Home Assistant's or set while the page is open, two
// cards of a page, an angle read by an option, Home Assistant in another time zone, statistics by whole periods, the purge
// at fractions of a ms, a refresh while the same time is asked. Every test besides checks the
// cache's rules after each change (lib.cjs, card-history.js _checkCache)
const { openCard } = require('./lib.cjs');

const card = extra => ({ type: 'custom:history-explorer-card', defaultTimeRange: '1d', statistics: { enabled: false }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }], ...extra });
// (in the page: a track's rows and spans, as { t (ms from T), v, b } and [a, b, at] in ms from T)
const HELPERS = `window.T = Date.parse('2026-11-20T06:00:00Z'); window.M = 60e3;
window.H = (t, v) => ({ last_changed: T + t, state: String(v) });
window.rowsOf = (l, id) => ( el.instance.cache.layers[l].get(id)?.rows ?? [] ).map(x => ({ t: ( +x.last_changed - T ) / M, v: +x.state, b: !!x.b }));
window.spansOf = (l, id) => ( el.instance.cache.layers[l].get(id)?.spans ?? [] ).map(s => [( s.a - T ) / M, ( s.b - T ) / M, ( s.at - T ) / M]);`;

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    let t = await openCard(card(), { mock: { series: true }, clock: '2026-11-20T12:00:00Z', init: HELPERS });
    await t.wait(2000);

    await t.step('answers coming out of order: an older one never replaces what a newer one put — it fills only where nothing newer is known', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, id = 'sensor.order';
            // (the newer: 60 to 120 min, asked at 200; the older, wider: 0 to 180 min, asked at 100)
            I._mergeLayer('hist', id, [H(60 * M, 1), H(90 * M, 2)], T + 60 * M, T + 120 * M, T + 200 * M);
            I._mergeLayer('hist', id, [H(0, 7), H(60 * M, 9), H(90 * M, 9), H(150 * M, 8)], T, T + 180 * M, T + 100 * M);
            return { rows: rowsOf('hist', id), spans: spansOf('hist', id) }; })()`);
        const want = { rows: [{ t: 0, v: 7, b: true }, { t: 60, v: 1, b: false }, { t: 90, v: 2, b: false }, { t: 150, v: 8, b: false }], spans: [[0, 60, 100], [60, 120, 200], [120, 180, 100]] };
        return JSON.stringify(r) === JSON.stringify(want) ? true : JSON.stringify(r);
    });

    await t.step('a request\'s start where all the time before it is known: the same value, nothing; another, a value recorded at that very time; nothing known before it, the state in force there — in any order of the answers', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, run = (id, order) => {
                const parts = [[[H(0, 1), H(10 * M, 2)], 0], [[H(60 * M, 2), H(70 * M, 3)], 60], [[H(120 * M, 5)], 120]];
                for( const k of order ) { const [rows, a] = parts[k]; I._mergeLayer('hist', id, rows, T + a * M, T + ( a + 60 ) * M, T + 500 * M); }
                return rowsOf('hist', id); };
            return { inOrder: run('sensor.start1', [0, 1, 2]), reversed: run('sensor.start2', [2, 1, 0]), mixed: run('sensor.start3', [1, 2, 0]) }; })()`);
        const want = JSON.stringify([{ t: 0, v: 1, b: true }, { t: 10, v: 2, b: false }, { t: 70, v: 3, b: false }, { t: 120, v: 5, b: false }]);
        return [r.inOrder, r.reversed, r.mixed].every(x => JSON.stringify(x) === want) ? true : JSON.stringify(r);
    });

    await t.step('a value at a request\'s very end: the next request\'s, never twice; values Home Assistant gives outside what was asked (a period begun before it): never kept', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, id = 'sensor.ends';
            I._mergeLayer('hist', id, [H(0, 1), H(60 * M, 2)], T, T + 60 * M, T + 500 * M);
            I._mergeLayer('hist', id, [H(60 * M, 2), H(90 * M, 3)], T + 60 * M, T + 120 * M, T + 500 * M);
            const S = (t, v) => ({ last_changed: T + t, state: v, statistics: { end: T + t + 3600e3, min: v, mean: v, max: v } });
            I._mergeLayer('stats', id, [S(-30 * M, 4), S(30 * M, 5)], T, T + 120 * M, T + 500 * M);
            return { hist: rowsOf('hist', id), stats: rowsOf('stats', id) }; })()`);
        const ok = JSON.stringify(r.hist.map(x => [x.t, x.v])) === '[[0,1],[60,2],[90,3]]' && JSON.stringify(r.stats.map(x => x.t)) === '[30]';
        return ok ? true : JSON.stringify(r);
    });

    await t.step('a state pushed: the history\'s row of the same time (to the ms) not doubled; one pushed late, at its time between others; the same value as the row before it, nothing', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, id = 'sensor.pushed';
            I._mergeLayer('hist', id, [H(0.4, 1), H(30 * M + 0.25, 2), H(60 * M, 3)], T, T + 120 * M, T + 500 * M);
            I.addLiveState(id, T + 30 * M, '2');          // (the history's, to a fraction of a ms)
            I.addLiveState(id, T + 45 * M, '9');          // (late: between 30 and 60)
            I.addLiveState(id, T + 50 * M, '9');          // (the same as the row before it)
            return rowsOf('hist', id).map(x => [Math.round(x.t), x.v]); })()`);
        return JSON.stringify(r) === '[[0,1],[30,2],[45,9],[60,3]]' ? true : JSON.stringify(r);
    });

    await t.step('this device\'s clock set an hour ahead, then two back while the page is open: Home Assistant\'s now as it was (its own clock), asking up to the later of both; the loading in the background never put off by it', async () => {
        const before = await t.E('el.instance._haNow()');
        await t.page.clock.setSystemTime(new Date(Date.parse('2026-11-20T12:00:00Z') + 3600e3 + 5000));
        const ahead = await t.E('({ ha: el.instance._haNow(), ask: el.instance.askNow(), now: Date.now() })');
        await t.page.clock.setSystemTime(new Date(Date.parse('2026-11-20T12:00:00Z') - 3600e3 + 10000));
        const back = await t.E(`(()=>{ const I = el.instance; I._backgroundNext = 0; I._aheadKey = null; I._askMissing(); return { ha: I._haNow(), ask: I.askNow(), wait: I._backgroundNext - ( performance.timeOrigin + performance.now() ) }; })()`);
        const ok = Math.abs(ahead.ha - before) < 30e3 && ahead.ask === ahead.now && Math.abs(back.ha - before) < 30e3 && back.ask === back.ha && back.wait <= 30000;
        return ok ? true : JSON.stringify({ before, ahead, back });
    });
    done(await t.close());

    // (two cards of the page — a second one made afterwards, another name —: one Home Assistant)
    t = await openCard(card({ statistics: { enabled: true } }), { mock: { series: true }, clock: '2026-11-20T12:00:00Z' });
    await t.wait(4000);
    await t.step('two cards of a page: Home Assistant\'s clock and what it was seen to have compiled known to both — the second one\'s first request knows them at once', async () => {
        const r = await t.E(`(async()=>{ const I = el.instance, P = Object.getPrototypeOf(I), _answered = P._answered;
            // (the second card's first answer of statistics: what was seen compiled when it was sent)
            P._answered = function(q, ...x) { if( this !== I && q.kind !== 'history' && window.__compiled === undefined ) window.__compiled = q.compiled; return _answered.call(this, q, ...x); };
            const e = document.createElement('history-explorer-card');
            e.setConfig({ ...window.CFG, cardName: 'second' + Date.now() }); document.getElementById('host').appendChild(e); e.hass = mkHass();
            await new Promise(r => setTimeout(r, 2500));
            P._answered = _answered;
            return { same: Math.abs(e.instance._haNow() - I._haNow()) < 1000, compiled: window.__compiled ?? 'none answered' }; })()`);
        return r.same && typeof r.compiled === 'number' ? true : JSON.stringify(r);
    });
    done(await t.close());

    // (Home Assistant in New York, this device in UTC)
    t = await openCard(card(), { mock: { series: true, timeZone: 'America/New_York' }, clock: '2026-11-20T12:00:00Z', timezone: 'UTC' });
    await t.wait(2000);
    await t.step('Home Assistant in another time zone than this device: its daily, weekly and monthly statistics asked on its own days (New York\'s midnight, its change of time on November 1st); the 5-minute and hourly ones by whole periods of UTC', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, iso = t => new Date(t).toISOString().slice(0, 16), p = (n, a, b) => I._periodsOver(n, Date.parse(a), Date.parse(b)).map(iso);
            return { day: p('day', '2026-11-20T12:00Z', '2026-11-20T13:00Z'), dst: p('day', '2026-11-01T12:00Z', '2026-11-02T12:00Z'), week: p('week', '2026-11-20T12:00Z', '2026-11-20T13:00Z'),
                     month: p('month', '2026-11-20T12:00Z', '2026-11-20T13:00Z'), fine: p('5minute', '2026-11-20T12:03:10Z', '2026-11-20T12:07:00Z'), hour: p('hour', '2026-11-20T12:03Z', '2026-11-20T13:01Z') }; })()`);
        const want = { day: ['2026-11-20T05:00', '2026-11-21T05:00'], dst: ['2026-11-01T04:00', '2026-11-03T05:00'], week: ['2026-11-16T05:00', '2026-11-23T05:00'],
                       month: ['2026-11-01T04:00', '2026-12-01T05:00'], fine: ['2026-11-20T12:00', '2026-11-20T12:10'], hour: ['2026-11-20T12:00', '2026-11-20T14:00'] };
        return JSON.stringify(r) === JSON.stringify(want) ? true : JSON.stringify(r);
    });
    done(await t.close());

    // (a direction read by an option — the color of a curve by the wind's direction —, a year: drawn
    // from statistics)
    t = await openCard(card({ defaultTimeRange: '1y', statistics: { enabled: true }, graphs: [{ type: 'line', entities: [{ entity: 'sensor.power', color: { entity: 'sensor.wind', 0: 'red', 180: 'blue' } }] }] }),
        { mock: { series: true }, clock: '2026-11-20T12:00:00Z' });
    await t.wait(6000);
    await t.step('an angle read by an option (a curve colored by the wind\'s direction): as a curve\'s — its history asked besides its statistics, Home Assistant\'s mean of an angle being wrong across 0', async () => {
        const r = await t.E(`(()=>{ const I = el.instance; return { angles: I._angleIds(I._statisticsIds()), hist: __ws.some(w => w.type === 'history/history_during_period' && w.ids.includes('sensor.wind') && Date.parse(w.start) < Date.now() - 7 * 86400e3) }; })()`);
        return JSON.stringify(r.angles) === '["sensor.wind"]' && r.hist ? true : JSON.stringify(r);
    });
    done(await t.close());

    t = await openCard(card(), { mock: { series: true, historyDelay: 3000 }, clock: '2026-11-20T12:00:00Z' });
    await t.wait(8000);
    await t.step('a refresh while the same time is being asked (Home Assistant slow): never asked twice', async () => {
        const r = await t.E(`(async()=>{ const I = el.instance, n0 = __ws.length;
            I.refresh(); await new Promise(r => setTimeout(r, 200)); I.refresh(); await new Promise(r => setTimeout(r, 200)); I.refresh();
            await new Promise(r => setTimeout(r, 4000));
            const h = __ws.slice(n0).filter(w => w.type === 'history/history_during_period').map(w => w.start + ' ' + ( w.end ?? '' ) + ' ' + w.ids.join());
            return { n: h.length, distinct: new Set(h).size }; })()`);
        return r.n >= 1 && r.n === r.distinct ? true : JSON.stringify(r);
    });
    done(await t.close());

    t = await openCard(card(), { mock: { series: true }, clock: '2026-11-20T12:00:00Z', init: HELPERS });
    await t.wait(3000);
    await t.step('the purge past 500 000 rows, the history recorded at fractions of a ms: its limits between them — every rule of the cache kept (each row within a span, the state in force at the limit)', async () => {
        const r = await t.E(`(()=>{ const I = el.instance, id = 'sensor.many', D = 86400e3;
            for( let d = 10; d < 50; d++ ) { const a = T - d * D; I._mergeLayer('hist', id, Array.from({ length: 13000 }, (_, k) => ({ last_changed: a + k * 6.5 + 0.37, state: String(k % 3) })), a, a + D, T); }
            const before = I.cacheRows(); window.__HEC_CACHE_ERRORS.length = 0; I._purge(); I._checkCache('test');
            return { before, after: I.cacheRows(), errors: window.__HEC_CACHE_ERRORS.slice(0, 3) }; })()`);
        return r.before > 500000 && r.after <= 300000 && !r.errors.length ? true : JSON.stringify(r);
    });
    done(await t.close());

    return { passed, failed };
};
