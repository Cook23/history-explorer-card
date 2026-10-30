# history-explorer-card — notes for Claude sessions

Two lines are maintained: `main` (stable 1.1.x) and `v1.2-dev` (1.2 beta, split into several
`src/card-*.js` files). Read `BRANCH.md` on the branch you work on first. Tests: `yarn test`.

## How to work — set by the user, not negotiable

- **Code what is asked, exactly.** A problem detected, something to correct, a case the
  instruction doesn't cover (a device, a pointer, a condition, an exception): say it and ask
  before coding it — never decide it alone, even when it looks obvious.
- **An instruction unclear:** reformulate it and wait for the answer — don't interpret.
- **An instruction too summarized** to be coded as is: say so and ask the user to detail it, before
  coding.
- **The full suite:** only when the user says the modifications are finished, or asks for it —
  never during modifications, never on your own initiative. Meanwhile, targeted tests only.
- **Never without being asked:** a version bump, a commit, a push, a PR, a merge.
- **A question or a doubt about what is being done** ("why", "who asked for that"), or an
  interruption: answering it comes first, before continuing anything. Answer it and stop —
  no code, no test, no commit until the user gives the next instruction.
- **What the user observes is a fact, not a hypothesis.** The user sees the card, the device,
  the browser; Claude doesn't. What the user says they saw weighs as much as a screenshot.
  Past sessions kept their own idea against the user's repeated observations, until a
  screenshot stopped them — a tunnel effect (fixation on one explanation, the facts that
  don't fit it set aside). So:
  - an observation of the user's that contradicts Claude's idea: the idea is wrong until
    proven otherwise — drop it, or ask a question that names the contradiction; never go on
    as if it hadn't been said;
  - "it has nothing to do with it", said once: stop that track — don't bring it back in
    another form;
  - the user can be wrong too, or caught in a tunnel of their own: then say so plainly,
    with the fact that contradicts them (a test, a measure, a line of code), and let them
    decide — never bend what they said to make it fit.
- **A text written in the user's name** (a bug report, an answer to a user, release notes,
  a comment): built from the user's own words. Before showing it, check every statement
  against what the user said or a result both have seen; what can't be traced to them is
  removed, or shown as Claude's own. Never make a case look like another one (a known bug,
  a reproduction) to make it more convincing.

## Versions — set by the user, not negotiable

- **The version is in the source and shown on the card.** Its number is written in the source
  (and so in the built file) and shown in the card's title (`History explorer v1.2.53`), so as
  to be sure which version is running despite the browser's cache. A wrong number there is a
  wrong version for the user.
- **A release publishes the merged files as they are.** The user releases the line's branch,
  under the version it carries; the release changes nothing in the files. So every merge must
  be publishable as is: its version number, CHANGELOG and docs final — no build number, no
  `[Unreleased]`, nothing left to fix at the release.
- **The version number is the last release's + 1.** Before each merge, check on GitHub which
  version was released last (its releases) and which versions are dead (its tags: a tag
  without a release); the version merged — everywhere it's written: `package.json`, the source `src/version.js`, the built `history-explorer-card.js` and
  the CHANGELOG — must be the last release + 1, past any dead version (`1.2.52` released → `1.2.53`). Several merges can carry
  it, until the user releases it. A released number is never carried again.
- **A dead version.** The user says when a version is dead (GitHub sometimes fails a release):
  the version goes to the next number — everywhere it's written (`package.json`, the source `src/version.js`, the built `history-explorer-card.js`), the CHANGELOG (its section takes
  the new number), the docs if they name it — and a new merge is made; the dead one is meant
  never to have existed. On GitHub it shows as a discrepancy: the last tag exists, its release
  doesn't. Seeing that discrepancy without the user having said so: ask them whether that
  version is dead, before merging.
- **The CHANGELOG's section is the version's number** (`## [v1.2.53] - 2026-10-30`), released or not — never
  `[Unreleased]`. Whether a version is released is on GitHub (its releases), not in the files.
- **Build numbers** (`1.2.53b1`, `b2`…) only in Claude's working copy and in discussions with
  the user — never merged: not in `package.json`, `src/version.js`, the built `history-explorer-card.js`, the CHANGELOG, the docs, a code comment, or a commit
  or PR title.

