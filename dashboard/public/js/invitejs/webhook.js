// ─── Webhooks ─────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function loadWebhooks(guildId, channelId, selectedId = null) {
  const sel = document.getElementById('webhookSelect');
  if (!sel) return;

  if (!channelId) {
    sel.innerHTML = `<option value="">Select a channel first</option>`;
    return;
  }

  try {
    const res = await fetch(`/api/guild/${guildId}/channel/${channelId}/webhooks`);
    const whs = await res.json();

    if (!whs.length) {
      sel.innerHTML = `<option value="">No webhooks in this channel</option>`;
      return;
    }

    sel.innerHTML = whs
      .map(wh =>
        `<option value="${escapeHtml(wh.id)}" ${wh.id === selectedId ? 'selected' : ''}>${escapeHtml(wh.name)}</option>`
      ).join('');
  } catch {
    sel.innerHTML = `<option value="">Failed to load webhooks</option>`;
  }
}