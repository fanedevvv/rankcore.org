// /js/customcommandjs/render.js
// Renders the command list, stats, filter chips, and rate limit bar.

import { state, MAX_COMMANDS } from './state.js';
import { esc, setEl, formatDate } from './utils.js';

export function render() {
  const container = document.getElementById('commandList');
  if (!container) return;

  const list = state.filtered;

  if (!list.length) {
    container.innerHTML = emptyState(state.filterQuery || state.filterTag || state.filterCat);
    return;
  }

  container.className = state.viewMode === 'grid' ? 'cmd-grid' : 'cmd-col';
  container.innerHTML = list.map((cmd, i) =>
    state.viewMode === 'grid' ? cmdGridCard(cmd, i) : cmdListCard(cmd, i)
  ).join('');

  list.forEach(cmd => {
    const cb = document.getElementById(`sel-${CSS.escape(cmd.name)}`);
    if (cb) cb.checked = state.selected.has(cmd.name);
  });
}

export function renderError() {
  const c = document.getElementById('commandList');
  if (c) c.innerHTML = `
    <div class="empty-state">
      <div style="font-size:2rem">😿</div>
      <div style="font-weight:700;color:#e8e8f5">Failed to load commands</div>
      <div style="font-size:0.78rem;color:var(--muted)">Refresh and try again</div>
    </div>`;
}

export function updateStats() {
  const cmds   = state.commands;
  const today  = new Date().toDateString();
  const custom = cmds.length;

  // RankCore plan cap
  const noxxLimit     = state.noxxCommandLimit;   // null = unlimited
  const noxxRemaining = noxxLimit === null ? null : Math.max(0, noxxLimit - custom);

  // Discord guild slot cap (shared between custom + enabled normal commands)
  const DISCORD_CAP   = state.discordGuildCmdLimit || 100;
  const normalEnabled = state.enabledNormalCommands || 0;
  const discordUsed   = custom + normalEnabled;
  const discordFree   = Math.max(0, DISCORD_CAP - discordUsed);

  setEl('statTotal',   custom);
  setEl('countBadge',  custom);
  setEl('statEnabled', cmds.filter(c => c.enabled !== false).length);
  setEl('statUses',    cmds.reduce((s, c) => s + (c.usageCount||0), 0));
  setEl('statNew',     cmds.filter(c => c.createdAt && new Date(c.createdAt).toDateString() === today).length);

  // Plan cap stat
  const planEl = document.getElementById('statPlanSlots');
  if (planEl) {
    planEl.textContent = noxxRemaining === null ? '∞' : noxxRemaining;
    planEl.style.color = noxxRemaining === 0 ? 'var(--danger, #ef4444)' : '#e8e8f5';
  }
  const planSubEl = document.getElementById('statPlanSub');
  if (planSubEl) {
    planSubEl.textContent = noxxLimit === null
      ? 'Plan Slots (Unlimited)'
      : `Plan Slots (${custom}/${noxxLimit})`;
  }

  // Discord slot stat + bar
  const discordNumEl = document.getElementById('statDiscordSlots');
  if (discordNumEl) {
    discordNumEl.textContent = discordFree;
    discordNumEl.style.color = discordFree === 0
      ? 'var(--danger, #ef4444)'
      : discordFree <= 10
        ? 'var(--warning, #f59e0b)'
        : '#8B5CF6';
  }
  const discordSubEl = document.getElementById('statDiscordSub');
  if (discordSubEl) {
    discordSubEl.textContent = `Discord Slots (${discordUsed}/${DISCORD_CAP})`;
  }

  // Progress bar
  const barFill = document.getElementById('discordSlotBarFill');
  if (barFill) {
    const pct = Math.min(100, Math.round((discordUsed / DISCORD_CAP) * 100));
    barFill.style.width = `${pct}%`;
    barFill.style.background = pct >= 95 ? 'var(--danger, #ef4444)' : pct >= 75 ? 'var(--warning, #f59e0b)' : 'var(--brand, #6C53FF)';
  }
  const barText = document.getElementById('discordSlotBarText');
  if (barText) {
    barText.textContent = `Custom: ${custom} · Enabled normal: ${normalEnabled} · Free: ${discordFree}`;
  }

  updateRLBar();
}

export function updateRLBar() {
  const rl = state.rateLimits;
  if (!rl) return;
  const bar  = document.getElementById('rlBar');
  const text = document.getElementById('rlText');
  if (!bar || !text) return;

  const pct  = Math.round((rl.createsUsed / rl.createsLimit) * 100);
  const fill = document.getElementById('rlFill');
  if (fill) {
    fill.style.width      = `${Math.min(100, pct)}%`;
    fill.style.background = pct >= 90 ? 'var(--danger)' : pct >= 60 ? 'var(--warning)' : 'var(--brand)';
  }
  text.textContent = `${rl.createsUsed}/${rl.createsLimit} creates today · ${rl.patchesUsed}/${rl.patchesLimit} edits/hr · queue: ${rl.queueSize}`;
}

