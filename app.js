
const SB_URL = "https://qoluhdfpchotpftvnswy.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvbHVoZGZwY2hvdHBmdHZuc3d5IiwiaWF0IjoxNzkwMzI3MDQ3LCJleHAiOjIxMDU5MDMwNDN9.hSX-s9HZDuDb8tFFxDY0iiTzQV1tuDGPUy1-FVtUsLI";

const state = {
  view: "home", session: null, profile: null, access: null,
  recurring: [], tx: [], planned: [], budgets: [], benchmarks: [],
  periodOffset: 0, loaded: false, editId: null, modal: null, whatIf: ""
};

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const eur = n => new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(Math.round((Number(n)||0)*100)/100);
const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const iso = d => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0");
};
const date = s => new Date(String(s).slice(0,10)+"T00:00:00");
const de = s => date(s).toLocaleDateString("de-DE");
const daysBetween = (a,b) => Math.round((date(iso(b))-date(iso(a)))/86400000);
const addMonths = (d,n) => new Date(d.getFullYear(), d.getMonth()+n, d.getDate());
const addDays = (d,n) => new Date(d.getFullYear(), d.getMonth(), d.getDate()+n);
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));

const CATS = {
  lebensmittel:"Lebensmittel", drogerie:"Drogerie", essen:"Essen & Lieferdienst",
  mobil:"Tanken & Fahrten", freizeit:"Freizeit", shopping:"Shopping & Kleidung",
  haushalt:"Haushalt", gesundheit:"Apotheke & Gesundheit", tier:"Haustier",
  geschenke:"Geschenke", sonstiges:"Sonstiges", wohnen:"Miete & Wohnen",
  energie:"Strom & Gas", handy:"Handy", internet:"Internet & TV",
  versicherung:"Versicherung", abo:"Streaming & Abos", mobil_fix:"Auto & ÖPNV",
  fitness:"Fitness", bank:"Bank & Konto", kredit:"Kredit & Raten",
  rundfunk:"Rundfunkbeitrag", gehalt:"Gehalt", nebenjob:"Nebenjob",
  erstattung:"Erstattung", verkauf:"Verkauf", sonst_ein:"Sonstige Einnahme"
};

const CAT_GROUPS = {
  out:["lebensmittel","drogerie","essen","mobil","freizeit","shopping","haushalt","gesundheit","tier","geschenke","sonstiges"],
  fix:["wohnen","energie","handy","internet","versicherung","abo","mobil_fix","fitness","bank","kredit","rundfunk"],
  in:["gehalt","nebenjob","erstattung","verkauf","sonst_ein"]
};

const icon = {
  home:"⌂", book:"▤", plan:"◷", stats:"▥", tip:"✦", settings:"⚙", plus:"+", close:"×"
};

function storeSession(s){ state.session=s; if(s) localStorage.setItem("groschen.session",JSON.stringify(s)); else localStorage.removeItem("groschen.session"); }
function loadSession(){ try{state.session=JSON.parse(localStorage.getItem("groschen.session")||"null")}catch{state.session=null} }

