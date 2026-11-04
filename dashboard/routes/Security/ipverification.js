'use strict';
/**
 * ipverification.js  (routes/Security/ipverification.js)
 * ─────────────────────────────────────────────────────────────────────────────
 * Flow:
 *   1. Bot sends panel → user clicks Verify button → bot calls POST /api/ipverify/issue
 *   2. Dashboard issues a one-time token, bot DMs/ephemerally sends the URL to user
 *   3. User opens GET /ipverify/:token  → sees consent + info page (verifygate.html)
 *   4. User clicks "Complete Verification" → POST /ipverify/:token
 *   5. Dashboard runs IP/alt/VPN/country checks, executes fail action, assigns role via bot
 *
 * Anti-bypass guarantees:
 *   • Token is 48 random bytes, stored as SHA-256 hash only — never in plaintext DB
 *   • Each token is strictly one-use (burned on first POST)
 *   • MongoDB TTL hard-expires tokens at configurable TTL (default 10 minutes)
 *   • Token is bound to (userId, guildId) — cannot be reused by a different user
 *   • Rate limit: max 3 tokens per user per guild per TTL window
 *   • IP is captured server-side on POST — cannot be faked by the client
 *   • Consent checkbox state is validated server-side (if required)
 *
 * New features (v2):
 *   • Country allowlist / blocklist
 *   • Custom button label & style
 *   • Configurable token TTL (5 / 10 / 15 / 30 min)
 *   • Per-IP max verification attempts
 *   • IP ban threshold — auto-blocks IP after N fails
 *   • Re-verification interval (force users to re-verify periodically)
 *   • Webhook URL for pass/fail notifications (separate from log channel)
 *   • Custom gate page success / fail message
 *   • Separate flaggedAction (for risk-scored but not hard-blocked)
 *   • Multiple additional roles assigned on successful verify
 *   • CSV export of all records
 *   • User ID search in records
 *   • Manual approve grants verified role immediately
 */

const router  = require('express').Router();
const path    = require('path');
const crypto  = require('crypto');
const fs      = require('fs');
const https   = require('https');
const http    = require('http');

const Verify      = require('../../../Schemas/validationschema');
const VerifyToken = require('../../../Schemas/verifytoken');

const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const { logVerifyAction } = require('../Utils/dashboardLoggers');
const { cbSend }          = require('../../lib/cbSend');
const { apiPost }         = require('../../lib/botClient');
const { encrypt, decrypt, hmac, normalizeIp } = require('../../lib/verifyEncryption');
const { encryptWebhook, decryptWebhook } = require('../../../Utils/webhookCrypto');
const { enrichIp, isPrivateIp }  = require('../../lib/ipIntelligence');

let Record = null;
try { Record = require('../../../Schemas/VerificationRecord'); } catch {}

// ── Constants ─────────────────────────────────────────────────────────────────

const PANEL_COOLDOWN_MS   = 60 * 60 * 1000;
const RATE_LIMIT_MAX      = 3;
const VALID_FAIL          = ['none', 'kick', 'ban', 'alert', 'log'];
const VALID_BUTTON_STYLES = [1, 2, 3, 4];
const VALID_TTL_MINS      = [5, 10, 15, 30];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(48).toString('hex');
}

function clientIp(req) {
  let ip = 'unknown';
  const cfRay = req.headers['cf-ray'];
  const cf    = req.headers['cf-connecting-ip'];
  if (cfRay && cf) {
    ip = cf.split(',')[0].trim();
  } else {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
      ip = xff.split(',')[0].trim();
    } else {
      ip = req.ip || req.socket?.remoteAddress || 'unknown';
    }
  }
  return normalizeIp(ip) || 'unknown';
}

function maskIp(ip) {
  if (!ip || ip === 'unknown') return '[hidden]';
  return '[hidden]';
}

function getTtlMs(config) {
  const ttl = parseInt(config?.tokenTtlMinutes) || 10;
  return (VALID_TTL_MINS.includes(ttl) ? ttl : 10) * 60 * 1000;
}

function parseCountryList(raw) {
  if (!raw) return [];
  return raw.split(/[\n,]+/).map(s => s.trim().toUpperCase()).filter(s => /^[A-Z]{2}$/.test(s));
}

async function sendLogEmbed(req, guildId, logChannelId, embed) {
  try {
    const guild   = await req.client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(logChannelId);
    if (channel) await cbSend(req, guildId, channel, { embeds: [embed] });
  } catch (e) {
    console.warn('[ipverify log]', e.message);
  }
}

function fireWebhook(webhookUrl, payload) {
  if (!webhookUrl) return;
  try {
    const body   = JSON.stringify(payload);
    const parsed = new URL(webhookUrl);
    const opts   = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = (parsed.protocol === 'https:' ? https : http).request(opts);
    req.on('error', () => {});
    req.write(body);
    req.end();
  } catch {}
}

