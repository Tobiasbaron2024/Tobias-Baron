// Stundenzettel – Rechenkern (Feiertage, Tarife, Schichtberechnung)
export const DAY = 86400000;

// Tarif-Voreinstellungen Sicherheitsdienst (BDSW-Entgeltübersicht, Stand 01.04.2026, Lohngruppe Objektschutz)
export const TARIF_STAND = 'BDSW-Entgeltübersicht, Stand 01.04.2026, Lohngruppe Objektschutz';
export const REGIONEN = {
  HH: { n: 'Hamburg', w: 15.14, np: 15, nf: '20:00', nt: '06:00', sp: 50, fp: 100, tf: 1, mh: 228, mp: 25 },
  BE: { n: 'Berlin', w: 15.15, np: 15, nf: '22:00', nt: '06:00', sp: 25, fp: 50 },
  BB: { n: 'Brandenburg (Potsdam)', w: 15.15, np: 15, nf: '22:00', nt: '06:00', sp: 25, fp: 50 },
  HE: { n: 'Hessen (Frankfurt)', w: 15.15, np: 12, nf: '20:00', nt: '06:00', sp: 25, fp: 100 },
  BW: { n: 'Baden-Württemberg (Stuttgart)', w: 15.14, np: 15, nf: '20:00', nt: '06:00', sp: 35, fp: 100 },
  BY: { n: 'Bayern (München, Ortsklasse 1)', w: 14.92, np: 23, nf: '20:00', nt: '06:00', sp: 26, fp: 100 },
  BY_MH: { n: 'Bayern (Gemeinde mit Mariä Himmelfahrt)', w: 14.92, np: 23, nf: '20:00', nt: '06:00', sp: 26, fp: 100 },
  BY_AUG: { n: 'Bayern (Stadt Augsburg)', w: 14.92, np: 23, nf: '20:00', nt: '06:00', sp: 26, fp: 100 },
  HB: { n: 'Bremen', w: 14.60, np: 5, nf: '23:00', nt: '06:00', sp: 50, fp: 100 },
  MV: { n: 'Mecklenburg-Vorpommern (Rostock)', w: 15.27, np: 10, nf: '22:00', nt: '06:00', sp: 25, fp: 50 },
  NI: { n: 'Niedersachsen (Hannover)', w: 15.14, np: 10, nf: '23:00', nt: '06:00', sp: 50, fp: 100 },
  NW: { n: 'Nordrhein-Westfalen (Köln, Düsseldorf)', w: 15.11, np: 10, nf: '22:00', nt: '06:00', sp: 50, fp: 100 },
  RP: { n: 'Rheinland-Pfalz (Mainz)', w: 15.14, np: 10, nf: '20:00', nt: '06:00', sp: 25, fp: 100 },
  SL: { n: 'Saarland (Saarbrücken)', w: 15.14, np: 10, nf: '20:00', nt: '06:00', sp: 25, fp: 100 },
  SN: { n: 'Sachsen (Dresden, Leipzig)', w: 15.15, np: 10, nf: '23:00', nt: '06:00', sp: 25, fp: 50 },
  SN_F: { n: 'Sachsen (Ort mit Fronleichnam)', w: 15.15, np: 10, nf: '23:00', nt: '06:00', sp: 25, fp: 50 },
  ST: { n: 'Sachsen-Anhalt (Magdeburg)', w: 15.15, np: 10, nf: '22:00', nt: '06:00', sp: 25, fp: 50 },
  SH: { n: 'Schleswig-Holstein (Kiel)', w: 15.10, np: 15, nf: '20:00', nt: '06:00', sp: 10, fp: 50 },
  TH: { n: 'Thüringen (Erfurt)', w: 15.15, np: 10, nf: '22:00', nt: '06:00', sp: 25, fp: 50 },
  TH_F: { n: 'Thüringen (Ort mit Fronleichnam)', w: 15.15, np: 10, nf: '22:00', nt: '06:00', sp: 25, fp: 50 },
  AT: { n: 'Österreich (Wien)', eu: 1 }, CH: { n: 'Schweiz (Zürich)', eu: 1 }, NL: { n: 'Niederlande (Amsterdam)', eu: 1 },
  BEL: { n: 'Belgien (Brüssel)', eu: 1 }, FR: { n: 'Frankreich (Paris)', eu: 1 }, IT: { n: 'Italien (Rom)', eu: 1 },
  ES: { n: 'Spanien (Madrid)', eu: 1 }, PL: { n: 'Polen (Warschau)', eu: 1 }, DK: { n: 'Dänemark (Kopenhagen)', eu: 1 },
};

