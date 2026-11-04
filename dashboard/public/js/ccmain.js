/**
 * ccmain.js
 * Entry point for the Custom Commands dashboard.
 * Imports all modules, boots on DOMContentLoaded, fetches data,
 * and exposes all functions that HTML inline handlers need on window.
 */

import { state, MAX_ARGS, MAX_ALIASES, MAX_TAGS, MAX_VARIANTS, MAX_CONDS, MAX_ACTIONS, MAX_BUTTONS, MAX_EMBED_FIELDS } from './customcommandjs/state.js';
import { showToast, stepInput }                                   from './customcommandjs/utils.js';
import { fetchCommands, fetchStats, createCommand, updateCommand, deleteCommand, toggleCommand, bulkOperation, exportCommands, importCommands } from './customcommandjs/api.js';
import { render, renderError, updateStats, updateBulkBar, renderFilterChips } from './customcommandjs/render.js';
import { renderArgList, addArgument }                             from './customcommandjs/argBuilder.js';
import {
  onNameInput, onResponseInput, updateDescCounter,
  toggleEmbedFields, updateEmbedPreview,
  syncColorText, syncColorPicker,
  refreshVarChips, insertVar,
  renderEmbedFieldList, renderVariantList,
  renderConditionalList, renderActionList, renderButtonList,
  renderAliasList, getAliasValues,
  renderTagPills, getCurrentTags,
} from './customcommandjs/form.js';
import {
  openCreateModal, openEditModal, closeModal,
  openDeleteModal, closeDeleteModal,
  switchModalTab, toggleMultiResponseFields, showTabHelp,
} from './custommain.js';

// ── Boot ───────────────────────────────────────────────────────────────────────

async function init() {
  // Populate output channel dropdown in the modal
  try {
    const guildId = location.pathname.split('/')[2];
    const chRes = await fetch(`/api/guild/${guildId}/channels`);
    if (chRes.ok) {
      const data = await chRes.json();
      // API returns { channels, _categories }; channels are already text-only
      const channels = (Array.isArray(data) ? data : data.channels) || [];
      const sel = document.getElementById('inputOutputChannel');
      if (sel && channels.length) {
        channels.filter(c => c.type === undefined || c.type === 0).forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = '#' + (c.name || c.id);
          sel.appendChild(opt);
        });
      }
    }
  } catch (_) {}

  try {
    const [cmdData, statsData] = await Promise.all([
      fetchCommands().catch(() => null),
      fetchStats().catch(() => null),
    ]);

    if (cmdData) {
      state.setCommands(cmdData.commands || []);
      if (cmdData.enabledNormalCommands !== undefined) state.setEnabledNormalCommands(cmdData.enabledNormalCommands);
      if (cmdData.noxxCommandLimit     !== undefined) state.setNoxxCommandLimit(cmdData.noxxCommandLimit);
      if (cmdData.discordGuildCmdLimit  !== undefined) state.setDiscordGuildCmdLimit(cmdData.discordGuildCmdLimit);
      if (cmdData.tier                  !== undefined) state.setTier(cmdData.tier);
    }

    if (statsData) {
      if (statsData.rateLimits) state.setRateLimits(statsData.rateLimits);
    }

    render();
    updateStats();
    renderFilterChips();
  } catch (err) {
    console.error('[ccmain] init error:', err);
    renderError();
    showToast('Failed to load custom commands', 'error');
  }
}

// ── Submit (create / update) ───────────────────────────────────────────────────

