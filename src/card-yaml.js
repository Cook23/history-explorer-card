// The card's configuration as YAML (Export ▸ YAML): the card, a graph or a curve as they
// are now — what the YAML and the menus set —, in the card's own syntax (an option's first
// name, never a synonym), the options kept on each device (LOCAL_ONLY_FIELDS: hidden,
// points, tooltips, Y axes locked) left out. Each level writes what it holds that the level
// above it in the export doesn't give it — the first level exported, what differs from the
// option's default:
//   simplified  those only — the card's look (look:) and entityOptions as the YAML says
//               them, the options they give left to them
//   complete    those, plus at each level the options the look sets, and the ones any
//               other member of the same level writes (another graph of the card, another
//               curve of the graph), each with its own; no entityOptions: each curve says
//               what they give it

import { OPTION_DEFAULTS, CURVE_OPTION_KEYS, CARD_ENTITY_KEYS, GRAPH_STORED_KEYS, GRAPH_SCOPE_KEYS, BAR_INTERVALS,
         lookParts } from "./history-options.js";
import { LOCAL_ONLY_FIELDS } from "./card-storage.js";
import { baseTypePure } from "./card-config.js";
import { seriesOf } from "./history-series.js";
import { defaultColors, fillValue } from "./history-default-colors.js";
import { toYaml } from "./history-yaml.js";

const _LOCAL = new Set(LOCAL_ONLY_FIELDS);
// A curve's options (their YAML names), and the entry's field holding each when it isn't
// the same name
const CURVE_KEYS = ['type', 'color', 'fill', 'lineMode', 'interpolation', 'dashMode', 'lineWidth', 'showMinMax', 'netBars', 'scale', 'name',
                    'siConversionFactor', 'unit', 'process', 'circular', 'rounding', 'tapAction', 'showCurrentValues', ...CURVE_OPTION_KEYS].filter(k => !_LOCAL.has(k));
const _FIELD = { lineWidth: 'width' };
// The card's options that are every curve's (CardConfig.applyConfig: the defaults of every
// entity, cardOptions, CARD_ENTITY_KEYS)
const CARD_CURVE_KEYS = new Set(['lineMode', 'interpolation', 'lineWidth', 'dashMode', 'netBars', 'showMinMax', 'rounding', 'tapAction', 'showCurrentValues',
                                 ...CURVE_OPTION_KEYS, ...CARD_ENTITY_KEYS]);
// A graph's options (its type and title aside), its bar interval last
const GRAPH_KEYS = [...GRAPH_STORED_KEYS.filter(k => !_LOCAL.has(k)), 'interval'];
// The card's keys that aren't options of the card: written apart (type, look, entityOptions,
// its graphs) or made into graphs (entities)
const CARD_APART = new Set(['type', 'look', 'graphs', 'entities', 'entityOptions']);
// A fill that fills nothing (fillValue(false))
const NO_FILL = 'rgba(0,0,0,0)';

// (two values the same — whatever their keys' order, a key undefined as one absent)
const _plain = v => !!v && typeof v === 'object' && !Array.isArray(v);
const _canon = v => JSON.stringify(v ?? null, (k, x) => _plain(x) ? Object.fromEntries(Object.keys(x).sort().filter(n => x[n] !== undefined).map(n => [n, x[n]])) : x);
const _same = (a, b) => _canon(a) === _canon(b);
// (what v says that base doesn't — a block (an object) key by key —, undefined: nothing)
function _diff(v, base)
{
    if( _plain(v) && _plain(base) ) {
        const o = {};
        for( const k in v ) { const d = _diff(v[k], base[k]); if( d !== undefined ) o[k] = d; }
        return Object.keys(o).length ? o : undefined;
    }
    return v === undefined || _same(v, base) ? undefined : v;
}
// (a bar interval's YAML name)
const _intervalName = code => BAR_INTERVALS.find(i => i.code === code)?.yaml ?? undefined;

