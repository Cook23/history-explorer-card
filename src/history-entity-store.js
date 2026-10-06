// The card's entities, as persisted (pconfig.entities): which entity is shown, in which
// group of linked graphs, in which order, with its own options (type, lineMode, color,
// hidden, interval, graphKey, graphIndex...). Every change to that list goes through here,
// so the rules that keep it consistent live in one place:
//   - a curve appears once — a curve is a series (an entity's state, or one of its
//     attributes) and, for a second curve of the same series in another graph, its copy
//     number (copy: 1, 2…): its key (keyOf);
//   - the entries of one group are always contiguous (a group is shown as one solid block
//     of one or more linked graphs), and the list's order is the display order between
//     groups — within a group, graphIndex orders the graphs;
//   - dynamic groups (added from the UI) have ids >= 1000, YAML ones below.
// Besides the options, the card keeps on an entry: colorSet (its color comes from the
// configuration — kept even when another curve of its graph has it), paletteColor (the
// palette's color drawn where its color — an entity's, thresholds — gives none), both saved
// so they stay the same after a reload; and unsavedFrom (where it was before a move that
// isn't saved — see savedList), never saved.
// Pure data: it knows nothing about graphs, charts, the DOM or Home Assistant. The graphs
// on screen are built from it by the card.

// An entry is a plain string (legacy) or an object with an .entity field
export function entityIdOf(e)
{
    return typeof e === 'string' ? e : e.entity;
}

const isObj = e => typeof e === 'object' && e !== null;

// The key of an entry's curve: its series id, then '#' and its copy number for a second
// (third…) curve of that series — the series id alone for the first, as before copies
// existed. Kept by the curve whichever graph it moves to.
export function keyOf(e)
{
    return isObj(e) && e.copy ? e.entity + '#' + e.copy : entityIdOf(e);
}

export class EntityStore
{
    // owner: the object whose .entities is the persisted list (the card's pconfig) — read
    // live, since loading a saved state replaces the whole list
    constructor(owner)
    {
        this.owner = owner;
        this.nextGroupId = 1000;
    }

    get list() { return this.owner.entities; }
    set list(v) { this.owner.entities = v; }

    // ── Lookups ──

    // (by a curve's key — see keyOf)
    indexOf(key) { return this.list.findIndex(e => keyOf(e) === key); }
    find(key) { return this.list.find(e => keyOf(e) === key); }
    has(key) { return this.indexOf(key) >= 0; }

    // The curves of series id, whichever their copy
    curvesOf(id) { return this.list.filter(e => entityIdOf(e) === id); }

    // The copy number of a new curve of series id: the first one free (0: none shown)
    newCopy(id)
    {
        const used = new Set(this.curvesOf(id).map(e => ( isObj(e) && e.copy ) || 0));
        let n = 0;
        while( used.has(n) ) n++;
        return n;
    }

    // A curve's entry (by its key) within one group
    inGroup(key, groupId) { return this.list.find(e => isObj(e) && keyOf(e) === key && e.groupId === groupId); }

    groupSize(groupId) { return this.list.filter(e => isObj(e) && e.groupId === groupId).length; }

    statics() { return this.list.filter(e => e.isStatic); }

    // A new dynamic group id
    newGroupId() { return this.nextGroupId++; }

    // Where an entry is now: its group, its graph in that group, and the entries before it
    // in the list (its place in the display order) — see unsavedFrom
    placementOf(entry)
    {
        const i = this.list.indexOf(entry);
        return { groupId: entry.groupId, graphKey: entry.graphKey, graphIndex: entry.graphIndex,
                 preceding: this.list.slice(0, i).map(keyOf) };
    }

