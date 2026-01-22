const express = require("express");
const { query } = require("../db_pg");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/:courseId", requireAuth, async (req, res) => {
  const { courseId } = req.params;
  const lang = (req.query.lang === "ti") ? "ti" : "en";

  const r = await query(
    "SELECT * FROM lessons WHERE course_id=$1 ORDER BY lesson_index",
    [courseId]
  );

  res.json({
    lessons: r.rows.map(x => ({
      lessonIndex: x.lesson_index,
      title: lang === "ti" ? x.title_ti : x.title_en,
      learnText: lang === "ti" ? x.learn_ti : x.learn_en,
      task: lang === "ti" ? x.task_ti : x.task_en,
      quiz: JSON.parse(x.quiz_json)
    }))
  });
});

module.exports = router;