export function ostern(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(y, mo - 1, da);
}
export const tagKey = (t) => new Date(t).toISOString().slice(0, 10);

export function feiertage(region, y) {
  const E = ostern(y), L = [];
  const fx = (m, d, n) => L.push([Date.UTC(y, m - 1, d), n]);
  const ez = (o, n) => L.push([E + o * DAY, n]);
  const inS = (...s) => s.includes(region.split('_')[0]);
  const R = REGIONEN[region];
  if (R && !R.eu) {
    fx(1, 1, 'Neujahr');
    if (inS('BW', 'BY', 'ST')) fx(1, 6, 'Heilige Drei Könige');
    if (inS('BE') || (inS('MV') && y >= 2023)) fx(3, 8, 'Internationaler Frauentag');
    if (inS('BE') && y === 2025) fx(5, 8, 'Tag der Befreiung (einmalig)');
    ez(-2, 'Karfreitag');
    if (inS('BB')) ez(0, 'Ostersonntag');
    ez(1, 'Ostermontag'); fx(5, 1, 'Tag der Arbeit'); ez(39, 'Christi Himmelfahrt');
    if (inS('BB')) ez(49, 'Pfingstsonntag');
    ez(50, 'Pfingstmontag');
    if (inS('BW', 'BY', 'HE', 'NW', 'RP', 'SL') || region === 'SN_F' || region === 'TH_F') ez(60, 'Fronleichnam');
    if (inS('SL') || region === 'BY_MH' || region === 'BY_AUG') fx(8, 15, 'Mariä Himmelfahrt');
    if (region === 'BY_AUG') fx(8, 8, 'Augsburger Friedensfest');
    if (inS('TH')) fx(9, 20, 'Weltkindertag');
    fx(10, 3, 'Tag der Deutschen Einheit');
    if (inS('HH', 'HB', 'NI', 'SH', 'BB', 'MV', 'SN', 'ST', 'TH')) fx(10, 31, 'Reformationstag');
    if (inS('BW', 'BY', 'NW', 'RP', 'SL')) fx(11, 1, 'Allerheiligen');
    if (inS('SN')) { let t = Date.UTC(y, 10, 22); while (new Date(t).getUTCDay() !== 3) t -= DAY; L.push([t, 'Buß- und Bettag']); }
    fx(12, 25, '1. Weihnachtstag'); fx(12, 26, '2. Weihnachtstag');
  } else {
    const sets = {
      AT: () => { fx(1, 1, 'Neujahr'); fx(1, 6, 'Heilige Drei Könige'); ez(1, 'Ostermontag'); fx(5, 1, 'Staatsfeiertag'); ez(39, 'Christi Himmelfahrt'); ez(50, 'Pfingstmontag'); ez(60, 'Fronleichnam'); fx(8, 15, 'Mariä Himmelfahrt'); fx(10, 26, 'Nationalfeiertag'); fx(11, 1, 'Allerheiligen'); fx(12, 8, 'Mariä Empfängnis'); fx(12, 25, 'Christtag'); fx(12, 26, 'Stefanitag'); },
      CH: () => { fx(1, 1, 'Neujahr'); fx(1, 2, 'Berchtoldstag'); ez(-2, 'Karfreitag'); ez(1, 'Ostermontag'); fx(5, 1, 'Tag der Arbeit'); ez(39, 'Auffahrt'); ez(50, 'Pfingstmontag'); fx(8, 1, 'Bundesfeier'); fx(12, 25, 'Weihnachten'); fx(12, 26, 'Stephanstag'); },
      NL: () => { fx(1, 1, 'Nieuwjaarsdag'); ez(0, 'Eerste Paasdag'); ez(1, 'Tweede Paasdag'); const k = Date.UTC(y, 3, 27); L.push([new Date(k).getUTCDay() === 0 ? k - DAY : k, 'Koningsdag']); fx(5, 5, 'Bevrijdingsdag'); ez(39, 'Hemelvaartsdag'); ez(49, 'Eerste Pinksterdag'); ez(50, 'Tweede Pinksterdag'); fx(12, 25, 'Eerste Kerstdag'); fx(12, 26, 'Tweede Kerstdag'); },
      BEL: () => { fx(1, 1, 'Neujahr'); ez(1, 'Ostermontag'); fx(5, 1, 'Tag der Arbeit'); ez(39, 'Christi Himmelfahrt'); ez(50, 'Pfingstmontag'); fx(7, 21, 'Nationalfeiertag'); fx(8, 15, 'Mariä Himmelfahrt'); fx(11, 1, 'Allerheiligen'); fx(11, 11, 'Waffenstillstand'); fx(12, 25, 'Weihnachten'); },
      FR: () => { fx(1, 1, "Jour de l'an"); ez(1, 'Lundi de Pâques'); fx(5, 1, 'Fête du Travail'); fx(5, 8, 'Victoire 1945'); ez(39, 'Ascension'); ez(50, 'Lundi de Pentecôte'); fx(7, 14, 'Fête nationale'); fx(8, 15, 'Assomption'); fx(11, 1, 'Toussaint'); fx(11, 11, 'Armistice'); fx(12, 25, 'Noël'); },
      IT: () => { fx(1, 1, 'Capodanno'); fx(1, 6, 'Epifania'); ez(0, 'Pasqua'); ez(1, 'Pasquetta'); fx(4, 25, 'Festa della Liberazione'); fx(5, 1, 'Festa del Lavoro'); fx(6, 2, 'Festa della Repubblica'); fx(8, 15, 'Ferragosto'); fx(11, 1, 'Ognissanti'); fx(12, 8, 'Immacolata'); fx(12, 25, 'Natale'); fx(12, 26, 'Santo Stefano'); },
      ES: () => { fx(1, 1, 'Año Nuevo'); fx(1, 6, 'Epifanía'); ez(-2, 'Viernes Santo'); fx(5, 1, 'Fiesta del Trabajo'); fx(8, 15, 'Asunción'); fx(10, 12, 'Fiesta Nacional'); fx(11, 1, 'Todos los Santos'); fx(12, 6, 'Día de la Constitución'); fx(12, 8, 'Inmaculada Concepción'); fx(12, 25, 'Navidad'); },
      PL: () => { fx(1, 1, 'Nowy Rok'); fx(1, 6, 'Trzech Króli'); ez(0, 'Wielkanoc'); ez(1, 'Poniedziałek Wielkanocny'); fx(5, 1, 'Święto Pracy'); fx(5, 3, 'Święto Konstytucji'); ez(49, 'Zielone Świątki'); ez(60, 'Boże Ciało'); fx(8, 15, 'Wniebowzięcie'); fx(11, 1, 'Wszystkich Świętych'); fx(11, 11, 'Święto Niepodległości'); if (y >= 2025) fx(12, 24, 'Wigilia'); fx(12, 25, 'Boże Narodzenie'); fx(12, 26, 'Drugi dzień Świąt'); },
      DK: () => { fx(1, 1, 'Nytårsdag'); ez(-3, 'Skærtorsdag'); ez(-2, 'Langfredag'); ez(0, 'Påskedag'); ez(1, '2. påskedag'); ez(39, 'Kristi himmelfartsdag'); ez(49, 'Pinsedag'); ez(50, '2. pinsedag'); fx(12, 25, 'Juledag'); fx(12, 26, '2. juledag'); },
    };
    sets[region] && sets[region]();
  }
  return L.sort((a, b) => a[0] - b[0]);
}

