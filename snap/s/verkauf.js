// Shiftly – Verkauf: Startseite, Rechtstexte, Kündigungsbutton, Abo-Bereich, Inhaber-Einstellungen
let X; // Kontext aus app.js: { URL_, KEY, api, rpc, token, S, esc, toast, fe, render, sitzung }
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fe = (c) => ((c || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
export const APP_NAME = 'Shiftly';

export function init(ctx) { X = ctx; }

/* ---------------- Daten ---------------- */
let RECHT = null;
export async function ladeRecht(neu = false) {
  if (RECHT && !neu) return RECHT;
  try {
    const r = await fetch(`${X.URL_}/rest/v1/sz_rechtliches?select=daten,zahlung_aktiv,zahlung_modus`, { headers: { apikey: X.KEY, Authorization: `Bearer ${X.KEY}` } });
    const j = await r.json();
    RECHT = { d: j?.[0]?.daten || {}, zahlung: !!j?.[0]?.zahlung_aktiv, modus: j?.[0]?.zahlung_modus || null };
  } catch { RECHT = { d: {}, zahlung: false, modus: null }; }
  return RECHT;
}
let PREISE = null;
async function ladePreise() {
  if (PREISE) return PREISE;
  try {
    const r = await fetch(`${X.URL_}/rest/v1/sz_preisliste?select=schluessel,cent&order=sortierung`, { headers: { apikey: X.KEY, Authorization: `Bearer ${X.KEY}` } });
    const j = await r.json();
    PREISE = Object.fromEntries((j || []).map((p) => [p.schluessel, p.cent]));
  } catch { PREISE = { monat: 149, jahr: 1299 }; }
  return PREISE;
}
async function stripeFn(body) {
  const t = await X.token().catch(() => null);
  const r = await fetch(`${X.URL_}/functions/v1/sz-stripe`, { method: 'POST', headers: { apikey: X.KEY, Authorization: `Bearer ${t || X.KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Fehler ${r.status}`);
  return j;
}

/* ---------------- Platzhalter ---------------- */
const FELDER = [
  ['anbieter', 'Name des Anbieters (Vor- und Nachname bzw. Firma)', 'z. B. Max Mustermann'],
  ['zusatz', 'Zusatz / Geschäftsbezeichnung (optional)', 'z. B. Shiftly – Softwareentwicklung'],
  ['strasse', 'Straße und Hausnummer', ''],
  ['plz_ort', 'PLZ und Ort', ''],
  ['email', 'E-Mail-Adresse für Kunden', ''],
  ['telefon', 'Telefon (optional, empfohlen)', ''],
  ['ust', 'Umsatzsteuer', ''],
  ['ust_id', 'USt-IdNr. (nur wenn vorhanden)', 'DE…'],
  ['behoerde', 'Datenschutz-Aufsichtsbehörde', 'z. B. Der Hamburgische Beauftragte für Datenschutz und Informationsfreiheit'],
];
const P = (d, k, label) => (d[k] && String(d[k]).trim() ? esc(d[k]) : `<mark class="vk-luecke">[${esc(label || k)} fehlt]</mark>`);
export const rechtVollstaendig = (d) => ['anbieter', 'strasse', 'plz_ort', 'email', 'ust'].every((k) => d[k] && String(d[k]).trim());
const steuerSatz = (d) => (d.ust === 'klein' ? 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmer).' : d.ust === 'regel' ? 'Alle Preise enthalten die gesetzliche Umsatzsteuer.' : '<mark class="vk-luecke">[Angabe zur Umsatzsteuer fehlt]</mark>');
const anschrift = (d) => `${P(d, 'anbieter', 'Name')}${d.zusatz ? `<br>${esc(d.zusatz)}` : ''}<br>${P(d, 'strasse', 'Straße')}<br>${P(d, 'plz_ort', 'PLZ/Ort')}<br>Deutschland`;

/* ---------------- Rechtstexte ---------------- */
function impressum(d) {
  return `<h1>Impressum</h1>
  <h2>Angaben gemäß § 5 DDG</h2><p>${anschrift(d)}</p>
  <h2>Kontakt</h2><p>E-Mail: ${P(d, 'email', 'E-Mail')}${d.telefon ? `<br>Telefon: ${esc(d.telefon)}` : ''}</p>
  ${d.ust === 'regel' && d.ust_id ? `<h2>Umsatzsteuer-ID</h2><p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${esc(d.ust_id)}</p>` : ''}
  ${d.ust === 'klein' ? '<h2>Umsatzsteuer</h2><p>Kleinunternehmer gemäß § 19 UStG – es wird keine Umsatzsteuer ausgewiesen.</p>' : ''}
  <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2><p>${P(d, 'anbieter', 'Name')}, Anschrift wie oben</p>
  <h2>Verbraucherstreitbeilegung</h2><p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>`;
}

function datenschutz(d) {
  return `<h1>Datenschutzerklärung</h1>
  <p class="hinweis">Stand: ${new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</p>
  <h2>1. Verantwortlicher</h2><p>${anschrift(d)}<br>E-Mail: ${P(d, 'email', 'E-Mail')}</p>
  <h2>2. Welche Daten wir verarbeiten</h2>
  <ul>
    <li><b>Konto:</b> Name, E-Mail-Adresse, Passwort (nur verschlüsselt gespeichert).</li>
    <li><b>Deine Eingaben:</b> Schichten, Urlaub, Krankheitstage, Wünsche, Kürzel, Personalnummer, Firma, Objekt, Stundenlohn, Zuschläge, Haushaltsbuchungen, Fixkosten und Budgets sowie freiwillige Angaben für die Netto-Berechnung (Steuerklasse, Kinderfreibeträge, Krankenkassen-Zusatzbeitrag, Kirchensteuerpflicht), Einstellungen, Feedback und ein optionales Firmenlogo.</li>
    <li><b>E-Mail-Neuigkeiten (freiwillig):</b> Wenn du zustimmst, speichern wir deine E-Mail-Adresse, den Zeitpunkt und den Wortlaut deiner Einwilligung, um dir Angebote und Neuigkeiten zu Shiftly und neuen Apps zu schicken. Die Anmeldung wird erst wirksam, wenn du den Link in unserer Bestätigungs-E-Mail anklickst (Double-Opt-in).</li>
    <li><b>Nutzungsprotokoll:</b> Zeitpunkte von Registrierung, Anmeldung und Abmeldung sowie Abo-Vorgänge.</li>
    <li><b>Aktivität in der App:</b> Letzter Kontakt und zuletzt genutzter Bereich sowie Bereichsnutzung in Stundenblöcken. Der Administrator kann diese Angaben zur Betreuung und Verbesserung der App nach Nutzernamen einsehen. Inhalte von Eingaben werden dabei nicht protokolliert.</li>
    <li><b>Zahlung:</b> Bei einem Abo verarbeitet Stripe deine Zahlungsdaten. Wir erhalten nur den Zahlungsstatus und eine Kundennummer, keine Karten- oder Kontodaten.</li>
    <li><b>Technische Daten:</b> Beim Aufruf der App werden IP-Adresse, Datum/Uhrzeit und Browserangaben in Server-Protokollen des Hosters verarbeitet.</li>
  </ul>
  <h2>3. Zwecke und Rechtsgrundlagen</h2>
  <ul>
    <li>Bereitstellung der App, deines Kontos und des Abos: Art. 6 Abs. 1 lit. b DSGVO (Vertrag).</li>
    <li>Angebote und Neuigkeiten per E-Mail: nur mit deiner Einwilligung, Art. 6 Abs. 1 lit. a DSGVO und § 7 Abs. 2 UWG. Du kannst sie jederzeit widerrufen – über den Abmeldelink in jeder E-Mail oder unter „Konto &amp; Tarif“. Den Nachweis der Einwilligung bewahren wir auf (Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit Art. 7 Abs. 1 DSGVO).</li>
    <li>Sicherheit, Missbrauchsschutz, Nutzungsprotokoll und sparsame Auswertung der App-Bereiche zur Verbesserung der App: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb und der Verbesserung der App).</li>
    <li>Aufbewahrung von Rechnungs- und Zahlungsunterlagen: Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit § 147 AO und § 257 HGB.</li>
    <li>Die Angabe zur <b>Kirchensteuerpflicht</b> lässt Rückschlüsse auf die Religionszugehörigkeit zu. Sie ist freiwillig und wird nur für die Netto-Berechnung verwendet. Wenn du sie machst, willigst du nach Art. 9 Abs. 2 lit. a DSGVO ein. Du kannst die Einwilligung jederzeit widerrufen, indem du den Haken entfernst und speicherst.</li>
  </ul>
  <h2>4. Empfänger und Dienstleister</h2>
  <ul>
    <li><b>Supabase</b> (Datenbank und Anmeldung): Deine Daten werden auf Servern in Frankfurt am Main (EU) gespeichert. Mit Supabase besteht ein Vertrag zur Auftragsverarbeitung. Datenschutz: supabase.com/privacy</li>
    <li><b>Netlify</b> (Auslieferung der App-Dateien, Server-Protokolle): Netlify, Inc., USA. Die Übermittlung erfolgt auf Grundlage des EU-US Data Privacy Framework bzw. von EU-Standardvertragsklauseln. Datenschutz: netlify.com/privacy</li>
    <li><b>Stripe</b> (Zahlungsabwicklung): Stripe Payments Europe, Ltd., Irland. Stripe verarbeitet die Zahlungsdaten in eigener Verantwortung. Datenschutz: stripe.com/de/privacy</li>
    <li><b>Brevo</b> (Versand der E-Mail-Neuigkeiten, nur wenn du zugestimmt hast): Sendinblue GmbH, Berlin. Mit Brevo besteht ein Vertrag zur Auftragsverarbeitung. Datenschutz: brevo.com/de/legal/privacypolicy</li>
    <li><b>Cloudflare (cdnjs) und jsDelivr</b>: Nur wenn du ein PDF erstellst, lädt die App dafür eine Programmbibliothek von diesen Diensten. Dabei wird deine IP-Adresse übertragen (Art. 6 Abs. 1 lit. f DSGVO).</li>
  </ul>
  <h2>5. Speicherung im Browser</h2><p>Damit du angemeldet bleibst, speichert die App eine Anmeldesitzung im lokalen Speicher deines Browsers. Das ist für die Nutzung unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Es gibt keine Werbe- oder Analyse-Cookies. Die oben beschriebene begrenzte Bereichsnutzung wird bei angemeldeten Nutzern erfasst.</p>
  <h2>6. Speicherdauer</h2><p>Bereichsprotokolle werden nach 30 Tagen gelöscht. Deine übrigen Daten bleiben gespeichert, bis du dein Konto löschst („Konto &amp; Tarif“ → „Konto löschen“). Dann werden Konto, Dienstplan, Urlaub, Haushaltsbuch und Profil gelöscht. Unterlagen, die wir gesetzlich aufbewahren müssen (z. B. Rechnungen), werden bis zum Ablauf der Frist aufbewahrt.</p>
  <h2>Standort und Wetter</h2><p>Nach deiner Standortfreigabe fragt Shiftly den aktuellen Geräteort ab. Gerundete Koordinaten werden direkt vom Browser an Bright Sky (Wetterdaten) und BigDataCloud (Ortsnamen) übertragen. Dabei erhalten diese Dienste auch deine IP-Adresse. Der Standort wird nicht im Benutzerkonto gespeichert; es wird kein Bewegungsverlauf angelegt. Du kannst die Freigabe in deinen Browser- oder Handy-Einstellungen widerrufen. Informationen der Anbieter: <a href="https://brightsky.dev" target="_blank" rel="noopener">Bright Sky</a> und <a href="https://www.bigdatacloud.com/privacy" target="_blank" rel="noopener">BigDataCloud</a>.</p>
  <h2>7. Deine Rechte</h2><p>Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO). Schreib dazu an ${P(d, 'email', 'E-Mail')}. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren, z. B. bei: ${P(d, 'behoerde', 'Aufsichtsbehörde')}.</p>
  <h2>8. Pflicht zur Bereitstellung</h2><p>Name, E-Mail und Passwort brauchen wir für das Konto. Alle anderen Angaben sind freiwillig; ohne sie sind einzelne Berechnungen nicht möglich.</p>`;
}

function agb(d, pr) {
  return `<h1>Allgemeine Geschäftsbedingungen</h1>
  <h2>§ 1 Geltungsbereich, Anbieter</h2><p>Diese AGB gelten für die Nutzung der Web-App „Shiftly“ (nachfolgend „App“). Anbieter ist ${P(d, 'anbieter', 'Name')}, ${P(d, 'strasse', 'Straße')}, ${P(d, 'plz_ort', 'PLZ/Ort')}, E-Mail: ${P(d, 'email', 'E-Mail')}.</p>
  <h2>§ 2 Leistung</h2><p>Die App ist ein digitaler Stundenzettel für Schichtarbeit. Sie berechnet Tag-, Nacht-, Sonntags- und Feiertagsstunden, Zuschläge, Urlaub, Krankheit, eine Netto-Schätzung und erstellt PDF-Dokumente. Alle Berechnungen sind Hilfsmittel und ersetzen keine Lohnabrechnung, Steuer- oder Rechtsberatung. Maßgeblich sind die Abrechnung deines Arbeitgebers, dein Arbeitsvertrag und der jeweils gültige Tarifvertrag. Hinterlegte Tarifwerte geben den angegebenen Stand wieder.</p>
  <h2>§ 3 Vertragsschluss und Testzeitraum</h2><p>Mit der Registrierung entsteht ein kostenloser Nutzungsvertrag mit einem Testzeitraum von 10 Tagen. Der Test endet automatisch und kostenlos; danach kannst du deine Daten weiter ansehen und als PDF speichern, aber keine neuen Einträge anlegen. Ein kostenpflichtiges Abo kommt zustande, wenn du im Bereich „Abo“ einen Tarif wählst, den Bedingungen zustimmst, auf „Zahlungspflichtig abonnieren“ tippst und die Zahlung bei unserem Zahlungsdienstleister Stripe abschließt.</p>
  <h2>§ 4 Preise und Zahlung</h2><p>Es gelten die bei der Bestellung angezeigten Preise (derzeit ${fe(pr.monat)} im Monat bzw. ${fe(pr.jahr)} im Jahr). ${steuerSatz(d)} Der Betrag wird zu Beginn jedes Abrechnungszeitraums im Voraus über Stripe eingezogen.</p>
  <h2>§ 5 Laufzeit und Kündigung</h2><p><b>Monatsabo:</b> Laufzeit ein Monat; es verlängert sich jeweils um einen weiteren Monat, wenn es nicht vorher gekündigt wird. Kündigung jederzeit zum Ende des laufenden Monats.</p>
  <p><b>Jahresabo:</b> Erstlaufzeit zwölf Monate. Danach läuft es auf unbestimmte Zeit weiter und kann jederzeit mit einer Frist von einem Monat gekündigt werden. Wurde für den Zeitraum nach Wirksamwerden der Kündigung bereits im Voraus bezahlt, erstatten wir den nicht verbrauchten Anteil.</p>
  <p>Kündigen kannst du über „Konto &amp; Tarif“ → „Abo verwalten“, über den Knopf „Verträge hier kündigen“ oder per E-Mail. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.</p>
  <h2>§ 6 Pflichten der Nutzer</h2><p>Halte deine Zugangsdaten geheim. Prüfe die Ergebnisse vor der Weitergabe an Arbeitgeber oder Behörden auf Richtigkeit.</p>
  <h2>§ 7 Verfügbarkeit</h2><p>Wir bemühen uns um eine möglichst unterbrechungsfreie Verfügbarkeit. Wartungen, Störungen bei Dienstleistern oder höhere Gewalt können zu Ausfällen führen. Erstelle regelmäßig PDFs deiner Stundenzettel als Sicherung.</p>
  <h2>§ 8 Haftung</h2><p>Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit sowie nach dem Produkthaftungsgesetz. Bei leichter Fahrlässigkeit haften wir nur bei Verletzung einer wesentlichen Vertragspflicht, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung du regelmäßig vertrauen darfst, und zwar begrenzt auf den vertragstypischen, vorhersehbaren Schaden.</p>
  <h2>§ 9 Daten nach Vertragsende</h2><p>Du kannst dein Konto jederzeit löschen. Nach Ende eines Abos bleibt dein Konto mit Lesezugriff bestehen, bis du es löschst.</p>
  <h2>§ 10 Änderungen</h2><p>Änderungen dieser AGB oder der Preise für bestehende Abos teilen wir dir mindestens sechs Wochen vorher mit. Sie gelten nur, wenn du ausdrücklich zustimmst; stimmst du nicht zu, kannst du zum Änderungszeitpunkt kündigen.</p>
  <h2>§ 11 Schlussbestimmungen</h2><p>Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Bist du Verbraucher, bleiben zwingende Vorschriften des Staates, in dem du deinen gewöhnlichen Aufenthalt hast, unberührt.</p>`;
}

function widerruf(d) {
  return `<h1>Widerrufsbelehrung</h1>
  <h2>Widerrufsrecht</h2><p>Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.</p>
  <p>Um dein Widerrufsrecht auszuüben, musst du uns (${P(d, 'anbieter', 'Name')}, ${P(d, 'strasse', 'Straße')}, ${P(d, 'plz_ort', 'PLZ/Ort')}, E-Mail: ${P(d, 'email', 'E-Mail')}${d.telefon ? `, Telefon: ${esc(d.telefon)}` : ''}) mittels einer eindeutigen Erklärung (z. B. eine E-Mail oder ein mit der Post versandter Brief) über deinen Entschluss, diesen Vertrag zu widerrufen, informieren. Du kannst dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.</p>
  <p>Zur Wahrung der Widerrufsfrist reicht es aus, dass du die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absendest.</p>
  <h2>Folgen des Widerrufs</h2><p>Wenn du diesen Vertrag widerrufst, haben wir dir alle Zahlungen, die wir von dir erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über deinen Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das du bei der ursprünglichen Transaktion eingesetzt hast, es sei denn, mit dir wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden dir wegen dieser Rückzahlung Entgelte berechnet.</p>
  <p>Hast du verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen sollen, so hast du uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem du uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichtest, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.</p>
  <h2>Muster-Widerrufsformular</h2>
  <p>(Wenn du den Vertrag widerrufen willst, dann fülle bitte dieses Formular aus und sende es zurück.)</p>
  <p>An ${P(d, 'anbieter', 'Name')}, ${P(d, 'strasse', 'Straße')}, ${P(d, 'plz_ort', 'PLZ/Ort')}, E-Mail: ${P(d, 'email', 'E-Mail')}:</p>
  <p>Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung (*): Shiftly-Abo<br>
  Bestellt am (*) / erhalten am (*): ______________<br>Name des/der Verbraucher(s): ______________<br>Anschrift des/der Verbraucher(s): ______________<br>
  Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier): ______________<br>Datum: ______________<br>(*) Unzutreffendes streichen.</p>`;
}

/* ---------------- Seiten-Anzeige ---------------- */
export const SEITEN = { impressum: 'Impressum', datenschutz: 'Datenschutz', agb: 'AGB', widerruf: 'Widerrufsbelehrung', kuendigen: 'Verträge hier kündigen' };
export const fussLinks = () => `<nav class="vk-fuss">${Object.entries(SEITEN).map(([k, t]) => `<a href="#${k}" data-seite="${k}"${k === 'kuendigen' ? ' class="vk-kuend"' : ''}>${t}</a>`).join('')}</nav>`;
export function bindeFuss(root = document) { $$('[data-seite]', root).forEach((a) => { a.onclick = (e) => { e.preventDefault(); zeigeSeite(a.dataset.seite); }; }); }

export async function zeigeSeite(name) {
  if (!SEITEN[name]) return;
  const d = (await ladeRecht()).d, pr = await ladePreise();
  $('.vk-seite')?.remove();
  const w = document.createElement('div');
  w.className = 'modal vk-seite';
  const inhalt = name === 'impressum' ? impressum(d) : name === 'datenschutz' ? datenschutz(d) : name === 'agb' ? agb(d, pr) : name === 'widerruf' ? widerruf(d) : kuendigenHtml();
  w.innerHTML = `<div class="modal-kopf"><b>${SEITEN[name]}</b><div class="reihe">${name !== 'kuendigen' ? '<button class="btn" id="vk-druck">Drucken</button>' : ''}<button class="btn" id="vk-zu">Schließen</button></div></div>
    <div class="modal-inhalt"><article class="vk-text card">${inhalt}</article>${fussLinks()}</div>`;
  document.body.appendChild(w);
  document.body.classList.add('modal-offen');
  if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
  const zu = () => { w.remove(); document.body.classList.remove('modal-offen'); history.replaceState(null, '', location.pathname + location.search); };
  $('#vk-zu', w).onclick = zu;
  if ($('#vk-druck', w)) $('#vk-druck', w).onclick = () => window.print();
  bindeFuss(w);
  if (name === 'kuendigen') bindeKuendigen(w);
  $('.modal-inhalt', w).scrollTop = 0;
}

function kuendigenHtml() {
  const u = X.sitzung?.();
  const name = X.S?.profil?.name || '';
  return `<h1>Verträge hier kündigen</h1>
  <p>Hier kannst du dein Shiftly-Abo kündigen. Du brauchst dich dafür nicht anzumelden.</p>
  <form id="vk-kf" class="vk-form" novalidate>
    <label>Vor- und Nachname *<input id="vk-name" autocomplete="name" maxlength="120" value="${esc(name)}" required></label>
    <label>E-Mail-Adresse deines Shiftly-Kontos *<input id="vk-mail" type="email" autocomplete="email" maxlength="254" value="${esc(u?.user?.email && !u.user.email.endsWith('.netlify.app') ? u.user.email : '')}" ${u ? 'readonly' : ''} required></label>
    <label>Welcher Vertrag?<select id="vk-vertrag"><option>Shiftly Monatsabo</option><option>Shiftly Jahresabo</option><option>Weiß ich nicht</option></select></label>
    <label>Art der Kündigung<select id="vk-art"><option value="ordentlich">Ordentliche Kündigung</option><option value="ausserordentlich">Außerordentliche Kündigung</option></select></label>
    <label id="vk-grund-l" hidden>Kündigungsgrund<textarea id="vk-grund" rows="3" maxlength="500"></textarea></label>
    <label>Zeitpunkt<select id="vk-zeit"><option>Zum nächstmöglichen Zeitpunkt</option></select></label>
    <p class="fehler" id="vk-fehler" hidden></p>
    <button class="btn pri vk-gross" type="submit">Jetzt kündigen</button>
  </form>
  <div id="vk-bestaetigung" hidden></div>`;
}
function bindeKuendigen(w) {
  const f = $('#vk-kf', w);
  $('#vk-art', w).onchange = (e) => { $('#vk-grund-l', w).hidden = e.target.value !== 'ausserordentlich'; };
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const fehler = $('#vk-fehler', w); fehler.hidden = true;
    const name = $('#vk-name', w).value.trim(), mail = $('#vk-mail', w).value.trim();
    if (!name) { fehler.textContent = 'Bitte gib deinen Namen an.'; fehler.hidden = false; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail) && !X.sitzung?.()) { fehler.textContent = 'Bitte gib die E-Mail-Adresse deines Kontos an.'; fehler.hidden = false; return; }
    const knopf = $('button[type=submit]', f); knopf.disabled = true; knopf.textContent = 'Wird gesendet …';
    try {
      const vertrag = $('#vk-vertrag', w).value, art = $('#vk-art', w).value;
      const r = await stripeFn({ aktion: 'kuendigen', name, email: mail, vertrag: vertrag + ($('#vk-grund', w).value.trim() ? ` – Grund: ${$('#vk-grund', w).value.trim()}` : ''), art });
      const zeit = new Date(r.zeit).toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' });
      f.hidden = true;
      const b = $('#vk-bestaetigung', w); b.hidden = false;
      b.innerHTML = `<div class="banner info"><b>Deine Kündigung ist eingegangen.</b></div>
        <h2>Eingangsbestätigung</h2>
        <p>Eingegangen am: <b>${zeit}</b><br>Name: ${esc(name)}<br>E-Mail: ${esc(mail)}<br>Vertrag: ${esc(vertrag)}<br>Art: ${art === 'ausserordentlich' ? 'außerordentliche' : 'ordentliche'} Kündigung zum nächstmöglichen Zeitpunkt
        ${r.wirksam_zum ? `<br>Wirksam zum: <b>${new Date(r.wirksam_zum).toLocaleDateString('de-DE')}</b> – bis dahin kannst du Shiftly weiter nutzen.` : ''}</p>
        <p class="hinweis">Speichere oder drucke diese Bestätigung. Die Kündigung wird außerdem per E-Mail bestätigt.</p>
        <button class="btn" id="vk-bdruck">Bestätigung drucken / als PDF speichern</button>`;
      $('#vk-bdruck', w).onclick = () => window.print();
    } catch (e) { fehler.textContent = e.message; fehler.hidden = false; knopf.disabled = false; knopf.textContent = 'Jetzt kündigen'; }
  };
}

/* ---------------- Startseite (vor dem Login) ---------------- */
export async function startseite(formularHtml) {
  const pr = await ladePreise(), d = (await ladeRecht()).d;
  const spar = pr.monat ? Math.round((1 - pr.jahr / (pr.monat * 12)) * 100) : 0;
  const F = [
    ['▦','Schichten & Lohn','Dienstplan per Kürzel, Stunden, Zuschläge und Netto-Schätzung.'],
    ['☀','Urlaub & Kalender','Anträge, Urlaubskonto und Kalender automatisch verbunden.'],
    ['€','Groschen inklusive','Ausgaben direkt eintragen und dein tägliches Budget sehen.'],
    ['◷','Dein Dashboard','Wetter, nächste Schichten und einklappbare Übersichten.'],
    ['⌂','Objekte & Wünsche','Eigene Tarife je Einsatzort und dein Wunschdienstplan.'],
    ['↧','PDF & Feiertage','Stundenzettel zum Abgeben und regionale Feiertagsberechnung.'],
  ];
  return `<div class="vk-start">
    <div class="vk-kopfzeile"><div class="vk-marke"><img src="icons/hamburg-werkschutz-192.png" alt=""><span>Shiftly</span></div><a href="#anmelden" class="vk-anmelden" id="vk-zum-login">Anmelden</a></div>
    <header class="vk-held">
      <div class="vk-hero-copy"><span class="vk-eyebrow">Für deinen Alltag im Schichtdienst</span>
      <h1>Dein Dienstplan.<br>Dein Leben.<br><em>Alles im Blick.</em></h1>
      <p>Schichten planen, Urlaub verwalten und dein Geld im Blick behalten. Alles zusammen in Shiftly.</p>
      <a href="#anmelden" class="btn pri vk-gross" id="vk-los">10 Tage kostenlos testen <span aria-hidden="true">→</span></a>
      <a href="#anmelden" class="vk-secondary">Ich habe schon ein Konto</a>
      <p class="vk-klein">Keine Zahlungsdaten nötig. Der Test endet automatisch.</p></div>
      <div class="vk-photo" role="img" aria-label="Hamburger Hafen mit Sicherheitsmitarbeitern, KI-generiertes Motiv"><span>Dienstplan · Urlaub · Finanzen</span></div>
    </header>
    <section class="vk-benefits"><h2>Eine App, die mitdenkt.</h2><div class="vk-features">${F.map(([i,t,x])=>`<div class="card"><span class="vk-feature-icon" aria-hidden="true">${i}</span><div><b>${t}</b><p>${x}</p></div></div>`).join('')}</div></section>
    <section class="vk-preview"><div><span class="vk-eyebrow">Beispielansicht</span><h2>So übersichtlich<br>kann dein Tag sein.</h2><p>Nur das aufklappen, was du gerade brauchst. Deine Karten stellst du dir selbst zusammen.</p></div>
      <div class="vk-demo"><span>DEIN PERSÖNLICHER MONATSBLICK</span><h3>Moin! Schön, dass du da bist.</h3><div class="vk-demo-row"><b>Nächste Schicht</b><span>Morgen · 06:00–18:00</span></div><div class="vk-demo-grid"><div><span>Heute verfügbar</span><b>16,80 €</b></div><div><span>Resturlaub</span><b>12 Tage</b></div></div><div class="vk-demo-action">＋ Ausgabe eintragen</div><p class="vk-klein">Beispieldaten, keine persönlichen Kontodaten.</p></div>
    </section>
    <section class="vk-preise">
      <h2>Preise</h2>
      <div class="preise">
        <div class="preis"><div>Monatsabo</div><div class="betrag"><span data-aktion-preis="monat">${fe(pr.monat)}</span></div><div class="hinweis" style="margin:0">monatlich kündbar</div></div>
        <div class="preis"><div>Jahresabo</div><div class="betrag"><span data-aktion-preis="jahr">${fe(pr.jahr)}</span></div><div class="hinweis" style="margin:0">entspricht ${fe(Math.round(pr.jahr / 12))} im Monat${spar > 0 ? ` · ${spar} % günstiger` : ''}</div></div>
      </div>
      <p class="hinweis">${steuerSatz(d).replace(/<mark[^>]*>.*?<\/mark>/, '')} Erst nach dem Test entscheidest du, ob du ein Abo abschließt.</p>
    </section>
    <section class="vk-login" id="anmelden">${formularHtml}</section>
    <section class="vk-faq card">
      <h2>Häufige Fragen</h2>
      <details><summary>Muss ich etwas installieren?</summary><p>Nein. Shiftly läuft im Browser. Auf dem Handy kannst du es über „Zum Startbildschirm hinzufügen“ wie eine App ablegen.</p></details>
      <details><summary>Stimmen die Tarifwerte?</summary><p>Für den Sicherheitsdienst sind die aktuellen Tariflöhne und Zuschläge der Bundesländer hinterlegt. Deinen eigenen Lohn und eigene Zuschläge kannst du jederzeit selbst eintragen.</p></details>
      <details><summary>Was passiert nach dem Test?</summary><p>Du kannst alles weiter ansehen und als PDF speichern. Neue Einträge gehen mit einem Abo. Es entstehen keine Kosten, wenn du nichts abschließt.</p></details>
      <details><summary>Wie kündige ich?</summary><p>Jederzeit in der App unter „Konto &amp; Tarif“ oder ohne Anmeldung über „Verträge hier kündigen“ unten auf dieser Seite.</p></details>
    </section>
    ${fussLinks()}
  </div>`;
}

/* ---------------- Abo-Bereich im Konto ---------------- */
export async function aboHtml(z) {
  const r = await ladeRecht(), pr = await ladePreise();
  const stripeAbo = z.stripe && z.status === 'active' && (z.plan === 'monat' || z.plan === 'jahr');
  const kuend = z.kuendigung_zum ? `<p class="banner warn" style="margin:10px 0 0">Gekündigt zum ${new Date(z.kuendigung_zum).toLocaleDateString('de-DE')}. Bis dahin hast du vollen Zugriff.</p>` : '';
  let inhalt;
  if (z.admin) inhalt = '<p class="hinweis">Inhaber-Konto: dauerhaft kostenlos.</p>';
  else if (stripeAbo) inhalt = `<p class="hinweis">Du hast vollen Zugriff.</p>${kuend}
      <div class="reihe" style="margin-top:12px"><button class="btn pri" id="vk-portal">Abo verwalten (Zahlungsart, Rechnungen, Kündigung)</button></div>`;
  else if (z.status === 'active' && z.plan !== 'aktion') inhalt = '<p class="hinweis">Du hast vollen Zugriff.</p>';
  else if (!r.zahlung || !rechtVollstaendig(r.d)) inhalt = `<div class="preise">
        <div class="preis"><div>Monatsabo</div><div class="betrag"><span data-aktion-preis="monat">${fe(pr.monat)}</span></div><div class="hinweis" style="margin:0">monatlich kündbar</div><button class="btn pri kauf" data-plan="monat">Monatsabo anfragen</button></div>
        <div class="preis"><div>Jahresabo</div><div class="betrag"><span data-aktion-preis="jahr">${fe(pr.jahr)}</span></div><div class="hinweis" style="margin:0">entspricht <span data-aktion-preis="jahr/12" data-aktion-ohne-tag>${fe(Math.round(pr.jahr / 12))}</span> im Monat</div><button class="btn pri kauf" data-plan="jahr">Jahresabo anfragen</button></div>
      </div><p class="hinweis">Die Online-Bezahlung wird gerade eingerichtet. Nach deiner Anfrage wirst du innerhalb von 24 Stunden freigeschaltet.</p>`;
  else inhalt = `<div class="vk-tarife" role="radiogroup" aria-label="Tarif wählen">
        <label class="preis vk-tarif"><input type="radio" name="vk-plan" value="monat" checked><div>Monatsabo</div><div class="betrag"><span data-aktion-preis="monat">${fe(pr.monat)}</span></div><div class="hinweis" style="margin:0">pro Monat · verlängert sich monatlich · jederzeit zum Monatsende kündbar</div></label>
        <label class="preis vk-tarif"><input type="radio" name="vk-plan" value="jahr"><div>Jahresabo</div><div class="betrag"><span data-aktion-preis="jahr">${fe(pr.jahr)}</span></div><div class="hinweis" style="margin:0">pro Jahr · 12 Monate Laufzeit, danach monatlich kündbar</div></label>
      </div>
      <p class="hinweis">${steuerSatz(r.d)} Bezahlung sicher über Stripe (Karte, PayPal, Apple Pay, Google Pay, SEPA – je nach Freischaltung). Der Zugang wird direkt nach der Zahlung freigeschaltet.</p>
      <label class="check"><input type="checkbox" id="vk-ok"> <span>Ich akzeptiere die <a href="#agb" data-seite="agb">AGB</a> und habe die <a href="#widerruf" data-seite="widerruf">Widerrufsbelehrung</a> gelesen. Ich verlange ausdrücklich, dass Shiftly sofort nach der Zahlung freigeschaltet wird. Mir ist bekannt, dass ich bei einem Widerruf einen anteiligen Betrag für die bis dahin genutzte Zeit zahlen muss.</span></label>
      <div class="reihe" style="margin-top:12px"><button class="btn pri vk-gross" id="vk-kaufen">Zahlungspflichtig abonnieren</button></div>
      ${r.modus === 'test' ? '<p class="banner warn" style="margin-top:10px">Testmodus: Es wird kein echtes Geld abgebucht (Testkarte 4242 4242 4242 4242).</p>' : ''}`;
  return `<section class="card" id="abo">
      <h2>Abo</h2>
      <p style="margin-top:0">Dein Status: ${X.zugangText()}</p>
      ${inhalt}
      <p class="hinweis" style="margin-top:14px"><a href="#kuendigen" data-seite="kuendigen" class="vk-kuend">Verträge hier kündigen</a></p>
    </section>`;
}
export function bindeAbo(root = document) {
  bindeFuss(root);
  $$('.kauf', root).forEach((k) => { k.onclick = async () => {
    try { await X.rpc('sz_request_subscription', { p_plan: k.dataset.plan }); X.toast('Anfrage gesendet – du wirst in Kürze freigeschaltet.'); k.disabled = true; k.textContent = 'Anfrage gesendet'; }
    catch (e) { X.toast(e.message); } }; });
  if ($('#vk-kaufen', root)) $('#vk-kaufen', root).onclick = async (ev) => {
    if (!$('#vk-ok', root).checked) { X.toast('Bitte bestätige zuerst AGB und Widerrufsbelehrung.'); $('#vk-ok', root).focus(); return; }
    const plan = $('input[name=vk-plan]:checked', root)?.value || 'monat';
    const b = ev.target; b.disabled = true; const alt = b.textContent; b.textContent = 'Weiter zu Stripe …';
    try { const r = await stripeFn({ aktion: 'checkout', plan, zustimmung: true }); location.href = r.url; }
    catch (e) { X.toast(e.message); b.disabled = false; b.textContent = alt; }
  };
  if ($('#vk-portal', root)) $('#vk-portal', root).onclick = async (ev) => {
    const b = ev.target; b.disabled = true;
    try { const r = await stripeFn({ aktion: 'portal' }); location.href = r.url; }
    catch (e) { X.toast(e.message); b.disabled = false; }
  };
}

// Rückkehr von Stripe: Freischaltung abwarten
export async function nachZahlung() {
  const q = new URLSearchParams(location.search);
  const abo = q.get('abo'); if (!abo) return;
  history.replaceState(null, '', location.pathname + location.hash);
  if (abo === 'abbruch') { X.toast('Bezahlung abgebrochen – es wurde nichts abgebucht.'); return; }
  X.toast('Danke! Dein Abo wird freigeschaltet …');
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    try { const z = await X.rpc('sz_ensure_access'); if (z.status === 'active' && z.stripe) { X.S.zugang = z; X.render(); X.toast('Dein Abo ist aktiv. Viel Spaß mit Shiftly!'); return; } } catch { /* weiter warten */ }
  }
  X.toast('Die Zahlung ist angekommen, die Freischaltung dauert noch einen Moment. Bitte lade die Seite gleich neu.');
}

/* ---------------- Inhaber: Verkauf einrichten ---------------- */
export async function inhaberHtml(st) {
  const r = await ladeRecht(true);
  let status = { verbunden: false, modus: null };
  try { status = await stripeFn({ aktion: 'status' }); } catch { /* egal */ }
  const d = r.d;
  const fehlt = FELDER.filter(([k]) => ['anbieter', 'strasse', 'plz_ort', 'email', 'ust'].includes(k) && !(d[k] && String(d[k]).trim()));
  return `<section class="card" id="vk-inhaber">
      <h2>Verkauf einrichten</h2>
      <div class="vk-check">
        <div>${status.verbunden ? '✅' : '⬜'} Stripe verbunden${status.verbunden ? ` (${status.modus === 'test' ? 'Testmodus' : 'Live – echte Zahlungen'})` : ''}</div>
        <div>${fehlt.length ? '⬜' : '✅'} Rechtliche Angaben vollständig${fehlt.length ? ` – fehlt: ${fehlt.map((f) => f[1].split(' (')[0]).join(', ')}` : ''}</div>
      </div>
      <h3>1. Stripe verbinden</h3>
      <p class="hinweis">Im Stripe-Dashboard unter „Entwickler → API-Schlüssel“ den <b>geheimen Schlüssel</b> kopieren (beginnt mit <code>sk_test_</code> zum Testen oder <code>sk_live_</code> für echte Zahlungen) und hier einfügen. Webhook und Kundenportal richtet die App selbst ein. Der Schlüssel wird nur auf dem Server gespeichert.</p>
      <div class="reihe"><label style="flex:1 1 260px">Geheimer Stripe-Schlüssel<input id="vk-key" type="password" autocomplete="off" placeholder="${status.verbunden ? '•••••••• (hinterlegt)' : 'sk_live_…'}"></label>
        <button class="btn pri" id="vk-verbinden">${status.verbunden ? 'Schlüssel ersetzen' : 'Verbinden'}</button>${status.verbunden ? '<button class="btn rot" id="vk-trennen">Trennen</button>' : ''}</div>
      <h3>2. Rechtliche Angaben</h3>
      <p class="hinweis">Diese Angaben erscheinen in Impressum, Datenschutzerklärung, AGB und Widerrufsbelehrung. Pflicht beim Verkauf: echter Name und ladungsfähige Anschrift (kein Postfach).</p>
      <div class="raster">
        ${FELDER.map(([k, l, ph]) => k === 'ust'
          ? `<label>${l}<select id="vk-f-ust"><option value="">bitte wählen …</option><option value="klein" ${d.ust === 'klein' ? 'selected' : ''}>Kleinunternehmer (§ 19 UStG) – ohne USt.</option><option value="regel" ${d.ust === 'regel' ? 'selected' : ''}>Regelbesteuert – Preise inkl. USt.</option></select></label>`
          : `<label>${l}<input id="vk-f-${k}" value="${esc(d[k] || '')}" placeholder="${esc(ph)}" maxlength="200"></label>`).join('')}
      </div>
      <div class="reihe" style="margin-top:12px"><button class="btn pri" id="vk-recht-speichern">Angaben speichern</button>${Object.keys(SEITEN).map((k) => `<a href="#${k}" data-seite="${k}" class="btn klein">${SEITEN[k]}</a>`).join('')}</div>
      <p class="hinweis">Die Texte sind sorgfältige Vorlagen, aber keine Rechtsberatung. Lass sie vor dem Start einmal prüfen (z. B. IT-Recht-Kanzlei, Händlerbund oder eRecht24).</p>
    </section>
    <section class="card">
      <h2>Kündigungen</h2>
      ${st.kuendigungen?.length ? st.kuendigungen.map((k) => `<div class="ev"><span><b>${esc(k.name)}</b> · ${esc(k.email)} · ${esc(k.vertrag)}<br><small>${esc(k.ergebnis)}${k.wirksam_zum ? ' · wirksam zum ' + new Date(k.wirksam_zum).toLocaleDateString('de-DE') : ''}</small></span><span>${new Date(k.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</span></div>`).join('') : '<p class="hinweis">Noch keine Kündigungen.</p>'}
      <p class="hinweis">Wichtig: Jede Kündigung musst du dem Kunden per E-Mail bestätigen (§ 312k BGB). Bei „kein Stripe-Abo“ bitte den Zugang oben von Hand anpassen.</p>
    </section>`;
}
export function bindeInhaber(root, neuLaden) {
  bindeFuss(root);
  $('#vk-verbinden', root).onclick = async (ev) => {
    const key = $('#vk-key', root).value.trim();
    if (!key) { X.toast('Bitte zuerst den geheimen Schlüssel einfügen.'); return; }
    const b = ev.target; b.disabled = true; b.textContent = 'Wird geprüft …';
    try { const r = await stripeFn({ aktion: 'setup', key }); RECHT = null; X.toast(`Stripe verbunden (${r.modus === 'test' ? 'Testmodus' : 'Live'}).`); neuLaden(); }
    catch (e) { X.toast(e.message); b.disabled = false; b.textContent = 'Verbinden'; }
  };
  if ($('#vk-trennen', root)) $('#vk-trennen', root).onclick = async (ev) => {
    const b = ev.target;
    if (!b.dataset.sicher) { b.dataset.sicher = '1'; b.textContent = 'Wirklich trennen? Nochmal tippen'; return; }
    try { await stripeFn({ aktion: 'trennen' }); RECHT = null; X.toast('Stripe getrennt. Laufende Abos bei Stripe bleiben bestehen.'); neuLaden(); } catch (e) { X.toast(e.message); }
  };
  $('#vk-recht-speichern', root).onclick = async () => {
    const d = {};
    for (const [k] of FELDER) { const v = $(`#vk-f-${k}`, root).value.trim(); if (v) d[k] = v; }
    try { await X.rpc('sz_rechtliches_setzen', { p_daten: d }); RECHT = null; X.toast('Angaben gespeichert.'); neuLaden(); } catch (e) { X.toast(e.message); }
  };
}
