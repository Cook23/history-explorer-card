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
// getWeatherUnit): the X of the X_unit giving it, or the unit itself ('%')
const WEATHER_UNITS = { temperature: 'temperature', apparent_temperature: 'temperature', dew_point: 'temperature', templow: 'temperature',
                        pressure: 'pressure', wind_speed: 'wind_speed', wind_gust_speed: 'wind_speed',
                        visibility: 'visibility', precipitation: 'precipitation',
                        humidity: { unit: '%' }, cloud_coverage: { unit: '%' }, precipitation_probability: { unit: '%' } };

// The unit entity s gives attribute: for a weather entity, Home Assistant's (WEATHER_UNITS);
// else the X_unit of the longest X its name contains (see _unitsOf); or undefined — a unit
// has none
export function attributeUnitOf(s, attribute)
{
    const _units = _unitsOf(s?.attributes);
    if( attribute.endsWith('_unit') ) return undefined;
    const _w = s?.entity_id?.startsWith('weather.') ? WEATHER_UNITS[attribute] : undefined;
    if( _w ) return _w.unit ?? _units[_w];
    const _x = Object.keys(_units).filter(x => attribute.includes(x)).sort((a, b) => b.length - a.length)[0];
    return _x !== undefined ? _units[_x] : undefined;
}

// The attributes of state s that can be shown as a series: a number, a text or a yes/no —
// not Home Assistant's own, not a list or an object, not a unit (X_unit)
export function seriesAttributes(s)
{
    const _a = s?.attributes ?? {};
    return Object.keys(_a).filter(k => !HA_ATTRIBUTES.includes(k) && ['number', 'string', 'boolean'].includes(typeof _a[k]) && !_isUnit(k, _a[k]));
}

// The state of series id in hass, as Home Assistant gives an entity's — for an attribute:
// its value as the state (see attributeValue), its entity's last update as its last
// change, its entity's name and its own as its name ("salon : Current temperature" — the
// colon tells an attribute from an entity), the unit its value gives, else the one its
// entity gives it (attributeUnitOf: an X_unit — never the entity's own unit),
// a number taken as a measurement (shown as a curve, as an entity measuring
// something); undefined when there's no such entity or attribute
export function seriesState(hass, id)
{
    const { entity, attribute } = seriesOf(id);
    const _s = hass?.states[entity];
    if( !attribute || !_s ) return attribute ? undefined : _s;
    if( !_s.attributes || !( attribute in _s.attributes ) ) return undefined;
    const { value: _v, unit: _valueUnit } = attributeValue(_s.attributes[attribute]);
    const _unit = _valueUnit ?? attributeUnitOf(_s, attribute);
    return { entity_id: id, state: _v === null ? 'unknown' : String(_v), last_changed: _s.last_updated, last_updated: _s.last_updated,
             attributes: { friendly_name: ( _s.attributes.friendly_name ?? entity ) + ' : ' + attributeLabel(attribute),
                           ...( _unit ? { unit_of_measurement: _unit } : {} ),
                           ...( typeof _v === 'number' ? { state_class: 'measurement' } : {} ) } };
}

// The history of attribute series ids, from their entities' history with its attributes
// (Home Assistant's compressed rows: s the state, a the attributes, lu the last update) —
// each series by id, one row per change of its value
export function attributeHistories(ids, entityHistories)
{
    const r = {};
    for( const id of ids ) {
        const { entity, attribute } = seriesOf(id);
        const _rows = [];
        for( const x of entityHistories[entity] ?? [] ) {
            if( !x.a || !( attribute in x.a ) ) continue;
            const _v = attributeValue(x.a[attribute]).value;
            if( _rows.length && _rows[_rows.length - 1].s === _v ) continue;
            _rows.push({ s: _v, lu: x.lu });
        }
        if( _rows.length ) r[id] = _rows;
    }
    return r;
}
