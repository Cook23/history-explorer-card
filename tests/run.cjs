// Runs every interaction test suite against the built history-explorer-card.js (run
// `yarn build` first). usage: yarn test [lint|store|mouse|touch|cards|features|panel|typemenu|arrowline|scale|options|persistence|pen|colors|yaxes|graphmenu|attributes ...]
const SUITES = ['lint', 'store', 'mouse', 'touch', 'cards', 'features', 'panel', 'typemenu', 'arrowline', 'scale', 'options', 'persistence', 'pen', 'colors', 'yaxes', 'graphmenu', 'attributes'];

(async () => {
    const only = process.argv.slice(2);
    let passed = 0, failed = 0;
    for( const name of SUITES ) {
        if( only.length && !only.includes(name) ) continue;
        console.log(name);
        const r = await require(`./${name}.cjs`)();
        passed += r.passed; failed += r.failed;
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
