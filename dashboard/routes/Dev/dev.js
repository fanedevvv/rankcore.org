"use strict";

const express = require("express");
const router  = require("express").Router();
const path    = require("path");

const { isAuth, devOnly, sendHTMLWithNonce } = require("../../middleware");

// ── Dev page view ─────────────────────────────────────────────────────────────

router.get("/dev", isAuth, devOnly, (req, res) => {
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/dev.html"));
});

// /owner is a friendlier alias for the owner panel
router.get("/owner", isAuth, devOnly, (req, res) => res.redirect("/dev"));

// ── Sub-routers ───────────────────────────────────────────────────────────────

router.use("/", require("./dev/blacklist"));
router.use("/", require("./dev/premium"));
router.use("/", require("./dev/codes"));
router.use("/", require("./dev/bot"));
router.use("/", require("./dev/logs"));
router.use("/", require("./dev/modules"));
router.use("/", require("./dev/granular"));
router.use("/", require("./dev/notes"));
router.use("/", require("./dev/owners"));
router.use("/", require("./dev/lookup"));
router.use("/", require("./dev/status-events"));
router.use("/", require("./dev/reports"));
router.use("/", require("./dev/cb"));

module.exports = router;