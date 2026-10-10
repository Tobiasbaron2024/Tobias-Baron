import { budgetPeriod } from './periods.js?v=1';
import { sumRecurring } from './groschen/plus.js?v=1';
export const EXPENSE_CATEGORIES = [['lebensmittel','Lebensmittel'],['drogerie','Drogerie'],['essen','Restaurant & Lieferdienst'],['mobil','Tanken & Fahrten'],['freizeit','Freizeit'],['shopping','Shopping & Kleidung'],['haushalt','Haushalt'],['gesundheit','Apotheke & Gesundheit'],['tier','Haustier'],['geschenke','Geschenke'],['sonstiges','Sonstiges']];
const total = rows => rows.reduce((sum,row)=>sum+Number(row.amount||0),0);
export function expenseAmount(input) {
  const value=String(input).trim().replace(',', '.');
  if(!/^\d+(\.\d{1,2})?$/.test(value))return null;
  const amount=Number(value);
  return Number.isFinite(amount)&&amount>0&&amount<=999999.99 ? Math.round(amount*100)/100 : null;
}
// Gemeinsame Berechnung für Groschen und die Dashboard-Schnelleingabe.
export function budgetToday({today,profile={},recurring=[],transactions=[],prefs={},income=[]}) {
  const period=budgetPeriod(today,profile.payday,profile);
  const txs=transactions.filter(t=>(t.tx_date||t.date)>=period.start&&(t.tx_date||t.date)<period.next);
  const linked=prefs.budget_link&&prefs.income_mode==='automatic';
  const estimate=income.find(x=>String(x.month).slice(0,7)===period.month);
  // Laufzeiten (von/bis, einmalig) werden wie in Groschen nur für die gültigen Tage des Zeitraums angerechnet.
  const recIn=sumRecurring(recurring.filter(r=>!(linked&&r.category==='gehalt')),'in',period.start,period.end)+(linked?Number(estimate?.net_amount||0):0);
  const recOut=sumRecurring(recurring,'out',period.start,period.end);
  const oneIn=total(txs.filter(t=>t.kind==='in'&&!(linked&&t.category==='gehalt')));
  const savings=Number(profile.savings_goal)||0;
  const available=recIn+oneIn-recOut-savings;
  const outs=txs.filter(t=>t.kind==='out');
  const spentBefore=total(outs.filter(t=>(t.tx_date||t.date)<today));
  const spentToday=total(outs.filter(t=>(t.tx_date||t.date)===today));
  const spentFuture=total(outs.filter(t=>(t.tx_date||t.date)>today));
  const spentTotal=total(outs);
  const day=iso=>Date.parse(iso+'T00:00:00Z');
  const daysLeft=Math.round((day(period.end)-day(today))/86400000)+1;
  const totalDays=Math.round((day(period.end)-day(period.start))/86400000)+1;
  const elapsed=totalDays-daysLeft+1;
  const restFromToday=available-spentBefore-spentFuture;
  const daily=restFromToday/daysLeft;
  const todayLeft=daily-spentToday;
  const restNow=available-spentTotal;
  const tomorrowDaily=daysLeft>1?restNow/(daysLeft-1):null;
  const ideal=available/totalDays;
  const avg=(spentBefore+spentToday)/elapsed;
  const forecastEnd=available-spentFuture-avg*totalDays;
  return {period,recIn,recOut,oneIn,savings,available,spentTotal,spentBefore,spentToday,spentFuture,daysLeft,totalDays,elapsed,restFromToday,daily,todayLeft,restNow,tomorrowDaily,ideal,avg,forecastEnd};
}
export async function loadTodayBudget(api,today) {
  const profiles=await api('profiles?select=payday,savings_goal,period_start,period_end');
  const profile=profiles[0]||{};
  const period=budgetPeriod(today,profile.payday,profile);
  const [recurring,transactions,income]=await Promise.all([
    api('recurring?select=kind,amount,interval_months,category,valid_from,valid_to,is_one_time'),
    api(`transactions?select=id,tx_date,kind,amount,category,note&tx_date=gte.${period.start}&tx_date=lt.${period.next}`),
    api(`sz_income_estimates?select=month,net_amount&month=eq.${period.month}-01`)
  ]);
  return {profile,recurring,transactions,income};
}
