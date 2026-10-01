// Units: SI prefixes (m, k, M) — which units can share one Y axis, and the prefix a
// graph's axis is shown in.

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

export function chooseSIUnit(unitsWithMax) {
    // unitsWithMax: array of { unit, maxVal }
    // Choose the SI unit that minimises the number of digits for the max value
    // Returns { unit, factor } where factor converts from each entity's unit to the chosen unit
    if( !unitsWithMax.length ) return { unit: '', factor: 1 };
    const base = getSIFactor(unitsWithMax[0].unit).base;
    // Compute global max in base unit
    const globalMaxBase = Math.max(...unitsWithMax.map(u => Math.abs(u.maxVal) * getSIFactor(u.unit).factor));
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
