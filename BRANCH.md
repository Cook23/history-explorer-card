# Branch: v1.2-dev

This branch contains version 1.2 — the repository's default branch, the line released now.

DO NOT assume that code or architecture from v1.1-legacy (the 1.1 line) still applies.
This branch is allowed to contain breaking architectural changes.
How the code is organized, and the rules that keep its parts apart: see
[ARCHITECTURE.md](ARCHITECTURE.md).

## The constraint of 1.2: clean code

1.2 is a complete rewrite whose whole purpose is a clean program. Every change, features
and fixes alike, must keep it so:
- each piece of code in its own layer and module, as ARCHITECTURE.md sets them — gestures
  and what Chart.js can decide alone in `deps/chart-hec.js` / `deps/Chart.js`, what they
  mean for the card in the card's modules, rules on entities in the entity store;
- one implementation per behavior, shared by every caller (card, info panel, mouse, touch,
  pen): no copy, no parallel path for one device or one place;
- a generic Chart.js option rather than a card-specific case inside Chart.js; the contract
  (`deps/Chart Custom.js.md`) updated with it;
- dead code removed, comments saying why rather than history, tests for every behavior.
A change that would break this is redesigned, not merged.

## Loading the window — set by the user

What the window shown needs is asked to Home Assistant in phases (`card-history.js`), through
the page's regulator (`ha-requests.js`). Each answer is drawn as soon as it comes — only the
graphs of the entities it brought something to; answers coming close together (within twice
what a drawing takes, 100 ms at least) drawn once. What the cache already has is used, unless
phase 0 makes it invalid. The history is never asked before where Home Assistant was seen to
keep none for an entity (an answer empty, or beginning well after its start: the recorder's
retention, the entity created later).

- **Phase 0 — probes,** once a session per entity with statistics, all of them in one request,
  nothing else asked meanwhile:
  - their history's last hour asked (short: a sensor flooding its history — 1000 values an
    hour — costs little): the 5-minute statistics valid — the hourly ones too — once 5
    intervals there are each under 4 min (counting stops there: no sort, no list); the
    hourly ones valid when the mean gap (1 h divided by the count; no value: infinite) is
    under 15 min;
  - otherwise (a sparse sensor, never one flooding) its last 24 h asked, in one request for
    them all: the hourly ones valid once 5 intervals there are each under 50 min — how often
    the sensor speaks when it speaks, whatever its silences;
  - only the intervals between two numbers count (an unavailable state and the value after
    it, a restart, tell nothing of the sensor);
  - the daily, weekly and monthly ones always valid;
  - the verdict holds for the session (a day on this device, a new version of the card
    purging it); 5-minute statistics it makes invalid are never asked, drawn or exported;
    hourly ones it makes invalid are drawn only where the history isn't kept (past the
    recorder's retention), the history first wherever it is — always exported.
