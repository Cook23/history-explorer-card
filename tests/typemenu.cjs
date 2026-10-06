// The type menu: its order, the type pre-selected for an entity being added, and the keyboard
const { openCard } = require('./lib.cjs');

const card = (extra) => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24h', statistics: { enabled: false }, graphs: [], ...extra });
// et_N_<index>: 6 smart, 1 curves, 0 straight, 2 stepped, 3 bar, 4 arrowline, 5 timeline
const ORDER = 'et_0_6,et_0_1,et_0_0,et_0_2,et_0_3,et_0_4,et_0_5';

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    let t = await openCard(card(), { height: 1100 });
    const visible = () => t.E(`[...el.querySelectorAll('#et_0_rep_sub a')].filter(a=>getComputedStyle(a).display!=='none' && /^et_0_\\d$/.test(a.id)).map(a=>a.id).join(',')`);
    const bold = () => t.E(`[...el.querySelectorAll('#et_0_rep_sub a')].filter(a=>a.style.display!=='none' && a.style.fontWeight==='bold').map(a=>a.id).join(',')`);
    const highlighted = () => t.E(`[...el.querySelectorAll('#et_0_rep_sub a')].filter(a=>a.style.background).map(a=>a.id).join(',')`);
    const entry = id => t.E(`(()=>{ const e=el.instance.store.list.find(e=>typeof e==='object'&&e.entity==='${id}'); return e?{type:e.type,lineMode:e.lineMode??null}:null; })()`);
    // Selects entity id in the entity selector, which opens the type menu for it
    const select = async (id) => {
        await t.page.click('#b7_0'); await t.page.keyboard.press('Control+A'); await t.page.keyboard.type(id); await t.wait(400);
        await t.page.click(`#es_0 a[data-entity="${id}"]`); await t.wait(500);
    };
    // (Escape closes the submenu, then the menu)
    const close = async () => { await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 1090); await t.wait(300); };

    await t.step('the menu lists smart, curves, straight, stepped, bar, arrowline, timeline', async () => {
        await select('sensor.power'); const v = await visible(); await close();
        return v === ORDER ? true : v;
    });
    // The menu's items in bold: the one whose submenu is open
    const boldItems = () => t.E(`['rep','interp','layout','tests'].filter(k=>el.querySelector('#et_0_'+k)?.style.fontWeight==='bold').join(',')`);
    await t.step('the item whose submenu is open is in bold, and only it', async () => {
        await select('sensor.power');
        const r = { opened: await boldItems() };
        // (another item shown in this menu — Interpolation and Layout aren't, for an entity being added)
        const other = await t.E(`['interp','layout','tests'].find(k=>{ const a=el.querySelector('#et_0_'+k); return a && a.style.display!=='none'; })`);
        await t.E(`el.querySelector('#et_0_${other}').click()`); await t.wait(200);
        r.other = await boldItems(); r.want = other;
        await t.page.keyboard.press('Escape'); await t.wait(200);
        r.back = await boldItems();
        await close();
        return r.opened === 'rep' && r.other === r.want && r.back === '' ? true : JSON.stringify(r);
    });
    const PRESELECT = [
        ['sensor.power', 'et_0_6', 'a measurement: a line, smart'],
        ['sensor.tank', 'et_0_6', 'a volume being measured (a tank): a line, smart'],
        ['sensor.wind', 'et_0_4', 'an angle (°): arrowline'],
        ['sensor.energy', 'et_0_3', 'energy that adds up (total_increasing): bar'],
        ['sensor.net_energy', 'et_0_3', 'energy as a total (device class energy): bar'],
        ['sensor.gas', 'et_0_3', 'a gas volume that adds up (m³): bar'],
        ['binary_sensor.a', 'et_0_5', 'a state: timeline'],
    ];
    for( const [id, want, what] of PRESELECT ) {
        await t.step(`pre-selected for ${what}`, async () => {
            await select(id); const b = await bold(); await close();
            return b === want ? true : `bold ${b || '(none)'}`;
        });
    }
    await t.step('Enter right away adds it as pre-selected (a smart line)', async () => {
        await select('sensor.power'); await t.page.keyboard.press('Enter'); await t.wait(1200);
        const e = await entry('sensor.power');
        return e && e.type === 'line' && e.lineMode === 'smart' ? true : JSON.stringify(e);
    });
    await t.step('the first arrow highlights the pre-selected type, the next one moves on', async () => {
        await select('sensor.wind');
        await t.page.keyboard.press('ArrowDown'); const h1 = await highlighted();
        await t.page.keyboard.press('ArrowDown'); const h2 = await highlighted();
        await t.page.keyboard.press('Enter'); await t.wait(1200);
        const e = await entry('sensor.wind');
        return h1 === 'et_0_4' && h2 === 'et_0_5' && e?.type === 'timeline' ? true : JSON.stringify({ h1, h2, e });
    });
    await t.step('a pattern: "Default" gives each entity its own type', async () => {
        await t.page.click('#b7_0'); await t.page.keyboard.press('Control+A'); await t.page.keyboard.type('sensor.energy*'); await t.wait(400);
        await t.page.keyboard.press('ArrowDown'); await t.page.keyboard.press('Enter'); await t.wait(300);
        await t.page.keyboard.press('Enter'); await t.wait(500);
        const b = await bold(); await t.page.keyboard.press('Enter'); await t.wait(1200);
        const e = [await entry('sensor.energy'), await entry('sensor.energy2')];
        return b === 'et_0_default' && e.every(x => x?.type === 'bar') ? true : JSON.stringify({ b, e });
    });
    done(await t.close());

    t = await openCard(card({ entityOptions: { 'sensor.power': { lineMode: 'lines' }, 'sensor.wind': { circular: false } } }), { height: 1100 });
    await t.step('entityOptions win: lineMode lines pre-selects straight', async () => {
        await t.page.click('#b7_0'); await t.page.keyboard.type('sensor.power'); await t.wait(400);
        await t.page.click(`#es_0 a[data-entity="sensor.power"]`); await t.wait(500);
        const b = await t.E(`[...el.querySelectorAll('#et_0_rep_sub a')].filter(a=>a.style.display!=='none' && a.style.fontWeight==='bold').map(a=>a.id).join(',')`);
        return b === 'et_0_0' ? true : b;
    });
    await t.step('entityOptions win: circular false makes an angle a smart line', async () => {
        await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 1090); await t.wait(300);
        await t.page.click('#b7_0'); await t.page.keyboard.press('Control+A'); await t.page.keyboard.type('sensor.wind'); await t.wait(400);
        await t.page.click(`#es_0 a[data-entity="sensor.wind"]`); await t.wait(500);
        const b = await t.E(`[...el.querySelectorAll('#et_0_rep_sub a')].filter(a=>a.style.display!=='none' && a.style.fontWeight==='bold').map(a=>a.id).join(',')`);
        return b === 'et_0_6' ? true : b;
    });
    done(await t.close());

    return { passed, failed };
};
