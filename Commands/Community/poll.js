/* ─────────────────────────────────────────────────────────────────────────────
   poll.js — Full Components V2 poll system with selectable duration,
   live vote counts, auto-end, winner announcement, and early-end support.
   Polls survive bot restarts: votes are persisted to MongoDB and all active
   polls are re-hydrated from the DB on ClientReady.
   ───────────────────────────────────────────────────────────────────────────── */
const {
  SlashCommandBuilder, MessageFlags, PermissionsBitField,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require("discord.js");
const { parseEmoji, E } = require('../../Utils/emojis');
const { ACCENT }   = require("../../Utils/v2helpers");
const pollSchema   = require("../../Schemas/pollDiscord");

// ── Duration choices ──────────────────────────────────────────────────────────
const DURATION_CHOICES = [
  { name: "5 minutes",  value: 5     },
  { name: "15 minutes", value: 15    },
  { name: "30 minutes", value: 30    },
  { name: "1 hour",     value: 60    },
  { name: "3 hours",    value: 180   },
  { name: "6 hours",    value: 360   },
  { name: "12 hours",   value: 720   },
  { name: "24 hours",   value: 1440  },
  { name: "3 days",     value: 4320  },
  { name: "7 days",     value: 10080 },
];

// RankCore number emojis (1–5), uploaded to the bot as application emojis
const OPTION_EMOJIS = E.num.slice(0, 5);

function minutesToMs(min) { return min * 60 * 1000; }
function progressBar(pct) { const f = Math.round(pct / 10); return "█".repeat(f) + "░".repeat(10 - f); }

// ── votes ↔ DB serialisation ──────────────────────────────────────────────────
// In-memory: votes[i] = Set of userIds
// In DB:     Votes    = { "0": ["uid1","uid2"], "1": [...], … }

function votesToDb(votes) {
  const out = {};
  for (const [k, s] of Object.entries(votes)) out[k] = [...s];
  return out;
}

function votesFromDb(raw, optionCount) {
  const votes = {};
  for (let i = 0; i < optionCount; i++) {
    votes[i] = new Set(Array.isArray(raw?.[i]) ? raw[i] : []);
  }
  return votes;
}

// ── Persist current vote state ────────────────────────────────────────────────
async function persistVotes(messageId, votes) {
  await pollSchema.updateOne(
    { Message: messageId },
    { $set: { Votes: votesToDb(votes) } }
  ).catch(() => {});
}

// ── Build the poll V2 container ───────────────────────────────────────────────
function buildPollContainer(accent, question, options, votes, authorTag, endTs, ended = false) {
  const total   = Object.values(votes).reduce((a, v) => a + v.size, 0);
  const maxVote = Math.max(...options.map((_, i) => votes[i].size));
  const status  = ended
    ? "<:LEred:1567796934545121280> **Poll Ended**"
    : `<:n_loading:1567796992556666982> Ends <t:${endTs}:R>  •  <t:${endTs}:f>`;

  const optionLines = options.map((opt, i) => {
    const count  = votes[i].size;
    const pct    = total ? Math.round((count / total) * 100) : 0;
    const crown  = ended && count === maxVote && maxVote > 0 ? "  <:1430986209995526274:1567796911350747206>" : "";
    return `${OPTION_EMOJIS[i]}  **${opt}**${crown}\n\`${progressBar(pct)}\` ${pct}% — ${count} vote${count !== 1 ? "s" : ""}`;
  }).join("\n\n");

  const c = new ContainerBuilder().setAccentColor(accent);
  c.addTextDisplayComponents(new TextDisplayBuilder()
    .setContent(ended ? "## <:n_utils:1567796996830658573>  Poll — Final Results" : "## <:n_utils:1567796996830658573>  Poll"));
  c.addSeparatorComponents(new SeparatorBuilder()
    .setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder()
    .setContent(`### ${question}\n\n${optionLines}`));
  c.addSeparatorComponents(new SeparatorBuilder()
    .setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder()
    .setContent(`${status}\n-# Votes update live • Asked by ${authorTag} • ${total} total vote${total !== 1 ? "s" : ""}`));
  c.addSeparatorComponents(new SeparatorBuilder()
    .setSpacing(SeparatorSpacingSize.Small).setDivider(true));

  if (!ended) {
    // Up to 5 option buttons fill a row (Discord max 5 per row), so "My Vote" gets its own row
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
      ...options.map((_, i) =>
        new ButtonBuilder()
          .setCustomId(`poll_vote_${i}`)
          .setEmoji(parseEmoji(OPTION_EMOJIS[i]))
          .setStyle(ButtonStyle.Secondary)
      ),
    ));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("poll_results")
        .setLabel("My Vote")
        .setStyle(ButtonStyle.Primary)
        .setEmoji(parseEmoji("<:n_utils:1567796996830658573>")),
    ));
  } else {
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
      ...options.map((_, i) => {
        const isWinner = votes[i].size === maxVote && maxVote > 0;
        const btn = new ButtonBuilder()
          .setCustomId(`poll_done_${i}`)
          .setEmoji(parseEmoji(OPTION_EMOJIS[i]))
          .setStyle(isWinner ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(true);
        if (isWinner) btn.setLabel("Winner");
        return btn;
      })
    ));
  }

  return c;
}

