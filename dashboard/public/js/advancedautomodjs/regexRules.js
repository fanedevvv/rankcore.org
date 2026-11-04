// ─── Regex Rules ──────────────────────────────────────────────────────────────
import { regexRules, ACTIONS } from './state.js';
import { esc } from './helpers.js';

export function renderRegexRules() {
  const list = document.getElementById('regexRulesList');
  list.innerHTML = '';
  regexRules.forEach((r, i) => {
    const div = document.createElement('div');
    div.className = 'regex-rule';
    div.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 110px 28px;gap:.5rem;align-items:center;margin-bottom:.45rem;">
        <input type="text" value="${esc(r.pattern)}" placeholder="Pattern (e.g. https?://\\S+)"
          onchange="window.regexRules[${i}].pattern=this.value">
        <select onchange="window.regexRules[${i}].action=this.value">
          ${ACTIONS.map(a => `<option value="${a.value}" ${r.action === a.value ? 'selected' : ''}>${a.label}</option>`).join('')}
        </select>
        <button class="btn-icon" onclick="window.removeRegexRule(${i})">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="12" height="12" fill="currentColor"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3l105.3 105.3c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256l105.3-105.4z"/></svg>
        </button>
      </div>
      <input type="text" value="${esc(r.description || '')}" placeholder="Description (optional)"
        style="font-size:.76rem;color:var(--text-muted);" onchange="window.regexRules[${i}].description=this.value">
    `;
    list.appendChild(div);
  });
}

export function addRegexRule() {
  regexRules.push({ pattern: '', action: 'warn', description: '', flags: 'i' });
  renderRegexRules();
}

export function removeRegexRule(i) {
  regexRules.splice(i, 1);
  renderRegexRules();
}

export function testRegex() {
  const pattern = document.getElementById('testPattern').value.trim();
  const input   = document.getElementById('testInput').value;
  const out     = document.getElementById('testResult');
  if (!pattern) {
    out.innerHTML = '<span style="color:var(--text-muted)">Enter a pattern first.</span>';
    return;
  }
  try {
    const match = new RegExp(pattern, 'i').test(input);
    out.innerHTML = match
      ? '<span style="color:var(--success)">✓ Match found</span>'
      : '<span style="color:var(--danger)">✗ No match</span>';
  } catch (e) {
    out.innerHTML = `<span style="color:var(--warning)">⚠ Invalid regex: ${esc(e.message)}</span>`;
  }
}