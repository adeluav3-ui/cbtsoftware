/**
 * Part C license-enforcement end-to-end test.
 *
 * Scenarios:
 *   1. Expired licenseValidUntil  → 423 LICENSE_EXPIRED on any school route
 *   2. Clock rollback (trusted_time_floor in future) → 423 CLOCK_TAMPER
 *   3. Background time-sync picks up extended license from cloud → 200 after update
 *   4. Valid license, clean clock → 200 on every school route
 *
 * The local server is started fresh for each scenario using the rebuilt
 * dist-local/server.mjs bundle. All test databases are temporary and deleted after the run.
 */

import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { existsSync, unlinkSync } from "fs";
import { tmpdir } from "os";

const __dir = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(__dir, "../artifacts/api-server/dist-local");
const NODE_EXE   = join(SERVER_DIR, "node-runtime", "node.exe");
const SERVER_MJS = join(SERVER_DIR, "server.mjs");

// Pull better-sqlite3 from dist-local (the compiled-for-portable-node build)
const reqLocal = createRequire(join(SERVER_DIR, "package.json"));
const Database = reqLocal("better-sqlite3");

// ── helpers ─────────────────────────────────────────────────────────────────
const hr   = label  => console.log(`\n${"═".repeat(68)}\n${label}\n${"═".repeat(68)}`);
const ok   = msg    => console.log(`  ✓ ${msg}`);
const fail = msg    => console.log(`  ✗ FAIL: ${msg}`);
const step = (n, t) => console.log(`\n  [${n}] ${t}`);
const showResp = (label, status, body) =>
  console.log(`  ${label}  →  HTTP ${status}  ${JSON.stringify(body)}`);

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// Plain-text password — auth route supports it (rolling bcrypt migration)
const PWD = "testpass123";

