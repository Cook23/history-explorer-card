# Interaction tests

Automated checks that the gestures on the graphs still do what they should, with a mouse
and with fingers: pan and zoom of the time and of the Y axis, label and graph drags, splits
and merges of linked graphs, menus, messages, two cards on one page.

The suites:

| Suite | What it checks |
|---|---|
| `lint` | Every identifier declared, no import assigned (static, no browser) |
| `store` | The entity store (`src/history-entity-store.js`) on its own (no browser), the place a curve dropped without saving is saved at included |
| `mouse`, `touch` | Every gesture on the graphs, with a mouse and with fingers |
| `cards` | Two cards on one page, menus, graphs added from the UI, linked graphs |
| `features` | History and long-term statistics, CSV export, refresh, current values, the entity selector, dark theme, another language, the cursor line, the min/max band |
| `panel` | The info panel in Home Assistant's entity dialog |
| `typemenu` | The type menu: its order, the type pre-selected for a new entity, the keyboard |
| `arrowline` | Arrowline arrows turn by value / the entity's circular period (360 by default) |
| `scale` | `scale` without `unit` changes only the drawing (real value in the legend and tooltip), with `unit` it converts |
| `options` | The options at every level (card, entityOptions, graph, entity) with their synonyms, `interpolation` and the Interpolation submenu (card and info panel, keyboard, mouse and touch, at the screen edges, inside a shadow root, kept after a reload), automatic refresh on by default and at most one request every 2 s |
| `persistence` | Every option that can be changed from the card (interpolation, line mode, display type, hidden, bar interval, split, a drop onto another graph — saved only when both graphs are), and the time range: without persistence, with `enable_persistence`, with `enable_multidevice_persistence` on this device and on a new one; the last one to speak — the YAML, another device — winning |
| `pen` | A pen (Pointer Events of type `pen`): barrel button held, a drag moves a label at once and a tap opens the type menu; barrel button pressed twice with the tip down splits a curve; the tip taps as a finger; the tooltip opened by a tap, moved by hovering, closed when the pen moves away |
| `colors` | A curve's or bar's color: a value, thresholds on its own value or on another entity's value or states (with `default`), an entity holding the color; the legend's swatch, the color kept or changed when a curve moves to another graph |
| `graphmenu` | A graph's menu (long-press, right click, touch): its title, *Display* and *Interpolation* for all its curves, its submenus placed as everywhere, the Y axis locked and released, a graph added from the card deleted; cut and paste: a graph inserted above or below another (by a click, or a swipe up or down, mouse and touch), a curve pasted into a graph, the places refused struck through and saying why, cancelled by a click elsewhere, Escape or ✂, a click just beside a button counting as on it, halfway between two doing nothing |
| `copies` | The same curve in several graphs: in the YAML, from the selector after a choice (cancel or a second curve), each its own and saved on its own, refused twice in one graph, kept on another device |
| `attributes` | An entity's attributes as curves (a number followed by its unit, colors read from an attribute): `attribute:` in the YAML (and after the entity id), their history asked with the attributes, never their statistics; the entity selector's submenu (*Value* first, then the attributes), keyboard and mouse, kept after a reload |
| `yaxes` | Two Y axes: one per group of units (left, right), `yAxis`, the arrow in the legend, linked graphs aligned, circular labels and stacked bars per axis; dragging each axis, Shift, the pinch and the padlock on both |

They run the built card (`history-explorer-card.js`) in Chromium, in `page.html` (a card)
or `panel.html` (the info panel), against `mock-ha.js`: a mock of the Home Assistant APIs
the card uses — states, history (realistic series, a retention period), long-term
statistics, user data — whose behavior each test sets (`window.MOCK`). Touch goes through the browser's real
input pipeline, so `touch-action` and page scrolling behave as on a phone (a real phone,
iOS Safari especially, is still worth a try before a release).

```sh
yarn build
yarn test              # every suite
yarn test touch        # one suite: lint, store, mouse, touch, cards, features, panel, typemenu, arrowline, scale, options, persistence, pen, colors, yaxes, graphmenu, attributes or copies
```

Chromium comes with Playwright (`npx playwright install chromium` once); set
`CHROMIUM_PATH` to use another one.

Each step prints ✓ or ✗ with what went wrong; the run fails if any step fails or the page
throws an error. `page.html`'s probes (`legendPt`, `yRange`, …) read the charts' layout to
know where to press — the card itself never does (see `deps/Chart Custom.js.md` §0).
