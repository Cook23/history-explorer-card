[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/v/release/Cook23/history-explorer-card?style=for-the-badge)](https://github.com/Cook23/history-explorer-card/releases)
[![GitHub stars](https://img.shields.io/github/stars/Cook23/history-explorer-card?style=for-the-badge)](https://github.com/Cook23/history-explorer-card/stargazers)
![Experimental](https://img.shields.io/badge/status-experimental-yellow?style=for-the-badge)

<a href="https://buymeacoffee.com/thierry_couquillou" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50"></a>

# History explorer card

> **A custom history card for Home Assistant — fork of [SpangleLabs/history-explorer-card](https://github.com/SpangleLabs/history-explorer-card).**
> 📖 [README_Full.md](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md) — the complete documentation · What this fork adds: [FORK_DESCRIPTION.md](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/FORK_DESCRIPTION.md) 🇬🇧 / [FORK_DESCRIPTION_FR.md](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/FORK_DESCRIPTION_FR.md) 🇫🇷

A highly interactive history card for Home Assistant. Pan, zoom, and explore your entity history across any time range, with full support for line charts, bar charts, timelines and compass arrow graphs.

![The card: two temperatures, the pressure and a timeline over one day](https://github.com/Cook23/history-explorer-card/raw/main/images/screenshots/hero.png)

---

> [!IMPORTANT]
> **This is a beta.** The history explorer part of the card is relatively stable; the mini-graph-card part — its YAML, `look: mini`, the values over a graph, the aggregation — is in beta. Feedback is welcome in the [discussions](https://github.com/Cook23/history-explorer-card/discussions) or in an [issue](https://github.com/Cook23/history-explorer-card/issues).

*Developed with Claude Code, which modifies, reviews and tests the card, and runs its automated tests in a real browser against a simulated Home Assistant, with mouse and touch input.*

---

## 📋 Version highlights

A quick look at the milestones — see [CHANGELOG.md](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/CHANGELOG.md) for the complete, version-by-version detail.

- **v1.2.27** — Loading only what the screen can show: the hourly statistics, the 5-minute statistics or the history, chosen by how long a column of pixels lasts; every action taken at once, whatever is loading.
- **v1.2.18** — mini-graph-card's YAML read as the card's own: a mini-graph-card is replaced by changing its `type` and adding `look: mini`.
- **v1.2.15** — Gesture settings for every card (long-press duration, pointer precision, for a mouse or a pen and for a finger); the options menu in submenus.
- **v1.2.9** — Values over a graph and `look: mini`; an entity's attributes shown as curves.
- **v1.2.6** — A graph's menu, cut and paste: every gesture also in a menu.
- **v1.2.4** — Two Y axes on a graph; colors from thresholds or from another entity; the info panel on every page of Home Assistant.
- **v1.2.2** — The type menu in submenus (*Display*, *Interpolation*, *Layout*); the tooltip opens on a click or a tap.
- **v1.2.0** — Beta, alongside the 1.1 line: dragging on touch screens reworked (a swipe always scrolls the page), the code reorganized.

---

## Table of contents

- [📋 Version highlights](#-version-highlights)
- [Install](#install)
- [Usage](#usage)
  - [Navigation](#navigation)
  - [Tooltip](#tooltip)
  - [Menus](#menus)
  - [Adding entities](#adding-entities)
  - [Managing graphs](#managing-graphs)
  - [Y axis](#y-axis)
- [Time range](#time-range)
- [Persistence](#persistence)
- [Info panel](#info-panel)
- [Graph types](#graph-types)
  - [Lines](#lines)
  - [Bars](#bars)
  - [Timelines](#timelines)
  - [Compass arrows](#compass-arrows)
- [Colors](#colors)
- [Long term statistics](#long-term-statistics)
- [Values over a graph, look: mini](#values-over-a-graph-look-mini)
- [Options](#options)
- [UI configuration](#ui-configuration)
- [CSV export](#csv-export)
- [YAML graphs](#yaml-graphs)
- [Running as a sidebar panel](#running-as-a-sidebar-panel)

---

## Install

- **HACS** (recommended): add `https://github.com/Cook23/history-explorer-card` as a custom repository.
- **Manually**: copy `history-explorer-card.js` into `config/www`, then add the resource `/local/history-explorer-card.js` (*Settings → Dashboards → ⋮ → Resources*, type JavaScript module).

---

## Usage

https://github.com/user-attachments/assets/b2a51086-47ad-42dc-a503-f71110835146

### Navigation

- **Pan** — drag left or right on a graph.
- **Zoom** — the range selector and its magnifiers − and +, Ctrl + the wheel, or a box: drag mostly up or down on a graph (a mouse), or turn the magnifying glass on (green) to draw one with any pointer. A long press on the glass chooses what the box zooms: the time ↔, the Y axis ↕ or both ⤢. A double-click on the glass gets the default range back.
- **Date** — `<` `>` move the window; a click on the date opens a calendar, a double-click goes back to the present.
- **Real time** — a window reaching the present follows it: the curves grow and slide, the present always on the right.
- **Points** — hover a curve to see its nearest value's point; a long press (or a right click) near a curve shows or hides all its points; **Alt** shows every curve's.
- **Touch screen** — a swipe scrolls the page. To drag a label, the ⠿ handle or the Y axis labels: tap, then press again right away and drag. Two fingers zoom (horizontally the time, vertically the Y axis) and pan.
- **Pen** — the tip works as a finger; its button, where the browser passes it on, as a right click.

📖 [Interactive navigation](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#interactive-navigation)

### Tooltip

![A click on a curve: the tooltip, at the value pointed at](https://github.com/Cook23/history-explorer-card/raw/main/images/screenshots/tooltip.png)

Click near a curve to put it in the tooltip; it then follows the pointer from value to value, and shows real values only. What it shows is each curve's tooltip mode — `selected` (the curves clicked), `nearest` (the value pointed at, on a hover), `mixed` (both) or `all` (every curve's value at that time) —, set by the screen — `tooltip.largeScreen` (a window 640 px wide or more, `mixed` by default), `tooltip.smallScreen` (`selected` by default) — or by the card's room, which wins when set — `tooltip.largeChart` (a card 600 px wide or more), `tooltip.smallChart` (narrower, and the info panel) —, or from a menu: *Behavior ▸ Tooltip ▸*, which sets the one giving the mode where the card is — the card's room's when set, else the screen's. `tooltip.size` sets how much it shows: `full`, `compact`, `slim`, or `auto` (by the card's width, the default).

📖 [Tooltip](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#tooltip)

### Menus

![A curve's menu, Appearance open](https://github.com/Cook23/history-explorer-card/raw/main/images/screenshots/menu-curve.png)

- **A curve's menu** — a long press (or a right click) on its label: *Display ▸* (its type), *Appearance ▸* (color, points, min/max band, fill, width, line style), *Interpolation ▸*, *Behavior ▸* (tooltip, Y axis lock, separate, merge back, cut, delete), *Tests (beta) ▸*.
- **A graph's menu** — a long press on its ⠿ zone: the same for all its curves, and *Cut* / *Delete the graph*.
- **The options menu** — the ▾ button beside the entity selector: the same for every curve of the card, *Export ▸* (CSV), *Card ▸* (back to the YAML's graphs or display), *Global ▸* (the info panel's switch, the gesture settings).

A choice made in a menu applies to every curve it concerns: the last one made wins, whatever its level.

The gesture settings (long-press duration, pointer precision, for a mouse or a pen and for a finger) apply to every card, on every device:

```yaml
gestures:
  longPress: 500        # ms, mouse and pen
  longPressTouch: 500   # ms, finger
  precision: 8          # px, mouse and pen
  precisionTouch: 12    # px, finger
```

📖 [Menus](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#menus) · [Gesture settings](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#gesture-settings)

### Adding entities

![Adding an entity: the field, the matching entities](https://github.com/Cook23/history-explorer-card/raw/main/images/screenshots/adding-entities.png)

Type in the entity selector — it filters on the names and the ids, `*` as a wildcard (`*door*`, `sensor.*`) — and choose an entry with a click or Enter. An entity with attributes first offers its *Value* or one of its attributes. The type menu then opens, the most fitting type pre-selected (*Timeline* for a state that isn't a number, *Bar* for energy that adds up, *Direction* for an angle, else a *Smart* line); nothing is added before a type is picked.

```yaml
recordedEntitiesOnly: true          # only the entities recorded in the database
filterEntities: 'sensor.*energy*'   # or a list; excludeFilterEntities removes matches again
```

📖 [Adding entities](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#adding-entities)

### Managing graphs

![A curve's label dragged onto another graph](https://github.com/Cook23/history-explorer-card/raw/main/images/screenshots/drag-label.png)

- **Click** a curve's name to hide or show it; a click on its value opens the entity's dialog.
- **Double-click** a label to take the curve out into its own graph; double-click the chain icon 🔗 of linked graphs to merge them back.
- **Drag** a label to reorder curves, or onto another graph to move the curve there; drag the ⠿ handle to reorder graphs.
- **Cut and paste** — *Cut* in a menu, then 📋 (into a graph) or ↓ / ↑ (a graph below or above) on the ⠿ zones.

```yaml
combineSameUnits: true   # entities with compatible units (W and kW) added to the same graph
```

📖 [Interactive graph management](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#interactive-graph-management)

### Y axis

![The Y axis padlock](https://github.com/Cook23/history-explorer-card/raw/main/images/screenshots/y-lock.png)

The Y axis scales itself (padlock open, green). Drag its labels to pan it, hold **Shift** to drag and zoom it on the graph; the padlock locks it (red). Two groups of units get an axis each, the second one on the right.

```yaml
graphs:
  - type: line
    options:
      ymin: ~0       # ~: soft, lower where the values go lower
      ymax: 100
      ylock: true    # no pan nor zoom of the Y axis
```

📖 [Y axis scaling](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#y-axis-scaling)

---

## Time range

```yaml
defaultTimeRange: 4h     # 24h by default; m, h, d, w, o (months), y
defaultTimeOffset: 1D    # uppercase: snapped — here the current day, from midnight
defaultMagnifierMode: x  # what the magnifying glass's box zooms: x the time, y the Y axis, xy both (default)
```

📖 [Default view and time ranges](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#default-view-and-time-ranges)

---

## Persistence

What you change on the card — its entities, its graphs' order, its time range, an entity's options — is kept or not:
- the entities added from the UI are kept, on every device — and a card without YAML entities keeps its time range and its graphs' order too;
- the YAML entities show what the YAML says, unless you choose otherwise:

```yaml
enablePersistence: entities           # kept on this device
enableMultidevicePersistence: range   # kept and synced across your devices
```

Each takes `range`, `entities`, `order`, `all` or `none` (or a list), and can be set on a YAML entity for its own fields. The last one to speak wins: the YAML, when it changes, or the card.

📖 [Persistence](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#persistence)

---

## Info panel

The card can replace the history graph of Home Assistant's more info popup. Turn it on with the switch *Global ▸ Enhanced native history* of the options menu, or with `defaultInfoPanel: true`; `infoPanel:` holds the panel's own options. To have it on every page of Home Assistant, not only after a dashboard was opened:

```yaml
# configuration.yaml
frontend:
  extra_module_url:
    - /hacsfiles/history-explorer-card/history-explorer-card.js?hacstag=...   # the URL of the card's resource
```

📖 [Info panel](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#info-panel--replacing-the-ha-more-info-popup)

---

## Graph types

### Lines

![The same values in the four line modes](https://github.com/Cook23/history-explorer-card/raw/main/images/screenshots/line-modes.png)

- `lineMode`: `smart` (the default from the UI: a curve, and a flat dashed line over the silences of a sensor), `curves` (the default in YAML), `lines`, `stepped`.
- `interpolation` (curves and smart): `monotone` (default, never overshoots), `steffen`, `makima`, `catmullrom` (the smoothest), `bspline` (mini-graph-card's).
- `dashMode`: `solid`, `points`, `shortlines`, `longlines`, `pointline` or a pattern `[10, 4]`; `lineWidth`; `fill`.
- `showMinMax: true`: a band between the minimum and the maximum around the curve.
- Angles (unit `°`) are drawn without a jump at 0/360 (`circular`).
- `showUnavailable: true`: gaps where the entity was unavailable.

📖 [Line appearance](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#line-appearance)

### Bars

![Rain by the hour and by 10 minutes, each graph with its interval](https://github.com/Cook23/history-explorer-card/raw/main/images/screenshots/bars-interval.png)

Energy, gas or water that adds up is shown as bars, by *10 min*, *Hour*, *Day*, *Week* or *Month* (the interval selector on the graph), or *Raw*. A bar graph can hold curves too.

```yaml
entityOptions:
  sensor.rain_amount:
    type: bar
    interval: 10m
```

📖 [Bar graphs](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#bar-graphs-for-total-increasing-entities)

### Timelines

![A timeline: motion, a lock, a person](https://github.com/Cook23/history-explorer-card/raw/main/images/screenshots/timeline.png)

```yaml
stateTextMode: auto    # the states' names for their device class (default); raw; hide
stateColors:           # by entity, device class, domain or state
  door.on: blue
  binary_sensor.off: purple
  off: '#ff0000'
```

📖 [Timeline charts](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#timeline-charts)

### Compass arrows

![Wind gusts and the wind direction as compass arrows](https://github.com/Cook23/history-explorer-card/raw/main/images/screenshots/compass.png)

```yaml
entityOptions:
  sensor.wind_bearing:
    type: arrowline
```

📖 [Compass arrow graphs](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#compass-arrow-graphs)

---

## Colors

`color` takes a color, or thresholds on the value — or on another entity's or attribute's:

```yaml
      - entity: sensor.heat_pump_power
        color:
          entity: sensor.heat_pump_mode   # without it: thresholds on the value (0: blue, 1.5: red…)
          heat: red
          cool: blue
          default: grey
```

📖 [Colors of curves and bars](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#colors-of-curves-and-bars)

---

## Long term statistics

![Statistics where the history is gone, the history where it is kept](https://github.com/Cook23/history-explorer-card/raw/main/images/screenshots/long-term-stats.png)

The card loads what the screen can show — the hourly statistics, the 5-minute statistics or the history, by how long a column of pixels lasts —, so a graph reaches beyond the history's retention and panning and zooming stay smooth.

```yaml
statistics:
  enabled: true    # default
  period: hour     # hour, day, month
```

📖 [Long term statistics](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#long-term-statistics) · [Aggregation](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#aggregation)

---

## Values over a graph, look: mini

`showState` shows each curve's value now over its graph, `showStats` its minimum, average and maximum over the window shown. `look: mini` gives the look of mini-graph-card at once — the time can still be panned and zoomed; any option set on the card wins.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/Cook23/history-explorer-card/raw/main/images/screenshots/narrow-and-mini-dark.png">
  <img alt="A card 168 px wide; look: mini, 374 and 168 px wide" src="https://github.com/Cook23/history-explorer-card/raw/main/images/screenshots/narrow-and-mini.png">
</picture>

*Left: a card 168 px wide. Middle and right: `look: mini`, 374 and 168 px wide.*

**Replacing a mini-graph-card**: change its `type` to `custom:history-explorer-card` and add `look: mini`, its other lines kept — its options are read as the card's own.

📖 [Values over a graph](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#values-over-a-graph-a-compact-look) · [mini-graph-card compatibility](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#mini-graph-card-compatibility)

---

## Options

Each option can be set on the **card**, in **`entityOptions`** (by entity id, device class, domain or pattern), on a **graph** (under `options:` or on the graph) or on an **entity**; the most specific wins: **entity → graph → `entityOptions` → card**.

```yaml
type: custom:history-explorer-card
lineWidth: 2                  # the card
entityOptions:
  - match: "sensor.*_power"   # entityOptions
    lineMode: lines
graphs:
  - type: line
    options:                  # a graph
      showMinMax: statistics
    entities:
      - entity: sensor.*temperature*
        exclude: '*fridge*'   # an entity
```

| Option | Name aliases | Value aliases | Card | Graph | Entity | Description |
|---|---|---|:-:|:-:|:-:|---|
| `type` | `graph` | | | | ✓ | `line`, `bar`, `timeline`, `arrowline` |
| `colorTransition` | `color_thresholds_transition` | | ✓ | ✓ | ✓ | `smooth`: number thresholds blended from one to the next; `hard` (default): each value its threshold's color |
| `lineColor` | `line_color` | | ✓ | ✓ | | A color, or a list of colors: each entity of a graph without its own takes the one at its place |
| `color` | `color_thresholds` | thresholds as a list: `[{ value: 0, color: blue }, green, { value: 20, color: red }]` | ✓ | | ✓ | Line/bar color: a color, thresholds (on the value, or on another entity's or attribute's), or an entity or attribute holding either |
| `fill` | `show_fill` | `true`: the curve's color, light; `false`: none | ✓ | ✓ | ✓ | Fill color under the line, or `fade`: the curve's color fading out downwards |
| `showState` | `show_state` | | ✓ | ✓ | ✓ | The curve's value now, in large, over the graph |
| `showIndicator` | `show_indicator` | | ✓ | ✓ | ✓ | A dot in its color before its value over the graph |
| `showCurrentValues` | `show_legend_state` | | ✓ | ✓ | ✓ | `false`: its value now left out of its legend label |
| `showName` / `showIcon` / `icon` / `iconImage` | `show_name` / `show_icon` / — / `icon_image` | | ✓ | ✓ | | The graph's header: its name, its icon — see [Values over a graph](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#values-over-a-graph-a-compact-look) |
| `alignHeader` / `alignIcon` / `alignState` | `align_header` / `align_icon` / `align_state` | | ✓ | ✓ | | The header's layout, the icon's place, the values' place |
| `fontSizeHeader` / `fontSize` | `font_size_header` / `font_size` | | ✓ | ✓ | | The header's size (px); the values' size (%) |
| `nameAdaptiveColor` / `iconAdaptiveColor` | `show_name_adaptive_color` / `show_icon_adaptive_color` | | ✓ | ✓ | | The header's name, its icon in the first curve's color now |
| `showStats` | `show.extrema`, `show.average` | | ✓ | ✓ | ✓ | Its `min`, `average` and `max` over the window shown, over the graph (`true`: all three) |
| `showStateFor`, `showStatsFor` | | | ✓ | ✓ | | `all` (default) or `first`: `showState`, `showStats` of the graph or the card for its first curve only, the others' set on them |
| `stateAdaptiveColor` | `state_adaptive_color` | | ✓ | ✓ | ✓ | `false`: its values over the graph in the text's color |
| `lineWidth` | `width`, `line_width` | | ✓ | ✓ | ✓ | Line width in pixels |
| `lineMode` | `smoothing` | `true` = `curves`, `false` = `lines`; `line`, `curve`, `step` | ✓ | ✓ | ✓ | `curves`, `lines`, `stepped`, or `smart` |
| `interpolation` | | `akima` = `makima`, `catmull-rom`, `b-spline` | ✓ | ✓ | ✓ | Interpolation algorithm in `curves` and `smart` modes: `monotone` (default), `steffen`, `makima`, `catmullrom`, `bspline` |
| `dashMode` | `line_style` | dashes and gaps as CSS writes them: `'10,10'` | ✓ | ✓ | ✓ | `solid`, `points`, `shortlines`, `longlines`, `pointline`, or custom array |
| `showLine` | `show_line` | | ✓ | ✓ | ✓ | `false`: its points only, no line |
| `showGraph` | `show_graph` | `show.graph: bar` / `line`: drawn | ✓ | ✓ | ✓ | `false`: not drawn, nor in the legend, its value kept over the graph; a graph none of whose curves is drawn shows no plot, only its header and values |
| `fixedValue` | `fixed_value` | | ✓ | ✓ | ✓ | `true`: its last value in the window, flat over the whole window |
| `showPoints` | `showSamples`, `show_points` | | ✓ | ✓ | ✓ | Dots at measurement points: `hover` (default) only the hovered one; `true` all, the line width + 2 px wide, or a radius in px; `false` none |
| `tooltip.largeScreen` | `largeScreenTooltip`, `large_screen_tooltip` | | ✓ | ✓ | ✓ | The tooltip on a large screen (a window 640 px wide or more), unless `tooltip.largeChart` or `tooltip.smallChart` is set for the card's room: `mixed` (default) the value pointed at on any curve, at a hover or a click, and the curves clicked; `nearest` that value only; `selected` the curves clicked only; `all` that value and each other curve's value at the same time (or nearest, a few pixels away at most). Set from *Behavior ▸ Tooltip ▸* on that screen, where the card's room has no mode set; kept on this device only |
| `tooltip.smallScreen` | `smallScreenTooltip`, `small_screen_tooltip` | | ✓ | ✓ | ✓ | The same on a small screen (a window narrower than 640 px): `selected` by default; set from *Behavior ▸ Tooltip ▸* on that screen, where the card's room has no mode set |
| `tooltip.largeChart` | `largeChartTooltip`, `large_chart_tooltip` | | ✓ | ✓ | ✓ | The same in a card 600 px wide or more, winning over the screen's when set: no default; set from *Behavior ▸ Tooltip ▸* in such a card, once set; kept on this device only |
| `tooltip.smallChart` | `smallChartTooltip`, `small_chart_tooltip` | | ✓ | ✓ | ✓ | The same in a card narrower than 600 px, and in the info panel: no default; set from *Behavior ▸ Tooltip ▸* in such a card, once set |
| `tooltip.behavior` | `tooltipBehavior`, `tooltip_behavior` | | ✓ | ✓ | ✓ | Changes the default of `tooltip.largeScreen` and `tooltip.smallScreen`: `mixed`, `nearest`, `selected` or `all`, on both screens; `auto` (default) leaves theirs (`mixed`, `selected`) |
| `pointsPerHour` | `points_per_hour` | | ✓ | ✓ | ✓ | Points an hour (groups of 1 / `pointsPerHour` hours) instead of one per column of pixels |
| `groupBy` | `group_by` | | ✓ | ✓ | ✓ | `interval` (default), `hour`, `date`: a point an hour, a day |
| `aggregateFunc` | `aggregate_func` | | ✓ | ✓ | ✓ | Each group's value: `avg` (default, weighted by time), `median`, `min`, `max`, `first`, `last`, `sum`, `delta`, `diff` |
| `showMinMax` | | | ✓ | ✓ | ✓ | Min/max band around the mean curve: `true` (everywhere), `statistics` or `history` (only where the curve comes from them) |
| `netBars` | | | ✓ | ✓ | ✓ | Net metering mode for bar graphs |
| `interval` | | | ✓ | ✓ | ✓ | Default bar interval: `10m`, `hourly`, `daily`, `weekly`, `monthly` |
| `rounding` | `decimals` | | ✓ | ✓ | ✓ | The values' decimals — exactly that many; not set: at most 2 |
| `tapAction` | `tap_action` | an action's name alone: `tapAction: none` | ✓ | ✓ | ✓ | What a click on a value does: `more-info` (default: its dialog, with the info panel when it's on), `navigate`, `url`, `perform-action`, `call-service`, `none` |
| `scale` | | | | | ✓ | Multiply values by this factor before drawing — see *6 |
| `yAxis` | `y_axis` | `primary` = `left`, `secondary` = `right` | ✓ | ✓ | ✓ | `auto`, `left` or `right`: the Y axis of the curves (`auto`, the default: the second group of units goes on the right; `left` keeps one axis) |
| `unit` | | | ✓ | | ✓ | Unit shown instead of the entity's own — see *6 |
| `valueFactor` | `value_factor` | | ✓ | ✓ | ✓ | Its values shown and drawn multiplied by 10 to that power (`-3`: 400 W shows 0.4) — see *6 |
| `stateMap` | `state_map` | | ✓ | ✓ | ✓ | A text state drawn as a curve: each state at its place in the list, its label shown — see [Text states as a curve](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#text-states-as-a-curve) |
| `hidden` | | | | | ✓ | Hide by default in legend |
| `legendVisible` | `show_legend` | | ✓ | | ✓ | `false`: no legend (the card); no label in the legend for this entity (an entity); `auto` (the card): a graph's legend only for several labels |
| `process` | | | | | ✓ | JS expression to transform values before display |
| `circular` | | | | | ✓ | Angles: no jump at 0/360 — auto-detected, `false`, a period, or `2pi` — see *5 |
| `ymin` / `ymax` | `lower_bound` / `upper_bound` | | ✓ | ✓ | ✓ | Set initial Y axis bounds (can still be modified interactively); `~0`: soft — the bound unless the values go past it — see *7 |
| `yminRight` / `ymaxRight` | `lower_bound_secondary` / `upper_bound_secondary` | | ✓ | ✓ | ✓ | The right Y axis' own bounds — see *7 |
| `yrange` / `yrangeRight` | `min_bound_range` / `min_bound_range_secondary` | | ✓ | ✓ | ✓ | The smallest range the Y axis (the right one) shows — see *7 |
| `logarithmic` | | | ✓ | ✓ | ✓ | A logarithmic Y axis (a line graph) — see *7 |
| `labelsLeft` | `show_labels` | | ✓ | ✓ | ✓ | The left Y axis' labels: `false` none, `hover` shown while the pointer is over the graph — see *7 |
| `labelsRight` | `show_labels_secondary` | | ✓ | ✓ | ✓ | The right Y axis' labels, the same way — see *7 |
| `ystepSize` | `ystepsize` | | ✓ | ✓ | ✓ | Fix Y axis tick step — see *7 |
| `ylock` | | | ✓ | ✓ | ✓ | Disable all interactive Y axis pan and zoom — see *7 |
| `stacked` | | | ✓ | ✓ | ✓ | Stack bars (bar graphs with multiple entities) — see *7 |
| `barSpacing` | `bar_spacing` | | ✓ | ✓ | ✓ | The room between two bars, in pixels — see *7 |
| `showTimeLabels` | | | ✓ | ✓ | ✓ | Show/hide time axis labels on timeline/arrowline graphs (default `true`) — see *7 |
| `height` | | | ✓ | ✓ | ✓ | Graph height in pixels — see *2 and *7 |
| `showGrid` | | | ✓ | ✓ | ✓ | `false`: no grid lines — see *7 |
| `yLabels` | | | ✓ | ✓ | ✓ | `inside`: the Y labels inside the plot, which takes the whole width — see *7 |
| `defaultTimeRange` | `hours_to_show` | | ✓ | | | The time range shown when the card opens — see [Time range](#time-range) |
| `defaultMagnifierMode` | | | ✓ | | | What the magnifying glass's box zooms when the card opens: `x` the time, `y` the Y axis, `xy` both (default) |
| `tooltip.size` | `tooltipSize` | | ✓ | | | Every tooltip's size: `full`, `compact`, `slim`, `auto` (default: by the card's width) |
| `tooltip.showDuration` | `tooltipShowDuration` | | ✓ | | | `true`: a timeline's or arrowline's state lasted this long, after its time in the tooltip |
| `tooltip.showColorsLine` / `tooltip.showColorsTimeline` | `showTooltipColorsLine` / `showTooltipColorsTimeline` | | ✓ | | | `false`: no color boxes in the tooltips of every graph but timelines / of timelines |
| `timeTicks.density` | `timeTickDensity` | | ✓ | | | The time ticks' base density: `low`, `medium`, `high` (default), `higher`, `highest` |
| `uiColors.gridLines` / `uiColors.cursorLine` | `uiColors.gridlines` / `uiColors.cursorline` | | ✓ | | | The color of the grid lines / of the cursor line |
| `enablePersistence` / `enableMultidevicePersistence` | `enable_persistence` / `enable_multidevice_persistence` | | ✓ | | ✓ | What's remembered on this device / also synced across your devices — see [Persistence](#persistence) |
| `labelsVisible` | | | ✓ | | | `false`: no names left of the timelines' rows |
| `look` | | | ✓ | | | `mini`: a set of default options at once — see [Values over a graph](#values-over-a-graph-look-mini) |
| `entityOptions` | | | ✓ | | | Targeted defaults by entity id, device class, domain, or glob pattern — see *3 |
| `filterEntities` / `excludeFilterEntities` | | | ✓ | | | Limit which entities appear in the entity picker — see *4 |
| `exclude` | | | | ✓ | ✓ | Exclude specific matches from a wildcard `entity:` pattern — see *4. Graph-level and entity-level excludes combine rather than override |

*2 — `height` on the card sets the height of every line and bar graph; `lineGraphHeight`/`barGraphHeight` (see [UI configuration](#ui-configuration)) still set their own, and win over it.

*3 — `entityOptions` accepts any property marked ✓ in the **Entity** column above, targeted by entity id, device class, domain, or glob pattern instead of repeating it on every entity.

*4 — `filterEntities`, `excludeFilterEntities` and `exclude` each accept a single string, a list of strings, or (for `exclude`) the object form `{entity: '...'}` — see [Adding entities](#adding-entities).

*5 — `circular`: absent (or `none`) detects angles automatically (unit exactly `°`, or state class `measurement_angle`: period 360; an attribute in `°` only when it's a direction, like `wind_bearing`), `false` turns it off, a number or numeric string (`360`, `6.28`) sets the period, `2pi` sets 2π. On an arrowline, it sets what a full turn of the arrows is (360 without a period).

*6 — `scale` and `valueFactor` both multiply the values. `scale` is the factor itself; without `unit` it only changes how the curve is drawn (to make it visible next to larger values, or to flip it with a negative factor): the legend and tooltip show the entity's real value. With `unit`, `scale` is a conversion into that unit, and the legend and tooltip show the converted value — e.g. `scale: 0.001` and `unit: kW` for a power in W. `valueFactor` is a power of 10, and multiplies what is drawn **and** shown, with or without `unit`: `valueFactor: -3` is `scale: 0.001` with the entity's own unit. 📖 [Scaling values](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#scaling-values-scale-unit-and-valuefactor)

*7 — an option of the graph itself (its Y axis, its stacking, its bars' spacing, its height, its time labels, its grid, its Y labels): set on an entity or in `entityOptions`, it applies to the graph the entity is shown in; the graph's own value wins.

An option is spelled the same at every level, and its aliases — the names and values in the table — are accepted everywhere. A graph's options can be set under its `options:` or on the graph itself (`options:` wins).

📖 [Entity options](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#entity-options) · [full-reference-config.yaml](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/full-reference-config.yaml) — every option, at every level, with its default

---

## UI configuration

```yaml
type: custom:history-explorer-card
header: 'My history'   # ' ': none, its room kept; hide: none at all
uimode: dark           # force dark or light mode
cardName: my-card      # required with several cards on the same dashboard
hour24: true           # the 24-hour clock (false: the 12-hour one; not set: Home Assistant's setting)

uiColors:
  gridLines: '#ff000040'
  labels: green
  buttons: '#80f00050'
  cursorLine: '#ff000080'
  selector: 'rgba(255,255,255,255)'
  closeButton: '#0000001f'  # the bar interval selector's background

uiLayout:
  toolbar: top         # top, bottom, both, hide
  selector: bottom
  sticky: top          # keep the toolbar visible while scrolling
  invertZoom: true     # swap the magnifiers − and +
  interval: hide       # hide the bar interval selector

labelAreaWidth: 65
lineGraphHeight: 250
barGraphHeight: 150
timelineBarHeight: 24
timelineBarSpacing: 40
legendVisible: false      # no legend (auto: only for several curves)
stateColorSeed: 137       # seed for automatic state colors

cursor:                   # the vertical line following the pointer
  mode: all               # auto (the graph pointed at), all (every graph), hide
  types: [line, timeline] # default: timelines

timeTicks:
  density: high           # low, medium, high, higher, highest
  densityOverride: higher # force this level
  dateFormat: short       # normal (default) or short
```

**A narrow card** — under 300 px wide (two cards side by side on a phone), the card keeps its graphs readable, as mini-graph-card does: the toolbar on several lines, the Y labels inside the plot, the text a little smaller, the legend's names shortened, a slim tooltip.

📖 [Configuring the UI](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#configuring-the-ui)

---

## CSV export

The options menu (▾), *Export ▸ History* or *Statistics*. Not available in the HA Companion app.

```yaml
csv:
  separator: ';'
  timeFormat: 'DD/MM/YYYY HH:mm:ss'
  statisticsPeriod: hour
  exportAttributes: true
  numberLocale: 'en-US'
```

📖 [Exporting data as CSV](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#exporting-data-as-csv)

---

## YAML graphs

```yaml
type: custom:history-explorer-card
graphs:
  - type: line
    title: Temperatures
    options:
      ymin: -10
    entities:
      - entity: sensor.outside_temperature
        color: '#3e95cd'
      - entity: climate.salon
        attribute: current_temperature   # an attribute; forecast.0.temperature: a sub-attribute
  - type: timeline
    title: Doors and motion
    entities:
      - entity: binary_sensor.door_barn
        name: Barn door
      - entity: binary_sensor.pir_*      # a wildcard
```

An attribute that is a number is shown as a curve, in the unit Home Assistant shows it in (`unit:` to set it), from the history only (Home Assistant keeps no statistics of attributes); anything else as a timeline.

📖 [YAML configuration](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#yaml-configuration-for-preconfigured-graphs) · [Attributes](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#attributes)

---

## Running as a sidebar panel

Add an empty dashboard with **Show in sidebar** checked, set the view type to **Panel (1 card)**, and add the history explorer card.

📖 [Running as a panel in the sidebar](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#running-as-a-panel-in-the-sidebar)
