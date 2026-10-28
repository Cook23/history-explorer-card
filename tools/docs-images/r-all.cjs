// The documentation's other images: each scene its entities, histories, config, and what is
// done before the capture. node r-all.cjs [scene]
const fs = require('fs');
const path = require('path');
const { openDoc, union, compose, numeric, states, ent, rng, OUT } = require('./doclib.cjs');
const { curve, pulses, DAY, H } = require('./scenes.cjs');

const only = process.argv[2];
const M = { state_class: 'measurement' };
const graph = (d, gi) => d.E(`(()=>{ const r=el.instance.graphsInDisplayOrder()[${gi}].canvas.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()`);
const allGraphs = async d => { const n = await d.E('el.instance.graphsInDisplayOrder().length'); const rs = []; for( let i = 0; i < n; i++ ) rs.push(await graph(d, i)); return union(...rs); };
async function longPress(d, p) { const m = d.page.mouse; await m.move(p.x, p.y); await m.down(); await d.wait(900); await m.up(); await d.wait(400); }
const plain = { header: 'hide', uiLayout: { toolbar: 'hide', selector: 'hide' } };

// Wind over `days` days: gusts in bursts during the day, calm at night; the average lower
function wind(days, step, seed, scale = 1) {
    const r = rng(seed); let g = 0; const gust = [], avg = []; const span = days * DAY;
    for( let ago = span; ago >= 0; ago -= step ) {
        const t = span - ago, hour = (t / H) % 24, day = Math.floor(t / DAY);
        const env = Math.max(0, Math.sin(Math.PI * (hour - 7) / 13)) * (0.6 + 0.8 * ((day * 7919 % 13) / 13));
        g = Math.max(0, g * 0.6 + (r() - 0.45) * 4 * env * scale);
        const v = r() < 0.15 * (1 - env) ? 0 : g + env * 2 * scale * r();
        gust.push([ago, v.toFixed(1)]); avg.push([ago, (v * 0.3 + env * 0.4 * scale).toFixed(2)]);
    }
    return { gust, avg };
}
const W2 = wind(14, 900, 21), W1 = wind(1.2, 300, 23, 1.6);
const windStates = {
    'sensor.wind_gusts': ent('sensor.wind_gusts', 'Wind gusts', 'kts', 2.2, M),
    'sensor.wind_speed': ent('sensor.wind_speed', 'Wind speed', 'kts', 1.1, M),
    'sensor.wind_speed_average': ent('sensor.wind_speed_average', 'Wind speed average', 'kts', 0.29, M),
    'sensor.wind_direction': ent('sensor.wind_direction', 'Wind direction', '°', 210, M),
};

// A rain gauge (a total, in mm) over `days` days: showers
function rain(days, step, seed) {
    const r = rng(seed); let tot = 400, rows = []; const span = days * DAY;
    for( let ago = span; ago >= 0; ago -= step ) { const h = (span - ago) / H; const wet = (h > 4 && h < 9) || (h > 12 && h < 16.5) || (h > 19 && h < 21);
        if( wet && r() < 0.55 ) tot += 0.25 * (1 + Math.floor(r() * (h > 14 && h < 16 ? 5 : 2))); rows.push([ago, tot.toFixed(2)]); }
    return rows;
}
// A total growing by amounts[i] on the i-th of the last n days
function rainDaily(amounts, n) { let tot = 100; const rows = [[n * DAY + 60, String(tot)]];
    amounts.forEach((a, i) => { for( let k = 1; k <= 4; k++ ) { tot += a / 4; rows.push([(n - i - 1) * DAY - k * 4 * H + 2 * H, tot.toFixed(2)]); } }); return rows; }
// A total growing by amounts[i] in the i-th of the last hours
function hourlyTotal(amounts, start) { let tot = start; const n = amounts.length, rows = [[n * H + 60, String(tot)]];
    amounts.forEach((a, i) => { for( let k = 1; k <= 6; k++ ) { tot += a / 6; rows.push([(n - i) * H - k * 600 + 30, tot.toFixed(3)]); } }); return rows; }

