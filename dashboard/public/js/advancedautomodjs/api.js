// ─── API: load, save, defaults ────────────────────────────────────────────────
import { guildId, setRateRules, setWarnSteps, setWordGroups, setLinkGroups, setRegexRules } from './state.js';
import { v, vi, vf, vb, set, setb } from './helpers.js';
import { toast } from './toast.js';
import { renderAllConditions } from './conditions.js';
import { renderWarnSteps }     from './warnSteps.js';
import { renderWordGroups }    from './wordGroups.js';
import { renderLinkGroups }    from './linkGroups.js';
import { renderRegexRules }    from './regexRules.js';

// ─── Defaults ─────────────────────────────────────────────────────────────────
export function defaultRateRules() {
  return [
    { type: 'messages',    limit: 5,  window: 5,  action: 'warn',   muteDuration: 10 },
    { type: 'messages',    limit: 7,  window: 3,  action: 'mute',   muteDuration: 10 },
    { type: 'mentions',    limit: 5,  window: 5,  action: 'warn',   muteDuration: 10 },
    { type: 'attachments', limit: 3,  window: 5,  action: 'warn',   muteDuration: 10 },
    { type: 'emojis',      limit: 5,  window: 5,  action: 'delete', muteDuration: 10 },
    { type: 'newlines',    limit: 8,  window: 5,  action: 'warn',   muteDuration: 10 },
    { type: 'caps',        limit: 70, window: 0,  action: 'warn',   muteDuration: 10 },
    { type: 'duplicates',  limit: 3,  window: 30, action: 'warn',   muteDuration: 10 },
  ];
}

export function defaultWarnSteps() {
  return [
    { count: 2, action: 'warn', note: 'First offence' },
    { count: 3, action: 'mute', note: '10m'           },
    { count: 4, action: 'kick', note: ''              },
    { count: 5, action: 'ban',  note: ''              },
  ];
}

// ─── Log Channel Dropdown ─────────────────────────────────────────────────────
export async function loadLogChannelOptions(selectedId) {
  const sel = document.getElementById('logChannelId');
  if (!sel) return;
  try {
    let channels = window._cachedChannels;
    if (!channels) {
      const r = await fetch(`/api/guild/${guildId}/channels`);
      if (!r.ok) throw new Error('Failed to fetch channels');
      const json = await r.json();
      channels = Array.isArray(json) ? json : (json.channels ?? []);
      window._cachedChannels = channels;
    }
    sel.innerHTML = '<option value="">None</option>';
    const textChannels = channels.filter(c => c.type === 0 || c.type === undefined || c.type === 'text' || !c.type);
    textChannels.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = '#' + c.name;
      if (selectedId && c.id === selectedId) opt.selected = true;
      sel.appendChild(opt);
    });
    if (selectedId && !sel.querySelector(`option[value="${selectedId}"]`)) {
      const opt = document.createElement('option');
      opt.value       = selectedId;
      opt.textContent = selectedId;
      opt.selected    = true;
      sel.insertBefore(opt, sel.children[1]);
    }
  } catch (e) {
    console.warn('Could not load channels for log channel select:', e);
  }
}

