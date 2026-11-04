// ─── V1 Button Builder ────────────────────────────────────────────────────────

import { showToast } from './state.js';

const STYLE_COLORS = { 1: '#5865f2', 2: '#4e5058', 3: '#248046', 4: '#da373c', 5: '#4e5058' };
const BTN_STYLES   = { 1: 'Primary', 2: 'Secondary', 3: 'Success', 4: 'Danger', 5: 'Link (URL)' };

const STYLE_OPTIONS = Object.entries(BTN_STYLES)
  .map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

const ACTION_OPTIONS = `
  <option value="none">— No action (link btn or custom bot code) —</option>
  <option value="reply">↩️  Reply with message</option>
  <option value="dm">📬  DM the user</option>
  <option value="role_add">➕  Add role</option>
  <option value="role_remove">➖  Remove role</option>
  <option value="role_toggle">🔁  Toggle role</option>
`.trim();

// ─── Shared: build one row ────────────────────────────────────────────────────

function buildRowEl(rowNum, containerId, emptyHintId) {
  const d = document.createElement('div');
  d.className  = 'v1-row bg-[#14142b] rounded-xl p-4 border border-white/10';
  d.dataset.container = containerId;
  d.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <span class="v1-row-label text-sm font-semibold text-gray-300">Row ${rowNum}</span>
      <div class="flex gap-2">
        <button onclick="addV1Button(this)"
                class="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all">+ Button</button>
        <button onclick="this.closest('.v1-row').remove(); _refreshV1Preview('${containerId}', '${emptyHintId}')"
                class="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-all">Remove Row</button>
      </div>
    </div>
    <div class="v1-buttons-container space-y-2">
      <p class="v1-row-empty text-xs text-gray-600 italic">No buttons yet. Click "+ Button" to add one.</p>
    </div>
  `;
  return d;
}

// ─── Add row to V1-only container ─────────────────────────────────────────────

export function addV1Row() {
  const hint = document.getElementById('v1EmptyHint');
  const c    = document.getElementById('v1RowsContainer');
  if (!c) return;
  const existing = c.querySelectorAll('.v1-row');
  if (existing.length >= 5) { showToast('Maximum 5 rows per message.', 'error'); return; }
  hint?.classList.add('hidden');
  c.appendChild(buildRowEl(existing.length + 1, 'v1RowsContainer', 'v1EmptyHint'));
  updateV1Preview();
}

// ─── Add row to embed+buttons container ──────────────────────────────────────

export function addEmbedBtnRow() {
  const hint = document.getElementById('embedBtnEmptyHint');
  const c    = document.getElementById('embedBtnRowsContainer');
  if (!c) return;
  const existing = c.querySelectorAll('.v1-row');
  if (existing.length >= 5) { showToast('Maximum 5 rows per message.', 'error'); return; }
  hint?.classList.add('hidden');
  c.appendChild(buildRowEl(existing.length + 1, 'embedBtnRowsContainer', 'embedBtnEmptyHint'));
  updateV1Preview();
}

// ─── Add button to a row ──────────────────────────────────────────────────────

export function addV1Button(btn) {
  const row  = btn.closest('.v1-row');
  const btns = row.querySelectorAll('.v1-btn-item');
  if (btns.length >= 5) { showToast('Maximum 5 buttons per row.', 'error'); return; }
  row.querySelector('.v1-row-empty')?.remove();

  const c = row.querySelector('.v1-buttons-container');
  const d = document.createElement('div');
  d.className = 'v1-btn-item grid grid-cols-2 gap-2 p-3';
  d.innerHTML = `
    <input class="v1-btn-label col-span-2 sm:col-span-1 px-3 py-2 text-sm" placeholder="Button label" oninput="updateV1Preview()">
    <select class="v1-btn-style appearance-none px-3 py-2 text-sm" onchange="toggleV1BtnFields(this)">${STYLE_OPTIONS}</select>
    <div class="v1-id-wrap col-span-2">
      <input class="v1-btn-id px-3 py-2 text-sm" placeholder="Custom ID (e.g. open_ticket)" oninput="updateV1Preview()">
    </div>
    <div class="v1-url-wrap col-span-2 hidden">
      <input class="v1-btn-url px-3 py-2 text-sm" placeholder="URL (https://...)" oninput="updateV1Preview()">
    </div>
    <input class="v1-btn-emoji col-span-2 sm:col-span-1 px-3 py-2 text-sm" placeholder="Emoji (optional, e.g. 🎫)" oninput="updateV1Preview()">
    <div class="flex items-center justify-between gap-2 col-span-2 sm:col-span-1">
      <label class="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" class="v1-btn-disabled w-3.5 h-3.5" style="accent-color:var(--razor)" onchange="updateV1Preview()">
        <span class="text-xs text-gray-400">Disabled</span>
      </label>
      <button onclick="this.closest('.v1-btn-item').remove(); updateV1Preview()"
              class="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-2.5 py-1.5 rounded-lg transition-all">Remove</button>
    </div>
    ${actionPickerHtml('v1-')}
  `;
  c.appendChild(d);
  _populateRoleDropdown(d.querySelector('.v1-action-role-id'));
  updateV1Preview();
}

// ─── Action picker HTML ───────────────────────────────────────────────────────

function actionPickerHtml(pfx) {
  return `
    <div class="action-wrap col-span-2 space-y-2">
      <div class="flex items-center gap-1.5">
        <label class="text-xs text-gray-500 font-semibold uppercase tracking-wide">Bot Action</label>
        <span class="text-xs text-purple-400 font-medium">(saved separately)</span>
        <div class="has-tip" style="position:relative;display:inline-flex">
          <span class="help-btn">?</span>
          <div class="tip-box" style="position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:#1e1e35;border:1px solid rgba(108,83,255,.4);color:#c4c4e0;font-size:.71rem;line-height:1.5;padding:.5rem .75rem;border-radius:.6rem;width:max-content;max-width:240px;box-shadow:0 8px 24px rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .15s;z-index:200;white-space:pre-wrap;text-align:left">What happens when a user clicks this button in Discord. Click "Save Action" to store it — it's independent of sending the message.</div>
        </div>
      </div>
      <select class="${pfx}action-type w-full text-sm px-3 py-2" onchange="toggleActionFields(this,'${pfx}')">${ACTION_OPTIONS}</select>
      <div class="${pfx}action-reply-fields hidden space-y-2">
        <textarea class="${pfx}action-reply-content w-full px-3 py-2 text-sm resize-none" rows="2" placeholder="Reply content (max 2000 chars)..."></textarea>
        <label class="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-400">
          <input type="checkbox" class="${pfx}action-ephemeral w-3.5 h-3.5" style="accent-color:var(--razor)" checked>
          Only visible to the person who clicked (ephemeral)
        </label>
      </div>
      <div class="${pfx}action-role-fields hidden">
        <select class="${pfx}action-role-id w-full text-sm px-3 py-2"><option value="">Loading roles…</option></select>
      </div>
      <button onclick="saveButtonAction(this,'${pfx}')"
              class="w-full py-1.5 text-xs font-semibold rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition-all">
        💾 Save Action
      </button>
    </div>
  `;
}

// ─── Toggle V1 button fields ──────────────────────────────────────────────────

export function toggleV1BtnFields(sel) {
  const item   = sel.closest('.v1-btn-item');
  const isLink = sel.value === '5';
  item?.querySelector('.v1-id-wrap')?.classList.toggle('hidden',  isLink);
  item?.querySelector('.v1-url-wrap')?.classList.toggle('hidden', !isLink);
  item?.querySelector('.action-wrap')?.classList.toggle('hidden',  isLink);
  updateV1Preview();
}

// ─── Shared: toggle action sub-fields ─────────────────────────────────────────

export function toggleActionFields(sel, pfx = 'v1-') {
  const wrap  = sel.closest('.action-wrap');
  if (!wrap) return;
  const type  = sel.value;
  const reply = type === 'reply' || type === 'dm';
  const role  = type === 'role_add' || type === 'role_remove' || type === 'role_toggle';
  wrap.querySelector(`.${pfx}action-reply-fields`)?.classList.toggle('hidden', !reply);
  wrap.querySelector(`.${pfx}action-role-fields`)?.classList.toggle('hidden',  !role);
}

// ─── Save a button action ──────────────────────────────────────────────────────

export async function saveButtonAction(btn, pfx = 'v1-') {
  const wrap   = btn.closest('.action-wrap');
  const item   = btn.closest('.v1-btn-item') || btn.closest('.v2-btn-entry');
  if (!wrap || !item) return;

  const customIdInput = item.querySelector('.v1-btn-id') || item.querySelector('.v2-row-btn-id');
  const customId = customIdInput?.value?.trim();
  if (!customId) { showToast('Set a Custom ID before saving an action.', 'error'); return; }

  const actionType     = wrap.querySelector(`.${pfx}action-type`)?.value || 'none';
  const replyContent   = wrap.querySelector(`.${pfx}action-reply-content`)?.value?.trim() || '';
  const replyEphemeral = wrap.querySelector(`.${pfx}action-ephemeral`)?.checked !== false;
  const roleId         = wrap.querySelector(`.${pfx}action-role-id`)?.value || '';

  if ((actionType === 'reply' || actionType === 'dm') && !replyContent) {
    showToast('Enter a message for this action.', 'error'); return;
  }
  if (['role_add','role_remove','role_toggle'].includes(actionType) && !roleId) {
    showToast('Select a role for this action.', 'error'); return;
  }

  const guildId = location.pathname.split('/')[2];
  try {
    const res  = await fetch(`/api/guild/${guildId}/embed/button-actions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customId, actionType, replyContent, replyEphemeral, roleId }),
    });
    const data = await res.json();
    if (res.ok) showToast(`✅ Action saved for "${customId}"!`, 'success');
    else        showToast(data.error || 'Failed to save action.', 'error');
  } catch { showToast('Connection error saving action.', 'error'); }
}

