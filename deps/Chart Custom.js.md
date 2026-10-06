# Chart.js custom changes (Cook23 / history-explorer-card fork)

This documents everything added or changed in this fork relative to
**stock Chart.js 2.7.1** (https://www.chartjs.org/docs/2.7.1/). It does not
repeat anything already covered by the official 2.7.1 docs — only what's
different here.

Where the code is: **`deps/chart-hec.js`** holds everything the fork adds (the
gesture detector, hit-testing, zones, overlays, drag feedback, the Y axis lock, the
floating tooltip, `Chart.hecUi`), added to `Chart.prototype` and
`Chart.Tooltip.prototype` right after **`deps/Chart.js`** loads. `deps/Chart.js`
keeps only small changes to stock code, and the hooks calling into the HEC layer
(§8).

## 0. The contract between Chart.js and the card (frozen in 1.2.0)

**Chart.js owns every mouse/touch interaction on its own canvas** (gesture
detection, hit-testing, zones, cursors, `touch-action`, drag ghost, insertion
markers, Y axis pan/zoom/lock, tooltips). **The card (`src/`) owns
everything that has a meaning** (entities, groups, the shared time window,
Home Assistant state, persistence, menus). They talk through four channels
only:

| Direction | Channel | What goes through it |
|---|---|---|
| Card → Chart.js | `options` (§1) and stock 2.7.1 data/options | Configuration, and the few answers the card gives during a gesture (`dropAllowed`, `insertionForbidden`, `zoomSelectMode`, …) |
| Card → Chart.js | stock 2.7.1 methods, and `hecSetYAxisLocked()` (§1) | `update()`, `resize()`, `getDatasetMeta()`; locking or releasing the Y axes (the padlock, from a menu) — nothing else |
| Chart.js → card | `options.customEvent(payload)` (§2) | Every gesture on labels, graphs and icons, already resolved: zone, label index, position along the time axis, drop target |
| Chart.js → card | `options.panX` / `options.zoomX` (§1) | Moves of the time window, the one axis shared by every graph |
| Both | `Chart.hecUi` (§7) | Floating elements, messages, outlines |

Rules that keep it that way:

- The card never listens to a pointer, mouse, touch or wheel event on a graph
  canvas, never reads a chart's layout (`chartArea`, `legend`, hit boxes, scale
  pixels) and never calls or reads anything `_hec`-prefixed. Whatever position it
  needs comes in the payload: a `zone`, an index, a fraction of the time axis
  (`xFactor`, `centerFactor`, `deltaFactor`), or client coordinates.
- Chart.js never knows what an entity, a group or a time window is. When a
  gesture's outcome depends on that (may this curve be dropped there?), it asks
  through `customEvent` and reads the answer the card writes in an option.
- A new interaction is added by extending this contract (an option, a payload
  field, a `gestureType`), documented here — never by reaching across it.

The one place a chart deals with another one: a drag onto another graph (a
curve, a timeline/arrowline row, a whole graph) is followed by the source chart,
which finds the chart under the pointer among `Chart.instances` of the same
`dragScope` and sends it a `dragovergraph` through that chart's own
`customEvent`.

---

## 1. New configuration options

All are read from the same `options` object passed to `new Chart(ctx,
{ options: {...} })`, alongside standard 2.7.1 options like `responsive`
or `maintainAspectRatio`.