async function auth(path, body){
  const r=await fetch(SB_URL+"/auth/v1/"+path,{
    method:"POST", headers:{apikey:SB_KEY,"Content-Type":"application/json"}, body:JSON.stringify(body)
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error_description||d.msg||d.message||"Anmeldung fehlgeschlagen.");
  return d;
}

function headers(){
  return {apikey:SB_KEY,"Content-Type":"application/json",Authorization:"Bearer "+(state.session?.access_token||SB_KEY)};
}

async function rest(table, query="", opts={}){
  const r=await fetch(SB_URL+"/rest/v1/"+table+(query?"?"+query:""),{
    ...opts, headers:{...headers(),...(opts.headers||{})}
  });
  if(!r.ok){
    const d=await r.json().catch(()=>({}));
    throw new Error(d.message||("Fehler "+r.status));
  }
  const t=await r.text(); return t?JSON.parse(t):null;
}

async function loadData(){
  if(!state.session?.user?.id) return;
  const uid=state.session.user.id;
  const since=iso(new Date(new Date().getFullYear(),new Date().getMonth()-13,1));
  const [p,a,r,t,pl,b,bench]=await Promise.all([
    rest("profiles","user_id=eq."+uid+"&select=*"),
    rest("account_access","user_id=eq."+uid+"&select=*"),
    rest("recurring","user_id=eq."+uid+"&select=*&order=created_at.asc"),
    rest("transactions","user_id=eq."+uid+"&tx_date=gte."+since+"&select=*&order=tx_date.desc,created_at.desc&limit=5000"),
    rest("planned_transactions","user_id=eq."+uid+"&tx_date=gte."+since+"&select=*&order=tx_date.asc"),
    rest("budgets","user_id=eq."+uid+"&select=*"),
    rest("spending_benchmarks","select=*")
  ]);
  state.profile=p?.[0]||{user_id:uid,payday:1,savings_goal:0,household_size:1,display_name:""};
  state.access=a?.[0]||null;
  state.recurring=(r||[]).map(x=>({...x,amount:num(x.amount)}));
  state.tx=(t||[]).map(x=>({...x,amount:num(x.amount)}));
  state.planned=(pl||[]).map(x=>({...x,amount:num(x.amount)}));
  state.budgets=(b||[]).map(x=>({...x,amount:num(x.amount)}));
  state.benchmarks=(bench||[]).map(x=>({...x,monthly_eur:num(x.monthly_eur)}));
  state.loaded=true;
}

function period(offset=0){
  const payday=clamp(num(state.profile?.payday)||1,1,28);
  const today=new Date();
  let base=new Date(today.getFullYear(),today.getMonth(),payday);
  if(today.getDate()<payday) base=new Date(today.getFullYear(),today.getMonth()-1,payday);
  const start=new Date(base.getFullYear(),base.getMonth()+offset,payday);
  const end=new Date(start.getFullYear(),start.getMonth()+1,payday-1);
  return {start,end,today: new Date(today.getFullYear(),today.getMonth(),today.getDate()),days:daysBetween(start,end)+1};
}

function recurringDates(r,c){
  const first=r.valid_from ? date(r.valid_from) : c.start;
  const last=r.valid_to ? date(r.valid_to) : c.end;
  if(last<c.start || first>c.end) return [];
  const step=num(r.interval_months)||1;
  const out=[];
  let d=new Date(first);
  while(d<c.start) d=addMonths(d,step);
  while(d<=c.end && d<=last){
    out.push(d); d=addMonths(d,step);
  }
  return out;
}

function compute(offset=0){
  const c=period(offset);
  const tx=state.tx.filter(x=>x.tx_date>=iso(c.start)&&x.tx_date<=iso(c.end));
  const planned=state.planned.filter(x=>x.tx_date>=iso(c.start)&&x.tx_date<=iso(c.end));
  const recActive=state.recurring.filter(r=>recurringDates(r,c).length>0);
  let recIn=0,recOut=0;
  recActive.forEach(r=>{
    const total=r.amount*recurringDates(r,c).length;
    if(r.kind==="in") recIn+=total; else recOut+=total;
  });
  const actualIn=tx.filter(x=>x.kind==="in").reduce((s,x)=>s+x.amount,0);
  const actualOut=tx.filter(x=>x.kind==="out").reduce((s,x)=>s+x.amount,0);
  const plannedIn=planned.filter(x=>x.kind==="in").reduce((s,x)=>s+x.amount,0);
  const plannedOut=planned.filter(x=>x.kind==="out").reduce((s,x)=>s+x.amount,0);
  const available=recIn+actualIn+plannedIn-recOut-(num(state.profile?.savings_goal)||0);
  const before=tx.filter(x=>x.kind==="out"&&date(x.tx_date)<c.today).reduce((s,x)=>s+x.amount,0);
  const todayActual=tx.filter(x=>x.kind==="out"&&x.tx_date===iso(c.today)).reduce((s,x)=>s+x.amount,0);
  const futureActual=tx.filter(x=>x.kind==="out"&&date(x.tx_date)>c.today).reduce((s,x)=>s+x.amount,0);
  const todayPlanned=planned.filter(x=>x.kind==="out"&&x.tx_date===iso(c.today)).reduce((s,x)=>s+x.amount,0);
  const futurePlanned=planned.filter(x=>x.kind==="out"&&date(x.tx_date)>c.today).reduce((s,x)=>s+x.amount,0);
  const isCurrent=offset===0;
  const daysLeft=isCurrent?Math.max(1,daysBetween(c.today,c.end)+1):c.days;
  const daysElapsed=isCurrent?Math.max(1,daysBetween(c.start,c.today)+1):c.days;
  const remaining=available-before-futureActual-futurePlanned;
  const daily=remaining/daysLeft;
  const todayLeft=daily-todayActual-todayPlanned;
  const avg=daysElapsed?((before+todayActual)/daysElapsed):0;
  const forecast=remaining-(avg*daysLeft)-todayActual;
  const byCat={};
  tx.filter(x=>x.kind==="out").forEach(x=>byCat[x.category]=(byCat[x.category]||0)+x.amount);
  planned.filter(x=>x.kind==="out").forEach(x=>byCat[x.category]=(byCat[x.category]||0)+x.amount);
  const dailyRows=[];
  for(let i=0;i<c.days;i++){
    const d=addDays(c.start,i), k=iso(d);
    const spent=tx.filter(x=>x.kind==="out"&&x.tx_date===k).reduce((s,x)=>s+x.amount,0);
    const pl=planned.filter(x=>x.kind==="out"&&x.tx_date===k).reduce((s,x)=>s+x.amount,0);
    dailyRows.push({date:d,spent,planned:pl});
  }
  return {c,tx,planned,available,recIn,recOut,actualIn,actualOut,plannedIn,plannedOut,before,todayActual,futureActual,todayPlanned,futurePlanned,daysLeft,daysElapsed,remaining,daily,todayLeft,avg,forecast,byCat,dailyRows};
}

function accessOk(){
  if(!state.access) return false;
  if(state.access.status==="active") return true;
  if(state.access.status==="trialing" && new Date(state.access.trial_ends_at)>new Date()) return true;
  return false;
}

function statusText(){
  if(!state.access) return "Kein Zugang";
  if(state.access.status==="trialing") return "Testphase";
  if(state.access.status==="active") return state.access.plan_name==="jahr"?"Jahresabo":"Abo aktiv";
  return "Abo beendet";
}

function saveProfile(body){
  return rest("profiles","user_id=eq."+state.session.user.id,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(body)});
}
function upsert(table,body,query){
  return rest(table,query||"",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(body)});
}

