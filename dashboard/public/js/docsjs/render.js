// docsjs/render.js — Landing page and guide view rendering
import { GUIDES, CATEGORIES } from './data.js';
import { FAQS, renderFaqSection, initFaqAccordion } from './faq.js';
import { initScrollAnimations, animateGuideIn, animateGuideOut, animateCounter } from './animations.js';
import { initToc, destroyToc } from './toc.js';
import { state } from './state.js';

// ── Landing page ─────────────────────────────────────────────────────────────
export function renderLanding() {
  const landing = document.getElementById('landing');
  const guideView = document.getElementById('guideView');
  if (!landing || !guideView) return;

  guideView.style.display = 'none';
  landing.style.display = 'block';

  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));

  const container = document.getElementById('catCards');
  if (!container) return;

  container.innerHTML = CATEGORIES.map(cat => `
    <div class="cat-section" data-anim="fadeUp">
      <div class="cat-section-label">
        <i data-lucide="${cat.icon}" style="width:12px;height:12px;color:${cat.color}"></i>
        ${cat.name}
      </div>
      <div class="cat-grid">
        ${cat.guides.map(gid => {
          const g = GUIDES[gid];
          if (!g) return '';
          const faqCount = (FAQS[gid] || []).length;
          return `<div class="cat-card lift" data-guide="${gid}" role="button" tabindex="0"
            style="border-color:${cat.border}22" aria-label="Open ${g.name} guide">
            <div class="cat-card-head">
              <div class="cat-icon-wrap" style="background:${cat.bg};border:1px solid ${cat.border}">
                <i data-lucide="${g.icon}" style="color:${g.color}"></i>
              </div>
              <div class="cat-name">${g.name}</div>
            </div>
            <div class="cat-desc">${g.desc}</div>
            <div class="cat-footer">
              <span class="cat-count">${g.sections.length} section${g.sections.length !== 1 ? 's' : ''}</span>
              ${faqCount ? `<span class="cat-faq-badge">${faqCount} FAQ${faqCount !== 1 ? 's' : ''}</span>` : ''}
              ${(g.tags||[]).slice(0,2).map(t => `<span class="cat-tag">${t}</span>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`).join('');

  if (window.lucide) window.lucide.createIcons();

  // Wire card clicks
  container.querySelectorAll('[data-guide]').forEach(card => {
    const open = () => renderGuide(card.dataset.guide);
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });

  // Animate stat counters
  document.querySelectorAll('[data-counter]').forEach(el => {
    animateCounter(el, el.dataset.counter, el.dataset.suffix || '');
  });

  initScrollAnimations();
}

// ── Guide view ────────────────────────────────────────────────────────────────
export function renderGuide(id, scrollToSection) {
  const g = GUIDES[id];
  if (!g) return;

  const landing   = document.getElementById('landing');
  const guideView = document.getElementById('guideView');
  if (!landing || !guideView) return;

  destroyToc();

  const doRender = () => {
    state.currentGuide   = id;
    state.currentSection = scrollToSection || null;

    landing.style.display   = 'none';
    guideView.style.display = 'block';

    // Sidebar active state
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll(`.sidebar-item[data-guide="${id}"]`).forEach(el => el.classList.add('active'));

    // Hero
    const cat = CATEGORIES.find(c => c.guides.includes(id));
    const heroWrap = document.getElementById('guideHeroWrap');
    if (heroWrap) {
      heroWrap.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:.85rem">
          <div class="guide-hero-icon" style="background:${cat?.bg||'rgba(108,83,255,.1)'};border:1px solid ${cat?.border||'rgba(108,83,255,.2)'}">
            <i data-lucide="${g.icon}" style="width:20px;height:20px;color:${g.color}"></i>
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.3rem;flex-wrap:wrap">
              <h1 class="guide-hero-title">${g.name}</h1>
              ${(g.tags||[]).map(t => `<span class="tag purple">${t}</span>`).join('')}
            </div>
            <p class="guide-hero-sub">${g.desc}</p>
          </div>
        </div>`;
    }

    // Build sections including FAQ
    const allSections = [...g.sections];
    const hasFaq = !!(FAQS[id]?.length);

    // TOC
    const toc = document.getElementById('guideToc');
    if (toc) {
      toc.innerHTML = allSections.map(s =>
        `<li class="guide-toc-item"><a href="#gs-${s.id}" data-section="${s.id}">${s.title}</a></li>`
      ).join('') + (hasFaq ? `<li class="guide-toc-item"><a href="#gs-faq" data-section="faq">FAQ</a></li>` : '');
    }

    // Article
    const article = document.getElementById('guideArticle');
    if (article) {
      const sectionsHtml = allSections.map((s, i) => `
        <div class="guide-section" id="gs-${s.id}">
          <div class="section-header" data-anim="slideR">
            <div class="section-num">${String(i + 1).padStart(2, '0')}</div>
            <h2 class="section-title">${s.title}</h2>
          </div>
          ${s.render()}
        </div>`).join('');

      article.innerHTML = sectionsHtml + (hasFaq ? renderFaqSection(id) : '');

      // Breadcrumb links within content
      article.querySelectorAll('[data-guide-link]').forEach(el => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => renderGuide(el.dataset.guideLink));
      });
    }

    if (window.lucide) window.lucide.createIcons();
    initFaqAccordion();
    initScrollAnimations();
    initToc();
    animateGuideIn(guideView);

    window.scrollTo({ top: 0, behavior: 'instant' });

    if (scrollToSection) {
      setTimeout(() => {
        const target = document.getElementById('gs-' + scrollToSection);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }

    history.pushState({ guide: id, section: scrollToSection || null }, '', `#guide-${id}${scrollToSection ? '-' + scrollToSection : ''}`);
  };

  // If guide view is already visible, animate out first
  if (guideView.style.display !== 'none' && state.currentGuide) {
    animateGuideOut(guideView, doRender);
  } else {
    doRender();
  }
}