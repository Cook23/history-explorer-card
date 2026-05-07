
var Chart = window.HXLocal_Chart;
var moment = window.HXLocal_moment;

const helpers = Chart.helpers;
const isArray = helpers.isArray;

var _color = Chart.helpers.color;


// --------------------------------------------------------------------------------------
// Timeline chart type 
// --------------------------------------------------------------------------------------

var TimelineConfig = {
    position: 'bottom',

    tooltips: {
        mode: 'nearest',
    },
    adapters: {},
    time: {
        parser: false, // false == a pattern string from http://momentjs.com/docs/#/parsing/string-format/ or a custom callback that converts its argument to a moment
        format: false, // DEPRECATED false == date objects, moment object, callback or a pattern string from http://momentjs.com/docs/#/parsing/string-format/
        unit: false, // false == automatic or override with week, month, year, etc.
        round: false, // none, or override with week, month, year, etc.
        displayFormat: false, // DEPRECATED
        isoWeekday: false, // override week start day - see http://momentjs.com/docs/#/get-set/iso-weekday/
        minUnit: 'millisecond',
        distribution: 'linear',
        bounds: 'data',

        // defaults to unit's corresponding unitFormat below or override using pattern string from http://momentjs.com/docs/#/displaying/format/
        displayFormats: {
            millisecond: 'h:mm:ss.SSS a', // 11:20:01.123 AM,
            second: 'h:mm:ss a', // 11:20:01 AM
            minute: 'h:mm a', // 11:20 AM
            hour: 'hA', // 5PM
            day: 'MMM D', // Sep 4
            week: 'll', // Week 46, or maybe "[W]WW - YYYY" ?
            month: 'MMM YYYY', // Sept 2015
            quarter: '[Q]Q - YYYY', // Q3
            year: 'YYYY' // 2015
        },
    },
    ticks: {
        autoSkip: true
    }
};


/**
 * Convert the given value to a moment object using the given time options.
 * @see http://momentjs.com/docs/#/parsing/
 */
var _tl_momentCache = new Map();

function tl_momentCache(tc)
{
    let r;
    if( tc !== undefined ) {
        if( !_tl_momentCache.has(tc) ) {
            r = moment(tc);
            _tl_momentCache.set(tc, r);
        } else 
            r = _tl_momentCache.get(tc);
    }
    return r;
}

function tl_momentCachePurge(rangeMin, rangeMax)
{
    if( _tl_momentCache.size <= 500 ) return;
    const margin = 86400000; // 1 day
    for( const k of _tl_momentCache.keys() ) {
        if( k < rangeMin - margin || k > rangeMax + margin )
            _tl_momentCache.delete(k);
    }
}


function momentify(value, options) {
    var parser = options.parser;
    var format = options.parser || options.format;

    if (typeof parser === 'function') {
        return parser(value);
    }

    if (typeof value === 'string' && typeof format === 'string') {
        return moment(value, format);
    }

    if (!(value instanceof moment)) {
        //value = moment(value);
        value = tl_momentCache(value);
    }

    if (value.isValid()) {
        return value;
    }

    // Labels are in an incompatible moment format and no `parser` has been provided.
    // The user might still use the deprecated `format` option to convert his inputs.
    if (typeof format === 'function') {
        return format(value);
    }

    return value;
}

function parse(input, scale) {
    if (helpers.isNullOrUndef(input)) {
        return null;
    }

    var options = scale.options.time;
    var value = momentify(scale.getRightValue(input), options);
    if (!value.isValid()) {
        return null;
    }

    if (options.round) {
        value.startOf(options.round);
    }

    return value.valueOf();
}

function arrayUnique(items) {
    var hash = {};
    var out = [];
    var i, ilen, item;

    for (i = 0, ilen = items.length; i < ilen; ++i) {
        item = items[i];
        if (!hash[item]) {
            hash[item] = true;
            out.push(item);
        }
    }

    return out;
}

var MIN_INTEGER = Number.MIN_SAFE_INTEGER || -9007199254740991;
var MAX_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;

