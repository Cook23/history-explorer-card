# history-explorer-card — notes for Claude sessions

Two lines are maintained: `main` (stable 1.1.x) and `v1.2-dev` (1.2 beta, split into several
`src/card-*.js` files). Read `BRANCH.md` on the branch you work on first. Tests: `yarn test`.

## Shared logic with lowpass_dt

[Cook23/lowpass_dt](https://github.com/Cook23/lowpass_dt) (a Home Assistant integration,
Python) is a different project by the same author. The card reuses two pieces of its logic,
and the READMEs and CHANGELOGs of both projects say the two are "the same". A change to
either piece here must be mirrored there (and vice versa), or the docs on both sides become
wrong. lowpass_dt is worked on in its own Claude session and has a matching `CLAUDE.md`;
tell the user when a change here needs a matching change there.

Rule set by the user: each session manages its own repository's code. A session may write
`.md` files in the other repository only with the user's explicit approval, and never
modifies the other repository's code. A code change needed on the other side is passed to
that session (or to the user), not made from here.

### 1. `circular` option values — must stay identical

| card (1.1: `src/history-explorer-card.js`, 1.2: `src/card-datasets.js`) | lowpass_dt |
|---|---|
| `_circularPeriod` | `config.py` (parsing), `sensor.py` `_resolve_auto_circular` (auto-detection) |

- absent / `null` / `none` (trimmed, any case): automatic — state class `measurement_angle`,
  or a unit of exactly `°` (not `°C`/`°F`), gives a period of 360;
- `false`: never circular;
- a number or numeric string: that period; `2pi` (any case, all spaces removed): 2π;
- anything else (including `true`), or a period ≤ 0 or non-finite: off, with a warning.

Introduced in card v1.1.46 / lowpass_dt v1.3.17.

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

Review of the silence detection (October 2026), decided by the user:
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
| `history-series.js`: `attributeValue`, `_seriesValue`, `attributeUnitOf`, `WEATHER_UNITS`, `DOMAIN_UNITS`, `TEMPERATURE_ATTRIBUTES`, `isDirectionAttribute`; `card-datasets.js` `_circularPeriod` | `attributes.py` |

- An attribute's unit: the one its value holds (`45 %`), else Home Assistant frontend's tables
  (weather units, units by domain, temperatures in the system unit; a light's `brightness`
  and a media player's `volume_level` converted into %), else an `X_unit` attribute for every
  attribute with `X` in its name; `X_unit` attributes are units, never series.
- A weather entity's `wind_bearing` is in `°` (Home Assistant gives no unit).
- Automatic `circular` for an attribute: `measurement_angle`, or a unit of `°` only when the
  attribute's name is a direction (`bearing|direction|azimuth|heading|(^|_)yaw|wind_?dir`);
  the sun's `elevation` is not circular. An entity's own state keeps rule 1.
- lowpass_dt also derives a device class and a state class for its attribute sources; the
  card doesn't need them.

