// The values shown over a graph, as mini-graph-card shows them: each curve's value now, in
// its color (showState), and its minimum, average and maximum over the time window shown
// (showStats) — the minimum and the maximum with their time. Recomputed whenever the
// window or the data change, from the history itself (never from the points drawn, which
// may be decimated). Part of HistoryCardState (added to it in history-explorer-card.js).

import { i18n } from "./languages.js";
import { formatNumber } from "./history-units.js";
const moment = window.HXLocal_moment;


// A curve's minimum, average (weighted by time: each value counts for as long as it lasted)
// and maximum over [t0, t1] (ms) — samples: { t, v } in time order, the first one possibly
// before t0 (the value in effect at t0); null when there's none
export function curveStats(samples, t0, t1)
{
    let min = null, max = null, sum = 0, span = 0;
    for( let i = 0; i < samples.length; i++ ) {
        const a = Math.max(samples[i].t, t0);
        const b = Math.min(i + 1 < samples.length ? samples[i + 1].t : t1, t1);
        if( b < a || ( b === a && samples[i].t < t0 ) ) continue;
        const v = samples[i].v;
        if( min === null || v < min.v ) min = { v, t: a };
        if( max === null || v > max.v ) max = { v, t: a };
        sum += v * ( b - a ); span += b - a;
    }
    return min === null ? null : { min, max, average: { v: span > 0 ? sum / span : min.v } };
}

export class CardValues
{
    // Entity e's showState / showStats: its own, else its graph's, else entityOptions', else
    // the card's — resolved when shown, never copied onto the entity
    _resolveShow(e, key)
    {
        return e?.[key] ?? this.pconfig.graphs[e?.groupId]?.[key] ?? this.getEntityOptions(e?.entity)?.[key] ?? this.pconfig.cardShow[key];
    }

    // The history of entity j of graph g kept for its values (its samples as numbers, in the
    // value shown — see shownScale), from its history rows and its process function
    keepValueSamples(g, j, rows, process)
    {
        g.valueSamples ??= [];
        const _scale = g.chart.data.datasets[j]?.shownScale ?? 1;
        g.valueSamples[j] = ( rows ?? [] ).map(r => ({ t: moment(r.last_changed).valueOf(), v: Number(this.process(r.state, process)) * _scale }))
                                          .filter(p => !isNaN(p.v));
    }

    // The values over graph g, given to its chart to show (Chart.js hecSetValues — it draws
    // them, and says when one is clicked: customEvent, zone 'value'): each curve's value now
    // (showState), then, for each curve showing them, its statistics over the window shown —
    // none: nothing shown. On a narrow card (narrowCard), as mini-graph-card keeps them:
    // layout 'narrow'. A hover on a curve shows the value it is on in its place: format
    showValues(g)
    {
        const _entities = g.entities.map((e, j) => ({ e, j, d: g.chart.data.datasets[j] }))
            .filter(x => x.d && !x.d.hidden);
        const _states = _entities.filter(x => this._resolveShow(x.e, 'showState'));
        const _stats = _entities.map(x => ({ ...x, which: this._resolveShow(x.e, 'showStats') ?? [] })).filter(x => x.which.length);
        if( !_states.length && !_stats.length ) { g.chart.hecSetValues(null); return; }
        const _color = x => typeof x.d.borderColor === 'string' ? x.d.borderColor : this.entityColor(x.e);
        const t0 = moment(this.startTime).valueOf(), t1 = Math.min(moment(this.endTime).valueOf(), Date.now());
        const _time = t => moment(t).format(t1 - t0 <= 86400e3 ? 'LT' : 'L LT');
        const states = _states.map(x => {
            const s = this.stateOf(x.e.entity)?.state;
            return { curve: x.j, key: x.e.entity, color: _color(x), unit: x.d.unit ?? '',
                     text: isNaN(Number(s)) ? String(s ?? '') : this._roundedValue(Number(s) * ( x.d.shownScale ?? 1 ), x.d) };
        });
        const stats = _stats.map(x => {
            const st = curveStats(g.valueSamples?.[x.j] ?? [], t0, t1);
            return st && { curve: x.j, key: x.e.entity, color: _color(x), name: _stats.length > 1 ? ( x.d.name ?? x.e.entity ) : null,
                           cells: x.which.map(k => ({ stat: k, label: i18n('ui.values.' + k), value: this._roundedValue(st[k].v, x.d) + ( x.d.unit ? ' ' + x.d.unit : '' ),
                                                      time: k !== 'average' ? _time(st[k].t) : null })) };
        }).filter(x => x);
        // (a value at a point of curve j — the point hovered: as its value now, with its time;
        // a circular curve's in [0, period), as its labels show it)
        const format = (j, y, x) => {
            const d = g.chart.data.datasets[j], p = d?.circularPeriod;
            const v = p ? ( ( Number(y) % p ) + p ) % p : Number(y);
            return { text: this._roundedValue(v, d), unit: d?.unit ?? '', time: _time(moment(x).valueOf()) };
        };
        g.chart.hecSetValues({ layout: this.narrowCard() ? 'narrow' : 'row', states, stats, format });
    }

    // A value of dataset d as the values over a graph show it: its curve's decimals (see
    // roundingOf)
    _roundedValue(v, d)
    {
        return formatNumber(v, d?.rounding);
    }
}