async function submitCommand() {
  const name        = document.getElementById('inputName')?.value?.trim() || '';
  const description = document.getElementById('inputDescription')?.value?.trim() || '';
  const response    = document.getElementById('inputResponse')?.value || '';
  const isEditing   = !!state.editingName;

  if (!name) return showToast('Command name is required', 'error');
  if (!description) return showToast('Description is required', 'error');

  const payload = {
    name,
    description,
    response,
    // Embed
    isEmbed:           !!document.getElementById('inputIsEmbed')?.checked,
    embedTitle:        document.getElementById('inputEmbedTitle')?.value        || '',
    embedFooter:       document.getElementById('inputEmbedFooter')?.value       || '',
    embedImage:        document.getElementById('inputEmbedImage')?.value        || '',
    embedThumbnail:    document.getElementById('inputEmbedThumbnail')?.value    || '',
    embedAuthorName:   document.getElementById('inputEmbedAuthorName')?.value   || '',
    embedAuthorIcon:   document.getElementById('inputEmbedAuthorIcon')?.value   || '',
    embedUrl:          document.getElementById('inputEmbedUrl')?.value          || '',
    embedFooterIcon:   document.getElementById('inputEmbedFooterIcon')?.value   || '',
    embedColor:        document.getElementById('inputEmbedColor')?.value        || '#6C53FF',
    // Behaviour
    ephemeral:         !!document.getElementById('inputEphemeral')?.checked,
    dmAllowed:         !!document.getElementById('inputDmAllowed')?.checked,
    deleteInvoking:    !!document.getElementById('inputDeleteInvoking')?.checked,
    cooldown:          parseInt(document.getElementById('inputCooldown')?.value  || 0, 10),
    globalCooldown:    parseInt(document.getElementById('inputGlobalCooldown')?.value || 0, 10),
    requiredPermission: document.getElementById('inputPermission')?.value || '',
    // Multi-response
    multiResponseEnabled: !!document.getElementById('inputMultiResponse')?.checked,
    responseVariants:  state.variants,
    // Complex sub-fields
    arguments:         state.args,
    conditionals:      state.conditionals,
    actions:           state.actions,
    buttons:           state.buttons,
    embedFields:       state.embedFields,
    // Advanced
    category:          document.getElementById('inputCategory')?.value?.trim() || '',
    aliases:           getAliasValues(),
    tags:              getCurrentTags(),
    outputChannelId:   document.getElementById('inputOutputChannel')?.value || null,
    plainTextContent:  document.getElementById('inputPlainText')?.value?.trim() || '',
    // Restrictions (store as arrays of objects with id)
    allowedChannels: _parseIdList('inputAllowedChannels'),
    deniedChannels:  _parseIdList('inputDeniedChannels'),
    allowedRoles:    _parseIdList('inputAllowedRoles'),
    deniedRoles:     _parseIdList('inputDeniedRoles'),
  };

  const btn = document.getElementById('modalSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = isEditing ? '💾 Saving…' : '⚡ Creating…'; }

  try {
    if (isEditing) {
      const updated = await updateCommand(state.editingName, payload);
      state.updateCommand(state.editingName, updated.command || payload);
      showToast(`/${state.editingName} updated!`, 'success');
    } else {
      const created = await createCommand(payload);
      state.addCommand(created.command || payload);
      showToast(`/${name} created!`, 'success');
    }
    closeModal();
    render();
    updateStats();
    renderFilterChips();
  } catch (err) {
    showToast(err.message || 'Failed to save command', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = isEditing ? '💾 Save Changes' : '⚡ Create Command'; }
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────────

async function confirmDelete() {
  const name = state.pendingDel;
  if (!name) return;
  try {
    await deleteCommand(name);
    state.removeCommand(name);
    closeDeleteModal();
    render();
    updateStats();
    renderFilterChips();
    showToast(`/${name} deleted`, 'success');
  } catch (err) {
    showToast(err.message || 'Failed to delete command', 'error');
  }
}

// ── Quick toggle enable/disable ────────────────────────────────────────────────

async function quickToggle(name) {
  try {
    const res = await toggleCommand(name);
    state.updateCommand(name, { enabled: res.enabled });
    render();
    showToast(`/${name} ${res.enabled ? 'enabled' : 'disabled'}`, 'success');
  } catch (err) {
    showToast(err.message || 'Failed to toggle command', 'error');
  }
}

// ── Filter / sort / view ───────────────────────────────────────────────────────

function filterCommands() {
  const q = document.getElementById('searchInput')?.value || '';
  state.setFilter(q);
  render();
}

function setTagFilter(tag) {
  state.setFilterTag(state.filterTag === tag ? '' : tag);
  render();
  renderFilterChips();
}

function setCatFilter(cat) {
  state.setFilterCat(state.filterCat === cat ? '' : cat);
  render();
  renderFilterChips();
}

function setSortBy(val) {
  state.setSortBy(val);
  render();
}

function setViewMode(val) {
  state.setViewMode(val);
  render();
}

// ── Selection / bulk ───────────────────────────────────────────────────────────

function toggleSelect(name) {
  state.toggleSelect(name);
  updateBulkBar();
}

function selectAll() {
  state.selectAll();
  render();
  updateBulkBar();
}

function clearSelected() {
  state.clearSelected();
  render();
  updateBulkBar();
}

async function bulkAction(action) {
  const names = [...state.selected];
  if (!names.length) return showToast('No commands selected', 'error');
  try {
    await bulkOperation(action, names);
    if (action === 'delete') {
      names.forEach(n => state.removeCommand(n));
    } else {
      names.forEach(n => state.updateCommand(n, { enabled: action === 'enable' }));
    }
    state.clearSelected();
    render();
    updateStats();
    updateBulkBar();
    renderFilterChips();
    showToast(`Bulk ${action} complete`, 'success');
  } catch (err) {
    showToast(err.message || `Bulk ${action} failed`, 'error');
  }
}

// ── Export / Import ────────────────────────────────────────────────────────────

async function exportCmds() {
  try {
    const data = await exportCommands();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'custom-commands.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('Commands exported!', 'success');
  } catch (err) {
    showToast(err.message || 'Export failed', 'error');
  }
}

async function importCmds(overwrite = false) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const cmds = Array.isArray(data) ? data : data.commands;
      if (!cmds) throw new Error('Invalid file format');
      const res = await importCommands(cmds, overwrite);
      (res.commands || []).forEach(c => {
        if (overwrite) state.updateCommand(c.name, c);
        else state.addCommand(c);
      });
      render(); updateStats(); renderFilterChips();
      showToast(`Imported ${cmds.length} command(s)`, 'success');
    } catch (err) {
      showToast(err.message || 'Import failed', 'error');
    }
  };
  input.click();
}

