const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const AutoMod = require("../../Schemas/AutoModSchema");

const RATE_TYPES = [
  { name: "Messages",    value: "messages"    },
  { name: "Mentions",    value: "mentions"    },
  { name: "Links",       value: "links"       },
  { name: "Caps %",      value: "caps"        },
  { name: "Duplicates",  value: "duplicates"  },
  { name: "Attachments", value: "attachments" },
  { name: "Emojis",      value: "emojis"      },
  { name: "Newlines",    value: "newlines"    },
];

const ACTIONS = [
  { name: "Warn",   value: "warn"   },
  { name: "Delete", value: "delete" },
  { name: "Mute",   value: "mute"   },
  { name: "Kick",   value: "kick"   },
  { name: "Ban",    value: "ban"    },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("advanced-automod")
    .setDescription("Configure the AutoMod system.")

    // ── status ────────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName("status")
      .setDescription("Enable or disable AutoMod.")
      .addBooleanOption(o => o
        .setName("enabled")
        .setDescription("Turn AutoMod on or off.")
        .setRequired(true)
      )
    )

    // ── rate-rule ─────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName("rate-rule")
      .setDescription("Add or update a rate-limit rule.")
      .addStringOption(o => o
        .setName("type")
        .setDescription("What to rate-limit")
        .setRequired(true)
        .addChoices(...RATE_TYPES)
      )
      .addIntegerOption(o => o
        .setName("limit")
        .setDescription("Max occurrences before punishment fires")
        .setRequired(true)
        .setMinValue(1)
      )
      .addIntegerOption(o => o
        .setName("window")
        .setDescription("Sliding time window in seconds (0 = per-message, e.g. for caps)")
        .setRequired(true)
        .setMinValue(0)
      )
      .addStringOption(o => o
        .setName("action")
        .setDescription("Punishment to apply")
        .setRequired(true)
        .addChoices(...ACTIONS)
      )
    )

    // ── warn-step ─────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName("warn-step")
      .setDescription("Add or update a warn-ladder escalation step.")
      .addIntegerOption(o => o
        .setName("count")
        .setDescription("Warn count that triggers this step")
        .setRequired(true)
        .setMinValue(1)
      )
      .addStringOption(o => o
        .setName("action")
        .setDescription("Punishment at this warn count")
        .setRequired(true)
        .addChoices(...ACTIONS)
      )
      .addStringOption(o => o
        .setName("note")
        .setDescription("Optional note, e.g. mute duration '10m'")
        .setRequired(false)
      )
    )

    // ── banned-word ───────────────────────────────────────────────────────────
    .addSubcommandGroup(group => group
      .setName("words")
      .setDescription("Manage the banned words list.")
      .addSubcommand(sub => sub
        .setName("add")
        .setDescription("Add a banned word or phrase.")
        .addStringOption(o => o
          .setName("word")
          .setDescription("Word or phrase to ban")
          .setRequired(true)
        )
      )
      .addSubcommand(sub => sub
        .setName("remove")
        .setDescription("Remove a banned word or phrase.")
        .addStringOption(o => o
          .setName("word")
          .setDescription("Word or phrase to remove")
          .setRequired(true)
        )
      )
      .addSubcommand(sub => sub
        .setName("list")
        .setDescription("List all banned words.")
      )
      .addSubcommand(sub => sub
        .setName("action")
        .setDescription("Set the punishment for word-filter hits.")
        .addStringOption(o => o
          .setName("action")
          .setDescription("Punishment")
          .setRequired(true)
          .addChoices(...ACTIONS)
        )
        .addIntegerOption(o => o
          .setName("mute-minutes")
          .setDescription("Mute duration in minutes (only used when action is mute)")
          .setRequired(false)
          .setMinValue(1)
        )
      )
    )

    // ── regex-rule ────────────────────────────────────────────────────────────
    .addSubcommandGroup(group => group
      .setName("regex")
      .setDescription("Manage regex pattern rules.")
      .addSubcommand(sub => sub
        .setName("add")
        .setDescription("Add a regex rule.")
        .addStringOption(o => o
          .setName("pattern")
          .setDescription("Regex pattern (no slashes, e.g. https?://\\S+)")
          .setRequired(true)
        )
        .addStringOption(o => o
          .setName("action")
          .setDescription("Punishment on match")
          .setRequired(true)
          .addChoices(...ACTIONS)
        )
        .addStringOption(o => o
          .setName("description")
          .setDescription("Optional label for this rule")
          .setRequired(false)
        )
      )
      .addSubcommand(sub => sub
        .setName("remove")
        .setDescription("Remove a regex rule by its pattern.")
        .addStringOption(o => o
          .setName("pattern")
          .setDescription("Pattern to remove (must match exactly)")
          .setRequired(true)
        )
      )
      .addSubcommand(sub => sub
        .setName("list")
        .setDescription("List all regex rules.")
      )
    )

    // ── view ──────────────────────────────────────────────────────────────────
    .addSubcommand(sub => sub
      .setName("view")
      .setDescription("View the full AutoMod configuration.")
    ),

  category: "Moderation",
  categoryDescription: "Tools for managing user behavior including AutoMod, anti-spam, and anti-raid.",
  usage: "/automod <subcommand>",
  examples: [
    "/automod status enabled:true",
    "/automod rate-rule type:messages limit:5 window:5 action:warn",
    "/automod rate-rule type:caps limit:70 window:0 action:mute",
    "/automod warn-step count:3 action:mute note:10m",
    "/automod words add word:badword",
    "/automod words action action:mute mute-minutes:10",
    "/automod regex add pattern:discord\\.gg/\\S+ action:delete description:Invite links",
    "/automod view",
  ],
  permissions: ["ManageGuild"],

  async execute(interaction, client) {
    if (!interaction.member.permissions.has("ManageGuild")) {
      return interaction.reply({
        content: "You need the **Manage Server** permission to use this command.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const guildId    = interaction.guild.id;
    const guildName  = interaction.guild.name;
    const guildIcon  = interaction.guild.iconURL();
    const color      = client.config?.embedColor || "#53FF6C";

    const sub   = interaction.options.getSubcommand(false);
    const group = interaction.options.getSubcommandGroup(false);

    // ── Upsert helper ──────────────────────────────────────────────────────
    async function getOrCreate() {
      return await AutoMod.findOneAndUpdate(
        { guildId },
        { $setOnInsert: { guildId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // /automod status
    // ─────────────────────────────────────────────────────────────────────
    if (sub === "status") {
      const enabled = interaction.options.getBoolean("enabled");
      await AutoMod.findOneAndUpdate({ guildId }, { $set: { status: enabled } }, { upsert: true });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle("AutoMod Status")
          .setDescription(`AutoMod has been **${enabled ? "enabled <a:tickyy:1567797045253644368>" : "disabled <:crossy:1567796959648030831>"}**.`)
          .setColor(enabled ? "#53FF6C" : "#ff5353")
          .setFooter({ text: guildName, iconURL: guildIcon })],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // /automod rate-rule
    // ─────────────────────────────────────────────────────────────────────
    if (sub === "rate-rule") {
      const type   = interaction.options.getString("type");
      const limit  = interaction.options.getInteger("limit");
      const window = interaction.options.getInteger("window");
      const action = interaction.options.getString("action");

      const cfg = await getOrCreate();
      const existing = cfg.rateRules.findIndex(r => r.type === type);

      if (existing >= 0) {
        cfg.rateRules[existing] = { type, limit, window, action };
      } else {
        cfg.rateRules.push({ type, limit, window, action });
      }
      await cfg.save();

      const windowText = window > 0 ? `${window}s window` : "per message";

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle("Rate-Limit Rule Updated")
          .setDescription(`**${type}** rule set: **${limit}** max in **${windowText}** → **${action}**.`)
          .setColor(color)
          .setFooter({ text: guildName, iconURL: guildIcon })],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // /automod warn-step
    // ─────────────────────────────────────────────────────────────────────
    if (sub === "warn-step") {
      const count  = interaction.options.getInteger("count");
      const action = interaction.options.getString("action");
      const note   = interaction.options.getString("note") || "";

      const cfg = await getOrCreate();
      const existing = cfg.warnSteps.findIndex(s => s.count === count);

      if (existing >= 0) {
        cfg.warnSteps[existing] = { count, action, note };
      } else {
        cfg.warnSteps.push({ count, action, note });
        cfg.warnSteps.sort((a, b) => a.count - b.count);
      }
      await cfg.save();

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle("Warn Ladder Step Updated")
          .setDescription(`At **${count} warn${count !== 1 ? "s" : ""}**: **${action}**${note ? ` *(${note})*` : ""}.`)
          .setColor(color)
          .setFooter({ text: guildName, iconURL: guildIcon })],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // /automod words <sub>
    // ─────────────────────────────────────────────────────────────────────
    if (group === "words") {
      const cfg = await getOrCreate();

      if (sub === "add") {
        const word = interaction.options.getString("word").trim().toLowerCase();
        if (cfg.bannedWords.includes(word)) {
          return interaction.reply({ content: `\`${word}\` is already banned.`, flags: MessageFlags.Ephemeral });
        }
        cfg.bannedWords.push(word);
        await cfg.save();

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle("Banned Word Added")
            .setDescription(`\`${word}\` has been added to the banned list.`)
            .setColor(color)
            .setFooter({ text: guildName, iconURL: guildIcon })],
          flags: MessageFlags.Ephemeral,
        });
      }

      if (sub === "remove") {
        const word  = interaction.options.getString("word").trim().toLowerCase();
        const index = cfg.bannedWords.indexOf(word);
        if (index === -1) {
          return interaction.reply({ content: `\`${word}\` is not in the banned list.`, flags: MessageFlags.Ephemeral });
        }
        cfg.bannedWords.splice(index, 1);
        await cfg.save();

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle("Banned Word Removed")
            .setDescription(`\`${word}\` has been removed from the banned list.`)
            .setColor("#ff5353")
            .setFooter({ text: guildName, iconURL: guildIcon })],
          flags: MessageFlags.Ephemeral,
        });
      }

      if (sub === "list") {
        const words = cfg.bannedWords;
        const display = words.length
          ? words.map(w => `\`${w}\``).join(", ")
          : "*No banned words set.*";

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle("Banned Words List")
            .setDescription(display.slice(0, 4000))
            .setColor(color)
            .setFooter({ text: `${words.length} word${words.length !== 1 ? "s" : ""} • ${guildName}`, iconURL: guildIcon })],
          flags: MessageFlags.Ephemeral,
        });
      }

      if (sub === "action") {
        const action      = interaction.options.getString("action");
        const muteMinutes = interaction.options.getInteger("mute-minutes");
        await AutoMod.findOneAndUpdate(
          { guildId },
          { $set: { wordFilterAction: action, ...(muteMinutes ? { wordMuteDuration: muteMinutes } : {}) } },
          { upsert: true }
        );

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle("Word Filter Action Updated")
            .setDescription(`Word filter punishment set to **${action}**${muteMinutes ? ` (${muteMinutes}m)` : ""}.`)
            .setColor(color)
            .setFooter({ text: guildName, iconURL: guildIcon })],
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // /automod regex <sub>
    // ─────────────────────────────────────────────────────────────────────
    if (group === "regex") {
      const cfg = await getOrCreate();

      if (sub === "add") {
        const pattern     = interaction.options.getString("pattern").trim();
        const action      = interaction.options.getString("action");
        const description = interaction.options.getString("description") || "";

        // Validate the pattern compiles
        try { new RegExp(pattern, "i"); } catch (e) {
          return interaction.reply({
            content: `<:crossy:1567796959648030831> Invalid regex pattern: \`${e.message}\``,
            flags: MessageFlags.Ephemeral,
          });
        }

        const existing = cfg.regexRules.findIndex(r => r.pattern === pattern);
        if (existing >= 0) {
          cfg.regexRules[existing] = { pattern, action, description, flags: "i" };
        } else {
          cfg.regexRules.push({ pattern, action, description, flags: "i" });
        }
        await cfg.save();

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle("Regex Rule Added")
            .setDescription(`Pattern \`${pattern}\` → **${action}**${description ? `\n*${description}*` : ""}`)
            .setColor(color)
            .setFooter({ text: guildName, iconURL: guildIcon })],
          flags: MessageFlags.Ephemeral,
        });
      }

      if (sub === "remove") {
        const pattern = interaction.options.getString("pattern").trim();
        const index   = cfg.regexRules.findIndex(r => r.pattern === pattern);
        if (index === -1) {
          return interaction.reply({ content: `No rule found for pattern \`${pattern}\`.`, flags: MessageFlags.Ephemeral });
        }
        cfg.regexRules.splice(index, 1);
        await cfg.save();

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle("Regex Rule Removed")
            .setDescription(`Pattern \`${pattern}\` removed.`)
            .setColor("#ff5353")
            .setFooter({ text: guildName, iconURL: guildIcon })],
          flags: MessageFlags.Ephemeral,
        });
      }

      if (sub === "list") {
        const rules = cfg.regexRules;
        const display = rules.length
          ? rules.map((r, i) => `**${i + 1}.** \`${r.pattern}\` → **${r.action}**${r.description ? ` — *${r.description}*` : ""}`).join("\n")
          : "*No regex rules set.*";

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setTitle("Regex Rules")
            .setDescription(display.slice(0, 4000))
            .setColor(color)
            .setFooter({ text: `${rules.length} rule${rules.length !== 1 ? "s" : ""} • ${guildName}`, iconURL: guildIcon })],
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // /automod view
    // ─────────────────────────────────────────────────────────────────────
    if (sub === "view") {
      const cfg = await AutoMod.findOne({ guildId });
      if (!cfg) {
        return interaction.reply({ content: "AutoMod has not been configured yet.", flags: MessageFlags.Ephemeral });
      }

      const rateText = cfg.rateRules?.length
        ? cfg.rateRules.map(r =>
            `• **${r.type}** — ${r.limit} per ${r.window > 0 ? `${r.window}s` : "msg"} → \`${r.action}\``
          ).join("\n")
        : "*None*";

      const warnText = cfg.warnSteps?.length
        ? cfg.warnSteps.map(s =>
            `• **${s.count} warn${s.count !== 1 ? "s" : ""}** → \`${s.action}\`${s.note ? ` *(${s.note})*` : ""}`
          ).join("\n")
        : "*None*";

      const wordsText = cfg.bannedWords?.length
        ? `${cfg.bannedWords.length} words — action: \`${cfg.wordFilterAction}\`` + (cfg.wordMuteDuration ? ` (${cfg.wordMuteDuration}m)` : "")
        : "*None*";

      const regexText = cfg.regexRules?.length
        ? cfg.regexRules.map(r => `• \`${r.pattern}\` → \`${r.action}\``).join("\n")
        : "*None*";

      const embed = new EmbedBuilder()
        .setTitle(`<:restrict:1567797003638022166> AutoMod Configuration — ${guildName}`)
        .setColor(cfg.status ? color : "#ff5353")
        .addFields(
          { name: "Status",       value: cfg.status ? "<a:tickyy:1567797045253644368> Enabled" : "<:crossy:1567796959648030831> Disabled", inline: true },
          { name: "Bot Spam",     value: cfg.detectBotSpam ? "<a:tickyy:1567797045253644368> On" : "<:crossy:1567796959648030831> Off",    inline: true },
          { name: "\u200b",       value: "\u200b", inline: true },
          { name: "<:thunderr:1567797012991189134> Rate Limits",  value: rateText.slice(0, 1024) },
          { name: "<:error:1567796968758050868> Warn Ladder",  value: warnText.slice(0, 1024) },
          { name: "<:restrict:1567797003638022166> Banned Words", value: wordsText.slice(0, 1024) },
          { name: "<:n_search:1567796994792230953> Regex Rules",  value: regexText.slice(0, 1024) },
        )
        .setFooter({ text: guildName, iconURL: guildIcon })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};