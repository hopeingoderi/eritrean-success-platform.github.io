// backend/routes/courses.js
const express = require("express");
const { query } = require("../db_pg");

const router = express.Router();

// Hardcoded metadata (DB only needs id values: foundation|growth|excellence)
const COURSE_META = {
  foundation: {
    order: 1,
    title_en: "Level 1: Foundation",
    title_ti: "ደረጃ 1፡ መሠረት",
    description_en: "Build your mindset, confidence, and study basics.",
    description_ti: "ኣእምሮኻ፣ ምትእምማን፣ እቲ መሠረታዊ ትምህርቲ ልምዲ ኣቕም።"
  },
  growth: {
    order: 2,
    title_en: "Level 2: Growth",
    title_ti: "ደረጃ 2፡ ዕቤት",
    description_en: "Build discipline, habits, communication, and consistency.",
    description_ti: "ስነ-ስርዓት፣ ልምዲ፣ ርክብ ምኽንያት፣ ቀጻሊ ጽንዓት ኣቕም።"
  },
  excellence: {
    order: 3,
    title_en: "Level 3: Excellence",
    title_ti: "ደረጃ 3፡ ብልጫ",
    description_en: "Leadership, vision, integrity, and long-term success.",
    description_ti: "መሪሕነት፣ ራእይ፣ ትኽክለኛነት፣ ነዊሕ ግዜ ስኬት።"
  }
};

router.get("/", async (req, res) => {
  try {
    // DB is the source of truth for what courses exist
    const r = await query("SELECT id FROM courses ORDER BY id");
    const rows = (r.rows || []).map(x => x.id);

    // Map to safe response fields
    const courses = rows
      .map((id) => {
        const meta = COURSE_META[id] || {
          order: 999,
          title_en: id,
          title_ti: id,
          description_en: "",
          description_ti: ""
        };
        return { id, ...meta };
      })
      .sort((a, b) => (a.order - b.order));

    return res.json({ courses });
  } catch (err) {
    console.error("COURSES ERROR:", err);
    return res.status(500).json({ error: "Failed to load courses" });
  }
});

module.exports = router;
