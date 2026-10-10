/* Lohnsteuer 2026 nach amtlichem Programmablaufplan (BMF, PAP 2026 v1.0, Stand 23.10.2025)
 * – nur laufender Monatslohn (LZZ = 2), ohne Versorgungsbezüge, Altersentlastung, Faktor, sonstige Bezüge.
 * Rechnet exakt mit ganzen Zahlen (BigInt), damit die Rundungen genau wie beim Finanzamt sind.
 */
export class Dec {
  constructor(v, s) { this.v = v; this.s = s; }
  static of(x) {
    if (x instanceof Dec) return x;
    const str = typeof x === 'bigint' ? x.toString() : String(x);
    const neg = str.startsWith('-');
    const [i, f = ''] = (neg ? str.slice(1) : str).split('.');
    const v = BigInt((i || '0') + f);
    return new Dec(neg ? -v : v, f.length);
  }
  static p(n) { return 10n ** BigInt(n); }
  al(o) { o = Dec.of(o); const s = Math.max(this.s, o.s); return [this.v * Dec.p(s - this.s), o.v * Dec.p(s - o.s), s]; }
  add(o) { const [a, b, s] = this.al(o); return new Dec(a + b, s); }
  sub(o) { const [a, b, s] = this.al(o); return new Dec(a - b, s); }
  mul(o) { o = Dec.of(o); return new Dec(this.v * o.v, this.s + o.s); }
  cmp(o) { const [a, b] = this.al(o); return a < b ? -1 : a > b ? 1 : 0; }
  static rq(num, den, mode) { // Quotient mit Rundung: 'down' = Richtung 0, 'up' = weg von 0
    if (den < 0n) { num = -num; den = -den; }
    let q = num / den; const r = num % den;
    if (r !== 0n && mode === 'up') q += num < 0n ? -1n : 1n;
    return q;
  }
  div(o, scale, mode = 'down') {
    o = Dec.of(o); const k = scale + o.s - this.s;
    const num = this.v * Dec.p(Math.max(0, k)), den = o.v * Dec.p(Math.max(0, -k));
    return new Dec(Dec.rq(num, den, mode), scale);
  }
  set(n, mode = 'down') {
    if (n >= this.s) return new Dec(this.v * Dec.p(n - this.s), n);
    return new Dec(Dec.rq(this.v, Dec.p(this.s - n), mode), n);
  }
  num() { return Number(this.v) / 10 ** this.s; }
}
const D = Dec.of, max = (a, b) => (a.cmp(b) >= 0 ? a : b), min = (a, b) => (a.cmp(b) <= 0 ? a : b);
const ZERO = D(0);

/** Parameter wie im PAP: re4 (Cent/Monat), stkl 1–6, zkf (Kinderfreibeträge, 0,5-Schritte),
 *  r (1 = kirchensteuerpflichtig), kvz (Zusatzbeitrag %), pvs (Sachsen), pvz (Kinderlosenzuschlag), pva (Abschläge 0–4),
 *  krv/alv (1 = nicht rentenversicherungs-/arbeitslosenversicherungspflichtig), pkv (1 = privat, dann pkpv/pkpvagz in Cent/Monat) */
