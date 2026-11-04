// ─── Helpers ──────────────────────────────────────────────────────────────────

export function stateClass(s) {
  if (s === 'operational') return 'op';
  if (s === 'degraded')    return 'deg';
  if (s === 'down')        return 'deg';
  return 'str'; // starting / unknown
}

export function badgeClass(s)  { return 'badge b-' + stateClass(s); }
export function bannerClass(s) { return 'banner '  + stateClass(s); }

export function badgeLabel(s) {
  return s === 'operational' ? 'Operational'
       : s === 'degraded'    ? 'Degraded'
       : s === 'down'        ? 'Offline'
       :                       'Starting';
}

export function bannerText(s) {
  return s === 'operational' ? 'All systems operational'
       : s === 'degraded'    ? 'Some systems are offline — investigation in progress'
       : s === 'down'        ? '⚡ Bot is offline'
       :                       'Some systems are starting and will be available soon';
}

export function pingClass(ms) {
  if (ms < 0)   return '';
  if (ms < 100) return 'good';
  if (ms < 250) return 'ok';
  return 'bad';
}