// The card's configuration: the YAML options applied, what Home Assistant and the entity
// options say of an entity (domain, device class, unit, default type), and the graphs built
// from the YAML. Part of HistoryCardState (added to it in history-explorer-card.js).

import { parseColor } from "./history-default-colors.js";
import { seriesState, seriesId, seriesOf } from "./history-series.js";
import { shortNames } from "./legend-names.js";
import { INTERPOLATIONS, normalizeOptions, GRAPH_OPTION_KEYS, GRAPH_SCOPE_KEYS, GRAPH_HEADER_KEYS } from "./history-options.js";

// Pure versions of a few HistoryCardState entity-lookup helpers, needed by
// history-info-panel.js before an HistoryCardState instance exists (its very first
// render can happen before its instance is created). HistoryCardState's own methods
// (CardConfig) just delegate to these, so there's one implementation, not two.
export function getDomainForEntityPure(entity)
{
    return entity.substr(0, entity.indexOf("."));
}

export function getDeviceClassPure(hass, entity)
{
    return seriesState(hass, entity)?.attributes?.device_class;
}

// The type an entity is shown as when nothing sets it (a YAML entity, the info panel): a
// quantity that only adds up (total_increasing) as bars, no unit and not a measurement as a
// timeline, anything else as a line (entities added from the card: detectDefaultType)
export function baseTypePure(hass, entity)
{
    const _attr = seriesState(hass, entity)?.attributes;
    const uom = _attr?.unit_of_measurement, sc = _attr?.state_class;
    return ( sc === 'total_increasing' ) ? 'bar' : ( uom == undefined && sc !== 'measurement' && sc !== 'measurement_angle' ) ? 'timeline' : 'line';
}

export function getEntityOptionsPure(hass, entityOptions, entity)
{
    // Simplified version of HistoryCardState.getEntityOptions: no glob/pattern-list
    // matching, since history-info-panel.js's very first render (before an instance
    // exists) only ever needs the direct entity/device_class/domain lookup.
    let c = entityOptions?.[entity];
    if( !c ) {
        const dc = getDeviceClassPure(hass, entity);
        c = dc ? entityOptions?.[dc] : undefined;
        if( !c ) {
            const dm = getDomainForEntityPure(entity);
            c = dm ? entityOptions?.[dm] : undefined;
        }
    }

    return normalizeOptions(c) ?? undefined;
}

// entityOptions in their one form (see normalizeOptions): each entry's — a list (with
// patterns) or an object keyed by entity id, device class or domain
function normalizeEntityOptions(eo)
{
    if( Array.isArray(eo) ) return eo.map(normalizeOptions);
    if( !eo || typeof eo !== 'object' ) return eo;
    return Object.fromEntries(Object.entries(eo).map(([k, v]) => [k, normalizeOptions(v)]));
}

export class CardConfig
{
    // --------------------------------------------------------------------------------------
    // Configuration
    // --------------------------------------------------------------------------------------

