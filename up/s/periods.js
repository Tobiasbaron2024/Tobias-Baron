// Der Zahltag definiert denselben Haushaltszeitraum in beiden Ansichten.
// Optional: eigener Zeitraum (period_start/period_end im Profil). Er gilt genau in seinen Grenzen,
// die normalen Zeiträume davor und danach werden passend gekürzt.
const addDays = (isoDate, n) => new Date(Date.parse(isoDate + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export function budgetPeriod(dateISO, payday = 1, custom = null) {
  const [y,m,d] = dateISO.split('-').map(Number);
  const pay = Math.max(1, Math.min(28, Math.trunc(Number(payday) || 1)));
  const startD = new Date(Date.UTC(y,m-1-(d < pay ? 1 : 0),pay));
  const nextD = new Date(Date.UTC(startD.getUTCFullYear(),startD.getUTCMonth()+1,pay));
  let start = startD.toISOString().slice(0,10), end = new Date(+nextD-86400000).toISOString().slice(0,10), isCustom = false;
  const cs = custom?.period_start ? String(custom.period_start).slice(0,10) : null, ce = custom?.period_end ? String(custom.period_end).slice(0,10) : null;
  if (cs && ce && cs <= ce) {
    if (dateISO >= cs && dateISO <= ce) { start = cs; end = ce; isCustom = true; }
    else if (dateISO < cs && end >= cs) end = addDays(cs, -1);
    else if (dateISO > ce && start <= ce) start = addDays(ce, 1);
  }
  return {start,end,next:addDays(end,1),month:start.slice(0,7),custom:isCustom};
}
