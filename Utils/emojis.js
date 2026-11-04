/**
 * emojis.js — Central custom emoji registry for Roco bot
 *
 * All custom Discord emojis are defined here for easy management.
 * Import with:  const E = require('../../Utils/emojis');
 * Usage:        `${E.tick} Action completed!`
 *               `.setEmoji(E.obj.add)` for button setEmoji calls
 */

// ─────────────────────────────────────────────────────────────────────────────
// TEXT EMOJIS — use these inside message content / embeds
// ─────────────────────────────────────────────────────────────────────────────

const E = {
  // ── Status ──────────────────────────────────────────────────────────────
  tick:        '<a:tickyy:1555544712687915008>',
  cross:       '<:crossy:1555544390221562048>',
  crossAnim:   '<a:crossyy:1555544703364243467>',
  error:       '<:error:1555544434601369620>',
  warning:     '<:error:1555544434601369620>',
  info:        '<:n_info:1555544473008873565>',
  loading:     '<:n_loading:1555544489194688623>',
  loadingAnim: '<a:404_loading:1555544683030122496>',
  loadingAnim2:'<a:88094loading:1555544690219286548>',
  dot:         '<:dot:1555544412300378243>',

  // ── Status dots (LED style) ──────────────────────────────────────────────
  // LE = Left End, ME = Middle, RE = Right End
  // LF = Left Fill, MF = Middle Fill, RF = Right Fill
  // green/red variants
  LEgreen:     '<:LEgreen:1555544256356159600>',
  LEred:       '<:LEred:1555544262123323422>',
  LFgreen:     '<:LFgreen:1555544269044060200>',
  LFred:       '<:LFred:1555544274412769410>',
  MEgreen:     '<:MEgreen:1555544279894462494>',
  MEred:       '<:MEred:1555544284764053556>',
  MFgreen:     '<:MFgreen:1555544290430558358>',
  MFred:       '<:MFred:1555544295556124714>',
  REgreen:     '<:REgreen:1555544308118200371>',
  REred:       '<:REred:1555544313683902554>',
  RFgreen:     '<:RFgreen:1555544319035711508>',
  RFred:       '<:RFred:1555544324681244713>',

  enabled:     '<:LEgreen:1555544256356159600>',
  disabled:    '<:LEred:1555544262123323422>',

  // ── People / roles ───────────────────────────────────────────────────────
  user:        '<:user:1555544664155889668>',
  admin:       '<:n_admin:1555544340611207168>',
  owner:       '<:owner:1555544522065186887>',
  mod:         '<:modd:1555544511210324030>',
  mod2:        '<:mod:1555544505434767403>',
  bot:         '<:n_bot:1555544367886770176>',
  dev:         '<:n_dev:1555544400564719639>',
  members:     '<:1430986220011524216:1555544196952367134>',
  crown:       '<:1430986209995526274:1555544172302307449>',
  earlyUser:   '<:earlyuser:1555544423746641923>',

  // ── Moderation ───────────────────────────────────────────────────────────
  ban:         '<:ban:1555544356352430202>',
  timeout:     '<:timeout:1555544634934042724>',
  lock:        '<:lockk:1555544494441635860>',
  restrict:    '<:restrict:1555544549105999962>',
  block:       '<:1430986207856300180:1555544166866616410>',

  // ── Actions ──────────────────────────────────────────────────────────────
  add:         '<:n_add:1555544335036973106>',
  remove:      '<:1430986239036625017:1555544229143519304>',
  del:         '<:del:1555544395720302643>',
  search:      '<:n_search:1555544554365788191>',
  addCall:     '<:1430986214764318873:1555544186227523665>',
  removeCall:  '<:1430986217448542329:1555544191654699018>',
  addPerson:   '<:1430986236746793000:1555544223506239591>',
  removePerson:'<:1430986241565790309:1555544234457833472>',

  // ── Navigation / UI ──────────────────────────────────────────────────────
  arrow:       '<:arrow:1555544351118196810>',
  down:        '<:down:1555544418407157790>',
  home:        '<:n_home:1555544468193546270>',
  link:        '<:1430986227909263442:1555544212756242532>',
  thread:      '<:thread:1555544613035708426>',
  threadd:     '<:threadd:1555544618517659688>',
  calendar:    '<:calendar:1555544372953616426>',
  time:        '<:1430986244921495654:1555544239792980044>',
  global:      '<:1430986225493479485:1555544207652032633>',
  ping:        '<:ping:1555544527597604968>',

  // ── Content categories ───────────────────────────────────────────────────
  announcement:'<:announcement:1555544345740967956>',
  suggestion:  '<:suggestion:1555544601501237322>',
  music:       '<:n_music:1555544516746940416>',
  spotify:     '<:n2_spotify:1555544565610577965>',
  minigames:   '<:minigames:1555544500179439707>',
  eco:         '<:eco:1555544429253890050>',
  utils:       '<:n_utils:1555544669545431062>',
  files:       '<:files:1555544445565407352>',
  category:    '<:cate:1555544378200559649>',
  megaphone:   '<:1430993644189520113:1555544245589381200>',
  javascript:  '<:javascript:1555544478557806602>',
  evox:        '<:evox:1555544439785652307>',

  // ── Reactions / social ───────────────────────────────────────────────────
  like:        '<:like:1555544483821527060>',
  dislike:     '<:dislike:1555544406394933249>',
  fire:        '<:fire:1555544450871332944>',
  boost:       '<:boost:1555544362455146576>',
  heart:       '<:Red_Heart:1555544329605615758>',
  currency:    '<:Currency:1555544251268595792>',
  thunder:     '<:thunderr:1555544623735242883>',
  ticky:       '<:ticky:1555544629166866613>',
  question:    '<:question:1555544543741476917>',

  // ── Fun / games ──────────────────────────────────────────────────────────
  gw:          '<:gw:1555544456873119875>',
  heads:       '<:heads:1555544462871240765>',
  tails:       '<:tails:1555544607469731840>',
  coinflip:    '<a:coinflip:1555544696271675522>',
  votes:       '<a:votes:1555544718065016844>',
  plsplspls:   '<:plsplspls:1555544535373717604>',
  onlyYou:     '<:OnlyYou:1555544302824726538>',
};