    // Reads the display and behavior options of a configuration — for the card and for the
    // info panel alike. defaults: the host's own default values (used when the configuration
    // doesn't set them); fixed: what the host decides whatever the configuration says.
    applyConfig(config, { defaults = {}, fixed = {} } = {})
    {
        const P = this.pconfig;
        // (the options in their one form, whatever the user wrote — see normalizeOptions)
        const c = normalizeOptions(config);
        const d = (k, v) => k in defaults ? defaults[k] : v;

        P.customStateColors = {};
        for( let i in c.stateColors ?? {} ) P.customStateColors[i] = parseColor(c.stateColors[i]);
        P.entityOptions =          normalizeEntityOptions(c.entityOptions);

        P.labelAreaWidth =         c.labelAreaWidth ?? 65;
        P.labelsVisible =          c.labelsVisible ?? true;
        P.hideLegend =           ( c.legendVisible == false ) ? true : undefined;
        // (auto: a graph's legend only when it has several labels — see card-charts.js newGraph)
        P.legendAuto =             c.legendVisible === 'auto';
        P.cursorMode =             c.cursor?.mode ?? d('cursorMode', 'auto');
        P.cursorTypes =            c.cursor?.types ?? d('cursorTypes', ['timeline']);
        P.showTooltipColors[0] =   c.tooltip?.showColorsLine ?? c.showTooltipColorsLine ?? true;
        P.showTooltipColors[1] =   c.tooltip?.showColorsTimeline ?? c.showTooltipColorsTimeline ?? true;
        P.tooltipSize =            c.tooltip?.size ?? c.tooltipSize ?? 'auto';
        P.tooltipShowDuration =    c.tooltip?.showDuration ?? c.tooltipShowDuration ?? d('tooltipShowDuration', false);
        P.tooltipShowLabel =       c.tooltip?.showLabel ?? true;
        P.tooltipStateTextMode =   c.tooltip?.stateTextMode ?? c.stateTextMode ?? 'auto';
        P.colorSeed =              c.stateColorSeed ?? 137;
        P.stateTextMode =          c.stateTextMode ?? 'auto';
        P.rounding =               c.rounding;

        // Defaults of every entity and graph (an entity, its graph or entityOptions can set their own)
        P.defaultLineMode =        c.lineMode ?? d('defaultLineMode', undefined);
        P.defaultInterpolation =   c.interpolation ?? 'monotone';
        P.defaultLineWidth =       c.lineWidth ?? 2.0;
        P.defaultDashMode =        c.dashMode;
        P.defaultNetBars =         c.netBars;
        P.defaultInterval =        c.interval;
        P.defaultShowMinMax =      c.showMinMax;
        // (aggregation — see resolveAggregation)
        P.defaultPointsPerHour =   c.pointsPerHour;
        P.defaultAggregateFunc =   c.aggregateFunc;
        P.defaultGroupBy =         c.groupBy;
        // (the values over a graph — see card-values.js)
        P.cardShow =               { showState: c.showState, showStats: c.showStats };
        P.defaultShowPoints =      c.showPoints;
        P.defaultYAxis =           c.yAxis;
        P.tapAction =              c.tapAction;
        // (options of every curve an entity, its graph or entityOptions can set their own —
        // see resolveOption; hour24, the card's)
        P.cardOptions =            Object.fromEntries(['valueFactor', 'stateMap', 'colorTransition', 'showLine', 'showIndicator', 'showGraph', 'fixedValue', 'stateAdaptiveColor', 'largeScreenTooltip', 'smallScreenTooltip', ...GRAPH_HEADER_KEYS].filter(k => c[k] !== undefined).map(k => [k, c[k]]));
        P.hour24 =                 c.hour24;
        // (and the color, fill and unit of every entity — as mini-graph-card sets them on the card)
        P.cardGraphDefaults =      Object.fromEntries(
            ['color', 'fill', 'unit', ...GRAPH_SCOPE_KEYS.filter(k => k !== 'height')].filter(k => c[k] !== undefined).map(k => [k, c[k]]));
        // (`height`: the height of every line and bar graph, unless lineGraphHeight /
        // barGraphHeight set their own)
        P.lineGraphHeight =      ( c.lineGraphHeight ?? c.height ?? 250 ) * 1;
        P.barGraphHeight =       ( c.barGraphHeight ?? c.height ?? 150 ) * 1;
        P.timelineBarHeight =    ( c.timelineBarHeight ?? 24 ) * 1;
        P.timelineBarSpacing =   ( c.timelineBarSpacing ?? 40 ) * 1;

        P.showUnavailable =        c.showUnavailable ?? false;
        P.showCurrentValues =      c.showCurrentValues ?? true;
        P.axisAddMarginMin =       c.axisAddMarginMin ?? false;
        P.axisAddMarginMax =       c.axisAddMarginMax ?? false;
        P.recordedEntitiesOnly =   c.recordedEntitiesOnly ?? false;
        P.filterEntities =         c.filterEntities;
        P.excludeFilterEntities =  c.excludeFilterEntities;
        P.combineSameUnits =       c.combineSameUnits === true;
        P.defaultTimeRange =       c.defaultTimeRange ?? '24h';
        P.defaultTimeOffset =      c.defaultTimeOffset ?? undefined;
        P.timeTickDensity =        c.timeTicks?.density ?? c.timeTickDensity ?? 'high';
        P.timeTickOverride =       c.timeTicks?.densityOverride ?? undefined;
        P.timeTickShortDate =      c.timeTicks?.dateFormat === 'short';
        // (on by default since 1.1.49: `automatic: false` turns it off)
        P.refreshEnabled =         c.refresh?.automatic ?? true;
        P.refreshInterval =        c.refresh?.interval ?? undefined;

        this.statistics.enabled =   c.statistics?.enabled ?? true;
        this.statistics.mode =      c.statistics?.mode ?? 'mean';
        this.statistics.retention = c.statistics?.retention ?? undefined;
        this.statistics.period =    c.statistics?.period ?? 'hour';
        this.statistics.force =     c.statistics?.force ?? undefined;

        Object.assign(P, fixed);
    }

