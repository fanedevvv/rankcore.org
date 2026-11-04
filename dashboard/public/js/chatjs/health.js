import { apiFetch } from './api.js';
import { setSdot }  from './ui.js';

export async function checkHealth() {
  try {
    const d = await apiFetch('/health');
    setSdot('ready');
    const lbl = document.getElementById('ml');
    if (lbl) lbl.textContent = 'Powered by Groq \u00b7 ' + (d.model || 'kimi-k2');
  } catch {
    setSdot('off');
    const txt = document.getElementById('st');
    if (txt) txt.textContent = 'offline';
  }
}