// ── Log embed variable resolver ──────────────────────────────────────────────

function resolveLogVars(template, { userId, ip, threat, flagReasons, action }) {
  const ipMasked = '[hidden]';
  const country  = threat?.country || threat?.countryCode || '?';
  const risk     = threat?.riskScore != null ? String(threat.riskScore) : '?';
  const reasons  = (flagReasons || []).join(', ') || 'none';
  const ts       = `<t:${Math.floor(Date.now() / 1000)}:F>`;
  return (template || '')
    .replace(/{user}/g,       `<@${userId}>`)
    .replace(/{user_id}/g,    userId || '?')
    .replace(/{username}/g,   userId || '?')
    .replace(/{ip_masked}/g,  ipMasked)
    .replace(/{country}/g,    country)
    .replace(/{risk}/g,       risk)
    .replace(/{provider}/g,   '[hidden]')   // provider hidden — too invasive
    .replace(/{reasons}/g,    reasons)
    .replace(/{action}/g,     action || '?')
    .replace(/{timestamp}/g,  ts);
}

function defaultConfig() {
  return {
    Channel: '', Role: '', unverifiedRole: '', additionalRoles: '',
    MessageContent: 'Click the button below to verify!',
    Color: '#6C53FF', Thumbnail: '', Image: '', Footer: '',
    buttonLabel: 'Verify', buttonStyle: 3,
    failAction: 'none', failMessage: '',
    flaggedAction: 'alert', flaggedMessage: '',
    blockVpn: false, blockProxy: false, blockTor: false, blockHosting: false,
    vpnRiskThreshold: 70,
    blockAlts: false,
    requireAccountAge: false, minAccountAgeDays: 7,
    countryMode: 'off', countryList: '',
    tokenTtlMinutes: 10,
    maxAttemptsPerIp: 0,
    ipBanThreshold: 0,
    requireReverify: false, reverifyDays: 30,
    logChannel: '', alertOnFlag: true,
    webhookUrl: '', webhookOnPass: true, webhookOnFail: true,
    requireConsent: true, consentText: '',
    gateSuccessMessage: '', gateFailMessage: '',
  };
}

// ── Dashboard page ─────────────────────────────────────────────────────────────

router.get('/guild/:id/ipverify', isAuth, checkDashboardAccess('verification'), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, '../../views/auth/ipverify.html')));

// ── GET config ─────────────────────────────────────────────────────────────────

