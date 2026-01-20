// backend/routes/certificates.js
const express = require("express");
const router = express.Router();

// IMPORTANT: adjust this import if your db export is different
// If you have: module.exports = pool; then use: const pool = require("../db_pg");
const pool = require("../db_pg");

// ---------- helpers ----------
function safeCourseId(courseId) {
  const allowed = new Set(["foundation", "growth", "excellence"]);
  return allowed.has(courseId) ? courseId : null;
}

async function getUser(req) {
  // Your project uses sessions: req.session.user
  // If you store user differently, adjust here.
  return req.session?.user || null;
}

async function getLessonCount(courseId) {
  // Count lessons from DB (recommended)
  // fallback: 10 lessons if table not ready.
  try {
    const r = await pool.query(
      `SELECT COUNT(DISTINCT lesson_index) AS n
       FROM lessons
       WHERE course_id = $1`,
      [courseId]
    );
    const n = Number(r.rows?.[0]?.n || 0);
    return n > 0 ? n : 10;
  } catch {
    return 10;
  }
}

async function getCompletedCount(userId, courseId) {
  // progress table: user_id, course_id, lesson_index, completed
  const r = await pool.query(
    `SELECT COUNT(*) AS n
     FROM progress
     WHERE user_id = $1 AND course_id = $2 AND completed = true`,
    [userId, courseId]
  );
  return Number(r.rows?.[0]?.n || 0);
}

async function getIssuedCertificate(userId, courseId) {
  const r = await pool.query(
    `SELECT id, user_id, course_id, student_name, issued_at
     FROM certificates
     WHERE user_id = $1 AND course_id = $2`,
    [userId, courseId]
  );
  return r.rows?.[0] || null;
}

function courseLabel(courseId) {
  if (courseId === "foundation") return "Level 1: Foundation";
  if (courseId === "growth") return "Level 2: Growth";
  if (courseId === "excellence") return "Level 3: Excellence";
  return courseId;
}

// ---------- middleware ----------
router.use(async (req, res, next) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  req.user = user;
  next();
});

// ---------- routes ----------

// Get certificate status for a course
// GET /api/certificates/status/:courseId
router.get("/status/:courseId", async (req, res) => {
  const courseId = safeCourseId(req.params.courseId);
  if (!courseId) return res.status(400).json({ error: "Invalid courseId" });

  const userId = req.user.id;

  const totalLessons = await getLessonCount(courseId);
  const completedLessons = await getCompletedCount(userId, courseId);
  const eligible = totalLessons > 0 && completedLessons >= totalLessons;

  const issued = await getIssuedCertificate(userId, courseId);

  res.json({
    courseId,
    totalLessons,
    completedLessons,
    eligible,
    issued: !!issued,
    certificate: issued
      ? {
          id: issued.id,
          studentName: issued.student_name,
          issuedAt: issued.issued_at
        }
      : null
  });
});

// Issue certificate (only if eligible)
// POST /api/certificates/issue/:courseId
router.post("/issue/:courseId", async (req, res) => {
  const courseId = safeCourseId(req.params.courseId);
  if (!courseId) return res.status(400).json({ error: "Invalid courseId" });

  const userId = req.user.id;

  const already = await getIssuedCertificate(userId, courseId);
  if (already) {
    return res.json({
      ok: true,
      alreadyIssued: true,
      certificateId: already.id,
      viewUrl: `/api/certificates/view/${already.id}`
    });
  }

  const totalLessons = await getLessonCount(courseId);
  const completedLessons = await getCompletedCount(userId, courseId);
  const eligible = totalLessons > 0 && completedLessons >= totalLessons;

  if (!eligible) {
    return res.status(400).json({
      error: "Not eligible yet",
      totalLessons,
      completedLessons
    });
  }

  const studentName = req.user.name || req.user.email || "Student";

  const ins = await pool.query(
    `INSERT INTO certificates (user_id, course_id, student_name)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, courseId, studentName]
  );

  const certificateId = ins.rows[0].id;

  res.json({
    ok: true,
    alreadyIssued: false,
    certificateId,
    viewUrl: `/api/certificates/view/${certificateId}`
  });
});

// List my certificates
// GET /api/certificates/my
router.get("/my", async (req, res) => {
  const userId = req.user.id;
  const r = await pool.query(
    `SELECT id, course_id, student_name, issued_at
     FROM certificates
     WHERE user_id = $1
     ORDER BY issued_at DESC`,
    [userId]
  );
  res.json({ certificates: r.rows || [] });
});

// View/Print certificate (simple HTML)
// GET /api/certificates/view/:id
router.get("/view/:id", async (req, res) => {
  const userId = req.user.id;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).send("Bad id");

  const r = await pool.query(
    `SELECT id, course_id, student_name, issued_at
     FROM certificates
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  const cert = r.rows?.[0];
  if (!cert) return res.status(404).send("Not found");

  const title = "Certificate of Completion";
  const level = courseLabel(cert.course_id);
  const date = new Date(cert.issued_at).toLocaleDateString();

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; background:#f3f6ff; padding:30px; }
    .card { max-width:900px; margin:0 auto; background:white; border:2px solid #1c2b3a; border-radius:18px; padding:34px; }
    h1 { margin:0 0 8px 0; text-align:center; }
    .sub { text-align:center; color:#333; margin-bottom:22px; }
    .name { font-size:30px; text-align:center; margin:18px 0; font-weight:700; }
    .line { height:1px; background:#ddd; margin:18px 0; }
    .meta { display:flex; justify-content:space-between; color:#333; margin-top:24px; }
    .btn { display:inline-block; margin-top:18px; padding:10px 14px; border-radius:10px; border:1px solid #1c2b3a; text-decoration:none; color:#1c2b3a; }
    @media print { .noPrint { display:none; } body { background:white; padding:0; } .card{ border:none; } }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <div class="sub">Eritrean Success Journey</div>

    <div class="line"></div>

    <div class="sub">This certifies that</div>
    <div class="name">${cert.student_name}</div>
    <div class="sub">has successfully completed</div>
    <div class="name" style="font-size:24px;">${level}</div>

    <div class="line"></div>

    <div class="meta">
      <div><b>Date:</b> ${date}</div>
      <div><b>Certificate ID:</b> ${cert.id}</div>
    </div>

    <div class="noPrint" style="text-align:center;">
      <a class="btn" href="#" onclick="window.print();return false;">Print / Save as PDF</a>
    </div>
  </div>
</body>
</html>
  `);
});

module.exports = router;
