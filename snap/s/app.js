import { renderPlanImport } from './plan-import.js?v=2';
import { objectRates } from './object-rates.js?v=1';
import { initScenes } from './scenes.js?v=1';
import { renderQuickBudget, renderWeather, loadWeather, currentLocation, invalidateWeather } from './dashboard.js?v=7';
import { showDailyGreeting, updateGreetingWeather } from './day-greeting.js?v=2';
import { arrangeDashboard } from './dashboard-order.js?v=3';
import { REGIONEN, TARIF_STAND, feiertage, feiertagName, ruhetag, urlaubArbeitstag, minuten, berechne, summe, tagKey, TARIF_FEIERTAGE_TEXT, mehrarbeitRegel, tarifFeiertag, zeitumstellungen } from './calc.js?v=10';
import { bauePdf } from './pdf.js?v=4';
import { netto2026, freieZuschlaege } from './lohn2026.js?v=1';
import { renderUrlaub, antragAusKalender, urlaubstageImJahr, urlaubVerbrauch, kalenderUrlaubPruefen } from './urlaub.js?v=15';
import * as VK from './verkauf.js?v=4';
import { renderBudget, renderWishes, renderObjects, renderPreferences, renderFeedback, syncIncome } from './features.js?v=19';
import { foldCards, openFold, rememberDetails } from './fold.js?v=2';

initScenes();

const URL_ = 'https://qoluhdfpchotpftvnswy.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvbHVoZGZwY2hvdHBmdHZuc3d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMjcwNDcsImV4cCI6MjEwNTkwMzA0N30.hSX-s9HZDuDb8tFFxDY0iiTzQV1tuDGPUy1-FVtUsLI';
const SKEY = 'sz-auth';
const INHABER_MAIL = 'baron@groschen-haushaltsbuch.netlify.app';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fh = (x) => (x || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fe = (x) => (x || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const fz = (x) => (x ? fh(x) : '–');
const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const ART = { dienst: 'Dienst', urlaub: 'Urlaub', krank: 'Krank', frei: 'Frei' };
const datumDE = (iso) => iso.split('-').reverse().join('.');
const wtag = (iso) => WT[new Date(iso + 'T00:00:00Z').getUTCDay()];
const heuteISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const hm = (t) => (t ? String(t).slice(0, 5) : '');
const pad = (n) => String(n).padStart(2, '0');
function zeitraum(sh) {
  if (sh.art !== 'dienst' || !sh.beginn || !sh.ende) return null;
  const a = Date.parse(sh.datum + 'T00:00:00Z') + minuten(sh.beginn) * 60000;
  let e = Date.parse(sh.datum + 'T00:00:00Z') + minuten(sh.ende) * 60000;
  if (e <= a) e += 86400000;
  return [a, e];
}
function ueberschneidet(sh, andere) {
  const a = zeitraum(sh), b = zeitraum(andere);
  return a && b && a[0] < b[1] && b[0] < a[1];
}

function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 3600);
  if(S?.prefs?.sounds && /gespeichert|gesendet|geändert/i.test(t)) try { const a=new (window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();o.type='sine';o.frequency.value=660;g.gain.value=.018;o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.08);o.onended=()=>a.close(); } catch {} }

/* ---------------- Anmeldung ---------------- */
let sitzung = null;
try { sitzung = JSON.parse(localStorage.getItem(SKEY)); } catch { sitzung = null; }
const speichereSitzung = (s) => { sitzung = s; try { if (s) localStorage.setItem(SKEY, JSON.stringify(s)); else { localStorage.removeItem(SKEY); localStorage.removeItem('groschen.session'); } } catch { /* egal */ } };

async function authCall(pfad, body) {
  const r = await fetch(`${URL_}/auth/v1/${pfad}`, { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const error = new Error(j.error_description || j.msg || j.message || 'Anmeldung fehlgeschlagen'); error.status = r.status; throw error; }
  return j;
}
const ausToken = (j) => ({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600), user: { id: j.user?.id, email: j.user?.email } });

async function token() {
  try { sitzung = JSON.parse(localStorage.getItem(SKEY)); } catch { /* vorhandene Sitzung verwenden */ }
  if (!sitzung) return null;
  if (sitzung.expires_at - 60 < Date.now() / 1000) {
    try { speichereSitzung(ausToken(await authCall('token?grant_type=refresh_token', { refresh_token: sitzung.refresh_token }))); }
    catch (e) { if (e.status === 400 || e.status === 401) { speichereSitzung(null); location.reload(); return null; } throw e; }
  }
  return sitzung.access_token;
}
window.addEventListener('storage', (e) => {
  if (e.key === SKEY && !e.newValue) { sitzung = null; location.reload(); }
});
// Der Aktionsbereich nutzt dieselbe Sitzung und dieselbe Erneuerung wie Shiftly.
window.shiftlyAuth = { getToken: token };

const pendingWrites = new Set();
async function api(pfad, { method = 'GET', body, prefer } = {}) {
  const t = await token();
  const h = { apikey: KEY, Authorization: `Bearer ${t || KEY}`, 'content-type': 'application/json' };
  if (prefer) h.Prefer = prefer;
  const request = fetch(`${URL_}/rest/v1/${pfad}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  if(method!=='GET')pendingWrites.add(request);
  const r = await request.finally(()=>pendingWrites.delete(request));
  const txt = await r.text();
  let j = null; try { j = txt ? JSON.parse(txt) : null; } catch { j = txt; }
  if (!r.ok) {
    let m = (j && (j.message || j.hint)) || `Fehler ${r.status}`;
    if (/row-level security/i.test(m)) m = 'Speichern nicht möglich: Dein Testzeitraum ist abgelaufen. Bitte schließe ein Abo ab.';
    throw new Error(m);
  }
  return j;
}
const rpc = (fn, args = {}) => api(`rpc/${fn}`, { method: 'POST', body: args });

async function pruefeUrlaubUeberschneidung(kandidaten, eigeneId = null) {
  const daten = kandidaten.map(k=>k.datum).sort();
  const von = tagKey(Date.parse(daten[0]+'T00:00:00Z')-86400000);
  const bis = tagKey(Date.parse(daten[daten.length-1]+'T00:00:00Z')+86400000);
  const [schichten, urlaube] = await Promise.all([
    api(`sz_shifts?select=id,datum,art,beginn,ende&datum=gte.${von}&datum=lte.${bis}`),
    api(`sz_vacations?select=id,start_date,end_date,status&start_date=lte.${bis}&end_date=gte.${von}`)
  ]);
  return kalenderUrlaubPruefen(kandidaten,schichten.filter(s=>s.id !== eigeneId),urlaube,S.profil.region,S.profil.vacation_weekdays?.map(Number)||[1,2,3,4,5]);
}

/* ---------------- Zustand ---------------- */
const S = { ansicht: 'start', monat: heuteISO().slice(0, 7), profil: null, zugang: null, schichten: [], objekte: [], wuensche: [], prefs: {}, bearbeite: null, stempel: null, form: { art: 'dienst', kuerzel: null, object_id: null, datum: heuteISO(), bis: '', beginn: '06:00', ende: '18:00', pause: 0, mehr: false, wt: [1, 1, 1, 1, 1, 1, 1] }, preise: [], statistik: null, feiertagJahr: new Date().getFullYear() };

async function mailFn(body, mitLogin = false) {
  const t = mitLogin ? await token() : null;
  const r = await fetch(`${URL_}/functions/v1/sz-mail`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${t || KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Fehler ${r.status}`);
  return j;
}
async function abmeldenAusLink() {
  const q = new URLSearchParams(location.search);
  const ab = q.get('abmelden'), be = q.get('bestaetigen');
  if (!ab && !be) return false;
  history.replaceState(null, '', location.pathname);
  let ok = false;
  try { ok = (await mailFn(be ? { aktion: 'bestaetigen', token: be } : { aktion: 'abmelden_link', token: ab })).ok === true; } catch { ok = false; }
  const [titel, text] = be
    ? (ok ? ['Anmeldung bestätigt', 'Danke! Ab jetzt bekommst du Angebote und Neuigkeiten zu Shiftly und neuen Apps. Abmelden geht jederzeit über den Link in jeder E-Mail.'] : ['Link ungültig', 'Dieser Bestätigungslink ist ungültig oder älter als 30 Tage. Du kannst die Neuigkeiten in der App unter „Konto &amp; Tarif“ neu anfordern.'])
    : (ok ? ['Abgemeldet', 'Du bekommst keine Werbe-E-Mails mehr von Shiftly. Dein Konto bleibt unverändert.'] : ['Link ungültig', 'Dieser Abmeldelink ist ungültig. Du kannst dich jederzeit in der App unter „Konto &amp; Tarif“ abmelden.']);
  $('#app').innerHTML = `<div class="login"><div class="card"><h1 style="margin-top:0">${titel}</h1><p>${text}</p><button class="btn pri" onclick="location.href=location.pathname">Zu Shiftly</button></div></div>`;
  return true;
}
async function start() {
  if (await abmeldenAusLink()) return;
  if (!sitzung) return zeigeLogin();
  try {
    S.zugang = await rpc('sz_ensure_access');
    const p = await api('sz_profile?select=*');
    S.profil = p[0];
    await Promise.all([ladePreise(), ladeExtras()]);
    await ladeMonat();
    render();
    zeigeNeuerungen();
  } catch (e) {
    if (!sitzung) { zeigeLogin(e.message); return; }
    $('#app').innerHTML = `<div class="login"><section class="card"><h1>Verbindung unterbrochen</h1><p>Deine Anmeldung bleibt erhalten. Versuche es gleich noch einmal.</p><p class="fehler">${esc(e.message)}</p><div class="reihe"><button class="btn pri" id="start-retry">Erneut versuchen</button><button class="btn" id="start-logout">Abmelden</button></div></section></div>`;
    $('#start-retry').onclick = () => start();
    $('#start-logout').onclick = () => { speichereSitzung(null); zeigeLogin(); };
  }
}

async function ladePreise() { try { S.preise = await api('sz_preisliste?select=*&order=sortierung'); } catch { S.preise = []; } }
async function ladeExtras(strict = false) {
  const read = path => strict ? api(path) : api(path).catch(() => []);
  const [o, w, p] = await Promise.all([
    read('sz_objects?select=*&order=name,gueltig_ab.desc'),
    read(`sz_wishes?select=*&end_date=gte.${heuteISO()}&order=start_date.asc`),
    read('sz_preferences?select=*'),
  ]);
  S.objekte = o;
  try {
    const remembered = localStorage.getItem(objektAuswahlKey());
    if (remembered !== null) S.form.object_id = o.some(x => x.id === remembered && x.aktiv) ? remembered : null;
  } catch {}
  S.wuensche = w; S.prefs = p[0] || {};
  document.documentElement.dataset.theme = S.prefs.theme || 'dark';
  document.documentElement.dataset.accent = S.prefs.accent || 'blau';
  document.documentElement.dataset.pattern = S.prefs.pattern || 'none';
  document.documentElement.dataset.font = S.prefs.font || 'system';
}
function zeigeNeuerungen() {
  const version='shiftly-2026-10-01-import';
  if(localStorage.getItem('shiftly.seenVersion')===version)return;
  const box=document.createElement('div');box.className='ul-dlg';box.innerHTML=`<div class="ul-box" role="dialog" aria-modal="true" aria-label="Neu in dieser Version"><div class="ul-kopf"><b>Neu in dieser Version</b></div><div class="ul-rumpf"><p>Neu: Dienstplan importieren. Im Menü unter Planung kannst du Excel, PDF oder Fotos auslesen und die geplanten Stunden nach Namen ansehen.</p><p>Kürzel lassen sich je Dienstplanvorlage zuordnen. Prüfe deinen Namen, die Zeiten und das Objekt in der Vorschau. Erst danach werden deine ausgewählten Einträge übernommen.</p><p>Du kannst die Funktion mit einem eingebauten Beispiel ausprobieren. Bereits vorhandene identische Dienste werden beim Import ausgelassen.</p></div><div class="ul-fuss"><button class="btn pri" id="release-ok">Verstanden</button></div></div>`;
  document.body.appendChild(box);box.querySelector('#release-ok').onclick=()=>{localStorage.setItem('shiftly.seenVersion',version);box.remove();};
}
async function ladeMonat(waitForIncome = false) {
  const [y, m] = S.monat.split('-').map(Number);
  const bis = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  S.schichten = await api(`sz_shifts?select=*&datum=gte.${S.monat}-01&datum=lte.${bis}&order=datum.asc,beginn.asc.nullsfirst`);
  const income=syncIncome({api,S,monatDaten,nettoFuer});
  if(waitForIncome)await income;else income.catch(e=>console.warn('Einkommensschätzung konnte nicht gespeichert werden:',e.message));
  S.kalenderNeuLaden=false;
  S.schichtenStand = (S.schichtenStand || 0) + 1;
}

/* ---------------- Login-Ansicht ---------------- */
async function zeigeLogin(fehler = '', modus = 'login', scroll = false) {
  const formular = `
    <div class="card" style="display:grid;gap:12px">
      <div class="tabs" role="tablist">
        <button role="tab" id="t-login" aria-selected="${modus === 'login'}">Anmelden</button>
        <button role="tab" id="t-reg" aria-selected="${modus === 'reg'}">Registrieren</button>
      </div>
      <form id="f-auth" style="display:grid;gap:12px">
        ${modus === 'reg' ? '<label>Name<input id="a-name" autocomplete="name" required maxlength="80"></label>' : ''}
        <label>${modus === 'reg' ? 'E-Mail' : 'E-Mail oder Benutzername'}<input id="a-mail" autocomplete="username" required></label>
        <label>Passwort<input id="a-pw" type="password" autocomplete="${modus === 'reg' ? 'new-password' : 'current-password'}" required></label>
        ${modus === 'reg' ? '<label class="check" style="margin-top:0"><input type="checkbox" id="a-nl"> <span>Ja, ich möchte Angebote und Neuigkeiten zu Shiftly und neuen Apps per E-Mail erhalten. Abmelden geht jederzeit. (freiwillig)</span></label>' : ''}
        <button class="btn pri" type="submit">${modus === 'reg' ? '10 Tage kostenlos testen' : 'Anmelden'}</button>
        ${modus === 'reg' ? '<p class="hinweis" style="margin:0">Passwort: mindestens 8 Zeichen mit Buchstaben und Zahl. Mit der Registrierung akzeptierst du die <a href="#agb" data-seite="agb">AGB</a>; Infos zum Datenschutz findest du in der <a href="#datenschutz" data-seite="datenschutz">Datenschutzerklärung</a>.</p>' : '<button type="button" class="linkbtn" id="a-vergessen">Passwort vergessen?</button>'}
        <p class="fehler" id="a-fehler">${esc(fehler)}</p>
      </form>
    </div>`;
  $('#app').innerHTML = await VK.startseite(formular);
  VK.bindeFuss($('#app'));
  if (scroll) $('#anmelden').scrollIntoView();
  $('#vk-los').onclick = (e) => { e.preventDefault(); zeigeLogin('', 'reg', true); };
  $('#vk-zum-login').onclick = (e) => { e.preventDefault(); if (modus === 'login') $('#anmelden').scrollIntoView({ behavior: 'smooth' }); else zeigeLogin('', 'login', true); };
  if ($('#a-vergessen')) $('#a-vergessen').onclick = async () => { const d = (await VK.ladeRecht()).d; $('#a-fehler').textContent = d.email ? `Schreib uns an ${d.email} mit deiner Konto-E-Mail – wir setzen dir ein neues Passwort.` : 'Bitte wende dich an den Support (Kontakt im Impressum).'; };
  $('#t-login').onclick = () => zeigeLogin('', 'login', true);
  $('#t-reg').onclick = () => zeigeLogin('', 'reg', true);
  $('#f-auth').onsubmit = async (ev) => {
    ev.preventDefault();
    const knopf = ev.target.querySelector('button[type=submit]'); knopf.disabled = true;
    let mail = $('#a-mail').value.trim(); const pw = $('#a-pw').value;
    try {
      if (modus === 'reg') {
        const r = await fetch(`${URL_}/functions/v1/sz-signup`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ name: $('#a-name').value, email: mail, password: pw, newsletter: !!$('#a-nl')?.checked }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Registrierung fehlgeschlagen');
      }
      if (!mail.includes('@')) {
        if (mail.toLowerCase() === 'baron') mail = INHABER_MAIL;
        else throw new Error('Bitte melde dich mit deiner E-Mail-Adresse an.');
      }
      speichereSitzung(ausToken(await authCall('token?grant_type=password', { email: mail.toLowerCase(), password: pw })));
      rpc('sz_log_event', { p_event: 'login' }).catch(() => {});
      $('#app').innerHTML = '<div class="laden">Anmeldung erfolgreich …</div>';
      await start();
    } catch (e) {
      const m = /invalid login/i.test(e.message) ? 'E-Mail/Benutzername oder Passwort ist falsch.' : e.message;
      $('#a-fehler').textContent = m; knopf.disabled = false;
    }
  };
}

/* ---------------- Hilfen ---------------- */
const cfg = () => ({ ...S.profil });
function zugangText() {
  const z = S.zugang; if (!z) return '';
  if (z.admin) return '<span class="status st-ok">Inhaber · kostenlos</span>';
  if (z.status === 'active') {
    const plan = { monat: 'Monatsabo', jahr: 'Jahresabo', frei: 'Freizugang', aktion: 'Aktion · gratis' }[z.plan] || 'Aktiv';
    return `<span class="status st-ok">${plan}${z.sub_ends_at ? ' bis ' + new Date(z.sub_ends_at).toLocaleDateString('de-DE') : ''}</span>`;
  }
  if (z.status === 'trialing' && z.access) {
    const tage = Math.max(0, Math.ceil((new Date(z.trial_ends_at) - Date.now()) / 86400000));
    return `<span class="status st-warn">Test · noch ${tage} ${tage === 1 ? 'Tag' : 'Tage'}</span>`;
  }
  return '<span class="status st-aus">Test abgelaufen</span>';
}
const ICON = {
  start: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="8" height="9" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="14" width="8" height="7" rx="1.5"/></svg>',
  zettel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
  urlaub: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="3.5"/><path d="M12 1.5v1.5M12 13v1.5M5.5 8H4M20 8h-1.5M7.4 3.4l1 1M15.6 11.6l1 1M16.6 3.4l-1 1M8.4 11.6l-1 1M3 21c2-2.5 5.5-3.5 9-3.5s7 1 9 3.5"/></svg>',
  feiertage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  konto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  statistik: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  budget: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18M16 15h2"/></svg>',
};

