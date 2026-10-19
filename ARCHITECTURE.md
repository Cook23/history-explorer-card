# Architecture (v1.2)

How the card's code is organized, what each part is responsible for, and the rules that
keep them apart — checked by the `architecture` test. For the details of the boundary with
Chart.js, see [`deps/Chart Custom.js.md`](deps/Chart%20Custom.js.md).

## The parts

The card is a toolbox and a business program. The toolbox — Chart.js and its fork — draws
and detects every gesture; it knows nothing of the card. The business program gives it data
and decisions, and gets the gestures back already resolved. Inside it, each part has one
job: the inputs say what the user asks, the operations change what is shown, the outputs
show it, and the conductor starts the card and wires the parts together.

```
                Home Assistant (states, history, statistics, user data)
                          │                               ▲
   ┌──────────────────────┼───────────────────────────────┼───────────────────────────┐
   │ inputs               │                               │                           │
   │  card-gestures  card-menus  card-selector  card-toolbar     (what the user asks)  │
   └────────┬──────────────────────────────────────────────────────────────────────────┘
            │ public methods
   ┌────────▼─────────────────────────────────────────────────────────────────────────┐
   │ business                                                                          │
   │  card-operations ── every change of what's shown ──► history-entity-store (model) │
   │  card-timerange (the time window)   card-config (options)   card-storage (saved)  │
   └────────┬──────────────────────────────────────────────────────────────────────────┘
            │
   ┌────────▼───────────────────────────┐   ┌──────────────────────────────────────────┐
   │ data                               │   │ outputs                                   │
   │  card-history (cache, requests)    │──►│  card-graphs (the graphs on the page)     │
   │  card-datasets (data → points)     │   │  card-charts (one graph for Chart.js)     │
   │  card-values (values over a graph) │   │                                           │
   └────────────────────────────────────┘   └───────────────┬──────────────────────────┘
                                                            │ options, datasets ▲ customEvent
                                            ┌───────────────▼───────────────────┴───────┐
                                            │ toolbox: deps/chart-hec.js + Chart.js      │
                                            │ (every interaction, everything drawn)      │
                                            └────────────────────────────────────────────┘
   history-explorer-card.js — the conductor: the card's life cycle, its content, the parts
   added to its state
```

