"use strict";

// reports.js — Dev panel: list, filter, update, and resolve reports

const router = require("express").Router();
const Report = require("../../../../Schemas/ReportSchema");
const { devLog, secureDevApi } = require("./shared");

const CATEGORY_LABELS = {
    abuse:         "Abuse / Harassment",
    spam:          "Spam / Flooding",
    scam:          "Scam / Phishing",
    impersonation: "Impersonation",
    nsfw:          "NSFW / Inappropriate",
    cheating:      "Cheating / Exploiting",
    other:         "Other",
};

/* ─────────────────────────────────────────────
   LIST reports (with filters)
───────────────────────────────────────────── */

router.get("/api-dev/reports", ...secureDevApi, async (req, res) => {
    const { status, type, category, search, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (status   && status   !== "all") filter.status     = status;
    if (type     && type     !== "all") filter.targetType = type;
    if (category && category !== "all") filter.category   = category;
    if (search) {
        const q = search.trim();
        filter.$or = [
            { targetId:   { $regex: q, $options: "i" } },
            { reporterId: { $regex: q, $options: "i" } },
            { reportId:   { $regex: q, $options: "i" } },
            { reason:     { $regex: q, $options: "i" } },
        ];
    }

    const skip  = (Math.max(1, Number(page)) - 1) * Number(limit);
    const total = await Report.countDocuments(filter);
    const docs  = await Report.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean();

    // Counts by status for the badge indicators
    const [openCount, reviewingCount] = await Promise.all([
        Report.countDocuments({ status: "open" }),
        Report.countDocuments({ status: "reviewing" }),
    ]);

    res.json({ reports: docs, total, openCount, reviewingCount });
});

/* ─────────────────────────────────────────────
   SINGLE report
───────────────────────────────────────────── */

router.get("/api-dev/reports/:reportId", ...secureDevApi, async (req, res) => {
    const doc = await Report.findOne({ reportId: req.params.reportId }).lean();
    if (!doc) return res.status(404).json({ error: "Report not found" });
    res.json(doc);
});

/* ─────────────────────────────────────────────
   SET STATUS (mark as reviewing)
───────────────────────────────────────────── */

router.post("/api-dev/reports/:reportId/status", ...secureDevApi, async (req, res) => {
    const { status } = req.body;
    const VALID = ["open", "reviewing", "resolved", "dismissed"];
    if (!VALID.includes(status)) return res.status(400).json({ error: "Invalid status" });

    const doc = await Report.findOne({ reportId: req.params.reportId });
    if (!doc) return res.status(404).json({ error: "Report not found" });

    doc.status = status;
    await doc.save();

    devLog("REPORT_STATUS", { reportId: doc.reportId, status }, req.user);
    res.json({ success: true, status });
});

/* ─────────────────────────────────────────────
   RESOLVE report + DM reporter
───────────────────────────────────────────── */

router.post("/api-dev/reports/:reportId/resolve", ...secureDevApi, async (req, res) => {
    const { action, devNote, status = "resolved" } = req.body;

    if (!action?.trim()) return res.status(400).json({ error: "action is required" });
    if (!["resolved", "dismissed"].includes(status)) {
        return res.status(400).json({ error: "status must be 'resolved' or 'dismissed'" });
    }

    const doc = await Report.findOne({ reportId: req.params.reportId });
    if (!doc) return res.status(404).json({ error: "Report not found" });
    if (doc.status === "resolved" || doc.status === "dismissed") {
        return res.status(409).json({ error: `Report is already ${doc.status}` });
    }

    const devUserId = req.user?.id ?? null;

    doc.status                  = status;
    doc.resolution.resolvedBy   = devUserId;
    doc.resolution.resolvedAt   = new Date();
    doc.resolution.action       = action.trim().slice(0, 500);
    doc.resolution.devNote      = devNote?.trim().slice(0, 500) ?? null;
    await doc.save();

        // ── DM the reporter via internal API (works in standalone and inline mode) ──
    let dmSent = false;
    try {
        const { apiPost } = require("../../../lib/botClient");
        const { EmbedBuilder } = require("discord.js");

        const isResolved  = status === "resolved";
        const COLOR       = isResolved ? 0x22c55e : 0x64748b;
        const statusLabel = isResolved ? "\u2705 Resolved" : "\u26ab Dismissed";

        const embed = new EmbedBuilder()
            .setTitle(`${statusLabel} \u2014 Your Report Has Been Reviewed`)
            .setColor(COLOR)
            .setDescription(
                isResolved
                    ? "Thank you for reporting \u2014 we've reviewed your report and taken action."
                    : "We've reviewed your report. No action was taken at this time."
            )
            .addFields(
                { name: "\ud83d\udccb Report ID",    value: `\`${doc.reportId}\``,               inline: true },
                { name: "\ud83c\udfaf Target",       value: `${doc.targetType === "user" ? "User" : "Server"} \`${doc.targetId}\``, inline: true },
                { name: "\ud83d\udccc Action Taken", value: action.trim(),                         inline: false },
            )
            .setFooter({ text: "Roco Moderation Team" })
            .setTimestamp();

        await apiPost(`/internal/user/${doc.reporterId}/dm`, { embeds: [embed.toJSON()] });
        dmSent = true;
    } catch (err) {
        console.warn(`[Reports] Failed to DM reporter ${doc.reporterId}:`, err.message);
    }

        // Update dmSent flag
    doc.resolution.dmSent = dmSent;
    await doc.save();

    devLog("REPORT_RESOLVE", {
        reportId:   doc.reportId,
        status,
        action:     action.trim(),
        devNote:    devNote?.trim() ?? null,
        dmSent,
    }, req.user);

    res.json({ success: true, status, dmSent });
});

/* ─────────────────────────────────────────────
   BULK DISMISS (e.g. spam wave)
───────────────────────────────────────────── */

router.post("/api-dev/reports/bulk-dismiss", ...secureDevApi, async (req, res) => {
    const { reportIds, devNote } = req.body;
    if (!Array.isArray(reportIds) || !reportIds.length) {
        return res.status(400).json({ error: "reportIds array required" });
    }

    await Report.updateMany(
        { reportId: { $in: reportIds }, status: { $in: ["open", "reviewing"] } },
        {
            $set: {
                status:                    "dismissed",
                "resolution.resolvedBy":   req.user?.id ?? null,
                "resolution.resolvedAt":   new Date(),
                "resolution.action":       "Dismissed in bulk",
                "resolution.devNote":      devNote?.trim() ?? null,
            },
        }
    );

    devLog("REPORT_BULK_DISMISS", { count: reportIds.length, reportIds }, req.user);
    res.json({ success: true, dismissed: reportIds.length });
});

/* ─────────────────────────────────────────────
   STATS
───────────────────────────────────────────── */

router.get("/api-dev/reports/stats", ...secureDevApi, async (req, res) => {
    const [total, open, reviewing, resolved, dismissed, byCategory] = await Promise.all([
        Report.countDocuments(),
        Report.countDocuments({ status: "open" }),
        Report.countDocuments({ status: "reviewing" }),
        Report.countDocuments({ status: "resolved" }),
        Report.countDocuments({ status: "dismissed" }),
        Report.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]),
    ]);

    res.json({
        total, open, reviewing, resolved, dismissed,
        byCategory: byCategory.map(c => ({
            category: c._id,
            label:    CATEGORY_LABELS[c._id] ?? c._id,
            count:    c.count,
        })),
    });
});

module.exports = router;