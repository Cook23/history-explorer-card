
// --------------------------------------------------------------------------------------
// Default colors for line graphs
// --------------------------------------------------------------------------------------

export const defaultColors = [

    { 'color': '#3e95cd', 'fill': 'rgba(151,187,205,0.15)' },
    { 'color': '#95cd3e', 'fill': 'rgba(187,205,151,0.15)' },
    { 'color': '#cd3e3e', 'fill': 'rgba(205,151,151,0.15)' },
    { 'color': '#3ecd95', 'fill': 'rgba(151,205,187,0.15)' },
    { 'color': '#cd953e', 'fill': 'rgba(205,187,151,0.15)' },

    { 'color': '#953ecd', 'fill': 'rgba(187,151,205,0.15)' },
    { 'color': '#175ec8', 'fill': 'rgba(151,187,205,0.15)' },
    { 'color': '#ff7f00', 'fill': 'rgba(225,179,133,0.15)' },
    { 'color': '#cd3e95', 'fill': 'rgba(205,151,187,0.15)' },

];


// --------------------------------------------------------------------------------------
// Predefined state colors for timeline history
// --------------------------------------------------------------------------------------

export const defaultGood = '#66a61e';
const defaultBad = '#b5342d';
const defaultMultiple = '#e5ad23';

const activeRed = '#cd3e3e';
const activeGreen = '#3ecd3e';
const multipleRed = 'rgb(213, 142, 142)';
const multipleGreen = 'rgb(142, 213, 142)';

export const defaultInactiveLight = '#dddddd';
export const defaultInactiveDark = '#383838';

