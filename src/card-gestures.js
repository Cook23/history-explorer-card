// What the gestures on the graphs mean (Chart.js detects them and says where they
// happen — deps/Chart Custom.js.md): clicks, menus, the time window moved and zoomed,
// curves, rows and graphs dragged, split and merged, or cut and pasted from the menus —
// and the entity moves these lead to (through the entity store). Part of
// HistoryCardState (added to it in history-explorer-card.js).

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
    onGesture(info)
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

    // Click on a legend label: shows/hides its curve, persisted; on the close button, the
    // graph removed
    _onGraphClick(info, g)
    {
        if( info.zone === 'closeButton' ) {
            if( info.gestureType === 'click' ) this.removeGraph(g);
            return;
        }
        // (a value — over the graph, or at the end of a legend label: the entity's dialog, on a
        // click; the curve stays as it is)
        if( info.zone === 'value' || info.legendPart === 'value' ) {
            const _curve = info.zone === 'value' ? info.curveIndex : info.legendIndex;
            if( info.gestureType === 'click' ) this._onValueClick(g.entities[_curve]);
            return;
        }
        const idx = info.legendIndex;
        if( idx < 0 ) return;
        this.toggleCurveHidden(g, idx);
    }

    // A click on entity e's value (in the legend, over the graph): its tapAction (see
    // tapActionOf) — more-info, the default: its dialog (openEntityInfo)
    _onValueClick(e)
    {
        const a = this.tapActionOf(e);
        switch( a.action ?? 'more-info' ) {
            case 'none':
                return;
            case 'navigate':
                if( !a.navigation_path ) return;
                history.pushState(null, '', a.navigation_path);
                window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
                return;
            case 'url':
                if( a.url_path ?? a.url ) window.open(a.url_path ?? a.url);
                return;
            case 'perform-action':
            case 'call-service': {
                const [_domain, _service] = String(a.perform_action ?? a.service ?? '').split('.');
                if( _domain && _service ) this._hass.callService(_domain, _service, a.data ?? a.service_data ?? {}, a.target);
                return;
            }
            default:
                this.openEntityInfo(e?.entity);
        }
    }

    // Home Assistant's dialog of an entity — with the card's info panel in it, when it's on —
    // from a click on its value (its tapAction, by default) or its menu's Info
    openEntityInfo(entityId)
    {
        if( !entityId ) return;
        const _e = new Event('hass-more-info', { bubbles: true, composed: true });
        _e.detail = { entityId };
        this._this.dispatchEvent(_e);
    }

    // Double-click: on the chain icon, merges two linked graphs back into one; on a legend
    // label or a timeline row, takes that entity out into its own graph (splitCurve, static
    // graphs too)
    _onGraphDblClick(info, g)
    {
        if( info.zone === 'linkMarker' ) return this._refused(this.mergeGraphUp(g), info, g);
        const idx = info.legendIndex >= 0 ? info.legendIndex : this.isRowGraph(g) ? info.yAxisIndex : -1;
        if( idx >= 0 && this.canSplitCurve(g) ) this.splitCurve(g, idx);
    }

    // An operation refused (its reason, else null): said where the gesture was, on graph g
    _refused(reason, info, g)
    {
        if( reason ) this.showMessage(reason, info.clientX, info.clientY, 'left', g.canvas);
    }

    // Long press on a label — or the browser's context menu: a right click, a tap with a
    // pen's button — the entity's type menu, under the label (line/bar: numeric entities only)
    // or level with the finger (timeline/arrowline row)
    _onGraphLongPress(info, g)
    {
        // (the lock+handle zone: the graph's menu)
        if( info.zone === 'lockAndHandle' )
            return this.showGraphMenu(0, g, info.clientX, info.clientY, info.yAxisLocked);
        // (on a curve: its samples' dots shown or hidden — about halfway between two curves,
        // or clearly beside them, nothing)
        if( info.zone === 'plot' )
            return info.curveIndex >= 0 && !this.isRowGraph(g) ? this.toggleCurvePoints(g, [g.entities[info.curveIndex]]) : undefined;
        const _r = info.labelRect;
        if( !_r ) return;
        if( info.legendIndex >= 0 && !this.isRowGraph(g) ) {
            const _entity = g.entities[info.legendIndex];
            if( _entity && this.isNumericEntity(_entity.entity) )
                this.showEntityTypeMenu(0, _entity.entity, g, _r.left + 30, _r.bottom);
        } else if( info.yAxisIndex >= 0 && this.isRowGraph(g) ) {
            const _entity = g.entities[info.yAxisIndex];
            if( _entity ) this.showEntityTypeMenu(0, _entity.entity, g, _r.left + 30, info.clientY);
        }
    }

    // A drag starts: a curve (legend label), a timeline row, a whole graph (lock+handle), or a
    // zoom selection (zoom mode, drawn by Chart.js) — the time pan is onTimePan's.
    // this._drag: what is being dragged, until dragend.
    _onDragStart(info, g)
    {
        if( info.legendIndex >= 0 ) {
            this._drag = { kind: 'curve', g, idx: info.legendIndex };
        } else if( info.yAxisIndex >= 0 && this.isRowGraph(g) ) {
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
            g.chart.options.insertionForbidden = this.graphMoveRefusal(d.g, g, info.insertBefore) !== null;
            return;
        }
        const _compatible = this.curveMoveRefusal(d.g, d.idx, g) === null;
        g.chart.options.dropAllowed = _compatible;
        if( d.kind === 'curve' ) {
            if( info.zone !== 'legend' ) { this._unfreezeChart(); return; }
        } else {
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
                this.zoomToSelection(info.zoomSelectFactor0, info.zoomSelectFactor1);
            return;
        }
        this._drag = null;
        this._stopAutoScroll();
        this._clearAllDragFeedback();
        const _drop = info.drop ?? { chart: null, index: -1, insertBefore: true };
        const _tgt = _drop.chart ? this.graphs.find(t => t.chart === _drop.chart) : undefined;
        if( !_tgt ) return;
        if( d.kind === 'graph' ) return this._refused(this.moveGraph(d.g, _tgt, _drop.insertBefore), info, d.g);
        // (a curve dropped on its own graph: only next to one of its labels — a row, anywhere)
        if( d.kind === 'curve' && _tgt === d.g && _drop.index < 0 ) return;
        this._refused(this.moveCurve(d.g, d.idx, _tgt, this._dropInsertIndex(_drop)), info, d.g);
    }

    // panX: a drag (or the fingers of a pinch) moves the time window — phase 'start', 'move'
    // (deltaFactor: in widths of the time axis, > 0 rightward, so towards the past) or 'end'.
    // While it moves, only the graph being dragged is redrawn, unless lockAllGraphs.
    // A pinch that starts in real time stays there when a finger starts or ends it on the
    // right of the plot area (see _keepsPresent): its end puts the present back on the right.
    onTimePan(info)
    {
        if( info.phase === 'start' ) {
            const g = this.graphs.find(g => g.chart === info.chart);
            this.state.drag = true;
            this.state.updateCanvas = ( this.pconfig.lockAllGraphs || !g ) ? null : g.canvas;
            this._panRestMs = 0;
            this._pinchLive = info.source === 'pinch' && this.isLive();
        } else if( !this.state.drag ) {
            return;
        } else if( info.phase === 'move' ) {
            // (the window starts on a whole second: the remainder carries over to the next move)
            const _ms = this._panRestMs - info.deltaFactor * this.timeRangeSeconds() * 1000;
            const _s = Math.trunc(_ms / 1000);
            this._panRestMs = _ms - _s * 1000;
            if( _s ) this.moveTimeWindow(moment(this.startTime).add(_s, "second"));
        } else {
            this.state.drag = false;
            this.state.updateCanvas = null;
            if( info.source === 'pinch' && this._pinchLive && this._keepsPresent(info) ) {
                this.today();
            } else {
                this.updateHistory();
            }
            this._pinchLive = false;
        }
    }

    // Does a zoom gesture keep the present on the right — in real time, with the pointer in
    // the right 10 % of the plot area (the wheel), or a finger in its right 20 % at the start
    // or now (a pinch)? Otherwise it zooms around its own point, and leaves real time.
    _keepsPresent(info)
    {
        const _edge = info.source === 'wheel' ? 0.9 : 0.8;
        return [...( info.startFactors ?? [] ), ...( info.pointerFactors ?? [] )].some(f => f >= _edge);
    }

    // zoomX: Ctrl+wheel or the spread of a pinch — one zoom step (+1 in, -1 out), like the
    // zoom buttons, around the time at centerFactor along the time axis
    // In real time, a wheel or a pinch that keeps the present (_keepsPresent) zooms keeping
    // the window's end; otherwise around its own point.
    onTimeZoom(info)
    {
        if( info.centerFactor === undefined ) return;
        const _live = info.source === 'pinch' ? this._pinchLive : this.isLive();
        const [tc, tp] = ( _live && this._keepsPresent(info) ) ? [this.presentTime(), 1.0] : [this.factorToTimecode(info.centerFactor), info.centerFactor];
        if( info.step > 0 ) this.incZoomStep(tc, tp); else this.decZoomStep(tc, tp);
    }


    // A short message near a point (Chart.hecUi.showMessage), kept within the card
    showMessage(label, clientX, clientY, align = 'left', anchorEl = document.body) {
        Chart.hecUi.showMessage(label, clientX, clientY, align, anchorEl, this._this?.querySelector('#maincard'));
    }

    _getScrollContainer() {
        return document.scrollingElement || document.documentElement;
    }

    // ── Drag visual feedback helpers ──────────────────────────────────────────

    // Index in the target graph's entities where a dropped one goes (drop: dragend's, see
    // _onDragEnd), -1 for the end
    _dropInsertIndex(drop)
    {
        return drop.index >= 0 ? ( drop.insertBefore ? drop.index : drop.index + 1 ) : -1;
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


    // --------------------------------------------------------------------------------------
    // Cut and paste — what a drag does, from the menus
    // --------------------------------------------------------------------------------------

    // Cut: entity idx of graph g (from its type menu), or the whole graph g (idx null, from
    // its graph menu). Until it's pasted, every graph's lock+handle zone shows its buttons
    // (_cutButtons): a curve is pasted into a graph (📋), a graph inserted below (↓) or
    // above (↑) another one; the place it was cut from shows ✂. A click anywhere else, or
    // Escape, cancels.
    startCut(g, idx = null)
    {
        this._endCut();
        this._cut = { g, idx };
        for( const _g of this.graphs ) {
            _g.chart.options.handleButtons = this._cutButtons(_g);
            _g.chart.update();
        }
        // (a press outside the graphs, or Escape — after the menu's own click is over)
        this._cutListeners = {
            pointerdown: (e) => { if( !this.graphs.some(_g => e.composedPath().includes(this.graphDiv(_g))) ) this._endCut(); },
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
            return [{ id: 'paste', text: '📋', disabled: this.curveMoveRefusal(src, idx, g) !== null }];
        return [{ id: 'below', text: '↓', disabled: this.graphMoveRefusal(src, g, false) !== null },
                { id: 'clipboard', text: '📋' },
                { id: 'above', text: '↑', disabled: this.graphMoveRefusal(src, g, true) !== null }];
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
        const _paste = () => id === 'paste' ? this.moveCurve(src, idx, g, -1) : this.moveGraph(src, g, id === 'above');
        if( _btn.disabled ) return this._refused(idx !== null ? this.curveMoveRefusal(src, idx, g) : this.graphMoveRefusal(src, g, id === 'above'), info, g);
        this._endCut();
        if( id !== 'cancel' ) this._refused(_paste(), info, g);
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

}
