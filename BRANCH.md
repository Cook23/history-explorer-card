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
