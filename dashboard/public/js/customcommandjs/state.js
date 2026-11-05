// /js/customcommandjs/state.js
// Shared constants and mutable state — imported by all other modules.

export const MAX_COMMANDS     = 100;
export const MAX_ARGS         = 25;
export const MAX_CHOICES      = 25;
export const MAX_ALIASES      = 3;
export const MAX_TAGS         = 5;
export const MAX_VARIANTS     = 10;
export const MAX_CONDS        = 10;
export const MAX_ACTIONS      = 10;
export const MAX_BUTTONS      = 5;
export const MAX_EMBED_FIELDS = 25;

export const TYPES = {
  STRING:      { label: 'String',      icon: '🔤', color: '#6C53FF', discordType: 3  },
  INTEGER:     { label: 'Integer',     icon: '🔢', color: '#8B5CF6', discordType: 4  },
  NUMBER:      { label: 'Number',      icon: '🔣', color: '#53E8FF', discordType: 10 },
  BOOLEAN:     { label: 'Boolean',     icon: '⚡',  color: '#FFB347', discordType: 5  },
  USER:        { label: 'User',        icon: '👤', color: '#FF6EB4', discordType: 6  },
  CHANNEL:     { label: 'Channel',     icon: '🔊', color: '#4ECDC4', discordType: 7  },
  ROLE:        { label: 'Role',        icon: '🎭', color: '#C084FC', discordType: 8  },
  MENTIONABLE: { label: 'Mention',     icon: '@',  color: '#F97316', discordType: 9  },
  ATTACHMENT:  { label: 'File',        icon: '📎', color: '#FFE066', discordType: 11 },
};

export const COND_OPS = [
  { value: 'eq',         label: '= equals' },
  { value: 'neq',        label: '≠ not equals' },
  { value: 'gt',         label: '> greater than' },
  { value: 'lt',         label: '< less than' },
  { value: 'gte',        label: '≥ greater or equal' },
  { value: 'lte',        label: '≤ less or equal' },
  { value: 'contains',   label: '∈ contains' },
  { value: 'startsWith', label: '↦ starts with' },
  { value: 'endsWith',   label: '↤ ends with' },
];

