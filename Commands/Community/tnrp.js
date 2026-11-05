const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const { parseEmoji } = require('../../Utils/emojis');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('tnrp')
    .setDescription('Learn about Tennessee State Roleplay (TNRP)'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('<:n_home:1567796990148878446>️ Tennessee State Roleplay')
      .setDescription(
        '> **Welcome to Tennessee State Roleplay (TNRP)** — one of the most immersive and community-driven ER:LC roleplay experiences in the South.\n\n' +'Whether you\'re a seasoned roleplayer or just getting started, TNRP offers a realistic, whitelisted environment built around quality storytelling, authentic civilian life, law enforcement, emergency services, and much more.'
      )
      .setColor(0x003F7F) // Deep Tennessee blue
      .setThumbnail('https://rankcore.org/tnrp/logo.png') // Replace with actual logo if available
      .addFields(
        {
          name: '<:1430986225493479485:1567796921681055824> What is TNRP?',
          value: 'Tennessee State Roleplay is a dedicated ER:LC Roblox community set in the heart of Tennessee. We pride ourselves on realistic roleplay, active staff, and a welcoming community for all players.',
          inline: false,
        },
        {
          name: '<:restrict:1567797003638022166> Available Departments',
          value: '`Tennessee Highway Patrol` • `Sheriff\'s Office` • `Emergency Medical Services` • `Fire Department` • `Civilian Operations`',
          inline: false,
        },
        {
          name: '<a:tickyy:1567797045253644368> Features',
          value:
            '• Whitelisted & serious roleplay environment\n' +
            '• Custom vehicles, scripts & map additions\n' +
            '• Active & professional staff team\n' +
            '• Regular community events & updates\n' +
            '• Friendly & welcoming community',
          inline: false,
        },
        {name: '<:1430986227909263442:1567796922863984670> Quick Links',
          value:
            '**Discord:** [Join Our Server](https://discord.gg/AA5Abgxw3Z)\n' +
            '**Website:** [rankcore.org/tnrp](https://rankcore.org/tnrp)',
          inline: false,
        }
      )
      .setFooter({
        text: 'Tennessee State Roleplay • Serious RP | Quality Community',
        iconURL: 'https://rankcore.org/tnrp/logo.png', // Replace with actual icon if available
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Join Our Discord')
        .setURL('https://discord.gg/AA5Abgxw3Z')
        .setStyle(ButtonStyle.Link)
        .setEmoji(parseEmoji('<:announcement:1567796950265241662>')),
      new ButtonBuilder()
        .setLabel('Visit Website')
        .setURL('https://rankcore.org/tnrp')
        .setStyle(ButtonStyle.Link)
        .setEmoji(parseEmoji('<:1430986225493479485:1567796921681055824>'))
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
    });
  },
};