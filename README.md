[![hacs_badge](https://img.shields.io/badge/HACS-Default-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)  
[![bymecoffee](https://user-images.githubusercontent.com/60828821/212549591-950f90de-6884-4bc2-bb66-d2cd1d6f00b6.png)](https://www.buymeacoffee.com/alexarch)

# History explorer card

> **This is a custom history card for Home Assistant — a fork of [SpangleLabs/history-explorer-card](https://github.com/SpangleLabs/history-explorer-card)** (itself a fork of the original [alexarch21/history-explorer-card](https://github.com/alexarch21/history-explorer-card), archived March 2024).

A highly interactive history card for Home Assistant. Pan, zoom, and explore your entity history across any time range, with full support for line charts, bar charts, timelines and compass arrow graphs.

> For the complete reference documentation including all technical details, see [README_Full.md](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md).

![history-panel-sample](https://user-images.githubusercontent.com/60828821/147441073-5fbdeb2e-281a-4312-84f1-1ce5c835fc3d.png)

---

## Install

### HACS (recommended)

The history explorer card is part of the default [HACS](https://hacs.xyz) store.

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

## Adding entities

Entities can be added interactively through the UI selector, or defined statically in YAML. Both can be combined. Dynamically added entities are saved in the browser's local storage and restored on next visit.

The entity selector accepts `*` wildcards:
```
person.*        all person domain entities
*door*          all entities containing 'door'
*               all available entities
```

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
```

---

## Interactive graph management

All changes made interactively are saved in the browser and survive a page refresh.

### Grouping and ungrouping curves

Enable automatic grouping of entities with compatible units (including SI prefix variants like W and kW) onto the same graph:
```yaml
type: custom:history-explorer-card
combineSameUnits: true
```

When multiple curves share a graph, the Y axis and tooltips always show each entity's value in its original unit.

- **Double-click** a curve label to extract it into its own graph
- **Drag** a curve label left or right to reorder curves within the same graph
- **Drag** a curve label onto another graph to move it there (compatible units only). An incompatible drop shows a brief tooltip explaining the mismatch

SI unit conversion also applies to graphs defined in YAML containing mixed units (e.g. W and kW sensors on the same graph).

### Reordering graphs

Drag the ⠿ symbol at the top left of any graph to reorder it. Drop above the midpoint of a target to insert before it, below to insert after. A simple click on the same area toggles the Y axis lock.

### Timeline and arrowline graphs

Entities on timeline and arrowline graphs can also be reorganized interactively:
- **Drag** an entity label to move it to another timeline/arrowline graph, or to reorder it within the same graph
- Long labels that don't fit are truncated; click the label to see the full name in a tooltip

The page scrolls automatically when dragging near the top or bottom of the screen.

---

## Overriding the HA more info popup (info-panel)

Replace the default HA history graph in the more info popup with the history explorer:

```yaml
type: custom:history-explorer-card
infoPanel: true
```

Once enabled, clicking any entity anywhere on your dashboard opens the history explorer graph instead. The popup supports pan, zoom, Y axis control, and long term statistics. The graph type and display options follow your `entityOptions` configuration. Ungrouping, drag & drop and CSV export are not available in the popup.

---

## Y axis control

The Y axis auto-scales by default. Click the padlock icon to lock it to the current range.

To pan the Y axis: drag directly on the label area (left side of the graph) — the cursor changes to ↕. Hold **SHIFT** to enable vertical drag and zoom on the graph itself. On mobile, use a two-finger vertical pinch to zoom the Y axis.

To set fixed Y axis bounds in YAML:
```yaml
graphs:
  - type: line
    options:
      ymin: 0
      ymax: 100
      ystepSize: 10
```

---

## Time range and display defaults

```yaml
type: custom:history-explorer-card
defaultTimeRange: 4h     # 4 hours (default is 24h). Units: m, h, d, w, o, y
defaultTimeOffset: 1D    # Snap to current day from midnight. Use uppercase for snapped offsets
```

---

## Auto refresh

```yaml
type: custom:history-explorer-card
refresh:
  automatic: true    # Refresh when entity values change
  interval: 30       # Or refresh every 30 seconds (combine both if needed)
```

---

## Line chart appearance

### Interpolation mode

```yaml
type: custom:history-explorer-card
lineMode: curves   # curves (default), lines, or stepped
```

Also available per entity in `entityOptions` and in YAML graphs.

### Stroke style

```yaml
entities:
  - entity: sensor.temperature
    dashMode: shortlines          # points, shortlines, longlines, pointline
  - entity: sensor.humidity
    dashMode: [10, 4, 2, 4]       # custom Canvas dash pattern
```

### Individual sample dots

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

---

## Bar charts

Entities with a `total_increasing` state class are automatically shown as bar charts. Use the interval selector on the graph to switch between 10m, hourly, daily and monthly views.

```yaml
entityOptions:
  sensor.rain_amount:
    type: bar
    interval: 10m
```

Multiple entities can be combined in a single bar graph (side by side or stacked):
```yaml
graphs:
  - type: bar
    options:
      interval: daily
      stacked: false
    entities:
      - entity: sensor.rain_amount
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

Net metering (sensors that can decrease):
```yaml
entities:
  - entity: sensor.net_meter
    netBars: true
```

---

## Timeline charts

Non-numerical entities are shown as timelines automatically. State text display:
```yaml
stateTextMode: raw    # raw HA state names (default)
stateTextMode: auto   # translated device class dependent names
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

---

## Compass arrow graphs

For directional sensors like wind bearing:
```yaml
entityOptions:
  sensor.wind_bearing:
    type: arrowline
    color: black
    fill: rgba(0,0,0,0.2)
```

---

## Long term statistics

The card seamlessly extends graphs beyond the history retention limit using long term statistics. Enabled by default. To configure:
```yaml
statistics:
  enabled: true
  mode: mean       # mean, min, or max
  period: hour     # hour, day, or month
  force: false     # true = use statistics only, no short-term history
```

Min/max statistical band (`showMinMax`) works alongside long term statistics.

---

## Entity options

All display options can be applied globally via `entityOptions`, keyed by entity id, device class, or domain. A list form with glob patterns is also supported:

```yaml
entityOptions:
  - match: "sensor.*_power"
    lineMode: lines
    color: '#3e95cd'
    width: 2
  - match: ["sensor.temperature*", "sensor.humidity*"]
    lineMode: curves
    showMinMax: statistics
  - entity: sensor.wind_bearing
    type: arrowline
```

| Option | Description |
|---|---|
| `type` | `line`, `bar`, `timeline`, `arrowline` |
| `color` | Line/bar color (HTML, CSS variable, or color range object) |
| `fill` | Fill color under the line |
| `width` | Line width in pixels |
| `lineMode` | `curves`, `lines`, or `stepped` |
| `dashMode` | `points`, `shortlines`, `longlines`, `pointline`, or custom array |
| `showPoints` | Dots at measurement points (`true` = 4px, or numeric radius) |
| `showMinMax` | Min/max band: `statistics` or `history` |
| `scale` | Multiply values by this factor before display |
| `hidden` | Hide by default in legend |
| `ymin` / `ymax` | Lock Y axis bounds |
| `ystepSize` | Fix Y axis tick step |
| `height` | Graph height in pixels |
| `decimation` | `fast` (default), `accurate`, or `false` |
| `interval` | Default bar interval: `10m`, `hourly`, `daily`, `monthly` |
| `netBars` | Net metering mode for bar graphs |
| `process` | JS expression to transform values before display |
| `showSamples` | Permanently show sample dots (graph-level) |

---

## Custom data processing

Transform entity values before display using a JS expression:
```yaml
graphs:
  - type: timeline
    entities:
      - entity: sensor.room_humidity
        process: '( state < 30 ) ? "dry" : ( state > 70 ) ? "wet" : "normal"'
```

---

## CSV export

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

showCurrentValues: true   # show live values next to legend labels
legendVisible: false       # hide the legend entirely
rounding: 2               # decimal digits in tooltips

timeTicks:
  densityOverride: higher  # low, medium, high, higher, highest
  dateFormat: short        # normal or short
```

---

## YAML graph configuration

Static graphs can be defined in YAML. They are always shown and cannot be removed via the UI.

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

Wildcards are supported in YAML entity lists:
```yaml
entities:
  - entity: sensor.*temperature*
    exclude:
      - entity: '*fridge*'
```

For the full list of configuration options, see [full-reference-config.yaml](full-reference-config.yaml).

---

### Running as a sidebar panel

Add an empty dashboard with **Show in sidebar** checked, set the view type to **Panel (1 card)**, and add the history explorer card.

---

<a href="https://www.buymeacoffee.com/alexarch" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/white_img.png" alt="Buy Me A Coffee" style="height: auto !important;width: auto !important;" ></a>
