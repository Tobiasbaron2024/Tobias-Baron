import { berechne, urlaubArbeitstag, schichtZeitraum } from './calc.js?v=10';
export const clean = v => String(v ?? '').trim();
export function isoDate(value, month) {
  const s=clean(value).replace(/^(Mo|Di|Mi|Do|Fr|Sa|So)\.?\s+/i,''), m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s) || /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s)?.slice(1).reverse();
  let iso;
  if(m) iso=m.length===4?`${m[1]}-${m[2]}-${m[3]}`:`${m[0]}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;
  else if(/^\d{1,2}\.?$/.test(s)&&/^\d{4}-\d{2}$/.test(month))iso=month+'-'+s.replace('.','').padStart(2,'0');
  else if(/^\d{1,2}\.\d{1,2}\.?$/.test(s)&&month){const[d,mo]=s.split('.');iso=month.slice(0,4)+'-'+mo.padStart(2,'0')+'-'+d.padStart(2,'0');}
  if(!iso)return null;
  const d=new Date(iso+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===iso?iso:null;
}
export function timeRange(text) {
  const m=/^(\d{1,2})(?::([0-5]\d))?\s*[-–—]\s*(\d{1,2})(?::([0-5]\d))?(?:\s*Uhr)?$/i.exec(clean(text));
  if(!m||+m[1]>23||+m[3]>23)return null;
  const beginn=m[1].padStart(2,'0')+':'+(m[2]||'00'),ende=m[3].padStart(2,'0')+':'+(m[4]||'00');
  return beginn===ende?null:{art:'dienst',beginn,ende,pause:0};
}
export function readDelimited(text) {
  const t=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  const first=t.split('\n').find(l=>/[\t;,]/.test(l))||'';
  const delimiter=['\t',';',','].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
  if(!first)return t.split('\n').filter(l=>l.trim()).map(l=>l.trim().split(/\s{2,}/));
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<=t.length;i++){
    const ch=t[i];
    if(ch==='"'){if(quoted&&t[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&(ch===delimiter||ch==='\n'||ch===undefined)){row.push(cell);cell='';if(ch!==delimiter){if(row.some(clean))rows.push(row);row=[];}}
    else cell+=ch;
  }
  if(quoted)throw new Error('Eine Textzelle hat ein nicht geschlossenes Anführungszeichen.');
  return rows;
}
const label = s=>clean(s).toLocaleLowerCase('de').replace(/[\s_-]+/g,'');
export function parsePlan(matrix, month) {
  const rows=matrix.map(r=>r.map(clean)),entries=[],warnings=[];
  const find=(r,terms)=>r.findIndex(v=>terms.includes(label(v)));
  const long=rows.findIndex(r=>find(r,['name','mitarbeiter','mitarbeitername','person'])>=0&&find(r,['datum','date','tag'])>=0);
  if(long>=0){
    const h=rows[long],n=find(h,['name','mitarbeiter','mitarbeitername','person']),d=find(h,['datum','date','tag']),k=find(h,['kürzel','kuerzel','schicht','dienst']),a=find(h,['beginn','von','start']),b=find(h,['ende','bis']),p=find(h,['pause','pausemin','pause(min)']),o=find(h,['objekt','einsatzort']);
    rows.slice(long+1).forEach((r,i)=>{
      if(!r[n])return;const datum=isoDate(r[d],month);if(!datum){warnings.push(`Zeile ${long+i+2}: Datum nicht erkannt.`);return;}
      let code=r[k]||'';if(a>=0&&b>=0&&r[a]&&r[b])code=`${r[a]}–${r[b]}`;
      if(code)entries.push({name:r[n],datum,code,pause:p>=0&&r[p]!==''?r[p]:undefined,object:o>=0?r[o]:'',sourceRow:long+i+2});
    });
  }else{
    const grid=rows.findIndex(r=>r.filter(v=>isoDate(v,month)).length>=2);
    if(grid<0)return {entries:[],warnings:['Keine Datumsspalten erkannt. Prüfe den Monat und die Tabelle. Unterstützt werden Namenszeilen mit Datumsspalten oder Name/Datum/Kürzel-Spalten.']};
    const h=rows[grid],cols=h.map((v,i)=>({date:isoDate(v,month),i})).filter(c=>c.date),first=cols[0].i;
    if(first===0)return {entries:[],warnings:['Vor den Datumsspalten fehlt eine Spalte für den Namen.']};
    const nameCol=find(h,['name','mitarbeiter','mitarbeitername','person']);
    const dates=cols.map(c=>c.date);if(new Set(dates).size!==dates.length)return {entries:[],warnings:['Doppelte Datumsspalten. Bitte die Tabelle korrigieren.']};
    rows.slice(grid+1).forEach((r,j)=>{
      const name=nameCol>=0?r[nameCol]:r.slice(0,first).filter(Boolean).join(' ');
      if(!name||/^(summe|gesamt|legende|mo|di|mi|do|fr|sa|so)$/i.test(name))return;
      for(const c of cols)if(r[c.i]&&r[c.i]!=='-'&&r[c.i]!=='·')entries.push({name,datum:c.date,code:r[c.i],pause:undefined,object:'',sourceRow:grid+j+2});
    });
  }
  if(entries.length>3000)throw new Error('Bitte höchstens 3.000 belegte Planzellen auf einmal auslesen.');
  return {entries,warnings};
}
// Rekonstruiert Tabelle anhand echter Wortpositionen; leere Tage verschieben keine Spalten.
export function positionedRows(items, month) {
  const groups=[];
  for(const t of items.filter(t=>clean(t.text)).sort((a,b)=>a.y-b.y||a.x-b.x)){
    let r=groups.find(g=>Math.abs(g.y-t.y)<=Math.max(3,Math.min(t.height||10,g.height||10)*.4));
    if(!r){r={y:t.y,height:t.height,cells:[]};groups.push(r);}r.cells.push(t);
  }
  groups.sort((a,b)=>a.y-b.y);groups.forEach(g=>g.cells.sort((a,b)=>a.x-b.x));
  const header=groups.find(g=>g.cells.filter(t=>isoDate(t.text,month)).length>=2);
  if(!header)return groups.map(g=>g.cells.map(t=>t.text));
  const cols=header.cells.filter(t=>isoDate(t.text,month));
  const centres=cols.map(t=>t.x+(t.width||0)/2),edge=cols[0].x-3;
  const result=[['Name',...cols.map(t=>t.text)]];
  for(const g of groups.filter(g=>g.y>header.y+3)){
    const cells=Array.from({length:cols.length+1},()=>[]);
    for(const t of g.cells){
      const x=t.x+(t.width||0)/2;
      if(t.x<edge)cells[0].push(t.text);
      else {let i=0;while(i<centres.length-1&&x>(centres[i]+centres[i+1])/2)i++;cells[i+1].push(t.text);}
    }
    result.push(cells.map(c=>c.join(' ')));
  }
  return result;
}
export function legendMappings(text) {
  const result={};
  for(const line of String(text).split('\n')){const m=/^\s*([\p{L}\d_-]{1,12})\s*[=:]\s*(.+)\s*$/u.exec(line);if(!m)continue;
    const range=timeRange(m[2]);if(range)result[m[1]]=range;
    else {const art={urlaub:'urlaub',krank:'krank',krankheit:'krank',frei:'frei'}[m[2].trim().toLowerCase()];if(art)result[m[1]]={art};}
  }return result;
}
export function resolveEntry(row, mappings, cfg) {
  if(!isoDate(row.datum))return {error:'Datum ungültig'};
  const mapping=timeRange(row.code)||mappings[row.code];
  if(!mapping?.art)return {error:'Kürzel noch nicht zugeordnet'};
  const pause=Number(String(row.pause??mapping.pause??0).replace(',','.'));
  if(!Number.isFinite(pause)||pause<0||pause>600)return {error:'Pause ungültig'};
  const sh={datum:row.datum,art:mapping.art,kuerzel:timeRange(row.code)?null:row.code,beginn:null,ende:null,pause_min:0,stunden:null};
  if(mapping.art==='dienst'){
    if(!timeRange(`${mapping.beginn}–${mapping.ende}`))return {error:'Dienstzeiten fehlen oder sind ungültig'};
    Object.assign(sh,{beginn:mapping.beginn,ende:mapping.ende,pause_min:pause});
    const calc=berechne(sh,cfg);if(calc.zeitFehler)return {error:calc.zeitFehler};if(pause>=calc.std*60+pause)return {error:'Pause umfasst den ganzen Dienst'};
  }else if(mapping.art==='urlaub'){
    if(!urlaubArbeitstag(cfg,row.datum))return {skip:true,reason:'Kein Urlaubstag (Feiertag oder freier Wochentag)'};
    sh.stunden=Number(cfg.urlaub_std)||0;
  }else if(mapping.art==='krank')sh.stunden=Number(cfg.krank_std)||0;
  else if(mapping.art==='frei')sh.stunden=0;
  else return {error:'Eintragsart ungültig'};
  return {shift:sh,hours:berechne(sh,cfg).std};
}
export function planSummary(entries,mappings,cfg){
  const names=[...new Set(entries.map(e=>e.name))];return names.map(name=>{
    const rows=entries.filter(e=>e.name===name),days=new Set(),sat=new Set(),sun=new Set(),free=new Set();let hours=0,unknown=0;
    for(const row of rows){const r=resolveEntry(row,mappings,cfg);if(r.error){unknown++;continue;}if(r.shift?.art==='dienst'){hours+=r.hours;days.add(row.datum);const d=new Date(row.datum+'T00:00:00Z').getUTCDay();if(d===6)sat.add(row.datum);if(d===0)sun.add(row.datum);}if(r.shift?.art==='frei')free.add(row.datum);}
    return {name,hours,workdays:days.size,saturdays:sat.size,sundays:sun.size,free:free.size,unknown};
  });
}

export function importOverlap(a,b){
  const range=s=>s.art==='frei'?null:schichtZeitraum(s.art==='dienst'?s:{datum:s.datum,beginn:'00:00',ende:'00:00'});
  const x=range(a),y=range(b);return !!(x&&y&&!x.error&&!y.error&&x.start<y.ende&&y.start<x.ende);
}
