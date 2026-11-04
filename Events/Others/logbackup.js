const { EmbedBuilder, Events, MessageFlags, AttachmentBuilder, PermissionsBitField, AuditLogEvent } = require("discord.js");

// --- Anti-rate-limit log queue ---
const LOG_BATCH_SIZE = 3;        // how many messages per batch
const LOG_BATCH_DELAY = 1500;    // delay between batches (ms)
const MAX_EMBED_CONTENT = 3500;    

const logQueues = new Map();     // channelId => { queue, running }
const logErrorNotified = new Set();
const disabledGuilds = new Set(); // Guilds where logging has been disabled due to errors

function contentToFile(content, filename) {
  return new AttachmentBuilder(
    Buffer.from(content, "utf-8"),
    { name: filename }
  );
}

function chunkString(text, maxLength = 4000) {
  if (!text) return [];
  const chunks = [];
  let current = '';

  for (const line of text.split('\n')) {
    if ((current + '\n' + line).length > maxLength) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function handleLogs(client) {
  const logSchema = require("../../Schemas/logschema");

  async function send_log(guildId, embeds, logType, files = []) {
    // Check if guild is disabled
    if (disabledGuilds.has(guildId)) return;

    const data = await logSchema.findOne({ Guild: guildId });
    if (!data || !data.LogChannels) return;

    const logChannels = data.LogChannels;
    const targetChannelId = logChannels[logType] ?? logChannels.all;
    if (!targetChannelId) return;

    const logChannel = client.channels.cache.get(targetChannelId);
    if (!logChannel) return;

    // Normalize to array
    if (!Array.isArray(embeds)) embeds = [embeds];

    // Add timestamp safely
    embeds.forEach(e => {
      if (e?.setTimestamp) e.setTimestamp();
    });

    // Init queue
    if (!logQueues.has(targetChannelId)) {
      logQueues.set(targetChannelId, { queue: [], running: false });
    }

    const queueData = logQueues.get(targetChannelId);
    queueData.queue.push({
      channel: logChannel,
      embeds,
      guildId,
      logType,
      files,
      targetChannelId,
    });

    if (!queueData.running) {
      processLogQueue(targetChannelId);
    }
  }

  async function processLogQueue(channelId) {
    const data = logQueues.get(channelId);
    if (!data) return;

    data.running = true;

    while (data.queue.length) {
      const batch = data.queue.splice(0, LOG_BATCH_SIZE);

      for (const item of batch) {
        try {
          await item.channel.send({ embeds: item.embeds, files: item.files });
        } catch (err) {
          console.log(`Error sending ${item.logType} log:`, err);

          const notifyKey = `${item.guildId}:${item.logType}`;
          if (logErrorNotified.has(notifyKey)) continue;
          logErrorNotified.add(notifyKey);

          try {
            const guild = await client.guilds.fetch(item.guildId);
            const owner = await guild.fetchOwner();

            await owner.send({
              embeds: [
                new EmbedBuilder()
                  .setTitle("Logging Error")
                  .setColor("Red")
                  .setDescription(
                    `I tried to send a **${item.logType} log**, but failed.\n\n` +
                    `**Possible reasons:**\n` +
                    `• Missing permissions\n` +
                    `• Log channel deleted\n` +
                    `• I cannot send embeds\n\n` +
                    `**Channel ID:** \`${item.targetChannelId}\`\n` +
                    `**Guild:** ${guild.name}\n\n` +
                    `*Logging for this guild will be temporarily disabled until fixed.*`
                  )
                  .setFooter({ text: "This message is sent once to avoid spam." })
                  .setTimestamp()
              ]
            });
          } catch (dmErr) {
            console.log("Failed to DM guild owner:", dmErr);
          }
        }
      }

      // Delay before next batch
      if (data.queue.length) {
        await new Promise(res => setTimeout(res, LOG_BATCH_DELAY));
      }
    }

    data.running = false;
  }

  // ========== MESSAGE LOGS ==========

  client.on("messageDelete", async (message) => {
    try {
      if (!message.guild || !message.author || message.author.bot) return;

      const audit = await message.guild.fetchAuditLogs({
        type: AuditLogEvent.MessageDelete,
        limit: 1
      }).catch(() => null);

      const entry = audit?.entries.first();
      const deleter =
        entry && entry.target?.id === message.author.id && (Date.now() - entry.createdTimestamp) < 5000
          ? entry.executor
          : null;

      const attachments = message.attachments.size
        ? message.attachments.map(a => `[${a.name}](${a.url})`).join("\n")
        : "None";

      const content = message.content || "*No text content*";
      const chunks = chunkString(content);

      const embeds = [];
      const files = [];

      // MAIN EMBED
      const mainEmbed = new EmbedBuilder()
        .setTitle("> Message Deleted")
        .setColor("#FF6B6B")
        .addFields(
          { name: "• Author", value: `> ${message.author} (*${message.author.tag}*)`, inline: true },
          { name: "• Deleted By", value: `> ${deleter ?? "Unknown / Self"}`, inline: true },
          { name: "• Channel", value: `> ${message.channel}`, inline: false },
          { name: "• Message ID", value: `> \`${message.id}\``, inline: true },
          { name: "• Created At", value: `> <t:${Math.floor(message.createdTimestamp / 1000)}:R>`, inline: true }
        )
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Message Deleted" });

      if (message.attachments.size > 0) {
        mainEmbed.addFields({ name: "• Attachments", value: `> ${attachments}` });
      }

      if (message.reference) {
        mainEmbed.addFields({ name: "• Was Reply", value: `> Yes - [Jump to Original](https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.reference.messageId})` });
      }

      embeds.push(mainEmbed);

      // CONTENT HANDLING
      if (chunks.length > 3) {
        files.push(contentToFile(content, "deleted-message.txt"));
        embeds.push(
          new EmbedBuilder()
            .setColor("#FF6B6B")
            .setDescription(`**Message Content**\n\n*Content too long - see attachment*`)
        );
      } else if (content !== "*No text content*") {
        chunks.forEach((chunk, i) => {
          embeds.push(
            new EmbedBuilder()
              .setColor("#FF6B6B")
              .setDescription(`**Message Content ${chunks.length > 1 ? `(Part ${i + 1}/${chunks.length})` : ''}**\n\n${chunk}`)
          );
        });
      }

      return send_log(message.guild.id, embeds, "message", files);
    } catch (err) {
      console.log("Error logging message delete:", err);
    }
  });

  client.on("messageDeleteBulk", async (messages) => {
    try {
      const firstMessage = messages.first();
      if (!firstMessage?.guild) return;

      const guild = firstMessage.guild;
      const channel = firstMessage.channel;

      const audit = await guild.fetchAuditLogs({
        type: AuditLogEvent.MessageBulkDelete,
        limit: 1
      }).catch(() => null);

      const executor = audit?.entries.first()?.executor;

      // Create detailed text file of all deleted messages
      let messageLog = `Bulk Delete Log - ${messages.size} messages\n`;
      messageLog += `Channel: #${channel.name}\n`;
      messageLog += `Time: ${new Date().toISOString()}\n`;
      messageLog += `${'='.repeat(50)}\n\n`;

      messages.forEach(msg => {
        messageLog += `[${msg.createdAt.toISOString()}] ${msg.author?.tag || 'Unknown'} (${msg.author?.id || 'Unknown ID'})\n`;
        messageLog += `Content: ${msg.content || '*No content*'}\n`;
        if (msg.attachments.size > 0) {
          messageLog += `Attachments: ${msg.attachments.map(a => a.url).join(', ')}\n`;
        }
        messageLog += `\n${'─'.repeat(50)}\n\n`;
      });

      const embed = new EmbedBuilder()
        .setTitle("> Bulk Message Delete")
        .setColor("#FF6B6B")
        .addFields(
          { name: "• Messages Deleted", value: `> ${messages.size}`, inline: true },
          { name: "• Channel", value: `> ${channel}`, inline: true },
          { name: "• Deleted By", value: `> ${executor || "Unknown"}`, inline: false },
          { name: "• Details", value: `> Full log attached as file` }
        )
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Bulk Delete" });

      return send_log(guild.id, embed, "message", [contentToFile(messageLog, `bulk-delete-${Date.now()}.txt`)]);
    } catch (err) {
      console.log("Error logging bulk delete:", err);
    }
  });

  client.on("messageUpdate", async (oldMessage, newMessage) => {
    try {
      if (
        !newMessage.guild ||
        !newMessage.author ||
        newMessage.author.bot ||
        oldMessage.partial ||
        newMessage.partial
      ) return;

      if (oldMessage.content === newMessage.content) return;

      const before = oldMessage.content || "*No content*";
      const after = newMessage.content || "*No content*";

      const beforeChunks = chunkString(before);
      const afterChunks = chunkString(after);

      const embeds = [];
      const files = [];

      // MAIN EMBED
      embeds.push(
        new EmbedBuilder()
          .setTitle("> Message Edited")
          .setColor("#4ECDC4")
          .addFields(
            { name: "• Member", value: `> ${newMessage.author} (*${newMessage.author.tag}*)`, inline: true },
            { name: "• Channel", value: `> ${newMessage.channel}`, inline: true },
            { name: "• Message ID", value: `> \`${newMessage.id}\``, inline: true },
            { name: "• Created At", value: `> <t:${Math.floor(newMessage.createdTimestamp / 1000)}:R>`, inline: true },
            { name: "• Edited At", value: `> <t:${Math.floor(newMessage.editedTimestamp / 1000)}:R>`, inline: true },
            { name: "• Jump", value: `> [Go to message](${newMessage.url})`, inline: true }
          )
          .setThumbnail(newMessage.author.displayAvatarURL({ dynamic: true }))
          .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
          .setFooter({ text: "<:error:1555544434601369620> Message Edited" })
      );

      // BEFORE
      if (beforeChunks.length > 3) {
        files.push(contentToFile(before, "before-edit.txt"));
        embeds.push(
          new EmbedBuilder()
            .setColor("#FF9999")
            .setDescription(`**Before**\n\n*Content too long - see attachment*`)
        );
      } else {
        beforeChunks.forEach((chunk, i) => {
          embeds.push(
            new EmbedBuilder()
              .setColor("#FF9999")
              .setDescription(`**Before ${beforeChunks.length > 1 ? `(Part ${i + 1}/${beforeChunks.length})` : ''}**\n\n${chunk}`)
          );
        });
      }

      // AFTER
      if (afterChunks.length > 3) {
        files.push(contentToFile(after, "after-edit.txt"));
        embeds.push(
          new EmbedBuilder()
            .setColor("#99FF99")
            .setDescription(`**After**\n\n*Content too long - see attachment*`)
        );
      } else {
        afterChunks.forEach((chunk, i) => {
          embeds.push(
            new EmbedBuilder()
              .setColor("#99FF99")
              .setDescription(`**After ${afterChunks.length > 1 ? `(Part ${i + 1}/${afterChunks.length})` : ''}**\n\n${chunk}`)
          );
        });
      }

      return send_log(newMessage.guild.id, embeds, "message", files);
    } catch (err) {
      console.log("Error logging message edit:", err);
    }
  });

  client.on("messageReactionAdd", async (reaction, user) => {
    try {
      if (user.bot) return;
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
      if (!reaction.message.guild) return;

      const embed = new EmbedBuilder()
        .setTitle("> Reaction Added")
        .setColor("#95E1D3")
        .addFields(
          { name: "• User", value: `> ${user}`, inline: true },
          { name: "• Emoji", value: `> ${reaction.emoji}`, inline: true },
          { name: "• Channel", value: `> ${reaction.message.channel}`, inline: true },
          { name: "• Message Author", value: `> ${reaction.message.author}`, inline: true },
          { name: "• Jump to Message", value: `> [Click Here](${reaction.message.url})`, inline: true }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Reaction Added" });

      return send_log(reaction.message.guild.id, embed, "message");
    } catch (err) {
      console.log("Error logging reaction add:", err);
    }
  });

  client.on("messageReactionRemove", async (reaction, user) => {
    try {
      if (user.bot) return;
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
      if (!reaction.message.guild) return;

      const embed = new EmbedBuilder()
        .setTitle("> Reaction Removed")
        .setColor("#F38181")
        .addFields(
          { name: "• User", value: `> ${user}`, inline: true },
          { name: "• Emoji", value: `> ${reaction.emoji}`, inline: true },
          { name: "• Channel", value: `> ${reaction.message.channel}`, inline: true },
          { name: "• Message Author", value: `> ${reaction.message.author}`, inline: true },
          { name: "• Jump to Message", value: `> [Click Here](${reaction.message.url})`, inline: true }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Reaction Removed" });

      return send_log(reaction.message.guild.id, embed, "message");
    } catch (err) {
      console.log("Error logging reaction remove:", err);
    }
  });

  client.on("channelPinsUpdate", async (channel, time) => {
    try {
      if (!channel.guild) return;

      const audit = await channel.guild.fetchAuditLogs({
        type: AuditLogEvent.MessagePin,
        limit: 1
      }).catch(() => null);

      const entry = audit?.entries.first();
      if (!entry) return;

      const message = channel.messages.cache.get(entry.target.id) ?? await channel.messages.fetch(entry.target.id).catch(() => null);
      if (!message) return;

      const isPinned = message.pinned;
      const content = message.content?.substring(0, 100) || "*No text content*";

      const embed = new EmbedBuilder()
        .setTitle(`> Message ${isPinned ? 'Pinned' : 'Unpinned'}`)
        .setColor(isPinned ? "#FFD93D" : "#A8A8A8")
        .addFields(
          { name: `• ${isPinned ? 'Pinned' : 'Unpinned'} By`, value: `> ${entry.executor}`, inline: true },
          { name: "• Message Author", value: `> ${message.author}`, inline: true },
          { name: "• Channel", value: `> ${channel}`, inline: false },
          { name: "• Message Preview", value: `> ${content}${message.content?.length > 100 ? '...' : ''}` },
          { name: "• Jump", value: `> [Go to message](${message.url})` }
        )
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: `<:error:1555544434601369620> Message ${isPinned ? 'Pinned' : 'Unpinned'}` });

      return send_log(channel.guild.id, embed, "message");
    } catch (err) {
      console.log("Error logging message pin:", err);
    }
  });

  // ========== CHANNEL LOGS ==========

  client.on("channelCreate", async (channel) => {
    try {
      if (!channel.guild) return;

      const audit = await channel.guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelCreate,
        limit: 1
      }).catch(() => null);

      const executor = audit?.entries.first()?.executor;

      const perms = channel.permissionOverwrites?.cache
        .map(o => `<@&${o.id}>`)
        .join(", ") || "None";

      const embed = new EmbedBuilder()
        .setTitle("> Channel Created")
        .setColor("#6BCF7F")
        .addFields(
          { name: "• Channel", value: `> ${channel}`, inline: true },
          { name: "• Type", value: `> ${channel.type}`, inline: true },
          { name: "• Category", value: `> ${channel.parent ?? "None"}`, inline: true },
          { name: "• Position", value: `> ${channel.rawPosition}`, inline: true },
          { name: "• Channel ID", value: `> \`${channel.id}\``, inline: true },
          { name: "• Created By", value: `> ${executor || "Unknown"}`, inline: true }
        )
        .setThumbnail(channel.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Channel Created" });

      if (channel.nsfw !== undefined) {
        embed.addFields({ name: "• NSFW", value: `> ${channel.nsfw ? "Yes" : "No"}`, inline: true });
      }

      if (channel.rateLimitPerUser !== undefined) {
        embed.addFields({ name: "• Slowmode", value: `> ${channel.rateLimitPerUser}s`, inline: true });
      }

      if (channel.topic) {
        embed.addFields({ name: "• Topic", value: `> ${channel.topic.substring(0, 100)}${channel.topic.length > 100 ? '...' : ''}` });
      }

      if (perms !== "None") {
        embed.addFields({ name: "• Permission Overwrites", value: `> ${perms}` });
      }

      return send_log(channel.guild.id, embed, "channel");
    } catch (err) {
      console.log("Error logging channel create:", err);
    }
  });

  client.on("channelDelete", async (channel) => {
    try {
      if (!channel.guild) return;

      const audit = await channel.guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelDelete,
        limit: 1
      }).catch(() => null);

      const executor = audit?.entries.first()?.executor;

      const embed = new EmbedBuilder()
        .setTitle("> Channel Deleted")
        .setColor("#FF6B6B")
        .addFields(
          { name: "• Channel Name", value: `> #${channel.name}`, inline: true },
          { name: "• Type", value: `> ${channel.type}`, inline: true },
          { name: "• Category", value: `> ${channel.parent?.name ?? "None"}`, inline: true },
          { name: "• Position", value: `> ${channel.rawPosition}`, inline: true },
          { name: "• Channel ID", value: `> \`${channel.id}\``, inline: true },
          { name: "• Deleted By", value: `> ${executor || "Unknown"}`, inline: true }
        )
        .setThumbnail(channel.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Channel Deleted" });

      if (channel.nsfw !== undefined) {
        embed.addFields({ name: "• NSFW", value: `> ${channel.nsfw ? "Yes" : "No"}`, inline: true });
      }

      if (channel.rateLimitPerUser !== undefined) {
        embed.addFields({ name: "• Slowmode", value: `> ${channel.rateLimitPerUser}s`, inline: true });
      }

      if (channel.topic) {
        embed.addFields({ name: "• Topic", value: `> ${channel.topic.substring(0, 100)}${channel.topic.length > 100 ? '...' : ''}` });
      }

      return send_log(channel.guild.id, embed, "channel");
    } catch (err) {
      console.log("Error logging channel delete:", err);
    }
  });

  client.on("channelUpdate", async (oldChannel, newChannel) => {
    try {
      if (!newChannel.guild) return;

      const changes = [];

      if (oldChannel.name !== newChannel.name) {
        changes.push(`**Name:** \`${oldChannel.name}\` <:arrow:1555544351118196810> \`${newChannel.name}\``);
      }

      if (oldChannel.type !== newChannel.type) {
        changes.push(`**Type:** \`${oldChannel.type}\` <:arrow:1555544351118196810> \`${newChannel.type}\``);
      }

      if (oldChannel.topic !== newChannel.topic) {
        changes.push(`**Topic:** \`${oldChannel.topic || 'None'}\` <:arrow:1555544351118196810> \`${newChannel.topic || 'None'}\``);
      }

      if (oldChannel.nsfw !== newChannel.nsfw) {
        changes.push(`**NSFW:** \`${oldChannel.nsfw ? 'Yes' : 'No'}\` <:arrow:1555544351118196810> \`${newChannel.nsfw ? 'Yes' : 'No'}\``);
      }

      if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
        changes.push(`**Slowmode:** \`${oldChannel.rateLimitPerUser}s\` <:arrow:1555544351118196810> \`${newChannel.rateLimitPerUser}s\``);
      }

      if (oldChannel.parentId !== newChannel.parentId) {
        changes.push(`**Category:** \`${oldChannel.parent?.name || 'None'}\` <:arrow:1555544351118196810> \`${newChannel.parent?.name || 'None'}\``);
      }

      if (oldChannel.rawPosition !== newChannel.rawPosition) {
        changes.push(`**Position:** \`${oldChannel.rawPosition}\` <:arrow:1555544351118196810> \`${newChannel.rawPosition}\``);
      }

      if (oldChannel.bitrate !== newChannel.bitrate) {
        changes.push(`**Bitrate:** \`${oldChannel.bitrate / 1000}kbps\` <:arrow:1555544351118196810> \`${newChannel.bitrate / 1000}kbps\``);
      }

      if (oldChannel.userLimit !== newChannel.userLimit) {
        changes.push(`**User Limit:** \`${oldChannel.userLimit || 'Unlimited'}\` <:arrow:1555544351118196810> \`${newChannel.userLimit || 'Unlimited'}\``);
      }

      if (oldChannel.rtcRegion !== newChannel.rtcRegion) {
        changes.push(`**Region:** \`${oldChannel.rtcRegion || 'Automatic'}\` <:arrow:1555544351118196810> \`${newChannel.rtcRegion || 'Automatic'}\``);
      }

      if (oldChannel.videoQualityMode !== newChannel.videoQualityMode) {
        changes.push(`**Video Quality:** \`${oldChannel.videoQualityMode}\` <:arrow:1555544351118196810> \`${newChannel.videoQualityMode}\``);
      }

      if (changes.length === 0) return;

      const embed = new EmbedBuilder()
        .setTitle("> Channel Updated")
        .setColor("#4ECDC4")
        .addFields(
          { name: "• Channel", value: `> ${newChannel}`, inline: true },
          { name: "• Channel ID", value: `> \`${newChannel.id}\``, inline: true },
          { name: "• Changes", value: changes.join("\n") }
        )
        .setThumbnail(newChannel.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Channel Updated" });

      return send_log(newChannel.guild.id, embed, "channel");
    } catch (err) {
      console.log("Error logging channel update:", err);
    }
  });

  client.on("guildChannelPermissionsUpdate", async (channel, oldPermissions, newPermissions) => {
    try {
      if (!channel.guild) return;

      const changes = [];

      for (const [id, newOverwrite] of newPermissions.cache) {
        const oldOverwrite = oldPermissions.cache.get(id);

        if (!oldOverwrite) {
          const target = channel.guild.roles.cache.get(id) || await channel.guild.members.fetch(id).catch(() => null);
          changes.push(`<:n_add:1555544335036973106> **New overwrite added for ${target || `<@${id}>`}**`);
          continue;
        }

        const oldAllow = new PermissionsBitField(oldOverwrite.allow.bitfield);
        const newAllow = new PermissionsBitField(newOverwrite.allow.bitfield);

        const oldDeny = new PermissionsBitField(oldOverwrite.deny.bitfield);
        const newDeny = new PermissionsBitField(newOverwrite.deny.bitfield);

        const addedAllows = newAllow.remove(oldAllow).toArray();
        const removedAllows = oldAllow.remove(newAllow).toArray();

        const addedDenies = newDeny.remove(oldDeny).toArray();
        const removedDenies = oldDeny.remove(newDeny).toArray();

        if (
          addedAllows.length ||
          removedAllows.length ||
          addedDenies.length ||
          removedDenies.length
        ) {
          const target = channel.guild.roles.cache.get(id) || await channel.guild.members.fetch(id).catch(() => null);
          changes.push(
            `**${target || `<@${id}>`}**\n` +
            (addedAllows.length ? `<:LEgreen:1555544256356159600> Allowed: \`${addedAllows.join("`, `")}\`\n` : "") +
            (removedAllows.length ? `<:dot:1555544412300378243> Removed Allow: \`${removedAllows.join("`, `")}\`\n` : "") +
            (addedDenies.length ? `<:LEred:1555544262123323422> Denied: \`${addedDenies.join("`, `")}\`\n` : "") +
            (removedDenies.length ? `<:dot:1555544412300378243> Removed Deny: \`${removedDenies.join("`, `")}\`\n` : "")
          );
        }
      }

      for (const [id, oldOverwrite] of oldPermissions.cache) {
        if (!newPermissions.cache.has(id)) {
          const target = channel.guild.roles.cache.get(id) || await channel.guild.members.fetch(id).catch(() => null);
          changes.push(`<:1430986239036625017:1555544229143519304> **Overwrite removed for ${target || `<@${id}>`}**`);
        }
      }

      if (!changes.length) return;

      const embed = new EmbedBuilder()
        .setTitle("> Channel Permissions Updated")
        .setColor("#FFA07A")
        .addFields(
          { name: "• Channel", value: `> ${channel}`, inline: true },
          { name: "• Channel ID", value: `> \`${channel.id}\``, inline: true },
          { name: "• Changes", value: changes.join("\n") }
        )
        .setThumbnail(channel.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Permissions Update" });

      return send_log(channel.guild.id, embed, "channel");
    } catch (err) {
      console.log("Error logging channel permissions update:", err);
    }
  });

  client.on("threadCreate", (thread) => {
    try {
      if (thread.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Thread Created")
        .setColor("#A8E6CF")
        .addFields(
          { name: "• Thread", value: `> ${thread.name}`, inline: true },
          { name: "• Thread ID", value: `> \`${thread.id}\``, inline: true },
          { name: "• Channel", value: `> ${thread.parent}`, inline: false },
          { name: "• Auto Archive", value: `> ${thread.autoArchiveDuration} minutes`, inline: true },
          { name: "• Created By", value: `> ${thread.ownerId ? `<@${thread.ownerId}>` : 'Unknown'}`, inline: true }
        )
        .setThumbnail(thread.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Thread Created" });

      return send_log(thread.guild.id, embed, "channel");
    } catch (err) {
      console.log("Error logging thread create:", err);
    }
  });

  client.on("threadDelete", (thread) => {
    try {
      if (thread.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Thread Deleted")
        .setColor("#FF6B6B")
        .addFields(
          { name: "• Thread Name", value: `> ${thread.name}`, inline: true },
          { name: "• Thread ID", value: `> \`${thread.id}\``, inline: true },
          { name: "• Channel", value: `> ${thread.parent}`, inline: false },
          { name: "• Archived", value: `> ${thread.archived ? 'Yes' : 'No'}`, inline: true },
          { name: "• Locked", value: `> ${thread.locked ? 'Yes' : 'No'}`, inline: true }
        )
        .setThumbnail(thread.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Thread Deleted" });

      return send_log(thread.guild.id, embed, "channel");
    } catch (err) {
      console.log("Error logging thread delete:", err);
    }
  });

  client.on("threadUpdate", (oldThread, newThread) => {
    try {
      if (oldThread.guild === null) return;

      const changes = [];

      if (oldThread.name !== newThread.name) {
        changes.push(`**Name:** \`${oldThread.name}\` <:arrow:1555544351118196810> \`${newThread.name}\``);
      }

      if (oldThread.archived !== newThread.archived) {
        changes.push(`**Archived:** \`${oldThread.archived ? 'Yes' : 'No'}\` <:arrow:1555544351118196810> \`${newThread.archived ? 'Yes' : 'No'}\``);
      }

      if (oldThread.locked !== newThread.locked) {
        changes.push(`**Locked:** \`${oldThread.locked ? 'Yes' : 'No'}\` <:arrow:1555544351118196810> \`${newThread.locked ? 'Yes' : 'No'}\``);
      }

      if (oldThread.autoArchiveDuration !== newThread.autoArchiveDuration) {
        changes.push(`**Auto Archive:** \`${oldThread.autoArchiveDuration}m\` <:arrow:1555544351118196810> \`${newThread.autoArchiveDuration}m\``);
      }

      if (oldThread.rateLimitPerUser !== newThread.rateLimitPerUser) {
        changes.push(`**Slowmode:** \`${oldThread.rateLimitPerUser}s\` <:arrow:1555544351118196810> \`${newThread.rateLimitPerUser}s\``);
      }

      if (changes.length === 0) return;

      const embed = new EmbedBuilder()
        .setTitle("> Thread Updated")
        .setColor("#4ECDC4")
        .addFields(
          { name: "• Thread", value: `> ${newThread.name}`, inline: true },
          { name: "• Thread ID", value: `> \`${newThread.id}\``, inline: true },
          { name: "• Changes", value: changes.join("\n") }
        )
        .setThumbnail(newThread.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Thread Updated" });

      return send_log(newThread.guild.id, embed, "channel");
    } catch (err) {
      console.log("Error logging thread update:", err);
    }
  });

  // ========== GUILD LOGS ==========

  client.on("guildUpdate", async (oldGuild, newGuild) => {
    try {
      const changes = [];

      if (oldGuild.name !== newGuild.name) {
        changes.push(`**Name:** \`${oldGuild.name}\` <:arrow:1555544351118196810> \`${newGuild.name}\``);
      }

      if (oldGuild.icon !== newGuild.icon) {
        changes.push(`**Icon:** ${oldGuild.icon ? 'Updated' : 'Added'}`);
      }

      if (oldGuild.splash !== newGuild.splash) {
        changes.push(`**Splash:** ${newGuild.splash ? 'Updated' : 'Removed'}`);
      }

      if (oldGuild.banner !== newGuild.banner) {
        changes.push(`**Banner:** ${newGuild.banner ? 'Updated' : 'Removed'}`);
      }

      if (oldGuild.description !== newGuild.description) {
        changes.push(`**Description:** \`${oldGuild.description || 'None'}\` <:arrow:1555544351118196810> \`${newGuild.description || 'None'}\``);
      }

      if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
        changes.push(`**Verification Level:** \`${oldGuild.verificationLevel}\` <:arrow:1555544351118196810> \`${newGuild.verificationLevel}\``);
      }

      if (oldGuild.defaultMessageNotifications !== newGuild.defaultMessageNotifications) {
        changes.push(`**Default Notifications:** \`${oldGuild.defaultMessageNotifications}\` <:arrow:1555544351118196810> \`${newGuild.defaultMessageNotifications}\``);
      }

      if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) {
        changes.push(`**Explicit Content Filter:** \`${oldGuild.explicitContentFilter}\` <:arrow:1555544351118196810> \`${newGuild.explicitContentFilter}\``);
      }

      if (oldGuild.afkChannelId !== newGuild.afkChannelId) {
        changes.push(`**AFK Channel:** ${oldGuild.afkChannel || 'None'} <:arrow:1555544351118196810> ${newGuild.afkChannel || 'None'}`);
      }

      if (oldGuild.afkTimeout !== newGuild.afkTimeout) {
        changes.push(`**AFK Timeout:** \`${oldGuild.afkTimeout / 60}m\` <:arrow:1555544351118196810> \`${newGuild.afkTimeout / 60}m\``);
      }

      if (oldGuild.systemChannelId !== newGuild.systemChannelId) {
        changes.push(`**System Channel:** ${oldGuild.systemChannel || 'None'} <:arrow:1555544351118196810> ${newGuild.systemChannel || 'None'}`);
      }

      if (oldGuild.rulesChannelId !== newGuild.rulesChannelId) {
        changes.push(`**Rules Channel:** ${oldGuild.rulesChannel || 'None'} <:arrow:1555544351118196810> ${newGuild.rulesChannel || 'None'}`);
      }

      if (oldGuild.publicUpdatesChannelId !== newGuild.publicUpdatesChannelId) {
        changes.push(`**Updates Channel:** ${oldGuild.publicUpdatesChannel || 'None'} <:arrow:1555544351118196810> ${newGuild.publicUpdatesChannel || 'None'}`);
      }

      if (oldGuild.preferredLocale !== newGuild.preferredLocale) {
        changes.push(`**Preferred Locale:** \`${oldGuild.preferredLocale}\` <:arrow:1555544351118196810> \`${newGuild.preferredLocale}\``);
      }

      if (oldGuild.premiumTier !== newGuild.premiumTier) {
        changes.push(`**Boost Tier:** \`Level ${oldGuild.premiumTier}\` <:arrow:1555544351118196810> \`Level ${newGuild.premiumTier}\``);
      }

      if (oldGuild.premiumSubscriptionCount !== newGuild.premiumSubscriptionCount) {
        changes.push(`**Boost Count:** \`${oldGuild.premiumSubscriptionCount}\` <:arrow:1555544351118196810> \`${newGuild.premiumSubscriptionCount}\``);
      }

      if (changes.length === 0) return;

      const embed = new EmbedBuilder()
        .setTitle("> 🏰 Guild Updated")
        .setColor("#A8D8EA")
        .addFields(
          { name: "• Guild", value: `> ${newGuild.name}`, inline: true },
          { name: "• Guild ID", value: `> \`${newGuild.id}\``, inline: true },
          { name: "• Changes", value: changes.join("\n") }
        )
        .setThumbnail(newGuild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Guild Updated" });

      return send_log(newGuild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging guild update:", err);
    }
  });

  client.on("guildMemberAdd", async (member) => {
    try {
      if (member.guild === null) return;

      const audit = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.BotAdd,
        limit: 1
      }).catch(() => null);

      const inviter = audit?.entries.first()?.executor;
      const accountAge = Date.now() - member.user.createdTimestamp;

      const embed = new EmbedBuilder()
        .setTitle("> User Joined")
        .setColor("#6BCF7F")
        .addFields(
          { name: "• Member", value: `> ${member.user}`, inline: true },
          { name: "• Member ID", value: `> \`${member.user.id}\``, inline: true },
          { name: "• Member Tag", value: `> ${member.user.tag}`, inline: true },
          { name: "• Account Created", value: `> <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: "• Account Age", value: `> ${formatDuration(accountAge)}`, inline: true },
          { name: "• Member Count", value: `> ${member.guild.memberCount}`, inline: true }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> User Joined" });

      if (member.user.bot && inviter) {
        embed.addFields({ name: "• Bot Added By", value: `> ${inviter}` });
      }

      // Warn if account is very new (less than 7 days old)
      if (accountAge < 7 * 24 * 60 * 60 * 1000) {
        embed.addFields({ name: "• <:error:1555544434601369620> Warning", value: `> Account is less than 7 days old` });
        embed.setColor("#FFA500");
      }

      return send_log(member.guild.id, embed, "member");
    } catch (err) {
      console.log("Error logging member add:", err);
    }
  });

  client.on("guildMemberRemove", async (member) => {
    try {
      if (member.guild === null) return;

      const audit = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberKick,
        limit: 1
      }).catch(() => null);

      const kickEntry = audit?.entries.first();
      const wasKicked = kickEntry && kickEntry.target?.id === member.user.id && (Date.now() - kickEntry.createdTimestamp) < 5000;

      const roles = member.roles.cache
        .filter(r => r.id !== member.guild.id)
        .map(r => r.name)
        .join(", ") || "None";

      const joinedAt = member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Unknown";
      const memberDuration = member.joinedTimestamp ? formatDuration(Date.now() - member.joinedTimestamp) : "Unknown";

      const embed = new EmbedBuilder()
        .setTitle(`> ${wasKicked ? 'User Kicked' : 'User Left'}`)
        .setColor(wasKicked ? "#FF6B6B" : "#A8A8A8")
        .addFields(
          { name: "• Member", value: `> ${member.user}`, inline: true },
          { name: "• Member ID", value: `> \`${member.user.id}\``, inline: true },
          { name: "• Member Tag", value: `> ${member.user.tag}`, inline: true },
          { name: "• Joined Server", value: `> ${joinedAt}`, inline: true },
          { name: "• Time in Server", value: `> ${memberDuration}`, inline: true },
          { name: "• Member Count", value: `> ${member.guild.memberCount}`, inline: true },
          { name: "• Roles", value: `> ${roles.substring(0, 1000)}${roles.length > 1000 ? '...' : ''}` }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: wasKicked ? "<:error:1555544434601369620> User Kicked" : "<:error:1555544434601369620> User Left" });

      if (wasKicked && kickEntry) {
        embed.addFields({ name: "• Kicked By", value: `> ${kickEntry.executor}` });
        if (kickEntry.reason) {
          embed.addFields({ name: "• Reason", value: `> ${kickEntry.reason}` });
        }
      }

      return send_log(member.guild.id, embed, "member");
    } catch (err) {
      console.log("Error logging member remove:", err);
    }
  });

  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {
      if (oldMember.guild === null) return;

      const changes = [];

      // Nickname change (handled by dedicated event but adding here for completeness)
      if (oldMember.nickname !== newMember.nickname) {
        changes.push(`**Nickname:** \`${oldMember.nickname || 'None'}\` <:arrow:1555544351118196810> \`${newMember.nickname || 'None'}\``);
      }

      // Avatar change
      if (oldMember.avatar !== newMember.avatar) {
        changes.push(`**Server Avatar:** ${newMember.avatar ? 'Updated' : 'Removed'}`);
      }

      // Timeout status
      if (oldMember.communicationDisabledUntil !== newMember.communicationDisabledUntil) {
        if (newMember.communicationDisabledUntil) {
          const duration = formatDuration(newMember.communicationDisabledUntil - Date.now());
          changes.push(`**Timeout:** Applied for ${duration} (until <t:${Math.floor(newMember.communicationDisabledUntil / 1000)}:F>)`);
        } else {
          changes.push(`**Timeout:** Removed`);
        }
      }

      // Pending status (membership screening)
      if (oldMember.pending !== newMember.pending) {
        changes.push(`**Membership Screening:** ${newMember.pending ? 'Pending' : 'Passed'}`);
      }

      // Role changes
      const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
      const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

      if (addedRoles.size > 0) {
        changes.push(`**Roles Added:** ${addedRoles.map(r => r).join(", ")}`);
      }

      if (removedRoles.size > 0) {
        changes.push(`**Roles Removed:** ${removedRoles.map(r => r).join(", ")}`);
      }

      if (changes.length === 0) return;

      const embed = new EmbedBuilder()
        .setTitle("> Member Updated")
        .setColor("#4ECDC4")
        .addFields(
          { name: "• Member", value: `> ${newMember.user}`, inline: true },
          { name: "• Member ID", value: `> \`${newMember.user.id}\``, inline: true },
          { name: "• Changes", value: changes.join("\n") }
        )
        .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Member Updated" });

      return send_log(newMember.guild.id, embed, "member");
    } catch (err) {
      console.log("Error logging member update:", err);
    }
  });

  client.on("guildBanAdd", async ({ guild, user }) => {
    try {
      if (guild === null) return;

      const audit = await guild.fetchAuditLogs({
        type: AuditLogEvent.MemberBanAdd,
        limit: 1
      }).catch(() => null);

      const banEntry = audit?.entries.first();
      const executor = banEntry?.executor;
      const reason = banEntry?.reason;

      const embed = new EmbedBuilder()
        .setTitle("> User Banned")
        .setColor("#FF4757")
        .addFields(
          { name: "• Member", value: `> ${user}`, inline: true },
          { name: "• Member ID", value: `> \`${user.id}\``, inline: true },
          { name: "• Member Tag", value: `> ${user.tag}`, inline: true },
          { name: "• Banned By", value: `> ${executor || 'Unknown'}`, inline: true },
          { name: "• Reason", value: `> ${reason || 'No reason provided'}` }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> User Banned" });

      return send_log(guild.id, embed, "member");
    } catch (err) {
      console.log("Error logging ban add:", err);
    }
  });

  client.on("guildBanRemove", async ({ guild, user }) => {
    try {
      if (guild === null) return;

      const audit = await guild.fetchAuditLogs({
        type: AuditLogEvent.MemberBanRemove,
        limit: 1
      }).catch(() => null);

      const unbanEntry = audit?.entries.first();
      const executor = unbanEntry?.executor;

      const embed = new EmbedBuilder()
        .setTitle("> User Unbanned")
        .setColor("#6BCF7F")
        .addFields(
          { name: "• Member", value: `> ${user}`, inline: true },
          { name: "• Member ID", value: `> \`${user.id}\``, inline: true },
          { name: "• Unbanned By", value: `> ${executor || 'Unknown'}`, inline: true }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> User Unbanned" });

      return send_log(guild.id, embed, "member");
    } catch (err) {
      console.log("Error logging ban remove:", err);
    }
  });

  // ========== ROLE LOGS ==========

  client.on("roleCreate", async (role) => {
    try {
      if (role.guild === null) return;

      const audit = await role.guild.fetchAuditLogs({
        type: AuditLogEvent.RoleCreate,
        limit: 1
      }).catch(() => null);

      const executor = audit?.entries.first()?.executor;

      const permissions = role.permissions.toArray().join(", ") || "None";

      const embed = new EmbedBuilder()
        .setTitle("> Role Created")
        .setColor(role.color || "#99AAB5")
        .addFields(
          { name: "• Role", value: `> ${role}`, inline: true },
          { name: "• Role ID", value: `> \`${role.id}\``, inline: true },
          { name: "• Role Name", value: `> ${role.name}`, inline: true },
          { name: "• Color", value: `> ${role.hexColor}`, inline: true },
          { name: "• Position", value: `> ${role.position}`, inline: true },
          { name: "• Hoisted", value: `> ${role.hoist ? 'Yes' : 'No'}`, inline: true },
          { name: "• Mentionable", value: `> ${role.mentionable ? 'Yes' : 'No'}`, inline: true },
          { name: "• Created By", value: `> ${executor || 'Unknown'}`, inline: true },
          { name: "• Permissions", value: `> ${permissions.substring(0, 1000)}${permissions.length > 1000 ? '...' : ''}` }
        )
        .setThumbnail(role.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Role Created" });

      return send_log(role.guild.id, embed, "role");
    } catch (err) {
      console.log("Error logging role create:", err);
    }
  });

  client.on("roleDelete", async (role) => {
    try {
      if (role.guild === null) return;

      const audit = await role.guild.fetchAuditLogs({
        type: AuditLogEvent.RoleDelete,
        limit: 1
      }).catch(() => null);

      const executor = audit?.entries.first()?.executor;

      const embed = new EmbedBuilder()
        .setTitle("> Role Deleted")
        .setColor("#FF6B6B")
        .addFields(
          { name: "• Role Name", value: `> ${role.name}`, inline: true },
          { name: "• Role ID", value: `> \`${role.id}\``, inline: true },
          { name: "• Color", value: `> ${role.hexColor}`, inline: true },
          { name: "• Position", value: `> ${role.position}`, inline: true },
          { name: "• Members", value: `> ${role.members.size}`, inline: true },
          { name: "• Deleted By", value: `> ${executor || 'Unknown'}`, inline: true }
        )
        .setThumbnail(role.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Role Deleted" });

      return send_log(role.guild.id, embed, "role");
    } catch (err) {
      console.log("Error logging role delete:", err);
    }
  });

  client.on("roleUpdate", async (oldRole, newRole) => {
    try {
      if (oldRole.guild === null) return;

      const changes = [];

      if (oldRole.name !== newRole.name) {
        changes.push(`**Name:** \`${oldRole.name}\` <:arrow:1555544351118196810> \`${newRole.name}\``);
      }

      if (oldRole.color !== newRole.color) {
        changes.push(`**Color:** \`${oldRole.hexColor}\` <:arrow:1555544351118196810> \`${newRole.hexColor}\``);
      }

      if (oldRole.hoist !== newRole.hoist) {
        changes.push(`**Hoisted:** \`${oldRole.hoist ? 'Yes' : 'No'}\` <:arrow:1555544351118196810> \`${newRole.hoist ? 'Yes' : 'No'}\``);
      }

      if (oldRole.mentionable !== newRole.mentionable) {
        changes.push(`**Mentionable:** \`${oldRole.mentionable ? 'Yes' : 'No'}\` <:arrow:1555544351118196810> \`${newRole.mentionable ? 'Yes' : 'No'}\``);
      }

      if (oldRole.position !== newRole.position) {
        changes.push(`**Position:** \`${oldRole.position}\` <:arrow:1555544351118196810> \`${newRole.position}\``);
      }

      if (oldRole.icon !== newRole.icon) {
        changes.push(`**Icon:** ${newRole.icon ? 'Updated' : 'Removed'}`);
      }

      if (oldRole.unicodeEmoji !== newRole.unicodeEmoji) {
        changes.push(`**Emoji:** \`${oldRole.unicodeEmoji || 'None'}\` <:arrow:1555544351118196810> \`${newRole.unicodeEmoji || 'None'}\``);
      }

      // Permission changes
      const addedPerms = newRole.permissions.remove(oldRole.permissions).toArray();
      const removedPerms = oldRole.permissions.remove(newRole.permissions).toArray();

      if (addedPerms.length > 0) {
        changes.push(`**Permissions Added:** \`${addedPerms.join("`, `")}\``);
      }

      if (removedPerms.length > 0) {
        changes.push(`**Permissions Removed:** \`${removedPerms.join("`, `")}\``);
      }

      if (changes.length === 0) return;

      const embed = new EmbedBuilder()
        .setTitle("> Role Updated")
        .setColor(newRole.color || "#4ECDC4")
        .addFields(
          { name: "• Role", value: `> ${newRole}`, inline: true },
          { name: "• Role ID", value: `> \`${newRole.id}\``, inline: true },
          { name: "• Changes", value: changes.join("\n") }
        )
        .setThumbnail(newRole.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Role Updated" });

      return send_log(newRole.guild.id, embed, "role");
    } catch (err) {
      console.log("Error logging role update:", err);
    }
  });

  // ========== VOICE LOGS ==========

  client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
      if (!newState.guild) return;

      const member = newState.member;
      
      // User joined voice
      if (!oldState.channel && newState.channel) {
        const embed = new EmbedBuilder()
          .setTitle("> Voice Channel Joined")
          .setColor("#6BCF7F")
          .addFields(
            { name: "• Member", value: `> ${member.user}`, inline: true },
            { name: "• Channel", value: `> ${newState.channel}`, inline: true },
            { name: "• Self Muted", value: `> ${newState.selfMute ? 'Yes' : 'No'}`, inline: true },
            { name: "• Self Deafened", value: `> ${newState.selfDeaf ? 'Yes' : 'No'}`, inline: true },
            { name: "• Server Muted", value: `> ${newState.serverMute ? 'Yes' : 'No'}`, inline: true },
            { name: "• Server Deafened", value: `> ${newState.serverDeaf ? 'Yes' : 'No'}`, inline: true }
          )
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
          .setFooter({ text: "<:error:1555544434601369620> Voice Joined" });

        return send_log(newState.guild.id, embed, "voice");
      }

      // User left voice
      if (oldState.channel && !newState.channel) {
        const embed = new EmbedBuilder()
          .setTitle("> Voice Channel Left")
          .setColor("#FF6B6B")
          .addFields(
            { name: "• Member", value: `> ${member.user}`, inline: true },
            { name: "• Channel", value: `> ${oldState.channel}`, inline: true }
          )
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
          .setFooter({ text: "<:error:1555544434601369620> Voice Left" });

        return send_log(newState.guild.id, embed, "voice");
      }

      // User switched channels
      if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        const embed = new EmbedBuilder()
          .setTitle("> Voice Channel Switched")
          .setColor("#4ECDC4")
          .addFields(
            { name: "• Member", value: `> ${member.user}`, inline: true },
            { name: "• From", value: `> ${oldState.channel}`, inline: true },
            { name: "• To", value: `> ${newState.channel}`, inline: true }
          )
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
          .setFooter({ text: "<:error:1555544434601369620> Voice Switch" });

        return send_log(newState.guild.id, embed, "voice");
      }

      // Voice state changes (mute, deafen, etc.)
      const changes = [];

      if (oldState.selfMute !== newState.selfMute) {
        changes.push(`**Self Mute:** ${newState.selfMute ? '<:LEred:1555544262123323422> Muted' : '<:LEgreen:1555544256356159600> Unmuted'}`);
      }

      if (oldState.selfDeaf !== newState.selfDeaf) {
        changes.push(`**Self Deafen:** ${newState.selfDeaf ? '<:LEred:1555544262123323422> Deafened' : '<:LEgreen:1555544256356159600> Undeafened'}`);
      }

      if (oldState.serverMute !== newState.serverMute) {
        changes.push(`**Server Mute:** ${newState.serverMute ? '<:LEred:1555544262123323422> Muted' : '<:LEgreen:1555544256356159600> Unmuted'}`);
      }

      if (oldState.serverDeaf !== newState.serverDeaf) {
        changes.push(`**Server Deafen:** ${newState.serverDeaf ? '<:LEred:1555544262123323422> Deafened' : '<:LEgreen:1555544256356159600> Undeafened'}`);
      }

      if (oldState.streaming !== newState.streaming) {
        changes.push(`**Streaming:** ${newState.streaming ? '<:LEgreen:1555544256356159600> Started' : '<:LEred:1555544262123323422> Stopped'}`);
      }

      if (oldState.selfVideo !== newState.selfVideo) {
        changes.push(`**Video:** ${newState.selfVideo ? '<:LEgreen:1555544256356159600> Started' : '<:LEred:1555544262123323422> Stopped'}`);
      }

      if (changes.length === 0) return;

      const embed = new EmbedBuilder()
        .setTitle("> Voice State Updated")
        .setColor("#A8D8EA")
        .addFields(
          { name: "• Member", value: `> ${member.user}`, inline: true },
          { name: "• Channel", value: `> ${newState.channel}`, inline: true },
          { name: "• Changes", value: changes.join("\n") }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Voice State Updated" });

      return send_log(newState.guild.id, embed, "voice");
    } catch (err) {
      console.log("Error logging voice state update:", err);
    }
  });

  // ========== EMOJI & STICKER LOGS ==========

  client.on("emojiCreate", async (emoji) => {
    try {
      if (emoji.guild === null) return;

      const audit = await emoji.guild.fetchAuditLogs({
        type: AuditLogEvent.EmojiCreate,
        limit: 1
      }).catch(() => null);

      const executor = audit?.entries.first()?.executor;

      const embed = new EmbedBuilder()
        .setTitle("> Emoji Created")
        .setColor("#6BCF7F")
        .addFields(
          { name: "• Emoji", value: `> ${emoji}`, inline: true },
          { name: "• Emoji Name", value: `> \`${emoji.name}\``, inline: true },
          { name: "• Emoji ID", value: `> \`${emoji.id}\``, inline: true },
          { name: "• Animated", value: `> ${emoji.animated ? 'Yes' : 'No'}`, inline: true },
          { name: "• Created By", value: `> ${executor || 'Unknown'}`, inline: true },
          { name: "• URL", value: `> [Link](${emoji.url})` }
        )
        .setThumbnail(emoji.url)
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Emoji Created" });

      return send_log(emoji.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging emoji create:", err);
    }
  });

  client.on("emojiDelete", async (emoji) => {
    try {
      if (emoji.guild === null) return;

      const audit = await emoji.guild.fetchAuditLogs({
        type: AuditLogEvent.EmojiDelete,
        limit: 1
      }).catch(() => null);

      const executor = audit?.entries.first()?.executor;

      const embed = new EmbedBuilder()
        .setTitle("> Emoji Deleted")
        .setColor("#FF6B6B")
        .addFields(
          { name: "• Emoji Name", value: `> \`${emoji.name}\``, inline: true },
          { name: "• Emoji ID", value: `> \`${emoji.id}\``, inline: true },
          { name: "• Animated", value: `> ${emoji.animated ? 'Yes' : 'No'}`, inline: true },
          { name: "• Deleted By", value: `> ${executor || 'Unknown'}`, inline: true }
        )
        .setThumbnail(emoji.url)
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Emoji Deleted" });

      return send_log(emoji.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging emoji delete:", err);
    }
  });

  client.on("emojiUpdate", (oldEmoji, newEmoji) => {
    try {
      if (oldEmoji.guild === null) return;

      const changes = [];

      if (oldEmoji.name !== newEmoji.name) {
        changes.push(`**Name:** \`${oldEmoji.name}\` <:arrow:1555544351118196810> \`${newEmoji.name}\``);
      }

      if (changes.length === 0) return;

      const embed = new EmbedBuilder()
        .setTitle("> Emoji Updated")
        .setColor("#4ECDC4")
        .addFields(
          { name: "• Emoji", value: `> ${newEmoji}`, inline: true },
          { name: "• Emoji ID", value: `> \`${newEmoji.id}\``, inline: true },
          { name: "• Changes", value: changes.join("\n") }
        )
        .setThumbnail(newEmoji.url)
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Emoji Updated" });

      return send_log(newEmoji.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging emoji update:", err);
    }
  });

  client.on("stickerCreate", async (sticker) => {
    try {
      if (sticker.guild === null) return;

      const audit = await sticker.guild.fetchAuditLogs({
        type: AuditLogEvent.StickerCreate,
        limit: 1
      }).catch(() => null);

      const executor = audit?.entries.first()?.executor;

      const embed = new EmbedBuilder()
        .setTitle("> Sticker Created")
        .setColor("#6BCF7F")
        .addFields(
          { name: "• Sticker Name", value: `> ${sticker.name}`, inline: true },
          { name: "• Sticker ID", value: `> \`${sticker.id}\``, inline: true },
          { name: "• Description", value: `> ${sticker.description || 'None'}`, inline: false },
          { name: "• Tags", value: `> ${sticker.tags || 'None'}`, inline: true },
          { name: "• Created By", value: `> ${executor || 'Unknown'}`, inline: true }
        )
        .setThumbnail(sticker.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Sticker Created" });

      return send_log(sticker.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging sticker create:", err);
    }
  });

  client.on("stickerDelete", async (sticker) => {
    try {
      if (sticker.guild === null) return;

      const audit = await sticker.guild.fetchAuditLogs({
        type: AuditLogEvent.StickerDelete,
        limit: 1
      }).catch(() => null);

      const executor = audit?.entries.first()?.executor;

      const embed = new EmbedBuilder()
        .setTitle("> Sticker Deleted")
        .setColor("#FF6B6B")
        .addFields(
          { name: "• Sticker Name", value: `> ${sticker.name}`, inline: true },
          { name: "• Sticker ID", value: `> \`${sticker.id}\``, inline: true },
          { name: "• Deleted By", value: `> ${executor || 'Unknown'}`, inline: true }
        )
        .setThumbnail(sticker.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Sticker Deleted" });

      return send_log(sticker.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging sticker delete:", err);
    }
  });

  client.on("stickerUpdate", (oldSticker, newSticker) => {
    try {
      if (oldSticker.guild === null) return;

      const changes = [];

      if (oldSticker.name !== newSticker.name) {
        changes.push(`**Name:** \`${oldSticker.name}\` <:arrow:1555544351118196810> \`${newSticker.name}\``);
      }

      if (oldSticker.description !== newSticker.description) {
        changes.push(`**Description:** \`${oldSticker.description || 'None'}\` <:arrow:1555544351118196810> \`${newSticker.description || 'None'}\``);
      }

      if (oldSticker.tags !== newSticker.tags) {
        changes.push(`**Tags:** \`${oldSticker.tags || 'None'}\` <:arrow:1555544351118196810> \`${newSticker.tags || 'None'}\``);
      }

      if (changes.length === 0) return;

      const embed = new EmbedBuilder()
        .setTitle("> Sticker Updated")
        .setColor("#4ECDC4")
        .addFields(
          { name: "• Sticker", value: `> ${newSticker.name}`, inline: true },
          { name: "• Sticker ID", value: `> \`${newSticker.id}\``, inline: true },
          { name: "• Changes", value: changes.join("\n") }
        )
        .setThumbnail(newSticker.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Sticker Updated" });

      return send_log(newSticker.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging sticker update:", err);
    }
  });

  // ========== INVITE LOGS ==========

  client.on("inviteCreate", (invite) => {
    try {
      if (invite.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Invite Created")
        .setColor("#6BCF7F")
        .addFields(
          { name: "• Invite Code", value: `> \`${invite.code}\``, inline: true },
          { name: "• Inviter", value: `> ${invite.inviter || "Unknown"}`, inline: true },
          { name: "• Channel", value: `> ${invite.channel}`, inline: true },
          { name: "• Max Uses", value: `> ${invite.maxUses || 'Unlimited'}`, inline: true },
          { name: "• Max Age", value: `> ${invite.maxAge ? formatDuration(invite.maxAge * 1000) : 'Never'}`, inline: true },
          { name: "• Temporary", value: `> ${invite.temporary ? 'Yes' : 'No'}`, inline: true },
          { name: "• URL", value: `> https://discord.gg/${invite.code}` }
        )
        .setThumbnail(invite.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Invite Created" });

      return send_log(invite.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging invite create:", err);
    }
  });

  client.on("inviteDelete", (invite) => {
    try {
      if (invite.guild === null) return;

      const embed = new EmbedBuilder()
        .setTitle("> Invite Deleted")
        .setColor("#FF6B6B")
        .addFields(
          { name: "• Invite Code", value: `> \`${invite.code}\``, inline: true },
          { name: "• Channel", value: `> ${invite.channel}`, inline: true },
          { name: "• Uses", value: `> ${invite.uses || 0}`, inline: true }
        )
        .setThumbnail(invite.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Invite Deleted" });

      return send_log(invite.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging invite delete:", err);
    }
  });

  // ========== WEBHOOK LOGS ==========

  client.on("webhookUpdate", async (channel) => {
    try {
      if (!channel.guild) return;

      const newWebhooks = await channel.fetchWebhooks().catch(() => new Map());
      const oldWebhooks = client.webhookCache?.get(channel.id) || new Map();

      let changes = [];

      newWebhooks.forEach((wh) => {
        const old = oldWebhooks.get(wh.id);
        if (!old) {
          changes.push(`<:n_add:1555544335036973106> Webhook created: **${wh.name}** (ID: \`${wh.id}\`)`);
        } else if (old.name !== wh.name || old.avatar !== wh.avatar || old.channelId !== wh.channelId) {
          const updates = [];
          if (old.name !== wh.name) updates.push(`Name: \`${old.name}\` <:arrow:1555544351118196810> \`${wh.name}\``);
          if (old.avatar !== wh.avatar) updates.push('Avatar updated');
          if (old.channelId !== wh.channelId) updates.push(`Channel changed`);
          changes.push(`<:files:1555544445565407352> Webhook updated: **${wh.name}**\n   ${updates.join(', ')}`);
        }
      });

      oldWebhooks.forEach((wh, id) => {
        if (!newWebhooks.has(id)) {
          changes.push(`<:1430986239036625017:1555544229143519304> Webhook deleted: **${wh.name}** (ID: \`${wh.id}\`)`);
        }
      });

      client.webhookCache = client.webhookCache || new Map();
      client.webhookCache.set(channel.id, newWebhooks);

      if (changes.length === 0) return;

      const embed = new EmbedBuilder()
        .setTitle("> Webhook Updated")
        .setColor("#A8D8EA")
        .addFields(
          { name: "• Channel", value: `> ${channel}`, inline: true },
          { name: "• Total Webhooks", value: `> ${newWebhooks.size}`, inline: true },
          { name: "• Changes", value: changes.join("\n") }
        )
        .setThumbnail(channel.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> Webhook Updated" });

      return send_log(channel.guild.id, embed, "guild");
    } catch (err) {
      console.log("Error logging webhook update:", err);
    }
  });

  // ========== AUTO MODERATION LOGS ==========

  client.on("autoModerationActionExecution", async (execution) => {
    try {
      if (!execution.guild) return;

      const embed = new EmbedBuilder()
        .setTitle("> AutoMod Action Executed")
        .setColor("#FF9500")
        .addFields(
          { name: "• User", value: `> ${execution.user}`, inline: true },
          { name: "• Rule", value: `> ${execution.ruleTriggerType}`, inline: true },
          { name: "• Action", value: `> ${execution.action.type}`, inline: true },
          { name: "• Channel", value: `> ${execution.channel || 'N/A'}`, inline: true },
          { name: "• Matched Keyword", value: `> \`${execution.matchedKeyword || 'N/A'}\``, inline: true },
          { name: "• Content", value: `> ${execution.content?.substring(0, 100) || 'N/A'}${execution.content?.length > 100 ? '...' : ''}` }
        )
        .setThumbnail(execution.user.displayAvatarURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> AutoMod Action" });

      if (execution.action.metadata?.durationSeconds) {
        embed.addFields({
          name: "• Timeout Duration",
          value: `> ${formatDuration(execution.action.metadata.durationSeconds * 1000)}`
        });
      }

      return send_log(execution.guild.id, embed, "moderation");
    } catch (err) {
      console.log("Error logging automod action:", err);
    }
  });

  client.on("autoModerationRuleCreate", async (rule) => {
    try {
      if (!rule.guild) return;

      const embed = new EmbedBuilder()
        .setTitle("> AutoMod Rule Created")
        .setColor("#6BCF7F")
        .addFields(
          { name: "• Rule Name", value: `> ${rule.name}`, inline: true },
          { name: "• Rule ID", value: `> \`${rule.id}\``, inline: true },
          { name: "• Trigger Type", value: `> ${rule.triggerType}`, inline: true },
          { name: "• Enabled", value: `> ${rule.enabled ? 'Yes' : 'No'}`, inline: true },
          { name: "• Created By", value: `> ${rule.creator}`, inline: true },
          { name: "• Actions", value: `> ${rule.actions.map(a => a.type).join(", ")}` }
        )
        .setThumbnail(rule.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> AutoMod Rule Created" });

      return send_log(rule.guild.id, embed, "moderation");
    } catch (err) {
      console.log("Error logging automod rule create:", err);
    }
  });

  client.on("autoModerationRuleDelete", async (rule) => {
    try {
      if (!rule.guild) return;

      const embed = new EmbedBuilder()
        .setTitle("> AutoMod Rule Deleted")
        .setColor("#FF6B6B")
        .addFields(
          { name: "• Rule Name", value: `> ${rule.name}`, inline: true },
          { name: "• Rule ID", value: `> \`${rule.id}\``, inline: true },
          { name: "• Trigger Type", value: `> ${rule.triggerType}`, inline: true }
        )
        .setThumbnail(rule.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> AutoMod Rule Deleted" });

      return send_log(rule.guild.id, embed, "moderation");
    } catch (err) {
      console.log("Error logging automod rule delete:", err);
    }
  });

  client.on("autoModerationRuleUpdate", async (oldRule, newRule) => {
    try {
      if (!newRule.guild) return;

      const changes = [];

      if (oldRule.name !== newRule.name) {
        changes.push(`**Name:** \`${oldRule.name}\` <:arrow:1555544351118196810> \`${newRule.name}\``);
      }

      if (oldRule.enabled !== newRule.enabled) {
        changes.push(`**Enabled:** \`${oldRule.enabled ? 'Yes' : 'No'}\` <:arrow:1555544351118196810> \`${newRule.enabled ? 'Yes' : 'No'}\``);
      }

      if (oldRule.triggerType !== newRule.triggerType) {
        changes.push(`**Trigger Type:** \`${oldRule.triggerType}\` <:arrow:1555544351118196810> \`${newRule.triggerType}\``);
      }

      if (JSON.stringify(oldRule.actions) !== JSON.stringify(newRule.actions)) {
        changes.push(`**Actions:** Updated`);
      }

      if (changes.length === 0) return;

      const embed = new EmbedBuilder()
        .setTitle("> AutoMod Rule Updated")
        .setColor("#4ECDC4")
        .addFields(
          { name: "• Rule Name", value: `> ${newRule.name}`, inline: true },
          { name: "• Rule ID", value: `> \`${newRule.id}\``, inline: true },
          { name: "• Changes", value: changes.join("\n") }
        )
        .setThumbnail(newRule.guild.iconURL({ dynamic: true }))
        .setAuthor({ name: "<:error:1555544434601369620> Logging System" })
        .setFooter({ text: "<:error:1555544434601369620> AutoMod Rule Updated" });

      return send_log(newRule.guild.id, embed, "moderation");
    } catch (err) {
      console.log("Error logging automod rule update:", err);
    }
  });

  // ========== CLEANUP WHEN BOT LEAVES ==========

  client.on("guildDelete", async (guild) => {
    try {
      console.log(`Bot removed from guild: ${guild.name} (${guild.id})`);
      
      // Disable logging for this guild
      disabledGuilds.add(guild.id);

      // Clear any pending log queues for this guild's channels
      guild.channels.cache.forEach(channel => {
        if (logQueues.has(channel.id)) {
          logQueues.delete(channel.id);
        }
      });

      // Clear webhook cache
      if (client.webhookCache) {
        guild.channels.cache.forEach(channel => {
          client.webhookCache.delete(channel.id);
        });
      }

      // Clear error notifications
      const keysToDelete = [];
      logErrorNotified.forEach(key => {
        if (key.startsWith(`${guild.id}:`)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => logErrorNotified.delete(key));

      // Optionally remove from database
      await logSchema.deleteOne({ Guild: guild.id }).catch(err => {
        console.log("Error removing guild from log schema:", err);
      });

      console.log(`Cleaned up logging data for guild ${guild.id}`);
    } catch (err) {
      console.log("Error in guildDelete cleanup:", err);
    }
  });

  // ========== RE-ENABLE LOGGING WHEN BOT REJOINS ==========

  client.on("guildCreate", async (guild) => {
    try {
      // Remove from disabled list if it was there
      if (disabledGuilds.has(guild.id)) {
        disabledGuilds.delete(guild.id);
        console.log(`Re-enabled logging for guild: ${guild.name} (${guild.id})`);
      }
    } catch (err) {
      console.log("Error in guildCreate:", err);
    }
  });
}

module.exports = { handleLogs };