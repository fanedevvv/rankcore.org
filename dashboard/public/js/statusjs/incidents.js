// statusjs/incidents.js — Incident feed rendering + filter controls
// ─────────────────────────────────────────────────────────────────────────────

import { state }                  from './state.js';
import { fmtDate, fmtDuration }   from './fmt.js';

// FIX SEC-5: Escape all API-sourced strings before injecting into innerHTML.
// inc.title, inc.body, u.body come from the server's incidents.json file and
// could contain HTML if the auto-generator is ever compromised or a field is
// manually edited. Always escape before template literal insertion.
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ── Public API ────────────────────────────────────────────────────────────────

export function renderIncidents(incidents) {
  state.incidentsData = incidents;
  renderIncidentFeed();
}

export function filterIncidents(filter, btn) {
  state.incidentFilter = filter;
  document.querySelectorAll('.ifbtn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderIncidentFeed();
}

// ── Internal renderer ─────────────────────────────────────────────────────────

function renderIncidentFeed() {
  const el    = document.getElementById('inc-feed');
  const cntEl = document.getElementById('inc-count');

  let list = state.incidentsData;
  if (state.incidentFilter === 'ongoing')  list = list.filter(i => i.status === 'ongoing');
  if (state.incidentFilter === 'resolved') list = list.filter(i => i.status === 'resolved');
  if (state.incidentFilter === 'down')     list = list.filter(i => i.severity === 'down');
  if (state.incidentFilter === 'degraded') list = list.filter(i => i.severity === 'degraded');

  if (cntEl) {
    cntEl.textContent = list.length + ' incident' + (list.length !== 1 ? 's' : '');
  }

  if (!list.length) {
    el.innerHTML = '<div class="no-incidents">✓ No incidents found for this filter</div>';
    return;
  }

  el.innerHTML = list.map(inc => {
    const dur     = inc.resolvedAt ? fmtDuration(inc.resolvedAt - inc.openedAt) : null;
    const updates = (inc.updates || []).map(u => `
      <div class="inc-update">
        <div class="inc-update-time">${fmtDate(u.ts)}</div>
        ${esc(u.body)}
      </div>`).join('');

    return `
    <div class="incident ${esc(inc.status)}">
      <div class="inc-time">
        ${fmtDate(inc.openedAt)}
        ${dur ? `<span class="inc-dur">· ${esc(dur)}</span>` : ''}
      </div>
      <div class="inc-title">
        ${esc(inc.title)}
        <span class="inc-tag ${esc(inc.status)}">${esc(inc.status)}</span>
        ${inc.severity === 'down'
          ? '<span class="inc-tag ongoing" style="background:var(--red-bg);border-color:var(--red-bd)">outage</span>'
          : ''}
      </div>
      <div class="inc-body">${esc(inc.body)}</div>
      ${updates ? `<div class="inc-updates">${updates}</div>` : ''}
    </div>`;
  }).join('');
}