// ─── Role dropdown ────────────────────────────────────────────────────────────

let _cachedRoles = null;
export async function populateRoleDropdown(select) {
  if (!select) return;
  try {
    if (!_cachedRoles) {
      const guildId = location.pathname.split('/')[2];
      const res     = await fetch(`/api/guild/${guildId}/roles`);
      _cachedRoles  = await res.json();
    }
    select.innerHTML = _cachedRoles.length
      ? _cachedRoles.map(r => `<option value="${r.id}">${r.name}</option>`).join('')
      : '<option value="">No assignable roles</option>';
  } catch { select.innerHTML = '<option value="">Failed to load roles</option>'; }
}
const _populateRoleDropdown = populateRoleDropdown;

// ─── Payload builders ─────────────────────────────────────────────────────────

function rowsToPayload(container) {
  return Array.from(container.querySelectorAll('.v1-row')).map(row => ({
    type: 1,
    components: Array.from(row.querySelectorAll('.v1-btn-item')).map(btn => {
      const style    = parseInt(btn.querySelector('.v1-btn-style')?.value || '1');
      const label    = btn.querySelector('.v1-btn-label')?.value?.trim() || 'Button';
      const emoji    = btn.querySelector('.v1-btn-emoji')?.value?.trim();
      const disabled = btn.querySelector('.v1-btn-disabled')?.checked ?? false;
      const base     = { type: 2, label, style, disabled };
      if (style === 5) {
        base.url = btn.querySelector('.v1-btn-url')?.value?.trim() || 'https://example.com';
      } else {
        const cid = btn.querySelector('.v1-btn-id')?.value?.trim();
        base.custom_id = cid || `btn_${Math.random().toString(36).slice(2, 8)}`;
      }
      if (emoji) base.emoji = { name: emoji };
      return base;
    }).filter(b => b.label),
  })).filter(r => r.components.length);
}

