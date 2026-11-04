const Affix = require("../../Schemas/LinkAffixSchema");
const Config = require("../../Schemas/LinkConfigSchema");

module.exports = async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return; // ← Fix: ignore DMs (guild is null)

  const config = await Config.findOne({ guildId: message.guild.id });
  if (!config || !config.isEnabled) return;

  const affixes = await Affix.find({ guildId: message.guild.id });
  const AffixList = affixes.map((affix) => affix.affix.trim().toLowerCase());

  const messageContent = message.content.toLowerCase();

  let shouldDelete = false;
  let matchedAffix = "";

  for (const affix of AffixList) {
    if (messageContent.includes(affix)) {
      shouldDelete = true;
      matchedAffix = affix;
      break;
    }
  }

  if (shouldDelete) {
    try {
      await message.delete();
      const deleteMessage = await message.channel.send(
        `${message.author}, the message was deleted because you sent a link which is blocked.`
      );
      setTimeout(() => deleteMessage.delete(), 15 * 1000);
    } catch (error) {
      console.error(`Error deleting a message`, error);
    }
  }
};