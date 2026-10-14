// The card's options: the curve interpolation algorithms, the synonyms of the option
// names, and which options can be set at which level (card, entityOptions, graph, entity).

// Curve interpolation algorithms (the `interpolation` option, for the curves and smart
// line modes) — the first one is the default; see hecSplineTangents in deps/chart-hec.js
export const INTERPOLATIONS = ['monotone', 'steffen', 'makima', 'catmullrom'];

// How each algorithm is named in the Interpolation submenu (names, not translated)
export const INTERPOLATION_LABELS = { monotone: 'Monotone', steffen: 'Steffen', makima: 'Makima', catmullrom: 'Catmull-Rom' };

// (each unknown value is reported once: it's resolved again at each redraw)
const _reportedInterpolations = new Set();

// A line mode as the card knows it: the singular aliases accepted — 'line' → 'lines',
// 'curve' → 'curves', 'step' → 'stepped' — and mini-graph-card's `smoothing` (an alias of
// `lineMode`): true → 'curves', false → 'lines' ('smart': curves while the source reports,
// flat dashed plateaus over its silences — see _applySilencePlateaus)
export function normalizeLineMode(m)
{
    if( m === 'line'  || m === false ) return 'lines';
    if( m === 'curve' || m === true  ) return 'curves';
    if( m === 'step'  ) return 'stepped';
    return m;
}

// A Y axis as the card knows it: left, right or auto — mini-graph-card's primary and
// secondary are aliases of left and right; undefined for any other value
export function normalizeYAxis(v)
{
    if( v === 'primary'   ) return 'left';
    if( v === 'secondary' ) return 'right';
    return ( v === 'left' || v === 'right' || v === 'auto' ) ? v : undefined;
}

// Can entities of types a and b share one graph? Lines and bars can (curves drawn over the
// bars); a timeline or an arrowline only ever holds its own type
export function typesCompatible(a, b)
{
    const _xy = t => t === 'line' || t === 'bar';
    return a === b || ( _xy(a) && _xy(b) );
}

export function normalizeInterpolation(v)
{
    if( v === undefined || v === null ) return undefined;
    const k = String(v).toLowerCase().replace(/[-_ ]/g, '');
    const r = k === 'akima' ? 'makima' : k;
    if( INTERPOLATIONS.includes(r) ) return r;
    if( !_reportedInterpolations.has(v) ) {
        _reportedInterpolations.add(v);
        console.warn(`history-explorer-card: unknown interpolation '${v}' — expected one of ${INTERPOLATIONS.join(', ')}`);
    }
    return undefined;
}

// Options spelled differently depending on the level they were first offered at, or in
// mini-graph-card's syntax: each spelling is accepted at every level (card, entityOptions,
// graph, entity) — the first name is the one used internally, the others are its synonyms,
// each meaning the same (an option set under both names: the first name wins)
const OPTION_SYNONYMS = {
    lineWidth        : ['width', 'line_width'],
    showPoints       : ['showSamples', 'show_points'],
    ystepSize        : ['ystepsize'],
    showState        : ['show_state'],
    legendVisible    : ['show_legend'],
    labelsVisible    : ['show_labels'],
    defaultTimeRange : ['hours_to_show'],
    rounding         : ['decimals'],
    lineMode         : ['smoothing'],
    dashMode         : ['line_style'],
    yAxis            : ['y_axis'],
    ymin             : ['lower_bound'],
    ymax             : ['upper_bound'],
    fill             : ['show_fill'],
    color            : ['color_thresholds'],
    type             : ['graph'],
    tapAction        : ['tap_action'],
};

