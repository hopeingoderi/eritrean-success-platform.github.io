const express = require("express");
const { query } = require("../db_pg");
const { requireAuth } = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

function quizSafe(quiz) {
  if (quiz && typeof quiz === "object") return quiz;
  return { questions: [] };
}

/* ================= STUDENT LESSONS =================
   GET /api/lessons/:courseId?lang=en|ti
*/
router.get("/:courseId", requireAuth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const lang = req.query.lang === "ti" ? "ti" : "en";

    // Ensure quiz is never null: COALESCE to {"questions":[]}
    const r = await query(
      `SELECT
          lesson_index,
          title_${lang} AS title,
          learn_${lang} AS "learnText",
          task_${lang} AS task,
          COALESCE(quiz, '{"questions":[]}'::jsonb) AS quiz
       FROM lessons
       WHERE course_id=$1
       ORDER BY lesson_index`,
      [courseId]
    );

    // Convert lesson_index -> lessonIndex for frontend
    const lessons = r.rows.map(row => ({
      lessonIndex: row.lesson_index,
      title: row.title,
      learnText: row.learnText,
      task: row.task,
      quiz: quizSafe(row.quiz)
    }));

    res.json({ lessons });
  } catch (err) {
    console.error("STUDENT LESSONS ERROR:", err);
    res.status(500).json({ error: "Failed to load lessons" });
  }
});

/* ================= ADMIN SAVE LESSON =================
   POST /api/lessons/lesson/save  (NOTE: keep if you still use it)
   (Recommended: admin routes should live under /api/admin, but we keep yours.)
*/
router.post("/lesson/save", requireAdmin, async (req, res) => {
  try {
    let {
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

    const q = quizSafe(quiz);

    if (id) {
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
          q,
          id
        ]
      );
    } else {
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
          q
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
