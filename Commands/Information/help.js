const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
} = require("discord.js");

const { parseEmoji } = require('../../Utils/emojis');
const fs = require("fs");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const { loadAvatar } = require("../../Utils/canvasUtils");
const getOwners = require("../../Utils/getOwners");

const clamp = (s, n) =>
  typeof s === "string" ? (s.length > n ? s.slice(0, n - 1) + "…" : s) : "";

const normalizeEmojiForOption = (emoji) => {
  if (!emoji) return undefined;
  if (typeof emoji === "string") {
    const m = emoji.match(/^<a?:(\w+):(\d+)>$/);
    if (m) return { name: m[1], id: m[2] };
    return { name: emoji };
  }
  return emoji;
};

async function renderHelpBanner(botName, avatarURL) {
  const W = 1400;
  const H = 280;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const FACE = GlobalFonts.has("Inter")
    ? "Inter"
    : "system-ui, -apple-system, Segoe UI, Roboto, Arial";

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0d1117");
  bg.addColorStop(0.6, "#111827");
  bg.addColorStop(1, "#0a0d14");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.038)";
  for (let x = 24; x < W; x += 44) {
    for (let y = 24; y < H; y += 44) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const stripe = ctx.createLinearGradient(0, 0, 0, H);
  stripe.addColorStop(0, "#f472b6");
  stripe.addColorStop(0.5, "#a78bfa");
  stripe.addColorStop(1, "#38bdf8");
  ctx.fillStyle = stripe;
  ctx.fillRect(0, 0, 5, H);

  const bottomLine = ctx.createLinearGradient(0, 0, W, 0);
  bottomLine.addColorStop(0, "transparent");
  bottomLine.addColorStop(0.25, "#f472b6");
  bottomLine.addColorStop(0.75, "#a78bfa");
  bottomLine.addColorStop(1, "transparent");
  ctx.fillStyle = bottomLine;
  ctx.fillRect(0, H - 3, W, 3);

  const AV_CX = W - 180;
  const AV_CY = H / 2;
  const AV_R = 104;

  const glow = ctx.createRadialGradient(AV_CX, AV_CY, 0, AV_CX, AV_CY, 160);
  glow.addColorStop(0, "rgba(167,139,250,0.22)");
  glow.addColorStop(1, "rgba(167,139,250,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(AV_CX - 160, 0, 320, H);

  ctx.shadowColor = "rgba(167,139,250,0.55)";
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(AV_CX, AV_CY, AV_R + 5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(167,139,250,0.75)";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.shadowColor = "transparent";

  try {
    const buf = await loadAvatar(avatarURL);
    if (buf) {
      const img = await loadImage(buf);
      ctx.save();
      ctx.beginPath();
      ctx.arc(AV_CX, AV_CY, AV_R, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, AV_CX - AV_R, AV_CY - AV_R, AV_R * 2, AV_R * 2);
      ctx.restore();
    }
  } catch {}

  const TX = 36;

  ctx.fillStyle = "rgba(244,114,182,0.18)";
  ctx.beginPath();
  ctx.roundRect(TX, 44, 130, 28, 6);
  ctx.fill();
  ctx.font = `700 13px ${FACE}`;
  ctx.fillStyle = "#f472b6";
  ctx.textBaseline = "middle";
  ctx.fillText("HELP CENTER", TX + 12, 58);

  ctx.fillStyle = "#f8fafc";
  ctx.textBaseline = "alphabetic";
  ctx.font = `900 84px ${FACE}`;
  ctx.fillText(botName, TX, 158);

  ctx.font = `500 30px ${FACE}`;
  ctx.fillStyle = "rgba(248,250,252,0.62)";
  ctx.fillText("Browse all commands using the menu below", TX, 200);

  return canvas.toBuffer("image/png");
}

function makeHomeContainer({ client, servers, users, accentColor, bannerName, options, e, isOwner, guildId }) {
  const totalCmds = client.commands.size;
  const dashUrl = `${process.env.DASHBOARD_URL || "https://dash.rocobot.xyz"}/guild/${guildId}`;
  const cmdsUrl = `${dashUrl}/commands`;

  const statsLine = `${e.dot || "●"} ${servers.toLocaleString()} servers  ·  ${users.toLocaleString()} members  ·  ${totalCmds} commands`;

  const g = (emoji, name) => `${emoji} **${name}**`;

  const colA = [
    g(e.antinuke, "Antinuke"),
    g(e.automod, "Automod"),
    g(e.community, "Community"),
    g(e.fun, "Fun"),
    g(e.information, "Information"),
    g(e.moderation, "Moderation"),
    g(e.music, "Music"),
    g(e.utils, "Utility"),
  ];

  const colB = [
    g(e.tools, "Tools"),
    g(e.premium, "Premium"),
    g(e.economy, "Economy"),
    g(e.images, "Images"),
    g(e.giveaway, "Giveaway"),
    g(e.music, "Playlist"),
    g(e.moderation, "Tickets"),
    ...(isOwner ? [g(e.owner, "Owner")] : []),
  ];

  const gridRows = Math.max(colA.length, colB.length);
  const grid = Array.from({ length: gridRows }, (_, i) =>
    `${colA[i] ?? ""}　　${colB[i] ?? ""}`
  ).join("\n");

  return new ContainerBuilder()
    .setAccentColor(accentColor)
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL(`attachment://${bannerName}`)
          .setDescription("Roco help banner"),
      )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(statsLine)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ⚡ Getting Started

**1.** Open the [Dashboard](${dashUrl}) and select your server.
**2.** Every command works right away. Don't need some? Turn them off on the [Commands](${cmdsUrl}) page.
**3.** Configure features like Welcome, Logs, Tickets, and Leveling from the Dashboard panels.
**4.** Use \`/\` commands in your server — the bot will guide you.`
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${e.information || "ℹ️"}  I'm **${client.user.username}** — select a category below to browse commands.\n` +
        `${e.utils || "🛠️"}  All setup is done in the [Dashboard](${dashUrl}).\n` +
        `${e.dev || "🤖"}  Every command works right away — you can turn off the ones you don't need on the [Commands page](${cmdsUrl}).`
      )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(grid)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("category-select")
          .setPlaceholder("Jump to a category...")
          .addOptions(options),
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("Dashboard").setStyle(ButtonStyle.Link).setURL(dashUrl),
        new ButtonBuilder().setLabel("Support").setStyle(ButtonStyle.Link).setURL("https://discord.gg/a9Kea3ymC7"),
        new ButtonBuilder().setLabel("Invite").setStyle(ButtonStyle.Link).setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=303600576574&scope=bot%20applications.commands`),
        new ButtonBuilder().setLabel("Vote on Top.gg").setStyle(ButtonStyle.Link).setURL(client.config?.topggURL || "https://top.gg/bot/960624234688811188"),
      )
    );
}

function makeCategoryContainer({ client, selectedCategory, page, totalPages, items, accentColor, options, guildId }) {
  const commandLines = items.length
    ? items
        .map(it => `▸ **${it.mention}**  —  ${clamp(it.description, 280)}`)
        .join("\n")
    : "_No commands found in this category._";

  return new ContainerBuilder()
    .setAccentColor(accentColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${selectedCategory}`)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`Page ${page + 1} / ${totalPages}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(commandLines)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`page_first_${selectedCategory}`).setLabel("First").setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId(`page_prev_${selectedCategory}`).setLabel("Back").setStyle(ButtonStyle.Primary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId(`page_stop`).setLabel("Close").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`page_next_${selectedCategory}`).setLabel("Next").setStyle(ButtonStyle.Primary).setDisabled(page === totalPages - 1),
        new ButtonBuilder().setCustomId(`page_last_${selectedCategory}`).setLabel("Last").setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages - 1),
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("category-select")
          .setPlaceholder("Switch category...")
          .addOptions(options)
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("Dashboard").setStyle(ButtonStyle.Link).setURL(`${process.env.DASHBOARD_URL || "https://dash.rocobot.xyz"}/guild/${guildId}`),
        new ButtonBuilder().setLabel("Support").setStyle(ButtonStyle.Link).setURL("https://discord.gg/a9Kea3ymC7"),
        new ButtonBuilder().setLabel("Invite").setStyle(ButtonStyle.Link).setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=303600576574&scope=bot%20applications.commands`),
        new ButtonBuilder().setLabel("Vote on Top.gg").setStyle(ButtonStyle.Link).setURL(client.config?.topggURL || "https://top.gg/bot/960624234688811188"),
      )
    );
}

