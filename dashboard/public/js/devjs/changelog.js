// devjs/changelog.js — Changelog publisher + editor
import { secureFetch, showToast } from './core.js';

let _entries  = [];
let _editingId = null; // null = create mode, string = edit mode

export async function loadChangelogs() {
  try {
    const r = await secureFetch('/api-dev/changelogs');
    if (!r.ok) return;
    _entries = await r.json();
    renderChangelogList();
  } catch (_) {}
}

// ── Populate the form for editing an existing entry ────────────────────────
export function editChangelog(id) {
  const entry = _entries.find(e => e._id === id);
  if (!entry) return showToast('Entry not found', true);
  const cfg = entry.config || {};
  _editingId = id;

  const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
  set('cl-title',       cfg.title       || '');
  set('cl-description', cfg.description || '');
  set('cl-footer',      cfg.footer      || '');
  set('cl-type',        cfg.type        || '');
  const colorEl = document.getElementById('cl-color');
  if (colorEl) colorEl.value = cfg.color || '#ef4444';

  // Update button label + show cancel
  const btn = document.getElementById('cl-submit-btn');
  if (btn) btn.textContent = '✏️ Save Changes';
  const cancelBtn = document.getElementById('cl-cancel-btn');
  if (cancelBtn) cancelBtn.style.display = '';

  // Scroll the form into view
  document.getElementById('cl-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function cancelEditChangelog() {
  _editingId = null;
  ['cl-title','cl-description','cl-footer','cl-type'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const colorEl = document.getElementById('cl-color');
  if (colorEl) colorEl.value = '#ef4444';

  const btn = document.getElementById('cl-submit-btn');
  if (btn) btn.textContent = '📣 Publish';
  const cancelBtn = document.getElementById('cl-cancel-btn');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

export async function publishChangelog() {
  const title       = document.getElementById('cl-title')?.value?.trim();
  const description = document.getElementById('cl-description')?.value?.trim();
  const footer      = document.getElementById('cl-footer')?.value?.trim();
  const color       = document.getElementById('cl-color')?.value;
  const type        = document.getElementById('cl-type')?.value?.trim();

  if (!description) return showToast('Description is required', true);

  if (_editingId) {
    // ── Edit mode ──────────────────────────────────────────────────────────
    const r = await secureFetch(`/api-dev/changelog/${_editingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, description, footer, color, type }),
    }).then(r => r.json());
    if (r.error) return showToast(r.error, true);
    showToast('✅ Changelog updated!');
    cancelEditChangelog();
  } else {
    // ── Create mode ────────────────────────────────────────────────────────
    const r = await secureFetch('/api-dev/changelog', {
      method: 'POST',
      body: JSON.stringify({ title, description, footer, color, type }),
    }).then(r => r.json());
    if (r.error) return showToast(r.error, true);
    showToast('📣 Changelog published!');
    ['cl-title','cl-description','cl-footer','cl-type'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  }
  loadChangelogs();
}

export async function deleteChangelog(id) {
  if (!confirm('Delete this changelog entry?')) return;
  const r = await secureFetch(`/api-dev/changelog/${id}`, { method: 'DELETE' }).then(r => r.json());
  if (r.error) return showToast(r.error, true);
  if (_editingId === id) cancelEditChangelog();
  showToast('Deleted');
  loadChangelogs();
}

function renderChangelogList() {
  const el = document.getElementById('clHistoryList');
  if (!el) return;

  if (!_entries.length) {
    el.innerHTML = '<div style="text-align:center;padding:30px 0;color:var(--muted);font-size:0.75rem;font-weight:700">No changelogs yet</div>';
    return;
  }

  el.innerHTML = _entries.map(e => {
    const cfg   = e.config || {};
    const date  = e.date ? new Date(e.date).toLocaleString() : '—';
    const color = cfg.color || '#ffffff';
    const isEditing = _editingId === e._id;
    return `
    <div class="cl-entry" style="border-left:3px solid ${escHtml(color)};${isEditing ? 'background:rgba(99,102,241,0.08);border-color:var(--accent)' : ''}">
      <div class="cl-entry-head">
        <span class="cl-entry-title">${escHtml(cfg.title || 'Untitled')}</span>
        <span class="cl-entry-date">${date}</span>
        <button class="btn btn-ghost sm" style="padding:3px 8px;font-size:0.68rem" onclick="editChangelog('${e._id}')" title="Edit">✏️</button>
        <button class="btn btn-ghost sm" style="padding:3px 8px;font-size:0.68rem" onclick="deleteChangelog('${e._id}')" title="Delete">🗑</button>
      </div>
      <div class="cl-entry-desc">${escHtml(cfg.description || '')}</div>
      <div class="cl-entry-meta">
        ${cfg.type   ? `<span class="lu-badge lu-blue">${escHtml(cfg.type)}</span>` : ''}
        ${cfg.footer ? `<span style="font-size:0.68rem;color:var(--muted)">${escHtml(cfg.footer)}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}