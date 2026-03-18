import { Router } from "express";
import { db } from "@workspace/db";
import { resultsTable, examsTable, resultAnswersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router({ mergeParams: true });

// List results for a school
router.get("/", async (req, res) => {
  const { schoolCode } = req.params;

  try {
    const { teacherId, examId, studentId } = req.query;

    const conditions: any[] = [eq(resultsTable.schoolCode, schoolCode)];

    if (examId) {
      conditions.push(eq(resultsTable.examId, parseInt(examId as string)));
    }

    if (studentId) {
      conditions.push(eq(resultsTable.studentId, parseInt(studentId as string)));
    }

    if (teacherId) {
      conditions.push(eq(examsTable.teacherId, parseInt(teacherId as string)));
    }

    const results = await db
      .select({
        id: resultsTable.id,
        examId: resultsTable.examId,
        studentId: resultsTable.studentId,
        fullName: resultsTable.fullName,
        class: resultsTable.class,
        score: resultsTable.score,
        totalQuestions: resultsTable.totalQuestions,
        percentage: resultsTable.percentage,
        schoolCode: resultsTable.schoolCode,
        submittedAt: resultsTable.submittedAt,
        examTitle: examsTable.title,
        subject: examsTable.subject,
      })
      .from(resultsTable)
      .leftJoin(examsTable, eq(resultsTable.examId, examsTable.id))
      .where(and(...conditions))
      .orderBy(resultsTable.submittedAt);

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get detailed result (with per-question answer breakdown)
router.get("/:resultId/detail", async (req, res) => {
  const { schoolCode, resultId } = req.params;

  try {
    const [result] = await db
      .select({
        id: resultsTable.id,
        examId: resultsTable.examId,
        studentId: resultsTable.studentId,
        fullName: resultsTable.fullName,
        class: resultsTable.class,
        score: resultsTable.score,
        totalQuestions: resultsTable.totalQuestions,
        percentage: resultsTable.percentage,
        submittedAt: resultsTable.submittedAt,
        examTitle: examsTable.title,
        subject: examsTable.subject,
      })
      .from(resultsTable)
      .leftJoin(examsTable, eq(resultsTable.examId, examsTable.id))
      .where(
        and(
          eq(resultsTable.id, parseInt(resultId)),
          eq(resultsTable.schoolCode, schoolCode)
        )
      )
      .limit(1);

    if (!result) {
      return res.status(404).json({ error: "Result not found" });
    }

    const answers = await db
      .select()
      .from(resultAnswersTable)
      .where(eq(resultAnswersTable.resultId, parseInt(resultId)))
      .orderBy(resultAnswersTable.id);

    res.json({ ...result, answers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
