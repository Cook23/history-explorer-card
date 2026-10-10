# History Explorer Card (Cook23 fork) — feature overview

## Adding and organizing entities

Entities can be added through a searchable dropdown showing friendly names (with the entity ID available in a tooltip) and each entity's current state value, or defined statically in YAML — the two can be freely combined on the same card. Wildcard patterns (`sensor.*power*`) add every matching entity at once, sorted alphabetically. Hovering or keyboard-highlighting an entry previews whether it will be added or is already present, before the selection is confirmed; if it's already on the card, a tooltip and a highlight on the containing graph flag the duplicate.

Every entity added goes through the display type menu — line (smart, curve, straight or stepped), bar, direction arrows, or timeline — with the most fitting type pre-selected, so the display can be checked before anything is added; the menu opens even when the entity can only be shown as a timeline. The same menu reopens at any time afterward to change the type, choose how a curve is interpolated, or delete the entity.

With `combineSameUnits`, entities added from the UI with compatible units (including SI-prefixed ones like W/kW) combine onto the same graph automatically. A graph defined in YAML always shows all its entities together, whatever their units — and it can mix bars and curves: the curves are drawn over the bars, never stacked, and keep their own line mode.

## Interactive editing directly on the graphs

A single click on a curve or entity label shows or hides it. A double-click extracts an entity out of a combined graph into its own graph; on a YAML graph, the extracted curve stays *linked* to it — a chain icon joins the two graphs, they move as one block, and a double-click on the chain (or dragging the label back) merges them again. Changing a curve's display type works the same way: a curve that can't share its graph moves to a linked graph, and comes back when its type is changed back. A long-press on a legend or timeline/arrowline label opens the display type menu for that entity, with a Delete option to remove it from the graph entirely. Curve and entity labels can be dragged to reorder them within a graph, or dragged onto a different graph to move them there (within a block of linked graphs, whatever the units; elsewhere, same type and compatible units only — with visual feedback showing whether a drop is allowed), and whole graphs can be dragged by a handle to reorder them on the card. The Y axis can be dragged to pan it, and pinch-zoomed on mobile, with a padlock click to lock the range to its current view.

## Line appearance and statistics

Curves can be drawn between their values by four interpolation algorithms — `monotone` (the default), `steffen`, `makima` or `catmullrom` — set with the `interpolation` option or from the type menu.

The *smart* line mode draws a curve while a sensor reports at its usual rhythm, and a flat dashed line — the last known value held — over each silence, instead of a long spline or diagonal suggesting a gradual change that never happened (the silence detection of the [lowpass_dt](https://github.com/Cook23/lowpass_dt) integration).

Angles — a wind direction, for example — are drawn without jumping across the whole graph at each crossing of 0/360: they're drawn as a continuous curve around their average direction, while the tooltip and the Y axis keep showing the real values. Automatic for entities in `°` or with state class `measurement_angle`, adjustable per entity with `circular` (another period, `2pi`, or off).

Line graphs also support a shaded min/max statistical band (drawn from either long-term statistics or full history), permanent sample point dots at each measurement, and custom dash patterns (including a full custom Canvas dash array, not just the built-in named styles). Display options — color, fill, line width, dash style, and more — can be set per entity, or targeted at a whole family of sensors at once using `entityOptions`'s list form, matching by device class, domain, or a glob/wildcard pattern (e.g. `match: "sensor.*_power"`). Timeline graphs come with a broad set of sensible default state colors across most Home Assistant domains (green for active/good, red for stopped/armed/locked, amber for transitional, grey for unknown), customizable per state via `stateColors`.

## Persistence and multi-device sync

Entities added from the card — and every interactive change made to them: their order, grouping, display type, interpolation, bar interval and visibility — are remembered automatically and synced across every device signed into the same Home Assistant account, via HA's own user storage. Whatever the source — the YAML, this device, or another one — the last change made wins: editing the YAML applies it, and a change made on one device reaches the others. For entities defined in YAML, persistence can be enabled or disabled per field, so a dashboard can either always reset to its YAML defaults or remember specific user adjustments, as needed.

## Replacing Home Assistant's own history popup

The card can stand in for Home Assistant's native "more info" history graph entirely — every entity's popup gets the same pan/zoom/type-menu capability as the main card. A YAML option sets this enabled by default across the dashboard, rather than requiring it to be toggled by hand for each card.

## Configuration flexibility

Every display option can be set on an individual entity, as a default for an entire graph, in `entityOptions`, or once for the whole card, the most specific value always winning — and every spelling an option has is accepted at every level. Entity filtering (`filterEntities`, `excludeFilterEntities`, and per-entity `exclude`) accepts a plain string, a list of strings, or a more explicit object form, whichever is more convenient for a given case.

Malformed YAML — an incorrectly-shaped `exclude:`, for instance — is logged to the console and skipped for just that one entry, rather than breaking the whole card.
