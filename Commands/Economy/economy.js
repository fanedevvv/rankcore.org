const {
  SlashCommandBuilder,
  ContainerBuilder, SectionBuilder, TextDisplayBuilder,
  SeparatorBuilder, ThumbnailBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  MessageFlags, PermissionFlagsBits,
} = require("discord.js");
const { Slots } = require("discord-gamecord");
const User     = require("../../Schemas/userAccount");
const Bank     = require("../../Schemas/bankSchema");
const Cooldown = require("../../Schemas/CoolDownDaily");
const cache    = require("../../src/lib/cache");
const { parseEmoji } = require("../../Utils/emojis");

// ─── Redis-backed cooldowns ─────────────────────────────────────────────────
async function checkCD(cmd, userId, ms) {
  const { allowed, remaining, resetMs } = await cache.checkRateLimit(`econ:${cmd}:${userId}`, 1, ms);
  if (!allowed) {
    const mins = Math.ceil(resetMs / 60000);
    return { ok: false, mins: mins || 1 };
  }
  return { ok: true };
}

async function checkDailyCD(userId) {
  const cd = await Cooldown.findOne({ userId });
  if (cd && cd.cooldownExpiration > Date.now()) {
    const rem  = cd.cooldownExpiration - Date.now();
    const h    = Math.floor(rem / 3600000);
    const m    = Math.floor((rem % 3600000) / 60000);
    return { ok: false, left: `**${h}h ${m}m**` };
  }
  return { ok: true };
}

function fmt(n) { return Number(n).toLocaleString(); }

function cooldownContainer(msg) {
  return new ContainerBuilder().setAccentColor(0xED4245)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:n_loading:1555544489194688623> Cooldown\n${msg}`));
}

function errorContainer(msg) {
  return new ContainerBuilder().setAccentColor(0xED4245)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:crossy:1555544390221562048> Error\n${msg}`));
}

// ─── Job & fish tables ─────────────────────────────────────────────────────
const JOBS = [
  { name: "Barista <:eco:1555544429253890050>",         pay: [150, 250], line: "You brewed perfect espressos all morning!" },
  { name: "Freelance Dev <:javascript:1555544478557806602>",   pay: [250, 450], line: "You shipped a client's landing page!" },
  { name: "Pizza Delivery 🍕",  pay: [120, 200], line: "You delivered 12 orders and got great tips!" },
  { name: "Math Tutor <:files:1555544445565407352>",      pay: [200, 350], line: "You helped a struggling student ace their test!" },
  { name: "Street Performer <:n_music:1555544516746940416>",pay: [80,  300], line: "The crowd loved your performance!" },
  { name: "Dog Walker 🐕",      pay: [100, 180], line: "You walked 6 dogs and survived!" },
  { name: "Content Creator 🎥", pay: [50,  500], line: "Your latest video went semi-viral!" },
  { name: "Mechanic <:n_utils:1555544669545431062>",        pay: [200, 380], line: "You fixed an engine and charged accordingly!" },
];

const FISH_TABLE = [
  { name: "🥾 Old Boot",   pay: 0,    rare: false, line: "Nothing but soggy leather..." },
  { name: "🐟 Minnow",     pay: 50,   rare: false, line: "A tiny catch, but still a catch!" },
  { name: "<:minigames:1555544500179439707> Trout",      pay: 120,  rare: false, line: "A solid trout — dinner is sorted!" },
  { name: "🐠 Tropical Fish", pay: 200, rare: false, line: "Colourful and worth a bit!" },
  { name: "🦈 Shark",      pay: 600,  rare: true,  line: "You wrestled a shark and WON!" },
  { name: "🐙 Octopus",    pay: 400,  rare: true,  line: "Eight arms, no waiting — sold!" },
  { name: "<:eco:1555544429253890050> Treasure Chest", pay: 1500, rare: true, line: "INCREDIBLE! A chest at the bottom!" },
];

function pickFish() {
  const roll = Math.random();
  if (roll < 0.05) return FISH_TABLE[6]; // Treasure
  if (roll < 0.12) return FISH_TABLE[4]; // Shark
  if (roll < 0.20) return FISH_TABLE[5]; // Octopus
  if (roll < 0.35) return FISH_TABLE[3]; // Tropical
  if (roll < 0.55) return FISH_TABLE[2]; // Trout
  if (roll < 0.75) return FISH_TABLE[1]; // Minnow
  return FISH_TABLE[0];                  // Boot
}

// ══════════════════════════════════════════════════════════════════════════════

