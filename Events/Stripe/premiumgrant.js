const { EmbedBuilder } = require('discord.js');
const PremiumUser  = require('../../Schemas/premiumUserSchema');
const PremiumGuild = require('../../Schemas/premiumGuildSchema');
const { PRICE_PLANS } = require('../../dashboard/webhooks/Stripe');
const { getTier } = require('../../Utils/premiumTiers');

function resolvePlan(priceId) {
    return PRICE_PLANS[priceId] ?? { name: 'Roco Basic', tier: 'basic', durationDays: 30, emoji: '<:boost:1555544362455146576>' };
}

async function grantUserPremium({ discordUserId, priceId, subscriptionId }) {
    const plan      = resolvePlan(priceId);
    const now       = new Date();
    const expiresAt = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    await PremiumUser.findOneAndUpdate(
        { id: discordUserId },
        {
            $set: {
                isPremium: true,
                'premium.redeemedAt':     now,
                'premium.expiresAt':      expiresAt,
                'premium.plan':           plan.name,
                'premium.tier':           plan.tier,
                'premium.subscriptionId': subscriptionId,
            },
            $addToSet: { 'premium.redeemedBy': subscriptionId },
        },
        { upsert: true, new: true }
    );

    return { plan, expiresAt };
}

async function grantGuildPremium({ discordGuildId, discordUserId, priceId, subscriptionId }) {
    const plan      = resolvePlan(priceId);
    const now       = new Date();
    const expiresAt = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    await PremiumGuild.findOneAndUpdate(
        { id: discordGuildId },
        {
            $set: {
                isPremiumGuild: true,
                'premium.redeemedAt':     now,
                'premium.expiresAt':      expiresAt,
                'premium.plan':           plan.name,
                'premium.tier':           plan.tier,
                'premium.subscriptionId': subscriptionId,
            },
            $addToSet: { 'premium.redeemedBy': discordUserId },
        },
        { upsert: true, new: true }
    );

    return { plan, expiresAt };
}

async function revokeUserPremium(discordUserId) {
    await PremiumUser.findOneAndUpdate(
        { id: discordUserId },
        { $set: { isPremium: false, 'premium.expiresAt': new Date(), 'premium.plan': null, 'premium.tier': null } }
    );
}

async function revokeGuildPremium(discordGuildId) {
    await PremiumGuild.findOneAndUpdate(
        { id: discordGuildId },
        { $set: { isPremiumGuild: false, 'premium.expiresAt': new Date(), 'premium.plan': null, 'premium.tier': null } }
    );
}

async function dmUser(client, discordUserId, embed) {
    try {
        const user = await client.users.fetch(discordUserId);
        await user.send({ embeds: [embed] });
    } catch { /* DMs disabled – ignore */ }
}

const TIER_COLORS = { basic: 0x3b82f6, pro: 0xa855f7, elite: 0xf59e0b };

