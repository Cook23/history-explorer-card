// A mock of the few Home Assistant APIs the card uses: states, history, long-term
// statistics, user data (stored by the test, see lib.cjs). The card under test is the
// built history-explorer-card.js; the config comes from the test (window.CFG), the
// mock's own settings too (window.MOCK, all optional):
//   series      history as real series (a sine for numbers, on/off every 2 h for the
//               others) — else one value per entity, its current state
//   historyDays history kept that many days back (older: statistics only)
//   fail        WS message types that fail
//   language    Home Assistant's language ('en')
//   dark        dark theme
//   historyDelay, userDataDelay   ms Home Assistant takes to answer for the history and the
//               statistics, and for the user data (none: at once)
//   historyStep seconds between two values of a series (600)
//   rows        an entity's history as given: { id: [[seconds before now, state], …] } — [] none:
//               only the states set (setState, setBefore)
//   statsLag    seconds after an hour's end before its statistics exist (600)
//   noStatistics entities without long-term statistics (whatever their state_class)
//   statsFrom   { id: days }: an entity's statistics only for its last days (a unit changed)
//   json        the history and statistics answered as Home Assistant's websocket does: a
//               JSON text parsed by the page
//   cost        { base, history, statistics, workers }: Home Assistant answering the history and
//               the statistics workers requests at a time (its database: 1 by default), in the
//               order they come, each in base ms plus, per value returned, history or
//               statistics ms — instead of historyDelay; window.__mockWaiting: the most
//               requests seen waiting for a worker
//               cost.read: ms more per hourly row the database reads — Home Assistant reads
//               the hourly rows for the daily, weekly and monthly statistics and reduces them
//               in Python: every hour of the time asked, however few rows it returns
//   clones      that many more sensors with statistics: sensor.s1, sensor.s2…
//   fastStats   the statistics worked out at once (from the sine), not compiled from the history
//   states      more entities: { id: { state, unit, state_class } } (a data set's: see dataset.cjs)
//   commitInterval  seconds Home Assistant's recorder takes to write a state set (setState) in
//               the history (its commit_interval: it writes every so often) — pushed at once,
//               in the history only then; none: at once
//   setBefore   { id: [seconds before the page opened, state] }: a state set then (as setState —
//               written by the recorder commitInterval later)
//   notRecorded entities Home Assistant's recorder doesn't keep: no history at all
//   system      Home Assistant tells what it runs on (system health, hardware), as to an
//               administrator: a Raspberry Pi 5, Home Assistant OS, MariaDB — else nothing
// The entity and device registries (hass.entities, hass.devices) give sensor.power and
// sensor.rain the device 'Ecowitt', sensor.power2 'Météo-France Villeveyrac'.
// Every WS request is logged in window.__ws ({type, start, end, ids, period}).
// setState(id, value, attributes) pushes the change to every element in window.hassTargets.
window.logs=[]; window.onerror=(m)=>{logs.push('ERR '+m)};
const _ce=console.error; console.error=(...a)=>{logs.push('CE '+a.join(' '));_ce(...a)};
const MOCK=window.MOCK||{};
const lc=new Date(Date.now()-3600e3).toISOString();
const ent=(id,name,unit,val,sc)=>({entity_id:id,state:val,last_changed:lc,last_updated:lc,attributes:Object.assign({friendly_name:name},unit?{unit_of_measurement:unit}:{},sc?{state_class:sc}:{})});
const STATES={
 'sensor.watering_cycle':ent('sensor.watering_cycle','cycle','d','3','measurement'),
 'sensor.days_to_watering':ent('sensor.days_to_watering','days to','d','2','measurement'),
 'input_number.watering_in_progress':ent('input_number.watering_in_progress','in progress',null,'1'),
 'sensor.rain':ent('sensor.rain','rain','mm','4','measurement'),
 'sensor.power':ent('sensor.power','power','W','400','measurement'),
 'binary_sensor.a':ent('binary_sensor.a','door a',null,'on'),
 'binary_sensor.b':ent('binary_sensor.b','door b',null,'off'),
 'sensor.power_kw':ent('sensor.power_kw','power kw','kW','1.2','measurement'),
 'sensor.energy':ent('sensor.energy','energy','kWh','12','total_increasing'),
 'sensor.power2':ent('sensor.power2','power two','W','300','measurement'),
 'sensor.wind':ent('sensor.wind','wind direction','°','350','measurement'),
 'sensor.net_energy':ent('sensor.net_energy','net energy','kWh','3','total'),
 'sensor.gas':ent('sensor.gas','gas','m³','120','total_increasing'),
 'sensor.tank':ent('sensor.tank','tank','L','800','measurement'),
 'sensor.wind_rad':ent('sensor.wind_rad','wind (rad)','rad','1.5708','measurement'),
 'sensor.wind_grad':ent('sensor.wind_grad','wind (grad)','gon','100','measurement'),
 'sensor.energy2':ent('sensor.energy2','energy2','kWh','5','total_increasing'),
 // colors held by entities (an entity's `color`): series cycle through attributes.values
 'input_text.curve_color':ent('input_text.curve_color','curve color',null,'#0000ff'),
 'input_text.curve_thresholds':ent('input_text.curve_thresholds','curve thresholds',null,"{0: 'green', 800: 'red'}"),
 'input_text.not_a_color':ent('input_text.not_a_color','not a color',null,'nothing'),
 'sensor.clim_mode':ent('sensor.clim_mode','clim mode',null,'hot'),
 // attributes shown as curves: a number, a text, and what is never offered (a list, HA's own)
 'climate.salon':ent('climate.salon','salon',null,'heat'),
 // a weather entity as Home Assistant gives one: its attributes' units in X_unit attributes
 'weather.villeveyrac':ent('weather.villeveyrac','Villeveyrac',null,'rainy'),
 // the sun: its azimuth goes round (a direction), its elevation, from -90 to 90, doesn't
 'sun.sun':ent('sun.sun','Sun',null,'above_horizon'),
 // a light: its brightness from 0 to 255, shown by Home Assistant in %
 'light.salon':ent('light.salon','salon light',null,'on'),
};
Object.assign(STATES['climate.salon'].attributes, { current_temperature: 19.5, temperature: 20, apparent_temperature: 21, hvac_action: 'heating', humidity: '45 %', led_color: 'green', visibility_unit: 'km', source: 'sensor.power', release_url: 'https://github.com/x/y/releases/v2.7.0', installed_version: 'v2.7.0', auto_update: false, display_precision: 1, min_temp: 7, max_temp: 35, target_temp_step: 0.5, manufacturer: 'Netatmo', last_seen: '2026-10-14T10:00:00+00:00', next_service: '2027-01-15', hvac_modes: ['heat', 'off'], supported_features: 17 });
Object.assign(STATES['sun.sun'].attributes, { azimuth: 200.5, elevation: 30.2, rising: false });
Object.assign(STATES['light.salon'].attributes, { brightness: 128, color_temp_kelvin: 3000, color_mode: 'color_temp', supported_color_modes: ['color_temp'] });
Object.assign(STATES['weather.villeveyrac'].attributes, { temperature: 21.7, apparent_temperature: 29, temperature_unit: '°C', humidity: 85, pressure: 1016.4, pressure_unit: 'hPa',
    wind_bearing: 130, wind_gust_speed: 0, wind_speed: 14.4, wind_speed_unit: 'km/h', visibility_unit: 'km', precipitation_unit: 'mm', attribution: 'Data provided by Météo-France', supported_features: 3,
    // (sub-attributes: a list of dictionaries)
    forecast: [{ datetime: '2026-10-20T12:00:00+00:00', condition: 'sunny', temperature: 23.5, templow: 14 }, { datetime: '2026-10-21T12:00:00+00:00', condition: 'rainy', temperature: 18, templow: 12 }] });
