// backend/routes/certificates.js
// Plan A (PDF) + Plan B polish (QR verify)
// Eligibility: ALL lessons completed + Final Exam passed

const express = require("express");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode"); // npm i qrcode
const { query } = require("../db_pg");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

/** Only allow known courses (optional but safer) */
function safeCourseId(courseId) {
  const allowed = new Set(["foundation", "growth", "excellence"]);
  return allowed.has(courseId) ? courseId : null;
}

function courseLabel(courseId) {
  if (courseId === "foundation") return "Level 1: Foundation";
  if (courseId === "growth") return "Level 2: Growth";
  if (courseId === "excellence") return "Level 3: Excellence";
  return courseId;
}

function brand() {
  return {
    org: "Eritrean Success Journey",
    title: "Certificate of Completion",
    accent: "#2563eb", // blue
    accent2: "#14b8a6" // teal
  };
}

/** Eligibility: all lessons completed + exam passed */
async function checkEligibility(userId, courseId) {
  // total lessons
  const totalR = await query(
    "SELECT COUNT(*)::int AS c FROM lessons WHERE course_id=$1",
    [courseId]
  );
  const totalLessons = totalR.rows[0]?.c ?? 0;

  // completed lessons
  const doneR = await query(
    "SELECT COUNT(*)::int AS c FROM progress WHERE user_id=$1 AND course_id=$2 AND completed=true",
    [userId, courseId]
  );
  const completedLessons = doneR.rows[0]?.c ?? 0;

  // exam attempt
  const attemptR = await query(
    "SELECT passed, score FROM exam_attempts WHERE user_id=$1 AND course_id=$2",
    [userId, courseId]
  );
  const passedExam = !!attemptR.rows[0]?.passed;
  const examScore =
    typeof attemptR.rows[0]?.score === "number" ? attemptR.rows[0].score : null;

  const eligible =
    totalLessons > 0 &&
    completedLessons >= totalLessons &&
    passedExam === true;

  return { eligible, totalLessons, completedLessons, examPassed: passedExam, examScore };
}

async function getExistingCertificate(userId, courseId) {
  const r = await query(
    "SELECT id, issued_at FROM certificates WHERE user_id=$1 AND course_id=$2",
    [userId, courseId]
  );
  return r.rows[0] || null;
}

async function ensureCertificate(userId, courseId) {
  // idempotent: return existing if already created
  const existing = await getExistingCertificate(userId, courseId);
  if (existing) return existing;

  const eligibility = await checkEligibility(userId, courseId);
  if (!eligibility.eligible) {
    const err = new Error("Not eligible yet");
    err.status = 403;
    err.details = eligibility;
    throw err;
  }

  // create
  await query(
    `INSERT INTO certificates (user_id, course_id)
     VALUES ($1,$2)
     ON CONFLICT (user_id, course_id) DO NOTHING`,
    [userId, courseId]
  );

  const created = await getExistingCertificate(userId, courseId);
  if (!created) {
    const err = new Error("Failed to create certificate");
    err.status = 500;
    throw err;
  }
  return created;
}

/**
 * PUBLIC VERIFY PAGE (QR points here)
 * GET /api/certificates/verify/:certId
 * No auth required.
 */
