const router     = require("express").Router();
const path       = require("path");
const { sendHTMLWithNonce } = require("../../middleware");
const Changelog  = require("../../../Schemas/changelogs");

// ─── Valid type values ────────────────────────────────────────────────────────
const VALID_TYPES = new Set(["new", "improved", "fixed", "removed", "update", "security", "premium"]);

// ─── View ─────────────────────────────────────────────────────────────────────

/**
 * GET /changelogs
 * Serves the changelogs HTML page — publicly accessible (no auth required).
 */
router.get("/changelogs", (req, res) => {
    sendHTMLWithNonce(res, path.join(__dirname, "../../views/pages/changelogs.html"));
});

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * GET /api/changelogs
 * Returns all changelog entries sorted newest-first.
 *
 * Optional query params:
 *   ?limit=N   — cap results (default 50, max 200)
 *   ?type=X    — filter by config.type (e.g. "new", "fixed")
 *   ?page=N    — zero-based page index when combined with limit
 *
 * Response shape:
 * {
 *   total: number,
 *   page:  number,
 *   limit: number,
 *   data: [
 *     {
 *       id:          string,
 *       date:        string (ISO),
 *       title:       string | null,
 *       description: string | null,
 *       footer:      string | null,
 *       color:       string | null,
 *       type:        string | null
 *     },
 *     …
 *   ]
 * }
 */
router.get("/api/changelogs", async (req, res) => {
    try {
        // ── Input validation ─────────────────────────────────────────────────
        let limit = parseInt(req.query.limit, 10);
        if (isNaN(limit) || limit < 1) limit = 50;
        if (limit > 200)               limit = 200;

        let page = parseInt(req.query.page, 10);
        if (isNaN(page) || page < 0) page = 0;

        const filter = {};
        if (req.query.type) {
            const t = String(req.query.type).toLowerCase().trim();
            if (!VALID_TYPES.has(t)) {
                return res.status(400).json({
                    error: `Invalid type. Allowed values: ${[...VALID_TYPES].join(", ")}`
                });
            }
            filter["config.type"] = t;
        }

        // ── Query ────────────────────────────────────────────────────────────
        const [total, entries] = await Promise.all([
            Changelog.countDocuments(filter),
            Changelog.find(filter)
                .sort({ date: -1 })
                .skip(page * limit)
                .limit(limit)
                .lean(),
        ]);

        // ── Serialize ────────────────────────────────────────────────────────
        const data = entries.map(entry => ({
            id:          entry._id.toString(),
            date:        entry.date ? entry.date.toISOString() : null,
            title:       entry.config?.title       ?? null,
            description: entry.config?.description ?? null,
            footer:      entry.config?.footer      ?? null,
            color:       entry.config?.color       ?? null,
            type:        entry.config?.type        ?? null,
        }));

        return res.json({ total, page, limit, data });

    } catch (err) {
        console.error("[/api/changelogs] Error:", err.message);
        return res.status(500).json({ error: "Failed to fetch changelogs" });
    }
});

/**
 * GET /api/changelogs/:id
 * Returns a single changelog entry by its MongoDB _id.
 */
router.get("/api/changelogs/:id", async (req, res) => {
    try {
        const id = req.params.id;

        // Validate ObjectId format to avoid a mongoose cast error / stack trace
        if (!/^[a-f\d]{24}$/i.test(id)) {
            return res.status(400).json({ error: "Invalid changelog ID format" });
        }

        const entry = await Changelog.findById(id).lean();
        if (!entry) {
            return res.status(404).json({ error: "Changelog not found" });
        }

        return res.json({
            id:          entry._id.toString(),
            date:        entry.date ? entry.date.toISOString() : null,
            title:       entry.config?.title       ?? null,
            description: entry.config?.description ?? null,
            footer:      entry.config?.footer      ?? null,
            color:       entry.config?.color       ?? null,
            type:        entry.config?.type        ?? null,
        });

    } catch (err) {
        console.error("[/api/changelogs/:id] Error:", err.message);
        return res.status(500).json({ error: "Failed to fetch changelog entry" });
    }
});

module.exports = router;