const { home } = require('./scenes.cjs');
const menuRects = d => d.E(`[...el.querySelectorAll('[id^=et_0],[id^=eo_0],[id^=es_0]')].filter(b=>b.style.display!=='none' && b.offsetParent && getComputedStyle(b).position==='absolute').map(b=>{ const r=b.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })`);
const climate = {
    'climate.living_room': ent('climate.living_room', 'Living room', null, 'heat', { current_temperature: 19.6, temperature: 20, current_humidity: 48, hvac_action: 'heating', hvac_modes: ['heat', 'off'], min_temp: 7, max_temp: 35 }),
    'sensor.living_room_temperature': ent('sensor.living_room_temperature', 'Living room temperature', '°C', 19.6, M),
    'sensor.heat_pump_power': ent('sensor.heat_pump_power', 'Heat pump power', 'W', 850, M),
    'sensor.outside_temperature': ent('sensor.outside_temperature', 'Outside temperature', '°C', 6.5, M),
};

const scenes = {
    // ── Line modes: the same values in each mode, with their points ──
    'line-modes': {
        parts: ['curves', 'lines', 'stepped', 'smart'].map(mode => ({
            name: 'lm-' + mode, width: 300,
            states: { 'sensor.sample': ent('sensor.sample', 'Sample', '°C', 5, M) },
            rows: { 'sensor.sample': [[6 * H, 5], [5 * H, 7.5], [4 * H, 4.6], [3 * H, 6.2], [1.6 * H, 3.6], [0.8 * H, 4.9]].map(([a, v]) => [a, String(v)]) },
            clock: '2025-12-20T12:00:00Z',
            cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '6h', legendVisible: false, labelsLeft: false, labelsRight: false,
                   graphs: [{ type: 'line', options: { height: 120, showTimeLabels: false }, entities: [{ entity: 'sensor.sample', lineMode: mode, showPoints: true, fill: 'rgba(52,152,219,0.12)' }] }] },
        })),
        compose: ps => [[{ img: 'lm-curves', caption: 'Curves (curves)' }, { img: 'lm-lines', caption: 'Lines (lines)' }, { img: 'lm-stepped', caption: 'Stepped (stepped)' }, { img: 'lm-smart', caption: 'Smart (smart)' }]],
        captionSize: 30,
    },

    // ── Grouping: three graphs of the same unit, then one (combineSameUnits) ──
    'auto-grouping': {
        parts: [
            { name: 'ag-before', width: 700, states: windStates, rows: { 'sensor.wind_speed': W1.avg.map(([a, v]) => [a, (v * 1.4).toFixed(2)]), 'sensor.wind_gusts': W1.gust, 'sensor.wind_speed_average': W1.avg }, clock: '2025-03-04T03:00:00Z',
              cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '24h', lineGraphHeight: 110,
                     graphs: [{ type: 'line', entities: [{ entity: 'sensor.wind_speed', color: '#7cb342' }] }, { type: 'line', entities: [{ entity: 'sensor.wind_gusts', color: '#e53935', lineMode: 'stepped' }] }, { type: 'line', entities: [{ entity: 'sensor.wind_speed_average', color: '#26a69a' }] }] } },
            { name: 'ag-after', width: 700, states: windStates, rows: { 'sensor.wind_speed': W1.avg.map(([a, v]) => [a, (v * 1.4).toFixed(2)]), 'sensor.wind_gusts': W1.gust, 'sensor.wind_speed_average': W1.avg }, clock: '2025-03-04T03:00:00Z',
              cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '24h', lineGraphHeight: 150,
                     graphs: [{ type: 'line', entities: [{ entity: 'sensor.wind_speed', color: '#7cb342' }, { entity: 'sensor.wind_gusts', color: '#e53935', lineMode: 'stepped' }, { entity: 'sensor.wind_speed_average', color: '#26a69a' }] }] } },
        ],
        compose: () => [[{ img: 'ag-before' }], [{ space: 1, h: 90 }], [{ img: 'ag-after' }]],
        notesAt: c => [{ arrow: [c.width / 2 - 140, c.hBefore + 10, c.width / 2 - 140, c.hBefore + 100] }, { text: 'combineSameUnits: true', x: c.width / 2 - 100, y: c.hBefore + 72, size: 34 }],
    },

    // ── Compass arrows: the gusts, the direction as arrows ──
    'compass': {
        width: 700, states: windStates, clock: '2025-04-15T07:00:00Z',
        rows: { 'sensor.wind_gusts': W1.gust, 'sensor.wind_direction': numeric(DAY * 1.2, 1800, t => 330 + 60 * Math.sin(t / 30000), { noise: 25, seed: 31, digits: 0 }) },
        cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '24h', lineGraphHeight: 140,
               graphs: [{ type: 'line', entities: [{ entity: 'sensor.wind_gusts', color: '#7cb342', lineMode: 'stepped' }] }, { type: 'arrowline', entities: [{ entity: 'sensor.wind_direction' }] }] },
    },

    // ── Bars: the rain by hour and by 10 minutes, each with its interval ──
    'bars-interval': {
        width: 760, clock: '2025-09-28T11:00:00Z',
        states: { 'sensor.rain_amount': ent('sensor.rain_amount', 'Rain amount', 'mm', 412.5, { state_class: 'total_increasing' }) },
        rows: { 'sensor.rain_amount': rain(1.2, 600, 41) },
        cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '24h', barGraphHeight: 140, legendVisible: false,
               graphs: [{ type: 'bar', options: { interval: 'hourly' }, entities: [{ entity: 'sensor.rain_amount', color: '#3e95cd' }] }, { type: 'bar', options: { interval: '10m' }, entities: [{ entity: 'sensor.rain_amount', color: '#3e95cd' }] }] },
    },

    // ── Bars side by side: two rain gauges, a day each ──
    'bars-side': {
        width: 700, clock: '2025-10-01T00:00:00Z',
        states: { 'sensor.rain_garden': ent('sensor.rain_garden', 'Garden', 'mm', 120, { state_class: 'total_increasing' }), 'sensor.rain_roof': ent('sensor.rain_roof', 'Roof', 'mm', 98, { state_class: 'total_increasing' }) },
        rows: { 'sensor.rain_garden': rainDaily([1.7, 3.6, 6.1, 3.8, 2.5, 2.1], 7), 'sensor.rain_roof': rainDaily([3.6, 7.2, 12.2, 7.6, 5.1, 4.0], 7) },
        cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '6d', barGraphHeight: 160,
               graphs: [{ type: 'bar', title: 'Rainfall', options: { interval: 'daily' }, entities: [{ entity: 'sensor.rain_garden', color: '#d0393b' }, { entity: 'sensor.rain_roof', color: '#3ecf8e' }] }] },
    },

    // ── Colors: bars colored by thresholds on their value ──
    'bars-colors': {
        width: 640, clock: '2025-10-23T01:00:00Z',
        states: { 'sensor.energy_consumed': ent('sensor.energy_consumed', 'Energy consumed', 'kWh', 2345.1, { state_class: 'total_increasing', device_class: 'energy' }) },
        rows: { 'sensor.energy_consumed': hourlyTotal([0.3, 0.3, 0.3, 0.3, 1.08, 1.35, 1.22, 1.08, 1.55, 1.33], 2300) },
        cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '10h', barGraphHeight: 150, legendVisible: false,
               graphs: [{ type: 'bar', options: { interval: 'hourly' }, entities: [{ entity: 'sensor.energy_consumed', color: { '0.0': '#3e95cd', '1.0': '#64a321', '1.5': '#c0392b' } }] }] },
    },

    // ── Stacked bars: two sources stacked, a day each ──
    'bars-stacked': {
        width: 640, clock: '2025-11-24T00:00:00Z',
        states: { 'sensor.energy_grid': ent('sensor.energy_grid', 'Grid', 'kWh', 900, { state_class: 'total_increasing', device_class: 'energy' }), 'sensor.energy_solar': ent('sensor.energy_solar', 'Solar', 'kWh', 400, { state_class: 'total_increasing', device_class: 'energy' }) },
        rows: { 'sensor.energy_grid': rainDaily([2.6, 6.5, 6.1, 1.5, 0.9, 0.4, 6.4, 0, 10.4, 9.7, 0, 0.8], 12), 'sensor.energy_solar': rainDaily([1.0, 2.5, 2.4, 1.0, 0.5, 0.1, 2.0, 0, 6.8, 5.0, 0, 0.6], 12) },
        cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '12d', barGraphHeight: 150,
               graphs: [{ type: 'bar', options: { interval: 'daily', stacked: true }, entities: [{ entity: 'sensor.energy_grid', color: '#d0393b' }, { entity: 'sensor.energy_solar', color: '#3ecf8e' }] }] },
    },

    // ── Timelines: motion, a lock, a person ──
    'timeline': {
        width: 640, clock: '2025-12-20T00:00:00Z',
        states: { 'binary_sensor.yard_pir': ent('binary_sensor.yard_pir', 'Yard PIR', null, 'off', { device_class: 'motion' }), 'lock.front_door': ent('lock.front_door', 'Front door', null, 'locked'), 'person.alex': ent('person.alex', 'Alex', null, 'home') },
        rows: { 'binary_sensor.yard_pir': states(10 * H, pulses([0.3, 0.6, 0.65, 2.4, 4.9, 5.6, 5.7, 6.4, 7.4, 8.5, 9.2], 150)), 'lock.front_door': states(10 * H, [[0, 'locked'], [0.4 * H, 'unlocked'], [0.7 * H, 'locked'], [4.95 * H, 'unlocked'], [8.1 * H, 'locked'], [8.15 * H, 'unlocked'], [8.4 * H, 'locked']]), 'person.alex': states(10 * H, [[0, 'not_home'], [0.6 * H, 'not_home'], [4.95 * H, 'home']]) },
        cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '10h',
               graphs: [{ type: 'timeline', entities: [{ entity: 'binary_sensor.yard_pir' }, { entity: 'lock.front_door' }, { entity: 'person.alex' }] }] },
    },

    // ── The multiple state: many short states merged, its tooltip ──
    'timeline-multiple': {
        width: 900, clock: '2025-12-20T00:00:00Z',
        states: { 'binary_sensor.yard_pir': ent('binary_sensor.yard_pir', 'Yard PIR', null, 'off', { device_class: 'motion' }), 'binary_sensor.barn_door': ent('binary_sensor.barn_door', 'Barn door', null, 'off', { device_class: 'door' }), 'input_select.heater': ent('input_select.heater', 'Heater', null, 'Eco') },
        rows: { 'binary_sensor.yard_pir': states(DAY, pulses([1.2, 4.2, 6.8, 14.5, 15.5, 17.75, 17.76, 17.77, 17.78, 17.79, 17.8, 17.81, 19.5, 19.51, 19.52, 19.53], 25)),
                'binary_sensor.barn_door': states(DAY, pulses([0.5, 14.7, 15.5, 17.7, 18.8], 240)),
                'input_select.heater': states(DAY, [[0, 'Confort - 1'], [8.2 * H, 'Eco'], [17.9 * H, 'Confort - 1'], [20.6 * H, 'Eco']]) },
        cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '24h', graphs: [{ type: 'timeline', title: 'Non-numerical sensors', entities: [{ entity: 'binary_sensor.yard_pir' }, { entity: 'binary_sensor.barn_door' }, { entity: 'input_select.heater' }] }] },
        act: async d => {
            const p = await d.E(`(()=>{ const c=el.instance.graphsInDisplayOrder()[0].chart, r=c.canvas.getBoundingClientRect(); const x=c.scales['x-axis-0'].getPixelForValue(new Date(Date.now()-24*3600e3+17.78*3600e3)); const y=c.scales['y-axis-0'].getPixelForValue(null,0,0); return {x:r.left+x,y:r.top+y}; })()`);
            await d.page.mouse.click(p.x, p.y); await d.wait(700);
            const tip = await d.rect('#hec-label-tooltip') || await d.E(`(()=>{ const t=document.querySelector('[id^=hec-tooltip],[id*=tooltip]'); if(!t) return null; const r=t.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()`);
            const c = await d.card();
            return { x: c.x + c.width * 0.3, y: c.y, width: c.width * 0.6, height: c.height };
        },
    },

    // ── Long term statistics: statistics where the history is gone ──
    'long-term-stats': {
        width: 1000, clock: '2025-10-18T12:00:00Z', mock: { historyDays: 7 },
        states: { 'sensor.outside_temperature': ent('sensor.outside_temperature', 'Outside temperature', '°C', 13.5, { state_class: 'measurement', device_class: 'temperature' }), 'sensor.annexe_temperature': ent('sensor.annexe_temperature', 'Annexe temperature', '°C', 13.3, { device_class: 'temperature' }) },
        rows: { 'sensor.outside_temperature': numeric(14 * DAY, 900, t => 12 + 4 * Math.sin((t / H - 9) / 24 * 2 * Math.PI) * (0.8 + 0.4 * Math.sin(t / DAY)), { noise: 0.5, seed: 51, digits: 2 }),
                'sensor.annexe_temperature': numeric(14 * DAY, 900, t => 13.5 + 2.5 * Math.sin((t / H - 11) / 24 * 2 * Math.PI), { noise: 0.4, seed: 53, digits: 2 }).filter(([a]) => a <= 7 * DAY) },
        cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '14d', lineGraphHeight: 220,
               graphs: [{ type: 'line', entities: [{ entity: 'sensor.outside_temperature', color: '#3e95cd' }, { entity: 'sensor.annexe_temperature', color: '#e8364e' }] }] },
        act: async d => { const c = await d.card(); const g = await graph(d, 0);
            await d.annotate([{ text: 'Long term statistics', x: g.x + g.width * 0.14, y: g.y + 62, size: 22 }, { text: 'Normal history', x: g.x + g.width * 0.7, y: g.y + 62, size: 22 }]); return c; },
    },

    // ── The current values in the legend ──
    'current-values': {
        width: 400, clock: '2025-03-04T15:00:00Z', states: windStates, rows: { 'sensor.wind_gusts': W1.gust.map(([a, v]) => [a, (v * 2.4).toFixed(1)]) },
        cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '24h', lineGraphHeight: 120, graphs: [{ type: 'line', entities: [{ entity: 'sensor.wind_gusts', color: '#d0393b', lineMode: 'stepped' }] }] },
    },

    // ── The Y axis' padlock ──
    'y-lock': {
        width: 520, clock: '2025-03-04T15:00:00Z', states: windStates, rows: { 'sensor.wind_gusts': W1.gust.map(([a, v]) => [a, (v * 2.4).toFixed(1)]), 'sensor.wind_speed_average': W1.avg },
        cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '24h', lineGraphHeight: 140, graphs: [{ type: 'line', entities: [{ entity: 'sensor.wind_gusts', color: '#3e95cd', lineMode: 'stepped' }, { entity: 'sensor.wind_speed_average', color: '#8bc34a' }] }] },
        act: async d => { const p = await d.E('lockPt(0)'); await d.annotate([{ arrow: [p.x + 60, p.y + 4, p.x + 14, p.y + 2] }]); return await d.card(); },
    },

    // ── Individual samples: a curve's points ──
    'samples': {
        width: 620, clock: '2025-12-19T15:00:00Z', states: { 'sensor.outside_temperature': ent('sensor.outside_temperature', 'Outside temperature', '°C', 6.2, { state_class: 'measurement' }) },
        rows: { 'sensor.outside_temperature': [[7.6, 8.0], [7.4, 7.7], [7.2, 7.4], [7.0, 7.2], [6.4, 7.3], [6.0, 7.6], [5.8, 7.8], [5.1, 7.9], [4.4, 7.8], [3.9, 7.7], [3.4, 7.8], [2.8, 8.1], [2.2, 8.0], [1.9, 7.7], [1.3, 7.8], [0.9, 7.7], [0.6, 7.5], [0.35, 7.8], [0.1, 7.6]].map(([h, v]) => [h * H, String(v)]) },
        cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '8h', lineGraphHeight: 130, graphs: [{ type: 'line', entities: [{ entity: 'sensor.outside_temperature', showPoints: true }] }] },
    },

    'tick-density-auto': {
        width: 620, clock: '2025-08-23T12:00:00Z', states: windStates, rows: { 'sensor.wind_gusts': W2.gust.map(([a, v]) => [a, (v * 2).toFixed(1)]), 'sensor.wind_speed_average': W2.avg },
        cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '14d', lineGraphHeight: 150, timeTicks: {},
               graphs: [{ type: 'line', entities: [{ entity: 'sensor.wind_gusts', color: '#3e95cd', lineMode: 'stepped' }, { entity: 'sensor.wind_speed_average', color: '#8bc34a' }] }] },
    },

    'tick-density-higher': {
        width: 620, clock: '2025-08-23T12:00:00Z', states: windStates, rows: { 'sensor.wind_gusts': W2.gust.map(([a, v]) => [a, (v * 2).toFixed(1)]), 'sensor.wind_speed_average': W2.avg },
        cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '14d', lineGraphHeight: 150, timeTicks: { densityOverride: 'higher' },
               graphs: [{ type: 'line', entities: [{ entity: 'sensor.wind_gusts', color: '#3e95cd', lineMode: 'stepped' }, { entity: 'sensor.wind_speed_average', color: '#8bc34a' }] }] },
    },

    'tick-density-short': {
        width: 620, clock: '2025-08-23T12:00:00Z', states: windStates, rows: { 'sensor.wind_gusts': W2.gust.map(([a, v]) => [a, (v * 2).toFixed(1)]), 'sensor.wind_speed_average': W2.avg },
        cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '14d', lineGraphHeight: 150, timeTicks: { densityOverride: 'higher', dateFormat: 'short' },
               graphs: [{ type: 'line', entities: [{ entity: 'sensor.wind_gusts', color: '#3e95cd', lineMode: 'stepped' }, { entity: 'sensor.wind_speed_average', color: '#8bc34a' }] }] },
    },

    // ── A narrow card, and look: mini at two widths; light and dark ──
    ...Object.fromEntries([false, true].map(dark => ['narrow-and-mini' + (dark ? '-dark' : ''), {
        parts: [['nm-narrow', 168, false], ['nm-mini', 374, true], ['nm-mini-small', 168, true]].map(([n, w, mini]) => ({
            name: n + (dark ? '-d' : ''), width: w, dark, clock: '2025-10-13T15:00:00Z', height: 900,
            states: { ...windStates, 'sensor.rain_rate': ent('sensor.rain_rate', 'Rain rate', 'mm/h', 4, M), 'sensor.rain_tank': ent('sensor.rain_tank', 'Rain tank', 'L', 800, M) },
            rows: { 'sensor.wind_gusts': numeric(DAY, 600, t => 14 + 9 * Math.sin(t / 9000), { noise: 1.6, seed: 61, digits: 1 }), 'sensor.wind_speed': numeric(DAY, 600, t => 9 + 6 * Math.sin(t / 9000), { noise: 1.0, seed: 63, digits: 1 }),
                    'sensor.rain_rate': numeric(DAY, 600, t => Math.max(0, 3 + 3 * Math.sin(t / 7000)), { noise: 0.4, seed: 65, digits: 1 }), 'sensor.rain_tank': numeric(DAY, 600, t => 700 + t / 1000, { noise: 0, seed: 67, digits: 0 }) },
            cfg: mini ? { type: 'custom:history-explorer-card', look: 'mini', showStats: true, defaultTimeRange: '24h', graphs: [{ type: 'line', title: 'Wind', entities: [{ entity: 'sensor.wind_gusts', name: 'Gusts' }, { entity: 'sensor.wind_speed', name: 'Speed' }] }] }
                      : { type: 'custom:history-explorer-card', header: 'hide', defaultTimeRange: '24h', graphs: [{ type: 'line', entities: [{ entity: 'sensor.wind_gusts' }, { entity: 'sensor.wind_speed' }] }, { type: 'line', entities: [{ entity: 'sensor.rain_rate', color: '#d0393b' }, { entity: 'sensor.rain_tank', color: '#3ecf8e' }] }] },
        })),
        compose: ps => [ps.map(p => ({ img: p.name }))], bg: dark ? '#111111' : '#fafafa',
    }])),

    // ── Data decimation: a week of a value every minute, one point per column ──
    'decimation': {
        width: 900, clock: '2025-12-19T23:00:00Z',
        states: { 'sensor.outside_temperature': ent('sensor.outside_temperature', 'Outside temperature', '°C', 5, { device_class: 'temperature' }), 'sensor.annexe_temperature': ent('sensor.annexe_temperature', 'Annexe temperature', '°C', 8, { device_class: 'temperature' }) },
        rows: { 'sensor.outside_temperature': numeric(5 * DAY, 60, t => 5 + 3 * Math.sin((t / H - 9) / 24 * 2 * Math.PI) + Math.sin(t / 50000), { noise: 0.7, seed: 71, digits: 2 }),
                'sensor.annexe_temperature': numeric(5 * DAY, 60, t => 8.5 + 2 * Math.sin((t / H - 11) / 24 * 2 * Math.PI) + Math.sin(t / 60000), { noise: 0.5, seed: 73, digits: 2 }) },
        cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '5d', lineGraphHeight: 170, graphs: [{ type: 'line', entities: [{ entity: 'sensor.outside_temperature', color: '#3e95cd' }, { entity: 'sensor.annexe_temperature', color: '#e8364e' }] }] },
    },

    // ── The tooltip, opened by a click on a curve ──
    'tooltip': {
        width: 900, states: home.states, rows: home.rows, clock: home.clock, cfg: { ...home.cfg, header: 'hide', uiLayout: { toolbar: 'hide', selector: 'hide' }, graphs: [home.cfg.graphs[0]] },
        act: async d => { const p = await d.E('pointPt(0,0.62)'); await d.page.mouse.click(p.x, p.y); await d.wait(700); return await d.card(); },
    },

    // ── Two Y axes: a power on the left, a temperature on the right ──
    'two-y-axes': {
        width: 900, clock: '2025-12-20T00:00:00Z', states: climate,
        rows: { 'sensor.heat_pump_power': numeric(DAY, 300, t => { const h = t / H; return (h % 3) < 1.4 ? 1100 + 500 * Math.sin(h) : 40; }, { noise: 40, seed: 81, digits: 0 }),
                'sensor.outside_temperature': numeric(DAY, 600, curve([[0, 3.2], [6, 2.4], [9, 4.5], [14, 9.8], [18, 7], [24, 4.1]]), { noise: 0.15, seed: 83, digits: 2 }) },
        cfg: { type: 'custom:history-explorer-card', ...plain, defaultTimeRange: '24h', lineGraphHeight: 200,
               graphs: [{ type: 'line', entities: [{ entity: 'sensor.heat_pump_power', color: '#e8364e', lineMode: 'stepped', fill: 'rgba(232,54,78,0.08)' }, { entity: 'sensor.outside_temperature', color: '#3e95cd' }] }] },
    },

    // ── An entity's attributes: its line ▸ in the entity list, the submenu of its attributes ──
    'attributes': {
        width: 900, height: 900, clock: '2025-12-20T00:00:00Z', states: climate,
        rows: { 'sensor.outside_temperature': numeric(DAY, 600, curve([[0, 3.2], [6, 2.4], [9, 4.5], [14, 9.8], [18, 7], [24, 4.1]]), { noise: 0.15, seed: 83, digits: 2 }) },
        cfg: { type: 'custom:history-explorer-card', header: 'hide', defaultTimeRange: '24h', lineGraphHeight: 170, graphs: [{ type: 'line', entities: [{ entity: 'sensor.outside_temperature' }] }] },
        act: async d => {
            await d.page.click('#b7_0'); await d.page.keyboard.type('living', { delay: 50 }); await d.wait(600);
            await d.page.click('#es_0 a[data-entity="climate.living_room"]'); await d.wait(500);
            const p = await d.E(`(()=>{ const a=el.querySelector('#es_0_series a[data-series="climate.living_room.current_temperature"]'); if(!a) return null; const r=a.getBoundingClientRect(); return {x:r.x+30,y:r.y+r.height/2}; })()`);
            if( p ) { await d.page.mouse.move(p.x, p.y); await d.wait(300); }
            return union(await d.card(), ...(await menuRects(d)));
        },
    },

    // ── Adding an entity: its type menu, the type that fits it in bold ──
    'add-type': {
        width: 900, height: 900, clock: '2025-12-20T00:00:00Z', states: climate,
        rows: { 'sensor.outside_temperature': numeric(DAY, 600, curve([[0, 3.2], [6, 2.4], [9, 4.5], [14, 9.8], [18, 7], [24, 4.1]]), { noise: 0.15, seed: 83, digits: 2 }) },
        cfg: { type: 'custom:history-explorer-card', header: 'hide', defaultTimeRange: '24h', lineGraphHeight: 170, graphs: [{ type: 'line', entities: [{ entity: 'sensor.outside_temperature' }] }] },
        act: async d => {
            await d.page.click('#b7_0'); await d.page.keyboard.type('heat pump', { delay: 50 }); await d.wait(600);
            await d.page.keyboard.press('ArrowDown'); await d.wait(150); await d.page.keyboard.press('Enter'); await d.wait(700);
            return union(await d.card(), ...(await menuRects(d)));
        },
    },

    // ── The card as a panel in the sidebar ──
    'sidebar-panel': {
        width: 900, height: 700, clock: '2025-03-31T16:00:00Z', states: windStates, rows: { 'sensor.wind_gusts': W1.gust.map(([a, v]) => [a, (v * 1.4).toFixed(1)]) },
        cfg: { type: 'custom:history-explorer-card', header: 'hide', defaultTimeRange: '24h', lineGraphHeight: 260, graphs: [{ type: 'line', entities: [{ entity: 'sensor.wind_gusts' }] }] },
        init: `document.addEventListener("DOMContentLoaded",()=>{ document.head.insertAdjacentHTML("beforeend","<style>body{padding:0;display:flex}#sb{width:256px;min-height:100vh;background:#fff;border-right:1px solid #e0e0e0;font-size:14px;font-weight:500;color:#212121}#sb .t{height:56px;display:flex;align-items:center;padding-left:72px;font-size:20px;font-weight:400;border-bottom:1px solid #e0e0e0}#sb .it{height:40px;margin:4px 8px;padding-left:12px;display:flex;align-items:center;gap:32px;border-radius:4px}#sb .it svg{width:24px;height:24px;fill:#727272}#sb .on{background:rgba(3,169,244,.12);color:#03a9f4}#sb .on svg{fill:#03a9f4}#mn{flex:1}#mn .bar{height:56px;background:#03a9f4;color:#fff;font-size:20px;display:flex;align-items:center;padding-left:24px}#mn #host{width:auto!important;margin:16px}</style>"); const sb=document.createElement("div"); sb.id="sb"; sb.innerHTML="<div class=t>Home Assistant</div><div class='it'><svg viewBox='0 0 24 24'><path d='M13,3V9H21V3M13,21H21V11H13M3,21H11V15H3M3,13H11V3H3V13Z'/></svg>Overview</div><div class='it on'><svg viewBox='0 0 24 24'><path d='M16,11.78L20.24,4.45L21.97,5.45L16.74,14.5L10.23,10.75L5.46,19H22V21H2V3H4V17.54L9.5,8L16,11.78Z'/></svg>History explorer</div><div class='it'><svg viewBox='0 0 24 24'><path d='M7,2V13H10V22L17,10H13L17,2H7Z'/></svg>Energy</div><div class='it'><svg viewBox='0 0 24 24'><path d='M15,19L9,16.89V5L15,7.11M20.5,3C20.44,3 20.39,3 20.34,3L15,5.1L9,3L3.36,4.9C3.15,4.97 3,5.15 3,5.38V20.5A0.5,0.5 0 0,0 3.5,21C3.55,21 3.61,21 3.66,20.97L9,18.9L15,21L20.64,19.1C20.85,19 21,18.85 21,18.62V3.5A0.5,0.5 0 0,0 20.5,3Z'/></svg>Map</div><div class='it'><svg viewBox='0 0 24 24'><path d='M7,5H21V7H7V5M7,13V11H21V13H7M4,4.5A1.5,1.5 0 0,1 5.5,6A1.5,1.5 0 0,1 4,7.5A1.5,1.5 0 0,1 2.5,6A1.5,1.5 0 0,1 4,4.5M4,10.5A1.5,1.5 0 0,1 5.5,12A1.5,1.5 0 0,1 4,13.5A1.5,1.5 0 0,1 2.5,12A1.5,1.5 0 0,1 4,10.5M7,19V17H21V19H7M4,16.5A1.5,1.5 0 0,1 5.5,18A1.5,1.5 0 0,1 4,19.5A1.5,1.5 0 0,1 2.5,18A1.5,1.5 0 0,1 4,16.5Z'/></svg>Logbook</div>"; const mn=document.createElement("div"); mn.id="mn"; mn.innerHTML="<div class=bar>History explorer</div>"; const h=document.getElementById("host"); document.body.insertBefore(sb,h); document.body.insertBefore(mn,h); mn.appendChild(h); });`,
        act: async d => ({ x: 0, y: 0, width: 640, height: 330 }),
    },
};

