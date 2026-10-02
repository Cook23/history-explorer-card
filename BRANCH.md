# Branch: v1.2-dev

This branch contains the development version 1.2.

DO NOT assume that code or architecture from main still applies.
This branch is allowed to contain breaking architectural changes.
How the code is organized, and the rules that keep its parts apart: see
[ARCHITECTURE.md](ARCHITECTURE.md).

## Planned

1.2-only features, to do when the time comes (each one a reason for a 1.2 release).

- **A curve's or a bar's color taken from another entity.** The color changes along the
  time axis with the state of another entity — e.g. a room temperature colored by its
  heating's mode, a power colored by the electricity tariff. Possible YAML:
  ```yaml
  - entity: sensor.salon_temperature
    color:
      entity: climate.salon             # the entity that decides the color
      states: { heat: red, off: grey }  # by state…
      # …or thresholds, for a numeric entity: { 0: blue, 20: orange, 25: red }
      default: '#3e95cd'
  ```
  - Chart.js 2.7.1 gives a curve one stroke color and one fill color (per-segment styling
    only came with Chart.js 3); a bar can have its own color (already used by the
    `color` thresholds of bar entities). For curves: a horizontal `CanvasGradient` with
    hard stops (two stops at the same offset) at the times the color changes, for the
    stroke and the fill. It is in pixels, so it must be rebuilt on every zoom, pan and
    resize — a before-draw hook in `deps/chart-hec.js`.
  - The color entity's history is fetched with the others (same cache), even when it
    isn't shown, and turned into a step function of time → color.
  - Bars: a bar covering several states takes, for instance, the one that lasted longest
    within its interval.
  - The legend swatch keeps the `default` color. YAML only, not from the UI.
  - The same mechanism could color a curve by its own value, extending the bars'
    `color` thresholds to curves.

## Planned, once the 1.1 line is dropped

Not before 1.2 is the only line maintained: these changes are too large to port to 1.1.

- **Several Y axes on one graph.** Chart.js already supports this (`scales.yAxes[]`,
  `yAxisID` per dataset, `position: left/right`); the work is in what the fork adds on top,
  which assumes one Y axis (`yAxes[0]` / `'y-axis-0'` in `deps/chart-hec.js`). Proposed
  scope:
  - at most two axes, left and right, given automatically by group of compatible units
    (the first unit on the left, the second on the right); beyond two units, one shared
    axis without unit, with `scale`, as now; an entity option such as `yAxis: right` to
    choose it in YAML;
  - Y pan / zoom / pinch / Shift+wheel: decide which axis moves (the one on the pointer's
    side, or both proportionally);
  - the padlock and `ymin` / `ymax` / `ystepSize` / `ylock` per axis;
  - linked graphs: the plot area must start and end at the same place on every graph of a
    group (the same room kept for a right axis on all of them), so the time stays aligned;
  - the legend shows which axis a curve belongs to;
  - the `circular` Y labels and stacked bars, today computed for one axis.
