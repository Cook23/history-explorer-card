/*!
 * HEC layer for Chart.js 2.7.1 — history-explorer-card
 * https://github.com/Cook23/history-explorer-card
 *
 * Everything this fork adds to Chart.js, in one place: hit-testing of labels and zones,
 * the gesture detector (customEvent, panX/zoomX), touch relay overlays, drag feedback,
 * the Y axis lock, and the shared UI utilities (Chart.hecUi). Loaded right after
 * deps/Chart.js, which keeps only small hooks calling into it (see "Hooks in the stock
 * code" in Chart Custom.js.md). The contract with the card is Chart Custom.js.md §0.
 */
(function () {
  'use strict';

  var Chart = window.HXLocal_Chart;
  var helpers = Chart.helpers;

  // ── Geometry primitives (no chart instance involved) ──

  // Picking what's under a pointer (a label, a button, a curve, a bar): the one the pointer
  // is on; else the nearest one, if it's near enough (within the pointer's immobility
  // distance — the gesture settings' slop, for a mouse or a pen, or for a finger), and not about
  // halfway between it and the next one — in the middle third between the two (the dead
  // zone: a third of the distance between them), where which one was aimed at can't be
  // told. A point clearly beside every candidate picks none (-1); in the dead zone, none
  // either, but told apart (PICK_BETWEEN). From above or below two close candidates, the
  // one on that side is picked, however close they are; two on top of each other (on the
  // same pixel) are one place: the first one — for curves, the one drawn over the other.
  var PICK_BETWEEN = -2;
  // The pointer type of the gesture being resolved (each event's, see _hecGestureHandler):
  // its immobility distance is the picking margin
  var pickPointerType = 'mouse';
  function _hecPickMargin() { return Chart.hecGestures(pickPointerType).slop; }
  function _hecPick(px, py, rects, margin) {
    return _hecPickNearest(rects.map(function (r) {
      var cx = Math.max(r.x, Math.min(px, r.x + r.width)), cy = Math.max(r.y, Math.min(py, r.y + r.height));
      return { d: Math.sqrt((cx - px) * (cx - px) + (cy - py) * (cy - py)), x: cx, y: cy };
    }), margin);
  }
  // The same rule, from each candidate's point nearest the pointer: { d (its distance to
  // the pointer), x, y }, or null (not a candidate); margin: the current pointer's by default
  function _hecPickNearest(cands, margin) {
    var best = -1, second = -1;
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (!c) continue;
      if (best < 0 || c.d < cands[best].d) { second = best; best = i; }
      else if (second < 0 || c.d < cands[second].d) { second = i; }
    }
    if (best < 0) return -1;
    var c1 = cands[best], c2 = second >= 0 ? cands[second] : null;
    var _gap = c2 ? Math.sqrt((c2.x - c1.x) * (c2.x - c1.x) + (c2.y - c1.y) * (c2.y - c1.y)) : Infinity;
    if (c1.d > (margin !== undefined ? margin : _hecPickMargin())) return -1;
    // (on the same pixel — less than one apart: one place, the first one)
    if (_gap < 1) return Math.min(best, second);
    return !c2 || c2.d - c1.d >= _gap / 3 ? best : PICK_BETWEEN;
  }

  // The point of the segment (ax, ay)-(bx, by) nearest (px, py): { d, x, y }
  function _hecSegmentNearest(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    var t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    var cx = ax + t * dx, cy = ay + t * dy;
    return { d: Math.sqrt((cx - px) * (cx - px) + (cy - py) * (cy - py)), x: cx, y: cy };
  }

  // ---------------------------------------------------------------------------
  // Curve interpolation — the dataset option `hecInterpolation` (Chart Custom.js.md §1),
  // used by the line controller's updateBezierControlPoints hook (§8) instead of
  // helpers.splineCurveMonotone when it names another algorithm than 'monotone'.
  // Tangents of a cubic Hermite curve through the points (x, y), by algorithm
  // (the card's `interpolation` option, besides Chart.js' own monotone one):
  // - steffen: monotone (no overshoot, flat only at the real extrema), slopes
  //   weighted by the spacing of the points (M. Steffen, 1990);
  // - makima: modified Akima — follows the local trend, flat over flat stretches,
  //   no flattening at each small peak, hardly any overshoot;
  // - catmullrom: the slope of the chord through both neighbours — the smoothest,
  //   may overshoot a little around sharp changes.
  helpers.hecSplineTangents = function (x, y, algo) {
    var n = x.length;
    var m = new Array(n).fill(0);
    if (n < 2) {
      return m;
    }
    var h = [], d = [], k;
    for (k = 0; k < n - 1; ++k) {
      h.push(x[k + 1] - x[k]);
      d.push(h[k] !== 0 ? (y[k + 1] - y[k]) / h[k] : 0);
    }
    if (n === 2) {
      return [d[0], d[0]];
    }
    var i;
    if (algo === 'catmullrom') {
      for (i = 1; i < n - 1; ++i) {
        var span = x[i + 1] - x[i - 1];
        m[i] = span !== 0 ? (y[i + 1] - y[i - 1]) / span : 0;
      }
      m[0] = d[0];
      m[n - 1] = d[n - 2];
    } else if (algo === 'steffen') {
      for (i = 1; i < n - 1; ++i) {
        var hs = h[i - 1] + h[i];
        var p = hs !== 0 ? (d[i - 1] * h[i] + d[i] * h[i - 1]) / hs : 0;
        m[i] = (Math.sign(d[i - 1]) + Math.sign(d[i])) * Math.min(Math.abs(d[i - 1]), Math.abs(d[i]), 0.5 * Math.abs(p));
      }
      m[0] = d[0];
      m[n - 1] = d[n - 2];
    } else {
      // makima: the slopes extended by two on each side (linear extrapolation)
      var dd = function (j) {
        if (j >= 0 && j < n - 1) {
          return d[j];
        }
        if (j === -1) {
          return 2 * d[0] - d[1];
        }
        if (j === -2) {
          return 2 * (2 * d[0] - d[1]) - d[0];
        }
        if (j === n - 1) {
          return 2 * d[n - 2] - d[n - 3];
        }
        return 2 * (2 * d[n - 2] - d[n - 3]) - d[n - 2];
      };
      for (i = 0; i < n; ++i) {
        var a = dd(i - 2), b = dd(i - 1), c = dd(i), e = dd(i + 1);
        var w1 = Math.abs(e - c) + Math.abs(e + c) / 2;
        var w2 = Math.abs(b - a) + Math.abs(b + a) / 2;
        m[i] = (w1 + w2) !== 0 ? (w1 * b + w2 * c) / (w1 + w2) : 0;
      }
    }
    return m;
  };
  // Bézier control points of the points, by algorithm (see hecSplineTangents),
  // computed separately for each run of points not skipped
  helpers.hecSplineCurve = function (points, algo) {
    var run = [];
    var flush = function () {
      var x = run.map(function (md) { return md.x; });
      var y = run.map(function (md) { return md.y; });
      var m = helpers.hecSplineTangents(x, y, algo);
      for (var i = 0; i < run.length; ++i) {
        var md = run[i], dx;
        if (i > 0) {
          dx = (md.x - run[i - 1].x) / 3;
          md.controlPointPreviousX = md.x - dx;
          md.controlPointPreviousY = md.y - dx * m[i];
        }
        if (i < run.length - 1) {
          dx = (run[i + 1].x - md.x) / 3;
          md.controlPointNextX = md.x + dx;
          md.controlPointNextY = md.y + dx * m[i];
        }
      }
      run = [];
    };
    for (var i = 0; i < (points || []).length; ++i) {
      var md = points[i]._model;
      if (md.skip) {
        flush();
      } else {
        run.push(md);
      }
    }
    flush();
  };

  // ---------------------------------------------------------------------------
  // Color steps — the dataset option `colorSteps` (Chart Custom.js.md §1): a line whose
  // color changes along the X axis. A list of { x, borderColor, backgroundColor }, sorted
  // by x: from each x on, until the next one, the line's stroke and fill take that step's
  // colors (one left undefined: the dataset's own). Chart.js 2.7 gives a line one stroke
  // and one fill color, so they become horizontal gradients with hard stops at the steps
  // — in pixels, hence rebuilt at each update (zoom, pan, resize); each point takes the
  // colors of its step (through its `custom` colors, which Chart.js also restores them
  // from after a hover; cleared before each update, set again after it).
  function _hecStepColors(ds, step) {
    return {
      border: step && step.borderColor !== undefined ? step.borderColor : ds.borderColor,
      fill: step && step.backgroundColor !== undefined ? step.backgroundColor : ds.backgroundColor };
  }

  Chart.plugins.register({
    id: 'hecColorSteps',
    beforeDatasetUpdate: function (chart, args) {
      (args.meta.data || []).forEach(function (pt) {
        if (!pt._hecStepColored) return;
        delete pt.custom.backgroundColor;
        delete pt.custom.borderColor;
        pt._hecStepColored = false;
      });
    },
    afterDatasetUpdate: function (chart, args) {
      var ds = chart.data.datasets[args.index];
      var steps = ds && ds.colorSteps;
      var meta = args.meta, line = meta.dataset, area = chart.chartArea;
      var xs = chart.scales[meta.xAxisID];
      if (!steps || !steps.length || !line || !line._model || !xs || !area || !(area.right > area.left)) return;
      var w = area.right - area.left;
      var px = steps.map(function (s) { return xs.getPixelForValue(s.x); });
      // (the colors at a pixel: those of the last step at or before it)
      var at = function (p) {
        var k = -1;
        while (k + 1 < px.length && px[k + 1] <= p) k++;
        return _hecStepColors(ds, steps[k]);
      };
      var stroke = chart.ctx.createLinearGradient(area.left, 0, area.right, 0);
      var fill = chart.ctx.createLinearGradient(area.left, 0, area.right, 0);
      var cur = at(area.left);
      stroke.addColorStop(0, cur.border);
      fill.addColorStop(0, cur.fill);
      for (var i = 0; i < px.length; i++) {
        var o = (px[i] - area.left) / w;
        if (o <= 0) continue;
        if (o >= 1) break;
        var next = _hecStepColors(ds, steps[i]);
        stroke.addColorStop(o, cur.border); stroke.addColorStop(o, next.border);
        fill.addColorStop(o, cur.fill); fill.addColorStop(o, next.fill);
        cur = next;
      }
      stroke.addColorStop(1, cur.border);
      fill.addColorStop(1, cur.fill);
      line._model.borderColor = stroke;
      line._model.backgroundColor = fill;
      (meta.data || []).forEach(function (pt) {
        if (!pt._model) return;
        var c = at(pt._model.x);
        pt.custom = pt.custom || {};
        pt.custom.backgroundColor = pt._model.backgroundColor = c.border;
        pt.custom.borderColor = pt._model.borderColor = c.border;
        pt._hecStepColored = true;
      });
    } });

  // ---------------------------------------------------------------------------
  // Samples shown — while _hecShowSamples is set (Alt held over the chart, see
  // _hecSetShowSamples), each sample of a curve is drawn as a dot of a diameter of the line
  // width + 2 px, the ones its dataset already shows keeping their own size; a point that
  // only shapes the curve (hecVirtual) stays hidden
  // The radius of a point not hovered: its own (radius, from the dataset), else — Alt held —
  // a sample's; one rule for every point shown, whether by Alt or by the dataset, also when
  // a point hovered goes back (the line controller's removeHoverStyle)
  Chart.hecSampleRadius = function (chart, pt, radius) {
    if (radius > 0 || !chart._hecShowSamples || !chart.getDatasetMeta(pt._datasetIndex).dataset) return radius;
    var _ds = chart.data.datasets[pt._datasetIndex] || {}, _d = (_ds.data || [])[pt._index];
    return _d && _d.hecVirtual ? radius : Chart.hecDotRadius(_ds);
  };
  // The radius of a dot shown by default on a curve (Alt's, the one hovered): a diameter of
  // its line width + 2 px
  Chart.hecDotRadius = function (ds) {
    return ((+ds.borderWidth || 0) + 2) / 2;
  };
  Chart.plugins.register({
    id: 'hecShowSamples',
    afterDatasetUpdate: function (chart, args) {
      if (!chart._hecShowSamples || !args.meta.dataset) return;
      (args.meta.data || []).forEach(function (pt) {
        if (pt._model) pt._model.radius = Chart.hecSampleRadius(chart, pt, pt._model.radius);
      });
    } });

  // ---------------------------------------------------------------------------
  // A value over the chart (hecSetValues): its text, its unit smaller, the time it's from
  // smaller still — { text, unit, time }
  function _hecValueHtml(s) {
    return s.text + (s.unit ? '<span style="font-size:0.5em;opacity:0.9"> ' + s.unit + '</span>' : '') +
      (s.time ? '<span class="hec-time" style="font-size:0.4em;opacity:0.75;margin-left:0.5em">' + s.time + '</span>' : '');
  }

  // ---------------------------------------------------------------------------
  // What a legend label shows after its name (legend item: hecValue — its value, '(400 W)' —
  // and hecMark — the right axis' '▸'), each after a space; '' without them
  Chart.hecLegendTail = function (it) {
    return (it.hecValue ? ' ' + it.hecValue : '') + (it.hecMark ? ' ' + it.hecMark : '');
  };

  // A chart's legend names fitted to room px each, with what follows them (legend.labels.
  // hecShortNames, see the legend's fit) — items: [{ name, tail, forms }], tail what the
  // label shows after its name (Chart.hecLegendTail), forms the name's shorter forms (least
  // shortened first) → the names. As they are when they all fit; else every name at the
  // same step — the first one at which they all fit; else, at the last step, the names
  // that still don't fit cut, '…' at their end — before a qualifier in parentheses at their
  // end ('(F)'), kept when there's room for it: it often is what tells two curves apart.
  // opts.formsOnly: null rather than a name cut
  Chart.hecFitLegendTexts = function (ctx, items, room, opts) {
    var fits = function (t) { return ctx.measureText(t).width <= room; };
    var parts = items.map(function (it) {
      return { tail: it.tail || '', steps: [String(it.name === undefined || it.name === null ? '' : it.name)].concat(it.forms || []) };
    });
    var at = function (p, k) { return p.steps[Math.min(k, p.steps.length - 1)]; };
    var _last = Math.max.apply(null, parts.map(function (p) { return p.steps.length - 1; }));
    for (var k = 0; k <= _last; k++) {
      if (parts.every(function (p) { return fits(at(p, k) + p.tail); })) return parts.map(function (p) { return at(p, k); });
    }
    if (opts && opts.formsOnly) return null;
    // (the longest start of base that fits with '…' then end then tail, or null)
    var cut = function (base, end, tail) {
      if (!fits(base.slice(0, 1) + '…' + end + tail)) return null;
      var lo = 1, hi = base.length - 1, best = 1;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        if (fits(base.slice(0, mid).trimEnd() + '…' + end + tail)) { best = mid; lo = mid + 1; } else hi = mid - 1;
      }
      return base.slice(0, best).trimEnd() + '…' + end;
    };
    return parts.map(function (p) {
      if (fits(at(p, _last) + p.tail)) return at(p, _last);
      var _base = p.steps[p.steps.length - 1];
      var _q = /\s*(\([^()]*\))$/.exec(_base);
      var _withQualifier = _q && _q.index > 0 ? cut(_base.slice(0, _q.index), ' ' + _q[1], p.tail) : null;
      return _withQualifier || cut(_base, '', p.tail) || _base.slice(0, 1) + '…';
    });
  };

  // ---------------------------------------------------------------------------
  // Y labels drawn inside the plot (ticks.mirror) with ticks.hecBackdrop: over the datasets,
  // each in a rounded box of the graph's background (hecUi.background, BOX_OPACITY: the
  // curves show through a little) — readable over the curves, as mini-graph-card's labels
  Chart.plugins.register({
    id: 'hecTickBackdrops',
    afterDatasetsDraw: function (chart) {
      var ctx = chart.ctx;
      helpers.each(chart.scales, function (scale) {
        var labels = scale._hecDeferredLabels;
        if (!labels || !labels.length) return;
        // (opaque while the pointer is near that axis' labels — _hecSetLabelsHovered)
        var _bg = hecUi.background(chart.canvas, chart._hecLabelsHovered === scale.position ? 1 : hecUi.BOX_OPACITY);
        // (the boxes drawn: a label whose box would touch one of them is skipped; kept on
        // the scale — the column of its labels, see _hecInsideLabelColumns)
        var _drawn = scale._hecLabelBoxes = [];
        ctx.save();
        labels.forEach(function (l) {
          var _text = helpers.isArray(l.label) ? l.label.join(' ') : String(l.label);
          if (_text === '' || _text === 'undefined') return;
          ctx.font = l.font;
          var w = ctx.measureText(_text).width, h = parseInt(l.font, 10) || 12;
          var padX = 4, padY = 1, bw = w + 2 * padX, bh = h + 2 * padY;
          var bx = l.align === 'left' ? l.x - padX : l.align === 'right' ? l.x - w - padX : l.x - w / 2 - padX;
          var by = l.baseline === 'middle' ? l.y - bh / 2 : l.baseline === 'top' ? l.y - padY : l.y - h - padY;
          // (kept within the plot: the top one never over the legend, the bottom one never
          // over the time labels)
          var _area = chart.chartArea, _dy = by < _area.top ? _area.top - by : by + bh > _area.bottom ? _area.bottom - by - bh : 0;
          by += _dy;
          var _ty = l.y + _dy;
          if (_drawn.some(function (d) { return by < d.y + d.h + 3 && by + bh + 3 > d.y && bx < d.x + d.w && bx + bw > d.x; })) return;
          _drawn.push({ x: bx, y: by, w: bw, h: bh });
          var r = bh / 2;
          ctx.beginPath();
          ctx.moveTo(bx + r, by);
          ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
          ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
          ctx.arcTo(bx, by + bh, bx, by, r);
          ctx.arcTo(bx, by, bx + bw, by, r);
          ctx.closePath();
          ctx.fillStyle = _bg;
          ctx.fill();
          ctx.fillStyle = l.color;
          ctx.textAlign = l.align;
          ctx.textBaseline = l.baseline;
          ctx.fillText(_text, l.x, _ty);
        });
        ctx.restore();
      });
    } });

  // ---------------------------------------------------------------------------
  // The dot of the value a hover is on (hover.dotOnHover, see _hecUpdateHoverDot): drawn
  // over the curves as its point would be if shown — its own style and border — at the size
  // of a dot shown by default
  Chart.plugins.register({
    id: 'hecHoverDot',
    afterDatasetsDraw: function (chart) {
      var el = chart._hecHoverDot;
      if (!el || !el._view) return;
      var ds = chart.data.datasets[el._datasetIndex] || {};
      chart.ctx.save();
      Chart.elements.Point.prototype.draw.call({ _chart: chart, _model: el._model,
        _view: Chart.helpers.extend({}, el._view, { radius: Chart.hecDotRadius(ds) }) });
      chart.ctx.restore();
    } });

  // ---------------------------------------------------------------------------
  // Cursor line — options.plugins.hecCursorLine { show, shared, color }: while the
  // pointer is over the plot area of a chart whose show is true, a vertical line under it
  // — on that chart, or with shared on every chart of its dragScope, at the same x
  Chart.plugins.register({
    id: 'hecCursorLine',
    afterInit: function (chart) {
      chart._hecCursorLine = { x: 0, draw: false };
    },
    afterEvent: function (chart, evt, opts) {
      if (!opts || !opts.show) return;
      var _a = chart.chartArea;
      var _line = { x: evt.x, draw: evt.x >= _a.left && evt.x <= _a.right && evt.y >= _a.top && evt.y <= _a.bottom };
      var _charts = [chart];
      if (opts.shared && Chart.instances) {
        _charts = [];
        for (var _cid in Chart.instances) {
          var _c = Chart.instances[_cid];
          if (_c === chart || (_c.canvas && _c.options.dragScope === chart.options.dragScope)) _charts.push(_c);
        }
      }
      _charts.forEach(function (c) { c._hecCursorLine = _line; c.draw(); });
    },
    afterDatasetsDraw: function (chart, easing, opts) {
      var _l = chart._hecCursorLine;
      if (!_l || !_l.draw) return;
      var ctx = chart.ctx, _a = chart.chartArea;
      ctx.save();
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = (opts && opts.color) || 'black';
      ctx.beginPath();
      ctx.moveTo(_l.x, _a.bottom);
      ctx.lineTo(_l.x, _a.top);
      ctx.stroke();
      ctx.restore();
    } });

  // ---------------------------------------------------------------------------
  // Min/max band — the dataset option showMinMax: between the yMin and yMax of its
  // points (those that have them, within the plot area), an area shaded in the
  // dataset's line color, on the dataset's own Y axis
  // (any CSS color — a name, #rgb, #rrggbb(aa), rgb(a)(), hsl(a)() — with that alpha; black otherwise)
  function hecColorWithAlpha(color, alpha) {
    var c = typeof color === 'string' ? helpers.color(color) : null;
    return c && c.valid ? c.alpha(alpha).rgbString() : 'rgba(0,0,0,' + alpha + ')';
  }
  Chart.plugins.register({
    id: 'hecMinMaxBand',
    afterDatasetsDraw: function (chart) {
      var ctx = chart.ctx, _a = chart.chartArea;
      var xScale = chart.scales['x-axis-0'];
      if (!xScale) return;
      chart.data.datasets.forEach(function (dataset, di) {
        if (!dataset.showMinMax) return;
        var yScale = chart.scales[chart.getDatasetMeta(di).yAxisID];
        var points = dataset.data;
        // (a dataset not filled yet holds {}, not a list)
        if (!yScale || !Array.isArray(points) || points.length < 2) return;
        var _clampY = function (v) { return Math.max(_a.top, Math.min(_a.bottom, yScale.getPixelForValue(v))); };
        var band = [];
        points.forEach(function (pt) {
          if (pt.yMin == null || pt.yMax == null) return;
          var px = xScale.getPixelForValue(pt.x);
          if (px < _a.left - 1 || px > _a.right + 1) return;
          band.push({ px: px, pyMin: _clampY(pt.yMin), pyMax: _clampY(pt.yMax) });
        });
        if (band.length < 2) return;
        ctx.save();
        ctx.beginPath();
        // (yMax from left to right, then yMin back: a closed polygon)
        ctx.moveTo(band[0].px, band[0].pyMax);
        for (var i = 1; i < band.length; i++) ctx.lineTo(band[i].px, band[i].pyMax);
        for (var j = band.length - 1; j >= 0; j--) ctx.lineTo(band[j].px, band[j].pyMin);
        ctx.closePath();
        ctx.fillStyle = hecColorWithAlpha(dataset.borderColor, 0.15);
        ctx.fill();
        ctx.restore();
      });
    } });

  // The area under a curve filled with its own color fading out downwards (dataset option
  // hecFillFade): a gradient over the plot area, made once its size is known (after the
  // layout, before the datasets take their colors)
  Chart.plugins.register({
    id: 'hecFillFade',
    afterLayout: function (chart) {
      var _a = chart.chartArea;
      if (!_a || !(_a.bottom > _a.top)) return;
      chart.data.datasets.forEach(function (dataset) {
        if (!dataset.hecFillFade) return;
        var g = chart.ctx.createLinearGradient(0, _a.top, 0, _a.bottom);
        g.addColorStop(0, hecColorWithAlpha(dataset.borderColor, 0.4));
        g.addColorStop(1, hecColorWithAlpha(dataset.borderColor, 0));
        dataset.backgroundColor = g;
      });
    } });

  // ---------------------------------------------------------------------------
  // Chart.hecUi — generic floating-element and highlight utilities. Public (see
  // "Shared UI utilities" in Chart Custom.js.md): this file's own tooltips and drag
  // feedback use them, and so does the card for its own menus and messages — one
  // implementation, where there used to be a copy on each side. Stateless: whatever
  // they keep is stored on the element they're given. They know nothing about the
  // card; the area a floating element must stay in is passed in by the caller.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // The two thresholds every gesture is told apart by, for a mouse or a pen and for a
  // finger (Chart.defaults.global.gestures — the same for every chart on the page):
  //   longPressMs — a press held this long is a long press; a second press within this
  //                 long of a release is a double-click, or a tap-then-drag; a tap keeps
  //                 the page from scrolling over a draggable zone this long after it;
  //   slop        — a pointer that moved more than this (px, x + y) is dragging; a second
  //                 press of a double-click lands within it of the first one.
  //                 Also how near a target must be to be picked (_hecPick).
  Chart.defaults.global.gestures = { mouse: { longPressMs: 500, slop: 8 }, touch: { longPressMs: 500, slop: 12 } };
  // The thresholds of a pointer type ('mouse', 'pen' — a mouse's —, 'touch')
  Chart.hecGestures = function (pointerType) {
    var g = Chart.defaults.global.gestures || {};
    return (pointerType === 'touch' ? g.touch : g.mouse) || { longPressMs: 500, slop: pointerType === 'touch' ? 12 : 8 };
  };

  var hecUi = Chart.hecUi = {

    // How long a floating element takes to fade out (its CSS opacity transition)
    FADE: 1000,

    // How opaque the boxes drawn over a graph are (the Y labels inside the plot, the controls
    // over the legend, a text shown in full): as the tooltip
    BOX_OPACITY: 0.8,

    // The background a graph is drawn on (el: an element in it), at opacity alpha (default
    // 1) — the color of the boxes drawn over it: the first ancestor's background that isn't
    // see-through (out of shadow roots too: the card's), else dark grey under a light text
    // (a dark theme), else white. A canvas can't use the theme's CSS variables.
    background: function (el, alpha) {
      var _rgb = null;
      for (var n = el; n && !_rgb; n = n.parentNode || n.host) {
        if (n.nodeType !== 1) continue;
        var m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(getComputedStyle(n).backgroundColor);
        if (m && (m[4] === undefined || +m[4] > 0)) _rgb = [m[1], m[2], m[3]];
      }
      if (!_rgb) {
        var t = el && el.nodeType === 1 ? /(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(getComputedStyle(el).color) : null;
        _rgb = t && +t[1] + +t[2] + +t[3] > 382 ? [28, 28, 28] : [255, 255, 255];
      }
      return 'rgba(' + _rgb.join(',') + ',' + (alpha === undefined ? 1 : alpha) + ')';
    },

    // How long a message stays up: 1 s, plus 0.5 s per word (isWord; words split on
    // spaces and underscores — entity ids read as words).
    readingTime: function (text) {
      var _words = String(text || '').split(/[\s_]+/).filter(hecUi.isWord).length;
      return 1000 + 500 * _words;
    },

    // The picking rule (_hecPick) on page elements — small buttons: of `elements`, the one
    // at client point (clientX, clientY), else the nearest one if near enough for
    // pointerType ('mouse', 'pen', 'touch') and not in the dead zone between two; → its
    // index, -1, or -2 (between two)
    pick: function (clientX, clientY, elements, pointerType) {
      return _hecPick(clientX, clientY, elements.map(function (el) {
        var r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      }), Chart.hecGestures(pointerType).slop);
    },

    // Is a piece of text (no space in it) a word? Two letters or digits at least — not a
    // single letter, a punctuation mark or a symbol on its own. Wherever words are counted.
    isWord: function (token) {
      return (String(token).match(/[a-zA-Z0-9]/g) || []).length >= 2;
    },

    // Nudges an already-positioned, already-visible floating element (menu, tooltip)
    // back inside bounds. Call once after display/left/top/bottom/transform are set:
    // it reads back the rendered box, so it works for position fixed or absolute,
    // anchored by top or bottom, with or without a CSS transform. Left/right/top: the
    // most restrictive of boundsEl and the viewport — never boundsEl alone (a card
    // that just mounted is still nearly empty, which would clamp into a tiny box),
    // never the viewport alone (the element would bleed onto the surrounding page).
    // Bottom: viewport only (boundsEl there is what caused the empty-card bug).
    // boundsEl null: viewport only.
    clampToViewport: function (el, boundsEl) {
      var _bR = boundsEl ? boundsEl.getBoundingClientRect() : null;
      var _r = el.getBoundingClientRect();
      // (an element wider than the bounds — a tooltip on a narrow card — kept within the
      // screen only: kept within the bounds, it would be pushed out on their other side)
      if (_bR && _r.width > Math.min(_bR.right, window.innerWidth) - Math.max(_bR.left, 0)) _bR = null;
      var _bounds = _bR
        ? { left: Math.max(_bR.left, 0), right: Math.min(_bR.right, window.innerWidth),
            top: Math.max(_bR.top, 0), bottom: window.innerHeight }
        : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
      var _dx = 0, _dy = 0;
      if (_r.right > _bounds.right) _dx = _bounds.right - _r.right;
      else if (_r.left < _bounds.left) _dx = _bounds.left - _r.left;
      if (_r.bottom > _bounds.bottom) _dy = _bounds.bottom - _r.bottom;
      else if (_r.top < _bounds.top) _dy = _bounds.top - _r.top;
      // (offsetLeft/offsetTop: the current rendered offset, explicit or from the flow)
      if (_dx) el.style.left = (el.offsetLeft + _dx) + 'px';
      if (_dy) {
        if (el.style.bottom !== '') el.style.bottom = (parseFloat(el.style.bottom) || 0) - _dy + 'px';
        else el.style.top = (el.offsetTop + _dy) + 'px';
      }
    },

    // Places a floating element against anchorEl's offsetParent (the positioned
    // ancestor the browser already resolved — never forcing position onto someone
    // else's container), so it scrolls with its anchor; document.body + fixed when
    // there's none. It closes by itself (closeFloating) when anchorEl disappears or is
    // hidden: a ResizeObserver reports a zero size then, with no help from anyone.
    attachFloating: function (el, anchorEl) {
      var _offsetParent = anchorEl.offsetParent;
      var _targetParent = _offsetParent || document.body;
      if (el.parentNode !== _targetParent) _targetParent.appendChild(el);
      var _wantPosition = _offsetParent ? 'absolute' : 'fixed';
      if (el.style.position !== _wantPosition) el.style.position = _wantPosition;
      if (el._hecObserverTarget !== anchorEl) {
        if (el._hecObserver) el._hecObserver.disconnect();
        el._hecObserverTarget = anchorEl;
        el._hecObserver = new ResizeObserver(function (entries) {
          var _box = entries[0].borderBoxSize && entries[0].borderBoxSize[0];
          var _w = _box ? _box.inlineSize : entries[0].contentRect.width;
          var _h = _box ? _box.blockSize : entries[0].contentRect.height;
          if (_w === 0 && _h === 0) hecUi.closeFloating(el);
        });
        el._hecObserver.observe(anchorEl);
      }
    },

    // (Re)shows el and arms its fade-out: fades in (the two opacity writes must land
    // in separate frames, or no transition), then startFade. With a third argument,
    // only a render that directly follows a real pointer gesture (justMoved === true)
    // may do so — a data refresh under a still pointer must not reopen a tooltip.
    armAutoFade: function (el, duration, justMoved) {
      if (arguments.length >= 3 && justMoved !== true) return;
      el.style.opacity = '0';
      requestAnimationFrame(function () { el.style.opacity = '1'; });
      hecUi.startFade(el, duration);
    },

    // Fades el out after duration — calling el._hecOnFade then, if its owner set one, for
    // what must go with it — then closes it.
    startFade: function (el, duration) {
      clearTimeout(el._hecFadeTimer);
      clearTimeout(el._hecRemoveTimer);
      el._hecFadeTimer = setTimeout(function () {
        el.style.opacity = '0';
        if (typeof el._hecOnFade === 'function') el._hecOnFade();
      }, duration);
      el._hecRemoveTimer = setTimeout(function () { hecUi.closeFloating(el); }, duration + hecUi.FADE);
    },

    // Removes el and its observer.
    closeFloating: function (el) {
      clearTimeout(el._hecFadeTimer);
      clearTimeout(el._hecRemoveTimer);
      if (el._hecObserver) el._hecObserver.disconnect();
      if (el.parentNode) el.remove();
    },

    // A short text message near a point — a refused drop, an entity already added, a
    // truncated label's full text: one element per document or shadow root (the
    // anchor's), reused, faded out after its readingTime. align: 'left' (default —
    // just right of and above the point), 'center' or 'right' (centered on / ending
    // at the point, above it). boundsEl: see clampToViewport. clientX null: centered over
    // anchorEl, halfway down
    showMessage: function (text, clientX, clientY, align, anchorEl, boundsEl) {
      anchorEl = anchorEl || document.body;
      if (clientX === null || clientX === undefined) {
        var _ar = anchorEl.getBoundingClientRect();
        clientX = _ar.left + _ar.width / 2; clientY = _ar.top + _ar.height / 2; align = 'center';
      }
      var _root = anchorEl.getRootNode ? anchorEl.getRootNode() : document;
      var _el = _root._hecMessageEl;
      if (!_el) {
        _el = document.createElement('div');
        _el.id = 'hec-label-tooltip';
        _el.style.cssText = 'z-index:9999;background:var(--card-background-color,#fff);color:var(--primary-text-color,#333);border:1px solid var(--divider-color,#ccc);border-radius:4px;padding:4px 8px;font-size:12px;line-height:normal;pointer-events:none;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2);transition:opacity 1.5s ease;opacity:0;';
        _root._hecMessageEl = _el;
      }
      hecUi.attachFloating(_el, anchorEl);
      _el.textContent = text;
      // fixed: against the viewport (client coordinates as they are); absolute:
      // against the parent it was actually attached to (see attachFloating)
      var _origin = (_el.style.position === 'fixed') ? { left: 0, top: 0 } : _el.parentNode.getBoundingClientRect();
      _el.style.left = (clientX - _origin.left + (align === 'center' || align === 'right' ? 0 : 10)) + 'px';
      _el.style.transform = align === 'center' ? 'translateX(-50%)' : align === 'right' ? 'translateX(-100%)' : '';
      _el.style.top = (clientY - _origin.top - 16) + 'px';
      hecUi.clampToViewport(_el, boundsEl);
      hecUi.armAutoFade(_el, hecUi.readingTime(text));
    },

    // Closes the message shown by showMessage in anchorEl's document or shadow root.
    closeMessage: function (anchorEl) {
      var _root = anchorEl && anchorEl.getRootNode ? anchorEl.getRootNode() : document;
      if (_root._hecMessageEl) hecUi.startFade(_root._hecMessageEl, 0);
    },

    // A text shown in full where it is shortened or hidden (a legend's label, a timeline's
    // row name or state): drawn over it, in its own font, in a box of the graph's background
    // as opaque as the Y labels' (background, BOX_OPACITY), from the same edge — r: { text, left, right, top,
    // bottom (client), align: 'left' | 'right', font }. sticky: kept while the pointer
    // hovers it (closeReveal), else faded out after its readingTime. One element per
    // document or shadow root (the anchor's), reused.
    reveal: function (r, sticky, anchorEl, boundsEl) {
      anchorEl = anchorEl || document.body;
      var _root = anchorEl.getRootNode ? anchorEl.getRootNode() : document;
      var _el = _root._hecRevealEl;
      if (!_el) {
        _el = document.createElement('div');
        _el.id = 'hec-reveal';
        _el.style.cssText = 'z-index:9999;pointer-events:none;white-space:nowrap;border-radius:6px;padding:0 4px;box-sizing:border-box;' +
          'color:var(--primary-text-color,#333);' +
          'box-shadow:0 1px 3px rgba(0,0,0,0.2);transition:opacity ' + hecUi.FADE / 1000 + 's ease;opacity:0;';
        _root._hecRevealEl = _el;
      }
      hecUi.attachFloating(_el, anchorEl);
      _el.textContent = r.text;
      _el.style.font = r.font;
      _el.style.background = hecUi.background(anchorEl, hecUi.BOX_OPACITY);
      // (a little room above and below its text)
      var _fm = /(\d+(?:\.\d+)?)px/.exec(r.font);
      var _h = Math.max(r.bottom - r.top, ( _fm ? parseFloat(_fm[1]) : 12 ) + 6);
      r = { text: r.text, font: r.font, align: r.align, left: r.left, right: r.right, top: (r.top + r.bottom - _h) / 2, bottom: (r.top + r.bottom + _h) / 2 };
      _el.style.lineHeight = _h + 'px';
      _el.style.height = _h + 'px';
      var _origin = (_el.style.position === 'fixed') ? { left: 0, top: 0 } : _el.parentNode.getBoundingClientRect();
      _el.style.top = (r.top - _origin.top) + 'px';
      _el.style.transform = '';
      // (its text where the shortened one starts: the box's padding before it)
      _el.style.left = (r.align === 'right' ? r.right + 4 - _el.offsetWidth : r.left - 4) - _origin.left + 'px';
      hecUi.clampToViewport(_el, boundsEl);
      clearTimeout(_el._hecFadeTimer);
      clearTimeout(_el._hecRemoveTimer);
      _el._hecSticky = !!sticky;
      // (kept while hovered: shown at once; else faded in and out — armAutoFade)
      _el.style.transition = sticky ? 'none' : 'opacity ' + hecUi.FADE / 1000 + 's ease';
      if (sticky) _el.style.opacity = '1';
      else hecUi.armAutoFade(_el, hecUi.readingTime(r.text));
    },

    // Closes the text shown in full by reveal (only the one kept while hovered, when sticky)
    closeReveal: function (anchorEl, sticky) {
      var _root = anchorEl && anchorEl.getRootNode ? anchorEl.getRootNode() : document;
      var _el = _root._hecRevealEl;
      if (_el && (!sticky || _el._hecSticky)) hecUi.closeFloating(_el);
    },

    // Outlines el (a graph's wrapper): solid primary color when valid, dashed error
    // color otherwise — that one fades out (over 1.5 s) once clearOutline is called.
    outline: function (el, valid) {
      if (!el) return;
      if (el._hecOutlined) hecUi.clearOutline(el, true);
      el._hecPrevOutline = el.style.outline;
      el._hecPrevOutlineOffset = el.style.outlineOffset;
      el._hecPrevTransition = el.style.transition;
      el._hecOutlined = true;
      var _color = valid ? 'var(--primary-color,#03a9f4)' : 'var(--error-color,#f44336)';
      el.style.transition = '';
      el.style.outline = '2px ' + (valid ? 'solid' : 'dashed') + ' ' + _color;
      el.style.outlineOffset = '-2px';
      if (!valid) requestAnimationFrame(function () { el.style.transition = 'outline-color 1.5s ease'; });
    },

    // Removes outline(el), fading it out if it was an invalid one (unless immediate).
    clearOutline: function (el, immediate) {
      if (!el || !el._hecOutlined) return;
      el._hecOutlined = false;
      var _restore = function () {
        el.style.outline = el._hecPrevOutline || '';
        el.style.outlineOffset = el._hecPrevOutlineOffset || '';
        el.style.transition = el._hecPrevTransition || '';
      };
      if (!immediate && el.style.transition && el.style.transition.indexOf('outline-color') >= 0) {
        el.style.outlineColor = 'transparent';
        setTimeout(function () { if (!el._hecOutlined) _restore(); }, 1500);
      } else {
        _restore();
      }
    }
  };

  // ── Gesture detection ──
  // One pointer or wheel event is handled with its context c = { me (the chart), e (the
  // event, Chart.js's), gs (the chart's gesture state, kept between events), cfg (timing
  // constants), pid (pointer id), pointerType }: _hecGestureHandler builds it and calls
  // the function of the event's type below; everything they share takes c.

  // Drag/gesture handlers — per Thierry's explicit instruction, ALL
  // 2-finger and 1-finger drag gestures are handled uniformly through
  // this single table, replacing what used to be a scattered if/else-if
  // chain spread across mousedown, dragstart, and dragmove (plus pinch
  // as an entirely separate branch). Order is significant — this array
  // IS the priority order when more than one handler's test would pass.
  // Most handlers' test(p) runs once at dragstart (p = the pending
  // gesture object, x0/y0 already set) and returns truthy to claim the
  // drag; onMove(p, e) runs on every subsequent dragmove for whichever
  // handler won. The one exception is 'pinch' (see its own comment
  // below) — its test is re-evaluated on every mousemove instead, since
  // a 2-finger gesture has no single dragstart threshold moment. No
  // handler knows about any other.
  var HEC_DRAG_HANDLERS = [
    {
      // Pinch (2 fingers) — structurally different trigger from every
      // other handler below (gs.count===2, re-tested on every
      // mousemove, not a single x0/y0 origin tested once past a 10px
      // threshold), since a pinch has no single starting point the way
      // a 1-finger drag does. Still folded into this same table (per
      // Thierry) rather than left as a separately-scattered branch —
      // same test/onMove shape, just evaluated differently. Always
      // first: mousedown already nulls gs.pending the instant a second
      // finger arrives, so this always wins outright once active.
      name: 'pinch',
      test: function (c, p) { return !!c.gs.pinch; },
      onMove: function (c, p, e) {
        var me = c.me, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
        var pinch = gs.pinch;
        if (pid == pinch.p1id) pinch.p1 = { x: e.x, y: e.y };
        else pinch.p2 = { x: e.x, y: e.y };
        schedulePinch(c, pinch);
      }
    },
    {
      name: 'yAxisPan',
      test: function (c, p) {
        var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
        if (me.options.yAxisPanEnabled === false || !me.chartArea) return false;
        var _axes = me._hecValueYAxes();
        if (!_axes.length) return false;
        // On an axis' label column, that axis; anywhere with Shift, every axis
        var _side = me._hecYAxisSideAt(p.x0, p.y0);
        // (its labels drawn inside the plot: near them — a finger's or a pen's drag only
        // after a tap, a second press right away (dblclickdown engages the lock); a long
        // press there is the curves')
        var _inside = !_side && me._hecInsideLabelSideAt(p.x0, p.y0, p.pointerType);
        if (_inside) {
          if (p.pointerType !== 'mouse' && !me._hecYAxisLock) return false;
          _side = _inside;
        }
        var _shiftKey = p.native ? p.native.shiftKey : false;
        if (!_shiftKey && !_side) return false;
        // On touch, entering the Y-axis zone alone isn't enough — the
        // long-press must have already fired (unless the lock is already
        // engaged), so a normal page scroll starting in that zone isn't
        // mistaken for an axis drag. Mouse/pen activate immediately.
        if (_side && !_inside && !_shiftKey && p.pointerType === 'touch' && !me._hecYAxisLock && !p.longPressFired) return false;
        p.dragYRanges = me._hecYRanges();
        p.dragYAxes = _axes.map(function (a) { return _shiftKey || a.side === _side; });
        p.dragShiftKey = _shiftKey;
        // (with Shift, the graph moves both ways: the time too, as a plain drag moves it)
        if (_shiftKey) panX(c, 'start');
        return true;
      },
      onMove: function (c, p, e) {
        var me = c.me;
        if (p.dragShiftKey) panX(c, 'move', e.x - p.lastX);
        var _h = me.chartArea.bottom - me.chartArea.top;
        me._hecSetYRanges(p.dragYRanges.map(function (r, i) {
          if (!p.dragYAxes[i]) return undefined;
          var _d = (e.y - p.y0) * (r[1] - r[0]) / _h;
          return [r[0] + _d, r[1] + _d];
        }));
      }
    },
    {
      name: 'legendDrag',
      test: function (c, p) {
        var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
        var _idx = legendIndexAt(c, p.x0, p.y0);
        if (_idx < 0) return false;
        p.dragLegendIdx = _idx;
        var _box = me.legend && me.legend.legendHitBoxes && me.legend.legendHitBoxes[_idx];
        var _color = me.data.datasets[_idx] && me.data.datasets[_idx].borderColor || null;
        var _text = me.legend && me.legend.legendItems && me.legend.legendItems[_idx] && me.legend.legendItems[_idx].text || '';
        p.dragColor = _color;
        me._hecShowDragGhost(_text, _box && _box.width, _box && _box.height, p.native ? p.native.clientX : undefined, p.native ? p.native.clientY : undefined, 'center', _color);
        return true;
      },
      onMove: function (c, p, e) {
        var me = c.me, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
        _hecDragMoveTick(c, p, e);
        var _found = me._hecFindLegendLabel(e.x, e.y, p.dragLegendIdx, true);
        if (_found && me.canvas) {
          var _mr = me.canvas.getBoundingClientRect();
          me._hecShowInsertionMarker(_mr.left + _found.markerX + 2, _mr.top + _found.markerY, 3, _found.markerH, false, p.dragColor);
        } else {
          me._hecHideInsertionMarker();
        }
        _hecCrossGraphDragFeedback(c, p, e);
      }
    },
    {
      name: 'timelineDrag',
      test: function (c, p) {
        var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
        if (me.config.type !== 'timeline' && me.config.type !== 'arrowline') return false;
        var _idx = yAxisIndexAt(c, p.x0, p.y0);
        if (_idx < 0) return false;
        p.dragYIdx = _idx;
        var _lbl = me.data.labels[_idx];
        var _labelStr = Array.isArray(_lbl) ? _lbl.join(' ') : _lbl;
        var _labelW = me.chartArea ? me.chartArea.left : 100;
        me._hecShowDragGhost(_labelStr, _labelW, 20, p.native ? p.native.clientX : undefined, p.native ? p.native.clientY : undefined, 'center', null);
        return true;
      },
      onMove: function (c, p, e) {
        var me = c.me, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
        _hecDragMoveTick(c, p, e);
        var _mr2 = me.canvas.getBoundingClientRect();
        var _at = me._hecYAxisInsertAt(e.y, p.dragYIdx, false);
        if (_at) me._hecShowInsertionMarker(_mr2.left, _mr2.top + _at.markerY, _mr2.width, 3, true);
        else me._hecHideInsertionMarker();
        _hecCrossGraphDragFeedback(c, p, e);
      }
    },
    {
      name: 'zoomSelect',
      test: function (c, p) {
        var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
        return me.options.zoomSelectMode === true && me.chartArea &&
          p.x0 > me.chartArea.left && p.x0 < me.chartArea.right;
      },
      onMove: function (c, p, e) {
        var me = c.me, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
        if (!me.chartArea) return;
        var _zX1 = Math.max(Math.min(e.x, me.chartArea.right), me.chartArea.left);
        p.dragZoomSelectX1 = _zX1;
        me._hecShowZoomSelection(p.x0, _zX1);
      }
    },
    {
      // A swipe starting on a button of options.handleButtons (§1): reported at its end,
      // up or down (dragend's swipe, with that button) — nothing drawn meanwhile
      name: 'handleSwipe',
      test: function (c, p) { return !!c.me._hecHandleButtonAt(p.x0, p.y0); },
      onMove: function () {}
    },
    {
      name: 'lockAndHandle',
      test: function (c, p) {
        var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
        var _inZone = me._hecInLockAndHandleZone(p.x0, p.y0) && !me._hecHandleButtons();
        if (!_inZone) return false;
        var _gRect = me.canvas.getBoundingClientRect();
        me._hecShowDragGhost('', _gRect.width, _gRect.height, p.native ? p.native.clientX : undefined, p.native ? p.native.clientY : undefined, 'topleft', null);
        return true;
      },
      onMove: function (c, p, e) {
        var me = c.me, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
        _hecDragMoveTick(c, p, e);
        if (e.native && e.native.clientX !== undefined) {
          var _hOther = me._hecFindInstanceAt(e.native.clientX, e.native.clientY);
          if (_hOther) {
            var _hr = _hOther.canvas.getBoundingClientRect();
            var _hInsertBefore = e.native.clientY < _hr.top + _hr.height / 2;
            // (the card decides there whether that place is allowed: insertionForbidden)
            dragOver(c, _hOther, e.native, { insertBefore: _hInsertBefore });
            var _hy = _hInsertBefore ? _hr.top : _hr.bottom;
            var _hColor = _hOther.options.insertionForbidden ? 'var(--error-color,#f44336)' : undefined;
            me._hecShowInsertionMarker(_hr.left, _hy, _hr.width, 3, true, _hColor);
          } else {
            me._hecHideInsertionMarker();
          }
        }
      }
    },
    {
      // Default fallback. Plain horizontal (time) pan, once nothing else
      // above claimed the drag — except in zoom select mode, where a drag
      // outside the plot area does nothing.
      name: 'panX',
      test: function (c, p) {
        var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
        if (me.options.zoomSelectMode === true) return false;
        panX(c, 'start');
        return true;
      },
      onMove: function (c, p, e) {
        var me = c.me, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
        _hecDragMoveTick(c, p, e, true);
        panX(c, 'move', e.x - p.lastX);
      }
    }
  ];

  // Common start-of-dragmove work, duplicated identically across most
  // zones above before this factoring: fire the standard dragmove event,
  // then follow with the drag ghost if one is showing. panX (the only
  // zone with no ghost) passes noGhost=true to skip the second half.
  function _hecDragMoveTick(c, p, e, noGhost) {
    var me = c.me, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
    fire(c, 'dragmove', e.x, e.y, { overChart: e.native && e.native.clientX !== undefined ? me._hecChartAt(e.native.clientX, e.native.clientY) : null });
    if (!noGhost && me._hecDragGhostEl && e.native) {
      me._hecMoveDragGhost(e.native.clientX, e.native.clientY);
    }
  }

  // Cross-graph drag feedback — scans for whichever OTHER chart's canvas
  // the pointer is over (the destination canvas gets no native events
  // while this one holds the pointer capture, so this graph is the only
  // one that knows a drag is active), then asks that instance to fire its
  // own customEvent and draws ITS marker/highlight right here too — not
  // just a scan, despite the earlier name. Used by legendDrag and
  // timelineDrag only; lockAndHandle does its own separate cross-graph
  // work above (whole-rectangle geometry, not legendIndex/yAxisIndex).
  function _hecCrossGraphDragFeedback(c, p, e) {
    var me = c.me, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
    if (!e.native || e.native.clientX === undefined) return;
    var _other = me._hecFindInstanceAt(e.native.clientX, e.native.clientY);
    var _dragOverFound = (_other && typeof _other.options.customEvent === 'function') ? _other : null;
    if (_dragOverFound) {
      var _r = _other.canvas.getBoundingClientRect();
      var _ox = e.native.clientX - _r.left;
      var _oy = e.native.clientY - _r.top;
      dragOver(c, _other, e.native);
      if (p.dragLegendIdx >= 0 || p.dragYIdx >= 0) {
        _other._hecHighlightDropTarget(_other.options.dropAllowed !== false);
      }
      if (_other.options.dropAllowed !== false && p.dragLegendIdx >= 0 && _other.legend && _oy >= _other.legend.top && _oy <= _other.legend.bottom) {
        var _oFound = _other._hecFindLegendLabel(_ox, _oy, -2, true);
        if (_oFound) {
          var _oMr = _other.canvas.getBoundingClientRect();
          _other._hecShowInsertionMarker(_oMr.left + _oFound.markerX + 2, _oMr.top + _oFound.markerY, 3, _oFound.markerH, false, p.dragColor);
        } else {
          _other._hecHideInsertionMarker();
        }
      } else if (_other.options.dropAllowed !== false && p.dragYIdx >= 0 && (_other.config.type === 'timeline' || _other.config.type === 'arrowline') &&
                 _oy >= 0 && _other.chartArea && _ox < _other.chartArea.left) {
        var _oAt = _other._hecYAxisInsertAt(_oy, -1, false);
        if (_oAt) {
          var _oMr2 = _other.canvas.getBoundingClientRect();
          _other._hecShowInsertionMarker(_oMr2.left, _oMr2.top + _oAt.markerY, _oMr2.width, 3, true);
        } else {
          _other._hecHideInsertionMarker();
        }
      }
    }
    if (p.dragOverTarget && p.dragOverTarget !== _dragOverFound) {
      p.dragOverTarget._hecClearDropHighlight();
      p.dragOverTarget._hecHideInsertionMarker();
    }
    p.dragOverTarget = _dragOverFound;
    // The drag's cursor (this canvas holds the pointer): not-allowed over a graph
    // that refuses the drop (dropAllowed, decided by the customEvent above),
    // grabbing anywhere else
    if (me.options.cursorEnabled !== false) {
      me.canvas.style.cursor = (_dragOverFound && _dragOverFound.options.dropAllowed === false) ? 'not-allowed' : 'grabbing';
    }
  }


  function customEventTarget(c) {
    var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
    return typeof me.options.customEvent === 'function';
  }
  function legendIndexAt(c, x, y) {
    var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
    return me._hecLegendIndexAt(x, y);
  }

  function yAxisIndexAt(c, x, y) {
    var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
    return me._hecYAxisIndexAt(x, y);
  }

  function truncatedYAxisLabelAt(c, idx) {
    return _hecTruncatedRowLabel(c.me, idx);
  }

  // (a timeline's or arrowline's row name: its full text when cut to fit its column, else null)
  // A scale's label too wide for availW, on two lines (ctx: in its font): at a word
  // boundary, else at the character it no longer fits — the second line may still be too
  // wide (_hecTruncatedRowLabel). A label already on several lines (an array, a newline)
  // is left as it is. Used to draw it (Chart.js, scale draw) and to tell it's cut.
  Chart.hecWrapLabel = function (ctx, label, availW) {
    if (typeof label !== 'string' || label.indexOf('\n') !== -1 || ctx.measureText(label).width <= availW) return label;
    var _words = label.split(' ');
    if (_words.length > 1) {
      var _line1 = '', _line2 = '';
      for (var i = 0; i < _words.length; i++) {
        var _try = _line1 ? _line1 + ' ' + _words[i] : _words[i];
        if (ctx.measureText(_try).width <= availW) { _line1 = _try; }
        else { _line2 = _words.slice(i).join(' '); break; }
      }
      if (_line1 && _line2) return [_line1, _line2];
    }
    // (no word boundary fits: split at the character)
    var _split = 0;
    for (var c = 1; c <= label.length; c++) {
      if (ctx.measureText(label.substring(0, c)).width <= availW) _split = c;
      else break;
    }
    return [label.substring(0, _split), label.substring(_split)];
  };

  // (a row's name as its Y axis draws it: on two lines when too wide — Chart.hecWrapLabel —
  // ctx in its font)
  function _hecRowLabelLines(me, idx, ctx) {
    var _ys = me.scales && me.scales['y-axis-0'], lbl = me.data.labels[idx];
    if (_ys && _ys.ticks && _ys.ticks[idx] !== undefined) lbl = _ys.ticks[idx];
    var _l = Chart.hecWrapLabel(ctx, lbl === undefined || lbl === null ? '' : lbl, (_ys ? _ys.width : me.chartArea.left) - 8);
    return helpers.isArray(_l) ? _l : String(_l).split('\n');
  }

  function _hecTruncatedRowLabel(me, idx) {
    if (idx < 0 || !me.data || !me.data.labels || !me.chartArea) return null;
    var ctx2 = me.canvas.getContext('2d');
    ctx2.save();
    ctx2.font = me._hecRowLabelFont();
    // (its lines as drawn — on two when too wide: one of them can still be)
    var lines = _hecRowLabelLines(me, idx, ctx2);
    var textW = Math.max.apply(null, lines.map(function (l) { return ctx2.measureText(String(l)).width; }));
    ctx2.restore();
    var _ys = me.scales && me.scales['y-axis-0'];
    var origName = (me.data.datasets[idx] && me.data.datasets[idx].name) || lines.join(' ');
    return origName && textW > (_ys ? _ys.width : me.chartArea.left) - 8 ? origName : null;
  }

  // Single distribution point for every consumer of a detected gesture —
  // internal (legend click/hover toggle, Controller.options.onClick, label-
  // truncated tooltip) and external (customEvent) alike. Nothing here
  // re-derives 'click' from mouseup independently anymore; this is the one
  // place that decides a gesture happened and tells everyone at once.
  function fire(c, gestureType, hitX, hitY, extra) {
    var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
    var _hx = hitX !== undefined ? hitX : e.x;
    var _hy = hitY !== undefined ? hitY : e.y;
    if (gestureType === 'click' || gestureType === 'dblclick') {
      if (me.options.legendClickEnabled !== false && me.legend && typeof me.legend.handleEvent === 'function') {
        me.legend.handleEvent({ type: gestureType, x: _hx, y: _hy, native: e.native, chart: me });
      }
    }
    if (gestureType === 'dblclickdown') {
      // Simplified touch-action workaround for legend/timeline label drag
      // (touch only — mouse/pen never need this): touch-action:none was
      // already applied at the FIRST click of this double-click (see the
      // click branch below), covering the whole gap up to now. Setting
      // this flag true just keeps that block in effect through the drag
      // that follows — it doesn't need to itself trigger anything at this
      // exact instant, since the block never lapsed.
      me._hecLabelDragAllowed = true;
      me._hecUpdateDragTouchOverlays();
      // Grouped lock+handle zone: the second press toggles the lock exactly
      // the same way click does (see the click branch below) — same zone
      // check, same action, no pointerType distinction: it undoes the first
      // press's click, which was the first half of a double-click or of a
      // tap-then-drag, not a toggle.
      var _dblInLockAndHandleZone = me._hecInLockAndHandleZone(_hx, _hy) && !me._hecHandleButtons();
      if (_dblInLockAndHandleZone) {
        me._hecToggleYAxisLock();
      }
    }
    if (gestureType === 'dblclickdown' || gestureType === 'longpress') {
      // Third and fourth triggers for engaging the Y-axis lock, alongside
      // drag — same zone check, kept here as a consumer of the
      // already-detected event, not mixed into its detection.
      // (near labels drawn inside the plot: a finger's or a pen's tap then press only — a
      // long press there is the curves', and a mouse drags the axis right away)
      var _dblYAxisZone = me.options.yAxisPanEnabled !== false && me._hecValueYAxes().length &&
        (me._hecYAxisSideAt(_hx, _hy) || (gestureType === 'dblclickdown' && c.pointerType !== 'mouse' && me._hecInsideLabelSideAt(_hx, _hy, c.pointerType)));
      if (_dblYAxisZone && !me._hecYAxisLock) {
        me._hecYAxisLock = 2;
        me._hecUpdateYAxisState();
      }
    }
    var _yIdx = yAxisIndexAt(c, _hx, _hy);
    var _truncated = truncatedYAxisLabelAt(c, _yIdx);
    if (gestureType === 'click') {
      me._hecTap(e);
      if (typeof me.options.onClick === 'function') {
        me.options.onClick.call(me, e.native, me.active);
      }
      // High-level default behavior, on by default (see
      // options.labelTooltipEnabled), same as wheelZoomEnabled and legend
      // click toggling — a plain click on a truncated Y-axis category label
      // shows its full text, unless explicitly turned off.
      // (and a shortened legend label: the same, in place — see _hecRevealAt)
      if (me.options.labelTooltipEnabled !== false) me._hecShowReveal(me._hecRevealAt(_hx, _hy, true), false);
      // (with handleButtons shown there instead, a click is for them: payload.handleButton)
      var _clickInLockAndHandleZone = me._hecInLockAndHandleZone(_hx, _hy) && !me._hecHandleButtons();
      if (_clickInLockAndHandleZone) {
        // Grouped lock+handle zone: a click here always toggles the lock.
        // On mouse/pen, that's the whole story — simple, no two-step: click
        // toggles, drag moves the graph, independently. On touch, this
        // toggle is provisional: dragstart below (within the same
        // _hecLabelDragAllowed-armed window) will toggle it back if a drag
        // follows, treating this click as having been the first half of a
        // drag gesture rather than a real toggle intent.
        me._hecToggleYAxisLock();
      }
      // Second trigger for the Y-axis touch overlay's touch-action:none —
      // a click in this zone arms a 500ms window to anticipate a possible
      // NEXT contact there (this click itself is already over by the time it
      // fires, per Thierry), separate from the lock-driven trigger below.
      var _clickInYAxisZone = me.options.yAxisPanEnabled !== false && me._hecValueYAxes().length &&
        (me._hecYAxisSideAt(_hx, _hy) || me._hecInsideLabelSideAt(_hx, _hy, c.pointerType));
      if (_clickInYAxisZone) {
        me._hecYAxisClickArmed = true;
        me._hecUpdateYAxisState();
        clearTimeout(me._hecYAxisClickArmedTimer);
        me._hecYAxisClickArmedTimer = setTimeout(function () {
          me._hecYAxisClickArmed = false;
          me._hecUpdateYAxisState();
        }, c.cfg.longPressMs);
      }
      // Same click-armed mechanism, for the legend/timeline label drag
      // workaround: a click ANYWHERE on the canvas arms this temporary
      // flag, covering the gap up to a possible next click on the label
      // zone — touch-action:none stays applied through that gap even
      // before the dblclick itself (below) confirms drag is allowed.
      me._hecLabelClickArmed = true;
      me._hecUpdateDragTouchOverlays();
      clearTimeout(me._hecLabelClickArmedTimer);
      me._hecLabelClickArmedTimer = setTimeout(function () {
        me._hecLabelClickArmed = false;
        me._hecUpdateDragTouchOverlays();
      }, c.cfg.longPressMs);
    }
    if (!customEventTarget(c)) return;
    var el = me.getElementAtEvent ? me.getElementAtEvent(e) : null;
    var payload = me._hecPayload(gestureType, _hx, _hy, e.native, {
      element: el && el[0] ? el[0] : null,
      truncatedYAxisLabel: _truncated,
      pointerCount: gs.count,
      pointerType: pointerType });
    if (extra) { for (var k in extra) payload[k] = extra[k]; }
    me.options.customEvent.call(me, payload);
  }

  // Calls options.panX (the card's time axis) — phase 'start', 'move' (deltaFactor:
  // the movement since the last call, in plot area widths, > 0 rightward) or 'end'
  // (source: 'drag' or 'pinch'; at a pinch's start and end, pointerFactors: where its
  // fingers are along the plot area, and at its end startFactors: where they were at its start)
  function panX(c, phase, deltaPixels, source, fingers) {
    var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
    if (me.options.panEnabled === false || typeof me.options.panX !== 'function') return;
    var _a = me.chartArea;
    var _w = _a ? _a.right - _a.left : 0;
    var _info = { chart: me, phase: phase, deltaFactor: (phase === 'move' && _w > 0) ? deltaPixels / _w : 0, source: source || 'drag', event: e.native };
    if (fingers) { _info.pointerFactors = fingers.pointerFactors; if (fingers.startFactors) _info.startFactors = fingers.startFactors; }
    me.options.panX.call(me, _info);
  }

  // A pinch's change since it started (pinch.start) in each of its four ways — its spread
  // along X (the time's zoom) and Y (the Y axis' zoom), its centre along X (the time's pan)
  // and Y (the Y axis' pan). A pinch is never exactly horizontal, vertical or centred: the
  // way it's mostly made in — the first to go beyond the finger's precision (dragSlop, as
  // a drag), the largest then — is its way (pinch.main), the only one counted until
  // another goes beyond a dead band of pinchDeadBand (10 %) of the plot area's smaller
  // side. Each counts only beyond its threshold (no jump), back within it nothing
  // → the spread and centre counted { distX, distY, centerX, centerY }
  function pinchCounted(me, pinch, distX, distY, centerX, centerY, cfg) {
    var s = pinch.start, a = me.chartArea;
    var _now = { distX: distX, distY: distY, centerX: centerX, centerY: centerY };
    var _change = function (k) { return Math.abs(_now[k] - s[k]); };
    if (!pinch.main) {
      var _max = Object.keys(_now).reduce(function (m, k) { return _change(k) > _change(m) ? k : m; });
      if (_change(_max) > cfg.dragSlop) pinch.main = _max;
    }
    var _band = a ? cfg.pinchDeadBand * Math.min(a.right - a.left, a.bottom - a.top) : 0;
    var _out = {};
    Object.keys(_now).forEach(function (k) {
      if (!pinch.main) { _out[k] = s[k]; return; }
      var d = _now[k] - s[k], t = k === pinch.main ? cfg.dragSlop : _band;
      _out[k] = s[k] + Math.sign(d) * Math.max(0, Math.abs(d) - t);
    });
    return _out;
  }

  // A pinch's fingers' moves applied once per frame, once both fingers have given their
  // position (each finger's event comes on its own: one finger moved alone isn't the
  // gesture) — and what's left applied before it ends (flushPinch)
  function schedulePinch(c, pinch) {
    pinch.c = c;
    if (pinch.frame) return;
    pinch.frame = requestAnimationFrame(function () {
      pinch.frame = null;
      if (c.gs.pinch === pinch) applyPinch(pinch.c, pinch);
    });
  }

  function flushPinch(pinch) {
    if (!pinch || !pinch.frame) return;
    cancelAnimationFrame(pinch.frame);
    pinch.frame = null;
    applyPinch(pinch.c, pinch);
  }

  // A pinch's fingers where they are now: the time and the Y axes moved and zoomed
  function applyPinch(c, pinch) {
    var me = c.me, cfg = c.cfg, s = pinch.start;
    var newDistX = Math.abs(pinch.p2.x - pinch.p1.x);
    var newDistY = Math.abs(pinch.p2.y - pinch.p1.y);
    var newCenterX = (pinch.p1.x + pinch.p2.x) / 2;
    var newCenterY = (pinch.p1.y + pinch.p2.y) / 2;
    // What the whole gesture does now, in the ways it's made in (pinchCounted) — each axis
    // given the difference with what it was given already (pinch.applied): a change back
    // within its threshold is brought back
    var _n = pinchCounted(me, pinch, newDistX, newDistY, newCenterX, newCenterY, cfg);
    var _min = cfg.pinchMinDist, _ap = pinch.applied;
    var _want = {
      panX: _n.centerX - s.centerX,
      panY: _n.centerY - s.centerY,
      // (the time zoomed by steps: one each time the spread changes by x1.5; a spread
      // too small to measure — the fingers crossing — keeps what's given)
      stepsX: s.distX > _min && _n.distX > _min ? -Math.trunc(Math.log(s.distX / _n.distX) / Math.log(1.5)) : _ap.stepsX,
      scaleY: s.distY > _min && _n.distY > _min ? s.distY / _n.distY : _ap.scaleY };
    var panDX = _want.panX - _ap.panX, panDY = _want.panY - _ap.panY;
    var _stepX = _want.stepsX - _ap.stepsX, _scaleY = _want.scaleY / _ap.scaleY;
    pinch.applied = _want;
    if (panDX !== 0 || panDY !== 0 || _stepX !== 0) {
      // (one fused event for the moves of this instant — informative)
      fire(c, 'pinch', undefined, undefined, {
        panDeltaX: panDX, panDeltaY: panDY,
        zoomScaleX: _stepX ? Math.pow(1.5, -_stepX) : undefined, centerPixelsX: newCenterX, centerPixelsY: newCenterY });
    }
    // Time axis (the card's): the fingers' common horizontal movement pans it; their
    // horizontal spread zooms it by steps, around their centre as counted (a centre that
    // hasn't moved beyond its threshold zooms where the pinch started)
    if (panDX !== 0) panX(c, 'move', panDX, 'pinch');
    for (var _k = 0; _k < Math.abs(_stepX); _k++)
      zoomX(c, Math.sign(_stepX), _n.centerX, 'pinch', pinchFactors(me, pinch), pinch.startFactors);
    // Y pan by the vertical movement of the fingers' centre — the content follows
    // the fingers, as with the one-finger Y axis pan (yAxisPan) — and Y zoom by
    // their vertical spread, each axis around its own middle: every Y axis of the
    // chart moves together (pinch.yRanges, tracked from the pinch's start)
    var _yRange = me.chartArea ? me.chartArea.bottom - me.chartArea.top : 0;
    var _yr = pinch.yRanges, _yChanged = false;
    if (panDY !== 0 && _yRange > 0 && _yr.length && me.options.panEnabled !== false && me.options.yAxisPanEnabled !== false) {
      _yr.forEach(function (r) { var _sh = panDY * (r[1] - r[0]) / _yRange; r[0] += _sh; r[1] += _sh; });
      _yChanged = true;
    }
    if (_scaleY !== 1 && me.options.zoomEnabled !== false && me.options.zoomYEnabled !== false && _yr.length) {
      _yr.forEach(function (r) { var _mid = (r[0] + r[1]) / 2, _half = (r[1] - r[0]) / 2 * _scaleY; r[0] = _mid - _half; r[1] = _mid + _half; });
      _yChanged = true;
    }
    if (_yChanged) me._hecSetYRanges(_yr);
  }

  // Where a pinch's fingers are along the plot area (0 at its left edge, 1 at its right edge)
  function pinchFactors(me, pinch) {
    return [me._hecPlotFactor(pinch.p1.x), me._hecPlotFactor(pinch.p2.x)];
  }

  // Calls options.zoomX (the card's time axis): step +1 zooms in, -1 out, around
  // centerFactor (where along the plot area, 0 to 1) — source 'wheel' or 'pinch', with
  // pointerFactors (the pointer, or the fingers now) and startFactors (where the fingers
  // were at the pinch's start; for the wheel, the pointer)
  function zoomX(c, step, centerX, source, pointerFactors, startFactors) {
    var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
    if (me.options.zoomEnabled === false || typeof me.options.zoomX !== 'function') return;
    me.options.zoomX.call(me, { chart: me, step: step, centerFactor: me._hecPlotFactor(centerX), source: source,
      pointerFactors: pointerFactors, startFactors: startFactors || pointerFactors, event: e.native });
  }

  // A drag from this chart is over another one, of its dragScope: that one's
  // customEvent gets a dragovergraph, at the point under the pointer
  function dragOver(c, other, native, extra) {
    var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
    if (typeof other.options.customEvent !== 'function') return;
    var _r = other.canvas.getBoundingClientRect();
    var _ex = { element: null, pointerCount: gs.count, pointerType: pointerType };
    if (extra) { for (var k in extra) _ex[k] = extra[k]; }
    other.options.customEvent.call(other, other._hecPayload('dragovergraph', native.clientX - _r.left, native.clientY - _r.top, native, _ex));
  }

  // Where a label or graph drag p is dropped — dragend's `drop` (Chart Custom.js.md
  // §2), from the same lookups as the insertion marker shown during the drag:
  // { chart: the chart under the pointer, or null; index, insertBefore: the legend
  // label (curve drag) or Y axis row (timeline row drag) to insert next to, index -1
  // over none; for a graph move, insertBefore: above the target's middle }.
  // undefined for any other drag.
  function _hecDropAt(c, p) {
    var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
    var _n = e.native;
    if (!_n || _n.clientX === undefined) return undefined;
    var _name = p.handler && p.handler.name;
    if (_name !== 'legendDrag' && _name !== 'timelineDrag' && _name !== 'lockAndHandle') return undefined;
    var _t = _name === 'lockAndHandle' ? me._hecFindInstanceAt(_n.clientX, _n.clientY) : me._hecChartAt(_n.clientX, _n.clientY);
    var _drop = { chart: _t, index: -1, insertBefore: true };
    if (!_t) return _drop;
    var _r = _t.canvas.getBoundingClientRect();
    var _x = _n.clientX - _r.left, _y = _n.clientY - _r.top;
    var _at = null;
    if (_name === 'legendDrag') _at = _t.legend ? _t._hecFindLegendLabel(_x, _y, _t === me ? p.dragLegendIdx : -2, true) : null;
    else if (_name === 'timelineDrag') _at = _t._hecYAxisInsertAt(_y, -1, true);
    else _drop.insertBefore = _n.clientY < _r.top + _r.height / 2;
    if (_at) { _drop.index = _at.idx; _drop.insertBefore = _at.insertBefore; }
    return _drop;
  }

  // Common drag-end cleanup — was duplicated identically between mouseup
  // and pointercancel (ghost, marker, drop-target highlight cleanup, then
  // firing dragend with zoom-selection data if applicable). Factored per
  // Thierry's explicit request to harmonize the drag-handling code.
  function _hecEndDrag(c, p) {
    var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
    me._hecDestroyDragGhost();
    if (me.canvas) me.canvas.style.cursor = '';
    me._hecHideInsertionMarker();
    if (p.dragOverTarget) { p.dragOverTarget._hecClearDropHighlight(); p.dragOverTarget._hecHideInsertionMarker(); }
    var _hName = p.handler && p.handler.name;
    if (_hName === 'handleSwipe') {
      var _dy = (e && e.y !== undefined && e.y !== null ? e.y : p.y0) - p.y0;
      var _sw = me._hecHandleButtonFields(p.x0, p.y0);
      _sw.swipe = Math.abs(_dy) > cfg.dragSlop ? (_dy < 0 ? 'up' : 'down') : null;
      fire(c, 'dragend', undefined, undefined, _sw);
    } else if (_hName === 'zoomSelect') {
      me._hecHideZoomSelection();
      fire(c, 'dragend', undefined, undefined, { zoomSelectFactor0: me._hecPlotFactor(p.x0),
        zoomSelectFactor1: p.dragZoomSelectX1 !== undefined ? me._hecPlotFactor(p.dragZoomSelectX1) : undefined });
    } else {
      if (_hName === 'panX' || p.dragShiftKey) panX(c, 'end');
      fire(c, 'dragend', undefined, undefined, { drop: _hecDropAt(c, p) });
    }
  }

  // mousedown
  // ── Pen barrel button ──
  // The barrel button is reported as the secondary button (buttons bit 2), at the
  // contact or as a chorded change while the tip is down (Pointer Events).
  // The long-press under way, if any, called off
  function cancelLongPress(gs) {
    if (gs.longPressTimer) { clearTimeout(gs.longPressTimer); gs.longPressTimer = null; }
  }

  function penBarrel(c) {
    return c.pointerType === 'pen' && !!(c.e.native && c.e.native.buttons & 2);
  }

  // The barrel button pressed while the tip stays down (p: that contact): two quick
  // presses are a dblclick (the pen's alias of a double tap, where the tip is); the
  // first one already cancels the long-press, the contact now being the button's
  function penBarrelPressed(c, p) {
    var gs = c.gs, _down = penBarrel(c);
    if (_down && !p.barrelDown) {
      cancelLongPress(gs);
      var _now = Date.now();
      if (p.barrelPressedAt && _now - p.barrelPressedAt < c.cfg.longPressMs) {
        fire(c, 'dblclick', p.x0, p.y0);
        p.barrelPressedAt = 0;
      } else {
        p.barrelPressedAt = _now;
      }
      p.barrelPressed = true;
    }
    p.barrelDown = _down;
  }

  // The browser's context menu request: a right click, a long press, a tap with a pen's
  // button (Chrome: no contact reported at all, only this). On a graph the browser's own
  // menu never opens: it's the longpress gesture. During a contact, it's that contact's
  // long press, fired now unless already; right after a contact released from its long
  // press, at the same place (a browser reporting it at the release), it's that one's
  function hecContextMenu(c) {
    var gs = c.gs, e = c.e, cfg = c.cfg;
    if (e.native) e.native.preventDefault();
    var p = gs.pending;
    if (p) {
      if (p.longPressFired) return;
      cancelLongPress(gs);
      p.longPressFired = true;
      fire(c, 'longpress', p.x0, p.y0);
      return;
    }
    var last = gs.longPressReleased;
    gs.longPressReleased = null;
    if (last && Date.now() - last.t < cfg.contextMenuAfterMs && Math.abs(last.x - e.x) + Math.abs(last.y - e.y) <= cfg.dragSlop) return;
    fire(c, 'longpress', e.x, e.y);
  }

  function hecPointerDown(c) {
    var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
    // A mouse's other buttons start no gesture: its right button acts through the
    // contextmenu gesture (a pen's barrel button is handled below)
    if (pointerType === 'mouse' && e.native && e.native.button > 0) return;
    gs.pointers[pid] = { x: e.x, y: e.y };
    gs.count = Object.keys(gs.pointers).length;
    // Keep receiving this pointer's moves/release once it leaves the canvas —
    // a drag onto ANOTHER graph (curve/label/graph move) is followed from here
    // (see _hecCrossGraphDragFeedback). Touch gets this implicitly from the
    // browser; a mouse or pen doesn't, so without it a drag toward another
    // graph never got past this canvas's edge. Released automatically at the
    // pointer's release.
    if (e.native && e.native.pointerId !== undefined && me.canvas && me.canvas.setPointerCapture) {
      try { me.canvas.setPointerCapture(e.native.pointerId); } catch (_err) { /* pointer already gone */ }
    }

    gs.longPressReleased = null;
    if (gs.count === 1) {
      // Four independent events, defined purely by time and distance —
      // per Thierry's exact spec:
      //   click     = down/up, stayed within 10px, < 600ms
      //   longpress = down/up, stayed within 10px, >= 600ms
      //   dblclickdown = down/up/down, stayed within 10px, < 400ms between
      //               the two downs — at the second down: what a drag
      //               following the second press needs is armed right away
      //   dblclick  = the same, released without moving — at the second up,
      //               like the browser's own: only then is it known not to be
      //               a tap-then-drag
      //   drag      = down, moved past 10px (time doesn't matter)
      // The second press never produces its own click at release — see
      // dblClickFired below and its use at mouseup.
      // Long-press remains independent from drag, same as before.
      // Pen with its barrel button held at contact: a right-click, as on every
      // system — released without a drag, it's a longpress (see mouseup); a drag
      // is a plain drag, the button keeping the browser from scrolling. It never
      // counts as half of a double-click.
      var _barrel = penBarrel(c);
      var _downNow = Date.now();
      // (the second press of a double-click, or of a tap-then-drag: within the long-press
      // duration of the first one's release, and the immobility distance of where it was)
      var _lr = gs.lastRelease;
      var _isDblClick = !_barrel && !!_lr && _downNow - _lr.t < cfg.longPressMs &&
                        Math.abs(e.x - _lr.x) + Math.abs(e.y - _lr.y) <= cfg.dragSlop;
      gs.lastRelease = null;
      if (_isDblClick) {
        fire(c, 'dblclickdown', e.x, e.y);
      }

      var _pending = { x0: e.x, y0: e.y, pid: pid, dragging: false, pointerType: pointerType, native: e.native,
        // Marks that THIS press is the second one of a double-click — checked
        // at mouseup below: released without a drag, it's a dblclick, never
        // a plain click.
        dblClickFired: _isDblClick, barrel: _barrel, barrelDown: _barrel };
      gs.pending = _pending;

      gs.longPressTimer = setTimeout(function () {
        if (gs.pending !== _pending) return; // drag already started or gesture ended
        gs.longPressTimer = null;
        // gs.pending stays alive (not cleared) — with the finger still
        // down, long-press doesn't end the gesture: a normal drag can
        // still follow right after, in the same continuous contact.
        _pending.longPressFired = true;
        fire(c, 'longpress', _pending.x0, _pending.y0);
      }, cfg.longPressMs);

    } else if (gs.count === 2) {
      // Second finger while first is already down — start pinch: track both
      // points and their spread, pan by centre movement, zoom by spread change.
      cancelLongPress(gs);
      gs.pending = null;
      var _ids = Object.keys(gs.pointers);
      var _p1id = _ids[0], _p2id = _ids[1];
      gs.pinch = {
        p1id: _p1id, p2id: _p2id,
        p1: { x: gs.pointers[_p1id].x, y: gs.pointers[_p1id].y },
        p2: { x: gs.pointers[_p2id].x, y: gs.pointers[_p2id].y } };
      // (its spread and centre at its start — its change counted from them, see
      // pinchCounted — and what it gave each axis so far)
      gs.pinch.start = { distX: Math.abs(gs.pinch.p2.x - gs.pinch.p1.x), distY: Math.abs(gs.pinch.p2.y - gs.pinch.p1.y),
        centerX: ( gs.pinch.p1.x + gs.pinch.p2.x ) / 2, centerY: ( gs.pinch.p1.y + gs.pinch.p2.y ) / 2 };
      gs.pinch.applied = { panX: 0, panY: 0, stepsX: 0, scaleY: 1 };
      gs.pinch.startFactors = pinchFactors(me, gs.pinch);
      panX(c, 'start', 0, 'pinch', { pointerFactors: gs.pinch.startFactors });
      // The Y ranges tracked from pinch start — needed for the direct Y zoom, which
      // must accumulate scale changes across the whole gesture, not
      // recompute from the live (already-changing) scales each frame.
      gs.pinch.yRanges = me._hecYRanges();
    }
  }

  // mousemove
  function hecPointerMove(c) {
    var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
    if (gs.pointers[pid]) { gs.pointers[pid].x = e.x; gs.pointers[pid].y = e.y; gs.pointers[pid].moved = true; }
    // Alt (Option) held while the pointer moves over the chart: every sample shown (the
    // hover and its tooltip stay on the point under the pointer) — unless
    // altSampleModeEnabled is false
    if (me.options.altSampleModeEnabled !== false) me._hecSetShowSamples(!!(e.native && e.native.altKey));

    if (gs.pinch && (pid == gs.pinch.p1id || pid == gs.pinch.p2id)) {
      HEC_DRAG_HANDLERS[0].onMove(c, null, e);

    } else {
      var p = gs.pending;
      if (p && p.pid === pid && !p.dragging && pointerType === 'pen') penBarrelPressed(c, p);
      if (p && p.pid === pid && !p.dragging) {
        if (Math.abs(e.x - p.x0) + Math.abs(e.y - p.y0) > cfg.dragSlop) {
          cancelLongPress(gs);
          p.dragging = true;
          fire(c, 'dragstart', p.x0, p.y0);
          // Table-driven zone selection — per Thierry's explicit
          // instruction: every zone (Y-axis pan, legend, timeline,
          // zoom-select, lock+handle, plain panX) is tried uniformly
          // here, in HEC_DRAG_HANDLERS order, first match wins. Each zone's
          // test() does its own setup (ghost, scale capture, etc.) and
          // returns true to claim the drag.
          for (var _zi = 0; _zi < HEC_DRAG_HANDLERS.length; _zi++) {
            if (HEC_DRAG_HANDLERS[_zi].test(c, p)) { p.handler = HEC_DRAG_HANDLERS[_zi]; break; }
          }
        }
      } else if (p && p.pid === pid && p.dragging) {
        if (p.handler) p.handler.onMove(c, p, e);
      }
      if (p && p.pid === pid) { p.lastX = e.x; p.lastY = e.y; }
      if (!p) {
        // No gesture pending at all — a plain hover with nothing pressed.
        var _hLegendIdx = legendIndexAt(c, e.x, e.y);
        var _hYIdx = yAxisIndexAt(c, e.x, e.y);
        // High-level default behavior, on by default (see
        // options.cursorEnabled) — Chart.js sets its own canvas's cursor
        // style directly, same as wheelZoomEnabled actually zooming: 'move'
        // over a draggable legend label (line/bar) or a draggable
        // timeline/arrowline Y-axis label, '' otherwise (cursorEnabled: false
        // turns it all off).
        // (a legend label's value: 'pointer' — a click there is its own, see legendPart)
        if (me.options.cursorEnabled !== false && me.canvas) {
          var _draggable = (_hLegendIdx >= 0 && (me.config.type === 'line' || me.config.type === 'bar')) ||
                            (_hYIdx >= 0 && (me.config.type === 'timeline' || me.config.type === 'arrowline'));
          me.canvas.style.cursor = _hLegendIdx >= 0 && me._hecLegendPartAt(_hLegendIdx, e.x) === 'value' ? 'pointer' : _draggable ? 'move' : '';
        }
        // (the Y labels drawn inside the plot near the pointer: their boxes opaque)
        me._hecSetLabelsHovered(me._hecInsideLabelSideAt(e.x, e.y, pointerType));
        fire(c, 'hover', undefined, undefined, { legendIndex: _hLegendIdx, yAxisIndex: _hYIdx });
      }
    }
  }

  // mouseup
  function hecPointerUp(c) {
    var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
    // Legend/timeline label drag workaround: armed by the second press
    // (dblclickdown), always disarmed here on the raw mouseup itself — not
    // custDragEnd — so it never stays stuck armed when no drag followed.
    if (me._hecLabelDragAllowed) {
      me._hecLabelDragAllowed = false;
      me._hecUpdateDragTouchOverlays();
    }
    if (gs.pinch && (pid == gs.pinch.p1id || pid == gs.pinch.p2id)) {
      // The OTHER finger's current position — whichever pointer isn't the
      // one lifting right now — is what the card needs to resume the pan
      // with, and is also what Chart.js's own drag detection below should
      // restart tracking from once this returns to a single pointer.
      var _remainingId = (pid == gs.pinch.p1id) ? gs.pinch.p2id : gs.pinch.p1id;
      var _remainingPt = gs.pointers[_remainingId];
      flushPinch(gs.pinch);
      var _ended = gs.pinch;
      gs.pinch = null;
      panX(c, 'end', 0, 'pinch', { pointerFactors: pinchFactors(me, _ended), startFactors: _ended.startFactors });
      if (_remainingPt) {
        // Re-arm gs.pending for the remaining finger — it was never
        // created for this pointer (gs.pending is only set at
        // gs.count===1, which this finger skipped, having started as
        // part of a 2-finger pinch). Without this, its next mousemove
        // would never be evaluated against the 10px drag threshold at
        // all. Same shape as a normal mousedown's _pending — zone
        // selection happens the same way everyone else's does, via
        // HEC_DRAG_HANDLERS at the next dragstart, not decided here.
        gs.pending = { x0: _remainingPt.x, y0: _remainingPt.y, pid: _remainingId, dragging: false,
          pointerType: pointerType, native: e.native, dblClickFired: false };
        fire(c, 'pinchend', _remainingPt.x, _remainingPt.y);
      }
    } else {
      cancelLongPress(gs);
    }
    var pu = gs.pending;
    if (pu && pu.pid === pid) {
      gs.pending = null;
      if (pu.dragging) {
        _hecEndDrag(c, pu);
      } else if (pu.longPressFired) {
        // Click and long-press are mutually exclusive — a long-press already
        // fired for this contact, so releasing without ever moving does NOT
        // become a click, even though gs.pending stayed alive to allow a drag
        // to follow (which didn't happen here). A context menu the browser
        // reports for it now, at the release, is that same long press's.
        gs.longPressReleased = { t: Date.now(), x: pu.x0, y: pu.y0 };
      } else if (pu.barrelPressed) {
        // The barrel button was pressed while the tip stayed down: whatever it did
        // (a double press is a dblclick) was done then — no click at release
      } else if (pu.barrel) {
        // Pen tapped with its barrel button held: the type menu, as a long-press
        fire(c, 'longpress', pu.x0, pu.y0);
      } else if (pu.dblClickFired) {
        // The second press of a double-click, released without a drag: a
        // dblclick (and never also a plain click)
        fire(c, 'dblclick', undefined, undefined);
      } else {
        // click: released without moving, before the long-press timer
        // fired, and this press wasn't itself a dblclick's second press —
        // per Thierry's spec. Its release may start a double-click.
        gs.lastRelease = { t: Date.now(), x: pu.x0, y: pu.y0 };
        fire(c, 'click', undefined, undefined);
      }
    } else {
    }
    delete gs.pointers[pid];
    gs.count = Object.keys(gs.pointers).length;
  }

  // pointercancel
  function hecPointerCancel(c) {
    var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
    // A cancel after this pointer moved is the browser taking the contact over (a
    // swipe it scrolls): the gesture ends. One with no move before it (a long press
    // the browser turns into its context menu) leaves the gesture to finish as it was.
    var _pt = gs.pointers[pid];
    // A pen's tap the browser takes over (some apps cancel a pen contact that moved a
    // little, where a touch would be a scroll): released within the tap distance, alone,
    // without a long press — a tap for the tooltip (_hecTap), at its start point
    var _pu = gs.pending;
    if (_pt && _pt.moved && pointerType === 'pen' && gs.count === 1 && _pu && _pu.pid === pid &&
        !_pu.dragging && !_pu.longPressFired && !_pu.barrel && !_pu.barrelPressed) {
      me._hecTap({ type: e.type, x: _pu.x0, y: _pu.y0, native: e.native });
    }
    if (_pt && _pt.moved) {
      cancelLongPress(gs);
      if (gs.pending && gs.pending.pid === pid && gs.pending.dragging) {
        _hecEndDrag(c, gs.pending);
      }
      if (gs.pinch && (pid == gs.pinch.p1id || pid == gs.pinch.p2id)) {
        flushPinch(gs.pinch);
        var _endedPinch = gs.pinch;
        gs.pinch = null;
        panX(c, 'end', 0, 'pinch', { pointerFactors: pinchFactors(me, _endedPinch), startFactors: _endedPinch.startFactors });
      }
      gs.pending = null;
    }
    delete gs.pointers[pid];
    gs.count = Object.keys(gs.pointers).length;
  }

  // wheel
  function hecWheel(c) {
    var me = c.me, e = c.e, gs = c.gs, cfg = c.cfg, pid = c.pid, pointerType = c.pointerType;
    if (!e.native) return;
    // Ctrl+wheel zooms the time range, never the page — every tick, including those
    // the debounce below coalesces away
    var _ctrlZoom = e.native.ctrlKey && me.options.wheelZoomEnabled !== false && typeof me.options.zoomX === 'function';
    if (_ctrlZoom) e.native.preventDefault();
    // Debounce: rapid-fire wheel ticks within 150ms of each other are coalesced to
    // one, avoiding runaway zoom steps on trackpads/high-resolution wheels.
    var _now2 = Date.now();
    if (me._hecWheelLast && _now2 - me._hecWheelLast < cfg.wheelDebounceMs) return;
    me._hecWheelLast = _now2;

    var _native = e.native;
    fire(c, 'wheel', undefined, undefined, {
      deltaX: _native.deltaX, deltaY: _native.deltaY,
      ctrlKey: _native.ctrlKey, shiftKey: _native.shiftKey, altKey: _native.altKey });

    // High-level default behavior: Ctrl = zoom X, Shift = zoom Y. Ctrl+wheel
    // calls a card-supplied zoomX callback (the shared date range across all
    // graphs is a card responsibility, per Thierry). Shift+wheel zoom Y, by
    // contrast, is a per-graph responsibility Chart.js handles directly on its
    // own Y scale — no callback needed. Configurable, on by default (see
    // options.wheelZoomEnabled / options.zoomYEnabled below).
    if (me.options.wheelZoomEnabled !== false) {
      if (_ctrlZoom) {
        if (_native.deltaY) zoomX(c, _native.deltaY < 0 ? 1 : -1, e.x, 'wheel', [me._hecPlotFactor(e.x)]);
      }
      if (_native.shiftKey && me.options.zoomYEnabled !== false) {
        var _wd = Math.abs(_native.deltaX) > Math.abs(_native.deltaY) ? _native.deltaX : _native.deltaY;
        if (_wd !== 0 && me._hecValueYAxes().length) {
          // (every Y axis, each around its own middle)
          var _f = _wd < 0 ? 0.9 : 1.0 / 0.9;
          me._hecSetYRanges(me._hecYRanges().map(function (r) {
            var _d = (r[1] - r[0]) * (1 - _f) * 0.5;
            return [r[0] + _d, r[1] - _d];
          }));
        }
      }
    }
  }

  var GESTURE_EVENTS = { mousedown: hecPointerDown, mousemove: hecPointerMove, mouseup: hecPointerUp, pointercancel: hecPointerCancel, wheel: hecWheel, contextmenu: hecContextMenu };

  // ── Methods added to every chart ──

  helpers.extend(Chart.prototype, {

    // ── What is under a point: the targets, the zones, the elements, the curves (the picking rule, _hecPick) ──

    // The small targets above the plot area — the chain icon, the lock+handle zone, the
    // legend's labels (within the legend's band) — picked together (_hecPick): the one
    // under the point, else the nearest one if near enough and clearly nearer than the
    // next. → 'linkMarker', 'lockAndHandle', a legend label's index, -1 or PICK_BETWEEN.
    // Never from the plot area or the Y axis column (y below the plot area's top) — but
    // on the controls' box drawn over them (hecControlsBackdrop).
    _hecTopTargetAt: function (x, y) {
      var me = this, _a = me.chartArea;
      // (below the plot area's top: only the controls' box drawn over it, when it is —
      // hecControlsBackdrop: on it, the controls')
      if (_a && y >= _a.top) {
        var _bd = me.options.hecControlsBackdrop && me._hecHasControls();
        return _bd && x >= 0 && x <= me._hecLockAndHandleWidth() && y <= 28 ? 'lockAndHandle' : -1;
      }
      var rects = [], ids = [];
      var _lm = me._hecLinkMarkerRect();
      if (_lm) { rects.push({ x: _lm.left, y: _lm.top, width: _lm.width, height: _lm.height }); ids.push('linkMarker'); }
      rects.push({ x: 0, y: 0, width: me._hecLockAndHandleWidth(), height: 28 }); ids.push('lockAndHandle');
      var legend = me.legend;
      if (legend && legend.legendHitBoxes && y >= legend.top && y <= legend.bottom) {
        legend.legendHitBoxes.forEach(function (b, i) {
          rects.push({ x: b.left, y: b.top, width: b.width, height: b.height }); ids.push(i);
        });
      }
      var _i = _hecPick(x, y, rects);
      return _i >= 0 ? ids[_i] : _i;
    },

    // Legend hit-test — the label picked among the small targets above the plot area
    // (_hecTopTargetAt), never from the plot area under it nor from a control.
    // Cross-graph drag&drop (Controller._hecGestureHandler's dragovergraph) calls THIS on
    // OTHER chart instances too, including ones just created and never yet touched — must
    // exist unconditionally, same as any native Chart.js method.
    _hecLegendIndexAt: function (x, y) {
      var _t = this._hecTopTargetAt(x, y);
      return typeof _t === 'number' && _t >= 0 ? _t : -1;
    },

    // Which part of legend label i a canvas-relative x is on: 'value' — its value after its
    // name ('(400 W)', legend item hecValue) — or 'name' (its color swatch and its mark
    // too: the swatch covered by the controls' box on a narrow card); null without one
    _hecLegendPartAt: function (i, x) {
      var it = this.legend && this.legend.legendItems[i], hb = this.legend && this.legend.legendHitBoxes[i];
      if (!it || !hb) return null;
      if (!it.hecValue) return 'name';
      var ctx = this.ctx;
      ctx.save(); ctx.font = this._hecLegendFont();
      // (the text ends at the hit box's right edge: name, ' ', value, then ' ' and the mark)
      var _mark = it.hecMark ? ctx.measureText(' ' + it.hecMark).width : 0, _value = ctx.measureText(it.hecValue).width;
      ctx.restore();
      var _end = hb.left + hb.width - _mark;
      return x >= _end - _value && x <= _end ? 'value' : 'name';
    },

    // Y-axis category label hit-test (timeline/arrowline row under a point) — the row
    // picked (_hecPick) within the label column only (0 to chartArea.left), never from
    // the plot area beside it nor from a control (_hecOnControl). Each row's candidate rectangle spans the whole column:
    // labels don't have their own individual X bounds. Same unconditional-at-construction
    // reasoning as _hecLegendIndexAt above.
    _hecYAxisIndexAt: function (x, y) {
      var yScale = this.scales && this.scales['y-axis-0'];
      if (!yScale || !this.data || !this.data.labels || !this.chartArea) return -1;
      var labels = this.data.labels;
      var _colWidth = this.chartArea.left;
      var rects = [];
      for (var li = 0; li < labels.length; li++) {
        var py = yScale.getPixelForValue(null, li, li);
        var _rowH = yScale.height / labels.length;
        rects.push({ x: 0, y: py - _rowH / 2, width: _colWidth, height: _rowH });
      }
      if (x < 0 || x > _colWidth || this._hecOnControl(x, y)) return -1;
      return Math.max(_hecPick(x, y, rects), -1);
    },

    // Where a timeline/arrowline row dropped at canvas-relative y lands: the row it's
    // over — { idx, insertBefore (y above the row's middle), markerY (that row's edge
    // on that side, for the insertion marker) } — skipping excludeIdx (the row being
    // dragged), or null when over none; with nearest, the nearest row whatever the
    // distance. Shared by the insertion markers (in this chart and in another one) and
    // by the card, which places the dropped entity from it.
    _hecYAxisInsertAt: function (y, excludeIdx, nearest) {
      var yScale = this.scales && this.scales['y-axis-0'];
      var labels = this.data && this.data.labels;
      if (!yScale || !labels || !labels.length) return null;
      var _halfH = (yScale.height / labels.length) / 2;
      var _best = null, _bestDist = Infinity;
      for (var _i = 0; _i < labels.length; _i++) {
        if (_i === excludeIdx) continue;
        var _py = yScale.getPixelForValue(null, _i, _i);
        var _dist = Math.abs(y - _py);
        if (_dist < _bestDist && (nearest || _dist < _halfH)) {
          _bestDist = _dist;
          _best = { idx: _i, insertBefore: y < _py, markerY: _py + (y < _py ? -_halfH : _halfH) };
        }
      }
      return _best;
    },

    // The Y axis whose label column a canvas-relative point is in: 'left' (from the
    // canvas' left edge to the plot area), 'right' (past the plot area, when the chart has
    // a right axis), or null
    _hecYAxisSideAt: function (x, y) {
      var _a = this.chartArea;
      if (!_a || y < _a.top || y > _a.bottom) return null;
      if (x >= 0 && x < _a.left) return 'left';
      if (x > _a.right && this._hecValueYAxes().some(function (a) { return a.side === 'right'; })) return 'right';
      return null;
    },

    // The zone of this chart a canvas-relative point is in — the payload's `zone`
    // (Chart Custom.js.md §2), so the card never reads this chart's layout itself:
    // 'linkMarker', 'lockAndHandle', 'legend' (its band, whole width), 'yAxis' (left of
    // the plot area), 'plot', or 'other'
    _hecZoneAt: function (x, y) {
      if (this._hecInLinkMarkerZone(x, y)) return 'linkMarker';
      if (this._hecInLockAndHandleZone(x, y)) return 'lockAndHandle';
      var _l = this.legend, _a = this.chartArea;
      if (_l && _l.height > 0 && y >= _l.top && y <= _l.bottom) return 'legend';
      if (_a && y >= _a.top && y <= _a.bottom) {
        if (this._hecYAxisSideAt(x, y)) return 'yAxis';
        if (x >= _a.left && x <= _a.right) return 'plot';
      }
      return 'other';
    },

    // Where a canvas-relative x is along the time axis: 0 at the plot area's left edge,
    // 1 at its right edge (outside: below 0 or above 1), or undefined before layout
    _hecPlotFactor: function (x) {
      var _a = this.chartArea;
      return (_a && _a.right > _a.left) ? (x - _a.left) / (_a.right - _a.left) : undefined;
    },

    // Client rectangle ({left, top, right, bottom}) of legend label legendIdx, else of
    // Y axis row yIdx (timeline/arrowline, the whole label column), else null — where
    // the card anchors a menu opened from a label
    _hecLabelRect: function (legendIdx, yIdx) {
      if (!this.canvas) return null;
      var _r = this.canvas.getBoundingClientRect();
      var _b = legendIdx >= 0 && this.legend && this.legend.legendHitBoxes ? this.legend.legendHitBoxes[legendIdx] : null;
      if (_b) return { left: _r.left + _b.left, top: _r.top + _b.top, right: _r.left + _b.left + _b.width, bottom: _r.top + _b.top + _b.height };
      var _ys = this.scales && this.scales['y-axis-0'];
      var _n = this.data && this.data.labels ? this.data.labels.length : 0;
      if (yIdx < 0 || !_ys || !_n || !this.chartArea) return null;
      var _py = _ys.getPixelForValue(null, yIdx, yIdx), _h = _ys.height / _n / 2;
      return { left: _r.left, top: _r.top + _py - _h, right: _r.left + this.chartArea.left, bottom: _r.top + _py + _h };
    },

    // The element other than a curve's — a bar, a timeline's or an arrowline's segment —
    // at this point, by the picking rule (_hecPickNearest, on each element's rectangle):
    // the one under it, else the nearest one if near enough and clearly nearer than the
    // next; else null
    _hecElementAt: function (x, y) {
      var me = this, els = [];
      (me.data.datasets || []).forEach(function (ds, i) {
        var meta = me.getDatasetMeta(i);
        if (meta.dataset || !me.isDatasetVisible(i)) return;
        (meta.data || []).forEach(function (el) { if (el._view && !el._view.skip) els.push(el); });
      });
      var _i = _hecPickNearest(els.map(function (el) {
        var v = el._view, b = v.height !== undefined
          ? { l: v.x, r: v.x + v.width, t: v.y, b: v.y + v.height }                      // (a timeline's segment)
          : { l: v.x - v.width / 2, r: v.x + v.width / 2, t: Math.min(v.y, v.base), b: Math.max(v.y, v.base) };   // (a bar)
        var cx = Math.max(b.l, Math.min(x, b.r)), cy = Math.max(b.t, Math.min(y, b.b));
        return { d: Math.sqrt((cx - x) * (cx - x) + (cy - y) * (cy - y)), x: cx, y: cy };
      }));
      return _i >= 0 ? els[_i] : null;
    },

    // The curve (line dataset index) at this point, by the picking rule (_hecPickNearest):
    // each shown line's point nearest it, along its drawn path — its points joined
    // straight, or in steps for a stepped line; -1, or PICK_BETWEEN about halfway between
    // two. Two curves drawn on top of each other there: the one drawn over (the first)
    _hecCurveAt: function (px, py) {
      var me = this;
      var _m = _hecPickMargin();
      var _cands = (me.data.datasets || []).map(function (ds, i) {
        var meta = me.getDatasetMeta(i);
        if (!meta.dataset || !me.isDatasetVisible(i)) return null;
        var pts = (meta.data || []).filter(function (p) { return p._view && !p._view.skip; })
          .map(function (p) { return p._view; });
        var st = ds.steppedLine, best = null;
        for (var k = 1; k < pts.length; k++) {
          var a = pts[k - 1], b = pts[k];
          // (only the segments around the point can be near it)
          if (Math.max(a.x, b.x) < px - _m || Math.min(a.x, b.x) > px + _m) continue;
          var path = !st ? [a, b]
            : st === 'middle' ? [a, { x: (a.x + b.x) / 2, y: a.y }, { x: (a.x + b.x) / 2, y: b.y }, b]
            : st === 'after' ? [a, { x: a.x, y: b.y }, b]
            : [a, { x: b.x, y: a.y }, b];
          for (var j = 1; j < path.length; j++) {
            var n = _hecSegmentNearest(px, py, path[j - 1].x, path[j - 1].y, path[j].x, path[j].y);
            if (!best || n.d < best.d) best = n;
          }
        }
        return best;
      });
      return _hecPickNearest(_cands);
    },

    // Curve i's value drawn on the plot area nearest x along the time axis (never a
    // curve-shaping point), or null
    _hecNearestValueOf: function (i, x) {
      var _best = null, _d = Infinity;
      this._hecOnlyDrawnPoints(this.getDatasetMeta(i).data || []).forEach(function (el) {
        if (el._view.hecVirtual) return;
        var d = Math.abs(el._view.x - x);
        if (d < _d) { _d = d; _best = el; }
      });
      return _best;
    },

    // The elements of a hit-test drawn on the plot area (not skipped, not clipped out)
    _hecOnlyDrawnPoints: function (elements) {
      var me = this;
      if (!elements.length || !me.chartArea) return elements;
      return elements.filter(function (el) {
        var v = el._view;
        if (!v || v.skip) return false;
        return v.x >= me.chartArea.left && v.x <= me.chartArea.right &&
               v.y >= me.chartArea.top && v.y <= me.chartArea.bottom;
      });
    },

    // Is a page element part of this graph — its canvas, or one of its relay zones? (the
    // pointer going from one to another hasn't left the graph)
    _hecInGraph: function (el) {
      return !!el && (el === this.canvas || el._hecChart === this);
    },

    // ── A gesture resolved: its payload, given to the card (customEvent) ──

    // The customEvent payload for a gesture at canvas-relative (x, y) — its common part,
    // described in Chart Custom.js.md §2; `extra` adds the gesture's own fields. The one
    // place a payload is built, for this chart's gestures and for the dragovergraph a
    // drag from another chart sends it.
    _hecPayload: function (gestureType, x, y, native, extra) {
      var _r = this.canvas ? this.canvas.getBoundingClientRect() : { left: 0, top: 0 };
      var _legendIdx = this._hecLegendIndexAt(x, y);
      var _yIdx = this._hecYAxisIndexAt(x, y);
      var payload = {
        chart: this,
        gestureType: gestureType,
        x: x,
        y: y,
        clientX: _r.left + x,
        clientY: _r.top + y,
        zone: this._hecZoneAt(x, y),
        xFactor: this._hecPlotFactor(x),
        legendIndex: _legendIdx,
        legendPart: _legendIdx >= 0 ? this._hecLegendPartAt(_legendIdx, x) : null,
        yAxisIndex: _yIdx,
        labelRect: this._hecLabelRect(_legendIdx, _yIdx),
        button: native ? native.button : undefined,
        event: native };
      var _hb = this._hecHandleButtonFields(x, y);
      for (var hk in _hb) payload[hk] = _hb[hk];
      // (a contact on the plot area: the curve it's on, by the picking rule)
      if (payload.zone === 'plot' && (gestureType === 'click' || gestureType === 'dblclick' || gestureType === 'longpress')) {
        var _ci = this._hecCurveAt(x, y);
        payload.curveIndex = _ci >= 0 ? _ci : -1;
        if (_ci === PICK_BETWEEN) payload.curveBetween = true;
      }
      if (this._hecHasYAxisLock()) payload.yAxisLocked = !!this._hecYAxisLock;
      if (extra) { for (var k in extra) payload[k] = extra[k]; }
      return payload;
    },

    // On one of the controls drawn over the graph's top left corner (lock+handle, chain
    // icon), as picked (_hecTopTargetAt): never a label's
    _hecOnControl: function (x, y) {
      var _t = this._hecTopTargetAt(x, y);
      return _t === 'lockAndHandle' || _t === 'linkMarker';
    },

    /**
        * @private
        * Generic pointer/wheel gesture state machine feeding options.customEvent and
        * options.panX/zoomX. See the comment block in handleEvent above
        * for provenance of the timing constants and structure.
        */
    // (cfg: the detector's fixed constants; the long-press duration and the immobility
    // distance are the pointer type's — Chart.defaults.global.gestures, see
    // Chart.hecGestures)
    _hecGestureHandler: function (e, cfg) {
      var h = GESTURE_EVENTS[e.type];
      if (!h) return;
      var _pt = e.native && e.native.pointerType ? e.native.pointerType : 'mouse';
      var _g = Chart.hecGestures(_pt);
      pickPointerType = _pt;
      h({ me: this, e: e, gs: this._hecGesture,
        cfg: helpers.extend({}, cfg, { longPressMs: _g.longPressMs, dragSlop: _g.slop }),
        pid: e.native && e.native.pointerId !== undefined ? e.native.pointerId : 0,
        pointerType: _pt });
    },

    // ── The Y axes: their ranges, their lock, their labels inside the plot ──

    // Y-axis lock state — high-level default behavior, on by default (see
    // options.yAxisLockEnabled), fully owned by Chart.js: the lock icon itself,
    // its click (toggle lock on/off), automatic engagement on zoom/pan/longpress/
    // dblclick (see _hecSetYRanges below), disengaging the forced min/max so
    // the axis goes back to auto-computing from the data, AND syncing the
    // dedicated touch overlay's touch-action from that same lock/click-armed
    // state. Icon SVG/positioning matches the card's original
    // createScaleLockIconHtml, drawn as a floating element over the canvas
    // instead of card-side HTML.
    // The Y axes a gesture moves — those of a line or bar chart (a timeline's or an
    // arrowline's rows don't move): { opts, scale, side ('left', 'right') }, the left one
    // first. Every Y gesture (pan, pinch, Shift+wheel) and the lock go through these.
    _hecValueYAxes: function () {
      var me = this;
      if (me.config.type === 'timeline' || me.config.type === 'arrowline' || !me.options.scales || !me.scales) return [];
      return (me.options.scales.yAxes || []).map(function (o, i) {
        return { opts: o, scale: me.scales[o.id || 'y-axis-' + i], side: o.position === 'right' ? 'right' : 'left' };
      }).filter(function (a) { return a.scale; });
    },

    // The current range of each Y axis (see _hecValueYAxes): [[min, max], ...]
    _hecYRanges: function () {
      return this._hecValueYAxes().map(function (a) { return [a.scale.min, a.scale.max]; });
    },

    // Sets the range of each Y axis (ranges: one [min, max] per axis of _hecValueYAxes;
    // an undefined one leaves that axis as it is) — a range set by hand engages the lock
    _hecSetYRanges: function (ranges) {
      var me = this;
      me._hecValueYAxes().forEach(function (a, i) {
        if (!ranges[i]) return;
        a.opts.ticks.min = ranges[i][0];
        a.opts.ticks.max = ranges[i][1];
        a.opts.ticks.removeEdgeTicks = true;
      });
      if (!me._hecYAxisLock) me._hecYAxisLock = 2;
      me.update();
    },

    // Gives every Y axis back its own range (its configured ymin / ymax, else the data's)
    // and releases the lock
    _hecReleaseYAxes: function () {
      var me = this;
      (me.options.scales && me.options.scales.yAxes || []).forEach(function (o) {
        var _t = o.ticks || {};
        _t.min = _t.forceMin;
        _t.max = _t.forceMax;
        _t.removeEdgeTicks = false;
      });
      me._hecYAxisLock = 0;
    },

    // Does this chart have a Y axis lock (the padlock)?
    _hecHasYAxisLock: function () {
      return this.options.yAxisLockEnabled !== false && this.config.type !== 'timeline' && this.config.type !== 'arrowline' &&
        !!(this.options.scales && this.options.scales.yAxes && this.options.scales.yAxes.length);
    },

    // Public (Chart Custom.js.md §1): locks or releases the Y axes, as a click on the padlock
    hecSetYAxisLocked: function (locked) {
      if (this._hecHasYAxisLock() && !!this._hecYAxisLock !== !!locked) this._hecToggleYAxisLock();
    },

    // Toggles the Y-axis lock on/off: locked, each Y axis keeps the range it shows; released,
    // it gets its own back (_hecReleaseYAxes) — factored out so it can be called from
    // the unified custClick handler on the grouped lock+handle zone below, not
    // just from a native button click anymore.
    _hecToggleYAxisLock: function () {
      var me = this;
      if (!me.options.scales || !me.options.scales.yAxes || !me.options.scales.yAxes.length) return;
      if (me._hecYAxisLock) {
        me._hecReleaseYAxes();
        me._hecUpdateYAxisState();
        me.update();
      } else {
        // (locked: each Y axis keeps the range it shows now, whatever the data — panning
        // or zooming the time no longer rescales it)
        me._hecYAxisLock = 1;
        me._hecUpdateYAxisState();
        me._hecSetYRanges(me._hecYRanges());
      }
    },

    _hecUpdateYAxisState: function () {
      var me = this;
      if (me.options.yAxisLockEnabled === false || !me.canvas) return;
      var _yAxis = me.options.scales && me.options.scales.yAxes && me.options.scales.yAxes[0];
      if (!_yAxis || me.config.type === 'timeline' || me.config.type === 'arrowline') return;
      var _ticks = _yAxis.ticks || {};
      var _forced = _ticks.forceMin !== undefined && _ticks.forceMax !== undefined;

      // Purely visual now, pointer-events:none — the click is handled by the
      // unified custClick handler on the grouped lock+handle zone, same
      // relay-to-canvas pattern as everything else. No more native click.
      var _el = me._hecLockIconEl;
      if (!_el) {
        _el = document.createElement('div');
        _el.style.cssText = 'position:absolute;z-index:10;pointer-events:none;';
        _el.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="var(--primary-text-color)" d="M12,17C10.89,17 10,16.1 10,15C10,13.89 10.89,13 12,13A2,2 0 0,1 14,15A2,2 0 0,1 12,17M18,20V10H6V20H18M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V10C4,8.89 4.89,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"/></svg>';
        me._hecLockIconEl = _el;
      }
      me._hecAttachToCanvasParent(_el);
      _el.style.left = '15px';
      // (its bottom on the handle's ⠿ bottom)
      _el.style.top = '7px';
      var _svg = _el.children[0];
      var _showIcon = !(_forced && !me._hecYAxisLock) && !me._hecHandleButtons();
      if (_svg) _svg.style.display = _showIcon ? 'inherit' : 'none';
      _el.style.opacity = (me._hecYAxisLock) ? '1.0' : '0.3';

      // Y-axis touch overlay — exists only so touch-action applies to this small
      // zone instead of the whole canvas (a change to touch-action after a
      // gesture has already started has no effect, so it can't be toggled
      // dynamically on the canvas itself — it must be a separate element,
      // static in position, always present). touch-action follows the lock
      // state alone: none while engaged, removed once disengaged — nothing
      // else. Forwards every event it receives straight to the canvas so
      // Chart.js's own gesture handling still does 100% of the actual work.
      // (one per Y axis: the left one's label column, and the right one's when there is one)
      // (labels drawn inside the plot: the column along them — see _hecInsideLabelColumns)
      if (me.chartArea) {
        var _hasRight = me._hecValueYAxes().some(function (a) { return a.side === 'right'; });
        var _inCols = me._hecInsideLabelColumns('touch');
        var _col = function (side, x, w) {
          var _c = _inCols.filter(function (c) { return c.side === side; })[0];
          return _c ? [_c.left, _c.right - _c.left] : [x, w];
        };
        var _l = _col('left', 0, me.chartArea.left), _r = _col('right', me.chartArea.right, me.width - me.chartArea.right);
        [['_hecYAxisTouchEl', _l[0], _l[1], true],
         ['_hecRightYAxisTouchEl', _r[0], _r[1], _hasRight]].forEach(function (z) {
          if (!z[3]) { if (me[z[0]]) me[z[0]].style.display = 'none'; return; }
          var _yo = me._hecTouchOverlay(z[0], 'ns-resize');
          _yo.style.display = '';
          _yo.style.left = (me.canvas.offsetLeft + z[1]) + 'px';
          _yo.style.top = (me.canvas.offsetTop + me.chartArea.top) + 'px';
          _yo.style.width = z[2] + 'px';
          _yo.style.height = (me.chartArea.bottom - me.chartArea.top) + 'px';
          _yo.style.touchAction = (me._hecYAxisLock || me._hecYAxisClickArmed) ? 'none' : '';
        });
      }
    },

    // The column of an axis' labels drawn inside the plot (ticks.mirror): along the plot's
    // edge, as wide as the labels' boxes, and the pointer's precision more (pointerType:
    // 'mouse', 'pen', 'touch') — { side, left, right } for each such axis
    _hecInsideLabelColumns: function (pointerType) {
      var me = this, _a = me.chartArea, _slop = Chart.hecGestures(pointerType || 'touch').slop;
      if (!_a) return [];
      return me._hecValueYAxes().filter(function (a) { return a.scale.options.ticks.mirror; }).map(function (a) {
        var _boxes = a.scale._hecLabelBoxes || [];
        var _w = _boxes.length ? Math.max.apply(null, _boxes.map(function (b) { return a.side === 'left' ? b.x + b.w - _a.left : _a.right - b.x; })) : 24;
        return a.side === 'left' ? { side: 'left', left: _a.left, right: Math.min(_a.right, _a.left + _w + _slop) }
                                 : { side: 'right', left: Math.max(_a.left, _a.right - _w - _slop), right: _a.right };
      });
    },

    // The axis whose labels drawn inside the plot a canvas-relative point is near (see
    // _hecInsideLabelColumns): 'left', 'right' or null. A point there is on the plot as
    // well — what it's for depends on the gesture: a drag (a mouse's, a finger's or a pen's
    // after a tap) is the axis', a click, a long press or a hover the curves'
    _hecInsideLabelSideAt: function (x, y, pointerType) {
      var _a = this.chartArea;
      if (!_a || y < _a.top || y > _a.bottom) return null;
      var _c = this._hecInsideLabelColumns(pointerType).filter(function (c) { return x >= c.left && x <= c.right; })[0];
      return _c ? _c.side : null;
    },

    // The labels drawn inside the plot of the axis on side ('left', 'right', or null: none)
    // the pointer is near (_hecInsideLabelSideAt): their boxes drawn opaque
    // (ticks.hecBackdrop), as the pointer points them out
    _hecSetLabelsHovered: function (side) {
      if ((this._hecLabelsHovered || null) === (side || null)) return;
      this._hecLabelsHovered = side || null;
      this.render({ duration: 0, lazy: true });
    },

    // ── The controls at the top left: the lock+handle zone, its buttons, the chain icon, their boxes ──

    // Whether the lock+handle zone shows anything: the handle, the padlock or handleButtons
    _hecHasControls: function () {
      return this.options.moveHandleVisible !== false || this._hecHasYAxisLock() || !!this._hecHandleButtons();
    },

    // Grouped lock+handle zone (canvas-relative): top-left 0-33px × 0-28px — the move
    // handle (0-15px) and the lock icon (15-33px), see _hecUpdateDragTouchOverlays; 18px
    // per button when options.handleButtons shows more than one — picked among the small
    // targets above the plot area (_hecTopTargetAt): on it, or just beside it. The chain
    // icon, drawn over its top edge, wins where they overlap.
    _hecInLockAndHandleZone: function (x, y) {
      return this._hecTopTargetAt(x, y) === 'lockAndHandle';
    },

    _hecLockAndHandleWidth: function () {
      var b = this._hecHandleButtons();
      return b ? Math.max(33, b.length * 18) : 33;
    },

    // The buttons shown in the lock+handle zone instead of the handle and the padlock
    // (options.handleButtons), or null
    _hecHandleButtons: function () {
      var b = this.options.handleButtons;
      return b && b.length ? b : null;
    },

    // The button of options.handleButtons picked at (x, y) (_hecPick, on each one's icon):
    // the button, PICK_BETWEEN about halfway between two, or null — clearly beside them, on
    // a legend label or on the chain icon
    _hecHandleButtonAt: function (x, y) {
      var b = this._hecHandleButtons();
      if (!b || this._hecInLinkMarkerZone(x, y)) return null;
      var lh = this.legend && this.legend.legendHitBoxes;
      for (var i = 0; lh && i < lh.length; i++) {
        if (x >= lh[i].left && x <= lh[i].left + lh[i].width && y >= lh[i].top && y <= lh[i].top + lh[i].height) return null;
      }
      // (each icon: its slot of the zone, less 3px on each side and 4px above and below)
      var _w = this._hecLockAndHandleWidth() / b.length;
      var rects = b.map(function (btn, k) { return { x: k * _w + 3, y: 4, width: _w - 6, height: 20 }; });
      var _i = _hecPick(x, y, rects);
      return _i === PICK_BETWEEN ? PICK_BETWEEN : _i >= 0 ? b[_i] : null;
    },

    // The payload fields of the handleButtons button picked at (x, y): handleButton and
    // handleButtonDisabled, or handleButtonBetween about halfway between two
    _hecHandleButtonFields: function (x, y) {
      var _hb = this._hecHandleButtonAt(x, y);
      if (_hb === PICK_BETWEEN) return { handleButtonBetween: true };
      return _hb ? { handleButton: _hb.id, handleButtonDisabled: !!_hb.disabled } : {};
    },

    // Graph reorder handle symbol (⠿) — purely visual, pointer-events:none.
    // The actual gesture (drag to reorder) is handled by the separate
    // _hecMoveHandleTouchEl overlay in _hecUpdateDragTouchOverlays below, same
    // relay-to-canvas pattern as everything else. Matches the card's original
    // #mo-N appearance exactly (⠿ character, opacity 0.5, secondary text color).
    _hecUpdateMoveHandleIcon: function () {
      var me = this;
      if (!me.canvas) return;
      var _el = me._hecMoveHandleIconEl;
      if (!_el) {
        _el = document.createElement('div');
        _el.style.cssText = 'position:absolute;z-index:10;width:15px;height:28px;display:flex;align-items:flex-end;padding-left:2px;padding-bottom:3px;color:var(--secondary-text-color);font-size:14px;opacity:0.5;user-select:none;pointer-events:none;';
        _el.textContent = '\u283F';
        me._hecMoveHandleIconEl = _el;
      }
      me._hecAttachToCanvasParent(_el);
      _el.style.left = me.canvas.offsetLeft + 'px';
      _el.style.top = me.canvas.offsetTop + 'px';
      _el.style.display = me.options.moveHandleVisible === false || me._hecHandleButtons() ? 'none' : 'flex';
    },

    // options.handleButtons drawn over the lock+handle zone, in place of the handle and
    // the padlock: each its text (an icon); a disabled one greyed and struck through in
    // red. Purely visual (pointer-events:none), like the icons it replaces — a click on
    // one reaches customEvent with its id (payload.handleButton)
    _hecUpdateHandleButtons: function () {
      var me = this;
      var b = me._hecHandleButtons();
      var _el = me._hecHandleButtonsEl;
      if (!b) {
        if (_el) _el.style.display = 'none';
        return;
      }
      if (!me.canvas) return;
      if (!_el) {
        _el = document.createElement('div');
        _el.style.cssText = 'position:absolute;z-index:10;height:28px;pointer-events:none;user-select:none;';
        me._hecHandleButtonsEl = _el;
      }
      me._hecAttachToCanvasParent(_el);
      _el.style.left = me.canvas.offsetLeft + 'px';
      _el.style.top = me.canvas.offsetTop + 'px';
      _el.style.display = 'flex';
      // (rebuilt only when they change: called at each draw)
      var _key = JSON.stringify(b);
      if (_el._hecKey === _key) return;
      _el._hecKey = _key;
      _el.innerHTML = '';
      var _w = me._hecLockAndHandleWidth() / b.length;
      b.forEach(function (btn) {
        var _s = document.createElement('div');
        _s.style.cssText = 'position:relative;width:' + _w + 'px;height:28px;display:flex;align-items:center;justify-content:center;' +
          'font-size:14px;color:var(--primary-text-color);' + (btn.disabled ? 'opacity:0.45;' : '');
        _s.textContent = btn.text;
        if (btn.disabled) {
          var _bar = document.createElement('div');
          _bar.style.cssText = 'position:absolute;inset:4px 2px;background:linear-gradient(to top right,transparent calc(50% - 1px),var(--error-color,#f44336) calc(50% - 1px),var(--error-color,#f44336) calc(50% + 1px),transparent calc(50% + 1px));';
          _s.appendChild(_bar);
        }
        _el.appendChild(_s);
      });
    },

    // Linked-graphs marker (chain icon), shown while options.linkMarkerVisible is
    // true: straddling this chart's top edge, under the Y axis labels of the graph
    // above (an empty spot — centered on the top it would cover this chart's legend).
    // Canvas-relative rectangle, or null when hidden.
    // (right above the lock+handle zone, it would sit on it — then just right of it)
    _hecLinkMarkerRect: function () {
      if (this.options.linkMarkerVisible !== true || !this.chartArea) return null;
      var _left = Math.max(0, Math.round(this.chartArea.left / 2) - 11);
      var _zone = this._hecHasControls() ? this._hecLockAndHandleWidth() : 0;
      if (_zone && _left < _zone + 4) _left = _zone + 4;
      return { left: _left, top: -23, width: 22, height: 22 };
    },

    // The chain icon: on it, or just beside it (_hecTopTargetAt)
    _hecInLinkMarkerZone: function (x, y) {
      return this._hecTopTargetAt(x, y) === 'linkMarker';
    },

    // The chain icon itself: a relay zone like the others (_hecTouchOverlay) — its
    // gestures reach customEvent like any other on this chart, with zone 'linkMarker'
    // (the card merges the two graphs on a double-click). options.linkMarkerTitle:
    // its hover text, given by the card.
    _hecUpdateLinkMarker: function () {
      var me = this;
      var _r = me._hecLinkMarkerRect();
      var _el = me._hecLinkMarkerEl;
      if (!_r) {
        if (_el) _el.style.display = 'none';
        return;
      }
      if (!_el) {
        _el = me._hecTouchOverlay('_hecLinkMarkerEl', 'pointer');
        _el.style.zIndex = '2';
        _el.style.alignItems = 'center';
        _el.style.justifyContent = 'center';
        _el.style.borderRadius = '50%';
        _el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" style="pointer-events:none;"><path fill="var(--primary-text-color)" d="M10.59,13.41C11,13.8 11,14.44 10.59,14.83C10.2,15.22 9.56,15.22 9.17,14.83C7.22,12.88 7.22,9.71 9.17,7.76V7.76L12.71,4.22C14.66,2.27 17.83,2.27 19.78,4.22C21.73,6.17 21.73,9.34 19.78,11.29L18.29,12.78C18.3,11.96 18.17,11.14 17.89,10.36L18.36,9.88C19.54,8.71 19.54,6.81 18.36,5.64C17.19,4.46 15.29,4.46 14.12,5.64L10.59,9.17C9.41,10.34 9.41,12.24 10.59,13.41M13.41,9.17C13.8,8.78 14.44,8.78 14.83,9.17C16.78,11.12 16.78,14.29 14.83,16.24V16.24L11.29,19.78C9.34,21.73 6.17,21.73 4.22,19.78C2.27,17.83 2.27,14.66 4.22,12.71L5.71,11.22C5.7,12.04 5.83,12.86 6.11,13.65L5.64,14.12C4.46,15.29 4.46,17.19 5.64,18.36C6.81,19.54 8.71,19.54 9.88,18.36L13.41,14.83C14.59,13.66 14.59,11.76 13.41,10.59C13,10.2 13,9.56 13.41,9.17Z"/></svg>';
      }
      me._hecAttachToCanvasParent(_el);
      _el.style.display = 'flex';
      // (in a box like the other controls' — options.hecControlsBackdrop — else half see-through)
      _el.style.background = me.options.hecControlsBackdrop ? hecUi.background(me.canvas, hecUi.BOX_OPACITY) :
        'color-mix(in srgb, var(--primary-background-color) 50%, transparent)';
      _el.style.left = (me.canvas.offsetLeft + _r.left) + 'px';
      _el.style.top = (me.canvas.offsetTop + _r.top) + 'px';
      _el.style.width = _r.width + 'px';
      _el.style.height = _r.height + 'px';
      _el.title = me.options.linkMarkerTitle || '';
    },

    // options.hecControlsBackdrop (true): the controls at the graph's top left — the
    // lock+handle zone, the chain icon — each drawn in a rounded box like the Y labels', over the
    // legend's labels, which keep no room for them (a narrow card: they take no height). On
    // the box, a gesture is the control's; beside it, on a label, the label's (_hecTopTargetAt)
    _hecUpdateControlsBackdrop: function () {
      var me = this, _bd = me.options.hecControlsBackdrop;
      var _el = me._hecControlsBackdropEl;
      if (!_bd || !me.canvas || !me._hecHasControls()) {
        if (_el) _el.style.display = 'none';
        return;
      }
      if (!_el) {
        _el = document.createElement('div');
        _el.style.cssText = 'position:absolute;z-index:9;border-radius:6px;pointer-events:none;';
        me._hecControlsBackdropEl = _el;
      }
      me._hecAttachToCanvasParent(_el);
      _el.style.display = '';
      _el.style.background = hecUi.background(me.canvas, hecUi.BOX_OPACITY);
      _el.style.left = (me.canvas.offsetLeft + 1) + 'px';
      _el.style.top = (me.canvas.offsetTop + 2) + 'px';
      _el.style.width = (me._hecLockAndHandleWidth() - 2) + 'px';
      _el.style.height = '24px';
    },

    // ── The legend's fonts, and texts shown in full where they're shortened or hidden ──

    // The font of the legend's labels
    _hecLegendFont: function () {
      var lo = (this.legend && this.legend.options.labels) || {}, gd = Chart.defaults.global;
      return helpers.fontString(helpers.valueOrDefault(lo.fontSize, gd.defaultFontSize), helpers.valueOrDefault(lo.fontStyle, gd.defaultFontStyle),
                                helpers.valueOrDefault(lo.fontFamily, gd.defaultFontFamily));
    },

    // The font of a timeline's or arrowline's row names (its Y axis' ticks)
    _hecRowLabelFont: function () {
      var _s = this.scales && this.scales['y-axis-0'], t = (_s && _s.options.ticks) || {}, gd = Chart.defaults.global;
      return helpers.fontString(helpers.valueOrDefault(t.fontSize, gd.defaultFontSize), helpers.valueOrDefault(t.fontStyle, gd.defaultFontStyle),
                                helpers.valueOrDefault(t.fontFamily, gd.defaultFontFamily));
    },

    // A text shortened or hidden at a canvas-relative point, to show in full where it is
    // (Chart.hecUi.reveal): a legend's label shortened (legend.labels.hecShortNames), a
    // timeline's or arrowline's row name cut to fit its column, a timeline's state its bar
    // is too narrow for (not on a click: that one opens the tooltip) — { text, left, right,
    // top, bottom (client), align, font }, or null
    _hecRevealAt: function (x, y, click) {
      var me = this, _a = me.chartArea, _c = me.canvas.getBoundingClientRect(), ctx = me.ctx;
      var at = function (o) { return { text: o.text, font: o.font, align: o.align, left: _c.left + o.left, right: _c.left + o.right, top: _c.top + o.top, bottom: _c.top + o.bottom }; };
      var width = function (text, font) { ctx.save(); ctx.font = font; var w = ctx.measureText(text).width; ctx.restore(); return w; };
      var _li = me._hecLegendIndexAt(x, y);
      if (_li >= 0) {
        var it = me.legend.legendItems[_li], hb = me.legend.legendHitBoxes[_li];
        if (!it || !hb || !it.hecFullText || it.hecFullText === it.text) return null;
        var _lf = me._hecLegendFont(), _tail = Chart.hecLegendTail(it), _right = hb.left + hb.width;
        return at({ text: it.hecFullText + _tail, font: _lf, align: 'left', left: _right - width(it.text + _tail, _lf), right: _right, top: hb.top, bottom: hb.top + hb.height });
      }
      var _rows = me.config.type === 'timeline' || me.config.type === 'arrowline';
      if (!_rows || !_a || y < _a.top || y > _a.bottom) return null;
      if (x < _a.left) {
        var _yi = me._hecYAxisIndexAt(x, y), _full = _hecTruncatedRowLabel(me, _yi);
        if (!_full) return null;
        var _py = me.scales['y-axis-0'].getPixelForValue(null, _yi, _yi), _rf = me._hecRowLabelFont();
        var _fs = helpers.valueOrDefault((me.scales['y-axis-0'].options.ticks || {}).fontSize, Chart.defaults.global.defaultFontSize);
        // (over all its lines, as wrapped: none of them shows through)
        ctx.save(); ctx.font = _rf; var _n = _hecRowLabelLines(me, _yi, ctx).length; ctx.restore();
        var _bh = _n * _fs * 1.2 + 6;
        return at({ text: _full, font: _rf, align: 'right', left: 0, right: _a.left - 6, top: _py - _bh / 2, bottom: _py + _bh / 2 });
      }
      if (click || me.config.type !== 'timeline') return null;
      var el = me._hecElementAt(x, y), v = el && el._view, eo = me.options.elements || {};
      if (!v || !v.text || x < v.x || x > v.x + v.width || y < v.y || y > v.y + v.height) return null;
      var _sf = eo.font || 'bold 12px "Helvetica Neue", Helvetica, Arial, sans-serif', _pad = eo.textPadding || 0;
      var _tw = width(String(v.text), _sf);
      // (drawn when it fits — deps/timeline.js)
      if (_tw > 0 && _tw + _pad + 2 < v.width) return null;
      return at({ text: String(v.text), font: _sf, align: 'left', left: v.x + _pad, right: v.x + _pad + _tw, top: v.y, bottom: v.y + v.height });
    },

    // Shows r (_hecRevealAt) in full, kept while hovered (sticky) or for its reading time;
    // r null: the one kept while hovered closes
    _hecShowReveal: function (r, sticky) {
      var me = this, _bSel = me.options.floatingBoundsSelector;
      if (!r) {
        if (sticky && me._hecRevealKey) Chart.hecUi.closeReveal(me.canvas, true);
        me._hecRevealKey = null;
        return;
      }
      var _key = r.text + '|' + Math.round(r.left) + '|' + Math.round(r.top);
      if (sticky && me._hecRevealKey === _key) return;
      me._hecRevealKey = sticky ? _key : null;
      Chart.hecUi.reveal(r, sticky, me.canvas, _bSel && me.canvas.closest ? me.canvas.closest(_bSel) : null);
    },

    // A hover (a mouse, a pen above the screen) over a text shortened or hidden shows it in
    // full while it stays there (options.labelTooltipEnabled) — e null: the pointer left
    _hecUpdateReveal: function (e) {
      if (this.options.labelTooltipEnabled === false) return;
      this._hecShowReveal(e && e.x !== null && e.y !== null ? this._hecRevealAt(e.x, e.y, false) : null, true);
    },

    // ── The values over the graph (hecSetValues) ──

    // Public (Chart Custom.js.md §1): the values shown over the chart, given by its owner —
    // values null: none. { layout: 'row' | 'narrow', states: [{ curve, key, text, unit,
    // color }], stats: [{ curve, key, name, color, cells: [{ stat, label, value, time }] }],
    // format(curve, y, x) → { text, unit, time } }: each curve's value now (states, in a
    // row; 'narrow': the first one large, the others small in a column on its right, each
    // cut rather than wrapped), its statistics (stats: name — null with only one curve
    // showing them —, then a cell each), all in the given colors; format: a value of curve
    // at a point, as states show it (the point a hover is on: shown in its curve's place).
    // A click on a value now reaches customEvent (zone 'value', curveIndex); a text cut
    // ('…') is shown in full in place while hovered, and on a click (Chart.hecUi.reveal)
    hecSetValues: function (values) {
      this._hecValues = values || null;
      this._hecRenderValues();
    },

    // The values over the chart (hecSetValues): an element of their own right above the
    // chart's box (its canvas' parent), in the page's flow — gone without values
    _hecRenderValues: function () {
      var me = this, v = me._hecValues, _box = me.canvas && me.canvas.parentNode, _el = me._hecValuesEl;
      if (!v || !_box || !((v.states || []).length || (v.stats || []).length)) {
        if (_el) _el.remove();
        me._hecValuesEl = null;
        return;
      }
      if (!_el) {
        _el = me._hecValuesEl = document.createElement('div');
        _el.style.cssText = 'padding:0 10px 4px 10px;color:var(--primary-text-color)';
        _el.addEventListener('click', function (ev) { me._hecOnValuesClick(ev); });
        _el.addEventListener('mousemove', function (ev) { me._hecRevealValuesCut(ev.target, true); });
        _el.addEventListener('mouseleave', function () { Chart.hecUi.closeReveal(_el, true); });
      }
      if (_el.nextSibling !== _box || _el.parentNode !== _box.parentNode) _box.parentNode.insertBefore(_el, _box);
      var _narrow = v.layout === 'narrow';
      var _cut = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0';
      var state = function (s, size) {
        return '<div class="hec-state' + (_narrow ? ' hec-cut' : '') + '" data-curve="' + s.curve + '" data-key="' + s.key + '" style="color:' + s.color +
          ';font-size:' + size + ';line-height:1.2;cursor:pointer;' + (_narrow ? _cut : '') + '">' + _hecValueHtml(s) + '</div>';
      };
      var html = '', st = v.states || [];
      if (st.length && _narrow && st.length > 1) {
        html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' + state(st[0], '2.2em') +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;min-width:0">' + st.slice(1).map(function (s) { return state(s, '1.3em'); }).join('') + '</div></div>';
      } else if (st.length) {
        html += '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px 16px">' + st.map(function (s) { return state(s, '2.2em'); }).join('') + '</div>';
      }
      (v.stats || []).forEach(function (x) {
        var _aligns = x.cells.length === 1 ? ['left'] : x.cells.length === 2 ? ['left', 'right'] : ['left', 'center', 'right'];
        html += (x.name !== null && x.name !== undefined ? '<div' + (_narrow ? ' class="hec-cut"' : '') + ' style="margin-top:6px;color:' + x.color + ';' +
                  (_narrow ? 'font-size:0.85em;' + _cut : '') + '">' + x.name + '</div>' : '') +
          '<div class="hec-stats" data-curve="' + x.curve + '" data-key="' + x.key + '" style="display:flex;justify-content:space-between;gap:8px;margin-top:4px' + (_narrow ? ';font-size:0.85em' : '') + '">' +
          x.cells.map(function (c, i) {
            return '<div class="hec-stat" data-stat="' + c.stat + '" style="text-align:' + _aligns[i] + '"><div style="font-weight:600">' + c.label + '</div><div>' + c.value + '</div>' +
              (c.time ? '<div style="opacity:0.8">' + c.time + '</div>' : '') + '</div>';
          }).join('') + '</div>';
      });
      _el.innerHTML = html;
      me._hecShowHoveredValue(me._hecHoverDot || null);
    },

    // The point a hover is on (hecHoverDot) shown over the chart in its curve's place, with
    // its time (hecSetValues' format) — el null: the values now back
    _hecShowHoveredValue: function (el) {
      var _el = this._hecValuesEl, v = this._hecValues;
      if (!_el || !v) return;
      _el.querySelectorAll('.hec-state[data-hec-now]').forEach(function (s) { s.innerHTML = s.getAttribute('data-hec-now'); s.removeAttribute('data-hec-now'); });
      var p = el && this.data.datasets[el._datasetIndex] && this.data.datasets[el._datasetIndex].data[el._index];
      var s = p && typeof v.format === 'function' && _el.querySelector('.hec-state[data-curve="' + el._datasetIndex + '"]');
      if (!s) return;
      s.setAttribute('data-hec-now', s.innerHTML);
      s.innerHTML = _hecValueHtml(v.format(el._datasetIndex, p.y, p.x));
    },

    // A click on the values over the chart: on a value now, customEvent (zone 'value',
    // curveIndex); on a text cut, shown in full for a while
    _hecOnValuesClick: function (ev) {
      var me = this, s = ev.target.closest && ev.target.closest('.hec-state');
      if (!s) { me._hecRevealValuesCut(ev.target, false); return; }
      if (typeof me.options.customEvent !== 'function') return;
      me.options.customEvent.call(me, { chart: me, gestureType: 'click', zone: 'value', curveIndex: +s.getAttribute('data-curve'),
        legendIndex: -1, yAxisIndex: -1, clientX: ev.clientX, clientY: ev.clientY, event: ev });
    },

    // A text of the values over the chart cut ('…') at target: shown in full in place —
    // kept while hovered (sticky), else for a while; none: the one kept while hovered closes
    _hecRevealValuesCut: function (target, sticky) {
      var _c = target && target.closest && target.closest('.hec-cut');
      if (!_c || _c.scrollWidth <= _c.clientWidth) { if (sticky) Chart.hecUi.closeReveal(this._hecValuesEl, true); return; }
      var r = _c.getBoundingClientRect(), _bSel = this.options.floatingBoundsSelector;
      Chart.hecUi.reveal({ text: _c.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, align: 'left', font: getComputedStyle(_c).font },
        sticky, _c, _bSel && this.canvas && this.canvas.closest ? this.canvas.closest(_bSel) : null);
    },

    // ── Hover and the tooltip mode: the dot of the value hovered, the samples shown, the tooltip ended ──

    // A click or a tap — released without a drag, a pinch or a long press; never a press
    // alone, a swipe (a scroll or a move of the time) or a pinch. With hover.activateOnContact:
    // on a curve — the nearest one, by the picking rule (_hecCurveAt), not necessarily on
    // one of its points — that curve joins the tooltip mode (several curves can be in it);
    // on the plot area of a chart without curves, or on a bar, the tooltip mode opens on
    // the elements under it (hover.mode), as without contact mode; beside or between the
    // curves, nothing changes; anywhere else, the mode ends. Applied by
    // Controller.handleEvent, right after.
    _hecTap: function (e) {
      var me = this, ho = me.options.hover;
      var _at = e.x !== null && e.y !== null;
      me._hecTapped = true;
      if (ho.activateOnContact === true) {
        if (!_at || me._hecZoneAt(e.x, e.y) !== 'plot') {
          me._hecEndTooltipMode();
          me.active = [];
          return;
        }
        var _ci = me._hecCurveAt(e.x, e.y);
        var _curves = me._hecTooltipCurves || [];
        if (_ci >= 0) {
          if (_curves.indexOf(_ci) < 0) _curves.push(_ci);
          me._hecTooltipCurves = _curves;
          me._hecTooltipMode = true;
          me._hecUpdateHoverDot(null);
          me.active = me._hecHoverElements(e);
          me._hecLastHitXY = { x: e.x, y: e.y };
          return;
        }
        // (beside or between the curves; or no curve in the tooltip mode on a chart with
        // other elements — bars, a timeline — which then work as without contact mode)
        if (_curves.length || !me._hecHasOtherElements()) return;
      }
      me._hecTooltipMode = true;
      var _el = _at ? me._hecElementAt(e.x, e.y) : null;
      me.active = _el ? [_el] : [];
      me._hecLastHitXY = _at ? { x: e.x, y: e.y } : undefined;
    },

    // Whether this chart shows anything else than curves (bars, a timeline, arrows)
    _hecHasOtherElements: function () {
      var me = this;
      return (me.data.datasets || []).some(function (ds, i) {
        return me.isDatasetVisible(i) && !me.getDatasetMeta(i).dataset;
      });
    },

    // The elements the tooltip shows at this point: with curves in the tooltip mode, the
    // value of each of them nearest the point along the time axis; else those under it
    // (hover.mode) — only values drawn on the plot area, never a curve-shaping point
    _hecHoverElements: function (e) {
      var me = this, ho = me.options.hover;
      var _curves = (me._hecTooltipCurves || []).filter(function (i) { return me.isDatasetVisible(i); });
      if (!_curves.length) return me._hecOnlyDrawnPoints(me.getElementsAtEventForMode(e, ho.mode, ho));
      return _curves.map(function (i) { return me._hecNearestValueOf(i, e.x); }).filter(function (el) { return el; });
    },

    // The value a hover shows the dot of (hecHoverDot): the curve the hover is on, by the
    // picking rule (_hecCurveAt, along its drawn path), and its value nearest the pointer
    // along the time axis (_hecNearestValueOf) — as the tooltip mode does; none on a curve
    // showing its points, or between two curves — e null: none
    _hecUpdateHoverDot: function (e) {
      var me = this, el = null;
      if (e && e.x !== null && e.y !== null && !me._hecShowSamples) {
        var _i = me._hecCurveAt(e.x, e.y);
        if (_i >= 0 && !(me.data.datasets[_i].pointRadius > 0)) el = me._hecNearestValueOf(_i, e.x);
      }
      if (el === (me._hecHoverDot || null)) return;
      me._hecHoverDot = el;
      me.render({ duration: 0, lazy: true });
      // (the values over the graph: the hovered one's in its curve's place — _hecShowHoveredValue)
      me._hecShowHoveredValue(el);
    },

    // Shows or hides every sample of the curves (see the hecShowSamples plugin): on while
    // the pointer moves over the chart with Alt (Option) held, off when it moves without,
    // or leaves the chart
    _hecSetShowSamples: function (on) {
      if (!!this._hecShowSamples === on) return;
      this._hecShowSamples = on;
      this.update();
    },

    // The tooltip mode ends: no curve in it any more
    _hecEndTooltipMode: function () {
      this._hecTooltipMode = false;
      this._hecTooltipCurves = null;
    },

    // The tooltip closed at once and its mode ended, the point it showed back to its normal
    // look, no hover dot — a menu opens over the card: nothing of the tooltip stays over it
    hecEndTooltip: function () {
      var me = this;
      me._hecEndTooltipMode();
      me._hecUpdateHoverDot(null);
      if (me.active && me.active.length) me.updateHoverStyle(me.active, me.options.hover.mode, false);
      me.active = [];
      me.lastActive = [];
      me._hecLastHitXY = undefined;
      if (me.tooltip) {
        me.tooltip._active = [];
        me.tooltip.update(true);
        // (removed at once, not faded out: nothing of it over the menu)
        if (me.tooltip._hecHoverTooltipEl) Chart.hecUi.closeFloating(me.tooltip._hecHoverTooltipEl);
      }
      me.render({ duration: 0, lazy: true });
    },

    // Ends the hover: the highlighted points go back to their normal look, fading as the
    // tooltip does (Chart.hecUi.FADE), and the tooltip closes — when the tooltip fades out
    // by itself. A move or a contact on a point opens them again, as before.
    _hecEndHover: function () {
      var me = this;
      if (!me.active || !me.active.length) return;
      me.updateHoverStyle(me.active, me.options.hover.mode, false);
      me.active = [];
      me.lastActive = [];
      if (me.tooltip) {
        me.tooltip._active = [];
        me.tooltip.update(true);
      }
      me.render({ duration: Chart.hecUi.FADE, lazy: true });
    },

    // ── A drag: its target, its feedback (ghost, insertion marker, drop target), the zoom selection ──

    // This chart, or the other one of its dragScope, whose canvas is at a client position
    // (null over none) — the target of a drag
    _hecChartAt: function (clientX, clientY) {
      if (this.canvas) {
        var _r = this.canvas.getBoundingClientRect();
        if (clientX >= _r.left && clientX <= _r.right && clientY >= _r.top && clientY <= _r.bottom) return this;
      }
      return this._hecFindInstanceAt(clientX, clientY);
    },

    // Cross-graph scan — finds whichever OTHER Chart instance's canvas
    // contains this client position, or null. Factored out (per Thierry)
    // from what used to be two separately-written scans: the move-handle's
    // own reorder-target lookup, and the legend/timeline dragovergraph
    // lookup. Both now share this single implementation; each keeps its own
    // logic for what to DO with the result (draw directly vs. dispatch
    // customEvent).
    _hecFindInstanceAt: function (clientX, clientY) {
      var me = this;
      if (!Chart.instances) return null;
      for (var _cid in Chart.instances) {
        var _other = Chart.instances[_cid];
        // (options.dragScope: a drag only reaches the charts that share it — those
        // of the same card, not another one on the same page)
        if (_other === me || !_other.canvas || _other.options.dragScope !== me.options.dragScope) continue;
        var _r = _other.canvas.getBoundingClientRect();
        if (clientX >= _r.left && clientX <= _r.right && clientY >= _r.top && clientY <= _r.bottom) {
          return _other;
        }
      }
      return null;
    },

    // Find the best legend-item insertion point near (cx, cy), from legendHitBoxes
    // (this chart's own data) — the one implementation, also used by the card to
    // place a dropped curve (see Chart Custom.js.md §4). With target=false,
    // just identifies which label is being grabbed (source lookup). With
    // target=true, additionally computes the insertion marker's position
    // (midpoint between neighboring labels, or a fixed margin at either
    // end) and detects a would-be no-op move.
    _hecFindLegendLabel: function (cx, cy, excludeIdx, target) {
      var me = this;
      var hitBoxes = me.legend && me.legend.legendHitBoxes;
      if (!hitBoxes || hitBoxes.length === 0) return null;

      var lines = [];
      for (var i = 0; i < hitBoxes.length; i++) {
        if (target && i === excludeIdx) continue;
        var b = hitBoxes[i];
        var line = null;
        for (var li2 = 0; li2 < lines.length; li2++) {
          if (Math.abs(lines[li2].top - b.top) <= 4) { line = lines[li2]; break; }
        }
        if (!line) { line = { top: b.top, height: b.height, items: [] }; lines.push(line); }
        line.items.push({ b: b, i: i });
      }
      if (lines.length === 0) return null;

      var closestLine = null, closestDistY = Infinity;
      for (var lj = 0; lj < lines.length; lj++) {
        var midY = lines[lj].top + lines[lj].height / 2;
        var dist = Math.abs(cy - midY);
        if (dist < closestDistY) { closestDistY = dist; closestLine = lines[lj]; }
      }
      if (!closestLine) return null;
      if (cy < closestLine.top || cy > closestLine.top + closestLine.height) return null;

      var firstItem = closestLine.items[0], lastItem = closestLine.items[0];
      for (var ii = 1; ii < closestLine.items.length; ii++) {
        if (closestLine.items[ii].b.left < firstItem.b.left) firstItem = closestLine.items[ii];
        if (closestLine.items[ii].b.left + closestLine.items[ii].b.width > lastItem.b.left + lastItem.b.width) lastItem = closestLine.items[ii];
      }
      var lineLeft = firstItem.b.left;
      var lineRight = lastItem.b.left + lastItem.b.width;
      if (cx < lineLeft) {
        var tolLeft = Math.min(firstItem.b.width / 2, 50);
        if (lineLeft - cx > tolLeft) return null;
      } else if (cx > lineRight) {
        var tolRight = Math.min(lastItem.b.width / 2, 50);
        if (cx - lineRight > tolRight) return null;
      }

      var closest = null, closestDistX = Infinity;
      for (var ik = 0; ik < closestLine.items.length; ik++) {
        var _b = closestLine.items[ik].b;
        var _midX = _b.left + _b.width / 2;
        var _d = Math.abs(cx - _midX);
        if (_d < closestDistX) { closestDistX = _d; closest = closestLine.items[ik]; }
      }
      if (!closest) return null;

      var insertBefore = cx < closest.b.left + closest.b.width / 2;

      if (!target) {
        return { idx: closest.i };
      }

      var MARGIN = 6;
      var markerX;
      if (insertBefore) {
        var leftNeighbor = null;
        for (var il = 0; il < closestLine.items.length; il++) {
          var _it = closestLine.items[il];
          if (_it.i !== closest.i && _it.b.left + _it.b.width <= closest.b.left) {
            if (!leftNeighbor || _it.b.left > leftNeighbor.b.left) leftNeighbor = _it;
          }
        }
        markerX = leftNeighbor ? (leftNeighbor.b.left + leftNeighbor.b.width + closest.b.left) / 2 : closest.b.left - MARGIN;
      } else {
        var rightNeighbor = null;
        for (var ir = 0; ir < closestLine.items.length; ir++) {
          var _it2 = closestLine.items[ir];
          if (_it2.i !== closest.i && _it2.b.left >= closest.b.left + closest.b.width) {
            if (!rightNeighbor || _it2.b.left < rightNeighbor.b.left) rightNeighbor = _it2;
          }
        }
        markerX = rightNeighbor ? (closest.b.left + closest.b.width + rightNeighbor.b.left) / 2 : closest.b.left + closest.b.width + MARGIN;
      }

      var tgt = closest.i, src = excludeIdx, insertAt;
      if (tgt > src) insertAt = insertBefore ? tgt - 1 : tgt;
      else insertAt = insertBefore ? tgt : tgt + 1;
      if (insertAt === src) return null;

      return { idx: closest.i, insertBefore: insertBefore, markerX: markerX, markerY: closestLine.top, markerH: closestLine.height };
    },

    // Drag ghost — a small floating label that follows the pointer during a
    // legend/label/handle drag, showing what's being moved. Migrated from the
    // card's own _createGhost/_moveGhost/_destroyGhost: every value it needs
    // (text, size, color) was already being read from this same chart's own
    // native data by the card before calling those — Chart.js has all of it
    // natively, no reason for the card to fetch and hand it back over.
    // position:fixed on document.body (not the canvas's own parent) since the
    // ghost must follow the pointer anywhere on screen, not stay confined to
    // the chart's own bounds. Gated by options.dragGhostEnabled, on by default.
    _hecShowDragGhost: function (text, width, height, clientX, clientY, anchor, color) {
      if (this.options.dragGhostEnabled === false) return;
      this._hecDestroyDragGhost();
      var _el = document.createElement('div');
      _el.id = '_hec_ghost';
      var _transform = anchor === 'topleft' ? 'translate(-9px,-18px)' : 'translate(-50%,-50%)';
      var _borderColor = color || 'var(--primary-color,#03a9f4)';
      _el.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;opacity:0.65;' +
        'background:var(--card-background-color,#fff);border:2px solid ' + _borderColor + ';' +
        'border-radius:4px;padding:2px 8px;font-size:12px;white-space:nowrap;' +
        'box-shadow:0 2px 8px rgba(0,0,0,0.25);transform:' + _transform + ';' +
        'width:' + width + 'px;height:' + height + 'px;display:flex;align-items:center;justify-content:center;' +
        'overflow:hidden;text-overflow:ellipsis;';
      _el.textContent = text || '';
      document.body.appendChild(_el);
      this._hecDragGhostEl = _el;
      this._hecMoveDragGhost(clientX, clientY);
    },

    _hecMoveDragGhost: function (clientX, clientY) {
      var _el = this._hecDragGhostEl;
      if (_el) { _el.style.left = clientX + 'px'; _el.style.top = clientY + 'px'; }
    },

    _hecDestroyDragGhost: function () {
      if (this._hecDragGhostEl) { this._hecDragGhostEl.remove(); this._hecDragGhostEl = null; }
    },

    // Insertion marker — the small arrow-tipped line shown at a potential drop
    // position during a legend/label/handle drag. Migrated verbatim from the
    // card's own _showInsertionMarker/_hideInsertionMarker, same visual
    // appearance. Kept as a single global element (not per-chart) via
    // Chart.prototype, matching the original's document.getElementById
    // singleton — only one drag can be in progress across all charts at once.
    _hecShowInsertionMarker: function (x, y, width, height, horizontal, color) {
      if (this.options.dragGhostEnabled === false) return;
      var _el = document.getElementById('_hec_insert');
      if (!_el) {
        _el = document.createElement('div');
        _el.id = '_hec_insert';
        document.body.appendChild(_el);
      }
      var _c = color || 'var(--primary-color,#03a9f4)';
      if (horizontal) {
        _el.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;' +
          'left:' + x + 'px;top:' + (y - 1) + 'px;width:' + width + 'px;height:3px;' +
          'background:' + _c + ';border-radius:2px;';
        _el.innerHTML = '<div style="position:absolute;left:-8px;top:-4px;width:0;height:0;' +
          'border-top:5px solid transparent;border-bottom:5px solid transparent;' +
          'border-left:8px solid ' + _c + ';"></div>';
      } else {
        var _h15 = Math.round(height * 1.5);
        var _yOff = Math.round((height - _h15) / 2);
        _el.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;' +
          'left:' + (x - 6) + 'px;top:' + (y + _yOff) + 'px;width:3px;height:' + _h15 + 'px;' +
          'background:' + _c + ';border-radius:2px;';
        _el.innerHTML = '<div style="position:absolute;top:-2px;left:-4px;width:0;height:0;' +
          'border-left:5px solid transparent;border-right:5px solid transparent;' +
          'border-top:5px solid ' + _c + ';"></div>';
      }
    },

    _hecHideInsertionMarker: function () {
      var _el = document.getElementById('_hec_insert');
      if (_el) _el.remove();
    },

    // Drop-target highlight — an outline around this chart's own canvas wrapper while
    // a compatible/incompatible drag hovers over it (Chart.hecUi.outline).
    _hecHighlightDropTarget: function (valid) {
      this._hecClearDropHighlight();
      var _wrapper = this.canvas && this.canvas.parentNode;
      if (!_wrapper) return;
      Chart.hecUi.outline(_wrapper, valid);
      this._hecHighlightEl = _wrapper;
    },

    _hecClearDropHighlight: function () {
      Chart.hecUi.clearOutline(this._hecHighlightEl);
      this._hecHighlightEl = null;
    },

    // Zoom-rectangle selection overlay — pure geometry, no knowledge of
    // startTime/endTime needed (that conversion stays the card's own
    // responsibility, since the resulting time range is shared across every
    // graph, not just this one). Migrated verbatim from the card's own
    // overlay creation/fill logic.
    _hecShowZoomSelection: function (x0, x1) {
      if (!this.canvas || !this.chartArea) return;
      var _el = this._hecZoomSelectionEl;
      if (!_el) {
        _el = document.createElement('canvas');
        _el.style.cssText = 'position:absolute;pointer-events:none;';
        this.canvas.parentNode.insertBefore(_el, this.canvas);
        this._hecZoomSelectionEl = _el;
      }
      _el.width = this.canvas.width;
      _el.height = this.canvas.height;
      var _ctx = _el.getContext('2d');
      _ctx.clearRect(0, 0, _el.width, _el.height);
      var _left = Math.min(x0, x1), _right = Math.max(x0, x1);
      var _cs = getComputedStyle(this.canvas.parentNode || this.canvas);
      var _themeColor = _cs.getPropertyValue('--secondary-text-color').trim() || '#888';
      _ctx.globalAlpha = 0.13;
      _ctx.fillStyle = _themeColor;
      _ctx.fillRect(_left, this.chartArea.top, _right - _left, this.chartArea.bottom - this.chartArea.top);
    },

    _hecHideZoomSelection: function () {
      if (this._hecZoomSelectionEl) { this._hecZoomSelectionEl.remove(); this._hecZoomSelectionEl = null; }
    },

    // ── The elements laid over the canvas (touch zones, relays) ──

    // Places el next to this chart's canvas, in the canvas's own parent (made a
    // positioned container if it isn't one yet) — shared by every element below
    // that's laid over the chart: lock icon, move handle, touch zones.
    _hecAttachToCanvasParent: function (el) {
      var _parent = this.canvas && this.canvas.parentNode;
      if (!_parent) return null;
      if (getComputedStyle(_parent).position === 'static') _parent.style.position = 'relative';
      if (el.parentNode !== _parent) _parent.appendChild(el);
      return _parent;
    },

    // A touch zone laid over part of the chart (see "The touch-action workaround" in
    // Chart Custom.js.md): created once and kept under this[key], it relays every
    // pointer event it gets to the canvas, so the gesture detector still does 100% of
    // the work — only its touch-action differs from the canvas's. Single place for the
    // Y axis zone, the legend / label column zones and the lock+handle zone.
    _hecTouchOverlay: function (key, cursor) {
      var me = this;
      var _el = me[key];
      if (!_el) {
        _el = document.createElement('div');
        _el.style.cssText = 'position:absolute;z-index:0;cursor:' + cursor + ';';
        var _forward = function (ev) {
          // A press here keeps the browser's default actions to itself, as the card's
          // own zones did before v1.2: with a mouse or pen, no text selection (dragging
          // out of the zone would leave one behind on the page, and the next press on
          // it would start the browser's own drag-and-drop instead — a pointercancel
          // that lost the drag); on touch, no focus change by the emulated mouse
          // events (the click that follows a long-press would otherwise take the focus
          // away from the type menu it just opened, closing it). Scrolling isn't one of
          // these: on touch it's only ever governed by touch-action.
          if (ev.type === 'pointerdown' || ev.type === 'contextmenu') ev.preventDefault();
          // (leaving it for the canvas or another of its zones isn't leaving the graph)
          if (ev.type === 'pointerout' && me._hecInGraph(ev.relatedTarget)) return;
          me.canvas.dispatchEvent(new PointerEvent(ev.type, ev));
        };
        ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerout', 'contextmenu'].forEach(function (t) {
          _el.addEventListener(t, _forward);
        });
        _el._hecChart = me;
        me[key] = _el;
      }
      me._hecAttachToCanvasParent(_el);
      return _el;
    },

    // Dynamic touch-blocking overlays for the legend (line/bar) and label
    // column (timeline/arrowline) — migrating the original #lg-N/#tl-N zones.
    // Mouse/pen: touch-action is irrelevant to them, drag always works via
    // normal >10px movement detection, same as everywhere else.
    // Touch: touch-action:none is only applied while me._hecLabelDragAllowed
    // is true — set on dblclick on either zone (single flag shared by legend
    // and timeline on the same graph, since a graph never has both at once),
    // cleared on mouseup. The 500ms-armed window used for the Y-axis zone
    // isn't needed here: touch-action:none set at the FIRST click of the
    // double-click already covers the whole gap up to the second click — once
    // that second mousedown fires (drag can now start), the block is already
    // in effect and stays in effect regardless of whether its own timer would
    // have expired, since the gesture is already underway by then. Same
    // relay-to-canvas pattern as before — Chart.js still does 100% of the
    // actual gesture work.
    _hecUpdateDragTouchOverlays: function () {
      var me = this;
      if (!me.canvas || !me.chartArea) return;

      function ensureOverlay(key) {
        var _el = me._hecTouchOverlay(key, 'move');
        _el.style.touchAction = (me._hecLabelDragAllowed || me._hecLabelClickArmed) ? 'none' : '';
        return _el;
      }

      if (me.config.type === 'line' || me.config.type === 'bar') {
        if (me.legend && me.legend.legendHitBoxes && me.legend.legendHitBoxes.length) {
          // Tight bounding box of the actual legend items (legendHitBoxes),
          // not legend.left/right — those describe the full layout box
          // reserved for the legend, which spans the entire chart width for
          // a horizontal/fullWidth legend regardless of how much of it the
          // labels actually occupy.
          var _hb = me.legend.legendHitBoxes;
          var _lgLeft = Infinity, _lgRight = -Infinity, _lgTop = Infinity, _lgBottom = -Infinity;
          for (var _hi = 0; _hi < _hb.length; _hi++) {
            var _b = _hb[_hi];
            if (_b.left < _lgLeft) _lgLeft = _b.left;
            if (_b.left + _b.width > _lgRight) _lgRight = _b.left + _b.width;
            if (_b.top < _lgTop) _lgTop = _b.top;
            if (_b.top + _b.height > _lgBottom) _lgBottom = _b.top + _b.height;
          }
          var _lgMargin = 4;
          var _lg = ensureOverlay('_hecLegendTouchEl');
          _lg.style.left = (me.canvas.offsetLeft + _lgLeft - _lgMargin) + 'px';
          _lg.style.top = (me.canvas.offsetTop + _lgTop - _lgMargin) + 'px';
          _lg.style.width = (_lgRight - _lgLeft + _lgMargin * 2) + 'px';
          _lg.style.height = (_lgBottom - _lgTop + _lgMargin * 2) + 'px';
        }
      } else if (me.config.type === 'timeline' || me.config.type === 'arrowline') {
        var _tl = ensureOverlay('_hecLabelTouchEl');
        _tl.style.left = me.canvas.offsetLeft + 'px';
        _tl.style.top = me.canvas.offsetTop + 'px';
        _tl.style.width = me.chartArea.left + 'px';
        _tl.style.height = me.canvas.offsetHeight + 'px';
      }

      // Grouped lock+handle touch zone — top-left 0-33px × 0-28px, covering
      // BOTH the move handle (0-15px) AND the lock icon (15-33px) as ONE
      // single zone that receives every click/drag and lets the gesture
      // detector's own consumers (lock toggle, graph reorder) sort out what
      // to do with it — per Thierry's explicit correction: this was
      // previously only 15px wide, so a touch contact starting directly over
      // the lock icon never got touch-action:none applied (the click/toggle
      // still worked, since the canvas has its own native listeners
      // independent of this overlay — but the touch-scroll-blocking workaround
      // silently didn't cover that half of the zone). Neutralized (0×0) when
      // moveHandleVisible is false (only one graph total, per the card) so it
      // can't intercept a contact for a handle the user can't even see —
      // the lock icon itself stays visible/clickable in that case via the
      // canvas's own native handling, just without this overlay's touch
      // workaround (acceptable: with only one graph, there's no handle drag
      // to protect from scroll interference in this zone, only the lock
      // toggle, which doesn't need touch-action changes at all).
      var _moVisible = me.options.moveHandleVisible !== false || !!me._hecHandleButtons();
      var _mo = ensureOverlay('_hecMoveHandleTouchEl');
      _mo.style.left = me.canvas.offsetLeft + 'px';
      _mo.style.top = me.canvas.offsetTop + 'px';
      _mo.style.width = _moVisible ? me._hecLockAndHandleWidth() + 'px' : '0px';
      _mo.style.height = _moVisible ? '28px' : '0px';
      // (with handleButtons, a swipe there is theirs, never the page's)
      if (me._hecHandleButtons()) _mo.style.touchAction = 'none';
    }
  });

  // ── The hover tooltip, shown as a floating element (methods added to Chart.Tooltip) ──

  helpers.extend(Chart.Tooltip.prototype, {
    _hecShowTooltip: function (content, x, y, anchorEl, backgroundColor, borderColor, textColor, caret, justMoved, onFade) {
      var me = this;
      var _el = this._hecHoverTooltipEl;
      if (!_el) {
        _el = document.createElement('div');
        _el.id = 'hec-tooltip-hover';
        _el.style.cssText = 'position:absolute;z-index:9999;pointer-events:none;border-radius:4px;font-size:12px;line-height:1.4;box-shadow:0 2px 6px rgba(0,0,0,0.25);width:max-content;max-width:calc(100vw - 8px);transition:opacity ' + Chart.hecUi.FADE / 1000 + 's ease;opacity:0;';
        this._hecHoverTooltipEl = _el;
      }
      _el._hecOnFade = onFade;
      Chart.hecUi.attachFloating(_el, anchorEl);
      _el.style.background = backgroundColor;
      _el.style.border = borderColor ? (borderWidth(caret) + 'px solid ' + borderColor) : 'none';
      _el.style.color = textColor;
      _el.style.padding = '4px 8px';

      // (read before content goes in — a fragment is emptied once appended —, one row
      // after the other: their texts would run into each other)
      var _readingTime = Chart.hecUi.readingTime(typeof content === 'string' ? content
        : content ? Array.prototype.map.call(content.childNodes, function (n) { return n.textContent; }).join(' ') : '');
      _el.innerHTML = '';
      if (typeof content === 'string') {
        _el.appendChild(document.createTextNode(content));
      } else if (content) {
        _el.appendChild(content);
      }

      var _caretEl = null;
      if (caret) {
        var _cs = caret.size, _cr = caret.cornerRadius, _bw = caret.borderWidth;
        _caretEl = document.createElement('div');
        _caretEl.style.cssText = 'position:absolute;width:0;height:0;border:' + _cs + 'px solid transparent;left:auto;right:auto;top:auto;bottom:auto;margin:0;';
        if (caret.yAlign === 'center') {
          _caretEl.style.top = '50%';
          _caretEl.style.marginTop = -_cs + 'px';
          if (caret.xAlign === 'left') { _caretEl.style.left = -(_bw + 8 + _cs - 2) + 'px'; _caretEl.style.borderRightColor = backgroundColor; }
          else { _caretEl.style.right = -(_bw + 8 + _cs - 2) + 'px'; _caretEl.style.borderLeftColor = backgroundColor; }
        } else {
          if (caret.xAlign === 'left') _caretEl.style.left = (_cr - 8) + 'px';
          else if (caret.xAlign === 'right') _caretEl.style.right = (_cr - 8) + 'px';
          else { _caretEl.style.left = '50%'; _caretEl.style.marginLeft = -_cs + 'px'; }
          if (caret.yAlign === 'top') { _caretEl.style.top = -(_bw + 4 + _cs) + 'px'; _caretEl.style.borderBottomColor = backgroundColor; }
          else { _caretEl.style.bottom = -(_bw + 4 + _cs) + 'px'; _caretEl.style.borderTopColor = backgroundColor; }
        }
        _el.appendChild(_caretEl);
      }

      _el.style.display = 'block';
      // (beside the point it shows — caret.x, caret.y —, as Chart.js places its own: by the
      // element's real size, not the one Chart.js measured for its own drawing, which
      // differs, so that it stands as far from the point on either side)
      if (caret && caret.x !== undefined) {
        var _at = backgroundPoint(caret, _el.offsetWidth, _el.offsetHeight);
        x = _at.x; y = _at.y;
      }
      var _origin = (_el.style.position === 'fixed') ? { left: 0, top: 0 } : _el.parentNode.getBoundingClientRect();
      _el.style.left = (x - _origin.left) + 'px';
      _el.style.top = (y - _origin.top) + 'px';
      // (the area to stay in: the card's, if it says which — floatingBoundsSelector)
      var _boundsSel = me._chart && me._chart.options.floatingBoundsSelector;
      Chart.hecUi.clampToViewport(_el, _boundsSel && anchorEl && anchorEl.closest ? anchorEl.closest(_boundsSel) : null);
      // (moved to stay within the card and the screen: its arrow still on the point, within
      // its rounded corners)
      if (_caretEl && caret.x !== undefined) {
        var _box = _el.getBoundingClientRect(), _half = caret.size, _in = caret.cornerRadius + _half;
        var _clampIn = function (v, len) { return Math.max(_in, Math.min(v, len - _in)); };
        if (caret.yAlign === 'center') {
          _caretEl.style.top = (_clampIn(caret.y - _box.top, _box.height) - caret.borderWidth - _half) + 'px';
          _caretEl.style.marginTop = '0px';
        } else {
          _caretEl.style.left = (_clampIn(caret.x - _box.left, _box.width) - caret.borderWidth - _half) + 'px';
          _caretEl.style.right = 'auto';
          _caretEl.style.marginLeft = '0px';
        }
      }
      Chart.hecUi.armAutoFade(_el, _readingTime, justMoved);

      function borderWidth(_caret) { return _caret ? _caret.borderWidth : 1; }
      // The top-left corner of a box w × h beside the point (c.x, c.y), on the side its
      // alignment says — Chart.js's own rule (getBackgroundPoint in deps/Chart.js)
      function backgroundPoint(c, w, h) {
        var _x = c.x, _y = c.y, _ps = c.size + c.padding, _rp = c.cornerRadius + c.padding;
        if (c.xAlign === 'right') _x -= w; else if (c.xAlign === 'center') _x -= w / 2;
        if (c.yAlign === 'top') _y += _ps; else if (c.yAlign === 'bottom') _y -= h + _ps; else _y -= h / 2;
        if (c.yAlign === 'center') { if (c.xAlign === 'left') _x += _ps; else if (c.xAlign === 'right') _x -= _ps; }
        else if (c.xAlign === 'left') _x -= _rp; else if (c.xAlign === 'right') _x += _rp;
        return { x: _x, y: _y };
      }
    },

    // Generic early-close: any caller can fade the CURRENTLY-TARGETED (via
    // elKey) tooltip out immediately (duration 0) — never touches the other one.
    _hecCloseTooltip: function () {
      if (this._hecHoverTooltipEl) Chart.hecUi.startFade(this._hecHoverTooltipEl, 0);
    },

    // Renders the tooltip as a floating DOM element instead of drawing on the canvas
    // — the on-canvas draw is hard-clipped to its own graph's canvas, so a short
    // graph or one near a viewport edge would truncate the tooltip with no way to fix
    // that from within canvas drawing. Called from draw() below in place of the old
    // on-canvas path. A pure consumer of _hecShowTooltip/_hecCloseTooltip: builds its
    // own structured content and knows its own early-close conditions (disabled,
    // no content) — the generic function knows neither.
    _hecRenderFloatingTooltip: function () {
      var _vm = this._view;

      var _justMoved = !!(_vm && _vm.hecJustMoved);
      if (_vm) _vm.hecJustMoved = false;

      if (!this._options.enabled || !_vm || _vm.tooltipActive !== true) {
        this._hecCloseTooltip();
        return;
      }
      // A model left half-built by a throw inside Tooltip.update() can still read
      // tooltipActive === true with its text arrays missing — treat it as empty.
      var _complete = _vm.title && _vm.beforeBody && _vm.body && _vm.afterBody;
      var _hasContent = _complete && (_vm.title.length || _vm.beforeBody.length || _vm.body.length || _vm.afterBody.length);
      if (!_hasContent) {
        this._hecCloseTooltip();
        return;
      }

      var _content = document.createDocumentFragment();
      var _addLine = function (text, color, swatch) {
        var _row = document.createElement('div');
        if (color) _row.style.color = color;
        if (swatch) {
          var _sw = document.createElement('span');
          _sw.style.cssText = 'display:inline-block;width:10px;height:10px;margin-right:5px;vertical-align:middle;border-radius:2px;border:1px solid ' + swatch.borderColor + ';background:' + swatch.backgroundColor + ';';
          _row.appendChild(_sw);
        }
        _row.appendChild(document.createTextNode(text));
        _content.appendChild(_row);
      };

      for (var _ti = 0; _ti < _vm.title.length; _ti++) {
        var _row = document.createElement('div');
        _row.style.fontWeight = '600';
        _row.style.marginBottom = '2px';
        _row.style.color = _vm.titleFontColor;
        _row.appendChild(document.createTextNode(_vm.title[_ti]));
        _content.appendChild(_row);
      }
      for (var _bi = 0; _bi < _vm.beforeBody.length; _bi++) _addLine(_vm.beforeBody[_bi]);
      _vm.body.forEach(function (_item, _i) {
        for (var _bj = 0; _bj < _item.before.length; _bj++) _addLine(_item.before[_bj]);
        for (var _lj = 0; _lj < _item.lines.length; _lj++) _addLine(_item.lines[_lj], _vm.labelTextColors[_i], _vm.displayColors ? _vm.labelColors[_i] : null);
        for (var _aj = 0; _aj < _item.after.length; _aj++) _addLine(_item.after[_aj]);
      });
      for (var _ai = 0; _ai < _vm.afterBody.length; _ai++) _addLine(_vm.afterBody[_ai]);

      var _canvasRect = this._chart.canvas.getBoundingClientRect();
      var _chart = this._chart;
      this._hecShowTooltip(
        _content,
        _canvasRect.left + _vm.x, _canvasRect.top + _vm.y,
        this._chart.canvas,
        _vm.backgroundColor, _vm.borderColor, _vm.bodyFontColor,
        { size: _vm.caretSize, xAlign: _vm.xAlign, yAlign: _vm.yAlign, cornerRadius: _vm.cornerRadius, borderWidth: _vm.borderWidth,
          padding: _vm.caretPadding, x: _canvasRect.left + _vm.caretX, y: _canvasRect.top + _vm.caretY },
        _justMoved,
        // (as it fades out, the highlighted point fades out with it)
        function () { _chart._hecEndHover(); }
      );
    }
  });
})();
