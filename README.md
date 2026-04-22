[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/v/release/Cook23/history-explorer-card?style=for-the-badge)](https://github.com/Cook23/history-explorer-card/releases)
[![GitHub stars](https://img.shields.io/github/stars/Cook23/history-explorer-card?style=for-the-badge)](https://github.com/Cook23/history-explorer-card/stargazers)
![Experimental](https://img.shields.io/badge/status-experimental-yellow?style=for-the-badge)

# History explorer card

> **A custom history card for Home Assistant — fork of [SpangleLabs/history-explorer-card](https://github.com/SpangleLabs/history-explorer-card).**
> For the complete reference documentation, see [README_Full.md](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md).

A highly interactive history card for Home Assistant. Pan, zoom, and explore your entity history across any time range, with full support for line charts, bar charts, timelines and compass arrow graphs.

![history-panel-sample](https://user-images.githubusercontent.com/60828821/147441073-5fbdeb2e-281a-4312-84f1-1ce5c835fc3d.png)

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

## Adding entities

Entities can be added interactively through the UI selector, or defined statically in YAML. Both can be combined. Dynamically added entities are saved in the browser's local storage and restored on next visit.

![history-panel-otf-entities](https://github.com/alexarch21/history-explorer-card/raw/main/images/screenshots/history-panel-otf-entities.png)

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
- **Drag** a curve label left or right to reorder curves within the same graph
- **Drag** a curve label onto another graph to move it there (compatible units only)

An incompatible drop shows a brief tooltip explaining the mismatch.

### Reordering graphs

Drag the ⠿ symbol at the top left of any graph to reorder it. Drop above the midpoint of a target to insert before it, below to insert after. A simple click on the same area toggles the Y axis lock.

### Timeline and arrowline graphs

![image](https://user-images.githubusercontent.com/60828821/198171854-f643a628-25f7-4f5a-ac50-f0914a5e265e.png)

- **Drag** an entity label to move it to another timeline/arrowline graph, or to reorder it within the same graph
- Click a truncated label to see the full name in a tooltip

The page scrolls automatically when dragging near the top or bottom of the screen.

---

## Overriding the HA more info popup (info-panel)

Replace the default HA history graph in the more info popup with the history explorer:

```yaml
type: custom:history-explorer-card
infoPanel: true
```

Once enabled, clicking any entity anywhere on your dashboard opens the history explorer graph instead. The popup supports pan, zoom, Y axis control, and long term statistics. Ungrouping, drag & drop and CSV export are not available in the popup.

---

## Y axis control

![image](https://user-images.githubusercontent.com/60828821/221268643-735e4b1a-81da-4709-aff8-913b9b8f95a8.png)

The Y axis auto-scales by default. Click the padlock icon to lock it to the current range. Drag directly on the label area (left side of the graph) to pan the Y axis — the cursor changes to ↕. Hold **SHIFT** to enable vertical drag and zoom on the graph itself. On mobile, use a two-finger vertical pinch to zoom the Y axis.

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

---

## Bar charts

![image](https://user-images.githubusercontent.com/60828821/193383950-53242b11-d467-42ba-9859-3b3df0b0dcb8.png)

Entities with a `total_increasing` state class are automatically shown as bar charts. Use the interval selector on the graph to switch between 10m, hourly, daily and monthly views.

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

---

## Timeline charts

![image](https://user-images.githubusercontent.com/60828821/198171854-f643a628-25f7-4f5a-ac50-f0914a5e265e.png)

State text display:
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
```

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

For the full list of configuration options, see [README_Full.md](https://github.com/Cook23/history-explorer-card/blob/main/README_Full.md).

---

### Running as a sidebar panel

![image](https://user-images.githubusercontent.com/60828821/161340801-f1f97e90-73c4-44d9-8afa-ba858906a2c1.png)

Add an empty dashboard with **Show in sidebar** checked, set the view type to **Panel (1 card)**, and add the history explorer card.
