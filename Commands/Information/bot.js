// Commands/Information/bot.js

const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, MessageFlags, ChannelType,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  version: djsVersion,
} = require("discord.js");
const mongoose = require("mongoose");
const os = require("os");
const changelogs = require("../../Schemas/changelogs");
const { formatTime } = require("../../Utils/time");
const logs = require("../../Utils/logs");
const config = require("../../src/config/bot");

mongoose.set("strictQuery", true);
mongoose.connect(process.env.mongodbURL);
const test3Schema = new mongoose.Schema({ name: { type: String, required: true }, value: { type: Number, default: 0 } });
const Test = mongoose.models.Test3 || mongoose.model("Test3", test3Schema);
module.exports = Test;

// ─── Slash command definition ──────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bot").setDescription("RankCore bot commands & information")
    .addSubcommand(c => c.setName("suggest").setDescription("Suggest a new feature")
      .addStringOption(o => o.setName("suggestion").setDescription("Your suggestion").setRequired(true)))
    .addSubcommand(c => c.setName("info").setDescription("View detailed bot stats"))
    .addSubcommand(c => c.setName("support").setDescription("Get the support server link"))
    .addSubcommand(c => c.setName("uptime").setDescription("View bot and system uptime"))
    .addSubcommand(c => c.setName("invite").setDescription("Invite RankCore to your server"))
    .addSubcommand(c => c.setName("changelogs").setDescription("View latest changelogs"))
    .addSubcommand(c => c.setName("report-bug").setDescription("Report a bug to the devs")
      .addStringOption(o => o.setName("command").setDescription("The bugged command").setRequired(true))
      .addStringOption(o => o.setName("details").setDescription("Describe the problem").setRequired(false)))
    .addSubcommand(c => c.setName("feedback").setDescription("Send feedback to the dev team")
      .addStringOption(o => o.setName("message").setDescription("Your feedback").setRequired(true))),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    try {
      switch (sub) {
        case "support":    return await interaction.reply({ content: `Join our Support Server: ${config.supportURL}`, ephemeral: true });
        case "suggest":    return await handleSuggestion(interaction, client);
        case "changelogs": return await handleChangelogs(interaction);
        case "invite":     return await handleInvite(interaction, client);
        case "uptime":     return await handleUptime(interaction, client);
        case "report-bug": return await handleBugReport(interaction, client);
        case "info":       return await handleInfo(interaction, client);
        case "feedback":   return await handleFeedback(interaction, client);
        default:           return await interaction.reply({ content: "Unknown subcommand.", ephemeral: true });
      }
    } catch (error) {
      logs.error(error);
      const e = { content: "An error occurred. The dev team was notified.", ephemeral: true };
      if (interaction.deferred || interaction.replied) await interaction.editReply(e).catch(() => {});
      else await interaction.reply(e).catch(() => {});
    }
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const sep = () => new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true);


// Delivers a suggestion / bug report / feedback to the configured channel, or —
// when no channel is set up — to the bot owner's DMs. Returns false if neither works.
async function deliverToDevs(client, channelId, payload) {
  const ch = channelId && client.channels.cache.get(channelId);
  if (ch) return ch.send(payload).then(() => true, () => false);
  const owner = process.env.OWNER_ID && await client.users.fetch(process.env.OWNER_ID).catch(() => null);
  if (owner) return owner.send(payload).then(() => true, () => false);
  return false;
}

function notDelivered(interaction, client) {
  return interaction.reply({
    content: `Sorry, this couldn't be delivered right now. Please tell us on the support server instead: ${client.config.supportURL || "https://discord.gg/a9Kea3ymC7"}`,
    ephemeral: true,
  });
}

async function handleSuggestion(interaction, client) {
  const suggestion = interaction.options.getString("suggestion");
  const devEmbed = new EmbedBuilder().setTitle("New Suggestion").setColor("#10b981")
    .setDescription(`**From:** \`${interaction.user.tag}\` (\`${interaction.user.id}\`)\n\n>>> ${suggestion}`)
    .setTimestamp().setFooter({ text: `${interaction.guild.name}` });
  const userEmbed = new EmbedBuilder().setTitle("Suggestion Sent!").setColor("#10b981")
    .setDescription(`We received your suggestion:\n>>> ${suggestion}`)
    .setFooter({ text: "Thank you for helping improve RankCore!" });
  const sent = await deliverToDevs(client, client.config.botsuggestions, { embeds: [devEmbed], allowedMentions: { parse: [] } });
  if (!sent) return notDelivered(interaction, client);
  return interaction.reply({ embeds: [userEmbed], ephemeral: true });
}

