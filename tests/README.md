# Interaction tests

Automated checks that the gestures on the graphs still do what they should, with a mouse
and with fingers: pan and zoom of the time and of the Y axis, label and graph drags, splits
and merges of linked graphs, menus, messages, two cards on one page.

They run the built card (`history-explorer-card.js`) in Chromium, in `page.html`, a page
that mocks the few Home Assistant APIs the card uses. Touch goes through the browser's real
input pipeline, so `touch-action` and page scrolling behave as on a phone (a real phone,
iOS Safari especially, is still worth a try before a release).

```sh
yarn build
yarn test              # every suite
yarn test touch        # one suite: lint, store, mouse, touch or cards
```

Chromium comes with Playwright (`npx playwright install chromium` once); set
`CHROMIUM_PATH` to use another one.

Each step prints ✓ or ✗ with what went wrong; the run fails if any step fails or the page
throws an error. `page.html`'s probes (`legendPt`, `yRange`, …) read the charts' layout to
know where to press — the card itself never does (see `deps/Chart Custom.js.md` §0).
