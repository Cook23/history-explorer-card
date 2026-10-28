// Rendering of the documentation's images: the built card against the tests' mocked Home
// Assistant, with realistic entities and histories (window.DOCS_STATES, MOCK.rows).
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

// A seeded random generator (the same images every run)
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// A numeric history: f(t) at every step seconds over the last `span` seconds, as
// [[seconds ago, value]], plus a smooth noise of amplitude `noise`
function numeric(span, step, f, { noise = 0, seed = 1, digits = 1 } = {}) {
    const r = rng(seed); let w = 0; const rows = [];
    for( let ago = span; ago >= 0; ago -= step ) {
        w = w * 0.85 + (r() - 0.5) * noise;
        rows.push([ago, (f(span - ago, ago) + w).toFixed(digits)]);
    }
    return rows;
}
// A state history: [[seconds ago, state]] from a list of [start (s from the start), state]
const states = (span, list) => list.map(([t, s]) => [span - t, s]);

function ent(id, name, unit, val, extra = {}) {
    return { entity_id: id, state: String(val), last_changed: new Date().toISOString(), last_updated: new Date().toISOString(),
             attributes: Object.assign({ friendly_name: name }, unit ? { unit_of_measurement: unit } : {}, extra) };
}

// A page with the card. o: states {id: ent}, rows {id: rows}, width (the card's), height
// (the viewport's), clock (ISO), mock (more of the mocked HA's settings), scale (device
// pixel ratio), init (more init script)
async function openDoc(cfg, o = {}) {
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const ctx = await browser.newContext({ viewport: { width: (o.width || 900) + 32, height: o.height || 1200 }, deviceScaleFactor: o.scale || 2, timezoneId: 'UTC', locale: 'en-GB' });
    const page = await ctx.newPage();
    const ud = {};
    await page.exposeFunction('__getUD', k => ud[k] ?? null);
    await page.exposeFunction('__setUD', (k, v) => { ud[k] = v; });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let init = 'window.CFG=' + JSON.stringify({ ...cfg, cardName: 'docs' + Date.now() }) + ';';
    init += 'window.MOCK=' + JSON.stringify({ language: 'en', ...(o.mock || {}), ...(o.dark ? { dark: true } : {}), rows: o.rows || {} }) + ';';
    // (an entity's state now: the last of its history)
    const sts = JSON.parse(JSON.stringify(o.states || {}));
    for( const [id, r] of Object.entries(o.rows || {}) ) if( sts[id] && r.length ) sts[id].state = String(r.reduce((a, b) => b[0] < a[0] ? b : a)[1]);
    init += 'window.DOCS_STATES=' + JSON.stringify(sts) + ';';
    init += `document.addEventListener("DOMContentLoaded",()=>document.documentElement.style.setProperty("--w","${o.width || 900}px"));`;
    if( o.dark ) init += `document.addEventListener("DOMContentLoaded",()=>{ const r=document.documentElement.style; for( const [k,v] of [["--primary-text-color","#e1e1e1"],["--secondary-text-color","#9b9b9b"],["--card-background-color","#1c1c1c"],["--primary-background-color","#111111"],["--divider-color","rgba(225,225,225,.12)"]] ) r.setProperty(k,v); document.head.insertAdjacentHTML("beforeend","<style>ha-card{border-color:#2c2c2c!important}</style>"); });`;
    if( o.init ) init += o.init;
    await page.addInitScript(init);
    if( o.clock ) { await page.clock.install({ time: new Date(o.clock) }); await page.clock.resume(); }
    await page.goto('file://' + path.join(__dirname, 'page.html'));
    await page.waitForTimeout(2500);
    await page.mouse.move(1, 1);
    const d = {
        page, browser, errors,
        E: x => page.evaluate(x),
        wait: ms => page.waitForTimeout(ms),
        // The card's box (client coordinates)
        card: () => page.evaluate(() => { const r = document.getElementById('host').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }),
        // A screenshot of a client rectangle, padded
        shot: async (name, rect, pad = 8) => {
            const clip = { x: Math.max(0, rect.x - pad), y: Math.max(0, rect.y - pad), width: rect.width + 2 * pad, height: rect.height + 2 * pad };
            await page.screenshot({ path: path.join(OUT, name + '.png'), clip });
            return path.join(OUT, name + '.png');
        },
        close: () => browser.close(),
        // The client rectangle of the card's element sel (or of the page's)
        rect: sel => page.evaluate(s => { const e = el.querySelector(s) || document.querySelector(s); if( !e ) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, sel),
        // Hand-drawn notes over the page: [{ arrow: [x0, y0, x1, y1] } | { text, x, y, size, anchor }]
        annotate: notes => page.evaluate(ns => {
            const S = 'http://www.w3.org/2000/svg', svg = document.createElementNS(S, 'svg');
            svg.setAttribute('style', 'position:absolute;left:0;top:0;width:' + document.documentElement.scrollWidth + 'px;height:' + document.documentElement.scrollHeight + 'px;pointer-events:none;z-index:99999;overflow:visible');
            const c = ns.color || '#d32f2f';
            for( const n of ns.list ) {
                if( n.arrow ) {
                    const [x0, y0, x1, y1] = n.arrow, a = Math.atan2(y1 - y0, x1 - x0), L = 11;
                    const mx = (x0 + x1) / 2 + (y1 - y0) * 0.12, my = (y0 + y1) / 2 - (x1 - x0) * 0.12;
                    const p = document.createElementNS(S, 'path');
                    p.setAttribute('d', `M${x0},${y0} Q${mx},${my} ${x1},${y1} M${x1 - L * Math.cos(a - 0.45)},${y1 - L * Math.sin(a - 0.45)} L${x1},${y1} L${x1 - L * Math.cos(a + 0.45)},${y1 - L * Math.sin(a + 0.45)}`);
                    p.setAttribute('fill', 'none'); p.setAttribute('stroke', n.color || c); p.setAttribute('stroke-width', '2.2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
                    svg.appendChild(p);
                } else {
                    const t = document.createElementNS(S, 'text');
                    t.setAttribute('x', n.x + scrollX); t.setAttribute('y', n.y + scrollY); t.setAttribute('fill', n.color || c);
                    t.setAttribute('font-size', n.size || 17); t.setAttribute('font-family', 'Roboto, Arial, sans-serif'); t.setAttribute('text-anchor', n.anchor || 'start');
                    t.setAttribute('stroke', '#fff'); t.setAttribute('stroke-width', '4'); t.setAttribute('paint-order', 'stroke'); t.setAttribute('stroke-linejoin', 'round');
                    t.textContent = n.text; svg.appendChild(t);
                }
            }
            document.body.appendChild(svg);
        }, { list: notes }),
    };
    return d;
}

// The smallest rectangle holding all of rects
const union = (...rs) => { rs = rs.filter(Boolean); const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y));
    return { x, y, width: Math.max(...rs.map(r => r.x + r.width)) - x, height: Math.max(...rs.map(r => r.y + r.height)) - y }; };

