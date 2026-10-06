// The values shown over a graph, as mini-graph-card shows them: each curve's value now, in
// its color (showState), and its minimum, average and maximum over the time window shown
// (showStats) — the minimum and the maximum with their time. Recomputed whenever the
// window or the data change, from the history itself (never from the points drawn, which
// may be decimated). Part of HistoryCardState (added to it in history-explorer-card.js).

import { i18n } from "./languages.js";
const moment = window.HXLocal_moment;

// The statistics a curve can show, in the order they're shown (left to right)
export const STATS = ['min', 'average', 'max'];

// showStats as a list of STATS: true for all of them, a name or a list of names, else none
export function normalizeStats(v)
{
    if( v === true ) return STATS;
    const _l = ( Array.isArray(v) ? v : typeof v === 'string' ? [v] : [] ).map(s => String(s).toLowerCase());
    return STATS.filter(s => _l.includes(s) || ( s === 'average' && _l.includes('avg') ));
}

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
    _keepValueSamples(g, j, rows, process)
    {
        g.valueSamples ??= [];
        const _scale = g.chart.data.datasets[j]?.shownScale ?? 1;
        g.valueSamples[j] = ( rows ?? [] ).map(r => ({ t: moment(r.last_changed).valueOf(), v: Number(this.process(r.state, process)) * _scale }))
                                          .filter(p => !isNaN(p.v));
    }

    // The values over graph g (its element #hv-<id>, right above its chart): the curves'
    // values now on one row, then, for each curve showing them, its statistics over the
    // window shown — none: no element
    _showValues(g)
    {
        const _entities = g.entities.map((e, j) => ({ e, j, d: g.chart.data.datasets[j] }))
            .filter(x => x.d && !( g.chart.getDatasetMeta(x.j).hidden ?? x.d.hidden ));
        const _states = _entities.filter(x => this._resolveShow(x.e, 'showState'));
        const _stats = _entities.map(x => ({ ...x, which: normalizeStats(this._resolveShow(x.e, 'showStats')) })).filter(x => x.which.length);
        const _box = g.canvas.parentNode;
        let _el = _box.parentNode.querySelector(`#hv-${g.id}`);
        if( !_states.length && !_stats.length ) { _el?.remove(); return; }
        if( !_el ) {
            _el = document.createElement('div');
            _el.id = `hv-${g.id}`;
            _el.style.cssText = 'padding:0 10px 4px 10px;color:var(--primary-text-color)';
            _box.parentNode.insertBefore(_el, _box);
        }
        const _p = 10 ** this.pconfig.roundingPrecision;
        const _num = v => String(Math.round(v * _p) / _p);
        const _color = x => typeof x.d.borderColor === 'string' ? x.d.borderColor : this._currentColor(x.e);
        const _unit = x => x.d.unit ? `<span style="font-size:0.5em;opacity:0.9"> ${x.d.unit}</span>` : '';
        let html = '';
        if( _states.length ) {
            html += `<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px 16px">` + _states.map(x => {
                const s = this.stateOf(x.e.entity)?.state;
                const v = isNaN(Number(s)) ? ( s ?? '' ) : _num(Number(s) * ( x.d.shownScale ?? 1 ));
                return `<div class="hec-state" data-entity="${x.e.entity}" style="color:${_color(x)};font-size:2.2em;line-height:1.2">${v}${_unit(x)}</div>`;
            }).join('') + `</div>`;
        }
        const t0 = moment(this.startTime).valueOf(), t1 = Math.min(moment(this.endTime).valueOf(), Date.now());
        const _time = t => moment(t).format(t1 - t0 <= 86400e3 ? 'LT' : 'L LT');
        for( const x of _stats ) {
            const st = curveStats(g.valueSamples?.[x.j] ?? [], t0, t1);
            if( !st ) continue;
            const _cell = (k, align) => `<div class="hec-stat" data-stat="${k}" style="text-align:${align}">` +
                `<div style="font-weight:600">${i18n('ui.values.' + k)}</div>` +
                `<div>${_num(st[k].v)}${x.d.unit ? ' ' + x.d.unit : ''}</div>` +
                ( k !== 'average' ? `<div style="opacity:0.8">${_time(st[k].t)}</div>` : '' ) + `</div>`;
            const _aligns = x.which.length === 1 ? ['left'] : x.which.length === 2 ? ['left', 'right'] : ['left', 'center', 'right'];
            html += ( _stats.length > 1 ? `<div style="margin-top:6px;color:${_color(x)}">${x.d.name ?? x.e.entity}</div>` : '' ) +
                `<div class="hec-stats" data-entity="${x.e.entity}" style="display:flex;justify-content:space-between;margin-top:4px">` +
                x.which.map((k, i) => _cell(k, _aligns[i])).join('') + `</div>`;
        }
        _el.innerHTML = html;
    }
}