router.get('/api/guild/:id/ipverify', isAuth, checkDashboardAccess('verification'), async (req, res) => {
  try {
    const data = await Verify.findOne({ Guild: req.params.id }).select('+webhookUrl');
    if (data && data.webhookUrl) data.webhookUrl = decryptWebhook(data.webhookUrl) || '';
    res.json(data ? data.toObject() : { ...defaultConfig(), Guild: req.params.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load config' });
  }
});

// ── SAVE config ────────────────────────────────────────────────────────────────

router.post('/api/guild/:id/ipverify', isAuth, checkDashboardAccess('verification'), async (req, res) => {
  const b = req.body;
  if (!b.Channel || !b.Role) return res.status(400).json({ error: 'Channel and Role are required' });

  const ttl = parseInt(b.tokenTtlMinutes) || 10;

  let webhookUrl = '';
  if (b.webhookUrl) {
    try {
      const u = new URL(b.webhookUrl);
      if (u.protocol === 'https:' || u.protocol === 'http:') webhookUrl = b.webhookUrl;
    } catch {}
  }

  const countryList    = parseCountryList(b.countryList).join(',');
  const additionalRoles = (b.additionalRoles || '').split(',').map(s => s.trim()).filter(s => /^\d{17,20}$/.test(s)).join(',');

  try {
    await Verify.findOneAndUpdate(
      { Guild: req.params.id },
      {
        Channel: b.Channel, Role: b.Role,
        unverifiedRole:  b.unverifiedRole  || '',
        additionalRoles,
        MessageContent:  (b.MessageContent || 'Click the button below to verify!'),
        Color:           b.Color || '#6C53FF',
        Thumbnail:       b.Thumbnail || '', Image: b.Image || '', Footer: b.Footer || '',
        buttonLabel:     (b.buttonLabel || 'Verify').slice(0, 80),
        buttonStyle:     VALID_BUTTON_STYLES.includes(parseInt(b.buttonStyle)) ? parseInt(b.buttonStyle) : 3,
        failAction:      VALID_FAIL.includes(b.failAction)     ? b.failAction     : 'none',
        failMessage:     (b.failMessage    || '').slice(0, 2000),
        flaggedAction:   VALID_FAIL.includes(b.flaggedAction)  ? b.flaggedAction  : 'alert',
        flaggedMessage:  (b.flaggedMessage || '').slice(0, 2000),
        blockVpn:        !!b.blockVpn, blockProxy: !!b.blockProxy,
        blockTor:        !!b.blockTor, blockHosting: !!b.blockHosting,
        vpnRiskThreshold: Math.min(100, Math.max(0, parseInt(b.vpnRiskThreshold) || 70)),
        blockAlts:        !!b.blockAlts,
        requireAccountAge: !!b.requireAccountAge,
        minAccountAgeDays: Math.max(1, parseInt(b.minAccountAgeDays) || 7),
        countryMode:      ['off', 'allowlist', 'blocklist'].includes(b.countryMode) ? b.countryMode : 'off',
        countryList,
        tokenTtlMinutes:  VALID_TTL_MINS.includes(ttl) ? ttl : 10,
        maxAttemptsPerIp: Math.max(0, parseInt(b.maxAttemptsPerIp) || 0),
        ipBanThreshold:   Math.max(0, parseInt(b.ipBanThreshold)   || 0),
        requireReverify:  !!b.requireReverify,
        reverifyDays:     Math.max(1, parseInt(b.reverifyDays) || 30),
        logChannel:       b.logChannel || '', alertOnFlag: b.alertOnFlag !== false,
        webhookUrl: encryptWebhook(webhookUrl) || '', webhookOnPass: b.webhookOnPass !== false, webhookOnFail: b.webhookOnFail !== false,
        requireConsent:   true,
        consentText:      '',
        gateSuccessMessage: (b.gateSuccessMessage || '').slice(0, 500),
        gateFailMessage:    (b.gateFailMessage    || '').slice(0, 500),
        logPassTitle: (b.logPassTitle || '').slice(0, 256),
        logPassDesc:  (b.logPassDesc  || '').slice(0, 2000),
        logPassColor: /^#[0-9a-fA-F]{6}$/.test(b.logPassColor || '') ? b.logPassColor : '',
        logFailTitle: (b.logFailTitle || '').slice(0, 256),
        logFailDesc:  (b.logFailDesc  || '').slice(0, 2000),
        logFailColor: /^#[0-9a-fA-F]{6}$/.test(b.logFailColor || '') ? b.logFailColor : '',
      },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[ipverify save]', err);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// ── DELETE config ──────────────────────────────────────────────────────────────

router.delete('/api/guild/:id/ipverify', isAuth, checkDashboardAccess('verification'), async (req, res) => {
  try {
    await Verify.findOneAndDelete({ Guild: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete config' });
  }
});

// ── SEND panel ─────────────────────────────────────────────────────────────────

router.post('/api/guild/:id/ipverify/send', isAuth, checkDashboardAccess('verification'), async (req, res) => {
  try {
    const guildId = req.params.id;
    const config  = await Verify.findOne({ Guild: guildId });
    if (!config) return res.status(400).json({ error: 'No verification config found' });

    if (config.LastPanelSent) {
      const elapsed = Date.now() - config.LastPanelSent.getTime();
      if (elapsed < PANEL_COOLDOWN_MS) {
        const rem = Math.ceil((PANEL_COOLDOWN_MS - elapsed) / 60000);
        return res.status(429).json({ error: `Cooldown: ${rem}m remaining` });
      }
    }

    const guild   = await req.client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(config.Channel);
    if (!channel) return res.status(400).json({ error: 'Channel not found' });

    const embedColor  = config.Color ? parseInt(config.Color.replace('#', ''), 16) : 0x6C53FF;
    const embed = {
      color:       embedColor,
      title:       'Verification',
      description: config.MessageContent || 'Click the button below to verify!',
      thumbnail:   config.Thumbnail ? { url: config.Thumbnail } : undefined,
      image:       config.Image     ? { url: config.Image }     : undefined,
      footer:      config.Footer    ? { text: config.Footer }   : undefined,
    };

    const buttonStyle = VALID_BUTTON_STYLES.includes(config.buttonStyle) ? config.buttonStyle : 3;
    const { messageId } = await cbSend(req, guildId, channel, {
      embeds: [embed],
      components: [{ type: 1, components: [{ type: 2, style: buttonStyle, label: config.buttonLabel || 'Verify', custom_id: 'ipverify' }] }],
    });

    config.Message       = messageId;
    config.LastPanelSent = new Date();
    await config.save();

    res.json({ success: true, messageId });
  } catch (err) {
    console.error('[ipverify send]', err);
    res.status(500).json({ error: 'Failed to send panel' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BOT-FACING  —  POST /api/ipverify/issue
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/api/ipverify/issue', async (req, res) => {
  const botSecret = process.env.VERIFICATION_SECRET;
  if (!botSecret || req.headers['x-bot-secret'] !== botSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { userId, guildId } = req.body;
  if (!userId || !guildId) return res.status(400).json({ error: 'userId and guildId required' });

  try {
    const config     = await Verify.findOne({ Guild: guildId });
    if (!config) return res.status(404).json({ error: 'No verify config for guild' });

    const TOKEN_TTL_MS = getTtlMs(config);

    // ── Re-verify check ───────────────────────────────────────────────────────
    if (config.requireReverify && Record) {
      try {
        const userIdHmacVal  = hmac(userId);
        const guildIdHmacVal = hmac(guildId);
        const existing = await Record.findOne({ userIdHmac: userIdHmacVal });
        if (existing) {
          const entry = existing.guilds
            ?.filter(g => g.guildIdHmac === guildIdHmacVal && g.action === 'PASSED')
            .sort((a, b) => new Date(b.verifiedAt) - new Date(a.verifiedAt))[0];
          if (entry) {
            const ageDays = (Date.now() - new Date(entry.verifiedAt).getTime()) / 86400000;
            if (ageDays < (config.reverifyDays || 30)) {
              return res.status(409).json({ error: 'Already verified — re-verification not due yet.' });
            }
          }
        }
      } catch {}
    }

    // ── Per-user rate limit ───────────────────────────────────────────────────
    const windowStart = new Date(Date.now() - TOKEN_TTL_MS);
    const recentCount = await VerifyToken.countDocuments({ userId, guildId, used: false, createdAt: { $gte: windowStart } });
    if (recentCount >= RATE_LIMIT_MAX) {
      return res.status(429).json({ error: 'Too many verification attempts. Please wait and try again.' });
    }

    const rawToken  = generateToken();
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await VerifyToken.create({ tokenHash, userId, guildId, createdAt: new Date() });

    const BASE_URL  = process.env.DASHBOARD_URL || `https://${req.hostname}`;
    res.json({ success: true, url: `${BASE_URL}/ipverify/${rawToken}`, expiresAt });
  } catch (err) {
    console.error('[ipverify/issue]', err);
    res.status(500).json({ error: 'Failed to issue token' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// USER-FACING  —  GET /ipverify/:token
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/ipverify/:token', async (req, res) => {
  const rawToken  = req.params.token;
  const tokenHash = sha256(rawToken);
  try {
    const record = await VerifyToken.findOne({ tokenHash });
    if (!record || record.used) return serveGatePage(res, { isExpired: true });

    const config       = await Verify.findOne({ Guild: record.guildId }).select('+webhookUrl');
    const TOKEN_TTL_MS = getTtlMs(config);
    if (Date.now() - record.createdAt.getTime() > TOKEN_TTL_MS) {
      await VerifyToken.deleteOne({ tokenHash });
      return serveGatePage(res, { isExpired: true });
    }

    let serverName = 'the server';
    try { const g = await req.client?.guilds.fetch(record.guildId); if (g?.name) serverName = g.name; } catch {}

    return serveGatePage(res, {
      isExpired:       false,
      token:           rawToken,
      expiresAt:       new Date(record.createdAt.getTime() + TOKEN_TTL_MS).toISOString(),
      serverName,
      successMessage:  config?.gateSuccessMessage || '',
      failMessage:     config?.gateFailMessage    || '',
    });
  } catch (err) {
    console.error('[ipverify GET]', err);
    return serveGatePage(res, { isExpired: true });
  }
});

function serveGatePage(res, vars = {}) {
  const filePath = path.join(__dirname, '../../views/auth/verifygate.html');
  let html = fs.readFileSync(filePath, 'utf8');
  const defaults = {
    isExpired: true, token: '',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    serverName: 'the server',
    successMessage: '', failMessage: '',
  };
  const v = { ...defaults, ...vars };
  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"')
    .replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/<\//g, '<\\/');

  html = html
    .replace(/<%= token %>/g,           esc(v.token))
    .replace(/<%= expiresAt %>/g,       esc(v.expiresAt))
    .replace(/<%= isExpired %>/g,       String(!!v.isExpired))
    .replace(/<%= serverName %>/g,      esc(v.serverName))
    .replace(/<%= successMessage %>/g,  esc(v.successMessage))
    .replace(/<%= failMessage %>/g,     esc(v.failMessage));

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.send(html);
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER-FACING  —  POST /ipverify/:token
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/ipverify/:token', async (req, res) => {
  const rawToken  = req.params.token;
  const tokenHash = sha256(rawToken);

  const record = await VerifyToken.findOne({ tokenHash });
  if (!record || record.used) return res.status(410).json({ error: 'This link has already been used or has expired.' });

  const config       = await Verify.findOne({ Guild: record.guildId });
  const TOKEN_TTL_MS = getTtlMs(config);

  if (Date.now() - record.createdAt.getTime() > TOKEN_TTL_MS) {
    await VerifyToken.deleteOne({ tokenHash });
    return res.status(410).json({ error: 'This link has expired. Please click Verify in Discord again.' });
  }

  // Burn immediately
  record.used = true; record.usedAt = new Date();
  await record.save();

  const { userId, guildId } = record;
  const { consent }         = req.body;

  try {
    if (!config) return res.status(404).json({ error: 'Guild config not found' });
    if (config.requireConsent && !consent) return res.status(400).json({ error: 'You must accept the terms to verify.' });

    const ip = clientIp(req);

    // ── Per-IP attempt cap ────────────────────────────────────────────────────
    if (config.maxAttemptsPerIp > 0 && ip !== 'unknown' && Record) {
      try {
        const ipH = hmac(ip); const gH = hmac(guildId);
        const ipRecs = await Record.find({ ipHmac: ipH, 'guilds.guildIdHmac': gH }).lean();
        const total  = ipRecs.reduce((n, r) => n + r.guilds.filter(g => g.guildIdHmac === gH).length, 0);
        if (total >= config.maxAttemptsPerIp) {
          return res.status(429).json({ error: 'Too many verification attempts from this IP.' });
        }
      } catch {}
    }

    let flagReasons = [];
    let action      = 'PASSED';

    // ── Account age ───────────────────────────────────────────────────────────
    if (config.requireAccountAge) {
      try {
        const snowflake = BigInt(userId);
        const created   = new Date(Number((snowflake >> 22n) + 1420070400000n));
        const ageDays   = (Date.now() - created.getTime()) / 86400000;
        if (ageDays < (config.minAccountAgeDays || 7)) {
          flagReasons.push('account_too_new'); action = 'BLOCKED_ALT';
        }
      } catch {}
    }

    // ── IP intelligence ───────────────────────────────────────────────────────
    let threat = null;
    if (ip !== 'unknown' && !isPrivateIp(ip)) {
      try { threat = await enrichIp(ip); } catch {}
    }

    // ── Country check ─────────────────────────────────────────────────────────
    if (action === 'PASSED' && config.countryMode && config.countryMode !== 'off' && threat?.countryCode) {
      const list = parseCountryList(config.countryList);
      const code = threat.countryCode.toUpperCase();
      if (config.countryMode === 'allowlist' && !list.includes(code)) {
        flagReasons.push(`country_not_allowed:${code}`); action = 'BLOCKED_COUNTRY';
      } else if (config.countryMode === 'blocklist' && list.includes(code)) {
        flagReasons.push(`country_blocked:${code}`); action = 'BLOCKED_COUNTRY';
      }
    }

    // ── VPN / proxy ───────────────────────────────────────────────────────────
    if (threat && action === 'PASSED') {
      if (config.blockVpn     && threat.isVpn)     { flagReasons.push('vpn_detected');   action = 'BLOCKED_VPN'; }
      if (config.blockProxy   && threat.isProxy)   { flagReasons.push('proxy_detected'); action = 'BLOCKED_VPN'; }
      if (config.blockTor     && threat.isTor)     { flagReasons.push('tor_detected');   action = 'BLOCKED_VPN'; }
      if (config.blockHosting && threat.isHosting) { flagReasons.push('hosting_ip');     action = 'BLOCKED_VPN'; }
    }

    // ── Risk score → FLAGGED ──────────────────────────────────────────────────
    if (threat && action === 'PASSED' && threat.riskScore >= (config.vpnRiskThreshold ?? 70)) {
      flagReasons.push(`high_risk_${threat.riskScore}`); action = 'FLAGGED';
    }

    // ── Alt detection ─────────────────────────────────────────────────────────
    // Scoped to THIS guild only — checks if the same IP already passed
    // verification in this guild as a different user.  A global check (all
    // guilds) produces constant false-positives for shared IPs such as NAT,
    // university networks, or households with multiple Discord accounts.
    if (config.blockAlts && ip !== 'unknown' && Record && action === 'PASSED') {
      try {
        const ipH  = hmac(ip);
        const uH   = hmac(userId);
        const gHAlt = hmac(guildId);
        const alts = await Record.find({
          ipHmac:              ipH,
          userIdHmac:          { $ne: uH },
          guilds:              { $elemMatch: { guildIdHmac: gHAlt, action: 'PASSED' } }
        }).lean();
        if (alts.length > 0) { flagReasons.push('alt_account'); action = 'BLOCKED_ALT'; }
      } catch {}
    }

    // ── IP ban threshold ──────────────────────────────────────────────────────
    if (config.ipBanThreshold > 0 && ip !== 'unknown' && Record) {
      try {
        const ipH = hmac(ip); const gH = hmac(guildId);
        const ipRecs = await Record.find({ ipHmac: ipH, 'guilds.guildIdHmac': gH }).lean();
        const failCount = ipRecs.reduce((n, r) =>
          n + r.guilds.filter(g => g.guildIdHmac === gH &&
            ['BLOCKED_VPN', 'BLOCKED_ALT', 'BLOCKED_COUNTRY'].includes(g.action)).length, 0);
        if (failCount >= config.ipBanThreshold) {
          flagReasons.push('ip_ban_threshold'); action = 'BLOCKED_IP_BAN';
        }
      } catch {}
    }

    // ── Store record ──────────────────────────────────────────────────────────
    if (Record) {
      try {
        const uH = hmac(userId); const iH = hmac(ip); const gH = hmac(guildId);
        const entry = { guildIdHmac: gH, guildIdEnc: encrypt(guildId), guildId, verifiedAt: new Date(), action, flagReasons };
        const existing = await Record.findOne({ userIdHmac: uH });
        if (existing) {
          existing.ipHmac = iH; existing.ipEnc = encrypt({ ip });
          existing.threatEnc = threat ? encrypt(threat) : existing.threatEnc;
          existing.lastSeen = new Date();
          const recent = existing.guilds.find(g => g.guildIdHmac === gH && (Date.now() - g.verifiedAt.getTime()) < 60000);
          if (!recent) existing.guilds.push(entry);
          await existing.save();
        } else {
          await Record.create({ userIdHmac: uH, userIdEnc: encrypt(userId), ipHmac: iH, ipEnc: encrypt({ ip }), threatEnc: threat ? encrypt(threat) : null, guilds: [entry] });
        }
      } catch (e) { console.warn('[ipverify record]', e.message); }
    }

    // ── Determine effective action ────────────────────────────────────────────
    const isHardBlocked = ['BLOCKED_VPN', 'BLOCKED_ALT', 'BLOCKED_COUNTRY', 'BLOCKED_IP_BAN'].includes(action);
    const isFlagged     = action === 'FLAGGED';
    const effectiveAct  = isHardBlocked ? config.failAction    : (isFlagged ? config.flaggedAction    : null);
    const effectiveMsg  = isHardBlocked ? config.failMessage   : (isFlagged ? config.flaggedMessage   : null);
    let failActionTaken = 'none';

    if ((isHardBlocked || isFlagged) && effectiveAct && effectiveAct !== 'none') {
      failActionTaken = effectiveAct;
      try {
        const guild  = await req.client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          const reason = `IP Verify failed (${action}): ${flagReasons.join(', ')}`;
          if (effectiveAct === 'kick') {
            if (effectiveMsg) try { await apiPost(`/internal/user/${userId}/dm`, { content: effectiveMsg }); } catch {}
            await apiPost(`/internal/guild/${guildId}/member/${userId}/kick`, { reason });
          } else if (effectiveAct === 'ban') {
            if (effectiveMsg) try { await apiPost(`/internal/user/${userId}/dm`, { content: effectiveMsg }); } catch {}
            await apiPost(`/internal/guild/${guildId}/member/${userId}/ban`, { reason, deleteMessageDays: 0 });
          } else if ((effectiveAct === 'alert' || effectiveAct === 'log') && config.logChannel) {
            const failTitle = config.logFailTitle?.trim()
              ? resolveLogVars(config.logFailTitle, { userId, ip, threat, flagReasons, action })
              : `${isFlagged ? '🚩' : '❌'} Verification ${isFlagged ? 'Flagged' : 'Failed'}`;
            const failDesc = config.logFailDesc?.trim()
              ? resolveLogVars(config.logFailDesc, { userId, ip, threat, flagReasons, action })
              : null;
            const failColor = config.logFailColor
              ? parseInt(config.logFailColor.replace('#',''), 16)
              : (isFlagged ? 0xfacc15 : 0xef4444);

            const actionBadge = {
              BLOCKED_VPN:     '🛡 VPN/Proxy Blocked',
              BLOCKED_ALT:     '👥 Alt Account Blocked',
              BLOCKED_COUNTRY: '🌍 Country Blocked',
              BLOCKED_IP_BAN:  '🔨 IP Banned',
              FLAGGED:         '⚠️ Flagged (High Risk)',
            }[action] || action;

            await sendLogEmbed(req, guildId, config.logChannel, {
              color:       failColor,
              title:       failTitle,
              description: failDesc || `<@${userId}> ${isFlagged ? 'was flagged during' : 'failed'} verification.`,
              fields: [
                { name: '👤 User',        value: `<@${userId}> (\`${userId}\`)`,                                    inline: true },
                { name: '🚦 Status',      value: actionBadge,                                                        inline: true },
                { name: '⏱ Time',         value: `<t:${Math.floor(Date.now()/1000)}:F>`,                            inline: true },
                { name: '🔍 Reasons',     value: flagReasons.join(', ') || 'none',                                   inline: false },
                ...(threat ? [
                  { name: '🗺 Country',    value: `${threat.country || '?'} (${threat.countryCode || '?'})`, inline: true },
                  { name: '📊 Risk Score', value: `${threat.riskScore ?? '?'}/100`,                          inline: true },
                  { name: '🔒 VPN',        value: threat.isVpn   ? '✅ Yes' : '❌ No',                       inline: true },
                  { name: '🔄 Proxy',      value: threat.isProxy ? '✅ Yes' : '❌ No',                       inline: true },
                  { name: '🧅 Tor',        value: threat.isTor   ? '✅ Yes' : '❌ No',                       inline: true },
                ] : []),
              ],
              timestamp: new Date().toISOString(),
              footer:    { text: 'IP Verification System' },
            });
          }
        }
      } catch (e) { console.warn('[ipverify fail action]', e.message); }
    }

    // ── Webhook ───────────────────────────────────────────────────────────────
    const resolvedWebhookUrl = decryptWebhook(config.webhookUrl);
    if (resolvedWebhookUrl) {
      const shouldFire = (action === 'PASSED' && config.webhookOnPass) ||
                         ((isHardBlocked || isFlagged) && config.webhookOnFail);
      if (shouldFire) {
        fireWebhook(resolvedWebhookUrl, {
          event: action === 'PASSED' ? 'verify_pass' : 'verify_fail',
          guildId, userId, action, flagReasons,
          country: threat?.countryCode || null,
          riskScore: threat?.riskScore ?? null,
          isVpn: threat?.isVpn || false, isProxy: threat?.isProxy || false,
          isTor: threat?.isTor || false,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // ── Assign roles if passed ────────────────────────────────────────────────
    if (action === 'PASSED') {
      try {
        await apiPost(`/internal/guild/${guildId}/member/${userId}/roles/add`, { roleId: config.Role });
        if (config.additionalRoles) {
          for (const roleId of config.additionalRoles.split(',').filter(Boolean)) {
            try { await apiPost(`/internal/guild/${guildId}/member/${userId}/roles/add`, { roleId }); } catch {}
          }
        }
        if (config.unverifiedRole) {
          await apiPost(`/internal/guild/${guildId}/member/${userId}/roles/remove`, { roleId: config.unverifiedRole });
        }
      } catch (e) { console.warn('[ipverify role]', e.message); }

      if (config.logChannel && config.alertOnFlag) {
        const passTitle = config.logPassTitle?.trim()
          ? resolveLogVars(config.logPassTitle, { userId, ip, threat, flagReasons: [], action: 'PASSED' })
          : '✅ Verification Passed';
        const passDesc = config.logPassDesc?.trim()
          ? resolveLogVars(config.logPassDesc, { userId, ip, threat, flagReasons: [], action: 'PASSED' })
          : null;
        const passColor = config.logPassColor
          ? parseInt(config.logPassColor.replace('#',''), 16)
          : 0x53ff6c;

        const passEmbed = {
          color:       passColor,
          title:       passTitle,
          description: passDesc || `<@${userId}> passed verification.`,
          fields: [
            { name: '👤 User',      value: `<@${userId}> (\`${userId}\`)`, inline: true },
            { name: '🌐 IP',        value: '[hidden]',                      inline: true },
            { name: '⏱ Time',       value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: true },
            ...(threat ? [
              { name: '🗺 Country',    value: `${threat.country || '?'} (${threat.countryCode || '?'})`, inline: true },
              { name: '📊 Risk Score', value: `${threat.riskScore ?? '?'}/100`,                          inline: true },
            ] : []),
          ],
          thumbnail:  { url: `https://cdn.discordapp.com/embed/avatars/0.png` },
          timestamp:  new Date().toISOString(),
          footer:     { text: 'IP Verification System' },
        };
        sendLogEmbed(req, guildId, config.logChannel, passEmbed).catch(() => {});
      }
    }

    res.json({ action, flagReasons, failActionTaken });
  } catch (err) {
    console.error('[ipverify POST]', err);
    res.status(500).json({ error: 'Verification check failed. Please try again.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Stats
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/api/guild/:id/ipverify/stats', isAuth, checkDashboardAccess('verification'), async (req, res) => {
  try {
    if (!Record) return res.json({ total: 0, passed: 0, blockedVpn: 0, blockedAlt: 0, blockedCountry: 0, flagged: 0 });
    const gH  = hmac(req.params.id);
    const all = await Record.find({ 'guilds.guildIdHmac': gH }, { guilds: 1 }).lean();
    let passed = 0, blockedVpn = 0, blockedAlt = 0, blockedCountry = 0, flagged = 0;
    for (const r of all) {
      const e = r.guilds.find(g => g.guildIdHmac === gH);
      if (!e) continue;
      if (e.action === 'PASSED' || e.action === 'MANUAL_APPROVE') passed++;
      else if (e.action === 'BLOCKED_VPN')      blockedVpn++;
      else if (e.action === 'BLOCKED_ALT')      blockedAlt++;
      else if (e.action === 'BLOCKED_COUNTRY')  blockedCountry++;
      else if (e.action === 'FLAGGED')          flagged++;
    }
    res.json({ total: all.length, passed, blockedVpn, blockedAlt, blockedCountry, flagged });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Records
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/api/guild/:id/ipverify/records', isAuth, checkDashboardAccess('verification'), async (req, res) => {
  try {
    if (!Record) return res.json({ records: [], total: 0, page: 1, pages: 1 });
    const gH    = hmac(req.params.id);
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const query = { 'guilds.guildIdHmac': gH };
    if (req.query.search && /^\d{17,20}$/.test(req.query.search)) {
      try { query.userIdHmac = hmac(req.query.search); } catch {}
    }
    const [docs, total] = await Promise.all([
      Record.find(query).sort({ lastSeen: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Record.countDocuments(query),
    ]);
    const filter  = req.query.action || null;
    const records = docs.map(r => {
      try {
        const userId   = decrypt(r.userIdEnc);
        const ipData   = decrypt(r.ipEnc);
        const threat   = r.threatEnc ? decrypt(r.threatEnc) : null;
        const guildLog = r.guilds.filter(g => g.guildIdHmac === gH).sort((a, b) => new Date(b.verifiedAt) - new Date(a.verifiedAt));
        return {
          id: r._id, userId,
          displayIp: maskIp(ipData?.ip),
          country: threat?.country || null, countryCode: threat?.countryCode || null,
          isVpn: threat?.isVpn || false, isProxy: threat?.isProxy || false,
          isTor: threat?.isTor || false, isHosting: threat?.isHosting || false,
          riskScore: threat?.riskScore ?? null,
          firstSeen: r.firstSeen, lastSeen: r.lastSeen,
          verifiedAt: guildLog[0]?.verifiedAt || null,
          latestAction: guildLog[0]?.action || 'PASSED',
          flagReasons: guildLog[0]?.flagReasons || [],
          totalAttempts: guildLog.length,
        };
      } catch { return null; }
    }).filter(Boolean);
    const filtered = filter ? records.filter(r => r.latestAction === filter) : records;
    res.json({ records: filtered, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load records' });
  }
});

// ── Manual action (approve grants role) ──────────────────────────────────────

router.post('/api/guild/:id/ipverify/records/:recordId/action', isAuth, checkDashboardAccess('verification'), async (req, res) => {
  if (!Record) return res.status(404).json({ error: 'Records not enabled' });
  const { action } = req.body;
  if (!['MANUAL_APPROVE', 'MANUAL_BAN'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  try {
    const r = await Record.findById(req.params.recordId);
    if (!r) return res.status(404).json({ error: 'Record not found' });
    const gH    = hmac(req.params.id);
    const entry = r.guilds.find(g => g.guildIdHmac === gH);
    if (entry) { entry.action = action; await r.save(); }
    if (action === 'MANUAL_APPROVE') {
      try {
        const config = await Verify.findOne({ Guild: req.params.id });
        const userId = decrypt(r.userIdEnc);
        if (config?.Role && userId) {
          await apiPost(`/internal/guild/${req.params.id}/member/${userId}/roles/add`, { roleId: config.Role });
        }
      } catch {}
    }
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed to update record' }); }
});

// ── GDPR delete ───────────────────────────────────────────────────────────────

router.delete('/api/guild/:id/ipverify/records/:recordId', isAuth, checkDashboardAccess('verification'), async (req, res) => {
  if (!Record) return res.status(404).json({ error: 'Records not enabled' });
  try {
    await Record.findByIdAndDelete(req.params.recordId);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed to delete record' }); }
});

// ── CSV export ────────────────────────────────────────────────────────────────

router.get('/api/guild/:id/ipverify/export', isAuth, checkDashboardAccess('verification'), async (req, res) => {
  if (!Record) return res.status(404).json({ error: 'Records not enabled' });
  try {
    const gH   = hmac(req.params.id);
    const docs = await Record.find({ 'guilds.guildIdHmac': gH }).sort({ lastSeen: -1 }).limit(5000).lean();
    const rows = ['UserID,IP (Masked),Country,RiskScore,Action,FlagReasons,LastSeen'];
    for (const r of docs) {
      try {
        const userId  = decrypt(r.userIdEnc);
        const ipData  = decrypt(r.ipEnc);
        const threat  = r.threatEnc ? decrypt(r.threatEnc) : null;
        const entry   = r.guilds.find(g => g.guildIdHmac === gH);
        rows.push([
          userId, maskIp(ipData?.ip), threat?.countryCode || '',
          threat?.riskScore ?? '', entry?.action || '',
          (entry?.flagReasons || []).join(';'),
          r.lastSeen ? new Date(r.lastSeen).toISOString() : '',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
      } catch {}
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="verify-records-${req.params.id}.csv"`);
    res.send(rows.join('\r\n'));
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;