/* ---------------- Rahmen ---------------- */
let refreshBusy = false;
async function refreshApp() {
  if(refreshBusy)return;
  refreshBusy = true;invalidateWeather();
  const view = S.ansicht, position = window.scrollY;
  const captureDrafts = () => [...document.querySelectorAll('#inhalt input,#inhalt select,#inhalt textarea')].flatMap((el,index) => {
    const changed = el.tagName === 'SELECT' ? el.selectedIndex !== Math.max(0,[...el.options].findIndex(o=>o.defaultSelected)) : ['checkbox','radio'].includes(el.type) ? el.checked !== el.defaultChecked : el.value !== el.defaultValue;
    return changed && el.type !== 'file' ? [{id:el.id,name:el.name,formId:el.form?.id,index,value:el.value,checked:el.checked}] : [];
  });
  const button = $('#app-refresh');button.disabled=true;button.textContent='Lädt …';
  try {
    await warteschlange;
    await Promise.allSettled([...pendingWrites]);
    const [profile,access] = await Promise.all([api('sz_profile?select=*'),rpc('sz_ensure_access'),ladeExtras(true)]);
    if(!profile[0])throw Error('Dein Profil konnte nicht geladen werden.');
    S.profil=profile[0];S.zugang=access;S.jahr=null;S.urlaubInfo=null;
    await ladeMonat(true);
    const drafts = captureDrafts();
    if(S.ansicht==='budget' && $('#groschen-frame')) {
      const frame=$('#groschen-frame'),requestId=crypto.randomUUID();
      const refreshed=new Promise((resolve,reject)=>{
        const finish=(error)=>{clearTimeout(timer);window.removeEventListener('message',listener);error?reject(error):resolve();};
        const listener=e=>{if(e.origin===location.origin&&e.source===frame.contentWindow&&e.data?.type==='groschen-refreshed'&&e.data.requestId===requestId)finish(e.data.error?Error(e.data.error):null);};
        const timer=setTimeout(()=>finish(Error('Haushaltsbuch konnte noch nicht aktualisiert werden. Bitte erneut versuchen.')),15000);
        window.addEventListener('message',listener);
      });
      frame.contentWindow.postMessage({type:'shiftly-groschen-refresh',requestId},location.origin);
      await Promise.all([refreshed,renderBudget({api,S,esc,toast,render,ladeExtras,monatDaten,nettoFuer,heuteISO,fe,fh,sitzung,token,url:URL_,key:KEY})]);
    } else await render();
    if(S.ansicht===view) {
      const fresh=[...document.querySelectorAll('#inhalt input,#inhalt select,#inhalt textarea')];
      for(const draft of drafts){const el=draft.id?document.getElementById(draft.id):draft.name?fresh.find(x=>x.name===draft.name&&x.form?.id===draft.formId):fresh[draft.index];if(el){el.value=draft.value;el.checked=draft.checked;}}
      window.scrollTo(0,position);
    }
    toast('Daten aktualisiert und neu berechnet.');
  } catch(error) { toast('Aktualisieren fehlgeschlagen: '+error.message); }
  finally {refreshBusy=false;const current=$('#app-refresh');if(current){current.disabled=false;current.textContent='↻ Aktualisieren';}}
}
function paintLocation(){
 const state=currentLocation(),label=$('#top-location'),hero=$('.dashboard-place');
 if(label){label.textContent='⌖ '+state.label;label.title=state.message||'Standort und Wetter aktualisieren';label.disabled=state.status==='loading';}
 if(hero)hero.textContent='⌖ '+state.label;
 if(state.status==='loading'||state.status==='error'){const w=$('#top-weather');if(w)w.textContent=state.status==='loading'?'☁ Wetter wird aktualisiert':'☁ Wetter benötigt deinen Standort';}
}
function paintWeather(w){const label=$('#top-weather');if(label)label.textContent=w?`☁ ${Math.round(w.low)}–${Math.round(w.high)} °C · ${w.rain?'Regen möglich':'trocken'}`:'☁ Wetter nicht verfügbar';paintLocation();}
async function refreshLocation(force=false){
 const card=$('#dashboard-weather');
 try{const weather=card?await renderWeather(card,heuteISO,force):await loadWeather(heuteISO,force);paintWeather(weather);}
 catch(error){paintWeather(null);if(force)toast(error.message);}
}
window.addEventListener('shiftly-location',paintLocation);
window.addEventListener('shiftly-weather',e=>paintWeather(e.detail));
setInterval(()=>{if(sitzung&&document.visibilityState==='visible'&&$('#top-location'))refreshLocation();},300000);
function render() {
  const datumOben=new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
  let wetterOben=S.ansicht==='start'?'Wetter wird geladen':'Wetter auf dem Dashboard';

  $('#app').innerHTML = `
    <header class="top"><div class="top-main"><button id="app-menu-open" class="top-menu-button" type="button" aria-label="Menü öffnen" aria-expanded="false"><span></span><span></span><span></span></button><div class="marke"><img src="icons/hamburg-werkschutz-192.png" alt="">Shiftly</div>
      <div class="top-actions"><div class="wer">${esc(S.profil?.name || sitzung.user.email)}<br>${zugangText()}</div><button class="btn klein" id="app-refresh" type="button" ${refreshBusy?'disabled':''}>${refreshBusy?'Lädt …':'↻ Aktualisieren'}</button></div></div>
      <div class="top-today"><span id="top-date">${esc(datumOben)}</span><button id="top-location" type="button" class="top-location" aria-label="Aktuellen Standort und Wetter aktualisieren">⌖ ${esc(currentLocation().label)}</button><span id="top-weather">☁ ${esc(wetterOben)}</span></div></header>
    <main class="wrap" id="inhalt"></main>
    <div id="app-quick-sheet" class="quick-sheet" hidden><div class="quick-sheet-panel" role="dialog" aria-modal="true" aria-label="Schnellaktionen"><div class="quick-sheet-head"><strong>Was möchtest du eintragen?</strong><button type="button" id="app-quick-close" aria-label="Schließen">✕</button></div><div class="quick-sheet-grid"><button type="button" data-quick="shift"><span>▣</span>Schicht</button><button type="button" data-quick="vacation"><span>✈</span>Urlaubsantrag</button><button type="button" data-quick="expense"><span>€</span>Ausgabe</button><button type="button" data-quick="calendar"><span>▦</span>Kürzelkalender</button></div></div></div>
    <div id="app-menu" class="app-menu-backdrop" hidden><aside class="app-menu-panel" role="dialog" aria-modal="true" aria-label="Shiftly Menü"><div class="app-menu-head"><strong>Shiftly</strong><button type="button" id="app-menu-close" aria-label="Menü schließen">✕</button></div><div class="app-menu-user">${esc(S.profil?.name || sitzung.user.email)}<small>${zugangText()}</small></div><nav aria-label="Alle Bereiche">
      <div class="app-menu-group"><p>Übersicht</p><button data-menu-view="start">${ICON.start}<span>Dashboard</span></button><button data-menu-view="zettel">${ICON.zettel}<span>Kalender &amp; Schichten</span></button><button data-menu-view="urlaub">${ICON.urlaub}<span>Urlaub</span></button></div>
      <div class="app-menu-group"><p>Finanzen &amp; Arbeit</p><button data-menu-view="budget">${ICON.budget}<span>Groschen</span></button><button data-menu-view="objekte">▤ <span>Objekte &amp; Tarife</span></button></div>
      <div class="app-menu-group"><p>Planung</p><button data-menu-view="import">▦ <span>Dienstplan importieren</span></button><button data-menu-view="wuensche">◇ <span>Wunschdienstplan</span></button><button data-menu-view="feiertage">${ICON.feiertage}<span>Feiertage</span></button></div>
      <div class="app-menu-group"><p>Persönliches</p><button data-menu-view="konto">${ICON.konto}<span>Konto &amp; Tarif</span></button><button data-menu-view="einstellungen">⚙ <span>Einstellungen</span></button><button data-menu-view="feedback">✎ <span>Feedback</span></button>${S.zugang?.admin?`<button data-menu-view="statistik">${ICON.statistik}<span>Administration</span></button>`:''}</div>
      <div class="app-menu-group"><p>Direkt eintragen</p><button id="app-quick-open" type="button" aria-expanded="false">＋ <span>Schnellaktionen</span></button></div>
    </nav></aside></div>`;
  $('#app').classList.toggle('in-groschen', S.ansicht === 'budget');
  $('#app-refresh').onclick=refreshApp;
  $('#top-location').onclick=()=>refreshLocation(true);
  const menu=$('#app-menu'),menuOpen=$('#app-menu-open');
  const closeMenu=()=>{menu.hidden=true;menuOpen.setAttribute('aria-expanded','false');};
  menuOpen.onclick=()=>{menu.hidden=false;menuOpen.setAttribute('aria-expanded','true');$('#app-menu-close').focus();};
  $('#app-menu-close').onclick=closeMenu;
  if (S.zugang?.admin) {
    const b=document.createElement('button'); b.type='button'; b.id='app-actions-open'; b.textContent='€ Preise & Aktionen';
    b.onclick=()=>{closeMenu();window.dispatchEvent(new CustomEvent('aktionen:oeffnen'));};
    menu.querySelector('[data-menu-view="statistik"]')?.after(b);
  }
  menu.onclick=e=>{if(e.target===menu)closeMenu();};
  menu.onkeydown=e=>{if(e.key==='Escape'){closeMenu();menuOpen.focus();}};
  $$('[data-menu-view]',menu).forEach(b=>{if(b.dataset.menuView===S.ansicht)b.setAttribute('aria-current','page');b.onclick=async()=>{closeMenu();if(S.kalenderNeuLaden)try{await ladeMonat();}catch(e){toast('Kalender konnte nicht aktualisiert werden: '+e.message);return;}S.ansicht=b.dataset.menuView;await render();scrollTo(0,0);};});
  const sheet=$('#app-quick-sheet'),open=$('#app-quick-open');
  const closeQuick=()=>{sheet.hidden=true;open.setAttribute('aria-expanded','false');};
  open.onclick=()=>{closeMenu();sheet.hidden=false;open.setAttribute('aria-expanded','true');$('#app-quick-close').focus();};
  $('#app-quick-close').onclick=closeQuick;
  sheet.onclick=e=>{if(e.target===sheet)closeQuick();};
  sheet.onkeydown=e=>{if(e.key==='Escape'){closeQuick();open.focus();}};
  $$('[data-quick]',sheet).forEach(b=>b.onclick=async()=>{
    const action=b.dataset.quick;closeQuick();
    S.ansicht=action==='vacation'?'urlaub':action==='expense'?'start':'zettel';
    await render();
    if(action==='vacation')$('#u-antrag')?.click();
    if(action==='expense'){const details=$('#dashboard-budget .quick-expense-details');if(details)details.open=true;$('#dashboard-budget input[name="amount"]')?.focus();}
    if(action==='shift'){const form=$('#formular');if(form){openFold(form);form.scrollIntoView({behavior:'smooth',block:'start'});}}
    if(action==='calendar')$('#kuerzel-kalender')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  const extras = { api, S, esc, toast, render, refreshApp, ladeExtras, ladeMonat, monatDaten, nettoFuer, heuteISO, fe, fh, sitzung, token, url: URL_, key: KEY, kuerzelMap, deletePersonalCode, ladePdfLib, objektZuordnung, pruefeUrlaubUeberschneidung, ueberschneidet, scheduleVacationRequest };
  const result = ({ start: renderStart, zettel: renderZettel, urlaub: () => renderUrlaub({ api, S, esc, toast, ladePdfLib, render, ladeMonat }), budget: () => renderBudget(extras),
    import: () => renderPlanImport(extras), wuensche: () => renderWishes(extras), objekte: () => renderObjects(extras), einstellungen: () => renderPreferences(extras), feedback: () => renderFeedback(extras),
    feiertage: renderFeiertage, konto: renderKonto, statistik: async () => { await ladeStatistik(); renderStatistik(); } })[S.ansicht]();
  if(S.ansicht!=='start')refreshLocation();
  const bereich = ({start:'Übersicht',zettel:'Dienstplan',urlaub:'Urlaub',budget:'Groschen',wuensche:'Wünsche',objekte:'Objekte',feiertage:'Feiertage',konto:'Konto',einstellungen:'Einstellungen',feedback:'Feedback'})[S.ansicht];
  if(bereich) rpc('sz_track_area',{p_area:bereich}).catch(()=>{});
  return result;
}
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || S.ansicht !== 'budget' || e.source !== $('#groschen-frame')?.contentWindow) return;
  if (e.data?.type === 'groschen-height') { const h=Number(e.data.height); if(Number.isFinite(h)&&h>0&&h<20000)$('#groschen-frame').style.height=`${Math.ceil(h)+4}px`; return; }
  if (e.data?.type === 'groschen-view') { document.querySelectorAll('[data-groschen-view]').forEach(b=>{if(b.dataset.groschenView===e.data.view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}); const summary=$('#budget-summary');if(summary)summary.hidden=e.data.view!=='uebersicht';return; }
  if (e.data?.type === 'groschen-toast') { toast(String(e.data.message||'').slice(0,300)); return; }
  if (e.data?.type === 'groschen-saved') renderBudget({ api, S, esc, toast, render, ladeExtras, monatDaten, nettoFuer, heuteISO, fe, fh, sitzung, token, url: URL_, key: KEY });
});

/* ---------------- Berechneter Monat ---------------- */
function monatDaten(schichten = S.schichten) {
  const c = cfg();
  const zeilen = schichten.map((sh) => [sh, berechne(sh, schichtCfg(sh, c))]);
  return { c, zeilen, T: summe(zeilen, c) };
}
function schichtCfg(sh, c) {
  if (sh.art !== 'dienst') return c;
  const object = S.objekte.find(x => x.id === sh.object_id);
  if (sh.object_id || sh.rate_snapshot) return { ...c, ...objectRates(object, sh.rate_snapshot) };
  return c;
}
function objektZuordnung(objectId, datum, bestehend = null) {
  const id = objectId || null;
  const objekt = id ? S.objekte.find(o => o.id === id) : null;
  if (id && (!objekt || objekt.gueltig_ab > datum)) return { error: 'Der Objekttarif gilt an diesem Datum noch nicht.' };
  return { object_id: id, rate_snapshot: objekt ? objectRates(objekt,
    bestehend?.object_id === id ? bestehend.rate_snapshot : null) : null };
}
function objektAuswahlKey() { return 'shiftly.object.' + (sitzung?.user?.id || S.profil?.user_id || ''); }
function merkeObjekt(id) {
  S.form.object_id = id || null;
  try { localStorage.setItem(objektAuswahlKey(), id || ''); } catch {}
}
function objektTarifText(id, bestehend = null) {
  const o = S.objekte.find(x => x.id === id);
  const c = id ? objectRates(o, bestehend?.object_id === id ? bestehend.rate_snapshot : null) : cfg();
  return `${fe(c.lohn)}/Std. · Zulage ${fe(c.objektzulage || 0)}/Std. · Nacht ${c.nacht_pct || 0} %`;
}

const objektName = sh => sh.object_id ? (S.objekte.find(o => o.id === sh.object_id)?.name || 'Objekt') : (sh.rate_snapshot?.object_name || S.profil?.objekt || 'Standardtarif');
const artZeit = (sh, r) => sh.art === 'urlaub' || sh.art === 'krank' || sh.art === 'frei'
  ? `${ART[sh.art]}${sh.kuerzel ? ' (' + sh.kuerzel + ')' : ''}`
  : `${sh.kuerzel ? sh.kuerzel + ' ' : ''}${hm(sh.beginn)}–${hm(sh.ende)}${r.folgetag ? ' (+1)' : ''}`;
const bemerkung = (sh, r) => [...r.feiertagNamen, r.hatSonntag ? 'Sonntag' : '', r.keinUrlaub ? 'zählt nicht als Urlaubstag' : '', sh.notiz || ''].filter(Boolean).join(' · ');
function lohnZeilen(T, c) {
  const L = [[`Grundlohn ${fh(T.std)} Std.${S.objekte.length ? ' (je Objekt)' : ` × ${fe(+c.lohn)}`}`, T.grund],
    [`Nachtzuschlag ${fh(+c.nacht_pct)} % (${hm(c.nacht_von)}–${hm(c.nacht_bis)} Uhr), ${fh(T.nacht)} Std.`, T.nachtE],
    [`Sonntagszuschlag ${fh(+c.sonntag_pct)} %, ${fh(T.sonntag)} Std.`, T.sonntagE],
    [`Feiertagszuschlag ${fh(+c.feiertag_pct)} %, ${fh(T.feiertag)} Std.`, T.feiertagE]];
  const diff = T.zuschlag - (T.nachtE + T.sonntagE + T.feiertagE);
  if (Math.abs(diff) > 0.005) L.push(['Abzug „nur höherer Zuschlag“', diff]);
  if (T.mehrE) L.push([`Mehrarbeitszuschlag ${fh(T.mehrPct)} % ab der ${fh(T.mehrAb + 1).replace(',00', '')}. Monatsstunde, ${fh(T.mehrStd)} Std.`, T.mehrE]);
  if (T.objektE) L.push([`Objektzulagen für ${fh(T.std)} Std.`, T.objektE]);
  if (T.urlaub) L.push([`Urlaub ${T.tageU} ${T.tageU === 1 ? 'Tag' : 'Tage'}, ${fh(T.urlaub)} Std.`, T.urlaubE]);
  if (T.krank) L.push([`Krankheit ${T.tageK} ${T.tageK === 1 ? 'Tag' : 'Tage'}, ${fh(T.krank)} Std.`, T.krankE]);
  return L;
}

