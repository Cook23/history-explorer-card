# history-explorer-card — notes for Claude sessions

Two lines are maintained: `main` (stable 1.1.x) and `v1.2-dev` (1.2 beta, split into several
`src/card-*.js` files). Read `BRANCH.md` on the branch you work on first. Tests: `yarn test`.

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
- **A mini-graph-card function this card lacks is added to it**, mini-graph-card's code
  (MIT) taken as the example, and becomes a function of this card like any other: in its
  part, through its contracts, documented, tested, usable in this card's own syntax too.
- For the UI, this card's gestures and actions stay.

## A README is not a changelog — set by the user, not negotiable (said ten times)

README.md and README_Full.md describe how to use the latest version, as it is now: never
what changed, when, or what it was before. No version number in them — no "(1.2.25)",
"since 1.2.23", "now", "no longer", "was", "is ignored since" — except in the
"📋 Version highlights" section of README.md (before the table of contents, formatted as
lowpass_dt's): the only place naming versions. It lists only the versions of its own branch
(1.1 on `main`, 1.2 on `v1.2-dev`, never mixed), each the one version where an important
functional improvement appeared and works — never a range of versions. It is never deleted;
README_Full links to it. What
changed and when goes to the CHANGELOG (and the release notes). An option kept only for
compatibility is described as it is today ("accepted, no effect"), without its history.
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

## No patch for a special case — set by the user, not negotiable

A special case that looks like a problem (an old saved state, compatibility with a former
version…) is reported to the user, and decided together — never handled on one's own by a
patch. A compatibility problem at a version change happens once; ugly code stays forever.
Keep the code clean.

## An example is a symptom — set by the user, not negotiable

An example the user gives (a screenshot, a width, an entity, a case) is a symptom, never
the thing to fix. Never patch for it: no value tuned to it, no special case, no test built
around it. Search globally for the general cause it shows — which rule, in which part,
produces it for every case — explain that cause to the user, and propose the general rule
that fixes it. The example then only checks that the rule holds.

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
| `history-series.js`: `attributeValue`, `_seriesValue`, `attributeUnitOf`, `WEATHER_UNITS`, `DOMAIN_UNITS`, `TEMPERATURE_ATTRIBUTES`, `isDirectionAttribute`; `card-datasets.js` `circularPeriodOf` | `attributes.py` |

- An attribute's unit: the one its value holds (`45 %`), else Home Assistant frontend's tables
  (weather units, units by domain, temperatures in the system unit; a light's `brightness`
  and a media player's `volume_level` converted into %), else an `X_unit` attribute for every
  attribute with `X` in its name; `X_unit` attributes are units, never series.
- A weather entity's `wind_bearing` is in `°` (Home Assistant gives no unit).
- A sub-attribute (a path: `forecast.0.temperature`, each level's key or index — read by the
  card, not by lowpass_dt): its unit and whether it's a direction from its last name that
  isn't an index (`temperature`). lowpass_dt reading sub-attributes one day would take the
  same rule.
- Automatic `circular` for an attribute: `measurement_angle`, or a unit of `°` only when the
  attribute's name is a direction (`bearing|direction|azimuth|heading|(^|_)yaw|wind_?dir`);
  the sun's `elevation` is not circular. An entity's own state keeps rule 1.
- lowpass_dt also derives a device class and a state class for its attribute sources; the
  card doesn't need them.

