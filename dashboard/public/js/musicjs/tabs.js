/**
 * music/js/tabs.js
 * Tab switching: Queue | Lyrics | History
 */

import { el } from './utils.js';

const TABS = ['queue', 'lyrics', 'history'];

export function switchTab(name) {
  TABS.forEach(t => {
    const pane = el(`content-${t}`);
    const btn  = el(`tab-${t}`);
    const active = t === name;

    if (pane) pane.classList.toggle('hidden', !active);

    if (btn) {
      if (active) {
        btn.className = 'px-5 py-2 rounded-lg text-sm font-bold transition-all bg-razor text-white shadow-lg shadow-razor/20';
      } else {
        btn.className = 'px-5 py-2 rounded-lg text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all';
      }
    }
  });
}

export function activeTab() {
  return TABS.find(t => !el(`content-${t}`)?.classList.contains('hidden')) || 'queue';
}