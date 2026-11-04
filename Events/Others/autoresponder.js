const Autoresponder = require("../../Schemas/Autoresponder.js");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  MessageFlags,
} = require("discord.js");

// ── Cache: guildId → { data, fetchedAt } ──────────────────────────────────────
const autoresponderCache = new Map();
const CACHE_TTL_MS       = 60_000;   // 1 minute

// ── Guild cooldown: guildId → last-responded timestamp ───────────────────────
const guildCooldowns       = new Map();
const AUTORESPOND_COOLDOWN = 1500;    // 1.5 s between responses per guild

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a V1 EmbedBuilder from stored embed data.
 */
function buildEmbed(embedData, message) {
  const eb      = new EmbedBuilder();
  const resolve = (s) =>
    (s || "")
      .replace(/{user}/g,     message.author.toString())
      .replace(/{username}/g, message.author.username)
      .replace(/{server}/g,   message.guild.name);

  if (embedData.color)       eb.setColor(embedData.color);
  if (embedData.title)       eb.setTitle(resolve(embedData.title).slice(0, 256));
  if (embedData.description) eb.setDescription(resolve(embedData.description).slice(0, 4096));
  if (embedData.authorName)  eb.setAuthor({ name: resolve(embedData.authorName).slice(0, 256), iconURL: embedData.authorIcon || undefined });
  if (embedData.thumbnail)   eb.setThumbnail(embedData.thumbnail);
  if (embedData.image)       eb.setImage(embedData.image);
  if (embedData.footerText)  eb.setFooter({ text: resolve(embedData.footerText).slice(0, 2048), iconURL: embedData.footerIcon || undefined });
  if (embedData.timestamp)   eb.setTimestamp();

  if (Array.isArray(embedData.fields)) {
    for (const f of embedData.fields.slice(0, 25)) {
      if (f.name && f.value)
        eb.addFields({
          name:   resolve(f.name).slice(0, 256),
          value:  resolve(f.value).slice(0, 1024),
          inline: !!f.inline,
        });
    }
  }

  return eb;
}

/**
 * Build a Discord ActionRowBuilder from stored button data.
 */
function buildButtonRow(buttonsData) {
  if (!buttonsData?.components?.length) return null;

  const row = new ActionRowBuilder();

  for (const b of buttonsData.components.slice(0, 5)) {
    if (!b.label) continue;

    const btn = new ButtonBuilder()
      .setLabel(b.label)
      .setStyle(Number(b.style) || 1)
      .setDisabled(!!b.disabled);

    if (Number(b.style) === 5) {
      btn.setURL(b.url || "https://example.com");
    } else {
      btn.setCustomId(
        b.custom_id ||
        `ar_btn_${Math.random().toString(36).slice(2, 10)}`
      );
    }

    if (b.emoji?.name) btn.setEmoji(b.emoji.name);

    try { row.addComponents(btn); } catch { /* skip invalid */ }
  }

  return row.components.length ? row : null;
}

/**
 * Resolve variables in a plain-text string.
 */
function resolveVars(s, message) {
  return (s || "")
    .replace(/{user}/g,     message.author.toString())
    .replace(/{username}/g, message.author.username)
    .replace(/{server}/g,   message.guild.name);
}

// ── Button interaction handler ────────────────────────────────────────────────
// Registered once per process; handles _action payloads stored on buttons.

let buttonHandlerRegistered = false;

function registerButtonHandler(client) {
  if (buttonHandlerRegistered) return;
  buttonHandlerRegistered = true;

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    // Only handle autoresponder buttons (custom_id starts with ar_btn_ OR has a stored action)
    // We look up the original message's autoresponder to find the action.
    // Since actions are embedded in the component's _action field at send-time
    // (not stored server-side per interaction), we need them stored in customId or fetched.
    //
    // Approach: encode a short action key in the custom_id: "ar:<type>:<params>"
    const id = interaction.customId;
    if (!id.startsWith("ar:")) return;

    const parts      = id.split(":");
    const actionType = parts[1];

    try {
      if (actionType === "reply") {
        const content   = decodeURIComponent(parts[2] || "");
        const ephemeral = parts[3] !== "0";
        await interaction.reply({ content: content || "Action triggered!", ephemeral });

      } else if (actionType === "dm") {
        const content = decodeURIComponent(parts[2] || "");
        await interaction.user.send(content).catch(() => {});
        await interaction.reply({ content: "<a:tickyy:1555544712687915008> Check your DMs!", ephemeral: true });

      } else if (actionType === "role_add") {
        const roleId = parts[2];
        if (!roleId) return interaction.reply({ content: "No role configured.", ephemeral: true });
        const member = interaction.member;
        if (member.roles.cache.has(roleId)) {
          return interaction.reply({ content: "You already have this role.", ephemeral: true });
        }
        await member.roles.add(roleId);
        await interaction.reply({ content: "<a:tickyy:1555544712687915008> Role added!", ephemeral: true });

      } else if (actionType === "role_remove") {
        const roleId = parts[2];
        if (!roleId) return interaction.reply({ content: "No role configured.", ephemeral: true });
        await interaction.member.roles.remove(roleId);
        await interaction.reply({ content: "<a:tickyy:1555544712687915008> Role removed!", ephemeral: true });

      } else if (actionType === "role_toggle") {
        const roleId = parts[2];
        if (!roleId) return interaction.reply({ content: "No role configured.", ephemeral: true });
        const member = interaction.member;
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId);
          await interaction.reply({ content: "<a:tickyy:1555544712687915008> Role removed!", ephemeral: true });
        } else {
          await member.roles.add(roleId);
          await interaction.reply({ content: "<a:tickyy:1555544712687915008> Role added!", ephemeral: true });
        }
      }
    } catch (err) {
      console.error("[AutoresponderButtonHandler]", err.message);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "<:crossy:1555544390221562048> An error occurred.", ephemeral: true }).catch(() => {});
      }
    }
  });
}

