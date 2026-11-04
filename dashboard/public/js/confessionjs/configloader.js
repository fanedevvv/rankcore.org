// ─── Config Loader ────────────────────────────────────────────────────────────

import { cfg, setVal, setChecked, renderChips, roleLabel } from './state.js';
import { updatePreview } from './embedpreview.js';
import { setModRoles } from './modroles.js';
import { setWords, renderWordList } from './wordfilter.js';
import { setCategories, renderCategories } from './categories.js';
import { setAccessLists } from './access.js';

export async function loadConfig(guildId) {
  try {
    const data = await fetch(`/api/guild/${guildId}/confession`).then(r => r.json());
    Object.assign(cfg, data);

    // Stats
    document.getElementById('statPosted').textContent   = data.TotalPosted   ?? 0;
    document.getElementById('statDenied').textContent   = data.TotalDenied   ?? 0;
    document.getElementById('statFiltered').textContent = data.TotalFiltered ?? 0;
    document.getElementById('statCount').textContent    = `#${data.ConfessionCount ?? 0}`;

    // Status badge
    const badge = document.getElementById('systemStatus');
    if (data.ConfessionChannel) { badge.classList.remove('hidden'); badge.classList.add('flex'); }
    else                        { badge.classList.add('hidden');    badge.classList.remove('flex'); }

    // Core
    setVal('confessionChannel',  data.ConfessionChannel  || '');
    setVal('reviewChannel',      data.ReviewChannel      || '');
    setVal('logChannel',         data.LogChannel         || '');
    setVal('reportChannel',      data.ReportChannel      || '');
    setVal('reviewPingRole',     data.ReviewPingRole     || '');
    setVal('confessionPingRole', data.ConfessionPingRole || '');
    setVal('reportPingRole',     data.ReportPingRole     || '');
    setModRoles(data.ModeratorRoles || []);
    renderChips('modRoleList', data.ModeratorRoles || [], roleLabel, 'removeModRole');

    // Review
    setChecked('reviewEnabled',   data.ReviewEnabled   ?? false);
    setChecked('anonymousReview', data.AnonymousReview ?? true);
    setVal('autoApproveMin',  data.AutoApproveAfterMs ? data.AutoApproveAfterMs / 60000 : 0);
    setChecked('dmOnApprove', data.DMOnApprove ?? false);
    setChecked('dmOnDeny',    data.DMOnDeny    ?? false);

    // Embed
    setVal('confTitle',      data.ConfessionTitle  || '');
    setVal('confColor',      data.ConfessionColor  || '#5865F2');
    setVal('confFooter',     data.ConfessionFooter || '');
    setChecked('showNumber', data.ShowConfessionNumber ?? true);
    document.getElementById('confColorPicker').value = data.ConfessionColor || '#5865F2';
    updatePreview();

    // Behaviour
    setVal('cooldownSec',    data.CooldownSeconds     ?? 60);
    setVal('minLength',      data.MinConfessionLength ?? 10);
    setVal('maxLength',      data.MaxConfessionLength ?? 2000);
    setChecked('reactionsEnabled', data.ReactionsEnabled ?? true);
    setVal('reactionEmojis', (data.ReactionEmojis || ['❤️','😂','😮','😢']).join(', '));
    setChecked('threadReplies', data.ThreadReplies ?? false);

    // Filter
    setChecked('filterEnabled', data.WordFilterEnabled ?? false);
    setVal('filterAction', data.FilterAction || 'block');
    setWords(data.BlockedWords || []);
    renderWordList();

    // Categories
    setChecked('categoriesEnabled', data.CategoriesEnabled ?? false);
    setCategories(data.Categories || []);
    renderCategories();

    // Access
    setAccessLists(data.Blacklist || [], data.TrustedUsers || [], data.RequiredRoles || []);
    renderChips('blacklistList',    data.Blacklist     || [], i => i,    'removeBlacklist');
    renderChips('trustedList',      data.TrustedUsers  || [], i => i,    'removeTrusted');
    renderChips('requiredRoleList', data.RequiredRoles || [], roleLabel, 'removeRequiredRole');

  } catch(e) { console.error('loadConfig:', e); }
}