export class CardYaml
{
    // The YAML of what a menu exports — the card (scope.kind 'card'), graph scope.g ('graph'),
    // curve scope.e of graph scope.g ('curve') —, simplified or complete (full)
    yamlText(scope, full)
    {
        const x = this._yamlContext(scope.kind, full);
        const _o = scope.kind === 'card' ? this._cardYaml(x) : scope.kind === 'graph' ? this._graphsYaml(x, [scope.g])[0] : this._curvesYaml(x, scope.g, [scope.e])[0];
        return toYaml(_o);
    }

    // What every level of an export reads: its first level (root), complete or not (full), the
    // card's options as its YAML writes them (raw) and as they are with its look (card), the
    // look's (look)
    _yamlContext(root, full)
    {
        return { root, full, ...lookParts(this._this?.yamlConfig) };
    }

    // The card: its type, its look, its options, entityOptions (simplified), its graphs
    _cardYaml(x)
    {
        const o = { type: x.raw.type ?? 'custom:history-explorer-card' };
        if( x.raw.look !== undefined ) o.look = x.raw.look;
        const _src = x.full ? x.card : x.raw;
        // (the card's own entities — mini-graph-card's syntax —: their graph's title and type
        // its name and show_graph, written as that graph's)
        const _ownGraph = Array.isArray(x.raw.entities) ? ['name', 'showGraph'] : [];
        for( const k in _src ) {
            if( CARD_APART.has(k) || _ownGraph.includes(k) ) continue;
            const _base = x.full ? OPTION_DEFAULTS[k] : _plain(x.look[k]) ? { ...OPTION_DEFAULTS[k], ...x.look[k] } : x.look[k] ?? OPTION_DEFAULTS[k];
            const v = x.full && k in x.look ? _src[k] : _diff(_src[k], _base);
            if( v !== undefined ) o[k] = v;
        }
        if( !x.full && x.raw.entityOptions !== undefined ) o.entityOptions = x.raw.entityOptions;
        o.graphs = this._graphsYaml(x, this.graphsInDisplayOrder());
        return o;
    }

    // The option k of the card a level under it takes: the card's (with its look), else its
    // default
    _cardValue(x, k)
    {
        return x.card[k] ?? OPTION_DEFAULTS[k];
    }

    // Graph g's own option k: its YAML's — for its Y axis and size, else the first of its
    // curves setting it (see addGraph) —; its interval for a bar graph
    _graphOwn(g, k)
    {
        if( k === 'interval' ) return g.type === 'bar' ? g.interval : undefined;
        const v = this.pconfig.graphs[g.groupId]?.[k];
        if( v !== undefined || !GRAPH_SCOPE_KEYS.includes(k) ) return v;
        return g.entities.map(e => e[k]).find(v => v !== undefined && v !== null);
    }

    // Graph g's option k as it is (its own, else the card's), and as the level above it in
    // the export gives it (the card's, the first level exported: its default)
    _graphValue(x, g, k) { return this._graphOwn(g, k) ?? this._cardValue(x, k); }
    _graphBase(x, k)     { return x.root === 'card' ? this._cardValue(x, k) : OPTION_DEFAULTS[k]; }

    // Graphs gs, each — every graph of the card its siblings (complete: the options any of
    // them writes, each graph its own) —: its type, title, options, curves
    _graphsYaml(x, gs)
    {
        const _written = g => GRAPH_KEYS.filter(k => ( k !== 'interval' || g.type === 'bar' ) && !_same(this._graphValue(x, g, k), this._graphBase(x, k)));
        const _keys = x.full ? new Set([...this.graphs.flatMap(_written), ...GRAPH_KEYS.filter(k => k in x.look)]) : null;
        return gs.map(g => {
            const o = { type: this.pconfig.graphs[g.groupId]?.type ?? g.type };
            const _title = this.pconfig.graphs[g.groupId]?.title;
            if( _title !== undefined ) o.title = _title;
            for( const k of GRAPH_KEYS.filter(k => _keys ? _keys.has(k) : _written(g).includes(k)) ) {
                const v = k === 'interval' ? _intervalName(this._graphValue(x, g, k)) : this._graphValue(x, g, k);
                if( v !== undefined ) o[k] = v;
            }
            o.entities = this._curvesYaml(x, g, g.entities);
            return o;
        });
    }

