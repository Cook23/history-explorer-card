// The card's options: the curve interpolation algorithms, the synonyms of the option
// names, and which options can be set at which level (card, entityOptions, graph, entity).

import { normalizeColor } from "./history-default-colors.js";

// Curve interpolation algorithms (the `interpolation` option, for the curves and smart
// line modes) — the first one is the default; see hecSplineTangents in deps/chart-hec.js,
// and helpers.canvas.lineTo in deps/Chart.js for bspline
export const INTERPOLATIONS = ['monotone', 'steffen', 'makima', 'catmullrom', 'bspline'];

// How each algorithm is named in the Interpolation submenu (names, not translated)
export const INTERPOLATION_LABELS = { monotone: 'Monotone', steffen: 'Steffen', makima: 'Makima', catmullrom: 'Catmull-Rom', bspline: 'B-spline' };

// (each unknown value is reported once: it's resolved again at each redraw)
const _reportedInterpolations = new Set();

// A line mode as the card knows it: the singular aliases accepted — 'line' → 'lines',
// 'curve' → 'curves', 'step' → 'stepped' — and mini-graph-card's `smoothing` (an alias of
// `lineMode`): true → 'curves', false → 'lines' ('smart': curves while the source reports,
// flat dashed plateaus over its silences — see _applySilencePlateaus)
function normalizeLineMode(m)
{
    if( m === 'line'  || m === false ) return 'lines';
    if( m === 'curve' || m === true  ) return 'curves';
    if( m === 'step'  ) return 'stepped';
    return m;
}

// A Y axis as the card knows it: left, right or auto — mini-graph-card's primary and
// secondary are aliases of left and right; undefined for any other value
function normalizeYAxis(v)
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

function normalizeInterpolation(v)
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
    labelsLeft       : ['show_labels'],
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
    pointsPerHour    : ['points_per_hour'],
    aggregateFunc    : ['aggregate_func'],
    groupBy          : ['group_by'],
    yminRight        : ['lower_bound_secondary'],
    ymaxRight        : ['upper_bound_secondary'],
    yrange           : ['min_bound_range'],
    yrangeRight      : ['min_bound_range_secondary'],
    labelsRight      : ['show_labels_secondary'],
    valueFactor      : ['value_factor'],
    stateMap         : ['state_map'],
    lineColor        : ['line_color'],
    colorTransition  : ['color_thresholds_transition'],
    showLine         : ['show_line'],
    showName         : ['show_name'],
    showIcon         : ['show_icon'],
    iconImage        : ['icon_image'],
    alignHeader      : ['align_header'],
    alignIcon        : ['align_icon'],
    alignState       : ['align_state'],
    fontSize         : ['font_size'],
    fontSizeHeader   : ['font_size_header'],
    nameAdaptiveColor: ['show_name_adaptive_color'],
    iconAdaptiveColor: ['show_icon_adaptive_color'],
    showIndicator    : ['show_indicator'],
    showCurrentValues: ['show_legend_state'],
    showGraph        : ['show_graph'],
    barSpacing       : ['bar_spacing'],
    fixedValue       : ['fixed_value'],
};

// How a group of values gives its point (aggregateFunc, see card-datasets.js _aggregate),
// and how values are grouped (groupBy) — mini-graph-card's
export const AGGREGATE_FUNCS = ['avg', 'median', 'min', 'max', 'first', 'last', 'sum', 'delta', 'diff'];
export const GROUP_BY = ['interval', 'hour', 'date'];

// The statistics a curve can show over its graph (showStats), in the order they're shown
export const STATS = ['min', 'average', 'max'];

// A dashMode written as CSS writes dashes and gaps ('10,10', '10 5'): as a list
const _dashList = v => ( typeof v === 'string' && /^[\d.\s,]+$/.test(v) && /\d/.test(v) ) ? v.trim().split(/[\s,]+/).map(Number) : v;

