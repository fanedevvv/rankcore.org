// Commands/Utility/utils.js — Utility commands replacing setup slash commands
// All server setup functionality has moved to the Dashboard.

const {
  SlashCommandBuilder,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { parseEmoji } = require('../../Utils/emojis');
const os = require("os");
const { ACCENT } = require("../../Utils/v2helpers");
const config = require("../../src/config/bot");
const sep = () =>
  new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("botutils")
    .setDescription("Quick utility commands for bot info and helpful links.")
    .addSubcommand(s => s.setName("ping").setDescription("Check the bot's latency and API response time."))
    .addSubcommand(s => s.setName("uptime").setDescription("Show how long the bot has been running."))
    .addSubcommand(s => s.setName("stats").setDescription("View bot statistics: servers, users, memory usage."))
    .addSubcommand(s => s.setName("invite").setDescription("Get the bot invite link and support server link."))
    .addSubcommand(s => s.setName("dashboard").setDescription("Get a direct link to this server's dashboard."))
    .addSubcommand(s => s.setName("support").setDescription("Get a link to the Roco support server."))
    .addSubcommand(s => s.setName("vote").setDescription("Vote for Roco on bot listing sites.")),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const accentColor =
      typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
        ? parseInt(client.config.embedColor.slice(1), 16)
        : 0x53ff6c;

    if (sub === "ping") {
      const sent = await interaction.reply({
        components: [
          new ContainerBuilder().setAccentColor(accentColor)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:ping:1555544527597604968>  Pinging…"))
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("Calculating latency…")),
        ],
        flags: MessageFlags.IsComponentsV2,
        fetchReply: true,
      });
      const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
      const ws = client.ws.ping;
      const color = roundtrip < 100 ? 0x53ff6c : roundtrip < 250 ? 0xf59e0b : 0xef4444;
      return interaction.editReply({
        components: [
          new ContainerBuilder().setAccentColor(color)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:ping:1555544527597604968>  Pong!"))
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
              `**Roundtrip** — \`${roundtrip}ms\`\n**WebSocket** — \`${ws}ms\`\n**Status** — ${roundtrip < 100 ? "<:LEgreen:1555544256356159600> Excellent" : roundtrip < 250 ? "<:error:1555544434601369620> Good" : "<:LEred:1555544262123323422> High"}`
            )),
        ],
      });
    }

    if (sub === "uptime") {
      const total = Math.floor(process.uptime());
      const d = Math.floor(total / 86400), h = Math.floor((total % 86400) / 3600);
      const m = Math.floor((total % 3600) / 60), s = total % 60;
      const fmt = [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(" ");
      const started = Math.floor((Date.now() - process.uptime() * 1000) / 1000);
      return interaction.reply({
        components: [
          new ContainerBuilder().setAccentColor(accentColor)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:1430986244921495654:1555544239792980044>  Bot Uptime"))
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
              `**Running for** — \`${fmt}\`\n**Started at** — <t:${started}:F> (<t:${started}:R>)`
            )),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "stats") {
      const guilds = client.guilds.cache.size;
      const users = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
      const cmds = client.commands?.size ?? 0;
      const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
      return interaction.reply({
        components: [
          new ContainerBuilder().setAccentColor(accentColor)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:n_utils:1555544669545431062>  ${client.user.username} Statistics`))
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
              `**Servers** — \`${guilds.toLocaleString()}\`\n**Users** — \`${users.toLocaleString()}\`\n**Commands** — \`${cmds}\`\n**Memory** — \`${mem} MB\`\n**Node.js** — \`${process.version}\`\n**Discord.js** — \`v${require("discord.js").version}\``
            )),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "invite") {
      const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=303600576574&scope=bot%20applications.commands`;
      return interaction.reply({
        components: [
          new ContainerBuilder().setAccentColor(accentColor)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:n_add:1555544335036973106>  Invite Roco"))
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("Add Roco to your server or get help from our support team!"))
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel("Invite Bot").setStyle(ButtonStyle.Link).setEmoji(parseEmoji("<:n_add:1555544335036973106>")).setURL(inviteUrl),
                new ButtonBuilder().setLabel("Support Server").setStyle(ButtonStyle.Link).setEmoji(parseEmoji("<:n_utils:1555544669545431062>")).setURL(config.supportURL),
                new ButtonBuilder().setLabel("Vote on Top.gg").setStyle(ButtonStyle.Link).setEmoji(parseEmoji("<:boost:1555544362455146576>")).setURL("https://top.gg/bot/960624234688811188"),
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "dashboard") {
      const guildId = interaction.guild.id;
      const dashUrl = `${process.env.DASHBOARD_URL || "https://dash.rocobot.xyz"}/guild/${guildId}`;
      return interaction.reply({
        components: [
          new ContainerBuilder().setAccentColor(accentColor)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:n_bot:1555544367886770176>  Server Dashboard"))
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
              `**Server ID** — \`${guildId}\`\n\nManage welcome messages, leveling, moderation, logs, tickets and all other setups from the dashboard. No slash commands needed for setup!`
            ))
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel("Open Dashboard").setStyle(ButtonStyle.Link).setEmoji(parseEmoji("<:n_bot:1555544367886770176>")).setURL(dashUrl),
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "support") {
      return interaction.reply({
        components: [
          new ContainerBuilder().setAccentColor(accentColor)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:n_utils:1555544669545431062>  Roco Support"))
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("Need help? We've got you covered."))
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel("Support Server").setStyle(ButtonStyle.Link).setEmoji(parseEmoji("<:n_utils:1555544669545431062>")).setURL(config.supportURL),
                new ButtonBuilder().setLabel("Documentation").setStyle(ButtonStyle.Link).setEmoji(parseEmoji("<:files:1555544445565407352>")).setURL("https://dash.rocobot.xyz/docs"),
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "vote") {
      return interaction.reply({
        components: [
          new ContainerBuilder().setAccentColor(accentColor)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:boost:1555544362455146576>  Vote for Roco"))
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("Voting helps Roco grow! It only takes 10 seconds."))
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel("Vote on Top.gg").setStyle(ButtonStyle.Link).setEmoji(parseEmoji("<:boost:1555544362455146576>")).setURL("https://top.gg/bot/960624234688811188"),
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};