    // Curve e's option k as its entry holds it: its color when it's its own (colorSet — the
    // palette's: none), its fill in the YAML's terms (none: false, its color's: true — the
    // palette's, a bar's: none); its interval only exported alone (else its graph's)
    _curveOwn(x, e, k)
    {
        if( k === 'color' ) return e.colorSet ? e.color : undefined;
        if( k === 'fill' ) {
            const f = e.fill;
            if( e.type === 'bar' || f === undefined || f === null ) return undefined;
            if( f === NO_FILL ) return false;
            if( f === fillValue(true, e.color) ) return true;
            return !e.colorSet && defaultColors.some(c => c.color === e.color && c.fill === f) ? undefined : f;
        }
        if( k === 'interval' ) return x.root === 'curve' && e.type === 'bar' ? e.interval : undefined;
        return e[_FIELD[k] ?? k];
    }

    // Curve e's option k as the levels above it in the export give it: its graph's (its
    // type: the graph's), entityOptions' (simplified, the card exported), the card's — the
    // card's every-curve options, the graph exported first: its own options only —, else its
    // default (a bar's line mode: lines, a line's: curves; a color of its own: no fill; a
    // curve exported alone: the type its entity is shown with)
    _curveBase(x, g, e, k)
    {
        if( x.root !== 'curve' ) {
            const _gy = this.pconfig.graphs[g.groupId] ?? {};
            if( k === 'type' ) return _gy.type ?? g.type;
            const _eo = x.root === 'card' && !x.full ? this.getEntityOptions(e.entity) ?? {} : {};
            const _card = ( x.root === 'card' && CARD_CURVE_KEYS.has(k) ) || ( x.root === 'graph' && GRAPH_KEYS.includes(k) ) ? x.card[k] : undefined;
            const v = _gy[k] ?? _eo[k] ?? _card;
            if( v !== undefined ) return v;
        }
        if( k === 'type' ) return baseTypePure(this._hass, e.entity);
        if( k === 'lineMode' ) return e.type === 'bar' ? 'lines' : 'curves';
        if( k === 'fill' ) return e.colorSet ? false : undefined;
        if( k === 'interval' ) return OPTION_DEFAULTS.interval;
        return OPTION_DEFAULTS[k];
    }

    // Curves es of graph g, each — the graph's curves its siblings (complete: the options any
    // of them writes, each curve its own, else what the levels give it) —: its entity (and
    // attribute), its options
    _curvesYaml(x, g, es)
    {
        const _ks = x.root === 'curve' ? [...CURVE_KEYS, 'interval'] : CURVE_KEYS;
        const _written = e => _ks.filter(k => { const v = this._curveOwn(x, e, k); return v !== undefined && !_same(v, this._curveBase(x, g, e, k)); });
        const _keys = x.full ? new Set([...g.entities.flatMap(_written), ..._ks.filter(k => k in x.look)]) : null;
        // (what curve e shows of option k: its own, its color and fill as drawn, else what the
        // levels give it)
        const _shown = (e, k) => this._curveOwn(x, e, k) ?? ( k === 'color' ? e.color : k === 'fill' && e.type !== 'bar' ? e.fill : undefined ) ?? this._curveBase(x, g, e, k);
        return es.map(e => {
            const { entity, attribute } = seriesOf(e.entity);
            const o = { entity };
            if( attribute ) o.attribute = attribute;
            for( const k of _ks.filter(k => _keys ? _keys.has(k) : _written(e).includes(k)) ) {
                const v = _keys ? _shown(e, k) : this._curveOwn(x, e, k);
                const _v = k === 'interval' ? _intervalName(v) : v;
                if( _v !== undefined ) o[k] = _v;
            }
            return o;
        });
    }
}
