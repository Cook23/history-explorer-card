
// --------------------------------------------------------------------------------------
// Chartjs vertical line plugin
// --------------------------------------------------------------------------------------

import {isMobile} from "./history-explorer-card";

export const vertline_plugin = {

    id: 'vertline',

    afterInit: (chart) => { 
        chart.vertline = { x: 0, draw: false } 
    },

    afterEvent: (chart, evt) => {
        const pconfig = chart.callerInstance.pconfig;
        if( isMobile || pconfig.cursorMode === 'hide' ) return;
        if( !pconfig.cursorTypes.includes('all') && !pconfig.cursorTypes.includes(chart.config.type) ) return;
        const {
            chartArea: { top, bottom, left, right }
        } = chart;
        const s = ( evt.x >= left && evt.x <= right && evt.y >= top && evt.y <= bottom );
        if( pconfig.cursorMode === 'auto' ) {
            chart.vertline = { x: evt.x, draw: s };
            chart.draw();
        } else if( pconfig.cursorMode === 'all' ) {
            for( let g of chart.callerInstance.graphs ) {
                g.chart.vertline = { x: evt.x, draw: s };
                g.chart.draw();
            }
        }
   },

   afterDatasetsDraw: (chart, _, opts) => {
        const { ctx, chartArea: { top, bottom, left, right } } = chart;
        if( chart.vertline.draw ) {
            ctx.lineWidth = 1.0;
            ctx.strokeStyle = opts.color || 'black';
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(chart.vertline.x, bottom);
            ctx.lineTo(chart.vertline.x, top);
            ctx.stroke();
            ctx.restore();
        }
    }

};


// --------------------------------------------------------------------------------------
// Chartjs min/max band plugin
// Draws a shaded area between yMin and yMax stored on each data point.
// Activated per-dataset when dataset.showMinMax is truthy.
// --------------------------------------------------------------------------------------

export const minmaxfill_plugin = {

    id: 'minmaxfill',

    afterDatasetsDraw: (chart) => {

        const { ctx, chartArea: { top, bottom, left, right } } = chart;
        const yScale = chart.scales['y-axis-0'];
        const xScale = chart.scales['x-axis-0'];

        if( !yScale || !xScale ) return;

        for( let di = 0; di < chart.data.datasets.length; di++ ) {

            const dataset = chart.data.datasets[di];
            if( !dataset.showMinMax ) continue;

            const points = dataset.data;
            if( !points || points.length < 2 ) continue;

            // Collect points that have yMin/yMax within the visible chart area
            const band = [];
            for( let i = 0; i < points.length; i++ ) {
                const pt = points[i];
                if( pt.yMin == null || pt.yMax == null ) continue;
                const px = xScale.getPixelForValue(pt.x);
                if( px < left - 1 || px > right + 1 ) continue;
                band.push({
                    px,
                    pyMin: Math.max(top,    Math.min(bottom, yScale.getPixelForValue(pt.yMin))),
                    pyMax: Math.max(top,    Math.min(bottom, yScale.getPixelForValue(pt.yMax)))
                });
            }

            if( band.length < 2 ) continue;

            // Build fill color from the line color at low opacity
            const fillColor = _colorWithAlpha(dataset.borderColor, 0.15);

            ctx.save();
            ctx.beginPath();

            // Upper edge: yMax from left to right
            ctx.moveTo(band[0].px, band[0].pyMax);
            for( let i = 1; i < band.length; i++ )
                ctx.lineTo(band[i].px, band[i].pyMax);

            // Lower edge: yMin from right to left (closes the polygon)
            for( let i = band.length - 1; i >= 0; i-- )
                ctx.lineTo(band[i].px, band[i].pyMin);

            ctx.closePath();
            ctx.fillStyle = fillColor;
            ctx.fill();
            ctx.restore();
        }
    }

};


// --------------------------------------------------------------------------------------
// Helper: rewrite any CSS color as rgba with a given alpha channel
// Handles: #rrggbb, #rrggbbaa, #rgb, rgb(...), rgba(...)
// --------------------------------------------------------------------------------------

function _colorWithAlpha(color, alpha) {

    if( !color ) return `rgba(0,0,0,${alpha})`;

    // rgb() or rgba() — replace / add alpha
    let m = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if( m ) return `rgba(${m[1]},${m[2]},${m[3]},${alpha})`;

    // #rrggbb or #rrggbbaa
    m = color.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/);
    if( m ) return `rgba(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)},${alpha})`;

    // #rgb
    m = color.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/);
    if( m ) return `rgba(${parseInt(m[1]+m[1],16)},${parseInt(m[2]+m[2],16)},${parseInt(m[3]+m[3],16)},${alpha})`;

    return `rgba(0,0,0,${alpha})`;
}

