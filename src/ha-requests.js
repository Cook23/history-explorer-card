// --------------------------------------------------------------------------------------
// The requests to Home Assistant, regulated — one regulator for the page, every card's
// requests through it (its database answers the history and the statistics a few at a time:
// its recorder's workers, 4 with MariaDB)
//
// - Light ones (the very coarse statistics: a few rows, the time of the network only) are
//   sent at once, all together.
// - Heavy ones are sent in the order asked — by their order (o.order: a pass, then the place
//   of its entity in the graphs), then as asked; Home Assistant answers them in the order they
//   come, its workers taking them one after the other —, one every PACE_MS, up to `limit` in
//   flight: START_LIMIT at first, then as Home Assistant answers (TCP Vegas, as Netflix's
//   concurrency-limits does it): each answer's time against the time it would take with
//   nothing waiting — the quickest seen, base, plus its rows at the quickest time a row,
//   perRow —, the requests waiting at Home Assistant worked out from it (in flight × (1 −
//   quickest ÷ measured)): fewer than ALPHA, one more in flight; more than BETA, one less —
//   its workers kept busy, a request or two waiting there, never a flood.
// - A request shared (o.share: an entity without statistics, see card-history.js _shareOf)
//   takes at most 1 / o.share.n of what Home Assistant does for its epoch (the window) while
//   other requests wait or are in flight — all of it once alone (_next).
// - The background (now) is sent at once: the card sends it one at a time, only when nothing
//   heavy is in flight or waiting here (busy).
// - A request lost — no answer after its time-out (as TCP's: the time it should take, from
//   the times seen and their spread, TIMEOUT_MIN_MS at least), or the connection lost — is
//   sent again, RETRIES times at most, after RETRY_MS, once the connection is back; its
//   answer coming late is still taken (the first answer wins).
// Data only: no DOM, no event.
// --------------------------------------------------------------------------------------

const PACE_MS = 10, START_LIMIT = 10, MIN_LIMIT = 2, MAX_LIMIT = 20, ALPHA = 1, BETA = 3;
const TIMEOUT_MIN_MS = 15000, RETRIES = 2, RETRY_MS = [1000, 4000], RECONNECT_WAIT_MS = 120000, RECONNECT_POLL_MS = 500;

// (how many rows an answer holds: the history's and the statistics', by entity)
const _rowsOf = r => Object.values(r ?? {}).reduce((n, a) => n + ( Array.isArray(a) ? a.length : 0 ), 0);
// (the connection lost — home-assistant-js-websocket's ERR_CONNECTION_LOST)
const _lost = e => e === 3 || e?.code === 3 || e?.error?.code === 3;

class Regulator
{
    constructor()
    {
        this.limit = START_LIMIT;
        this.inFlight = 0;
        this.queue = [];
        this.lastSent = -Infinity;
        this.pumpTid = 0;
        // (the quickest answer, the quickest time a row; the time a row and its spread, smoothed)
        this.base = Infinity;
        this.perRow = Infinity;
        this.srtt = null;
        this.rttvar = 0;
        // (the heavy requests not shared in flight; what Home Assistant did, by epoch: its
        // total and each shared key's, in ms)
        this.othersInFlight = 0;
        this.used = new Map();
    }

    // A request: send() → a promise of Home Assistant's answer; o: { light, now (the
    // background), rows (how many it should give), order (lower sent first), connected() } →
    // a promise of its answer
    request(send, o = {})
    {
        return new Promise((resolve, reject) => {
            const job = { send, resolve, reject, light: !!o.light, now: !!o.now, rows: Math.max(1, o.rows || 1), connected: o.connected ?? ( () => true ), tries: 0, done: false, order: o.order ?? Infinity,
                          share: o.share ?? null, epoch: o.epoch ?? null };
            if( job.light || job.now ) this._send(job);
            else {
                // (after those of its order or a lower one: as asked within it)
                const k = this.queue.findIndex(x => x.order > job.order);
                this.queue.splice(k < 0 ? this.queue.length : k, 0, job);
                this._pump();
            }
        });
    }

    // Anything heavy in flight or waiting to be sent
    busy()
    {
        return this.inFlight > 0 || this.queue.length > 0;
    }

    // The heavy requests waiting sent, one every PACE_MS, while fewer than limit are in flight
    _pump()
    {
        if( this.pumpTid ) return;
        while( this.queue.length && this.inFlight < this.limit ) {
            const _wait = this.lastSent + PACE_MS - performance.now();
            if( _wait > 0 ) { this.pumpTid = setTimeout(() => { this.pumpTid = 0; this._pump(); }, _wait); return; }
            const k = this._next();
            if( k < 0 ) return;
            this._send(this.queue.splice(k, 1)[0]);
        }
    }

