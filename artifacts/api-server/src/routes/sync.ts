import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import {
  schoolsTable, usersTable, examsTable, questionsTable,
  resultsTable, resultAnswersTable, gradingSchemesTable, subjectsTable,
  subjectScoresTable, deviceSessionsTable, serverConfigTable,
} from "@workspace/db/schema";
import { eq, and, inArray, sql, count } from "drizzle-orm";

const router = Router({ mergeParams: true });

// ── Cloud: export full school data as JSON for local server bootstrap ─────────
// GET /api/schools/:schoolCode/sync/local-export
router.get("/local-export", requireAuth, async (req, res) => {
  if (process.env.DEPLOY_MODE === "local") {
    res.status(404).json({ error: "Not available in local mode" });
    return;
  }
  const { schoolCode } = req.params as { schoolCode: string };
  if (req.session.role !== "super_admin" && req.session.schoolCode !== schoolCode) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [school] = await db.select().from(schoolsTable).where(eq(schoolsTable.code, schoolCode));
  if (!school) {
    res.status(404).json({ error: "School not found" });
    return;
  }

  const [users, exams, subjects, gradingSchemes] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.schoolCode, schoolCode)),
    db.select().from(examsTable).where(eq(examsTable.schoolCode, schoolCode)),
    db.select().from(subjectsTable).where(eq(subjectsTable.schoolCode, schoolCode)),
    db.select().from(gradingSchemesTable).where(eq(gradingSchemesTable.schoolCode, schoolCode)),
  ]);

  const examIds = exams.map((e) => e.id);
  const questions = examIds.length > 0
    ? await db.select().from(questionsTable).where(inArray(questionsTable.examId, examIds))
    : [];

  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Disposition", `attachment; filename="cbt-school-${schoolCode}-${date}.json"`);
  res.json({ exportedAt: new Date().toISOString(), version: 1, school, users, exams, questions, subjects, gradingSchemes });
});

// ISO 8601 date strings → Date objects so SQLite's timestamp columns don't
// throw "value.getTime is not a function". Applied to every row before insert.
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
function parseDates(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k,
      typeof v === "string" && ISO_RE.test(v) ? new Date(v) : v,
    ])
  );
}

