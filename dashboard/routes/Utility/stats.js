const MemberStats = require("../../../Schemas/memberStats");
const router = require("express").Router();
const { isAuth, checkDashboardAccess } = require('../../middleware');

/**
 * GET /api/guild/:id/stats?range=7|30|90|all
 *
 * BUG FIX: The original route returned every raw MemberStats document, which
 * meant multiple bot restarts per day (each triggering the ready.js snapshot)
 * produced 10-20 duplicate data points per calendar day — all labelled the
 * same date, all with the same member count, making the chart useless.
 *
 * Fix: use a MongoDB aggregation pipeline to GROUP by calendar day and take
 * the LAST snapshot of each day (most recent count wins). This collapses
 * 50 "Feb 23" docs into a single clean data point per day regardless of how
 * many times the bot restarted that day.
 */
router.get("/api/guild/:id/stats", isAuth, checkDashboardAccess('overview'), async (req, res) => {
  const guild = req.client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: "Guild not found" });

  try {
    const range = (req.query.range || "7").toLowerCase();

    // ── Build the match stage ──────────────────────────────────────────────
    const match = { GuildID: guild.id };

    if (range !== "all") {
      const days = Math.max(1, Math.min(parseInt(range) || 7, 365));
      const since = new Date();
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0); // start of that calendar day
      match.Date = { $gte: since };
    }

    // ── Aggregate: one data point per calendar day ─────────────────────────
    // $last gives the most recent snapshot written that day (newest restart).
    const stats = await MemberStats.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$Date" }
          },
          Members: { $last: "$Members" },
          Humans:  { $last: "$Humans"  },
          Bots:    { $last: "$Bots"    },
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          dateStr:  "$_id",
          Members:  1,
          Humans:   1,
          Bots:     1,
        }
      }
    ]);

    // ── Empty guard ────────────────────────────────────────────────────────
    if (!stats || stats.length === 0) {
      return res.json({
        labels:  [],
        members: [],
        humans:  [],
        bots:    [],
        empty:   true,
        message: "Not enough historical data yet — snapshots are taken once per day.",
      });
    }

    // ── Build response ─────────────────────────────────────────────────────
    // Parse "2026-02-23" → "Feb 23" for display labels.
    const labels  = stats.map(s => {
      const [year, month, day] = s.dateStr.split("-").map(Number);
      return new Date(year, month - 1, day).toLocaleDateString("en-US", {
        month: "short", day: "numeric"
      });
    });

    res.json({
      labels,
      data:    stats.map(s => s.Members ?? 0), // primary series (members)
      members: stats.map(s => s.Members ?? 0),
      humans:  stats.map(s => s.Humans  ?? 0),
      bots:    stats.map(s => s.Bots    ?? 0),
      empty:   false,
    });

  } catch (e) {
    console.error("[stats] Error:", e.message);
    res.status(500).json({ error: "Stats query failed", message: e.message });
  }
});

module.exports = router;
