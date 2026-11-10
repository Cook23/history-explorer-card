
import "../deps/moment.js";
import "../deps/FileSaver.js";
import { HA_ATTRIBUTES } from "./history-series.js";
import { STATS_EXPORT_PERIODS } from "./history-options.js";

var moment = window.HXLocal_moment;

// --------------------------------------------------------------------------------------
// Helper functions
// --------------------------------------------------------------------------------------

function isNumber(n) { return !isNaN(parseFloat(n)) && !isNaN(n-0); }

function localizeNumber(state, nf) 
{
    if( !nf || state === undefined || state === null || state === '' || !isNumber(state) ) return state;
    return nf.format(+state);
}

// A cell of the file: nothing for no value (a value of 0 written); a list or an object (an
// attribute's) as JSON; quoted when it holds the separator, a quote or a line break — its
// quotes doubled
function escapeSeperator(sep, state)
{
    if( state === undefined || state === null ) return '';
    const v = typeof state === 'object' ? JSON.stringify(state) : String(state);
    return v.includes(sep) || v.includes('"') || /[\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}


// --------------------------------------------------------------------------------------
// What both exports share: the series shown (an attribute's curve: that attribute), the
// spinner while Home Assistant answers, the file saved — each export its own request
// (_request) and its own lines (exportCallback)
// --------------------------------------------------------------------------------------

class CSVExporter {

    constructor()
    {
        this.overlay = null;
        this.separator = undefined;
        this.timeFormat = undefined;
    }

    // The series of graphs — the values their curves show: an entity's state, an attribute —,
    // over the window shown
    exportFile(cardstate, graphs)
    {
        this.separator = cardstate.pconfig.exportSeparator;
        this.window = [cardstate.startTime, cardstate.endTime];
        this.source = this.sourceOf(cardstate);
        this.timeFormat = cardstate.pconfig.exportTimeFormat;
        this.numberLocale = cardstate.pconfig.exportNumberLocale;

        const l = [];
        for( const g of graphs )
            for( const e of g.entities ) {
                if( !l.includes(e.entity) ) l.push(e.entity);
            }
        if( !l.length ) return;

        this.overlay = cardstate.ui.spinOverlay;
        document.body.appendChild(this.overlay);
        this._request(cardstate, l).then(this.exportCallback.bind(this), this.exportFailed.bind(this));
    }

    // The numbers' format (exportNumberLocale), or null: as they are
    numberFormat()
    {
        return this.numberLocale ? new Intl.NumberFormat(this.numberLocale, { maximumSignificantDigits: 20 }) : null;
    }

    // The file saved, its lines data, named as the tooltip's first line: its source — History,
    // Statistics and their period —, then the window: its start, its end (its time alone on
    // the same day) — 'Statistics 1 h - 2026-11-01 00-00 - 2026-11-09 11-15.csv' (no ':' in a
    // file name: it can't hold one everywhere); the spinner removed
    save(data)
    {
        // (a CSV: its type says so — an app naming the file by it, HA Companion, gives it .csv)
        const blob = new Blob(data, { type: "text/csv;charset=utf-8" });
        document.body.removeChild(this.overlay);
        const t0 = moment(this.window[0]), t1 = moment(this.window[1]);
        const _end = t1.format(t0.isSame(t1, 'day') ? 'HH-mm' : 'YYYY-MM-DD HH-mm');
        saveAs(blob, `${this.source} - ${t0.format('YYYY-MM-DD HH-mm')} - ${_end}.csv`);
    }

    exportFailed(error)
    {
        document.body.removeChild(this.overlay);
        console.error('history-explorer-card: CSV export failed', error);
    }

}


// --------------------------------------------------------------------------------------
// Export CSV : history DB
// --------------------------------------------------------------------------------------

export class HistoryCSVExporter extends CSVExporter {

    exportFile(cardstate, graphs)
    {
        this.saveAttributes = cardstate.pconfig.exportAttributes;
        this._hass = cardstate._hass;
        super.exportFile(cardstate, graphs);
    }

    // (from the cache first, what it lacks asked to Home Assistant — with the attributes, all)
    _request(cardstate, l)
    {
        return cardstate.exportRows('history', l, this.saveAttributes);
    }

    // (the file's source: History)
    sourceOf(cardstate)
    {
        return cardstate.sourceLabel(null);
    }

    exportCallback(result)
    {
        const data = [], nf = this.numberFormat();
        let attributes = [];

        data.push(`Time stamp${this.separator}State\r\n`);

        for( let entity in result ) {

            const r = result[entity];
            if( !r.length ) continue;

            let v = entity;

            if( this.saveAttributes ) {
                attributes = [];
                if( this._hass.states[entity] ) {
                    v += `${this.separator}State`;
                    for( let a in this._hass.states[entity].attributes ) {
                        if( !HA_ATTRIBUTES.includes(a) ) {
                            attributes.push(a);
                            v += this.separator + escapeSeperator(this.separator, a);
                        }
                    }
                }
            }

            data.push(v + "\r\n");

            for( let e of r ) {
                const t = moment(e.lu * 1000).format(this.timeFormat);
                let state = localizeNumber(e.s, nf);
                let v = t + this.separator + escapeSeperator(this.separator, state);
                if( this.saveAttributes ) {
                    for( let a of attributes ) {
                        state = localizeNumber(e.a?.[a], nf);
                        v += this.separator + escapeSeperator(this.separator, state);
                    }
                }
                data.push(v + "\r\n");
            }

        }

        this.save(data);
    }

}


// --------------------------------------------------------------------------------------
// Export CSV : statistics DB
// --------------------------------------------------------------------------------------

export class StatisticsCSVExporter extends CSVExporter {

    // (period: the one chosen in the menu — STATS_EXPORT_PERIODS)
    exportFile(cardstate, graphs, period)
    {
        this.period = period;
        super.exportFile(cardstate, graphs);
    }

    // (from the cache first, what it lacks asked to Home Assistant)
    _request(cardstate, l)
    {
        return cardstate.exportRows(this.period, l);
    }

    // (the file's source: Statistics and their period)
    sourceOf(cardstate)
    {
        return cardstate.sourceLabel(STATS_EXPORT_PERIODS.find(p => p.period === this.period)?.ms ?? 0);
    }

    exportCallback(result)
    {
        const data = [], nf = this.numberFormat();

        data.push(`Time stamp${this.separator}State${this.separator}Mean${this.separator}Min${this.separator}Max\r\n`);

        for( let entity in result ) {
            const r = result[entity];
            if( !r.length ) continue;
            data.push(entity + "\r\n");
            for( let e of r ) {
                const t = moment(e.start).format(this.timeFormat);
                const _cell = x => escapeSeperator(this.separator, localizeNumber(x, nf));
                data.push(t + this.separator + [e.state, e.mean, e.min, e.max].map(_cell).join(this.separator) + "\r\n");
            }
        }

        this.save(data);
    }

}
