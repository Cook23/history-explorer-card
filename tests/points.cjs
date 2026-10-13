// A gesture on a curve — the nearest one, picked as a label is: a click or a tap puts it in the
// tooltip mode (several curves can be), a long-press (a right click) shows or hides its
// samples' dots, as the Layout submenu of its menu or of its
// graph's; every dot shown by default of a diameter of the line width + 2 px (Alt's too), the
// hovered one 2 px wider
const { openCard } = require('./lib.cjs');

const card = () => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false },
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
    const dots = (t, gi, k = 0) => t.E(`(()=>{ const g=el.instance._allGraphsInDisplayOrder()[${gi}];
        const d=g.chart.data.datasets[${k}]; return { r: d.pointRadius, R: (d.borderWidth+2)/2, hover: d.pointHoverRadius, saved: g.entities[${k}].showPoints }; })()`);
    const shown = d => near(d.r, d.R) && near(d.hover, d.R + 1);
    const menuOpen = t => t.E(`el.querySelector('#et_0').style.display !== 'none'`);
    const closeMenu = async t => { await t.page.keyboard.press('Escape'); await t.page.keyboard.press('Escape'); await t.wait(300); };
    // A point of graph gi's plot area clearly beside every curve: above or below them at x
    const beside = (t, gi) => t.E(`(()=>{ const c=graphAt(${gi}).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect(), x=(A.left+A.right)/2;
        const ys=c.data.datasets.flatMap((d,i)=>c.getDatasetMeta(i).data.map(p=>p._view)).filter(v=>!v.skip&&Math.abs(v.x-x)<40).map(v=>v.y);
        const y=Math.min(...ys)-A.top > A.bottom-Math.max(...ys) ? A.top+4 : A.bottom-4; return {x:r.left+x, y:r.top+y}; })()`);

    // ── With a mouse ──
    let t = await openCard(card(), { mock: { series: true } });
    await t.wait(800);
    await t.step('a long-press on a curve shows its dots, its diameter the line width + 2 px (hovered: + 2 more), saved; again, hides them', async () => {
        const p = await t.E('pointPt(0,0.5)');
        await t.longPress(p); const on = await dots(t, 0); const menu = await menuOpen(t);
        await t.longPress(p); const off = await dots(t, 0);
        return shown(on) && on.saved === true && !menu && off.r === 0 && off.saved === false ? true : JSON.stringify({ on, off, menu });
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
    await t.step('Layout ▸ Show the points, in a curve\'s menu; then Hide the points', async () => {
        const open = async () => { await t.longPress(await t.E('legendPt(0,0)')); await t.E(`el.querySelector('#et_0_layout').click()`); await t.wait(300); };
        await open(); const l1 = await t.E(`el.querySelector('#et_0_points').textContent`);
        await t.E(`el.querySelector('#et_0_points').click()`); await t.wait(400); const on = await dots(t, 0);
        await open(); const l2 = await t.E(`el.querySelector('#et_0_points').textContent`);
        await t.E(`el.querySelector('#et_0_points').click()`); await t.wait(400); const off = await dots(t, 0);
        return l1 === 'Show the points' && l2 === 'Hide the points' && shown(on) && off.r === 0 ? true : JSON.stringify({ l1, l2, on, off });
    });
    await t.step('Layout ▸ Show the points, in a graph\'s menu: every curve of the graph', async () => {
        await t.longPress(await t.E('moPt(1)'));
        await t.E(`el.querySelector('#et_0_points').click()`); await t.wait(400);
        const a = await dots(t, 1, 0), b = await dots(t, 1, 1);
        return shown(a) && shown(b) && a.saved && b.saved ? true : JSON.stringify({ a, b });
    });
    // The tooltip of graph gi: its text, else null
    const tip = gi => t.E(`(()=>{ const el=graphAt(${gi}).chart.tooltip._hecHoverTooltipEl; return el && el.isConnected && getComputedStyle(el).display!=='none' && getComputedStyle(el).opacity!=='0' ? el.textContent : null; })()`);
    // A point of curve k of graph 1 far from the other one, 3 px above the curve between two values
    const nearCurve = k => t.E(`(()=>{ const c=graphAt(1).chart, A=c.chartArea, r=c.canvas.getBoundingClientRect();
        const vs=d=>c.getDatasetMeta(d).data.map(p=>p._view).filter(v=>!v.skip&&v.x>A.left+40&&v.x<A.right-40);
        const o=vs(1-${k}), yOf=x=>o.reduce((b,v)=>Math.abs(v.x-x)<Math.abs(b.x-x)?v:b).y, m=vs(${k});
        const i=m.findIndex((v,i)=>i&&Math.abs(v.y-yOf(v.x))>30); const a=m[i-1], b=m[i];
        return {x:r.left+(a.x+b.x)/2, y:r.top+(a.y+b.y)/2-3}; })()`);
    await t.step('a click near a curve, not on a value: its tooltip only; near the other one: both', async () => {
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
    await t.step('no hover dot in the tooltip mode, nor on a curve showing its points', async () => {
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
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power', showPoints: true }] }] }, { mock: { series: true } });
    await t.wait(800);
    await t.step('points shown by the YAML: once the tooltip\'s reading time is over, the point clicked is small again', async () => {
        const r = await afterReading(0, 4);
        return small(r) ? true : JSON.stringify(r);
    });
    done(await t.close());

    // ── The YAML and the long-press: the last one to speak wins ──
    const yamlCard = sp => ({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false }, enable_persistence: 'entities',
        graphs: [{ type: 'line', entities: [{ entity: 'sensor.power', showPoints: sp }] }] });
    t = await openCard(yamlCard(true), { mock: { series: true } });
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
    t = await openCard({ type: 'custom:history-explorer-card', defaultTimeRange: '24', statistics: { enabled: false } }, { mock: { series: true } });
    await t.wait(800);
    await t.step('a curve added from the card, its points shown by a long-press: kept after a reload, not on another device', async () => {
        await t.E(`(()=>{ const I=el.instance; I._createAndPersistEntity('sensor.power', 'line', 'curves'); I.updateHistoryWithClearCache(); })()`); await t.wait(1500);
        const p = await valuePt(0, 3); await t.longPress(p);
        const shown = (await dots(t, 0)).r > 0;
        await t.page.reload(); await t.wait(3500); const reloaded = (await dots(t, 0)).r > 0;
        await t.E('localStorage.clear()'); await t.page.reload(); await t.wait(3500);
        const other = await dots(t, 0);
        return shown && reloaded && other.r === 0 ? true : JSON.stringify({ shown, reloaded, other });
    });
    done(await t.close());

    // ── With a finger ──
    t = await openCard(card(), { touch: true, mock: { series: true } });
    await t.wait(800);
    await t.step('a long-press of a finger on a curve shows its dots; again, hides them', async () => {
        const p = await t.E('pointPt(0,0.5)');
        await t.touchLongPress(p); const on = await dots(t, 0);
        await t.touchLongPress(p); const off = await dots(t, 0);
        return shown(on) && off.r === 0 ? true : JSON.stringify({ on, off });
    });
    done(await t.close());

    return { passed, failed };
};
