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
| `src/card-storage.js` | What is kept between sessions and devices (the persistence scopes of the options), and the "last one to speak wins" merge of local state, HA user data and YAML. |
| `src/history-units.js` | SI prefixes: which units share an axis, the prefix an axis is shown in. |
| `src/history-series.js` | What a curve shows: an entity's state, or one of its attributes — its id (`climate.salon.current_temperature`), its state as Home Assistant would give an entity's (`stateOf`), its history from its entity's. |
| `src/history-options.js` | The card's options: the curve interpolation algorithms, the synonyms of the option names, which options can be set at which level (card, entityOptions, graph, entity). |
| `src/history-info-panel.js` | The history panel of Home Assistant's own entity dialog, built from the same card state. |
| `deps/chart-hec.js` | **The interaction layer**: everything this fork adds to Chart.js — gesture detection, hit-testing, zones, touch overlays, drag feedback, Y axis lock, floating tooltip, `Chart.hecUi`. |
| `deps/Chart.js` | Chart.js 2.7.1, with small changes and the hooks calling into `chart-hec.js`. |

## The rules

1. **Chart.js owns every interaction, the card owns every meaning.** The card never
   listens to a pointer, touch or wheel event on a graph, never reads a chart's layout,
   never calls anything `_hec`. It gets gestures already resolved (zone, label, position
   on the time axis, drop target) and answers through documented options. Chart.js never
   knows what an entity, a group or a time window is.
   (`deps/Chart Custom.js.md` §0)
2. **The entity list changes only through the store.** The graphs on screen are built
   from it; its order is the display order between groups; a group's entries are always
   contiguous.
3. **One implementation per thing.** A behavior needed in two places is a function both
   call (`_moveEntity` for curves and rows, `_rebuildGraph`, `Chart.hecUi` for every
   floating element...), never two copies.
4. **A new feature extends a contract, it doesn't reach across one.** A new gesture is a
   `gestureType` or a payload field; a new entity operation is a store method.

## Where a change goes

| To change... | Look in |
|---|---|
| How a gesture is recognized (timing, zones, touch behavior) | `deps/chart-hec.js` |
| What a gesture does | `src/card-gestures.js` |
| How entities are grouped, ordered, moved, saved | `src/history-entity-store.js` (rules), `src/card-gestures.js` (operations), `src/card-storage.js` (persistence) |
| What a curve looks like | `src/card-datasets.js` |
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
- **store** — the entity store on its own, no browser;
- **mouse**, **touch**, **cards**, **features**, **panel** — the built card in Chromium against a mocked Home
  Assistant: every gesture with a mouse and with fingers (real touch: `touch-action` and
  page scrolling apply), linked graphs, menus, two cards on one page, history and
  statistics, CSV export, refresh, the entity selector, the info panel, the type menu,
  arrowlines, `scale`, the options at every level and the Interpolation submenu, persistence and the
  last one to speak, the pen, the colors (a value, thresholds, an entity holding them), the two Y axes; after each scenario,
  the persisted entities must match what is shown.
