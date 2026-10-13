// The architecture (ARCHITECTURE.md), checked on the sources: each part keeps to its own job
// and reaches another one only through its contract. A rule broken fails here, before any
// review. An exception is written below with its reason — it shows in the diff, for the
// author to agree with — and one no longer needed fails too.
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const CARD = fs.readdirSync(path.join(ROOT, 'src')).filter(f => f.endsWith('.js')).map(f => 'src/' + f);
const CONTRACT = read('deps/Chart Custom.js.md');
const documented = name => new RegExp('\\b' + name + '\\b').test(CONTRACT);

// A source without its comments (blanked, the lines kept: the line numbers stay right)
function code(file)
{
    const src = read(file), out = src.split('');
    acorn.parse(src, { ecmaVersion: 2022, sourceType: file.startsWith('src/') ? 'module' : 'script',
        onComment: (block, text, start, end) => { for( let i = start; i < end; i++ ) if( out[i] !== '\n' ) out[i] = ' '; } });
    return out.join('');
}

// Stock Chart.js API the card may use on a chart or on Chart (chartjs.org, 2.7)
const STOCK = new Set(['data', 'options', 'config', 'update', 'resize', 'destroy', 'helpers', 'defaults']);

const RULES = [
    { id: 'chart-internals', why: 'the card never reads or sets what Chart.js keeps for itself (its layout, its meta, what it drew, anything _hec)',
      files: CARD, re: /getDatasetMeta|chartArea|legendHitBoxes|\.scales\[|\b_hec|\._view\b|chart\??\.ctx\b|measureText|getContext\(/g },
    { id: 'chart-contract', why: "the card uses only Chart.js's stock API and what deps/Chart Custom.js.md documents",
      files: CARD, check: src => {
          const out = [];
          // (a chart's member, an option set on a chart already made, Chart's and Chart.hecUi's
          // members, any hec… name)
          for( const m of src.matchAll(/\.chart\??\.([A-Za-z_]\w*)(?:\??\.([A-Za-z_]\w*))?/g) ) {
              const ok = m[1] === 'options' && m[2] ? STOCK_OPTIONS.has(m[2]) || documented(m[2]) : STOCK.has(m[1]) || documented(m[1]);
              if( !ok ) out.push({ index: m.index, text: m[0] });
          }
          for( const m of src.matchAll(/\bChart\.(?:hecUi\.)?([A-Za-z_]\w*)/g) )
              if( !STOCK.has(m[1]) && !documented(m[1]) ) out.push({ index: m.index, text: m[0] });
          for( const m of src.matchAll(/\bhec[A-Z]\w*/g) )
              if( !documented(m[0]) ) out.push({ index: m.index, text: m[0] });
          return out;
      } },
    { id: 'no-business-in-chart', why: "Chart.js never knows what an entity, Home Assistant, the store or the card's texts are",
      files: ['deps/chart-hec.js', 'deps/timeline.js'], re: /\b(entity|entities|entity_id|hass|pconfig|store|i18n|statistics?)\b/gi },
    { id: 'pure-data', why: 'these parts are data only: no DOM, no style, no event',
      files: ['src/history-entity-store.js', 'src/legend-names.js', 'src/history-units.js', 'src/history-options.js', 'src/history-series.js', 'src/card-values.js'],
      re: /\bdocument\b|getComputedStyle|querySelector|addEventListener|\.style\b|innerHTML|getBoundingClientRect|\bChart\b/g },
    { id: 'persistence', why: 'what is kept between sessions is read and written by card-storage.js only',
      files: CARD.filter(f => f !== 'src/card-storage.js'), re: /localStorage|frontend\/(set|get)_user_data/g },
    { id: 'store', why: 'the entity list changes only through the store',
      files: CARD.filter(f => f !== 'src/history-entity-store.js'), re: /pconfig\.entities\s*(=(?!=)|\.(push|splice|unshift|pop|shift|sort|reverse)\()/g },
    { id: 'graph-gestures', why: "a gesture on a graph is Chart.js's: the card listens only to its own toolbars, menus and dialogs",
      files: CARD.filter(f => !['src/card-toolbar.js', 'src/card-menus.js', 'src/card-selector.js', 'src/card-tests.js'].includes(f)),
      re: /addEventListener\(\s*(?!['"](click|change|keydown|focusin|focusout|input|selectionchange)['"])/g },
    { id: 'datasets', why: "a graph's datasets are made and changed by card-graphs.js (card-datasets.js fills their data); the others ask it",
      files: CARD.filter(f => !['src/card-graphs.js', 'src/card-datasets.js'].includes(f)), re: /chart\??\.data\??\.datasets/g },
    { id: 'menus', why: "a menu's elements are card-menus.js's (and the selector's own)",
      files: CARD.filter(f => !['src/card-menus.js', 'src/card-toolbar.js'].includes(f)), re: /#(et|eo|ets|eoo)_/g },
    { id: 'rendering', why: "how something is drawn is Chart.js's (or the card's own toolbars' and menus' layout)",
      files: CARD, re: /getComputedStyle/g },
];

// Stock Chart.js options the card sets on a chart already made (chartjs.org, 2.7)
const STOCK_OPTIONS = new Set(['scales', 'layout', 'legend', 'tooltips', 'elements']);

// The exceptions: [rule, file, the text matched, why it's right there]
const EXCEPTIONS = [
    ['store', 'src/history-explorer-card.js', 'pconfig.entities             =', 'the card creates the list the store then manages'],
    ['graph-gestures', 'src/card-gestures.js', 'addEventListener(', 'during a cut, a press anywhere on the page or Escape cancels it — the page, not a graph'],
    ['datasets', 'src/card-values.js', 'chart.data.datasets', "the values read a curve's own data there (its unit, its scale, its period, its color, hidden), never change it"],
    ['rendering', 'src/card-toolbar.js', 'getComputedStyle', "the toolbar's own layout"],
    ['rendering', 'src/card-menus.js', 'getComputedStyle', "a menu's own layout"],
    ['rendering', 'src/history-default-colors.js', 'getComputedStyle', "a color option naming a theme variable (--name), resolved to the color the card gives"],
    ['rendering', 'src/history-explorer-card.js', 'getComputedStyle', "the theme dark or light, from the card's background: the card's choice of state colors"],
];

module.exports = async function()
{
    let passed = 0, failed = 0;
    const used = new Set(), sources = {};
    const src = f => sources[f] ??= code(f);
    for( const rule of RULES ) {
        const found = [];
        for( const f of rule.files ) {
            const s = src(f);
            const hits = rule.check ? rule.check(s) : [...s.matchAll(rule.re)].map(m => ({ index: m.index, text: m[0] }));
            for( const h of hits ) {
                const line = s.slice(0, h.index).split('\n').length, lineText = s.split('\n')[line - 1];
                const ex = EXCEPTIONS.findIndex(([r, ef, t]) => r === rule.id && ef === f && lineText.includes(t));
                if( ex >= 0 ) { used.add(ex); continue; }
                found.push(`${f}:${line} ${h.text}`);
            }
        }
        if( found.length ) failed++; else passed++;
        console.log((found.length ? '  ✗ ' : '  ✓ ') + rule.id + ': ' + rule.why + (found.length ? '\n      ' + found.join('\n      ') : ''));
    }
    const stale = EXCEPTIONS.filter((e, i) => !used.has(i));
    if( stale.length ) failed++; else passed++;
    console.log((stale.length ? '  ✗ ' : '  ✓ ') + 'every exception still needed' + (stale.length ? '\n      ' + stale.map(e => e.slice(0, 3).join(' | ')).join('\n      ') : ''));
    return { passed, failed };
};
