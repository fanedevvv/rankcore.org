const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const WEBHOOK_URL = process.env.GuildRemoveWebhook;
// main module
module.exports = {
  name:"guildDelete",
  async execute(guild,client){
    const owner = await guild.fetchOwner().catch(()=>null);

    // DM to owner
    if(owner){
      const embed = new EmbedBuilder()
        .setAuthor({name:client.user.username,iconURL:client.user.displayAvatarURL()})
        .setTitle("Sorry to see you go!")
        .setDescription(`Hey ${owner.user}, I noticed that **${client.user.username}** was removed from **${guild.name}**.\n\nIf this was a mistake, feel free to invite me back anytime!\n> <:1430986225493479485:1555544207652032633> Current Servers: ${client.guilds.cache.size}`)
        .setThumbnail(guild.iconURL({size:512})||client.user.displayAvatarURL())
        .setColor("#ED4245")
        .setFooter({text:"Thank you for trying RankCore 💕",iconURL:client.user.displayAvatarURL()});

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("Support Server").setStyle(ButtonStyle.Link).setURL("https://discord.gg/a9Kea3ymC7"),
        new ButtonBuilder().setLabel("Invite Me Again").setStyle(ButtonStyle.Link).setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`),
        new ButtonBuilder().setLabel("Vote on Top.gg").setStyle(ButtonStyle.Link).setURL(client.config?.topggURL || "https://top.gg/bot/960624234688811188")
      );

      owner.send({embeds:[embed],components:[row]}).catch(()=>{});
    }

    // webhook log
    const webhookEmbed = new EmbedBuilder()
      .setTitle(`Left server: ${guild.name}`)
      .setDescription(`**Owner:** ${owner?owner.user.tag:"Unknown"}\n**Members at removal:** ${guild.memberCount}\n**Online Members:** ${guild.members.cache.filter(m=>m.presence?.status!=="offline").size||"N/A"}\n**Boosts:** ${guild.premiumSubscriptionCount||0} (Level ${guild.premiumTier||0})\n**Verification Level:** ${guild.verificationLevel}\n**Server ID:** ${guild.id}\n**Created At:** ${guild.createdAt.toDateString()} (${Math.floor((Date.now()-guild.createdAt)/86400000)} days ago)\n**Partnered:** ${guild.partnered?"Yes":"No"} | **Verified:** ${guild.verified?"Yes":"No"}\n**Roles:** ${guild.roles.cache.size} | **Emojis:** ${guild.emojis.cache.size}\n\n> **Total Commands:** ${client.commands.size}\n> **Total Servers:** ${client.guilds.cache.size}`)
      .setThumbnail(guild.iconURL({dynamic:true,size:512})||client.user.displayAvatarURL())
      .setColor("#ED4245")
      .setFooter({text:`Bot left at ${new Date().toLocaleString()}`});

    // Optional join/leave log webhook (GuildRemoveWebhook in .env)
    if (WEBHOOK_URL) {
      fetch(WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({embeds:[webhookEmbed.toJSON()]})}).catch(console.error);
    }
  }
};
