"use strict";

// codes.js — Dev panel: generate / list / delete premium codes (redeemed with /redeem)

const router = require("express").Router();
const Redeem = require("../../../../Schemas/redeem");
const { generateCodes } = require("../../../../Utils/redeemCodes");
const { devLog, secureDevApi } = require("./shared");

router.get("/api-dev/codes", ...secureDevApi, async (req, res) => {
  try {
    const codes = await Redeem.find().sort({ createdAt: -1 }).limit(500).lean();
    res.json({
      codes: codes.map(c => ({
        code:      c.code,
        tier:      c.tier || "basic",
        duration:  c.duration || "monthly",
        target:    c.target || "user",
        note:      c.note || null,
        createdAt: c.createdAt || null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api-dev/codes", ...secureDevApi, async (req, res) => {
  const { tier = "basic", duration = "monthly", target = "user", count = 1, note = null } = req.body;
  try {
    const codes = await generateCodes({ tier, duration, target, count, note, createdBy: req.user?.id });
    devLog("CODES_GENERATE", { tier, duration, target, count: codes.length, note }, req.user);
    res.json({ success: true, codes });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/api-dev/codes/:code", ...secureDevApi, async (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  if (!/^[A-Z0-9-]{4,40}$/.test(code)) return res.status(400).json({ error: "Invalid code" });
  try {
    const deleted = await Redeem.findOneAndDelete({ code });
    if (!deleted) return res.status(404).json({ error: "Code not found" });
    devLog("CODES_DELETE", { code }, req.user);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
