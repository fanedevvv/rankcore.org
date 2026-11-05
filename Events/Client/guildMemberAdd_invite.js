const InviteStats = require('../../Schemas/inviteSchema');
const GuildConfig = require('../../Schemas/guildInviteConfig');
const inviteCache = require('../../Utils/inviteCache');
const InviteJoin = require('../../Schemas/inviteJoinRecord');
const { EmbedBuilder, WebhookClient } = require('discord.js');
const { decryptWebhook } = require('../../Utils/webhookCrypto');
const WelcomeMessage = require('../../Schemas/welcomeMessageSchema');
const joinInvites = require('../../Utils/joinInvites');

/** Works out which invite a member used by diffing invite use counts against the cache. */
async function resolveUsedInvite(member, allowVanity) {
  const guild = member.guild;
  const guildId = guild.id;
  // ── Resolve used invite ──────────────────────────────────────────────
  const known = inviteCache.has(guildId); // no snapshot yet → can't tell which invite was used
  const before = inviteCache.get(guildId) || new Map();
  const invites = await guild.invites.fetch().catch(() => null);
  const after = new Map();
  if (invites) {
    invites.forEach(inv => after.set(inv.code, {
      code: inv.code,
      uses: inv.uses ?? 0,
      inviterId: inv.inviter?.id ?? null
    }));
  }

  let usedInvite = null;
  for (const [code, data] of after.entries()) {
    const b = before.get(code);
    if ((!b && data.uses > 0 && known) || (b && data.uses > b.uses)) {
      usedInvite = data;
      break;
    }
  }

  // Check vanity
  if (!usedInvite && allowVanity) {
    try {
      const vanity = await guild.fetchVanityData();
      if (vanity?.uses > (inviteCache.get(`${guildId}:vanity`) ?? 0)) {
        usedInvite = { code: vanity.code, inviterId: null, isVanity: true };
        inviteCache.set(`${guildId}:vanity`, vanity.uses);
      }
    } catch {}
  }

  if (!usedInvite) usedInvite = { code: null, inviterId: null };
  inviteCache.set(guildId, after);

  return usedInvite;
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    try {
      const guildId = member.guild.id;
      const guildConfig = await GuildConfig.findOne({ guildId }).select('+webhookWelcome.webhookToken');
      if (!guildConfig?.enabled) {
        // Invite tracking is off — still work out the inviter if the welcome message shows it
        const welcome = await WelcomeMessage.findOne({ guildId }).select('showInvites').lean();
        if (!welcome?.showInvites) return;
        if ((guildConfig?.ignoreBots ?? true) && member.user.bot) return joinInvites.publish(guildId, member.id, null);
        const used = await resolveUsedInvite(member, true);
        // Count the join so {invites}/{fake} stay right (leaves are counted by guildMemberRemove_invite)
        const fakeDays = guildConfig?.fakeAccountAgeDays ?? 7;
        const joinIsFake = fakeDays > 0 && (Date.now() - member.user.createdTimestamp) / 86400000 < fakeDays;
        const stats = used.inviterId
          ? await InviteStats.findOneAndUpdate(
              { guildId, userId: used.inviterId },
              { $inc: { invites: joinIsFake ? 0 : 1, regular: joinIsFake ? 0 : 1, fake: joinIsFake ? 1 : 0 }, $set: { lastUpdated: Date.now() } },
              { upsert: true, new: true }
            ).lean()
          : null;
        const inviterUser = used.inviterId ? await client.users.fetch(used.inviterId).catch(() => null) : null;
        joinInvites.publish(guildId, member.id, {
          inviterId: used.inviterId, inviterName: inviterUser?.username ?? null,
          code: used.code, isVanity: !!used.isVanity,
          ...joinInvites.statsInfo(stats),
          fakeAccount: joinIsFake,
        });
        await InviteJoin.findOneAndUpdate(
          { guildId, joinedId: member.id },
          { guildId, joinedId: member.id, inviterId: used.inviterId ?? null, code: used.code ?? null, joinedAt: Date.now() },
          { upsert: true }
        );
        return;
      }
      if (guildConfig.ignoreBots && member.user.bot) return joinInvites.publish(guildId, member.id, null);

      let usedInvite = await resolveUsedInvite(member, guildConfig.allowVanity);

      // ── Invite filter ────────────────────────────────────────────────────
      if (usedInvite.code && guildConfig.inviteFilter?.mode !== 'all') {
        const codes = guildConfig.inviteFilter?.codes || [];
        const isListed = codes.includes(usedInvite.code);
        if (guildConfig.inviteFilter.mode === 'whitelist' && !isListed) {
          usedInvite = { code: usedInvite.code, inviterId: null };
        }
        if (guildConfig.inviteFilter.mode === 'blacklist' && isListed) {
          usedInvite = { code: usedInvite.code, inviterId: null };
        }
      }

      // ── Fake detection ───────────────────────────────────────────────────
      const fakeThresholdDays = guildConfig.fakeAccountAgeDays ?? 7;
      const accountAgeDays = (Date.now() - member.user.createdTimestamp) / 86400000;
      const isFake = fakeThresholdDays > 0 && accountAgeDays < fakeThresholdDays;

      // ── Update inviter stats ─────────────────────────────────────────────
      const inviterId = usedInvite.inviterId;
      let inviterStats = null;
      if (inviterId) {
        inviterStats = await InviteStats.findOneAndUpdate(
          { guildId, userId: inviterId },
          {
            $inc: { invites: isFake ? 0 : 1, regular: isFake ? 0 : 1, fake: isFake ? 1 : 0 },
            $set: { lastUpdated: Date.now() }
          },
          { upsert: true, new: true }
        );

        // ── Reward roles ─────────────────────────────────────────────────
        if (guildConfig.rewardRoles?.length && !isFake) {
          const totalInvites = inviterStats.invites + (inviterStats.bonus || 0);
          const inviterMember = await member.guild.members.fetch(inviterId).catch(() => null);
          if (inviterMember) {
            for (const reward of guildConfig.rewardRoles) {
              if (totalInvites >= reward.invites) {
                inviterMember.roles.add(reward.roleId).catch(() => null);
              }
            }
          }
        }

        // ── Invite milestones ────────────────────────────────────────────
        if (guildConfig.milestonesEnabled && guildConfig.inviteMilestones?.length && !isFake) {
          const total = inviterStats.invites + (inviterStats.bonus || 0);
          const prevTotal = total - 1;
          const milestoneChannelId = guildConfig.milestoneChannelId || guildConfig.welcomeChannelId;
          const mCh = milestoneChannelId ? member.guild.channels.cache.get(milestoneChannelId) : null;
          if (mCh) {
            for (const ms of guildConfig.inviteMilestones) {
              if (prevTotal < ms.invites && total >= ms.invites) {
                const inviterUser = await client.users.fetch(inviterId).catch(() => null);
                const msg = ms.message
                  .replace(/{inviter}/g, inviterUser ? `<@${inviterId}>` : 'Unknown')
                  .replace(/{invites}/g, String(ms.invites));
                mCh.send({ content: msg }).catch(() => null);
              }
            }
          }
        }
      }

      // ── Store join record ─────────────────────────────────────────────────
      await InviteJoin.findOneAndUpdate(
        { guildId, joinedId: member.id },
        { guildId, joinedId: member.id, inviterId: inviterId ?? null, code: usedInvite.code ?? null, joinedAt: Date.now() },
        { upsert: true }
      );

      // Hand the result to the welcome message (it shows "Invited by …" when enabled)
      const inviterUser = inviterId ? await client.users.fetch(inviterId).catch(() => null) : null;
      joinInvites.publish(guildId, member.id, {
        inviterId, inviterName: inviterUser?.username ?? null,
        code: usedInvite.code, isVanity: !!usedInvite.isVanity,
        ...joinInvites.statsInfo(inviterStats),
        fakeAccount: isFake,
      });

      // ── Auto roles ────────────────────────────────────────────────────────
      if (guildConfig.autoRolesEnabled && guildConfig.autoRoles?.length) {
        for (const roleId of guildConfig.autoRoles) {
          member.roles.add(roleId).catch(() => null);
        }
      }

      // ── Member count milestones ───────────────────────────────────────────
      if (guildConfig.milestonesEnabled && guildConfig.milestones?.length) {
        const memberCount = member.guild.memberCount;
        const milestoneChannelId = guildConfig.milestoneChannelId || guildConfig.welcomeChannelId;
        const mCh = milestoneChannelId ? member.guild.channels.cache.get(milestoneChannelId) : null;
        if (mCh) {
          for (const ms of guildConfig.milestones) {
            if (memberCount === ms.count) {
              const msg = ms.message.replace(/{count}/g, String(ms.count));
              mCh.send({ content: msg }).catch(() => null);
            }
          }
        }
      }

      // ── Helpers ───────────────────────────────────────────────────────────
      const getInviterTag = async () => inviterId
        ? client.users.fetch(inviterId).then(u => u.tag).catch(() => 'Unknown')
        : 'Unknown';
      const getInviteCount = () => inviterStats ? inviterStats.invites + (inviterStats.bonus ?? 0) : 0;
      const inviteURL = usedInvite.code ? `discord.gg/${usedInvite.code}` : 'Unknown';

      const applyVars = (str, inviterTag) => str
        .replaceAll('{user}', `<@${member.id}>`)
        .replaceAll('{username}', member.user.username)
        .replaceAll('{inviter}', inviterTag)
        .replaceAll('{inviterId}', inviterId ?? 'Unknown')
        .replaceAll('{invites}', String(getInviteCount()))
        .replaceAll('{fake}', isFake ? 'yes' : 'no')
        .replaceAll('{url}', inviteURL)
        .replaceAll('{memberCount}', String(member.guild.memberCount))
        .replaceAll('{server}', member.guild.name)
        .replace('{code}', usedInvite.code ?? 'Unknown');

      // ── DM Welcome ────────────────────────────────────────────────────────
      if (guildConfig.dmWelcome?.enabled && guildConfig.dmWelcome?.message) {
        const inviterTag = await getInviterTag();
        const dmContent = applyVars(guildConfig.dmWelcome.message, inviterTag);
        member.user.send({ content: dmContent }).catch(() => null);
      }

      // ── Welcome Channel ───────────────────────────────────────────────────
      if (guildConfig.welcomeChannelId) {
        const ch = member.guild.channels.cache.get(guildConfig.welcomeChannelId);
        if (ch) {
          const inviterTag = await getInviterTag();

          // Embed mode
          if (guildConfig.embed?.enabled) {
            const embedCfg = guildConfig.embed;
            const embed = new EmbedBuilder()
              .setColor(embedCfg.color || '#6C53FF')
              .setTitle(applyVars(embedCfg.title || 'Welcome!', inviterTag))
              .setDescription(applyVars(embedCfg.description || '', inviterTag));

            if (embedCfg.footer) embed.setFooter({ text: applyVars(embedCfg.footer, inviterTag) });
            if (embedCfg.thumbnail === 'avatar') embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
            if (embedCfg.thumbnail === 'server') embed.setThumbnail(member.guild.iconURL({ dynamic: true }));
            if (embedCfg.image) embed.setImage(embedCfg.image);
            if (embedCfg.showStats && inviterStats) {
              embed.addFields(
                { name: 'Regular', value: String(inviterStats.regular), inline: true },
                { name: 'Fake', value: String(inviterStats.fake), inline: true },
                { name: 'Left', value: String(inviterStats.left), inline: true }
              );
            }

            // Webhook send
            if (guildConfig.webhookWelcome?.enabled && guildConfig.webhookWelcome?.webhookId && guildConfig.webhookWelcome?.webhookToken) {
              const wh = new WebhookClient({ id: guildConfig.webhookWelcome.webhookId, token: decryptWebhook(guildConfig.webhookWelcome.webhookToken) });
              wh.send({
                embeds: [embed],
                username: applyVars(guildConfig.webhookWelcome.username || 'Welcome', inviterTag),
                avatarURL: guildConfig.webhookWelcome.avatarUrl || undefined
              }).catch(() => null);
            } else {
              ch.send({ embeds: [embed] }).catch(() => null);
            }
          } else {
            // Plain message
            const content = applyVars(guildConfig.welcomeMessage || 'Welcome {user}!', inviterTag);
            ch.send({ content }).catch(() => null);
          }
        }
      }

      // ── Log Channel ───────────────────────────────────────────────────────
      if (guildConfig.logChannelId) {
        const log = member.guild.channels.cache.get(guildConfig.logChannelId);
        if (log) {
          const inviterTag = await getInviterTag();
          let msg = `<:files:1567796970964394044> **${member.user.tag}** joined — invited by **${inviterTag}** (\`${inviterId ?? 'none'}\`)${isFake ? ' <:error:1567796968758050868> **FAKE**' : ''}`;
          if (guildConfig.verboseLogs) {
            msg += `\n> Code: \`${usedInvite.code ?? 'unknown'}\` | Account age: \`${Math.floor(accountAgeDays)}d\` | Members: \`${member.guild.memberCount}\``;
          }
          log.send({ content: msg }).catch(() => null);

          if (isFake && guildConfig.alertFake) {
            log.send({ content: `<:error:1567796968758050868> Fake account detected: <@${member.id}> (account age: ${Math.floor(accountAgeDays)}d)` }).catch(() => null);
          }
        }
      }

    } catch (err) {
      joinInvites.publish(member.guild.id, member.id, null);
      console.error(`guildMemberAdd invite error [${member.guild.id}] [${member.id}]:`, err.stack || err);
      client?.logs?.error?.('guildMemberAdd invite error', err);
    }
  }
};