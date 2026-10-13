# Architecture (v1.2)

How the card's code is organized, what each part is responsible for, and the rules that
keep them apart. For the details of the boundary with Chart.js, see
[`deps/Chart Custom.js.md`](deps/Chart%20Custom.js.md).

## The parts

```
                 Home Assistant (states, history, statistics, user data)
                        │                                   ▲
                        ▼                                   │
 card-history.js ── cache, history retrieval       card-storage.js ── local state, HA user
        │                                                   ▲        data, YAML, merge rules
        ▼                                                   │
 card-datasets.js ── data → datasets           history-entity-store.js ── the entities:
        │                                                   ▲        groups, order, options
        ▼                                                   │
 card-graphs.js ── graphs, axes, linked groups ─────────────┤
 card-timerange.js, card-toolbar.js, card-selector.js       │
        │        ▲                                          │
        │        │ customEvent, panX, zoomX                 │
        ▼        │                                          │
 deps/chart-hec.js + deps/Chart.js ──────────► card-gestures.js, card-menus.js
   (every interaction on a graph)                (what gestures and menus mean)
```

| File | Role |
|---|---|
| `src/history-explorer-card.js` | The card itself (`HistoryExplorerCard`) and its state (`HistoryCardState`): its life cycle, the card's content, the state colors, localization. The state's methods are spread over the `card-*.js` files below by role, added to the class at the end of this file. |
| `src/card-config.js` | The YAML options applied, what Home Assistant and the entity options say of an entity (domain, device class, unit, default type), the graphs built from the YAML. |
| `src/card-timerange.js` | The time window shown: its range, its moves (days, today, zoom steps), the time axis of each graph. |
| `src/history-entity-store.js` | **The model**: the persisted list of entities (`pconfig.entities`) — which curve is shown (a series and, for a second curve of it in another graph, its copy number: its key, `keyOf`), in which group of linked graphs, in which order, with its own options. Every change to that list goes through it. Pure data, no DOM. |
| `src/card-history.js` | The history data: the cache of what Home Assistant returned, filled on demand for the time window shown, and the graphs updated from it. |
| `src/card-graphs.js` | The graphs: each chart created (axes, legend, tooltip), filled with its entities (two Y axes, SI conversion), placed in the display order, linked, merged, removed. |
| `src/card-datasets.js` | From history data to what the graphs draw: line modes, bars by interval, circular values, timelines. |
| `src/card-gestures.js` | What the gestures on the graphs mean — and the entity moves they lead to (split, merge, drop, reorder). |
| `src/card-menus.js` | The entity type menu — the same menu for a graph (its Y axis lock, its layout) — the options menu, their keyboard navigation. |
| `src/card-selector.js` | The entity selector: the entities listed and filtered, and those it adds (wildcards included) or removes. |
| `src/card-toolbar.js` | The card's HTML: the toolbars and their menu entries, the interval selector of bar graphs, the layout as the card resizes. |
| `src/card-storage.js` | What is kept between sessions and devices (the persistence scopes of the options), and the "last one to speak wins" merge of local state, HA user data and YAML — the only part reading or writing either. What the whole page shares, read before any card exists, too: the gesture settings (`localGestures`), the info panel's switch and config (`infoPanelEnabled`, `infoPanelData`, `fetchInfoPanelData`). |
| `src/history-units.js` | SI prefixes: which units share an axis, the prefix an axis is shown in. |
| `src/card-values.js` | The values over a graph: each curve's value now (`showState`), its minimum, average and maximum over the window shown (`showStats`), from its history — computed and formatted, given to the chart to show (`hecSetValues`). |
| `src/legend-names.js` | The shorter forms of the curves' names, for a legend too narrow for them (a qualifier as its initials, the device's name removed or abbreviated, the articles removed). Pure data, no DOM. |
| `src/history-series.js` | What a curve shows: an entity's state, or one of its attributes — its id (`climate.salon.current_temperature`), its state as Home Assistant would give an entity's (`stateOf`), its history from its entity's. |
| `src/gesture-settings.js` | The gesture settings of every card (long-press duration, drag distance, for a mouse or a pen and for a finger): their bounds, and given to Chart.js (`Chart.defaults.global.gestures`). Saved by `card-storage.js`. |
| `src/history-options.js` | The card's options: the curve interpolation algorithms, the synonyms of the option names, which options can be set at which level (card, entityOptions, graph, entity). |
| `src/card-tests.js` | *Tests (beta)* at the end of the type menu: what a browser reports of a pen, shown and sent as a report. |
| `src/history-csv-exporter.js` | The CSV export. |
| `src/history-default-colors.js` | The default colors: the palette of the curves, the colors of the timeline states. |
| `src/languages.js` | The card's texts in each language. |
| `src/history-info-panel.js` | The history panel of Home Assistant's own entity dialog, built from the same card state. |
| `deps/chart-hec.js` | **The interaction and display layer**: everything this fork adds to Chart.js — gesture detection, hit-testing, zones, touch overlays, drag feedback, Y axis lock, floating tooltip, the legend's layout (shortened names, its parts), the values over a graph, texts shown in full, `Chart.hecUi`. |
| `deps/Chart.js` | Chart.js 2.7.1, with small changes and the hooks calling into `chart-hec.js`. |