// ─── Load ─────────────────────────────────────────────────────────────────────
export async function load() {
  try {
    const res = await fetch(`/api/guild/${guildId}/advanced-automod`);
    const d   = await res.json();

    setb('status',  d.status);
    setb('botSpam', d.detectBotSpam);
    await loadLogChannelOptions(d.logChannelId || '');

    setRateRules(d.rateRules   || defaultRateRules());
    setWarnSteps(d.warnSteps   || defaultWarnSteps());
    setWordGroups(d.wordGroups || []);
    setLinkGroups(d.linkGroups || []);
    setRegexRules(d.regexRules || []);

    // Invites
    setb('filterInvites', d.filterInvites);
    set('inviteAction', d.inviteAction || 'delete');
    set('inviteMuteDuration', d.inviteMuteDuration || 10);
    setb('allowOwnInvites', d.allowOwnInvites !== false);
    if (d.filterInvites) { document.getElementById('inviteSection').classList.remove('hidden'); document.getElementById('inviteSection').style.display = ''; }

    // Zalgo
    setb('filterZalgo', d.filterZalgo);
    set('zalgoAction', d.zalgoAction || 'delete');
    set('zalgoMuteDuration', d.zalgoMuteDuration || 10);
    set('zalgoThreshold', d.zalgoThreshold || 0.20);
    if (d.filterZalgo) { document.getElementById('zalgoSection').classList.remove('hidden'); document.getElementById('zalgoSection').style.display = ''; }

    // Mass Mention
    setb('filterMassMention', d.filterMassMention);
    set('massMentionAction', d.massMentionAction || 'delete');
    set('massMentionMuteDuration', d.massMentionMuteDuration || 10);
    if (d.filterMassMention) { document.getElementById('massMentionSection').classList.remove('hidden'); document.getElementById('massMentionSection').style.display = ''; }

    // Repeat Chars
    setb('filterRepeatChar', d.filterRepeatChar);
    set('repeatCharAction', d.repeatCharAction || 'delete');
    set('repeatCharMuteDuration', d.repeatCharMuteDuration || 10);
    set('repeatCharLimit', d.repeatCharLimit || 10);
    if (d.filterRepeatChar) { document.getElementById('repeatCharSection').classList.remove('hidden'); document.getElementById('repeatCharSection').style.display = ''; }

    // Stickers
    setb('filterStickers', d.filterStickers);
    set('stickerAction', d.stickerAction || 'delete');
    set('stickerMuteDuration', d.stickerMuteDuration || 10);
    set('stickerLimit', d.stickerLimit || 2);
    if (d.filterStickers) { document.getElementById('stickersSection').classList.remove('hidden'); document.getElementById('stickersSection').style.display = ''; }

    // Spoilers
    setb('filterSpoilers', d.filterSpoilers);
    set('spoilerAction', d.spoilerAction || 'delete');
    set('spoilerMuteDuration', d.spoilerMuteDuration || 10);
    set('spoilerLimit', d.spoilerLimit || 5);
    if (d.filterSpoilers) { document.getElementById('spoilersSection').classList.remove('hidden'); document.getElementById('spoilersSection').style.display = ''; }

    renderAllConditions();
    renderWarnSteps();
    renderWordGroups();
    renderLinkGroups();
    renderRegexRules();

  } catch (err) {
    console.error(err);
    toast('Failed to load config', true);
  }
}

// ─── Save ─────────────────────────────────────────────────────────────────────
export async function save() {
  // Import state arrays at call-time so we always get the live values
  const { rateRules, warnSteps, wordGroups, linkGroups, regexRules } = await import('./state.js');
  try {
    const body = {
      status:        vb('status'),
      detectBotSpam: vb('botSpam'),
      logChannelId:  v('logChannelId') || null,
      rateRules,
      warnSteps,
      wordGroups,
      linkGroups,
      regexRules,
      // Invites
      filterInvites:      vb('filterInvites'),
      inviteAction:       v('inviteAction'),
      inviteMuteDuration: vi('inviteMuteDuration') || 10,
      allowOwnInvites:    vb('allowOwnInvites'),
      // Zalgo
      filterZalgo:        vb('filterZalgo'),
      zalgoAction:        v('zalgoAction'),
      zalgoMuteDuration:  vi('zalgoMuteDuration') || 10,
      zalgoThreshold:     vf('zalgoThreshold') || 0.20,
      // Mass mention
      filterMassMention:       vb('filterMassMention'),
      massMentionAction:       v('massMentionAction'),
      massMentionMuteDuration: vi('massMentionMuteDuration') || 10,
      // Repeat chars
      filterRepeatChar:       vb('filterRepeatChar'),
      repeatCharAction:       v('repeatCharAction'),
      repeatCharMuteDuration: vi('repeatCharMuteDuration') || 10,
      repeatCharLimit:        vi('repeatCharLimit') || 10,
      // Stickers
      filterStickers:      vb('filterStickers'),
      stickerAction:       v('stickerAction'),
      stickerMuteDuration: vi('stickerMuteDuration') || 10,
      stickerLimit:        vi('stickerLimit') || 2,
      // Spoilers
      filterSpoilers:      vb('filterSpoilers'),
      spoilerAction:       v('spoilerAction'),
      spoilerMuteDuration: vi('spoilerMuteDuration') || 10,
      spoilerLimit:        vi('spoilerLimit') || 5,
    };
    const res = await fetch(`/api/guild/${guildId}/advanced-automod`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    res.ok ? toast('AutoMod settings saved ✓') : toast('Failed to save', true);
  } catch (err) {
    console.error(err);
    toast('Network error', true);
  }
}