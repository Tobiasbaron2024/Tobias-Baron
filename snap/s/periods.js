// Der Zahltag definiert denselben Haushaltszeitraum in beiden Ansichten.
export function budgetPeriod(dateISO, payday = 1) {
  const [y,m,d] = dateISO.split('-').map(Number);
  const pay = Math.max(1, Math.min(28, Math.trunc(Number(payday) || 1)));
  const start = new Date(Date.UTC(y,m-1-(d < pay ? 1 : 0),pay));
  const next = new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,pay));
  return {start:start.toISOString().slice(0,10),end:new Date(+next-86400000).toISOString().slice(0,10),next:next.toISOString().slice(0,10),month:start.toISOString().slice(0,7)};
}
