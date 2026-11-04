// devjs/maintenance.js

import { secureFetch, showToast } from './core.js';

export async function loadMaintenance() {
  try {
    const d = await secureFetch('/api-dev/maintenance').then(r => r.json());
    if (d.error) return;
    document.getElementById('maint-title').value   = d.title || '';
    document.getElementById('maint-message').value = d.message || '';
    document.getElementById('maint-bypass').value  = (d.bypassIPs || []).join(', ');
    if (d.eta) {
      const dt  = new Date(d.eta);
      const pad = n => String(n).padStart(2, '0');
      document.getElementById('maint-eta').value =
        `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    } else {
      document.getElementById('maint-eta').value = '';
    }
    updateMaintenanceBadge(d.enabled);
    if (d.triggeredBy && d.triggeredAt) {
      document.getElementById('maint-meta').textContent =
        `Last changed by ${d.triggeredBy} on ${new Date(d.triggeredAt).toLocaleString()}`;
    }
  } catch {}
}

export function updateMaintenanceBadge(enabled) {
  const b = document.getElementById('maint-badge');
  if (!b) return;
  b.textContent = enabled ? 'MAINTENANCE' : 'ONLINE';
  b.style.cssText = enabled
    ? 'background:rgba(237,66,69,0.1);color:#ed4245;border:1px solid rgba(237,66,69,0.25);font-size:0.65rem;font-weight:800;font-family:JetBrains Mono,monospace;padding:4px 10px;border-radius:20px'
    : 'background:rgba(255,51,51,0.1);color:var(--accent);border:1px solid rgba(255,51,51,0.2);font-size:0.65rem;font-weight:800;font-family:JetBrains Mono,monospace;padding:4px 10px;border-radius:20px';
}

export function clearETA() {
  document.getElementById('maint-eta').value = '';
}

export async function saveMaintenance(enabledOverride) {
  const title      = document.getElementById('maint-title').value.trim();
  const message    = document.getElementById('maint-message').value.trim();
  const etaVal     = document.getElementById('maint-eta').value;
  const bypassRaw  = document.getElementById('maint-bypass').value;
  let   enabled    = enabledOverride;
  if (enabled === null) {
    const b = document.getElementById('maint-badge');
    enabled = b && b.textContent === 'MAINTENANCE';
  }
  const body = {
    enabled,
    title:     title   || "We're offline for maintenance!",
    message:   message || "We'll be back shortly.",
    eta:       etaVal ? new Date(etaVal).toISOString() : null,
    bypassIPs: bypassRaw.split(',').map(s => s.trim()).filter(Boolean),
  };
  const res = await secureFetch('/api-dev/maintenance', { method: 'POST', body: JSON.stringify(body) }).then(r => r.json());
  if (res.error) return showToast(res.error, true);
  updateMaintenanceBadge(res.enabled);
  showToast(res.enabled ? 'Maintenance ENABLED' : 'Maintenance DISABLED');
}