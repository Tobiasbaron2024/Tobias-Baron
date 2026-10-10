/* Groschen Plus: reine Rechenlogik ohne DOM und ohne Netzwerk.
   Wird von app.js importiert und separat in Node getestet. */
const p2 = (n) => String(n).padStart(2, '0');
export const isoOf = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const parseISO = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const isValidISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && isoOf(parseISO(s)) === s && Number(s.slice(0, 4)) >= 2000 && Number(s.slice(0, 4)) <= 2100;
export const dayDiff = (a, b) => { const x = parseISO(a), y = parseISO(b); return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 86400000); };
export const addDaysISO = (s, n) => { const d = parseISO(s); return isoOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
export function addMonthsISO(s, n) {
  const d = parseISO(s); const y = d.getFullYear(); const m = d.getMonth() + n;
  const last = new Date(y, m + 1, 0).getDate();
  return isoOf(new Date(y, m, Math.min(d.getDate(), last)));
}
const num = (v) => Number(v) || 0;
const round2 = (v) => Math.round(num(v) * 100) / 100;

/* ---------- Laufzeit von Fixkosten, Raten und Einnahmen ---------- */
export const monthlyOf = (r) => num(r.amount) / (r.interval_months || 1);
export const isOnce = (r) => !!(r.is_one_time && r.valid_from);

/* aktiv = heute gültig, geplant = beginnt später, beendet = Ende liegt in der Vergangenheit */
export function recStatus(r, todayISO) {
  const from = r.valid_from || null; const to = r.valid_to || null;
  if (isOnce(r)) return from > todayISO ? 'geplant' : from === todayISO ? 'aktiv' : 'beendet';
  if (from && from > todayISO) return 'geplant';
  if (to && to < todayISO) return 'beendet';
  return 'aktiv';
}

/* Anteil der Tage eines Zeitraums (sI..eI, jeweils inklusive), an denen der Posten gilt */
export function activeFraction(r, sI, eI) {
  const total = dayDiff(sI, eI) + 1;
  if (total <= 0) return 0;
  if (isOnce(r)) return r.valid_from >= sI && r.valid_from <= eI ? 1 : 0;
  const from = r.valid_from && r.valid_from > sI ? r.valid_from : sI;
  const to = r.valid_to && r.valid_to < eI ? r.valid_to : eI;
  if (from > to) return 0;
  return (dayDiff(from, to) + 1) / total;
}

/* Betrag, der in diesem Zeitraum angerechnet wird: Monatsanteil mal gültige Tage, einmalige Posten voll */
export function amountForPeriod(r, sI, eI) {
  if (isOnce(r)) return activeFraction(r, sI, eI) ? num(r.amount) : 0;
  return monthlyOf(r) * activeFraction(r, sI, eI);
}
export const sumRecurring = (list, kind, sI, eI) => list.filter((r) => r.kind === kind).reduce((s, r) => s + amountForPeriod(r, sI, eI), 0);

/* Monatsbetrag, der heute läuft (für die Kennzahlen der Fixkosten-Seite) */
export const monthlyNow = (r, todayISO) => (!isOnce(r) && recStatus(r, todayISO) === 'aktiv' ? monthlyOf(r) : 0);

/* Hinweise für die Rechnung: Posten, die in diesem Zeitraum nur teilweise oder einmalig zählen */
export function periodNotes(list, sI, eI) {
  const out = [];
  for (const r of list) {
    if (isOnce(r)) { if (activeFraction(r, sI, eI)) out.push({ id: r.id, name: r.name, kind: r.kind, type: 'einmalig', date: r.valid_from, amount: num(r.amount) }); continue; }
    const fr = activeFraction(r, sI, eI);
    if (fr > 0 && fr < 1) out.push({ id: r.id, name: r.name, kind: r.kind, type: 'anteilig', fraction: fr, days: Math.round(fr * (dayDiff(sI, eI) + 1)), totalDays: dayDiff(sI, eI) + 1, amount: monthlyOf(r) * fr });
  }
  return out;
}

/* Restlaufzeit einer Rate: wie viele Zahlungen noch kommen und wann sie frei ist (ungefähre Angabe) */
export function remainingInfo(r, todayISO) {
  if (isOnce(r) || !r.valid_to || r.valid_to < todayISO) return null;
  const start = r.valid_from && r.valid_from > todayISO ? r.valid_from : todayISO;
  const a = parseISO(start); const b = parseISO(r.valid_to);
  const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
  const iv = r.interval_months || 1;
  const payments = Math.max(1, Math.ceil(months / iv));
  return { end: r.valid_to, months, payments, total: payments * num(r.amount), freeFrom: addDaysISO(r.valid_to, 1) };
}

/* Vorschau: ab wann ändert sich, wie viel im Monat frei ist (Raten enden, neue Verträge beginnen) */
export function upcomingChanges(list, todayISO, months = 12) {
  const horizon = addMonthsISO(todayISO, months);
  const ev = [];
  for (const r of list) {
    const sign = r.kind === 'in' ? 1 : -1;
    if (isOnce(r)) {
      if (r.valid_from >= todayISO && r.valid_from <= horizon) ev.push({ date: r.valid_from, type: 'einmalig', id: r.id, name: r.name, kind: r.kind, once: sign * num(r.amount), delta: 0 });
      continue;
    }
    if (r.valid_from && r.valid_from > todayISO && r.valid_from <= horizon) ev.push({ date: r.valid_from, type: 'start', id: r.id, name: r.name, kind: r.kind, delta: sign * monthlyOf(r) });
    if (r.valid_to && r.valid_to >= todayISO) {
      const d = addDaysISO(r.valid_to, 1);
      if (d <= horizon) ev.push({ date: d, type: 'ende', id: r.id, name: r.name, kind: r.kind, delta: -sign * monthlyOf(r) });
    }
  }
  return ev.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

/* Enddatum aus Startdatum und Anzahl Raten (monatlich = 1, vierteljährlich = 3 ...) */
export function endDateFromPayments(startISO, count, intervalMonths = 1) {
  const n = Math.floor(Number(count));
  if (!isValidISO(startISO) || !(n >= 1) || n > 1200) return null;
  return addDaysISO(addMonthsISO(startISO, n * (intervalMonths || 1)), -1);
}

/* Prüfung der Eingaben im Formular; gibt eine Fehlermeldung oder null zurück */
export function validateValidity({ valid_from, valid_to, is_one_time }) {
  if (valid_from && !isValidISO(valid_from)) return 'Bitte gib ein gültiges Startdatum ein.';
  if (valid_to && !isValidISO(valid_to)) return 'Bitte gib ein gültiges Enddatum ein.';
  if (is_one_time && !valid_from) return 'Für eine einmalige Zahlung brauchst du ein Datum.';
  if (!is_one_time && valid_from && valid_to && valid_to < valid_from) return 'Das Ende liegt vor dem Start. Bitte prüfe die Daten.';
  return null;
}

/* ---------- Tagesplaner ---------- */
const defFmt = (v) => `${round2(v).toFixed(2).replace('.', ',')} €`;

/* Was passiert, wenn ich heute noch einen Betrag ausgebe? */
export function whatIf(c, amount) {
  const a = num(amount);
  const spent = c.spentToday + a;
  const todayLeft = c.daily - spent;
  const tomorrow = c.daysLeft > 1 ? (c.restFromToday - spent) / (c.daysLeft - 1) : null;
  return { todayLeft, tomorrow, tomorrowBase: c.tomorrowDaily, change: tomorrow == null || c.tomorrowDaily == null ? null : tomorrow - c.tomorrowDaily };
}

/* Gestern: wie viel Tagesbudget war übrig und was bedeutet das für heute? */
export function carryOver(c) {
  if (c.state !== 'current' || c.elapsed < 2 || c.spentYesterday == null) return null;
  const budgetYesterday = (c.available - (c.spentBefore - c.spentYesterday) - c.spentFuture) / (c.daysLeft + 1);
  const left = budgetYesterday - c.spentYesterday;
  return { budgetYesterday, spentYesterday: c.spentYesterday, left, dailyChange: c.daily - budgetYesterday };
}

/* Handlungsempfehlung für heute. tone: ok | saved | tight | over | todayOver */
export function dayAdvice(c, o = {}) {
  if (!c || c.state !== 'current') return null;
  if (!(c.available > 0) && c.spentTotal === 0) return null;
  const f = o.eur || defFmt; const dl = o.deDate || ((d) => isoOf(d));
  const names = o.names || {};
  const top = Object.entries(c.byCat || {}).sort((a, b) => b[1] - a[1])[0];
  const endTxt = dl(c.end);
  const over = c.restFromToday < 0;
  const deficit = -(c.restFromToday - c.spentToday);
  const points = [];
  if (over) {
    points.push('Kauf heute nur, was wirklich nötig ist. Alles andere kann warten: Geh heute am besten nicht einkaufen und warte einen Tag.');
    points.push(`Bis zum ${endTxt} sind noch ${c.daysLeft} ${c.daysLeft === 1 ? 'Tag' : 'Tage'} übrig, rechnerisch ist aber nichts mehr frei. Jede weitere Ausgabe vergrößert das Minus.`);
    if (top) points.push(`Dein größter Posten in diesem Zeitraum ist „${names[top[0]] || top[0]}“ mit ${f(top[1])}. Hier kannst du am ehesten bremsen.`);
    points.push(`Um wieder bei 0 € zu landen, müssen ${f(Math.max(0, deficit))} eingespart oder zusätzlich eingenommen werden.`);
    return { tone: 'over', title: `Du liegst ${f(Math.max(0, deficit))} im Minus`, points };
  }
  if (c.todayLeft < 0) {
    points.push('Gib heute nichts mehr aus. Alles, was noch nötig ist, am besten auf morgen verschieben.');
    if (c.tomorrowDaily != null) points.push(`Dein Tagesbudget sinkt dadurch ab morgen von ${f(c.daily)} auf ${f(Math.max(0, c.tomorrowDaily))}.`);
    return { tone: 'todayOver', title: `Heute schon ${f(-c.todayLeft)} über dem Tagesbudget`, points };
  }
  const tight = c.forecastEnd < 0 || (c.ideal > 0 && c.daily < c.ideal * 0.6);
  const co = carryOver(c);
  if (tight) {
    points.push(`Dein Tagesbudget liegt bei ${f(c.daily)}, geplant waren ${f(Math.max(0, c.ideal))} pro Tag.`);
    if (c.spentToday === 0 && c.tomorrowDaily != null) points.push(`Tipp: Geh heute am besten nicht einkaufen und warte einen Tag. Dann hast du morgen ${f(Math.max(0, c.tomorrowDaily))} pro Tag statt ${f(c.daily)}.`);
    else points.push('Tipp: Verschiebe größere Einkäufe, bis es wieder entspannter ist.');
    if (c.forecastEnd < 0) points.push(`Bei deinem Tempo (Ø ${f(c.avg)} pro Tag) fehlen am ${endTxt} etwa ${f(-c.forecastEnd)}. Mit höchstens ${f(Math.max(0, c.daily))} pro Tag kommst du genau hin.`);
    return { tone: 'tight', title: 'Es wird knapp', points };
  }
  points.push(`Heute sind noch ${f(c.todayLeft)} frei (Tagesbudget ${f(c.daily)}).`);
  if (co && co.left > 0.005) points.push(`Gestern hast du ${f(co.left)} weniger ausgegeben als geplant. Dadurch ist dein Tagesbudget um ${f(Math.max(0, co.dailyChange))} gestiegen.`);
  if (c.spentToday === 0 && c.tomorrowDaily != null) points.push(`Gibst du heute nichts aus, steigt dein Tagesbudget ab morgen auf ${f(c.tomorrowDaily)} (${c.tomorrowDaily - c.daily >= 0 ? '+' : '−'}${f(Math.abs(c.tomorrowDaily - c.daily))}).`);
  if (c.forecastEnd > 0 && c.daysLeft >= 3) points.push(`Bei deinem Tempo bleiben am ${endTxt} etwa ${f(c.forecastEnd)} übrig. Du könntest davon ${f(Math.floor(c.forecastEnd / 2))} gleich zur Seite legen.`);
  return { tone: c.spentToday === 0 && c.tomorrowDaily != null && co && co.left > 0.005 ? 'saved' : 'ok', title: 'Du liegst im Plan', points };
}

/* Tag für Tag: Tagesbudget, Ausgaben und Rest für jeden Tag des Zeitraums */
export function dayRows(c, todayISO) {
  const rows = []; let cum = 0; const n = c.totalDays;
  for (let i = 0; i < n; i++) {
    const date = addDaysISO(c.sI, i);
    const budget = (c.available - cum) / (n - i);
    const spent = c.perDay[i] || 0;
    cum += spent;
    rows.push({ date, budget, spent, diff: budget - spent, rest: c.available - cum, status: date < todayISO ? 'past' : date === todayISO ? 'today' : 'future' });
  }
  return rows;
}

/* Durchschnittliche Ausgaben pro Wochentag (0 = Sonntag) im Bereich startISO..endISO */
export function weekdayAverages(outs, startISO, endISO) {
  const tot = Array(7).fill(0); const cnt = Array(7).fill(0);
  if (endISO < startISO) return tot.map((t, i) => ({ wd: i, total: 0, days: 0, avg: 0 }));
  for (let d = startISO; d <= endISO; d = addDaysISO(d, 1)) cnt[parseISO(d).getDay()]++;
  for (const x of outs) { if (x.date >= startISO && x.date <= endISO) tot[parseISO(x.date).getDay()] += num(x.amount); }
  return tot.map((t, i) => ({ wd: i, total: t, days: cnt[i], avg: cnt[i] ? t / cnt[i] : 0 }));
}

/* ---------- Vergleich mit dem Durchschnitt und Monatscheck ---------- */
/* Groschen-Kategorie -> Schlüssel in der Tabelle spending_benchmarks */
export const BENCH_KEY = { lebensmittel: 'food_tobacco', essen: 'restaurants', mobil: 'transport', freizeit: 'leisure', shopping: 'shopping' };
const ADVICE = {
  shopping: 'Versuche, weniger Klamotten und Kleinkram zu kaufen. Warte bei jedem Kauf 48 Stunden, bevor du bestellst. Viele Wünsche erledigen sich von selbst. Gebraucht kaufen spart zusätzlich.',
  essen: 'Versuche, seltener zu bestellen oder essen zu gehen. Selbst kochen und vorkochen kostet oft nur ein Drittel.',
  lebensmittel: 'Schreib vor dem Einkauf einen Zettel und geh nicht hungrig los. Vergleiche Preise pro Kilo und kauf nur, was du wirklich brauchst.',
  mobil: 'Prüfe, ob du Wege bündeln oder öfter Bus und Bahn nehmen kannst. Beim Tanken lohnt sich ein Preisvergleich.',
  freizeit: 'Setz dir ein festes Freizeit-Budget pro Woche, dann entscheidest du bewusst, wofür es sich lohnt.',
};
export const MONTH_DAYS = 30.4375;

/* Passenden Vergleichswert wählen: Einpersonen-, Zweipersonenhaushalt oder alle Haushalte */
export function pickBenchmark(rows, key, household) {
  const hh = Number(household) || 1;
  const want = hh === 1 ? key + '_single' : hh === 2 ? key + '_two' : key;
  const hit = rows.find((r) => r.category === want) || rows.find((r) => r.category === key);
  return hit ? { value: num(hit.monthly_eur), scope: hit.scope, year: hit.reference_year, source: hit.source_name, url: hit.source_url } : null;
}

export function monthlyAmount(total, totalDays) { return totalDays > 0 ? (total * MONTH_DAYS) / totalDays : 0; }

/* Vergleich je Kategorie mit dem Durchschnitt (für Analyse-Seite und Tipps) */
export function benchmarkRows({ byCat, totalDays, bench, household, names = {} }) {
  const out = [];
  for (const [cat, key] of Object.entries(BENCH_KEY)) {
    const b = pickBenchmark(bench || [], key, household);
    if (!b) continue;
    const spent = byCat[cat] || 0;
    const monthly = monthlyAmount(spent, totalDays);
    out.push({ cat, name: names[cat] || cat, monthly, typical: b.value, ratio: b.value ? monthly / b.value : 0, scope: b.scope, year: b.year, source: b.source, url: b.url });
  }
  return out;
}

/* Spartipps zum Monatscheck: zu hohe Ausgaben im Vergleich zum Durchschnitt */
export function monthlyCheck({ byCat, totalDays, bench, household, f = defFmt, names = {} }) {
  const tips = [];
  for (const r of benchmarkRows({ byCat, totalDays, bench, household, names })) {
    if (!(r.monthly > 0) || r.ratio < 1.25) continue;
    const gap = r.monthly - r.typical;
    const save = gap * 12 * 0.5;
    const extra = r.cat === 'lebensmittel' ? ' (inklusive Getränke und Tabak)' : r.cat === 'shopping' ? ' (Bekleidung und Schuhe)' : r.cat === 'mobil' ? ' (Verkehr insgesamt)' : '';
    tips.push({
      kind: 'bench', cat: r.cat, level: r.ratio >= 2 ? 'warn' : '', monthly: r.monthly, typical: r.typical, target: Math.max(5, Math.round(r.typical / 5) * 5), save,
      title: `${r.name}: ${f(r.monthly)} im Monat, üblich sind ca. ${f(r.typical)}`,
      text: `Du gibst hier ${Math.round((r.ratio - 1) * 100)} % mehr aus als der Durchschnitt (${r.scope}, ${r.source}${extra}). ${ADVICE[r.cat] || ''} Würdest du die Lücke von ${f(gap)} zur Hälfte schließen, wären das etwa ${f(save)} im Jahr.`,
    });
  }
  return tips;
}

/* Tabak: kein amtlicher Vergleichswert, deshalb nur eigener Verlauf */
export function tobaccoTip({ monthlyTx = 0, monthlyFix = 0, prevMonthlyTx = 0, f = defFmt }) {
  const m = monthlyTx + monthlyFix;
  if (!(m >= 1)) return null;
  let trend = '';
  if (prevMonthlyTx > 5 && monthlyTx > prevMonthlyTx * 1.15) trend = ` Gegenüber dem Vorzeitraum gibst du ${Math.round((monthlyTx / prevMonthlyTx - 1) * 100)} % mehr dafür aus.`;
  return {
    kind: 'tabak', cat: 'tabak', level: '', monthly: m, target: Math.round((m * 0.8) / 5) * 5, save: m * 0.2 * 12,
    title: `Tabak & Rauchen: ${f(m)} im Monat, das sind ${f(m * 12)} im Jahr`,
    text: `Weniger zu rauchen schont Geldbeutel und Gesundheit. Schon ein Fünftel weniger spart ${f(m * 0.2 * 12)} im Jahr.${trend} Die amtliche Statistik weist Tabak nicht einzeln aus, deshalb vergleicht Groschen hier nur mit deinem eigenen Verlauf.`,
  };
}

/* Kategorien, die deutlich teurer wurden als im Vorzeitraum */
export function trendTips({ byCat, prevByCat, names = {}, f = defFmt, skip = [] }) {
  const out = [];
  for (const [cat, v] of Object.entries(byCat)) {
    if (skip.includes(cat)) continue;
    const p = prevByCat[cat] || 0;
    if (v >= 30 && p >= 20 && v >= p * 1.3) {
      out.push({ kind: 'trend', cat, level: '', monthly: v, save: (v - p) * 12 * 0.5,
        title: `${names[cat] || cat}: ${Math.round((v / p - 1) * 100)} % mehr als im Vorzeitraum`,
        text: `Im letzten Zeitraum waren es ${f(p)}, jetzt ${f(v)}. Schau dir die Buchungen dieser Kategorie an und entscheide, was davon wirklich nötig war.` });
    }
  }
  return out;
}

/* Vorsatz des Monats: der Tipp mit dem größten Sparpotenzial und einem klaren Ziel */
export function pickFocus(tips) {
  return tips.filter((t) => t.target != null && t.cat).sort((a, b) => (b.save || 0) - (a.save || 0))[0] || null;
}
