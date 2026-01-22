const express = require("express");
const { z } = require("zod");
const { query } = require("../db_pg");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/lessons/:courseId", requireAdmin, async (req, res) => {
  const courseId = req.params.courseId;
  const r = await query(
    "SELECT id, course_id, lesson_index, title_en, title_ti FROM lessons WHERE course_id=$1 ORDER BY lesson_index",
    [courseId]
  );
  res.json({ lessons: r.rows });
});

router.post("/lesson/save", requireAdmin, async (req, res) => {
  const schema = z.object({
    id: z.number().int().optional(),
    courseId: z.enum(["foundation","growth","excellence"]),
    lessonIndex: z.number().int().min(0),
    title_en: z.string().min(2),
    title_ti: z.string().min(2),
    learn_en: z.string().min(5),
    learn_ti: z.string().min(5),
    task_en: z.string().min(2),
    task_ti: z.string().min(2),
    quiz: z.object({
      questions: z.array(z.object({
        text: z.string(),
        options: z.array(z.string()).min(2),
        correctIndex: z.number().int().min(0)
      })).min(1)
    })
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const d = parsed.data;
  const quiz_json = JSON.stringify(d.quiz);

  if (d.id) {
    await query(
      `UPDATE lessons SET
        course_id=$1, lesson_index=$2,
        title_en=$3, title_ti=$4,
        learn_en=$5, learn_ti=$6,
        task_en=$7, task_ti=$8,
        quiz_json=$9
       WHERE id=$10`,
      [d.courseId, d.lessonIndex, d.title_en, d.title_ti, d.learn_en, d.learn_ti, d.task_en, d.task_ti, quiz_json, d.id]
    );
  } else {
    await query(
      `INSERT INTO lessons (
        course_id, lesson_index, title_en, title_ti, learn_en, learn_ti, task_en, task_ti, quiz_json
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (course_id, lesson_index) DO UPDATE SET
        title_en=EXCLUDED.title_en,
        title_ti=EXCLUDED.title_ti,
        learn_en=EXCLUDED.learn_en,
        learn_ti=EXCLUDED.learn_ti,
        task_en=EXCLUDED.task_en,
        task_ti=EXCLUDED.task_ti,
        quiz_json=EXCLUDED.quiz_json`,
      [d.courseId, d.lessonIndex, d.title_en, d.title_ti, d.learn_en, d.learn_ti, d.task_en, d.task_ti, quiz_json]
    );
  }

  res.json({ ok: true });
});

router.delete("/lesson/:id", requireAdmin, async (req, res) => {
  await query("DELETE FROM lessons WHERE id=$1", [Number(req.params.id)]);
  res.json({ ok: true });
});

module.exports = router;
