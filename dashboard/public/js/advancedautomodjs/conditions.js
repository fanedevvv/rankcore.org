// ─── Conditions ───────────────────────────────────────────────────────────────
import { rateRules, RATE_TYPES, RATE_LABELS, ACTIONS } from './state.js';
import { esc } from './helpers.js';

export function buildCondLabel(rule) {
  const label = RATE_LABELS[rule.type] || rule.type;
  if (rule.type === 'caps') return `≥ ${rule.limit}% capitalization`;
  if (rule.window && rule.window > 0) return `≥ ${rule.limit} ${label} in ${rule.window}s`;
  return `≥ ${rule.limit} ${label} (per message)`;
}

export function renderConditions(type) {
  const list  = document.getElementById(`conds-${type}`);
  const badge = document.getElementById(`badge-${type}`);
  if (!list) return;
  const rules = rateRules.filter(r => r.type === type);
  if (badge) badge.textContent = `${rules.length} / ∞`;
  list.innerHTML = '';
  rules.forEach(r => {
    const globalIdx = rateRules.indexOf(r);
    const item = document.createElement('div');
    item.className  = 'cond-item';
    item.dataset.gi = globalIdx;
    item.innerHTML  = `
      <div class="cond-summary" onclick="window.toggleCondDetail(this)">
        <button class="cond-expand-btn" title="Expand">›</button>
        <span class="cond-label">${esc(buildCondLabel(r))}</span>
        <button class="cond-channel-btn" title="Channel filter" onclick="event.stopPropagation();">#</button>
        <button class="cond-del-btn" title="Remove" onclick="event.stopPropagation();window.removeCondition(${globalIdx})">×</button>
      </div>
      <div class="cond-detail">
        <div class="cond-fields">
          <div>
            <div class="fl">${r.type === 'caps' ? 'Cap %' : 'Threshold'}</div>
            <input type="number" value="${r.limit}" min="1" onchange="window.updateRule(${globalIdx},'limit',+this.value);window.updateCondLabel(${globalIdx})">
          </div>
          <div>
            <div class="fl">Window (s)</div>
            <input type="number" value="${r.window}" min="0" onchange="window.updateRule(${globalIdx},'window',+this.value);window.updateCondLabel(${globalIdx})">
          </div>
          <div>
            <div class="fl">Action</div>
            <select onchange="window.updateRule(${globalIdx},'action',this.value)">
              ${ACTIONS.map(a => `<option value="${a.value}" ${r.action === a.value ? 'selected' : ''}>${a.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <div class="fl">Mute (min)</div>
            <input type="number" value="${r.muteDuration || 10}" min="1" onchange="window.updateRule(${globalIdx},'muteDuration',+this.value)">
          </div>
        </div>
      </div>
    `;
    list.appendChild(item);
  });
}

export function toggleCondDetail(summary) {
  const btn    = summary.querySelector('.cond-expand-btn');
  const detail = summary.nextElementSibling;
  if (!detail) return;
  const isOpen = detail.classList.contains('open');
  detail.classList.toggle('open', !isOpen);
  if (btn) { btn.classList.toggle('open', !isOpen); btn.textContent = isOpen ? '›' : '˅'; }
}

export function updateCondLabel(globalIdx) {
  const r = rateRules[globalIdx];
  if (!r) return;
  const list = document.getElementById(`conds-${r.type}`);
  if (!list) return;
  list.querySelectorAll('.cond-item').forEach(item => {
    if (parseInt(item.dataset.gi) === globalIdx) {
      const lbl = item.querySelector('.cond-label');
      if (lbl) lbl.textContent = buildCondLabel(r);
    }
  });
}

export function updateRule(idx, field, value) {
  if (rateRules[idx]) rateRules[idx][field] = value;
}

export function addCondition(type) {
  const defaults = {
    messages:    { limit: 5,  window: 5  },
    mentions:    { limit: 5,  window: 5  },
    attachments: { limit: 3,  window: 5  },
    emojis:      { limit: 5,  window: 5  },
    newlines:    { limit: 8,  window: 5  },
    caps:        { limit: 70, window: 0  },
    duplicates:  { limit: 3,  window: 30 },
    links:       { limit: 3,  window: 10 },
  };
  const d = defaults[type] || { limit: 5, window: 5 };
  rateRules.push({ type, limit: d.limit, window: d.window, action: 'warn', muteDuration: 10 });
  renderConditions(type);
}

export function removeCondition(globalIdx) {
  const type = rateRules[globalIdx]?.type;
  rateRules.splice(globalIdx, 1);
  // Re-render all types because globalIdx shifts for everything after the removed item
  RATE_TYPES.forEach(t => renderConditions(t));
}

export function renderAllConditions() {
  RATE_TYPES.forEach(t => renderConditions(t));
}