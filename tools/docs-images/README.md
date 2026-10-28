# The documentation's images

These scripts render the images of README.md and README_Full.md: the built card
(`history-explorer-card.js`, run `yarn build` first) in Chromium, against the tests' mocked
Home Assistant (`tests/mock-ha.js`), with realistic entities and histories.

```sh
node tools/docs-images/render.cjs            # every image
node tools/docs-images/render.cjs menu-graph # only the scenes named
```

The images are written to `tools/docs-images/out/` (not committed), named as the READMEs
link them. They are stored on `main`, in `images/screenshots/`: copy the ones you changed
there, in a PR to `main`. The READMEs of every line link to
`https://github.com/Cook23/history-explorer-card/raw/main/images/screenshots/…`.

| File | What it renders |
|---|---|
| `page.html` | The page: the mocked Home Assistant with only the docs' entities, Home Assistant's state names, its `ha-card` with its header, the tests' probes (`legendPt`, `moPt`…) |
| `doclib.cjs` | `openDoc` (a page with the card: entities, histories as `[seconds ago, state]`, clock, width, dark theme), `shot`, `annotate` (red arrows and notes), `compose` (images put together), the data generators |
| `scenes.cjs` | The card of the READMEs' top (`home`) and the modem's scene, shared by several scripts |
| `r-hero.cjs` | `hero` |
| `r-modem.cjs` | `adding-entities` |
| `r-menus.cjs` | `menu-curve`, `menu-graph`, `menu-timeline`, `menu-export`, `menu-options` |
| `r-drag.cjs` | `drag-label`, `drag-graph`, `drag-row`, `drag-yaxis` |
| `r-all.cjs` | Every other scene, each with its entities, histories, config and what is done before the capture |

The images are taken at a device pixel ratio of 2, in the light theme (`narrow-and-mini` also
in the dark one). The time is set by each scene (`clock`), so a scene renders the same image
whenever it runs.