var TimelineScale = Chart.scaleService.getScaleConstructor('time').extend({

    determineDataLimits: function() {
        var me = this;
        var chart = me.chart;
        var timeOpts = me.options.time;
        var elemOpts = me.chart.options.elements;
        var min = MAX_INTEGER;
        var max = MIN_INTEGER;
        var timestamps = [];
        var timestampobj = {};
        var datasets = [];
        var i, j, ilen, jlen, data, timestamp0, timestamp1;

        // Convert data to timestamps
        // Also used by getPixelForValue via _timestamps.datasets cache
        var explicitMin = parse(timeOpts.min, me);
        var explicitMax = parse(timeOpts.max, me);
        var hasExplicitRange = explicitMin !== null && explicitMax !== null;

        if( hasExplicitRange ) tl_momentCachePurge(explicitMin, explicitMax);

        // Cache datasets timestamps: rebuild only when data reference or length changes
        var chartDatasets = chart.data.datasets || [];
        var needsRebuild = false;
        if (!me._tl_datasetsCache || me._tl_datasetsCache.length !== chartDatasets.length) {
            needsRebuild = true;
        } else {
            for (i = 0; i < chartDatasets.length; ++i) {
                var cd = chartDatasets[i].data;
                var cc = me._tl_datasetsCache[i];
                if (!cc || cc._srcRef !== cd || cc._srcLen !== cd.length) { needsRebuild = true; break; }
            }
        }

        if (needsRebuild) {
            me._tl_datasetsCache = [];
            for (i = 0, ilen = chartDatasets.length; i < ilen; ++i) {
                if (chart.isDatasetVisible(i)) {
                    data = chartDatasets[i].data;
                    datasets[i] = [];
                    datasets[i]._srcRef = data;
                    datasets[i]._srcLen = data.length;

                    for (j = 0, jlen = data.length; j < jlen; ++j) {
                        timestamp0 = parse(data[j][elemOpts.keyStart], me);
                        timestamp1 = parse(data[j][elemOpts.keyEnd], me);
                        if (timestamp0 > timestamp1) {
                            [timestamp0, timestamp1] = [timestamp1, timestamp0];
                        }
                        datasets[i][j] = [timestamp0, timestamp1, data[j][elemOpts.keyValue]];
                        if (!hasExplicitRange) {
                            if (min > timestamp0 && timestamp0) { min = timestamp0; }
                            if (max < timestamp1 && timestamp1) { max = timestamp1; }
                            if (Object.prototype.hasOwnProperty.call(timestampobj, timestamp0)) {
                                timestampobj[timestamp0] = true;
                                timestamps.push(timestamp0);
                            }
                            if (Object.prototype.hasOwnProperty.call(timestampobj, timestamp1)) {
                                timestampobj[timestamp1] = true;
                                timestamps.push(timestamp1);
                            }
                        }
                    }
                } else {
                    datasets[i] = [];
                    datasets[i]._srcRef = null;
                    datasets[i]._srcLen = 0;
                }
                me._tl_datasetsCache[i] = datasets[i];
            }
        } else {
            // Reuse cached datasets, no parse() calls needed
            datasets = me._tl_datasetsCache;
        }

        if (!hasExplicitRange && timestamps.size) {
            timestamps.sort(function (a, b){
                return a - b;
            });
        }

        min = explicitMin || min;
        max = explicitMax || max;

        // In case there is no valid min/max, var's use today limits
        min = min === MAX_INTEGER ? +moment().startOf('day') : min;
        max = max === MIN_INTEGER ? +moment().endOf('day') + 1 : max;

        // Make sure that max is strictly higher than min (required by the lookup table)
        me.min = Math.min(min, max);
        me.max = Math.max(min + 1, max);

        // PRIVATE
        me._horizontal = me.isHorizontal();
        me._table = [];
        me._timestamps = {
            data: timestamps,
            datasets: datasets,
            labels: []
        };
    },
});

Chart.scaleService.registerScaleType('timeline', TimelineScale, TimelineConfig);

