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
- `arrowColor`, `arrowBackground`: its arrows' color, the band's behind them; `arrowColors`, `arrowBackgrounds`: each block's (by its index in `data`) — an arrow the color of the block it shows, the band under each block its own —, else the dataset's.
- `arrowPeriod`: a full turn of the arrows (360 by default).
- `arrowLength`: its arrows' length — none: every arrow its whole length (the arrow's path, 24 px square); `{ fraction }`: every arrow that part of it (0: a point); `{ max }`: each block's value `[3]` over `max`, its absolute value, at most the whole length (`max` 0: a point) — a block without one (`undefined`): its whole length, its shaft dashed.
- The arrows are drawn as a path (`Path2D`), rotated about the middle of their box and scaled there.