    // The list as it is saved: an entry moved where its placement isn't saved (its
    // unsavedFrom: the placementOf it had before) is saved at that placement — right after
    // the nearest entry before it still in its group, else first of its group, else right
    // after the nearest entry before it still in the list, else first
    savedList()
    {
        const out = this.list.filter(e => !e?.unsavedFrom);
        for( const e of this.list.filter(e => e?.unsavedFrom) ) {
            const { unsavedFrom: u, ...saved } = e;
            for( const k of ['groupId', 'graphKey', 'graphIndex'] ) {
                if( u[k] === undefined ) delete saved[k]; else saved[k] = u[k];
            }
            const inGroup = k => isObj(out[k]) && out[k].groupId === u.groupId;
            const after = test => {
                for( let j = u.preceding.length - 1; j >= 0; j-- ) {
                    const k = out.findIndex(x => keyOf(x) === u.preceding[j]);
                    if( k >= 0 && test(k) ) return k + 1;
                }
                return -1;
            };
            let i = after(inGroup);
            if( i < 0 ) i = out.findIndex((x, k) => inGroup(k));
            if( i < 0 ) i = after(() => true);
            out.splice(Math.max(i, 0), 0, saved);
        }
        return out;
    }

    // ── Changes ──

    // Registers an entry (once)
    add(entry)
    {
        if( !this.list.includes(entry) ) this.list.push(entry);
        return entry;
    }

    // Removes an entry (dynamicOnly: never a YAML one); returns it
    remove(entry, dynamicOnly = false)
    {
        const i = this.list.indexOf(entry);
        return i >= 0 && !(dynamicOnly && entry.isStatic) ? this.list.splice(i, 1)[0] : undefined;
    }

    // Removes every entity added from the UI, keeps the YAML ones
    removeAllDynamic()
    {
        this.list = this.statics();
    }

    // A curve's entry, by its key, as an object (a legacy string entry is converted in place)
    entry(key)
    {
        const i = this.indexOf(key);
        if( i < 0 ) return undefined;
        if( !isObj(this.list[i]) ) this.list[i] = { entity: this.list[i] };
        return this.list[i];
    }

    // Makes every group contiguous again, groups in order of first appearance
    regroup()
    {
        const groups = new Map();
        for( const e of this.list ) {
            const key = (isObj(e) ? e.groupId : undefined) ?? Symbol();
            if( !groups.has(key) ) groups.set(key, []);
            groups.get(key).push(e);
        }
        this.list = [...groups.values()].flat();
    }

    // Moves an entry into group groupId, at the end of that group's block (at the end of the
    // list if the group has no other entry)
    moveToGroup(entry, groupId)
    {
        const i = this.list.indexOf(entry);
        if( i < 0 ) return;
        this.list.splice(i, 1);
        entry.groupId = groupId;
        let last = -1;
        this.list.forEach((e, k) => { if( isObj(e) && e.groupId === groupId ) last = k; });
        if( last >= 0 ) this.list.splice(last + 1, 0, entry); else this.list.push(entry);
    }

    // The entities of one graph of group groupId, in a new order (entities: objects with
    // .entity, .copy, .color, .fill — the graph's, in their new order). Only those entries
    // move, at the place of the first of them: a group can hold several graphs (a type
    // change keeps the group, to allow combining again later).
    setGraphOrder(groupId, entities)
    {
        const keys = new Set(entities.map(keyOf));
        const mine = e => isObj(e) && e.groupId === groupId && keys.has(keyOf(e));
        const entries = this.list.filter(mine);
        const first = this.list.findIndex(mine);
        const rest = this.list.filter(e => !mine(e));
        const ordered = entities.map(en => entries.find(e => keyOf(e) === keyOf(en)) || { entity: en.entity, copy: en.copy, groupId, color: en.color, fill: en.fill });
        rest.splice(first < 0 ? rest.length : first, 0, ...ordered);
        this.list = rest;
    }

    // The entries of group groupId in the order they're shown in (shownKeys: their keys,
    // graph by graph down the block, then legend order), at the group's current place. That
    // order is what carries the layout of a block of linked graphs across reloads and devices.
    syncGroupOrder(groupId, shownKeys)
    {
        if( groupId === null || groupId === undefined ) return;
        const mine = e => isObj(e) && e.groupId === groupId;
        const first = this.list.findIndex(mine);
        if( first < 0 ) return;
        const rank = e => { const i = shownKeys.indexOf(keyOf(e)); return i < 0 ? Infinity : i; };
        const entries = this.list.filter(mine).sort((a, b) => rank(a) - rank(b));
        const rest = this.list.filter(e => !mine(e));
        rest.splice(Math.min(first, rest.length), 0, ...entries);
        this.list = rest;
    }

