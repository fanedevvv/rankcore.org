// routes/customcommands.js
const CustomCommand = require('../../../Schemas/customCommandSchema');
const router        = require('express').Router();
const path          = require('path');
const { Routes }    = require('discord.js');
const { isAuth, sendHTMLWithNonce, checkPremium, isPremiumGuild, PREMIUM_CAP, checkDashboardAccess } = require('../../middleware');

// CRIT-2: Do NOT instantiate a REST client with process.env.token here.
// All Discord REST calls use req.client.rest which — in standalone mode —
// is a FakeREST that proxies to the internal bot API on port 5182.
// This keeps the bot token out of the dashboard process entirely.
function getClientRest(req) {
  return (req.client || req.app.get('client'))?.rest;
}

// ── CB-aware client resolution ─────────────────────────────────────────────────
// When a Custom Branding bot is active for a guild, slash commands must be
// registered against the CB bot's application ID (not Roco's).
// We fetch the CB bot's clientId from the CustomBranding schema and use a
// dedicated internal API route to proxy Discord REST calls through the CB worker.
const CustomBranding = require('../../../Schemas/customBrandingSchema');

/**
 * Returns { clientId, rest } — using the CB bot if one is active for the guild,
 * otherwise falling back to the main Roco client.
 * @param {import('express').Request} req
 * @param {string} guildId
 */
