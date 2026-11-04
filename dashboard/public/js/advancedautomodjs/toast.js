// ─── Toast ────────────────────────────────────────────────────────────────────
export function toast(msg, error = false) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.style.background = error ? '#c0392b' : '#166534';
  t.style.transform  = 'translateX(0)';
  setTimeout(() => t.style.transform = 'translateX(440px)', 3000);
}