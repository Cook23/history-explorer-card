// The graphs on the page: built from the entity list (the store) — each entity's defaults,
// the graph it joins —, placed in the display order, linked to the graphs of their group,
// rebuilt, removed. What one graph is for Chart.js is card-charts.js's. Part of
// HistoryCardState (added to it in history-explorer-card.js).

import { defaultColors, colorSpec, fillValue } from "./history-default-colors.js";
import { i18n } from "./languages.js";
import { keyOf, entityIdOf } from "./history-entity-store.js";
import { areSICompatible } from "./history-units.js";
import { typesCompatible, GRAPH_SCOPE_KEYS } from "./history-options.js";

// The icon of an entity without its own, by its device class (mini-graph-card's)
const DEVICE_CLASS_ICONS = { humidity: 'mdi:water-percent', illuminance: 'mdi:brightness-5', temperature: 'mdi:thermometer',
    battery: 'mdi:battery', pressure: 'mdi:gauge', power: 'mdi:flash', signal_strength: 'mdi:wifi', motion: 'mdi:walk',
    door: 'mdi:door-closed', window: 'mdi:window-closed', presence: 'mdi:account', light: 'mdi:lightbulb' };
import { baseTypePure } from "./card-config.js";
const Chart = window.HXLocal_Chart;

export class CardGraphs
{
    // --------------------------------------------------------------------------------------
    // Graphs in the display order
    // --------------------------------------------------------------------------------------

    calcGraphHeight(type, n, h)
    {
        switch( type ) {
            case 'line': return ( h ? h : this.pconfig.lineGraphHeight );
            case 'bar':  return ( h ? h : this.pconfig.barGraphHeight ) + 24;
            default:
                // (room for its tooltip, as large as its size says — see tooltipSize)
                return Math.max(34 + n * this.pconfig.timelineBarSpacing, { full: 130, compact: 115, slim: 90 }[this.tooltipSize()]);
        }
    }

    // A graph's header (mini-graph-card's): its name — its title, else, with showName, its
    // first curve's name — and its icon (showIcon: iconImage, else icon, else the entity's
    // own, else one by its device class), laid out by alignHeader (center by default, the
    // title alone; default: the name on the left, the icon on the right; left; right) and
    // alignIcon (right, left — or state: with the values over the graph, see
    // graphStateIcon), in fontSizeHeader px; the name and the icon in the color of the first
    // curve now with nameAdaptiveColor, iconAdaptiveColor. Each the graph's, else the
    // card's (graphOption). Updated with the values now (see showValues)
    updateGraphHeader(g)
    {
        const _h = g?.canvas && this.graphDiv(g)?.querySelector('.hec-graph-header');
        if( !_h ) return;
        const o = k => this.graphOption(g.groupId, k);
        const _first = g.entities[0];
        const _title = this.pconfig.graphs[g.groupId]?.title;
        const _name = o('showName') === false ? undefined : _title ?? ( o('showName') === true && _first ? _first.name ?? this.stateOf(_first.entity)?.attributes?.friendly_name ?? _first.entity : undefined );
        const _icon = o('showIcon') === true && o('alignIcon') !== 'state' ? this._graphIconElement(g) : null;
        _h.textContent = '';
        _h.style.display = ( _name === undefined && !_icon ) ? 'none' : 'flex';
        if( _h.style.display === 'none' ) return;
        const _align = o('alignHeader') ?? 'center';
        Object.assign(_h.style, { alignItems: 'center', gap: '0.6em', padding: '0 10px', minWidth: '0',
            justifyContent: { center: 'center', default: 'space-between', left: 'flex-start', right: 'flex-end' }[_align],
            fontSize: o('fontSizeHeader') ? o('fontSizeHeader') + 'px' : '' });
        const _color = _first ? this.entityColor(_first) : undefined;
        if( _name !== undefined ) {
            const n = document.createElement('span');
            n.className = 'hec-graph-name';
            n.textContent = _name;
            n.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0' + ( o('nameAdaptiveColor') && _color ? ';color:' + _color : '' );
            _h.appendChild(n);
        }
        if( _icon ) { if( o('alignIcon') === 'left' ) _icon.style.order = '-1'; _h.appendChild(_icon); }
    }

    // The icon a graph shows with its values (alignIcon: state, with showIcon), else null
    graphStateIcon(g)
    {
        const o = k => this.graphOption(g.groupId, k);
        return o('showIcon') === true && o('alignIcon') === 'state' ? this._graphIconElement(g) : null;
    }

    // A graph's icon (see updateGraphHeader): an image, or Home Assistant's icon element
    _graphIconElement(g)
    {
        const o = k => this.graphOption(g.groupId, k);
        const _first = g.entities[0];
        const _box = document.createElement('div');
        _box.className = 'hec-graph-icon';
        _box.style.cssText = 'flex:0 0 auto;display:flex;align-items:center;color:' +
            ( o('iconAdaptiveColor') && _first ? this.entityColor(_first) : 'var(--state-icon-color, #44739e)' );
        if( o('iconImage') ) {
            const i = document.createElement('img');
            i.src = o('iconImage'); i.height = 25;
            _box.appendChild(i);
        } else {
            const i = document.createElement('ha-icon');
            i.setAttribute('icon', o('icon') ?? this._entityIcon(_first?.entity));
            _box.appendChild(i);
        }
        return _box;
    }

