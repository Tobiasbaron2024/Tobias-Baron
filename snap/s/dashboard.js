import { budgetToday, loadTodayBudget, expenseAmount, EXPENSE_CATEGORIES } from './daily-budget.js?v=2';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eur=n=>Number(n).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
export async function renderQuickBudget(el,{api,prefs,today,toast}) {
  let data, busy=false, draftId=null, signature=null, loadedDay=today();
  el.innerHTML='<p class="hinweis">Tagesbudget wird geladen …</p>';
  try { data=await loadTodayBudget(api,today()); } catch { el.innerHTML='<p class="fehler">Das Tagesbudget konnte nicht geladen werden.</p><button class="btn" data-retry>Erneut laden</button>';el.querySelector('[data-retry]').onclick=()=>renderQuickBudget(el,{api,prefs,today,toast});return; }
  if(!el.isConnected)return;
  el.innerHTML=`<div data-values aria-live="polite"></div><details class="quick-expense-details"><summary>+ Ausgabe eintragen</summary><form class="quick-expense"><div class="raster"><label>Betrag in Euro<input name="amount" inputmode="decimal" placeholder="z. B. 15,00" autocomplete="off" required></label><label>Kategorie<select name="category">${EXPENSE_CATEGORIES.map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></label></div><label>Notiz (optional)<input name="note" maxlength="120" placeholder="z. B. Einkauf"></label><button class="btn pri" type="submit">Ausgabe speichern</button><p class="hinweis" data-status role="status"></p></form></details><p class="hinweis">Für heute · gleicher Zahltagszeitraum wie im Haushaltsbuch. Fixkosten und Sparziel sind berücksichtigt. Übernommenes Netto ist eine Schätzung.</p>`;
  const update=()=>{const b=budgetToday({...data,prefs,today:today()});el.querySelector('[data-values]').innerHTML=`<div class="today-budget ${b.todayLeft<0?'neg':''}"><span>Heute noch verfügbar</span><strong>${eur(b.todayLeft)}</strong></div><div class="lohn"><div><span>Heute ausgegeben</span><b>${eur(b.spentToday)}</b></div><div><span>Rest bis ${b.period.end.split('-').reverse().join('.')}</span><b>${eur(b.restNow)}</b></div></div>${b.recIn+b.oneIn<=0?'<p class="hinweis">Trage dein Einkommen im Haushaltsbuch ein oder aktiviere die Lohnübernahme.</p>':''}${b.todayLeft<0?'<p class="fehler">Du liegst heute über deinem Tagesbudget.</p>':''}`;};
  update();const form=el.querySelector('form'),status=el.querySelector('[data-status]');
  form.onsubmit=async event=>{event.preventDefault();if(busy)return;const amount=expenseAmount(form.elements.amount.value),category=form.elements.category.value,note=form.elements.note.value.trim();if(amount===null||!EXPENSE_CATEGORIES.some(([k])=>k===category)){status.textContent='Bitte einen gültigen Betrag eingeben, z. B. 15,50.';return;}
    const body={tx_date:today(),kind:'out',amount,category,note:note||null};const sig=JSON.stringify(body);if(signature!==sig){draftId=crypto.randomUUID();signature=sig;}body.id=draftId;busy=true;form.querySelector('button').disabled=true;status.textContent='Wird gespeichert …';
    try {if(loadedDay!==body.tx_date){data=await loadTodayBudget(api,body.tx_date);loadedDay=body.tx_date;}await api('transactions?on_conflict=id',{method:'POST',body,prefer:'resolution=ignore-duplicates,return=representation'});if(!data.transactions.some(t=>t.id===draftId))data.transactions.push(body);update();form.elements.amount.value='';form.elements.note.value='';draftId=null;signature=null;status.textContent=`${eur(amount)} gespeichert.`;toast('Ausgabe gespeichert.');}
    catch(error){status.textContent=error.message||'Speichern fehlgeschlagen. Bitte erneut versuchen.';}
    finally{busy=false;form.querySelector('button').disabled=false;}
  };
}
const TZ='Europe/Berlin';
const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const nf=(v,d=0)=>Number(v).toLocaleString('de-DE',{maximumFractionDigits:d});
const dayKey=ms=>new Date(ms).toLocaleDateString('sv-SE',{timeZone:TZ});
const hhmm=ms=>new Date(ms).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',timeZone:TZ});
const uhr=ms=>Number(hhmm(ms).slice(0,2))+' Uhr';
const addDay=key=>{const [y,m,d]=key.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+1)).toISOString().slice(0,10);};
const SKY={'clear-day':['☀️','Sonnig'],'clear-night':['🌙','Klar'],'partly-cloudy-day':['⛅','Heiter bis wolkig'],'partly-cloudy-night':['☁️','Wolkig'],cloudy:['☁️','Bedeckt'],fog:['🌫️','Nebel'],wind:['💨','Windig'],rain:['🌧️','Regen'],sleet:['🌨️','Schneeregen'],snow:['❄️','Schnee'],hail:['🌨️','Hagel'],thunderstorm:['⛈️','Gewitter']};
export function skyOf(row){
  if(row?.icon==='rain'&&isNum(row.precipitation)){
    if(row.precipitation<0.3)return ['🌦️','Nieselregen'];
    if(row.precipitation>=4)return ['🌧️','Kräftiger Regen'];
  }
  if(SKY[row?.icon])return SKY[row.icon];
  if(isNum(row?.cloud_cover))return row.cloud_cover>=80?SKY.cloudy:row.cloud_cover>=35?SKY['partly-cloudy-day']:SKY['clear-day'];
  return ['🌡️','Wetter'];
}
const DIRS=['N','NO','O','SO','S','SW','W','NW'];
const windDir=deg=>isNum(deg)?DIRS[Math.round((((deg%360)+360)%360)/45)%8]:'';
// Gefühlte Temperatur: bis 20 Grad Windchill (nie wärmer als die Lufttemperatur), darüber Luftfeuchte und etwas Windkühlung
export function feelsLike(t,rh,windKmh){
  if(!isNum(t))return null;
  const v=isNum(windKmh)?windKmh:0,h=isNum(rh)?rh:50;
  if(t<=20){
    if(v<4.8)return t;
    const p=Math.pow(v,0.16);
    return Math.min(t,13.12+0.6215*t-11.37*p+0.3965*t*p);
  }
  const e=h/100*6.105*Math.exp(17.27*t/(237.7+t));
  return t+0.33*Math.max(0,e-12)-Math.min(1.5,0.05*v);
}
// Sonnenauf- und -untergang (Näherung, reicht auf ca. 2 Minuten genau), Rückgabe als Uhrzeiten in Berliner Zeit
export function sunTimes(key,lat,lon){
  if(!isNum(lat)||!isNum(lon))return null;
  const [y,m,d]=key.split('-').map(Number),rad=Math.PI/180;
  const N=Math.floor(275*m/9)-Math.floor((m+9)/12)*(1+Math.floor((y-4*Math.floor(y/4)+2)/3))+d-30,lngHour=lon/15;
  const calc=rising=>{
    const t=N+((rising?6:18)-lngHour)/24,M=0.9856*t-3.289;
    let L=M+1.916*Math.sin(M*rad)+0.020*Math.sin(2*M*rad)+282.634;L=((L%360)+360)%360;
    let RA=Math.atan(0.91764*Math.tan(L*rad))/rad;RA=((RA%360)+360)%360;
    RA+=Math.floor(L/90)*90-Math.floor(RA/90)*90;RA/=15;
    const sinDec=0.39782*Math.sin(L*rad),cosDec=Math.cos(Math.asin(sinDec));
    const cosH=(Math.cos(90.833*rad)-sinDec*Math.sin(lat*rad))/(cosDec*Math.cos(lat*rad));
    if(cosH>1||cosH<-1)return null;
    const H=(rising?360-Math.acos(cosH)/rad:Math.acos(cosH)/rad)/15;
    const UT=(((H+RA-0.06571*t-6.622-lngHour)%24)+24)%24;
    return Date.UTC(y,m-1,d)+UT*3600000;
  };
  const up=calc(true),down=calc(false);
  return up&&down?{rise:hhmm(up),set:hhmm(down)}:null;
}
export function clothingPlan(s){
  const items=[];let text='',head='';
  const base=isNum(s.feelsLow)?s.feelsLow:s.low;
  if(!isNum(base))return {head:'',items,text:'Für eine Kleidungsempfehlung fehlen Temperaturdaten.'};
  const high=isNum(s.high)?s.high:base,wind=Number(s.wind)||0,gust=Number(s.gust)||0;
  const add=(icon,label)=>{if(!items.some(i=>i.label===label))items.push({icon,label});};
  if(base<-5){head='Dick einpacken';text='Richtig eisig heute. Zieh dich warm an: dicke Jacke, Mütze, Schal und Handschuhe, am besten mit einer Thermoschicht drunter.';add('🧥','Dicke Winterjacke');add('🧢','Mütze');add('🧣','Schal');add('🧤','Handschuhe');add('🧦','Warme Socken');}
  else if(base<2){head='Warm einpacken';text='Knackig kalt heute. Winterjacke, Mütze und Handschuhe gehören dazu, dann hält dich nichts auf.';add('🧥','Winterjacke');add('🧢','Mütze');add('🧤','Handschuhe');add('🧣','Schal');}
  else if(base<8){head='Warme Jacke';text='Kalt, aber machbar. Mit einer warmen Jacke und einer Mütze bist du gut dabei, einen Schal packst du dazu, wenn du schnell frierst.';add('🧥','Warme Jacke');add('🧢','Mütze');add('🧣','Schal');}
  else if(base<13){head='Jacke und Pulli';text='Frisch heute. Ein Pulli unter der Jacke, dann passt das.';add('🧥','Jacke');add('🧶','Pullover');}
  else if(base<18){head='Leichte Jacke reicht';text='Schön mild. Eine leichte Jacke reicht, abends wird es etwas kühler.';add('🧥','Leichte Jacke');add('👕','Langarmshirt');}
  else if(base<24){head='T-Shirt-Wetter';text='Gutes Wetter heute. T-Shirt geht, für den Abend steckst du dir eine dünne Jacke ein.';add('👕','T-Shirt');add('🧥','Dünne Jacke');}
  else if(base<30){head='Luftig anziehen';text='Richtig warm heute. Zieh etwas Luftiges an und trink genug.';add('👕','Luftiges Shirt');add('💧','Wasser dabei');}
  else{head='Hitze';text='Heiß heute. Leichte, helle Sachen, viel Wasser und möglichst Schatten.';add('👕','Leichte Kleidung');add('💧','Viel Wasser');add('🧴','Sonnencreme');}
  if(high-base>=8&&base<24){text+=' Zwischen kalt und warm liegen heute einige Grad, also lieber mehrere dünne Schichten statt einer dicken.';}
  const prob=Number(s.rainProb)||0,mm=Number(s.rainMm)||0;
  if(prob>=60||mm>=1){text+=' Es wird nass, also Regenjacke und Schirm einpacken.';add('☂️','Regenschirm');if(base>=8)add('🧥','Regenjacke');}
  else if(s.rain||prob>=40){text+=' Ein kleiner Schirm in der Tasche schadet nicht, falls es zwischendurch tröpfelt.';add('☂️','Kleiner Schirm');}
  if(wind>=35||gust>=55){text+=' Es pustet ordentlich, eine winddichte Jacke ist heute Gold wert.';add('🧥','Winddichte Jacke');}
  else if(wind>=25){text+=' Etwas Wind ist auch dabei.';}
  if(isNum(s.sunMinutes)&&s.sunMinutes>=240&&high>=18){text+=' Viel Sonne, da lohnt sich eine Sonnenbrille.';add('🕶️','Sonnenbrille');}
  if(high>=26)add('🧴','Sonnencreme');
  if(isNum(s.low)&&s.low<=1){text+=' Auf dem Weg kann es glatt sein, also feste Schuhe anziehen.';add('🥾','Feste Schuhe');}
  return {head,items,text};
}
export function clothingAdvice(s){return clothingPlan(s).text;}
export function summarizeWeather(rows,now=Date.now(),today=dayKey(now)) {
  const valid=(rows||[]).filter(r=>r&&Number.isFinite(Date.parse(r.timestamp)));
  const upcoming=valid.filter(r=>Date.parse(r.timestamp)>=now-3600000);
  let rest=upcoming.filter(r=>dayKey(Date.parse(r.timestamp))===today);
  if(!rest.length)rest=upcoming;
  const temps=rest.map(r=>r.temperature).filter(isNum);
  if(!temps.length)throw new Error('Keine aktuelle Wettervorhersage verfügbar.');
  const ts=r=>Date.parse(r.timestamp);
  const past=upcoming.filter(r=>ts(r)<=now),cur=past.length?past[past.length-1]:upcoming[0];
  const feelsOf=r=>feelsLike(r.temperature,r.relative_humidity,r.wind_speed);
  const feels=rest.map(feelsOf).filter(isNum);
  const wet=r=>(isNum(r.precipitation)&&r.precipitation>=0.2)||(isNum(r.precipitation_probability)&&r.precipitation_probability>=50);
  const firstWet=rest.find(wet);
  const probs=rest.map(r=>r.precipitation_probability).filter(isNum),mm=rest.map(r=>r.precipitation).filter(isNum);
  const sun=rest.map(r=>r.sunshine).filter(isNum),clouds=rest.map(r=>r.cloud_cover).filter(isNum);
  const [emoji,label]=skyOf(cur);
  const hours=upcoming.filter(r=>ts(r)>=ts(cur)).slice(0,12).map((r,i)=>({label:i===0?'Jetzt':uhr(ts(r)),temp:r.temperature,emoji:skyOf(r)[0],prob:isNum(r.precipitation_probability)?r.precipitation_probability:null,mm:isNum(r.precipitation)?r.precipitation:null}));
  const tKey=addDay(today),tRows=valid.filter(r=>dayKey(ts(r))===tKey),tTemps=tRows.map(r=>r.temperature).filter(isNum);
  let tomorrow=null;
  if(tRows.length>=12&&tTemps.length){
    const noon=tRows.find(r=>hhmm(ts(r)).startsWith('12'))||tRows[Math.floor(tRows.length/2)],[te,tl]=skyOf(noon);
    tomorrow={low:Math.min(...tTemps),high:Math.max(...tTemps),rain:tRows.some(r=>r.precipitation>0.1||r.precipitation_probability>=40),emoji:te,label:tl};
  }
  return {
    low:Math.min(...temps),high:Math.max(...temps),
    rain:rest.some(r=>r.precipitation>0.1||r.precipitation_probability>=40),
    wind:Math.max(0,...rest.map(r=>Number(r.wind_speed)||0)),
    gust:Math.max(0,...rest.map(r=>Number(r.wind_gust_speed)||0)),
    temp:isNum(cur.temperature)?cur.temperature:null,feels:feelsOf(cur),
    feelsLow:feels.length?Math.min(...feels):null,feelsHigh:feels.length?Math.max(...feels):null,
    emoji,label,windNow:isNum(cur.wind_speed)?cur.wind_speed:null,windDir:windDir(cur.wind_direction),
    humidity:isNum(cur.relative_humidity)?cur.relative_humidity:null,
    pressure:isNum(cur.pressure_msl)?cur.pressure_msl:null,
    visibility:isNum(cur.visibility)?cur.visibility:null,
    cloud:clouds.length?clouds.reduce((a,b)=>a+b,0)/clouds.length:null,
    rainProb:probs.length?Math.max(...probs):null,rainMm:mm.reduce((a,b)=>a+b,0),
    rainAt:firstWet?uhr(ts(firstWet)):null,rainNow:!!firstWet&&ts(firstWet)<=ts(cur),
    sunMinutes:sun.length?sun.reduce((a,b)=>a+b,0):null,hours,tomorrow
  };
}
export function weatherStory(s){
  const out=[];
  if(s.rainAt)out.push(s.rainNow?'Gerade ist es nass.':`Ab ${s.rainAt} wird es nass.`);
  else if(s.rain)out.push('Zwischendurch kann es mal tröpfeln.');
  else if(isNum(s.sunMinutes)&&s.sunMinutes>=300)out.push('Heute gibt es richtig viel Sonne.');
  else if(isNum(s.cloud)&&s.cloud>=80)out.push('Ziemlich grau heute, aber trocken.');
  else out.push('Trocken bleibt es, mal Sonne, mal Wolken.');
  if(s.high-s.low>=8)out.push(`Der Tag schwankt zwischen ${Math.round(s.low)} und ${Math.round(s.high)} Grad.`);
  if(s.wind>=35)out.push('Dazu pustet es ordentlich.');
  return out.join(' ');
}
let weatherCache,weatherDenied=false,weatherPending,locationAt=0;
let locationState={status:'idle',label:'Standort wird ermittelt'};
export function currentLocation(){return {...locationState};}
function locationUpdate(next){locationState=next;window.dispatchEvent(new CustomEvent('shiftly-location',{detail:currentLocation()}));}
export function invalidateWeather(){locationAt=0;weatherDenied=false;}
export function locationName(data){
  return [...new Set([data.city,data.locality].filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()))].join(' · ')||data.principalSubdivision||data.countryName||'';
}
function locationError(error){
  return error.code===1?'Standortfreigabe fehlt. Bitte erlaube den Standortzugriff für Shiftly in den Browser- oder Handy-Einstellungen.':error.code===3?'Die Standortbestimmung dauert zu lange. Bitte erneut versuchen.':error.code===2?'Der Standort ist momentan nicht verfügbar. Prüfe, ob die Ortungsdienste eingeschaltet sind.':error.message||'Der Standort konnte nicht ermittelt werden.';
}
function buildSummary(c,today){
  return {...summarizeWeather(c.rows,Date.now(),today()),location:c.label,sun:sunTimes(today(),c.lat,c.lon)};
}
export async function loadWeather(today,force=false) {
  if(weatherPending)return weatherPending;
  if(weatherDenied&&!force){throw Object.assign(new Error(locationState.message),{code:1});}
  if(!force&&weatherCache?.day===today()&&locationAt&&Date.now()-locationAt<300000)return buildSummary(weatherCache,today);
  weatherPending=(async()=>{
    locationUpdate({status:'loading',label:'Standort wird ermittelt'});
    let pos;
    try{
      if(!navigator.geolocation)throw new Error('Dein Browser unterstützt keine Standortbestimmung.');
      pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:15000,maximumAge:force?0:60000}));
      if(!Number.isFinite(pos.coords.latitude)||!Number.isFinite(pos.coords.longitude))throw new Error('Der Standort konnte nicht ermittelt werden.');
    }catch(error){weatherDenied=error.code===1;weatherCache=null;locationAt=0;locationUpdate({status:'error',label:error.code===1?'Standort erlauben':'Standort nicht verfügbar',message:locationError(error)});throw Object.assign(new Error(locationError(error)),{code:error.code});}
    weatherDenied=false;
    const lat=pos.coords.latitude.toFixed(3),lon=pos.coords.longitude.toFixed(3),key=lat+','+lon;
    let label=`Breite ${lat}° · Länge ${lon}°`,named=false;
    try{
      const q=new URLSearchParams({latitude:lat,longitude:lon,localityLanguage:'de'});
      const r=await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?'+q,{signal:AbortSignal.timeout(8000)});
      if(r.ok){const name=locationName(await r.json());if(name){label=name;named=true;}}
    }catch{}
    locationAt=Date.now();locationUpdate({status:'ready',label,named,at:locationAt,accuracy:pos.coords.accuracy});
    try{
      if(!force&&weatherCache?.day===today()&&weatherCache.key===key&&Date.now()-weatherCache.at<1800000){weatherCache.label=label;const cached=buildSummary(weatherCache,today);window.dispatchEvent(new CustomEvent('shiftly-weather',{detail:cached}));return cached;}
      const query=new URLSearchParams({lat,lon,date:today(),last_date:addDay(today())+'T23:59:59',tz:TZ});
      const response=await fetch('https://api.brightsky.dev/weather?'+query,{signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error('Wetterdienst momentan nicht erreichbar.');
      const json=await response.json();
      weatherCache={day:today(),at:Date.now(),key,label,lat:Number(lat),lon:Number(lon),rows:json.weather||[]};
      const summary=buildSummary(weatherCache,today);
      window.dispatchEvent(new CustomEvent('shiftly-weather',{detail:summary}));return summary;
    }catch(error){weatherCache=null;window.dispatchEvent(new CustomEvent('shiftly-weather',{detail:null}));throw error;}
  })();
  try{return await weatherPending;}finally{weatherPending=null;}
}
const deg=v=>isNum(v)?Math.round(v)+'°':'k. A.';
export function weatherCardHtml(s){
  const plan=clothingPlan(s),story=weatherStory(s);
  const feelsTxt=isNum(s.feels)&&isNum(s.temp)&&Math.abs(s.feels-s.temp)>=1?` · gefühlt ${deg(s.feels)}`:'';
  const stat=(icon,label,value,sub)=>`<div class="wx-stat"><span class="wx-stat-ico" aria-hidden="true">${icon}</span><b>${esc(value)}</b><span>${esc(label)}</span>${sub?`<small>${esc(sub)}</small>`:''}</div>`;
  const windVal=isNum(s.windNow)?`${nf(s.windNow)} km/h`:`${nf(s.wind)} km/h`;
  const windSub=[s.gust>s.wind+4||s.gust>=40?`Böen bis ${nf(s.gust)}`:'',s.windDir].filter(Boolean).join(' · ');
  const rainVal=isNum(s.rainProb)?`${nf(s.rainProb)} %`:(s.rain?'möglich':'kaum');
  const rainSub=s.rainMm>=0.1?`ca. ${nf(s.rainMm,1)} mm`:'trocken';
  const sunVal=isNum(s.sunMinutes)?`${nf(s.sunMinutes/60,1)} Std.`:(isNum(s.cloud)?`${nf(s.cloud)} %`:'k. A.');
  const sunLabel=isNum(s.sunMinutes)?'Sonne heute':'Bewölkung';
  const hours=s.hours.map(h=>`<div class="wx-h"><span class="wx-h-t">${esc(h.label)}</span><span class="wx-h-i" aria-hidden="true">${h.emoji}</span><b>${isNum(h.temp)?Math.round(h.temp)+'°':'k. A.'}</b><small class="${isNum(h.prob)&&h.prob>=30?'wet':''}">${isNum(h.prob)&&h.prob>=30?nf(h.prob)+' %':'&nbsp;'}</small></div>`).join('');
  const tm=s.tomorrow?`<div class="wx-tomorrow"><span aria-hidden="true">${s.tomorrow.emoji}</span><div><b>Morgen</b> ${esc(s.tomorrow.label)}, ${Math.round(s.tomorrow.low)} bis ${Math.round(s.tomorrow.high)} °C${s.tomorrow.rain?', mit Regen':''}</div></div>`:'';
  const more=[
    isNum(s.pressure)?`<div><span>Luftdruck</span><b>${nf(s.pressure)} hPa</b></div>`:'',
    isNum(s.visibility)?`<div><span>Sicht</span><b>${s.visibility>=10000?nf(s.visibility/1000)+' km':nf(s.visibility)+' m'}</b></div>`:'',
    isNum(s.cloud)?`<div><span>Bewölkung im Schnitt</span><b>${nf(s.cloud)} %</b></div>`:'',
    isNum(s.feelsLow)?`<div><span>Gefühlt im Tagesverlauf</span><b>${Math.round(s.feelsLow)} bis ${Math.round(s.feelsHigh)} °C</b></div>`:''
  ].join('');
  return `<div class="wx">
<div class="wx-hero"><div class="wx-ico" aria-hidden="true">${s.emoji}</div><div class="wx-main"><div class="wx-place">⌖ ${esc(s.location)}</div><div class="wx-temp">${isNum(s.temp)?Math.round(s.temp):Math.round((s.low+s.high)/2)}<small>°C</small></div><div class="wx-cond">${esc(s.label)}${esc(feelsTxt)}</div><div class="wx-range"><span>▾ ${Math.round(s.low)}°</span><span>▴ ${Math.round(s.high)}°</span><span>Rest des Tages</span></div></div></div>
<p class="wx-text wx-story">${esc(story)}</p>
<div class="wx-grid">${stat('💨','Wind',windVal,windSub)}${stat('🌧️','Regenrisiko',rainVal,rainSub)}${stat('💧','Luftfeuchte',isNum(s.humidity)?nf(s.humidity)+' %':'k. A.','')}${stat('☀️',sunLabel,sunVal,'')}${s.sun?stat('🌅','Sonnenaufgang',s.sun.rise,'')+stat('🌇','Sonnenuntergang',s.sun.set,''):''}</div>
<div><div class="wx-label">Die nächsten Stunden</div><div class="wx-hours" role="list">${hours}</div></div>
<div class="wx-wear"><div class="wx-label">Das ziehst du an${plan.head?': '+esc(plan.head):''}</div><div class="wx-chips">${plan.items.map(i=>`<span class="wx-chip"><span aria-hidden="true">${i.icon}</span>${esc(i.label)}</span>`).join('')}</div><p class="wx-text weather-advice">${esc(plan.text)}</p></div>
${tm}
${more?`<details class="wx-more"><summary>Mehr Details</summary><div class="wx-more-grid">${more}</div></details>`:''}
<p class="hinweis wx-src">Quelle: DWD über <a href="https://brightsky.dev" target="_blank" rel="noopener">Bright Sky</a>. Ortsnamen: <a href="https://www.bigdatacloud.com" target="_blank" rel="noopener">BigDataCloud</a>.</p>
<details class="wx-more"><summary>Datenschutz</summary><p class="hinweis">Für Ort und Wetter werden gerundete Standortdaten abgefragt. Sie werden nicht in deinem Benutzerkonto gespeichert.</p></details>
<button class="btn klein" data-refresh>Standort &amp; Wetter aktualisieren</button>
</div>`;
}
export async function renderWeather(el,today,force=false) {
  el.innerHTML='<p class="hinweis">Standort und Wetter werden aktualisiert …</p>';
  try {
    const s=await loadWeather(today,force);if(!el.isConnected)return;
    el.innerHTML=weatherCardHtml(s);
    el.querySelector('[data-refresh]').onclick=()=>renderWeather(el,today,true);
    return s;
  } catch(error){if(!el.isConnected)return;el.innerHTML=`<p class="hinweis">${esc(error.message||'Der Standort konnte nicht ermittelt werden.')}</p><button class="btn klein" data-retry>${error.code===1?'Standort erlauben':'Standort & Wetter erneut laden'}</button>`;el.querySelector('[data-retry]').onclick=()=>renderWeather(el,today,true);}
}
