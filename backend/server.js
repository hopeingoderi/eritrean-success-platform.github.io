require("dotenv").config();

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

/* ================= CORE ================= */
app.set("trust proxy", 1);
app.use(helmet());
app.use(rateLimit({ windowMs: 60_000, max: 200 }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

/* ================= CORS (ONE ONLY) ================= */
app.use(cors({
  origin: [
    "https://riseeritrea.com",
    "https://www.riseeritrea.com"
  ],
  credentials: true
}));

/* ================= SESSION ================= */
app.use(session({
  name: "sid",
  store: new pgSession({
    pool,
    tableName: "session"
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    httpOnly: true,
    secure: true,     // HTTPS REQUIRED
    sameSite: "none", // cross-domain cookie
    maxAge: 1000 * 60 * 60 * 24 * 14
  }
}));

/* ================= HEALTH ================= */
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

/* ================= ROUTES ================= */
app.use("/api/auth", require("./routes/auth"));
app.use("/api/courses", require("./routes/courses"));
app.use("/api/lessons", require("./routes/lessons"));

app.use("/api/progress", requireLogin, require("./routes/progress"));
app.use("/api/exams", requireLogin, require("./routes/exams"));
app.use("/api/certificates", requireLogin, require("./routes/certificates"));

app.use("/api/admin", requireAdmin, require("./routes/admin_lessons"));
app.use("/api/admin", requireAdmin, require("./routes/admin_exams"));

/* ================= START ================= */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("API running on port", PORT);
});