    // An entity's icon: its own, else one by its device class (mini-graph-card's), else a
    // curve's
    _entityIcon(entity)
    {
        const a = this.stateOf(entity)?.attributes ?? {};
        return a.icon ?? DEVICE_CLASS_ICONS[a.device_class] ?? 'mdi:chart-line';
    }

    graphDiv(g)
    {
        // Returns the wrapper <div> containing a graph's canvas and its overlays
        return g.canvas.parentNode.parentNode;
    }

    _footerAnchor(gl)
    {
        // Returns the top-level child of #graphlist where the bottom toolbar block starts:
        // #tb_1 when the bottom toolbar/selector are shown (it renders before #rf_1), or
        // #rf_1 as a fallback — it's always rendered, even when both are hidden, so this
        // anchor always exists once the bottom section has been rendered at all. Graphs
        // must be inserted before it, never appended after — #graphlist holds both the
        // toolbars and the graphs since the v1.1.27 unified pipeline, unlike the pre-1.1.27
        // layout where toolbars lived outside it.
        const _anchorEl = this._this.querySelector('#tb_1') ?? this._this.querySelector('#rf_1');
        if( !_anchorEl ) return null;
        let _node = _anchorEl;
        while( _node && _node.parentNode !== gl ) _node = _node.parentNode;
        return _node;
    }

    // All graphs on the page, in true display order: pconfig.entities' own order decides
    // between different groupId blocks; within one groupId block (usually a single graph,
    // exceptionally several linked ones), graphIndex decides — position in pconfig.entities
    // does NOT reflect a block's internal graph order, that's the whole reason graphIndex
    // exists.
    // --- GRAPH-level order helpers (groupId + graphIndex — the full on-screen order) ---

    graphsInDisplayOrder()
    {
        const _seen = new Set();
        const _result = [];
        let _blockGroupId = Symbol();
        let _blockGraphs = [];
        const _flushBlock = () => {
            _blockGraphs.sort((a, b) => (a.entities[0]?.graphIndex ?? 0) - (b.entities[0]?.graphIndex ?? 0));
            _result.push(..._blockGraphs);
            _blockGraphs = [];
        };
        for( let en of this.store.list ) {
            if( typeof en !== 'object' ) continue;
            const _g = this.graphs.find(gr => gr.entities.some(e => keyOf(e) === keyOf(en)));
            if( !_g || _seen.has(_g) ) continue;
            if( en.groupId !== _blockGroupId ) { _flushBlock(); _blockGroupId = en.groupId; }
            _seen.add(_g);
            _blockGraphs.push(_g);
        }
        _flushBlock();
        return _result;
    }

    _firstGraph()
    {
        return this.graphsInDisplayOrder()[0] ?? null;
    }

    _isFirstGraph(g)
    {
        return this._firstGraph() === g;
    }

    // The graph immediately before/after g on screen — needed to number a new graph's
    // graphIndex correctly in every situation, including inside a solid block of several
    // linked graphs.
    previousGraph(g)
    {
        const _all = this.graphsInDisplayOrder();
        const _idx = _all.indexOf(g);
        return (_idx > 0) ? _all[_idx - 1] : null;
    }

    nextGraph(g)
    {
        const _all = this.graphsInDisplayOrder();
        const _idx = _all.indexOf(g);
        return (_idx >= 0 && _idx < _all.length - 1) ? _all[_idx + 1] : null;
    }

    // --- GROUP-level order helpers (groupId only — a solid block of one or more linked
    // graphs is treated as a single unit; nothing can ever be inserted inside it) ---

    // The graph that follows g's whole group, per pconfig.entities' order — the source of
    // truth for display order (this.graphs is a working structure only, never reliable for
    // order). Scans forward from g's last entity in pconfig.entities for the next entry
    // whose groupId differs from g's — a run of same-groupId entries is one solid block, so
    // the first differing groupId is always the true next group.
    nextGroup(g)
    {
        const _lastEntity = g.entities[g.entities.length - 1];
        const _list = this.store.list;
        const _startIdx = this.store.indexOf(keyOf(_lastEntity));
        if( _startIdx < 0 ) return null;
        for( let i = _startIdx + 1; i < _list.length; i++ ) {
            const _e = _list[i];
            if( typeof _e !== 'object' || _e.groupId === g.groupId ) continue;
            const _candidateG = this.graphs.find(gr => gr !== g && gr.entities.some(en => keyOf(en) === keyOf(_e)));
            if( _candidateG ) return _candidateG;
        }
        return null;
    }

    // --------------------------------------------------------------------------------------
    // Linked graphs
    // --------------------------------------------------------------------------------------