## The rules

1. **Chart.js owns every interaction and everything drawn on and around a graph, the card
   owns every meaning and every piece of data.** The card never listens to a pointer, touch
   or wheel event on a graph or what's drawn around it, never builds what a graph shows
   (its legend, the values over it), never reads a chart's layout, never calls anything
   `_hec`. It gives data and decisions through documented options and methods (what to
   show, in which colors, how a value reads), and gets gestures already resolved (zone,
   label, part of a label, position on the time axis, drop target). Chart.js never knows
   what an entity, a group or a time window is. The menus (`card-menus.js`), the
   persistence (`card-storage.js`) and the entity list (the store) each keep to their own
   contract. (`deps/Chart Custom.js.md` §0)
2. **The entity list changes only through the store.** The graphs on screen are built
   from it; its order is the display order between groups; a group's entries are always
   contiguous.
3. **One implementation per thing.** A behavior needed in two places is a function both
   call (`_moveEntity` for curves and rows, `_rebuildGraph`, `Chart.hecUi` for every
   floating element...), never two copies.
4. **A new feature extends a contract, it doesn't reach across one.** A new gesture is a
   `gestureType` or a payload field; a new entity operation is a store method.
5. **Each part does its own job, and talks to another one directly — through that one's
   contract.** No part goes through a single gateway to reach another, and none does
   another's job by the shortest path: the time axis is set by `card-timerange.js` alone,
   what is saved is read and written by `card-storage.js` alone, a graph's datasets are
   made and changed by `card-graphs.js` (filled by `card-datasets.js`), a menu's lines are
   `card-menus.js`'s, what Chart.js keeps for itself (its layout, a dataset's meta) is
   never read. A field the card and Chart.js exchange is documented in
   `deps/Chart Custom.js.md`; a name starting with `hec` or `_hec` is Chart.js's — the
   card's own fields don't use it.

## Where a change goes

| To change... | Look in |
|---|---|
| How a gesture is recognized (timing, zones, touch behavior) | `deps/chart-hec.js` |
| What a gesture does | `src/card-gestures.js` |
| How entities are grouped, ordered, moved, saved | `src/history-entity-store.js` (rules), `src/card-gestures.js` (operations), `src/card-storage.js` (persistence) |
| What a curve looks like | `src/card-datasets.js` |
| The values over a graph | `src/card-values.js` (what they are), `deps/chart-hec.js` (how they're shown, their gestures) |
| The legend | `src/card-graphs.js` (its parts, colors), `src/legend-names.js` (shorter names), `deps/chart-hec.js` + `deps/Chart.js` (its layout) |
| How data is fetched | `src/card-history.js` |
| A menu | `src/card-menus.js` |
| The entity selector | `src/card-selector.js` |
| How a graph is built, its axes | `src/card-graphs.js` |
| The time range | `src/card-timerange.js` |
| An option | `src/history-options.js` (names, levels), `src/card-config.js` (applied) |
| An attribute shown as a curve | `src/history-series.js` (ids, state, history), `src/card-history.js` (`historyCall`), `src/card-selector.js` (its submenu) |
| The toolbar, the layout | `src/card-toolbar.js` |

## Tests

`yarn build` then `yarn test` ([`tests/README.md`](tests/README.md)):

- **lint** — every identifier is declared, no import is assigned (catches what moving
  code between files leaves behind);
- **architecture** — the rules above, checked on the sources: the card uses only Chart.js's
  stock API and what its contract documents, Chart.js knows nothing of the card's business,
  the data-only parts have no DOM, persistence is `card-storage.js`'s, the entity list
  changes through the store, a graph's datasets are `card-graphs.js`'s, a gesture on a graph is Chart.js's, a menu's elements are
  `card-menus.js`'s, rendering is Chart.js's. An exception is written in the test with its
  reason, and fails once it's no longer needed;
- **store** — the entity store on its own, no browser;
- the other suites — the built card in Chromium against a mocked Home Assistant: every
  gesture with a mouse and with fingers (real touch: `touch-action` and page scrolling
  apply), and each feature in a suite of its own (the list is in `tests/README.md`);
  after each scenario, the persisted entities must match what is shown.
