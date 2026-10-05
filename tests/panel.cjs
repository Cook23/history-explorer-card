// The info panel: the card's graph in Home Assistant's entity dialog
const { openCard } = require('./lib.cjs');

const HOUR = 3600e3;

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };
    const open = async (eid, panel = {}) => {
        const t = await openCard({}, { page: 'panel.html', panel, mock: { series: true }, height: 800 });
        await t.E(`openPanel('${eid}')`); await t.wait(2500);
        return t;
    };

    let t = await open('sensor.power');
    await t.step('the entity\'s history is shown as the card\'s graph', async () => {
        const d = await t.E('datasets(0)');
        return d.length === 1 && d[0].n > 100 ? true : JSON.stringify(d);
    });
    await t.step('the toolbar moves the time window (one day back)', async () => {
        const t0 = await t.E('timeRange()');
        await t.E(`inst()._this.querySelector('#b1_0').click()`); await t.wait(1200);
        const t1 = await t.E('timeRange()');
        return Date.parse(t1[0]) < Date.parse(t0[0]) - 20 * HOUR ? true : `${t0} -> ${t1}`;
    });
    await t.step('the type menu turns the curve into bars, with their interval selector', async () => {
        await t.E(`(()=>{ const I=inst(); const g=I.graphs[0]; I.showEntityTypeMenu(0, g.entities[0].entity, g); I.entityTypeMenuClicked(0, 'bar', null); })()`);
        await t.wait(1500);
        const g = await t.E(`[inst().graphs[0].type, !!inst()._this.querySelector('#bd-' + inst().graphs[0].id)]`);
        return g[0] === 'bar' && g[1] ? true : JSON.stringify(g);
    });
    done(await t.close());

    t = await open('sensor.wind');
    await t.step('an angle (unit °) is drawn as circular, period 360', async () => {
        const d = await t.E('datasets(0)');
        return d[0]?.circular === 360 ? true : JSON.stringify(d);
    });
    done(await t.close());

    t = await open('sensor.wind', { entityOptions: { 'sensor.wind': { circular: false } } });
    await t.step('the panel\'s entityOptions apply (circular: false)', async () => {
        const d = await t.E('datasets(0)');
        return d[0] && !d[0].circular ? true : JSON.stringify(d);
    });
    done(await t.close());

    t = await open('binary_sensor.a');
    await t.step('a binary sensor is shown as a timeline', async () => {
        const g = await t.E(`[inst().graphs[0].type, datasets(0).length]`);
        return g[0] === 'timeline' && g[1] >= 1 ? true : JSON.stringify(g);
    });
    done(await t.close());

    // ── On every page: hooked whether the panel is on or not, decided at each render ──
    const shown = () => t.E(`P.shadowRoot.innerHTML.includes('native') ? 'native' : P.hec_instance && P.shadowRoot.querySelector('#graphlist') ? 'panel' : '?'`);
    const openOff = async (opts = {}) => {
        const t = await openCard({}, { page: 'panel.html', panel: null, mock: { series: true }, height: 800, ...opts });
        await t.E(`openPanel('sensor.power')`); await t.wait(1500);
        return t;
    };
    t = await openOff();
    await t.step('panel off: the dialog shows Home Assistant\'s own history', async () => {
        const v = await shown();
        return v === 'native' ? true : v;
    });
    await t.step('switched on (as the card saves it): the next render shows the panel, no reload', async () => {
        await t.E(`window.__noReload = true; localStorage.setItem('history-explorer-info-panel', JSON.stringify({ enabled: true, config: {} })); P.requestUpdate()`);
        await t.wait(2500);
        const v = await shown(); const d = await t.E('P.hec_instance ? datasets(0) : null');
        return v === 'panel' && d && d[0].n > 100 && await t.E('window.__noReload') ? true : JSON.stringify({ v, d });
    });
    await t.step('switched off again: Home Assistant\'s own history', async () => {
        await t.E(`localStorage.removeItem('history-explorer-info-panel'); P.requestUpdate()`); await t.wait(500);
        const v = await shown();
        return v === 'native' ? true : v;
    });
    done(await t.close());

    t = await openOff({ userData: { 'history-explorer-info-panel': { enabled: true, config: {} } } });
    await t.step('a browser where the card never ran: the panel on from Home Assistant\'s user data, saved here', async () => {
        await t.wait(1500);
        const v = await shown(); const ls = await t.E(`!!localStorage.getItem('history-explorer-info-panel')`);
        return v === 'panel' && ls ? true : JSON.stringify({ v, ls });
    });
    done(await t.close());

    t = await openOff();
    await t.step('off in Home Assistant\'s user data too: its own history stays', async () => {
        const v = await shown(); const asked = await t.E(`__ws.filter(w=>w.type==='frontend/get_user_data').length`);
        return v === 'native' && asked === 1 ? true : JSON.stringify({ v, asked });
    });
    done(await t.close());

    t = await openCard({}, { page: 'panel.html', panel: {}, mock: { series: true }, height: 800, init: 'window.LOAD_TWICE=true;' });
    const errs = t.errors.slice();
    await t.E(`openPanel('sensor.power')`); await t.wait(2500);
    await t.step('the card\'s file loaded twice (two URLs): no error, the panel shown once', async () => {
        const v = await shown(); const d = await t.E('datasets(0)');
        const twice = await t.E(`[...document.scripts].filter(s=>s.src.includes('history-explorer-card.js')).length`);
        return twice === 2 && !errs.length && v === 'panel' && d.length === 1 && d[0].n > 100 ? true : JSON.stringify({ twice, errs, v, d });
    });
    done(await t.close());

    return { passed, failed };
};