// ─────────────────────────────────────────────────────────────────────────────
// BUTTON EMOJI OBJECTS — use with .setEmoji() on ButtonBuilder
// These return the { id, name, animated } object Discord.js expects
// ─────────────────────────────────────────────────────────────────────────────

const B = {
  tick:        { id: '1555544712687915008', name: 'tickyy',       animated: true  },
  cross:       { id: '1555544390221562048', name: 'crossy',       animated: false },
  crossAnim:   { id: '1555544703364243467', name: 'crossyy',      animated: true  },
  error:       { id: '1555544434601369620', name: 'error',        animated: false },
  info:        { id: '1555544473008873565', name: 'info',         animated: false },
  loading:     { id: '1555544489194688623', name: 'loading',      animated: false },
  dot:         { id: '1555544412300378243', name: 'dot',          animated: false },
  add:         { id: '1555544335036973106', name: 'add',          animated: false },
  remove:      { id: '1555544229143519304', name: 'remove',       animated: false },
  del:         { id: '1555544395720302643', name: 'del',          animated: false },
  search:      { id: '1555544554365788191', name: 'search',       animated: false },
  user:        { id: '1555544664155889668', name: 'user',         animated: false },
  admin:       { id: '1555544340611207168', name: 'admin',        animated: false },
  ban:         { id: '1555544356352430202', name: 'ban',          animated: false },
  timeout:     { id: '1555544634934042724', name: 'timeout',      animated: false },
  lock:        { id: '1555544494441635860', name: 'lockk',        animated: false },
  restrict:    { id: '1555544549105999962', name: 'restricted',   animated: false },
  arrow:       { id: '1555544351118196810', name: 'arrow',        animated: false },
  link:        { id: '1555544212756242532', name: 'link',         animated: false },
  music:       { id: '1555544516746940416', name: 'music',        animated: false },
  utils:       { id: '1555544669545431062', name: 'utils',        animated: false },
  fire:        { id: '1555544450871332944', name: 'fire',         animated: false },
  boost:       { id: '1555544362455146576', name: 'boost',        animated: false },
  heart:       { id: '1555544329605615758', name: 'Red_Heart',    animated: false },
  currency:    { id: '1555544251268595792', name: 'Currency',     animated: false },
  gw:          { id: '1555544456873119875', name: 'gw',           animated: false },
  coinflip:    { id: '1555544696271675522', name: 'coinflip',     animated: true  },
  votes:       { id: '1555544718065016844', name: 'votes',        animated: true  },
  global:      { id: '1555544207652032633', name: 'global',       animated: false },
  crown:       { id: '1555544172302307449', name: 'crown',        animated: false },
  megaphone:   { id: '1555544245589381200', name: 'megaphone',    animated: false },
  time:        { id: '1555544239792980044', name: 'time',         animated: false },
  mod:         { id: '1555544511210324030', name: 'modd',         animated: false },
  bot:         { id: '1555544367886770176', name: 'bot',          animated: false },
  files:       { id: '1555544445565407352', name: 'files',        animated: false },
  calendar:    { id: '1555544372953616426', name: 'calendar',     animated: false },
  thunder:     { id: '1555544623735242883', name: 'thunderr',     animated: false },
  announcement:{ id: '1555544345740967956', name: 'announcement', animated: false },
  suggestion:  { id: '1555544601501237322', name: 'suggestion',   animated: false },
  ping:        { id: '1555544527597604968', name: 'ping',         animated: false },
  addCall:     { id: '1555544186227523665', name: 'addcall',      animated: false },
  removeCall:  { id: '1555544191654699018', name: 'removecall',   animated: false },
  addPerson:   { id: '1555544223506239591', name: 'addperson',    animated: false },
  removePerson:{ id: '1555544234457833472', name: 'removeperson', animated: false },
  block:       { id: '1555544166866616410', name: 'block',        animated: false },
  eco:         { id: '1555544429253890050', name: 'eco',          animated: false },
  minigames:   { id: '1555544500179439707', name: 'minigames',    animated: false },
  spotify:     { id: '1555544565610577965', name: 'spotify',      animated: false },
};

/**
 * Helper to generate a status indicator line
 * @param {string} label - The label text
 * @param {boolean} enabled - Whether the feature is enabled
 * @returns {string}
 */
function statusLine(label, enabled) {
  return enabled
    ? `${E.LEgreen} **${label}** — \`ENABLED\``
    : `${E.LEred} **${label}** — \`DISABLED\``;
}

/**
 * parseEmoji(str) — Convert a Discord emoji string to the object setEmoji() expects.
 *
 * Accepts:  '<:name:id>'  '<a:name:id>'  'name'  or already an object
 * Returns:  { id, name, animated } for custom emojis, or the string as-is for unicode
 *
 * Drop-in wrapper — safe to pass any value, falls back gracefully.
 */
function parseEmoji(str) {
  if (!str) return undefined;
  if (typeof str === 'object') return str; // already an object
  const m = str.match(/^<?(a?):([^:>]+):(\d+)>?$/);
  if (m) return { animated: m[1] === 'a', name: m[2], id: m[3] };
  return str; // unicode emoji — pass through as-is
}

module.exports = { E, B, statusLine, parseEmoji };
