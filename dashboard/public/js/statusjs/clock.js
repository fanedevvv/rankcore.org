// statusjs/clock.js — Live clock + auto-refresh countdown ring
// ─────────────────────────────────────────────────────────────────────────────

import { state, REFRESH_INTERVAL } from './state.js';

// ── Live clock ────────────────────────────────────────────────────────────────

function updateClock() {
  const el = document.getElementById('clock');
  if (el) {
    el.textContent = new Date().toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }
}

export function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

// ── Countdown ring ────────────────────────────────────────────────────────────
// Caller passes a `onExpire` callback (fetchAll) to avoid circular imports.

export function startCountdown(onExpire) {
  state.countdownSec = REFRESH_INTERVAL;

  const ring = document.getElementById('countdown-ring');
  const num  = document.getElementById('countdown-num');
  const circ = 2 * Math.PI * 7; // r=7 in the SVG

  clearInterval(state.refreshTimer);

  state.refreshTimer = setInterval(() => {
    state.countdownSec--;

    if (ring) {
      ring.style.strokeDashoffset = (
        circ * (1 - state.countdownSec / REFRESH_INTERVAL)
      ).toString();
    }
    if (num) num.textContent = state.countdownSec;

    if (state.countdownSec <= 0) onExpire();
  }, 1000);
}