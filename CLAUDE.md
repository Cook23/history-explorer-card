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