router.get("/verify/:certId", async (req, res) => {
  try {
    const certId = Number(req.params.certId);
    if (!Number.isFinite(certId)) return res.status(400).send("Bad certificate id");

    const r = await query(
      `SELECT c.id, c.course_id, c.issued_at, u.name AS student_name
       FROM certificates c
       JOIN users u ON u.id = c.user_id
       WHERE c.id=$1`,
      [certId]
    );

    if (!r.rows.length) return res.status(404).send("Certificate not found");

    const cert = r.rows[0];
    const level = courseLabel(cert.course_id);
    const issuedDate = new Date(cert.issued_at).toDateString();
    const b = brand();

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Verify Certificate</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;background:#0b1220;color:#eaf0ff}
    .wrap{max-width:900px;margin:0 auto;padding:24px}
    .card{background:#0f1a33;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px}
    .h1{font-size:26px;margin:0 0 10px 0}
    .muted{color:#b8c4ff}
    .ok{display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(20,184,166,.15);border:1px solid rgba(20,184,166,.35)}
    .row{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}
    .line{height:1px;background:rgba(255,255,255,.12);margin:14px 0}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="row">
        <div>
          <div class="h1">Certificate Verification</div>
          <div class="muted">${b.org}</div>
        </div>
        <div class="ok">✅ VALID</div>
      </div>

      <div class="line"></div>

      <div><b>Student:</b> ${String(cert.student_name || "Student")}</div>
      <div><b>Course:</b> ${level}</div>
      <div><b>Issued:</b> ${issuedDate}</div>
      <div><b>Certificate ID:</b> ${cert.id}</div>

      <div class="line"></div>

      <div class="muted">If you reached this page from a QR code inside a PDF, the certificate is authentic.</div>
    </div>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error("CERT VERIFY ERROR:", err);
    res.status(500).send("Server error");
  }
});

/**
 * STATUS for UI
 * GET /api/certificates/status/:courseId
 * Protected (logged-in student)
 */
router.get("/status/:courseId", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const courseId = safeCourseId(req.params.courseId);
    if (!courseId) return res.status(400).json({ error: "Invalid courseId" });

    const eligibility = await checkEligibility(userId, courseId);
    const existing = await getExistingCertificate(userId, courseId);

    res.json({
      courseId,
      eligible: eligibility.eligible,
      totalLessons: eligibility.totalLessons,
      completedLessons: eligibility.completedLessons,
      examPassed: eligibility.examPassed,
      examScore: eligibility.examScore,
      issued: !!existing,
      certificateId: existing ? existing.id : null,
      pdfUrl: existing ? `/api/certificates/${courseId}/pdf` : null,
      verifyUrl: existing ? `/api/certificates/verify/${existing.id}` : null
    });
  } catch (err) {
    console.error("CERT STATUS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * LIST my certificates
 * GET /api/certificates
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const r = await query(
      `SELECT c.id, c.course_id, c.issued_at, co.title_en, co.title_ti
       FROM certificates c
       JOIN courses co ON co.id = c.course_id
       WHERE c.user_id=$1
       ORDER BY c.issued_at DESC`,
      [userId]
    );

    res.json({ certificates: r.rows });
  } catch (err) {
    console.error("CERT LIST ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * CLAIM certificate
 * POST /api/certificates/claim
 * Body: { courseId }
 */
router.post("/claim", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const courseId = safeCourseId(req.body?.courseId);
    if (!courseId) return res.status(400).json({ error: "Invalid courseId" });

    const cert = await ensureCertificate(userId, courseId);

    res.json({
      ok: true,
      certificate: {
        id: cert.id,
        courseId,
        issuedAt: cert.issued_at,
        pdfUrl: `/api/certificates/${courseId}/pdf`,
        verifyUrl: `/api/certificates/verify/${cert.id}`
      }
    });
  } catch (err) {
    if (err.status === 403) {
      return res.status(403).json({ error: "Not eligible yet", details: err.details });
    }
    console.error("CERT CLAIM ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * PDF download (Plan A) + QR verify (Plan B polish)
 * GET /api/certificates/:courseId/pdf
 */
router.get("/:courseId/pdf", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const courseId = safeCourseId(req.params.courseId);
    if (!courseId) return res.status(400).json({ error: "Invalid courseId" });

    // Ensure certificate exists (only if eligible)
    const cert = await ensureCertificate(userId, courseId);

    // Get user name
    const userR = await query("SELECT name FROM users WHERE id=$1", [userId]);
    if (!userR.rows.length) return res.status(404).json({ error: "User not found" });
    const userName = userR.rows[0].name || "Student";

    // Get course title
    const courseR = await query("SELECT id, title_en FROM courses WHERE id=$1", [courseId]);
    if (!courseR.rows.length) return res.status(404).json({ error: "Course not found" });

    const b = brand();
    const courseTitle = courseR.rows[0].title_en || courseLabel(courseId);
    const issuedAt = cert.issued_at;

    // QR URL (public verify page)
    const verifyUrl = `https://api.riseeritrea.com/api/certificates/verify/${cert.id}`;
    const qrPng = await QRCode.toBuffer(verifyUrl, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 260
    });

    // PDF headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="certificate-${courseId}.pdf"`);

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    // ---------- DESIGN ----------
    // Background
    doc.save();
    doc.rect(0, 0, doc.page.width, doc.page.height).fill("#f7f9ff");
    doc.restore();

    // Border
    doc.save();
    doc.lineWidth(3).strokeColor(b.accent).rect(25, 25, doc.page.width - 50, doc.page.height - 50).stroke();
    doc.lineWidth(1).strokeColor("#c7d2fe").rect(33, 33, doc.page.width - 66, doc.page.height - 66).stroke();
    doc.restore();

    // Header
    doc.fillColor("#111827").fontSize(28).font("Helvetica-Bold")
      .text(b.title, 0, 95, { align: "center" });

    doc.fillColor("#334155").fontSize(12).font("Helvetica")
      .text(b.org, 0, 132, { align: "center" });

    // Accent line
    doc.save();
    doc.strokeColor(b.accent2).lineWidth(2);
    doc.moveTo(110, 165).lineTo(doc.page.width - 110, 165).stroke();
    doc.restore();

    // Body
    doc.fillColor("#111827").fontSize(14).font("Helvetica")
      .text("This certificate is proudly presented to", 0, 205, { align: "center" });

    doc.fillColor("#0f172a").fontSize(34).font("Helvetica-Bold")
      .text(userName, 0, 240, { align: "center" });

    doc.fillColor("#111827").fontSize(14).font("Helvetica")
      .text("for successfully completing the course:", 0, 295, { align: "center" });

    doc.fillColor("#1f2937").fontSize(22).font("Helvetica-Bold")
      .text(courseTitle, 0, 325, { align: "center" });

    // Meta
    const issuedText = `Issued on: ${new Date(issuedAt).toDateString()}`;
    doc.fillColor("#334155").fontSize(11).font("Helvetica")
      .text(issuedText, 0, 380, { align: "center" });

    // Certificate ID
    doc.fillColor("#64748b").fontSize(10)
      .text(`Certificate ID: ${cert.id}`, 0, 400, { align: "center" });

    // Signature lines
    doc.save();
    doc.strokeColor("#94a3b8").lineWidth(1);
    doc.moveTo(90, 680).lineTo(270, 680).stroke();
    doc.moveTo(doc.page.width - 270, 680).lineTo(doc.page.width - 90, 680).stroke();
    doc.restore();

    doc.fillColor("#475569").fontSize(10)
      .text("Signature", 90, 688, { width: 180, align: "center" });
    doc.fillColor("#475569").fontSize(10)
      .text("Stamp", doc.page.width - 270, 688, { width: 180, align: "center" });

    // QR code block
    const qrSize = 115;
    const qrX = doc.page.width - 50 - qrSize;
    const qrY = doc.page.height - 50 - qrSize;

    doc.save();
    doc.fillColor("#ffffff").rect(qrX - 8, qrY - 28, qrSize + 16, qrSize + 40).fill();
    doc.lineWidth(1).strokeColor("#cbd5e1").rect(qrX - 8, qrY - 28, qrSize + 16, qrSize + 40).stroke();
    doc.restore();

    doc.image(qrPng, qrX, qrY, { width: qrSize, height: qrSize });

    doc.fillColor("#334155").fontSize(9).font("Helvetica")
      .text("Scan to verify", qrX - 8, qrY - 20, { width: qrSize + 16, align: "center" });

    // Footer tiny url (helps even without scanning)
    doc.fillColor("#64748b").fontSize(8)
      .text(verifyUrl, 50, doc.page.height - 45, { align: "center", width: doc.page.width - 100 });

    doc.end();
  } catch (err) {
    if (err.status === 403) {
      return res.status(403).json({ error: "Not eligible yet", details: err.details });
    }
    console.error("CERT PDF ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
