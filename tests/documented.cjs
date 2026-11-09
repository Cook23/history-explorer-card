// The options README_Full documents that no other suite tests: each one set, what it does —
// the legend, the tooltip, the timelines' texts and colors, a graph's colors and spacing, the
// Y axis' margins, the sizes, the theme, the toolbar, the entity selector's filters, the
// present's offset, the time ranges, the entity options' priorities, an angle by its state
// class, the statistics' period
const { openCard } = require('./lib.cjs');

const H = 3600;
// (a color as the browser writes it: to compare two written differently)
const CSS = `const css = c => { const x = document.createElement('canvas').getContext('2d'); x.fillStyle = '#000'; x.fillStyle = c; return x.fillStyle; };`;

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    // ── A card of many options at once (each test reads only its own) ──
    {
        const t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24h', statistics: { enabled: false },
            showCurrentValues: false, stateTextMode: 'raw', axisAddMarginMin: true, axisAddMarginMax: true, labelAreaWidth: 90,
            lineGraphHeight: 180, barGraphHeight: 120, timelineBarHeight: 18, timelineBarSpacing: 30, uimode: 'dark',
            uiLayout: { invertZoom: true }, defaultTimeOffset: '1h',
            filterEntities: ['sensor.*power*', 'binary_sensor.*'], excludeFilterEntities: 'sensor.power_kw',
            tooltip: { stateTextMode: 'auto', showColorsLine: false, showColorsTimeline: false, showLabel: false, showDuration: true },
            stateColors: { 'binary_sensor.a.on': '#000001', 'door.on': '#000002', 'binary_sensor.on': '#000003', 'on': '#000004',
                           'binary_sensor.b': '#000005', 'person.home': '--hec-test-color' },
            entityOptions: { 'sensor.net_energy': { lineMode: 'lines' }, 'volume_storage': { lineMode: 'stepped', color: '#000006' }, 'sensor': { lineMode: 'curves', width: 3 } },
            graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.power_kw', legendVisible: false }] },
                     { type: 'timeline', entities: [{ entity: 'binary_sensor.a' }, { entity: 'binary_sensor.b' }] },
                     { type: 'line', lineColor: ['#010101', '#020202'], entities: [{ entity: 'sensor.rain' }, { entity: 'sensor.tank' }] },
                     { type: 'bar', entities: [{ entity: 'sensor.energy' }] },
                     { type: 'arrowline', entities: [{ entity: 'sensor.wind' }] }] },
            { height: 1600, mock: { series: true, extraStates: { 'sensor.heading': { entity_id: 'sensor.heading', state: '10', last_changed: new Date().toISOString(), last_updated: new Date().toISOString(),
                attributes: { friendly_name: 'heading', state_class: 'measurement_angle' } } } },
              // (--hec-test-color: a theme variable of the test page, tests/page.html)
            });
        await t.wait(2000);
        const G = gi => `graphAt(${gi}).chart`;

        await t.step('legendVisible: false on an entity — its label out of the legend, its curve drawn', async () => {
            // (a label left out stays in Chart.js' list, marked hecHidden: not drawn, no room taken)
            const r = await t.E(`({ labels: ${G(0)}.legend.legendItems.filter(i => !i.hecHidden).map(i => i.text), drawn: ${G(0)}.data.datasets[1].data.length > 0 && !${G(0)}.data.datasets[1].hidden })`);
            return JSON.stringify(r.labels) === '["power"]' && r.drawn ? true : JSON.stringify(r);
        });
        await t.step('showCurrentValues: false — no value now in the legend labels', async () => {
            const r = await t.E(`${G(0)}.legend.legendItems.map(i => i.hecLegendValue)`);
            return r.every(v => !v) ? true : JSON.stringify(r);
        });
        await t.step('lineColor: a list — each entity of the graph without its own color takes the one at its place', async () => {
            const r = await t.E(`(()=>{ ${CSS} return ${G(2)}.data.datasets.map(d => css(d.borderColor)); })()`);
            return JSON.stringify(r) === '["#010101","#020202"]' ? true : JSON.stringify(r);
        });
        await t.step('stateTextMode: raw — a timeline\'s rows show the raw states; tooltip.stateTextMode: auto — its tooltip the names Home Assistant gives them', async () => {
            const r = await t.E(`(()=>{ const I = el.instance, c = ${G(1)}; I._hass.localize = k => /\\.state\\.on$/.test(k) ? 'Activé' : ''; I.stateTexts.clear();
                const i = c.data.datasets[0].data.findIndex(d => d[2] === 'on');
                return { row: c.options.elements.textFunction('on', c.data.datasets, 0), tip: I._tooltipValue('timeline', c.data.datasets[0], { index: i }) }; })()`);
            return r.row === 'on' && r.tip === 'Activé' ? true : JSON.stringify(r);
        });
        await t.step('stateColors: an entity\'s state, else its device class\'s, else its domain\'s, else every entity\'s; an entity\'s own fallback; a CSS variable', async () => {
            const r = await t.E(`(()=>{ ${CSS} const I = el.instance, c = (d, dc, e, v) => css(I.getStateColor(d, dc, e, v));
                return [c('binary_sensor', 'door', 'binary_sensor.a', 'on'), c('binary_sensor', 'door', 'binary_sensor.c', 'on'), c('binary_sensor', undefined, 'binary_sensor.c', 'on'),
                        c('switch', undefined, 'switch.x', 'on'), c('binary_sensor', undefined, 'binary_sensor.b', 'weird'), c('person', undefined, 'person.me', 'home')]; })()`);
            return JSON.stringify(r) === '["#000001","#000002","#000003","#000004","#000005","#123456"]' ? true : JSON.stringify(r);
        });
        await t.step('entityOptions as a dictionary: the entity\'s entry, else its device class\'s, else its domain\'s — one only, never merged', async () => {
            const r = await t.E(`['sensor.net_energy', 'sensor.tank', 'sensor.power'].map(e => { const o = el.instance.getEntityOptions(e) ?? {}; return [o.lineMode, o.color ?? null, o.width ?? null]; })`);
            return JSON.stringify(r) === '[["lines",null,null],["stepped","#000006",null],["curves",null,3]]' ? true : JSON.stringify(r);
        });
        await t.step('axisAddMarginMin / axisAddMarginMax: a margin below and above the curves', async () => {
            const r = await t.E(`(()=>{ const c = ${G(0)}, ys = c.data.datasets.flatMap(d => d.data.map(p => p.y)).filter(y => y !== null && isFinite(y)), s = c.scales[c.options.scales.yAxes[0].id];
                return { min: s.min, max: s.max, dmin: Math.min(...ys), dmax: Math.max(...ys) }; })()`);
            return r.min < r.dmin && r.max > r.dmax ? true : JSON.stringify(r);
        });
        await t.step('labelAreaWidth: the label area left of the graphs that wide', async () => {
            const r = await t.E(`[0, 1].map(gi => Math.round(${G('gi')}.chartArea.left))`);
            return r.every(x => x === 90) ? true : JSON.stringify(r);
        });
        await t.step('lineGraphHeight, barGraphHeight, timelineBarHeight, timelineBarSpacing: a line graph 180 px, a bar graph 120 px (and its interval selector), a timeline\'s bars 18 px', async () => {
            const r = await t.E(`({ line: graphAt(0).graphHeight, bar: graphAt(3).graphHeight, bars: ${G(1)}.options.scales.yAxes[0].barThickness ?? ${G(1)}.options.scales.yAxes[0].barThickness })`);
            return r.line === 180 && r.bar === 144 && r.bars === 14 ? true : JSON.stringify(r);
        });
        await t.step('uimode: dark — the dark theme\'s colors, whatever Home Assistant\'s', async () => {
            const r = await t.E(`({ dark: el.instance.ui.darkMode, labels: el.instance.pconfig.graphLabelColor })`);
            return r.dark === true ? true : JSON.stringify(r);
        });
        await t.step('uiLayout.invertZoom: the magnifiers − and + work the other way round — the left one zooms in', async () => {
            const r = await t.E(`(()=>{ const I = el.instance, h0 = I.activeRange.timeRangeHours; const b = [...el.querySelectorAll('.hec-mag')].filter(e => /^b[45]_0$/.test(e.id))[0]; b.click(); return { h0, h1: I.activeRange.timeRangeHours, id: b.id }; })()`);
            return r.h1 < r.h0 ? true : JSON.stringify(r);
        });
        await t.step('filterEntities, excludeFilterEntities: the selector lists only what the filters keep, then what the exclusions leave', async () => {
            await t.E(`(()=>{ const i = el.querySelector('#b7_0'); i.focus(); i.dispatchEvent(new Event('focus')); })()`); await t.wait(800);
            const r = await t.E(`[...el.querySelector('#es_0').querySelectorAll('a[data-entity]')].map(a => a.dataset.entity)`);
            const ok = r.length > 0 && r.includes('sensor.power') && r.includes('binary_sensor.a') && !r.includes('sensor.power_kw') && !r.includes('sensor.rain');
            await t.page.keyboard.press('Escape');
            return ok ? true : JSON.stringify(r);
        });
        await t.step('defaultTimeOffset: 1h — the present an hour after now, the window ending there', async () => {
            const r = await t.E(`Math.round((el.instance.presentTime().valueOf() - Date.now()) / 60e3)`);
            return r === 60 ? true : `${r} min`;
        });
        await t.step('an entity of state class measurement_angle, without a unit: circular, period 360', async () => {
            const r = await t.E(`el.instance.circularPeriodOf({ entity: 'sensor.heading' })`);
            return r === 360 ? true : JSON.stringify(r);
        });
        await t.step('tooltip.showColorsLine / showColorsTimeline: false — no color boxes; showLabel: false — no series\' name; showDuration — a timeline\'s state with how long it lasted', async () => {
            const r = await t.E(`(()=>{ const l = ${G(0)}, tl = ${G(1)}, ds = tl.data.datasets[0];
                const item = { datasetIndex: 0, index: 0, xLabel: '', yLabel: l.data.datasets[0].data[0].y };
                return { colorsLine: l.options.tooltips.displayColors, colorsTimeline: tl.options.tooltips.displayColors,
                         label: l.options.tooltips.callbacks.label(item, l.data), name: l.data.datasets[0].name,
                         title: tl.options.tooltips.callbacks.title([{ datasetIndex: 0, index: 0, xLabel: '' }], tl.data) }; })()`);
            return r.colorsLine === false && r.colorsTimeline === false && !r.label.includes(r.name) && /\(\d\d:\d\d:\d\d\)$/.test(r.title) ? true : JSON.stringify(r);
        });
        await t.step('an arrowline\'s tooltip: its value, in its unit', async () => {
            const r = await t.E(`(()=>{ const c = ${G(4)}, ds = c.data.datasets[0]; return { v: el.instance._tooltipValue('arrowline', ds, { index: 0 }), unit: ds.unit, state: ds.data[0][2] }; })()`);
            return r.v.trim() === `${Math.round(r.state * 100) / 100} ${r.unit}`.trim() || r.v.startsWith(String(r.state).slice(0, 3)) && r.v.endsWith(r.unit) ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    // ── barSpacing on a graph, under its options, on an entity: the room between two bars ──
    {
        const t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '7d', statistics: { enabled: false },
            graphs: [{ type: 'bar', interval: 'daily', barSpacing: 10, entities: [{ entity: 'sensor.energy' }] },
                     { type: 'bar', interval: 'daily', options: { barSpacing: 10 }, entities: [{ entity: 'sensor.gas' }] },
                     { type: 'bar', interval: 'daily', entities: [{ entity: 'sensor.rain', barSpacing: 10 }] }] }, { height: 1200, mock: { series: true } });
        await t.wait(1500);
        await t.step('barSpacing: 10 on a graph, under its options, on an entity — 10 px between two bars', async () => {
            const r = await t.E(`[0, 1, 2].map(gi => { const m = graphAt(gi).chart.getDatasetMeta(0).data.map(b => b._model).filter(b => b && b.width > 0);
                return m.slice(1).map((b, i) => +((b.x - b.width / 2) - (m[i].x + m[i].width / 2)).toFixed(1)); })`);
            return r.every(gaps => gaps.length >= 3 && gaps.every(g => Math.abs(g - 10) <= 1)) ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    // ── entityOptions as a list: patterns, the first entry winning, the later ones filling in ──
    {
        const t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24h', statistics: { enabled: false },
            entityOptions: [{ match: 'sensor.pow*', lineMode: 'lines' }, { match: 'sensor.power?kw', lineMode: 'stepped', color: '#020202' }, { entity: 'sensor.rain', width: 4 }], graphs: [] }, { height: 600 });
        await t.step('entityOptions as a list: * and ? patterns, an entity; every entry matching applies — the first one wins for each option, the later ones fill in', async () => {
            const r = await t.E(`['sensor.power_kw', 'sensor.power', 'sensor.rain', 'sensor.tank'].map(e => { const o = el.instance.getEntityOptions(e) ?? {}; return [o.lineMode ?? null, o.color ?? null, o.width ?? null]; })`);
            return JSON.stringify(r) === '[["lines","#020202",null],["lines",null,null],[null,null,4],[null,null,null]]' ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    // ── The time ranges: minutes, hours, days, weeks, months, a year ──
    {
        const t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24h', statistics: { enabled: false }, graphs: [] }, { height: 600 });
        await t.step('defaultTimeRange: m, h, d, w, o (months), y (a year) — 30m, 6h, 2d, 2w, 1o (30 days), 3o (91 days), 1y (365 days)', async () => {
            const r = await t.E(`['30m', '6h', '2d', '2w', '1o', '3o', '1y'].map(s => { const I = el.instance; I.setTimeRangeFromString(s); return I.activeRange.timeRangeHours * 60 + I.activeRange.timeRangeMinutes; })`);
            return JSON.stringify(r) === JSON.stringify([30, 360, 2880, 20160, 43200, 131040, 525600]) ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    // ── The tooltip's size: a timeline at least as high as its tooltip; slim, a single day, no date ──
    for( const [size, height] of [['full', 130], ['compact', 115], ['slim', 90]] ) {
        const t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24h', statistics: { enabled: false }, tooltip: { size },
            graphs: [{ type: 'timeline', entities: [{ entity: 'binary_sensor.a' }] }, { type: 'line', entities: [{ entity: 'sensor.power' }] }] }, { height: 900, mock: { series: true } });
        await t.wait(1500);
        await t.step(`tooltip.size: ${size} — a timeline of one row ${height} px high${size === 'slim' ? '; a day shown: the time of a value without its date' : ''}`, async () => {
            const r = await t.E(`(()=>{ const g = graphAt(1).chart, p = g.data.datasets[0].data[0];
                return { h: graphAt(0).graphHeight, label: g.options.tooltips.callbacks.label({ datasetIndex: 0, index: 0, xLabel: 'X', yLabel: p.y }, g.data) }; })()`);
            const noDate = size !== 'slim' || /^\d{1,2}:\d\d/.test(r.label);
            return r.h === height && noDate ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    // ── defaultInfoPanel: the YAML's, the switch's — the last one to speak; kept for the user ──
    {
        const cfg = v => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24h', statistics: { enabled: false }, defaultInfoPanel: v, graphs: [] });
        const t = await openCard(cfg(false), { height: 600 });
        // (the switch Global ▸ Enhanced native history: on or off; clicked)
        const on = async () => { await t.E(`el.querySelector('#bo_0').click()`); await t.wait(200); await t.E(`el.instance.showOptionsSubmenu(0, 'all')`); await t.wait(200);
            const v = await t.E(`el.querySelector('#ei_0').getAttribute('aria-checked')`); await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.wait(300); return v === 'true'; };
        const flip = async () => { await t.E(`el.querySelector('#bo_0').click()`); await t.wait(200); await t.E(`el.instance.showOptionsSubmenu(0, 'all')`); await t.wait(200);
            await t.E(`el.querySelector('#ei_0').click()`); await t.wait(900); };
        const reload = async (v, fresh) => {
            const name = await t.E('window.CFG.cardName');
            await t.page.addInitScript(c => { window.CFG = c; }, { ...cfg(v), cardName: name });
            if( fresh ) await t.E('localStorage.clear()');
            await t.page.reload(); await t.wait(3000);
        };
        await t.step('defaultInfoPanel: the YAML\'s value until the switch speaks; the switch kept while the YAML doesn\'t change, on another device too; the YAML changed: its value again', async () => {
            const r = { yaml: await on() };
            await flip(); r.switched = await on();
            await reload(false); r.reloaded = await on();
            await reload(false, true); r.otherDevice = await on();
            await flip(); r.off = await on();
            await reload(false); r.offReloaded = await on();
            await reload(true); r.yamlChanged = await on();
            return !r.yaml && r.switched && r.reloaded && r.otherDevice && !r.off && !r.offReloaded && r.yamlChanged ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    // ── statistics.period: day — the daily statistics asked ──
    {
        const t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '1y', statistics: { enabled: true, period: 'day' },
            graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }, { height: 600, mock: { series: true, historyDays: 10 } });
        await t.wait(4000);
        await t.step('statistics.period: day — over a year, no hourly statistics: the daily ones where the 5-minute ones are no longer kept (10 days)', async () => {
            const r = await t.E(`[...new Set(__ws.filter(w => w.type === 'recorder/statistics_during_period').map(w => w.period))]`);
            return r.includes('day') && !r.includes('hour') ? true : JSON.stringify(r);
        });
        done(await t.close());
    }

    return { passed, failed };
};