function layout(){
  const root=$("#app");
  if(!state.session){ root.innerHTML=authView(); return; }
  root.innerHTML=
    '<div class="shell">'+
      '<aside class="side"><div class="brand"><span class="brand-g">G</span> Groschen</div>'+
      nav("home","Übersicht",icon.home)+
      nav("book","Buchungen",icon.book)+
      nav("plan","Planung",icon.plan)+
      nav("stats","Analyse",icon.stats)+
      nav("tips","Spartipps",icon.tip)+
      nav("settings","Konto",icon.settings)+
      '</aside>'+
      '<main class="main">'+topbar()+content()+'</main>'+
      '<nav class="bottom">'+
        nav("home","Übersicht",icon.home)+nav("book","Buchungen",icon.book)+nav("plan","Planung",icon.plan)+nav("stats","Analyse",icon.stats)+nav("tips","Tipps",icon.tip)+nav("settings","Konto",icon.settings)+
      '</nav>'+
    '</div>';
}

function nav(v,label,ic){
  return '<button class="nav '+(state.view===v?"on":"")+'" data-go="'+v+'"><span class="nav-ic">'+ic+'</span><span>'+label+'</span></button>';
}
function topbar(){
  const titles={home:"Übersicht",book:"Buchungen",plan:"Planung",stats:"Analyse",tips:"Spartipps",settings:"Konto & Einstellungen"};
  return '<header class="top"><div><div class="eyebrow">'+esc(statusText())+'</div><h1>'+titles[state.view]+'</h1></div>'+
    (state.view!=="settings"?'<button class="primary compact" data-new-expense>'+icon.plus+' Ausgabe</button>':"")+
  '</header>';
}

function content(){
  if(!accessOk() && state.view!=="settings") return '<section class="card"><div class="empty"><h2>Deine Testphase ist beendet</h2><p>Die Daten bleiben gespeichert. Mit einem aktiven Zugang kannst du wieder buchen und planen.</p></div></section>';
  if(state.view==="book") return viewBook();
  if(state.view==="plan") return viewPlan();
  if(state.view==="stats") return viewStats();
  if(state.view==="tips") return viewTips();
  if(state.view==="settings") return viewSettings();
  return viewHome();
}

function actionMessage(c){
  if(c.todayLeft<0) return {level:"bad",title:"Heute aufpassen",text:"Du hast dein heutiges Limit bereits um "+eur(-c.todayLeft)+" überschritten."};
  if(c.daily<0) return {level:"bad",title:"Budget überschritten",text:"Bis zum nächsten Zahltag ist rechnerisch kein freies Tagesbudget mehr da."};
  if(c.daily<10) return {level:"warn",title:"Heute sparsam sein",text:"Plane heute höchstens "+eur(Math.max(0,c.todayLeft))+" ein. Einen Einkauf um einen Tag zu verschieben kann schon helfen."};
  if(c.forecast<0) return {level:"warn",title:"Prognose wird knapp",text:"Bei deinem bisherigen Tempo könntest du bis zum Periodenende etwa "+eur(-c.forecast)+" zu viel ausgeben."};
  return {level:"good",title:"Du liegst im Plan",text:"Heute stehen dir rechnerisch noch "+eur(Math.max(0,c.todayLeft))+" zur Verfügung."};
}

