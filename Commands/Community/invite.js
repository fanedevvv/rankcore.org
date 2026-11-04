const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");
const InviteStats = require("../../Schemas/inviteSchema");
const GuildConfig = require("../../Schemas/guildInviteConfig");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const { drawBackground, loadAvatar } = require("../../Utils/canvasUtils");

const font = (size, weight = 800) =>
  `${weight} ${size}px ${
    GlobalFonts.has("Inter")
      ? "Inter"
      : "system-ui, -apple-system, Segoe UI, Roboto, Arial"
  }`;

function round(ctx, x, y, w, h, r = 18) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function nf(n) {
  return (n ?? 0).toLocaleString();
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = "…";
  while (text.length && ctx.measureText(text + ellipsis).width > maxWidth) {
    text = text.slice(0, -1);
  }
  return text + ellipsis;
}

async function renderInviteLeaderboardPage({ page, pages, rows, usernames, guildName }) {
  const W = 1200;
  const H = 640;
  const P = 28;      // outer panel padding
  const M = 24;      // inner content margin
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  drawBackground(ctx, W, H, "purple");

  // glass panel
  round(ctx, P, P, W - P * 2, H - P * 2, 26);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // content bounds
  const CX = P + M;
  const CW = W - (P + M) * 2;

  // header
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.font = font(40, 900);
  ctx.fillText("INVITES LEADERBOARD", CX, P + M + 48);

  const tagTxt = `PAGE ${page + 1}/${pages}`;
  ctx.font = font(22, 800);
  const tagW = ctx.measureText(tagTxt).width + 24;
  round(ctx, CX + CW - tagW, P + M + 16, tagW, 40, 12);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(tagTxt, CX + CW - tagW / 2, P + M + 44);

  // rows
  const startY = P + M + 88;
  const rowH = 64;      // taller to fit name + breakdown
  const gap = 12;
  const leftPad = CX + 8;
  const innerW = CW - 16;
  const pillW = 56;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const y = startY + i * (rowH + gap);

    // row background
    round(ctx, leftPad, y, innerW, rowH, 14);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // rank pill
    round(ctx, leftPad + 10, y + 8, pillW, rowH - 16, 12);
    ctx.fillStyle = r.rank <= 3 ? "rgba(255,215,0,0.9)" : "rgba(255,255,255,0.2)";
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = r.rank <= 3 ? "#1a1a1a" : "#fff";
    ctx.font = font(22, 900);
    const rankStr = String(r.rank).padStart(2, "0");
    ctx.fillText(rankStr, leftPad + 10 + pillW / 2, y + rowH / 2 + 8);

    // username + breakdown (kept within row)
    const nameX = leftPad + pillW + 26;
    const uname = `@${usernames[r.userId] || "unknown"}`;

    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = font(24, 900);
    const nameBaseline = y + 30;
    const maxNameW = Math.min(520, innerW * 0.55);
    const unameDraw = truncate(ctx, uname, maxNameW);
    ctx.fillText(unameDraw, nameX, nameBaseline);

    // short underline just under the name
    const nameW = Math.min(ctx.measureText(unameDraw).width, maxNameW);
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nameX, nameBaseline + 6);
    ctx.lineTo(nameX + nameW, nameBaseline + 6);
    ctx.stroke();

    // breakdown line
    ctx.font = font(16, 700);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(
      `reg ${nf(r.regular)}  •  bonus ${nf(r.bonus)}  •  fake ${nf(r.fake)}  •  left ${nf(r.left)}`,
      nameX,
      y + rowH - 12
    );

    // right total
    ctx.textAlign = "right";
    ctx.font = font(22, 900);
    ctx.fillStyle = "#fff";
    ctx.fillText(`${nf(r.total)} invites`, leftPad + innerW - 16, y + rowH / 2 + 8);
  }

  // footer
  const footerH = 56;
  const footerY = H - P - M - footerH;
  round(ctx, CX, footerY, CW, footerH, 16);
  ctx.save();
  ctx.clip();
  const grad = ctx.createLinearGradient(0, footerY, 0, footerY + footerH);
  grad.addColorStop(0, "rgba(255,255,255,0.10)");
  grad.addColorStop(1, "rgba(255,255,255,0.08)");
  ctx.fillStyle = grad;
  ctx.fillRect(CX, footerY, CW, footerH);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1.5;
  round(ctx, CX, footerY, CW, footerH, 16);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = font(18, 800);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(`Guild: ${guildName}`, CX + 18, footerY + footerH / 2);

  return canvas.toBuffer("image/png");
}


