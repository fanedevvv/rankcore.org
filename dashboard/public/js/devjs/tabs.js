// devjs/tabs.js

export function switchTab(group, tab, el) {
  // Find the nearest card/section ancestor
  const container = el.closest('.card') || el.closest('.section') || el.closest('[id^="panel-"]');

  // Deactivate all subtab content panes and tab buttons within this container
  if (container) {
    container.querySelectorAll('.subtab-content').forEach(t => t.classList.remove('active'));
    container.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
  }

  // Activate the clicked tab button and the target content pane
  el.classList.add('active');
  const target = document.getElementById(`${group}-tab-${tab}`);
  if (target) target.classList.add('active');
}