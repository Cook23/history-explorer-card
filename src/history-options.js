// The card's options: the curve interpolation algorithms, the synonyms of the option
// names, and which options can be set at which level (card, entityOptions, graph, entity).

import { normalizeColor, normalizeFill, normalizeIndirect, isColorSeries } from "./history-default-colors.js";

// Curve interpolation algorithms (the `interpolation` option, for the curves and smart
// line modes), each as the Interpolation submenu names it (not translated) — the first one is
// the default; see hecSplineTangents in deps/chart-hec.js, and helpers.canvas.lineTo in
// deps/Chart.js for bspline
export const INTERPOLATION_LABELS = { monotone: 'Monotone', steffen: 'Steffen', makima: 'Makima', catmullrom: 'Catmull-Rom', bspline: 'B-spline' };
export const INTERPOLATIONS = Object.keys(INTERPOLATION_LABELS);

// The magnifier's modes (what the elastic box zooms — Chart.js zoomBoxAxes): the time (x),
// the Y axes (y), both (xy)
export const ZOOM_BOX_MODES = ['x', 'y', 'xy'];

// A warning about the configuration, in the console, always in this form: the option (or
// what's wrong is in), what it's written with, what's wrong — each said once (a configuration
// is read again and again). The YAML is free (CLAUDE.md): a warning, never a correction
const _warned = new Set();
export function configWarning(option, value, problem)
{
    const t = `history-explorer-card: ${option}: ${JSON.stringify(value)} — ${problem}`;
    if( _warned.has(t) ) return;
    _warned.add(t);
    console.warn(t);
}

// (the key a value of a list is found by: a text whatever its case and spaces, anything else
// itself)
const _listKey = v => typeof v === 'string' ? v.replace(/\s+/g, '').toLowerCase() : v;

// An option whose values form a list (values; a function: read when first used), each with
// its other names maybe (synonyms: { value: [names] }): its parser — v in its one form, its
// case and spaces ignored; else what other(v) makes of it (a value outside the list: a color,
// a number…); else not set (the option's default), with a warning (expected: what it says is
// expected, the values by default)
export function oneOf(option, values, { synonyms = {}, other, expected } = {})
{
    let _map = null;
    return v => {
        if( v === undefined || v === null ) return undefined;
        if( !_map ) {
            _map = new Map();
            for( const x of typeof values === 'function' ? values() : values ) _map.set(_listKey(x), x);
            // (a synonym's value by its name — true, false: a value that isn't a string)
            for( const [x, names] of Object.entries(synonyms) ) for( const n of names ) _map.set(_listKey(n), [..._map.values()].find(y => String(y) === x) ?? _map.get(_listKey(x)));
        }
        const k = _listKey(v);
        if( _map.has(k) ) return _map.get(k);
        const o = other?.(v);
        if( o !== undefined ) return o;
        configWarning(option, v, `unknown value, ignored — expected ${expected ?? [...new Set(_map.values())].map(String).join(', ')}`);
        return undefined;
    };
}
// An option whose value is a list of values of a list (one, or several): each read by
// oneOf(option, values, o), the unknown ones left out
export function listOf(option, values, o)
{
    const _one = oneOf(option, values, o);
    return v => ( Array.isArray(v) ? v : [v] ).map(_one).filter(x => x !== undefined);
}

// The line modes (lineMode), in the order the Display submenu shows them, each with the label
// it gives it (ui.menu.*): smart (curves while the source reports, flat dashed plateaus over
// its silences — see _applySilencePlateaus), curves, lines (straight), stepped; the singular
// aliases accepted, and mini-graph-card's `smoothing` (an alias of lineMode): true curves,
// false lines
export const LINE_MODE_LABELS = { smart: 'type_line_smart', curves: 'type_line_curves', lines: 'type_line_straight', stepped: 'type_line_stepped' };
export const LINE_MODES = Object.keys(LINE_MODE_LABELS);
const normalizeLineMode = oneOf('lineMode', LINE_MODES, { synonyms: { lines: ['line', false], curves: ['curve', true], stepped: ['step'] } });

// A Y axis as the card knows it: left, right or auto — mini-graph-card's primary and
// secondary are aliases of left and right
const normalizeYAxis = oneOf('yAxis', ['left', 'right', 'auto'], { synonyms: { left: ['primary'], right: ['secondary'] } });

// Can entities of types a and b share one graph? Lines and bars can (curves drawn over the
// bars); a timeline or an arrowline only ever holds its own type
export function typesCompatible(a, b)
{
    const _xy = t => t === 'line' || t === 'bar';
    return a === b || ( _xy(a) && _xy(b) );
}