export function lohnsteuer2026(p) {
  const stkl = Number(p.stkl) || 1, zkf = D(p.zkf || 0), krv = Number(p.krv) || 0, alv = Number(p.alv) || 0, pkv = Number(p.pkv) || 0;
  // MPARA
  const BBGRVALV = D(101400), AVSATZAN = D('0.013'), RVSATZAN = D('0.093'), BBGKVPV = D(69750);
  const KVSATZAN = D(Number(p.kvz || 0).toFixed(2)).div(2, 10).div(100, 10).add(D('0.07'));
  let PVSATZAN = D(p.pvs ? '0.023' : '0.018');
  PVSATZAN = p.pvz ? PVSATZAN.add(D('0.006')) : PVSATZAN.sub(D(p.pva || 0).mul(D('0.0025')));
  const W1 = D(14071), W2 = D(34939), W3 = D(222260), GFB = D(12348);
  let SOLZFREI = D(20350);
  // MRE4JL / MRE4 / MRE4ABZ (keine Versorgungsbezüge, kein Altersentlastungsbetrag, keine Frei-/Hinzurechnungsbeträge)
  const ZRE4J = D(Math.round(p.re4)).mul(12).div(100, 2, 'down');
  const ZRE4 = max(ZRE4J.set(2, 'down'), ZERO);
  const ZRE4VP = ZRE4J;
  // MZTABFB
  let ANP = ZERO;
  if (stkl < 6 && ZRE4.cmp(ZERO) === 1) ANP = ZRE4.cmp(D(1230)) === -1 ? ANP.add(ZRE4).set(0, 'up') : ANP.add(D(1230));
  let KZTAB = 1, SAP = ZERO, EFA = ZERO, KFB = ZERO;
  if (stkl === 1 || stkl === 2 || stkl === 3) { SAP = D(36); KFB = zkf.mul(9756).set(0, 'down'); }
  if (stkl === 2) EFA = D(4260);
  if (stkl === 3) KZTAB = 2;
  if (stkl === 4) { SAP = D(36); KFB = zkf.mul(4878).set(0, 'down'); }
  if (stkl === 5) SAP = D(36);
  let ZTABFB = EFA.add(ANP).add(SAP).set(2, 'down');

  const UPTAB26 = (X) => {
    let ST;
    if (X.cmp(GFB.add(1)) === -1) ST = ZERO;
    else if (X.cmp(D(17800)) === -1) {
      const Y = X.sub(GFB).div(10000, 6, 'down');
      ST = Y.mul(D('914.51')).add(1400).mul(Y).set(0, 'down');
    } else if (X.cmp(D(69879)) === -1) {
      const Y = X.sub(D(17799)).div(10000, 6, 'down');
      ST = Y.mul(D('173.1')).add(2397).mul(Y).add(D('1034.87')).set(0, 'down');
    } else if (X.cmp(D(277826)) === -1) ST = X.mul(D('0.42')).sub(D('11135.63')).set(0, 'down');
    else ST = X.mul(D('0.45')).sub(D('19470.38')).set(0, 'down');
    return ST.mul(KZTAB);
  };
  const UP5_6 = (ZX) => {
    const ST1 = UPTAB26(ZX.mul(D('1.25')).set(0, 'down'));
    const ST2 = UPTAB26(ZX.mul(D('0.75')).set(0, 'down'));
    const DIFF = ST1.sub(ST2).mul(2);
    const MIST = ZX.mul(D('0.14')).set(0, 'down');
    return MIST.cmp(DIFF) === 1 ? MIST : DIFF;
  };
  const MST5_6 = (ZZX) => {
    let ST;
    if (ZZX.cmp(W2) === 1) {
      ST = UP5_6(W2);
      if (ZZX.cmp(W3) === 1) {
        ST = ST.add(W3.sub(W2).mul(D('0.42'))).set(0, 'down');
        ST = ST.add(ZZX.sub(W3).mul(D('0.45'))).set(0, 'down');
      } else ST = ST.add(ZZX.sub(W2).mul(D('0.42'))).set(0, 'down');
    } else {
      ST = UP5_6(ZZX);
      if (ZZX.cmp(W1) === 1) {
        const VERGL = ST;
        const HOCH = UP5_6(W1).add(ZZX.sub(W1).mul(D('0.42'))).set(0, 'down');
        ST = HOCH.cmp(VERGL) === -1 ? HOCH : VERGL;
      }
    }
    return ST;
  };
  // Vorsorgepauschale (UPEVP, MVSPKVPV, MVSPHB)
  let VSPR = ZERO;
  if (krv !== 1) VSPR = min(ZRE4VP, BBGRVALV).mul(RVSATZAN).set(2, 'down');
  let VSPKVPV;
  if (pkv > 0) {
    if (stkl === 6) VSPKVPV = ZERO;
    else {
      const PKPVAGZJ = D(p.pkpvagz || 0).mul(12).div(100, 10).set(2, 'down');
      VSPKVPV = max(D(p.pkpv || 0).mul(12).div(100, 10).set(2, 'down').sub(PKPVAGZJ), ZERO);
    }
  } else VSPKVPV = min(ZRE4VP, BBGKVPV).mul(KVSATZAN.add(PVSATZAN)).set(2, 'down');
  let VSP = VSPKVPV.add(VSPR).set(0, 'up');
  if (alv !== 1 && stkl !== 6) {
    const VSPALV = AVSATZAN.mul(min(ZRE4VP, BBGRVALV)).set(2, 'down');
    const VSPHB = min(VSPALV.add(VSPKVPV).set(2, 'down'), D(1900));
    const VSPN = VSPR.add(VSPHB).set(0, 'up');
    if (VSPN.cmp(VSP) === 1) VSP = VSPN;
  }
  const MLSTJAHR = () => {
    const ZVE = ZRE4.sub(ZTABFB).sub(VSP);
    const X = ZVE.cmp(D(1)) === -1 ? ZERO : ZVE.div(KZTAB, 0, 'down');
    return { ZVE, ST: stkl < 5 ? UPTAB26(X) : MST5_6(X) };
  };
  // MBERECH
  const r1 = MLSTJAHR();
  const LSTJAHR = r1.ST.set(0, 'down');
  const LSTLZZ = LSTJAHR.mul(100).div(12, 0, 'down');
  let JBMG = LSTJAHR;
  if (zkf.cmp(ZERO) === 1) { ZTABFB = ZTABFB.add(KFB); JBMG = MLSTJAHR().ST.set(0, 'down'); }
  // MSOLZ
  SOLZFREI = SOLZFREI.mul(KZTAB);
  let SOLZLZZ = ZERO;
  if (JBMG.cmp(SOLZFREI) === 1) {
    let SOLZJ = JBMG.mul(D('5.5')).div(100, 2, 'down');
    const SOLZMIN = JBMG.sub(SOLZFREI).mul(D('11.9')).div(100, 2, 'down');
    if (SOLZMIN.cmp(SOLZJ) === -1) SOLZJ = SOLZMIN;
    SOLZLZZ = SOLZJ.mul(100).set(0, 'down').div(12, 0, 'down');
  }
  const BK = p.r ? JBMG.mul(100).div(12, 0, 'down') : ZERO;
  return { LSTLZZ: Number(LSTLZZ.v), SOLZLZZ: Number(SOLZLZZ.v), BK: Number(BK.v), ZVE: r1.ZVE.num(), VSP: VSP.num() };
}