const cache = {};
export function feiertagName(region, t) {
  const y = new Date(t).getUTCFullYear(), k = region + y;
  if (!cache[k]) { const m = {}; feiertage(region, y).forEach(([ts, n]) => { m[tagKey(ts)] = n; }); cache[k] = m; }
  return cache[k][tagKey(t)];
}

// Tarifliche Zuschlags-Feiertage (Lohntarifvertrag Sicherheitsdienstleistungen Hamburg, § 5 Nr. 2):
// 24. und 31. Dezember jeweils ab 14:00 Uhr sowie Ostersonntag und Pfingstsonntag – 100 % statt Sonntagszuschlag.
// Das sind keine gesetzlichen Feiertage (zählen z. B. beim Urlaub nicht), nur für die Zuschlagsberechnung.
const osterCache = {};
export function tarifFeiertag(region, t) {
  if (!REGIONEN[region]?.tf) return null;
  const d = new Date(t), mo = d.getUTCMonth(), ta = d.getUTCDate(), min = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (mo === 11 && ta === 24 && min >= 840) return 'Heiligabend ab 14 Uhr';
  if (mo === 11 && ta === 31 && min >= 840) return 'Silvester ab 14 Uhr';
  if (d.getUTCDay() === 0 && (mo === 2 || mo === 3 || mo === 4 || mo === 5)) {
    const y = d.getUTCFullYear(), E = osterCache[y] ?? (osterCache[y] = ostern(y)), tag = Date.UTC(y, mo, ta);
    if (tag === E) return 'Ostersonntag';
    if (tag === E + 49 * DAY) return 'Pfingstsonntag';
  }
  return null;
}
export const TARIF_FEIERTAGE_TEXT = { HH: 'Laut Lohntarifvertrag Hamburg gibt es außerdem 100 % Feiertagszuschlag am 24. und 31. Dezember jeweils ab 14:00 Uhr sowie am Ostersonntag und Pfingstsonntag. Die App rechnet das automatisch.' };