Chart.controllers.timeline = Chart.controllers.bar.extend({

    getBarBounds : function (bar) {
        var vm =   bar._view;
        var x1, x2, y1, y2;

        x1 = vm.x;
        x2 = vm.x + vm.width;
        y1 = vm.y;
        y2 = vm.y + vm.height;

        return {
            left : x1,
            top: y1,
            right: x2,
            bottom: y2
        };

    },

    update: function(reset) {
        var me = this;
        var meta = me.getMeta();
        var chartOpts = me.chart.options;
        if (chartOpts.textPadding || chartOpts.minBarWidth ||
                chartOpts.showText || chartOpts.colorFunction) {
            var elemOpts = me.chart.options.elements;
            elemOpts.textPadding = chartOpts.textPadding || elemOpts.textPadding;
            elemOpts.minBarWidth = chartOpts.minBarWidth || elemOpts.minBarWidth;
            elemOpts.colorFunction = chartOpts.colorFunction || elemOpts.colorFunction;
            elemOpts.minBarWidth = chartOpts.minBarWidth || elemOpts.minBarWidth;
            if (Chart._tl_depwarn !== true) {
                console.log('Timeline Chart: Configuration deprecated. Please check document on Github.');
                Chart._tl_depwarn = true;
            }
        }

        if( meta.data.length > 0 ) {

            let ruler = me.getRuler(0);
            me.barHeight = me.calculateBarHeight(ruler) + 4;

            helpers.each(meta.data, function(rectangle, index) {
                me.updateElement(rectangle, index, reset);
            }, me);

        }
    },

    updateElement: function(rectangle, index, reset) {
        var me = this;
        var meta = me.getMeta();
        var xScale = me.getScaleForId(meta.xAxisID);
        var yScale = me.getScaleForId(meta.yAxisID);
        var dataset = me.getDataset();
        var data = dataset.data[index];
        var custom = rectangle.custom || {};
        var datasetIndex = me.index;
        var opts = me.chart.options;
        var elemOpts = opts.elements || Chart.defaults.timeline.elements;
        var rectangleElementOptions = elemOpts.rectangle;
        var textPad = elemOpts.textPadding;
        var minBarWidth = elemOpts.minBarWidth;

        rectangle._xScale = xScale;
        rectangle._yScale = yScale;
        rectangle._datasetIndex = me.index;
        rectangle._index = index;

        var text = elemOpts.textFunction(data[elemOpts.keyValue], me.chart.data.datasets, datasetIndex);

        var x = xScale.getPixelForValue(data[elemOpts.keyStart]);
        var end = xScale.getPixelForValue(data[elemOpts.keyEnd]);

        var y = yScale.getPixelForValue(data, datasetIndex, datasetIndex);
        var width = end - x;
        var height = me.barHeight;

        // Cache couleur : clé = stateValue|datasetIndex, invalide si colorFunction change
        var _cf = elemOpts.colorFunction;
        if (!me._tl_colorCache || me._tl_colorCacheFn !== _cf) {
            me._tl_colorCache = new Map();
            me._tl_colorCacheFn = _cf;
        }
        var _colorKey = data[elemOpts.keyValue] + '|' + datasetIndex;
        var color = me._tl_colorCache.get(_colorKey);
        if (!color) {
            color = _color(_cf(text, data, me.chart.data.datasets, datasetIndex));
            me._tl_colorCache.set(_colorKey, color);
        }
        var showText = elemOpts.showText;

        var font = elemOpts.font;

        if (!font) {
            font = 'bold 12px "Helvetica Neue", Helvetica, Arial, sans-serif';
        }

        // This one has in account the size of the tick and the height of the bar, so we just
        // divide both of them by two and subtract the height part and add the tick part
        // to the real position of the element y. The purpose here is to place the bar
        // in the middle of the tick.
        var boxY = y - (height / 2);

        rectangle._model = {
            x: reset ?  x - width : x,   // Top left of rectangle
            y: boxY , // Top left of rectangle
            width: Math.max(width, minBarWidth),
            height: height,
            base: x + width,
            backgroundColor: color.rgbaString(),
            borderSkipped: custom.borderSkipped ? custom.borderSkipped : rectangleElementOptions.borderSkipped,
            borderColor: custom.borderColor ? custom.borderColor : helpers.getValueAtIndexOrDefault(dataset.borderColor, index, rectangleElementOptions.borderColor),
            borderWidth: custom.borderWidth ? custom.borderWidth : helpers.getValueAtIndexOrDefault(dataset.borderWidth, index, rectangleElementOptions.borderWidth),
            // Tooltip
            label: me.chart.data.labels[index],
            datasetLabel: dataset.label,
            text: text,
            textColor: color.luminosity() > 0.5 ? '#333333' : '#ffffff',
        };

        rectangle.draw = function() {
            var ctx = this._chart.ctx;
            var vm = this._view;
            var oldAlpha = ctx.globalAlpha;
            var oldOperation = ctx.globalCompositeOperation;

            // Draw new rectangle with Alpha-Mix.
            ctx.fillStyle = vm.backgroundColor;
            ctx.lineWidth = vm.borderWidth;
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillRect(vm.x, vm.y, vm.width, vm.height);

            ctx.globalAlpha = 0.5;
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillRect(vm.x, vm.y, vm.width, vm.height);

            ctx.globalAlpha = oldAlpha;
            ctx.globalCompositeOperation = oldOperation;
            if (showText) {
                ctx.beginPath();
                var textRect = ctx.measureText(vm.text);
                if (textRect.width > 0 && textRect.width + textPad + 2 < vm.width) {
                    ctx.font = font;
                    ctx.fillStyle = vm.textColor;
                    ctx.lineWidth = 0;
                    ctx.strokeStyle = vm.textColor;
                    ctx.textBaseline = 'middle';
                    ctx.fillText(vm.text, vm.x + textPad, vm.y + (vm.height) / 2);
                }
                ctx.fill();
            }
        };

        rectangle.inXRange = function (mouseX) {
            var bounds = me.getBarBounds(this);
            return mouseX >= bounds.left && mouseX <= bounds.right;
        };
        rectangle.tooltipPosition = function () {
            var vm = this.getCenterPoint();
            return {
                x: vm.x ,
                y: vm.y
            };
        };

        rectangle.getCenterPoint = function () {
            var vm = this._view;
            var x, y;
            x = vm.x + (vm.width / 2);
            y = vm.y + (vm.height / 2);

            return {
                x : x,
                y : y
            };
        };

        rectangle.inRange = function (mouseX, mouseY) {
            var inRange = false;

            if(this._view)
            {
                var bounds = me.getBarBounds(this);
                inRange = mouseX >= bounds.left && mouseX <= bounds.right &&
                    mouseY >= bounds.top && mouseY <= bounds.bottom;
            }
            return inRange;
        };

        rectangle.pivot();
    },

    getBarCount: function() {
        var me = this;
        var barCount = 0;
        helpers.each(me.chart.data.datasets, function(dataset, datasetIndex) {
            var meta = me.chart.getDatasetMeta(datasetIndex);
            if (meta.bar && me.chart.isDatasetVisible(datasetIndex)) {
                ++barCount;
            }
        }, me);
        return barCount;
    },


    // draw
    draw: function (ease) {
//        var easingDecimal = ease || 1;
        var i, len;
        var metaData = this.getMeta().data;
        for (i = 0, len = metaData.length; i < len; i++)
        {
//            metaData[i].transition(easingDecimal).draw();
            metaData[i].draw();
        }
    },

    // From controller.bar
    calculateBarHeight: function(ruler) {
        var me = this;
        var yScale = me.getScaleForId(me.getMeta().yAxisID);
        if (yScale.options.barThickness) {
            return yScale.options.barThickness;
        }
        return yScale.options.stacked ? ruler.categoryHeight : ruler.barHeight;
    },

    removeHoverStyle: function(e) {
        // TODO
    },

    setHoverStyle: function(e) {
        // TODO: Implement this
    }

});


