import { parsePlan, readDelimited, timeRange, legendMappings, resolveEntry, planSummary, isoDate, importOverlap } from './plan-import-core.js?v=1';
import { readPlanFile } from './plan-import-files.js?v=1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('de-DE',{maximumFractionDigits:2});
const tableText=rows=>rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join('\t')).join('\n');
let D=null;
function storage(ctx){return 'shiftly.import.codes.'+ctx.sitzung.user.id;}
function loadTemplates(ctx){try{return JSON.parse(localStorage.getItem(storage(ctx)))||{};}catch{return {};}}
export async function renderPlanImport(ctx){
  const user=ctx.sitzung.user.id;
  if(!D||D.user!==user)D={user,month:ctx.S.monat,template:'Mein Dienstplan',entries:[],warnings:[],mappings:{},sheets:[],sheet:0,name:'',file:null,ocr:false};
  const root=document.querySelector('#inhalt');
  root.innerHTML=`<section class="card"><h1>Dienstplan importieren</h1><p>Excel, PDF oder Foto auswählen, Namen und Kürzel prüfen und deine Einträge übernehmen.</p><p class="hinweis">Die Übersicht zeigt geplante Dienste. Prüfe Änderungen und tatsächlich geleistete Zeiten vor deiner Abrechnung. Die Datei und die Namen anderer Mitarbeiter werden nicht gespeichert oder hochgeladen. Zum Auslesen werden benötigte Bausteine aus dem Internet geladen.</p></section>
    <section class="card"><h2>1 · Deinen Plan auswählen</h2><div class="raster"><label>Monat des Plans<input id="pi-month" type="month" value="${esc(D.month)}" required></label><label>Vorlage / Arbeitgeber<input id="pi-template" maxlength="80" value="${esc(D.template)}" list="pi-templates"><datalist id="pi-templates">${Object.keys(loadTemplates(ctx)).map(n=>`<option value="${esc(n)}">`).join('')}</datalist><small>Kürzel werden für diese Vorlage getrennt gemerkt.</small></label><label>Dienstplan-Datei<input id="pi-file" type="file" accept=".xlsx,.xls,.ods,.csv,.tsv,.txt,.pdf,.jpg,.jpeg,.png,.webp,.bmp"></label></div><div class="reihe"><button class="btn pri" id="pi-read">Datei auslesen</button><button class="btn" id="pi-example">Mit Beispiel ausprobieren</button></div><p id="pi-status" role="status" aria-live="polite"></p><div id="pi-sheets"></div><details class="dashboard-details"><summary>Tabelle ansehen oder Text einfügen</summary><p class="hinweis">Du kannst eine Tabelle aus Excel einfügen. Möglich sind Name + Datumsspalten oder die Spalten Name, Datum, Kürzel, Beginn, Ende, Pause, Objekt.</p><textarea id="pi-text" rows="8" style="width:100%;font-family:monospace" aria-label="Erkannte Tabelle">${esc(D.text||'')}</textarea><button class="btn" id="pi-parse">Tabelle prüfen</button></details></section><div id="pi-preview"></div>`;
  const $=s=>root.querySelector(s);
  const alive=()=>root.isConnected&&ctx.S.ansicht==='import'&&D?.user===user;
  $('#pi-month').onchange=e=>{D.month=e.target.value;D.entries=[];$('#pi-preview').innerHTML='';$('#pi-status').textContent='Monat geändert. Bitte den Plan erneut auslesen oder die Tabelle prüfen.';};
  $('#pi-template').onchange=e=>{D.template=e.target.value.trim()||'Mein Dienstplan';D.mappings={...(ctx.S.profil.kuerzel||{}),...loadTemplates(ctx)[D.template]};preview();};
  $('#pi-file').onchange=e=>{D.file=e.target.files[0]||null;};
  const parse=()=>{
    if(!/^\d{4}-\d{2}$/.test(D.month))throw new Error('Bitte zuerst den Monat des Dienstplans auswählen.');
    const parsed=parsePlan(readDelimited($('#pi-text').value),D.month);
    D.text=$('#pi-text').value;D.entries=parsed.entries.map(e=>({...e,selected:true}));D.warnings=parsed.warnings;
    D.mappings={...(ctx.S.profil.kuerzel||{}),...legendMappings(readDelimited(D.text).map(r=>r.join(' ')).join('\n')),...loadTemplates(ctx)[D.template]};
    const names=[...new Set(D.entries.map(e=>e.name))];D.name=names.find(n=>n.toLowerCase()===ctx.S.profil.name?.trim().toLowerCase())||'';preview();
  };
  $('#pi-parse').onclick=()=>{try{D.ocr=false;parse();}catch(e){$('#pi-status').textContent=e.message;}};
  const sheets=()=>{
    $('#pi-sheets').innerHTML=D.sheets.length?`<label>Blatt / Seite<select id="pi-sheet">${D.sheets.map((s,i)=>`<option value="${i}" ${i===D.sheet?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>`:'';
    if($('#pi-sheet'))$('#pi-sheet').onchange=e=>{D.sheet=Number(e.target.value);$('#pi-text').value=tableText(D.sheets[D.sheet].rows);parse();};
  };
  $('#pi-read').onclick=async()=>{
    const button=$('#pi-read');button.disabled=true;$('#pi-preview').innerHTML='';D.entries=[];
    try{const result=await readPlanFile(D.file,D.month,message=>{if(alive())$('#pi-status').textContent=message;});if(!alive())return;
      D.sheets=result.sheets;D.sheet=0;D.ocr=result.ocr;$('#pi-text').value=tableText(D.sheets[0]?.rows||[]);sheets();parse();$('#pi-status').textContent=D.ocr?'Ausgelesen. Bitte besonders Namen, Datumsspalten und leere Tage kontrollieren.':'Ausgelesen. Bitte die Vorschau prüfen.';
    }catch(e){if(alive())$('#pi-status').textContent=e.message;}finally{if(alive())button.disabled=false;}
  };
  $('#pi-example').onclick=()=>{D.ocr=false;D.file=null;D.sheets=[];sheets();const own=ctx.S.profil.name||'Mein Name';$('#pi-text').value=`Name;5;6;7;10;11\n${own};06:00–18:00;18:00–06:00;FREI;FRÜH;\nBeispiel Mitarbeiter;FRÜH;;06:00–14:00;FREI;18:00–06:00\n\nFRÜH = 06:00–14:00\nFREI = Frei`;parse();$('#pi-status').textContent='Beispieldaten geladen. Noch nichts gespeichert.';};
  sheets();if(D.entries.length)preview();
  function preview(){
    const box=$('#pi-preview');if(!box)return;
    const names=[...new Set(D.entries.map(e=>e.name))],codes=[...new Set(D.entries.map(e=>e.code))].filter(c=>!timeRange(c));
    box.innerHTML=`${D.warnings.length?`<section class="card"><h2>Bitte kontrollieren</h2><ul>${D.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></section>`:''}${!D.entries.length?'<section class="card"><p>Noch keine Einträge erkannt. Prüfe die Tabelle oder probiere das Beispiel.</p></section>':`<section class="card"><h2>2 · Kürzel zuordnen</h2><p class="hinweis">Unbekannte Kürzel haben keine angenommene Bedeutung. Zeiten und Pausen hier prüfen. Die Zuordnung gilt nur für „${esc(D.template)}“.</p><div class="pi-scroll"><table><thead><tr><th>Kürzel</th><th>Bedeutung</th><th>Beginn</th><th>Ende</th><th>Pause (Min.)</th><th></th></tr></thead><tbody>${codes.map((c,i)=>{const m=D.mappings[c]||{};return `<tr data-code-index="${i}"><th>${esc(c)}</th><td><select data-map="art" aria-label="Bedeutung ${esc(c)}"><option value="">Bitte auswählen</option>${[['dienst','Dienst'],['urlaub','Urlaub'],['krank','Krank'],['frei','Frei']].map(([v,t])=>`<option value="${v}" ${m.art===v?'selected':''}>${t}</option>`).join('')}</select></td><td><input data-map="beginn" type="time" value="${esc(m.beginn||'')}" aria-label="Beginn ${esc(c)}"></td><td><input data-map="ende" type="time" value="${esc(m.ende||'')}" aria-label="Ende ${esc(c)}"></td><td><input data-map="pause" type="number" min="0" max="600" value="${Number(m.pause)||0}" aria-label="Pause ${esc(c)}"></td><td><button type="button" class="btn klein" data-delete-map="${i}">Zuordnung löschen</button></td></tr>`;}).join('')}</tbody></table></div><button id="pi-save-codes" class="btn">Zuordnung für diese Vorlage merken</button><p id="pi-codes-status" role="status"></p></section>
    <section class="card"><h2>3 · Geplante Stunden nach Namen</h2><div id="pi-summary" class="pi-scroll"></div><p class="hinweis">Gezählt werden Dienststunden mit zugeordneten Zeiten und Pausen, inklusive Zeitumstellung. Frei zählt nur bei ausdrücklich als frei zugeordneten Einträgen. Leere Zellen sind keine bestätigten freien Tage.</p></section>
    <section class="card"><h2>4 · Deine Einträge prüfen</h2><div class="raster"><label>Welcher Name gehört zu dir?<select id="pi-name"><option value="">Namen auswählen</option>${names.map(n=>`<option ${D.name===n?'selected':''}>${esc(n)}</option>`).join('')}</select></label><label>Objekt für Einträge ohne Objektangabe<select id="pi-object"><option value="">${esc(ctx.S.profil.objekt||'Hauptobjekt / Standardtarif')}</option>${ctx.S.objekte.filter(o=>o.aktiv).map(o=>`<option value="${o.id}" ${(D.objectId??ctx.S.form.object_id)===o.id?'selected':''}>${esc(o.name)}</option>`).join('')}</select></label></div><p class="hinweis">Nur der ausgewählte Name wird übernommen. Objektangaben aus dem Plan haben Vorrang und müssen einem deiner Objekte entsprechen. Urlaubsfreie Wochentage und Feiertage werden ausgelassen.</p><div id="pi-rows" class="pi-scroll"></div><label class="check"><input id="pi-reviewed" type="checkbox"> Ich habe Namen, Datum, Zeiten, Kürzel und Objekt in der Vorschau geprüft.</label><button class="btn pri" id="pi-import">Ausgewählte Einträge in meinen Kalender übernehmen</button><p id="pi-result" role="status" aria-live="polite"></p></section>`}`;
    if(!D.entries.length)return;
    box.querySelectorAll('[data-code-index]').forEach(tr=>tr.querySelectorAll('[data-map]').forEach(input=>input.onchange=()=>{
      const code=codes[Number(tr.dataset.codeIndex)],m={};tr.querySelectorAll('[data-map]').forEach(f=>m[f.dataset.map]=f.dataset.map==='pause'?Number(f.value):f.value);D.mappings[code]=m;update();
    }));
    box.querySelectorAll('[data-delete-map]').forEach(button=>button.onclick=()=>{
      const code=codes[Number(button.dataset.deleteMap)];D.mappings[code]={};
      try {const saved=loadTemplates(ctx);saved[D.template]={...saved[D.template],[code]:{}};localStorage.setItem(storage(ctx),JSON.stringify(saved));preview();$('#pi-codes-status').textContent='Zuordnung gelöscht. Das Kürzel bleibt im eingelesenen Plan als unklar markiert.';}
      catch {preview();$('#pi-codes-status').textContent='Zuordnung für diese Vorschau gelöscht. Gerätespeicher nicht verfügbar.';}
    });
    $('#pi-save-codes').onclick=()=>{try{const saved=loadTemplates(ctx);saved[D.template]=D.mappings;localStorage.setItem(storage(ctx),JSON.stringify(saved));$('#pi-codes-status').textContent='Zuordnung gemerkt.';}catch{$('#pi-codes-status').textContent='Zuordnung konnte auf diesem Gerät nicht gespeichert werden.';}};
    $('#pi-name').onchange=e=>{D.name=e.target.value;update();};
    $('#pi-object').onchange=e=>{D.objectId=e.target.value||null;update();};
    $('#pi-import').onclick=save;
    update();
  }
  function rowResult(row){
    if(!isoDate(row.datum,D.month))return {error:'Datum ungültig'};
    const objectText=(row.object||'').trim();let id=D.objectId===undefined?ctx.S.form.object_id:D.objectId;
    if(objectText){const object=ctx.S.objekte.find(o=>o.name.toLocaleLowerCase('de')===objectText.toLocaleLowerCase('de'));if(!object&&objectText!==ctx.S.profil.objekt)return {error:'Objekt unbekannt – Objektangabe korrigieren'};id=object?.id||null;}
    const r=resolveEntry(row,D.mappings,ctx.S.profil);if(!r.shift)return r;
    if(r.shift.art==='dienst'){const assignment=ctx.objektZuordnung(id,row.datum);if(assignment.error)return {error:assignment.error};Object.assign(r.shift,assignment);}
    else Object.assign(r.shift,{object_id:null,rate_snapshot:null});
    return r;
  }
  function update(){
    if(!$('#pi-summary'))return;
    if($('#pi-reviewed'))$('#pi-reviewed').checked=false;
    const summary=planSummary(D.entries,D.mappings,ctx.S.profil);
    $('#pi-summary').innerHTML=`<table><thead><tr><th>Name</th><th>Dienststunden</th><th>Arbeitstage</th><th>Samstage</th><th>Sonntage</th><th>Frei</th><th>Unklar</th></tr></thead><tbody>${summary.map(s=>`<tr><th>${esc(s.name)}</th><td>${fmt(s.hours)}</td><td>${s.workdays}</td><td>${s.saturdays}</td><td>${s.sundays}</td><td>${s.free}</td><td>${s.unknown}</td></tr>`).join('')}</tbody></table>`;
    const chosen=D.entries.map((e,i)=>({e,i})).filter(({e})=>e.name===D.name);
    $('#pi-rows').innerHTML=chosen.length?`<table><thead><tr><th>Übernehmen</th><th>Datum</th><th>Kürzel / Zeit</th><th>Pause</th><th>Objektangabe</th><th>Prüfung</th></tr></thead><tbody>${chosen.map(({e,i})=>{const r=rowResult(e);return `<tr data-entry="${i}"><td><input type="checkbox" data-row="selected" ${e.selected?'checked':''} aria-label="Eintrag ${i+1} übernehmen"></td><td><input type="date" data-row="datum" value="${esc(e.datum)}" aria-label="Datum"></td><td><input data-row="code" value="${esc(e.code)}" maxlength="80" aria-label="Kürzel oder Zeit"></td><td><input type="number" data-row="pause" min="0" max="600" value="${esc(e.pause??D.mappings[e.code]?.pause??0)}" aria-label="Pause in Minuten"></td><td><input data-row="object" value="${esc(e.object)}" maxlength="80" aria-label="Objektangabe"></td><td>${esc(r.error||r.reason||(r.shift?.art==='dienst'?fmt(r.hours)+' Std.':r.shift?.art||''))}</td></tr>`;}).join('')}</tbody></table>`:'<p>Wähle deinen Namen, um die Einträge zu prüfen.</p>';
    $('#pi-rows').querySelectorAll('[data-row]').forEach(input=>input.onchange=()=>{const row=D.entries[Number(input.closest('[data-entry]').dataset.entry)];row[input.dataset.row]=input.dataset.row==='selected'?input.checked:input.value;if(input.dataset.row==='code')preview();else update();});
  }
  async function save(){
    const result=$('#pi-result'),button=$('#pi-import');
    if(!ctx.S.zugang?.access){result.textContent='Dein Zugang erlaubt derzeit keine neuen Einträge.';return;}
    if(!D.name||!$('#pi-reviewed').checked){result.textContent='Bitte deinen Namen auswählen und die Prüfung der Vorschau bestätigen.';return;}
    const rows=D.entries.filter(e=>e.name===D.name&&e.selected),resolved=rows.map(rowResult);
    if(resolved.some(r=>r.error)){result.textContent='Einige ausgewählte Einträge sind unklar. Bitte korrigieren oder abwählen.';return;}
    let shifts=resolved.flatMap(r=>r.shift?[r.shift]:[]);
    if(!shifts.length){result.textContent='Keine übernehmbaren Einträge ausgewählt.';return;}
    if(shifts.length>366){result.textContent='Bitte höchstens 366 Einträge auf einmal übernehmen.';return;}
    button.disabled=true;
    try {
      const from=shifts.map(s=>s.datum).sort()[0],to=shifts.map(s=>s.datum).sort().at(-1);
      const start=new Date(Date.parse(from+'T00:00:00Z')-86400000).toISOString().slice(0,10),end=new Date(Date.parse(to+'T00:00:00Z')+86400000).toISOString().slice(0,10);
      const existing=await ctx.api(`sz_shifts?select=*&datum=gte.${start}&datum=lte.${end}`);
      const fingerprint=s=>[s.datum,s.art,s.beginn?.slice(0,5)||'',s.ende?.slice(0,5)||'',Number(s.pause_min)||0,s.object_id||''].join('|');
      const seen=new Set(existing.map(fingerprint));let skipped=resolved.filter(r=>r.skip).length;
      shifts=shifts.filter(s=>{const key=fingerprint(s);if(seen.has(key)){skipped++;return false;}seen.add(key);return true;});
      if(!shifts.length){result.textContent=`Nichts doppelt gespeichert. ${skipped} bereits vorhandene oder nicht anrechenbare Einträge ausgelassen.`;return;}
      const conflict=await ctx.pruefeUrlaubUeberschneidung(shifts);if(conflict)throw new Error(conflict);
      for(let i=0;i<shifts.length;i++)for(let j=i+1;j<shifts.length;j++)if((shifts[i].art==='urlaub'||shifts[j].art==='urlaub')&&importOverlap(shifts[i],shifts[j]))throw new Error('Im Import überschneiden sich Urlaub und ein weiterer Eintrag. Bitte die Vorschau korrigieren.');
      const overlaps=shifts.filter((s,i)=>existing.some(e=>e.datum===s.datum||importOverlap(s,e))||shifts.slice(0,i).some(e=>e.datum===s.datum||importOverlap(s,e)));
      if(overlaps.length&&!confirm(`${overlaps.length} Einträge liegen am selben Tag oder überschneiden sich mit anderen Diensten. Als zusätzliche Schichten übernehmen?`)){result.textContent='Übernahme abgebrochen. Es wurde nichts gespeichert.';return;}
      await ctx.api('sz_shifts',{method:'POST',body:shifts.map(s=>({...s,notiz:'Dienstplan-Import · vor Übernahme geprüft'})),prefer:'return=minimal'});
      const vacations=shifts.filter(s=>s.art==='urlaub').map(s=>s.datum);
      const importedRows=new Set(rows);D.entries=D.entries.filter(e=>!importedRows.has(e));ctx.S.jahr=null;ctx.S.urlaubInfo=null;ctx.S.monat=from.slice(0,7);await ctx.ladeMonat();
      if(alive()){update();result.textContent=`${shifts.length} Einträge übernommen. ${skipped} doppelte oder nicht anrechenbare Einträge ausgelassen.`;$('#pi-reviewed').checked=false;}
      ctx.toast(`${shifts.length} Einträge übernommen`);
      if(vacations.length){ctx.S.ansicht='zettel';await ctx.render();ctx.scheduleVacationRequest(vacations,100);}
    }catch(e){if(alive())result.textContent=e.message;}finally{if(alive())button.disabled=false;}
  }
}
