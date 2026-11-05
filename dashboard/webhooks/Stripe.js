const express = require('express');
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_not_configured');
const router  = express.Router();

/**
 * PRICE_PLANS maps every Stripe Price ID → { name, tier, label, durationDays, emoji }
 *
 * Add your Stripe Price IDs to .env:
 *   STRIPE_PRICE_BASIC_MONTHLY=price_xxx
 *   STRIPE_PRICE_BASIC_YEARLY=price_xxx
 *   STRIPE_PRICE_PRO_MONTHLY=price_xxx
 *   STRIPE_PRICE_PRO_YEARLY=price_xxx
 *   STRIPE_PRICE_ELITE_MONTHLY=price_xxx
 *   STRIPE_PRICE_ELITE_YEARLY=price_xxx
 */
const PRICE_PLANS = {
    // ── Basic ─────────────────────────────────────────────────────────────────
    [process.env.STRIPE_PRICE_BASIC_MONTHLY]: {
        name: 'RankCore Basic', tier: 'basic', label: 'Monthly', durationDays: 30,  emoji: '⭐',
    },
    [process.env.STRIPE_PRICE_BASIC_YEARLY]: {
        name: 'RankCore Basic', tier: 'basic', label: 'Yearly',  durationDays: 365, emoji: '⭐',
    },
    // ── Pro ───────────────────────────────────────────────────────────────────
    [process.env.STRIPE_PRICE_PRO_MONTHLY]: {
        name: 'RankCore Pro',   tier: 'pro',   label: 'Monthly', durationDays: 30,  emoji: '💎',
    },
    [process.env.STRIPE_PRICE_PRO_YEARLY]: {
        name: 'RankCore Pro',   tier: 'pro',   label: 'Yearly',  durationDays: 365, emoji: '💎',
    },
    // ── Elite ─────────────────────────────────────────────────────────────────
    [process.env.STRIPE_PRICE_ELITE_MONTHLY]: {
        name: 'RankCore Elite', tier: 'elite', label: 'Monthly', durationDays: 30,  emoji: '👑',
    },
    [process.env.STRIPE_PRICE_ELITE_YEARLY]: {
        name: 'RankCore Elite', tier: 'elite', label: 'Yearly',  durationDays: 365, emoji: '👑',
    },
    // ── Custom Branding (per-guild, standalone) ──────────────────────────────
    [process.env.STRIPE_PRICE_BRANDING_MONTHLY]: {
        name: 'Custom Branding', tier: 'branding', label: 'Monthly', durationDays: 30,  emoji: '🎨', type: 'branding',
    },
    [process.env.STRIPE_PRICE_BRANDING_YEARLY]: {
        name: 'Custom Branding', tier: 'branding', label: 'Yearly',  durationDays: 365, emoji: '🎨', type: 'branding',
    },
    // ── Legacy single-plan (existing env vars kept for backwards compat) ──────
    [process.env.StripePriceID]: {
        name: 'RankCore Basic', tier: 'basic', label: 'Monthly', durationDays: 30,  emoji: '⭐',
    },
    [process.env.StripePriceIDYearly]: {
        name: 'RankCore Basic', tier: 'basic', label: 'Yearly',  durationDays: 365, emoji: '⭐',
    },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolvePlan(priceId) {
    return PRICE_PLANS[priceId] ?? { name: 'RankCore Basic', tier: 'basic', durationDays: 30, emoji: '⭐' };
}

/** Returns true if this price ID is for the standalone Custom Branding product */
function isBrandingPrice(priceId) {
    return PRICE_PLANS[priceId]?.type === 'branding';
}

// ── Static pages ──────────────────────────────────────────────────────────────

router.get('/success', (req, res) => {
    res.send(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Payment Successful – RankCore Premium</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050508;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff}.card{background:#16162a;border:1px solid #2e2e50;border-radius:16px;padding:48px 40px;text-align:center;max-width:440px;width:90%;box-shadow:0 0 60px rgba(124,77,255,.15)}.icon{font-size:56px;margin-bottom:20px}h1{font-size:1.8rem;margin-bottom:12px;color:#a78bfa}p{color:#9ca3af;line-height:1.6;margin-bottom:8px}.badge{display:inline-block;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:.8rem;font-weight:600;padding:4px 14px;border-radius:999px;margin-bottom:24px;letter-spacing:.05em;text-transform:uppercase}.info{background:#1e1e35;border-radius:10px;padding:16px 20px;margin-top:24px;font-size:.9rem;color:#c4b5fd;line-height:1.7}</style>
</head><body><div class="card"><div class="icon">🎉</div><div class="badge">✨ RankCore Premium</div><h1>You're all set!</h1><p>Your payment was successful and your premium perks are now active.</p><div class="info">Check your Discord DMs — the bot has sent you a confirmation.<br><br>You can close this tab.</div></div></body></html>`);
});

router.get('/cancel', (req, res) => {
    res.send(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Payment Cancelled – RankCore Premium</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050508;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff}.card{background:#16162a;border:1px solid #2e2e50;border-radius:16px;padding:48px 40px;text-align:center;max-width:440px;width:90%;box-shadow:0 0 60px rgba(239,68,68,.1)}.icon{font-size:56px;margin-bottom:20px}h1{font-size:1.8rem;margin-bottom:12px;color:#f87171}p{color:#9ca3af;line-height:1.6;margin-bottom:8px}.badge{display:inline-block;background:#2e2e50;color:#9ca3af;font-size:.8rem;font-weight:600;padding:4px 14px;border-radius:999px;margin-bottom:24px;letter-spacing:.05em;text-transform:uppercase}.info{background:#1e1e35;border-radius:10px;padding:16px 20px;margin-top:24px;font-size:.9rem;color:#9ca3af;line-height:1.7}</style>
</head><body><div class="card"><div class="icon">😕</div><div class="badge">Payment Cancelled</div><h1>No worries!</h1><p>You cancelled the checkout — you have not been charged.</p><div class="info">Whenever you're ready, use <strong>/premium</strong> in Discord to try again.<br><br>You can close this tab.</div></div></body></html>`);
});

// ── Stripe webhook (POST /) ───────────────────────────────────────────────────

module.exports = (client) => {
    router.post('/', async (req, res) => {
        const sig = req.headers['stripe-signature'];
        let event;

        try {
            event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            console.error('[Stripe] Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        try {
            switch (event.type) {

                case 'checkout.session.completed': {
                    const session = event.data.object;
                    if (session.mode !== 'subscription') break;

                    const fields = session.custom_fields ?? [];
                    const getField = (k) => fields.find(f => f.key === k)?.text?.value ?? null;

                    const discordUserId  = getField('discord_user_id')  || session.metadata?.discord_user_id  || null;
                    const discordGuildId = getField('discord_guild_id') || session.metadata?.discord_guild_id || null;
                    const priceId        = session.metadata?.price_id ?? null;

                    if (!discordUserId) {
                        console.warn('[Stripe] checkout.session.completed missing discord_user_id');
                        break;
                    }

                    await stripe.subscriptions.update(session.subscription, {
                        metadata: { discord_user_id: discordUserId, discord_guild_id: discordGuildId ?? '' },
                    });

                    const subscription = await stripe.subscriptions.retrieve(session.subscription);
                    if (subscription.metadata?.granted_via === 'subscription_created') break;

                    if (isBrandingPrice(priceId)) {
                        client.emit('brandingGrant', {
                            type: 'grant', discordUserId, discordGuildId,
                            priceId, subscriptionId: session.subscription, customerId: session.customer,
                        });
                    } else {
                        client.emit('premiumGrant', {
                            type: 'grant', discordUserId, discordGuildId,
                            priceId, subscriptionId: session.subscription, customerId: session.customer,
                        });
                    }
                    break;
                }

                case 'customer.subscription.created': {
                    const sub = event.data.object;
                    const discordUserId  = sub.metadata?.discord_user_id;
                    const discordGuildId = sub.metadata?.discord_guild_id ?? null;
                    const priceId        = sub.items.data[0]?.price?.id ?? null;

                    if (!discordUserId) {
                        console.warn('[Stripe] customer.subscription.created missing discord_user_id metadata');
                        break;
                    }

                    await stripe.subscriptions.update(sub.id, {
                        metadata: { ...sub.metadata, granted_via: 'subscription_created' },
                    });

                    if (isBrandingPrice(priceId)) {
                        client.emit('brandingGrant', {
                            type: 'grant', discordUserId, discordGuildId,
                            priceId, subscriptionId: sub.id, customerId: sub.customer,
                        });
                    } else {
                        client.emit('premiumGrant', {
                            type: 'grant', discordUserId, discordGuildId,
                            priceId, subscriptionId: sub.id, customerId: sub.customer,
                        });
                    }
                    break;
                }

                case 'invoice.payment_succeeded': {
                    const invoice = event.data.object;
                    if (invoice.billing_reason === 'subscription_create') break;

                    const sub = await stripe.subscriptions.retrieve(invoice.subscription);
                    const discordUserId  = sub.metadata?.discord_user_id;
                    const discordGuildId = sub.metadata?.discord_guild_id ?? null;
                    const priceId        = sub.items.data[0]?.price?.id ?? null;

                    if (!discordUserId) break;

                    if (isBrandingPrice(priceId)) {
                        client.emit('brandingGrant', {
                            type: 'renew', discordUserId, discordGuildId,
                            priceId, subscriptionId: sub.id, customerId: sub.customer,
                        });
                    } else {
                        client.emit('premiumGrant', {
                            type: 'renew', discordUserId, discordGuildId,
                            priceId, subscriptionId: sub.id, customerId: sub.customer,
                        });
                    }
                    break;
                }

                case 'customer.subscription.updated': {
                    // Handle plan upgrades/downgrades
                    const sub = event.data.object;
                    const discordUserId  = sub.metadata?.discord_user_id;
                    const discordGuildId = sub.metadata?.discord_guild_id ?? null;
                    const priceId        = sub.items.data[0]?.price?.id ?? null;

                    if (!discordUserId || sub.status !== 'active') break;

                    client.emit('premiumGrant', {
                        type: 'upgrade', discordUserId, discordGuildId,
                        priceId, subscriptionId: sub.id, customerId: sub.customer,
                    });
                    break;
                }

                case 'customer.subscription.deleted': {
                    const sub = event.data.object;
                    const discordUserId  = sub.metadata?.discord_user_id;
                    const discordGuildId = sub.metadata?.discord_guild_id ?? null;

                    if (!discordUserId) break;

                    const deletedPriceId = sub.items.data[0]?.price?.id ?? null;
                    if (isBrandingPrice(deletedPriceId)) {
                        client.emit('brandingGrant', {
                            type: 'revoke', discordUserId, discordGuildId,
                            priceId: deletedPriceId,
                            subscriptionId: sub.id, customerId: sub.customer,
                        });
                    } else {
                        client.emit('premiumGrant', {
                            type: 'revoke', discordUserId, discordGuildId,
                            priceId: deletedPriceId,
                            subscriptionId: sub.id, customerId: sub.customer,
                        });
                    }
                    break;
                }

                default:
                    break;
            }
        } catch (err) {
            console.error('[Stripe] Error processing webhook event:', err);
            return res.status(500).send('Internal error processing event');
        }

        res.json({ received: true });
    });

    return router;
};

module.exports.PRICE_PLANS = PRICE_PLANS;
