const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const { drawBackground } = require("../../Utils/canvasUtils");
const avatarRatingSchema = require("../../Schemas/avatarRating");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Avatar rating system")
    .addSubcommand((sub) =>
      sub
        .setName("rate")
        .setDescription("Rate a user's avatar")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("The user to rate").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("leaderboard").setDescription("Show top 10 rated avatars")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "rate") {
      const targetUser = interaction.options.getUser("user");
      if (!targetUser) {
        const embed = new EmbedBuilder()
          .setTitle("Error")
          .setDescription("User not found.")
          .setColor("Red");
        return interaction.reply({ embeds: [embed] });
      }

      // Create modal for rating
      const modal = new ModalBuilder()
        .setCustomId(`rate_avatar_modal_${targetUser.id}`)
        .setTitle(`Rate ${targetUser.username}'s Avatar`);

      const ratingInput = new TextInputBuilder()
        .setCustomId("rating_input")
        .setLabel("Enter a rating (1-100%)")
        .setPlaceholder("e.g., 85")
        .setRequired(true)
        .setStyle(TextInputStyle.Short);

      const row = new ActionRowBuilder().addComponents(ratingInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }

    if (subcommand === "leaderboard") {
      let data;
      try {
        data = await avatarRatingSchema.find({ Guild: interaction.guild.id });
        if (!data.length) {
          const embed = new EmbedBuilder()
            .setTitle("Leaderboard")
            .setDescription("No ratings yet.")
            .setColor("Yellow");
          return interaction.reply({ embeds: [embed] });
        }
      } catch (error) {
        console.error(`[Avatar Command] Failed to fetch leaderboard data: ${error.message}`);
        const embed = new EmbedBuilder()
          .setTitle("Error")
          .setDescription("Failed to load leaderboard.")
          .setColor("Red");
        return interaction.reply({ embeds: [embed] });
      }

      // Prepare leaderboard data
      const sorted = data
        .map((d) => ({
          userId: d.User,
          avg: d.Ratings.reduce((a, b) => a + b, 0) / d.Ratings.length,
          count: d.Ratings.length,
        }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 10);

      // Canvas renderer
      const renderLeaderboard = async (data) => {
        const W = 1280,
          H = 720;
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext("2d");

        // Background — pure canvas, no network call
        drawBackground(ctx, W, H, "purple");

        // Overlay

        const font = (size, weight = 700) =>
          `${weight} ${size}px ${GlobalFonts.has("Inter") ? "Inter" : "system-ui, -apple-system, Segoe UI, Roboto, Arial"}`;

        const roundRect = (x, y, w, h, r = 16) => {
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + w, y, x + w, y + h, r);
          ctx.arcTo(x + w, y + h, x, y + h, r);
          ctx.arcTo(x, y + h, x, y, r);
          ctx.arcTo(x, y, x + w, y, r);
          ctx.closePath();
        };

        const trunc = (str, max) => (str.length > max ? str.slice(0, max - 1) + "…" : str);
        const nf = (n) => n.toLocaleString();

        // Header
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = font(42, 800);
        ctx.textAlign = "left";
        ctx.fillText("AVATAR LEADERBOARD", 36, 68);

        ctx.font = font(22, 600);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText("Top 10 Rated Avatars", 36, 102);

        // Rows
        const startY = 140;
        const rowH = 52;
        const leftPad = 36;

        for (let i = 0; i < Math.min(10, data.length); i++) {
          const entry = data[i];

          let username = "Unknown";
          try {
            const member =
              interaction.guild.members.cache.get(entry.userId) ||
              (await interaction.guild.members.fetch(entry.userId).catch(() => null));
            if (member) username = member.user.username || member.displayName || "Unknown";
          } catch {}

          const y = startY + i * (rowH + 8);
          roundRect(leftPad - 4, y, W - leftPad * 2 + 8, rowH, 12);
          ctx.fillStyle = "rgba(255,255,255,0.12)";
          ctx.fill();

          // Rank pill
          const rankStr = String(i + 1).padStart(2, "0");
          roundRect(leftPad + 4, y + 8, 56, rowH - 16, 10);
          ctx.fillStyle = i < 3 ? "rgba(255,215,0,0.9)" : "rgba(255,255,255,0.2)";
          ctx.fill();

          ctx.fillStyle = i < 3 ? "#1a1a1a" : "white";
          ctx.font = font(22, 800);
          ctx.textAlign = "center";
          ctx.fillText(rankStr, leftPad + 32, y + rowH / 2 + 8);

          // Username
          ctx.textAlign = "left";
          ctx.fillStyle = "white";
          ctx.font = font(22, 700);
          ctx.fillText(`@${trunc(username, 24)}`, leftPad + 76, y + rowH / 2 + 8);

          // Rating
          ctx.textAlign = "right";
          ctx.font = font(18, 600);
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          const stats = `${entry.avg.toFixed(1)}% (${entry.count} rating${entry.count > 1 ? "s" : ""})`;
          ctx.fillText(stats, W - leftPad, y + rowH / 2 + 8);
        }

        return canvas.toBuffer("image/png");
      };

      try {
        const initialPng = await renderLeaderboard(sorted);
        const attachment = new AttachmentBuilder(initialPng, { name: "avatar_leaderboard.png" });
        await interaction.reply({ files: [attachment] });
      } catch (err) {
        console.error("[avatarrate] renderLeaderboard failed:", err.message);
        await interaction.reply({ content: "Failed to generate leaderboard. Please try again.", ephemeral: true }).catch(() => {});
      }
    }
  },
};