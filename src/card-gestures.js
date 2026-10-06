// What the gestures on the graphs mean (Chart.js detects them and says where they
// happen — deps/Chart Custom.js.md): clicks, menus, the time window moved and zoomed,
// curves, rows and graphs dragged, split and merged, or cut and pasted from the menus —
// and the entity moves these lead to (through the entity store). Part of
// HistoryCardState (added to it in history-explorer-card.js).

import { i18n } from "./languages.js";
const Chart = window.HXLocal_Chart;
const moment = window.HXLocal_moment;

export class CardGestures
{
    // --------------------------------------------------------------------------------------
    // Gestures on the graphs (deps/Chart Custom.js.md) — Chart.js detects every gesture and
    // resolves where it happens (zone, label, drop target, position along the time axis); the
    // card only decides what it means. It never reads a chart's layout.
    // --------------------------------------------------------------------------------------

    // customEvent: one method per gesture
    _onGesture(info)
    {
        const g = this.graphs?.find(g => g.chart === info.chart);
        if( !g ) return;
        // (during a cut: a click on a graph's button pastes; about halfway between two
        // buttons, nothing happens — aimed at one of them, the cut goes on; any other action
        // cancels it and goes on as usual — a hover doesn't)
        if( this._cut ) {
            const _action = ['click', 'dblclickdown', 'dblclick', 'longpress', 'dragstart'].includes(info.gestureType);
            if( info.handleButton || info.handleButtonBetween ) {
                if( info.gestureType === 'click' ) return info.handleButton && this._onCutButton(info, g, info.handleButton);
                // (a swipe on the buttons, whichever: up inserts above, down below)
                if( info.gestureType === 'dragend' ) return info.swipe && this._onCutButton(info, g, info.swipe === 'up' ? 'above' : 'below');
                if( _action ) return;
            }
            else if( _action ) this._endCut();
        }
        switch( info.gestureType ) {
            case 'click':         return this._onGraphClick(info, g);
            // (the second press of a double-click or of a tap-then-drag: the first
            // press's click was its first half, not a show/hide — undone)
            case 'dblclickdown':  return this._onGraphClick(info, g);
            case 'dblclick':      return this._onGraphDblClick(info, g);
            case 'longpress':     return this._onGraphLongPress(info, g);
            case 'dragstart':     return this._onDragStart(info, g);
            case 'dragmove':      return this._onDragMove(info, g);
            case 'dragovergraph': return this._onDragOver(info, g);
            case 'dragend':       return this._onDragEnd(info, g);
        }
    }

    // A graph whose Y axis lists entities (one row each), not values
    _isRowGraph(g)
    {
        return g.type === 'timeline' || g.type === 'arrowline';
    }

    // Click on a legend label: shows/hides its curve, persisted
    _onGraphClick(info, g)
    {
        const idx = info.legendIndex;
        if( idx < 0 ) return;
        const meta = g.chart.getDatasetMeta(idx);
        meta.hidden = meta.hidden === null ? !g.chart.data.datasets[idx].hidden : null;
        g.chart.update();
        const _hiddenState = meta.hidden !== null ? meta.hidden : g.chart.data.datasets[idx].hidden;
        const _e = this.store.entry(g.entities[idx].entity);
        if( _e ) _e.hidden = _hiddenState || undefined;
        this.writeLocalState();
    }

    // Double-click: on the chain icon, merges two linked graphs back into one; on a legend
    // label or a timeline row, takes that entity out into its own graph (see _uncombineEntity,
    // static graphs too)
    _onGraphDblClick(info, g)
    {
        if( info.zone === 'linkMarker' ) {
            this._mergeLinkedGraph(g, info);
            return;
        }
        const idx = info.legendIndex >= 0 ? info.legendIndex : this._isRowGraph(g) ? info.yAxisIndex : -1;
        if( idx >= 0 && this._canUncombine(g) ) this._uncombineEntity(g, idx);
    }