for(let k=1;k<=(MOCK.clones||0);k++) STATES['sensor.s'+k]=ent('sensor.s'+k,'sensor '+k,'W',String(100+k),'measurement');
// (MOCK.states: more entities, { id: { state, unit, state_class } } — a data set's, see dataset.cjs)
for(const [id,a] of Object.entries(MOCK.states||{})) STATES[id]=ent(id,id,a.unit||null,String(a.state),a.state_class);
STATES['sensor.clim_mode'].attributes.values=['hot','cold','off'];
STATES['input_text.curve_color'].attributes.values=['red','#0000ff'];
STATES['input_text.curve_thresholds'].attributes.values=[STATES['input_text.curve_thresholds'].state];
STATES['sensor.net_energy'].attributes.device_class='energy';
STATES['sensor.tank'].attributes.device_class='volume_storage';
// (each entity's state when the page opened: the base of its series, whatever's set later)
const INIT=Object.fromEntries(Object.entries(STATES).map(([id,st])=>[id,st.state]));
// (the series's last step when the page opened: see valueAt)
const T0=Math.floor(Date.now()/1000/(MOCK.historyStep||600))*(MOCK.historyStep||600);
window.userData={};
window.__ws=[];
// A state change, as Home Assistant pushes it: new state (and attributes changed), new
// last_changed (last_updated alone for attributes alone), new hass object; the history from its
// time on (SET: each state set, its attributes — the first one, those before it too)
const SET={};
window.setState=(id,v,attributes,at=Date.now())=>{ const t=new Date(at).toISOString(), was=inSeries(id) ? seriesState(id) : STATES[id], lu=Date.parse(t)/1000;
  STATES[id]={...was,state:String(v),last_changed:String(v)===was.state ? was.last_changed : t,last_updated:t,attributes:{...was.attributes,...(attributes||{})}};
  (SET[id]??=[]).push({s:String(v),lu,a:STATES[id].attributes,wasA:was.attributes,was:was.state});
  (window.hassTargets||[]).forEach(x=>{ x.hass=mkHass(); }); };
