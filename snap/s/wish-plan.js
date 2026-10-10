// Wunschdienstplan: feste Einträge aus dem Arbeitskalender und automatischer Planvorschlag
import { berechne, schichtZeitraum, tagKey } from './calc.js?v=10';

const DAY = 86400000, STUNDE = 3600000, RUHEZEIT = 11 * STUNDE, MAX_FOLGE = 6;
const WOCHENTAGE = [[1, 'Mo'], [2, 'Di'], [3, 'Mi'], [4, 'Do'], [5, 'Fr'], [6, 'Sa'], [0, 'So']];
export const AUTO_DEFAULTS = { sperr: [], proWoche: '', ziel: '', ohneFeiertag: false, ersetzen: false, codes: {} };

// Einträge aus dem Arbeitskalender (sz_shifts) als feste Wunschplan-Zeilen
export function fixedEintraege(shifts) {
  return (shifts || []).map((s) => {
    if (!s || !s.datum) return null;
    const art = s.art || 'dienst';
    if (!['dienst', 'urlaub', 'krank', 'frei'].includes(art)) return null;
    const zeiten = art === 'dienst' && s.beginn && s.ende;
    if (art === 'dienst' && !zeiten) return null;
    return {
      id: 'fest-' + (s.id || s.datum + (s.beginn || '')), fest: true, start_date: s.datum, end_date: s.datum,
      kind: art === 'frei' ? 'frei' : 'arbeiten', art,
      kuerzel: s.kuerzel || ({ urlaub: 'U', krank: 'K', frei: 'F' }[art] || 'D'),
      shift_start: zeiten ? String(s.beginn).slice(0, 5) : null, shift_end: zeiten ? String(s.ende).slice(0, 5) : null,
      pause_min: Number(s.pause_min) || 0, note: s.notiz || null,
    };
  }).filter(Boolean);
}

