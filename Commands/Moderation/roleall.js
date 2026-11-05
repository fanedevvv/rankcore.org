const {
  SlashCommandBuilder, MessageFlags, PermissionsBitField,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  Collection,
} = require("discord.js");
const { successContainer, errorContainer, ACCENT } = require("../../Utils/v2helpers");

const CONFIG = {
  BATCH_SIZE: 3,
  CYCLE_DELAY: 5000,
  UPDATE_EVERY_N_CYCLES: 3,
  MEMBER_FETCH_TIMEOUT: 60000,
  MAX_MEMBERS: 5000,
  COLORS: { SUCCESS: ACCENT.success, ERROR: ACCENT.error, NEUTRAL: ACCENT.info, WAITING: ACCENT.warning },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roleall")
    .setDescription("Mass-assign or mass-remove a role from members (rate-limit safe).")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addSubcommand(s => s.setName("add").setDescription("Add a role to all members (or filtered subset).")
      .addRoleOption(o => o.setName("role").setDescription("Role to assign.").setRequired(true))
      .addStringOption(o => o.setName("filter").setDescription("Only target: all, humans, or bots.").setRequired(false)
        .addChoices({ name: "All Members", value: "all" }, { name: "Humans Only", value: "humans" }, { name: "Bots Only", value: "bots" }))
      .addRoleOption(o => o.setName("has_role").setDescription("Only add if member already has this role.").setRequired(false)))
    .addSubcommand(s => s.setName("remove").setDescription("Remove a role from all members (or filtered subset).")
      .addRoleOption(o => o.setName("role").setDescription("Role to remove.").setRequired(true))
      .addStringOption(o => o.setName("filter").setDescription("Only target: all, humans, or bots.").setRequired(false)
        .addChoices({ name: "All Members", value: "all" }, { name: "Humans Only", value: "humans" }, { name: "Bots Only", value: "bots" }))),

  async execute(interaction, client) {
    const sub    = interaction.options.getSubcommand();
    const role   = interaction.options.getRole("role");
    const filter = interaction.options.getString("filter") || "all";
    const hasRole = sub === "add" ? interaction.options.getRole("has_role") : null;
    const isAdd  = sub === "add";

    const ephErr = (title, body) => interaction.reply({
      components: [errorContainer(title, body, { clientId: client.user.id })],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles))
      return ephErr("Permission Denied", "You need the **Manage Roles** permission.");
    if (role.managed)
      return ephErr("Managed Role", "Bot-managed roles (like integration roles) cannot be mass-assigned.");
    if (role.position >= interaction.guild.members.me.roles.highest.position)
      return ephErr("Hierarchy Error", "That role is higher than or equal to my highest role.");
    if (role.id === interaction.guild.id)
      return ephErr("Invalid Role", "You cannot assign or remove the @everyone role.");

    await interaction.deferReply();

    // Fetch all members
    const fetchContainer = new ContainerBuilder().setAccentColor(CONFIG.COLORS.WAITING)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:n_loading:1567796992556666982>  Fetching Members...\nPlease wait while I gather all server members."));
    await interaction.editReply({ components: [fetchContainer], flags: MessageFlags.IsComponentsV2 });

    let members;
    try {
      members = await interaction.guild.members.fetch({ time: CONFIG.MEMBER_FETCH_TIMEOUT });
    } catch (err) {
      return interaction.editReply({
        components: [errorContainer("Fetch Failed", `Could not fetch members: ${err.message}`, { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // Filter members
    let targets = [...members.values()];
    if (filter === "humans") targets = targets.filter(m => !m.user.bot);
    if (filter === "bots")   targets = targets.filter(m => m.user.bot);
    if (hasRole)             targets = targets.filter(m => m.roles.cache.has(hasRole.id));
    if (isAdd)  targets = targets.filter(m => !m.roles.cache.has(role.id));
    if (!isAdd) targets = targets.filter(m =>  m.roles.cache.has(role.id));

    if (!targets.length) {
      return interaction.editReply({
        components: [successContainer(`${isAdd ? "<a:tickyy:1567797045253644368>" : "<a:tickyy:1567797045253644368>"}  Nothing to do`,
          isAdd
            ? `All eligible members already have ${role}.`
            : `No members with ${role} found.`,
          { accent: ACCENT.info, clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (targets.length > CONFIG.MAX_MEMBERS) {
      return interaction.editReply({
        components: [errorContainer("Too Many Members", `This operation would affect **${targets.length}** members — the maximum is **${CONFIG.MAX_MEMBERS}** to prevent abuse.`, { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // Confirmation
    const confirmContainer = new ContainerBuilder().setAccentColor(ACCENT.warning)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:error:1567796968758050868>  Confirm Mass Role ${isAdd ? "Add" : "Remove"}`))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**Action** — ${isAdd ? "Add" : "Remove"} ${role}\n**Targets** — ${targets.length} member(s) (${filter})\n**Rate-limit safe** — Yes, using batches of ${CONFIG.BATCH_SIZE} with ${CONFIG.CYCLE_DELAY / 1000}s delay\n\n-# This may take several minutes for large servers.`
      ))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("roleall_confirm").setLabel(`Confirm ${isAdd ? 'Add' : 'Remove'}`).setEmoji({ id: '1567797045253644368', name: 'tickyy', animated: true }).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("roleall_cancel").setLabel("Cancel").setEmoji({ id: '1567796959648030831', name: 'crossy', animated: false }).setStyle(ButtonStyle.Secondary),
        )
      );

    await interaction.editReply({ components: [confirmContainer], flags: MessageFlags.IsComponentsV2 });

    const collector = interaction.channel.createMessageComponentCollector({
      filter: b => b.user.id === interaction.user.id && ["roleall_confirm", "roleall_cancel"].includes(b.customId),
      max: 1, time: 30_000,
    });

    collector.on("collect", async b => {
      if (b.customId === "roleall_cancel") {
        return b.update({
          components: [successContainer("<:crossy:1567796959648030831> Cancelled", "Mass role operation was cancelled.", { accent: ACCENT.info, clientId: client.user.id })],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      await b.deferUpdate();

      let processed = 0, succeeded = 0, failed = 0;
      const startTime = Date.now();

      for (let i = 0; i < targets.length; i += CONFIG.BATCH_SIZE) {
        const batch = targets.slice(i, i + CONFIG.BATCH_SIZE);
        await Promise.all(batch.map(async m => {
          try {
            if (isAdd)  await m.roles.add(role,   `roleall add by ${interaction.user.tag}`);
            else        await m.roles.remove(role, `roleall remove by ${interaction.user.tag}`);
            succeeded++;
          } catch { failed++; }
          processed++;
        }));

        // Progress update every N cycles
        if (Math.floor(i / CONFIG.BATCH_SIZE) % CONFIG.UPDATE_EVERY_N_CYCLES === 0) {
          const pct = Math.floor((processed / targets.length) * 100);
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          const eta = processed > 0 ? Math.round((targets.length - processed) * (elapsed / processed)) : "?";
          const bar = "█".repeat(Math.floor(pct / 10)) + "░".repeat(10 - Math.floor(pct / 10));

          const progressContainer = new ContainerBuilder().setAccentColor(ACCENT.moderation)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
              `## <:n_utils:1567796996830658573>  ${isAdd ? "Adding" : "Removing"} ${role.name}...\n\`${bar}\` ${pct}%\n\n**Progress** — ${processed}/${targets.length}\n**Succeeded** — ${succeeded} | **Failed** — ${failed}\n**Elapsed** — ${elapsed}s | **ETA** — ~${eta}s`
            ));
          await interaction.editReply({ components: [progressContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }

        if (i + CONFIG.BATCH_SIZE < targets.length) await new Promise(r => setTimeout(r, CONFIG.CYCLE_DELAY));
      }

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      return interaction.editReply({
        components: [successContainer(
          `${isAdd ? "<a:tickyy:1567797045253644368>" : "<a:tickyy:1567797045253644368>"}  Mass Role ${isAdd ? "Add" : "Remove"} Complete`,
          `Successfully ${isAdd ? "added" : "removed"} **${role}** for **${succeeded}** member(s).`,
          {
            accent: ACCENT.success, clientId: client.user.id,
            extra: `**Succeeded** — ${succeeded}\n**Failed** — ${failed}\n**Total Targets** — ${targets.length}\n**Duration** — ${elapsed}s\n**Requested by** — ${interaction.user.tag}`,
          }
        )],
        flags: MessageFlags.IsComponentsV2,
      });
    });

    collector.on("end", collected => {
      if (!collected.size) {
        interaction.editReply({
          components: [errorContainer("Timed Out", "Confirmation timed out. No changes were made.", { clientId: client.user.id })],
          flags: MessageFlags.IsComponentsV2,
        }).catch(() => {});
      }
    });
  },
};