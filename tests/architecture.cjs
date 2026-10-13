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

// The card's parts (HistoryCardState's methods, spread over files by role): which file
// defines each method, and what each method writes on the state — this.x, or this.state.x,
// this.pconfig.x, this.ui.x, this.i18n.x
const PART_FILES = CARD.filter(f => /^src\/(card-[^/]*|history-explorer-card)\.js$/.test(f));
function walk(n, f) { if( !n || typeof n !== 'object' ) return; if( Array.isArray(n) ) return n.forEach(x => walk(x, f)); if( typeof n.type === 'string' ) f(n); for( const k in n ) if( n[k] && typeof n[k] === 'object' ) walk(n[k], f); }
const PARTS = (() => {
    const methods = new Map(), writes = [];
    for( const file of PART_FILES ) {
        const src = read(file);
        const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'module', locations: true });
        walk(ast, n => {
            if( n.type !== 'ClassDeclaration' ) return;
            // (the card element itself — HistoryExplorerCard — isn't a part of the state)
            if( n.id?.name === 'HistoryExplorerCard' ) return;
            for( const m of n.body.body ) {
                if( m.type !== 'MethodDefinition' || !m.key.name ) continue;
                if( m.key.name !== 'constructor' ) methods.set(m.key.name, file);
                // (the state's constructor gives every field its first value: not a writer)
                if( m.key.name === 'constructor' ) continue;
                walk(m.value.body, x => {
                    if( x.type !== 'AssignmentExpression' && x.type !== 'UpdateExpression' ) return;
                    let t = x.left || x.argument; const chain = [];
                    while( t && t.type === 'MemberExpression' ) { chain.unshift(t.computed ? '[]' : t.property.name); t = t.object; }
                    if( t?.type !== 'ThisExpression' || !chain.length ) return;
                    const field = ['state', 'pconfig', 'ui', 'i18n'].includes(chain[0]) && chain[1] ? chain.slice(0, 2).join('.') : chain[0];
                    writes.push({ field, file, method: m.key.name, line: x.loc.start.line });
                });
            }
        });
    }
    return { methods, writes };
})();

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
    { id: 'datasets', why: "a graph's datasets are made and changed by card-charts.js (card-datasets.js fills their data); the others ask it",
      files: CARD.filter(f => !['src/card-charts.js', 'src/card-datasets.js'].includes(f)), re: /chart\??\.data\??\.datasets/g },
    { id: 'menus', why: "a menu's elements are card-menus.js's (and the selector's own)",
      files: CARD.filter(f => !['src/card-menus.js', 'src/card-toolbar.js'].includes(f)), re: /#(et|eo|ets|eoo)_/g },
    { id: 'rendering', why: "how something is drawn is Chart.js's (or the card's own toolbars' and menus' layout)",
      files: CARD, re: /getComputedStyle/g },
    { id: 'part-contracts', why: "a part calls another part's public methods only — its contract; a method starting with _ is its own",
      files: PART_FILES, check: (src, file) => [...src.matchAll(/this\.(_\w+)\(/g)]
          .filter(m => PARTS.methods.has(m[1]) && PARTS.methods.get(m[1]) !== file).map(m => ({ index: m.index, text: m[1] + ' (' + PARTS.methods.get(m[1]) + ')' })) },
    { id: 'state-owner', why: "each field of the card's state is written by one part (its constructor gives every field its first value)",
      files: PART_FILES, check: (src, file) => {
          const owners = new Map();
          for( const w of PARTS.writes ) (owners.get(w.field) ?? owners.set(w.field, new Set()).get(w.field)).add(w.file);
          const lines = src.split('\n'), at = l => lines.slice(0, l - 1).join('\n').length + 1;
          return PARTS.writes.filter(w => w.file === file && owners.get(w.field).size > 1)
              .map(w => ({ index: at(w.line), text: w.field + ' (also ' + [...owners.get(w.field)].filter(f => f !== file).join(', ') + ')' }));
      } },
    { id: 'inputs', why: "the gestures, the menus, the selector and the toolbar ask card-operations.js for a change of what's shown: they never change the entity list or the graphs themselves",
      files: ['src/card-gestures.js', 'src/card-menus.js', 'src/card-selector.js', 'src/card-toolbar.js'],
      re: /this\.store\.(add|remove|reset|removeAllDynamic|moveToGroup|setGraphOrder|syncGroupOrder|moveBefore|regroup|setGraphKey|newGroupId|normalizeGroupIds)\(|this\.(addGraph|detachGraph|rebuildGraph|detachAndRebuildRemaining|removeGraphs|placeGraphs|buildGraphsFromStore|clearGraphs|writeLocalState)\(/g },
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
            const hits = rule.check ? rule.check(s, f) : [...s.matchAll(rule.re)].map(m => ({ index: m.index, text: m[0] }));
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
