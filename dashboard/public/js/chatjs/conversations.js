import { state }                          from './state.js';
import { apiFetch }                       from './api.js';
import { showToast, showChatArea, hideChatArea } from './ui.js';
import { renderMessages }                 from './render.js';
import { renderSidebar }                  from './sidebar.js';
import { scrollBottom }                   from './ui.js';

let _creating = false;

export async function loadConversations() {
  try {
    const d = await apiFetch('/api/chat/conversations');
    state.conversations = d.conversations || [];
    renderSidebar();
  } catch {
    showToast('Failed to load conversations', true);
  }
}

export async function newConversation() {
  if (_creating) return;
  _creating = true;
  try {
    const conv = await apiFetch('/api/chat/conversations', 'POST', { title: 'New Chat' });
    state.conversations.unshift(conv);
    state.activeConvId   = conv.id;
    state.activeMessages = [];
    renderSidebar();
    showChatArea();
    renderMessages();
    document.getElementById('ui')?.focus();
    closeSidebar();
  } catch (e) {
    showToast('Failed to create chat: ' + (e.message || 'unknown error'), true);
  }
  _creating = false;
}

export async function selectConversation(id) {
  state.activeConvId = id;
  renderSidebar();
  showChatArea();
  renderMessages();
  try {
    const conv = await apiFetch(`/api/chat/conversations/${id}`);
    state.activeMessages = conv.messages || [];
    renderMessages();
    scrollBottom();
    document.getElementById('ui')?.focus();
    closeSidebar();
  } catch (e) {
    showToast('Failed to load conversation: ' + (e.message || ''), true);
  }
}

export async function deleteConversation(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this conversation?')) return;
  try {
    await apiFetch(`/api/chat/conversations/${id}`, 'DELETE');
    state.conversations = state.conversations.filter(c => c.id !== id);
    if (state.activeConvId === id) {
      state.activeConvId   = null;
      state.activeMessages = [];
      hideChatArea();
    }
    renderSidebar();
  } catch {
    showToast('Failed to delete', true);
  }
}

export async function renameConversation(id, e) {
  e.stopPropagation();
  const item = document.getElementById(`conv-${id}`);
  if (!item) return;
  const titleEl = item.querySelector('.st');
  const old     = titleEl.textContent;
  const input   = document.createElement('input');
  input.className = 'sri';
  input.value     = old;
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  async function finish() {
    const val = input.value.trim() || old;
    try {
      await apiFetch(`/api/chat/conversations/${id}`, 'PATCH', { title: val });
      const conv = state.conversations.find(c => c.id === id);
      if (conv) conv.title = val;
    } catch {}
    renderSidebar();
  }
  input.addEventListener('blur', finish);
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter')  { ev.preventDefault(); input.blur(); }
    if (ev.key === 'Escape') { input.value = old; input.blur(); }
  });
}

function closeSidebar() {
  document.getElementById('side')?.classList.remove('open');
}
