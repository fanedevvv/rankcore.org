import { state }                    from './state.js';
import { apiFetch }                 from './api.js';
import { setBusy, showToast, scrollBottom } from './ui.js';
import { renderMessages }           from './render.js';
import { renderSidebar }            from './sidebar.js';
import { appendTyping, appendTypedBotMsg } from './typewriter.js';
import { newConversation }          from './conversations.js';

export function initInputHandlers() {
  const input   = document.getElementById('ui');
  const sendBtn = document.getElementById('snd');
  const clearBtn = document.getElementById('cb');

  if (!input || !sendBtn) return;

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    _updateCharCount(input.value.length);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });

  sendBtn.addEventListener('click', handleSend);

  clearBtn?.addEventListener('click', () => {
    if (!state.activeConvId) return;
    state.activeMessages = [];
    renderMessages();
    showToast('Chat cleared (history preserved on server)');
  });
}

export async function handleSend() {
  const input = document.getElementById('ui');
  const text  = input?.value.trim();
  if (!text || state.busy) return;

  if (!state.activeConvId) await newConversation();

  state.activeMessages.push({ role: 'user', content: text });
  renderMessages();
  input.value = '';
  input.style.height = 'auto';
  _updateCharCount(0);
  setBusy(true);

  const typingEl = appendTyping();

  try {
    const data = await apiFetch('/api/chat', 'POST', {
      messages:       state.activeMessages.slice(-40),
      conversationId: state.activeConvId,
    });

    typingEl?.remove();

    state.activeMessages.push({ role: 'assistant', content: data.reply });
    renderMessages(true);
    await appendTypedBotMsg(data.reply);

    const conv = state.conversations.find(c => c.id === state.activeConvId);
    if (conv) {
      conv.preview   = data.reply.slice(0, 80);
      conv.updatedAt = new Date().toISOString();
      if (conv.title === 'New Chat') conv.title = text.slice(0, 60);
      state.conversations = [conv, ...state.conversations.filter(c => c.id !== state.activeConvId)];
      renderSidebar();
    }
  } catch (err) {
    typingEl?.remove();
    state.activeMessages.pop();
    renderMessages();
    showToast(err.message || 'Request failed', true);
  }

  setBusy(false);
  scrollBottom();
  input?.focus();
}

function _updateCharCount(len) {
  const el = document.getElementById('cc');
  if (el) el.textContent = len > 0 ? `${len}` : '';
}
