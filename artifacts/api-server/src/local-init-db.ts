import type { Database } from "better-sqlite3";

// Creates all tables and indexes in the local SQLite database.
// Called once on startup — all statements are idempotent (IF NOT EXISTS).
export function initDb(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      name TEXT,
      logo_url TEXT,
      retake_passcode TEXT DEFAULT '1234',
      current_academic_session TEXT DEFAULT '2025/2026',
      current_term TEXT DEFAULT 'First Term',
      available_terms TEXT DEFAULT '["First Term","Second Term","Third Term"]',
      next_term_begins TEXT,
      is_disabled INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      full_name TEXT NOT NULL,
      school_code TEXT,
      class TEXT,
      profile_picture TEXT,
      generated_password TEXT,
      fees_fully_paid INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS users_school_code_idx ON users(school_code);

    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      class TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      school_code TEXT NOT NULL,
      teacher_id INTEGER NOT NULL,
      assessment_type TEXT DEFAULT 'exam',
      term TEXT DEFAULT 'First Term',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS exams_school_code_idx ON exams(school_code);
    CREATE INDEX IF NOT EXISTS exams_teacher_id_idx ON exams(teacher_id);
    CREATE INDEX IF NOT EXISTS exams_school_active_idx ON exams(school_code, is_active);

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      exam_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_option TEXT NOT NULL,
      school_code TEXT NOT NULL,
      image_url TEXT,
      group_id INTEGER,
      group_order INTEGER DEFAULT 0,
      group_image_url TEXT,
      group_title TEXT,
      group_text TEXT
    );
    CREATE INDEX IF NOT EXISTS questions_exam_id_idx ON questions(exam_id);

    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      exam_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      full_name TEXT NOT NULL,
      class TEXT NOT NULL,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      percentage REAL NOT NULL,
      school_code TEXT NOT NULL,
      term TEXT DEFAULT 'First Term',
      retake_count INTEGER DEFAULT 0,
      submitted_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS results_exam_id_idx ON results(exam_id);
    CREATE INDEX IF NOT EXISTS results_student_id_idx ON results(student_id);
    CREATE INDEX IF NOT EXISTS results_school_code_idx ON results(school_code);
    CREATE INDEX IF NOT EXISTS results_school_exam_idx ON results(school_code, exam_id);
    CREATE INDEX IF NOT EXISTS results_student_exam_idx ON results(student_id, exam_id);

    CREATE TABLE IF NOT EXISTS result_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      result_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_option TEXT NOT NULL,
      selected_option TEXT,
      is_correct INTEGER NOT NULL DEFAULT 0,
      school_code TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS result_answers_result_id_idx ON result_answers(result_id);

    CREATE TABLE IF NOT EXISTS grading_schemes (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      school_code TEXT NOT NULL,
      mid_term_total INTEGER NOT NULL DEFAULT 20,
      mid_term_cbt INTEGER NOT NULL DEFAULT 10,
      mid_term_theory INTEGER NOT NULL DEFAULT 10,
      exam_total INTEGER NOT NULL DEFAULT 60,
      exam_cbt INTEGER NOT NULL DEFAULT 30,
      exam_theory INTEGER NOT NULL DEFAULT 30,
      class_activity_total INTEGER NOT NULL DEFAULT 20,
      grade_a_min INTEGER NOT NULL DEFAULT 70,
      grade_b_min INTEGER NOT NULL DEFAULT 60,
      grade_c_min INTEGER NOT NULL DEFAULT 50,
      grade_d_min INTEGER NOT NULL DEFAULT 40,
      grade_f_max INTEGER NOT NULL DEFAULT 39,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subject_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      student_id INTEGER NOT NULL,
      subject_name TEXT NOT NULL,
      class_name TEXT NOT NULL,
      school_code TEXT NOT NULL,
      term TEXT DEFAULT 'First Term',
      academic_session TEXT DEFAULT '2025/2026',
      mid_term_score INTEGER,
      mid_term_cbt_score INTEGER,
      class_activity_score INTEGER,
      exam_score INTEGER,
      exam_cbt_score INTEGER,
      total_score INTEGER,
      percentage INTEGER,
      grade TEXT,
      teacher_comment TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (student_id, subject_name, term, academic_session)
    );
    CREATE INDEX IF NOT EXISTS subject_scores_student_id_idx ON subject_scores(student_id);
    CREATE INDEX IF NOT EXISTS subject_scores_school_code_idx ON subject_scores(school_code);
    CREATE INDEX IF NOT EXISTS subject_scores_school_term_session_idx ON subject_scores(school_code, term, academic_session);

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      level TEXT NOT NULL,
      school_code TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE (name, school_code, level)
    );

    CREATE TABLE IF NOT EXISTS student_traits (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      student_id INTEGER NOT NULL,
      school_code TEXT NOT NULL,
      term TEXT NOT NULL DEFAULT 'First Term',
      academic_session TEXT NOT NULL DEFAULT '2025/2026',
      class_name TEXT NOT NULL,
      trait_category TEXT NOT NULL,
      trait_name TEXT NOT NULL,
      rating INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (student_id, trait_name, term, academic_session)
    );
    CREATE INDEX IF NOT EXISTS student_traits_student_id_idx ON student_traits(student_id);
    CREATE INDEX IF NOT EXISTS student_traits_school_code_idx ON student_traits(school_code);

    CREATE TABLE IF NOT EXISTS student_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      student_id INTEGER NOT NULL,
      school_code TEXT NOT NULL,
      term TEXT NOT NULL DEFAULT 'First Term',
      academic_session TEXT NOT NULL DEFAULT '2025/2026',
      class_name TEXT NOT NULL,
      times_school_opened INTEGER NOT NULL DEFAULT 0,
      times_present INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (student_id, term, academic_session)
    );
    CREATE INDEX IF NOT EXISTS student_attendance_student_id_idx ON student_attendance(student_id);
    CREATE INDEX IF NOT EXISTS student_attendance_school_code_idx ON student_attendance(school_code);

    CREATE TABLE IF NOT EXISTS device_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      device_id TEXT NOT NULL UNIQUE,
      school_code TEXT,
      ip_address TEXT,
      user_agent TEXT,
      user_id INTEGER,
      username TEXT,
      full_name TEXT,
      role TEXT,
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    );
  `);

  // ── ID-range separation ───────────────────────────────────────────────────
  // Locally-created rows must never collide with cloud-exported rows that
  // arrive via import-school (which preserves cloud integer PKs).  Cloud
  // Postgres auto-increments from 1; we push the local counter to
  // 1,999,999,999 so the first locally-assigned ID is 2,000,000,000.
  //
  // Mechanism: sqlite_sequence is the counter table used by AUTOINCREMENT.
  // Each table only gains a row in sqlite_sequence after its first INSERT,
  // so we use INSERT OR IGNORE to create the row on a fresh DB, then UPDATE
  // with MAX() to respect any higher value already established by an import.
  // This runs on every startup and is fully idempotent.
  const LOCAL_ID_FLOOR = 1_999_999_999;
  const seqTables = [
    "users", "exams", "questions", "subjects", "grading_schemes",
    "results", "result_answers", "subject_scores",
    "student_traits", "student_attendance",
  ];
  const insertSeq = db.prepare(
    "INSERT OR IGNORE INTO sqlite_sequence (name, seq) VALUES (?, ?)"
  );
  const bumpSeq = db.prepare(
    "UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = ?"
  );
  for (const table of seqTables) {
    insertSeq.run(table, LOCAL_ID_FLOOR);
    bumpSeq.run(LOCAL_ID_FLOOR, table);
  }

  // ── Schema migrations (idempotent) ─────────────────────────────────────────
  // SQLite does not support ADD COLUMN IF NOT EXISTS — wrap in try/catch.
  try { db.exec("ALTER TABLE schools ADD COLUMN license_valid_until INTEGER"); } catch {}
  try { db.exec("ALTER TABLE schools ADD COLUMN max_devices INTEGER"); } catch {}
  try { db.exec("ALTER TABLE schools ADD COLUMN pure_cbt_mode INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN fees_fully_paid INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE questions ADD COLUMN question_type TEXT DEFAULT 'objective'"); } catch {}
  try { db.exec("ALTER TABLE questions ADD COLUMN correct_answer_text TEXT"); } catch {}
  // Unique constraint: one result per student per exam
  try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS results_student_exam_unique ON results(student_id, exam_id)"); } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS question_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      exam_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      passage_text TEXT,
      image_url TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS question_groups_exam_id_idx ON question_groups(exam_id);
  `);

  try { db.exec("ALTER TABLE questions ADD COLUMN question_group_id INTEGER"); } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS server_config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS registered_devices (
      device_id     TEXT PRIMARY KEY,
      school_code   TEXT NOT NULL,
      registered_at INTEGER NOT NULL,
      last_seen     INTEGER NOT NULL,
      user_id       INTEGER,
      username      TEXT,
      full_name     TEXT,
      role          TEXT,
      ip_address    TEXT
    )
  `);
}