// ── Active polls registry ─────────────────────────────────────────────────────
// key: messageId → { votes, options, question, authorTag, endTs, accent, msg, guildId }
const activePolls = new Map();

// ── Attach a component collector to a (re-)hydrated message ──────────────────
function attachCollector(msg, { votes, options, question, authorTag, endTs, accent }, remainingMs, client) {
  // Don't attach if poll has already expired
  if (remainingMs <= 0) {
    // Mark it ended immediately
    endPoll(msg, { votes, options, question, authorTag, endTs, accent }).catch(() => {});
    return;
  }

  const collector = msg.createMessageComponentCollector({ time: remainingMs, persistent: true });

  collector.on("collect", async (i) => {
    if (!activePolls.has(msg.id)) return;

    // ── Show personal results ────────────────────────────────────────────────
    if (i.customId === "poll_results") {
      const total  = Object.values(votes).reduce((a, v) => a + v.size, 0);
      const myIdx  = options.findIndex((_, idx) => votes[idx].has(i.user.id));

      const lines = options.map((opt, idx) => {
        const count = votes[idx].size;
        const pct   = total ? Math.round((count / total) * 100) : 0;
        const mine  = idx === myIdx ? "  **◀ Your vote**" : "";
        return `${OPTION_EMOJIS[idx]}  **${opt}**\n\`${progressBar(pct)}\` ${pct}% (${count} vote${count !== 1 ? "s" : ""})${mine}`;
      }).join("\n\n");

      const myVoteStr = myIdx >= 0
        ? `Voted for **${options[myIdx]}**`
        : "You haven't voted yet";

      const resC = new ContainerBuilder().setAccentColor(accent)
        .addTextDisplayComponents(new TextDisplayBuilder()
          .setContent(`## <:n_utils:1567796996830658573>  Live Results — ${question}`))
        .addSeparatorComponents(new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines))
        .addSeparatorComponents(new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder()
          .setContent(`-# ${myVoteStr} • ${total} total vote${total !== 1 ? "s" : ""} • Ends <t:${endTs}:R>`));

      return i.reply({
        components: [resC],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    // ── Vote ─────────────────────────────────────────────────────────────────
    if (i.customId.startsWith("poll_vote_")) {
      const idx = parseInt(i.customId.split("_")[2]);
      if (isNaN(idx) || !votes[idx]) return;

      const wasVoted = votes[idx].has(i.user.id);
      Object.values(votes).forEach(s => s.delete(i.user.id));
      if (!wasVoted) votes[idx].add(i.user.id);

      // Persist updated votes to DB
      await persistVotes(msg.id, votes);

      await i.reply({
        content: wasVoted
          ? `<:n_add:1567796983408754731> Removed your vote for **${options[idx]}**.`
          : `<a:tickyy:1567797045253644368> Voted for **${options[idx]}**! Click again to deselect.`,
        flags: MessageFlags.Ephemeral,
      });

      const updated = buildPollContainer(accent, question, options, votes, authorTag, endTs, false);
      await msg.edit({ components: [updated], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
  });

  collector.on("end", async (_collected, reason) => {
    // Only finalise if the poll genuinely expired.
    // "time" means the timer ran out — that's a real end.
    // Any other reason (e.g. "messageDelete", client restart) should be
    // ignored here; restorePolls will re-attach a fresh collector on next boot.
    if (reason !== "time") return;
    await endPoll(msg, { votes, options, question, authorTag, endTs, accent });
  });
}

// ── Finalise a poll (edit message + announce winner) ─────────────────────────
async function endPoll(msg, { votes, options, question, authorTag, endTs, accent }) {
  activePolls.delete(msg.id);
  await pollSchema.deleteOne({ Message: msg.id }).catch(() => {});

  const final = buildPollContainer(accent, question, options, votes, authorTag, endTs, true);
  await msg.edit({ components: [final], flags: MessageFlags.IsComponentsV2 }).catch(() => {});

  const total   = Object.values(votes).reduce((a, v) => a + v.size, 0);
  if (total === 0) return;

  const maxVote = Math.max(...options.map((_, i) => votes[i].size));
  const winners = options.filter((_, i) => votes[i].size === maxVote && maxVote > 0);
  const winText = winners.length === 1
    ? `<:1430986209995526274:1567796911350747206> **Winner:** ${winners[0]} with ${maxVote} vote${maxVote !== 1 ? "s" : ""}`
    : `<:user:1567797032423264261> **Tie!** ${winners.join(", ")} — ${maxVote} votes each`;

  const annC = new ContainerBuilder().setAccentColor(ACCENT.success)
    .addTextDisplayComponents(new TextDisplayBuilder()
      .setContent(`## <:n_utils:1567796996830658573>  Poll Closed — **${question}**`))
    .addSeparatorComponents(new SeparatorBuilder()
      .setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder()
      .setContent(`${winText}\n-# ${total} total vote${total !== 1 ? "s" : ""} cast`));

  msg.channel.send({ components: [annC], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
}

// ── Restore polls on startup ──────────────────────────────────────────────────
async function restorePolls(client) {
  const records = await pollSchema.find({}).lean().catch(() => []);
  let restored = 0, expired = 0, failed = 0;

  for (const record of records) {
    try {
      // Skip corrupt records missing required fields
      if (!record.Message || !record.Channel || !record.Guild) {
        await pollSchema.deleteOne({ _id: record._id }).catch(() => {});
        failed++;
        continue;
      }

      const nowSec = Math.floor(Date.now() / 1000);

      // If EndTs is missing, try to derive it from Duration stored as e.g. "60m"
      let endTs = record.EndTs || 0;
      if (!endTs && record.Duration) {
        const mins = parseInt(record.Duration);
        if (!isNaN(mins)) endTs = Math.floor((record._id.getTimestamp().getTime() + minutesToMs(mins)) / 1000);
      }

      const remainingMs = endTs ? (endTs - nowSec) * 1000 : 0;

      // Already expired — clean up and mark as ended
      if (remainingMs <= 0) {
        const guild   = client.guilds.cache.get(record.Guild);
        const channel = guild?.channels.cache.get(record.Channel) ??
                        await guild?.channels?.fetch(record.Channel).catch(() => null);

        if (channel) {
          const msg = channel.messages.cache.get(record.Message) ?? await channel.messages.fetch(record.Message).catch(() => null);
          if (msg) {
            const options = record.Answers || [];
            const votes   = votesFromDb(record.Votes, options.length);
            const accent  = record.Accent || ACCENT.info;
            const final   = buildPollContainer(accent, record.Question, options, votes,
                                               record.AuthorTag || "Unknown", endTs, true);
            await msg.edit({ components: [final], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
          }
        }
        await pollSchema.deleteOne({ Message: record.Message }).catch(() => {});
        expired++;
        continue;
      }

      // Still live — re-hydrate
const guild = client.guilds.cache.get(record.Guild);

if (!guild) {
  await pollSchema.deleteOne({ Message: record.Message }).catch(() => {});
  failed++;
  continue;
}

const channel =
  guild.channels.cache.get(record.Channel) ||
  await guild.channels.fetch(record.Channel).catch(() => null);
      if (!channel) { failed++; continue; }

      const msg = channel.messages.cache.get(record.Message) ?? await channel.messages.fetch(record.Message).catch(() => null);
      if (!msg) { await pollSchema.deleteOne({ Message: record.Message }).catch(() => {}); failed++; continue; }

      const options   = record.Answers || [];
      const votes     = votesFromDb(record.Votes, options.length);
      const accent    = record.Accent || ACCENT.info;
      const authorTag = record.AuthorTag || "Unknown";

      const pollData = { votes, options, question: record.Question, authorTag, endTs, accent, msg, guildId: record.Guild };
      activePolls.set(msg.id, pollData);
      attachCollector(msg, pollData, remainingMs, client);

      // Refresh the live message so the timer re-renders correctly
      const updated = buildPollContainer(accent, record.Question, options, votes, authorTag, endTs, false);
      await msg.edit({ components: [updated], flags: MessageFlags.IsComponentsV2 }).catch(() => {});

      restored++;
    } catch (err) {
      console.error(`[Poll] Failed to restore poll ${record.Message}:`, err.message);
      failed++;
    }
  }

  if (records.length) {
    console.log(`[Poll] Restored ${restored} active, ended ${expired} expired, ${failed} failed.`);
  }
}

// ── Module export ─────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName("poll").setDMPermission(false)
    .setDescription("Create and manage community polls.")
    .addSubcommand(s => s
      .setName("create").setDescription("Create a new poll.")
      .addChannelOption(o => o.setName("channel").setDescription("Channel to send the poll in.").setRequired(true))
      .addStringOption(o => o.setName("question").setDescription("The poll question.").setRequired(true).setMaxLength(200))
      .addStringOption(o => o.setName("option1").setDescription("Option 1").setRequired(true).setMaxLength(80))
      .addStringOption(o => o.setName("option2").setDescription("Option 2").setRequired(true).setMaxLength(80))
      .addIntegerOption(o => o.setName("duration").setDescription("How long the poll lasts.").setRequired(true)
        .addChoices(...DURATION_CHOICES))
      .addStringOption(o => o.setName("option3").setDescription("Option 3 (optional)").setMaxLength(80))
      .addStringOption(o => o.setName("option4").setDescription("Option 4 (optional)").setMaxLength(80))
      .addStringOption(o => o.setName("option5").setDescription("Option 5 (optional)").setMaxLength(80))
    )
    .addSubcommand(s => s
      .setName("end").setDescription("End an active poll early (requires Manage Messages).")
      .addStringOption(o => o.setName("poll_id").setDescription("Message ID of the poll to end.").setRequired(true))
    )
    .addSubcommand(s => s
      .setName("list").setDescription("List all active polls in this server.")
    ),

  activePolls,
  restorePolls, // exported so ready.js can call it

  async execute(interaction, client) {
    const sub    = interaction.options.getSubcommand();
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16)
      : ACCENT.info;

    // ── CREATE ──────────────────────────────────────────────────────────────
    if (sub === "create") {
      const targetChannel = interaction.options.getChannel("channel");
      const question    = interaction.options.getString("question");
      const durationMin = interaction.options.getInteger("duration");
      const options     = [
        interaction.options.getString("option1"),
        interaction.options.getString("option2"),
        interaction.options.getString("option3"),
        interaction.options.getString("option4"),
        interaction.options.getString("option5"),
      ].filter(Boolean);

      // Defer ephemerally so we can respond after sending
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const endTs = Math.floor((Date.now() + minutesToMs(durationMin)) / 1000);
      const votes = {};
      options.forEach((_, i) => { votes[i] = new Set(); });

      let msg;
      try {
        const container = buildPollContainer(accent, question, options, votes, interaction.user.tag, endTs, false);
        msg = await targetChannel.send({
          components: [container],
          flags:      MessageFlags.IsComponentsV2,
        });
      } catch (err) {
        const errC = new ContainerBuilder().setAccentColor(ACCENT.error)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:crossy:1567796959648030831>  Error"))
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`${err.message}\``));
        return interaction.editReply({ components: [errC], flags: MessageFlags.IsComponentsV2 });
      }

      // Persist to DB
      const pollData = { votes, options, question, authorTag: interaction.user.tag, endTs, accent, msg, guildId: interaction.guild.id };
      activePolls.set(msg.id, pollData);

      await pollSchema.create({
        Guild:     interaction.guild.id,
        Author:    interaction.user.id,
        Channel:   targetChannel.id,
        Message:   msg.id,
        Question:  question,
        Answers:   options,
        Duration:  `${durationMin}m`,
        Votes:     votesToDb(votes),
        EndTs:     endTs,
        Accent:    accent,
        AuthorTag: interaction.user.tag,
      }).catch(() => {});

      attachCollector(msg, pollData, minutesToMs(durationMin), client);

      const okC = new ContainerBuilder().setAccentColor(ACCENT.success)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <a:tickyy:1567797045253644368>  Poll Sent"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Sent in ${targetChannel}`));
      return interaction.editReply({ components: [okC], flags: MessageFlags.IsComponentsV2 });
    }

    // ── END ─────────────────────────────────────────────────────────────────
    if (sub === "end") {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        const errC = new ContainerBuilder().setAccentColor(ACCENT.error)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:crossy:1567796959648030831>  Missing Permission"))
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent("You need **Manage Messages** to end polls early."));
        return interaction.reply({ components: [errC], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
      }

      const pollId   = interaction.options.getString("poll_id");
      const pollData = activePolls.get(pollId);
      if (!pollData) {
        const errC = new ContainerBuilder().setAccentColor(ACCENT.error)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:crossy:1567796959648030831>  Poll Not Found"))
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `No active poll with ID \`${pollId}\`.\nUse \`/poll list\` to see running polls.`
          ));
        return interaction.reply({ components: [errC], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
      }

      activePolls.delete(pollId);
      await pollSchema.deleteOne({ Message: pollId }).catch(() => {});
      const final = buildPollContainer(pollData.accent, pollData.question, pollData.options,
                                       pollData.votes, pollData.authorTag, pollData.endTs, true);
      await pollData.msg.edit({ components: [final], flags: MessageFlags.IsComponentsV2 }).catch(() => {});

      const okC = new ContainerBuilder().setAccentColor(ACCENT.success)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <a:tickyy:1567797045253644368>  Poll Ended Early"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `**Question:** ${pollData.question}\n**ID:** \`${pollId}\`\nResults are now locked.`
        ));
      return interaction.reply({ components: [okC], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    }

    // ── LIST ────────────────────────────────────────────────────────────────
    if (sub === "list") {
      const guildPolls = [...activePolls.entries()].filter(([, p]) => p.guildId === interaction.guild.id);
      if (!guildPolls.length) {
        const noneC = new ContainerBuilder().setAccentColor(ACCENT.info)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:n_utils:1567796996830658573>  Active Polls"))
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent("No active polls in this server right now."));
        return interaction.reply({ components: [noneC], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
      }

      const lines = guildPolls.map(([id, p]) => {
        const total = Object.values(p.votes).reduce((a, v) => a + v.size, 0);
        return `**${p.question}**\n> ID: \`${id}\` • ${total} vote${total !== 1 ? "s" : ""} • Ends <t:${p.endTs}:R>`;
      }).join("\n\n");

      const listC = new ContainerBuilder().setAccentColor(accent)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:n_utils:1567796996830658573>  Active Polls — ${guildPolls.length}`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder()
          .setContent("-# `/poll end <id>` to end early • `/poll create` to start a new poll"));
      return interaction.reply({ components: [listC], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    }
  },
};