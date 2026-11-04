// docsjs/state.js — Shared state for the docs system
// ─────────────────────────────────────────────────────────────────────────────

export const state = {
  currentGuide: null,
  currentSection: null,
  searchQuery: '',
  a11y: {
    fontSize: 'normal',    // 'small' | 'normal' | 'large' | 'xlarge'
    contrast: 'normal',    // 'normal' | 'high' | 'dark-high'
    dyslexia: false,
    reduceMotion: false,
    lineSpacing: 'normal', // 'normal' | 'relaxed' | 'loose'
  },
};

// Persist a11y settings to localStorage
export function saveA11y() {
  try { localStorage.setItem('noxx_docs_a11y', JSON.stringify(state.a11y)); } catch {}
}

export function loadA11y() {
  try {
    const saved = localStorage.getItem('noxx_docs_a11y');
    if (saved) Object.assign(state.a11y, JSON.parse(saved));
  } catch {}
}