    // --------------------------------------------------------------------------------------
    // Entity queries
    // --------------------------------------------------------------------------------------

    getDomainForEntity(entity)
    {
        return getDomainForEntityPure(entity);
    }

    // The state of a series (an entity's, or one of its attributes', see history-series.js)
    stateOf(id)
    {
        return seriesState(this._hass, id);
    }

    getDeviceClass(entity)
    {
        return getDeviceClassPure(this._hass, entity);
    }

    getUnitOfMeasure(entity, manualUnit)
    {
        return ( manualUnit === undefined ) ? this.stateOf(entity)?.attributes?.unit_of_measurement : manualUnit;
    }

    getStateClass(entity)
    {
        return this.stateOf(entity)?.attributes?.state_class;
    }

    getEntityOptions(entity)
    {
        let c = this.pconfig.entityOptions?.[entity];
        if( !c ) {
            const dc = this.getDeviceClass(entity);
            c = dc ? this.pconfig.entityOptions?.[dc] : undefined;
            if( !c ) {
                const dm = this.getDomainForEntity(entity);
                c = dm ? this.pconfig.entityOptions?.[dm] : undefined;
            }
        }

        // If entityOptions is a list, apply glob matching (same logic as former entityPatterns)
        if( Array.isArray(this.pconfig.entityOptions) ) {
            let patched = {};
            for( const p of this.pconfig.entityOptions ) {
                const key = p.match ?? p.entity;
                if( !key ) continue;
                if( this._matchGlob(entity, key) ) {
                    const { match, entity: _e, ...opts } = p;
                    for( const k in opts ) {
                        if( !(k in patched) ) patched[k] = opts[k];
                    }
                }
            }
            if( Object.keys(patched).length ) {
                c = Object.assign({}, patched, c ?? {});
            }
        }

        return c ?? undefined;
    }

    // The curve interpolation algorithm of an entity: its own (YAML entry or Interpolation
    // submenu), else its graph's, else entityOptions', else the card's
    resolveInterpolation(e)
    {
        return e?.interpolation
            ?? this.pconfig.graphs[e?.groupId]?.interpolation
            ?? this.getEntityOptions(e?.entity)?.interpolation
            ?? this.pconfig.defaultInterpolation ?? INTERPOLATIONS[0];
    }

    // Option k of entity e: its own, else its graph's, else entityOptions', else the card's
    // (P.cardOptions) — resolved when used, never copied onto the entity: a curve moved to
    // another graph takes that graph's
    resolveOption(e, k)
    {
        return e?.[k] ?? this.pconfig.graphs[e?.groupId]?.[k] ?? this.getEntityOptions(e?.entity)?.[k] ?? this.pconfig.cardOptions?.[k];
    }

