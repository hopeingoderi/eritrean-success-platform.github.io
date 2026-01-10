const express = require("express");
const { query } = require("../db_pg");

const router = express.Router();

/**
 * GET /api/admin/lessons/:courseId
 * Returns all lessons for a course (admin only).
 *
 * Example:
 *  /api/admin/lessons/1
 */
router.get("/:courseId", async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isFinite(courseId)) {
      return res.status(400).json({ error: "Invalid courseId" });
    }

    const r = await query(
      "SELECT id, course_id, lesson_index, title_en, title_ti FROM lessons WHERE course_id=$1 ORDER BY lesson_index",
      [courseId]
    );

    return res.json({ lessons: r.rows });
  } catch (err) {
    console.error("ADMIN LESSONS LIST ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * Optional: helpful endpoint so /api/admin/lessons doesn't show "Cannot GET"
 * GET /api/admin/lessons
 */
router.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Admin lessons endpoint. Use /api/admin/lessons/:courseId"
  });
});

module.exports = router;

module.exports = router;