// ── SQLite setup ─────────────────────────────────────────────────────────────
function createTestDb(dbPath, {
  schoolCode = "TEST-001",
  licenseValidUntilMs = null,     // null = no license date
  trustedTimeFloor    = null,     // null = no floor ratchet
}) {
  if (existsSync(dbPath)) unlinkSync(dbPath);

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  // Minimal schema matching initDb (all tables local server expects)
  db.exec(`
    CREATE TABLE schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, code TEXT NOT NULL UNIQUE,
      name TEXT, logo_url TEXT, retake_passcode TEXT DEFAULT '1234',
      current_academic_session TEXT DEFAULT '2025/2026',
      current_term TEXT DEFAULT 'First Term',
      available_terms TEXT DEFAULT '["First Term","Second Term","Third Term"]',
      next_term_begins TEXT, is_disabled INTEGER NOT NULL DEFAULT 0,
      license_valid_until INTEGER, created_at INTEGER NOT NULL
    );
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      username TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL,
      full_name TEXT NOT NULL, school_code TEXT, class TEXT,
      profile_picture TEXT, generated_password TEXT, created_at INTEGER NOT NULL
    );
    CREATE INDEX users_school_code_idx ON users(school_code);
    CREATE TABLE exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, title TEXT NOT NULL,
      subject TEXT NOT NULL, class TEXT NOT NULL, duration_minutes INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0, school_code TEXT NOT NULL,
      teacher_id INTEGER NOT NULL, assessment_type TEXT DEFAULT 'exam',
      term TEXT DEFAULT 'First Term', created_at INTEGER NOT NULL
    );
    CREATE TABLE questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, exam_id INTEGER NOT NULL,
      text TEXT NOT NULL, option_a TEXT NOT NULL, option_b TEXT NOT NULL,
      option_c TEXT NOT NULL, option_d TEXT NOT NULL, correct_option TEXT NOT NULL,
      school_code TEXT NOT NULL, image_url TEXT, group_id INTEGER,
      group_order INTEGER DEFAULT 0, group_image_url TEXT,
      group_title TEXT, group_text TEXT
    );
    CREATE TABLE results (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, exam_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL, full_name TEXT NOT NULL, class TEXT NOT NULL,
      score INTEGER NOT NULL, total_questions INTEGER NOT NULL,
      percentage REAL NOT NULL, school_code TEXT NOT NULL,
      term TEXT DEFAULT 'First Term', retake_count INTEGER DEFAULT 0,
      submitted_at INTEGER NOT NULL
    );
    CREATE TABLE result_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, result_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL, question_text TEXT NOT NULL,
      option_a TEXT NOT NULL, option_b TEXT NOT NULL,
      option_c TEXT NOT NULL, option_d TEXT NOT NULL,
      correct_option TEXT NOT NULL, selected_option TEXT,
      is_correct INTEGER NOT NULL DEFAULT 0, school_code TEXT NOT NULL
    );
    CREATE TABLE grading_schemes (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, school_code TEXT NOT NULL,
      mid_term_total INTEGER NOT NULL DEFAULT 20, mid_term_cbt INTEGER NOT NULL DEFAULT 10,
      mid_term_theory INTEGER NOT NULL DEFAULT 10, exam_total INTEGER NOT NULL DEFAULT 60,
      exam_cbt INTEGER NOT NULL DEFAULT 30, exam_theory INTEGER NOT NULL DEFAULT 30,
      class_activity_total INTEGER NOT NULL DEFAULT 20,
      grade_a_min INTEGER NOT NULL DEFAULT 70, grade_b_min INTEGER NOT NULL DEFAULT 60,
      grade_c_min INTEGER NOT NULL DEFAULT 50, grade_d_min INTEGER NOT NULL DEFAULT 40,
      grade_f_max INTEGER NOT NULL DEFAULT 39,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE subject_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      student_id INTEGER NOT NULL, subject_name TEXT NOT NULL,
      class_name TEXT NOT NULL, school_code TEXT NOT NULL,
      term TEXT DEFAULT 'First Term', academic_session TEXT DEFAULT '2025/2026',
      mid_term_score INTEGER, mid_term_cbt_score INTEGER,
      class_activity_score INTEGER, exam_score INTEGER, exam_cbt_score INTEGER,
      total_score INTEGER, percentage INTEGER, grade TEXT, teacher_comment TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      UNIQUE (student_id, subject_name, term, academic_session)
    );
    CREATE TABLE subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL, level TEXT NOT NULL, school_code TEXT NOT NULL,
      created_at INTEGER NOT NULL, UNIQUE (name, school_code, level)
    );
    CREATE TABLE student_traits (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      student_id INTEGER NOT NULL, school_code TEXT NOT NULL,
      term TEXT NOT NULL DEFAULT 'First Term',
      academic_session TEXT NOT NULL DEFAULT '2025/2026',
      class_name TEXT NOT NULL, trait_category TEXT NOT NULL,
      trait_name TEXT NOT NULL, rating INTEGER,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      UNIQUE (student_id, trait_name, term, academic_session)
    );
    CREATE TABLE student_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      student_id INTEGER NOT NULL, school_code TEXT NOT NULL,
      term TEXT NOT NULL DEFAULT 'First Term',
      academic_session TEXT NOT NULL DEFAULT '2025/2026',
      class_name TEXT NOT NULL,
      times_school_opened INTEGER NOT NULL DEFAULT 0,
      times_present INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      UNIQUE (student_id, term, academic_session)
    );
    CREATE TABLE device_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      device_id TEXT NOT NULL UNIQUE, school_code TEXT,
      ip_address TEXT, user_agent TEXT, user_id INTEGER,
      username TEXT, full_name TEXT, role TEXT,
      first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL
    );
    CREATE TABLE server_config (key TEXT PRIMARY KEY, value TEXT);
  `);

  const now = Date.now();
  // drizzle integer({ mode: "timestamp" }) stores Unix SECONDS, not ms — divide by 1000
  const licenseValidUntilSec = licenseValidUntilMs !== null ? Math.floor(licenseValidUntilMs / 1000) : null;
  const nowSec = Math.floor(now / 1000);
  db.prepare(`INSERT INTO schools (code, name, license_valid_until, created_at)
              VALUES (?, ?, ?, ?)`).run(schoolCode, "Test School", licenseValidUntilSec, nowSec);
  // Store plain-text password — auth route's rolling bcrypt migration handles it
  db.prepare(`INSERT INTO users (username, password, role, full_name, school_code, created_at)
              VALUES (?, ?, 'school_admin', 'Test Admin', ?, ?)`
  ).run("testadmin", PWD, schoolCode, nowSec);
  db.prepare("INSERT INTO server_config (key, value) VALUES ('school_code', ?)").run(schoolCode);
  if (trustedTimeFloor !== null) {
    db.prepare("INSERT INTO server_config (key, value) VALUES ('trusted_time_floor', ?)").run(String(trustedTimeFloor));
  }

  db.close();
  return dbPath;
}

