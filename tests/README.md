# Interaction tests

Automated checks that the card still does what it should, with a mouse and with fingers:
pan and zoom of the time and of the Y axis, label and graph drags, splits and merges of
linked graphs, menus, messages, options, saving, two cards on one page.

The suites:

| Suite | What it checks |
|---|---|
| `lint` | Every identifier declared, no import assigned (static, no browser) |
| `mouse`, `touch` | Every gesture on the graphs, with a mouse and with fingers |
| `cards` | Two cards on one page, the type menu, an entity added twice, graphs added from the UI, linked graphs |
| `features` | History and long-term statistics, CSV export, refresh, current values, the entity selector, dark theme, another language, the cursor line, the min/max band |
| `panel` | The info panel in Home Assistant's entity dialog, and Home Assistant's own history when it is off |
| `typemenu` | The type menu: its order, the type pre-selected for a new entity, the keyboard |
| `arrowline` | Arrowline arrows turn by value / the entity's circular period (360 by default) |
| `scale` | `scale` without `unit` changes only the drawing (real value in the legend and tooltip), with `unit` it converts |
| `options` | The options at every level (card, entityOptions, graph, entity) with their synonyms, `interpolation` and the Interpolation submenu (card and info panel, keyboard, mouse and touch, at the screen edges, inside a shadow root, kept after a reload), automatic refresh on by default and at most one request every 2 s |
| `persistence` | Every option that can be changed from the card (interpolation, line mode, display type, hidden, bar interval, split, a drop onto another graph), and the time range: without persistence, with `enable_persistence`, with `enable_multidevice_persistence` on this device and on a new one; the last one to speak — the YAML, another device — winning |
| `fixes` | Bugs fixed, kept fixed: each step reproduces what went wrong before its fix |

They run the built card (`history-explorer-card.js`) in Chromium, in `page.html` (a card)
or `panel.html` (the info panel), against `mock-ha.js`: a mock of the Home Assistant APIs
the card uses — states, history (realistic series, a retention period), long-term
statistics, user data — whose behavior each test sets (`window.MOCK`). Touch goes through
the browser's real input pipeline, so `touch-action` behaves as on a phone (a real phone,
iOS Safari especially, is still worth a try before a release).

```sh
yarn build
yarn test              # every suite
yarn test touch        # one suite: lint, mouse, touch, cards, features, panel, typemenu, arrowline, scale, options, persistence or fixes
```

Chromium comes with Playwright (`npx playwright install chromium` once); set
`CHROMIUM_PATH` to use another one.

Each step prints ✓ or ✗ with what went wrong; the run fails if any step fails or the page
throws an error. `page.html`'s probes (`legendPt`, `yRange`, …) read the charts' layout to
know where to press.
