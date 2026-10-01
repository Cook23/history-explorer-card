// Static check of the sources: every identifier read is declared somewhere in reach — a
// variable left behind by a refactoring shows up here, before any test has to run it
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

// Sources checked, and whether each is an ES module or a plain script
const FILES = [
    ['src/history-explorer-card.js', 'module'],
    ['src/history-entity-store.js', 'module'],
    ['src/history-info-panel.js', 'module'],
    ['src/history-csv-exporter.js', 'module'],
    ['src/history-chart-vline.js', 'module'],
    ['deps/chart-hec.js', 'script'],
];

// Browser globals the sources use, and those the bundled deps/ scripts set
const GLOBALS = new Set([
    'window', 'document', 'navigator', 'location', 'screen', 'history', 'customElements', 'localStorage',
    'console', 'alert', 'confirm', 'performance', 'globalThis', 'arguments', 'this', 'undefined',
    'Math', 'Object', 'Array', 'Date', 'JSON', 'String', 'Number', 'Boolean', 'Symbol', 'Map', 'Set',
    'Promise', 'RegExp', 'Error', 'Function', 'Intl', 'Infinity', 'NaN',
    'isNaN', 'isFinite', 'parseFloat', 'parseInt', 'encodeURIComponent', 'decodeURIComponent', 'btoa', 'atob',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
    'queueMicrotask', 'structuredClone', 'getComputedStyle', 'fetch', 'Blob', 'URL', 'FileReader',
    'Event', 'CustomEvent', 'PointerEvent', 'Element', 'HTMLElement', 'HTMLCanvasElement', 'Node', 'ShadowRoot',
    'MutationObserver', 'ResizeObserver', 'IntersectionObserver',
    'md5hx', 'saveAs',
]);

// Names a pattern (parameter, variable, destructuring) declares
function patternNames(p, names)
{
    if( !p ) return;
    if( p.type === 'Identifier' ) names.add(p.name);
    else if( p.type === 'ObjectPattern' ) p.properties.forEach(q => patternNames(q.value || q.argument, names));
    else if( p.type === 'ArrayPattern' ) p.elements.forEach(q => patternNames(q, names));
    else if( p.type === 'AssignmentPattern' ) patternNames(p.left, names);
    else if( p.type === 'RestElement' ) patternNames(p.argument, names);
}

function children(n)
{
    const out = [];
    for( const k in n ) {
        const v = n[k];
        if( Array.isArray(v) ) v.forEach(x => { if( x && typeof x.type === 'string' ) out.push(x); });
        else if( v && typeof v.type === 'string' ) out.push(v);
    }
    return out;
}

// Names declared in a function's (or the program's) own scope — var/let/const, function
// declarations, classes, imports, parameters, catch parameters; nested functions excluded
function scopeNames(fn)
{
    const names = new Set();
    (fn.params || []).forEach(p => patternNames(p, names));
    if( fn.type === 'FunctionExpression' && fn.id ) names.add(fn.id.name);
    const walk = (n, top) => {
        if( !n || typeof n.type !== 'string' ) return;
        if( n.type === 'FunctionDeclaration' && !top ) { if( n.id ) names.add(n.id.name); return; }
        if( /Function/.test(n.type) && !top ) return;
        if( n.type === 'VariableDeclaration' ) n.declarations.forEach(d => patternNames(d.id, names));
        if( n.type === 'ImportDeclaration' ) n.specifiers.forEach(s => names.add(s.local.name));
        if( n.type === 'ClassDeclaration' && n.id ) names.add(n.id.name);
        if( n.type === 'CatchClause' ) patternNames(n.param, names);
        children(n).forEach(c => walk(c, false));
    };
    walk(fn.type === 'Program' ? fn : fn.body, true);
    return names;
}

// Identifiers read but declared in no enclosing scope
function undeclared(ast)
{
    const missing = new Set();
    const visit = (n, scopes, parent, key) => {
        if( /Function|Program/.test(n.type) ) scopes = scopes.concat([scopeNames(n)]);
        if( n.type === 'Identifier' ) {
            const notARead = (parent.type === 'MemberExpression' && key === 'property' && !parent.computed) ||
                (/^(Property|MethodDefinition|PropertyDefinition)$/.test(parent.type) && key === 'key' && !parent.computed) ||
                /Import|Export/.test(parent.type);
            if( !notARead && !GLOBALS.has(n.name) && !scopes.some(s => s.has(n.name)) ) missing.add(n.name);
            return;
        }
        for( const k in n ) {
            const v = n[k];
            if( Array.isArray(v) ) v.forEach(x => { if( x && typeof x.type === 'string' ) visit(x, scopes, n, k); });
            else if( v && typeof v.type === 'string' ) visit(v, scopes, n, k);
        }
    };
    visit(ast, [], null, null);
    return missing;
}

module.exports = async function()
{
    let passed = 0, failed = 0;
    for( const [file, sourceType] of FILES ) {
        const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
        const missing = undeclared(acorn.parse(src, { ecmaVersion: 2022, sourceType }));
        if( missing.size ) failed++; else passed++;
        console.log((missing.size ? '  ✗ ' : '  ✓ ') + file + (missing.size ? '  -> undeclared: ' + [...missing].join(', ') : ''));
    }
    return { passed, failed };
};
