/**
 * loading.js — Roco Dashboard Universal Loading System
 * Drop this into every page via <script src="/loading.js"></script>
 * Provides: page loader, progress bar, fetch interception, skeleton helpers
 */
(function () {
  'use strict';

  /* ── Inject page loader HTML ───────────────── */
  function init() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', init); return; }

    // Page loader (skip creation if already present in HTML)
    var loader = document.getElementById('nx-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'nx-loader';
      loader.innerHTML =
      '<div class="nx-bar-wrap"><div class="nx-bar"></div></div>' +
      '<div class="nx-ring">' +
        '<div class="nx-logo"><img src="/logo.png" alt="" onerror="this.style.display=\'none\'"></div>' +
        '<div class="nx-spin"></div>' +
      '</div>' +
      '<div class="nx-label">Loading<span class="nx-dots"><span></span><span></span><span></span></span></div>';
      document.body.insertBefore(loader, document.body.firstChild);
    }

    // Progress bar
    var prog = document.createElement('div');
    prog.id = 'nx-progress';
    document.body.appendChild(prog);

    // Fetch badge
    var badge = document.createElement('div');
    badge.id = 'nx-fetch-badge';
    badge.innerHTML = '<div class="nx-badge-spin"></div><span id="nx-badge-text">Loading…</span>';
    document.body.appendChild(badge);

    // Hide loader when page is ready
    function hideLoader() {
      setTimeout(function () { loader.classList.add('nx-hidden'); }, 150);
    }
    if (document.readyState === 'complete') {
      hideLoader();
    } else {
      window.addEventListener('load', hideLoader);
      setTimeout(hideLoader, 6000);
    }

    // Image pending class
    document.querySelectorAll('img').forEach(function (img) {
      if (!img.complete || !img.naturalWidth) {
        img.classList.add('nx-img-pending');
        img.addEventListener('load',  function () { img.classList.remove('nx-img-pending'); img.classList.add('nx-img-loaded'); }, { once: true });
        img.addEventListener('error', function () { img.classList.remove('nx-img-pending'); }, { once: true });
      }
    });

    // Watch for dynamically injected images
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          var imgs = n.tagName === 'IMG' ? [n] : Array.from(n.querySelectorAll('img'));
          imgs.forEach(function (img) {
            if (!img.complete || !img.naturalWidth) {
              img.classList.add('nx-img-pending');
              img.addEventListener('load',  function () { img.classList.remove('nx-img-pending'); img.classList.add('nx-img-loaded'); }, { once: true });
              img.addEventListener('error', function () { img.classList.remove('nx-img-pending'); }, { once: true });
            }
          });
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  init();

  /* ── Progress bar ──────────────────────────── */
  var barW = 0, barTimer = null;
  var NxBar = {
    start: function () {
      var prog = document.getElementById('nx-progress');
      if (!prog) return;
      barW = 10; prog.style.width = barW + '%';
      prog.classList.add('nx-running'); prog.classList.remove('nx-done');
      clearInterval(barTimer);
      barTimer = setInterval(function () {
        if (barW < 85) { barW += Math.random() * 7; prog.style.width = Math.min(barW, 85) + '%'; }
      }, 350);
    },
    done: function () {
      var prog = document.getElementById('nx-progress');
      if (!prog) return;
      clearInterval(barTimer);
      prog.classList.add('nx-done');
      setTimeout(function () { prog.classList.remove('nx-running', 'nx-done'); prog.style.width = '0%'; barW = 0; }, 750);
    }
  };

  /* ── Fetch interception ────────────────────── */
  var pending = 0;
  var origFetch = window.fetch;
  window.fetch = function () {
    pending++;
    var badge = document.getElementById('nx-fetch-badge');
    var text  = document.getElementById('nx-badge-text');
    if (pending === 1) {
      NxBar.start();
      if (badge) badge.classList.add('nx-visible');
      if (text)  text.textContent = 'Loading data…';
    }
    return origFetch.apply(this, arguments).finally(function () {
      pending = Math.max(0, pending - 1);
      if (pending === 0) {
        NxBar.done();
        setTimeout(function () {
          var b = document.getElementById('nx-fetch-badge');
          if (b) b.classList.remove('nx-visible');
        }, 400);
      }
    });
  };

  // Also hook XMLHttpRequest for any pages using $.ajax or raw XHR
  var OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    var xhr = new OrigXHR();
    var opened = false;
    var origOpen  = xhr.open.bind(xhr);
    var origSend  = xhr.send.bind(xhr);
    xhr.open = function() { opened = true; return origOpen.apply(xhr, arguments); };
    xhr.send = function() {
      if (opened) {
        pending++;
        var badge = document.getElementById('nx-fetch-badge');
        if (pending === 1) {
          NxBar.start();
          if (badge) badge.classList.add('nx-visible');
        }
        xhr.addEventListener('loadend', function () {
          pending = Math.max(0, pending - 1);
          if (pending === 0) {
            NxBar.done();
            setTimeout(function () {
              var b = document.getElementById('nx-fetch-badge');
              if (b) b.classList.remove('nx-visible');
            }, 400);
          }
        }, { once: true });
      }
      return origSend.apply(xhr, arguments);
    };
    return xhr;
  }
  PatchedXHR.prototype = OrigXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  /* ── Nav click progress ────────────────────── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.startsWith('#') || href.startsWith('javascript') || a.target === '_blank') return;
    NxBar.start();
  });

  /* ── Expose globals ────────────────────────── */
  window.NxLoader = {
    show: function () { var l = document.getElementById('nx-loader'); if (l) l.classList.remove('nx-hidden'); },
    hide: function () { var l = document.getElementById('nx-loader'); if (l) l.classList.add('nx-hidden'); }
  };

  window.NxBar = NxBar;

  // Skeleton helper - call on any container to fill it with skeleton rows
  window.NxSkeleton = {
    rows: function (el, count) {
      if (!el) return;
      count = count || 4;
      el.innerHTML = Array.from({ length: count }, function (_, i) {
        var widths = ['w-full', 'w-3-4', 'w-1-2', 'w-full', 'w-3-4'];
        return '<div class="nx-skel row ' + widths[i % widths.length] + '"></div>';
      }).join('');
    },
    cards: function (el, count) {
      if (!el) return;
      count = count || 3;
      el.innerHTML = Array.from({ length: count }, function () {
        return '<div style="padding:20px;border:1px solid rgba(255,255,255,0.06);border-radius:14px;display:flex;flex-direction:column;gap:10px;">' +
          '<div class="nx-skel avatar" style="width:40px;height:40px;"></div>' +
          '<div class="nx-skel title w-3-4"></div>' +
          '<div class="nx-skel text w-full"></div>' +
          '<div class="nx-skel text w-1-2"></div>' +
          '<div class="nx-skel btn w-1-3" style="margin-top:4px;"></div>' +
          '</div>';
      }).join('');
    },
    table: function (el, rows, cols) {
      if (!el) return;
      rows = rows || 5; cols = cols || 4;
      el.innerHTML = Array.from({ length: rows }, function () {
        return '<tr>' + Array.from({ length: cols }, function () {
          return '<td style="padding:12px 10px;"><div class="nx-skel text w-3-4"></div></td>';
        }).join('') + '</tr>';
      }).join('');
    },
    clear: function (el) {
      if (!el) return;
      el.classList.add('nx-revealed');
    }
  };

})();