// (each entity's state as Home Assistant has it: in its history from its last_changed on — with
// rows, its last one, at its time; a series's: its value now, see seriesState)
for(const [id,st] of Object.entries(STATES)){
  const r=MOCK.rows?.[id], last=r?.length ? r.reduce((x,y)=>x[0]<y[0]?x:y) : null;
  if(last){ st.state=String(last[1]); st.last_changed=st.last_updated=new Date(Date.now()-last[0]*1000).toISOString(); }
  if(r && !r.length || inSeries(id)) continue;
  SET[id]=[{s:st.state,lu:Date.parse(st.last_changed)/1000,a:st.attributes,wasA:st.attributes,was:st.state}];
}
for(const [id,[ago,v]] of Object.entries(MOCK.setBefore||{})) setState(id,v,undefined,Date.now()-ago*1000);
// The states set (setState) in the history, as Home Assistant's recorder has written them by now
// (MOCK.commitInterval): an entity's history from the first one on, the state in force at t0 given
// at t0 — the history before it as the mock gives it
function withSet(e,pts,t0,t1){
  const now=Date.now()/1000, w=(SET[e]||[]).filter(x=>x.lu+(MOCK.commitInterval||0)<=now);
  if(!w.length) return pts;
  const before=w.filter(x=>x.lu<t0).pop(), out=before ? [{s:before.s,lu:t0}] : pts.filter(p=>p.lu<w[0].lu);
  for(const x of w) if(x.lu>=t0 && x.lu<t1) out.push({s:x.s,lu:x.lu});
  return out;
}
// Value of entity id at time t (s) in the mocked history
const isNum=id=>!isNaN(Number(INIT[id] ?? STATES[id].state));
const base=id=>Number(INIT[id] ?? STATES[id].state)||1;
// (an entity whose history is a series — MOCK.series, no rows of its own —, no state set since)
function inSeries(id){ return MOCK.series && !MOCK.rows?.[id] && !SET[id]?.length; }
// The state of an entity in series as Home Assistant gives it now: its series's last value, since
// the series's step it took it (last_changed), its attributes those of that step (last_updated)
function seriesState(id){
  const st=MOCK.historyStep||600, t=Math.floor(Date.now()/1000/st)*st, v=valueAt(id,t);
  let t0=t; while(valueAt(id,t0-st)===v && t-t0<2*86400) t0-=st;
  return {...STATES[id], state:isNaN(Number(v)) ? v : String(Number(v)), last_changed:new Date(t0*1000).toISOString(), last_updated:new Date(t*1000).toISOString(), attributes:attributesAt(id,t)};
}
// (each series through the entity's state when the page opened, at the last step then (T0):
// a list of values or two states every 2 h from it, a sine around it; a total grows, its state
// its value now — see seriesState)
const _cycle=(t,n)=>((Math.floor((t-T0)/7200)%n)+n)%n;
function valueAt(id,t){
  const v=STATES[id].attributes.values; if(v) return v[(_cycle(t,v.length)+Math.max(0,v.indexOf(INIT[id])))%v.length];
  if(!isNum(id)){ const s=INIT[id] ?? 'on'; return _cycle(t,2) ? ( s==='on' ? 'off' : s==='off' ? 'on' : 'off' ) : s; }
  if(STATES[id].attributes.state_class==='total_increasing') return (base(id)+t/36000%1000).toFixed(2);
  return (base(id)*(1+0.5*Math.sin((t-T0)/3600))).toFixed(2);
}
// The attributes of entity id at time t (s): current_temperature a sine, humidity a sine
// around its own (its unit in its text, when it's a text), hvac_action on and off every 2 h, the others as they are now
function attributesAt(id,t){
  // (the attributes set at t — setState —, or before the first one, those before it)
  const set=(SET[id]||[]).filter(x=>x.lu<=t).pop(), a={...(set ? set.a : SET[id]?.[0]?.wasA ?? STATES[id].attributes)};
  if('current_temperature' in a) a.current_temperature=Number((a.current_temperature*(1+0.1*Math.sin((t-T0)/3600))).toFixed(2));
  if('humidity' in a){ const h=(parseFloat(a.humidity)*(1+0.1*Math.sin((t-T0)/3600))).toFixed(1); a.humidity=typeof a.humidity==='string' ? h+' %' : Number(h); }
  if('hvac_action' in a) a.hvac_action=_cycle(t,2) ? 'idle' : 'heating';
  return a;
}
// (no end_time: until now, as Home Assistant; with no_attributes false, each row with its
// attributes — a)
function history(d){
  // (nothing after now: Home Assistant has no future)
  const t0=Date.parse(d.start_time)/1000, t1=Math.min(d.end_time ? Date.parse(d.end_time)/1000 : Infinity, Date.now()/1000), r={};
  // (d.compiling: the statistics compiled when the history was still there — no retention)
  const kept=MOCK.historyDays && !d.compiling ? Date.now()/1000-MOCK.historyDays*86400 : -Infinity;
  for(const e of d.entity_ids){
    if(!STATES[e] || (MOCK.notRecorded||[]).includes(e)) continue;
    let pts=[];
    if(MOCK.rows?.[e]){ const now=Date.now()/1000, all=MOCK.rows[e].map(([ago,s])=>({s,lu:now-ago})).sort((a,b)=>a.lu-b.lu);
      const before=all.filter(p=>p.lu<t0).pop(); pts=all.filter(p=>p.lu>=t0 && p.lu<t1); if(before) pts.unshift({s:before.s,lu:t0}); }
    // (its state — before the first one set, see setState)
    else if(!MOCK.series) pts=[{s:SET[e]?.[0]?.was ?? STATES[e].state,lu:Math.max(t0,kept)}];
    else {
      const st=MOCK.historyStep||600, from=Math.max(t0,kept);
      for(let t=Math.ceil(from/st)*st; t<t1; t+=st) pts.push({s:valueAt(e,t),lu:t});
      // (the state in force at the start, as Home Assistant gives it: at the start's time)
      if(from<t1 && (!pts.length || pts[0].lu>from)) pts.unshift({s:valueAt(e,Math.floor(from/st)*st),lu:from});
    }
    // (the states the test set, from their time on)
    pts=withSet(e,pts,t0,t1);
    if(!d.no_attributes) for(const p of pts) p.a=attributesAt(e,p.lu);
    if(pts.length) r[e]=pts;
  }
  return r;
}
// The statistics as Home Assistant compiles them: for an entity with a state_class, a
// period (an hour; 5 minutes, d.period '5minute'; a day, 'day'; a week; a month, 30 days) once it has ended (and a few minutes for
// the compiling, MOCK.statsLag, 10 min by default), from the mocked history — a
// measurement its mean (weighted by time, the state in force at its start included), min
// and max, a total its state at the period's end and its sum; none for a period not ended. The hourly ones kept for ever, the 5-minute ones as
// long as the history (historyDays). MOCK.noStatistics: entities without any
function statistics(d){
  const P={ '5minute':300e3, hour:3600e3, day:86400e3, week:7*86400e3, month:30*86400e3 }[d.period] ?? 3600e3;
  const kept=P<3600e3&&MOCK.historyDays ? Date.now()-MOCK.historyDays*86400e3 : -Infinity;
  const t0=Math.max(Date.parse(d.start_time), kept), t1=Math.min(Date.parse(d.end_time), Date.now()-(MOCK.statsLag??600)*1000), r={};
  for(const e of d.statistic_ids){
    const sc=STATES[e]?.attributes.state_class;
    // (MOCK.statsFrom: an entity's statistics only for its last days — its unit just changed)
    const from=MOCK.statsFrom?.[e]!==undefined ? Date.now()-MOCK.statsFrom[e]*86400e3 : -Infinity;
    if(!sc||!isNum(e)||(MOCK.noStatistics||[]).includes(e)) continue;
    const pts=[]; for(let t=Math.ceil(Math.max(t0, from)/P)*P; t+P<=t1; t+=P){
      if(sc==='measurement' && MOCK.fastStats){ const m=base(e)*(1+0.5*Math.sin((t+P/2)/3600e3)); pts.push({start:t,end:t+P,mean:m,min:m*0.9,max:m*1.1}); continue; }
      if(sc==='measurement'){
        // (as Home Assistant compiles them — sensor/recorder.py: the history's states over
        // the period, the one in force at its start included; the mean weighted by how long
        // each lasted, from the start to the end; their min and max)
        const h=(history({entity_ids:[e], start_time:new Date(t).toISOString(), end_time:new Date(t+P).toISOString(), no_attributes:true, compiling:true})[e]||[])
          .map(x=>({t:x.lu*1000, v:Number(x.s)})).filter(x=>!isNaN(x.v));
        if(!h.length) continue;
        let acc=0; h.forEach((x,i)=>{ acc+=x.v*((i+1<h.length?h[i+1].t:t+P)-x.t); });
        const v=h.map(x=>x.v);
        pts.push({start:t,end:t+P,mean:acc/(t+P-h[0].t),min:Math.min(...v),max:Math.max(...v)}); }
      else { const v=Number(valueAt(e,(t+P)/1000)); pts.push({start:t,end:t+P,state:v,sum:v}); } }
    if(pts.length) r[e]=pts;
  }
  return r;
}
// (MOCK.cost: when each of Home Assistant's workers is free again)
let mockBusyUntil=[], mockStarts=[];
// (MOCK.system: what Home Assistant tells of the hardware it runs on — its system health, its
// hardware integration —, as to an administrator)
const mockConnection={ subscribeMessage:(cb,msg)=>{
  if(MOCK.system && msg.type==='system_health/info') setTimeout(()=>{ cb({type:'initial', data:{ homeassistant:{info:{installation_type:'Home Assistant OS', arch:'aarch64', os_name:'Linux', os_version:'6.12'}},
    hassio:{info:{host_os:'Home Assistant OS 16.3', board:'rpi5-64', disk_total:'228.5', disk_used:'21.0'}}, recorder:{info:{database_engine:'mysql', database_version:'11.4.5', estimated_db_size:{type:'pending'}}} }});
    cb({type:'update', domain:'recorder', key:'estimated_db_size', success:true, data:'3412.50 MiB'}); cb({type:'finish'}); }, 10);
  else if(MOCK.system && msg.type==='hardware/subscribe_system_status') setTimeout(()=>cb({cpu_percent:12, memory_used_percent:40, memory_used_mb:3276.8, memory_free_mb:4915.2, timestamp:''}), 10);
  return Promise.resolve(()=>{}); } };
