// The shorter forms of curve names, for a legend too narrow for them: the legend takes the
// first form that fits, else cuts the last one with '…' before the value (deps/chart-hec.js,
// legend.labels.hecShortNames). From the least to the most shortened, each step keeping the
// curves of the graph apart:
//   1. a qualifier in parentheses that many entities carry — '(Filtered)' — as its initials,
//      '(F)': kept, since it often is all that tells two entities apart;
//   2. the name of the entity's device ('Météo-France Villeveyrac') removed — abbreviated
//      instead when that would make two curves the same: its words' initials, a hyphenated
//      word's joined by '-', '…' after them when it had several words ('M-F V…');
//   3. the articles of the language removed ('du', 'de la', 'the', 'of'…).
// Every name is the user's to choose (friendly names that fit): this only does its best
// with those that don't. The full name stays in the tooltip.

// Articles removed (step 3), by language — elided ones ("l'", "d'") end with an apostrophe
const ARTICLES = {
    fr: ['le', 'la', 'les', "l'", 'du', 'de', 'des', "d'", 'un', 'une', 'au', 'aux'],
    en: ['the', 'a', 'an', 'of'],
    de: ['der', 'die', 'das', 'des', 'dem', 'den', 'ein', 'eine', 'vom', 'von'],
    es: ['el', 'la', 'los', 'las', 'del', 'de', 'un', 'una'],
    nl: ['de', 'het', 'een', 'van'],
};

const clean = s => s.replace(/\s+/g, ' ').trim();

// A name's qualifiers in parentheses carried by many entities (frequent(q), q: '(Filtered)')
// as their initials — a qualifier with a digit (a value, a unit) stays as it is
function initialsOfQualifiers(name, frequent)
{
    return name.replace(/\(([^()]*[A-Za-zÀ-ÿ][^()]*)\)/g, (q, inner) =>
        /\d/.test(inner) || !frequent(q) ? q : '(' + inner.trim().split(/\s+/).map(w => w[0].toUpperCase()).join('') + ')');
}

// A device name abbreviated: its words' initials, a hyphenated word's joined by '-', '…'
// after them when there were several words ('Météo-France Villeveyrac' → 'M-F V…')
export function abbreviateDevice(device)
{
    const _words = device.trim().split(/\s+/);
    const _abbr = _words.map(w => w.split('-').filter(p => p).map(p => p[0].toUpperCase()).join('-')).join(' ');
    return _words.length > 1 ? _abbr + '…' : _abbr;
}

// name without its language's articles (the name itself when nothing would be left)
function withoutArticles(name, lang)
{
    const _articles = ARTICLES[lang] ?? [];
    if( !_articles.length ) return name;
    const _elided = _articles.filter(a => a.endsWith("'"));
    const _words = name.split(' ').map(w => {
        const _e = _elided.find(a => w.toLowerCase().startsWith(a) && w.length > a.length);
        return _e ? w.slice(_e.length) : w;
    }).filter(w => !_articles.includes(w.toLowerCase()));
    const _out = clean(_words.join(' '));
    return _out || name;
}

// curves: [{ name, device }] (device: the name of the entity's device, when known); options:
// frequent(q) — whether many entities carry the qualifier q ('(Filtered)'), lang — the
// language ('fr', 'en'…). → for each curve, its forms after each of the three steps, least
// shortened first — always three, a step that changes nothing giving the same form, so
// that the curves' forms stay step by step side by side (the legend takes every curve at
// the same step)
export function shortNames(curves, { frequent = () => false, lang = 'en' } = {})
{
    const _names = curves.map(c => String(c.name ?? ''));
    // (whether a name is another one's too, case aside — counted once for the whole list, not
    // name by name against every other: a selector's list holds thousands)
    const twice = list => { const _n = new Map(); for( const m of list ) { const k = m.toLowerCase(); _n.set(k, (_n.get(k) ?? 0) + 1); } return n => _n.get(n.toLowerCase()) > 1; };
    // A step applied to every curve, each kept as it was where it would make two curves the same
    const step = (prev, fn) => {
        const _next = prev.map((n, i) => clean(fn(n, i)) || n);
        const _nextTwice = twice(_next), _prevTwice = twice(prev);
        return _next.map((n, i) => _nextTwice(n) && !_prevTwice(prev[i]) ? prev[i] : n);
    };
    const s1 = step(_names, n => initialsOfQualifiers(n, frequent));
    // (the device removed; where that makes two curves the same, abbreviated instead)
    const _device = i => {
        const d = curves[i].device;
        return d && s1[i].toLowerCase().startsWith(d.toLowerCase() + ' ') ? d : null;
    };
    const _removed = s1.map((n, i) => _device(i) ? clean(n.slice(_device(i).length)) : n);
    const _removedTwice = twice(_removed);
    const s2 = s1.map((n, i) => {
        if( !_device(i) ) return n;
        const _clash = _removedTwice(_removed[i]);
        return _clash ? abbreviateDevice(_device(i)) + ' ' + _removed[i] : _removed[i];
    });
    const s3 = step(s2, n => withoutArticles(n, lang));
    return _names.map((n, i) => [s1[i], s2[i], s3[i]]);
}