function viewHome(){
  const c=compute(0), msg=actionMessage(c);
  const tomorrow=c.daysLeft>1?(c.remaining-c.todayActual-c.todayPlanned)/(c.daysLeft-1):0;
  const cats=Object.entries(c.byCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const plannedNext=state.planned.filter(x=>x.tx_date>=iso(new Date())).sort((a,b)=>a.tx_date.localeCompare(b.tx_date)).slice(0,4);
  return '<div class="grid home">'+
    '<section class="hero '+msg.level+'"><div class="hero-label">Heute noch verfügbar</div><div class="hero-money">'+eur(c.todayLeft)+'</div>'+
      '<div class="hero-meta">Tageslimit '+eur(Math.max(0,c.daily))+' · Zeitraum '+de(c.c.start)+' bis '+de(c.c.end)+'</div>'+
      '<div class="meter"><i style="width:'+clamp((c.todayActual+c.todayPlanned)/Math.max(1,c.daily)*100,0,100)+'%"></i></div>'+
      '<div class="hero-actions"><span>'+msg.title+'</span><button class="ghost" data-save-day>Heute nichts mehr ausgeben</button></div>'+
    '</section>'+
    '<section class="card"><div class="card-title"><h2>Was du jetzt wissen musst</h2></div><div class="notice '+msg.level+'"><b>'+esc(msg.title)+'</b><p>'+esc(msg.text)+'</p></div>'+
      '<div class="mini-grid">'+
        kpi("Rest im Zeitraum",eur(c.remaining),"")+
        kpi("Ø bisher / Tag",eur(c.avg),"")+
        kpi("Prognose",c.forecast>=0?"+"+eur(c.forecast):"-"+eur(-c.forecast),c.forecast>=0?"good":"bad")+
        kpi("Noch "+c.daysLeft+" Tage",eur(tomorrow),"")+
      '</div></section>'+
    '<section class="card span2"><div class="card-title"><h2>Deine größten Ausgaben</h2><span>aktueller Zeitraum</span></div>'+
      (cats.length?'<div class="rank">'+cats.map((x,i)=>'<div class="rank-row"><b>'+(i+1)+'. '+esc(CATS[x[0]]||x[0])+'</b><span>'+eur(x[1])+'</span></div>').join("")+'</div>':'<div class="empty">Noch keine Ausgaben.</div>')+
    '</section>'+
    '<section class="card"><div class="card-title"><h2>Geplante Ausgaben</h2><button class="text-btn" data-view-plan>Alle</button></div>'+
      (plannedNext.length?'<div class="list">'+plannedNext.map(plannedRow).join("")+'</div>':'<div class="empty">Noch keine geplanten Ausgaben.</div>')+
    '</section>'+
    '<section class="card"><div class="card-title"><h2>Was bringt morgen?</h2></div><p class="bigline">Wenn du heute <b>0 €</b> mehr ausgibst, kannst du morgen rechnerisch bis zu <b>'+eur(Math.max(0,tomorrow))+'</b> ausgeben.</p>'+
      '<div class="whatif"><input id="whatif" inputmode="decimal" placeholder="z. B. 20 €" value="'+esc(state.whatIf)+'"><button class="primary compact" data-whatif>Berechnen</button></div>'+
      '<p id="whatif-result" class="muted"></p></section>'+
  '</div>';
}

function kpi(label,value,cls){ return '<div class="kpi '+cls+'"><span>'+label+'</span><b>'+value+'</b></div>'; }
function plannedRow(x){return '<div class="list-row"><div><b>'+esc(x.note||CATS[x.category]||"Geplant")+'</b><small>'+de(x.tx_date)+' · '+esc(CATS[x.category]||x.category)+'</small></div><strong class="'+(x.kind==="in"?"income":"')+'">'+(x.kind==="in"?"+ ":"− ")+eur(x.amount)+'</strong></div>';}

function viewBook(){
  const c=compute(state.periodOffset);
  return '<section class="card">'+
    '<div class="split"><div><h2>Buchungen</h2><p class="muted">'+de(c.c.start)+' bis '+de(c.c.end)+'</p></div><div><button class="primary compact" data-new-expense>'+icon.plus+' Ausgabe</button><button class="secondary compact" data-new-income>Einnahme</button></div></div>'+
    '<div class="mini-grid">'+kpi("Ausgaben",eur(c.actualOut),"")+kpi("Einnahmen",eur(c.actualIn),"good")+kpi("Buchungen",c.tx.length,"")+'</div>'+
    '<div class="list top-gap">'+(c.tx.length?c.tx.map(txRow).join(""):'<div class="empty">Keine Buchungen in diesem Zeitraum.</div>')+'</div>'+
  '</section>';
}
function txRow(x){
  return '<button class="list-row click" data-edit-tx="'+esc(x.id)+'"><div><b>'+esc(x.note||CATS[x.category]||"Buchung")+'</b><small>'+de(x.tx_date)+' · '+esc(CATS[x.category]||x.category)+'</small></div><strong class="'+(x.kind==="in"?"income":"expense")+'">'+(x.kind==="in"?"+ ":"− ")+eur(x.amount)+'</strong></button>';
}

function viewPlan(){
  const c=compute(0);
  const rr=state.recurring.slice().sort((a,b)=>((a.valid_from||"")+(a.name||"")).localeCompare((b.valid_from||"")+(b.name||"")));
  return '<section class="card">'+
    '<div class="split"><div><h2>Planung</h2><p class="muted">Raten, zukünftige Anschaffungen und einmalige Kosten werden vorab eingerechnet.</p></div><button class="primary compact" data-new-planned>'+icon.plus+' Planen</button></div>'+
    '<div class="notice"><b>Rechenregel</b><p>Eine Rate wird erst ab ihrem Startdatum berücksichtigt und nach dem Enddatum automatisch nicht mehr berechnet. Menschliche Geduld ist endlich, die Rate nicht.</p></div>'+
    '<div class="section-label">Geplante Einzelposten</div>'+
    (state.planned.length?'<div class="list">'+state.planned.map(plannedRow).join("")+'</div>':'<div class="empty">Noch nichts geplant.</div>')+
    '<div class="section-label top-gap">Wiederkehrende Kosten und Einnahmen</div>'+
    (rr.length?'<div class="list">'+rr.map(recRow).join("")+'</div>':'<div class="empty">Noch keine regelmäßigen Posten.</div>')+
  '</section>';
}
function recRow(r){
  return '<button class="list-row click" data-edit-rec="'+esc(r.id)+'"><div><b>'+esc(r.name)+'</b><small>'+esc(CATS[r.category]||r.category)+' · '+(r.interval_months===1?"monatlich":r.interval_months+"-monatlich")+
    (r.valid_from?" · ab "+de(r.valid_from):"")+(r.valid_to?" · bis "+de(r.valid_to):"")+(r.cancel_by?" · kündbar bis "+de(r.cancel_by):"")+'</small></div><strong>'+eur(r.amount)+'</strong></button>';
}

function viewStats(){
  const c=compute(state.periodOffset), p=compute(state.periodOffset-1);
  const cats=Object.entries(c.byCat).sort((a,b)=>b[1]-a[1]);
  const budgets=state.budgets.map(b=>({b,spent:c.byCat[b.category]||0,pc:(c.byCat[b.category]||0)/b.amount*100}));
  const shopping=c.byCat.shopping||0;
  const benchmark=benchmarkForHousehold();
  const hist=[];
  for(let i=-5;i<=0;i++){const cc=compute(state.periodOffset+i);hist.push({label:cc.c.start.toLocaleDateString("de-DE",{month:"short"}),value:cc.actualOut+(cc.plannedOut||0)})}
  return '<section class="stack">'+
    '<section class="card"><div class="split"><div><h2>Analyse</h2><p class="muted">'+de(c.c.start)+' bis '+de(c.c.end)+'</p></div><div class="period"><button data-prev-period>‹</button><b>'+de(c.c.start)+' · '+de(c.c.end)+'</b><button data-next-period>›</button></div></div>'+
      '<div class="mini-grid">'+kpi("Ausgaben",eur(c.actualOut),"")+kpi("Ø / Tag",eur(c.avg),"")+kpi("Rest",eur(c.remaining),c.remaining<0?"bad":"good")+kpi("Prognose",c.forecast>=0?eur(c.forecast):"-"+eur(-c.forecast),c.forecast>=0?"good":"bad")+'</div>'+
    '</section>'+
    '<section class="card"><div class="card-title"><h2>Wo dein Geld hingeht</h2><span>nach Kategorie</span></div>'+
      (cats.length?'<div class="bars">'+cats.map(x=>barRow(CATS[x[0]]||x[0],x[1],Math.max(...cats.map(y=>y[1])))).join("")+'</div>':'<div class="empty">Noch keine Ausgaben.</div>')+
    '</section>'+
    '<section class="card"><div class="card-title"><h2>Budgets</h2><span>persönliche Grenzen</span></div>'+
      (budgets.length?'<div class="bars">'+budgets.map(x=>barRow(CATS[x.b.category]||x.b.category,x.spent,x.b.amount,x.pc>100?"bad":x.pc>85?"warn":"")).join("")+'</div>':'<div class="empty">Lege in Konto Budgets für einzelne Kategorien an.</div>')+
    '</section>'+
    '<section class="card"><div class="card-title"><h2>Entwicklung</h2><span>letzte 6 Zeiträume</span></div><div class="history">'+hist.map(h=>'<div><span>'+h.label+'</span><i style="height:'+clamp(h.value/(Math.max(...hist.map(z=>z.value),1))*120,2,120)+'px"></i><b>'+eur(h.value)+'</b></div>').join("")+'</div></section>'+
    '<section class="card"><div class="card-title"><h2>Klamotten & Shopping im Vergleich</h2></div>'+
      '<p>Dein Wert: <b>'+eur(shopping)+'</b> im Zeitraum. Richtwert für einen Haushalt: <b>'+eur(benchmark)+'</b> pro Monat.</p>'+
      '<p class="muted">Quelle: Statistisches Bundesamt, EVS 2023. Der Wert ist nur ein Vergleich, kein „richtiges“ Ausgabenniveau.</p>'+
      (shopping>benchmark?'<div class="notice warn"><b>Hier ist Sparpotenzial.</b><p>Du liegst derzeit etwa '+eur(shopping-benchmark)+' über diesem Richtwert. Prüfe die größten Einzelkäufe.</p></div>':"")+
    '</section>'+
  '</section>';
}
function barRow(label,val,max,cls=""){return '<div class="bar-row"><span>'+esc(label)+'</span><div class="bar-track"><i class="'+cls+'" style="width:'+clamp(val/Math.max(max,1)*100,0,100)+'%"></i></div><b>'+eur(val)+'</b></div>';}

function benchmarkForHousehold(){
  const n=clamp(num(state.profile?.household_size)||1,1,12);
  const key=n===1?"shopping_single":n===2?"shopping_two":"shopping";
  return state.benchmarks.find(x=>x.category===key)?.monthly_eur||111;
}

function buildTips(){
  const c=compute(0), tips=[];
  Object.entries(c.byCat).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{
    const b=state.budgets.find(x=>x.category===k);
    if(b && v>b.amount) tips.push({level:"warn",title:CATS[k]+" ist über Budget",text:"Du hast "+eur(v)+" ausgegeben, geplant waren "+eur(b.amount)+". Für den Rest des Zeitraums am besten dort pausieren.",save:v-b.amount});
  });
  const shopping=c.byCat.shopping||0;
  const bench=benchmarkForHousehold();
  if(shopping>bench*1.25) tips.push({level:"warn",title:"Shopping & Kleidung ist deutlich erhöht",text:"Du bist bei "+eur(shopping)+" und damit über dem Vergleichswert von "+eur(bench)+". Prüfe, ob ein paar Käufe bis zum nächsten Monat warten können.",save:Math.max(0,shopping-bench)});
  const food=c.byCat.lebensmittel||0;
  if(food>350) tips.push({level:"warn",title:"Lebensmittel sind diesen Monat hoch",text:"Du hast bereits "+eur(food)+" ausgegeben. Ein Einkaufstag mit fester Liste und ohne spontane Extras kann hier helfen.",save:null});
  const eat=c.byCat.essen||0;
  if(eat>100) tips.push({level:"warn",title:"Essen außer Haus wird teuer",text:"Restaurant und Lieferdienst liegen bei "+eur(eat)+". Zwei Bestellungen weniger können das Tagesbudget sichtbar entlasten.",save:null});
  if(c.forecast<0) tips.unshift({level:"warn",title:"Deine Prognose kippt",text:"Bei deinem bisherigen Tempo fehlen voraussichtlich "+eur(-c.forecast)+". Heute besser keine nicht notwendigen Ausgaben.",save:null});
  if(c.todayLeft<0) tips.unshift({level:"warn",title:"Heute nichts mehr ausgeben",text:"Du bist heute bereits "+eur(-c.todayLeft)+" über deinem Tageslimit. Verschiebe den Einkauf, sofern er nicht nötig ist.",save:null});
  if(c.todayLeft>=0&&c.todayLeft<10) tips.unshift({level:"warn",title:"Heute lieber vorsichtig",text:"Dir bleiben heute nur "+eur(c.todayLeft)+". Ein Tag ohne zusätzliche Ausgabe erhöht den Spielraum für morgen.",save:null});
  if(!tips.length) tips.push({level:"good",title:"Du liegst im Plan",text:"Aktuell gibt es keine auffällige Kategorie. Bleib bei deinem Tageslimit und prüfe die geplanten Kosten.",save:null});
  return tips.slice(0,8);
}

function viewTips(){
  const tips=buildTips(), pot=tips.reduce((s,t)=>s+(num(t.save)||0),0);
  return '<section class="stack"><section class="card"><div class="mini-grid">'+kpi("Aktuelle Hinweise",tips.length,"")+kpi("Sparpotenzial",pot?eur(pot):"–","good")+kpi("Tageslimit",eur(Math.max(0,compute(0).todayLeft)),"")+'</div></section>'+
    tips.map(tip=>'<article class="tip '+t.level+'"><div class="tip-mark">'+(t.level==="warn"?"!":"✓")+'</div><div><h3>'+esc(tip.title)+'</h3><p>'+esc(tip.text)+'</p>'+(tip.save?'<small>mögliches Sparpotenzial: ca. '+eur(tip.save)+'</small>':"")+'</div></article>').join("")+
    '<section class="card"><p class="muted">Die Hinweise werden jeden Zeitraum neu aus deinen aktuellen Buchungen, Budgets und Plandaten berechnet. So musst du nicht monatlich denselben Spruch lesen, nur weil die App ihn liebt.</p></section>'+
  '</section>';
}

function viewSettings(){
  const p=state.profile||{};
  return '<section class="stack">'+
    '<section class="card"><h2>Deine Planung</h2><div class="form-grid">'+
      field("Anzeigename","text","p-name",p.display_name||"")+
      field("Zahltag","number","p-payday",p.payday||1,"1–28")+
      field("Sparziel pro Zeitraum","number","p-save",p.savings_goal||0,"€")+
      field("Haushaltsgröße","number","p-household",p.household_size||1,"Personen")+
    '</div><button class="primary" data-save-profile>Speichern</button></section>'+
    '<section class="card"><h2>Deine Kategorie-Budgets</h2><div class="form-grid">'+
      CATS.lebensmittel?'<div class="budget-edit">'+state.budgets.map(b=>field(CATS[b.category]||b.category,"number","bud-"+b.category,b.amount)).join("")+'</div>':""+
    '</div><button class="primary" data-save-budgets>Budgets speichern</button></section>'+
    '<section class="card"><h2>Konto</h2><p class="settings-line"><span>Status</span><b>'+esc(statusText())+'</b></p><p class="settings-line"><span>E-Mail</span><b>'+esc(state.session.user?.email||"")+'</b></p><button class="secondary" data-logout>Abmelden</button></section>'+
  '</section>';
}

function field(label,type,id,value,help=""){
  return '<label class="field"><span>'+label+(help?' <small>'+help+'</small>':"")+'</span><input id="'+id+'" type="'+type+'" value="'+esc(value)+'"></label>';
}

function authView(){
  return '<div class="auth-wrap"><div class="auth-card"><div class="brand"><span class="brand-g">G</span> Groschen</div><h1>Jeden Tag wissen, was noch drin ist.</h1><p class="lead">Haushaltsbuch, Zukunftsplanung und Tagesbudget in einem.</p>'+
    '<label class="field"><span>E-Mail</span><input id="auth-email" type="email" autocomplete="email"></label>'+
    '<label class="field"><span>Passwort</span><input id="auth-password" type="password" autocomplete="current-password"></label>'+
    '<div class="auth-actions"><button class="primary" data-login>Anmelden</button><button class="secondary" data-register>Registrieren</button></div><p id="auth-msg" class="error"></p></div></div>';
}

function modal(){
  if(!state.modal) return "";
  const m=state.modal;
  let h='<div class="modal-back"><section class="modal"><div class="modal-head"><h2>'+esc(m.title)+'</h2><button class="icon-btn" data-close>'+icon.close+'</button></div>';
  if(m.type==="expense"||m.type==="income"){
    const x=m.item||{kind:m.type==="income"?"in":"out",tx_date:iso(new Date()),amount:"",category:m.type==="income"?"gehalt":"lebensmittel",note:""};
    h+=txForm(x);
  }else if(m.type==="planned"){
    const x=m.item||{kind:"out",tx_date:iso(addDays(new Date(),7)),amount:"",category:"shopping",note:""};
    h+=plannedForm(x);
  }else if(m.type==="rec"){
    const x=m.item||{kind:"out",name:"",amount:"",category:"kredit",interval_months:1,valid_from:iso(new Date()),valid_to:"",cancel_by:""};
    h+=recForm(x);
  }
  h+='</section></div>';
  return h;
}
function selectCats(type,val){
  const arr=type==="in"?CAT_GROUPS.in:CAT_GROUPS.out;
  const extra=type==="out"?CAT_GROUPS.fix:[];
  const all=arr.concat(extra.filter(x=>!arr.includes(x)));
  return '<select id="f-cat">'+all.map(k=>'<option value="'+k+'" '+(k===val?"selected":"")+'>'+esc(CATS[k])+'</option>').join("")+'</select>';
}
function txForm(x){
  return '<div class="form-grid">'+field("Datum","date","f-date",x.tx_date)+field("Betrag","number","f-amt",x.amount,"€")+
    '<label class="field"><span>Kategorie</span>'+selectCats(x.kind,x.category)+'</label>'+field("Notiz","text","f-note",x.note||"")+
    '</div><p id="form-error" class="error"></p><button class="primary block" data-save-tx data-kind="'+x.kind+'" data-id="'+esc(x.id||"")+'">Speichern</button>';
}
function plannedForm(x){
  return '<div class="notice"><b>Zukunft planen</b><p>Dieser Posten wird ab seinem Datum in die Budgetrechnung aufgenommen.</p></div><div class="form-grid">'+field("Datum","date","f-date",x.tx_date)+field("Betrag","number","f-amt",x.amount,"€")+
    '<label class="field"><span>Kategorie</span>'+selectCats("out",x.category)+'</label>'+field("Notiz","text","f-note",x.note||"")+
    '</div><p id="form-error" class="error"></p><button class="primary block" data-save-planned data-id="'+esc(x.id||"")+'">Speichern</button>';
}
function recForm(x){
  return '<div class="form-grid">'+field("Bezeichnung","text","f-name",x.name)+field("Betrag","number","f-amt",x.amount,"€")+
    '<label class="field"><span>Art</span><select id="f-kind"><option value="out" '+(x.kind==="out"?"selected":"")+'>Ausgabe</option><option value="in" '+(x.kind==="in"?"selected":"")+'>Einnahme</option></select></label>'+
    '<label class="field"><span>Kategorie</span>'+selectCats(x.kind,x.category)+'</label>'+
    '<label class="field"><span>Intervall</span><select id="f-int"><option value="1" '+(x.interval_months===1?"selected":"")+'>monatlich</option><option value="3" '+(x.interval_months===3?"selected":"")+'>alle 3 Monate</option><option value="6" '+(x.interval_months===6?"selected":"")+'>alle 6 Monate</option><option value="12" '+(x.interval_months===12?"selected":"")+'>jährlich</option></select></label>'+
    field("Gültig ab","date","f-from",x.valid_from||iso(new Date()))+field("Gültig bis","date","f-to",x.valid_to||"")+field("Kündbar bis","date","f-cancel",x.cancel_by||"")+
    '</div><p class="muted">Das Startdatum ist zugleich der erste Fälligkeitstermin. Nach „Gültig bis“ wird der Posten automatisch nicht mehr berücksichtigt.</p><p id="form-error" class="error"></p><div class="split"><button class="primary" data-save-rec data-id="'+esc(x.id||"")+'">Speichern</button>'+(x.id?'<button class="danger" data-delete-rec data-id="'+esc(x.id)+'">Löschen</button>':"")+'</div>';
}

function showModal(type,item){
  state.modal={type,item,title:type==="expense"?"Ausgabe":type==="income"?"Einnahme":type==="planned"?"Zukünftige Ausgabe":"Regelmäßiger Posten"};
  layout();
}
async function saveTx(btn){
  try{
    const body={tx_date:$("#f-date").value,amount:num($("#f-amt").value),kind:btn.dataset.kind,category:$("#f-cat").value,note:$("#f-note").value.trim()||null};
    if(!(body.amount>0)) throw new Error("Bitte einen Betrag größer als 0 eingeben.");
    if(btn.dataset.id) await rest("transactions","id=eq."+btn.dataset.id,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(body)});
    else await rest("transactions","",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(body)});
    state.modal=null; await loadData(); layout();
  }catch(e){$("#form-error").textContent=e.message;}
}
async function savePlanned(btn){
  try{
    const body={tx_date:$("#f-date").value,amount:num($("#f-amt").value),kind:"out",category:$("#f-cat").value,note:$("#f-note").value.trim()||null};
    if(!(body.amount>0)||!body.tx_date) throw new Error("Datum und Betrag müssen ausgefüllt sein.");
    if(btn.dataset.id) await rest("planned_transactions","id=eq."+btn.dataset.id,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(body)});
    else await rest("planned_transactions","",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(body)});
    state.modal=null; await loadData(); layout();
  }catch(e){$("#form-error").textContent=e.message;}
}
async function saveRec(btn){
  try{
    const body={kind:$("#f-kind").value,name:$("#f-name").value.trim(),amount:num($("#f-amt").value),category:$("#f-cat").value,interval_months:num($("#f-int").value),valid_from:$("#f-from").value||null,valid_to:$("#f-to").value||null,cancel_by:$("#f-cancel").value||null,is_one_time:false};
    if(!body.name||!(body.amount>0)) throw new Error("Bezeichnung und Betrag müssen ausgefüllt sein.");
    if(body.valid_from&&body.valid_to&&body.valid_to<body.valid_from) throw new Error("Das Enddatum darf nicht vor dem Startdatum liegen.");
    if(btn.dataset.id) await rest("recurring","id=eq."+btn.dataset.id,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(body)});
    else await rest("recurring","",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(body)});
    state.modal=null; await loadData(); layout();
  }catch(e){$("#form-error").textContent=e.message;}
}

