"use strict";

// notes.js — dev notes (per-user + shared team board)

const router  = require("express").Router();
const DevNote = require("../../../../Schemas/devNotesSchema");
const { secureDevApi } = require("./shared");

const PRIORITY_OWNER = process.env.OWNER_ID;

router.get("/api-dev/notes", ...secureDevApi, async (req, res) => {
  try {
    const userId = req.user?.id ?? "anon";

    const allShared = await DevNote.find({ shared: true, _id: { $ne: "devnotes" } })
      .sort({ updatedAt: -1 }).lean();
    allShared.sort((a, b) => {
      if (a.ownerId === PRIORITY_OWNER && b.ownerId !== PRIORITY_OWNER) return -1;
      if (b.ownerId === PRIORITY_OWNER && a.ownerId !== PRIORITY_OWNER) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    const myNotes = await DevNote.find({ ownerId: userId, _id: { $ne: "devnotes" } })
      .sort({ updatedAt: -1 }).lean();

    res.json({
      sharedNotes: allShared.map(n => ({
        id:        n._id,
        title:     n.title     ?? "Untitled",
        content:   n.content   ?? "",
        ownerId:   n.ownerId,
        updatedBy: n.updatedBy ?? null,
        updatedAt: n.updatedAt,
        createdAt: n.createdAt,
      })),
      notes: myNotes.map(n => ({
        id:        n._id,
        title:     n.title     ?? "Untitled",
        content:   n.content   ?? "",
        shared:    n.shared    ?? false,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api-dev/notes", ...secureDevApi, async (req, res) => {
  const { noteId, content, title, shared } = req.body;
  if (typeof content !== "string") return res.status(400).json({ error: "content must be a string" });
  if (content.length > 50_000)    return res.status(400).json({ error: "content too long (max 50,000 chars)" });
  if (title && typeof title !== "string") return res.status(400).json({ error: "title must be a string" });
  if (title && title.length > 200)        return res.status(400).json({ error: "title too long (max 200 chars)" });

  const userId = req.user?.id ?? "anon";

  try {
    const id  = noteId || new (require("mongoose").Types.ObjectId)().toString();
    const doc = await DevNote.findOneAndUpdate(
      { _id: id, ownerId: userId },
      {
        $set: {
          title:     title?.trim() || "Untitled",
          content,
          shared:    !!shared,
          ownerId:   userId,
          updatedBy: req.user?.username ?? null,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`[DEV] Note saved (id=${id}, shared=${!!shared}) — by ${req.user?.username}`);
    res.json({ success: true, noteId: doc._id.toString(), shared: !!shared, updatedAt: doc.updatedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api-dev/notes/:noteId", ...secureDevApi, async (req, res) => {
  const { noteId } = req.params;
  const userId     = req.user?.id ?? "anon";
  try {
    await DevNote.deleteOne({ _id: noteId, ownerId: userId });
    console.log(`[DEV] Note ${noteId} deleted — by ${req.user?.username}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;