    // Option k of the graph of group groupId (its header, its values — GRAPH_HEADER_KEYS):
    // the graph's, else the card's
    graphOption(groupId, k)
    {
        return this.pconfig.graphs[groupId]?.[k] ?? this.pconfig.cardOptions?.[k];
    }

    // Whether entity e's value now is shown after its name in the legend: its own
    // showCurrentValues (mini-graph-card's show_legend_state), else its graph's, else
    // entityOptions', else the card's
    showsCurrentValue(e)
    {
        return ( e?.showCurrentValues ?? this.pconfig.graphs[e?.groupId]?.showCurrentValues ?? this.getEntityOptions(e?.entity)?.showCurrentValues
            ?? this.pconfig.showCurrentValues ) !== false;
    }

    // The factor entity e's values are drawn with: its scale, times 10 to the power of its
    // valueFactor (mini-graph-card's value_factor — a factor shown too: see shownScaleOf)
    drawScaleOf(e)
    {
        return ( e?.scale ?? 1 ) * 10 ** ( this.resolveOption(e, 'valueFactor') ?? 0 );
    }

    // The factor between entity e's value and the value shown (legend, tooltip, values over
    // the graph): with its own `unit`, its scale — a conversion —, else 1 (the scale only
    // changes how it's drawn); times 10 to the power of its valueFactor either way
    shownScaleOf(e)
    {
        return ( e?.unit !== undefined ? ( e?.scale ?? 1 ) : 1 ) * 10 ** ( this.resolveOption(e, 'valueFactor') ?? 0 );
    }

    // How an entity's values are grouped into points (mini-graph-card's aggregation):
    // { pointsPerHour, aggregateFunc as func, groupBy, explicit — any of them set }, each its
    // own, else its graph's, else entityOptions', else the card's. None set: a point per
    // column of pixels, their mean (see card-datasets.js _lineSamples)
    resolveAggregation(e)
    {
        const _of = k => e?.[k] ?? this.pconfig.graphs[e?.groupId]?.[k] ?? this.getEntityOptions(e?.entity)?.[k]
            ?? this.pconfig['default' + k.charAt(0).toUpperCase() + k.slice(1)];
        const r = { pointsPerHour: _of('pointsPerHour'), func: _of('aggregateFunc'), groupBy: _of('groupBy') };
        r.explicit = !!( r.pointsPerHour || r.func || ( r.groupBy && r.groupBy !== 'interval' ) );
        return r;
    }

    // The Y axis of a line or bar entity: 'left', 'right' or 'auto' (by its unit, see
    // _assignYAxes) — its own, else its graph's, else entityOptions', else the card's.
    // Resolved when drawn, never copied onto the entity: a curve moved to another graph
    // takes that graph's.
    resolveYAxis(e)
    {
        return e?.yAxis ?? this.pconfig.graphs[e?.groupId]?.yAxis ?? this.getEntityOptions(e?.entity)?.yAxis
            ?? this.pconfig.defaultYAxis ?? 'auto';
    }

    // The decimals of entity e's values (see formatNumber): its own `rounding`, else its
    // graph's, else entityOptions', else the card's — undefined: at most 2
    roundingOf(e)
    {
        return e?.rounding ?? this.pconfig.graphs[e?.groupId]?.rounding ?? this.getEntityOptions(e?.entity)?.rounding
            ?? this.pconfig.rounding;
    }

    // What a click on entity e's value does (tapAction — Home Assistant's actions: more-info,
    // navigate, url, perform-action / call-service, none): its own, else its graph's, else
    // entityOptions', else the card's — more-info when none is set
    tapActionOf(e)
    {
        return e?.tapAction ?? this.pconfig.graphs[e?.groupId]?.tapAction ?? this.getEntityOptions(e?.entity)?.tapAction
            ?? this.pconfig.tapAction ?? { action: 'more-info' };
    }

