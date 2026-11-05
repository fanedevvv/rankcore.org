/**
 * loader.js — Page loading overlay + global progress bar + fetch interception
 * Provides: PageLoader, LoadingBar, skeleton helpers, fetch progress tracking
 */
(function () {
  'use strict';

  // ── Inject styles ──────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #noxx-page-loader {
      position: fixed; inset: 0; z-index: 99999;
      background: #070813;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 28px;
      transition: opacity 0.35s ease, visibility 0.35s ease;
    }
    #noxx-page-loader.hidden { opacity: 0; visibility: hidden; pointer-events: none; }

    #noxx-page-loader .ldr-logo {
      width: 52px; height: 52px; border-radius: 14px;
      background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.2);
      display: flex; align-items: center; justify-content: center;
      animation: ldr-pulse 2s ease-in-out infinite;
    }
    #noxx-page-loader .ldr-logo img { width: 30px; height: 30px; object-fit: contain; }
    @keyframes ldr-pulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(139,92,246,0); }
      50%      { box-shadow: 0 0 0 8px rgba(139,92,246,0.08); }
    }

    #noxx-page-loader .ldr-spinner {
      width: 48px; height: 48px; border-radius: 50%;
      border: 3px solid rgba(139,92,246,0.12); border-top-color: #8B5CF6;
      animation: ldr-spin 0.75s linear infinite;
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%,-50%);
    }
    @keyframes ldr-spin { to { transform: translate(-50%,-50%) rotate(360deg); } }

    #noxx-page-loader .ldr-ring-wrap {
      position: relative; width: 80px; height: 80px;
      display: flex; align-items: center; justify-content: center;
    }

    #noxx-page-loader .ldr-bar-track {
      position: fixed; top: 0; left: 0; right: 0; height: 3px;
      background: rgba(139,92,246,0.1);
    }
    #noxx-page-loader .ldr-bar {
      height: 100%;
      background: linear-gradient(90deg, #38D4FF,#8B5CF6,#E05CFF);
      background-size: 200% 100%;
      animation: ldr-bar-move 1.4s ease-in-out infinite;
      border-radius: 0 2px 2px 0; width: 40%;
    }
    @keyframes ldr-bar-move { 0%{margin-left:-40%} 100%{margin-left:140%} }

    #noxx-page-loader .ldr-label {
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      font-size: 12px; font-weight: 600;
      color: rgba(255,255,255,0.25); letter-spacing: 0.04em;
    }
    #noxx-page-loader .ldr-dots {
      display: inline-flex; align-items: center; gap: 4px; margin-left: 4px;
    }
    #noxx-page-loader .ldr-dots span {
      width: 3px; height: 3px; border-radius: 50%; background: rgba(255,255,255,0.25);
      animation: ldrDot 1.2s ease-in-out infinite;
    }
    #noxx-page-loader .ldr-dots span:nth-child(2) { animation-delay: 0.15s; }
    #noxx-page-loader .ldr-dots span:nth-child(3) { animation-delay: 0.30s; }
    @keyframes ldrDot {
      0%,80%,100%{ transform:scale(0.6); opacity:0.4; }
      40%{ transform:scale(1.2); opacity:1; }
    }

    #noxx-page-loader::after {
      content: ''; position: absolute; inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
      pointer-events: none; opacity: 0.4;
    }

    /* Global progress bar */
    #noxx-global-bar {
      position: fixed; top: 0; left: 0; height: 2px;
      background: linear-gradient(90deg, #38D4FF,#8B5CF6,#E05CFF);
      box-shadow: 0 0 8px rgba(139,92,246,0.7);
      z-index: 99998; width: 0%;
      transition: width 0.25s ease, opacity 0.4s ease;
      opacity: 0; pointer-events: none;
    }
    #noxx-global-bar.running { opacity: 1; }
    #noxx-global-bar.done    { width: 100% !important; opacity: 0; transition: width 0.15s ease, opacity 0.5s ease 0.15s; }

    /* Fetch indicator badge */
    #noxx-fetch-badge {
      position: fixed; bottom: 18px; right: 18px;
      background: rgba(11,12,20, 0.92);
      border: 1px solid rgba(139,92,246,0.25);
      border-radius: 20px; padding: 6px 12px 6px 8px;
      display: flex; align-items: center; gap: 6px;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      font-size: 11px; color: rgba(255,255,255,0.45);
      backdrop-filter: blur(8px);
      transform: translateY(60px); opacity: 0;
      transition: transform 0.3s cubic-bezier(.34,1.56,.64,1), opacity 0.3s ease;
      z-index: 9999; pointer-events: none;
    }
    #noxx-fetch-badge.visible { transform: translateY(0); opacity: 1; }
    #noxx-fetch-badge .fb-spinner {
      width: 10px; height: 10px; border-radius: 50%;
      border: 1.5px solid rgba(139,92,246,0.2); border-top-color: #8B5CF6;
      animation: ldr-spin 0.65s linear infinite;
      flex-shrink: 0;
    }

    /* Image load fade-in */
    img { transition: opacity 0.3s ease; }
    img.img-loading { opacity: 0; }
    img.img-loaded  { opacity: 1; }
  `;
  document.head.appendChild(style);

  // ── Page loader HTML ───────────────────────────────────────────────────────
  const loader = document.createElement('div');
  loader.id = 'noxx-page-loader';
  loader.innerHTML = `
    <div class="ldr-bar-track"><div class="ldr-bar"></div></div>
    <div class="ldr-ring-wrap">
      <div class="ldr-logo">
        <img src="/logo.png" alt="" onerror="this.style.display='none'">
      </div>
      <div class="ldr-spinner"></div>
    </div>
    <span class="ldr-label">Loading<span class="ldr-dots"><span></span><span></span><span></span></span></span>
  `;

  // ── Global progress bar ───────────────────────────────────────────────────
  const bar = document.createElement('div');
  bar.id = 'noxx-global-bar';

  // ── Fetch badge ───────────────────────────────────────────────────────────
  const badge = document.createElement('div');
  badge.id = 'noxx-fetch-badge';
  badge.innerHTML = `<div class="fb-spinner"></div><span id="noxx-fetch-text">Loading…</span>`;

  const inject = () => {
    if (document.body) {
      document.body.insertBefore(loader, document.body.firstChild);
      document.body.appendChild(bar);
      document.body.appendChild(badge);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.insertBefore(loader, document.body.firstChild);
        document.body.appendChild(bar);
        document.body.appendChild(badge);
      });
    }
  };
  inject();

  // ── Hide page loader ──────────────────────────────────────────────────────
  const hideLoader = () => setTimeout(() => loader.classList.add('hidden'), 120);
  if (document.readyState === 'complete') { hideLoader(); }
  else {
    window.addEventListener('load', hideLoader);
    setTimeout(hideLoader, 5000);
  }

  // ── Global progress bar controller ───────────────────────────────────────
  let barW = 0, barTimer = null;
  const LoadingBar = {
    start() {
      barW = 10; bar.style.width = barW + '%'; bar.classList.add('running'); bar.classList.remove('done');
      clearInterval(barTimer);
      barTimer = setInterval(() => {
        if (barW < 85) { barW += Math.random() * 8; bar.style.width = Math.min(barW, 85) + '%'; }
      }, 400);
    },
    done() {
      clearInterval(barTimer);
      bar.classList.add('done');
      setTimeout(() => { bar.classList.remove('running','done'); barW = 0; bar.style.width = '0%'; }, 700);
    },
    set(pct) { barW = pct; bar.style.width = pct + '%'; }
  };

  // ── Fetch tracking ────────────────────────────────────────────────────────
  let pendingFetches = 0;
  const badgeText = () => document.getElementById('noxx-fetch-text');

  const showBadge = (msg) => {
    if (badgeText()) badgeText().textContent = msg || 'Loading…';
    badge.classList.add('visible');
  };
  const hideBadge = () => badge.classList.remove('visible');

  // Intercept fetch to show progress indicators
  const origFetch = window.fetch;
  window.fetch = function(...args) {
    pendingFetches++;
    if (pendingFetches === 1) { LoadingBar.start(); showBadge('Fetching data…'); }
    return origFetch.apply(this, args).finally(() => {
      pendingFetches = Math.max(0, pendingFetches - 1);
      if (pendingFetches === 0) { LoadingBar.done(); setTimeout(hideBadge, 300); }
    });
  };

  // ── Image lazy load skeleton ──────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('img').forEach(img => {
      if (!img.complete) {
        img.classList.add('img-loading');
        img.addEventListener('load',  () => { img.classList.remove('img-loading'); img.classList.add('img-loaded'); }, { once: true });
        img.addEventListener('error', () => { img.classList.remove('img-loading'); }, { once: true });
      }
    });

    // Observe dynamically added images
    const obs = new MutationObserver(mutations => {
      mutations.forEach(m => m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        const imgs = node.tagName === 'IMG' ? [node] : [...node.querySelectorAll('img')];
        imgs.forEach(img => {
          if (!img.complete) {
            img.classList.add('img-loading');
            img.addEventListener('load',  () => { img.classList.remove('img-loading'); img.classList.add('img-loaded'); }, { once: true });
            img.addEventListener('error', () => img.classList.remove('img-loading'), { once: true });
          }
        });
      }));
    });
    obs.observe(document.body, { childList: true, subtree: true });
  });

  // ── Navigation progress (anchor clicks) ──────────────────────────────────
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript') || a.target === '_blank') return;
    LoadingBar.start();
  });

  // ── Expose globals ────────────────────────────────────────────────────────
  window.PageLoader  = { show: () => loader.classList.remove('hidden'), hide: hideLoader };
  window.LoadingBar  = LoadingBar;

  // Skeleton helper
  window.Skeleton = {
    /** Replace el's innerHTML with skeleton rows */
    show(el, rows = 3, opts = {}) {
      if (!el) return;
      el.innerHTML = Array.from({ length: rows }, (_, i) => `
        <div class="skel skel-row skel-w-${['full','3\\/4','1\\/2','full','3\\/4'][i % 5]}" style="animation-delay:${i * 0.08}s"></div>
      `).join('');
    },
    card(el, count = 3) {
      if (!el) return;
      el.innerHTML = Array.from({ length: count }, () => `
        <div class="card-skel-item">
          <div class="skel skel-avatar" style="width:40px;height:40px"></div>
          <div class="skel skel-title skel-w-3\\/4"></div>
          <div class="skel skel-text skel-w-full"></div>
          <div class="skel skel-text skel-w-1\\/2"></div>
          <div class="skel skel-btn skel-w-1\\/3" style="margin-top:4px"></div>
        </div>
      `).join('');
    },
    clear(el) {
      if (!el) return;
      el.classList.add('content-loaded');
    }
  };
})();
