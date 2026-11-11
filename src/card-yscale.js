// --------------------------------------------------------------------------------------
// The automatic Y axis: what is shown first, a steady scale second — an automatic gain, as
// in audio, with a look ahead
//
// 1. Its envelope: the values shown, and those on each side of the window within a zone
//    (ZONE windows at steady 1), each pulling the envelope towards it the more as it is
//    nearer the window's edge — weight 1 at the edge, 0 at the zone's end —: what is coming
//    with a pan is felt before it shows.
// 2. Attack: the axis grows at once to hold the envelope — what is shown never goes out of
//    it, a value coming makes it grow step by step before it shows; at rest (a zoom, another
//    window), narrowed on its other side too where it would be filled too little.
// 3. Release: the axis is kept while the envelope fills at least 1 - steady of its height;
//    else, while a gesture moves the window, it narrows one step at a time (a round axis
//    about half as high), a step at most each RELEASE window the window's edges travelled;
//    at rest, at once to the tightest axis holding the envelope.
// 4. Its steps: round axes (1, 2, 5 × 10ⁿ ticks), the tightest holding the envelope (niceAxis):
//    a change of scale is a jump that shows, never a slide.
// steady, from 0 to 1: 0, the axis follows what is shown, at every frame; 1, the axis only
// grows, its zone 2 windows on each side; STEADY by default, a zone of a window on each side,
// the envelope filling at least half the height.
// Pure: the values come from rangeOf(t0, t1) — { lo, hi } of the values from t0 to t1, the
// nearest outside included, or null for none.
// --------------------------------------------------------------------------------------

export const STEADY = 0.5;

// (the zone looked at on each side at steady 1, in windows, in BANDS bands — each its weight;
// how far the window's edges travel, in windows, between two release steps)
const ZONE = 2, BANDS = 12, RELEASE = 0.5;

// (how far the cache's values are read around the window, in windows: the zone, and the
// background's sides — see card-history.js)
export const HORIZON = 4;

// (Chart.js' nice number: helpers.niceNum)
function niceNum(range, round)
{
    const e = Math.floor(Math.log10(range)), f = range / Math.pow(10, e);
    const n = round ? ( f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10 )
                    : ( f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10 );
    return n * Math.pow(10, e);
}

// The axis for the values lo to hi with at most maxTicks ticks: the tightest round one — the
// smallest round step (1, 2, 5 × 10ⁿ) its bounds on that step around them take no more than
// maxTicks ticks with — → { min, max, step }, given to Chart.js with its step (ticks.stepSize,
// see card-charts.js _autoYAxis): drawn as is. Never Chart.js' own rule (the span rounded up
// first — 51 made 100 —, then its step: -10 to 41 made -20 to 60), nor a step worked out again
// from bounds so widened
export function niceAxis(lo, hi, maxTicks, fixedStep)
{
    const _r = x => +x.toPrecision(12), _on = s => ({ min: _r(Math.floor(lo / s + 1e-9) * s), max: _r(Math.ceil(hi / s - 1e-9) * s), step: _r(s) });
    if( fixedStep ) return _on(fixedStep);
    const span = Math.max(hi - lo, Math.abs(hi) * 1e-9, 1e-12), n = Math.max(1, maxTicks - 1);
    for( let e = Math.floor(Math.log10(span / n)) - 1; ; e++ ) for( const f of [1, 2, 5] ) {
        const a = _on(f * Math.pow(10, e));
        if( Math.round(( a.max - a.min ) / a.step) <= n ) return a;
    }
}

// The values' range as the axis must show it: at least minSpan high (yrange), else, a
// single value, 2 high (Chart.js: 1 on each side) — widened evenly, but never across 0 when
// the values don't cross it (a rain at 0 shown from 0, not from -1)
export function shownRange(r, minSpan, zero = true)
{
    // (a span lost in the values' rounding — 0.03 and 0.03000000000000001 —: a single value)
    const s = r.hi - r.lo, one = s <= Math.max(Math.abs(r.lo), Math.abs(r.hi)) * 1e-9;
    const need = one ? Math.max(minSpan ?? 0, 2) : ( minSpan ?? 0 );
    if( s >= need ) return r;
    const d = ( need - s ) / 2;
    if( zero && r.lo >= 0 && r.lo - d < 0 ) return { lo: 0, hi: need };
    if( zero && r.hi <= 0 && r.hi + d > 0 ) return { lo: -need, hi: 0 };
    return { lo: r.lo - d, hi: r.hi + d };
}

// Whether the axis holds the range v
function inside(axis, v)
{
    const eps = ( axis.max - axis.min ) * 1e-9;
    return v.lo >= axis.min - eps && v.hi <= axis.max + eps;
}

// The envelope of the window [t0, t1] (see 1): the values shown (view), each band of the
// zone L long on each side pulling it towards its values with the weight of its nearest
// edge's distance
function envelope(rangeOf, t0, t1, view, L)
{
    let lo = view.lo, hi = view.hi;
    for( let k = 0; L > 0 && k < BANDS; k++ ) {
        const w = 1 - k / BANDS, a = k * L / BANDS, b = ( k + 1 ) * L / BANDS;
        for( const r of [rangeOf(t0 - b, t0 - a), rangeOf(t1 + a, t1 + b)] ) {
            if( !r ) continue;
            lo = Math.min(lo, view.lo + ( r.lo - view.lo ) * w);
            hi = Math.max(hi, view.hi + ( r.hi - view.hi ) * w);
        }
    }
    return { lo, hi };
}

