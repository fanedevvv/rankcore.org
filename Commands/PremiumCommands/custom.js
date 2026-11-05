const {
  SlashCommandBuilder,
  EmbedBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  ApplicationCommandOptionType, // Import for option types
} = require("discord.js");
const customCommandSchema = require("../../Schemas/customCommandSchema");

// Helper function to get the string representation of a permission bit
const getPermissionName = (bit) => {
  for (const [name, value] of Object.entries(PermissionFlagsBits)) {
    if (value === bit) return name.replace(/_/g, " ").toLowerCase();
  }
  return "Unknown Permission";
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("custom")
    .setDescription("Manage custom commands")
    .addSubcommand(sub =>
      sub
        .setName("create")
        .setDescription("Create a new custom command with advanced options")
        .addStringOption(option =>
          option.setName("name").setDescription("Command name").setRequired(true)
        )
        .addStringOption(option =>
          option.setName("description").setDescription("The command's description").setRequired(true) // New option
        )
        .addStringOption(option =>
          option.setName("response").setDescription("The command's text response/embed description").setRequired(true)
        )
        .addBooleanOption(option =>
          option.setName("is_embed").setDescription("Should the response be an Embed?").setRequired(false) // New option
        )
        .addStringOption(option =>
          option.setName("required_permission").setDescription("Permission required to use (e.g., KICK_MEMBERS)").setRequired(false) // New option
            .addChoices(
              { name: "Kick Members", value: String(PermissionFlagsBits.KickMembers) },
              { name: "Ban Members", value: String(PermissionFlagsBits.BanMembers) },
              { name: "Manage Channels", value: String(PermissionFlagsBits.ManageChannels) },
              { name: "Manage Guild", value: String(PermissionFlagsBits.ManageGuild) },
              { name: "Administrator", value: String(PermissionFlagsBits.Administrator) },
              { name: "Mute Members", value: String(PermissionFlagsBits.MuteMembers) }
            )
        )
        // You can add more option types here to allow user-input dynamic commands
        .addStringOption(option =>
          option.setName("option1_name").setDescription("Name for an optional string argument").setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("delete")
        .setDescription("Delete a custom command")
        .addStringOption(option =>
          option.setName("name").setDescription("Command name to delete").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("list").setDescription("List all custom commands in this server")
    ),

  premium: true,

  async execute(interaction, client) {
    const { options, guild, user } = interaction;
    const sub = options.getSubcommand();

    // Admin-only (Kept for custom command *management*)
    if (!guild.members.cache.get(user.id).permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: "<:crossy:1567796959648030831> Only server administrators can manage custom commands.",
        flags: 64,
      });
    }

    const rest = new REST({ version: "10" }).setToken(process.env.token);

    switch (sub) {

      /* =============================
            CREATE CUSTOM COMMAND
      ==============================*/
      case "create": {
        const name = options.getString("name").toLowerCase();
        const description = options.getString("description"); // Get new option
        const response = options.getString("response");
        const isEmbed = options.getBoolean("is_embed") || false; // Get new option
        const requiredPermission = options.getString("required_permission"); // Get new option
        const option1Name = options.getString("option1_name");

        // Validation
        if (!/^[a-z][a-z0-9-]{0,31}$/.test(name)) {
          return interaction.reply({
            content: "Command name must start with a letter and can only contain lowercase letters, numbers, or hyphens (max 32 chars).",
            flags: 64,
          });
        }

        // Prevent duplicates
        const exists = await customCommandSchema.findOne({ Guild: guild.id, Name: name });
        if (exists) {
          return interaction.reply({
            content: `A custom command with the name \`${name}\` already exists.`,
            flags: 64,
          });
        }

        // --- Build Slash Command Options (Simplified for Option1 only) ---
        const commandOptions = [];
        if (option1Name) {
          commandOptions.push({
            name: option1Name.toLowerCase().replace(/\s/g, "_"),
            description: `The argument for ${option1Name}`,
            type: ApplicationCommandOptionType.String,
            required: true,
          });
        }

        // Store DB entry with new fields
        // ── Tier limit enforcement ──────────────────────────────────────────
        const { getGuildTier, getLimit } = require("../../Utils/premiumTiers");
        const tier  = await getGuildTier(guild.id);
        const limit = getLimit(tier, "customCommands");
        const cmdCount = await customCommandSchema.countDocuments({ Guild: guild.id });
        if (cmdCount >= limit) {
          const tierLabels = { free: "Free (3 max)", basic: "Basic (15 max)", pro: "Pro (50 max)", elite: "Elite (unlimited)" };
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("Red")
                .setTitle("\u26A1 Custom Command Limit Reached")
                .setDescription(
                  `You have reached the **${limit}** custom command limit for your current plan (**${tierLabels[tier] ?? tier}**).

Upgrade with \`/premium plans\` to unlock more.`
                )
            ],
            ephemeral: true,
          });
        }

        // Store DB entry with new fields
        await customCommandSchema.create({
          Guild: guild.id,
          Name: name,
          Description: description, // Store description
          Response: response,
          IsEmbed: isEmbed, // Store embed preference
          RequiredPermission: requiredPermission ? parseInt(requiredPermission) : null, // Store permission
          Options: commandOptions, // Store options array
          Creator: user.id,
        });

        // REGISTER SLASH COMMAND INSTANTLY with dynamic description and options
        try {
          await rest.post(
            Routes.applicationGuildCommands(client.user.id, guild.id),
            {
              body: {
                name: name,
                description: description, // Use the user-provided description
                type: 1,
                default_member_permissions: requiredPermission, // Set required permission
                options: commandOptions, // Include the defined options
              },
            }
          );
        } catch (error) {
          console.error("Failed to register custom slash command:", error);
          return interaction.reply({
            content: "<:crossy:1567796959648030831> Saved, but failed to register the slash command. Check console.",
            flags: 64,
          });
        }

        let successMsg = `<a:tickyy:1567797045253644368> Custom command \`${name}\` created and **registered instantly**!`;
        if (requiredPermission) {
          successMsg += `\n**Required Permission:** \`${getPermissionName(parseInt(requiredPermission))}\``;
        }
        if (isEmbed) {
          successMsg += `\n**Response Type:** Embed`;
        }
        if (option1Name) {
          successMsg += `\n**Argument:** \`${option1Name}\``;
        }

        return interaction.reply({
          content: successMsg,
          flags: 64,
        });
      }

      /* =============================
             DELETE CUSTOM COMMAND
      ==============================*/
      // (Delete logic remains the same)
      case "delete": {
        const name = options.getString("name").toLowerCase();

        const cmd = await customCommandSchema.findOne({ Guild: guild.id, Name: name });

        if (!cmd) {
          return interaction.reply({
            content: "That custom command does not exist.",
            flags: 64,
          });
        }

        // Remove DB entry
        await customCommandSchema.deleteOne({ Guild: guild.id, Name: name });

        // DELETE SLASH COMMAND IMMEDIATELY
        try {
          const guildCommands = await rest.get(
            Routes.applicationGuildCommands(client.user.id, guild.id)
          );

          const commandToDelete = guildCommands.find(c => c.name === name);

          if (commandToDelete) {
            await rest.delete(
              Routes.applicationGuildCommand(client.user.id, guild.id, commandToDelete.id)
            );
          }
        } catch (err) {
          console.error(`[CUSTOM] Failed to delete slash command "${name}":`, err);
        }

        return interaction.reply({
          content: `<:del:1567796961334267974> Custom command \`${name}\` deleted **instantly**.`,
          flags: 64,
        });
      }

      /* =============================
                 LIST
      ==============================*/
      case "list": {
        const { getGuildTier, getLimit, getTier } = require("../../Utils/premiumTiers");
        const GuildCommands = require("../../Schemas/Guildcommandsschema");

        const tier    = await getGuildTier(guild.id);
        const limit   = getLimit(tier, "customCommands");
        const tierCfg = getTier(tier);

        // Custom commands in DB
        const commands   = await customCommandSchema.find({ Guild: guild.id });
        const customUsed = commands.length;

        // Built-in commands are global, so all 100 guild slots are free for custom commands
        const enabledNormal = 0;

        // Discord hard cap: 100 guild-scoped commands per app per guild
        const DISCORD_GUILD_CMD_LIMIT = 100;
        const discordSlotsUsed      = customUsed + enabledNormal;
        const discordSlotsRemaining = Math.max(0, DISCORD_GUILD_CMD_LIMIT - discordSlotsUsed);

        // RankCore soft cap (tier-based)
        const noxxRemaining = limit === Infinity ? Infinity : Math.max(0, limit - customUsed);

        // Build command list
        let listText = customUsed
          ? commands.map(c => {
              const permissionText = c.RequiredPermission ? ` *(Requires: ${getPermissionName(c.RequiredPermission)})*` : "";
              const optionsText = c.Options && c.Options.length > 0
                ? ` (Args: ${c.Options.map(opt => `\`<${opt.name}>\``).join(", ")})`
                : "";
              return `\`/${c.Name}\`${optionsText}${permissionText}`;
            }).join("\n")
          : "*No custom commands yet — use `/custom create` to add one.*";

        // Visual bar for Discord slot usage (the real hard limit)
        const BAR_LEN    = 10;
        const filled     = Math.round((discordSlotsUsed / DISCORD_GUILD_CMD_LIMIT) * BAR_LEN);
        const barStr     = "\u2588".repeat(Math.min(filled, BAR_LEN)) + "\u2591".repeat(Math.max(0, BAR_LEN - filled));

        // RankCore plan cap line
        const noxxCapLine = limit === Infinity
          ? `${tierCfg.emoji} **${tierCfg.name}** — unlimited custom commands`
          : `${tierCfg.emoji} **${tierCfg.name}** cap: **${customUsed} / ${limit}** (${noxxRemaining} remaining)`;

        // Discord slot line
        const discordLine =
          `\`[${barStr}]\` **${discordSlotsUsed} / ${DISCORD_GUILD_CMD_LIMIT}** guild command slots used\n` +
          `Custom: **${customUsed}** \u00b7 Normal enabled: **${enabledNormal}** \u00b7 Free: **${discordSlotsRemaining}**`;

        const embed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setTitle(`${guild.name} \u2014 Custom Commands`)
          .setDescription(listText)
          .addFields(
            { name: "\ud83d\udcca Plan Limit", value: noxxCapLine, inline: false },
            { name: "\ud83d\udd27 Discord Guild Slots", value: discordLine, inline: false }
          );

        // Footer hints
        const atNoxxCap    = noxxRemaining === 0 && limit !== Infinity;
        const atDiscordCap = discordSlotsRemaining === 0;

        if (atDiscordCap) {
          embed.setFooter({ text: "Discord slot cap reached (100) \u00b7 Disable some normal commands in the Dashboard to free up slots" });
        } else if (atNoxxCap) {
          embed.setFooter({ text: "Plan cap reached \u00b7 Upgrade with /premium plans to create more custom commands" });
        } else if (tier !== "elite") {
          embed.setFooter({ text: `${noxxRemaining} plan slot${noxxRemaining === 1 ? "" : "s"} remaining \u00b7 ${discordSlotsRemaining} Discord slot${discordSlotsRemaining === 1 ? "" : "s"} free` });
        }

        return interaction.reply({ embeds: [embed], flags: 64 });
      }
    }
  },
};