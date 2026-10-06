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
// Every WS request is logged in window.__ws ({type, start, end, ids}).
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
};
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
// (no end_time: until now, as Home Assistant)
function history(d){
  const t0=Date.parse(d.start_time)/1000, t1=d.end_time ? Date.parse(d.end_time)/1000 : Date.now()/1000, r={};
  const kept=MOCK.historyDays ? Date.now()/1000-MOCK.historyDays*86400 : -Infinity;
  for(const e of d.entity_ids){
    if(!STATES[e]) continue;
    if(!MOCK.series){ r[e]=[{s:STATES[e].state,lu:Math.max(t0,kept)}]; continue; }
    const pts=[]; for(let t=Math.ceil(Math.max(t0,kept)/600)*600; t<t1; t+=600) pts.push({s:valueAt(e,t),lu:t});
    // (a state the test set is the history from its time on)
    const tSet=STATES[e].setAt; if(tSet>=t0 && tSet<t1){ while(pts.length && pts[pts.length-1].lu>=tSet) pts.pop(); pts.push({s:STATES[e].state,lu:tSet}); }
    if(pts.length) r[e]=pts;
  }
  return r;
}
function statistics(d){
  const t0=Date.parse(d.start_time), t1=Date.parse(d.end_time), r={};
  for(const e of d.statistic_ids){
    if(!STATES[e]||!isNum(e)) continue;
    const pts=[]; for(let t=Math.ceil(t0/3600e3)*3600e3; t<t1; t+=3600e3){ const v=Number(valueAt(e,t/1000)); pts.push({start:t,end:t+3600e3,mean:v,min:v*0.9,max:v*1.1,state:v,sum:v}); }
    if(pts.length) r[e]=pts;
  }
  return r;
}
function mkHass(){ return {
  states:{...STATES}, config:{version:'2026.7.4'}, language:MOCK.language||'en', locale:{language:MOCK.language||'en'},
  themes:{darkMode:!!MOCK.dark}, selectedTheme:null,
  user:{id:'u1',name:'u'}, localize:(k)=>k,
  callWS:(d)=>{
    __ws.push({type:d.type, start:d.start_time, end:d.end_time, ids:d.entity_ids||d.statistic_ids});
    if((MOCK.fail||[]).includes(d.type)) return Promise.reject(new Error('mock failure: '+d.type));
    if(d.type==='history/history_during_period') return Promise.resolve(history(d));
    if(d.type==='recorder/statistics_during_period') return Promise.resolve(statistics(d));
    if(d.type==='frontend/get_user_data') return window.__getUD(d.key).then(v=>({value:v}));
    if(d.type==='frontend/set_user_data'){ return window.__setUD(d.key, d.value===null?null:JSON.parse(JSON.stringify(d.value))).then(()=>({})); }
    return Promise.resolve({}); } }; }
