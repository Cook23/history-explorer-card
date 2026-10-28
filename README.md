[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/v/release/Cook23/history-explorer-card?style=for-the-badge)](https://github.com/Cook23/history-explorer-card/releases)
[![GitHub stars](https://img.shields.io/github/stars/Cook23/history-explorer-card?style=for-the-badge)](https://github.com/Cook23/history-explorer-card/stargazers)
![Experimental](https://img.shields.io/badge/status-experimental-yellow?style=for-the-badge)

<a href="https://buymeacoffee.com/thierry_couquillou" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50"></a>

# History explorer card

> **A custom history card for Home Assistant — fork of [SpangleLabs/history-explorer-card](https://github.com/SpangleLabs/history-explorer-card).**
> For the complete reference documentation, see [README_Full.md](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md).
> New to this fork? See what it adds over the original card: [FORK_DESCRIPTION.md](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/FORK_DESCRIPTION.md) 🇬🇧 / [FORK_DESCRIPTION_FR.md](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/FORK_DESCRIPTION_FR.md) 🇫🇷

A highly interactive history card for Home Assistant. Pan, zoom, and explore your entity history across any time range, with full support for line charts, bar charts, timelines and compass arrow graphs.

![history-panel-sample](https://user-images.githubusercontent.com/60828821/147441073-5fbdeb2e-281a-4312-84f1-1ce5c835fc3d.png)

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
  - [HACS (recommended)](#hacs-recommended)
  - [Manual install](#manual-install)
- [Basic usage](#basic-usage)
- [Info panel — replacing the HA more info popup](#info-panel--replacing-the-ha-more-info-popup)
- [The options menu and the gesture settings](#the-options-menu-and-the-gesture-settings)
- [Adding entities](#adding-entities)
- [Choosing an entity's display type](#choosing-an-entitys-display-type)
- [Interactive graph management](#interactive-graph-management)
  - [Line graphs](#line-graphs)
  - [Linked graphs](#linked-graphs)
  - [Reordering graphs](#reordering-graphs)
  - [The graph menu, cut and paste](#the-graph-menu-cut-and-paste)
  - [Timeline and arrowline graphs](#timeline-and-arrowline-graphs)
- [Y axis control](#y-axis-control)
- [Time range and display defaults](#time-range-and-display-defaults)
  - [Real time](#real-time)
  - [Default range and persistence](#default-range-and-persistence)
- [Auto refresh](#auto-refresh)
- [Line chart appearance](#line-chart-appearance)
  - [Line mode](#line-mode)
  - [Curve interpolation](#curve-interpolation)
  - [Angles](#angles)
  - [Stroke style](#stroke-style)
  - [Individual sample dots](#individual-sample-dots)
  - [Min/max statistical band](#minmax-statistical-band)
  - [Unavailable data](#unavailable-data)
- [Bar charts](#bar-charts)
- [Timeline charts](#timeline-charts)
- [Compass arrow graphs](#compass-arrow-graphs)
- [Colors of curves and bars](#colors-of-curves-and-bars)
- [Long term statistics](#long-term-statistics)
- [Values over a graph, a compact look](#values-over-a-graph-a-compact-look)
- [mini-graph-card compatibility](#mini-graph-card-compatibility)
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
- **Elastic box**: with a mouse, a drag mostly up or down on a graph draws a box (the magnifying glass turns green meanwhile); released, the time zooms to it — the round duration that covers it, centred on it — and the Y axis to its values, its padlock closed. A box narrower or lower than the pointer's precision, or nearly as wide (or tall) as the curves' area, leaves that axis as it is — a box the curves' whole height zooms the time only; Escape cancels it. A long press on the magnifying glass (or a right click) chooses what the box zooms — the time (↔: a band the curves' height), the Y axis (↕: a band their width) or both (⤢) —, its symbol shown in the glass, kept as the time range is
- **Zoom**: use the time range selector (top right), mouse wheel + CTRL, or the magnifying glass icon (green while on) to draw the same elastic box with any pointer, a finger too — it goes off at the end of the next gesture on a graph, a press elsewhere, Escape or a click on it again; double-click the magnifying glass to get the default range back. In real time, a zoom keeps the present on the right — see [Real time](#real-time)
- **Date navigation**: use the `<` `>` buttons top left. The date is the first day shown: click it to pick another one in your browser's calendar (a day whose window reaches the present: real time); double-click it to return to the present (real time again)
- **Tooltip**: click near a curve to put it in the tooltip, near one of its values to see that value — a tooltip shows real values, never a point of the line between two; click near another curve to add it. The tooltip then moves to the value pointed at as the mouse (or a pen held above the screen, in the browsers that report it) moves; away from every value it stays where it is, and fades out after its reading time; leaving the plot area closes it. What it shows is each curve's tooltip mode — `largeScreenTooltip` on a large screen (a card 600 px wide or more), `smallScreenTooltip` on a small one (narrower, and the info panel), or *Behavior ▸ Tooltip ▸* in a menu, which sets the mode of the screen the card is on (the large screen's on a large one, the small screen's on a small one): *Selected* (the default on a small screen), the curves clicked, as above; *Nearest*, the value pointed at on any curve, at a hover too, without a click; *Mixed* (the default on a large screen), that value and the curves clicked; *All*, that value and, for each other curve of the graph, its value at the same time — or the nearest one, a few pixels away at most. A drag never acts on the tooltip: an open one follows its curve. Bars, timelines and arrowlines work the same way, a bar or a state being a value: the mode, a hover or a click, the element pointed at, with `all` each other row's or series' element at that time
- **Points**: a long-press (or a right click) near a curve shows all its points, or hides them; hovering a curve (mouse, or a pen above the screen) — or clicking, tapping it — shows the point of its value nearest the pointer along the curve alone, a discreet guide to where the real values are
- **Right click** on a label: opens its type menu, as a long-press does
- **With a pen**: the tip works as a finger. Its button isn't passed on to web pages by every browser: in Chrome and the Home Assistant app (Android), a tap with it held on a label opens its type menu, as a right click does. What your browser or app reports of a pen: type menu, *Tests (beta) ▸ Pen events*
- **On a touch screen**: a swipe on a graph always scrolls the page. To drag a curve or timeline label, the ⠿ handle of a graph or the Y axis labels, tap it, then press it again right away (within the long-press duration) and drag. With two fingers on a graph: spread or pinch them horizontally to zoom the time, vertically to zoom the Y axis around them; move them together to pan the time and the Y axis.

---

## Info panel — replacing the HA more info popup

The card can replace the default HA history graph in the more info popup that appears when you click any entity on your dashboard. Once enabled, the history explorer opens instead — with full pan, zoom, Y axis control and long term statistics support.

```yaml
type: custom:history-explorer-card
infoPanel: true
defaultInfoPanel: true   # set default enabled state; user preference is otherwise preserved
```

Once enabled, clicking any entity anywhere opens the history explorer graph instead. Switching it on or off applies right away, without reloading the page. Opened from a curve of the card — a click on its value, or *Info* in its menu —, the panel shows it as it looks on the card: its type, its color, its fill, its line, its points and its extremes. Ungrouping, drag & drop and CSV export are not available in the popup.

Home Assistant only loads the card's file once a dashboard is shown: a page opened directly (Settings, History…) shows its own history until then. To have the info panel on every page, load the file in `configuration.yaml` too:

```yaml
frontend:
  extra_module_url:
    - /hacsfiles/history-explorer-card/history-explorer-card.js?hacstag=...   # copy the URL of the card's resource
```

The `?hacstag=…` part isn't required — the file works without it — but with the exact URL of the card's dashboard resource (*Settings → Dashboards → ⋮ → Resources*) the browser loads the file once instead of twice, and gets the new version after each update. HACS changes it at each update: copy it again then.

> For full details → [README_Full.md — Info panel](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#info-panel--replacing-the-ha-more-info-popup)

---

## The options menu and the gesture settings

The ▾ button beside the entity selector opens the options menu:
- **Display ▸**, **Appearance ▸** (its color aside), **Interpolation ▸**, **Behavior ▸** (*Tooltip ▸*, *Y axis locked*) — as in a graph's menu, for every curve of the card at once;
- **Export ▸** — *History*, *Statistics* (as CSV files);
- **Card ▸** — *Default graphs ▸* (the graphs added from the card removed, the YAML's kept as you changed them), *Default display ▸* (back to the YAML: every change made from the card forgotten, the time range too), each confirmed in a submenu over it (*Confirm* / *Cancel*);
- **Global ▸** — what applies to every card and every device: *Enhanced native history*, a switch turning the info panel on (green) or off (red), and the gesture settings, entered right there.

The gesture settings tell a click from a long-press, and a tap from a drag — for a mouse or a pen, and for a finger. Raise them if your hand is less steady, or slower:

```yaml
type: custom:history-explorer-card
gestures:
  longPress: 500        # ms, mouse and pen: a press held this long is a long-press
  longPressTouch: 500   # ms, finger
  precision: 8          # px, mouse and pen: a pointer that moved further is dragging; a target this near is picked
  precisionTouch: 12    # px, finger
```

The long-press duration is also how soon a second press must follow a release to make a double-click, or a tap-then-drag. The precision is also how near a label, a button or a curve must be to be picked. The values are kept within reasonable bounds (200 to 2000 ms, 4 to 20 px). Whether set in the YAML or in the menu, the last one to speak wins, and they are kept on every device — as the info panel's switch.

---

## Adding entities

Entities can be added interactively through the UI selector, or defined statically in YAML. Both can be combined. Dynamically added entities are synchronized with your HA user account and restored across all devices.

![history-panel-otf-entities](https://github.com/alexarch21/history-explorer-card/raw/main/images/screenshots/history-panel-otf-entities.png)

The entity selector shows friendly names and filters on both friendly name and entity ID simultaneously. The entity ID is shown in a tooltip on selection.

**Keyboard navigation:**
- **ArrowUp / ArrowDown** — navigate the dropdown list
- **Enter** — choose the highlighted entry (with a `*` pattern, the first Enter selects every match, a second one adds them)
- **Escape** — close the dropdown and clear the input field

Clicking an entry chooses it, as Enter does — no separate button required.

For an entity with attributes that can be shown (a thermostat's measured temperature, its setpoint, what it's doing…), the selection opens a submenu over the list first: *Value* — the entity's own state, pre-selected, Enter takes it — then each attribute with its current value (an attribute `X_unit`, a unit, isn't listed, nor one naming an entity or a web address, nor one about a version or an update); ← or Escape goes back to the list. An attribute holding others — a dictionary, or a list of them like a weather forecast — is marked ▸: a click opens them in a submenu over the attributes, as every submenu (← or Escape closes it).

Right after the choice (click or Enter), the [display type menu](#choosing-an-entitys-display-type) opens, the most fitting type pre-selected: nothing is added before a type is picked, so you can check how the entity will be shown first. For an entity whose state isn't a number (on/off, text…), the menu only offers *Timeline*, the only way to show it.

The entity selector accepts `*` wildcards:
```
person.*        all person domain entities
*door*          all entities containing 'door'
*               all available entities
```

When a wildcard pattern is entered, matching entries are shown in bold in the dropdown. The first Enter selects all matching entities; the second Enter opens the type menu for the whole batch, with an extra "Default" option to apply each entity's own natural type instead of a single chosen type for all of them. Duplicates are detected and listed in a tooltip, with all affected graphs highlighted.

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

`filterEntities` and `excludeFilterEntities` accept a single string, a list of strings, or (for `exclude:` under a YAML entity) the object form `{entity: '...'}` — see [README_Full.md — YAML graph configuration](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#yaml-configuration-for-preconfigured-graphs) for the per-entity `exclude:` option and examples.

---

## Choosing an entity's display type

An entity whose state is a number can be shown as a line (*Smart*, *Curve*, *Straight* or *Stepped*), as bars, as direction arrows or as a timeline; any other entity only as a timeline. The type menu opens:

- right after selecting an entity to add in the dropdown (see [Adding entities](#adding-entities)) — always, even when *Timeline* is the only choice, so you can check before it's added;
- on a long-press (or a right click) of a legend label (line/bar graphs) or of a timeline/arrowline label;
- after choosing *Create a second curve* for an entity that's already shown (see below).

Selecting an entity (or attribute) that's already shown says so and outlines its graph, then offers *Cancel* (pre-selected) or *Create a second curve*: the same curve can be shown in several graphs, each one set on its own — never twice in one graph from the card.

![image](https://user-images.githubusercontent.com/60828821/156686448-919cbd9c-4e77-4efc-a725-e53a7049a092.png)

The type menu has five items, each opening its submenu over the menu, level with it — its right edge on the menu's right edge; the item whose submenu is open is in bold. Every menu opens its submenus so, at any depth: a submenu is narrower than the menu under it, whose lines' start still shows — click one to open its own submenu instead —, unless opened from its last line. A menu follows what it was opened from (a label, a field, a button) when the page scrolls, and a submenu its line when its menu scrolls; what goes past the part that shows — the screen minus a sticky toolbar or the page's header, for a submenu its menu — is masked, and the menu closes once its first line is wholly out of it. The five items:
- **Display ▸** — open as soon as the menu opens: *Smart*, *Curve*, *Straight*, *Stepped*, *Bar*, *Direction*, *Timeline*;
- **Appearance ▸** — how the curve looks: *Color ▸* (the browser's color picker, in the middle of the screen; a bar's too), *Points* and *Extremes* (switches: its samples' dots, as a long-press near it, and its min/max band — `showMinMax`), *Fill ▸* (*None*, *Solid*, *Fade*), *Width ▸* (1 to 5 px), *Line style ▸* (*Solid*, *Dots*, *Short dashes*, *Long dashes*, *Dash-dot*) — each list in a submenu over it, ← or Escape closing it; the value in use in bold. A choice there is saved with the entity, as the interpolation;
- **Interpolation ▸** — for a curve shown in *Smart* or *Curve*: how the curve is drawn between its values (see [Curve interpolation](#curve-interpolation)), the algorithm in use in bold; the choice is saved with the entity;
- **Behavior ▸** — how the curve behaves: *Tooltip ▸* (*Selected*, *Nearest*, *Mixed*, *All* — see [Basic usage](#basic-usage)), *Y axis locked* (a switch: its graph's padlock); opened by a long-press on a label, also *Separate* (the entity taken out into its own graph, as a double-click on its label), *Merge back* (a linked graph put back into the one above, as a double-click on the chain icon), *Cut* (the entity moved to another graph, as a drag — see [The graph menu, cut and paste](#the-graph-menu-cut-and-paste)), *Delete* (the entity removed from the card).
- **Tests (beta) ▸** — diagnostics run where the card is shown (browser, Home Assistant app), to report what that system gives the card: *Pen events* lists what the browser reports of a pen (hover, its button, a long press) on two test zones; *Performance* measures what the card costs on this device with its entities — the graphs drawn again, the window loaded from Home Assistant (each request's wait and values), the real time — and when the page froze; the report can be copied or sent as a GitHub issue — with the device, the system and the browser or app used.

Click an item, or press Enter or → on it; ← or Escape goes back to the menu. A choice that changes what the menu shows — a type, an interpolation, a look, a switch — is applied at once, and the menu stays open half a second showing it, then closes (another choice meanwhile is applied too); an action — *Separate*, *Cut*, *Delete*, *Info*, a test, *Color* — closes it at once. A switch is green when on, red when off. A menu reopened less than 10 s after it was closed opens the submenu it had open (a new entity's always opens on *Display*). A menu is wider than its submenus, so its lines stay readable beside the one open; on a card too narrow for that, it opens without any submenu, and a submenu opened leaves at least the start of its lines.

In *Display*, the type in use — or, for an entity being added, the most fitting one — is shown in bold. Enter right away takes it; ArrowUp/ArrowDown first highlight it, then move through the other choices; or click directly. For an entity being added, the most fitting type is:
- *Timeline* for a state that isn't a number;
- the entity's own `entityOptions` `type` / `lineMode`, when set;
- *Direction* (arrows) for an angle (unit `°`, or state class `measurement_angle`);
- *Bar* for energy, gas, water or volume that adds up (state class `total_increasing`, or `total` with such a device class or unit);
- *Timeline* for an entity without unit that isn't a measurement;
- otherwise a *Smart* line (or the card's own `lineMode`, when set).

For several entities added at once with a wildcard, *Display* starts with *Default*: each entity gets its own most fitting type.

In the info panel, a "Type" link appears between the date and range selectors when the entity's state is a number, opening the same menu.

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

- **Single-click** a curve label's name to show/hide it (its name struck through when hidden); a click on its value — `(400 W)` — or on a value shown over the graph opens the entity's dialog (with the [info panel](#info-panel--replacing-the-ha-more-info-popup) when it's on); its menu's *Info* does the same
- **Double-click** a curve label to extract it into its own graph
- **Long-press** (or right click) a curve label to open the [display type menu](#choosing-an-entitys-display-type)
- **Drag** a curve label left or right to reorder curves within the same graph (on a touch screen, tap it, then press it again right away and drag)
- **Drag** a curve label onto another line or bar graph to move it there, whatever its unit — a graph defined in YAML included

A curve can't be dropped onto a timeline or arrowline graph (nor a timeline entity onto a line or bar graph): the drop is refused with a brief tooltip. Units only matter when an entity is added: `combineSameUnits` only joins compatible ones on its own.

A drop is saved only when both graphs are: a graph defined in YAML saves nothing by default (see [Time range and display defaults](#time-range-and-display-defaults)), so a curve dropped onto it, or taken out of it, is back in its own graph after a reload — nothing duplicated, nothing lost.

### Linked graphs

A graph defined in YAML always shows all its entities together, whatever their units. Two groups of units get a Y axis each (see [Y axis control](#y-axis-control)). Curves and bars share the same graph too (curves drawn over the bars). Only timeline and arrowline entities end up in separate graphs, which stay *linked* (chain icon 🔗 between them).

- **Double-click** a curve label of a YAML graph to show it in its own graph right below — whatever its unit, it stays linked to its YAML graph
- **Drag** a curve label onto another graph of the same linked group to put it back
- **Double-click** the chain icon to merge the two linked graphs back into one

Linked graphs can always be merged back as long as their display types can share a graph (lines and bars can; a timeline or arrowline can't share a graph with anything else). The same applies to entities added from the UI: changing a curve's display type to one its graph can't show (e.g. a line to a timeline) moves it to a linked graph, and changing it back returns it to its graph; changing a line to bars keeps it in its graph. An entity added from the UI never joins a graph of another display type on its own. A double-click on a label of a graph added from the UI takes that curve out of its group instead.

### Reordering graphs

Drag the ⠿ symbol at the top left of any graph to reorder it. Drop above the midpoint of a target to insert before it, below to insert after. A simple click on the same area toggles the Y axis lock. On a touch screen, tap the ⠿ symbol, then press it again right away and drag.

Linked graphs always stay together: moving one of them elsewhere moves the whole block, and no other graph can be dropped between them.

### The graph menu, cut and paste

A long-press (or a right click) on the ⠿ zone of a graph opens its menu, titled with the graph's `title` (else the start of its curves' names) — the same zone where a click toggles the Y axis lock and a drag moves the graph:
- **Display ▸** (open with the menu), **Appearance ▸** (its color aside) and **Interpolation ▸** — as in the type menu, for all the graph's curves at once (the value all of them share in bold, a switch on when all of them show it);
- **Behavior ▸** — *Tooltip ▸* for all its curves, *Y axis locked* (a switch, as a click on the padlock), *Merge back* (a linked graph put back into the one above), *Cut* (the graph moved elsewhere, as a drag), *Delete the graph* (a graph added from the card).

A choice in the card's menu, a graph's or a curve's applies to every curve it concerns: the last one made wins, whatever its level.

After *Cut* — of a graph, or of a curve from its type menu — the ⠿ zone of every graph shows where it can go: 📋 to paste a curve into that graph, ↓ / ↑ to insert a graph below or above that one — or a swipe down or up on them. A choice that isn't possible (a curve onto a timeline, a graph inside a block of linked graphs) is struck through in red, and says why when clicked. ✂ marks where it was cut from. A click just beside a button counts as on it, about halfway between two does nothing; a click anywhere else, or Escape, cancels.

### Timeline and arrowline graphs

![image](https://user-images.githubusercontent.com/60828821/198171854-f643a628-25f7-4f5a-ac50-f0914a5e265e.png)

- **Drag** an entity label to move it to another timeline/arrowline graph, or to reorder it within the same graph (on a touch screen, tap it, then press it again right away and drag)
- **Double-click** an entity label to extract it into its own graph
- **Long-press** (or right click) an entity label to open the [display type menu](#choosing-an-entitys-display-type)
- Click a truncated label to see the full name in a tooltip

The page scrolls automatically when dragging near the top or bottom of the screen.

Drag & drop shows a ghost element and insertion markers for precise positioning.

---

## Y axis control

![image](https://user-images.githubusercontent.com/60828821/221268643-735e4b1a-81da-4709-aff8-913b9b8f95a8.png)

The Y axis auto-scales by default: its padlock is open, in green. Click the padlock icon (or use the [graph menu](#the-graph-menu-cut-and-paste)) to lock it to the current range: the padlock closes, in red. Drag directly on the label area of an axis (left side of the graph, or right side for a second axis) to pan that axis — the cursor changes to ↕; on a touch screen, tap it, then press it again right away and drag. Hold **SHIFT** to enable vertical drag and zoom on the graph itself. On a touch screen, a two-finger vertical pinch zooms the Y axis, a horizontal one zooms the time. Labels drawn inside the plot (a narrow card, `yLabels: inside`, `look: mini`): a drag along them moves that axis and its curves (a finger or a pen: tap, then press again and drag), while a click, a long-press or a hover there is for the curves. `labelsLeft` and `labelsRight` show each axis' labels: `true`, `false` (none, the plot taking their room) or `hover` (shown while the pointer is over the graph; on a touch screen, for 3 s after a tap).

**Two Y axes** — with two groups of units (a power and a temperature), the second one gets its own Y axis, on the right — its curves marked ▸ in the legend; `yAxis: left` or `right` on an entity chooses its side, and `yAxis: left` on the graph (or the card) keeps all its curves on one axis. With more groups, the curves share one Y axis without a title (the legend and tooltip still show each entity's own unit): when their values aren't of the same order, use `scale:` to make a small one visible next to a large one. Dragging the labels of one axis moves that one; Shift, the pinch and the padlock act on both.

A bound written with a `~` is soft (`ymin: ~0`: 0 at least, lower where the values go lower); `yrange` is the smallest range the axis shows; `logarithmic: true`, a logarithmic axis; the right axis has its own (`yminRight`, `ymaxRight`, `yrangeRight`).

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

> For full details → [README_Full.md — Y axis scaling](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#y-axis-scaling)

---

## Time range and display defaults

### Real time

The window showing the present, on its right, is in real time: the curves grow and slide as new values come, and the window never goes past the present (the date's `>` is greyed). Every change of the range keeps the present on the right — the selector, the magnifiers + and −, the default range —, and so do the wheel from the right 10 % of a graph and a pinch with a finger in its right 20 %; elsewhere, the wheel and a pinch zoom around the pointer or the fingers, and leave real time (a double-click on the date brings it back). Looking at the history, the selector and the buttons keep the middle of the window.

### Default range and persistence

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
- Last one to speak wins: YAML, each device's UI, and your HA account (for multi-device) are each compared with what they said last time — whichever changed most recently wins. An entity edited in YAML gets its YAML values back (on every device), the others keep theirs. A device opening the card for the first time gets what's saved in your HA account with `enable_multidevice_persistence` (the YAML, if it changed since), and the YAML with `enable_persistence` alone.
- Accepts `range` (the time range), `entities` (dynamically-added ones, or specific fields per static entity), `order` (the display order of your graphs — card-level only), `all` to cover everything, or `none` to explicitly turn persistence off where it would otherwise default on — e.g. a card with only dynamic entities that you *don't* want remembered.

> For full details → [README_Full.md — Default view and time ranges](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#default-view-and-time-ranges)

---

## Auto refresh

```yaml
type: custom:history-explorer-card
refresh:
  automatic: true    # Refresh when entity values change (the default — false turns it off)
  interval: 30       # Or refresh every 30 seconds (combine both if needed)
```

The automatic refresh reloads the recent data at most once every 2 seconds, however often the entities change — less often on a device slow to draw the graphs (never sooner than five times what drawing them takes). A value's change is shown next to its name at once.

---

## Line chart appearance

### Line mode

```yaml
type: custom:history-explorer-card
lineMode: lines    # curves, lines, stepped, or smart
```

Without `lineMode`, the curves of YAML graphs are drawn as `curves`, and an entity added from the UI gets `smart` (the type menu pre-selects it). Setting `lineMode` here applies to both: with `lineMode: curves`, entities added from the UI are pre-selected as *Curve* too. To keep `curves` for your YAML graphs only, set it under each graph's `options:` instead.

`smart` draws a curve while the sensor reports values at its usual rhythm, and a flat dashed line — the last known value held — over each silence, instead of a curve or a diagonal bridging the gap to the next value. See [README_Full.md — Smart mode](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#smart-mode-silences-shown-as-flat-dashed-plateaus).

![image](https://user-images.githubusercontent.com/60828821/148483356-aea06848-13d9-4e1e-bd06-485b44505d48.png)

### Curve interpolation

In `curves` and `smart` modes, the curve between two values is rebuilt by an interpolation algorithm, chosen with `interpolation` (on the card, a graph, an entity or in `entityOptions`) or from the type menu (**Interpolation ▸**):

```yaml
type: custom:history-explorer-card
interpolation: makima   # monotone (default), steffen, makima, catmullrom, or bspline
```

| `interpolation` | How the curve looks |
|---|---|
| `monotone` (default) | Never overshoots, but flat at every value where the curve changes direction or repeats a value: small breaks in the slope |
| `steffen` | Never overshoots; flat only at the real peaks and troughs; takes the irregular spacing of the values into account |
| `makima` | Follows the local trend, flat over flat stretches, no break at each small peak; hardly any overshoot |
| `catmullrom` | The smoothest; may overshoot a little around sharp changes |
| `bspline` | mini-graph-card's smoothing: never overshoots, the softest, but passes between the values, not through them (a peak drawn lower); `look: mini`'s default |

### Angles

Angles (a wind direction, for example) are drawn without jumping across the whole graph when they cross 0/360: a wind oscillating around the north is drawn around 0, its values just below 0 shown as such on the curve, while the tooltip and the Y axis labels show the real values (-2 shows 358). Detected automatically (unit `°` or state class `measurement_angle`; an attribute in `°` only when its name says it's a direction, like a weather entity's `wind_bearing`); see [README_Full.md — Circular values](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#circular-values-angles).

### Stroke style

```yaml
entities:
  - entity: sensor.temperature
    dashMode: shortlines          # solid, points, shortlines, longlines, pointline
  - entity: sensor.humidity
    dashMode: [10, 4, 2, 4]       # custom Canvas dash pattern
```

### Individual sample dots

![image](https://user-images.githubusercontent.com/60828821/221272054-abb884df-b95f-4c88-83f0-921ac8709a93.png)

Hold **Alt** (Option on Mac) while moving over a graph to reveal its individual data points; a long-press (or a right click) near a curve shows or hides its own — as *Points* in its menu's *Appearance ▸* —, saved with it. The points are as wide as the line plus 2 px, the one the tooltip shows 2 px more. To show them from the YAML:

```yaml
entityOptions:
  humidity:
    showPoints: true   # true: a diameter of the line width + 2 px; or a radius in px; hover (default): the hovered one; false: none
```

### Min/max statistical band

```yaml
entities:
  - entity: sensor.outside_temperature
    showMinMax: true         # a lighter min/max band around the mean curve, everywhere
                             # or: statistics / history — only where the curve comes from them
```

### Unavailable data

By default the card interpolates over unavailable states. To show gaps instead:
```yaml
showUnavailable: true
```

> For full details → [README_Full.md — Line appearance](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#line-appearance)

---

## Bar charts

![image](https://user-images.githubusercontent.com/60828821/193383950-53242b11-d467-42ba-9859-3b3df0b0dcb8.png)

Energy, gas, water or volume entities that add up (state class `total_increasing`, or `total` with such a device class or unit) are shown as bars when added from the card (the type menu pre-selects *Bar*). Use the interval selector on the graph to switch between bars of *10 min*, an *Hour*, a *Day*, a *Week* (from Monday) and a *Month* (an hour by default), or *Raw*.

A bar graph can also hold curves (a YAML graph mixing both, a curve changed to bars, or a curve dropped onto it): the curves are drawn over the bars and aren't affected by the interval, nor stacked. *Raw* in the interval selector only turns the bars into raw curves; picking an interval again turns them back into bars. Bars and curves of two groups of units (e.g. kWh bars and a W curve) get an axis each, the bars on the left; with more groups they share one axis — use `scale:` to bring them to comparable values (with `unit:` to show the new unit, e.g. `scale: 0.001` and `unit: kW`).

```yaml
entityOptions:
  sensor.rain_amount:
    type: bar
    interval: 10m
```

> For full details (stacked bars, net metering) → [README_Full.md — Bar graphs](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#bar-graphs-for-total-increasing-entities)

---

## Timeline charts

![image](https://user-images.githubusercontent.com/60828821/198171854-f643a628-25f7-4f5a-ac50-f0914a5e265e.png)

State text display:
```yaml
stateTextMode: raw    # raw HA state names
                      # or: auto — translated device class dependent names (default)
                      # or: hide — no state labels
```

State colors can be customized by entity, device class, domain or globally:
```yaml
stateColors:
  door.on: blue
  motion.on: yellow
  binary_sensor.off: purple
  off: '#ff0000'
```

> For full details (color priority rules, stateColorSeed) → [README_Full.md — Timeline charts](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#timeline-charts)

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

## Colors of curves and bars

`color` takes a color, or colors that change with the value — thresholds, for curves and bars alike (`colorTransition: smooth`: blended from one to the next; `lineColor` on a graph or the card: a color, or a list of colors, for its entities in their order):
```yaml
entityOptions:
  energy:
    type: bar
    color:
      0: blue
      1: green
      1.5: red
```

Or with another entity: thresholds with an `entity` compare its value (a number or a state) at each point; `default` colors what they don't list. The legend shows the color now:
```yaml
graphs:
  - type: line
    entities:
      - entity: sensor.heat_pump_power
        color:
          entity: sensor.heat_pump_mode
          heat: red
          cool: blue
          default: grey
```

Or with one of an entity's attributes: `attribute` next to `entity` — or, for an attribute holding the color itself, the attribute written after the entity id (`color: climate.salon.led_color`):
```yaml
      - entity: climate.salon
        attribute: current_temperature
        color:
          entity: climate.salon
          attribute: hvac_action
          heating: red
          idle: blue
```

> For full details → [README_Full.md — Colors of curves and bars](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#colors-of-curves-and-bars)

---

## Long term statistics

![image](https://user-images.githubusercontent.com/60828821/203880897-6f634e95-cb5d-484c-a9c0-d97b58321557.png)

The card seamlessly extends graphs beyond the history retention limit using long term statistics. Enabled by default. It loads what the screen can show, by how long a column of pixels lasts:

| A column of pixels lasts | Loaded |
|---|---|
| an hour or more | the hourly statistics (the 5-minute ones for the hour not compiled yet) |
| between 5 minutes and an hour | the hourly, then the 5-minute statistics |
| less than 5 minutes | the history (the statistics only where there's no more history) |

The last minutes, after the 5-minute statistics, come from the history. A point computed from the history has the same mean, minimum and maximum as Home Assistant's statistics. `mode` and `retention` are accepted, without effect.

```yaml
statistics:
  enabled: true
  period: hour     # hour, day, or month
  force: false     # true = use statistics only (still the history for the last minutes)
```

> For full details → [README_Full.md — Long term statistics](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#long-term-statistics)

---

## Values over a graph, a compact look

A graph can show, over its plot, each curve's value now (`showState`) and its minimum, average and maximum over the time window shown (`showStats`, the minimum and maximum with their time) — recomputed as the window moves: unlike mini-graph-card, the time can still be panned and zoomed. `look: mini` gives the look of mini-graph-card at once; any option set on the card still wins:

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
        showState: true
```

`look: mini` sets: no header, toolbar, entity selector nor bar interval selector (`uiLayout: { interval: hide }`); `showState: true` for the first curve, the others' set on them (`showStateFor: first`, and `showStatsFor: first` for `showStats`); the values in the text's color (`stateAdaptiveColor: false`); `showTimeLabels: false`; `showGrid: false`; `yLabels: inside` (the Y labels inside the plot, in boxes, which takes the whole width — an axis is moved by a drag along its labels); `fill: fade` (each curve's color fading out downwards); `height: 150`; `lineWidth: 5`; `lineMode: curves`; `interpolation: bspline`; `colorTransition: smooth` (thresholds blended from one to the next); a header with the graph's name on the left and its icon on the right (`showName`, `showIcon`, `alignHeader: default`, `fontSizeHeader: 14`); the legend's names without their values (`showCurrentValues: false`), and a legend only for several curves (`legendVisible: auto`); the Y labels shown on a hover (`labelsLeft: hover`, `labelsRight: hover`).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/Cook23/history-explorer-card/raw/v1.2-dev/images/screenshots/narrow-and-mini-dark.png">
  <img alt="A card 168 px wide; look: mini, 374 and 168 px wide" src="https://github.com/Cook23/history-explorer-card/raw/v1.2-dev/images/screenshots/narrow-and-mini.png">
</picture>

*Left: a card 168 px wide (two cards side by side on a phone). Middle and right: `look: mini`, 374 and 168 px wide.*

**A narrow card** — narrower than 300 px (two cards side by side on a phone, a grid of small cards), the card keeps its graphs readable, as mini-graph-card does: the toolbar's date, range and search each on a line of their own; the Y labels inside the plot (as `yLabels: inside`, `yLabels: outside` keeping them beside it), which keeps its width; the text a little smaller; the handle, the padlock and the chain icon in boxes over the legend, taking no room (on the box a gesture is theirs, beside it the label's); the legend's names shortened, each value kept; the values over a graph, the first one large, the others small on its right. A menu takes the room there is, a tooltip stays within the screen.

> Thanks to [mini-graph-card](https://github.com/kalkih/mini-graph-card) (kalkih) for its good ideas on showing a graph in little room — the labels in boxes inside the plot and their size, the first value large and the others small, names cut rather than wrapped — which this card follows.

---

## mini-graph-card compatibility

A mini-graph-card is replaced in place: `type: custom:history-explorer-card` and `look: mini`, its other lines kept. Its options are aliases of the card's own, names and values (see [Card, graph, and entity-level options](#card-graph-and-entity-level-options)), mixed freely with them — its Y axis' (soft bounds, `min_bound_range`, the `_secondary` ones, `logarithmic`, `show.labels` and `show.labels_secondary` with their `hover`), `show.legend`, `value_factor`, `state_map`, `line_color`, `color_thresholds_transition`, `show_line`, an entity's `show_legend`, `show_graph`, `fixed_value`, `show_state` and `state_adaptive_color`, `show.extrema`, `show.average`, `show.graph: false`, `bar_spacing`, `hour24`, the header's options (`show.name`, `show.icon`, `icon`, `align_*`, `font_size`…), `show_indicator` and `show_legend_state` included; `animate`, `cache`, `compress`, `group` and `loading_indicator` are accepted, without effect. mini-graph-card's aggregation is the card's own: `pointsPerHour` (`points_per_hour`), `groupBy` (`group_by`: `hour`, `date`) and `aggregateFunc` (`aggregate_func`: `avg`, `median`, `min`, `max`, `first`, `last`, `sum`, `delta`, `diff`) — a point per group of time, each the function chosen → [README_Full.md — Aggregation](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#aggregation).

> For full details → [README_Full.md — mini-graph-card compatibility](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#mini-graph-card-compatibility)

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

> For full details and priority rules → [README_Full.md — Entity options](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#entity-options)

---

## Card, graph, and entity-level options

Every display/behavior property below can be set at up to four levels — as a default for the whole **card**, in **`entityOptions`** (targeted by entity id, device class, domain or pattern), as a default for one **graph**, or directly on one **entity**. The most specific level wins: **entity → graph → `entityOptions` → card**.

```yaml
type: custom:history-explorer-card
lineWidth: 2                     # card-level default

entityOptions:                   # targeted defaults — see *3 below
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
| `largeScreenTooltip` | `large_screen_tooltip` | | ✓ | ✓ | ✓ | The tooltip on a large screen (a card 600 px wide or more): `mixed` (default) the value pointed at on any curve, at a hover or a click, and the curves clicked; `nearest` that value only; `selected` the curves clicked only; `all` that value and each other curve's value at the same time (or nearest, a few pixels away at most). Set from *Behavior ▸ Tooltip ▸* on that screen; kept on this device only |
| `smallScreenTooltip` | `small_screen_tooltip` | | ✓ | ✓ | ✓ | The same on a small screen (a card narrower than 600 px, and the info panel): `selected` by default; set from *Behavior ▸ Tooltip ▸* on that screen |
| `tooltipBehavior` | `tooltip_behavior` | | ✓ | ✓ | ✓ | Changes the default of `largeScreenTooltip` and `smallScreenTooltip`: `mixed`, `nearest`, `selected` or `all`, on both screens; `auto` (default) leaves theirs (`mixed`, `selected`) |
| `pointsPerHour` | `points_per_hour` | | ✓ | ✓ | ✓ | Points an hour (groups of 1 / `pointsPerHour` hours) instead of one per column of pixels |
| `groupBy` | `group_by` | | ✓ | ✓ | ✓ | `interval` (default), `hour`, `date`: a point an hour, a day |
| `aggregateFunc` | `aggregate_func` | | ✓ | ✓ | ✓ | Each group's value: `avg` (default, weighted by time), `median`, `min`, `max`, `first`, `last`, `sum`, `delta`, `diff` |
| `showMinMax` | | | ✓ | ✓ | ✓ | Min/max band around the mean curve: `true` (everywhere), `statistics` or `history` (only where the curve comes from them) |
| `decimation` | | | ✓ | ✓ | ✓ | Accepted, without effect: the card draws one point per column of pixels — the mean of its values, their min and max kept for the band and the tooltip (see [Data decimation](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#data-decimation)) |
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
| `defaultTimeRange` | `hours_to_show` | | ✓ | | | The time range shown when the card opens — see [Time range](#time-range-and-display-defaults) |
| `labelsVisible` | | | ✓ | | | `false`: no names left of the timelines' rows |
| `look` | | | ✓ | | | `mini`: a set of default options at once — see [Values over a graph](#values-over-a-graph-a-compact-look) |
| `entityOptions` | | | ✓ | | | Targeted defaults by entity id, device class, domain, or glob pattern — see *3 |
| `filterEntities` / `excludeFilterEntities` | | | ✓ | | | Limit which entities appear in the entity picker — see *4 |
| `exclude` | | | | ✓ | ✓ | Exclude specific matches from a wildcard `entity:` pattern — see *4. Graph-level and entity-level excludes combine rather than override |

*2 — `height` on the card sets the height of every line and bar graph; `lineGraphHeight`/`barGraphHeight` (see [UI configuration](#ui-configuration)) still set their own, and win over it.

*3 — `entityOptions` accepts any property marked ✓ in the **Entity** column above, targeted by entity id, device class, domain, or glob pattern instead of repeating it on every entity.

*4 — `filterEntities`, `excludeFilterEntities` and `exclude` each accept a single string, a list of strings, or (for `exclude`) the object form `{entity: '...'}` — see [Adding entities](#adding-entities) above.

*5 — `circular`: absent (or `none`) detects angles automatically (unit exactly `°`, or state class `measurement_angle`: period 360; an attribute in `°` only when it's a direction, like `wind_bearing`), `false` turns it off, a number or numeric string (`360`, `6.28`) sets the period, `2pi` sets 2π. On an arrowline, it sets what a full turn of the arrows is (360 without a period).

*6 — `scale` and `valueFactor` both multiply the values. `scale` is the factor itself; without `unit` it only changes how the curve is drawn (to make it visible next to larger values, or to flip it with a negative factor): the legend and tooltip show the entity's real value. With `unit`, `scale` is a conversion into that unit, and the legend and tooltip show the converted value — e.g. `scale: 0.001` and `unit: kW` for a power in W. `valueFactor` is a power of 10, and multiplies what is drawn **and** shown, with or without `unit`: `valueFactor: -3` is `scale: 0.001` with the entity's own unit. Details: [README_Full.md — Scaling values](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#scaling-values-scale-unit-and-valuefactor).

*7 — an option of the graph itself (its Y axis, its stacking, its bars' spacing, its height, its time labels, its grid, its Y labels): set on an entity or in `entityOptions`, it applies to the graph the entity is shown in; the graph's own value wins.

Every option is spelled the same at every level where it's accepted, and its aliases — the names and values above, mini-graph-card's among them — are accepted everywhere, mixed freely with the card's own names. A graph's options can be set under its `options:` or directly on the graph, next to `type:` and `entities:` (`options:` wins if both are set). When an option is set at several levels, the most specific one wins: **entity → graph → `entityOptions` → card**.

> Every YAML option, at every level, with its default value, is listed in [full-reference-config.yaml](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/full-reference-config.yaml).

> For full details and priority rules → [README_Full.md — Entity options](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#entity-options)

---

## CSV export

![image](https://user-images.githubusercontent.com/60828821/203881276-1332c8bd-d83c-4ff6-9a9b-9b43cb4a6c44.png)

Open the options menu (▾ beside the entity selector) and select **Export ▸ History** (or **Statistics**). Not available in the HA Companion app.

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
hour24: true           # the 24-hour clock (false: the 12-hour one; not set: Home Assistant's setting)

uiColors:
  gridlines: '#ff000040'
  labels: green
  buttons: '#80f00050'
  cursorline: '#ff000080'  # vertical cursor line color
  selector: 'rgba(255,255,255,255)'
  closeButton: '#0000001f'  # the bar interval selector's background

uiLayout:
  toolbar: top         # top, bottom, both, hide
  selector: bottom
  sticky: top          # keep toolbar visible while scrolling
  invertZoom: true     # swap the magnifiers + and −
  interval: hide       # hide the bar interval selector

labelsVisible: false      # no names left of the timelines' rows
labelAreaWidth: 65

lineGraphHeight: 250
barGraphHeight: 150
timelineBarHeight: 24
timelineBarSpacing: 40

showCurrentValues: false  # live values next to legend labels are shown by default; set false to hide
legendVisible: false       # hide the legend entirely (auto: only for several curves)

stateColorSeed: 137       # seed for automatic state colors

timeTicks:
  density: high           # base density: low, medium, high, higher, highest
  densityOverride: higher # skip auto-density and force this level
  dateFormat: short       # normal (default) or short
```

The **cursor line** — a vertical line following the pointer over a graph — is drawn on timelines by default. `cursor.mode`: `auto` (the graph under the pointer), `all` (every graph of the card at once, to line events up) or `hide`; `cursor.types`: the graph types that show it (`timeline`, `line`, `bar`, `arrowline` or `all`). Details: [The cursor line](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#the-cursor-line).

```yaml
cursor:
  mode: all
  types: [line, timeline]
```

> For full details → [README_Full.md — Configuring the UI](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#configuring-the-ui)

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

An entity's attribute is shown with `attribute:` — a number as a curve (a number followed by a unit, `45.2 %`, as that number in that unit), anything else as a timeline. Its curve is named `entity : attribute` (`salon : Current temperature`). Its unit: the one its value holds, else the one Home Assistant shows it in (a thermostat's temperatures in your temperature unit, a light's `brightness` in % — converted from 0–255, a weather entity's `wind_gust_speed` in its `wind_speed_unit`), else, for other integrations, an attribute `X_unit` holding the unit of every attribute with `X` in its name — else `unit:`. Home Assistant keeps only its history (no long-term statistics). One inside a dictionary or a list is written by its path, as mini-graph-card writes it: `attribute: forecast.0.temperature`.
```yaml
      - entity: climate.salon
        attribute: current_temperature
        unit: °C
```

A graph's `options:` (or the graph itself) can also carry the entity options marked ✓ in the **Graph** column of [Card, graph, and entity-level options](#card-graph-and-entity-level-options), as a default for every entity in that graph — useful when combining several wildcard `entity:` patterns onto the same graph.

The same entity written several times is a curve each time, in several graphs or in one (each with its own options — mini-graph-card's way of showing a sensor's highest, lowest and mean values).

> For full details and advanced examples → [README_Full.md — YAML configuration](https://github.com/Cook23/history-explorer-card/blob/v1.2-dev/README_Full.md#yaml-configuration-for-preconfigured-graphs)

---

## Running as a sidebar panel

![image](https://user-images.githubusercontent.com/60828821/161340801-f1f97e90-73c4-44d9-8afa-ba858906a2c1.png)

Add an empty dashboard with **Show in sidebar** checked, set the view type to **Panel (1 card)**, and add the history explorer card.
