'use strict';

export let allRoles = [];

export function roleHex(color) {
  if (!color) return '#6b7280';
  // API returns hexColor as a string e.g. "#ff0000" — return as-is
  if (typeof color === 'string') return color.startsWith('#') ? color : '#' + color;
  // Fallback for numeric color values
  return '#' + color.toString(16).padStart(6, '0');
}

export function renderRoleList(containerId, ids, removeFnName) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!ids || !ids.length) {
    el.innerHTML = `<p class="empty-small">None configured.</p>`;
    return;
  }
  el.innerHTML = ids.map(id => {
    const role = allRoles.find(r => r.id === id);
    const name = role ? role.name : `Unknown Role`;
    const hex  = roleHex(role?.color);
    return `
      <div class="role-item">
        <div class="role-item-left">
          <span class="role-dot" style="background:${hex}"></span>
          <span class="role-name">${name}</span>
        </div>
        <button onclick="${removeFnName}('${id}')" class="icon-btn icon-btn-danger" title="Remove">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>`;
  }).join('');
}

export async function loadChannels(guildId) {
  try {
    const [chRes, catRes] = await Promise.all([
      fetch(`/api/guild/${guildId}/channels`),
      fetch(`/api/guild/${guildId}/categories`),
    ]);
    const chData     = await chRes.json();
    const categories = await catRes.json();

    // API returns { channels: [...], _categories: [...] } — extract the array
    const channelList  = Array.isArray(chData) ? chData : (chData.channels || []);
    const textChannels = channelList.filter(c => !c.type || c.type === 0);

    ['panelChannel','transcriptChannel','threadChannel'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      
      // Populate the select options
      if (window.rzrPopulateChannels) {
        window.rzrPopulateChannels(sel, textChannels, null, 'Select channel…');
      }
      
      // If Razor Custom Select is active (wrapper exists), update the label
      const wrapper = sel.closest('.rzr-wrap');
      if (wrapper && wrapper._lb && wrapper._last !== undefined) {
        // Trigger label update by setting value and calling updateLabel logic
        const idx = sel.selectedIndex;
        const opt = idx >= 0 ? sel.options[idx] : null;
        const text = opt ? (opt.text || opt.textContent || '') : '';
        if (text) {
          wrapper._lb.textContent = text;
          wrapper._lb.classList.remove('is-ph');
        } else {
          wrapper._lb.textContent = 'Select…';
          wrapper._lb.classList.add('is-ph');
        }
      }
    });

    // categories endpoint returns a flat array
    const catList = Array.isArray(categories) ? categories : (categories._categories || chData._categories || []);
    const catOptions = catList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    const catParentEl = document.getElementById('catParent');
    if (catParentEl) {
      catParentEl.innerHTML = `<option value="">Parent Discord category…</option>` + catOptions;
    }

    const ticketCategoryEl = document.getElementById('ticketCategory');
    if (ticketCategoryEl) {
      ticketCategoryEl.innerHTML = `<option value="">None</option>` + catOptions;
    }
  } catch (e) { console.error('loadChannels:', e); }
}

export async function loadRoles(guildId) {
  try {
    const res  = await fetch(`/api/guild/${guildId}/roles`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    allRoles = (Array.isArray(data) ? data : []).filter(r => !r.managed && r.name !== '@everyone');
    const esc  = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const opts = allRoles.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
    ['urgentRole','blacklistRole','manageRoleSelect','pingRoleSelect','catPingRoleSelect'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<option value="">Select role…</option>` + opts;
    });
    // Support Team Roles picker (multi-role list, see handlerRoleAdd in ticket.html)
    const handlerSel = document.getElementById('handlerRoleSelect');
    if (handlerSel) handlerSel.innerHTML = `<option value="">Select role to add…</option>` + opts;
  } catch (e) { console.error('loadRoles:', e); }
}