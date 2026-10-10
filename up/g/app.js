import { recStatus, sumRecurring, periodNotes, monthlyNow, remainingInfo, upcomingChanges, endDateFromPayments, validateValidity, whatIf, dayAdvice, dayRows, weekdayAverages, benchmarkRows, monthlyCheck, tobaccoTip, trendTips, pickFocus, monthlyAmount, MONTH_DAYS, BENCH_KEY } from './plus.js?v=1';
const SB_URL = 'https://qoluhdfpchotpftvnswy.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvbHVoZGZwY2hvdHBmdHZuc3d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMjcwNDcsImV4cCI6MjEwNTkwMzA0N30.hSX-s9HZDuDb8tFFxDY0iiTzQV1tuDGPUy1-FVtUsLI';
const USER_DOMAIN = 'groschen-haushaltsbuch.netlify.app';
let PRICE_MONTH = 2.49, PRICE_YEAR = 19.99;
const TRIAL_DAYS = 3;
window.addEventListener('aktionen:stand', (e) => {
const p = Object.fromEntries((e.detail?.preise || []).map((x) => [x.schluessel, x.cent / 100]));
const m = p.monat ?? PRICE_MONTH, j = p.jahr ?? PRICE_YEAR;
if (m === PRICE_MONTH && j === PRICE_YEAR) return;
PRICE_MONTH = m; PRICE_YEAR = j;
try { if (S.loaded && $('#sheet-wrap').hidden) renderApp(); } catch { /* App noch nicht bereit */ }
});
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtEur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const r2 = (v) => { const x = Math.round((Number(v) || 0) * 100) / 100; return Object.is(x, -0) ? 0 : x; };
const eur = (v) => fmtEur.format(r2(v));
const eur0 = (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(Number(v) || 0));
const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const diffDays = (a, b) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
const todayISO = () => iso(new Date());
const deDate = (s, withYear = true) => { const d = typeof s === 'string' ? parseD(s) : s; return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${withYear ? d.getFullYear() : ''}`; };
const deDateTime = (s) => { if (!s) return '–'; const d = new Date(s); return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }); };
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
function parseAmount(v) {
let s = String(v ?? '').trim().replace(/\s|€/g, '');
if (!s) return NaN;
if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
const n = Number(s);
if (!Number.isFinite(n)) return NaN;
return Math.round(n * 100) / 100;
}
const amountStr = (n) => (n == null || n === '' ? '' : String(r2(n)).replace('.', ','));
const LS = {
get(k) { try { return localStorage.getItem(k); } catch { return null; } },
set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignoriert */ } },
del(k) { try { localStorage.removeItem(k); } catch { /* ignoriert */ } },
};
const I = {
home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg>',
repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 013-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 01-3 3H3"/></svg>',
bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0012 2z"/></svg>',
chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/></svg>',
user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>',
stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/></svg>',
plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>',
clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};
const CATS = {
out: [
['lebensmittel', 'Lebensmittel', '#2A78D6'], ['drogerie', 'Drogerie', '#E87BA4'], ['essen', 'Restaurant & Lieferdienst', '#EB6834'],
['mobil', 'Tanken & Fahrten', '#4A3AA7'], ['freizeit', 'Freizeit', '#1BAF7A'], ['shopping', 'Shopping & Kleidung', '#D55181'],
['haushalt', 'Haushalt', '#8A6D3B'], ['gesundheit', 'Apotheke & Gesundheit', '#E34948'], ['tier', 'Haustier', '#B7791F'],
['geschenke', 'Geschenke', '#9085E9'], ['tabak', 'Tabak & Rauchen', '#7A6A58'], ['sonstiges', 'Sonstiges', '#6F7F79'],
],
in: [['gehalt', 'Gehalt', '#1B7F4F'], ['nebenjob', 'Nebenjob', '#1BAF7A'], ['erstattung', 'Erstattung', '#2A78D6'], ['verkauf', 'Verkauf', '#B7791F'], ['sonst_ein', 'Sonstige Einnahme', '#6F7F79']],
fix: [
['wohnen', 'Miete & Wohnen', '#2A78D6'], ['energie', 'Strom & Gas', '#EDA100'], ['handy', 'Handy', '#EB6834'], ['internet', 'Internet & TV', '#4A3AA7'],
['versicherung', 'Versicherung', '#1B7F4F'], ['abo', 'Streaming & Abos', '#D55181'], ['mobil_fix', 'Auto & ÖPNV', '#8A6D3B'], ['fitness', 'Fitness', '#1BAF7A'],
['bank', 'Bank & Konto', '#6F7F79'], ['kredit', 'Kredit & Raten', '#E34948'], ['rundfunk', 'Rundfunkbeitrag', '#9085E9'], ['tabak', 'Tabak & Rauchen', '#7A6A58'], ['sonst_fix', 'Sonstige Fixkosten', '#83948D'],
],
};
const CAT_MAP = Object.fromEntries([...CATS.out, ...CATS.in, ...CATS.fix].map(([k, n, c]) => [k, { k, n, c }]));
const CAT_NAMES = Object.fromEntries(Object.entries(CAT_MAP).map(([k, v]) => [k, v.n]));
const catName = (k) => CAT_MAP[k]?.n || 'Sonstiges';
const catColor = (k) => CAT_MAP[k]?.c || '#6F7F79';
const catIcon = (k) => `<span class="ic" style="background:${catColor(k)}">${esc(catName(k).slice(0, 2))}</span>`;
const AUTO_OUT = [
['tabak', /tabak|zigarette|kippen|marlboro|pall mall|lucky strike|drehtabak|shisha|vape|liquid/i],
['lebensmittel', /rewe|edeka|aldi|lidl|netto|penny|kaufland|bäcker|baecker|markt|supermarkt|einkauf|marktkauf|budni|tegut/i],
['drogerie', /\bdm\b|rossmann|müller drog|drogerie/i],
['essen', /lieferando|wolt|uber ?eats|restaurant|döner|doener|pizza|mc ?donald|burger|café|cafe|imbiss|kantine|sushi|essen gehen/i],
['mobil', /shell|aral|esso|\bjet\b|tanken|tankstelle|hvv|\bbahn\b|\bdb\b|taxi|\buber\b|parken|flixbus|benzin|diesel/i],
['freizeit', /kino|konzert|\bbar\b|club|museum|bowling|ticket|zoo|spiel|steam|playstation|xbox/i],
['shopping', /zalando|h&m|amazon|primark|about ?you|otto|kleidung|schuhe|zara|c&a/i],
['haushalt', /ikea|bauhaus|obi|hornbach|action|tedi|möbel|werkzeug/i],
['gesundheit', /apotheke|arzt|optiker|zahnarzt|medikament/i],
['tier', /fressnapf|tierarzt|futter|katze|hund|streu/i],
['geschenke', /geschenk|geburtstag|hochzeit/i],
];
const AUTO_FIX = [
['tabak', /tabak|zigarett|rauchen|vape|liquid/i],
['wohnen', /miete|nebenkosten|wohnung|hausgeld/i], ['energie', /strom|gas\b|vattenfall|e\.?on|energie|stadtwerke|fernwärme/i],
['handy', /handy|mobilfunk|telekom mobil|vodafone|o2|congstar|aldi talk|smartphone|sim/i], ['internet', /internet|dsl|glasfaser|kabel|wlan|1&1|tv/i],
['versicherung', /versicherung|haftpflicht|hausrat|kfz|huk|allianz|ergo|rechtsschutz|berufsunfähig|zahnzusatz/i],
['abo', /netflix|spotify|disney|prime|dazn|sky|youtube|apple|audible|wow|abo|icloud|google one|chatgpt/i],
['mobil_fix', /auto|leasing|deutschlandticket|hvv|bahncard|parkplatz|stellplatz/i], ['fitness', /fitness|gym|mcfit|urban sports|sportverein|verein/i],
['bank', /kontoführung|konto|bank|kreditkarte/i], ['kredit', /kredit|rate|finanzierung|klarna|darlehen/i], ['rundfunk', /rundfunk|gez|beitragsservice/i],
];
function autoCat(text, list, fallback) { for (const [k, re] of list) if (re.test(text)) return k; return fallback; }
const API = {
session: null,
load() { try { this.session = JSON.parse(LS.get('groschen.session') || 'null'); } catch { this.session = null; } },
save(s) { this.session = s; if (s) LS.set('groschen.session', JSON.stringify(s)); else LS.del('groschen.session'); },
headers(auth = true) {
const h = { apikey: SB_KEY, 'Content-Type': 'application/json' };
h.Authorization = 'Bearer ' + (auth && this.session ? this.session.access_token : SB_KEY);
return h;
},
async authCall(path, body) {
const res = await fetch(`${SB_URL}/auth/v1/${path}`, { method: 'POST', headers: this.headers(false), body: JSON.stringify(body) });
const data = await res.json().catch(() => ({}));
if (!res.ok) throw new Error(authError(data));
return data;
},
store(data) {
const exp = data.expires_at ? data.expires_at * 1000 : Date.now() + (data.expires_in || 3600) * 1000;
this.save({ access_token: data.access_token, refresh_token: data.refresh_token, expires: exp, user: data.user });
},
async signIn(email, password) { this.store(await this.authCall('token?grant_type=password', { email, password })); },
async refresh() {
if (!this.session?.refresh_token) throw new Error('Sitzung abgelaufen');
try { this.store(await this.authCall('token?grant_type=refresh_token', { refresh_token: this.session.refresh_token })); }
catch (e) { this.save(null); throw e; }
},
async ensure() { if (this.session && Date.now() > this.session.expires - 90_000) await this.refresh(); },
async req(path, { method = 'GET', body, prefer, retry = true } = {}) {
await this.ensure();
const h = this.headers(); if (prefer) h.Prefer = prefer;
let res;
try { res = await fetch(`${SB_URL}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); }
catch { throw new Error('Keine Verbindung. Prüfe dein Internet und versuche es noch einmal.'); }
if (res.status === 401 && retry && this.session) { await this.refresh(); return this.req(path, { method, body, prefer, retry: false }); }
const txt = await res.text();
const data = txt ? JSON.parse(txt) : null;
if (!res.ok) throw new Error(restError(data, res.status));
return data;
},
rest(table, q = '', opts) { return this.req(`/rest/v1/${table}${q ? '?' + q : ''}`, opts); },
rpc(fn, args = {}) { return this.req(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args }); },
async signOut() {
try { await this.rpc('log_logout'); } catch { /* ignoriert */ }
try { await fetch(`${SB_URL}/auth/v1/logout`, { method: 'POST', headers: this.headers() }); } catch { /* ignoriert */ }
this.save(null);
},
};
function authError(d) {
const m = (d.error_description || d.msg || d.message || d.error || '').toLowerCase();
if (m.includes('invalid login') || m.includes('invalid_grant') || m.includes('invalid credentials')) return 'Benutzername/E-Mail oder Passwort ist falsch.';
if (m.includes('email not confirmed')) return 'Deine E-Mail-Adresse ist noch nicht bestätigt.';
if (m.includes('rate') || m.includes('too many')) return 'Zu viele Versuche. Bitte warte einen Moment.';
return d.error_description || d.msg || d.message || 'Anmeldung fehlgeschlagen.';
}
function restError(d, status) {
const m = (d?.message || '').toLowerCase();
if (m.includes('row-level security') || status === 403) return 'Das geht gerade nicht: Dein Testzeitraum ist abgelaufen. Mit einem Abo kannst du weiter buchen.';
return d?.message || `Fehler ${status}`;
}
const S = {
view: 'uebersicht', profile: null, access: null, recurring: [], tx: [], budgets: [], admin: false,
txOffset: 0, txFilter: 'alle', txSearch: '', anOffset: 0, showDismissed: false, stats: null, statsFilter: 'alle', authTab: 'login',
planPick: 'jahr', loaded: false, bench: [], showEnded: false,
};
const VIEWS = [
['uebersicht', 'Übersicht', I.home], ['buchungen', 'Buchungen', I.list], ['fixkosten', 'Fixkosten', I.repeat],
['spartipps', 'Spartipps', I.bulb], ['analyse', 'Analyse', I.chart], ['konto', 'Konto', I.user],
];
async function loadAll() {
const uid = API.session.user.id;
const since = iso(new Date(new Date().getFullYear(), new Date().getMonth() - 13, 1));
const [p, a, rec, tx, bud, adm, bench] = await Promise.all([
API.rest('profiles', `user_id=eq.${uid}&select=*`),
API.rest('account_access', `user_id=eq.${uid}&select=*`),
API.rest('recurring', 'select=*&order=created_at.asc'),
API.rest('transactions', `select=*&tx_date=gte.${since}&order=tx_date.desc,created_at.desc&limit=5000`),
API.rest('budgets', 'select=*'),
API.rpc('is_app_admin').catch(() => false),
API.rest('spending_benchmarks', 'select=*').catch(() => []),
]);
S.profile = p[0] || { user_id: uid, payday: 1, savings_goal: 0, onboarded: false, dismissed_tips: [] };
S.access = a[0] || null;
S.recurring = rec.map(normRec); S.tx = tx.map(normTx); S.budgets = bud.map((b) => ({ ...b, amount: Number(b.amount) }));
S.admin = adm === true; S.bench = Array.isArray(bench) ? bench : [];
S.loaded = true;
}
const normTx = (t) => ({ ...t, amount: Number(t.amount), date: t.tx_date });
const normRec = (r) => ({ ...r, amount: Number(r.amount) });
function access() {
const a = S.access; const now = Date.now();
if (!a) return { k: 'none', ok: false, label: 'Kein Zugang', cls: 'bad' };
if (a.status === 'active' && a.plan_name === 'frei') return { k: 'frei', ok: true, label: 'Inhaber · kostenlos', cls: 'acc' };
if (a.status === 'active' && (!a.subscription_ends_at || new Date(a.subscription_ends_at) > now)) return { k: 'paid', ok: true, label: a.plan_name === 'aktion' ? 'Aktion · gratis' : a.plan_name === 'jahr' ? 'Jahresabo aktiv' : 'Monatsabo aktiv', cls: 'good' };
if (a.status === 'trialing' && new Date(a.trial_ends_at) > now) {
const ms = new Date(a.trial_ends_at) - now; const h = Math.ceil(ms / 3600000);
return { k: 'trial', ok: true, label: h > 24 ? `Test: noch ${Math.ceil(ms / 86400000)} Tage` : `Test: noch ${h} Std.`, cls: 'warn', ends: a.trial_ends_at };
}
return { k: 'expired', ok: false, label: a.status === 'canceled' ? 'Abo beendet' : 'Testphase beendet', cls: 'bad' };
}
function periodFor(date, payday) {
const y = date.getFullYear(), m = date.getMonth();
let start = date.getDate() >= payday ? new Date(y, m, payday) : new Date(y, m - 1, payday);
let end = new Date(start.getFullYear(), start.getMonth() + 1, payday - 1);
const cp = customPeriod(), dI = iso(date);
if (cp) {
if (dI >= cp.start && dI <= cp.end) return { start: parseD(cp.start), end: parseD(cp.end), custom: true };
if (dI < cp.start && iso(end) >= cp.start) { end = parseD(cp.start); end.setDate(end.getDate() - 1); }
else if (dI > cp.end && iso(start) <= cp.end) { start = parseD(cp.end); start.setDate(start.getDate() + 1); }
}
return { start, end, custom: false };
}
function customPeriod() { const p = S.profile || {}; return p.period_start && p.period_end && p.period_start <= p.period_end ? { start: String(p.period_start).slice(0, 10), end: String(p.period_end).slice(0, 10) } : null; }
function periodSheet() {
const cp = customPeriod(); const c = compute(0);
const s0 = cp ? cp.start : iso(c.start), e0 = cp ? cp.end : iso(c.end);
openSheet(`${sheetHead('Zeitraum festlegen')}
<form class="form" id="f-period" novalidate>
<p class="small muted">Normal rechnet Groschen vom Zahltag (${S.profile?.payday || 1}.) bis zum Tag davor im Folgemonat. Kommt dein Geld mal früher oder später, legst du hier selbst fest, von wann bis wann gerechnet wird. Danach geht es automatisch wieder mit deinem normalen Zahltag weiter.</p>
<div class="row">
<label class="field"><span>Von</span><input class="input" id="p-start" type="date" value="${s0}" required></label>
<label class="field"><span>Bis</span><input class="input" id="p-end" type="date" value="${e0}" required></label>
</div>
<p class="small muted" id="p-info"></p>
<p class="error" id="p-err"></p>
<button class="btn primary block" type="submit">Zeitraum speichern</button>
${cp ? '<button type="button" class="btn block" data-act="period-reset" style="margin-top:10px">Zurück zum normalen Zahltag</button>' : ''}
</form>`);
periodInfo();
}
function periodInfo() {
const a = $('#p-start')?.value, b = $('#p-end')?.value, el = $('#p-info'); if (!el) return;
if (!a || !b) { el.textContent = ''; return; }
const n = diffDays(parseD(a), parseD(b)) + 1;
el.textContent = n > 0 ? `${deDate(a)} bis ${deDate(b)}: ${n} ${n === 1 ? 'Tag' : 'Tage'}` : '';
}
function periodChanged() { try { if (typeof embeddedMessage === 'function') embeddedMessage({ type: 'groschen-saved' }); } catch { /* egal */ } }
document.addEventListener('input', (e) => { if (e.target.id === 'p-start' || e.target.id === 'p-end') periodInfo(); });
document.addEventListener('change', (e) => { if (e.target.id === 'p-start' || e.target.id === 'p-end') periodInfo(); });

