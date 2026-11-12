// docsmain.js — Entry point for the docs system
// ─────────────────────────────────────────────────────────────────────────────
import { state, loadA11y } from './docsjs/state.js';
import { injectAnimCSS, initScrollAnimations } from './docsjs/animations.js';
import { buildA11yPanel, applyA11y } from './docsjs/accessibility.js';
import { search, renderSearchResults } from './docsjs/search.js';
import { renderLanding, renderGuide } from './docsjs/render.js';
import { GUIDES, CATEGORIES } from './docsjs/data.js';

// ── Boot ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {

  // a11y
  loadA11y();
  applyA11y();
  injectAnimCSS();
  buildA11yPanel();

  // Render landing
  renderLanding();

  // Check for hash-based deep link
  const hash = location.hash;
  if (hash.startsWith('#guide-')) {
    const rest = hash.slice(7); // remove '#guide-'
    const parts = rest.split('-');
    // Try progressively shorter IDs (guide IDs contain hyphens)
    for (let i = parts.length; i >= 1; i--) {
      const id = parts.slice(0, i).join('-');
      if (GUIDES[id]) {
        const section = parts.slice(i).join('-') || null;
        renderGuide(id, section || undefined);
        break;
      }
    }
  }

  // popstate (back/forward)
  window.addEventListener('popstate', e => {
    if (e.state?.guide) renderGuide(e.state.guide, e.state.section || undefined);
    else window.showLanding();
  });

  // Search
  const input   = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  if (input && results) {
    let _debounce;
    input.addEventListener('input', () => {
      clearTimeout(_debounce);
      _debounce = setTimeout(() => {
        const q = input.value.trim();
        if (!q || q.length < 2) { results.style.display = 'none'; return; }
        const hits = search(q);
        results.innerHTML = renderSearchResults(hits, q);
        results.style.display = 'block';
        if (window.lucide) window.lucide.createIcons();

        results.querySelectorAll('.search-result').forEach(el => {
          el.addEventListener('click', () => {
            const guideId  = el.dataset.guide;
            const sectionId = el.dataset.section || undefined;
            input.value = '';
            results.style.display = 'none';
            renderGuide(guideId, sectionId);
          });
        });
      }, 180);
    });

    document.addEventListener('click', e => {
      if (!input.contains(e.target) && !results.contains(e.target))
        results.style.display = 'none';
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { input.value = ''; results.style.display = 'none'; }
    });
  }

  // Expose globals for inline onclick handlers in HTML
  window.showLanding = () => {
    state.currentGuide = null;
    document.getElementById('landing').style.display   = 'block';
    document.getElementById('guideView').style.display = 'none';
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    window.scrollTo({ top: 0, behavior: 'instant' });
    history.pushState({}, '', location.pathname);
  };

  window.openGuide = (id, section) => renderGuide(id, section);
});