/**
 * emojis.js — Central custom emoji registry for RankCore bot
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
  tick:        '<a:tickyy:1567797045253644368>',
  cross:       '<:crossy:1567796959648030831>',
  crossAnim:   '<a:crossyy:1567797041009135616>',
  error:       '<:error:1567796968758050868>',
  warning:     '<:error:1567796968758050868>',
  info:        '<:n_info:1567796991419744417>',
  loading:     '<:n_loading:1567796992556666982>',
  loadingAnim: '<a:404_loading:1567797037024542855>',
  loadingAnim2:'<a:88094loading:1567797038417186876>',
  dot:         '<:dot:1567796963624226826>',

  // ── Status dots (LED style) ──────────────────────────────────────────────
  // LE = Left End, ME = Middle, RE = Right End
  // LF = Left Fill, MF = Middle Fill, RF = Right Fill
  // green/red variants
  LEgreen:     '<:LEgreen:1567796933307666515>',
  LEred:       '<:LEred:1567796934545121280>',
  LFgreen:     '<:LFgreen:1567796935601950730>',
  LFred:       '<:LFred:1567796936814104626>',
  MEgreen:     '<:MEgreen:1567796937921400862>',
  MEred:       '<:MEred:1567796939003666463>',
  MFgreen:     '<:MFgreen:1567796940421333002>',
  MFred:       '<:MFred:1567796941549604915>',
  REgreen:     '<:REgreen:1567796944548536382>',
  REred:       '<:REred:1567796945752166490>',
  RFgreen:     '<:RFgreen:1567796946876371047>',
  RFred:       '<:RFred:1567796948092583996>',

  enabled:     '<:LEgreen:1567796933307666515>',
  disabled:    '<:LEred:1567796934545121280>',

  // ── People / roles ───────────────────────────────────────────────────────
  user:        '<:user:1567797032423264261>',
  admin:       '<:n_admin:1567796984608464897>',
  owner:       '<:owner:1567796997807939696>',
  mod:         '<:modd:1567796981160742974>',
  mod2:        '<:mod:1567796980023820471>',
  bot:         '<:n_bot:1567796985816154144>',
  dev:         '<:n_dev:1567796988676939900>',
  members:     '<:1430986220011524216:1567796919244161135>',
  crown:       '<:1430986209995526274:1567796911350747206>',
  earlyUser:   '<:earlyuser:1567796965469589525>',

  // ── Moderation ───────────────────────────────────────────────────────────
  ban:         '<:ban:1567796952538554458>',
  timeout:     '<:timeout:1567797028979740822>',
  lock:        '<:lockk:1567796977809367122>',
  restrict:    '<:restrict:1567797003638022166>',
  block:       '<:1430986207856300180:1567796910062837931>',

  // ── Actions ──────────────────────────────────────────────────────────────
  add:         '<:n_add:1567796983408754731>',
  remove:      '<:1430986239036625017:1567796926689185822>',
  del:         '<:del:1567796961334267974>',
  search:      '<:n_search:1567796994792230953>',
  addCall:     '<:1430986214764318873:1567796916551421952>',
  removeCall:  '<:1430986217448542329:1567796917977481319>',
  addPerson:   '<:1430986236746793000:1567796925451866173>',
  removePerson:'<:1430986241565790309:1567796928140419102>',

  // ── Navigation / UI ──────────────────────────────────────────────────────
  arrow:       '<:arrow:1567796951527850055>',
  down:        '<:down:1567796964672929802>',
  home:        '<:n_home:1567796990148878446>',
  link:        '<:1430986227909263442:1567796922863984670>',
  thread:      '<:thread:1567797010692706324>',
  threadd:     '<:threadd:1567797011829366934>',
  calendar:    '<:calendar:1567796954640158770>',
  time:        '<:1430986244921495654:1567796929587576852>',
  global:      '<:1430986225493479485:1567796921681055824>',
  ping:        '<:ping:1567796998902521920>',

  // ── Content categories ───────────────────────────────────────────────────
  announcement:'<:announcement:1567796950265241662>',
  suggestion:  '<:suggestion:1567797008452812870>',
  music:       '<:n_music:1567796993403658261>',
  spotify:     '<:n2_spotify:1567796982548799618>',
  minigames:   '<:minigames:1567796978929238076>',
  eco:         '<:eco:1567796967197900842>',
  utils:       '<:n_utils:1567796996830658573>',
  files:       '<:files:1567796970964394044>',
  category:    '<:cate:1567796955894128740>',
  megaphone:   '<:1430993644189520113:1567796930799607818>',
  javascript:  '<:javascript:1567796975502364742>',
  evox:        '<:evox:1567796969789857853>',

  // ── Reactions / social ───────────────────────────────────────────────────
  like:        '<:like:1567796976542814269>',
  dislike:     '<:dislike:1567796962416132136>',
  fire:        '<:fire:1567796972125945888>',
  boost:       '<:boost:1567796953599836280>',
  heart:       '<:Red_Heart:1567796949271191642>',
  currency:    '<:Currency:1567796932041121873>',
  thunder:     '<:thunderr:1567797012991189134>',
  ticky:       '<:ticky:1567797023707504752>',
  question:    '<:question:1567797002555621406>',

  // ── Fun / games ──────────────────────────────────────────────────────────
  gw:          '<:gw:1567796972872536159>',
  heads:       '<:heads:1567796974374092890>',
  tails:       '<:tails:1567797009262321736>',
  coinflip:    '<a:coinflip:1567797039528681602>',
  votes:       '<a:votes:1567797046562259015>',
  plsplspls:   '<:plsplspls:1567797000244699177>',
  onlyYou:     '<:OnlyYou:1567796942480871508>',

  // ── Numbers 1–10 (RankCore violet) — e.g. poll options ──────────────────
  // E.num[0] is 1, E.num[9] is 10
  num: [
    '<:num1:1570374590042087505>', '<:num2:1570374591644434485>', '<:num3:1570374593708040222>',
    '<:num4:1570374595515519128>', '<:num5:1570374597390639234>', '<:num6:1570374599298781194>',
    '<:num7:1570374601056329735>', '<:num8:1570374602994098176>', '<:num9:1570374604852170862>',
    '<:num10:1570374606504599703>',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// BUTTON EMOJI OBJECTS — use with .setEmoji() on ButtonBuilder
// These return the { id, name, animated } object Discord.js expects
// ─────────────────────────────────────────────────────────────────────────────

const B = {
  tick:        { id: '1567797045253644368', name: 'tickyy',       animated: true  },
  cross:       { id: '1567796959648030831', name: 'crossy',       animated: false },
  crossAnim:   { id: '1567797041009135616', name: 'crossyy',      animated: true  },
  error:       { id: '1567796968758050868', name: 'error',        animated: false },
  info:        { id: '1567796991419744417', name: 'info',         animated: false },
  loading:     { id: '1567796992556666982', name: 'loading',      animated: false },
  dot:         { id: '1567796963624226826', name: 'dot',          animated: false },
  add:         { id: '1567796983408754731', name: 'add',          animated: false },
  remove:      { id: '1567796926689185822', name: 'remove',       animated: false },
  del:         { id: '1567796961334267974', name: 'del',          animated: false },
  search:      { id: '1567796994792230953', name: 'search',       animated: false },
  user:        { id: '1567797032423264261', name: 'user',         animated: false },
  admin:       { id: '1567796984608464897', name: 'admin',        animated: false },
  ban:         { id: '1567796952538554458', name: 'ban',          animated: false },
  timeout:     { id: '1567797028979740822', name: 'timeout',      animated: false },
  lock:        { id: '1567796977809367122', name: 'lockk',        animated: false },
  restrict:    { id: '1567797003638022166', name: 'restricted',   animated: false },
  arrow:       { id: '1567796951527850055', name: 'arrow',        animated: false },
  link:        { id: '1567796922863984670', name: 'link',         animated: false },
  music:       { id: '1567796993403658261', name: 'music',        animated: false },
  utils:       { id: '1567796996830658573', name: 'utils',        animated: false },
  fire:        { id: '1567796972125945888', name: 'fire',         animated: false },
  boost:       { id: '1567796953599836280', name: 'boost',        animated: false },
  heart:       { id: '1567796949271191642', name: 'Red_Heart',    animated: false },
  currency:    { id: '1567796932041121873', name: 'Currency',     animated: false },
  gw:          { id: '1567796972872536159', name: 'gw',           animated: false },
  coinflip:    { id: '1567797039528681602', name: 'coinflip',     animated: true  },
  votes:       { id: '1567797046562259015', name: 'votes',        animated: true  },
  global:      { id: '1567796921681055824', name: 'global',       animated: false },
  crown:       { id: '1567796911350747206', name: 'crown',        animated: false },
  megaphone:   { id: '1567796930799607818', name: 'megaphone',    animated: false },
  time:        { id: '1567796929587576852', name: 'time',         animated: false },
  mod:         { id: '1567796981160742974', name: 'modd',         animated: false },
  bot:         { id: '1567796985816154144', name: 'bot',          animated: false },
  files:       { id: '1567796970964394044', name: 'files',        animated: false },
  calendar:    { id: '1567796954640158770', name: 'calendar',     animated: false },
  thunder:     { id: '1567797012991189134', name: 'thunderr',     animated: false },
  announcement:{ id: '1567796950265241662', name: 'announcement', animated: false },
  suggestion:  { id: '1567797008452812870', name: 'suggestion',   animated: false },
  ping:        { id: '1567796998902521920', name: 'ping',         animated: false },
  addCall:     { id: '1567796916551421952', name: 'addcall',      animated: false },
  removeCall:  { id: '1567796917977481319', name: 'removecall',   animated: false },
  addPerson:   { id: '1567796925451866173', name: 'addperson',    animated: false },
  removePerson:{ id: '1567796928140419102', name: 'removeperson', animated: false },
  block:       { id: '1567796910062837931', name: 'block',        animated: false },
  eco:         { id: '1567796967197900842', name: 'eco',          animated: false },
  minigames:   { id: '1567796978929238076', name: 'minigames',    animated: false },
  spotify:     { id: '1567796982548799618', name: 'spotify',      animated: false },
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