// ── Server lifecycle ──────────────────────────────────────────────────────────
async function startServer(dbPath, port) {
  const proc = spawn(NODE_EXE, [SERVER_MJS], {
    env: {
      DEPLOY_MODE: "local",
      SQLITE_PATH: dbPath,
      PORT: String(port),
      SESSION_SECRET: "test-secret-e2e-fixed",
      NODE_ENV: "development",
      PATH: process.env.PATH,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stderr.on("data", () => {}); // suppress

  // Poll /api/healthz until ready (max 15 s)
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 30; i++) {
    await wait(500);
    try {
      const r = await fetch(`${base}/api/healthz`);
      if (r.ok) { console.log(`  Server ready on port ${port}`); return { proc, base }; }
    } catch {}
  }
  throw new Error(`Server on port ${port} never became ready`);
}

async function stopServer(proc) {
  proc.kill("SIGTERM");
  await wait(800); // let the process release the SQLite WAL before we delete
}

function tryDelete(dbPath) {
  try {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    // Also clean up WAL/SHM side-files
    for (const ext of ["-wal", "-shm"]) {
      const f = dbPath + ext;
      if (existsSync(f)) unlinkSync(f);
    }
  } catch { /* EBUSY on Windows — ignore, OS will clean up temp dir */ }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
async function login(base, username, password, schoolCode) {
  const r = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, schoolCode }),
  });
  // getSetCookie() returns each Set-Cookie header as a separate array element.
  // headers.get("set-cookie") joins them all with ", " which breaks split(";")[0].
  const allCookies = r.headers.getSetCookie?.() ?? [r.headers.get("set-cookie") ?? ""];
  // Extract name=value from each cookie header and send them all together
  const cookieHeader = allCookies
    .map(c => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
  return { status: r.status, sessionCookie: cookieHeader };
}

