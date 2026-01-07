const express = require("express");
const { query } = require("../db_pg");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/:courseId", requireAuth, async (req, res) => {
  const courseId = req.params.courseId;
  const lang = (req.query.lang === "ti") ? "ti" : "en";

  const r = await query(
    "SELECT pass_score, exam_json_en, exam_json_ti FROM exam_defs WHERE course_id=$1",
    [courseId]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Exam not found" });

  const def = r.rows[0];
  res.json({
    courseId,
    passScore: def.pass_score,
    exam: JSON.parse(lang === "ti" ? def.exam_json_ti : def.exam_json_en)
  });
});

router.get("/:courseId/attempt", requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const courseId = req.params.courseId;

  const r = await query(
    "SELECT score, passed, updated_at FROM exam_attempts WHERE user_id=$1 AND course_id=$2",
    [userId, courseId]
  );
  res.json({ attempt: r.rows[0] || null });
});

router.post("/:courseId/submit", requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const courseId = req.params.courseId;

  const score = req.body?.score;
  if (typeof score !== "number" || score < 0 || score > 100) {
    return res.status(400).json({ error: "Invalid score" });
  }

  const defR = await query("SELECT pass_score FROM exam_defs WHERE course_id=$1", [courseId]);
  if (!defR.rows.length) return res.status(404).json({ error: "Exam not found" });

  const passScore = defR.rows[0].pass_score;
  const passed = score >= passScore;

  await query(
    `INSERT INTO exam_attempts (user_id, course_id, score, passed, updated_at)
     VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (user_id, course_id) DO UPDATE SET
       score=EXCLUDED.score,
       passed=EXCLUDED.passed,
       updated_at=NOW()`,
    [userId, courseId, score, passed]
  );

  res.json({ ok: true, passed, passScore });
});

module.exports = router;
