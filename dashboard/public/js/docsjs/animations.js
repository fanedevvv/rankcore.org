// docsjs/animations.js — Entrance animations and transitions
// ─────────────────────────────────────────────────────────────────────────────
import { state } from './state.js';

// Inject animation CSS once
const ANIM_CSS = `
@keyframes fadeUp   { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:none } }
@keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
@keyframes scaleIn  { from { opacity:0; transform:scale(.96) } to { opacity:1; transform:scale(1) } }
@keyframes slideR   { from { opacity:0; transform:translateX(-12px) } to { opacity:1; transform:none } }
@keyframes slideL   { from { opacity:0; transform:translateX(12px) } to { opacity:1; transform:none } }
@keyframes countUp  { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
@keyframes shimmer  { from { background-position:-200% 0 } to { background-position:200% 0 } }

[data-anim]          { opacity:0 }
[data-anim].visible  { animation-fill-mode:both; animation-timing-function:cubic-bezier(.22,1,.36,1) }
[data-anim="fadeUp"].visible  { animation-name:fadeUp }
[data-anim="fadeIn"].visible  { animation-name:fadeIn }
[data-anim="scaleIn"].visible { animation-name:scaleIn }
[data-anim="slideR"].visible  { animation-name:slideR }
[data-anim="slideL"].visible  { animation-name:slideL }
[data-anim="countUp"].visible { animation-name:countUp }

/* Page transitions */
.page-transition-out { animation:fadeIn .18s ease reverse both }
.page-transition-in  { animation:fadeIn .22s ease both }

/* Card hover lift */
.lift { transition:transform .18s cubic-bezier(.22,1,.36,1),box-shadow .18s ease,border-color .18s ease }
.lift:hover { transform:translateY(-2px) }

/* Skeleton loading shimmer */
.skeleton {
  background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 75%);
  background-size:200% 100%;
  animation:shimmer 1.5s infinite;
  border-radius:.5rem;
}

/* Step number pulse on scroll into view */
@keyframes stepPulse { 0%,100%{box-shadow:0 0 0 0 rgba(108,83,255,.5)} 50%{box-shadow:0 0 0 8px rgba(108,83,255,0)} }
.step-num.pulse { animation:stepPulse .6s ease }

/* Smooth highlight on anchor jump */
@keyframes sectionHighlight { 0%,100%{background:transparent} 30%{background:rgba(108,83,255,.07)} }
.guide-section.highlighted { animation:sectionHighlight 1.2s ease }

/* Reduce motion override */
.reduce-motion *, .reduce-motion *::before, .reduce-motion *::after {
  animation-duration:.01ms !important;
  animation-iteration-count:1 !important;
  transition-duration:.01ms !important;
}
`;

let _css;
export function injectAnimCSS() {
  if (_css) return;
  _css = document.createElement('style');
  _css.id = 'docs-anim-css';
  _css.textContent = ANIM_CSS;
  document.head.appendChild(_css);
}

// ── Intersection Observer for scroll-triggered reveals ─────────────────────
let _observer;
export function initScrollAnimations() {
  if (state.a11y.reduceMotion) return;

  _observer?.disconnect();
  _observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const delay = el.dataset.delay || '0';
        const dur   = el.dataset.dur   || '0.45s';
        el.style.animationDuration = dur;
        el.style.animationDelay    = delay + 's';
        el.classList.add('visible');
        _observer.unobserve(el);

        // Pulse step numbers when their parent enters view
        if (el.querySelector?.('.step-num')) {
          el.querySelectorAll('.step-num').forEach((n, i) => {
            setTimeout(() => {
              n.classList.add('pulse');
              setTimeout(() => n.classList.remove('pulse'), 600);
            }, i * 120);
          });
        }
      }
    });
  }, { rootMargin: '0px 0px -40px 0px', threshold: 0.08 });

  document.querySelectorAll('[data-anim]').forEach(el => _observer.observe(el));
}

// ── Animate content in after a guide loads ─────────────────────────────────
export function animateGuideIn(container) {
  if (state.a11y.reduceMotion) return;
  container.classList.remove('page-transition-out');
  container.classList.add('page-transition-in');
  setTimeout(() => container.classList.remove('page-transition-in'), 300);
}

export function animateGuideOut(container, cb) {
  if (state.a11y.reduceMotion) { cb?.(); return; }
  container.classList.add('page-transition-out');
  setTimeout(() => { container.classList.remove('page-transition-out'); cb?.(); }, 200);
}

// ── Highlight a section when jumped to ─────────────────────────────────────
export function highlightSection(id) {
  if (state.a11y.reduceMotion) return;
  const el = document.getElementById('gs-' + id);
  if (!el) return;
  el.classList.remove('highlighted');
  void el.offsetWidth; // force reflow
  el.classList.add('highlighted');
  setTimeout(() => el.classList.remove('highlighted'), 1200);
}

// ── Counter animation for stat numbers ─────────────────────────────────────
export function animateCounter(el, target, suffix = '') {
  if (state.a11y.reduceMotion) { el.textContent = target + suffix; return; }
  const duration = 800;
  const start    = performance.now();
  const isFloat  = String(target).includes('.');
  const end      = parseFloat(target);
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const val  = isFloat ? (end * ease).toFixed(1) : Math.round(end * ease);
    el.textContent = val + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}