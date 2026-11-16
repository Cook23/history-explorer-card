// Units and numbers: SI prefixes (m, k, M) — which units can share one Y axis, and the
// prefix a graph's axis is shown in — and a value as the card writes it.

import { maxOf } from "./history-arrays.js";

// A number as the card writes it (legend, tooltip, values over a graph, selector): with
// exactly `rounding` decimals (20.0); rounding not set, with at most 2 (20)
export function formatNumber(v, rounding)
{
    if( rounding !== undefined ) return Number(v).toFixed(rounding);
    return String(Math.round(v * 100) / 100);
}

// Whether a state tells nothing of its entity: unavailable, unknown (Home Assistant's)
export const isMissingState = s => s === 'unavailable' || s === 'unknown';

// The unit of an entity's state (state: Home Assistant's, or an attribute's made as one):
// its unit_of_measurement — "unknown", in any case, none: no unit is named so (an
// integration's way of giving none)
export function unitOfState(state)
{
    const u = state?.attributes?.unit_of_measurement;
    return typeof u === 'string' && u.trim().toLowerCase() === 'unknown' ? undefined : u;
}

// --------------------------------------------------------------------------------------
// SI prefix helpers
// --------------------------------------------------------------------------------------

const SI_PREFIXES = { 'm': 1e-3, '': 1, 'k': 1e3, 'M': 1e6 };

export function getSIFactor(unit) {
    if( !unit ) return { base: unit, factor: 1 };
    for( const [prefix, factor] of Object.entries(SI_PREFIXES) ) {
        if( prefix && unit.startsWith(prefix) && unit.length > prefix.length ) {
            return { base: unit.slice(prefix.length), factor };
        }
    }
    return { base: unit, factor: 1 };
}

export function areSICompatible(unitA, unitB) {
    if( unitA === unitB ) return true;
    if( !unitA || !unitB ) return false;
    return getSIFactor(unitA).base === getSIFactor(unitB).base;
}

// The Y axis of each of a graph's curves by their units — curves, in order: { unit,
// magnitude: the largest value it shows (none known: undefined), side: the one decided before,
// if any } → each one's side, 'left' or 'right'. One group of compatible units
// (areSICompatible) per axis — two groups: the first on the left, the second on the right.
// More: the groups split in two by the size of their values — at the largest ratio between
// two groups next in size —, the small ones on one axis, the large ones on the other, the
// axis with more curves on the left (as many: the first curve's); a group with a side decided
// keeps it, a new group goes on the side whose values are nearest its own
export function yAxisSides(curves)
{
    const _groups = unitGroups(curves.map(c => c.unit)).map(idx => ({ idx, magnitude: maxOf(idx.map(i => Math.abs(curves[i].magnitude) || 0)),
                                                                     side: idx.map(i => curves[i].side).find(s => s) }));
    if( _groups.length <= 2 ) return curves.map((c, i) => _groups.length === 2 && _groups[1].idx.includes(i) ? 'right' : 'left');
    const _size = g => Math.log10(Math.max(g.magnitude, 1e-9));
    if( !_groups.some(g => g.side) ) {
        const _sorted = [..._groups].sort((a, b) => a.magnitude - b.magnitude);
        let _cut = 1;
        for( let k = 2; k < _sorted.length; k++ ) if( _size(_sorted[k]) - _size(_sorted[k - 1]) > _size(_sorted[_cut]) - _size(_sorted[_cut - 1]) ) _cut = k;
        const _small = _sorted.slice(0, _cut), _large = _sorted.slice(_cut), _n = s => s.reduce((a, g) => a + g.idx.length, 0);
        const _left = _n(_small) !== _n(_large) ? ( _n(_small) > _n(_large) ? _small : _large ) : ( _small.some(g => g.idx.includes(0)) ? _small : _large );
        for( const g of _groups ) g.side = _left.includes(g) ? 'left' : 'right';
    } else {
        // (a new group: the side whose groups' sizes, on average, are nearest its own)
        const _mean = side => { const l = _groups.filter(g => g.side === side).map(_size); return l.length ? l.reduce((a, x) => a + x, 0) / l.length : NaN; };
        const _l = _mean('left'), _r = _mean('right');
        for( const g of _groups ) if( !g.side ) g.side = isNaN(_r) || Math.abs(_size(g) - _l) <= Math.abs(_size(g) - _r) ? 'left' : 'right';
    }
    const _side = new Map(_groups.flatMap(g => g.idx.map(i => [i, g.side])));
    return curves.map((c, i) => _side.get(i));
}

// Units, in order, by group of compatible units (areSICompatible): each group, the indices of
// its units, in the order the groups first appear
export function unitGroups(units)
{
    const _groups = [];
    units.forEach((u, i) => {
        const g = _groups.find(g => areSICompatible(units[g[0]], u));
        if( g ) g.push(i); else _groups.push([i]);
    });
    return _groups;
}

// The units of a Y axis' curves, as its label shows them: each once, separated by " / " —
// none: ''
export function unitsLabel(units)
{
    return [...new Set(units.filter(u => u !== undefined && u !== null && u !== ''))].join(' / ');
}

export function chooseSIUnit(unitsWithMax) {
    // unitsWithMax: array of { unit, maxVal }
    // Choose the SI unit that minimises the number of digits for the max value
    // Returns { unit, factor } where factor converts from each entity's unit to the chosen unit
    if( !unitsWithMax.length ) return { unit: '', factor: 1 };
    const base = getSIFactor(unitsWithMax[0].unit).base;
    // Compute global max in base unit
    const globalMaxBase = maxOf(unitsWithMax.map(u => Math.abs(u.maxVal) * getSIFactor(u.unit).factor));
    if( !isFinite(globalMaxBase) || globalMaxBase === 0 ) return { unit: unitsWithMax[0].unit, factor: 1 / getSIFactor(unitsWithMax[0].unit).factor };
    // Pick prefix that gives value between 1 and 999
    let bestPrefix = '', bestFactor = 1;
    for( const [prefix, factor] of Object.entries(SI_PREFIXES) ) {
        const val = globalMaxBase / factor;
        const bestVal = globalMaxBase / bestFactor;
        if( val >= 1 && ( bestVal < 1 || val < bestVal ) ) {
            bestPrefix = prefix;
            bestFactor = factor;
        }
    }
    return { unit: bestPrefix + base, targetFactor: bestFactor };
}
