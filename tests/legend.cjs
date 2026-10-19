// The shorter forms of curve names for a narrow legend (src/legend-names.js) on their own —
// no browser
const fs = require('fs');
const path = require('path');

// The module is ESM with no imports: loaded as is
const load = () => import('data:text/javascript;base64,' +
    Buffer.from(fs.readFileSync(path.join(__dirname, '../src/legend-names.js'))).toString('base64'));

module.exports = async function()
{
    const { shortNames, abbreviatePrefix } = await load();
    let passed = 0, failed = 0;
    const step = (name, fn) => {
        let res;
        try { res = fn(); } catch( ex ) { res = 'EXCEPTION ' + ex.message; }
        if( res === true ) passed++; else failed++;
        console.log((res === true ? '  ✓ ' : '  ✗ ') + name + (res === true ? '' : '  -> ' + res));
    };
    const expect = (got, want) => JSON.stringify(got) === JSON.stringify(want) ? true : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`;
    const many = q => q === '(Filtered)';

    step('a prefix abbreviated: initials, hyphenated words joined by -, … after several words, the articles left out', () =>
        expect([abbreviatePrefix('Météo-France Villeveyrac'), abbreviatePrefix('Ecowitt'), abbreviatePrefix('Salle de bain', 'fr')], ['M-F V…', 'E', 'S B…']));
    step('a frequent qualifier as its initials; a rare one, or one with a value, as it is', () =>
        expect(shortNames([{ name: 'Wind (Filtered)' }, { name: 'Wind (raw)' }, { name: 'Wind (10 min)' }], { frequent: many }).map(f => f[0]),
               ['Wind (F)', 'Wind (raw)', 'Wind (10 min)']));
    step('the device abbreviated, then removed', () =>
        expect(shortNames([{ name: 'Ecowitt Vitesse du vent (Filtered)', device: 'Ecowitt' }, { name: 'Météo-France Villeveyrac Pression', device: 'Météo-France Villeveyrac' }], { frequent: many, lang: 'fr' }),
               [['Ecowitt Vitesse du vent (F)', 'E Vitesse du vent (F)', 'E Vitesse vent (F)', 'Vitesse vent (F)'],
                ['Météo-France Villeveyrac Pression', 'M-F V… Pression', 'M-F V… Pression', 'Pression']]));
    step('the first words shared with another curve abbreviated, without a device (the graph of the screenshots)', () =>
        expect(shortNames([{ name: 'Météo-France Villeveyrac Temperature (Filtered)' }, { name: 'Ecowitt Température extérieure (Filtered)' }, { name: 'Météo-France Villeveyrac Temperature', device: 'Météo-France' }], { frequent: many, lang: 'fr' }),
               [['Météo-France Villeveyrac Temperature (F)', 'M-F V… Temperature (F)', 'M-F V… Temperature (F)', 'Temperature (F)'],
                ['Ecowitt Température extérieure (F)', 'Ecowitt Température extérieure (F)', 'Ecowitt Température extérieure (F)', 'Ecowitt Température extérieure (F)'],
                ['Météo-France Villeveyrac Temperature', 'M-F V… Temperature', 'M-F V… Temperature', 'Temperature']]));
    step('the prefix never the whole name, a qualifier aside', () =>
        expect(shortNames([{ name: 'Wind (Filtered)' }, { name: 'Wind' }], { frequent: many }).map(f => f[3]), ['Wind (F)', 'Wind']));
    step('removing the prefix would make two curves the same: kept abbreviated', () =>
        expect(shortNames([{ name: 'Ecowitt Vitesse du vent', device: 'Ecowitt' }, { name: 'Météo-France Villeveyrac Vitesse du vent', device: 'Météo-France Villeveyrac' }], { lang: 'fr' }),
               [['Ecowitt Vitesse du vent', 'E Vitesse du vent', 'E Vitesse vent', 'E Vitesse vent'], ['Météo-France Villeveyrac Vitesse du vent', 'M-F V… Vitesse du vent', 'M-F V… Vitesse vent', 'M-F V… Vitesse vent']]));
    step('the qualifier keeps two otherwise identical curves apart', () =>
        expect(shortNames([{ name: 'Ecowitt Vent (Filtered)', device: 'Ecowitt' }, { name: 'Ecowitt Vent', device: 'Ecowitt' }], { frequent: many }),
               [['Ecowitt Vent (F)', 'E Vent (F)', 'E Vent (F)', 'Vent (F)'], ['Ecowitt Vent', 'E Vent', 'E Vent', 'Vent']]));
    step('articles of the language only (English: of, the), elided ones (d\'eau → eau), never a whole name', () =>
        expect([shortNames([{ name: 'Level of the tank' }], { lang: 'en' })[0][2], shortNames([{ name: "Cuve d'eau de pluie" }], { lang: 'fr' })[0][2], shortNames([{ name: 'La' }], { lang: 'fr' })[0][2]],
               ['Level tank', 'Cuve eau pluie', 'La']));
    step('removing the articles would make two curves the same: kept', () =>
        expect(shortNames([{ name: 'Le garage' }, { name: 'Garage' }], { lang: 'fr' }).map(f => f[2]), ['Le garage', 'Garage']));
    step('always four forms, step by step side by side — a step that changes nothing giving the same form', () =>
        expect(shortNames([{ name: 'Power' }, { name: 'Ecowitt Vent (Filtered)', device: 'Ecowitt' }], { frequent: many }),
               [['Power', 'Power', 'Power', 'Power'], ['Ecowitt Vent (F)', 'E Vent (F)', 'E Vent (F)', 'Vent (F)']]));
    step('thousands of names in linear time', () => {
        const _list = Array.from({ length: 3000 }, (_, i) => ({ name: `Device ${i % 50} Sensor number ${i}` }));
        const t = Date.now(); shortNames(_list); const ms = Date.now() - t;
        return ms < 500 ? true : `${ms} ms`;
    });

    return { passed, failed };
};
