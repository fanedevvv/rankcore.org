// ─── Warn Steps ───────────────────────────────────────────────────────────────
import { warnSteps, ACTIONS } from './state.js';
import { esc } from './helpers.js';

export function renderWarnSteps() {
  const list = document.getElementById('warnStepsList');
  list.innerHTML = '';
  warnSteps.forEach((s, i) => {
    const row = document.createElement('div');
    row.className  = 'warn-step';
    row.innerHTML  = `
      <input type="number" value="${s.count}" min="1" placeholder="#"
        onchange="window.warnSteps[${i}].count=+this.value">
      <select onchange="window.warnSteps[${i}].action=this.value">
        ${ACTIONS.map(a => `<option value="${a.value}" ${s.action === a.value ? 'selected' : ''}>${a.label}</option>`).join('')}
      </select>
      <input type="text" value="${esc(s.note || '')}" placeholder="e.g. 10m or note"
        onchange="window.warnSteps[${i}].note=this.value">
      <button class="btn-icon" onclick="window.removeWarnStep(${i})" title="Remove">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="12" height="12" fill="currentColor"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3l105.3 105.3c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256l105.3-105.4z"/></svg>
      </button>
    `;
    list.appendChild(row);
  });
}

export function addWarnStep() {
  const next = warnSteps.length ? Math.max(...warnSteps.map(s => s.count)) + 1 : 1;
  warnSteps.push({ count: next, action: 'mute', note: '' });
  renderWarnSteps();
}

export function removeWarnStep(i) {
  warnSteps.splice(i, 1);
  renderWarnSteps();
}