    // Moves the entries movedKeys (their keys) right before (before) or after the entries
    // targetKeys — a graph (or a whole block) moved above or below another one
    moveBefore(movedKeys, targetKeys, before)
    {
        const moving = e => isObj(e) && movedKeys.has(keyOf(e));
        const moved = this.list.filter(moving);
        const rest = this.list.filter(e => !moving(e));
        let at;
        if( before ) {
            at = rest.findIndex(e => isObj(e) && targetKeys.has(keyOf(e)));
        } else {
            let last = -1;
            rest.forEach((e, k) => { if( isObj(e) && targetKeys.has(keyOf(e)) ) last = k; });
            at = last < 0 ? rest.length : last + 1;
        }
        rest.splice(at < 0 ? rest.length : at, 0, ...moved);
        this.list = rest;
    }

    // Repairs the group ids of a loaded list (older versions' bugs), then sets nextGroupId.
    // typeOf(entry): the entry's type (to tell two graphs of one group apart).
    normalizeGroupIds(typeOf)
    {
        const dyn = e => !e.isStatic;
        const grouped = e => e.groupId !== null && e.groupId !== undefined;

        // Dynamic groups used ids below 1000, which could collide with the YAML ones
        // (assigned 0, 1, 2... in order): moved to id + 1000. (null is "no group", not
        // group 0 — null < 1000 is true in JS, so it's excluded explicitly.)
        if( this.list.some(e => dyn(e) && grouped(e) && e.groupId < 1000) )
            this.list = this.list.map(e => ( dyn(e) && grouped(e) && e.groupId < 1000 ) ? { ...e, groupId: e.groupId + 1000 } : e);

        const next = () => Math.max(1000, ...this.list.map(e => e.groupId ?? 0)) + 1;

        // Dynamic entities without a group (left by a duplicate-entry bug fixed in 1.1.43):
        // one new group per graph, graphs told apart by their saved graphIndex
        if( this.list.some(e => dyn(e) && !grouped(e)) ) {
            let n = next();
            const byIndex = new Map();
            this.list = this.list.map(e => {
                if( !dyn(e) || grouped(e) ) return e;
                const k = e.graphIndex ?? Symbol();
                if( !byIndex.has(k) ) byIndex.set(k, n++);
                return { ...e, groupId: byIndex.get(k) };
            });
        }

        // The old renumbering also caught null (fixed in 1.1.43), putting every ungrouped
        // dynamic entity into one group 1000, each graph linked to the next. Its signature:
        // one dynamic group with two graphs (told apart by graphIndex) of the same type —
        // impossible otherwise, since same-type graphs of a dynamic group always combine.
        // Such a group is split back into one group per graph.
        const groups = new Map();
        for( const e of this.list ) {
            if( !dyn(e) || !grouped(e) ) continue;
            if( !groups.has(e.groupId) ) groups.set(e.groupId, new Map());
            const graphs = groups.get(e.groupId);
            const k = e.graphIndex ?? Symbol();
            if( !graphs.has(k) ) graphs.set(k, typeOf(e));
        }
        let n = next();
        for( const [groupId, graphs] of groups ) {
            const types = [...graphs.values()];
            if( new Set(types).size === types.length ) continue;
            const ids = new Map([...graphs.keys()].map(k => [k, n++]));
            this.list = this.list.map(e => ( dyn(e) && e.groupId === groupId && ids.has(e.graphIndex) ) ? { ...e, groupId: ids.get(e.graphIndex) } : e);
        }

        this.nextGroupId = Math.max(1000, Math.max(0, ...this.list.map(e => e.groupId ?? 0)) + 1);
    }
}