export function renderFilterChips() {
  const tagCont = document.getElementById('tagFilterChips');
  if (tagCont) {
    const tags = state.allTags;
    tagCont.innerHTML = tags.length
      ? tags.map(t => `
        <button onclick="setTagFilter('${esc(t)}')"
          style="background:${state.filterTag===t ? 'rgba(139,92,246,0.18)' : 'rgba(139,92,246,0.07)'};
                 border:1px solid ${state.filterTag===t ? 'rgba(139,92,246,0.4)' : 'rgba(139,92,246,0.18)'};
                 color:var(--razor);padding:0.18rem 0.6rem;border-radius:99px;font-size:0.7rem;font-weight:700;cursor:pointer;transition:all 0.15s">
          ${esc(t)}
        </button>`).join('')
      : '';
  }

  const catCont = document.getElementById('catFilterChips');
  if (catCont) {
    const cats = state.allCategories;
    catCont.innerHTML = cats.length
      ? cats.map(c => `
        <button onclick="setCatFilter('${esc(c)}')"
          style="background:${state.filterCat===c ? 'rgba(108,83,255,0.22)' : 'rgba(108,83,255,0.07)'};
                 border:1px solid ${state.filterCat===c ? 'rgba(108,83,255,0.45)' : 'rgba(108,83,255,0.18)'};
                 color:#a799ff;padding:0.18rem 0.6rem;border-radius:99px;font-size:0.7rem;font-weight:700;cursor:pointer;transition:all 0.15s">
          ${esc(c)}
        </button>`).join('')
      : '';
  }
}

export function updateBulkBar() {
  const bar   = document.getElementById('bulkBar');
  const count = document.getElementById('bulkCount');
  if (!bar) return;
  const n = state.selected.size;
  bar.style.display = n > 0 ? 'flex' : 'none';
  if (count) count.textContent = `${n} selected`;
}

// ── Card builders ─────────────────────────────────────────────────────────────

