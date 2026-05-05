# Changelog

Changelog for the HA History Explorer Card.
(Using format and definitions from https://keepachangelog.com/en/1.0.0/)

## [v1.1.15] - 2026-05-05
### Changed
- Legend overlay (`#lg-N`) now covers the close button (`#bc-N`) zone — clicks forwarded to `#bc-N` when pointer is over it, matching the existing `#mo-N` → `#ca-N` pattern
- Graph move activation deferred to 5px threshold — ghost and drag state only activate after the pointer has moved enough, preventing accidental drags on single clicks (same logic as legend label drag)
- Cursor management on `#mo-N` and `#lg-N` now position-aware: `default` over `#ca-N` and `#bc-N`, `grab` over the domino, `move` over legend labels, `default` elsewhere
### Fixed
- Close button (`#bc-N`) no longer blocked by legend overlay — clicks reach it correctly even when a legend label overlaps it visually
- Clicking the domino/padlock zone no longer triggers accidental graph moves

## [v1.1.14] - 2026-05-05
### Changed
- Legend overlay (`#lg-N`) now receives pointer events directly (`pointer-events:auto`) with `setPointerCapture` on `pointerdown`, matching the graph drag overlay (`#mo-N`) — eliminates page scroll when dragging legend labels outside the legend zone on mobile
- Legend drag logic extracted into dedicated `legendDragStart/Move/End` handlers — no longer piggybacked on the canvas `pointerDown/Move/Up` handlers
- Drag feedback (`_updateDragFeedback`) and drop finalization (`_finalizeLegendDrop`) refactored into shared methods called by both the legend overlay handlers and the canvas handlers — zero code duplication
- `#lg-N` height now synchronized after every `chart.update()` via a Chart.js `afterUpdate` plugin — stays in sync when entities are added or removed
### Fixed
- Page scroll triggered when dragging a legend label beyond the legend zone on mobile (root cause: canvas `touch-action:pan-y` was never overridden once the pointer left `#lg-N`)

## [v1.1.13] - 2026-05-05
### Added
- Visual drag & drop feedback: ghost element following the cursor, insertion markers (vertical for legend labels, horizontal for timelines/graphs), drop target highlighting, `not-allowed` cursor on incompatible targets
- Legend overlay (`#lg-N`) with `touch-action:none` to prevent page scroll when dragging legend labels on mobile
- Drag activation threshold (5px) — ghost and drag state only activate after the pointer has moved enough, preventing accidental drags on single clicks
- `click` event blocked after a real drag to prevent Chart.js toggling label visibility on drop
- Legend label detection unified in `_findLegendLabel(hitBoxes, cx, cy, excludeIdx, target)` — closest-Y then closest-X logic with strict line bounds, used consistently for grab (cursor), drag start and drop
- Chart freeze on legend overlay hover during drag — prevents label position changes while positioning the insertion marker
- Legend label visibility (hidden/shown) now persisted per entity in `pconfig.entities` and restored on reload
### Fixed
- Color deduplication in `addDynamicGraph` now only checks against the actual target graph, never against unrelated graphs — fixes color loss on reload and after intra-graph reorder with 2 curves
- First entity of a rebuilt group no longer triggers a false color conflict (no target graph exists yet at that point)
- Insertion marker correctly hidden when dragging a label over its own position (no-op detection uses same logic as the drop)
- Legend label grab zone and cursor zone now use identical logic (`_findLegendLabel`) — no more asymmetric hit areas on first/last labels

## [v1.1.12] - 2026-04-23
### Added
- Per-user server-side persistence via HA `frontend/set_user_data` — graph configuration is now tied to the HA user account and synchronized across all devices
- Automatic migration from browser local storage on first load
- Local storage kept as fallback if HA storage is unavailable

## [v1.1.11] - 2026-04-22
### Added
- Drag and drop entities between graphs of the same type (timeline→timeline, arrowline→arrowline)
- Reorder entities within the same timeline or arrowline graph by dragging their label
- Drag and drop graph reordering (⠿ symbol) extended to timeline and arrowline graphs
- Long entity labels in timeline/arrowline graphs truncated with click-to-reveal tooltip
- Hover cursor changes to `move` over draggable legend labels and timeline/arrowline entity labels
### Changed
- Incompatible drag & drop (wrong type or incompatible units) now shows an explanatory tooltip instead of failing silently

## [v1.1.10] - 2026-04-20
### Added
- Automatic grouping of entities with compatible SI units (W/kW, m/km, etc.) onto the same graph with transparent unit conversion — applies to both dynamic and YAML-defined graphs
- Double-click a curve label to ungroup it into its own graph
- Drag curve labels between graphs (compatible units only) to move curves
- Drag curve labels left or right to reorder curves within the same graph
- Drag the ⠿ symbol at the top left of any graph to reorder graphs
- Auto-scroll when dragging near the top or bottom of the screen
- All grouping, ordering and color choices persist across page refreshes

## [v1.1.9] - 2026-04-21
### Changed
- Mobile detection switched from `navigator.appVersion`/`userAgent` string matching to `navigator.maxTouchPoints > 0` — more reliable across browsers and devices
- Y axis touch handling on mobile unified with desktop pointer events on the `#ya-N` overlay — dedicated `yAxisTouchStart/Move/End` handlers removed
### Fixed
- Two-finger pinch zoom and Y axis reset on pointer up now correctly excluded for timeline and arrowline graphs
- Mouse wheel zoom debounced (150ms) to prevent excessively fast zoom steps

## [v1.1.8] - 2026-04-08
### Fixed
- Y axis pan (Shift+drag and `#ya-N` overlay) now correctly excluded for timeline and arrowline graphs, which have no numerical Y axis — previously caused a crash when attempting to read `y-axis-0` min/max on these graph types

## [v1.1.7] - 2026-04-08
### Fixed
- Y axis drag overlay (`#ya-N`) repositioned: now starts at `top:28px` instead of `top:0` — the overlay was covering the Y axis lock button (padlock), making it unreachable
### Changed
- Card header now displays the version number: `History explorer vX.X.X`

## [v1.1.6] - 2026-03-30
### Fixed
- Mobile entity selector: suggestion list (`datalist`) now only attached after the first character is typed — prevents the list from appearing before the virtual keyboard, which would push the keyboard below the list and make it unusable
### Changed
- Code cleanup: trailing whitespace removed throughout

## [v1.1.5] - 2026-03-25
### Fixed
- `entityOptions` list form: glob matching only (device class and domain matching removed from list form, handled by dict form). Dict form and list form results are now correctly merged (list form wins per property, dict form fills remaining unset properties)
- `history-info-panel.js`: `__entityId` → `entityId` and `__hass` → `hass` throughout — compatibility fix with recent HA versions that removed double-underscore prefixed properties

## [v1.1.4] - 2026-03-25
### Changed
- `entityOptions` list form and dict form unified in a single `getEntityOptions` lookup — list form now also matches by device class and domain (not just glob patterns). `entityPatterns` config key removed, superseded by `entityOptions` list form.

## [v1.1.3] - 2026-03-25
### Added
- Y axis pan by dragging on the label area now also works on mobile (touch events with `preventDefault` to avoid page scroll interference)

## [v1.1.2] - 2026-03-25
### Added
- Y axis pan by dragging directly on the label area (desktop) — `#ya-N` overlay with pointer events, cursor changes to `ns-resize`

## [v1.1.1] - 2026-03-20
### Added
- `axisAddMarginMin` / `axisAddMarginMax` config options to control Y axis top/bottom margin
- Two-finger vertical pinch zoom on the Y axis (mobile)
### Fixed
- Line interpolation: `lines` and `stepped` now use zero-tension monotone interpolation (no overshoots), `curves` uses tension 0.1
- Line rendering: `borderJoinStyle` and `borderCapStyle` set to `round` — constant stroke width at corners, rounded ends
- Mobile entity selector: autocomplete suggestion list no longer appears before the virtual keyboard

## [v1.1.0] - 2026-03-18
### Added
- `showMinMax` option: shaded min/max statistical band per entity (`statistics` or `history` mode)
- `showPoints` option: permanent dots at measurement points, per entity or via `entityOptions`
- `dashMode` now accepts a custom Canvas `setLineDash` array in addition to named modes
- `entityOptions` list form with glob pattern matching (`match:` key), supporting wildcards, entity ids, device classes and domains
- `lineMode` accepts singular aliases: `line`, `curve`, `step`
- `decimation` and `showPoints` correctly wired through `entityOptions`
### Changed
- First release from Cook23 fork, based on SpangleLabs v1.0.54

## [v1.0.54] - 2024-05-10
### Changed
- Switch from concatenating files, to using normal JS imports and exports

## [v1.0.53] - 2024-05-07
### Added
- Adding full reference config at full-reference-config.yaml

## [v1.0.52] - 2024-05-02
### Changed
- First release from SpangleLabs fork
- Re-implement build system, switching to using yarn and webpack

## [v1.0.51] - 2023-11-24
Final release from original alexarch21 repository
