// countingjs/milestones.js

/** @type {number[]} */
let milestones = [];

/** Initialise from saved data (or fall back to defaults). */
export function initMilestones(saved) {
  milestones =
    saved && saved.length
      ? [...saved]
      : [10, 25, 50, 100, 250, 500, 1000];
  render();
}

export function getMilestones() {
  return [...milestones];
}

export function addMilestone() {
  const input = document.getElementById('newMilestone');
  const val   = parseInt(input.value, 10);
  if (!val || val < 1) return { error: 'Enter a valid number' };
  if (milestones.includes(val)) return { error: 'Already added' };
  milestones.push(val);
  render();
  input.value = '';
  return {};
}

export function removeMilestone(m) {
  milestones = milestones.filter(x => x !== m);
  render();
}

function render() {
  const container = document.getElementById('milestoneChips');
  if (!container) return;
  container.innerHTML = '';
  [...milestones]
    .sort((a, b) => a - b)
    .forEach(m => {
      const chip      = document.createElement('span');
      chip.className  = 'milestone-chip';
      chip.innerHTML  = `${m} <span class="remove-ms" data-m="${m}">×</span>`;
      chip
        .querySelector('.remove-ms')
        .addEventListener('click', () => removeMilestone(m));
      container.appendChild(chip);
    });
}