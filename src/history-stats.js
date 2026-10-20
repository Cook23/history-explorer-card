// How a run of values gives its mean, as Home Assistant compiles its statistics: each value
// weighted by how long it lasted. One rule for every mean the card shows — the points drawn
// and their groups (card-datasets.js), the average over a graph (card-values.js) — so that
// they never differ, from each other or from Home Assistant's statistics.

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