    detachGraph(g)
    {
        // Removes a graph's wrapper div from the DOM and from this.graphs. Callers capture
        // the graph right after g in this.graphs BEFORE calling this, to use as addGraph's
        // `before` (insertBefore semantics) for whatever gets rebuilt in its place.
        this.graphDiv(g).remove();
        this.graphs.splice(this.graphs.indexOf(g), 1);
    }

    // Removes g.entities[idx] and detaches g. If any entities remain, rebuilds g's
    // replacement in the same spot (right before whatever graph followed g) with the same
    // groupId — same "remove one entity from a combined graph" shared by splitCurve,
    // the cross-graph legend drag (source side), and entity removal. Callers still handle
    // whatever they do with the removed entity afterward (recreate it elsewhere, drop it,
    // move it into a target graph, etc.) — this only ever rebuilds what's LEFT of g.
    // nextG defaults to nextGroup(g), computed here — but a caller that mutates
    // pconfig.entities' order or groupIds BEFORE calling this (e.g. splitCurve,
    // regrouping the just-extracted entity under its new groupId first) must compute and
    // pass its own, since nextGroup's scan depends on that order already being final.
    // Returns the removed entity.
    detachAndRebuildRemaining(g, idx, nextG = undefined)
    {
        const _entity = g.entities[idx];
        const _remaining = g.entities.filter((_, i) => i !== idx);
        const _origGroupId = g.groupId;
        const _nextG = nextG !== undefined ? nextG : this.nextGroup(g);
        this.detachGraph(g);
        _remaining.forEach(en => { en.siConversionFactor = undefined; });
        this.rebuildGraph(_remaining, _origGroupId, _nextG);
        return _entity;
    }

    _updateMoVisibility()
    {
        const _single = this.graphs.length <= 1;
        for( let g of this.graphs ) {
            if( g.chart ) {
                g.chart.options.moveHandleVisible = !_single;
                g.chart.update();
            }
        }
    }

    // Shows a chain-link icon between two consecutive graphs that share the same non-null
    // groupId (linked graphs) so the link is visible even outside a
    // drag gesture. Called after anything that can change graph composition or order.
    // Takes no vertical space (height:0 wrapper, icon floated up over it) and is always
    // re-inserted at its correct DOM position even if it already existed, as a cheap safety
    // net (addGraph inserts each graph div directly at its final spot via `before`).
    // Chain icon between two linked graphs (same group, one right below the other): shown
    // by Chart.js on the lower one (linkMarkerVisible); a double-click on it reaches
    // customEvent in the zone 'linkMarker' and merges them (mergeGraphUp).
    _updateGroupLinkMarkers()
    {
        // Sort by graphIndex — the stable, persisted display-order field — rather than
        // relying on this.graphs' own array order to already match it.
        const _sorted = [...this.graphs].sort((a, b) =>
            (a.entities?.[0]?.graphIndex ?? 0) - (b.entities?.[0]?.graphIndex ?? 0));
        for( let i = 0; i < _sorted.length; i++ ) {
            const g = _sorted[i];
            const _linked = i > 0 && _sorted[i - 1].groupId !== null &&
                            _sorted[i - 1].groupId !== undefined &&
                            _sorted[i - 1].groupId === g.groupId;
            const _opt = g.chart.options;
            if( !!_opt.linkMarkerVisible === _linked ) continue;
            _opt.linkMarkerVisible = _linked;
            _opt.linkMarkerTitle = `${i18n('ui.menu.linked_graphs')} — ${i18n('ui.menu.linked_graphs_merge')}`;
            g.chart.update();
        }
    }

    // --------------------------------------------------------------------------------------
    // Adding and removing graphs from the view
    // --------------------------------------------------------------------------------------

    // No graph yet (the card's content made again): none on the page, the default colors
    // given from the palette's start
    clearGraphs()
    {
        this.graphs = [];
        this.pconfig.nextDefaultColor = 0;
    }

    // A new graph's id — the YAML's graphs' groups take theirs too (buildGraphListFromConfig)
    newGraphId()
    {
        return this.g_id++;
    }

    // Graphs gs taken off the page
    removeGraphs(gs)
    {
        for( const g of gs ) this.detachGraph(g);
    }

    // Graphs moved (in their display order) put right before (before) or after graph tgt on
    // the page; → whether they could be (false: a graph not where it should be — the page
    // re-rendered under it)
    placeGraphs(moved, tgt, before)
    {
        // (found again by their ids: the page may have been rendered again since)
        const _gl = this._this.querySelector('#graphlist');
        const _div = g => this._this.querySelector(`#graph${g.id}`)?.parentNode.parentNode;
        const _divs = moved.map(_div);
        const _tgtDiv = _div(tgt);
        if( !_gl || _divs.some(d => !d || d.parentNode !== _gl) || _tgtDiv?.parentNode !== _gl ) return false;
        let _anchor = _tgtDiv;
        if( !before ) {
            _anchor = _tgtDiv.nextSibling;
            while( _anchor && _divs.includes(_anchor) ) _anchor = _anchor.nextSibling;
            if( !_anchor || _anchor.parentNode !== _gl ) _anchor = this._footerAnchor(_gl);
        }
        for( const _div of _divs ) {
            if( _anchor ) _gl.insertBefore(_div, _anchor); else _gl.appendChild(_div);
        }
        this.graphs = this.graphs.filter(g => !moved.includes(g));
        const _i = this.graphs.indexOf(tgt);
        this.graphs.splice(before ? _i : _i + 1, 0, ...moved);
        return true;
    }

