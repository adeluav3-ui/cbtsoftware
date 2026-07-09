import { Router, Request, Response } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import { resultsTable, examsTable, resultAnswersTable, subjectScoresTable, gradingSchemesTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

interface SchoolParams {
  schoolCode: string;
}

interface ResultParams extends SchoolParams {
  resultId: string;
}

const router = Router({ mergeParams: true });

// List results for a school
router.get("/", requireAuth, async (req: Request<SchoolParams>, res: Response) => {
  const { schoolCode } = req.params;

  // Verify the user belongs to this school (super_admin can access any school)
  if (req.session.role !== "super_admin" && req.session.schoolCode !== schoolCode) {
    return res.status(403).json({ error: "Not authorized for this school" });
  }

  try {
    const { teacherId, examId, studentId } = req.query;

    const conditions: any[] = [eq(resultsTable.schoolCode, schoolCode)];

    if (req.session.role === "student") {
      // Students can only ever see their own results — ignore any query filters
      conditions.push(eq(resultsTable.studentId, req.session.userId!));
    } else {
      if (examId) {
        conditions.push(eq(resultsTable.examId, parseInt(examId as string)));
      }
      if (studentId) {
        conditions.push(eq(resultsTable.studentId, parseInt(studentId as string)));
      }
      if (teacherId) {
        conditions.push(eq(examsTable.teacherId, parseInt(teacherId as string)));
      }
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
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Get detailed result (with per-question answer breakdown)
router.get("/:resultId/detail", requireAuth, async (req: Request<ResultParams>, res: Response) => {
  const { schoolCode, resultId } = req.params;

  // Verify the user belongs to this school (super_admin can access any school)
  if (req.session.role !== "super_admin" && req.session.schoolCode !== schoolCode) {
    return res.status(403).json({ error: "Not authorized for this school" });
  }

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

    // Students can only view their own result detail
    if (req.session.role === "student" && result.studentId !== req.session.userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const answers = await db
      .select()
      .from(resultAnswersTable)
      .where(eq(resultAnswersTable.resultId, parseInt(resultId)))
      .orderBy(resultAnswersTable.id);

    // Fetch the student's cumulative subject score for this subject
    // (most recent term — covers the case where term/session data shifted)
    const [subjectScore] = result.subject
      ? await db
          .select({
            midTermScore: subjectScoresTable.midTermScore,
            classActivityScore: subjectScoresTable.classActivityScore,
            examScore: subjectScoresTable.examScore,
            grade: subjectScoresTable.grade,
          })
          .from(subjectScoresTable)
          .where(
            and(
              eq(subjectScoresTable.studentId, result.studentId),
              eq(subjectScoresTable.subjectName, result.subject),
              eq(subjectScoresTable.schoolCode, schoolCode)
            )
          )
          .orderBy(desc(subjectScoresTable.updatedAt))
          .limit(1)
      : [];

    const isComplete =
      subjectScore != null &&
      subjectScore.midTermScore !== null &&
      subjectScore.classActivityScore !== null &&
      subjectScore.examScore !== null;

    res.json({ ...result, answers, grade: isComplete ? (subjectScore?.grade ?? null) : null });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

export default router;