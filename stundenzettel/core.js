(function(global){
"use strict";
const MS_HOUR = 3600000;
const MS_DAY = 86400000;
function pad(n){ return String(n).padStart(2,"0"); }
function dateKey(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function dayStart(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, days){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()+days); }
function parseDateTime(date, time){
if(!date || !time) return null;
const [y,m,d] = date.split("-").map(Number);
const [hh,mm] = time.split(":").map(Number);
if(!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null;
return new Date(y,m-1,d,hh,mm,0,0);
}
function overlapHours(a1,a2,b1,b2){
return Math.max(0, Math.min(a2.getTime(),b2.getTime()) - Math.max(a1.getTime(),b1.getTime())) / MS_HOUR;
}
function subtractInterval(intervals, cutStart, cutEnd){
if(!cutStart || !cutEnd || cutEnd <= cutStart) return intervals;
const result=[];
intervals.forEach(([start,end])=>{
if(cutEnd<=start || cutStart>=end){ result.push([start,end]); return; }
if(cutStart>start) result.push([start,new Date(Math.min(cutStart,end))]);
if(cutEnd<end) result.push([new Date(Math.max(cutEnd,start)),end]);
});
return result.filter(([a,b])=>b>a);
}
function easterSunday(year){
const a=year%19, b=Math.floor(year/100), c=year%100;
const d=Math.floor(b/4), e=b%4, f=Math.floor((b+8)/25);
const g=Math.floor((b-f+1)/3), h=(19*a+b-d-g+15)%30;
const i=Math.floor(c/4), k=c%4, l=(32+2*e+2*i-h-k)%7;
const m=Math.floor((a+11*h+22*l)/451);
const month=Math.floor((h+l-7*m+114)/31);
const day=((h+l-7*m+114)%31)+1;
return new Date(year,month-1,day);
}
function holidayMap(year){
const easter=easterSunday(year);
const entries=[];
const add=(d,name)=>entries.push([dateKey(d),name]);
add(new Date(year,0,1),"Neujahr");
add(addDays(easter,-2),"Karfreitag");
add(easter,"Ostersonntag");
add(addDays(easter,1),"Ostermontag");
add(new Date(year,4,1),"Tag der Arbeit");
add(addDays(easter,39),"Christi Himmelfahrt");
add(addDays(easter,49),"Pfingstsonntag");
add(addDays(easter,50),"Pfingstmontag");
add(new Date(year,9,3),"Tag der Deutschen Einheit");
add(new Date(year,9,31),"Reformationstag");
add(new Date(year,11,25),"1. Weihnachtstag");
add(new Date(year,11,26),"2. Weihnachtstag");
return new Map(entries);
}
function holidayName(d){ return holidayMap(d.getFullYear()).get(dateKey(d)) || ""; }
function isSpecialAfternoon(d){ return d.getMonth()===11 && (d.getDate()===24 || d.getDate()===31); }
function tariffBaseRate(date, settings){
if(!settings.autoTariff) return Number(settings.baseRate)||0;
const t=dateKey(date);
if(t < "2026-03-01") return 14.60;
if(t < "2027-02-01") return 15.14;
return 15.70;
}
function resolveShiftIntervals(shift){
const warnings=[];
const start=parseDateTime(shift.date,shift.start);
const rawEnd=parseDateTime(shift.date,shift.end);
if(!start || !rawEnd) return {valid:false,warnings:["Bitte Datum, Beginn und Ende vollständig eintragen."]};
let end=new Date(rawEnd);
if(end<=start) end=new Date(end.getTime()+MS_DAY);
const duration=(end-start)/MS_HOUR;
if(duration>18) warnings.push("Die Schicht ist länger als 18 Stunden. Bitte die Uhrzeiten prüfen.");
let pauseStart=null,pauseEnd=null;
if(Boolean(shift.pauseStart)!==Boolean(shift.pauseEnd)){
warnings.push("Für die Pause müssen Beginn und Ende eingetragen sein.");
} else if(shift.pauseStart && shift.pauseEnd){
pauseStart=parseDateTime(shift.date,shift.pauseStart);
pauseEnd=parseDateTime(shift.date,shift.pauseEnd);
if(pauseStart<start) pauseStart=new Date(pauseStart.getTime()+MS_DAY);
if(pauseEnd<=pauseStart) pauseEnd=new Date(pauseEnd.getTime()+MS_DAY);
if(pauseStart<start || pauseEnd>end || pauseStart>=end){
warnings.push("Die Pause liegt nicht vollständig innerhalb der Schicht.");
}
}
let intervals=[[start,end]];
if(pauseStart && pauseEnd){
const cutStart=new Date(Math.max(start,pauseStart));
const cutEnd=new Date(Math.min(end,pauseEnd));
if(cutEnd>cutStart) intervals=subtractInterval(intervals,cutStart,cutEnd);
}
return {valid:true,start,end,pauseStart,pauseEnd,intervals,warnings};
}
function calculateShift(shift, settings, previousMonthHours=0){
const resolved=resolveShiftIntervals(shift);
const empty={valid:false,warnings:resolved.warnings||[],paidHours:0,nightHours:0,saturdayHours:0,saturdayPremiumHours:0,sundayHours:0,holidayHours:0,overtimeHours:0,baseRate:0,regularRate:0,premiumRate:0,basePay:0,nightPay:0,saturdayPay:0,sundayPay:0,holidayPay:0,overtimePay:0,totalPay:0,holidayNames:[]};
if(!resolved.valid) return empty;
let paidHours=0, nightHours=0, saturdayHours=0, saturdayPremiumHours=0, sundayHours=0, holidayHours=0;
const holidayNames=new Set();
resolved.intervals.forEach(([workStart,workEnd])=>{
paidHours += (workEnd-workStart)/MS_HOUR;
for(let d=dayStart(workStart); d<workEnd; d=addDays(d,1)){
const next=addDays(d,1);
const dayHours=overlapHours(workStart,workEnd,d,next);
if(dayHours<=0) continue;
const fullHoliday=holidayName(d);
if(fullHoliday){
holidayHours += dayHours;
holidayNames.add(fullHoliday);
} else if(isSpecialAfternoon(d)){
const from14=new Date(d.getFullYear(),d.getMonth(),d.getDate(),14,0,0,0);
const specialHours=overlapHours(workStart,workEnd,from14,next);
holidayHours += specialHours;
if(specialHours>0) holidayNames.add(d.getDate()===24?"Heiligabend ab 14 Uhr":"Silvester ab 14 Uhr");
const normalHours=dayHours-specialHours;
if(d.getDay()===0) sundayHours += normalHours;
if(d.getDay()===6){ saturdayHours += dayHours; saturdayPremiumHours += normalHours; }
} else {
if(d.getDay()===0) sundayHours += dayHours;
if(d.getDay()===6){ saturdayHours += dayHours; saturdayPremiumHours += dayHours; }
}
const earlyEnd=new Date(d.getFullYear(),d.getMonth(),d.getDate(),6,0,0,0);
const lateStart=new Date(d.getFullYear(),d.getMonth(),d.getDate(),20,0,0,0);
nightHours += overlapHours(workStart,workEnd,d,earlyEnd);
nightHours += overlapHours(workStart,workEnd,lateStart,next);
}
});
const overtimeLimit=Number(settings.overtimeLimit)||0;
const overtimeHours=Math.max(0,previousMonthHours+paidHours-overtimeLimit)-Math.max(0,previousMonthHours-overtimeLimit);
const baseRate=tariffBaseRate(resolved.start,settings);
const objectBonus=Number(settings.objectBonus)||0;
const regularRate=baseRate+objectBonus;
const premiumRate=baseRate+(settings.bonusInPremiumBase?objectBonus:0);
const basePay=paidHours*regularRate;
const nightPay=nightHours*premiumRate*(Number(settings.nightPct)||0)/100;
const saturdayPay=saturdayPremiumHours*premiumRate*(Number(settings.saturdayPct)||0)/100;
const sundayPay=sundayHours*premiumRate*(Number(settings.sundayPct)||0)/100;
const holidayPay=holidayHours*premiumRate*(Number(settings.holidayPct)||0)/100;
const overtimePay=overtimeHours*premiumRate*(Number(settings.overtimePct)||0)/100;
return {
valid:true,warnings:resolved.warnings,paidHours,nightHours,saturdayHours,saturdayPremiumHours,sundayHours,holidayHours,overtimeHours,
baseRate,regularRate,premiumRate,basePay,nightPay,saturdayPay,sundayPay,holidayPay,overtimePay,
totalPay:basePay+nightPay+saturdayPay+sundayPay+holidayPay+overtimePay,
holidayNames:[...holidayNames],start:resolved.start,end:resolved.end
};
}
function calculateMonth(shifts, month, settings){
const selected=shifts.filter(s=>s.date && s.date.slice(0,7)===month).slice().sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
let running=0;
const items=selected.map(shift=>{
const calc=calculateShift(shift,settings,running);
if(calc.valid) running+=calc.paidHours;
return {shift,calc};
});
const keys=["paidHours","nightHours","saturdayHours","sundayHours","holidayHours","overtimeHours","basePay","nightPay","saturdayPay","sundayPay","holidayPay","overtimePay","totalPay"];
const totals=Object.fromEntries(keys.map(k=>[k,0]));
items.forEach(({calc})=>{ if(calc.valid) keys.forEach(k=>totals[k]+=calc[k]||0); });
return {items,totals};
}
function previousHoursForShift(shifts, draft, settings, editingId){
if(!draft.date || !draft.start) return 0;
const month=draft.date.slice(0,7), marker=draft.date+draft.start;
return shifts.filter(s=>s.id!==editingId && s.date && s.date.slice(0,7)===month && (s.date+s.start)<marker)
.sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start))
.reduce((sum,s)=>{ const c=calculateShift(s,settings,sum); return sum+(c.valid?c.paidHours:0); },0);
}
const api={dateKey,parseDateTime,easterSunday,holidayMap,holidayName,tariffBaseRate,resolveShiftIntervals,calculateShift,calculateMonth,previousHoursForShift};
if(typeof module!=="undefined" && module.exports) module.exports=api;
global.TimeSheetCore=api;
})(typeof window!=="undefined"?window:globalThis);