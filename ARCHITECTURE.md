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
 history-explorer-card.js ── graphs, layout, toolbar ───────┤
        │        ▲                                          │
        │        │ customEvent, panX, zoomX                 │
        ▼        │                                          │
 deps/chart-hec.js + deps/Chart.js ──────────► card-gestures.js, card-menus.js
   (every interaction on a graph)                (what gestures and menus mean)
```

| File | Role |
|---|---|
| `src/history-explorer-card.js` | The card itself (`HistoryExplorerCard`) and its state (`HistoryCardState`): configuration, building and laying out the graphs, the toolbars, the time range, localization. Its methods are spread over the `card-*.js` files below, added to the class at the end of this file. |
| `src/history-entity-store.js` | **The model**: the persisted list of entities (`pconfig.entities`) — which entity is shown, in which group of linked graphs, in which order, with its own options. Every change to that list goes through it. Pure data, no DOM. |
| `src/card-history.js` | The history data: the cache of what Home Assistant returned, filled on demand for the time window shown. |
| `src/card-datasets.js` | From history data to what the graphs draw: line modes, bars by interval, circular values, timelines. |
| `src/card-gestures.js` | What the gestures on the graphs mean — and the entity moves they lead to (split, merge, drop, reorder). |
| `src/card-menus.js` | The entity type menu, the options menu, the entity selector. |
| `src/card-storage.js` | What is kept between sessions and devices, and the "last one to speak wins" merge of local state, HA user data and YAML. |
| `src/history-units.js` | SI prefixes: which units share an axis, the prefix an axis is shown in. |
| `src/history-options.js` | The card's options: the curve reconstruction algorithms, the synonyms of the option names, which options can be set at which level (card, entityOptions, graph, entity). |
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
| A menu or the entity selector | `src/card-menus.js` |
| Options, layout, toolbar | `src/history-explorer-card.js` |

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
  last one to speak; after each scenario,
  the persisted entities must match what is shown.
