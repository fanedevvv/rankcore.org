// devjs/modulelock.js — Locks the Web Dashboard module card in the Modules panel
// (dashboard is managed by PM2, not by the bot's ModuleManager)

(function() {
  const DASH_NAME = 'dashboard';

  function lockDashboardCard() {
    const list = document.getElementById('modules-list');
    if (!list) return;

    list.querySelectorAll('[data-module], .card, [class*="mod"]').forEach(card => {
      const isMatch =
        card.dataset?.module === DASH_NAME ||
        card.querySelector?.('[data-module]')?.dataset?.module === DASH_NAME ||
        /web dashboard/i.test(card.textContent?.substring(0, 200));

      if (!isMatch || card.dataset.dashLocked) return;
      card.dataset.dashLocked = '1';

      card.querySelectorAll('button').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.35';
        btn.style.cursor  = 'not-allowed';
        btn.style.pointerEvents = 'none';
        btn.title = 'Web Dashboard is managed by PM2 — use `pm2 restart dashboard` instead';
        btn.addEventListener('click', e => { e.stopImmediatePropagation(); e.preventDefault(); }, true);
      });

      const notice = document.createElement('div');
      notice.style.cssText = 'font-size:0.62rem;color:var(--muted);font-family:var(--mono);padding:6px 0 0;display:flex;align-items:center;gap:5px;';
      notice.innerHTML = '<svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Managed by PM2 — use <code style="background:rgba(255,255,255,0.06);padding:1px 5px;border-radius:4px">pm2 restart dashboard</code>';
      const btnRow = card.querySelector('[style*="display:flex"], .btn-2col, [class*="actions"]');
      if (btnRow) btnRow.after(notice);
      else card.appendChild(notice);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    lockDashboardCard();
    const observer = new MutationObserver(() => lockDashboardCard());
    const target = document.getElementById('modules-list') || document.body;
    observer.observe(target, { childList: true, subtree: true });
  });
})();