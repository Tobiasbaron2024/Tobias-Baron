import { berechne, feiertage, tagKey, REGIONEN } from './calc.js?v=10';
import { openFold, foldCards } from './fold.js?v=2';
import { fixedEintraege, planeMonat, autoPlanHtml, leseAutoPlan, ladeAutoPlan, speichereAutoPlan } from './wish-plan.js?v=1';
const $ = s => document.querySelector(s);
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = s => s.split('-').reverse().join('.');
const fmt = n => Number(n).toLocaleString('de-DE',{maximumFractionDigits:2});
const kinds = {arbeiten:'Arbeiten',frei:'Frei',bevorzugt:'Bevorzugt',unerwuenscht:'Unerwünscht'};
const arts = {dienst:'Dienst',frei:'Frei',urlaub:'Urlaub',krank:'Krank'};
export function wishCode(w){return w.kuerzel||({arbeiten:'A',frei:'F',bevorzugt:'B',unerwuenscht:'X'}[w.kind]||'?');}
export function wishDays(rows,month,cfg,fixed=[]){
 const [year,mo]=month.split('-').map(Number),days=new Date(Date.UTC(year,mo,0)).getUTCDate();
 const holidays=new Map(feiertage(cfg.region||'HH',year).map(([t,name])=>[tagKey(t),name]));
 return Array.from({length:days},(_,i)=>{const datum=month+'-'+String(i+1).padStart(2,'0'),entries=rows.concat(fixed).filter(w=>w.start_date<=datum&&w.end_date>=datum);
  const shifts=entries.filter(w=>(w.art==='dienst'||(!w.art&&w.kind!=='frei'))&&w.kind!=='unerwuenscht'&&w.shift_start&&w.shift_end);
  const hours=shifts.reduce((n,w)=>n+berechne({art:'dienst',datum,beginn:w.shift_start,ende:w.shift_end,pause_min:w.pause_min||0},cfg).std,0);
  return {datum,entries,shifts,hours,fest:entries.some(w=>w.fest),holiday:holidays.get(datum)||null,weekday:new Date(datum+'T12:00:00Z').getUTCDay()};
 });
}
export function wishTotals(days){return {hours:days.reduce((n,d)=>n+d.hours,0),workdays:days.filter(d=>d.shifts.length).length,free:days.filter(d=>!d.shifts.length).length,markedFree:days.filter(d=>d.entries.some(w=>w.art==='frei'||w.kind==='frei')).length,saturdays:days.filter(d=>d.weekday===6&&d.shifts.length).length,saturdayShifts:days.filter(d=>d.weekday===6).reduce((n,d)=>n+d.shifts.length,0)};}
export function wishPdfData(days,month,profile){
 const total=wishTotals(days),title='Wunschdienstplan '+month.split('-').reverse().join('.');
 return {titel:title,datei:'Shiftly-Wunschdienstplan-'+month+'.pdf',kopf:[['Name',profile.name||''],['Arbeitgeber',profile.firma||''],['Objekt',profile.objekt||''],['Monat',month]],spalten:[{t:'Datum',w:90},{t:'Tag',w:45},{t:'Kürzel / Wunsch',w:120},{t:'Zeit',w:105},{t:'Stunden',w:65,r:true},{t:'Notiz',w:220}],zeilen:days.map(d=>[date(d.datum),['So','Mo','Di','Mi','Do','Fr','Sa'][d.weekday],d.entries.map(w=>wishCode(w)).join(', ')||'–',d.shifts.map(w=>w.shift_start.slice(0,5)+'–'+w.shift_end.slice(0,5)).join(', '),fmt(d.hours),d.entries.map(w=>w.note||'').filter(Boolean).join('; ')]),summe:['Summe','',total.workdays+' Arbeitstage',total.saturdays+' Samstage',fmt(total.hours),'Frei markiert: '+total.markedFree+' · ohne Dienstwunsch: '+total.free],fuss:'Wunschplanung, keine bestätigten Dienste. Stunden berücksichtigen Pausen und Zeitumstellung. Urlaub und Krankheit sind Wünsche, keine Anträge.'};
}
// Eigenständiger Export: keine Stundenzettel, Lohnwerte oder bestätigten Dienste.
export async function baueWunschPdf(PDFLib,days,month,profile){
 const {PDFDocument,StandardFonts,rgb}=PDFLib,doc=await PDFDocument.create();
 const font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const ink=rgb(.06,.15,.23),muted=rgb(.33,.42,.49),blue=rgb(.02,.42,.64),light=rgb(.94,.97,.99),line=rgb(.83,.89,.93);
 const safe=s=>Array.from(String(s??'')).map(c=>{try{font.encodeText(c);return c;}catch{return '?';}}).join('');
 let page=doc.addPage([595.28,841.89]);
 const text=(s,x,y,size=10,f=font,color=ink)=>page.drawText(safe(s),{x,y,size,font:f,color});
 const fit=(s,x,y,width,size=10,f=font,color=ink)=>{s=safe(s);while(s&&f.widthOfTextAtSize(s,size)>width)s=s.slice(0,-1);text(s,x,y,size,f,color);};
 const wrap=(s,width,size=9)=>{const lines=[];let current='';const words=safe(s).split(/\s+/).flatMap(word=>{const parts=[];let part='';for(const c of word){if(part&&font.widthOfTextAtSize(part+c,size)>width){parts.push(part);part='';}part+=c;}if(part)parts.push(part);return parts;});for(const word of words){const candidate=current?current+' '+word:word;if(current&&font.widthOfTextAtSize(candidate,size)>width){lines.push(current);current=word;}else current=candidate;}if(current)lines.push(current);return lines;};
 const total=wishTotals(days),[year,mo]=month.split('-').map(Number),label=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(new Date(Date.UTC(year,mo-1,1)));
 doc.setTitle('Wunschdienstplan '+label);doc.setAuthor(profile.name||'Shiftly');
 const heading=()=>{text('SHIFTLY / WUNSCHPLAN',32,803,10,bold,blue);text(label,32,769,26,bold);fit(profile.name||'Mein Wunschdienstplan',32,746,530,12,bold);fit([profile.firma,profile.objekt].filter(Boolean).join(' · '),32,727,530,9,font,muted);};heading();
 const boxWidth=(531-20)/3;
 [[fmt(total.hours)+' h','Gewünschte Stunden'],[total.workdays,'Arbeitstage'],[total.saturdays,'Gearbeitete Samstage']].forEach(([value,title],i)=>{const x=32+i*(boxWidth+10);page.drawRectangle({x,y:633,width:boxWidth,height:70,color:light});text(value,x+12,666,24,bold,blue);text(title,x+12,646,9,font,muted);});
 text('Dein Monatsplan',32,611,13,bold);text('Mo',38,589,10,bold);['Di','Mi','Do','Fr','Sa','So'].forEach((s,i)=>text(s,38+(i+1)*76,589,10,bold));
 const offset=(new Date(Date.UTC(year,mo-1,1)).getUTCDay()+6)%7,weekCount=Math.ceil((days.length+offset)/7),cellHeight=60;
 const extra=[];
 days.forEach((d,i)=>{const pos=i+offset,x=32+pos%7*76,y=575-(Math.floor(pos/7)+1)*cellHeight;
  page.drawRectangle({x,y,width:76,height:cellHeight,color:d.weekday===0||d.weekday===6?light:rgb(1,1,1),borderColor:line,borderWidth:.5});
  text(Number(d.datum.slice(-2)),x+6,y+cellHeight-14,10,bold,muted);
  if(d.holiday)text('FT',x+56,y+cellHeight-14,8,bold,blue);
  const codes=d.entries.map(wishCode).join(' / ')||'–';fit(codes,x+6,y+31,64,10,bold,d.shifts.length?blue:muted);
  if(d.shifts.length===1)text(d.shifts[0].shift_start.slice(0,5)+'–'+d.shifts[0].shift_end.slice(0,5),x+6,y+19,8);
  if(d.shifts.length>1)text(d.shifts.length+' Dienste *',x+6,y+19,8);
  if(d.hours)text(fmt(d.hours)+' h',x+6,y+7,8,bold,blue);
  if(d.entries.some(w=>w.note)||d.shifts.length>1||font.widthOfTextAtSize(safe(codes),10)>64)extra.push(d);
 });
 let y=575-weekCount*cellHeight-23;
 text(total.markedFree+' Tage ausdrücklich frei · '+total.free+' Tage ohne Dienstwunsch',32,y,10,bold);y-=23;
 for(const l of wrap('FT = Feiertag'+(days.some(d=>d.holiday)?': '+days.filter(d=>d.holiday).map(d=>date(d.datum)+' '+d.holiday).join(' · '):' (keine in diesem Monat)'),530)){text(l,32,y,9,font,muted);y-=13;}y-=5;
 for(const s of ['Nur Wunschplanung: keine Übernahme in Arbeitszeit oder Stundenzettel.','Stunden berücksichtigen Pausen und Zeitumstellung. Urlaub und Krank zählen nicht als Arbeitsstunden.','Die Kürzel entsprechen deinen gespeicherten Kalenderkürzeln.']){for(const l of wrap(s,530)){text(l,32,y,9,font,muted);y-=13;}}
 if(extra.length){
  page=doc.addPage([595.28,841.89]);heading();y=694;text('Notizen und weitere Angaben',32,y,15,bold);y-=27;
  for(const d of extra){
   const lines=[date(d.datum)+' · '+d.entries.map(wishCode).join(' / '),...d.entries.flatMap(w=>wrap([wishCode(w),w.shift_start&&w.shift_end?w.shift_start.slice(0,5)+'–'+w.shift_end.slice(0,5)+' (Pause '+(w.pause_min||0)+' Min.)':'',w.note||''].filter(Boolean).join(' · '),530))];
   for(let i=0;i<lines.length;i++){if(y<55){page=doc.addPage([595.28,841.89]);heading();y=694;}text(lines[i],32,y,9,i===0?bold:font);y-=14;}y-=12;
  }
 }
 doc.getPages().forEach((p,i)=>{page=p;text('Wunschdienstplan · '+(i+1)+' / '+doc.getPageCount(),32,25,8,font,muted);});
 return doc.save();
}
export async function renderWishes(ctx){
 const {S,api,toast,ladeExtras}=ctx,month=S.wunschMonat||S.monat||ctx.heuteISO().slice(0,7);S.wunschMonat=month;
 const [year,mo]=month.split('-').map(Number),end=new Date(Date.UTC(year,mo,0)).getUTCDate();
 let rows;try{rows=await api(`sz_wishes?select=*&start_date=lte.${month}-${end}&end_date=gte.${month}-01&order=start_date.asc`);}catch(e){toast(e.message);return;}
 if(S.ansicht!=='wuensche')return;
 let fixed=[];try{fixed=fixedEintraege(await api(`sz_shifts?select=id,datum,beginn,ende,pause_min,art,kuerzel,notiz&datum=gte.${month}-01&datum=lte.${month}-${end}&order=datum.asc`));}catch{}
 if(S.ansicht!=='wuensche')return;
 const codes=ctx.kuerzelMap(),days=wishDays(rows,month,ctx.monatDaten().c,fixed),total=wishTotals(days);
 if(S.wunschStempel&&S.wunschStempel!=='__leer'&&!codes[S.wunschStempel])S.wunschStempel=null;
 const label=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(new Date(Date.UTC(year,mo-1,1)));
 const offset=(new Date(Date.UTC(year,mo-1,1)).getUTCDay()+6)%7;
 const dayContent=d=>`<span class="kn">${Number(d.datum.slice(-2))}</span>${d.holiday?'<span class="wish-holiday-mark">FT</span>':''}${d.entries.map(w=>`<span class="kc wish-${style(w)}${w.fest?' wish-fest':''}${w.vorschlag?' wish-vorschlag':''}">${esc(wishCode(w))}</span>`).join('')}`;
 const style=w=>w.art==='frei'||w.kind==='frei'?'frei':w.art==='urlaub'?'bevorzugt':w.art==='krank'?'unerwuenscht':w.kind;
 const rowEditor=([code,k])=>`<tr data-saved-code="${esc(code)}"><td><input class="wc-code" maxlength="6" value="${esc(code)}"></td><td><select class="wc-art">${Object.entries(arts).map(([a,t])=>`<option value="${a}" ${k.art===a?'selected':''}>${t}</option>`).join('')}</select></td><td><input class="wc-start" type="time" value="${esc(k.beginn||'')}"></td><td><input class="wc-end" type="time" value="${esc(k.ende||'')}"></td><td><input class="wc-pause" type="number" min="0" max="240" value="${Number(k.pause)||0}"></td><td><button type="button" class="btn klein rot wc-remove">Löschen</button></td></tr>`;
 $('#inhalt').innerHTML=`<section class="card wish-calendar-card"><button class="btn klein" id="back-more">‹ Menü</button><h1>Wunschdienstplan</h1><p class="hinweis">Deine Kürzel aus dem Arbeitskalender. Wähle ein Kürzel und tippe auf die gewünschten Tage. Jeder Eintrag wird sofort gespeichert.</p><div class="monat"><button id="wish-prev" aria-label="Vormonat">‹</button><div><h2>${label}</h2><button class="btn klein" id="wish-today">Aktueller Monat</button></div><button id="wish-next" aria-label="Nächster Monat">›</button></div>
 <div class="kacheln wish-totals"><div class="kachel"><b>${fmt(total.hours)}</b><span>Gewünschte Arbeitsstunden</span></div><div class="kachel"><b>${total.workdays}</b><span>Arbeitstage</span></div><div class="kachel"><b>${total.free}</b><span>Tage ohne Dienstwunsch</span></div><div class="kachel"><b>${total.markedFree}</b><span>Frei markiert</span></div><div class="kachel"><b>${total.saturdays}</b><span>Gearbeitete Samstage</span></div></div>
 <div class="stempel wish-calendar-stamps" role="group" aria-label="Kürzel zum Eintragen">${Object.entries(codes).map(([code,k])=>`<button data-wish-stamp="${esc(code)}" class="st k-${k.art==='dienst'?(Number((k.beginn||'06:00').slice(0,2))>=18?'na':'ta'):k.art==='urlaub'?'ur':k.art==='krank'?'kr':'frei'} ${S.wunschStempel===code?'an':''}"><b>${esc(code)}</b><small>${k.art==='dienst'?esc(k.beginn)+'–'+esc(k.ende):arts[k.art]}</small></button>`).join('')}<button data-wish-stamp="__leer" class="st k-leer ${S.wunschStempel==='__leer'?'an':''}"><b>⌫</b><small>Entfernen</small></button></div>
 <div class="wish-weekdays">${['Mo','Di','Mi','Do','Fr','Sa','So'].map(t=>`<span>${t}</span>`).join('')}</div><div class="kal wish-calendar">${'<span class="kt leer"></span>'.repeat(offset)}${days.map(d=>`<button class="kt ${d.holiday?'wish-holiday calendar-holiday':''} ${d.datum===ctx.heuteISO()?'heute':''}" data-wish-day="${d.datum}" title="${esc(d.holiday||'')}" aria-label="${date(d.datum)}${d.holiday?', '+esc(d.holiday):''}: ${esc(d.entries.map(wishCode).join(', ')||'kein Wunsch')}">${dayContent(d)}</button>`).join('')}</div><div class="wish-holiday-legend"><b><span class="wish-holiday-mark">FT</span> Feiertage · ${esc(REGIONEN[ctx.monatDaten().c.region]?.n||ctx.monatDaten().c.region||'Hamburg')}</b>${days.filter(d=>d.holiday).map(d=>`<span>${date(d.datum)} · ${esc(d.holiday)}</span>`).join('')||'<span>In diesem Monat gibt es hier keine gesetzlichen Feiertage.</span>'}</div><p class="hinweis">Stunden berücksichtigen Pausen und Zeitumstellung. Urlaub und Krank zählen hier nicht als Arbeitsstunden. Wünsche ändern keine bestätigten Schichten oder Urlaubsanträge. Einträge mit Streifen kommen fest aus deinem Arbeitskalender und lassen sich hier nicht ändern.</p><p id="wish-save-status" class="hinweis" role="status">${S.wishSaveError?esc("Speichern fehlgeschlagen: "+S.wishSaveError):"Alle Einträge gespeichert."}</p><div id="wish-saved-summary" class="wish-saved-summary" hidden role="status"></div><div class="reihe"><button class="btn pri" id="wish-plan-save">Wunschplan speichern</button><button class="btn" id="wish-save">PDF speichern</button><button class="btn" id="wish-share">Versenden</button><button class="btn" id="wish-edit-codes">Kürzel verwalten / löschen</button></div>${autoPlanHtml(codes,S.autoPlan||(S.autoPlan=ladeAutoPlan(ctx.sitzung?.user?.id)))}</section>
 <section class="card"><h2>Zeitraum oder Uhrzeit eintragen</h2><form id="wish-form" class="raster"><label>Von<input name="start_date" type="date" required value="${ctx.heuteISO()}"></label><label>Bis<input name="end_date" type="date" required value="${ctx.heuteISO()}"></label><label>Kürzel<select name="kuerzel"><option value="">Ohne Kürzel</option>${Object.keys(codes).map(k=>`<option>${esc(k)}</option>`).join('')}</select></label><label>Wunsch<select name="kind">${Object.entries(kinds).map(([k,t])=>`<option value="${k}">${t}</option>`).join('')}</select></label><label>Beginn<input name="shift_start" type="time"></label><label>Ende<input name="shift_end" type="time"></label><label>Pause (Minuten)<input name="pause_min" type="number" min="0" max="240" value="0"></label><label>Notiz<input name="note" maxlength="300"></label><button class="btn pri" type="submit">Wunsch speichern</button><button class="btn" type="button" id="wish-reset">Neuer Wunsch</button></form></section>
 <section class="card"><h2>Wünsche im Monat</h2>${rows.map(w=>`<div class="ul-zeile"><div><b>${date(w.start_date)} bis ${date(w.end_date)} · ${esc(wishCode(w))}</b><p class="hinweis">${kinds[w.kind]} ${w.shift_start?esc(w.shift_start.slice(0,5)+'–'+(w.shift_end||'').slice(0,5)):''} ${esc(w.note||'')}</p></div><div><button class="btn klein" data-wish-edit="${w.id}">Ändern</button><button class="btn klein rot" data-delete-wish="${w.id}">Entfernen</button></div></div>`).join('')||'<p>Noch keine Wünsche eingetragen.</p>'}</section>
 <section class="card" id="wish-code-editor"><h2>Gemeinsame Kürzel ändern</h2><p class="hinweis">Löschen wird sofort gespeichert, auch wenn die Liste danach leer ist. Neue Kürzel und Änderungen mit „Kürzel speichern“ übernehmen. Diese Kürzel gelten auch im Arbeitskalender. Bereits gespeicherte Einträge behalten ihre eingetragenen Zeiten.</p><div class="tabelle"><table class="kz"><thead><tr><th>Kürzel</th><th>Art</th><th>Beginn</th><th>Ende</th><th>Pause</th><th></th></tr></thead><tbody id="wish-code-rows">${Object.entries(codes).map(rowEditor).join('')}</tbody></table></div><div class="reihe"><button class="btn" id="wish-code-add">+ Kürzel</button><button class="btn pri" id="wish-code-save">Kürzel speichern</button></div></section>`;
 let busy=Boolean(S.wishPending),editing=null,proposal=null;const form=$('#wish-form');
 let pending=0;
 const paint=()=>{const fresh=wishDays(rows,month,ctx.monatDaten().c,fixed),t=wishTotals(fresh);for(const d of fresh){const b=document.querySelector(`[data-wish-day="${d.datum}"]`);if(b){b.innerHTML=dayContent(d);b.setAttribute('aria-label',date(d.datum)+(d.holiday?', '+d.holiday:'')+': '+(d.entries.map(wishCode).join(', ')||'kein Wunsch'));}}const values=[t.hours,t.workdays,t.free,t.markedFree,t.saturdays];document.querySelectorAll('.wish-totals b').forEach((b,i)=>b.textContent=fmt(values[i]));};
 const operation=fn=>{pending++;S.wishPending=(S.wishPending||0)+1;busy=true;S.wishSaveError=null;const status=$('#wish-save-status');if(status)status.textContent='Wird gespeichert …';
  const task=(S.wishQueue||Promise.resolve()).then(fn).catch(e=>{S.wishSaveError=e.message;toast(e.message);});S.wishQueue=task;
  return task.finally(async()=>{pending--;S.wishPending=Math.max(0,(S.wishPending||1)-1);if(pending||S.wishPending)return;try{await ladeExtras();if(pending||S.wishPending||S.ansicht!=='wuensche'||S.wunschMonat!==month)return;await renderWishes(ctx);}catch(e){toast(e.message);}finally{busy=pending>0;}});
 };
 const fromCode=(code,day)=>{const k=codes[code];return {start_date:day,end_date:day,kind:k.art==='frei'?'frei':'arbeiten',kuerzel:code,art:k.art,shift_start:k.art==='dienst'?k.beginn:null,shift_end:k.art==='dienst'?k.ende:null,pause_min:k.art==='dienst'?Number(k.pause||0):0,note:null};};
 const edit=w=>{editing=w.id;for(const [k,v] of Object.entries(w)){if(form.elements[k])form.elements[k].value=v??'';}openFold(form.closest('.card'));form.scrollIntoView({behavior:'smooth',block:'start'});};
 $('#back-more').onclick=()=>$('#app-menu-open')?.click();
 for(const [id,delta] of [['wish-prev',-1],['wish-next',1]])$('#'+id).onclick=()=>{if(busy)return;S.wunschMonat=new Date(Date.UTC(year,mo-1+delta,1)).toISOString().slice(0,7);renderWishes(ctx);};
 $('#wish-today').onclick=()=>{if(busy)return;S.wunschMonat=ctx.heuteISO().slice(0,7);renderWishes(ctx);};
 document.querySelectorAll('[data-wish-stamp]').forEach(b=>b.onclick=()=>{S.wunschStempel=b.dataset.wishStamp;document.querySelectorAll('[data-wish-stamp]').forEach(x=>x.classList.toggle('an',x===b));});
 document.querySelectorAll('[data-wish-day]').forEach(b=>b.onclick=()=>{const day=b.dataset.wishDay;if(proposal){toast('Bitte erst den Plan-Vorschlag übernehmen oder verwerfen.');return;}const festTag=fixed.filter(f=>f.start_date===day);if(festTag.length){toast('Fester Eintrag aus deinem Arbeitskalender: '+festTag.map(wishCode).join(', ')+'. Ändern kannst du ihn im Dienstplan.');return;}const onDay=rows.filter(w=>w.start_date<=day&&w.end_date>=day),stamp=S.wunschStempel;
  if(!stamp){if(onDay[0])edit(onDay[0]);else{editing=null;form.elements.start_date.value=day;form.elements.end_date.value=day;openFold(form.closest('.card'));form.scrollIntoView({behavior:'smooth'});}return;}
  if(stamp==='__leer'||(onDay.length===1&&wishCode(onDay[0])===stamp)){
   if(onDay.some(w=>w.start_date!==w.end_date)&&!confirm('Dieser Wunsch gilt für einen ganzen Zeitraum. Den gesamten Zeitraum entfernen?'))return;
   rows=rows.filter(w=>!onDay.includes(w));paint();operation(async()=>{for(const w of onDay)await api(`sz_wishes?id=eq.${w.id}`,{method:'DELETE'});});return;
  }
  if(onDay.length){edit(onDay[0]);toast('Hier besteht bereits ein Wunsch. Du kannst ihn im Formular ändern.');return;}
  const entry={...fromCode(stamp,day),id:crypto.randomUUID()};rows.push(entry);paint();operation(async()=>{await api('sz_wishes',{method:'POST',body:entry});});
 });
 form.elements.kuerzel.onchange=()=>{const k=codes[form.elements.kuerzel.value];if(!k)return;form.elements.kind.value=k.art==='frei'?'frei':'arbeiten';form.elements.shift_start.value=k.beginn||'';form.elements.shift_end.value=k.ende||'';form.elements.pause_min.value=k.pause||0;};
 $('#wish-reset').onclick=()=>{editing=null;form.reset();};
 form.onsubmit=e=>{e.preventDefault();if(busy)return;const d=Object.fromEntries(new FormData(form)),k=codes[d.kuerzel];if(d.end_date<d.start_date||(Date.parse(d.end_date)-Date.parse(d.start_date))/86400000>92){toast('Bitte einen Zeitraum von höchstens 93 Tagen wählen.');return;}d.art=k?.art||null;d.pause_min=Number(d.pause_min||0);if(!Number.isInteger(d.pause_min)||d.pause_min<0||d.pause_min>240){toast('Bitte eine Pause zwischen 0 und 240 Minuten eintragen.');return;}for(const field of ['kuerzel','shift_start','shift_end','note'])d[field]=d[field]||null;if(d.art&&d.art!=='dienst'){d.shift_start=null;d.shift_end=null;d.pause_min=0;}if((d.art==='dienst'||d.shift_start||d.shift_end)&&(!d.shift_start||!d.shift_end||d.shift_start===d.shift_end)){toast('Bitte unterschiedliche Anfangs- und Endzeiten eintragen.');return;}operation(async()=>{await api(editing?`sz_wishes?id=eq.${editing}`:'sz_wishes',{method:editing?'PATCH':'POST',body:d});toast('Wunsch gespeichert');});};
 document.querySelectorAll('[data-wish-edit]').forEach(b=>b.onclick=()=>edit(rows.find(w=>w.id===b.dataset.wishEdit)));
 document.querySelectorAll('[data-delete-wish]').forEach(b=>b.onclick=()=>operation(async()=>{await api(`sz_wishes?id=eq.${b.dataset.deleteWish}`,{method:'DELETE'});toast('Wunsch entfernt');}));
 const bindCodeRow=tr=>{const change=()=>tr.querySelectorAll('.wc-start,.wc-end,.wc-pause').forEach(x=>x.disabled=tr.querySelector('.wc-art').value!=='dienst');tr.querySelector('.wc-art').onchange=change;tr.querySelector('.wc-remove').onclick=()=>{
   const code=tr.dataset.savedCode;if(!code){tr.remove();return;}
   const button=tr.querySelector('.wc-remove');button.disabled=true;button.textContent='Wird gelöscht …';
   operation(async()=>{try{await ctx.deletePersonalCode(code);tr.remove();toast('Kürzel gelöscht und gespeichert');}catch(e){button.disabled=false;button.textContent='Löschen';throw e;}});
 };change();};
 $('#wish-code-rows').querySelectorAll('tr').forEach(bindCodeRow);
 $('#wish-code-add').onclick=()=>{const tr=document.createElement('tr');tr.innerHTML=rowEditor(['',{art:'dienst',beginn:'06:00',ende:'18:00',pause:0}]).replace(/^<tr[^>]*>|<\/tr>$/g,'');$('#wish-code-rows').append(tr);bindCodeRow(tr);};
 $('#wish-edit-codes').onclick=()=>{openFold($('#wish-code-editor'));$('#wish-code-editor').scrollIntoView({behavior:'smooth'});};
 $('#wish-code-save').onclick=()=>{if(busy)return;const next={};for(const tr of $('#wish-code-rows').querySelectorAll('tr')){const value=s=>tr.querySelector(s).value,code=value('.wc-code').trim().toUpperCase(),art=value('.wc-art'),start=value('.wc-start'),end=value('.wc-end'),pause=Number(value('.wc-pause')||0);if(!/^[A-ZÄÖÜ0-9+\-/.]{1,6}$/.test(code)||next[code]){toast('Bitte eindeutige Kürzel mit höchstens sechs Zeichen verwenden.');return;}if(art==='dienst'&&(!start||!end||start===end||!Number.isInteger(pause)||pause<0||pause>240)){toast('Bitte Zeiten und Pause prüfen: '+code);return;}next[code]={art,beginn:art==='dienst'?start:null,ende:art==='dienst'?end:null,pause:art==='dienst'?pause:0};}operation(async()=>{const result=await api(`sz_profile?user_id=eq.${ctx.sitzung.user.id}`,{method:'PATCH',body:{kuerzel:next,kuerzel_customized:true,updated_at:new Date().toISOString()},prefer:'return=representation'});S.profil=result[0]||{...S.profil,kuerzel:next,kuerzel_customized:true};S.stempel=null;S.wunschStempel=null;if(!next[S.form.kuerzel])S.form.kuerzel=null;toast('Gemeinsame Kürzel gespeichert');});};
 $('#wish-plan-save').onclick=async()=>{try{await S.wishQueue;while(S.wishPending)await S.wishQueue;if(S.wishSaveError)throw new Error(S.wishSaveError);await ladeExtras();await renderWishes(ctx);const saved=wishTotals(wishDays(rows,month,ctx.monatDaten().c,fixed)),summary=$('#wish-saved-summary');summary.hidden=false;summary.innerHTML=`<b>✓ Dein Wunschdienstplan ist gespeichert</b><span>${esc(label)} · ${fmt(saved.hours)} Stunden · ${saved.workdays} Arbeitstage · ${saved.saturdays} Samstage</span><small>Nur deine Wünsche – dein Stundenzettel bleibt unverändert. Du kannst den Plan jetzt als PDF speichern oder versenden.</small>`;toast('Wunschplan gespeichert');}catch(e){toast('Speichern fehlgeschlagen: '+e.message);}};
 const download=file=>{const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);};
 const exportPlan=async share=>{if(busy){toast('Bitte kurz warten, bis dein Eintrag gespeichert ist.');return;}try{const data=wishPdfData(days,month,S.profil),bytes=await baueWunschPdf(await ctx.ladePdfLib(),days,month,S.profil),file=new File([bytes],data.datei,{type:'application/pdf'});if(share&&navigator.canShare?.({files:[file]})&&navigator.share)await navigator.share({files:[file],title:data.titel});else{download(file);toast(share?'PDF gespeichert. Du kannst es jetzt per E-Mail oder Messenger versenden.':'Wunschdienstplan als PDF gespeichert');}}catch(e){if(e.name!=='AbortError')toast('PDF konnte nicht erstellt werden: '+e.message);}};
 $('#wish-save').onclick=()=>exportPlan(false);$('#wish-share').onclick=()=>exportPlan(true);
 const autoBox=document.querySelector('.wish-auto');
 if(autoBox){
  const uid=ctx.sitzung?.user?.id,result=$('#wish-auto-result');
  const zeigeErgebnis=html=>{result.hidden=!html;result.innerHTML=html||'';};
  const verwerfen=()=>{if(!proposal)return;rows=proposal.base.concat(proposal.replaced);proposal=null;paint();zeigeErgebnis('');};
  $('#wish-auto-reset').onclick=()=>{verwerfen();S.autoPlan=null;speichereAutoPlan(uid,null);renderWishes(ctx);};
  $('#wish-auto-run').onclick=()=>{
   if(busy){toast('Bitte kurz warten, bis dein Eintrag gespeichert ist.');return;}
   verwerfen();
   const s=leseAutoPlan(autoBox);S.autoPlan=s;speichereAutoPlan(uid,s);
   const first=month+'-01',last=month+'-'+String(end).padStart(2,'0'),cfg=ctx.monatDaten().c;
   const replaced=s.ersetzen?rows.filter(w=>w.start_date>=first&&w.end_date<=last):[],base=rows.filter(w=>!replaced.includes(w));
   const res=planeMonat({cfg,codes,days:wishDays(base,month,cfg,fixed),s});
   if(res.error){zeigeErgebnis(`<b>${esc(res.error)}</b>`);return;}
   if(!res.entries.length){zeigeErgebnis(`<b>Es gibt nichts zu planen</b><span>${esc(res.notes.join(' ')||'Mit diesen Regeln ist kein freier Tag übrig.')}</span>`);return;}
   const neu=res.entries.map(e=>({...fromCode(e.code,e.datum),id:'vorschlag-'+e.datum,vorschlag:true}));
   proposal={base,replaced,neu};rows=base.concat(neu);paint();
   const teile=Object.entries(res.nachCode).map(([c,n])=>n+'× '+esc(c)).join(', ');
   zeigeErgebnis(`<b>Vorschlag: ${res.entries.length} Dienste, ${fmt(res.neueStunden)} Stunden</b><span>${teile}. Im Monat sind es damit ${fmt(res.stunden)} Stunden.${replaced.length?' '+replaced.length+' bisherige Wünsche werden ersetzt.':''}</span>${res.notes.map(n=>`<small>${esc(n)}</small>`).join('')}<small>Der Vorschlag ist noch nicht gespeichert. Im Kalender sind die Kürzel gestrichelt umrandet.</small><div class="reihe"><button class="btn pri" id="wish-auto-apply" type="button">Übernehmen</button><button class="btn" id="wish-auto-discard" type="button">Verwerfen</button></div>`);
   $('#wish-auto-discard').onclick=verwerfen;
   $('#wish-auto-apply').onclick=()=>{const p=proposal;if(!p)return;proposal=null;
    operation(async()=>{
     if(p.replaced.length)await api(`sz_wishes?id=in.(${p.replaced.map(w=>w.id).join(',')})`,{method:'DELETE'});
     await api('sz_wishes',{method:'POST',body:p.neu.map(({id,vorschlag,...w})=>({...w,id:crypto.randomUUID()}))});
     toast('Wunschplan übernommen: '+p.neu.length+' Dienste');
    });};
  };
 }
 foldCards($('#inhalt'),'wuensche',[{index:1,key:'formular',label:'Zeitraum oder Uhrzeit eintragen'},{index:2,key:'liste',label:'Wünsche im Monat',open:true},{index:3,key:'kuerzel',label:'Gemeinsame Kürzel ändern'}]);
}