    // Long press on a label — or the browser's context menu: a right click, a tap with a
    // pen's button — the entity's type menu, under the label (line/bar: numeric entities only)
    // or level with the finger (timeline/arrowline row)
    _onGraphLongPress(info, g)
    {
        // (the lock+handle zone: the graph's menu)
        if( info.zone === 'lockAndHandle' )
            return this.showGraphMenu(0, g, info.clientX, info.clientY, info.yAxisLocked);
        const _r = info.labelRect;
        if( !_r ) return;
        if( info.legendIndex >= 0 && !this._isRowGraph(g) ) {
            const _entity = g.entities[info.legendIndex];
            if( _entity && this._isNumericEntity(_entity.entity) )
                this.showEntityTypeMenu(0, _entity.entity, g, _r.left + 30, _r.bottom);
        } else if( info.yAxisIndex >= 0 && this._isRowGraph(g) ) {
            const _entity = g.entities[info.yAxisIndex];
            if( _entity ) this.showEntityTypeMenu(0, _entity.entity, g, _r.left + 30, info.clientY);
        }
    }

    // A drag starts: a curve (legend label), a timeline row, a whole graph (lock+handle), or a
    // zoom selection (zoom mode, drawn by Chart.js) — the time pan is _onTimePan's.
    // this._drag: what is being dragged, until dragend.
    _onDragStart(info, g)
    {
        if( info.legendIndex >= 0 ) {
            this._drag = { kind: 'curve', g, idx: info.legendIndex };
        } else if( info.yAxisIndex >= 0 && this._isRowGraph(g) ) {
            this._drag = { kind: 'row', g, idx: info.yAxisIndex };
        } else if( info.zone === 'lockAndHandle' ) {
            this._drag = { kind: 'graph', g };
        } else {
            if( this.state.zoomMode ) g.chart.options.tooltips.enabled = false;
            return;
        }
        this._startAutoScroll(info.clientY);
    }

    // The drag moves (on its source graph g): the auto-scroll follows the pointer, and a
    // curve's source legend stays frozen (_freezeChart) while the pointer is over it — over
    // another graph, _onDragOver takes care of that graph's. (The drag's cursor and
    // insertion marker are Chart.js's, from the dropAllowed/insertionForbidden set there.)
    _onDragMove(info, g)
    {
        const d = this._drag;
        if( !d ) return;
        this._autoScrollY = info.clientY;
        if( d.kind === 'graph' || (info.overChart && info.overChart !== g.chart) ) return;
        if( info.overChart === g.chart && d.kind === 'curve' && info.zone === 'legend' )
            this._freezeChart(g);
        else
            this._unfreezeChart();
    }

    // The drag is over another graph g of this card: is a drop allowed there?
    _onDragOver(info, g)
    {
        const d = this._drag;
        if( !d || g === d.g ) return;
        if( d.kind === 'graph' ) {
            g.chart.options.insertionForbidden = this._wouldSplitGroup(d.g, g, info.insertBefore);
            return;
        }
        let _compatible;
        if( d.kind === 'curve' ) {
            _compatible = this._dropCompatibility(d.g, g, d.g.entities[d.idx]) === null;
            g.chart.options.dropAllowed = _compatible;
            if( info.zone !== 'legend' ) { this._unfreezeChart(); return; }
        } else {
            _compatible = this._dropCompatibility(d.g, g) === null;
            g.chart.options.dropAllowed = _compatible;
            if( !_compatible || info.yAxisIndex < 0 || info.zone !== 'yAxis' ) { this._unfreezeChart(); return; }
        }
        this._freezeChart(g);
    }

    // The drag ends: the drop (info.drop, resolved by Chart.js) or the zoom selection
    _onDragEnd(info, g)
    {
        const d = this._drag;
        if( !d ) {
            g.chart.options.tooltips.enabled = true;
            if( info.zoomSelectFactor0 !== undefined && info.zoomSelectFactor1 !== undefined )
                this._finalizeZoomSelection(info.zoomSelectFactor0, info.zoomSelectFactor1);
            return;
        }
        this._drag = null;
        this._stopAutoScroll();
        this._clearAllDragFeedback();
        const _drop = info.drop ?? { chart: null, index: -1, insertBefore: true };
        const _tgt = _drop.chart ? this.graphs.find(t => t.chart === _drop.chart) : undefined;
        if( d.kind === 'curve' ) this._finalizeLegendDrop(info, d.g, d.idx, _tgt, _drop);
        else if( d.kind === 'row' ) this._finalizeTimelineDrop(info, d.g, d.idx, _tgt, _drop);
        else this._finalizeGraphMove(info, d.g, _tgt, _drop);
    }

