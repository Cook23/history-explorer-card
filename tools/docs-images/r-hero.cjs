// The card at the top of the READMEs: two temperatures, the pressure and a timeline over a day
const { openDoc } = require('./doclib.cjs');
const { home } = require('./scenes.cjs');
if( process.argv[2] && process.argv[2] !== 'hero' ) process.exit(0);
(async () => {
    const d = await openDoc(home.cfg, { states: home.states, rows: home.rows, clock: home.clock, width: 900, height: 1000 });
    await d.wait(1500);
    console.log('hero', await d.shot('hero', await d.card(), 12), d.errors.join(' | '));
    await d.close();
})();
