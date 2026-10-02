# Branch: v1.2-dev

This branch contains the development version 1.2.

DO NOT assume that code or architecture from main still applies.
This branch is allowed to contain breaking architectural changes.
How the code is organized, and the rules that keep its parts apart: see
[ARCHITECTURE.md](ARCHITECTURE.md).

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
