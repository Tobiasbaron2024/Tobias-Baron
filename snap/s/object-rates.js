// Objektwerte dürfen keine Zulagen aus dem persönlichen Haupttarif erben.
export function objectRates(object = {}, snapshot = null) {
  const saved = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const value = (key, fallback) => saved[key] ?? object[key] ?? fallback;
  return {
    region: value('region', 'HH'),
    lohn: Number(value('lohn', 0)),
    objektzulage: Number(saved.objektzulage ?? (Number(object.objektzulage || 0) + Number(object.weitere_zulage || 0))),
    nacht_pct: Number(value('nacht_pct', 0)),
    sonntag_pct: Number(value('sonntag_pct', 0)),
    feiertag_pct: Number(value('feiertag_pct', 0)),
    nacht_von: value('nacht_von', '20:00'),
    nacht_bis: value('nacht_bis', '06:00'),
    zuschlag_modus: value('zuschlag_modus', 'add'),
  };
}
