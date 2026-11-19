# timeline.js
## Links
https://github.com/fanthos/chartjs-chart-timeline/blob/master/timeline.js

## Version
After this commit: [2020-08-19] 
https://github.com/fanthos/chartjs-chart-timeline/commit/469ceb8429e737957844f7d42c11ff9f1c8d3ed4
Which is the latest commit. All up to date.

## Changes
Many changes
Compare to source here: https://raw.githubusercontent.com/fanthos/chartjs-chart-timeline/master/timeline.js
There are a lot of changes. Formatting tweaks, moment.js caching, and the entire Arrowline chart is added.
That would make using the original source very hard.

### Timeline: its dataset's options
- `blockFill`: its blocks' fill — `solid` (the default: drawn as before), `light` (its color at 15 %), `fade` (its color fading out downwards), `none` (nothing); every block outlined in its color, whatever its fill; `blockFills`: each block's (by its index in `data`), else the dataset's. A block not solid: its text in the page's text color (`--primary-text-color`).

### Arrowline: its dataset's options
- `arrowColor`, `arrowBackground`: its arrows' color, the band's behind them; `arrowFade`: a color — the band in it, fading out downwards (instead of `arrowBackground`); `arrowColors`, `arrowBackgrounds`: each block's (a background `{ fade: color }`: fading out) (by its index in `data`) — an arrow the color of the block it shows, the band under each block its own —, else the dataset's.
- `arrowPeriod`: a full turn of the arrows — the entity's circular period, else the card's default one (`arrowlinePeriod`, 360); always given.
- `circularPeriod`: the entity's circular period — its means circular (`circularMean`, Home Assistant's: the direction of the sum of unit vectors, for that period) —; `null`: not circular, its means a number's (`timeWeightedMean`, its lowest and highest as they are). Never guessed from `arrowPeriod`.
- `arrowLength`: its arrows' length — none: every arrow `ARROW_NO_LENGTH` (0.8) of its whole length (its whole length: the arrow's path in a 24 px square box, 1.7 times its first length, 13.93 px — its head unchanged —, centred); `{ fraction }`: every arrow that part of it (0: a point); `{ max }`: a length over `max`, its absolute value, at most the whole length (`max` 0: a point) — none known (`undefined`): `ARROW_NO_LENGTH` of its whole length, its shaft dashed.
- Its rows (`data`, the card's `_arrowColumns`): `[from, to, mean, length, x]` — a value alone, or a column of pixels holding several: their mean (circular, in [0, `circularPeriod`), for a circular entity), their length's mean (`undefined`: none), and `x`: `lo`, `hi` (the lowest and highest direction, as differences to the mean), `lenMin`, `lenMax`, `span` (how long its values last), `lenSpan` (those with a length), `lenWeight` (Σ how long × |length|), `byLen` (their mean weighted by it), `sides` (`{ min, max }`: the extremes' sides asked there, else `null`), `turn` (a circular entity's: `first`, its first direction; `lo`, `hi`, `last`, how far it went each way and where it ended from there, its values followed in time order, each the shortest way from the one before).
- `arrowSpacing`: the room between two arrows, in px — the card's (`ARROW_SPACING_PX`, the zone its length's scale is worked out on).
- Each arrow: the mean of the rows in its zone (as wide as the space between two arrows, its middle the arrow's), each by the part of it there — its direction the mean (`src/history-stats.js`, the card's one rule: `circularMean` with `circularPeriod`, else `timeWeightedMean`) of their means weighted by how long, or of their `byLen` weighted by `lenWeight` when `arrowWeighting` is `length` and a length is known there; its length their lengths' mean weighted by how long. No row under its middle: no arrow. Its color: the row's under its middle.
- Its extremes, where a row of its zone asks for a side (`sides`): a whole disc about its middle, its radius at most half the band's height (`ARROW_NO_LENGTH` of that where no length is given: no `arrowLength`, or none known), where its rows' turns, joined in time order, make a whole turn or more; else from its base, a sector of a disc to the lowest (anticlockwise, `min`) and the highest direction (clockwise, `max`) of the rows there around its own, its radius their longest length, in its color at `Chart.hecMinMaxBandAlpha` (a curve's min/max band's).
- Its arrows and their extremes cut at the chart's area.
- The arrows are drawn as a path (`Path2D`), rotated about the middle of their box and scaled there.