export function buildV1Payload() {
  const c = document.getElementById('v1RowsContainer');
  return c ? rowsToPayload(c) : [];
}

export function buildEmbedBtnPayload() {
  const c = document.getElementById('embedBtnRowsContainer');
  return c ? rowsToPayload(c) : [];
}

// ─── Preview helpers ──────────────────────────────────────────────────────────

export function _refreshV1Preview(containerId, emptyHintId) {
  const hint = document.getElementById(emptyHintId);
  const c    = document.getElementById(containerId);
  if (hint && c) hint.classList.toggle('hidden', c.querySelectorAll('.v1-row').length > 0);
  updateV1Preview();
}
window._refreshV1Preview = _refreshV1Preview;

function rowsHtml(rows) {
  if (!rows.length) return '';
  return rows.map(row => {
    if (!row.components.length) return '';
    return `<div class="flex flex-wrap gap-2 mt-1.5">${row.components.map(btn =>
      `<button class="px-3 py-1.5 text-xs font-semibold rounded cursor-default"
               style="background:${STYLE_COLORS[btn.style] || '#4e5058'};color:white;opacity:${btn.disabled ? 0.45 : 1}"
       >${btn.emoji?.name || ''}${btn.label}</button>`
    ).join('')}</div>`;
  }).join('');
}

export function updateV1Preview() {
  const c = document.getElementById('prevComponents');
  if (!c) return;

  // embed_v1 — components rendered BELOW prevEmbed, embed preview is separate
  const embedBtnRows = buildEmbedBtnPayload();
  const v1Rows       = buildV1Payload();
  const rows         = embedBtnRows.length ? embedBtnRows : v1Rows;

  if (!rows.length) { c.innerHTML = ''; c.classList.add('hidden'); return; }
  c.classList.remove('hidden');
  c.innerHTML = rowsHtml(rows);
}