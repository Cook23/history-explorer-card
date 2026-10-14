// The operations on what the card shows — every change of its composition: a curve or a
// row moved (in its graph, to another one), split off, merged back; a graph moved, merged
// with the one above, removed; curves added, one deleted, their type, their line mode,
// their interpolation, their points, a curve shown or hidden; a bar graph's interval; the
// default graphs and display brought back. Each one changes the entity list (the store),
// has the graphs rebuilt from it (card-graphs.js, card-charts.js), saved (card-storage.js)
// and their data asked again (card-history.js). The gestures, the menus, the selector and
// the toolbar only ask for them: none touches the page, a chart or the user's eyes — an
// operation that can't be done returns why (a text), for whoever asked to show it.
// Part of HistoryCardState (added to it in history-explorer-card.js).

import { i18n } from "./languages.js";
import { keyOf } from "./history-entity-store.js";
import { typesCompatible, RAW_INTERVAL } from "./history-options.js";

export class CardOperations
{
    // --------------------------------------------------------------------------------------
    // A curve or a timeline's row moved
    // --------------------------------------------------------------------------------------

    // Why entity idx of graph src can't go into graph tgt — null when it can: never into a
    // graph already showing its series (a curve once per graph); otherwise whenever tgt can
    // show it — curves and bars together, a timeline row on a timeline, an arrowline row on
    // an arrowline — whatever the units (two groups of units get an axis each, more share
    // one) and whichever graphs, YAML ones included (a move onto a graph whose placement
    // isn't saved isn't saved either: see moveCurve)
    curveMoveRefusal(src, idx, tgt)
    {
        const _e = src.entities[idx];
        if( tgt !== src && tgt.entities.some(e => e.entity === _e.entity) ) return i18n('ui.label.already_exists');
        // (its own type: a bar graph can also hold line entities)
        const _type = _e.type ?? src.type;
        return typesCompatible(_type, tgt.type) ? null : `${_type} ≠ ${tgt.type}`;
    }

    // Entity idx of graph src moved to index insertIdx (-1: the end) of graph tgt's — a
    // curve or a row. Within one graph, only the order changes; into another one, it joins
    // that graph's group (and sub-graph), the source rebuilt without it (removed if it was
    // its last) and the target with it. → its refusal (curveMoveRefusal), else null
    moveCurve(src, idx, tgt, insertIdx)
    {
        const _refusal = tgt === src ? null : this.curveMoveRefusal(src, idx, tgt);
        if( _refusal ) return _refusal;
        const _entity = src.entities[idx];
        if( tgt === src ) {
            const _list = src.entities.filter((_, i) => i !== idx);
            // (insertIdx counts the moved entity itself)
            const _at = insertIdx > idx ? insertIdx - 1 : insertIdx;
            _list.splice(_at < 0 ? _list.length : _at, 0, _entity);
            const _groupId = this.store.find(keyOf(_list[0]))?.groupId;
            if( _groupId !== undefined ) this.store.setGraphOrder(_groupId, _list);
            // Rebuilt right where it was, even inside a block of several linked graphs
            const _nextG = this.nextGraph(src);
            this.detachGraph(src);
            this.rebuildGraph(_list, _groupId ?? null, _nextG);
        } else {
            const _sameGroup = this.sameGroup(src, tgt);
            // Each graph is rebuilt right where it was — before its own next graph, not its
            // next group: inside a block of several linked graphs, the block's order would
            // change. (Before the entity changes group: the display order is read from the
            // list's.)
            const _srcNext = this.nextGraph(src);
            const _entry = this.store.find(keyOf(_entity));
            const _tgtGroupId = this.store.find(keyOf(tgt.entities[0]))?.groupId;
            if( typeof _entry === 'object' && _tgtGroupId !== undefined ) {
                // A move is saved only when both graphs' placements are (a YAML graph's isn't,
                // by default): otherwise the entity is saved where it was before
                // (unsavedFrom), so that a reload puts everything back as it was — no
                // duplicate, nothing lost. Moved back to its own group, it's saved there.
                const _saved = ( this.graphPlacementPersisted(src) && this.graphPlacementPersisted(tgt) ) || _tgtGroupId === _entry.unsavedFrom?.groupId;
                if( _saved ) delete _entry.unsavedFrom;
                else _entry.unsavedFrom ??= this.store.placementOf(_entry);
                // Every other persisted field (type, lineMode, hidden...) stays
                this.store.moveToGroup(_entry, _tgtGroupId);
                // Joins the target's own sub-graph of that group (see splitCurve)
                this.store.setGraphKey(_entry, tgt.entities[0].graphKey);
                _entry.color = _entity.color;
                _entry.fill = _entity.fill;
            }
            this.detachAndRebuildRemaining(src, idx, _srcNext);
            _entity.siConversionFactor = undefined;
            tgt.entities.forEach(en => { en.siConversionFactor = undefined; });
            const _tgtNext = this.nextGraph(tgt);
            this.detachGraph(tgt);
            const _list = [...tgt.entities];
            _list.splice(insertIdx < 0 || insertIdx > _list.length ? _list.length : insertIdx, 0, _entity);
            this.rebuildGraph(_list, tgt.groupId, _tgtNext);
            if( _sameGroup ) this._syncGroupOrder(tgt.groupId);
        }
        // Saved after the rebuild: the graphIndex addGraph computed is saved
        this.writeLocalState();
        this.updateHistory();
        return null;
    }