    // panX: a drag (or the fingers of a pinch) moves the time window — phase 'start', 'move'
    // (deltaFactor: in widths of the time axis, > 0 rightward, so towards the past) or 'end'.
    // While it moves, only the graph being dragged is redrawn, unless lockAllGraphs.
    _onTimePan(info)
    {
        if( info.phase === 'start' ) {
            const g = this.graphs.find(g => g.chart === info.chart);
            this.state.drag = true;
            this.state.updateCanvas = ( this.pconfig.lockAllGraphs || !g ) ? null : g.canvas;
            this._panRestMs = 0;
        } else if( !this.state.drag ) {
            return;
        } else if( info.phase === 'move' ) {
            // (the window starts on a whole second: the remainder carries over to the next move)
            const _ms = this._panRestMs - info.deltaFactor * this._timeRangeSeconds() * 1000;
            const _s = Math.trunc(_ms / 1000);
            this._panRestMs = _ms - _s * 1000;
            if( _s ) this._moveTimeWindow(moment(this.startTime).add(_s, "second"));
        } else {
            this.state.drag = false;
            this.state.updateCanvas = null;
            this.updateHistory();
            this.state.autoScroll = moment() <= moment(this.endTime);
        }
    }

    // zoomX: Ctrl+wheel or the spread of a pinch — one zoom step (+1 in, -1 out), like the
    // zoom buttons, around the time at centerFactor along the time axis
    _onTimeZoom(info)
    {
        if( this.state.loading || info.centerFactor === undefined ) return;
        const tc = this.factorToTimecode(info.centerFactor);
        if( info.step > 0 ) this.incZoomStep(tc, info.centerFactor); else this.decZoomStep(tc, info.centerFactor);
    }

    // Length of the time window, in seconds
    _timeRangeSeconds()
    {
        return 3600.0 * this.activeRange.timeRangeHours + 60.0 * this.activeRange.timeRangeMinutes;
    }

    // Moves the time window (same length) to start at t0, then redraws — fetching the newly
    // visible data, or only the axes while a fetch is already under way
    _moveTimeWindow(t0)
    {
        const t1 = moment(t0).add(this.activeRange.timeRangeHours, "hour").add(this.activeRange.timeRangeMinutes, "minute");
        this.startTime = moment(t0).format("YYYY-MM-DDTHH:mm:ss");
        this.endTime = t1.format("YYYY-MM-DDTHH:mm:ss");
        if( !this.state.loading )
            this.updateHistory();
        else
            this.updateAxes();
    }

    factorToTimecode(f)
    {
        return moment(this.startTime) + moment(this.endTime).diff(this.startTime) * f;
    }


    // A short message near a point (Chart.hecUi.showMessage), kept within the card
    _showLabelTooltip(label, clientX, clientY, align = 'left', anchorEl = document.body) {
        Chart.hecUi.showMessage(label, clientX, clientY, align, anchorEl, this._this?.querySelector('#maincard'));
    }

    _getScrollContainer() {
        return document.scrollingElement || document.documentElement;
    }

    // ── Drag visual feedback helpers ──────────────────────────────────────────

    // Flags graphs — those already showing an entity being added again: a dashed red
    // outline (Chart.hecUi.outline), cleared 1.5 s after it's been seen — right away if
    // the graph is on screen, else once it scrolls into view, at the latest after 15 s.
    _flagGraphs(graphs)
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

    // A curve (legend label _srcIdx of graph _src) dropped on graph _tgt (undefined: none),
    // next to its legend label drop.index — reordered within its own graph (on another of
    // its labels), or moved into another graph that can show it
    _finalizeLegendDrop(info, _src, _srcIdx, _tgt, drop)
    {
        if( !_tgt ) return;
        if( _tgt === _src ) {
            if( drop.index < 0 ) return;
        } else {
            const _refusal = this._dropCompatibility(_src, _tgt, _src.entities[_srcIdx]);
            if( _refusal !== null ) {
                this._showLabelTooltip(_refusal, info.clientX, info.clientY, 'left', _src.canvas);
                return;
            }
        }
        this._moveEntity(_src, _srcIdx, _tgt, this._dropInsertIndex(drop));
    }

    // A timeline row (_srcIdx of graph _src) dropped on graph _tgt (the source itself
    // included; undefined: none) — same type only — next to its nearest row drop.index
    _finalizeTimelineDrop(info, _src, _srcIdx, _tgt, drop)
    {
        if( !_tgt ) return;
        const _refusal = this._dropCompatibility(_src, _tgt);
        if( _refusal !== null ) {
            this._showLabelTooltip(_refusal, info.clientX, info.clientY, 'left', _src.canvas);
            return;
        }
        this._moveEntity(_src, _srcIdx, _tgt, this._dropInsertIndex(drop));
    }

