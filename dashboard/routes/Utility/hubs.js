"use strict";
const router = require("express").Router();
const path   = require("path");
const fs     = require("fs");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');

/**
 * Serve a hub HTML file with ${guildId} replaced by the real guild ID.
 * The nonce injection in sendHTMLWithNonce still runs after this.
 */
function sendHubPage(res, filePath, guildId) {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) return res.status(500).send("Server error");
    // Replace every literal ${guildId} in href/src attributes with the real ID
    const patched = data.replace(/\$\{guildId\}/g, guildId);
    // Re-use nonce injection logic from middleware
    const nonce = res.locals.nonce || "";
    const safeNonce = String(nonce).replace(/[&"<>]/g,
      c => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" }[c])
    );
    const html = patched
      .replace(/<script\b/g,  `<script nonce="${safeNonce}"`)
      .replace(/<style\b/g,   `<style nonce="${safeNonce}"`)
      .replace(/<link\b([^>]*rel=["']stylesheet["'][^>]*)>/gi,
        (_, attrs) => `<link${attrs} nonce="${safeNonce}">`);
    res.send(html);
  });
}

router.get("/guild/:id/hub/moderation", isAuth, checkDashboardAccess('overview'), (req, res) =>
  sendHubPage(res, path.join(__dirname, "../../views/hubs/hub-moderation.html"), req.params.id)
);

router.get("/guild/:id/hub/community", isAuth, checkDashboardAccess('overview'), (req, res) =>
  sendHubPage(res, path.join(__dirname, "../../views/hubs/hub-community.html"), req.params.id)
);

router.get("/guild/:id/hub/tools", isAuth, checkDashboardAccess('overview'), (req, res) =>
  sendHubPage(res, path.join(__dirname, "../../views/hubs/hub-tools.html"), req.params.id)
);

router.get("/guild/:id/hub/settings", isAuth, checkDashboardAccess('overview'), (req, res) =>
  sendHubPage(res, path.join(__dirname, "../../views/hubs/hub-settings.html"), req.params.id)
);

router.get("/guild/:id/hub/staff", isAuth, checkDashboardAccess('overview'), (req, res) =>
  sendHubPage(res, path.join(__dirname, "../../views/hubs/hub-staff.html"), req.params.id)
);

router.get("/guild/:id/hub/notifications", isAuth, checkDashboardAccess('overview'), (req, res) =>
  sendHubPage(res, path.join(__dirname, "../../views/hubs/hub-notifications.html"), req.params.id)
);

router.get("/guild/:id/hub/fun", isAuth, checkDashboardAccess('overview'), (req, res) =>
  sendHubPage(res, path.join(__dirname, "../../views/hubs/hub-fun.html"), req.params.id)
);

module.exports = router;
