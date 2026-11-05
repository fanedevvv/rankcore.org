// ─── Saved Messages ───────────────────────────────────────────────────────────

import { showToast, escapeHtml,
         savedMessages, setSavedMessages,
         editingId, setEditingId,
         currentMode }              from './state.js';
import { switchMode }               from './tabs.js';
import { updatePreview, addField }  from './preview.js';
import { buildV1Payload }           from './v1builder.js';
import { buildV2Payload }           from './v2builder.js';

const TYPE_BADGE = {
  embed: 'bg-blue-500/20 text-blue-300',
  v1:    'bg-red-500/20 text-red-400',
  v2:    'bg-purple-500/20 text-purple-300',
};

// ─── Load & Render ────────────────────────────────────────────────────────────

export async function loadSaved(guildId) {
  try {
    const res  = await fetch(`/api/guild/${guildId}/embed/saved`);
    const d    = await res.json();
    setSavedMessages(d.messages || []);
    renderSaved();
  } catch {
    showToast('Could not load saved messages', 'error');
  }
}

export function renderSaved() {
  const q        = document.getElementById('savedSearch')?.value.toLowerCase() || '';
  const filtered = savedMessages.filter(m =>
    m.name.toLowerCase().includes(q) || m.type.includes(q)
  );
  const c = document.getElementById('savedList');
  if (!c) return;

  if (!filtered.length) {
    c.innerHTML = `<p class="text-gray-500 text-sm text-center py-8">${
      savedMessages.length ? 'No results.' : 'No saved messages yet.'
    }</p>`;
    return;
  }

  c.innerHTML = filtered.map(m => `
    <div class="saved-card bg-[#1a1a2e] rounded-xl p-4 border border-white/10 transition-all">
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-semibold text-sm truncate">${escapeHtml(m.name)}</span>
            <span class="text-xs px-1.5 py-0.5 rounded font-mono ${TYPE_BADGE[m.type] || 'bg-gray-500/20 text-gray-300'}">${m.type.toUpperCase()}</span>
          </div>
          <p class="text-xs text-gray-500">${new Date(m.updatedAt).toLocaleString()}</p>
        </div>
        <div class="flex gap-1.5 flex-shrink-0">
          <button onclick="loadSavedMessage('${m.id}')" class="px-2.5 py-1.5 text-xs bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 rounded-lg transition-all">Load</button>
          <button onclick="sendSavedMessage('${m.id}')" class="px-2.5 py-1.5 text-xs bg-razor/20 hover:bg-razor/30 text-red-400 border border-red-500/30 rounded-lg transition-all">Send</button>
          <button onclick="duplicateSaved('${m.id}')" class="px-2.5 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all" title="Duplicate">⧉</button>
          <button onclick="deleteSaved('${m.id}')" class="px-2.5 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-all">✕</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function openSavedPanel(guildId) {
  document.getElementById('savedPanel')?.classList.remove('hidden');
  loadSaved(guildId);
}

export function closeSavedPanel() {
  document.getElementById('savedPanel')?.classList.add('hidden');
}

// ─── Load into editor ─────────────────────────────────────────────────────────

export function loadSavedMessage(id) {
  const msg = savedMessages.find(m => m.id === id);
  if (!msg) return;

  switchMode(msg.type);
  setEditingId(id);
  const p = msg.payload;

  if (msg.type === 'embed') {
    const set    = (elId, val) => { const el = document.getElementById(elId); if (el) el.value  = val || ''; };
    const setChk = (elId, val) => { const el = document.getElementById(elId); if (el) el.checked = !!val; };

    set('plainMessage', p.content);
    const e = p.embed || {};
    set('title',       e.title);
    set('description', e.description);
    set('color',       e.color ? '#' + e.color.toString(16).padStart(6, '0') : '#6C53FF');
    set('authorName',  e.author?.name);
    set('authorIcon',  e.author?.icon_url);
    set('authorUrl',   e.author?.url);
    set('thumbnail',   e.thumbnail?.url);
    set('image',       e.image?.url);
    set('footerText',  e.footer?.text);
    set('footerIcon',  e.footer?.icon_url);
    setChk('timestamp', e.timestamp);

    const fc = document.getElementById('fieldsContainer');
    if (fc) fc.innerHTML = '';
    (e.fields || []).forEach(f => {
      addField();
      const items = document.querySelectorAll('.field-item');
      const last  = items[items.length - 1];
      if (last) {
        last.querySelector('.field-name').value    = f.name;
        last.querySelector('.field-value').value   = f.value;
        last.querySelector('.field-inline').checked = f.inline;
      }
    });
    updatePreview();
  }

  closeSavedPanel();
  showToast(`Loaded: ${msg.name}`, 'success');
}

// ─── Send saved ───────────────────────────────────────────────────────────────

export async function sendSavedMessage(id, guildId) {
  const msg       = savedMessages.find(m => m.id === id);
  const channelId = document.getElementById('channel')?.value;
  if (!msg)       return showToast('Message not found', 'error');
  if (!channelId) return showToast('Select a channel first', 'error');

  try {
    const res  = await fetch(`/api/guild/${guildId}/embed/send`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...msg.payload, channelId, type: msg.type }),
    });
    const d = await res.json();
    if (res.ok) showToast(`✅ Sent: ${msg.name}`, 'success');
    else        showToast(d.error || 'Failed', 'error');
  } catch { showToast('Connection error', 'error'); }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteSaved(id, guildId) {
  if (!confirm('Delete this saved message?')) return;
  try {
    await fetch(`/api/guild/${guildId}/embed/saved/${id}`, { method: 'DELETE' });
    setSavedMessages(savedMessages.filter(m => m.id !== id));
    renderSaved();
    showToast('Deleted', 'success');
  } catch { showToast('Failed to delete', 'error'); }
}

// ─── Duplicate ────────────────────────────────────────────────────────────────

export async function duplicateSaved(id, guildId) {
  try {
    const res = await fetch(`/api/guild/${guildId}/embed/saved/${id}/duplicate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    const d = await res.json();
    if (res.ok) {
      savedMessages.unshift(d.message);
      renderSaved();
      showToast('Duplicated', 'success');
    } else {
      showToast(d.error || 'Failed', 'error');
    }
  } catch { showToast('Error', 'error'); }
}