async function getTeachers(base, schoolCode, sessionCookie) {
  const r = await fetch(`${base}/api/schools/${schoolCode}/teachers`, {
    headers: { Cookie: sessionCookie },
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

const tmp = (n) => join(tmpdir(), `cbt-license-test-${n}.db`);

let allPassed = true;
const assert = (label, cond, got) => {
  if (cond) { ok(label); } else { fail(`${label}  (got ${JSON.stringify(got)})`); allPassed = false; }
};

// ═══════════════════════════════════════════════════════════════════════════════
hr("SCENARIO 1 — Expired licenseValidUntil → 423 LICENSE_EXPIRED");
// ═══════════════════════════════════════════════════════════════════════════════
{
  const dbPath = tmp(1);
  const PORT = 18081;
  const SCHOOL = "TEST-001";

  // licenseValidUntil = 30 days ago (stored as milliseconds per SQLite schema)
  const expiredMs = Date.now() - 30 * 24 * 60 * 60 * 1000;

  step("1.1", `Create DB: licenseValidUntil = ${new Date(expiredMs).toISOString()} (30 days ago)`);
  createTestDb(dbPath, { schoolCode: SCHOOL, licenseValidUntilMs: expiredMs });
  console.log(`  DB written: ${dbPath}`);

  step("1.2", "Start local server");
  const { proc, base } = await startServer(dbPath, PORT);

  step("1.3", "Login as school_admin");
  const { status: loginStatus, sessionCookie } = await login(base, "testadmin", PWD, SCHOOL);
  showResp("POST /api/auth/login", loginStatus, { sessionCookie: sessionCookie ? "(present)" : "(missing)" });
  assert("Login succeeds (200)", loginStatus === 200, loginStatus);

  step("1.4", "GET /api/schools/:schoolCode/teachers — expect 423 LICENSE_EXPIRED");
  const { status, body } = await getTeachers(base, SCHOOL, sessionCookie);
  showResp(`GET /api/schools/${SCHOOL}/teachers`, status, body);
  assert("Status 423", status === 423, status);
  assert("error = LICENSE_EXPIRED", body.error === "LICENSE_EXPIRED", body.error);
  assert("licenseValidUntil present", !!body.licenseValidUntil, body.licenseValidUntil);
  console.log(`  licenseValidUntil in response: ${body.licenseValidUntil}`);

  step("1.5", "Verify no other school route is reachable (students)");
  const r2 = await fetch(`${base}/api/schools/${SCHOOL}/students`, { headers: { Cookie: sessionCookie } });
  const b2 = await r2.json().catch(() => ({}));
  showResp(`GET /api/schools/${SCHOOL}/students`, r2.status, b2);
  assert("Students route also 423", r2.status === 423, r2.status);

  await stopServer(proc);
  tryDelete(dbPath);
}

// ═══════════════════════════════════════════════════════════════════════════════
hr("SCENARIO 2 — trusted_time_floor in future → 423 CLOCK_TAMPER (not expiry)");
// ═══════════════════════════════════════════════════════════════════════════════
{
  const dbPath = tmp(2);
  const PORT = 18082;
  const SCHOOL = "TEST-001";

  // License is valid (3 months from now)
  const validLicenseMs = Date.now() + 90 * 24 * 60 * 60 * 1000;
  // Floor is 10 minutes in the future — clock appears to have been rolled back
  // The grace window is 2 minutes, so floor > now + 2min triggers CLOCK_TAMPER
  const floorMs = Date.now() + 10 * 60 * 1000;

  step("2.1", `Create DB: valid license (+90 days), trusted_time_floor = now + 10 min`);
  createTestDb(dbPath, {
    schoolCode: SCHOOL,
    licenseValidUntilMs: validLicenseMs,
    trustedTimeFloor: floorMs,
  });
  console.log(`  License expires: ${new Date(validLicenseMs).toISOString().slice(0,10)}`);
  console.log(`  Floor: ${new Date(floorMs).toISOString()}`);
  console.log(`  Grace: 2 min  →  now is ${Math.round((floorMs - Date.now()) / 60000)} min behind floor`);

  step("2.2", "Start local server");
  const { proc, base } = await startServer(dbPath, PORT);

  step("2.3", "Login as school_admin");
  const { status: loginStatus, sessionCookie } = await login(base, "testadmin", PWD, SCHOOL);
  showResp("POST /api/auth/login", loginStatus, { sessionCookie: sessionCookie ? "(present)" : "(missing)" });
  assert("Login succeeds (200)", loginStatus === 200, loginStatus);

  step("2.4", "GET /api/schools/:schoolCode/teachers — expect 423 CLOCK_TAMPER (not LICENSE_EXPIRED)");
  const { status, body } = await getTeachers(base, SCHOOL, sessionCookie);
  showResp(`GET /api/schools/${SCHOOL}/teachers`, status, body);
  assert("Status 423", status === 423, status);
  assert("error = CLOCK_TAMPER (not LICENSE_EXPIRED)", body.error === "CLOCK_TAMPER", body.error);
  assert("No licenseValidUntil in CLOCK_TAMPER response", !body.licenseValidUntil, body.licenseValidUntil);

  step("2.5", "Confirm: if floor is removed from DB, request succeeds (isolates the floor as cause)");
  // Directly manipulate SQLite while server is running — floor is re-read per request
  const db2 = new Database(dbPath);
  db2.prepare("DELETE FROM server_config WHERE key = 'trusted_time_floor'").run();
  db2.close();
  await wait(100);
  const { status: s2, body: b2 } = await getTeachers(base, SCHOOL, sessionCookie);
  showResp(`GET /api/schools/${SCHOOL}/teachers (floor removed)`, s2, b2);
  assert("Returns 200 once floor is removed", s2 === 200, s2);

  await stopServer(proc);
  tryDelete(dbPath);
}

// ═══════════════════════════════════════════════════════════════════════════════
hr("SCENARIO 3 — Background time-sync extends local license from cloud");
// ═══════════════════════════════════════════════════════════════════════════════
{
  const dbPath = tmp(3);
  const PORT = 18083;
  const SCHOOL = "TEST-001";

  // Set an expired local license (7 days ago)
  const expiredLocalMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  createTestDb(dbPath, { schoolCode: SCHOOL, licenseValidUntilMs: expiredLocalMs });

  step("3.1", `Local SQLite: licenseValidUntil = ${new Date(expiredLocalMs).toISOString().slice(0,10)} (7 days ago)`);
  const dbBefore = new Database(dbPath, { readonly: true });
  const schoolBefore = dbBefore.prepare("SELECT license_valid_until FROM schools WHERE code = ?").get(SCHOOL);
  dbBefore.close();
  console.log(`  SQLite licenseValidUntil (Unix seconds): ${schoolBefore.license_valid_until} → ${new Date(schoolBefore.license_valid_until * 1000).toISOString()}`);

  step("3.2", "Start local server, confirm 423 LICENSE_EXPIRED before sync");
  const { proc, base } = await startServer(dbPath, PORT);
  const { sessionCookie } = await login(base, "testadmin", PWD, SCHOOL);
  const { status: beforeStatus, body: beforeBody } = await getTeachers(base, SCHOOL, sessionCookie);
  showResp(`GET /api/schools/${SCHOOL}/teachers (before sync)`, beforeStatus, beforeBody);
  assert("Returns 423 LICENSE_EXPIRED before sync", beforeStatus === 423 && beforeBody.error === "LICENSE_EXPIRED", beforeBody.error);

  step("3.3", "Check cloud /api/time-check endpoint (informational — deployed after this PR)");
  try {
    const cloudRes = await fetch(`https://cbtsoftware.onrender.com/api/time-check?schoolCode=${SCHOOL}`, { signal: AbortSignal.timeout(5_000) });
    const cloudData = await cloudRes.json().catch(() => null);
    showResp("GET /api/time-check (cloud)", cloudRes.status, cloudData);
    if (cloudRes.ok && cloudData?.serverTime) {
      ok(`Cloud endpoint available — serverTime: ${cloudData.serverTime}, licenseValidUntil: ${cloudData.licenseValidUntil}`);
    } else {
      console.log(`  INFO: Cloud /api/time-check returned ${cloudRes.status} — not yet deployed (expected before push to main)`);
    }
  } catch {
    console.log("  INFO: Cloud /api/time-check unreachable — will be available after deployment");
  }

  step("3.4", "Simulate sync: time-sync.ts writes a future licenseValidUntil into SQLite");
  // time-sync.ts receives a future date from cloud and writes it to the local DB.
  // The middleware re-reads the DB on every request, so the change is instant.
  const futureDateIso = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const futureSec = Math.floor(new Date(futureDateIso).getTime() / 1000);
  const dbWrite = new Database(dbPath);
  dbWrite.prepare("UPDATE schools SET license_valid_until = ? WHERE code = ?").run(futureSec, SCHOOL);
  dbWrite.close();
  console.log(`  Wrote licenseValidUntil = ${futureDateIso} (${futureSec} Unix seconds)`);

  const dbAfter = new Database(dbPath, { readonly: true });
  const schoolAfter = dbAfter.prepare("SELECT license_valid_until FROM schools WHERE code = ?").get(SCHOOL);
  dbAfter.close();
  assert("SQLite updated to future date", schoolAfter.license_valid_until === futureSec, schoolAfter.license_valid_until);

  step("3.5", "Verify server immediately returns 200 — per-request DB check means no restart needed");
  await wait(100);
  const { status: afterStatus, body: afterBody } = await getTeachers(base, SCHOOL, sessionCookie);
  showResp(`GET /api/schools/${SCHOOL}/teachers (after sync)`, afterStatus, afterBody);
  assert("Returns 200 after license extended (no server restart)", afterStatus === 200, afterStatus);

  await stopServer(proc);
  tryDelete(dbPath);
}

// ═══════════════════════════════════════════════════════════════════════════════
hr("SCENARIO 4 — Valid license, clean clock → 200 on every school route");
// ═══════════════════════════════════════════════════════════════════════════════
{
  const dbPath = tmp(4);
  const PORT = 18084;
  const SCHOOL = "TEST-001";

  // License valid for 90 more days, no floor set
  const futureMs = Date.now() + 90 * 24 * 60 * 60 * 1000;
  createTestDb(dbPath, {
    schoolCode: SCHOOL,
    licenseValidUntilMs: futureMs,
  });

  step("4.1", `Create DB: licenseValidUntil = ${new Date(futureMs).toISOString().slice(0,10)} (+90 days), no floor`);
  const { proc, base } = await startServer(dbPath, PORT);

  step("4.2", "Login as school_admin");
  const { status: loginStatus, sessionCookie } = await login(base, "testadmin", PWD, SCHOOL);
  showResp("POST /api/auth/login", loginStatus, {});
  assert("Login succeeds", loginStatus === 200, loginStatus);

  step("4.3", "Hit multiple school routes — all must return 200 (not 423)");
  const routes = [
    { path: `/api/schools/${SCHOOL}/teachers`,  label: "teachers" },
    { path: `/api/schools/${SCHOOL}/students`,  label: "students" },
    { path: `/api/schools/${SCHOOL}/exams`,     label: "exams"    },
  ];
  for (const { path, label } of routes) {
    const r = await fetch(`${base}${path}`, { headers: { Cookie: sessionCookie } });
    const b = await r.json().catch(() => ({}));
    showResp(`GET ${path}`, r.status, Array.isArray(b) ? `[${b.length} items]` : b);
    assert(`${label} returns 200 (no false lockout)`, r.status === 200, r.status);
  }

  step("4.4", "Hit a public route (health) — must be 200 regardless");
  const healthRes = await fetch(`${base}/api/healthz`);
  const healthBody = await healthRes.json().catch(() => ({}));
  showResp("GET /api/healthz", healthRes.status, healthBody);
  assert("Healthz returns 200", healthRes.status === 200, healthRes.status);

  step("4.5", "Unauthenticated request to school route — must return 401 (not 423)");
  const r5 = await fetch(`${base}/api/schools/${SCHOOL}/teachers`);
  const b5 = await r5.json().catch(() => ({}));
  showResp(`GET /api/schools/${SCHOOL}/teachers (no cookie)`, r5.status, b5);
  assert("Unauthenticated returns 401 (requireAuth fires before checkLocalLicense)", r5.status === 401, r5.status);

  await stopServer(proc);
  tryDelete(dbPath);
}

// ═══════════════════════════════════════════════════════════════════════════════
hr(`RESULTS — ${allPassed ? "ALL PASSED ✓" : "SOME FAILURES — see ✗ above"}`);
// ═══════════════════════════════════════════════════════════════════════════════
process.exit(allPassed ? 0 : 1);
