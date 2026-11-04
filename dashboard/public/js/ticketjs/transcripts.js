'use strict';
import { showToast } from './toast.js';

export async function loadTranscripts(guildId) {
  const list = document.getElementById('transcriptList');
  if (!list) return;
  list.innerHTML = `<tr><td colspan="7" class="tbl-empty">Loading…</td></tr>`;
  try {
    const res  = await fetch(`/api/guild/${guildId}/transcripts`);
    const data = await res.json();
    if (!data.length) {
      list.innerHTML = `<tr><td colspan="7" class="tbl-empty">No transcripts saved yet.</td></tr>`;
      return;
    }
    list.innerHTML = data.map(t => {
      const stars = t.Rating ? '⭐'.repeat(t.Rating) : '—';
      const date  = t.ClosedAt ? new Date(t.ClosedAt).toLocaleDateString() : '—';
      return `
        <tr>
          <td class="tbl-mono">#${t.TicketID}</td>
          <td class="tbl-bold">${t.ChannelName || '—'}</td>
          <td>${t.OpenedBy?.username || 'Unknown'}</td>
          <td>${t.ClosedBy?.username || 'Unknown'}</td>
          <td class="tbl-mono">${date}</td>
          <td>${stars}</td>
          <td class="tbl-actions">
            <a href="/guild/${guildId}/transcripts/${t.TicketID}" target="_blank" class="tbl-btn tbl-btn-view">View</a>
            <button onclick="deleteTranscript('${t.TicketID}')" class="tbl-btn tbl-btn-del">Delete</button>
          </td>
        </tr>`;
    }).join('');
  } catch {
    list.innerHTML = `<tr><td colspan="7" class="tbl-empty tbl-err">Failed to load transcripts.</td></tr>`;
  }
}

export async function deleteTranscript(guildId, id, onSuccess) {
  if (!confirm('Permanently delete this transcript?')) return;
  const res = await fetch(`/api/guild/${guildId}/transcripts/${id}`, { method: 'DELETE' });
  if (res.ok) { showToast('Transcript deleted'); onSuccess?.(); }
  else showToast('Delete failed', 'error');
}
