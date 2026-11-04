// uwujs/userList.js
// Renders and manages the list of UwU-locked users.

let _lockedUsers = [];   // [{ userId, username, avatarUrl, lockedAt }]
let _filterQuery  = '';

/**
 * Initialise with the API data and render.
 * @param {Array} users
 */
export function initUserList(users) {
  _lockedUsers = users || [];
  updateStats();
  render();
}

export function getLockedUsers() { return _lockedUsers; }

/**
 * Optimistically add a user to the local list and re-render.
 */
export function addUserLocally(user) {
  _lockedUsers.unshift(user);
  updateStats();
  render();
}

/**
 * Remove a user by ID from the local list and re-render.
 */
export function removeUserLocally(userId) {
  _lockedUsers = _lockedUsers.filter(u => u.userId !== userId);
  updateStats();
  render();
}

export function setFilter(query) {
  _filterQuery = query.toLowerCase();
  render();
}

// ── Internal ──────────────────────────────────────────────────────────────────

function updateStats() {
  setEl('statTotal', _lockedUsers.length);
  setEl('countBadge', _lockedUsers.length);

  const today = new Date().toDateString();
  const addedToday = _lockedUsers.filter(u => {
    if (!u.lockedAt) return false;
    return new Date(u.lockedAt).toDateString() === today;
  }).length;
  setEl('statNew', addedToday);
}

function render() {
  const container = document.getElementById('userList');
  if (!container) return;

  const filtered = _filterQuery
    ? _lockedUsers.filter(u =>
        (u.username || '').toLowerCase().includes(_filterQuery) ||
        (u.userId || '').includes(_filterQuery)
      )
    : _lockedUsers;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-uwu">🐾</div>
        <div style="font-weight:700; font-size:1rem; color:#F0E4F8;">
          ${_filterQuery ? 'No matches found~' : 'No one is UwU-locked yet!'}
        </div>
        <div style="font-size:0.8rem; color:var(--muted);">
          ${_filterQuery ? 'Try a different search term OwO' : 'Click "Add UwU Lock" to uwuify someone~ >w<'}
        </div>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map((u, i) => `
    <div class="user-row" style="animation-delay:${i * 0.04}s;">
      <div class="avatar">
        ${u.avatarUrl
          ? `<img src="${esc(u.avatarUrl)}" alt="${esc(u.username)}" onerror="this.parentElement.textContent='🐾'">`
          : '🐾'}
      </div>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:700; font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${esc(u.username || 'Unknown User')}
        </div>
        <div style="font-size:0.72rem; color:var(--muted); font-family:'JetBrains Mono',monospace;">
          ${esc(u.userId)}
        </div>
      </div>
      <div class="uwu-badge">uwu locked</div>
      ${u.lockedAt
        ? `<div style="font-size:0.7rem; color:var(--muted); white-space:nowrap;">${formatDate(u.lockedAt)}</div>`
        : ''}
      <button class="btn-danger" onclick="removeUwuLock('${esc(u.userId)}')">
        Unlock
      </button>
    </div>
  `).join('');
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}