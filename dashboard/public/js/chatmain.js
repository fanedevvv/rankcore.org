// chatmain.js — Main entry point for the Roco AI chat page
// ─────────────────────────────────────────────────────────────────────────────

import { loadCurrentUser }    from './chatjs/user.js';
import { checkHealth }        from './chatjs/health.js';
import { loadConversations, newConversation, selectConversation,
         deleteConversation, renameConversation } from './chatjs/conversations.js';
import { filterConvs }        from './chatjs/sidebar.js';
import { initInputHandlers, handleSend } from './chatjs/send.js';
import { setBusy }            from './chatjs/ui.js';

// ── Expose globals for inline onclick= handlers in HTML ───────────────────────
window.newConversation    = newConversation;
window.selectConversation = selectConversation;
window.deleteConversation = deleteConversation;
window.renameConversation = renameConversation;
window.filterConvs        = filterConvs;

// Hint chip handler (defined here so render.js can reference window._chatHint)
window._chatHint = function (el) {
  const input = document.getElementById('ui');
  if (input) { input.value = el.querySelector('.ht').textContent; input.focus(); }
  handleSend();
};

// Mobile sidebar toggle
window.toggleMobileSidebar = function () {
  document.getElementById('side')?.classList.toggle('open');
};

// ── Boot ──────────────────────────────────────────────────────────────────────
async function init() {
  initInputHandlers();

  // Unlock send button only after initial load
  const sendBtn = document.getElementById('snd');
  if (sendBtn) sendBtn.disabled = true;

  await Promise.all([
    loadCurrentUser(),
    loadConversations(),
    checkHealth(),
  ]);

  if (sendBtn) sendBtn.disabled = false;
}

init();
