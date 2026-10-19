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
//   rows        an entity's history as given: { id: [[seconds before now, state], …] }
//   statsLag    seconds after an hour's end before its statistics exist (600)
//   noStatistics entities without long-term statistics (whatever their state_class)
//   json        the history and statistics answered as Home Assistant's websocket does: a
//               JSON text parsed by the page
// The entity and device registries (hass.entities, hass.devices) give sensor.power and
// sensor.rain the device 'Ecowitt', sensor.power2 'Météo-France Villeveyrac'.
// Every WS request is logged in window.__ws ({type, start, end, ids, period}).
// setState(id, value) pushes the change to every element in window.hassTargets.
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
    wind_bearing: 130, wind_gust_speed: 0, wind_speed: 14.4, wind_speed_unit: 'km/h', visibility_unit: 'km', precipitation_unit: 'mm', attribution: 'Data provided by Météo-France', supported_features: 3 });
STATES['sensor.clim_mode'].attributes.values=['hot','cold','off'];
STATES['input_text.curve_color'].attributes.values=['red','#0000ff'];
STATES['input_text.curve_thresholds'].attributes.values=[STATES['input_text.curve_thresholds'].state];
STATES['sensor.net_energy'].attributes.device_class='energy';
STATES['sensor.tank'].attributes.device_class='volume_storage';
window.userData={};
window.__ws=[];
// A state change, as Home Assistant pushes it: new value, new last_changed, new hass object
window.setState=(id,v)=>{ const t=new Date().toISOString(); STATES[id]={...STATES[id],state:String(v),last_changed:t,last_updated:t,setAt:Date.parse(t)/1000}; (window.hassTargets||[]).forEach(x=>{ x.hass=mkHass(); }); };
// Value of entity id at time t (s) in the mocked history
const isNum=id=>!isNaN(Number(STATES[id].state));
const base=id=>Number(STATES[id].state)||1;
function valueAt(id,t){
  const v=STATES[id].attributes.values; if(v) return v[Math.floor(t/7200)%v.length];
  if(!isNum(id)) return Math.floor(t/7200)%2 ? 'on' : 'off';
  if(STATES[id].attributes.state_class==='total_increasing') return (base(id)+t/36000%1000).toFixed(2);
  return (base(id)*(1+0.5*Math.sin(t/3600))).toFixed(2);
}
// The attributes of entity id at time t (s): current_temperature a sine, humidity a sine
// with its unit in its text, hvac_action on and off every 2 h, the others as they are now
function attributesAt(id,t){
  const a={...STATES[id].attributes};
  if('current_temperature' in a) a.current_temperature=Number((a.current_temperature*(1+0.1*Math.sin(t/3600))).toFixed(2));
  if('humidity' in a) a.humidity=(45*(1+0.1*Math.sin(t/3600))).toFixed(1)+' %';
  if('hvac_action' in a) a.hvac_action=Math.floor(t/7200)%2 ? 'heating' : 'idle';
  return a;
}
// (no end_time: until now, as Home Assistant; with no_attributes false, each row with its
// attributes — a)
function history(d){
  // (nothing after now: Home Assistant has no future)
  const t0=Date.parse(d.start_time)/1000, t1=Math.min(d.end_time ? Date.parse(d.end_time)/1000 : Infinity, Date.now()/1000), r={};
  const kept=MOCK.historyDays ? Date.now()/1000-MOCK.historyDays*86400 : -Infinity;
  for(const e of d.entity_ids){
    if(!STATES[e]) continue;
    if(MOCK.rows?.[e]){ const now=Date.now()/1000, all=MOCK.rows[e].map(([ago,s])=>({s,lu:now-ago})).sort((a,b)=>a.lu-b.lu);
      const before=all.filter(p=>p.lu<t0).pop(), pts=all.filter(p=>p.lu>=t0 && p.lu<t1); if(before) pts.unshift({s:before.s,lu:t0}); if(pts.length) r[e]=pts; continue; }
    if(!MOCK.series){ const lu=Math.max(t0,kept); r[e]=[{s:STATES[e].state,lu,...(d.no_attributes?{}:{a:attributesAt(e,lu)})}]; continue; }
    const pts=[]; for(let t=Math.ceil(Math.max(t0,kept)/(MOCK.historyStep||600))*(MOCK.historyStep||600); t<t1; t+=(MOCK.historyStep||600)) pts.push({s:valueAt(e,t),lu:t});
    // (a state the test set is the history from its time on)
    const tSet=STATES[e].setAt; if(tSet>=t0 && tSet<t1){ while(pts.length && pts[pts.length-1].lu>=tSet) pts.pop(); pts.push({s:STATES[e].state,lu:tSet}); }
    if(!d.no_attributes) for(const p of pts) p.a=attributesAt(e,p.lu);
    if(pts.length) r[e]=pts;
  }
  return r;
}
// The statistics as Home Assistant compiles them: for an entity with a state_class, a
// period (an hour; 5 minutes, d.period '5minute') once it has ended (and a few minutes for
// the compiling, MOCK.statsLag, 10 min by default), from the mocked history's values in it
// — a measurement its mean, min and max, a total its state at the period's end and its
// sum; none for a period not ended. The hourly ones kept for ever, the 5-minute ones as
// long as the history (historyDays). MOCK.noStatistics: entities without any
function statistics(d){
  const P=d.period==='5minute'?300e3:3600e3;
  const kept=P<3600e3&&MOCK.historyDays ? Date.now()-MOCK.historyDays*86400e3 : -Infinity;
  const t0=Math.max(Date.parse(d.start_time), kept), t1=Math.min(Date.parse(d.end_time), Date.now()-(MOCK.statsLag??600)*1000), r={};
  const step=(MOCK.historyStep||600)*1000;
  for(const e of d.statistic_ids){
    const sc=STATES[e]?.attributes.state_class;
    if(!sc||!isNum(e)||(MOCK.noStatistics||[]).includes(e)) continue;
    const pts=[]; for(let t=Math.ceil(t0/P)*P; t+P<=t1; t+=P){
      if(sc==='measurement'){ const v=[]; for(let u=Math.ceil(t/step)*step; u<t+P; u+=step) v.push(Number(valueAt(e,u/1000)));
        if(!v.length) v.push(Number(valueAt(e,t/1000)));
        pts.push({start:t,end:t+P,mean:v.reduce((a,b)=>a+b,0)/v.length,min:Math.min(...v),max:Math.max(...v)}); }
      else { const v=Number(valueAt(e,(t+P)/1000)); pts.push({start:t,end:t+P,state:v,sum:v}); } }
    if(pts.length) r[e]=pts;
  }
  return r;
}
function mkHass(){ return {
  states:{...STATES, ...(MOCK.extraStates||{})}, config:{version:'2026.7.4', unit_system:{temperature:'°C', length:'km'}}, language:MOCK.language||'en', locale:{language:MOCK.language||'en'},
  themes:{darkMode:!!MOCK.dark}, selectedTheme:null,
  user:{id:'u1',name:'u'}, localize:(k)=>k,
  // (the actions performed: [domain.service, data, target])
  callService:(d,sv,data,target)=>{ (window.__services=window.__services||[]).push([d+'.'+sv, data, target]); return Promise.resolve(); },
  // the entity and device registries (an entity's device: its name)
  entities:{ 'sensor.power':{entity_id:'sensor.power',device_id:'d_ecowitt'}, 'sensor.power2':{entity_id:'sensor.power2',device_id:'d_mf'}, 'sensor.rain':{entity_id:'sensor.rain',device_id:'d_ecowitt'} },
  devices:{ d_ecowitt:{id:'d_ecowitt',name:'Ecowitt'}, d_mf:{id:'d_mf',name:'Météo-France Villeveyrac'} },
  callWS:(d)=>{
    __ws.push({type:d.type, start:d.start_time, end:d.end_time, ids:d.entity_ids||d.statistic_ids, period:d.period, attributes:d.no_attributes===false, allChanges:d.significant_changes_only===false});
    if((MOCK.fail||[]).includes(d.type)) return Promise.reject(new Error('mock failure: '+d.type));
    // (MOCK.historyDelay, MOCK.userDataDelay: ms Home Assistant takes to answer — a real one isn't instant)
    const later=(ms, f)=> ms ? new Promise(r=>setTimeout(r, ms)).then(f) : f();
    const wire=v=> MOCK.json ? JSON.parse(JSON.stringify(v)) : v;
    if(d.type==='history/history_during_period') return later(MOCK.historyDelay, ()=>Promise.resolve(wire(history(d))));
    if(d.type==='recorder/statistics_during_period') return later(MOCK.historyDelay, ()=>Promise.resolve(wire(statistics(d))));
    if(d.type==='frontend/get_user_data') return later(MOCK.userDataDelay, ()=>window.__getUD(d.key).then(v=>({value:v})));
    if(d.type==='frontend/set_user_data'){ return window.__setUD(d.key, d.value===null?null:JSON.parse(JSON.stringify(d.value))).then(()=>({})); }
    return Promise.resolve({}); } }; }
