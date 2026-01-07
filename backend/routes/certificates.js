const express = require("express");
const { query } = require("../db_pg");
const { requireAuth } = require("../middleware/auth");
const { createCertificatePdf } = require("../utils/pdf");

const router = express.Router();

router.post("/issue/:courseId", requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const courseId = req.params.courseId;

  const totalR = await query("SELECT COUNT(*)::int AS c FROM lessons WHERE course_id=$1", [courseId]);
  const total = totalR.rows[0].c;

  if (total === 0) return res.status(400).json({ error: "No lessons in course yet" });

  const doneR = await query(
    "SELECT COUNT(*)::int AS c FROM progress WHERE user_id=$1 AND course_id=$2 AND completed=true",
    [userId, courseId]
  );
  const done = doneR.rows[0].c;

  if (done < total) return res.status(400).json({ error: "Finish all lessons first" });

  // ✅ exam gating
  const attemptR = await query(
    "SELECT passed, score FROM exam_attempts WHERE user_id=$1 AND course_id=$2",
    [userId, courseId]
  );
  if (!attemptR.rows.length || attemptR.rows[0].passed !== true) {
    return res.status(400).json({ error: "Pass the final exam first" });
  }

  await query(
    `INSERT INTO certificates (user_id, course_id)
     VALUES ($1,$2)
     ON CONFLICT (user_id, course_id) DO NOTHING`,
    [userId, courseId]
  );

  res.json({ ok: true });
});

router.get("/download/:courseId", requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const courseId = req.params.courseId;

  const certR = await query(
    "SELECT issued_at FROM certificates WHERE user_id=$1 AND course_id=$2",
    [userId, courseId]
  );
  if (!certR.rows.length) return res.status(404).json({ error: "Certificate not found. Issue it first." });

  const courseR = await query("SELECT title_en FROM courses WHERE id=$1", [courseId]);
  const courseTitle = courseR.rows[0]?.title_en || courseId;

  const pdf = await createCertificatePdf({
    name: req.session.user.name,
    courseTitle,
    issuedAt: certR.rows[0].issued_at.toISOString()
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="certificate-${courseId}.pdf"`);
  res.send(pdf);
});

module.exports = router;
