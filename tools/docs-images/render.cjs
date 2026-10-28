// Renders every image of the documentation (or the scenes named) into out/: the built card
// (../../history-explorer-card.js) against the tests' mocked Home Assistant. See README.md.
const { execFileSync } = require('child_process');
const path = require('path');
const scripts = ['r-hero.cjs', 'r-modem.cjs', 'r-menus.cjs', 'r-drag.cjs', 'r-all.cjs'];
const only = process.argv.slice(2);
for( const s of scripts ) {
    if( !only.length ) { execFileSync('node', [path.join(__dirname, s)], { stdio: 'inherit' }); continue; }
    for( const name of only ) execFileSync('node', [path.join(__dirname, s), name], { stdio: 'inherit' });
}