/* ── Auto-skeleton: shimmer elements showing "───" placeholder ── */
(function() {
  function autoSkel() {
    document.querySelectorAll('*').forEach(function(el) {
      // Skip script/style/input
      if (['SCRIPT','STYLE','INPUT','TEXTAREA','SELECT','A','BUTTON'].includes(el.tagName)) return;
      // Only leaf text nodes
      if (el.children.length > 0) return;
      var t = el.textContent.trim();
      if (t === '───' || t === '···' || t === '...' || t === '–' || t === 'Loading…' || t === 'Loading...') {
        el.classList.add('nx-skel');
        el.style.minWidth = el.style.minWidth || '60px';
        el.style.minHeight = el.style.minHeight || '14px';
        el.style.borderRadius = el.style.borderRadius || '4px';
        el.style.display = el.style.display || 'inline-block';
      }
    });
    // Re-run on DOM changes
    new MutationObserver(function(muts) {
      muts.forEach(function(m) {
        m.addedNodes.forEach(function(n) {
          if (n.nodeType !== 1) return;
          [n].concat(Array.from(n.querySelectorAll('*'))).forEach(function(el) {
            if (['SCRIPT','STYLE','INPUT','TEXTAREA','SELECT','A','BUTTON'].includes(el.tagName)) return;
            if (el.children.length > 0) return;
            var t = el.textContent.trim();
            if (t === '───' || t === '···' || t === 'Loading…' || t === 'Loading...') {
              el.classList.add('nx-skel');
              el.style.minWidth = el.style.minWidth || '60px';
              el.style.minHeight = el.style.minHeight || '14px';
              el.style.display = el.style.display || 'inline-block';
              el.style.borderRadius = '4px';
            }
            // Remove shimmer once real content arrives
            if (el.classList.contains('nx-skel') && t && t !== '───' && t !== '···' && t !== 'Loading…' && t !== 'Loading...') {
              el.classList.remove('nx-skel');
              el.classList.add('nx-revealed');
            }
          });
        });
        // Text replaced via textContent/innerHTML adds a text node to the element itself —
        // the loop above skips text nodes, so check the changed element here
        if (m.type === 'childList' && m.target.nodeType === 1 && m.target.classList.contains('nx-skel')) {
          var tt = m.target.textContent.trim();
          if (tt && tt !== '───' && tt !== '···' && tt !== 'Loading…' && tt !== 'Loading...') {
            m.target.classList.remove('nx-skel');
            m.target.classList.add('nx-revealed');
          }
        }
        // Also check characterData changes - when text updates, remove shimmer
        if (m.type === 'characterData') {
          var el = m.target.parentElement;
          if (el && el.classList.contains('nx-skel')) {
            var t = el.textContent.trim();
            if (t && t !== '───' && t !== '···' && t !== 'Loading…') {
              el.classList.remove('nx-skel');
              el.classList.add('nx-revealed');
            }
          }
        }
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoSkel);
  } else {
    autoSkel();
  }
})();