    // Same group of linked graphs (a static YAML graph split by double-click, or a group
    // split by a type change)?
    sameGroup(a, b)
    {
        return a.groupId !== null && a.groupId !== undefined && a.groupId === b.groupId;
    }

    // The controls drawn on the graphs as their number and their groups say: the handle
    // (when there are several graphs), the chain icon between two linked graphs
    refreshGraphControls()
    {
        this._updateMoVisibility();
        this._updateGroupLinkMarkers();
    }

    addGraph(entity_id, { noAutoGroup = false, color = null, fill = null, before = null, hidden = undefined, isStatic = false, interval = null, groupId = null, entry = null } = {})
    {
        // Shows an entity: in a graph of its group it can join (its type, its sub-graph),
        // else — a new entity, without a group — in the last graph if its units are
        // compatible (combineSameUnits), else in a new graph placed right before `before`
        // (last when null). Options:
        //   noAutoGroup  never joins a graph: a new graph
        //   color, fill  the curve's color, else its entry's / entityOptions' / the palette's
        //   hidden       the curve hidden (else as its entry or entityOptions say)
        //   isStatic     a graph defined in YAML (no close button; kept static when rebuilt)
        //   interval     the bar interval of the graph
        //   groupId      the group the entity belongs to
        //   entry        its entry of the entity list (pconfig.entities), when it has one

        if( this.stateOf(entity_id) == undefined ) return;

        const { graphProps: _graphProps, options: entityOptions } = this._optionsInGraph(entity_id, groupId);

        // (let: becomes the graph's type below, once combined)
        let type = ( entry?.type ?? entityOptions?.type ) || baseTypePure(this._hass, entity_id);

        // The entity's single source of truth: entry is already the
        // pconfig.entities entry when the caller has one (the `_pe ?? en` pattern used
        // throughout this file). If not (a genuinely new entity), create one now and use
        // it — g.entities[0] below is this SAME object, never a copy, so there is nothing
        // left to keep in sync between "session" and "persisted" entity data.
        // (an entry that isn't a persisted entry yet — a plain runtime object —
        // is registered as one, rather than leaving a second, disconnected copy)
        const _pcEntry = this.store.add(entry ?? { entity: entity_id });
        _pcEntry.entity = entity_id;
        // The entity's own display type — kept per entity, since a graph can hold both
        // line and bar entities (see entityKind)
        _pcEntry.type = type;
        // A YAML entity's graph stays static whichever operation rebuilds it (uncombine,
        // drag, type change...) — not only the initial rebuild, which passes isStatic.
        if( _pcEntry.isStatic ) isStatic = true;

        const _ownFill = this._applyEntityDefaults(_pcEntry, type, entityOptions, { color, fill, hidden });

        let entities = [_pcEntry];

        // Captured so the merged graph can be reinserted at the removed graph's DOM position
        // instead of always landing at the end of #graphlist
        let _combineGl = null;
        let _combineInsertBefore = null;
        let _graphIndex;

        const _cand = noAutoGroup ? null : this._combineTarget(_pcEntry, type, groupId);
        if( _cand ) {

            // If no groupId provided, adopt the target graph's groupId
            if( groupId === null ) groupId = _cand.groupId;

            // Joining an existing graph always adopts its groupId AND its graphIndex —
            // same rule, same reasoning: this is still the same displayed graph, and
            // inserting into a solid block of several linked graphs (the only case where
            // a groupId's members could have different graphIndex values) is forbidden
            // elsewhere, so every entity of _cand already shares one value.
            _graphIndex = _cand.entities[0].graphIndex ?? 1;

            this._freeColorIn(_cand, _pcEntry, _ownFill);

            // Add the new entity to the previous ones
            entities = _cand.entities.concat(entities);

            // Capture the DOM position of the graph being removed
            const _candDiv = this.graphDiv(_cand);
            _combineGl = _candDiv.parentNode;
            let _sib = _candDiv.nextSibling;
            while( _sib && !_combineGl.contains(_sib) ) _sib = _sib.nextSibling;
            _combineInsertBefore = _sib;

            // Delete the old graph, will be regenerated below including the new entity
            _candDiv.remove();
            this.graphs.splice(this.graphs.indexOf(_cand), 1);

        } else {
            _graphIndex = this._newGraphIndex(before);
        }
        for( let e of entities ) e.graphIndex = _graphIndex;

        // entityOptions.groupId was frozen before the combine block resolved the final
        // groupId (e.g. adopting the target graph's groupId when it was null) — resync it
        // here so the graph object built below gets the correct, final groupId. _pcEntry
        // is g.entities[0] itself (no separate copy), so it must be kept in step too.
        entityOptions.groupId = groupId;
        _pcEntry.groupId = groupId;

        // Y axis bounds: the graph's own options first, else the first entity of the graph
        // that sets them (on its YAML entry), else entityOptions — taken from every entity
        // of the graph, not only the one being added.
        for( const _k of GRAPH_SCOPE_KEYS ) {
            if( _graphProps[_k] !== undefined ) continue;
            const _fromEntity = entities.map(e => e[_k]).find(v => v !== undefined && v !== null);
            if( _fromEntity !== undefined ) entityOptions[_k] = _fromEntity;
        }

        // The graph's own type: 'bar' as soon as it holds a bar entity (its line entities
        // then drawn as curves over the bars), otherwise the entities' type
        if( type === 'line' || type === 'bar' )
            type = entities.some(e => e.type === 'bar') ? 'bar' : 'line';
        const _mixed = type === 'bar' && entities.some(e => e.type !== 'bar');
        entityOptions._mixed = _mixed;
        // The bar interval of the graph: the one asked for, else the one saved with its
        // entities (any of them — a line entity rebuilt last must not reset it), else the
        // configured one. Needed before the graph is built: it decides how bar entities
        // are drawn (bars, or raw curves for interval 4).
        const _graphInterval = interval ?? entities.map(e => e.interval).find(v => v !== undefined && v !== null)
            ?? entityOptions?.interval ?? this.pconfig.defaultInterval ?? 1;
        entityOptions._graphInterval = _graphInterval;

        const _graphHeight = _graphProps.height ?? entityOptions?.height;
        // (a mixed bar/line graph is sized like a line graph, plus the interval selector)
        const h = _mixed ? this.calcGraphHeight('line', entities.length, _graphHeight) + 24 : this.calcGraphHeight(type, entities.length, _graphHeight);

        const e = this._graphElement(type, h, _graphIndex, _graphInterval);

        let gl = this._this.querySelector('#graphlist');
        const _tgtDiv = ( before && before.canvas?.parentNode ) ? this.graphDiv(before) : null;
        if( _combineInsertBefore && (_combineGl ?? gl).contains(_combineInsertBefore) ) {
            (_combineGl ?? gl).insertBefore(e, _combineInsertBefore);
        } else if( _tgtDiv && _tgtDiv.parentNode ) {
            // Insert right before `before` — "the graph this one belongs right before".
            // `before` null (or no longer valid) falls through to the last-position
            // fallback below, same as "nothing after it, insert last".
            _tgtDiv.parentNode.insertBefore(e, _tgtDiv);
        } else {
            const _footer = this._footerAnchor(gl);
            if( _footer ) gl.insertBefore(e, _footer); else gl.appendChild(e);
        }

        // For bar graphs, connect the interval selector dropdown listener
        if( type == 'bar' && !this.ui.hideInterval )
            this._this.querySelector(`#bd-${this.g_id}`).addEventListener('change', this.selectBarInterval.bind(this));

        // Create the graph
        const _dynGid = this.g_id;
        this.addGraphToCanvas(this.newGraphId(), type, entities, entityOptions, isStatic);

        // Apply interval override if provided
        const _dynG = this.graphs.find(g => g.id === _dynGid);
        if( _dynG ) { this.updateGraphHeader(_dynG); this._showPlot(_dynG); }
        if( _dynG && interval !== null && interval !== undefined ) {
            _dynG.interval = interval;
            const _bd = this._this.querySelector(`#bd-${_dynGid}`);
            if( _bd ) _bd.value = interval;
        }

        // (the interval selector placed by the chart, in its top row)
        if( _dynG ) this.setTopControl(_dynG, this._this.querySelector(`#bd-${_dynGid}`));

        // Update mo/ca visibility based on graph count
        this._updateMoVisibility();
        this._updateGroupLinkMarkers();
    }

