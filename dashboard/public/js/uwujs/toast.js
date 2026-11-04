// uwujs/toast.js

export function showToast(msg, type = 'success') {
  const toast   = document.getElementById('toast');
  const icon    = document.getElementById('toastIcon');
  const message = document.getElementById('toastMessage');

  message.textContent = msg;
  icon.innerHTML =
    type === 'error'   ? '✕' :
    type === 'warn'    ? '⚠' :
                         '✓';

  toast.style.background =
    type === 'error' ? 'linear-gradient(135deg,#c0392b,#8e0000)' :
    type === 'warn'  ? 'linear-gradient(135deg,#b8860b,#7a5800)' :
                       'linear-gradient(135deg,#C084FC,#FF6EB4)';

  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}