/* ---------------- Netto ---------------- */
const STEUER_LAENDER = ['HH', 'BE', 'BB', 'HE', 'BW', 'BY', 'HB', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'];
function nettoFuer(T, c) {
  if (!STEUER_LAENDER.includes(c.region.split('_')[0])) return null;
  // steuer- und SV-freie Zuschläge nach § 3b EStG (Grundlohn inkl. Objektzulage)
  const summeZ = T.nachtE + T.sonntagE + T.feiertagE;
  const faktor = summeZ > 0 ? Math.min(1, T.zuschlag / summeZ) : 0;
  const frei = freieZuschlaege({
    hours: { total: T.std, night: T.nacht, sunday: T.sonntag, holiday: T.feiertag },
    money: { base: T.grund, allowance: T.objektE, night: T.nachtE * faktor, sunday: T.sonntagE * faktor, holiday: T.feiertagE * faktor },
    wage: T.std ? T.grund / T.std : +c.lohn,
  });
  const r = netto2026({ brutto: T.gesamt, steuerfrei: frei.steuer, svfrei: frei.sv },
    { stkl: c.stkl, zkf: c.zkf, kirche: c.kirche, kvz: c.kvz, kinderlos: c.kinderlos, kinderU25: c.kinder_u25 }, c.region.split('_')[0]);
  return { ...r, frei };
}

/* ---------------- Übersicht (Dashboard) ---------------- */
async function ladeJahr() {
  const y = S.monat.slice(0, 4);
  if (S.jahr?.y === y && S.jahr?.stand === S.schichtenStand) return;
  const gestern = tagKey(Date.parse(heuteISO() + 'T12:00:00Z') - 86400000);
  const u = naechsteUmstellung(), uVor = u ? tagKey(Date.parse(u.datum + 'T12:00:00Z') - 86400000) : null;
  const hJ = heuteISO(), jJ = hJ.slice(0, 4), mJ = hJ.slice(0, 7);
  const mEnde = tagKey(Date.UTC(+jJ, +mJ.slice(5, 7), 0)), in21 = tagKey(Date.parse(hJ + 'T12:00:00Z') + 21 * 86400000);
  const [liste, naechste, dienste, umstellDienste, monatJetzt, ruheDienste, jahrJetzt] = await Promise.all([
    api(`sz_shifts?select=datum,art,beginn,ende,pause_min,stunden,kuerzel,object_id,rate_snapshot&datum=gte.${y}-01-01&datum=lte.${y}-12-31&order=datum.asc`),
    api(`sz_shifts?select=datum,art,beginn,ende,kuerzel,pause_min,stunden&art=eq.dienst&datum=gte.${heuteISO()}&order=datum.asc,beginn.asc&limit=6`),
    api(`sz_shifts?select=datum,art,beginn,ende,kuerzel&art=eq.dienst&datum=gte.${gestern}&order=datum.asc,beginn.asc&limit=4`).catch(() => []),
    u ? api(`sz_shifts?select=datum,art,beginn,ende,kuerzel&art=eq.dienst&datum=gte.${uVor}&datum=lte.${u.datum}`).catch(() => []) : [],
    api(`sz_shifts?select=*&datum=gte.${mJ}-01&datum=lte.${mEnde}&order=datum.asc`).catch(() => []),
    api(`sz_shifts?select=datum,art,beginn,ende,kuerzel&art=eq.dienst&datum=gte.${gestern}&datum=lte.${in21}&order=datum.asc,beginn.asc`).catch(() => []),
    String(y) === jJ ? null : api(`sz_shifts?select=datum,art,beginn,ende&art=eq.dienst&datum=gte.${jJ}-01-01&datum=lte.${jJ}-12-31`).catch(() => []),
  ]);
  S.jahr = { y, liste, naechste, dienste, umstellDienste, monatJetzt, ruheDienste, jahrJetzt: jahrJetzt || liste, stand: S.schichtenStand };
}
// Urlaubskonto, nächster Urlaub, nächster Feiertag fürs Dashboard
async function ladeUrlaubInfo(y) {
  const h = heuteISO();
  const [jahr, liste, naechster, naechsterZettel] = await Promise.all([
    api(`sz_leave_years?select=*&year=eq.${y}`).catch(() => []),
    api(`sz_vacations?select=id,start_date,end_date,status,days_count,manual_days,allocation_year`).catch(() => []),
    api(`sz_vacations?select=start_date,end_date,status,days_count&end_date=gte.${h}&status=not.in.(rejected,canceled)&order=start_date.asc&limit=1`).catch(() => []),
    api(`sz_shifts?select=datum&art=eq.urlaub&datum=gte.${h}&order=datum.asc&limit=1`).catch(() => []),
  ]);
  S.urlaubInfo = { y, jahr: jahr[0] || null, liste, naechster: naechster[0] || null, naechsterZettel: naechsterZettel[0] || null };
}
const tageBis = (iso) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(heuteISO() + 'T00:00:00Z')) / 86400000);
const inTagen = (n) => (n <= 0 ? 'heute' : n === 1 ? 'morgen' : `in ${n} Tagen`);
function urlaubBlock(y, c) {
  const U = S.urlaubInfo || {};
  const p = S.profil;
  const anspruch = Number(U.jahr?.entitlement_days ?? p.annual_leave_days ?? 30), uebertrag = Number(U.jahr?.carryover_days || 0);
  const gueltig = (U.liste || []).filter((v) => !['rejected', 'canceled'].includes(v.status));
  const arbeitstage = Array.isArray(p.vacation_weekdays) && p.vacation_weekdays.length ? p.vacation_weekdays.map(Number) : [1,2,3,4,5];
  const verbraucht = urlaubVerbrauch(U.liste || [], S.jahr?.liste || [], Number(y), c.region, arbeitstage);
  const quelle = 'aus Urlaubsplaner und Stundenzettel, ohne doppelte Tage';
  const rest = anspruch + uebertrag - verbraucht;
  const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('de-DE');
  const statusText={planned:'Geplant',requested:'Beantragt',approved:'Genehmigt',taken:'Genommen',rejected:'Abgelehnt',canceled:'Storniert'};
  const antraege=[...(U.liste||[])].sort((a,b)=>a.start_date.localeCompare(b.start_date)||a.end_date.localeCompare(b.end_date));
  const next=antraege.find(v=>!['rejected','canceled'].includes(v.status)&&v.end_date>=heuteISO());
  let gruppe='';
  const antragsListe=antraege.map(a=>{const monat=a.start_date.slice(0,7),heading=monat!==gruppe?`<h3 class="vacation-month-heading">${MONATE[Number(monat.slice(5))-1]} ${monat.slice(0,4)}</h3>`:'';gruppe=monat;return `${heading}<div class="dashboard-vacation-row ${a.id===next?.id?'vacation-next':''}"><div><b>${datumDE(a.start_date)} – ${datumDE(a.end_date)}</b><small>${fmt(a.days_count)} Urlaubstage${a.allocation_year?' · Urlaubskonto '+a.allocation_year:''}${a.id===next?.id?' · Nächster Urlaub':''}</small></div><span class="status">${esc(statusText[a.status]||a.status)}</span></div>`;}).join('');
  // nächster Urlaub
  let nu = '<p class="hinweis" style="margin:0">Kein Urlaub geplant.</p>';
  const v = next || U.naechster, z = U.naechsterZettel;
  if (v && (!z || v.start_date <= z.datum)) {
    const laeuft = v.start_date <= heuteISO();
    nu = `<b>${datumDE(v.start_date)} – ${datumDE(v.end_date)}</b><span class="hinweis" style="margin:0">${fmt(v.days_count)} Urlaubstage · ${laeuft ? 'läuft gerade' : inTagen(tageBis(v.start_date))}</span>`;
  } else if (z) nu = `<b>${wtag(z.datum)} ${datumDE(z.datum)}</b><span class="hinweis" style="margin:0">${inTagen(tageBis(z.datum))} (im Stundenzettel)</span>`;
  return `<section class="card dashboard-half dashboard-vacation">
      <h2>Resturlaub</h2><strong class="dashboard-tile-value ${rest < 0 ? 'c-f' : 'c-u'}">${fmt(rest)} Tage</strong>
      <p class="hinweis">von ${fmt(anspruch + uebertrag)} Tagen für ${y}</p>
      <details class="dashboard-tile-details"><summary>Berechnung anzeigen</summary><p>Anspruch ${fmt(anspruch)}${uebertrag ? ` + ${fmt(uebertrag)} Übertrag` : ''} · ${fmt(verbraucht)} genommen oder verplant.</p><p>Genommene Tage ${quelle}.</p></details>
    </section>
    <section class="card dashboard-half dashboard-nextvac">
      <h2>Nächster Urlaub</h2><div class="dashboard-nextvac-text">${nu}</div><button class="btn klein" id="zum-urlaub" type="button">Urlaubsplaner ›</button>
    </section><section class="card dashboard-vacation-requests"><h2>Meine Urlaubsanträge</h2>${antragsListe||'<p class="hinweis">Noch keine Urlaubsanträge gespeichert.</p>'}<button class="btn klein" id="dashboard-vacations-open">Urlaubsanträge verwalten</button></section>`;
}
/* ---------------- Auf einen Blick: nächster Dienst, Feiertag, Zeitumstellung ---------------- */
// Wanduhrzeit eines Dienstes als echte lokale Zeit (berücksichtigt Sommer-/Winterzeit)
function dienstZeiten(s) {
  const [y, mo, d] = s.datum.split('-').map(Number);
  const [bh, bm] = hm(s.beginn).split(':').map(Number), [eh, em] = hm(s.ende).split(':').map(Number);
  const start = new Date(y, mo - 1, d, bh, bm);
  const ende = new Date(y, mo - 1, d, eh, em);
  if (ende <= start) ende.setDate(ende.getDate() + 1);
  return { start, ende };
}
const dauerText = (ms) => {
  const min = Math.max(1, Math.round(ms / 60000)), t = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  if (min < 60) return `${m} Min.`;
  if (min < 48 * 60) return `${Math.floor(min / 60)} Std.${m ? ` ${m} Min.` : ''}`;
  return `${t} Tagen${h ? ` ${h} Std.` : ''}`;
};
function naechsterDienst() {
  const jetzt = new Date();
  for (const s of S.jahr?.dienste || []) {
    if (!s.beginn || !s.ende) continue;
    const z = dienstZeiten(s);
    if (z.ende > jetzt) return { s, ...z, laeuft: z.start <= jetzt };
  }
  return null;
}
function dienstCountdown() {
  const n = naechsterDienst(), jetzt = new Date();
  if (!n) return { gross: 'Kein Dienst eingetragen', klein: 'Trag deine Dienste im Stundenzettel ein.' };
  const tag = `${n.s.kuerzel ? n.s.kuerzel + ' · ' : ''}${wtag(n.s.datum)} ${datumDE(n.s.datum)} · ${hm(n.s.beginn)}–${hm(n.s.ende)} Uhr`;
  if (n.laeuft) return { gross: `Läuft · noch ${dauerText(n.ende - jetzt)}`, klein: tag, an: true };
  return { gross: `in ${dauerText(n.start - jetzt)}`, klein: tag };
}
function naechsterFeiertag(region) {
  const h = heuteISO(); let t = Date.parse(h + 'T00:00:00Z');
  for (let i = 0; i < 400; i++, t += 86400000) {
    const gesetzlich = feiertagName(region, t + 12 * 3600000);
    if (gesetzlich) return { datum: tagKey(t), name: gesetzlich, tarif: false };
    const tarif = tarifFeiertag(region, t + 15 * 3600000);
    if (tarif) return { datum: tagKey(t), name: tarif.replace(' ab 14 Uhr', ''), tarif: true, ab14: /14 Uhr/.test(tarif) };
  }
  return null;
}
function naechsteUmstellung() {
  const h = heuteISO(), y = +h.slice(0, 4);
  return [...zeitumstellungen(y), ...zeitumstellungen(y + 1)].find((u) => u.datum >= h) || null;
}
// Hat der Nutzer in der Umstellungsnacht Dienst? (Wanduhr 02:00–03:00 am Sonntag)
function dienstInUmstellung(u) {
  const a = Date.parse(u.datum + 'T02:00:00Z'), b = a + 3600000;
  const vorher = tagKey(a - 86400000);
  return (S.jahr?.umstellDienste || []).filter((s) => s.art === 'dienst' && (s.datum === u.datum || s.datum === vorher)).find((s) => {
    const st = Date.parse(s.datum + 'T00:00:00Z') + minuten(s.beginn) * 60000;
    let en = Date.parse(s.datum + 'T00:00:00Z') + minuten(s.ende) * 60000; if (en <= st) en += 86400000;
    return st < b && en > a;
  }) || null;
}
function blickBlock(c, nd = []) {
  const cd = dienstCountdown();
  const ort = (REGIONEN[c.region]?.n || '').split(' (')[0];
  const f = naechsterFeiertag(c.region);
  const nf = f ? `<b>${esc(f.name)}</b><span class="hinweis" style="margin:0">${wtag(f.datum)} ${datumDE(f.datum)} · ${inTagen(tageBis(f.datum))}</span>${f.tarif ? `<span class="hinweis" style="margin:0">${f.ab14 ? 'Ab 14 Uhr ' : ''}100 % Zuschlag laut Tarif, kein gesetzlicher Feiertag</span>` : ''}` : '<p class="hinweis" style="margin:0">–</p>';
  const u = naechsteUmstellung();
  let nu = '<p class="hinweis" style="margin:0">–</p>';
  if (u) {
    const winter = u.art === 'winter', d = dienstInUmstellung(u);
    nu = `<b>Uhr wird ${winter ? 'zurückgestellt' : 'vorgestellt'}</b>
      <span class="hinweis" style="margin:0">${wtag(u.datum)} ${datumDE(u.datum)} · ${inTagen(tageBis(u.datum))}</span>
      <span class="hinweis" style="margin:0">Nachts um ${u.von} Uhr ${winter ? 'zurück' : 'vor'} auf ${u.nach} Uhr (${winter ? 'Winterzeit' : 'Sommerzeit'})</span>
      <span class="hinweis" style="margin:0">${winter ? 'Eine Stunde mehr Schlaf' : 'Eine Stunde weniger Schlaf'}, sofern du zu dieser Zeit nicht arbeitest.</span>
      ${d ? `<span class="blick-hinweis">Du hast in dieser Nacht Dienst (${esc(d.kuerzel || hm(d.beginn) + '–' + hm(d.ende))}): Er dauert 1 Stunde ${winter ? 'länger' : 'kürzer'}. Die App rechnet das automatisch.</span>` : ''}`;
  }
  return `<section class="card blick dashboard-nextshift">
      <h2>Nächste Schicht</h2>
      <div class="blick-dienst${cd.an ? ' an' : ''}"><b class="blick-zahl" id="cd-gross">${esc(cd.gross)}</b><span class="hinweis" style="margin:0" id="cd-klein">${esc(cd.klein)}</span></div>
      <details class="dashboard-tile-details"><summary>Weitere kommende Dienste</summary>${nd.length ? `<div class="naechste">${nd.map((s) => `<div><span class="kc k-${katEintrag(s)}">${esc(s.kuerzel || ART[s.art] || '')}</span><b>${wtag(s.datum)} ${datumDE(s.datum).slice(0, 6)}</b><span>${hm(s.beginn)}–${hm(s.ende)}</span></div>`).join('')}</div>` : '<p class="hinweis">Keine kommenden Dienste eingetragen.</p>'}</details>
      <details class="dashboard-tile-details"><summary>Nächster Feiertag</summary><div class="blick-raster"><div class="naechst-box"><span class="label">Nächster Feiertag${ort ? ' · ' + esc(ort) : ''}</span>${nf}</div></div></details>
    </section><section class="card dashboard-timechange"><h2>⏰ Nächste Zeitumstellung</h2><div class="naechst-box">${nu}</div></section>`;
}
/* ---------------- Arbeitszeit-Check: Mehrarbeit, Ruhezeit, Sonntage ---------------- */
function mehrarbeitBox(c) {
  const M = mehrarbeitRegel(c), mo = MONATE[+heuteISO().slice(5, 7) - 1];
  if (!M.ab) return `<div class="naechst-box"><span class="label">Mehrarbeit im ${mo}</span><b>Keine Grenze eingestellt</b><span class="hinweis" style="margin:0">Unter „Konto &amp; Tarif“ kannst du festlegen, ab welcher Monatsstunde es Mehrarbeitszuschlag gibt.</span></div>`;
  const liste = (S.jahr?.monatJetzt || []).map((sh) => [sh, berechne(sh, schichtCfg(sh, c))]);
  const T = summe(liste, c), std = T.std, anteil = Math.min(100, (std / M.ab) * 100);
  const dienste = liste.filter(([sh]) => sh.art === 'dienst'), schnitt = dienste.length ? std / dienste.length : 12;
  let gross, klein;
  if (std <= M.ab) {
    const rest = M.ab - std, n = Math.ceil(rest / (schnitt || 12));
    gross = `noch ${fh(rest)} Std.`;
    klein = `bis zur Mehrarbeit (+${M.pct} % ab der ${M.ab + 1}. Stunde) · das sind etwa ${n} ${n === 1 ? 'Dienst' : 'Dienste'} à ${fh(schnitt).replace(',00', '')} Std.`;
  } else {
    gross = `+${fh(std - M.ab)} Std. Mehrarbeit`;
    klein = `${M.pct} % Zuschlag = ${fe(T.mehrE)} extra in diesem Monat`;
  }
  return `<div class="naechst-box${std > M.ab ? ' check-gut' : ''}"><span class="label">Mehrarbeit im ${mo}</span><b class="blick-zahl">${gross}</b>
    <div class="check-balken" role="img" aria-label="${fh(std)} von ${M.ab} Stunden"><i style="width:${anteil}%"></i></div>
    <span class="hinweis" style="margin:0">${fh(std)} von ${M.ab} Std. (mit allen eingetragenen Diensten bis Monatsende)</span>
    <span class="hinweis" style="margin:0">${klein}</span></div>`;
}
function ruhezeitBox() {
  const jetzt = new Date(), RUHE = 11 * 3600000;
  const d = (S.jahr?.ruheDienste || []).filter((s) => s.beginn && s.ende).map((s) => ({ s, ...dienstZeiten(s) })).sort((a, b) => a.start - b.start);
  const probleme = [];
  for (let i = 1; i < d.length; i++) {
    const vor = d[i - 1], nach = d[i], luecke = nach.start - vor.ende;
    if (nach.start > jetzt && luecke < RUHE) probleme.push({ vor, nach, luecke });
  }
  const kurz = (x) => `${x.s.kuerzel ? x.s.kuerzel + ' ' : ''}${wtag(x.s.datum)} ${datumDE(x.s.datum).slice(0, 6)}`;
  if (!d.length) return `<div class="naechst-box"><span class="label">Ruhezeit</span><b>Keine Dienste in den nächsten 3 Wochen</b></div>`;
  if (!probleme.length) return `<div class="naechst-box check-gut"><span class="label">Ruhezeit · nächste 3 Wochen</span><b class="blick-zahl">In Ordnung</b><span class="hinweis" style="margin:0">Zwischen deinen Diensten liegen immer mindestens 11 Stunden Ruhe.</span></div>`;
  const p = probleme[0];
  return `<div class="naechst-box check-warn"><span class="label">Ruhezeit · nächste 3 Wochen</span>
    <b class="blick-zahl">${p.luecke < 0 ? 'Dienste überschneiden sich' : p.luecke < 60000 ? 'Keine Ruhe dazwischen' : `Nur ${dauerText(p.luecke)} Ruhe`}</b>
    <span class="hinweis" style="margin:0">zwischen ${esc(kurz(p.vor))} (bis ${hm(p.vor.s.ende)} Uhr) und ${esc(kurz(p.nach))} (ab ${hm(p.nach.s.beginn)} Uhr)${probleme.length > 1 ? ` · ${probleme.length - 1} weitere Stelle${probleme.length > 2 ? 'n' : ''}` : ''}</span>
    <span class="hinweis" style="margin:0">Gesetzlich sind 11 Stunden vorgesehen (§ 5 Arbeitszeitgesetz). Dein Tarifvertrag kann Ausnahmen erlauben.</span></div>`;
}
function sonntagBox() {
  const jahr = +heuteISO().slice(0, 4), so = new Set();
  for (const s of S.jahr?.jahrJetzt || []) {
    if (s.art !== 'dienst' || !s.beginn || !s.ende) continue;
    const b = Date.parse(s.datum + 'T00:00:00Z'), st = b + minuten(s.beginn) * 60000;
    let en = b + minuten(s.ende) * 60000; if (en <= st) en += 86400000;
    for (let t = b; t < en; t += 86400000) if (new Date(t).getUTCDay() === 0 && t + 86400000 > st && tagKey(t).startsWith(String(jahr))) so.add(tagKey(t));
  }
  let gesamt = 0; for (let t = Date.UTC(jahr, 0, 1); t < Date.UTC(jahr + 1, 0, 1); t += 86400000) if (new Date(t).getUTCDay() === 0) gesamt++;
  const gearbeitet = so.size, frei = gesamt - gearbeitet, noch = gesamt - 15 - gearbeitet;
  return `<div class="naechst-box${noch < 0 ? ' check-warn' : ''}"><span class="label">Sonntage ${jahr}</span><b class="blick-zahl">${gearbeitet} von ${gesamt} gearbeitet</b>
    <span class="hinweis" style="margin:0">${frei} Sonntage frei (mit allen eingetragenen Diensten). Mindestens 15 müssen im Jahr frei bleiben (§ 11 Arbeitszeitgesetz).</span>
    <span class="hinweis" style="margin:0">${noch >= 0 ? `Du kannst dieses Jahr noch an ${noch} ${noch === 1 ? 'Sonntag' : 'Sonntagen'} arbeiten.` : `Das sind ${-noch} ${noch === -1 ? 'Sonntag' : 'Sonntage'} zu viel.`}</span></div>`;
}
function checkBlock(c) {
  return `<section class="card blick">
      <h2>Arbeitszeit-Check</h2>
      <div class="blick-raster">${mehrarbeitBox(c)}${ruhezeitBox()}${sonntagBox()}</div>
    </section>`;
}
// Countdown läuft live weiter, solange die Übersicht offen ist
let blickUhr = null;
function starteBlickUhr() {
  clearInterval(blickUhr);
  blickUhr = setInterval(() => {
    const g = document.getElementById('cd-gross');
    if (!g || S.ansicht !== 'start') { clearInterval(blickUhr); blickUhr = null; return; }
    const cd = dienstCountdown();
    g.textContent = cd.gross; document.getElementById('cd-klein').textContent = cd.klein;
    g.closest('.blick-dienst').classList.toggle('an', !!cd.an);
  }, 20000);
}
const EUR0 = (x) => (x || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

async function renderStart() {
  S.dashboardDay = heuteISO();
  S.greetingPending = true;
  const [y, m] = S.monat.split('-').map(Number);
  $('#inhalt').innerHTML = '<div class="card laden">Übersicht wird berechnet …</div>';
  try { await Promise.all([ladeJahr(), ladeUrlaubInfo(y)]); } catch (e) { $('#inhalt').innerHTML = `<div class="card fehler">${esc(e.message)}</div>`; return; }
  if (S.ansicht !== 'start') return;
  const { c, zeilen, T } = monatDaten();
  const N = nettoFuer(T, c);
  const geldPosten = await api('recurring?select=kind,amount,interval_months,category').catch(() => []);
  const fixeAusgaben = geldPosten.filter(x=>x.kind==='out').reduce((a,x)=>a+Number(x.amount)/(Number(x.interval_months)||1),0);
  const andereEinnahmen = geldPosten.filter(x=>x.kind==='in' && !(S.prefs.budget_link && S.prefs.income_mode==='automatic' && x.category==='gehalt')).reduce((a,x)=>a+Number(x.amount)/(Number(x.interval_months)||1),0);
  if (S.ansicht !== 'start') return;
  // Jahr je Monat
  const monate = MONATE.map((_, i) => {
    const mm = `${y}-${pad(i + 1)}`;
    const L = S.jahr.liste.filter((s) => s.datum.startsWith(mm)).map((sh) => [sh, berechne(sh, schichtCfg(sh, c))]);
    const t = summe(L, c); const n = L.length ? nettoFuer(t, c) : null;
    return { i, brutto: t.gesamt, netto: n ? n.netto : 0, std: t.std + t.urlaub + t.krank, anzahl: L.length };
  });
  const jahrB = monate.reduce((a, x) => a + x.brutto, 0), jahrN = monate.reduce((a, x) => a + x.netto, 0), jahrS = monate.reduce((a, x) => a + x.std, 0);
  // Balken Brutto-Aufteilung
  const teile = N ? [['Netto', N.netto, 'k-ur'], ['Steuern', N.steuern, 'k-na'], ['Sozialversicherung', N.sv.summe, 'k-ta']] : [];
  const bsum = teile.reduce((a, t) => a + Math.max(0, t[1]), 0) || 1;
  const stunden = [['Tagschicht', T.tag, 'k-ta'], ['Nachtschicht', T.nacht, 'k-na'], ['Sonntag', T.sonntag, 'k-so'], ['Feiertag', T.feiertag, 'k-kr'], ['Urlaub', T.urlaub, 'k-ur'], ['Krank', T.krank, 'k-gr']];
  const smax = Math.max(1, ...stunden.map((s) => s[1]));
  // Jahresdiagramm (SVG)
  const W = Math.round(Math.max(300, Math.min(960, ($('#inhalt').clientWidth || 640) - 34))), H = 220, pl = 40, pr = 6, pt = 12, pb = 26;
  const vmax = Math.max(100, ...monate.map((x) => x.brutto));
  const schritt = [100, 200, 250, 500, 1000, 2000, 2500, 5000].find((s) => vmax / s <= 5) || 10000;
  const top = Math.ceil(vmax / schritt) * schritt;
  const yS = (v) => pt + (H - pt - pb) * (1 - v / top);
  const bw = (W - pl - pr) / 12;
  const gitter = []; for (let v = 0; v <= top; v += schritt) gitter.push(v);
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="diagramm" role="img" aria-label="Brutto und Netto je Monat ${y}">
    ${gitter.map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${yS(v)}" y2="${yS(v)}" class="gl"/><text x="${pl - 6}" y="${yS(v) + 4}" class="ax" text-anchor="end">${v >= 1000 ? (v / 1000).toLocaleString('de-DE') + ' T' : v}</text>`).join('')}
    ${monate.map((x) => { const x0 = pl + x.i * bw; const w = (bw - 8) / 2; const aktiv = x.i === m - 1;
      return `<g class="mo ${aktiv ? 'akt' : ''}" data-mo="${x.i + 1}"><rect x="${x0}" y="${pt}" width="${bw}" height="${H - pt - pb}" class="hit"/>
      <rect x="${x0 + 3}" y="${yS(x.brutto)}" width="${w}" height="${Math.max(0, yS(0) - yS(x.brutto))}" rx="2" class="b-br"/>
      <rect x="${x0 + 5 + w}" y="${yS(x.netto)}" width="${w}" height="${Math.max(0, yS(0) - yS(x.netto))}" rx="2" class="b-ne"/>
      <text x="${x0 + bw / 2}" y="${H - 8}" class="ax ${aktiv ? 'fett' : ''}" text-anchor="middle">${W < 480 ? MONATE[x.i][0] : MONATE[x.i].slice(0, 3)}</text>
      <title>${MONATE[x.i]}: Brutto ${fe(x.brutto)}, Netto ${fe(x.netto)}, ${fh(x.std)} Std.</title></g>`; }).join('')}
    <line x1="${pl}" x2="${W - pr}" y1="${yS(0)}" y2="${yS(0)}" class="bl"/>
  </svg>`;
  const nd = S.jahr.naechste;
  const dienstTage = new Set(S.schichten.filter(s => s.art === 'dienst').map(s => s.datum));
  const kalenderTage = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const sa = S.schichten.filter(s => s.art === 'dienst' && new Date(s.datum + 'T00:00:00Z').getUTCDay() === 6).length;
  const so = S.schichten.filter(s => s.art === 'dienst' && new Date(s.datum + 'T00:00:00Z').getUTCDay() === 0).length;
  const xTage = new Set(S.schichten.filter(s => String(s.kuerzel || '').toUpperCase() === 'X').map(s => s.datum)).size;
  const freiTage = new Set(S.schichten.filter(s => s.art === 'frei').map(s => s.datum)).size;
  const stunde=new Date().getHours(),anrede=stunde<10?'Guten Morgen':stunde<18?'Guten Tag':'Guten Abend';
  const vorname=String(S.profil?.name||'').trim().split(/\s+/)[0];
  $('#inhalt').innerHTML = `
    <div class="dashboard-hero"><div class="dashboard-hero-copy"><span class="dashboard-eyebrow">Shiftly · ${esc(MONATE[m-1])} ${y}</span><h1>${anrede}${vorname?', '+esc(vorname):''}!</h1><p>Dein Monat, deine Schichten und dein Budget auf einen Blick.</p></div><span class="dashboard-place">⌖ ${esc(currentLocation().label)}</span></div>
    <div class="card monat">
      <button id="m-zur" aria-label="Vormonat">‹</button>
      <div style="text-align:center"><h1>${MONATE[m - 1]} ${y}</h1><div class="hinweis" style="margin:0">${T.dienste} Dienste${T.tageU ? ` · ${T.tageU} Urlaub` : ''}${T.tageK ? ` · ${T.tageK} Krank` : ''}</div><button class="btn klein" id="m-heute" type="button">Aktueller Monat</button> <button class="btn klein" id="dashboard-arrange" type="button" aria-pressed="false">Anordnung ändern</button></div>
      <button id="m-vor" aria-label="Nächster Monat">›</button>
    </div>
    <div class="card day-greeting" id="day-greeting" hidden></div>
    <section class="card dashboard-weather-card"><h2>Wetter &amp; Kleidung</h2><div id="dashboard-weather"></div></section>
    <section class="card dashboard-group"><h2>Dein Monat</h2><div class="kacheln dashboard-main">
      <div class="kachel k-sum"><span class="dashboard-kpi-icon">◷</span><b>${fh(T.std)}</b><span>Arbeitsstunden</span></div>
      <div class="kachel k-tag"><span class="dashboard-kpi-icon">▦</span><b>${dienstTage.size}</b><span>Arbeitstage</span></div>
      <div class="kachel k-ur"><span class="dashboard-kpi-icon">☀</span><b>${kalenderTage - dienstTage.size}</b><span>Tage ohne Dienst</span></div>
      <div class="kachel k-so"><span class="dashboard-kpi-icon">◉</span><b>${sa} / ${so}</b><span>Sa / So Schichten</span></div>
    </div></section>
    ${blickBlock(c, nd)}
    ${urlaubBlock(y, c)}
    <section class="card dashboard-half dashboard-hours"><h2>Stunden &amp; Zuschläge</h2><div class="lohn"><div><span>Tag</span><b>${fh(T.tag)} h</b></div><div><span>Nacht</span><b>${fh(T.nacht)} h</b></div><div><span>Sonntag</span><b>${fh(T.sonntag)} h</b></div><div><span>Feiertag</span><b>${fh(T.feiertag)} h</b></div></div><details class="dashboard-tile-details"><summary>Urlaub und Krankheit in Stunden</summary><div class="lohn"><div><span>Gearbeitet</span><b>${fh(T.std)} h</b></div><div><span>Urlaub</span><b>${fh(T.urlaub)} h</b></div><div><span>Krank</span><b>${fh(T.krank)} h</b></div><div><span>Gesamt</span><b>${fh(T.stdGesamt)} h</b></div></div></details></section>
    <section class="card dashboard-half dashboard-budget-card"><h2>Heute · Budget</h2><div id="dashboard-budget"></div><button class="btn klein dashboard-budget-link" type="button" id="zum-budget">Groschen öffnen</button></section>
    <section class="card dashboard-shortcuts"><h2>Schnellaktionen</h2><div class="dashboard-shortcut-grid"><button type="button" data-shortcut="shift"><span>▦</span>Schicht eintragen</button><button type="button" data-shortcut="vacation"><span>✈</span>Urlaubsantrag</button><button type="button" data-shortcut="expense"><span>€</span>Ausgabe eintragen</button><button type="button" data-shortcut="calendar"><span>◫</span>Kalender öffnen</button></div></section>
    ${checkBlock(c)}
    <section class="card held"><h2>Dein Lohn</h2>
      <div class="held-kopf">
        <div><div class="label">Netto (geschätzt)</div><div class="gross">${N ? fe(N.netto) : '–'}</div></div>
        <div class="held-rechts"><div><span class="label">Brutto</span><b>${fe(T.gesamt)}</b></div><div><span class="label">Abzüge</span><b>${N ? fe(N.steuern + N.sv.summe) : '–'}</b></div></div>
      </div>
      ${N ? `<div class="stapel" role="img" aria-label="Aufteilung des Bruttolohns">${teile.map(([t, v, k]) => v > 0 ? `<span class="${k}" style="flex:${v / bsum}" title="${t}: ${fe(v)}"></span>` : '').join('')}</div>
      <div class="legende">${teile.map(([t, v, k]) => `<span><i class="${k}"></i>${t} <b>${fe(v)}</b></span>`).join('')}</div>`
      : '<p class="hinweis">Die Netto-Berechnung gibt es nur für deutsche Tarifgebiete.</p>'}
      ${N ? `<p class="hinweis">Steuerklasse ${c.stkl}${+c.zkf ? `, ${fh(+c.zkf).replace(',00', '')} Kinderfreibetrag` : ''}${c.kirche ? ', mit Kirchensteuer' : ''}. Davon steuerfrei (§ 3b EStG): ${fe(N.frei.steuer)}. <a href="#" id="zur-steuer">Angaben ändern</a></p>` : ''}
    </section>
    <details class="card dashboard-details"><summary>Weitere Monatswerte</summary><div class="kacheln">
      <div class="kachel k-sum"><b>${fh(T.stdGesamt)}</b><span>Gesamt inkl. Urlaub &amp; Krank</span></div>
      <div class="kachel k-tag"><b>${T.dienste}</b><span>Dienste</span></div>
      <div class="kachel k-sum"><b>${xTage}</b><span>Tage mit X</span></div>
      <div class="kachel k-nacht"><b>${fh(T.nacht)}</b><span>Nachtstunden</span></div>
      <div class="kachel k-fe"><b>${fh(T.sonntag + T.feiertag)}</b><span>Sonn- &amp; Feiertag</span></div>
      <div class="kachel k-ur"><b>${T.tageU} / ${T.tageK}</b><span>Urlaub / Krank (Tage)</span></div>
      <div class="kachel k-tag"><b>${freiTage}</b><span>Frei markiert</span></div>
      <div class="kachel k-sum"><b>${T.std ? fe(N ? N.netto / (T.std + T.urlaub + T.krank) : T.gesamt / T.std) : '–'}</b><span>${N ? 'Netto' : 'Brutto'} je Stunde</span></div>
    </div></details>
    <section class="card"><h2>Groschen · Monatsblick</h2><div class="lohn"><div><span>Fixkosten im Monat</span><b>${fe(fixeAusgaben)}</b></div><div><span>${S.prefs.budget_link && S.prefs.income_mode==='automatic'?'Shiftly-Netto + weitere Einnahmen':'In Groschen eingetragene Einnahmen'}</span><b>${fe((S.prefs.budget_link && S.prefs.income_mode==='automatic'?N?.netto||0:0)+andereEinnahmen)}</b></div></div><p class="hinweis">Die detaillierte Planung und Buchungshistorie findest du in Groschen. Netto aus Shiftly ist eine Schätzung.</p></section>
    <div class="zwei"><details class="card dashboard-details"><summary>Stunden nach Art</summary><div><h2>Stunden im ${MONATE[m-1]}</h2><div class="balken">${stunden.map(([t,v,k])=>`<div class="bz"><span class="bt">${t}</span><span class="bb"><i class="${k}" style="width:${(v/smax)*100}%"></i></span><b>${fh(v)}</b></div>`).join('')}</div><div class="lohn" style="margin-top:10px"><div><span>Gearbeitet</span><b>${fh(T.std)} Std.</b></div><div><span>Urlaub</span><b>${fh(T.urlaub)} Std.</b></div><div><span>Krank</span><b>${fh(T.krank)} Std.</b></div><div class="ges"><span>Gesamt</span><b>${fh(T.stdGesamt)} Std.</b></div></div></div></details></div>
    ${N ? `<details class="card dashboard-details"><summary>Netto-Abrechnung im Detail</summary><div>
      <h2>Netto-Abrechnung ${MONATE[m - 1]} (Schätzung)</h2>
      <div class="lohn">
        <div><span>Bruttolohn</span><span>${fe(N.brutto)}</span></div>
        <div class="klein"><span>davon steuerfreie Zuschläge</span><span>${fe(N.frei.steuer)}</span></div>
        <div><span>Lohnsteuer</span><span>− ${fe(N.lohnsteuer)}</span></div>
        ${N.soli ? `<div><span>Solidaritätszuschlag</span><span>− ${fe(N.soli)}</span></div>` : ''}
        ${c.kirche ? `<div><span>Kirchensteuer</span><span>− ${fe(N.kirche)}</span></div>` : ''}
        <div><span>Krankenversicherung</span><span>− ${fe(N.sv.kv)}</span></div>
        <div><span>Pflegeversicherung</span><span>− ${fe(N.sv.pv)}</span></div>
        <div><span>Rentenversicherung</span><span>− ${fe(N.sv.rv)}</span></div>
        <div><span>Arbeitslosenversicherung</span><span>− ${fe(N.sv.av)}</span></div>
        <div class="ges"><span>Netto</span><span>${fe(N.netto)}</span></div>
      </div>
      <p class="hinweis">Berechnet nach dem amtlichen Lohnsteuer-Programmablaufplan 2026 und den Sozialversicherungssätzen 2026. Einmalzahlungen, Freibeträge auf der Lohnsteuerkarte und Vorschüsse sind nicht enthalten, deshalb kann deine echte Abrechnung abweichen.</p>
    </div></details>` : ''}
    <details class="card dashboard-details"><summary>Jahresverlauf</summary><div>
      <div class="reihe" style="justify-content:space-between;align-items:baseline"><h2 style="margin:0">Jahr ${y}</h2><div class="legende" style="margin:0"><span><i class="b-br"></i>Brutto</span><span><i class="b-ne"></i>Netto</span></div></div>
      <div class="diag-rahmen">${svg}</div>
      <div class="jahr-summe"><div><span class="label">Brutto ${y}</span><b>${fe(jahrB)}</b></div><div><span class="label">Netto ${y}</span><b>${N ? fe(jahrN) : '–'}</b></div><div><span class="label">Stunden ${y}</span><b>${fh(jahrS)}</b></div></div>
      <p class="hinweis">Tippe auf einen Monat, um ihn oben anzuzeigen.</p>
    </div></details>`;
  rememberDetails($('#inhalt'), 'dashboard');
  foldCards($('#inhalt'), 'dashboard', [...$('#inhalt').querySelectorAll('section.card')].map((card,index)=>({index,key:card.querySelector('h2')?.textContent?.trim()||String(index),open:['Nächste Schicht','⏰ Nächste Zeitumstellung','Wetter & Kleidung','Heute · Budget','Dein Monat','Resturlaub','Nächster Urlaub','Meine Urlaubsanträge','Stunden & Zuschläge','Schnellaktionen','Groschen · Monatsblick'].includes(card.querySelector('h2')?.textContent)})));
  const wechsel = async (d) => { const dt = new Date(Date.UTC(y, m - 1 + d, 1)); S.monat = dt.toISOString().slice(0, 7); await ladeMonat(); renderStart(); };
  arrangeDashboard($('#inhalt'),sitzung.user.id);
  $$('[data-shortcut]').forEach(b=>b.onclick=()=>$('#app-quick-sheet [data-quick="'+b.dataset.shortcut+'"]')?.click());
  $('#m-zur').onclick = () => wechsel(-1);
  $('#m-vor').onclick = () => wechsel(1);
  $('#m-heute').onclick = async () => { S.monat = heuteISO().slice(0, 7); await ladeMonat(); renderStart(); };
  $$('[data-mo]').forEach((g) => { g.onclick = async () => { S.monat = `${y}-${pad(+g.dataset.mo)}`; await ladeMonat(); renderStart(); }; });
  if ($('#zum-urlaub')) $('#zum-urlaub').onclick = () => { S.ansicht = 'urlaub'; S.urlaubJahr = y; render(); scrollTo(0, 0); };
  $('#dashboard-vacations-open').onclick=()=>$('#zum-urlaub').click();
  $('#zum-budget').onclick = () => { S.ansicht='budget'; render(); scrollTo(0,0); };
  if ($('#zur-steuer')) $('#zur-steuer').onclick = (e) => { e.preventDefault(); S.ansicht = 'konto'; render(); setTimeout(() => $('#steuer')?.scrollIntoView({ behavior: 'smooth' }), 50); };
  const budgetReady = renderQuickBudget($('#dashboard-budget'),{api,prefs:S.prefs,today:heuteISO,toast});
  const greeting = $('#day-greeting');
  const weather = renderWeather($('#dashboard-weather'),heuteISO).then(w=>{paintWeather(w);return w;});
  const date = heuteISO();
  Promise.all([
    api(`sz_shifts?select=art,beginn,ende&datum=eq.${date}`),
    api(`sz_vacations?select=id&start_date=lte.${date}&end_date=gte.${date}&status=in.(planned,requested,approved,taken)`)
  ]).then(([rows,vacations]) => {
    if (!greeting.isConnected || document.visibilityState === 'hidden' || heuteISO() !== date) return;
    S.greetingPending = false;
    greeting.hidden = false;
    if(showDailyGreeting(greeting,{userId:sitzung.user.id,date,name:S.profil.name,hour:new Date().getHours(),rows,vacation:!!vacations.length})) weather.then(w => updateGreetingWeather(greeting,w));
  }).catch(() => {
    S.greetingPending = false;
    greeting.remove();
  });
  starteBlickUhr();
  await budgetReady;
}

// Auch bei einer auf dem Handy weiterlaufenden App am neuen Tag aktualisieren.
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'hidden') { invalidateWeather();$('#day-greeting')?.remove(); return; }
  const dateLabel=$('#top-date');
  if(dateLabel)dateLabel.textContent=new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
  if(sitzung&&$('#top-location'))refreshLocation(true);
  if(sitzung && S.ansicht === 'start' && (S.dashboardDay !== heuteISO() || S.greetingPending)) renderStart();
});

/* ---------------- Kürzel ---------------- */
const STANDARD_KUERZEL = {
  NT: { art: 'dienst', beginn: '06:00', ende: '18:00', pause: 0 },
  N: { art: 'dienst', beginn: '18:00', ende: '06:00', pause: 0 },
  U: { art: 'urlaub', beginn: null, ende: null, pause: 0 },
  K: { art: 'krank', beginn: null, ende: null, pause: 0 },
  F: { art: 'frei', beginn: null, ende: null, pause: 0 },
};
const kuerzelMap = () => (S.profil?.kuerzel && typeof S.profil.kuerzel === 'object' && (S.profil.kuerzel_customized || Object.keys(S.profil.kuerzel).length) ? S.profil.kuerzel : STANDARD_KUERZEL);
let codeDeleteQueue=Promise.resolve();
function deletePersonalCode(code) {
  const userId=sitzung.user.id;
  const task=codeDeleteQueue.then(async()=>{
    const profile=(await api(`sz_profile?select=*&user_id=eq.${userId}`))[0];
    if(!profile)throw new Error('Dein Profil konnte nicht geladen werden. Das Kürzel wurde nicht gelöscht.');
    const current=profile.kuerzel_customized||Object.keys(profile.kuerzel||{}).length?profile.kuerzel||{}:STANDARD_KUERZEL;
    const next={...current};delete next[code];
    const saved=(await api(`sz_profile?user_id=eq.${userId}`,{method:'PATCH',body:{kuerzel:next,kuerzel_customized:true,updated_at:new Date().toISOString()},prefer:'return=representation'}))[0];
    if(!saved||Object.hasOwn(saved.kuerzel||{},code)||!saved.kuerzel_customized)throw new Error('Die Löschung wurde nicht bestätigt. Bitte erneut versuchen.');
    S.profil=saved;S.stempel=null;S.wunschStempel=null;if(!next[S.form.kuerzel])S.form.kuerzel=null;
  });
  codeDeleteQueue=task.catch(()=>{});return task;
}

function kat(k) {
  if (!k) return 'leer';
  if (k.art === 'urlaub') return 'ur';
  if (k.art === 'krank') return 'kr';
  if (k.art === 'frei') return 'frei';
  const b = minuten(k.beginn || '00:00');
  return b >= 16 * 60 || b < 4 * 60 ? 'na' : 'ta';
}
const katEintrag = (sh) => (sh.art === 'urlaub' ? 'ur' : sh.art === 'krank' ? 'kr' : sh.art === 'frei' ? 'frei' : kat({ art: 'dienst', beginn: hm(sh.beginn) }));
const kuerzelText = (code, k) => k.art === 'dienst' ? `${k.beginn}–${k.ende}` : ART[k.art];
function eintragAus(code, datum) {
  const k = kuerzelMap()[code]; const c = cfg();
  if (!k) return null;
  if (k.art === 'dienst') return { datum, art: 'dienst', beginn: k.beginn, ende: k.ende, pause_min: +k.pause || 0, stunden: null, kuerzel: code, notiz: null };
  if (k.art === 'frei') return { datum, art: 'frei', beginn: null, ende: null, pause_min: 0, stunden: 0, kuerzel: code, notiz: null };
  return { datum, art: k.art, beginn: null, ende: null, pause_min: 0, stunden: +(k.art === 'urlaub' ? c.urlaub_std : c.krank_std), kuerzel: code, notiz: null };
}
const isoAus = (t) => new Date(t).toISOString().slice(0, 10);
const tageZwischen = (von, bis) => { const L = []; for (let t = Date.parse(von + 'T00:00:00Z'); t <= Date.parse(bis + 'T00:00:00Z'); t += 86400000) L.push(isoAus(t)); return L; };
function frageDoppeltesKuerzel(code, tag) {
  return new Promise((fertig) => {
    const box = document.createElement('div');
    box.className = 'ul-dlg';
    box.innerHTML = `<div class="ul-box" role="dialog" aria-modal="true" aria-label="Kürzel schon vorhanden">
      <div class="ul-kopf"><b>${esc(code)} am ${datumDE(tag)}</b></div>
      <div class="ul-rumpf"><p>Dieses Kürzel steht hier schon. Was möchtest du tun?</p></div>
      <div class="ul-fuss"><button class="btn" data-wahl="abbrechen">Abbrechen</button><button class="btn rot" data-wahl="loeschen">Eintrag löschen</button><button class="btn pri" data-wahl="eintragen">Weitere Schicht eintragen</button></div></div>`;
    const schliessen = (wert) => { box.remove(); fertig(wert); };
    box.querySelectorAll('[data-wahl]').forEach((b) => b.onclick = () => schliessen(b.dataset.wahl));
    box.onclick = (e) => { if (e.target === box) schliessen('abbrechen'); };
    box.onkeydown = (e) => { if (e.key === 'Escape') schliessen('abbrechen'); };
    document.body.appendChild(box);
    box.querySelector('[data-wahl="abbrechen"]').focus();
  });
}

/* ---------------- Stundenzettel ---------------- */
let warteschlange = Promise.resolve();
const pendingVacationDates=new Set();let vacationPromptTimer;
function scheduleVacationRequest(dates,delay=1700){
  dates.forEach(d=>pendingVacationDates.add(d));clearTimeout(vacationPromptTimer);
  vacationPromptTimer=setTimeout(async()=>{
    const dates=[...pendingVacationDates];pendingVacationDates.clear();
    if(S.ansicht!=='zettel')return;
    try{await warteschlange;await antragAusKalender({api,S,esc,toast,ladePdfLib,render,ladeMonat},dates);}catch(e){toast(e.message);}
  },delay);
}

function kalenderEintragLoeschen(tag, code = null) {
  const index = S.schichten.findLastIndex(s => s.datum === tag && (!code || s.kuerzel === code));
  if (index < 0) return;
  S.schichten = S.schichten.filter((_, i) => i !== index);
  renderZettel();
  warteschlange = warteschlange.then(async () => {
    const rows = await api(`sz_shifts?select=id,kuerzel&datum=eq.${tag}&order=created_at.desc`);
    const ziel = rows.find(s => !code || s.kuerzel === code);
    if (ziel) { await api(`sz_shifts?id=eq.${ziel.id}`, { method: 'DELETE' });
      S.jahr=null;S.urlaubInfo=null;await ladeMonat();if(S.ansicht==='zettel')renderZettel();
    }
  }).catch((e) => { toast(e.message); });
  clearTimeout(renderZettel.nach);
  renderZettel.nach = setTimeout(() => warteschlange.then(async () => { await ladeMonat(); if (S.ansicht === 'zettel') renderZettel(); }), 700);
}
function renderZettel() {
  const [y, m] = S.monat.split('-').map(Number);
  const { c, zeilen, T } = monatDaten();
  const gesperrt = !S.zugang?.access;
  const b = S.bearbeite;
  const f = S.form;
  const art = b ? (b.art || 'dienst') : f.art;
  const R = REGIONEN[c.region];
  const km = kuerzelMap();
  const codes = Object.entries(km);
  // Kalender
  const erster = new Date(Date.UTC(y, m - 1, 1)), dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const versatz = (erster.getUTCDay() + 6) % 7;
  const heute = heuteISO();
  const zellen = [];
  for (let i = 0; i < versatz; i++) zellen.push('<div class="kt leer"></div>');
  for (let d = 1; d <= dim; d++) {
    const iso = `${S.monat}-${pad(d)}`;
    const eintr = S.schichten.filter((s) => s.datum === iso);
    const fn = feiertagName(c.region, Date.parse(iso + 'T00:00:00Z'));
    const so = new Date(iso + 'T00:00:00Z').getUTCDay() === 0;
    zellen.push(`<button class="kt ${fn || so ? 'rot' : ''} ${fn ? 'calendar-holiday' : ''} ${iso === heute ? 'heute' : ''}" data-tag="${iso}" title="${esc(fn || '')}" aria-label="${datumDE(iso)}${fn ? ', ' + esc(fn) : ''}">
      <span class="kn">${d}</span>${fn ? '<span class="kf">FT</span>' : ''}
      ${eintr.map((s) => `<span class="kc k-${katEintrag(s)}">${esc(s.kuerzel || (s.art === 'dienst' ? hm(s.beginn) : ART[s.art][0]))}</span>`).join('')}
    </button>`);
  }
  $('#inhalt').innerHTML = `
    ${gesperrt ? `<div class="banner warn">Dein Testzeitraum ist abgelaufen. Du kannst deine Stundenzettel weiter ansehen und als PDF speichern. Neue Einträge kannst du mit einem Abo machen. <button class="btn klein pri" id="zum-abo">Abo ansehen</button></div>` : ''}
    <div class="calendar-heading"><h1>Urlaub &amp; Kalender</h1><div class="calendar-tabs" aria-label="Kalenderbereiche"><a href="#kuerzel-kalender" aria-current="page">Kürzelkalender</a><a href="#stundenzettel-liste">Meine Schichten</a><button type="button" id="calendar-vacation">Urlaub</button></div></div>
    <div class="card monat">
      <button id="m-zur" aria-label="Vormonat">‹</button>
      <div style="text-align:center"><h1>${MONATE[m - 1]} ${y}</h1><div class="hinweis" style="margin:0">${T.dienste} Dienste${T.tageU ? ` · ${T.tageU} Urlaub` : ''}${T.tageK ? ` · ${T.tageK} Krank` : ''} · ${esc(R?.n || c.region)}</div><button class="btn klein" id="zettel-heute" type="button">Heute</button></div>
      <button id="m-vor" aria-label="Nächster Monat">›</button>
    </div>
    <div class="kacheln">
      <div class="kachel k-sum"><b>${fh(T.std)}</b><span>Arbeitsstunden</span></div>
      <div class="kachel k-sum"><b>${fe(T.gesamt)}</b><span>Lohn brutto</span></div>
    </div>
    <details class="card dashboard-details"><summary>Weitere Stunden und Zuschläge</summary><div class="kacheln">
      <div class="kachel k-tag"><b>${fh(T.tag)}</b><span>Tagschicht</span></div>
      <div class="kachel k-nacht"><b>${fh(T.nacht)}</b><span>Nachtschicht</span></div>
      <div class="kachel k-so"><b>${fh(T.sonntag)}</b><span>Sonntag</span></div>
      <div class="kachel k-fe"><b>${fh(T.feiertag)}</b><span>Feiertag</span></div>
      <div class="kachel k-ur"><b>${fh(T.urlaub)}</b><span>Urlaub (${T.tageU} ${T.tageU === 1 ? 'Tag' : 'Tage'})</span></div>
      <div class="kachel k-ur"><b>${fh(T.krank)}</b><span>Krank (${T.tageK} ${T.tageK === 1 ? 'Tag' : 'Tage'})</span></div>
      <div class="kachel k-sum"><b>${fh(T.stdGesamt)}</b><span>Gesamt inkl. Urlaub &amp; Krank</span></div>
    </div></details>
    <section class="card" id="kuerzel-kalender">
      <h2>Kalender</h2><button class="btn klein" id="calendar-manage-codes">Kürzel verwalten / löschen</button>
      ${S.objekte.length ? `<label style="display:block;max-width:420px;margin-bottom:10px">Hier arbeitest du<select id="stempel-objekt"><option value="" ${!f.object_id ? 'selected' : ''}>${esc(S.profil?.objekt || 'Standardtarif')}</option>${S.objekte.filter(o => o.aktiv || o.id === f.object_id).map(o => `<option value="${o.id}" ${o.id === f.object_id ? 'selected' : ''}>${esc(o.name)} · ab ${datumDE(o.gueltig_ab)}</option>`).join('')}</select><small data-object-rate="quick">${esc(objektTarifText(f.object_id))}</small></label>` : ''}
      <div class="stempel" role="group" aria-label="Kürzel zum Eintragen">
        ${codes.map(([code, k]) => `<button class="st k-${kat(k)} ${S.stempel === code ? 'an' : ''}" data-stempel="${esc(code)}"><b>${esc(code)}</b><small>${esc(kuerzelText(code, k))}</small></button>`).join('')}
        <button class="st k-leer ${S.stempel === '__leer' ? 'an' : ''}" data-stempel="__leer"><b>✕</b><small>Leeren</small></button>
      </div>
      <p class="hinweis" style="margin:4px 0 10px">${S.stempel ? (S.stempel === '__leer' ? 'Tippe auf einen Tag: Pro Tipp wird ein Eintrag ohne Rückfrage gelöscht.' : `Tippe auf alle Tage mit <b>${esc(S.stempel)}</b>. Nochmal auf das Kürzel oben tippen beendet das Eintragen.`) : 'Kürzel oben antippen und dann die Tage im Kalender antippen. Ohne Kürzel öffnet ein Tipp auf einen Tag das Formular.'}</p>
      <div class="kal">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w, i) => `<div class="kw ${i === 6 ? 'rot' : ''}">${w}</div>`).join('')}${zellen.join('')}</div>
      <div class="wish-holiday-legend"><b><span class="wish-holiday-mark">FT</span> Feiertage · ${esc(R?.n || c.region)}</b>${Array.from({length:dim},(_,i)=>`${S.monat}-${pad(i+1)}`).map(iso=>({iso,name:feiertagName(c.region,Date.parse(iso+'T00:00:00Z'))})).filter(d=>d.name).map(d=>`<span>${datumDE(d.iso)} · ${esc(d.name)}</span>`).join('') || '<span>In diesem Monat gibt es hier keine gesetzlichen Feiertage.</span>'}</div>
      <p class="hinweis">Kürzel und Zeiten legst du unter „Konto &amp; Tarif“ fest. <span class="lg k-ta">Tag</span> <span class="lg k-na">Nacht</span> <span class="lg k-ur">Urlaub</span> <span class="lg k-kr">Krank</span> <span class="lg k-frei">Frei</span> · Rot = Sonntag · Gold mit FT = Feiertag</p>
    </section>
    <section class="card" id="formular">
      <h2>${b ? 'Eintrag ändern' : 'Eintrag hinzufügen'}</h2>
      <div class="stempel klein" style="margin-bottom:10px">${codes.map(([code, k]) => `<button type="button" class="st k-${kat(k)} ${(b ? b.kuerzel : f.kuerzel) === code ? 'an' : ''}" data-fk="${esc(code)}"><b>${esc(code)}</b><small>${esc(kuerzelText(code, k))}</small></button>`).join('')}</div>
      <div class="tabs" role="tablist" style="margin-bottom:12px">${Object.entries(ART).map(([k, t]) => `<button type="button" data-art="${k}" aria-selected="${art === k}">${t}</button>`).join('')}</div>
      <form class="reihe" id="f-schicht">
        <label style="flex:1 1 150px">${b || !f.mehr ? (art === 'dienst' ? 'Datum (Dienstbeginn)' : 'Datum') : 'von'}<input id="s-datum" type="date" required value="${b ? b.datum : f.datum}"></label>
        ${!b && f.mehr ? `<label style="flex:1 1 150px">bis<input id="s-bis" type="date" required value="${f.bis || ''}"></label>` : ''}
        ${art === 'dienst' ? `
        <label style="flex:1 1 220px">Hier arbeitest du<select id="s-objekt"><option value="" ${!((b ? b.object_id : f.object_id)) ? 'selected' : ''}>${esc(S.profil?.objekt || 'Standardtarif')}</option>${S.objekte.filter(o => o.aktiv || o.id === b?.object_id || o.id === f.object_id).map(o => `<option value="${o.id}" ${o.id === ((b ? b.object_id : f.object_id)) ? 'selected' : ''}>${esc(o.name)} · ab ${datumDE(o.gueltig_ab)}</option>`).join('')}</select><small data-object-rate="form">${esc(objektTarifText(b ? b.object_id : f.object_id, b))}</small></label>
        <label style="flex:1 1 105px">Beginn<input id="s-beginn" type="time" required value="${b ? hm(b.beginn) : f.beginn}"></label>
        <label style="flex:1 1 105px">Ende<input id="s-ende" type="time" required value="${b ? hm(b.ende) : f.ende}"></label>
        <label style="flex:1 1 105px">Pause (Min.)<input id="s-pause" type="number" min="0" max="600" step="5" inputmode="numeric" value="${b ? b.pause_min : f.pause}"></label>`
        : art === 'frei' ? '<span class="hinweis">Frei · 0 Stunden, kein Lohn und kein Urlaubsabzug</span>'
        : `<label style="flex:1 1 130px">Stunden pro Tag<input id="s-std" type="number" min="0" max="24" step="0.01" inputmode="decimal" value="${b?.stunden ?? (art === 'urlaub' ? c.urlaub_std : c.krank_std)}"></label>`}
        <label style="flex:2 1 180px">Notiz (optional)<input id="s-notiz" maxlength="200" value="${esc(b?.notiz || '')}"></label>
        ${!b ? `<div class="wochentage" style="flex:1 1 100%">
          <label class="check" style="margin:0"><input type="checkbox" id="s-mehr" ${f.mehr ? 'checked' : ''}> Für mehrere Tage wiederholen</label>
          ${f.mehr ? `<div class="wt">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w, i) => `<button type="button" class="wtb ${f.wt[i] ? 'an' : ''}" data-wt="${i}">${w}</button>`).join('')}</div>
          <p class="hinweis" style="margin:4px 0 0">Nur an den markierten Wochentagen.${art === 'urlaub' ? ' Sonntage und Feiertage werden beim Urlaub automatisch ausgelassen.' : ''} Vorhandene Einträge bleiben erhalten.</p>` : ''}
        </div>` : ''}
        <button class="btn pri" type="submit" ${gesperrt ? 'disabled' : ''}>${b ? 'Änderung speichern' : 'Speichern'}</button>
        ${b ? '<button class="btn" type="button" id="s-abbruch">Abbrechen</button><button class="btn rot" type="button" id="s-loeschen">Löschen</button>' : ''}
      </form>
      <p class="hinweis">${art === 'dienst' ? 'Endet der Dienst vor dem Beginn (z. B. 18:00–06:00), wird automatisch über Mitternacht gerechnet. Die Pause wird anteilig von allen Stundenarten abgezogen.' : art === 'urlaub' ? 'Urlaub wird mit Stunden × Stundenlohn bezahlt. An Sonntagen und Feiertagen zählt kein Urlaub.' : art === 'krank' ? 'Krankheit wird mit Stunden × Stundenlohn bezahlt.' : 'Frei markiert einen freien Tag und zählt weder als Arbeitszeit noch als Urlaub oder Krankheit.'}</p>
    </section>
    <section class="card" id="stundenzettel-liste">
      <div class="reihe" style="justify-content:space-between;margin-bottom:8px"><h2 style="margin:0">Stundenzettel</h2><button class="btn pri" id="pdf-vorschau">Vorschau &amp; PDF</button></div>
      <div class="tabelle"><table class="zettel">
        <thead><tr><th class="l">Datum</th><th class="l">Art / Zeit</th><th>Pause</th><th>Std.</th><th>Tag</th><th>Nacht</th><th>Sonntag</th><th>Feiertag</th><th>Urlaub</th><th>Krank</th><th>Lohn</th></tr></thead>
        <tbody>${zeilen.length ? zeilen.map(([sh, r]) => `
          <tr data-id="${sh.id}" class="${sh.art !== 'dienst' ? 'z-' + sh.art : ''}">
            <td class="l"><b>${wtag(sh.datum)} ${datumDE(sh.datum).slice(0, 6)}</b>${bemerkung(sh, r) ? `<div class="unter">${esc(bemerkung(sh, r))}</div>` : ''}</td>
            <td class="l">${esc(artZeit(sh, r))}${sh.art === 'dienst' ? `<div class="unter">${esc(objektName(sh))}</div>` : ''}</td>
            <td>${sh.art === 'dienst' && sh.pause_min ? sh.pause_min + ' min' : '–'}</td>
            <td><b>${fz(r.std)}</b></td><td>${fz(r.tag)}</td><td class="c-n">${fz(r.nacht)}</td><td class="c-s">${fz(r.sonntag)}</td><td class="c-f">${fz(r.feiertag)}</td>
            <td class="c-u">${fz(r.urlaub)}</td><td class="c-u">${fz(r.krank)}</td>
            <td>${fe(r.gesamt)}</td></tr>`).join('') : '<tr><td colspan="11" class="leer">Für diesen Monat gibt es noch keine Einträge. Tippe ein Kürzel und dann die Tage im Kalender an.</td></tr>'}</tbody>
        <tfoot><tr><td class="l">Summe</td><td class="l">${zeilen.length} Einträge</td><td>${T.pause ? T.pause + ' min' : '–'}</td><td>${fh(T.std)}</td><td>${fh(T.tag)}</td><td class="c-n">${fh(T.nacht)}</td><td class="c-s">${fh(T.sonntag)}</td><td class="c-f">${fh(T.feiertag)}</td><td class="c-u">${fh(T.urlaub)}</td><td class="c-u">${fh(T.krank)}</td><td>${fe(T.gesamt)}</td></tr>
        <tr class="gesamtzeile"><td class="l" colspan="3">Gesamt (Arbeit + Urlaub + Krank)</td><td>${fh(T.stdGesamt)}</td><td colspan="7" class="l hinweis">${fh(T.std)} Arbeit + ${fh(T.urlaub)} Urlaub + ${fh(T.krank)} Krank</td></tr></tfoot>
      </table></div>
    </section>
    <section class="card">
      <h2>Lohnaufstellung (brutto)</h2>
      <div class="lohn">
        ${lohnZeilen(T, c).map(([t, v]) => `<div><span>${esc(t)}</span><span>${fe(v)}</span></div>`).join('')}
        <div class="ges"><span>Gesamt brutto</span><span>${fe(T.gesamt)}</span></div>
        ${(() => { const N = nettoFuer(T, c); return N ? `<div><span>Steuern (Lohnsteuer, Soli${c.kirche ? ', Kirche' : ''})</span><span>− ${fe(N.steuern)}</span></div><div><span>Sozialversicherung</span><span>− ${fe(N.sv.summe)}</span></div><div class="ges"><span>Netto (geschätzt)</span><span>${fe(N.netto)}</span></div>` : ''; })()}
      </div>
      <p class="hinweis">Richtwerte ohne Gewähr. Maßgeblich sind dein Arbeitsvertrag, der Tarifvertrag und die Lohnabrechnung. Die Netto-Einzelheiten siehst du in der Übersicht.</p>
    </section>`;
  rememberDetails($('#inhalt'), 'dienstplan');
  foldCards($('#inhalt'), 'dienstplan', [
    {index:0,key:'kalender',label:'Kalender und Kürzel',open:true},
    {index:1,key:'eintrag',label:b?'Eintrag ändern':'Eintrag hinzufügen'},
    {index:2,key:'stundenzettel'},
    {index:3,key:'lohn',label:'Lohnaufstellung'}
  ]);

  const wechsel = async (d) => { const dt = new Date(Date.UTC(y, m - 1 + d, 1)); S.monat = dt.toISOString().slice(0, 7); S.bearbeite = null; S.form.datum = S.monat === heute.slice(0, 7) ? heute : S.monat + '-01'; await ladeMonat(); render(); };
  $('#m-zur').onclick = () => wechsel(-1);
  $('#m-vor').onclick = () => wechsel(1);
  $('#zettel-heute').onclick = async () => { S.monat = heuteISO().slice(0,7); await ladeMonat(); renderZettel(); };
  $('#calendar-manage-codes').onclick=()=>{merkeForm();S.ansicht='konto';render();const target=$('#kz-body')?.closest('.card');openFold(target);target?.scrollIntoView({behavior:'smooth',block:'start'});};
  $('#calendar-vacation').onclick=()=>{S.ansicht='urlaub';S.urlaubJahr=y;render();scrollTo(0,0);};
  $$('.calendar-tabs a').forEach(link=>link.onclick=e=>{e.preventDefault();const target=$(link.getAttribute('href'));openFold(target);target?.scrollIntoView({behavior:'smooth',block:'start'});$$('.calendar-tabs a').forEach(a=>a.removeAttribute('aria-current'));link.setAttribute('aria-current','page');});
  if ($('#zum-abo')) $('#zum-abo').onclick = () => { S.ansicht = 'konto'; render(); };
  // Stempel wählen
  const chooseObject = (e, editing = false) => {
    const id = e.target.value || null;
    if (!editing) merkeObjekt(id);
    else S.bearbeite = { ...b, object_id: id, rate_snapshot: id ? objectRates(S.objekte.find(o => o.id === id), b.object_id === id ? b.rate_snapshot : null) : null };
    if (!b) {
      for (const selector of ['#s-objekt', '#stempel-objekt']) if ($(selector)) $(selector).value = id || '';
      $$('[data-object-rate]').forEach(el => el.textContent = objektTarifText(id));
    } else {
      const hint = $('[data-object-rate="form"]');
      if (hint && editing) hint.textContent = objektTarifText(id, b);
      if (!editing) $('[data-object-rate="quick"]').textContent = objektTarifText(id);
    }
  };
  if ($('#stempel-objekt')) $('#stempel-objekt').onchange = e => chooseObject(e);
  if ($('#s-objekt')) $('#s-objekt').onchange = e => chooseObject(e, !!b);
  $$('[data-stempel]').forEach((el) => { el.onclick = () => { S.stempel = S.stempel === el.dataset.stempel ? null : el.dataset.stempel; renderZettel(); }; });
  // Kalendertag antippen
  $$('[data-tag]').forEach((el) => { el.onclick = async () => {
    const tag = el.dataset.tag;
    if (!S.stempel) {
      const vorhanden = S.schichten.find((s) => s.datum === tag);
      if (vorhanden) S.bearbeite = vorhanden; else { S.bearbeite = null; S.form.datum = tag; S.form.mehr = false; }
      renderZettel(); openFold($('#formular')); $('#formular').scrollIntoView({ behavior: 'smooth', block: 'start' }); return;
    }
    if (gesperrt) { toast('Dein Testzeitraum ist abgelaufen.'); return; }
    const neu = S.stempel === '__leer' ? null : eintragAus(S.stempel, tag);
    if (neu?.art === 'dienst') {
      const zuordnung = objektZuordnung(S.form.object_id, tag);
      if (zuordnung.error) { toast(zuordnung.error); return; }
      Object.assign(neu, zuordnung);
    }
    if (neu && neu.art === 'urlaub' && !urlaubArbeitstag(c, tag)) { toast('Kein Urlaubstag: frei laut Urlaubsarbeitstagen, Sonntag oder Feiertag.'); return; }
    const amTag = S.schichten.filter(s => s.datum === tag);
    if (!neu) { kalenderEintragLoeschen(tag); return; }
    const gleichesKuerzel = amTag.some(s => s.kuerzel === neu.kuerzel);
    if (gleichesKuerzel) {
      if (neu.art === 'urlaub') { toast('Urlaub ist an diesem Tag bereits eingetragen. Zum Ändern bitte den Eintrag öffnen oder das Löschkürzel verwenden.'); return; }
      const wahl = await frageDoppeltesKuerzel(neu.kuerzel, tag);
      if (wahl === 'loeschen') { kalenderEintragLoeschen(tag, neu.kuerzel); return; }
      if (wahl !== 'eintragen') return;
    }
    const gestern = tagKey(Date.parse(tag + 'T00:00:00Z') - 86400000);
    const vorige = neu?.art === 'dienst' ? await api(`sz_shifts?select=datum,art,beginn,ende&datum=eq.${gestern}`).catch(()=>[]) : [];
    if (!gleichesKuerzel && (amTag.length || vorige.some(s=>ueberschneidet(neu,s))) && !confirm('Für diesen Tag oder Zeitraum existiert bereits eine Schicht. Möchtest du die zweite Schicht trotzdem speichern?')) return;
    try { const fehler = await pruefeUrlaubUeberschneidung([neu]); if (fehler) { toast(fehler); return; } } catch(e) { toast(e.message); return; }
    if (neu.art === 'urlaub' && S.schichten.some(s=>s.art==='urlaub' && s.datum===tag)) { toast('Urlaub ist an diesem Tag bereits eingetragen.'); return; }
    // sofort anzeigen, dann speichern
    const alt = S.schichten;
    S.schichten = S.schichten.concat([{ ...neu, id: 'tmp-' + tag + '-' + Date.now() }]).sort((a, b2) => (a.datum + hm(a.beginn)).localeCompare(b2.datum + hm(b2.beginn)));
    renderZettel();
    warteschlange = warteschlange.then(async () => {
      try {
        const fehler = await pruefeUrlaubUeberschneidung([neu]); if (fehler) throw new Error(fehler);
        await api('sz_shifts', { method: 'POST', body: neu, prefer: 'return=minimal' });
        if(neu.art==='urlaub')scheduleVacationRequest([tag]);
      } catch (e) { S.schichten = alt; toast(e.message); }
    });
    clearTimeout(renderZettel.nach); renderZettel.nach = setTimeout(() => warteschlange.then(async () => { await ladeMonat(); if (S.ansicht === 'zettel') renderZettel(); }), 1500);
  }; });
  // Formular
  $$('[data-fk]').forEach((el) => { el.onclick = () => {
    const k = km[el.dataset.fk]; if (!k) return;
    if (b) { S.bearbeite = { ...b, kuerzel: el.dataset.fk, art: k.art, ...(k.art === 'dienst' ? { beginn: k.beginn, ende: k.ende, pause_min: k.pause || 0 } : { beginn: null, ende: null }) }; }
    else { S.form.kuerzel = el.dataset.fk; S.form.art = k.art; if (k.art === 'dienst') { S.form.beginn = k.beginn; S.form.ende = k.ende; S.form.pause = k.pause || 0; } if (k.art === 'urlaub') S.form.wt = [1, 1, 1, 1, 1, 1, 0]; }
    merkeForm(); renderZettel();
  }; });
  $$('[data-art]').forEach((t) => { t.onclick = () => { merkeForm(); if (b) S.bearbeite = { ...b, art: t.dataset.art, kuerzel: null }; else { S.form.art = t.dataset.art; S.form.kuerzel = null; if (t.dataset.art === 'urlaub') S.form.wt = [1, 1, 1, 1, 1, 1, 0]; } renderZettel(); }; });
  if ($('#s-mehr')) $('#s-mehr').onchange = (e) => { merkeForm(); S.form.mehr = e.target.checked; if (S.form.mehr && !S.form.bis) S.form.bis = isoAus(Date.UTC(y, m, 0)); renderZettel(); };
  $$('[data-wt]').forEach((el) => { el.onclick = () => { merkeForm(); S.form.wt[+el.dataset.wt] = S.form.wt[+el.dataset.wt] ? 0 : 1; renderZettel(); }; });
  $$('tbody tr[data-id]').forEach((tr) => { tr.onclick = () => { const s = S.schichten.find((x) => x.id === tr.dataset.id); if (!s || String(s.id).startsWith('tmp-')) return; S.bearbeite = s; renderZettel(); openFold($('#formular')); $('#formular').scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
  if ($('#s-abbruch')) $('#s-abbruch').onclick = () => { S.bearbeite = null; renderZettel(); };
  if ($('#s-loeschen')) $('#s-loeschen').onclick = async (ev) => {
    try { await api(`sz_shifts?id=eq.${b.id}`, { method: 'DELETE' }); S.bearbeite = null;S.jahr=null;S.urlaubInfo=null;await ladeMonat();render();toast(b.art==='urlaub'?'Urlaub und zugehöriger Antrag gelöscht':'Eintrag gelöscht'); } catch (e) { toast(e.message); }
  };
  $('#f-schicht').onsubmit = async (ev) => {
    ev.preventDefault();
    merkeForm();
    const datum = $('#s-datum').value, notiz = $('#s-notiz').value.trim() || null;
    let vorlage;
    if (art === 'dienst') {
      vorlage = { art, beginn: $('#s-beginn').value, ende: $('#s-ende').value, pause_min: Math.max(0, parseInt($('#s-pause').value || '0', 10)), stunden: null, kuerzel: (b ? b.kuerzel : f.kuerzel) || null, notiz };
      const objectId = $('#s-objekt').value || null;
      const zuordnung = objektZuordnung(objectId, datum, b);
      if (zuordnung.error) { toast(zuordnung.error); return; }
      Object.assign(vorlage, zuordnung);
      if (vorlage.beginn === vorlage.ende) { toast('Beginn und Ende sind gleich – bitte Zeiten prüfen.'); return; }
      const kk = vorlage.kuerzel && km[vorlage.kuerzel];
      if (kk && (kk.beginn !== vorlage.beginn || kk.ende !== vorlage.ende)) vorlage.kuerzel = null;
    } else {
      const st = art === 'frei' ? 0 : parseFloat(String($('#s-std').value).replace(',', '.'));
      if (!Number.isFinite(st) || st < 0 || st > 24) { toast('Bitte Stunden zwischen 0 und 24 eintragen.'); return; }
      vorlage = { art, beginn: null, ende: null, pause_min: 0, stunden: st, object_id: null, rate_snapshot: null, kuerzel: (b ? b.kuerzel : f.kuerzel) || null, notiz };
      const kk = vorlage.kuerzel && km[vorlage.kuerzel];
      if (kk && kk.art !== art) vorlage.kuerzel = null;
    }
    let tage = [datum];
    if (!b && f.mehr) {
      const bis = $('#s-bis').value;
      if (!bis || bis < datum) { toast('„bis“ muss nach dem Startdatum liegen.'); return; }
      if ((Date.parse(bis) - Date.parse(datum)) / 86400000 > 92) { toast('Bitte höchstens 3 Monate auf einmal eintragen.'); return; }
      tage = tageZwischen(datum, bis).filter((d) => f.wt[(new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7]);
    }
    let ausgelassen = 0;
    if (art === 'urlaub') { const vor = tage.length; tage = tage.filter((d) => urlaubArbeitstag(c, d)); ausgelassen = vor - tage.length; }
    if (!tage.length) { toast(art === 'urlaub' ? 'An diesen Tagen ist laut deinen Einstellungen kein Urlaubstag – kein Urlaub eingetragen.' : 'Keine Tage ausgewählt.'); return; }
    try {
      const fehler = await pruefeUrlaubUeberschneidung(tage.map(d=>({datum:d,...vorlage})),b?.id);
      if (fehler) { toast(fehler); return; }
      if (b) {
        const von = tagKey(Date.parse(datum + 'T00:00:00Z') - 86400000);
        const bis = tagKey(Date.parse(datum + 'T00:00:00Z') + 86400000);
        const andere = (await api(`sz_shifts?select=id,datum,art,beginn,ende&datum=gte.${von}&datum=lte.${bis}`)).filter(s => s.id !== b.id);
        if (andere.some(s => ueberschneidet({ datum, ...vorlage }, s) || s.datum === datum) &&
          !confirm('Für diesen Zeitraum existiert bereits eine Schicht. Änderung trotzdem speichern?')) return;
        await api(`sz_shifts?id=eq.${b.id}`, { method: 'PATCH', body: { datum, ...vorlage } });
      }
      else {
        const von = tagKey(Date.parse(tage[0] + 'T00:00:00Z') - 86400000), bis = tage[tage.length - 1];
        const vorhandene = await api(`sz_shifts?select=id,datum,art,beginn,ende&datum=gte.${von}&datum=lte.${bis}`);
        const kandidaten = tage.map(d => ({ datum: d, ...vorlage }));
        const kollisionen = vorhandene.filter(s => kandidaten.some(k => ueberschneidet(k, s) || k.datum === s.datum));
        if (kollisionen.length && !confirm(`Für ${kollisionen.length} vorhandene Schicht(en) gibt es am selben Tag oder im selben Zeitraum einen weiteren Eintrag. Zweite Schicht trotzdem speichern?`)) return;
        await api('sz_shifts', { method: 'POST', body: tage.map((d) => ({ datum: d, ...vorlage })), prefer: 'return=minimal' });
      }
      S.bearbeite = null;
      if (datum.slice(0, 7) !== S.monat) S.monat = datum.slice(0, 7);
      await ladeMonat(); render();
      if(art==='urlaub')scheduleVacationRequest(tage,100);
      toast(b ? 'Eintrag geändert' : tage.length > 1 ? `${tage.length} Tage gespeichert${ausgelassen ? `, ${ausgelassen} Sonn-/Feiertage ausgelassen` : ''}` : 'Gespeichert');
    } catch (e) { toast(e.message); }
  };
  $('#pdf-vorschau').onclick = zeigeVorschau;
}
function merkeForm() {
  if (S.bearbeite) return;
  const v = (id) => $(id)?.value;
  if (v('#s-datum')) S.form.datum = v('#s-datum');
  if (v('#s-bis')) S.form.bis = v('#s-bis');
  if (v('#s-objekt') != null) merkeObjekt(v('#s-objekt'));
  if (v('#s-beginn')) S.form.beginn = v('#s-beginn');
  if (v('#s-ende')) S.form.ende = v('#s-ende');
  if (v('#s-pause') != null) S.form.pause = +v('#s-pause') || 0;
}

/* ---------------- Vorschau & PDF ---------------- */
// ag = true: Version für den Arbeitgeber – nur Stunden, keine Geldbeträge
function pdfDaten(ag = false) {
  const [y, m] = S.monat.split('-').map(Number);
  const { c, zeilen, T } = monatDaten();
  const R = REGIONEN[c.region];
  const kopf = [['Name', c.name || ''], ['Personal-Nr.', c.personalnr || ''], ['Firma', c.firma || ''], ['Objekt', c.objekt || '']];
  if (!ag) kopf.push(['Stundenlohn', fe(+c.lohn)]);
  kopf.push(['Tarifgebiet', R?.n || c.region]);
  if (!ag && +c.objektzulage) kopf.push(['Objektzulage', `${fe(+c.objektzulage)}/Std.`]);
  kopf.push(['Stunden gesamt', `${fh(T.stdGesamt)} (Arbeit ${fh(T.std)} + Urlaub ${fh(T.urlaub)} + Krank ${fh(T.krank)})`]);
  const spalten = [{ t: 'Datum', w: 70 }, { t: 'Art / Zeit', w: 95 }, { t: 'Pause', w: 38, r: 1 }, { t: 'Std.', w: 38, r: 1 }, { t: 'Tag', w: 38, r: 1 }, { t: 'Nacht', w: 38, r: 1 }, { t: 'Sonntag', w: 42, r: 1 }, { t: 'Feiertag', w: 42, r: 1 }, { t: 'Urlaub', w: 40, r: 1 }, { t: 'Krank', w: 38, r: 1 }, { t: 'Lohn', w: 58, r: 1 }, { t: 'Bemerkung', w: 110 }];
  const rows = zeilen.map(([sh, r]) => [`${wtag(sh.datum)} ${datumDE(sh.datum)}`, artZeit(sh, r), sh.art === 'dienst' && sh.pause_min ? sh.pause_min + ' min' : '–', fz(r.std), fz(r.tag), fz(r.nacht), fz(r.sonntag), fz(r.feiertag), fz(r.urlaub), fz(r.krank), fe(r.gesamt), bemerkung(sh, r)]);
  const sum = ['Summe', `${zeilen.length} Einträge`, T.pause ? T.pause + ' min' : '', fh(T.std), fh(T.tag), fh(T.nacht), fh(T.sonntag), fh(T.feiertag), fh(T.urlaub), fh(T.krank), fe(T.gesamt), ''];
  const zus = `Zuschläge: Nacht ${fh(+c.nacht_pct)} % (${hm(c.nacht_von)}–${hm(c.nacht_bis)}), Sonntag ${fh(+c.sonntag_pct)} %, Feiertag ${fh(+c.feiertag_pct)} %${c.zuschlag_modus === 'max' ? ' (nur höherer Zuschlag)' : ''}`;
  if (ag) {
    const ohne = (a) => a.filter((_, i) => spalten[i].t !== 'Lohn');
    return {
      titel: `Stundenzettel ${MONATE[m - 1]} ${y}`, kopf, spalten: ohne(spalten), zeilen: rows.map(ohne), summe: ohne(sum),
      lohn: [], gesamt: null, arbeitgeber: true,
      fuss: `Erstellt mit Shiftly am ${new Date().toLocaleDateString('de-DE')} · Nachtstunden ${hm(c.nacht_von)}–${hm(c.nacht_bis)} Uhr · Sonn- und Feiertagsstunden nach ${R?.n || c.region}`,
      datei: `Stundenzettel_${y}-${pad(m)}${c.name ? '_' + c.name.replace(/[^\wÄÖÜäöüß-]+/g, '_') : ''}_Arbeitgeber.pdf`,
    };
  }
  return {
    titel: `Stundenzettel ${MONATE[m - 1]} ${y}`, kopf, spalten, zeilen: rows, summe: sum,
    lohn: lohnZeilen(T, c).map(([t, v]) => [t, fe(v)]), gesamt: ['Gesamt brutto', fe(T.gesamt)],
    fuss: `Erstellt mit Shiftly am ${new Date().toLocaleDateString('de-DE')} · ${zus} · Richtwerte ohne Gewähr`,
    datei: `Stundenzettel_${y}-${pad(m)}${c.name ? '_' + c.name.replace(/[^\wÄÖÜäöüß-]+/g, '_') : ''}.pdf`,
  };
}

const blattHtml = (d) => `
      <h1>${esc(d.titel)}</h1>
      <div class="kopf-druck">${d.kopf.map(([l, v]) => `<div><b>${esc(l)}:</b> ${esc(v)}</div>`).join('')}</div>
      <table class="blatt-tab"><colgroup>${d.spalten.map((s) => `<col style="width:${(s.w / d.spalten.reduce((a, x) => a + x.w, 0) * 100).toFixed(2)}%">`).join('')}</colgroup><thead><tr>${d.spalten.map((s) => `<th class="${s.r ? '' : 'l'}">${esc(s.t)}</th>`).join('')}</tr></thead>
      <tbody>${d.zeilen.length ? d.zeilen.map((z) => `<tr>${z.map((v, i) => `<td class="${d.spalten[i].r ? '' : 'l'}">${esc(v)}</td>`).join('')}</tr>`).join('') : `<tr><td class="l" colspan="${d.spalten.length}">Keine Einträge in diesem Monat.</td></tr>`}</tbody>
      <tfoot><tr>${d.summe.map((v, i) => `<td class="${d.spalten[i].r ? '' : 'l'}">${esc(v)}</td>`).join('')}</tr></tfoot></table>
      ${d.gesamt ? `<div class="lohn" style="max-width:420px;margin-top:14px">${d.lohn.map(([t, v]) => `<div><span>${esc(t)}</span><span>${esc(v)}</span></div>`).join('')}<div class="ges"><span>${esc(d.gesamt[0])}</span><span>${esc(d.gesamt[1])}</span></div></div>` : ''}
      <div class="unterschrift"><div>Datum, Unterschrift Mitarbeiter/in</div><div>Datum, Unterschrift Vorgesetzte/r</div></div>
      <p class="fuss">${esc(d.fuss)}</p>`;
function zeigeVorschau() {
  let ag = !!S.vorschauAG;
  let d = pdfDaten(ag);
  const teilenMoeglich = !!(navigator.canShare && navigator.share);
  const w = document.createElement('div');
  w.className = 'modal';
  w.innerHTML = `
    <div class="modal-kopf">
      <div class="tabs vk-version" role="tablist" aria-label="Version">
        <button type="button" data-ag="0" aria-selected="${!ag}">Mit Lohn (für mich)</button>
        <button type="button" data-ag="1" aria-selected="${ag}">Für Arbeitgeber (ohne Geld)</button>
      </div>
      <div class="reihe">
        <button class="btn pri" id="v-pdf">PDF speichern</button>
        ${teilenMoeglich ? '<button class="btn" id="v-teilen">Teilen</button>' : ''}
        <button class="btn" id="v-gross">Größer</button>
        <button class="btn" id="v-druck">Drucken</button>
        <button class="btn" id="v-zu" aria-label="Vorschau schließen">Schließen</button>
      </div>
    </div>
    <div class="modal-inhalt"><div class="blatt-rahmen" id="rahmen"><div class="blatt" id="blatt">${blattHtml(d)}</div></div></div>`;
  document.body.appendChild(w);
  document.body.classList.add('modal-offen');
  let gross = false;
  const passen = () => { const bl = $('#blatt', w), ra = $('#rahmen', w); const f = gross ? 1 : Math.min(1, ($('.modal-inhalt', w).clientWidth - 32) / 1000); bl.style.transform = `scale(${f})`; ra.style.width = `${1000 * f}px`; ra.style.height = `${bl.offsetHeight * f}px`; };
  $('#v-gross', w).onclick = (ev) => { gross = !gross; ev.target.textContent = gross ? 'Ganze Seite' : 'Größer'; passen(); };
  passen(); addEventListener('resize', passen);
  $$('[data-ag]', w).forEach((t) => { t.onclick = () => {
    ag = t.dataset.ag === '1'; S.vorschauAG = ag; d = pdfDaten(ag);
    $$('[data-ag]', w).forEach((x) => x.setAttribute('aria-selected', String((x.dataset.ag === '1') === ag)));
    $('#blatt', w).innerHTML = blattHtml(d); passen();
  }; });
  const zu = () => { removeEventListener('resize', passen); w.remove(); document.body.classList.remove('modal-offen'); };
  $('#v-zu', w).onclick = zu;
  $('#v-druck', w).onclick = () => window.print();
  const erzeugen = async (knopf) => {
    const alt = knopf.textContent; knopf.disabled = true; knopf.textContent = 'Wird erstellt …';
    try {
      const PDFLib = await ladePdfLib();
      const bytes = await bauePdf(PDFLib, d);
      return new File([bytes], d.datei, { type: 'application/pdf' });
    } finally { knopf.disabled = false; knopf.textContent = alt; }
  };
  $('#v-pdf', w).onclick = async (ev) => {
    try {
      const f = await erzeugen(ev.target);
      const u = URL.createObjectURL(f);
      const a = document.createElement('a'); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 60000);
      toast('PDF gespeichert: ' + f.name);
    } catch (e) { toast('PDF konnte nicht erstellt werden: ' + e.message); }
  };
  if ($('#v-teilen', w)) $('#v-teilen', w).onclick = async (ev) => {
    try {
      const f = await erzeugen(ev.target);
      if (navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: d.titel });
      else toast('Teilen wird hier nicht unterstützt. Bitte „PDF speichern“ nutzen.');
    } catch (e) { if (e.name !== 'AbortError') toast(e.message); }
  };
}
function ladeSkript(src) { return new Promise((ok, nein) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => nein(new Error('Laden fehlgeschlagen')); document.head.appendChild(s); }); }
async function ladePdfLib() {
  if (window.PDFLib) return window.PDFLib;
  try { await ladeSkript('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'); }
  catch { await ladeSkript('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'); }
  if (!window.PDFLib) throw new Error('PDF-Baustein nicht verfügbar. Bitte Internetverbindung prüfen.');
  return window.PDFLib;
}

/* ---------------- Feiertage ---------------- */
function renderFeiertage() {
  const reg = S.feiertagRegion || S.profil.region; const y = S.feiertagJahr;
  const jahre = []; for (let j = Math.min(y, new Date().getFullYear())-2; j <= Math.max(y, new Date().getFullYear())+10; j++) jahre.push(j);
  $('#inhalt').innerHTML = `
    <section class="card">
      <div class="reihe" style="justify-content:space-between">
        <h1>Feiertage ${y}</h1>
        <div class="reihe">
          <label>Jahr<select id="f-jahr">${jahre.map((j) => `<option ${j === y ? 'selected' : ''}>${j}</option>`).join('')}</select></label>
          <label>Region<select id="f-reg">${regionOptionen(reg)}</select></label>
        </div>
      </div>
      <details class="dashboard-details" open><summary>Feiertage anzeigen</summary><div class="feiertage" style="margin-top:14px">${feiertage(reg, y).map(([t, n]) => `<div><span>${esc(n)}</span><span class="d">${WT[new Date(t).getUTCDay()]} ${datumDE(tagKey(t))}</span></div>`).join('')}</div></details>
      ${TARIF_FEIERTAGE_TEXT[reg] ? `<p class="banner info" style="margin-top:12px">${TARIF_FEIERTAGE_TEXT[reg]}</p>` : ''}
      <p class="hinweis">Bewegliche Feiertage werden jährlich berechnet. Für Mariä Himmelfahrt in Bayern, das Augsburger Friedensfest und örtliches Fronleichnam wähle die passende Ortsvariante. Prüfe bei lokalen Sonderfällen die Regel deiner Gemeinde.</p>
    </section>`;
  rememberDetails($('#inhalt'), 'feiertage');
  $('#f-jahr').onchange = (e) => { S.feiertagJahr = +e.target.value; renderFeiertage(); };
  $('#f-reg').onchange = (e) => { S.feiertagRegion = e.target.value; renderFeiertage(); };
}
function regionOptionen(sel) {
  const de = Object.entries(REGIONEN).filter(([, v]) => !v.eu), eu = Object.entries(REGIONEN).filter(([, v]) => v.eu);
  const o = ([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(v.n)}</option>`;
  return `<optgroup label="Deutschland – Sicherheitsdienst-Tarif">${de.map(o).join('')}</optgroup><optgroup label="Europa – Zuschläge selbst eintragen">${eu.map(o).join('')}</optgroup>`;
}