    // An entity's options in the graph of group groupId: from the lowest priority to the
    // highest, the card's defaults, entityOptions, the graph's own (YAML) options
    _optionsInGraph(entity_id, groupId)
    {
        const graphProps = (groupId !== null && this.pconfig.graphs[groupId]) ? this.pconfig.graphs[groupId] : {};
        // Only keys the graph actually sets: a plain spread would let every graph-level key
        // left unset in YAML (stored as undefined) wipe the matching entityOptions value.
        const _definedGraphProps = Object.fromEntries(Object.entries(graphProps).filter(([, v]) => v !== undefined));
        return { graphProps, options: { ...this.pconfig.cardGraphDefaults, ...this.getEntityOptions(entity_id), ..._definedGraphProps, groupId } };
    }

    // An entry's display settings it doesn't set itself: the color asked for (color, fill),
    // else the configuration's (colorSet), else the palette's; then each option from
    // entityOptions or the card's defaults. Returns the entry's own fill, as it was before
    // (an explicit per-entity fill always wins over the defaults and the palette's fill).
    _applyEntityDefaults(e, type, entityOptions, { color, fill, hidden })
    {
        const _ownFill = e.fill;

        e.color = e.color ?? "#000000";
        e.fill = e.fill ?? "#00000000";

        // (for every type — a timeline doesn't draw them, but they must round-trip through
        // drag, uncombine and type changes)
        if( color ) {
            e.color = color;
            // (its own fill, else the default one — the card's, its graph's or entityOptions')
            e.fill = fill ?? entityOptions?.fill ?? 'rgba(0,0,0,0)';
        } else if( entityOptions?.color ) {
            e.color = entityOptions?.color;
            e.fill = _ownFill ?? entityOptions?.fill ?? 'rgba(0,0,0,0)';
            e.colorSet = true;
        } else if( e.color === "#000000" ) {
            const c = this.getNextDefaultColor();
            e.color = c.color;
            e.fill = _ownFill ?? entityOptions?.fill ?? c.fill;
        }
        e.fill = fillValue(e.fill, e.color);
        // A color that isn't a constant (an entity's, thresholds) or isn't valid: the
        // palette's where none applies (see entityColor)
        if( !colorSpec(e.color)?.color )
            e.paletteColor = e.paletteColor ?? this.getNextDefaultColor().color;

        e.dashMode   = e.dashMode    ?? entityOptions?.dashMode ?? this.pconfig.defaultDashMode;
        e.width      = e.width       ?? entityOptions?.lineWidth ?? this.pconfig.defaultLineWidth;
        e.lineMode   = e.lineMode    ?? entityOptions?.lineMode ?? this.pconfig.defaultLineMode;
        // (interpolation: not defaulted here — only an explicit choice is kept on the entity,
        // its YAML entry or the Interpolation submenu, so that changing it on the card, a
        // graph or in entityOptions still applies to it; see resolveInterpolation)
        e.scale      = e.scale       ?? entityOptions?.scale;
        e.hidden     = hidden !== undefined ? hidden : (e.hidden ?? entityOptions?.hidden);
        e.netBars    = e.netBars     ?? entityOptions?.netBars ?? this.pconfig.defaultNetBars;
        e.showPoints = e.showPoints  ?? entityOptions?.showPoints ?? this.pconfig.defaultShowPoints;
        e.showMinMax = e.showMinMax  ?? entityOptions?.showMinMax ?? this.pconfig.defaultShowMinMax;
        e.name       = e.name        ?? entityOptions?.name;
        e.siConversionFactor = e.siConversionFactor ?? entityOptions?.siConversionFactor;
        e.unit       = e.unit        ?? entityOptions?.unit;
        e.process    = e.process     ?? entityOptions?.process;
        e.circular   = e.circular    ?? entityOptions?.circular;

        if( type == 'bar' ) {
            e.fill = e.color;
            e.lineMode = e.lineMode ?? entityOptions?.lineMode ?? 'lines';
        }

        return _ownFill;
    }

