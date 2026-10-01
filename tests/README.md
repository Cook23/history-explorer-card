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

They run the built card (`history-explorer-card.js`) in Chromium, in `page.html` (a card)
or `panel.html` (the info panel), against `mock-ha.js`: a mock of the Home Assistant APIs
the card uses — states, history (realistic series, a retention period), long-term
statistics, user data — whose behavior each test sets (`window.MOCK`). Touch goes through the browser's real
input pipeline, so `touch-action` and page scrolling behave as on a phone (a real phone,
iOS Safari especially, is still worth a try before a release).

```sh
yarn build
yarn test              # every suite
yarn test touch        # one suite: lint, store, mouse, touch, cards, features or panel
```

Chromium comes with Playwright (`npx playwright install chromium` once); set
`CHROMIUM_PATH` to use another one.

Each step prints ✓ or ✗ with what went wrong; the run fails if any step fails or the page
throws an error. `page.html`'s probes (`legendPt`, `yRange`, …) read the charts' layout to
know where to press — the card itself never does (see `deps/Chart Custom.js.md` §0).
