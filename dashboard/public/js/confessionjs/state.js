// ─── Shared State & Helpers ───────────────────────────────────────────────────

export let allRoles    = [];
export let allChannels = [];
export let cfg         = {};

export function setVal(id, val)     { const e = document.getElementById(id); if (e) e.value = val; }
export function setChecked(id, val) { const e = document.getElementById(id); if (e) e.checked = !!val; }
export function roleLabel(id)       { return allRoles.find(r => r.id === id)?.name || id; }

const CHIP_EMPTY = {
  blacklistList:    'No blacklisted users.',
  trustedList:      'No trusted users.',
  requiredRoleList: 'No required roles (anyone can confess).',
  modRoleList:      'No moderator roles set.',
};

export function renderChips(containerId, items, labelFn, removeFnName) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items.length) {
    const msg = CHIP_EMPTY[containerId] || 'None.';
    el.innerHTML = `<p class="text-xs text-gray-600 italic">${msg}</p>`;
    return;
  }
  el.innerHTML = items.map(item => `
    <span class="chip">${labelFn(item)}
      <span class="chip-remove" onclick="${removeFnName}('${item}')">✕</span>
    </span>`).join('');
}

export async function loadChannels(guildId) {
  try {
    const res = await fetch(`/api/guild/${guildId}/channels`);
    const chData = await res.json();
    allChannels = (Array.isArray(chData) ? chData : chData.channels) || [];
    ['confessionChannel','reviewChannel','logChannel','reportChannel','catChannel'].forEach(id => {
      window.rzrPopulateChannels(document.getElementById(id), chData, null, 'None');
    });
  } catch(e) { console.error(e); }
}

export async function loadRoles(guildId) {
  try {
    const res = await fetch(`/api/guild/${guildId}/roles`);
    allRoles = (await res.json()).filter(r => !r.managed && r.name !== '@everyone');
    const opts = allRoles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    ['reviewPingRole','confessionPingRole','reportPingRole','modRoleSelect','requiredRoleSelect'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<option value="">None</option>` + opts;
    });
  } catch(e) { console.error(e); }
}