## Architecture (1.2) — set by the user, not negotiable

Read `ARCHITECTURE.md` before changing any code, and keep to it: the card gives data and
decisions, Chart.js draws and detects gestures; the inputs (gestures, menus, selector,
toolbar) ask `card-operations.js`, never change what's shown themselves; each part talks to
another only through its public methods; each field of the state has one owner. Past
sessions broke these rules again and again by taking the shortest path — the user caught
it each time. So:

- before writing code, say which part it belongs to and why; never put a behavior where it
  is quickest to write;
- run `node tests/run.cjs lint architecture` after every change, before anything else;
- never add an exception to `tests/architecture.cjs`, nor loosen a rule, without the
  user's explicit approval — ask, giving the reason;
- a deviation the test can't see, found by reading: fix it, and add a rule that catches
  its kind;
- split code only when it reads better split — never for its size.

## mini-graph-card — the product's direction, set by the user, not negotiable

history-explorer-card is one versatile product: its YAML is read in its own syntax or in
[mini-graph-card](https://github.com/kalkih/mini-graph-card)'s, indifferently, so that a
mini-graph-card is replaced in place: `type: custom:history-explorer-card` and `look: mini`.

- **The main goal:** a mini-graph-card's YAML works, with a similar look, and every
  capability of this card in addition. Small differences after the migration don't
  matter much; details of the look are dealt with later.
- **Not a clone (said twice by the user).** Compatible with mini-graph-card — its YAML
  works — and a similar look: similar, not identical. A logical improvement over what
  mini-graph-card does is welcome and needs no special care (its `avg` taken as the
  time-weighted mean rather than the plain mean of the values recorded; its groups on a
  fixed grid of time rather than one sliding with the present). Never copy one of its
  behaviours only to be identical to it.
- **No separate mode, no translation layer.** Every mini-graph-card option is an option of
  this card, valid with or without `look: mini`: a name meaning the same as one of ours is
  an alias of it, in the card's existing synonym mechanism (`history-options.js`), at the
  same levels; its structured forms (`show:`, root `entities`, `color_thresholds`…) are read
  by the card natively, as its own options.
- **Aliases, never conversions.** A mini-graph-card name is an alias of one of our names; a
  mini-graph-card value is an alias of one of our values (`y_axis: secondary` is
  `yAxis: right`), or a value our option accepts in addition, with the same meaning. Never
  convert a value, never rescale, never change what a parameter means. An option with no
  exact equivalent (`value_factor`…) is a function to add under its own name.
- **A conversion that would remain** is described in the migration doc, never done in the
  code. The aim is none.
- An aspect that is unclear: ask the user.
- **`look: mini` only switches defaults** — mini-graph-card's look instead of ours. It
  never changes what an option means: an option means one thing, whatever the look (an
  option whose meaning would depend on the look is an ergonomic nightmare). A name that
  means something else on each side is a conflict to settle once for all, not by the look.
  If it has to change an aspect no parameter sets, a parameter is missing: add it to the
  card (usable without `look`), and `look: mini` only gives its default.
- **`look: mini` is never necessary (set by the user).** It switches every default at once,
  nothing more: the same card is obtained without it by setting each YAML option concerned,
  one by one. That is the logic of this compatibility: history-explorer-card is enriched
  with what it lacks (a parameter of its own), and `look: mini` is only a shortcut to
  mini-graph-card's defaults. No code reads `look` but `withLook` (history-options.js), which
  only merges `LOOKS.mini` under the card's own options; every key of `LOOKS.mini` is an
  option of the card, documented.
- **A mini-graph-card function this card lacks is added to it**, mini-graph-card's code
  (MIT) taken as the example, and becomes a function of this card like any other: in its
  part, through its contracts, documented, tested, usable in this card's own syntax too.
- For the UI, this card's gestures and actions stay.

## A README is not a changelog — set by the user, not negotiable (said more than ten times)

Three documents, three roles — never mixed. The README answers the user's needs: "how do I use
the product" (the README itself) and "oh, that's new, I must try it" (its version highlights);
the CHANGELOG is the traceability:

| Document | What it says |
|---|---|
| README.md, README_Full.md | How to use the card **as it is now**. Never what changed, when, or what it was before: no version number, no "(1.2.25)", "since 1.2.23", "now", "no longer", "was", "is ignored since". An option kept only for compatibility is described as it is today ("accepted, no effect"), without its history. |
| "📋 Version highlights" (README.md, before the table of contents, formatted as lowpass_dt's — the only place in a README naming versions; README_Full links to it, it is never deleted) | **When each important feature appeared, usable.** One line per important feature, at the one version where it first worked and could be used — never a range of versions. Not the versions before it (not usable yet), not the ones after it (refinements, more options, bug fixes, polish: the feature didn't really change). A version of bug fixes and refinements only has no line at all. Only the versions of its own branch (1.1 on `main`, 1.2 on `v1.2-dev`, never mixed). |
| CHANGELOG.md (and the release notes) | **Everything, version by version**: every change, fix, refinement — the full traceability. |

Before adding a version to the highlights, ask: does it bring an important feature that
wasn't usable before? If it only improves, extends or fixes one already there — no line.
Before any README edit, check the whole file against this rule.

## Every option may be at every level — set by the user, not negotiable

Any option may be extended to every level — the card, `entityOptions`, a graph, an entity —
even where its use is doubtful or none: the most precise one always wins (entity, then
graph, then `entityOptions`, then the card). It's allowed, not a task: an option gets its
full scope when it's touched or needed, never in a rework of all options. Never restrict an
option's scope because it "seems logical".

## Words have a meaning — set by the user, not negotiable

Read the user's words as they are, with their nuance: a possibility is not an obligation
("may" is not "must"), an example is not a rule, a guideline is not a mandate to push to
the extreme. Past sessions turned "can" into "must" and a guideline into a rework of
everything — the user had to correct it each time. Do what is asked, at the scale asked;
when the scale is unclear, ask.

An imperative and a goal are told apart by their words. An imperative ("don't reserve room")
is an obligation: kept always; a problem that seems to have no solution within it is
discussed with the user before any code. A goal ("use the room as well as possible") is a
guideline to tend to: never turn it into an absolute rule. A display especially is a
compromise, made as well as the room allows: what renders best at every size without
complicating the code too much — not a rule applied whatever the cost. In that compromise the functional goal
comes before the accessory functions: the card is there to show curves; the controls,
their boxes and everything around them take only the room the curves can spare.

## No patch for a special case — set by the user, not negotiable

A special case that looks like a problem (an old saved state, compatibility with a former
version…) is reported to the user, and decided together — never handled on one's own by a
patch. A compatibility problem at a version change happens once; ugly code stays forever.
Keep the code clean.

A clean code and a clean architecture are priority goals, above every other goal (a
rendering, the best use of the room…): never hundreds of particular cases. An improvement
is taken only when it comes from a general rule that doesn't complicate the code beyond
reason; otherwise the particular case stays as it is.

## An example is a symptom — set by the user, not negotiable

An example the user gives (a screenshot, a width, an entity, a case) is a symptom, never
the thing to fix. Never patch for it: no value tuned to it, no special case, no test built
around it. Search globally for the general cause it shows — which rule, in which part,
produces it for every case — explain that cause to the user, and propose the general rule
that fixes it. The example then only checks that the rule holds.

## Floating icons — set by the user

The floating icons (the handle, the padlock, the chain, the close button) never reserve room
(an obligation).
Normally they need none: they sit in the left and right margins kept for the Y axes' labels,
above the labels, with no conflict. Otherwise — whatever the reason, notably the
ultra-compact layouts (the axes pushed to the edges, their labels inside, over the curves),
but also a layout without a legend — they go where they can, over something else, and take
the clicks up to ½ × max(mouse precision, finger precision) around their boxes
(`deps/chart-hec.js` `_hecIconMargin`, `_hecTopTargetAt`). Free room, where there is some,
is better used ("normally") than the fallback ("otherwise"): using the free room as well as
possible is a goal, not an obligation — a particular case where it isn't optimal may exist,
and clean code comes first (see "No patch for a special case"). Their boxes sit that
picking margin from the card's left and right edges, their targets whole on the card — a
compromise: ¼ × max(…) would do if ½ took too much room.
Never propose to reserve room for them: on a small screen room is short, and the card is
there to show curves, not boxes of buttons.

## Curve or point, nearest-smart or nearest, X and Y or X only — set by the user, not negotiable

Three pairs of notions, never mixed. Mixing them caused regressions (see below).

**What concerns a curve picks the curve; what concerns a point picks a point.**
- The curve (`deps/chart-hec.js` `_hecCurveAt`: the picking rule on the drawn line) is picked by:
  - the hover dot (and the hovered value shown over the graph);
  - the click that puts the curve in the "show tooltips" mode (`_hecTap`, `_hecTooltipCurves`);
  - the long-press that shows or hides its points.
- A point is picked by the tooltip. A tooltip shows points — the real value of a real
  measure, never an interpolation, never a place on the line between two values: between
  the points there is nothing to show. "A curve's tooltip" doesn't exist.

**Nearest-smart ("le plus proche intelligent") or nearest.**
- Nearest-smart is the picking rule, `_hecPickNearest`, the same everywhere: labels, Y labels,
  bars and timeline segments, floating icons, curves, points.
  1. Each candidate gives its place nearest the pointer and its distance to the pointer: to a
     box (a label, a bar), the pointer clamped on it; to a line, its centre line; to a point,
     its centre. That distance serves everywhere, the tie-break of step 3 included — never
     changed by the object's size.
  2. The nearest is kept only within the picking margin: the pointer's slop (mouse, finger,
     pen; a setting) plus the object's size — a line's half width, a point's radius (the
     size only widens the margin; taking it off the distance instead, in 1.2.44, broke the
     tie-break between two thick lines close together). The floating icons use
     `_hecIconMargin`, see "Floating icons".
  3. Against the second nearest:
     - on the same pixel (under 1 px apart), the first one wins (the curve drawn over);
     - else the nearest must win clearly: the gap between their distances must be at least
       ⅓ of the distance between their places;
     - else the pointer is about halfway, and nothing is kept (`PICK_BETWEEN`).
