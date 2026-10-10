/* Preise & Aktionen – Baustein v1
 * Einbinden: <script type="module" src="aktionen.js" data-url="https://XYZ.supabase.co" data-key="ANON_KEY"
 *                    data-app="App-Name" data-farbe="#0E6B54" data-kauf="#buy"></script>
 * Preise in der App markieren: <span data-aktion-preis="monat">…</span>
 *   Wert = Schlüssel aus der Preisliste ("monat", "jahr"), optional geteilt ("jahr/12"), oder Cent-Betrag ("249").
 * Der Inhaber (private.app_admins) bekommt unten links den Knopf „€ Aktionen“.
 */
const skript = document.querySelector('script[src*="aktionen.js"]');
const CFG = {
  url: skript?.dataset.url || '',
  key: skript?.dataset.key || '',
  app: skript?.dataset.app || document.title || 'App',
  farbe: skript?.dataset.farbe || '#0E6B54',
  kauf: skript?.dataset.kauf || '',
};
const eurFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const eur = (cent) => eurFmt.format((Number(cent) || 0) / 100);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rabattCent = (cent, p) => Math.round((Number(cent) || 0) * (100 - p) / 100);
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* egal */ } },
};

let stand = null;          // Ergebnis von aktionen_status()
let uhrVersatz = 0;        // Serverzeit - Gerätezeit (ms)
let letzterToken = null;
let panelOffen = false;

/* ---------- Anmeldung der App mitlesen (ohne die App zu ändern) ---------- */
function token() {
  let best = null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); const raw = localStorage.getItem(k);
      if (!raw || raw[0] !== '{' || !raw.includes('access_token')) continue;
      let o; try { o = JSON.parse(raw); } catch { continue; }
      const s = o?.access_token ? o : o?.currentSession?.access_token ? o.currentSession : o?.session?.access_token ? o.session : null;
      if (!s || typeof s.access_token !== 'string') continue;
      let exp = Number(s.expires_at) || 0; if (exp && exp < 1e12) exp *= 1000;
      if (exp && exp < Date.now() + 5000) continue;
      if (!best || exp > best.exp) best = { t: s.access_token, exp };
    }
  } catch { /* kein Speicher */ }
  return best?.t || null;
}