    _matchGlob(str, pattern)
    {
        // Supports * (any chars) and ? (single char); pattern can be a string or array of strings
        if( Array.isArray(pattern) ) return pattern.some(p => this._matchGlob(str, p));
        const parts = pattern.split('*');
        const escaped = parts.map(function(seg) {
            return seg.split('?').map(function(part) {
                return part.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
            }).join('.');
        });
        return new RegExp('^' + escaped.join('.*') + '$').test(str);
    }

    isNumericEntity(entity_id)
    {
        // The entity type menu (line/bar/arrowline/timeline) only offers a real choice for
        // entities whose current state can be treated as a number. Non-numeric states
        // (on/off, text) can only ever be represented as a timeline — the menu is still
        // shown for these (see showEntityTypeMenu), just reduced to timeline only.
        const state = this.stateOf(entity_id)?.state;
        return state !== undefined && state !== null && !isNaN(Number(state));
    }

    // The most fitting way to show an entity added from the UI — preselected (bold) in the
    // type menu, and what "Default" gives for a wildcard match. An entity's own options
    // (entityOptions type / lineMode) always win; otherwise:
    //   - an angle (circular: unit °, state class measurement_angle) — arrowline
    //   - a quantity that only adds up (energy, gas, water, volume: state class
    //     total_increasing, or total with such a device class or unit) — bar
    //   - no unit and not a measurement (a state, a count...) — timeline
    //   - any other measurement — line, smart mode (or the card's own lineMode)
    // (YAML graph entities without a type keep addGraph's own simpler rule.)
    detectDefaultType(entity_id)
    {
        const entityOptions = this.getEntityOptions(entity_id);
        const uom = this.getUnitOfMeasure(entity_id);
        const sc = this.getStateClass(entity_id);
        const dc = this.getDeviceClass(entity_id);
        const _cumulative = sc === 'total_increasing' ||
            ( sc === 'total' && ( ['energy', 'gas', 'water', 'volume'].includes(dc) || /^([kMG]?Wh|m³|L|gal|ft³|CCF)$/.test(uom ?? '') ) );
        const type = entityOptions?.type ? entityOptions.type :
                     this.circularPeriodOf({ entity: entity_id, circular: entityOptions?.circular }) ? 'arrowline' :
                     _cumulative ? 'bar' :
                     ( uom == undefined && sc !== 'measurement' && sc !== 'measurement_angle' ) ? 'timeline' : 'line';
        const lineMode = entityOptions?.lineMode || this.pconfig.defaultLineMode || 'smart';
        return { type, lineMode };
    }

    // --------------------------------------------------------------------------------------
    // Build initial graph list from YAML
    // --------------------------------------------------------------------------------------

