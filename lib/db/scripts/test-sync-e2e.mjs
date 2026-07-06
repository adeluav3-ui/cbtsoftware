/**
 * End-to-end sync verification — PART C of the pilot sign-off.
 *
 * Uses:
 *   - in-memory SQLite  as the "local server" database
 *   - live Postgres     as the "cloud" database (all writes run inside a
 *                       transaction that is ROLLED BACK at the end, so
 *                       zero test data survives in production)
 *
 * Test school:  NEW-1001
 * Test student: 105  (ALABI ENIOLA ARINOLA)
 * Exam A:       59   (CHRISTIAN RELIGIOUS STUDIES, mid_term, Third Term)
 * Exam B:       92   (CHEMISTRY (CHM), exam, Third Term)
 * Device ID:    test-device-e2e-verify-001
 */
import dotenv from "dotenv";
import { unlink } from "fs/promises";
dotenv.config({ path: new URL("../lib/db/.env", import.meta.url).pathname });

import pg from "pg";
import Database from "better-sqlite3";

const SCHOOL = "NEW-1001";
const STUDENT_ID = 105;
const EXAM_A_ID = 59;    // CRS, mid_term
const EXAM_B_ID = 92;    // CHM, exam
const TERM = "Third Term";
const SESSION = "2025/2026";
const DEVICE_ID = "test-device-e2e-verify-001";

// ── helpers ──────────────────────────────────────────────────────────────────

function hr(label) { console.log(`\n${"─".repeat(60)}\n${label}\n${"─".repeat(60)}`); }
function step(n, txt) { console.log(`\n  [${n}] ${txt}`); }
function show(label, rows) {
  console.log(`\n  ${label}:`);
  if (!rows || rows.length === 0) { console.log("    (empty)"); return; }
  rows.forEach(r => console.log("   ", JSON.stringify(r)));
}

// ── SQLite setup ─────────────────────────────────────────────────────────────

