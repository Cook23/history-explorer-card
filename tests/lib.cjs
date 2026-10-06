// Shared helpers of the interaction tests: a Chromium page running the built card against
// the mock Home Assistant of page.html, a step runner, and mouse/touch gestures.
// Touch goes through CDP (Input.dispatchTouchEvent): the browser's real input pipeline,
// so touch-action and native page scrolling apply as on a phone.
const path = require('path');
const { chromium } = require('playwright');

const pageUrl = name => 'file://' + path.join(__dirname, name);

// A page showing one card with config cfg. opts: { touch, height, mock (the mocked Home
// Assistant's settings, see page.html), page ('panel.html': the info panel instead
// of a card), panel (the info panel's config — null: the panel off), userData (Home
// Assistant's user data to start with), init (more of the page's init script) }
async function openCard(cfg, opts = {})
{
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const ctx = await browser.newContext({ viewport: { width: 1000, height: opts.height || 1400 }, hasTouch: !!opts.touch });
    const page = await ctx.newPage();
    // Home Assistant's user data (the card's saved state), kept for the page's lifetime
    const userData = { ...(opts.userData || {}) };
    await page.exposeFunction('__getUD', k => userData[k] ?? null);
    await page.exposeFunction('__setUD', (k, v) => { userData[k] = v; });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let init = 'window.CFG=' + JSON.stringify({ ...cfg, cardName: (cfg.cardName || 'test') + Date.now() }) + ';';
    if( opts.mock ) init += 'window.MOCK=' + JSON.stringify(opts.mock) + ';';
    if( opts.panel !== undefined ) init += 'window.PANEL_CFG=' + JSON.stringify(opts.panel) + ';';
    if( opts.init ) init += opts.init;
    await page.addInitScript(init);
    await page.goto(pageUrl(opts.page || 'page.html'));
    await page.waitForTimeout(2500);
    const cdp = opts.touch ? await ctx.newCDPSession(page) : null;
    return new Tester(browser, page, cdp, errors);
}

class Tester
{
    constructor(browser, page, cdp, errors)
    {
        this.browser = browser;
        this.page = page;
        this.cdp = cdp;
        this.errors = errors;
        this.failed = 0;
        this.passed = 0;
    }

    E(expr) { return this.page.evaluate(expr); }
    wait(ms) { return this.page.waitForTimeout(ms); }
    async state() { return JSON.parse(await this.E('state()')); }
    async graphs() { return (await this.state()).graphs; }

    // One test: fn returns true when it passed, else a description of what went wrong.
    // A page error during the step fails it too.
    async step(name, fn)
    {
        const e0 = this.errors.length;
        let res;
        try { res = await fn(); } catch( ex ) { res = 'SCRIPT ' + ex.message.split('\n')[0]; }
        const ok = res === true && this.errors.length === e0;
        if( ok ) this.passed++; else this.failed++;
        console.log((ok ? '  ✓ ' : '  ✗ ') + name + (res === true ? '' : '  -> ' + res) +
            (this.errors.length > e0 ? '  PAGE ERRORS: ' + this.errors.slice(e0).join(' | ') : ''));
    }

    async close() { await this.browser.close(); return { passed: this.passed, failed: this.failed }; }

    // ── Mouse ──
    async drag(a, c, steps = 14)
    {
        const m = this.page.mouse;
        await m.move(a.x, a.y); await m.down();
        for( let i = 1; i <= steps; i++ ) { await m.move(a.x + (c.x - a.x) * i / steps, a.y + (c.y - a.y) * i / steps); await this.wait(25); }
        await m.up(); await this.wait(800);
    }
    async dblclick(pt) { await this.page.mouse.click(pt.x, pt.y); await this.wait(120); await this.page.mouse.click(pt.x, pt.y); await this.wait(800); }
    async longPress(pt) { const m = this.page.mouse; await m.move(pt.x, pt.y); await m.down(); await this.wait(900); await m.up(); await this.wait(400); }

    // ── Touch (client coordinates = viewport coordinates) ──
    touch(type, pts) { return this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q.x, y: q.y, id: i })) }); }
    async tap(q) { await this.touch('touchStart', [q]); await this.wait(60); await this.touch('touchEnd', []); }
    async touchMove(a, c, steps = 16, ms = 30) { for( let i = 1; i <= steps; i++ ) { await this.touch('touchMove', [{ x: a.x + (c.x - a.x) * i / steps, y: a.y + (c.y - a.y) * i / steps }]); await this.wait(ms); } }
    async doubleTap(a) { await this.tap(a); await this.wait(120); await this.tap(a); await this.wait(900); }
    // Press, hold for hold ms, then drag
    async touchDrag(a, c, hold = 60) { await this.touch('touchStart', [a]); await this.wait(hold); await this.touchMove(a, c); await this.touch('touchEnd', []); await this.wait(900); }
    async touchLongPress(a) { await this.touch('touchStart', [a]); await this.wait(900); await this.touch('touchEnd', []); await this.wait(400); }
    // Two fingers around c, moved by d1/d2 per step
    async pinch(c, d1, d2, steps = 12)
    {
        let a1 = { x: c.x - 40, y: c.y - 30 }, a2 = { x: c.x + 40, y: c.y + 30 };
        await this.touch('touchStart', [a1, a2]); await this.wait(40);
        for( let i = 1; i <= steps; i++ ) {
            a1 = { x: a1.x + d1.x, y: a1.y + d1.y }; a2 = { x: a2.x + d2.x, y: a2.y + d2.y };
            await this.touch('touchMove', [a1, a2]); await this.wait(40);
        }
        await this.touch('touchEnd', []); await this.wait(1000);
    }
}

module.exports = { openCard };
