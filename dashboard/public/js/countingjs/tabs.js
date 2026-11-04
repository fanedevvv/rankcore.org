// countingjs/tabs.js

import { loadLeaderboard } from './leaderboard.js';
import { loadHistory }     from './history.js';

export function initTabs() {
  // Activate first tab on load — already handled by HTML default class,
  // but we wire the data-load hooks here.
}

export function switchTab(name, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');

  if (name === 'leaderboard') loadLeaderboard();
  if (name === 'history')     loadHistory();
}