async function getEffectiveClient(req, guildId) {
  try {
    const cb = await CustomBranding.findOne({ guildId, enabled: true })
      .select('botClientId setupState').lean();
    if (cb?.botClientId && cb.setupState === 'active') {
      // CB bot is running — use its clientId and proxy REST through internal API
      const { apiPost } = require('../../lib/botClient');
      const cbRest = {
        async get(route)         { return apiPost('/internal/cb/rest', { guildId, method: 'GET',    route }); },
        async post(route, opts)  { return apiPost('/internal/cb/rest', { guildId, method: 'POST',   route, body: opts?.body }); },
        async patch(route, opts) { return apiPost('/internal/cb/rest', { guildId, method: 'PATCH',  route, body: opts?.body }); },
        async delete(route)      { return apiPost('/internal/cb/rest', { guildId, method: 'DELETE', route }); },
        async put(route, opts)   { return apiPost('/internal/cb/rest', { guildId, method: 'PUT',    route, body: opts?.body }); },
      };
      return { clientId: cb.botClientId, rest: cbRest, isCB: true };
    }
  } catch {}
  const client = (req.client || req.app.get('client'));
  return { clientId: client?.user?.id, rest: getClientRest(req), isCB: false };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── HARD LIMITS ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const VALID_NAME = /^[a-z][a-z0-9-]{0,31}$/;
const VALID_ARG  = /^[a-z][a-z0-9_-]{0,31}$/;
const VALID_TAG  = /^[a-z0-9_-]{1,24}$/;

const MAX = {
  COMMANDS_FREE:    25,    // free tier cap
  COMMANDS_PREMIUM: PREMIUM_CAP,  // premium cap (1,500)
  COMMANDS:        100,   // kept as a fallback reference only
  ARGS:             25,
  CHOICES:          25,
  ALIASES:           3,
  TAGS:              5,
  VARIANTS:         10,
  CONDITIONALS:     10,
  ACTIONS:          10,
  BUTTONS:           5,
  EMBED_FIELDS:     25,
  RESTRICTION_IDS:  50,
  CATEGORY_LEN:     32,
  IMPORT_BATCH:     20,
};

const LIMITS = {
  PER_GUILD_CREATES_PER_DAY:    50,   // raised — free access now
  PER_GUILD_DELETES_PER_HOUR:   50,
  PER_GUILD_PATCHES_PER_HOUR:   100,
  PER_GUILD_EXPORTS_PER_HOUR:   20,
  PER_GUILD_IMPORTS_PER_DAY:    10,
  PER_GUILD_BULK_OPS_PER_HOUR:  20,
  GLOBAL_CREATES_PER_MINUTE:    10,
  GLOBAL_OPS_PER_MINUTE:        30,
  QUEUE_MAX_SIZE:               50,
  RETRY_ATTEMPTS:                3,
  RETRY_BASE_MS:              1500,
  USER_REQUESTS_PER_MINUTE:     30,
};

// ══════════════════════════════════════════════════════════════════════════════
// ── RATE LIMITER ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const DAY_MS    = 86_400_000;
const HOUR_MS   = 3_600_000;
const MINUTE_MS = 60_000;

const rlStores = {
  guildCreates:  new Map(), guildDeletes: new Map(), guildPatches: new Map(),
  guildExports:  new Map(), guildImports: new Map(), guildBulk:   new Map(),
  globalCreates: new Map(), globalOps:   new Map(), users:        new Map(),
};

setInterval(() => {
  const now = Date.now();
  for (const s of Object.values(rlStores))
    for (const [k, b] of s.entries())
      if (!b.hits?.length || now - b.hits[0] > DAY_MS) s.delete(k);
}, 10 * MINUTE_MS);

function checkRL(store, key, limit, windowMs) {
  const now    = Date.now();
  const bucket = store.get(key) || { hits: [] };
  bucket.hits  = bucket.hits.filter(t => now - t < windowMs);
  const resetInMs = bucket.hits.length ? windowMs - (now - bucket.hits[0]) : 0;
  if (bucket.hits.length >= limit) { store.set(key, bucket); return { allowed: false, resetInMs }; }
  bucket.hits.push(now); store.set(key, bucket);
  return { allowed: true, resetInMs: 0 };
}

function rl(store, key, limit, windowMs, label) {
  const { allowed, resetInMs } = checkRL(store, key, limit, windowMs);
  if (!allowed) {
    const s   = Math.ceil(resetInMs / 1000);
    const err = new Error(`Rate limit: ${label}. Retry in ${s >= 60 ? Math.ceil(s/60)+'min' : s+'s'}.`);
    err.status = 429; err.retryAfter = s;
    return err;
  }
  return null;
}

function userThrottle(req, res, next) {
  const uid = req.user?.id || req.ip;
  const err = rl(rlStores.users, uid, LIMITS.USER_REQUESTS_PER_MINUTE, MINUTE_MS, 'too many requests');
  if (err) return res.status(429).json({ error: err.message, retryAfter: err.retryAfter });
  next();
}

function getRLStatus(guildId) {
  const snap = (store, windowMs) => {
    const b = store.get(guildId); if (!b) return 0;
    const now = Date.now(); return b.hits.filter(t => now - t < windowMs).length;
  };
  return {
    createsUsed: snap(rlStores.guildCreates, DAY_MS),   createsLimit: LIMITS.PER_GUILD_CREATES_PER_DAY,
    deletesUsed: snap(rlStores.guildDeletes, HOUR_MS),  deletesLimit: LIMITS.PER_GUILD_DELETES_PER_HOUR,
    patchesUsed: snap(rlStores.guildPatches, HOUR_MS),  patchesLimit: LIMITS.PER_GUILD_PATCHES_PER_HOUR,
    queueSize:   discordQueue.size,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── DISCORD QUEUE ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const discordQueue = (() => {
  let processing = false;
  const queue    = [];

  async function processNext() {
    if (processing || !queue.length) return;
    processing = true;
    const { op, label, attempt } = queue.shift();
    try {
      await op();
      console.log(`[DiscordQueue] ✓ ${label}`);
    } catch (err) {
      const status = err.status ?? err.httpStatus ?? 0;
      if (status === 429 && attempt < LIMITS.RETRY_ATTEMPTS) {
        const wait = (err.retryAfter ?? 0) * 1000 || LIMITS.RETRY_BASE_MS * Math.pow(2, attempt);
        console.warn(`[DiscordQueue] 429 "${label}" retry in ${wait}ms`);
        queue.unshift({ op, label, attempt: attempt + 1 });
        await new Promise(r => setTimeout(r, wait));
      } else {
        console.error(`[DiscordQueue] ✗ ${label}:`, err.message);
      }
    }
    processing = false;
    if (queue.length) setImmediate(processNext);
  }

  return {
    enqueue(op, label) {
      if (queue.length >= LIMITS.QUEUE_MAX_SIZE) { console.error(`[Q] Full, dropping: ${label}`); return false; }
      queue.push({ op, label, attempt: 0 }); setImmediate(processNext); return true;
    },
    get size() { return queue.length; },
  };
})();

// ══════════════════════════════════════════════════════════════════════════════
// ── VALIDATION ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const DISCORD_TYPES = {
  STRING: 3, INTEGER: 4, NUMBER: 10, BOOLEAN: 5,
  USER: 6, CHANNEL: 7, ROLE: 8, ATTACHMENT: 11, MENTIONABLE: 9,
};

const VALID_OPS = new Set(['eq','neq','gt','lt','gte','lte','contains','startsWith','endsWith']);

const VALID_ACTION_TYPES = new Set([
  // Original single-target
  'add_role','remove_role','add_role_arg','remove_role_arg',
  'dm_invoker','dm_user_arg','send_channel','send_channel_arg',
  'set_nickname','timeout_user','kick_user','ban_user','react',
  // Dual-variable (role ↔ user arg, nickname on user arg, timeout via arg)
  'add_role_to_user_arg','remove_role_from_user_arg',
  'add_role_arg_to_user_arg','remove_role_arg_from_user_arg',
  'set_nickname_user_arg','timeout_user_arg_duration',
]);

const VALID_BUTTON_STYLES = new Set(['PRIMARY','SECONDARY','SUCCESS','DANGER','LINK']);

function validateArgs(args) {
  if (!Array.isArray(args)) return null;
  if (args.length > MAX.ARGS) return `Max ${MAX.ARGS} arguments`;
  const seen = new Set();
  for (const [i, a] of args.entries()) {
    if (!/^[a-z][a-z0-9_-]{0,31}$/.test(a.name)) return `Arg #${i+1}: invalid name "${a.name}"`;
    if (seen.has(a.name))                          return `Arg #${i+1}: duplicate name "${a.name}"`;
    if (!DISCORD_TYPES[a.type])                    return `Arg #${i+1}: unknown type "${a.type}"`;
    if ((a.choices||[]).length > MAX.CHOICES)      return `Arg #${i+1}: too many choices`;
    seen.add(a.name);
  }
  return null;
}

function validateAliases(aliases) {
  if (!Array.isArray(aliases)) return null;
  if (aliases.length > MAX.ALIASES) return `Max ${MAX.ALIASES} aliases`;
  for (const a of aliases) if (!VALID_NAME.test(a)) return `Invalid alias "${a}"`;
  return null;
}

function validateTags(tags) {
  if (!Array.isArray(tags)) return null;
  if (tags.length > MAX.TAGS) return `Max ${MAX.TAGS} tags`;
  for (const t of tags) if (!VALID_TAG.test(t)) return `Invalid tag "${t}"`;
  return null;
}

function validateVariants(v) {
  if (!Array.isArray(v)) return null;
  if (v.length > MAX.VARIANTS) return `Max ${MAX.VARIANTS} response variants`;
  for (const [i, x] of v.entries()) {
    if (!x.text?.trim())       return `Variant #${i+1} empty`;
    if (x.text.length > 2000)  return `Variant #${i+1} exceeds 2000 chars`;
  }
  return null;
}

function validateConditionals(c) {
  if (!Array.isArray(c)) return null;
  if (c.length > MAX.CONDITIONALS) return `Max ${MAX.CONDITIONALS} conditionals`;
  for (const [i, x] of c.entries()) {
    if (!x.argName)               return `Conditional #${i+1}: missing argName`;
    if (!VALID_OPS.has(x.operator)) return `Conditional #${i+1}: invalid operator`;
    if (!x.response?.trim())      return `Conditional #${i+1}: response empty`;
    if (x.response.length > 2000)  return `Conditional #${i+1}: response too long`;
  }
  return null;
}

function validateActions(actions) {
  if (!Array.isArray(actions)) return null;
  if (actions.length > MAX.ACTIONS) return `Max ${MAX.ACTIONS} actions`;
  for (const [i, a] of actions.entries()) {
    if (!VALID_ACTION_TYPES.has(a.type)) return `Action #${i+1}: unknown type "${a.type}"`;
    if (a.value && typeof a.value === 'string' && a.value.length > 2000) return `Action #${i+1}: value too long`;
  }
  return null;
}

function validateButtons(buttons) {
  if (!Array.isArray(buttons)) return null;
  if (buttons.length > MAX.BUTTONS) return `Max ${MAX.BUTTONS} buttons`;
  for (const [i, b] of buttons.entries()) {
    if (!VALID_BUTTON_STYLES.has(b.style)) return `Button #${i+1}: invalid style "${b.style}"`;
    if (!b.label && !b.emoji)              return `Button #${i+1}: needs label or emoji`;
    if (b.label && b.label.length > 80)    return `Button #${i+1}: label too long`;
    if (b.style === 'LINK') {
      if (!b.url)                          return `Button #${i+1}: Link buttons need a URL`;
    } else {
      if (!b.response?.trim())             return `Button #${i+1}: response empty`;
      if (b.response.length > 2000)        return `Button #${i+1}: response too long`;
    }
  }
  return null;
}

function validateEmbedFields(fields) {
  if (!Array.isArray(fields)) return null;
  if (fields.length > MAX.EMBED_FIELDS) return `Max ${MAX.EMBED_FIELDS} embed fields`;
  for (const [i, f] of fields.entries()) {
    if (!f.name?.trim())              return `Embed field #${i+1}: name required`;
    if (f.name.length > 256)          return `Embed field #${i+1}: name too long`;
    if (!f.value?.trim())             return `Embed field #${i+1}: value required`;
    if (f.value.length > 1024)        return `Embed field #${i+1}: value too long`;
  }
  return null;
}

function validateRestrictions(list) {
  if (!Array.isArray(list)) return null;
  if (list.length > MAX.RESTRICTION_IDS) return `Max ${MAX.RESTRICTION_IDS} IDs per list`;
  for (const r of list) if (!r.id || typeof r.id !== 'string') return `Invalid restriction entry`;
  return null;
}

function buildDiscordOptions(args) {
  if (!args?.length) return [];
  return [...args].sort((a, b) => (b.required ? 1 : 0) - (a.required ? 1 : 0)).map(a => {
    const opt = {
      name:        a.name,
      description: (a.description || `The ${a.name} argument`).slice(0, 100),
      type:        DISCORD_TYPES[a.type] || 3,
      required:    !!a.required,
    };
    if (['STRING','INTEGER','NUMBER'].includes(a.type) && a.choices?.length) {
      opt.choices = a.choices.filter(c => c.name && c.value !== '').map(c => ({
        name:  String(c.name).slice(0, 100),
        value: a.type === 'STRING' ? String(c.value) : Number(c.value),
      }));
    }
    if (a.type === 'STRING') {
      if (a.minLength != null) opt.min_length = Math.max(0, Number(a.minLength));
      if (a.maxLength != null) opt.max_length = Math.min(6000, Number(a.maxLength));
      if (a.autocomplete && !opt.choices?.length) opt.autocomplete = true;
    }
    if (['INTEGER','NUMBER'].includes(a.type)) {
      if (a.minValue != null) opt.min_value = Number(a.minValue);
      if (a.maxValue != null) opt.max_value = Number(a.maxValue);
    }
    if (a.type === 'CHANNEL' && a.channelTypes?.length) opt.channel_types = a.channelTypes.map(Number);
    return opt;
  });
}

async function getDiscordCmdId(rest, clientId, guildId, name) {
  try {
    const cmds = await rest.get(Routes.applicationGuildCommands(clientId, guildId));
    return cmds.find(c => c.name === name)?.id || null;
  } catch { return null; }
}

function serializeCmd(c) {
  return {
    name: c.Name, description: c.Description, response: c.Response,
    creator: c.Creator, lastEditedBy: c.LastEditedBy,
    createdAt: c.createdAt || null, updatedAt: c.updatedAt || null,
    enabled: c.Enabled !== false,
    isEmbed: c.IsEmbed, embedColor: c.EmbedColor, embedTitle: c.EmbedTitle,
    embedFooter: c.EmbedFooter, embedImage: c.EmbedImage,
    embedThumbnail: c.EmbedThumbnail, embedAuthorName: c.EmbedAuthorName,
    embedAuthorIcon: c.EmbedAuthorIcon, embedUrl: c.EmbedUrl,
    embedFooterIcon: c.EmbedFooterIcon || '',
    embedFields: c.EmbedFields || [],
    ephemeral: c.Ephemeral, dmAllowed: c.DmAllowed,
    cooldown: c.Cooldown, globalCooldown: c.GlobalCooldown,
    deleteInvoking: c.DeleteInvoking, requiredPermission: c.RequiredPermission,
    multiResponseEnabled: c.MultiResponseEnabled, responseVariants: c.ResponseVariants || [],
    conditionals: c.Conditionals || [],
    actions:      c.Actions  || [],
    buttons:      c.Buttons  || [],
    allowedChannels: c.AllowedChannels || [], deniedChannels: c.DeniedChannels || [],
    allowedRoles:    c.AllowedRoles    || [], deniedRoles:    c.DeniedRoles    || [],
    aliases: c.Aliases || [], tags: c.Tags || [], category: c.Category || '',
    usageCount: c.UsageCount || 0, lastUsedAt: c.LastUsedAt || null,
    arguments: c.Arguments || [],
  };
}

function buildDoc(b, guildId, creatorId) {
  return {
    Guild: guildId, Name: b.name,
    Description: (b.description || 'A custom command').slice(0, 100),
    Response: b.response.trim(),
    Creator: creatorId || 'unknown',
    Enabled: b.enabled !== false,
    IsEmbed: !!b.isEmbed, EmbedColor: b.embedColor || '#6C53FF',
    EmbedTitle: b.embedTitle || '', EmbedFooter: b.embedFooter || '',
    EmbedImage: b.embedImage || '', EmbedThumbnail: b.embedThumbnail || '',
    EmbedAuthorName: b.embedAuthorName || '', EmbedAuthorIcon: b.embedAuthorIcon || '',
    EmbedUrl: b.embedUrl || '', EmbedFooterIcon: b.embedFooterIcon || '',
    EmbedFields: (b.embedFields || []).slice(0, MAX.EMBED_FIELDS),
    Ephemeral: !!b.ephemeral, DmAllowed: !!b.dmAllowed,
    Cooldown: Math.max(0, Number(b.cooldown) || 0),
    GlobalCooldown: Math.max(0, Number(b.globalCooldown) || 0),
    DeleteInvoking: !!b.deleteInvoking, RequiredPermission: b.requiredPermission || null,
    MultiResponseEnabled: !!b.multiResponseEnabled,
    ResponseVariants: (b.responseVariants || []).slice(0, MAX.VARIANTS),
    Conditionals:     (b.conditionals    || []).slice(0, MAX.CONDITIONALS),
    Actions:          (b.actions         || []).slice(0, MAX.ACTIONS),
    Buttons:          (b.buttons         || []).slice(0, MAX.BUTTONS),
    AllowedChannels: (b.allowedChannels || []).slice(0, MAX.RESTRICTION_IDS),
    DeniedChannels:  (b.deniedChannels  || []).slice(0, MAX.RESTRICTION_IDS),
    AllowedRoles:    (b.allowedRoles    || []).slice(0, MAX.RESTRICTION_IDS),
    DeniedRoles:     (b.deniedRoles     || []).slice(0, MAX.RESTRICTION_IDS),
    Aliases:    (b.aliases   || []).slice(0, MAX.ALIASES),
    Tags:       (b.tags      || []).slice(0, MAX.TAGS),
    Category:   (b.category  || '').slice(0, MAX.CATEGORY_LEN),
    Arguments:  b.arguments  || [],
  };
}

// ── Shared validation pipeline ────────────────────────────────────────────────

function runValidators(b) {
  const checks = [
    [validateArgs,         b.arguments        || []],
    [validateAliases,      b.aliases          || []],
    [validateTags,         b.tags             || []],
    [validateVariants,     b.responseVariants || []],
    [validateConditionals, b.conditionals     || []],
    [validateActions,      b.actions          || []],
    [validateButtons,      b.buttons          || []],
    [validateEmbedFields,  b.embedFields      || []],
    [validateRestrictions, b.allowedChannels  || []],
    [validateRestrictions, b.deniedChannels   || []],
    [validateRestrictions, b.allowedRoles     || []],
    [validateRestrictions, b.deniedRoles      || []],
  ];
  for (const [fn, data] of checks) {
    const err = fn(data); if (err) return err;
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PAGE ──────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get('/guild/:id/customcommands', isAuth, checkDashboardAccess('commands'), checkPremium, (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/customcommands.html'))
);

// ══════════════════════════════════════════════════════════════════════════════
// ── GET all ───────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get('/api/guild/:id/customcommands', isAuth, checkDashboardAccess('commands'), userThrottle,checkPremium, async (req, res) => {
  try {
    const GuildCommands = require('../../../Schemas/Guildcommandsschema');
    const { getGuildTier, getLimit } = require('../../../Utils/premiumTiers');

    const [commands, guildCmdsDoc, tier] = await Promise.all([
      CustomCommand.find({ Guild: req.params.id }).lean(),
      GuildCommands.findOne({ guildId: req.params.id }).lean(),
      getGuildTier(req.params.id),
    ]);

    const enabledNormalCommands = 0; // built-in commands are global — they don't use guild slots
    const noxxCommandLimit      = getLimit(tier, 'customCommands');

    res.json({
      commands:              commands.map(serializeCmd),
      rateLimits:            getRLStatus(req.params.id),
      enabledNormalCommands,
      noxxCommandLimit:      noxxCommandLimit === Infinity ? null : noxxCommandLimit,
      discordGuildCmdLimit:  100,
      tier,
    });
  } catch (err) {
    console.error('GET customcommands:', err);
    res.status(500).json({ error: 'Failed to fetch commands' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── POST create ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.post('/api/guild/:id/customcommands', isAuth, checkDashboardAccess('commands'), userThrottle, checkPremium,async (req, res) => {
  const guildId = req.params.id;
  const b = req.body;

  if (!b.name || !VALID_NAME.test(b.name)) return res.status(400).json({ error: 'Invalid command name' });
  if (!b.response?.trim())                  return res.status(400).json({ error: 'Response cannot be empty' });
  if (b.response.length > 2000)             return res.status(400).json({ error: 'Response exceeds 2000 chars' });

  const valErr = runValidators(b);
  if (valErr) return res.status(400).json({ error: valErr });

  const count = await CustomCommand.countDocuments({ Guild: guildId });
  const premium = await isPremiumGuild(req.user?.id, guildId);
  const cmdCap = premium ? MAX.COMMANDS_PREMIUM : MAX.COMMANDS_FREE;
  if (count >= cmdCap) return res.status(429).json({ error: `Command limit reached (${cmdCap}). ${premium ? '' : 'Upgrade to Premium to get up to 1,500 commands.'}`.trim() });

  const exists = await CustomCommand.findOne({ Guild: guildId, Name: b.name });
  if (exists) return res.status(409).json({ error: `/${b.name} already exists` });

  for (const alias of (b.aliases || [])) {
    const conflict = await CustomCommand.findOne({ Guild: guildId, $or: [{ Name: alias }, { Aliases: alias }] });
    if (conflict) return res.status(409).json({ error: `Alias "${alias}" conflicts with an existing command` });
  }

  const rlErr = rl(rlStores.guildCreates, guildId, LIMITS.PER_GUILD_CREATES_PER_DAY, DAY_MS, `max ${LIMITS.PER_GUILD_CREATES_PER_DAY} new commands/day`)
             ?? rl(rlStores.globalCreates, 'global', LIMITS.GLOBAL_CREATES_PER_MINUTE, MINUTE_MS, 'global create limit')
             ?? rl(rlStores.globalOps, 'global', LIMITS.GLOBAL_OPS_PER_MINUTE, MINUTE_MS, 'global API limit');
  if (rlErr) return res.status(429).json({ error: rlErr.message, retryAfter: rlErr.retryAfter });

  try {
    await CustomCommand.create(buildDoc(b, guildId, req.user?.id));
  } catch (err) {
    console.error('DB create:', err);
    return res.status(500).json({ error: 'Failed to save command' });
  }

  const { clientId, rest } = await getEffectiveClient(req, guildId);
  if (clientId) {
    const desc    = (b.description || 'A custom command').slice(0, 100);
    const options = buildDiscordOptions(b.arguments || []);
    const perm    = b.requiredPermission || undefined;
    for (const t of [b.name, ...(b.aliases || [])]) {
      discordQueue.enqueue(
        () => rest.post(Routes.applicationGuildCommands(clientId, guildId), {
          body: { name: t, description: desc, type: 1, default_member_permissions: perm, options },
        }),
        `CREATE /${t}`
      );
    }
  }

  res.json({ success: true, name: b.name, rateLimits: getRLStatus(guildId) });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── PATCH update ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.patch('/api/guild/:id/customcommands/:name', isAuth, checkDashboardAccess('commands'), userThrottle,checkPremium, async (req, res) => {
  const guildId = req.params.id;
  const { name } = req.params;
  if (!VALID_NAME.test(name)) return res.status(400).json({ error: 'Invalid command name' });
  const b = req.body;

  if (!b.response?.trim())      return res.status(400).json({ error: 'Response cannot be empty' });
  if (b.response.length > 2000) return res.status(400).json({ error: 'Response exceeds 2000 chars' });

  const valErr = runValidators(b);
  if (valErr) return res.status(400).json({ error: valErr });

  const rlErr = rl(rlStores.guildPatches, guildId, LIMITS.PER_GUILD_PATCHES_PER_HOUR, HOUR_MS, `max ${LIMITS.PER_GUILD_PATCHES_PER_HOUR} edits/hour`)
             ?? rl(rlStores.globalOps, 'global', LIMITS.GLOBAL_OPS_PER_MINUTE, MINUTE_MS, 'global API limit');
  if (rlErr) return res.status(429).json({ error: rlErr.message, retryAfter: rlErr.retryAfter });

  const existing = await CustomCommand.findOne({ Guild: guildId, Name: name });
  if (!existing) return res.status(404).json({ error: `/${name} not found` });

  const oldAliases = existing.Aliases || [];
  const newAliases = (b.aliases || []).slice(0, MAX.ALIASES);

  for (const alias of newAliases) {
    const conflict = await CustomCommand.findOne({
      Guild: guildId, Name: { $ne: name }, $or: [{ Name: alias }, { Aliases: alias }],
    });
    if (conflict) return res.status(409).json({ error: `Alias "${alias}" conflicts with another command` });
  }

  const doc = buildDoc({ ...b, name }, guildId, existing.Creator);
  doc.LastEditedBy = req.user?.id || null;
  delete doc.Creator;

  await CustomCommand.findOneAndUpdate({ Guild: guildId, Name: name }, doc, { new: true });

  const { clientId, rest } = await getEffectiveClient(req, guildId);
  if (clientId) {
    const body = {
      name, description: doc.Description, type: 1,
      default_member_permissions: doc.RequiredPermission || undefined,
      options: buildDiscordOptions(b.arguments || []),
    };
    discordQueue.enqueue(async () => {
      const id = await getDiscordCmdId(rest, clientId, guildId, name);
      if (id) await rest.patch(Routes.applicationGuildCommand(clientId, guildId, id), { body });
      else    await rest.post(Routes.applicationGuildCommands(clientId, guildId), { body });
    }, `PATCH /${name}`);

    for (const alias of oldAliases.filter(a => !newAliases.includes(a))) {
      discordQueue.enqueue(async () => {
        const id = await getDiscordCmdId(rest, clientId, guildId, alias);
        if (id) await rest.delete(Routes.applicationGuildCommand(clientId, guildId, id));
      }, `DELETE alias /${alias}`);
    }
    for (const alias of newAliases.filter(a => !oldAliases.includes(a))) {
      discordQueue.enqueue(
        () => rest.post(Routes.applicationGuildCommands(clientId, guildId), { body: { ...body, name: alias } }),
        `CREATE alias /${alias}`
      );
    }
  }

  const saved = await CustomCommand.findOne({ Guild: guildId, Name: name }).lean();
  res.json({ success: true, command: saved ? serializeCmd(saved) : null, rateLimits: getRLStatus(guildId) });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── DELETE ────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.delete('/api/guild/:id/customcommands/:name', isAuth, checkDashboardAccess('commands'), userThrottle, checkPremium,async (req, res) => {
  const guildId = req.params.id;
  const { name } = req.params;
  if (!VALID_NAME.test(name)) return res.status(400).json({ error: 'Invalid name' });

  const rlErr = rl(rlStores.guildDeletes, guildId, LIMITS.PER_GUILD_DELETES_PER_HOUR, HOUR_MS, `max ${LIMITS.PER_GUILD_DELETES_PER_HOUR} deletes/hour`)
             ?? rl(rlStores.globalOps, 'global', LIMITS.GLOBAL_OPS_PER_MINUTE, MINUTE_MS, 'global API limit');
  if (rlErr) return res.status(429).json({ error: rlErr.message, retryAfter: rlErr.retryAfter });

  const cmd = await CustomCommand.findOneAndDelete({ Guild: guildId, Name: name });
  if (!cmd) return res.status(404).json({ error: `/${name} not found` });

  const { clientId, rest } = await getEffectiveClient(req, guildId);
  if (clientId) {
    for (const t of [name, ...(cmd.Aliases || [])]) {
      discordQueue.enqueue(async () => {
        const id = await getDiscordCmdId(rest, clientId, guildId, t);
        if (id) await rest.delete(Routes.applicationGuildCommand(clientId, guildId, id));
      }, `DELETE /${t}`);
    }
  }

  const saved = await CustomCommand.findOne({ Guild: guildId, Name: name }).lean();
  res.json({ success: true, command: saved ? serializeCmd(saved) : null, rateLimits: getRLStatus(guildId) });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── PATCH toggle enabled/disabled ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.patch('/api/guild/:id/customcommands/:name/toggle', isAuth, checkDashboardAccess('commands'), userThrottle,checkPremium, async (req, res) => {
  const { id: guildId, name } = req.params;
  if (!VALID_NAME.test(name)) return res.status(400).json({ error: 'Invalid name' });
  const cmd = await CustomCommand.findOne({ Guild: guildId, Name: name });
  if (!cmd) return res.status(404).json({ error: `/${name} not found` });
  cmd.Enabled = !cmd.Enabled;
  await cmd.save();
  res.json({ success: true, enabled: cmd.Enabled });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── POST bulk operations ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.post('/api/guild/:id/customcommands/bulk', isAuth, checkDashboardAccess('commands'), userThrottle,checkPremium, async (req, res) => {
  const guildId = req.params.id;
  const { action, names } = req.body;

  if (!Array.isArray(names) || !names.length)         return res.status(400).json({ error: 'No names provided' });
  if (names.length > 25)                              return res.status(400).json({ error: 'Max 25 per bulk op' });
  if (!['enable','disable','delete'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  if (names.some(n => !VALID_NAME.test(n)))            return res.status(400).json({ error: 'Invalid command name in list' });

  const rlErr = rl(rlStores.guildBulk, guildId, LIMITS.PER_GUILD_BULK_OPS_PER_HOUR, HOUR_MS, `max ${LIMITS.PER_GUILD_BULK_OPS_PER_HOUR} bulk ops/hour`);
  if (rlErr) return res.status(429).json({ error: rlErr.message, retryAfter: rlErr.retryAfter });

  const results = { success: [], failed: [] };

  if (action === 'delete') {
    const docs = await CustomCommand.find({ Guild: guildId, Name: { $in: names } }).lean();
    await CustomCommand.deleteMany({ Guild: guildId, Name: { $in: names } });
    const { clientId, rest } = await getEffectiveClient(req, guildId);
    for (const doc of docs) {
      results.success.push(doc.Name);
      if (clientId) for (const t of [doc.Name, ...(doc.Aliases||[])]) {
        discordQueue.enqueue(async () => {
          const id = await getDiscordCmdId(rest, clientId, guildId, t);
          if (id) await rest.delete(Routes.applicationGuildCommand(clientId, guildId, id));
        }, `BULK DELETE /${t}`);
      }
    }
  } else {
    await CustomCommand.updateMany({ Guild: guildId, Name: { $in: names } }, { Enabled: action === 'enable' });
    results.success = names;
  }

  res.json({ success: true, results, rateLimits: getRLStatus(guildId) });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── GET export ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get('/api/guild/:id/customcommands/export', isAuth, checkDashboardAccess('commands'), userThrottle,checkPremium, async (req, res) => {
  const guildId = req.params.id;
  const rlErr   = rl(rlStores.guildExports, guildId, LIMITS.PER_GUILD_EXPORTS_PER_HOUR, HOUR_MS, `max ${LIMITS.PER_GUILD_EXPORTS_PER_HOUR} exports/hour`);
  if (rlErr) return res.status(429).json({ error: rlErr.message, retryAfter: rlErr.retryAfter });

  const commands = await CustomCommand.find({ Guild: guildId }).lean();
  const payload  = {
    exportedAt: new Date().toISOString(), guildId, version: 3,
    commands: commands.map(c => {
      const s = serializeCmd(c);
      ['usageCount','lastUsedAt','creator','lastEditedBy','createdAt','updatedAt'].forEach(k => delete s[k]);
      return s;
    }),
  };

  res.setHeader('Content-Disposition', `attachment; filename="commands-${guildId}-${Date.now()}.json"`);
  res.json(payload);
});

// ══════════════════════════════════════════════════════════════════════════════
// ── POST import ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.post('/api/guild/:id/customcommands/import', isAuth, checkDashboardAccess('commands'), userThrottle, checkPremium,async (req, res) => {
  const guildId = req.params.id;
  const { commands, overwrite = false } = req.body;

  if (!Array.isArray(commands) || !commands.length) return res.status(400).json({ error: 'No commands provided' });
  if (commands.length > MAX.IMPORT_BATCH)           return res.status(400).json({ error: `Max ${MAX.IMPORT_BATCH} per import` });

  const rlErr = rl(rlStores.guildImports, guildId, LIMITS.PER_GUILD_IMPORTS_PER_DAY, DAY_MS, `max ${LIMITS.PER_GUILD_IMPORTS_PER_DAY} imports/day`);
  if (rlErr) return res.status(429).json({ error: rlErr.message, retryAfter: rlErr.retryAfter });

  const currentCount = await CustomCommand.countDocuments({ Guild: guildId });
  const premium = await isPremiumGuild(req.user?.id, guildId);
  const cmdCap = premium ? MAX.COMMANDS_PREMIUM : MAX.COMMANDS_FREE;
  if (currentCount + commands.length > cmdCap)
    return res.status(400).json({ error: `Would exceed the ${cmdCap} command limit${premium ? '' : '. Upgrade to Premium for up to 1,500 commands'}` });

  const results = { imported: [], skipped: [], failed: [] };

  for (const c of commands) {
    if (!c.name || !VALID_NAME.test(c.name) || !c.response?.trim()) { results.failed.push(c.name||'?'); continue; }
    try {
      const exists = await CustomCommand.findOne({ Guild: guildId, Name: c.name });
      if (exists && !overwrite) { results.skipped.push(c.name); continue; }
      const doc = buildDoc(c, guildId, req.user?.id || 'import');
      if (exists) await CustomCommand.findOneAndUpdate({ Guild: guildId, Name: c.name }, doc);
      else        await CustomCommand.create(doc);
      results.imported.push(c.name);

      const { clientId, rest } = await getEffectiveClient(req, guildId);
      if (clientId) {
        const rlC = rl(rlStores.guildCreates, guildId, LIMITS.PER_GUILD_CREATES_PER_DAY, DAY_MS, '');
        if (!rlC) discordQueue.enqueue(
          () => rest.post(Routes.applicationGuildCommands(clientId, guildId), {
            body: { name: c.name, description: (c.description||'A custom command').slice(0,100), type: 1, options: buildDiscordOptions(c.arguments||[]) },
          }),
          `IMPORT /${c.name}`
        );
      }
    } catch (err) { console.error(`Import /${c.name}:`, err); results.failed.push(c.name); }
  }

  res.json({ success: true, results });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── GET usage stats ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

router.get('/api/guild/:id/customcommands/stats', isAuth, checkDashboardAccess('commands'), userThrottle, checkPremium,async (req, res) => {
  const guildId  = req.params.id;
  const commands = await CustomCommand.find({ Guild: guildId }, 'Name UsageCount LastUsedAt Enabled Tags Category').lean();
  res.json({
    total:     commands.length,
    enabled:   commands.filter(c => c.Enabled !== false).length,
    disabled:  commands.filter(c => c.Enabled === false).length,
    totalUses: commands.reduce((s, c) => s + (c.UsageCount || 0), 0),
    topCommands: [...commands].sort((a, b) => (b.UsageCount||0) - (a.UsageCount||0)).slice(0, 5)
      .map(c => ({ name: c.Name, uses: c.UsageCount||0, lastUsed: c.LastUsedAt })),
    byCategory: Object.entries(commands.reduce((acc, c) => {
      const cat = c.Category || 'Uncategorised'; acc[cat] = (acc[cat]||0)+1; return acc;
    }, {})).map(([name, count]) => ({ name, count })),
    byTag: Object.entries(commands.flatMap(c => c.Tags||[]).reduce((acc, t) => {
      acc[t] = (acc[t]||0)+1; return acc;
    }, {})).map(([name, count]) => ({ name, count })),
    rateLimits: getRLStatus(guildId),
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Dev: rate limit inspector ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

if (process.env.NODE_ENV !== 'production') {
  router.get('/api/guild/:id/customcommands/_ratelimits', isAuth, checkDashboardAccess('commands'), checkPremium, (req, res) =>
    res.json({ ...getRLStatus(req.params.id), limits: LIMITS })
  );
}

module.exports = router;