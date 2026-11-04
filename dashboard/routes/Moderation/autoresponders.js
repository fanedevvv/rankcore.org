const Autoresponder = require("../../../Schemas/Autoresponder");
const router = require("express").Router();
const path = require("path");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const { getLimits, limitError } = require("../Utils/limits");

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickEmbed(body) {
  if (!body.embed) return undefined;
  const e = body.embed;
  if (!e.enabled) return { enabled: false };
  return {
    enabled:     true,
    color:       e.color       || '#6C53FF',
    title:       e.title       || '',
    description: e.description || '',
    authorName:  e.authorName  || '',
    authorIcon:  e.authorIcon  || '',
    thumbnail:   e.thumbnail   || '',
    image:       e.image       || '',
    footerText:  e.footerText  || '',
    footerIcon:  e.footerIcon  || '',
    timestamp:   !!e.timestamp,
    fields: Array.isArray(e.fields)
      ? e.fields.slice(0, 25).map(f => ({ name: f.name || '', value: f.value || '', inline: !!f.inline }))
      : [],
  };
}

function pickButtons(body) {
  if (!body.buttons) return undefined;
  const row = body.buttons;
  if (!Array.isArray(row.components) || !row.components.length) return undefined;
  return {
    type: 1,
    components: row.components.slice(0, 5).map(b => ({
      type:      2,
      label:     (b.label || '').slice(0, 80),
      style:     Number(b.style) || 1,
      custom_id: b.style == 5 ? undefined : (b.custom_id || `btn_${Math.random().toString(36).slice(2, 8)}`),
      url:       b.style == 5 ? (b.url || '') : undefined,
      disabled:  !!b.disabled,
      emoji:     b.emoji?.name ? { name: b.emoji.name } : undefined,
      _action:   pickButtonAction(b._action),
    })),
  };
}

function pickButtonAction(action) {
  if (!action || action.type === 'none' || !action.type) return undefined;
  const base = { type: action.type };
  if (action.type === 'reply' || action.type === 'dm') {
    base.content  = (action.content || '').slice(0, 2000);
    base.ephemeral = action.ephemeral !== false;
  }
  if (action.type === 'role_add' || action.type === 'role_remove' || action.type === 'role_toggle') {
    base.roleId = action.roleId || '';
  }
  return base;
}

function pickV2Components(body) {
  if (!Array.isArray(body.v2Components) || !body.v2Components.length) return undefined;
  // Trust the structure from the client — Discord validates on send.
  // We do light sanitization only.
  return body.v2Components.slice(0, 40); // Discord max is 40 top-level components
}

function buildUpdate(body) {
  const embed   = pickEmbed(body);
  const buttons = pickButtons(body);
  const v2      = pickV2Components(body);

  return {
    trigger:      (body.trigger || '').slice(0, 100),
    response:     (body.response || '').slice(0, 2000),
    ...(embed   !== undefined && { embed }),
    ...(buttons !== undefined && { buttons }),
    ...(v2      !== undefined && { v2Components: v2 }),
    // Clear v2 if not provided and embed or text is being used
    ...(v2 === undefined && body.v2Components === null && { v2Components: null }),
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Serve page
router.get("/guild/:id/autoresponder", isAuth, checkDashboardAccess('autoresponder'), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/autoresponder.html"))
);

// GET all
router.get("/api/guild/:id/autoresponders", isAuth, checkDashboardAccess('autoresponder'), async (req, res) => {
  try {
    const docs = await Autoresponder.find({ guildId: req.params.id }).sort({ createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error("[autoresponders GET all]", err.message);
    res.status(500).json({ error: "Failed to fetch autoresponders" });
  }
});

// GET one
router.get("/api/guild/:id/autoresponders/:responderId", isAuth, checkDashboardAccess('autoresponder'), async (req, res) => {
  try {
    const doc = await Autoresponder.findOne({ _id: req.params.responderId, guildId: req.params.id }).lean();
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch autoresponder" });
  }
});

// POST create
router.post("/api/guild/:id/autoresponders", isAuth, checkDashboardAccess('autoresponder'), async (req, res) => {
  try {
    const lim   = await getLimits(req.user?.id, req.params.id);
    const count = await Autoresponder.countDocuments({ guildId: req.params.id });
    if (count >= lim.autoresponders) return res.status(400).json({ error: limitError(lim, "autoresponders") });

    if (!req.body.trigger?.trim()) return res.status(400).json({ error: "Trigger is required" });

    const update = buildUpdate(req.body);
    await Autoresponder.create({ guildId: req.params.id, ...update });
    res.json({ success: true });
  } catch (err) {
    console.error("[autoresponders POST]", err.message);
    res.status(500).json({ error: "Failed to create autoresponder" });
  }
});

// PUT update
router.put("/api/guild/:id/autoresponders/:responderId", isAuth, checkDashboardAccess('autoresponder'), async (req, res) => {
  try {
    if (!req.body.trigger?.trim()) return res.status(400).json({ error: "Trigger is required" });

    const update = buildUpdate(req.body);
    const doc = await Autoresponder.findOneAndUpdate(
      { _id: req.params.responderId, guildId: req.params.id },
      { ...update, updatedAt: new Date() },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json({ success: true, doc });
  } catch (err) {
    console.error("[autoresponders PUT]", err.message);
    res.status(500).json({ error: "Failed to update autoresponder" });
  }
});

// DELETE
router.delete("/api/guild/:id/autoresponders/:responderId", isAuth, checkDashboardAccess('autoresponder'), async (req, res) => {
  try {
    await Autoresponder.findOneAndDelete({ _id: req.params.responderId, guildId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete autoresponder" });
  }
});

module.exports = router;