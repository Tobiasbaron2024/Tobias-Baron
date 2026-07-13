"use strict";
const Core=window.TimeSheetCore;
const STORAGE_SHIFTS="stundenzettel_sicherheit_shifts_v2";
const STORAGE_SETTINGS="stundenzettel_sicherheit_settings_v2";
const DEFAULT_SETTINGS={autoTariff:true,baseRate:15.14,objectBonus:0.88,nightPct:15,saturdayPct:0,sundayPct:50,holidayPct:100,overtimePct:25,overtimeLimit:228,bonusInPremiumBase:false};
let shifts=readJson(STORAGE_SHIFTS,[]);
let settings={...DEFAULT_SETTINGS,...readJson(STORAGE_SETTINGS,{})};
let editingId=null;
let toastTimer=null;
const $=id=>document.getElementById(id);
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function saveLocal(){localStorage.setItem(STORAGE_SHIFTS,JSON.stringify(shifts));localStorage.setItem(STORAGE_SETTINGS,JSON.stringify(settings))}
function pad(n){return String(n).padStart(2,"0")}
function todayKey(){const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function currentMonth(){return todayKey().slice(0,7)}
function formatMoney(n){return (Number(n)||0).toLocaleString("de-DE",{style:"currency",currency:"EUR"})}
function formatHours(n){return (Number(n)||0).toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})+" Std."}
function formatDate(key){if(!key)return"";const [y,m,d]=key.split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"})}
function escapeHtml(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}
function showToast(text){const el=$("toast");el.textContent=text;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2300)}
function draftFromForm(){return {id:editingId||undefined,date:$("shiftDate").value,start:$("shiftStart").value,end:$("shiftEnd").value,pauseStart:$("pauseStart").value,pauseEnd:$("pauseEnd").value,note:$("shiftNote").value.trim()}}
function fillForm(s){$("shiftDate").value=s.date||todayKey();$("shiftStart").value=s.start||"";$("shiftEnd").value=s.end||"";$("pauseStart").value=s.pauseStart||"";$("pauseEnd").value=s.pauseEnd||"";$("shiftNote").value=s.note||"";liveCalculate()}
function resetForm(){editingId=null;$("entryTitle").textContent="Neue Schicht";$("saveShift").textContent="Schicht speichern";$("cancelEdit").classList.add("hidden");fillForm({date:todayKey()})}
function liveCalculate(){
const draft=draftFromForm();
const previous=Core.previousHoursForShift(shifts,draft,settings,editingId);
const calc=Core.calculateShift(draft,settings,previous);
renderCalc(calc);
const warnings=calc.warnings||[];
if(warnings.length){$("warningBox").textContent=warnings.join(" ");$("warningBox").classList.remove("hidden")}else{$("warningBox").classList.add("hidden")}
$("saveShift").disabled=!calc.valid;
return calc;
}
function renderCalc(c){
const map={livePaid:c.paidHours,liveNight:c.nightHours,liveSaturday:c.saturdayHours,liveSunday:c.sundayHours,liveHoliday:c.holidayHours,liveOvertime:c.overtimeHours};
Object.entries(map).forEach(([id,v])=>$(id).textContent=formatHours(v));
const moneyMap={liveTotal:c.totalPay,liveBasePay:c.basePay,liveNightPay:c.nightPay,liveSaturdayPay:c.saturdayPay,liveSundayPay:c.sundayPay,liveHolidayPay:c.holidayPay,liveOvertimePay:c.overtimePay};
Object.entries(moneyMap).forEach(([id,v])=>$(id).textContent=formatMoney(v));
$("rateInfo").textContent=c.valid?`Grundlohn ${formatMoney(c.baseRate)} · mit Objektzulage ${formatMoney(c.regularRate)} pro Stunde · Zuschlagsbasis ${formatMoney(c.premiumRate)}`:"Noch keine vollständige Zeit eingegeben.";
}
function saveShift(){
const draft=draftFromForm();
const calc=liveCalculate();
if(!calc.valid){showToast("Bitte Datum, Beginn und Ende eintragen.");return}
if(calc.warnings.length && !confirm(calc.warnings.join("\n")+"\n\nTrotzdem speichern?")) return;
if(editingId){
const idx=shifts.findIndex(s=>s.id===editingId);
if(idx>=0) shifts[idx]={...draft,id:editingId};
showToast("Schicht aktualisiert.");
}else{
shifts.push({...draft,id:(crypto.randomUUID?crypto.randomUUID():String(Date.now()))});
showToast("Schicht gespeichert.");
}
shifts.sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));saveLocal();
const month=draft.date.slice(0,7);$("monthPicker").value=month;resetForm();renderAll();
}
function editShift(id){const s=shifts.find(x=>x.id===id);if(!s)return;editingId=id;$("entryTitle").textContent="Schicht bearbeiten";$("saveShift").textContent="Änderungen speichern";$("cancelEdit").classList.remove("hidden");fillForm(s);switchTab("entry");window.scrollTo({top:0,behavior:"smooth"})}
function duplicateShift(id){const s=shifts.find(x=>x.id===id);if(!s)return;editingId=null;$("entryTitle").textContent="Schicht duplizieren";$("saveShift").textContent="Kopie speichern";$("cancelEdit").classList.remove("hidden");fillForm({...s,id:undefined,note:s.note?`${s.note} (Kopie)`:""});switchTab("entry");window.scrollTo({top:0,behavior:"smooth"})}
function deleteShift(id){const s=shifts.find(x=>x.id===id);if(!s)return;if(!confirm(`Schicht am ${formatDate(s.date)} wirklich löschen?`))return;shifts=shifts.filter(x=>x.id!==id);saveLocal();renderAll();showToast("Schicht gelöscht.")}
function selectedEntryMonth(){return ($("shiftDate").value||todayKey()).slice(0,7)}
function renderShiftList(){
const month=selectedEntryMonth();
const data=Core.calculateMonth(shifts,month,settings);
const [y,m]=month.split("-").map(Number);$("entryMonthLabel").textContent=new Date(y,m-1,1).toLocaleDateString("de-DE",{month:"long",year:"numeric"});
if(!data.items.length){$("shiftList").innerHTML='<div class="empty">Für diesen Monat sind noch keine Schichten gespeichert.</div>';return}
$("shiftList").innerHTML=data.items.slice().reverse().map(({shift,calc})=>`
<article class="shift-card">
<div class="shift-card-top">
<div><div class="shift-date">${escapeHtml(formatDate(shift.date))} · ${escapeHtml(shift.start)}–${escapeHtml(shift.end)}</div><div class="shift-note">${escapeHtml(shift.note||"Ohne Notiz")}${shift.pauseStart&&shift.pauseEnd?` · Pause ${escapeHtml(shift.pauseStart)}–${escapeHtml(shift.pauseEnd)}`:""}</div></div>
<div class="shift-gross">${formatMoney(calc.totalPay)}</div>
</div>
<div class="chips"><span class="chip">${formatHours(calc.paidHours)}</span>${calc.nightHours?`<span class="chip">Nacht ${formatHours(calc.nightHours)}</span>`:""}${calc.saturdayHours?`<span class="chip">Samstag ${formatHours(calc.saturdayHours)}</span>`:""}${calc.sundayHours?`<span class="chip">Sonntag ${formatHours(calc.sundayHours)}</span>`:""}${calc.holidayHours?`<span class="chip">Feiertag ${formatHours(calc.holidayHours)}</span>`:""}${calc.overtimeHours?`<span class="chip">Mehrarbeit ${formatHours(calc.overtimeHours)}</span>`:""}</div>
<div class="shift-actions"><button data-action="edit" data-id="${shift.id}">Bearbeiten</button><button data-action="duplicate" data-id="${shift.id}">Duplizieren</button><button class="delete" data-action="delete" data-id="${shift.id}">Löschen</button></div>
</article>`).join("");
}
function renderMonth(){
const month=$("monthPicker").value||currentMonth();
const {totals}=Core.calculateMonth(shifts,month,settings);
const values={monthPaid:totals.paidHours,monthNight:totals.nightHours,monthSaturday:totals.saturdayHours,monthSunday:totals.sundayHours,monthHoliday:totals.holidayHours,monthOvertime:totals.overtimeHours};
Object.entries(values).forEach(([id,v])=>$(id).textContent=formatHours(v));
const money={monthGross:totals.totalPay,monthBasePay:totals.basePay,monthNightPay:totals.nightPay,monthSaturdayPay:totals.saturdayPay,monthSundayPay:totals.sundayPay,monthHolidayPay:totals.holidayPay,monthOvertimePay:totals.overtimePay};
Object.entries(money).forEach(([id,v])=>$(id).textContent=formatMoney(v));
const [y,m]=month.split("-").map(Number);$("headerSubline").textContent=`${new Date(y,m-1,1).toLocaleDateString("de-DE",{month:"long",year:"numeric"})} · ${formatHours(totals.paidHours)} · ${formatMoney(totals.totalPay)}`;
}
function loadSettingsForm(){Object.keys(DEFAULT_SETTINGS).forEach(k=>{const el=$(k);if(!el)return;if(el.type==="checkbox")el.checked=Boolean(settings[k]);else el.value=settings[k]})}
function saveSettingsFromForm(){
const next={};Object.keys(DEFAULT_SETTINGS).forEach(k=>{const el=$(k);if(!el)return;next[k]=el.type==="checkbox"?el.checked:Number(el.value)});settings={...settings,...next};saveLocal();renderAll();showToast("Einstellungen gespeichert.")
}
function renderAll(){liveCalculate();renderShiftList();renderMonth()}
function switchTab(name){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("active",p.id===`tab-${name}`));if(name==="month")renderMonth()}
function monthShareText(){
const month=$("monthPicker").value||currentMonth();const {totals}=Core.calculateMonth(shifts,month,settings);const [y,m]=month.split("-").map(Number);const label=new Date(y,m-1,1).toLocaleDateString("de-DE",{month:"long",year:"numeric"});
return `Stundenzettel ${label}\nArbeitszeit: ${formatHours(totals.paidHours)}\nNacht: ${formatHours(totals.nightHours)}\nSamstag: ${formatHours(totals.saturdayHours)}\nSonntag: ${formatHours(totals.sundayHours)}\nFeiertag: ${formatHours(totals.holidayHours)}\nMehrarbeit: ${formatHours(totals.overtimeHours)}\nBrutto gesamt: ${formatMoney(totals.totalPay)}`;
}
async function shareMonth(){const text=monthShareText();if(navigator.share){try{await navigator.share({title:"Stundenzettel",text});return}catch(e){if(e.name==="AbortError")return}}await navigator.clipboard.writeText(text);showToast("Monatsübersicht kopiert.")}
function exportBackup(){const blob=new Blob([JSON.stringify({version:2,createdAt:new Date().toISOString(),settings,shifts},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`stundenzettel-sicherung-${todayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function importBackup(file){const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!Array.isArray(data.shifts))throw new Error();shifts=data.shifts;settings={...DEFAULT_SETTINGS,...(data.settings||{})};saveLocal();loadSettingsForm();resetForm();renderAll();showToast("Sicherung geladen.")}catch{alert("Die Sicherungsdatei konnte nicht gelesen werden.")}};reader.readAsText(file)}
function bind(){
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
["shiftDate","shiftStart","shiftEnd","pauseStart","pauseEnd","shiftNote"].forEach(id=>$(id).addEventListener("input",()=>{liveCalculate();if(id==="shiftDate")renderShiftList()}));
$("saveShift").addEventListener("click",saveShift);$("resetEntry").addEventListener("click",resetForm);$("cancelEdit").addEventListener("click",resetForm);
$("shiftList").addEventListener("click",e=>{const b=e.target.closest("button[data-action]");if(!b)return;const {action,id}=b.dataset;if(action==="edit")editShift(id);if(action==="duplicate")duplicateShift(id);if(action==="delete")deleteShift(id)});
$("monthPicker").addEventListener("input",renderMonth);$("saveSettings").addEventListener("click",saveSettingsFromForm);$("printMonth").addEventListener("click",()=>window.print());$("shareMonth").addEventListener("click",shareMonth);
$("exportBackup").addEventListener("click",exportBackup);$("importBackup").addEventListener("click",()=>$("backupFile").click());$("backupFile").addEventListener("change",e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value=""});
$("deleteAll").addEventListener("click",()=>{if(confirm("Wirklich alle gespeicherten Schichten löschen?")){shifts=[];saveLocal();resetForm();renderAll();showToast("Alle Schichten gelöscht.")}});
$("dismissInstall").addEventListener("click",()=>{$("installCard").classList.add("hidden");localStorage.setItem("install_hint_hidden","1")});
}
function setupInstallHint(){const standalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;if(!standalone&&!localStorage.getItem("install_hint_hidden"))$("installCard").classList.remove("hidden")}
function setupServiceWorker(){if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}))}
$("shiftDate").value=todayKey();$("monthPicker").value=currentMonth();loadSettingsForm();bind();setupInstallHint();setupServiceWorker();resetForm();renderAll();