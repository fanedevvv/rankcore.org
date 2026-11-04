import { scrollBottom, sleep, md } from './ui.js';

export function appendTyping() {
  const msgs = document.getElementById('msgs');
  if (!msgs) return null;

  const row = document.createElement('div');
  row.className = 'msg bot typing';

  const av = document.createElement('div');
  av.className = 'av bot';
  av.innerHTML = `<svg width="12" height="12" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;

  const txt = document.createElement('div');
  txt.className = 'txt';
  txt.innerHTML = `
    <div class="dots">
      <span class="dot"></span><span class="dot"></span><span class="dot"></span>
    </div>
    <span class="lbl">thinking&hellip;</span>`;

  row.append(av, txt);
  msgs.appendChild(row);
  scrollBottom();
  return row;
}

export async function appendTypedBotMsg(fullText) {
  const msgs = document.getElementById('msgs');
  if (!msgs) return;

  const row = document.createElement('div');
  row.className = 'msg bot';

  const av = document.createElement('div');
  av.className = 'av bot';
  av.innerHTML = `<svg width="12" height="12" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;

  const txt = document.createElement('div');
  txt.className = 'txt';

  row.append(av, txt);
  msgs.appendChild(row);
  scrollBottom();

  const cursor = document.createElement('span');
  cursor.className = 'cursor';

  const liveP = document.createElement('p');
  txt.append(liveP, cursor);

  const tokens = fullText.split(/(\s+)/);
  const delay = fullText.length < 200 ? 22
              : fullText.length < 600 ? 14
              : fullText.length < 1500 ? 9
              : 5;

  let built = '';
  for (const token of tokens) {
    built += token;
    liveP.textContent = built;
    scrollBottom();
    await sleep(delay);
  }

  cursor.remove();
  txt.innerHTML = md(fullText);
  scrollBottom();
}