Chart.defaults.timeline = {
    elements: {
        colorFunction: function() {
            return _color('black');
        },
        showText: true,
        textPadding: 4,
        minBarWidth: 1,
        keyStart: 0,
        keyEnd: 1,
        keyValue: 2
    },

    layout: {
        padding: {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        }
    },

    legend: {
        display: false
    },

    scales: {
        xAxes: [{
            type: 'timeline',
            position: 'bottom',
            distribution: 'linear',
            categoryPercentage: 0.8,
            barPercentage: 0.9,

            gridLines: {
                display: true,
                // offsetGridLines: true,
                drawBorder: true,
                drawTicks: true
            },
            ticks: {
                maxRotation: 0
            },
            unit: 'day'
        }],
        yAxes: [{
            type: 'category',
            position: 'left',
            barThickness : 20,
            categoryPercentage: 0.8,
            barPercentage: 0.9,
            offset: true,
            gridLines: {
                display: true,
                offsetGridLines: true,
                drawBorder: true,
                drawTicks: true
            }
        }]
    },
    tooltips: {
        callbacks: {
            title: function(tooltipItems, data) {
                var elemOpts = this._chart.options.elements;
                var d = data.labels[tooltipItems[0].datasetIndex];
                return d;
            },
            label: function(tooltipItem, data) {
                var elemOpts = this._chart.options.elements;
                var d = data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                return [d[elemOpts.keyValue], moment(d[elemOpts.keyStart]).format('D MMM, HH:mm:ss'), moment(d[elemOpts.keyEnd]).format('D MMM, HH:mm:ss')];
            }
        }
    }
};


