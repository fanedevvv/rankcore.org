// docsjs/toc.js — Table of contents scroll spy and smooth navigation
// ─────────────────────────────────────────────────────────────────────────────
import { highlightSection } from './animations.js';

let _scrollHandler = null;

// Get element's true offset from the top of the document
function pageOffsetTop(el) {
  let top = 0;
  while (el) { top += el.offsetTop; el = el.offsetParent; }
  return top;
}

// Force-reveal all [data-anim] children of a section that haven't animated yet
function forceRevealSection(sectionEl) {
  sectionEl.querySelectorAll('[data-anim]:not(.visible)').forEach(el => {
    el.style.animationDuration  = '0s';
    el.style.animationDelay     = '0s';
    el.classList.add('visible');
  });
}

export function initToc() {
  const links    = document.querySelectorAll('.guide-toc-item a');
  const sections = Array.from(document.querySelectorAll('.guide-section[id]'));
  if (!sections.length) return;

  // Smooth scroll on link click
  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const sectionId = link.dataset.section;
      const target    = document.getElementById('gs-' + sectionId);
      if (!target) return;

      // Force-reveal any not-yet-animated children before scrolling
      // so content is never blank when jumping to it
      forceRevealSection(target);

      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      highlightSection(sectionId);
      history.replaceState(history.state, '', location.hash.split('#gs-')[0] + '#gs-' + sectionId);
    });
  });

  // Scroll spy — use true document offsets, not offsetTop relative to parent
  if (_scrollHandler) window.removeEventListener('scroll', _scrollHandler);
  _scrollHandler = () => {
    const scrollY = window.scrollY + 120;
    let active = sections[0]?.id;
    sections.forEach(s => { if (scrollY >= pageOffsetTop(s)) active = s.id; });
    links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + active));
  };
  window.addEventListener('scroll', _scrollHandler, { passive: true });
  _scrollHandler();
}

export function destroyToc() {
  if (_scrollHandler) window.removeEventListener('scroll', _scrollHandler);
  _scrollHandler = null;
}