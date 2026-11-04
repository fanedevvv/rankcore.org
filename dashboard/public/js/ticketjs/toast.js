// ─── Toast ────────────────────────────────────────────────────────────────────

export function showToast(msg, type = 'success') {
  const t  = document.getElementById('toast');
  const ti = document.getElementById('toastIcon');
  const tm = document.getElementById('toastMsg');
  ti.innerHTML = type === 'success'
    ? `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`
    : `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;
  tm.textContent = msg;
  t.className = `fixed top-4 right-4 px-5 py-3 rounded-xl shadow-2xl transition-all duration-300 z-50 text-sm font-semibold flex items-center gap-2 text-white ${type === 'success' ? 'bg-red-600' : 'bg-red-600'}`;
  t.style.transform = 'translateX(0)';
  setTimeout(() => { t.style.transform = 'translateX(500px)'; }, 3200);
}