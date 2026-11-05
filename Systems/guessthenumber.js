'use strict';
const { Events } = require('discord.js');
const Schema = require('../Schemas/guess');

// Per-guild cooldown tracker: Map<guildId, Map<userId, timestamp>>
const cooldowns = new Map();

function interpolate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

module.exports = (client) => {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const data = await Schema.findOne({ guildId: message.guild.id, channelId: message.channel.id }).catch(() => null);
    if (!data || !data.enabled) return;

    const content = message.content.trim();
    const guess   = parseInt(content, 10);
    if (isNaN(guess) || String(guess) !== content) return; // non-number message — ignore silently

    const userId  = message.author.id;
    const guildId = message.guild.id;

    // ── Repeat-guess guard ──────────────────────────────────────────────────
    if (!data.allowRepeats && data.lastWinnerId === userId && data.totalGames > 0) {
      // Only block consecutive guesser within the same round (track via lastGuesserId)
      if (data._lastGuesserId === userId) {
        const msg = await message.reply(interpolate(data.msgRepeat, {})).catch(() => null);
        if (data.deleteWrong) {
          setTimeout(() => message.delete().catch(() => {}), 3000);
          setTimeout(() => msg?.delete().catch(() => {}), 3000);
        }
        return;
      }
    }

    // ── Cooldown ────────────────────────────────────────────────────────────
    if (data.cooldownSeconds > 0) {
      if (!cooldowns.has(guildId)) cooldowns.set(guildId, new Map());
      const gCooldowns = cooldowns.get(guildId);
      const lastGuess  = gCooldowns.get(userId) || 0;
      const elapsed    = (Date.now() - lastGuess) / 1000;
      const remaining  = Math.ceil(data.cooldownSeconds - elapsed);
      if (elapsed < data.cooldownSeconds) {
        const msg = await message.reply(interpolate(data.msgCooldown, { seconds: remaining })).catch(() => null);
        if (data.deleteWrong) {
          setTimeout(() => message.delete().catch(() => {}), 3000);
          setTimeout(() => msg?.delete().catch(() => {}), 3000);
        }
        return;
      }
      gCooldowns.set(userId, Date.now());
    }

    // ── Count tries ─────────────────────────────────────────────────────────
    data._tries = (data._tries || 0) + 1;

    // ── Correct guess ───────────────────────────────────────────────────────
    if (guess === data.number) {
      const tries = data._tries;
      try { await message.react('<a:tickyy:1567797045253644368>'); } catch {}

      await message.reply(
        interpolate(data.msgWin, { user: `<@${userId}>`, number: data.number, tries })
      ).catch(() => {});

      // Win role
      if (data.winRoleId) {
        const member = message.member;
        if (member) {
          await member.roles.add(data.winRoleId).catch(() => {});
          if (data.winRoleDuration > 0) {
            setTimeout(async () => {
              const m = await message.guild.members.fetch(userId).catch(() => null);
              if (m) await m.roles.remove(data.winRoleId).catch(() => {});
            }, data.winRoleDuration * 3_600_000);
          }
        }
      }

      // Update stats
      data.totalGames += 1;
      data.lastWinnerId = userId;
      data.lastWinAt    = new Date();
      data._tries       = 0;

      if (data.autoReset) {
        // Pick a new random number in range
        const min = data.minNumber || 1;
        const max = data.maxNumber || 1000;
        data.number = Math.floor(Math.random() * (max - min + 1)) + min;
        await data.save();
        await message.channel.send(`<:n_add:1567796983408754731> New number set! Guess between **${min}** and **${max}**.`).catch(() => {});
      } else {
        data.enabled = false;
        await data.save();
        await message.channel.send(`Game over! Use the dashboard to start a new round.`).catch(() => {});
      }
      return;
    }

    // ── Wrong guess ─────────────────────────────────────────────────────────
    try { await message.react('<:crossy:1567796959648030831>'); } catch {}

    if (data.hintsEnabled) {
      const hintMsg = guess > data.number
        ? interpolate(data.msgTooHigh, { guess })
        : interpolate(data.msgTooLow,  { guess });
      const reply = await message.reply(hintMsg).catch(() => null);
      if (data.deleteWrong) {
        setTimeout(() => message.delete().catch(() => {}), 4000);
        setTimeout(() => reply?.delete().catch(() => {}), 4000);
      }
    } else if (data.deleteWrong) {
      setTimeout(() => message.delete().catch(() => {}), 2000);
    }

    data._lastGuesserId = userId;
    // No need to save on every wrong guess — _lastGuesserId is transient
  });
};
