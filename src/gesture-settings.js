// The gesture thresholds: super-global — the same for every card and info panel of the
// page, set in a card's YAML (gestures:) or in the options menu, the last one to speak
// winning (see CardStorage._resolveGestures), always saved, on every device (card-storage.js:
// localGestures, keepGestures). They are Chart.js's own (Chart.defaults.global.gestures, see deps/chart-hec.js):
//   longPress (mouse and pen), longPressTouch (finger) — ms: a press held this long is a
//     long press; a second press within this long of a release is a double-click or a
//     tap-then-drag; a tap keeps the page from scrolling over a draggable zone this long;
//   precision (mouse and pen), precisionTouch (finger) — px: the pointer's precision. A pointer that
//     moved more than this is dragging; a second press of a double-click lands within it of
//     the first one; a target (a label, a button, a curve) within it of the pointer can be
//     picked.

const Chart = window.HXLocal_Chart;

export const GESTURE_SETTINGS = {
    longPress      : { pointer: 'mouse', key: 'longPressMs', def: 500, min: 200, max: 2000, step: 50, unit: 'ms', label: 'ui.menu.gesture_long_press' },
    longPressTouch : { pointer: 'touch', key: 'longPressMs', def: 500, min: 200, max: 2000, step: 50, unit: 'ms', label: 'ui.menu.gesture_long_press_touch' },
    precision      : { pointer: 'mouse', key: 'slop',        def: 8,   min: 4,   max: 20,   step: 1,  unit: 'px', label: 'ui.menu.gesture_precision' },
    precisionTouch : { pointer: 'touch', key: 'slop',        def: 12,  min: 4,   max: 20,   step: 1,  unit: 'px', label: 'ui.menu.gesture_precision_touch' },
};

// A setting's value brought within its bounds (rounded to its step); undefined when it
// isn't a number
export function clampGesture(name, v)
{
    const _s = GESTURE_SETTINGS[name];
    const _n = Number(v);
    if( !_s || v === null || v === undefined || v === '' || !isFinite(_n) ) return undefined;
    return Math.min(_s.max, Math.max(_s.min, Math.round(_n / _s.step) * _s.step));
}

// Settings as they are in force: every one of them within its bounds, else its default
export function gestureSettings(saved)
{
    const _v = {};
    for( const k in GESTURE_SETTINGS ) _v[k] = clampGesture(k, saved?.[k]) ?? GESTURE_SETTINGS[k].def;
    return _v;
}

// Gives the settings to Chart.js, for every chart of the page
export function applyGestures(values)
{
    const _g = { mouse: {}, touch: {} };
    for( const k in GESTURE_SETTINGS ) _g[GESTURE_SETTINGS[k].pointer][GESTURE_SETTINGS[k].key] = values[k];
    Chart.defaults.global.gestures = _g;
}
