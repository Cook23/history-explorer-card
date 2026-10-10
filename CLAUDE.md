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

### 2. Silence detection (`lineMode: smart`) — same rule, with known differences

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
  and starts from the first interval, with σ = 0. README_Full.md says "the same rules as the
  lowpass_dt integration … started from their median": the median part is card-only.
- **Cap.** lowpass_dt also caps the limit at its `tau` (`max(min(raw, tau), 1)`), because it
  drives the injection of synthetic samples. The card has no `tau`.
- lowpass_dt's end-of-silence marker and `silence` option have no equivalent in the card.
