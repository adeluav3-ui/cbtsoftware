import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  examsTable,
  questionsTable,
  resultsTable,
  resultAnswersTable,
  usersTable,
  gradingSchemesTable,
  subjectScoresTable,
} from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";

interface SchoolParams {
  schoolCode: string;
}

interface ExamParams extends SchoolParams {
  examId: string;
}

interface QuestionParams extends ExamParams {
  questionId: string;
}

interface Session {
  userId?: number;
  role?: string;
  schoolCode?: string | null;
}

interface RequestWithSession extends Request {
  session: Session;
}

const router = Router({ mergeParams: true });

// List exams for a school
router.get("/", async (req: Request<SchoolParams>, res: Response) => {
  const { schoolCode } = req.params;
  const { class: examClass, active } = req.query;

  try {
    const conditions: any[] = [eq(examsTable.schoolCode, schoolCode)];

    if (examClass && typeof examClass === "string") {
      conditions.push(eq(examsTable.class, examClass));
    }

    if (active !== undefined) {
      conditions.push(eq(examsTable.isActive, active === "true"));
    }

    const exams = await db
      .select({
        id: examsTable.id,
        title: examsTable.title,
        subject: examsTable.subject,
        class: examsTable.class,
        durationMinutes: examsTable.durationMinutes,
        isActive: examsTable.isActive,
        schoolCode: examsTable.schoolCode,
        teacherId: examsTable.teacherId,
        assessmentType: examsTable.assessmentType,
        createdAt: examsTable.createdAt,
        questionCount: sql<number>`(SELECT COUNT(*) FROM questions WHERE questions.exam_id = exams.id)`.as("question_count"),
      })
      .from(examsTable)
      .where(and(...conditions))
      .orderBy(examsTable.createdAt);

    res.json(exams);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Create exam
router.post("/", async (req: RequestWithSession, res: Response) => {
  const { schoolCode } = req.params;
  const session = req.session;
  const { title, subject, class: examClass, durationMinutes, assessmentType } = req.body;

  if (!title || !subject || !examClass || !durationMinutes) {
    return res.status(400).json({ error: "Title, subject, class and duration required" });
  }

  const teacherId = session?.userId;
  if (!teacherId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const className = String(examClass);

    const [exam] = await db
      .insert(examsTable)
      .values({
        title: String(title),
        subject: String(subject),
        class: className,
        durationMinutes: Number(durationMinutes),
        schoolCode: String(schoolCode),
        teacherId: Number(teacherId),
        isActive: false,
        assessmentType: assessmentType || "exam",
      })
      .returning();

    res.status(201).json({ ...exam, questionCount: 0 });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Get exam with questions
router.get("/:examId", async (req: Request<ExamParams>, res: Response) => {
  const { schoolCode, examId } = req.params;

  try {
    const [exam] = await db
      .select()
      .from(examsTable)
      .where(
        and(
          eq(examsTable.id, parseInt(examId)),
          eq(examsTable.schoolCode, schoolCode)
        )
      )
      .limit(1);

    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.examId, parseInt(examId)));

    res.json({ ...exam, questions });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Delete exam
router.delete("/:examId", async (req: Request<ExamParams>, res: Response) => {
  const { schoolCode, examId } = req.params;

  try {
    await db
      .delete(questionsTable)
      .where(eq(questionsTable.examId, parseInt(examId)));

    const [deleted] = await db
      .delete(examsTable)
      .where(
        and(
          eq(examsTable.id, parseInt(examId)),
          eq(examsTable.schoolCode, schoolCode)
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Exam not found" });
    }

    res.json({ message: "Exam deleted" });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Toggle exam active/inactive
router.post("/:examId/toggle", async (req: Request<ExamParams>, res: Response) => {
  const { schoolCode, examId } = req.params;
  const { isActive } = req.body;

  try {
    const [exam] = await db
      .update(examsTable)
      .set({ isActive })
      .where(
        and(
          eq(examsTable.id, parseInt(examId)),
          eq(examsTable.schoolCode, schoolCode)
        )
      )
      .returning();

    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const questionCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(questionsTable)
      .where(eq(questionsTable.examId, parseInt(examId)));

    res.json({ ...exam, questionCount: questionCount[0]?.count ?? 0 });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Bulk add questions
router.post("/:examId/questions/bulk", async (req: Request<ExamParams>, res: Response) => {
  const { schoolCode, examId } = req.params;
  const { questions } = req.body;

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: "Questions array is required" });
  }

  const validOptions = ["A", "B", "C", "D"];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.text || !q.optionA || !q.optionB || !q.optionC || !q.optionD || !q.correctOption) {
      return res.status(400).json({ error: `Question ${i + 1} is missing required fields` });
    }
    if (!validOptions.includes(q.correctOption)) {
      return res.status(400).json({ error: `Question ${i + 1} has invalid correctOption: must be A, B, C or D` });
    }
  }

  try {
    const inserted = await db
      .insert(questionsTable)
      .values(
        questions.map((q: any) => ({
          examId: parseInt(examId),
          text: String(q.text),
          optionA: String(q.optionA),
          optionB: String(q.optionB),
          optionC: String(q.optionC),
          optionD: String(q.optionD),
          correctOption: String(q.correctOption),
          schoolCode,
          imageUrl: q.imageUrl || null,
        }))
      )
      .returning();

    res.status(201).json({ inserted: inserted.length, questions: inserted });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Add question to exam
router.post("/:examId/questions", async (req: Request<ExamParams>, res: Response) => {
  const { schoolCode, examId } = req.params;
  const { text, optionA, optionB, optionC, optionD, correctOption, imageUrl } = req.body;

  if (!text || !optionA || !optionB || !optionC || !optionD || !correctOption) {
    return res.status(400).json({ error: "All question fields are required" });
  }

  try {
    const [question] = await db
      .insert(questionsTable)
      .values({
        examId: parseInt(examId),
        text,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption,
        schoolCode,
        imageUrl: imageUrl || null,
      })
      .returning();

    res.status(201).json(question);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Delete question
router.delete("/:examId/questions/:questionId", async (req: Request<QuestionParams>, res: Response) => {
  const { examId, questionId } = req.params;

  try {
    const [deleted] = await db
      .delete(questionsTable)
      .where(
        and(
          eq(questionsTable.id, parseInt(questionId)),
          eq(questionsTable.examId, parseInt(examId))
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Question not found" });
    }

    res.json({ message: "Question deleted" });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Get exam results with full breakdown
router.get("/:examId/results", async (req: Request<ExamParams>, res: Response) => {
  const { schoolCode, examId } = req.params;

  try {
    const [exam] = await db
      .select()
      .from(examsTable)
      .where(
        and(
          eq(examsTable.id, parseInt(examId)),
          eq(examsTable.schoolCode, schoolCode)
        )
      )
      .limit(1);

    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const [gradingScheme] = await db
      .select()
      .from(gradingSchemesTable)
      .where(eq(gradingSchemesTable.schoolCode, schoolCode))
      .limit(1);

    const defaultScheme = {
      midTermTotal: 20,
      midTermCbt: 10,
      midTermTheory: 10,
      examTotal: 60,
      examCbt: 30,
      examTheory: 30,
      classActivityTotal: 20,
    };

    const scheme = gradingScheme || defaultScheme;

    let componentTotal = 0;
    let componentCbt = 0;
    let componentTheory = 0;

    if (exam.assessmentType === 'mid_term') {
      componentTotal = scheme.midTermTotal;
      componentCbt = scheme.midTermCbt;
      componentTheory = scheme.midTermTheory;
    } else if (exam.assessmentType === 'exam') {
      componentTotal = scheme.examTotal;
      componentCbt = scheme.examCbt;
      componentTheory = scheme.examTheory;
    } else {
      componentTotal = scheme.classActivityTotal;
    }

    // Get all results for this exam
    const resultsList = await db
      .select()
      .from(resultsTable)
      .where(
        and(
          eq(resultsTable.examId, parseInt(examId)),
          eq(resultsTable.schoolCode, schoolCode)
        )
      );

    // Get all subject scores for these students
    const studentIds = resultsList.map(r => r.studentId);
    const subjectScoresList = await db
      .select()
      .from(subjectScoresTable)
      .where(
        and(
          eq(subjectScoresTable.subjectName, exam.subject),
          eq(subjectScoresTable.schoolCode, schoolCode),
          sql`${subjectScoresTable.studentId} IN (${studentIds.join(',')})`
        )
      );

    const mergedResults = resultsList.map(result => {
      const scoreRecord = subjectScoresList.find(s => s.studentId === result.studentId);
      const rawCbtPercentage = (result.score / result.totalQuestions) * 100;
      const scaledCbtScore = (rawCbtPercentage / 100) * componentCbt;

      let componentScore = 0;
      let theoryPortion = 0;
      let totalScore = 0;
      let finalPercentage = 0;

      if (exam.assessmentType === 'mid_term') {
        // Get the stored midTermScore (which includes CBT + any theory entered)
        const storedMidTerm = scoreRecord?.midTermScore || 0;
        // Theory portion is what was added after the CBT
        theoryPortion = storedMidTerm - scaledCbtScore;
        componentScore = storedMidTerm;
        totalScore = componentScore;
        finalPercentage = (totalScore / componentTotal) * 100;
      } else if (exam.assessmentType === 'exam') {
        const storedExam = scoreRecord?.examScore || 0;
        theoryPortion = storedExam - scaledCbtScore;
        componentScore = storedExam;
        totalScore = componentScore;
        finalPercentage = (totalScore / componentTotal) * 100;
      } else {
        componentScore = scoreRecord?.classActivityScore || 0;
        totalScore = componentScore;
        finalPercentage = (totalScore / componentTotal) * 100;
      }

      return {
        studentId: result.studentId,
        studentName: result.fullName,
        studentClass: result.class,
        cbtRawScore: result.score,
        cbtTotal: result.totalQuestions,
        cbtPercentage: rawCbtPercentage,
        scaledCbtScore: Math.round(scaledCbtScore),
        theoryScore: Math.max(0, Math.round(theoryPortion)),
        componentScore: Math.round(componentScore),
        totalScore: Math.round(totalScore),
        maxScore: componentTotal,
        percentage: Math.round(finalPercentage),
        grade: finalPercentage >= 70 ? 'A' : finalPercentage >= 60 ? 'B' : finalPercentage >= 50 ? 'C' : finalPercentage >= 40 ? 'D' : 'F',
        submittedAt: result.submittedAt,
      };
    });

    res.json({
      exam: {
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        assessmentType: exam.assessmentType,
      },
      gradingScheme: {
        componentTotal,
        componentCbt,
        componentTheory,
      },
      results: mergedResults,
    });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Submit exam with grading scheme support
router.post("/:examId/submit", async (req: Request<ExamParams>, res: Response) => {
  const { schoolCode, examId } = req.params;
  const { studentId, fullName, answers } = req.body;

  if (!studentId || !fullName || !answers) {
    return res.status(400).json({ error: "studentId, fullName, and answers required" });
  }

  try {
    const [exam] = await db
      .select()
      .from(examsTable)
      .where(
        and(
          eq(examsTable.id, parseInt(examId)),
          eq(examsTable.schoolCode, schoolCode)
        )
      )
      .limit(1);

    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.examId, parseInt(examId)));

    let cbtScore = 0;
    for (const q of questions) {
      const studentAnswer = answers[q.id.toString()];
      if (studentAnswer && studentAnswer === q.correctOption) {
        cbtScore++;
      }
    }

    const totalQuestions = questions.length;
    const cbtPercentage = totalQuestions > 0 ? (cbtScore / totalQuestions) * 100 : 0;

    const [gradingScheme] = await db
      .select()
      .from(gradingSchemesTable)
      .where(eq(gradingSchemesTable.schoolCode, schoolCode))
      .limit(1);

    const defaultScheme = {
      midTermTotal: 20,
      midTermCbt: 10,
      midTermTheory: 10,
      examTotal: 60,
      examCbt: 30,
      examTheory: 30,
      classActivityTotal: 20,
    };

    const scheme = gradingScheme || defaultScheme;

    let componentTotal = 0;
    let componentCbt = 0;

    if (exam.assessmentType === 'mid_term') {
      componentTotal = scheme.midTermTotal;
      componentCbt = scheme.midTermCbt;
    } else if (exam.assessmentType === 'exam') {
      componentTotal = scheme.examTotal;
      componentCbt = scheme.examCbt;
    } else {
      componentTotal = scheme.classActivityTotal;
      componentCbt = 0;
    }

    const scaledCbtScore = componentCbt > 0 ? (cbtPercentage / 100) * componentCbt : 0;

    const [student] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, parseInt(studentId)))
      .limit(1);

    const studentClass = student?.class ?? "Unknown";

    const [result] = await db
      .insert(resultsTable)
      .values({
        examId: parseInt(examId),
        studentId: parseInt(studentId),
        fullName,
        class: studentClass,
        score: cbtScore,
        totalQuestions,
        percentage: (cbtScore / totalQuestions) * 100,
        schoolCode,
      })
      .returning();

    if (questions.length > 0) {
      type Question = typeof questionsTable.$inferSelect;
      await db.insert(resultAnswersTable).values(
        questions.map((q: Question) => ({
          resultId: result.id,
          questionId: q.id,
          questionText: q.text,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctOption: q.correctOption,
          selectedOption: answers[q.id.toString()] ?? null,
          isCorrect: (answers[q.id.toString()] ?? null) === q.correctOption,
          schoolCode,
        }))
      );
    }

    // Check if record exists
    const [existingScore] = await db
      .select()
      .from(subjectScoresTable)
      .where(
        and(
          eq(subjectScoresTable.studentId, parseInt(studentId)),
          eq(subjectScoresTable.subjectName, exam.subject)
        )
      )
      .limit(1);

    if (existingScore) {
      // Update existing record
      const updateData: any = { updatedAt: new Date() };
      if (exam.assessmentType === 'mid_term') updateData.midTermScore = Math.round(scaledCbtScore);
      if (exam.assessmentType === 'exam') updateData.examScore = Math.round(scaledCbtScore);
      if (exam.assessmentType === 'class_activity') updateData.classActivityScore = Math.round(scaledCbtScore);

      await db
        .update(subjectScoresTable)
        .set(updateData)
        .where(
          and(
            eq(subjectScoresTable.studentId, parseInt(studentId)),
            eq(subjectScoresTable.subjectName, exam.subject)
          )
        );
    } else {
      // Insert new record
      await db
        .insert(subjectScoresTable)
        .values({
          studentId: parseInt(studentId),
          subjectName: exam.subject,
          className: studentClass,
          schoolCode,
          ...(exam.assessmentType === 'mid_term' && { midTermScore: Math.round(scaledCbtScore) }),
          ...(exam.assessmentType === 'exam' && { examScore: Math.round(scaledCbtScore) }),
          ...(exam.assessmentType === 'class_activity' && { classActivityScore: Math.round(scaledCbtScore) }),
        });
    }

    res.json({
      ...result,
      examTitle: exam.title,
      subject: exam.subject,
      assessmentType: exam.assessmentType,
      cbtScore: cbtScore,
      scaledScore: Math.round(scaledCbtScore),
      totalPossible: componentTotal,
    });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Teacher enters theory and class activity scores
router.post("/:examId/scores", async (req: Request<ExamParams>, res: Response) => {
  const { schoolCode, examId } = req.params;
  const { studentId, theoryScore, classActivityScore } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: "studentId required" });
  }

  try {
    const [exam] = await db
      .select()
      .from(examsTable)
      .where(
        and(
          eq(examsTable.id, parseInt(examId)),
          eq(examsTable.schoolCode, schoolCode)
        )
      )
      .limit(1);

    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const [existing] = await db
      .select()
      .from(subjectScoresTable)
      .where(
        and(
          eq(subjectScoresTable.studentId, parseInt(studentId)),
          eq(subjectScoresTable.subjectName, exam.subject)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Student score record not found" });
    }

    const updateData: any = { updatedAt: new Date() };

    if (exam.assessmentType === 'class_activity') {
      updateData.classActivityScore = classActivityScore || 0;
    } else if (exam.assessmentType === 'mid_term') {
      // For mid-term, add theory score to existing midTermScore (which already has CBT)
      updateData.midTermScore = (existing.midTermScore || 0) + (theoryScore || 0);
    } else if (exam.assessmentType === 'exam') {
      // For exam, add theory score to existing examScore (which already has CBT)
      updateData.examScore = (existing.examScore || 0) + (theoryScore || 0);
    }

    const [updated] = await db
      .update(subjectScoresTable)
      .set(updateData)
      .where(
        and(
          eq(subjectScoresTable.studentId, parseInt(studentId)),
          eq(subjectScoresTable.subjectName, exam.subject)
        )
      )
      .returning();

    res.json(updated);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

export default router;