| Part | Role |
|---|---|
| **Conductor** | |
| `src/history-explorer-card.js` | The card itself (`HistoryExplorerCard`) and its state (`HistoryCardState`): its life cycle, its content made, the theme, localization, Home Assistant's updates passed on. The state's methods are spread over the `card-*.js` files below, one part each, added to the class at the end of this file. |
| **Inputs** — what the user asks; they ask the business parts, never change what's shown themselves | |
| `src/card-gestures.js` | What a gesture on a graph means (from Chart.js's `customEvent`, `panX`, `zoomX`): a curve shown or hidden, a drop, a split, a merge, the time moved, the cut mode — and a refusal said where the gesture was (`showMessage`). |
| `src/card-menus.js` | The type menu (the same for a graph), the options menu: their lines, their keyboard navigation, the choice made asked of the operations. |
| `src/card-selector.js` | The entity selector: the entities listed and filtered, the type menu opened for those chosen, a duplicate said and flagged. |
| `src/card-toolbar.js` | The toolbars (their HTML, their layout as the card resizes, the date shown), a bar graph's interval selector. |
| **Business** | |
| `src/card-operations.js` | **Every change of what's shown**: a curve or a row moved, split off, merged back; a graph moved, merged, removed; curves added, deleted, their type, line mode, interpolation, points, a curve hidden; a bar graph's interval; the default graphs and display. Each one changes the store, has the graphs rebuilt, saved and their data asked again; one that can't be done returns why. No DOM, no chart. |
| `src/history-entity-store.js` | **The model**: the saved list of entities (`pconfig.entities`) — which curve is shown (its key, `keyOf`), in which group of linked graphs and sub-graph, in which order, with its own options. Every change to that list goes through it. Pure data. |
| `src/card-timerange.js` | The time window: its range, its moves (days, today, zoom steps, a drag, a zoom selection), real time followed, the time axis of each graph (`applyTimeAxis`, the only place it's set). |
| `src/card-config.js` | The YAML options applied, what Home Assistant and the entity options say of an entity (domain, device class, unit, default type, line mode, interpolated), the graphs built from the YAML. |
| `src/card-storage.js` | What is kept between sessions and devices, and the "last one to speak wins" merge of local state, HA user data and YAML — the only part reading or writing either. What the whole page shares, read before any card exists, too: the gesture settings (`localGestures`), the info panel's switch and config (`infoPanelEnabled`, `infoPanelData`, `fetchInfoPanelData`). |
| **Data** | |
| `src/card-history.js` | The history data: the cache of what Home Assistant returned, filled on demand for the time window shown, refreshed; the graphs updated from it. |
| `src/card-datasets.js` | From history data to what the graphs draw: line modes, bars by interval, circular values, timelines, colors. |
| `src/card-values.js` | The values over a graph: each curve's value now (`showState`), its minimum, average and maximum (`showStats`) — computed and formatted, given to the chart to show (`hecSetValues`). |
| **Outputs** | |
| `src/card-graphs.js` | The graphs on the page: built from the store (each entity's defaults, the graph it joins), placed in the display order, rebuilt, removed, their controls (the handle, the chain icon). |
| `src/card-charts.js` | One graph for Chart.js — the card's side of its contract: its chart made (options, axes, legend, tooltip), its datasets made and changed (line mode, interpolation, points, hidden, the legend's value), sized as the card's width says. |
| **Tools of the business program** — pure, no state | |
| `src/history-options.js` | The options: interpolation algorithms, line modes, which types share a graph, bar intervals, the synonyms of option names, which options can be set at which level. |
| `src/history-series.js` | What a curve shows: an entity's state, or one of its attributes — its id, its state, its history. |
| `src/history-units.js` | SI prefixes: which units share an axis, the prefix an axis is shown in. |
| `src/legend-names.js` | The shorter forms of the curves' names, for a legend too narrow for them. |
| `src/gesture-settings.js` | The gesture settings (long-press duration, precision, for a mouse or a pen and for a finger): their bounds, given to Chart.js (`Chart.defaults.global.gestures`). Saved by `card-storage.js`. |
| `src/history-default-colors.js` | The default colors: the palette of the curves, the colors of the timeline states, the toolbar buttons'. |
| `src/history-csv-exporter.js`, `src/languages.js`, `src/card-tests.js` | The CSV export; the card's texts in each language; *Tests (beta)* in the type menu (what a browser reports of a pen; what the card costs on this device). |
| `src/history-info-panel.js` | The history panel of Home Assistant's own entity dialog, built from the same card state. |
| **Toolbox** | |
| `deps/chart-hec.js` | Everything this fork adds to Chart.js — gesture detection, hit-testing, zones, touch overlays, drag feedback, Y axis lock, floating tooltip, the legend's layout, the values over a graph, texts shown in full, `Chart.hecUi`. |
| `deps/Chart.js` | Chart.js 2.7.1, with small changes and the hooks calling into `chart-hec.js`. |

## The rules

1. **Chart.js owns every interaction and everything drawn on and around a graph, the card
   owns every meaning and every piece of data.** The card never listens to a pointer, touch
   or wheel event on a graph, never builds what a graph shows, never reads a chart's
   layout, never calls anything `_hec`. It gives data and decisions through documented
   options and methods, and gets gestures already resolved (zone, label, part of a label,
   position on the time axis, drop target). Chart.js never knows what an entity, a group
   or a time window is. (`deps/Chart Custom.js.md` §0)
2. **The entity list changes only through the store**, and only the operations change what
   is shown: the inputs ask them (`moveCurve`, `splitCurve`, `setCurveType`...), they never
   change the store or the graphs themselves.
3. **One implementation per thing.** A behavior needed in two places is a function both
   call (`moveCurve` for curves and rows, `rebuildGraph`, `Chart.hecUi` for every floating
   element...), never two copies.
4. **A new feature extends a contract, it doesn't reach across one.** A new gesture is a
   `gestureType` or a payload field; a new change of what's shown is an operation; a new
   entity rule is a store method.
5. **Each part does its own job, and talks to another one directly — through that one's
   contract.** No single gateway, no shortcut doing another's job:
   - a part's contract is its public methods; a method starting with `_` is its own and is
     never called from another file;
   - each field of the card's state has one owner, the only part writing it (the state's
     constructor gives every field its first value): the time window is
     `card-timerange.js`'s, the graphs `card-graphs.js`'s, a graph's datasets
     `card-charts.js`'s (filled by `card-datasets.js`), what is saved `card-storage.js`'s,
     a menu's lines `card-menus.js`'s, the toolbar's fields `card-toolbar.js`'s;
   - what Chart.js keeps for itself (its layout, a dataset's meta) is never read; a field
     the card and Chart.js exchange is documented in `deps/Chart Custom.js.md`; a name
     starting with `hec` or `_hec` is Chart.js's — the card's own fields don't use it.
6. **An element is shown only once its data is ready**, sized from it once: a menu's list
   is complete before the menu or the field that opens it shows (the entity selector waits
   for its list); nothing moves under the user afterwards, but for the card's own resize.
7. **An option is put in its one form where it's read**, never later. Every spelling the
   user may write — a synonym, mini-graph-card's names and values, `show:`, a case — is
   resolved once by `history-options.js` `normalizeOptions`, called by `card-config.js`
   where the card, `entityOptions`, a graph and an entity are read; the rest of the card
   only ever tests the one form, and that form is what is saved (so an alias written
   instead of its value isn't a change).

## Where a change goes

| To change... | Look in |
|---|---|
| How a gesture is recognized (timing, zones, touch behavior) | `deps/chart-hec.js` |
| What a gesture means | `src/card-gestures.js` |
| What a menu offers | `src/card-menus.js` |
| What a change of what's shown does (move, split, merge, type, delete...) | `src/card-operations.js`, the rules in `src/history-entity-store.js` |
| How entities are saved | `src/card-storage.js` |
| How the graphs are built and placed | `src/card-graphs.js` |
| What a graph is for Chart.js (options, axes, legend, datasets) | `src/card-charts.js` |
| What a curve's points are | `src/card-datasets.js` |
| The values over a graph | `src/card-values.js` (what they are), `deps/chart-hec.js` (how they're shown, their gestures) |
| The legend | `src/card-charts.js` (its parts), `src/legend-names.js` (shorter names), `deps/chart-hec.js` + `deps/Chart.js` (its layout) |
| How data is fetched | `src/card-history.js` |
| The entity selector | `src/card-selector.js` |
| The time window | `src/card-timerange.js` |
| An option | `src/history-options.js` (names, levels), `src/card-config.js` (applied) |
| An attribute shown as a curve | `src/history-series.js` (ids, state, history), `src/card-history.js` (`historyCall`), `src/card-selector.js` (its submenu) |
| The toolbar, the layout | `src/card-toolbar.js` |

## Tests

`yarn build` then `yarn test` ([`tests/README.md`](tests/README.md)):

- **lint** — every identifier is declared, no import is assigned, in every source;
- **architecture** — the rules above, checked on the sources: the card uses only Chart.js's
  stock API and what its contract documents; Chart.js knows nothing of the card's
  business; the data-only parts have no DOM; persistence is `card-storage.js`'s; the
  entity list changes through the store; a graph's datasets are `card-charts.js`'s; a
  gesture on a graph is Chart.js's; a menu's elements are `card-menus.js`'s; rendering is
  Chart.js's; a part calls another part's public methods only; each field of the state has
  one owner; the inputs never change what's shown themselves. An exception is written in
  the test with its reason, and fails once it's no longer needed;
- **store** — the entity store on its own, no browser;
- the other suites — the built card in Chromium against a mocked Home Assistant: every
  gesture with a mouse and with fingers (real touch: `touch-action` and page scrolling
  apply), and each feature in a suite of its own (the list is in `tests/README.md`);
  after each scenario, the persisted entities must match what is shown.