    // Index in the target graph's entities where a dropped one goes (drop: dragend's, see
    // _onDragEnd), -1 for the end
    _dropInsertIndex(drop)
    {
        return drop.index >= 0 ? ( drop.insertBefore ? drop.index : drop.index + 1 ) : -1;
    }

    // Moves entity srcIdx of graph src to index insertIdx (-1: the end) of graph tgt's
    // entities — of every type, curve or row. Within one graph, only the order changes;
    // into another one, the entity joins that graph's group (and sub-graph), the source
    // is rebuilt without it (removed if it was its last) and the target with it.
    _moveEntity(src, srcIdx, tgt, insertIdx)
    {
        const _entity = src.entities[srcIdx];
        if( tgt === src ) {
            const _list = src.entities.filter((_, i) => i !== srcIdx);
            // (insertIdx counts the moved entity itself)
            const _at = insertIdx > srcIdx ? insertIdx - 1 : insertIdx;
            _list.splice(_at < 0 ? _list.length : _at, 0, _entity);
            const _groupId = this.store.groupIdOf(_list[0].entity);
            if( _groupId !== undefined ) this.store.setGraphOrder(_groupId, _list);
            // Rebuilt right where it was, even inside a block of several linked graphs
            const _nextG = this._nextGraph(src);
            this._detachGraph(src);
            this._rebuildGraph(_list, _groupId ?? null, _nextG);
        } else {
            const _sameGroup = this._sameGroup(src, tgt);
            // Each graph is rebuilt right where it was — before its own next graph, not its
            // next group: inside a block of several linked graphs, the block's order would
            // change. (Before the entity changes group: the display order is read from the
            // list's.)
            const _srcNext = this._nextGraph(src);
            const _entry = this.store.find(_entity.entity);
            const _tgtGroupId = this.store.groupIdOf(tgt.entities[0].entity);
            if( typeof _entry === 'object' && _tgtGroupId !== undefined ) {
                // A drop is saved only when both graphs' placements are (a YAML graph's isn't,
                // by default): otherwise the entity is saved where it was before
                // (unsavedFrom), so that a reload puts everything back as it was — no
                // duplicate, nothing lost. Dropped back in its own group, it's saved there.
                const _saved = ( this._graphPlacementPersisted(src) && this._graphPlacementPersisted(tgt) ) || _tgtGroupId === _entry.unsavedFrom?.groupId;
                if( _saved ) delete _entry.unsavedFrom;
                else _entry.unsavedFrom ??= this.store.placementOf(_entry);
                // Every other persisted field (type, lineMode, hidden...) stays
                this.store.moveToGroup(_entry, _tgtGroupId);
                // Joins the target's own sub-graph of that group (see _uncombineEntity)
                this._setGraphKey(_entry, tgt.entities[0].graphKey);
                _entry.color = _entity.color;
                _entry.fill = _entity.fill;
            }
            this._detachAndRebuildRemaining(src, srcIdx, _srcNext);
            _entity.siConversionFactor = undefined;
            tgt.entities.forEach(en => { en.siConversionFactor = undefined; });
            const _tgtNext = this._nextGraph(tgt);
            this._detachGraph(tgt);
            const _list = [...tgt.entities];
            _list.splice(insertIdx < 0 || insertIdx > _list.length ? _list.length : insertIdx, 0, _entity);
            this._rebuildGraph(_list, tgt.groupId, _tgtNext);
            if( _sameGroup ) this._syncGroupOrder(tgt.groupId);
        }
        // Persisted after the rebuild: the graphIndex addGraph computed is saved
        this.writeLocalState();
        this.updateHistory();
    }


    // Line and bar entities can share one graph (curves drawn over the bars); timeline and
    // arrowline graphs only ever hold their own type.
    _typesCompatible(a, b)
    {
        const _xy = t => t === 'line' || t === 'bar';
        return a === b || ( _xy(a) && _xy(b) );
    }

    // Same group of linked graphs (a static YAML graph split by double-click, or a group
    // split by a type change)?
    _sameGroup(a, b)
    {
        return a.groupId !== null && a.groupId !== undefined && a.groupId === b.groupId;
    }

