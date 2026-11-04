// ─── Toast Notifications ─────────────────────────────────────────────────────

export function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const icon  = document.getElementById('toastIcon');
  const text  = document.getElementById('toastMessage');

  text.textContent = msg;
  icon.innerHTML = type === 'error' ? '✕' : type === 'warning' ? '⚠' : '✓';
  toast.style.backgroundColor =
    type === 'error'   ? '#FF4757' :
    type === 'warning' ? '#FFB347' : '#6C53FF';

  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}