/* ---------- Sozialversicherung 2026 (Arbeitnehmeranteil) ---------- */
export const SV2026 = {
  bbgKvPv: 5812.5, bbgRvAv: 8450, rv: 0.093, av: 0.013, kvAllg: 0.073, pvAg: 0.018, pvAgSachsen: 0.013,
  minijob: 603, midiBis: 2000, midiGesA: 1.1459205897, midiGesB: 291.8411794270,
};
const r2 = (x) => Math.round(x * 100 + 1e-9) / 100;

/** ae = regelmäßiges sozialversicherungspflichtiges Monatsentgelt in Euro.
 *  opt: kvz (%), sachsen, kinderlos (Zuschlag 0,6), pva (Abschläge 0–4), pkv, pkvBeitrag (Euro/Monat, AN-Zahlung nach AG-Zuschuss), krv/alv */
export function sozialversicherung2026(ae, opt = {}) {
  const S = SV2026;
  const res = { kv: 0, pv: 0, rv: 0, av: 0, summe: 0, bereich: 'normal', beGes: ae };
  if (ae <= 0) return res;
  if (ae <= S.minijob) { res.bereich = 'minijob'; res.rv = opt.krv ? 0 : r2(ae * 0.036); res.summe = res.rv; return res; }
  const midi = ae <= S.midiBis;
  // Übergangsbereich (§ 20 Abs. 2a SGB IV): AN-Anteil = reduzierte BE (AN) × AN-Satz;
  // Kinderlosenzuschlag/Kinderabschläge der PV werden hier auf die BE gesamt gerechnet (Näherung).
  const beGes = midi ? S.midiGesA * ae - S.midiGesB : ae;
  const beAn = midi ? (S.midiBis / (S.midiBis - S.minijob)) * (ae - S.minijob) : ae;
  res.bereich = midi ? 'midijob' : 'normal'; res.beGes = r2(beGes); res.beAn = r2(beAn);
  const kvAn = S.kvAllg + (Number(opt.kvz) || 0) / 200;
  const pvBasis = opt.sachsen ? 0.023 : 0.018;
  const pvExtra = opt.kinderlos ? 0.006 : -Math.min(4, Math.max(0, Number(opt.pva) || 0)) * 0.0025;
  const kvpv = Math.min(beAn, S.bbgKvPv), rvav = Math.min(beAn, S.bbgRvAv);
  if (opt.pkv) { res.kv = r2(Number(opt.pkvBeitrag) || 0); res.pv = 0; }
  else {
    res.kv = r2(kvpv * kvAn);
    res.pv = r2(kvpv * pvBasis + Math.min(beGes, S.bbgKvPv) * pvExtra);
  }
  res.rv = opt.krv ? 0 : r2(rvav * S.rv);
  res.av = opt.alv ? 0 : r2(rvav * S.av);
  res.summe = r2(res.kv + res.pv + res.rv + res.av);
  return res;
}