function makeSQLite() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(`
    CREATE TABLE results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    CREATE TABLE result_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    CREATE TABLE subject_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    CREATE TABLE device_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  return sqlite;
}

// ── replicate export logic (mirrors GET /results-export queries) ─────────────

function localExport(sqlite, schoolCode) {
  const results = sqlite.prepare(`SELECT * FROM results WHERE school_code = ?`).all(schoolCode);
  const resultIds = results.map(r => r.id);
  const answers = resultIds.length > 0
    ? sqlite.prepare(`SELECT * FROM result_answers WHERE result_id IN (${resultIds.map(() => "?").join(",")})`)
        .all(...resultIds)
    : [];
  const subjectScores = sqlite.prepare(`SELECT * FROM subject_scores WHERE school_code = ?`).all(schoolCode);
  const deviceSessions = sqlite.prepare(`SELECT * FROM device_sessions WHERE school_code = ?`).all(schoolCode);
  return { results, answers, subjectScores, deviceSessions, exportedAt: new Date().toISOString() };
}

// ── replicate import logic (mirrors POST /results-import) ────────────────────

async function cloudImport(client, schoolCode, payload) {
  const { results = [], answers = [], subjectScores = [], deviceSessions = [] } = payload;
  let inserted = 0, skipped = 0;
  const idMap = new Map();

  for (const row of results) {
    const retakeCount = row.retake_count ?? 0;
    const { rows: existing } = await client.query(
      `SELECT id FROM results WHERE student_id=$1 AND exam_id=$2 AND retake_count=$3 LIMIT 1`,
      [row.student_id, row.exam_id, retakeCount]
    );
    if (existing[0]) {
      idMap.set(row.id, existing[0].id);
      skipped++;
    } else {
      const { rows: created } = await client.query(
        `INSERT INTO results (exam_id,student_id,full_name,class,score,total_questions,percentage,school_code,term,retake_count,submitted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [row.exam_id, row.student_id, row.full_name, row.class, row.score, row.total_questions,
         row.percentage, schoolCode, row.term ?? "First Term", retakeCount,
         new Date(row.submitted_at)]
      );
      idMap.set(row.id, created[0].id);
      inserted++;
    }
  }

  for (const a of answers) {
    const cloudResultId = idMap.get(a.result_id);
    if (!cloudResultId) continue;
    await client.query(
      `INSERT INTO result_answers (result_id,question_id,question_text,option_a,option_b,option_c,option_d,correct_option,selected_option,is_correct,school_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
      [cloudResultId, a.question_id, a.question_text, a.option_a, a.option_b, a.option_c, a.option_d,
       a.correct_option, a.selected_option ?? null, a.is_correct ? true : false, schoolCode]
    );
  }

  for (const row of subjectScores) {
    await client.query(
      `INSERT INTO subject_scores
         (student_id,subject_name,class_name,school_code,term,academic_session,
          mid_term_score,mid_term_cbt_score,class_activity_score,exam_score,exam_cbt_score,
          total_score,percentage,grade,teacher_comment,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())
       ON CONFLICT (student_id,subject_name,term,academic_session) DO UPDATE SET
         mid_term_score      = COALESCE(EXCLUDED.mid_term_score,      subject_scores.mid_term_score),
         mid_term_cbt_score  = COALESCE(EXCLUDED.mid_term_cbt_score,  subject_scores.mid_term_cbt_score),
         class_activity_score= COALESCE(EXCLUDED.class_activity_score,subject_scores.class_activity_score),
         exam_score          = COALESCE(EXCLUDED.exam_score,          subject_scores.exam_score),
         exam_cbt_score      = COALESCE(EXCLUDED.exam_cbt_score,      subject_scores.exam_cbt_score),
         total_score         = COALESCE(EXCLUDED.total_score,         subject_scores.total_score),
         percentage          = COALESCE(EXCLUDED.percentage,          subject_scores.percentage),
         grade               = COALESCE(EXCLUDED.grade,               subject_scores.grade),
         teacher_comment     = COALESCE(EXCLUDED.teacher_comment,     subject_scores.teacher_comment),
         updated_at          = GREATEST(EXCLUDED.updated_at,          subject_scores.updated_at)`,
      [row.student_id, row.subject_name, row.class_name, schoolCode, row.term ?? "First Term",
       row.academic_session ?? "2025/2026",
       row.mid_term_score ?? null, row.mid_term_cbt_score ?? null, row.class_activity_score ?? null,
       row.exam_score ?? null, row.exam_cbt_score ?? null,
       row.total_score ?? null, row.percentage ?? null, row.grade ?? null, row.teacher_comment ?? null]
    );
  }

  for (const row of deviceSessions) {
    const firstSeen = new Date(row.first_seen * 1000); // SQLite integer timestamp
    const lastSeen = new Date(row.last_seen * 1000);
    await client.query(
      `INSERT INTO device_sessions
         (device_id,school_code,ip_address,user_agent,user_id,username,full_name,role,first_seen,last_seen)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (device_id) DO UPDATE SET
         first_seen  = LEAST(EXCLUDED.first_seen,    device_sessions.first_seen),
         last_seen   = GREATEST(EXCLUDED.last_seen,  device_sessions.last_seen),
         school_code = COALESCE(EXCLUDED.school_code, device_sessions.school_code),
         ip_address  = EXCLUDED.ip_address,
         user_agent  = EXCLUDED.user_agent,
         user_id     = EXCLUDED.user_id,
         username    = EXCLUDED.username,
         full_name   = EXCLUDED.full_name,
         role        = EXCLUDED.role`,
      [row.device_id, row.school_code ?? null, row.ip_address ?? null, row.user_agent ?? null,
       row.user_id ?? null, row.username ?? null, row.full_name ?? null, row.role ?? null,
       firstSeen, lastSeen]
    );
  }

  return { inserted, skipped, subjectScoresUpserted: subjectScores.length, deviceSessionsUpserted: deviceSessions.length };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║     PART C — End-to-End Sync Verification                    ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log("\nPostgres operations run inside a transaction that is ROLLED BACK.");
console.log("Zero test data survives in production.");

try {
  // ════════════════════════════════════════════════════════════════════════
  hr("TEST 1 — Results + subject_scores sync correctness");
  // ════════════════════════════════════════════════════════════════════════

  const sqlite = makeSQLite();
  const now = Math.floor(Date.now() / 1000);

  // ── Step 1.1: grade exam A for test student ──────────────────────────
  step("1.1", `Grade Exam A (CRS mid_term) for student ${STUDENT_ID}`);
  const resultA = sqlite.prepare(`
    INSERT INTO results (exam_id,student_id,full_name,class,score,total_questions,percentage,school_code,term,retake_count,submitted_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(EXAM_A_ID, STUDENT_ID, "ALABI ENIOLA ARINOLA", "JS2", 7, 10, 70.0, SCHOOL, TERM, 99, now);
  const localResultAId = resultA.lastInsertRowid;

  sqlite.prepare(`
    INSERT INTO result_answers (result_id,question_id,question_text,option_a,option_b,option_c,option_d,correct_option,selected_option,is_correct,school_code)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(localResultAId, 1001, "Q1 text", "A", "B", "C", "D", "A", "A", 1, SCHOOL);

  // CRS mid_term → midTermScore + midTermCbtScore
  sqlite.prepare(`
    INSERT INTO subject_scores (student_id,subject_name,class_name,school_code,term,academic_session,mid_term_score,mid_term_cbt_score,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(STUDENT_ID, "CHRISTIAN RELIGIOUS STUDIES", "JS2", SCHOOL, TERM, SESSION, 14, 7, now, now);

  show("Local SQLite results", sqlite.prepare("SELECT id,exam_id,student_id,score,total_questions FROM results").all());
  show("Local SQLite subject_scores", sqlite.prepare("SELECT student_id,subject_name,term,mid_term_score,mid_term_cbt_score,exam_score FROM subject_scores").all());

  // ── Step 1.2: Export and import to cloud (first sync) ────────────────
  step("1.2", "Export from local, import into cloud (first sync)");
  await client.query("BEGIN");

  const export1 = localExport(sqlite, SCHOOL);
  console.log(`  Export payload: ${export1.results.length} results, ${export1.subjectScores.length} subject_scores`);

  const import1 = await cloudImport(client, SCHOOL, export1);
  console.log(`  Import result:`, import1);

  const { rows: cloudSS1 } = await client.query(
    `SELECT student_id, subject_name, term, academic_session,
            mid_term_score, mid_term_cbt_score, class_activity_score,
            exam_score, exam_cbt_score, total_score, percentage, grade
     FROM subject_scores
     WHERE student_id=$1 AND term=$2 AND academic_session=$3
     ORDER BY subject_name`,
    [STUDENT_ID, TERM, SESSION]
  );
  show("Cloud subject_scores AFTER first import", cloudSS1);

  // ── Step 1.3: Import same file again (idempotency check) ─────────────
  step("1.3", "Import same payload AGAIN — idempotency check");
  const import2 = await cloudImport(client, SCHOOL, export1);
  console.log(`  Import result:`, import2);

  const { rows: cloudSS2 } = await client.query(
    `SELECT student_id, subject_name, term, academic_session,
            mid_term_score, mid_term_cbt_score, class_activity_score,
            exam_score, exam_cbt_score, total_score, percentage, grade
     FROM subject_scores
     WHERE student_id=$1 AND term=$2 AND academic_session=$3
     ORDER BY subject_name`,
    [STUDENT_ID, TERM, SESSION]
  );
  show("Cloud subject_scores AFTER second (duplicate) import", cloudSS2);

  // Compare
  const identical = JSON.stringify(cloudSS1) === JSON.stringify(cloudSS2);
  console.log(`\n  ✓ Idempotency: rows are ${identical ? "IDENTICAL ✓" : "DIFFERENT ✗ — BUG"}`);

  // ── Step 1.4: Grade exam B, sync again — test merge logic ────────────
  step("1.4", `Grade Exam B (CHM exam) for same student, then re-sync`);
  const resultB = sqlite.prepare(`
    INSERT INTO results (exam_id,student_id,full_name,class,score,total_questions,percentage,school_code,term,retake_count,submitted_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(EXAM_B_ID, STUDENT_ID, "ALABI ENIOLA ARINOLA", "JS2", 6, 10, 60.0, SCHOOL, TERM, 99, now + 1);
  const localResultBId = resultB.lastInsertRowid;

  sqlite.prepare(`
    INSERT INTO result_answers (result_id,question_id,question_text,option_a,option_b,option_c,option_d,correct_option,selected_option,is_correct,school_code)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(localResultBId, 2001, "Chem Q1", "A", "B", "C", "D", "B", "B", 1, SCHOOL);

  // CHM exam → examScore + examCbtScore (different row from CRS because different subject)
  sqlite.prepare(`
    INSERT INTO subject_scores (student_id,subject_name,class_name,school_code,term,academic_session,exam_score,exam_cbt_score,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT (student_id,subject_name,term,academic_session) DO UPDATE SET
      exam_score=EXCLUDED.exam_score, exam_cbt_score=EXCLUDED.exam_cbt_score, updated_at=EXCLUDED.updated_at
  `).run(STUDENT_ID, "CHEMISTRY (CHM)", "JS2", SCHOOL, TERM, SESSION, 12, 6, now + 1, now + 1);

  show("Local SQLite subject_scores (after exam B)", sqlite.prepare("SELECT student_id,subject_name,mid_term_score,exam_score FROM subject_scores").all());

  const export2 = localExport(sqlite, SCHOOL);
  console.log(`\n  Export payload: ${export2.results.length} results, ${export2.subjectScores.length} subject_scores`);

  const import3 = await cloudImport(client, SCHOOL, export2);
  console.log(`  Import result:`, import3);

  const { rows: cloudSS3 } = await client.query(
    `SELECT student_id, subject_name, term, academic_session,
            mid_term_score, mid_term_cbt_score, class_activity_score,
            exam_score, exam_cbt_score, total_score, percentage, grade
     FROM subject_scores
     WHERE student_id=$1 AND term=$2 AND academic_session=$3
     ORDER BY subject_name`,
    [STUDENT_ID, TERM, SESSION]
  );
  show("Cloud subject_scores AFTER exam B sync", cloudSS3);

  const crsRow = cloudSS3.find(r => r.subject_name === "CHRISTIAN RELIGIOUS STUDIES");
  const chmRow = cloudSS3.find(r => r.subject_name === "CHEMISTRY (CHM)");
  console.log(`\n  ✓ CRS still has mid_term_score=${crsRow?.mid_term_score} (not overwritten): ${crsRow?.mid_term_score === 14 ? "✓ CORRECT" : "✗ BUG"}`);
  console.log(`  ✓ CHM now has exam_score=${chmRow?.exam_score}: ${chmRow?.exam_score === 12 ? "✓ CORRECT" : "✗ BUG"}`);
  console.log(`  ✓ Two separate rows (one per subject): ${cloudSS3.length === 2 ? "✓ CORRECT" : "✗ BUG — expected 2 rows, got " + cloudSS3.length}`);

  await client.query("ROLLBACK");
  console.log("\n  ✓ Postgres transaction rolled back — zero test data in production");

  // ════════════════════════════════════════════════════════════════════════
  hr("TEST 2 — Device tracking persistence + sync");
  // ════════════════════════════════════════════════════════════════════════

  const sqlite2 = makeSQLite();
  const firstSeenTs = now - 3600; // pretend device first seen 1 hour ago

  // ── Step 2.1: Insert device_sessions into SQLite (simulating heartbeat)
  step("2.1", "Insert device_sessions into SQLite (simulate heartbeat)");
  sqlite2.prepare(`
    INSERT INTO device_sessions (device_id,school_code,ip_address,user_agent,user_id,username,full_name,role,first_seen,last_seen)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(DEVICE_ID, SCHOOL, "192.168.1.50", "Mozilla/5.0 (Test)", STUDENT_ID, "student105",
         "ALABI ENIOLA ARINOLA", "student", firstSeenTs, firstSeenTs);

  show("SQLite device_sessions AFTER heartbeat", sqlite2.prepare("SELECT device_id,school_code,first_seen,last_seen FROM device_sessions").all());

  // ── Step 2.2: Simulate server restart by closing & reopening SQLite ──
  step("2.2", "Simulate server restart: close + reopen SQLite connection");
  const dbPath2 = "/tmp/test-e2e-device.db";

  // Write to a real file, close, reopen
  const sqlite2file = new Database(dbPath2);
  sqlite2file.exec(`
    CREATE TABLE IF NOT EXISTS device_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    )
  `);
  sqlite2file.prepare(`
    INSERT INTO device_sessions (device_id,school_code,ip_address,user_agent,user_id,username,full_name,role,first_seen,last_seen)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(DEVICE_ID, SCHOOL, "192.168.1.50", "Mozilla/5.0 (Test)", STUDENT_ID, "student105",
         "ALABI ENIOLA ARINOLA", "student", firstSeenTs, firstSeenTs);

  console.log("  Wrote to file, closing connection...");
  sqlite2file.close();
  console.log("  Connection closed (simulating process exit)");

  // ── Step 2.3: Reopen and verify row persists ─────────────────────────
  step("2.3", "Reopen SQLite and verify row persists after restart");
  const sqlite2reopened = new Database(dbPath2);
  const persisted = sqlite2reopened.prepare("SELECT * FROM device_sessions WHERE device_id = ?").all(DEVICE_ID);
  show("SQLite AFTER REOPEN", persisted.map(r => ({
    device_id: r.device_id,
    school_code: r.school_code,
    first_seen: new Date(r.first_seen * 1000).toISOString(),
    last_seen: new Date(r.last_seen * 1000).toISOString(),
  })));
  console.log(`  ✓ Row persisted after restart: ${persisted.length === 1 ? "✓ YES" : "✗ NO — BUG"}`);

  // ── Step 2.4: Second heartbeat updates last_seen ─────────────────────
  step("2.4", "Second heartbeat updates last_seen");
  const secondHeartbeat = firstSeenTs + 3600; // 1 hour later
  sqlite2reopened.prepare(`
    INSERT INTO device_sessions (device_id,school_code,ip_address,user_agent,user_id,username,full_name,role,first_seen,last_seen)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT (device_id) DO UPDATE SET
      last_seen = MAX(EXCLUDED.last_seen, device_sessions.last_seen),
      school_code = COALESCE(EXCLUDED.school_code, device_sessions.school_code)
  `).run(DEVICE_ID, SCHOOL, "192.168.1.51", "Mozilla/5.0 (Test)", STUDENT_ID, "student105",
         "ALABI ENIOLA ARINOLA", "student", firstSeenTs, secondHeartbeat);

  const afterSecondHB = sqlite2reopened.prepare("SELECT * FROM device_sessions WHERE device_id = ?").all(DEVICE_ID);
  show("SQLite AFTER second heartbeat", afterSecondHB.map(r => ({
    device_id: r.device_id,
    first_seen: new Date(r.first_seen * 1000).toISOString(),
    last_seen: new Date(r.last_seen * 1000).toISOString(),
  })));

  // ── Step 2.5: Sync device_sessions to cloud ──────────────────────────
  step("2.5", "Sync device_sessions to cloud (first sync)");
  await client.query("BEGIN");

  const deviceExport = { results: [], answers: [], subjectScores: [], deviceSessions: afterSecondHB };
  const dsImport1 = await cloudImport(client, SCHOOL, deviceExport);
  console.log("  Import result:", dsImport1);

  const { rows: cloudDS1 } = await client.query(
    `SELECT device_id, school_code, ip_address,
            first_seen, last_seen
     FROM device_sessions WHERE device_id = $1`,
    [DEVICE_ID]
  );
  show("Cloud device_sessions AFTER first sync", cloudDS1.map(r => ({
    device_id: r.device_id,
    school_code: r.school_code,
    first_seen: r.first_seen?.toISOString(),
    last_seen: r.last_seen?.toISOString(),
    first_seen_matches_original: new Date(r.first_seen).getTime() === firstSeenTs * 1000 ? "✓ YES" : "✗ NO",
  })));

  const expectedFirstSeen = new Date(firstSeenTs * 1000).toISOString();
  const expectedLastSeen = new Date(secondHeartbeat * 1000).toISOString();
  console.log(`  ✓ first_seen = original (${expectedFirstSeen}): ${
    cloudDS1[0] && Math.abs(new Date(cloudDS1[0].first_seen).getTime() - firstSeenTs * 1000) < 1000 ? "✓ CORRECT" : "✗ BUG"
  }`);
  console.log(`  ✓ last_seen = second heartbeat (${expectedLastSeen}): ${
    cloudDS1[0] && Math.abs(new Date(cloudDS1[0].last_seen).getTime() - secondHeartbeat * 1000) < 1000 ? "✓ CORRECT" : "✗ BUG"
  }`);

  // ── Step 2.6: Sync again (no new heartbeat) — idempotency ───────────
  step("2.6", "Sync same device_sessions again — idempotency check");
  const dsImport2 = await cloudImport(client, SCHOOL, deviceExport);
  console.log("  Import result:", dsImport2);

  const { rows: cloudDS2 } = await client.query(
    `SELECT device_id, first_seen, last_seen FROM device_sessions WHERE device_id = $1`,
    [DEVICE_ID]
  );
  show("Cloud device_sessions AFTER second sync", cloudDS2.map(r => ({
    device_id: r.device_id,
    first_seen: r.first_seen?.toISOString(),
    last_seen: r.last_seen?.toISOString(),
  })));

  const { rows: countRows } = await client.query(
    `SELECT COUNT(*) as cnt FROM device_sessions WHERE device_id = $1`, [DEVICE_ID]
  );
  console.log(`  ✓ Row count = 1 (no duplicate): ${countRows[0].cnt === "1" ? "✓ CORRECT" : "✗ BUG — got " + countRows[0].cnt}`);

  const ts1 = JSON.stringify(cloudDS1.map(r => ({ f: r.first_seen, l: r.last_seen })));
  const ts2 = JSON.stringify(cloudDS2.map(r => ({ f: r.first_seen, l: r.last_seen })));
  console.log(`  ✓ Timestamps unchanged after re-sync: ${ts1 === ts2 ? "✓ CORRECT" : "✗ BUG"}`);

  await client.query("ROLLBACK");
  console.log("\n  ✓ Postgres transaction rolled back — zero test data in production");

  // Cleanup SQLite file
  sqlite2reopened.close();
  try { await unlink(dbPath2); } catch {}

  // ════════════════════════════════════════════════════════════════════════
  hr("ALL TESTS COMPLETE");
  // ════════════════════════════════════════════════════════════════════════
  console.log("\n  Review the output above for any ✗ BUG markers.");
  console.log("  All production data was protected by transaction ROLLBACK.\n");

} catch (err) {
  console.error("\n  FATAL ERROR:", err.message, "\n", err.stack);
  try { await client.query("ROLLBACK"); } catch {}
} finally {
  client.release();
  await pool.end();
}
