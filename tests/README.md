# Interaction tests

Automated checks that the gestures on the graphs still do what they should, with a mouse
and with fingers: pan and zoom of the time and of the Y axis, label and graph drags, splits
and merges of linked graphs, menus, messages, two cards on one page.

The suites:

| Suite | What it checks |
|---|---|
| `lint` | Every identifier declared, no import assigned, in every source (static, no browser) |
| `architecture` | The rules of `ARCHITECTURE.md`, on the sources (static, no browser): each part keeps to its own job and reaches another one only through its contract — the card uses only Chart.js's stock API and what `deps/Chart Custom.js.md` documents, no business in Chart.js, no DOM in the data-only parts, persistence in `card-storage.js` alone, the entity list through the store, the datasets changed by `card-graphs.js`, no listener on a graph, the menus' elements in `card-menus.js`, no rendering in the card; each exception with its reason, and none left unused |
| `legend` | The shorter forms of curve names for a narrow legend (`src/legend-names.js`), no browser: a frequent qualifier, the device removed or abbreviated, the articles, never two curves the same |
| `store` | The entity store (`src/history-entity-store.js`) on its own (no browser), the place a curve dropped without saving is saved at included |
| `mouse`, `touch` | Every gesture on the graphs, with a mouse and with fingers; a text shortened or hidden shown in full in place, on a hover and on a click or a tap |
| `cards` | Two cards on one page, menus, graphs added from the UI, linked graphs |
| `features` | History and long-term statistics, CSV export, refresh, current values, the entity selector, dark theme, another language, the cursor line, the min/max band |
| `panel` | The info panel in Home Assistant's entity dialog |
| `typemenu` | The type menu: its order, the type pre-selected for a new entity, the keyboard |
| `arrowline` | Arrowline arrows turn by value / the entity's circular period (360 by default) |
| `scale` | `scale` without `unit` changes only the drawing (real value in the legend and tooltip), with `unit` it converts |
| `options` | The options at every level (card, entityOptions, graph, entity) with their synonyms, `interpolation` and the Interpolation submenu (card and info panel, keyboard, mouse and touch, at the screen edges, inside a shadow root, kept after a reload), automatic refresh on by default and at most one request every 2 s |
| `persistence` | Every option that can be changed from the card (interpolation, line mode, display type, hidden, bar interval, split, a drop onto another graph — saved only when both graphs are), and the time range: without persistence, with `enable_persistence`, with `enable_multidevice_persistence` on this device and on a new one; the last one to speak — the YAML, another device — winning; *Card ▸ Default graphs* and *Default display*, confirmed, on this device and another |
| `pen` | A pen (Pointer Events of type `pen`): barrel button held, a drag moves a label at once and a tap opens the type menu; barrel button pressed twice with the tip down splits a curve; the tip taps as a finger; the tooltip opened by a tap, moved by hovering, closed when the pen moves away |
| `colors` | A curve's or bar's color: a value, thresholds on its own value or on another entity's value or states (with `default`), an entity holding the color; the legend's swatch, the color kept or changed when a curve moves to another graph |
| `graphmenu` | A graph's menu (long-press, right click, touch): its title, *Display* and *Interpolation* for all its curves, its submenus placed as everywhere, the Y axis locked and released, a graph added from the card deleted; cut and paste: a graph inserted above or below another (by a click, or a swipe up or down, mouse and touch), a curve pasted into a graph, the places refused struck through and saying why, cancelled by a click elsewhere, Escape or ✂, a click just beside a button counting as on it, halfway between two doing nothing |
| `values` | Over a graph: each curve's value now and its statistics over the window shown (`showState`, `showStats` at every level, a hidden curve, the window moved), `showGrid`, `yLabels: inside`, `fill: fade`, `look: mini` (the card's own options winning); a narrow card's values (the first large, the others small); a click on a value — in the legend, over the graph — or the menu's Info: the entity's dialog; a hidden curve's name struck through, not its value |
| `realtime` | Zooming the time in real time (the present kept on the right by the + / − buttons, the time range selector, the wheel from the right 10 %, a pinch with a finger in the right 20 %) and in the history (the middle kept, whatever the duration) |
| `points` | A gesture on a curve, picked as a label is: a hover shows the point of the curve it is on (its value nearest along the time), a click puts it in the tooltip mode (one curve, then two; beside them, leaving them), a long-press or a right click shows or hides its points (mouse and finger); of two curves the one under the pointer, the dead zone between two, two on top of each other; *Show the points* in the Layout submenus; Alt's points as wide as the line + 2 px |
| `settings` | The options menu in submenus; a menu wider than its submenus, a card too narrow (the menu alone, a strip of its lines left); the gesture settings: kept within bounds, a long-press, a drag and a target picked by the values set, saved on every device, the YAML and the menu (last one to speak), another device; the info panel's switch on a new device; every language's menus no wider than the French ones |
| `copies` | The same curve in several graphs: in the YAML, from the selector after a choice (cancel or a second curve), each its own and saved on its own, refused twice in one graph, kept on another device |
| `attributes` | An entity's attributes as curves (a number followed by its unit, colors read from an attribute): `attribute:` in the YAML (and after the entity id), their history asked with the attributes, never their statistics; the entity selector's submenu (*Value* first, then the attributes), keyboard and mouse, kept after a reload |
| `modes` | Every gesture in every layout: the padlock, the graph's and a curve's menus, a timeline row's, the Y axis, a value's tooltip and points, the hover, the time, the split and the merge by the chain icon, a curve and a graph moved — with a mouse and a finger, at full width and on a narrow card; `look: mini` |
| `yaxes` | Two Y axes: one per group of units (left, right), `yAxis`, the arrow in the legend, linked graphs aligned, circular labels and stacked bars per axis; dragging each axis, Shift, the pinch and the padlock on both; the labels inside the plot: near them a drag (mouse), a tap then a drag (finger, pen) moves that axis and its curves, left and right, a click, a long press, a hover are the curves' |

They run the built card (`history-explorer-card.js`) in Chromium, in `page.html` (a card)
or `panel.html` (the info panel), against `mock-ha.js`: a mock of the Home Assistant APIs
the card uses — states, history (realistic series, a retention period), long-term
statistics, user data — whose behavior each test sets (`window.MOCK`). Touch goes through the browser's real
input pipeline, so `touch-action` and page scrolling behave as on a phone (a real phone,
iOS Safari especially, is still worth a try before a release).

```sh
yarn build
yarn test              # every suite
yarn test touch        # one suite: lint, store, legend, mouse, touch, cards, features, panel, typemenu, arrowline, scale, options, persistence, pen, colors, yaxes, graphmenu, attributes, copies, values, realtime, points, settings or modes
```

Chromium comes with Playwright (`npx playwright install chromium` once); set
`CHROMIUM_PATH` to use another one.

Each step prints ✓ or ✗ with what went wrong; the run fails if any step fails or the page
throws an error. `page.html`'s probes (`legendPt`, `yRange`, …) read the charts' layout to
know where to press — the card itself never does (see `deps/Chart Custom.js.md` §0).
