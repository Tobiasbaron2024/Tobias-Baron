const memory = new Map();
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function dailyGreeting(date, name, hour = 12) {
  const phrases = ['Schön, dass du da bist','Ein neuer Tag wartet auf dich','Mach dir heute einen guten Tag','Heute ist Platz für etwas Schönes','Gut, dich wiederzusehen','Nimm den Tag Schritt für Schritt','Ich wünsche dir einen angenehmen Tag','Schön, mit dir in den Tag zu schauen','Auch kleine Pausen tun heute gut','Starte in deinem Tempo','Für heute wünsche ich dir viele gute Momente','Lass es dir heute gutgehen'];
  const index = Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000);
  const hello = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  const first = String(name || '').trim().split(/\s+/)[0];
  return `${hello}${first ? ', ' + first : ''}! ${phrases[((index % phrases.length) + phrases.length) % phrases.length]}.`;
}
export function dayOverview(rows, vacation = false) {
  const shifts = rows.filter(s => s.art === 'dienst').sort((a,b) => String(a.beginn).localeCompare(String(b.beginn)));
  if (shifts.length) return `Für heute ${shifts.length === 1 ? 'ist deine Schicht' : 'sind deine Schichten'} eingetragen: ${shifts.map(s => `${String(s.beginn || '').slice(0,5)}–${String(s.ende || '').slice(0,5)} Uhr`).join(', ')}. Ich wünsche dir einen ruhigen Dienst und einen schönen Feierabend!`;
  if (rows.some(s => s.art === 'krank')) return 'Heute bist du als krank eingetragen. Nimm dir Zeit für Ruhe und Erholung.';
  if (vacation || rows.some(s => s.art === 'urlaub')) return 'Heute hast du Urlaub. Genieße deine freie Zeit und lass es dir gutgehen!';
  if (rows.some(s => s.art === 'frei')) return 'Heute ist ein freier Tag eingetragen. Zeit zum Durchatmen und für etwas, das dir Freude macht.';
  return 'Heute ist keine Schicht eingetragen. Ich wünsche dir einen angenehmen Tag!';
}
export function weatherGreeting(weather) {
  if (!weather) return '';
  if (weather.rain) return 'Heute kann es nass werden. Regenjacke oder Schirm einpacken, dann bist du auf der sicheren Seite.';
  if (weather.low < 0) return 'Heute ist es eisig. Dick einpacken, Mütze und Handschuhe nicht vergessen.';
  if (weather.low < 5) return 'Heute wird es richtig kalt, zieh dich warm an.';
  if (weather.low < 12) return 'Heute bleibt es eher frisch, Jacke an und los.';
  if (weather.high >= 26) return 'Heute wird es warm. Zieh dich luftig an und trink genug.';
  return 'Das Wetter spielt heute mit, trocken und angenehm. Vielleicht passt eine kleine Pause draußen.';
}
export function showDailyGreeting(el, {userId, date, name, hour, rows = [], vacation = false, weather}) {
  const key = `shiftly.dayGreeting:${userId}`;
  let seen = memory.get(key);
  try { seen = localStorage.getItem(key) || seen; } catch { /* Ohne Speicher nur innerhalb dieser Sitzung. */ }
  if (seen === date) { el.remove(); return false; }
  el.innerHTML = `<div class="day-greeting-head"><h2>${esc(dailyGreeting(date,name,hour))}</h2><button class="btn klein" type="button" aria-label="Tageshinweis schließen">Schließen</button></div><p>${esc(dayOverview(rows,vacation))}</p><p data-day-weather>${esc(weatherGreeting(weather))}</p>`;
  el.querySelector('button').onclick = () => el.remove();
  memory.set(key,date);
  try { localStorage.setItem(key,date); } catch { /* optional */ }
  return true;
}
export function updateGreetingWeather(el, weather) {
  const line = el?.querySelector('[data-day-weather]');
  if (line) line.textContent = weatherGreeting(weather);
}
