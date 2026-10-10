// Urlaubsplaner: mehrere Anträge in EINER E-Mail senden und genehmigte Anträge als PDF ablegen.
// Wird von urlaub.js eingebunden. Die reinen Hilfsfunktionen sind ohne Browser testbar.
export const MAX_BYTES = 4 * 1024 * 1024;
const A4 = [595.28, 841.89];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const P = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
export const Fe = (n) => (Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const groesse = (b) => (b >= 1048576 ? `${(b / 1048576).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/* ---------- reine Hilfsfunktionen ---------- */
export const dateiname = (v) => `Urlaubsantrag_${v.start_date}_${v.end_date}.pdf`;
export const sammelName = (items) => `Urlaubsantraege_${items[0].start_date}_bis_${items[items.length - 1].end_date}.pdf`;

/* Betreff und Text für die gemeinsame E-Mail; infos: [{ start, end, workDays }] in zeitlicher Reihenfolge */
export function mailText(infos, name = '') {
  const n = infos.length;
  const zeilen = infos.map((i) => `- ${P(i.start)} bis ${P(i.end)} (${Fe(i.workDays)} Arbeitstage)`);
  const summe = infos.reduce((s, i) => s + (Number(i.workDays) || 0), 0);
  const wer = String(name || '').trim();
  const subject = n === 1
    ? `Urlaubsantrag${wer ? ' ' + wer : ''} – ${P(infos[0].start)} bis ${P(infos[0].end)}`
    : `Urlaubsanträge${wer ? ' ' + wer : ''} – ${n} Zeiträume`;
  const text = `Guten Tag,\n\nhiermit beantrage ich Erholungsurlaub für ${n === 1 ? 'folgenden Zeitraum' : 'folgende Zeiträume'}:\n\n${zeilen.join('\n')}\n\n${n > 1 ? `Zusammen sind das ${Fe(summe)} Arbeitstage. ` : ''}Die ausgefüllten Urlaubsanträge finden Sie im Anhang.\n\nMit freundlichen Grüßen${wer ? '\n' + wer : ''}`;
  return { subject, text };
}

/* mailto-Link; wird die Adresszeile zu lang, bleibt die Aufzählung weg (Zusammenfassung statt Liste) */
export function mailtoLink(m, infos, name = '') {
  let url = `mailto:?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.text)}`;
  if (url.length > 1900) {
    const kurz = { subject: m.subject, text: `Guten Tag,\n\nhiermit beantrage ich Erholungsurlaub. Die ${infos.length} ausgefüllten Urlaubsanträge finden Sie im Anhang.\n\nMit freundlichen Grüßen${String(name || '').trim() ? '\n' + String(name).trim() : ''}` };
    url = `mailto:?subject=${encodeURIComponent(kurz.subject)}&body=${encodeURIComponent(kurz.text)}`;
  }
  return url;
}

export function bytesToBase64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
export function base64ToBytes(b64) { return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); }
export const istPdf = (u8) => u8.length > 5 && u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46 && u8[4] === 0x2d; // %PDF-

/* mehrere PDFs zu einem Dokument zusammenfügen (je Antrag eine Seite) */
export async function mergePdfs(lib, blobs) {
  const out = await lib.PDFDocument.create();
  for (const b of blobs) {
    const src = await lib.PDFDocument.load(await b.arrayBuffer());
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return new Blob([await out.save()], { type: 'application/pdf' });
}

/* Foto/Scan (JPG, PNG, WebP …) als PDF-Seite einbetten */
export async function bildZuPdf(lib, datei) {
  let bmp;
  try { bmp = await createImageBitmap(datei, { imageOrientation: 'from-image' }); }
  catch { throw new Error('Das Bild konnte nicht gelesen werden. Bitte als PDF oder JPG speichern.'); }
  const f = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * f)); c.height = Math.max(1, Math.round(bmp.height * f));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
  const jpg = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
  if (!jpg) throw new Error('Das Bild konnte nicht verarbeitet werden.');
  const doc = await lib.PDFDocument.create();
  const img = await doc.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
  const querformat = img.width > img.height;
  const page = doc.addPage(querformat ? [A4[1], A4[0]] : A4);
  const m = 20, w = page.getWidth() - 2 * m, h = page.getHeight() - 2 * m, s = Math.min(w / img.width, h / img.height);
  page.drawImage(img, { x: (page.getWidth() - img.width * s) / 2, y: (page.getHeight() - img.height * s) / 2, width: img.width * s, height: img.height * s });
  return new Uint8Array(await doc.save());
}

/* Datei prüfen und als PDF-Bytes zurückgeben */
export async function dateiAlsPdf(lib, datei) {
  if (!datei) throw new Error('Keine Datei gewählt.');
  const name = String(datei.name || 'Nachweis');
  let bytes;
  if (datei.type === 'application/pdf' || /\.pdf$/i.test(name)) {
    bytes = new Uint8Array(await datei.arrayBuffer());
    if (!istPdf(bytes)) throw new Error('Das ist keine gültige PDF-Datei.');
  } else if (/^image\//.test(datei.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(name)) {
    if (datei.size > 25 * 1024 * 1024) throw new Error('Das Bild ist zu groß (höchstens 25 MB).');
    bytes = await bildZuPdf(lib, datei);
  } else throw new Error('Bitte eine PDF-Datei oder ein Foto auswählen.');
  if (bytes.length > MAX_BYTES) throw new Error(`Die Datei ist zu groß (${groesse(bytes.length)}). Erlaubt sind höchstens ${groesse(MAX_BYTES)}.`);
  const basis = name.replace(/\.[^.]+$/, '').replace(/[^\w.\-äöüÄÖÜß ]+/g, '_').trim().slice(0, 120) || 'Nachweis';
  return { bytes, filename: `${basis}.pdf` };
}

/* ---------- Oberfläche ---------- */
let oeffneOrdner = false; // nach dem Ablegen den Ordner einmalig aufklappen
let abbau = null; // entfernt die Listener der vorigen Darstellung (el bleibt bei jedem Neuzeichnen dasselbe Element)
export function mehrfachInit(c) {
  const { X, el, liste, darf, neu, antragWerte, antragPdf, dialog, frage, speichern } = c;
  abbau?.(); abbau = null;
  const nameVon = (id) => liste.find((v) => v.id === id);
  const zeilen = $$('.ul-zeile', el).map((z) => ({ z, id: $('[data-req]', z)?.dataset.req })).filter((r) => r.id && nameVon(r.id));
  const sendeKnopf = () => $('#ul-senden', el);
  let docs = [];

  /* Auswahl-Kästchen und Ablage-Knopf in jeder Zeile */
  for (const { z, id } of zeilen) {
    const haupt = $('.ul-haupt', z); const akt = $('.ul-aktion', z);
    if (haupt && !$('.ul-sel', z)) {
      const l = document.createElement('label'); l.className = 'ul-sel'; l.title = 'Für gemeinsame E-Mail auswählen';
      l.innerHTML = '<input type="checkbox" data-sel aria-label="Antrag für gemeinsame E-Mail auswählen">';
      $('input', l).dataset.sel = id; z.insertBefore(l, haupt);
    }
    if (akt && darf && !$('[data-appr]', z)) {
      const b = document.createElement('button'); b.className = 'btn klein'; b.type = 'button'; b.dataset.appr = id; b.textContent = 'Genehmigt ablegen';
      b.setAttribute('aria-label', 'Genehmigten Antrag als PDF ablegen'); $('[data-req]', akt).after(b);
    }
  }

  /* Leiste über der Liste */
  const listeEl = $('.ul-liste', el);
  if (listeEl && zeilen.length && !$('#ul-sendbar', el)) {
    const bar = document.createElement('div'); bar.id = 'ul-sendbar'; bar.className = 'reihe ul-sendbar';
    bar.innerHTML = '<label class="ul-alle"><input type="checkbox" id="ul-alle"> Alle auswählen</label><button class="btn klein pri" id="ul-senden" type="button" disabled>Ausgewählte in einer E-Mail senden</button><span class="hinweis" id="ul-anz" style="margin:0" aria-live="polite"></span>';
    listeEl.parentElement.insertBefore(bar, listeEl);
  }
  const gewaehlt = () => $$('[data-sel]:checked', el).map((i) => nameVon(i.dataset.sel)).filter(Boolean).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const aktualisiere = () => {
    const n = gewaehlt().length, alle = $$('[data-sel]', el);
    const k = sendeKnopf(); if (k) { k.disabled = n === 0; k.textContent = n ? `${n} ${n === 1 ? 'Antrag' : 'Anträge'} in einer E-Mail senden` : 'Ausgewählte in einer E-Mail senden'; }
    const a = $('#ul-alle', el); if (a) { a.checked = n > 0 && n === alle.length; a.indeterminate = n > 0 && n < alle.length; }
  };
  const beiAenderung = (ev) => {
    if (ev.target.matches?.('[data-sel]')) aktualisiere();
    if (ev.target.id === 'ul-alle') { $$('[data-sel]', el).forEach((i) => { i.checked = ev.target.checked; }); aktualisiere(); }
  };
  el.addEventListener('change', beiAenderung);

  /* Mehrere Anträge in einer E-Mail */
  async function sende() {
    const items = gewaehlt(); if (!items.length) return;
    const k = sendeKnopf(); const alt = k.textContent; k.disabled = true; k.textContent = 'Bitte warten …';
    try {
      const logo = c.logo();
      const fertig = [], infos = [];
      for (const v of items) {
        const w = await antragWerte(v);
        infos.push({ start: w.start, end: w.end, workDays: w.workDays, name: w.name });
        fertig.push({ filename: dateiname(v), blob: await antragPdf(w, logo) });
      }
      const name = infos.find((i) => i.name)?.name || '';
      const m = mailText(infos, name);
      const dateien = fertig.map((d) => new File([d.blob], d.filename, { type: 'application/pdf' }));
      let teilbar = false;
      try { teilbar = !!navigator.canShare && navigator.canShare({ files: dateien }); } catch { teilbar = false; }
      if (teilbar) { await navigator.share({ files: dateien, title: m.subject, text: m.text }); return; }
      const wahl = await dialog({
        titel: 'Anträge in einer E-Mail senden', breit: false,
        html: `<p>${items.length} Anträge sind fertig. Dieses Gerät kann mehrere Anhänge nicht direkt an das Mailprogramm übergeben.</p><p><b>Empfohlen:</b> Alle Anträge in <b>einer</b> PDF speichern (eine Seite je Antrag). Danach öffnet sich die E-Mail, und du hängst die PDF an.</p>`,
        knoepfe: [{ t: 'Abbrechen', wert: null }, { t: 'Einzelne PDFs speichern', wert: 'einzeln' }, { t: 'Eine PDF + E-Mail', wert: 'eine', pri: true }],
      });
      if (!wahl) return;
      if (wahl === 'eine') {
        const lib = await X.ladePdfLib();
        speichern(await mergePdfs(lib, fertig.map((d) => d.blob)), sammelName(items));
        X.toast('PDF wurde gespeichert – bitte in der E-Mail als Anhang hinzufügen.');
      } else {
        fertig.forEach((d) => speichern(d.blob, d.filename));
        X.toast('PDFs wurden gespeichert – bitte in der E-Mail als Anhänge hinzufügen.');
      }
      location.href = mailtoLink(m, infos, name);
    } catch (err) { if (err?.name !== 'AbortError') X.toast(err.message || 'Senden fehlgeschlagen.'); }
    finally { const kk = sendeKnopf(); if (kk) { kk.textContent = alt; aktualisiere(); } }
  }
  const beiKlick = (ev) => {
    const t = ev.target.closest?.('#ul-senden, [data-appr], [data-doc-open], [data-doc-save], [data-doc-del]'); if (!t || !el.contains(t)) return;
    if (t.id === 'ul-senden') sende();
    else if (t.dataset.appr) waehleDatei(t.dataset.appr);
    else if (t.dataset.docOpen) dokAktion(t.dataset.docOpen, 'open');
    else if (t.dataset.docSave) dokAktion(t.dataset.docSave, 'save');
    else if (t.dataset.docDel) dokLoeschen(t.dataset.docDel);
  };
  el.addEventListener('click', beiKlick);
  abbau = () => { el.removeEventListener('click', beiKlick); el.removeEventListener('change', beiAenderung); };

  /* Genehmigte Anträge ablegen */
  function waehleDatei(vacId) {
    const f = document.createElement('input'); f.type = 'file'; f.accept = 'application/pdf,image/*'; f.hidden = true;
    f.onchange = async () => { const d = f.files?.[0]; f.remove(); if (d) await ablegen(vacId, d); };
    document.body.append(f); f.click();
  }
  async function ablegen(vacId, datei) {
    const v = nameVon(vacId); if (!v) return;
    try {
      X.toast('Datei wird geprüft und abgelegt …');
      const lib = await X.ladePdfLib();
      const { bytes, filename } = await dateiAlsPdf(lib, datei);
      await X.api('sz_vacation_docs', { method: 'POST', body: { vacation_id: vacId, filename, mime: 'application/pdf', size_bytes: bytes.length, data: bytesToBase64(bytes), kind: 'genehmigt' }, prefer: 'return=minimal' });
      let hinweis = 'Genehmigter Antrag wurde abgelegt.';
      if (['planned', 'requested'].includes(v.status)) {
        try { await X.api(`sz_vacations?id=eq.${vacId}`, { method: 'PATCH', body: { status: 'approved' }, prefer: 'return=minimal' }); X.S.jahr = null; X.S.urlaubInfo = null; hinweis = 'Genehmigter Antrag abgelegt, Status auf „genehmigt“ gesetzt.'; }
        catch (e) { hinweis = `Abgelegt. Der Status konnte nicht geändert werden: ${e.message}`; }
      }
      X.toast(hinweis); oeffneOrdner = true; neu();
    } catch (err) { X.toast(err.message || 'Ablegen fehlgeschlagen.'); }
  }
  async function dokAktion(id, was) {
    const d = docs.find((x) => x.id === id); if (!d) return;
    try {
      const r = await X.api(`sz_vacation_docs?id=eq.${id}&select=data,filename`);
      if (!r?.[0]?.data) throw new Error('Die Datei wurde nicht gefunden.');
      const blob = new Blob([base64ToBytes(r[0].data)], { type: 'application/pdf' });
      if (was === 'save') { speichern(blob, r[0].filename); X.toast('PDF wurde gespeichert.'); return; }
      const u = URL.createObjectURL(blob);
      if (!window.open(u, '_blank')) { speichern(blob, r[0].filename); X.toast('PDF wurde gespeichert.'); }
      setTimeout(() => URL.revokeObjectURL(u), 120000);
    } catch (err) { X.toast(err.message || 'Aktion fehlgeschlagen.'); }
  }
  async function dokLoeschen(id) {
    const d = docs.find((x) => x.id === id); if (!d) return;
    if (!(await frage('Nachweis löschen', `<p>Möchtest du „${esc(d.filename)}“ wirklich löschen? Der Urlaubseintrag selbst bleibt erhalten.</p>`, 'Löschen', true))) return;
    try { await X.api(`sz_vacation_docs?id=eq.${id}`, { method: 'DELETE' }); X.toast('Nachweis wurde gelöscht.'); neu(); }
    catch (err) { X.toast(err.message); }
  }

  /* Liste der abgelegten Dateien */
  const ziel = $('#ul-nachweise-liste', el);
  const zeichne = () => {
    for (const { z, id } of zeilen) {
      const anz = docs.filter((d) => d.vacation_id === id).length;
      const pill = $('.ul-meta .ul-pill', z); $$('.ul-nachweis-pill', z).forEach((p) => p.remove());
      if (anz && pill) { const s = document.createElement('span'); s.className = 'ul-pill ul-ok ul-nachweis-pill'; s.textContent = 'Nachweis abgelegt'; pill.after(s); }
    }
    if (!ziel) return;
    if (!docs.length) { ziel.innerHTML = '<p class="hinweis">Noch nichts abgelegt. Wenn dein Antrag genehmigt zurückkommt, tippe in der Liste beim Antrag auf „Genehmigt ablegen“ und wähle die PDF oder ein Foto. So hast du den Nachweis immer dabei.</p>'; return; }
    ziel.innerHTML = `<div class="ul-liste">${docs.map((d) => { const v = nameVon(d.vacation_id); return `<div class="ul-zeile"><div class="ul-haupt"><b>${v ? `${P(v.start_date)} – ${P(v.end_date)}` : 'Urlaub'}</b><span class="ul-meta">${esc(d.filename)} · ${groesse(d.size_bytes)} · abgelegt am ${P(String(d.created_at).slice(0, 10))}</span></div><div class="ul-aktion"><button class="btn klein" type="button" data-doc-open="${d.id}">Öffnen</button><button class="btn klein" type="button" data-doc-save="${d.id}">Speichern</button><button class="btn klein rot" type="button" data-doc-del="${d.id}">Löschen</button></div></div>`; }).join('')}</div>`;
  };
  if (ziel) ziel.innerHTML = '<p class="hinweis">Wird geladen …</p>';
  X.api('sz_vacation_docs?select=id,vacation_id,filename,size_bytes,created_at&order=created_at.desc')
    .then((r) => { docs = Array.isArray(r) ? r.filter((d) => nameVon(d.vacation_id)) : []; zeichne(); })
    .catch((e) => { if (ziel) ziel.innerHTML = `<p class="fehler">${esc(e.message)}</p>`; });
  aktualisiere();
  if (oeffneOrdner) { oeffneOrdner = false; ziel?.closest('section.card')?.dispatchEvent(new Event('fold-open')); }
}