/* ---------------- Konto & Tarif ---------------- */
function renderKonto() {
  const p = S.profil, z = S.zugang;
  const preis = (k) => S.preise.find((x) => x.schluessel === k)?.cent ?? 0;
  const pm = preis('monat'), pj = preis('jahr');
  const ersparnis = pm ? Math.round((1 - pj / (pm * 12)) * 100) : 0;
  const km = Object.entries(kuerzelMap());
  $('#inhalt').innerHTML = `
    <section class="card">
      <h2>Deine Angaben für den Stundenzettel</h2>
      <div class="raster">
        <label>Name<input id="p-name" maxlength="80" value="${esc(p.name || '')}"></label>
        <label>Personal-Nr.<input id="p-pnr" maxlength="40" value="${esc(p.personalnr || '')}"></label>
        <label>Firma<input id="p-firma" maxlength="80" value="${esc(p.firma || '')}"></label>
        <label>Objekt / Einsatzort<input id="p-objekt" maxlength="120" value="${esc(p.objekt || '')}"></label>
      </div>
    </section>
    <section class="card">
      <h2>Lohn, Zuschläge &amp; Zulagen</h2>
      <div class="raster">
        <label style="grid-column:1/-1">Region / Tarifgebiet (für Feiertage und Voreinstellung)<select id="p-region">${regionOptionen(p.region)}</select></label>
        <label>Stundenlohn (€)<input id="p-lohn" type="number" step="0.01" min="0" inputmode="decimal" value="${+p.lohn}"></label>
        <label>Objektzulage (€ pro Std.)<input id="p-oz" type="number" step="0.01" min="0" max="100" inputmode="decimal" value="${+p.objektzulage || 0}"></label>
        <label>Nachtzuschlag (%)<input id="p-np" type="number" step="0.5" min="0" value="${+p.nacht_pct}"></label>
        <label>Nacht von<input id="p-nv" type="time" value="${hm(p.nacht_von)}"></label>
        <label>Nacht bis<input id="p-nb" type="time" value="${hm(p.nacht_bis)}"></label>
        <label>Sonntagszuschlag (%)<input id="p-sp" type="number" step="0.5" min="0" value="${+p.sonntag_pct}"></label>
        <label>Feiertagszuschlag (%)<input id="p-fp" type="number" step="0.5" min="0" value="${+p.feiertag_pct}"></label>
        <label>Nacht + Sonn-/Feiertag<select id="p-mod"><option value="add" ${p.zuschlag_modus === 'add' ? 'selected' : ''}>beide zusammenrechnen</option><option value="max" ${p.zuschlag_modus === 'max' ? 'selected' : ''}>nur den höheren</option></select></label>
        <label>Standard-Pause (Min.)<input id="p-pause" type="number" min="0" max="600" step="5" value="${p.pause_standard}"></label>
        <label>Stunden pro Urlaubstag<input id="p-us" type="number" min="0" max="24" step="0.01" inputmode="decimal" value="${+p.urlaub_std}"><span class="std-wahl" data-ziel="#p-us">${[6.67, 7, 7.5, 8].map((x) => `<button type="button" class="btn klein" data-std="${x}">${String(x).replace('.', ',')}</button>`).join('')}</span></label>
        <label>Stunden pro Krankheitstag<input id="p-ks" type="number" min="0" max="24" step="0.01" inputmode="decimal" value="${+p.krank_std}"><span class="std-wahl" data-ziel="#p-ks">${[6.67, 7, 7.5, 8].map((x) => `<button type="button" class="btn klein" data-std="${x}">${String(x).replace('.', ',')}</button>`).join('')}</span></label>
        <label>Urlaub: Grundlohn je Stunde (€)<input id="p-ulohn" type="number" min="0" step="0.01" placeholder="Standardlohn" value="${p.urlaub_stundenlohn ?? ''}"></label>
        <label>Urlaub: zusätzliche Zulage je Stunde (€)<input id="p-uzul" type="number" min="0" step="0.01" value="${p.urlaub_zulage || 0}"></label>
        <label>Krankheit: Grundlohn je Stunde (€)<input id="p-klohn" type="number" min="0" step="0.01" placeholder="Standardlohn" value="${p.krank_stundenlohn ?? ''}"></label>
        <label>Krankheit: zusätzliche Zulage je Stunde (€)<input id="p-kzul" type="number" min="0" step="0.01" value="${p.krank_zulage || 0}"></label>
        <label>Mehrarbeitszuschlag ab Monatsstunde<input id="p-mab" type="number" min="0" max="744" step="1" inputmode="numeric" value="${p.mehr_ab ?? ''}" placeholder="${mehrarbeitRegel({ region: p.region }).ab ? 'Tarif: über ' + mehrarbeitRegel({ region: p.region }).ab + ' Std.' : '0 = aus'}"></label>
        <label>Mehrarbeitszuschlag (%)<input id="p-mpct" type="number" min="0" max="200" step="0.5" value="${+(p.mehr_pct ?? 25)}"></label>
      </div>
      <p class="hinweis">Mehrarbeit: Zuschlag auf alle tatsächlich gearbeiteten Stunden über dieser Grenze im Monat (Urlaub und Krankheit zählen nicht mit). Leer = Tarif der Region (Hamburg: 25 % ab der 229. Stunde, Lohntarifvertrag 2022), 0 = kein Mehrarbeitszuschlag.</p>
      <p class="hinweis" id="p-quelle"></p>
      <p class="hinweis">Urlaub und Krankheit verwenden ohne Eingabe den normalen Stundenlohn, ohne Schichtzuschläge. Du kannst Stunden, Grundlohn und Zulage für beide Fälle getrennt anpassen.</p>
      <div class="reihe" style="margin-top:10px"><button class="btn pri" id="p-speichern">Speichern</button><button class="btn" id="p-tarif">Tarifwerte der Region übernehmen</button></div>
    </section>
    <section class="card" id="steuer">
      <h2>Steuer &amp; Sozialversicherung (für das Netto)</h2>
      <div class="raster">
        <label>Steuerklasse<select id="p-stkl">${[1, 2, 3, 4, 5, 6].map((k) => `<option ${+p.stkl === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <label>Kinderfreibeträge<select id="p-zkf">${[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map((k) => `<option value="${k}" ${+p.zkf === k ? 'selected' : ''}>${String(k).replace('.', ',')}</option>`).join('')}</select></label>
        <label>KV-Zusatzbeitrag (%)<input id="p-kvz" type="number" step="0.01" min="0" max="6" inputmode="decimal" value="${+p.kvz}"></label>
        <label>Kinder unter 25<input id="p-ku25" type="number" min="0" max="10" step="1" value="${+p.kinder_u25}"></label>
      </div>
      <label class="check"><input type="checkbox" id="p-kirche" ${p.kirche ? 'checked' : ''}> <span>Kirchensteuerpflichtig <small class="hinweis" style="display:block;margin:0">freiwillig, nur für die Netto-Berechnung (siehe <a href="#datenschutz" data-seite="datenschutz">Datenschutz</a>)</small></span></label>
      <label class="check"><input type="checkbox" id="p-kinderlos" ${p.kinderlos ? 'checked' : ''}> Kinderlos und mindestens 23 Jahre alt (Pflegeversicherung +0,6 %)</label>
      <p class="hinweis">Den Zusatzbeitrag deiner Krankenkasse findest du auf deiner Lohnabrechnung oder bei der Kasse (Durchschnitt 2026: 2,9 %). Gespeichert wird mit „Speichern“ oben.</p>
      <div class="reihe" style="margin-top:10px"><button class="btn pri" id="p-speichern2">Speichern</button></div>
    </section>
    <section class="card">
      <h2>Meine Schichtkürzel</h2>
      <p class="hinweis" style="margin-top:0">Hier kannst du Kürzel hinzufügen, ändern oder löschen. Löschen wird sofort gespeichert. Neue Kürzel und Änderungen mit „Kürzel speichern“ übernehmen. Auch eine leere Liste ist möglich. Lege deine Kürzel einmal an, z. B. <b>NT</b> = 06:00–18:00. Im Kalender tippst du dann nur noch das Kürzel und die Tage an.</p>
      <div class="tabelle"><table class="kz"><thead><tr><th class="l">Kürzel</th><th class="l">Art</th><th class="l">Beginn</th><th class="l">Ende</th><th class="l">Pause (Min.)</th><th></th></tr></thead>
      <tbody id="kz-body">${km.map(([k, v], i) => `<tr data-row="${i}" data-saved-code="${esc(k)}"><td class="l"><input class="kz-code" maxlength="6" value="${esc(k)}" style="max-width:80px;text-transform:uppercase"></td>
        <td class="l"><select class="kz-art">${Object.entries(ART).map(([a, t]) => `<option value="${a}" ${v.art === a ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
        <td class="l"><input class="kz-b" type="time" value="${v.beginn || ''}" ${v.art !== 'dienst' ? 'disabled' : ''}></td>
        <td class="l"><input class="kz-e" type="time" value="${v.ende || ''}" ${v.art !== 'dienst' ? 'disabled' : ''}></td>
        <td class="l"><input class="kz-p" type="number" min="0" max="240" step="5" value="${v.pause || 0}" ${v.art !== 'dienst' ? 'disabled' : ''} style="max-width:90px"></td>
        <td><button class="btn klein rot kz-del" type="button">Löschen</button></td></tr>`).join('')}</tbody></table></div>
      <div class="reihe" style="margin-top:10px"><button class="btn" id="kz-neu" type="button">+ Kürzel hinzufügen</button><button class="btn pri" id="kz-speichern" type="button">Kürzel speichern</button></div>
    </section>
    <div id="abo-platz"></div>
    ${z.admin ? '' : `<section class="card">
      <h2>E-Mail-Neuigkeiten</h2>
      <label class="check" style="margin-top:0"><input type="checkbox" id="nl-an" disabled> <span>Ja, ich möchte Angebote und Neuigkeiten zu Shiftly und neuen Apps per E-Mail erhalten. Abmelden geht jederzeit. (freiwillig)</span></label>
      <p class="hinweis" id="nl-zustand"></p>
    </section>`}
    <section class="card">
      <h2>Konto</h2>
      <p class="hinweis" style="margin-top:0">Angemeldet als ${esc(sitzung.user.email === INHABER_MAIL ? 'Baron (Inhaber)' : sitzung.user.email)}</p>
      <div class="reihe"><button class="btn" id="abmelden">Abmelden</button>${z.admin ? '' : '<button class="btn rot" id="loeschen">Konto löschen</button>'}</div>
    </section>
    ${VK.fussLinks()}`;
  foldCards($('#inhalt'), 'konto', [...$('#inhalt').querySelectorAll('section.card')].slice(1).map((card,i)=>({index:i+1,key:card.querySelector('h2')?.textContent?.trim()||String(i),label:card.querySelector('h2')?.textContent?.trim()||'Weitere Angaben'})));
  VK.bindeFuss($('#inhalt'));
  if ($('#nl-an')) {
    const zeigeZustand = (z) => { const c = $('#nl-an'), h = $('#nl-zustand'); if (!c) return; c.checked = z !== 'aus'; c.disabled = false;
      h.textContent = z === 'offen' ? 'Fast geschafft: Wir haben dir eine E-Mail geschickt. Bitte klicke dort auf „Anmeldung bestätigen“.' : z === 'an' ? 'Angemeldet.' : ''; };
    rpc('sz_nl_zustand').then(zeigeZustand).catch(() => {});
    $('#nl-an').onchange = async (e) => {
      const an = e.target.checked; e.target.disabled = true;
      try { const r = await mailFn(an ? { aktion: 'anfordern', text: e.target.nextElementSibling.textContent.trim() } : { aktion: 'abmelden' }, true); zeigeZustand(r.zustand);
        toast(an ? (r.zustand === 'an' ? 'Du bist bereits angemeldet.' : 'Bitte bestätige die Anmeldung in der E-Mail, die wir dir geschickt haben.') : 'Abgemeldet – du bekommst keine Werbe-E-Mails mehr.'); }
      catch (err) { e.target.checked = !an; e.target.disabled = false; toast(err.message); }
    };
  }
  VK.aboHtml(z).then((h) => { const pl = $('#abo-platz'); if (!pl) return; pl.outerHTML = h; VK.bindeAbo($('#abo')); if (location.hash === '#abo') $('#abo').scrollIntoView(); }).catch((e) => toast(e.message));

  const quelle = () => {
    const R = REGIONEN[$('#p-region').value];
    $('#p-quelle').textContent = R.eu ? 'Für diese Region ist kein Tarif hinterlegt. Trag Stundenlohn und Zuschläge bitte selbst ein. Die Feiertage werden automatisch berücksichtigt.'
      : `Tarif ${R.n} (${TARIF_STAND}): ${fe(R.w)}/Std., Nacht ${R.np} % (${R.nf}–${R.nt}), Sonntag ${R.sp} %, Feiertag ${R.fp} %. Dein eigener Lohn kann je nach Lohngruppe höher sein.`;
  };
  quelle(); $('#p-region').onchange = quelle;
  $$('.std-wahl button').forEach((b) => { b.onclick = (e) => { e.preventDefault(); $(b.parentElement.dataset.ziel).value = b.dataset.std; }; });
  $('#p-tarif').onclick = () => {
    const R = REGIONEN[$('#p-region').value]; if (R.eu) { toast('Für diese Region gibt es keine Tarifwerte.'); return; }
    $('#p-lohn').value = R.w; $('#p-nv').value = R.nf; $('#p-nb').value = R.nt; $('#p-np').value = R.np; $('#p-sp').value = R.sp; $('#p-fp').value = R.fp;
    $('#p-mab').value = ''; $('#p-mpct').value = R.mp || 25;
    toast('Tarifwerte eingesetzt – bitte speichern');
  };
  $('#p-speichern').onclick = async () => {
    const num = (id) => { const v = parseFloat(String($(id).value).replace(',', '.')); return Number.isFinite(v) ? v : 0; };
    const d = { name: $('#p-name').value.trim() || null, personalnr: $('#p-pnr').value.trim() || null, firma: $('#p-firma').value.trim() || null, objekt: $('#p-objekt').value.trim() || null,
      region: $('#p-region').value, lohn: num('#p-lohn'), objektzulage: num('#p-oz'), nacht_pct: num('#p-np'), nacht_von: $('#p-nv').value || '20:00', nacht_bis: $('#p-nb').value || '06:00',
      sonntag_pct: num('#p-sp'), feiertag_pct: num('#p-fp'), zuschlag_modus: $('#p-mod').value, pause_standard: Math.round(num('#p-pause')),
      urlaub_std: Math.round(num('#p-us') * 100) / 100, krank_std: Math.round(num('#p-ks') * 100) / 100,
      urlaub_stundenlohn: $('#p-ulohn').value.trim() === '' ? null : num('#p-ulohn'), krank_stundenlohn: $('#p-klohn').value.trim() === '' ? null : num('#p-klohn'),
      urlaub_zulage: num('#p-uzul'), krank_zulage: num('#p-kzul'),
      mehr_ab: $('#p-mab').value.trim() === '' ? null : Math.max(0, Math.round(num('#p-mab'))), mehr_pct: num('#p-mpct'), stkl: +$('#p-stkl').value, zkf: +$('#p-zkf').value, kvz: num('#p-kvz'), kinder_u25: Math.round(num('#p-ku25')),
      kirche: $('#p-kirche').checked, kinderlos: $('#p-kinderlos').checked, updated_at: new Date().toISOString() };
    try { const r = await api(`sz_profile?user_id=eq.${sitzung.user.id}`, { method: 'PATCH', body: d, prefer: 'return=representation' }); S.profil = r[0]; render(); toast('Gespeichert'); }
    catch (e) { toast(e.message); }
  };
  $('#p-speichern2').onclick = () => $('#p-speichern').click();
  const kzZeilen = () => $$('#kz-body tr').map((tr) => ({ code: $('.kz-code', tr).value.trim().toUpperCase(), art: $('.kz-art', tr).value, beginn: $('.kz-b', tr).value || null, ende: $('.kz-e', tr).value || null, pause: Math.max(0, parseInt($('.kz-p', tr).value || '0', 10)) }));
  const kzArt = (tr) => { const a = $('.kz-art', tr).value; ['.kz-b', '.kz-e', '.kz-p'].forEach((c) => { $(c, tr).disabled = a !== 'dienst'; }); };
  let codeDeletesPending=0;
  const bindDeleteCode=tr=>{ $('.kz-del',tr).onclick=async()=>{
    const code=tr.dataset.savedCode;if(!code){tr.remove();return;}
    const button=$('.kz-del',tr);button.disabled=true;button.textContent='Wird gelöscht …';codeDeletesPending++;$('#kz-speichern').disabled=true;
    try{await deletePersonalCode(code);tr.remove();toast('Kürzel gelöscht und gespeichert');}
    catch(e){toast(e.message);button.disabled=false;button.textContent='Löschen';}
    finally{codeDeletesPending--;if($('#kz-speichern'))$('#kz-speichern').disabled=codeDeletesPending>0;}
  };};
  $$('#kz-body tr').forEach((tr) => { $('.kz-art', tr).onchange = () => kzArt(tr);bindDeleteCode(tr); });
  $('#kz-neu').onclick = () => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="l"><input class="kz-code" maxlength="6" placeholder="z. B. F" style="max-width:80px;text-transform:uppercase"></td><td class="l"><select class="kz-art"><option value="dienst">Dienst</option><option value="urlaub">Urlaub</option><option value="krank">Krank</option><option value="frei">Frei</option></select></td><td class="l"><input class="kz-b" type="time" value="06:00"></td><td class="l"><input class="kz-e" type="time" value="14:00"></td><td class="l"><input class="kz-p" type="number" min="0" max="240" step="5" value="0" style="max-width:90px"></td><td><button class="btn klein rot kz-del" type="button">Löschen</button></td>`;
    $('#kz-body').appendChild(tr); $('.kz-art', tr).onchange = () => kzArt(tr); bindDeleteCode(tr); $('.kz-code', tr).focus();
  };
  $('#kz-speichern').onclick = async () => {
    const neu = {};
    for (const z of kzZeilen()) {
      if (!z.code) { toast('Bitte jedem Kürzel einen Namen geben.'); return; }
      if (!/^[A-ZÄÖÜ0-9+\-/.]{1,6}$/.test(z.code)) { toast(`„${z.code}“: bitte nur Buchstaben und Zahlen, höchstens 6 Zeichen.`); return; }
      if (neu[z.code]) { toast(`Das Kürzel „${z.code}“ gibt es doppelt.`); return; }
      if (z.art === 'dienst' && (!z.beginn || !z.ende || z.beginn === z.ende)) { toast(`Bei „${z.code}“ fehlen Beginn und Ende.`); return; }
      neu[z.code] = z.art === 'dienst' ? { art: 'dienst', beginn: z.beginn, ende: z.ende, pause: z.pause } : { art: z.art, beginn: null, ende: null, pause: 0 };
    }
    try { const r = await api(`sz_profile?user_id=eq.${sitzung.user.id}`, { method: 'PATCH', body: { kuerzel: neu, kuerzel_customized: true, updated_at: new Date().toISOString() }, prefer: 'return=representation' }); S.profil = r[0]; S.stempel = null; S.wunschStempel=null; if(!neu[S.form.kuerzel])S.form.kuerzel=null; renderKonto(); toast('Kürzel gespeichert'); } catch (e) { toast(e.message); }
  };
  $$('.kauf').forEach((k) => { k.onclick = async () => {
    try { await rpc('sz_request_subscription', { p_plan: k.dataset.plan }); toast('Anfrage gesendet – du wirst in Kürze freigeschaltet.'); k.disabled = true; k.textContent = 'Anfrage gesendet'; }
    catch (e) { toast(e.message); } }; });
  $('#abmelden').onclick = async () => {
    try { await rpc('sz_log_event', { p_event: 'logout' }); await fetch(`${URL_}/auth/v1/logout`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${await token()}` } }); } catch { /* egal */ }
    speichereSitzung(null); location.reload();
  };
  if ($('#loeschen')) $('#loeschen').onclick = async (ev) => {
    const k = ev.target;
    if (!k.dataset.sicher) { k.dataset.sicher = '1'; k.textContent = 'Shiftly und Groschen endgültig löschen? Nochmal tippen'; return; }
    try { await rpc('delete_my_account'); speichereSitzung(null); alertSeite('Dein gemeinsames Konto und seine Daten wurden gelöscht.'); } catch (e) { toast(e.message); }
  };
}
function alertSeite(t) { $('#app').innerHTML = `<div class="login"><div class="card"><p>${esc(t)}</p><button class="btn pri" onclick="location.reload()">Zur Anmeldung</button></div></div>`; }

