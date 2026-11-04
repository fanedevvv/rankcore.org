// ─── Escape ───────────────────────────────────────────────────────────────────
export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ─── Toggle filter sections ───────────────────────────────────────────────────
export function toggleFilterSection(id, chk) {
  const el = document.getElementById(id);
  if (!el) return;
  if (chk.checked) {
    el.classList.remove('hidden');
    el.style.display = '';
  } else {
    el.classList.add('hidden');
    el.style.display = 'none';
  }
}

// ─── Read/write scalar inputs ─────────────────────────────────────────────────
export function v(id)        { return document.getElementById(id)?.value ?? ''; }
export function vi(id)       { return parseInt(v(id)) || 0; }
export function vf(id)       { return parseFloat(v(id)) || 0; }
export function vb(id)       { return document.getElementById(id)?.checked ?? false; }
export function set(id, val) { const el = document.getElementById(id); if (el) el.value = String(val ?? ''); }
export function setb(id,val) { const el = document.getElementById(id); if (el) el.checked = !!val; }