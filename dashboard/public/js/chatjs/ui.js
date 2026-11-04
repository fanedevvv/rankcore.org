import { state } from './state.js';

let _toastTimer;
export function showToast(msg, isErr = false) {
  const t = document.getElementById('toast');
  if (!t) return;
  const icon = t.querySelector('.toast-icon');
  const text = t.querySelector('.toast-text');
  if (icon) icon.innerHTML = isErr
    ? `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
    : `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
  if (text) text.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

export function setBusy(v) {
  state.busy = v;
  const btn = document.getElementById('snd');
  if (btn) btn.disabled = v;
  setSdot(v ? 'busy' : 'ready');
}

export function setSdot(s) {
  const dot = document.getElementById('sd');
  const txt = document.getElementById('st');
  if (!dot || !txt) return;
  dot.className = 'sd' + (s === 'off' ? ' off' : s === 'busy' ? ' busy' : '');
  txt.textContent = s === 'off' ? 'offline' : s === 'busy' ? 'thinking…' : 'ready';
}

export function showChatArea() {
  const noConv   = document.getElementById('wl');
  const chatArea = document.getElementById('ca');
  if (noConv)   noConv.style.display   = 'none';
  if (chatArea) chatArea.style.display = 'flex';
}

export function hideChatArea() {
  const noConv   = document.getElementById('wl');
  const chatArea = document.getElementById('ca');
  if (noConv)   noConv.style.display   = 'flex';
  if (chatArea) chatArea.style.display = 'none';
}

export function scrollBottom() {
  const el = document.getElementById('msgs');
  if (el) el.scrollTop = el.scrollHeight;
}

export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function md(t) {
  let s = t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, c) => `<pre><code>${c.trim()}</code></pre>`);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>')
       .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
       .replace(/^# (.+)$/gm,   '<h1>$1</h1>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
       .replace(/\*(.+?)\*/g,     '<em>$1</em>');
  s = s.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
  s = s.replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>');
  s = s.split(/\n\n+/).map(p =>
    (p.startsWith('<ul>') || p.startsWith('<pre>') || p.startsWith('<h'))
      ? p
      : `<p>${p.replace(/\n/g, '<br>')}</p>`
  ).join('');
  return s;
}