// ── Sub-builder add wrappers ───────────────────────────────────────────────────

function addVariant() {
  if (state.variants.length >= MAX_VARIANTS) return showToast(`Max ${MAX_VARIANTS} variants`, 'error');
  state.addVariant({ response: '' });
  renderVariantList();
}

function addConditional() {
  if (state.conditionals.length >= MAX_CONDS) return showToast(`Max ${MAX_CONDS} conditionals`, 'error');
  state.addConditional({ arg: '', op: 'eq', value: '', response: '' });
  renderConditionalList();
}

function addAction() {
  if (state.actions.length >= MAX_ACTIONS) return showToast(`Max ${MAX_ACTIONS} actions`, 'error');
  state.addAction({ type: 'add_role', target: '', argArg: '', userArg: '', value: '' });
  renderActionList();
}

function addButton() {
  if (state.buttons.length >= MAX_BUTTONS) return showToast(`Max ${MAX_BUTTONS} buttons`, 'error');
  state.addButton({ label: '', style: 'PRIMARY', customId: '', url: '' });
  renderButtonList();
}

function addEmbedField() {
  if (state.embedFields.length >= MAX_EMBED_FIELDS) return showToast(`Max ${MAX_EMBED_FIELDS} fields`, 'error');
  state.addEmbedField({ name: '', value: '', inline: false });
  renderEmbedFieldList();
}

function addAlias() {
  const aliases = getAliasValues();
  if (aliases.length >= MAX_ALIASES) return showToast(`Max ${MAX_ALIASES} aliases`, 'error');
  aliases.push('');
  // Re-render via custommain's renderAliasList which accepts an array
  const custommainRender = window.__ccRenderAliasList;
  if (custommainRender) custommainRender(aliases);
  else renderAliasList(); // fallback (reads from DOM)
}

function addTag() {
  const tags = getCurrentTags();
  if (tags.length >= MAX_TAGS) return showToast(`Max ${MAX_TAGS} tags`, 'error');
  const input = document.getElementById('tagInput');
  const raw   = input ? input.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') : '';
  if (!raw) return showToast('Enter a tag name first', 'error');
  if (tags.includes(raw)) return showToast('Tag already added', 'error');
  tags.push(raw);
  renderTagPills(tags);
  if (input) input.value = '';
}

// ── step() helper for number inputs ───────────────────────────────────────────

function step(id, delta) {
  const el  = document.getElementById(id);
  if (!el) return;
  const min = parseFloat(el.min ?? -Infinity);
  const max = parseFloat(el.max ?? Infinity);
  el.value  = Math.max(min, Math.min(max, parseFloat(el.value || 0) + delta));
  el.dispatchEvent(new Event('input'));
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function _parseIdList(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return [];
  return el.value.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).map(id => ({ id }));
}

// ── Expose everything to window for inline onclick/oninput handlers ────────────

Object.assign(window, {
  // Modal lifecycle
  openCreateModal,
  openEditModal,
  closeModal,
  openDeleteModal,
  closeDeleteModal,
  switchModalTab,
  showTabHelp,

  // Form events
  onNameInput,
  onResponseInput,
  updateDescCounter,
  toggleEmbedFields,
  toggleMultiResponseFields,
  updateEmbedPreview,
  syncColorText,
  syncColorPicker,
  refreshVarChips,
  insertVar,

  // Sub-builders
  addArgument,
  addVariant,
  addConditional,
  addAction,
  addButton,
  addEmbedField,
  addAlias,
  addTag,

  // CRUD
  submitCommand,
  confirmDelete,
  quickToggle,

  // List controls
  filterCommands,
  setTagFilter,
  setCatFilter,
  setSortBy,
  setViewMode,
  toggleSelect,
  selectAll,
  clearSelected,
  bulkAction,
  exportCmds,
  importCmds,

  // Misc
  step,
});

// ── Store renderAliasList ref so addAlias can pass an array ───────────────────
// custommain.js exports renderAliasList(aliases[]) — expose it for addAlias()
import('./custommain.js').then(m => {
  if (m.renderAliasList) window.__ccRenderAliasList = m.renderAliasList;
});

// ── Init ───────────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}