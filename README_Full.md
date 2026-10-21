[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/v/release/Cook23/history-explorer-card?style=for-the-badge)](https://github.com/Cook23/history-explorer-card/releases)
[![GitHub stars](https://img.shields.io/github/stars/Cook23/history-explorer-card?style=for-the-badge)](https://github.com/Cook23/history-explorer-card/stargazers)
![Experimental](https://img.shields.io/badge/status-experimental-yellow?style=for-the-badge)

<a href="https://buymeacoffee.com/thierry_couquillou" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50"></a>

# History explorer card

> **This is a custom history card for Home Assistant. It is a fork of [SpangleLabs/history-explorer-card](https://github.com/SpangleLabs/history-explorer-card)** (itself a fork of the original [alexarch21/history-explorer-card](https://github.com/alexarch21/history-explorer-card), archived March 2024), based on its version 1.0.54 — see [Differences from upstream](#differences-from-upstream).

> For a shorter, user-focused version of this documentation, see [README.md](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README.md). The main versions and what each one brought: [Version highlights](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README.md#-version-highlights).

This card offers a highly interactive and configurable way to view the history of your entities in HA. The card uses asynchronous stream caching, loads only what the screen can show — the hourly statistics, the 5-minute statistics or the history — and draws no more to hide the high latency of HA's history database accesses and tries to make it into a smooth interactive experience.

![history-panel-sample](https://user-images.githubusercontent.com/60828821/147441073-5fbdeb2e-281a-4312-84f1-1ce5c835fc3d.png)

---

## Table of contents

- [Differences from upstream](#differences-from-upstream)
- [Install and configuration](#install-and-configuration)
  - [HACS](#hacs)
  - [Manual install](#manual-install)
  - [Full configuration reference](#full-configuration-reference)
- [Usage](#usage)
  - [Interactive navigation](#interactive-navigation)
  - [Adding entities](#adding-entities)
  - [Choosing an entity's display type](#choosing-an-entitys-display-type)
  - [Interactive graph management](#interactive-graph-management)
    - [Grouping multiple entities into a single graph](#grouping-multiple-entities-into-a-single-graph)
    - [Ungrouping a curve](#ungrouping-a-curve)
    - [Linked graphs](#linked-graphs)
    - [Moving curves between graphs](#moving-curves-between-graphs)
    - [Reordering curves within a graph](#reordering-curves-within-a-graph)
    - [Reordering graphs](#reordering-graphs)
    - [The graph menu, cut and paste](#the-graph-menu-cut-and-paste)
    - [Timeline and arrowline entity management](#timeline-and-arrowline-entity-management)
  - [Legend / entity labels](#legend--entity-labels)
    - [Showing current sensor values](#showing-current-sensor-values)
    - [Rounding](#rounding)
- [Info panel — replacing the HA more info popup](#info-panel--replacing-the-ha-more-info-popup)
  - [Enabling the info panel](#enabling-the-info-panel)
  - [On every page of Home Assistant](#on-every-page-of-home-assistant)
  - [What the info panel supports](#what-the-info-panel-supports)
  - [Info panel limitations](#info-panel-limitations)
- [Graph types](#graph-types)
  - [Bar graphs for total increasing entities](#bar-graphs-for-total-increasing-entities)
    - [Bars and curves on the same graph](#bars-and-curves-on-the-same-graph)
    - [Net metering](#net-metering)
  - [Timeline charts](#timeline-charts)
    - [Customizing state colors](#customizing-state-colors)
  - [Compass arrow graphs](#compass-arrow-graphs)
- [Colors of curves and bars](#colors-of-curves-and-bars)
- [Scaling values: scale, unit and valueFactor](#scaling-values-scale-unit-and-valuefactor)
- [Y axis scaling](#y-axis-scaling)
  - [Bounds](#bounds)
  - [Two Y axes](#two-y-axes)
- [Line appearance](#line-appearance)
  - [Line modes](#line-modes)
  - [Curve interpolation](#curve-interpolation)
  - [Smart mode: silences shown as flat dashed plateaus](#smart-mode-silences-shown-as-flat-dashed-plateaus)
  - [Circular values (angles)](#circular-values-angles)
  - [Line stroke style](#line-stroke-style)
  - [Displaying individual samples](#displaying-individual-samples)
  - [Showing the min/max statistical range](#showing-the-minmax-statistical-range)
  - [Text states as a curve](#text-states-as-a-curve)
  - [Line graphs and unavailable data](#line-graphs-and-unavailable-data)
  - [Custom data processing functions](#custom-data-processing-functions)
- [Long term statistics](#long-term-statistics)
- [Data decimation and aggregation](#data-decimation-and-aggregation)
  - [Data decimation](#data-decimation)
  - [Aggregation](#aggregation)
- [Values over a graph, a compact look](#values-over-a-graph-a-compact-look)
- [mini-graph-card compatibility](#mini-graph-card-compatibility)
  - [Replacing mini-graph-card](#replacing-mini-graph-card)
- [Default view and time ranges](#default-view-and-time-ranges)
  - [Enabling persistence (enable_persistence / enable_multidevice_persistence)](#enabling-persistence-enable_persistence--enable_multidevice_persistence)
- [Auto refresh](#auto-refresh)
- [Entity options](#entity-options)
  - [Complete list of entityOptions properties](#complete-list-of-entityoptions-properties)
    - [The same options at every level](#the-same-options-at-every-level)
  - [Pattern-based entity options](#pattern-based-entity-options)
    - [Priority rules](#priority-rules)
- [Configuring the UI](#configuring-the-ui)
  - [The options menu](#the-options-menu)
  - [Gesture settings](#gesture-settings)
  - [Header text](#header-text)
  - [Dark mode](#dark-mode)
  - [Customizing the color of UI elements](#customizing-the-color-of-ui-elements)
  - [The cursor line](#the-cursor-line)
  - [Changing the UI layout](#changing-the-ui-layout)
  - [Graph sizes](#graph-sizes)
  - [Configuring the tooltip popup](#configuring-the-tooltip-popup)
  - [The clock](#the-clock)
  - [Changing the horizontal time tick density](#changing-the-horizontal-time-tick-density)
- [Multiple cards](#multiple-cards)
- [Exporting data as CSV](#exporting-data-as-csv)
- [YAML configuration for preconfigured graphs](#yaml-configuration-for-preconfigured-graphs)
  - [Attributes](#attributes)
  - [Persistence for specific entities](#persistence-for-specific-entities)
- [Running as a panel in the sidebar](#running-as-a-panel-in-the-sidebar)

---

## Differences from upstream

This fork is based on version 1.0.54 of [SpangleLabs/history-explorer-card](https://github.com/SpangleLabs/history-explorer-card). Here is what it adds or changes compared with that version — each point is detailed in the sections below.

**Adding entities**

- **Entity selector** — one dropdown on desktop and mobile, showing friendly names and each entity's current state, filtering on both the friendly name and the entity ID (shown in a tooltip). Keyboard navigation (arrows, Enter, Escape); a click on an entry chooses it, as Enter does. A wildcard pattern shows its matches in bold and adds them all; an entity already shown is flagged with a tooltip and its graph outlined — then cancelled, or added as a second curve in another graph (the same entity in several YAML graphs too). `excludeFilterEntities` removes entities from what `filterEntities` lets through.
- **Display type menu** — every entity added goes through it, with the most fitting type pre-selected, so nothing is added before you've checked how it will be shown: *Smart*, *Curve*, *Straight*, *Stepped*, *Bar*, *Direction*, *Timeline* (only *Timeline* for an entity whose state isn't a number). It reopens with a long-press (or a right click) on a label to change the type, choose the curve's interpolation or delete the entity, and in the info panel through a *Type* link. Its items open submenus — *Display*, *Interpolation*, *Layout* (*Separate*, *Merge back*, *Delete*: every action of a gesture is also in a menu), and *Tests (beta)*: diagnostics of what the browser or app reports (*Pen events*) and of what the card costs on the device (*Performance*), sent as a report.
- **Attributes** — an entity's attribute shown as a curve or a timeline, beside its state: `attribute:` in the YAML, or a submenu of the entity selector (*Value*, then the attributes); a number followed by a unit read as that number in that unit; an attribute can also hold or pick a curve's `color`; a sub-attribute too, by its path (`forecast.0.temperature`).
- **YAML** — wildcard entities added in natural alphabetical order; `exclude`, `filterEntities` and `excludeFilterEntities` accept a string, a list of strings or the `{entity: ...}` form; a malformed entry is logged in the browser console and skipped instead of breaking the whole card.

**Organizing graphs**

- **Combining by unit** — with `combineSameUnits`, entities added from the card with compatible units, SI prefixes included (W and kW), share one graph; each value is shown in its own unit. A graph defined in YAML always shows all its entities together, whatever their units, bars and curves included (the curves drawn over the bars). Two groups of units get a Y axis each, left and right (`yAxis` chooses the side), the curves of the right one marked ▸ in the legend.
- **Editing on the graphs** — a double-click on a label takes the curve into its own graph; a curve of a YAML graph, or one changed to a type its graph can't show, goes to a *linked* graph (chain icon), merged back by a double-click on the chain or by dragging the label back. Labels are dragged to reorder curves or move them to another graph, graphs by their ⠿ handle; timeline and arrowline labels the same way. A drag shows a ghost, insertion markers and the target graph highlighted, scrolls the page near its edges, and a refused drop says why. On a touch screen, a swipe on a graph always scrolls the page: a drag starts with a tap, then a second press right away (within the long-press duration). A long-press or a right click on a graph's ⠿ zone opens its menu (the Y axis lock, merge back, cut, delete), and *Cut* — of a graph, or of a curve from its type menu — then shows in every graph's ⠿ zone where it can go: everything a drag does can also be done from the menus.

**Drawing**

- **Line modes** — `smart` draws a curve while the sensor reports and flat dashed plateaus over its silences; `lines` and `stepped` pass exactly through every value (no overshoot); `curves` uses a monotone cubic by default, and the `interpolation` option chooses among five algorithms: `monotone`, `steffen`, `makima`, `catmullrom` and `bspline` (mini-graph-card's smoothing). Rounded corners and line ends. `line`, `curve` and `step` are accepted for `lines`, `curves` and `stepped`.
- **Angles** — drawn without jumps at 0/360, automatically for `°` and `measurement_angle` — for an attribute in `°`, only when its name says it's a direction (`circular` option); arrowlines turn by the same period.
- **`scale`, `unit` and `valueFactor`** — `scale` alone only changes how a curve is drawn, the real value being shown; with `unit`, it's a conversion into that unit; `valueFactor` multiplies by a power of 10 what is drawn and shown.
- **Display options** — `showMinMax` (a lighter min/max band around the mean curve: everywhere, or only where it comes from the statistics, or from the history), `showPoints` (dots at each value, with a radius), `dashMode` with a custom dash array. Over a graph, each curve's value now (`showState`) and its minimum, average and maximum over the window shown (`showStats`); `showGrid`, `yLabels: inside`, `fill: fade`; `look: mini` for the look of mini-graph-card, with a table of how its options translate.
- **The first point of a graph** is placed at the real time of the last known state, instead of at the left edge of the graph.
- **Colors** — `color` takes a value or an entity holding it: a color (CSS, CSS variable, RGB triplet), thresholds on curves and bars alike (number keys, states, `default`), thresholds on the value of another entity (`entity:`), or an entity whose state holds the color; evaluated at each point, along that entity's history; the legend shows the color now.

**Loading**

- **What the screen can show, and no more** — the hourly statistics, the 5-minute statistics or the history, chosen by how long a column of pixels lasts (an hour or more, 5 minutes or more, less — see [Long term statistics](#long-term-statistics)); one point per column, its mean with its min and max (computed from the history as Home Assistant compiles its statistics); a min/max band (`showMinMax`).
- **Every action taken at once**, whatever is loading; real time always ending at the present; a page left open past midnight going on with the new day.
- **mini-graph-card's aggregation** — `pointsPerHour`, `groupBy`, `aggregateFunc` (`points_per_hour`, `group_by`, `aggregate_func`).

**Y axis**

Dragging the label area pans the Y axis; a two-finger vertical pinch zooms it (a horizontal one zooms the time); `ylock` locks it against any interactive change; `axisAddMarginMin` / `axisAddMarginMax` add a margin below and above the curves. With two Y axes, dragging the labels of one moves that one; Shift, the pinch and the padlock act on both.

**Touch, pen and mouse**

- **Touch** — a swipe on a graph always scrolls the page, wherever it starts; to drag a label, a graph or the Y axis, tap it, then press it again right away (within the long-press duration) and drag; a pinch zooms the time and the Y axis, and pans both.
- **Tooltip** — a click or a tap near a curve opens it for that curve (several curves can show theirs), then it follows the mouse (or a pen held above the screen) until the pointer leaves the curves, or a click outside them; hovering alone no longer opens it. A long-press (or a right click) near a curve shows or hides its points.
- **Gesture settings** — for every card and every device: the long-press duration and the distance a pointer moves before it drags, for a mouse or a pen and for a finger (`gestures:`, or the options menu).
- **Pen** — the tip works as a finger; where the browser passes its button on (Chrome, the Home Assistant app), a tap with it held on a label opens the type menu.
- **Right click** on a label opens its type menu, as a long-press does; the browser's own menu never opens on a graph.
- **Picking** — a label, a button, a curve, a bar or a state is picked when touched just beside it (within the pointer's precision, see [Gesture settings](#gesture-settings)), never when the touch is about halfway between two (in the middle third of the gap between them); two on the same pixel are one place, the one drawn on top.

**Options**

Every display option can be set on the card, in `entityOptions`, on a graph and on an entity, the most specific one winning; the options of a graph (its Y axis, height, stacking, time labels) can be set on its entities too. Every spelling of an option is accepted at every level. `entityOptions` also takes a list form, matching entities by a pattern on their entity ID. The automatic refresh is on by default, and reloads the recent data at most once every 2 seconds.

**Persistence**

What is changed from the card is saved in your Home Assistant user account and synced across your devices, browser storage being kept as a fallback. Entities added from the card are remembered by default; for the entities, time range and graph order defined in YAML, `enable_persistence` (this device) and `enable_multidevice_persistence` (every device) turn it on, card-wide or field by field. Between the YAML, this device and your other devices, the last one to speak wins. `defaultInfoPanel` and `defaultTimeRange` follow the same rule. The card is shown at once from what this device saved; your user account is read meanwhile, and what another device changed is taken then (on a device where the card was never shown, the account is read first).

**Interface**

The toolbar adapts its layout to the card's width — the date shortened first when the date and the range don't fit side by side (`20 Oct` for a longer one), the range's name only once they still don't; on a narrow card (a grid or a horizontal stack), the date, the range and the entity search each on a line of their own; menus and tooltips stay within the card and the screen, a tooltip's arrow on its point; the graph tooltip is an HTML element, readable at any size, closed as soon as a menu opens. A legend too narrow for its labels shortens the names, all of a graph's alike, and keeps each value: a qualifier many entities carry as its initials (`(Filtered)` → `(F)`); then the start of the name abbreviated — the entity's device name, or the first words it shares with another curve of the graph (`Météo-France Villeveyrac Temperature (F)` and `Météo-France Villeveyrac Temperature` → `M-F V… Temperature (F)` and `M-F V… Temperature`); the articles removed; that start removed, where two curves don't then read the same; then '…' before the value. The handle, the padlock and the close button are floating icons: they keep room beside the legend's first line when its first label fits there; else they're drawn over the labels, in opaque boxes, and the label takes the whole line — the first line is never left empty. Scrolled under a sticky toolbar or the page's header, they're hidden with the graph. The full name stays in the tooltip. The time labels that wouldn't fit side by side are skipped.

**Info panel**

Loaded through `frontend: extra_module_url`, the card's file puts the info panel in an entity's popup on every page of Home Assistant; switching the panel on or off doesn't reload the page, and a new browser or device takes the choice from your Home Assistant user data.

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

When the card is opened, it will display the history of the configured entities for the last 24 hours starting at the current date and time. On the top left you will find the date selector previous and next buttons, use them to quickly browse through the days. You can use the right side time range selector (dropdown or plus / minus buttons) to zoom into or out of the history. A mouse's drag mostly up or down on a graph draws an elastic box (a finger's or a pen's vertical move scrolls the page) (a drag mostly sideways pans the time): released, the time zooms to it — the round duration that covers it, centred on it — and every Y axis of the graph to its values, the padlock closed; a box narrower or lower than the pointer's precision, or covering 90 % or more of the curves' area that way (it would hardly zoom), leaves that axis as it is — a box the whole height zooms the time only —, and Escape cancels it. The magnifying glass turns green while it's drawn; turned on (a click on it), any drag on a graph's curves draws the same box, with a finger too (the page doesn't scroll from a graph meanwhile). It goes off at the end of the next gesture on a graph — the box, or any other, which then does what it does —, a press outside the graphs, Escape, or a click on it again. Another convenient way to zoom in and out of the graphs is by using the mouse wheel while holding the CTRL key.

**Real time** is the window showing the present, on its right: the curves grow and slide as new values come. The window never goes past the present — dragged towards the future, zoomed, the day after: it stops at the present, and is in real time again; the date selector's `>` is greyed then (there's nothing after). Dragged or moved back, the present is no longer shown: the window stays where it is while new values keep coming, `>` active again. With `defaultTimeOffset`, the present is the time it gives (`1h`: an hour after now, `1D`: the end of the day).

Where a zoom keeps the time window depends on what you're doing:
- **In real time** — the present shown, the window following it: every change of the range keeps the present on the right — the time range selector, the plus / minus buttons, the default range (a double click on the magnifier). The mouse wheel does too when the pointer is in the right 10 % of the graph's plot area, and a pinch when a finger is in its right 20 % at its start or at its end; elsewhere, they zoom around the pointer or the fingers, and the window stops following the present (the date button brings it back).
- **Looking at the history**: the time range selector and the plus / minus buttons keep the middle of the window, whatever the duration; the wheel and a pinch zoom around the pointer or the fingers.

Click or tap on a graph and drag left or right to slide it through time. The card loads what comes into view as you move along (see [Long term statistics](#long-term-statistics)): on a slow database (on an SD card, for example), parts of the window may stay empty for a moment, filled as the data comes in.

The last one to speak wins, whatever is loading: a range chosen, a zoom, a drag, a day before or after, a curve added while the card is still loading is taken at once — the window is the new one, drawn with what's already there, and what it lacks is asked; what was asked for the window before keeps coming and is kept. A page left open past midnight goes on with the new day.

Once you release the mouse button after dragging (or release your finger from the chart), the card will automatically readjust the y axes on all charts to better reflect the new data. The card will also synchronize all other charts in the history to the same point in time. That way you will always see the same time range on all your data and everything will be aligned.

The date shown is the window's first day. Clicking it opens your browser's calendar, that day preselected: the day you choose starts the window shown, the range kept — a day whose window reaches the present brings you back to real time. A double click on the date selector brings you back to the current date and time (real time), without changing your zoom level. A double click on the magnifier brings the range back to the configured default range (`defaultTimeRange`), in real time kept there.

Click or tap a chart line or a state timeline to get a tooltip of the selected values or state. A click or a tap near a curve — not necessarily on one of its values — puts that curve in the tooltip: its value nearest the pointer is shown, and follows the pointer; a click near another curve adds it, so several curves can show their values together. Leaving the curves, or a click outside them, closes it; a click beside the curves changes nothing. On bars and timelines, the bar or the state under the click (or just beside it). A long-press (or a right click) near a curve shows all its points, or hides them — saved with it, as its `showPoints`: the YAML's value or the long-press, the last one to speak winning, kept on this device only (as the card's persistence options say for its fields — never synced across devices). Alt shows every point of the graph hovered on top of that, until it's released or the pointer leaves the graph. Outside the tooltip, hovering a curve (a mouse, or a pen above the screen) shows its value nearest the pointer along the time, its point alone, when the curve's points aren't shown — the curve picked as a click picks it, on its line or just beside it. A text shortened or hidden — a legend's label shortened, a timeline's row name cut, a timeline's state too long for its bar — is shown in full where it is while hovered; a click or a tap on a row name or on a legend label shows it too, for a while.

The tooltip then follows the mouse — or a pen held above the screen, in the browsers that report it — as you move over the curves, until the pointer leaves the curves (or the pen moves away from the screen); hovering alone never opens it.

On a curve, the tooltip's first line tells where the value comes from: *History* and its time, or *Statistics* — with their period, `5 min` or `1 h` — and the time it covers (`History: 18:10`, `Statistics 1 h: 14:00 – 15:00`; in French `Historique : 18:10`). A point standing for several values (see [Data decimation](#data-decimation)) shows the interval of time it covers, `from – to` (the end's date only when it's another day), and `min / mean / max` with the unit.

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
- **Enter** — choose the highlighted entry (with a `*` pattern, the first Enter selects every match, a second one adds them)
- **Escape** — close the dropdown and clear the input field

Clicking an entry chooses it, as Enter does — there is no separate `+` button to press afterwards.

An entity can also be shown through one of its attributes (a thermostat's measured temperature, its setpoint, what it's doing…). Selecting an entity with attributes that can be shown opens a submenu first, over the list, level with the entity, which stays in bold while it's open — the same as the type menu's submenus: *Value* (the entity's own state) first, pre-selected — Enter takes it at once — then each attribute with its current value. Arrows move through it, Enter or a click chooses, ← or Escape goes back to the list. The attributes offered are those holding a number, a text or a yes/no — or a dictionary, or a list of dictionaries (a forecast), holding some: marked ▸, a click opens them in a submenu over the attributes, as every submenu (← or Escape closes it); not a list of plain values (`hvac_modes`: a set of choices), not Home Assistant's own (name, unit, icon, classes…), not a unit: an attribute `X_unit`, as weather entities give them (`temperature_unit`, `pressure_unit`, `visibility_unit`…), is never offered — the attributes are shown in it (see [Attributes](#attributes)); nor a reference to something else: an entity (`source: sensor.x`) or a web address (`release_url: https://…`); nor an attribute about a version or an update — its name says so (`installed_version`, `latest_version`, `auto_update`); nor a setting, a limit or a description of the entity, no value to follow (`display_precision`, `min_temp` / `max_temp`, `min` / `max` / `step`, `manufacturer`, `model`, `serial_number`, `code_format`… — Home Assistant's domains' usual ones); nor a date, with or without its time (`last_triggered`, `next_rising`, `last_seen`…). Any of them can still be shown, written in the YAML (`attribute:`). An entity without such attributes goes straight to the type menu. A wildcard pattern adds entities' states only.

Choosing an entity (by click, or Enter) doesn't add it right away: the display type menu opens first, the most fitting type pre-selected — line (*Smart*, *Curve*, *Straight* or *Stepped*), *Bar*, *Direction* or *Timeline*. Nothing is created in the graph or persisted until a type is picked; the choice both sets the type and performs the add in one step. The menu always opens, even for an entity whose state isn't a number (on/off, text…): it then only offers *Timeline*, the only way to show it, and lets you check before adding. See [Choosing an entity's display type](#choosing-an-entitys-display-type) below for the full behavior, including long-press access on existing labels and the wildcard "Default" option.

The entity entry field accepts the `*` wildcard and can automatically add multiple entities that match the provided pattern. When a wildcard is entered, matching entries appear in bold in the dropdown. The first Enter selects all matching entities; the second Enter opens the display type menu for the whole matched batch — see below. Some examples:
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

Dynamically added entities can be individually removed by clicking the `×` close button at the top right of their graph — a round button drawn over the graph, like the handle — or all together with *Card ▸ Default graphs* in the [options menu](#the-options-menu).

### Choosing an entity's display type

An entity whose current state can be read as a number can be shown as a line (*Smart*, *Curve*, *Straight* or *Stepped*), as bars (*Bar*), as direction arrows (*Direction*, the `arrowline` type) or as a timeline (*Timeline*); any other entity only as a timeline.

The type menu has five items, each opening its submenu over the menu, level with it — its right edge on the menu's right edge; the item whose submenu is open is in bold:
- **Display ▸** — open as soon as the menu opens: *Smart*, *Curve*, *Straight*, *Stepped*, *Bar*, *Direction*, *Timeline*;
- **Appearance ▸** — how an entity shown looks, for a curve or a bar (not a timeline's or an arrowline's row):
  - *Color ▸* — the browser's own color picker, the curve's color preselected, opened in the middle of the screen (Firefox on Windows opens the system's own, where Windows places it); the color chosen is the curve's own (`color`), a fill of its color following it — for a bar too;
  - *Points* — a switch: the curve's samples' dots shown or not (`showPoints`), as a long-press near it;
  - *Extremes* — a switch: its min/max band (`showMinMax`) everywhere, or none; on when the band is shown, partly too (`statistics`, `history`);
  - *Fill ▸* — *None*, *Solid* (its color, light: `fill: true`), *Fade* (`fill: fade`);
  - *Width ▸* — 1 to 5 px (`lineWidth`);
  - *Line style ▸* — *Solid*, *Dots*, *Short dashes*, *Long dashes*, *Dash-dot* (`dashMode`);

  each list in a submenu over *Appearance* (← or Escape closes it), the value in use in bold — none when the curve has one the list doesn't hold (a fill of another color, a width of 1.5 px, dashes of its own). A choice is applied at once and saved with the entity as the matching option, as the interpolation is — a YAML entity's, when its options are saved (see [Enabling persistence](#enabling-persistence-enable_persistence--enable_multidevice_persistence)); the last one to speak, the menu or the YAML, wins;
- **Interpolation ▸** — for a curve shown in *Smart* or *Curve*: how the curve is drawn between its values (see [Curve interpolation](#curve-interpolation)), the algorithm in use in bold; the choice is saved with the entity;
- **Layout ▸** — opened by a long-press on a label: *Separate* (the entity taken out into its own graph, as a double-click on its label), *Merge back* (a linked graph put back into the one above, as a double-click on the chain icon), *Cut* (the entity moved to another graph, as a drag — see [The graph menu, cut and paste](#the-graph-menu-cut-and-paste)), *Delete* (the entity removed from the card).
- **Tests (beta) ▸** — diagnostics run where the card is shown (browser, Home Assistant app), to report what that system gives the card: *Pen events* lists what the browser reports of a pen (hover, its button, a long press) on two test zones; *Performance* measures what the card costs on this device with its entities — the graphs drawn again, the window loaded from Home Assistant (each request's wait and values), the real time — and when the page froze; the report can be copied or sent as a GitHub issue — with the device, the system and the browser or app used.

Click an item, or press Enter or → on it; ← or Escape goes back to the menu. A choice that changes what the menu shows — a display type, an interpolation, a look, a switch — is applied at once, and the menu stays open half a second showing it (the new type in bold, the switch moved), then closes; another choice made meanwhile is applied too, and the half second starts again. An action whose result is elsewhere — *Separate*, *Merge back*, *Cut*, *Delete*, *Info*, a test, *Color* (the picker takes over), a type for an entity being added (a second one would add it again) — closes the menu at once. A switch is a line with its name and, on its right, Home Assistant's switch: green and on the right when on, red and on the left when off. A menu reopened less than 10 s after it was closed opens the submenu it had open (a new entity's always opens on *Display*). A menu is wider than each of its submenus, so its lines stay readable beside the one open and another can be picked (the last line's submenu, which hides no line below it, may be as wide as the menu). On a card or a screen too narrow for that, the menu opens without any submenu — its lines read first —, and a submenu opened leaves at least 48 px and the first three characters of its lines; its own lines are cut ('…') if they don't fit.

The type menu opens:

- **Right after selecting a brand-new entity** from the dropdown (click, or Enter) — always, even when *Timeline* is the only choice, so you can check before it's added. Nothing is added to the graph or to persisted configuration until a type is picked — the choice both defines the type and performs the creation in the same action. The most fitting type is pre-selected in bold in *Display* — Enter right away adds it, the arrow keys first highlight it and then move through the other choices:
  - a state that isn't a number (on/off, text…) — timeline, the only possible display (the menu offers nothing else);
  - the entity's own `entityOptions` `type` / `lineMode`, when set;
  - an angle (`circular`: unit exactly `°`, or state class `measurement_angle`) — direction arrows;
  - a quantity that only adds up (energy, gas, water, volume: state class `total_increasing`, or `total` with such a device class or unit) — bar;
  - no unit and not a measurement — timeline;
  - any other measurement — line, in smart mode (or in the card's own `lineMode` when it's set: `lineMode: curves` at the card level pre-selects *Curve*).
- **On a long-press** (or a right click) of a legend label on a line/bar graph, or of an entity label on a timeline/arrowline graph — to change the type, the look or the layout of an entity that's already added.
- **After *Create a second curve*** — selecting an entity (or attribute) that's already shown says so, outlines its graphs, and offers a choice under the field: *Cancel*, pre-selected (Enter, Escape or a click elsewhere cancel), or *Create a second curve* — the type menu then opens as for a new entity, and the curve is added in a graph of its own.

For a **wildcard match** (multiple new entities added at once), *Display* gets an extra **"Default"** entry at the top, pre-selected by default:
- Choosing **"Default"** creates each matched entity with its own individually auto-detected type — exactly as if each had been added on its own.
- Choosing any other option applies that single type to every entity in the batch — except for an entity whose state isn't a number, always created as a timeline. When no entity of the batch has a number as its state, the menu only offers *Timeline*.

Keyboard use: in a submenu, ArrowUp/ArrowDown moves a highlight between the options (starting from the pre-selected one), Enter confirms; pressing Enter without moving the highlight confirms the pre-selected/default option directly.

The type chosen this way is persisted the same way as everything else added through the UI — synchronized with your HA user account and restored across all devices.

In the [info panel](#info-panel--replacing-the-ha-more-info-popup), a **"Type"** text link appears between the date and range selectors when the panel's entity has a number as its state, opening the same menu.

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

A graph defined manually in the YAML always shows all its entities on the same graph, whatever their units of measure (or lack of one) — it's the YAML author's explicit choice; two groups of units get a Y axis each (see [Two Y axes](#two-y-axes)). Lines and bars share one chart too (the curves drawn over the bars, see [Bar graphs](#bar-graphs-for-total-increasing-entities)). Only timeline and arrowline entities can't share a chart with anything else: they are shown as separate *linked* graphs, see below.

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

A curve can be moved to another graph by dragging its legend label and dropping it onto the target graph. Any line or bar graph accepts it, whatever its unit — lines and bars mixed, a graph defined in YAML included, in or out of a group of linked graphs; a second group of units gets the right Y axis, more groups share one axis (see [Two Y axes](#two-y-axes)). Only the display type limits a drop: a curve can't go onto a timeline or arrowline graph, nor a timeline entity onto a line or bar graph — the drop is refused with a brief tooltip (e.g. `line ≠ timeline`). Units only matter when an entity is added: `combineSameUnits` only joins compatible ones on its own. The curve's color is preserved; if it conflicts with a color already in use on the target graph, a free color from the default palette is assigned automatically. On a touch screen, tap the label, then press it again right away and drag.

A drop is saved only when the placement of both graphs is (the `entities` persistence of their entities, see [Enabling persistence](#enabling-persistence-enable_persistence--enable_multidevice_persistence)). A graph defined in YAML saves nothing by default: a curve dropped onto it, or taken out of it, is saved where it was before the drop, so a reload brings both graphs back as they were — nothing duplicated, nothing lost. Dropped back into its own graph, the curve is saved there again.

#### Reordering curves within a graph

Curve labels in the legend can be dragged left or right to change their display order within the same graph. The new order is synchronized with your HA user account.

#### Reordering graphs

Graphs can be reordered by dragging on the ⠿ symbol at the top left of each graph (its box, with the padlock). Drag a graph up or down and drop it onto another graph: releasing above the midpoint of the target inserts it above, releasing below the midpoint inserts it below. A simple click on that same area toggles the Y axis lock. The handle, the padlock and the chain icon of linked graphs keep only the room they need beside the legend's first line; on a narrow card they take none — each is drawn in a small box of the card's background over the legend's labels (or a timeline's rows): on the box, a gesture is theirs; beside it, on a label, the label's. The new order is synchronized with your HA user account. On a touch screen, tap the ⠿ symbol, then press it again right away and drag.

Linked graphs (same group, chain icon) always form one solid block: another graph can't be dropped between them, and moving one of them outside of its block moves the whole block along, keeping its internal order. Moving a graph within its own block just reorders it there.

When dragging a graph or a curve near the top or bottom edge of the screen, the page scrolls automatically to allow reaching graphs that are not currently visible.

#### The graph menu, cut and paste

A long-press (or a right click) on the ⠿ zone of a graph opens its menu, titled with the graph's `title` — or, without one, with the first two words of each curve's name (a word: two letters or digits at least — the `:` of an attribute's curve, `salon : Current…`, is kept but not counted), each start once. It is one zone: a click there toggles the Y axis lock, a drag moves the graph, a long-press opens the menu — so that what a gesture does there is also in a menu:
- **Display ▸** — open with the menu (*Layout* for a graph of timelines): the display types that fit every entity of the graph, the one they all share in bold: chosen, every entity of the graph is shown that way, saved with each, and the graph stays one graph, in its place (three curves made a timeline: one timeline of three rows). Not shown for a graph of entities that can only be a timeline;
- **Appearance ▸** — as in the type menu, its color aside, for all the graph's curves at once: a switch on when all of them show it, a value in bold when all of them have it;
- **Interpolation ▸** — the algorithm for all the graph's curves in *Curve* or *Smart* mode (the only ones it applies to), in bold when they all share it; shown when the graph has such a curve;
- **Layout ▸** — *Y axis locked* (a switch, as a click on the padlock — not on a timeline or arrowline graph, which have no lock), *Merge back* (a linked graph put back into the one above, as a double-click on the chain icon), *Cut* (the graph moved elsewhere, as a drag of its ⠿ zone), *Delete the graph* (a graph added from the card, as its × button).

*Cut* is also in the *Layout* submenu of a curve's or a timeline entity's type menu. Once something is cut, the ⠿ zone of every graph shows where it can go, instead of the ⠿ symbol and the padlock:
- a curve or an entity: 📋 — click it to paste it into that graph, at the end of its legend, exactly as a drop there (same rules: any line or bar graph for a curve, saved only when both graphs are);
- a graph: ↓ 📋 ↑ — ↓ inserts it below that graph, ↑ above it, as a drop below or above its midpoint; a swipe down or up on them does the same (on a touch screen, that swipe doesn't scroll the page); a block of linked graphs moves as a whole, and nothing is inserted inside another block.

A choice that isn't possible is greyed and struck through in red; clicked, it says why, and the cut goes on. ✂ marks the graph it was cut from — clicked, the cut is cancelled. As for the labels, a click just beside a button counts as on it, and one about halfway between two does nothing (the cut goes on). A click clearly away from them, anywhere else on the card or the page, or Escape, cancels it too.

#### Timeline and arrowline entity management

Entities in timeline and arrowline graphs can also be reorganized interactively:
- **Double-click** an entity label to extract it into its own graph, placed immediately below the original
- **Long-press** (or right click) an entity label to open the [display type menu](#choosing-an-entitys-display-type)
- Drag an entity label to move it to another graph of the same type
- Drag an entity label up or down to reorder it within the same graph (on a touch screen, tap it, then press it again right away and drag)
- Long labels that don't fit in the label area are truncated; click a truncated label to reveal the full name in a tooltip

All drag operations show a ghost element and horizontal insertion marker for precise positioning. All changes are synchronized with your HA user account.

### Legend / entity labels

You can hide an entity in a graph by clicking its label on the top — its name, struck through then, not its value. Click it a second time to make the entity visible again. A click on its value — `(400 W)` at the end of its label — or on its value shown over the graph (`showState`) opens Home Assistant's dialog of the entity, with the [info panel](#info-panel--replacing-the-ha-more-info-popup) in it when it's on; so does *Info* in its menu. An entity can be hidden by default using the `hidden` property in your entityOptions or in the manual YAML (see the advanced YAML example at the end of this readme). A curve hidden (or shown again) from its label is kept on this device only, as the card's persistence options say — never synced across devices, as its points shown (`showPoints`).

**Double-clicking** a label extracts the corresponding curve into its own graph (see the *Ungrouping a curve* section above).

**Dragging** a label left or right on the same graph reorders curves within the graph.

**Dragging** a label onto another graph moves the curve to that graph (see the *Moving curves between graphs* section above).

If you would like to entirely remove the labels from the UI, use the `legendVisible` flag:

```yaml
type: custom:history-explorer-card
legendVisible: false
```

`legendVisible: auto` (on the card; `look: mini`'s default) shows a graph's legend only when it has several labels in it, as mini-graph-card does: a graph of one curve has none — its name is in the graph's header (see [Values over a graph, a compact look](#values-over-a-graph-a-compact-look)).

On an entity (mini-graph-card's `show_legend: false`), `legendVisible: false` leaves only that entity out of the legend: its curve is drawn, the other labels take its room.

#### Showing current sensor values

The current sensor values are shown next to their label names in line or bar graphs by default. They can be disabled:
```yaml
type: custom:history-explorer-card
showCurrentValues: false
```

![image](https://user-images.githubusercontent.com/60828821/212548277-002254da-4159-435b-9ae7-913a00948dbd.png)

#### Rounding

`rounding` (alias `decimals`) sets how many decimals the values are written with — in the legend, the tooltip, over the graph and in the entity selector: exactly that many (`rounding: 1` gives `20.0`, `rounding: 0` none). Not set, the values have at most 2 decimals (`20`, `20.5`, `20.25`). It can be set on the card, in `entityOptions`, on a graph or on an entity — the most specific one wins.

```yaml
type: custom:history-explorer-card
rounding: 1
```

---

## Info panel — replacing the HA more info popup

The card is capable of replacing the history graph in the HA more info popup that appears when you click an entity anywhere on your dashboard. When enabled, clicking any entity on your dashboard will open the history explorer card instead of the standard HA history graph, giving you the same interactive experience (zoom, pan, Y axis control) directly inside the popup.

### Enabling the info panel

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

### What the info panel supports

The info-panel renders a single interactive line, bar, timeline or arrowline graph for the selected entity, using the same rendering engine as the main card. All interactive features are available:

- Pan left and right through time by dragging the graph
- Zoom in and out using the time range selector or the mouse wheel with CTRL; with a mouse, a drag mostly up or down draws the elastic box (time and Y axis zoomed to it)
- Y axis lock and interactive Y axis pan (drag on the left label area, cursor changes to `↕`)
- With two fingers on a touch screen: vertical pinch zooms the Y axis, horizontal pinch zooms the time, moving both fingers pans
- Tooltip on a click or a tap, then following the pointer
- The display type menu — its *Display*, *Appearance* and *Interpolation* submenus — through the *Type* link (when the entity's state is a number); what is chosen there isn't saved
- Long term statistics integration (seamless transition past the history retention limit)

Opened from a curve of a card — a click on its value, or *Info* in its menu —, the panel shows that curve as it looks on the card: its display type, its interpolation, its color, its fill, its line's width and style, its points and its extremes. Opened from anywhere else, the graph type and display options for the entity are taken from the card's `entityOptions` configuration, so an entity configured as `arrowline` in your YAML will appear as an arrowline in the info-panel as well.

### Info panel limitations

- The info-panel shows a single entity graph only. Ungrouping, curve drag & drop and graph reordering are not available in the popup.
- CSV export is not available in the info-panel.
- The default time range shown in the popup follows the `defaultTimeRange` setting of the card.

---

## Graph types

### Bar graphs for total increasing entities

Entities that represent a total (monotonically increasing or net metering) can be visualized as adaptive bar charts. This applies to entities such as, for example, consumed energy, water or gas, rainfall, or network data usage. The data is visualized over a time interval (10 minutes, an hour, a day, a week — from Monday — or a month) that can be toggled on the fly and independently for each graph.

![image](https://user-images.githubusercontent.com/60828821/193383950-53242b11-d467-42ba-9859-3b3df0b0dcb8.png)

Bar charts use the `bar` chart type and can be used in both dynamically and statically added entities by setting the type accordingly. When adding an entity from the card, the type menu pre-selects *Bar* for energy, gas, water or volume that adds up (state class `total_increasing`, or `total` with such a device class or unit); any other entity can be shown as bars by picking *Bar* in the menu, or with `type: bar`.

Use the selector on the top right of the graph to choose the time interval your data is displayed at — on the legend's first line, before the `×`; when the legend's first label doesn't fit beside it, centred between the handle (or the padlock) and the `×`, the legend starting on the next line. You can add the same entity multiple times in separate graphs with different intervals. Selecting *Raw* will show the raw data of the bar entities as curves; selecting an interval again turns them back into bars. The default interval is hourly. It can be overridden using the `interval` option. Possible values are `10m`, `hourly`, `daily`, `weekly` or `monthly`.

Example configuration of a bar chart display for the entity `sensor.rain_amount` when added dynamically. The default interval is 10 minutes and the type is explicitly set to `bar`, so that the entity is shown as bars without picking it in the type menu.

```yaml
entityOptions:
  sensor.rain_amount:
    type: bar
    color: '#3e95cd'
    interval: 10m     # Default interval for this entity can be 10m, hourly, daily, weekly or monthly
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

`barSpacing` (mini-graph-card's `bar_spacing`) — on the card, a graph, an entity or in `entityOptions` (for its graph) — is the room between two bars, in pixels; without it, each bar leaves a small gap on both sides, in proportion to its interval.

#### Bars and curves on the same graph

A bar graph can also hold line entities: their curves are drawn over the bars, with their own line mode (`curves`, `smart`...). The interval and *Raw* only apply to the bars, and `stacked` only stacks the bars — curves are never stacked. This happens with a YAML graph mixing both (no `type:`), when a curve's display type is changed to bars (it stays in its graph), or when a curve is dropped onto it. An entity added from the UI never joins a graph of the other type on its own.

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
                      # or: auto — the automatically translated device class dependent state names (the default)
                      # or: hide — hide all state text labels
```

#### Customizing state colors

The default colors used for the states shown on timeline graphs can be customized in many different ways. Customizing is done by adding the `stateColors` key to the card YAML. Colors act on individual entities, entire device classes, domains or global states. You can, for example, have distinct colors for the on and off states of your motion sensors and your door sensors, even if they're both binary sensors.

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

A general default color can be set per domain, device class or entity. If present, it will serve as a fallback to all states in that domain, device class or entity that were not explicitly defined. In the following example, the states of the input_text.air_quality entity are defined. The *bad* state will be red, the *good* state will be green. All other states of that entity, regardless of what they are, will be yellow due to the catch-all key.
```yaml
type: custom:history-explorer-card
stateColors:
  input_text.air_quality.bad: red
  input_text.air_quality.good: green
  input_text.air_quality: yellow        # Fallback, catches all states from this entity that are not 'good' or 'bad'
```

There is a special virtual state that is added to all entities, the *multiple* state. This state substitutes an aggregation of multiple states on the timeline when they were merged, each too thin to be seen (see [Data decimation](#data-decimation)). Like normal states, you can specify the color for this special state for individual entities, device classes, domains or globally.

![history-panel-timeline-multiple](https://github.com/alexarch21/history-explorer-card/raw/main/images/screenshots/history-panel-timeline-multiple.png)

The random colors assigned to states not covered by `stateColors` are generated from a fixed seed. You can change this seed to get a different set of automatic colors:

```yaml
type: custom:history-explorer-card
stateColorSeed: 42   # Any integer. Default is 137.
```

### Compass arrow graphs

Entities representing a directional angle value, like a bearing or direction, can be displayed using a timeline of compass arrows. This is especially useful for visualizing wind directions:

![image](https://user-images.githubusercontent.com/60828821/163562690-01002243-b6d3-4a55-8128-9d1dc89581c6.png)

Compass arrow graphs use the `arrowline` type and can be used in both dynamically and statically added entities. See [Entity options](#entity-options) for an example of the former and the advanced example of [YAML configuration for preconfigured graphs](#yaml-configuration-for-preconfigured-graphs) for the latter.

---

## Colors of curves and bars

The `color` of a curve or of bars is a value, or an entity holding that value. The same values are accepted everywhere — in a graph's entity, in `entityOptions`, and in the state of an entity:

- **a color**: any CSS color (`red`, `#3e95cd`, `#3e95cd80`, `rgb(62, 149, 205)`, `rgba(...)`, `hsl(...)`), a CSS variable (`--my-special-green`), or an RGB triplet: `[62, 149, 205]`, also written `62, 149, 205` or `(62, 149, 205)`;
- **thresholds** on the value shown: key / color pairs, as many as you want. A number key is a threshold: a value takes the color of the highest threshold at or below it — below every threshold, the lowest one's. Any other key is a state, compared exactly as it is written (case included): `heat: red`. `default` is the color of every value they don't cover. A curve is colored point by point, bars bar by bar (by the value of each bar). The keys can be quoted or not (`0: blue`, `'1.0': green`);
- **thresholds on the value of another entity**: the same, with an `entity` key — they compare that entity's value (a number or a state) instead of the value shown, at each point: for a heat pump's power, its mode (`heat: red`, `cool: blue`). With an `attribute` key too, they compare that attribute of the entity (a thermostat's `hvac_action`);
- **an entity** (its entity_id) — or one of its attributes, written after it (`climate.salon.led_color`): its state (its value) holds one of the above, as text — a color, a triplet, or thresholds written as JSON (`{"0": "blue", "20": "red"}`) or as a Home Assistant template writes a dictionary (`{0: 'blue', 20: 'red'}`).

With an entity — thresholds on its value, or holding the color — the curve takes, at each point, the color that applied at that time: the entity's history is loaded with the card's, and the curve follows when it changes.

```yaml
entityOptions:
  energy:           # apply this color coding to all sensors of the energy device class (also works for domains or individual entities)
    type: bar
    color:
      '0.0': blue   # Bar is blue below 1.0 kWh
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
      - entity: climate.salon          # an attribute: thresholds on it,
        attribute: current_temperature
        color:
          entity: climate.salon
          attribute: hvac_action
          heating: red
          idle: blue
      - entity: sensor.salon_humidity
        color: climate.salon.led_color # or an attribute holding the color itself
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

**Blended thresholds.** With `colorTransition: smooth` (`look: mini`'s default), number thresholds are blended from one to the next, as mini-graph-card draws them: at a threshold its color, between two a mix of both by where the value is between them, below the lowest and above the highest their own color. The line is a gradient along the Y axis, each point its own blended color, the legend the color of the value now. Thresholds with states, or compared on another entity, aren't blended. `colorTransition: hard`: each value the color of its threshold.

```yaml
type: custom:history-explorer-card
colorTransition: smooth
graphs:
  - type: line
    entities:
      - entity: sensor.outside_temperature
        color: { '0': blue, '20': green, '30': red }
```

**A color for each entity of a graph.** `lineColor` on a graph or on the card: a color, or a list of colors — each entity of a graph without its own `color` takes the one at its place in the graph, the others the palette's (mini-graph-card's `line_color`).

---

## Scaling values: scale, unit and valueFactor

Three options of an entity (`valueFactor`: also of a graph, the card or `entityOptions`) multiply its values. They overlap; what differs is how the factor is written and what is shown:

| | `scale` | `valueFactor` (`value_factor`) |
|---|---|---|
| Written as | the factor itself (`0.001`, `-1`) | a power of 10 (`-3`: × 10⁻³) |
| Without `unit` | only the curve drawn is multiplied: the legend, the tooltip and the values over the graph show the entity's real value — to make a small curve visible next to larger ones, or to flip it with a negative factor | the values drawn **and** shown are multiplied (400 W shows 0.4 W) |
| With `unit` | a conversion: the values drawn and shown are multiplied, in that unit (`scale: 0.001` and `unit: kW` for a power in W) | the same, in that unit |

`valueFactor: -3` thus gives the same as `scale: 0.001` with `unit` set to the entity's own unit. Both can be set together: the values are drawn multiplied by `scale` × 10^`valueFactor`, and shown multiplied by the same with `unit`, by 10^`valueFactor` alone without it.

```yaml
type: custom:history-explorer-card
graphs:
  - type: line
    entities:
      - entity: sensor.power            # in W
        scale: 0.001
        unit: kW                        # shown and drawn in kW
      - entity: sensor.energy_meter     # in Wh
        valueFactor: -3                 # shown and drawn divided by 1000, its unit kept
      - entity: sensor.small_signal
        scale: 100                      # only drawn larger: its real value shown
```

---

## Y axis scaling

By default the min/max scales for the Y axis are adjusted automatically to the data you are currently viewing: the padlock is open, in green. Locked, it is closed, in red (the theme's own green and red).

Pressing the axis lock icon — or the *Y axis locked* switch in the [graph menu](#the-graph-menu-cut-and-paste) — will temporarily disable autoscaling and lock the Y axis to the currently active range. Pressing it again will revert back to the defaults for the graph:

![image](https://user-images.githubusercontent.com/60828821/221268643-735e4b1a-81da-4709-aff8-913b9b8f95a8.png)

The Y axis can also be interactively modified. Pressing and holding the `SHIFT` key will unlock interactive zooming and panning of the graph in vertical direction. Pressing your mouse button while holding `SHIFT` over a graph will allow you to drag the graph into both horizontal and vertical directions: the time and the Y axis move together. Using the mousewheel while holding `SHIFT` will change the Y axis scale. When interacting with the Y axis, the axis lock icon will automatically be enabled. Click the icon to go back to the default scale at any time.

**On desktop**, you can also drag directly on the Y axis label area (the left 65px of the graph) to pan the Y scale — the cursor changes to `↕` when hovering over that zone.

**Labels inside the plot** (a card narrower than 300 px, `yLabels: inside`, `look: mini`): the Y axis zone is a column along the labels, as wide as their boxes and the pointer's precision more. There, as on the ⠿ zone, the gesture decides: a drag moves the axis (with a mouse at once; with a finger or a pen, after a tap then a second press right away), a click, a long press or a hover is for the curves (tooltip, points, the point hovered).

**Showing the labels** — `labelsLeft` (mini-graph-card's `show.labels`) for the left axis, `labelsRight` (`show.labels_secondary`) for the right one, on the card, in `entityOptions`, on a graph or on an entity (for its graph): `true` (the default), `false` — no labels nor unit, the plot taking their room, no drag there to move the axis —, or `hover` — shown while the pointer is over the graph, fading in and out; on a touch screen, a tap on the graph shows them for 3 s; hidden by `hover`, they keep their place, and a drag there still moves the axis. `look: mini` gives `hover` to both.

**On a touch screen**, the same Y axis zone is a touch target: tap it, then press it again right away (within the long-press duration) and drag (a swipe on it scrolls the page). Two fingers on a graph zoom and pan: spread or pinch them vertically to zoom the Y axis around them — what is under the fingers stays there —, horizontally to zoom the time (by the same steps as the zoom buttons), and move them together to pan the time and the Y axis. A pinch is never exactly horizontal, vertical or centred: of its four changes — the fingers' spread horizontally (the time's zoom) and vertically (the Y axis' zoom), their centre horizontally (the time's pan) and vertically (the Y axis' pan) — the one it's mostly made in, once beyond the finger's precision, is the only one at first; another joins it only beyond a dead band of 10 % of the plot area's smaller side.

By default, the Y axis of a line chart fits its curves exactly. A small margin can be added below and above them, to give some headroom (bar charts never get it):

```yaml
type: custom:history-explorer-card
axisAddMarginMin: true   # margin below the curves (default false)
axisAddMarginMax: true   # margin above the curves (default false)
```

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

See [Entity options](#entity-options) and the advanced example of [YAML configuration for preconfigured graphs](#yaml-configuration-for-preconfigured-graphs) for more examples.

### Bounds

A bound written with a `~` is soft: the axis reaches it, and goes past it where the values do — `ymin: ~0` shows 0 at least, and a negative value below it. `yrange` is the smallest range the axis shows: a nearly constant sensor isn't drawn as if it varied a lot; the range is widened on the sides that aren't fixed (on both, evenly, when neither is). A side set by hand — the padlock, a drag, a pinch — is kept as it is.

```yaml
type: custom:history-explorer-card
graphs:
  - type: line
    options:
      ymin: ~0          # 0 at least, lower when the values go lower
      yrange: 5         # at least 5 units from the bottom to the top
      logarithmic: true # a logarithmic axis
    entities:
      - entity: sensor.outside_temperature
```

`logarithmic: true` draws a line graph's Y axis on a logarithmic scale (values above 0); a drag, a pinch or Shift + wheel move and zoom it evenly, as it's seen.

### Two Y axes

Line and bar graphs have up to two Y axes, one per group of compatible units: with two groups (a power in W and kW, and a temperature), the first one is on the left, the second one on the right, each with its own scale and title, and the curves of the right axis are marked with a small arrow ▸ in the legend. `yAxis: left` or `yAxis: right` on an entity (or in `entityOptions`) puts it on that side whatever its unit; on a graph or on the card it applies to every curve that doesn't set its own — `yAxis: left` on a graph keeps it on one axis, and `yAxis: auto` on an entity brings back the choice by unit. `ymin`, `ymax` and `ystepSize` apply to both axes. Linked graphs keep the same room on the right when one of them has a right axis, so that their time stays aligned. With more than two groups of units, the curves share one Y axis whose title is left empty; the legend and the tooltip still show each entity's value in its own unit. When their values aren't of the same order (a value between 0 and 1 next to one up to 1000), the small one looks flat — use `scale:` to bring it to comparable values (a negative factor flips it). The legend and tooltip keep showing the entity's real value, unless `unit:` is set too (see `scale` in the entity options).

The right axis takes `yminRight`, `ymaxRight` and `yrangeRight` when they're set, else `ymin`, `ymax` and `yrange` like the left one; `labelsRight` shows its labels, as `labelsLeft` the left one's (see [Y axis scaling](#y-axis-scaling)).

Dragging the label area of one axis — left or right — pans that axis only. Shift + drag, Shift + wheel and the two-finger pinch move and zoom both axes together — Shift + wheel each around its own middle, the pinch around the fingers —, so the curves keep their positions relative to each other; the padlock locks and releases both.

---

## Line appearance

### Line modes

Four modes are available for line charts: cubic splines, line segments, stepped and smart. Cubic splines (`curves`) are smooth and natural-looking, appropriate for signals already filtered; by default they use a monotone cubic interpolation (Fritsch–Carlson), guaranteed never to overshoot — other algorithms can be chosen with `interpolation`, see [Curve interpolation](#curve-interpolation). Line segments (`lines`) connect data points with perfectly straight segments using zero-tension monotone interpolation — the most faithful representation of the raw data. Stepped mode (`stepped`) displays the raw quantized data as a staircase. Smart mode (`smart`) is described below.

All modes use `borderJoinStyle: round` for constant stroke width at corners and rounded ends.

![image](https://user-images.githubusercontent.com/60828821/148483356-aea06848-13d9-4e1e-bd06-485b44505d48.png)

You can specify the line mode in the YAML global settings. Possible options are `curves` (or `curve`), `lines` (or `line`), `stepped` (or `step`) or `smart`. If the option is not present, the curves of YAML graphs are drawn as `curves`, and an entity added from the UI gets `smart` (the type menu pre-selects it). When it's set, it applies to both: with `lineMode: curves`, entities added from the UI are pre-selected as *Curve* too. To keep a mode for your YAML graphs only, set it under each graph's `options:` (or on each entity) instead.

```yaml
type: custom:history-explorer-card
lineMode: lines
```

The line mode can also be set for fixed entities defined in the YAML and for dynamic entities or device classes (see [Entity options](#entity-options)).

### Curve interpolation

In `curves` and `smart` modes, the curve between two recorded values is rebuilt by an interpolation. Its algorithm is set with `interpolation` — on the card, in `entityOptions`, on a graph or on an entity — or from the type menu (**Interpolation ▸**):

| `interpolation` | How the curve looks |
|---|---|
| `monotone` (default) | Chart.js' own monotone cubic (Fritsch–Carlson). Never overshoots, but the slope is set to zero at every value where the curve changes direction or repeats a value, and doesn't take the spacing of the values into account: small breaks in the slope, especially with rounded or noisy sensors |
| `steffen` | Monotone too (M. Steffen, 1990): never overshoots, flat only at the real peaks and troughs, slopes weighted by the irregular spacing of the values |
| `makima` | Modified Akima: follows the local trend, stays flat over flat stretches, no break at each small peak; hardly any overshoot |
| `catmullrom` | The slope of the chord through both neighbours: the smoothest, but may overshoot a little around sharp changes |
| `bspline` | [mini-graph-card](https://github.com/kalkih/mini-graph-card)'s smoothing (a quadratic B-spline): from the middle of each segment to the middle of the next, each value its control point. Never overshoots, the smoothest of all, but passes through the middles, not through the values — a peak is drawn lower than it was; its dot and its tooltip keep the value measured. `look: mini`'s default |

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

How a silence is detected — the rules of the [lowpass_dt](https://github.com/Cook23/lowpass_dt) integration, computed in the browser on each curve's recorded values:
- the sensor's usual interval between values is a running average (EMA) of the intervals. The card has the whole history at once, so it starts from their median; lowpass_dt, which receives the values one by one, starts from the first interval;
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
- absent, `null` or `none`: automatic — an entity whose unit is exactly `°` (not `°C`/`°F`) or whose state class is `measurement_angle` is circular with a period of 360. An attribute in `°` only when its name says it's a direction (`bearing`, `direction`, `azimuth`, `heading`, `yaw`, `wind_dir`): a weather entity's `wind_bearing` or the sun's `azimuth` is, the sun's `elevation` (from -90 to 90) isn't;
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

Limitations: Home Assistant's long-term statistics average angles as plain numbers (the mean of 359 and 1 is 180): an angle is always drawn from its history, never from the statistics — past the history retention limit, its curve is blank.

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
| *(absent)*, `solid` | Solid line (default) |
| `points` | Fine dots |
| `shortlines` | Short dashes |
| `longlines` | Long dashes |
| `pointline` | Long dash — dot alternation |

Custom pattern: an array of pixel lengths `[on, off, on, off, ...]` following the Canvas `setLineDash` convention, repeated cyclically. For example `[10, 4]` draws 10 px dashes with 4 px gaps, and `[15, 3, 3, 3]` alternates a long dash and a short dot.

The default line width for all line graphs can be set globally. The default is 2 pixels:

```yaml
type: custom:history-explorer-card
lineWidth: 2
```

`showLine: false` draws a curve's points only, without the line between them (its points shown, unless `showPoints` says otherwise).

`fixedValue: true` (mini-graph-card's `fixed_value`, on an entity or wherever an option is set) draws a curve's last value in the window shown — in real time, its value now — flat over the whole window, instead of its history.

### Displaying individual samples

Holding the `Alt` key (or `Option` key on Mac) while moving over a graph reveals all the individual samples making up its curves; moving without it, or leaving the graph, hides them again. A long-press (or a right click) near a curve shows or hides its own, saved as its `showPoints` (hidden: `hover`); so does the *Points* switch in the *Appearance* submenu of its menu, or of its graph's. The points are as wide as the line plus 2 px; the one the tooltip shows, 2 px more:

![image](https://user-images.githubusercontent.com/60828821/221272054-abb884df-b95f-4c88-83f0-921ac8709a93.png)

To show them permanently, use `showPoints` — on the card, in `entityOptions`, on a graph or on an entity: `true` (the line width + 2 px wide) or a radius in pixels; `hover`, the default, shows only the one hovered; `false` none, not even that one:

```yaml
type: custom:history-explorer-card
entityOptions:
  humidity:
    showPoints: true     # always show sample dots for humidity graphs
                         # or a number: the dot radius in pixels (showPoints: 6)
graphs:
  - type: line
    options:
      showPoints: true   # show samples for this entire manually defined graph
    entities:
      - entity: sensor.outside_temperature
        showPoints: 3     # show dots on this entity only, radius 3px
```

The `showPoints` option is also available in `entityOptions` (see below), making it easy to apply uniformly across entity families.

### Showing the min/max statistical range

The `showMinMax` option draws a lighter band, in the curve's color, between the minimum and the maximum of each column of pixels, around the curve of their mean — similar to the confidence band shown in the standard HA history panel.

| Value | Band |
|---|---|
| `false` / absent | No band (default) |
| `true` | Everywhere: on the statistics (each hour's min and max) and on the history (the min and max of the values in each column) |
| `statistics` | Only where the curve comes from the long-term statistics |
| `history` / `states` | Only where the curve comes from the history |

No extra request is made: the band comes from the data drawn. Where a column of pixels holds a single value of the history, it's drawn as is, without band — zoomed in, every value is there, point by point.

```yaml
type: custom:history-explorer-card
graphs:
  - type: line
    entities:
      - entity: sensor.outside_temperature
        color: '#3e95cd'
        showMinMax: true         # band everywhere
      - entity: sensor.outside_pressure
        color: '#3ecd95'
        showMinMax: statistics   # band where the curve comes from the statistics only
```

`showMinMax` is also available in `entityOptions`:

```yaml
type: custom:history-explorer-card
entityOptions:
  - match: "sensor.*temperature*"
    showMinMax: true         # band for every sensor with temperature in its id
  - match: "sensor.*_power"
    showMinMax: history      # band where the curve comes from the history, for all power sensors
    lineMode: lines
```

### Text states as a curve

An entity whose state is a text (a mode, a set of choices) is drawn as a curve with `stateMap`: each state at its place in the list — 0, 1, 2… —, its label in the legend, the tooltip, the values over the graph and on the Y axis; a state that isn't listed is a gap. A state is written as it is (`off`), or with a label (`{ value: off, label: Off }`).

```yaml
type: custom:history-explorer-card
graphs:
  - type: line
    entities:
      - entity: climate.salon
        stateMap:
          - { value: 'off', label: 'Off' }
          - heat
          - cool
```

### Line graphs and unavailable data

If your history data contains an unavailable state, for example if a sensor went offline for a while, then the card will interpolate over the missing data in line charts to avoid gaps by default. If you prefer to keep the unavailable state visible, so to easily see when and how often your sensors disconnected or became unavailable, then you can disable the interpolation using the YAML below. Timeline charts will always show unavailable or unknown states, regardless of how this parameter is set.

```yaml
type: custom:history-explorer-card
showUnavailable: true
```

### Custom data processing functions

The card supports user defined Javascript expressions modifying the data right before display through the `process` option. This can be used to filter or shape data, apply non-linear scaling or transform data from one graph type to another. The supplied JS expression is provided with the original input `state` value (can be a string or a number, depending on the graph and data source). The expression must evaluate to the desired new state. Complex custom processing functions can degrade rendering performance. 

Custom processing functions work for dynamically added entities, manually defined YAML graphs and graphs in the more info panel.

Example showing a humidity numerical entity as a timeline graph, where humidity below 30% appears as state `dry`, above 70% as `wet` and everything in between as `normal`:
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

The card loads what the screen can show, and no more. A graph can't draw anything narrower than a column of pixels: what it loads depends on how long a column lasts — the window's duration divided by the width of the plot area, in CSS pixels (the widest graph's). Both sources are combined on the fly: you keep scrolling and zooming in or out of your data, as usual.

| A column of pixels lasts | Loaded |
|---|---|
| an hour or more | the hourly statistics of the whole window, in one request (the 5-minute statistics for the day whose last hour isn't compiled yet) |
| between 5 minutes and an hour | the hourly statistics of the whole window, then its 5-minute statistics, in one request each (the hourly ones kept where Home Assistant no longer has 5-minute ones) |
| less than 5 minutes | the history, a few days at a time, the most recent first, each day drawn as it comes (the hourly statistics only where there's no more history) |

For example, on a graph 900 pixels wide: a day is drawn from the history (1.6 min a column), a week or a month from the 5-minute statistics (11 or 48 min), three months from the hourly statistics (2.4 h). The history is used up to some 29 hours on 350 pixels, 3 days on 900, 5 days on 1500. It's asked two parts at a time: each part is drawn as it comes, parts that arrive meanwhile together.

- **The last minutes from the history.** Home Assistant compiles a period's statistics once it has ended: the hour not compiled yet comes from the 5-minute statistics, and the minutes after them from the history — one short request, from 20 minutes ago (the 5 minutes not compiled yet, and room for Home Assistant being slow), at the same time as the statistics. On a recent day whose 5-minute statistics stop earlier (Home Assistant late with them, or none for an entity), that day comes from the history. The automatic refresh asks these last minutes and today's statistics again, never the day's history.
- **The same values from both.** A point computed from the history has the same mean, minimum and maximum as Home Assistant's statistics over the same time (see [Data decimation](#data-decimation)): nothing shows where the history meets the statistics.
- **`statistics.period`** (below) is the table's first threshold — an hour by default, a day with `period: day`; with `statistics.force`, the card never goes down to the history (the 5-minute statistics at most), but for the last minutes.
- **How long they're kept.** Home Assistant keeps the 5-minute statistics as long as the history (the recorder's `purge_keep_days`), the hourly ones for ever: the card takes what it returns, however far back.
- **Entities without statistics** — timelines, attributes, angles (`circular`: Home Assistant averages angles as plain numbers), entities without a state class — always come from the history: past the history retention limit, their graph is blank.

![image](https://user-images.githubusercontent.com/60828821/203880897-6f634e95-cb5d-484c-a9c0-d97b58321557.png)

In the screenshot above, the blue graph is the outdoor temperature, the red graph is the temperature of a barn. The outdoor temperature has statistics available, the barn temperature does not. So you see the red line stopping where the history database retention period ends (Oct 11th). The outdoor temperature continues way past this point, from its long term statistics.

Long term statistics support is enabled by default, with hourly statistics. You can optionally configure the feature (or turn it off) or even force the use of statistics only, effectively turning off the use of the short term history state DB, by adding the following to the card YAML:

```yaml
type: custom:history-explorer-card
statistics:
  enabled: true    # true is the default, use false to turn LTS support off (history only)
  period: hour     # reporting period. hour, day or month. Default is hour.
  force: false     # set to true if you want to use long term statistics only (still the history for the last minutes, and for entities without statistics)
```

`mode` and `retention` are accepted, without effect: a curve is drawn through the mean, the minimum and maximum shown by the band (`showMinMax`) and in the tooltip; the statistics cover the whole window, whatever the history's retention. A `total_increasing` sensor (energy…) is drawn from its state.

---

## Data decimation and aggregation

### Data decimation

`decimation` is accepted — on the card, a graph, an entity or in `entityOptions` — without effect: the card draws what the screen can show, and only that, for a faithful drawing with the best display performance.

A long time window holds far more values than the graph has pixels: a week of a sensor reporting every few seconds is hundreds of thousands of values over some 900 pixels. Drawing them all froze the page for nothing — they land on the same pixels. So:

- **Curves — one point per column of pixels.** The graph's width is cut into columns of one pixel each. A column holding several values — of the history, or an hour of statistics — is drawn as one point: their **mean**, each value weighted by how long it lasted. Computed as Home Assistant compiles its statistics: the value in force when the column starts counts too, from its start, in the mean, the minimum and the maximum — an hour of the history gives exactly that hour's statistics, and nothing shows where the history meets the statistics. Their **minimum** and **maximum** are kept with it: `showMinMax` draws them as a lighter band around the curve, and the tooltip shows `min / mean / max`, with the interval of time the point covers. A column holding a single value of the history draws it as is: zoomed in, every value is there, point by point. Whether the values come from the statistics or the history, see [Long term statistics](#long-term-statistics).
- **Aggregated — groups of your own.** See [Aggregation](#aggregation): a point a day, an hour, or `pointsPerHour` points an hour, each the function you choose.
- **Timelines — merged under 2 pixels.** States following each other that are each narrower than 2 pixels — too thin to tell apart, or to point at — are merged into one *multiple* block; zoom in and they appear. A state 2 pixels wide or more is always drawn, and a short state alone, between two longer ones, keeps its own color. A timeline of directions (`arrowline`), or with a `process` function, is never merged.

![image](https://user-images.githubusercontent.com/60828821/203882385-461d3376-58e1-4344-861f-852c150bd01a.png)

### Aggregation

Instead of a point per column of pixels, a curve can have a point per group of time you choose, each given by the function you choose — mini-graph-card's `points_per_hour`, `aggregate_func` and `group_by`, which are names of these options. On the card, a graph, an entity or in `entityOptions`:

| Option | Values | |
|---|---|---|
| `pointsPerHour` (`points_per_hour`) | a number > 0 | groups of 1 / `pointsPerHour` hours, on the day's grid (`0.5`: 0:00, 2:00, 4:00…) |
| `groupBy` (`group_by`) | `interval` (default), `hour`, `date` | `hour`: an hour each; `date`: a day each, from midnight to midnight — and a bar graph's interval hourly or daily, unless set |
| `aggregateFunc` (`aggregate_func`) | `avg` (default), `median`, `min`, `max`, `first`, `last`, `sum`, `delta`, `diff` | each group's value: its mean (each value weighted by how long it lasted), median, lowest, highest, first, last, the sum of its values, its highest less its lowest, its last less its first |

In the YAML, the same entity can be written several times in one graph, each with its own `aggregateFunc` — its highest, its lowest and its mean, as mini-graph-card shows them; the card's gestures never put a curve twice in a graph. A group is never narrower than a column of pixels. A group without any value carries the value before (`delta` and `diff`: 0). The min/max band (`showMinMax`) is each group's lowest and highest, whatever the function. On a bar graph, `aggregateFunc` gives each bar the function over its interval (`max`: the day's total of a sensor reset every day). Where the long-term statistics are drawn (long windows), an hour of them counts as one value, its mean: `median`, `first`, `last`, `sum` and `diff` are then approximate — exact where the history is loaded.

```yaml
type: custom:history-explorer-card
defaultTimeRange: 1w
groupBy: date                 # a point a day
graphs:
  - type: line
    entities:
      - entity: sensor.outside_temperature
        aggregateFunc: max
      - entity: sensor.inside_temperature
        aggregateFunc: min
```

---

## Values over a graph, a compact look

A graph can show, over its plot:
- **`showState: true`** — each curve's value now, in large, in its color and unit (the first one on the left, the last one on the right), updated with the entity; the times shown over a graph are written as the time axis writes them (`hour24`, else Home Assistant's own setting);
- **(hover)** — a hover on a curve shows, in place of its value now, the value it's on with its time, as mini-graph-card does; a value or a name cut (a narrow card) is shown in full while hovered, and on a click; a click on a value opens its entity's dialog (with the info panel when it's on);
- **`showStats`** — each curve's statistics over the time window shown: `min`, `average`, `max` (a name or a list; `true`: all three), on a row — the minimum and the maximum with their time (the hour on a window of a day or less, else the date and the hour). Taken from the values loaded — the history, or the statistics where the curve is drawn from them (each hour's own minimum and maximum) — never from the points drawn, between the start of the window and its end (or now); the average is weighted by time — each value counts for as long as it lasted. Recomputed as the window moves or zooms, and when new values arrive. With several curves showing them, each row is named after its curve. For curves (lines) only.

A curve hidden from its legend shows neither. Both are set at every level — card, `entityOptions`, graph, entity (`showStats: false` on one curve of a graph that shows them turns them off for it).

`showStateFor` and `showStatsFor` — on a graph or the card — say which curves a graph's or the card's `showState` and `showStats` are for: `all` (the default), or `first` — its first curve only, as mini-graph-card shows its first entity's; the others then show theirs only when it's set on them (on the entity, or in `entityOptions`: mini-graph-card's `show_state` on an entity). `stateAdaptiveColor: false` (mini-graph-card's `state_adaptive_color`, on the card, a graph, an entity or in `entityOptions`) writes a curve's values in the text's color instead of its own (the default); its `showIndicator` dot keeps the curve's color.

The values' place along their row: `alignState` — `left` (the default), `center`, `right`; their size: `fontSize`, a percentage (`80`); `showIndicator` on an entity: a dot in its color before its value.

Above them, a graph's **header** — its name and its icon, as mini-graph-card shows them —, set on a graph or on the card:
- **the name** — the graph's `title`; `showName: true` without one, its first curve's name; `showName: false`, none;
- **`showIcon: true`** — an icon: `iconImage` (an image's address), else `icon` (`mdi:home`), else the entity's own, else one by its device class (a thermometer for a temperature…);
- **`alignHeader`** — `center` (the default), `default` (the name on the left, the icon on the right), `left`, `right`; **`alignIcon`** — `right` (the default), `left`, or `state`: with the values, at the end of their row;
- **`fontSizeHeader`** — its size in pixels; **`nameAdaptiveColor`**, **`iconAdaptiveColor`** — the name, the icon in the color of the first curve now.

`showCurrentValues: false` — on the card, a graph, an entity or in `entityOptions` — leaves a curve's value now out of its legend label (mini-graph-card's `show_legend_state`, on an entity, shows it).

`showGraph: false` on an entity (mini-graph-card's `show_graph`) leaves its curve undrawn and out of the legend; its value is still shown over the graph. On a graph or the card (mini-graph-card's `show.graph: false`), none of its curves is drawn: no plot, only the header and the values.

Three more options shape the graph itself:
- **`showGrid: false`** — no grid lines;
- **`yLabels: inside`** — the Y labels drawn inside the plot, over the curves, each in a box of the card's background, just above their grid line, at mini-graph-card's size, the plot then taking the whole width (an axis is moved by a drag along its labels, see [Y axis scaling](#y-axis-scaling)). A card narrower than 300 px draws them so by itself, its other text a little smaller; `yLabels: outside` keeps them beside the plot whatever the width;
- **`fill: fade`** — the area under a curve filled with its own color, fading out downwards.

**`look: mini`** sets, for the whole card, what [mini-graph-card](https://github.com/kalkih/mini-graph-card) shows: `header: hide`, `uiLayout: { toolbar: hide, selector: hide, interval: hide }`, `showState: true`, `showStateFor: first`, `showStatsFor: first`, `stateAdaptiveColor: false`, `showTimeLabels: false`, `showGrid: false`, `yLabels: inside`, `fill: fade`, `height: 150`, `lineWidth: 5`, `lineMode: curves`, `interpolation: bspline`, `colorTransition: smooth`, `showName: true`, `showIcon: true`, `alignHeader: default`, `fontSizeHeader: 14`, `showCurrentValues: false`, `legendVisible: auto`, `labelsLeft: hover`, `labelsRight: hover`. It only gives defaults: every option set on the card itself still wins over the look's, under any of its names (`look: mini` with `showGrid: true` keeps the grid). Its options in mini-graph-card's syntax: see [Replacing mini-graph-card](#replacing-mini-graph-card). Unlike mini-graph-card, the time can still be panned and zoomed — a drag, the wheel with Ctrl, a pinch — and the statistics follow the window shown.

```yaml
type: custom:history-explorer-card
look: mini
defaultTimeRange: 24h
graphs:
  - title: Rain
    entities:
      - entity: sensor.rain_rate
        name: Rate
        color: orange
      - entity: sensor.rain_total
        name: Total
        showState: true         # its value now too, beside the first one's
```

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/Cook23/history-explorer-card/raw/v1.2-dev/images/screenshots/narrow-and-mini-dark.png">
  <img alt="A card 168 px wide; look: mini, 374 and 168 px wide" src="https://github.com/Cook23/history-explorer-card/raw/v1.2-dev/images/screenshots/narrow-and-mini.png">
</picture>

*Left: a card 168 px wide (two cards side by side on a phone). Middle and right: `look: mini`, 374 and 168 px wide.*

**A narrow card** — narrower than 300 px (two cards side by side on a phone, a grid of small cards), the card keeps its graphs readable, as mini-graph-card does: the toolbar's date, range and search each on a line of their own; the Y labels inside the plot (as `yLabels: inside`, `yLabels: outside` keeping them beside it), which keeps its width; the text a little smaller; the legend's names shortened, each value kept; the values over a graph, the first one large, the others small on its right. A menu takes the room there is, a tooltip stays within the screen. In detail:
- the toolbar: when even the short date and the range don't fit side by side, the date (‹ ›), the range (🔍 − + and its name) and the entity search each on a line, centered;
- the Y labels inside the plot, each in a box of the card's background 80 % opaque (opaque while the pointer is near them), at mini-graph-card's size (10.5 px), a label whose box would touch another one skipped; dragged along them, an axis moves (a finger or a pen: a tap, then a second press right away) — a click, a long press or a hover there are the curves' (see [Y axis scaling](#y-axis-scaling));
- the handle, the padlock, the chain icon and the close button each in a box like the Y labels', over the legend's labels or a timeline's rows, taking no room — on the box a gesture is theirs, beside it the label's;
- the legend, the time labels and a timeline's text in 11 px (12 px, and 13 px for a timeline's states, otherwise); the legend's lines below the first taking the whole width; the time labels that would overlap skipped;
- the legend's names shortened, every curve of the graph at the same step: a qualifier many entities carry as its initials (`(Filtered)` → `(F)`), the start of the name — the device's name, or the words shared with another curve — abbreviated (`M-F V…`), the articles removed, that start removed where two curves don't then read the same, then '…' before the value;
- the values over a graph (`showState`): the first curve's large, the others small in a column on its right, each cut ('…') rather than wrapped; the statistics a little smaller;
- a menu takes the room there is, opening without a submenu (a submenu then leaves the start of its lines); a tooltip wider than the card stays within the screen.

The card follows its width as it changes (a screen turned, a window resized).

> Thanks to [mini-graph-card](https://github.com/kalkih/mini-graph-card) (kalkih) for its good ideas on showing a graph in little room — the labels in boxes inside the plot and their size, the first value large and the others small, names cut rather than wrapped — which this card follows.

---

## mini-graph-card compatibility

### Replacing mini-graph-card

A mini-graph-card is replaced in place: `type: custom:history-explorer-card` and `look: mini` — its other lines unchanged.

```yaml
type: custom:history-explorer-card    # was custom:mini-graph-card
look: mini                            # mini-graph-card's look
name: Power
hours_to_show: 12
show:
  fill: false
entities:
  - sensor.power
  - entity: sensor.rain
    y_axis: secondary
```

Its options are aliases of the card's — names and values, each in the [complete list of options](#complete-list-of-entityoptions-properties) — mixed freely with the card's own names. `look: mini` only gives defaults: any option set, under either name, wins. Its forms are read as they are: `show:` (`show: { fill: false }` is `show_fill: false`); the card's own `entities` — one graph, `name` its title, `show: graph: bar` its type; an entity written as its entity_id alone; `unit`, `color` and `fill` on the card — every entity's. `height` is the graph's (the header's lines not counted); `update_interval` is the card's automatic refresh (on by default: each change, at most every 2 s). An entity's `attribute:` is the card's own (an attribute shown instead of the state, see [YAML configuration for preconfigured graphs](#yaml-configuration-for-preconfigured-graphs)); `tap_action` is `tapAction`; a hover on a curve shows the value it's on over the graph, as mini-graph-card does (`showState`). `smoothing: true` draws curves (`lineMode: curves`), with mini-graph-card's interpolation under `look: mini` (`interpolation: bspline`).

Written differently in the card's syntax:

| mini-graph-card | history-explorer-card |
|---|---|
| `show.extrema`, `show.average` | `showStats: [min, max]`, `showStats: [average]` (both: `[min, average, max]`) — under `look: mini`, the first curve's (`showStatsFor: first`) |

`points_per_hour`, `aggregate_func` and `group_by` are the card's own `pointsPerHour`, `aggregateFunc` and `groupBy` (see [Aggregation](#aggregation)); a sub-attribute (`attribute: forecast.0.temperature`) is read as mini-graph-card reads it. The Y axis' options too — soft bounds (`lower_bound: ~0`), `min_bound_range`, the `_secondary` ones, `logarithmic`, `show.labels` and `show.labels_secondary` with their `hover` (see [Y axis scaling](#y-axis-scaling), [Bounds](#bounds), [Two Y axes](#two-y-axes)) —, `show.legend` (shown only for several curves under `look: mini`, see [Legend / entity labels](#legend--entity-labels)), `value_factor`, `state_map` (see [Text states as a curve](#text-states-as-a-curve)), `line_color` and `color_thresholds_transition` (see [Colors of curves and bars](#colors-of-curves-and-bars)), an entity's `show_line`, `show_legend` and `fixed_value` (see [Line stroke style](#line-stroke-style)), `bar_spacing` (see [Bar graphs for total increasing entities](#bar-graphs-for-total-increasing-entities)), and `hour24` (see [The clock](#the-clock)); the header's options — `show.name`, `show.icon`, `icon`, `icon_image`, `align_header`, `align_icon`, `align_state`, `font_size`, `font_size_header`, `show.name_adaptive_color`, `show.icon_adaptive_color` — an entity's `show_state`, `state_adaptive_color`, `show_indicator`, `show_legend_state` and `show_graph`, and `show.graph: false` (see [Values over a graph, a compact look](#values-over-a-graph-a-compact-look)). `animate`, `cache`, `compress`, `group` and `loading_indicator` are accepted, without effect: the card draws at once, loads what the screen shows (see [Long term statistics](#long-term-statistics)) and keeps nothing in the browser's cache.

---

## Default view and time ranges

When the dashboard is opened, the card will show the last 24 hours by default. You can select a different default time range in the YAML. Use m, h, d, and w to denote minutes, hours, days and weeks respectively. For longer time scale, o and y denote months and year. The maximum range is one year. If no postfix is given, hours are assumed.

`defaultTimeRange` uses "last one to speak wins" logic: changing the YAML value overrides the user-adjusted time range only when the YAML value actually changes. The user-adjusted time range is otherwise preserved across reloads and devices via HA user storage.

```yaml
type: custom:history-explorer-card
defaultTimeRange: 4h     # show the last 4 hours when opening the card
                         # or: 15m (15 minutes), 2d (2 days), 3w (3 weeks), 6o (6 months), 1y (1 year)
```

By default the card will open the graphs with the current date and time aligned to the right of the chart. You can define a custom time offset using the `defaultTimeOffset` setting which will be applied when you open the card or click the date button. Both relative time offsets (denoted by lower case time identifiers such as `h,d,w,o,y`) and offsets snapped to the current hour, day, month or year are supported. The latter will use upper case time identifiers `H,D,O,Y`. For example:

```yaml
type: custom:history-explorer-card
defaultTimeOffset: 1h       # Add 1 hour of empty space after the current time
                            # or: -1d — show the previous day's data
                            # or: 1D — show the current day from midnight to midnight
                            # or: 1O — show the entire current month, starting at the 1st
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

---

## Auto refresh

The card can reflect changing values on the fly in two ways. Both can be combined if needed.

Automatic refresh monitors the entities that are displayed in your graphs for changes and reloads their recent data — the last minutes of history and today's statistics, today's history where the graph is drawn from the history — at most once every 2 seconds, however often they change, and never sooner than five times what drawing the graphs again last took: many graphs over a long window are refreshed less often, the page never kept busy. Their current values (next to their names, `showCurrentValues`, and over the graph, `showState`) follow each change at once. It's on by default; turn it off with `automatic: false` (the card then refreshes only when the page is reloaded, or at the interval below):
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

---

## Entity options

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

| Property | Type | Name aliases | Value aliases | Description |
|---|---|---|---|---|
| `type` | string | `graph` | | Graph type: `line`, `bar`, `timeline`, `arrowline` |
| `colorTransition` | string | `color_thresholds_transition` | | `smooth`: thresholds blended from one to the next; `hard` (default): each value its threshold's color — see [Colors of curves and bars](#colors-of-curves-and-bars) |
| `lineColor` | string or list | `line_color` | | On a graph or the card: a color, or a list of colors — each entity without its own color takes the one at its place in the graph |
| `color` | string, list or object | `color_thresholds` | thresholds as a list: `[{ value: 0, color: blue }, green, { value: 20, color: red }]` — a stop without a value spaced between its neighbours | Line/bar color: a color, thresholds (on the value, or on another entity's), or an entity holding either — see [Colors](#colors-of-curves-and-bars) |
| `fill` | string or boolean | `show_fill` | `true`: the curve's color, light; `false`: none | Fill color under the line, or `fade`: the curve's color fading out downwards |
| `lineWidth` | number | `width`, `line_width` | | Line width in pixels |
| `lineMode` | string or boolean | `smoothing` | `true` = `curves`, `false` = `lines`; `line`, `curve`, `step` | Interpolation mode: `curves`, `lines`, `stepped`, `smart` |
| `interpolation` | string | | `akima` = `makima`, `catmull-rom`, `b-spline` | Interpolation algorithm in `curves` and `smart` modes: `monotone` (default), `steffen`, `makima`, `catmullrom`, `bspline` — see [Curve interpolation](#curve-interpolation) |
| `dashMode` | string or array | `line_style` | dashes and gaps as CSS writes them: `'10,10'` | Stroke style: `solid`, `points`, `shortlines`, `longlines`, `pointline`, or custom `[on, off, ...]` array |
| `showLine` | boolean | `show_line` | | `false`: its points only, no line between them |
| `showGraph` | boolean | `show_graph` | `show.graph: bar` / `line`: drawn | `false`: not drawn, nor in the legend, its value kept over the graph; a graph none of whose curves is drawn shows no plot — see [Values over a graph](#values-over-a-graph-a-compact-look) |
| `fixedValue` | boolean | `fixed_value` | | `true`: its last value in the window, flat over the whole window — see [Line stroke style](#line-stroke-style) |
| `showPoints` | string, boolean or number | `showSamples`, `show_points` | | Dots at the measurement points: `hover` (default) only the hovered one; `true` all, the line width + 2 px wide, or a radius in px; `false` none, not even the hovered one |
| `yAxis` | string | `y_axis` | `primary` = `left`, `secondary` = `right` | `auto` (default), `left` or `right`: the Y axis of a line or bar entity. `auto`: a graph with two groups of compatible units puts the second one on the right; with more, every curve shares the left axis. Also on a graph or the card, for every curve that doesn't set its own |
| `rounding` | number | `decimals` | | The decimals of its values — exactly that many (`1`: `20.0`); not set: at most 2 — see [Rounding](#rounding) |
| `tapAction` | string or object | `tap_action` | an action's name alone: `tapAction: none` | What a click on its value does (in the legend, over the graph): Home Assistant's actions — `more-info` (default: its dialog, with the info panel when it's on), `navigate` (`navigation_path`), `url` (`url_path`), `perform-action` (`perform_action`, `data`, `target`), `call-service` (`service`, `service_data`), `none` |
| `scale` | number | | | Multiply all values by this factor before drawing (see [Scaling values](#scaling-values-scale-unit-and-valuefactor)). Without `unit`, it only changes how the curve is drawn: the legend and tooltip show the entity's real value. With `unit`, it's a conversion into that unit: the legend and tooltip show the converted value (e.g. `scale: 0.001` and `unit: kW` for a power in W) |
| `unit` | string | | | Unit shown instead of the entity's own (see `scale`) |
| `valueFactor` | integer | `value_factor` | | Its values shown and drawn multiplied by 10 to that power (`-3`: 400 W shows 0.4) — see [Scaling values](#scaling-values-scale-unit-and-valuefactor) |
| `stateMap` | list | `state_map` | | A text state drawn as a curve: each state (`off`, or `{ value: off, label: Off }`) at its place in the list — 0, 1, 2… —, its label shown in the legend, the tooltip and on the Y axis — see [Text states as a curve](#text-states-as-a-curve) |
| `hidden` | boolean | | | Hide this entity by default in the legend |
| `legendVisible` | boolean or `auto` | `show_legend` | | `false` on an entity: no label for it in the legend (on the card: no legend); `auto` on the card: a graph's legend only for several labels |
| `ymin` | number or `~`number | `lower_bound` | | Set the initial Y axis minimum (can still be modified interactively; restored when padlock is unlocked); `~0`: soft — the minimum unless the values go below it — see [Bounds](#bounds) |
| `ymax` | number or `~`number | `upper_bound` | | Set the initial Y axis maximum, the same way |
| `yminRight`, `ymaxRight` | number or `~`number | `lower_bound_secondary`, `upper_bound_secondary` | | The right Y axis' own bounds (else `ymin` / `ymax`) — see [Two Y axes](#two-y-axes) |
| `yrange`, `yrangeRight` | number | `min_bound_range`, `min_bound_range_secondary` | | The smallest range the Y axis (the right one) shows — see [Bounds](#bounds) |
| `logarithmic` | boolean | | | A logarithmic Y axis (a line graph) |
| `labelsLeft` | boolean or `hover` | `show_labels` | | The left Y axis' labels: `false` none, `hover` shown while the pointer is over the graph — see [Y axis scaling](#y-axis-scaling) |
| `labelsRight` | boolean or `hover` | `show_labels_secondary` | | The right Y axis' labels, the same way |
| `ystepSize` | number | `ystepsize` | | Fix the Y axis tick step size |
| `ylock` | boolean | | | Disable all interactive Y axis pan and zoom for this graph |
| `height` | number | | | Graph height in pixels (overrides global height settings) |
| `decimation` | | | | Accepted, without effect: see [Data decimation](#data-decimation) |
| `interval` | string | | | Default bar interval: `10m`, `hourly`, `daily`, `weekly`, `monthly` |
| `circular` | `null`, `false`, number or `2pi` | | | Angles drawn without jumps at 0/360 — see [Circular values](#circular-values-angles) |
| `netBars` | boolean | | | Enable net metering mode for bar graphs |
| `stacked` | boolean | | | Stack bars on top of each other rather than side by side (bar graphs with multiple entities) |
| `barSpacing` | number | `bar_spacing` | | The room between two bars, in pixels |
| `process` | string | | | Javascript expression to transform state values before display |
| `pointsPerHour` | number | `points_per_hour` | | Points an hour: groups of 1 / `pointsPerHour` hours — see [Aggregation](#aggregation) |
| `groupBy` | string | `group_by` | | `interval`, `hour`, `date` — see [Aggregation](#aggregation) |
| `aggregateFunc` | string | `aggregate_func` | | `avg`, `median`, `min`, `max`, `first`, `last`, `sum`, `delta`, `diff` — see [Aggregation](#aggregation) |
| `showMinMax` | string or boolean | | | A lighter band between the min and max of each column of pixels: `true` (everywhere), `statistics`, `history`. See [Showing the min/max statistical range](#showing-the-minmax-statistical-range) |
| `showTimeLabels` | boolean | | | Show or hide the horizontal time axis labels on a timeline or arrowline graph. Default is `true`. |
| `showState` | boolean | `show_state` | | The curve's value now, in large, over the graph — see [Values over a graph](#values-over-a-graph-a-compact-look) |
| `showIndicator` | boolean | `show_indicator` | | A dot in its color before its value over the graph |
| `showCurrentValues` | boolean | `show_legend_state` | | `false`: its value now left out of its legend label |
| `showName`, `showIcon` | boolean | `show_name`, `show_icon` | | On a graph or the card: the header's name (its title, else its first curve's name) and icon — see [Values over a graph](#values-over-a-graph-a-compact-look) |
| `icon`, `iconImage` | string | `icon_image` | | On a graph or the card: the header's icon (`mdi:home`), or an image's address |
| `alignHeader`, `alignIcon`, `alignState` | string | `align_header`, `align_icon`, `align_state` | | On a graph or the card: the header's layout (`center`, `default`, `left`, `right`), the icon's place (`right`, `left`, `state`), the values' place (`left`, `center`, `right`) |
| `fontSizeHeader`, `fontSize` | number | `font_size_header`, `font_size` | | On a graph or the card: the header's size in pixels; the values' size, a percentage |
| `nameAdaptiveColor`, `iconAdaptiveColor` | boolean | `show_name_adaptive_color`, `show_icon_adaptive_color` | | On a graph or the card: the header's name, its icon in the color of the first curve now |
| `showStats` | boolean, string or list | `show.extrema`, `show.average` | | The curve's `min`, `average` and `max` over the window shown, over the graph (`true`: all three) |
| `showStateFor`, `showStatsFor` | string | | | `all` (default) or `first`: a graph's or the card's `showState`, `showStats` for its first curve only, the others' set on them — see [Values over a graph](#values-over-a-graph-a-compact-look) |
| `stateAdaptiveColor` | boolean | `state_adaptive_color` | | `false`: its values over the graph in the text's color |
| `showGrid` | boolean | | | `false`: no grid lines on the graph |
| `yLabels` | string | | | `inside`: the Y labels inside the plot, which takes the whole width |
| `exclude` | string, list, or `{entity: ...}` | | | Exclude matches from a wildcard `entity:` pattern. Also settable under a graph's `options:` — see below |

Options of the card only, with aliases: `defaultTimeRange` (`hours_to_show`), `labelsVisible`; and `hour24` — see [The clock](#the-clock). mini-graph-card's `show:` is read as its options: `show: { points: true }` is `show_points: true`.

#### The same options at every level

Every option above, except `type`, `name`, `hidden`, `legendVisible`, `scale`, `process` and `circular` (an entity's only), `color` and `unit` (an entity's or the card's — the card's: every entity's), and `lineColor` (a graph's or the card's), can be set at four levels: on the card (for every graph), in `entityOptions`, on a graph (for its entities) and on an entity. When an option is set at several levels, the most specific one wins: **entity → graph → `entityOptions` → card**.

The options of the graph itself — `ymin`, `ymax`, `yminRight`, `ymaxRight`, `yrange`, `yrangeRight`, `ystepSize`, `ylock`, `logarithmic`, `labelsLeft`, `labelsRight`, `stacked`, `barSpacing`, `height`, `showTimeLabels`, `showGrid`, `yLabels` — set on an entity or in `entityOptions`, apply to the graph the entity is shown in; the graph's own value wins. `height` on the card sets the height of every line and bar graph; `lineGraphHeight` / `barGraphHeight` set their own and win over it.

An option is spelled the same at every level, and its aliases — the names and values in the list above, mini-graph-card's among them — are accepted everywhere, mixed freely with the card's own names (an option set under two names: the card's own name wins). A graph's options can be set under its `options:` or directly on the graph, next to `type:` and `entities:` (`options:` wins if both are set):

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

`fill`, `showMinMax`, `showState`, `showStats`, `dashMode`, `lineMode`, `interpolation`, `lineWidth`, `showPoints`, `netBars` and `exclude` set on a graph act as the default for every entity in that graph. An entity's own value (if set directly on it) always wins over the graph default. `options.exclude` is the one exception to "most specific wins": it combines with each wildcard entity's own `exclude:` rather than being overridden by it, so both apply together. This is especially useful with several wildcard `entity:` patterns sharing one graph — set the common styling once instead of repeating it on each pattern:

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

  - match: ["sensor.pressure*", "sensor.humidity*"]
    lineMode: lines
    ymin: 0

  - entity: sensor.sun_azimuth
    type: arrowline
    color: red
```

The `match` field accepts a single glob pattern string or a list of patterns. `*` matches any sequence of characters, `?` matches a single character. Patterns are tested against the full entity id (e.g. `sensor.outside_temperature`). The `entity` field can be used instead of `match` for exact entity id matches.

#### Priority rules

`entityOptions` is either a dict or a list, not both:
- **dict form** — the entry of the entity id if there is one, else the entry of its device class, else the entry of its domain (one entry only, never merged);
- **list form** — every entry whose `match` (or `entity`) matches the entity id applies: the first one wins for each option, the later ones fill in the options it doesn't set. Device classes and domains aren't matched in this form — use a pattern (`sensor.*temperature*`).

Either way, an option set on a graph or on the entity itself wins over `entityOptions` (see [The same options at every level](#the-same-options-at-every-level)).

---

## Configuring the UI

### The options menu

The ▾ button beside the entity selector opens the options menu, in submenus:
- **Export ▸** — *History* (the history of the entities shown, over the time window shown), *Statistics* (their long-term statistics, with long-term statistics on), each as a CSV file;
- **Card ▸** — *Default graphs ▸*: the graphs added from the card removed, the YAML's kept as you changed them; *Default display ▸*: back to the YAML — the graphs added from the card removed, every change made from the card to the YAML's forgotten (their order, display, interpolation, colors, splits, hidden curves, points), and the YAML's time range. Each is confirmed in a submenu over *Card ▸*, right-aligned on it (*Confirm* / *Cancel*, Cancel marked: Enter changes nothing; Cancel, ← or Escape close it). Saved as any change: it reaches your other devices for what they share (a hidden curve and its points stay each device's own);
- **Global ▸** — what applies to every card of every dashboard, on every device: *Enhanced native history*, a switch turning the info panel on (green) or off (red) — see `defaultInfoPanel` —, and the gesture settings below, entered right in the submenu.

Arrows move through it, Enter or → opens a submenu, ← or Escape goes back.

### Gesture settings

Every gesture is told apart by two thresholds, one pair for a mouse or a pen, one for a finger:
- **the long-press duration** — a press held this long is a long-press; a second press this soon after a release, at the same place, is a double-click (or a tap-then-drag); after a tap on a label, a graph's ⠿ zone or the Y axis, the page doesn't scroll from there for that long, so that a drag can follow;
- **the precision** — a pointer that moved further than this is dragging; a second press within it of the first is at the same place; a label, a button or a curve within it of the pointer can be picked.

Raise them for a less steady or slower hand. In the YAML (any card), or in *Global ▸* of the options menu:

```yaml
type: custom:history-explorer-card
gestures:
  longPress: 500        # ms, mouse and pen (200 to 2000; default 500)
  longPressTouch: 500   # ms, finger
  precision: 8          # px, mouse and pen (4 to 20; default 8)
  precisionTouch: 12    # px, finger (4 to 20; default 12)
```

A value out of bounds is brought within them. They apply to every card and info panel of the page: whether set in a card's YAML or in the menu, the last one to speak wins, and they are kept on every device, whatever the card's persistence options — as the info panel's switch.

### Header text

The default *History Explorer* header can be changed or removed using the header setting in the YAML:
```yaml
type: custom:history-explorer-card
header: 'My sample history'
              # or: ' ' — a single space removes the header and leaves some padding space
              # or: hide — removes the header entirely
```

### Dark mode

The card will try to adapt its UI colors to the currently active theme. But for best results, it will have to know if you're running a dark or a light theme. By default the card asks HA for this information. If you're using the default Lovelace theme, or another modern theme that properly sets the dark mode flag, then you should be all set with the default settings. If you are using an older theme that uses the legacy format and doesn't properly set the dark mode flag, the card may end up in the wrong mode. You can override the mode by adding this YAML to the global card settings (see below) to force either dark or light mode:

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
  closeButton: '#0000001f'  # the bar interval selector's background
  cursorline: '#ff000080'   # Color of the vertical cursor line (see The cursor line below)
```

### The cursor line

While the pointer is over a graph's plot area (a mouse, or a pen held above the screen), a thin vertical line follows it: an easy way to read the time of a change, and to compare it across graphs. By default it's drawn on timelines only. `cursor` sets where:

```yaml
type: custom:history-explorer-card
cursor:
  mode: auto          # auto (the default): on the graph under the pointer only
                      # all: on every graph of the card at once, at the same time — to line events up
                      # hide: never
  types: [timeline]   # the graphs that show it, by type: timeline (the default), line, bar,
                      # arrowline — or all
uiColors:
  cursorline: '#ff000080'   # its color (the gridlines' color by default)
```

With `mode: all`, the line follows the pointer on every graph of the card as soon as the pointer is over a graph whose type is listed in `types`. For example, to line up a heating timeline with the temperature curves:

```yaml
type: custom:history-explorer-card
cursor:
  mode: all
  types: [line, timeline]
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

The width of the label area to the left of the graphs can be customized, and the names left of the timelines' rows hidden, with the following YAML (the Y axes' labels: `labelsLeft` and `labelsRight`, see [Y axis scaling](#y-axis-scaling)):

```yaml
type: custom:history-explorer-card
labelsVisible: false   # this will hide the entity names left of the timelines' rows
labelAreaWidth: 10     # the width of the label area in pixels, default is 65
```

### Graph sizes

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

The tooltip popups used in timelines and arrowlines support three different sizes: full, compact and slim. By default, the size is selected automatically depending on the available space around the graph. The size can be overridden manually:

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

### The clock

The times are shown with Home Assistant's own clock setting (12 or 24 hours). `hour24: true` shows the 24-hour clock, `hour24: false` the 12-hour one, whatever that setting.

```yaml
type: custom:history-explorer-card
hour24: true
```

### Changing the horizontal time tick density

By default, time tick density is automatic and adjusts to the width of your screen. That's always a compromise between looking good (no clipping), being readable at all screen sizes from mobile to wall sized 8k TV and subjective preferences over tick densities. In most cases, the default automatic selection will yield good results. But if needed, the density can be customized using the `timeTicks` setting.

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

And same as above but setting the dateFormat to short:

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

The raw data for the currently displayed entities and time range can be exported as a CSV file by opening the options menu (▾ beside the entity selector) and selecting *Export ▸ History* (*Export ▸ Statistics* for the long-term statistics). Note that CSV exporting does not work in the HA Companion app. Both history and long term statistics can be exported.

![image](https://user-images.githubusercontent.com/60828821/203881276-1332c8bd-d83c-4ff6-9a9b-9b43cb4a6c44.png)

The exported CSV can be customized. The following settings are optional. If they are not present, the defaults will be used.
```yaml
type: custom:history-explorer-card
csv:
  separator: ';'            # Use a semicolon as a separator, the default is a comma
  timeFormat: 'DD/MM/YYYY'  # Customize the date/time format used in the CSV. The default is 'YYYY-MM-DD HH:mm:ss'.
  statisticsPeriod: hour    # Period used for statistics export. Hour, day or month is supported. Default is hour.
  exportAttributes: true    # Export all entity attributes along with their state, in separate columns. Default is off (no attributes).
  numberLocale: 'en-US'     # Format numbers using the given locale. If this setting is not defined, the raw DB values will be written (no formatting).
```

---

## YAML configuration for preconfigured graphs

YAML configuration is optional. And while the interactive configuration is preferable, it can sometimes be useful to keep a set of predefined entities.

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

The same entity (or attribute) written several times in the YAML is a curve each time — in several graphs, or in one (mini-graph-card's way of showing a sensor's highest, lowest and mean values, each with its `aggregateFunc`) —, each with its own options, saved on its own. From the card, a second curve of an entity already shown is created after a choice (see [Adding entities](#adding-entities)); a curve dropped or pasted onto a graph already showing it is refused, saying so.

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

### Attributes

`attribute:` shows one of an entity's attributes instead of its state — the same entity can be shown several times, its state and some of its attributes. A number is shown as a curve, anything else as a timeline; a number followed by a text that isn't one (`45.2 %`, `21.5 °C`, `3 days` — not a time, a date or a range) is that number, in that unit. The curve is named after the entity, a colon and the attribute — `salon : Current temperature`, the colon telling an attribute from an entity (`name:` to change it). Otherwise its unit is the one Home Assistant shows it in (the tables of its frontend). On a weather entity: `temperature_unit` for `temperature`, `apparent_temperature`, `dew_point` and `templow`, `wind_speed_unit` for `wind_speed` and `wind_gust_speed`, `pressure_unit`, `visibility_unit` and `precipitation_unit` for their own, `%` for `humidity`, `cloud_coverage` and `precipitation_probability`, `°` for `wind_bearing` (which Home Assistant gives without a unit). On any other entity: in your temperature unit, `temperature`, `current_temperature`, `target_temperature`, `target_temp_high`, `target_temp_low`, `target_temp_step`, `min_temp` and `max_temp`; in %, a climate's or a humidifier's humidities (`humidity`, `current_humidity`, `min_humidity`…), a cover's or a valve's `current_position` (and a cover's `current_tilt_position`), a fan's `percentage`, a sensor's `battery_level`, a light's `brightness` and a media player's `volume_level` — those two converted, from 0–255 and 0–1, the curve, the selector and the tooltip all in %; a light's `color_temp_kelvin` (and its min and max) in K, its `color_temp` (and `min_mireds`, `max_mireds`) in mired; the sun's `azimuth` and `elevation` in °. Otherwise, as some integrations give them, an attribute `X_unit` is the unit of every attribute with `X` in its name (`speed_unit: km/h` for `speed` and `max_speed`, the longest `X` when several match). Else set `unit:`; `unit:` always wins. Home Assistant gives an attribute no long-term statistics: an attribute's curve only covers what the history keeps. Its history is asked with every change of the entity's attributes (Home Assistant otherwise leaves out the changes of an attribute alone), only for the entities that have an attribute shown. Writing the attribute after the entity id is the same: `entity: climate.salon.current_temperature`. A sub-attribute, in a dictionary or a list, is written by its path, as mini-graph-card writes it: `attribute: forecast.0.temperature` (the attribute, then each level's key or index); named after each level (`Villeveyrac : Forecast › 0 › Temperature`), in the unit of its last name (`temperature`). In the entity selector, an attribute holding some is marked ▸: a click shows them in the same submenu, over the attributes (← or Escape: the level before; the entity's line again: its attributes). A list of plain values (`hvac_modes`) is not offered: a set of choices, nothing to follow.

```yaml
type: custom:history-explorer-card
graphs:
  - type: line
    title: Salon
    entities:
      - entity: climate.salon
        attribute: current_temperature
        unit: °C
      - entity: climate.salon
        attribute: temperature          # the setpoint
        unit: °C
  - type: timeline
    entities:
      - entity: climate.salon           # its state: heat, off…
      - entity: climate.salon
        attribute: hvac_action          # heating, idle…
```

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

Protectable/coverable fields (`order` isn't one of them — it's card-level only, see [Enabling persistence](#enabling-persistence-enable_persistence--enable_multidevice_persistence)): `type`, `color`, `fill`, `hidden`, `interval`, `name`, `scale`, `siConversionFactor`, `dashMode`, `lineMode`, `interpolation`, `width` (the line width), `showPoints`, `showMinMax`, `unit`, `process`, `netBars`, `circular`, `groupId`. `hidden` and `showPoints` are never synced across devices: `enable_multidevice_persistence` keeps them on this device only, as `enable_persistence` does. `groupId` also covers how a YAML graph was split into linked graphs (double-click); the order of those linked graphs within their block follows `order`, like the order of everything else.

This entity-level option only applies to static entities defined here in `graphs:`. Entities added dynamically through the UI have no YAML entry to attach it to — they're governed entirely by the card-level `enable_persistence`/`enable_multidevice_persistence` (which default to `all` for a purely dynamic card, see above).

---

## Running as a panel in the sidebar

The history explorer can be run as a sidebar panel. Add a new empty dashboard with the `Show in sidebar` box checked. Set the view type to `Panel (1 card)` and add the history explorer card to the view.

![image](https://user-images.githubusercontent.com/60828821/161340801-f1f97e90-73c4-44d9-8afa-ba858906a2c1.png)
