// backend/routes/courses.js
const express = require("express");
const { query } = require("../db_pg");

const router = express.Router();

/**
 * GET /api/courses
 * Returns list of courses (foundation, growth, excellence)
 */
router.get("/", async (req, res) => {
  try {
    const r = await query(
      `SELECT
         id,
         title_en,
         title_ti,
         description_en,
         description_ti
       FROM courses
       ORDER BY
         CASE id
           WHEN 'foundation' THEN 1
           WHEN 'growth' THEN 2
           WHEN 'excellence' THEN 3
           ELSE 99
         END`
    );

    res.json({ courses: r.rows });
  } catch (err) {
    console.error("COURSES ERROR:", err);
    res.status(500).json({ error: "Failed to load courses" });
  }
});

module.exports = router;