async function render(s) {
    const d = await openDoc(s.cfg, { states: s.states, rows: s.rows, clock: s.clock, width: s.width || 900, height: s.height || 1100, mock: s.mock, dark: s.dark, init: s.init });
    await d.wait(s.settle || 800);
    const r = s.act ? await s.act(d) : await d.card();
    const out = await d.shot(s.name, r, s.pad ?? 6);
    if( d.errors.length ) console.log('  page errors:', d.errors.join(' | '));
    await d.close();
    return out;
}

(async () => {
    for( const [name, s] of Object.entries(scenes) ) {
        if( only && name !== only ) continue;
        try {
            if( s.parts ) {
                for( const p of s.parts ) await render(p);
                // (notes placed from the first part's height: a PNG's height, at bytes 20 to 23)
                const notes = s.notesAt ? s.notesAt({ width: (await compose(name, s.compose(s.parts), { bg: s.bg })).width, hBefore: fs.readFileSync(path.join(OUT, s.parts[0].name + '.png')).readUInt32BE(20) + 12 }) : s.notes || [];
                console.log(name, (await compose(name, s.compose(s.parts), { captionSize: s.captionSize, notes, bg: s.bg })).out);
            }
            else console.log(name, await render({ name, ...s }));
        } catch( e ) { console.log(name, 'FAILED', e.stack.split('\n').slice(0, 3).join(' ')); }
    }
})();
