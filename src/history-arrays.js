// --------------------------------------------------------------------------------------
// Arrays of any length: an array is never spread into a call's arguments (push(...a),
// splice(i, 0, ...a), Math.min(...a)) — a browser takes a limited number of them (some
// 100 000 in Chrome): past it, "Maximum call stack size exceeded". One way, whatever the
// list's size (checked: tests/architecture.cjs no-spread-push). Pure, no state.
// --------------------------------------------------------------------------------------

// Every element of src appended to dst → dst
export const appendAll = (dst, src) => { for( const x of src ) dst.push(x); return dst; };

// Every element of src inserted in dst at index at, in order → dst
export const insertAll = (dst, at, src) => { const _tail = dst.splice(at); appendAll(dst, src); return appendAll(dst, _tail); };

// The smallest and the largest of values (Infinity, -Infinity when none)
export const minOf = values => { let m = Infinity; for( const v of values ) if( v < m ) m = v; return m; };
export const maxOf = values => { let m = -Infinity; for( const v of values ) if( v > m ) m = v; return m; };
