const { Events, ActivityType, REST, Routes } = require('discord.js');
const customCommandSchema = require('../Schemas/customCommandSchema.js');
const GuildCommands = require('../Schemas/Guildcommandsschema.js');
const MemberStats = require('../Schemas/memberStats.js');
const PendingDeletion = require('../Schemas/PendingDeletion');
const fs = require('fs');
const path = require('path');
const { restorePolls: rehydratePolls } = require('../Commands/Community/poll');

const SCHEMA_PATH = path.join(__dirname, "../Schemas");

// ── Map stored type strings → Discord ApplicationCommandOptionType integers ──
const DISCORD_OPTION_TYPE = {
  STRING: 3, INTEGER: 4, BOOLEAN: 5, USER: 6, CHANNEL: 7,
  ROLE: 8, MENTIONABLE: 9, NUMBER: 10, ATTACHMENT: 11,
};

function argToDiscordOption(arg) {
  const type = DISCORD_OPTION_TYPE[arg.type] ?? DISCORD_OPTION_TYPE.STRING;
  const option = {
    type,
    name:        arg.name.toLowerCase(),
    description: arg.description || 'An argument',
    required:    !!arg.required,
  };
  if ([3, 4, 10].includes(type) && Array.isArray(arg.choices) && arg.choices.length) {
    option.choices = arg.choices
      .filter(c => c.name && c.value != null)
      .map(c => ({ name: c.name, value: type === 3 ? String(c.value) : Number(c.value) }))
      .slice(0, 25);
  }
  if ([3, 4, 10].includes(type) && arg.autocomplete && !option.choices?.length) {
    option.autocomplete = true;
  }
  if (type === 3) {
    if (arg.minLength != null) option.min_length = Math.max(0, Math.floor(arg.minLength));
    if (arg.maxLength != null) option.max_length = Math.min(6000, Math.floor(arg.maxLength));
  }
  if (type === 4 || type === 10) {
    if (arg.minValue != null) option.min_value = arg.minValue;
    if (arg.maxValue != null) option.max_value = arg.maxValue;
  }
  if (type === 7 && Array.isArray(arg.channelTypes) && arg.channelTypes.length) {
    option.channel_types = arg.channelTypes;
  }
  return option;
}

function buildCommandPayload(cmd) {
  const args   = Array.isArray(cmd.Arguments) ? cmd.Arguments : [];
  const sorted = [...args.filter(a => a.required), ...args.filter(a => !a.required)];
  const payload = {
    name:        cmd.Name.toLowerCase(),
    description: cmd.Description || 'A custom command',
  };
  if (sorted.length) payload.options = sorted.map(argToDiscordOption);
  return payload;
}

// ── Activity type string → Discord.js ActivityType integer ───────────────────
const ACTIVITY_TYPE_MAP = {
  PLAYING:    ActivityType.Playing,    // 0
  STREAMING:  ActivityType.Streaming,  // 1
  LISTENING:  ActivityType.Listening,  // 2
  WATCHING:   ActivityType.Watching,   // 3
  CUSTOM:     ActivityType.Custom,     // 4
  COMPETING:  ActivityType.Competing,  // 5
};