/* ---------------- Statistik (nur Inhaber) ---------------- */
async function ladeStatistik() { try { S.statistik = await rpc('sz_admin_stats'); } catch (e) { S.statistik = { fehler: e.message }; } }
const EV = { signup: 'Registriert', login: 'Angemeldet', logout: 'Abgemeldet', account_deleted: 'Konto gelöscht', abo_anfrage: 'Abo-Anfrage', zugang_geaendert: 'Zugang geändert', aktion_genutzt: 'Aktion genutzt', aktion_gestartet: 'Aktion gestartet', aktion_beendet: 'Aktion beendet', preis_geaendert: 'Preis geändert', abo_bezahlt: 'Abo bezahlt (Stripe)', abo_aktualisiert: 'Abo aktualisiert (Stripe)', abo_verlaengert: 'Abo verlängert (Stripe)', abo_beendet: 'Abo beendet (Stripe)', kuendigung: 'Kündigung', passwort_zurueckgesetzt: 'Passwort zurückgesetzt', newsletter_an: 'Newsletter bestätigt', newsletter_ab: 'Newsletter abgemeldet', newsletter_angefragt: 'Newsletter angefragt' };
const dz = (t) => t ? new Date(t).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–';
function renderStatistik() {
  const st = S.statistik;
  if (!st || st.fehler) { $('#inhalt').innerHTML = `<div class="card">${esc(st?.fehler || 'Lädt …')}</div>`; return; }
  const t = st.totals;
  const statusText = (u) => u.admin ? 'Inhaber' : u.status === 'active' ? (({ monat: 'Monatsabo', jahr: 'Jahresabo', frei: 'Frei', aktion: 'Aktion' }[u.plan] || 'Aktiv') + (u.sub_ends_at ? ' bis ' + new Date(u.sub_ends_at).toLocaleDateString('de-DE') : (u.plan === 'frei' ? ' (dauerhaft)' : ''))) : u.status === 'trialing' ? (new Date(u.trial_ends_at) > Date.now() ? 'Test bis ' + new Date(u.trial_ends_at).toLocaleDateString('de-DE') : 'Test abgelaufen') : 'Gesperrt';
  $('#inhalt').innerHTML = `
    <div class="kacheln">
      <div class="kachel k-sum"><b>${t.users}</b><span>Nutzer</span></div>
      <div class="kachel k-tag"><b>${t.signups_7d}</b><span>Neu (7 Tage)</span></div>
      <div class="kachel k-so"><b>${t.paid_month + t.paid_year}</b><span>Zahlende Abos</span></div>
      <div class="kachel k-nacht"><b>${t.trialing}</b><span>Im Test</span></div>
      <div class="kachel k-fe"><b>${t.deleted}</b><span>Gelöscht</span></div>
      <div class="kachel k-sum"><b>${t.requests}</b><span>Abo-Anfragen</span></div>
    </div>
    <section class="card" id="freigabe">
      <h2>Zugang freigeben</h2>
      <p class="hinweis" style="margin-top:0">Gib die E-Mail-Adresse ein, mit der sich die Person anmeldet bzw. anmelden wird. Gibt es das Konto schon, gilt die Freigabe sofort – sonst automatisch bei der Registrierung.</p>
      <form id="fg-form" class="raster" novalidate>
        <label style="grid-column:1/-1">E-Mail-Adresse<input id="fg-mail" type="email" list="fg-liste" autocomplete="off" placeholder="name@beispiel.de" required></label>
        <datalist id="fg-liste">${st.users.filter((u) => !u.admin).map((u) => `<option value="${esc(u.email)}">${esc(u.name || '')}</option>`).join('')}</datalist>
        <label>Name (nur zur Erinnerung)<input id="fg-name" maxlength="80" placeholder="optional"></label>
        <label>Freigabe<select id="fg-art">
          <option value="frei">Dauerhaft frei (ganze App)</option>
          <option value="tage:3">3 Tage frei</option><option value="tage:7">1 Woche frei</option>
          <option value="tage:30">1 Monat frei</option><option value="tage:90">3 Monate frei</option>
          <option value="tage:182">6 Monate frei</option><option value="tage:365">1 Jahr frei</option>
          <option value="tage:x">Eigene Anzahl Tage frei …</option>
          <option value="test:10">Testzeitraum: 10 Tage (ab heute)</option>
          <option value="sperren">Sperren</option>
        </select></label>
        <label id="fg-tage-l" hidden>Anzahl Tage<input id="fg-tage" type="number" min="1" max="3660" step="1" value="14"></label>
        <div class="reihe" style="grid-column:1/-1"><button class="btn pri" type="submit">Freigeben</button><span class="hinweis" id="fg-status" style="margin:0"></span></div>
      </form>
      ${st.freigaben?.length ? `<h3 style="font-size:14px;margin:14px 0 4px">Wartet auf Registrierung</h3>${st.freigaben.map((g) => `<div class="ev"><span><b>${esc(g.email)}</b>${g.name ? ' · ' + esc(g.name) : ''} · ${g.art === 'frei' ? 'dauerhaft frei' : g.art === 'tage' ? g.tage + ' Tage frei' : g.tage + ' Tage Test'}</span><button class="btn klein rot" data-fg-weg="${esc(g.email)}">Löschen</button></div>`).join('')}` : ''}
    </section>
    <section class="card">
      <h2>Nutzer</h2>
      <div class="tabelle"><table><thead><tr><th class="l">Name / E-Mail</th><th class="l">Registriert</th><th class="l">Letzte Anmeldung</th><th class="l">Letzte Abmeldung</th><th>Logins</th><th>Einträge</th><th class="l">Status</th><th class="l">Zugang ändern</th></tr></thead>
      <tbody>${st.users.map((u) => `<tr><td class="l"><b>${esc(u.name || '–')}</b><br><small>${esc(u.email)}</small>${u.admin ? '' : `<br><button class="linkbtn" data-fg-fill="${esc(u.email)}" data-fg-name="${esc(u.name || '')}">Zugang freigeben …</button>`}</td><td class="l">${dz(u.created_at)}</td><td class="l">${dz(u.last_login)}</td><td class="l">${dz(u.last_logout)}</td><td>${u.logins}</td><td>${u.shifts}</td><td class="l">${statusText(u)}</td>
        <td class="l">${u.admin ? '–' : `<select data-u="${u.id}"><option value="">wählen …</option><option value="monat">Monatsabo (1 Monat)</option><option value="jahr">Jahresabo (1 Jahr)</option><option value="frei">Frei (dauerhaft)</option><option value="test">+3 Tage Test</option><option value="sperren">Sperren</option><option value="passwort">Neues Passwort setzen …</option></select>`}</td></tr>`).join('')}</tbody></table></div>
    </section>
    <section class="card" id="aktivitaet"><h2>Aktivität</h2><p class="hinweis">Bereich und stündliche Nutzung der letzten 30 Tage. „Online“ bedeutet Aktivität in den letzten zwei Minuten. Eingaben und Finanzinhalte werden nicht erfasst.</p><div id="admin-activity">Wird geladen …</div></section>
    <section class="card" id="ideen"><h2>Feedback</h2><div id="admin-feedback">Wird geladen …</div></section>
    <section class="card" id="nl-karte">
      <h2>E-Mail-Liste (Newsletter)</h2>
      <p class="hinweis" style="margin-top:0" id="nl-info">Wird geladen …</p>
      <p style="margin:6px 0" id="nl-brevo">Brevo: wird geprüft …</p>
      <div class="raster" id="nl-setup" hidden>
        <label style="grid-column:1/-1">Brevo-API-Schlüssel<input id="nl-key" type="password" autocomplete="off" placeholder="xkeysib-…"></label>
        <label>Absender-E-Mail (in Brevo bestätigt)<input id="nl-abs" type="email" placeholder="deine@email.de"></label>
        <label>Absender-Name<input id="nl-name" value="Shiftly" maxlength="60"></label>
      </div>
      <div class="reihe" style="margin-top:8px"><button class="btn pri" id="nl-verbinden" hidden>Brevo verbinden</button><button class="btn" id="nl-offen" hidden>Offene Bestätigungen senden</button><button class="btn" id="nl-csv" disabled>Liste als CSV</button><button class="btn rot" id="nl-trennen" hidden>Brevo trennen</button></div>
      <p class="hinweis">Anmeldung mit Bestätigung per E-Mail (Double-Opt-in): Erst wer den Link in der Bestätigungs-E-Mail anklickt, landet in deiner Brevo-Liste „Shiftly Newsletter“. Werbe-E-Mails schreibst und verschickst du dann in Brevo unter „Kampagnen“ an diese Liste – Brevo fügt den Abmeldelink automatisch ein.</p>
    </section>
    <div id="vk-inhaber-platz"></div>
    <section class="card">
      <h2>Verlauf</h2>
      ${st.events.length ? st.events.map((e) => `<div class="ev"><span>${EV[e.event] || esc(e.event)} · ${esc(e.email || '(gelöscht)')}${e.meta?.plan ? ' · ' + esc(e.meta.plan) : ''}</span><span>${dz(e.at)}</span></div>`).join('') : '<p class="hinweis">Noch keine Ereignisse.</p>'}
    </section>`;
  foldCards($('#inhalt'), 'verwaltung', [...$('#inhalt').querySelectorAll('section.card')].slice(1).map((card,i)=>({index:i+1,key:card.id||card.querySelector('h2')?.textContent?.trim()||String(i),label:card.querySelector('h2')?.textContent?.trim()||'Weitere Angaben',open:i===0})));
  rpc('sz_admin_activity').then((users)=>{
    const box=$('#admin-activity');if(!box)return;
    box.innerHTML=users.length?users.map(u=>`<details class="extra-item"><summary><b>${esc(u.name)}</b> · ${u.online?'● online':'zuletzt '+dz(u.last_seen)} · ${esc(u.area)}</summary><div class="hinweis">${u.history.map(h=>`<div>${dz(h.from)} · ${esc(h.area)}</div>`).join('')||'Keine Einträge'}</div></details>`).join(''):'Noch keine Aktivität.';
  }).catch(e=>{if($('#admin-activity'))$('#admin-activity').textContent=e.message;});
  rpc('sz_admin_feedback').then((items)=>{
    const box=$('#admin-feedback');if(!box)return;
    box.innerHTML=items.length?items.map(f=>`<div class="ul-zeile"><div><b>${esc(f.name)}</b> · ${dz(f.created_at)}<p>${esc(f.message)}</p></div><select data-feedback="${f.id}">${['neu','pruefung','geplant','erledigt','abgelehnt'].map(s=>`<option value="${s}" ${f.status===s?'selected':''}>${s}</option>`).join('')}</select></div>`).join(''):'Noch keine Vorschläge.';
    box.querySelectorAll('[data-feedback]').forEach(sel=>sel.onchange=async()=>{try{await rpc('sz_admin_feedback_status',{p_id:sel.dataset.feedback,p_status:sel.value});toast('Status gespeichert');}catch(e){toast(e.message);}});
  }).catch(e=>{if($('#admin-feedback'))$('#admin-feedback').textContent=e.message;});
  rpc('sz_admin_newsletter').then((nl) => {
    $('#nl-info').textContent = `${nl.aktiv} bestätigt · ${nl.offen || 0} warten auf Bestätigung · ${nl.abgemeldet} abgemeldet`;
    const b = $('#nl-csv'); b.disabled = !nl.liste.length;
    b.onclick = () => {
      const q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
      const zeilen = [['E-Mail', 'Name', 'Angemeldet seit', 'Quelle', 'Abmeldelink'].map(q).join(';'),
        ...nl.liste.map((r) => [r.email, r.name, new Date(r.seit).toLocaleString('de-DE'), r.quelle, `${location.origin}/?abmelden=${r.token}`].map(q).join(';'))];
      const blob = new Blob(['\ufeff' + zeilen.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = `Shiftly_Newsletter_${heuteISO()}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
    };
  }).catch((e) => { $('#nl-info').textContent = e.message; });
  const brevoLaden = () => mailFn({ aktion: 'status' }, true).then((b) => {
    $('#nl-brevo').innerHTML = b.verbunden ? `✅ Brevo verbunden · Absender ${esc(b.absender)}` : '⬜ Brevo noch nicht verbunden – Bestätigungs-E-Mails werden gesendet, sobald du es verbindest.';
    $('#nl-setup').hidden = b.verbunden; $('#nl-verbinden').hidden = b.verbunden; $('#nl-offen').hidden = !b.verbunden; $('#nl-trennen').hidden = !b.verbunden;
  }).catch((e) => { $('#nl-brevo').textContent = e.message; });
  brevoLaden();
  $('#nl-verbinden').onclick = async (ev) => {
    const b = ev.target; b.disabled = true; b.textContent = 'Wird geprüft …';
    try { const r = await mailFn({ aktion: 'setup', key: $('#nl-key').value, absender: $('#nl-abs').value, name: $('#nl-name').value }, true); toast(`Brevo verbunden. ${r.uebertragen} bestätigte Empfänger übertragen.`); $('#nl-key').value = ''; brevoLaden(); }
    catch (e) { toast(e.message); } finally { b.disabled = false; b.textContent = 'Brevo verbinden'; }
  };
  $('#nl-offen').onclick = async (ev) => { ev.target.disabled = true; try { const r = await mailFn({ aktion: 'offene_senden' }, true); toast(`${r.gesendet} Bestätigungs-E-Mails gesendet.`); } catch (e) { toast(e.message); } finally { ev.target.disabled = false; } };
  $('#nl-trennen').onclick = async (ev) => { const b = ev.target; if (!b.dataset.sicher) { b.dataset.sicher = '1'; b.textContent = 'Wirklich trennen?'; return; } try { await mailFn({ aktion: 'trennen' }, true); toast('Brevo getrennt.'); brevoLaden(); } catch (e) { toast(e.message); } };
  $('#fg-art').onchange = (e) => { $('#fg-tage-l').hidden = e.target.value !== 'tage:x'; };
  $$('[data-fg-fill]').forEach((b) => { b.onclick = () => { $('#fg-mail').value = b.dataset.fgFill; $('#fg-name').value = b.dataset.fgName; $('#freigabe').scrollIntoView({ behavior: 'smooth' }); $('#fg-art').focus(); }; });
  $$('[data-fg-weg]').forEach((b) => { b.onclick = async () => { try { await rpc('sz_admin_freigabe_loeschen', { p_email: b.dataset.fgWeg }); await ladeStatistik(); renderStatistik(); toast('Freigabe entfernt'); } catch (e) { toast(e.message); } }; });
  $('#fg-form').onsubmit = async (ev) => {
    ev.preventDefault();
    const mail = $('#fg-mail').value.trim(); const [art, t] = $('#fg-art').value.split(':');
    const tage = t === 'x' ? parseInt($('#fg-tage').value, 10) : t ? +t : null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { toast('Bitte eine gültige E-Mail-Adresse eingeben.'); return; }
    if (art === 'sperren' && !confirm(`${mail} wirklich sperren?`)) return;
    const knopf = $('#fg-form button[type=submit]'); knopf.disabled = true;
    try {
      const r = await rpc('sz_admin_freigabe', { p_email: mail, p_art: art, p_tage: tage, p_name: $('#fg-name').value.trim() || null });
      toast(r.sofort ? `${mail}: ${r.text}` : `${mail}: ${r.text}`);
      await ladeStatistik(); renderStatistik();
    } catch (e) { toast(e.message); knopf.disabled = false; }
  };
  $$('select[data-u]').forEach((s) => { s.onchange = async () => {
    const v = s.value; if (!v) return;
    if (v === 'passwort') {
      const pw = prompt('Neues Passwort für diesen Nutzer (mind. 8 Zeichen, Buchstaben und Zahl). Teile es dem Kunden sicher mit.');
      s.value = ''; if (!pw) return;
      try { await rpc('sz_admin_passwort', { p_user: s.dataset.u, p_passwort: pw }); toast('Passwort gesetzt'); } catch (e) { toast(e.message); }
      return;
    }
    const plus = (mo) => { const d = new Date(); d.setMonth(d.getMonth() + mo); return d.toISOString(); };
    const map = { monat: ['active', 'monat', plus(1)], jahr: ['active', 'jahr', plus(12)], frei: ['active', 'frei', null], test: ['trialing', null, null], sperren: ['canceled', null, null] }[v];
    try { await rpc('sz_admin_set_access', { p_user: s.dataset.u, p_status: map[0], p_plan: map[1], p_until: map[2] }); await ladeStatistik(); renderStatistik(); toast('Zugang geändert'); }
    catch (e) { toast(e.message); s.value = ''; }
  }; });
  VK.inhaberHtml(st).then((h) => { const pl = $('#vk-inhaber-platz'); if (!pl) return; pl.outerHTML = `<div id="vk-inhaber-wrap">${h}</div>`; VK.bindeInhaber($('#vk-inhaber-wrap'), async () => { await ladeStatistik(); renderStatistik(); }); }).catch((e) => toast(e.message));
}

/* ---------------- Start ---------------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
VK.init({ URL_, KEY, api, rpc, token, S, esc, toast, render: () => render(), zugangText, sitzung: () => sitzung });
const seiteAusAdresse = () => { const h = location.hash.slice(1); if (VK.SEITEN[h]) VK.zeigeSeite(h); };
addEventListener('hashchange', seiteAusAdresse);
start().then(() => { seiteAusAdresse(); if (sitzung) VK.nachZahlung(); });
setInterval(()=>{if(!sitzung||document.visibilityState!=='visible')return;const area=({start:'Übersicht',zettel:'Dienstplan',urlaub:'Urlaub',budget:'Groschen',wuensche:'Wünsche',objekte:'Objekte',feiertage:'Feiertage',konto:'Konto',einstellungen:'Einstellungen',feedback:'Feedback'})[S.ansicht];if(area)rpc('sz_track_area',{p_area:area}).catch(()=>{});},60000);
