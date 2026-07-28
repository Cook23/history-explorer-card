# History Explorer Card (Cook23 fork) — feature overview

## Adding and organizing entities

Entities can be added through a searchable dropdown showing friendly names (with the entity ID available in a tooltip), or defined statically in YAML — the two can be freely combined on the same card. Wildcard patterns (`sensor.*power*`) add every matching entity at once, sorted alphabetically.

Every new numeric entity goes through a display type menu — line (straight, curved, or stepped), bar, arrowline, or timeline — and that same menu reopens at any time afterward to change the type, or delete the entity from a combined graph.

Entities sharing compatible units (including SI-prefixed ones like W/kW) combine onto the same graph automatically, whether defined in YAML or added dynamically.

## Interactive editing directly on the graphs

A single click on a curve or entity label shows or hides it. A double-click extracts an entity out of a combined graph into its own graph. A long-press on a legend or timeline/arrowline label opens the display type menu for that entity, with a Delete option to remove it from the graph entirely. Curve and entity labels can be dragged to reorder them within a graph, or dragged onto a different graph to move them there (compatible units/types only, with visual feedback showing whether a drop is allowed), and whole graphs can be dragged by a handle to reorder them on the card. The Y axis can be dragged to pan it, and pinch-zoomed on mobile, with a padlock click to lock the range to its current view.

## Line appearance and statistics

Line graphs support a shaded min/max statistical band (drawn from either long-term statistics or full history), permanent sample point dots at each measurement, and custom dash patterns (including a full custom Canvas dash array, not just the built-in named styles). Display options — color, fill, line width, dash style, and more — can be set per entity, or targeted at a whole family of sensors at once by device class, domain, or glob pattern.

## Persistence and multi-device sync

Interactive changes — added entities, their order, grouping, and visibility — are remembered automatically and synced across every device signed into the same Home Assistant account, via HA's own user storage. For entities defined in YAML, persistence can be enabled or disabled per field, so a dashboard can either always reset to its YAML defaults or remember specific user adjustments, as needed.

## Replacing Home Assistant's own history popup

The card can stand in for Home Assistant's native "more info" history graph entirely — every entity's popup gets the same pan/zoom/type-menu capability as the main card. A YAML option sets this enabled by default across the dashboard, rather than requiring it to be toggled by hand for each card.

## Configuration flexibility

Style options — fill, min/max band, dash style, line interpolation mode, line width, sample points, decimation, and net-metering mode — can be set once as a shared default for an entire graph, once for the whole card, or on an individual entity, with the most specific value always winning. Entity filtering (`filterEntities`, `excludeFilterEntities`, and per-entity `exclude`) accepts a plain string, a list of strings, or a more explicit object form, whichever is more convenient for a given case.

Malformed YAML — an incorrectly-shaped `exclude:`, for instance — is logged to the console and skipped for just that one entry, rather than breaking the whole card.