    // Can one of src's entities be dropped onto another graph tgt? Returns null if so, or
    // the short text explaining why not (shown as a tooltip at the drop point). Whenever
    // the target graph can show it: curves and bars together, a timeline row on a timeline,
    // an arrowline row on an arrowline — whatever the units (two groups of units get an
    // axis each, more share one) and whichever graphs, YAML ones included (a drop onto a
    // graph whose placement isn't saved isn't saved either: see _moveEntity).
    _dropCompatibility(src, tgt, srcEntity = null)
    {
        // The dragged entity's own type (a bar graph can also hold line entities)
        const _srcType = srcEntity?.type ?? src.type;
        return this._typesCompatible(_srcType, tgt.type) ? null : `${_srcType} ≠ ${tgt.type}`;
    }

    _clearAllDragFeedback() {
        this._unfreezeChart();
    }

    _freezeChart(g) {
        if( this._frozenChart === g ) return;
        this._frozenChart = g || null;
    }

    _unfreezeChart() {
        this._frozenChart = null;
    }

    // Scrolls the page while a drag is near its top or bottom edge (_autoScrollY: the
    // pointer's clientY, kept up to date by the drag)
    _startAutoScroll(clientY) {
        this._stopAutoScroll();
        const _scroll = () => {
            if( !this._autoScrollActive ) return;
            const _container = this._getScrollContainer();
            if( !_container ) { this._autoScrollRaf = requestAnimationFrame(_scroll); return; }
            const _threshold = 80;
            const _y = this._autoScrollY;
            const _viewH = window.innerHeight;
            let _speed = 0;
            if( _y < _threshold )
                _speed = -Math.round((_threshold - _y) / 4);
            else if( _y > _viewH - _threshold )
                _speed = Math.round((_threshold - (_viewH - _y)) / 4);
            if( _speed !== 0 ) _container.scrollTop += _speed;
            this._autoScrollRaf = requestAnimationFrame(_scroll);
        };
        this._autoScrollActive = true;
        this._autoScrollY = clientY;
        this._autoScrollRaf = requestAnimationFrame(_scroll);
    }