/* ---------- Steuerfreie Zuschläge nach § 3b EStG ---------- */
// Freie Sätze: Nacht 25 %, Sonntag 50 %, Feiertag 125 % (vom Grundlohn, max. 50 €/Std. steuerlich, 25 €/Std. in der SV)
export function freieZuschlaege(calc) {
  const h = calc.hours || {}, m = calc.money || {};
  const std = Number(h.total) || 0;
  const grund = std > 0 ? ((Number(m.base) || 0) + (Number(m.allowance) || 0)) / std : Number(calc.wage) || 0;
  const frei = (cap) => {
    const g = Math.min(grund, cap);
    return Math.min(Number(m.night) || 0, 0.25 * g * (Number(h.night) || 0))
      + Math.min(Number(m.sunday) || 0, 0.5 * g * (Number(h.sunday) || 0))
      + Math.min(Number(m.holiday) || 0, 1.25 * g * (Number(h.holiday) || 0));
  };
  return { steuer: r2(frei(50)), sv: r2(frei(25)) };
}

export const KIST_SATZ = (land) => (land === 'BY' || land === 'BW' ? 0.08 : 0.09);

/** Komplette Monatsabrechnung.
 *  b = { brutto, steuerfrei, svfrei } in Euro; s = Einstellungen; land = Bundesland */
export function netto2026(b, s, land = 'HH') {
  const brutto = r2(b.brutto);
  const stpfl = Math.max(0, r2(brutto - (b.steuerfrei || 0)));
  const svpfl = Math.max(0, r2(brutto - (b.svfrei || 0)));
  const sachsen = land === 'SN';
  const kinderlos = !!s.kinderlos;
  const pva = kinderlos ? 0 : Math.max(0, Math.min(4, (Number(s.kinderU25) || 0) - 1));
  const stkl = Number(s.stkl) || 1;
  const zkf = stkl <= 4 ? Number(s.zkf) || 0 : 0;
  const sv = sozialversicherung2026(svpfl, { kvz: s.kvz, sachsen, kinderlos, pva, pkv: s.pkv, pkvBeitrag: s.pkvBeitrag });
  const minijob = sv.bereich === 'minijob';
  const lst = minijob ? { LSTLZZ: 0, SOLZLZZ: 0, BK: 0 } : lohnsteuer2026({
    re4: Math.round(stpfl * 100), stkl, zkf, r: s.kirche ? 1 : 0, kvz: s.kvz, pvs: sachsen ? 1 : 0, pvz: kinderlos ? 1 : 0, pva,
    pkv: s.pkv ? 1 : 0, pkpv: Math.round((Number(s.pkvGesamt) || 0) * 100), pkpvagz: Math.round((Number(s.pkvAgZuschuss) || 0) * 100),
  });
  const lohnsteuer = lst.LSTLZZ / 100, soli = lst.SOLZLZZ / 100;
  const kirche = s.kirche ? Math.floor(lst.BK * KIST_SATZ(land)) / 100 : 0;
  const steuern = r2(lohnsteuer + soli + kirche);
  const netto = r2(brutto - steuern - sv.summe);
  return { brutto, stpfl, svpfl, lohnsteuer, soli, kirche, steuern, sv, netto, minijob };
}
