// --------------------------------------------------------------------------------------
// The requests to Home Assistant, regulated — one regulator for the page, every card's
// requests through it (its database answers the history and the statistics a few at a time:
// its recorder's workers, 4 with MariaDB; it answers them in the order they come, and a
// request sent can't be taken back)
//
// - Sent in the order asked — by their order (o.order: a phase, a block, then the place of its entity
//   in the graphs), then as asked —, at once, no delay between them, HA_WORKERS in flight at
//   most: each of Home Assistant's workers busy, none waiting there — a new window's
//   requests never behind a long queue there. A fixed count, nothing measured: requests of
//   sizes that different (an hour of a sensor, ten years of several) tell nothing of Home
//   Assistant's load by their time.
// - A request bringing nothing to the window shown now (o.stale(): asked for another window,
//   its time outside this one — or in the background) is sent only once none bringing some of
//   it waits; one asked for another window but bringing some of this one keeps its place.
// - Never a request sent again: an answer always comes (Home Assistant's websocket, or its
//   error when the connection is lost).
// Data only: no DOM, no event.
// --------------------------------------------------------------------------------------

// (Home Assistant's recorder: its database's workers — 4 with MariaDB)
export const HA_WORKERS = 4;

class Regulator
{
    constructor()
    {
        this.inFlight = 0;
        this.queue = [];
    }

    // A request: send() → a promise of Home Assistant's answer; o: { order (lower sent first),
    // stale() (it brings nothing to the window shown now) } → a promise of its answer
    request(send, o = {})
    {
        return new Promise((resolve, reject) => {
            const job = { send, resolve, reject, order: o.order ?? Infinity, stale: o.stale ?? ( () => false ) };
            // (after those of its order or a lower one: as asked within it)
            const k = this.queue.findIndex(x => x.order > job.order);
            this.queue.splice(k < 0 ? this.queue.length : k, 0, job);
            this._pump();
        });
    }

    // Anything in flight or waiting to be sent
    busy()
    {
        return this.inFlight > 0 || this.queue.length > 0;
    }

    // The requests waiting sent while fewer than HA_WORKERS are in flight: the first bringing
    // some of the window shown, else the first
    _pump()
    {
        while( this.queue.length && this.inFlight < HA_WORKERS ) {
            const k = Math.max(0, this.queue.findIndex(j => !j.stale()));
            this._send(this.queue.splice(k, 1)[0]);
        }
    }

    _send(job)
    {
        this.inFlight++;
        let _p;
        try { _p = Promise.resolve(job.send()); } catch( e ) { _p = Promise.reject(e); }
        _p.then(r => {
            this.inFlight--; this._pump();
            job.resolve(r);
        }, e => {
            this.inFlight--; this._pump();
            job.reject(e);
        });
    }
}

// (one for the page: every card, the info panel)
export const haRequests = new Regulator();