    // The next heavy request to send: the first waiting — but a shared one (o.share: { key,
    // n, epoch }) past its share of what Home Assistant did for its epoch (1 / n of it), while
    // others are waiting or in flight: left for later; -1, none for now
    _next()
    {
        const _others = this.othersInFlight > 0 || this.queue.some(j => !j.share);
        for( let k = 0; k < this.queue.length; k++ ) {
            const j = this.queue[k];
            if( !j.share || !_others ) return k;
            const u = this.used.get(j.share.epoch);
            if( !u || ( u.by.get(j.share.key) ?? 0 ) <= u.total / j.share.n ) return k;
        }
        return -1;
    }

    _send(job)
    {
        const _heavy = !job.light && !job.now, _at = performance.now();
        if( _heavy ) { this.inFlight++; this.lastSent = _at; if( !job.share ) this.othersInFlight++; }
        const _load = this.inFlight;
        let _over = false;
        // (no longer in flight: answered, failed, or past its time-out)
        const _release = () => { if( _over ) return; _over = true; if( _heavy ) { this.inFlight--; if( !job.share ) this.othersInFlight--; this._pump(); } };
        const _tid = setTimeout(() => { _release(); this._again(job, new Error('Home Assistant did not answer')); }, this._timeout(job.rows));
        let _p;
        try { _p = Promise.resolve(job.send()); } catch( e ) { _p = Promise.reject(e); }
        _p.then(r => {
            clearTimeout(_tid);
            if( !_over ) { this._measure(performance.now() - _at, _rowsOf(r), _load, _heavy); this._account(job, performance.now() - _at); }
            _release();
            if( !job.done ) { job.done = true; job.resolve(r); }
        }, e => {
            clearTimeout(_tid);
            const _late = _over;
            _release();
            if( job.done || _late ) return;
            if( _lost(e) ) this._again(job, e);
            else { job.done = true; job.reject(e); }
        });
    }

    // What Home Assistant did for a heavy request of an epoch (ms): its epoch's total, its key's
    // when shared — the last few epochs kept
    _account(job, ms)
    {
        if( job.light || job.now || job.epoch === null ) return;
        if( !this.used.has(job.epoch) ) {
            this.used.set(job.epoch, { total: 0, by: new Map() });
            if( this.used.size > 4 ) this.used.delete(this.used.keys().next().value);
        }
        const u = this.used.get(job.epoch);
        u.total += ms;
        if( job.share ) u.by.set(job.share.key, ( u.by.get(job.share.key) ?? 0 ) + ms);
    }

    // A request lost sent again — after RETRY_MS, once the connection is back —, RETRIES times
    // at most; first of the heavy ones waiting
    _again(job, e)
    {
        if( job.done ) return;
        if( job.tries >= RETRIES ) { job.done = true; job.reject(e); return; }
        const _from = performance.now();
        const _retry = () => {
            if( job.done ) return;
            if( !job.connected() && performance.now() - _from < RECONNECT_WAIT_MS ) { setTimeout(_retry, RECONNECT_POLL_MS); return; }
            if( job.light || job.now ) this._send(job);
            else { this.queue.unshift(job); this._pump(); }
        };
        setTimeout(_retry, RETRY_MS[job.tries++]);
    }

    // An answer's time (ms) for its rows, load in flight with it: the quickest ones kept (slowly
    // forgotten: Home Assistant may become slower), the time a row smoothed (its time-out);
    // a heavy one's, the limit set again (see above)
    _measure(ms, rows, load, heavy)
    {
        this.base = Math.min(this.base * 1.001, ms);
        const _row = Math.max(0, ms - this.base) / Math.max(1, rows);
        if( rows >= 50 ) this.perRow = Math.min(this.perRow * 1.002, _row);
        if( this.srtt === null ) { this.srtt = _row; this.rttvar = _row / 2; }
        else { this.rttvar = 0.75 * this.rttvar + 0.25 * Math.abs(this.srtt - _row); this.srtt = 0.875 * this.srtt + 0.125 * _row; }
        if( !heavy || !Number.isFinite(this.perRow) ) return;
        const _queued = load * ( 1 - ( this.base + rows * this.perRow ) / ms );
        // (one more only when the limit was reached: few requests answered quickly tell nothing of more)
        if( _queued < ALPHA ) { if( load >= this.limit - 1 ) this.limit = Math.min(MAX_LIMIT, this.limit + 1); }
        else if( _queued > BETA ) this.limit = Math.max(MIN_LIMIT, this.limit - 1);
    }

    // A request's time-out (ms): the time its rows should take, waiting included, with their
    // spread (TCP's: smoothed + 4 × spread), twice — TIMEOUT_MIN_MS at least
    _timeout(rows)
    {
        if( this.srtt === null ) return TIMEOUT_MIN_MS;
        return Math.max(TIMEOUT_MIN_MS, 2 * ( this.base + rows * ( this.srtt + 4 * this.rttvar ) ));
    }
}

// (one for the page: every card, the info panel)
export const haRequests = new Regulator();