// ─── Save dialog ──────────────────────────────────────────────────────────────

export function saveCurrentMessage() {
  document.getElementById('saveNameInput').value = '';
  document.getElementById('saveDialog')?.classList.remove('hidden');
}

export function closeSaveDialog() {
  document.getElementById('saveDialog')?.classList.add('hidden');
}

export async function confirmSave(guildId) {
  const name = document.getElementById('saveNameInput')?.value.trim();
  if (!name) { showToast('Please enter a name', 'error'); return; }

  let payload = { content: document.getElementById('plainMessage')?.value || undefined };

  if (currentMode === 'embed') {
    const fields = Array.from(document.querySelectorAll('.field-item')).map(f => ({
      name:   f.querySelector('.field-name')?.value,
      value:  f.querySelector('.field-value')?.value,
      inline: f.querySelector('.field-inline')?.checked,
    })).filter(f => f.name && f.value);

    payload.embed = {
      title:       document.getElementById('title')?.value       || undefined,
      description: document.getElementById('description')?.value || undefined,
      color:       parseInt((document.getElementById('color')?.value || '#6C53FF').replace('#', ''), 16) || 0x6C53FF,
      fields,
    };
  } else if (currentMode === 'v1') {
    payload.components = buildV1Payload();
  } else {
    payload.components = buildV2Payload();
  }

  try {
    const res = await fetch(`/api/guild/${guildId}/embed/saved`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: editingId, name, type: currentMode, payload }),
    });
    const d = await res.json();
    if (res.ok) {
      const idx = savedMessages.findIndex(m => m.id === d.message.id);
      if (idx >= 0) savedMessages[idx] = d.message;
      else          savedMessages.unshift(d.message);
      closeSaveDialog();
      showToast(`Saved: ${name}`, 'success');
    } else {
      showToast(d.error || 'Failed to save', 'error');
    }
  } catch { showToast('Error saving', 'error'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATES PANEL — browse guild message templates and load into the editor
// ══════════════════════════════════════════════════════════════════════════════

let _tplPanelGuildId  = null;
let _tplPanelData     = [];    // cached template list

export function openTemplatesPanel(guildId) {
  _tplPanelGuildId = guildId;

  // Set the "Manage" link to the templates page for this guild
  const link = document.getElementById('templatesPageLink');
  if (link) link.href = `/guild/${guildId}/templates`;

  document.getElementById('templatesPanel')?.classList.remove('hidden');
  document.getElementById('tplPanelSearch').value       = '';
  document.getElementById('tplPanelTypeFilter').value   = '';

  _fetchTemplates(guildId);
}

export function closeTemplatesPanel() {
  document.getElementById('templatesPanel')?.classList.add('hidden');
}

export function renderTemplatesPanel() {
  const q    = (document.getElementById('tplPanelSearch')?.value || '').toLowerCase().trim();
  const type = document.getElementById('tplPanelTypeFilter')?.value || '';
  const c    = document.getElementById('templatesPanelList');
  if (!c) return;

  const filtered = _tplPanelData.filter(t => {
    const matchType = !type || t.type === type;
    const matchQ    = !q
      || t.name.toLowerCase().includes(q)
      || (t.description || '').toLowerCase().includes(q)
      || (t.tags || []).some(tag => tag.toLowerCase().includes(q));
    return matchType && matchQ;
  });

  if (!filtered.length) {
    c.innerHTML = `<p class="text-sm text-center py-8" style="color:var(--muted)">${
      _tplPanelData.length ? 'No templates match your search.' : 'No templates saved for this server yet.'
    }</p>
    <div class="text-center">
      <a id="templatesPageLink2" href="/guild/${escapeHtml(_tplPanelGuildId)}/templates" target="_blank"
         class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all"
         style="background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);color:#8B5CF6">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Create Templates
      </a>
    </div>`;
    return;
  }

  const TYPE_COLOR = {
    text:  'rgba(107,114,128,.2)',
    embed: 'rgba(59,130,246,.2)',
    v2:    'rgba(108,83,255,.2)',
  };
  const TYPE_TEXT = {
    text:  '#9ca3af',
    embed: '#93c5fd',
    v2:    '#c4b5fd',
  };

  c.innerHTML = filtered.map(t => {
    const preview = t.type === 'text'
      ? (t.content || '').slice(0, 90)
      : t.type === 'embed'
        ? (t.embed?.title || t.embed?.description || '').slice(0, 90)
        : 'V2 Components';
    const tags = (t.tags || []).map(tag =>
      `<span style="font-size:10px;background:rgba(255,255,255,.06);padding:1px 6px;border-radius:5px;color:#6b7280;font-family:monospace">${escapeHtml(tag)}</span>`
    ).join('');

    return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:14px;transition:border-color .15s"
               onmouseenter="this.style.borderColor='rgba(139,92,246,.25)'" onmouseleave="this.style.borderColor='rgba(255,255,255,.065)'">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
            <span style="font-weight:700;font-size:13px;color:#edf0f8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.name)}</span>
            <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;background:${TYPE_COLOR[t.type]||TYPE_COLOR.text};color:${TYPE_TEXT[t.type]||TYPE_TEXT.text};flex-shrink:0">${(t.type||'text').toUpperCase()}</span>
          </div>
          ${t.description ? `<p style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.description)}</p>` : ''}
        </div>
      </div>
      ${preview ? `<p style="font-size:12px;color:#6b7280;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(preview)}</p>` : ''}
      ${tags ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">${tags}</div>` : ''}
      <div style="display:flex;gap:6px">
        <button onclick="loadFromTemplate('${escapeHtml(t.id)}')"
          style="flex:1;padding:6px 10px;font-size:12px;font-weight:600;border-radius:9px;border:1px solid rgba(139,92,246,.3);background:rgba(139,92,246,.08);color:#8B5CF6;cursor:pointer;transition:all .15s"
          onmouseenter="this.style.background='rgba(139,92,246,.15)'" onmouseleave="this.style.background='rgba(139,92,246,.08)'">
          Load into Editor
        </button>
        <a href="/guild/${escapeHtml(_tplPanelGuildId)}/templates" target="_blank"
          style="padding:6px 10px;font-size:12px;font-weight:600;border-radius:9px;border:1px solid var(--border);background:rgba(255,255,255,.04);color:var(--muted);cursor:pointer;transition:all .15s;text-decoration:none;display:flex;align-items:center"
          onmouseenter="this.style.background='rgba(255,255,255,.08)'" onmouseleave="this.style.background='rgba(255,255,255,.04)'">
          Edit
        </a>
      </div>
    </div>`;
  }).join('');
}

async function _fetchTemplates(guildId) {
  const c = document.getElementById('templatesPanelList');
  if (c) c.innerHTML = `<p class="text-sm text-center py-8" style="color:var(--muted)">Loading templates...</p>`;

  try {
    const res  = await fetch(`/api/guild/${guildId}/templates`);
    const data = await res.json();
    _tplPanelData = data.data || [];
    renderTemplatesPanel();
  } catch {
    if (c) c.innerHTML = `<p class="text-sm text-center py-8" style="color:#f87171">Failed to load templates.</p>`;
  }
}

// ── Load a template's content into the embed creator ─────────────────────────

export function loadFromTemplate(id) {
  const t = _tplPanelData.find(x => x.id === id);
  if (!t) return showToast('Template not found', 'error');

  // Map template type → embed creator mode
  // text   → 'embed' mode with only plain content
  // embed  → 'embed' mode (or 'embed_v1' if it has buttons)
  // v2     → 'v2' mode
  const hasButtons = t.buttons?.components?.length > 0;

  if (t.type === 'v2') {
    switchMode('v2');
    _loadV2Components(t.v2Components || []);
  } else if (t.type === 'embed') {
    switchMode(hasButtons ? 'embed_v1' : 'embed');
    _loadEmbedData(t);
  } else {
    // plain text — put it in the plain message field
    switchMode('embed');
    const pm = document.getElementById('plainMessage');
    if (pm) { pm.value = t.content || ''; pm.dispatchEvent(new Event('input')); }
  }

  closeTemplatesPanel();
  showToast(`Loaded: ${t.name}`, 'success');
}

function _loadEmbedData(t) {
  const set    = (elId, val) => { const el = document.getElementById(elId); if (el) el.value  = val || ''; };
  const setChk = (elId, val) => { const el = document.getElementById(elId); if (el) el.checked = !!val; };

  // Plain text above embed
  set('plainMessage', t.plainText || '');

  const e = t.embed || {};
  set('title',       e.title);
  set('description', e.description);

  // Color: template stores as hex string like "#6C53FF"
  set('color', e.color || '#6C53FF');

  set('authorName', e.authorName);
  set('authorIcon', e.authorIcon);
  set('thumbnail',  e.thumbnail);
  set('image',      e.image);
  set('footerText', e.footerText);
  set('footerIcon', e.footerIcon);
  setChk('timestamp', e.timestamp);

  // Fields
  const fc = document.getElementById('fieldsContainer');
  if (fc) {
    fc.innerHTML = '';
    (e.fields || []).forEach(f => {
      // addField() is exposed on window by embeddmain.js
      if (typeof window.addField === 'function') window.addField();
      const items = document.querySelectorAll('.field-item');
      const last  = items[items.length - 1];
      if (last) {
        last.querySelector('.field-name').value    = f.name || '';
        last.querySelector('.field-value').value   = f.value || '';
        last.querySelector('.field-inline').checked = !!f.inline;
      }
    });
  }

  if (typeof window.updatePreview === 'function') window.updatePreview();
}

function _loadV2Components(components) {
  // Clear existing V2 blocks then rebuild from the template's component array
  const container = document.getElementById('v2BlocksContainer');
  const hint      = document.getElementById('v2EmptyHint');
  if (!container) return;

  container.innerHTML = '';
  if (hint) hint.classList.toggle('hidden', components.length > 0);

  // For V2 templates we show a read-only JSON block so the user can see
  // what was loaded; they can edit inside the V2 builder normally.
  // A full visual reconstruction would require duplicating all the V2
  // block-builder DOM logic — instead we populate what we can and show
  // a JSON summary for the rest.
  for (const comp of components) {
    if (comp.type === 10) {
      // Text display block
      if (typeof window.addV2Block === 'function') window.addV2Block('text');
      const textareas = container.querySelectorAll('.v2-text-content');
      const last = textareas[textareas.length - 1];
      if (last) { last.value = comp.content || ''; last.dispatchEvent(new Event('input')); }
    } else if (comp.type === 14) {
      if (typeof window.addV2Block === 'function') window.addV2Block('sep');
    } else {
      // For complex components (section, gallery, container, action row)
      // render an info block so data is visible
      _appendV2JsonBlock(container, comp);
    }
  }

  if (typeof window.updateV2Preview === 'function') window.updateV2Preview();
}

function _appendV2JsonBlock(container, comp) {
  const typeLabels = { 1:'Action Row', 9:'Section', 12:'Gallery', 17:'Container' };
  const label = typeLabels[comp.type] || `Component (type ${comp.type})`;
  const d = document.createElement('div');
  d.className = 'v2-block';
  d.style.cssText = 'background:#0e0e1e;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px;margin-bottom:6px';
  d.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <span style="font-size:11px;font-weight:700;color:#a78bfa">📦 ${escapeHtml(label)} <span style="font-weight:400;color:#6b7280;font-size:10px">(loaded from template)</span></span>
      <button onclick="this.closest('.v2-block').remove();if(typeof window.updateV2Preview==='function')window.updateV2Preview()"
        style="font-size:11px;color:#f87171;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.2);padding:2px 7px;border-radius:6px;cursor:pointer">Remove</button>
    </div>
    <textarea readonly style="width:100%;background:#060611;border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:8px;font-size:10px;font-family:monospace;color:#EF4444;resize:vertical;min-height:60px;outline:none">${escapeHtml(JSON.stringify(comp, null, 2))}</textarea>`;
  container.appendChild(d);
}