- **Phase 1 — the coarse source,** one request per entity — the heavy ones (Home Assistant reads
  every hourly row, whatever the period): each drawn as it comes, Home Assistant's workers all
  busy (may not exist); a short part (200 periods at most: a day, a side, the hours not
  compiled yet) the same for several entities, one request for them all; a larger one once
  the window has moved (the entity has some of it already), in 4 groups of entities (Home
  Assistant's workers), a request each — a first load, a request per entity:
  - the most precise valid statistics of the hourly family (hour, day, week, month) giving at
    least 100 points over the width shown — never finer than a column of pixels shows;
  - over min(3 widths, width + 2 months): a width (a month at most) on each free side — in
    real time, the left side only (nothing carried over to the right);
  - the automatic Y axis is worked out from it.
- **Phase 2 — the fine source,** only when a column of pixels lasts less than an hour (may be
  the only phase):
  - the history or the 5-minute statistics, by the column's width; the history when the
    5-minute ones are invalid;
  - without phase 1, where it comes back empty or starting late (past the recorder's
    retention): the hourly statistics there; where they're empty too after the 5-minute ones,
    the history;
  - the Y axis worked out here when there was no phase 1;
  - in blocks from the right, all the same size for a width: up to a day, one block of the
    width (whole hours, an hour at least); 1 to 10 days, blocks of a day; beyond, a tenth of
    the width in whole days, a calendar month at most (10 years: 120 blocks, plus the probes);
  - block by block, the entities of a source in 4 groups (Home Assistant's workers), in the
    graphs' order: a request per group — few requests (each costs Home Assistant a fixed time),
    every worker busy, still drawn as they come.
- **Without phase 2,** where phase 1's statistics begin after the window's start (a state
  class given later, a change of unit): the history before them, in one request.
- **The history after the statistics** (what Home Assistant hasn't compiled yet): the entities
  from the same time together, in one request.
- **Sending:**
  - one queue: by phase, then phase 2's block, then the graphs' order — phase 2 queued right
    behind phase 1, without waiting for its answers; phase 1's parts wholly outside the window
    shown (its sides, the window moved) after phase 2; a request bringing nothing to the window
    shown now after — one asked for a window before, bringing some of this one, keeps its
    place (the window moved: arrows, a drag, a zoom);
  - the window shown loading as long as a request bringing some of it is under way;
  - no delay between requests, never a request sent again (no time-out, no retry);
  - 4 in flight at most (Home Assistant's workers): a fixed count, nothing measured — requests
    of sizes that different tell nothing of its load by their time.
- **Background,** once phase 2 is over, with the anti-flood pacing (one request at a time, only
  when nothing else is under way, 1 s after the last change, then a pause of twice what the
  last one took, 1 s to 30 s):
  - first, the history of the circular axes over the window shown, where they're drawn from
    statistics (Home Assistant averages angles as plain numbers);
  - then each side widened: phase 1's source in blocks 10 × phase 2's, phase 2's source in its
    own blocks — every entity alike, the entities of a source in one request;
  - the memory bounds kept (AHEAD_MAX_ROWS 300 000, purge past 500 000).
- **Drawing** what the cache holds:
  - the coarsest valid source whose period a column of pixels holds — no min, mean and max
    worked out from many values for nothing —, a finer one only where it lacks (the last
    minutes, not compiled yet), a coarser one where nothing finer is kept; an angle from its
    history first (the statistics' mean is wrong for it);
  - statistics Home Assistant made up (a sensor silent: its last value carried, min = mean
    = max): a run of 5-minute or hourly ones at the same value, one value held to the run's
    end — a silence of smart mode;
  - the min/max band of a point over the time its values cover only — from a point to the next
    where their times meet, a point alone a bar —; a plateau of smart mode without one.

## Planned

1.2-only features, to do when the time comes (each one a reason for a 1.2 release).

None at the moment.

## Planned, once the 1.1 line is dropped

Not before 1.2 is the only line maintained: these changes are too large to port to 1.1.

None at the moment.

## Ideas for a far future, once every browser supports what they need

Not planned: kept here so they aren't lost.

- **Menus following the scroll natively.** Today `followAnchor` (`card-menus.js`) watches each
  frame while a menu is open: it moves the menus with what opened them, masks what goes past
  their zone (`clip-path`) and closes them once their first line is wholly out (the rule in
  `CLAUDE.md`). A native version:
  - each menu placed in the flow of what opened it (the graph, the field), not in the toolbar:
    it scrolls with it with no code, and goes under a sticky toolbar or Home Assistant's header
    by its z-index (to check first: the graphs must not each create a stacking context);
  - each menu and its submenus in a container larger than the menu, from the menu's top to the
    bottom of the display zone, in `overflow: clip`: a submenu can show below its menu (needed
    for one opened from a bottom line), yet nothing ever goes past the container — the mask is
    native;
  - closed by an `IntersectionObserver` on its first line (a submenu: the container as root; a
    menu: the screen, `rootMargin` taking off the sticky toolbar and the header, which an
    observer doesn't see), on events instead of each frame;
  - a submenu following its line as its menu's list scrolls: a `scroll` listener, or natively
    scroll-driven animations (`scroll-timeline`, `timeline-scope`) once Firefox has them;
  - CSS Anchor Positioning (`anchor-name`, `position-visibility`) as another way: in every
    browser only since January 2026 (Firefox 147, Safari 26), anchoring across shadow trees
    still uneven, Home Assistant's app often in an older WebView, the curve labels and the ⠿
    zone drawn in the canvas (an invisible element would have to stand there), and
    `position-visibility` hides a whole menu where the rule masks only what goes past.
