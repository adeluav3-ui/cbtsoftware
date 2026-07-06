/**
 * End-to-end sync verification — PART C pilot sign-off.
 *
 * Local "server": Node.js 22 built-in node:sqlite (no native compile needed)
 * Cloud "server": live Postgres — ALL writes inside a transaction that ROLLS BACK.
 *                 Zero test data survives in production.
 *
 * School:  NEW-1001 | Student: 105 (ALABI ENIOLA ARINOLA)
 * Exam A:  59  (CHRISTIAN RELIGIOUS STUDIES, mid_term, Third Term)
 * Exam B:  92  (CHEMISTRY (CHM), exam, Third Term)
 * Device:  test-device-e2e-verify-001
 */
import { createRequire } from "module";
import { unlink, writeFile, readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { DatabaseSync } from "node:sqlite"; // Node 22 built-in, no native compile

const __dir = dirname(fileURLToPath(import.meta.url));
const requireDb = createRequire(join(__dir, "../lib/db/package.json"));
const dotenv = requireDb("dotenv");
const { Pool } = requireDb("pg");

dotenv.config({ path: join(__dir, "../lib/db/.env") });

const SCHOOL = "NEW-1001";
const STUDENT_ID = 105;
const EXAM_A_ID = 59;
const EXAM_B_ID = 92;
const TERM = "Third Term";
const SESSION = "2025/2026";
const DEVICE_ID = "test-device-e2e-verify-001";

// Resolved at runtime from the live DB (real FKs — no synthetic IDs)
let Q_A_ID = null; // question belonging to exam 59
let Q_B_ID = null; // question belonging to exam 92

// ── helpers ──────────────────────────────────────────────────────────────────
const hr = lbl => console.log(`\n${"─".repeat(65)}\n${lbl}\n${"─".repeat(65)}`);
const step = (n, t) => console.log(`\n  [${n}] ${t}`);
function show(label, rows) {
  console.log(`\n  ${label}:`);
  if (!rows?.length) { console.log("    (empty)"); return; }
  rows.forEach(r => console.log("   ", JSON.stringify(r)));
}

// ── SQLite factory (node:sqlite) ──────────────────────────────────────────────
function makeSqlite(path = ":memory:") {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INT NOT NULL, student_id INT NOT NULL,
      full_name TEXT NOT NULL, class TEXT NOT NULL,
      score INT NOT NULL, total_questions INT NOT NULL,
      percentage REAL NOT NULL, school_code TEXT NOT NULL,
      term TEXT DEFAULT 'First Term', retake_count INT DEFAULT 0,
      submitted_at INT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS result_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, result_id INT NOT NULL,
      question_id INT NOT NULL, question_text TEXT NOT NULL,
      option_a TEXT NOT NULL, option_b TEXT NOT NULL,
      option_c TEXT NOT NULL, option_d TEXT NOT NULL,
      correct_option TEXT NOT NULL, selected_option TEXT,
      is_correct INT NOT NULL DEFAULT 0, school_code TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS subject_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INT NOT NULL, subject_name TEXT NOT NULL,
      class_name TEXT NOT NULL, school_code TEXT NOT NULL,
      term TEXT DEFAULT 'First Term', academic_session TEXT DEFAULT '2025/2026',
      mid_term_score INT, mid_term_cbt_score INT,
      class_activity_score INT, exam_score INT, exam_cbt_score INT,
      total_score INT, percentage INT, grade TEXT, teacher_comment TEXT,
      created_at INT NOT NULL, updated_at INT NOT NULL,
      UNIQUE (student_id, subject_name, term, academic_session)
    );
    CREATE TABLE IF NOT EXISTS device_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL UNIQUE, school_code TEXT,
      ip_address TEXT, user_agent TEXT, user_id INT,
      username TEXT, full_name TEXT, role TEXT,
      first_seen INT NOT NULL, last_seen INT NOT NULL
    );
  `);
  return db;
}

// ── Export (mirrors GET /results-export) ─────────────────────────────────────
function localExport(db, school) {
  const results = db.prepare("SELECT * FROM results WHERE school_code=?").all(school);
  const ids = results.map(r => r.id);
  const answers = ids.length
    ? db.prepare(`SELECT * FROM result_answers WHERE result_id IN (${ids.map(()=>"?").join(",")})`).all(...ids)
    : [];
  return {
    results,
    answers,
    subjectScores: db.prepare("SELECT * FROM subject_scores WHERE school_code=?").all(school),
    deviceSessions: db.prepare("SELECT * FROM device_sessions WHERE school_code=?").all(school),
  };
}

// ── Import (mirrors POST /results-import) ─────────────────────────────────────
async function cloudImport(client, school, { results=[], answers=[], subjectScores=[], deviceSessions=[] }) {
  let inserted=0, skipped=0;
  const idMap = new Map();

  for (const row of results) {
    const rc = row.retake_count ?? 0;
    const { rows: ex } = await client.query(
      "SELECT id FROM results WHERE student_id=$1 AND exam_id=$2 AND retake_count=$3 LIMIT 1",
      [row.student_id, row.exam_id, rc]);
    if (ex[0]) { idMap.set(row.id, ex[0].id); skipped++; continue; }
    const ts = typeof row.submitted_at === "number"
      ? new Date(row.submitted_at * 1000) : new Date(row.submitted_at);
    const { rows: cr } = await client.query(
      `INSERT INTO results (exam_id,student_id,full_name,class,score,total_questions,percentage,school_code,term,retake_count,submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [row.exam_id, row.student_id, row.full_name, row.class, row.score,
       row.total_questions, row.percentage, school, row.term??"First Term", rc, ts]);
    idMap.set(row.id, cr[0].id); inserted++;
  }

  for (const a of answers) {
    const cid = idMap.get(a.result_id); if (!cid) continue;
    await client.query(
      `INSERT INTO result_answers (result_id,question_id,question_text,option_a,option_b,option_c,option_d,
        correct_option,selected_option,is_correct,school_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
      [cid, a.question_id, a.question_text, a.option_a, a.option_b, a.option_c,
       a.option_d, a.correct_option, a.selected_option??null, a.is_correct?true:false, school]);
  }

  for (const row of subjectScores) {
    await client.query(
      `INSERT INTO subject_scores
         (student_id,subject_name,class_name,school_code,term,academic_session,
          mid_term_score,mid_term_cbt_score,class_activity_score,
          exam_score,exam_cbt_score,total_score,percentage,grade,teacher_comment,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())
       ON CONFLICT (student_id,subject_name,term,academic_session) DO UPDATE SET
         mid_term_score       = COALESCE(EXCLUDED.mid_term_score,      subject_scores.mid_term_score),
         mid_term_cbt_score   = COALESCE(EXCLUDED.mid_term_cbt_score,  subject_scores.mid_term_cbt_score),
         class_activity_score = COALESCE(EXCLUDED.class_activity_score,subject_scores.class_activity_score),
         exam_score           = COALESCE(EXCLUDED.exam_score,          subject_scores.exam_score),
         exam_cbt_score       = COALESCE(EXCLUDED.exam_cbt_score,      subject_scores.exam_cbt_score),
         total_score          = COALESCE(EXCLUDED.total_score,         subject_scores.total_score),
         percentage           = COALESCE(EXCLUDED.percentage,          subject_scores.percentage),
         grade                = COALESCE(EXCLUDED.grade,               subject_scores.grade),
         teacher_comment      = COALESCE(EXCLUDED.teacher_comment,     subject_scores.teacher_comment),
         updated_at           = GREATEST(EXCLUDED.updated_at,          subject_scores.updated_at)`,
      [row.student_id, row.subject_name, row.class_name, school,
       row.term??"First Term", row.academic_session??"2025/2026",
       row.mid_term_score??null, row.mid_term_cbt_score??null, row.class_activity_score??null,
       row.exam_score??null, row.exam_cbt_score??null,
       row.total_score??null, row.percentage??null, row.grade??null, row.teacher_comment??null]);
  }

  for (const row of deviceSessions) {
    // Send as bare UTC strings (no 'Z' suffix) so Postgres stores them verbatim
    // in TIMESTAMP WITHOUT TIME ZONE columns — avoids local-timezone offset shift.
    const toUtcStr = epoch => new Date(epoch * 1000).toISOString().replace("T", " ").replace("Z", "");
    const first = typeof row.first_seen === "number" ? toUtcStr(row.first_seen) : new Date(row.first_seen).toISOString().replace("T", " ").replace("Z", "");
    const last  = typeof row.last_seen  === "number" ? toUtcStr(row.last_seen)  : new Date(row.last_seen ).toISOString().replace("T", " ").replace("Z", "");
    await client.query(
      `INSERT INTO device_sessions
         (device_id,school_code,ip_address,user_agent,user_id,username,full_name,role,first_seen,last_seen)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (device_id) DO UPDATE SET
         first_seen  = LEAST(EXCLUDED.first_seen,    device_sessions.first_seen),
         last_seen   = GREATEST(EXCLUDED.last_seen,  device_sessions.last_seen),
         school_code = COALESCE(EXCLUDED.school_code, device_sessions.school_code),
         ip_address  = EXCLUDED.ip_address, user_agent = EXCLUDED.user_agent,
         user_id     = EXCLUDED.user_id,   username   = EXCLUDED.username,
         full_name   = EXCLUDED.full_name, role       = EXCLUDED.role`,
      [row.device_id, row.school_code??null, row.ip_address??null, row.user_agent??null,
       row.user_id??null, row.username??null, row.full_name??null, row.role??null, first, last]);
  }

  return { inserted, skipped, ssUpserted: subjectScores.length, dsUpserted: deviceSessions.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

console.log("\n╔═════════════════════════════════════════════════════════════════╗");
console.log("║     PART C — End-to-End Sync Verification                       ║");
console.log("╚═════════════════════════════════════════════════════════════════╝");
console.log("\nAll Postgres writes run inside a ROLLBACK transaction.");
console.log("Zero test data survives in production after the script exits.\n");

try {
  // Fetch real question IDs so result_answers FK constraints don't fire
  { const { rows } = await pool.query(
      "SELECT id, exam_id FROM questions WHERE exam_id = ANY($1) LIMIT 2",
      [[EXAM_A_ID, EXAM_B_ID]]);
    for (const row of rows) {
      if (row.exam_id === EXAM_A_ID) Q_A_ID = row.id;
      else Q_B_ID = row.id;
    }
    // Dedicated fetch if one exam had no rows in the first query
    if (!Q_A_ID) { const r = await pool.query("SELECT id FROM questions WHERE exam_id=$1 LIMIT 1",[EXAM_A_ID]); Q_A_ID = r.rows[0]?.id ?? null; }
    if (!Q_B_ID) { const r = await pool.query("SELECT id FROM questions WHERE exam_id=$1 LIMIT 1",[EXAM_B_ID]); Q_B_ID = r.rows[0]?.id ?? null; }
    console.log(`  Real question IDs: exam ${EXAM_A_ID} → ${Q_A_ID}, exam ${EXAM_B_ID} → ${Q_B_ID}`);
    if (!Q_A_ID || !Q_B_ID) throw new Error("No questions found for one or both test exams — cannot test result_answers FK"); }

  // ══════════════════════════════════════════════════════════════════════
  hr("TEST 1 — Results + subject_scores sync correctness");
  // ══════════════════════════════════════════════════════════════════════

  const local = makeSqlite();
  const now = Math.floor(Date.now() / 1000);

  step("1.1", `Simulate grading Exam A (CRS mid_term, score=7/10) for student ${STUDENT_ID}`);
  const stmtR = local.prepare(
    `INSERT INTO results (exam_id,student_id,full_name,class,score,total_questions,percentage,school_code,term,retake_count,submitted_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const rA = stmtR.run(EXAM_A_ID, STUDENT_ID, "ALABI ENIOLA ARINOLA", "JS2", 7, 10, 70.0, SCHOOL, TERM, 99, now);

  local.prepare(
    `INSERT INTO result_answers (result_id,question_id,question_text,option_a,option_b,option_c,option_d,correct_option,selected_option,is_correct,school_code)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(rA.lastInsertRowid, Q_A_ID, "CRS Q1", "A","B","C","D","A","A", 1, SCHOOL);

  // CRS mid_term → mid_term_score=14 (total), mid_term_cbt_score=7 (cbt portion)
  local.prepare(
    `INSERT INTO subject_scores (student_id,subject_name,class_name,school_code,term,academic_session,
      mid_term_score,mid_term_cbt_score,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(STUDENT_ID,"CHRISTIAN RELIGIOUS STUDIES","JS2",SCHOOL,TERM,SESSION, 14, 7, now, now);

  show("Local subject_scores (Exam A only)",
    local.prepare("SELECT student_id,subject_name,mid_term_score,mid_term_cbt_score,exam_score FROM subject_scores").all());

  step("1.2", "First sync: export from local → import into cloud");
  await client.query("BEGIN");

  const e1 = localExport(local, SCHOOL);
  console.log(`  Export payload: ${e1.results.length} result(s), ${e1.subjectScores.length} subject_score(s), ${e1.answers.length} answer(s)`);
  const i1 = await cloudImport(client, SCHOOL, e1);
  console.log("  Import stats:", i1);

  const q1 = `SELECT student_id,subject_name,term,academic_session,mid_term_score,mid_term_cbt_score,
                      class_activity_score,exam_score,exam_cbt_score,total_score,percentage,grade
               FROM subject_scores WHERE student_id=$1 AND term=$2 AND academic_session=$3
               ORDER BY subject_name`;
  const { rows: ss1 } = await client.query(q1, [STUDENT_ID, TERM, SESSION]);
  show("Cloud subject_scores after FIRST import", ss1);

  step("1.3", "Second import of identical payload — idempotency check");
  const i2 = await cloudImport(client, SCHOOL, e1);
  console.log("  Import stats:", i2);
  const { rows: ss2 } = await client.query(q1, [STUDENT_ID, TERM, SESSION]);
  show("Cloud subject_scores after SECOND (duplicate) import", ss2);
  const { rows: rc } = await client.query(
    "SELECT COUNT(*) n FROM results WHERE student_id=$1 AND exam_id=$2 AND retake_count=99",
    [STUDENT_ID, EXAM_A_ID]);
  console.log(`\n  result row count (expect 1, not 2): ${rc[0].n}`);
  console.log(`  ✓ Idempotent: ${JSON.stringify(ss1)===JSON.stringify(ss2) ? "PASS — rows identical" : "FAIL — rows differ"}`);

  step("1.4", "Grade Exam B (CHM exam, score=6/10) locally then sync — merge test");
  const rB = stmtR.run(EXAM_B_ID, STUDENT_ID, "ALABI ENIOLA ARINOLA", "JS2", 6, 10, 60.0, SCHOOL, TERM, 99, now+1);
  local.prepare(
    `INSERT INTO result_answers (result_id,question_id,question_text,option_a,option_b,option_c,option_d,correct_option,selected_option,is_correct,school_code)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(rB.lastInsertRowid, Q_B_ID, "CHM Q1","A","B","C","D","B","B", 1, SCHOOL);
  // CHM exam → exam_score=12, exam_cbt_score=6 (new row, different subject)
  local.prepare(
    `INSERT INTO subject_scores (student_id,subject_name,class_name,school_code,term,academic_session,
      exam_score,exam_cbt_score,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT (student_id,subject_name,term,academic_session) DO UPDATE
       SET exam_score=EXCLUDED.exam_score,exam_cbt_score=EXCLUDED.exam_cbt_score,updated_at=EXCLUDED.updated_at`
  ).run(STUDENT_ID,"CHEMISTRY (CHM)","JS2",SCHOOL,TERM,SESSION, 12, 6, now+1, now+1);

  show("Local subject_scores (both exams)", local.prepare(
    "SELECT subject_name,mid_term_score,mid_term_cbt_score,exam_score,exam_cbt_score FROM subject_scores"
  ).all());

  const e2 = localExport(local, SCHOOL);
  console.log(`\n  Export: ${e2.results.length} result(s), ${e2.subjectScores.length} subject_score(s)`);
  const i3 = await cloudImport(client, SCHOOL, e2);
  console.log("  Import stats:", i3);
  const { rows: ss3 } = await client.query(q1, [STUDENT_ID, TERM, SESSION]);
  show("Cloud subject_scores after exam B sync", ss3);

  const crs = ss3.find(r => r.subject_name === "CHRISTIAN RELIGIOUS STUDIES");
  const chm = ss3.find(r => r.subject_name === "CHEMISTRY (CHM)");
  console.log(`\n  ✓ Row count (expect 2): ${ss3.length===2 ? `PASS (${ss3.length})` : `FAIL (got ${ss3.length})`}`);
  console.log(`  ✓ CRS mid_term_score=14 preserved: ${crs?.mid_term_score===14 ? "PASS" : `FAIL (got ${crs?.mid_term_score})`}`);
  console.log(`  ✓ CRS mid_term_cbt_score=7 preserved: ${crs?.mid_term_cbt_score===7 ? "PASS" : `FAIL (got ${crs?.mid_term_cbt_score})`}`);
  console.log(`  ✓ CRS exam_score still null: ${crs?.exam_score===null ? "PASS" : `FAIL (got ${crs?.exam_score})`}`);
  console.log(`  ✓ CHM exam_score=12: ${chm?.exam_score===12 ? "PASS" : `FAIL (got ${chm?.exam_score})`}`);
  console.log(`  ✓ CHM exam_cbt_score=6: ${chm?.exam_cbt_score===6 ? "PASS" : `FAIL (got ${chm?.exam_cbt_score})`}`);

  await client.query("ROLLBACK");
  console.log("\n  Postgres ROLLBACK — zero test data in production.");

  // ══════════════════════════════════════════════════════════════════════
  hr("TEST 2 — Device tracking: persistence through restart + sync");
  // ══════════════════════════════════════════════════════════════════════

  const DB_FILE = join(__dir, "_test-device-e2e-tmp.db");
  const firstSeenEpoch = now - 3600;

  step("2.1", "Heartbeat arrives → insert device_sessions row into local SQLite file DB");
  const local2 = makeSqlite(DB_FILE);
  local2.prepare(
    `INSERT INTO device_sessions (device_id,school_code,ip_address,user_agent,user_id,username,full_name,role,first_seen,last_seen)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT (device_id) DO UPDATE SET
       last_seen=MAX(EXCLUDED.last_seen,device_sessions.last_seen),
       school_code=COALESCE(EXCLUDED.school_code,device_sessions.school_code),
       ip_address=EXCLUDED.ip_address, user_agent=EXCLUDED.user_agent,
       user_id=EXCLUDED.user_id, username=EXCLUDED.username,
       full_name=EXCLUDED.full_name, role=EXCLUDED.role`
  ).run(DEVICE_ID, SCHOOL,"192.168.1.50","Mozilla/5.0 (Test)",
        STUDENT_ID,"student105","ALABI ENIOLA ARINOLA","student",
        firstSeenEpoch, firstSeenEpoch);

  const before = local2.prepare("SELECT * FROM device_sessions WHERE device_id=?").all(DEVICE_ID);
  show("SQLite BEFORE restart", before.map(r=>({
    device_id:r.device_id, school_code:r.school_code,
    first_seen:new Date(r.first_seen*1000).toISOString(),
    last_seen:new Date(r.last_seen*1000).toISOString(),
  })));

  step("2.2", "Simulate server restart: close SQLite connection, then reopen");
  local2.close();
  console.log("  SQLite closed (process exit simulated).");
  const local2b = makeSqlite(DB_FILE);
  console.log("  SQLite reopened (process restart simulated).");

  step("2.3", "Verify row persists after restart");
  const afterRestart = local2b.prepare("SELECT * FROM device_sessions WHERE device_id=?").all(DEVICE_ID);
  show("SQLite AFTER restart", afterRestart.map(r=>({
    device_id:r.device_id,
    first_seen:new Date(r.first_seen*1000).toISOString(),
    last_seen:new Date(r.last_seen*1000).toISOString(),
  })));
  console.log(`  ✓ Row persists: ${afterRestart.length===1 ? "PASS" : "FAIL — row lost after restart"}`);
  console.log(`  ✓ first_seen unchanged: ${afterRestart[0]?.first_seen===firstSeenEpoch ? "PASS" : "FAIL"}`);

  step("2.4", "Second heartbeat (1 hour later) updates last_seen only");
  const secondHB = firstSeenEpoch + 3600;
  local2b.prepare(
    `INSERT INTO device_sessions (device_id,school_code,ip_address,user_agent,user_id,username,full_name,role,first_seen,last_seen)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT (device_id) DO UPDATE SET
       last_seen=MAX(EXCLUDED.last_seen,device_sessions.last_seen),
       school_code=COALESCE(EXCLUDED.school_code,device_sessions.school_code),
       ip_address=EXCLUDED.ip_address, user_agent=EXCLUDED.user_agent,
       user_id=EXCLUDED.user_id, username=EXCLUDED.username,
       full_name=EXCLUDED.full_name, role=EXCLUDED.role`
  ).run(DEVICE_ID, SCHOOL,"192.168.1.50","Mozilla/5.0 (Test)",
        STUDENT_ID,"student105","ALABI ENIOLA ARINOLA","student",
        firstSeenEpoch, secondHB);

  const afterHB2 = local2b.prepare("SELECT * FROM device_sessions WHERE device_id=?").all(DEVICE_ID);
  show("SQLite after second heartbeat", afterHB2.map(r=>({
    device_id:r.device_id,
    first_seen:new Date(r.first_seen*1000).toISOString(),
    last_seen:new Date(r.last_seen*1000).toISOString(),
  })));
  console.log(`  ✓ first_seen still ${new Date(firstSeenEpoch*1000).toISOString()}: ${afterHB2[0]?.first_seen===firstSeenEpoch ? "PASS" : "FAIL"}`);
  console.log(`  ✓ last_seen updated to ${new Date(secondHB*1000).toISOString()}: ${afterHB2[0]?.last_seen===secondHB ? "PASS" : "FAIL"}`);

  step("2.5", "Sync device_sessions to cloud (first sync)");
  await client.query("BEGIN");
  const devExport = localExport(local2b, SCHOOL);
  console.log(`  Payload: ${devExport.deviceSessions.length} device_session(s)`);
  show("Exported device_sessions", devExport.deviceSessions.map(r=>({
    device_id:r.device_id,
    first_seen:new Date(r.first_seen*1000).toISOString(),
    last_seen:new Date(r.last_seen*1000).toISOString(),
  })));

  const di1 = await cloudImport(client, SCHOOL, devExport);
  console.log("  Import stats:", di1);

  const qDS = (id) => client.query(
    `SELECT device_id, school_code,
            (first_seen AT TIME ZONE 'UTC') as first_seen,
            (last_seen  AT TIME ZONE 'UTC') as last_seen
     FROM device_sessions WHERE device_id=$1`, [id]);
  const { rows: cds1 } = await qDS(DEVICE_ID);
  show("Cloud device_sessions after FIRST sync", cds1.map(r=>({
    device_id:r.device_id, school_code:r.school_code,
    first_seen:new Date(r.first_seen).toISOString(),
    last_seen:new Date(r.last_seen).toISOString(),
  })));

  const cdFirst = cds1[0] ? Math.round(new Date(cds1[0].first_seen).getTime()/1000) : null;
  const cdLast  = cds1[0] ? Math.round(new Date(cds1[0].last_seen).getTime()/1000) : null;
  console.log(`  ✓ first_seen = original epoch ${firstSeenEpoch}: ${cdFirst===firstSeenEpoch ? "PASS" : `FAIL (got ${cdFirst})`}`);
  console.log(`  ✓ last_seen  = 2nd heartbeat epoch ${secondHB}: ${cdLast===secondHB ? "PASS" : `FAIL (got ${cdLast})`}`);

  step("2.6", "Sync same data again (no new heartbeat) — idempotency check");
  const di2 = await cloudImport(client, SCHOOL, devExport);
  console.log("  Import stats:", di2);
  const { rows: cds2 } = await qDS(DEVICE_ID);
  show("Cloud device_sessions after SECOND sync", cds2.map(r=>({
    device_id:r.device_id,
    first_seen:new Date(r.first_seen).toISOString(),
    last_seen:new Date(r.last_seen).toISOString(),
  })));
  const { rows: cnt } = await client.query(
    "SELECT COUNT(*) n FROM device_sessions WHERE device_id=$1", [DEVICE_ID]);
  console.log(`  ✓ Row count = 1 (no duplicate): ${cnt[0].n==="1" ? "PASS" : `FAIL (got ${cnt[0].n})`}`);
  const ts1 = cds1.map(r=>[new Date(r.first_seen).toISOString(), new Date(r.last_seen).toISOString()]);
  const ts2 = cds2.map(r=>[new Date(r.first_seen).toISOString(), new Date(r.last_seen).toISOString()]);
  console.log(`  ✓ Timestamps unchanged after re-sync: ${JSON.stringify(ts1)===JSON.stringify(ts2) ? "PASS" : "FAIL"}`);

  await client.query("ROLLBACK");
  console.log("\n  Postgres ROLLBACK — zero test data in production.");

  local2b.close();
  try { await unlink(DB_FILE); } catch {}

  hr("ALL TESTS COMPLETE — check for any FAIL markers above");

} catch (e) {
  console.error("\nFATAL:", e.message, "\n", e.stack);
  try { await client.query("ROLLBACK"); } catch {}
} finally {
  client.release();
  await pool.end();
}
