// A gesture on a curve — the nearest one, picked as a label is: a click or a tap puts it in the
// tooltip mode (several curves can be), a long-press (a right click) shows or hides its
// samples' dots, as the Points switch of the Appearance submenu of its menu or of its
// graph's; every dot shown by default of a diameter of the line width + 2 px (Alt's too), the
// hovered one 2 px wider
const { openCard } = require('./lib.cjs');

// (the tooltip of the curves selected — a click on one —, on this large screen too: what most
// steps here are about; the other modes, see the end)
const card = () => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, largeScreenTooltip: 'selected',
    graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] },
             { type: 'line', yAxis: 'left', entities: [{ entity: 'sensor.rain' }, { entity: 'sensor.tank' }] },
             // (two curves close to each other: rain drawn 180 times larger)
             { type: 'line', yAxis: 'left', entities: [{ entity: 'sensor.rain', scale: 180 }, { entity: 'sensor.tank' }] },
             // (two curves exactly on top of each other: power (400 W) and rain (4 mm) drawn
             // 100 times larger, both following the same sine, on one axis)
             { type: 'line', yAxis: 'left', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.rain', scale: 100 }] }] });
const near = (a, b) => Math.abs(a - b) < 0.01;

module.exports = async function()
{
    let passed = 0, failed = 0;
    const done = r => { passed += r.passed; failed += r.failed; };

    // Curve k of graph gi: its dots' radius, its showPoints saved
    const dots = (t, gi, k = 0) => t.E(`(()=>{ const g=el.instance.graphsInDisplayOrder()[${gi}];
        const d=g.chart.data.datasets[${k}]; return { r: d.pointRadius, R: (d.borderWidth+2)/2, hover: d.pointHoverRadius, saved: g.entities[${k}].showPoints }; })()`);
    const shown = d => near(d.r, d.R) && near(d.hover, d.R + 1);
    const menuOpen = t => t.E(`el.querySelector('#et_0').style.display !== 'none'`);
    const closeMenu = async t => { await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.wait(300); };
    // A point of graph gi's plot area clearly beside every curve: above or below them at x
    const beside = (t, gi) => t.E(`(()=>{ const c=graphAt(${gi}).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect(), x=(A.left+A.right)/2;
        const ys=c.data.datasets.flatMap((d,i)=>c.getDatasetMeta(i).data.map(p=>p._view)).filter(v=>!v.skip&&Math.abs(v.x-x)<40).map(v=>v.y);
        const y=Math.min(...ys)-A.top > A.bottom-Math.max(...ys) ? A.top+4 : A.bottom-4; return {x:r.left+x, y:r.top+y}; })()`);

    // ── With a mouse ──
    // (the curves drawn the same whenever the suite runs: the hover dot and the tooltip's
    // place are measured on them)
    const CLOCK = '2026-10-14T14:00:00Z';
    let t = await openCard(card(), { mock: { series: true }, clock: CLOCK });
    await t.wait(800);
    await t.step('a long-press on a curve shows its dots, its diameter the line width + 2 px (hovered: + 2 more), saved; again, hides them (back to the hovered dot only)', async () => {
        const p = await t.E('pointPt(0,0.5)');
        await t.longPress(p); const on = await dots(t, 0); const menu = await menuOpen(t);
        await t.longPress(p); const off = await dots(t, 0);
        return shown(on) && on.saved === true && !menu && off.r === 0 && off.hover > 0 && off.saved === 'hover' ? true : JSON.stringify({ on, off, menu });
    });
    await t.step('a right click on a curve: the same', async () => {
        const p = await t.E('pointPt(0,0.3)');
        await t.contextMenu(p); await t.wait(400); const on = await dots(t, 0);
        await t.contextMenu(p); await t.wait(400); const off = await dots(t, 0);
        return shown(on) && off.r === 0 ? true : JSON.stringify({ on, off });
    });
    await t.step('of two curves, the one under the pointer only', async () => {
        const p = await t.E(`(()=>{ const c=graphAt(1).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect();
            const vs=d=>c.getDatasetMeta(d).data.map(p=>p._view).filter(v=>!v.skip&&v.x>A.left+20&&v.x<A.right-20);
            const rain=vs(0), yOf=x=>rain.reduce((b,v)=>Math.abs(v.x-x)<Math.abs(b.x-x)?v:b).y;
            const v=vs(1).find(v=>Math.abs(v.y-yOf(v.x))>20); return {x:r.left+v.x, y:r.top+v.y}; })()`);
        await t.longPress(p); const a = await dots(t, 1, 0), b = await dots(t, 1, 1);
        await t.longPress(p);
        return a.r === 0 && shown(b) ? true : JSON.stringify({ a, b });
    });
    await t.step('about halfway between two curves, nothing', async () => {
        const p = await t.E(`(()=>{ const c=graphAt(2).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect();
            const vs=d=>c.getDatasetMeta(d).data.map(p=>p._view).filter(v=>!v.skip&&v.x>A.left+20&&v.x<A.right-20);
            const rain=vs(0), near=x=>rain.reduce((b,v)=>Math.abs(v.x-x)<Math.abs(b.x-x)?v:b);
            const v=vs(1).find(v=>{ const w=near(v.x); return Math.abs(v.x-w.x)<0.5 && Math.abs(v.y-w.y)>6 && Math.abs(v.y-w.y)<20; });
            return v && {x:r.left+v.x, y:r.top+(v.y+near(v.x).y)/2}; })()`);
        if( !p ) return 'no place where the two curves are 6 to 20 px apart';
        await t.longPress(p); const a = await dots(t, 2, 0), b = await dots(t, 2, 1);
        return a.r === 0 && b.r === 0 ? true : JSON.stringify({ a, b });
    });
    await t.step('between two curves: the dead zone is the middle third of the gap — 0.3 of it from one curve picks it, 0.45 none', async () => {
        const at = f => t.E(`(()=>{ const c=graphAt(2).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect();
            const vs=d=>c.getDatasetMeta(d).data.map(p=>p._view).filter(v=>!v.skip&&v.x>A.left+20&&v.x<A.right-20);
            const rain=vs(0), near=x=>rain.reduce((b,v)=>Math.abs(v.x-x)<Math.abs(b.x-x)?v:b), tank=vs(1);
            // (where both curves are nearly flat — so the gap is vertical — 15 to 30 px apart)
            const k=tank.findIndex((v,i)=>i>0&&i<tank.length-1&&Math.abs(tank[i+1].y-tank[i-1].y)<1.5&&Math.abs(v.y-near(v.x).y)>15&&Math.abs(v.y-near(v.x).y)<30);
            if( k<0 ) return null; const v=tank[k], w=near(v.x);
            return {x:r.left+v.x, y:r.top+v.y+(w.y-v.y)*${f}}; })()`);
        const p1 = await at(0.3), p2 = await at(0.45);
        if( !p1 ) return 'no place where both curves are flat and 15 to 30 px apart';
        await t.longPress(p1); const a = await dots(t, 2, 1); await t.longPress(p1);
        await t.longPress(p2); const b = [await dots(t, 2, 0), await dots(t, 2, 1)];
        return shown(a) && b[0].r === 0 && b[1].r === 0 ? true : JSON.stringify({ a, b });
    });
    await t.step('two curves exactly on top of each other: the one drawn over', async () => {
        const p = await t.E(`(()=>{ const c=graphAt(3).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect();
            const v=c.getDatasetMeta(1).data.map(p=>p._view).find(v=>!v.skip&&v.x>A.left+40&&v.y>A.top+30&&v.y<A.bottom-30); return {x:r.left+v.x, y:r.top+v.y}; })()`);
        await t.longPress(p); const a = await dots(t, 3, 0), b = await dots(t, 3, 1); await t.longPress(p);
        return shown(a) && b.r === 0 ? true : JSON.stringify({ a, b });
    });
    await t.step('clearly beside the curves, nothing', async () => {
        await t.longPress(await beside(t, 0)); const d = await dots(t, 0); const menu = await menuOpen(t);
        return d.r === 0 && !menu ? true : JSON.stringify({ d, menu });
    });
    // (the Points switch of the open menu's Appearance submenu: its line, its state)
    const pointsLine = `[...el.querySelectorAll('#et_0_appearance_sub a')].find(a=>a.textContent==='Points')`;
    await t.step('Appearance ▸ Points, a switch, in a curve\'s menu: on, the dots shown; again, off, hidden', async () => {
        const open = async () => { await t.longPress(await t.E('legendPt(0,0)')); await t.E(`el.querySelector('#et_0_appearance').click()`); await t.wait(300); };
        await open(); const s1 = await t.E(`${pointsLine}.getAttribute('aria-checked')`);
        await t.E(`${pointsLine}.click()`); await t.wait(800); const on = await dots(t, 0);
        await open(); const s2 = await t.E(`${pointsLine}.getAttribute('aria-checked')`);
        await t.E(`${pointsLine}.click()`); await t.wait(800); const off = await dots(t, 0);
        return s1 === 'false' && s2 === 'true' && shown(on) && off.r === 0 ? true : JSON.stringify({ s1, s2, on, off });
    });
    await t.step('Appearance ▸ Points, in a graph\'s menu: every curve of the graph', async () => {
        await t.longPress(await t.E('moPt(1)'));
        await t.E(`el.querySelector('#et_0_appearance').click()`); await t.wait(300);
        await t.E(`${pointsLine}.click()`); await t.wait(800);
        const a = await dots(t, 1, 0), b = await dots(t, 1, 1);
        return shown(a) && shown(b) && a.saved && b.saved ? true : JSON.stringify({ a, b });
    });
    // The tooltip of graph gi: its text, else null
    const tip = gi => t.E(`(()=>{ const el=graphAt(${gi}).chart.tooltip._hecHoverTooltipEl; return el && el.isConnected && getComputedStyle(el).display!=='none' && getComputedStyle(el).opacity!=='0' ? el.textContent : null; })()`);
    // 3 px above a value of curve k of graph 1, far from the other curve
    const nearCurve = k => t.E(`(()=>{ const c=graphAt(1).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect();
        const vs=d=>c.getDatasetMeta(d).data.map(p=>p._view).filter(v=>!v.skip&&!v.hecVirtual&&v.x>A.left+40&&v.x<A.right-40);
        const o=vs(1-${k}), yOf=x=>o.reduce((b,v)=>Math.abs(v.x-x)<Math.abs(b.x-x)?v:b).y, m=vs(${k});
        const v=m.find(v=>Math.abs(v.y-yOf(v.x))>30);
        return {x:r.left+v.x, y:r.top+v.y-3}; })()`);
    await t.step('a click near a value of a curve: its tooltip only; near a value of the other one: both', async () => {
        await t.page.mouse.click(...Object.values(await nearCurve(1))); await t.wait(400);
        const one = await tip(1);
        await t.page.mouse.click(...Object.values(await nearCurve(0))); await t.wait(400);
        const two = await tip(1);
        return /tank/.test(one || '') && !/rain/.test(one || '') && /tank/.test(two || '') && /rain/.test(two || '') ? true : `${one} / ${two}`;
    });
    await t.step('a click beside the curves changes nothing; leaving the plot area ends the tooltip mode', async () => {
        await t.page.mouse.click(...Object.values(await beside(t, 1))); await t.wait(400);
        const kept = await tip(1);
        const y = await t.E('yaPt(1,0.5)'); await t.page.mouse.move(y.x, y.y, { steps: 10 }); await t.wait(1300);
        const r = { kept, gone: await tip(1), curves: await t.E('graphAt(1).chart._hecTooltipCurves') };
        return /tank/.test(kept || '') && /rain/.test(kept || '') && r.gone === null && !r.curves ? true : JSON.stringify(r);
    });
    await t.step('the tooltip stands as far from the point on its left as on its right', async () => {
        const gap = async f => {
            const p = await t.E(`pointPt(0,${f})`); await t.page.mouse.click(p.x, p.y); await t.wait(400);
            const r = await t.E(`(()=>{ const b=document.getElementById('hec-tooltip-hover').getBoundingClientRect(), c=graphAt(0).chart, v=c.tooltip._view;
                const x=c.canvas.getBoundingClientRect().left+v.caretX; return { side: v.xAlign, gap: Math.round(v.xAlign==='left' ? b.left-x : x-b.right) }; })()`);
            // (until it has faded out, its reading time over)
            await t.page.mouse.move(5, 5); for( let i = 0; i < 40 && await tip(0) !== null; i++ ) await t.wait(200);
            return r;
        };
        // (a point whose tooltip stands beside it, on either side — above or below a peak it
        // stands under or over it, the data following the time of day)
        const beside = async (fs, side) => { let r; for( const f of fs ) { r = await gap(f); if( r.side === side ) break; } return r; };
        const right = await beside([0.15, 0.2, 0.25, 0.3, 0.1], 'left'), left = await beside([0.95, 0.9, 0.85, 0.97, 0.8], 'right');
        return right.side === 'left' && left.side === 'right' && right.gap > 0 && Math.abs(right.gap - left.gap) <= 1 ? true : JSON.stringify({ right, left });
    });
    await t.step('the tooltip\'s arrow points at the point, also when the tooltip is moved to stay within the screen', async () => {
        // (a tooltip centered under or over a point 20 px from the screen's right edge, or
        // beside one 20 px from its bottom: moved back inside — the arrow never in its
        // rounded corners)
        const at = (xAlign, yAlign, x, y) => t.E(`(()=>{ const c=graphAt(0).chart, tt=c.tooltip;
            tt._hecShowTooltip('a long enough text for the tooltip to be moved', 0, 0, c.canvas, '#333', null, '#fff',
                { size: 5, xAlign: '${xAlign}', yAlign: '${yAlign}', cornerRadius: 6, borderWidth: 0, padding: 8, x: ${x}, y: ${y} }, true, null);
            const e=document.getElementById('hec-tooltip-hover'), a=[...e.children].pop().getBoundingClientRect(), b=e.getBoundingClientRect();
            const r={ moved: '${yAlign}'==='center' ? b.bottom <= innerHeight + 1 : b.right <= innerWidth + 1,
                      off: Math.round('${yAlign}'==='center' ? Math.abs(a.top+a.height/2-${y}) : Math.abs(a.left+a.width/2-${x})) };
            tt._hecCloseTooltip(); return r; })()`);
        const h = await t.E('innerHeight'), w = await t.E('innerWidth');
        const r = [await at('center', 'top', w - 20, 300), await at('center', 'bottom', w - 20, 300), await at('left', 'center', 300, h - 20), await at('center', 'top', 200, 300)];
        return r.every(x => x.moved && x.off <= 1) ? true : JSON.stringify(r);
    });
    await t.step('a tooltip wider than a narrow card (168 px): within the screen, not pushed out on the card\'s other side', async () => {
        await t.E(`(()=>{ document.body.style.width='168px'; document.getElementById('host').style.width='168px'; })()`); await t.wait(1500);
        const r = [];
        for( const f of [0.1, 0.5, 0.9] ) {
            const p = await t.E(`pointPt(0,${f})`); await t.page.mouse.click(p.x, p.y); await t.wait(400);
            r.push(await t.E(`(()=>{ const e=document.getElementById('hec-tooltip-hover'); if( !e || getComputedStyle(e).opacity==='0' ) return null; const b=e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right), innerWidth]; })()`));
            await t.page.mouse.move(5, 5); for( let i = 0; i < 40 && await tip(0) !== null; i++ ) await t.wait(200);
        }
        await t.E(`(()=>{ document.body.style.width=''; document.getElementById('host').style.width=''; })()`); await t.wait(1500);
        return r.every(x => x && x[0] >= 0 && x[1] <= x[2]) ? true : JSON.stringify(r);
    });
    await t.step('a menu opened while a curve\'s tooltip shows (the options menu, the entity selector): the tooltip closes, its mode ends', async () => {
        const open = async how => {
            const p = await t.E('pointPt(0,0.4)'); await t.page.mouse.click(p.x, p.y); await t.wait(400);
            const before = await tip(0);
            await t.E(how); await t.wait(400);
            const r = { before: !!before, after: await tip(0), mode: await t.E('!!graphAt(0).chart._hecTooltipMode') };
            await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.page.mouse.click(5, 5); await t.wait(400);
            return r;
        };
        const options = await open(`el.querySelector('#bo_0').click()`);
        const selector = await open(`(()=>{ const i=el.querySelector('#b7_0'); i.focus(); i.value='sensor'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
        const ok = r => r.before && r.after === null && !r.mode;
        return ok(options) && ok(selector) ? true : JSON.stringify({ options, selector });
    });
    // The value whose dot a hover shows on graph gi: [dataset, index], or null
    const hoverDot = gi => t.E(`(()=>{ const d=graphAt(${gi}).chart._hecHoverDot; return d ? [d._datasetIndex, d._index] : null; })()`);
    await t.step('a hover (no click) on a value of a curve without points shows its dot only — no tooltip; beside it, none', async () => {
        await t.page.mouse.move(5, 5); await t.wait(300);
        const p = await t.E(`(()=>{ const c=graphAt(0).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect();
            const v=c.getDatasetMeta(0).data.map(p=>p._view).filter(v=>!v.skip&&v.x>A.left+40&&v.y>A.top+30&&v.y<A.bottom-30)[3]; return {x:r.left+v.x, y:r.top+v.y}; })()`);
        await t.page.mouse.move(p.x - 30, p.y, { steps: 3 }); await t.page.mouse.move(p.x + 1, p.y + 1, { steps: 5 }); await t.wait(300);
        const on = await hoverDot(0), tooltip = await tip(0);
        const b = await beside(t, 0); await t.page.mouse.move(b.x, b.y, { steps: 5 }); await t.wait(300);
        const off = await hoverDot(0);
        return on && on[0] === 0 && tooltip === null && off === null ? true : JSON.stringify({ on, tooltip, off });
    });
    await t.step('the hover dot is drawn as a point shown: the same size, its border too', async () => {
        await t.page.mouse.move(5, 5); await t.wait(300);
        const p = await t.E(`(()=>{ const c=graphAt(0).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect();
            const v=c.getDatasetMeta(0).data.map(p=>p._view).filter(v=>!v.skip&&v.x>A.left+40&&v.y>A.top+30&&v.y<A.bottom-30)[4]; return {x:r.left+v.x, y:r.top+v.y}; })()`);
        // (the pixels drawn — not the background — within 8 px of the value, on the canvas)
        const inked = () => t.E(`(()=>{ const c=graphAt(0).chart, r=c.canvas.getBoundingClientRect(), k=c.canvas.width/r.width;
            const d=c.ctx.getImageData(Math.round((${p.x}-r.left)*k)-8, Math.round((${p.y}-r.top)*k)-8, 17, 17).data;
            let n=0; for(let i=0;i<d.length;i+=4) if(d[i+3]>40 && d[i]+d[i+1]+d[i+2]<600) n++; return n; })()`);
        await t.page.mouse.move(p.x - 30, p.y, { steps: 3 }); await t.page.mouse.move(p.x + 1, p.y + 1, { steps: 5 }); await t.wait(300);
        const dot = await hoverDot(0), hovered = await inked();
        await t.longPress(p); const b = await beside(t, 0); await t.page.mouse.move(b.x, b.y, { steps: 5 }); await t.wait(1300);
        const shownPt = await inked(); await t.longPress(p); await t.page.mouse.move(b.x, b.y, { steps: 3 }); await t.wait(1300);
        return dot && Math.abs(hovered - shownPt) <= 3 ? true : JSON.stringify({ dot, hovered, shownPt });
    });
    await t.step('no hover dot on the tooltip\'s own point (drawn larger), nor on a curve showing its points', async () => {
        const p = await t.E(`(()=>{ const c=graphAt(0).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect();
            const v=c.getDatasetMeta(0).data.map(p=>p._view).filter(v=>!v.skip&&v.x>A.left+40&&v.y>A.top+30&&v.y<A.bottom-30)[6]; return {x:r.left+v.x, y:r.top+v.y}; })()`);
        await t.page.mouse.click(p.x, p.y); await t.wait(300); await t.page.mouse.move(p.x + 1, p.y, { steps: 3 }); await t.wait(300);
        const inMode = await hoverDot(0);
        const y = await t.E('yaPt(0,0.5)'); await t.page.mouse.move(y.x, y.y, { steps: 5 }); await t.wait(1300);
        await t.longPress(p); await t.page.mouse.move(p.x + 1, p.y, { steps: 3 }); await t.wait(300);
        const withPoints = await hoverDot(0); await t.longPress(p);
        return inMode === null && withPoints === null ? true : JSON.stringify({ inMode, withPoints });
    });
    await t.step('Alt held: the samples drawn with a diameter of the line width + 2 px', async () => {
        const p = await t.E('graphPtAt(0,0.5)');
        await t.page.keyboard.down('Alt'); await t.page.mouse.move(p.x, p.y, { steps: 5 }); await t.wait(400);
        const R = await t.E(`(graphAt(0).chart.data.datasets[0].borderWidth+2)/2`);
        const r = await t.E(`(()=>{ const c=graphAt(0).chart; return c.getDatasetMeta(0).data.map(p=>p._model.radius).filter(x=>x>0); })()`);
        await t.page.keyboard.up('Alt'); await t.page.mouse.move(p.x, p.y + 3); await t.wait(300);
        return r.length && r.every(x => near(x, R)) ? true : JSON.stringify(r.slice(0, 5));
    });
    // A value of curve 0 of graph gi, in the middle of the plot's height: its point
    const valuePt = (gi, k) => t.E(`(()=>{ const c=graphAt(${gi}).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect();
        const ps=c.getDatasetMeta(0).data.filter(p=>!p._view.skip&&p._view.x>A.left+40&&p._view.y>A.top+30&&p._view.y<A.bottom-30); const p=ps[${k}];
        return {x:r.left+p._view.x, y:r.top+p._view.y, i:p._index}; })()`);
    // The radius of value i of curve 0 of graph gi, and the radius of the points shown
    const radius = (gi, i) => t.E(`(()=>{ const c=graphAt(${gi}).chart, d=c.data.datasets[0]; return { r: c.getDatasetMeta(0).data[${i}]._model.radius, R: (d.borderWidth+2)/2 }; })()`);
    // Clicked, then left still until the tooltip's reading time is over: the point clicked
    const afterReading = async (gi, k) => {
        const p = await valuePt(gi, k); await t.page.mouse.click(p.x, p.y); await t.wait(300);
        const hovered = await radius(gi, p.i);
        const ms = await t.E(`graphAt(${gi}).chart.constructor.hecUi.readingTime(graphAt(${gi}).chart.tooltip._hecHoverTooltipEl.textContent)`);
        await t.wait(ms + 1500);
        return { hovered, after: await radius(gi, p.i) };
    };
    const small = r => r.after.r === r.after.R && r.hovered.r === r.hovered.R + 1;
    await t.step('points shown — by a long-press, or Alt: once the tooltip\'s reading time is over, the point clicked is small again, not gone', async () => {
        const y = await t.E('yaPt(0,0.5)'); await t.page.mouse.move(y.x, y.y, { steps: 5 }); await t.wait(1300);
        const p = await valuePt(0, 2); await t.longPress(p);
        const long = await afterReading(0, 4);
        await t.page.mouse.move(y.x, y.y, { steps: 5 }); await t.wait(1300); await t.longPress(p);
        await t.page.keyboard.down('Alt'); const alt = await afterReading(0, 6); await t.page.keyboard.up('Alt');
        await t.page.mouse.move(y.x, y.y, { steps: 5 }); await t.wait(1300);
        return small(long) && small(alt) ? true : JSON.stringify({ long, alt });
    });
    await t.step('Alt held: the points stay over the Y axis and the legend, go once the pointer leaves the graph', async () => {
        const shownN = () => t.E(`graphAt(0).chart.getDatasetMeta(0).data.filter(p=>p._model.radius>0).length`);
        const p = await valuePt(0, 3), y = await t.E('yaPt(0,0.5)'), l = await t.E('legendPt(0,0)');
        await t.page.keyboard.down('Alt');
        await t.page.mouse.move(p.x + 30, p.y + 30, { steps: 5 }); await t.wait(200); const inPlot = await shownN();
        await t.page.mouse.move(y.x, y.y, { steps: 8 }); await t.wait(200); const onAxis = await shownN();
        await t.page.mouse.move(l.x, l.y, { steps: 8 }); await t.wait(200); const onLegend = await shownN();
        const out = await t.E(`(()=>{ const r=graphAt(0).canvas.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom + 40 }; })()`);
        await t.page.mouse.move(out.x, out.y, { steps: 8 }); await t.wait(300); const outside = await shownN();
        await t.page.keyboard.up('Alt');
        return inPlot > 10 && onAxis === inPlot && onLegend === inPlot && outside === 0 ? true : JSON.stringify({ inPlot, onAxis, onLegend, outside });
    });
    await t.step('Alt held, from a graph to the one above, leaving it from its legend: the points leave the graph left', async () => {
        // (graph 1's points are shown already, from its menu: Alt's own showing is what's looked at)
        const n = gi => t.E(`graphAt(${gi}).chart._hecShowSamples ? 1 : 0`);
        const p1 = await t.E('graphPtAt(1,0.6)'), l1 = await t.E('legendPt(1,0)'), p0 = await t.E('graphPtAt(0,0.6)');
        await t.page.keyboard.down('Alt');
        await t.page.mouse.move(p1.x, p1.y, { steps: 5 }); await t.wait(200); const below = await n(1);
        await t.page.mouse.move(l1.x, l1.y, { steps: 8 }); await t.wait(200);
        // (in one move, as a quick hand does: from the legend straight out of the graph)
        await t.page.mouse.move(p0.x, p0.y, { steps: 1 }); await t.wait(300); const r = { below, left: await n(1), above: await n(0) };
        await t.page.keyboard.up('Alt');
        return r.below === 1 && r.left === 0 && r.above === 1 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── Points shown from the YAML ──
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false },
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power', showPoints: true }] }] }, { mock: { series: true }, clock: CLOCK });
    await t.wait(800);
    await t.step('points shown by the YAML: once the tooltip\'s reading time is over, the point clicked is small again', async () => {
        const r = await afterReading(0, 4);
        return small(r) ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The YAML and the long-press: the last one to speak wins ──
    const yamlCard = sp => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, enable_persistence: 'entities',
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power', showPoints: sp }] }] });
    t = await openCard(yamlCard(true), { mock: { series: true }, clock: CLOCK });
    await t.wait(800);
    await t.step('showPoints: true in the YAML, hidden by a long-press: still hidden after a reload; the YAML changed (showPoints: 4): shown, radius 4', async () => {
        const p = await valuePt(0, 3); await t.longPress(p);
        const hidden = (await dots(t, 0)).r;
        await t.page.reload(); await t.wait(3500); const reloaded = (await dots(t, 0)).r;
        const name = await t.E('window.CFG.cardName');
        await t.page.addInitScript(c => { window.CFG = c; }, { ...yamlCard(4), cardName: name });
        await t.page.reload(); await t.wait(3500); const yaml = (await dots(t, 0)).r;
        return hidden === 0 && reloaded === 0 && yaml === 4 ? true : JSON.stringify({ hidden, reloaded, yaml });
    });
    done(await t.close());

    // ── Saved on this device only ──
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false } }, { mock: { series: true }, clock: CLOCK });
    await t.wait(800);
    await t.step('a curve added from the card, its points shown by a long-press: kept after a reload, not on another device', async () => {
        await t.E(`(()=>{ const I=el.instance; I.addCurves(['sensor.power'], 'line', 'curves'); })()`); await t.wait(1500);
        const p = await valuePt(0, 3); await t.longPress(p);
        const shown = (await dots(t, 0)).r > 0;
        await t.page.reload(); await t.wait(3500); const reloaded = (await dots(t, 0)).r > 0;
        await t.E('localStorage.clear()'); await t.page.reload(); await t.wait(3500);
        const other = await dots(t, 0);
        return shown && reloaded && other.r === 0 ? true : JSON.stringify({ shown, reloaded, other });
    });
    done(await t.close());

    // ── With a finger ──
    t = await openCard(card(), { touch: true, mock: { series: true }, clock: CLOCK });
    await t.wait(800);
    await t.step('a long-press of a finger on a curve shows its dots; again, hides them', async () => {
        const p = await t.E('pointPt(0,0.5)');
        await t.touchLongPress(p); const on = await dots(t, 0);
        await t.touchLongPress(p); const off = await dots(t, 0);
        return shown(on) && off.r === 0 ? true : JSON.stringify({ on, off });
    });
    done(await t.close());

    // ── The hover dot: the curve the pointer is on, then its value nearest the pointer (the
    // tooltip of the curves selected: a hover alone shows the dot alone) ──
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '1', statistics: { enabled: false }, largeScreenTooltip: 'selected',
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }] }] }, { mock: { series: true }, clock: CLOCK });
    await t.step('a hover on a curve between two values far apart: the dot of the one nearest the pointer', async () => {
        // (a point of the drawn path, a third of the way from a value to the next, away from both)
        const p = await t.E(`(()=>{ const c=graphAt(0).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect(), m=c.getDatasetMeta(0).data;
            const real=m.map((q,i)=>({v:q._view,i})).filter(o=>!o.v.skip&&!o.v.hecVirtual&&o.v.x>A.left&&o.v.x<A.right);
            const k=real.findIndex((o,j)=>j+1<real.length&&real[j+1].v.x-o.v.x>60); if(k<0) return null;
            const a=real[k], b=real[k+1], x=a.v.x+(b.v.x-a.v.x)/3;
            const path=m.map(q=>q._view).filter(v=>!v.skip).sort((u,w)=>u.x-w.x); const j=path.findIndex(v=>v.x>=x); const u=path[j-1], w=path[j];
            const y=u.y+(w.y-u.y)*(x-u.x)/(w.x-u.x);
            return { x: r.left+x, y: r.top+y, a: a.i, gap: Math.round(b.v.x-a.v.x), da: Math.round(Math.hypot(a.v.x-x, a.v.y-y)) }; })()`);
        if( !p ) return 'no values far apart';
        await t.page.mouse.move(p.x, p.y - 30, { steps: 3 }); await t.page.mouse.move(p.x, p.y, { steps: 4 }); await t.wait(300);
        const d = await hoverDot(0);
        return d && d[0] === 0 && d[1] === p.a && p.da > 15 ? true : JSON.stringify({ p, d });
    });
    done(await t.close());

    // ── On a stepped curve, the plateau of a value, nearer the next value's time than its own:
    // the hover dot on that value — the curve's point nearest the pointer in X and Y, however
    // far —; a click, far from both values: the curve selected, no tooltip (a tooltip shows
    // points only) ──
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '1', statistics: { enabled: false }, largeScreenTooltip: 'selected',
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power', lineMode: 'stepped' }] }] },
        { mock: { series: true, rows: { 'sensor.power': [[3000, '100'], [2400, '900'], [1800, '100'], [1200, '900'], [600, '100']] } }, clock: CLOCK });
    await t.wait(800);
    await t.step('a stepped curve, a hover on a value\'s plateau nearer the next value\'s time: the dot on that value; a click there, far from both values: no tooltip', async () => {
        // (a value and the next, far apart in time and further apart in Y; the plateau 60 % of the way)
        const p = await t.E(`(()=>{ const c=graphAt(0).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect(), m=c.getDatasetMeta(0).data;
            const real=m.map((q,i)=>({v:q._view,i})).filter(o=>!o.v.skip&&!o.v.hecVirtual&&o.v.x>A.left+40&&o.v.x<A.right-40);
            const k=real.findIndex((o,j)=>j+1<real.length&&real[j+1].v.x-o.v.x>20&&Math.abs(real[j+1].v.y-o.v.y)>0.6*(real[j+1].v.x-o.v.x)); if(k<0) return null;
            const a=real[k], b=real[k+1];
            return { x: r.left+a.v.x+0.6*(b.v.x-a.v.x), y: r.top+a.v.y, a: a.i, b: b.i }; })()`);
        if( !p ) return 'no values far apart';
        await t.page.mouse.move(p.x, p.y - 30, { steps: 3 }); await t.page.mouse.move(p.x, p.y, { steps: 4 }); await t.wait(400);
        const d = await hoverDot(0);
        await t.page.mouse.click(p.x, p.y); await t.wait(400);
        const tip = await t.E('graphAt(0).chart.active.map(a=>a._index)');
        return d && d[1] === p.a && !tip.length ? true : JSON.stringify({ p, d, tip });
    });
    done(await t.close());

    // ── A tooltip shows points — real values, never a curve's path between them. Values an
    // hour apart: power at 50, 40, 30, 20 and 10 min ago, rain at 50, 35 and 20 min ago ──
    const sparse = (mode, o = {}) => openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '1', statistics: { enabled: false }, largeScreenTooltip: mode,
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power' }, { entity: 'sensor.rain', scale: 100 }] }] },
        { mock: { series: true, rows: { 'sensor.power': [[3000, '100'], [2400, '900'], [1800, '100'], [1200, '900'], [600, '100']],
                                        'sensor.rain': [[3000, '2'], [2100, '6'], [1200, '2']] } }, clock: CLOCK, ...o });
    // (curve d's values: their points; the middle of its path between its values j and j + 1)
    const vals = d => t.E(`(()=>{ const c=graphAt(0).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect();
        return c.getDatasetMeta(${d}).data.filter(p=>!p._view.skip&&!p._view.hecVirtual&&p._view.x>=A.left&&p._view.x<=A.right).map(p=>({ x: r.left+p._view.x, y: r.top+p._view.y, i: p._index })); })()`);
    const mid = (a, b, f = 0.5) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
    const activeAt = () => t.E('graphAt(0).chart.active.map(a=>[a._datasetIndex, a._index])');
    const fade = async () => { for( let i = 0; i < 60 && await tip(0) !== null; i++ ) await t.wait(250); return tip(0); };
    t = await sparse('selected');
    await t.wait(800);
    await t.step('a click on a curve\'s path, far from its values: the curve selected, no tooltip, the dot of its value nearest (as a hover shows it)', async () => {
        const v = await vals(0), p = mid(v[1], v[2], 0.3);
        await t.page.mouse.click(p.x, p.y); await t.wait(400);
        const r = { far: Math.round(Math.hypot(v[1].x - p.x, v[1].y - p.y)), curves: await t.E('graphAt(0).chart._hecTooltipCurves'), tip: await tip(0), dot: await hoverDot(0) };
        return r.far > 30 && r.curves && r.curves.includes(0) && r.tip === null && r.dot && r.dot[1] === v[1].i ? true : JSON.stringify(r);
    });
    done(await t.close());
    t = await sparse('selected', { touch: true });
    await t.wait(800);
    await t.step('a finger (no hover): a tap on a curve\'s path, far from its values, shows the dot of its value nearest — as a hover would — and no tooltip; a tap on that value, its tooltip', async () => {
        const v = await vals(0), p = mid(v[1], v[2], 0.3);
        await t.tap(p); await t.wait(500);
        const dot = await hoverDot(0), none = await tip(0);
        await t.tap(v[1]); await t.wait(500);
        const on = await activeAt();
        return dot && dot[1] === v[1].i && none === null && JSON.stringify(on) === JSON.stringify([[0, v[1].i]]) ? true : JSON.stringify({ dot, none, on });
    });
    done(await t.close());
    t = await sparse('nearest');
    await t.wait(800);
    await t.step('nearest: a hover on a curve\'s path, far from its values: nothing', async () => {
        const v = await vals(0), p = mid(v[1], v[2]);
        await t.page.mouse.move(p.x, p.y - 40, { steps: 3 }); await t.page.mouse.move(p.x, p.y, { steps: 4 }); await t.wait(400);
        const r = { tip: await tip(0), mode: await t.E('!!graphAt(0).chart._hecTooltipMode'), curves: await t.E('graphAt(0).chart._hecTooltipCurves || null') };
        return r.tip === null && !r.mode && !r.curves ? true : JSON.stringify(r);
    });
    await t.step('nearest: a tooltip on a value (no dot on it), then the pointer far from every value: the tooltip stays on it, then fades out after its reading time; the dot on the value nearest the pointer', async () => {
        const v = await vals(0);
        await t.page.mouse.move(v[1].x + 1, v[1].y - 1, { steps: 5 }); await t.wait(400);
        const on = await activeAt(), open = await tip(0);
        const onDot = await hoverDot(0);
        const p = mid(v[1], v[2], 0.7); await t.page.mouse.move(p.x, p.y, { steps: 6 }); await t.wait(300);
        const kept = await activeAt(), dot = await hoverDot(0), gone = await fade();
        // (on the tooltip's point, no dot — it's drawn larger; far from it, the dot of the value nearest)
        return JSON.stringify(on) === JSON.stringify([[0, v[1].i]]) && open && onDot === null && JSON.stringify(kept) === JSON.stringify(on) && dot && dot[1] === v[2].i && gone === null ? true : JSON.stringify({ on, open, onDot, kept, dot, gone });
    });
    done(await t.close());
    // ── The tooltip's side beside its point: behind the pointer's move, decided when it shows a
    // new point (the gesture engine's direction); a finger: the half of the plot it's in ──
    const side = () => t.E('graphAt(0).chart.tooltip._view.xAlign');
    t = await sparse('nearest');
    await t.wait(800);
    await t.step('a hover reaching a value moving rightward: the tooltip on its left; a move back while on it changes nothing; the next value reached moving leftward: the tooltip on its right', async () => {
        const v = await vals(0);
        await t.page.mouse.move(v[1].x - 120, v[1].y - 60); await t.page.mouse.move(v[1].x, v[1].y - 1, { steps: 12 }); await t.wait(400);
        const right = await side(), on = await activeAt();
        await t.page.mouse.move(v[1].x - 5, v[1].y - 1, { steps: 3 }); await t.wait(300);
        const back = await side();
        await t.page.mouse.move(v[2].x + 120, v[2].y - 60, { steps: 12 }); await t.page.mouse.move(v[2].x, v[2].y - 1, { steps: 12 }); await t.wait(400);
        const left = await side(), on2 = await activeAt();
        // (xAlign 'right': the box's right edge at the point — the tooltip on the point's left)
        return right === 'right' && on[0][1] === v[1].i && back === 'right' && left === 'left' && on2[0][1] === v[2].i ? true : JSON.stringify({ right, back, left, on, on2 });
    });
    done(await t.close());
    t = await sparse('selected', { touch: true });
    await t.wait(800);
    await t.step('a finger (no hover, no direction): the tooltip beside its point as the half of the plot it\'s in says', async () => {
        const v = await vals(0);
        const r = [];
        for( const p of [v[0], v[v.length - 1]] ) {
            await t.tap(p); await t.wait(500);
            r.push({ side: await side(), left: await t.E(`(()=>{ const c=graphAt(0).chart, A=c.chartArea; return ${p.x} - c.canvas.getBoundingClientRect().left <= (A.left + A.right) / 2; })()`) });
        }
        // (the left half: the tooltip on the point's right — xAlign 'left')
        return r.every(x => x.side === (x.left ? 'left' : 'right')) ? true : JSON.stringify(r);
    });
    done(await t.close());
    t = await sparse('all');
    await t.wait(800);
    await t.step('all: on a value, the other curve\'s value at the same time joins it; one a few minutes away (beyond the picking margin along the time axis) doesn\'t', async () => {
        const v = await vals(0), w = await vals(1);
        const at = async p => { await t.page.mouse.move(p.x + 1, p.y - 1, { steps: 5 }); await t.wait(400); const r = await activeAt(); await t.page.mouse.move(p.x + 1, p.y - 120, { steps: 3 }); await fade(); return r; };
        // (power 50 min ago: rain then too; power 40 min ago: rain 35 min ago, 5 min away)
        const same = await at(v[0]), apart = await at(v[1]);
        const r = { same, apart, dx: Math.round(Math.abs(w[1].x - v[1].x)) };
        return same.length === 2 && same.some(a => a[0] === 1) && apart.length === 1 && apart[0][0] === 0 && r.dx > 8 ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The tooltip's modes (largeScreenTooltip: this screen is a large one): which curves it
    // shows, opened by a hover or a click (whatever the pointer: the gesture engine's one click),
    // never acted on by a drag. Graph 1: rain and tank; near tank, away from rain ──
    // (each mode: what the tooltip shows near tank — a hover, a click; then a hover near rain
    // after that click)
    const MODES = {
        selected: { hover: [], click: ['tank'], thenRain: ['tank'] },
        nearest:  { hover: ['tank'], click: ['tank'], thenRain: ['rain'] },
        // (tank selected by the click, rain the nearest one)
        mixed:    { hover: ['tank'], click: ['tank'], thenRain: ['tank', 'rain'] },
        all:      { hover: ['tank', 'rain'], click: ['tank', 'rain'], thenRain: ['tank', 'rain'] },
    };
    const shows = (text, names) => ['tank', 'rain'].every(n => names.includes(n) === new RegExp(n).test(text || ''));
    const leave = async () => { const y = await t.E('yaPt(1,0.5)'); await t.page.mouse.move(y.x, y.y, { steps: 10 }); await t.wait(1300); };
    for( const [mode, want] of Object.entries(MODES) ) {
        t = await openCard({ ...card(), largeScreenTooltip: mode }, { mock: { series: true }, clock: CLOCK });
        await t.wait(800);
        await t.step(`${mode}: a hover near a curve shows ${want.hover.join(' and ') || 'nothing'}`, async () => {
            const p = await nearCurve(1); await t.page.mouse.move(p.x, p.y - 40, { steps: 3 }); await t.page.mouse.move(p.x, p.y, { steps: 4 }); await t.wait(400);
            const r = await tip(1); await leave();
            return shows(r, want.hover) ? true : String(r);
        });
        await t.step(`${mode}: a click near a curve shows ${want.click.join(' and ')}; then a hover near the other one: ${want.thenRain.join(' and ')}`, async () => {
            await t.page.mouse.click(...Object.values(await nearCurve(1))); await t.wait(400);
            const clicked = await tip(1);
            const q = await nearCurve(0); await t.page.mouse.move(q.x, q.y, { steps: 8 }); await t.wait(400);
            const moved = await tip(1); await leave();
            return shows(clicked, want.click) && shows(moved, want.thenRain) ? true : `${clicked} / ${moved}`;
        });
        await t.step(`${mode}: a drag doesn't act on the tooltip — what a hover near a curve opened (${want.hover.join(' and ') || 'nothing'}) stays as it is, during the drag and after it (the curves move, the tooltip with them)`, async () => {
            const p = await nearCurve(1); await t.page.mouse.move(p.x, p.y - 40, { steps: 3 }); await t.page.mouse.move(p.x, p.y, { steps: 4 }); await t.wait(400);
            // (30 px: the point stays within the plot — nearCurve's is 40 px at least from its edges)
            await t.page.mouse.down(); await t.page.mouse.move(p.x - 30, p.y, { steps: 8 }); await t.wait(300);
            const during = await tip(1); await t.page.mouse.up(); await t.wait(600);
            const after = await tip(1); await leave();
            return shows(during, want.hover) && shows(after, want.hover) ? true : `${during} / ${after}`;
        });
        done(await t.close());
    }

    return { passed, failed };
};