function cmdListCard(cmd, i) {
  const argCount   = (cmd.arguments||[]).length;
  const isDisabled = cmd.enabled === false;
  const aliasStr   = (cmd.aliases||[]).length ? (cmd.aliases||[]).map(a => `/${esc(a)}`).join(', ') : '';
  const btnCount   = (cmd.buttons||[]).length;
  const actCount   = (cmd.actions||[]).length;
  const fldCount   = (cmd.embedFields||[]).length;

  return `
  <div class="cmd-card${isDisabled ? ' cmd-disabled' : ''}" style="animation-delay:${i*0.025}s">
    <input type="checkbox" id="sel-${esc(cmd.name)}" class="cmd-checkbox"
           onchange="toggleSelect('${esc(cmd.name)}')">
    <div class="cmd-icon">/${esc(cmd.name).charAt(0).toUpperCase()}</div>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
        <span class="cmd-name">/${esc(cmd.name)}</span>
        ${aliasStr ? `<span style="font-size:0.68rem;color:var(--muted)">also: ${aliasStr}</span>` : ''}
        ${isDisabled ? '<span class="badge" style="background:rgba(255,71,87,0.1);color:var(--danger);border:1px solid rgba(255,71,87,0.25)">disabled</span>' : ''}
        ${cmd.category ? `<span class="badge" style="background:rgba(108,83,255,0.1);color:#a799ff;border:1px solid rgba(108,83,255,0.2)">${esc(cmd.category)}</span>` : ''}
      </div>
      ${cmd.description ? `<div class="cmd-desc">${esc(cmd.description)}</div>` : ''}
      <div class="cmd-response">${esc(cmd.response)}</div>
      <div class="cmd-meta">
        ${argCount              ? `<span class="badge b-args">${argCount} arg${argCount>1?'s':''}</span>` : ''}
        ${cmd.isEmbed           ? `<span class="badge b-embed">embed</span>` : ''}
        ${fldCount              ? `<span class="badge b-embed">${fldCount} field${fldCount>1?'s':''}</span>` : ''}
        ${btnCount              ? `<span class="badge" style="background:rgba(88,101,242,0.12);color:#7b8ef7;border:1px solid rgba(88,101,242,0.3)">🔘 ${btnCount} btn${btnCount>1?'s':''}</span>` : ''}
        ${actCount              ? `<span class="badge" style="background:rgba(255,83,83,0.1);color:#ff8a8a;border:1px solid rgba(255,83,83,0.25)">⚡ ${actCount} action${actCount>1?'s':''}</span>` : ''}
        ${cmd.ephemeral         ? `<span class="badge b-eph">ephemeral</span>` : ''}
        ${cmd.cooldown          ? `<span class="badge b-cool">⏱ ${cmd.cooldown}s</span>` : ''}
        ${cmd.globalCooldown    ? `<span class="badge b-cool">🌐 ${cmd.globalCooldown}s</span>` : ''}
        ${cmd.requiredPermission ? `<span class="badge b-perm">🔒 perm</span>` : ''}
        ${cmd.multiResponseEnabled ? `<span class="badge" style="background:rgba(255,179,71,0.1);color:var(--warning);border:1px solid rgba(255,179,71,0.25)">🎲 random</span>` : ''}
        ${(cmd.conditionals||[]).length ? `<span class="badge" style="background:rgba(83,232,255,0.08);color:#53E8FF;border:1px solid rgba(83,232,255,0.2)">⚙ ${cmd.conditionals.length} cond</span>` : ''}
        ${cmd.dmAllowed         ? `<span class="badge" style="background:rgba(255,255,255,0.06);color:#ccc;border:1px solid rgba(255,255,255,0.12)">DM ✓</span>` : ''}
        ${(cmd.tags||[]).map(t => `<span class="badge" style="background:rgba(139,92,246,0.07);color:var(--razor);border:1px solid rgba(139,92,246,0.18);font-size:0.6rem">#${esc(t)}</span>`).join('')}
        ${cmd.usageCount        ? `<span style="font-size:0.68rem;color:var(--muted)">▶ ${cmd.usageCount.toLocaleString()} uses</span>` : ''}
        ${cmd.createdAt         ? `<span>📅 ${formatDate(cmd.createdAt)}</span>` : ''}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:0.4rem;flex-shrink:0;align-items:flex-end">
      <button class="btn-brand"     onclick="openEditModal('${esc(cmd.name)}')">Edit</button>
      <button class="btn-ghost"     onclick="quickToggle('${esc(cmd.name)}')" style="font-size:0.73rem;padding:0.3rem 0.65rem">${isDisabled ? '▶ Enable' : '⏸ Disable'}</button>
      <button class="btn-danger-sm" onclick="openDeleteModal('${esc(cmd.name)}')">Delete</button>
    </div>
  </div>`;
}

function cmdGridCard(cmd, i) {
  const isDisabled = cmd.enabled === false;
  const btnCount   = (cmd.buttons||[]).length;
  const actCount   = (cmd.actions||[]).length;
  return `
  <div class="cmd-grid-card${isDisabled ? ' cmd-disabled' : ''}" style="animation-delay:${i*0.025}s">
    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
      <input type="checkbox" id="sel-${esc(cmd.name)}" onchange="toggleSelect('${esc(cmd.name)}')">
      <div class="cmd-icon" style="width:28px;height:28px;font-size:0.65rem">/${esc(cmd.name).charAt(0).toUpperCase()}</div>
      <span class="cmd-name" style="font-size:0.82rem">/${esc(cmd.name)}</span>
      ${isDisabled
        ? '<span style="width:8px;height:8px;border-radius:50%;background:var(--danger);flex-shrink:0" title="Disabled"></span>'
        : '<span style="width:8px;height:8px;border-radius:50%;background:var(--razor);flex-shrink:0" title="Enabled"></span>'}
    </div>
    <div style="font-size:0.73rem;color:#7070a0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:0.6rem">${esc(cmd.response)}</div>
    <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.65rem">
      ${cmd.isEmbed            ? `<span class="badge b-embed" style="font-size:0.58rem">embed</span>` : ''}
      ${cmd.ephemeral          ? `<span class="badge b-eph"   style="font-size:0.58rem">eph</span>`   : ''}
      ${(cmd.arguments||[]).length ? `<span class="badge b-args" style="font-size:0.58rem">${(cmd.arguments||[]).length}a</span>` : ''}
      ${btnCount               ? `<span class="badge" style="background:rgba(88,101,242,0.12);color:#7b8ef7;border:1px solid rgba(88,101,242,0.3);font-size:0.58rem">🔘${btnCount}</span>` : ''}
      ${actCount               ? `<span class="badge" style="background:rgba(255,83,83,0.1);color:#ff8a8a;border:1px solid rgba(255,83,83,0.25);font-size:0.58rem">⚡${actCount}</span>` : ''}
      ${cmd.usageCount         ? `<span style="font-size:0.62rem;color:var(--muted)">▶${cmd.usageCount}</span>` : ''}
    </div>
    <div style="display:flex;gap:0.35rem">
      <button class="btn-brand" style="flex:1;font-size:0.73rem;padding:0.3rem" onclick="openEditModal('${esc(cmd.name)}')">Edit</button>
      <button class="btn-danger-sm" onclick="openDeleteModal('${esc(cmd.name)}')">✕</button>
    </div>
  </div>`;
}

function emptyState(hasFilter) {
  return `
  <div class="empty-state">
    <div style="font-size:2.5rem">⚡</div>
    <div style="font-weight:700;font-size:0.95rem;color:#e8e8f5">${hasFilter ? 'No commands match your filters' : 'No custom commands yet'}</div>
    <div style="font-size:0.78rem;color:var(--muted)">${hasFilter ? 'Try clearing filters' : 'Click "+ New Command" to create your first one'}</div>
  </div>`;
}