// --------------------------------------------------------------------------------------
// Arrowline chart type 
// --------------------------------------------------------------------------------------

var ArrowlineConfig = {
    position: 'bottom',

    tooltips: {
        mode: 'nearest',
    },
    adapters: {},
    time: {
        parser: false, // false == a pattern string from http://momentjs.com/docs/#/parsing/string-format/ or a custom callback that converts its argument to a moment
        format: false, // DEPRECATED false == date objects, moment object, callback or a pattern string from http://momentjs.com/docs/#/parsing/string-format/
        unit: false, // false == automatic or override with week, month, year, etc.
        round: false, // none, or override with week, month, year, etc.
        displayFormat: false, // DEPRECATED
        isoWeekday: false, // override week start day - see http://momentjs.com/docs/#/get-set/iso-weekday/
        minUnit: 'millisecond',
        distribution: 'linear',
        bounds: 'data',

        // defaults to unit's corresponding unitFormat below or override using pattern string from http://momentjs.com/docs/#/displaying/format/
        displayFormats: {
            millisecond: 'h:mm:ss.SSS a', // 11:20:01.123 AM,
            second: 'h:mm:ss a', // 11:20:01 AM
            minute: 'h:mm a', // 11:20 AM
            hour: 'hA', // 5PM
            day: 'MMM D', // Sep 4
            week: 'll', // Week 46, or maybe "[W]WW - YYYY" ?
            month: 'MMM YYYY', // Sept 2015
            quarter: '[Q]Q - YYYY', // Q3
            year: 'YYYY' // 2015
        },
    },
    ticks: {
        autoSkip: true
    }
};

