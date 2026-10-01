// The entity store (src/history-entity-store.js) on its own — no browser
const fs = require('fs');
const path = require('path');

// The module is ESM with no imports: loaded as is
const load = () => import('data:text/javascript;base64,' +
    Buffer.from(fs.readFileSync(path.join(__dirname, '../src/history-entity-store.js'))).toString('base64'));

module.exports = async function()
{
    const { EntityStore } = await load();
    let passed = 0, failed = 0;
    const step = (name, fn) => {
        let res;
        try { res = fn(); } catch( ex ) { res = 'EXCEPTION ' + ex.message; }
        if( res === true ) passed++; else failed++;
        console.log((res === true ? '  ✓ ' : '  ✗ ') + name + (res === true ? '' : '  -> ' + res));
    };
    // A store over entries written as 'id@group' (id alone: no group; '!' prefix: YAML)
    const mk = (...specs) => {
        const owner = { entities: specs.map(s => {
            const [id, g] = s.replace('!', '').split('@');
            return { entity: id, ...(g !== undefined ? { groupId: +g } : {}), ...(s[0] === '!' ? { isStatic: true } : {}) };
        }) };
        return new EntityStore(owner);
    };
    const show = st => st.list.map(e => typeof e === 'string' ? e : e.entity + (e.groupId !== undefined ? '@' + e.groupId : '')).join(' ');
    const expect = (got, want) => got === want ? true : `got "${got}", want "${want}"`;

    step('lookups', () => {
        const st = mk('a@1', 'b@1', 'c@2');
        st.list.push('d');
        return st.indexOf('c') === 2 && st.has('d') && !st.has('x') && st.groupIdOf('b') === 1 && st.groupSize(1) === 2 &&
            st.inGroup('a', 1)?.entity === 'a' && st.inGroup('a', 2) === undefined ? true : 'wrong lookup';
    });
    step('a legacy string entry becomes an object when it is changed', () => {
        const st = mk('a@1'); st.list.push('d');
        st.entry('d').hidden = true;
        return typeof st.list[1] === 'object' && st.list[1].hidden === true ? true : JSON.stringify(st.list);
    });
    step('add registers an entry once', () => {
        const st = mk('a@1'); const e = { entity: 'b' };
        st.add(e); st.add(e);
        return expect(show(st), 'a@1 b');
    });
    step('remove, and dynamicOnly keeps a YAML entry', () => {
        const st = mk('!a@0', 'b@1001', 'c@1001');
        st.remove('a', true); st.remove('b');
        return expect(show(st), 'a@0 c@1001');
    });
    step('removeAllDynamic keeps the YAML entries', () => {
        const st = mk('!a@0', 'b@1001', '!c@1');
        st.removeAllDynamic();
        return expect(show(st), 'a@0 c@1');
    });
    step('regroup makes each group contiguous, in order of first appearance', () => {
        const st = mk('a@1', 'b@2', 'c@1', 'x', 'd@2');
        st.regroup();
        return expect(show(st), 'a@1 c@1 b@2 d@2 x');
    });
    step('moveToGroup puts the entry at the end of its new group', () => {
        const st = mk('a@1', 'b@1', 'c@2', 'd@3');
        st.moveToGroup(st.find('a'), 2);
        return expect(show(st), 'b@1 c@2 a@2 d@3');
    });
    step('moveToGroup to a group with no other entry: at the end', () => {
        const st = mk('a@1', 'b@1', 'c@2');
        st.moveToGroup(st.find('a'), 9);
        return expect(show(st), 'b@1 c@2 a@9');
    });
    step('setGraphOrder reorders only that graph\'s entries, in place', () => {
        const st = mk('x@0', 'a@1', 'b@1', 'c@1', 'y@2');
        st.setGraphOrder(1, [{ entity: 'c' }, { entity: 'a' }]);
        return expect(show(st), 'x@0 c@1 a@1 b@1 y@2');
    });
    step('syncGroupOrder follows the display order, unknown ones last', () => {
        const st = mk('x@0', 'a@1', 'b@1', 'c@1', 'y@2');
        st.syncGroupOrder(1, ['c', 'a']);
        return expect(show(st), 'x@0 c@1 a@1 b@1 y@2');
    });
    step('moveBefore moves a graph above another one', () => {
        const st = mk('a@1', 'b@2', 'c@3', 'd@3');
        st.moveBefore(new Set(['c', 'd']), new Set(['a']), true);
        return expect(show(st), 'c@3 d@3 a@1 b@2');
    });
    step('moveBefore moves a graph below another one', () => {
        const st = mk('a@1', 'b@2', 'c@3');
        st.moveBefore(new Set(['a']), new Set(['b']), false);
        return expect(show(st), 'b@2 a@1 c@3');
    });
    step('normalizeGroupIds: dynamic ids below 1000 move above it, YAML ones stay', () => {
        const st = mk('!a@0', 'b@3', 'c@3', 'd@1005');
        st.normalizeGroupIds(() => 'line');
        return expect(show(st) + ' next ' + st.nextGroupId, 'a@0 b@1003 c@1003 d@1005 next 1006');
    });
    step('normalizeGroupIds: ungrouped dynamic entities get one group per graph', () => {
        const st = mk('a@1001', 'b', 'c', 'd');
        st.list[1].graphIndex = 2; st.list[2].graphIndex = 2; st.list[3].graphIndex = 3;
        st.normalizeGroupIds(() => 'line');
        return expect(show(st), 'a@1001 b@1002 c@1002 d@1003');
    });
    step('normalizeGroupIds: a dynamic group of two same-type graphs is split', () => {
        const st = mk('a@1000', 'b@1000', 'c@1000');
        st.list[0].graphIndex = 1; st.list[1].graphIndex = 1; st.list[2].graphIndex = 2;
        st.normalizeGroupIds(() => 'line');
        return expect(show(st), 'a@1001 b@1001 c@1002');
    });
    step('normalizeGroupIds: two graphs of different types stay linked', () => {
        const st = mk('a@1000', 'b@1000');
        st.list[0].graphIndex = 1; st.list[1].graphIndex = 2;
        st.normalizeGroupIds(e => e.entity === 'a' ? 'line' : 'timeline');
        return expect(show(st), 'a@1000 b@1000');
    });
    step('newGroupId counts up from the highest id in use', () => {
        const st = mk('!a@2', 'b@1010');
        st.normalizeGroupIds(() => 'line');
        return st.newGroupId() === 1011 && st.newGroupId() === 1012 ? true : 'wrong ids';
    });
    return { passed, failed };
};