    // The graph an entry joins, if any:
    // - With an explicit groupId (static YAML graph, or any graph being rebuilt): the
    //   graph of that same group showing the same sub-graph (graphKey — see
    //   splitCurve) with a compatible type. Units are deliberately NOT checked here:
    //   the entities of one group are shown together by definition (a YAML graph is the
    //   author's explicit choice, a curve dropped there the user's), on two Y axes or one
    //   (see _assignYAxes). Only the type keeps them apart (a timeline or an arrowline
    //   can't share a chart) — those become linked graphs of the same group instead,
    //   re-combinable later.
    // - Dynamic with no groupId (brand-new entity from the UI): only the last graph is
    //   considered, joined if it has the same type and, for curves, compatible units
    //   (combineSameUnits)
    // Never a graph already showing its series (a curve once per graph) — but in its own
    // group, one already showing another curve of it (a copy: the same series several times
    // in a YAML graph, mini-graph-card's way — see keyOf)
    _combineTarget(e, type, groupId)
    {
        const _free = g => !g.entities.some(x => x.entity === e.entity);
        const _freeOfCurve = g => !g.entities.some(x => keyOf(x) === keyOf(e));
        if( groupId !== null )
            return this.graphs.filter(g => g.groupId === groupId && _freeOfCurve(g) && typesCompatible(g.type, type) && g.entities[0]?.graphKey === e.graphKey && this._sameSavedGraph(g.entities[0], e)).pop() ?? null;

        const _last = this.graphs[this.graphs.length - 1];
        return _last && _free(_last) && _last.type === type &&
               ( type == 'timeline' || this.pconfig.combineSameUnits && areSICompatible(this.getUnitOfMeasure(e.entity, e.unit), this.getUnitOfMeasure(_last.entities[0].entity, _last.entities[0].unit)) )
            ? _last : null;
    }

    // An entry joining graph g with a color another of its curves has: a free color of the
    // palette instead — only for a color the card picked: one the configuration sets
    // (colorSet) is kept. (Checked against the real target, whether or not the caller knew
    // it — e.g. a brand-new entity created from the type menu.)
    _freeColorIn(g, e, ownFill)
    {
        if( e.color === undefined || e.colorSet ) return;
        const _usedColors = g.entities.map(x => x.color);
        if( !_usedColors.includes(e.color) ) return;
        const _free = defaultColors.find(c => !_usedColors.includes(c.color));
        if( _free ) {
            e.color = _free.color;
            e.fill  = fillValue(ownFill, e.color) ?? _free.fill;
        }
    }