var ArrowlineScale = Chart.scaleService.getScaleConstructor('time').extend({

    determineDataLimits: function() {
        var me = this;
        var chart = me.chart;
        var timeOpts = me.options.time;
        var elemOpts = me.chart.options.elements;
        var min = MAX_INTEGER;
        var max = MIN_INTEGER;
        var timestamps = [];
        var timestampobj = {};
        var datasets = [];
        var i, j, ilen, jlen, data, timestamp0, timestamp1;

        // Convert data to timestamps
        // Also used by getPixelForValue via _timestamps.datasets cache
        var explicitMin = parse(timeOpts.min, me);
        var explicitMax = parse(timeOpts.max, me);
        var hasExplicitRange = explicitMin !== null && explicitMax !== null;

        if( hasExplicitRange ) tl_momentCachePurge(explicitMin, explicitMax);

        // Cache datasets timestamps: rebuild only when data reference or length changes
        var chartDatasets = chart.data.datasets || [];
        var needsRebuild = false;
        if (!me._tl_datasetsCache || me._tl_datasetsCache.length !== chartDatasets.length) {
            needsRebuild = true;
        } else {
            for (i = 0; i < chartDatasets.length; ++i) {
                var cd = chartDatasets[i].data;
                var cc = me._tl_datasetsCache[i];
                if (!cc || cc._srcRef !== cd || cc._srcLen !== cd.length) { needsRebuild = true; break; }
            }
        }

        if (needsRebuild) {
            me._tl_datasetsCache = [];
            for (i = 0, ilen = chartDatasets.length; i < ilen; ++i) {
                if (chart.isDatasetVisible(i)) {
                    data = chartDatasets[i].data;
                    datasets[i] = [];
                    datasets[i]._srcRef = data;
                    datasets[i]._srcLen = data.length;

                    for (j = 0, jlen = data.length; j < jlen; ++j) {
                        timestamp0 = parse(data[j][elemOpts.keyStart], me);
                        timestamp1 = parse(data[j][elemOpts.keyEnd], me);
                        if (timestamp0 > timestamp1) {
                            [timestamp0, timestamp1] = [timestamp1, timestamp0];
                        }
                        datasets[i][j] = [timestamp0, timestamp1, data[j][elemOpts.keyValue]];
                        if (!hasExplicitRange) {
                            if (min > timestamp0 && timestamp0) { min = timestamp0; }
                            if (max < timestamp1 && timestamp1) { max = timestamp1; }
                            if (Object.prototype.hasOwnProperty.call(timestampobj, timestamp0)) {
                                timestampobj[timestamp0] = true;
                                timestamps.push(timestamp0);
                            }
                            if (Object.prototype.hasOwnProperty.call(timestampobj, timestamp1)) {
                                timestampobj[timestamp1] = true;
                                timestamps.push(timestamp1);
                            }
                        }
                    }
                } else {
                    datasets[i] = [];
                    datasets[i]._srcRef = null;
                    datasets[i]._srcLen = 0;
                }
                me._tl_datasetsCache[i] = datasets[i];
            }
        } else {
            // Reuse cached datasets, no parse() calls needed
            datasets = me._tl_datasetsCache;
        }

        if (!hasExplicitRange && timestamps.size) {
            timestamps.sort(function (a, b){
                return a - b;
            });
        }

        min = explicitMin || min;
        max = explicitMax || max;

        // In case there is no valid min/max, var's use today limits
        min = min === MAX_INTEGER ? +moment().startOf('day') : min;
        max = max === MIN_INTEGER ? +moment().endOf('day') + 1 : max;

        // Make sure that max is strictly higher than min (required by the lookup table)
        me.min = Math.min(min, max);
        me.max = Math.max(min + 1, max);

        // PRIVATE
        me._horizontal = me.isHorizontal();
        me._table = [];
        me._timestamps = {
            data: timestamps,
            datasets: datasets,
            labels: []
        };
    },
});

var arrowImageMap = new Map();

Chart.scaleService.registerScaleType('arrowline', ArrowlineScale, ArrowlineConfig);

