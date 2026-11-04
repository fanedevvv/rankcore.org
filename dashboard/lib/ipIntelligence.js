'use strict';
/**
 * ipIntelligence.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Enriches an IP address with VPN/proxy/hosting/Tor signals and a risk score.
 *
 * PRIMARY:  ip-api.com  (free tier: 1000 req/min, no key needed)
 * FALLBACK: vpnapi.io   (set VPNAPI_KEY env var for 1000 req/day free tier)
 *
 * The result is NEVER stored in plaintext — callers must encrypt it with
 * verifyEncryption.encrypt() before persisting.
 */

const https = require('https');
const http  = require('http');

const IPAPI_TIMEOUT  = 4000; // ms
const VPNAPI_TIMEOUT = 4000;

// ── Simple HTTP GET helper ────────────────────────────────────────────────────

function fetchJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('JSON parse error')); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error',   reject);
  });
}

// ── ip-api.com enrichment ─────────────────────────────────────────────────────

/**
 * Returns:
 * {
 *   ip, country, countryCode, region, city, org, asn, isp,
 *   isProxy, isHosting, isTor, isVpn,
 *   lat, lon, timezone, riskScore
 * }
 */
async function queryIpApi(ip) {
  // Fields: status,message,country,countryCode,region,regionName,city,
  //         lat,lon,timezone,isp,org,as,proxy,hosting,query
  const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,city,lat,lon,timezone,isp,org,as,proxy,hosting,query`;

  const d = await fetchJson(url, IPAPI_TIMEOUT);
  if (d.status !== 'success') throw new Error(d.message || 'ip-api error');

  const isProxy   = !!d.proxy;
  const isHosting = !!d.hosting;
  const isTor     = false; // ip-api free tier doesn't include Tor; vpnapi does
  // ip-api.com proxy field has high false-positive rate on residential/mobile IPs.
  // Treat proxy-only as moderate risk so admins must explicitly enable blockProxy.
  let riskScore = 0;
  if (isProxy)   riskScore = Math.max(riskScore, 30);
  if (isHosting) riskScore = Math.max(riskScore, 50);

  return {
    ip:          d.query,
    country:     d.country     || null,
    countryCode: d.countryCode || null,
    region:      d.region      || null,
    city:        d.city        || null,
    isp:         d.isp         || null,
    org:         d.org         || null,
    asn:         d.as          || null,
    lat:         d.lat         || null,
    lon:         d.lon         || null,
    timezone:    d.timezone    || null,
    isVpn:       false, // ip-api.com cannot reliably distinguish VPN from proxy
    isProxy,
    isHosting,
    isTor,
    provider:    d.isp         || d.org || null,
    riskScore,
    source:      'ip-api',
  };
}

// ── vpnapi.io enrichment (optional, higher accuracy) ─────────────────────────

async function queryVpnApi(ip) {
  const key = process.env.VPNAPI_KEY;
  if (!key) return null;

  const url = `https://vpnapi.io/api/${encodeURIComponent(ip)}?key=${key}`;
  const d   = await fetchJson(url, VPNAPI_TIMEOUT);

  const sec = d.security || {};
  let riskScore = 0;
  if (sec.vpn)     riskScore = Math.max(riskScore, 80);
  if (sec.proxy)   riskScore = Math.max(riskScore, 75);
  if (sec.tor)     riskScore = Math.max(riskScore, 90);
  if (sec.relay)   riskScore = Math.max(riskScore, 65);

  const loc = d.location || {};
  return {
    ip:          d.ip,
    country:     loc.country      || null,
    countryCode: loc.country_code || null,
    region:      loc.region       || null,
    city:        loc.city         || null,
    isp:         d.network?.autonomous_system_organization || null,
    org:         d.network?.autonomous_system_organization || null,
    asn:         d.network?.autonomous_system_number ? `AS${d.network.autonomous_system_number}` : null,
    lat:         loc.latitude  || null,
    lon:         loc.longitude || null,
    timezone:    loc.time_zone || null,
    isVpn:       !!sec.vpn,
    isProxy:     !!sec.proxy,
    isTor:       !!sec.tor,
    isHosting:   !!sec.relay,
    provider:    d.network?.autonomous_system_organization || null,
    riskScore,
    source:      'vpnapi',
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Enriches `ip` with VPN/proxy/threat intelligence.
 * Falls back gracefully if APIs are unavailable.
 *
 * @param {string} ip - normalised IP address
 * @returns {Promise<object>} threat intelligence object (not yet encrypted)
 */
async function enrichIp(ip) {
  // Try vpnapi first (more accurate) if key is set
  if (process.env.VPNAPI_KEY) {
    try {
      const vpn = await queryVpnApi(ip);
      if (vpn) return vpn;
    } catch (e) {
      console.warn('[ipIntelligence] vpnapi failed, falling back to ip-api:', e.message);
    }
  }

  // Fallback to ip-api
  try {
    return await queryIpApi(ip);
  } catch (e) {
    console.warn('[ipIntelligence] ip-api failed:', e.message);
    // Return a minimal safe object so the rest of the flow still works
    return {
      ip,
      country: null, countryCode: null, region: null, city: null,
      isp: null, org: null, asn: null, lat: null, lon: null, timezone: null,
      isVpn: false, isProxy: false, isTor: false, isHosting: false,
      provider: null, riskScore: 0, source: 'unavailable',
    };
  }
}

/**
 * Checks if a private/loopback/reserved IP should skip external lookup.
 */
function isPrivateIp(ip) {
  return (
    /^127\./.test(ip)           ||  // loopback
    /^10\./.test(ip)            ||  // RFC 1918
    /^192\.168\./.test(ip)      ||  // RFC 1918
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || // RFC 1918
    ip === '::1'                ||  // IPv6 loopback
    ip === 'localhost'
  );
}

module.exports = { enrichIp, isPrivateIp };