const zahl = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };
const wochenStart = (datum) => { const t = Date.parse(datum + 'T00:00:00Z'), w = (new Date(t).getUTCDay() + 6) % 7; return tagKey(t - w * DAY); };
const tageZwischen = (a, b) => Math.abs(Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / DAY;
const addTag = (datum, n) => tagKey(Date.parse(datum + 'T00:00:00Z') + n * DAY);

// Plan berechnen. days: Ergebnis von wishDays (inkl. fester Einträge und vorhandener Wünsche)
export function planeMonat({ cfg, codes, days, s }) {
  const sperr = new Set((s.sperr || []).map(Number)), wCap = zahl(s.proWoche), ziel = zahl(s.ziel);
  if (!wCap && !ziel) return { error: 'Bitte gib ein Stundenziel für den Monat oder höchstens so viele Tage pro Woche an.' };
  const wahl = Object.entries(codes || {}).filter(([c, k]) => k && k.art === 'dienst' && k.beginn && k.ende && s.codes?.[c]?.use !== false);
  if (!wahl.length) return { error: 'Es ist kein Dienst-Kürzel ausgewählt.' };

  const info = new Map();
  const infoFuer = (datum, code, k) => {
    const key = datum + '|' + code;
    if (!info.has(key)) {
      const sh = { art: 'dienst', datum, beginn: k.beginn, ende: k.ende, pause_min: k.pause || 0 };
      const z = schichtZeitraum(sh);
      info.set(key, z.error ? null : { start: z.start, ende: z.ende, h: berechne(sh, cfg).std });
    }
    return info.get(key);
  };

  const arbeit = new Map(); // datum -> {start, ende} (vorhandene und gewählte Arbeitstage)
  let stunden = 0;
  const monatNutzung = {}, wochenNutzung = {}, wochenTage = {};
  for (const d of days) {
    stunden += d.hours || 0;
    if (!d.shifts.length) continue;
    const w = wochenStart(d.datum);
    wochenTage[w] = (wochenTage[w] || 0) + 1;
    let zeit = null;
    for (const sh of d.shifts) {
      const z = schichtZeitraum({ datum: d.datum, beginn: sh.shift_start, ende: sh.shift_end });
      if (!z.error && (!zeit || z.ende > zeit.ende)) zeit = { start: zeit ? Math.min(zeit.start, z.start) : z.start, ende: z.ende };
    }
    if (zeit) arbeit.set(d.datum, zeit);
    for (const sh of d.shifts) if (sh.kuerzel) {
      monatNutzung[sh.kuerzel] = (monatNutzung[sh.kuerzel] || 0) + 1;
      wochenNutzung[sh.kuerzel + '|' + w] = (wochenNutzung[sh.kuerzel + '|' + w] || 0) + 1;
    }
  }
  const start = stunden;
  const frei = days.filter((d) => !d.entries.length && !sperr.has(d.weekday) && !(s.ohneFeiertag && d.holiday));
  const grenze = (code) => zahl(s.codes?.[code]?.max);
  const proWocheCode = (code) => s.codes?.[code]?.per === 'woche';

  const ruheOk = (datum, z) => {
    const v = arbeit.get(addTag(datum, -1)), n = arbeit.get(addTag(datum, 1));
    return (!v || z.start - v.ende >= RUHEZEIT) && (!n || n.start - z.ende >= RUHEZEIT);
  };
  const folgeOk = (datum) => {
    let vor = 0, nach = 0;
    while (arbeit.has(addTag(datum, -(vor + 1)))) vor++;
    while (arbeit.has(addTag(datum, nach + 1))) nach++;
    return vor + 1 + nach <= MAX_FOLGE;
  };
  const codeFrei = (code, w) => { const m = grenze(code); if (!m) return Infinity; return m - (proWocheCode(code) ? (wochenNutzung[code + '|' + w] || 0) : (monatNutzung[code] || 0)); };
  const abstand = (datum) => { let m = 99; for (const a of arbeit.keys()) m = Math.min(m, tageZwischen(a, datum)); return m; };

  const gewaehlt = [], belegt = new Set();
  for (;;) {
    if (ziel && stunden >= ziel) break;
    let best = null;
    for (const d of frei) {
      if (belegt.has(d.datum)) continue;
      const w = wochenStart(d.datum);
      if (wCap && (wochenTage[w] || 0) >= wCap) continue;
      if (!folgeOk(d.datum)) continue;
      const moegl = [];
      wahl.forEach(([code, k], idx) => {
        const rest = codeFrei(code, w);
        if (rest <= 0) return;
        const i = infoFuer(d.datum, code, k);
        if (!i || !ruheOk(d.datum, i)) return;
        if (ziel && stunden + i.h > ziel + i.h / 2) return;
        moegl.push({ code, i, rest, idx });
      });
      if (!moegl.length) continue;
      const score = [wochenTage[w] || 0, -abstand(d.datum), d.datum];
      if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && (score[1] < best.score[1] || (score[1] === best.score[1] && score[2] < best.score[2])))) best = { d, w, moegl, score };
    }
    if (!best) break;
    // Kürzel mit Limit zuerst nutzen (damit sie wirklich vorkommen), danach die ohne Limit in Listenreihenfolge
    best.moegl.sort((a, b) => (a.rest === Infinity) - (b.rest === Infinity) || b.rest - a.rest || a.idx - b.idx);
    const wahlCode = best.moegl[0];
    gewaehlt.push({ datum: best.d.datum, code: wahlCode.code, h: wahlCode.i.h });
    belegt.add(best.d.datum);
    arbeit.set(best.d.datum, { start: wahlCode.i.start, ende: wahlCode.i.ende });
    stunden += wahlCode.i.h;
    wochenTage[best.w] = (wochenTage[best.w] || 0) + 1;
    monatNutzung[wahlCode.code] = (monatNutzung[wahlCode.code] || 0) + 1;
    wochenNutzung[wahlCode.code + '|' + best.w] = (wochenNutzung[wahlCode.code + '|' + best.w] || 0) + 1;
  }
  gewaehlt.sort((a, b) => a.datum.localeCompare(b.datum));
  const notes = [];
  if (ziel && start >= ziel) notes.push('Du hast schon ' + Math.round(start * 10) / 10 + ' Stunden eingetragen, das Ziel ist damit erreicht.');
  else if (ziel && stunden < ziel - 0.5) notes.push('Das Ziel von ' + ziel + ' Stunden wird nicht ganz erreicht, der Vorschlag kommt auf ' + Math.round(stunden * 10) / 10 + ' Stunden. Es sind nicht genug Tage übrig: Freie Wochentage, Limits, Tage pro Woche oder die 11 Stunden Ruhezeit schränken ein.');
  const nachCode = {};
  gewaehlt.forEach((g) => { nachCode[g.code] = (nachCode[g.code] || 0) + 1; });
  return { entries: gewaehlt, stunden, startStunden: start, neueStunden: gewaehlt.reduce((n, g) => n + g.h, 0), nachCode, notes };
}