// A Y axis bound: a number — fixed —, or '~' and a number — soft: the bound, unless the
// values go past it ({ soft }); else not set
function _yBound(v)
{
    if( typeof v === 'string' && v.trim().startsWith('~') ) {
        const n = Number(v.trim().slice(1));
        return isFinite(n) && v.trim().length > 1 ? { soft: n } : undefined;
    }
    if( v && typeof v === 'object' && isFinite(v.soft) ) return v;
    const n = Number(v);
    return v !== '' && v !== true && v !== false && isFinite(n) ? n : undefined;
}

// The label of a state of a stateMap (mini-graph-card's state_map — see normalizeOptions):
// a whole number, the one at that place in the list (the value drawn); else the one of that
// state; undefined when there's none
export function stateLabel(map, v)
{
    if( !map?.length || v === undefined || v === null ) return undefined;
    if( typeof v === 'number' ) return map[v]?.label;
    return map.find(m => m.value === String(v))?.label;
}

// An axis' labels: shown (true), hidden (false) or shown on a hover ('hover')
const _labelsShown = v => v === 'hover' ? v : v !== false;

// A number > 0, else not set
const _positive = v => Number(v) > 0 ? Number(v) : undefined;

// Each option's value in its one form, whatever the user wrote — the rest of the card only
// ever sees that form
const OPTION_VALUES = {
    ymin          : _yBound,
    ymax          : _yBound,
    yminRight     : _yBound,
    ymaxRight     : _yBound,
    yrange        : _positive,
    yrangeRight   : _positive,
    // (an axis' labels: false hides them, hover shows them while the pointer is over the
    // graph — see card-charts.js _chartYAxis)
    labelsLeft    : _labelsShown,
    labelsRight   : _labelsShown,
    // (auto: the legend only when the graph has several labels in it)
    legendVisible : v => v === 'auto' ? v : v !== false,
    logarithmic   : v => v === true,
    // (a power of ten: an integer)
    valueFactor   : v => Number.isInteger(Number(v)) ? Number(v) : undefined,
    // (each state, a text or { value, label }: its value's place in the list is the value
    // drawn, its label the one shown — the value itself without one)
    stateMap      : v => Array.isArray(v) ? v.map(x => ( x && typeof x === 'object' ) ? { value: String(x.value), label: String(x.label ?? x.value) }
                                                                                       : { value: String(x), label: String(x) }) : undefined,
    // (a color, or a list of them: the entities' colors, in their order)
    lineColor     : v => ( Array.isArray(v) ? v : [v] ).map(normalizeColor).filter(c => c !== undefined),
    colorTransition : v => v === 'smooth' || v === 'hard' ? v : undefined,
    showLine      : v => v !== false,
    hour24        : v => v === true || v === false ? v : undefined,
    // (a graph's header — its name and its icon — and its values: see card-graphs.js
    // updateGraphHeader, card-values.js showValues)
    showName      : v => v !== false,
    showIcon      : v => v !== false,
    alignHeader   : v => ['default', 'left', 'right', 'center'].includes(v) ? v : undefined,
    alignIcon     : v => ['left', 'right', 'state'].includes(v) ? v : undefined,
    alignState    : v => ['left', 'right', 'center'].includes(v) ? v : undefined,
    fontSize      : _positive,
    fontSizeHeader: _positive,
    nameAdaptiveColor : v => v === true,
    iconAdaptiveColor : v => v === true,
    showIndicator : v => v === true,
    showCurrentValues : v => v !== false,
    // (false: not drawn — its value kept over the graph; a graph none of whose curves is
    // drawn shows no plot: see card-graphs.js _showPlot. mini-graph-card's show.graph: bar
    // or line is the graph's type: drawn)
    showGraph     : v => v !== false,
    // (the room between two bars, in px)
    barSpacing    : v => v !== null && v !== '' && Number(v) >= 0 ? Number(v) : undefined,
    // (its last value drawn flat over the whole window — see card-datasets.js _lineSamples)
    fixedValue    : v => v === true,
    lineMode      : normalizeLineMode,
    interpolation : normalizeInterpolation,
    yAxis         : normalizeYAxis,
    dashMode      : _dashList,
    color         : normalizeColor,
    // (a color, or fade, true — the curve's color, light — or false)
    fill          : v => ( v === true || v === false || v === 'fade' ) ? v : normalizeColor(v),
    // (the decimals: a whole number ≥ 0, else not set)
    rounding      : v => ( v !== null && v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0 ) ? Number(v) : undefined,
    // (an action's name alone stands for it)
    tapAction     : v => typeof v === 'string' ? { action: v } : ( v && typeof v === 'object' ) ? v : undefined,
    // (true: all of them; a name or a list of names — avg for average)
    showStats     : v => {
        if( v === true ) return STATS;
        const _l = ( Array.isArray(v) ? v : typeof v === 'string' ? [v] : [] ).map(x => String(x).toLowerCase());
        return STATS.filter(x => _l.includes(x) || ( x === 'average' && _l.includes('avg') ));
    },
    // (a bar interval's YAML name: its code — see BAR_INTERVALS)
    interval      : v => typeof v === 'number' ? v : BAR_INTERVALS.find(i => i.yaml && i.yaml === v)?.code,
    // (a number and its unit — m, h, d, w, o, y; a number alone is in hours: 24 is 24h)
    defaultTimeRange : v => {
        const t = String(v).replace(/\s+/g, '');
        return /^\d+(\.\d+)?$/.test(t) ? t + 'h' : t;
    },
    // (true: everywhere; states is history)
    showMinMax    : v => v === 'states' ? 'history' : v,
    // (a number of points an hour > 0, else not set)
    pointsPerHour : v => Number(v) > 0 ? Number(v) : undefined,
    aggregateFunc : v => AGGREGATE_FUNCS.find(f => f === String(v).trim().toLowerCase()),
    groupBy       : v => GROUP_BY.find(f => f === String(v).trim().toLowerCase()),
    // (same values as lowpass_dt: none — or absent — auto-detects, false never, a number or
    // numeric text the period, 2pi 2π; anything else, or a period ≤ 0, off with a warning)
    circular      : v => {
        if( v === false ) return false;
        const t = String(v).replace(/\s+/g, '').toLowerCase();
        if( t === 'none' ) return undefined;
        const P = t === '2pi' ? 2 * Math.PI : t === '' ? NaN : Number(t);
        if( isFinite(P) && P > 0 ) return P;
        console.warn(`history-explorer-card: invalid 'circular' value ${JSON.stringify(v)} — expected false, none, a period > 0 or '2pi'. Circular display disabled.`);
        return false;
    },
};