// Mehrarbeit: Schwelle (Stunden im Monat) und Zuschlag; null = Tarif der Region, 0 = aus
export function mehrarbeitRegel(cfg) {
  const R = REGIONEN[cfg.region];
  const ab = cfg.mehr_ab === null || cfg.mehr_ab === undefined || cfg.mehr_ab === '' ? (R?.mh ?? 0) : +cfg.mehr_ab;
  const pct = cfg.mehr_ab === null || cfg.mehr_ab === undefined || cfg.mehr_ab === '' ? (R?.mp ?? 0) : +(cfg.mehr_pct ?? 25);
  return { ab: ab > 0 ? ab : 0, pct: ab > 0 ? pct : 0 };
}

// Sonntag oder gesetzlicher Feiertag?
export const ruhetag = (region, datum) => { const t = Date.parse(datum + 'T00:00:00Z'); return new Date(t).getUTCDay() === 0 || !!feiertagName(region, t); };
export function urlaubArbeitstag(cfg, datum) {
  const wt = Array.isArray(cfg.vacation_weekdays) && cfg.vacation_weekdays.length ? cfg.vacation_weekdays.map(Number) : [1,2,3,4,5,6];
  return !ruhetag(cfg.region, datum) && wt.includes(new Date(datum+'T00:00:00Z').getUTCDay());
}

// Zeitumstellung (EU-Regel): letzter Sonntag im März 02:00 → 03:00 Uhr (Sommerzeit),
// letzter Sonntag im Oktober 03:00 → 02:00 Uhr (Winterzeit). t = Wanduhrzeit als UTC-Millisekunden.
const letzterSonntag = (y, mo) => { const d = new Date(Date.UTC(y, mo + 1, 0)); return Date.UTC(y, mo, d.getUTCDate() - d.getUTCDay()); };
export function zeitumstellungen(y) {
  return [
    { datum: tagKey(letzterSonntag(y, 2)), art: 'sommer', von: '02:00', nach: '03:00' },
    { datum: tagKey(letzterSonntag(y, 9)), art: 'winter', von: '03:00', nach: '02:00' },
  ];
}
// Wie oft eine Wanduhr-Minute tatsächlich gearbeitet wird: 0 (fällt weg), 1 oder 2 (doppelt)
export function uhrGewicht(t) {
  const d = new Date(t);
  if (d.getUTCDay() !== 0 || d.getUTCHours() !== 2) return 1;
  const mo = d.getUTCMonth();
  if ((mo !== 2 && mo !== 9) || d.getUTCDate() + 7 <= 31) return 1;
  return mo === 2 ? 0 : 2;
}
export const minuten = (s) => { const [a, b] = String(s).slice(0, 5).split(':').map(Number); return a * 60 + b; };

