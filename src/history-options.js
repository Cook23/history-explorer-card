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

// The statistics a curve can show over its graph (showStats), in the order they're shown
export const STATS = ['min', 'average', 'max'];

// A dashMode written as CSS writes dashes and gaps ('10,10', '10 5'): as a list
const _dashList = v => ( typeof v === 'string' && /^[\d.\s,]+$/.test(v) && /\d/.test(v) ) ? v.trim().split(/[\s,]+/).map(Number) : v;

// Thresholds written as a list, as mini-graph-card writes them — [{ value, color }, ...]:
// as an object of thresholds ({ value: color }); a stop without a value (or a color alone)
// between two that have one gets its value spaced evenly between them. Any other color
// value as it is (an RGB triplet, [r, g, b], is a color)
function _colorValue(v)
{
    if( !Array.isArray(v) || v.every(x => typeof x === 'number' || ( typeof x === 'string' && x.trim() !== '' && !isNaN(Number(x)) )) ) return v;
    const _stops = v.map(x => typeof x === 'string' ? { color: x } : ( x && typeof x === 'object' ) ? { value: x.value === undefined || x.value === null || x.value === '' ? NaN : Number(x.value), color: x.color } : null)
                    .filter(x => x && x.color !== undefined);
    for( let i = 0; i < _stops.length; i++ ) {
        if( !isNaN(_stops[i].value) ) continue;
        const a = i - 1, b = _stops.findIndex((x, j) => j > i && !isNaN(x.value));
        if( a < 0 || isNaN(_stops[a].value) || b < 0 ) continue;
        _stops[i].value = _stops[a].value + ( _stops[b].value - _stops[a].value ) / ( b - a );
    }
    return Object.fromEntries(_stops.filter(x => !isNaN(x.value)).map(x => [x.value, x.color]));
}

// Each option's value in its one form, whatever the user wrote — the rest of the card only
// ever sees that form
const OPTION_VALUES = {
    lineMode      : normalizeLineMode,
    interpolation : normalizeInterpolation,
    yAxis         : normalizeYAxis,
    dashMode      : _dashList,
    color         : _colorValue,
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
    for( const [name, fn] of Object.entries(OPTION_VALUES) ) if( r[name] !== undefined && r[name] !== null ) r[name] = fn(r[name]);
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
