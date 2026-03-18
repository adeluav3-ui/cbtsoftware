import { Router } from "express";
import { db } from "@workspace/db";
import { resultsTable, examsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router({ mergeParams: true });

// List results for a school
router.get("/", async (req, res) => {
  const { schoolCode } = req.params;
  const { examId, studentId } = req.query;

  try {
    const conditions: any[] = [eq(resultsTable.schoolCode, schoolCode)];

    if (examId) {
      conditions.push(eq(resultsTable.examId, parseInt(examId as string)));
    }

    if (studentId) {
      conditions.push(eq(resultsTable.studentId, parseInt(studentId as string)));
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

export default router;