// ── ACTION_TYPES ──────────────────────────────────────────────────────────────
// Fields:
//   needsArgArg   – show "primary arg" dropdown (role/channel/etc.)
//   argTypes      – which arg types are valid for the primary arg picker
//   needsTarget   – show a fixed-ID input ('role_id' | 'channel_id')
//   needsValue    – show a value input ('message'|'nickname'|'duration'|'reason'|'emoji')
//   needsUserArg  – show a SECOND "target user arg" dropdown
//   userArgTypes  – valid arg types for the target picker (default ['USER','MENTIONABLE'])
// ─────────────────────────────────────────────────────────────────────────────
export const ACTION_TYPES = [

  // ── Invoker-targeted ──────────────────────────────────────────────────────
  { value: 'add_role',    label: '➕ Add Role → Invoker (fixed)',   icon: '🎭', group: 'Roles',
    needsTarget: 'role_id' },
  { value: 'remove_role', label: '➖ Remove Role → Invoker (fixed)', icon: '🎭', group: 'Roles',
    needsTarget: 'role_id' },
  { value: 'add_role_arg',    label: '➕ Add Role (arg) → Invoker',    icon: '🎭', group: 'Roles',
    needsArgArg: true, argTypes: ['ROLE'] },
  { value: 'remove_role_arg', label: '➖ Remove Role (arg) → Invoker',  icon: '🎭', group: 'Roles',
    needsArgArg: true, argTypes: ['ROLE'] },

  // ── Dual-variable role actions ────────────────────────────────────────────
  { value: 'add_role_to_user_arg',    label: '➕ Add Role (fixed) → User (arg)',   icon: '🎭', group: 'Roles',
    needsTarget: 'role_id', needsUserArg: true },
  { value: 'remove_role_from_user_arg', label: '➖ Remove Role (fixed) → User (arg)', icon: '🎭', group: 'Roles',
    needsTarget: 'role_id', needsUserArg: true },
  { value: 'add_role_arg_to_user_arg',    label: '➕ Add Role (arg) → User (arg)',   icon: '🎭', group: 'Roles',
    needsArgArg: true, argTypes: ['ROLE'], needsUserArg: true },
  { value: 'remove_role_arg_from_user_arg', label: '➖ Remove Role (arg) → User (arg)', icon: '🎭', group: 'Roles',
    needsArgArg: true, argTypes: ['ROLE'], needsUserArg: true },

  // ── Messaging ─────────────────────────────────────────────────────────────
  { value: 'dm_invoker',       label: '📨 DM the Invoker',           icon: '📨', group: 'Messaging',
    needsValue: 'message' },
  { value: 'dm_user_arg',      label: '📨 DM User (arg)',             icon: '📨', group: 'Messaging',
    needsArgArg: true, argTypes: ['USER','MENTIONABLE'], needsValue: 'message' },
  { value: 'send_channel',     label: '📢 Send to Channel (fixed)',   icon: '📢', group: 'Messaging',
    needsTarget: 'channel_id', needsValue: 'message' },
  { value: 'send_channel_arg', label: '📢 Send to Channel (arg)',     icon: '📢', group: 'Messaging',
    needsArgArg: true, argTypes: ['CHANNEL'], needsValue: 'message' },
  { value: 'react',            label: '😄 React with Emoji',          icon: '😄', group: 'Messaging',
    needsValue: 'emoji' },

  // ── Nickname ──────────────────────────────────────────────────────────────
  { value: 'set_nickname',          label: '✏️ Set Nickname → Invoker',       icon: '✏️', group: 'Moderation',
    needsValue: 'nickname' },
  { value: 'set_nickname_user_arg', label: '✏️ Set Nickname → User (arg)',     icon: '✏️', group: 'Moderation',
    needsUserArg: true, needsValue: 'nickname' },

  // ── Moderation ────────────────────────────────────────────────────────────
  { value: 'timeout_user',              label: '⏱️ Timeout User (arg)',            icon: '⏱️', group: 'Moderation',
    needsArgArg: true, argTypes: ['USER'], needsValue: 'duration' },
  { value: 'timeout_user_arg_duration', label: '⏱️ Timeout User (arg) — Duration (arg)', icon: '⏱️', group: 'Moderation',
    needsArgArg: true, argTypes: ['USER'], needsUserArg: true, userArgTypes: ['INTEGER','NUMBER','STRING'], needsValue: false,
    userArgLabel: 'Duration arg (INTEGER/NUMBER, seconds)' },
  { value: 'kick_user', label: '🦵 Kick User (arg)',  icon: '🦵', group: 'Moderation',
    needsArgArg: true, argTypes: ['USER'], needsValue: 'reason' },
  { value: 'ban_user',  label: '🔨 Ban User (arg)',   icon: '🔨', group: 'Moderation',
    needsArgArg: true, argTypes: ['USER'], needsValue: 'reason' },
];

export const BUTTON_STYLES = [
  { value: 'PRIMARY',   label: 'Blurple', color: '#5865F2' },
  { value: 'SECONDARY', label: 'Grey',    color: '#4f545c' },
  { value: 'SUCCESS',   label: 'Green',   color: '#57f287' },
  { value: 'DANGER',    label: 'Red',     color: '#ed4245' },
  { value: 'LINK',      label: 'Link',    color: '#99aab5' },
];

// ── Mutable state ─────────────────────────────────────────────────────────────

let _commands     = [];
let _filterQuery  = '';
let _filterTag    = '';
let _filterCat    = '';
let _sortBy       = 'name';
let _viewMode     = 'list';
let _editingName  = null;
let _pendingDel   = null;
let _args         = [];
let _variants     = [];
let _conditionals = [];
let _actions      = [];
let _buttons      = [];
let _embedFields  = [];
let _selected     = new Set();
let _rateLimits            = null;
let _enabledNormalCommands = 0;
let _noxxCommandLimit      = null;   // null = unlimited
let _discordGuildCmdLimit  = 100;
let _tier                  = 'free';

