// server.js (or index.js) — cleaned + mobile-safe for sessions on api.riseeritrea.com
// ✅ Fixes:
// - dotenv loaded first
// - trust proxy enabled for Render
// - ONLY ONE CORS middleware (no duplicates)
// - session cookie works across subdomains (.riseeritrea.com) + SameSite=None in production
// - keeps your existing routes + middleware

require("dotenv").config();

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});

const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");

const { pool } = require("./db_pg");
const requireLogin = require("./middleware/requireLogin");
const requireAdmin = require("./middleware/requireAdmin");

const app = express();

/* ================= ENV ================= */
const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

// ✅ ONE CORS ONLY
const ALLOWED_ORIGINS = new Set([
  "https://riseeritrea.com",
  "https://www.riseeritrea.com",
]);

app.use(cors({
  origin: (origin, cb) => {
    // allow same-origin / curl / server-to-server (no Origin header)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    return cb(new Error("CORS blocked: " + origin), false);
  },
  credentials: true
}));

// ✅ session cookie settings that work on mobile
app.use(session({
  name: "esj.sid",
  store: new pgSession({ pool, tableName: "session" }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    httpOnly: true,
    secure: isProd,                       // true on Render
    sameSite: isProd ? "none" : "lax",     // needed for subdomains
    domain: isProd ? ".riseeritrea.com" : undefined,
    maxAge: 1000 * 60 * 60 * 24 * 14
  }
}));
/* ================= HEALTH ================= */
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

/* ================= PUBLIC ================= */
app.use("/api/auth", require("./routes/auth"));
app.use("/api/courses", require("./routes/courses"));
app.use("/api/lessons", require("./routes/lessons"));

/* ================= STUDENT (LOGGED IN) ================= */
app.use("/api/progress", requireLogin, require("./routes/progress"));
app.use("/api/exams", requireLogin, require("./routes/exams"));
app.use("/api/certificates", requireLogin, require("./routes/certificates"));

/* ================= ADMIN ================= */
app.use("/api/admin", requireAdmin, require("./routes/admin_lessons"));
app.use("/api/admin", requireAdmin, require("./routes/admin_exams"));

/* ================= START ================= */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("API running on port", PORT);
  console.log("NODE_ENV =", process.env.NODE_ENV);
});


