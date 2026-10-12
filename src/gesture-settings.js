// The gesture thresholds: super-global — the same for every card and info panel of the
// page, set in a card's YAML (gestures:) or in the options menu, the last one to speak
// winning (see CardStorage._resolveGestures), always saved, on every device. They are
// Chart.js's own (Chart.defaults.global.gestures, see deps/chart-hec.js):
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
    precision      : { pointer: 'mouse', key: 'slop',        def: 8,   min: 2,   max: 40,   step: 1,  unit: 'px', label: 'ui.menu.gesture_precision' },
    precisionTouch : { pointer: 'touch', key: 'slop',        def: 12,  min: 2,   max: 40,   step: 1,  unit: 'px', label: 'ui.menu.gesture_precision_touch' },
};

const LOCAL_KEY = 'history-explorer-gestures';
export const HA_GESTURES_KEY = 'history-explorer-gestures';

// A setting's value brought within its bounds (rounded to its step); undefined when it
// isn't a number
export function clampGesture(name, v)
{
    const _s = GESTURE_SETTINGS[name];
    const _n = Number(v);
    if( !_s || v === null || v === undefined || v === '' || !isFinite(_n) ) return undefined;
    return Math.min(_s.max, Math.max(_s.min, Math.round(_n / _s.step) * _s.step));
}

// The settings in force on this device: { name: value } for each of them
export function gestureValues()
{
    let _saved = {};
    try { _saved = JSON.parse(window.localStorage.getItem(LOCAL_KEY)) || {}; } catch(e) {}
    const _v = {};
    for( const k in GESTURE_SETTINGS ) _v[k] = clampGesture(k, _saved[k]) ?? GESTURE_SETTINGS[k].def;
    return _v;
}

// Sets some of them on this device (saved, and given to Chart.js); returns whether any changed
export function setGestureValues(values)
{
    const _v = gestureValues();
    let _changed = false;
    for( const k in values ) {
        const _c = clampGesture(k, values[k]);
        if( _c !== undefined && _c !== _v[k] ) { _v[k] = _c; _changed = true; }
    }
    if( _changed ) window.localStorage.setItem(LOCAL_KEY, JSON.stringify(_v));
    applyGestures(_v);
    return _changed;
}

// Gives the settings to Chart.js, for every chart of the page
export function applyGestures(values = gestureValues())
{
    const _g = { mouse: {}, touch: {} };
    for( const k in GESTURE_SETTINGS ) _g[GESTURE_SETTINGS[k].pointer][GESTURE_SETTINGS[k].key] = values[k];
    Chart.defaults.global.gestures = _g;
}

applyGestures();
