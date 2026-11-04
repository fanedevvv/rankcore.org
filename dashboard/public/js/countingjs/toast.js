// countingjs/toast.js

export function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const box = document.getElementById('toastMessage');
  box.innerText = msg;
  toast.style.backgroundColor =
    type === 'error' ? '#e74c3c' :
    type === 'warn'  ? '#f39c12' :
                       '#27ae60';
  toast.style.transform = 'translateX(0)';
  setTimeout(() => (toast.style.transform = 'translateX(400px)'), 3000);
}