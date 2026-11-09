// --------------------------------------------------------------------------------------
// The automatic Y axis: what is shown first, a steady scale second
//
// 1. What is shown is seen well: every value in the window (and the nearest one on each
//    side, the segments crossing the window's edges) fits in the axis, and fills at least
//    1 - steady of its height — the axis as drawn, its bounds on the ticks.
// 2. A steady scale: the axis kept as long as 1 holds — while a gesture goes on, kept too
//    when what is shown no longer fills it enough, tightened once the gesture ends (but at
//    steady 0) —; when
//    it no longer does, the axis chosen is the one that would still hold 1 after the
//    gestures most likely to come — a pan of one window either way, a zoom out by 2, a zoom
//    in by 2 (left, middle, right) —, the tightest of those that do best.
// steady, from 0 to 1: 0, the axis follows what is shown, whatever the rescales; 1, the
// axis only grows, holding what the gestures foreseen would show; STEADY by default, what
// is shown filling at least half the height.
// Pure: the values come from rangeOf(t0, t1) — { lo, hi } of the values from t0 to t1, the
// nearest outside included, or null for none.
// --------------------------------------------------------------------------------------

export const STEADY = 0.5;

// (the gestures foreseen, as windows from the current one [t0, t1] of length r, each with
// its weight: a pan either way, a zoom out, a zoom in — its three places sharing one)
const GESTURES = [
    { w: 1,     at: (t0, t1, r) => [t0 - r, t1 - r] },
    { w: 1,     at: (t0, t1, r) => [t0 + r, t1 + r] },
    { w: 1,     at: (t0, t1, r) => [t0 - r / 2, t1 + r / 2] },
    { w: 1 / 3, at: (t0, t1, r) => [t0, t0 + r / 2] },
    { w: 1 / 3, at: (t0, t1, r) => [t0 + r / 4, t1 - r / 4] },
    { w: 1 / 3, at: (t0, t1, r) => [t0 + r / 2, t1] },
];

// (how far the pans are foreseen: HORIZON windows either way — the values the card looks
// for around the window, see card-history.js yScaleSlots —, FRAMES frames a window)
const FRAMES = 12;
export const HORIZON = 4;

// (Chart.js' nice number: helpers.niceNum)
function niceNum(range, round)
{
    const e = Math.floor(Math.log10(range)), f = range / Math.pow(10, e);
    const n = round ? ( f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10 )
                    : ( f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10 );
    return n * Math.pow(10, e);
}

