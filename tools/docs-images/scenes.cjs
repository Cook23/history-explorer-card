// The documentation's scenes: entities, histories, and the card's config
const { numeric, states, ent } = require('./doclib.cjs');

const DAY = 86400, H = 3600;
const sm = (x, a, b) => a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x))));
// A value following key points [[t (h), v], …] smoothly
const curve = pts => t => { const h = t / H; let i = 0; while( i < pts.length - 2 && h > pts[i + 1][0] ) i++;
    const [h0, v0] = pts[i], [h1, v1] = pts[i + 1]; return sm((h - h0) / (h1 - h0), v0, v1); };
// Short "on" pulses at the given hours (duration in s)
const pulses = (hours, dur = 90) => { const l = [[0, 'off']]; for( const h of hours ) { l.push([h * H, 'on'], [h * H + dur, 'off']); } return l; };

// The hero: two temperatures, the pressure, four non-numerical sensors over one day
const home = {
    states: {
        'sensor.outside_temperature': ent('sensor.outside_temperature', 'Outside temperature', '°C', 4.9, { state_class: 'measurement', device_class: 'temperature' }),
        'sensor.annexe_temperature': ent('sensor.annexe_temperature', 'Annexe temperature', '°C', 5.9, { state_class: 'measurement', device_class: 'temperature' }),
        'sensor.outside_pressure': ent('sensor.outside_pressure', 'Outside pressure', 'hPa', 1025.3, { state_class: 'measurement', device_class: 'pressure' }),
        'binary_sensor.yard_pir': ent('binary_sensor.yard_pir', 'Yard PIR', null, 'off', { device_class: 'motion' }),
        'binary_sensor.barn_door': ent('binary_sensor.barn_door', 'Barn door', null, 'off', { device_class: 'door' }),
        'input_select.heater': ent('input_select.heater', 'Heater', null, 'Confort - 1', { options: ['Confort - 1', 'Eco', 'Off'] }),
        'person.alex': ent('person.alex', 'Alex', null, 'home'),
    },
    rows: {
        'sensor.outside_temperature': numeric(DAY, 300, curve([[0, 3.9], [0.6, 3.6], [1, 4.2], [3.5, 4.6], [6, 5.3], [9, 5.0], [11.8, 5.2], [13, 4.4], [16, 4.6], [19.5, 4.9], [21.8, 4.4], [24, 4.9]]), { noise: 0.12, seed: 3, digits: 2 }),
        'sensor.annexe_temperature': numeric(DAY, 300, curve([[0, 6.0], [5, 5.9], [8, 6.1], [10, 6.3], [12.5, 6.6], [15, 6.6], [17, 6.4], [20, 6.1], [23, 5.9], [24, 5.9]]), { noise: 0.1, seed: 5, digits: 2 }),
        'sensor.outside_pressure': numeric(DAY, 600, curve([[0, 1032.8], [4, 1031.6], [6, 1030.4], [10, 1029.8], [12, 1029.6], [14, 1028.3], [17, 1026.8], [20, 1026.2], [24, 1025.3]]), { noise: 0.06, seed: 7, digits: 2 }),
        'binary_sensor.yard_pir': states(DAY, pulses([0.02, 0.15, 0.25, 4.2, 6.8, 6.85, 14.5, 15.5, 17.8, 18.95, 19.1, 19.3, 19.7], 120)),
        'binary_sensor.barn_door': states(DAY, pulses([0.05, 14.7, 15.5, 17.7, 17.75, 18.8], 240)),
        'input_select.heater': states(DAY, [[0, 'Confort - 1'], [8.2 * H, 'Eco'], [17.9 * H, 'Confort - 1']]),
        'person.alex': states(DAY, [[0, 'home'], [17.85 * H, 'not_home'], [18.7 * H, 'home']]),
    },
    clock: '2025-12-20T00:00:00Z',
    cfg: {
        type: 'custom:history-explorer-card', header: 'History explorer', defaultTimeRange: '24h',
        graphs: [
            { type: 'line', entities: [{ entity: 'sensor.outside_temperature', fill: 'rgba(52,152,219,0.08)' }, { entity: 'sensor.annexe_temperature' }] },
            { type: 'line', entities: [{ entity: 'sensor.outside_pressure' }] },
            { type: 'timeline', title: 'Non-numerical sensors', entities: [{ entity: 'binary_sensor.yard_pir' }, { entity: 'binary_sensor.barn_door' }, { entity: 'input_select.heater' }, { entity: 'person.alex' }] },
        ],
    },
};

module.exports = { home, numeric, states, ent, curve, pulses, DAY, H };

// Adding entities: a modem's signal and network mode over two days, the field filled in
const modem = {
    states: {
        'sensor.modem_signal_rsrp': ent('sensor.modem_signal_rsrp', 'Modem signal RSRP', 'dBm', -87, { state_class: 'measurement', device_class: 'signal_strength' }),
        'sensor.modem_network_mode': ent('sensor.modem_network_mode', 'Modem network mode', null, 'LTE'),
        'sensor.modem_signal_strength': ent('sensor.modem_signal_strength', 'Modem signal strength', '%', 64, { state_class: 'measurement' }),
        'sensor.modem_status': ent('sensor.modem_status', 'Modem status', null, 'connected'),
        'sensor.modem_uptime': ent('sensor.modem_uptime', 'Modem uptime', 'h', 12.4, { state_class: 'measurement' }),
    },
    rows: {
        'sensor.modem_signal_rsrp': numeric(2 * DAY, 600, t => t < 38.3 * H ? -72 + (Math.random() < 0.12 ? 4 + 6 * Math.random() : 0) : -87.5, { noise: 2.2, seed: 11, digits: 0 }),
        'sensor.modem_network_mode': states(2 * DAY, [[0, 'WCDMA'], [38.3 * H, 'LTE']]),
    },
    clock: '2025-12-23T12:00:00Z',
    cfg: {
        type: 'custom:history-explorer-card', header: 'History explorer', defaultTimeRange: '2d',
        graphs: [
            { type: 'line', entities: [{ entity: 'sensor.modem_signal_rsrp' }] },
            { type: 'timeline', entities: [{ entity: 'sensor.modem_network_mode' }] },
        ],
    },
};
module.exports.modem = modem;
