import { positionedRows, readDelimited } from './plan-import-core.js?v=1';
const XLSX_URL='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
const PDF_URL='https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/legacy/build/pdf.mjs';
const PDF_WORKER='https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/legacy/build/pdf.worker.mjs';
const OCR_URL='https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';
async function script(src,name){
  if(globalThis[name])return globalThis[name];
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.crossOrigin='anonymous';s.onload=resolve;s.onerror=()=>{s.remove();reject(new Error('Auslesebaustein konnte nicht geladen werden. Prüfe deine Internetverbindung.'));};document.head.appendChild(s);});
  return globalThis[name];
}
async function imageCanvas(blob){
  const url=URL.createObjectURL(blob);
  try {const image=new Image();image.src=url;await image.decode();if(image.width*image.height>40e6)throw new Error('Das Foto ist zu groß. Bitte einen Ausschnitt verwenden.');
    const factor=Math.min(2,2800/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*factor);canvas.height=Math.round(image.height*factor);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return canvas;
  }finally{URL.revokeObjectURL(url);}
}
function ocrItems(data){
  const items=[];for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[])for(const word of line.words||[]){const b=word.bbox;items.push({text:word.text,x:b.x0,y:b.y0,width:b.x1-b.x0,height:b.y1-b.y0});}return items;
}
export async function readPlanFile(file,month,progress=()=>{}){
  if(!file||file.size>15*1024*1024)throw new Error('Bitte eine Datei bis 15 MB auswählen.');
  const ext=file.name.split('.').pop().toLowerCase();progress('Datei wird gelesen …');
  if(['csv','tsv','txt'].includes(ext))return {sheets:[{name:file.name,rows:readDelimited(await file.text())}],ocr:false};
  if(['xlsx','xls','ods'].includes(ext)){
    const x=await script(XLSX_URL,'XLSX'),book=x.read(await file.arrayBuffer(),{type:'array',cellDates:true});
    const sheets=book.SheetNames.slice(0,20).map(name=>{
      const sheet=book.Sheets[name],range=sheet['!ref']?x.utils.decode_range(sheet['!ref']):null;
      const rows=x.utils.sheet_to_json(sheet,{header:1,raw:false,defval:'',blankrows:true});
      if(range)for(let r=range.s.r;r<=range.e.r;r++)for(let c=range.s.c;c<=range.e.c;c++){
        const cell=sheet[x.utils.encode_cell({r,c})];
        if(cell?.t==='d'&&cell.v instanceof Date&&cell.v.getFullYear()>=2000&&rows[r-range.s.r])rows[r-range.s.r][c-range.s.c]=`${cell.v.getFullYear()}-${String(cell.v.getMonth()+1).padStart(2,'0')}-${String(cell.v.getDate()).padStart(2,'0')}`;
      }
      return {name,rows};
    });
    if(sheets.some(s=>s.rows.length>1000||s.rows.some(r=>r.length>150)))throw new Error('Bitte einen kleineren Tabellenausschnitt mit höchstens 1.000 Zeilen und 150 Spalten verwenden.');
    return {sheets,ocr:false};
  }
  let worker;
  const recognize=async canvas=>{
    if(!worker){const T=await script(OCR_URL,'Tesseract');worker=await T.createWorker('deu+eng',1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',logger:m=>{if(m.status==='recognizing text')progress(`Foto wird ausgelesen … ${Math.round(m.progress*100)} %`);}});await worker.setParameters({preserve_interword_spaces:'1'});}
    const {data}=await worker.recognize(canvas,{}, {text:true,blocks:true});const items=ocrItems(data);
    return items.length?positionedRows(items,month):readDelimited(data.text);
  };
  try{
    if(ext==='pdf'){
      const pdfjs=await import(PDF_URL);pdfjs.GlobalWorkerOptions.workerSrc=PDF_WORKER;
      const task=pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false,standardFontDataUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/standard_fonts/',cMapUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/cmaps/',cMapPacked:true}),doc=await task.promise,sheets=[];let ocr=false;
      try{
        if(doc.numPages>12)throw new Error('Bitte höchstens zwölf PDF-Seiten auf einmal auswählen.');
        for(let p=1;p<=doc.numPages;p++){
          progress(`PDF-Seite ${p} von ${doc.numPages} …`);const page=await doc.getPage(p),text=await page.getTextContent();let rows;
          if(text.items.filter(t=>t.str?.trim()).length>=5)rows=positionedRows(text.items.filter(t=>t.str).map(t=>({text:t.str,x:t.transform[4],y:-t.transform[5],width:t.width,height:t.height})),month);
          else {ocr=true;const view=page.getViewport({scale:Math.min(2,2800/page.getViewport({scale:1}).width)}),canvas=document.createElement('canvas');canvas.width=view.width;canvas.height=view.height;await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;rows=await recognize(canvas);}
          sheets.push({name:`Seite ${p}`,rows});page.cleanup();
        }
      }finally{await doc.destroy();}return {sheets,ocr};
    }
    if(['png','jpg','jpeg','webp','bmp'].includes(ext))return {sheets:[{name:file.name,rows:await recognize(await imageCanvas(file))}],ocr:true};
    throw new Error('Dieses Format wird nicht unterstützt. Verwende Excel, CSV, PDF oder ein Foto als JPG/PNG.');
  }finally{if(worker)await worker.terminate();}
}
