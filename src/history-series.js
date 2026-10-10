// The series a curve shows: an entity's state, or one of its attributes. A series is named
// by its id: the entity id for its state; for an attribute, the entity id, a dot and the
// attribute (an entity id has a single dot: what follows a second one is an attribute).

// Home Assistant's own attributes: what describes an entity, never a value to show
export const HA_ATTRIBUTES = [
    "entity_id",
    "assumed_state",
    "attribution",
    "custom_ui_more_info",
    "custom_ui_state_card",
    "device_class",
    "editable",
    "emulated_hue_name",
    "emulated_hue",
    "entity_picture",
    "friendly_name",
    "haaska_hidden",
    "haaska_name",
    "icon",
    "initial_state",
    "last_reset",
    "restored",
    "state_class",
    "supported_features",
    "unit_of_measurement",
    "access_token",
    "token",
];

// Series id → { entity, attribute (null for the entity's state) }
export function seriesOf(id)
{
    const _p = id.split('.');
    return _p.length > 2 ? { entity: _p[0] + '.' + _p[1], attribute: _p.slice(2).join('.') } : { entity: id, attribute: null };
}

// The id of attribute of entity (its state with none)
export function seriesId(entity, attribute)
{
    return attribute ? entity + '.' + attribute : entity;
}

// An attribute as people read it: current_temperature → Current temperature
export function attributeLabel(attribute)
{
    const _s = attribute.replace(/_/g, ' ');
    return _s.charAt(0).toUpperCase() + _s.slice(1);
}

// An attribute's value as a series': a number followed by a text that isn't one (12.5 °C,
// 80 %, 3 days — not a time, a date or a range) is that number, in that unit
const _NUMBER_UNIT = /^\s*([-+]?\d+(?:[.,]\d+)?(?:[eE][-+]?\d+)?)\s*([^\d\s:.,\/+-].*?)\s*$/;
export function attributeValue(v)
{
    const _m = typeof v === 'string' ? _NUMBER_UNIT.exec(v) : null;
    return _m ? { value: Number(_m[1].replace(',', '.')), unit: _m[2] } : { value: v, unit: undefined };
}

// The units an entity gives its attributes, as weather entities do: an attribute X_unit is
// the unit of every other attribute whose name contains X (temperature_unit: of
// temperature and apparent_temperature) — { X: unit }
function _unitsOf(attributes)
{
    const r = {};
    for( const [k, u] of Object.entries(attributes ?? {}) )
        if( _isUnit(k, u) ) r[k.slice(0, -5)] = u;
    return r;
}

// Is attribute k, of value u, a unit: an X_unit holding a text?
function _isUnit(k, u)
{
    return k.endsWith('_unit') && k.length > 5 && typeof u === 'string' && u !== '';
}

// The units of a weather entity's attributes, as Home Assistant shows them (its frontend's
// getWeatherUnit): the X of the X_unit giving it, or the unit itself ('%') — and the wind
// direction in degrees, which Home Assistant gives without a unit (an angle, see
// isDirectionAttribute)
const WEATHER_UNITS = { temperature: 'temperature', apparent_temperature: 'temperature', dew_point: 'temperature', templow: 'temperature',
                        pressure: 'pressure', wind_speed: 'wind_speed', wind_gust_speed: 'wind_speed',
                        visibility: 'visibility', precipitation: 'precipitation',
                        humidity: { unit: '%' }, cloud_coverage: { unit: '%' }, precipitation_probability: { unit: '%' },
                        wind_bearing: { unit: '°' } };

// Is attribute a direction — an angle that goes round (0 and 360 the same), by its name: a
// bearing, an azimuth, a heading… An attribute in ° that isn't one (the sun's elevation,
// from -90 to 90) is not circular. Same rule as lowpass_dt's attribute sources.
export function isDirectionAttribute(attribute)
{
    return /bearing|direction|azimuth|heading|(^|_)yaw|wind_?dir/.test(attribute);
}

// The units Home Assistant knows an entity's attributes are in, by domain (its frontend's
// DOMAIN_ATTRIBUTES_UNITS) — with the factor turning the value into it when it isn't
// (a light's brightness, 0 to 255; a media player's volume, 0 to 1)
const DOMAIN_UNITS = {
    climate: { humidity: '%', current_humidity: '%', target_humidity_low: '%', target_humidity_high: '%', target_humidity_step: '%', min_humidity: '%', max_humidity: '%' },
    cover: { current_position: '%', current_tilt_position: '%' },
    fan: { percentage: '%' },
    humidifier: { humidity: '%', current_humidity: '%', min_humidity: '%', max_humidity: '%', target_humidity_step: '%' },
    light: { color_temp: 'mired', max_mireds: 'mired', min_mireds: 'mired', color_temp_kelvin: 'K', min_color_temp_kelvin: 'K', max_color_temp_kelvin: 'K',
             brightness: { unit: '%', factor: 100 / 255 } },
    sun: { azimuth: '°', elevation: '°' },
    valve: { current_position: '%' },
    sensor: { battery_level: '%' },
    media_player: { volume_level: { unit: '%', factor: 100 } },
};

