[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/v/release/Cook23/history-explorer-card?style=for-the-badge)](https://github.com/Cook23/history-explorer-card/releases)
[![GitHub stars](https://img.shields.io/github/stars/Cook23/history-explorer-card?style=for-the-badge)](https://github.com/Cook23/history-explorer-card/stargazers)
![Experimental](https://img.shields.io/badge/status-experimental-yellow?style=for-the-badge)

<a href="https://buymeacoffee.com/thierry_couquillou" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50"></a>

# History explorer card

> **A custom history card for Home Assistant — fork of [SpangleLabs/history-explorer-card](https://github.com/SpangleLabs/history-explorer-card).**
> For the complete reference documentation, see [README_Full.md](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md).
> New to this fork? See what it adds over the original card: [FORK_DESCRIPTION.md](https://github.com/Cook23/history-explorer-card/blob/main/FORK_DESCRIPTION.md) 🇬🇧 / [FORK_DESCRIPTION_FR.md](https://github.com/Cook23/history-explorer-card/blob/main/FORK_DESCRIPTION_FR.md) 🇫🇷

A highly interactive history card for Home Assistant. Pan, zoom, and explore your entity history across any time range, with full support for line charts, bar charts, timelines and compass arrow graphs.

![history-panel-sample](https://user-images.githubusercontent.com/60828821/147441073-5fbdeb2e-281a-4312-84f1-1ce5c835fc3d.png)

---

## v1.2.0 beta

> [!NOTE]
> **[v1.2.0](https://github.com/Cook23/history-explorer-card/releases/tag/v1.2.0) is available as a beta**, alongside the 1.1 line, which remains the recommended version.

**For the user**, v1.2.0 has the same features as v1.1.47, with one change on touch screens:
- a swipe on a graph always scrolls the page, wherever it starts — no more conflicts between scrolling the page and dragging labels;
- to drag a label, a graph or the Y axis, tap it first, then press it again and drag;
- a pinch also zooms the time.

**In the code**, everything that handles the graphs and the interaction with them (gestures, touch zones, drag feedback, Y axis lock) is now separated from the card's own processing (entities, groups, time range, Home Assistant data, saving), through a documented contract. The entities are kept by a single module, the code is split by role, and automated tests cover every gesture with a mouse and with fingers, history and statistics, CSV export, refresh, the entity selector, the info panel, the type menu and arrowlines.

**To try it**, enable *Show beta versions* for this repository in HACS, then download 1.2.0; to go back, download 1.1.47 the same way. So far, v1.2.0 has only been tested in a simulated environment: feedback from real devices — phones, tablets, iOS especially — is welcome in the [discussions](https://github.com/Cook23/history-explorer-card/discussions) or in an [issue](https://github.com/Cook23/history-explorer-card/issues), with the device and browser used.

Both lines, 1.1.x and 1.2.x, are maintained side by side for now.

**Developed with Claude Code.** Since v1.1.43, this card is modified, reviewed and tested with Claude Code (Opus 5.5), which also runs the automated tests in a real browser against a simulated Home Assistant, with mouse and touch input. Testing v1.2 this way found a few bugs that were also in 1.1; they were fixed in v1.1.47.

---

## Version highlights

A quick look at the milestones — see [CHANGELOG.md](https://github.com/Cook23/history-explorer-card/blob/main/CHANGELOG.md) for the complete, version-by-version detail.

- **v1.1.49** — Curve reconstruction: choose how *Line curves* and *Line smart* are drawn between values (`interpolation`: monotone, steffen, makima, catmullrom), also from a new *Reconstruction* submenu of the type menu. Every option accepted at every level (card, `entityOptions`, graph, entity) with all its spellings; automatic refresh on by default.
- **v1.1.47** — The type menu lists *Line smart* first, and adding an entity pre-selects the most fitting display: smart line for a measurement, arrowline for an angle, bars for energy or volume that adds up, timeline for a state.
- **v1.1.46** — Angles (wind direction…) drawn without jumps at 0/360: a continuous curve, real values in the tooltip and on the Y axis — automatic for `°` and `measurement_angle`, or set with `circular`.
- **v1.1.45** — Bars and curves on the same graph: curves drawn over the bars, never stacked; *Raw line* only turns the bars into raw curves.
- **v1.1.43** — New `smart` line mode (silences drawn as flat dashed plateaus); YAML graphs show all their entities together whatever the units; linked graphs can be split and merged back (double-click, drag, chain icon); several multi-device sync fixes.
- **v1.1.38** — Graph-level and card-level style defaults, wildcard entities sorted alphabetically, more flexible YAML formats, and malformed config no longer blanks the whole card.
- **v1.1.32** — Persistence options renamed (opt-out to opt-in) — nothing persists by default, except dynamically-added entities.
- **v1.1.31** — Popups and menus no longer get clipped near a viewport edge; smoother.
- **v1.1.30** — Added persistence-control options for time range and entities — renamed in v1.1.32, see above.
- **v1.1.29** — Change any entity's display type on the fly (line, bar, arrowline, timeline) from a simple menu.
- **v1.1.26** — Touch-friendly Y axis panning (long-press to activate) and a new `ylock` option to lock a graph's Y axis range.
- **v1.1.25** — Bar graph interval (10 min / hourly / daily / monthly) is now remembered across reloads.
- **v1.1.23** — New unified entity picker (desktop and mobile) showing friendly names, with wildcard bulk-add.
- **v1.1.19** — Default info panel state and default time range can be set in YAML, and are remembered per user across devices.
- **v1.1.18** — Info panel can be turned on by default; richer default state colors across most Home Assistant domains.
- **v1.1.12** — Your graph layout and preferences now sync across devices through your Home Assistant account.
- **v1.1.10** — Drag & drop to reorder and combine graphs, plus automatic grouping of entities sharing compatible units.
- **v1.1.0** — First release of this fork: pattern-based entity options, min/max band, and sample point display.

---

## Table of contents

- [v1.2.0 beta](#v120-beta)
- [Version highlights](#version-highlights)
- [Install](#install)
- [Basic usage](#basic-usage)
- [Info panel — replacing the HA more info popup](#info-panel--replacing-the-ha-more-info-popup)
- [Adding entities](#adding-entities)
- [Choosing an entity's display type](#choosing-an-entitys-display-type)
- [Interactive graph management](#interactive-graph-management)
- [Y axis control](#y-axis-control)
- [Time range and display defaults](#time-range-and-display-defaults)
- [Auto refresh](#auto-refresh)
- [Line chart appearance](#line-chart-appearance)
- [Bar charts](#bar-charts)
- [Timeline charts](#timeline-charts)
- [Compass arrow graphs](#compass-arrow-graphs)
- [Long term statistics](#long-term-statistics)
- [Entity options](#entity-options)
- [Card, graph, and entity-level options](#card-graph-and-entity-level-options)
- [CSV export](#csv-export)
- [UI configuration](#ui-configuration)
- [YAML graph configuration](#yaml-graph-configuration)
- [Running as a sidebar panel](#running-as-a-sidebar-panel)

---

## Install

### HACS (recommended)

Add this repository as a custom repository in HACS: `https://github.com/Cook23/history-explorer-card`

### Manual install

1. Download `history-explorer-card.js` and copy it into your `config/www` folder
2. In HA, go to Configuration → Dashboards → Resources → Add Resource
3. Enter `/local/history-explorer-card.js` as URL, type: Javascript Module

---

## Basic usage

https://user-images.githubusercontent.com/60828821/147440026-13a5ba52-dc43-4ff7-a944-9c2784e4a2f7.mp4

- **Pan**: click and drag left or right on any graph
- **Zoom**: use the time range selector (top right), mouse wheel + CTRL, or the magnifying glass icon to draw a zoom region
- **Date navigation**: use the `<` `>` buttons top left. Click the date to return to today; double-click to also reset zoom
- **Tooltip**: hover over any graph to see values or state details

---

## Info panel — replacing the HA more info popup

The card can replace the default HA history graph in the more info popup that appears when you click any entity on your dashboard. Once enabled, the history explorer opens instead — with full pan, zoom, Y axis control and long term statistics support.

```yaml
type: custom:history-explorer-card
infoPanel: true
defaultInfoPanel: true   # set default enabled state; user preference is otherwise preserved
```

Once enabled, clicking any entity anywhere on your dashboard opens the history explorer graph instead. Ungrouping, drag & drop and CSV export are not available in the popup.

> For full details → [README_Full.md — Info panel](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md#overriding-the-ha-more-info-history-info-panel)

---

## Adding entities

Entities can be added interactively through the UI selector, or defined statically in YAML. Both can be combined. Dynamically added entities are synchronized with your HA user account and restored across all devices.

![history-panel-otf-entities](https://github.com/alexarch21/history-explorer-card/raw/main/images/screenshots/history-panel-otf-entities.png)

The entity selector shows friendly names and filters on both friendly name and entity ID simultaneously. The entity ID is shown in a tooltip on selection.

**Keyboard navigation:**
- **ArrowUp / ArrowDown** — navigate the dropdown list
- **Enter** — select the highlighted entry; second Enter adds it to the graph
- **Escape** — close the dropdown and clear the input field

Clicking an entry in the dropdown adds it directly — no separate button required.

For a numeric entity, a menu pops up right after selection (click or second Enter) letting you choose how it should be displayed (line, bar, arrowline or timeline) before it's actually added — see [Choosing an entity's display type](#choosing-an-entitys-display-type) below. Non-numeric entities (on/off, text states) are added directly as a timeline, since that's the only representation that makes sense for them.

The entity selector accepts `*` wildcards:
```
person.*        all person domain entities
*door*          all entities containing 'door'
*               all available entities
```

When a wildcard pattern is entered, matching entries are shown in bold in the dropdown. The first Enter selects all matching entities; the second Enter (or clicking an entry) opens the type menu for the whole batch, with an extra "Default" option to apply each entity's own natural type instead of a single chosen type for all of them. Duplicates are detected and listed in a tooltip, with all affected graphs highlighted.

The same `*` wildcards work in YAML `graphs:` (see [YAML graph configuration](#yaml-graph-configuration) below); matches are added in natural alphabetical order.

To show only entities actually recorded in the database:
```yaml
type: custom:history-explorer-card
recordedEntitiesOnly: true
```

To limit the entities shown in the dropdown:
```yaml
filterEntities: 'binary_sensor.*'
# or multiple filters:
filterEntities:
  - '*power*'
  - 'sensor.*energy*'
# entities matching filterEntities can be excluded again with excludeFilterEntities (same syntax):
excludeFilterEntities:
  - 'sensor.energy_cost'
```

`filterEntities` and `excludeFilterEntities` accept a single string, a list of strings, or (for `exclude:` under a YAML entity) the object form `{entity: '...'}` — see [README_Full.md — YAML graph configuration](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md#yaml-configuration-for-preconfigured-graphs) for the per-entity `exclude:` option and examples.

---

## Choosing an entity's display type

Any numeric entity can be shown as a line (straight, curved, stepped or smart), bar, arrowline (bearing) or timeline. A menu for picking this opens whenever it's relevant:

- Right after selecting a new numeric entity in the dropdown (see [Adding entities](#adding-entities))
- On a 700ms long-press of a legend label (line/bar graphs) or a timeline/arrowline label
- When re-selecting an entity that's already added, to change its type

![image](https://user-images.githubusercontent.com/60828821/156686448-919cbd9c-4e77-4efc-a725-e53a7049a092.png)

The currently active type is shown in bold. Use ArrowUp/ArrowDown and Enter to pick with the keyboard, or click directly. Non-numeric entities (on/off, text states) never show this menu — they can only be a timeline, and are added as such automatically.

For a curve shown in *Line smart* or *Line curves*, the menu starts with **Reconstruction ▸**: it opens a submenu to choose how the curve is drawn between its values (see [Curve reconstruction](#curve-reconstruction)), the algorithm in use shown in bold. Click it, or press Enter or → on it; ← or Escape goes back to the type menu.

In the info panel, a "Type" link appears between the date and range selectors for numeric entities, opening the same menu.

---

## Interactive graph management

Changes made interactively on graphs added from the UI are synchronized with your HA user account and survive a page refresh across all your devices. For graphs defined in YAML, they only do if you enable it — see [Time range and display defaults](#time-range-and-display-defaults).

### Line graphs

![image](https://user-images.githubusercontent.com/60828821/156686448-919cbd9c-4e77-4efc-a725-e53a7049a092.png)

Enable automatic grouping of entities with compatible units (including SI prefix variants like W and kW) onto the same graph:
```yaml
type: custom:history-explorer-card
combineSameUnits: true
```

When multiple curves share a graph, the Y axis and tooltips always show each entity's value in its original unit. SI unit conversion also applies to graphs defined in YAML containing mixed units.

- **Single-click** a curve label to show/hide it
- **Double-click** a curve label to extract it into its own graph
- **Long-press** a curve label to open the [display type menu](#choosing-an-entitys-display-type)
- **Drag** a curve label left or right to reorder curves within the same graph
- **Drag** a curve label onto another graph to move it there (compatible units only — any unit within a group of [linked graphs](#linked-graphs))

An incompatible drop shows a brief tooltip explaining the mismatch.

### Linked graphs

A graph defined in YAML always shows all its entities together, whatever their units — the Y axis title is left empty when the units differ, the legend and tooltip still show each entity's own unit. All the curves share one Y axis: when their values aren't of the same order, use `scale:` to make a small one visible next to a large one (the legend and tooltip keep showing its real value). Curves and bars share the same graph too (curves drawn over the bars). Only timeline and arrowline entities end up in separate graphs, which stay *linked* (chain icon 🔗 between them).

- **Double-click** a curve label of a YAML graph to show it in its own graph right below — whatever its unit, it stays linked to its YAML graph
- **Drag** a curve label onto another graph of the same linked group to put it back, whatever its unit
- **Double-click** the chain icon to merge the two linked graphs back into one

Linked graphs can always be merged back as long as their display types can share a graph (lines and bars can; a timeline or arrowline can't share a graph with anything else). The same applies to entities added from the UI: changing a curve's display type to one its graph can't show (e.g. a line to a timeline) moves it to a linked graph, and changing it back returns it to its graph; changing a line to bars keeps it in its graph. An entity added from the UI never joins a graph of another display type on its own. A double-click on a label of a graph added from the UI takes that curve out of its group instead.

### Reordering graphs

Drag the ⠿ symbol at the top left of any graph to reorder it. Drop above the midpoint of a target to insert before it, below to insert after. A simple click on the same area toggles the Y axis lock.

Linked graphs always stay together: moving one of them elsewhere moves the whole block, and no other graph can be dropped between them.

### Timeline and arrowline graphs

![image](https://user-images.githubusercontent.com/60828821/198171854-f643a628-25f7-4f5a-ac50-f0914a5e265e.png)

- **Drag** an entity label to move it to another timeline/arrowline graph, or to reorder it within the same graph
- **Double-click** an entity label to extract it into its own graph
- **Long-press** an entity label to open the [display type menu](#choosing-an-entitys-display-type)
- Click a truncated label to see the full name in a tooltip

The page scrolls automatically when dragging near the top or bottom of the screen.

Drag & drop shows a ghost element and insertion markers for precise positioning.

---

## Y axis control

![image](https://user-images.githubusercontent.com/60828821/221268643-735e4b1a-81da-4709-aff8-913b9b8f95a8.png)

The Y axis auto-scales by default. Click the padlock icon to lock it to the current range. Drag directly on the label area (left side of the graph) to pan the Y axis — the cursor changes to ↕. Hold **SHIFT** to enable vertical drag and zoom on the graph itself. On mobile, use a two-finger vertical pinch to zoom the Y axis.

To set initial Y axis bounds in YAML:
```yaml
graphs:
  - type: line
    options:
      ymin: 0
      ymax: 100
      ystepSize: 10
      ylock: true   # disable all interactive Y axis pan and zoom
```

`ymin` and `ymax` set the initial Y axis range and the range restored when the padlock is unlocked. They do not prevent the user from modifying the axis interactively. Use `ylock: true` to fully disable interactive Y axis changes.

> For full details → [README_Full.md — Y axis scaling](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md#y-axis-scaling)

---

## Time range and display defaults

```yaml
type: custom:history-explorer-card
defaultTimeRange: 4h     # 4 hours (default is 24h). Units: m, h, d, w, o, y
defaultTimeOffset: 1D    # Snap to current day from midnight. Use uppercase for snapped offsets
```

By default, nothing about the card's state persists across reloads — `defaultTimeRange`, graph order, and every static entity always show exactly what YAML says. Two exceptions: entities added dynamically through the UI (not defined in `graphs:`) remember themselves fully by default, since there's no YAML value to fall back to for them — and a card with no static entities at all behaves the same way for its time range and graph order, since it has nothing fixed to anchor to either.

Two options turn persistence on or off, at the card level (or per entity for individual fields):

```yaml
type: custom:history-explorer-card
enable_persistence: entities              # this device remembers dynamically-added entities — no cross-device sync
enable_multidevice_persistence: range     # this device's time range syncs across your devices via HA
```

- `enable_persistence` — this device remembers on its own (local browser storage only).
- `enable_multidevice_persistence` — this device remembers *and* syncs across your other devices via your HA account.
- Last one to speak wins: YAML, each device's UI, and your HA account (for multi-device) are each compared with what they said last time — whichever changed most recently wins. An entity edited in YAML gets its YAML values back (on every device), the others keep theirs. A device opening the card for the first time counts as YAML speaking on that device.
- Accepts `range` (the time range), `entities` (dynamically-added ones, or specific fields per static entity), `order` (the display order of your graphs — card-level only), `all` to cover everything, or `none` to explicitly turn persistence off where it would otherwise default on — e.g. a card with only dynamic entities that you *don't* want remembered.

> For full details → [README_Full.md — Default view and time ranges](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md#default-view-and-time-ranges)

---

## Auto refresh

```yaml
type: custom:history-explorer-card
refresh:
  automatic: true    # Refresh when entity values change (the default — false turns it off)
  interval: 30       # Or refresh every 30 seconds (combine both if needed)
```

Since v1.1.49, `automatic` is on by default: set `automatic: false` to turn it off.

---

## Line chart appearance

### Interpolation mode

```yaml
type: custom:history-explorer-card
lineMode: lines    # curves, lines, stepped, or smart
```

Without `lineMode`, the curves of YAML graphs are drawn as `curves`, and an entity added from the UI gets `smart` (the type menu pre-selects it). Setting `lineMode` here applies to both: with `lineMode: curves`, entities added from the UI are pre-selected as *Line curves* too. To keep `curves` for your YAML graphs only, set it under each graph's `options:` instead.

### Curve reconstruction

In `curves` and `smart` modes, the curve between two values is rebuilt by an interpolation algorithm, chosen with `interpolation` (on the card, a graph, an entity or in `entityOptions`) or from the type menu (**Reconstruction ▸**):

```yaml
type: custom:history-explorer-card
interpolation: makima   # monotone (default), steffen, makima, or catmullrom
```

| `interpolation` | How the curve looks |
|---|---|
| `monotone` (default) | Never overshoots, but flat at every value where the curve changes direction or repeats a value: small breaks in the slope |
| `steffen` | Never overshoots; flat only at the real peaks and troughs; takes the irregular spacing of the values into account |
| `makima` | Follows the local trend, flat over flat stretches, no break at each small peak; hardly any overshoot |
| `catmullrom` | The smoothest; may overshoot a little around sharp changes |

`smart` draws a curve while the sensor reports values at its usual rhythm, and a flat dashed line — the last known value held — over each silence, instead of a curve or a diagonal bridging the gap to the next value. See [README_Full.md — Smart mode](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md#smart-mode-silences-shown-as-flat-dashed-plateaus).

Angles (a wind direction, for example) no longer jump across the whole graph when they cross 0/360: a wind oscillating around the north is drawn around 0, its values just below 0 shown as such on the curve, while the tooltip and the Y axis labels show the real values (-2 shows 358). Detected automatically (unit `°` or state class `measurement_angle`); see [README_Full.md — Circular values](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md#circular-values-angles).

![image](https://user-images.githubusercontent.com/60828821/148483356-aea06848-13d9-4e1e-bd06-485b44505d48.png)

### Stroke style

```yaml
entities:
  - entity: sensor.temperature
    dashMode: shortlines          # points, shortlines, longlines, pointline
  - entity: sensor.humidity
    dashMode: [10, 4, 2, 4]       # custom Canvas dash pattern
```

### Individual sample dots

![image](https://user-images.githubusercontent.com/60828821/221272054-abb884df-b95f-4c88-83f0-921ac8709a93.png)

Hold **Alt** (Option on Mac) while hovering to reveal individual data points. To show them permanently:

```yaml
entityOptions:
  humidity:
    showPoints: true   # true = 4px radius, or specify a number
```

### Min/max statistical band

```yaml
entities:
  - entity: sensor.outside_temperature
    showMinMax: statistics   # band on long-term statistics portion only
    showMinMax: history      # band on full graph including recent history
```

### Unavailable data

By default the card interpolates over unavailable states. To show gaps instead:
```yaml
showUnavailable: true
```

> For full details → [README_Full.md — Line appearance](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md#line-interpolation-modes)

---

## Bar charts

![image](https://user-images.githubusercontent.com/60828821/193383950-53242b11-d467-42ba-9859-3b3df0b0dcb8.png)

Entities with a `total_increasing` state class are automatically shown as bar charts. Use the interval selector on the graph to switch between 10m, hourly, daily and monthly views.

A bar graph can also hold curves (a YAML graph mixing both, a curve changed to bars, or a drag within a group of linked graphs): the curves are drawn over the bars and aren't affected by the interval, nor stacked. *Raw line* in the interval selector only turns the bars into raw curves; picking an interval again turns them back into bars. Bars and curves share one Y axis — for incompatible units (e.g. kWh bars and a W curve) use `scale:` to bring them to comparable values (with `unit:` to show the new unit, e.g. `scale: 0.001` and `unit: kW`).

```yaml
entityOptions:
  sensor.rain_amount:
    type: bar
    interval: 10m
```

Color ranges based on value:
```yaml
entityOptions:
  energy:
    type: bar
    color:
      '0.0': blue
      '1.0': green
      '1.5': red
```

> For full details (stacked bars, net metering) → [README_Full.md — Bar graphs](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md#bar-graphs-for-total-increasing-entities)

---

## Timeline charts

![image](https://user-images.githubusercontent.com/60828821/198171854-f643a628-25f7-4f5a-ac50-f0914a5e265e.png)

State text display:
```yaml
stateTextMode: raw    # raw HA state names
stateTextMode: auto   # translated device class dependent names (default)
stateTextMode: hide   # no state labels
```

State colors can be customized by entity, device class, domain or globally:
```yaml
stateColors:
  door.on: blue
  motion.on: yellow
  binary_sensor.off: purple
  off: '#ff0000'
```

> For full details (color priority rules, stateColorSeed) → [README_Full.md — Timeline charts](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md#timeline-charts)

---

## Compass arrow graphs

![image](https://user-images.githubusercontent.com/60828821/163562690-01002243-b6d3-4a55-8128-9d1dc89581c6.png)

```yaml
entityOptions:
  sensor.wind_bearing:
    type: arrowline
    color: black
    fill: rgba(0,0,0,0.2)
```

---

## Long term statistics

![image](https://user-images.githubusercontent.com/60828821/203880897-6f634e95-cb5d-484c-a9c0-d97b58321557.png)

The card seamlessly extends graphs beyond the history retention limit using long term statistics. Enabled by default.

```yaml
statistics:
  enabled: true
  mode: mean       # mean, min, or max
  period: hour     # hour, day, or month
  force: false     # true = use statistics only, no short-term history
  retention: 90    # optional: override history retention period in days
```

> For full details → [README_Full.md — Long term statistics](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md#long-term-statistics)

---

## Entity options

All display options can be applied globally via `entityOptions`, keyed by entity id, device class, or domain. A list form with glob patterns is also supported:

```yaml
entityOptions:
  - match: "sensor.*_power"
    lineMode: lines
    color: '#3e95cd'
  - entity: sensor.wind_bearing
    type: arrowline
```

> For full details and priority rules → [README_Full.md — Entity options](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md#customizing-dynamically-added-graphs)

---

## Card, graph, and entity-level options

Every display/behavior property below can be set at up to three levels — as a shared default for the whole **card**, as a shared default for one **graph** (`graphs: - options:`), or directly on one **entity**. The most specific level wins: entity beats graph, graph beats card.

```yaml
type: custom:history-explorer-card
lineWidth: 2                     # card-level default

entityOptions:                   # targeted defaults — see *1 below
  - match: "sensor.*_power"
    lineMode: lines
    color: '#3e95cd'
  - entity: sensor.wind_bearing
    type: arrowline

graphs:
  - type: line
    options:                     # graph-level default, applies to every entity below
      fill: rgba(0,0,0,0)
      showMinMax: statistics
    entities:
      - entity: sensor.*temperature*
        exclude: '*fridge*'      # entity-level filter — see *2 below
```

| Option | Card | Graph | Entity | Description |
|---|:-:|:-:|:-:|---|
| `type` | | | ✓ | `line`, `bar`, `timeline`, `arrowline` |
| `color` | | | ✓ | Line/bar color (HTML, CSS variable, or color range object) |
| `fill` | ✓ | ✓ | ✓ | Fill color under the line |
| `lineWidth` | ✓ | ✓ | ✓ | Line width in pixels — see *1 |
| `lineMode` | ✓ | ✓ | ✓ | `curves`, `lines`, `stepped`, or `smart` |
| `interpolation` | ✓ | ✓ | ✓ | Curve reconstruction in `curves` and `smart` modes: `monotone` (default), `steffen`, `makima`, `catmullrom` |
| `dashMode` | ✓ | ✓ | ✓ | `points`, `shortlines`, `longlines`, `pointline`, or custom array |
| `showPoints` | ✓ | ✓ | ✓ | Dots at measurement points (`true` = 4px, or numeric radius) — `showSamples` is a synonym |
| `showMinMax` | ✓ | ✓ | ✓ | Min/max band: `statistics` or `history` |
| `decimation` | ✓ | ✓ | ✓ | `fast` (default), `accurate`, or `false` |
| `netBars` | ✓ | ✓ | ✓ | Net metering mode for bar graphs |
| `interval` | ✓ | ✓ | ✓ | Default bar interval: `10m`, `hourly`, `daily`, `monthly` |
| `scale` | | | ✓ | Multiply values by this factor before drawing — see *6 |
| `unit` | | | ✓ | Unit shown instead of the entity's own — see *6 |
| `hidden` | | | ✓ | Hide by default in legend |
| `process` | | | ✓ | JS expression to transform values before display |
| `circular` | | | ✓ | Angles: no jump at 0/360 — auto-detected, `false`, a period, or `2pi` — see *5 |
| `ymin` / `ymax` | ✓ | ✓ | ✓ | Set initial Y axis bounds (can still be modified interactively) — see *7 |
| `ystepSize` | ✓ | ✓ | ✓ | Fix Y axis tick step (`ystepsize` is a synonym) — see *7 |
| `ylock` | ✓ | ✓ | ✓ | Disable all interactive Y axis pan and zoom — see *7 |
| `stacked` | ✓ | ✓ | ✓ | Stack bars (bar graphs with multiple entities) — see *7 |
| `showTimeLabels` | ✓ | ✓ | ✓ | Show/hide time axis labels on timeline/arrowline graphs (default `true`) — see *7 |
| `height` | ✓ | ✓ | ✓ | Graph height in pixels — see *2 and *7 |
| `entityOptions` | ✓ | | | Targeted defaults by entity id, device class, domain, or glob pattern — see *3 |
| `filterEntities` / `excludeFilterEntities` | ✓ | | | Limit which entities appear in the entity picker — see *4 |
| `exclude` | | ✓ | ✓ | Exclude specific matches from a wildcard `entity:` pattern — see *4. Graph-level and entity-level excludes combine rather than override |

*1 — `width` is still accepted as an alias for `lineWidth`, for backward compatibility.

*2 — `height` on the card sets the height of every line and bar graph; `lineGraphHeight`/`barGraphHeight` (see [UI configuration](#ui-configuration)) still set their own, and win over it.

*3 — `entityOptions` accepts any property marked ✓ in the **Entity** column above, targeted by entity id, device class, domain, or glob pattern instead of repeating it on every entity.

*4 — `filterEntities`, `excludeFilterEntities` and `exclude` each accept a single string, a list of strings, or (for `exclude`) the object form `{entity: '...'}` — see [Adding entities](#adding-entities) above.

*5 — `circular`: absent (or `none`) detects angles automatically (unit exactly `°`, or state class `measurement_angle`: period 360), `false` turns it off, a number or numeric string (`360`, `6.28`) sets the period, `2pi` sets 2π. On an arrowline, it sets what a full turn of the arrows is (360 without a period).

*6 — `scale` without `unit` only changes how the curve is drawn (to make it visible next to larger values, or to flip it with a negative factor): the legend and tooltip show the entity's real value. With `unit`, `scale` is a conversion into that unit, and the legend and tooltip show the converted value — e.g. `scale: 0.001` and `unit: kW` for a power in W.

*7 — an option of the graph itself (its Y axis, its stacking, its height, its time labels): set on an entity or in `entityOptions`, it applies to the graph the entity is shown in; the graph's own value wins.

Every option is spelled the same at every level where it's accepted, and every spelling it ever had is accepted everywhere (`width` for `lineWidth`, `showSamples` for `showPoints`, `ystepsize` for `ystepSize`). A graph's options can be set under its `options:` or directly on the graph, next to `type:` and `entities:` (`options:` wins if both are set). When an option is set at several levels, the most specific one wins: **entity → graph → `entityOptions` → card**.

> Every YAML option, at every level, with its default value, is listed in [full-reference-config.yaml](https://github.com/Cook23/history-explorer-card/blob/main/full-reference-config.yaml).

> For full details and priority rules → [README_Full.md — Entity options](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md#customizing-dynamically-added-graphs)

---

## CSV export

![image](https://user-images.githubusercontent.com/60828821/203881276-1332c8bd-d83c-4ff6-9a9b-9b43cb4a6c44.png)

Open the entity action menu and select **Export as CSV**. Not available in the HA Companion app.

```yaml
csv:
  separator: ';'
  timeFormat: 'DD/MM/YYYY HH:mm:ss'
  statisticsPeriod: hour
  exportAttributes: true
  numberLocale: 'en-US'
```

---

## UI configuration

```yaml
type: custom:history-explorer-card
header: 'My history'   # or 'hide' to remove entirely
uimode: dark           # force dark or light mode
cardName: my-card      # required if using multiple cards on the same dashboard

uiColors:
  gridlines: '#ff000040'
  labels: green
  buttons: '#80f00050'
  cursorline: '#ff000080'  # vertical cursor line color
  selector: 'rgba(255,255,255,255)'
  closeButton: '#0000001f'

uiLayout:
  toolbar: top         # top, bottom, both, hide
  selector: bottom
  sticky: top          # keep toolbar visible while scrolling
  invertZoom: true     # swap + and - zoom buttons
  interval: hide       # hide the bar interval selector

labelsVisible: false
labelAreaWidth: 65

lineGraphHeight: 250
barGraphHeight: 150
timelineBarHeight: 24
timelineBarSpacing: 40

showCurrentValues: false  # live values next to legend labels are shown by default; set false to hide
legendVisible: false       # hide the legend entirely
rounding: 2               # decimal digits in tooltips

lineWidth: 2              # default line width in pixels
stateColorSeed: 137       # seed for automatic state colors

timeTicks:
  density: high           # base density: low, medium, high, higher, highest
  densityOverride: higher # skip auto-density and force this level
  dateFormat: short       # normal or short

statistics:
  enabled: true
  mode: mean              # mean, min, max
  period: hour            # hour, day, month
  force: false
  retention: 90           # optional: override history retention period in days
```

> For full details → [README_Full.md — Configuring the UI](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md#configuring-the-ui)

---

## YAML graph configuration

```yaml
type: custom:history-explorer-card
graphs:
  - type: line
    title: Temperatures
    options:
      ymin: -10
      ymax: 40
    entities:
      - entity: sensor.outside_temperature
        color: '#3e95cd'
        fill: rgba(151,187,205,0.15)
      - entity: sensor.annexe_temperature
        color: '#ee3452'
        fill: rgba(0,0,0,0)
        hidden: true
  - type: timeline
    title: Doors and motion
    entities:
      - entity: binary_sensor.door_barn
        name: Barn door
      - entity: binary_sensor.pir_yard
        name: Yard PIR
  - type: arrowline
    title: Wind bearing
    entities:
      - entity: sensor.wind_bearing
        color: black
```

> For full details and advanced examples → [README_Full.md — YAML configuration](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md#yaml-configuration-for-preconfigured-graphs)

`options:` can also carry styling properties (`fill`, `showMinMax`, `dashMode`, `lineMode`, `lineWidth`, `showPoints`, `decimation`, `netBars`) as a shared default for every entity in that graph — useful when combining several wildcard `entity:` patterns onto the same graph.

---

## Running as a sidebar panel

![image](https://user-images.githubusercontent.com/60828821/161340801-f1f97e90-73c4-44d9-8afa-ba858906a2c1.png)

Add an empty dashboard with **Show in sidebar** checked, set the view type to **Panel (1 card)**, and add the history explorer card.
