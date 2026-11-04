// statusjs/theme.js — Dark / light mode toggle with localStorage persistence
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'noxx-theme';

export function initTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      document.documentElement.dataset.theme = saved;
      const btn = document.getElementById('theme-btn');
      if (btn) btn.textContent = saved === 'light' ? '☀' : '☽';
    }
  } catch (_) { /* localStorage blocked */ }
}

export function toggleTheme() {
  const html   = document.documentElement;
  const isDark = html.dataset.theme === 'dark';
  html.dataset.theme = isDark ? 'light' : 'dark';

  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = isDark ? '☀' : '☽';

  try { localStorage.setItem(STORAGE_KEY, html.dataset.theme); } catch (_) {}
}