// (an interpolation by its names: akima is makima; Catmull-Rom and B-spline as the
// Interpolation submenu writes them)
const normalizeInterpolation = oneOf('interpolation', INTERPOLATIONS,
    { synonyms: { makima: ['akima'], catmullrom: ['catmull-rom', 'catmull_rom'], bspline: ['b-spline', 'b_spline'] } });

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
    yScaleSteadiness : ['yScaleSteadinessLeft'],
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
    stateAdaptiveColor: ['state_adaptive_color'],
    largeScreenTooltip: ['large_screen_tooltip'],
    smallScreenTooltip: ['small_screen_tooltip'],
    largeChartTooltip: ['large_chart_tooltip'],
    smallChartTooltip: ['small_chart_tooltip'],
    tooltipBehavior  : ['tooltip_behavior'],
    enablePersistence : ['enable_persistence'],
    enableMultidevicePersistence : ['enable_multidevice_persistence'],
};

// The options grouped in a block (tooltip:, timeTicks:, uiColors:): each one's other
// spellings — written flat, or under another name in its block — put in the block, under
// its one name (see normalizeOptions)
const BLOCK_SYNONYMS = {
    tooltip  : { size: ['tooltipSize'], showDuration: ['tooltipShowDuration'], showColorsLine: ['showTooltipColorsLine'],
                 showColorsTimeline: ['showTooltipColorsTimeline'] },
    timeTicks: { density: ['timeTickDensity'] },
};
const BLOCK_KEY_SYNONYMS = { uiColors: { cursorLine: ['cursorline'], gridLines: ['gridlines'] } };
// A curve's tooltip options (tooltip.largeScreen, smallScreen, largeChart, smallChart,
// behavior — at every level): the names the card keeps them under (a curve's
// largeScreenTooltip, smallScreenTooltip, largeChartTooltip, smallChartTooltip: what's saved
// of it)
const CURVE_TOOLTIP_KEYS = { largeScreen: 'largeScreenTooltip', smallScreen: 'smallScreenTooltip', largeChart: 'largeChartTooltip',
                             smallChart: 'smallChartTooltip', behavior: 'tooltipBehavior' };
const _isBlock = v => !!v && typeof v === 'object' && !Array.isArray(v);

// How a group of values gives its point (aggregateFunc, see card-datasets.js _aggregate),
// and how values are grouped (groupBy) — mini-graph-card's
const AGGREGATE_FUNCS = ['avg', 'median', 'min', 'max', 'first', 'last', 'sum', 'delta', 'diff'];
const GROUP_BY = ['interval', 'hour', 'date'];

// The values of the options grouped in a block whose values form a list: the tooltip's sizes,
// the states' texts (as Home Assistant names them, raw, none — stateTextMode too, on the
// card), the cursor line's modes and the graphs showing it (by type, or all), the time
// labels' densities and date formats, Home Assistant's statistics periods (statistics,
// the statistics export's) and the statistics drawn (accepted, without effect: the mean, the
// band its extremes), where the toolbar and the selector are (or which one is sticky), the
// bar interval selector hidden
const STATE_TEXT_MODES = ['auto', 'raw', 'hide'];
const GRAPH_TYPES = ['line', 'bar', 'timeline', 'arrowline'];
// (a density's level: the steps it allows between two time labels, the most first — see
// card-timerange.js computeTickDensity; a place's sides: 1 top, 2 bottom — see
// history-explorer-card.js)
export const TICK_DENSITIES = { low: 4, medium: 3, high: 2, higher: 1, highest: 0 };
const HA_PERIODS = ['5minute', 'hour', 'day', 'week', 'month'];
export const UI_PLACES = { hide: 0, top: 1, bottom: 2, both: 3 };
const BLOCK_VALUES = {
    tooltip   : { size: oneOf('tooltip.size', ['full', 'compact', 'slim', 'auto']), stateTextMode: oneOf('tooltip.stateTextMode', STATE_TEXT_MODES) },
    cursor    : { mode: oneOf('cursor.mode', ['auto', 'all', 'hide']), types: listOf('cursor.types', [...GRAPH_TYPES, 'all']) },
    timeTicks : { density: oneOf('timeTicks.density', Object.keys(TICK_DENSITIES)), densityOverride: oneOf('timeTicks.densityOverride', Object.keys(TICK_DENSITIES)),
                  dateFormat: oneOf('timeTicks.dateFormat', ['normal', 'short']) },
    statistics: { period: oneOf('statistics.period', HA_PERIODS), mode: oneOf('statistics.mode', ['mean', 'min', 'max']) },
    csv       : { statisticsPeriod: oneOf('csv.statisticsPeriod', HA_PERIODS) },
    uiLayout  : { ...Object.fromEntries(['toolbar', 'selector', 'sticky'].map(k => [k, oneOf(`uiLayout.${k}`, Object.keys(UI_PLACES))])),
                  interval: oneOf('uiLayout.interval', ['hide']) },
};

// The statistics a curve can show over its graph (showStats), in the order they're shown
const STATS = ['min', 'average', 'max'];

// The line styles a dashMode names, in the order the Appearance menu shows them: their dashes
// and gaps (px; solid: none)
export const DASH_MODES = { solid: undefined, points: [1, 5], shortlines: [5, 5], longlines: [10, 8], pointline: [15, 3, 3, 3] };

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

