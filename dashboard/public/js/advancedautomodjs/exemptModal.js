// ─── Per-Rule Role & Channel Exemption Modal ──────────────────────────────────
import { rateRules, guildId } from './state.js';
import { esc } from './helpers.js';

let _exemptModal = null;

export function closeExemptModal() {
  const m = document.getElementById('exemptModal');
  if (m) { m.style.opacity = '0'; setTimeout(() => m.style.display = 'none', 180); }
}

export function openExemptModal(ruleType, mode) {
  _exemptModal = { ruleType, mode };
  const m = document.getElementById('exemptModal');
  document.getElementById('exemptModalTitle').textContent    = mode === 'roles' ? 'Roles' : 'Channels';
  document.getElementById('exemptModalSubtitle').textContent = mode === 'roles'
    ? "Set roles which won't be punished or only be punished."
    : 'Limit this condition to certain channels or exclude channels from this condition.';

  const modeKey  = mode === 'roles' ? 'exemptRoleMode'    : 'exemptChannelMode';
  const idsKey   = mode === 'roles' ? 'exemptRoleIds'     : 'exemptChannelIds';
  const firstRule = rateRules.find(r => r.type === ruleType) || {};
  document.getElementById('exemptModeSelect').value = firstRule[modeKey] || 'excluded';
  _renderExemptTags(firstRule[idsKey] || [], mode);
  if (mode === 'roles') _loadRolePicker(); else _loadChannelPicker();
  m.style.display = 'flex';
  setTimeout(() => m.style.opacity = '1', 10);
}

export function manageRoles(ruleType)    { openExemptModal(ruleType, 'roles');    }
export function manageChannels(ruleType) { openExemptModal(ruleType, 'channels'); }

function _renderExemptTags(ids, mode) {
  const wrap = document.getElementById('exemptTagsWrap');
  wrap.innerHTML = '';
  ids.forEach(id => {
    const tag = document.createElement('span');
    tag.className = 'exempt-tag';
    let label = id;
    let color = '#6b7280';
    if (mode === 'roles' && window._cachedRoles) {
      const r = window._cachedRoles.find(x => x.id === id);
      if (r) { label = r.name; if (r.color && r.color !== '#000000') color = r.color; }
    } else if (mode === 'channels' && window._cachedChannels) {
      const c = window._cachedChannels.find(x => x.id === id);
      if (c) label = '#' + c.name;
    }
    tag.innerHTML = `<span class="exempt-tag-dot" style="background:${color}"></span><span>${esc(label)}</span><button onclick="window.removeExemptId('${esc(id)}')">x</button>`;
    wrap.appendChild(tag);
  });
}

export function removeExemptId(id) {
  if (!_exemptModal) return;
  const { ruleType, mode } = _exemptModal;
  const idsKey = mode === 'roles' ? 'exemptRoleIds' : 'exemptChannelIds';
  rateRules.filter(r => r.type === ruleType).forEach(r => {
    if (r[idsKey]) r[idsKey] = r[idsKey].filter(x => x !== id);
  });
  const currentIds = rateRules.find(r => r.type === ruleType)?.[idsKey] || [];
  _renderExemptTags(currentIds, mode);
  _refreshPicker();
}

export function addExemptId(id) {
  if (!_exemptModal) return;
  const { ruleType, mode } = _exemptModal;
  const idsKey = mode === 'roles' ? 'exemptRoleIds' : 'exemptChannelIds';
  rateRules.filter(r => r.type === ruleType).forEach(r => {
    if (!r[idsKey]) r[idsKey] = [];
    if (!r[idsKey].includes(id)) r[idsKey].push(id);
  });
  const currentIds = rateRules.find(r => r.type === ruleType)?.[idsKey] || [];
  _renderExemptTags(currentIds, mode);
  _refreshPicker();
}

export function onExemptModeChange(val) {
  if (!_exemptModal) return;
  const { ruleType, mode } = _exemptModal;
  const modeKey = mode === 'roles' ? 'exemptRoleMode' : 'exemptChannelMode';
  rateRules.filter(r => r.type === ruleType).forEach(r => { r[modeKey] = val; });
}

function _refreshPicker() {
  if (!_exemptModal) return;
  if (_exemptModal.mode === 'roles') _loadRolePicker(); else _loadChannelPicker();
}

function _loadRolePicker() {
  const picker = document.getElementById('exemptPicker');
  picker.innerHTML = '<div class="exempt-picker-loading">Loading roles…</div>';
  if (window._cachedRoles) { _buildRolePickerHTML(window._cachedRoles); return; }
  fetch(`/api/guild/${guildId}/roles`)
    .then(r => r.json())
    .then(roles => { window._cachedRoles = roles; _buildRolePickerHTML(roles); })
    .catch(() => { picker.innerHTML = '<div class="exempt-picker-loading">Failed to load roles</div>'; });
}

function _buildRolePickerHTML(roles) {
  const picker = document.getElementById('exemptPicker');
  if (!_exemptModal) return;
  const currentIds = rateRules.find(r => r.type === _exemptModal.ruleType)?.exemptRoleIds || [];
  picker.innerHTML = '';
  roles.filter(r => !currentIds.includes(r.id)).forEach(role => {
    const item = document.createElement('div');
    item.className = 'exempt-pick-item';
    const dotColor = (role.color && role.color !== '#000000') ? role.color : '#6b7280';
    item.innerHTML = `<span class="exempt-tag-dot" style="background:${dotColor}"></span><span>${esc(role.name)}</span>`;
    item.onclick = () => addExemptId(role.id);
    picker.appendChild(item);
  });
  if (!picker.children.length) picker.innerHTML = '<div class="exempt-picker-loading">All roles added</div>';
}

function _loadChannelPicker() {
  const picker = document.getElementById('exemptPicker');
  picker.innerHTML = '<div class="exempt-picker-loading">Loading channels…</div>';
  const p = window._cachedChannels
    ? Promise.resolve(window._cachedChannels)
    : fetch(`/api/guild/${guildId}/channels`).then(r => r.json()).then(ch => { window._cachedChannels = ch; return ch; });
  p.then(channels => _buildChannelPickerHTML(channels))
   .catch(() => { picker.innerHTML = '<div class="exempt-picker-loading">Failed to load channels</div>'; });
}

function _buildChannelPickerHTML(channels) {
  const picker = document.getElementById('exemptPicker');
  if (!_exemptModal) return;
  const currentIds = rateRules.find(r => r.type === _exemptModal.ruleType)?.exemptChannelIds || [];
  picker.innerHTML = '';
  channels.filter(c => !currentIds.includes(c.id)).forEach(ch => {
    const item = document.createElement('div');
    item.className = 'exempt-pick-item';
    item.innerHTML = `<span style="color:var(--text-muted);margin-right:3px;">#</span><span>${esc(ch.name)}</span>`;
    item.onclick = () => addExemptId(ch.id);
    picker.appendChild(item);
  });
  if (!picker.children.length) picker.innerHTML = '<div class="exempt-picker-loading">All channels added</div>';
}

export function exemptPickerSearch(val) {
  const q = val.toLowerCase();
  document.querySelectorAll('#exemptPicker .exempt-pick-item').forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}