// The shorter forms of curve names for a narrow legend (src/legend-names.js) on their own —
// no browser
const fs = require('fs');
const path = require('path');

// The module is ESM with no imports: loaded as is
const load = () => import('data:text/javascript;base64,' +
    Buffer.from(fs.readFileSync(path.join(__dirname, '../src/legend-names.js'))).toString('base64'));

module.exports = async function()
{
    const { shortNames, abbreviateDevice } = await load();
    let passed = 0, failed = 0;
    const step = (name, fn) => {
        let res;
        try { res = fn(); } catch( ex ) { res = 'EXCEPTION ' + ex.message; }
        if( res === true ) passed++; else failed++;
        console.log((res === true ? '  ✓ ' : '  ✗ ') + name + (res === true ? '' : '  -> ' + res));
    };
    const expect = (got, want) => JSON.stringify(got) === JSON.stringify(want) ? true : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`;
    const many = q => q === '(Filtered)';

    step('a device name abbreviated: initials, hyphenated words joined by -, … after several words', () =>
        expect([abbreviateDevice('Météo-France Villeveyrac'), abbreviateDevice('Ecowitt')], ['M-F V…', 'E']));
    step('a frequent qualifier as its initials; a rare one, or one with a value, as it is', () =>
        expect(shortNames([{ name: 'Wind (Filtered)' }, { name: 'Wind (raw)' }, { name: 'Wind (10 min)' }], { frequent: many }).map(f => f[0]),
               ['Wind (F)', undefined, undefined]));
    step('the device removed', () =>
        expect(shortNames([{ name: 'Ecowitt Vitesse du vent (Filtered)', device: 'Ecowitt' }, { name: 'Météo-France Villeveyrac Pression', device: 'Météo-France Villeveyrac' }], { frequent: many, lang: 'fr' }),
               [['Ecowitt Vitesse du vent (F)', 'Vitesse du vent (F)', 'Vitesse vent (F)'], ['Pression']]));
    step('removing the device would make two curves the same: abbreviated instead', () =>
        expect(shortNames([{ name: 'Ecowitt Vitesse du vent', device: 'Ecowitt' }, { name: 'Météo-France Villeveyrac Vitesse du vent', device: 'Météo-France Villeveyrac' }], { lang: 'fr' }),
               [['E Vitesse du vent', 'E Vitesse vent'], ['M-F V… Vitesse du vent', 'M-F V… Vitesse vent']]));
    step('the qualifier keeps two otherwise identical curves apart', () =>
        expect(shortNames([{ name: 'Ecowitt Vent (Filtered)', device: 'Ecowitt' }, { name: 'Ecowitt Vent', device: 'Ecowitt' }], { frequent: many }),
               [['Ecowitt Vent (F)', 'Vent (F)'], ['Vent']]));
    step('articles of the language only (English: of, the), elided ones (d\'eau → eau), never a whole name', () =>
        expect([shortNames([{ name: 'Level of the tank' }], { lang: 'en' })[0], shortNames([{ name: "Cuve d'eau de pluie" }], { lang: 'fr' })[0], shortNames([{ name: 'La' }], { lang: 'fr' })[0]],
               [['Level tank'], ['Cuve eau pluie'], []]));
    step('removing the articles would make two curves the same: kept', () =>
        expect(shortNames([{ name: 'Porte du garage' }, { name: 'Porte garage' }], { lang: 'fr' }), [[], []]));
    step('nothing to shorten: no form', () => expect(shortNames([{ name: 'Power' }]), [[]]));

    return { passed, failed };
};
