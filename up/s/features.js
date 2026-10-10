export { renderWishes } from './wishes.js?v=9';
import { budgetPeriod } from './periods.js?v=1';
// Zusätzliche Shiftly-Bereiche. Alle Datensätze liegen hinter Supabase RLS.
import { foldCards, openFold, rememberDetails } from './fold.js?v=2';
const $ = s => document.querySelector(s);
const euro = n => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const number = v => { const n=Number(String(v).replace(',','.')); return Number.isFinite(n)?n:NaN; };
const date = s => s?.split('-').reverse().join('.') || '';
const safe = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function renderObjects(ctx) {
  const {S,api,toast,ladeExtras}=ctx;
  $('#inhalt').innerHTML=`<section class="card"><button class="btn klein" id="back-more">‹ Menü</button><h1>Objekte & Tarife</h1><p class="hinweis">Einmal pro Objekt einrichten, danach im Kalender auswählen. Die App übernimmt automatisch den Tarif dieses Objekts. Zulagen aus dem Hauptobjekt werden nicht übernommen. Die Werte werden beim Speichern einer Schicht festgehalten. Ändert sich später der Tarif, bleiben alte Abrechnungen bestehen.</p>
    <div class="extra-grid">${S.objekte.map(o=>`<div class="extra-item"><b>${safe(o.name)}</b><span>${safe(o.region)} · ab ${date(o.gueltig_ab)} · ${euro(o.lohn)}/Std. · Zulagen ${euro(Number(o.objektzulage)+Number(o.weitere_zulage))}/Std.</span><div class="reihe"><button class="btn klein" data-edit-object="${o.id}">Bearbeiten</button><button class="btn klein" data-delete-object="${o.id}">Löschen</button></div></div>`).join('')||'<p>Noch kein Objekt hinterlegt.</p>'}</div></section>
    <section class="card"><h2 id="obj-heading">Objekt hinzufügen</h2><form id="obj-form" class="raster">
    <label>Name<input name="name" maxlength="80" required></label><label>Gültig ab<input name="gueltig_ab" type="date" required value="${ctx.heuteISO()}"></label>
    <label>Bundesland / Region<select name="region">${Object.entries((await import('./calc.js?v=10')).REGIONEN).map(([k,v])=>`<option value="${k}" ${k===S.profil.region?'selected':''}>${safe(v.n)}</option>`).join('')}</select></label>
    <label>Stundenlohn (€)<input name="lohn" type="number" step=".01" min="0" required value="${S.profil.lohn}"></label>
    <label>Objektzulage je Stunde (€)<input name="objektzulage" type="number" step=".01" min="0" value="0"></label>
    <label>Weitere Zulage je Stunde (€)<input name="weitere_zulage" type="number" step=".01" min="0" value="0"></label>
    <label>Nachtzuschlag (%)<input name="nacht_pct" type="number" step=".01" min="0" max="500" value="${S.profil.nacht_pct}"></label>
    <label>Sonntagszuschlag (%)<input name="sonntag_pct" type="number" step=".01" min="0" max="500" value="${S.profil.sonntag_pct}"></label>
    <label>Feiertagszuschlag (%)<input name="feiertag_pct" type="number" step=".01" min="0" max="500" value="${S.profil.feiertag_pct}"></label>
    <label>Nacht von<input name="nacht_von" type="time" value="${S.profil.nacht_von.slice(0,5)}"></label>
    <label>Nacht bis<input name="nacht_bis" type="time" value="${S.profil.nacht_bis.slice(0,5)}"></label>
    <label class="check"><input name="aktiv" type="checkbox" checked> Für neue Schichten auswählbar</label>
    <button class="btn pri" type="submit">Objekt speichern</button><button class="btn" id="obj-reset" type="button">Neues Objekt</button></form></section>`;
  $('#back-more').onclick=()=>$('#app-menu-open')?.click();
  let editing=null;
  document.querySelectorAll('[data-edit-object]').forEach(b=>b.onclick=()=>{
    const o=S.objekte.find(x=>x.id===b.dataset.editObject);editing=o.id;
    for(const [k,v] of Object.entries(o)){const field=$(`#obj-form [name="${k}"]`);if(field) field.type==='checkbox'?field.checked=!!v:field.value=String(v).slice(0,field.type==='time'?5:undefined);}
    $('#obj-heading').textContent='Objekt bearbeiten';openFold($('#obj-form').closest('.fold-card'));$('#obj-form').scrollIntoView({behavior:'smooth'});
  });
  document.querySelectorAll('[data-delete-object]').forEach(b=>b.onclick=async()=>{
    const o=S.objekte.find(x=>x.id===b.dataset.deleteObject);if(!o)return;
    if(!confirm(`Objekt „${o.name}“ löschen? Bereits eingetragene Schichten und ihre gespeicherten Lohnwerte bleiben erhalten.`))return;
    b.disabled=true;
    try {
      const deleted=await api(`sz_objects?id=eq.${o.id}`,{method:'DELETE',prefer:'return=representation'});
      if(!deleted?.length)throw new Error('Das Objekt konnte nicht gelöscht werden. Bitte Anmeldung und Zugangsrechte prüfen.');
      if(S.form.object_id===o.id) { S.form.object_id=null;try{localStorage.removeItem('shiftly.object.'+(ctx.sitzung?.user?.id||S.profil.user_id||''));}catch{} }
      S.jahr=null;await ladeExtras();await ctx.ladeMonat();await renderObjects(ctx);toast('Objekt gelöscht. Eingetragene Schichten bleiben erhalten.');
    }catch(err){toast(err.message);b.disabled=false;}
  });
  $('#obj-reset').onclick=()=>{editing=null;$('#obj-form').reset();$('#obj-heading').textContent='Objekt hinzufügen';};
  $('#obj-form').onsubmit=async e=>{
    e.preventDefault();const fd=new FormData(e.target),payload={};
    for(const k of ['name','gueltig_ab','region','nacht_von','nacht_bis']) payload[k]=String(fd.get(k)||'').trim();
    for(const k of ['lohn','objektzulage','weitere_zulage','nacht_pct','sonntag_pct','feiertag_pct']){payload[k]=number(fd.get(k));if(!Number.isFinite(payload[k])||payload[k]<0){toast('Bitte gültige Lohnwerte eingeben.');return;}}
    payload.aktiv=e.target.elements.aktiv.checked;
    const btn=e.submitter; if(btn) btn.disabled=true;
    try{await api(editing?`sz_objects?id=eq.${editing}`:'sz_objects',{method:editing?'PATCH':'POST',body:payload,prefer:'return=minimal'});await ladeExtras();renderObjects(ctx);toast('Objekt gespeichert');}catch(err){toast(err.message);if(btn)btn.disabled=false;}
  };
  foldCards($('#inhalt'), 'objekte', [{index:0,key:'liste',label:'Deine Objekte',open:true},{index:1,key:'formular',label:'Objekt hinzufügen oder bearbeiten'}]);
}

