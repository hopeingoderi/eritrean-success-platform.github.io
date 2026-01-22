require("dotenv").config();
console.log("USING DATABASE_URL =", process.env.DATABASE_URL);

const { query } = require("./db_pg");

async function migrate() {
  await query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );`);

  await query(`CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    title_en TEXT NOT NULL,
    title_ti TEXT NOT NULL,
    intro_en TEXT NOT NULL,
    intro_ti TEXT NOT NULL
  );`);

  await query(`CREATE TABLE IF NOT EXISTS lessons (
    id SERIAL PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_index INT NOT NULL,
    title_en TEXT NOT NULL,
    title_ti TEXT NOT NULL,
    learn_en TEXT NOT NULL,
    learn_ti TEXT NOT NULL,
    task_en TEXT NOT NULL,
    task_ti TEXT NOT NULL,
    quiz_json TEXT NOT NULL,
    UNIQUE(course_id, lesson_index)
  );`);

  await query(`CREATE TABLE IF NOT EXISTS progress (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_index INT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    quiz_score INT,
    reflection TEXT,
    reflection_updated_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY(user_id, course_id, lesson_index)
  );`);

  await query(`CREATE TABLE IF NOT EXISTS certificates (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, course_id)
  );`);

  await query(`CREATE TABLE IF NOT EXISTS exam_defs (
    course_id TEXT PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
    pass_score INT NOT NULL DEFAULT 70,
    exam_json_en TEXT NOT NULL,
    exam_json_ti TEXT NOT NULL
  );`);

  await query(`CREATE TABLE IF NOT EXISTS exam_attempts (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    score INT NOT NULL,
    passed BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY(user_id, course_id)
  );`);

  // connect-pg-simple session table
  await query(`CREATE TABLE IF NOT EXISTS "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL
  )
  WITH (OIDS=FALSE);`);

  await query(`ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");`);
  await query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");`);

  console.log("✅ Migration complete.");
}

migrate().catch((e) => {
  console.error("Migration error FULL:", e);
  process.exit(1);
});