// Options with their synonyms resolved; mini-graph-card's `show:` read as its own options
// (show: { points: true } is show_points: true — an option set directly wins)
export function normalizeOptionSynonyms(o)
{
    if( !o || typeof o !== 'object' || Array.isArray(o) ) return o;
    const r = { ...o };
    if( r.show && typeof r.show === 'object' && !Array.isArray(r.show) )
        for( const [k, v] of Object.entries(r.show) ) if( r['show_' + k] === undefined ) r['show_' + k] = v;
    for( const [name, aliases] of Object.entries(OPTION_SYNONYMS) ) {
        if( r[name] !== undefined ) continue;
        for( const a of aliases ) if( r[a] !== undefined ) { r[name] = r[a]; break; }
    }
    return r;
}

// Options that can be set at the graph level — under the graph's `options:`, or directly
// on the graph next to `type:` / `entities:` (`options:` wins when both are set)
const _GRAPH_OPTIONS = ['fill', 'showMinMax', 'showState', 'showStats', 'dashMode', 'lineMode', 'interpolation', 'lineWidth',
    'showPoints', 'decimation', 'netBars', 'interval', 'exclude', 'height', 'stacked', 'ylock',
    'ymin', 'ymax', 'ystepSize', 'showTimeLabels', 'showGrid', 'yLabels', 'yAxis', 'tapAction', 'rounding'];
export const GRAPH_OPTION_KEYS = [..._GRAPH_OPTIONS, ..._GRAPH_OPTIONS.flatMap(k => OPTION_SYNONYMS[k] ?? []), 'show'];

// Options of the graph an entity is shown in (its Y axis, its size...) that can also be set
// on the card (for every graph), in entityOptions or on an entity (for the graph it's in)
export const GRAPH_SCOPE_KEYS = ['ymin', 'ymax', 'ystepSize', 'ylock', 'stacked', 'height', 'showTimeLabels', 'showGrid', 'yLabels'];

// A bar graph's intervals, in the order its selector shows them: the code saved for each
// (weekly, added last, gets the next one: the codes saved before keep their meaning), its
// YAML name, its label (ui.interval.*), and its length and start (moment) — raw: no
// interval, the bar entities drawn as curves
export const BAR_INTERVALS = [
    { code: 0, yaml: '10m',     label: '_10m',    length: [10, 'minute'], start: 'hour' },
    { code: 1, yaml: 'hourly',  label: 'hourly',  length: [1, 'hour'],    start: 'hour' },
    { code: 2, yaml: 'daily',   label: 'daily',   length: [1, 'day'],     start: 'day' },
    { code: 5, yaml: 'weekly',  label: 'weekly',  length: [1, 'week'],    start: 'isoWeek' },
    { code: 3, yaml: 'monthly', label: 'monthly', length: [1, 'month'],   start: 'month' },
    { code: 4, yaml: null,      label: 'rawline' },
];
export const RAW_INTERVAL = 4;
export const barInterval = code => BAR_INTERVALS.find(i => i.code == code);

// Looks: a set of default options given at once with `look:` — the card's own options
// still win, whatever their spelling (a look only gives defaults: it never changes what an
// option means).
// mini: mini-graph-card's look — no header, toolbar nor selector, each curve's value now
// and its minimum and maximum over the window, no time labels nor grid, the Y labels inside
// the plot, thick smooth lines with a fill fading out, a small graph
export const LOOKS = {
    mini: { header: 'hide', uiLayout: { toolbar: 'hide', selector: 'hide' }, showState: true, showStats: ['min', 'max'],
            showTimeLabels: false, showGrid: false, yLabels: 'inside', fill: 'fade', height: 150, lineWidth: 5, lineMode: 'curves' },
};

// The card's configuration, its synonyms resolved (see normalizeOptionSynonyms), with its
// look's options under its own
export function withLook(config)
{
    const c = normalizeOptionSynonyms(config);
    if( c?.look === undefined ) return c;
    const _look = LOOKS[c.look];
    if( !_look ) {
        console.warn(`history-explorer-card: unknown look '${c.look}' — expected one of ${Object.keys(LOOKS).join(', ')}`);
        return c;
    }
    return { ..._look, ...c, uiLayout: { ..._look.uiLayout, ...c.uiLayout } };
}