// (a step down from a height: the round one below it — 10 → 5 → 2 → 1)
function stepDown(h)
{
    const e = Math.floor(Math.log10(h)), f = h / Math.pow(10, e);
    return ( f > 5 + 1e-9 ? 5 : f > 2 + 1e-9 ? 2 : f > 1 + 1e-9 ? 1 : 0.5 ) * Math.pow(10, e);
}

// The axis for the window [t0, t1] (prev: the one drawn — its bounds, and the window it was
// chosen for —; moving: a gesture going on), see above: { min, max, step, t0, t1 }. step: the axis'
// own tick step (ystepSize, a state_map's 1), else Chart.js'; zero: an axis never taken
// across 0 by a widening (false: a logarithmic axis, its values in decades)
export function chooseYAxis(prev, rangeOf, t0, t1, { maxTicks = 9, minSpan, steady = STEADY, moving = false, step, zero = true } = {})
{
    const view = rangeOf(t0, t1);
    if( !view ) return prev ?? null;
    const r = t1 - t0, env = shownRange(envelope(rangeOf, t0, t1, view, ZONE * steady * r), minSpan, zero);
    const _at = a => ({ min: a.min, max: a.max, step: a.step, t0, t1 }), fit = _at(niceAxis(env.lo, env.hi, maxTicks, step));
    // (steady 0: what is shown, at every frame)
    if( !prev || steady <= 0 ) return fit;
    // (attack: grown at once, on the side it lacks — at rest, the tightest where what it would
    // hold fills it too little: the other side narrowed too, as a release would)
    if( !inside(prev, env) ) {
        const g = niceAxis(Math.min(prev.min, env.lo), Math.max(prev.max, env.hi), maxTicks, step);
        return !moving && env.hi - env.lo < ( 1 - steady ) * ( g.max - g.min ) * ( 1 - 1e-9 ) ? fit : _at(g);
    }
    const h = prev.max - prev.min;
    if( env.hi - env.lo >= ( 1 - steady ) * h * ( 1 - 1e-9 ) ) return prev;
    // (release: at rest, at once; while moving, a step each RELEASE window travelled)
    if( !moving ) return fit;
    if( Math.abs(t0 - ( prev.t0 ?? -Infinity )) + Math.abs(t1 - ( prev.t1 ?? -Infinity )) < RELEASE * r ) return prev;
    const H = stepDown(h);
    if( H <= fit.max - fit.min ) return fit;
    // (as high as the step down: on the side it keeps — the other fixed bound, 0 for a rain —,
    // else around the envelope)
    const lo = prev.min === fit.min ? prev.min : prev.max === fit.max ? prev.max - H
             : Math.max(env.hi - H, Math.min(env.lo, ( env.lo + env.hi - H ) / 2));
    const a = niceAxis(zero && env.lo >= 0 ? Math.max(0, lo) : lo, ( zero && env.lo >= 0 ? Math.max(0, lo) : lo ) + H, maxTicks, step);
    return inside(a, env) && a.max - a.min < h ? _at(a) : fit;
}

// rangeOf over curves: for each, its entries { x, lo, hi } in the order of x — { lo, hi } of
// the values from t0 to t1, with each curve's nearest one on each side (the segments
// crossing the window's edges), null for none; each query a binary search and a lookup
// (sparse tables) per curve, the gestures foreseen asking it many times
export function rangeIndex(curves)
{
    const _one = entries => {
        const n = entries.length, xs = entries.map(e => e.x), mn = [entries.map(e => e.lo)], mx = [entries.map(e => e.hi)];
        for( let k = 1; ( 1 << k ) <= n; k++ ) {
            const h = 1 << ( k - 1 ), L = n - ( 1 << k ) + 1, a = new Array(L), b = new Array(L);
            for( let i = 0; i < L; i++ ) { a[i] = Math.min(mn[k - 1][i], mn[k - 1][i + h]); b[i] = Math.max(mx[k - 1][i], mx[k - 1][i + h]); }
            mn.push(a); mx.push(b);
        }
        // (the first index whose x is at least t; past t — exact: times in ms since 1970 lose
        // any small offset added to them)
        const atLeast = t => { let lo = 0, hi = n; while( lo < hi ) { const m = ( lo + hi ) >> 1; if( xs[m] < t ) lo = m + 1; else hi = m; } return lo; };
        const past = t => { let lo = 0, hi = n; while( lo < hi ) { const m = ( lo + hi ) >> 1; if( xs[m] <= t ) lo = m + 1; else hi = m; } return lo; };
        return (t0, t1) => {
            if( !n ) return null;
            // (the nearest outside: every entry at that time)
            let i = atLeast(t0) - 1, j = past(t1);
            i = i >= 0 ? atLeast(xs[i]) : 0;
            j = j < n ? past(xs[j]) - 1 : n - 1;
            if( j < i ) return null;
            const k = Math.floor(Math.log2(j - i + 1));
            return { lo: Math.min(mn[k][i], mn[k][j - ( 1 << k ) + 1]), hi: Math.max(mx[k][i], mx[k][j - ( 1 << k ) + 1]) };
        };
    };
    const qs = curves.filter(c => c.length).map(_one);
    return (t0, t1) => {
        let lo = Infinity, hi = -Infinity;
        for( const q of qs ) { const r = q(t0, t1); if( r ) { lo = Math.min(lo, r.lo); hi = Math.max(hi, r.hi); } }
        return Number.isFinite(lo) && Number.isFinite(hi) ? { lo, hi } : null;
    };
}
