// ─── Card Toggle ──────────────────────────────────────────────────────────────

export function toggleCard(id) {
  const body = document.getElementById(id);
  if (!body) return;
  body.classList.toggle('open');
  const suffix = id === 'bb' ? 'bot' : 'dash';
  const btn    = document.getElementById('eb-' + suffix);
  if (btn) btn.textContent = body.classList.contains('open') ? 'Collapse ↑' : 'Expand ↓';
}