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

- **The info panel on every page of Home Assistant.** Today, a new browser tab opened
  directly on a page that isn't a dashboard (Settings → Entities, History…) shows Home
  Assistant's own history in an entity's dialog, not the info panel: the card's file is a
  Lovelace resource, loaded only once a dashboard is shown, and the hook in
  `src/history-info-panel.js` comes with it.
  - The file can't load itself earlier: document `frontend: extra_module_url:` (the way
    card-mod does), with exactly the same URL as the Lovelace resource (`?hacstag=…`
    included), so that the browser runs it once.
  - Make a second run harmless anyway (another URL runs it twice):
    `customElements.define` only if not defined yet, and the `ha-more-info-history`
    prototype patched only once (patching it twice would make `_oldUpdated` call itself).
  - Make the panel independent of the card: the hook always installed, the enabled state
    checked at each render (Home Assistant's own history otherwise), and the enabled state
    and config read from HA user data (`history-explorer-info-panel`, through the dialog's
    own `hass`) when localStorage has none — a new browser or device no longer needs a
    card to be shown first, and switching the panel on or off no longer reloads the page.

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
