'use strict';

const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags,
  EmbedBuilder, ChannelType,
} = require('discord.js');
const QOTDSchema = require('../../Schemas/qotdSchema');
const { successContainer, errorContainer, modActionContainer, ACCENT } = require('../../Utils/v2helpers');

// Built-in fallback question bank
const FALLBACK_QUESTIONS = [
  'If you could have any superpower for one day, what would it be and why?',
  'What\'s the most valuable lesson you\'ve learned this year?',
  'If you could instantly master any skill, what would it be?',
  'What\'s a book, show, or game that changed how you think about something?',
  'What would you do if you had an extra hour every day?',
  'What\'s the best advice someone has ever given you?',
  'If you could visit any place in the world right now, where would you go?',
  'What\'s one thing you wish more people knew about you?',
  'What hobby have you always wanted to pick up but haven\'t yet?',
  'If you could have a conversation with anyone from history, who would it be?',
  'What small thing makes your day significantly better?',
  'What\'s something you\'re proud of that you rarely talk about?',
  'If you could change one thing about how the world works, what would it be?',
  'What\'s the most interesting thing you\'ve learned recently?',
  'What\'s a goal you\'re working toward right now?',
  'If you could live in any fictional universe, which would you choose?',
  'What\'s something you used to believe that you no longer do?',
  'What does your perfect day look like?',
  'What skill do you think everyone should learn?',
  'What\'s the most spontaneous thing you\'ve ever done?',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('qotd')
    .setDescription('Question of the Day system management.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Configure the QOTD system.')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to post QOTD in.').setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addStringOption(o => o.setName('time').setDescription('Time to post daily (HH:MM in UTC, e.g. 09:00).').setRequired(false))
      .addRoleOption(o => o.setName('ping_role').setDescription('Role to ping when QOTD posts.').setRequired(false))
      .addBooleanOption(o => o.setName('create_thread').setDescription('Create a discussion thread for each QOTD (default: false).').setRequired(false))
      .addStringOption(o => o.setName('title').setDescription('Embed title (default: "Question of the Day").').setRequired(false).setMaxLength(64))
      .addStringOption(o => o.setName('color').setDescription('Embed accent colour (hex, e.g. #FF5733).').setRequired(false)))
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add a question to the QOTD bank.')
      .addStringOption(o => o.setName('question').setDescription('The question to add.').setRequired(true).setMaxLength(500)))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove a question from the bank by index.')
      .addIntegerOption(o => o.setName('index').setDescription('Question number (use /qotd list to see indices).').setRequired(true).setMinValue(1)))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List all questions in the QOTD bank.'))
    .addSubcommand(sub => sub
      .setName('post')
      .setDescription('Manually post today\'s QOTD now.'))
    .addSubcommand(sub => sub
      .setName('disable')
      .setDescription('Disable the QOTD system.')),

  async execute(interaction, client) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    const ephErr = (title, body) => interaction.reply({
      components: [errorContainer(title, body, { clientId: client.user.id })],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });

    switch (sub) {
      case 'setup': {
        const channel     = interaction.options.getChannel('channel');
        const time        = interaction.options.getString('time') || '09:00';
        const pingRole    = interaction.options.getRole('ping_role');
        const makeThread  = interaction.options.getBoolean('create_thread') ?? false;
        const title       = interaction.options.getString('title') || 'Question of the Day';
        const colorRaw    = interaction.options.getString('color') || '#6C53FF';

        if (!/^\d{2}:\d{2}$/.test(time) || parseInt(time.split(':')[0]) > 23 || parseInt(time.split(':')[1]) > 59)
          return ephErr('Invalid Time', 'Time must be in HH:MM format (24-hour UTC), e.g. `09:00`.');

        const color = /^#[0-9a-fA-F]{6}$/.test(colorRaw) ? colorRaw : '#6C53FF';

        await QOTDSchema.findOneAndUpdate(
          { guildId },
          { channelId: channel.id, schedule: time, roleId: pingRole?.id || null,
            enabled: true, createThread: makeThread, embedTitle: title, color },
          { upsert: true, new: true },
        );

        await interaction.reply({
          components: [successContainer('QOTD Configured',
            `**Channel:** <#${channel.id}>\n**Posts at:** ${time} UTC daily\n` +
            `${pingRole ? `**Ping:** <@&${pingRole.id}>\n` : ''}` +
            `**Thread:** ${makeThread ? 'Yes' : 'No'}\n\n` +
            `Use \`/qotd add\` to add questions to the bank. If the bank is empty, a built-in question will be used.`,
            { clientId: client.user.id }
          )],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
        break;
      }

      case 'add': {
        const question = interaction.options.getString('question');
        const doc = await QOTDSchema.findOneAndUpdate(
          { guildId },
          { $push: { questions: { text: question, addedBy: interaction.user.id } } },
          { upsert: true, new: true },
        );
        await interaction.reply({
          components: [successContainer('Question Added',
            `**Question ${doc.questions.length}:** ${question}`,
            { clientId: client.user.id }
          )],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
        break;
      }

      case 'remove': {
        const idx = interaction.options.getInteger('index') - 1;
        const doc = await QOTDSchema.findOne({ guildId });
        if (!doc || !doc.questions[idx])
          return ephErr('Not Found', `No question at index ${idx + 1}. Use \`/qotd list\` to see available questions.`);

        const removed = doc.questions[idx].text;
        doc.questions.splice(idx, 1);
        await doc.save();

        await interaction.reply({
          components: [successContainer('Question Removed', `Removed: "${removed}"`, { clientId: client.user.id })],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
        break;
      }

      case 'list': {
        const doc = await QOTDSchema.findOne({ guildId });
        const qs  = doc?.questions || [];
        if (!qs.length) {
          return interaction.reply({
            components: [errorContainer('No Questions', 'Your QOTD bank is empty. Use `/qotd add` to add questions. Built-in questions will be used as fallback.', { clientId: client.user.id })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
          });
        }
        const list = qs.map((q, i) =>
          `**${i + 1}.** ${q.text}${q.usedOn ? ` *(used ${q.usedOn})*` : ''}`
        ).join('\n');

        const embed = new EmbedBuilder()
          .setColor(0x6C53FF)
          .setTitle(`QOTD Bank — ${qs.length} question${qs.length === 1 ? '' : 's'}`)
          .setDescription(list.slice(0, 4000))
          .setFooter({ text: 'Questions are picked randomly, unused ones are prioritised.' });

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        break;
      }

      case 'post': {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const doc = await QOTDSchema.findOne({ guildId });
        if (!doc?.channelId)
          return interaction.editReply({ components: [errorContainer('Not Configured', 'Run `/qotd setup` first.', { clientId: client.user.id })], flags: MessageFlags.IsComponentsV2 });

        const channel = interaction.guild.channels.cache.get(doc.channelId);
        if (!channel) return interaction.editReply({ components: [errorContainer('Channel Not Found', 'The configured QOTD channel no longer exists. Re-run `/qotd setup`.', { clientId: client.user.id })], flags: MessageFlags.IsComponentsV2 });

        await postQOTD(doc, channel, interaction.guild, client);

        await interaction.editReply({
          components: [successContainer('QOTD Posted', `Posted to <#${doc.channelId}>.`, { clientId: client.user.id })],
          flags: MessageFlags.IsComponentsV2,
        });
        break;
      }

      case 'disable': {
        await QOTDSchema.findOneAndUpdate({ guildId }, { enabled: false }, { upsert: true });
        await interaction.reply({
          components: [successContainer('QOTD Disabled', 'The QOTD system has been turned off. Your questions are saved.', { clientId: client.user.id })],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
        break;
      }
    }
  },
};

// ── Shared post function (also exported for the cron job) ─────────────────────
async function postQOTD(doc, channel, guild, client) {
  // Pick a question — prioritise unused ones
  let question;
  const today = new Date().toISOString().slice(0, 10);

  const unused = doc.questions.filter(q => !q.usedOn);
  const all    = doc.questions;

  if (unused.length > 0) {
    question = unused[Math.floor(Math.random() * unused.length)];
  } else if (all.length > 0) {
    // All used — reset and pick any
    question = all[Math.floor(Math.random() * all.length)];
  } else if (doc.useFallbackBank) {
    // Built-in bank
    question = { text: FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)] };
  } else {
    return; // Nothing to post
  }

  const color     = parseInt((doc.color || '#6C53FF').replace('#', ''), 16) || 0x6C53FF;
  const pingText  = doc.roleId ? `<@&${doc.roleId}> ` : '';
  const embedTitle = doc.embedTitle || 'Question of the Day';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`<:suggestion:1567797008452812870> ${embedTitle}`)
    .setDescription(question.text)
    .setFooter({ text: doc.footerText || `${guild.name} • ${today}`, iconURL: guild.iconURL({ dynamic: true }) || undefined })
    .setTimestamp();

  const msg = await channel.send({
    content: pingText || undefined,
    embeds: [embed],
    allowedMentions: doc.roleId ? { roles: [doc.roleId] } : { parse: [] },
  });

  // Create discussion thread if enabled
  if (doc.createThread && msg.channel.isTextBased()) {
    try {
      await msg.startThread({
        name: `QOTD Discussion — ${today}`,
        autoArchiveDuration: Math.min(doc.threadDuration || 1440, 10080),
      });
    } catch (_) {}
  }

  // Mark question as used
  if (question.text && doc.questions.some(q => q.text === question.text)) {
    const idx = doc.questions.findIndex(q => q.text === question.text);
    if (idx !== -1) {
      doc.questions[idx].usedOn = today;
      doc.lastPostedDate = today;
      await doc.save();
    }
  } else {
    doc.lastPostedDate = today;
    await doc.save();
  }
}

module.exports.postQOTD = postQOTD;