module.exports = {
  data: new SlashCommandBuilder()
    .setName("economy")
    .setDescription("Manage your economy account and perform various actions.")
    .addSubcommand((s) => s.setName("startacc").setDescription("Create your economy account."))
    .addSubcommand((s) => s.setName("daily").setDescription("Collect your daily <:Currency:1555544251268595792> 500 coins."))
    .addSubcommand((s) => s.setName("balance").setDescription("Check your wallet and bank balance."))
    .addSubcommand((s) => s.setName("beg").setDescription("Beg for some coins. (20m cooldown)"))
    .addSubcommand((s) => s.setName("work").setDescription("Work a random job to earn coins. (30m cooldown)"))
    .addSubcommand((s) => s.setName("fish").setDescription("Go fishing and reel in a catch! (15m cooldown)"))
    .addSubcommand((s) =>
      s.setName("rob").setDescription("Rob another user's wallet. (30m cooldown)")
        .addUserOption((o) => o.setName("user").setDescription("Who to rob?").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("give").setDescription("Give coins to another user.")
        .addUserOption((o) => o.setName("recipient").setDescription("Who to give to?").setRequired(true))
        .addIntegerOption((o) => o.setName("amount").setDescription("How many coins?").setRequired(true).setMinValue(1))
    )
    .addSubcommandGroup((g) =>
      g.setName("bank").setDescription("Manage your bank account.")
        .addSubcommand((s) =>
          s.setName("deposit").setDescription("Deposit coins into the bank.")
            .addIntegerOption((o) => o.setName("amount").setDescription("Amount to deposit.").setRequired(true).setMinValue(1))
        )
        .addSubcommand((s) =>
          s.setName("withdraw").setDescription("Withdraw coins from the bank.")
            .addIntegerOption((o) => o.setName("amount").setDescription("Amount to withdraw.").setRequired(true).setMinValue(1))
        )
        .addSubcommand((s) => s.setName("balance").setDescription("Check your bank balance."))
    )
    .addSubcommand((s) => s.setName("deleteacc").setDescription("Delete your economy account."))
    .addSubcommand((s) =>
      s.setName("coinflip").setDescription("Bet on a coin flip.")
        .addIntegerOption((o) => o.setName("amount").setDescription("Bet amount.").setRequired(true).setMinValue(1))
        .addStringOption((o) => o.setName("side").setDescription("Pick a side.").setRequired(true)
          .addChoices({ name: "Heads", value: "Heads" }, { name: "Tails", value: "Tails" }))
    )
    .addSubcommand((s) =>
      s.setName("blackjack").setDescription("Play a game of Blackjack.")
        .addIntegerOption((o) => o.setName("bet").setDescription("Bet amount.").setRequired(true).setMinValue(1))
    )
    .addSubcommand((s) =>
      s.setName("heist").setDescription("Attempt a high-risk heist. (1h cooldown)")
        .addIntegerOption((o) => o.setName("amount").setDescription("Amount to risk.").setRequired(true).setMinValue(1))
    )
    .addSubcommand((s) =>
      s.setName("roll").setDescription("Roll a die and bet on the number.")
        .addIntegerOption((o) => o.setName("bet").setDescription("Bet amount.").setRequired(true).setMinValue(1))
        .addIntegerOption((o) => o.setName("number").setDescription("Number to bet on (1–6).").setRequired(true).setMinValue(1).setMaxValue(6))
    )
    .addSubcommand((s) =>
      s.setName("roulette").setDescription("Spin the roulette wheel.")
        .addIntegerOption((o) => o.setName("bet").setDescription("Bet amount.").setRequired(true).setMinValue(1))
        .addStringOption((o) => o.setName("color").setDescription("Color to bet on.").setRequired(true)
          .addChoices({ name: "Red", value: "Red" }, { name: "Black", value: "Black" }, { name: "Green (14×)", value: "Green" }))
    )
    .addSubcommand((s) =>
      s.setName("slots").setDescription("Spin the slot machine.")
        .addIntegerOption((o) => o.setName("coins").setDescription("Coins to bet.").setRequired(true).setMinValue(1).setMaxValue(100000))
    )
    .addSubcommand((s) =>
      s.setName("addbalance").setDescription("[Admin] Add coins to a user.")
        .addUserOption((o) => o.setName("user").setDescription("Target user.").setRequired(true))
        .addIntegerOption((o) => o.setName("amount").setDescription("Amount to add.").setRequired(true).setMinValue(1))
    )
    .addSubcommand((s) =>
      s.setName("removebalance").setDescription("[Admin] Remove coins from a user.")
        .addUserOption((o) => o.setName("user").setDescription("Target user.").setRequired(true))
        .addIntegerOption((o) => o.setName("amount").setDescription("Amount to remove.").setRequired(true).setMinValue(1))
    ),

  // ══════════════════════════════════════════════════════════════════════════
  async execute(interaction, client) {
    try {
      const group = interaction.options.getSubcommandGroup(false);
      const sub   = interaction.options.getSubcommand();
      const uid   = interaction.user.id;

      async function getUser() {
        const u = await User.findOne({ userId: uid });
        if (!u) {
          await interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [errorContainer("You don't have an account yet! Use `/economy startacc` to create one.")],
          });
          return null;
        }
        return u;
      }

      // ── startacc ─────────────────────────────────────────────────────────
      if (sub === "startacc") {
        const existing = await User.findOne({ userId: uid });
        if (existing) {
          return interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [errorContainer("You already have an account!")],
          });
        }

        const termsContainer = new ContainerBuilder().setAccentColor(0x57F287)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:files:1555544445565407352> Economy Terms of Service`),
            new TextDisplayBuilder().setContent(
              `Before creating your account, please read and accept these rules:\n\n` +
              `**1.** No self-bots, macros, or scripts to spam commands.\n` +
              `**2.** No inappropriate usernames or franchise names.\n` +
              `**3.** No multi-accounting to gain advantages.\n` +
              `**4.** No account sharing with other users.\n` +
              `**5.** Report bugs — do not exploit them.\n\n` +
              `*Violations may result in a permanent blacklist.*`
            )
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# You'll start with <:Currency:1555544251268595792> **1,000** coins.`)
          )
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId("accept_terms").setLabel("Accept & Create Account").setEmoji(parseEmoji('<a:tickyy:1555544712687915008>')).setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId("decline_terms").setLabel("Decline").setEmoji(parseEmoji('<:crossy:1555544390221562048>')).setStyle(ButtonStyle.Danger)
            )
          );

        const msg = await interaction.reply({
          flags: MessageFlags.IsComponentsV2,
          components: [termsContainer],
          fetchReply: true,
        });

        const col = msg.createMessageComponentCollector({
          filter: (i) => i.user.id === uid,
          max: 1,
          time: 30000,
        });

        col.on("collect", async (i) => {
          if (i.customId === "accept_terms") {
            await User.create({ userId: uid, userName: interaction.user.username, balance: 1000 });
            const success = new ContainerBuilder().setAccentColor(0x57F287)
              .addSectionComponents(
                new SectionBuilder()
                  .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## <:boost:1555544362455146576> Account Created!`),
                    new TextDisplayBuilder().setContent(
                      `Welcome to the economy, **${interaction.user.username}**!\n\n` +
                      `<:eco:1555544429253890050> **Wallet:** <:Currency:1555544251268595792> 1,000 coins\n<:eco:1555544429253890050> **Bank:** <:Currency:1555544251268595792> 0 coins\n\n` +
                      `> Use \`/economy daily\` for your first bonus!`
                    )
                  )
                  .setThumbnailAccessory(new ThumbnailBuilder().setURL(interaction.user.displayAvatarURL({ size: 256 })))
              );
            await i.update({ components: [success] });
          } else {
            const declined = new ContainerBuilder().setAccentColor(0x95A5A6)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:crossy:1555544390221562048> Declined\nYou declined the terms. Account not created.`));
            await i.update({ components: [declined] });
          }
        });

        col.on("end", async (c) => {
          if (!c.size) {
            const expired = new ContainerBuilder().setAccentColor(0x95A5A6)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:1430986244921495654:1555544239792980044> Timed Out\nYou didn't respond in time.`));
            await interaction.editReply({ components: [expired] });
          }
        });
        return;
      }

      // ── balance (wallet) ──────────────────────────────────────────────────
      if (sub === "balance" && !group) {
        const user = await getUser(); if (!user) return;
        const bank = await Bank.findOne({ userID: uid });
        const bankBal = bank?.balance || 0;
        const total   = user.balance + bankBal;

        const barWallet = Math.round((user.balance / (total || 1)) * 20);
        const barBank   = 20 - barWallet;

        const container = new ContainerBuilder().setAccentColor(0x2ECC71)
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## <:Currency:1555544251268595792> Balance — ${interaction.user.username}`),
                new TextDisplayBuilder().setContent(
                  `<:eco:1555544429253890050> **Wallet:** <:Currency:1555544251268595792> ${fmt(user.balance)}\n` +
                  `<:eco:1555544429253890050> **Bank:** <:Currency:1555544251268595792> ${fmt(bankBal)}\n` +
                  `<:n_utils:1555544669545431062> **Total:** <:Currency:1555544251268595792> ${fmt(total)}\n\n` +
                  `\`${"█".repeat(barWallet)}${"░".repeat(barBank)}\` Wallet ratio`
                )
              )
              .setThumbnailAccessory(new ThumbnailBuilder().setURL(interaction.user.displayAvatarURL({ size: 256 })))
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `-# Tip: Keep coins in your <:eco:1555544429253890050> bank — wallet coins can be robbed!`
            )
          );

        return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [container] });
      }

      // ── daily ─────────────────────────────────────────────────────────────
      if (sub === "daily") {
        const user = await getUser(); if (!user) return;
        const cd = await checkDailyCD(uid);
        if (!cd.ok) {
          return interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [cooldownContainer(`You already claimed today's reward!\n\n> Come back in ${cd.left}.`)],
          });
        }

        user.balance += 500;
        await user.save();
        await Cooldown.findOneAndUpdate(
          { userId: uid },
          { userId: uid, cooldownExpiration: Date.now() + 86400000 },
          { upsert: true, new: true }
        );

        const c = new ContainerBuilder().setAccentColor(0xF1C40F)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:boost:1555544362455146576> Daily Reward Claimed!`),
            new TextDisplayBuilder().setContent(
              `You collected your daily **<:Currency:1555544251268595792> 500 coins**!\n\n` +
              `<:eco:1555544429253890050> New wallet balance: **<:Currency:1555544251268595792> ${fmt(user.balance)}**\n\n` +
              `> Come back tomorrow for another reward!`
            )
          );
        return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [c] });
      }

      // ── beg ───────────────────────────────────────────────────────────────
      if (sub === "beg") {
        const user = await getUser(); if (!user) return;
        const cd = await checkCD("beg", uid, 20 * 60000);
        if (!cd.ok) {
          return interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [cooldownContainer(`You're on cooldown! Try again in **${cd.mins} min**.`)],
            flags: MessageFlags.Ephemeral,
          });
        }
        const coins = Math.floor(Math.random() * 491) + 10;
        user.balance += coins;
        await user.save();

        const begs = [
          `A kind stranger handed you <:Currency:1555544251268595792> **${fmt(coins)}**!`,
          `You held a sign on the street corner and made <:Currency:1555544251268595792> **${fmt(coins)}**!`,
          `Someone felt sorry for you and gave <:Currency:1555544251268595792> **${fmt(coins)}**.`,
          `The local bakery gave you day-old bread... wait no, <:Currency:1555544251268595792> **${fmt(coins)} coins**!`,
        ];

        const c = new ContainerBuilder().setAccentColor(0x3498DB)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## 🙏 Begging`),
            new TextDisplayBuilder().setContent(begs[Math.floor(Math.random() * begs.length)])
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# 20 minute cooldown. <:eco:1555544429253890050> Wallet: <:Currency:1555544251268595792> ${fmt(user.balance)}`));
        return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [c] });
      }

      // ── work ──────────────────────────────────────────────────────────────
      if (sub === "work") {
        const user = await getUser(); if (!user) return;
        const cd = await checkCD("work", uid, 30 * 60000);
        if (!cd.ok) {
          return interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [cooldownContainer(`You're still on shift! Back to work in **${cd.mins} min**.`)],
            flags: MessageFlags.Ephemeral,
          });
        }

        const job  = JOBS[Math.floor(Math.random() * JOBS.length)];
        const pay  = Math.floor(Math.random() * (job.pay[1] - job.pay[0])) + job.pay[0];
        user.balance += pay;
        await user.save();

        const c = new ContainerBuilder().setAccentColor(0x2ECC71)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:eco:1555544429253890050> Work: ${job.name}`),
            new TextDisplayBuilder().setContent(
              `${job.line}\n\n` +
              `You earned <:Currency:1555544251268595792> **${fmt(pay)}** coins!\n\n` +
              `<:eco:1555544429253890050> Wallet: <:Currency:1555544251268595792> **${fmt(user.balance)}**`
            )
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# 30 minute cooldown before you can work again.`));
        return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [c] });
      }

      // ── fish ──────────────────────────────────────────────────────────────
      if (sub === "fish") {
        const user = await getUser(); if (!user) return;
        const cd = await checkCD("fish", uid, 15 * 60000);
        if (!cd.ok) {
          return interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [cooldownContainer(`Your line is still in the water! Try again in **${cd.mins} min**.`)],
            flags: MessageFlags.Ephemeral,
          });
        }

        // Show casting stage
        const casting = new ContainerBuilder().setAccentColor(0x3498DB)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:minigames:1555544500179439707> Fishing`),
            new TextDisplayBuilder().setContent(`*You cast your line into the water... waiting...*`)
          );
        await interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [casting] });
        await new Promise((r) => setTimeout(r, 2000));

        const catch_ = pickFish();
        user.balance += catch_.pay;
        await user.save();

        const color = catch_.rare ? 0xF1C40F : catch_.pay > 0 ? 0x2ECC71 : 0x95A5A6;
        const rareTag = catch_.rare ? " <:boost:1555544362455146576> **RARE CATCH!**" : "";

        const result = new ContainerBuilder().setAccentColor(color)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:minigames:1555544500179439707> Fishing Result${rareTag}`),
            new TextDisplayBuilder().setContent(
              `${catch_.line}\n\n` +
              `**You caught:** ${catch_.name}\n` +
              (catch_.pay > 0 ? `**Earned:** <:Currency:1555544251268595792> ${fmt(catch_.pay)} coins!\n\n` : `*No coins this time...*\n\n`) +
              `<:eco:1555544429253890050> Wallet: <:Currency:1555544251268595792> **${fmt(user.balance)}**`
            )
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# 15 minute cooldown • Rare catches have a ~5% chance!`));

        return interaction.editReply({ components: [result] });
      }

      // ── rob ───────────────────────────────────────────────────────────────
      if (sub === "rob") {
        const user = await getUser(); if (!user) return;
        const cd = await checkCD("rob", uid, 30 * 60000);
        if (!cd.ok) {
          return interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [cooldownContainer(`You need to lay low for **${cd.mins} more min**.`)],
            flags: MessageFlags.Ephemeral,
          });
        }

        const target   = interaction.options.getUser("user");
        if (target.id === uid)
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer("You can't rob yourself!")] });

        const targetUser = await User.findOne({ userId: target.id });
        if (!targetUser)
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer(`${target.username} doesn't have an account.`)] });

        if (targetUser.balance < 100)
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer(`${target.username} is too broke to rob!`)] });

        // 60% success chance
        const success = Math.random() < 0.6;
        if (success) {
          const stolen = Math.floor(Math.random() * (targetUser.balance * 0.4 - 50)) + 50;
          targetUser.balance -= stolen;
          user.balance       += stolen;
          await user.save(); await targetUser.save();

          const c = new ContainerBuilder().setAccentColor(0x57F287)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`## 🦹 Robbery Successful!`),
              new TextDisplayBuilder().setContent(
                `You successfully robbed **${target.username}** of <:Currency:1555544251268595792> **${fmt(stolen)}**!\n\n` +
                `<:eco:1555544429253890050> Your wallet: <:Currency:1555544251268595792> **${fmt(user.balance)}**`
              )
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Cooldown: 30 min • Rob chance: 60%`));
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [c] });
        } else {
          const fine = Math.floor(Math.random() * 200) + 50;
          user.balance = Math.max(0, user.balance - fine);
          await user.save();

          const c = new ContainerBuilder().setAccentColor(0xED4245)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`## 🚔 Caught!`),
              new TextDisplayBuilder().setContent(
                `**${target.username}** caught you in the act!\n` +
                `You got fined <:Currency:1555544251268595792> **${fmt(fine)}** coins.\n\n` +
                `<:eco:1555544429253890050> Your wallet: <:Currency:1555544251268595792> **${fmt(user.balance)}**`
              )
            );
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [c] });
        }
      }

      // ── give ──────────────────────────────────────────────────────────────
      if (sub === "give") {
        const user = await getUser(); if (!user) return;
        const recipient = interaction.options.getUser("recipient");
        const amount    = interaction.options.getInteger("amount");

        if (recipient.id === uid)
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer("You can't give coins to yourself.")] });

        const recUser = await User.findOne({ userId: recipient.id });
        if (!recUser)
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer(`${recipient.username} doesn't have an account.`)] });

        if (user.balance < amount)
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer(`You only have <:Currency:1555544251268595792> ${fmt(user.balance)} coins.`)] });

        user.balance      -= amount;
        recUser.balance   += amount;
        await user.save(); await recUser.save();

        const c = new ContainerBuilder().setAccentColor(0x2ECC71)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:boost:1555544362455146576> Coins Sent`),
            new TextDisplayBuilder().setContent(
              `You gave <:Currency:1555544251268595792> **${fmt(amount)}** to **${recipient.username}**!\n\n` +
              `<:eco:1555544429253890050> Your remaining balance: <:Currency:1555544251268595792> **${fmt(user.balance)}**`
            )
          );
        return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [c] });
      }

      // ── bank group ────────────────────────────────────────────────────────
      if (group === "bank") {
        const user = await getUser(); if (!user) return;

        if (sub === "balance") {
          const bank = await Bank.findOne({ userID: uid });
          const b    = bank?.balance || 0;
          const c = new ContainerBuilder().setAccentColor(0x3498DB)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`## <:eco:1555544429253890050> Bank Balance`),
              new TextDisplayBuilder().setContent(`<:Currency:1555544251268595792> **${fmt(b)}** coins in your bank account.\n<:eco:1555544429253890050> Wallet: <:Currency:1555544251268595792> **${fmt(user.balance)}**`)
            );
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [c] });
        }

        if (sub === "deposit") {
          const amount = interaction.options.getInteger("amount");
          if (user.balance < amount)
            return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer(`You only have <:Currency:1555544251268595792> ${fmt(user.balance)} in your wallet.`)] });

          const walletResult = await User.findOneAndUpdate(
            { userId: uid, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
          );
          if (!walletResult)
            return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer(`Transaction failed — insufficient funds or race condition. Try again.`)] });
          await Bank.findOneAndUpdate({ userID: uid }, { $inc: { balance: amount } }, { upsert: true });

          const c = new ContainerBuilder().setAccentColor(0x2ECC71)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`## <:eco:1555544429253890050> Deposit Successful`),
              new TextDisplayBuilder().setContent(`Deposited <:Currency:1555544251268595792> **${fmt(amount)}** into your bank.\n<:eco:1555544429253890050> Wallet remaining: <:Currency:1555544251268595792> **${fmt(walletResult.balance)}**`)
            );
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [c] });
        }

        if (sub === "withdraw") {
          const amount = interaction.options.getInteger("amount");
          const bankResult = await Bank.findOneAndUpdate(
            { userID: uid, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
          );
          if (!bankResult)
            return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer(`Not enough coins in your bank.`)] });
          const walletResult = await User.findOneAndUpdate(
            { userId: uid },
            { $inc: { balance: amount } },
            { new: true }
          );

          const c = new ContainerBuilder().setAccentColor(0x2ECC71)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`## <:eco:1555544429253890050> Withdrawal Successful`),
              new TextDisplayBuilder().setContent(`Withdrew <:Currency:1555544251268595792> **${fmt(amount)}** from your bank.\n<:eco:1555544429253890050> Wallet: <:Currency:1555544251268595792> **${fmt(walletResult.balance)}**`)
            );
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [c] });
        }
      }

      // ── deleteacc ─────────────────────────────────────────────────────────
      if (sub === "deleteacc") {
        const user = await getUser(); if (!user) return;

        const confirm = new ContainerBuilder().setAccentColor(0xED4245)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:error:1555544434601369620> Delete Account`),
            new TextDisplayBuilder().setContent(`Are you sure you want to permanently delete your economy account?\n\n> **This action is irreversible!** All coins and data will be lost.`)
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId("del_yes").setLabel("Delete Forever").setStyle(ButtonStyle.Danger),
              new ButtonBuilder().setCustomId("del_no").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
            )
          );

        const msg = await interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [confirm], fetchReply: true });
        const col = msg.createMessageComponentCollector({ filter: (i) => i.user.id === uid, max: 1, time: 15000 });

        col.on("collect", async (i) => {
          if (i.customId === "del_yes") {
            await User.findOneAndDelete({ userId: uid });
            await Bank.findOneAndDelete({ userID: uid });
            const done = new ContainerBuilder().setAccentColor(0x95A5A6)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:del:1555544395720302643> Account Deleted\nYour economy account has been permanently deleted.`));
            await i.update({ components: [done] });
          } else {
            const cancel = new ContainerBuilder().setAccentColor(0x57F287)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <a:tickyy:1555544712687915008> Cancelled\nYour account is safe!`));
            await i.update({ components: [cancel] });
          }
        });

        col.on("end", async (c) => {
          if (!c.size) await interaction.editReply({
            components: [new ContainerBuilder().setAccentColor(0x95A5A6)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:1430986244921495654:1555544239792980044> Timed Out\nDeletion cancelled.`))]
          });
        });
        return;
      }

      // ── coinflip ──────────────────────────────────────────────────────────
      if (sub === "coinflip") {
        const user = await getUser(); if (!user) return;
        const amount = interaction.options.getInteger("amount");
        const side   = interaction.options.getString("side");
        if (user.balance < amount)
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer(`Not enough coins in wallet.`)] });

        user.balance -= amount; await user.save();

        const spin = new ContainerBuilder().setAccentColor(0xF1C40F)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:Currency:1555544251268595792> Coin Flip`),
            new TextDisplayBuilder().setContent(`You bet <:Currency:1555544251268595792> **${fmt(amount)}** on **${side}**.\n\n*The coin spins... <:n_loading:1555544489194688623>*`)
          );
        await interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [spin] });
        await new Promise((r) => setTimeout(r, 2200));

        const result = Math.random() < 0.5 ? "Heads" : "Tails";
        const won = result === side;
        if (won) { user.balance += amount * 2; await user.save(); }

        const c = new ContainerBuilder().setAccentColor(won ? 0x57F287 : 0xED4245)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:Currency:1555544251268595792> Coin Flip — ${won ? "You Won! <:boost:1555544362455146576>" : "You Lost <:error:1555544434601369620>"}`),
            new TextDisplayBuilder().setContent(
              `The coin landed on **${result}** ${result === "Heads" ? "<:1430986209995526274:1555544172302307449>" : "🦅"}\n\n` +
              (won ? `<:boost:1555544362455146576> You won <:Currency:1555544251268595792> **${fmt(amount * 2)}**!` : `<:error:1555544434601369620> You lost <:Currency:1555544251268595792> **${fmt(amount)}**.`) +
              `\n\n<:eco:1555544429253890050> Wallet: <:Currency:1555544251268595792> **${fmt(user.balance)}**`
            )
          );
        return interaction.editReply({ components: [c] });
      }

      // ── blackjack ─────────────────────────────────────────────────────────
      if (sub === "blackjack") {
        const user = await getUser(); if (!user) return;
        const bet  = interaction.options.getInteger("bet");
        if (user.balance < bet)
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer("Not enough coins.")] });

        user.balance -= bet; await user.save();

        // Card helpers
        const suits = ["♠", "♥", "♦", "♣"];
        const vals  = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
        const deck  = suits.flatMap((s) => vals.map((v) => `${v}${s}`));
        const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
        const cv    = (c) => { const v = c.slice(0, -1); if (["J","Q","K"].includes(v)) return 10; if (v === "A") return 11; return +v; };
        const total = (hand) => { let t = 0, a = 0; for (const c of hand) { const v = cv(c); if (v === 11) a++; t += v; } while (t > 21 && a--) t -= 10; return t; };

        const shuffled = shuffle([...deck]);
        const ph = [shuffled.pop(), shuffled.pop()];
        const dh = [shuffled.pop(), shuffled.pop()];

        function bjContainer(playerHand, dealerVisible, ended, desc = "") {
          const pt = total(playerHand);
          const dt = ended ? total(dh) : null;
          return new ContainerBuilder().setAccentColor(0x3498DB)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`## <:minigames:1555544500179439707> Blackjack — Bet: <:Currency:1555544251268595792> ${fmt(bet)}`),
              new TextDisplayBuilder().setContent(
                `**Your Hand:** ${playerHand.join(" ")} *(Total: ${pt})*\n` +
                `**Dealer:** ${dealerVisible}${ended ? ` *(Total: ${dt})*` : ""}\n\n` +
                (desc || "What do you do?")
              )
            )
            .addSeparatorComponents(new SeparatorBuilder());
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("bj_hit").setLabel("👊 Hit").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("bj_stand").setLabel("Stand").setEmoji(parseEmoji('<:restrict:1555544549105999962>')).setStyle(ButtonStyle.Secondary)
        );

        const initial = bjContainer(ph, `${dh[0]} [?]`, false);
        initial.addActionRowComponents(row);
        const msg = await interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [initial], fetchReply: true });

        const col = msg.createMessageComponentCollector({
          filter: (i) => i.user.id === uid && ["bj_hit", "bj_stand"].includes(i.customId),
          time: 30000,
        });

        col.on("collect", async (i) => {
          if (i.customId === "bj_hit") {
            ph.push(shuffled.pop());
            const pt = total(ph);
            if (pt > 21) {
              col.stop();
              const done = bjContainer(ph, `${dh[0]} [?]`, false, `<:fire:1555544450871332944> **Bust!** You went over 21 and lost <:Currency:1555544251268595792> ${fmt(bet)}.`);
              done.addTextDisplayComponents(new TextDisplayBuilder().setContent(`<:eco:1555544429253890050> Wallet: <:Currency:1555544251268595792> **${fmt(user.balance)}**`));
              return i.update({ components: [done] });
            }
            const next = bjContainer(ph, `${dh[0]} [?]`, false);
            next.addActionRowComponents(row);
            return i.update({ components: [next] });
          }

          if (i.customId === "bj_stand") {
            col.stop();
            let dt = total(dh);
            while (dt < 17) { dh.push(shuffled.pop()); dt = total(dh); }
            const pt = total(ph);
            let desc, won = false;

            if (dt > 21)       { desc = `<:boost:1555544362455146576> Dealer busted! You win <:Currency:1555544251268595792> ${fmt(bet * 2)}!`; user.balance += bet * 2; won = true; }
            else if (pt > dt)  { desc = `<:boost:1555544362455146576> You win! <:Currency:1555544251268595792> ${fmt(bet * 2)}!`;               user.balance += bet * 2; won = true; }
            else if (pt < dt)  { desc = `<:error:1555544434601369620> Dealer wins. You lost <:Currency:1555544251268595792> ${fmt(bet)}.`; }
            else               { desc = `🤝 Push! <:Currency:1555544251268595792> ${fmt(bet)} returned.`;             user.balance += bet; }

            await user.save();
            const done = bjContainer(ph, dh.join(" "), true, desc);
            done.addTextDisplayComponents(new TextDisplayBuilder().setContent(`<:eco:1555544429253890050> Wallet: <:Currency:1555544251268595792> **${fmt(user.balance)}**`));
            return i.update({ components: [done] });
          }
        });

        col.on("end", async (c, reason) => {
          if (reason === "time") {
            const expired = new ContainerBuilder().setAccentColor(0x95A5A6)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:minigames:1555544500179439707> Blackjack — Timed Out\nYou took too long! Lost <:Currency:1555544251268595792> ${fmt(bet)}.`));
            await interaction.editReply({ components: [expired] });
          }
        });
        return;
      }

      // ── heist ─────────────────────────────────────────────────────────────
      if (sub === "heist") {
        const user = await getUser(); if (!user) return;
        const cd = await checkCD("heist", uid, 60 * 60000);
        if (!cd.ok) {
          return interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [cooldownContainer(`Lay low! Back in **${cd.mins} min**.`)],
            flags: MessageFlags.Ephemeral,
          });
        }

        const amount = interaction.options.getInteger("amount");
        if (user.balance < amount)
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer("Not enough coins.")] });

        user.balance -= amount; await user.save();

        const stages = [
          "<:1430986225493479485:1555544207652032633> *Casing the target...*",
          "<:lockk:1555544494441635860> *Bypassing security...*",
          "<:eco:1555544429253890050> *Inside the vault...*",
          "<:error:1555544434601369620> *Getting out!*",
        ];

        const loading = new ContainerBuilder().setAccentColor(0xE67E22)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## 🦹 Heist in Progress`),
            new TextDisplayBuilder().setContent(stages[0])
          );
        await interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [loading] });

        for (let s = 1; s < stages.length; s++) {
          await new Promise((r) => setTimeout(r, 1000));
          const update = new ContainerBuilder().setAccentColor(0xE67E22)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`## 🦹 Heist in Progress`),
              new TextDisplayBuilder().setContent(stages.slice(0, s + 1).join("\n"))
            );
          await interaction.editReply({ components: [update] });
        }

        await new Promise((r) => setTimeout(r, 1000));

        const roll = Math.random();
        let color, desc;
        if (roll < 0.35) {
          const win = amount * 3;
          user.balance += win;
          color = 0x57F287;
          desc  = `<a:tickyy:1555544712687915008> **HEIST SUCCESS!** You made off with <:Currency:1555544251268595792> **${fmt(win)}**!`;
        } else if (roll < 0.60) {
          user.balance += amount;
          color = 0xFEE75C;
          desc  = `<:error:1555544434601369620> **Barely escaped!** You recovered your <:Currency:1555544251268595792> **${fmt(amount)}** but got nothing extra.`;
        } else {
          color = 0xED4245;
          desc  = `🚔 **CAUGHT!** You lost <:Currency:1555544251268595792> **${fmt(amount)}** and spent the night in a cell.`;
        }

        await user.save();
        const result = new ContainerBuilder().setAccentColor(color)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## 🦹 Heist Complete`),
            new TextDisplayBuilder().setContent(`${desc}\n\n<:eco:1555544429253890050> Wallet: <:Currency:1555544251268595792> **${fmt(user.balance)}**`)
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Success: 35% • Escape: 25% • Caught: 40% • Cooldown: 1h`));
        return interaction.editReply({ components: [result] });
      }

      // ── roll ──────────────────────────────────────────────────────────────
      if (sub === "roll") {
        const user = await getUser(); if (!user) return;
        const bet    = interaction.options.getInteger("bet");
        const number = interaction.options.getInteger("number");
        if (user.balance < bet)
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer("Not enough coins.")] });

        user.balance -= bet; await user.save();
        const result = Math.floor(Math.random() * 6) + 1;
        const won    = result === number;

        if (won) { user.balance += bet * 6; await user.save(); }

        const DICE = ["⚀","⚁","⚂","⚃","⚄","⚅"];
        const c = new ContainerBuilder().setAccentColor(won ? 0x57F287 : 0xED4245)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:minigames:1555544500179439707> Dice Roll`),
            new TextDisplayBuilder().setContent(
              `You bet <:Currency:1555544251268595792> **${fmt(bet)}** on **${number}**.\n\n` +
              `The die shows: # ${DICE[result - 1]} **${result}**\n\n` +
              (won ? `<:boost:1555544362455146576> Jackpot! 6× payout = <:Currency:1555544251268595792> **${fmt(bet * 6)}**!` : `<:error:1555544434601369620> Not this time. You lost <:Currency:1555544251268595792> **${fmt(bet)}**.`) +
              `\n\n<:eco:1555544429253890050> Wallet: <:Currency:1555544251268595792> **${fmt(user.balance)}**`
            )
          );
        return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [c] });
      }

      // ── roulette ──────────────────────────────────────────────────────────
      if (sub === "roulette") {
        const user  = await getUser(); if (!user) return;
        const bet   = interaction.options.getInteger("bet");
        const color = interaction.options.getString("color");
        if (user.balance < bet)
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer("Not enough coins.")] });

        user.balance -= bet; await user.save();

        const spin = new ContainerBuilder().setAccentColor(0xE91E63)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:minigames:1555544500179439707> Roulette`),
            new TextDisplayBuilder().setContent(`You bet <:Currency:1555544251268595792> **${fmt(bet)}** on **${color}**.\n\n*The wheel spins... <:n_loading:1555544489194688623>*`)
          );
        await interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [spin] });
        await new Promise((r) => setTimeout(r, 2000));

        const outcomes = ["Red","Red","Red","Red","Black","Black","Black","Black","Green"];
        const result   = outcomes[Math.floor(Math.random() * outcomes.length)];
        const won      = result === color;
        const COLORS   = { Red: "<:LEred:1555544262123323422>", Black: "<:dot:1555544412300378243>", Green: "<:LEgreen:1555544256356159600>" };
        let payout = 0;
        if (won) {
          payout = color === "Green" ? bet * 14 : bet * 2;
          user.balance += payout;
          await user.save();
        }

        const c = new ContainerBuilder().setAccentColor(won ? 0x57F287 : 0xED4245)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:minigames:1555544500179439707> Roulette — ${won ? "Winner! <:boost:1555544362455146576>" : "Better luck next time"}`),
            new TextDisplayBuilder().setContent(
              `The wheel lands on ${COLORS[result]} **${result}**\n\n` +
              (won ? `<:boost:1555544362455146576> You won <:Currency:1555544251268595792> **${fmt(payout)}**!` : `<:error:1555544434601369620> You lost <:Currency:1555544251268595792> **${fmt(bet)}**.`) +
              `\n\n<:eco:1555544429253890050> Wallet: <:Currency:1555544251268595792> **${fmt(user.balance)}**`
            )
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# Red/Black: 2× payout (4/9 chance each) • Green: 14× payout (1/9 chance)`)
          );
        return interaction.editReply({ components: [c] });
      }

      // ── slots ─────────────────────────────────────────────────────────────
      if (sub === "slots") {
        const user  = await getUser(); if (!user) return;
        const coins = interaction.options.getInteger("coins");
        if (user.balance < coins)
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer("Not enough coins.")] });

        user.balance -= coins; await user.save();

        const Game = new Slots({
          message: interaction,
          isSlashGame: true,
          embed: { title: "Slot Machine <:minigames:1555544500179439707>", color: 0x5865F2 },
          slots: ["🍇", "🍊", "🍋", "🍌", "🍒"],
        });

        Game.startGame();
        Game.on("gameOver", async (result) => {
          if (result.result === "win") {
            const win = coins * 2;
            user.balance += win;
            await user.save();
            await interaction.followUp({
              flags: MessageFlags.IsComponentsV2,
              components: [new ContainerBuilder().setAccentColor(0x57F287)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                  `## <:minigames:1555544500179439707> You Won!\n<:boost:1555544362455146576> You won <:Currency:1555544251268595792> **${fmt(win)}**!\n<:eco:1555544429253890050> Wallet: <:Currency:1555544251268595792> **${fmt(user.balance)}**`
                ))]
            });
          } else {
            await interaction.followUp({
              flags: MessageFlags.IsComponentsV2,
              components: [new ContainerBuilder().setAccentColor(0xED4245)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                  `## <:minigames:1555544500179439707> You Lost\n<:error:1555544434601369620> Better luck next time! You lost <:Currency:1555544251268595792> **${fmt(coins)}**.\n<:eco:1555544429253890050> Wallet: <:Currency:1555544251268595792> **${fmt(user.balance)}**`
                ))]
            });
          }
        });
        return;
      }

      // ── addbalance ────────────────────────────────────────────────────────
      if (sub === "addbalance") {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer("You don't have permission.")] });

        const target = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");
        const tu     = await User.findOne({ userId: target.id });
        if (!tu) return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer(`${target.username} has no account.`)] });

        tu.balance += amount; await tu.save();
        const c = new ContainerBuilder().setAccentColor(0x57F287)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:Currency:1555544251268595792> Balance Added [Admin]`),
            new TextDisplayBuilder().setContent(`Added <:Currency:1555544251268595792> **${fmt(amount)}** to **${target.username}**.\nNew balance: <:Currency:1555544251268595792> **${fmt(tu.balance)}**`)
          );
        return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [c] });
      }

      // ── removebalance ─────────────────────────────────────────────────────
      if (sub === "removebalance") {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
          return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer("You don't have permission.")] });

        const target = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");
        const tu     = await User.findOne({ userId: target.id });
        if (!tu) return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer(`${target.username} has no account.`)] });
        if (tu.balance < amount) return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [errorContainer(`Not enough coins to remove.`)] });

        tu.balance -= amount; await tu.save();
        const c = new ContainerBuilder().setAccentColor(0xE67E22)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:Currency:1555544251268595792> Balance Removed [Admin]`),
            new TextDisplayBuilder().setContent(`Removed <:Currency:1555544251268595792> **${fmt(amount)}** from **${target.username}**.\nNew balance: <:Currency:1555544251268595792> **${fmt(tu.balance)}**`)
          );
        return interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [c] });
      }

    } catch (err) {
      console.error("[Economy Error]", err);
      const c = new ContainerBuilder().setAccentColor(0xED4245)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:fire:1555544450871332944> Unexpected Error\nSomething went wrong. Please try again later.`));
      try {
        if (interaction.replied || interaction.deferred) await interaction.followUp({ flags: MessageFlags.IsComponentsV2, components: [c] });
        else await interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [c] });
      } catch {}
    }
  },
};
