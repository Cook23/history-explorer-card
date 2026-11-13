// --------------------------------------------------------------------------------------
// The performance test's recorder (card-tests.js), one for the page: every card reports its
// steps to it while the test records — a card made again by Home Assistant too, which a
// card's own recorder would miss. Data only: no DOM, no event.
// --------------------------------------------------------------------------------------

let recorder = null;

// What has a card's graphs drawn again (generateGraphDataFromCache), as the report says it
export const REDRAW_CAUSES = {
    answers: 'answers from Home Assistant',
    moved: 'the window moved',
    window: 'the window or its settings changed',
    shown: 'a graph come on the screen',
    later: 'a graph off the screen, drawn after those on the screen',
    test: 'the test',
};

export const perf = {
    // (recorder: { add(kind, ms, info) } — null: nothing recorded)
    set(r) { recorder = r; },
    // Whether a test records
    get on() { return !!recorder; },
    // A step of kind (its info), ms long, now
    add(kind, ms, info) { recorder?.add(kind, ms, info); },
};
