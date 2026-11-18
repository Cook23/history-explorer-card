// A value written as YAML — the card's configuration exported (see card-yaml.js): objects
// and lists in block form, each level indented by two spaces, a list's objects opened on
// their dash; a string quoted only when YAML would read it otherwise (a number, a boolean,
// null, a special character first, `: ` or ` #` inside, spaces around it, a line break)

const _isBlock = v => !!v && typeof v === 'object';
// (a Map: its keys in their own order — an indirect value's: entity first, then its thresholds)
const _size = v => Array.isArray(v) ? v.length : v instanceof Map ? v.size : Object.keys(v).length;

// (YAML's words for true, false and null, in every case it reads them so)
const _RESERVED = /^(true|false|yes|no|on|off|y|n|null|~)$/i;
const _NUMBER = /^[-+]?(\d[\d_]*(\.\d*)?|\.\d+)([eE][-+]?\d+)?$|^0x[0-9a-f]+$|^0o[0-7]+$|^[-+]?\.(inf|nan)$/i;

function _scalar(v)
{
    if( v === null || v === undefined ) return 'null';
    if( Array.isArray(v) ) return '[]';
    if( typeof v === 'object' ) return '{}';
    if( typeof v !== 'string' ) return String(v);
    const _quoted = v === '' || v !== v.trim() || _RESERVED.test(v) || _NUMBER.test(v) || /^[-?:,[\]{}#&*!|>'"%@`]/.test(v)
                 || /: |:$| #|[\n\r\t]/.test(v);
    return _quoted ? JSON.stringify(v) : v;
}

// (a number as a key written as is: a threshold, read back as that number)
function _key(k)
{
    return typeof k === 'number' ? String(k) : _scalar(String(k));
}

// v (an object or a list, not empty) as lines, each starting with pad
function _block(v, pad)
{
    if( Array.isArray(v) )
        return v.map(x => _isBlock(x) && _size(x) ? pad + '- ' + _block(x, pad + '  ').slice(pad.length + 2) : pad + '- ' + _scalar(x)).join('\n');
    return ( v instanceof Map ? [...v] : Object.entries(v) ).filter(([, x]) => x !== undefined)
        .map(([k, x]) => _isBlock(x) && _size(x) ? `${pad}${_key(k)}:\n${_block(x, pad + '  ')}` : `${pad}${_key(k)}: ${_scalar(x)}`).join('\n');
}

// v as YAML text (a key undefined left out), ending with a line break
export function toYaml(v)
{
    return ( _isBlock(v) && _size(v) ? _block(v, '') : _scalar(v) ) + '\n';
}