/**
 * Build a custom_id that encodes the button action so it survives restarts.
 */
function buildActionCustomId(btn) {
  const action = btn._action;
  if (!action || action.type === "none" || !action.type) {
    return btn.custom_id || `ar_btn_${Math.random().toString(36).slice(2, 8)}`;
  }

  // Encode action into the custom_id (max 100 chars)
  const base = `ar:${action.type}`;

  if (action.type === "reply" || action.type === "dm") {
    // Truncate content to fit within 100 char limit
    const content     = encodeURIComponent((action.content || "").slice(0, 60));
    const ephemeral   = action.ephemeral !== false ? "1" : "0";
    return `${base}:${content}:${ephemeral}`.slice(0, 100);
  }

  if (action.type.startsWith("role_")) {
    return `${base}:${action.roleId || ""}`.slice(0, 100);
  }

  return `${base}:${Date.now()}`.slice(0, 100);
}

// ── Event Handler ─────────────────────────────────────────────────────────────

module.exports = {
  name: "messageCreate",

  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.guild)     return;

    // Register button interaction handler once
    registerButtonHandler(client);

    // Guild cooldown check
    const now          = Date.now();
    const lastResponded = guildCooldowns.get(message.guild.id) ?? 0;
    if (now - lastResponded < AUTORESPOND_COOLDOWN) return;

    // Cache or DB fetch
    const cached = autoresponderCache.get(message.guild.id);
    let autoresponders;

    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      autoresponders = cached.data;
    } else {
      autoresponders = await Autoresponder.find({ guildId: message.guild.id }).lean();
      autoresponderCache.set(message.guild.id, { data: autoresponders, fetchedAt: now });
    }

    if (!autoresponders.length) return;

    const content = message.content.toLowerCase();

    for (const auto of autoresponders) {
      if (!content.includes(auto.trigger.toLowerCase())) continue;

      // ── Hit — set cooldown ──────────────────────────────────────────────────
      guildCooldowns.set(message.guild.id, now);

      const payload = {
        allowedMentions: { parse: ["users", "roles"], repliedUser: false },
      };

      // ── V2 Components ───────────────────────────────────────────────────────
      if (Array.isArray(auto.v2Components) && auto.v2Components.length) {
        // V2 messages require the IS_COMPONENTS_V2 flag (1 << 15 = 32768)
        payload.flags      = MessageFlags.IsComponentsV2 ?? (1 << 15);
        payload.components = auto.v2Components;
        return message.reply(payload);
      }

      // ── V1 Embed + optional plain text ─────────────────────────────────────
      if (auto.embed?.enabled) {
        payload.embeds = [buildEmbed(auto.embed, message)];
        if (auto.response) {
          payload.content = resolveVars(auto.response, message);
        }
      } else {
        // Plain text
        payload.content = resolveVars(auto.response || "", message);
        if (!payload.content) payload.content = "\u200B"; // zero-width space fallback
      }

      // ── Action row buttons ──────────────────────────────────────────────────
      if (auto.buttons?.components?.length) {
        // Re-build buttons with encoded action custom IDs
        const row = new ActionRowBuilder();

        for (const b of auto.buttons.components.slice(0, 5)) {
          if (!b.label) continue;

          const btn = new ButtonBuilder()
            .setLabel(b.label)
            .setStyle(Number(b.style) || 1)
            .setDisabled(!!b.disabled);

          if (Number(b.style) === 5) {
            btn.setURL(b.url || "https://example.com");
          } else {
            btn.setCustomId(buildActionCustomId(b));
          }

          if (b.emoji?.name) btn.setEmoji(b.emoji.name);

          try { row.addComponents(btn); } catch { /* skip invalid */ }
        }

        if (row.components.length) payload.components = [row];
      }

      return message.reply(payload);
    }
  },
};