    // --------------------------------------------------------------------------------------
    // Linked graphs: a curve split off, a graph merged with the one above
    // --------------------------------------------------------------------------------------

    // Something to split off graph g: a static graph splits one of its own curves off
    // (needs at least two on this graph); a dynamic entity leaves its group (needs a group
    // of two+)
    canSplitCurve(g)
    {
        if( g.isStatic ) return g.entities.length > 1;
        return this.store.groupSize(g.groupId) > 1;
    }

    // Entity idx of graph g taken out into a graph of its own — of any type, shown (hidden
    // forced off: what one wants of a curve taken out is to see it)
    splitCurve(g, idx)
    {
        const _entity = g.entities[idx];
        _entity.siConversionFactor = undefined;
        if( g.isStatic ) {
            // A YAML graph: the curve moves into its own graph right below, but stays in the
            // same group (linked, chain icon) — only its sub-graph key changes. Put back later
            // by a drag onto a graph of the group, or a double-click on the chain icon
            // (mergeGraphUp).
            this.store.setGraphKey(_entity, this.store.newGraphKey());
            _entity.hidden = undefined;
            const _nextG = this.nextGraph(g);
            this.detachAndRebuildRemaining(g, idx, _nextG);
            this.addGraph(_entity.entity, { noAutoGroup: true, color: _entity.color, fill: _entity.fill, before: _nextG, hidden: false, isStatic: true, groupId: g.groupId, entry: _entity });
            this._syncGroupOrder(g.groupId);
        } else {
            // Every other saved field (type, lineMode, interval...) kept; its group, its
            // sub-graph, its colors and hidden change
            const _newGroupId = this.store.newGroupId();
            const _entry = this.store.entry(keyOf(_entity));
            if( _entry ) {
                // (_entity is that same entry, changed in place)
                _entry.groupId = _newGroupId;
                this.store.setGraphKey(_entry, undefined);
                _entry.color = _entity.color;
                _entry.fill = _entity.fill;
                _entry.hidden = undefined;
                // (its groupId just changed, at its old place in the list: regrouped before
                // anything reads the list's order — the next graph below)
                this.store.regroup();
            }
            const _nextG = this.nextGroup(g);
            this.detachAndRebuildRemaining(g, idx, _nextG);
            // (right after the remaining entities' graph just rebuilt)
            this.addGraph(_entity.entity, { noAutoGroup: true, color: _entity.color, fill: _entity.fill, before: _nextG, hidden: false, groupId: _newGroupId, entry: _entry ?? _entity });
        }
        // Saved after the rebuild: the graphIndex addGraph computed is saved
        this.writeLocalState();
        this.updateHistory();
    }

    // Graph g can be merged into the graph right above it: both of one group (linked), of
    // types one chart can hold together, whatever the units (see mergeGraphUp)
    canMergeGraphUp(g)
    {
        const _upper = this.previousGraph(g);
        return !!_upper && this.sameGroup(_upper, g) && typesCompatible(_upper.type, g.type);
    }

    // Graph g merged into the graph right above it, when both are of one group — the reverse
    // of a split or of a type change. → why not, when their types can't share a chart, else null
    mergeGraphUp(g)
    {
        const _upper = this.previousGraph(g);
        if( !_upper || !this.sameGroup(_upper, g) ) return null;
        if( !typesCompatible(_upper.type, g.type) ) return `${g.type} ≠ ${_upper.type}`;
        const _key = _upper.entities[0].graphKey;
        const _all = [..._upper.entities, ...g.entities];
        _all.forEach(en => { this.store.setGraphKey(en, _key); en.siConversionFactor = undefined; });
        const _groupId = _upper.groupId;
        const _nextG = this.nextGraph(g);
        this.detachGraph(_upper);
        this.detachGraph(g);
        this.rebuildGraph(_all, _groupId, _nextG);
        this._syncGroupOrder(_groupId);
        this.writeLocalState();
        this.updateHistory();
        return null;
    }