// A bound as its YAML writes it: soft ({ soft }), '~' and its value; else as it is
export function boundText(v)
{
    return v && typeof v === 'object' && v.soft !== undefined ? `~${v.soft}` : v;
}

// An arrows' length itself: a number — a part of their whole length, in %, kept within 0 to
// 100 (a warning outside) —, or undefined
function _lengthLeaf(v)
{
    const n = Number(v);
    if( v === '' || v === null || v === true || v === false || !isFinite(n) ) return undefined;
    if( n < 0 || n > 100 ) configWarning('arrowLength', v, 'out of 0 to 100, kept within');
    return Math.min(100, Math.max(0, n));
}

// An arrowline's arrows' length (arrowLength): a length (see _lengthLeaf), a series — an
// entity_id, or one of its attributes after it — whose value gives it, or thresholds on the
// value or on a series' value giving one (as color's: see normalizeIndirect); else not set,
// with a warning
function _arrowLength(v)
{
    const L = isColorSeries(v) ? v.trim() : v && typeof v === 'object' || typeof v === 'string' && v.trim().startsWith('{') ? normalizeIndirect(v, _lengthLeaf) : _lengthLeaf(v);
    if( L === undefined ) configWarning('arrowLength', v, 'unknown value, ignored — expected a number from 0 to 100, an entity or thresholds');
    return L;
}

// A state a stateMap doesn't list, once mapped (see processOf): no value — a gap in the curve
// with showMissingState, else the curve goes over it
export const STATE_NOT_LISTED = '\u0000not listed';

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
const _labelsShown = name => oneOf(name, [true, false, 'hover']);

// A graph's header's alignments (alignHeader): how its content is spread (CSS
// justify-content — see card-graphs.js updateGraphHeader)
export const HEADER_ALIGNS = { default: 'space-between', left: 'flex-start', right: 'flex-end', center: 'center' };

// The tooltip's mode of a curve (see card-charts.js tooltipModeOf): selected, nearest, mixed
// or all
export const TOOLTIP_MODES = ['selected', 'nearest', 'mixed', 'all'];
// showStateFor / showStatsFor: the values over a graph for every curve, or for the first one
const SHOWN_FOR = ['all', 'first'];
const _tooltipMode = name => oneOf(name, TOOLTIP_MODES);

// A number > 0, else not set
const _positive = v => Number(v) > 0 ? Number(v) : undefined;
// A percentage from 0 to 100 — a number, or a string with or without its '%' —, else not set
const _percent = v => { const n = typeof v === 'string' && v.trim() !== '' ? Number(v.trim().replace(/%$/, '')) : typeof v === 'number' ? v : NaN; return n >= 0 && n <= 100 ? n : undefined; };

// (showStats' names: avg is average; a bar interval's YAML names)
const _shownStats = listOf('showStats', STATS, { synonyms: { average: ['avg'] } });
const _intervalName = oneOf('interval', () => BAR_INTERVALS.map(i => i.yaml));
const _dashName = oneOf('dashMode', Object.keys(DASH_MODES), { expected: `${Object.keys(DASH_MODES).join(', ')} or its dashes and gaps` });

