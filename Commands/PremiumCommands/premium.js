const { parseEmoji, InteractionContextType } = require('discord.js');
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ComponentType,
} = require('discord.js');
const LemonSqueezy = require('../../Utils/lemonSqueezy');
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_not_configured');
const Premium = require('../../Schemas/premiumUserSchema');
const PremiumGuild = require('../../Schemas/premiumGuildSchema');
const { TIERS, TIER_ORDER, getTier, tierFromDoc } = require('../../Utils/premiumTiers');

// ─── Stripe Checkout URL builder ─────────────────────────────────────────────

async function createCheckoutSession({ priceId, discordUserId, discordGuildId, billing }) {
    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.DASHBOARD_URL}/stripe/success`,
        cancel_url:  `${process.env.DASHBOARD_URL}/stripe/cancel`,
        metadata: {
            discord_user_id:  discordUserId,
            discord_guild_id: discordGuildId ?? '',
            price_id:         priceId,
        },
        custom_fields: [
            { key: 'discord_user_id',  label: { type: 'custom', custom: 'Your Discord User ID' },  type: 'text', optional: false },
            { key: 'discord_guild_id', label: { type: 'custom', custom: 'Server ID (optional)' }, type: 'text', optional: true  },
        ],
        allow_promotion_codes: true,
        subscription_data: {
            metadata: {
                discord_user_id:  discordUserId,
                discord_guild_id: discordGuildId ?? '',
            },
        },
    });
    return session.url;
}

// ─── Embed builders ──────────────────────────────────────────────────────────

function buildPricingEmbed() {
    const embed = new EmbedBuilder()
        .setTitle('<:boost:1567796953599836280> RankCore Premium Plans')
        .setDescription(
            'Unlock the full power of RankCore for your server.\n' +
            'All plans support **monthly** or **yearly** billing.\n' +
            '> *Yearly saves up to 30% compared to monthly!*'
        )
        .setColor(0xa855f7)
        .addFields(
            {
                name: '<:boost:1567796953599836280> Basic — €2.99/mo  ·  €24.99/yr',
                value: [
                    '→ Anti-Nuke, Anti-Raid & Advanced Automod',
                    '→ 24/7 Music (no filters)',
                    '→ 15 Autoresponders & Custom Commands',
                    '→ Welcome & Goodbye Card Images',
                    '→ YouTube & Twitch Notifications (×3 each)',
                    '→ Priority queue for music',
                ].join('\n'),
                inline: false,
            },
            {
                name: '<:eco:1567796967197900842> Pro — €5.99/mo  ·  €49.99/yr',
                value: [
                    '→ **Everything in Basic**',
                    '→ Music Filters (Bass, 8D, Nightcore…)',
                    '→ AI Chatbot & Image Generation',
                    '→ VirusTotal Link Scanner',
                    '→ Mass Ban & Mass Role commands',
                    '→ 50 Custom Commands & Autoresponders',
                    '→ YouTube & Twitch Notifications (×10 each)',
                ].join('\n'),
                inline: false,
            },
            {
                name: '<:1430986209995526274:1567796911350747206> Elite — €12.99/mo  ·  €99.99/yr',
                value: [
                    '→ **Everything in Pro**',
                    '→ **Custom Branding** — your own bot name, avatar & colours',
                    '→ Unlimited commands, autoresponders, playlists & backups',
                    '→ Unlimited YouTube & Twitch notifications',
                    '→ Priority support from the RankCore team',
                ].join('\n'),
                inline: false,
            }
        )
        .setFooter({ text: 'Choose a plan below • Cancellable anytime' })
        .setTimestamp();
    return embed;
}

function buildStatusEmbed(userDoc, guildDoc) {
    const uTier  = tierFromDoc(userDoc);
    const gTier  = tierFromDoc(guildDoc);
    const uCfg   = getTier(uTier);
    const gCfg   = getTier(gTier);
    const color  = uCfg.color !== 0x5c5c5c ? uCfg.color : gCfg.color;

    // Lifetime grants are stored as +100 years
    const fmtExpiry = (d) => !d ? 'N/A'
        : new Date(d) - Date.now() > 50 * 365 * 86400000 ? 'Lifetime'
        : `<t:${Math.floor(new Date(d) / 1000)}:D>`;
    const uExpiry = fmtExpiry(userDoc?.premium?.expiresAt);
    const gExpiry = fmtExpiry(guildDoc?.premium?.expiresAt);

    return new EmbedBuilder()
        .setTitle('<:eco:1567796967197900842> Your Premium Status')
        .setColor(color === 0x5c5c5c ? 0x3b82f6 : color)
        .addFields(
            {
                name: '<:user:1567797032423264261> Personal Premium',
                value: uTier === 'free'
                    ? '`Not active` — subscribe with the button below!'
                    : `${uCfg.emoji} **${uCfg.name}** · Expires ${uExpiry}`,
                inline: false,
            },
            {
                name: '<:n_home:1567796990148878446> Server Premium',
                value: gTier === 'free'
                    ? '`Not active` — a plan with a server slot unlocks server-wide features!'
                    : `${gCfg.emoji} **${gCfg.name}** · Expires ${gExpiry}`,
                inline: false,
            },
            {
                name: '<:dot:1567796963624226826> How server premium works',
                value:
                    'When you subscribe with a Server ID, all members in that server get access to premium features automatically — no per-user purchase needed.',
                inline: false,
            }
        )
        .setTimestamp();
}

// ─── Command ─────────────────────────────────────────────────────────────────

module.exports = {
    data: new SlashCommandBuilder()
        .setName('premium')
        .setContexts(InteractionContextType.Guild)
        .setDescription('View plans, subscribe, or check your premium status')
        .addSubcommand(sub =>
            sub.setName('plans').setDescription('Browse premium plans and pricing')
        )
        .addSubcommand(sub =>
            sub.setName('status').setDescription('Check your current premium status')
        )
        .addSubcommand(sub =>
            sub.setName('subscribe')
                .setDescription('Subscribe to a premium plan')
                .addStringOption(opt =>
                    opt.setName('plan')
                        .setDescription('Choose your plan')
                        .setRequired(true)
                        .addChoices(
                            { name: '<:boost:1567796953599836280> Basic  —  €2.99/mo', value: 'basic_monthly' },
                            { name: '<:boost:1567796953599836280> Basic  —  €24.99/yr (save 30%)', value: 'basic_yearly' },
                            { name: '<:eco:1567796967197900842> Pro    —  €5.99/mo', value: 'pro_monthly' },
                            { name: '<:eco:1567796967197900842> Pro    —  €49.99/yr (save 30%)', value: 'pro_yearly' },
                            { name: '<:1430986209995526274:1567796911350747206> Elite  —  €12.99/mo', value: 'elite_monthly' },
                            { name: '<:1430986209995526274:1567796911350747206> Elite  —  €99.99/yr (save 36%)', value: 'elite_yearly' },
                        )
                )
                .addBooleanOption(opt =>
                    opt.setName('server')
                        .setDescription('Also upgrade this server? (all members benefit)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('perks').setDescription('See what perks each tier unlocks')
        )
        .addSubcommand(sub =>
            sub.setName('manage').setDescription('Manage your subscription, cancel, or update billing')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        // ── /premium plans ────────────────────────────────────────────────────
        if (sub === 'plans' || sub === 'perks') {
            const embed = buildPricingEmbed();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Get Basic').setEmoji(parseEmoji('<:boost:1567796953599836280>'))
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${process.env.DASHBOARD_URL}/premium`),
                new ButtonBuilder()
                    .setLabel('Get Pro').setEmoji(parseEmoji('<:eco:1567796967197900842>'))
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${process.env.DASHBOARD_URL}/premium`),
                new ButtonBuilder()
                    .setLabel('Get Elite').setEmoji(parseEmoji('<:1430986209995526274:1567796911350747206>'))
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${process.env.DASHBOARD_URL}/premium`),
            );
            return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        // ── /premium status ───────────────────────────────────────────────────
        if (sub === 'status') {
            const [userDoc, guildDoc] = await Promise.all([
                Premium.findOne({ id: interaction.user.id }),
                interaction.guildId ? PremiumGuild.findOne({ id: interaction.guildId }) : null,
            ]);

            const embed = buildStatusEmbed(userDoc, guildDoc);

            const uTier = tierFromDoc(userDoc);
            const gTier = tierFromDoc(guildDoc);
            const hasAny = uTier !== 'free' || gTier !== 'free';

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel(hasAny  ? 'Upgrade Plan' : 'Get Premium').setEmoji(parseEmoji(hasAny  ? '<:arrow:1567796951527850055>' : '<:boost:1567796953599836280>'))
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${process.env.DASHBOARD_URL}/premium`),
                new ButtonBuilder()
                    .setLabel('View Perks').setEmoji(parseEmoji('<:files:1567796970964394044>'))
                    .setCustomId('premium_view_perks')
                    .setStyle(ButtonStyle.Secondary),
            );

            return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        // ── /premium manage ──────────────────────────────────────────────────
        if (sub === 'manage') {
            const dashUrl = process.env.DASHBOARD_URL;
            const embed = new EmbedBuilder()
                .setTitle('<:n_utils:1567796996830658573> Manage Your Subscription')
                .setColor(0x8b5cf6)
                .setDescription(
                    'Manage your RankCore Premium subscription, update payment details, or cancel — all from the Stripe billing portal.'
                )
                .addFields(
                    { name: '<:1430986225493479485:1567796921681055824> Dashboard',       value: `[View Premium Page](${dashUrl}/premium)`, inline: true },
                    { name: '<:Currency:1567796932041121873> Billing Portal',  value: `[Open Stripe Portal](${dashUrl}/premium)`, inline: true },
                    { name: '<:n_utils:1567796996830658573> Custom Branding', value: `[Manage Branding](${dashUrl}/premium/branding)`, inline: true },
                )
                .setFooter({ text: 'Changes take effect immediately' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Open Billing Portal')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${dashUrl}/premium`),
                new ButtonBuilder()
                    .setLabel('Premium Page')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${dashUrl}/premium`),
            );
            return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        // ── /premium subscribe ────────────────────────────────────────────────
        if (sub === 'subscribe') {
            const planChoice  = interaction.options.getString('plan');   // e.g. 'pro_monthly'
            const withServer  = interaction.options.getBoolean('server') ?? false;
            const [tierKey, billing] = planChoice.split('_');            // 'pro', 'monthly'

            // Map plan choice to Stripe Price ID
            const priceEnvKey = `STRIPE_PRICE_${tierKey.toUpperCase()}_${billing.toUpperCase()}`;
            const priceId     = process.env[priceEnvKey];

            const useLemon = LemonSqueezy.isConfigured();
            const provider = useLemon ? 'Lemon Squeezy' : 'Stripe';
            if (!useLemon && !priceId) {
                // No payment provider yet — premium is handed out as codes through the support server
                return interaction.reply({
                    content:
                        '<:premium:1567797001473622066> Online payments aren\'t available yet.\n' +
                        `Open a ticket in the [RankCore support server](${process.env.SUPPORT_URL || 'https://discord.gg/a9Kea3ymC7'}) to get a premium code, ` +
                        'then activate it with `/redeem code:ROCO-XXXX-XXXX-XXXX`.',
                    ephemeral: true,
                });
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                const checkoutUrl = useLemon
                    ? await LemonSqueezy.createCheckout({
                        plan:    planChoice,
                        userId:  interaction.user.id,
                        guildId: withServer ? interaction.guildId : null,
                    })
                    : await createCheckoutSession({
                        priceId,
                        discordUserId:  interaction.user.id,
                        discordGuildId: withServer ? interaction.guildId : null,
                        billing,
                    });

                const tierCfg = getTier(tierKey);
                const embed = new EmbedBuilder()
                    .setTitle(`${tierCfg.emoji} Subscribe to ${tierCfg.name}`)
                    .setColor(tierCfg.color)
                    .setDescription(
                        `Click the button below to complete your secure checkout via **${provider}**.\n\n` +
                        `> <:lockk:1567796977809367122> Payments are handled securely by ${provider}. RankCore never sees your card details.\n\n` +
                        (withServer
                            ? `<a:tickyy:1567797045253644368> This subscription will also upgrade **this server** — all members will benefit!`
                            : `<:n_info:1567796991419744417> Want to upgrade your whole server too? Use \`/premium subscribe\` with **server: True**.`)
                    )
                    .addFields(
                        { name: 'Plan',     value: `${tierCfg.emoji} ${tierCfg.name}`,              inline: true },
                        { name: 'Billing',  value: billing === 'yearly' ? '<:calendar:1567796954640158770> Yearly (save ~30%)' : '<:calendar:1567796954640158770> Monthly', inline: true },
                        { name: 'Price',    value: tierCfg.priceDisplay?.[billing] ?? 'See checkout', inline: true },
                    )
                    .setFooter({ text: `Link expires in ${useLemon ? 60 : 30} minutes • Cancellable anytime` })
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('Complete Checkout').setEmoji(parseEmoji('<:n_add:1567796983408754731>'))
                        .setStyle(ButtonStyle.Link)
                        .setURL(checkoutUrl),
                );

                return interaction.editReply({ embeds: [embed], components: [row] });
            } catch (err) {
                console.error('[Premium] Checkout session error:', err);
                return interaction.editReply({
                    content: '<:crossy:1567796959648030831> There was an error creating your checkout session. Please try again or contact support.',
                });
            }
        }
    },
};