    // --------------------------------------------------------------------------------------
    // A graph moved, removed
    // --------------------------------------------------------------------------------------

    // Why graph src can't go right before (before) or after graph tgt — null when it can:
    // never between two graphs of a group it isn't part of (a group always stays one solid
    // block; reordering inside its own group is allowed). Groups are consecutive by
    // graphIndex: only the neighbor on the insertion side, in graphIndex order, is checked
    graphMoveRefusal(src, tgt, before)
    {
        if( tgt.groupId === null || tgt.groupId === undefined || src.groupId === tgt.groupId ) return null;
        const _sorted = [...this.graphs].sort((a, b) => (a.entities?.[0]?.graphIndex ?? 0) - (b.entities?.[0]?.graphIndex ?? 0));
        const _i = _sorted.indexOf(tgt);
        const _neighbor = before ? _sorted[_i - 1] : _sorted[_i + 1];
        return _neighbor && _neighbor !== src && _neighbor.groupId === tgt.groupId ? i18n('ui.menu.linked_graphs_split') : null;
    }

    // Graph src moved right before (before) or after graph tgt — with its whole block of
    // linked graphs when it leaves its group. → its refusal (graphMoveRefusal), else null
    moveGraph(src, tgt, before)
    {
        const _refusal = this.graphMoveRefusal(src, tgt, before);
        if( _refusal ) return _refusal;
        const _moved = ( this.sameGroup(src, src) && tgt.groupId !== src.groupId )
            ? this.graphsInDisplayOrder().filter(g => g.groupId === src.groupId)
            : [src];
        if( !this.placeGraphs(_moved, tgt, before) ) return null;
        // The same move in the saved list — never derived from this.graphs, only right for
        // the pair just moved. Before graphIndex below, which reads the list's order.
        this.store.moveBefore(new Set(_moved.flatMap(g => g.entities.map(keyOf))), new Set(tgt.entities.map(keyOf)), before);
        // graphIndex: as addGraph's — from the insertion point (tgt, before), not from src's
        // own neighbors (they'd give back the place it already had)
        const _prevG = before ? this.previousGraph(tgt) : tgt;
        const _nextG = before ? tgt : this.nextGraph(tgt);
        const _prevIdx = _prevG?.entities?.[0]?.graphIndex ?? 0;
        const _nextIdx = _nextG?.entities?.[0]?.graphIndex;
        const _index = _nextIdx !== undefined ? ( _prevIdx + _nextIdx ) / 2 : _prevIdx + 1;
        // (a whole block moved: its graphs keep their own order, strictly increasing from
        // there within half the gap — graphIndex only decides the order inside a group,
        // the groups follow the list's order)
        const _step = ( _nextIdx !== undefined ? Math.abs(_nextIdx - _prevIdx) || 1 : 1 ) / ( 2 * ( _moved.length + 1 ) );
        _moved.forEach((g, k) => { for( const e of g.entities ) e.graphIndex = _index + k * _step; });
        this._syncGroupOrder(src.groupId);
        this.refreshGraphControls();
        this.writeLocalState();
        return null;
    }

    // A graph added from the card removed, with its entities
    removeGraph(g)
    {
        for( const e of g.entities ) this.store.remove(e, true);
        this.removeGraphs([g]);
        this.refreshGraphControls();
        this.updateHistoryWithClearCache();
        this.writeLocalState();
    }

    // --------------------------------------------------------------------------------------
    // Curves added, deleted
    // --------------------------------------------------------------------------------------

    // Brand-new curves of series ids (a second curve of one already shown: in another
    // graph — see keyOf), as type (lineMode) — 'default': each one's own; a series that
    // isn't a number, always a timeline. → their names
    addCurves(ids, type, lineMode)
    {
        const _names = ids.map(id => {
            const _numeric = this.isNumericEntity(id);
            const _det = _numeric && type === 'default' ? this.detectDefaultType(id) : null;
            return this._addCurve(id, !_numeric ? 'timeline' : _det ? _det.type : type, !_numeric ? null : _det ? _det.lineMode : lineMode);
        });
        this.updateHistoryWithClearCache();
        this.writeLocalState();
        return _names;
    }