Chart.controllers.arrowline = Chart.controllers.bar.extend({

    getBarBounds : function (bar) {
        var vm =   bar._view;
        var x1, x2, y1, y2;

        x1 = vm.x;
        x2 = vm.x + vm.width;
        y1 = vm.y;
        y2 = vm.y + vm.height;

        return {
            left : x1,
            top: y1,
            right: x2,
            bottom: y2
        };

    },

    update: function(reset) {
        var me = this;
        var meta = me.getMeta();

        if( meta.data.length > 0 ) {

            let ruler = me.getRuler(0);
            me.barHeight = me.calculateBarHeight(ruler) + 4;

            helpers.each(meta.data, function(rectangle, index) {
                me.updateElement(rectangle, index, reset);
            }, me);

        }
    },

    updateElement: function(rectangle, index, reset) {
        var me = this;
        var meta = me.getMeta();
        var xScale = me.getScaleForId(meta.xAxisID);
        var yScale = me.getScaleForId(meta.yAxisID);
        var dataset = me.getDataset();
        var data = dataset.data[index];
        var custom = rectangle.custom || {};
        var datasetIndex = me.index;
        var opts = me.chart.options;
        var elemOpts = opts.elements || Chart.defaults.timeline.elements;
        var rectangleElementOptions = elemOpts.rectangle;
        var minBarWidth = elemOpts.minBarWidth;

        rectangle._xScale = xScale;
        rectangle._yScale = yScale;
        rectangle._datasetIndex = me.index;
        rectangle._index = index;

        var text = data[elemOpts.keyValue];

        var x = xScale.getPixelForValue(data[elemOpts.keyStart]);
        var end = xScale.getPixelForValue(data[elemOpts.keyEnd]);

        var y = yScale.getPixelForValue(data, datasetIndex, datasetIndex);
        var width = end - x;
        var height = me.barHeight;

        // This one has in account the size of the tick and the height of the bar, so we just
        // divide both of them by two and subtract the height part and add the tick part
        // to the real position of the element y. The purpose here is to place the bar
        // in the middle of the tick.
        var boxY = y - (height / 2);

        rectangle._model = {
            x: reset ?  x - width : x,   // Top left of rectangle
            y: boxY , // Top left of rectangle
            width: Math.max(width, minBarWidth),
            height: height,
            base: x + width,
            backgroundColor: '#000000',
            borderSkipped: custom.borderSkipped ? custom.borderSkipped : rectangleElementOptions.borderSkipped,
            borderColor: custom.borderColor ? custom.borderColor : helpers.getValueAtIndexOrDefault(dataset.borderColor, index, rectangleElementOptions.borderColor),
            borderWidth: custom.borderWidth ? custom.borderWidth : helpers.getValueAtIndexOrDefault(dataset.borderWidth, index, rectangleElementOptions.borderWidth),
            // Tooltip
            label: me.chart.data.labels[index],
            datasetLabel: dataset.label,
            text: text,
            textColor: '#ffffff',
        };

        rectangle.getPosition = function(index) {
            return this._view.x + (index ? this._view.width : 0);
        }

        rectangle.getMidPosition = function() {
            return this._view.y + this._view.height / 2;
        }

        rectangle.getValue = function() {
            return this._view.text;
        };

        rectangle.inXRange = function (mouseX) {
            var bounds = me.getBarBounds(this);
            return mouseX >= bounds.left && mouseX <= bounds.right;
        };
        rectangle.tooltipPosition = function () {
            var vm = this.getCenterPoint();
            return {
                x: vm.x ,
                y: vm.y
            };
        };

        rectangle.getCenterPoint = function () {
            var vm = this._view;
            var x, y;
            x = vm.x + (vm.width / 2);
            y = vm.y + (vm.height / 2);

            return {
                x : x,
                y : y
            };
        };

        rectangle.inRange = function (mouseX, mouseY) {
            var inRange = false;

            if(this._view)
            {
                var bounds = me.getBarBounds(this);
                inRange = mouseX >= bounds.left && mouseX <= bounds.right &&
                    mouseY >= bounds.top && mouseY <= bounds.bottom;
            }
            return inRange;
        };

        rectangle.pivot();
    },

    getBarCount: function() {
        var me = this;
        var barCount = 0;
        helpers.each(me.chart.data.datasets, function(dataset, datasetIndex) {
            var meta = me.chart.getDatasetMeta(datasetIndex);
            if (meta.bar && me.chart.isDatasetVisible(datasetIndex)) {
                ++barCount;
            }
        }, me);
        return barCount;
    },


    // draw
    draw: function (ease) {

        let color = ( this.index < this.chart.data.datasets.length ) ? this.chart.data.datasets[this.index].arrowColor : undefined;
        let fill = ( this.index < this.chart.data.datasets.length ) ? this.chart.data.datasets[this.index].arrowBackground : undefined;

        if( !arrowImageMap.has(color) ) {
            let outerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="${color ?? this.chart.options.elements.arrowColor}" d="M7.03 9.97H11.03V18.89L13.04 18.92V9.97H17.03L12.03 4.97Z" /></svg>`;
            let blob = new Blob([outerHTML], {type:'image/svg+xml;charset=utf-8'});
            let URL = window.URL || window.webkitURL || window;
            let blobURL = URL.createObjectURL(blob);
            let image = new Image();
            image.onload = () => { 
                arrowImageMap.set(color, image);
            }
            image.src = blobURL;
        }

        var metaData = this.getMeta().data;

        if( !metaData.length || !arrowImageMap.has(color) ) return;

        const arrowImage = arrowImageMap.get(color);

        const area = this.chart.chartArea;

        const arrow_spacing = 30;

        const n = Math.ceil((area.right - area.left) / arrow_spacing);

        const ybar = metaData[0].getMidPosition();

        if( fill ) {
            const y0 = ybar - arrowImage.height / 2;
            this.chart.ctx.fillStyle = fill;
            this.chart.ctx.lineWidth = 0;
            this.chart.ctx.fillRect(area.left, y0-3, area.right - area.left, arrowImage.height+6);
        }

        const origMatrix = this.chart.ctx.getTransform();

        let xScale = this.getScaleForId(this.getMeta().xAxisID);
        let xp = xScale.getPixelForValue(moment().startOf('day'));
        let ofs = xp % arrow_spacing;

        let j = 0;

        for( let i = 0; i < n; i++ ) {

            let value = null;        

            const x0 = i * arrow_spacing + area.left + ofs;
            const y0 = ybar - arrowImage.height / 2;

            const xmid = x0 + arrowImage.width / 2;
            for( ; j < metaData.length; j++ ) {
                const x0 = metaData[j].getPosition(0);
                const x1 = metaData[j].getPosition(1);
                if( x1 > xmid ) {
                    if( xmid >= x0 ) {
                        value = metaData[j].getValue() * 1.0;
                    }
                    break;
                }
            }

            if( value != null ) {
                let xc = x0 + arrowImage.width / 2;
                let yc = y0 + arrowImage.height / 2;
                this.chart.ctx.setTransform(origMatrix);
                this.chart.ctx.translate(xc, yc);
                this.chart.ctx.rotate((value + 180) / 180.0 * Math.PI);
                this.chart.ctx.translate(-xc, -yc);
                this.chart.ctx.drawImage(arrowImage, x0, y0, arrowImage.width, arrowImage.height);
            }

        }

        this.chart.ctx.setTransform(origMatrix);
    },

    // From controller.bar
    calculateBarHeight: function(ruler) {
        var me = this;
        var yScale = me.getScaleForId(me.getMeta().yAxisID);
        if (yScale.options.barThickness) {
            return yScale.options.barThickness;
        }
        return yScale.options.stacked ? ruler.categoryHeight : ruler.barHeight;
    },

    removeHoverStyle: function(e) {},

    setHoverStyle: function(e) {}

});


Chart.defaults.arrowline = {
    elements: {
        minBarWidth: 1,
        keyStart: 0,
        keyEnd: 1,
        keyValue: 2
    },

    layout: {
        padding: {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        }
    },

    legend: {
        display: false
    },

    scales: {
        xAxes: [{
            type: 'timeline',
            position: 'bottom',
            distribution: 'linear',
            categoryPercentage: 0.8,
            barPercentage: 0.9,

            gridLines: {
                display: true,
                // offsetGridLines: true,
                drawBorder: true,
                drawTicks: true
            },
            ticks: {
                maxRotation: 0
            },
            unit: 'day'
        }],
        yAxes: [{
            type: 'category',
            position: 'left',
            barThickness : 20,
            categoryPercentage: 0.8,
            barPercentage: 0.9,
            offset: true,
            gridLines: {
                display: true,
                offsetGridLines: true,
                drawBorder: true,
                drawTicks: true
            }
        }]
    }
};
