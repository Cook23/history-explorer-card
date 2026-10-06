// An entity's `color`: a value — a color, an RGB triplet, thresholds on the value shown — or
// an entity whose state holds one, the curve then changing color along its history. Evaluated
// at each point: a curve changes color on a point. The legend shows the current color.
const { openCard } = require('./lib.cjs');

const card = (o) => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, ...o });

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    let t = await openCard(card({ graphs: [
        { type: 'line', entities: [{ entity: 'sensor.power', color: 'input_text.curve_color' }] },
        { type: 'line', entities: [{ entity: 'sensor.power2', color: { 0: 'green', 400: 'red' } }] },
        { type: 'line', entities: [{ entity: 'sensor.tank', color: 'input_text.curve_thresholds' }] },
        { type: 'line', entities: [{ entity: 'sensor.watering_cycle', color: [255, 0, 0] }] },
        { type: 'line', entities: [{ entity: 'sensor.days_to_watering', color: 'input_text.not_a_color' }] },
        { type: 'bar', entities: [{ entity: 'sensor.energy', color: 'input_text.curve_color' }] },
        { type: 'line', entities: [{ entity: 'sensor.rain', color: { entity: 'sensor.clim_mode', hot: 'red', cold: 'blue', default: 'grey' } }] },
        { type: 'line', entities: [{ entity: 'sensor.wind', color: { entity: 'sensor.clim_mode', hot: 'red', cold: 'blue' } }] },
    ] }), { height: 2000, mock: { series: true } });
    await t.wait(800);
    // Graph gi's first dataset: its color steps, its points (time, value), its colors, its legend swatch
    const ds = gi => t.E(`(()=>{ const c=graphAt(${gi}).chart, d=c.data.datasets[0], l=c.legend.legendItems[0];
        return { steps: d.colorSteps ?? null, pts: d.data.map(p=>({ x: +new Date(p.x), y: p.y })), border: d.borderColor, fill: d.backgroundColor,
                 legend: { stroke: l.strokeStyle, fill: l.fillStyle } }; })()`);
    const colorsOf = d => [...new Set(d.steps.map(s => s.borderColor))].sort().join();

    await t.step('the entities holding a color are loaded with the others', async () => {
        const ids = (await t.E(`__ws.filter(w=>w.type==='history/history_during_period').flatMap(w=>w.ids)`));
        return ['input_text.curve_color', 'input_text.curve_thresholds', 'input_text.not_a_color'].every(i => ids.includes(i)) ? true : JSON.stringify(ids);
    });
    await t.step('color from an entity: the curve takes, at each point, the color the entity had then', async () => {
        const d = await ds(0);
        const onPoints = d.steps && d.steps.every(s => d.pts.some(p => p.x === s.x));
        return d.steps && d.steps.length > 3 && colorsOf(d) === '#0000ff,red' && onPoints ? true : JSON.stringify({ steps: d.steps, n: d.pts.length });
    });
    await t.step('color from an entity: the legend shows the curve\'s color now', async () => {
        // (the mock's history goes on past now: the color now is that of the last point at or before now)
        const d = await ds(0); const now = await t.E('Date.now()');
        const last = d.steps.filter(s => s.x <= now).pop().borderColor;
        return d.legend.stroke === last && d.border === last ? true : JSON.stringify({ legend: d.legend, last });
    });
    await t.step('thresholds on a curve: each point colored by its value', async () => {
        const d = await ds(1);
        const ok = d.steps && d.steps.every(s => { const p = d.pts.find(q => q.x === s.x); return p && (p.y >= 400) === (s.borderColor === 'red'); });
        return d.steps && d.steps.length > 1 && colorsOf(d) === 'green,red' && ok ? true : JSON.stringify(d.steps);
    });
    await t.step('thresholds held by an entity (as a template writes them): the same', async () => {
        const d = await ds(2);
        return d.steps && d.steps.length > 1 && colorsOf(d) === 'green,red' ? true : JSON.stringify(d.steps);
    });
    await t.step('an RGB triplet: the curve\'s color', async () => {
        const d = await ds(3);
        return d.border === 'rgb(255,0,0)' && !d.steps && d.legend.stroke === 'rgb(255,0,0)' ? true : JSON.stringify(d);
    });
    await t.step('an entity holding no valid color: a color of the palette', async () => {
        const d = await ds(4);
        return typeof d.border === 'string' && d.border !== 'nothing' && (await t.E(`CSS.supports('color', ${JSON.stringify(d.border)})`)) && !d.steps ? true : JSON.stringify(d);
    });
    await t.step('bars: each bar takes the color of its time, the legend the last bar\'s', async () => {
        const d = await ds(5);
        const cols = Array.isArray(d.fill) ? [...new Set(d.fill)].sort().join() : null;
        return cols === '#0000ff,red' && d.legend.fill === d.fill[d.fill.length - 1] ? true : JSON.stringify({ cols, legend: d.legend });
    });
    // (the mocked sensor.clim_mode: hot, cold, off, in turn every 2 h)
    const mode = x => ['hot', 'cold', 'off'][Math.floor(x / 7200e3) % 3];
    await t.step('thresholds on the value of an entity (its states): each point colored by the state then', async () => {
        const d = await ds(6); const want = { hot: 'red', cold: 'blue', off: 'grey' };
        const ok = d.steps && d.steps.every(s => s.borderColor === want[mode(s.x)]);
        return d.steps && colorsOf(d) === 'blue,grey,red' && ok ? true : JSON.stringify(d.steps);
    });
    await t.step('thresholds on the value of an entity, a state not listed and no default: a color of the palette', async () => {
        const d = await ds(7);
        const off = d.steps && d.steps.filter(s => mode(s.x) === 'off').map(s => s.borderColor);
        return off && off.length && off.every(c => c !== 'red' && c !== 'blue') ? true : JSON.stringify(d.steps);
    });
    await t.step('the entity holding the color changes: the curve takes the new color from then on', async () => {
        // (Home Assistant pushes its states again and again: the card compares each push with the previous one)
        await t.E('el.hass = mkHass()'); await t.wait(200);
        await t.E(`setState('input_text.curve_color', '#00ff00')`); await t.wait(3500);
        const d = await ds(0); const last = d.steps[d.steps.length - 1];
        return last.borderColor === '#00ff00' && last.x >= (await t.E('Date.now()')) - 10000 ? true : JSON.stringify(d.steps.slice(-2));
    });
    done(await t.close());

    // ── A color the configuration sets is kept, even when another curve of the graph has it ──
    t = await openCard(card({ combineSameUnits: true, entityOptions: [{ match: 'sensor.power*', color: '#ff0000' }] }), { height: 900 });
    const select = async (id) => {
        await t.page.click('#b7_0'); await t.page.keyboard.press('Control+A'); await t.page.keyboard.type(id); await t.wait(400);
        await t.page.click(`#es_0 a[data-entity="${id}"]`); await t.wait(500);
        await t.page.keyboard.press('Enter'); await t.wait(1200);
    };
    await t.step('two curves of one graph set to the same color: both keep it', async () => {
        await select('sensor.power'); await select('sensor.power2');
        const g = await t.E(`el.instance.graphs.map(g=>g.entities.map(e=>e.entity+'='+e.color).join('+'))`);
        return g.length === 1 && g[0] === 'sensor.power=#ff0000+sensor.power2=#ff0000' ? true : JSON.stringify(g);
    });
    done(await t.close());

    // ── A curve moved onto another graph where its color is taken ──
    // (power's and tank's colors are set, power2's is the palette's first: the same one)
    t = await openCard(card({ graphs: [
        { type: 'line', entities: [{ entity: 'sensor.power', color: '#3e95cd' }] },
        { type: 'line', entities: [{ entity: 'sensor.power2' }] },
        { type: 'line', entities: [{ entity: 'sensor.tank', color: '#3e95cd' }] },
    ] }), { height: 1200, mock: { series: true } });
    await t.wait(800);
    const colorOf = id => t.E(`el.instance.graphs.flatMap(g=>g.entities).find(e=>e.entity==='${id}').color`);
    const graphsOf = () => t.E(`el.instance._allGraphsInDisplayOrder().map(g=>g.entities.map(e=>e.entity.split('.')[1]).join('+')).join(' | ')`);
    const legendPtOf = id => t.E(`(()=>{ const all=el.instance._allGraphsInDisplayOrder(); const gi=all.findIndex(g=>g.entities.some(e=>e.entity==='${id}'));
        return legendPt(gi, all[gi].entities.findIndex(e=>e.entity==='${id}')); })()`);
    const graphPtOf = id => t.E(`(()=>{ const gi=el.instance._allGraphsInDisplayOrder().findIndex(g=>g.entities.some(e=>e.entity==='${id}')); return graphPtAt(gi, 0.15); })()`);
    const dragOnto = async (id, ontoId) => { await t.drag(await legendPtOf(id), await graphPtOf(ontoId)); await t.wait(800); };
    await t.step('a curve whose color the card picked, dropped where that color is taken: a free color of the palette', async () => {
        const before = await colorOf('sensor.power2');
        await dragOnto('sensor.power2', 'sensor.power');
        const r = { before, layout: await graphsOf(), power: await colorOf('sensor.power'), power2: await colorOf('sensor.power2') };
        return before === '#3e95cd' && r.layout.startsWith('power+power2') && r.power === '#3e95cd' && r.power2 !== '#3e95cd' ? true : JSON.stringify(r);
    });
    await t.step('a curve whose color is set, dropped where that color is taken: it keeps it', async () => {
        await dragOnto('sensor.tank', 'sensor.power');
        const r = { layout: await graphsOf(), power: await colorOf('sensor.power'), tank: await colorOf('sensor.tank') };
        return r.layout.startsWith('power+power2+tank') && r.power === '#3e95cd' && r.tank === '#3e95cd' ? true : JSON.stringify(r);
    });
    done(await t.close());

    return { passed, failed };
};