const monthly = (r) => r.amount / (r.interval_months || 1);
function compute(offset = 0) {
const payday = S.profile?.payday || 1;
const t = parseD(todayISO());
let { start, end, custom } = periodFor(t, payday);
for (let k = 0; k > offset; k--) ({ start, end, custom } = periodFor(new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1), payday));
for (let k = 0; k < offset; k++) ({ start, end, custom } = periodFor(new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1), payday));
const sI = iso(start), eI = iso(end), tI = iso(t);
const totalDays = diffDays(start, end) + 1;
const txs = S.tx.filter((x) => x.date >= sI && x.date <= eI);
const recIn = sumRecurring(S.recurring, 'in', sI, eI);
const recOut = sumRecurring(S.recurring, 'out', sI, eI);
const recNotes = periodNotes(S.recurring, sI, eI);
const oneIn = sum(txs.filter((x) => x.kind === 'in').map((x) => x.amount));
const savings = Number(S.profile?.savings_goal) || 0;
const available = recIn + oneIn - recOut - savings;
const outs = txs.filter((x) => x.kind === 'out');
const spentTotal = sum(outs.map((x) => x.amount));
let spentBefore = 0, spentToday = 0, spentFuture = 0, daysLeft = 0, elapsed = 0;
const state = offset < 0 ? 'past' : offset > 0 ? 'future' : 'current';
if (state === 'current') {
spentBefore = sum(outs.filter((x) => x.date < tI).map((x) => x.amount));
spentToday = sum(outs.filter((x) => x.date === tI).map((x) => x.amount));
spentFuture = sum(outs.filter((x) => x.date > tI).map((x) => x.amount));
daysLeft = diffDays(t, end) + 1; elapsed = diffDays(start, t) + 1;
} else if (state === 'past') { spentBefore = spentTotal; elapsed = totalDays; }
else { spentFuture = spentTotal; daysLeft = totalDays; }
const restFromToday = available - spentBefore - spentFuture;
const daily = daysLeft > 0 ? restFromToday / daysLeft : 0;
const todayLeft = daily - spentToday;
const restNow = available - spentTotal;
const tomorrowDaily = daysLeft > 1 ? (restFromToday - spentToday) / (daysLeft - 1) : null;
const ideal = totalDays ? available / totalDays : 0;
const spentSoFar = spentBefore + spentToday;
const avg = elapsed > 0 ? spentSoFar / elapsed : 0;
const forecastEnd = available - spentFuture - avg * totalDays;
const perDay = Array.from({ length: totalDays }, (_, i) => sum(outs.filter((x) => x.date === iso(addDays(start, i))).map((x) => x.amount)));
const spentYesterday = state === 'current' && elapsed >= 2 ? perDay[elapsed - 2] : null;
const byCat = {};
outs.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
return { start, end, custom, sI, eI, totalDays, txs, outs, recIn, recOut, oneIn, savings, available, spentTotal, spentBefore, spentToday, spentFuture,
daysLeft, elapsed, restFromToday, daily, todayLeft, restNow, tomorrowDaily, ideal, avg, forecastEnd, perDay, byCat, state, offset, recNotes, spentYesterday };
}
const periodLabel = (c) => `${deDate(c.start)} – ${deDate(c.end)}`;
/* Budgetgeld-Check: Prognose im laufenden Zeitraum, Abschluss und Empfehlung pro Monat */
function budgetCheck() {
const cur = compute(0);
const firstTx = S.tx.reduce((m, x) => (x.kind === 'out' && (!m || x.date < m) ? x.date : m), null);
const done = [];
if (firstTx) for (let k = -1; k >= -12 && done.length < 6; k--) { const p = compute(k); if (p.eI < firstTx) break; done.push(p); }
const withData = done.filter((p) => p.spentTotal > 0);
const sumSpent = sum(withData.map((p) => p.spentTotal)), sumDays = sum(withData.map((p) => p.totalDays));
const curDays = Math.max(1, cur.elapsed || 1);
const curSpent = (cur.spentBefore || 0) + (cur.spentToday || 0);
const curAvg = curSpent / curDays;
const preliminary = !sumDays;
const basisAvg = preliminary ? curAvg : sumSpent / sumDays;
const useHistory = !preliminary && (cur.elapsed || 0) < 5;
const rate = useHistory ? basisAvg : curAvg;
const forecast = curSpent + (cur.spentFuture || 0) + rate * Math.max(0, (cur.daysLeft || 0) - 1);
const rec = basisAvg > 0 ? Math.ceil((basisAvg * MONTH_DAYS * 1.05) / 10) * 10 : null;
const planMonth = cur.totalDays ? (cur.available / cur.totalDays) * MONTH_DAYS : 0;
return { cur, done, withData, curDays, curSpent, curAvg, forecast, rate, useHistory, preliminary, basisAvg, rec, planMonth, last: done[0] || null };
}
function recText(b) {
if (!b.rec) return 'Sobald du Ausgaben buchst, rechnet Groschen hier aus, wie viel Budgetgeld du pro Monat wirklich brauchst.';
const how = b.preliminary
  ? `Vorläufig aus deinem laufenden Zeitraum (Ø ${eur(b.basisAvg)} pro Tag). Genau wird es, sobald der erste Zeitraum abgeschlossen ist.`
  : `Aus ${b.withData.length === 1 ? 'deinem letzten abgeschlossenen Zeitraum' : `deinen letzten ${b.withData.length} abgeschlossenen Zeiträumen`}: Ø ${eur(b.basisAvg)} pro Tag × 30,4 Tage + 5 % Puffer.`;
const d = Math.round(b.planMonth - b.rec);
const cmp = b.planMonth > 0 && Math.abs(d) >= 10 ? (d > 0 ? ` Das sind etwa ${eur0(d)} weniger, als dir gerade pro Monat zur Verfügung steht.` : ` Das sind etwa ${eur0(-d)} mehr, als dir gerade pro Monat zur Verfügung steht.`) : '';
return `${how}${cmp}`;
}
function budgetCheckCard(full) {
const b = budgetCheck(), c = b.cur;
const hasData = b.curSpent > 0 || b.withData.length > 0;
const diff = c.available - b.forecast, enough = diff >= 0;
const hist = full && b.withData.length ? `<h3 style="margin:18px 0 8px">Abgeschlossene Zeiträume</h3><div class="table-wrap"><table class="table"><thead><tr><th>Zeitraum</th><th class="num">Ausgegeben</th><th class="num">Tage</th><th class="num">Ø pro Tag</th></tr></thead><tbody>${b.withData.map((p) => `<tr><td>${deDate(p.start, false)}–${deDate(p.end, false)}</td><td class="num">${eur(p.spentTotal)}</td><td class="num">${p.totalDays}</td><td class="num">${eur(p.spentTotal / p.totalDays)}</td></tr>`).join('')}</tbody></table></div>` : '';
return `<section class="card budget-check"><div class="card-head"><h2>Budgetgeld-Check</h2>${hasData && c.available > 0 ? (enough ? '<span class="badge good">Reicht</span>' : '<span class="badge bad">Reicht nicht</span>') : ''}</div>
<div class="settings-row"><span>Eingeplant ${periodLabel(c)}</span><b>${eur(c.available)}</b></div>
<div class="settings-row"><span>Bisher ausgegeben (${b.curDays} ${b.curDays === 1 ? 'Tag' : 'Tage'})</span><b>${eur(b.curSpent)}</b></div>
<div class="settings-row"><span>Ø pro Tag bisher</span><b>${eur(b.curAvg)}</b></div>
<div class="settings-row"><span>Prognose bis ${deDate(c.end)}</span><b>${eur(b.forecast)}</b></div>
${hasData ? `<p>${enough ? `Geht es so weiter, bleiben am ${deDate(c.end)} etwa <b class="money">${eur(diff)}</b> übrig.` : `Geht es so weiter, fehlen am ${deDate(c.end)} etwa <b class="money">${eur(-diff)}</b>.`}${b.useHistory ? ` Weil der Zeitraum gerade erst begonnen hat, rechnet Groschen mit deinem bisherigen Schnitt von ${eur(b.rate)} pro Tag.` : ''}${c.daysLeft > 0 && c.daysLeft <= 3 ? ` Dein Zeitraum endet in ${c.daysLeft} ${c.daysLeft === 1 ? 'Tag' : 'Tagen'}.` : ''}</p>` : ''}
<div class="notice" style="margin-top:12px"><b>Empfohlenes Budgetgeld: ${b.rec ? eur0(b.rec) + ' pro Monat' : 'noch offen'}</b><br><span class="small">${recText(b)}</span></div>
${hist}
${full ? '' : '<button class="btn sm" data-act="go" data-view="analyse" style="margin-top:12px">Alle Zeiträume ansehen</button>'}
</section>`;
}
function periodCloseNotice() {
const b = budgetCheck(), p = b.last, c = b.cur;
if (!p || p.spentTotal <= 0 || diffDays(c.start, parseD(todayISO())) > 4) return '';
return `<section class="card budget-close"><div class="card-head"><h2>Abschluss ${periodLabel(p)}</h2><span class="badge ${p.spentTotal <= p.available ? 'good' : 'bad'}">${p.spentTotal <= p.available ? 'Hat gereicht' : 'Überzogen'}</span></div>
<div class="settings-row"><span>Ausgegeben in ${p.totalDays} Tagen</span><b>${eur(p.spentTotal)}</b></div>
<div class="settings-row"><span>Ø pro Tag</span><b>${eur(p.spentTotal / p.totalDays)}</b></div>
<div class="settings-row"><span>Eingeplant waren</span><b>${eur(p.available)}</b></div>
<div class="notice" style="margin-top:12px"><b>Empfohlenes Budgetgeld: ${b.rec ? eur0(b.rec) + ' pro Monat' : 'noch offen'}</b><br><span class="small">${recText(b)}</span></div>
</section>`;
}