    _makeStaticEntityEntry(entity, groupId, ent, interval)
    {
        ent = normalizeOptions(ent);
        return {
            entity            : entity,
            groupId           : groupId,
            color             : ent.color,
            colorSet          : ent.color !== undefined || undefined,
            fill              : ent.fill,
            hidden            : ent.hidden,
            interval          : ent.interval ?? interval,
            isStatic          : true,
            name              : ent.name,
            scale             : ent.scale,
            siConversionFactor: ent.siConversionFactor,
            dashMode          : ent.dashMode,
            lineMode          : ent.lineMode,
            interpolation     : ent.interpolation,
            width             : ent.lineWidth,
            type              : ent.type,
            // Y axis bounds set on an entity: the axis is the graph's, so they apply to the
            // graph the entity is shown in (see addGraph)
            ymin              : ent.ymin,
            ymax              : ent.ymax,
            ystepSize         : ent.ystepSize,
            // Other options of the graph the entity is shown in (same as the Y axis bounds)
            ylock             : ent.ylock,
            stacked           : ent.stacked,
            height            : ent.height,
            showTimeLabels    : ent.showTimeLabels,
            showGrid          : ent.showGrid,
            yLabels           : ent.yLabels,
            showPoints        : ent.showPoints,
            largeScreenTooltip: ent.largeScreenTooltip,
            smallScreenTooltip: ent.smallScreenTooltip,
            showMinMax        : ent.showMinMax,
            showState         : ent.showState,
            showStats         : ent.showStats,
            unit              : ent.unit,
            process           : ent.process,
            netBars           : ent.netBars,
            circular          : ent.circular,
            yAxis             : ent.yAxis,
            rounding          : ent.rounding,
            tapAction         : ent.tapAction,
            pointsPerHour     : ent.pointsPerHour,
            aggregateFunc     : ent.aggregateFunc,
            groupBy           : ent.groupBy,
            yminRight         : ent.yminRight,
            ymaxRight         : ent.ymaxRight,
            yrange            : ent.yrange,
            yrangeRight       : ent.yrangeRight,
            logarithmic       : ent.logarithmic,
            labelsLeft        : ent.labelsLeft,
            labelsRight       : ent.labelsRight,
            valueFactor       : ent.valueFactor,
            stateMap          : ent.stateMap,
            colorTransition   : ent.colorTransition,
            showLine          : ent.showLine,
            legendVisible     : ent.legendVisible,
            showIndicator     : ent.showIndicator,
            showGraph         : ent.showGraph,
            fixedValue        : ent.fixedValue,
            stateAdaptiveColor: ent.stateAdaptiveColor,
            showCurrentValues : ent.showCurrentValues,
            enableMultidevicePersistence: this.resolveEntityPersistenceFields(ent.enable_multidevice_persistence),
            enablePersistence: this.resolveEntityPersistenceFields(ent.enable_persistence),
        };
    }

    // The YAML's graphs: the one the card's own `entities` make, as mini-graph-card writes
    // them — its `name` the graph's title, its `show: graph` the graph's type (line, or
    // bar) — then `graphs` (undefined when there's none)
    yamlGraphs(config)
    {
        // (the card's line_color: every graph's, unless it sets its own)
        const _lc = config?.lineColor ?? config?.line_color;
        const _withColors = gs => _lc === undefined || !Array.isArray(gs) ? gs
            : gs.map(g => g && typeof g === 'object' && g.lineColor === undefined && g.line_color === undefined && g.options?.lineColor === undefined && g.options?.line_color === undefined ? { ...g, lineColor: _lc } : g);
        if( !Array.isArray(config?.entities) || !config.entities.length ) return _withColors(config?.graphs);
        const _own = { type: config.show_graph === 'bar' ? 'bar' : 'line', title: config.name, entities: config.entities };
        return _withColors([_own, ...( Array.isArray(config.graphs) ? config.graphs : [] )]);
    }

