// Adding entities: "modem" typed in the entity field, the matching entities listed, the
// third one picked with the keyboard, an annotation
const { openDoc, union } = require('./doclib.cjs');
const { modem } = require('./scenes.cjs');
if( process.argv[2] && process.argv[2] !== 'adding-entities' ) process.exit(0);
(async () => {
    const d = await openDoc(modem.cfg, { states: modem.states, rows: modem.rows, clock: modem.clock, width: 900, height: 900 });
    await d.wait(1000);
    await d.page.click('#b7_0'); await d.page.keyboard.type('modem', { delay: 60 }); await d.wait(800);
    const list = await d.rect('#es_0');
    for( let k = 0; k < 3; k++ ) { await d.page.keyboard.press('ArrowDown'); await d.wait(120); }
    await d.wait(400);
    const f = await d.rect('#b7_0');
    await d.annotate([{ arrow: [f.x + f.width + 150, f.y + 150, list.x + list.width + 12, list.y + 40] },
                      { text: 'Add an entity to the history', x: f.x + f.width + 60, y: f.y + 175 }]);
    console.log('adding-entities', await d.shot('adding-entities', union(await d.card(), list), 12), d.errors.join(' | '));
    await d.close();
})();
