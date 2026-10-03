# Interaction tests

Automated checks that the gestures on the graphs still do what they should, with a mouse
and with fingers: pan and zoom of the time and of the Y axis, label and graph drags, splits
and merges of linked graphs, menus, messages, two cards on one page.

The suites:

| Suite | What it checks |
|---|---|
| `lint` | Every identifier declared, no import assigned (static, no browser) |
| `store` | The entity store (`src/history-entity-store.js`) on its own (no browser) |
| `mouse`, `touch` | Every gesture on the graphs, with a mouse and with fingers |
| `cards` | Two cards on one page, menus, graphs added from the UI, linked graphs |
| `features` | History and long-term statistics, CSV export, refresh, current values, the entity selector, dark theme, another language |
| `panel` | The info panel in Home Assistant's entity dialog |
| `typemenu` | The type menu: its order, the type pre-selected for a new entity, the keyboard |
| `arrowline` | Arrowline arrows turn by value / the entity's circular period (360 by default) |
| `scale` | `scale` without `unit` changes only the drawing (real value in the legend and tooltip), with `unit` it converts |
| `options` | The options at every level (card, entityOptions, graph, entity) with their synonyms, `interpolation` and the Reconstruction submenu (card and info panel, keyboard and mouse, kept after a reload), automatic refresh on by default |

They run the built card (`history-explorer-card.js`) in Chromium, in `page.html` (a card)
or `panel.html` (the info panel), against `mock-ha.js`: a mock of the Home Assistant APIs
the card uses — states, history (realistic series, a retention period), long-term
statistics, user data — whose behavior each test sets (`window.MOCK`). Touch goes through the browser's real
input pipeline, so `touch-action` and page scrolling behave as on a phone (a real phone,
iOS Safari especially, is still worth a try before a release).

```sh
yarn build
yarn test              # every suite
yarn test touch        # one suite: lint, store, mouse, touch, cards, features, panel, typemenu, arrowline, scale or options
```

Chromium comes with Playwright (`npx playwright install chromium` once); set
`CHROMIUM_PATH` to use another one.

Each step prints ✓ or ✗ with what went wrong; the run fails if any step fails or the page
throws an error. `page.html`'s probes (`legendPt`, `yRange`, …) read the charts' layout to
know where to press — the card itself never does (see `deps/Chart Custom.js.md` §0).
