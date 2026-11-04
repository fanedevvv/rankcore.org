const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { RequestLog, ExcludedUser } = require("../../Schemas/requestlogs");
const axios = require("axios");

const WEBHOOK_URL = process.env.REQUESTLOGWEBHOOK;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("privacy")
    .setDescription("Manage your request log privacy")
    .addSubcommand(cmd => cmd.setName("delete").setDescription("Delete all your request log data"))
    .addSubcommand(cmd => cmd.setName("stop").setDescription("Stop logging future requests"))
    .addSubcommand(cmd => cmd.setName("resume").setDescription("Resume logging requests")),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const embedColor = client.config?.embedColor || 0x5865F2;

    const sendEmbed = async (title, description, color = embedColor) => {
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
      return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    };

    try {
      switch (sub) {
        case "delete":
          // Find all logs for this user
          const logs = await RequestLog.find({ userId });

          // Delete Discord webhook messages
          for (const log of logs) {
            if (log.webhookMessageId) {
              try {
                await axios.delete(`${WEBHOOK_URL}/messages/${log.webhookMessageId}`);
              } catch (err) {
  console.error(
    `Failed to delete webhook message ${log.webhookMessageId}:`,
    err.response?.data || err.message
  );
}
            }
          }

          // Delete MongoDB logs
          const deleted = await RequestLog.deleteMany({ userId });

          await sendEmbed(
            "<:del:1555544395720302643> Data Purged",
            `Successfully deleted **${deleted.deletedCount}** log entries and Discord webhook messages.`
          );
          break;

        case "stop":
          await ExcludedUser.findOneAndUpdate({ userId }, { userId }, { upsert: true });
          if (!client.blockedLogs) client.blockedLogs = new Set();
          client.blockedLogs.add(userId);

          await sendEmbed(
            "<:restrict:1555544549105999962> Logging Disabled",
            "Future requests will **not** be logged.",
            0xffa500
          );
          break;

        case "resume":
          await ExcludedUser.deleteOne({ userId });
          client.blockedLogs?.delete(userId);

          await sendEmbed(
            "<a:tickyy:1555544712687915008> Logging Resumed",
            "Your requests will now be logged again.",
            0x00ff00
          );
          break;
      }
    } catch (err) {
      console.error("Privacy Command Error:", err);
      const errorEmbed = new EmbedBuilder()
        .setTitle("<:error:1555544434601369620> Database Error")
        .setDescription("An error occurred while processing your privacy request.")
        .setColor(0xff0000);

      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  },
};