const pageMemory = new Map();
const getPage = (cat) => pageMemory.get(cat) ?? 0;
const setPage = (cat, p) => pageMemory.set(cat, p);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Explore all Roco commands by category."),

  async execute(interaction, client) {
    const ownerIds = await getOwners();
    const isOwner = ownerIds.includes(interaction.user.id);

    const servers = client.guilds.cache.size;
    const users = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);

    const commandIds = new Map();
    try {
      const cmds = await client.application.commands.fetch();
      cmds.forEach(c => commandIds.set(c.name, c.id));
    } catch (err) {
      console.warn("Failed fetching application commands:", err.message);
    }

    const commandFolders = fs.readdirSync("./Commands").filter(f => !f.startsWith(".") && f !== "Owner");
    const commandsByCategory = {};

    for (const folder of commandFolders) {
      const files = fs.readdirSync(`./Commands/${folder}`).filter(f => f.endsWith(".js"));
      const list = [];
      for (const file of files) {
        try {
          const mod = await import(`./../${folder}/${file}`);
          const exported = mod?.default ?? mod;
          const builder = exported?.data;
          if (!builder?.toJSON) continue;
          const json = builder.toJSON();
          const entry = { name: json.name, description: json.description || "No description provided", subcommands: [] };
          if (Array.isArray(json.options)) {
            for (const opt of json.options) {
              if (opt.type === 1) {
                entry.subcommands.push({ name: opt.name, description: opt.description });
              } else if (opt.type === 2 && Array.isArray(opt.options)) {
                for (const sub of opt.options) {
                  if (sub.type === 1) entry.subcommands.push({ name: sub.name, description: sub.description, group: opt.name });
                }
              }
            }
          }
          if (entry.name) list.push(entry);
        } catch (err) {
          console.warn(`Failed loading ${file}:`, err.message);
        }
      }
      const uniq = [];
      const seen = new Set();
      for (const c of list) {
        if (!seen.has(c.name)) { seen.add(c.name); uniq.push(c); }
      }
      uniq.sort((a, b) => a.name.localeCompare(b.name));
      commandsByCategory[folder] = uniq;
    }

    if (isOwner && fs.existsSync(`./Commands/Owner`)) {
      const ownerFiles = fs.readdirSync(`./Commands/Owner`).filter(f => f.endsWith(".js"));
      const ownerCmds = [];
      for (const file of ownerFiles) {
        try {
          const mod = await import(`./../Owner/${file}`);
          const exported = mod?.default ?? mod;
          const builder = exported?.data;
          if (!builder?.toJSON) continue;
          const json = builder.toJSON();
          const entry = { name: json.name, description: json.description || "No description", subcommands: [] };
          if (Array.isArray(json.options)) {
            for (const opt of json.options) {
              if (opt.type === 1) entry.subcommands.push({ name: opt.name, description: opt.description });
            }
          }
          if (entry.name) ownerCmds.push(entry);
        } catch (err) { console.error(`Error loading owner cmd ${file}:`, err); }
      }
      commandsByCategory["Owner"] = ownerCmds;
    }

    const e = client.emoji || {};
    const optionEmojiMap = {
      Antinuke: e.antinuke, Automod: e.thunder, Economy: e.economy,
      Fun: e.fun, Community: e.community, PremiumCommands: e.premium,
      Socials: e.socials, Giveaway: e.giveaway, Images: e.images,
      Information: e.information, Moderation: e.moderation, Music: e.music,
      Setups: e.setups, Suggestion: e.suggestions, Tools: e.tools,
      Utility: e.utils, Owner: e.owner,
      Playlist: e.music,
      Tickets: e.moderation,
    };

    const dropdownOptions = [
      { label: "Back to Home", value: "home", emoji: normalizeEmojiForOption(e.home) },
      ...Object.keys(commandsByCategory).sort().map(folder => ({
        label: folder, value: folder, emoji: normalizeEmojiForOption(optionEmojiMap[folder]),
      })),
    ];

    const accentColor =
      typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
        ? parseInt(client.config.embedColor.slice(1), 16)
        : 0xf472b6;

    const bannerBuffer = await renderHelpBanner(
      client.user.username,
      client.user.displayAvatarURL({ extension: "png", size: 256 })
    );
    const bannerName = "noxx-help-banner.png";

    const guildId = interaction.guild.id;

    const homeContainer = makeHomeContainer({
      client, servers, users, accentColor, bannerName, options: dropdownOptions, e, isOwner, guildId,
    });

    await interaction.reply({
      components: [homeContainer],
      files: [{ attachment: bannerBuffer, name: bannerName }],
      flags: MessageFlags.IsComponentsV2,
    });

    const replyMessage = await interaction.fetchReply();

    const filter = (i) =>
      (i.isStringSelectMenu() && i.customId === "category-select") ||
      (i.isButton() && i.customId.startsWith("page_"));

    // Expires after 3 minutes without use; componentExpiry then disables the menu.
    const collector = replyMessage.createMessageComponentCollector({ filter, idle: 180_000 });

    const pageSize = 10;

    const buildFlat = (category) => {
      const cat = commandsByCategory[category] ?? [];
      const flat = [];
      for (const c of cat) {
        if (!c.subcommands?.length) {
          const id = commandIds.get(c.name);
          flat.push({ mention: id ? `</${c.name}:${id}>` : `/${c.name}`, description: c.description || "No description" });
        } else {
          for (const sub of c.subcommands) {
            const id = commandIds.get(c.name);
            const path = sub.group ? `${c.name} ${sub.group} ${sub.name}` : `${c.name} ${sub.name}`;
            flat.push({ mention: id ? `</${path}:${id}>` : `/${path}`, description: sub.description || "No description" });
          }
        }
      }
      return flat;
    };

    collector.on("collect", async (i) => {
      if (interaction.user.id !== i.user.id)
        return i.reply({ content: "This menu belongs to someone else.", flags: MessageFlags.Ephemeral });

      await i.deferUpdate();

      if (i.isStringSelectMenu()) {
        const selected = i.values[0];
        if (selected === "Owner" && !isOwner) return;

        if (selected === "home") {
          return i.editReply({ components: [homeContainer], files: [{ attachment: bannerBuffer, name: bannerName }] });
        }

        setPage(selected, 0);
        const flat = buildFlat(selected);
        const totalPages = Math.max(1, Math.ceil(flat.length / pageSize));
        const container = makeCategoryContainer({ client, selectedCategory: selected, page: 0, totalPages, items: flat.slice(0, pageSize), accentColor, options: dropdownOptions });
        return i.editReply({ components: [container], files: [] });
      }

      if (i.isButton()) {
        if (i.customId === "page_stop") {
          try { await i.message.delete().catch(() => {}); } catch {}
          return;
        }
        const [, key, ...rest] = i.customId.split("_");
        const selectedCategory = rest.join("_");
        if (selectedCategory === "Owner" && !isOwner) return;

        const flat = buildFlat(selectedCategory);
        const totalPages = Math.max(1, Math.ceil(flat.length / pageSize));
        let page = getPage(selectedCategory);

        if (key === "first") page = 0;
        else if (key === "prev") page = Math.max(0, page - 1);
        else if (key === "next") page = Math.min(totalPages - 1, page + 1);
        else if (key === "last") page = totalPages - 1;

        setPage(selectedCategory, page);
        const items = flat.slice(page * pageSize, page * pageSize + pageSize);
        const container = makeCategoryContainer({ client, selectedCategory, page, totalPages, items, accentColor, options: dropdownOptions });
        return i.editReply({ components: [container] });
      }
    });
  },
};