export const stateColors = {

    // Special states — grey reserved for "I don't know"

    'unknown'     : '#888888',
    'unavailable' : '#9e9e9e',
    'idle'         : '#546e7a',

    // Global fallback: on = green (working), off = red (stopped)

    'on'  : '#43a047',
    'off' : '#b5342d',
    'binary_sensor.multiple' : multipleRed,

    // binary_sensor device_class: on = green, off = inactive

    'battery_charging.on'  : activeGreen,
    'battery_charging.off' : '#e57373',
    'battery_charging.multiple' : multipleGreen,
    'plug.on'      : activeGreen,
    'plug.off'     : '#e57373',
    'plug.multiple': multipleGreen,
    'running.on'   : activeGreen,
    'running.off'  : '#e57373',
    'running.multiple' : multipleGreen,
    'update.on'    : '#ff9800',
    'update.off'   : '#43a047',
    'update.multiple' : multipleGreen,

    // binary_sensor device_class: on = good (green), off = bad (red)

    'connectivity.on'  : defaultGood,
    'connectivity.off' : defaultBad,
    'connectivity.multiple' : defaultMultiple,
    'power.on'  : defaultGood,
    'power.off' : defaultBad,
    'power.multiple' : defaultMultiple,
    'presence.on'  : defaultGood,
    'presence.off' : defaultBad,
    'presence.multiple' : defaultMultiple,

    // binary_sensor device_class: on = bad (red), off = good (green)

    'gas.on'    : defaultBad,
    'gas.off'   : defaultGood,
    'gas.multiple' : defaultMultiple,
    'smoke.on'  : defaultBad,
    'smoke.off' : defaultGood,
    'smoke.multiple' : defaultMultiple,
    'problem.on'  : defaultBad,
    'problem.off' : defaultGood,
    'problem.multiple' : defaultMultiple,
    'safety.on'  : defaultBad,
    'safety.off' : defaultGood,
    'safety.multiple' : defaultMultiple,

    // switch domain

    'switch.on'  : '#43a047',
    'switch.off' : '#b5342d',

    // light domain: on = warm orange, off = dark blue

    'light.on'  : '#ff8f00',
    'light.off' : '#1a237e',

    // fan domain

    'fan.on'  : '#29b6f6',
    'fan.off' : '#b5342d',

    // cover domain

    'cover.open'    : '#43a047',
    'cover.opening' : '#c6e16a',
    'cover.closed'  : '#b5342d',
    'cover.closing' : '#ffc107',
    'cover.stopped' : '#f9e81a',

    // climate domain

    'climate.heat'      : '#e8670a',
    'climate.cool'      : '#2196f3',
    'climate.heat_cool' : '#9c27b0',
    'climate.auto'      : '#00897b',
    'climate.dry'       : '#f9a825',
    'climate.fan_only'  : '#29b6f6',
    'climate.off'       : '#b5342d',

    // alarm_control_panel domain: disarmed = green (safe), armed = red (active)

    'alarm_control_panel.disarmed'            : '#43a047',
    'alarm_control_panel.armed_home'          : '#e53935',
    'alarm_control_panel.armed_away'          : '#b71c1c',
    'alarm_control_panel.armed_night'         : '#c62828',
    'alarm_control_panel.armed_vacation'      : '#d32f2f',
    'alarm_control_panel.armed_custom_bypass' : '#880e4f',
    'alarm_control_panel.arming'              : '#e65100',
    'alarm_control_panel.pending'             : '#ff9800',
    'alarm_control_panel.triggered'           : '#d50000',

    // lock domain: unlocked = green (accessible), locked = red (blocked)

    'lock.unlocked'  : '#43a047',
    'lock.unlocking' : '#c6e16a',
    'lock.locked'    : '#e53935',
    'lock.locking'   : '#ffc107',
    'lock.jammed'    : '#d50000',

    // media_player domain

    'media_player.playing'  : '#43a047',
    'media_player.on'       : '#81c784',
    'media_player.paused'   : '#ffc107',
    'media_player.idle'     : '#546e7a',
    'media_player.standby'  : '#78909c',
    'media_player.buffering': '#ffc107',
    'media_player.off'      : '#b5342d',

    // vacuum domain

    'vacuum.cleaning'  : '#43a047',
    'vacuum.returning' : '#1976d2',
    'vacuum.docked'    : '#81c784',
    'vacuum.idle'      : '#546e7a',
    'vacuum.paused'    : '#ffc107',
    'vacuum.error'     : '#d50000',
    'vacuum.off'       : '#b5342d',

    // lawn_mower domain

    'lawn_mower.mowing' : '#43a047',
    'lawn_mower.docked' : '#546e7a',
    'lawn_mower.paused' : '#ffc107',
    'lawn_mower.error'  : '#d50000',

    // water_heater domain

    'water_heater.heat_pump'   : '#2196f3',
    'water_heater.electric'    : '#e8670a',
    'water_heater.gas'         : '#bf360c',
    'water_heater.eco'         : '#43a047',
    'water_heater.high_demand' : '#d50000',
    'water_heater.performance' : '#ff8f00',
    'water_heater.off'         : '#b5342d',

    // sun domain

    'sun.above_horizon' : '#29b6f6',
    'sun.below_horizon' : '#1a237e',

    // person / device_tracker domain

    'person.home'     : '#43a047',
    'person.not_home' : '#b5342d',
    'person.arriving' : '#c6e16a',
    'person.leaving'  : '#ff9800',
    'person.away'     : '#e57373',
    'person.multiple' : '#e5ad23',

    'device_tracker.home'     : '#43a047',
    'device_tracker.not_home' : '#b5342d',
    'device_tracker.away'     : '#e57373',

    // weather domain

    'weather.cloudy'       : '#91acce',
    'weather.fog'          : '#a1887f',
    'weather.rainy'        : '#5285df',
    'weather.partlycloudy' : '#11a3e9',
    'weather.sunny'        : '#e9db11',
    'weather.windy'        : '#80cbc4',
    'weather.snowy'        : '#bbdefb',
    'weather.hail'         : '#7986cb',
    'weather.lightning'    : '#ffd54f',
    'weather.pouring'      : '#1565c0',
    'weather.multiple'     : '#e5ad23',

    // automation domain

    'automation.on'       : activeGreen,
    'automation.multiple' : multipleGreen,

    // custom entries (preserved)

    'input_select.Arret'      : '#e57373',
    'input_select.Eco'        : '#44739e',
    'input_select.Confort - 2': '#53b8ba',
    'input_select.Confort - 1': '#984ea3',
    'input_select.Confort'    : '#e99745',

    'sensor.WCDMA' : '#44739e',
    'sensor.LTE'   : '#984ea3',

};

