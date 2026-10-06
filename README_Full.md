[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/v/release/Cook23/history-explorer-card?style=for-the-badge)](https://github.com/Cook23/history-explorer-card/releases)
[![GitHub stars](https://img.shields.io/github/stars/Cook23/history-explorer-card?style=for-the-badge)](https://github.com/Cook23/history-explorer-card/stargazers)
![Experimental](https://img.shields.io/badge/status-experimental-yellow?style=for-the-badge)

<a href="https://buymeacoffee.com/thierry_couquillou" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50"></a>

# History explorer card

> **This is a custom history card for Home Assistant. it is a fork of [SpangleLabs/history-explorer-card](https://github.com/SpangleLabs/history-explorer-card)** (itself a fork of the original [alexarch21/history-explorer-card](https://github.com/alexarch21/history-explorer-card), archived March 2024), based on its version 1.0.54. The first version of this fork is 1.1.0 — see [Differences from upstream](#differences-from-upstream).

> For a shorter, user-focused version of this documentation, see [README.md](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README.md).

This card offers a highly interactive and configurable way to view the history of your entities in HA. The card uses asynchronous stream caching and adaptive data decimation to hide the high latency of HA's history database accesses and tries to make it into a smooth interactive experience.

![history-panel-sample](https://user-images.githubusercontent.com/60828821/147441073-5fbdeb2e-281a-4312-84f1-1ce5c835fc3d.png)

---

## Table of contents

- [Differences from upstream](#differences-from-upstream)
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
  - [Enabling persistence](#enabling-persistence-enable_persistence--enable_multidevice_persistence)
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
  - [Persistence for specific entities](#persistence-for-specific-entities)
- [Running as a sidebar panel](#running-as-a-panel-in-the-sidebar)

---

## Differences from upstream

This fork is based on version 1.0.54 of [SpangleLabs/history-explorer-card](https://github.com/SpangleLabs/history-explorer-card); its first version is 1.1.0. Here is what it adds or changes compared with that version — each point is detailed in the sections below. This is the documentation of the **1.2** line, a rewrite of the card's code: what it adds over the 1.1 line is marked **(1.2)**.

### Adding entities

- **Entity selector** — one dropdown on desktop and mobile, showing friendly names and each entity's current state, filtering on both the friendly name and the entity ID (shown in a tooltip). Keyboard navigation (arrows, Enter, Escape); a click on an entry adds it. A wildcard pattern shows its matches in bold and adds them all; an entity already shown is flagged with a tooltip and its graph outlined. `excludeFilterEntities` removes entities from what `filterEntities` lets through.
- **Display type menu** — every entity added goes through it, with the most fitting type pre-selected, so nothing is added before you've checked how it will be shown: *Smart*, *Curve*, *Straight*, *Stepped*, *Bar*, *Direction*, *Timeline* (only *Timeline* for an entity whose state isn't a number). It reopens with a long-press (or a right click) on a label to change the type, choose the curve's interpolation or delete the entity, and in the info panel through a *Type* link. **(1.2)** Its items open submenus — *Display*, *Interpolation*, *Layout* (*Separate*, *Merge back*, *Delete*: every action of a gesture is also in a menu), and *Tests (beta)*: diagnostics of what the browser or app reports (*Pen events*), sent as a report.
- **YAML** — wildcard entities added in natural alphabetical order; `exclude`, `filterEntities` and `excludeFilterEntities` accept a string, a list of strings or the `{entity: ...}` form; a malformed entry is logged in the browser console and skipped instead of breaking the whole card.

### Organizing graphs

- **Combining by unit** — with `combineSameUnits`, entities added from the card with compatible units, SI prefixes included (W and kW), share one graph; each value is shown in its own unit. A graph defined in YAML always shows all its entities together, whatever their units, bars and curves included (the curves drawn over the bars). **(1.2)** Two groups of units get a Y axis each, left and right (`yAxis` chooses the side), the curves of the right one marked ▸ in the legend.
- **Editing on the graphs** — a double-click on a label takes the curve into its own graph; a curve of a YAML graph, or one changed to a type its graph can't show, goes to a *linked* graph (chain icon), merged back by a double-click on the chain or by dragging the label back. Labels are dragged to reorder curves or move them to another graph, graphs by their ⠿ handle; timeline and arrowline labels the same way. A drag shows a ghost, insertion markers and the target graph highlighted, scrolls the page near its edges, and a refused drop says why. On a touch screen, a swipe on a graph always scrolls the page: a drag starts with a tap, then a second press within half a second. **(1.2)** A long-press or a right click on a graph's ⠿ zone opens its menu (the Y axis lock, merge back, cut, delete), and *Cut* — of a graph, or of a curve from its type menu — then shows in every graph's ⠿ zone where it can go: everything a drag does can also be done from the menus.

### Drawing

- **Line modes** — `smart` draws a curve while the sensor reports and flat dashed plateaus over its silences; `lines` and `stepped` pass exactly through every value (no overshoot); `curves` uses a monotone cubic by default, and the `interpolation` option chooses among four algorithms. Rounded corners and line ends. `line`, `curve` and `step` are accepted for `lines`, `curves` and `stepped`.
- **Angles** — drawn without jumps at 0/360, automatically for `°` and `measurement_angle` (`circular` option); arrowlines turn by the same period.
- **`scale` and `unit`** — `scale` alone only changes how a curve is drawn, the real value being shown; with `unit`, it's a conversion into that unit.
- **Display options** — `showMinMax` (min/max band from long-term statistics, or over the whole graph), `showPoints` (dots at each value, with a radius), `dashMode` with a custom dash array.
- **The first point of a graph** is placed at the real time of the last known state, instead of at the left edge of the graph.
- **Colors (1.2)** — `color` takes a value or an entity holding it: a color (CSS, CSS variable, RGB triplet), thresholds on curves and bars alike (number keys, states, `default`), thresholds on the value of another entity (`entity:`), or an entity whose state holds the color; evaluated at each point, along that entity's history; the legend shows the color now.

### Y axis

Dragging the label area pans the Y axis; a two-finger vertical pinch zooms it (a horizontal one zooms the time); `ylock` locks it against any interactive change; `axisAddMarginMin` / `axisAddMarginMax` add a margin below and above the curves. **(1.2)** With two Y axes, dragging the labels of one moves that one; Shift, the pinch and the padlock act on both.

### Touch, pen and mouse (1.2)

- **Touch** — a swipe on a graph always scrolls the page, wherever it starts; to drag a label, a graph or the Y axis, tap it, then press it again within half a second and drag; a pinch zooms the time and the Y axis, and pans both.
- **Tooltip** — it opens on a click or a tap on the curves, then follows the mouse (or a pen held above the screen) until the pointer leaves the curves; hovering alone no longer opens it.
- **Pen** — the tip works as a finger; where the browser passes its button on (Chrome, the Home Assistant app), a tap with it held on a label opens the type menu.
- **Right click** on a label opens its type menu, as a long-press does; the browser's own menu never opens on a graph.
- **Labels** are picked when touched just beside them, never when the touch is about halfway between two.

### Options

Every display option can be set on the card, in `entityOptions`, on a graph and on an entity, the most specific one winning; the options of a graph (its Y axis, height, stacking, time labels) can be set on its entities too. Every spelling of an option is accepted at every level. `entityOptions` also takes a list form, matching entities by pattern, entity ID, device class or domain. The automatic refresh is on by default, and reloads the recent history at most once every 2 seconds.

### Persistence

What is changed from the card is saved in your Home Assistant user account and synced across your devices, browser storage being kept as a fallback. Entities added from the card are remembered by default; for the entities, time range and graph order defined in YAML, `enable_persistence` (this device) and `enable_multidevice_persistence` (every device) turn it on, card-wide or field by field. Between the YAML, this device and your other devices, the last one to speak wins. `defaultInfoPanel` and `defaultTimeRange` follow the same rule.

### Interface

The toolbar adapts its layout to the card's width; menus and tooltips stay within the card and the screen; the graph tooltip is an HTML element, readable at any size.

### Info panel

**(1.2)** Loaded through `frontend: extra_module_url`, the card's file puts the info panel in an entity's popup on every page of Home Assistant, not only once a dashboard was shown; switching the panel on or off no longer reloads the page, and a new browser or device takes the choice from your Home Assistant user data.

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

Click or tap a chart line or a state timeline to get a tooltip of the selected values or state.

The tooltip then follows the mouse — or a pen held above the screen, in the browsers that report it — as you move over the curves, until the pointer leaves the curves (or the pen moves away from the screen); hovering alone never opens it.

**With a pen**, the tip works as a finger (a swipe scrolls the page, tap then press again to drag, double tap, long-press). Its button isn't passed on to web pages by every browser: in Chrome and the Home Assistant app (Android), a tap with it held on a label opens its type menu, as a right click does; elsewhere, a long-press does the same. To see what your browser or app reports of a pen, and report it: type menu, *Tests (beta) ▸ Pen events*.

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

Selecting an entity (by click, or by the second Enter) doesn't add it right away: the display type menu opens first, the most fitting type pre-selected — line (*Smart*, *Curve*, *Straight* or *Stepped*), *Bar*, *Direction* or *Timeline*. Nothing is created in the graph or persisted until a type is picked; the choice both sets the type and performs the add in one step. The menu always opens, even for an entity whose state isn't a number (on/off, text…): it then only offers *Timeline*, the only way to show it, and lets you check before adding. See [Choosing an entity's display type](#choosing-an-entitys-display-type) below for the full behavior, including long-press access on existing labels and the wildcard "Default" option.

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
Entities matching `filterEntities` can in turn be excluded with `excludeFilterEntities`, applied after it and using the same string/list/wildcard syntax. This is useful when a broad `filterEntities` pattern also picks up one or two entities that shouldn't be included:
```yaml
filterEntities: '*power*'
excludeFilterEntities:
  - 'sensor.power_supply_test'
```

Dynamically added entities can be individually removed by clicking the `x` close button next to them or all together using the option in the entity action dropdown menu:

![image](https://user-images.githubusercontent.com/60828821/186549959-cd3705b6-229a-46c5-abcf-6a9f3b675f0b.png)

### Choosing an entity's display type

An entity whose current state can be read as a number can be shown as a line (*Smart*, *Curve*, *Straight* or *Stepped*), as bars (*Bar*), as direction arrows (*Direction*, the `arrowline` type) or as a timeline (*Timeline*); any other entity only as a timeline.

The type menu has four items, each opening its submenu over the menu, level with it — its right edge on the menu's right edge; the item whose submenu is open is in bold:
- **Display ▸** — open as soon as the menu opens: *Smart*, *Curve*, *Straight*, *Stepped*, *Bar*, *Direction*, *Timeline*;
- **Interpolation ▸** — for a curve shown in *Smart* or *Curve*: how the curve is drawn between its values (see [Curve interpolation](#curve-interpolation)), the algorithm in use in bold; the choice is saved with the entity;
- **Layout ▸** — opened by a long-press on a label: *Separate* (the entity taken out into its own graph, as a double-click on its label), *Merge back* (a linked graph put back into the one above, as a double-click on the chain icon), *Cut* (the entity moved to another graph, as a drag — see [The graph menu, cut and paste](#the-graph-menu-cut-and-paste)), *Delete* (the entity removed from the card).
- **Tests (beta) ▸** — diagnostics run where the card is shown (browser, Home Assistant app), to report what that system gives the card: *Pen events* lists what the browser reports of a pen (hover, its button, a long press) on two test zones; the report can be copied or sent as a GitHub issue — with the device, the system and the browser or app used.

Click an item, or press Enter or → on it; ← or Escape goes back to the menu.

The type menu opens:

- **Right after selecting a brand-new entity** from the dropdown (click, or second Enter) — always, even when *Timeline* is the only choice, so you can check before it's added. Nothing is added to the graph or to persisted configuration until a type is picked — the choice both defines the type and performs the creation in the same action. The most fitting type is pre-selected in bold in *Display* — Enter right away adds it, the arrow keys first highlight it and then move through the other choices:
  - a state that isn't a number (on/off, text…) — timeline, the only possible display (the menu offers nothing else);
  - the entity's own `entityOptions` `type` / `lineMode`, when set;
  - an angle (`circular`: unit exactly `°`, or state class `measurement_angle`) — direction arrows;
  - a quantity that only adds up (energy, gas, water, volume: state class `total_increasing`, or `total` with such a device class or unit) — bar;
  - no unit and not a measurement — timeline;
  - any other measurement — line, in smart mode (or in the card's own `lineMode` when it's set: `lineMode: curves` at the card level pre-selects *Curve*).
- **On a long-press** (or a right click) of a legend label on a line/bar graph, or of an entity label on a timeline/arrowline graph — to change the type of an entity that's already added, or change its layout (**Layout ▸**).
- **When re-selecting an entity that's already present** in a graph — same effect as the long-press, reached via the entity selector instead.

For a **wildcard match** (multiple new entities added at once), *Display* gets an extra **"Default"** entry at the top, pre-selected by default:
- Choosing **"Default"** creates each matched entity with its own individually auto-detected type — exactly as if each had been added on its own.
- Choosing any other option applies that single type to every entity in the batch — except for an entity whose state isn't a number, always created as a timeline. When no entity of the batch has a number as its state, the menu only offers *Timeline*.

Keyboard use: in a submenu, ArrowUp/ArrowDown moves a highlight between the options (starting from the pre-selected one), Enter confirms; pressing Enter without moving the highlight confirms the pre-selected/default option directly.

The type chosen this way is persisted the same way as everything else added through the UI — synchronized with your HA user account and restored across all devices.

In the [info panel](#overriding-the-ha-more-info-history-info-panel), a **"Type"** text link appears between the date and range selectors when the panel's entity has a number as its state, opening the same menu.

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

A graph defined manually in the YAML always shows all its entities on the same graph, whatever their units of measure (or lack of one) — it's the YAML author's explicit choice. Line and bar graphs have up to two Y axes, one per group of compatible units: with two groups (a power in W and kW, and a temperature), the first one is on the left, the second one on the right, each with its own scale and title, and the curves of the right axis are marked with a small arrow ▸ in the legend. `yAxis: left` or `yAxis: right` on an entity (or in `entityOptions`) puts it on that side whatever its unit; on a graph or on the card it applies to every curve that doesn't set its own — `yAxis: left` on a graph keeps it on one axis, and `yAxis: auto` on an entity brings back the choice by unit. `ymin`, `ymax` and `ystepSize` apply to both axes. Linked graphs keep the same room on the right when one of them has a right axis, so that their time stays aligned. With more than two groups of units, the curves share one Y axis whose title is left empty; the legend and the tooltip still show each entity's value in its own unit. When their values aren't of the same order (a value between 0 and 1 next to one up to 1000), the small one looks flat — use `scale:` to bring it to comparable values (a negative factor flips it). The legend and tooltip keep showing the entity's real value, unless `unit:` is set too (see `scale` in the entity options). Lines and bars share one chart too (the curves drawn over the bars, see [Bar graphs](#bar-graphs-for-total-increasing-entities)). Only timeline and arrowline entities can't share a chart with anything else: they are shown as separate *linked* graphs, see below.

![image](https://user-images.githubusercontent.com/60828821/156686448-919cbd9c-4e77-4efc-a725-e53a7049a092.png)

#### Ungrouping a curve

A curve can be extracted from a grouped graph by double-clicking its label in the legend. The curve will be re-drawn as its own graph, placed immediately below the original. The ungrouped state is remembered in the HA user storage (with browser local storage as fallback) and survives a page refresh. Double-click another label on the same graph to extract further curves one by one.

On a graph defined in the YAML, double-clicking a label also shows that curve in its own graph right below, but the new graph stays *linked* to the YAML graph (see *Linked graphs* below) so it can be put back at any time, whatever its unit. Whether this split survives a page refresh follows the card's persistence options for YAML entities (`enable_persistence` / `enable_multidevice_persistence`, the `groupId` field) — by default the YAML layout is restored on reload.

A long-press (or a right click) on a legend label instead opens the [display type menu](#choosing-an-entitys-display-type) for that entity.

#### Linked graphs

Graphs sharing the same group are shown as a solid block with a chain icon 🔗 between them, on the left. A group gets split into several linked graphs either by a double-click on a YAML graph's label (see above) or by changing an entity's display type to one its graph can't show (a timeline or arrowline can't share a chart with lines or bars; lines and bars can).

Graphs added from the UI work the same way: changing a curve's display type to one its graph can't show (e.g. a line into a timeline) moves it to a new graph linked to its original one, and changing its type back to a compatible one returns it to that original graph. A double-click on a label of a graph added from the UI, on the other hand, takes that curve out of its group entirely (no link).

Within a group, curves can always be shown together again, as long as their display types match:
- **Drag** a curve (or timeline entity) label onto another graph of the same group
- **Double-click** the chain icon to merge the graph below it into the graph above it

#### Moving curves between graphs

A curve can be moved to another graph by dragging its legend label and dropping it onto the target graph. **(1.2)** Any line or bar graph accepts it, whatever its unit — lines and bars mixed, a graph defined in YAML included, in or out of a group of linked graphs; a second group of units gets the right Y axis, more groups share one axis (see *Y axis*). Only the display type limits a drop: a curve can't go onto a timeline or arrowline graph, nor a timeline entity onto a line or bar graph — the drop is refused with a brief tooltip (e.g. `line ≠ timeline`). Units only matter when an entity is added: `combineSameUnits` only joins compatible ones on its own. The curve's color is preserved; if it conflicts with a color already in use on the target graph, a free color from the default palette is assigned automatically. On a touch screen, tap the label, then press it again within half a second and drag.

**(1.2)** A drop is saved only when the placement of both graphs is (the `entities` persistence of their entities, see *Persistence*). A graph defined in YAML saves nothing by default: a curve dropped onto it, or taken out of it, is saved where it was before the drop, so a reload brings both graphs back as they were — nothing duplicated, nothing lost. Dropped back into its own graph, the curve is saved there again.

#### Reordering curves within a graph

Curve labels in the legend can be dragged left or right to change their display order within the same graph. The new order is synchronized with your HA user account.

#### Reordering graphs

Graphs can be reordered by dragging on the ⠿ symbol at the top left of each graph (a 30 px wide zone). Drag a graph up or down and drop it onto another graph: releasing above the midpoint of the target inserts it above, releasing below the midpoint inserts it below. A simple click on that same area toggles the Y axis lock. The new order is synchronized with your HA user account. On a touch screen, tap the ⠿ symbol, then press it again within half a second and drag.

Linked graphs (same group, chain icon) always form one solid block: another graph can't be dropped between them, and moving one of them outside of its block moves the whole block along, keeping its internal order. Moving a graph within its own block just reorders it there.

When dragging a graph or a curve near the top or bottom edge of the screen, the page scrolls automatically to allow reaching graphs that are not currently visible.

#### The graph menu, cut and paste

**(1.2)** A long-press (or a right click) on the ⠿ zone of a graph opens its menu. It is one zone: a click there toggles the Y axis lock, a drag moves the graph, a long-press opens the menu — so that what a gesture does there is also in a menu:
- **Lock the Y axis** / **Unlock the Y axis** — as a click on the padlock (not on a timeline or arrowline graph, which have no lock);
- **Layout ▸** — open with the menu: *Merge back* (a linked graph put back into the one above, as a double-click on the chain icon), *Cut* (the graph moved elsewhere, as a drag of its ⠿ zone), *Delete the graph* (a graph added from the card, as its × button).

*Cut* is also in the *Layout* submenu of a curve's or a timeline entity's type menu. Once something is cut, the ⠿ zone of every graph shows where it can go, instead of the ⠿ symbol and the padlock:
- a curve or an entity: 📋 — click it to paste it into that graph, at the end of its legend, exactly as a drop there (same rules: any line or bar graph for a curve, saved only when both graphs are);
- a graph: ↓ 📋 ↑ — ↓ inserts it below that graph, ↑ above it, as a drop below or above its midpoint; a swipe down or up on them does the same (on a touch screen, that swipe doesn't scroll the page); a block of linked graphs moves as a whole, and nothing is inserted inside another block.

A choice that isn't possible is greyed and struck through in red; clicked, it says why, and the cut goes on. ✂ marks the graph it was cut from — clicked, the cut is cancelled. A click anywhere else on the card or the page, or Escape, cancels it too.

#### Timeline and arrowline entity management

Entities in timeline and arrowline graphs can also be reorganized interactively:
- **Double-click** an entity label to extract it into its own graph, placed immediately below the original
- **Long-press** (or right click) an entity label to open the [display type menu](#choosing-an-entitys-display-type)
- Drag an entity label to move it to another graph of the same type
- Drag an entity label up or down to reorder it within the same graph (on a touch screen, tap it, then press it again within half a second and drag)
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

Switching the info panel on or off applies the next time an entity's popup shows its history, without reloading the page. The choice is saved for your Home Assistant user: a browser or a device where no card was shown yet uses it too.

### On every page of Home Assistant

The card's file is a dashboard resource: Home Assistant only loads it once a dashboard is shown. A page opened directly in a new tab — Settings → Entities, History, Logbook… — shows Home Assistant's own history in an entity's popup until a dashboard has been opened. To have the info panel on every page, load the card's file as soon as Home Assistant starts, in `configuration.yaml`:

```yaml
frontend:
  extra_module_url:
    - /hacsfiles/history-explorer-card/history-explorer-card.js?hacstag=...
```

Restart Home Assistant, then reload the page.

**About `?hacstag=…`** — it isn't required: `/hacsfiles/history-explorer-card/history-explorer-card.js` alone works. It's a tag HACS adds to the URL of the card's dashboard resource, and changes at each update, so that browsers fetch the new version. Using **exactly** that URL (*Settings → Dashboards → ⋮ → Resources*), tag included, is still the better choice:
- the browser runs a file only once per URL: with the same URL as the resource, the card's file is loaded once; with another one, it's loaded twice — harmless (the card is made for it), only heavier;
- with the tag, the browser fetches the new version after an update; without it, it may keep using a copy from its cache for the info panel until the page is fully reloaded.

After each card update through HACS, copy the resource's URL into `extra_module_url` again.

### What the info-panel supports

The info-panel renders a single interactive line, bar, timeline or arrowline graph for the selected entity, using the same rendering engine as the main card. All interactive features are available:

- Pan left and right through time by dragging the graph
- Zoom in and out using the time range selector or the mouse wheel with CTRL
- Y axis lock and interactive Y axis pan (drag on the left label area, cursor changes to `↕`)
- With two fingers on a touch screen: vertical pinch zooms the Y axis, horizontal pinch zooms the time, moving both fingers pans
- Tooltip on a click or a tap, then following the pointer
- The display type menu and its Interpolation submenu, through the *Type* link (when the entity's state is a number)
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

Bar charts use the `bar` chart type and can be used in both dynamically and statically added entities by setting the type accordingly. When adding an entity from the card, the type menu pre-selects *Bar* for energy, gas, water or volume that adds up (state class `total_increasing`, or `total` with such a device class or unit); any other entity can be shown as bars by picking *Bar* in the menu, or with `type: bar`.

Use the selector on the top right of the graph to choose the time interval your data is displayed at. You can add the same entity multiple times in separate graphs with different intervals. Selecting *Raw line* will show the raw data of the bar entities as curves; selecting an interval again turns them back into bars. The default interval is hourly. It can be overridden using the `interval` option. Possible values are `10m`, `hourly`, `daily` or `monthly`.

Example configuration of a bar chart display for the entity `sensor.rain_amount` when added dynamically. The default interval is 10 minutes and the type is explicitly set to `bar`, so that the entity is shown as bars without picking it in the type menu.

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

#### Bars and curves on the same graph

A bar graph can also hold line entities: their curves are drawn over the bars, with their own line mode (`curves`, `smart`...). The interval and *Raw line* only apply to the bars, and `stacked` only stacks the bars — curves are never stacked. This happens with a YAML graph mixing both (no `type:`), when a curve's display type is changed to bars (it stays in its graph), or when a curve is dropped onto it. An entity added from the UI never joins a graph of the other type on its own.

```yaml
graphs:
  - options:
      interval: hourly
    entities:
      - entity: sensor.energy_consumed      # total_increasing (kWh) → bars
      - entity: sensor.power                # measurement (W) → curve
        lineMode: smart
        scale: 0.001                        # W → kW, comparable with the kWh bars
        unit: kW                            # the unit shown in the legend and tooltip
```

Bars and curves follow the same rule: energy bars and a power curve, two groups of units, get an axis each — the bars on the left, the curve on the right. Compatible units (W and kW...) share an axis, converted automatically.

Set the `stacked` option to `true` to display the bars on top of each other rather than side by side (with two Y axes, the bars of each axis are stacked in a column of their own):

![image](https://github.com/alexarch21/history-explorer-card/assets/60828821/715f0416-6b4f-4b0d-869b-c732e7f2dd8d)

#### Colors

The `color` of a curve or of bars is a value, or an entity holding that value. The same values are accepted everywhere — in a graph's entity, in `entityOptions`, and in the state of an entity:

- **a color**: any CSS color (`red`, `#3e95cd`, `#3e95cd80`, `rgb(62, 149, 205)`, `rgba(...)`, `hsl(...)`), a CSS variable (`--my-special-green`), or an RGB triplet: `[62, 149, 205]`, also written `62, 149, 205` or `(62, 149, 205)`;
- **thresholds** on the value shown: key / color pairs, as many as you want. A number key is a threshold: a value takes the color of the highest threshold at or below it — below every threshold, the lowest one's. Any other key is a state, compared exactly as it is written (case included): `heat: red`. `default` is the color of every value they don't cover. A curve is colored point by point, bars bar by bar (by the value of each bar). The keys can be quoted or not (`0: blue`, `'1.0': green`);
- **thresholds on the value of another entity**: the same, with an `entity` key — they compare that entity's value (a number or a state) instead of the value shown, at each point: for a heat pump's power, its mode (`heat: red`, `cool: blue`);
- **an entity** (its entity_id): its state holds one of the above, as text — a color, a triplet, or thresholds written as JSON (`{"0": "blue", "20": "red"}`) or as a Home Assistant template writes a dictionary (`{0: 'blue', 20: 'red'}`).

With an entity — thresholds on its value, or holding the color — the curve takes, at each point, the color that applied at that time: the entity's history is loaded with the card's, and the curve follows when it changes.

```yaml
entityOptions:
  energy:           # apply this color coding to all sensors of the energy device class (also works for domains or individual entities)
    type: bar
    color:
      '0.0': blue   # Bar is blue between below and up to 1.0 kWh
      '1.0': green  # Bar is green between 1.0 - 1.5 kWh
      '1.5': red    # Bar is red at 1.5 kWh and above
graphs:
  - type: line
    entities:
      - entity: sensor.heat_pump_power
        color:                         # the heat pump's mode at each point
          entity: sensor.heat_pump_mode
          heat: red
          cool: blue
          default: grey                # any other mode (off, fan...)
      - entity: sensor.living_room_temperature
        color: sensor.heating_color    # an entity holding the color itself
```

The color held by an entity can be set by a template sensor, for instance from the heating's mode:

```yaml
template:
  - sensor:
      - name: heating color
        state: "{{ {'heat': 'red', 'off': 'grey'}.get(states('climate.living_room'), 'blue') }}"
```

![image](https://user-images.githubusercontent.com/60828821/197369661-9c75c9fe-e33f-4790-8348-8ae103880bfb.png)

- The color is evaluated at each point (each bar): a curve changes color on a point, never between two. Its fill takes the same color, with the transparency of its `fill`.
- The legend shows the color now — as the value shown in the label is the value now.
- When no valid color applies (a value thresholds don't cover and no `default`, the entity holding the color unavailable, its state not a color, or no history of it — an entity holding text has no long-term statistics), the curve takes a color of the automatic palette.
- Two curves of one graph whose `color` you set to the same value both keep it; only a color the card chose itself is changed to tell a curve from the others.

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

Timeline charts are typically used to visualize entities with non-numerical data. When you add an entity from the card, the type menu pre-selects *Timeline* for an entity whose state isn't a number (the only choice then), and for one without unit of measure that isn't a measurement.

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

The Y axis can also be interactively modified. Pressing and holding the `SHIFT` key will unlock interactive zooming and panning of the graph in vertical direction. Pressing your mouse button while holding `SHIFT` over a graph will allow you to drag the graph into both horizontal and vertical directions: the time and the Y axis move together. Using the mousewheel while holding `SHIFT` will change the Y axis scale. When interacting with the Y axis, the axis lock icon will automatically be enabled. Click the icon to go back to the default scale at any time.

**On desktop**, you can also drag directly on the Y axis label area (the left 65px of the graph) to pan the Y scale — the cursor changes to `↕` when hovering over that zone.

**With two Y axes** (see [Grouping multiple entities into a single graph](#grouping-multiple-entities-into-a-single-graph)), dragging the label area of one axis — left or right — pans that axis only. Shift + drag, Shift + wheel and the two-finger pinch move and zoom both axes together, each around its own middle, so the curves keep their positions relative to each other; the padlock locks and releases both.

**On a touch screen**, the same Y axis zone is a touch target: tap it, then press it again within half a second and drag (a swipe on it scrolls the page). Two fingers on a graph zoom and pan: spread or pinch them vertically to zoom the Y axis, horizontally to zoom the time (by the same steps as the zoom buttons), and move them together to pan the time and the Y axis.

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

Four modes are available for line charts: cubic splines, line segments, stepped and smart. Cubic splines (`curves`) are smooth and natural-looking, appropriate for signals already filtered; by default they use a monotone cubic interpolation (Fritsch–Carlson), guaranteed never to overshoot — other algorithms can be chosen with `interpolation`, see [Curve interpolation](#curve-interpolation). Line segments (`lines`) connect data points with perfectly straight segments using zero-tension monotone interpolation — the most faithful representation of the raw data. Stepped mode (`stepped`) displays the raw quantized data as a staircase. Smart mode (`smart`) is described below.

All modes use `borderJoinStyle: round` for constant stroke width at corners and rounded ends.

![image](https://user-images.githubusercontent.com/60828821/148483356-aea06848-13d9-4e1e-bd06-485b44505d48.png)

You can specify the line mode in the YAML global settings. Possible options are `curves` (or `curve`), `lines` (or `line`), `stepped` (or `step`) or `smart`. If the option is not present, the curves of YAML graphs are drawn as `curves`, and an entity added from the UI gets `smart` (the type menu pre-selects it). When it's set, it applies to both: with `lineMode: curves`, entities added from the UI are pre-selected as *Curve* too. To keep a mode for your YAML graphs only, set it under each graph's `options:` (or on each entity) instead.

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

By default, the Y axis of a line chart fits its curves exactly. A small margin can be added below and above them, to give some headroom (bar charts never get it):

```yaml
type: custom:history-explorer-card
axisAddMarginMin: true   # margin below the curves (default false)
axisAddMarginMax: true   # margin above the curves (default false)
```

### Curve interpolation

In `curves` and `smart` modes, the curve between two recorded values is rebuilt by a cubic interpolation. Its algorithm is set with `interpolation` — on the card, in `entityOptions`, on a graph or on an entity — or from the type menu (**Interpolation ▸**):

| `interpolation` | How the curve looks |
|---|---|
| `monotone` (default) | Chart.js' own monotone cubic (Fritsch–Carlson). Never overshoots, but the slope is set to zero at every value where the curve changes direction or repeats a value, and doesn't take the spacing of the values into account: small breaks in the slope, especially with rounded or noisy sensors |
| `steffen` | Monotone too (M. Steffen, 1990): never overshoots, flat only at the real peaks and troughs, slopes weighted by the irregular spacing of the values |
| `makima` | Modified Akima: follows the local trend, stays flat over flat stretches, no break at each small peak; hardly any overshoot |
| `catmullrom` | The slope of the chord through both neighbours: the smoothest, but may overshoot a little around sharp changes |

```yaml
type: custom:history-explorer-card
interpolation: makima
```

An interpolation from Fourier / Shannon reconstruction isn't offered: Home Assistant records a value when it changes, at irregular times, and many sensors jump (a set point, a power switching on) — a band-limited reconstruction would ring around every jump and show values the sensor never had.

### Smart mode: silences shown as flat dashed plateaus

Many sensors report irregularly: every few seconds while something happens, then nothing for minutes or hours. `curves` and `lines` then bridge each silence with a long spline or diagonal from the last value before it to the first one after it — suggesting a slow, gradual change that never happened. `stepped` avoids that, but loses the smooth shape of the curve while the sensor reports.

`smart` combines both: a curve (same as `curves`) while the sensor reports at its usual rhythm, and during a silence a flat line at the last known value — drawn dashed — until one usual interval before the next value, where the curve resumes. An ongoing silence (from the last value to now) is drawn the same way.

```yaml
type: custom:history-explorer-card
graphs:
  - type: line
    entities:
      - entity: sensor.heater_power
        lineMode: smart
```

It's also available in the [display type menu](#choosing-an-entitys-display-type) as *Smart*, and like the other modes in `entityOptions` or as the card-wide `lineMode`.

How a silence is detected — the same rules as the [lowpass_dt](https://github.com/Cook23/lowpass_dt) integration, computed in the browser on each curve's recorded values:
- the sensor's usual interval between values is a running average (EMA) of the intervals, started from their median;
- an interval longer than that average plus 3 standard deviations (and at least 1 second) is a silence;
- the curve resumes one average interval before the value that ends the silence.

The threshold adapts along the curve, so a sensor that reports fast during the day and slowly at night gets plateaus only for what's unusual at each moment. The tooltip only ever shows recorded values.

Limitation: Home Assistant only records a new value when it changes, so the card can't tell a silent sensor from one repeating the same value. Both appear as a plateau — which is right either way, since the last value still holds — but the dashes then mean "no new value recorded" rather than strictly "sensor silent".

### Circular values (angles)

A wind direction oscillating around the north goes 3, 2, 1, 0, 359, 358…: drawn as is, the curve jumps across the whole graph at each crossing of 0/360. For angles, the card draws a continuous curve instead — 3, 2, 1, 0, -1, -2 — while the tooltip and the Y axis labels keep showing the real values, in [0, 360) (a point at -1 shows 359).

```yaml
type: custom:history-explorer-card
graphs:
  - type: line
    entities:
      - entity: sensor.wind_direction      # unit °: detected automatically
      - entity: sensor.heading_rad
        circular: 2pi                      # angle in radians
      - entity: sensor.some_angle
        circular: false                    # drawn as is
```

`circular` is set per entity (in `graphs:` or `entityOptions`):
- absent, `null` or `none`: automatic — an entity whose unit is exactly `°` (not `°C`/`°F`) or whose state class is `measurement_angle` is circular with a period of 360;
- `false`: never circular;
- a number or numeric string (`360`, `"360"`, `6.28`): circular with this period; `2pi` (any case, spaces ignored): 2π. Any other value, or a period ≤ 0, turns it off with a warning in the browser console.

The same values as the `circular` option of the [lowpass_dt](https://github.com/Cook23/lowpass_dt) integration.

How it's drawn:
- each value is first brought into [0, period); a step of more than half a period from the previous value is a crossing of 0, and the curve goes on below 0 (or above the period) instead of jumping;
- the whole curve is then placed around its average direction, so a wind around the north is drawn around 0 whatever the start of the time range;
- should the curve go round more than a whole turn over the time range (very unlikely for a wind), it's drawn within a one-turn band centered on its average direction instead, and the jump where it crosses the band's edge is drawn dashed — the same dashes as the [smart mode](#smart-mode-silences-shown-as-flat-dashed-plateaus);
- the Y axis labels show the real values only when every curve of the graph is circular with the same period;
- `ymin` / `ymax` apply as set: with `ymin: 0` and `ymax: 360`, what goes below 0 is cut off at the edge of the graph. The top label of the Y axis shows a whole turn as 360 rather than 0 (0 … 360, or 300 … 350, 0, 10 … 360); anywhere else it's 0.

On an arrowline, `circular` sets what a full turn of the arrows is: with `circular: 2pi`, a value of 1.5708 points east, as 90 does by default; without a period (no `circular`, or `false`) a full turn is 360. An entity with state class `measurement_angle` and no unit is shown as a line, like a `measurement`.

Limitations: Home Assistant's long-term statistics average angles as plain numbers (the mean of 359 and 1 is 180), which the card can't correct; the hourly min/max band of `showMinMax: history` isn't unwrapped.

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

Holding the `Alt` key (or `Option` key on Mac) while moving over a graph reveals all the individual samples making up its curves; moving without it, or leaving the graph, hides them again:

![image](https://user-images.githubusercontent.com/60828821/221272054-abb884df-b95f-4c88-83f0-921ac8709a93.png)

To show them permanently, use `showPoints` (or its synonym `showSamples`) — on the card, in `entityOptions`, on a graph or on an entity. It accepts a boolean or a numeric radius in pixels:

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

### Enabling persistence (`enable_persistence` / `enable_multidevice_persistence`)

By default, nothing about this card's state persists across reloads: the time range always reopens at `defaultTimeRange`, graphs always display in their YAML order, and every static (YAML-defined) entity always shows exactly what YAML says, regardless of any zoom, pan, reorder, or edit made through the UI on any device.

There are two exceptions to that default, because they'd otherwise behave in a way nobody wants:

- **Entities added dynamically through the UI** (not defined in `graphs:`) have no YAML value to fall back to — if nothing remembered them, they'd vanish on every reload. So they default to full persistence (both local and cross-device, see below) instead.
- **The time range and graph order on a card with no static entities at all** — a purely dynamic card has nothing fixed to anchor either of those to, so they default to full persistence too, for the same reason.

Everything else (the time range and graph order on a card that *does* have static entities, and every field of every static entity) defaults to `none`, i.e. always YAML.

Three options let you change any of these defaults explicitly, at the card level (`enable_persistence`/`enable_multidevice_persistence` cover `range`, `entities`, and `order`) or per entity (individual fields only — see below):

```yaml
type: custom:history-explorer-card
defaultTimeRange: 24h
enable_persistence: entities              # this device remembers on its own — no cross-device sync
enable_multidevice_persistence: range     # this device's time range syncs across your devices via HA
```

- **`enable_persistence`** — turns on persistence in local browser storage only. This device remembers its own changes; nothing syncs to or from your other devices.
- **"Last one to speak wins"** — each source that can speak keeps its own image of what it said last: YAML (what YAML said the previous time on this device), your HA account (what this device last received from it — never what it wrote there itself, which may not have landed yet), and this device's own UI. On each load, every source is compared with its own image only; a difference means that source spoke, its image is updated, and its change applies. If YAML and another source both spoke, YAML wins. For an entity, a YAML edit replaces every UI customization of that entity (other entities are untouched); reordering graphs in the YAML counts as a change for every entity of the moved graphs. An option the YAML doesn't set at all (e.g. no `defaultTimeRange`) never speaks. A device opening the card for the very first time (or after its browser storage was cleared) has no image of its own yet: with `enable_multidevice_persistence`, it compares the YAML with the image saved in your HA account, so it gets what your other devices saved — unless the YAML changed since, which then wins there too; with `enable_persistence` alone, it gets the YAML.
- **`enable_multidevice_persistence`** — turns on persistence in both local storage *and* your Home Assistant user account, so this device's changes sync across all your other devices too. Where both options cover the same field, `enable_multidevice_persistence` always wins — that field syncs across devices, `enable_persistence` on the same field only matters for what `enable_multidevice_persistence` doesn't already cover.
- **`none`** — explicitly turns persistence off for a scope that would otherwise default to `all` (e.g. a card with only dynamic entities that you *don't* want remembered), without needing the other option to also be `none`.

Both accept `range`, `entities`, `order` (the display order of your graphs — card-level only, since a position only means something relative to every other graph, not a property of one entity), or `all` at the card level (top-level YAML key, alongside `defaultTimeRange`):

```yaml
type: custom:history-explorer-card
enable_multidevice_persistence: all   # persist everything, synced across devices
```

If your card has only dynamic entities and you'd rather it behaved like a normal fixed dashboard (nothing remembered), turn the default persistence off explicitly:

```yaml
type: custom:history-explorer-card
enable_multidevice_persistence: none   # this device never syncs its dynamically-added entities, range, or order
enable_persistence: none               # ...and doesn't remember them locally either
```

Or keep local memory but drop cross-device sync for a dynamic card:

```yaml
type: custom:history-explorer-card
enable_multidevice_persistence: none   # no HA sync
# enable_persistence left unset — defaults to 'all' for a purely dynamic card, so local memory stays on
```

See [Persistence for specific entities](#persistence-for-specific-entities) for the entity-level syntax (a precise list of fields, or `entities`/`all`/`none`, falling back to the card-level default above when unset — `order` isn't available at this level, see above).

### Auto refresh

The card can reflect changing values on the fly in two ways. Both can be combined if needed.

Automatic refresh monitors the entities that are displayed in your graphs for changes and reloads their recent history — at most once every 2 seconds, however often they change. It's on by default; turn it off with `automatic: false` (the card then refreshes only when the page is reloaded, or at the interval below):
```yaml
type: custom:history-explorer-card
refresh:
  automatic: false
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
    lineWidth: 2
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
| `color` | string, list or object | Line/bar color: a color, thresholds (on the value, or on another entity's), or an entity holding either — see [Colors](#colors) |
| `fill` | string | Fill color under the line |
| `lineWidth` | number | Line width in pixels |
| `lineMode` | string | Interpolation mode: `curves`, `lines`, `stepped`, `smart` |
| `interpolation` | string | Interpolation algorithm in `curves` and `smart` modes: `monotone` (default), `steffen`, `makima`, `catmullrom` — see [Curve interpolation](#curve-interpolation) |
| `dashMode` | string or array | Stroke style: `points`, `shortlines`, `longlines`, `pointline`, or custom `[on, off, ...]` array |
| `showPoints` | boolean or number | Show a dot at each measurement point. `true` = radius 4px, or specify a numeric radius. `showSamples` is a synonym |
| `yAxis` | string | `auto` (default), `left` or `right`: the Y axis of a line or bar entity. `auto`: a graph with two groups of compatible units puts the second one on the right; with more, every curve shares the left axis. Also on a graph or the card, for every curve that doesn't set its own |
| `scale` | number | Multiply all values by this factor before drawing. Without `unit`, it only changes how the curve is drawn: the legend and tooltip show the entity's real value. With `unit`, it's a conversion into that unit: the legend and tooltip show the converted value (e.g. `scale: 0.001` and `unit: kW` for a power in W) |
| `unit` | string | Unit shown instead of the entity's own (see `scale`) |
| `hidden` | boolean | Hide this entity by default in the legend |
| `ymin` | number | Set the initial Y axis minimum (can still be modified interactively; restored when padlock is unlocked) |
| `ymax` | number | Set the initial Y axis maximum (can still be modified interactively; restored when padlock is unlocked) |
| `ystepSize` | number | Fix the Y axis tick step size (`ystepsize` is a synonym) |
| `ylock` | boolean | Disable all interactive Y axis pan and zoom for this graph |
| `height` | number | Graph height in pixels (overrides global height settings) |
| `decimation` | string or false | Per-entity decimation mode: `fast`, `accurate`, or `false` to disable |
| `interval` | string | Default bar interval: `10m`, `hourly`, `daily`, `monthly` |
| `netBars` | boolean | Enable net metering mode for bar graphs |
| `stacked` | boolean | Stack bars on top of each other rather than side by side (bar graphs with multiple entities) |
| `process` | string | Javascript expression to transform state values before display |
| `showMinMax` | string or boolean | Display a shaded band between min and max values. See the *Showing the min/max statistical range* section for accepted values. |
| `showTimeLabels` | boolean | Show or hide the horizontal time axis labels on a timeline or arrowline graph. Default is `true`. |
| `exclude` | string, list, or `{entity: ...}` | Exclude matches from a wildcard `entity:` pattern. Also settable under a graph's `options:` — see below |

#### The same options at every level

Every option above, except the ones that only make sense for a single entity (`type`, `color`, `name`, `hidden`, `scale`, `unit`, `process`, `circular`), can be set at four levels: on the card (for every graph), in `entityOptions`, on a graph (for its entities) and on an entity. When an option is set at several levels, the most specific one wins: **entity → graph → `entityOptions` → card**.

The options of the graph itself — `ymin`, `ymax`, `ystepSize`, `ylock`, `stacked`, `height`, `showTimeLabels` — set on an entity or in `entityOptions`, apply to the graph the entity is shown in; the graph's own value wins. `height` on the card sets the height of every line and bar graph; `lineGraphHeight` / `barGraphHeight` set their own and win over it.

An option is spelled the same at every level, and its synonyms are accepted everywhere: `width` for `lineWidth`, `showSamples` for `showPoints`, `ystepsize` for `ystepSize`. A graph's options can be set under its `options:` or directly on the graph, next to `type:` and `entities:` (`options:` wins if both are set):

```yaml
type: custom:history-explorer-card
interpolation: makima          # every curve of the card
ylock: true                    # every graph of the card
graphs:
  - type: line
    lineMode: smart            # same as under options:
    options:
      ylock: false             # this graph only
    entities:
      - entity: sensor.outside_temperature
      - entity: sensor.inside_temperature
        interpolation: steffen # this curve only
```

`fill`, `showMinMax`, `dashMode`, `lineMode`, `interpolation`, `lineWidth`, `showPoints`, `decimation`, `netBars` and `exclude` set on a graph act as the default for every entity in that graph. An entity's own value (if set directly on it) always wins over the graph default. `options.exclude` is the one exception to "most specific wins": it combines with each wildcard entity's own `exclude:` rather than being overridden by it, so both apply together. This is especially useful with several wildcard `entity:` patterns sharing one graph — set the common styling once instead of repeating it on each pattern:

```yaml
type: custom:history-explorer-card
graphs:
  - type: line
    options:
      fill: rgba(0,0,0,0)
      showMinMax: statistics
      exclude: '*fridge*'   # applies to every wildcard entity below
    entities:
      - entity: sensor.*puissance*
      - entity: sensor.*power*
```

On the card, they act as the fallback default when neither the entity, its graph nor `entityOptions` set a value:

```yaml
type: custom:history-explorer-card
lineWidth: 2
dashMode: shortlines
showMinMax: statistics
```

### Pattern-based entity options

`entityOptions` accepts two forms: the **dict form** (keyed by entity id, device class or domain) and a **list form** that supports glob pattern matching. The list form is the recommended approach when you want to apply consistent styling across families of sensors.

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
    lineWidth: 2

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

Use wildcards to automatically add multiple entities. Matches are added in natural alphabetical order (e.g. `sensor.power_2` before `sensor.power_10`) rather than Home Assistant's entity creation order. The following snippet will add all sensors with `temperature` in their name to a line graph, except for entities with `fridge` in their name and the `cpu_temperature` sensor:

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

`exclude` also accepts plain strings, a single string, or a mix of both forms — these are all equivalent to the list above:

```yaml
        exclude: '*fridge*'          # single string
        exclude:                     # list of plain strings
          - '*fridge*'
          - sensor.cpu_temperature
        exclude:                     # mixed forms
          - '*fridge*'
          - entity: sensor.cpu_temperature
```

The same string/list/object forms are accepted by `filterEntities` and `excludeFilterEntities` (see [Adding entities](#adding-entities)). `exclude` can also be set once under a graph's `options:` to apply to every wildcard entity in that graph — see [Complete list of entityOptions properties](#complete-list-of-entityoptions-properties).

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
    lineWidth: 2
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
        lineWidth: 4
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

### Persistence for specific entities

Any static entity inside `graphs:` can declare its own `enable_persistence` and/or `enable_multidevice_persistence`, either as a precise list of fields to cover, or `entities`/`all` as a shorthand for every field, or `none` to explicitly cover nothing — see [Enabling persistence](#enabling-persistence-enable_persistence--enable_multidevice_persistence) for what each option does at the card level. A field without its own entity-level setting falls back to the card-level default for that option — which, for a static entity, is `none` (always YAML) unless the card explicitly says otherwise:

```yaml
graphs:
  - type: line
    entities:
      - entity: sensor.living_room_target_temp
        color: '#3e95cd'
        enable_multidevice_persistence: [color, groupId]   # sync this device's color and grouping choices
                                                             # across your other devices too
      - entity: sensor.boiler_state
        enable_persistence: all                             # this device remembers everything about this
                                                             # entity on its own — no cross-device sync
```

Protectable/coverable fields (`order` isn't one of them — it's card-level only, see [Enabling persistence](#enabling-persistence-enable_persistence--enable_multidevice_persistence)): `type`, `color`, `fill`, `hidden`, `interval`, `name`, `scale`, `siConversionFactor`, `dashMode`, `lineMode`, `interpolation`, `width` (the line width), `showPoints`, `showMinMax`, `unit`, `process`, `netBars`, `decimation`, `circular`, `groupId`. `groupId` also covers how a YAML graph was split into linked graphs (double-click); the order of those linked graphs within their block follows `order`, like the order of everything else.

This entity-level option only applies to static entities defined here in `graphs:`. Entities added dynamically through the UI have no YAML entry to attach it to — they're governed entirely by the card-level `enable_persistence`/`enable_multidevice_persistence` (which default to `all` for a purely dynamic card, see above).

---

## Running as a panel in the sidebar

The history explorer can be run as a sidebar panel. Add a new empty dashboard with the `Show in sidebar` box checked. Set the view type to `Panel (1 card)` and add the history explorer card to the view.

![image](https://user-images.githubusercontent.com/60828821/161340801-f1f97e90-73c4-44d9-8afa-ba858906a2c1.png)
