// consent-popup.js — First-visit terms & privacy consent modal
// ─────────────────────────────────────────────────────────────────────────────
// Shows once per browser when the user hasn't acknowledged the current terms
// version. Re-shows if the version key changes (e.g. after IP verification
// section was added in March 2026 → version bumped to "2").
// Stored in localStorage as noxx_consent_v2 = "1".
// Skips on /login, /tos, /privacy pages (user is already reading terms).
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  const CONSENT_KEY    = 'noxx_consent_v2';
  const SKIP_PATHS     = ['/login', '/tos', '/privacy', '/callback'];
  const PREV_KEY       = 'noxx_consent_v1'; // old key — detect "updated" state

  // Don't run on legal/login pages
  if (SKIP_PATHS.some(p => location.pathname.startsWith(p))) return;

  // Already accepted current version
  if (localStorage.getItem(CONSENT_KEY) === '1') return;

  const isUpdate = localStorage.getItem(PREV_KEY) === '1';

  const CSS = `
    #ncp-overlay{
      position:fixed;inset:0;z-index:99999;
      background:rgba(0,0,0,.75);backdrop-filter:blur(8px);
      display:flex;align-items:center;justify-content:center;
      padding:1rem;animation:ncpFadeIn .2s ease both;
      overflow-y:auto;-webkit-overflow-scrolling:touch;
    }
    @keyframes ncpFadeIn{from{opacity:0}to{opacity:1}}
    #ncp-modal{
      background:#0d0d1c;border:1px solid rgba(108,83,255,.25);
      border-radius:1.25rem;padding:2rem;
      max-width:520px;width:100%;box-sizing:border-box;
      margin:auto;
      box-shadow:0 24px 80px rgba(0,0,0,.7),0 0 0 1px rgba(108,83,255,.1);
      animation:ncpSlide .25s ease both;
    }
    @keyframes ncpSlide{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
    #ncp-modal *{box-sizing:border-box;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
    .ncp-brand{display:flex;align-items:center;gap:.55rem;margin-bottom:1.5rem}
    .ncp-logo{
      width:32px;height:32px;border-radius:.55rem;
      background:linear-gradient(135deg,#6C53FF,#8b6fff);
      display:grid;place-items:center;flex-shrink:0;
    }
    .ncp-logo svg{color:#fff}
    .ncp-brand-name{font-weight:800;font-size:.95rem;color:#e4e4f0}
    .ncp-brand-sub{font-size:.68rem;color:#5a5a7a;margin-top:1px}
    .ncp-tag{
      display:inline-flex;align-items:center;gap:.35rem;
      background:${isUpdate?'rgba(245,158,11,.1)':'rgba(108,83,255,.1)'};
      border:1px solid ${isUpdate?'rgba(245,158,11,.25)':'rgba(108,83,255,.25)'};
      border-radius:99px;padding:.22rem .7rem;
      font-size:.65rem;font-weight:700;
      color:${isUpdate?'#f59e0b':'#8b6fff'};
      margin-bottom:.85rem;display:inline-flex;
    }
    .ncp-title{font-size:1.2rem;font-weight:800;color:#e4e4f0;margin-bottom:.4rem;line-height:1.3}
    .ncp-intro{font-size:.8rem;color:#5a5a7a;line-height:1.7;margin-bottom:1.25rem}
    .ncp-cards{display:flex;flex-direction:column;gap:.55rem;margin-bottom:1.5rem}
    .ncp-card{
      display:flex;align-items:flex-start;gap:.65rem;
      background:#111120;border:1px solid rgba(255,255,255,.06);
      border-radius:.65rem;padding:.75rem;
    }
    .ncp-card-icon{
      width:28px;height:28px;border-radius:.4rem;
      display:grid;place-items:center;flex-shrink:0;
    }
    .ncp-card-icon.shield {background:rgba(96,165,250,.1); border:1px solid rgba(96,165,250,.2)}
    .ncp-card-icon.eye    {background:rgba(52,211,153,.1);  border:1px solid rgba(52,211,153,.2)}
    .ncp-card-icon.ip     {background:rgba(108,83,255,.12); border:1px solid rgba(108,83,255,.25)}
    .ncp-card h4{font-size:.78rem;font-weight:700;color:#e4e4f0;margin-bottom:.15rem}
    .ncp-card p {font-size:.71rem;color:#5a5a7a;line-height:1.6;margin:0}
    .ncp-card p a{color:#8b6fff;text-decoration:none}
    .ncp-card p a:hover{text-decoration:underline}
    .ncp-card.highlight{border-color:rgba(108,83,255,.3);background:rgba(108,83,255,.06)}
    .ncp-divider{height:1px;background:rgba(255,255,255,.06);margin:1.25rem 0}
    .ncp-checkbox-row{display:flex;align-items:flex-start;gap:.6rem;margin-bottom:1.25rem;cursor:pointer}
    .ncp-checkbox-row input[type=checkbox]{
      width:16px;height:16px;flex-shrink:0;margin-top:2px;
      accent-color:#6C53FF;cursor:pointer;
    }
    .ncp-checkbox-label{font-size:.75rem;color:#8080a0;line-height:1.6;cursor:pointer}
    .ncp-checkbox-label a{color:#8b6fff;text-decoration:none}
    .ncp-checkbox-label a:hover{text-decoration:underline}
    .ncp-actions{display:flex;gap:.6rem}
    .ncp-btn-read{
      flex:1;padding:.55rem .75rem;border-radius:.55rem;
      background:transparent;border:1px solid rgba(255,255,255,.1);
      color:#8080a0;font-size:.78rem;font-weight:600;cursor:pointer;
      transition:all .15s;font-family:inherit;text-decoration:none;
      display:flex;align-items:center;justify-content:center;gap:.35rem;
    }
    .ncp-btn-read:hover{border-color:rgba(255,255,255,.2);color:#e4e4f0;background:rgba(255,255,255,.04)}
    .ncp-btn-agree{
      flex:2;padding:.55rem .75rem;border-radius:.55rem;
      background:linear-gradient(135deg,#6C53FF,#8b6fff);
      border:none;color:#fff;font-size:.78rem;font-weight:700;
      cursor:pointer;transition:all .15s;font-family:inherit;
      opacity:.4;pointer-events:none;
    }
    .ncp-btn-agree.enabled{opacity:1;pointer-events:auto}
    .ncp-btn-agree.enabled:hover{filter:brightness(1.1);transform:translateY(-1px)}
    .ncp-btn-agree.enabled:active{transform:none;filter:none}
    .ncp-footer{margin-top:1rem;text-align:center;font-size:.65rem;color:#3a3a5a;line-height:1.6}
    @media (max-width:480px){
      #ncp-overlay{padding:.75rem;align-items:flex-start}
      #ncp-modal{padding:1.25rem;border-radius:1rem}
      .ncp-brand{margin-bottom:1rem}
      .ncp-title{font-size:1.1rem}
      .ncp-card p{font-size:.75rem}
      .ncp-checkbox-label{font-size:.8rem}
      .ncp-checkbox-row input[type=checkbox]{width:20px;height:20px}
      .ncp-actions{flex-direction:column-reverse}
      .ncp-btn-read,.ncp-btn-agree{flex:none;width:100%;min-height:44px;font-size:.85rem}
    }
  `;

  function render() {
    // Inject styles
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // Build modal HTML
    const overlay = document.createElement('div');
    overlay.id = 'ncp-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'ncp-title');

    overlay.innerHTML = `
      <div id="ncp-modal">
        <div class="ncp-brand">
          <div class="ncp-logo">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
          <div>
            <div class="ncp-brand-name">RankCore</div>
            <div class="ncp-brand-sub">Dashboard</div>
          </div>
        </div>

        <div class="ncp-tag">
          <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            ${isUpdate
              ? '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
              : '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'}
          </svg>
          ${isUpdate ? 'Terms &amp; Privacy Updated — March 2026' : 'Before you continue'}
        </div>

        <h2 class="ncp-title" id="ncp-title">
          ${isUpdate ? 'We&rsquo;ve updated our terms' : 'Welcome to RankCore'}
        </h2>
        <p class="ncp-intro">
          ${isUpdate
            ? 'We added a new <strong style="color:#8b6fff">IP Verification</strong> section to our Terms of Service and Privacy Policy. Please review the key changes below before continuing.'
            : 'To use the RankCore dashboard, please review and accept our Terms of Service and Privacy Policy. Key points are summarised below.'}
        </p>

        <div class="ncp-cards">
          <div class="ncp-card">
            <div class="ncp-card-icon shield">
              <svg width="13" height="13" fill="none" stroke="#60a5fa" stroke-width="2" viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <div>
              <h4>Terms of Service</h4>
              <p>By using RankCore you agree to our usage policies, community standards, and enforcement rules. Access is a privilege that can be revoked. <a href="/tos" target="_blank">Read full Terms &rarr;</a></p>
            </div>
          </div>

          <div class="ncp-card">
            <div class="ncp-card-icon eye">
              <svg width="13" height="13" fill="none" stroke="#34d399" stroke-width="2" viewBox="0 0 24 24">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <div>
              <h4>Privacy Policy</h4>
              <p>We collect Discord User IDs, command metadata, and dashboard telemetry. We never sell your data. Data minimisation is our default. <a href="/privacy" target="_blank">Read full Policy &rarr;</a></p>
            </div>
          </div>

          <div class="ncp-card highlight">
            <div class="ncp-card-icon ip">
              <svg width="13" height="13" fill="none" stroke="#8b6fff" stroke-width="2" viewBox="0 0 24 24">
                <path d="M5 12.55a11 11 0 0114.08 0"/>
                <path d="M1.42 9a16 16 0 0121.16 0"/>
                <path d="M8.53 16.11a6 6 0 016.95 0"/>
                <line x1="12" y1="20" x2="12.01" y2="20"/>
              </svg>
            </div>
            <div>
              <h4>IP Verification — New in March 2026</h4>
              <p>If a server you join uses IP Verification, your IP address will be collected <strong style="color:#c4b5fd">only with your explicit consent</strong>. It is AES-256 encrypted, never shown to admins in plaintext, and you have the right to request deletion. <a href="/privacy#s7" target="_blank">See full details &rarr;</a></p>
            </div>
          </div>
        </div>

        <label class="ncp-checkbox-row" for="ncp-check">
          <input type="checkbox" id="ncp-check"/>
          <span class="ncp-checkbox-label">
            I have read and agree to the <a href="/tos" target="_blank">Terms of Service</a> and
            <a href="/privacy" target="_blank">Privacy Policy</a>, including the IP Verification
            data collection practices described in <a href="/privacy#s7" target="_blank">Section 07</a>.
          </span>
        </label>

        <div class="ncp-actions">
          <a href="/tos" target="_blank" class="ncp-btn-read">
            <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>
            Read Terms
          </a>
          <button class="ncp-btn-agree" id="ncp-agree" disabled>
            I Understand &amp; Agree
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="margin-left:.3rem;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
        </div>

        <p class="ncp-footer">
          Your consent is stored locally in your browser. It is never transmitted to our servers.<br>
          Withdrawing consent: stop using RankCore and contact support@rankcore.org.
        </p>
      </div>`;

    document.body.appendChild(overlay);

    // Wire up checkbox → button
    const checkbox = overlay.querySelector('#ncp-check');
    const agreeBtn = overlay.querySelector('#ncp-agree');

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        agreeBtn.disabled = false;
        agreeBtn.classList.add('enabled');
      } else {
        agreeBtn.disabled = true;
        agreeBtn.classList.remove('enabled');
      }
    });

    agreeBtn.addEventListener('click', () => {
      if (!checkbox.checked) return;
      localStorage.setItem(CONSENT_KEY, '1');
      // Fade out and remove
      overlay.style.transition = 'opacity .2s';
      overlay.style.opacity    = '0';
      setTimeout(() => { overlay.remove(); style.remove(); }, 220);
    });

    // Trap focus inside modal for accessibility
    const focusable = overlay.querySelectorAll('a,button,input,[tabindex]');
    const first = focusable[0], last = focusable[focusable.length - 1];
    overlay.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
    });
    // Auto-focus the checkbox
    setTimeout(() => checkbox.focus(), 300);
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();