export const stateColorsDark = {

    'off' : defaultInactiveDark,

    'light.off' : '#283593',

    'input_select.Arret' : '#7f3838',

};

// An RGB triplet written as text: "r, g, b", "[r, g, b]" or "(r, g, b)"
const _RGB_TRIPLET = /^[\[(]?\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*[\])]?$/;

// A color, in any of the forms an option giving one accepts: any CSS color, a CSS variable
// (--name), an RGB triplet ([r, g, b], or as text) → a CSS color. Thresholds (an object)
// are returned as they are: see parseColorValue.
export function parseColor(c)
{
    if( Array.isArray(c) ) return c.length >= 3 ? `rgb(${c[0]},${c[1]},${c[2]})` : undefined;
    if( typeof c !== 'string' ) return c;
    c = c.trim();
    while( c.startsWith('--') ) c = getComputedStyle(document.body).getPropertyValue(c).trim();
    const t = c.match(_RGB_TRIPLET);
    return t ? `rgb(${t[1]},${t[2]},${t[3]})` : c;
}

// Thresholds written as text — JSON, or a dict as a Home Assistant template writes it
// (single quotes, keys left unquoted)
function _parseThresholdText(s)
{
    const _dq = s.replace(/'/g, '"');
    for( const t of [s, _dq, _dq.replace(/([{,]\s*)(-?\d+(?:\.\d+)?)\s*:/g, '$1"$2":')] ) {
        try {
            const o = JSON.parse(t);
            if( o && typeof o === 'object' && !Array.isArray(o) ) return o;
        } catch( e ) { /* next form */ }
    }
    return null;
}

const _isColor = c => typeof c === 'string' && c !== '' && ( typeof CSS === 'undefined' || !CSS.supports || CSS.supports('color', c) );
const _number = v => typeof v === 'number' ? v : ( typeof v === 'string' && v.trim() !== '' ) ? Number(v) : NaN;

// The value of a color option — the same forms whether it's given in the configuration or
// read from an entity's state: a color (see parseColor), or thresholds (an object, or the
// same as text): a number key is a threshold, any other key a state compared as it is
// written, `default` the color of every value they don't cover (`entity`, the entity whose
// value they compare — see colorEntityOf — is left to the caller) → { color }, or
// { thresholds: [[value, color], ...] in increasing order, states: { state: color },
// default }, or null when it's neither
export function parseColorValue(v)
{
    if( typeof v === 'string' && v.trim().startsWith('{') ) v = _parseThresholdText(v.trim());
    if( v && typeof v === 'object' && !Array.isArray(v) ) {
        const spec = { thresholds: [], states: {}, default: undefined };
        for( const [k, c0] of Object.entries(v) ) {
            const c = parseColor(c0);
            if( k === 'entity' || k === 'attribute' || !_isColor(c) ) continue;
            if( k === 'default' ) spec.default = c;
            else if( !isNaN(_number(k)) ) spec.thresholds.push([_number(k), c]);
            else spec.states[k] = c;
        }
        spec.thresholds.sort((a, b) => a[0] - b[0]);
        return spec.thresholds.length || Object.keys(spec.states).length || spec.default ? spec : null;
    }
    const c = parseColor(v);
    return _isColor(c) ? { color: c } : null;
}

// The color a value takes (see parseColorValue): the color itself; a state listed, its
// color; a number, the color of the highest threshold at or below it — below every
// threshold, the lowest one's; any other value, the default color (undefined when none)
export function colorForValue(spec, value)
{
    if( !spec ) return undefined;
    if( spec.color ) return spec.color;
    if( Object.prototype.hasOwnProperty.call(spec.states, String(value)) ) return spec.states[String(value)];
    const n = _number(value);
    if( spec.thresholds.length && !isNaN(n) ) {
        let c = spec.thresholds[0][1];
        for( const [k, col] of spec.thresholds ) if( n >= k ) c = col;
        return c;
    }
    return spec.default;
}