export async function syncIncome({api,S,monatDaten,nettoFuer}) {
 if(!S.prefs.budget_link||S.prefs.income_mode!=='automatic'||!S.profil)return;
 const {T,c}=monatDaten(),n=nettoFuer(T,c);
 if(!n)return;
 await api('sz_income_estimates?on_conflict=user_id,month',{method:'POST',body:{month:`${S.monat}-01`,net_amount:Math.max(0,Math.round(n.netto*100)/100)},prefer:'resolution=merge-duplicates,return=minimal'});
}

export async function renderBudget(ctx) {
 const {api,S,monatDaten,nettoFuer,toast}=ctx;
 if (!$('#groschen-frame')) {
  $('#inhalt').innerHTML=`<div class="groschen-toolbar"><div><span class="label">Finanzen</span><h1>Groschen</h1><p class="hinweis">Dein Haushaltsbuch in Shiftly</p></div><button class="btn klein" id="groschen-refresh">Aktualisieren</button></div>
    <nav class="groschen-sections" aria-label="Haushaltsbuch">${[['uebersicht','Übersicht'],['buchungen','Buchungen'],['fixkosten','Fixkosten'],['spartipps','Spartipps'],['analyse','Analyse'],['konto','Konto']].map(([k,n])=>`<button class="btn klein" data-groschen-view="${k}" ${k==='uebersicht'?'aria-current="page"':''}>${n}</button>`).join('')}${S.zugang?.admin?'<button class="btn klein" data-groschen-view="statistik">Statistik</button>':''}</nav>
    <div id="budget-summary"><section class="card">Haushaltsbuch wird geladen …</section></div>
    <iframe id="groschen-frame" class="groschen-frame" src="groschen/?embedded=1" title="Groschen Haushaltsbuch" scrolling="no"></iframe>`;
  document.querySelectorAll('[data-groschen-view]').forEach(b=>b.onclick=()=>{$('#groschen-frame')?.contentWindow?.postMessage({type:'shiftly-groschen-view',view:b.dataset.groschenView},location.origin);document.querySelectorAll('[data-groschen-view]').forEach(x=>x.removeAttribute('aria-current'));b.setAttribute('aria-current','page');});
  $('#groschen-frame').onload=()=>{const cs=getComputedStyle(document.documentElement);$('#groschen-frame')?.contentWindow?.postMessage({type:'shiftly-groschen-theme',colors:{bg:cs.getPropertyValue('--bg').trim(),surface:cs.getPropertyValue('--card').trim(),ink:cs.getPropertyValue('--ink').trim(),muted:cs.getPropertyValue('--muted').trim(),line:cs.getPropertyValue('--line').trim(),accent:cs.getPropertyValue('--acc').trim(),accentInk:cs.getPropertyValue('--acc-ink').trim()}},location.origin);};
  $('#groschen-refresh').onclick=()=>ctx.refreshApp?ctx.refreshApp():renderBudget(ctx);
 }
 try {
  const p = await api('profiles?select=payday,savings_goal,period_start,period_end');
  const anchor = S.monat === ctx.heuteISO().slice(0,7) ? ctx.heuteISO() : `${S.monat}-${String(p[0]?.payday || 1).padStart(2,'0')}`;
  const period = budgetPeriod(anchor, p[0]?.payday, p[0]);
  const [rec,tx,bud,estimates] = await Promise.all([
   api('recurring?select=*'),api(`transactions?select=*&tx_date=gte.${period.start}&tx_date=lt.${period.next}`),api('budgets?select=*'),api(`sz_income_estimates?select=net_amount&month=eq.${period.month}-01`)]);
  const wageShifts = period.month === S.monat ? S.schichten : await api(`sz_shifts?select=*&datum=gte.${period.month}-01&datum=lt.${new Date(Date.UTC(Number(period.month.slice(0,4)),Number(period.month.slice(5)),1)).toISOString().slice(0,10)}&order=datum.asc`);
  const {T,c}=monatDaten(wageShifts),N=nettoFuer(T,c);
  const recOut=rec.filter(r=>r.kind==='out').reduce((s,r)=>s+Number(r.amount)/(Number(r.interval_months)||1),0);
  const auto=S.prefs.income_mode==='automatic'&&S.prefs.budget_link;
  const recIn=rec.filter(r=>r.kind==='in'&&!(auto&&r.category==='gehalt')).reduce((s,r)=>s+Number(r.amount)/(Number(r.interval_months)||1),0);
  const txOut=tx.filter(t=>t.kind==='out').reduce((s,t)=>s+Number(t.amount),0);
  const txIn=tx.filter(t=>t.kind==='in'&&!(auto&&t.category==='gehalt')).reduce((s,t)=>s+Number(t.amount),0);
  const budgets=bud.reduce((s,b)=>s+Number(b.amount),0);
  const planned=Math.max(recOut+budgets,txOut)+Number(p[0]?.savings_goal||0);
  const estimated = N?.netto ?? estimates[0]?.net_amount;
  const income=(auto?Number(estimated||0)+recIn:recIn)+txIn;
  const perHour=T.std>0&&N?N.netto/T.std:0;
  const required=perHour>0?Math.ceil(Math.max(0,planned-recIn-txIn)/perHour):null;
  if (S.ansicht !== 'budget' || !$('#budget-summary')) return;
  $('#budget-summary').innerHTML=`<section class="card groschen-overview"><h2>Monatsblick · Arbeit &amp; Budget</h2><p class="hinweis">${date(period.start)} bis ${date(period.end)} · ${auto?'Netto aus Shiftly (geschätzt)':'Einkommen aus Groschen'}</p>
    <div class="kacheln"><div class="kachel"><b>${euro(income)}</b><span>Verfügbares Einkommen</span></div><div class="kachel"><b>${euro(planned)}</b><span>Ausgaben und Ziele (Schätzung)</span></div><div class="kachel"><b>${ctx.fh(T.std)}</b><span>Eingetragene Stunden</span></div><div class="kachel"><b>${required==null?'–':Math.max(0,required-T.std).toFixed(0)}</b><span>Weitere Stunden (grobe Schätzung)</span></div></div>
    <p class="hinweis">Arbeitsstunden und Nettoschätzung beziehen sich auf ${period.month}. Die Schätzung weiterer Stunden verwendet den bisherigen Durchschnitt; Zuschläge und Steuern können abweichen.</p>
    <p class="banner ${income<planned?'warn':'info'}">${income<planned?perHour>0?`Mit den aktuellen Stunden wird es knapp. Du benötigst ungefähr ${Math.max(0,required-T.std).toFixed(0)} weitere Stunden.`:'Das Einkommen deckt die geplanten Ausgaben derzeit nicht. Trage Arbeitsstunden oder manuelle Einnahmen ein.':'Das geschätzte Einkommen deckt die erfassten Ausgaben.'}</p>
    ${txOut>recOut+budgets?'<p class="hinweis">Du liegst über deinem geplanten Budget.</p>':''}
    </section>
    <details class="card dashboard-details"><summary>Arbeitszeit und Einkommen verbinden</summary><div><h2>Verbindung</h2><label class="check"><input id="budget-link" type="checkbox" ${S.prefs.budget_link?'checked':''}> Arbeitszeit und Haushaltsbuch verknüpfen</label>
    <label>Einkommen<select id="income-mode"><option value="manual" ${S.prefs.income_mode!=='automatic'?'selected':''}>Selbst in Groschen eintragen</option><option value="automatic" ${S.prefs.income_mode==='automatic'?'selected':''}>Shiftly-Netto automatisch übernehmen</option></select></label>
    <p class="hinweis">Automatische Werte ersetzen im Groschen-Plan die Gehaltsposition, lassen andere Einnahmen bestehen und ändern keine alten Buchungen.</p><button class="btn pri" id="budget-save">Speichern</button></div></details>`;
  $('#budget-save').onclick=async()=>{try{const d={budget_link:$('#budget-link').checked,income_mode:$('#income-mode').value,updated_at:new Date().toISOString()};await api('sz_preferences?on_conflict=user_id',{method:'POST',body:d,prefer:'resolution=merge-duplicates,return=minimal'});Object.assign(S.prefs,d);await syncIncome(ctx);$('#groschen-frame')?.contentWindow?.location.reload();renderBudget(ctx);toast('Verbindung gespeichert');}catch(err){toast(err.message);}};
  rememberDetails($('#budget-summary'),'groschen-verbindung');
 }catch(e){ if(S.ansicht==='budget' && $('#budget-summary'))$('#budget-summary').innerHTML=`<section class="card fehler">${safe(e.message)}<p>Das Haushaltsbuch darunter bleibt nutzbar.</p></section>`; }
}

