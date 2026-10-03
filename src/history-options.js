// The card's options: the curve reconstruction algorithms, the synonyms of the option
// names, and which options can be set at which level (card, entityOptions, graph, entity).

// Curve reconstruction algorithms (the `interpolation` option, for the curves and smart
// line modes) — the first one is the default; see hecSplineTangents in deps/chart-hec.js
export const INTERPOLATIONS = ['monotone', 'steffen', 'makima', 'catmullrom'];

// How each algorithm is named in the Reconstruction menu (names, not translated)
export const INTERPOLATION_LABELS = { monotone: 'Monotone', steffen: 'Steffen', makima: 'Makima', catmullrom: 'Catmull-Rom' };

// (each unknown value is reported once: it's resolved again at each redraw)
const _reportedInterpolations = new Set();

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

// Options spelled differently depending on the level they were first offered at: each
// spelling is accepted at every level (card, entityOptions, graph, entity) — the first
// name is the one used internally, the others are its synonyms
const OPTION_SYNONYMS = {
    lineWidth  : ['width'],
    showPoints : ['showSamples'],
    ystepSize  : ['ystepsize'],
};

export function normalizeOptionSynonyms(o)
{
    if( !o || typeof o !== 'object' || Array.isArray(o) ) return o;
    const r = { ...o };
    for( const [name, aliases] of Object.entries(OPTION_SYNONYMS) ) {
        if( r[name] !== undefined ) continue;
        for( const a of aliases ) if( r[a] !== undefined ) { r[name] = r[a]; break; }
    }
    return r;
}

// Options that can be set at the graph level — under the graph's `options:`, or directly
// on the graph next to `type:` / `entities:` (`options:` wins when both are set)
export const GRAPH_OPTION_KEYS = ['fill', 'showMinMax', 'dashMode', 'lineMode', 'interpolation', 'lineWidth',
    'showPoints', 'decimation', 'netBars', 'interval', 'exclude', 'height', 'stacked', 'ylock',
    'ymin', 'ymax', 'ystepSize', 'showTimeLabels', ...Object.values(OPTION_SYNONYMS).flat()];

// Options of the graph an entity is shown in (its Y axis, its size...) that can also be set
// on the card (for every graph), in entityOptions or on an entity (for the graph it's in)
export const GRAPH_SCOPE_KEYS = ['ymin', 'ymax', 'ystepSize', 'ylock', 'stacked', 'height', 'showTimeLabels'];