    // graphIndex of a new graph: a real number giving each graph's display order (1 =
    // topmost page-wide), tracked per entity (all entities of one displayed graph share the
    // same value) since there's no separate per-graph persisted structure. A new graph is
    // placed right before `before` (see addGraph's insertion) — its index is the average of
    // `before`'s index and its true on-screen previous neighbor's (0 if none, i.e. inserting
    // at the very top). `before` null means nothing follows: index is the last on-screen
    // graph's, rounded up, + 1 (or 1 if there are no graphs yet).
    _newGraphIndex(before)
    {
        if( before?.entities?.[0]?.graphIndex !== undefined ) {
            const _prevG = this.previousGraph(before);
            const _beforeIdx = _prevG?.entities?.[0]?.graphIndex ?? 0;
            return (_beforeIdx + before.entities[0].graphIndex) / 2;
        }
        const _all = this.graphsInDisplayOrder();
        const _lastIdx = _all[_all.length - 1]?.entities?.[0]?.graphIndex;
        return _lastIdx !== undefined ? Math.ceil(_lastIdx) + 1 : 1;
    }

    // Graph g's plot shown unless none of its curves is drawn (showGraph: false on each —
    // mini-graph-card's show.graph: false): its header and its values over it only
    _showPlot(g)
    {
        const _box = g.canvas?.parentNode;
        if( _box ) _box.style.display = g.entities.some(e => this.resolveOption(e, 'showGraph') !== false) ? '' : 'none';
    }

    // The element of a new graph (its header, canvas, interval selector),
    // not yet in the page
    _graphElement(type, h, graphIndex, graphInterval)
    {
        let html = '';
        // Spacing between graphs: a margin-top on this graph's own container unless it's
        // the very first one on the page — found by comparing its own graphIndex to the
        // current first graph's (this graph doesn't exist in this.graphs yet, so
        // _isFirstGraph itself doesn't apply here). Not by this.graphs.length (a transient
        // count during construction that doesn't reflect final display order — e.g.
        // rebuilding a graph in the middle of the page still finds this.graphs empty at
        // that moment). Also skipped if the previous graph has showTimeLabels === false.
        // A margin (not a <br> sibling) is structurally part of this graph's own div, so
        // it can never end up misplaced relative to it — same reasoning as the toolbar.
        const _currentFirst = this._firstGraph();
        const _isFirstOnPage = !_currentFirst || graphIndex <= (_currentFirst.entities?.[0]?.graphIndex ?? Infinity);
        const _prevG = _isFirstOnPage ? null : this.graphsInDisplayOrder().filter(g => (g.entities?.[0]?.graphIndex ?? Infinity) < graphIndex).pop();
        const _prevShowTimeLabels = _prevG ? (_prevG.showTimeLabels ?? true) : true;
        const _graphMarginTop = (!_isFirstOnPage && _prevShowTimeLabels !== false) ? 8 : 0;
        // Its header: its title, or its name and its icon (filled by updateGraphHeader)
        html += `<div class='hec-graph-header'></div>`;
        html += `<div style='height:${h}px;margin-top:${_graphMarginTop}px;position:relative'>`;
        html += `<canvas id="graph${this.g_id}" height="${h}px"></canvas>`;
        if( type == 'bar' && !this.ui.hideInterval )
            html += this.createIntervalSelectorHtml(this.g_id, graphInterval, this.ui.optionStyle);
        html += `</div>`;

        const e = document.createElement('div');
        e.innerHTML = html;
        return e;
    }

    // --------------------------------------------------------------------------------------
    // Rebuilding a graph
    // --------------------------------------------------------------------------------------

    // Builds one graph of group groupId from entities (in that order), right before graph
    // nextG (null: at the end) — combined into one graph whatever their units, each with its
    // persisted entry of that group, its color and fill. options: more addGraph options for
    // each (e.g. the graph's interval; fill: null to recompute it for a new type)
    rebuildGraph(entities, groupId, nextG, options = {})
    {
        const _saved = this.pconfig.combineSameUnits;
        this.pconfig.combineSameUnits = true;
        entities.forEach((en, i) => {
            const _pe = this.store.inGroup(keyOf(en), groupId);
            this.addGraph(en.entity, { noAutoGroup: i === 0, color: en.color, fill: en.fill, before: nextG, groupId, entry: _pe ?? en, ...options });
        });
        this.pconfig.combineSameUnits = _saved;
    }

    getNextDefaultColor()
    {
        let i = this.pconfig.nextDefaultColor++;
        this.pconfig.nextDefaultColor = this.pconfig.nextDefaultColor % defaultColors.length;
        return defaultColors[i];
    }

