export function arrangeDashboard(root, userId) {
  for(const wrapper of root.querySelectorAll(':scope > .zwei')) wrapper.replaceWith(...wrapper.children);
  const cards=[...root.children].filter(el=>el.matches('section.card,details.card'));
  const storageKey=`shiftly.dashboardOrder:v2:${userId}`;
  for(const card of cards){
    const title=card.querySelector('summary,.fold-toggle,h2')?.textContent.trim() || 'Bereich';
    card.dataset.dashboardKey=title.replace(/\b\d{4}\b/g,'').trim();
    const controls=document.createElement('div');controls.className='dashboard-sort-controls';
    const label=document.createElement('span');label.textContent='Position ändern';controls.append(label);
    for(const [direction,symbol,word] of [[-1,'↑','oben'],[1,'↓','unten']]){
      const button=document.createElement('button');button.type='button';button.className='btn klein';button.textContent=symbol;
      button.setAttribute('aria-label',`${title} nach ${word} verschieben`);
      button.onclick=event=>{
        event.preventDefault();event.stopPropagation();
        const list=ordered(),index=list.indexOf(card),target=list[index+direction];if(!target)return;
        if(direction<0)root.insertBefore(card,target);else root.insertBefore(target,card);
        try{localStorage.setItem(storageKey,JSON.stringify(ordered().map(c=>c.dataset.dashboardKey)));}catch{/* optional */}
        update();button.focus();
      };
      controls.append(button);
    }
    if(card.tagName==='DETAILS')card.querySelector('summary').append(controls);else card.prepend(controls);
  }
  const ordered=()=>[...root.children].filter(c=>cards.includes(c));
  const update=()=>ordered().forEach((card,index,list)=>{const buttons=card.querySelectorAll('.dashboard-sort-controls button');buttons[0].disabled=index===0;buttons[1].disabled=index===list.length-1;});
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');
    if(Array.isArray(saved)&&saved.length){
      const sorted=saved.map(key=>cards.find(c=>c.dataset.dashboardKey===key)).filter(Boolean);
      for(const card of cards){
        if(sorted.includes(card))continue;
        const index=cards.indexOf(card);
        const previous=cards.slice(0,index).reverse().find(c=>sorted.includes(c));
        const following=cards.slice(index+1).find(c=>sorted.includes(c));
        if(previous)sorted.splice(sorted.indexOf(previous)+1,0,card);
        else if(following)sorted.splice(sorted.indexOf(following),0,card);
        else sorted.push(card);
      }
      sorted.forEach(c=>root.append(c));
    }
  }catch{/* Neue oder ungültige Reihenfolge verwendet die Standardanordnung. */}
  const toggle=root.querySelector('#dashboard-arrange');
  toggle.onclick=()=>{const active=root.classList.toggle('dashboard-arranging');toggle.setAttribute('aria-pressed',String(active));toggle.textContent=active?'Anordnung fertig':'Anordnung ändern';};
  update();
}