// Oberfläche
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function autoPlanHtml(codes, s = AUTO_DEFAULTS) {
  s = { ...AUTO_DEFAULTS, ...(s || {}), codes: { ...((s && s.codes) || {}) } };
  const dienste = Object.entries(codes || {}).filter(([, k]) => k && k.art === 'dienst');
  return `<details class="wish-auto"><summary>✨ Automatisch planen</summary>
<p class="hinweis">Sag, wie du arbeiten möchtest. Du bekommst erst einen Vorschlag und entscheidest, ob du ihn übernimmst. Feste Einträge aus deinem Arbeitskalender, zum Beispiel Urlaub, bleiben, wie sie sind.</p>
<fieldset class="wa-sperr"><legend>An diesen Tagen möchte ich nicht arbeiten</legend><div class="wa-chips">${WOCHENTAGE.map(([n, t]) => `<label class="wa-tag"><input type="checkbox" data-wa-sperr="${n}" ${s.sperr.map(Number).includes(n) ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></fieldset>
<div class="wa-grid"><label>Höchstens … Tage pro Woche<input type="number" id="wa-woche" min="1" max="7" inputmode="numeric" placeholder="egal" value="${esc(s.proWoche)}"></label><label>Ziel: Stunden im Monat<input type="number" id="wa-ziel" min="1" max="400" step="1" inputmode="decimal" placeholder="egal" value="${esc(s.ziel)}"></label></div>
<label class="wa-check"><input type="checkbox" id="wa-feiertag" ${s.ohneFeiertag ? 'checked' : ''}> Nicht an Feiertagen arbeiten</label>
<label class="wa-check"><input type="checkbox" id="wa-ersetzen" ${s.ersetzen ? 'checked' : ''}> Meine bisherigen Wünsche in diesem Monat ersetzen</label>
<div class="wa-codes"><b>Kürzel</b>${dienste.map(([c, k]) => { const o = s.codes[c] || {}; return `<div class="wa-code"><label><input type="checkbox" data-wa-use="${esc(c)}" ${o.use === false ? '' : 'checked'}> <b>${esc(c)}</b> <small>${esc(k.beginn)}–${esc(k.ende)}</small></label><span class="wa-limit">höchstens <input type="number" data-wa-max="${esc(c)}" min="1" max="31" inputmode="numeric" placeholder="egal" value="${esc(o.max ?? '')}"> Tage <select data-wa-per="${esc(c)}"><option value="monat" ${o.per === 'woche' ? '' : 'selected'}>im Monat</option><option value="woche" ${o.per === 'woche' ? 'selected' : ''}>pro Woche</option></select></span></div>`; }).join('') || '<p class="hinweis">Du hast noch keine Dienst-Kürzel. Lege sie unter „Kürzel verwalten“ an.</p>'}</div>
<p class="hinweis">Kürzel mit Limit werden zuerst eingesetzt. Zwischen zwei Diensten bleiben mindestens 11 Stunden Ruhe, und es werden höchstens 6 Arbeitstage am Stück geplant. Die Tage pro Woche zählen nur die Tage in diesem Monat.</p>
<div class="reihe"><button class="btn pri" id="wish-auto-run" type="button">Plan vorschlagen</button><button class="btn" id="wish-auto-reset" type="button">Zurücksetzen</button></div>
<div id="wish-auto-result" class="wish-auto-result" hidden role="status"></div></details>`;
}

export function leseAutoPlan(root) {
  const val = (sel) => root.querySelector(sel)?.value ?? '';
  const s = { sperr: [...root.querySelectorAll('[data-wa-sperr]')].filter((x) => x.checked).map((x) => Number(x.dataset.waSperr)),
    proWoche: val('#wa-woche'), ziel: val('#wa-ziel'), ohneFeiertag: !!root.querySelector('#wa-feiertag')?.checked, ersetzen: !!root.querySelector('#wa-ersetzen')?.checked, codes: {} };
  root.querySelectorAll('[data-wa-use]').forEach((x) => {
    const c = x.dataset.waUse;
    s.codes[c] = { use: x.checked, max: root.querySelector(`[data-wa-max="${CSS.escape(c)}"]`)?.value ?? '', per: root.querySelector(`[data-wa-per="${CSS.escape(c)}"]`)?.value || 'monat' };
  });
  return s;
}
const schluessel = (uid) => 'shiftly.autoplan.' + (uid || '');
export function ladeAutoPlan(uid) { try { const t = localStorage.getItem(schluessel(uid)); return t ? { ...AUTO_DEFAULTS, ...JSON.parse(t) } : { ...AUTO_DEFAULTS }; } catch { return { ...AUTO_DEFAULTS }; } }
export function speichereAutoPlan(uid, s) { try { if (s) localStorage.setItem(schluessel(uid), JSON.stringify(s)); else localStorage.removeItem(schluessel(uid)); } catch { /* ohne Speicher weiter */ } }