// Options as the user wrote them, in their one form: every name as the card's own (its
// synonyms resolved, mini-graph-card's `show:` read as its options — show: { points: true }
// is show_points: true, an option set directly winning), every value too (OPTION_VALUES).
// Called where the options are read (card-config.js), never later: the rest of the card
// only knows these forms
export function normalizeOptions(o)
{
    if( !o || typeof o !== 'object' || Array.isArray(o) ) return o;
    const r = { ...o };
    if( r.show && typeof r.show === 'object' && !Array.isArray(r.show) )
        for( const [k, v] of Object.entries(r.show) ) if( r['show_' + k] === undefined ) r['show_' + k] = v;
    for( const [name, aliases] of Object.entries(OPTION_SYNONYMS) ) {
        if( r[name] !== undefined ) continue;
        for( const a of aliases ) if( r[a] !== undefined ) { r[name] = r[a]; break; }
    }
    // (grouped by day or by hour: a bar graph's interval too, unless set — as mini-graph-card
    // draws its bars)
    if( r.interval === undefined && ( r.groupBy === 'date' || r.groupBy === 'hour' ) ) r.interval = r.groupBy === 'date' ? 'daily' : 'hourly';
    for( const [name, fn] of Object.entries(OPTION_VALUES) ) if( r[name] !== undefined && r[name] !== null ) r[name] = fn(r[name]);
    return r;
}