// ── Local: import school data downloaded from cloud ───────────────────────────
// POST /api/schools/:schoolCode/sync/import-school
//
// Auth rules in local mode:
//   • First-time import (no school in DB yet): no auth required — the LAN is
//     trusted and the operator needs a way to bootstrap the server.
//   • Re-import (school already present): must be authenticated as school_admin
//     for that school, to prevent a rogue device overwriting live data mid-session.
router.post("/import-school", async (req, res) => {
  if (process.env.DEPLOY_MODE !== "local") {
    res.status(404).json({ error: "Not available in cloud mode" });
    return;
  }

  const [{ c: schoolCount }] = await db.select({ c: count() }).from(schoolsTable);
  const hasSchool = schoolCount > 0;

  if (hasSchool) {
    // Re-import: require the school's own admin to be logged in.
    if (!req.session?.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (req.session.role !== "school_admin") {
      res.status(403).json({ error: "Only the school admin can re-import school data" });
      return;
    }
  }

  const { schoolCode } = req.params as { schoolCode: string };
  const { school, users = [], exams = [], questions = [], subjects = [], gradingSchemes = [] } = req.body;

  if (!school?.code) {
    res.status(400).json({ error: "Invalid export data — missing school.code" });
    return;
  }
  if (school.code !== schoolCode) {
    res.status(400).json({ error: "School code mismatch" });
    return;
  }

  // Insert in FK dependency order, preserving cloud IDs so FK references stay valid.
  // onConflictDoNothing is idempotent — re-importing skips rows that already exist.
  // parseDates converts ISO timestamp strings → Date objects for SQLite compatibility.
  //
  // Schools: strip the cloud integer id so SQLite auto-assigns a local one.
  // All FK references to schools use school_code TEXT, not the integer PK — so
  // the local id value doesn't matter and stripping it avoids PK collisions with
  // seed data.
  const { id: _schoolId, ...schoolWithoutId } = school as Record<string, unknown>;
  await db.insert(schoolsTable).values(parseDates(schoolWithoutId) as any).onConflictDoNothing();
  if (users.length)          await db.insert(usersTable).values(users.map(parseDates) as any).onConflictDoNothing();
  if (subjects.length)       await db.insert(subjectsTable).values(subjects.map(parseDates) as any).onConflictDoNothing();
  if (gradingSchemes.length) await db.insert(gradingSchemesTable).values(gradingSchemes.map(parseDates) as any).onConflictDoNothing();
  if (exams.length)          await db.insert(examsTable).values(exams.map(parseDates) as any).onConflictDoNothing();
  if (questions.length)      await db.insert(questionsTable).values(questions.map(parseDates) as any).onConflictDoNothing();

  // Record which school this local server is for — enables license check and time-sync
  await (db.insert(serverConfigTable as any)
    .values({ key: "school_code", value: schoolCode })
    .onConflictDoUpdate({ target: (serverConfigTable as any).key, set: { value: schoolCode } }) as unknown as Promise<void>);

  res.json({
    ok: true,
    imported: { users: users.length, exams: exams.length, questions: questions.length, subjects: subjects.length },
  });
});

// ── Local: export results for uploading to cloud ──────────────────────────────
// GET /api/schools/:schoolCode/sync/results-export
router.get("/results-export", requireAuth, async (req, res) => {
  if (process.env.DEPLOY_MODE !== "local") {
    res.status(404).json({ error: "Not available in cloud mode" });
    return;
  }
  const { schoolCode } = req.params as { schoolCode: string };
  if (req.session.role !== "super_admin" && req.session.schoolCode !== schoolCode) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const results = await db.select().from(resultsTable).where(eq(resultsTable.schoolCode, schoolCode));
  const resultIds = results.map((r) => r.id);

  const [answers, subjectScores, deviceSessions] = await Promise.all([
    resultIds.length > 0
      ? db.select().from(resultAnswersTable).where(inArray(resultAnswersTable.resultId, resultIds))
      : Promise.resolve([]),
    db.select().from(subjectScoresTable).where(eq(subjectScoresTable.schoolCode, schoolCode)),
    db.select().from(deviceSessionsTable).where(eq(deviceSessionsTable.schoolCode, schoolCode)),
  ]);

  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Disposition", `attachment; filename="cbt-results-${schoolCode}-${date}.json"`);
  res.json({ exportedAt: new Date().toISOString(), version: 1, schoolCode, results, answers, subjectScores, deviceSessions });
});

// ── Cloud: receive results exported from local server and merge ───────────────
// POST /api/schools/:schoolCode/sync/results-import
router.post("/results-import", requireAuth, async (req, res) => {
  if (process.env.DEPLOY_MODE === "local") {
    res.status(404).json({ error: "Not available in local mode" });
    return;
  }
  const { schoolCode } = req.params as { schoolCode: string };
  if (req.session.role !== "super_admin" && req.session.schoolCode !== schoolCode) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { results, answers, subjectScores = [], deviceSessions = [] } = req.body as {
    results: Array<Record<string, unknown>>;
    answers: Array<Record<string, unknown>>;
    subjectScores: Array<Record<string, unknown>>;
    deviceSessions: Array<Record<string, unknown>>;
  };
  if (!Array.isArray(results)) {
    res.status(400).json({ error: "results must be an array" });
    return;
  }

  let inserted = 0;
  let skipped = 0;
  // Maps local SQLite result id → newly-assigned cloud Postgres result id
  const idMap = new Map<number, number>();

  for (const row of results) {
    const localId = row.id as number;
    const retakeCount = ((row.retakeCount ?? 0) as number);

    // Dedup key: (studentId, examId, retakeCount) — unique per attempt
    const [existing] = await db
      .select({ id: resultsTable.id })
      .from(resultsTable)
      .where(
        and(
          eq(resultsTable.studentId, row.studentId as number),
          eq(resultsTable.examId, row.examId as number),
          eq(resultsTable.retakeCount, retakeCount),
        )
      )
      .limit(1);

    if (existing) {
      idMap.set(localId, existing.id);
      skipped++;
      continue;
    }

    const [created] = await db
      .insert(resultsTable)
      .values({
        examId: row.examId as number,
        studentId: row.studentId as number,
        fullName: row.fullName as string,
        class: row.class as string,
        score: row.score as number,
        totalQuestions: row.totalQuestions as number,
        percentage: row.percentage as number,
        schoolCode,
        term: (row.term ?? "First Term") as string,
        retakeCount,
        submittedAt: new Date(row.submittedAt as string),
      })
      .returning({ id: resultsTable.id });

    idMap.set(localId, created.id);
    inserted++;
  }

  // Re-link answers to cloud-assigned result ids
  const answersToInsert = (answers ?? [])
    .map((a) => {
      const cloudResultId = idMap.get(a.resultId as number);
      if (cloudResultId === undefined) return null;
      return {
        resultId: cloudResultId,
        questionId: a.questionId as number,
        questionText: a.questionText as string,
        optionA: a.optionA as string,
        optionB: a.optionB as string,
        optionC: a.optionC as string,
        optionD: a.optionD as string,
        correctOption: a.correctOption as string,
        selectedOption: (a.selectedOption as string | null) ?? null,
        isCorrect: (a.isCorrect as boolean) ?? false,
        schoolCode,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  if (answersToInsert.length > 0) {
    await db.insert(resultAnswersTable).values(answersToInsert).onConflictDoNothing();
  }

  // Upsert subject_scores — studentId doesn't need remapping because local IDs equal
  // cloud IDs (import-school preserves cloud integer IDs). On conflict, merge component
  // scores with COALESCE so existing values survive if the incoming field is null.
  if (subjectScores.length > 0) {
    for (const row of subjectScores) {
      await db
        .insert(subjectScoresTable)
        .values({
          studentId: row.studentId as number,
          subjectName: row.subjectName as string,
          className: row.className as string,
          schoolCode,
          term: (row.term ?? "First Term") as string,
          academicSession: (row.academicSession ?? "2025/2026") as string,
          midTermScore: (row.midTermScore as number | null) ?? null,
          midTermCbtScore: (row.midTermCbtScore as number | null) ?? null,
          classActivityScore: (row.classActivityScore as number | null) ?? null,
          examScore: (row.examScore as number | null) ?? null,
          examCbtScore: (row.examCbtScore as number | null) ?? null,
          totalScore: (row.totalScore as number | null) ?? null,
          percentage: (row.percentage as number | null) ?? null,
          grade: (row.grade as string | null) ?? null,
          teacherComment: (row.teacherComment as string | null) ?? null,
        })
        .onConflictDoUpdate({
          target: [
            subjectScoresTable.studentId,
            subjectScoresTable.subjectName,
            subjectScoresTable.term,
            subjectScoresTable.academicSession,
          ],
          set: {
            // Prefer incoming if non-null; keep existing otherwise — merges CBT components
            midTermScore: sql`COALESCE(EXCLUDED.mid_term_score, ${subjectScoresTable.midTermScore})`,
            midTermCbtScore: sql`COALESCE(EXCLUDED.mid_term_cbt_score, ${subjectScoresTable.midTermCbtScore})`,
            classActivityScore: sql`COALESCE(EXCLUDED.class_activity_score, ${subjectScoresTable.classActivityScore})`,
            examScore: sql`COALESCE(EXCLUDED.exam_score, ${subjectScoresTable.examScore})`,
            examCbtScore: sql`COALESCE(EXCLUDED.exam_cbt_score, ${subjectScoresTable.examCbtScore})`,
            totalScore: sql`COALESCE(EXCLUDED.total_score, ${subjectScoresTable.totalScore})`,
            percentage: sql`COALESCE(EXCLUDED.percentage, ${subjectScoresTable.percentage})`,
            grade: sql`COALESCE(EXCLUDED.grade, ${subjectScoresTable.grade})`,
            teacherComment: sql`COALESCE(EXCLUDED.teacher_comment, ${subjectScoresTable.teacherComment})`,
            updatedAt: sql`GREATEST(EXCLUDED.updated_at, ${subjectScoresTable.updatedAt})`,
          },
        });
    }
  }

  // Upsert device_sessions — preserve earliest firstSeen and latest lastSeen across syncs
  if (deviceSessions.length > 0) {
    for (const row of deviceSessions) {
      await db
        .insert(deviceSessionsTable)
        .values({
          deviceId: row.deviceId as string,
          schoolCode: (row.schoolCode as string | null) ?? null,
          ipAddress: (row.ipAddress as string | null) ?? null,
          userAgent: (row.userAgent as string | null) ?? null,
          userId: (row.userId as number | null) ?? null,
          username: (row.username as string | null) ?? null,
          fullName: (row.fullName as string | null) ?? null,
          role: (row.role as string | null) ?? null,
          firstSeen: new Date(row.firstSeen as string),
          lastSeen: new Date(row.lastSeen as string),
        })
        .onConflictDoUpdate({
          target: deviceSessionsTable.deviceId,
          set: {
            firstSeen: sql`LEAST(EXCLUDED.first_seen, ${deviceSessionsTable.firstSeen})`,
            lastSeen: sql`GREATEST(EXCLUDED.last_seen, ${deviceSessionsTable.lastSeen})`,
            schoolCode: sql`COALESCE(EXCLUDED.school_code, ${deviceSessionsTable.schoolCode})`,
            ipAddress: sql`EXCLUDED.ip_address`,
            userAgent: sql`EXCLUDED.user_agent`,
            userId: sql`EXCLUDED.user_id`,
            username: sql`EXCLUDED.username`,
            fullName: sql`EXCLUDED.full_name`,
            role: sql`EXCLUDED.role`,
          },
        });
    }
  }

  res.json({
    ok: true,
    inserted,
    skipped,
    answersInserted: answersToInsert.length,
    subjectScoresUpserted: subjectScores.length,
    deviceSessionsUpserted: deviceSessions.length,
  });
});

export default router;
