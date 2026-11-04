// statusmain.js — Main Entry Point for Status Page
// ─────────────────────────────────────────────────────────────────────────────

import { initClock }                          from './statusjs/clock.js';
import { initTheme, toggleTheme }             from './statusjs/theme.js';
import { initTooltipTracking }                from './statusjs/tooltip.js';
import { initSkeletonBars, switchUptimeTab }  from './statusjs/uptime.js';
import { drawPingChart }                      from './statusjs/chart.js';
import { toggleCard }                         from './statusjs/cards.js';
import { filterIncidents }                    from './statusjs/incidents.js';
import { fetchAll, forceRefresh }             from './statusjs/fetch.js';
import { copyLink, subscribeToAlerts }        from './statusjs/header.js';
import { state }                              from './statusjs/state.js';
import { exposeGlobals }                      from './statusjs/modules.js';

// ─── Expose globals for inline onclick= handlers in HTML ──────────────────────

window.toggleTheme        = toggleTheme;
window.copyLink           = copyLink;
window.subscribeToAlerts  = subscribeToAlerts;

window.switchTab          = switchUptimeTab;   // uptime tab switcher
window.toggleCard         = toggleCard;

window.filterIncidents    = filterIncidents;

window.forceRefresh       = forceRefresh;

// Expose renderModules + renderDash so the Simplify toggle (inline script) can
// call them for a live re-render without going through the ES module boundary.
exposeGlobals();

// ─── Boot ─────────────────────────────────────────────────────────────────────

function init() {
  // Apply saved theme before any paint
  initTheme();

  // Start live clock
  initClock();

  // Attach tooltip mouse-tracking
  initTooltipTracking();

  // Show skeleton bars immediately while data loads
  initSkeletonBars();

  // Redraw ping chart on window resize (canvas is resolution-dependent)
  window.addEventListener('resize', () => {
    if (state.pingHistory.length) drawPingChart(state.pingHistory);
  });

  // Kick off first data fetch (starts countdown, populates everything)
  fetchAll().catch(() => {
    // If the very first fetch throws entirely, show fallback bars
    import('./statusjs/uptime.js').then(({ buildFallbackBars }) => buildFallbackBars());
  });
}

init();