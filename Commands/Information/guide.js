'use strict';

const {
  SlashCommandBuilder, MessageFlags, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
} = require('discord.js');
const { parseEmoji } = require('../../Utils/emojis');
const { ACCENT } = require('../../Utils/v2helpers');

// ── Guide pages ───────────────────────────────────────────────────────────────
const PAGES = [
  {
    title: '<:files:1555544445565407352> Welcome to RankCore',
    color: ACCENT.default,
    content: [
      '**RankCore** is a feature-rich Discord bot built for server management, community tools, and fun.',
      '',
      '## <:boost:1555544362455146576> Getting Started',
      '> Use `/setup` to open the **RankCore Dashboard** and configure any feature.',
      '> Most setup is done through the dashboard — it\'s the fastest way to get going.',
      '',
      '## <:files:1555544445565407352> Pages in this guide',
      '`1` Welcome & Getting Started',
      '`2` Moderation & Safety',
      '`3` Community Features',
      '`4` Music',
      '`5` Staff Tools',
      '`6` Tickets & Applications',
      '`7` Games & Fun',
      '`8` Premium Plans',
    ].join('\n'),
  },
  {
    title: '<:restrict:1555544549105999962> Moderation & Safety',
    color: ACCENT.moderation,
    content: [
      '## Core Moderation',
      '`/ban` `/kick` `/timeout` `/warn` `/mute` — Standard mod actions with DM notifications and case logging.',
      '`/modcase` — View a user\'s full mod history.',
      '`/purge` — Bulk delete messages with filters.',
      '',
      '## AutoMod',
      '`/setup` → **AutoMod** — Configure anti-spam, anti-link, anti-raid, anti-nuke, and word filters.',
      'Advanced AutoMod (Pro+) adds AI-powered scam detection and pattern analysis.',
      '',
      '## Logging',
      '`/setup` → **Logging** — Log message edits/deletes, member joins/leaves, voice events, and more.',
      '',
      '## Anti-Nuke & Anti-Raid',
      'Protects your server from mass bans, mass channel deletes, and raid joins. Requires Basic+ plan.',
    ].join('\n'),
  },
  {
    title: '<:1430986225493479485:1555544207652032633> Community Features',
    color: ACCENT.info,
    content: [
      '## Leveling',
      '`/setup` → **Leveling** — XP-based leveling with level-up messages, role rewards, and a leaderboard (`/rank`, `/leaderboard`).',
      '',
      '## Autoresponders',
      '`/setup` → **Autoresponders** — Trigger responses to keywords. Supports embeds, buttons, and link buttons.',
      '',
      '## Reaction Roles',
      '`/setup` → **Reaction Roles** — Assign roles via emoji reactions or buttons.',
      '',
      '## Suggestions',
      '`/setup` → **Suggestions** — Upvote/downvote suggestion system with thread support.',
      '',
      '## Welcome & Goodbye',
      '`/setup` → **Welcome** / **Goodbye** — Custom messages and card images on member join/leave.',
      '',
      '## QOTD (Question of the Day)',
      '`/qotd setup` — Post a daily question to a channel automatically.',
      '`/qotd add` — Add questions to the bank.',
    ].join('\n'),
  },
  {
    title: '<:n_music:1555544516746940416> Music',
    color: ACCENT.music,
    content: [
      '## Quick Start',
      '1. Join a voice channel',
      '2. Run `/music play <song name or URL>`',
      '3. RankCore will join and start playing!',
      '',
      '## Commands',
      '`/music play` — Play a song or playlist',
      '`/music pause` / `/music resume` — Pause/resume',
      '`/music skip` — Skip the current track',
      '`/music queue` — View the queue (paginated)',
      '`/music volume` — Set volume (0–100)',
      '`/music loop` — Loop track or queue',
      '`/music nowplaying` — View current track info',
      '`/music shuffle` — Shuffle the queue',
      '`/music 247` — Toggle 24/7 mode (Basic+)',
      '',
      '## Playlist Commands',
      '`/playlist create` — Create a saved playlist',
      '`/playlist play` — Load a saved playlist',
      '',
      '> <:n_music:1555544516746940416> Supports YouTube, Spotify, SoundCloud, and more.',
    ].join('\n'),
  },
  {
    title: '<:modd:1555544511210324030> Staff Tools',
    color: ACCENT.warning,
    content: [
      '## Staff Management',
      '`/promote` — Promote a staff member with an announcement and role change.',
      '`/infract` — Issue warnings, demotions, suspensions, or removals.',
      '`/staff-list view` — Display the full staff team with ratings.',
      '`/staff-list add-role` — Register a staff role for the list.',
      '',
      '## Staff Ratings',
      '`/staff-rating rate` — Rate a staff member (1–5 stars).',
      '`/staff-rating view` — View a staff member\'s ratings.',
      '`/staff-rating leaderboard` — Top rated staff leaderboard.',
      '`/staff-rating setup` — Configure the rating system.',
      '',
      '## Recovery Key',
      '`/recovery-key generate` — Generate a server recovery key (stored hashed, shown once).',
      '`/recovery-key use` — Use the key to verify identity in an emergency.',
      '`/recovery-key status` — Check key status and expiry.',
      '`/recovery-key revoke` — Invalidate the current key.',
    ].join('\n'),
  },
  {
    title: '<:gw:1555544456873119875> Tickets & Applications',
    color: ACCENT.setup,
    content: [
      '## Ticket System',
      '`/setup` → **Tickets** — Configure ticket categories, each with:',
      '• Custom submission channel and denied role',
      '• Up to **5 intake questions** (1 mandatory, 4 optional)',
      '• Auto-close, priority, and rating system',
      '',
      '## Staff Applications',
      'Set up application panels via the dashboard. Each panel supports:',
      '• Custom questions (editable in setup)',
      '• DM-based question flow — questions are sent to the applicant via DM, one by one',
      '• Accept/deny workflow with role assignment and announcements',
      '• Multiple panels per server (e.g. Mod app + Admin app)',
      '',
      '## Application Commands',
      '`/setup` → **Applications** — Open the dashboard to manage panels.',
    ].join('\n'),
  },
  {
    title: '<:minigames:1555544500179439707> Games & Fun',
    color: ACCENT.fun,
    content: [
      '## Multiplayer Games',
      '`/games-multiplayer game:Connect-4` — Connect 4 vs another user',
      '`/games-multiplayer game:Rock-Paper-Scissors` — RPS vs another user',
      '`/games-multiplayer game:Tic-Tac-Toe` — TicTacToe vs another user',
      '`/games-multiplayer game:Duel` — Text-based duel',
      '',
      '## Singleplayer Games',
      '`/games-singleplayer game:Guess-The-Number` — Number guessing',
      '`/games-singleplayer game:Emoji-Quiz` — Guess the emoji',
      '`/games-singleplayer game:Guess-The-Flag` — Name that flag',
      '`/games-singleplayer game:Hangman` — Classic hangman',
      '`/games-singleplayer game:Wordle` — Daily word puzzle',
      '`/games-singleplayer game:Trivia` — General knowledge trivia',
      '`/games-singleplayer game:Snake` — Snake game',
      '`/games-singleplayer game:2048` — 2048 puzzle',
      '',
      '## Other Fun',
      '`/uwulock` / `/catlock` — Lock a user into uwu or cat mode',
      '`/fun` — Jokes, 8ball, ship, and more',
      '`/rep` — Give reputation points to users',
    ].join('\n'),
  },
  {
    title: '<:1430986209995526274:1555544172302307449> Premium Plans',
    color: ACCENT.economy,
    content: [
      '## Tier Comparison',
      '',
      '**<:lockk:1555544494441635860> Free**',
      '10 autoresponders • 10 custom commands • 2 ticket categories • Welcome images',
      '',
      '**<:boost:1555544362455146576> RankCore Basic** — €2.99/mo',
      '25 autoresponders • Anti-Nuke/Raid • 24/7 Music • 5 playlists • Mass Role',
      '',
      '**<:eco:1555544429253890050> RankCore Pro** — €5.99/mo',
      '75 autoresponders • Music filters • AI Chatbot • Image gen • VirusTotal • 20 playlists',
      '',
      '**<:1430986209995526274:1555544172302307449> RankCore Elite** — €12.99/mo',
      '**Unlimited everything** • Unlimited connection roles • Priority support',
      '',
      '## How to Upgrade',
      'Visit the RankCore Dashboard → **Premium** tab, or use `/redeem` with a token.',
      '',
      '> Need help? Join our **[Support Server](https://discord.gg/a9Kea3ymC7)** and a staff member will assist you.',
    ].join('\n'),
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guide')
    .setDescription('Open the interactive RankCore guidebook.')
    .setDMPermission(true)
    .addIntegerOption(o => o
      .setName('page')
      .setDescription('Jump to a specific page (1–8).')
      .setMinValue(1).setMaxValue(PAGES.length).setRequired(false)
    ),

  async execute(interaction, client) {
    let currentPage = Math.max(0, (interaction.options.getInteger('page') ?? 1) - 1);

    const buildEmbed = (page) => {
      const p = PAGES[page];
      return new EmbedBuilder()
        .setColor(p.color)
        .setTitle(p.title)
        .setDescription(p.content)
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Page ${page + 1} of ${PAGES.length} • RankCore Guidebook` })
        .setTimestamp();
    };

    const buildRow = (page) => new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('guide_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
      new ButtonBuilder().setCustomId('guide_home').setLabel('​').setEmoji(parseEmoji('<:n_home:1555544468193546270>')).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('guide_next').setLabel('​').setEmoji(parseEmoji('<:n_music:1555544516746940416>')).setStyle(ButtonStyle.Secondary).setDisabled(page >= PAGES.length - 1),
      new ButtonBuilder().setLabel('Docs').setStyle(ButtonStyle.Link).setEmoji(parseEmoji('<:files:1555544445565407352>')).setURL('https://dash.rankcore.org/docs'),
      new ButtonBuilder().setLabel('Support').setStyle(ButtonStyle.Link).setEmoji(parseEmoji('<:n_utils:1555544669545431062>')).setURL('https://discord.gg/a9Kea3ymC7'),
    );

    const msg = await interaction.reply({
      embeds: [buildEmbed(currentPage)],
      components: [buildRow(currentPage)],
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({ time: 300_000 });

    collector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({ content: 'Use `/guide` to open your own copy!', flags: MessageFlags.Ephemeral });
      }
      if (btn.customId === 'guide_prev' && currentPage > 0) currentPage--;
      else if (btn.customId === 'guide_next' && currentPage < PAGES.length - 1) currentPage++;
      else if (btn.customId === 'guide_home') currentPage = 0;

      await btn.update({ embeds: [buildEmbed(currentPage)], components: [buildRow(currentPage)] });
    });

    collector.on('end', () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  },
};
