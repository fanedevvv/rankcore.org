// statusjs/state.js — Shared mutable state
// ─────────────────────────────────────────────────────────────────────────────

export const state = {
  historyData:    null,
  statusData:     null,
  incidentsData:  [],
  incidentFilter: 'all',
  pingHistory:    [],   // last 48 ping values for chart
  refreshTimer:   null,
  countdownSec:   30,
};

export const REFRESH_INTERVAL = 30;