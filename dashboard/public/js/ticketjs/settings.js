'use strict';
import { showToast } from './toast.js';
import { renderCategories } from './categories.js';
import { renderTagList } from './tags.js';
import { renderRoleList } from './roleschannels.js?v=3';
import { updatePreview } from './embedpreview.js';

function setVal(id, val)       { const el = document.getElementById(id); if (el) el.value = val ?? ''; }
function setChecked(id, val)   { const el = document.getElementById(id); if (el) el.checked = !!val; }
function setText(id, val)      { const el = document.getElementById(id); if (el) el.textContent = val ?? ''; }

// Expose for inline onclick
window.updateTicketTypeFields = function() {
  try {
    const checkedRadio = document.querySelector('input[name="ticketType"]:checked');
    const type = checkedRadio?.value || 'channel';
    const channelFields = document.getElementById('channelFields');
    const threadFields = document.getElementById('threadFields');
    if (channelFields) channelFields.style.display = type === 'channel' ? 'block' : 'none';
    if (threadFields) threadFields.style.display = type === 'thread' ? 'block' : 'none';
    
    // Also highlight the selected label
    document.querySelectorAll('.tog-row').forEach(label => {
      const radio = label.querySelector('input[type="radio"]');
      if (radio && radio.checked) {
        label.style.background = 'rgba(139,92,246,.1)';
        label.style.borderColor = 'rgba(139,92,246,.4)';
      } else {
        label.style.background = 'rgba(255,255,255,.03)';
        label.style.borderColor = 'rgba(255,255,255,.05)';
      }
    });
  } catch (e) {
    console.error('updateTicketTypeFields error:', e);
  }
};

// Add click handlers for radio labels
document.addEventListener('DOMContentLoaded', function() {
  // Listen for radio changes
  document.querySelectorAll('input[name="ticketType"]').forEach(radio => {
    radio.addEventListener('change', window.updateTicketTypeFields);
  });
  // Also allow clicking the label to work
  document.querySelectorAll('.tog-row').forEach(label => {
    label.addEventListener('click', function(e) {
      if (e.target.tagName !== 'INPUT') {
        const radio = label.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          window.updateTicketTypeFields();
        }
      }
    });
  });
  // Run initial update
  window.updateTicketTypeFields();
});

export async function loadSettings(guildId) {
  try {
    const res  = await fetch(`/api/guild/${guildId}/ticket`);
    const data = await res.json();

    // Ticket Type
    const ticketType = data.TicketType || 'channel';
    const typeRadios = document.querySelectorAll('input[name="ticketType"]');
    typeRadios.forEach(r => { r.checked = r.value === ticketType; });
    window.updateTicketTypeFields();

    // Core
    setVal('panelChannel',      data.Channel      || '');
    setVal('transcriptChannel', data.Transcripts  || '');
    window.setHandlerRoles?.(data.HandlerRoles || (data.Handlers ? [data.Handlers] : []));
    setVal('urgentRole',        data.UrgentRoleId || '');
    setVal('ticketPrefix',      data.TicketPrefix || 'ticket');
    
    // Ticket Type specific
    setVal('ticketCategory', data.TicketCategory || '');
    setVal('threadChannel',   data.ThreadChannel || '');

    // Behaviour — creation
    setVal('maxTickets',          data.MaxTicketsPerUser ?? 1);
    setChecked('requireReason',   data.RequireReason     !== false);
    setChecked('mentionOnCreate', data.MentionOnCreate   !== false);

    // Behaviour — closing
    setChecked('requireCloseReason', data.RequireCloseReason !== false);
    setChecked('dmOnClose',          data.DMOnClose          !== false);
    setChecked('saveWeb',            data.SaveWebTranscript  !== false);
    setVal('closeMessage',           data.CloseMessage       || '');

    // Behaviour — auto-close
    setVal('autoCloseMin',  data.AutoCloseMinutes        || 0);
    setVal('autoCloseWarn', data.AutoCloseWarningMessage || '');

    // Behaviour — welcome
    setVal('welcomeTitle', data.WelcomeTitle   || '');
    setVal('welcomeMsg',   data.WelcomeMessage || '');

    // Behaviour — features
    setChecked('enablePriority', data.EnablePriority || false);
    setChecked('enableRating',   data.EnableRating   || false);
    setVal('ratingMessage',      data.RatingMessage  || '');
    setChecked('autoDeleteOnClose', data.AutoDeleteOnClose || false);

    // Embed
    setVal('embedTitle',  data.Title        || '');
    setVal('embedDesc',   data.Description  || '');
    setVal('embedFooter', data.FooterText   || '');
    setVal('embedThumb',  data.ThumbnailURL || '');
    setVal('embedBanner', data.BannerURL    || '');
    const color = data.Color || '#6C53FF';
    setVal('embedColorHex', color);
    const cp = document.getElementById('embedColorPicker');
    if (cp) cp.value = color;
    updatePreview();

    // Categories + Tags
    renderCategories(data.Categories || [], guildId);
    renderTagList(data.Tags || [], guildId);

    // Role lists
    renderRoleList('blacklistList',  data.BlacklistedRoles      || [], 'removeBlacklistRole');
    renderRoleList('manageRoleList', data.AdditionalManageRoles || [], 'removeManageRole');
    renderRoleList('pingRoleList',   data.PingRoles             || [], 'removePingRole');

    // Disable button
    const btn = document.getElementById('btnDisable');
    if (btn) btn.disabled = !data.Channel;

  } catch (e) { console.error('loadSettings:', e); }
}