async function renderInviteCountCard({ user, stats, guildName }) {
  const W = 1100;
  const H = 460;
  const P = 24;           // outer panel padding
  const M = 32;           // inner content margin (keeps tiles off the border)
  const GAP = 24;         // gap between tiles
  const AV_SIZE = 130;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  drawBackground(ctx, W, H, "purple");

  // glass panel
  round(ctx, P, P, W - P * 2, H - P * 2, 26);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // content bounds (everything inside uses these so nothing touches border)
  const CX = P + M;
  const CW = W - (P + M) * 2;

  // header
  try {
    const buf = await loadAvatar(user.displayAvatarURL({ extension: "png", size: 256 }));
    if (buf) {
      const avatar = await loadImage(buf);
      ctx.save();
      round(ctx, CX, P + M, AV_SIZE, AV_SIZE, 16);
      ctx.clip();
      ctx.drawImage(avatar, CX, P + M, AV_SIZE, AV_SIZE);
      ctx.restore();
    }
  } catch { /* avatar unavailable, skip */ }

  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.font = font(38, 900);
  ctx.fillText("INVITE SUMMARY", CX + AV_SIZE + 24, P + M + 54);
  ctx.font = font(22, 700);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(`@${user.username}`, CX + AV_SIZE + 24, P + M + 88);

  // numbers
  const total = (stats?.invites || 0) + (stats?.bonus || 0);
  const regular = stats?.regular || stats?.invites || 0;
  const bonus = stats?.bonus || 0;
  const fake = stats?.fake || 0;
  const left = stats?.left || 0;

  // tiles aligned to content area
  const tileY = P + M + AV_SIZE + 30;
  const tileH = 116;
  const tileW = (CW - GAP * 3) / 4;

  const drawTile = (x, title, value) => {
    round(ctx, x, tileY, tileW, tileH, 16);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = font(18, 800);
    ctx.fillText(title.toUpperCase(), x + 18, tileY + 32);
    ctx.fillStyle = "#fff";
    ctx.font = font(36, 900);
    ctx.fillText(value, x + 18, tileY + 76);
  };

  drawTile(CX + 0 * (tileW + GAP), "total", nf(total));
  drawTile(CX + 1 * (tileW + GAP), "regular", nf(regular));
  drawTile(CX + 2 * (tileW + GAP), "bonus", nf(bonus));
  drawTile(CX + 3 * (tileW + GAP), "fake/left", `${nf(fake)} / ${nf(left)}`);

  // footer aligned with tiles (same CX / CW)
  const footerH = 56;
  const footerY = H - P - M - footerH;

  round(ctx, CX, footerY, CW, footerH, 16);
  ctx.save();
  ctx.clip();
  const grad = ctx.createLinearGradient(0, footerY, 0, footerY + footerH);
  grad.addColorStop(0, "rgba(255,255,255,0.10)");
  grad.addColorStop(1, "rgba(255,255,255,0.08)");
  ctx.fillStyle = grad;
  ctx.fillRect(CX, footerY, CW, footerH);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1.5;
  round(ctx, CX, footerY, CW, footerH, 16);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = font(18, 800);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(`Guild: ${guildName}`, CX + 16, footerY + footerH / 2);

  return canvas.toBuffer("image/png");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("invite")
    .setDescription("Invite tracking utilities")
    .addSubcommand((s) =>
      s
        .setName("count")
        .setDescription("Show total invites for a user")
        .addUserOption((o) => o.setName("user").setDescription("User to check"))
    )
    .addSubcommand((s) => s.setName("leaderboard").setDescription("Show top inviters"))
    .addSubcommand((s) =>
      s
        .setName("reset")
        .setDescription("Reset invite stats")
        .addUserOption((o) => o.setName("user").setDescription("User to reset"))
        .addBooleanOption((b) => b.setName("all").setDescription("Reset the whole server"))
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === "reset" || sub === "config" || sub === "disable") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: "You need Administrator permission to use this command.",
          ephemeral: true,
        });
      }
    }

    if (sub === "count") {
      await interaction.deferReply();
      const user = interaction.options.getUser("user") ?? interaction.user;
      const stats = await InviteStats.findOne({ guildId, userId: user.id });
      try {
        const buffer = await renderInviteCountCard({
          user,
          stats,
          guildName: interaction.guild.name,
        });
        const file = new AttachmentBuilder(buffer, { name: "invite-count.png" });
        return interaction.editReply({ files: [file] });
      } catch (err) {
        console.error("[invite] renderInviteCountCard failed:", err.message);
        return interaction.editReply({ content: "Failed to generate invite card. Please try again." });
      }
    }

    if (sub === "leaderboard") {
      await interaction.deferReply();
      const allStats = await InviteStats.find({ guildId }).sort({ invites: -1 });
      if (!allStats.length) return interaction.editReply({ content: "No invite data yet." });

      const rowsRaw = allStats.map((s, idx) => ({
        rank: idx + 1,
        userId: s.userId,
        total: (s.invites || 0) + (s.bonus || 0),
        regular: s.regular ?? s.invites ?? 0,
        bonus: s.bonus ?? 0,
        fake: s.fake ?? 0,
        left: s.left ?? 0,
      }));

      const pageSize = 10;
      const pages = Math.max(1, Math.ceil(rowsRaw.length / pageSize));
      let page = 0;

      const ids = rowsRaw.map((r) => r.userId);
      const uniqueIds = [...new Set(ids)].slice(0, 200);
      const fetched = await Promise.all(
        uniqueIds.map((id) => client.users.fetch(id).catch(() => null))
      );
      const usernames = {};
      for (let i = 0; i < uniqueIds.length; i++) {
        usernames[uniqueIds[i]] = fetched[i]?.username || "unknown";
      }

      const sliceRows = (p) => rowsRaw.slice(p * pageSize, p * pageSize + pageSize);

      let buffer;
      try {
        buffer = await renderInviteLeaderboardPage({
          page,
          pages,
          rows: sliceRows(page),
          usernames,
          guildName: interaction.guild.name,
        });
      } catch (err) {
        console.error("[invite] renderInviteLeaderboardPage failed:", err.message);
        return interaction.editReply({ content: "Failed to generate leaderboard. Please try again." });
      }
      const file = new AttachmentBuilder(buffer, { name: "invites-leaderboard.png" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("inv_prev").setLabel("◀ Previous").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("inv_next").setLabel("Next ▶").setStyle(ButtonStyle.Secondary)
      );

      const msg = await interaction.editReply({ files: [file], components: [row] });

      const collector = msg.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60_000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "inv_prev") {
          page = page > 0 ? page - 1 : pages - 1;
        } else if (i.customId === "inv_next") {
          page = page + 1 < pages ? page + 1 : 0;
        }
        try {
          const buf = await renderInviteLeaderboardPage({
            page,
            pages,
            rows: sliceRows(page),
            usernames,
            guildName: interaction.guild.name,
          });
          const f = new AttachmentBuilder(buf, { name: "invites-leaderboard.png" });
          await i.update({ files: [f], components: [row] });
        } catch (err) {
          console.error("[invite] paginator renderInviteLeaderboardPage failed:", err.message);
          await i.reply({ content: "Failed to load page. Please try again.", ephemeral: true }).catch(() => {});
        }
      });

      collector.on("end", async () => {
        row.components.forEach((b) => b.setDisabled(true));
        await interaction.editReply({ components: [row] }).catch(() => {});
      });

      return;
    }

    if (sub === "reset") {
      const all = interaction.options.getBoolean("all");
      const target = interaction.options.getUser("user");
      if (all) {
        await InviteStats.deleteMany({ guildId });
        return interaction.reply({ content: "Server invite stats reset." });
      }
      if (!target)
        return interaction.reply({ content: "Select a user or use --all", ephemeral: true });
      await InviteStats.deleteOne({ guildId, userId: target.id });
      return interaction.reply({ content: `Reset invite stats for ${target.tag}` });
    }

if (sub === "config") {
  const existing = await GuildConfig.findOne({ guildId });
  if (existing) {
    return interaction.reply({
      content: "Invite system is already configured. Use `/invite disable` first to change settings.",
      ephemeral: true,
    });
  }

  const channel = interaction.options.getChannel("channel");

  const modal = new ModalBuilder()
    .setCustomId(`inviteConfigModal_${guildId}_${channel.id}`) // include guild ID for tracking
    .setTitle("Set Welcome Message");

  const messageInput = new TextInputBuilder()
    .setCustomId("welcomeMessage")
    .setLabel("Welcome message template")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Use {user}, {inviter}, {invites}, {url}")
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(messageInput));

  return interaction.showModal(modal);
}

    if (sub === "disable") {
      const existing = await GuildConfig.findOne({ guildId });
      if (!existing) {
        return interaction.reply({
          content: "Invite system is not currently enabled.",
          ephemeral: true,
        });
      }
      await GuildConfig.deleteOne({ guildId });
      return interaction.reply({ content: "Invite system disabled for this server." });
    }
  },
};