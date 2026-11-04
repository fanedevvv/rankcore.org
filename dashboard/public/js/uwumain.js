// uwumain.js — Main Entry Point for UwU Lock Dashboard
// ─────────────────────────────────────────────────────────────────────────────

import { showToast }                      from './uwujs/toast.js';
import { initMembers }                    from './uwujs/members.js';
import { initUserList, setFilter }        from './uwujs/userList.js';
import { initModal, openAddModal,
         closeModal, addUwuLock }         from './uwujs/modal.js';
import { loadData, removeUwuLock }        from './uwujs/settings.js';

const guildId = location.pathname.split('/')[2];

// ── Expose globals for inline onclick handlers ────────────────────────────────
window.openAddModal  = openAddModal;
window.closeModal    = closeModal;
window.addUwuLock    = addUwuLock;
window.removeUwuLock = (userId) => removeUwuLock(guildId, userId);
window.filterUsers   = () => {
  const q = document.getElementById('searchInput')?.value || '';
  setFilter(q);
};

// ── Boot ──────────────────────────────────────────────────────────────────────
async function init() {
  // Wire up the modal (sets guildId + initial empty locked-ids set)
  initModal(guildId, []);

  try {
    await loadData(guildId);
  } catch (err) {
    console.error('UwU dashboard init failed:', err);
    showToast('Failed to load UwU data OwO', 'error');

    // Clear skeleton loaders even on error
    const list = document.getElementById('userList');
    if (list) list.innerHTML = `
      <div class="empty-state">
        <div style="font-size:2rem;">😿</div>
        <div style="font-weight:700; color:#F0E4F8;">Failed to load data</div>
        <div style="font-size:0.8rem; color:var(--muted);">Please refresh the page and try again</div>
      </div>`;
  }
}

window.addEventListener('DOMContentLoaded', init);