export async function saveSettings(guildId, onSuccess) {
  const ticketType = document.querySelector('input[name="ticketType"]:checked')?.value || 'channel';
  const body = {
    TicketType: ticketType,
    Channel:      document.getElementById('panelChannel')?.value || null,
    Transcripts:  document.getElementById('transcriptChannel')?.value || null,
    HandlerRoles: window.getHandlerRoles?.() || [],
    UrgentRoleId: document.getElementById('urgentRole')?.value || null,
    TicketPrefix: document.getElementById('ticketPrefix')?.value || 'ticket',
    TicketCategory: ticketType === 'channel' ? (document.getElementById('ticketCategory')?.value || null) : null,
    ThreadChannel:  ticketType === 'thread' ? (document.getElementById('threadChannel')?.value || null) : null,
  };
  const res = await fetch(`/api/guild/${guildId}/ticket`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (res.ok) { showToast('Core settings saved'); onSuccess?.(); }
  else { const d = await res.json().catch(() => ({})); showToast(d.error || 'Save failed', 'error'); }
}

export async function saveBehaviour(guildId) {
  const body = {
    MaxTicketsPerUser:       parseInt(document.getElementById('maxTickets')?.value) || 1,
    RequireReason:           document.getElementById('requireReason')?.checked ?? true,
    MentionOnCreate:         document.getElementById('mentionOnCreate')?.checked ?? true,
    RequireCloseReason:      document.getElementById('requireCloseReason')?.checked ?? true,
    DMOnClose:               document.getElementById('dmOnClose')?.checked ?? true,
    SaveWebTranscript:       document.getElementById('saveWeb')?.checked ?? true,
    CloseMessage:            document.getElementById('closeMessage')?.value || '',
    AutoCloseMinutes:        parseInt(document.getElementById('autoCloseMin')?.value) || 0,
    AutoCloseWarningMessage: document.getElementById('autoCloseWarn')?.value || '',
    WelcomeTitle:            document.getElementById('welcomeTitle')?.value || '',
    WelcomeMessage:          document.getElementById('welcomeMsg')?.value || '',
    EnablePriority:          document.getElementById('enablePriority')?.checked ?? false,
    EnableRating:            document.getElementById('enableRating')?.checked ?? false,
    RatingMessage:           document.getElementById('ratingMessage')?.value || '',
    AutoDeleteOnClose:       document.getElementById('autoDeleteOnClose')?.checked ?? false,
  };
  const res = await fetch(`/api/guild/${guildId}/ticket`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (res.ok) showToast('Behaviour settings saved');
  else { const d = await res.json().catch(() => ({})); showToast(d.error || 'Save failed', 'error'); }
}

export async function saveEmbed(guildId) {
  const color = document.getElementById('embedColorHex')?.value || '#6C53FF';
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) return showToast('Invalid hex colour', 'error');
  const body = {
    Title:        document.getElementById('embedTitle')?.value || '',
    Description:  document.getElementById('embedDesc')?.value || '',
    FooterText:   document.getElementById('embedFooter')?.value || '',
    ThumbnailURL: document.getElementById('embedThumb')?.value || '',
    BannerURL:    document.getElementById('embedBanner')?.value || '',
    Color:        color,
  };
  const res = await fetch(`/api/guild/${guildId}/ticket`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (res.ok) showToast('Embed settings saved');
  else { const d = await res.json().catch(() => ({})); showToast(d.error || 'Save failed', 'error'); }
}

export async function deployPanel(guildId) {
  if (!confirm('Deploy the ticket panel to the configured channel?')) return;
  const btn = document.getElementById('deployBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Deploying…'; }
  try {
    const res  = await fetch(`/api/guild/${guildId}/ticket/deploy`, { method: 'POST' });
    const data = await res.json();
    if (data.success) showToast('✅ Panel deployed!');
    else showToast(data.error || 'Deploy failed', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Deploy Panel'; }
  }
}

export async function disableSystem(guildId, onSuccess) {
  if (!confirm('Disable the ticket system and delete all settings? This cannot be undone.')) return;
  const res = await fetch(`/api/guild/${guildId}/ticket`, { method: 'DELETE' });
  if (res.ok) { showToast('System disabled'); onSuccess?.(); }
  else showToast('Failed to disable', 'error');
}