    // One brand-new curve of series id, as type (lineMode); → its name. (addGraph registers
    // its entry itself, adopting the group of the graph it joins, if any)
    _addCurve(id, type, lineMode)
    {
        const _entry = { type, lineMode };
        const _copy = this.store.newCopy(id);
        if( _copy ) _entry.copy = _copy;
        this.addGraph(id, { entry: _entry });
        const _g = this.graphs.find(g => g.entities.includes(_entry));
        if( _g && ( _g.groupId === null || _g.groupId === undefined ) ) {
            // (a brand-new graph: a group of its own)
            const _gid = this.store.newGroupId();
            _g.groupId = _gid;
            _g.entities.forEach(e => { e.groupId = _gid; });
        }
        return this.stateOf(id)?.attributes?.friendly_name || id;
    }

    // Entity idx of graph g deleted for good — its graph rebuilt with the others (removed
    // with its last one), its entry removed (not split off: splitCurve)
    deleteCurve(g, idx)
    {
        const _entity = this.detachAndRebuildRemaining(g, idx);
        this.store.remove(_entity);
        this.refreshGraphControls();
        this.writeLocalState();
        this.updateHistory();
    }

    // --------------------------------------------------------------------------------------
    // How curves are shown: their type, their line mode, their interpolation, their points,
    // a curve shown or hidden
    // --------------------------------------------------------------------------------------

    // Entity idx of graph g shown as type (lineMode), saved so: the same type, only its line
    // mode changes; another one, it leaves its graph for a graph of its own type in its
    // group (joining one there when it can), the others rebuilt in place
    setCurveType(g, idx, type, lineMode)
    {
        const _entity = g.entities[idx];
        const _entry = this.store.entry(keyOf(_entity));
        const _oldType = _entity.type ?? g.type;
        this._keepType([_entry], type, lineMode);
        if( _oldType === type ) {
            this.setLineMode(g, [idx], lineMode);
            this.updateHistory();
        } else {
            const _others = g.entities.filter((_, i) => i !== idx);
            _entity.siConversionFactor = undefined;
            _others.forEach(en => { en.siConversionFactor = undefined; });
            // (its group kept: it may join a graph of its new type there again)
            const _groupId = g.groupId;
            const _nextG = this.nextGroup(g);
            this.detachGraph(g);
            // (fill not kept across a type change: derived from color and type — recomputed)
            this.rebuildGraph(_others, _groupId, _nextG, { fill: null });
            this.addGraph(_entity.entity, { color: _entry?.color ?? _entity.color, before: _nextG, interval: _entity.interval, groupId: _groupId, entry: _entry ?? _entity });
            this._keepFill([_entity]);
            this.refreshGraphControls();
            this.updateHistoryWithClearCache();
        }
        this.writeLocalState();
    }

    // Every entity of graph g shown as type (lineMode), saved so — the graph rebuilt once,
    // in its place, when their types change
    setGraphType(g, type, lineMode)
    {
        const _sameType = g.entities.every(e => ( e.type ?? g.type ) === type);
        this._keepType(g.entities.map(e => this.store.entry(keyOf(e))), type, lineMode);
        if( _sameType ) {
            this.setLineMode(g, g.entities.map((e, i) => i), lineMode);
            this.updateHistory();
        } else {
            const _entities = g.entities;
            const _nextG = this.nextGraph(g);
            this.detachGraph(g);
            _entities.forEach(e => { e.type = type; e.lineMode = lineMode; e.siConversionFactor = undefined; });
            this.rebuildGraph(_entities, g.groupId, _nextG, { fill: null });
            this._keepFill(_entities);
            this.refreshGraphControls();
            this.updateHistoryWithClearCache();
        }
        this.writeLocalState();
    }

    // (the type and line mode saved in entries)
    _keepType(entries, type, lineMode)
    {
        for( const e of entries ) if( e ) { e.type = type; e.lineMode = lineMode; }
    }

    // (the fill each of entities was given for its new type — rebuilt — saved in its entry,
    // as the next rebuild reads it)
    _keepFill(entities)
    {
        for( const e of entities ) {
            const _entry = this.store.entry(keyOf(e));
            const _shown = this.graphs.flatMap(g => g.entities).find(x => keyOf(x) === keyOf(e));
            if( _entry && _shown ) _entry.fill = _shown.fill;
        }
    }

    // Entities of graph g drawn with the interpolation algorithm algo — those it applies to
    // (see isInterpolated) — saved so
    setInterpolation(g, entities, algo)
    {
        const _apply = entities.filter(e => this.isInterpolated(e, g));
        // (g.entities' are the store's own entries: saved with them)
        for( const e of _apply ) e.interpolation = algo;
        this.setCurvesInterpolation(g, _apply, algo);
        this.writeLocalState();
    }