    // Builds the static graph/entity list from the YAML `graphs:` option. Defensive at every
    // level so a single malformed graph or entity is logged and skipped rather than throwing
    // and losing every graph on the card (see history-explorer-card.md changelog for the bug
    // this was written to prevent: a bad `exclude:` entry used to blank the whole card).
    buildGraphListFromConfig(graphs)
    {
        const testEntityExclusionList = function(entity, excludes) { for( let i of excludes ) if( i.test(entity) ) return true; return false; };

        if( !Array.isArray(graphs) ) {
            console.warn(`history-explorer-card: 'graphs' must be a list — got ${JSON.stringify(graphs)}. No graphs loaded.`);
            return;
        }

        for( let graph of graphs ) {
            if( !graph || typeof graph !== 'object' ) {
                console.warn(`history-explorer-card: skipping invalid graph entry (expected an object, got ${JSON.stringify(graph)})`);
                continue;
            }
            if( !Array.isArray(graph.entities) ) {
                if( graph.entities !== undefined )
                    console.warn(`history-explorer-card: graph '${graph.title ?? graph.type ?? '?'}' has an invalid 'entities' (expected a list, got ${JSON.stringify(graph.entities)}) — graph skipped`);
                continue;
            }
            const _gid = this.newGraphId();
            const _groupId = _gid; // use graph index as groupId for static graphs
            // The graph's options: under `options:`, or directly on the graph (`options:`
            // wins when both are set), with every synonym accepted
            const _gopts = graph.options && typeof graph.options === 'object' ? graph.options : {};
            const _opts = normalizeOptions({
                ...Object.fromEntries(GRAPH_OPTION_KEYS.filter(k => graph[k] !== undefined).map(k => [k, graph[k]])),
                ..._gopts });
            const _interval = _opts.interval ?? null;

            // A series written again — in another graph, or in this one (mini-graph-card's
            // way: the same sensor's max, min and mean, each its aggregate_func; in the YAML
            // only, the card's own gestures never put a curve twice in a graph) —: a second
            // curve of it (its copy number — see keyOf)
            // (mini-graph-card's line_color: the graph's, else the card's — see yamlGraphs —, a
            // color or a list of them: each entity without its own color takes the one at its
            // place in the graph)
            const _lineColor = _opts.lineColor;
            let _place = 0;
            const _addStatic = (id, ent) => {
                if( ent.color === undefined && ent.color_thresholds === undefined && _lineColor?.[_place] !== undefined ) ent = { ...ent, color: _lineColor[_place] };
                _place++;
                const _entry = this._makeStaticEntityEntry(id, _groupId, ent, _interval);
                const _copy = this.store.newCopy(id);
                if( _copy ) _entry.copy = _copy;
                this.store.add(_entry);
            };

            for( let e of graph.entities ) {
                // (an entity_id alone: that entity)
                if( typeof e === 'string' ) e = { entity: e };
                if( !e || typeof e !== 'object' || typeof e.entity !== 'string' || e.entity === '' ) {
                    console.warn(`history-explorer-card: skipping invalid entity entry in graph '${graph.title ?? graph.type ?? '?'}' (expected an object with a non-empty 'entity' string, got ${JSON.stringify(e)})`);
                    continue;
                }
                if( e.entity.indexOf('*') >= 0 ) {
                    // graph.options.exclude applies to every wildcard entity in this graph;
                    // combined with (not replacing) this entity's own exclude, same pattern
                    // as the other graph-level defaults above.
                    const _graphExclude = _opts.exclude;
                    const _combinedExclude = _graphExclude
                        ? [ ...(Array.isArray(_graphExclude) ? _graphExclude : [_graphExclude]),
                            ...(Array.isArray(e.exclude) ? e.exclude : (e.exclude ? [e.exclude] : [])) ]
                        : e.exclude;
                    const regexExcludes = this.buildEntityExclusionList(_combinedExclude);
                    const regex = this.matchWildcardPattern(e.entity);
                    // Collect matches first, then add in natural alphabetical order —
                    // HA's state object iterates in entity creation order, which carries
                    // no meaningful logic a user could rely on (unlike entity_id/friendly_name,
                    // which the user actually names with intent).
                    const _matched = [];
                    for( let s in this._hass.states )
                        if( regex && regex.test(s) && !testEntityExclusionList(s, regexExcludes) )
                            _matched.push(s);
                    _matched.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                    for( let s of _matched ) _addStatic(seriesId(s, e.attribute), {...e, 'entity': s});
                } else {
                    // (attribute: one of the entity's attributes instead of its state)
                    _addStatic(seriesId(e.entity, e.attribute), e);
                }
            }
            // Store graph-level properties indexed by groupId — consumed at rebuild, never persisted.
            // fill/showMinMax/dashMode/lineMode/width/showPoints/netBars act as
            // per-entity defaults here (see addGraph's entityOptions merge) — same role as
            // entityOptions matched by entity_id/device_class/domain, but scoped to entities
            // sharing this graph instead. Deliberately excluded: color/name/scale/
            // siConversionFactor/unit/process/hidden — each is inherently per-entity, a
            // shared default for any of them would be meaningless or actively wrong (e.g. a
            // shared 'hidden' default would hide every entity in the graph by default).
            this.pconfig.graphs[_groupId] = {
                type           : graph.type,
                title          : graph.title,
                showTimeLabels : _opts.showTimeLabels,
                showGrid       : _opts.showGrid,
                yLabels        : _opts.yLabels,
                height         : _opts.height,
                stacked        : _opts.stacked,
                ylock          : _opts.ylock,
                ymin           : _opts.ymin,
                ymax           : _opts.ymax,
                ystepSize      : _opts.ystepSize,
                fill           : _opts.fill,
                showMinMax     : _opts.showMinMax,
                showState      : _opts.showState,
                showStats      : _opts.showStats,
                dashMode       : _opts.dashMode,
                lineMode       : _opts.lineMode,
                interpolation  : _opts.interpolation,
                lineWidth      : _opts.lineWidth,
                showPoints     : _opts.showPoints,
                largeScreenTooltip : _opts.largeScreenTooltip,
                smallScreenTooltip : _opts.smallScreenTooltip,
                netBars        : _opts.netBars,
                yAxis          : _opts.yAxis,
                rounding       : _opts.rounding,
                tapAction      : _opts.tapAction,
                pointsPerHour  : _opts.pointsPerHour,
                aggregateFunc  : _opts.aggregateFunc,
                groupBy        : _opts.groupBy,
                yminRight      : _opts.yminRight,
                ymaxRight      : _opts.ymaxRight,
                yrange         : _opts.yrange,
                yrangeRight    : _opts.yrangeRight,
                logarithmic    : _opts.logarithmic,
                labelsLeft     : _opts.labelsLeft,
                labelsRight    : _opts.labelsRight,
                valueFactor    : _opts.valueFactor,
                stateMap       : _opts.stateMap,
                colorTransition: _opts.colorTransition,
                showLine       : _opts.showLine,
                showIndicator  : _opts.showIndicator,
                showGraph      : _opts.showGraph,
                stateAdaptiveColor: _opts.stateAdaptiveColor,
                showCurrentValues: _opts.showCurrentValues,
                // (its header and its values: see graphOption)
                ...Object.fromEntries(GRAPH_HEADER_KEYS.map(k => [k, _opts[k]])),
            };
        }
    }