/* Spartipps: regelbasiert, mit geschätzter Ersparnis pro Jahr */
function buildTips() {
const tips = [];
const ACT = S.recurring.filter((r) => recStatus(r, todayISO()) === 'aktiv' && !(r.is_one_time && r.valid_from));
const R = ACT.filter((r) => r.kind === 'out');
const inc = sum(ACT.filter((r) => r.kind === 'in').map(monthly));
const fix = sum(R.map(monthly));
const match = (r, cat, re) => r.category === cat || ((r.category === 'sonst_fix' || !CAT_MAP[r.category]) && re.test(r.name));
const add = (t) => tips.push(t);
R.filter((r) => match(r, 'handy', /handy|mobilfunk|vodafone|o2|telekom mobil|congstar/i)).forEach((r) => {
const m = monthly(r);
if (m > 15) add({ id: 'handy-' + r.id, title: `Dein Handytarif „${r.name}“ kostet ${eur(m)} im Monat`, save: (m - 10) * 12,
text: 'Discounter-Tarife in den Netzen von Telekom, Vodafone und o2 gibt es oft schon um 10 € im Monat – mit genug Datenvolumen für die meisten. Prüfe deine Mindestlaufzeit, kündige rechtzeitig und nimm deine Nummer mit. Viele Anbieter machen auch ein Rückhol-Angebot, wenn du kündigst.' });
});
R.filter((r) => match(r, 'internet', /internet|dsl|glasfaser|kabel/i)).forEach((r) => {
const m = monthly(r);
if (m > 35) add({ id: 'net-' + r.id, title: `Internet „${r.name}“: ${eur(m)} im Monat`, save: (m - 30) * 12,
text: 'Bestandskunden zahlen nach der Mindestlaufzeit oft deutlich mehr als Neukunden. Ruf beim Anbieter an und frag nach dem aktuellen Neukundenpreis, oder wechsle. Prüfe auch, ob eine kleinere Geschwindigkeit reicht.' });
});
R.filter((r) => match(r, 'energie', /strom|gas\b|energie|vattenfall|stadtwerke/i)).forEach((r) => {
const m = monthly(r);
add({ id: 'energie-' + r.id, title: `Strom/Gas „${r.name}“ vergleichen`, save: m * 12 * 0.12,
text: 'Wer noch in der Grundversorgung ist, zahlt meist mehr als in einem Sondertarif. Vergleiche einmal im Jahr bei Verivox oder Check24 und achte auf Preisgarantie und kurze Laufzeit. Die Ersparnis ist hier grob mit 12 % geschätzt.' });
});
const abos = R.filter((r) => match(r, 'abo', /netflix|spotify|disney|prime|dazn|sky|youtube|wow|audible|paramount|apple tv/i));
if (abos.length >= 2) {
const sorted = abos.map(monthly).sort((a, b) => b - a);
add({ id: 'abos', title: `Du hast ${abos.length} Streaming-Abos (${eur(sum(sorted))} im Monat)`, save: sum(sorted.slice(1)) * 12 * 0.5,
text: `Rotiere deine Abos: Behalte immer nur einen Dienst, schau die Serien dort durch und wechsle dann. Die meisten Abos kannst du monatlich kündigen. Deine Abos: ${abos.map((a) => a.name).join(', ')}.` });
}
R.filter((r) => match(r, 'fitness', /fitness|gym|mcfit/i)).forEach((r) => {
const m = monthly(r);
if (m > 25) add({ id: 'fit-' + r.id, title: `Fitness „${r.name}“: ${eur(m)} im Monat`, save: m * 12 * 0.3,
text: 'Zähl einen Monat lang, wie oft du wirklich hingehst. Unter 4 Besuchen im Monat lohnt sich oft ein günstigeres Studio, ein Vereinsangebot oder Training zu Hause. Frag auch nach einem Tarif ohne Extras.' });
});
R.filter((r) => match(r, 'bank', /kontoführung|konto/i)).forEach((r) => {
const m = monthly(r);
add({ id: 'bank-' + r.id, title: `Kontogebühren: ${eur(m)} im Monat`, save: m * 12,
text: 'Es gibt Girokonten ohne Kontoführungsgebühr, oft mit einer Bedingung wie einem monatlichen Geldeingang. Ein Wechsel ist mit dem gesetzlichen Kontowechselservice einfach: Die neue Bank zieht deine Daueraufträge und Lastschriften mit um.' });
});
R.filter((r) => r.category === 'versicherung' && /kfz|auto ?versicherung/i.test(r.name)).forEach((r) => {
const m = monthly(r);
add({ id: 'kfz-' + r.id, title: 'Kfz-Versicherung vor dem 30.11. vergleichen', save: m * 12 * 0.15,
text: 'Die meisten Kfz-Versicherungen laufen bis zum 31.12. Du kannst sie bis zum 30.11. kündigen und wechseln. Ein Vergleich lohnt sich fast jedes Jahr. Die Ersparnis ist grob mit 15 % geschätzt.' });
});
const vers = R.filter((r) => r.category === 'versicherung');
if (vers.length >= 4) add({ id: 'vers-check', title: `${vers.length} Versicherungen: Brauchst du alle?`, save: null,
text: 'Wichtig sind vor allem Privathaftpflicht und – je nach Lage – Berufsunfähigkeit. Handy-, Glas- oder Reisegepäckversicherungen sind oft verzichtbar. Prüfe auch auf doppelte Absicherung, z. B. über Kreditkarte oder Mitgliedschaften.' });
if (inc > 0 && fix / inc > 0.6) add({ id: 'fixquote', level: 'warn', title: `Deine Fixkosten fressen ${Math.round((fix / inc) * 100)} % deines Einkommens`, save: null,
text: 'Als grobe Richtwerte gelten: höchstens 50 % für Fixkosten, 30 % für den Alltag, 20 % zum Sparen. Fang bei den größten Posten an – jeder gekündigte Vertrag wirkt jeden Monat.' });
const sv = Number(S.profile?.savings_goal) || 0;
if (inc > 0 && sv < inc * 0.1) add({ id: 'sparen', title: 'Spar zuerst – nicht mit dem Rest', save: null,
text: `Richte am Zahltag einen Dauerauftrag auf ein Tagesgeldkonto ein. Schon 10 % deines Einkommens (${eur(inc * 0.1)}) machen einen Notgroschen von drei Monatsgehältern in wenigen Jahren möglich. Trag den Betrag unter Konto → Sparziel ein; Groschen rechnet ihn dann automatisch heraus.` });
const cur = compute(0), prev = compute(-1);
const eat = (cur.byCat.essen || 0), eatPrev = prev.byCat.essen || 0;
const eatMax = Math.max(eat, eatPrev);
if (eatMax > 120) add({ id: 'essen', title: `Restaurant & Lieferdienst: ${eur(eatMax)} in einem Zeitraum`, save: eatMax * 12 * 0.4,
text: 'Lieferdienste kosten durch Liefergebühr und Aufschläge oft das Doppelte. Selbst kochen, vorkochen für die Arbeit und Abholen statt Liefern sparen hier am meisten.' });
const small = prev.outs.filter((x) => x.amount < 5);
const smallCur = cur.outs.filter((x) => x.amount < 5);
const sm = small.length >= smallCur.length ? small : smallCur;
if (sm.length >= 10) add({ id: 'klein', title: `${sm.length} Kleinstkäufe unter 5 € – zusammen ${eur(sum(sm.map((x) => x.amount)))}`, save: sum(sm.map((x) => x.amount)) * 12 * 0.5,
text: 'Kaffee to go, Snacks und Getränke unterwegs summieren sich. Eine Thermoskanne und ein Vorrat für die Schicht halbieren diese Ausgaben schnell.' });
const mob = (cur.byCat.mobil || 0);
if (mob > 90 && !R.some((r) => /deutschlandticket/i.test(r.name))) add({ id: 'dticket', title: `Fahrten: ${eur(mob)} in diesem Zeitraum`, save: null,
text: 'Fährst du viel mit Bus und Bahn, prüfe das Deutschlandticket. Es gilt bundesweit im Nahverkehr und ist monatlich kündbar. Viele Arbeitgeber zahlen es als Jobticket mit.' });
S.budgets.forEach((b) => {
const s = cur.byCat[b.category] || 0;
if (s > b.amount) add({ id: 'budget-' + b.category + '-' + cur.sI, level: 'warn', title: `Budget „${catName(b.category)}“ überschritten`, save: null,
text: `Du hast ${eur(s)} ausgegeben, geplant waren ${eur(b.amount)}. Das sind ${eur(s - b.amount)} mehr.` });
});
const soon = R.filter((r) => r.cancel_by && diffDays(parseD(todayISO()), parseD(r.cancel_by)) >= 0 && diffDays(parseD(todayISO()), parseD(r.cancel_by)) <= 60);
soon.forEach((r) => add({ id: 'frist-' + r.id + r.cancel_by, level: 'warn', title: `Kündigungsfrist: „${r.name}“ bis ${deDate(r.cancel_by)}`, save: null,
text: `Noch ${diffDays(parseD(todayISO()), parseD(r.cancel_by))} Tage. Entscheide jetzt, ob du den Vertrag behalten, kündigen oder neu verhandeln willst.` }));
const ref = checkRef(); const rid = ref.c.sI;
const mc = monthlyCheck({ byCat: ref.c.byCat, totalDays: ref.days, bench: S.bench, household: Number(S.profile?.household_size) || 1, f: eur, names: CAT_NAMES });
mc.forEach((t) => add({ ...t, id: `m:${rid}:${t.cat}`, monthly: true }));
const tobFix = sum(ACT.filter((r) => r.kind === 'out' && (r.category === 'tabak' || /rauch|tabak|zigarett/i.test(r.name))).map(monthly));
const tt = tobaccoTip({ monthlyTx: monthlyAmount(ref.c.byCat.tabak || 0, ref.days), monthlyFix: tobFix, prevMonthlyTx: monthlyAmount(ref.prev.byCat.tabak || 0, ref.prev.totalDays), f: eur });
if (tt) add({ ...tt, id: `m:${rid}:tabak`, monthly: true });
if (ref.c === ref.prev) trendTips({ byCat: ref.prev.byCat, prevByCat: compute(-2).byCat, names: CAT_NAMES, f: eur, skip: ['tabak', ...mc.map((t) => t.cat)] }).forEach((t) => add({ ...t, id: `m:${rid}:t:${t.cat}`, monthly: true }));
tips.forEach((t) => { if (t.save != null) t.save = Math.max(0, Math.round(t.save)); });
tips.sort((a, b) => (b.level === 'warn') - (a.level === 'warn') || (b.save || 0) - (a.save || 0));
return tips;
}
function detectRecurring() {
const names = S.recurring.map((r) => r.name.toLowerCase());
const groups = {};
S.tx.filter((x) => x.kind === 'out' && x.note).forEach((x) => {
const key = x.note.toLowerCase().replace(/[0-9.,€]/g, '').replace(/\s+/g, ' ').trim();
if (key.length < 3) return;
(groups[key] ||= { key, label: x.note, months: new Set(), amounts: [], cat: x.category }).months.add(x.date.slice(0, 7));
groups[key].amounts.push(x.amount);
});
return Object.values(groups).filter((g) => g.months.size >= 2 && !names.some((n) => n.includes(g.key) || g.key.includes(n)))
.filter((g) => { const a = g.amounts; const avg = sum(a) / a.length; return a.every((v) => Math.abs(v - avg) <= Math.max(2, avg * 0.15)); })
.map((g) => ({ label: g.label, months: g.months.size, avg: sum(g.amounts) / g.amounts.length }))
.slice(0, 5);
}
const root = () => $('#root');
function exampleReceipt() {
return `<div class="receipt" aria-label="Beispielrechnung">
<h3>Tagesbudget</h3><div class="r-sub">Beispiel · Zeitraum 01.09. – 30.09.</div>
<div class="r-line"><span>Nettogehalt</span><span>+ 2.450,00 €</span></div>
<div class="r-line"><span>Fixkosten</span><span>− 1.312,40 €</span></div>
<div class="r-line"><span>Sparziel</span><span>− 150,00 €</span></div>
<div class="r-sep"></div>
<div class="r-line r-total"><span>Frei verfügbar</span><span>987,60 €</span></div>
<div class="r-line"><span>Schon ausgegeben</span><span>− 806,40 €</span></div>
<div class="r-line"><span>÷ noch 6 Tage</span><span>181,20 €</span></div>
<div class="r-sep"></div>
<div class="r-line r-total big"><span>Heute noch drin</span><span>30,20 €</span></div>
</div>`;
}
function renderAuth(msg = '') {
const reg = S.authTab === 'register';
root().innerHTML = `
<div class="auth">
<section class="auth-side">
<div class="brand"><span class="brand-mark">G</span> Groschen</div>
<h1>Jeden Tag wissen, was noch drin ist.</h1>
<p class="lead">Groschen rechnet aus Einkommen, Fixkosten und deinen Ausgaben jeden Tag neu aus, wie viel du heute noch ausgeben kannst – nachvollziehbar Posten für Posten.</p>
<ul class="auth-points">
<li>${I.check}<span>Tagesbudget für deinen Zeitraum von Zahltag zu Zahltag</span></li>
<li>${I.check}<span>Haushaltsbuch mit Kategorien, Budgets und Monatsvergleich</span></li>
<li>${I.check}<span>Spartipps zu Handy, Internet, Strom, Abos und Verträgen</span></li>
<li>${I.check}<span>${TRIAL_DAYS} Tage kostenlos testen, danach <span data-aktion-preis="monat" data-aktion-ohne-tag>${eur(PRICE_MONTH)}</span> im Monat oder <span data-aktion-preis="jahr" data-aktion-ohne-tag>${eur(PRICE_YEAR)}</span> im Jahr</span></li>
</ul>
${exampleReceipt()}
</section>
<section class="auth-main">
<div class="auth-card">
<div class="seg" role="tablist">
<button type="button" class="${reg ? '' : 'on'}" data-act="auth-tab" data-tab="login">Anmelden</button>
<button type="button" class="${reg ? 'on' : ''}" data-act="auth-tab" data-tab="register">Registrieren</button>
</div>
${reg ? `
<form class="form" id="f-register" novalidate>
<h2>Konto erstellen</h2>
<label class="field"><span>Dein Name</span><input class="input" id="r-name" name="name" autocomplete="name" required maxlength="80"></label>
<label class="field"><span>E-Mail</span><input class="input" id="r-email" name="email" type="email" autocomplete="email" required></label>
<label class="field"><span>Passwort (mind. 8 Zeichen, mit Zahl)</span><input class="input" id="r-pw" name="pw" type="password" autocomplete="new-password" required minlength="8"></label>
<label class="field"><span>Passwort wiederholen</span><input class="input" id="r-pw2" name="pw2" type="password" autocomplete="new-password" required></label>
<label class="check"><input type="checkbox" id="r-ok" name="ok" required><span>Ich bin einverstanden, dass meine Daten zur Nutzung von Groschen gespeichert werden. Die Testphase endet automatisch nach ${TRIAL_DAYS} Tagen und kostet nichts.</span></label>
<p class="error" id="auth-err">${esc(msg)}</p>
<button class="btn primary block" type="submit">${TRIAL_DAYS} Tage kostenlos testen</button>
</form>` : `
<form class="form" id="f-login" novalidate>
<h2>Willkommen zurück</h2>
<label class="field"><span>E-Mail oder Benutzername</span><input class="input" id="l-id" name="ident" autocomplete="username" required></label>
<label class="field"><span>Passwort</span><input class="input" id="l-pw" name="pw" type="password" autocomplete="current-password" required></label>
<p class="error" id="auth-err">${esc(msg)}</p>
<button class="btn primary block" type="submit">Anmelden</button>
<button class="btn ghost sm" type="button" data-act="forgot">Passwort vergessen?</button>
</form>`}
<p class="price-note">Keine Kosten in der Testphase. Kein Abo wird automatisch abgeschlossen.</p>
</div>
</section>
</div>`;
}
function navItems() { const v = [...VIEWS]; if (S.admin) v.push(['statistik', 'Statistik', I.stats]); return v; }
function renderApp() {
const acc = access();
const blocked = !acc.ok && !['konto'].includes(S.view);
const nav = navItems();
root().innerHTML = `
<div class="shell">
<aside class="side">
<div class="brand"><span class="brand-mark">G</span> Groschen</div>
${nav.map(([k, n, ic]) => `<button class="nav-btn ${S.view === k ? 'on' : ''}" data-act="go" data-view="${k}">${ic}<span>${n}</span></button>`).join('')}
<div class="side-foot"><span class="badge ${acc.cls}">${esc(acc.label)}</span></div>
</aside>
<main class="main" id="main">${blocked ? viewPaywall() : renderView()}</main>
<nav class="bottom-nav" aria-label="Hauptnavigation">
${VIEWS.map(([k, n, ic]) => `<button class="nav-btn ${S.view === k || (k === 'konto' && S.view === 'statistik') ? 'on' : ''}" data-act="go" data-view="${k}">${ic}<span>${n}</span></button>`).join('')}
</nav>
${acc.ok && !['konto', 'statistik'].includes(S.view) ? `<button class="fab" data-act="new-tx">${I.plus}<span>Ausgabe</span></button>` : ''}
</div>`;
bindCharts();
}
function renderView() {
switch (S.view) {
case 'buchungen': return viewBuchungen();
case 'fixkosten': return viewFixkosten();
case 'spartipps': return viewTipps();
case 'analyse': return viewAnalyse();
case 'konto': return viewKonto();
case 'statistik': return S.admin ? viewStatistik() : viewUebersicht();
default: return viewUebersicht();
}
}
function topbar(title, extra = '') {
const acc = access();
return `<div class="topbar"><h1>${title}</h1><div class="topbar-right">${extra}<span class="badge ${acc.cls}">${esc(acc.label)}</span></div></div>`;
}
const firstName = () => (S.profile?.display_name || '').split(' ')[0] || '';
function viewUebersicht() {
const c = compute(0);
const noIncome = c.recIn === 0 && c.oneIn === 0;
const over = c.restFromToday < 0;
const todayOver = !over && c.todayLeft < 0;
const pct = c.daily > 0 ? Math.min(100, Math.max(0, (c.spentToday / c.daily) * 100)) : 100;
const hello = firstName() ? `Hallo ${esc(firstName())}` : 'Übersicht';
const tips = visibleTips().filter((t) => !String(t.id).startsWith('frist-')).slice(0, 2);
const deadlines = S.recurring.filter((r) => r.cancel_by && recStatus(r, todayISO()) !== 'beendet' && parseD(r.cancel_by) >= parseD(todayISO())).sort((a, b) => a.cancel_by.localeCompare(b.cancel_by)).slice(0, 3);
const last = S.tx.slice(0, 6);
return `${topbar(hello)}
${noIncome ? `<div class="notice warn" style="margin-bottom:16px">Trag zuerst dein Einkommen ein, damit Groschen dein Tagesbudget berechnen kann. <button class="btn sm primary" data-act="new-rec" data-kind="in" style="margin-left:8px">Einkommen eintragen</button></div>` : ''}
<div class="home-grid">
<div class="stack">
<section class="hero ${over || todayOver ? 'over' : ''}" aria-label="Heute noch verfügbar">
<span class="period-chip">${I.clock.replace('<svg', '<svg width="16" height="16"')} ${periodLabel(c)}${c.custom ? ' (eigener Zeitraum)' : ''} · noch ${c.daysLeft} ${c.daysLeft === 1 ? 'Tag' : 'Tage'} inkl. heute</span>
<button type="button" class="period-edit" data-act="edit-period">Zeitraum ändern</button>
<div>
<div class="label">${over ? 'Budget im Zeitraum überschritten um' : todayOver ? 'Heute über dem Tagesbudget' : 'Heute noch verfügbar'}</div>
<div class="hero-amount">${over ? eur(-c.restFromToday + c.spentToday) : eur(c.todayLeft)}</div>
</div>
<div class="meter" aria-hidden="true"><i style="width:${pct}%"></i></div>
<div class="hero-sub">
<span>Tagesbudget heute <b>${eur(Math.max(0, c.daily))}</b></span>
<span>Heute ausgegeben <b>${eur(c.spentToday)}</b></span>
</div>
</section>
${adviceCard(c)}
${whatIfCard(c)}
<section class="card">
<div class="card-head"><h2>Verlauf im Zeitraum</h2><span class="small muted">Rest nach jedem Tag</span></div>
<div class="kpis">
<div class="kpi"><span class="label">Frei verfügbar</span><b>${eur(c.available)}</b></div>
<div class="kpi"><span class="label">Ausgegeben</span><b>${eur(c.spentTotal)}</b></div>
<div class="kpi ${c.restNow < 0 ? 'bad' : 'good'}"><span class="label">Rest</span><b>${eur(c.restNow)}</b></div>
</div>
${burnChart(c)}
</section>
<section class="card">
<div class="card-head"><h2>Letzte Buchungen</h2><button class="btn sm" data-act="go" data-view="buchungen">Alle anzeigen</button></div>
${last.length ? `<div class="list">${last.map(txRow).join('')}</div>` : `<div class="empty"><p>Noch keine Buchungen. Tipp unten rechts auf „Ausgabe“.</p></div>`}
</section>
</div>
<div class="stack">
${periodCloseNotice()}
<section class="card"><div class="card-head"><h2>So wird gerechnet</h2></div>${receipt(c)}</section>
${budgetCheckCard(false)}
${deadlines.length ? `<section class="card"><div class="card-head"><h2>Kündigungsfristen</h2></div><div class="list">${deadlines.map((r) => `<button class="item" data-act="edit-rec" data-id="${r.id}">${catIcon(r.category)}<span class="t"><b>${esc(r.name)}</b><small>kündbar bis ${deDate(r.cancel_by)}</small></span><span class="v">${diffDays(parseD(todayISO()), parseD(r.cancel_by))} Tage</span></button>`).join('')}</div></section>` : ''}
<section class="card">
<div class="card-head"><h2>Spartipps für dich</h2><button class="btn sm" data-act="go" data-view="spartipps">Alle</button></div>
${tips.length ? tips.map((t) => tipCard(t, true)).join('') : '<p class="muted">Trag deine Fixkosten ein, dann findet Groschen Sparpotenzial bei Handy, Internet, Strom und Abos.</p>'}
</section>
</div>
</div>`;
}
function adviceCard(c) {
const a = dayAdvice(c, { eur, deDate, names: CAT_NAMES });
if (!a) return '';
const badge = { ok: ['good', 'Im Plan'], saved: ['good', 'Im Plan'], tight: ['warn', 'Knapp'], over: ['bad', 'Im Minus'], todayOver: ['bad', 'Über dem Limit'] }[a.tone];
return `<section class="card" aria-label="Empfehlung für heute" data-advice="${a.tone}">
<div class="card-head"><h2>Was jetzt am besten ist</h2><span class="badge ${badge[0]}">${badge[1]}</span></div>
<p><b>${esc(a.title)}</b></p>
<ul style="margin:8px 0 0 18px;display:grid;gap:6px">${a.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
</section>`;
}
const WI_HINT = 'Gib einen Betrag ein. Dann siehst du, wie viel heute und morgen noch drin ist.';
function whatIfCard(c) {
if (c.state !== 'current') return '';
return `<section class="card"><div class="card-head"><h2>Was wäre wenn?</h2></div>
<label class="field"><span>Ich gebe heute noch aus (in €)</span><input class="input" id="wi-amount" inputmode="decimal" placeholder="z. B. 25,00" autocomplete="off"></label>
<p class="small muted" id="wi-out" aria-live="polite" style="margin-top:8px">${WI_HINT}</p>
</section>`;
}
function updateWhatIf(val) {
const out = $('#wi-out'); if (!out) return;
const amt = parseAmount(val);
if (!(amt > 0)) { out.textContent = WI_HINT; return; }
const w = whatIf(compute(0), amt);
const today = w.todayLeft >= 0 ? `Heute bleiben dir noch <b>${eur(w.todayLeft)}</b>.` : `Damit liegst du heute <b>${eur(-w.todayLeft)}</b> über dem Tagesbudget.`;
const tom = w.tomorrow == null ? 'Heute ist der letzte Tag vor deinem Zahltag.' : `Ab morgen hast du <b>${eur(Math.max(0, w.tomorrow))}</b> pro Tag${w.change != null && Math.abs(w.change) >= 0.005 ? ` (${w.change < 0 ? '−' : '+'}${eur(Math.abs(w.change))} gegenüber ohne diese Ausgabe)` : ''}.`;
out.innerHTML = `${today} ${tom}`;
}
function syncRecEnd() {
const from = $('#rec-from')?.value, count = $('#rec-count')?.value, to = $('#rec-to');
if (!to || !from || !String(count || '').trim()) return;
const end = endDateFromPayments(from, count, Number($('#rec-int')?.value) || 1);
if (end) to.value = end;
}
function checkRef() {
const cur = compute(0), prev = compute(-1);
const usePrev = prev.outs.length >= 3;
return { c: usePrev ? prev : cur, cur, prev, days: usePrev ? prev.totalDays : Math.max(1, cur.elapsed), label: usePrev ? 'letzter Zeitraum' : 'laufender Zeitraum, hochgerechnet' };
}
function focusCard(tips) {
const f = pickFocus(tips); if (!f) return '';
const cur = compute(0);
if (f.cat === 'tabak') return `<section class="card"><div class="card-head"><h2>Dein Ziel für diesen Zeitraum</h2></div><p>Rauch etwas weniger: Wenn du bei höchstens <b>${eur0(f.target)}</b> im Monat landest, sparst du etwa ${eur0(f.save)} im Jahr.</p></section>`;
const periodTarget = (f.target * cur.totalDays) / MONTH_DAYS;
const spent = cur.byCat[f.cat] || 0;
const pc = periodTarget > 0 ? (spent / periodTarget) * 100 : 0;
return `<section class="card"><div class="card-head"><h2>Dein Ziel für diesen Zeitraum</h2></div>
<p>Halte <b>${esc(catName(f.cat))}</b> bei höchstens <b>${eur0(periodTarget)}</b>. Das spart dir etwa ${eur0(f.save)} im Jahr.</p>
<div class="bars"><div class="bar-row"><span class="name">${esc(catName(f.cat))}</span><span class="track"><i class="${pc > 100 ? 'over' : pc > 85 ? 'near' : ''}" style="width:${Math.min(100, pc)}%"></i></span><span class="val">${eur(spent)} / ${eur0(periodTarget)}</span></div></div>
</section>`;
}
function receipt(c) {
const L = (a, b, cls = '') => `<div class="r-line ${cls}"><span>${a}</span><span>${b}</span></div>`;
const sep = '<div class="r-sep"></div>';
let h = `<div class="receipt"><h3>Tagesbudget ${deDate(todayISO())}</h3><div class="r-sub">Zeitraum ${periodLabel(c)} (${c.totalDays} Tage)</div>`;
h += L('Regelmäßige Einnahmen', '+ ' + eur(c.recIn));
if (c.oneIn) h += L('Einmalige Einnahmen', '+ ' + eur(c.oneIn));
h += L('Fixkosten (Monatsanteil)', '− ' + eur(c.recOut));
c.recNotes.forEach((n) => { h += `<div class="r-foot" style="margin:0">${n.kind === 'in' ? 'Einnahme ' : ''}„${esc(n.name)}“: ${n.type === 'einmalig' ? 'einmalig am ' + deDate(n.date) : 'nur ' + n.days + ' von ' + n.totalDays + ' Tagen'}</div>`; });
if (c.savings) h += L('Sparziel', '− ' + eur(c.savings));
h += sep + L('Frei verfügbar im Zeitraum', eur(c.available), 'r-total');
h += L('Ausgegeben bis gestern', '− ' + eur(c.spentBefore));
if (c.spentFuture) h += L('Schon gebucht für später', '− ' + eur(c.spentFuture));
h += sep + L('Rest ab heute', eur(c.restFromToday), 'r-total');
h += L(`÷ verbleibende Tage (${deDate(todayISO(), false)}–${deDate(c.end, false)})`, String(c.daysLeft));
h += L('= Tagesbudget heute', eur(c.daily), 'r-total');
h += L('Heute ausgegeben', '− ' + eur(c.spentToday));
h += sep + L('Heute noch verfügbar', eur(c.todayLeft), 'r-total big');
h += `<div class="r-foot">Nicht monatliche Posten (z. B. jährliche Versicherung) werden anteilig pro Monat eingerechnet. Raten und Verträge zählen nur in ihrer Laufzeit.</div></div>`;
return h;
}
function niceTicks(min, max, count = 4) {
if (max === min) { max = min + 1; }
const span = max - min; const raw = span / count; const mag = 10 ** Math.floor(Math.log10(raw));
const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || 10 * mag;
const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step; const t = [];
for (let v = lo; v <= hi + step / 2; v += step) t.push(Math.round(v * 100) / 100);
return t;
}
function burnChart(c) {
const n = c.totalDays; if (n < 2) return '';
const W = 640, H = 230, l = 62, r = 14, tp = 12, b = 28;
const shown = c.state === 'current' ? c.elapsed : c.state === 'past' ? n : 0;
const rem = []; let cum = 0;
for (let i = 0; i < n; i++) { cum += c.perDay[i]; rem.push(c.available - cum); }
const ideal = Array.from({ length: n }, (_, i) => c.available - c.ideal * (i + 1));
const vals = [...rem.slice(0, shown), ...ideal, 0, c.available];
const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
const y0 = ticks[0], y1 = ticks[ticks.length - 1];
const X = (i) => l + (i / (n - 1)) * (W - l - r);
const Y = (v) => tp + (1 - (v - y0) / (y1 - y0 || 1)) * (H - tp - b);
let s = `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlauf des Restbudgets">`;
s += '<g class="axis">' + ticks.map((t) => `<line class="grid-l" x1="${l}" x2="${W - r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${l - 8}" y="${Y(t) + 4}" text-anchor="end">${eur0(t)}</text>`).join('');
const lbl = [0, Math.floor((n - 1) / 2), n - 1];
s += lbl.map((i) => `<text x="${X(i)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${deDate(addDays(c.start, i), false)}</text>`).join('') + '</g>';
if (y0 < 0) s += `<line class="zero" x1="${l}" x2="${W - r}" y1="${Y(0)}" y2="${Y(0)}" stroke-dasharray="2 3"/>`;
s += `<path d="${ideal.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('')}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
if (shown > 0) {
const pts = rem.slice(0, shown).map((v, i) => [X(i), Y(v)]);
const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
if (pts.length > 1) s += `<path d="${line}L${pts[pts.length - 1][0].toFixed(1)},${Y(Math.max(0, y0)).toFixed(1)}L${pts[0][0].toFixed(1)},${Y(Math.max(0, y0)).toFixed(1)}Z" fill="var(--accent)" opacity=".1"/>`;
s += `<path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
const e = pts[pts.length - 1];
s += `<circle cx="${e[0]}" cy="${e[1]}" r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`;
}
const colW = (W - l - r) / (n - 1);
for (let i = 0; i < n; i++) {
const d = addDays(c.start, i); const done = i < shown;
const tip = `${WD[d.getDay()]} ${deDate(d)}|${done ? 'Ausgegeben ' + eur(c.perDay[i]) + '|Rest ' + eur(rem[i]) : 'Plan: Rest ' + eur(ideal[i])}`;
s += `<rect x="${X(i) - colW / 2}" y="${tp}" width="${colW}" height="${H - tp - b}" fill="transparent" data-tip="${esc(tip)}"/>`;
}
s += '</svg><div class="tip-box" hidden></div></div>';
s += `<div class="legend"><span><i style="background:var(--accent)"></i>Tatsächlicher Rest</span><span><i class="dash"></i>Gleichmäßig verteilt</span></div>`;
return s;
}
function barChart(rows, key, label) {
const W = 640, H = 170, l = 30, r = 8, tp = 10, b = 24; const n = rows.length; if (!n) return '';
const max = Math.max(1, ...rows.map((x) => x[key])); const ticks = niceTicks(0, max, 3).filter((t) => Number.isInteger(t));
const top = ticks[ticks.length - 1] || 1;
const bw = (W - l - r) / n; const Y = (v) => tp + (1 - v / top) * (H - tp - b);
let s = `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}"><g class="axis">`;
s += ticks.map((t) => `<line class="grid-l" x1="${l}" x2="${W - r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${l - 6}" y="${Y(t) + 4}" text-anchor="end">${t}</text>`).join('');
rows.forEach((x, i) => { if (i % Math.ceil(n / 6) === 0 || i === n - 1) s += `<text x="${l + bw * i + bw / 2}" y="${H - 6}" text-anchor="middle">${deDate(x.date, false)}</text>`; });
s += '</g>';
rows.forEach((x, i) => {
const v = x[key]; const h = Y(0) - Y(v); const w = Math.max(2, bw - 3);
if (v > 0) s += `<path d="M${l + bw * i + 1.5},${Y(0)}v${-Math.max(0, h - 3)}q0,-3 3,-3h${w - 6}q3,0 3,3v${Math.max(0, h - 3)}z" fill="var(--accent)"/>`;
s += `<rect x="${l + bw * i}" y="${tp}" width="${bw}" height="${H - tp - b}" fill="transparent" data-tip="${esc(`${deDate(x.date)}|${label}: ${v}`)}"/>`;
});
return s + '</svg><div class="tip-box" hidden></div></div>';
}
function bindCharts() {
$$('.chart-box').forEach((box) => {
const tipEl = $('.tip-box', box);
box.addEventListener('pointermove', (e) => {
const t = e.target.closest('[data-tip]'); if (!t) { tipEl.hidden = true; return; }
const [a, ...rest] = t.dataset.tip.split('|');
tipEl.innerHTML = `<b>${esc(a)}</b><br>${rest.map(esc).join('<br>')}`;
const bb = box.getBoundingClientRect();
let x = e.clientX - bb.left; x = Math.min(Math.max(x, 80), bb.width - 80);
tipEl.style.left = x + 'px'; tipEl.style.top = (e.clientY - bb.top) + 'px'; tipEl.hidden = false;
});
box.addEventListener('pointerleave', () => { tipEl.hidden = true; });
});
}
function txRow(t) {
const d = parseD(t.date);
return `<button class="item" data-act="edit-tx" data-id="${t.id}">${catIcon(t.category)}<span class="t"><b>${esc(t.note || catName(t.category))}</b><small>${esc(catName(t.category))} · ${WD[d.getDay()]} ${deDate(d)}</small></span><span class="v ${t.kind === 'in' ? 'in' : ''}">${t.kind === 'in' ? '+ ' : '− '}${eur(t.amount)}</span></button>`;
}
function periodNav(act, offset, c) {
return `<div class="pill-nav"><button class="icon-btn" data-act="${act}" data-d="-1" aria-label="Voriger Zeitraum" ${offset <= -12 ? 'disabled' : ''}>${I.left}</button>
<span class="badge">${periodLabel(c)}</span>
<button class="icon-btn" data-act="${act}" data-d="1" aria-label="Nächster Zeitraum" ${offset >= 0 ? 'disabled' : ''}>${I.right}</button></div>`;
}
function viewBuchungen() {
const c = compute(S.txOffset);
let list = c.txs.slice();
if (S.txFilter === 'aus') list = list.filter((x) => x.kind === 'out');
if (S.txFilter === 'ein') list = list.filter((x) => x.kind === 'in');
const q = S.txSearch.trim().toLowerCase();
if (q) list = list.filter((x) => (x.note || '').toLowerCase().includes(q) || catName(x.category).toLowerCase().includes(q) || String(x.amount).includes(q.replace(',', '.')));
list.sort((a, b) => b.date.localeCompare(a.date) || String(b.created_at).localeCompare(String(a.created_at)));
const days = {}; list.forEach((x) => (days[x.date] ||= []).push(x));
return `${topbar('Buchungen')}
<section class="card">
<div class="card-head">${periodNav('tx-period', S.txOffset, c)}
<div class="row" style="flex:1 1 320px;justify-content:flex-end">
<input class="input search" id="tx-search" type="search" placeholder="Suchen …" value="${esc(S.txSearch)}" aria-label="Buchungen durchsuchen">
<select class="select" id="tx-filter" style="max-width:170px" aria-label="Filter">
<option value="alle" ${S.txFilter === 'alle' ? 'selected' : ''}>Alle</option>
<option value="aus" ${S.txFilter === 'aus' ? 'selected' : ''}>Nur Ausgaben</option>
<option value="ein" ${S.txFilter === 'ein' ? 'selected' : ''}>Nur Einnahmen</option>
</select>
</div>
</div>
<div class="kpis">
<div class="kpi"><span class="label">Ausgaben</span><b>${eur(c.spentTotal)}</b></div>
<div class="kpi"><span class="label">Einmalige Einnahmen</span><b>${eur(c.oneIn)}</b></div>
<div class="kpi"><span class="label">Buchungen</span><b>${c.txs.length}</b></div>
</div>
${list.length ? Object.entries(days).map(([d, xs]) => `<div class="day-head"><span>${WD[parseD(d).getDay()]}, ${deDate(d)}</span><span class="num">${eur(sum(xs.filter((x) => x.kind === 'out').map((x) => x.amount)))}</span></div><div class="list">${xs.map(txRow).join('')}</div>`).join('') :
`<div class="empty"><p>${q ? 'Keine Treffer.' : 'In diesem Zeitraum gibt es keine Buchungen. Tipp unten rechts auf „Ausgabe“.'}</p></div>`}
<p class="small muted">Groschen lädt Buchungen der letzten 13 Monate.</p>
</section>`;
}
function recRow(r) {
const today = todayISO(); const st = recStatus(r, today); const once = !!(r.is_one_time && r.valid_from);
const iv = once ? 'einmalig' : { 1: 'monatlich', 3: 'vierteljährlich', 6: 'halbjährlich', 12: 'jährlich' }[r.interval_months];
const rem = remainingInfo(r, today);
let when = '';
if (once) when = ` · am ${deDate(r.valid_from)}`;
else if (st === 'geplant') when = ` · startet am ${deDate(r.valid_from)}${r.valid_to ? ' bis ' + deDate(r.valid_to) : ''}`;
else if (st === 'beendet') when = ` · beendet am ${deDate(r.valid_to)}`;
else if (r.valid_to) when = ` · läuft bis ${deDate(r.valid_to)}${rem ? ` · noch ca. ${rem.payments} ${rem.payments === 1 ? 'Zahlung' : 'Zahlungen'}` : ''}`;
else if (r.valid_from) when = ` · seit ${deDate(r.valid_from)}`;
return `<button class="item" data-act="edit-rec" data-id="${r.id}"${st === 'beendet' ? ' style="opacity:.6"' : ''}>${catIcon(r.category)}<span class="t"><b>${esc(r.name)}</b><small>${esc(catName(r.category))} · ${iv}${r.cancel_by && st !== 'beendet' ? ' · kündbar bis ' + deDate(r.cancel_by) : ''}${when}</small></span><span class="v ${r.kind === 'in' ? 'in' : ''}">${eur(r.amount)}${!once && r.interval_months > 1 ? `<small>${eur(monthly(r))} / Monat</small>` : ''}</span></button>`;
}
function changeText(e) {
const n = esc(e.name);
if (e.type === 'einmalig') return `Am ${deDate(e.date)}: einmalig ${e.once < 0 ? eur(-e.once) + ' Ausgabe' : eur(e.once) + ' Einnahme'} („${n}“)`;
const what = e.kind === 'out'
? (e.type === 'ende' ? `${eur(e.delta)} mehr frei im Monat, weil „${n}“ endet` : `${eur(-e.delta)} weniger frei im Monat, weil „${n}“ beginnt`)
: (e.type === 'start' ? `${eur(e.delta)} mehr Einkommen im Monat durch „${n}“` : `${eur(-e.delta)} weniger Einkommen im Monat, weil „${n}“ endet`);
return `Ab ${deDate(e.date)}: ${what}`;
}
function viewFixkosten() {
const today = todayISO(); const st = (r) => recStatus(r, today);
const ordered = S.recurring.slice().sort((a, b) => monthlyNow(b, today) - monthlyNow(a, today));
const act = ordered.filter((r) => st(r) === 'aktiv');
const planned = S.recurring.filter((r) => st(r) === 'geplant').sort((a, b) => (a.valid_from || '').localeCompare(b.valid_from || ''));
const ended = S.recurring.filter((r) => st(r) === 'beendet').sort((a, b) => (b.valid_to || b.valid_from || '').localeCompare(a.valid_to || a.valid_from || ''));
const ins = act.filter((r) => r.kind === 'in'), outs = act.filter((r) => r.kind === 'out');
const inc = sum(ins.map((r) => monthlyNow(r, today))), fix = sum(outs.map((r) => monthlyNow(r, today)));
const quote = inc > 0 ? Math.round((fix / inc) * 100) : null;
const det = detectRecurring();
const ev = upcomingChanges(S.recurring, today, 12);
return `${topbar('Fixkosten & Einkommen')}
<div class="kpis" style="margin-bottom:16px">
<div class="kpi good"><span class="label">Einkommen / Monat</span><b>${eur(inc)}</b></div>
<div class="kpi"><span class="label">Fixkosten / Monat</span><b>${eur(fix)}</b></div>
<div class="kpi ${quote == null ? '' : quote > 60 ? 'bad' : quote > 50 ? 'warn' : 'good'}"><span class="label">Fixkostenquote</span><b>${quote == null ? '–' : quote + ' %'}</b></div>
</div>
<div class="grid-2">
<section class="card"><div class="card-head"><h2>Regelmäßige Einnahmen</h2><button class="btn sm primary" data-act="new-rec" data-kind="in">${I.plus} Einnahme</button></div>
${ins.length ? `<div class="list">${ins.map(recRow).join('')}</div>` : '<div class="empty"><p>Trag hier dein Nettogehalt ein – z. B. „Gehalt“, monatlich.</p></div>'}</section>
<section class="card"><div class="card-head"><h2>Fixkosten & Verträge</h2><button class="btn sm primary" data-act="new-rec" data-kind="out">${I.plus} Fixkosten</button></div>
${outs.length ? `<div class="list">${outs.map(recRow).join('')}</div>` : '<div class="empty"><p>Miete, Strom, Handy, Versicherungen, Abos … alles, was regelmäßig abgeht.</p></div>'}
<p class="small muted">Fixkosten zählen automatisch als ausgegeben. Buche sie nicht zusätzlich als Ausgabe. Raten mit Enddatum enden von selbst, neue mit Startdatum zählen erst ab diesem Tag.</p></section>
</div>
${planned.length ? `<section class="card" style="margin-top:16px"><div class="card-head"><h2>Geplant & kommend</h2><span class="small muted">zählt erst ab dem Startdatum</span></div><div class="list">${planned.map(recRow).join('')}</div></section>` : ''}
${ev.length ? `<section class="card" style="margin-top:16px"><div class="card-head"><h2>Ausblick</h2><span class="small muted">die nächsten 12 Monate</span></div><div class="list">${ev.map((e) => `<div class="item" style="cursor:default"><span class="t"><b>${changeText(e)}</b></span></div>`).join('')}</div></section>` : ''}
${ended.length ? `<section class="card" style="margin-top:16px"><div class="card-head"><h2>Beendet (${ended.length})</h2><button class="btn sm" data-act="toggle-ended">${S.showEnded ? 'Verbergen' : 'Anzeigen'}</button></div>${S.showEnded ? `<div class="list">${ended.map(recRow).join('')}</div>` : '<p class="small muted">Beendete Raten und Verträge zählen nicht mehr in die Berechnung.</p>'}</section>` : ''}
${det.length ? `<section class="card" style="margin-top:16px"><div class="card-head"><h2>Wiederkehrend erkannt</h2><span class="small muted">aus deinen Buchungen</span></div>
<div class="list">${det.map((d) => `<div class="item" style="cursor:default">${catIcon('abo')}<span class="t"><b>${esc(d.label)}</b><small>in ${d.months} Monaten gebucht · Ø ${eur(d.avg)}</small></span><button class="btn sm" data-act="adopt-rec" data-name="${esc(d.label)}" data-amount="${r2(d.avg)}">Als Fixkosten</button></div>`).join('')}</div></section>` : ''}`;
}
function visibleTips() { const dis = new Set(S.profile?.dismissed_tips || []); return buildTips().filter((t) => !dis.has(t.id)); }
function tipCard(t, compact = false) {
return `<div class="tip ${t.level === 'warn' ? 'warn' : ''}"><span class="tip-ic">${t.level === 'warn' ? I.warn : I.bulb}</span><div style="display:grid;gap:6px;min-width:0">
<h3>${esc(t.title)}</h3>${compact ? '' : `<p>${esc(t.text)}</p>`}
${t.save ? `<span class="tip-save">Sparpotenzial ca. ${eur0(t.save)} im Jahr (geschätzt)</span>` : ''}
${compact ? '' : `<div class="tip-actions"><button class="btn sm" data-act="dismiss-tip" data-id="${esc(t.id)}">${(S.profile?.dismissed_tips || []).includes(t.id) ? 'Wieder anzeigen' : 'Erledigt / ausblenden'}</button></div>`}
</div></div>`;
}
function viewTipps() {
const all = buildTips(); const dis = new Set(S.profile?.dismissed_tips || []);
const vis = all.filter((t) => !dis.has(t.id)); const hid = all.filter((t) => dis.has(t.id));
const mon = vis.filter((t) => t.monthly), rest = vis.filter((t) => !t.monthly);
const pot = sum(vis.map((t) => t.save || 0));
const ref = checkRef();
const allGood = !mon.length && S.bench.length && ref.c.outs.length >= 3;
return `${topbar('Spartipps')}
<div class="kpis" style="margin-bottom:16px">
<div class="kpi good"><span class="label">Sparpotenzial / Jahr</span><b>${eur0(pot)}</b></div>
<div class="kpi"><span class="label">Offene Tipps</span><b>${vis.length}</b></div>
<div class="kpi"><span class="label">Erledigt</span><b>${hid.length}</b></div>
</div>
<section class="stack">
${mon.length ? `<div class="card-head" style="padding:0"><h2>Monatscheck</h2><span class="small muted">${periodLabel(ref.c)} · ${ref.label}</span></div>${focusCard(mon)}${mon.map((t) => tipCard(t)).join('')}` : ''}
${allGood ? `<div class="card"><div class="card-head"><h2>Monatscheck</h2><span class="badge good">Alles im Rahmen</span></div><p>Bei Lebensmitteln, Restaurant, Fahrten, Freizeit und Kleidung liegst du im üblichen Bereich. Weiter so.</p></div>` : ''}
${rest.length ? `${mon.length ? '<div class="card-head" style="padding:0"><h2>Weitere Tipps</h2></div>' : ''}${rest.map((t) => tipCard(t)).join('')}` : ''}
${!mon.length && !rest.length && !allGood ? '<div class="card"><div class="empty"><p>Keine offenen Tipps. Je mehr Fixkosten und Buchungen du einträgst, desto genauer werden die Tipps.</p></div></div>' : ''}
${hid.length ? `<button class="btn" data-act="toggle-dismissed">${S.showDismissed ? 'Erledigte verbergen' : `Erledigte anzeigen (${hid.length})`}</button>${S.showDismissed ? hid.map((t) => tipCard(t)).join('') : ''}` : ''}
<p class="small muted">Die Ersparnis ist eine Schätzung aus deinen Beträgen und üblichen Marktpreisen. Die Vergleichswerte stammen vom Statistischen Bundesamt (Einkommens- und Verbrauchsstichprobe 2023). Groschen bekommt keine Provision von Anbietern.</p>
</section>`;
}
function viewAnalyse() {
const c = compute(S.anOffset), p = compute(S.anOffset - 1);
const cats = Object.entries(c.byCat).sort((a, b) => b[1] - a[1]); const max = Math.max(1, ...cats.map((x) => x[1]));
const inc = c.recIn + c.oneIn; const rate = inc > 0 ? Math.round(((inc - c.recOut - c.spentTotal) / inc) * 100) : null;
const hist = []; for (let k = -5; k <= 0; k++) { const cc = compute(S.anOffset + k); hist.push({ label: `${MON[cc.start.getMonth()].slice(0, 3)}`, v: cc.spentTotal }); }
const hmax = Math.max(1, ...hist.map((h) => h.v));
const budgets = S.budgets.map((b) => ({ ...b, spent: c.byCat[b.category] || 0 }));
const days = c.state === 'current' ? Math.max(1, c.elapsed) : c.totalDays;
const bm = benchmarkRows({ byCat: c.byCat, totalDays: days, bench: S.bench, household: Number(S.profile?.household_size) || 1, names: CAT_NAMES });
const wd = c.state === 'future' ? null : weekdayAverages(c.outs, c.sI, c.state === 'current' ? todayISO() : c.eI);
const wmax = wd ? Math.max(1, ...wd.map((w) => w.avg)) : 1;
const top = c.outs.slice().sort((a, b) => b.amount - a.amount).slice(0, 5);
const rows = dayRows(c, todayISO()).filter((r) => r.status !== 'future');
return `${topbar('Analyse', periodNav('an-period', S.anOffset, c))}
<div class="kpis" style="margin-bottom:16px">
<div class="kpi"><span class="label">Ausgaben im Zeitraum</span><b>${eur(c.spentTotal)}</b></div>
<div class="kpi"><span class="label">Ø pro Tag</span><b>${eur(c.elapsed ? c.spentTotal / c.elapsed : 0)}</b></div>
<div class="kpi ${rate == null ? '' : rate < 0 ? 'bad' : rate < 10 ? 'warn' : 'good'}"><span class="label">Übrig vom Einkommen</span><b>${rate == null ? '–' : rate + ' %'}</b></div>
</div>
${S.anOffset === 0 ? `<div style="margin-bottom:16px">${budgetCheckCard(true)}</div>` : ''}
<div class="grid-2">
<section class="card"><div class="card-head"><h2>Ausgaben nach Kategorie</h2><span class="small muted">Anteil · ggü. Vorzeitraum</span></div>
${cats.length ? `<div class="bars">${cats.map(([k, v]) => { const pv = p.byCat[k] || 0; const d = pv ? Math.round(((v - pv) / pv) * 100) : null;
return `<div class="bar-row"><span class="name">${esc(catName(k))}</span><span class="track"><i style="width:${(v / max) * 100}%"></i></span><span class="val">${eur(v)} <small class="muted">${Math.round((v / c.spentTotal) * 100)} % · ${d == null ? 'neu' : (d > 0 ? '+' : '') + d + ' %'}</small></span></div>`; }).join('')}</div>` : '<div class="empty"><p>Keine Ausgaben in diesem Zeitraum.</p></div>'}
</section>
<section class="card"><div class="card-head"><h2>Budgets</h2><button class="btn sm primary" data-act="new-budget">${I.plus} Budget</button></div>
${budgets.length ? `<div class="bars">${budgets.map((b) => { const pc = (b.spent / b.amount) * 100;
return `<div class="bar-row" data-act="edit-budget" data-cat="${b.category}" style="cursor:pointer"><span class="name">${esc(catName(b.category))}</span><span class="track"><i class="${pc > 100 ? 'over' : pc > 85 ? 'near' : ''}" style="width:${Math.min(100, pc)}%"></i></span><span class="val">${eur(b.spent)} / ${eur0(b.amount)}</span></div>`; }).join('')}</div>` : '<div class="empty"><p>Leg Budgets für einzelne Kategorien fest, z. B. 300 € für Lebensmittel.</p></div>'}
</section>
</div>
${bm.length ? `<section class="card" style="margin-top:16px" data-bench><div class="card-head"><h2>Vergleich mit dem Durchschnitt</h2><span class="small muted">pro Monat hochgerechnet</span></div>
<div class="bars">${bm.map((b) => { const pc = b.ratio * 100; return `<div class="bar-row"><span class="name">${esc(b.name)}</span><span class="track"><i class="${pc > 100 ? 'over' : pc > 85 ? 'near' : ''}" style="width:${Math.min(100, pc)}%"></i></span><span class="val">${eur0(b.monthly)} / ${eur0(b.typical)}</span></div>`; }).join('')}</div>
<p class="small muted">Links deine Ausgaben, rechts der Durchschnitt: ${esc([...new Set(bm.map((b) => b.scope))].join('; '))} (${esc(bm[0].source)}). „Shopping & Kleidung“ wird mit Bekleidung und Schuhen verglichen, „Lebensmittel“ mit Nahrungsmitteln, Getränken und Tabak, „Tanken & Fahrten“ mit dem gesamten Verkehr. Die Haushaltsgröße stellst du unter Konto ein.</p></section>` : ''}
<div class="grid-2" style="margin-top:16px">
<section class="card"><div class="card-head"><h2>Ausgaben nach Wochentag</h2><span class="small muted">Ø pro Tag</span></div>
${wd ? `<div class="bars">${[1, 2, 3, 4, 5, 6, 0].map((i) => `<div class="bar-row"><span class="name">${WD[i]}</span><span class="track"><i style="width:${(wd[i].avg / wmax) * 100}%"></i></span><span class="val">${eur(wd[i].avg)}</span></div>`).join('')}</div>` : '<div class="empty"><p>Für künftige Zeiträume gibt es noch keine Auswertung.</p></div>'}
</section>
<section class="card"><div class="card-head"><h2>Größte Ausgaben</h2></div>
${top.length ? `<div class="list">${top.map(txRow).join('')}</div>` : '<div class="empty"><p>Keine Ausgaben in diesem Zeitraum.</p></div>'}
</section>
</div>
<section class="card" style="margin-top:16px${rows.length ? '' : ';display:none'}" data-daytable><div class="card-head"><h2>Tag für Tag</h2><span class="small muted">Tagesbudget, Ausgaben und Rest</span></div>
<div class="table-wrap"><table><thead><tr><th>Tag</th><th class="num">Tagesbudget</th><th class="num">Ausgegeben</th><th class="num">Rest danach</th></tr></thead><tbody>
${rows.map((r) => `<tr${r.status === 'today' ? ' style="font-weight:700"' : r.status === 'future' ? ' style="opacity:.65"' : ''}><td>${WD[parseD(r.date).getDay()]} ${deDate(r.date, false)}${r.status === 'today' ? ' (heute)' : ''}</td><td class="num">${eur(r.budget)}</td><td class="num">${r.spent ? eur(r.spent) : '–'}</td><td class="num"${r.rest < 0 ? ' style="color:#c0392b"' : ''}>${eur(r.rest)}</td></tr>`).join('')}
</tbody></table></div>
<p class="small muted">Das Tagesbudget eines Tages ist der Rest vom Vortag, gleichmäßig auf die übrigen Tage verteilt. Was du an einem Tag nicht ausgibst, steht den Folgetagen zur Verfügung.</p></section>
<section class="card" style="margin-top:16px"><div class="card-head"><h2>Ausgaben der letzten 6 Zeiträume</h2></div>
<div class="bars">${hist.map((h) => `<div class="bar-row"><span class="name">${h.label}</span><span class="track"><i style="width:${(h.v / hmax) * 100}%"></i></span><span class="val">${eur(h.v)}</span></div>`).join('')}</div>
</section>`;
}
function viewKonto() {
const acc = access(); const email = API.session?.user?.email || '';
const uname = email.endsWith('@' + USER_DOMAIN) ? email.split('@')[0] : email;
const theme = LS.get('groschen.theme') || 'system';
return `${topbar('Konto & Einstellungen')}
${!acc.ok ? `<div class="notice warn" style="margin-bottom:16px">Deine Testphase ist beendet. Deine Daten sind sicher gespeichert. Mit einem Abo kannst du weiter buchen. Die Tarife findest du unten unter „Abo“.</div>` : ''}
<div class="grid-2">
<section class="card">
<h2>Profil & Budget</h2>
<form class="form" id="f-settings">
<label class="field"><span>Name</span><input class="input" id="s-name" value="${esc(S.profile?.display_name || '')}" maxlength="80"></label>
<div class="row">
<label class="field"><span>Zahltag (Tag im Monat)</span><select class="select" id="s-payday">${Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}" ${S.profile?.payday === i + 1 ? 'selected' : ''}>${i + 1}.</option>`).join('')}</select></label>
<label class="field"><span>Sparziel pro Monat</span><input class="input" id="s-save" inputmode="decimal" value="${amountStr(S.profile?.savings_goal || 0)}"></label>
</div>
<label class="field"><span>Personen im Haushalt (für den Vergleich mit dem Durchschnitt)</span><select class="select" id="s-household">${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${(Number(S.profile?.household_size) || 1) === n ? 'selected' : ''}>${n === 6 ? '6 oder mehr' : n === 1 ? '1 Person' : n + ' Personen'}</option>`).join('')}</select></label>
<p class="small muted">Dein Zeitraum läuft vom Zahltag bis zum Tag davor im Folgemonat. Das Sparziel wird vorab abgezogen.</p>
<div class="settings-row"><span>Eigener Zeitraum</span><b>${customPeriod() ? `${deDate(customPeriod().start)} – ${deDate(customPeriod().end)}` : 'nicht gesetzt'}</b></div>
<button type="button" class="btn block" data-act="edit-period">Zeitraum selbst festlegen</button>
<button class="btn primary" type="submit">Speichern</button>
</form>
</section>
<section class="card">
<h2>Abo</h2>
<div class="settings-row"><span>Status</span><span class="badge ${acc.cls}">${esc(acc.label)}</span></div>
${acc.k === 'trial' ? `<div class="settings-row"><span>Test endet</span><b>${deDateTime(acc.ends)}</b></div>` : ''}
${S.access?.subscription_ends_at && acc.k === 'paid' ? `<div class="settings-row"><span>Bezahlt bis</span><b>${deDateTime(S.access.subscription_ends_at)}</b></div>` : ''}
${acc.k === 'frei' ? '<p class="muted">Dein Inhaber-Konto ist dauerhaft kostenlos.</p>' : `<button class="btn primary" data-act="open-abo">Tarife ansehen</button>`}
<hr class="divider">
<h2>Konto</h2>
<div class="settings-row"><span>Angemeldet als</span><b>${esc(uname)}</b></div>
<div class="settings-row"><span>Darstellung</span>
<select class="select" id="s-theme" style="max-width:180px"><option value="system" ${theme === 'system' ? 'selected' : ''}>Wie Gerät</option><option value="light" ${theme === 'light' ? 'selected' : ''}>Hell</option><option value="dark" ${theme === 'dark' ? 'selected' : ''}>Dunkel</option></select></div>
<div class="row">
<button class="btn" data-act="change-pw">Passwort ändern</button>
<button class="btn" data-act="export-csv">Export (CSV)</button>
<button class="btn" data-act="export-json">Sicherung (JSON)</button>
</div>
${S.admin ? `<button class="btn primary" data-act="go" data-view="statistik">${I.stats} Statistik & Nutzer</button>` : ''}
<div class="row"><button class="btn" data-act="logout">Abmelden</button>${S.admin ? '' : '<button class="btn danger" data-act="delete-account">Konto löschen</button>'}</div>
<div id="delete-zone"></div>
</section>
</div>
<section class="card" style="margin-top:16px">
<h2>Als App installieren</h2>
<p class="muted">iPhone: In Safari auf Teilen tippen → „Zum Home-Bildschirm“. Android: Im Chrome-Menü „App installieren“ oder „Zum Startbildschirm hinzufügen“. Danach startet Groschen wie eine normale App.</p>
</section>`;
}
function planCards() {
return `<div class="plans">
<button type="button" class="plan ${S.planPick === 'monat' ? 'on' : ''}" data-act="pick-plan" data-plan="monat"><span class="label">Monatlich</span><span class="p-price" data-aktion-preis="monat">${eur(PRICE_MONTH)}</span><span class="small muted">pro Monat, monatlich kündbar</span></button>
<button type="button" class="plan ${S.planPick === 'jahr' ? 'on' : ''}" data-act="pick-plan" data-plan="jahr"><span class="p-flag">${Math.max(0, Math.round((1 - PRICE_YEAR / (PRICE_MONTH * 12)) * 100))} % günstiger</span><span class="label">Jährlich</span><span class="p-price" data-aktion-preis="jahr">${eur(PRICE_YEAR)}</span><span class="small muted">pro Jahr = <span data-aktion-preis="jahr/12" data-aktion-ohne-tag>${eur(PRICE_YEAR / 12)}</span> im Monat</span></button>
</div>`;
}
function viewPaywall() {
return `<div class="paywall card">
<span class="badge bad" style="width:max-content">Testphase beendet</span>
<h1>Weiter mit Groschen</h1>
<p class="muted">Deine ${TRIAL_DAYS} Testtage sind vorbei. Deine Buchungen und Fixkosten bleiben gespeichert. Wähle einen Tarif, um weiter dein Tagesbudget zu sehen und zu buchen.</p>
<ul class="feature-list">
<li>${I.check}<span>Tagesbudget jeden Tag neu berechnet</span></li>
<li>${I.check}<span>Haushaltsbuch, Budgets und Analyse</span></li>
<li>${I.check}<span>Spartipps und Kündigungsfristen</span></li>
</ul>
${planCards()}
<button class="btn primary block" data-act="request-abo">Abo abschließen</button>
<div id="abo-msg"></div>
<button class="btn ghost" data-act="go" data-view="konto">Zum Konto (Export, Abmelden)</button>
</div>`;
}
const EV = { signup: ['Registriert', 'good'], login: ['Angemeldet', 'acc'], logout: ['Abgemeldet', ''], account_deleted: ['Konto gelöscht', 'bad'], abo_anfrage: ['Abo angefragt', 'warn'], zugang_geaendert: ['Zugang geändert', 'warn'], aktion_genutzt: ['Aktion genutzt', 'good'], aktion_gestartet: ['Aktion gestartet', 'acc'], aktion_beendet: ['Aktion beendet', ''], preis_geaendert: ['Preis geändert', 'acc'] };
function statusOf(u) {
const now = Date.now();
if (u.admin || (u.status === 'active' && u.plan === 'frei')) return ['Kostenlos', 'acc'];
if (u.status === 'active' && (!u.sub_ends_at || new Date(u.sub_ends_at) > now)) return [u.plan === 'aktion' ? 'Aktion gratis' : u.plan === 'jahr' ? 'Jahresabo' : 'Monatsabo', 'good'];
if (u.status === 'trialing' && new Date(u.trial_ends_at) > now) return ['Im Test', 'warn'];
if (u.status === 'canceled') return ['Gesperrt', 'bad'];
return ['Test abgelaufen', 'bad'];
}
function viewStatistik() {
const st = S.stats;
if (!st) return `${topbar('Statistik')}<div class="card"><p class="muted">Statistik wird geladen …</p></div>`;
const T = st.totals; const mrr = T.paid_month * PRICE_MONTH + (T.paid_year * PRICE_YEAR) / 12;
const ev = st.events.filter((e) => S.statsFilter === 'alle' || e.event === S.statsFilter);
const K = (l, v, cls = '') => `<div class="kpi ${cls}"><span class="label">${l}</span><b>${v}</b></div>`;
return `${topbar('Statistik & Nutzer', `<button class="btn sm" data-act="reload-stats">Aktualisieren</button>`)}
<p class="small muted" style="margin-bottom:12px">Stand ${deDateTime(st.generated_at)} · nur für dich als Inhaber sichtbar</p>
<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:16px">
${K('Konten gesamt', T.users)}${K('Neu (7 Tage)', T.signups_7d, 'good')}${K('Anmeldungen heute', T.logins_today)}
${K('Im Test', T.trialing, 'warn')}${K('Test abgelaufen', T.expired, 'bad')}${K('Zahlende Abos', `${T.paid} <small class="muted">(${T.paid_month} M / ${T.paid_year} J)</small>`, 'good')}
${K('Kostenlos', T.free)}${K('Gelöscht', T.deleted, 'bad')}${K('Abo-Anfragen', T.requests, 'warn')}
${K('Umsatz / Monat', eur(mrr), 'good')}${K('Anmeldungen gesamt', T.logins)}${K('Abmeldungen gesamt', T.logouts)}
</div>
<div class="grid-2">
<section class="card"><div class="card-head"><h2>Registrierungen pro Tag</h2><span class="small muted">30 Tage</span></div>${barChart(st.daily, 'signups', 'Registrierungen')}</section>
<section class="card"><div class="card-head"><h2>Anmeldungen pro Tag</h2><span class="small muted">30 Tage</span></div>${barChart(st.daily, 'logins', 'Anmeldungen')}</section>
</div>
<section class="card" style="margin-top:16px"><div class="card-head"><h2>Nutzer (${st.users.length})</h2></div>
<div class="table-wrap"><table><thead><tr><th>Name</th><th>Benutzer / E-Mail</th><th>Registriert</th><th>Letzte Anmeldung</th><th>Letzte Abmeldung</th><th>Anm.</th><th>Status</th><th>Zugang ändern</th></tr></thead><tbody>
${st.users.map((u) => { const [sl, sc] = statusOf(u); const em = (u.email || '').endsWith('@' + USER_DOMAIN) ? u.email.split('@')[0] : u.email;
return `<tr><td>${esc(u.name || '–')}</td><td>${esc(em)}</td><td>${deDateTime(u.created_at)}</td><td>${deDateTime(u.last_login)}</td><td>${deDateTime(u.last_logout)}</td><td class="num">${u.logins}</td><td><span class="badge ${sc}">${sl}</span></td>
<td>${u.admin ? '<span class="muted">Inhaber</span>' : `<select class="select" style="min-height:34px;padding:4px 8px" data-act="set-access" data-user="${u.id}" aria-label="Zugang für ${esc(u.name || em)}"><option value="">Wählen …</option><option value="monat">Monatsabo freischalten</option><option value="jahr">Jahresabo freischalten</option><option value="frei">Kostenlos (dauerhaft)</option><option value="test">Test +3 Tage</option><option value="sperren">Sperren</option></select>`}</td></tr>`; }).join('')}
</tbody></table></div></section>
<section class="card" style="margin-top:16px"><div class="card-head"><h2>Ereignisse</h2>
<select class="select" id="ev-filter" style="max-width:220px" aria-label="Ereignisse filtern"><option value="alle">Alle Ereignisse</option>${Object.entries(EV).map(([k, [n]]) => `<option value="${k}" ${S.statsFilter === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
<div class="list">${ev.length ? ev.slice(0, 200).map((e) => { const [n, c] = EV[e.event] || [e.event, '']; const em = e.email ? ((e.email.endsWith('@' + USER_DOMAIN)) ? e.email.split('@')[0] : e.email) : 'gelöschtes Konto';
return `<div class="item ev" style="cursor:default"><span class="t"><span class="badge ${c}">${n}</span><b>${esc(em)}</b><small>${e.meta?.plan ? 'Tarif: ' + esc(e.meta.plan) : e.meta?.status ? 'Status: ' + esc(e.meta.status) + (e.meta.plan ? ' · ' + esc(e.meta.plan) : '') : ''}</small></span><span class="v"><small>${deDateTime(e.at)}</small></span></div>`; }).join('') : '<div class="empty"><p>Keine Ereignisse.</p></div>'}</div>
<p class="small muted">Nach einer Kontolöschung wird die E-Mail aus Datenschutzgründen aus der Statistik entfernt; Zeitpunkt und Anzahl bleiben erhalten.</p>
</section>`;
}
async function loadStats() { try { S.stats = await API.rpc('admin_stats', { p_days: 30 }); } catch (e) { toast(e.message); } if (S.view === 'statistik') renderApp(); }
function resetSheetScroll() { const sh = $('#sheet-wrap .sheet'); if (sh) sh.scrollTop = 0; const b = $('#sheet-body'); if (b) b.scrollTop = 0; }
function openSheet(html) { $('#sheet-body').innerHTML = html; $('#sheet-wrap').hidden = false; resetSheetScroll(); requestAnimationFrame(resetSheetScroll); setTimeout(() => { resetSheetScroll(); const f = $('#sheet-body [autofocus]'); if (f) f.focus({ preventScroll: true }); }, 60); }
function closeSheet() { $('#sheet-wrap').hidden = true; $('#sheet-body').innerHTML = ''; resetSheetScroll(); }
const sheetHead = (t) => `<div class="sheet-head"><h2 id="sheet-title">${t}</h2><button class="icon-btn" data-close aria-label="Schließen">${I.x}</button></div>`;
let txDraft = null;
function txSheet(t = null) {
txDraft = t ? { ...t, manual: true } : { kind: 'out', category: 'lebensmittel', date: todayISO(), note: '', amount: '', manual: false };
renderTxSheet();
}
function renderTxSheet() {
const d = txDraft; const cats = d.kind === 'in' ? CATS.in : CATS.out;
openSheet(`${sheetHead(d.id ? 'Buchung bearbeiten' : d.kind === 'in' ? 'Neue Einnahme' : 'Neue Ausgabe')}
<form class="form" id="f-tx" novalidate>
<div class="seg"><button type="button" class="${d.kind === 'out' ? 'on' : ''}" data-act="tx-kind" data-kind="out">Ausgabe</button><button type="button" class="${d.kind === 'in' ? 'on' : ''}" data-act="tx-kind" data-kind="in">Einnahme</button></div>
<label class="field"><span>Betrag in €</span><input class="input big" id="tx-amount" inputmode="decimal" placeholder="0,00" value="${esc(d.amount === '' ? '' : amountStr(d.amount))}" autofocus required></label>
<label class="field"><span>Wofür? (z. B. REWE, Tanken)</span><input class="input" id="tx-note" maxlength="120" value="${esc(d.note || '')}" autocomplete="off"></label>
<div class="field"><span>Kategorie</span><div class="chips" id="tx-cats">${cats.map(([k, n, c]) => `<button type="button" class="chip ${d.category === k ? 'on' : ''}" data-act="tx-cat" data-cat="${k}"><i class="dot" style="background:${c}"></i>${n}</button>`).join('')}</div></div>
<label class="field"><span>Datum</span><input class="input" id="tx-date" type="date" value="${d.date}" required></label>
<p class="error" id="tx-err"></p>
<button class="btn primary block" type="submit">${d.id ? 'Änderungen speichern' : 'Speichern'}</button>
${d.id ? `<div id="tx-del"><button type="button" class="btn danger block" data-act="tx-delete-ask">Buchung löschen</button></div>` : ''}
</form>`);
}
let recDraft = null;
function recSheet(r = null, kind = 'out') {
recDraft = r ? { ...r, manual: true } : { kind, name: '', amount: '', category: kind === 'in' ? 'gehalt' : 'wohnen', interval_months: 1, cancel_by: '', manual: false };
const d = recDraft; const cats = d.kind === 'in' ? CATS.in : CATS.fix;
openSheet(`${sheetHead(d.id ? 'Eintrag bearbeiten' : d.kind === 'in' ? 'Regelmäßige Einnahme' : 'Neue Fixkosten')}
<form class="form" id="f-rec" novalidate>
<label class="field"><span>Bezeichnung</span><input class="input" id="rec-name" maxlength="80" value="${esc(d.name)}" placeholder="${d.kind === 'in' ? 'z. B. Gehalt' : 'z. B. Handyvertrag Telekom'}" autofocus required></label>
<div class="row">
<label class="field"><span>Betrag in €</span><input class="input" id="rec-amount" inputmode="decimal" value="${esc(d.amount === '' ? '' : amountStr(d.amount))}" placeholder="0,00" required></label>
<label class="field"><span>Wie oft?</span><select class="select" id="rec-int">${[[1, 'monatlich'], [3, 'vierteljährlich'], [6, 'halbjährlich'], [12, 'jährlich']].map(([v, n]) => `<option value="${v}" ${d.interval_months === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
</div>
<label class="field"><span>Kategorie</span><select class="select" id="rec-cat">${cats.map(([k, n]) => `<option value="${k}" ${d.category === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
${d.kind === 'out' ? `<label class="field"><span>Kündbar bis (optional)</span><input class="input" id="rec-cancel" type="date" value="${d.cancel_by || ''}"></label>` : ''}
<div class="row">
<label class="field"><span>Gilt ab (optional)</span><input class="input" id="rec-from" type="date" value="${d.valid_from || ''}"></label>
<label class="field"><span>Gilt bis (optional)</span><input class="input" id="rec-to" type="date" value="${d.valid_to || ''}"></label>
</div>
<label class="field"><span>Oder: Anzahl Zahlungen (berechnet das Ende)</span><input class="input" id="rec-count" inputmode="numeric" placeholder="z. B. 36" autocomplete="off"></label>
<label class="check"><input type="checkbox" id="rec-once"${d.is_one_time ? ' checked' : ''}><span>Einmalige Zahlung am Datum „Gilt ab“ (z. B. Anzahlung)</span></label>
<p class="small muted">Ohne Datum läuft der Eintrag unbegrenzt. Mit „Gilt bis“ endet er automatisch. Liegt „Gilt ab“ in der Zukunft, zählt er erst ab diesem Tag.</p>
<p class="error" id="rec-err"></p>
<button class="btn primary block" type="submit">Speichern</button>
${d.id ? `<div id="rec-del"><button type="button" class="btn danger block" data-act="rec-delete-ask">Eintrag löschen</button></div>` : ''}
</form>`);
}
function budgetSheet(cat = null) {
const b = S.budgets.find((x) => x.category === cat);
openSheet(`${sheetHead(b ? 'Budget ändern' : 'Neues Budget')}
<form class="form" id="f-budget" novalidate>
<label class="field"><span>Kategorie</span><select class="select" id="b-cat" ${b ? 'disabled' : ''}>${CATS.out.map(([k, n]) => `<option value="${k}" ${cat === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
<label class="field"><span>Budget pro Zeitraum in €</span><input class="input" id="b-amount" inputmode="decimal" value="${b ? amountStr(b.amount) : ''}" autofocus required></label>
<p class="error" id="b-err"></p>
<button class="btn primary block" type="submit">Speichern</button>
${b ? `<button type="button" class="btn danger block" data-act="budget-delete" data-cat="${b.category}">Budget entfernen</button>` : ''}
</form>`);
}
function aboSheet() {
openSheet(`${sheetHead('Groschen-Abo')}
<div class="form">
<p class="muted">Alle Funktionen, auf allen deinen Geräten. Jederzeit kündbar.</p>
${planCards()}
<button class="btn primary block" data-act="request-abo">Abo abschließen</button>
<div id="abo-msg"></div>
</div>`);
}
function pwSheet() {
openSheet(`${sheetHead('Passwort ändern')}
<form class="form" id="f-pw" novalidate>
<label class="field"><span>Neues Passwort (mind. 8 Zeichen, mit Zahl)</span><input class="input" id="pw-new" type="password" autocomplete="new-password" autofocus></label>
<label class="field"><span>Wiederholen</span><input class="input" id="pw-new2" type="password" autocomplete="new-password"></label>
<p class="error" id="pw-err"></p>
<button class="btn primary block" type="submit">Passwort speichern</button>
</form>`);
}
const QUICK_FIX = [['Miete (warm)', 'wohnen'], ['Strom', 'energie'], ['Handy', 'handy'], ['Internet', 'internet'], ['Versicherungen', 'versicherung'], ['Streaming & Abos', 'abo'], ['Rundfunkbeitrag', 'rundfunk'], ['Auto / ÖPNV', 'mobil_fix'], ['Fitness', 'fitness'], ['Kredit / Raten', 'kredit']];
let onb = null;
function onboardingSheet(step = 1) {
onb ||= { payday: S.profile?.payday || 1, income: '', fix: {}, savings: '' };
const steps = `<div class="steps">${[1, 2, 3].map((i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>`;
let body = '';
if (step === 1) body = `<h2>Willkommen${firstName() ? ', ' + esc(firstName()) : ''}!</h2><p class="muted">In drei kurzen Schritten richtet Groschen dein Tagesbudget ein.</p>
<label class="field"><span>An welchem Tag bekommst du dein Geld?</span><select class="select" id="o-payday">${Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}" ${onb.payday === i + 1 ? 'selected' : ''}>am ${i + 1}.</option>`).join('')}</select></label>
<label class="field"><span>Netto-Einkommen pro Monat in €</span><input class="input big" id="o-income" inputmode="decimal" value="${esc(onb.income)}" placeholder="0,00" autofocus></label>`;
if (step === 2) body = `<h2>Deine Fixkosten</h2><p class="muted">Trag ein, was jeden Monat abgeht. Leere Felder werden übersprungen. Du kannst später alles ändern.</p>
<div class="form">${QUICK_FIX.map(([n, k], i) => `<label class="fix-input"><span>${n}</span><input class="input" id="o-fix-${i}" inputmode="decimal" placeholder="0,00" value="${esc(onb.fix[i] || '')}"></label>`).join('')}</div>`;
if (step === 3) body = `<h2>Dein Sparziel</h2><p class="muted">Wie viel willst du jeden Monat zurücklegen? Groschen zieht den Betrag vorab ab, damit er nicht im Alltag verschwindet.</p>
<label class="field"><span>Sparziel pro Monat in €</span><input class="input big" id="o-save" inputmode="decimal" value="${esc(onb.savings)}" placeholder="0,00" autofocus></label>`;
openSheet(`${sheetHead('Einrichtung')}${steps}<form class="form" id="f-onb" data-step="${step}" novalidate style="margin-top:14px">${body}<p class="error" id="o-err"></p>
<div class="row">${step > 1 ? '<button type="button" class="btn" data-act="onb-back">Zurück</button>' : '<button type="button" class="btn ghost" data-act="onb-skip">Später</button>'}<button class="btn primary" type="submit">${step < 3 ? 'Weiter' : 'Fertig'}</button></div></form>`);
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3200); }
function go(view) { S.view = view; try { history.replaceState(null, '', '#' + view); } catch { /* ignoriert */ } renderApp(); window.scrollTo(0, 0); if (view === 'statistik') loadStats(); }
function applyTheme() { const t = LS.get('groschen.theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
function download(name, text, type) {
const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function busy(btn, fn) { if (btn) { btn.disabled = true; } try { return await fn(); } finally { if (btn) btn.disabled = false; } }
function loginEmail(id) { const s = id.trim().toLowerCase(); return s.includes('@') ? s : `${s}@${USER_DOMAIN}`; }
async function afterLogin() {
await loadAll();
const h = (location.hash || '').slice(1);
if (navItems().some(([k]) => k === h)) S.view = h;
renderApp();
if (S.view === 'statistik') loadStats();
if (!S.profile.onboarded && access().ok) { onb = null; onboardingSheet(1); }
}
document.addEventListener('click', async (e) => {
if (e.target.closest('[data-close]')) { closeSheet(); return; }
const el = e.target.closest('[data-act]'); if (!el || el.tagName === 'SELECT') return;
const act = el.dataset.act;
try {
switch (act) {
case 'auth-tab': S.authTab = el.dataset.tab; renderAuth(); break;
case 'forgot': {
const id = $('#l-id')?.value.trim();
if (!id || !id.includes('@')) { $('#auth-err').textContent = 'Gib oben deine E-Mail-Adresse ein, dann tippe noch einmal auf „Passwort vergessen?“.'; break; }
await busy(el, () => fetch(`${SB_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(location.origin + '/')}`, { method: 'POST', headers: API.headers(false), body: JSON.stringify({ email: id.toLowerCase() }) }));
$('#auth-err').textContent = 'Wenn es ein Konto mit dieser E-Mail gibt, bekommst du gleich einen Link zum Zurücksetzen.'; break;
}
case 'go': go(el.dataset.view); break;
case 'new-tx': txSheet(); break;
case 'edit-tx': txSheet(S.tx.find((x) => x.id === el.dataset.id)); break;
case 'tx-kind': readTxDraft(); txDraft.kind = el.dataset.kind; txDraft.category = txDraft.kind === 'in' ? 'gehalt' : 'lebensmittel'; txDraft.manual = false; renderTxSheet(); break;
case 'tx-cat': readTxDraft(); txDraft.category = el.dataset.cat; txDraft.manual = true; $$('#tx-cats .chip').forEach((c) => c.classList.toggle('on', c.dataset.cat === txDraft.category)); break;
case 'tx-delete-ask': $('#tx-del').innerHTML = `<div class="inline-confirm"><span>Wirklich löschen?</span><button type="button" class="btn sm danger" data-act="tx-delete">Ja, löschen</button><button type="button" class="btn sm" data-act="tx-delete-no">Abbrechen</button></div>`; break;
case 'tx-delete-no': $('#tx-del').innerHTML = '<button type="button" class="btn danger block" data-act="tx-delete-ask">Buchung löschen</button>'; break;
case 'tx-delete': await busy(el, () => API.rest('transactions', `id=eq.${txDraft.id}`, { method: 'DELETE' })); S.tx = S.tx.filter((x) => x.id !== txDraft.id); closeSheet(); renderApp(); toast('Buchung gelöscht'); break;
case 'new-rec': recSheet(null, el.dataset.kind || 'out'); break;
case 'edit-rec': recSheet(S.recurring.find((x) => x.id === el.dataset.id)); break;
case 'adopt-rec': recSheet(null, 'out'); $('#rec-name').value = el.dataset.name; $('#rec-amount').value = amountStr(el.dataset.amount); $('#rec-cat').value = autoCat(el.dataset.name, AUTO_FIX, 'abo'); break;
case 'rec-delete-ask': $('#rec-del').innerHTML = `<div class="inline-confirm"><span>Wirklich löschen?</span><button type="button" class="btn sm danger" data-act="rec-delete">Ja, löschen</button><button type="button" class="btn sm" data-act="rec-delete-no">Abbrechen</button></div>`; break;
case 'rec-delete-no': $('#rec-del').innerHTML = '<button type="button" class="btn danger block" data-act="rec-delete-ask">Eintrag löschen</button>'; break;
case 'rec-delete': await busy(el, () => API.rest('recurring', `id=eq.${recDraft.id}`, { method: 'DELETE' })); S.recurring = S.recurring.filter((x) => x.id !== recDraft.id); closeSheet(); renderApp(); toast('Eintrag gelöscht'); break;
case 'new-budget': budgetSheet(); break;
case 'edit-period': periodSheet(); break;
case 'period-reset': { const body = { period_start: null, period_end: null, updated_at: new Date().toISOString() }; await busy(el, () => API.rest('profiles', `user_id=eq.${API.session.user.id}`, { method: 'PATCH', body })); Object.assign(S.profile, body); closeSheet(); renderApp(); periodChanged(); toast('Wieder normaler Zahltag'); break; }
case 'edit-budget': budgetSheet(el.dataset.cat); break;
case 'budget-delete': await busy(el, () => API.rest('budgets', `category=eq.${encodeURIComponent(el.dataset.cat)}&user_id=eq.${API.session.user.id}`, { method: 'DELETE' })); S.budgets = S.budgets.filter((b) => b.category !== el.dataset.cat); closeSheet(); renderApp(); break;
case 'tx-period': S.txOffset = Math.min(0, Math.max(-12, S.txOffset + Number(el.dataset.d))); renderApp(); break;
case 'an-period': S.anOffset = Math.min(0, Math.max(-12, S.anOffset + Number(el.dataset.d))); renderApp(); break;
case 'dismiss-tip': {
const cur = new Set(S.profile.dismissed_tips || []); cur.has(el.dataset.id) ? cur.delete(el.dataset.id) : cur.add(el.dataset.id);
const arr = [...cur].slice(-300);
await API.rest('profiles', `user_id=eq.${API.session.user.id}`, { method: 'PATCH', body: { dismissed_tips: arr, updated_at: new Date().toISOString() } });
S.profile.dismissed_tips = arr; renderApp(); break;
}
case 'toggle-ended': S.showEnded = !S.showEnded; renderApp(); break;
case 'toggle-dismissed': S.showDismissed = !S.showDismissed; renderApp(); break;
case 'pick-plan': S.planPick = el.dataset.plan; $$('.plan').forEach((p) => p.classList.toggle('on', p.dataset.plan === S.planPick)); break;
case 'open-abo': aboSheet(); break;
case 'request-abo': {
await busy(el, () => API.rpc('request_subscription', { p_plan: S.planPick }));
$$('#abo-msg').forEach((m) => { m.innerHTML = `<div class="notice good">Danke! Deine Anfrage für das ${S.planPick === 'jahr' ? 'Jahresabo' : 'Monatsabo'} ist eingegangen. Die Online-Zahlung wird gerade freigeschaltet – bis dahin schalten wir dein Abo nach Zahlungseingang persönlich frei.</div>`; });
break;
}
case 'change-pw': pwSheet(); break;
case 'export-csv': {
const rows = [['Datum', 'Art', 'Kategorie', 'Beschreibung', 'Betrag'], ...S.tx.slice().sort((a, b) => a.date.localeCompare(b.date)).map((x) => [deDate(x.date), x.kind === 'in' ? 'Einnahme' : 'Ausgabe', catName(x.category), x.note || '', amountStr(x.kind === 'in' ? x.amount : -x.amount)])];
download(`groschen-buchungen-${todayISO()}.csv`, '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n'), 'text/csv;charset=utf-8'); break;
}
case 'export-json': download(`groschen-sicherung-${todayISO()}.json`, JSON.stringify({ exportiert: new Date().toISOString(), profil: S.profile, fixkosten: S.recurring, buchungen: S.tx, budgets: S.budgets }, null, 2), 'application/json'); break;
case 'logout': await busy(el, () => API.signOut()); S.loaded = false; S.stats = null; S.authTab = 'login'; renderAuth(); break;
case 'delete-account': $('#delete-zone').innerHTML = `<div class="inline-confirm"><span>Konto und alle Daten endgültig löschen? Das kann nicht rückgängig gemacht werden.</span><button class="btn sm danger" data-act="delete-yes">Endgültig löschen</button><button class="btn sm" data-act="delete-no">Abbrechen</button></div>`; break;
case 'delete-no': $('#delete-zone').innerHTML = ''; break;
case 'delete-yes': await busy(el, () => API.rpc('delete_my_account')); API.save(null); S.loaded = false; S.authTab = 'register'; renderAuth('Dein Konto wurde gelöscht.'); break;
case 'reload-stats': S.stats = null; renderApp(); loadStats(); break;
case 'onb-back': readOnb(); onboardingSheet(Number($('#f-onb').dataset.step) - 1); break;
case 'onb-skip': closeSheet(); break;
default: break;
}
} catch (err) { toast(err.message || 'Das hat nicht geklappt.'); }
});
function readTxDraft() {
if (!txDraft) return;
const a = $('#tx-amount'); if (a) txDraft.amount = a.value.trim() === '' ? '' : (Number.isNaN(parseAmount(a.value)) ? txDraft.amount : parseAmount(a.value));
const n = $('#tx-note'); if (n) txDraft.note = n.value; const d = $('#tx-date'); if (d) txDraft.date = d.value;
}
function readOnb() {
const f = $('#f-onb'); if (!f) return; const step = Number(f.dataset.step);
if (step === 1) { onb.payday = Number($('#o-payday').value); onb.income = $('#o-income').value; }
if (step === 2) QUICK_FIX.forEach((_, i) => { onb.fix[i] = $('#o-fix-' + i).value; });
if (step === 3) onb.savings = $('#o-save').value;
}
document.addEventListener('input', (e) => {
if (e.target.id === 'tx-note' && txDraft && !txDraft.manual && txDraft.kind === 'out') {
const k = autoCat(e.target.value, AUTO_OUT, null);
if (k && k !== txDraft.category) { txDraft.category = k; $$('#tx-cats .chip').forEach((c) => c.classList.toggle('on', c.dataset.cat === k)); }
}
if (e.target.id === 'rec-name' && recDraft && !recDraft.manual && recDraft.kind === 'out') {
const k = autoCat(e.target.value, AUTO_FIX, null); if (k) $('#rec-cat').value = k;
}
if (e.target.id === 'wi-amount') updateWhatIf(e.target.value);
if (e.target.id === 'rec-count' || e.target.id === 'rec-from') syncRecEnd();
if (e.target.id === 'tx-search') { S.txSearch = e.target.value; const pos = e.target.selectionStart; renderApp(); const s = $('#tx-search'); if (s) { s.focus(); s.setSelectionRange(pos, pos); } }
});
document.addEventListener('change', async (e) => {
const t = e.target;
if (t.id === 'rec-cat' && recDraft) recDraft.manual = true;
if (t.id === 'rec-int' || t.id === 'rec-from' || t.id === 'rec-count') syncRecEnd();
if (t.id === 'tx-filter') { S.txFilter = t.value; renderApp(); }
if (t.id === 'ev-filter') { S.statsFilter = t.value; renderApp(); }
if (t.id === 's-theme') { if (t.value === 'system') LS.del('groschen.theme'); else LS.set('groschen.theme', t.value); applyTheme(); }
if (t.dataset.act === 'set-access' && t.value) {
const v = t.value; const now = new Date();
const map = { monat: ['active', 'monat', new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString()], jahr: ['active', 'jahr', new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()], frei: ['active', 'frei', null], sperren: ['canceled', null, null], test: ['trialing', null, null] };
try {
const [st, pl, until] = map[v]; await API.rpc('admin_set_access', { p_user: t.dataset.user, p_status: st, p_plan: pl, p_until: until });
toast('Zugang geändert'); loadStats();
} catch (err) { toast(err.message); }
}
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet-wrap').hidden) closeSheet(); });
document.addEventListener('submit', async (e) => {
e.preventDefault();
const f = e.target; const btn = f.querySelector('[type=submit]');
try {
if (f.id === 'f-login') {
const id = $('#l-id').value.trim(), pw = $('#l-pw').value;
if (!id || !pw) { $('#auth-err').textContent = 'Bitte Benutzername/E-Mail und Passwort eingeben.'; return; }
await busy(btn, async () => { await API.signIn(loginEmail(id), pw); await afterLogin(); });
}
if (f.id === 'f-register') {
const name = $('#r-name').value.trim(), email = $('#r-email').value.trim().toLowerCase(), pw = $('#r-pw').value, pw2 = $('#r-pw2').value;
const err = (m) => { $('#auth-err').textContent = m; };
if (!name) return err('Bitte gib deinen Namen ein.');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return err('Bitte gib eine gültige E-Mail-Adresse ein.');
if (pw.length < 8 || !/[0-9]/.test(pw) || !/[A-Za-zÄÖÜäöüß]/.test(pw)) return err('Das Passwort braucht mindestens 8 Zeichen mit Buchstaben und Zahl.');
if (pw !== pw2) return err('Die Passwörter stimmen nicht überein.');
if (!$('#r-ok').checked) return err('Bitte bestätige die Speicherung deiner Daten.');
await busy(btn, async () => {
const res = await fetch(`${SB_URL}/functions/v1/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY }, body: JSON.stringify({ name, email, password: pw }) }).catch(() => null);
if (!res) throw new Error('Keine Verbindung. Prüfe dein Internet.');
const data = await res.json().catch(() => ({}));
if (!res.ok) throw new Error(data.error || 'Registrierung fehlgeschlagen.');
await API.signIn(email, pw); await afterLogin(); toast(`Willkommen! Du kannst Groschen jetzt ${TRIAL_DAYS} Tage kostenlos testen.`);
});
}
if (f.id === 'f-tx') {
readTxDraft(); const d = txDraft; const amt = parseAmount($('#tx-amount').value);
if (!(amt > 0) || amt >= 1e7) { $('#tx-err').textContent = 'Bitte gib einen Betrag größer als 0 ein, z. B. 12,50.'; return; }
if (!d.date) { $('#tx-err').textContent = 'Bitte wähle ein Datum.'; return; }
const body = { tx_date: d.date, kind: d.kind, amount: amt, category: d.category, note: (d.note || '').trim().slice(0, 120) || null };
await busy(btn, async () => {
if (d.id) { const [row] = await API.rest('transactions', `id=eq.${d.id}`, { method: 'PATCH', body, prefer: 'return=representation' }); S.tx = S.tx.map((x) => (x.id === d.id ? normTx(row) : x)); }
else { const [row] = await API.rest('transactions', '', { method: 'POST', body, prefer: 'return=representation' }); S.tx.unshift(normTx(row)); }
});
S.tx.sort((a, b) => b.date.localeCompare(a.date) || String(b.created_at).localeCompare(String(a.created_at)));
closeSheet(); renderApp();
const c = compute(0); toast(d.kind === 'out' && d.date === todayISO() ? `Gespeichert · heute noch ${eur(c.todayLeft)}` : 'Gespeichert');
}
if (f.id === 'f-rec') {
const d = recDraft; const amt = parseAmount($('#rec-amount').value); const name = $('#rec-name').value.trim();
if (!name) { $('#rec-err').textContent = 'Bitte gib eine Bezeichnung ein.'; return; }
if (!(amt > 0) || amt >= 1e7) { $('#rec-err').textContent = 'Bitte gib einen Betrag größer als 0 ein.'; return; }
const once = !!$('#rec-once')?.checked; const valid_from = $('#rec-from')?.value || null; const valid_to = once ? null : ($('#rec-to')?.value || null);
const verr = validateValidity({ valid_from, valid_to, is_one_time: once }); if (verr) { $('#rec-err').textContent = verr; return; }
const body = { kind: d.kind, name, amount: amt, category: $('#rec-cat').value, interval_months: once ? 1 : Number($('#rec-int').value), cancel_by: $('#rec-cancel')?.value || null, valid_from, valid_to, is_one_time: once };
await busy(btn, async () => {
if (d.id) { const [row] = await API.rest('recurring', `id=eq.${d.id}`, { method: 'PATCH', body, prefer: 'return=representation' }); S.recurring = S.recurring.map((x) => (x.id === d.id ? normRec(row) : x)); }
else { const [row] = await API.rest('recurring', '', { method: 'POST', body, prefer: 'return=representation' }); S.recurring.push(normRec(row)); }
});
closeSheet(); renderApp(); toast('Gespeichert');
}
if (f.id === 'f-budget') {
const cat = $('#b-cat').value; const amt = parseAmount($('#b-amount').value);
if (!(amt > 0)) { $('#b-err').textContent = 'Bitte gib einen Betrag größer als 0 ein.'; return; }
await busy(btn, () => API.rest('budgets', 'on_conflict=user_id,category', { method: 'POST', body: { category: cat, amount: amt }, prefer: 'resolution=merge-duplicates,return=minimal' }));
S.budgets = [...S.budgets.filter((b) => b.category !== cat), { category: cat, amount: amt }]; closeSheet(); renderApp(); toast('Budget gespeichert');
}
if (f.id === 'f-period') {
const ps = $('#p-start').value, pe = $('#p-end').value;
if (!ps || !pe) { $('#p-err').textContent = 'Bitte gib beide Daten ein.'; return; }
if (pe < ps) { $('#p-err').textContent = 'Das Datum bei „Bis“ muss nach „Von“ liegen.'; return; }
if (diffDays(parseD(ps), parseD(pe)) > 92) { $('#p-err').textContent = 'Der Zeitraum darf höchstens 93 Tage lang sein.'; return; }
const body = { period_start: ps, period_end: pe, updated_at: new Date().toISOString() };
await busy(btn, () => API.rest('profiles', `user_id=eq.${API.session.user.id}`, { method: 'PATCH', body }));
Object.assign(S.profile, body); closeSheet(); S.txOffset = 0; S.anOffset = 0; renderApp(); periodChanged(); toast('Zeitraum gespeichert');
}
if (f.id === 'f-settings') {
const save = parseAmount($('#s-save').value || '0');
if (Number.isNaN(save) || save < 0) { toast('Bitte gib ein gültiges Sparziel ein.'); return; }
const body = { display_name: $('#s-name').value.trim().slice(0, 80) || null, payday: Number($('#s-payday').value), savings_goal: save, household_size: Number($('#s-household').value) || 1, updated_at: new Date().toISOString() };
await busy(btn, () => API.rest('profiles', `user_id=eq.${API.session.user.id}`, { method: 'PATCH', body }));
Object.assign(S.profile, body); renderApp(); toast('Einstellungen gespeichert');
}
if (f.id === 'f-pw') {
const a = $('#pw-new').value, b = $('#pw-new2').value;
if (a.length < 8 || !/[0-9]/.test(a)) { $('#pw-err').textContent = 'Mindestens 8 Zeichen mit mindestens einer Zahl.'; return; }
if (a !== b) { $('#pw-err').textContent = 'Die Passwörter stimmen nicht überein.'; return; }
await busy(btn, async () => {
await API.ensure();
const res = await fetch(`${SB_URL}/auth/v1/user`, { method: 'PUT', headers: API.headers(), body: JSON.stringify({ password: a }) });
if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.msg || d.message || 'Passwort konnte nicht geändert werden.'); }
});
closeSheet(); toast('Passwort geändert');
}
if (f.id === 'f-onb') {
readOnb(); const step = Number(f.dataset.step);
if (step === 1) { const inc = parseAmount(onb.income); if (onb.income && !(inc > 0)) { $('#o-err').textContent = 'Bitte gib einen gültigen Betrag ein oder lass das Feld leer.'; return; } onboardingSheet(2); return; }
if (step === 2) { onboardingSheet(3); return; }
const sv = onb.savings ? parseAmount(onb.savings) : 0;
if (Number.isNaN(sv) || sv < 0) { $('#o-err').textContent = 'Bitte gib einen gültigen Betrag ein.'; return; }
await busy(btn, async () => {
const rows = [];
const inc = parseAmount(onb.income); if (inc > 0) rows.push({ kind: 'in', name: 'Nettogehalt', amount: inc, category: 'gehalt', interval_months: 1 });
QUICK_FIX.forEach(([n, k], i) => { const v = parseAmount(onb.fix[i]); if (v > 0) rows.push({ kind: 'out', name: n, amount: v, category: k, interval_months: 1 }); });
if (rows.length) { const res = await API.rest('recurring', '', { method: 'POST', body: rows, prefer: 'return=representation' }); S.recurring.push(...res.map(normRec)); }
const body = { payday: onb.payday, savings_goal: sv, onboarded: true, updated_at: new Date().toISOString() };
await API.rest('profiles', `user_id=eq.${API.session.user.id}`, { method: 'PATCH', body }); Object.assign(S.profile, body);
});
closeSheet(); renderApp(); toast('Fertig eingerichtet!');
}
} catch (err) {
const m = err.message || 'Das hat nicht geklappt.';
const target = f.querySelector('.error'); if (target) target.textContent = m; else toast(m);
}
});
async function handleRecoveryHash() {
const h = new URLSearchParams(location.hash.slice(1));
if (h.get('type') === 'recovery' && h.get('access_token')) {
API.save({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires: Date.now() + Number(h.get('expires_in') || 3600) * 1000, user: null });
const res = await fetch(`${SB_URL}/auth/v1/user`, { headers: API.headers() }); const u = await res.json().catch(() => null);
if (u?.id) { API.session.user = u; API.save(API.session); }
history.replaceState(null, '', location.pathname);
return true;
}
return false;
}
async function boot() {
applyTheme();
API.load();
const recovery = await handleRecoveryHash().catch(() => false);
$('#boot').remove();
if (API.session?.user) {
try { await afterLogin(); if (recovery) pwSheet(); return; }
catch (e) { if (!API.session) { renderAuth('Bitte melde dich erneut an.'); return; } root().innerHTML = `<div class="paywall card"><h2>Keine Verbindung</h2><p class="muted">${esc(e.message)}</p><button class="btn primary" onclick="location.reload()">Erneut versuchen</button></div>`; return; }
}
renderAuth();
}
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
setInterval(() => { if (S.loaded && document.visibilityState === 'visible' && $('#sheet-wrap').hidden) { const d = todayISO(); if (d !== boot._day) { boot._day = d; renderApp(); } } }, 60000);
boot._day = todayISO();
boot();
