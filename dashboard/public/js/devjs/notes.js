// devjs/notes.js — Multi-note system: per-user MongoDB persistence + shared team board

import { secureFetch, escapeHtml, showToast } from './core.js';

const PRIORITY_OWNER = '1075077561454973020';

// ── State ─────────────────────────────────────────────────────────────────────
let _notes          = [];   // current user's own notes
let _sharedNotes    = [];   // all shared notes from all devs
let _currentUserId  = null; // set from API response
let _activeId       = null;
let _page           = 1;
let _searchQuery    = '';
const PER_PAGE      = 6;

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date(), diff = now - d;
  if (diff < 60000)    return 'just now';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
       + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function excerpt(c, n = 72) {
  const t = (c || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : (t || 'Empty note');
}

function isOwner(ownerId) {
  return ownerId === PRIORITY_OWNER;
}

function iAmOwner() {
  return _currentUserId === PRIORITY_OWNER;
}

// ── Red/authority styles ──────────────────────────────────────────────────────
const OWNER_CARD_STYLE = `
  background: rgba(248,113,113,0.05);
  border: 1px solid rgba(248,113,113,0.28);
  box-shadow: 0 0 18px rgba(248,113,113,0.07);
`;
const OWNER_LIST_ITEM_STYLE = `
  background: rgba(248,113,113,0.05);
  border-color: rgba(248,113,113,0.28);
`;

// ── Sidebar list ──────────────────────────────────────────────────────────────
export function renderNoteList() {
  const list  = document.getElementById('noteListItems');
  const cntEl = document.getElementById('notesCountBadge');
  const pagEl = document.getElementById('notesListPag');
  if (!list) return;

  const total = _notes.length;
  if (cntEl) cntEl.textContent = total;

  if (!total) {
    list.innerHTML = `<div class="notes-empty">No notes yet<br><span style="font-weight:500;color:var(--muted);font-size:0.65rem">Click + New to create one</span></div>`;
    if (pagEl) pagEl.innerHTML = '';
    renderAllNotes();
    return;
  }

  const amOwner    = iAmOwner();
  const sorted     = [..._notes].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const maxPage    = Math.max(1, Math.ceil(total / PER_PAGE));
  if (_page > maxPage) _page = maxPage;
  const pageItems  = sorted.slice((_page - 1) * PER_PAGE, _page * PER_PAGE);

  list.innerHTML = pageItems.map(note => {
    const ownerNote = amOwner;
    return `
    <div class="note-list-item ${note.id === _activeId ? 'nli-active' : ''}"
         style="${ownerNote && note.id === _activeId ? '' : ownerNote ? OWNER_LIST_ITEM_STYLE : ''}"
         onclick="selectNote('${note.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">
        <div class="nli-title" style="${ownerNote ? 'color:var(--red)' : ''}">
          ${ownerNote ? '👑 ' : ''}${escapeHtml(note.title || 'Untitled')}
        </div>
        <button class="nli-del" onclick="event.stopPropagation();deleteNote('${note.id}')" title="Delete">
          <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      ${note.shared
        ? `<div style="font-size:0.58rem;color:${ownerNote ? 'var(--red)' : 'var(--accent)'};font-weight:700;margin-top:2px">● Published</div>`
        : ''}
      <div class="nli-excerpt">${escapeHtml(excerpt(note.content))}</div>
      <div class="nli-date">${fmtDate(note.updatedAt)}</div>
    </div>`;
  }).join('');

  if (pagEl) {
    if (total <= PER_PAGE) { pagEl.innerHTML = ''; }
    else {
      pagEl.innerHTML = `
        <span style="font-size:0.6rem;color:var(--muted);font-family:var(--mono)">${_page}/${maxPage}</span>
        <div style="display:flex;gap:4px">
          <button class="pag-btn" onclick="notesPage(${_page - 1})" ${_page <= 1 ? 'disabled' : ''}>‹</button>
          <button class="pag-btn" onclick="notesPage(${_page + 1})" ${_page >= maxPage ? 'disabled' : ''}>›</button>
        </div>`;
    }
  }
  renderAllNotes();
}

export function notesPage(p) { _page = p; renderNoteList(); }

// ── All Notes grid (search panel — shows own notes + all shared notes) ─────────
export function renderAllNotes() {
  const container = document.getElementById('allNotesGrid');
  if (!container) return;

  // Merge own notes + shared notes (avoid dupes by id)
  const ownIds    = new Set(_notes.map(n => n.id));
  const combined  = [
    ..._notes.map(n => ({ ...n, _isOwn: true,   ownerId: _currentUserId })),
    ..._sharedNotes
      .filter(n => !ownIds.has(n.id))
      .map(n => ({ ...n, _isOwn: false, shared: true })),
  ];

  const q = (_searchQuery || '').toLowerCase().trim();
  let filtered = combined;
  if (q) {
    filtered = combined.filter(n =>
      (n.title || '').toLowerCase().includes(q) ||
      (n.content || '').toLowerCase().includes(q)
    );
  }
  const sorted  = [...filtered].sort((a, b) => {
    // Priority owner's notes always come first
    const aOwner = isOwner(a.ownerId), bOwner = isOwner(b.ownerId);
    if (aOwner && !bOwner) return -1;
    if (bOwner && !aOwner) return  1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  const countEl = document.getElementById('allNotesCount');
  if (countEl) countEl.textContent = q ? `${filtered.length} / ${combined.length}` : String(combined.length);

  if (!sorted.length) {
    container.innerHTML = `<div style="text-align:center;padding:28px 0;color:var(--muted);font-size:0.75rem;font-weight:700;grid-column:1/-1">${q ? 'No notes match your search' : 'No notes yet — click + New Note above to start'}</div>`;
    return;
  }

  container.innerHTML = sorted.map(note => {
    const ownerNote = isOwner(note.ownerId);
    const isActive  = note.id === _activeId;
    return `
    <div class="all-note-card ${isActive ? 'anc-active' : ''}"
         style="${ownerNote ? OWNER_CARD_STYLE : ''}"
         onclick="selectNoteAndGoToEditor('${note.id}')">
      <div class="anc-header">
        <div class="anc-title" style="${ownerNote ? 'color:var(--red)' : ''}">
          ${ownerNote ? '👑 ' : ''}${escapeHtml(note.title || 'Untitled')}
        </div>
        ${note._isOwn ? `
        <button class="nli-del" onclick="event.stopPropagation();deleteNote('${note.id}')" title="Delete" style="width:22px;height:22px;flex-shrink:0">
          <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>` : `<span style="font-size:0.58rem;font-weight:700;padding:2px 7px;border-radius:8px;
          background:${ownerNote ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.04)'};
          color:${ownerNote ? 'var(--red)' : 'var(--muted)'};
          border:1px solid ${ownerNote ? 'rgba(248,113,113,0.2)' : 'var(--border)'};
          white-space:nowrap">
          ${ownerNote ? '👑 Owner' : 'Shared'}
        </span>`}
      </div>
      ${note.shared
        ? `<div style="font-size:0.58rem;font-weight:700;color:${ownerNote ? 'var(--red)' : 'var(--accent)'}">
            ● ${ownerNote ? 'Owner · Published' : 'Published to board'}
           </div>`
        : ''}
      <div class="anc-excerpt">${escapeHtml(excerpt(note.content, 110))}</div>
      <div class="anc-footer">
        <span>${fmtDate(note.updatedAt)}</span>
        <span>${note.content ? note.content.split(/\s+/).filter(Boolean).length + ' words' : 'empty'}</span>
      </div>
    </div>`;
  }).join('');
}

export function notesSearch(q) {
  _searchQuery = q;
  renderAllNotes();
}

// ── Select note → populate editor ────────────────────────────────────────────
export function selectNote(id) {
  // Check own notes first, then shared
  const note = _notes.find(n => n.id === id) || _sharedNotes.find(n => n.id === id);
  if (!note) return;

  // Can only edit own notes
  const isOwn = _notes.some(n => n.id === id);
  _activeId = id;

  const titleEl   = document.getElementById('noteEditorTitle');
  const contentEl = document.getElementById('devNotes');
  const emptyEl   = document.getElementById('noteEditorEmpty');
  const formEl    = document.getElementById('noteEditorForm');
  const sharedEl  = document.getElementById('notesShared');
  const saveBtn   = document.querySelector('.notes-editor-head .btn-accent');

  if (titleEl)   { titleEl.value = note.title || ''; titleEl.disabled = !isOwn; }
  if (contentEl) { contentEl.value = note.content || ''; contentEl.disabled = !isOwn; }
  if (emptyEl)   emptyEl.style.display  = 'none';
  if (formEl)    formEl.style.display   = 'flex';
  if (sharedEl)  { sharedEl.checked = !!note.shared; sharedEl.disabled = !isOwn; }
  if (saveBtn)   saveBtn.style.display  = isOwn ? '' : 'none';

  _updateEditorMeta(note, isOwn);
  renderNoteList();
}

// Convenience: select note and scroll to the editor section
export function selectNoteAndGoToEditor(id) {
  selectNote(id);
  setTimeout(() => {
    document.getElementById('noteEditorTitle')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

function _updateEditorMeta(note, isOwn = true) {
  const badge    = document.getElementById('notesBadge');
  const meta     = document.getElementById('notesMetaText');
  const noteOwnr = isOwner(note.ownerId ?? _currentUserId);

  if (badge) {
    if (!isOwn) {
      badge.textContent = noteOwnr ? '👑 Owner' : 'Shared · Read Only';
      badge.className   = 'notes-badge';
      badge.style.cssText = noteOwnr
        ? 'background:rgba(248,113,113,0.1);color:var(--red);border:1px solid rgba(248,113,113,0.2)'
        : 'background:rgba(255,255,255,0.04);color:var(--muted);border:1px solid var(--border)';
    } else {
      badge.textContent   = note.shared ? (noteOwnr ? '👑 Published' : 'Published') : 'Private';
      badge.className     = note.shared ? 'notes-badge shared' : 'notes-badge private';
      badge.style.cssText = noteOwnr && note.shared
        ? 'background:rgba(248,113,113,0.1);color:var(--red);border:1px solid rgba(248,113,113,0.2)'
        : '';
    }
  }
  if (meta) meta.textContent = note.updatedAt ? `Saved ${fmtDate(note.updatedAt)}` : 'Not saved yet';
}

// ── New note ──────────────────────────────────────────────────────────────────
export function newNote() {
  const tempId = 'new-' + Date.now();
  const note   = { id: tempId, title: '', content: '', shared: false, isNew: true,
                   ownerId: _currentUserId,
                   createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  _notes.unshift(note);
  _page = 1;
  selectNote(note.id);
  renderNoteList();
  setTimeout(() => document.getElementById('noteEditorTitle')?.focus(), 60);
}

// ── Delete note ───────────────────────────────────────────────────────────────
export async function deleteNote(id) {
  if (!confirm('Delete this note?')) return;
  const note = _notes.find(n => n.id === id);
  if (!note) return; // can only delete own notes

  if (!note.isNew) {
    try { await secureFetch(`/api-dev/notes/${id}`, { method: 'DELETE' }); } catch {}
  }

  _notes = _notes.filter(n => n.id !== id);
  if (_activeId === id) {
    _activeId = null;
    const emptyEl = document.getElementById('noteEditorEmpty');
    const formEl  = document.getElementById('noteEditorForm');
    if (emptyEl) emptyEl.style.display = 'flex';
    if (formEl)  formEl.style.display  = 'none';
  }
  renderNoteList();
  showToast('Note deleted');
}

export function onNoteTitleChange() {
  if (!_activeId) return;
  const note = _notes.find(n => n.id === _activeId);
  if (!note) return;
  note.title     = document.getElementById('noteEditorTitle')?.value.trim() || 'Untitled';
  note.updatedAt = new Date().toISOString();
  renderNoteList();
}

// ── Save ──────────────────────────────────────────────────────────────────────
export async function saveNotes() {
  if (!_activeId) { showToast('Select or create a note first', true); return; }
  const note = _notes.find(n => n.id === _activeId);
  if (!note) { showToast('You can only edit your own notes', true); return; }

  note.title   = (document.getElementById('noteEditorTitle')?.value || '').trim() || 'Untitled';
  note.content = document.getElementById('devNotes')?.value || '';
  note.shared  = document.getElementById('notesShared')?.checked ?? false;

  try {
    const r = await secureFetch('/api-dev/notes', {
      method: 'POST',
      body:   JSON.stringify({
        noteId:  note.isNew ? undefined : note.id,
        title:   note.title,
        content: note.content,
        shared:  note.shared,
      }),
    }).then(r => r.json());

    if (r.error) return showToast(r.error, true);

    if (r.noteId && note.isNew) {
      note.id    = r.noteId;
      note.isNew = false;
      _activeId  = r.noteId;
    }
    note.updatedAt = r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString();
    _updateEditorMeta(note, true);
    renderNoteList();
    showToast(note.shared ? 'Saved & published to team board!' : 'Note saved!');

    // Refresh shared board if this note was published/unpublished
    if (note.shared) {
      // Update or add to _sharedNotes
      const idx = _sharedNotes.findIndex(n => n.id === note.id);
      const sharedCopy = { ...note, ownerId: _currentUserId };
      if (idx >= 0) _sharedNotes[idx] = sharedCopy;
      else          _sharedNotes.unshift(sharedCopy);
    } else {
      // Remove from shared board if un-published
      _sharedNotes = _sharedNotes.filter(n => n.id !== note.id);
    }
    _renderSharedBoard(_sharedNotes);
  } catch {
    showToast('Failed to save note', true);
  }
}

// ── Shared board renderer ─────────────────────────────────────────────────────
function _renderSharedBoard(sharedNotes) {
  const board = document.getElementById('sharedNotesBoard');
  if (!board) return;

  if (!sharedNotes || !sharedNotes.length) {
    board.innerHTML = `<div class="notes-empty">No shared notes yet — publish a note using the toggle in the editor below</div>`;
    return;
  }

  board.innerHTML = sharedNotes.map(note => {
    const isPriority = isOwner(note.ownerId);
    const html = escapeHtml(note.content || '')
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff">$1</strong>')
      .replace(/\n/g, '<br>');

    // Red for priority owner, subtle for others
    const borderColor = isPriority ? 'rgba(248,113,113,0.3)'  : 'var(--border)';
    const bgColor     = isPriority ? 'rgba(248,113,113,0.05)' : 'rgba(255,255,255,0.025)';
    const shadowStr   = isPriority ? 'box-shadow:0 0 22px rgba(248,113,113,0.08);' : '';
    const titleColor  = isPriority ? 'var(--red)' : '#fff';
    const metaColor   = isPriority ? 'rgba(248,113,113,0.7)' : 'var(--muted)';

    return `
      <div style="
        background:${bgColor};
        border:1px solid ${borderColor};
        border-radius:10px;padding:14px 16px;margin-bottom:10px;
        ${shadowStr}
        transition:border-color 0.2s;
      ">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          ${isPriority ? '<span style="font-size:12px;line-height:1">👑</span>' : ''}
          <span style="font-size:0.82rem;font-weight:700;color:${titleColor}">${escapeHtml(note.title || 'Untitled')}</span>
          ${isPriority ? `<span style="font-size:0.58rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;
            padding:2px 8px;border-radius:10px;
            background:rgba(248,113,113,0.1);color:var(--red);border:1px solid rgba(248,113,113,0.2)">Owner</span>` : ''}
          <span style="font-size:0.58rem;font-weight:700;letter-spacing:0.06em;
            color:${metaColor};margin-left:auto;white-space:nowrap">
            ${fmtDate(note.updatedAt)}
            ${note.updatedBy ? ' · ' + escapeHtml(note.updatedBy) : ''}
          </span>
        </div>
        <div style="font-size:0.8rem;color:var(--text2);line-height:1.7;word-break:break-word">${html}</div>
      </div>`;
  }).join('');
}

export function onShareToggle() {
  const on    = document.getElementById('notesShared')?.checked;
  const badge = document.getElementById('notesBadge');
  const noteOwnr = iAmOwner();

  if (badge) {
    badge.textContent = on ? (noteOwnr ? '👑 Published' : 'Published') : 'Private';
    badge.className   = on ? 'notes-badge shared' : 'notes-badge private';
    badge.style.cssText = noteOwnr && on
      ? 'background:rgba(248,113,113,0.1);color:var(--red);border:1px solid rgba(248,113,113,0.2)'
      : '';
  }
  if (_activeId) {
    const note = _notes.find(n => n.id === _activeId);
    if (note) note.shared = !!on;
  }
  showToast(on ? 'Save to publish this note to the team board' : 'Publish disabled — save to update');
}

// ── Load ──────────────────────────────────────────────────────────────────────
export async function loadNotes() {
  try {
    const d = await secureFetch('/api-dev/notes').then(r => r.json());
    if (!d.error) {
      // Capture current user ID from API (added to response)
      if (d.currentUserId) _currentUserId = d.currentUserId;

      if (Array.isArray(d.notes)) {
        _notes = d.notes.map(n => ({
          id:        n.id,
          title:     n.title   ?? 'Untitled',
          content:   n.content ?? '',
          shared:    n.shared  ?? false,
          ownerId:   _currentUserId, // own notes belong to current user
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
        }));
      }

      if (Array.isArray(d.sharedNotes)) {
        _sharedNotes = d.sharedNotes.map(n => ({
          id:        n.id,
          title:     n.title   ?? 'Untitled',
          content:   n.content ?? '',
          ownerId:   n.ownerId ?? null,
          updatedBy: n.updatedBy ?? null,
          shared:    true,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
        }));
        _renderSharedBoard(_sharedNotes);
      }
    }
  } catch {}

  // One-time migration from localStorage
  try {
    const local = localStorage.getItem('devNotesList');
    if (local && _notes.length === 0) {
      const localNotes = JSON.parse(local);
      if (Array.isArray(localNotes) && localNotes.length) {
        for (const n of localNotes) {
          try {
            await secureFetch('/api-dev/notes', {
              method: 'POST',
              body: JSON.stringify({ title: n.title || 'Untitled', content: n.content || '', shared: false }),
            });
          } catch {}
        }
        localStorage.removeItem('devNotesList');
        const d2 = await secureFetch('/api-dev/notes').then(r => r.json());
        if (!d2.error) {
          if (d2.currentUserId) _currentUserId = d2.currentUserId;
          if (Array.isArray(d2.notes)) {
            _notes = d2.notes.map(n => ({
              id: n.id, title: n.title ?? 'Untitled',
              content: n.content ?? '', shared: n.shared ?? false,
              ownerId: _currentUserId,
              createdAt: n.createdAt, updatedAt: n.updatedAt,
            }));
          }
        }
      }
    }
  } catch {}

  renderNoteList();
  if (_notes.length) {
    const latest = [..._notes].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
    selectNote(latest.id);
  }
}

export function updateNotesMeta() {}
export let notesSharedMode = false;