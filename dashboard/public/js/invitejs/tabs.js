// ─── Tab Navigation ───────────────────────────────────────────────────────────

export function initTabs() {
  // Activate the first tab by default (already handled by HTML class, but
  // this keeps state consistent if switchTab is called before DOMContentLoaded)
}

export function switchTab(name) {
  document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  document.getElementById('tab-' + name)?.classList.add('active');

  // Find the button that triggered this tab by matching its onclick text
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('onclick')?.includes(`'${name}'`)) {
      btn.classList.add('active');
    }
  });
}