async function saveProfileNow(){
  const body={display_name:$("#p-name").value.trim()||null,payday:clamp(num($("#p-payday").value)||1,1,28),savings_goal:Math.max(0,num($("#p-save").value)),household_size:clamp(num($("#p-household").value)||1,1,12),updated_at:new Date().toISOString()};
  await saveProfile(body); Object.assign(state.profile,body); layout();
}
async function saveBudgetsNow(){
  const rows=[];
  state.budgets.forEach(b=>rows.push({user_id:state.session.user.id,category:b.category,amount:Math.max(1,num($("#bud-"+b.category)?.value||b.amount))}));
  if(rows.length) await upsert("budgets",rows,"on_conflict=user_id,category");
  await loadData(); layout();
}

function runWhatIf(){
  const c=compute(0), n=Math.max(0,num($("#whatif").value));
  const tomorrow=c.daysLeft>1?(c.remaining-c.todayActual-c.todayPlanned-n)/(c.daysLeft-1):0;
  $("#whatif-result").textContent=n>0?("Wenn du heute noch "+eur(n)+" ausgibst, bleiben für morgen rechnerisch "+eur(Math.max(0,tomorrow))+" pro Tag."):("Bei 0 € heute bleiben für morgen "+eur(Math.max(0,tomorrow))+" pro Tag.");
}

