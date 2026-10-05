// The card's configuration: the YAML options applied, what Home Assistant and the entity
// options say of an entity (domain, device class, unit, default type), and the graphs built
// from the YAML. Part of HistoryCardState (added to it in history-explorer-card.js).

import { parseColor } from "./history-default-colors.js";
import { INTERPOLATIONS, normalizeInterpolation, normalizeOptionSynonyms, GRAPH_OPTION_KEYS, GRAPH_SCOPE_KEYS } from "./history-options.js";

// Pure versions of a few HistoryCardState entity-lookup helpers, needed by
// history-info-panel.js before an HistoryCardState instance exists (its very first
// render can happen before _hec_instance is created). HistoryCardState's own methods
// (CardConfig) just delegate to these, so there's one implementation, not two.
export function getDomainForEntityPure(entity)
{
    return entity.substr(0, entity.indexOf("."));
}

export function getDeviceClassPure(hass, entity)
{
    return hass.states[entity]?.attributes?.device_class;
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

    return c ?? undefined;
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
        // (every spelling of an option accepted — see normalizeOptionSynonyms)
        const c = normalizeOptionSynonyms(config);
        const d = (k, v) => k in defaults ? defaults[k] : v;

        P.customStateColors = {};
        for( let i in c.stateColors ?? {} ) P.customStateColors[i] = parseColor(c.stateColors[i]);
        P.entityOptions =          c.entityOptions;

        P.labelAreaWidth =         c.labelAreaWidth ?? 65;
        P.labelsVisible =          c.labelsVisible ?? true;
        P.hideLegend =           ( c.legendVisible == false ) ? true : undefined;
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
        P.decimation =             c.decimation;
        P.roundingPrecision =      c.rounding || 2;

        // Defaults of every entity and graph (an entity, its graph or entityOptions can set their own)
        P.defaultLineMode =        this.normalizeLineMode(c.lineMode) ?? d('defaultLineMode', undefined);
        P.defaultInterpolation =   normalizeInterpolation(c.interpolation) ?? 'monotone';
        P.defaultLineWidth =       c.lineWidth ?? 2.0;
        P.defaultDashMode =        c.dashMode;
        P.defaultNetBars =         c.netBars;
        P.defaultInterval =        c.interval;
        P.defaultShowMinMax =      c.showMinMax;
        P.defaultShowPoints =      c.showPoints;
        P.cardGraphDefaults =      Object.fromEntries(
            ['fill', ...GRAPH_SCOPE_KEYS.filter(k => k !== 'height')].filter(k => c[k] !== undefined).map(k => [k, c[k]]));
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
        P.defaultTimeRange =       c.defaultTimeRange ?? '24';
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

    parseIntervalConfig(s)
    {
        const options = { '10m' : 0, 'hourly' : 1, 'daily' : 2, 'monthly' : 3 };
        return options[s];
    }

    // --------------------------------------------------------------------------------------
    // Entity queries
    // --------------------------------------------------------------------------------------

    getDomainForEntity(entity)
    {
        return getDomainForEntityPure(entity);
    }

    getDeviceClass(entity)
    {
        return getDeviceClassPure(this._hass, entity);
    }

    getUnitOfMeasure(entity, manualUnit)
    {
        return ( manualUnit === undefined ) ? this._hass.states[entity]?.attributes?.unit_of_measurement : manualUnit;
    }

    getStateClass(entity)
    {
        return this._hass.states[entity]?.attributes?.state_class;
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
                    const { match, entity: _e, ...opts } = normalizeOptionSynonyms(p);
                    for( const k in opts ) {
                        if( !(k in patched) ) patched[k] = opts[k];
                    }
                }
            }
            if( Object.keys(patched).length ) {
                c = Object.assign({}, patched, normalizeOptionSynonyms(c) ?? {});
            }
        }

        return normalizeOptionSynonyms(c) ?? undefined;
    }

    // The curve interpolation algorithm of an entity: its own (YAML entry or Interpolation
    // submenu), else its graph's, else entityOptions', else the card's
    _resolveInterpolation(e)
    {
        return e?.interpolation
            ?? normalizeInterpolation(this.pconfig.graphs[e?.groupId]?.interpolation)
            ?? normalizeInterpolation(this.getEntityOptions(e?.entity)?.interpolation)
            ?? this.pconfig.defaultInterpolation ?? INTERPOLATIONS[0];
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

    _isNumericEntity(entity_id)
    {
        // The entity type menu (line/bar/arrowline/timeline) only offers a real choice for
        // entities whose current state can be treated as a number. Non-numeric states
        // (on/off, text) can only ever be represented as a timeline — the menu is still
        // shown for these (see showEntityTypeMenu), just reduced to timeline only.
        const state = this._hass.states[entity_id]?.state;
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
    _detectDefaultType(entity_id)
    {
        const entityOptions = this.getEntityOptions(entity_id);
        const uom = this.getUnitOfMeasure(entity_id);
        const sc = this.getStateClass(entity_id);
        const dc = this.getDeviceClass(entity_id);
        const _cumulative = sc === 'total_increasing' ||
            ( sc === 'total' && ( ['energy', 'gas', 'water', 'volume'].includes(dc) || /^([kMG]?Wh|m³|L|gal|ft³|CCF)$/.test(uom ?? '') ) );
        const type = entityOptions?.type ? entityOptions.type :
                     this._circularPeriod({ entity: entity_id, circular: entityOptions?.circular }) ? 'arrowline' :
                     _cumulative ? 'bar' :
                     ( uom == undefined && sc !== 'measurement' && sc !== 'measurement_angle' ) ? 'timeline' : 'line';
        const lineMode = this.normalizeLineMode(entityOptions?.lineMode) || this.pconfig.defaultLineMode || 'smart';
        return { type, lineMode };
    }

    // --------------------------------------------------------------------------------------
    // Build initial graph list from YAML
    // --------------------------------------------------------------------------------------

    _makeStaticEntityEntry(entity, groupId, ent, interval)
    {
        ent = normalizeOptionSynonyms(ent);
        return {
            entity            : entity,
            groupId           : groupId,
            color             : ent.color,
            colorSet          : ent.color !== undefined || undefined,
            fill              : ent.fill,
            hidden            : ent.hidden,
            interval          : this.parseIntervalConfig(ent.interval) ?? interval,
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
            showPoints        : ent.showPoints,
            showMinMax        : ent.showMinMax,
            unit              : ent.unit,
            process           : ent.process,
            netBars           : ent.netBars,
            decimation        : ent.decimation,
            circular          : ent.circular,
            yAxis             : ent.yAxis,
            enableMultidevicePersistence: this.resolveEntityPersistenceFields(ent.enable_multidevice_persistence),
            enablePersistence: this.resolveEntityPersistenceFields(ent.enable_persistence),
        };
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
            const _gid = this.g_id++;
            const _groupId = _gid; // use graph index as groupId for static graphs
            // The graph's options: under `options:`, or directly on the graph (`options:`
            // wins when both are set), with every synonym accepted
            const _gopts = graph.options && typeof graph.options === 'object' ? graph.options : {};
            const _opts = normalizeOptionSynonyms({
                ...Object.fromEntries(GRAPH_OPTION_KEYS.filter(k => graph[k] !== undefined).map(k => [k, graph[k]])),
                ..._gopts });
            const _interval = this.parseIntervalConfig(_opts.interval) ?? null;

            for( let e of graph.entities ) {
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
                    for( let s of _matched ) {
                        const _ent = {...e, 'entity': s};
                        this.store.add(this._makeStaticEntityEntry(s, _groupId, _ent, _interval));
                    }
                } else {
                    this.store.add(this._makeStaticEntityEntry(e.entity, _groupId, e, _interval));
                }
            }
            // Store graph-level properties indexed by groupId — consumed at rebuild, never persisted.
            // fill/showMinMax/dashMode/lineMode/width/showPoints/decimation/netBars act as
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
                height         : _opts.height,
                stacked        : _opts.stacked,
                ylock          : _opts.ylock,
                ymin           : _opts.ymin,
                ymax           : _opts.ymax,
                ystepSize      : _opts.ystepSize,
                fill           : _opts.fill,
                showMinMax     : _opts.showMinMax,
                dashMode       : _opts.dashMode,
                lineMode       : _opts.lineMode,
                interpolation  : _opts.interpolation,
                lineWidth      : _opts.lineWidth,
                showPoints     : _opts.showPoints,
                decimation     : _opts.decimation,
                netBars        : _opts.netBars,
            };
        }
    }
}
