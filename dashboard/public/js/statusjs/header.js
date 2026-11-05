// statusjs/header.js — Header utility actions (copy link, subscribe)
// ─────────────────────────────────────────────────────────────────────────────

export function copyLink() {
  const btn = document.getElementById('share-btn');
  try { navigator.clipboard.writeText(window.location.href); } catch (_) {}
  if (btn) {
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = '⎘'; }, 2000);
  }
}

export function subscribeToAlerts() {
  const email = prompt('Enter your email to receive incident notifications:');
  if (email && email.includes('@')) {
    alert(`✓ ${email} subscribed to RankCore incident alerts. (Demo — no real subscription was created)`);
  }
}