- Nearest on the curve ("le plus proche sur la courbe", no limit) is used only for the hover
  dot's point. Its curve is picked nearest-smart; then, from the place of that curve's line
  nearest the pointer, following the line as drawn (straight, in steps, a B-spline's arcs),
  the dot goes on the value at the least length either way — the first one met on either side
  (`_hecNearestOnCurve`). It is not the nearest as the crow flies: on a stepped curve's
  plateau, the next value can be nearer in X and Y but further along the line.

**X and Y, or X only.**
- The tooltip's first point is the point pointed at, nearest-smart in X and Y
  (`_hecPointAt`), among the points of the candidate curves:
  - the curves in `nearest`, `mixed` and `all`;
  - the curves selected (`selected`, `mixed`).

  With no first point, the tooltip is neither opened nor moved; an open one stays, then
  fades out after its reading time.
- The following points are those of the other curves shown: the selected ones, or every one
  with `all`. Each is that curve's point nearest the first point's time, in X only — the
  same instant or the nearest one. It is kept only within the same picking margin, along X.

**The usage logic** (`_hecUpdateHoverDot`, `_hecHoverElements`):
1. The user doesn't know where the points are, and hovers a zone near the curve.
2. The small dot shows the real value nearest the pointer: a discreet guide.
3. The user puts the pointer on that point: it is drawn larger (`pointHoverRadius`) and its
   tooltip opens.

The small dot shows whenever the pointer is nearest-smart to a curve, in the tooltip mode
too — never on the tooltip's own point, which it must not hide.

A click always doubles a hover, for devices without hover. A click on a line far from every
point shows the dot, puts the curve in the "show tooltips" mode, and opens no tooltip; where
a hover exists it adds nothing visible. The modes (`largeScreenTooltip`,
`smallScreenTooltip`) only adapt this logic to the device (a hover or a click opens the
tooltip); they never change it.

**Regression to remember.** The dot and the tooltip once worked together. In 1.2.43 the
tooltip's first point was the curve's nearest point with no distance limit: the curve was
picked on its line, then its point taken however far. A tooltip then opened even hundreds
of pixels from any value. The dot and the tooltip had the same conditions to appear, and the
tooltip mode hid the dot, so the dot never showed. Fixed in 1.2.44. The tests guarding it
are in `tests/points.cjs`:
- a click or a hover on a line far from its values;
- a finger's tap there;
- a tooltip kept, then faded, with the dot elsewhere;
- `all` beyond the margin in X;
- the stepped plateau.

## Menus: a cascade, always visible — set by the user, not negotiable

How every menu is designed (the type menu, a graph's, the info panel's, the options menu,
and any one to come):
- A menu has sections (*Display*, *Appearance*…), each line ▸ opening its submenu, and a
  submenu's line ▸ its own, at any depth — the selector's sub-attributes too. A submenu never replaces the content of the menu
  it comes from: it opens **over** it, right-aligned on it, level with its line — there is
  no room beside it.
- The cascade of calling menus always shows: a submenu is narrower than its calling menu,
  leaving 2 or 3 characters of each line visible — with the room there is: the line was
  read just before, its start is enough to recognize it and click it to change submenu. A
  menu fully hidden by its submenu is a dead end. (A guideline on how much shows, not a
  minimum to push.)
- The only exception: a submenu opened from the **last** line of its menu may be as wide as
  that menu — unfolding from that last line, it hides no other line. That's why a section
  needing a wide submenu goes last: *Global* (the info panel's switch, the gesture
  thresholds) is the last section of the options menu (*Export*, *Card*, *Global*).
- A menu follows what opened it (its line for a submenu; a label, a ⠿ zone, a field, a
  button for a menu) — the page, a dialog or its parent menu scrolled. Its display zone: the
  screen less what covers it (a sticky toolbar, Home Assistant's header) for a menu; for a
  submenu, its parent menu's box above (it never goes above it), the page's display zone
  below (it may go below its parent, not past the page's bottom, a sticky bottom toolbar,
  Home Assistant's). What goes past it is masked — cut there, not closed. It closes once
  **its own first line** is wholly out of its zone (the page's for a menu, its parent's box
  for a submenu), by the top or the bottom: its first line is level with its opener,
  scrolls with it, always the same height — the condition depends on the menu alone, the
  same for every menu —, and the line of margin keeps a submenu opened from its parent's
  first or last line from closing at the least scroll.
- One model for every menu and submenu, one code path (filled from what is true now, opened,
  refreshed after a choice, keyboard, focus, the close delay): a menu never behaves
  differently from another. Standardize and homogenize — never code a menu "the simplest
  way" beside the common model.

## README structure — set by the user

- The header holds the title, the links (README_Full, FORK_DESCRIPTION) and the disclaimer,
  nothing else.
- The table of contents is the list of the headings, each under its parent, with their own
  titles — one entry per section, every section listed, no two entries to one place.
- Each paragraph goes in the section of its subject (a color in Colors, an axis in the Y
  axis section, a mini-graph-card option in mini-graph-card compatibility…), never where
  it was convenient to add it.
- After a README edit, check every link and every table-of-contents entry against the
  anchors of GitHub's rendering (`gh api repos/…/contents/README.md?ref=<branch>` with
  `Accept: application/vnd.github.html`).

## Shared logic with lowpass_dt

[Cook23/lowpass_dt](https://github.com/Cook23/lowpass_dt) (a Home Assistant integration,
Python) is a different project by the same author. The card applies three of its rules
(below), and the documentation of both projects says they are the same — the card's
README_Full gives the silences as "the rules of the lowpass_dt integration" and `circular`
as "the same values as the `circular` option of lowpass_dt". A rule changed on one side
must be changed on the other, or that documentation becomes wrong. lowpass_dt is worked on in its own Claude session and has a matching `CLAUDE.md`;
tell the user when a change here needs a matching change there.

Rule set by the user: each session manages its own repository's code. A session may write
`.md` files in the other repository only with the user's explicit approval, and never
modifies the other repository's code. A code change needed on the other side is passed to
that session (or to the user), not made from here.

### 1. `circular` option values — must stay identical

| card (1.1: `src/history-explorer-card.js`, 1.2: `src/card-datasets.js`) | lowpass_dt |
|---|---|
| `_circularPeriod` (1.2: parsing in `history-options.js` `OPTION_VALUES.circular`, auto-detection in `card-datasets.js` `circularPeriodOf`) | `config.py` (parsing), `sensor.py` `_resolve_auto_circular` (auto-detection) |

- absent / `null` / `none` (trimmed, any case): automatic — state class `measurement_angle`,
  or a unit of exactly `°` (not `°C`/`°F`), gives a period of 360;
- `false`: never circular;
- a number or numeric string: that period; `2pi` (any case, all spaces removed): 2π;
- anything else (including `true`), or a period ≤ 0 or non-finite: off, with a warning.

### 2. Silence detection (`lineMode: smart`) — same rule, with known, deliberate differences

| card (same files as above) | lowpass_dt |
|---|---|
| `_applySilencePlateaus` | `injector.py` `_update_dt_stats`, `_compute_limits`, `set_last_source_time` |

Common rule: the source's usual interval is an EMA (alpha 0.1) of the intervals between
values, with an EMA of their square for σ. An interval longer than `mean + 3σ + 0.1 s`
(never under 1 s) is a silence, and the first sample after a silence counts as that limit
in the EMA, not as its real length.

Differences (keep them in mind before calling the two "identical"):
- **Seed.** The card has the whole history, so it starts the EMA from the median of the
  intervals, with σ from their median absolute deviation × 1.4826. lowpass_dt runs online
  and starts from the first interval, with σ = 0. README_Full.md says so ("the rules of the
  lowpass_dt integration", the card starting from the median, lowpass_dt from the first
  interval).
- **Cap.** lowpass_dt also caps the limit at its `tau` (`max(min(raw, tau), 1)`), because it
  drives the injection of synthetic samples. The card has no `tau`.
- lowpass_dt's end-of-silence marker and `silence` option have no equivalent in the card.

Decided by the user about the silence detection:
- After a Home Assistant restart, lowpass_dt already keeps the downtime out of the EMA: on
  restore, `sensor.py` sets `source_just_resumed`, so the first sample counts as the limit
  (same as after a silence). Not an issue, nothing to do.
- The +0.1 s margin is absolute: a very regular source (σ close to 0) can get a false
  silence from a delay of a few tenths of a second. In lowpass_dt that only means an extra
  injected sample, maybe published; in the card, an invisible plateau. Left as is. A
  relative margin (e.g. `max(0.1 s, 5 % of the mean)`) would have to change on both sides.
- `state_reported` is not listened to: a sensor repeating the same value is most likely
  dead, and treating it as silent is right.

### 3. Attribute units and angles (1.2 only: `src/history-series.js`, `src/card-datasets.js`)

| card 1.2 | lowpass_dt |
|---|---|
| `history-series.js`: `attributeValue`, `_seriesValue`, `attributeUnitOf`, `WEATHER_UNITS`, `DOMAIN_UNITS`, `TEMPERATURE_ATTRIBUTES`, `isDirectionAttribute`, `attributeAt`, `_leafName`, `attributeLabel`; `card-datasets.js` `circularPeriodOf` | `attributes.py` |

- An attribute's unit: the one its value holds (`45 %`), else Home Assistant frontend's tables
  (weather units, units by domain, temperatures in the system unit; a light's `brightness`
  and a media player's `volume_level` converted into %), else an `X_unit` attribute for every
  attribute with `X` in its name; `X_unit` attributes are units, never series.
- A weather entity's `wind_bearing` is in `°` (Home Assistant gives no unit).
- Sub-attributes: the attribute is a path, read level by level — the key in a dictionary, the
  index in a list (`forecast.0.temperature`); an attribute whose own name holds a dot is taken
  as is. Its unit, classes and whether it is a direction come from its last name that is not
  an index (`temperature`); its label shows each level, joined by ` › `. (here
  `history-series.js` `attributeAt`, `_leafName`, `attributeLabel`; lowpass_dt `attributes.py`
  `attribute_at`, `_leaf_name`, `attribute_label`.)
- Automatic `circular` for an attribute: `measurement_angle`, or a unit of `°` only when the
  attribute's name is a direction (`bearing|direction|azimuth|heading|(^|_)yaw|wind_?dir`);
  the sun's `elevation` is not circular. An entity's own state keeps rule 1.
- lowpass_dt also derives a device class and a state class for its attribute sources; the
  card doesn't need them.

