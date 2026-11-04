const { isAuth, checkGuildAccess, sendHTMLWithNonce } = require("../../middleware");
const router = require("express").Router();
const path   = require("path");
const config = require("../../../src/config/bot");

router.get("/premium403",   isAuth, (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/errors/premium403.html")));
router.get("/servers",      isAuth, (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/servers.html")));
// /donate kept as redirect for backwards compat
router.get("/donate",       isAuth, (req, res) => res.redirect("/premium"));
// New premium page
router.get("/premium",         isAuth, (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/premium/premium.html")));
router.get("/premium/branding",       isAuth, (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/premium/premium-branding.html")));
router.get("/subscriptions",           isAuth, (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/premium/subscriptions.html")));
router.get("/guild/:id",    isAuth, checkGuildAccess, (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/guild.html")));
router.get("/blacklisted",  (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/errors/blacklisted.html")));
router.get("/welcome",      (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) return res.redirect("/servers");
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/auth/login.html"));
});
router.get("/disabled",     (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/errors/disabled.html")));
router.get("/docs",       (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/pages/docs.html")));
router.get("/support",      (req, res) => res.redirect(config.supportURL));
router.get("/invite",       (req, res) => res.redirect(config.inviteURL));
router.get("/privacy",      (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/pages/privacy.html")));
router.get("/tos",          (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/pages/tos.html")));
router.get("/gdpr",         isAuth, (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/gdpr.html")));

module.exports = router;