// The attributes Home Assistant shows in its temperature unit, outside a weather entity
// (its frontend's TEMPERATURE_ATTRIBUTES)
const TEMPERATURE_ATTRIBUTES = ['temperature', 'current_temperature', 'target_temperature', 'target_temp_temp', 'target_temp_high',
                                'target_temp_low', 'target_temp_step', 'min_temp', 'max_temp'];

// What Home Assistant knows of attribute of entity (in DOMAIN_UNITS): { unit, factor }, or undefined
function _domainUnit(entity, attribute)
{
    const _u = DOMAIN_UNITS[entity.split('.')[0]]?.[attribute];
    return typeof _u === 'string' ? { unit: _u, factor: 1 } : _u;
}

// The unit entity s gives attribute, as Home Assistant shows it: for a weather entity, its
// weather table (WEATHER_UNITS); else its table by domain (DOMAIN_UNITS), or for a
// temperature, the temperature unit of hass (its unit system); else, as some integrations
// give them, the X_unit of the longest X its name contains (see _unitsOf); or undefined —
// a unit has none
function attributeUnitOf(hass, s, attribute)
{
    const _units = _unitsOf(s?.attributes);
    if( attribute.endsWith('_unit') ) return undefined;
    if( s.entity_id.startsWith('weather.') && WEATHER_UNITS[attribute] ) return WEATHER_UNITS[attribute].unit ?? _units[WEATHER_UNITS[attribute]];
    if( !s.entity_id.startsWith('weather.') ) {
        const _d = _domainUnit(s.entity_id, attribute);
        if( _d ) return _d.unit;
        if( TEMPERATURE_ATTRIBUTES.includes(attribute) && hass?.config?.unit_system?.temperature ) return hass.config.unit_system.temperature;
    }
    const _x = Object.keys(_units).filter(x => attribute.includes(x)).sort((a, b) => b.length - a.length)[0];
    return _x !== undefined ? _units[_x] : undefined;
}

// The value of attribute of entity as a series' (see attributeValue), in the unit Home
// Assistant shows it in (a light's brightness in %: see DOMAIN_UNITS)
function _seriesValue(entity, attribute, v)
{
    const _r = attributeValue(v);
    const _f = _domainUnit(entity, attribute)?.factor ?? 1;
    return _f !== 1 && typeof _r.value === 'number' ? { ..._r, value: _r.value * _f } : _r;
}

// The attributes of state s that can be shown as a series: a number, a text or a yes/no —
// not Home Assistant's own, not a list or an object, not a unit (X_unit)
export function seriesAttributes(s)
{
    const _a = s?.attributes ?? {};
    return Object.keys(_a).filter(k => !HA_ATTRIBUTES.includes(k) && ['number', 'string', 'boolean'].includes(typeof _a[k]) && !_isUnit(k, _a[k]));
}

// The state of series id in hass, as Home Assistant gives an entity's — for an attribute:
// its value as the state (see _seriesValue: in the unit Home Assistant shows it in), its
// entity's last update as its last change, its entity's name and its own as its name
// ("salon : Current temperature" — the colon tells an attribute from an entity), the unit
// its value gives, else the one Home Assistant shows it in (attributeUnitOf — never the
// entity's own unit), a number taken as a measurement (shown as a curve, as an entity
// measuring something); undefined when there's no such entity or attribute
export function seriesState(hass, id)
{
    const { entity, attribute } = seriesOf(id);
    const _s = hass?.states[entity];
    if( !attribute || !_s ) return attribute ? undefined : _s;
    if( !_s.attributes || !( attribute in _s.attributes ) ) return undefined;
    const { value: _v, unit: _valueUnit } = _seriesValue(entity, attribute, _s.attributes[attribute]);
    const _unit = _valueUnit ?? attributeUnitOf(hass, _s, attribute);
    return { entity_id: id, state: _v === null ? 'unknown' : String(_v), last_changed: _s.last_updated, last_updated: _s.last_updated,
             attributes: { friendly_name: ( _s.attributes.friendly_name ?? entity ) + ' : ' + attributeLabel(attribute),
                           ...( _unit ? { unit_of_measurement: _unit } : {} ),
                           ...( typeof _v === 'number' ? { state_class: 'measurement' } : {} ) } };
}

// The history of attribute series ids, from their entities' history with its attributes
// (Home Assistant's compressed rows: s the state, a the attributes, lu the last update) —
// each series by id, one row per change of its value (see _seriesValue)
export function attributeHistories(ids, entityHistories)
{
    const r = {};
    for( const id of ids ) {
        const { entity, attribute } = seriesOf(id);
        const _rows = [];
        for( const x of entityHistories[entity] ?? [] ) {
            if( !x.a || !( attribute in x.a ) ) continue;
            const _v = _seriesValue(entity, attribute, x.a[attribute]).value;
            if( _rows.length && _rows[_rows.length - 1].s === _v ) continue;
            _rows.push({ s: _v, lu: x.lu });
        }
        if( _rows.length ) r[id] = _rows;
    }
    return r;
}
