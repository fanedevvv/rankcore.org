// ─── Main Entry Point ─────────────────────────────────────────────────────────

import { switchTab }                                      from './confessionjs/tabs.js';
import { loadChannels, loadRoles }                        from './confessionjs/state.js';
import { updatePreview, syncEmbedColor }                  from './confessionjs/embedpreview.js';
import { addModRole, removeModRole }                      from './confessionjs/modroles.js';
import { addWords, removeWord }                           from './confessionjs/wordfilter.js';
import { addCategory, removeCategory }                    from './confessionjs/categories.js';
import { addBlacklist, removeBlacklist,
         addTrusted, removeTrusted,
         addRequiredRole, removeRequiredRole,
         saveRequiredRoles }                              from './confessionjs/access.js';
import { saveCore, saveReview, saveEmbed,
         saveBehaviour, saveFilter,
         resetStats, resetSystem }                        from './confessionjs/savehandlers.js';
import { loadConfig }                                     from './confessionjs/configloader.js';

const guildId = location.pathname.split('/')[2];
const reload  = () => loadConfig(guildId);

// ─── Expose globals for inline onclick handlers ───────────────────────────────

window.switchTab       = switchTab;
window.updatePreview   = updatePreview;
window.syncEmbedColor  = syncEmbedColor;

window.addModRole      = addModRole;
window.removeModRole   = removeModRole;

window.addWords        = () => addWords(guildId);
window.removeWord      = (w) => removeWord(guildId, w);

window.addCategory     = () => addCategory(guildId);
window.removeCategory  = (l) => removeCategory(guildId, l);

window.addBlacklist    = () => addBlacklist(guildId);
window.removeBlacklist = (id) => removeBlacklist(guildId, id);
window.addTrusted      = () => addTrusted(guildId);
window.removeTrusted   = (id) => removeTrusted(guildId, id);
window.addRequiredRole  = addRequiredRole;
window.removeRequiredRole = removeRequiredRole;
window.saveRequiredRoles = () => saveRequiredRoles(guildId);

window.saveCore        = () => saveCore(guildId);
window.saveReview      = () => saveReview(guildId);
window.saveEmbed       = () => saveEmbed(guildId);
window.saveBehaviour   = () => saveBehaviour(guildId);
window.saveFilter      = () => saveFilter(guildId);
window.resetStats      = () => resetStats(guildId);
window.resetSystem     = () => resetSystem(guildId, reload);

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function init() {
  await Promise.all([loadChannels(guildId), loadRoles(guildId)]);
  await loadConfig(guildId);
}

init();