    // Builds every graph (static and dynamic) from the entity list (pconfig.entities), in
    // its order, then saves the result — at first display, and when the card goes back to
    // the YAML (defaultDisplay)
    buildGraphsFromStore()
    {
        // (the default colors given from the palette's start)
        this.pconfig.nextDefaultColor = 0;
        // Group by groupId, preserving first-occurrence order
        const _groupMap = new Map();
        const _groupOrder = [];
        for( let e of this.store.list ) {
            const _groupId = typeof e === 'object' ? e.groupId : undefined;
            const _key = _groupId ?? Symbol();
            if( !_groupMap.has(_key) ) {
                _groupMap.set(_key, { groupId: _groupId, entities: [] });
                _groupOrder.push(_key);
            }
            _groupMap.get(_key).entities.push(e);
        }
        // Sort each group's entities by their initial graphIndex — captured here,
        // before any recomputation — so a solid block of several linked graphs
        // (same groupId, different graphIndex) gets rebuilt in the order it was
        // actually displayed in, not pconfig.entities' array order (which must stay
        // untouched below for re-combine to keep working when a type becomes
        // compatible again). Stable sort: entities that already share one
        // graphIndex (one graph) keep their relative order.
        for( let _group of _groupMap.values() )
            _group.entities.sort((a, b) => (a.graphIndex ?? 0) - (b.graphIndex ?? 0));
        // Physically regroup the persisted list the same way — never interleaved
        // again, so its order stays the single source of truth for display order
        // everywhere else (neighbor lookups, graphIndex averaging).
        this.store.regroup();

        // Rebuild: call addGraph one entity at a time
        // For statics: force combineSameUnits (YAML author responsible for grouping)
        // For dynamics: combine logic in addGraph handles groupId + compatibility
        // The graphIndex each entity had when last saved, captured before addGraph
        // recomputes it: within a group, only entities that were shown in the same
        // graph are combined again (see addGraph). Statics never persist graphIndex,
        // so for them this is always undefined === undefined — graphKey decides.
        this._rebuildGraphIndex = new Map(this.store.list.map(e => [e, e.graphIndex]));
        for( let _key of _groupOrder ) {
            const _group = _groupMap.get(_key);
            const _isStaticGroup = _group.entities.some(e => e.isStatic);
            const _saved = this.pconfig.combineSameUnits;
            if( _isStaticGroup ) this.pconfig.combineSameUnits = true;
            // _group.entities is sorted by graphIndex above — walk it in that order
            // and always pass no `before`: addGraph's own combine logic
            // (matched by groupId) merges compatible entities regardless, and any
            // entity that can't combine simply becomes a new graph appended after
            // whatever's been built so far — correct precisely because we're
            // walking the group in its true display order already.
            _group.entities.forEach((_e) => {
                const _eid = entityIdOf(_e);
                this.addGraph(_eid, { color: _e.color, fill: _e.fill, hidden: _e.hidden, isStatic: _e.isStatic, interval: _e.interval, groupId: _group.groupId, entry: _e });
            });
            if( _isStaticGroup ) this.pconfig.combineSameUnits = _saved;
        }
        this._rebuildGraphIndex = null;
        // The rebuild just recomputed graphIndex (and default colors, etc.) fresh
        // from scratch — persist that result now rather than leaving storage stale
        // until some unrelated later action happens to call writeLocalState.
        this.writeLocalState();
    }

    // A graph whose Y axis lists entities (one row each), not values
    isRowGraph(g)
    {
        return g.type === 'timeline' || g.type === 'arrowline';
    }

    // Flags graphs — those already showing an entity being added again: a dashed red
    // outline (Chart.hecUi.outline), cleared 1.5 s after it's been seen — right away if
    // the graph is on screen, else once it scrolls into view, at the latest after 15 s.
    flagGraphs(graphs)
    {
        for( const g of graphs ) {
            const _w = g?.canvas?.parentNode;
            if( !_w ) continue;
            Chart.hecUi.outline(_w, false);
            const _clearSoon = () => setTimeout(() => Chart.hecUi.clearOutline(_w), 1500);
            const _r = _w.getBoundingClientRect();
            if( _r.top >= 0 && _r.bottom <= window.innerHeight ) { _clearSoon(); continue; }
            const _obs = new IntersectionObserver((entries) => {
                if( !entries[0].isIntersecting ) return;
                _obs.disconnect();
                clearTimeout(_late);
                _clearSoon();
            }, { threshold: 0.1 });
            const _late = setTimeout(() => { _obs.disconnect(); Chart.hecUi.clearOutline(_w); }, 15000);
            _obs.observe(_w);
        }
    }

    // During the initial rebuild only: were these two entities shown in the same graph when
    // last saved (same saved graphIndex)? Keeps apart graphs of one group that were apart —
    // e.g. dynamic entities that ended up sharing a group through an old migration bug
    // (null groupId renumbered to 1000), each in its own graph. Outside the rebuild,
    // always true: live operations only re-add entities that belong together.
    _sameSavedGraph(a, b)
    {
        // (static entities: graphKey alone decides — their graphIndex may be persisted for
        // some entities of a graph and not others, per-entity persistence options)
        if( !this._rebuildGraphIndex || a.isStatic || b.isStatic ) return true;
        return this._rebuildGraphIndex.get(a) === this._rebuildGraphIndex.get(b);
    }
}
