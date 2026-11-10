// A real data set for the tests: a month of a Home Assistant's history, as the card's CSV
// export writes it (data/history-month.csv) — sensors that speak every minute, every hour, in
// bursts, or fall silent at night. Private — the user's own data —: never in the repository
// (.gitignore), only on the machine that runs the tests; without it, the tests that use it
// are skipped (dataset.available). Given to the mock as if its last value were now (MOCK.rows,
// MOCK.states): dataset(ids) → { rows, states }
const fs = require('fs'), path = require('path');

// (the entities with long-term statistics in that Home Assistant: a state class)
const WITH_STATISTICS = new Set(['consigne_thermostat_mezzanine', 'lp_ecowitt_absolute_pressure', 'lp_ecowitt_outdoor_temperature', 'lp_ecowitt_piezo_rain_coef',
    'lp_ecowitt_piezo_rain_rate', 'lp_ecowitt_piezo_rain_rate_cor', 'lp_ecowitt_rain_event', 'lp_ecowitt_rain_rate', 'lp_ecowitt_solar_irradiance', 'lp_ecowitt_wind_direction',
    'lp_mesure_thermostat_bureau_ma_lin', 'lp_mesure_thermostat_mezzanine', 'lp_puissance_1', 'lp_puissance_2', 'lp_puissance_3', 'lp_puissance_chauffe_eau', 'lp_puissance_ev',
    'lp_puissance_ev_1', 'lp_puissance_ev_2', 'lp_puissance_ev_3', 'lp_puissance_maison', 'lp_puissance_pompe', 'lp_puissance_prioritaires', 'lp_puissance_var_piscine',
    'lp_villeveyrac_temperature', 'sun_azimuth', 'villeveyrac_temperature'].map(x => 'sensor.' + x));

const FILE = path.join(__dirname, 'data', 'history-month.csv');
let _all = null;
function load()
{
    if( _all ) return _all;
    _all = {};
    let cur = null;
    for( const l of fs.readFileSync(FILE, 'utf8').split(/\r?\n/) ) {
        if( !l || l.startsWith('Time') ) continue;
        if( /^\d{4}-/.test(l) ) { const k = l.indexOf(','); _all[cur].push([Date.parse(l.slice(0, k).replace(' ', 'T') + 'Z') / 1000, l.slice(k + 1)]); }
        else _all[cur = l] = [];
    }
    return _all;
}

module.exports = function dataset(ids)
{
    const all = load(), end = Object.values(all).reduce((m, r) => r.reduce((k, x) => Math.max(k, x[0]), m), -Infinity);
    const rows = {}, states = {};
    for( const id of ids ) {
        const r = all[id];
        if( !r ) throw new Error('not in the data set: ' + id);
        // (seconds before now: the data set's end is now)
        rows[id] = r.map(([t, s]) => [end - t, s]);
        states[id] = { state: r[r.length - 1][1], state_class: WITH_STATISTICS.has(id) ? 'measurement' : undefined };
    }
    return { rows, states };
};

// (whether the data set is on this machine)
module.exports.available = () => fs.existsSync(FILE);
