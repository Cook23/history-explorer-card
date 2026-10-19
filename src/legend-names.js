// The shorter forms of curve names, for a legend too narrow for them: the legend takes the
// first form that fits, else cuts the last one with '…' before the value (deps/chart-hec.js,
// legend.labels.hecShortNames). From the least to the most shortened, each step keeping the
// curves of the graph apart:
//   1. a qualifier in parentheses that many entities carry — '(Filtered)' — as its initials,
//      '(F)': kept, since it often is all that tells two entities apart;
//   2. the name's prefix abbreviated: its words' initials, a hyphenated word's joined by
//      '-', '…' after them when it had several words ('Météo-France Villeveyrac' →
//      'M-F V…'). The prefix: the name of the entity's device, or the first words the name
//      shares with another one of the list ('Météo-France Villeveyrac Temperature (F)' and
//      'Météo-France Villeveyrac Temperature'), the longer — always something left after it,
//      a qualifier aside;
//   3. the articles of the language removed after it ('du', 'de la', 'the', 'of'…);
//   4. the abbreviated prefix removed.
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

// A prefix abbreviated: its words' initials — the language's articles left out —, a
// hyphenated word's joined by '-', '…' after them when there were several words
// ('Météo-France Villeveyrac' → 'M-F V…', 'Salle de bain' → 'S B…')
export function abbreviatePrefix(prefix, lang = 'en')
{
    const _words = withoutArticles(clean(prefix), lang).split(' ');
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

// Each name's prefix (step 2): the device's name it starts with, or the first words it
// shares with another name — the longer; '' when there's none. Never the whole name: a word
// at least left after it, the qualifiers in parentheses at its end aside. (Counted once for
// the whole list — each name's first words, a key per count of them —, not name by name
// against every other: a selector's list holds thousands)
function prefixes(names, devices)
{
    const _words = names.map(n => n.split(' '));
    // (how many words can be a prefix: all but the last one before the qualifiers at the end)
    const _most = names.map((n, i) => n.replace(/(\s*\([^()]*\))+$/, '').split(' ').length - 1);
    const _key = (i, k) => _words[i].slice(0, k).join(' ').toLowerCase();
    const _count = new Map();
    _words.forEach((w, i) => { for( let k = 1; k <= _most[i]; k++ ) _count.set(_key(i, k), (_count.get(_key(i, k)) ?? 0) + 1); });
    return names.map((n, i) => {
        let k = _most[i];
        while( k > 0 && !( _count.get(_key(i, k)) > 1 ) ) k--;
        const _shared = _words[i].slice(0, k).join(' ');
        const d = devices[i];
        const _device = d && n.toLowerCase().startsWith(d.toLowerCase() + ' ') && n.slice(d.length + 1).replace(/(\s*\([^()]*\))+$/, '').trim() ? n.slice(0, d.length) : '';
        return _device.length > _shared.length ? _device : _shared;
    });
}

// curves: [{ name, device }] (device: the name of the entity's device, when known); options:
// frequent(q) — whether many entities carry the qualifier q ('(Filtered)'), lang — the
// language ('fr', 'en'…). → for each curve, its forms after each of the four steps, least
// shortened first — always four, a step that changes nothing giving the same form, so
// that the curves' forms stay step by step side by side (the legend takes every curve at
// the same step)
export function shortNames(curves, { frequent = () => false, lang = 'en' } = {})
{
    const _names = curves.map(c => clean(String(c.name ?? '')));
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
    // (each name as its prefix and the rest after it — the prefix abbreviated where that
    // keeps the curves apart)
    const _prefix = prefixes(s1, curves.map(c => c.device));
    const _rest = s1.map((n, i) => n.slice(_prefix[i].length).trim());
    const _abbr = _prefix.map(p => p ? abbreviatePrefix(p, lang) : '');
    const s2 = step(s1, (n, i) => _abbr[i] ? _abbr[i] + ' ' + _rest[i] : n);
    const _abbreviated = i => s2[i] !== s1[i];
    const s3 = step(s2, (n, i) => _abbreviated(i) ? _abbr[i] + ' ' + withoutArticles(_rest[i], lang) : withoutArticles(n, lang));
    const s4 = step(s3, (n, i) => _abbreviated(i) ? n.slice(_abbr[i].length) : n);
    return _names.map((n, i) => [s1[i], s2[i], s3[i], s4[i]]);
}
