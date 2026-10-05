# Branch: v1.2-dev

This branch contains the development version 1.2.

DO NOT assume that code or architecture from main still applies.
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

## Planned

1.2-only features, to do when the time comes (each one a reason for a 1.2 release).
None at the moment.

## Planned, once the 1.1 line is dropped

Not before 1.2 is the only line maintained: these changes are too large to port to 1.1.

None at the moment.
