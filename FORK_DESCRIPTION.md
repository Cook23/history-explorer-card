# History Explorer Card (Cook23 fork) — feature overview

## Adding and organizing entities

Entities can be added through a searchable dropdown showing friendly names (with the entity ID available in a tooltip) and each entity's current state value, or defined statically in YAML — the two can be freely combined on the same card. Wildcard patterns (`sensor.*power*`) add every matching entity at once, sorted alphabetically. Hovering or keyboard-highlighting an entry previews whether it will be added or is already present, before the selection is confirmed; if it's already on the card, a tooltip and a highlight on the containing graph flag the duplicate.

Every entity added goes through the display type menu — line (smart, curve, straight or stepped), bar, direction arrows, or timeline — with the most fitting type pre-selected, so the display can be checked before anything is added; the menu opens even when the entity can only be shown as a timeline. The same menu reopens at any time afterward to change the type, choose how a curve is interpolated, or delete the entity.

With `combineSameUnits`, entities added from the UI with compatible units (including SI-prefixed ones like W/kW) combine onto the same graph automatically. A graph defined in YAML always shows all its entities together, whatever their units — and it can mix bars and curves: the curves are drawn over the bars, never stacked, and keep their own line mode. A graph mixing two groups of units (a power and a temperature, energy bars and a power curve) gets two Y axes, left and right, each with its own scale — `yAxis` puts an entity on the side of your choice.

## Interactive editing directly on the graphs

A single click on a curve or entity label shows or hides it. A double-click extracts an entity out of a combined graph into its own graph; on a YAML graph, the extracted curve stays *linked* to it — a chain icon joins the two graphs, they move as one block, and a double-click on the chain (or dragging the label back) merges them again. Changing a curve's display type works the same way: a curve that can't share its graph moves to a linked graph, and comes back when its type is changed back. A long-press or a right click on a legend or timeline/arrowline label opens the display type menu for that entity, in submenus — *Display*, *Interpolation*, *Layout* (*Separate*, *Merge back*, *Delete*) — so that every action of a gesture is also in a menu. Curve and entity labels can be dragged to reorder them within a graph, or dragged onto a different graph to move them there (any line or bar graph accepts a curve, whatever its unit, YAML graphs included — a second group of units gets its own Y axis; only the display type can refuse a drop, with visual feedback showing whether it is allowed; a drop is saved only when both graphs are), and whole graphs can be dragged by a handle to reorder them on the card. The Y axis can be dragged by its labels to pan it — each axis on its own when a graph has two — and zoomed with Shift + wheel or a pinch, with a padlock click to lock the range to its current view. Shift + drag moves the time and the Y axis together, and holding Alt shows every sample of the curves.

## Touch, pen and mouse

On a phone or a tablet, a swipe on a graph always scrolls the page, wherever it starts; to drag a label, a graph or the Y axis, tap it, then press it again within half a second and drag. Two fingers zoom and pan the time and the Y axis. A label is picked when touched just beside it, never when the touch is about halfway between two.

The tooltip opens on a click or a tap on the curves, then follows the mouse until the pointer leaves them — hovering alone doesn't open it. A pen's tip works as a finger, and the tooltip follows the pen held above the screen, in the browsers that report it; *Tests (beta) ▸ Pen events*, at the end of the type menu, shows what a browser or app reports of a pen, and sends it as a report.

## Line appearance and statistics

Curves can be drawn between their values by four interpolation algorithms — `monotone` (the default), `steffen`, `makima` or `catmullrom` — set with the `interpolation` option or from the type menu.

The *smart* line mode draws a curve while a sensor reports at its usual rhythm, and a flat dashed line — the last known value held — over each silence, instead of a long spline or diagonal suggesting a gradual change that never happened (same silence detection as the [lowpass_dt](https://github.com/Cook23/lowpass_dt) integration).

Angles — a wind direction, for example — are drawn without jumping across the whole graph at each crossing of 0/360: they're drawn as a continuous curve around their average direction, while the tooltip and the Y axis keep showing the real values. Automatic for entities in `°` or with state class `measurement_angle`, adjustable per entity with `circular` (another period, `2pi`, or off).

A curve's or bar's `color` can also come from another entity — a sensor or template holding a color — or from thresholds on its own value or on another entity's value or states (`{ entity: sensor.heat_pump_mode, heat: red, cool: blue }`): the curve then changes color along its history, point by point.

Line graphs also support a shaded min/max statistical band (drawn from either long-term statistics or full history), permanent sample point dots at each measurement, and custom dash patterns (including a full custom Canvas dash array, not just the built-in named styles). Display options — color, fill, line width, dash style, and more — can be set per entity, or targeted at a whole family of sensors at once using `entityOptions`'s list form, matching by device class, domain, or a glob/wildcard pattern (e.g. `match: "sensor.*_power"`). Timeline graphs come with a broad set of sensible default state colors across most Home Assistant domains (green for active/good, red for stopped/armed/locked, amber for transitional, grey for unknown), customizable per state via `stateColors`.

## Persistence and multi-device sync

Entities added from the card — and every interactive change made to them: their order, grouping, display type, interpolation, bar interval and visibility — are remembered automatically and synced across every device signed into the same Home Assistant account, via HA's own user storage. Whatever the source — the YAML, this device, or another one — the last change made wins: editing the YAML applies it, and a change made on one device reaches the others. For entities defined in YAML, persistence can be enabled or disabled per field, so a dashboard can either always reset to its YAML defaults or remember specific user adjustments, as needed.

## Replacing Home Assistant's own history popup

The card can stand in for Home Assistant's native "more info" history graph entirely — every entity's popup gets the same pan/zoom/type-menu capability as the main card. Loaded as a frontend module, it works on every page of Home Assistant (Settings, History…), not only once a dashboard has been shown. A YAML option sets this enabled by default across the dashboard, rather than requiring it to be toggled by hand for each card.

## Configuration flexibility

Every display option can be set on an individual entity, as a default for an entire graph, in `entityOptions`, or once for the whole card, the most specific value always winning — and every spelling an option has is accepted at every level. Entity filtering (`filterEntities`, `excludeFilterEntities`, and per-entity `exclude`) accepts a plain string, a list of strings, or a more explicit object form, whichever is more convenient for a given case.

Malformed YAML — an incorrectly-shaped `exclude:`, for instance — is logged to the console and skipped for just that one entry, rather than breaking the whole card.
