// How a run of values gives its mean, as Home Assistant compiles its statistics: each value
// weighted by how long it lasted. One rule for every mean the card shows — the points drawn
// and their groups (card-datasets.js), the average over a graph (card-values.js) — so that
// they never differ, from each other or from Home Assistant's statistics; an angle's, Home
// Assistant's circular mean (circularMean).

// The mean of items (in time order): value(item, i) weighted by the time from(item, i) to
// to(item, i) — an item lasting no time weighs nothing; when none lasts any time, the plain
// mean of their values. NaN when there's none
export function timeWeightedMean(items, value, from, to)
{
    let sum = 0, span = 0, plain = 0;
    for( let i = 0; i < items.length; i++ ) {
        const v = value(items[i], i), d = Math.max(0, to(items[i], i) - from(items[i], i));
        sum += v * d; span += d; plain += v;
    }
    return span > 0 ? sum / span : items.length ? plain / items.length : NaN;
}

// A circular value's difference d (an angle's), by the shortest way round, for its period P:
// in [−P/2, P/2)
export function wrapDiff(d, P)
{
    return ( ( d + P / 2 ) % P + P ) % P - P / 2;
}

// The mean of items of a circular value of period P (an angle), Home Assistant's circular mean
// — the one for every mean of an angle (CLAUDE.md, Shared logic with lowpass_dt 4; Home
// Assistant's sensor/recorder.py _time_weighted_circular_mean, recorder/statistics.py
// weighted_circular_mean): each value a unit vector at its angle, weighted as timeWeightedMean;
// the mean the direction of their sum (atan2), given in the turn of start (else of the first
// value) → { mean, lo, hi }: lo and hi, the mean plus the lowest and highest difference to it
// by the shortest way round (lowOf, highOf: an item's own lowest and highest values — its
// statistics' min and max —, else its value); null when there's none
export function circularMean(items, value, from, to, P, start, lowOf = value, highOf = value)
{
    if( !items.length ) return null;
    const w = items.map((x, i) => Math.max(0, to(x, i) - from(x, i))), _span = w.reduce((a, b) => a + b, 0);
    const W = _span > 0 ? w : items.map(() => 1), _k = 2 * Math.PI / P;
    let sx = 0, sy = 0;
    for( let i = 0; i < items.length; i++ ) { const a = value(items[i], i) * _k; sx += W[i] * Math.cos(a); sy += W[i] * Math.sin(a); }
    const _ref = Number.isFinite(start) ? start : value(items[0], 0), m = _ref + wrapDiff(Math.atan2(sy, sx) / _k - _ref, P);
    let lo = Infinity, hi = -Infinity;
    for( let i = 0; i < items.length; i++ ) {
        lo = Math.min(lo, wrapDiff(lowOf(items[i], i) - m, P));
        hi = Math.max(hi, wrapDiff(highOf(items[i], i) - m, P));
    }
    return { mean: m, lo: m + lo, hi: m + hi };
}
