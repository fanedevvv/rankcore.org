// Commands/Information/userInfo.js — Redesigned canvas (no external BG URL, new layout)

const { SlashCommandBuilder, MessageFlags, AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const { loadAvatar } = require("../../Utils/canvasUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Get information about a server member.")
    .addUserOption(o => o.setName("user").setDescription("The user to look up").setRequired(false)),

  async execute(interaction, client) {
    try {
      await interaction.deferReply();

      const user = interaction.options.getUser("user") || interaction.user;
      const member = await interaction.guild.members.fetch(user.id);

      let bannerURL = null;
      try { const u = await client.users.fetch(user.id, { force: true }); bannerURL = u.bannerURL({ size: 2048 }); } catch {}

      let flagsArr = [];
      try { const flags = user.flags ?? (await user.fetchFlags()); flagsArr = flags?.toArray?.() ?? []; } catch {}

      const isBooster = !!member.premiumSince;
      const topRole = member.roles.highest?.id === interaction.guild.id ? null : member.roles.highest;
      const accent = topRole?.hexColor && topRole.hexColor !== "#000000" ? topRole.hexColor : "#6366f1";

      const joinPos = (await interaction.guild.members.fetch())
        .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
        .map(m => m.id).indexOf(member.id) + 1;

      const mutualCount = client.guilds.cache.filter(g => g.members.cache.has(member.id)).size;
      const botOwners = (process.env.developerId || "").split(/[,\s]+/).filter(Boolean);
      const isOwner = member.id === interaction.guild.ownerId;
      const isDev = botOwners.includes(member.id);

      const W = 1200, H = 620;
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext("2d");

      const FACE = GlobalFonts.has("Inter") ? "Inter" : "system-ui, -apple-system, Segoe UI, Roboto, Arial";
      const font = (size, weight = 700) => `${weight} ${size}px ${FACE}`;

      // ── Background: deep indigo-slate gradient
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#0f0c29");
      bg.addColorStop(0.5, "#1a1a3e");
      bg.addColorStop(1, "#0f0c29");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Subtle grid
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      for (let x = 32; x < W; x += 52) {
        for (let y = 32; y < H; y += 52) {
          ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Top accent bar (uses top role color)
      const topBar = ctx.createLinearGradient(0, 0, W, 0);
      topBar.addColorStop(0, "transparent");
      topBar.addColorStop(0.3, accent);
      topBar.addColorStop(0.7, accent);
      topBar.addColorStop(1, "transparent");
      ctx.fillStyle = topBar;
      ctx.fillRect(0, 0, W, 4);

      const roundRect = (x, y, w, h, r = 18) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
      };

      const truncateToWidth = (c, text, maxW) => {
        if (c.measureText(text).width <= maxW) return text;
        const e = "\u2026";
        while (text.length && c.measureText(text + e).width > maxW) text = text.slice(0, -1);
        return text + e;
      };

      const drawPill = (x, y, text, color = "rgba(255,255,255,0.15)") => {
        ctx.font = font(17, 700);
        const tw = ctx.measureText(text).width;
        const pw = tw + 28, ph = 34;
        roundRect(x, y, pw, ph, 14);
        ctx.fillStyle = color; ctx.fill();
        ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(text, x + 14, y + ph / 2);
        return pw;
      };

      const drawLabel = (x, y, label, value) => {
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.font = font(14, 700); ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillText(label.toUpperCase(), x, y);
        ctx.font = font(21, 800); ctx.fillStyle = "#f8fafc";
        ctx.fillText(value, x, y + 28);
      };

      // ── Avatar area (right side)
      const AV_CX = W - 170, AV_CY = 170, AV_R = 110;

      // Radial glow
      const avGlow = ctx.createRadialGradient(AV_CX, AV_CY, 0, AV_CX, AV_CY, 150);
      avGlow.addColorStop(0, `${accent}44`);
      avGlow.addColorStop(1, "transparent");
      ctx.fillStyle = avGlow; ctx.fillRect(AV_CX - 150, 0, 300, H);

      // Ring
      ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R + 5, 0, Math.PI * 2);
      ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.stroke();

      try {
        const avatarURL = member.displayAvatarURL({ extension: "png", size: 256 });
        const buf = await loadAvatar(avatarURL);
        if (buf) {
          const avatar = await loadImage(buf);
          ctx.save();
          ctx.beginPath(); ctx.arc(AV_CX, AV_CY, AV_R, 0, Math.PI * 2); ctx.clip();
          ctx.drawImage(avatar, AV_CX - AV_R, AV_CY - AV_R, AV_R * 2, AV_R * 2);
          ctx.restore();
        }
      } catch {}

      // Banner below avatar
      if (bannerURL) {
        try {
          const bannerBuf = await loadAvatar(bannerURL);
          if (bannerBuf) {
            const banner = await loadImage(bannerBuf);
            const bW = 320, bH = 100;
            roundRect(AV_CX - bW / 2, AV_CY + AV_R + 16, bW, bH, 12);
            ctx.save(); ctx.clip(); ctx.drawImage(banner, AV_CX - bW / 2, AV_CY + AV_R + 16, bW, bH); ctx.restore();
            ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 1;
            roundRect(AV_CX - bW / 2, AV_CY + AV_R + 16, bW, bH, 12); ctx.stroke();
          }
        } catch {}
      }

      // ── Title & handle (left side)
      const TX = 48;
      ctx.textAlign = "left"; ctx.fillStyle = "#f8fafc";
      ctx.font = font(38, 900);
      ctx.fillText(member.displayName || user.username, TX, 68);
      ctx.font = font(22, 600); ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(`@${user.username}`, TX, 100);

      // Badges / pills row
      let px = TX;
      const badges = [];
      if (isOwner) badges.push("Server Owner");
      if (isDev) badges.push("Bot Developer");
      if (isBooster) badges.push("Nitro Booster");
      if (user.bot) badges.push("Bot");
      for (const badge of badges) {
        const color = badge === "Server Owner" ? "rgba(251,191,36,0.25)"
          : badge === "Bot Developer" ? "rgba(99,102,241,0.3)"
          : badge === "Nitro Booster" ? "rgba(244,114,182,0.25)"
          : "rgba(255,255,255,0.15)";
        px += drawPill(px, 118, badge, color) + 10;
      }

      const flagLabels = {
        Staff: "Discord Staff", Partner: "Partner", Hypesquad: "HypeSquad",
        HypeSquadOnlineHouse1: "Bravery", HypeSquadOnlineHouse2: "Brilliance",
        HypeSquadOnlineHouse3: "Balance", BugHunterLevel1: "Bug Hunter",
        BugHunterLevel2: "Bug Hunter Gold", CertifiedModerator: "Cert Mod",
        VerifiedDeveloper: "Early Dev", ActiveDeveloper: "Active Dev",
        PremiumEarlySupporter: "Early Supporter",
      };
      for (const f of flagsArr) {
        const label = flagLabels[f];
        if (!label) continue;
        px += drawPill(px, 118, label) + 8;
        if (px > W - 300) break;
      }

      // ── Stats grid (2 col, 3 rows)
      const fmt = (d) => new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "2-digit" }).format(d);
      const nf = (n) => n.toLocaleString();

      const LX = TX, RX = TX + 330, ST_Y = 185;
      drawLabel(LX, ST_Y, "User ID", user.id);
      drawLabel(LX, ST_Y + 72, "Top Role", topRole ? `@${topRole.name}` : "None");
      drawLabel(LX, ST_Y + 144, "Booster", isBooster ? `Since ${fmt(member.premiumSince)}` : "No");

      drawLabel(RX, ST_Y, "Joined Server", fmt(member.joinedAt));
      drawLabel(RX, ST_Y + 72, "Account Created", fmt(user.createdAt));
      drawLabel(RX, ST_Y + 144, "Join Position", `#${nf(joinPos)}`);

      // ── Roles preview — plain text names, drawn onto canvas (no Discord mention syntax)
      const roleList = member.roles.cache
        .filter(r => r.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(r => r.name).slice(0, 6).join(" · ") || "None";

      drawLabel(LX, ST_Y + 220, `Roles (${member.roles.cache.size - 1})`, "");
      ctx.font = font(18, 600); ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText(truncateToWidth(ctx, roleList, W - 500), LX, ST_Y + 270);

      // ── Footer bar
      const fH = 56, fY = H - 24 - fH;
      roundRect(24, fY, W - 48, fH, 14);
      const grad = ctx.createLinearGradient(0, fY, 0, fY + fH);
      grad.addColorStop(0, "rgba(255,255,255,0.09)"); grad.addColorStop(1, "rgba(255,255,255,0.06)");
      ctx.fillStyle = grad; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1;
      roundRect(24, fY, W - 48, fH, 14); ctx.stroke();

      ctx.textBaseline = "middle"; ctx.font = font(17, 600); ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.textAlign = "left"; ctx.fillText(`Mutual Servers: ${nf(mutualCount)}`, 44, fY + fH / 2);
      ctx.textAlign = "right";
      ctx.fillText(truncateToWidth(ctx, `Guild: ${interaction.guild.name}`, 400), W - 44, fY + fH / 2);

      const buffer = canvas.toBuffer("image/png");
      // allowedMentions: suppress all pings as a safety net
      await interaction.editReply({
        files: [new AttachmentBuilder(buffer, { name: "userinfo.png" })],
        allowedMentions: { parse: [] },
      });

    } catch (error) {
      const msg = "There was an error fetching user information.";
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content: msg });
      else await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    }
  },
};