// Images put together on a page: rows of [{ img (a name in OUT), caption, width }], gap,
// notes (as annotate's, in the page's coordinates), saved as name
async function compose(name, rows, { gap = 18, notes = [], width = 0, bg = '#fff', pad = 12, captionSize = 18 } = {}) {
    const html = `<!doctype html><html><head><meta charset=utf-8><style>body{margin:0;background:${bg};font-family:Roboto,Arial,sans-serif;color:#555}
        #c{display:inline-flex;flex-direction:column;gap:${gap}px;padding:${pad}px}.r{display:flex;gap:${gap}px;align-items:flex-start}
        figure{margin:0;text-align:center}figcaption{font-size:${captionSize}px;margin-top:6px}img{display:block}</style></head><body><div id=c>` +
        rows.map(r => '<div class=r>' + r.map(i => `<figure>${i.img ? `<img src="${path.join(OUT, i.img + '.png')}" style="width:${i.width || 'auto'}${typeof i.width === 'number' ? 'px' : ''}">` : `<div style="width:${i.space || 0}px;height:${i.h || 1}px"></div>`}${i.caption ? `<figcaption>${i.caption}</figcaption>` : ''}</figure>`).join('') + '</div>').join('') +
        `</div></body></html>`;
    const f = path.join(OUT, '_compose.html'); fs.writeFileSync(f, html);
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const page = await (await browser.newContext({ viewport: { width: width || 4000, height: 3000 }, deviceScaleFactor: 1 })).newPage();
    await page.goto('file://' + f); await page.waitForTimeout(300);
    if( notes.length ) await page.evaluate(ns => {
        const S = 'http://www.w3.org/2000/svg', svg = document.createElementNS(S, 'svg');
        svg.setAttribute('style', 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible');
        for( const n of ns ) {
            if( n.arrow ) { const [x0, y0, x1, y1] = n.arrow, a = Math.atan2(y1 - y0, x1 - x0), L = 16, mx = (x0 + x1) / 2 + (y1 - y0) * 0.12, my = (y0 + y1) / 2 - (x1 - x0) * 0.12;
                const p = document.createElementNS(S, 'path'); p.setAttribute('d', `M${x0},${y0} Q${mx},${my} ${x1},${y1} M${x1 - L * Math.cos(a - 0.45)},${y1 - L * Math.sin(a - 0.45)} L${x1},${y1} L${x1 - L * Math.cos(a + 0.45)},${y1 - L * Math.sin(a + 0.45)}`);
                p.setAttribute('fill', 'none'); p.setAttribute('stroke', n.color || '#d32f2f'); p.setAttribute('stroke-width', '3.5'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); svg.appendChild(p); }
            else { const t = document.createElementNS(S, 'text'); t.setAttribute('x', n.x); t.setAttribute('y', n.y); t.setAttribute('fill', n.color || '#d32f2f'); t.setAttribute('font-size', n.size || 30);
                t.setAttribute('font-family', 'Roboto, Arial, sans-serif'); t.setAttribute('text-anchor', n.anchor || 'start'); t.setAttribute('stroke', '#fff'); t.setAttribute('stroke-width', '6'); t.setAttribute('paint-order', 'stroke'); t.textContent = n.text; svg.appendChild(t); }
        }
        document.body.appendChild(svg); }, notes);
    const r = await page.evaluate(() => { const b = document.getElementById('c').getBoundingClientRect(); return { x: 0, y: 0, width: Math.ceil(b.width), height: Math.ceil(b.height) }; });
    const out = path.join(OUT, name + '.png');
    await page.screenshot({ path: out, clip: r }); await browser.close();
    return { out, ...r };
}

module.exports = { compose, union, openDoc, numeric, states, ent, rng, OUT };
