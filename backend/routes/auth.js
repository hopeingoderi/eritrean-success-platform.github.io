// routes/auth.js
// ✅ Fixes mobile/session issues by forcing req.session.save() before responding
// ✅ Keeps your existing secure session (only {id, role})
// ✅ Adds same save() fix to register too (important on Safari/iOS)

const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const { query } = require("../db_pg");

const router = express.Router();

// Helpers
function safeUserSession(u) {
  // Store ONLY what we need in session (secure)
  return { id: u.id, role: u.role };
}

function safeUserResponse(u) {
  // What we return to frontend (no password_hash)
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

/**
 * REGISTER (student only)
 */
router.post("/register", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(6)
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    }

    const { name, email, password } = parsed.data;

    const exists = await query("SELECT id FROM users WHERE email=$1", [email]);
    if (exists.rows.length) return res.status(409).json({ error: "Email already used" });

    const hash = bcrypt.hashSync(password, 10);

    // IMPORTANT: role is student on register
    const r = await query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role",
      [name, email, hash, "student"]
    );

    const user = r.rows[0];

    // store explicit session with role
    req.session.user = safeUserSession(user);

    // ✅ FORCE save session BEFORE responding (fixes mobile/Safari)
    return req.session.save((err) => {
      if (err) {
        console.error("REGISTER SESSION SAVE ERROR:", err);
        return res.status(500).json({ error: "Session save failed" });
      }
      return res.json({ user: safeUserResponse(user) });
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * LOGIN (student or admin based on DB role)
 */
router.post("/login", async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1)
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    }

    const { email, password } = parsed.data;

    const r = await query(
      "SELECT id, name, email, password_hash, role FROM users WHERE email=$1",
      [email]
    );

    if (!r.rows.length) return res.status(401).json({ error: "Invalid email or password" });

    const u = r.rows[0];

    const ok = bcrypt.compareSync(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    // store ONLY {id, role} in session
    req.session.user = safeUserSession(u);

    // ✅ FORCE save session BEFORE responding (fixes mobile/Safari)
    return req.session.save((err) => {
      if (err) {
        console.error("LOGIN SESSION SAVE ERROR:", err);
        return res.status(500).json({ error: "Session save failed" });
      }
      return res.json({ user: safeUserResponse(u) });
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * LOGOUT
 */
router.post("/logout", (req, res) => {
  // safer: clear cookie after destroy
  req.session.destroy(() => {
    // If you changed cookie name in session config, update this name too.
    res.clearCookie("connect.sid");
    return res.json({ ok: true });
  });
});

/**
 * ME (who am I)
 */
router.get("/me", async (req, res) => {
  try {
    // If not logged in:
    if (!req.session || !req.session.user) return res.json({ user: null });

    // refresh user profile from DB (keeps name/email updated)
    const { id } = req.session.user;
    const r = await query("SELECT id, name, email, role FROM users WHERE id=$1", [id]);
    if (!r.rows.length) return res.json({ user: null });

    return res.json({ user: safeUserResponse(r.rows[0]) });
  } catch (err) {
    console.error("ME ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
