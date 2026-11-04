const router = require("express").Router();
const passport = require("passport");
const path = require("path");
const crypto = require("crypto");
const config = require("../../../src/config/bot");
const { sendHTMLWithNonce } = require("../../middleware");

function isSafeRedirect(url) {
  if (!url || typeof url !== "string") return false;
  // Must start with / but NOT // (protocol-relative = external)
  return /^\/[^/\\]/.test(url) || url === "/";
}

function saveReturnTo(req, res, next) {
  if (!req.user && req.originalUrl &&
      !req.originalUrl.startsWith("/login") &&
      !req.originalUrl.startsWith("/callback")) {
    req.session.returnTo = req.originalUrl;
  }
  next();
}

router.get("/", (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect("/servers");
  }
  return res.redirect("/welcome");
});

router.get("/login", (req, res) => {
  const nonce = crypto.randomBytes(16).toString("hex");

  // Carry the returnTo destination through the OAuth round-trip by encoding
  // it into the state parameter. The session may be replaced by the time
  // /callback fires, so we can't rely on req.session.returnTo surviving.
  const returnTo = req.session.returnTo || "";
  const statePayload = `${nonce}:${returnTo}`;
  const state = Buffer.from(statePayload).toString("base64url");

  req.session.oauthState = nonce; // only store the nonce for CSRF validation

  const redirectUri = encodeURIComponent(`${config.dashboard.domain}/callback`);
  const oauthUrl =
    `https://discord.com/oauth2/authorize` +
    `?response_type=code` +
    `&client_id=${process.env.clientId}` +
    `&scope=identify%20guilds` +
    `&redirect_uri=${redirectUri}` +
    `&state=${encodeURIComponent(state)}`;

  // MUST save the session before redirecting — with a MongoDB-backed store the
  // write is async.  If we redirect immediately the session may not be flushed
  // yet, so oauthState is missing when Discord hits /callback and the state
  // check fails, sending the user back to / with no feedback.
  req.session.save((err) => {
    if (err) {
      console.error("[LOGIN] Session save failed:", err);
      return res.redirect("/");
    }
    res.redirect(oauthUrl);
  });
});

router.get(
  "/callback",
  (req, res, next) => {
    // Decode the state parameter: format is base64url("nonce:returnTo")
    let stateNonce = req.query.state;
    let returnTo = "";

    try {
      const decoded = Buffer.from(stateNonce || "", "base64url").toString("utf8");
      const colonIdx = decoded.indexOf(":");
      if (colonIdx !== -1) {
        stateNonce = decoded.slice(0, colonIdx);
        returnTo = decoded.slice(colonIdx + 1);
      } else {
        stateNonce = decoded;
      }
    } catch {
      stateNonce = req.query.state;
    }

    if (!stateNonce || stateNonce !== req.session.oauthState) {
      delete req.session.oauthState;
      return res.redirect("/");
    }

    // Store returnTo on req itself — passport.authenticate calls
    // req.session.regenerate() internally which wipes session data,
    // so we cannot rely on anything saved to req.session here.
    req._oauthReturnTo = isSafeRedirect(returnTo) ? returnTo : "/servers";
    next();
  },
  passport.authenticate("discord", { failureRedirect: "/" }),
  (req, res) => {
    delete req.session.oauthState;
    delete req.session.returnTo;
    // Use the destination saved on req before session was regenerated
    res.redirect(req._oauthReturnTo || "/servers");
  }
);

router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.redirect("/welcome");
    });
  });
});

module.exports = router;