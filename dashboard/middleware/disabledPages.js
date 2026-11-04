"use strict";

const path = require("path");

const DisabledPage = require("../../Schemas/DisabledPage");
const { sendHTMLWithNonce } = require("../middleware");

const CACHE_TTL = 5_000;
let _cache       = null;
let _cacheTime   = 0;

async function loadDisabled() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL) return _cache;
  try {
    _cache     = await DisabledPage.getAllDisabled();
    _cacheTime = now;
    return _cache;
  } catch {}
  _cache     = {};
  _cacheTime = now;
  return _cache;
}

const KEY_TO_BASE = {
  automod:         "/automod",
  advancedautomod: "/advancedautomod",
  antinuke:        "/antinuke",
  antiscam:        "/antiscam",
  massjoin:        "/massjoin",
  logs:            "/logs",
  welcome:         "/welcome",
  goodbye:         "/goodbye",
  booster:         "/booster",
  reactionrole:    "/reactionrole",
  sticky:          "/sticky",
  customcommands:  "/customcommands",
  embed:           "/embed",
  verify:          "/verify",
  leveling:        "/leveling",
  ticket:          "/ticket",
  confession:      "/confession",
  twitch:          "/twitch",
  youtube:         "/youtube",
  ai:              "/ai",
  music:           "/music",
  joinping:        "/joinping",
  jtc:             "/jtc",
  autoresponder:   "/autoresponder",
  autorole:        "/autorole",
  counting:        "/counting",
  uwulock:         "/uwulock",
  uptime:          "/uptime",
  transcript:      "/transcript",
  tools:           "/tools",
  changelogs:      "/changelogs",
  donate:          "/donate",
  docs:            "/docs",
  invite:          "/invite",
};

module.exports = async function disabledPages(req, res, next) {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api")) return next();
  if (req.path.startsWith("/auth")) return next();
  if (req.path === "/disabled") return next();

  const disabled = await loadDisabled();
  if (!Object.keys(disabled).length) return next();

  try {
    if (req.isAuthenticated?.() && req.user) {
      const getOwners = require("../Utils/getOwners");
      const devIDs = await getOwners();
      if (devIDs.includes(req.user.id)) return next();
    }
  } catch {}

  const reqPath = req.path.toLowerCase();

  for (const [key, info] of Object.entries(disabled)) {
    if (!info) continue;
    const base = KEY_TO_BASE[key];
    if (!base) continue;

    const seg = base.toLowerCase();
    const matches =
      reqPath === seg ||
      reqPath.startsWith(seg + "/") ||
      reqPath.startsWith(seg + "?") ||
      (() => {
        const idx = reqPath.indexOf(seg);
        if (idx === -1) return false;
        const after = reqPath[idx + seg.length];
        return !after || after === "/" || after === "?";
      })();

    if (matches) {
      const reasonParam = info.reason
        ? "?reason=" + encodeURIComponent(info.reason)
        : "";
      return res.redirect("/disabled" + reasonParam);
    }
  }

  next();
};