    // The samples' dots of the curves among entities of graph g shown — or hidden when all
    // of them show theirs; saved as their showPoints
    toggleCurvePoints(g, entities)
    {
        const _curves = entities.filter(e => this.isCurve(g, g.entities.indexOf(e)));
        if( !_curves.length ) return;
        // (hidden: back to the hovered dot only — see _pointRadii)
        const _show = this.curvesShowPoints(g, _curves) ? 'hover' : true;
        for( const e of _curves ) e.showPoints = _show;
        this.showCurvePoints(g, _curves, _show);
        this.writeLocalState();
    }

    // Entity idx of graph g shown or hidden, the other way round — saved so
    toggleCurveHidden(g, idx)
    {
        const _hidden = this.toggleDatasetHidden(g, idx);
        const _e = this.store.entry(keyOf(g.entities[idx]));
        if( _e ) _e.hidden = _hidden || undefined;
        this.showValues(g);
        this.writeLocalState();
    }

    // --------------------------------------------------------------------------------------
    // A bar graph's interval
    // --------------------------------------------------------------------------------------

    // Bar graph g shown by interval (BAR_INTERVALS' code; RAW_INTERVAL: its values as they
    // are), saved on every entity of it — whichever is rebuilt first carries it. Their types
    // stay: raw only changes how bar entities are drawn, so an interval again makes them bars
    setBarInterval(g, interval)
    {
        const _wasRaw = g.interval == RAW_INTERVAL;
        g.interval = interval;
        for( const en of g.entities ) {
            const _e = this.store.entry(keyOf(en));
            if( _e ) _e.interval = interval;
        }
        // (bars <-> raw curves: rebuilt in place, each bar entity's dataset changing kind)
        if( _wasRaw !== ( interval == RAW_INTERVAL ) ) {
            const _nextG = this.nextGraph(g);
            const _entities = [...g.entities];
            this.detachGraph(g);
            this.rebuildGraph(_entities, g.groupId, _nextG, { interval });
        }
        this.updateHistory();
        this.writeLocalState();
    }

    // --------------------------------------------------------------------------------------
    // Back to the YAML
    // --------------------------------------------------------------------------------------

    // "Default graphs": the graphs added from the card removed — the YAML's kept as they
    // were changed from the card
    defaultGraphs()
    {
        this.removeGraphs(this.graphs.filter(g => !g.isStatic));
        this.store.removeAllDynamic();
        this.refreshGraphControls();
        this.writeLocalState();
    }

    // "Default display": back to the YAML — the graphs added from the card removed, every
    // change made from the card to the YAML's forgotten (their order, their types, colors,
    // splits, hidden curves, points…), the YAML's time range. Saved as any change: the last
    // one to speak, it reaches the other devices for what they share
    defaultDisplay()
    {
        this.removeGraphs([...this.graphs]);
        this.store.reset(JSON.parse(JSON.stringify(this._pureYamlEntities ?? [])));
        this.setTimeRangeFromString(this.pconfig.defaultTimeRange);
        this.setPresentWindow();
        this.buildGraphsFromStore();
        this.refreshGraphControls();
        this.updateHistoryWithClearCache();
    }

    // Another device spoke — Home Assistant's user data changed since this device last saw
    // it, read after the card was shown from this device's own (see readLocalState): what's
    // shown taken again from the saved state, as restore merges it
    async reloadSaved(restore)
    {
        this.removeGraphs([...this.graphs]);
        // (merged again from the YAML as it is, not from what the first merge made of it)
        this.store.reset(JSON.parse(JSON.stringify(this._pureYamlEntities ?? [])));
        await restore();
        this.showInfoPanelSwitch();
        this.setPresentWindow();
        this.buildGraphsFromStore();
        this.refreshGraphControls();
        this.updateHistoryWithClearCache();
    }

    // --------------------------------------------------------------------------------------

    // The entries of one group put in the order they're displayed in (graph by graph down
    // the block, then legend order), at the group's place. That order carries the layout
    // of a block of linked graphs across reloads and devices — graphIndex is only a live,
    // per-device position (see readLocalState).
    _syncGroupOrder(groupId)
    {
        if( groupId === null || groupId === undefined ) return;
        this.store.syncGroupOrder(groupId, this.graphsInDisplayOrder().filter(g => g.groupId === groupId).flatMap(g => g.entities.map(keyOf)));
    }
}
