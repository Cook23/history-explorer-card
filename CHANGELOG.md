# Changelog

Changelog for the HA History Explorer Card.
(Using format and definitions from https://keepachangelog.com/en/1.0.0/)

## [v1.1.23] - 2026-05-19
### Added
- Entity selector dropdown unified across desktop and mobile — desktop now uses the same custom dropdown as mobile, eliminating the native `<datalist>` with its display limitations
- Friendly name displayed in dropdown and input field instead of entity ID; entity ID shown in a tooltip on selection
- Dropdown filters on friendly name OR entity ID simultaneously
- Keyboard navigation: ArrowUp/ArrowDown to navigate, Enter to select, Escape to close; second Enter triggers entity add
- Wildcard matching in dropdown: entries matching the wildcard pattern are shown in bold; first Enter selects all matching entities, second Enter adds them all
- Duplicate detection extended to wildcard multi-add: tooltip lists duplicate friendly names, all affected graphs highlighted with red dashed outline
- `_highlightMultipleTargets()` — new helper to highlight multiple graphs simultaneously; `_clearDropHighlight()` updated to handle both single and multiple highlights
- Duplicate highlight and type-mismatch tooltip now fade out via `outline-color` CSS transition (1.5s visible + 1.5s fade); timeout extended to 1.5s visible / 15s if off-screen
- Tooltip default display duration extended from 500ms to 1500ms
- Visual feedback on entity add: added entity names displayed in bold in the input field for 500ms
- Dropdown reopens on focus, click, or any keypress when closed; `focusout` replaces the previous `window click` defocus mechanism for reliable cross-platform behavior (desktop, mobile, tablet)

### Fixed
- Entity selector dropdown did not close reliably on focus loss (tab, touch outside, HA navigation) — replaced `window click` listener with `focusout` + 150ms delay
- Wheel scroll listener was guarded by `!isMobile` — removed since mobile devices have no mouse wheel
- Sort order in entity dropdown now uses domain / friendly name / entity ID (three levels) instead of entity ID only
- Wildcard add (`*`) now works correctly through the dropdown instead of bypassing it

## [v1.1.22] - 2026-05-16
### Fixed
- Time range was not persisted when changed by the user via the range selector, zoom buttons, or pinch-to-zoom — `writeLocalState` was not called after these interactions, causing the default or YAML value to be reapplied on every reload

## [v1.1.21] - 2026-05-16
### Fixed
- Time range restore now goes through `setTimeRange`/`setTimeRangeMinutes` in all cases — direct assignment to `activeRange.timeRangeHours/Minutes` was bypassing `dataClusterSize` and `stepSize` recalculation, causing Chart.js to render hundreds of overlapping axis ticks when restoring a persisted or HA user-synced time range

## [v1.1.20] - 2026-05-15
### Changed
- Version bump only — identical to v1.1.19; re-released to work around a HACS issue with versions that are withdrawn immediately and re-published lately

## [v1.1.19] - 2026-05-15
### Added
- `defaultInfoPanel` YAML option (replaces `infoPanelActive`, never published) — "last one to speak wins" logic: YAML change is detected at next load by comparing to its persisted mirror; takes precedence over HA user sync if both change simultaneously
- `defaultTimeRange` YAML option — same "last one to speak wins" logic: YAML change overrides user-adjusted time range only when the YAML value actually changes; user-adjusted time range is otherwise preserved across reloads and devices
- `applyInfoPanelState()` — unified anti-loop handler for info panel activation: compares `infoPanelEnabled` to persisted state, writes config synchronously, then reloads; used by menu toggle, YAML change detection, and HA user sync
- State persistence overhauled: `writeLocalState` now persists 2 YAML mirrors (`yaml_defaultInfoPanel`, `yaml_defaultTimeRange`), 2 HA user mirrors (`ha_infoPanelEnabled`, `ha_timeRangeHours/Minutes`), and active time range (`timeRangeHours/Minutes`); active `infoPanelEnabled` is stored implicitly via the existence/absence of the `history-explorer-info-panel` key — localStorage is the sole source of truth for all change detection
- `readLocalState` now reads localStorage and HA user storage separately; front detection runs independently for each source before any value is applied or persisted; `writeLocalState` is called before any reload to guarantee all mirrors are up to date
- Legacy v1/v2/format branching in `readLocalState` removed — unified single restore path

### Fixed
- `toggleInfoPanel`: `writeInfoPanelConfig` was called without `await`, causing `location.reload()` to fire before localStorage was written; info panel state was therefore not persisted across the reload
- `defaultInfoPanel` change was never detected because `infoPanelActive` was not persisted in `writeLocalState`; the mirror value read at next load was always `undefined`, making every load look like a first run
- Unconditional `setTimeRangeFromString(defaultTimeRange)` call after `readLocalState` was overwriting the user-adjusted time range on every reload; now only applied when `defaultTimeRange` actually changed
- HA user restore could overwrite a YAML-driven `infoPanelEnabled` change because the HA user block ran after the YAML block without checking for priority

### Known limitations
- Info panel hook (`ha-more-info-history` patch) is only active in browser tabs that have loaded a History Explorer card; opening a new tab or refreshing a tab without the card requires navigating back to a page containing the card — to be addressed in a future release via a standalone Lovelace resource script

## [v1.1.18] - 2026-05-12
### Added
- Inter-graph drag & drop on legend label zone (line/bar) now shows vertical insertion marker and inserts at exact position — same UX as intra-graph reorder
- Inter-graph drag & drop on label zone (timeline/arrowline) now shows horizontal insertion marker and inserts at exact position — same UX as intra-graph reorder
- Double-click on timeline/arrowline label now uncombines the entity into its own graph — same behavior as line/bar legend double-click
- Duplicate entity detection now shows a tooltip and a red dashed highlight on the containing graph; highlight persists 10s if the graph is off-screen, fades after 1s once it enters the viewport
- `history-default-colors.js`: comprehensive state color palette — cover, climate, alarm_control_panel, lock, media_player, vacuum, lawn_mower, water_heater, sun, fan, light, switch, device_tracker domains; consistent semantic logic (green = good/active, red = stopped/armed/locked, amber = transition, grey = unknown/unavailable only)
- New YAML option `infoPanelActive` — sets the default enabled state of the info panel; admin change is detected at next load and overrides user preference; user preference is otherwise preserved across devices via HA user storage via a dedicated global key `history-explorer-infopanel-enabled`
- Conflict detection for `infoPanelActive`: if the parameter is set with different values across multiple card instances, an alert lists the conflicting cards; the oldest conflicting entry is automatically removed from the registry on dismissal to manage removed instances and will reappear later if still conflicting
- State persistence extended: time range and per-graph bar interval now persisted in HA user storage alongside entities; `infoPanelEnabled` stored in a dedicated global HA user key shared across all instances
- `ui.label.already_exists` and `ui.label.infopanel_conflict` added to `languages.js` in all 10 supported languages
### Fixed
- Toolbar (date selector, duration selector) moved inside `card-content` — eliminates misalignment with graph area and close buttons, improves mobile layout
- Timeline/arrowline label tooltip (truncated labels) restored for YAML graphs — was incorrectly blocked by the `firstDynamicId` guard introduced in v1.1.17
- `datalist` `list=` attribute restored as static on desktop input — Firefox now shows the entity suggestion dropdown; dynamic `list=` management removed (no longer needed since `isMobile` now correctly identifies tablets)
- Ghost activation threshold (5px) applied to timeline/arrowline entity drag — was triggering immediately on pointerdown, inconsistent with legend label and graph drag behavior
- Pending graph move (`pendingMoveGraph`) now correctly forwarded as padlock click when movement is under 5px
- Close button (`#bc-N`) right margin aligned with graph right edge
- Info panel menu label (`#ei_N`) now correctly reflects `infoPanelEnabled` state after async restore from HA user storage

## [v1.1.17] - 2026-05-07
### Fixed
- `timeline.js`: memory leak — `_tl_momentCache` grew without bound; `tl_momentCachePurge()` now caps it at 500 entries
- `Chart.js`: legend labels no longer overlap padlock (`#ca-N`) and close (`#bc-N`) buttons — `me.leftMargin` / `me.rightMargin` constrain the available legend width
- `Chart.js`: legend line count no longer jumps when entity values change label width slightly — ratchet prevents reducing line count unless dataset list changes
### Performance
- `timeline.js`: timestamp parsing results cached in `_tl_datasetsCache` — `parse()` skipped entirely when dataset data reference and length are unchanged, eliminating redundant moment object allocations on every `chart.update()`
- `timeline.js`: bar color computation cached in `_tl_colorCache` — `colorFunction` not called on every redraw, cache invalidated on `colorFunction` change
- `timeline.js`: `determineDataLimits` short-circuits min/max scan when explicit time range is set (`hasExplicitRange`)
- `Chart.js`: `_dataLimitsCached` now only invalidated on canvas resize for `timeline`/`arrowline` scales — eliminates redundant `determineDataLimits` calls on every `chart.update()`
### YAML graph fixes (from v1.1.16 known issues)
- YAML graphs: `move` cursor still appears on legend labels (drag not available for YAML graphs)
- YAML timeline/arrowline graphs: same cursor issue on label area

## [v1.1.16] - 2026-05-06
### Fixed
- `InitWithConfig`: `ReferenceError: type is not defined` on load when graphs are defined in YAML — caused no graphs to be displayed at all
- `InitWithConfig`: removed `#mo-N` and `#lg-N` overlays from YAML graph HTML — these dynamic-only elements were incorrectly generated for YAML graphs, blocking the padlock button
### Known issues
- YAML graphs: `move` cursor still appears on legend labels (drag not available for YAML graphs)
- YAML timeline/arrowline graphs: same cursor issue on label area

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