async function rpc(fn, body = {}) {
  const t = token();
  const res = await fetch(`${CFG.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: CFG.key, Authorization: 'Bearer ' + (t || CFG.key), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || 'Serverfehler (' + res.status + ')');
  return data;
}

/* ---------- Styles ---------- */
const css = `
:root{--ak-farbe:${CFG.farbe}}
.ak-bar{position:relative;z-index:900;display:flex;align-items:center;gap:10px;justify-content:center;flex-wrap:wrap;
  padding:9px 44px 9px 14px;background:var(--ak-farbe);color:#fff;font:600 14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center}
.ak-bar .ak-uhr{font-variant-numeric:tabular-nums;background:rgba(0,0,0,.22);border-radius:999px;padding:2px 10px;font-weight:700;white-space:nowrap}
.ak-bar .ak-hin{font-weight:400;opacity:.92}
.ak-bar .ak-x{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:32px;height:32px;border:0;border-radius:50%;
  background:transparent;color:#fff;font-size:20px;cursor:pointer}
.ak-bar .ak-x:hover{background:rgba(255,255,255,.18)}
.ak-alt{text-decoration:line-through;opacity:.6;font-size:.72em;font-weight:500;margin-right:.3em;white-space:nowrap}
.ak-neu{color:var(--ak-farbe);white-space:nowrap}
.ak-tag{display:inline-block;margin-left:.4em;padding:1px 7px;border-radius:999px;background:var(--ak-farbe);color:#fff;
  font:700 11px/1.5 system-ui,sans-serif;vertical-align:middle;letter-spacing:.02em;white-space:nowrap}
.ak-fab{position:fixed;left:12px;bottom:calc(88px + env(safe-area-inset-bottom));z-index:950;display:flex;align-items:center;gap:6px;
  border:0;border-radius:999px;padding:10px 14px;background:#1d2522;color:#fff;font:700 13px/1 system-ui,sans-serif;
  box-shadow:0 6px 20px rgba(0,0,0,.28);cursor:pointer}
.ak-fab .ak-punkt{width:8px;height:8px;border-radius:50%;background:#35d07f}
.ak-wrap{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}
@media(min-width:700px){.ak-wrap{align-items:center}}
.ak-pan{--ak-bg:#fff;--ak-fg:#16201c;--ak-mut:#5d6b66;--ak-lin:#dfe5e2;--ak-feld:#f4f7f5;
  background:var(--ak-bg);color:var(--ak-fg);width:min(620px,100%);max-height:92vh;overflow:auto;border-radius:18px 18px 0 0;
  padding:18px 16px 28px;font:400 15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.35)}
@media(min-width:700px){.ak-pan{border-radius:18px;padding:22px 24px 26px}}
@media(prefers-color-scheme:dark){.ak-pan{--ak-bg:#151b19;--ak-fg:#e8efec;--ak-mut:#9aa9a3;--ak-lin:#2a3431;--ak-feld:#1d2522}}
.ak-pan h2{margin:0;font-size:20px}.ak-pan h3{margin:22px 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:.05em;color:var(--ak-mut)}
.ak-kopf{display:flex;justify-content:space-between;align-items:center;gap:12px}
.ak-zu{border:0;background:var(--ak-feld);color:var(--ak-fg);width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer}
.ak-mut{color:var(--ak-mut);font-size:13px}
.ak-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
@media(min-width:520px){.ak-grid{grid-template-columns:repeat(4,1fr)}}
.ak-btn{border:1px solid var(--ak-lin);background:var(--ak-feld);color:var(--ak-fg);border-radius:12px;padding:11px 10px;
  font-weight:600;font-size:14px;line-height:1.25;font-family:inherit;cursor:pointer;text-align:center}
.ak-btn:hover{border-color:var(--ak-farbe)}
.ak-btn.ak-pri{background:var(--ak-farbe);border-color:var(--ak-farbe);color:#fff}
.ak-btn.ak-rot{background:transparent;color:#c0392b;border-color:#e5b3ad}
.ak-btn small{display:block;font-weight:400;opacity:.75;font-size:12px;margin-top:2px}
.ak-btn[disabled]{opacity:.5;cursor:wait}
.ak-karte{border:1px solid var(--ak-lin);border-radius:14px;padding:12px 14px;margin-bottom:8px;display:flex;gap:12px;align-items:center;justify-content:space-between}
.ak-karte b{display:block}
.ak-status{display:inline-block;font-size:12px;font-weight:700;border-radius:999px;padding:1px 8px;background:var(--ak-feld);margin-right:6px}
.ak-status.laeuft{background:#1f9d55;color:#fff}.ak-status.geplant{background:#d98e04;color:#fff}
.ak-form{display:grid;gap:10px}
.ak-reihe{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ak-reihe>label:only-child{grid-column:1/-1}
.ak-form label{display:grid;gap:4px;font-size:13px;font-weight:600;color:var(--ak-mut)}
.ak-form input,.ak-form select{font-size:15px;line-height:1.3;font-family:inherit;padding:10px 11px;border-radius:10px;border:1px solid var(--ak-lin);
  background:var(--ak-feld);color:var(--ak-fg);width:100%;box-sizing:border-box;min-width:0}
.ak-seg{display:grid;grid-template-columns:1fr 1fr;background:var(--ak-feld);border-radius:12px;padding:4px;gap:4px}
.ak-seg button{border:0;border-radius:9px;padding:9px;background:transparent;color:var(--ak-fg);font-weight:600;font-size:14px;font-family:inherit;cursor:pointer}
.ak-seg button.an{background:var(--ak-bg);box-shadow:0 1px 4px rgba(0,0,0,.15)}
.ak-vorschau{border-radius:12px;overflow:hidden;margin-top:4px}
.ak-vorschau .ak-bar{padding-right:14px}
.ak-preis{display:grid;grid-template-columns:1fr 110px auto;gap:8px;align-items:end;margin-bottom:8px}
.ak-msg{margin-top:10px;padding:10px 12px;border-radius:10px;font-size:14px}
.ak-msg.ok{background:#e3f6ec;color:#155d36}.ak-msg.err{background:#fde8e6;color:#8e2418}
@media(prefers-color-scheme:dark){.ak-msg.ok{background:#153826;color:#a6e8c4}.ak-msg.err{background:#431c17;color:#f6b8ae}}
.ak-liste{font-size:13px;display:grid;gap:4px}.ak-liste div{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid var(--ak-lin);padding:5px 0}
`;
const styleEl = document.createElement('style'); styleEl.textContent = css; document.head.appendChild(styleEl);

/* ---------- Zeit & Texte ---------- */
const jetzt = () => new Date(Date.now() + uhrVersatz);
const tagKey = (d) => d.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
function dauerText(ende) {
  const ms = new Date(ende) - jetzt();
  if (ms <= 0) return 'endet jetzt';
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sek = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  if (d >= 1) return `noch ${d} ${d === 1 ? 'Tag' : 'Tage'} ${h} Std.`;
  return `noch ${p(h)}:${p(m)}:${p(sek)}`;
}
function vorsatz(ende) {
  const e = new Date(ende); const heute = tagKey(jetzt());
  if (tagKey(e) === heute || tagKey(new Date(e - 1000)) === heute) return 'Nur noch heute';
  const morgen = new Date(jetzt().getTime() + 86400000);
  if (tagKey(new Date(e - 1000)) === tagKey(morgen)) return 'Nur bis morgen';
  return 'Nur bis ' + new Date(e - 1000).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric', month: 'long' });
}
function bannerHtml(a, art, mitX = true) {
  const preis = (stand?.preise || [])[0];
  let extra = '';
  if (art === 'rabatt' && preis) extra = ` <span class="ak-hin">${esc(preis.bezeichnung)}: statt ${eur(preis.cent)} nur ${eur(rabattCent(preis.cent, a.prozent))}</span>`;
  if (art === 'gratis') extra = ` <span class="ak-hin">${a.gratis_tage ? `${a.gratis_tage} Tage kostenlos` : 'Für immer kostenlos'} – gilt für jede Registrierung bis Aktionsende.</span>`;
  const hinweis = a.hinweis ? ` <span class="ak-hin">${esc(a.hinweis)}</span>` : '';
  return `<span>${vorsatz(a.ende_at)}: ${esc(a.titel)}</span>${extra}${hinweis}<span class="ak-uhr" data-ende="${esc(a.ende_at)}">${dauerText(a.ende_at)}</span>${mitX ? '<button class="ak-x" aria-label="Hinweis ausblenden">×</button>' : ''}`;
}

/* ---------- Welche Aktion gilt für wen ---------- */
function sichtbareAktion() {
  if (!stand) return null;
  const aktivBezahlt = stand.mein_status === 'active';
  if (stand.gratis && !stand.angemeldet) return { a: stand.gratis, art: 'gratis' };
  if (stand.rabatt && (!aktivBezahlt || stand.admin)) return { a: stand.rabatt, art: 'rabatt' };
  if (stand.gratis && stand.admin) return { a: stand.gratis, art: 'gratis' };
  return null;
}
function geltenderRabatt() {
  if (!stand) return 0;
  return Math.max(stand.rabatt?.prozent || 0, stand.mein_rabatt || 0);
}

/* ---------- Banner ---------- */
let bar = null;
function zeigeBanner() {
  const s = sichtbareAktion();
  const id = s ? s.art + ':' + s.a.id : '';
  if (!s || store.get('ak-weg') === id) { bar?.remove(); bar = null; return; }
  if (!bar) { bar = document.createElement('div'); bar.className = 'ak-bar'; bar.setAttribute('role', 'status'); document.body.prepend(bar); }
  if (bar.dataset.id !== id + '|' + (stand.preise?.[0]?.cent ?? '')) {
    bar.dataset.id = id + '|' + (stand.preise?.[0]?.cent ?? '');
    bar.innerHTML = bannerHtml(s.a, s.art);
    bar.querySelector('.ak-x').onclick = () => { store.set('ak-weg', id); bar.remove(); bar = null; };
  }
}

/* ---------- Preise in der App ---------- */
function basisCent(wert) {
  const [k, teiler] = String(wert).split('/');
  let cent = /^\d+$/.test(k) ? Number(k) : (stand?.preise || []).find((p) => p.schluessel === k)?.cent;
  if (cent == null) return null;
  if (teiler && Number(teiler) > 0) cent = cent / Number(teiler);
  return Math.round(cent);
}
function preiseAnwenden() {
  const p = geltenderRabatt();
  const eigen = !stand?.rabatt && stand?.mein_rabatt;
  document.querySelectorAll('[data-aktion-preis]').forEach((el) => {
    const b = basisCent(el.dataset.aktionPreis);
    if (b == null) return;
    const schluessel = b + '|' + p;
    if (el.dataset.aktionStand === schluessel) return;
    el.dataset.aktionStand = schluessel;
    el.innerHTML = p > 0
      ? `<span class="ak-alt">${eur(b)}</span><span class="ak-neu">${eur(rabattCent(b, p))}</span>${el.hasAttribute('data-aktion-ohne-tag') ? '' : `<span class="ak-tag">${eigen ? 'Dein Preis' : '−' + p + ' %'}</span>`}`
      : eur(b);
  });
}

/* ---------- Laden ---------- */
async function laden() {
  if (!CFG.url || !CFG.key) return;
  try {
    const t0 = Date.now();
    stand = await rpc('aktionen_status');
    uhrVersatz = new Date(stand.jetzt).getTime() - Math.round((t0 + Date.now()) / 2);
    window.dispatchEvent(new CustomEvent('aktionen:stand', { detail: stand }));
  } catch { /* offline: App läuft normal weiter */ }
  letzterToken = token();
  aktualisieren();
}
function aktualisieren() { zeigeBanner(); preiseAnwenden(); zeigeFab(); }

let geplant = false;
new MutationObserver(() => {
  if (geplant) return; geplant = true;
  requestAnimationFrame(() => { geplant = false; preiseAnwenden(); if (bar && !bar.isConnected) { bar = null; zeigeBanner(); } });
}).observe(document.body, { childList: true, subtree: true });

setInterval(() => {
  document.querySelectorAll('.ak-uhr[data-ende]').forEach((u) => { u.textContent = dauerText(u.dataset.ende); });
  const s = sichtbareAktion();
  if (s && new Date(s.a.ende_at) <= jetzt()) laden();
  const t = token(); if (t !== letzterToken) { letzterToken = t; laden(); }
}, 1000);
setInterval(laden, 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') laden(); });

if (CFG.kauf) {
  document.addEventListener('click', (e) => {
    if (e.target.closest?.(CFG.kauf) && token() && stand?.rabatt) rpc('aktion_sichern').catch(() => {});
  }, true);
}

/* ---------- Inhaber-Bereich ---------- */
let fab = null;
function zeigeFab() {
  if (!stand?.admin) { fab?.remove(); fab = null; return; }
  if (!fab) {
    fab = document.createElement('button'); fab.className = 'ak-fab'; fab.type = 'button';
    fab.onclick = oeffnePanel; document.body.appendChild(fab);
  }
  const laeuft = !!(stand.rabatt || stand.gratis);
  fab.innerHTML = `${laeuft ? '<span class="ak-punkt"></span>' : ''}€ Aktionen`;
  fab.title = laeuft ? 'Eine Aktion läuft gerade' : 'Preise & Aktionen verwalten';
}

let U = null; // Übersicht
const F = { art: 'rabatt', prozent: 10, gratis: 'immer', gratisTage: 30, laufzeit: 'heute', tage: 3, bis: '', start: 'sofort', startAm: '', titel: '', hinweis: '' };

function endeHeute(plusTage = 0) { const d = new Date(); d.setDate(d.getDate() + plusTage); d.setHours(23, 59, 59, 0); return d; }
function lokal(d) { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
function berechneZeiten() {
  const start = F.start === 'geplant' && F.startAm ? new Date(F.startAm) : new Date();
  let ende;
  if (F.laufzeit === 'heute') ende = endeHeute(0);
  else if (F.laufzeit === 'morgen') ende = endeHeute(1);
  else if (F.laufzeit === 'tage') { ende = new Date(start); ende.setDate(ende.getDate() + Math.max(1, Number(F.tage) || 1)); ende.setHours(23, 59, 59, 0); }
  else ende = F.bis ? new Date(F.bis) : null;
  return { start, ende };
}
const fmtZeit = (d) => new Date(d).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function panelHtml() {
  const preise = U?.preise || stand?.preise || [];
  const laufend = (U?.aktionen || []).filter((a) => a.status === 'laeuft' || a.status === 'geplant');
  const alt = (U?.aktionen || []).filter((a) => a.status !== 'laeuft' && a.status !== 'geplant').slice(0, 15);
  const { start, ende } = berechneZeiten();
  const titelAuto = F.art === 'rabatt' ? `${F.prozent} % Rabatt auf das Abo` : F.gratis === 'immer' ? 'Jetzt anmelden und dauerhaft gratis nutzen' : `Jetzt anmelden und ${F.gratisTage} Tage gratis nutzen`;
  const vorschauA = { titel: F.titel.trim() || titelAuto, hinweis: F.hinweis.trim(), prozent: Number(F.prozent), gratis_tage: F.gratis === 'immer' ? null : Number(F.gratisTage), ende_at: (ende || endeHeute()).toISOString() };
  const schnell = [
    ['rabatt', 10, 'Heute −10 %', 'bis 23:59 Uhr'], ['rabatt', 20, 'Heute −20 %', 'bis 23:59 Uhr'],
    ['rabatt', 50, 'Heute −50 %', 'bis 23:59 Uhr'], ['gratis', null, 'Heute gratis', 'Anmeldung = für immer frei'],
  ];
  return `
<div class="ak-kopf"><div><h2>Preise & Aktionen</h2><div class="ak-mut">${esc(CFG.app)} · nur für dich als Inhaber sichtbar</div></div><button class="ak-zu" data-ak="zu" aria-label="Schließen">×</button></div>
<div id="ak-msg"></div>

<h3>Läuft gerade</h3>
${laufend.length ? laufend.map((a) => `<div class="ak-karte"><div><span class="ak-status ${a.status}">${a.status === 'laeuft' ? 'läuft' : 'geplant'}</span><b>${esc(a.titel)}</b>
<span class="ak-mut">${a.status === 'geplant' ? 'Start ' + fmtZeit(a.start_at) + ' · ' : ''}Ende ${fmtZeit(a.ende_at)} · ${a.nutzer} ${a.nutzer === 1 ? 'Person' : 'Personen'} genutzt</span></div>
<button class="ak-btn ak-rot" data-ak="beenden" data-id="${a.id}">Beenden</button></div>`).join('') : '<p class="ak-mut">Keine Aktion aktiv. Deine Nutzer sehen die normalen Preise.</p>'}

<h3>Schnellstart</h3>
<div class="ak-grid">${schnell.map(([art, p, t, s]) => `<button class="ak-btn" data-ak="schnell" data-art="${art}" data-p="${p ?? ''}">${t}<small>${s}</small></button>`).join('')}</div>

<h3>Eigene Aktion</h3>
<div class="ak-form">
  <div class="ak-seg"><button type="button" class="${F.art === 'rabatt' ? 'an' : ''}" data-ak="art" data-v="rabatt">Rabatt in %</button><button type="button" class="${F.art === 'gratis' ? 'an' : ''}" data-ak="art" data-v="gratis">Gratis anmelden</button></div>
  ${F.art === 'rabatt'
    ? `<label>Rabatt in Prozent<input type="number" min="1" max="99" step="1" inputmode="numeric" data-f="prozent" value="${esc(F.prozent)}"></label>
       <p class="ak-mut" style="margin:0">Alle sehen den reduzierten Preis. Wer sich in der Zeit registriert oder auf „Abo abschließen“ tippt, behält den Rabatt auch nach Aktionsende.</p>`
    : `<div class="ak-reihe"><label>Wie lange gratis?<select data-f="gratis"><option value="immer" ${F.gratis === 'immer' ? 'selected' : ''}>Für immer</option><option value="tage" ${F.gratis === 'tage' ? 'selected' : ''}>Bestimmte Tage</option></select></label>
       ${F.gratis === 'tage' ? `<label>Anzahl Tage<input type="number" min="1" max="3650" inputmode="numeric" data-f="gratisTage" value="${esc(F.gratisTage)}"></label>` : ''}</div>
       <p class="ak-mut" style="margin:0">Jede neue Registrierung in diesem Zeitraum bekommt sofort vollen Zugang ${F.gratis === 'immer' ? 'ohne Ablaufdatum' : `für ${esc(F.gratisTage)} Tage`}. Bestehende Konten ändern sich nicht.</p>`}
  <div class="ak-reihe">
    <label>Aktion endet<select data-f="laufzeit">
      <option value="heute" ${F.laufzeit === 'heute' ? 'selected' : ''}>Heute 23:59 Uhr</option>
      <option value="morgen" ${F.laufzeit === 'morgen' ? 'selected' : ''}>Morgen 23:59 Uhr</option>
      <option value="tage" ${F.laufzeit === 'tage' ? 'selected' : ''}>Nach X Tagen</option>
      <option value="datum" ${F.laufzeit === 'datum' ? 'selected' : ''}>Datum & Uhrzeit wählen</option></select></label>
    ${F.laufzeit === 'tage' ? `<label>Anzahl Tage<input type="number" min="1" max="365" inputmode="numeric" data-f="tage" value="${esc(F.tage)}"></label>`
      : F.laufzeit === 'datum' ? `<label>Ende<input type="datetime-local" data-f="bis" value="${esc(F.bis || lokal(endeHeute(2)))}"></label>` : ''}
  </div>
  <div class="ak-reihe">
    <label>Start<select data-f="start"><option value="sofort" ${F.start === 'sofort' ? 'selected' : ''}>Sofort</option><option value="geplant" ${F.start === 'geplant' ? 'selected' : ''}>Später (planen)</option></select></label>
    ${F.start === 'geplant' ? `<label>Beginnt am<input type="datetime-local" data-f="startAm" value="${esc(F.startAm || lokal(new Date(Date.now() + 3600000)))}"></label>` : ''}
  </div>
  <label>Überschrift (optional)<input type="text" maxlength="80" data-f="titel" value="${esc(F.titel)}" placeholder="${esc(titelAuto)}"></label>
  <label>Zusatztext (optional)<input type="text" maxlength="240" data-f="hinweis" value="${esc(F.hinweis)}" placeholder="z. B. Zum Start der neuen Version"></label>
  <div class="ak-mut">Vorschau (${start ? fmtZeit(start) : ''} bis ${ende && !isNaN(ende) ? fmtZeit(ende) : '–'}):</div>
  <div class="ak-vorschau"><div class="ak-bar">${bannerHtml(vorschauA, F.art, false)}</div></div>
  <button class="ak-btn ak-pri" data-ak="starten">Aktion starten</button>
</div>

<h3>Grundpreise</h3>
${preise.length ? preise.map((p) => `<div class="ak-preis"><label class="ak-form" style="display:block"><span class="ak-mut" style="display:block;font-weight:600">${esc(p.bezeichnung)} (${p.intervall === 'jahr' ? 'pro Jahr' : p.intervall === 'monat' ? 'pro Monat' : 'einmalig'})</span></label>
<label class="ak-form"><input type="text" inputmode="decimal" data-preis="${esc(p.schluessel)}" value="${(p.cent / 100).toFixed(2).replace('.', ',')}" aria-label="Preis ${esc(p.bezeichnung)} in Euro"></label>
<button class="ak-btn" data-ak="preis" data-k="${esc(p.schluessel)}">Speichern</button></div>`).join('') : '<p class="ak-mut">Keine Preise hinterlegt.</p>'}
<p class="ak-mut">Neue Preise gelten sofort in der App. Bestehende Abos werden nicht automatisch geändert.</p>

${(U?.nutzer || []).length ? `<h3>Wer hat eine Aktion genutzt?</h3><div class="ak-liste">${U.nutzer.slice(0, 50).map((n) => `<div><span>${esc(n.email)}</span><span class="ak-mut">${n.art === 'gratis' ? (n.bis ? 'gratis bis ' + new Date(n.bis).toLocaleDateString('de-DE') : 'gratis für immer') : '−' + n.prozent + ' % gesichert'} · ${n.am ? new Date(n.am).toLocaleDateString('de-DE') : ''}</span></div>`).join('')}</div>` : ''}

${alt.length ? `<h3>Frühere Aktionen</h3><div class="ak-liste">${alt.map((a) => `<div><span>${esc(a.titel)}</span><span class="ak-mut">${a.status === 'beendet' ? 'beendet' : 'abgelaufen'} ${fmtZeit(a.beendet_at || a.ende_at)} · ${a.nutzer} genutzt</span></div>`).join('')}</div>` : ''}
`;
}

let wrap = null;
async function oeffnePanel() {
  panelOffen = true;
  if (!wrap) {
    wrap = document.createElement('div'); wrap.className = 'ak-wrap';
    wrap.innerHTML = '<div class="ak-pan" role="dialog" aria-modal="true" aria-label="Preise und Aktionen"></div>';
    wrap.addEventListener('click', onKlick); wrap.addEventListener('input', onEingabe); wrap.addEventListener('change', onEingabe);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panelOffen) schliessen(); });
  }
  document.body.appendChild(wrap);
  zeichne();
  try { U = await rpc('aktion_admin_uebersicht'); zeichne(); } catch (e) { meldung(e.message, true); }
}
function schliessen() { panelOffen = false; wrap?.remove(); }
function zeichne(nachricht) {
  if (!wrap) return;
  const pan = wrap.querySelector('.ak-pan'); const y = pan.scrollTop;
  const fokus = document.activeElement?.dataset?.f; const pos = document.activeElement?.selectionStart;
  pan.innerHTML = panelHtml(); pan.scrollTop = y;
  if (fokus) { const el = pan.querySelector(`[data-f="${fokus}"]`); if (el) { el.focus(); try { if (pos != null) el.setSelectionRange(pos, pos); } catch { /* */ } } }
  if (nachricht) meldung(...nachricht);
}
function meldung(text, fehler = false) {
  const m = wrap?.querySelector('#ak-msg'); if (!m) return;
  m.innerHTML = `<div class="ak-msg ${fehler ? 'err' : 'ok'}">${esc(text)}</div>`;
  m.scrollIntoView({ block: 'nearest' });
}
function onEingabe(e) {
  const f = e.target.dataset.f; if (!f) return;
  F[f] = e.target.value;
  if (e.target.tagName === 'SELECT') {
    if (e.type !== 'change') return;
    if (f === 'laufzeit' && F.laufzeit === 'datum' && !F.bis) F.bis = lokal(endeHeute(2));
    if (f === 'start' && F.start === 'geplant' && !F.startAm) F.startAm = lokal(new Date(Date.now() + 3600000));
    zeichne();
  }
  else { const v = wrap.querySelector('.ak-vorschau .ak-bar'); if (v) { const { ende } = berechneZeiten(); const tA = F.art === 'rabatt' ? `${F.prozent} % Rabatt auf das Abo` : F.gratis === 'immer' ? 'Jetzt anmelden und dauerhaft gratis nutzen' : `Jetzt anmelden und ${F.gratisTage} Tage gratis nutzen`; v.innerHTML = bannerHtml({ titel: F.titel.trim() || tA, hinweis: F.hinweis.trim(), prozent: Number(F.prozent), gratis_tage: F.gratis === 'immer' ? null : Number(F.gratisTage), ende_at: (ende && !isNaN(ende) ? ende : endeHeute()).toISOString() }, F.art, false); } }
}
async function mitSperre(btn, fn) {
  btn.disabled = true;
  try { await fn(); } catch (e) { meldung(e.message, true); } finally { btn.disabled = false; }
}
async function neuLaden(text) { U = await rpc('aktion_admin_uebersicht'); await laden(); zeichne([text]); }

async function starte(art, prozent, gratisTage, start, ende, titel, hinweis) {
  if (!ende || isNaN(ende)) throw new Error('Bitte ein gültiges Ende wählen.');
  if (ende <= new Date()) throw new Error('Das Ende liegt in der Vergangenheit.');
  if (art === 'rabatt' && !(prozent >= 1 && prozent <= 99)) throw new Error('Rabatt bitte zwischen 1 und 99 % angeben.');
  const wann = `bis ${fmtZeit(ende)}`;
  const frage = art === 'gratis'
    ? `Gratis-Aktion starten?\n\nJeder, der sich ${wann} neu registriert, bekommt ${CFG.app} ${gratisTage ? gratisTage + ' Tage' : 'für immer'} kostenlos.`
    : `${prozent} % Rabatt starten?\n\nAlle sehen ${wann} den reduzierten Preis.`;
  if (!window.confirm(frage)) return false;
  await rpc('aktion_starten', { p_art: art, p_prozent: art === 'rabatt' ? prozent : null, p_gratis_tage: art === 'gratis' ? gratisTage : null,
    p_titel: titel || null, p_hinweis: hinweis || null, p_start: start ? start.toISOString() : null, p_ende: ende.toISOString() });
  return true;
}

async function onKlick(e) {
  if (e.target === wrap) return schliessen();
  const b = e.target.closest('[data-ak]'); if (!b) return;
  const was = b.dataset.ak;
  if (was === 'zu') return schliessen();
  if (was === 'art') { F.art = b.dataset.v; return zeichne(); }
  if (was === 'schnell') {
    return mitSperre(b, async () => {
      const art = b.dataset.art; const p = Number(b.dataset.p) || null;
      if (await starte(art, p, null, null, endeHeute(0), '', '')) await neuLaden(art === 'gratis' ? 'Gratis-Aktion läuft bis heute 23:59 Uhr.' : `${p} % Rabatt läuft bis heute 23:59 Uhr.`);
    });
  }
  if (was === 'starten') {
    return mitSperre(b, async () => {
      const { start, ende } = berechneZeiten();
      const gT = F.gratis === 'immer' ? null : Math.round(Number(F.gratisTage));
      if (F.art === 'gratis' && gT != null && !(gT >= 1 && gT <= 3650)) throw new Error('Gratis-Tage bitte zwischen 1 und 3650.');
      if (F.start === 'geplant' && (!F.startAm || isNaN(start))) throw new Error('Bitte einen Startzeitpunkt wählen.');
      if (await starte(F.art, Math.round(Number(F.prozent)), gT, F.start === 'geplant' ? start : null, ende, F.titel.trim(), F.hinweis.trim())) {
        F.titel = ''; F.hinweis = '';
        await neuLaden(F.start === 'geplant' ? 'Aktion ist geplant.' : 'Aktion läuft jetzt.');
      }
    });
  }
  if (was === 'beenden') {
    if (!window.confirm('Diese Aktion jetzt beenden? Bereits gesicherte Rabatte und Gratis-Zugänge bleiben bestehen.')) return;
    return mitSperre(b, async () => { await rpc('aktion_beenden', { p_id: b.dataset.id }); await neuLaden('Aktion beendet.'); });
  }
  if (was === 'preis') {
    return mitSperre(b, async () => {
      const k = b.dataset.k; const inp = wrap.querySelector(`[data-preis="${CSS.escape(k)}"]`);
      const v = String(inp.value).trim().replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
      const n = Number(v);
      if (!v || !isFinite(n) || n < 0 || n > 1000) throw new Error('Bitte einen Preis zwischen 0 und 1000 € eingeben, z. B. 2,99.');
      await rpc('preis_setzen', { p_schluessel: k, p_cent: Math.round(n * 100) });
      await neuLaden(`Preis gespeichert: ${eur(Math.round(n * 100))}.`);
    });
  }
}

laden();