// Each option's value in its one form, whatever the user wrote — the rest of the card only
// ever sees that form
const OPTION_VALUES = {
    // (a curve's samples' dots: hover, true, false — a number, a radius in its former form:
    // see card-charts.js pointsDiameterOf —; their diameter, in pixels)
    showPoints    : oneOf('showPoints', () => POINTS_VALUES, { other: v => typeof v !== 'boolean' && Number(v) > 0 ? Number(v) : undefined,
                                                              expected: 'false, hover, true or a diameter > 0' }),
    sizePoints    : v => Number(v) > 0 ? Number(v) : undefined,
    ymin          : _yBound,
    ymax          : _yBound,
    // (an arrowline's arrows' length: a part of their whole length, in % — kept within 0 to
    // 100, with a warning —, or the series whose value gives it, see card-datasets.js
    // arrowLengthOf; the value giving the whole length, as ymax)
    arrowLength   : _arrowLength,
    arrowMax      : _yBound,
    yminRight     : _yBound,
    ymaxRight     : _yBound,
    yrange        : _positive,
    yrangeRight   : _positive,
    // (the automatic Y axis' priority, in %: 0, what is shown first; 100, a steady scale
    // first — see card-yscale.js)
    yScaleSteadiness      : _percent,
    yScaleSteadinessRight : _percent,
    // (an axis' labels: false hides them, hover shows them while the pointer is over the
    // graph — see card-charts.js _chartYAxis)
    labelsLeft    : _labelsShown('labelsLeft'),
    labelsRight   : _labelsShown('labelsRight'),
    // (auto: the legend only when the graph has several labels in it)
    legendVisible : oneOf('legendVisible', [true, false, 'auto']),
    logarithmic   : v => v === true,
    // (a power of ten: an integer)
    valueFactor   : v => Number.isInteger(Number(v)) ? Number(v) : undefined,
    // (each state, a text or { value, label }: its value's place in the list is the value
    // drawn, its label the one shown — the value itself without one)
    stateMap      : v => Array.isArray(v) ? v.map(x => ( x && typeof x === 'object' ) ? { value: String(x.value), label: String(x.label ?? x.value) }
                                                                                       : { value: String(x), label: String(x) }) : undefined,
    // (a color, or a list of them: the entities' colors, in their order)
    lineColor     : v => ( Array.isArray(v) ? v : [v] ).map(normalizeColor).filter(c => c !== undefined),
    colorTransition : oneOf('colorTransition', ['smooth', 'hard']),
    showLine      : v => v !== false,
    hour24        : v => v === true || v === false ? v : undefined,
    defaultMagnifierMode : oneOf('defaultMagnifierMode', ZOOM_BOX_MODES),
    // (a graph's header — its name and its icon — and its values: see card-graphs.js
    // updateGraphHeader, card-values.js showValues)
    showName      : v => v !== false,
    showIcon      : v => v === true,
    alignHeader   : oneOf('alignHeader', Object.keys(HEADER_ALIGNS)),
    alignIcon     : oneOf('alignIcon', ['left', 'right', 'state']),
    alignState    : oneOf('alignState', ['left', 'right', 'center']),
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
    // (the values over a graph: for every curve, or for the first one and those setting their
    // own showState / showStats — mini-graph-card's; in their curve's color, or the text's —
    // see card-values.js showValues)
    showStateFor  : oneOf('showStateFor', SHOWN_FOR),
    showStatsFor  : oneOf('showStatsFor', SHOWN_FOR),
    stateAdaptiveColor : v => v !== false,
    lineMode      : normalizeLineMode,
    interpolation : normalizeInterpolation,
    yAxis         : normalizeYAxis,
    // (a style's name, or its dashes and gaps)
    dashMode      : v => Array.isArray(_dashList(v)) ? _dashList(v) : _dashName(v),
    color         : normalizeColor,
    // (a color, or fade, true — the curve's color, light — or false)
    fill          : oneOf('fill', [false, 'fade', true, 'solid'], { synonyms: { true: ['light'] }, other: normalizeFill, expected: 'false, fade, light (true), solid, a color, thresholds or an entity' }),
    // (the decimals: a whole number ≥ 0, else not set)
    rounding      : v => ( v !== null && v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0 ) ? Number(v) : undefined,
    // (an action's name alone stands for it)
    tapAction     : v => typeof v === 'string' ? { action: v } : ( v && typeof v === 'object' ) ? v : undefined,
    // (true: all of them; a name or a list of names — avg for average —, in STATS' order)
    showStats     : v => v === true ? STATS : v === false ? [] : STATS.filter(x => _shownStats(v).includes(x)),
    // (a bar interval's YAML name: its code — see BAR_INTERVALS)
    interval      : v => typeof v === 'number' ? v : BAR_INTERVALS.find(i => i.yaml === _intervalName(v))?.code,
    // (a number and its unit — m, h, d, w, o, y; a number alone is in hours: 24 is 24h)
    defaultTimeRange : v => {
        const t = String(v).replace(/\s+/g, '');
        return /^\d+(\.\d+)?$/.test(t) ? t + 'h' : t;
    },
    // (true: everywhere; states is history)
    showMinMax    : v => minMaxValue(v),
    // (a number of points an hour > 0, else not set)
    pointsPerHour : v => Number(v) > 0 ? Number(v) : undefined,
    aggregateFunc : oneOf('aggregateFunc', AGGREGATE_FUNCS),
    groupBy       : oneOf('groupBy', GROUP_BY),
    largeScreenTooltip : _tooltipMode('largeScreenTooltip'),
    smallScreenTooltip : _tooltipMode('smallScreenTooltip'),
    largeChartTooltip  : _tooltipMode('largeChartTooltip'),
    smallChartTooltip  : _tooltipMode('smallChartTooltip'),
    // (a tooltip mode, or auto — each screen's own default)
    tooltipBehavior    : oneOf('tooltipBehavior', [...TOOLTIP_MODES, 'auto']),
    stateTextMode : oneOf('stateTextMode', STATE_TEXT_MODES),
    look          : oneOf('look', () => Object.keys(LOOKS)),
    // (same values as lowpass_dt: none — or absent — auto-detects, false never, a number or
    // numeric text the period, 2pi 2π; anything else, or a period ≤ 0, off with a warning)
    circular      : v => {
        if( v === false ) return false;
        const t = String(v).replace(/\s+/g, '').toLowerCase();
        if( t === 'none' ) return undefined;
        const P = t === '2pi' ? 2 * Math.PI : t === '' ? NaN : Number(t);
        if( isFinite(P) && P > 0 ) return P;
        configWarning('circular', v, "expected false, none, a period > 0 or '2pi' — circular display disabled");
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
    // (mini-graph-card's show.extrema and show.average: the statistics shown — min and max,
    // the average)
    if( r.showStats === undefined && ( r.show_extrema !== undefined || r.show_average !== undefined ) ) {
        const _l = [...( r.show_extrema === true ? ['min', 'max'] : [] ), ...( r.show_average === true ? ['average'] : [] )];
        r.showStats = _l.length ? _l : false;
    }
    for( const [name, aliases] of Object.entries(OPTION_SYNONYMS) ) {
        if( r[name] !== undefined ) continue;
        for( const a of aliases ) if( r[a] !== undefined ) { r[name] = r[a]; break; }
    }
    // (the blocks: each option's other spellings under its one name — the block's own
    // winning; a curve's tooltip options under the names the card keeps them)
    for( const [block, keys] of Object.entries(BLOCK_SYNONYMS) )
        for( const [k, flats] of Object.entries(keys) ) {
            if( _isBlock(r[block]) && r[block][k] !== undefined ) continue;
            const f = flats.find(f => r[f] !== undefined);
            if( f ) r[block] = { ...( _isBlock(r[block]) ? r[block] : {} ), [k]: r[f] };
        }
    for( const [block, keys] of Object.entries(BLOCK_KEY_SYNONYMS) )
        for( const [k, others] of Object.entries(keys) ) {
            if( !_isBlock(r[block]) || r[block][k] !== undefined ) continue;
            const a = others.find(a => r[block][a] !== undefined);
            if( a ) r[block] = { ...r[block], [k]: r[block][a] };
        }
    if( _isBlock(r.tooltip) )
        for( const [k, name] of Object.entries(CURVE_TOOLTIP_KEYS) ) if( r.tooltip[k] !== undefined ) r[name] = r.tooltip[k];
    // (grouped by day or by hour: a bar graph's interval too, unless set — as mini-graph-card
    // draws its bars)
    if( r.interval === undefined && ( r.groupBy === 'date' || r.groupBy === 'hour' ) ) r.interval = r.groupBy === 'date' ? 'daily' : 'hourly';
    for( const [name, fn] of Object.entries(OPTION_VALUES) ) if( r[name] !== undefined && r[name] !== null ) r[name] = fn(r[name]);
    for( const [block, keys] of Object.entries(BLOCK_VALUES) ) {
        if( !_isBlock(r[block]) ) continue;
        const b = { ...r[block] };
        for( const [k, fn] of Object.entries(keys) ) if( b[k] !== undefined && b[k] !== null ) b[k] = fn(b[k]);
        r[block] = b;
    }
    // (tooltipBehavior: the default of largeScreenTooltip and smallScreenTooltip — auto, theirs)
    if( r.tooltipBehavior && r.tooltipBehavior !== 'auto' ) { r.largeScreenTooltip ??= r.tooltipBehavior; r.smallScreenTooltip ??= r.tooltipBehavior; }
    return r;
}

// The options' fixed defaults (ARCHITECTURE.md, rule 8): applied by card-config.js, where
// the options are read and resolved — never where they're used. An option whose absence the
// card handles by its own rules has none (lineMode from the type, circular detected, hour24
// from the language, a curve's color from the palette): it stays undefined
export const OPTION_DEFAULTS = {
    // (a curve's — CardConfig.resolveOption)
    largeScreenTooltip: 'mixed', smallScreenTooltip: 'selected', showPoints: 'hover', dashMode: 'solid', netBars: false,
    showLine: true, showGraph: true, fixedValue: false, stateAdaptiveColor: true, showIndicator: false, valueFactor: 0,
    // (a graph's — card-graphs.js _optionsInGraph)
    legendVisible: true, showGrid: true, showTimeLabels: true, stacked: false, logarithmic: false, ylock: false, labelsLeft: true, labelsRight: true, yScaleSteadiness: 50,
    // (a graph's header — CardConfig.graphOption)
    showIcon: false, alignHeader: 'center',
    // (a bar graph's interval — CardConfig.applyConfig, defaultInterval)
    interval: 1,
    // (the card's — CardConfig.applyConfig; the info panel gives some its own, see
    // history-info-panel.js)
    labelAreaWidth: 65, labelsVisible: true, stateColorSeed: 137, stateTextMode: 'auto', interpolation: 'monotone', lineWidth: 2.0,
    lineGraphHeight: 250, barGraphHeight: 150, timelineBarHeight: 24, timelineBarSpacing: 40,
    showUnavailable: false, showMissingState: false, showCurrentValues: true, axisAddMarginMin: false, axisAddMarginMax: false, recordedEntitiesOnly: false,
    defaultTimeRange: '24h', defaultMagnifierMode: 'xy',
    cursor: { mode: 'auto', types: ['timeline'] },
    tooltip: { showColorsLine: true, showColorsTimeline: true, size: 'auto', showDuration: false, showLabel: true },
    timeTicks: { density: 'high' },
    refresh: { automatic: true },
    csv: { separator: ',', timeFormat: 'YYYY-MM-DD HH:mm:ss', statisticsPeriod: 'hour' },
    statistics: { enabled: true, mode: 'mean', period: 'hour' },
    // (the toolbar's and the selector's places — history-explorer-card.js setConfig)
    uiLayout: { toolbar: 'top', selector: 'top', sticky: 'hide' },
    // (an arrowline's full turn, when its entity has no circular period — card-charts.js)
    arrowlinePeriod: 360,
    // (a curve's Y axis side — CardConfig.resolveYAxis —, what a click on its value does —
    // CardConfig.tapActionOf)
    yAxis: 'auto', tapAction: { action: 'more-info' },
};
// (the graph's ones, given to every graph under the card's own)
const _GRAPH_DEFAULT_KEYS = ['showGrid', 'showTimeLabels', 'stacked', 'logarithmic', 'ylock', 'labelsLeft', 'labelsRight', 'yScaleSteadiness'];
export const GRAPH_DEFAULTS = Object.fromEntries(_GRAPH_DEFAULT_KEYS.map(k => [k, OPTION_DEFAULTS[k]]));

// An entity's own options, kept on its entry — set on the entity, else its graph, entityOptions,
// the card (the one chain: CardConfig.resolveOption), but those only an entity sets
// (ENTITY_ONLY_KEYS)
export const ENTITY_OPTION_KEYS = ['color', 'hidden', 'name', 'scale', 'siConversionFactor', 'type', 'unit', 'process', 'circular', 'legendVisible', 'fixedValue'];
// The options of an entity no level above it sets — exceptions agreed by the user (CLAUDE.md,
// STANDARD), each for its reason: `type` on the card is Home Assistant's (the card's type), on a
// graph the graph's own (written apart: `type:` beside its `entities:`); `name` on the card is
// mini-graph-card's (its graph's title), on a graph it would name every curve alike (its `title`
// names the graph); siConversionFactor isn't an option: the card works it out from the units
export const ENTITY_ONLY_KEYS = ['type', 'name', 'siConversionFactor'];
// The options of every curve the card can set (CardConfig.resolveOption: the entity's, else
// its graph's, else entityOptions', else the card's, else OPTION_DEFAULTS)
export const CURVE_OPTION_KEYS = ['valueFactor', 'stateMap', 'colorTransition', 'showLine', 'showIndicator', 'showGraph', 'fixedValue', 'stateAdaptiveColor',
    'largeScreenTooltip', 'smallScreenTooltip', 'largeChartTooltip', 'smallChartTooltip', 'sizePoints',
    // (its aggregation — mini-graph-card's: a property of the curve, it follows it — see resolveAggregation)
    'pointsPerHour', 'aggregateFunc', 'groupBy'];
// A curve's options resolved from its graph when it's drawn, never copied onto it (an
// exception agreed by the user, CLAUDE.md: its axes and what's shown over it)
export const CURVE_GRAPH_KEYS = ['yAxis', 'showState', 'showStats', 'showStateFor', 'showStatsFor'];
// The options copied onto a curve when it's added, from the levels above it (card-graphs.js
// _levelFields — resolveOption): its own from then on, kept when it's moved to another graph
export const CURVE_LEVEL_KEYS = ['dashMode', 'lineWidth', 'lineMode', 'interpolation', 'scale', 'netBars', 'showPoints', 'showMinMax', 'name', 'arrowLength', 'arrowMax',
    'siConversionFactor', 'unit', 'process', 'circular', 'rounding', 'tapAction', 'showCurrentValues', ...CURVE_OPTION_KEYS];
// A curve's options given when it's added besides the levels' (card-graphs.js
// _applyEntityDefaults: the palette's when none is set)
export const CURVE_LOOK_KEYS = ['type', 'color', 'fill'];
// The options that are bounds (a number, or soft — '~' and a number: see _yBound)
export const BOUND_OPTIONS = Object.keys(OPTION_VALUES).filter(k => OPTION_VALUES[k] === _yBound);
// The options a curve reads directly or indirectly — a value, thresholds on the value shown
// or on another series' value, or a series whose state holds the value (see
// history-default-colors.js normalizeIndirect, card-datasets.js optionSeriesOf): its color, its
// fill, an arrowline's arrows' length
export const INDIRECT_OPTIONS = ['color', 'fill', 'arrowLength'];
// A curve's option kept on its entry under another name: YAML name → the entry's field
export const CURVE_FIELD_OF = { lineWidth: 'width' };
// An entity's options the card sets for every entity (its look's too: fill)
export const CARD_ENTITY_KEYS = [...ENTITY_OPTION_KEYS, 'fill'].filter(k => !ENTITY_ONLY_KEYS.includes(k));
// The persistence options' categories (enablePersistence, enableMultidevicePersistence)
export const PERSISTENCE_CATEGORIES = ['range', 'entities', 'order'];

// Options that can be set at the graph level — under the graph's `options:`, or directly
// on the graph next to `type:` / `entities:` (`options:` wins when both are set)
const _GRAPH_OPTIONS = [...ENTITY_OPTION_KEYS.filter(k => !ENTITY_ONLY_KEYS.includes(k)), 'fill', 'arrowLength', 'arrowMax', 'showMinMax', 'showState', 'showStats', 'dashMode', 'lineMode', 'interpolation', 'lineWidth',
    'showPoints', 'sizePoints', 'netBars', 'interval', 'exclude', 'height', 'stacked', 'ylock',
    'ymin', 'ymax', 'ystepSize', 'showTimeLabels', 'showGrid', 'yLabels', 'yAxis', 'tapAction', 'rounding', 'pointsPerHour', 'aggregateFunc', 'groupBy',
    'yminRight', 'ymaxRight', 'yrange', 'yrangeRight', 'yScaleSteadiness', 'yScaleSteadinessRight', 'logarithmic', 'labelsLeft', 'labelsRight', 'valueFactor', 'stateMap', 'lineColor', 'colorTransition', 'showLine',
    'showName', 'showIcon', 'icon', 'iconImage', 'alignHeader', 'alignIcon', 'alignState', 'fontSize', 'fontSizeHeader', 'nameAdaptiveColor', 'iconAdaptiveColor',
    'showIndicator', 'showCurrentValues', 'showGraph', 'barSpacing', 'stateAdaptiveColor', 'showStateFor', 'showStatsFor',
    'largeScreenTooltip', 'smallScreenTooltip', 'largeChartTooltip', 'smallChartTooltip', 'tooltipBehavior'];

// A graph's header and values options (see card-graphs.js updateGraphHeader): the graph's,
// else the card's
export const GRAPH_HEADER_KEYS = ['showName', 'showIcon', 'icon', 'iconImage', 'alignHeader', 'alignIcon', 'alignState', 'fontSize', 'fontSizeHeader',
    'nameAdaptiveColor', 'iconAdaptiveColor', 'showStateFor', 'showStatsFor'];
export const GRAPH_OPTION_KEYS = [..._GRAPH_OPTIONS, ..._GRAPH_OPTIONS.flatMap(k => OPTION_SYNONYMS[k] ?? []), 'show', 'tooltip'];
// The graph options kept on the graph (CardConfig.pconfig.graphs) and on its entities: all
// but those consumed while the graph is read — interval (its entities'), exclude (its
// wildcards') — and tooltipBehavior (folded into the tooltips by normalizeOptions)
export const GRAPH_STORED_KEYS = _GRAPH_OPTIONS.filter(k => !['interval', 'exclude', 'tooltipBehavior'].includes(k));

// Options of the graph an entity is shown in (its Y axis, its size...) that can also be set
// on the card (for every graph), in entityOptions or on an entity (for the graph it's in)
export const GRAPH_SCOPE_KEYS = ['ymin', 'ymax', 'ystepSize', 'ylock', 'stacked', 'height', 'showTimeLabels', 'showGrid', 'yLabels',
    'yminRight', 'ymaxRight', 'yrange', 'yrangeRight', 'yScaleSteadiness', 'yScaleSteadinessRight', 'logarithmic', 'labelsLeft', 'labelsRight', 'barSpacing'];

// The options the card sets for its curves and its graphs — every curve's (CURVE_OPTION_KEYS,
// and those copied onto a curve with them: card-graphs.js _levelFields), every graph's
// (CURVE_GRAPH_KEYS, its header, its scope's but its height), every entity's
// (CARD_ENTITY_KEYS): kept in one place (CardConfig.pconfig.cardOptions), read through one
// chain — the entity's, its graph's, entityOptions', the card's, the default
// (CardConfig.resolveOption)
export const CARD_LEVEL_KEYS = [...new Set([...CURVE_OPTION_KEYS, ...CURVE_GRAPH_KEYS, ...GRAPH_HEADER_KEYS, ...CARD_ENTITY_KEYS,
    ...GRAPH_SCOPE_KEYS.filter(k => k !== 'height'), ...CURVE_LEVEL_KEYS, 'interval', 'lineColor'])].filter(k => !ENTITY_ONLY_KEYS.includes(k));

// A bar graph's intervals, in the order its selector shows them: the code saved for each
// (weekly, added last, gets the next one: the codes saved before keep their meaning), its
// YAML name, its label (ui.interval.*), and its length and start (moment) — raw: no
// interval (no length), the bar entities drawn as curves
export const BAR_INTERVALS = [
    { code: 0, yaml: '10m',     label: '_10m',    length: [10, 'minute'], start: 'hour' },
    { code: 1, yaml: 'hourly',  label: 'hourly',  length: [1, 'hour'],    start: 'hour' },
    { code: 2, yaml: 'daily',   label: 'daily',   length: [1, 'day'],     start: 'day' },
    { code: 5, yaml: 'weekly',  label: 'weekly',  length: [1, 'week'],    start: 'isoWeek' },
    { code: 3, yaml: 'monthly', label: 'monthly', length: [1, 'month'],   start: 'month' },
    { code: 4, yaml: 'raw',     label: 'rawline' },
];
export const RAW_INTERVAL = 4;
// A year's hours (365 days), and the longest time range, in years
export const YEAR_HOURS = 365 * 24;
export const MAX_RANGE_YEARS = 10;

// The time ranges, from the shortest: their hours, their label (ui.ranges.*, with its count
// n), whether the range selector lists them (menu: false — still taken when the window is set
// so) and whether the magnifier's zoom steps through them (step: false)
export const TIME_RANGES = [
    { hours: 0, label: 'l_hour', menu: false, step: false }, { hours: 1, label: 'hour' },
    ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => ({ hours: n, label: 'n_hours', n, menu: [2, 6, 12].includes(n), step: [2, 6, 12].includes(n) })),
    { hours: 24, label: 'day' },
    ...[2, 3, 4, 5, 6].map(n => ({ hours: 24 * n, label: 'n_days', n, menu: n <= 3 })),
    { hours: 168, label: 'week' },
    ...[2, 3].map(n => ({ hours: 168 * n, label: 'n_weeks', n })),
    { hours: 720, label: 'month' },
    { hours: 2184, label: 'n_months', n: 3 }, { hours: 4368, label: 'n_months', n: 6 },
    { hours: YEAR_HOURS, label: 'year' },
    ...Array.from({ length: MAX_RANGE_YEARS - 1 }, (_, k) => k + 2).map(n => ({ hours: YEAR_HOURS * n, label: 'n_years', n, menu: [2, 5, MAX_RANGE_YEARS].includes(n) })),
];

