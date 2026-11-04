'use strict';
import { loadTranscripts } from './transcripts.js';
import { loadStats } from './stats.js?v=2';

const TABS = ['overview','config','behaviour','embed','roles','tags','transcripts'];

export function switchTab(tab, guildId) {
  TABS.forEach(t => {
    const view = document.getElementById(`view-${t}`);
    const btn  = document.getElementById(`tab-${t}`);
    if (!view || !btn) return;
    const isActive = t === tab;
    view.style.display = isActive ? 'block' : 'none';
    if (isActive) {
      view.classList.remove('tab-active');
      void view.offsetWidth; // force reflow to restart animation
      view.classList.add('tab-active');
    } else {
      view.classList.remove('tab-active');
    }
    btn.classList.toggle('active', isActive);
  });

  if (tab === 'transcripts') loadTranscripts(guildId || location.pathname.split('/')[2]);
  if (tab === 'overview')    loadStats(guildId || location.pathname.split('/')[2]);
}

export function initTabs() {
  TABS.forEach((t, i) => {
    const view = document.getElementById(`view-${t}`);
    const btn  = document.getElementById(`tab-${t}`);
    if (view) {
      view.style.display = i === 0 ? 'block' : 'none';
      view.classList.toggle('tab-active', i === 0);
    }
    if (btn) btn.classList.toggle('active', i === 0);
  });
}