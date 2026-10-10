// Getrennte Motive: Menschen ausschließlich auf der öffentlichen Startseite.
export const HERO_SCENES=['images/hamburg-security-morgen.webp','images/hamburg-security-abend.webp'];
export const APP_SCENES=['images/hamburg-speicherstadt.webp','images/hamburg-hafen.webp'];
export function nextScene(previous,count,random=Math.random){
 const old=Number(previous);
 if(previous!==null&&previous!==''&&Number.isInteger(old)&&old>=0&&old<count)return (old+1)%count;
 return Math.min(count-1,Math.floor(random()*count));
}
export function initScenes(doc=document,storage){
 if(!storage){try{storage=localStorage;}catch{storage={getItem:()=>null,setItem:()=>{}};}}
 let previous={},hidden=false;
 const rotate=()=>{
  for(const [name,scenes] of [['hero',HERO_SCENES],['app',APP_SCENES]]){
   let saved=null;try{saved=storage.getItem(`shiftly.scene:${name}`);}catch{saved=previous[name]??null;}
   const index=nextScene(saved,scenes.length);previous[name]=index;
   try{storage.setItem(`shiftly.scene:${name}`,String(index));}catch{/* Gerätespeicher optional */}
   doc.documentElement.style.setProperty(`--${name}-scene`,`url("${scenes[index]}")`);
   doc.documentElement.dataset[`${name}Scene`]=String(index);
  }
 };
 rotate();
 doc.addEventListener('visibilitychange',()=>{
  if(doc.visibilityState==='hidden'){hidden=true;return;}
  if(hidden){hidden=false;rotate();}
 });
 return rotate;
}