export const state = {
  get commands()     { return _commands; },
  get filterQuery()  { return _filterQuery; },
  get filterTag()    { return _filterTag; },
  get filterCat()    { return _filterCat; },
  get sortBy()       { return _sortBy; },
  get viewMode()     { return _viewMode; },
  get editingName()  { return _editingName; },
  get pendingDel()   { return _pendingDel; },
  get args()         { return _args; },
  get variants()     { return _variants; },
  get conditionals() { return _conditionals; },
  get actions()      { return _actions; },
  get buttons()      { return _buttons; },
  get embedFields()  { return _embedFields; },
  get selected()     { return _selected; },
  get rateLimits()            { return _rateLimits; },
  get enabledNormalCommands() { return _enabledNormalCommands; },
  get noxxCommandLimit()      { return _noxxCommandLimit; },
  get discordGuildCmdLimit()  { return _discordGuildCmdLimit; },
  get tier()                  { return _tier; },

  setCommands(v)     { _commands     = v; },
  setFilter(v)       { _filterQuery  = v.toLowerCase(); },
  setFilterTag(v)    { _filterTag    = v; },
  setFilterCat(v)    { _filterCat    = v; },
  setSortBy(v)       { _sortBy       = v; },
  setViewMode(v)     { _viewMode     = v; },
  setEditingName(v)  { _editingName  = v; },
  setPendingDel(v)   { _pendingDel   = v; },
  setArgs(v)         { _args         = v; },
  setVariants(v)     { _variants     = v; },
  setConditionals(v) { _conditionals = v; },
  setActions(v)      { _actions      = v; },
  setButtons(v)      { _buttons      = v; },
  setEmbedFields(v)  { _embedFields  = v; },
  setRateLimits(v)            { _rateLimits            = v; },
  setEnabledNormalCommands(v) { _enabledNormalCommands = v; },
  setNoxxCommandLimit(v)      { _noxxCommandLimit      = v; },
  setDiscordGuildCmdLimit(v)  { _discordGuildCmdLimit  = v; },
  setTier(v)                  { _tier                  = v; },

  addCommand(cmd)          { _commands.unshift(cmd); },
  removeCommand(n)         { _commands = _commands.filter(c => c.name !== n); },
  updateCommand(name, patch) {
    const idx = _commands.findIndex(c => c.name === name);
    if (idx !== -1) _commands[idx] = { ..._commands[idx], ...patch };
  },

  addArg(a)            { _args.push(a); },
  removeArg(i)         { _args.splice(i, 1); },
  addVariant(v)        { _variants.push(v); },
  removeVariant(i)     { _variants.splice(i, 1); },
  addConditional(c)    { _conditionals.push(c); },
  removeConditional(i) { _conditionals.splice(i, 1); },
  addAction(a)         { _actions.push(a); },
  removeAction(i)      { _actions.splice(i, 1); },
  addButton(b)         { _buttons.push(b); },
  removeButton(i)      { _buttons.splice(i, 1); },
  addEmbedField(f)     { _embedFields.push(f); },
  removeEmbedField(i)  { _embedFields.splice(i, 1); },

  toggleSelect(name) {
    if (_selected.has(name)) _selected.delete(name);
    else _selected.add(name);
  },
  clearSelected()    { _selected = new Set(); },
  selectAll()        {
    _commands.forEach(c => _selected.add(c.name));
    _selected = new Set(_selected);
  },

  get filtered() {
    let list = _commands;
    if (_filterQuery) list = list.filter(c =>
      c.name.includes(_filterQuery) ||
      (c.description||'').toLowerCase().includes(_filterQuery) ||
      (c.response||'').toLowerCase().includes(_filterQuery) ||
      (c.tags||[]).some(t => t.includes(_filterQuery))
    );
    if (_filterTag) list = list.filter(c => (c.tags||[]).includes(_filterTag));
    if (_filterCat) list = list.filter(c => c.category === _filterCat);
    switch (_sortBy) {
      case 'uses':    list = [...list].sort((a,b) => (b.usageCount||0) - (a.usageCount||0)); break;
      case 'created': list = [...list].sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0)); break;
      case 'updated': list = [...list].sort((a,b) => new Date(b.updatedAt||0) - new Date(a.updatedAt||0)); break;
      default:        list = [...list].sort((a,b) => a.name.localeCompare(b.name));
    }
    return list;
  },

  get allTags() {
    return [...new Set(_commands.flatMap(c => c.tags||[]))].sort();
  },

  get allCategories() {
    return [...new Set(_commands.map(c => c.category||'').filter(Boolean))].sort();
  },
};