// Alle unterstützten Tarifregionen verwenden die mitteleuropäische Zeit.
function utcOffset(t) {
  const y = new Date(t).getUTCFullYear();
  const start = letzterSonntag(y, 2) + 3600000;
  const end = letzterSonntag(y, 9) + 3600000;
  return t >= start && t < end ? 7200000 : 3600000;
}
export function zeitKandidaten(datum, zeit) {
  const wall = Date.parse(datum + 'T00:00:00Z') + minuten(zeit) * 60000;
  return [wall - 7200000, wall - 3600000].filter(t => t + utcOffset(t) === wall);
}
export function schichtZeitraum(sh) {
  const a = zeitKandidaten(sh.datum, sh.beginn);
  const sameEnd = zeitKandidaten(sh.datum, sh.ende);
  const repeatedInterval = a.length === 2 && sameEnd.length === 2 &&
    sameEnd[Number(sh.ende_fold || 0)] > a[Number(sh.beginn_fold || 0)];
  const nacht = minuten(sh.ende) <= minuten(sh.beginn) && !repeatedInterval;
  const endDate = nacht ? tagKey(Date.parse(sh.datum + 'T00:00:00Z') + DAY) : sh.datum;
  const b = zeitKandidaten(endDate, sh.ende);
  const start = a[Math.min(Number(sh.beginn_fold || 0), a.length - 1)];
  const ende = b[Math.min(Number(sh.ende_fold || 0), b.length - 1)];
  const error = !a.length || !b.length ? 'Diese Uhrzeit fällt bei der Umstellung auf Sommerzeit aus. Bitte wähle eine gültige Uhrzeit.'
    : !(ende > start) ? 'Das Dienstende muss nach dem Beginn liegen. Bitte prüfe die Auswahl bei der Zeitumstellung.' : null;
  return {start, ende, endDate, error, startAmbiguous:a.length > 1,
    endAmbiguous:b.length > 1 || (a.length > 1 && sameEnd.length > 1)};
}

// Eine Schicht berechnen. cfg: {region, lohn, nacht_pct, nacht_von, nacht_bis, sonntag_pct, feiertag_pct, zuschlag_modus}
const LEER = { std: 0, tag: 0, nacht: 0, sonntag: 0, feiertag: 0, urlaub: 0, krank: 0, grund: 0, zuschlag: 0, nachtE: 0, sonntagE: 0, feiertagE: 0, objektE: 0, urlaubE: 0, krankE: 0, gesamt: 0 };
export function berechne(sh, cfg) {
  const lohnA = +cfg.lohn || 0;
  if (sh.art === 'frei') return { ...LEER, feiertagNamen: [], hatSonntag: false, folgetag: false, keinUrlaub: false };
  if (sh.art === 'urlaub' || sh.art === 'krank') {
    const t0 = Date.parse(sh.datum + 'T00:00:00Z');
    const fn = feiertagName(cfg.region, t0), so = new Date(t0).getUTCDay() === 0;
    // Urlaub zählt nicht an Sonntagen und Feiertagen
    const keinUrlaub = sh.art === 'urlaub' && !urlaubArbeitstag(cfg, sh.datum);
    const st = keinUrlaub ? 0 : (sh.stunden != null && sh.stunden !== '' ? +sh.stunden : +(sh.art === 'urlaub' ? cfg.urlaub_std : cfg.krank_std) || 0);
    const rate = sh.art === 'urlaub' ? (cfg.urlaub_stundenlohn == null ? lohnA : +cfg.urlaub_stundenlohn) + (+cfg.urlaub_zulage || 0)
      : (cfg.krank_stundenlohn == null ? lohnA : +cfg.krank_stundenlohn) + (+cfg.krank_zulage || 0);
    const e = st * rate;
    return { ...LEER, [sh.art]: st, [sh.art + 'E']: e, grund: 0, gesamt: e, feiertagNamen: fn ? [fn] : [], hatSonntag: so, folgetag: false, keinUrlaub };
  }
  const {start, ende, error, endDate} = schichtZeitraum(sh);
  if (error) return {...LEER, feiertagNamen:[], hatSonntag:false, folgetag:false, zeitFehler:error};
  const nf = minuten(cfg.nacht_von), nt = minuten(cfg.nacht_bis);
  const np = +cfg.nacht_pct || 0, sp = +cfg.sonntag_pct || 0, fp = +cfg.feiertag_pct || 0;
  let tot = 0, nacht = 0, sonn = 0, feier = 0, zPctMin = 0;
  const namen = new Set(); let hatSonntag = false;
  for (let t = start; t < ende; t += 60000) {
    const w = 1, wall = t + utcOffset(t);
    const dt = new Date(wall), mm = dt.getUTCHours() * 60 + dt.getUTCMinutes();
    const istN = nf === nt ? false : (nf < nt ? (mm >= nf && mm < nt) : (mm >= nf || mm < nt));
    const fn = feiertagName(cfg.region, wall) || tarifFeiertag(cfg.region, wall);
    const istF = !!fn, istS = !istF && dt.getUTCDay() === 0;
    tot += w; if (istN) nacht += w; if (istF) { feier += w; namen.add(fn); } if (istS) { sonn += w; hatSonntag = true; }
    const tagPct = istF ? fp : istS ? sp : 0, nP = istN ? np : 0;
    zPctMin += (cfg.zuschlag_modus === 'max' ? Math.max(tagPct, nP) : tagPct + nP) * w;
  }
  const pause = Math.min(Math.max(+sh.pause_min || 0, 0), tot);
  const f = tot ? (tot - pause) / tot : 0; // Pause anteilig von allen Stundenarten
  const h = (x) => (x * f) / 60;
  const lohn = +cfg.lohn || 0;
  const std = h(tot), grund = std * lohn;
  const nE = h(nacht) * lohn * np / 100, sE = h(sonn) * lohn * sp / 100, fE = h(feier) * lohn * fp / 100;
  const zusch = (zPctMin * f / 60 / 100) * lohn;
  const objektE = std * (+cfg.objektzulage || 0);
  return {
    ...LEER, std, tag: h(tot - nacht), nacht: h(nacht), sonntag: h(sonn), feiertag: h(feier),
    grund, zuschlag: zusch, nachtE: nE, sonntagE: sE, feiertagE: fE, objektE, gesamt: grund + zusch + objektE,
    feiertagNamen: [...namen], hatSonntag, folgetag: tagKey(ende - 1 + utcOffset(ende - 1)) !== sh.datum,
  };
}

