// Stundenzettel – Urlaubsplaner (übernommen aus der Wachbuch-App)
// Urlaubskonto je Jahr, Urlaubszeiträume mit Status, Urlaubsantrag (Formular, Vorschau, PDF).
import { feiertagName, feiertage, tagKey, REGIONEN } from './calc.js?v=10';
import { foldCards } from './fold.js?v=2';
import { mehrfachInit } from './urlaub-mehrfach.js?v=1';

let X; // Kontext aus app.js: { api, S, esc, toast, ladePdfLib, render }
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- Hilfen ---------------- */
export const VAC_STATUS = { planned: 'geplant', requested: 'beantragt', approved: 'genehmigt', taken: 'genommen', rejected: 'abgelehnt', canceled: 'storniert' };
const Re = VAC_STATUS;
const pillKlasse = (s) => ({ approved: 'ul-ok', taken: 'ul-ur', rejected: 'ul-rot', canceled: 'ul-rot', requested: 'ul-acc' })[s] || '';
const ZAEHLT = ['planned', 'requested', 'approved', 'taken']; // reservierte Urlaubstage
const heute = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const P = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
const T = (n) => (Number(n) || 0).toLocaleString('de-DE', { maximumFractionDigits: 1 });
const Fe = (n) => (Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const kt = (e) => (e ? `${e.slice(8, 10)}.${e.slice(5, 7)}.${e.slice(2, 4)}` : '');
const ne = (n) => (n == null || n === '' ? '' : String(Math.round(Number(n) * 10) / 10).replace('.', ','));
const zahl = (v) => { const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.'); if (!s) return null; return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN; };
const plusTag = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const isoWt = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay() || 7; // 1 = Mo … 7 = So
const WT_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const region = () => X.S.profil.region || 'HH';
const profil = () => X.S.profil;
const darf = () => !!X.S.zugang?.access;
const arbeitstage = () => (Array.isArray(profil().vacation_weekdays) && profil().vacation_weekdays.length ? profil().vacation_weekdays.map(Number) : [1, 2, 3, 4, 5]);
const niederlassung = (p) => p.branch_name ?? (region() === 'HH' ? 'Niederlassung Hamburg' : '');
const regionName = () => REGIONEN[region()]?.n || region();

// Urlaubstage zählen: nur eingestellte Arbeitstage, gesetzliche Feiertage werden nicht abgezogen
export function zaehleUrlaub(start, ende, reg = region(), wt = [1, 2, 3, 4, 5]) {
  if (ende < start) throw new Error('Urlaubsende liegt vor Urlaubsbeginn.');
  const n = { calendarDays: 0, weekendDays: 0, holidayDays: 0, usedDays: 0, holidays: [] };
  for (let s = start; s <= ende; s = plusTag(s, 1)) {
    n.calendarDays += 1;
    if (n.calendarDays > 400) throw new Error('Der Zeitraum ist zu lang (höchstens ein Jahr).');
    if (!wt.includes(isoWt(s))) { n.weekendDays += 1; continue; }
    const f = feiertagName(reg, Date.parse(s + 'T00:00:00Z'));
    if (f) { n.holidayDays += 1; n.holidays.push({ date: s, name: f }); continue; }
    n.usedDays += 1;
  }
  return n;
}
export function urlaubstageImJahr(eintrag, jahr, reg, wt) {
  if (eintrag.allocation_year != null) return Number(eintrag.allocation_year) === Number(jahr) ? (eintrag.manual_days ? Number(eintrag.days_count || 0) : zaehleUrlaub(eintrag.start_date, eintrag.end_date, reg, wt).usedDays) : 0;
  const von = `${jahr}-01-01`, bis = `${jahr}-12-31`;
  if (eintrag.end_date < von || eintrag.start_date > bis) return 0;
  const start = eintrag.start_date > von ? eintrag.start_date : von;
  const ende = eintrag.end_date < bis ? eintrag.end_date : bis;
  const imJahr = zaehleUrlaub(start, ende, reg, wt).usedDays;
  if (!eintrag.manual_days) return imJahr;
  if (eintrag.start_date.slice(0, 4) === eintrag.end_date.slice(0, 4)) return Number(eintrag.days_count || 0);
  const gesamt = Number(eintrag.days_count || 0);
  const basis = zaehleUrlaub(eintrag.start_date, eintrag.end_date, reg, wt).usedDays;
  const kumuliert = (y) => {
    if (`${y}-12-31` < eintrag.start_date) return 0;
    const bisJahr = `${y}-12-31` < eintrag.end_date ? `${y}-12-31` : eintrag.end_date;
    const anteil = basis ? zaehleUrlaub(eintrag.start_date, bisJahr, reg, wt).usedDays / basis
      : (Date.parse(bisJahr) - Date.parse(eintrag.start_date) + 86400000) / (Date.parse(eintrag.end_date) - Date.parse(eintrag.start_date) + 86400000);
    return Math.round(gesamt * anteil * 10) / 10;
  };
  return kumuliert(jahr) - kumuliert(jahr - 1);
}
// Kalenderurlaub und Antrag sind zwei Ansichten derselben Urlaubstage.
export function urlaubKalenderAbgleich(eintrag, schichten, reg, wt) {
  const tage = []; let kalendertage = 0;
  for (let d = eintrag.start_date; d <= eintrag.end_date; d = plusTag(d,1)) {
    if (++kalendertage > 400) throw new Error('Der Urlaubszeitraum ist zu lang.');
    if (wt.includes(isoWt(d)) && !feiertagName(reg,Date.parse(d+'T00:00:00Z'))) tage.push(d);
  }
  const vorhanden = new Set(), konflikte = [];
  for (const datum of tage) {
    const start = Date.parse(datum+'T00:00:00Z'), ende = start + 86400000;
    for (const sh of schichten) {
      if (sh.art === 'urlaub' && sh.datum === datum) vorhanden.add(datum);
      if (sh.art === 'krank' && sh.datum === datum) konflikte.push({datum,art:'krank'});
      if (sh.art === 'dienst' && sh.beginn && sh.ende) {
        const [bh,bm] = sh.beginn.split(':').map(Number), [eh,em] = sh.ende.split(':').map(Number);
        const basis = Date.parse(sh.datum+'T00:00:00Z'), von = basis+(bh*60+bm)*60000;
        let bis = basis+(eh*60+em)*60000;
        if (bis <= von) bis += 86400000;
        if (von < ende && bis > start) konflikte.push({datum,art:'dienst'});
      }
    }
  }
  return {tage,vorhanden:[...vorhanden].sort(),konflikte};
}
export function kalenderUrlaubPruefen(kandidaten, schichten, urlaube, reg, wt) {
  for (const k of kandidaten) {
    if (k.art === 'urlaub') {
      if (schichten.some(s => s.art === 'urlaub' && s.datum === k.datum)) return `Am ${P(k.datum)} ist Urlaub bereits im Kürzelkalender eingetragen. Jeder Tag kann nur einmal eingetragen werden.`;
      const a = urlaubKalenderAbgleich({start_date:k.datum,end_date:k.datum},schichten,reg,[1,2,3,4,5,6,7]);
      if (a.konflikte.length) return `Am ${P(k.datum)} ist bereits Dienst oder Krankheit eingetragen. Bitte zuerst den vorhandenen Eintrag ändern.`;
    } else if (k.art === 'dienst' || k.art === 'krank') {
      const vorher = plusTag(k.datum,-1), nachher = plusTag(k.datum,1);
      const kalender = schichten.filter(s => s.art === 'urlaub').map(s => ({start_date:s.datum,end_date:s.datum,status:'taken'}));
      for (const v of [...urlaube.filter(v=>ZAEHLT.includes(v.status)),...kalender]) {
        const von = v.start_date > vorher ? v.start_date : vorher, bis = v.end_date < nachher ? v.end_date : nachher;
        if (bis < von) continue;
        const a = urlaubKalenderAbgleich({start_date:von,end_date:bis},[k],reg,kalender.includes(v)?[1,2,3,4,5,6,7]:wt);
        if (a.konflikte.length) return `Am ${P(a.konflikte[0].datum)} ist bereits Urlaub eingetragen. Dienst oder Krankheit kann sich damit nicht überschneiden.`;
      }
    }
  }
  return null;
}
// Ein gemeinsames Urlaubskonto für Planer, Dashboard und Anträge.
export function urlaubVerbrauch(liste, schichten, jahr, reg, wt, ausnehmen = null) {
  const gueltig = liste.filter(v => ZAEHLT.includes(v.status));
  const geplant = gueltig.filter(v => !ausnehmen?.id || v.id !== ausnehmen.id)
    .reduce((n, v) => n + urlaubstageImJahr(v, jahr, reg, wt), 0);
  const zusatz = new Set(schichten.filter(s => s.art === 'urlaub' && s.datum.startsWith(`${jahr}-`)
    && wt.includes(isoWt(s.datum)) && !feiertagName(reg, Date.parse(s.datum + 'T00:00:00Z'))
    && !gueltig.some(v => v.start_date <= s.datum && v.end_date >= s.datum)
    && !(ausnehmen && ausnehmen.start_date <= s.datum && ausnehmen.end_date >= s.datum))
    .map(s => s.datum));
  return geplant + zusatz.size;
}
const rest = ({ carryover: e, entitlement: t, alreadyTaken: a, requested: i }) => { const n = (s) => Math.round((Number(s) || 0) * 10) / 10; return n(n(e) + n(t) - n(a) - n(i)); };

/* ---------------- Daten ---------------- */
const ladeUrlaube = (von, bis) => X.api(`sz_vacations?select=*&start_date=lte.${bis}&end_date=gte.${von}&order=start_date.asc`);
const ladeUrlaubsjahr = y => X.api('sz_vacations?select=*&order=start_date.asc');
const ladeJahr = async (y) => (await X.api(`sz_leave_years?select=*&year=eq.${y}`))[0] || null;
const speichereJahr = (y, ent, car) => X.api('sz_leave_years?on_conflict=user_id,year', { method: 'POST', body: { year: y, entitlement_days: ent, carryover_days: car }, prefer: 'resolution=merge-duplicates,return=minimal' });
async function speichereUrlaub(v) {
  const payload={...v,calendar_dates:urlaubKalenderAbgleich(v,[],region(),arbeitstage()).tage};
  if(v.id)await X.api(`sz_vacations?id=eq.${v.id}`,{method:'PATCH',body:(({id,...r})=>r)(payload),prefer:'return=minimal'});
  else await X.api('sz_vacations',{method:'POST',body:payload,prefer:'return=minimal'});
  // Kalender und Lohnberechnung sofort auf die atomar gespeicherten Einträge aktualisieren.
  X.S.jahr=null;X.S.schichtenStand=(X.S.schichtenStand||0)+1;
  if(X.ladeMonat)try{await X.ladeMonat();}catch{X.S.kalenderNeuLaden=true;}
}

const loescheUrlaub = async id => { await X.api(`sz_vacations?id=eq.${id}`,{method:'DELETE'});X.S.jahr=null;if(X.ladeMonat)try{await X.ladeMonat();}catch{X.S.kalenderNeuLaden=true;} };
const ladeSchichten = (von, bis) => X.api(`sz_shifts?select=id,datum,art,beginn,ende&datum=gte.${plusTag(von,-1)}&datum=lte.${bis}&order=datum.asc`);
async function profilSpeichern(felder) {
  const r = await X.api(`sz_profile?user_id=eq.${profil().user_id}`, { method: 'PATCH', body: felder, prefer: 'return=representation' });
  if (r?.[0]) X.S.profil = r[0];
}
const jahrCache = new Map();
async function jahrDaten(y) {
  if (!jahrCache.has(y)) { const [leave, list, shifts] = await Promise.all([ladeJahr(y), ladeUrlaubsjahr(y), ladeSchichten(`${y}-01-01`, `${y}-12-31`)]); jahrCache.set(y, { leave, list, shifts }); }
  return jahrCache.get(y);
}

/* ---------------- Dialoge ---------------- */
function dialog({ titel, html, breit = false, onOpen, knoepfe }) {
  return new Promise((fertig) => {
    const w = document.createElement('div');
    w.className = 'ul-dlg';
    w.innerHTML = `<div class="ul-box${breit ? ' breit' : ''}" role="dialog" aria-modal="true" aria-label="${esc(titel)}">
      <div class="ul-kopf"><b>${esc(titel)}</b><button class="ul-x" aria-label="Schließen">×</button></div>
      <div class="ul-rumpf">${html}<p class="fehler" data-fehler hidden></p></div>
      <div class="ul-fuss">${knoepfe.map((k, i) => `<button class="btn${k.pri ? ' pri' : ''}${k.gefahr ? ' rot' : ''}" data-k="${i}">${esc(k.t)}</button>`).join('')}</div></div>`;
    document.body.appendChild(w);
    document.body.classList.add('ul-offen');
    const zu = (wert) => { w.remove(); if (!$('.ul-dlg')) document.body.classList.remove('ul-offen'); fertig(wert); };
    const fehler = (t) => { const f = $('[data-fehler]', w); f.textContent = t || ''; f.hidden = !t; if (t) f.scrollIntoView({ block: 'nearest' }); };
    w.fehler = fehler;
    $('.ul-x', w).onclick = () => zu(null);
    w.addEventListener('keydown', (e) => { if (e.key === 'Escape') zu(null); });
    $$('[data-k]', w).forEach((b) => {
      b.onclick = async () => {
        const k = knoepfe[+b.dataset.k];
        fehler('');
        b.disabled = true;
        try {
          if (k.pruefe && !(await k.pruefe(w, fehler))) return;
          zu(typeof k.wert === 'function' ? k.wert(w) : k.wert);
        } catch (e) { fehler(e.message); } finally { b.disabled = false; }
      };
    });
    onOpen?.(w);
    setTimeout(() => $('input,select,button.pri', w)?.focus?.(), 30);
  });
}
const frage = (titel, html, ja = 'OK', gefahr = false) => dialog({ titel, html, knoepfe: [{ t: 'Abbrechen', wert: false }, { t: ja, wert: true, pri: !gefahr, gefahr }] });

/* ---------------- Seite ---------------- */
export async function renderUrlaub(ctx, jahr) {
  X = ctx;
  jahrCache.clear();
  const el = $('#inhalt');
  const a = jahr || X.S.urlaubJahr || Number(heute().slice(0, 4));
  X.S.urlaubJahr = a;
  el.innerHTML = '<section class="card"><p class="hinweis">Urlaub wird geladen …</p></section>';
  let i, n, shifts;
  try { [i, n, shifts] = await Promise.all([ladeUrlaubsjahr(a), ladeJahr(a), ladeSchichten(`${a}-01-01`, `${a}-12-31`)]); }
  catch (e) { el.innerHTML = `<section class="card"><p class="fehler">${esc(e.message)}</p></section>`; return; }
  if (X.S.ansicht !== 'urlaub') return;
  const p = profil(), s = darf();
  const o = Number(n?.entitlement_days ?? p.annual_leave_days ?? 30), r = Number(n?.carryover_days || 0);
  const u = i.filter((m) => !['rejected', 'canceled'].includes(m.status));
  const tageImJahr = (l) => urlaubstageImJahr(l, a, region(), arbeitstage());
  const g = urlaubVerbrauch(i, shifts, a, region(), arbeitstage());
  const b = heute();
  const nurZettel = g - u.reduce((n,l) => n + tageImJahr(l),0);
  const y = nurZettel + u.filter((m) => m.status === 'taken' || (m.status === 'approved' && m.end_date < b)).reduce((m, l) => m + tageImJahr(l), 0);
  const beantragt = u.filter(m => m.status === 'requested').reduce((n, l) => n + tageImJahr(l), 0);
  const naechster = u.filter(m => m.end_date >= b).sort((x, z) => x.start_date.localeCompare(z.start_date))[0];
  const visible = i.filter(v => (v.start_date <= `${a}-12-31` && v.end_date >= `${a}-01-01`) || Number(v.allocation_year) === a);
  const monate = [...new Set(visible.map(l => l.start_date.slice(0, 7)))];
  const wt = arbeitstage();
  const moFr = wt.length === 5 && wt.every((m) => m <= 5);
  const fei = feiertage(region(), a).map(([t, name]) => [tagKey(t), name]);
  const verf = o + r - g;
  el.innerHTML = `
    ${s ? '' : '<div class="banner warn">Dein Testzeitraum ist abgelaufen. Urlaub ansehen geht weiter – zum Eintragen bitte ein Abo abschließen. <button class="btn klein" id="u-abo">Zum Abo</button></div>'}
    <div class="calendar-heading"><h1>Urlaub &amp; Kalender</h1><div class="calendar-tabs" aria-label="Kalenderbereiche"><button type="button" data-calendar-back>Kürzelkalender</button><button type="button" data-calendar-back="shifts">Meine Schichten</button><span aria-current="page">Urlaub</span></div></div>
    <section class="card">
      <div class="reihe" style="justify-content:space-between;align-items:center">
        <div><h1 style="margin:0">Urlaub ${a}</h1><p class="hinweis" style="margin-top:2px">Gezählt werden ${moFr ? 'Montag bis Freitag' : 'deine eingestellten Arbeitstage'}, ohne gesetzliche Feiertage.</p></div>
        <div class="monat" style="gap:8px"><button id="u-zur" aria-label="Vorjahr">‹</button><button id="u-vor" aria-label="Folgejahr">›</button></div>
      </div>
      <div class="kacheln" style="margin-top:12px">
        <div class="kachel k-sum"><span>Jahresurlaub</span><b>${T(o)}</b>${r ? `<small class="ul-klein">+ ${T(r)} Übertrag</small>` : ''}</div>
        <div class="kachel k-tag"><span>Bereits verwendet</span><b>${T(g)}</b><small class="ul-klein">davon genommen: ${T(y)}</small></div>
        <div class="kachel k-sum"><span>Beantragt</span><b>${T(beantragt)}</b></div>
        <div class="kachel k-ur"><span>Verfügbar</span><b class="${verf < 0 ? 'c-f' : 'c-u'}">${T(verf)}</b></div>
      </div>
      <p class="hinweis">Nächster Urlaub: ${naechster ? `${P(naechster.start_date)} bis ${P(naechster.end_date)} (${Re[naechster.status] || naechster.status})` : 'kein kommender Urlaub eingetragen'}</p>
      <div class="ul-meter"><span style="width:${Math.min(100, (g / Math.max(1, o + r)) * 100)}%"></span></div>
      ${s ? '<div class="reihe" style="margin-top:12px"><button class="btn klein" id="u-jahr">Jahresurlaub ändern</button></div>' : ''}
    </section>
    <section class="card">
      <div class="reihe" style="justify-content:space-between;align-items:center;margin-bottom:8px">
        <h2 style="margin:0">Urlaubszeiträume</h2>
        ${s ? '<div class="reihe"><button class="btn klein" id="u-neu">+ Urlaub eintragen</button><button class="btn pri klein" id="u-antrag">Urlaubsantrag ausfüllen</button></div>' : ''}
      </div>
      <div class="ul-liste">
        ${visible.length ? monate.map(monat => `<div class="ul-monat"><h3>${new Date(monat + '-01T00:00:00Z').toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3>${visible.filter(m => m.start_date.startsWith(monat)).map((m) => `<div class="ul-zeile">
          <div class="ul-haupt">
            <b>${P(m.start_date)} – ${P(m.end_date)}</b>
            <span class="ul-meta"><strong>${T(m.days_count)} Urlaubstage</strong>${m.calendar_days != null ? ` · ${m.calendar_days} Kalendertage · ${m.weekend_days} Wochenend-/freie Tage · ${m.holiday_days} Feiertage` : ''}${m.manual_days ? ' · manuell' : ''}${m.allocation_year ? ` · Urlaubskonto ${m.allocation_year}` : ''}
              <span class="ul-pill ${pillKlasse(m.status)}">${Re[m.status] || m.status}</span></span>
            ${m.note ? `<span class="ul-meta">${esc(m.note)}</span>` : ''}
          </div>
          <div class="ul-aktion"><button class="btn klein" data-req="${m.id}" aria-label="Urlaubsantrag als PDF">Antrag</button>${s ? `<button class="btn klein" data-edit="${m.id}" aria-label="Bearbeiten">Bearbeiten</button><button class="btn klein rot" data-del="${m.id}" aria-label="Löschen">Löschen</button>` : ''}</div>
        </div>`).join('')}</div>`).join('') : `<div class="ul-leer">Für ${a} ist noch kein Urlaub eingetragen.</div>`}
      </div>
    </section>
    <section class="card">
      <h2>Extra-Ordner: Genehmigte Anträge</h2>
      <p class="hinweis">Hier liegen die vom Vorgesetzten genehmigten Anträge als PDF – als Nachweis für dich. Ablegen: In der Liste oben beim Antrag auf „Genehmigt ablegen“ tippen.</p>
      <div id="ul-nachweise-liste"></div>
    </section>
    <section class="card">
      <h2>Gesetzliche Feiertage ${a} · ${esc(regionName())}</h2>
      <div class="feiertage">${fei.map(([d, l]) => `<div><span>${esc(l)}</span><span class="d" ${d < b ? 'style="opacity:.6"' : ''}>${P(d)}</span></div>`).join('')}</div>
    </section>
    <section class="card">
      <h2>Einstellungen Urlaub</h2>
      <div class="raster">
        <label>Jahresurlaub (Standard)<input id="u-std" inputmode="decimal" value="${ne(p.annual_leave_days ?? 30)}"></label>
        <label>Berechnung der Urlaubstage<select id="u-modus"><option value="auto" ${p.vacation_calc_mode !== 'manual' ? 'selected' : ''}>Automatisch</option><option value="manual" ${p.vacation_calc_mode === 'manual' ? 'selected' : ''}>Manuell überschreibbar</option></select></label>
        <label>Niederlassung (für den Antrag)<input id="u-nl" maxlength="60" value="${esc(niederlassung(p))}"></label>
      </div>
      <div style="margin-top:12px"><span class="ul-label">Arbeitstage (zählen als Urlaubstag)</span>
        <div class="reihe"><button class="btn klein" id="u-fuenf" type="button">Mo–Fr</button><button class="btn klein" id="u-sechs" type="button">Mo–Sa (Sechstagewoche)</button></div>
        <div class="ul-wt">${WT_KURZ.map((t, k) => `<label class="ul-wt-k"><input type="checkbox" value="${k + 1}" ${wt.includes(k + 1) ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div>
      <div style="margin-top:12px"><span class="ul-label">Firmenlogo im Kopf des Urlaubsantrags</span>
        <div class="reihe" style="align-items:center">
          ${p.urlaub_logo ? `<img src="${esc(p.urlaub_logo)}" alt="Logo" class="ul-logo">` : '<span class="hinweis" style="margin:0">Kein Logo hinterlegt.</span>'}
          <label class="btn klein" style="display:inline-block;color:var(--ink)">Logo wählen<input type="file" id="u-logo" accept="image/png,image/jpeg,image/webp" hidden></label>
          ${p.urlaub_logo ? '<button class="btn klein rot" id="u-logo-weg">Logo entfernen</button>' : ''}
        </div></div>
      <div class="reihe" style="margin-top:14px"><button class="btn pri" id="u-einst">Einstellungen speichern</button></div>
    </section>`;
  foldCards(el, 'urlaub', [
    {index:1,key:'zeitraeume',label:'Urlaubszeiträume',open:true},
    {index:2,key:'nachweise',label:'Extra-Ordner: Genehmigte Anträge'},
    {index:3,key:'feiertage',label:`Gesetzliche Feiertage ${a}`},
    {index:4,key:'einstellungen',label:'Einstellungen Urlaub'}
  ]);

  el.querySelectorAll('[data-calendar-back]').forEach(button=>button.onclick=async()=>{X.S.ansicht='zettel';await X.ladeMonat();X.render();setTimeout(()=>{const target=document.getElementById(button.dataset.calendarBack==='shifts'?'stundenzettel-liste':'kuerzel-kalender');target?.dispatchEvent(new Event('fold-open'));target?.scrollIntoView({behavior:'smooth',block:'start'});},0);});
  const neu = () => renderUrlaub(X, a);
  $('#u-zur').onclick = () => renderUrlaub(X, a - 1);
  $('#u-vor').onclick = () => renderUrlaub(X, a + 1);
  if ($('#u-abo')) $('#u-abo').onclick = () => { X.S.ansicht = 'konto'; X.render(); };
  if ($('#u-neu')) $('#u-neu').onclick = () => urlaubDialog(null, neu);
  if ($('#u-antrag')) $('#u-antrag').onclick = () => antragDialog(null, neu);
  if ($('#u-jahr')) $('#u-jahr').onclick = () => jahrDialog(a, n, neu);
  $$('[data-req]').forEach((m) => { m.onclick = async () => { const l = i.find((q) => q.id === m.dataset.req); try { if (s) await antragDialog(l, neu); else await antragErneutOeffnen(l); } catch (e) { X.toast(e.message); } }; });
  $$('[data-edit]').forEach((m) => { m.onclick = () => urlaubDialog(i.find((l) => l.id === m.dataset.edit), neu); });
  $$('[data-del]').forEach((m) => {
    m.onclick = async () => {
      const l = i.find((q) => q.id === m.dataset.del);
      if (!(await frage('Urlaub löschen', `<p>Möchtest du diesen Eintrag wirklich löschen? (${P(l.start_date)} – ${P(l.end_date)})</p><p class="hinweis">Ein dazu abgelegter Nachweis (genehmigter Antrag) wird dabei ebenfalls gelöscht.</p>`, 'Löschen', true))) return;
      try { await loescheUrlaub(l.id); jahrCache.clear(); X.toast('Eintrag wurde gelöscht.'); neu(); } catch (e) { X.toast(e.message); }
    };
  });
  mehrfachInit({ X, el, liste: i, darf: s, neu, antragWerte, antragPdf, dialog, frage, speichern, logo: () => profil().urlaub_logo || null });
  // Einstellungen
  const waehleWoche = (anzahl) => $$('.ul-wt input').forEach((feld) => { feld.checked = Number(feld.value) <= anzahl; });
  $('#u-fuenf').onclick = () => waehleWoche(5);
  $('#u-sechs').onclick = () => waehleWoche(6);
  $('#u-einst').onclick = async (ev) => {
    const std = zahl($('#u-std').value);
    if (std == null || Number.isNaN(std) || std < 0 || std > 366) return X.toast('Jahresurlaub bitte als Zahl von 0 bis 366 eingeben.');
    const tage = $$('.ul-wt input').filter((c) => c.checked).map((c) => +c.value);
    if (!tage.length) return X.toast('Bitte mindestens einen Arbeitstag wählen.');
    ev.target.disabled = true;
    try { await profilSpeichern({ annual_leave_days: std, vacation_weekdays: tage, vacation_calc_mode: $('#u-modus').value, branch_name: $('#u-nl').value.trim() }); jahrCache.clear(); X.toast('Erfolgreich gespeichert.'); neu(); }
    catch (e) { X.toast(e.message); ev.target.disabled = false; }
  };
  $('#u-logo').onchange = async (ev) => {
    const f = ev.target.files?.[0]; if (!f) return;
    try { const d = await logoVerkleinern(f); await profilSpeichern({ urlaub_logo: d }); X.toast('Logo gespeichert.'); neu(); }
    catch (e) { X.toast(e.message); }
  };
  if ($('#u-logo-weg')) $('#u-logo-weg').onclick = async () => { try { await profilSpeichern({ urlaub_logo: null }); X.toast('Logo entfernt.'); neu(); } catch (e) { X.toast(e.message); } };
}

function logoVerkleinern(datei) {
  return new Promise((ok, nein) => {
    if (datei.size > 8 * 1024 * 1024) return nein(new Error('Das Bild ist zu groß (höchstens 8 MB).'));
    const img = new Image();
    const u = URL.createObjectURL(datei);
    img.onload = () => {
      URL.revokeObjectURL(u);
      const f = Math.min(1, 900 / img.width, 260 / img.height);
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * f)); c.height = Math.max(1, Math.round(img.height * f));
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
      let d = c.toDataURL('image/png');
      if (d.length > 600000) { const c2 = document.createElement('canvas'); c2.width = c.width; c2.height = c.height; const g2 = c2.getContext('2d'); g2.fillStyle = '#fff'; g2.fillRect(0, 0, c2.width, c2.height); g2.drawImage(c, 0, 0); d = c2.toDataURL('image/jpeg', 0.85); }
      ok(d);
    };
    img.onerror = () => { URL.revokeObjectURL(u); nein(new Error('Das Bild konnte nicht gelesen werden.')); };
    img.src = u;
  });
}

/* ---------------- Jahresurlaub ---------------- */
async function jahrDialog(y, t, weiter) {
  const r = await dialog({
    titel: `Jahresurlaub ${y}`,
    html: `<div class="raster" style="grid-template-columns:minmax(0,1fr)">
      <label>Urlaubstage im Jahr<input id="ent" inputmode="decimal" value="${ne(t?.entitlement_days ?? profil().annual_leave_days ?? 30)}"></label>
      <label>Übertrag aus dem Vorjahr<input id="car" inputmode="decimal" value="${ne(t?.carryover_days ?? 0)}"></label></div>`,
    knoepfe: [{ t: 'Abbrechen', wert: null }, {
      t: 'Speichern', pri: true,
      pruefe: (w, f) => { const s = zahl($('#ent', w).value), o = zahl($('#car', w).value) ?? 0; if (s == null || Number.isNaN(s) || s < 0 || s > 366 || Number.isNaN(o) || o < 0) { f('Bitte gültige Tage eingeben (0–366).'); return false; } return true; },
      wert: (w) => ({ ent: zahl($('#ent', w).value), car: zahl($('#car', w).value) ?? 0 }),
    }],
  });
  if (!r) return;
  try { await speichereJahr(y, r.ent, r.car); jahrCache.clear(); X.toast('Erfolgreich gespeichert.'); weiter(); } catch (e) { X.toast(e.message); }
}


function allocationField(id, entry) {
  return `<label style="margin-top:10px">Von welchem Urlaubsjahr abziehen?<select id="${id}" data-initial="${entry?.allocation_year ?? ''}"><option value="">Bitte Urlaubsjahr wählen</option></select><span class="hinweis">Bei Urlaub im Januar oder über den Jahreswechsel bitte ausdrücklich wählen: Resturlaub aus dem Vorjahr oder Urlaub des neuen Jahres.</span></label>`;
}
function updateAllocation(w,id,start,end,entry) {
  const select=$('#'+id,w);if(!start)return;
  const year=Number(start.slice(0,4)),last=Number((end||start).slice(0,4));
  const signature=`${year}-${last}`;if(select.dataset.years===signature)return;
  const needsChoice=start.slice(5,7)==='01'||year!==last||year>Number(heute().slice(0,4));
  const selected=select.dataset.years?select.value:(entry?.allocation_year!=null?String(entry.allocation_year):needsChoice?'':'calendar');
  const years=[...new Set([year-1,year,last,entry?.allocation_year].filter(x=>x!=null))].sort();
  select.innerHTML='<option value="">Bitte Urlaubsjahr wählen</option><option value="calendar">Nach tatsächlichem Kalenderjahr aufteilen</option>'+years.map(y=>`<option value="${y}">Urlaubskonto ${y}${y===year-1?' · Resturlaub':''}</option>`).join('');
  select.value=selected;select.dataset.years=signature;
}

/* ---------------- Urlaub eintragen / bearbeiten ---------------- */
async function urlaubDialog(e, weiter) {
  const p = profil(), manuell = p.vacation_calc_mode === 'manual', wt = arbeitstage();
  const rechne = (w) => {
    const v = $('#vs', w).value, bis = $('#ve', w).value, m = $('#vcalc', w);
    updateAllocation(w,'vyear',v,bis,e);
    if (!v || !bis) { m.innerHTML = ''; return null; }
    try {
      const l = zaehleUrlaub(v, bis, region(), wt);
      m.innerHTML = `<table class="ul-calc"><tbody>
        <tr><td>Kalendertage</td><td>${l.calendarDays}</td></tr>
        <tr><td>Wochenenden / freie Tage</td><td>${l.weekendDays}</td></tr>
        <tr><td>Feiertage${l.holidays.length ? ` (${l.holidays.map((q) => `${esc(q.name)} ${P(q.date).slice(0, 6)}`).join(', ')})` : ''}</td><td>${l.holidayDays}</td></tr>
        </tbody><tfoot><tr><td>Verbrauchte Urlaubstage</td><td>${l.usedDays}</td></tr></tfoot></table>`;
      return l;
    } catch (err) { m.innerHTML = `<p class="fehler">${esc(err.message)}</p>`; return null; }
  };
  const o = await dialog({
    titel: e ? 'Urlaub bearbeiten' : 'Urlaub eintragen',
    html: `<div class="raster">
        <label>Erster Urlaubstag<input id="vs" type="date" value="${e?.start_date || ''}"></label>
        <label>Letzter Urlaubstag<input id="ve" type="date" value="${e?.end_date || ''}"></label></div>
      ${allocationField('vyear',e)}<div id="vcalc" style="margin-top:10px"></div>
      ${manuell ? `<label style="margin-top:10px">Urlaubstage (manuell)<input id="vm" inputmode="decimal" value="${e?.manual_days ? ne(e.days_count) : ''}" placeholder="leer = automatisch"><span class="hinweis" style="margin:0">Berechnungsmodus MANUELL ist aktiv.</span></label>` : ''}
      <label style="margin-top:10px">Status<select id="vst">${Object.entries(Re).map(([k, v]) => `<option value="${k}" ${(e?.status || 'planned') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label style="margin-top:10px">Notiz<input id="vn" value="${esc(e?.note || '')}"></label>`,
    onOpen: (w) => { w.addEventListener('input', () => rechne(w)); rechne(w); },
    knoepfe: [{ t: 'Abbrechen', wert: null }, {
      t: 'Weiter', pri: true,
      pruefe: async (w, f) => {
        const a = $('#vs', w).value, bis = $('#ve', w).value;
        if (!$('#vyear',w).value) { f('Bitte wählen, von welchem Urlaubsjahr die Tage abgezogen werden sollen.'); return false; }
        if (!a || !bis) { f('Bitte ersten und letzten Urlaubstag angeben.'); return false; }
        if (bis < a) { f('Urlaubsende liegt vor Urlaubsbeginn.'); return false; }
        zaehleUrlaub(a, bis, region(), wt);
        const l = manuell ? zahl($('#vm', w).value) : null;
        if (Number.isNaN(l) || (l != null && l < 0)) { f('Manuelle Urlaubstage bitte als Zahl eingeben.'); return false; }
        const q = (await ladeUrlaube(a, bis)).filter((h) => h.id !== e?.id && !['rejected', 'canceled'].includes(h.status));
        if (q.length) { f(`Dieser Zeitraum überschneidet sich mit bereits eingetragenem Urlaub (${P(q[0].start_date)} – ${P(q[0].end_date)}).`); return false; }
        const abgleich = urlaubKalenderAbgleich({start_date:a,end_date:bis},await ladeSchichten(a,bis),region(),wt);
        if (abgleich.konflikte.length) { f(`Am ${P(abgleich.konflikte[0].datum)} ist bereits Dienst oder Krankheit eingetragen. Bitte zuerst den Kalender korrigieren.`); return false; }
        return true;
      },
      wert: (w) => ({ s: $('#vs', w).value, e: $('#ve', w).value, st: $('#vst', w).value, allocation_year: $('#vyear',w).value==='calendar'?null:Number($('#vyear',w).value), note: $('#vn', w).value.trim(), man: manuell ? zahl($('#vm', w).value) : null }),
    }],
  });
  if (!o) return;
  const r = zaehleUrlaub(o.s, o.e, region(), wt);
  const g = o.man != null ? o.man : r.usedDays;
  const abgleich = urlaubKalenderAbgleich({start_date:o.s,end_date:o.e},await ladeSchichten(o.s,o.e),region(),wt);
  if (abgleich.konflikte.length) { X.toast('Dienst oder Krankheit überschneidet sich mit dem Urlaub. Bitte zuerst den Kalender korrigieren.'); return; }
  if (!(await frage('Urlaub speichern', `<p>Möchtest du diesen Urlaub so speichern?</p>
      <p>${o.allocation_year ? `Abzug vom Urlaubskonto <strong>${o.allocation_year}</strong>.` : 'Abzug nach tatsächlichem Kalenderjahr.'}</p><p><strong>${P(o.s)} – ${P(o.e)}</strong>: ${T(g)} Urlaubstage${o.man != null ? ' (manuell)' : ''}</p>
      ${abgleich.vorhanden.length ? `<p class="banner info">${abgleich.vorhanden.length} Tage sind bereits im Kürzelkalender als Urlaub markiert. Dieser Eintrag gehört zu demselben Urlaub. Diese Tage werden nicht erneut abgezogen.</p>` : ''}`, 'Speichern'))) return;
  try {
    const v = { allocation_year:o.allocation_year, start_date: o.s, end_date: o.e, status: o.st, note: o.note || null, days_count: g, calendar_days: r.calendarDays, weekend_days: r.weekendDays, holiday_days: r.holidayDays, manual_days: o.man != null };
    if (e) v.id = e.id;
    await speichereUrlaub(v); jahrCache.clear();
    X.toast('Erfolgreich gespeichert.'); weiter();
  } catch (err) { X.toast(err.message); }
}

// Zusammenhängende Urlaubstage bündeln; freie Tage und Feiertage dürfen dazwischenliegen.
export function urlaubsGruppen(dates,reg,wt) {
  const selected=[...new Set(dates)].sort(),set=new Set(selected),groups=[];
  for(const date of selected){const last=groups.at(-1);if(last&&urlaubKalenderAbgleich({start_date:last.start_date,end_date:date},[],reg,wt).tage.every(d=>set.has(d)))last.end_date=date;else groups.push({start_date:date,end_date:date});}
  return groups;
}
export async function antragAusKalender(ctx,dates) {
  X=ctx;jahrCache.clear();if(!dates.length)return;
  const selected=[...new Set(dates)].sort();
  const [shifts,requests]=await Promise.all([ladeSchichten(selected[0],selected.at(-1)),ladeUrlaube(selected[0],selected.at(-1))]);
  const missing=selected.filter(d=>shifts.some(s=>s.art==='urlaub'&&s.datum===d)&&!requests.some(v=>ZAEHLT.includes(v.status)&&v.start_date<=d&&v.end_date>=d));
  for(const range of urlaubsGruppen(missing,region(),arbeitstage())){
    const accepted=await dialog({titel:'Urlaubsantrag erstellen?',html:`<p>Du hast Urlaub vom <strong>${P(range.start_date)}</strong> bis <strong>${P(range.end_date)}</strong> im Kürzelkalender eingetragen. Möchtest du dafür jetzt einen Antrag ausfüllen und speichern?</p><p class="hinweis">Die Tage sind vorausgefüllt. Deine Kalendereinträge bleiben auch bei „Später“ gespeichert.</p>`,knoepfe:[{t:'Später',wert:false},{t:'Antrag erstellen',wert:true,pri:true}]});
    if(accepted){const count=zaehleUrlaub(range.start_date,range.end_date,region(),arbeitstage()).usedDays;await antragDialog({...range,status:'planned',days_count:count},()=>ctx.render());}
  }
}

/* ---------------- Urlaubsantrag ---------------- */
async function antragWerte(e) {
  const t = profil(), a = Number(e.allocation_year || e.start_date.slice(0, 4));
  const { leave: i, list: n, shifts } = await jahrDaten(a);
  const s = urlaubVerbrauch(n, shifts, a, region(), arbeitstage(), e);
  const o = {
    requestDate: e.request_date || e.created_at?.slice(0, 10) || heute(), personnelNumber: t.personalnr || '', name: t.name || '',
    start: e.start_date, end: e.end_date, workDays: Number(e.days_count), address: e.vacation_address || '', contact: e.contact_info || '',
    carryover: e.carryover_days != null ? Number(e.carryover_days) : Number(i?.carryover_days || 0),
    entitlement: e.entitlement_days != null ? Number(e.entitlement_days) : Number(i?.entitlement_days ?? t.annual_leave_days ?? 30),
    alreadyTaken: s, requested: urlaubstageImJahr(e, a, region(), arbeitstage()), branch: niederlassung(t),
  };
  o.remaining = rest(o);
  return o;
}

async function antragDialog(e, weiter) {
  const a = profil(), wt = arbeitstage(), logo = a.urlaub_logo || null;
  const vorbelegt = e?.entitlement_days != null;
  const o = (l) => (l == null || l === '' ? '' : ne(Math.round(Number(l) * 10) / 10));
  const r = { requestDate: e?.request_date || heute(), start: e?.start_date || '', end: e?.end_date || '', manual: e?.manual_days ? o(e.days_count) : '' };
  const feld = (w, id) => zahl($(`#${id}`, w).value) ?? 0;
  let revision = 0, letzteWerte;
  const werte = (w, tage) => {
    const h = {
      requestDate: $('#r-date', w).value, personnelNumber: $('#r-pn', w).value.trim(), name: $('#r-name', w).value.trim(),
      allocation_year: $('#ryear',w).value==='calendar'||!$('#ryear',w).value?null:Number($('#ryear',w).value), start: $('#r-s', w).value, end: $('#r-e', w).value, workDays: tage, address: $('#r-addr', w).value.trim(), contact: $('#r-cont', w).value.trim(),
      carryover: feld(w, 'r-c'), entitlement: feld(w, 'r-t'), alreadyTaken: feld(w, 'r-a'), requested: tage, branch: $('#r-br', w).value.trim(),
    };
    if (h.start && h.end && h.end >= h.start) h.requested = urlaubstageImJahr({ allocation_year:h.allocation_year, start_date: h.start, end_date: h.end, manual_days: zahl($('#r-w', w).value) != null, days_count: tage }, Number(h.allocation_year || h.start.slice(0,4)), region(), wt);
    h.remaining = rest(h);
    return h;
  };
  const autoTage = (w) => { const v = $('#r-s', w).value, b = $('#r-e', w).value; if (!v || !b || b < v) return null; try { return zaehleUrlaub(v, b, region(), wt).usedDays; } catch { return null; } };
  const aktualisiere = async (w) => {
    const aktuell = ++revision;
    const v = $('#r-s', w).value;
    updateAllocation(w,'ryear',v,$('#r-e',w).value,e);
    const f = autoTage(w);
    const S = zahl($('#r-w', w).value);
    const k = S != null && !Number.isNaN(S) ? S : f;
    $('#r-w', w).placeholder = f != null ? `automatisch: ${Fe(f)}` : 'automatisch';
    const A = v ? Number($('#ryear',w).value && $('#ryear',w).value!=='calendar' ? $('#ryear',w).value : v.slice(0,4)) : null;
    if (A) {
      const { leave: F, list: j, shifts } = await jahrDaten(A);
      if (aktuell !== revision) return null;
      const q = urlaubVerbrauch(j, shifts, A, region(), wt, {id:e?.id,start_date:v,end_date:$('#r-e',w).value});
      const L = (id, wert) => { const el = $(`#${id}`, w); if (!el.dataset.touched) el.value = o(wert); };
      L('r-c', F?.carryover_days || 0); L('r-t', F?.entitlement_days ?? a.annual_leave_days ?? 30); L('r-a', q);
      $('#r-yl', w).textContent = `Urlaubsjahr ${A}`;
    }
    const h = werte(w, k);
    $('#r-req', w).textContent = k == null ? '–' : Fe(h.requested);
    const x = $('#r-rem', w);
    x.textContent = k == null ? '–' : Fe(h.remaining);
    x.classList.toggle('neg', k != null && h.remaining < 0);
    $('#r-prev', w).innerHTML = antragSvg(h, logo);
    const details = [];
    h.negativeYears = [];
    if (h.start && h.end && h.end >= h.start && k != null) {
      for (let y = Number(h.allocation_year || h.start.slice(0,4)); y <= Number(h.allocation_year || h.end.slice(0,4)); y++) {
        const {leave, list, shifts} = await jahrDaten(y);
        if (aktuell !== revision) return null;
        const entry = {allocation_year:h.allocation_year,id:e?.id,start_date:h.start,end_date:h.end,manual_days:zahl($('#r-w',w).value)!=null,days_count:k};
        const requested = urlaubstageImJahr(entry,y,region(),wt);
        const used = urlaubVerbrauch(list,shifts,y,region(),wt,entry);
        const remaining = y === A ? h.remaining : Number(leave?.entitlement_days ?? a.annual_leave_days ?? 30) + Number(leave?.carryover_days || 0) - used - requested;
        if (remaining < 0) h.negativeYears.push(`${y}: ${Fe(remaining)} Tage`);
        details.push(`${y}: ${Fe(requested)} Tage aus diesem Antrag, ${Fe(remaining)} Tage verbleiben.`);
      }
    }
    $('#r-years',w).textContent = details.join(' ');
    if (h.start && h.end && h.end >= h.start) {
      const match = urlaubKalenderAbgleich({start_date:h.start,end_date:h.end},await ladeSchichten(h.start,h.end),region(),wt);
      if (aktuell !== revision) return null;
      $('#r-match',w).textContent = match.konflikte.length ? `Achtung: Am ${P(match.konflikte[0].datum)} ist Dienst oder Krankheit eingetragen. Speichern ist erst nach der Korrektur möglich.` : match.vorhanden.length ? `${match.vorhanden.length} Tage sind bereits im Kürzelkalender als Urlaub markiert. Der Antrag gehört zu demselben Urlaub. Diese Tage werden nur einmal abgezogen.` : '';
    } else $('#r-match',w).textContent = '';
    letzteWerte = h;
    return h;
  };
  const erg = await dialog({
    titel: e?.id ? 'Urlaubsantrag bearbeiten' : 'Urlaubsantrag ausfüllen', breit: true,
    html: `<div class="ul-antrag"><form id="rf" novalidate onsubmit="return false">
      <div class="raster">
        <label>Antragsdatum<input id="r-date" type="date" value="${r.requestDate}"></label>
        <label>Pers.Nr.<input id="r-pn" value="${esc(a.personalnr || '')}"></label>
        <label>Mitarbeiter<input id="r-name" value="${esc(a.name || '')}"></label>
      </div>
      <div class="raster" style="margin-top:10px">
        <label>Urlaubsbeginn<input id="r-s" type="date" value="${r.start}"></label>
        <label>Urlaubsende<input id="r-e" type="date" value="${r.end}"></label>
        <label>Arbeitstage<input id="r-w" inputmode="decimal" value="${r.manual}" placeholder="automatisch"><span class="hinweis" style="margin:0">Leer lassen = automatisch (ohne Feiertage)</span></label>
      </div>
      ${allocationField('ryear',e)}<label style="margin-top:10px">Urlaubsanschrift<input id="r-addr" value="${esc(e?.vacation_address || '')}" maxlength="120" placeholder="optional"></label>
      <label style="margin-top:10px">Ggf. zu erreichen über<input id="r-cont" value="${esc(e?.contact_info || '')}" maxlength="120" placeholder="optional, z. B. Handynummer"></label>
      <fieldset class="ul-calcbox"><legend>Urlaubsabrechnung · <span id="r-yl">Urlaubsjahr</span></legend>
        <label class="ul-vr"><span>Resturlaub aus dem Vorjahr</span><input id="r-c" inputmode="decimal" value="${vorbelegt ? o(e.carryover_days) : ''}"><em>Tag(e)</em></label>
        <label class="ul-vr"><span>Zustehender Erholungsurlaub</span><input id="r-t" inputmode="decimal" value="${vorbelegt ? o(e.entitlement_days) : ''}"><em>Tag(e)</em></label>
        <label class="ul-vr"><span>Bereits erhaltener Erholungsurlaub</span><input id="r-a" inputmode="decimal" value="${vorbelegt ? o(e.already_taken_days) : ''}"><em>Tag(e)</em></label>
        <div class="ul-vr"><span>Beantragter Erholungsurlaub</span><output id="r-req">–</output><em>Tag(e)</em></div>
        <div class="ul-vr gesamt"><span>Verbleibender Erholungsurlaub</span><output id="r-rem">–</output><em>Tag(e)</em></div>
        <p class="hinweis" id="r-match" aria-live="polite"></p><p class="hinweis" id="r-years"></p><p class="hinweis">Die Abrechnung verwendet das gewählte Urlaubskonto. Bei Aufteilung nach Kalenderjahr werden die Tage je Jahr getrennt berechnet.</p><p class="hinweis">Wird automatisch aus deinem Urlaubskonto vorbelegt und berechnet. Werte kannst du bei Bedarf überschreiben.</p>
      </fieldset>
      <label style="margin-top:10px">Niederlassung<input id="r-br" value="${esc(niederlassung(a))}" maxlength="60"></label>
      ${logo ? '' : '<p class="hinweis">Tipp: Dein Firmenlogo für den Kopf des Formulars hinterlegst du unten auf der Urlaubsseite unter „Einstellungen Urlaub“.</p>'}
      </form>
      <div class="ul-blatt" id="r-prev" aria-live="polite"></div></div>`,
    onOpen: (w) => {
      let t;
      w.addEventListener('input', (h) => { if (['r-c', 'r-t', 'r-a'].includes(h.target.id)) h.target.dataset.touched = '1'; clearTimeout(t); t = setTimeout(() => aktualisiere(w).catch(err => w.fehler(err.message)), 120); });
      aktualisiere(w).catch(err => w.fehler(err.message));
    },
    knoepfe: [{ t: 'Abbrechen', wert: null }, {
      t: 'Speichern & PDF erstellen', pri: true,
      pruefe: async (w, f) => {
        const h = await aktualisiere(w);
        if (!h) { f('Bitte die Berechnung abwarten und erneut speichern.'); return false; }
        if (!$('#ryear',w).value) { f('Bitte bestätigen: Resturlaub aus dem Vorjahr oder Urlaub des neuen Jahres?'); return false; }
        if (!h.name) { f('Bitte den Namen des Mitarbeiters angeben.'); return false; }
        if (!h.requestDate) { f('Bitte das Antragsdatum angeben.'); return false; }
        if (!h.start || !h.end) { f('Bitte Urlaubsbeginn und Urlaubsende angeben.'); return false; }
        if (h.end < h.start) { f('Urlaubsende liegt vor Urlaubsbeginn.'); return false; }
        zaehleUrlaub(h.start, h.end, region(), wt);
        const m = zahl($('#r-w', w).value);
        if (Number.isNaN(m) || (m != null && (m <= 0 || m > 366))) { f('Arbeitstage bitte als Zahl eingeben oder leer lassen.'); return false; }
        if (!h.workDays) { f('Im gewählten Zeitraum liegen keine Arbeitstage.'); return false; }
        for (const k of ['r-c', 'r-t', 'r-a']) { const A = zahl($(`#${k}`, w).value); if (Number.isNaN(A) || (A != null && (A < 0 || A > 999))) { f('Die Urlaubsabrechnung bitte nur mit Zahlen ab 0 ausfüllen.'); return false; } }
        const S = (await ladeUrlaube(h.start, h.end)).filter((k) => k.id !== e?.id && !['rejected', 'canceled'].includes(k.status));
        if (S.length) { f(`Dieser Zeitraum überschneidet sich mit bereits eingetragenem Urlaub (${P(S[0].start_date)} – ${P(S[0].end_date)}).`); return false; }
        const match = urlaubKalenderAbgleich({start_date:h.start,end_date:h.end},await ladeSchichten(h.start,h.end),region(),wt);
        if (match.konflikte.length) { f(`Am ${P(match.konflikte[0].datum)} ist bereits Dienst oder Krankheit eingetragen. Bitte zuerst den Kalender korrigieren.`); return false; }
        if (h.negativeYears.length && !(await frage('Zu wenig Resturlaub', `<p>Nach diesem Antrag ist das Urlaubskonto in diesen Jahren überzogen: ${h.negativeYears.join('; ')}. Trotzdem speichern?</p>`, 'Trotzdem speichern'))) return false;
        return true;
      },
      wert: (w) => ({ vals: letzteWerte, manual: zahl($('#r-w', w).value) != null }),
    }],
  });
  if (!erg) return;
  const { vals: _, manual: m } = erg;
  try {
    const l = zaehleUrlaub(_.start, _.end, region(), wt);
    const v = {
      allocation_year:_.allocation_year, start_date: _.start, end_date: _.end, status: e?.status && e.status !== 'planned' ? e.status : 'requested', note: e?.note || null,
      days_count: _.workDays, calendar_days: l.calendarDays, weekend_days: l.weekendDays, holiday_days: l.holidayDays, manual_days: m,
      request_date: _.requestDate, vacation_address: _.address || null, contact_info: _.contact || null,
      carryover_days: _.carryover, entitlement_days: _.entitlement, already_taken_days: _.alreadyTaken,
    };
    if (e) v.id = e.id;
    await speichereUrlaub(v);
    const h = Number(_.allocation_year || _.start.slice(0, 4));
    const { leave: f } = await jahrDaten(h);
    if (!f || Number(f.entitlement_days) !== _.entitlement || Number(f.carryover_days || 0) !== _.carryover) await speichereJahr(h, _.entitlement, _.carryover);
    const S = {};
    if ((a.personalnr || '') !== _.personnelNumber) S.personalnr = _.personnelNumber || null;
    if ((a.branch_name ?? null) !== _.branch) S.branch_name = _.branch;
    if (Object.keys(S).length) await profilSpeichern(S);
    jahrCache.clear();
    X.toast('Urlaubsantrag gespeichert und im Kürzelkalender eingetragen.');
    await antragFertig(_, logo);
    weiter?.();
  } catch (err) { X.toast(err.message); }
}

async function antragErneutOeffnen(e) { jahrCache.clear(); const t = await antragWerte(e); await antragFertig(t, profil().urlaub_logo || null); }

function dokument(e, logo) {
  const zr = `${P(e.start)} – ${P(e.end)}`;
  return {
    filename: `Urlaubsantrag_${e.start}_${e.end}.pdf`, title: `Urlaubsantrag ${zr}`,
    build: () => antragPdf(e, logo),
    subject: `Urlaubsantrag ${e.name} – ${P(e.start)} bis ${P(e.end)}`,
    text: `Guten Tag,\n\nhiermit beantrage ich Erholungsurlaub vom ${P(e.start)} bis ${P(e.end)} (${Fe(e.workDays)} Arbeitstage). Den ausgefüllten Urlaubsantrag finden Sie im Anhang.\n\nMit freundlichen Grüßen\n${e.name}`,
  };
}

async function antragFertig(e, logo) {
  await dialog({
    titel: 'Urlaubsantrag', breit: true,
    html: `<p>Der Urlaubsantrag ${P(e.start)} – ${P(e.end)} ist gespeichert.</p><div id="ra"></div><div class="ul-blatt" style="margin-top:12px">${antragSvg(e, logo)}</div>`,
    onOpen: (w) => pdfAktionen($('#ra', w), dokument(e, logo)),
    knoepfe: [{ t: 'Fertig', wert: true, pri: true }],
  });
}

function speichern(blob, name) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 60000);
}

function pdfAktionen(el, t) {
  let blob = null;
  const hole = async () => (blob ||= await t.build());
  const datei = async () => new File([await hole()], t.filename, { type: 'application/pdf' });
  const teilbar = () => { try { return !!navigator.canShare && navigator.canShare({ files: [new File([''], 'x.pdf', { type: 'application/pdf' })] }); } catch { return false; } };
  el.innerHTML = `<div class="reihe">
    <button class="btn pri" data-a="view">Anzeigen</button>
    <button class="btn" data-a="save">Speichern</button>
    ${teilbar() ? '<button class="btn" data-a="share">Teilen</button>' : ''}
    <button class="btn" data-a="print">Drucken</button>
    <button class="btn" data-a="mail">Per E-Mail senden</button></div>`;
  $$('[data-a]', el).forEach((b) => {
    b.onclick = async () => {
      const alt = b.textContent; b.disabled = true; b.textContent = 'Bitte warten …';
      try {
        const u = b.dataset.a;
        if (u === 'view') {
          const g = URL.createObjectURL(await hole());
          if (!window.open(g, '_blank')) await dialog({ titel: t.filename, breit: true, html: `<iframe class="ul-pdf" src="${g}" title="PDF-Vorschau"></iframe><p class="hinweis">Wird das PDF nicht angezeigt, nutze „Speichern“.</p>`, knoepfe: [{ t: 'Schließen', wert: true, pri: true }] });
        } else if (u === 'save') { speichern(await hole(), t.filename); X.toast('PDF wurde gespeichert.'); }
        else if (u === 'share') await navigator.share({ files: [await datei()], title: t.filename });
        else if (u === 'print') {
          const g = URL.createObjectURL(await hole());
          const f = document.createElement('iframe');
          f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
          f.src = g; document.body.append(f);
          f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { window.open(g, '_blank'); } setTimeout(() => f.remove(), 60000); };
        } else if (u === 'mail') {
          if (teilbar()) await navigator.share({ files: [await datei()], title: t.subject, text: t.text });
          else {
            speichern(await hole(), t.filename);
            location.href = `mailto:?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(t.text)}`;
            X.toast('PDF wurde gespeichert – bitte in der E-Mail als Anhang hinzufügen.');
          }
        }
      } catch (err) { if (err?.name !== 'AbortError') X.toast(err.message || 'Aktion fehlgeschlagen.'); }
      finally { b.disabled = false; b.textContent = alt; }
    };
  });
}

/* ---------------- Formular-Layout (identisch zur Wachbuch-App) ---------------- */
const Ei = 35, Di = 26, Se = 595.28 / 1252, Jn = [595.28, 841.89], Kt = '#000000', Kn = '#7b7b7b', Ha = '#e4e4e4';
const Yn = Array.from({ length: 20 }, (e, t) => 75 + t * 58.95), Xn = Array.from({ length: 57 }, (e, t) => 67 + t * 30.08);
const me = (e) => (e - Ei) * Se, ge = (e) => Jn[1] - (e - Di) * Se;
const Gn = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ce = (s) => String(s ?? '').replace(/[   ]/g, ' ').replace(/[^\x20-\x7E¡-ÿ€–—‘’‚“”„•…]/g, '');

function Ra(e) {
  const t = [];
  const a = (r, u, g, b, y = 2.6) => t.push({ t: 'rect', x1: r, y1: u, x2: g, y2: b, w: y });
  const i = (r, u, g, b, y = 2.2) => t.push({ t: 'line', x1: r, y1: u, x2: g, y2: b, w: y });
  const n = (r, u, g, b, y, v = {}) => t.push({ t: 'text', s: String(r ?? ''), x: u, y: g, size: b, font: y, align: v.align || 'l', color: v.color || Kt, width: v.width, underline: v.underline, clip: v.clip });
  t.push({ t: 'grid' });
  a(100, 106, 569, 243); n('Urlaubsantrag', 130, 213, 49, 'b', { color: Kn, width: 415 });
  a(729, 99, 1220, 235, 3.4); t.push({ t: 'logo', x1: 731, y1: 101, x2: 1218, y2: 233 });
  a(100, 335, 341, 429); i(100, 389, 341, 389, 1.4); n(kt(e.requestDate), 220, 390, 27.5, 'bi', { align: 'c' }); n('Antragsdatum', 220, 428, 21.5, 'i', { align: 'c', clip: 429 });
  a(401, 338, 579, 429); i(401, 391, 579, 391, 1.4); n('Pers.Nr.', 490, 390, 27, 'bi', { align: 'c' }); n(e.personnelNumber || '', 490, 421, 24, 'bi', { align: 'c' });
  a(640, 333, 1220, 429); i(640, 389, 1220, 389, 1.4); n(e.name, 930, 390, 27.5, 'bi', { align: 'c' }); n('Mitarbeiter', 930, 428, 21.5, 'i', { align: 'c', clip: 429 });
  const s = (r, u, g, b) => { a(r, 491, u, 629); i(r, 541, u, 541, 1.4); n(g, (r + u) / 2, 538, 26, 'i', { align: 'c' }); n(b, (r + u) / 2, 612, 32, 'bi', { align: 'c' }); };
  s(100, 336, 'Urlaubsbeginn:', kt(e.start)); s(499, 765, 'Urlaubsende:', kt(e.end)); s(928, 1220, 'Arbeitstage', e.workDays == null ? '' : Fe(e.workDays));
  n('Urlaubsanschrift:', 108, 740, 20.5, 'r'); i(393, 758, 1221, 758, 2.4); if (e.address) n(e.address, 400, 751, 20.5, 'r', { maxWidth: 815 });
  n('Ggf. zu erreichen über:', 108, 840, 20.5, 'r'); i(393, 858, 1221, 858, 2.4); if (e.contact) n(e.contact, 400, 851, 20.5, 'r');
  i(648, 962, 1068, 962, 2.2); n('Unterschrift', 858, 1000, 17.5, 'r', { align: 'c' });
  a(100, 1031, 1220, 1131); n('Urlaubsabrechnung', 388, 1117, 49, 'b', { color: Kn, width: 537 });
  n(`Urlaubsjahr ${e.start?.slice(0,4) || ''}`, 248, 1160, 18, 'r');
  [['Resturlaub aus dem Vorjahr', e.carryover], ['Zustehender Erholungsurlaub', e.entitlement], ['Bereits erhaltener Erholungsurlaub', e.alreadyTaken], ['Beantragter Erholungsurlaub', e.requested], ['Verbleibender Erholungsurlaub', e.remaining]].forEach(([r, u], g) => {
    const b = 1209 + g * 45;
    n(r, 248, b, 23.5, 'bi'); n(':', 721, b, 23.5, 'bi'); i(748, b - 2, 868, b - 2, 2); n(u == null ? '' : Fe(u), 861, b, 23.5, 'bi', { align: 'r' }); n('Tag(e)', 941, b, 23.5, 'bi');
  });
  n('dienstlich Vertretbar', 241, 1461, 22.5, 'bi'); n('(Objektleiter/Bereichsleiter)', 241, 1496, 22.5, 'bi');
  i(675, 1457, 1080, 1457, 2.2); n('Unterschrift', 877, 1494, 17.5, 'r', { align: 'c' });
  n(e.branch || '', 240, 1600, 21.5, 'r', { underline: true });
  a(241, 1673, 360, 1739); n(e.workDays == null ? '' : Fe(e.workDays), 300, 1731, 26.5, 'b', { align: 'c' }); n('Tag(e)', 376, 1723, 20.5, 'r');
  n('Genehmigt / Nicht genehmigt', 623, 1739, 20.5, 'r');
  return t;
}

async function antragPdf(e, logo) {
  const { PDFDocument: Si, StandardFonts: Vt, rgb: xi } = await X.ladePdfLib();
  const _t = (h) => xi(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
  const a = await Si.create();
  a.setTitle(ce(`Urlaubsantrag ${e.name} ${kt(e.start)} - ${kt(e.end)}`)); a.setAuthor(ce(e.name)); a.setCreator('Shiftly'); a.setProducer('Shiftly'); a.setLanguage('de-DE');
  const i = { r: await a.embedFont(Vt.Helvetica), b: await a.embedFont(Vt.HelveticaBold), i: await a.embedFont(Vt.HelveticaOblique), bi: await a.embedFont(Vt.HelveticaBoldOblique) };
  const n = a.addPage(Jn);
  let s = null;
  if (logo) {
    try {
      const bytes = Uint8Array.from(atob(logo.split(',')[1]), (c) => c.charCodeAt(0));
      s = /^data:image\/png/.test(logo) ? await a.embedPng(bytes) : await a.embedJpg(bytes);
    } catch { s = null; }
  }
  const L = Ra(e);
  for (const o of L) {
    if (o.t === 'grid') {
      const r = { color: _t(Ha), thickness: 0.45 };
      for (const u of Yn) n.drawLine({ start: { x: me(u), y: ge(67) }, end: { x: me(u), y: ge(1751) }, ...r });
      for (const u of Xn) n.drawLine({ start: { x: me(75), y: ge(u) }, end: { x: me(1245), y: ge(u) }, ...r });
    } else if (o.t === 'rect') n.drawRectangle({ x: me(o.x1), y: ge(o.y2), width: (o.x2 - o.x1) * Se, height: (o.y2 - o.y1) * Se, borderColor: _t(Kt), borderWidth: o.w * Se });
    else if (o.t === 'line') n.drawLine({ start: { x: me(o.x1), y: ge(o.y1) }, end: { x: me(o.x2), y: ge(o.y2) }, thickness: o.w * Se, color: _t(Kt) });
    else if (o.t === 'logo') {
      if (!s) continue;
      const r = (o.x2 - o.x1) * Se, u = (o.y2 - o.y1) * Se, g = Math.min(r / s.width, u / s.height), b = s.width * g, y = s.height * g;
      n.drawImage(s, { x: me(o.x1) + (r - b) / 2, y: ge(o.y2) + (u - y) / 2, width: b, height: y });
    } else if (o.t === 'text') {
      let r = ce(o.s); if (!r) continue;
      const u = i[o.font], g = o.size * Se, b = _t(o.color);
      if (o.width) {
        const m = [...r], l = m.reduce((f, S) => f + u.widthOfTextAtSize(S, g), 0), p = (o.width * Se - l) / (m.length - 1);
        let h = me(o.x);
        for (const f of m) { n.drawText(f, { x: h, y: ge(o.y), size: g, font: u, color: b }); h += u.widthOfTextAtSize(f, g) + p; }
        continue;
      }
      const y = o.align === 'l' ? (1221 - o.x) * Se : Infinity;
      while (r.length > 1 && u.widthOfTextAtSize(r, g) > y) r = r.slice(0, -1);
      const v = u.widthOfTextAtSize(r, g), _ = o.align === 'c' ? me(o.x) - v / 2 : o.align === 'r' ? me(o.x) - v : me(o.x);
      n.drawText(r, { x: _, y: ge(o.y), size: g, font: u, color: b });
      if (o.underline) n.drawLine({ start: { x: _, y: ge(o.y) - 1.3 }, end: { x: _ + v, y: ge(o.y) - 1.3 }, thickness: 0.6, color: b });
    }
  }
  for (const o of L) if (o.t === 'rect' && o.y2 === 429) n.drawLine({ start: { x: me(o.x1), y: ge(o.y2) }, end: { x: me(o.x2), y: ge(o.y2) }, thickness: o.w * Se, color: _t(Kt) });
  return new Blob([await a.save()], { type: 'application/pdf' });
}

function antragSvg(e, t) {
  const a = [];
  const i = (s) => `font-family="Arial, Helvetica, sans-serif" font-weight="${s.includes('b') ? 700 : 400}" font-style="${s.includes('i') ? 'italic' : 'normal'}"`;
  const n = Ra(e);
  for (const s of n) {
    if (s.t === 'grid') {
      for (const o of Yn) a.push(`<line x1="${o}" y1="67" x2="${o}" y2="1751" stroke="${Ha}" stroke-width="1"/>`);
      for (const o of Xn) a.push(`<line x1="75" y1="${o}" x2="1245" y2="${o}" stroke="${Ha}" stroke-width="1"/>`);
    } else if (s.t === 'rect') a.push(`<rect x="${s.x1}" y="${s.y1}" width="${s.x2 - s.x1}" height="${s.y2 - s.y1}" fill="none" stroke="#000" stroke-width="${s.w}"/>`);
    else if (s.t === 'line') a.push(`<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="#000" stroke-width="${s.w}"/>`);
    else if (s.t === 'logo') { if (t) a.push(`<image href="${Gn(t)}" x="${s.x1}" y="${s.y1}" width="${s.x2 - s.x1}" height="${s.y2 - s.y1}" preserveAspectRatio="xMidYMid meet"/>`); }
    else if (s.t === 'text' && s.s) {
      const o = { l: 'start', c: 'middle', r: 'end' }[s.align], r = s.width ? ` textLength="${s.width}" lengthAdjust="spacing"` : '', u = s.underline ? ' text-decoration="underline"' : '';
      a.push(`<text x="${s.x}" y="${s.y}" font-size="${s.size}" ${i(s.font)} fill="${s.color}" text-anchor="${o}"${r}${u}>${Gn(s.s)}</text>`);
    }
  }
  for (const s of n) if (s.t === 'rect' && s.y2 === 429) a.push(`<line x1="${s.x1}" y1="429" x2="${s.x2}" y2="429" stroke="#000" stroke-width="${s.w}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="35 26 1252 1772" role="img" aria-label="Vorschau Urlaubsantrag"><rect x="35" y="26" width="1252" height="1772" fill="#fff"/>${a.join('')}</svg>`;
}