    _stopAutoScroll() {
        this._autoScrollActive = false;
        if( this._autoScrollRaf ) { cancelAnimationFrame(this._autoScrollRaf); this._autoScrollRaf = null; }
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

    // Puts the pconfig.entities entries of one group in the order they're displayed in
    // (graph by graph down the block, then legend order), at the group's current place.
    // That order is what carries the layout of a block of linked graphs across reloads
    // and devices — graphIndex is only a live, per-device position (see readLocalState).
    _syncGroupOrder(groupId)
    {
        if( groupId === null || groupId === undefined ) return;
        this.store.syncGroupOrder(groupId, this._allGraphsInDisplayOrder().filter(g => g.groupId === groupId)
            .flatMap(g => g.entities.map(e => e.entity)));
    }

    // Something to uncombine: a static graph splits one of its own curves off (needs at
    // least two on this graph); a dynamic entity leaves its group (needs a group of two+).
    _canUncombine(g)
    {
        if( g.isStatic ) return g.entities.length > 1;
        return this.store.groupSize(g.groupId) > 1;
    }

    // A new sub-graph identifier within a group (see _uncombineEntity). Random rather than
    // a counter: it's persisted, and must never collide with one restored from storage.
    _newGraphKey()
    {
        return 'k' + Math.random().toString(36).slice(2, 10);
    }

    // Sets which sub-graph of its group an entity is shown in (undefined = the group's
    // main graph) — the property itself is removed rather than set to undefined, so the
    // persisted entry and the YAML-change detection mirror stay clean.
    _setGraphKey(entry, key)
    {
        if( key === undefined ) delete entry.graphKey;
        else entry.graphKey = key;
    }

    _uncombineEntity(g, idx)
    {
        // Extract one entity from a combined graph into its own graph.
        // Type-agnostic: used for line/bar legend double-click and timeline/arrowline label double-click.
        if( g.isStatic ) {
            // Static (YAML) graph: the curve moves into its own graph right below, but stays
            // in the same group (linked, chain icon) — only its sub-graph key changes. It can
            // be put back later by dragging its label onto a graph of the group, or by
            // double-clicking the chain icon (_mergeLinkedGraph).
            const _entity = g.entities[idx];
            _entity.siConversionFactor = undefined;
            this._setGraphKey(_entity, this._newGraphKey());
            // Forced visible — see the dynamic case below.
            _entity.hidden = undefined;
            const _nextG = this._nextGraph(g);
            this._detachAndRebuildRemaining(g, idx, _nextG);
            this.addGraph(_entity.entity, { noAutoGroup: true, color: _entity.color, fill: _entity.fill, before: _nextG, hidden: false, isStatic: true, groupId: g.groupId, entry: _entity });
            this._syncGroupOrder(g.groupId);
            this.writeLocalState();
            this.updateHistory();
            return;
        }
        const _entity = g.entities[idx];
        _entity.siConversionFactor = undefined;
        const _newGroupId = this.store.newGroupId();
        // Preserve all existing persisted fields (type, lineMode, interval, ...) —
        // only groupId/color/fill change on uncombine, EXCEPT hidden: what the user always
        // wants after taking a curve out is to SEE it, so it's forced visible.
        const _pcE = this.store.entry(_entity.entity);
        let _pcExtracted = null;
        if( _pcE ) {
            // Mutated in place: _entity/g.entities[idx] IS this same persisted entry
            _pcE.groupId = _newGroupId;
            this._setGraphKey(_pcE, undefined);
            _pcE.color = _entity.color;
            _pcE.fill = _entity.fill;
            _pcE.hidden = undefined;
            _pcExtracted = _pcE;
            // The entity's groupId just changed but it's still sitting at its old place in
            // the list — regroup now, before anything relies on the list's order (e.g.
            // finding the next graph below).
            this.store.regroup();
        }
        const _nextG = this._nextGroup(g);
        this._detachAndRebuildRemaining(g, idx, _nextG);
        // Extracted entity goes right before whatever followed the original graph g —
        // i.e. right after the just-rebuilt remaining-entities graph (addGraph inserting
        // before _nextG naturally lands it there).
        this.addGraph(_entity.entity, { noAutoGroup: true, color: _entity.color, fill: _entity.fill, before: _nextG, hidden: false, groupId: _newGroupId, entry: _pcExtracted ?? _entity });
        // Persist now — after the reconstruction, not before — so the freshly computed
        // graphIndex (and everything else addGraph resolved) is what actually gets saved.
        this.writeLocalState();
        this.updateHistory();
    }

    // Would inserting srcG right before/after tgtG (per _insertBefore) split a group of
    // linked graphs (same non-null groupId)? Groups are always consecutive by graphIndex
    // (the stable display-order field — see addGraph/_finalizeGraphMove), so this only has to
    // check the one neighbor on the insertion side, found via graphIndex order rather than
    // this.graphs' own (not guaranteed to already match it) array order.
    // Reordering srcG within its OWN group is allowed — only an outsider (a different
    // group, or no group) landing between two members of an existing group is forbidden.
    _wouldSplitGroup(srcG, tgtG, _insertBefore) {
        if( tgtG.groupId === null || tgtG.groupId === undefined ) return false;
        if( srcG.groupId === tgtG.groupId ) return false;
        const _sorted = [...this.graphs].sort((a, b) =>
            (a.entities?.[0]?.graphIndex ?? 0) - (b.entities?.[0]?.graphIndex ?? 0));
        const _tgtIdx = _sorted.indexOf(tgtG);
        const _neighbor = _insertBefore ? _sorted[_tgtIdx - 1] : _sorted[_tgtIdx + 1];
        if( !_neighbor || _neighbor === srcG ) return false;
        return _neighbor.groupId === tgtG.groupId;
    }

    // --------------------------------------------------------------------------------------
    // Cut and paste — what a drag does, from the menus
    // --------------------------------------------------------------------------------------

    // Cut: entity idx of graph g (from its type menu), or the whole graph g (idx null, from
    // its graph menu). Until it's pasted, every graph's lock+handle zone shows its buttons
    // (_cutButtons): a curve is pasted into a graph (📋), a graph inserted below (↓) or
    // above (↑) another one; the place it was cut from shows ✂. A click anywhere else, or
    // Escape, cancels.
    _startCut(g, idx = null)
    {
        this._endCut();
        this._cut = { g, idx };
        for( const _g of this.graphs ) {
            _g.chart.options.handleButtons = this._cutButtons(_g);
            _g.chart.update();
        }
        // (a press outside the graphs, or Escape — after the menu's own click is over)
        this._cutListeners = {
            pointerdown: (e) => { if( !this.graphs.some(_g => e.composedPath().includes(this._graphDiv(_g))) ) this._endCut(); },
            keydown: (e) => { if( e.key === 'Escape' ) this._endCut(); },
        };
        setTimeout(() => {
            if( !this._cut ) return;
            for( const t in this._cutListeners ) document.addEventListener(t, this._cutListeners[t], true);
        }, 0);
    }

    // The buttons of graph g's lock+handle zone during the cut: disabled (struck through)
    // where a drop would be refused
    _cutButtons(g)
    {
        const { g: src, idx } = this._cut;
        if( g === src ) return [{ id: 'cancel', text: '✂' }];
        if( idx !== null )
            return [{ id: 'paste', text: '📋', disabled: this._dropCompatibility(src, g, src.entities[idx]) !== null }];
        return [{ id: 'below', text: '↓', disabled: this._wouldSplitGroup(src, g, false) },
                { id: 'clipboard', text: '📋' },
                { id: 'above', text: '↑', disabled: this._wouldSplitGroup(src, g, true) }];
    }

    // Button id of graph g chosen during the cut (clicked, or swiped to): what was cut put
    // there, as a drop would (a disabled one says why, and the cut goes on)
    _onCutButton(info, g, id)
    {
        const { g: src, idx } = this._cut;
        const _btn = this._cutButtons(g).find(b => b.id === id);
        if( !_btn || id === 'clipboard' ) return;
        // (what was cut no longer shown — its graph deleted meanwhile)
        if( !this.graphs.includes(src) ) return this._endCut();
        if( _btn.disabled ) {
            const _why = idx !== null ? this._dropCompatibility(src, g, src.entities[idx]) : i18n('ui.menu.linked_graphs_split');
            return this._showLabelTooltip(_why, info.clientX, info.clientY, 'left', g.canvas);
        }
        this._endCut();
        if( id === 'cancel' ) return;
        if( id === 'paste' ) this._moveEntity(src, idx, g, -1);
        else this._finalizeGraphMove(info, src, g, { insertBefore: id === 'above' });
    }

    // The cut over: the graphs' zones back to their handle and padlock
    _endCut()
    {
        if( !this._cut ) return;
        this._cut = null;
        for( const t in this._cutListeners ?? {} ) document.removeEventListener(t, this._cutListeners[t], true);
        this._cutListeners = null;
        for( const _g of this.graphs ) {
            if( !_g.chart.options.handleButtons ) continue;
            _g.chart.options.handleButtons = null;
            _g.chart.update();
        }
    }

    // A zoom selection, between factor0 and factor1 along the time axis: the time range
    // becomes the nearest preset covering it, centred on it
    _finalizeZoomSelection(_factor0, _factor1)
    {
        let st0 = this.factorToTimecode(_factor0);
        let st1 = this.factorToTimecode(_factor1);
        if( st1 < st0 ) [st1, st0] = [st0, st1];

        const tm = (moment(st1) + moment(st0)) / 2;

        // Time delta in minutes
        const dt = moment.duration(st1 - st0).asMinutes();

        // Time delta in hours, ceiled
        let d = ( dt >= 60.0 ) ? Math.ceil(dt / 60.0) : 0;

        if( d < 12 ) {

            if( d < 1 )
                this.setTimeRangeMinutes(Math.ceil(dt), true, tm);
            else
                this.setTimeRange(d, true, tm);

        } else {

            d = Math.ceil(d / 24.0);

            if( d < 1 ) this.setTimeRange(12, true, tm); else       // 12 hours
            if( d < 2 ) this.setTimeRange(24, true, tm); else       // 1 day
            if( d < 3 ) this.setTimeRange(48, true, tm); else       // 2 days
            if( d < 4 ) this.setTimeRange(72, true, tm); else       // 3 days
            if( d < 5 ) this.setTimeRange(96, true, tm); else       // 4 days
            if( d < 6 ) this.setTimeRange(120, true, tm); else      // 5 days
            if( d < 7 ) this.setTimeRange(144, true, tm); else      // 6 days
            if( d < 13 ) this.setTimeRange(168, true, tm); else     // 1 week
            if( d < 20 ) this.setTimeRange(336, true, tm); else     // 2 weeks
            if( d < 28 ) this.setTimeRange(504, true, tm); else     // 3 weeks
            if( d < 45 ) this.setTimeRange(720, true, tm); else     // 1 month
            if( d < 105 ) this.setTimeRange(2184, true, tm); else   // 3 months
                          this.setTimeRange(4368, true, tm);        // 6 months

        }

        this.toggleZoom();
        this.writeLocalState();
    }

    // A graph (_srcG) dropped on graph _tgtG (undefined: none), above it (drop.insertBefore)
    // or below
    _finalizeGraphMove(info, _srcG, _tgtG, drop)
    {
        if( !_tgtG ) return;
        const _insertBefore = drop.insertBefore;

        if( this._wouldSplitGroup(_srcG, _tgtG, _insertBefore) ) {
            this._showLabelTooltip(i18n('ui.menu.linked_graphs_split'), info.clientX, info.clientY, 'left', _srcG.canvas);
            return;
        }

        // A graph belonging to a block of several linked graphs (same group) moved outside
        // of its own group takes the whole block along — a group always stays one solid,
        // contiguous block (moving it inside its own block is just an internal reorder).
        const _moved = ( this._sameGroup(_srcG, _srcG) && _tgtG.groupId !== _srcG.groupId )
            ? this._allGraphsInDisplayOrder().filter(g => g.groupId === _srcG.groupId)
            : [_srcG];

        // Reorder in DOM — re-query by ID to get fresh refs after potential HA re-render
        const _gl = this._this.querySelector('#graphlist');
        const _tgtCanvas = this._this.querySelector(`#graph${_tgtG.id}`);
        if( !_tgtCanvas || !_gl ) return;
        // Canvas -> position:relative div -> wrapper div (direct child of #graphlist)
        const _srcDivs = _moved.map(g => this._this.querySelector(`#graph${g.id}`)?.parentNode.parentNode);
        const _tgtDiv = _tgtCanvas.parentNode.parentNode;
        if( _srcDivs.some(d => !d || d.parentNode !== _gl) || _tgtDiv.parentNode !== _gl ) return;
        let _anchor;
        if( _insertBefore ) {
            _anchor = _tgtDiv;
        } else {
            _anchor = _tgtDiv.nextSibling;
            while( _anchor && _srcDivs.includes(_anchor) ) _anchor = _anchor.nextSibling;
            if( !_anchor || _anchor.parentNode !== _gl ) _anchor = this._footerAnchor(_gl);
        }
        for( const _div of _srcDivs ) {
            if( _anchor ) _gl.insertBefore(_div, _anchor); else _gl.appendChild(_div);
        }

        // Reorder in this.graphs
        this.graphs = this.graphs.filter(g => !_moved.includes(g));
        const _newTgtIdx = this.graphs.indexOf(_tgtG);
        this.graphs.splice(_insertBefore ? _newTgtIdx : _newTgtIdx + 1, 0, ..._moved);

        // The same move in the persisted list — never derived from this.graphs, only right
        // for the pair just moved. Before the graphIndex calculation below, which reads the
        // list's order.
        this.store.moveBefore(new Set(_moved.flatMap(g => g.entities.map(e => e.entity))),
            new Set(_tgtG.entities.map(e => e.entity)), _insertBefore);

        // graphIndex: same real-number ordering scheme as addGraph — look at the insertion
        // point (_tgtG, _insertBefore), not at _srcG (looking at _srcG's own neighbors
        // would just find the position its graphIndex was already computed at, so it could
        // never actually change).
        const _tgtPrev = this._previousGraph(_tgtG);
        const _tgtNext = this._nextGraph(_tgtG);
        const _prevG = _insertBefore ? _tgtPrev : _tgtG;
        const _nextGraphForIdx = _insertBefore ? _tgtG : _tgtNext;
        const _prevIdx = _prevG?.entities?.[0]?.graphIndex ?? 0;
        const _nextIdx = _nextGraphForIdx?.entities?.[0]?.graphIndex;
        const _newGraphIndex = _nextIdx !== undefined ? (_prevIdx + _nextIdx) / 2 : _prevIdx + 1;
        // A whole block moved: its graphs keep their own relative order (strictly increasing
        // from there, staying within half the gap — graphIndex only decides the order
        // inside a group, groups themselves follow pconfig.entities' order)
        const _step = ( _nextIdx !== undefined ? Math.abs(_nextIdx - _prevIdx) || 1 : 1 ) / (2 * (_moved.length + 1));
        _moved.forEach((g, k) => {
            for( let e of g.entities ) e.graphIndex = _newGraphIndex + k * _step;
        });
        this._syncGroupOrder(_srcG.groupId);
        this._updateGroupLinkMarkers();
        this.writeLocalState();
    }
}