module.exports = {
    name: 'premiumGrant',
    once: false,

    async execute(payload, client) {
        if (!payload || typeof payload !== 'object') {
            return console.error('[Premium] Invalid payload received — ignoring.');
        }

        const VALID_TYPES      = new Set(['grant', 'renew', 'revoke', 'upgrade']);
        const DISCORD_ID_REGEX = /^\d{17,20}$/;

        const { type, discordUserId, discordGuildId, priceId, subscriptionId } = payload;

        if (!VALID_TYPES.has(type)) return console.error(`[Premium] Unknown event type "${type}" — ignoring.`);
        if (!DISCORD_ID_REGEX.test(discordUserId)) return console.error(`[Premium] Invalid discordUserId "${discordUserId}" — ignoring.`);
        if (discordGuildId && !DISCORD_ID_REGEX.test(discordGuildId)) return console.error(`[Premium] Invalid discordGuildId "${discordGuildId}" — ignoring.`);
        if (typeof subscriptionId !== 'string' || !subscriptionId.startsWith('sub_')) return console.error(`[Premium] Invalid subscriptionId "${subscriptionId}" — ignoring.`);

        if (type === 'grant' || type === 'renew' || type === 'upgrade') {
            try {
                // Guild purchases: only write to PremiumGuild — no user-level premium.
                // User-only purchases (no guildId): write to PremiumUser.
                let plan, expiresAt;
                if (discordGuildId) {
                    ({ plan, expiresAt } = await grantGuildPremium({ discordGuildId, discordUserId, priceId, subscriptionId }));
                } else {
                    ({ plan, expiresAt } = await grantUserPremium({ discordUserId, priceId, subscriptionId }));
                }

                const tierCfg    = getTier(plan.tier);
                const actionVerb = type === 'renew' ? '<:n_add:1555544335036973106> Renewed' : type === 'upgrade' ? '<:arrow:1555544351118196810> Upgraded' : '<:boost:1555544362455146576> Activated';
                const color      = TIER_COLORS[plan.tier] ?? 0xf5a623;

                const embed = new EmbedBuilder()
                    .setTitle(`${actionVerb} — ${plan.emoji} ${plan.name}`)
                    .setColor(color)
                    .setDescription(
                        type === 'renew'
                            ? `Your **${plan.name}** subscription has been successfully renewed.`
                            : type === 'upgrade'
                            ? `Your subscription has been upgraded to **${plan.name}**! Enjoy your new perks.`
                            : `Welcome to **${plan.name}**! ${plan.emoji} Your perks are now active.`
                    )
                    .addFields(
                        { name: '<:files:1555544445565407352> Plan',    value: `${plan.emoji} ${plan.name} (${plan.label ?? ''})`, inline: true },
                        { name: '<:calendar:1555544372953616426> Expires', value: `<t:${Math.floor(expiresAt / 1000)}:D>`,            inline: true },
                        ...(discordGuildId
                            ? [{ name: '🏰 Server Premium', value: `Your server has also been upgraded to **${plan.name}**`, inline: false }]
                            : []),
                        { name: `${plan.emoji} Key Perks Unlocked`, value: getPerksList(plan.tier), inline: false }
                    )
                    .setFooter({ text: `Subscription ID: ${subscriptionId}` })
                    .setTimestamp();

                await dmUser(client, discordUserId, embed);

                console.log(`[Premium] ${type} → user ${discordUserId} (${plan.name})${discordGuildId ? ` | guild ${discordGuildId}` : ''}`);
            } catch (err) {
                console.error(`[Premium] Failed to ${type} premium for user ${discordUserId}:`, err);
            }

        } else if (type === 'revoke') {
            try {
                // Guild purchases revoke the guild doc; user-only purchases revoke the user doc.
                if (discordGuildId) {
                    await revokeGuildPremium(discordGuildId);
                } else {
                    await revokeUserPremium(discordUserId);
                }

                const embed = new EmbedBuilder()
                    .setTitle('<:crossy:1555544390221562048> Roco Premium Expired')
                    .setColor(0xe74c3c)
                    .setDescription(
                        'Your **Roco Premium** subscription has ended and your perks have been removed.\n\n' +
                        'You can resubscribe at any time using `/premium` to regain access.'
                    )
                    .setFooter({ text: `Subscription ID: ${subscriptionId}` })
                    .setTimestamp();

                await dmUser(client, discordUserId, embed);
                console.log(`[Premium] revoke → user ${discordUserId}${discordGuildId ? ` | guild ${discordGuildId}` : ''}`);
            } catch (err) {
                console.error(`[Premium] Failed to revoke premium for user ${discordUserId}:`, err);
            }
        }
    },
};

function getPerksList(tier) {
    const perks = {
        basic: '<a:tickyy:1555544712687915008> Anti-Nuke & Anti-Raid\n<a:tickyy:1555544712687915008> Advanced Automod\n<a:tickyy:1555544712687915008> 24/7 Music\n<a:tickyy:1555544712687915008> 15 Autoresponders\n<a:tickyy:1555544712687915008> YouTube & Twitch Notifications (×3)\n<a:tickyy:1555544712687915008> Welcome Card Images',
        pro:   '<a:tickyy:1555544712687915008> Everything in Basic\n<a:tickyy:1555544712687915008> Music Filters\n<a:tickyy:1555544712687915008> AI Chatbot\n<a:tickyy:1555544712687915008> Image Generation\n<a:tickyy:1555544712687915008> VirusTotal Scanner\n<a:tickyy:1555544712687915008> Mass Ban\n<a:tickyy:1555544712687915008> 50 Custom Commands\n<a:tickyy:1555544712687915008> YouTube & Twitch Notifs (×10)',
        elite: '<a:tickyy:1555544712687915008> Everything in Pro\n<a:tickyy:1555544712687915008> **Custom Branding** (your bot\'s name, avatar & colours)\n<a:tickyy:1555544712687915008> Unlimited Commands & Autoresponders\n<a:tickyy:1555544712687915008> Unlimited Backups & Playlists\n<a:tickyy:1555544712687915008> Priority Support',
    };
    return perks[tier] ?? 'Premium features';
}