export function renderPreferences(ctx) {
 const {S,api,toast}=ctx,p=S.prefs;
 $('#inhalt').innerHTML=`<section class="card"><button class="btn klein" id="back-more">‹ Menü</button><h1>Darstellung</h1><form id="prefs-form" class="raster">
 ${[['theme','Design',[['system','Automatisch'],['light','Hell'],['dark','Dunkel']]],['accent','Farbe',[['blau','Blau'],['gruen','Grün'],['violett','Violett'],['orange','Orange']]],['pattern','Hintergrund',[['none','Ohne'],['dots','Punkte'],['grid','Raster']]],['font','Schrift',[['system','Standard'],['serif','Serif'],['rounded','Rund']]]].map(([k,t,opts])=>`<label>${t}<select name="${k}">${opts.map(([v,n])=>`<option value="${v}" ${p[k]===v?'selected':''}>${n}</option>`).join('')}</select></label>`).join('')}
 <label class="check"><input name="sounds" type="checkbox" ${p.sounds?'checked':''}> Dezente Bestätigungstöne</label><button class="btn pri">Darstellung speichern</button></form></section>
 <section class="card"><h2>Konto ändern</h2><p class="hinweis">Angemeldet als ${safe(ctx.sitzung?.user?.email||'')}</p>
 <form id="email-form" class="reihe"><label>Neue E-Mail-Adresse<input name="email" type="email" required></label><button class="btn">E-Mail ändern</button></form>
 <form id="pw-form" class="reihe"><label>Neues Passwort<input name="password" type="password" minlength="8" required autocomplete="new-password"></label><button class="btn">Passwort ändern</button></form></section>
 <section class="card"><h2>Neu in dieser Version</h2><p>Bereiche lassen sich jetzt einzeln aufklappen. Deine Auswahl bleibt auf diesem Gerät erhalten.</p></section>`;
 $('#back-more').onclick=()=>$('#app-menu-open')?.click();
 $('#prefs-form').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));d.sounds=e.target.elements.sounds.checked;d.updated_at=new Date().toISOString();try{await api('sz_preferences?on_conflict=user_id',{method:'POST',body:d,prefer:'resolution=merge-duplicates,return=minimal'});Object.assign(S.prefs,d);for(const k of ['theme','accent','pattern','font'])document.documentElement.dataset[k]=d[k];toast('Darstellung gespeichert');}catch(err){toast(err.message);}};
 const update=async body=>{const token=await ctx.token();const res=await fetch(`${ctx.url}/auth/v1/user`,{method:'PUT',headers:{apikey:ctx.key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.msg||data.message||'Änderung fehlgeschlagen');return data;};
 $('#email-form').onsubmit=async e=>{e.preventDefault();try{await update({email:e.target.elements.email.value.trim()});toast('Bitte bestätige die neue Adresse über die E-Mail von Supabase.');e.target.reset();}catch(err){toast(err.message);}};
 $('#pw-form').onsubmit=async e=>{e.preventDefault();const pw=e.target.elements.password.value;if(!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(pw)){toast('Mindestens 8 Zeichen mit Buchstabe und Zahl.');return;}try{await update({password:pw});e.target.reset();toast('Passwort geändert');}catch(err){toast(err.message);}};
 foldCards($('#inhalt'), 'einstellungen', [{index:1,key:'zugang',label:'Konto und Passwort ändern'},{index:2,key:'neues',label:'Neu in dieser Version'}]);
}

export function renderFeedback(ctx) {
 $('#inhalt').innerHTML=`<section class="card"><button class="btn klein" id="back-more">‹ Menü</button><h1>Feedback senden</h1><p class="hinweis">Beschreibe deinen Vorschlag. Sende keine Passwörter oder vertraulichen Kundendaten.</p>
 <form id="feedback-form"><label>Deine Idee<textarea name="message" minlength="5" maxlength="2000" rows="6" required></textarea></label><button class="btn pri">Vorschlag senden</button></form></section>`;
 $('#back-more').onclick=()=>$('#app-menu-open')?.click();
 $('#feedback-form').onsubmit=async e=>{e.preventDefault();const message=e.target.elements.message.value.trim();try{await ctx.api('sz_feedback',{method:'POST',body:{message}});e.target.reset();ctx.toast('Danke, dein Vorschlag wurde gesendet.');}catch(err){ctx.toast(err.message);}};
}