export function summe(liste, cfg) {
  const S = { ...LEER, pause: 0, tageU: 0, tageK: 0, dienste: 0, mehrStd: 0, mehrE: 0, mehrAb: 0, mehrPct: 0 };
  const urlaubTage = new Set();
  liste.forEach(([sh, r]) => {
    if (sh.art === 'urlaub') { if (urlaubTage.has(sh.datum)) return; urlaubTage.add(sh.datum); }
    for (const k in LEER) S[k] += r[k] || 0;
    S.pause += sh.art === 'dienst' || !sh.art ? (+sh.pause_min || 0) : 0;
    if (sh.art === 'urlaub') { if (!r.keinUrlaub) S.tageU++; } else if (sh.art === 'krank') S.tageK++; else if (sh.art === 'dienst' || !sh.art) S.dienste++;
  });
  // Mehrarbeitszuschlag auf tatsächlich gearbeitete Stunden über der Monatsschwelle (Urlaub/Krank zählen nicht)
  if (cfg) {
    const M = mehrarbeitRegel(cfg);
    if (M.ab > 0 && S.std > M.ab) {
      S.mehrStd = S.std - M.ab; S.mehrAb = M.ab; S.mehrPct = M.pct;
      let bereits = 0;
      S.mehrE = liste.slice().sort(([a], [b]) => (a.datum + (a.beginn || '')).localeCompare(b.datum + (b.beginn || '')))
        .reduce((betrag, [, r]) => {
          const davor = bereits; bereits += r.std || 0;
          const ueber = Math.max(0, bereits - M.ab) - Math.max(0, davor - M.ab);
          return betrag + ueber * (r.std ? r.grund / r.std : 0) * M.pct / 100;
        }, 0);
      S.gesamt += S.mehrE;
    }
  }
  // Gesamtstunden: Arbeit + Urlaub + Krank
  S.stdGesamt = S.std + S.urlaub + S.krank;
  S.bezahltE = S.grund + S.urlaubE + S.krankE;
  return S;
}
