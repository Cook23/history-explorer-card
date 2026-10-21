
import "../deps/moment.js";
import "../deps/FileSaver.js";
import { HA_ATTRIBUTES, seriesOf } from "./history-series.js";

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

function escapeSeperator(sep, state)
{
    if( state !== undefined && state !== null && String(state).indexOf(sep) >= 0 ) 
        return `"${state}"`;
    else 
        return state;
}


// --------------------------------------------------------------------------------------
// What both exports share: the entities shown (an attribute's curve: its entity), the
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

    exportFile(cardstate)
    {
        this.separator = cardstate.pconfig.exportSeparator ?? ',';
        this.timeFormat = cardstate.pconfig.exportTimeFormat ?? 'YYYY-MM-DD HH:mm:ss';
        this.numberLocale = cardstate.pconfig.exportNumberLocale;

        const t0 = cardstate.startTime.replace('+', '%2b');
        const t1 = cardstate.endTime.replace('+', '%2b');
        const l = [];
        for( const g of cardstate.graphs )
            for( const e of g.entities ) {
                const _id = seriesOf(e.entity).entity;
                if( !l.includes(_id) ) l.push(_id);
            }
        if( !l.length ) return;

        this.overlay = cardstate.ui.spinOverlay;
        document.body.appendChild(this.overlay);
        this._request(cardstate, l, t0, t1).then(this.exportCallback.bind(this), this.exportFailed.bind(this));
    }

    // The numbers' format (exportNumberLocale), or null: as they are
    numberFormat()
    {
        return this.numberLocale ? new Intl.NumberFormat(this.numberLocale, { maximumSignificantDigits: 20 }) : null;
    }

    // The file saved, its lines data; the spinner removed
    save(data)
    {
        const blob = new Blob(data, { type: "text/plain;charset=utf-8"});
        document.body.removeChild(this.overlay);
        saveAs(blob, "entities-" + moment().format('YYYY-MM-DD_HH:mm:ss') + ".csv");
    }

    exportFailed(error)
    {
        document.body.removeChild(this.overlay);
        console.log(error);
    }

}


// --------------------------------------------------------------------------------------
// Export CSV : history DB
// --------------------------------------------------------------------------------------

export class HistoryCSVExporter extends CSVExporter {

    exportFile(cardstate)
    {
        this.saveAttributes = cardstate.pconfig.exportAttributes;
        this._hass = cardstate._hass;
        super.exportFile(cardstate);
    }

    _request(cardstate, l, t0, t1)
    {
        return cardstate._hass.callWS(cardstate.historyRequest(l, t0, t1, this.saveAttributes));
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
                            v += `${this.separator}${a}`;
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
                        state = e.a ? localizeNumber(e.a[a], nf) : '';
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

    _request(cardstate, l, t0, t1)
    {
        return cardstate._hass.callWS(cardstate.statisticsRequest(l, t0, t1, cardstate.pconfig.exportStatsPeriod ?? 'hour'));
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
                const _cell = x => escapeSeperator(this.separator, x ? localizeNumber(x, nf) : '');
                data.push(t + this.separator + [e.state, e.mean, e.min, e.max].map(_cell).join(this.separator) + "\r\n");
            }
        }

        this.save(data);
    }

}