// The statistics export's periods, in the order its menu shows them: Home Assistant's period
// (its 5-minute statistics, short-term; the others, long-term), its label (ui.interval.*)
export const STATS_EXPORT_PERIODS = [
    { period: '5minute', label: '_5m',     ms: 300e3 },
    { period: 'hour',    label: 'hourly',  ms: 3600e3 },
    { period: 'day',     label: 'daily',   ms: 86400e3 },
    { period: 'week',    label: 'weekly',  ms: 7 * 86400e3 },
    { period: 'month',   label: 'monthly', ms: 30 * 86400e3 },
];
export const barInterval = code => BAR_INTERVALS.find(i => i.code == code);

// Looks: a set of default options given at once with `look:` — the card's own options
// still win, whatever their spelling (a look only gives defaults: it never changes what an
// option means).
// mini: mini-graph-card's look — no header, toolbar, selector nor bar interval selector,
// the first curve's value now and statistics (the others' only when they set their own), in
// the text's color, no time labels nor grid, the Y labels inside the plot, thick smooth lines with a fill
// fading out, a small graph, colors of thresholds blended from one to the next; a header
// with the name on the left and the icon on the right; the legend's names without their
// values, and only for several curves; the Y labels shown on a hover
const LOOKS = {
    mini: { header: 'hide', uiLayout: { toolbar: 'hide', selector: 'hide', interval: 'hide' }, showState: true,
            showStateFor: 'first', showStatsFor: 'first', stateAdaptiveColor: false,
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
    if( !_look ) return c;
    return { ..._look, ...c, uiLayout: { ..._look.uiLayout, ...c.uiLayout } };
}

// A curve's fills the Fill submenu offers (fill), by the name it gives each: none, its color
// light, fading out downwards
export const FILL_VALUES = { none: false, fade: 'fade', light: true, solid: 'solid' };
// The line widths the Width submenu offers (lineWidth), in px
export const LINE_WIDTHS = [1, 2, 3, 4, 5];

// The Y axis sides a curve can be put on (yAxis, the Behavior submenu)
export const Y_AXIS_SIDES = ['left', 'right'];

// A curve's samples' dots (showPoints), in the order the Points submenu shows them: none
// (not even the hovered one), the hovered one only, all
export const POINTS_VALUES = [false, 'hover', true];
// Whether showPoints v shows all the points: true — a number too, a radius (its former form,
// accepted in the YAML: see card-charts.js pointsDiameterOf)
export function allPointsShown(v)
{
    return v === true || ( typeof v === 'number' && v > 0 );
}

// The min/max band's values (showMinMax), in the order the Extremes submenu shows them: none,
// both sides everywhere, only above the curve, only below it — everywhere —, both sides
// where the curve comes from the statistics only, from the history only
export const MIN_MAX_VALUES = [false, 'all', 'max', 'min', 'statistics', 'history'];
// showMinMax in its one form (MIN_MAX_VALUES) — whatever the name it's written with: all is
// true, both too; history, states —, undefined for an unknown one
export const minMaxValue = oneOf('showMinMax', MIN_MAX_VALUES, { synonyms: { all: [true, 'both'], history: ['states'] } });

// Where and which sides of a curve's min/max band are drawn (showMinMax, any of its names):
// { where: 'all' | 'statistics' | 'history', min: below the curve, max: above it }; null: none
export function minMaxBand(v)
{
    const m = minMaxValue(v);
    if( !m ) return null;
    if( m === 'min' || m === 'max' ) return { where: 'all', min: m === 'min', max: m === 'max' };
    return { where: m, min: true, max: true };
}

// A card's configuration in its one form as it's written (raw), the options its look gives
// (look: none for no look, or an unknown one), and both (card: withLook's)
export function lookParts(config)
{
    const raw = normalizeOptions(config ?? {}) ?? {};
    return { raw, look: LOOKS[raw.look] ?? {}, card: withLook(config ?? {}) ?? {} };
}
