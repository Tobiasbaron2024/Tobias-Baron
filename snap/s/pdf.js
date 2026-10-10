// Stundenzettel – PDF-Erstellung mit pdf-lib (A4 quer, mehrseitig)
// d = { titel, kopf: [[label, wert], …], spalten: [{t, w, r}], zeilen: [[…]], summe: [...], lohn: [[text, betrag]], gesamt: [text, betrag], fuss }
export async function bauePdf(PDFLib, d) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  doc.setTitle(d.titel); doc.setCreator('Shiftly'); doc.setProducer('Shiftly');
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 842, H = 595, M = 32;
  const grau = rgb(0.45, 0.47, 0.5), linie = rgb(0.75, 0.77, 0.8), schwarz = rgb(0.08, 0.1, 0.14), hell = rgb(0.94, 0.95, 0.96);
  // WinAnsi-sichere Zeichen
  const safe = (s) => String(s ?? '').replace(/[   ]/g, ' ').replace(/[^\x20-\x7E¡-ÿ€–—‘’‚“”„•…]/g, '');
  const breite = (s, fo, gr) => fo.widthOfTextAtSize(safe(s), gr);
  const kuerze = (s, fo, gr, max) => { let t = safe(s); if (breite(t, fo, gr) <= max) return t; while (t.length && breite(t + '…', fo, gr) > max) t = t.slice(0, -1); return t + '…'; };
  const seiten = [];
  let page, y;
  const tw = d.spalten.reduce((a, s) => a + s.w, 0);
  const faktor = (W - 2 * M) / tw;
  const sp = d.spalten.map((s) => ({ ...s, w: s.w * faktor }));
  const zelle = (txt, x, w, rechts, fo, gr, farbe = schwarz) => {
    const t = kuerze(txt, fo, gr, w - 6);
    const xx = rechts ? x + w - 3 - breite(t, fo, gr) : x + 3;
    page.drawText(t, { x: xx, y, size: gr, font: fo, color: farbe });
  };
  const kopfzeileTabelle = () => {
    page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 15, color: hell });
    let x = M; sp.forEach((s) => { zelle(s.t.toUpperCase(), x, s.w, s.r, fb, 7, grau); x += s.w; });
    y -= 16;
  };
  const neueSeite = (erste) => {
    page = doc.addPage([W, H]); seiten.push(page); y = H - M;
    if (erste) {
      page.drawText(safe(d.titel), { x: M, y: y - 14, size: 18, font: fb, color: schwarz });
      y -= 34;
      const halb = (W - 2 * M) / 2;
      d.kopf.forEach(([l, v], i) => {
        const x = M + (i % 2) * halb;
        page.drawText(safe(l + ':'), { x, y, size: 9, font: fb, color: schwarz });
        page.drawText(kuerze(v, f, 9, halb - 90), { x: x + 80, y, size: 9, font: f, color: schwarz });
        if (i % 2 === 1) y -= 13;
      });
      if (d.kopf.length % 2) y -= 13;
      y -= 8;
    } else {
      page.drawText(safe(d.titel + ' (Fortsetzung)'), { x: M, y: y - 10, size: 11, font: fb, color: schwarz });
      y -= 26;
    }
    kopfzeileTabelle();
  };
  neueSeite(true);
  const ZH = 13;
  d.zeilen.forEach((z) => {
    if (y < M + 30) neueSeite(false);
    let x = M; sp.forEach((s, i) => { zelle(z[i], x, s.w, s.r, f, 8); x += s.w; });
    page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: 0.4, color: linie });
    y -= ZH;
  });
  if (!d.zeilen.length) { page.drawText('Keine Einträge in diesem Monat.', { x: M + 3, y, size: 9, font: f, color: grau }); y -= ZH; }
  if (!d.nurTabelle) {
  if (y < M + 30) neueSeite(false);
  page.drawLine({ start: { x: M, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 1.2, color: schwarz });
  let x = M; sp.forEach((s, i) => { zelle(d.summe[i], x, s.w, s.r, fb, 8); x += s.w; });
  y -= 26;
  // Lohnaufstellung + Unterschriften
  const mitLohn = !!(d.lohn && d.lohn.length && d.gesamt);
  const blockH = (mitLohn ? 16 + d.lohn.length * 13 + 20 : 0) + 70;
  if (y - blockH < M) { page = doc.addPage([W, H]); seiten.push(page); y = H - M - 10; }
  const lb = 330;
  if (mitLohn) {
  page.drawText('LOHNAUFSTELLUNG (BRUTTO)', { x: M, y, size: 8, font: fb, color: grau }); y -= 15;
  d.lohn.forEach(([t, b]) => {
    page.drawText(kuerze(t, f, 9, lb - 90), { x: M, y, size: 9, font: f, color: schwarz });
    page.drawText(safe(b), { x: M + lb - breite(b, f, 9), y, size: 9, font: f, color: schwarz });
    y -= 13;
  });
  page.drawLine({ start: { x: M, y: y + 9 }, end: { x: M + lb, y: y + 9 }, thickness: 1.2, color: schwarz });
  y -= 4;
  page.drawText(safe(d.gesamt[0]), { x: M, y, size: 11, font: fb, color: schwarz });
  page.drawText(safe(d.gesamt[1]), { x: M + lb - breite(d.gesamt[1], fb, 11), y, size: 11, font: fb, color: schwarz });
  }
  y -= 50;
  const uw = (W - 2 * M - 60) / 2;
  [['Datum, Unterschrift Mitarbeiter/in', M], ['Datum, Unterschrift Vorgesetzte/r', M + uw + 60]].forEach(([t, xx]) => {
    page.drawLine({ start: { x: xx, y }, end: { x: xx + uw, y }, thickness: 0.8, color: schwarz });
    page.drawText(t, { x: xx, y: y - 11, size: 8, font: f, color: schwarz });
  });
  }
  seiten.forEach((p, i) => {
    p.drawText(kuerze(d.fuss, f, 7, W - 2 * M - 80), { x: M, y: 16, size: 7, font: f, color: grau });
    const s = `Seite ${i + 1} von ${seiten.length}`;
    p.drawText(s, { x: W - M - breite(s, f, 7), y: 16, size: 7, font: f, color: grau });
  });
  return doc.save();
}
