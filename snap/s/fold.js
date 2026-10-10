// Ausklappbare Karten behalten ihre Einstellung auf diesem Gerät.
export function foldCards(container, scope, options) {
  if (!container) return;
  const cards = [...container.querySelectorAll('section.card')];
  for (const {index, key, label, open = false} of options) {
    const card = cards[index];
    if (!card || card.classList.contains('fold-card')) continue;
    const title = label || card.querySelector('h2')?.textContent?.trim();
    if (!title) continue;
    const storageKey = `fold:${scope}:${key}`;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'fold-toggle'; button.textContent = title;
    const content = document.createElement('div'); content.className = 'fold-content';
    content.id = `fold-${scope}-${key}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    button.setAttribute('aria-controls', content.id);
    while (card.firstChild) content.appendChild(card.firstChild);
    card.append(button, content); card.classList.add('fold-card');
    let saved;
    try { saved = localStorage.getItem(storageKey); } catch { /* Speicherung optional */ }
    const set = (value, persist = false) => {
      content.hidden = !value; button.setAttribute('aria-expanded', String(value));
      card.classList.toggle('fold-open', value);
      if (persist) try { localStorage.setItem(storageKey, value ? '1' : '0'); } catch { /* optional */ }
    };
    set(saved === null || saved === undefined ? open : saved === '1');
    button.addEventListener('click', () => set(content.hidden, true));
    card.addEventListener('fold-open', () => set(true, true));
  }
}
export function openFold(element) { element?.dispatchEvent(new Event('fold-open')); }
export function rememberDetails(container, scope) {
  if (!container) return;
  [...container.querySelectorAll('details')].forEach((item, index) => {
    const key = `fold:${scope}:details:${index}`;
    try { const saved = localStorage.getItem(key); if (saved !== null) item.open = saved === '1'; } catch { /* optional */ }
    item.addEventListener('toggle', () => { try { localStorage.setItem(key, item.open ? '1' : '0'); } catch { /* optional */ } });
  });
}