    // The line mode an entity is drawn with
    lineModeOf(e)
    {
        return e?.lineMode || this.pconfig.defaultLineMode || 'curves';
    }

    // Is entity e of graph g a curve that's interpolated (curves or smart mode — the only
    // modes interpolation applies to)?
    isInterpolated(e, g)
    {
        const _mode = this.lineModeOf(e);
        return ( e.type ?? g.type ) === 'line' && ( _mode === 'curves' || _mode === 'smart' );
    }

    // The shorter forms of names (legend-names.js) — items: [{ name, entity_id }] — from
    // what Home Assistant knows: each entity's device, and how many entities carry a
    // qualifier. For a legend too narrow for its curves' names, and the entity selector's
    // lines too long for its field
    shortNameForms(items)
    {
        const _hass = this._hass;
        const _device = id => {
            const _did = _hass?.entities?.[seriesOf(id ?? '').entity]?.device_id;
            const _d = _did ? _hass?.devices?.[_did] : null;
            return _d ? ( _d.name_by_user || _d.name || null ) : null;
        };
        // (a qualifier carried by 3 entities or more, counted once per states object)
        if( this._qualifierCount?.states !== _hass?.states ) this._qualifierCount = { states: _hass?.states, n: new Map() };
        const _frequent = q => {
            const _n = this._qualifierCount.n;
            if( !_n.has(q) ) _n.set(q, Object.values(_hass?.states ?? {}).filter(st => String(st.attributes?.friendly_name ?? '').includes(q)).length);
            return _n.get(q) >= 3;
        };
        return shortNames(items.map(d => ({ name: d.name, device: _device(d.entity_id) })),
                          { frequent: _frequent, lang: String(_hass?.language ?? 'en').slice(0, 2) });
    }
}
