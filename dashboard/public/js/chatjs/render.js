import { state }           from './state.js';
import { esc, md }         from './ui.js';
import { userFallbackSvg } from './user.js';

export function appendMsgEl(role, content) {
  const msgs = document.getElementById('msgs');
  if (!msgs) return null;

  const isBot = role === 'bot';
  const row   = document.createElement('div');
  row.className = `msg ${role}`;

  const av = document.createElement('div');
  av.className = `av ${isBot ? 'bot' : 'user'}`;
  if (isBot) {
    av.innerHTML = `<svg width="12" height="12" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
  } else if (state.currentUser.avatarUrl) {
    const img = document.createElement('img');
    img.src   = state.currentUser.avatarUrl;
    img.alt   = state.currentUser.username;
    img.onerror = function () { this.parentElement.innerHTML = userFallbackSvg(); };
    av.appendChild(img);
  } else {
    av.innerHTML = userFallbackSvg();
  }

  const txt = document.createElement('div');
  txt.className = 'txt';
  txt.innerHTML = md(content);

  row.append(av, txt);
  msgs.appendChild(row);
  return txt;
}

export function renderMessages(skipLast = false) {
  const msgs = document.getElementById('msgs');
  if (!msgs) return;
  msgs.innerHTML = '';

  if (!state.activeMessages.length) {
    _renderEmptyState(msgs);
    return;
  }

  const list = skipLast ? state.activeMessages.slice(0, -1) : state.activeMessages;
  list.forEach(m => {
    if (m.role === 'user' || m.role === 'assistant')
      appendMsgEl(m.role === 'user' ? 'user' : 'bot', m.content);
  });
}

function _renderEmptyState(msgs) {
  const { globalName, avatarUrl } = state.currentUser;
  const av = avatarUrl
    ? `<img src="${esc(avatarUrl)}" alt="avatar" onerror="this.style.display='none'">`
    : `<svg width="24" height="24" fill="none" stroke="#8b6fff" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

  msgs.innerHTML = `
    <div class="empty">
      <div class="empty-av">${av}</div>
      <div class="empty-body">
        <h2>Hey, <span class="gr">${esc(globalName)}</span></h2>
        <p>Personal AI assistant, powered by Groq.</p>
      </div>
      <div class="hints">
        <button class="hint" onclick="window._chatHint(this)">
          <span class="hi">⚡</span>
          <span class="ht">What can Roco do?</span>
        </button>
        <button class="hint" onclick="window._chatHint(this)">
          <span class="hi">📋</span>
          <span class="ht">Write a server rule</span>
        </button>
        <button class="hint" onclick="window._chatHint(this)">
          <span class="hi">🤖</span>
          <span class="ht">Suggest commands</span>
        </button>
        <button class="hint" onclick="window._chatHint(this)">
          <span class="hi">📢</span>
          <span class="ht">Draft announcement</span>
        </button>
      </div>
    </div>`;
}