function mkHass(){ return {
  connection: mockConnection,
  states:{...Object.fromEntries(Object.keys(STATES).map(id=>[id, inSeries(id) ? seriesState(id) : STATES[id]])), ...(MOCK.extraStates||{})}, config:{version:'2026.11.0', unit_system:{temperature:'°C', length:'km'}}, language:MOCK.language||'en', locale:{language:MOCK.language||'en'},
  themes:{darkMode:!!MOCK.dark}, selectedTheme:null,
  // (no translation: an empty string, as Home Assistant gives for a key it doesn't know)
  user:{id:'u1',name:'u'}, localize:()=>'',
  // (the actions performed: [domain.service, data, target])
  callService:(d,sv,data,target)=>{ (window.__services=window.__services||[]).push([d+'.'+sv, data, target]); return Promise.resolve(); },
  // the entity and device registries (an entity's device: its name)
  entities:{ 'sensor.power':{entity_id:'sensor.power',device_id:'d_ecowitt'}, 'sensor.power2':{entity_id:'sensor.power2',device_id:'d_mf'}, 'sensor.rain':{entity_id:'sensor.rain',device_id:'d_ecowitt'} },
  devices:{ d_ecowitt:{id:'d_ecowitt',name:'Ecowitt'}, d_mf:{id:'d_mf',name:'Météo-France Villeveyrac'} },
  callWS:(d)=>{
    __ws.push({at:Date.now(), type:d.type, start:d.start_time, end:d.end_time, ids:d.entity_ids||d.statistic_ids, period:d.period, attributes:d.no_attributes===false, allChanges:d.significant_changes_only===false});
    if((MOCK.fail||[]).includes(d.type)) return Promise.reject(new Error('mock failure: '+d.type));
    // (MOCK.historyDelay, MOCK.userDataDelay: ms Home Assistant takes to answer — a real one isn't instant)
    const later=(ms, f)=> ms ? new Promise(r=>setTimeout(r, ms)).then(f) : f();
    const wire=v=> MOCK.json ? JSON.parse(JSON.stringify(v)) : v;
    // (MOCK.cost: one request at a time, as long as what it returns asks)
    // (the hourly rows the database reads for statistics of a day, a week or a month: every hour asked, until now)
    const hours=['day','week','month'].includes(d.period) ? (d.statistic_ids||[]).length*Math.max(0,(Math.min(Date.parse(d.end_time),Date.now())-Date.parse(d.start_time))/3600e3) : null;
    const costed=(per, v)=>{ const n=Object.values(v).reduce((k,a)=>k+a.length,0), ms=MOCK.cost.base+n*per+(d.statistic_ids ? (hours??n)*(MOCK.cost.read||0) : 0), now=Date.now();
      while(mockBusyUntil.length<(MOCK.cost.workers||1)) mockBusyUntil.push(0);
      const w=mockBusyUntil.indexOf(Math.min(...mockBusyUntil)), start=Math.max(now, mockBusyUntil[w]), end=mockBusyUntil[w]=start+ms;
      // (the requests waiting for a worker: those starting later)
      mockStarts=mockStarts.filter(t=>t>now).concat(start>now ? [start] : []); window.__mockWaiting=Math.max(window.__mockWaiting||0, mockStarts.length);
      return new Promise(r=>setTimeout(()=>r(wire(v)), end-now)); };
    // (and what working out the answer took the page — Home Assistant's server work, not the
    // card's: window.__mockSpent, [when, ms])
    const spent=f=>{ const t=performance.now(), v=f(); (window.__mockSpent=window.__mockSpent||[]).push([t, performance.now()-t]); return v; };
    if(d.type==='history/history_during_period') return MOCK.cost ? costed(MOCK.cost.history, spent(()=>history(d))) : later(MOCK.historyDelay, ()=>Promise.resolve(wire(history(d))));
    if(d.type==='recorder/statistics_during_period') return MOCK.cost ? costed(MOCK.cost.statistics, spent(()=>statistics(d))) : later(MOCK.historyDelay, ()=>Promise.resolve(wire(statistics(d))));
    if(d.type==='hardware/info') return MOCK.system ? Promise.resolve({hardware:[{name:'Raspberry Pi 5', board:{hassio_board_id:'rpi5-64', model:'5'}}]}) : Promise.reject(new Error('unknown command'));
    if(d.type==='frontend/get_user_data') return later(MOCK.userDataDelay, ()=>window.__getUD(d.key).then(v=>({value:v})));
    if(d.type==='frontend/set_user_data'){ return window.__setUD(d.key, d.value===null?null:JSON.parse(JSON.stringify(d.value))).then(()=>({})); }
    return Promise.resolve({}); } }; }
