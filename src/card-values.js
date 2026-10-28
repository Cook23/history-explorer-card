// The values shown over a graph, as mini-graph-card shows them: each curve's value now, in
// its color (showState), and its minimum, average and maximum over the time window shown
// (showStats) — the minimum and the maximum with their time. Recomputed whenever the
// window or the data change, from the history itself (never from the points drawn, which
// may be decimated). Part of HistoryCardState (added to it in history-explorer-card.js).

import { i18n } from "./languages.js";
import { formatNumber } from "./history-units.js";
import { msOf } from "./history-series.js";
import { timeWeightedMean } from "./history-stats.js";
import { stateLabel } from "./history-options.js";
const moment = window.HXLocal_moment;


// A curve's minimum, average (weighted by time: each value counts for as long as it lasted)
// and maximum over [t0, t1] (ms) — samples: { t, v } in time order, the first one possibly
// before t0 (the value in effect at t0); null when there's none
function curveStats(samples, t0, t1)
{
    // (each value over the part of [t0, t1] it lasted: from the one in effect at t0 on)
    const _spans = samples.map((s, i) => ({ s, a: Math.max(s.t, t0), b: Math.min(i + 1 < samples.length ? samples[i + 1].t : t1, t1) }))
                          .filter(x => !( x.b < x.a || ( x.b === x.a && x.s.t < t0 ) ));
    let min = null, max = null;
    for( const { s, a } of _spans ) {
        const lo = s.vMin ?? s.v, hi = s.vMax ?? s.v;
        if( min === null || lo < min.v ) min = { v: lo, t: a };
        if( max === null || hi > max.v ) max = { v: hi, t: a };
    }
    return min === null ? null : { min, max, average: { v: timeWeightedMean(_spans, x => x.s.v, x => x.a, x => x.b) } };
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
        const _num = x => Number(this.process(x, process)) * _scale;
        // (an hour of statistics: its mean, with its min and max)
        g.valueSamples[j] = ( rows ?? [] ).map(r => r.statistics ? { t: msOf(r.last_changed), v: _num(r.state), vMin: _num(r.statistics.min), vMax: _num(r.statistics.max) }
                                                              : { t: msOf(r.last_changed), v: _num(r.state) })
                                          .filter(p => !isNaN(p.v));
    }

    // The values over graph g, given to its chart to show (Chart.js hecSetValues — it draws
    // them, and says when one is clicked: customEvent, zone 'value'): each curve's value now
    // (showState), then, for each curve showing them, its statistics over the window shown —
    // none: nothing shown. On a narrow card (narrowCard), as mini-graph-card keeps them:
    // layout 'narrow'. A hover on a curve shows the value it is on in its place: format
    showValues(g)
    {
        // (its header follows the values now: its colors — see updateGraphHeader)
        this.updateGraphHeader(g);
        const _entities = g.entities.map((e, j) => ({ e, j, d: g.chart.data.datasets[j] }))
            .filter(x => x.d && ( !x.d.hidden || x.d.notDrawn ));
        // (showStateFor, showStatsFor: first — the graph's or the card's showState, showStats
        // only for its first curve; the others' own (on the entity, in entityOptions) — as
        // mini-graph-card shows its first entity's)
        const o = k => this.graphOption(g.groupId, k);
        const _show = (x, key, forKey) => ( o(forKey) === 'first' && x !== _entities[0] )
            ? x.e?.[key] ?? this.getEntityOptions(x.e?.entity)?.[key] : this._resolveShow(x.e, key);
        const _states = _entities.filter(x => _show(x, 'showState', 'showStateFor'));
        const _stats = _entities.map(x => ({ ...x, which: _show(x, 'showStats', 'showStatsFor') ?? [] })).filter(x => x.which.length);
        if( !_states.length && !_stats.length ) { g.chart.hecSetValues(null); return; }
        // (its curve's color — or with stateAdaptiveColor: false, the text's)
        const _curveColor = x => typeof x.d.borderColor === 'string' ? x.d.borderColor : this.entityColor(x.e);
        const _color = x => this.resolveOption(x.e, 'stateAdaptiveColor') ? _curveColor(x) : 'var(--primary-text-color)';
        const t0 = msOf(this.startTime), t1 = Math.min(msOf(this.endTime), Date.now());
        // (a time as the time axis writes it — the card's clock: hour24, else Home Assistant's)
        const _time = t => moment(t).format(t1 - t0 <= 86400e3 ? this.i18n.styleTimeTicks : this.i18n.styleDateTicks + ', ' + this.i18n.styleTimeTicks);
        const states = _states.map(x => {
            const s = this.stateOf(x.e.entity)?.state;
            // (a state_map's state: its label)
            // (show_indicator: a dot in its curve's color before it)
            const _ind = this.resolveOption(x.e, 'showIndicator') ? _curveColor(x) : false;
            if( x.d.stateMap?.length ) return { curve: x.j, key: x.e.entity, color: _color(x), unit: '', indicator: _ind, text: stateLabel(x.d.stateMap, String(s ?? '')) ?? String(s ?? '') };
            return { curve: x.j, key: x.e.entity, color: _color(x), unit: x.d.unit ?? '', indicator: _ind,
                     text: isNaN(Number(s)) ? String(s ?? '') : this._roundedValue(Number(s) * ( x.d.shownScale ?? 1 ), x.d) };
        });
        const stats = _stats.map(x => {
            const st = curveStats(g.valueSamples?.[x.j] ?? [], t0, t1);
            return st && { curve: x.j, key: x.e.entity, color: _color(x), name: _stats.length > 1 ? ( x.d.name ?? x.e.entity ) : null,
                           cells: x.which.map(k => ({ stat: k, label: i18n('ui.values.' + k), value: this._roundedValue(st[k].v, x.d) + ( x.d.unit ? ' ' + x.d.unit : '' ),
                                                      time: k !== 'average' ? _time(st[k].t) : null })) };
        }).filter(x => x);
        // (a value at a point of curve j — the point hovered: as its value now, with its time;
        // a circular curve's given by Chart.js in [0, period), as its labels show it)
        const format = (j, y, x) => {
            const d = g.chart.data.datasets[j];
            return { text: this._roundedValue(Number(y), d), unit: d?.unit ?? '', time: _time(msOf(x)) };
        };
        // (the icon with them, alignIcon: state; their place, alignState; their size, fontSize
        // — mini-graph-card's)
        g.chart.hecSetValues({ layout: this.narrowCard() ? 'narrow' : 'row', states, stats, format,
            align: o('alignState'), fontSize: o('fontSize'), icon: this.graphStateIcon(g) });
    }

    // A value of dataset d as the values over a graph show it: its curve's decimals (see
    // roundingOf) — with a state_map, the label of the state drawn there
    _roundedValue(v, d)
    {
        if( d?.stateMap?.length ) return stateLabel(d.stateMap, Math.round(v)) ?? '';
        return formatNumber(v, d?.rounding);
    }
}