async function handleChangelogs(interaction) {
  const data = await changelogs.findOne({}).sort({ date: -1 }).exec();
  if (!data) return interaction.reply({ content: "No changelogs published yet.", ephemeral: true });
  const embed = new EmbedBuilder()
    .setTitle(data.config.title || `${interaction.client.user.username} Changelogs`)
    .setDescription(data.config.description || "A new update has arrived!")
    .setColor(data.config.color || "#6366f1")
    .setTimestamp(data.date ? new Date(data.date) : Date.now())
    .setFooter({ text: `${data.config.footer || "Changelogs"} | ${data.config.type || "Update"}`, iconURL: interaction.client.user.avatarURL() });
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleInvite(interaction, client) {
  const link = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=303600576574&scope=bot%20applications.commands`;

  const acc = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
    ? parseInt(client.config.embedColor.slice(1), 16) : 0x8b5cf6;

  const container = new ContainerBuilder().setAccentColor(acc)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Invite ${client.user.username}`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Add RankCore to your server or join the community"))
    .addSeparatorComponents(sep())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `**Servers:** \`${client.guilds.cache.size.toLocaleString()}\`\n` +
      `**Users:** \`${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0).toLocaleString()}\`\n` +
      `**Commands:** \`${client.commands.size}\``
    ))
    .addSeparatorComponents(sep())
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setURL(link).setLabel("Invite RankCore").setStyle(ButtonStyle.Link),
      new ButtonBuilder().setURL(config.supportURL).setLabel("Support Server").setStyle(ButtonStyle.Link),
    ));

  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handleUptime(interaction, client) {
  const acc = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
    ? parseInt(client.config.embedColor.slice(1), 16) : 0x10b981;

  const container = new ContainerBuilder().setAccentColor(acc)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Uptime Status"))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Last checked: ${new Date().toLocaleTimeString()}`))
    .addSeparatorComponents(sep())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `**Bot Uptime**\n\`\`\`${formatTime(process.uptime())}\`\`\`\n` +
      `**System Uptime**\n\`\`\`${formatTime(os.uptime())}\`\`\`\n` +
      `**WebSocket Ping**\n\`\`\`${client.ws.ping} ms\`\`\``
    ))
    .addSeparatorComponents(sep())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# RankCore runs 24/7 — fully reliable."));

  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handleInfo(interaction, client) {
  const memMB     = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
  const totalMemMB = (os.totalmem() / 1024 / 1024).toFixed(0);
  const memPct    = ((process.memoryUsage().heapUsed / os.totalmem()) * 100).toFixed(1);
  const acc       = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
    ? parseInt(client.config.embedColor.slice(1), 16) : 0x6366f1;
  const inviteURL = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=303600576574&scope=bot%20applications.commands`;

  const container = new ContainerBuilder().setAccentColor(acc)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${client.user.username}`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Bot Statistics & System Overview"))
    .addSeparatorComponents(sep())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      "**General**\n" +
      `> **Client ID:** \`${client.user.id}\`\n> **Creator:** \`${process.env.OWNER_ID}\`\n` +
      `> **Servers:** \`${client.guilds.cache.size.toLocaleString()}\`\n` +
      `> **Members:** \`${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0).toLocaleString()}\`\n` +
      `> **Commands:** \`${client.commands.size}\`\n> **Website:** [rankcore.org](https://rankcore.org)`
    ))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      "**Performance**\n" +
      `> **Ping:** \`${client.ws.ping} ms\`\n> **Uptime:** \`${formatTime(process.uptime())}\`\n` +
      `> **discord.js:** \`v${djsVersion}\`\n> **Node.js:** \`${process.version}\`\n> **Database:** \`MongoDB\``
    ))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      "**System**\n" +
      `> **OS:** \`${os.type().replace("Windows_NT", "Windows").replace("Darwin", "macOS")} ${os.arch()}\`\n` +
      `> **CPU:** \`${os.cpus()[0].model}\`\n> **Memory:** \`${memMB} MB / ${totalMemMB} MB (${memPct}%)\``
    ))
    .addSeparatorComponents(sep())
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setURL(inviteURL).setLabel("Invite Me").setStyle(ButtonStyle.Link),
      new ButtonBuilder().setURL(config.supportURL).setLabel("Support").setStyle(ButtonStyle.Link),
    ));

  return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handleBugReport(interaction, client) {
  const command    = interaction.options.getString("command");
  const bugDetails = interaction.options.getString("details") || "No details given.";
  const devEmbed = new EmbedBuilder().setTitle("Bug Report").setColor("#ef4444")
    .setDescription(`**User:** \`${interaction.user.tag}\` (\`${interaction.user.id}\`)\n**Command:** \`${command}\`\n**Details:**\n>>> ${bugDetails}`)
    .setTimestamp().setFooter({ text: `ID: ${interaction.user.id}` });
  const userEmbed = new EmbedBuilder().setTitle("Bug Reported!").setColor("#10b981")
    .setDescription(`Your report for \`${command}\` was submitted.`)
    .addFields({ name: "Details", value: `>>> ${bugDetails}` })
    .setFooter({ text: "The dev team will investigate soon." });
  const sent = await deliverToDevs(client, client.config.bugreport, { embeds: [devEmbed], allowedMentions: { parse: [] } });
  if (!sent) return notDelivered(interaction, client);
  return interaction.reply({ embeds: [userEmbed], ephemeral: true });
}

async function handleFeedback(interaction, client) {
  const msg = interaction.options.getString("message");
  const devEmbed = new EmbedBuilder().setTitle("Feedback").setColor("#8b5cf6")
    .setDescription(`>>> ${msg}`).addFields({ name: "From", value: `\`${interaction.user.tag}\` (\`${interaction.user.id}\`)` }).setTimestamp();
  const userEmbed = new EmbedBuilder().setTitle("Thanks for the Feedback!").setColor("#10b981")
    .setDescription("Your message was sent to the dev team.")
    .addFields({ name: "Your Message", value: `>>> ${msg}` })
    .setFooter({ text: "Keep the ideas coming!" });
  const sent = await deliverToDevs(client, client.config.feedback, { embeds: [devEmbed], allowedMentions: { parse: [] } });
  if (!sent) return notDelivered(interaction, client);
  return interaction.reply({ embeds: [userEmbed], ephemeral: true });
}