| Option | Type | Default | Effect when disabled (`=== false`) |
|---|---|---|---|
| `customEvent` | `function(payload)` | none (opt-in) | If not a function, no custom gesture events are ever fired at all — the whole mechanism described in §2 is inert. |
| `cursorEnabled` | `boolean` | `true` | Canvas cursor never changes to `move`/`ns-resize`/etc. on hover; stays whatever the page's default is. |
| `wheelZoomEnabled` | `boolean` | `true` | Mouse wheel does nothing at all on this chart (no Ctrl+wheel `zoomX`, no Shift+wheel Y zoom). |
| `panEnabled` | `boolean` | `true` | Dragging a graph (1-finger or 2-finger pinch center-move) never calls `panX` and never pans the Y axis during a pinch, though the drag is still detected and still fires `customEvent`. |
| `zoomEnabled` | `boolean` | `true` | Zoom X and Y are both inert — no Y scale change, no `zoomX` call. |
| `zoomYEnabled` | `boolean` | `true` | Y-axis zoom specifically (wheel Shift+wheel, or the Y-spread of a pinch) is inert, even if `zoomEnabled` is on. |
| `yAxisPanEnabled` | `boolean` | `true` | Dragging directly on the Y-axis label zone (or Shift+drag anywhere on a `line`/`bar` graph) never pans the Y scale. Never applies to `timeline`/`arrowline` graphs regardless. |
| `yAxisLockEnabled` | `boolean` | `true` | The Y-axis lock icon (padlock) is never drawn, never engages automatically, and the grouped lock+handle click/dblclick toggle (§5) does nothing. |
| `legendClickEnabled` | `boolean` | `true` | A click/double-click on a legend label is not forwarded to the stock `legend.onClick`. The card sets it to `false`: it handles legend clicks like every other gesture, from `customEvent` (`click`/`dblclick` with `legendIndex`). |
| `hover.activateOnContact` | `boolean` | `false` | A hover move only moves a tooltip that a contact (click, tap) on the plot area opened; leaving the plot area, or the canvas (a pen moving out of hover range), closes it, and the next hover opens nothing. The card sets it to `true`. |
| `labelTooltipEnabled` | `boolean` | `true` | Clicking a truncated Y-axis category label (timeline/arrowline) never shows its full text in a tooltip. |
| `altSampleModeEnabled` | `boolean` | `true` | Holding Alt while hovering never switches `hover.mode` to `'dataset'` (showing every sample instead of just the nearest point). |
| `moveHandleVisible` | `boolean` | `true` | Hides the graph-reorder handle (`⠿`) and neutralizes its touch zone. The card sets this to `false` when there's only one graph total — Chart.js has no way to know the total graph count itself, so the card is the only legitimate source for this value. |
| `panX` | `function({chart, phase, deltaFactor, event})` | none | The time axis (the card's — the time window is shared by every graph) is moved by a drag: the one-finger drag on the plot area, and the fingers' common horizontal movement in a pinch. `phase`: `'start'`, `'move'` (`deltaFactor`: the movement since the last call, in widths of the plot area, > 0 rightward) or `'end'`. Label drags, graph moves and drags in zoom select mode never call it. |
| `zoomX` | `function({chart, step, centerFactor, event})` | none | The time axis is zoomed by one step: `step` +1 zooms in, -1 out, around `centerFactor` (0 at the plot area's left edge, 1 at its right edge). From Ctrl+wheel (one step per tick, after the 150 ms debounce — every tick is kept from zooming the page) and from the horizontal spread of a pinch (one step each time the spread, accumulated since the last step, changes by ×1.5). |
| `dragGhostEnabled` | `boolean` | `true` | No drag ghost (the floating label following the pointer) and no insertion marker during a drag. |
| `zoomSelectMode` | `boolean` | `false` | When `true`, a drag over the plot area selects a time span (Chart.js draws the selection; the span comes back in `dragend`'s `zoomSelectFactor0`/`zoomSelectFactor1`) instead of panning, and a drag elsewhere doesn't pan. Set by the card while its zoom button is on. |
| `dropAllowed` | `boolean` | `true` | Written by the card on the chart a drag is over, from its `dragovergraph` event (§2): `false` shows that graph's drop highlight as refused (dashed, error color), no insertion marker, and the dragging pointer's cursor as `not-allowed` (otherwise `grabbing`). |
| `insertionForbidden` | `boolean` | `false` | Written by the card during a graph move, from the `dragovergraph` it receives (with `insertBefore`): `true` draws the graph-move insertion marker in the error color (dropping there would split a block of linked graphs). |
| `linkMarkerVisible` | `boolean` | `false` | When `true`, the linked-graphs chain icon is drawn straddling this chart's top edge, under the labels of the graph above (§5). The card sets it on the lower graph of two linked ones. A double-click/double-tap on it fires `customEvent` with `zone: 'linkMarker'`. |
| `handleButtons` | `array` | `null` | Buttons drawn over the lock+handle zone (§5) in place of the handle and the padlock, each `{ id, text, disabled }` — `text` an icon, `disabled` greyed and struck through in red. The zone is then 18px per button (at least 33px); a click on one fires `customEvent` (`click`, `zone: 'lockAndHandle'`) with `handleButton: id` and `handleButtonDisabled`, and neither toggles the lock nor starts a graph drag. A swipe starting on one is reported at its end: `dragend` with `swipe` (`'up'`, `'down'`, or `null` under 10px) and that button's `handleButton`; on touch, the zone keeps that swipe (`touch-action: none`) instead of scrolling the page. The card shows them during a cut (where what was cut can be pasted). |
| `linkMarkerTitle` | `string` | `''` | Hover text of the chain icon (the card's translated text). |
| `floatingBoundsSelector` | CSS selector | none | The area Chart.js's floating elements (hover tooltip, truncated-label message) stay in: the closest ancestor of the canvas matching it, else the viewport only (see `Chart.hecUi.clampToViewport`, §7). The card passes `'#maincard'` — Chart.js knows nothing about the card's markup. |
| `legend.leftMargin` / `legend.rightMargin` | `number` (px) | `50` / `25` | Room kept free at both ends of the legend's lines (`options.legend`, next to the stock legend options). The card sets `rightMargin` so the legend keeps clear of the buttons it draws over the graph's top right corner. |
| `dragScope` | any value | none | A cross-graph drag (curve, label, graph move) only reaches the charts with the same `dragScope` — the card gives each of its instances its own, so two cards on the same dashboard never see each other's drags. |

None of these existed in stock 2.7.1 — `options.hover.mode`,
`options.scales.yAxes[0].ticks.min/max`, `options.legend`, etc. are all
standard 2.7.1 options this fork reads/writes but didn't introduce.

### Linear scale option

| Option | Type | Default | Effect |
|---|---|---|---|
| `scales.yAxes[].ticks.period` | `number` | none | An axis of values that wrap around (angles): each label shows its value brought into [0, period), formatted by Chart.js's own formatter; the top label, at a whole turn, shows the period itself (`0 … 360`, or `300 … 350, 0, 10 … 360`). The card sets it when every curve of a graph is circular with the same period. |

### Dataset options

| Option | Type | Default | Effect |
|---|---|---|---|
| `colorSteps` | `[{ x, borderColor, backgroundColor }]`, sorted by `x` | none | A line whose color changes along the X axis: from each `x` on (an X axis value), until the next one, its stroke and fill take that step's colors (one left undefined: the dataset's own `borderColor` / `backgroundColor`), and so do its points. Drawn as horizontal gradients with hard stops, rebuilt at each update (plugin `hecColorSteps`, `deps/chart-hec.js`). The card puts a step on each point where an entity's color changes. |
| `hecInterpolation` | `'monotone'`, `'steffen'`, `'makima'` or `'catmullrom'` | `'monotone'` | For a line dataset with `cubicInterpolationMode: 'monotone'` and a tension: the algorithm of its tangents — `monotone` is Chart.js' own (Fritsch–Carlson); the others are in `helpers.hecSplineTangents` / `helpers.hecSplineCurve` (`deps/chart-hec.js`). The card sets it from its `interpolation` option. |

---

### Public method

`chart.hecSetYAxisLocked(locked)` locks (`true`) or releases (`false`) the chart's Y axes, as
a click on the padlock does — for a menu entry that does the same. Nothing on a chart
without a lock (`yAxisLockEnabled: false`, a timeline or arrowline).

## 2. The `customEvent` gesture system

Stock 2.7.1 gives you `options.onClick` (native click only) and
`options.legend.onClick` — nothing for long-press, double-click, drag, or
pinch, and no unified way to know what happened across the whole canvas.
This fork builds all of that from raw Pointer Events into one detector
(`deps/chart-hec.js`: `_hecGestureHandler` hands each pointer or wheel event to
the function of its type — `hecPointerDown`, `hecPointerMove`, `hecPointerUp`,
`hecPointerCancel`, `hecWheel`, `hecContextMenu` — with the event's context; the drags themselves
are the `HEC_DRAG_HANDLERS` table) that fires a single callback:
**`options.customEvent(payload)`**.

### Payload shape (every gesture)

Built in one place (`_hecPayload`), for this chart's gestures and for the
`dragovergraph` another chart sends it. Positions are given in every form the
card may need, so it never has to compute one from the chart's layout.

```js
{
  chart,               // the Chart instance
  gestureType,         // one of the strings below
  x, y,                // the gesture's point, canvas-relative
  clientX, clientY,    // the same point, client (viewport) coordinates
  zone,                // where that point is: 'linkMarker' (chain icon, §5),
                       // 'lockAndHandle' (§5), 'legend' (its band, whole width),
                       // 'yAxis' (a Y axis' label column: left of the plot area, or right
                       // of it on a chart with a right axis), 'plot', or 'other'
  xFactor,             // where x is along the time axis: 0 at the plot area's left
                       // edge, 1 at its right edge (undefined before the first layout)
  legendIndex,         // legend label under the point, or -1
  yAxisIndex,          // timeline/arrowline row under the point, or -1
  labelRect,           // client rectangle {left, top, right, bottom} of that legend
                       // label, else of that row (the whole label column), else null
  element,             // stock getElementAtEvent() result, or null
  truncatedYAxisLabel, // full text if that row's label is visually truncated, else null
  pointerCount,        // how many pointers are down
  pointerType,         // 'mouse' | 'touch' | 'pen'
  button,              // native event.button, or undefined
  handleButton,        // the id of the handleButtons button under the point (§1), else
  handleButtonDisabled,// undefined — and whether it's disabled
  yAxisLocked,         // whether the Y axes are locked (the padlock); undefined on a
                       // chart without a lock
  event,               // the native PointerEvent (or the one a touch overlay forwards, §5)
  // ...plus the gestureType's own fields, below
}
```

### `gestureType` values

None of these are native browser event types except in name — all are
reconstructed from raw `pointerdown`/`pointermove`/`pointerup`/
`pointercancel`/`wheel`/`contextmenu`, since the browser only gives you native `click`
and `dblclick`, and nothing at all for long-press or drag.

| `gestureType` | Fires when | Its own payload fields |
|---|---|---|
| `click` | Pointer released, stayed within 10px, before the 600ms long-press timer fired, and this same press wasn't the second half of a double-click | — |
| *(pen)* | The barrel button (secondary button, `buttons & 2`) changes the meaning of a press: held at contact and released without a drag, `longpress` (at release, instead of `click`); held at contact and dragged, a plain drag; pressed twice while the tip stays down, `dblclick` (no `click` at release). Only reaches the page in the browsers that pass the button on (most don't: see `contextmenu` under `longpress`) | — |
| *(mouse)* | A press of any button other than the main one starts no gesture: the right button acts through the browser's `contextmenu` (`longpress`) | — |
| `dblclickdown` | A second press lands within 400ms of a first press that also stayed within 10px — fires at the **second press itself** (`pointerdown`): what a drag following that press needs (touch-action block, Y-axis pan) is armed right away, and the first press's `click` can be undone | — |
| `dblclick` | That second press is released without having become a drag (and before the long-press timer) — fires at the **second release** (`pointerup`), like the browser's own `dblclick`: only then is it known to be a double-click rather than a tap-then-drag | — |
| `longpress` | Pointer held stationary (within 10px) for 600ms without releasing — or the browser's `contextmenu` (a right click, a long press it reports first, a tap with a pen's button in Chrome and its web views: no contact reported, only this). The browser's own menu never opens on the graph. During a contact, it's that contact's `longpress`, fired once; within 2.5s of the release of a contact whose `longpress` fired, at the same place (within 10px), it's that one's (a browser reporting it at the release): nothing more | — |
| `dragstart` | Pointer moves past 10px total (either axis combined) while still down — the payload's point is where the press started | — |
| `dragmove` | Pointer continues moving while a drag is active — the payload's point is the pointer's | `overChart`: the chart of the same `dragScope` under the pointer (this one included), or `null` |
| `dragovergraph` | During a drag, the pointer is over a *different* chart of the same `dragScope` — sent through that chart's own `customEvent`, its payload relative to that chart | for a graph move: `insertBefore` (the pointer is above that graph's middle) |
| `dragend` | Pointer released or gesture cancelled while a drag was active | zoom selection: `zoomSelectFactor0`, `zoomSelectFactor1` (its two ends along the time axis, see `xFactor`). Label or graph drag: `drop` (below). A swipe on `handleButtons` (§1): `swipe`, `handleButton`. Any other drag: none of these |
| `pinch` | Two fingers down, either one moves | `panDeltaX`, `panDeltaY` (centre movement, px), `zoomScaleX`, `centerPixelsX`, `centerPixelsY` — informative only: the time axis gets the pinch through `panX`/`zoomX`, the Y axis is Chart.js's own (§3) |
| `pinchend` | One finger of a pinch lifts, the other remains down | the payload's point is the *remaining* finger's |
| `hover` | Pointer moves without any button/finger down | — |
| `wheel` | Mouse wheel used over the canvas | `deltaX`, `deltaY`, `ctrlKey`, `shiftKey`, `altKey` |

`drop` — where a label or a graph was dropped, resolved by the same lookups as
the insertion marker shown during the drag, so the drop always lands where the
marker said:

```js
{
  chart,         // the chart under the pointer (curve or row drag: this one included;
                 // graph move: another one only), or null
  index,         // curve drag: the legend label to insert next to; row drag: the
                 // nearest row; -1 for none (and always for a graph move)
  insertBefore   // before that label/row, else after it; graph move: above the
                 // target graph's middle
}
```

### Mutual exclusion rules (all intentional, not incidental)

- `click` and `longpress` are mutually exclusive — if long-press fires,
  the same contact's release never also fires `click`.
- One contact gives one `longpress` at most, whether from the timer or from
  the browser's `contextmenu` (the other is then ignored).
- `click` and `dblclick` are mutually exclusive — the second press of a
  double-click never also produces its own `click` at release.
- `dblclick` and `dragstart` are mutually exclusive — a second press that
  becomes a drag (tap-then-drag) never produces a `dblclick`; it only had its
  `dblclickdown`. Likewise `dblclick` and `longpress`.
- `longpress` and `dragstart` are **not** exclusive — holding, having
  long-press fire, then moving without lifting your finger starts a drag
  normally afterward, in the same continuous contact.
- `dblclickdown` and `dragstart` are **not** exclusive either, for the same
  reason (this is what makes the "tap-then-drag" touch workaround in §5
  possible at all).

---

## 3. Direct high-level behaviors (no callback needed)

Some interactions that 2.7.1 would leave entirely to you (or that this
fork's card previously handled itself) are now applied by Chart.js
directly, since the chart already has every piece of data it needs — no
value needs to come back from the card:

- **Y-axis pan** (dragging an axis' label zone — left, or right on a chart with
  a right axis — or Shift+drag anywhere on a `line`/`bar` chart) — moves the
  `ticks.min/max` of that axis, or of every Y axis with Shift, directly
  (`_hecValueYAxes` / `_hecSetYRanges`). With Shift, the time moves too: the
  drag also goes to `panX` (start, move, end), as a plain drag would.
- **Samples shown** (Alt, or Option, held while the pointer moves over the chart) —
  every sample of its curves is drawn as a dot (plugin `hecShowSamples`), until the
  pointer moves without Alt or leaves the chart (`_hecSetShowSamples`).
- **Y-axis zoom** (Shift+wheel, or the Y-spread of a 2-finger pinch) —
  same, on every Y axis, each around its own middle (simple scale-factor math
  on its current min/max).
- **Y-axis pan during a pinch** (the vertical movement of the fingers' centre) —
  same as the Y-axis drag: the content follows the fingers.
- **Y-axis lock** (the padlock icon) — a lock state (`0`=off, `1`=manually
  locked, `2`=auto-engaged by a gesture) lives entirely as
  `chart._hecYAxisLock`, drawn and toggled entirely within Chart.js. The
  card never reads or writes this value directly (see §6 for why that
  matters) — it can only see it change by receiving the resulting
  `customEvent`s (e.g. a `click` or `dblclickdown` with `zone: 'lockAndHandle'`).
- **Alt-key sample mode** — `options.hover.mode` (already a native 2.7.1
  option) is switched between its normal value and `'dataset'` while Alt
  is held, purely by Chart.js watching `hover` gestures.
- **Cursor** — `canvas.style.cursor` changes to `move`/`ns-resize`/etc. on
  hover over a draggable zone, entirely computed from `_hecLegendIndexAt`/
  `_hecYAxisIndexAt` (see §4), no card involvement.

- **Canvas `touch-action`** — `pan-y`, set by Chart.js on its canvas: on touch, a
  vertical swipe scrolls the page, every other gesture is the chart's (§5 for the
  zones where a vertical drag is the chart's too).

Contrast with `panX`/`zoomX` (§1), which stay card callbacks — the shared
date range spanning multiple graphs is data the card owns, not Chart.js.

---

## 4. New hit-testing primitives

Methods of every chart (`deps/chart-hec.js`; not present in 2.7.1 at all — the
closest native equivalent, `getElementAtEvent`, only finds *data points*, never
legend items or axis labels):

| Method | Signature | Behavior |
|---|---|---|
| `_hecPick(px, py, rects)` (private) | → index or `-1` | The general picking rule: the candidate the point is on; else the nearest one, if within a small margin and clearly nearer than the next one — a point clearly beside every candidate, or about halfway between two, picks none. |
| `_hecLegendIndexAt(x, y)` | → index or `-1` | Which legend item is under this point — `_hecPick` against each item's real `legendHitBoxes` rectangle, within the legend's band only, never on a control (lock+handle, chain icon). |
| `_hecYAxisIndexAt(x, y)` | → index or `-1` | Which Y-axis category row (timeline/arrowline only) is under this point — `_hecPick`, each row spanning the whole label column, within that column only, never on a control. |
| `_hecFindLegendLabel(x, y, excludeIdx, target)` | → `{ idx, insertBefore, markerX, markerY, markerH }` or `null` | Where a legend label dropped at this point lands (closest line, then closest label; `target` = finding an insertion point, skipping `excludeIdx`, the label being dragged; `null` for a no-op). Used by the insertion marker and by `dragend`'s `drop`. |
| `_hecYAxisInsertAt(y, excludeIdx, nearest)` | → `{ idx, insertBefore, markerY }` or `null` | Where a timeline/arrowline row dropped at this height lands: the row it's over (skipping `excludeIdx`), before or after its middle; with `nearest`, the nearest row whatever the distance. Used by the insertion markers and by `dragend`'s `drop`. |
| `_hecZoneAt(x, y)`, `_hecPlotFactor(x)`, `_hecLabelRect(legendIdx, yIdx)`, `_hecChartAt(clientX, clientY)` | | The payload's `zone`, `xFactor`, `labelRect`, and the chart under a client point (`overChart`, `drop.chart`). |

All internal: they are how Chart.js fills the payload (§2). The card calls none
of them.

---

## 5. Overlay elements Chart.js creates and manages

None of these exist in stock 2.7.1. All are plain `<div>`s appended to
the canvas's parent element (never inside the canvas itself, which can't
contain DOM children), repositioned on every `draw()` call, and — where
relevant — forward every pointer event they receive straight back onto
the canvas via `dispatchEvent(new PointerEvent(...))`, so Chart.js's own
`_hecGestureHandler` still does 100% of the actual interpretation. Their
only reason to exist is that `touch-action` (the CSS property that tells
the browser whether to let a touch gesture become a native page scroll)
can only be set on an element *before* a touch gesture begins on it —
changing it mid-gesture has no effect (confirmed against MDN), so a
single canvas-wide `touch-action` can't selectively protect just one
small zone without also either blocking scroll everywhere on the chart or
nowhere at all.

| Element (property name) | Zone | Purpose |
|---|---|---|
| `_hecLockIconEl` | 18×18px @ `(15, 5)` | The Y-axis lock padlock SVG. `pointer-events: none` — purely visual, the actual click is handled by the gesture detector (`zone: 'lockAndHandle'`). |
| `_hecMoveHandleIconEl` | 15×28px @ `(0, 0)` | The `⠿` graph-reorder handle glyph. Also `pointer-events: none`, same reasoning. |
| `_hecHandleButtonsEl` | The lock+handle zone | `handleButtons` (§1), drawn in place of the padlock and the handle while they're set. `pointer-events: none`, like them. |
| `_hecMoveHandleTouchEl` | 33×28px @ `(0, 0)` — 18px per button with `handleButtons` — (0×0 if `moveHandleVisible` is `false` and no `handleButtons`) | The single real touch target covering **both** the lock icon and the move handle as one zone (see below) — `touch-action` toggled dynamically. |
| `_hecYAxisTouchEl`, `_hecRightYAxisTouchEl` | Match the Y axes' label columns (the right one only on a chart with a right axis) | `touch-action` toggled dynamically, following the lock state or a short click-armed window (see the touch workaround below). |
| `_hecLegendTouchEl` | Tight bounding box of the legend's actual `legendHitBoxes`, +4px margin | Same dynamic `touch-action`, for dragging a curve label. Only exists for `line`/`bar` charts. |
| `_hecLabelTouchEl` | Full label column height | Same dynamic `touch-action`, for dragging a timeline/arrowline entity label. Only exists for `timeline`/`arrowline` charts. |
| `_hecLinkMarkerEl` | 22×22px, 23px above the canvas, centered under the Y axis labels | The linked-graphs chain icon (`linkMarkerVisible`), a relay zone like the others: its gestures come back as `customEvent`s with `zone: 'linkMarker'`. Where it overlaps the lock+handle zone, it wins. |

All the relay zones come from one factory, `_hecTouchOverlay(key, cursor)`. Their press
calls `preventDefault()`, for every pointer type: with a mouse or pen it starts no text
selection (dragging out of the zone would leave one on the page, and the next press on it
would start the browser's own drag-and-drop — a `pointercancel` that loses the drag); on
touch, no focus change by the emulated mouse events (the click after a long-press would
otherwise close the type menu it just opened). Scrolling is never affected: on touch it
only depends on `touch-action`.

The canvas takes the pointer capture at the press, so a drag toward another graph keeps
being followed from the source chart once the pointer leaves it (touch gets this from the
browser; a mouse or pen doesn't). Chart.js's pointer and wheel listeners are not passive
(only the stock `touch*` ones are), so its `preventDefault()` calls take effect.

### Why the lock icon and the move handle share one touch zone

They sit right next to each other, and treating a click/drag on either as
part of the same interaction lets a small ergonomic trick work: a click
anywhere in that 33×28px zone always toggles the Y-axis lock. On touch, if
that click turns out to be the first half of a double-click or of a
tap-then-drag (not a real toggle), the second press (`dblclickdown`) toggles
the lock back — undoing the first toggle — and the drag that follows moves
the graph. On mouse/pen,
there's no such ambiguity: click toggles, drag moves, independently.

### The touch-action workaround, in general

Every one of the dynamic-`touch-action` elements above follows the same
two-stage pattern, since `touch-action` must be set *before* a touch
gesture starts to have any effect on it:

1. A `click` anywhere relevant arms a **500ms window** with
   `touch-action: none` already applied — covering the gap up to a
   possible second click.
2. If a second press (`dblclickdown`) follows within that window, whatever it's protecting
   (Y-axis pan, curve/label drag) is now confirmed underway, and the
   block stays in effect for as long as needed (until the gesture's own
   `mouseup`, or — for the Y-axis specifically — until the lock
   disengages).
3. If no second click arrives, the 500ms timer expires and `touch-action`
   reverts to normal, letting the page scroll freely again.

This is why the *standard* way to drag anything in these zones on a touch
device is **tap, then press again and drag without lifting your finger** — a
single continuous drag (or a long-press-then-drag, which still works but
isn't the primary path anymore) can't reliably block scroll this way,
since there's only one gesture-start moment to set `touch-action` on, and
you don't know yet whether it's a scroll or a chart interaction.

---

## 6. What stays deliberately private

Every `_hec`-prefixed property or method is internal, those listed in §4 and §5
included. The card never reads or calls any of them: it reacts
to `customEvent`, `panX` and `zoomX` (§1, §2), and writes the `options.*` fields
of §1. To make a change visible right away (after changing `moveHandleVisible`,
say), it calls the stock `chart.update()`, never `_hecUpdateDragTouchOverlays`
or the like.

---

## 7. Shared UI utilities — `Chart.hecUi`

Generic, stateless helpers for floating elements and highlights, public: Chart.js's own
tooltips and drag feedback use them, and so does the card for its own menus and messages —
one implementation, where there used to be a copy on each side. Whatever they keep is
stored on the element they're given; they know nothing about the card (the area to stay in
is passed in).

| Function | Behavior |
|---|---|
| `readingTime(text)` | How long a message stays up: 1 s + 0.5 s per word (2+ letters or digits; words split on spaces and underscores). |
| `clampToViewport(el, boundsEl)` | Nudges an already-positioned element back inside: left/right/top within the most restrictive of `boundsEl` and the viewport, bottom within the viewport only; `boundsEl` null = viewport only. |
| `attachFloating(el, anchorEl)` | Places `el` against `anchorEl`'s `offsetParent` (absolute), or `document.body` (fixed) when there's none, so it scrolls with its anchor; closes it by itself (`closeFloating`) when the anchor disappears or is hidden. |
| `armAutoFade(el, duration[, justMoved])` | (Re)shows `el`, fading in, then fades it out after `duration` and closes it. With a third argument, only does so when `justMoved === true` (a render that follows a real pointer gesture, not a data refresh under a still pointer). |
| `startFade(el, duration)` | Fades `el` out after `duration`, then closes it. |
| `closeFloating(el)` | Removes `el` and its observer, then calls `el._hecOnClose` if its owner set one. |
| `showMessage(text, clientX, clientY, align, anchorEl, boundsEl)` | A short message near a point (refused drop, entity already added, truncated label's full text): one element per document or shadow root, reused; `align` `'left'` (default), `'center'` or `'right'`. |
| `closeMessage(anchorEl)` | Closes the message of `anchorEl`'s document or shadow root. |
| `outline(el, valid)` / `clearOutline(el[, immediate])` | Outlines a graph's wrapper — solid primary color when valid, dashed error color otherwise (that one fades out when cleared). |

---

## 8. Hooks in the stock code (`deps/Chart.js`)

What remains changed in `deps/Chart.js` itself — each place marked with a comment
pointing to `deps/chart-hec.js` or to this file:

| Where | Change |
|---|---|
| `Controller.update` | A change of chart type releases the Y axis lock (`_hecYAxisLock`) |
| `Controller.draw` | After drawing: `_hecUpdateYAxisState`, `_hecUpdateDragTouchOverlays`, `_hecUpdateMoveHandleIcon`, `_hecUpdateHandleButtons`, `_hecUpdateLinkMarker` (the overlays follow the layout) |
| `Controller.handleEvent` | Hover hit-test limited to drawn points; a `mouseout` without movement (the browser's, during a scroll) doesn't close the tooltip; every event goes to `_hecGestureHandler`, with the timing constants (`cfg`) |
| `Tooltip` | Drawn as a floating element (`_hecRenderFloatingTooltip`, §7 utilities) instead of on the canvas |
| Platform (DOM) | Canvas `touch-action: pan-y` (§3); pointer and wheel listeners not passive (§5) |
| Legend | `legend.leftMargin` / `legend.rightMargin` (§1); a line count that only grows while the labels stay the same (no legend jumping between one and two lines); a dataset whose colors are given per element (arrays: bars colored one by one) shows the last element's in its swatch — on a time axis, the most recent |
| Linear scale | `ticks.period` labels (§1) |
| Line controller, `updateBezierControlPoints` | `hecInterpolation` (§1): another algorithm than `'monotone'` goes to `helpers.hecSplineCurve` |
| Header, `HEC_CHART_VERSION` | The card's version, logged once at load |

