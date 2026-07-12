[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/v/release/Cook23/history-explorer-card?style=for-the-badge)](https://github.com/Cook23/history-explorer-card/releases)
[![GitHub stars](https://img.shields.io/github/stars/Cook23/history-explorer-card?style=for-the-badge)](https://github.com/Cook23/history-explorer-card/stargazers)
![Experimental](https://img.shields.io/badge/status-experimental-yellow?style=for-the-badge)

<a href="https://buymeacoffee.com/thierry_couquillou" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50"></a>

# History explorer card

> **This is a custom history card for Home Assistant. it is a fork of [SpangleLabs/history-explorer-card](https://github.com/SpangleLabs/history-explorer-card)** (itself a fork of the original [alexarch21/history-explorer-card](https://github.com/alexarch21/history-explorer-card), archived March 2024). The changes below are applied on top of version 1.0.54, released as version 1.1.4.

> For a shorter, user-focused version of this documentation, see [README.md](https://github.com/Cook23/history-explorer-card/blob/main/README.md).

This card offers a highly interactive and configurable way to view the history of your entities in HA. The card uses asynchronous stream caching and adaptive data decimation to hide the high latency of HA's history database accesses and tries to make it into a smooth interactive experience.

![history-panel-sample](https://user-images.githubusercontent.com/60828821/147441073-5fbdeb2e-281a-4312-84f1-1ce5c835fc3d.png)

---

## Table of contents

- [Version highlights](#version-highlights)
- [Changes vs upstream](#changes-vs-upstream)
- [Install and configuration](#install-and-configuration)
- [Usage](#usage)
  - [Interactive navigation](#interactive-navigation)
  - [Adding entities](#adding-entities)
  - [Choosing an entity's display type](#choosing-an-entitys-display-type)
  - [Interactive graph management](#interactive-graph-management)
- [Info panel — replacing the HA more info popup](#overriding-the-ha-more-info-history-info-panel)
- [Graph types](#graph-types)
  - [Line graphs](#grouping-multiple-entities-into-a-single-graph)
  - [Bar graphs](#bar-graphs-for-total-increasing-entities)
  - [Timeline charts](#timeline-charts)
  - [Compass arrow graphs](#compass-arrow-graphs)
- [Y axis scaling](#y-axis-scaling)
- [Line appearance](#line-interpolation-modes)
  - [Interpolation modes](#line-interpolation-modes)
  - [Stroke style](#line-stroke-style)
  - [Sample dots](#displaying-individual-samples)
  - [Min/max band](#showing-the-minmax-statistical-range)
  - [Unavailable data](#line-graphs-and-unavailable-data)
  - [Custom data processing](#custom-data-processing-functions)
- [Long term statistics](#long-term-statistics)
- [Display defaults](#default-view-and-time-ranges)
  - [Time range and offset](#default-view-and-time-ranges)
  - [Disabling cross-device sync](#disabling-cross-device-sync-disable_persistence)
  - [Auto refresh](#auto-refresh)
  - [Current values and rounding](#showing-current-sensor-values)
  - [Data decimation](#data-decimation)
- [Entity options](#customizing-dynamically-added-graphs)
  - [Per-entity options](#customizing-dynamically-added-graphs)
  - [Pattern-based options](#pattern-based-entity-options)
  - [Complete property list](#complete-list-of-entityoptions-properties)
- [UI configuration](#configuring-the-ui)
  - [Header, dark mode, colors, layout](#configuring-the-ui)
  - [Graph sizes](#configuring-the-ui)
  - [Tooltip](#configuring-the-tooltip-popup)
  - [Time tick density](#changing-the-horizontal-time-tick-density)
- [Multiple cards](#multiple-cards)
- [CSV export](#exporting-data-as-csv)
- [YAML graph configuration](#yaml-configuration-for-preconfigured-graphs)
  - [Protecting entities from cross-device sync](#protecting-specific-entities-from-cross-device-sync)
- [Running as a sidebar panel](#running-as-a-panel-in-the-sidebar)

---

## Version highlights

A chronological summary of every release that changed how the card behaves or is configured. For the exhaustive, unabridged list — including bug fixes and internal refactors — see [CHANGELOG.md](https://github.com/Cook23/history-explorer-card/blob/main/CHANGELOG.md).

- **v1.1.30** — New `disable_persistence` option to block the HA-user-storage restore front (cross-device sync) while leaving YAML and local (per-device) restore untouched. Card-level scope: `range` and/or `entities` (or `all`). Entity-level scope: a specific list of protected fields (`color`, `groupId`, `interval`, etc.) or `entities`/`all` as shorthand for every field — falls back to the card-level setting when unset on the entity.
- **v1.1.29** — New entity type menu: change a numeric entity between line (straight/curved/stepped), bar, arrowline or timeline directly from the legend, a timeline label, or the entity selector — no need to remove and re-add it; a "Default" option re-applies each entity's auto-detected type for wildcard batches.
- **v1.1.28** — Static YAML graphs fixed to combine correctly regardless of entity type/unit mix, honor the `graph.type` option, and correctly forward legend clicks and drag-and-drop rejection like dynamic graphs.
- **v1.1.27** — Internal architecture unification: static (YAML) and dynamic (user-added) graphs now share a single code path (`pconfig.entities` + `pconfig.graphs`), simplifying maintenance and enabling later features such as the entity type menu.
- **v1.1.26** — Touch ergonomics: Y axis pan on touch screens now requires a 500ms long-press before activating, avoiding accidental triggers while scrolling through graphs; new `ylock` YAML option locks a graph's Y axis against all interactive changes.
- **v1.1.25** — Bar graph interval selection (10 min / hourly / daily / monthly) is now persisted across reloads with the same "last one to speak wins" logic used for the time range; entity selector dropdown shows each entity's current state value.
- **v1.1.24** — Toolbar switches between three adaptive layouts depending on available width, replacing the previous fixed-width breakpoint logic; fixes wrapping issues on Safari.
- **v1.1.23** — Entity selector unified across desktop and mobile into a single custom dropdown showing friendly names, with keyboard navigation and wildcard bulk-add.
- **v1.1.19** — `defaultInfoPanel` and `defaultTimeRange` YAML options introduced, with a "last one to speak wins" persistence model reconciling YAML, per-device, and per-HA-user state.
- **v1.1.18** — `infoPanelActive` YAML option (info panel enabled by default), with cross-card conflict detection; comprehensive default state color palette covering most Home Assistant domains.
- **v1.1.13** — Visual drag-and-drop feedback (ghost element, insertion markers, drop-target highlighting) and persisted legend label visibility (hidden/shown state survives reload).
- **v1.1.12** — Per-user server-side persistence: graph configuration now syncs across devices via Home Assistant's `frontend/set_user_data`, with automatic migration from local browser storage.
- **v1.1.10** — Automatic grouping of entities sharing compatible SI units onto the same graph (with unit conversion), plus drag & drop to reorder curves and graphs.
- **v1.1.4** — `entityOptions` dict form and pattern-based list form unified into a single lookup, matching by glob pattern, device class, or domain.
- **v1.1.0** — First release of the Cook23 fork: pattern-based `entityOptions`, `showMinMax` statistical band, `showPoints`, custom dash patterns.

---

## Changes vs upstream

### New option — pattern-based entity configuration

- **`entityOptions` now accepts a list form** with glob pattern matching, in addition to the original dict form. This makes it possible to apply display options to entire families of entities without listing them individually. All entity options are supported. The dict form is fully preserved for backward compatibility.

```yaml
# Dict form (original, unchanged)
entityOptions:
  sensor.temperature:
    color: red
  humidity:
    lineMode: lines

# List form (new) — supports glob patterns, entity ids, device classes and domains
entityOptions:
  - match: "sensor.*_power"
    lineMode: lines
    color: '#3e95cd'
  - match: ["sensor.temperature*", "sensor.humidity*"]
    lineMode: curves
    showMinMax: statistics
  - entity: sensor.sun_azimuth
    type: arrowline
    color: red
```

Priority in list form: first matching entry wins per property. Entries can match by exact entity id (`entity:` key), device class, domain, or glob pattern (`match:` key).

### Bug fixes

- **Line mode `lines` — spline overshoots corrected.** The original code applied Catmull-Rom interpolation (`cubicInterpolationMode: 'default'`) even in `lines` mode, causing visible spikes at measurement points. Fixed: `lines` and `stepped` now use strict monotone interpolation with zero tension, guaranteeing that the curve passes exactly through each data point without any deviation.

- **Curve mode `curves` — unnatural transitions and horizontal overshoots corrected.** The original used `monotone` (Steffen) interpolation for `curves` with undefined tension (Chart.js default 0.4), which produced asymmetric flattened transitions. Worse, switching to Catmull-Rom (`default`) introduced backward movement on the time axis on steep fronts. Fixed: all modes now use monotone interpolation (which mathematically guarantees no backward X movement), with tension 0.1 for `curves` — a good compromise between visual smoothness and data fidelity, appropriate for signals already filtered by a first-order low-pass.

- **Line rendering — sharp pointed corners and tapering ends corrected.** Canvas HTML5 default join style (`miter`) caused the line to taper to a point at direction changes. Fixed: `borderJoinStyle` and `borderCapStyle` are now set to `round` for all line modes, giving constant stroke width at corners and rounded line ends.

- **Cache anchor point — spurious vertical spikes on graph start.** When retrieving the last known state from the cache slot preceding the visible window, the original code forced its timestamp to the exact left edge of the window regardless of when the state actually occurred. This created an artificial instant transition at graph start. Fixed: the real `last_changed` timestamp of the cached state is now used.

### New options — line appearance

- **`dashMode`** — controls the stroke style of a line. Accepts the existing named modes (`points`, `shortlines`, `longlines`, `pointline`) and now also a custom Canvas `setLineDash` array, e.g. `dashMode: [10, 4, 2, 4]`. Previously only named modes were supported.

- **`showPoints`** — permanently displays a dot at each measurement point on a line chart, independently per entity. Accepts `true` (radius 4 px) or a numeric radius in pixels. Available on individual entities and in `entityOptions`. The existing graph-level `showSamples` option has also been extended to accept a numeric radius.

- **`showMinMax`** — draws a shaded band between the statistical min and max values, using the line color at low opacity (similar to the HA standard history panel). Two modes: `statistics` (band only on the long-term statistics portion of the graph) and `history` / `states` (band on the full graph, with a parallel statistics query for the short-term history portion). Available per entity and in `entityOptions`.

### Bug fix — missing `entityOptions` wiring

- **`decimation`** was read per-entity from `g.entities[j].decimation` in the rendering loop but was never populated from `entityOptions`. It is now correctly wired, making per-entity decimation control fully functional via `entityOptions`.

- **`showPoints`** was similarly missing from the entity options pipeline and is now fully wired through `entityOptions` and the datasets builder.

### Quality of life

- **`lineMode` accepts singular aliases.** `line`, `curve` and `step` are now accepted in addition to `lines`, `curves` and `stepped`. The value is normalized at all entry points (global config, `entityOptions`, and static YAML graphs).

### New — mobile touch gestures

- **Y axis drag** — dragging on the Y axis label area pans the Y scale vertically. Works on both desktop (cursor changes to `↕`) and mobile (dedicated touch handler with `preventDefault` to avoid page scroll interference).
- **Two-finger pinch vertical** — zooms the Y axis in or out, centered on the current midpoint. Works on mobile via touch events.

### New — SI unit grouping, ungrouping and drag & drop

- **Automatic SI unit grouping** — when `combineSameUnits` is enabled, dynamically added entities with compatible SI units (e.g. W and kW, m and km) are automatically grouped onto the same graph. Y axis values and tooltips are always displayed in the original unit of each entity. Grouping and the resulting unit conversions are fully transparent to the user. SI unit conversion also applies to graphs defined manually in the YAML.

- **Ungroup by double-click** — double-clicking a curve label in the legend extracts that entity into its own separate graph, placed immediately below the original graph. The ungrouped state is remembered in the HA user storage (with browser local storage as fallback) and survives a page refresh.

- **Drag and drop curves between graphs** — a curve can be dragged from its legend label and dropped onto another graph. Only drops onto graphs with compatible SI units are accepted. The curve's color is preserved; if the target graph already uses that color, a free color is assigned automatically. An incompatible drop shows a brief tooltip explaining the mismatch. The new grouping is synchronized with your HA user account.

- **Reorder curves within a graph** — curve labels in the legend can be dragged left or right to reorder curves within the same graph. The new order is persisted.

- **Drag and drop graphs to reorder** — graphs can be reordered by dragging on the ⠿ symbol at the top left of each graph (30 px wide zone). A simple click on that area still toggles the Y axis lock. The new order is synchronized with your HA user account.

- **Drag and drop timeline/arrowline entities** — timeline and arrowline entities can be dragged from their label area to another graph of the same type, or reordered within the same graph by dragging their label up or down. Long labels that don't fit are truncated and can be revealed in full by clicking them.

- **Auto-scroll during drag** — when dragging a graph or a curve near the top or bottom edge of the screen, the page scrolls automatically to allow reaching graphs that are off screen.

- **Incompatible drop feedback** — any drag & drop onto an incompatible target (wrong unit, wrong graph type) shows a brief tooltip explaining the mismatch instead of silently failing.

### New — drag & drop visual feedback

- **Ghost element** — a semi-transparent copy of the dragged item follows the cursor during all drag operations (legend labels, timeline/arrowline entities, graph reorder).
- **Insertion markers** — a vertical marker shows the exact insertion point when reordering legend labels; a horizontal marker shows it when reordering timeline/arrowline entities or graphs.
- **Drop target highlighting** — the target graph is highlighted during a compatible drag-over.
- **5 px activation threshold** — drag state activates only after the pointer has moved 5 px, preventing accidental drags on clicks.

### New — timeline/arrowline double-click ungroup

- **Double-click** an entity label in a timeline or arrowline graph to extract it into its own graph, placed immediately below the original — same behavior as line/bar legend double-click.

### New — entity selector (v1.1.23+)

- **Unified dropdown** — desktop and mobile now use the same custom dropdown, eliminating the native `<datalist>` with its display limitations.
- **Friendly names** — the dropdown and input field display friendly names instead of entity IDs. The entity ID is shown in a tooltip on selection.
- **Dual filtering** — the dropdown filters on both friendly name and entity ID simultaneously.
- **Keyboard navigation** — ArrowUp/ArrowDown to navigate, Enter to select, Escape to close and clear; second Enter triggers entity add.
- **Wildcard dropdown** — when a wildcard pattern is entered, matching entries are shown in bold; first Enter selects all matching entities, second Enter adds them all.
- **Duplicate detection extended** — wildcard multi-add detects duplicates, lists them in a tooltip, and highlights all affected graphs with a red dashed outline.
- **Dropdown click adds directly** — clicking an entry in the dropdown adds the entity immediately; no separate `+` button is needed (removed in v1.1.29). Keyboard flow is unchanged: second Enter still confirms.
- **Input field cleared** after entity add (success or error) via a timer; ESC clears immediately.
- **Dropdown positioning** — the dropdown appears below the input field for `selector: top` (default) and above for `selector: bottom`; height is capped to `min(50vh, available viewport space)`.

### New — entity display type menu (v1.1.29+)

- A menu lets you choose how any numeric entity is displayed: line (straight, curved or stepped), bar, arrowline or timeline.
- Opens right after selecting a new numeric entity in the dropdown — nothing is added until a type is chosen (click or keyboard); the choice both sets the type and performs the add in one step.
- Also opens on a 700ms long-press of a legend label (line/bar) or a timeline/arrowline label, and when re-selecting an already-added entity, to change its type.
- All-or-nothing: shown in full only for entities whose current state is numeric-convertible; not shown at all otherwise, since a non-numeric entity (on/off, text) can only ever be a timeline — it's added as one directly, no menu.
- For a wildcard match, an extra **"Default"** option (pre-selected) applies each matched entity's own auto-detected type individually; picking any other option applies that one type to the whole batch.
- The currently active type is pre-selected in bold; ArrowUp/ArrowDown and Enter navigate and confirm with the keyboard.
- Available in the info panel too, via a "Type" link shown between the date and range selectors for numeric entities.

### New — per-user server-side persistence (v1.1.12+)

- Dynamically added entities, graph order, bar intervals, and time range are now stored in HA's `frontend/set_user_data` storage, tied to the HA user account and synchronized across all devices. Browser local storage is kept as a fallback.

### New — info-panel default state (v1.1.19+)

- **`defaultInfoPanel`** YAML option sets the default enabled state of the info panel. A "last one to speak wins" logic applies: changing the YAML value overrides user preference, but only when the YAML value actually changes.

### New — time range persistence (v1.1.19+)

- **`defaultTimeRange`** now uses "last one to speak wins" logic: changing the YAML value overrides the user-adjusted range only when the YAML value actually changes. The user-adjusted range is otherwise preserved across reloads and devices.

### New — adaptive toolbar layout (v1.1.24+)

- Toolbar layout replaced from CSS floats to CSS Grid, resolving wrapping issues on Safari and narrow cards.
- Three adaptive layouts: A (all on one line), B (selector on second line), C (no selector).
- Compact date and range display when toolbar width < 300px.
- X-axis tick step automatically increased to 2 months for 1-year range on narrow cards.

---

## Install and configuration

### HACS

Add this repository as a custom repository in HACS: `https://github.com/Cook23/history-explorer-card`

### Manual install

 1. Download the `history-explorer-card.js` file and copy it into your `config/www` folder
 2. Add a resource reference to it. On the HA UI, navigate to Configuration -> Dashboards -> Resources. Visit the [Registering resources](https://developers.home-assistant.io/docs/frontend/custom-ui/registering-resources) page on the Home Assistant support site for more information.
 3. Click on the `+ Add Resource` button
 4. Type `/local/history-explorer-card.js` into the URL field and make sure the resource type field says Javascript Module
 5. Hit create

You can now add the card to your dashboard as usual. You may have to refresh the page in your browser once after adding the card to properly initialize it.

### Full configuration reference

To see a list of all possible configuration options, check the [Full reference config](full-reference-config.yaml) file, which provides an example of all config parameters for the card, along with their defaults and a short explanation of their functionality.

---

## Usage

### Interactive navigation

https://user-images.githubusercontent.com/60828821/147440026-13a5ba52-dc43-4ff7-a944-9c2784e4a2f7.mp4

When the card is opened, it will display the history of the configured entities for the last 24 hours starting at the current date and time. On the top left you will find the date selector previous and next buttons, use them to quickly browse through the days. Your can use the right side time range selector (dropdown or plus / minus buttons) to zoom into or out of the history. You can also use the interactive zoom mode (magnifying glass icon) to select a region on a graph to zoom into. Another convenient way to zoom in and out of the graphs is by using the mouse wheel while holding the CTRL key.

Click or tap on a graph and drag left or right to slide it through time. The card will stream in the database as you move along. If you have a slow DB (like on an SD card), you may see empty parts on the chart that will progressively fill as the data comes in. The larger the shown time range, the more the effect is visible. So scrolling through entire weeks will generate more database accesses than scrolling through days or hours at a time, especially on slower CPUs, like phones.

Once you release the mouse button after dragging (or release your finger from the chart), the card will automatically readjust the y axes on all charts to better reflect the new data. The card will also synchronize all other charts in the history to the same point in time. That way you will always see the same time range on all your data and everything will be aligned.

Clicking the date selector will bring you back to the current date and time without changing your zoom level. A double click on the date selector will bring your back and also reset your zoom to the configured default range.

Like in the native HA history panel, you can hover over the chart line or state timelines to get a tooltip of the selected values or state.

### Adding entities

The entities visible on the history explorer card can be defined in the card configuration or they can be added or removed on the fly through the card UI without changing the configuration. Both modes can be combined. The entities defined in the YAML will be displayed first and will always be visible when the dashboard is opened. Dynamically added entities will be displayed next. The entities you add or remove over the UI are synchronized with your HA user account and restored across all devices. Browser local storage is kept as a fallback.

You can manage your dynamically configured entities like this:

![history-panel-otf-entities](https://github.com/alexarch21/history-explorer-card/raw/main/images/screenshots/history-panel-otf-entities.png)

If you want to manage all your entities dynamically, you will need to supply an empty YAML. You can still add global configuration settings.

```yaml
type: custom:history-explorer-card
graphs:
```
By default the UI entity dropdown will list all entities known to HA. This can be a little overwhelming if you have lots. Alternatively the card can only list entities that are actually recorded and available in the database. Doing this will require a database access which can take a few seconds on larger installs. You can use the card normally while the list is loading in the background. The add entity list will become available as soon as the data is loaded. To turn on this mode use the following config in your YAML:

```yaml
type: custom:history-explorer-card
recordedEntitiesOnly: true
```
The entity selector shows friendly names and filters on both friendly name and entity ID simultaneously. The entity ID is shown in a tooltip on selection. Keyboard navigation is fully supported:

- **ArrowUp / ArrowDown** — navigate the dropdown list
- **Enter** — select the highlighted entry; second Enter adds it to the graph
- **Escape** — close the dropdown and clear the input field

Clicking an entry in the dropdown adds it directly — there is no separate `+` button to press afterwards.

For a numeric entity, adding it (by click, or by the second Enter) doesn't add it right away: a menu pops up first letting you choose its display type — line (straight, curved or stepped), bar, arrowline or timeline. Nothing is created in the graph or persisted until a type is picked; the choice both sets the type and performs the add in one step. Non-numeric entities (on/off, text states) skip this menu entirely and are added directly as a timeline, since that's the only representation that makes sense for them. See [Choosing an entity's display type](#choosing-an-entitys-display-type) below for the full behavior, including long-press access on existing labels and the wildcard "Default" option.

The entity entry field accepts the `*` wildcard and can automatically add multiple entities that match the provided pattern. When a wildcard is entered, matching entries appear in bold in the dropdown. The first Enter selects all matching entities; the second Enter (or clicking an entry) opens the display type menu for the whole matched batch — see below. Some examples:
```
person.*      - Add all entities from the person domain
*door*        - Add all entities that contain the term 'door' in the name, regardless of domain
sensor.*door* - Add all entities that contain the term 'door' in the name, but only from the sensor domain
*             - Add all available entities in the list
```
The entities shown in the list can be further filtered using the `filterEntities` option. The same wildcard syntax applies here. For example:
```yaml
type: custom:history-explorer-card
filterEntities: 'binary_sensor.*'   # Show only binary sensors in the selector dropdown list
filterEntities:                     # Or use multiple filters, entities matching any of the filters will be added
  - '*power*'
  - 'sensor.*energy*'
```

Dynamically added entities can be individually removed by clicking the `x` close button next to them or all together using the option in the entity action dropdown menu:

![image](https://user-images.githubusercontent.com/60828821/186549959-cd3705b6-229a-46c5-abcf-6a9f3b675f0b.png)

### Choosing an entity's display type

Any numeric entity — one whose current state can be read as a number — can be shown as a line (straight, curved or stepped), a bar, an arrowline (bearing) or a timeline. A menu for making this choice opens automatically wherever it's relevant:

- **Right after selecting a brand-new entity** from the dropdown (click, or second Enter). Nothing is added to the graph or to persisted configuration until a type is picked — the choice both defines the type and performs the creation in the same action. The currently auto-detected type (based on the entity's `state_class`/`unit_of_measurement`, or an explicit `entityOptions` override) is pre-selected in bold.
- **On a 700ms long-press** of a legend label on a line/bar graph, or of an entity label on a timeline/arrowline graph — to change the type of an entity that's already added.
- **When re-selecting an entity that's already present** in a graph — same effect as the long-press, reached via the entity selector instead.

The menu is all-or-nothing: it is shown in full only when the entity's current state is numeric-convertible. It is not shown at all otherwise — a non-numeric entity (an `on`/`off` state, free text, etc.) can only ever be represented as a timeline, so it is added directly as one, with no menu and no partial/greyed-out state to choose from.

For a **wildcard match** (multiple new entities added at once), the menu gets an extra **"Default"** entry at the top, pre-selected by default:
- Choosing **"Default"** creates each matched entity with its own individually auto-detected type — exactly as if each had been added on its own.
- Choosing any other option (line/bar/arrowline/timeline) applies that single type to every entity in the batch. A non-numeric entity within the batch is still always created as a timeline regardless of this choice, per the rule above.

Keyboard use: ArrowUp/ArrowDown moves a highlight between the options (starting from the pre-selected one), Enter confirms; pressing Enter without moving the highlight confirms the pre-selected/default option directly.

The type chosen this way is persisted the same way as everything else added through the UI — synchronized with your HA user account and restored across all devices.

In the [info panel](#overriding-the-ha-more-info-history-info-panel), a **"Type"** text link appears between the date and range selectors whenever the panel's entity is numeric, opening the same menu.

### Interactive graph management

#### Grouping multiple entities into a single graph

For line graphs, each dynamically added entity will be displayed in its own graph by default. If you prefer having entities with compatible units of measure grouped into a single graph, then you can override this default behavior with the following YAML setting:

```yaml
type: custom:history-explorer-card
combineSameUnits: true
```

When `combineSameUnits` is enabled, entities with compatible SI units (for example W and kW, m and km) are automatically placed on the same graph. Unit conversion is applied transparently so that Y axis labels and tooltip values are always shown in the original unit of each entity.

SI unit conversion also applies to graphs defined manually in the YAML. If a manually defined graph contains entities with compatible but different SI units (for example a mix of W and kW sensors), the card automatically converts all values to a common unit chosen to minimise the number of digits, and displays each entity's value in its original unit in the tooltip and legend.

Timeline graphs will always automatically group if possible. Graphs defined manually in the YAML will never auto-group; their grouping can be controlled in the YAML.

![image](https://user-images.githubusercontent.com/60828821/156686448-919cbd9c-4e77-4efc-a725-e53a7049a092.png)

#### Ungrouping a curve

A curve can be extracted from a grouped graph by double-clicking its label in the legend. The curve will be re-drawn as its own graph, placed immediately below the original. The ungrouped state is remembered in the HA user storage (with browser local storage as fallback) and survives a page refresh. Double-click another label on the same graph to extract further curves one by one.

A long-press (700ms) on a legend label instead opens the [display type menu](#choosing-an-entitys-display-type) for that entity.

#### Moving curves between graphs

A curve can be moved to another graph by dragging its legend label and dropping it onto the target graph. Only graphs with compatible SI units are accepted as drop targets. The curve's color is preserved; if it conflicts with a color already in use on the target graph, a free color from the default palette is assigned automatically. An incompatible drop shows a brief tooltip explaining the mismatch (e.g. `W ≠ m`).

#### Reordering curves within a graph

Curve labels in the legend can be dragged left or right to change their display order within the same graph. The new order is synchronized with your HA user account.

#### Reordering graphs

Graphs can be reordered by dragging on the ⠿ symbol at the top left of each graph (a 30 px wide zone). Drag a graph up or down and drop it onto another graph: releasing above the midpoint of the target inserts it above, releasing below the midpoint inserts it below. A simple click on that same area still toggles the Y axis lock as before. The new order is synchronized with your HA user account.

When dragging a graph or a curve near the top or bottom edge of the screen, the page scrolls automatically to allow reaching graphs that are not currently visible.

#### Timeline and arrowline entity management

Entities in timeline and arrowline graphs can also be reorganized interactively:
- **Double-click** an entity label to extract it into its own graph, placed immediately below the original
- **Long-press** (700ms) an entity label to open the [display type menu](#choosing-an-entitys-display-type)
- Drag an entity label to move it to another graph of the same type
- Drag an entity label up or down to reorder it within the same graph
- Long labels that don't fit in the label area are truncated; click a truncated label to reveal the full name in a tooltip

All drag operations show a ghost element and horizontal insertion marker for precise positioning. All changes are synchronized with your HA user account.

### Legend / entity labels

You can hide an entity in a graph by clicking its label on the top. Click it a second time to make the entity visible again. An entity can be hidden by default using the `hidden` property in your entityOptions or in the manual YAML (see the advanced YAML example at the end of this readme).

**Double-clicking** a label extracts the corresponding curve into its own graph (see the *Ungrouping a curve* section above).

**Dragging** a label left or right on the same graph reorders curves within the graph.

**Dragging** a label onto another graph moves the curve to that graph (see the *Moving curves between graphs* section above).

If you would like to entirely remove the labels from the UI, use the `legendVisible` flag:

```yaml
type: custom:history-explorer-card
legendVisible: false
```

---

## Overriding the HA more info history (info-panel)

The card is capable of replacing the history graph in the HA more info popup that appears when you click an entity anywhere on your dashboard. When enabled, clicking any entity on your dashboard will open the history explorer card instead of the standard HA history graph, giving you the same interactive experience (zoom, pan, Y axis control) directly inside the popup.

### Enabling the info-panel

To enable the feature, add the following to the card's YAML configuration:

```yaml
type: custom:history-explorer-card
infoPanel: true
defaultInfoPanel: true   # optional: set default enabled state; user preference is otherwise preserved
```

Once enabled, clicking any entity anywhere on your Lovelace dashboard will open the more info popup with the history explorer graph instead of the default HA history chart.

The `defaultInfoPanel` option uses "last one to speak wins" logic: changing the YAML value overrides the user preference only when the YAML value actually changes. The user can still toggle the info panel on or off through the card UI.

### What the info-panel supports

The info-panel renders a single interactive line, bar, timeline or arrowline graph for the selected entity, using the same rendering engine as the main card. All interactive features are available:

- Pan left and right through time by dragging the graph
- Zoom in and out using the time range selector or the mouse wheel with CTRL
- Y axis lock and interactive Y axis pan (drag on the left label area, cursor changes to `↕`)
- Two-finger vertical pinch zoom on mobile
- Tooltip on hover
- Long term statistics integration (seamless transition past the history retention limit)

The graph type and display options for the entity are taken from the card's `entityOptions` configuration, so an entity configured as `arrowline` in your YAML will appear as an arrowline in the info-panel as well.

### Info-panel limitations

- The info-panel shows a single entity graph only. Ungrouping, curve drag & drop and graph reordering are not available in the popup.
- CSV export is not available in the info-panel.
- The default time range shown in the popup follows the `defaultTimeRange` setting of the card.

---

## Graph types

### Bar graphs for total increasing entities

Entities that represent a total (monotonically increasing or net metering) can be visualized as adaptive bar charts. This applies to entities such as, for example, consumed energy, water or gas, rainfall, or network data usage. The data is visualized over a time interval (10 minutes, hourly, daily or monthly) that can be toggled on the fly and independently for each graph.

![image](https://user-images.githubusercontent.com/60828821/193383950-53242b11-d467-42ba-9859-3b3df0b0dcb8.png)

Bar charts use the `bar` chart type and can be used in both dynamically and statically added entities by setting the type accordingly. When dynamically adding an entity with a state class of `total_increasing`, then the bar chart type is automatically used. If the entity does not have this state class, then its type must be explicitly set to `bar`.

Use the selector on the top right of the graph to choose the time interval your data is displayed at. You can add the same entity multiple times in separate graphs with different intervals. Selecting `as line` will show the raw data of the entity as a line graph. The default interval is hourly. It can be overridden using the `interval` option. Possible values are `10m`, `hourly`, `daily` or `monthly`.

Example configuration of a bar chart display for the entity `sensor.rain_amount` when added dynamically. The default interval is 10 minutes and the type is explicitly set to `bar`. The latter is not needed if the entity has a `total_increasing` state class.

```yaml
entityOptions:
  sensor.rain_amount:
    type: bar
    color: '#3e95cd'
    interval: 10m     # Default interval for this entity can be 10m, hourly, daily or monthly
```

Bar graphs can be manually added in the YAML too. Multiple entities can be combined into a single graph. The bars for each entity will then be displayed side by side:

![image](https://user-images.githubusercontent.com/60828821/193384065-db7423ac-b3d2-4992-988a-a0d16a3ecc78.png)

```yaml
graphs:
  - type: bar
    title: Rainfall
    options:
      interval: daily
      stacked: false
    entities:
      - entity: sensor.rain_amount
        scale: 0.5
      - entity: sensor.rain_amount
```

Set the `stacked` option to `true` to display the bars on top of each other rather than side by side:

![image](https://github.com/alexarch21/history-explorer-card/assets/60828821/715f0416-6b4f-4b0d-869b-c732e7f2dd8d)

#### Color ranges

Bar graphs can be color coded depending on the value they display rather than having a single color. The color range thresholds are provided as value pairs under the color key. You can provide as many thresholds as you want. Both dynamic and YAML defined graphs are supported.

```yaml
entityOptions:
  energy:           # apply this color coding to all sensors of the energy device class (also works for domains or individual entities)
    type: bar
    color:
      '0.0': blue   # Bar is blue between below and up to 1.0 kWh
      '1.0': green  # Bar is green between 1.0 - 1.5 kWh
      '1.5': red    # Bar is red at 1.5 kWh and above
```
![image](https://user-images.githubusercontent.com/60828821/197369661-9c75c9fe-e33f-4790-8348-8ae103880bfb.png)

#### Net metering

By default bar graphs will adhere to the standards defined by HA for the `total_increasing` state class, meaning that a decrease of the data value will be interpreted as a meter reset. This prevents the use with net metering sensors, as those can have decreasing totals as part of their operation. If you would like to visualize total accumulating sensors that can decrease (net metering), use the `netBars` setting (available in both entityOptions and manual predefined YAML). You can mix net metered and non-net metered (total increasing) sensors in the same graph.

```yaml
graphs:
  - type: bar
    entities:
      - entity: sensor.net_meter
        netBars: true
        color:
          '-1000': red   # Red for negative bars
          '0.0': green   # Green for positive bars
```

NOTE: This is very similar to the way HA implements the `total` state class and you can visualize `total` net metered sensors with this option. However, the `last_reset` attribute is not implemented in this card, so the bar just following a meter reset will be wrong.

### Timeline charts

Timeline charts are typically used to visualize entities with non-numerical data. When you dynamically add an entity without a unit of measure, then the card will automatically use a timeline chart to visualize its states.

![image](https://user-images.githubusercontent.com/60828821/198171854-f643a628-25f7-4f5a-ac50-f0914a5e265e.png)

The horizontal time axis labels on a timeline or arrowline graph can be hidden per graph:

```yaml
graphs:
  - type: timeline
    options:
      showTimeLabels: false   # hide the time axis labels on this graph
```

By default the state texts shown in a timeline chart represent the raw underlying state as used by Home Assistant internally. For example, binary sensors will show their state as `on`or `off`, regardless of their device class. If you prefer to see device class dependent states (like `Opened`/`Closed` for doors or `Detected`/`Clear` for motion sensors), you can change the state text display mode as shown in the YAML below:

```yaml
type: custom:history-explorer-card
stateTextMode: raw    # Show the raw untranslated state names
stateTextMode: auto   # Show the automatically translated device class dependent state names. This is the default.
stateTextMode: hide   # Hide all state text labels
```

#### Customizing state colors

The default colors used for the states shown on timeline graphs can be customized in many different ways. Customizing is done by adding the statesColor key to the card YAML. Colors act on individual entities, entire device classes, domains or global states. You can, for example, have distinct colors for the on and off states of your motion sensors and your door sensors, even if they're both binary sensors.

The card accepts all normal HTML color definition strings as well as CSS variables. The latter need to be provided as-is (for example `--primary-color`, without the CSS var function).

The following example will turn the *on* state of all door sensors blue and the *on* state of all motion sensors yellow. The *on* state of other sensor device classes will not be affected. They will inherit their colors from either an entity specific, a device class or domain wide or a global color rule, in that order (see below). You specify the device class followed by a dot and the state you'd like to customize:

```yaml
type: custom:history-explorer-card
stateColors:
  door.on: blue
  motion.on: yellow
```

You can also specify state colors for an entire domain. The following example will turn the *off* state for all binary sensors that don't have a color defined for their device class purple and the *home* state of the person domain green:

```yaml
type: custom:history-explorer-card
stateColors:
  binary_sensor.off: purple
  person.home: 'rgb(0,255,0)'
```

Finally, you can color a specific state globally through all device classes and domains. This can be used as a generic fallback. The following example colors the *off* state of all sensors red, as long as they don't have a specific rule for their device class or domain:

```yaml
type: custom:history-explorer-card
stateColors:
  off: '#ff0000'
```

Customizable states aren't limited to `on` or `off` values. Any raw state value may be used, such as values assigned by template or MQTT sensors. For example:
```yaml
type: custom:history-explorer-card
stateColors:
  sensor.Dry: tan
  sensor.Wet: green
```

A general default color can be set per domain, device class or entity. If present, it will serve as a fallback to all states in that domain, device class or entity that were not explicitely defined. In the following example, the states of the input_text.air_quality entity are defined. The *bad* state will be red, the *good* state will be green. All other states of that entity, regardless of what they are, will be yellow due to the catch-all key.
```yaml
type: custom:history-explorer-card
stateColors:
  input_text.air_quality.bad: red
  input_text.air_quality.good: green
  input_text.air_quality: yellow        # Fallback, catches all states from this entity that are not 'good' or 'bad'
```

There is a special virtual state that is added to all entities, the *multiple* state. This state substitutes an aggregation of multiple states on the timeline when they were merged due to data decimation. Like normal states, you can specify the color for this special state for individual entities, device classes, domains or globally.

The random colors assigned to states not covered by `stateColors` are generated from a fixed seed. You can change this seed to get a different set of automatic colors:

```yaml
type: custom:history-explorer-card
stateColorSeed: 42   # Any integer. Default is 137.
```

### Compass arrow graphs

Entities representing a directional angle value, like a bearing or direction, can be displayed using a timeline of compass arrows. This is especially useful for visualizing wind directions:

![image](https://user-images.githubusercontent.com/60828821/163562690-01002243-b6d3-4a55-8128-9d1dc89581c6.png)

Compass arrow graphs use the `arrowline` type and can be used in both dynamically and statically added entities. See the *Customizing dynamically added graphs* section for an example of the former and the advanced YAML example for the latter.

---

## Y axis scaling

By default the min/max scales for the Y axis are adjusted automatically to the data you are currently viewing.

Pressing the axis lock icon will temporarily disable autoscaling and lock the Y axis to the currently active range. Pressing it again will revert back to the defaults for the graph:

![image](https://user-images.githubusercontent.com/60828821/221268643-735e4b1a-81da-4709-aff8-913b9b8f95a8.png)

The Y axis can also be interactively modified. Pressing and holding the `SHIFT` key will unlock interactive zooming and panning of the graph in vertical direction. Pressing your mouse button while holding `SHIFT` over a graph will allow you to drag the graph into both horizontal and vertical directions. Using the mousewheel while holding `SHIFT` will change the Y axis scale. When interacting with the Y axis, the axis lock icon will automatically be enabled. Click the icon to go back to the default scale at any time.

**On desktop**, you can also drag directly on the Y axis label area (the left 65px of the graph) to pan the Y scale — the cursor changes to `↕` when hovering over that zone.

**On mobile**, the same Y axis drag zone is available as a touch target. You can also use a two-finger vertical pinch on the graph to zoom the Y axis in or out.

You can override the automatic y axis range with your own values for both fixed graphs defined in the YAML, as well as for dynamically added entities or device classes. The minimum and maximum Y values, as well as the tick step size can be manually overridden. Each setting works independently. You can, for example override the step size only, but leave the range on automatic.

```yaml
graphs:
  - type: line
    options:
      ymin: 0       # Initial Y minimum (also restored when padlock is unlocked)
      ymax: 40      # Initial Y maximum (also restored when padlock is unlocked)
      ystepSize: 5  # Step size is fixed at 5
      ylock: true   # Disable all interactive Y axis modifications (pan and zoom)
```

`ymin` and `ymax` set the initial Y axis range and the range restored when the padlock is unlocked. They do not prevent the user from modifying the axis interactively. Use `ylock: true` to fully disable interactive Y axis changes.

Setting `ylock: true` disables all interactive Y axis modifications for that graph — including Y axis drag, two-finger pinch zoom and SHIFT-drag — on all platforms (desktop, mobile, tablet, stylus). The axis lock icon is not affected. This is useful for graphs where the Y range is meaningful and should not be accidentally altered by the user.

See the customizing dynamic line graphs section and the advanced YAML example below for more examples.

---

## Line interpolation modes

Three modes are available for line charts: cubic splines, line segments and stepped. Cubic splines (`curves`), the default, use monotone Steffen interpolation with a tension of 0.1 — smooth and natural-looking, appropriate for signals already filtered, and guaranteed never to overshoot horizontally on steep fronts. Line segments (`lines`) connect data points with perfectly straight segments using zero-tension monotone interpolation — the most faithful representation of the raw data. Stepped mode (`stepped`) displays the raw quantized data as a staircase.

All modes use `borderJoinStyle: round` for constant stroke width at corners and rounded ends.

![image](https://user-images.githubusercontent.com/60828821/148483356-aea06848-13d9-4e1e-bd06-485b44505d48.png)

You can specify the line mode in the YAML global settings. Possible options are `curves` (or `curve`), `lines` (or `line`) or `stepped` (or `step`). The default if the option is not present is `curves`.

```yaml
type: custom:history-explorer-card
lineMode: lines
```

The default line width for all line graphs can be set globally. The default is 2 pixels:

```yaml
type: custom:history-explorer-card
lineWidth: 2
```

The line mode can also be set for fixed entities defined in the YAML and for dynamic entities or device classes (see the `entityOptions` section below).

A small margin will be added to the top and bottom of line charts, so to give some headroom and make it visually nicer. You can turn off these margins if you don't want the additional space:

```yaml
type: custom:history-explorer-card
axisAddMarginMin: false
axisAddMarginMax: false
```

### Line stroke style

The stroke style of a line can be customized per entity using the `dashMode` option. It is available in `entityOptions` and in the per-entity YAML under `graphs`.

```yaml
entities:
  - entity: sensor.temperature
    dashMode: shortlines     # Named mode
  - entity: sensor.humidity
    dashMode: [10, 4, 2, 4]  # Custom pattern
```

Named modes:

| Value | Description |
|---|---|
| *(absent)* | Solid line (default) |
| `points` | Fine dots |
| `shortlines` | Short dashes |
| `longlines` | Long dashes |
| `pointline` | Long dash — dot alternation |

Custom pattern: an array of pixel lengths `[on, off, on, off, ...]` following the Canvas `setLineDash` convention, repeated cyclically. For example `[10, 4]` draws 10 px dashes with 4 px gaps, and `[15, 3, 3, 3]` alternates a long dash and a short dot.

### Displaying individual samples

Holding the `Alt` key (or `Option` key on Mac) while hovering over a graph will reveal all the individual samples making up the line chart:

![image](https://user-images.githubusercontent.com/60828821/221272054-abb884df-b95f-4c88-83f0-921ac8709a93.png)

If you would like to permanently show individual samples for certain graphs, this can be configured at the graph level using `showSamples`, or per entity using `showPoints`. Both options accept a boolean or a numeric radius in pixels:

```yaml
type: custom:history-explorer-card
entityOptions:
  humidity:
    showSamples: true    # always show sample dots for humidity graphs (radius 4px)
    showSamples: 6       # or specify the dot radius in pixels
graphs:
  - type: line
    options:
      showSamples: true  # show samples for this entire manually defined graph
    entities:
      - entity: sensor.outside_temperature
        showPoints: true  # show dots on this entity only (radius 4px)
        showPoints: 3     # or specify a custom radius in pixels
```

The `showPoints` option is also available in `entityOptions` (see below), making it easy to apply uniformly across entity families.

### Line graphs and unavailable data

If your history data contains an unavailable state, for example if a sensor went offline for a while, then the card will interpolate over the missing data in line charts to avoid gaps by default. If you prefer to keep the unavailable state visible, so to easily see when and how often your sensors disconnected or became unavailable, then you can disable the interpolation using the YAML below. Timeline charts will always show unavailable or unknown states, regardless of how this parameter is set.

```yaml
type: custom:history-explorer-card
showUnavailable: true
```

### Custom data processing functions

The card supports user defined Javascript expressions modifying the data right before display through the `process` option. This can be used to filter or shape data, apply non-linear scaling or transform data from one graph type to another. The supplied JS expression is provided with the original input `state` value (can be a string or a number, depending on the graph and data source). The expression must evaluate to the desired new state. Complex custom processing functions can degrade rendering performance. 

Custom processing functions works for dyanmically added entities, manually defined YAML graphs and graphs in the more info panel.

Example showing a humidity numerical entity as a timeline graph, where humidity below 30% appears as state `dry`, above 70% as `wet` and everything inbetween as `normal`:
```yaml
type: custom:history-explorer-card
graphs:
  - type: timeline
    entities:
      - entity: sensor.room_humidity
        process: '( state < 30 ) ? "dry" : ( state > 70 ) ? "wet" : "normal"'
```

Example of a spike rejection filter for dynamic temperature entities, removing invalid  positive or negative temperature spikes, marking them invalid and letting the graph interpolate over them:
```yaml
type: custom:history-explorer-card
entityOptions:
  temperature:  
    process: '( Math.abs(state) < 100 ) ? state : "unavailable"'
```

---

## Long term statistics

When this setting is enabled, the card will try to pull in long term statistics for an entity once the limit of the history data is reached. The integration of both history sources is entirely seamless. You keep scrolling and zooming in or out of your data, as usual. The statistics and history data will be combined on the fly at all time ranges. This only works for entities that have long term statistics available. Graphs for all other entities will just become blank as soon as the history data limit is reached.

![image](https://user-images.githubusercontent.com/60828821/203880897-6f634e95-cb5d-484c-a9c0-d97b58321557.png)

In the screenshot above, the blue graph is the outdoor temperature, the red graph is the temperature of a barn. The outdoor temperature has statistics available, the barn temperature does not. So you see the red line stopping where the history database retention period ends (Oct 11th). The outdoor temperature continues way past this point, as the card will turn to long term statistics. Note that the card will always prefer history data over long term statistics data if available, because it's more precise.

Long term statistics support is enabled by default and is configured to use average values and hourly intervals. You can optionally configure the feature (or turn it off) or even force the use of statistics only, effectively turning off the use of the short term history state DB, by adding the following to the card YAML:

```yaml
type: custom:history-explorer-card
statistics:
  enabled: true    # true is the default, use false to turn LTS support off.
  mode: mean
  period: hour     # reporting period. hour, day or month. Default is hour.
  force: false     # set to true if you want to use long term statistics only
  retention: 90    # optional: override the history retention period in days used to decide when to switch to LTS
```

The (optional) mode parameter controls how the statistics data is processed before being integrated into the history stream. `mean` = use the average value, `min` = minimum value, `max` = max value. The default if the option is not present is mean. This setting does not apply to total_increasing values like energy sensors, which are calculated differently.

### Showing the min/max statistical range

The `showMinMax` option draws a shaded band between the min and max values available for an entity, using the entity's line color at low opacity — similar to the confidence band shown in the standard HA history panel. The mean or raw curve is always drawn on top of the band.

Three modes are available:

| Value | Band source | Description |
|---|---|---|
| `false` / absent | — | No band drawn (default) |
| `true` / `statistics` | Long term statistics only | Band visible only on the portion of the graph fed by LTS (hourly/daily/monthly min and max). No band on the short term history portion. |
| `history` / `states` | Statistics + history | Band visible on the full graph. On the statistics portion the LTS min/max is used. On the short term history portion, an additional statistics query is made in parallel to retrieve the corresponding hourly min/max, which is overlaid as a background band even while raw data points are shown in the foreground. |

The `history` / `states` mode is more informative but requires an extra statistics API call for the visible time window, even when short term history data is available.

```yaml
type: custom:history-explorer-card
graphs:
  - type: line
    entities:
      - entity: sensor.outside_temperature
        color: '#3e95cd'
        showMinMax: statistics   # band on LTS portion only
      - entity: sensor.outside_pressure
        color: '#3ecd95'
        showMinMax: history      # band on full graph, including history portion
```

`showMinMax` is also available in `entityOptions`:

```yaml
type: custom:history-explorer-card
entityOptions:
  - match: "temperature"
    showMinMax: statistics   # LTS band for all temperature sensors
  - match: "sensor.*_power"
    showMinMax: history      # full band for all power sensors
    lineMode: lines
```

---

## Default view and time ranges

When the dashboard is opened, the card will show the last 24 hours by default. You can select a different default time range in the YAML. Use m, h, d, and w to denote minutes, hours, days and weeks respectively. For longer time scale, o and y denote months and year. Currently the maximum range is one year. If no postfix is given, hours are assumed.

`defaultTimeRange` uses "last one to speak wins" logic: changing the YAML value overrides the user-adjusted time range only when the YAML value actually changes. The user-adjusted time range is otherwise preserved across reloads and devices via HA user storage.

```yaml
type: custom:history-explorer-card
defaultTimeRange: 4h     # show the last 4 hours when opening the card
defaultTimeRange: 2d     # or 2 days...
defaultTimeRange: 15m    # or 15 minutes...
defaultTimeRange: 3w     # or 3 weeks
defaultTimeRange: 6o     # or 6 months
defaultTimeRange: 1y     # or 1 year
```

By default the card will open the graphs with the current date and time aligned to the right of the chart. You can define a custom time offset using the `defaultTimeOffset` setting which will be applied when you open the card or click the date button. Both relative time offsets (denoted by lower case time identifiers such as `h,d,w,o,y`) and offsets snapped to the current hour, day, month or year are supported. The latter will use upper case time identifiers `H,D,O,Y`. For example:

```yaml
type: custom:history-explorer-card
defaultTimeOffset: 1h       # Add 1 hour of empty space after the current time
defaultTimeOffset: -1d      # Show the previous days' data
defaultTimeOffset: 1D       # Show the current day from midnight to midnight
defaultTimeOffset: 1O       # Show the entire current month, starting at the 1st
```

### Disabling cross-device sync (`disable_persistence`)

Time range, and entities added or changed through the UI, are normally synchronized across all your devices via your Home Assistant user account (see [per-user server-side persistence](#new--per-user-server-side-persistence-v1112)). If you run several dashboard views with distinct default ranges configured in YAML (a 24h view, a 30-day view, a 1-year view...), this sync can work against you: zooming in on one view on one device gets remembered and reapplied on every device, overriding the YAML default intended for that view.

`disable_persistence` stops a device from adopting changes synced from another device. YAML changes, and this device's own local changes (kept in browser storage), keep working exactly as before — this option only blocks the cross-device (HA user account) restore.

At the card level, it accepts `range`, `entities`, or `all` (both):

```yaml
type: custom:history-explorer-card
defaultTimeRange: 24h
disable_persistence: range   # this device always keeps its own time range,
                              # ignoring range changes made on other devices
```

- `range` — the time range shown on this device is never overridden by another device's range; only a YAML change to `defaultTimeRange`, or your own local adjustment on this device, can change it.
- `entities` — entities added, recolored, regrouped, etc. on another device are never adopted on this device; only YAML and this device's own changes apply.
- `all` — both of the above.

Entities defined in `graphs:` can also set their own `disable_persistence`, either as a shorthand (`entities` or `all`, protecting the whole entity) or as a precise list of fields to protect, falling back to the card-level setting above when unset — see [YAML configuration for preconfigured graphs](#yaml-configuration-for-preconfigured-graphs) for the entity-level syntax.

### Auto refresh

By default the card will not refresh on its own when sensor values change. It can be manually refreshed by reloading the page. If you would like your card to automatically reflect changing values on the fly, two strategies can be enabled. Both can be combined if needed. 

Automatic refresh will monitor the entities that are displayed in your graphs for changes and refresh the graphs as needed. This strategy will usually cover the most common use cases and is recommended if you have just a few entities display in your history explorer card and if these entities don't change too often.
```yaml
type: custom:history-explorer-card
refresh:
  automatic: true
```

If you have many fast changing entities displayed in your graphs, then auto refresh can strain your database bandwidth due to the constant requests. In this case it is better to use a regular update interval, independent of the sensor changes. The following example will refresh the card at a fixed rate, every 30 seconds. You will need to reload the page after changing the refresh interval.
```yaml
type: custom:history-explorer-card
refresh:
  interval: 30
```

### Showing current sensor values

The current sensor values are shown next to their label names in line or bar graphs by default. They can be disabled:
```yaml
type: custom:history-explorer-card
showCurrentValues: false
```

![image](https://user-images.githubusercontent.com/60828821/212548277-002254da-4159-435b-9ae7-913a00948dbd.png)

### Rounding

The rounding precision used for displaying data point values on the tooltip in line charts can be defined globally through the `rounding` key followed by the amount of fractional digits. The default is 2 digits.

```yaml
type: custom:history-explorer-card
rounding: 4
```

### Data decimation

The card will automatically reduce the data shown in the charts and remove details that would not be visible or useful at a given time range. For example, if you view a per-hour history, nothing will be removed and you will be able to explore the raw data, point by point. If you view an entire week at once, there's no need to show data that changed every few seconds, you couldn't even see it. The card will simplify the curves and make the experience a lot faster that way. 

This feature can be turned off in the options if you want, either globally or by entity. Two different decimation algorithms are available. By default, a fast approximate one is used, offering highest rendering performance and a relatively good approximation of the graph shape at lower zoom levels. Optionally, an accurate decimation mode can be enabled. It offers accurate representation of local minima and maxima, at all zoom ranges. But rendering will be slower. Decimation mode can be selected globally at the card level, or per entity via `entityOptions`.

```yaml
type: custom:history-explorer-card
decimation: false       # Disable decimation, the raw sensor data will be used at all scales (very slow).
decimation: fast        # Fast approximate decimation, good balance between speed and accuracy. The default.
decimation: accurate    # Accurate minmax preserving at all scales.
```

![image](https://user-images.githubusercontent.com/60828821/203882385-461d3376-58e1-4344-861f-852c150bd01a.png)

Decimation works on state timelines by merging very small state changes into 'multiple' sections when they can't be seen individually anymore. Zoom into the timeline and the details will appear. The color used for the multiple sections can be adjusted per graph.

![history-panel-timeline-multiple](https://github.com/alexarch21/history-explorer-card/raw/main/images/screenshots/history-panel-timeline-multiple.png)

Per-entity decimation example:

```yaml
type: custom:history-explorer-card
entityOptions:
  sensor.fast_sensor:
    decimation: false    # always show raw data for this entity
  temperature:
    decimation: accurate # minmax preserving for all temperature sensors
```

---

## Customizing dynamically added graphs

When you add a new line graph using the add entity dropdown, the graph will use the default settings and an automatically picked color. You can override these settings either for specific entities, for device classes or for entire domains. For example, you could set a fixed Y axis range for all your humidity sensors or a specific color or line interpolation mode for your power graphs.

```yaml
type: custom:history-explorer-card
entityOptions:
  humidity:                 # Apply these settings to all humidity sensors
    color: blue
    fill: rgba(0,0,255,0.2)
    ymin: 20
    ymax: 100
    lineMode: lines
  sensor.outside_pressure:  # Apply these settings specifically to this entity if added
    color: green
    fill: rgba(0,255,0,0.2)
    ymin: 900
    ymax: 1100
    width: 2
  sensor:                   # Apply these settings to all other entities in the sensor domain
    color: red
    fill: rgba(0,0,0,0)
```

You can also change the graph type for certain entities, device classes or domains. For example, you could display a numeric entity, which would normally be shown as a linegraph, with a timeline. Or you could default to the directional arrow graph mode for your wind direction sensors:

```yaml
type: custom:history-explorer-card
entityOptions:
  sensor.wind_bearing:      # This sensor should be shown as compass arrows instead of a line graph
    type: arrowline
    color: black            # Optional color for the arrows, remove for auto selection based on the theme
    fill: rgba(0,0,0,0.2)   # Optional background color for the arrows
```

### Complete list of entityOptions properties

All of the following properties can be used under `entityOptions` (keyed by entity id, device class or domain), and directly on entities in manually defined `graphs`.

| Property | Type | Description |
|---|---|---|
| `type` | string | Graph type: `line`, `bar`, `timeline`, `arrowline` |
| `color` | string or object | Line/bar color (HTML color, CSS variable, or color range object for bars) |
| `fill` | string | Fill color under the line |
| `width` | number | Line width in pixels |
| `lineMode` | string | Interpolation mode: `curves`, `lines`, `stepped` |
| `dashMode` | string or array | Stroke style: `points`, `shortlines`, `longlines`, `pointline`, or custom `[on, off, ...]` array |
| `showPoints` | boolean or number | Show a dot at each measurement point. `true` = radius 4px, or specify a numeric radius |
| `scale` | number | Multiply all values by this factor before display |
| `hidden` | boolean | Hide this entity by default in the legend |
| `ymin` | number | Set the initial Y axis minimum (can still be modified interactively; restored when padlock is unlocked) |
| `ymax` | number | Set the initial Y axis maximum (can still be modified interactively; restored when padlock is unlocked) |
| `ystepSize` | number | Fix the Y axis tick step size |
| `ylock` | boolean | Disable all interactive Y axis pan and zoom for this graph |
| `height` | number | Graph height in pixels (overrides global height settings) |
| `decimation` | string or false | Per-entity decimation mode: `fast`, `accurate`, or `false` to disable |
| `interval` | string | Default bar interval: `10m`, `hourly`, `daily`, `monthly` |
| `netBars` | boolean | Enable net metering mode for bar graphs |
| `stacked` | boolean | Stack bars on top of each other rather than side by side (bar graphs with multiple entities) |
| `process` | string | Javascript expression to transform state values before display |
| `showMinMax` | string or boolean | Display a shaded band between min and max values. See the *Showing the min/max statistical range* section for accepted values. |
| `showSamples` | boolean or number | Show sample dots for this graph (graph-level option). `true` = radius 4px, or numeric radius |
| `showTimeLabels` | boolean | Show or hide the horizontal time axis labels on a timeline or arrowline graph. Default is `true`. |

### Pattern-based entity options

`entityOptions` accepts two forms: the original **dict form** (keyed by entity id, device class or domain) and a new **list form** that supports glob pattern matching. The list form is the recommended approach when you want to apply consistent styling across families of sensors.

```yaml
type: custom:history-explorer-card
entityOptions:
  - match: "sensor.temperature*"
    lineMode: curves
    showPoints: true
    color: '#3e95cd'

  - match: "sensor.*_power"
    lineMode: lines
    dashMode: [10, 4]
    width: 2

  - match: "sensor.*_energy*"
    type: bar
    decimation: accurate

  - match: ["sensor.pressure*", "sensor.humidity*"]
    lineMode: lines
    ymin: 0

  - entity: sensor.sun_azimuth
    type: arrowline
    color: red
```

The `match` field accepts a single glob pattern string or a list of patterns. `*` matches any sequence of characters, `?` matches a single character. Patterns are tested against the full entity id (e.g. `sensor.outside_temperature`). The `entity` field can be used instead of `match` for exact entity id matches.

#### Priority rules

When multiple sources provide options for the same entity, they are applied in this order (highest priority first):

1. `entityOptions` list — first matching entry wins per property; subsequent matching entries fill in any remaining unset properties
2. `entityOptions` dict — keyed by exact entity id, then device class, then domain

Options from a higher-priority source always override those from a lower-priority source.

---

## Configuring the UI

### Header text

The default *History Explorer* header can be changed or removed using the header setting in the YAML:
```yaml
type: custom:history-explorer-card
header: 'My sample history'
header: ' '   # Using a single space will remove the header and leave some padding space
header: hide  # The hide option will remove the header entirely
```

### Dark mode

The card will try to adapt its UI colors to the currently active theme. But for best results, it will have to know if you're running a dark or a light theme. By default the card asks HA for this information. If you're using the default Lovelace theme, or another modern theme that properly sets the dark mode flag, then you should be all with the default settings. If you are using an older theme that uses the legacy format and doesn't properly set the dark mode flag, the card may end up in the wrong mode. You can override the mode by adding this YAML to the global card settings (see below) to force either dark or light mode:

```yaml
type: custom:history-explorer-card
uimode: dark
```
Replace dark with light to force light mode instead.

### Customizing the color of UI elements

The color for various elements of the UI can be customized further:

```yaml
type: custom:history-explorer-card
uiColors:
  gridlines: '#ff000040'
  labels: green
  buttons: '#80f00050'
  selector: 'rgba(255,255,255,255)'
  closeButton: '#0000001f'
  cursorline: '#ff000080'   # Color of the vertical cursor line on line and bar graphs
```

### Changing the UI layout

The position of the time control toolbar and the entity selector can be customized through YAML settings:

```yaml
type: custom:history-explorer-card
uiLayout:
  toolbar: top
  selector: bottom
```
Possible options are `top`, `bottom`, `both` and `hide`. When selecting `both`, the UI element will be duplicated and shown both on top and on the bottom. This is useful on large histories that require a lot of vertical scrolling. When `hide` is selected, the respective UI element is not shown. You can also hide the interval selector for total increasing entities with `interval: hide`.

Toolbars can be made sticky, always floating on top or below the graphs. This can be handy to keep the toolbar controls in reach while scrolling through a long list of graphs. Use the following YAML to make the `top`, `bottom` or `both` sticky. On mobile it is not recommended to make the lower toolbar sticky if it contains an entity selector, as the entity dropdown list may be hard to reach.

```yaml
type: custom:history-explorer-card
uiLayout:
  sticky: top   # Make the top toolbar controls sticky, so they always stay on top.
```

If you prefer the `+` and `-` zoom icons in the time range control to work the other way round, you can invert them using the following YAML:

```yaml
type: custom:history-explorer-card
uiLayout:
  invertZoom: true
```

The width of the label area to the left of the graphs can be customized and the labels optionally hidden with the following YAML:

```yaml
type: custom:history-explorer-card
labelsVisible: false   # this will hide the unit of measure labels and the entity names left of the graphs or timelines
labelAreaWidth: 10     # the width of the label area in pixels, default is 65
```

The height of graphs can be set with these options:
```yaml
type: custom:history-explorer-card
lineGraphHeight: 100     # default line graph height is 250
barGraphHeight: 100      # default bar graph height is 150
timelineBarHeight: 18    # timeline bar height (default is 24)
timelineBarSpacing: 30   # spacing from the top of one timeline bar to the next (default is 40)
```

Alternatively you can set a custom height for individual line or bar graphs, both dynamic ones and manually defined ones. Per-graph height will override global height options:
```yaml
type: custom:history-explorer-card
entityOptions:
  humidity:
    height: 150        # set the height of all humidity graphs to 150
graphs:
  - type: line
    options:
      height: 200      # explicitly set the height of this manually defined graph
    entities:
      - entity: sensor.outside_temperature
```

### Configuring the tooltip popup

The tooltip popups used in timelines and arrowlines support three different sizes: full, compact and slim. By default, the size is selected automatically depending on the available space around the graph. The size can be overidden manually:

```yaml
type: custom:history-explorer-card
tooltip:
  size: slim       # Supported sizes are full, compact, slim. Use auto for automatic size (this is the default).
```

The state color boxes in the tooltips can optionally be hidden for line graphs or timelines (or both):

```yaml
tooltip:
  showColorsLine: false       # hide the color boxes in the tooltip popups for line graphs
  showColorsTimeline: false   # hide the color boxes in the tooltip popups for timeline graphs
```

The tooltips can optionally show the duration of the selected state next to the start and end times:
```yaml
tooltip:
  showDuration: true
```

![image](https://user-images.githubusercontent.com/60828821/186550469-bec9bad3-c76e-4f9f-a1d7-a0b76ec2f51c.png)

You can hide the entity name label on tooltips for line and bar charts to make it even more compact:
```yaml
tooltip:
  showLabel: false
```

The way state names are shown on the tooltip (raw or translated / device class dependent) will normally follow the mode set by `stateTextMode` for timeline charts on the card level. If you want the tooltips to use another mode, then it can be overridden. For example:

```yaml
tooltip:
  stateTextMode: raw      # Show raw state names in the tooltip even if timelines show translated states
```

### Changing the horizontal time tick density

By default, time tick density is automatic and adjusts to the width of your screen. That's always a compromise between looking good (no clipping), being readable at all screensizes from mobile to wall sized 8k TV and subjective preferences over tick densities. In most cases, the default automatic selection will yield good results. But if needed, the density can be customized using the `timeTicks` setting.

```yaml
timeTicks:

  # Optional base density used for automatic density calculations. Default is 'high'.
  density: 'high'             # Options are: low, medium, high, higher, highest.

  # If present, this will skip the auto-density and force the use of your selected density.
  densityOverride: 'highest'  # Options are: low, medium, high, higher, highest.

  # optional, this can be used to shorten the date representation on the time ticks, to make more space if you want high tick densities.
  dateFormat: 'short'         # Options are normal and short. Default is normal.
```

Example with no `timeTicks` and everything set to automatic defaults:

![image](https://github.com/alexarch21/history-explorer-card/assets/60828821/01b7578f-92fd-4685-bc53-d4daaa3e9b91)

Using `densityOverride` at `higher`, leaving the date format at normal:

![image](https://github.com/alexarch21/history-explorer-card/assets/60828821/5a68ec53-ed86-467f-a3b8-71b15c9d8c2b)

And same as above but settings the dateFormat to short:

![image](https://github.com/alexarch21/history-explorer-card/assets/60828821/3d85757a-c87d-46aa-9915-fa4df7ae62bd)

Overriding the density will disable automatic density calculations depending on card or screen width. So you can easily end up in situations where the labels will overlap.

---

## Multiple cards

You can have multiple history explorer cards on the same view or over several views and dashboards. Each card has its own configuration. For the cards to be able to manage their respective configurations, each card needs its own unique name. When adding the card over the UI, a random name is assigned by default. You can adjust the name if needed. If you add the card manually over YAML, you will have to provide your own unique name for each card. 

If you only use a single history explorer card on your Lovelace, then the name is optional.

```yaml
type: custom:history-explorer-card
cardName: history-card-5
```

---

## Exporting data as CSV

The raw data for the currently displayed entities and time range can be exported as a CSV file by opening the entity options and selecting Export as CSV. Note that CSV exporting does not work in the HA Companion app. Both history and long term statistics can be exported.

![image](https://user-images.githubusercontent.com/60828821/203881276-1332c8bd-d83c-4ff6-9a9b-9b43cb4a6c44.png)

The exported CSV can be customized. The following settings are optional. If they are not present, the defaults will be used.
```yaml
type: custom:history-explorer-card
csv:
  separator: ';'            # Use a semicolon as a separator, the default is a comma
  timeFormat: 'DD/MM/YYYY'  # Customize the date/time format used in the CSV. The default is 'YYYY-MM-DD HH:mm:ss'.
  statisticsPeriod: hour    # Period used for statistics export. Hour, day or month is supported. Default is hour.
  exportAttributes: true    # Export all entity attributes along with their state, in separate columns. Default if off (no attrbutes).
  numberLocale: 'en-US'     # Format numbers using the given locale. If this settings is not defined, the raw DB values will be written (no formatting).
```

---

## YAML configuration for preconfigured graphs

YAML configuration is optional. And while the interactive configuration is preferrable, it can sometimes be useful to keep a set of predefined entities.

Here's a basic example configuration:

```yaml
type: custom:history-explorer-card
graphs:
  - type: line
    entities:
      - entity: sensor.outside_temperature
        color: '#3e95cd'
        fill: rgba(151,187,205,0.15)
      - entity: sensor.annexe_temperature
        color: '#ee3452'
        fill: rgba(0,0,0,0)
  - type: line
    entities:
      - entity: sensor.outside_pressure
        color: '#3ecd95'
        fill: rgba(151,205,187,0.15)
  - type: timeline
    title: Non-numerical sensors
    entities:
      - entity: binary_sensor.pir_yard
        name: Yard PIR
      - entity: binary_sensor.door_barn
        name: Barn door
      - entity: input_select.qubino2_3
        name: Heater
      - entity: person.alex

```

Use wildcards to automatically add multiple entities. The following snippet will add all sensors with `temperature` in their name to a line graph, except for entities with `fridge` in their name and the `cpu_temperature` sensor:

```yaml
type: custom:history-explorer-card
graphs:
  - type: line
    entities:
      - entity: sensor.*temperature*
        exclude:
          - entity: '*fridge*'
          - entity: sensor.cpu_temperature
        fill: rgba(0,0,0,0)
```

And a more advanced example:

```yaml
type: custom:history-explorer-card
cardName: advanced-history
uimode: dark
stateColors:
  person.home: blue
  person.not_home: yellow
decimation: false
header: 'My sample history'
entityOptions:
  - match: "sensor.*_power"
    lineMode: lines
    dashMode: [10, 4]
    width: 2
    showPoints: true
  - match: "sensor.temperature*"
    lineMode: curves
    color: '#3e95cd'
    showMinMax: statistics
graphs:
  - type: line
    options:
      ymin: -10
      ymax: 30
      showTimeLabels: true   # false will hide the time ticks on this graph
    entities:
      - entity: sensor.outside_temperature
        color: '#3e95cd'
        fill: rgba(151,187,205,0.15)
        width: 4
        lineMode: stepped
      - entity: sensor.annexe_temperature
        color: '#ee3452'
        fill: rgba(0,0,0,0)
        lineMode: lines
        hidden: true         # This entity is hidden by default !
  - type: line
    entities:
      - entity: sensor.outside_pressure
        color: --my-special-green
        fill: rgba(151,205,187,0.15)
  - type: timeline
    title: Non-numerical sensors
    entities:
      - entity: binary_sensor.pir_yard
        name: Yard PIR
      - entity: binary_sensor.door_barn
        name: Barn door
      - entity: input_select.qubino2_3
        name: Heater
  - type: arrowline
    title: Wind bearing
    entities:
      - entity: sensor.wind_bearing
        color: black
        fill: rgba(0,0,0,0.2)
```

Replace the entities and structure as needed.

### Protecting specific entities from cross-device sync

Any entity inside `graphs:` can declare its own `disable_persistence`, protecting it individually from changes synced from another device on your Home Assistant account (see [Disabling cross-device sync](#disabling-cross-device-sync-disable_persistence) for the card-wide version). It accepts either `entities` / `all` — protecting the entity entirely, exactly like the card-level setting — or a list of specific fields to protect, leaving every other field free to keep syncing normally:

```yaml
graphs:
  - type: line
    entities:
      - entity: sensor.living_room_target_temp
        color: '#3e95cd'
        disable_persistence: [color, groupId]   # keep this device's color and grouping,
                                                 # let interval/fill/etc. keep syncing
      - entity: sensor.boiler_state
        disable_persistence: all                # freeze this entity entirely on this device
```

Protectable fields: `color`, `fill`, `hidden`, `interval`, `name`, `scale`, `siConversionFactor`, `dashMode`, `lineMode`, `width`, `showPoints`, `showMinMax`, `unit`, `process`, `netBars`, `decimation`, `groupId`. An entity without its own `disable_persistence` falls back to the card-level setting, if any.

---

## Running as a panel in the sidebar

The history explorer can be run as a sidebar panel. Add a new empty dashboard with the `Show in sidebar` box checked. Set the view type to `Panel (1 card)` and add the history explorer card to the view.

![image](https://user-images.githubusercontent.com/60828821/161340801-f1f97e90-73c4-44d9-8afa-ba858906a2c1.png)