// Options that can be set at the graph level — under the graph's `options:`, or directly
// on the graph next to `type:` / `entities:` (`options:` wins when both are set)
const _GRAPH_OPTIONS = ['fill', 'showMinMax', 'showState', 'showStats', 'dashMode', 'lineMode', 'interpolation', 'lineWidth',
    'showPoints', 'netBars', 'interval', 'exclude', 'height', 'stacked', 'ylock',
    'ymin', 'ymax', 'ystepSize', 'showTimeLabels', 'showGrid', 'yLabels', 'yAxis', 'tapAction', 'rounding', 'pointsPerHour', 'aggregateFunc', 'groupBy',
    'yminRight', 'ymaxRight', 'yrange', 'yrangeRight', 'logarithmic', 'labelsLeft', 'labelsRight', 'valueFactor', 'stateMap', 'lineColor', 'colorTransition', 'showLine',
    'showName', 'showIcon', 'icon', 'iconImage', 'alignHeader', 'alignIcon', 'alignState', 'fontSize', 'fontSizeHeader', 'nameAdaptiveColor', 'iconAdaptiveColor',
    'showIndicator', 'showCurrentValues', 'showGraph', 'barSpacing'];

// A graph's header and values options (see card-graphs.js updateGraphHeader): the graph's,
// else the card's
export const GRAPH_HEADER_KEYS = ['showName', 'showIcon', 'icon', 'iconImage', 'alignHeader', 'alignIcon', 'alignState', 'fontSize', 'fontSizeHeader',
    'nameAdaptiveColor', 'iconAdaptiveColor'];
export const GRAPH_OPTION_KEYS = [..._GRAPH_OPTIONS, ..._GRAPH_OPTIONS.flatMap(k => OPTION_SYNONYMS[k] ?? []), 'show'];

// Options of the graph an entity is shown in (its Y axis, its size...) that can also be set
// on the card (for every graph), in entityOptions or on an entity (for the graph it's in)
export const GRAPH_SCOPE_KEYS = ['ymin', 'ymax', 'ystepSize', 'ylock', 'stacked', 'height', 'showTimeLabels', 'showGrid', 'yLabels',
    'yminRight', 'ymaxRight', 'yrange', 'yrangeRight', 'logarithmic', 'labelsLeft', 'labelsRight', 'barSpacing'];

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
// the plot, thick smooth lines with a fill fading out, a small graph, colors of thresholds
// blended from one to the next; a header with the name on the left and the icon on the
// right; the legend's names without their values, and only for several curves; the Y
// labels shown on a hover
export const LOOKS = {
    mini: { header: 'hide', uiLayout: { toolbar: 'hide', selector: 'hide' }, showState: true, showStats: ['min', 'max'],
            showTimeLabels: false, showGrid: false, yLabels: 'inside', fill: 'fade', height: 150, lineWidth: 5, lineMode: 'curves',
            interpolation: 'bspline', colorTransition: 'smooth', showName: true, showIcon: true, alignHeader: 'default', fontSizeHeader: 14,
            showCurrentValues: false, legendVisible: 'auto', labelsLeft: 'hover', labelsRight: 'hover' },
};

// The card's configuration, in its one form (see normalizeOptions), with its
// look's options under its own
export function withLook(config)
{
    const c = normalizeOptions(config);
    if( c?.look === undefined ) return c;
    const _look = LOOKS[c.look];
    if( !_look ) {
        console.warn(`history-explorer-card: unknown look '${c.look}' — expected one of ${Object.keys(LOOKS).join(', ')}`);
        return c;
    }
    return { ..._look, ...c, uiLayout: { ..._look.uiLayout, ...c.uiLayout } };
}