document.addEventListener("click",async e=>{
  const go=e.target.closest("[data-go]"); if(go){state.view=go.dataset.go;state.periodOffset=0;state.modal=null;layout();return;}
  if(e.target.closest("[data-close]")){state.modal=null;layout();return;}
  if(e.target.closest("[data-new-expense]")){showModal("expense",null);return;}
  if(e.target.closest("[data-new-income]")){showModal("income",null);return;}
  if(e.target.closest("[data-new-planned]")){showModal("planned",null);return;}
  if(e.target.closest("[data-view-plan]")){state.view="plan";layout();return;}
  if(e.target.closest("[data-save-day]")){state.whatIf="0";layout();setTimeout(()=>$("#whatif")?.focus(),20);return;}
  if(e.target.closest("[data-whatif]")){runWhatIf();return;}
  if(e.target.closest("[data-login]")){
    try{const d=await auth("token?grant_type=password",{email:$("#auth-email").value.trim(),password:$("#auth-password").value});const s={access_token:d.access_token,refresh_token:d.refresh_token,user:d.user};storeSession(s);await loadData();layout();}
    catch(err){$("#auth-msg").textContent=err.message;}
    return;
  }
  if(e.target.closest("[data-register]")){
    try{const d=await auth("signup",{email:$("#auth-email").value.trim(),password:$("#auth-password").value});$("#auth-msg").textContent=d.session?"Konto erstellt.":"Konto erstellt. Bitte bestätige deine E-Mail und melde dich danach an.";}
    catch(err){$("#auth-msg").textContent=err.message;}
    return;
  }
  if(e.target.closest("[data-logout]")){storeSession(null);location.reload();return;}
  if(e.target.closest("[data-save-profile]")){await saveProfileNow();return;}
  if(e.target.closest("[data-save-budgets]")){await saveBudgetsNow();return;}
  if(e.target.closest("[data-prev-period]")){state.periodOffset--;layout();return;}
  if(e.target.closest("[data-next-period]")){state.periodOffset++;layout();return;}
  const et=e.target.closest("[data-edit-tx]"); if(et){const x=state.tx.find(z=>z.id===et.dataset.editTx);if(x)showModal(x.kind==="in"?"income":"expense",x);return;}
  const ep=e.target.closest("[data-edit-rec]"); if(ep){const x=state.recurring.find(z=>z.id===ep.dataset.editRec);if(x)showModal("rec",x);return;}
  const p=e.target.closest(".list-row.click"); if(p && p.dataset.editTx){const x=state.tx.find(z=>z.id===p.dataset.editTx);if(x)showModal(x.kind==="in"?"income":"expense",x);return;}
  if(e.target.closest("[data-save-tx]")){await saveTx(e.target.closest("[data-save-tx]"));return;}
  if(e.target.closest("[data-save-planned]")){await savePlanned(e.target.closest("[data-save-planned]"));return;}
  if(e.target.closest("[data-save-rec]")){await saveRec(e.target.closest("[data-save-rec]"));return;}
  const dr=e.target.closest("[data-delete-rec]"); if(dr){await rest("recurring","id=eq."+dr.dataset.id,{method:"DELETE"});state.modal=null;await loadData();layout();return;}
});

window.addEventListener("input",e=>{if(e.target.id==="whatif")state.whatIf=e.target.value;});
window.addEventListener("keydown",e=>{if(e.key==="Escape"&&state.modal){state.modal=null;layout();}});

function start(){
  loadSession();
  if(state.session){loadData().then(layout).catch(err=>{console.error(err);layout();});} else layout();
  setInterval(()=>{if(state.session&&state.loaded) { try{layout()}catch{} }},60000);
}
start();