// The axis Chart.js draws for the bounds lo, hi with at most maxTicks ticks: its bounds on
// its ticks (Ticks.generators.linear), taken again until they no longer move — the axis
// given back to Chart.js is drawn as is
export function niceAxis(lo, hi, maxTicks, fixedStep)
{
    for( let i = 0; i < 4; i++ ) {
        const step = fixedStep ?? niceNum(niceNum(hi - lo, false) / ( maxTicks - 1 ), true);
        const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step;
        if( Math.abs(a - lo) < step * 1e-6 && Math.abs(b - hi) < step * 1e-6 ) return { min: a, max: b };
        lo = a; hi = b;
    }
    return { min: lo, max: hi };
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

// Whether the axis holds the range r: r in it (inside), filling at least fill of it
function inside(axis, v)
{
    const eps = ( axis.max - axis.min ) * 1e-9;
    return v.lo >= axis.min - eps && v.hi <= axis.max + eps;
}
export function holds(axis, r, minSpan, fill = 1 - STEADY, zero = true)
{
    if( !r ) return true;
    const v = shownRange(r, minSpan, zero);
    return inside(axis, v) && ( v.hi - v.lo ) >= fill * ( axis.max - axis.min ) * ( 1 - 1e-9 );
}

// Every axis on round ticks that holds the range v with the fill asked, at most wmax high:
// for each tick step, its bounds on that step around v — those Chart.js draws as they are
// (at most twice maxTicks steps: Chart.js would take a wider step)
export function axesOver(v, maxTicks, fill, wmax = Infinity, fixedStep)
{
    const a = v.hi - v.lo, out = [], seen = new Set();
    wmax = Math.max(a, Math.min(wmax, fill > 0 ? a / fill : Infinity));
    const steps = fixedStep ? [fixedStep] : [];
    if( !fixedStep )
        for( let e = Math.floor(Math.log10(a / maxTicks)) - 1; e <= Math.ceil(Math.log10(wmax)); e++ )
            for( const m of [1, 2, 5] ) steps.push(m * Math.pow(10, e));
    for( const step of steps ) {
            if( !fixedStep && ( step * ( maxTicks - 1 ) * 1.0001 < a / 2 || step > wmax * 1.0001 ) ) continue;
            const top = Math.floor(v.lo / step + 1e-9), bot = Math.ceil(v.hi / step - 1e-9);
            const most = Math.min(Math.floor(wmax / step * ( 1 + 1e-9 )), fixedStep ? Infinity : 2 * maxTicks, 1000);
            for( let i = top; bot - i <= most; i-- )
                for( let j = bot; j - i <= most; j++ ) {
                    const c = { min: i * step, max: j * step }, n = niceAxis(c.min, c.max, maxTicks, fixedStep);
                    const key = n.min + ',' + n.max;
                    if( Math.abs(n.min - c.min) < step * 1e-6 && Math.abs(n.max - c.max) < step * 1e-6 && !seen.has(key) ) { seen.add(key); out.push(n); }
                }
    }
    return out;
}

// How long an axis holds through a pan from [t0, t1] by dir: the share of the frames it
// holds, one after the other, over HORIZON windows
function panLife(axis, rangeOf, t0, t1, dir, minSpan, fill, zero)
{
    const r = t1 - t0;
    for( let k = 1; k <= HORIZON * FRAMES; k++ ) {
        const d = dir * r * k / FRAMES;
        if( !holds(axis, rangeOf(t0 + d, t1 + d), minSpan, fill, zero) ) return ( k - 1 ) / ( HORIZON * FRAMES );
    }
    return 1;
}

// The axis for the window [t0, t1] (prev: the one drawn; moving: a gesture going on): prev
// kept while it holds — while moving, while what is shown stays in it —; else, of the axes
// holding what is shown, the one lasting best through the gestures foreseen — a pan of a
// window either way held to its end counting most, then how far it holds, a zoom out, a
// zoom in —, the tightest of the best. step: the axis' own tick step (ystepSize, a
// state_map's 1), else Chart.js'; zero: a widening never takes the axis across 0 (false: a
// logarithmic axis, its values in decades)
export function chooseYAxis(prev, rangeOf, t0, t1, { maxTicks = 9, minSpan, steady = STEADY, moving = false, step, zero = true } = {})
{
    const view = rangeOf(t0, t1);
    if( !view ) return prev ?? null;
    const fill = 1 - steady, v = shownRange(view, minSpan, zero);
    const _holds = (a, r) => holds(a, r, minSpan, fill, zero);
    // (steady 0: what is shown, at every frame — never kept while moving)
    if( prev && ( _holds(prev, view) || ( moving && steady > 0 && inside(prev, v) ) ) ) return prev;
    const r = t1 - t0, zooms = GESTURES.slice(2).map(g => ({ w: g.w, range: rangeOf(...g.at(t0, t1, r)) }));
    // (no axis higher than all the gestures foreseen would show)
    const far = rangeOf(t0 - HORIZON * r, t1 + HORIZON * r), farV = far ? shownRange(far, minSpan, zero) : v;
    let best = null, bestScore = -1;
    for( const a of axesOver(v, maxTicks, fill, ( farV.hi - farV.lo ) * 1.5, step) ) {
        if( !_holds(a, view) ) continue;
        let score = zooms.reduce((s, z) => s + ( _holds(a, z.range) ? z.w : 0 ), 0);
        for( const dir of [-1, 1] ) { const l = panLife(a, rangeOf, t0, t1, dir, minSpan, fill, zero); score += ( l >= 1 / HORIZON ? 1 : 0 ) + l; }
        if( score > bestScore + 1e-9 || ( Math.abs(score - bestScore) <= 1e-9 && a.max - a.min < best.max - best.min ) ) { best = a; bestScore = score; }
    }
    // (none fills enough — the ticks' rounding, steady 0: the tightest, what is shown first)
    if( !best ) best = niceAxis(v.lo, v.hi, maxTicks, step);
    return best;
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
