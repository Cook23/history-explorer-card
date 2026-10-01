# Chart.js custom changes (Cook23 / history-explorer-card fork)

This documents everything added or changed in this fork relative to
**stock Chart.js 2.7.1** (https://www.chartjs.org/docs/2.7.1/). It does not
repeat anything already covered by the official 2.7.1 docs — only what's
different here.

The guiding principle behind all of it: **Chart.js owns every mouse/touch
interaction on its own canvas** (clicks, drags, zoom, pan, hover, tooltips,
cursors). `history-explorer-card.js` owns all domain/business logic
(entities, groups, Home Assistant state, persistence) and never listens to
a raw pointer/mouse event on a graph canvas directly — it receives
everything through the `customEvent` option described below, and calls
back into Chart.js only through the public options/methods listed here,
never through private state.

The one documented exception: cross-graph drag (moving a curve, a
timeline/arrowline entity, or reordering graphs onto a *different*
graph's canvas) has the source chart instance look up the destination
instance via `Chart.instances` and re-dispatch through that instance's own
`customEvent` — there's no clean way for one canvas's gesture to reach
another chart's data/hit-testing otherwise. Every other interaction stays
within a single chart instance.

---

## 1. New configuration options

All are read from the same `options` object passed to `new Chart(ctx,
{ options: {...} })`, alongside standard 2.7.1 options like `responsive`
or `maintainAspectRatio`.

| Option | Type | Default | Effect when disabled (`=== false`) |
|---|---|---|---|
| `customEvent` | `function(payload)` | none (opt-in) | If not a function, no custom gesture events are ever fired at all — the whole mechanism described in §2 is inert. |
| `cursorEnabled` | `boolean` | `true` | Canvas cursor never changes to `move`/`ns-resize`/etc. on hover; stays whatever the page's default is. |
| `wheelZoomEnabled` | `boolean` | `true` | Mouse wheel does nothing at all on this chart (no Ctrl+wheel zoomX callback, no Shift+wheel zoomY). |
| `panEnabled` | `boolean` | `true` | Dragging a graph (1-finger or 2-finger pinch center-move) never calls the `panX`/`panY` callbacks (§3), though the drag is still detected and still fires `customEvent`. |
| `zoomEnabled` | `boolean` | `true` | Pinch (2-finger) zoom X and Y are both inert — no scale change, no `zoomX` callback call. |
| `zoomYEnabled` | `boolean` | `true` | Y-axis zoom specifically (wheel Shift+wheel, or the Y-spread of a pinch) is inert, even if `zoomEnabled` is on. |
| `yAxisPanEnabled` | `boolean` | `true` | Dragging directly on the Y-axis label zone (or Shift+drag anywhere on a `line`/`bar` graph) never pans the Y scale. Never applies to `timeline`/`arrowline` graphs regardless. |
| `yAxisLockEnabled` | `boolean` | `true` | The Y-axis lock icon (padlock) is never drawn, never engages automatically, and the grouped lock+handle click/dblclick toggle (§5) does nothing. |
| `legendClickEnabled` | `boolean` | `true` | Clicking/double-clicking a legend label never toggles/isolates its dataset (the native `legend.onClick` you'd configure yourself in 2.7.1 is unaffected — this only gates whether our gesture layer forwards clicks to it at all). |
| `labelTooltipEnabled` | `boolean` | `true` | Clicking a truncated Y-axis category label (timeline/arrowline) never shows its full text in a tooltip. |
| `altSampleModeEnabled` | `boolean` | `true` | Holding Alt while hovering never switches `hover.mode` to `'dataset'` (showing every sample instead of just the nearest point). |
| `moveHandleVisible` | `boolean` | `true` | Hides the graph-reorder handle (`⠿`) and neutralizes its touch zone. The card sets this to `false` when there's only one graph total — Chart.js has no way to know the total graph count itself, so the card is the only legitimate source for this value. |
| `panX` | `function({chart, deltaPixels or scale, centerPixels, event})` | none | Card-supplied callback for horizontal (time) panning and zooming. **Not implemented by Chart.js itself** — the shared date range across multiple graphs is considered a card responsibility, not a per-graph one, unlike `zoomY` which Chart.js applies directly (see §3). |
| `panY` | `function({chart, deltaPixels, event})` | none | Same idea as `panX`, but this one is effectively dead — Y-axis panning is fully handled by Chart.js directly (§3), so nothing calls this anymore. Kept only for backward compatibility if a card ever needs to intercept it. |
| `zoomX` | `function({chart, scale or deltaY, centerPixels, event})` | none | Card-supplied callback for horizontal zoom (Ctrl+wheel, pinch spread). Same "shared range, card responsibility" reasoning as `panX`. |

None of these existed in stock 2.7.1 — `options.hover.mode`,
`options.scales.yAxes[0].ticks.min/max`, `options.legend`, etc. are all
standard 2.7.1 options this fork reads/writes but didn't introduce.

---

## 2. The `customEvent` gesture system

Stock 2.7.1 gives you `options.onClick` (native click only) and
`options.legend.onClick` — nothing for long-press, double-click, drag, or
pinch, and no unified way to know what happened across the whole canvas.
This fork builds all of that from raw Pointer Events into one detector
(`_hecGestureHandler`, an addition to `Controller`, not present in 2.7.1)
that fires a single callback: **`options.customEvent(payload)`**.

### Payload shape (every gesture)

```js
{
  chart,              // the Chart instance
  element,             // native getElementAtEvent() result, or null
  legendIndex,          // legend item index at the gesture's position, or -1
  yAxisIndex,           // timeline/arrowline label row index at the position, or -1
  truncatedYAxisLabel,   // full text if that label is visually truncated, else null
  lockAndHandleZone,     // true if the gesture is within the lock+handle zone (§5)
  gestureType,          // one of the 11 strings below
  pointerCount,          // how many pointers are currently down
  pointerType,          // 'mouse' | 'touch' | 'pen' — from the native PointerEvent
  button,               // native event.button, or undefined
  event,                // the native PointerEvent (or synthetic PointerEvent for
                         // events forwarded from a touch overlay, see §5)
  // ...plus gestureType-specific fields, see below
}
```

### `gestureType` values

None of these are native browser event types except in name — all are
reconstructed from raw `pointerdown`/`pointermove`/`pointerup`/
`pointercancel`/`wheel`, since the browser only gives you native `click`
and `dblclick`, and nothing at all for long-press or drag.

| `gestureType` | Fires when | Extra payload fields |
|---|---|---|
| `click` | Pointer released, stayed within 10px, before the 600ms long-press timer fired, and this same press wasn't the second half of a double-click | — |
| `dblclick` | A second press lands within 400ms of a first press that also stayed within 10px — fires at the **second press itself** (`pointerdown`), not at release | — |
| `longpress` | Pointer held stationary (within 10px) for 600ms without releasing | — |
| `dragstart` | Pointer moves past 10px total (either axis combined) while still down | — |
| `dragmove` | Pointer continues moving while a drag is active | `x`, `y` (canvas-relative position), `panDeltaX` (incremental horizontal movement since the last `dragmove`) |
| `dragend` | Pointer released or gesture cancelled while a drag was active | — |
| `dragovergraph` | During a drag, the pointer passes over a *different* chart instance's canvas — re-dispatched through that instance's own `customEvent` (the one documented cross-instance exception, see intro) | `x`, `y` (relative to the other chart) |
| `pinch` | Two fingers down, either one moves | `panDeltaX`, `panDeltaY` (center-point movement), `zoomScaleX`, `centerPixelsX`, `centerPixelsY` — no `zoomScaleY`, since Y-axis zoom during a pinch is applied directly by Chart.js (§3), never left for a consumer to compute |
| `pinchend` | One finger of a pinch lifts, the other remains down | position of the *remaining* finger (canvas-relative, via the standard `hitX`/`hitY` mechanism) plus explicit `clientX`/`clientY` (screen coordinates), since the native `event` on this payload still refers to the finger that's lifting, not the one continuing |
| `hover` | Pointer moves without any button/finger down | `legendIndex`, `yAxisIndex` (redundant with the top-level fields, kept for consumers that only care about hover) |
| `wheel` | Mouse wheel used over the canvas | `deltaX`, `deltaY`, `ctrlKey`, `shiftKey`, `altKey` |

### Mutual exclusion rules (all intentional, not incidental)

- `click` and `longpress` are mutually exclusive — if long-press fires,
  the same contact's release never also fires `click`.
- `click` and `dblclick` are mutually exclusive — the second press of a
  double-click never also produces its own `click` at release.
- `longpress` and `dragstart` are **not** exclusive — holding, having
  long-press fire, then moving without lifting your finger starts a drag
  normally afterward, in the same continuous contact.
- `dblclick` and `dragstart` are **not** exclusive either, for the same
  reason (this is what makes the "double-tap-then-drag" touch workaround
  in §5 possible at all).

---

## 3. Direct high-level behaviors (no callback needed)

Some interactions that 2.7.1 would leave entirely to you (or that this
fork's card previously handled itself) are now applied by Chart.js
directly, since the chart already has every piece of data it needs — no
value needs to come back from the card:

- **Y-axis pan** (dragging the Y-axis label zone, or Shift+drag anywhere
  on a `line`/`bar` chart) — moves `options.scales.yAxes[0].ticks.min/max`
  directly.
- **Y-axis zoom** (Shift+wheel, or the Y-spread of a 2-finger pinch) —
  same, computed via simple scale-factor math on the current min/max.
- **Y-axis lock** (the padlock icon) — a lock state (`0`=off, `1`=manually
  locked, `2`=auto-engaged by a gesture) lives entirely as
  `chart._hecYAxisLock`, drawn and toggled entirely within Chart.js. The
  card never reads or writes this value directly (see §6 for why that
  matters) — it can only see it change by receiving the resulting
  `customEvent`s (e.g. a `click` or `dblclick` inside `lockAndHandleZone`).
- **Alt-key sample mode** — `options.hover.mode` (already a native 2.7.1
  option) is switched between its normal value and `'dataset'` while Alt
  is held, purely by Chart.js watching `hover` gestures.
- **Cursor** — `canvas.style.cursor` changes to `move`/`ns-resize`/etc. on
  hover over a draggable zone, entirely computed from `_hecLegendIndexAt`/
  `_hecYAxisIndexAt` (see §4), no card involvement.

Contrast with `panX`/`zoomX` (§1), which stay card callbacks — the shared
date range spanning multiple graphs is data the card owns, not Chart.js.

---

## 4. New hit-testing primitives

Added to every `Controller` instance at `initialize` (not present in
2.7.1 at all — the closest native equivalent, `getElementAtEvent`, only
finds *data points*, never legend items or axis labels):

| Method | Signature | Behavior |
|---|---|---|
| `_hecIsOn(px, py, rect)` | → `boolean` | Strict containment — "is this point exactly inside this rectangle". |
| `_hecIsNear(px, py, rect)` | → `boolean` | Containment with a 30%-of-size tolerance zone around the rectangle (X capped at 50px either side). |
| `_hecFindClosest(px, py, rects)` | → index or `-1` | Closest candidate by combined X+Y distance, no distance cap. |
| `_hecFindNearest(px, py, rects)` | → index or `-1` | Closest candidate, but only returned if it also passes `_hecIsNear` — otherwise `-1`. |
| `_hecLegendIndexAt(x, y)` | → index or `-1` | Which legend item (if any) is under this point — exact containment (`_hecIsOn`) against each item's real `legendHitBoxes` rectangle. |
| `_hecYAxisIndexAt(x, y)` | → index or `-1` | Which Y-axis category row (timeline/arrowline only) is under this point — exact containment, closest-row candidate spans the whole label column width. |

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
| `_hecLockIconEl` | 18×18px @ `(15, 5)` | The Y-axis lock padlock SVG. `pointer-events: none` — purely visual, the actual click is handled by the gesture detector via `lockAndHandleZone`. |
| `_hecMoveHandleIconEl` | 15×28px @ `(0, 0)` | The `⠿` graph-reorder handle glyph. Also `pointer-events: none`, same reasoning. |
| `_hecMoveHandleTouchEl` | 33×28px @ `(0, 0)` (0×0 if `moveHandleVisible` is `false`) | The single real touch target covering **both** the lock icon and the move handle as one zone (see below) — `touch-action` toggled dynamically. |
| `_hecYAxisTouchEl` | Matches the Y-axis label column | `touch-action` toggled dynamically, following the lock state or a short click-armed window (see the touch workaround below). |
| `_hecLegendTouchEl` | Tight bounding box of the legend's actual `legendHitBoxes`, +4px margin | Same dynamic `touch-action`, for dragging a curve label. Only exists for `line`/`bar` charts. |
| `_hecLabelTouchEl` | Full label column height | Same dynamic `touch-action`, for dragging a timeline/arrowline entity label. Only exists for `timeline`/`arrowline` charts. |

### Why the lock icon and the move handle share one touch zone

They sit right next to each other, and treating a click/drag on either as
part of the same interaction lets a small ergonomic trick work: a click
anywhere in that 33×28px zone always toggles the Y-axis lock. On touch, if
that click turns out to be the first half of a double-click (drag intent,
not a real toggle), the second press toggles the lock back — undoing the
first toggle — and the drag that follows moves the graph. On mouse/pen,
there's no such ambiguity: click toggles, drag moves, independently.

### The touch-action workaround, in general

Every one of the dynamic-`touch-action` elements above follows the same
two-stage pattern, since `touch-action` must be set *before* a touch
gesture starts to have any effect on it:

1. A `click` anywhere relevant arms a **500ms window** with
   `touch-action: none` already applied — covering the gap up to a
   possible second click.
2. If a `dblclick` follows within that window, whatever it's protecting
   (Y-axis pan, curve/label drag) is now confirmed underway, and the
   block stays in effect for as long as needed (until the gesture's own
   `mouseup`, or — for the Y-axis specifically — until the lock
   disengages).
3. If no second click arrives, the 500ms timer expires and `touch-action`
   reverts to normal, letting the page scroll freely again.

This is why the *standard* way to drag anything in these zones on a touch
device is **double-tap, then drag without lifting your finger** — a
single continuous drag (or a long-press-then-drag, which still works but
isn't the primary path anymore) can't reliably block scroll this way,
since there's only one gesture-start moment to set `touch-action` on, and
you don't know yet whether it's a scroll or a chart interaction.

---

## 6. What stays deliberately private

Every `_hec`-prefixed property or method not listed in §1–§5 above is
genuinely internal. `history-explorer-card.js` never reads or calls any of them directly; it only ever reacts to the
`customEvent` payloads described in §2, or reads/writes the public
`options.*` fields in §1. The one narrow exception, `chart.update()`
(itself a stock 2.7.1 public method, not an addition), is what the card
calls whenever it needs to force an immediate redraw (e.g. after changing
`moveHandleVisible`) rather than reaching into `_hecUpdateDragTouchOverlays`
or similar directly.
