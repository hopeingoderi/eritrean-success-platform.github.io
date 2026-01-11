const express = require("express");
const { query } = require("../db_pg");

const router = express.Router();

// GET /api/admin/lessons/:courseId
router.get("/lessons/:courseId", async (req, res) => {
  try {
    const courseId = req.params.courseId;

    const r = await query(
      "SELECT id, course_id, lesson_index, title_en, title_ti FROM lessons WHERE course_id=$1 ORDER BY lesson_index",
      [courseId]
    );

    res.json({ lessons: r.rows });
  } catch (err) {
    console.error("ADMIN LESSONS LIST ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
