'use strict';
import { showToast } from './toast.js';

const PRIORITY_LABELS = { low: '🟢 Low', medium: '🟡 Medium', high: '🟠 High', urgent: '🔴 Urgent', '': 'None' };

export function renderCategories(cats, guildId) {
  const el       = document.getElementById('categoryList');
  const countEl  = document.getElementById('catCount');
  if (countEl) countEl.textContent = `${cats.length} ${cats.length === 1 ? 'Category' : 'Categories'}`;
  if (!el) return;

  if (!cats.length) {
    el.innerHTML = `<div class="empty-state"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg><p>No categories yet. Add one below.</p></div>`;
    return;
  }

  el.innerHTML = cats.map(c => `
    <div class="cat-item">
      <div class="cat-item-left">
        <div class="cat-emoji">${c.emoji || '🎫'}</div>
        <div class="cat-item-info">
          <span class="cat-item-name">${c.name}</span>
          <span class="cat-item-desc">${c.description || ''}</span>
        </div>
      </div>
      <div class="cat-item-right">
        ${c.defaultPriority ? `<span class="priority-badge priority-${c.defaultPriority}">${PRIORITY_LABELS[c.defaultPriority] || c.defaultPriority}</span>` : ''}
        ${c.staffOnly ? '<span class="cat-badge">Staff Only</span>' : ''}
        ${c.channelPrefix ? `<span class="cat-badge" style="background:rgba(99,102,241,.08);color:#818cf8;border-color:rgba(99,102,241,.2)">#${c.channelPrefix}</span>` : ''}
        ${c.pingRoles?.length ? `<span class="cat-badge" style="background:rgba(255,51,51,.08);color:#FF3333;border-color:rgba(255,51,51,.2)">${c.pingRoles.length} ping${c.pingRoles.length !== 1 ? 's' : ''}</span>` : ''}
        <button onclick="editCategory('${c.value}')" class="icon-btn" title="Edit category" style="color:#6b7280">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button onclick="removeCategory('${c.value}')" class="icon-btn icon-btn-danger" title="Delete category">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>`).join('');

  // Store cats on window so editCategory can look them up
  window._ticketCats = cats;
}

export async function editCategory(guildId, value, onSuccess) {
  const cats = window._ticketCats || [];
  const cat  = cats.find(c => c.value === value);
  if (!cat) return showToast('Category not found', 'error');

  // Populate the "New Category" form with existing values so it becomes an edit form
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  const setChecked = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

  setVal('catName',     cat.name);
  setVal('catEmoji',    cat.emoji || '');
  setVal('catDesc',     cat.description || '');
  setVal('catWelcome',  cat.welcomeMessage || '');
  setVal('catCloseMsg', cat.closeMessage || '');
  setVal('catMaxOpen',  cat.maxOpen ?? 0);
  setVal('catPrefix',   cat.channelPrefix || '');
  setChecked('catStaffOnly', cat.staffOnly);

  setTimeout(() => {
    setVal('catParent',   cat.ticketCategory || '');
    setVal('catPriority', cat.defaultPriority || '');
  }, 80);

  // Rebuild intake questions
  resetIntakeQuestions();
  (cat.intakeQuestions || []).forEach(q => addIntakeQuestion(q));

  // Switch the button to "Update Category"
  const btn = document.getElementById('addCatBtn');
  if (btn) {
    btn.textContent = '✏️ Update Category';
    btn.dataset.editingValue = value;
    btn.onclick = () => updateCategory(guildId, value, onSuccess);
  }

  // Scroll to the form
  document.getElementById('catName')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast('Editing category — update fields then click "Update Category"');
}

export async function updateCategory(guildId, value, onSuccess) {
  const name    = document.getElementById('catName')?.value.trim();
  const emoji   = document.getElementById('catEmoji')?.value.trim() || '🎫';
  const catTicketType  = document.getElementById('catTicketType')?.value || '';
  const parent  = document.getElementById('catParent')?.value;
  const threadCh = document.getElementById('catThreadChannel')?.value || null;
  const desc    = document.getElementById('catDesc')?.value.trim() || 'Click to open a ticket';
  const welcome = document.getElementById('catWelcome')?.value.trim() || '';
  const pingRoles = (typeof window.getCatPingRoles === 'function') ? window.getCatPingRoles() : [];
  const close   = document.getElementById('catCloseMsg')?.value.trim() || '';
  const maxOpen = parseInt(document.getElementById('catMaxOpen')?.value) || 0;
  const channelPrefix = document.getElementById('catPrefix')?.value.trim() || '';
  const staffOnly     = document.getElementById('catStaffOnly')?.checked || false;
  const defPriority   = document.getElementById('catPriority')?.value || '';

  if (!name) return showToast('Category name is required', 'error');
  // Only require parent category if using channel mode
  const effectiveType = catTicketType || document.querySelector('input[name="ticketType"]:checked')?.value || 'channel';
  if (effectiveType !== 'thread' && !parent) return showToast('Parent Discord category is required', 'error');

  const btn = document.getElementById('addCatBtn');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`/api/guild/${guildId}/ticket/category/${value}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, emoji, ticketCategory: parent || null, ticketType: catTicketType, threadChannel: threadCh, description: desc, welcomeMessage: welcome, closeMessage: close, maxOpen, staffOnly, defaultPriority: defPriority, channelPrefix, pingRoles, intakeQuestions: getIntakeQuestions() }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Category updated');
      resetCategoryForm();
      onSuccess?.();
    } else {
      showToast(data.error || 'Failed to update category', 'error');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function resetCategoryForm() {
  ['catName','catEmoji','catDesc','catWelcome','catCloseMsg','catMaxOpen','catPrefix'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  resetIntakeQuestions();
  const co = document.getElementById('catStaffOnly'); if (co) co.checked = false;
  const btn = document.getElementById('addCatBtn');
  if (btn) {
    btn.textContent = '+ Add Category';
    btn.onclick = () => window.addCategory?.();
    delete btn.dataset.editingValue;
  }
  if (typeof window.resetCatPingRoles === 'function') window.resetCatPingRoles();
}

export async function addCategory(guildId, onSuccess) {
  const name    = document.getElementById('catName')?.value.trim();
  const emoji   = document.getElementById('catEmoji')?.value.trim() || '🎫';
  const catTicketType  = document.getElementById('catTicketType')?.value || '';
  const parent  = document.getElementById('catParent')?.value;
  const threadCh = document.getElementById('catThreadChannel')?.value || null;
  const desc    = document.getElementById('catDesc')?.value.trim() || 'Click to open a ticket';
  const welcome = document.getElementById('catWelcome')?.value.trim() || '';
  const pingRoles = (typeof window.getCatPingRoles === 'function') ? window.getCatPingRoles() : [];
  const close   = document.getElementById('catCloseMsg')?.value.trim() || '';
  const maxOpen = parseInt(document.getElementById('catMaxOpen')?.value) || 0;
  const channelPrefix = document.getElementById('catPrefix')?.value.trim() || '';
  const staffOnly  = document.getElementById('catStaffOnly')?.checked || false;
  const defPriority = document.getElementById('catPriority')?.value || '';
  
  const intakeQuestions = getIntakeQuestions();
  console.log('[addCategory] intakeQuestions:', JSON.stringify(intakeQuestions));
  
  if (!name) return showToast('Category name is required', 'error');
  // Only require parent category if using channel mode (not thread mode)
  const effectiveType = catTicketType || document.querySelector('input[name="ticketType"]:checked')?.value || 'channel';
  if (effectiveType !== 'thread' && !parent) return showToast('Parent Discord category is required', 'error');

  const btn = document.getElementById('addCatBtn');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`/api/guild/${guildId}/ticket/category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, emoji, ticketCategory: parent || null, ticketType: catTicketType, threadChannel: threadCh, description: desc, welcomeMessage: welcome, closeMessage: close, maxOpen, staffOnly, defaultPriority: defPriority, channelPrefix, pingRoles, intakeQuestions }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Category added');
      if (typeof window.resetCatPingRoles === 'function') window.resetCatPingRoles();
      ['catName','catEmoji','catDesc','catWelcome','catCloseMsg','catMaxOpen','catPrefix'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      resetIntakeQuestions();
      const co = document.getElementById('catStaffOnly'); if (co) co.checked = false;
      onSuccess?.();
    } else {
      showToast(data.error || 'Failed to add category', 'error');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}


// ── Intake questions helpers ──────────────────────────────────────────────────

export function getIntakeQuestions() {
  const rows = document.querySelectorAll('#intakeQuestionsList .iq-row');
  console.log('[getIntakeQuestions] Found rows:', rows.length);
  
  return Array.from(rows).map((row, i) => {
    const labelInput = row.querySelector('.iq-label');
    const placeholderInput = row.querySelector('.iq-placeholder');
    const requiredInput = row.querySelector('.iq-required');
    const shortInput = row.querySelector('.iq-short');
    const maxLengthInput = row.querySelector('.iq-maxlength');
    
    const label = labelInput ? (labelInput.value || labelInput.textContent || '').trim() : '';
    console.log('[getIntakeQuestions] Row', i, 'label:', label, 'value:', labelInput?.value);
    
    return {
      label:       label,
      placeholder: placeholderInput ? (placeholderInput.value || placeholderInput.textContent || '').trim() : '',
      required:    i === 0 ? true : !!(requiredInput?.checked),
      short:       !!(shortInput?.checked),
      maxLength:   parseInt(maxLengthInput?.value) || 1000,
    };
  }).filter(q => q.label);
}

export function resetIntakeQuestions() {
  const list = document.getElementById('intakeQuestionsList');
  if (list) list.innerHTML = '';
  updateIntakeCount();
}

export function addIntakeQuestion(prefill = {}) {
  const list = document.getElementById('intakeQuestionsList');
  if (!list) return;
  const count = list.querySelectorAll('.iq-row').length;
  if (count >= 5) { showToast('Maximum 5 questions per category', 'warn'); return; }
  const isFirst = count === 0;
  const idx = count;
  const row = document.createElement('div');
  row.className = 'iq-row bg-[#0d0d1f] border border-white/8 rounded-xl p-3 space-y-2';
  row.innerHTML = `
    <div class="flex items-center justify-between mb-1">
      <span class="text-xs font-bold text-purple-300">Question ${idx + 1}${isFirst ? ' <span class="text-red-400">*required</span>' : ''}</span>
      ${!isFirst ? `<button onclick="removeIntakeQuestion(this)" class="text-xs text-red-400 hover:text-red-300">Remove</button>` : ''}
    </div>
    <input class="iq-label w-full bg-[#14142b] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none"
      placeholder="Question text (e.g. What is your username?)" maxlength="45">
    <input class="iq-placeholder w-full bg-[#14142b] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none"
      placeholder="Hint text (optional, shown greyed out in Discord)" maxlength="100">
    <div class="flex gap-4 items-center pt-1">
      <label class="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer ${isFirst ? 'opacity-50' : ''}">
        <input type="checkbox" class="iq-required accent-purple-500" ${isFirst ? 'checked disabled' : ''}> Required
      </label>
      <label class="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
        <input type="checkbox" class="iq-short accent-purple-500"> Single line
      </label>
      <label class="flex items-center gap-1.5 text-xs text-gray-400">
        Max chars: <input type="number" class="iq-maxlength w-16 ml-1 bg-[#14142b] border border-white/10 rounded px-2 py-1 text-xs text-white outline-none" value="1000" min="1" max="4000">
      </label>
    </div>`;
  list.appendChild(row);

  // Populate fields if prefill data was provided (e.g. when editing an existing category)
  if (prefill && typeof prefill === 'object') {
    if (prefill.label)       row.querySelector('.iq-label').value       = prefill.label;
    if (prefill.placeholder) row.querySelector('.iq-placeholder').value = prefill.placeholder;
    if (prefill.short)       row.querySelector('.iq-short').checked     = true;
    if (prefill.maxLength)   row.querySelector('.iq-maxlength').value   = prefill.maxLength;
    // required: first row is always locked checked; only set on non-first rows
    if (!isFirst && prefill.required) row.querySelector('.iq-required').checked = true;
  }

  updateIntakeCount();
}

export function removeIntakeQuestion(btn) {
  btn.closest('.iq-row').remove();
  // Re-number remaining questions
  document.querySelectorAll('#intakeQuestionsList .iq-row').forEach((row, i) => {
    const label = row.querySelector('.flex.items-center.justify-between span');
    if (label) label.innerHTML = `Question ${i + 1}${i === 0 ? ' <span class="text-red-400">*required</span>' : ''}`;
  });
  updateIntakeCount();
}

function updateIntakeCount() {
  const count = document.querySelectorAll('#intakeQuestionsList .iq-row').length;
  const badge = document.getElementById('intakeQCount');
  if (badge) badge.textContent = count;
}

export async function removeCategory(guildId, value, onSuccess) {
  if (!confirm('Delete this category?')) return;
  const res = await fetch(`/api/guild/${guildId}/ticket/category/${value}`, { method: 'DELETE' });
  const data = await res.json();
  if (res.ok) { showToast('Category removed'); onSuccess?.(); }
  else showToast(data.error || 'Failed to remove', 'error');
}