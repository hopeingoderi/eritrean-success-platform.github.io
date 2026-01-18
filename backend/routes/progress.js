const express = require("express");
const { z } = require("zod");
const { query } = require("../db_pg");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/status", requireAuth, async (req, res) => {
  const userId = req.session.user.id;

  const courses = await query("SELECT id FROM courses ORDER BY id");
  const out = [];

  for (const c of courses.rows) {
    const total = await query("SELECT COUNT(*)::int AS c FROM lessons WHERE course_id=$1", [c.id]);
    const done = await query(
      "SELECT COUNT(*)::int AS c FROM progress WHERE user_id=$1 AND course_id=$2 AND completed=true",
      [userId, c.id]
    );
    const cert = await query(
      "SELECT 1 FROM certificates WHERE user_id=$1 AND course_id=$2 LIMIT 1",
      [userId, c.id]
    );

    out.push({
      courseId: c.id,
      totalLessons: total.rows[0].c,
      completedLessons: done.rows[0].c,
      hasCertificate: cert.rows.length > 0
    });
  }

  res.json({ status: out });
});

router.get("/course/:courseId", requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const courseId = req.params.courseId;

  const r = await query(
    `SELECT lesson_index, completed, quiz_score, reflection, reflection_updated_at, updated_at
     FROM progress
     WHERE user_id=$1 AND course_id=$2
     ORDER BY lesson_index`,
    [userId, courseId]
  );

  const byLessonIndex = {};
  for (const row of r.rows) {
    const reflectionText = (row.reflection || "").toString();
    byLessonIndex[row.lesson_index] = {
      completed: !!row.completed,
      quizScore: (typeof row.quiz_score === "number") ? row.quiz_score : null,
      hasReflection: reflectionText.trim().length > 0,
      reflectionText,
      reflectionUpdatedAt: row.reflection_updated_at || null,
      updatedAt: row.updated_at || null
    };
  }

  res.json({ courseId, byLessonIndex });
});

router.post("/update", requireAuth, async (req, res) => {
  const schema = z.object({
    courseId: z.string(),
    lessonIndex: z.number().int().min(0),
    completed: z.boolean().optional(),
    quizScore: z.number().int().min(0).max(100).optional(),
    reflection: z.string().max(2000).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const userId = req.session.user.id;
  const { courseId, lessonIndex, completed, quizScore, reflection } = parsed.data;

await query(
  `INSERT INTO progress (
    user_id, course_id, lesson_index,
    completed, quiz_score, reflection,
    reflection_updated_at,
    updated_at
  )
  VALUES ($1,$2,$3,
    COALESCE($4,false),
    $5::int,
    $6::text,
    CASE WHEN $6::text IS NOT NULL THEN NOW() ELSE NULL END,
    NOW()
  )
  ON CONFLICT (user_id, course_id, lesson_index) DO UPDATE SET
    completed = COALESCE($4, progress.completed),
    quiz_score = COALESCE($5::int, progress.quiz_score),
    reflection = COALESCE($6::text, progress.reflection),
    reflection_updated_at = CASE
      WHEN $6::text IS NOT NULL THEN NOW()
      ELSE progress.reflection_updated_at
    END,
    updated_at = NOW()`,
  [
    userId,
    courseId,
    lessonIndex,
    (typeof completed === "boolean") ? completed : null,
    (typeof quizScore === "number") ? quizScore : null,
    (typeof reflection === "string") ? reflection : null
  ]
);

  res.json({ ok: true });
});

module.exports = router;

