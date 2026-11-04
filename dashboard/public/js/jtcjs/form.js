/**
 * jtc/form.js
 * Form state management:
 *   applyConfig   — write a saved config object into all form fields
 *   collectPayload — read all form fields into a plain object ready to POST
 *   validatePayload — return an error string or null
 */

import { el }                                       from './utils.js';
import { syncLimit, syncBitrate }                   from './sliders.js';
import { togglePanelOptions, toggleLogOptions,
         toggleWelcomeOptions, watchPanelDest }      from './toggles.js?v=3';
import { updatePreview }                             from './naming.js';

// ── Helpers ────────────────────────────────────────────────────

const gv  = id        => el(id)?.value   ?? '';
const gc  = id        => el(id)?.checked ?? false;
const gi  = (id, def) => parseInt(el(id)?.value) || (def ?? 0);
const set = (id, val) => { const e = el(id); if (e && val != null) e.value = val; };
const setChk = (id, val) => { const e = el(id); if (e) e.checked = !!val; };

// ── Apply ──────────────────────────────────────────────────────

/**
 * Populate every form field from a config document returned by the API.
 * @param {object} cfg
 */
export function applyConfig(cfg) {
  // Basic selects / inputs
  set('channel',        cfg.Channel        || '');
  set('category',       cfg.Category       || '');
  set('nameTemplate',   cfg.NameTemplate   || "{username}'s Channel");
  set('dupStrategy',    cfg.DupStrategy    || 'number');
  set('gracePeriod',    cfg.GracePeriod    ?? 0);
  set('maxLifetime',    cfg.MaxLifetime    ?? 0);
  set('bitrateSlider',  cfg.Bitrate        ?? 64);
  set('videoQuality',   cfg.VideoQuality   || 'auto');
  set('regionOverride', cfg.RegionOverride || '');
  set('requiredRole',   cfg.RequiredRole   || '');
  set('blacklistRole',  cfg.BlacklistRole  || '');
  set('panelDest',      cfg.PanelDest      || 'dm');
  set('panelChannel',   cfg.PanelChannel   || '');
  set('welcomeMsg',     cfg.WelcomeMessage || '');
  set('logChannel',     cfg.LogChannel     || '');

  // Checkboxes — core
  setChk('inherit',       cfg.InheritPermissions ?? true);
  setChk('ownerManage',   cfg.OwnerManage        ?? true);
  setChk('allowLock',     cfg.AllowLock          ?? true);
  setChk('onePerUser',    cfg.OnePerUser         ?? true);
  setChk('deleteEmpty',   cfg.DeleteWhenEmpty    ?? true);
  setChk('blockBots',     cfg.BlockBots          ?? true);

  // Checkboxes — features
  setChk('panelEnabled',   cfg.PanelEnabled   ?? false);
  setChk('welcomeEnabled', cfg.WelcomeEnabled ?? false);
  setChk('logEnabled',     cfg.LogEnabled     ?? false);

  // Panel buttons
  setChk('btnLock',     cfg.PanelButtons?.lock     ?? true);
  setChk('btnHide',     cfg.PanelButtons?.hide     ?? true);
  setChk('btnRename',   cfg.PanelButtons?.rename   ?? true);
  setChk('btnLimit',    cfg.PanelButtons?.limit    ?? true);
  setChk('btnKick',     cfg.PanelButtons?.kick     ?? false);
  setChk('btnTransfer', cfg.PanelButtons?.transfer ?? false);
  setChk('btnDelete',   cfg.PanelButtons?.delete   ?? false);

  // Log events
  setChk('logCreate', cfg.LogEvents?.create ?? true);
  setChk('logDelete', cfg.LogEvents?.delete ?? true);
  setChk('logRename', cfg.LogEvents?.rename ?? false);
  setChk('logLock',   cfg.LogEvents?.lock   ?? false);

  // Sliders (also updates display labels)
  syncLimit(cfg.VoiceLimit ?? 0);
  syncBitrate(cfg.Bitrate  ?? 64);

  // Re-apply conditional section visibility
  togglePanelOptions();
  watchPanelDest();
  toggleLogOptions();
  toggleWelcomeOptions();

  // Refresh name preview
  updatePreview();

  // Stats row
  const statChannels = el('statChannels');
  const statUsers    = el('statUsers');
  if (statChannels) statChannels.textContent = cfg._activeChannels ?? 0;
  if (statUsers)    statUsers.textContent    = cfg._totalSessions  ?? 0;
}

// ── Collect ────────────────────────────────────────────────────

/**
 * Read every form field and return a payload object ready to POST.
 * @param {string} guildId
 * @returns {object}
 */
export function collectPayload(guildId) {
  return {
    Guild:              guildId,
    Channel:            gv('channel'),
    Category:           gv('category'),
    VoiceLimit:         gi('limit', 0),
    InheritPermissions: gc('inherit'),
    OwnerManage:        gc('ownerManage'),
    AllowLock:          gc('allowLock'),
    OnePerUser:         gc('onePerUser'),
    DeleteWhenEmpty:    gc('deleteEmpty'),
    BlockBots:          gc('blockBots'),
    NameTemplate:       gv('nameTemplate') || "{username}'s Channel",
    DupStrategy:        gv('dupStrategy'),
    GracePeriod:        Math.min(300,  gi('gracePeriod',  0)),
    MaxLifetime:        Math.min(1440, gi('maxLifetime',   0)),
    RequiredRole:       gv('requiredRole'),
    BlacklistRole:      gv('blacklistRole'),
    PanelEnabled:       gc('panelEnabled'),
    PanelDest:          gv('panelDest'),
    PanelChannel:       gv('panelChannel'),
    PanelButtons: {
      lock:     gc('btnLock'),
      hide:     gc('btnHide'),
      rename:   gc('btnRename'),
      limit:    gc('btnLimit'),
      kick:     gc('btnKick'),
      transfer: gc('btnTransfer'),
      delete:   gc('btnDelete'),
    },
    WelcomeEnabled:  gc('welcomeEnabled'),
    WelcomeMessage:  gv('welcomeMsg'),
    LogEnabled:      gc('logEnabled'),
    LogChannel:      gv('logChannel'),
    LogEvents: {
      create: gc('logCreate'),
      delete: gc('logDelete'),
      rename: gc('logRename'),
      lock:   gc('logLock'),
    },
    Bitrate:         parseInt(el('bitrateSlider')?.value) || 64,
    VideoQuality:    gv('videoQuality'),
    RegionOverride:  gv('regionOverride'),
  };
}

// ── Validate ───────────────────────────────────────────────────

/**
 * Validate a collected payload before sending.
 * @param {object} payload
 * @returns {string|null} Error message, or null if valid.
 */
export function validatePayload(payload) {
  if (!payload.Channel)                   return 'Please select a trigger voice channel.';
  if (!payload.Category)                  return 'Please select a target category.';
  if (!payload.NameTemplate?.trim())      return 'Channel name template cannot be empty.';
  if (payload.NameTemplate.length > 100)  return 'Name template exceeds 100 characters.';
  if (payload.GracePeriod  > 300)         return 'Grace period cannot exceed 300 seconds.';
  if (payload.MaxLifetime  > 1440)        return 'Max lifetime cannot exceed 1440 minutes (24 h).';
  return null;
}