// ── Member stats ─────────────────────────────────────────────────────────────
async function collectMemberStats(client, logStep, theme) {
  let saved = 0, failed = 0;
  for (const guild of client.guilds.cache.values()) {
    try {
      await guild.members.fetch();
      const bots   = guild.members.cache.filter(m => m.user.bot).size;
      const humans = guild.members.cache.filter(m => !m.user.bot).size;
      // Upsert one document per guild per calendar day.
      // Using create() caused duplicate entries on every bot restart
      // (multiple docs with the same date), making the stats chart useless.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await MemberStats.findOneAndUpdate(
        { GuildID: guild.id, Date: today },
        { $set: { Members: guild.memberCount, Humans: humans, Bots: bots } },
        { upsert: true }
      );
      saved++;
    } catch (e) {
      console.error(`[MemberStats] Failed snapshot for guild ${guild.id} (${guild.name}): ${e.message}`);
      failed++;
    }
  }
  logStep(
    'STATS',
    `Member snapshots saved: ${saved} guild(s)${failed ? ` | ${failed} failed` : ''}`,
    failed ? theme.yellow : theme.green,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Restore guild-scoped command registrations from the database after a restart.
//
// When the bot restarts, any guild-scoped command overrides registered via the
// Dashboard "Command Manager" are wiped — Discord only holds them in-memory per
// REST session, not permanently. The GuildCommands schema records which commands
// each guild has enabled, so we re-POST them to Discord on every boot.
//
// Runs fully in the background after the guild cache is populated. Errors per
// guild are swallowed so one bad guild never blocks the rest.
// ─────────────────────────────────────────────────────────────────────────────
async function restoreGuildCommands(client) {
  try {
    const rest  = new REST({ version: '10' }).setToken(process.env.token ?? process.env.BOT_TOKEN);
    const appId = client.user?.id;
    if (!appId) return;

    // Determine which guilds have custom branding (they handle their own command registration)
    let cbGuildIds = new Set();
    try {
      const cbActive = await require('../Schemas/customBrandingSchema').find({ enabled: true }).select('guildId').lean();
      cbGuildIds = new Set(cbActive.map(c => c.guildId));
    } catch { /* non-fatal */ }

    // Build a map of guildId → custom command payloads for all guilds
    const customCommandsByGuild = new Map();
    for (const guild of client.guilds.cache.values()) {
      if (cbGuildIds.has(guild.id)) continue;
      try {
        const customCommands = await customCommandSchema.find({ Guild: guild.id });
        if (customCommands.length) {
          customCommandsByGuild.set(guild.id, customCommands.map(buildCommandPayload));
        }
      } catch { /* non-fatal — skip this guild's custom commands */ }
    }

    // Fetch ALL guilds that have a GuildCommands doc — not just those with enabled commands.
    // Guilds that disabled all commands (enabledCommands = []) must also be synced so their
    // Discord guild command list is cleared. Skipping them leaves stale commands visible.
    const allDocs = await GuildCommands.find({}).lean();

    // Collect every guild that needs a PUT: those with a GuildCommands doc OR custom commands
    const allGuildIds = new Set([
      ...allDocs.map(d => d.guildId),
      ...customCommandsByGuild.keys(),
    ]);

    if (!allGuildIds.size) return;

    console.log(`[GuildCommands] Restoring commands for ${allGuildIds.size} guild(s) after restart…`);
    let restored = 0, skipped = 0;

    // Index docs by guildId for O(1) lookup
    const docByGuild = new Map(allDocs.map(d => [d.guildId, d]));

    for (const guildId of allGuildIds) {
      // Skip guilds the bot is no longer a member of — avoids 403s from Discord
      if (!client.guilds.cache.has(guildId)) { skipped++; continue; }

      try {
        const body = [];

        // Built-in commands are global; guild-scoped registrations are only this server's custom commands.
        // The PUT also clears built-ins left over from the old per-server opt-in system.
        // Custom commands for this guild (if any)
        const customCmds = customCommandsByGuild.get(guildId);
        if (customCmds?.length) body.push(...customCmds);

        // Single bulk PUT per guild — atomically sets Discord's guild command list
        // to exactly the combined set. Removes stale/disabled commands, adds missing ones.
        await rest.put(Routes.applicationGuildCommands(appId, guildId), { body });
        restored++;
      } catch { skipped++; }
    }

    console.log(`[GuildCommands] Restore complete — ${restored} guild(s) restored, ${skipped} skipped.`);
  } catch (err) {
    console.warn('[GuildCommands] restoreGuildCommands failed:', err.message);
  }
}


module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    const theme = {
      reset: "\x1b[0m", bright: "\x1b[1m", cyan: "\x1b[36m", green: "\x1b[32m",
      yellow: "\x1b[33m", red: "\x1b[31m", gray: "\x1b[90m",
    };
    const sep = theme.gray + '-------------------------------------------' + theme.reset;
    const logStep = (label, msg, color = theme.cyan) => {
      console.log(sep);
      console.log(`${theme.gray}[${new Date().toLocaleTimeString()}]${theme.reset} ${color}${theme.bright}[${label}]${theme.reset} ${msg}`);
      console.log(sep);
    };

    try {
      // ── Normalise status — must be a valid presence string ────────────────
      if (!client.config.status) client.config.status = 'online';

      // ── Normalise activity — config.js may supply a plain string instead of
      //    an object. Discord.js requires { type, name }; a raw string throws
      //    "Supplied activities[0].name is not a string" and crashes the handler
      //    before the rotation interval is ever registered.
      // Start with the first configured custom status (src/config/bot.js → activities)
      if (Array.isArray(client.config.activities) && client.config.activities.length) {
        client.config.activity = { type: ActivityType.Custom, name: String(client.config.activities[0]) };
      }
      if (!client.config.activity) {
        client.config.activity = { type: ActivityType.Watching, name: `${client.commands.size} slash commands!` };
      } else if (typeof client.config.activity === 'string') {
        client.config.activity = { type: ActivityType.Watching, name: client.config.activity };
      }

      // ── applyPresence — single atomic gateway send via setPresence ────────
      // Using separate setStatus + setActivity sends two gateway payloads that
      // can race; the second overwrites the first and loses the status field.
      function applyPresence(status, activity) {
        if (!client.isReady()) return;
        client.user.setPresence({ status, activities: [activity] });
      }

      if (client.config.overrideStatus) {
        applyPresence(
          client.config.overrideStatusValue || 'online',
          client.config.overrideActivity || client.config.activity,
        );
        logStep('STATUS', `Override active → ${client.config.overrideStatusValue} / "${client.config.overrideActivity?.name}"`, theme.cyan);
      } else {
        applyPresence(client.config.status, client.config.activity);
        logStep('STATUS', `Bot status loaded as ${client.config.status} with activity: ${client.config.activity.name}`, theme.green);
      }

      // Rotating status: handled by src/lib/errorHandlers.js (list in src/config/bot.js → activities)

      // ── resumeRotatingStatus: now handled by the watchdog's own rotating loop ──
      // (errorHandlers.js owns a durable interval that survives reconnects and
      //  also listens for this event to immediately set a fresh presence.
      //  No duplicate listener needed here.)

      // ── devPresence: manual override from the dashboard ───────────────────
      client.on('devPresence', async ({ status, type, text }) => {
        try {
          const activityType = ACTIVITY_TYPE_MAP[type] ?? ActivityType.Custom;

          client.config.overrideStatus      = true;
          client.config.overrideActivity    = { type: activityType, name: text };
          client.config.overrideStatusValue = status;

          applyPresence(status, { type: activityType, name: text });

          logStep('PRESENCE', `Permanent override set → ${status} / ${type} "${text}"`, theme.cyan);
        } catch (err) {
          console.error(`[PRESENCE] Failed to apply devPresence override: ${err.message}`);
        }
      });

      // ── devPresenceClear: restore rotating status ─────────────────────────
      client.on('devPresenceClear', async () => {
        try {
          client.config.overrideStatus      = false;
          client.config.overrideActivity    = null;
          client.config.overrideStatusValue = null;

          applyPresence(
            client.config.status || 'online',
            client.config.activity || { type: ActivityType.Custom, name: '🔗 rankcore.org' },
          );

          logStep('PRESENCE', 'Override cleared — rotating status resumed', theme.green);
        } catch (err) {
          console.error(`[PRESENCE] Failed to clear devPresence override: ${err.message}`);
        }
      });

      // ── Shard events for WSS status ──────────────────────────────────────
      client.on('shardReady', (shardId) => {
        if (client._wssServer) client._wssServer.broadcastShardUpdate();
      });
      client.on('shardDisconnect', (_closeEvent, shardId) => {
        if (client._wssServer) client._wssServer.broadcastShardUpdate();
      });
      client.on('shardReconnecting', (shardId) => {
        if (client._wssServer) client._wssServer.broadcastShardUpdate();
      });
      client.on('shardResume', (shardId, _replayedEvents) => {
        if (client._wssServer) client._wssServer.broadcastShardUpdate();
      });

      // ── Member stats ──────────────────────────────────────────────────────
      await collectMemberStats(client, logStep, theme);
      setInterval(() => collectMemberStats(client, logStep, theme), 24 * 60 * 60 * 1000);

      // ── Guild events ──────────────────────────────────────────────────────
      client.on('guildCreate', guild => {
        logStep('BOT', `Joined new guild: ${guild.name}`, theme.cyan);
        PendingDeletion.removeIfRejoined(guild.id).catch(() => {});
      });
      client.on('guildDelete', guild => {
        logStep('BOT', `Left guild: ${guild.name}`, theme.yellow);
        PendingDeletion.markForDeletion(guild.id).catch(() => {});
      });

      // ── Schema cleanup via MongoDB ─────────────────────────────────────────
      const schemaCleanup = async () => {
        try {
          const expired = await PendingDeletion.getExpired();
          for (const { guildId } of expired) {
            if (client.guilds.cache.has(guildId)) {
              await PendingDeletion.removeGuild(guildId);
              continue;
            }
            const files = fs.readdirSync(SCHEMA_PATH);
            for (const file of files) {
              if (file.includes(guildId)) {
                fs.unlinkSync(path.join(SCHEMA_PATH, file));
              }
            }
            await PendingDeletion.removeGuild(guildId);
          }
        } catch (err) {
          console.error(`[SchemaCleanup] Error: ${err.message}`);
        }
      };

      setInterval(schemaCleanup, 5 * 60 * 1000);

      // ── Re-hydrate persistent polls ───────────────────────────────────────
      await rehydratePolls(client);

      // ── Restore guild-scoped command registrations from DB ────────────────
      // Runs in the background — guild cache is populated at this point so it
      // is safe to check membership and re-POST missing guild-scoped commands.
      restoreGuildCommands(client).catch(err =>
        logStep('STATUS', `[GuildCommands] Background restore error: ${err.message}`, theme.red)
      );

    } catch (error) {
      logStep('STATUS', `Error in ClientReady: ${error}`, theme.red);
    }
  },
};