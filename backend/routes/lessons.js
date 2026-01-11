const express = require("express");
const { query } = require("../db_pg");
const { requireAuth } = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

/* ================= STUDENT LESSONS ================= */
router.get("/:courseId", requireAuth, async (req, res) => {
  const { courseId } = req.params;
  const lang = req.query.lang === "ti" ? "ti" : "en";

  const r = await query(
    `SELECT lesson_index,
            title_${lang} AS title,
            learn_${lang} AS learnText,
            task_${lang} AS task,
            quiz
     FROM lessons
     WHERE course_id=$1
     ORDER BY lesson_index`,
    [courseId]
  );

  res.json({ lessons: r.rows });
});

/* ================= ADMIN SAVE LESSON ================= */
router.post("/lesson/save", requireAdmin, async (req, res) => {
  try {
    const {
      id,
      courseId,
      lessonIndex,
      title_en,
      title_ti,
      learn_en,
      learn_ti,
      task_en,
      task_ti,
      quiz
    } = req.body;

    if (!courseId || lessonIndex === undefined) {
      return res.status(400).json({ error: "Missing courseId or lessonIndex" });
    }

    if (id) {
      // UPDATE
      await query(
        `UPDATE lessons SET
          course_id=$1,
          lesson_index=$2,
          title_en=$3,
          title_ti=$4,
          learn_en=$5,
          learn_ti=$6,
          task_en=$7,
          task_ti=$8,
          quiz=$9
         WHERE id=$10`,
        [
          courseId,
          lessonIndex,
          title_en,
          title_ti,
          learn_en,
          learn_ti,
          task_en,
          task_ti,
          quiz,
          id
        ]
      );
    } else {
      // INSERT
      await query(
        `INSERT INTO lessons
          (course_id, lesson_index, title_en, title_ti,
           learn_en, learn_ti, task_en, task_ti, quiz)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          courseId,
          lessonIndex,
          title_en,
          title_ti,
          learn_en,
          learn_ti,
          task_en,
          task_ti,
          quiz
        ]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("SAVE LESSON ERROR:", err);
    res.status(500).json({ error: "Failed to save lesson" });
  }
});

module.exports = router;
