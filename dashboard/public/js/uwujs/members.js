// uwujs/members.js
// Handles fetching guild members and populating the modal user select.

let _allMembers = []; // { id, username, avatar }

export function initMembers(members) {
  _allMembers = members || [];
  populateSelect();
}

export function getAllMembers() {
  return _allMembers;
}

function populateSelect() {
  const select = document.getElementById('modalUserSelect');
  if (!select) return;

  if (!_allMembers.length) {
    select.innerHTML = '<option value="">No members found</option>';
    return;
  }

  select.innerHTML =
    '<option value="">Choose a member...</option>' +
    _allMembers
      .map(m => `<option value="${esc(m.id)}">${esc(m.username)}</option>`)
      .join('');
}

export function getMemberById(id) {
  return _allMembers.find(m => m.id === id) || null;
}

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}