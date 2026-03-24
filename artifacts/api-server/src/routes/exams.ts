import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  examsTable,
  questionsTable,
  resultsTable,
  resultAnswersTable,
  usersTable,
  gradingSchemesTable,
  studentScoresTable,
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
    // Force examClass to be a string
    const className = String(examClass);

    // Log to debug if needed
    console.log(`Creating exam with class: ${className}`);

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
    // Delete questions first
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
        imageUrl: imageUrl || null, // Add this line
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

// Submit exam with grading scheme support based on assessment type
router.post("/:examId/submit", async (req: Request<ExamParams>, res: Response) => {
  const { schoolCode, examId } = req.params;
  const { studentId, fullName, answers } = req.body;

  if (!studentId || !fullName || !answers) {
    return res.status(400).json({ error: "studentId, fullName, and answers required" });
  }

  try {
    // Get exam
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

    // Get questions
    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.examId, parseInt(examId)));

    // Grade CBT portion
    let cbtScore = 0;
    for (const q of questions) {
      const studentAnswer = answers[q.id.toString()];
      if (studentAnswer && studentAnswer === q.correctOption) {
        cbtScore++;
      }
    }

    const totalQuestions = questions.length;
    const cbtPercentage = totalQuestions > 0 ? (cbtScore / totalQuestions) * 100 : 0;

    // Get grading scheme for this school
    const [gradingScheme] = await db
      .select()
      .from(gradingSchemesTable)
      .where(eq(gradingSchemesTable.schoolCode, schoolCode))
      .limit(1);

    // Default grading scheme if none exists
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

    // Calculate based on assessment type
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
      // Class Activity - no CBT portion
      componentTotal = scheme.classActivityTotal;
      componentCbt = 0;
      componentTheory = 0;
    }

    // Calculate scaled CBT score
    const scaledCbtScore = componentCbt > 0 ? (cbtPercentage / 100) * componentCbt : 0;

    // Get student's class
    const [student] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, parseInt(studentId)))
      .limit(1);

    const studentClass = student?.class ?? "Unknown";

    // Save result
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

    // Save individual answers for detailed review
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

    // Save to student_scores table with CBT score
    await db
      .insert(studentScoresTable)
      .values({
        studentId: parseInt(studentId),
        examId: parseInt(examId),
        schoolCode,
        cbtScore: cbtScore,
        theoryScore: 0,
        classActivityScore: 0,
        totalScore: Math.round(scaledCbtScore),
        percentage: componentTotal > 0 ? Math.round((scaledCbtScore / componentTotal) * 100) : 0,
      })
      .onConflictDoUpdate({
        target: [studentScoresTable.studentId, studentScoresTable.examId],
        set: {
          cbtScore: cbtScore,
          totalScore: Math.round(scaledCbtScore),
          percentage: componentTotal > 0 ? Math.round((scaledCbtScore / componentTotal) * 100) : 0,
          updatedAt: new Date(),
        },
      });

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
// Teacher enters theory and class activity scores
router.post("/:examId/scores", async (req: Request<ExamParams>, res: Response) => {
  const { schoolCode, examId } = req.params;
  const { studentId, theoryScore, classActivityScore } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: "studentId required" });
  }

  try {
    // Get exam to know assessment type
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

    // Get grading scheme
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

    // Get component totals based on assessment type
    let componentCbt = 0;
    let componentTheory = 0;
    let componentTotal = 0;

    if (exam.assessmentType === 'mid_term') {
      componentCbt = scheme.midTermCbt;
      componentTheory = scheme.midTermTheory;
      componentTotal = scheme.midTermTotal;
    } else if (exam.assessmentType === 'exam') {
      componentCbt = scheme.examCbt;
      componentTheory = scheme.examTheory;
      componentTotal = scheme.examTotal;
    } else {
      // Class Activity
      componentTotal = scheme.classActivityTotal;
    }

    // Get existing student score
    const [existing] = await db
      .select()
      .from(studentScoresTable)
      .where(
        and(
          eq(studentScoresTable.studentId, parseInt(studentId)),
          eq(studentScoresTable.examId, parseInt(examId))
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Student score record not found" });
    }

    // Calculate total score based on assessment type
    let totalScore = 0;
    if (exam.assessmentType === 'class_activity') {
      totalScore = (classActivityScore || 0);
    } else {
      totalScore = (existing.cbtScore || 0) + (theoryScore || 0);
    }

    const maxTotal = componentTotal;
    const percentage = maxTotal > 0 ? (totalScore / maxTotal) * 100 : 0;

    // Update student scores
    const updateData: any = {
      totalScore: totalScore,
      percentage: Math.round(percentage),
      updatedAt: new Date(),
    };

    if (exam.assessmentType !== 'class_activity') {
      updateData.theoryScore = theoryScore || 0;
    }

    if (exam.assessmentType === 'class_activity') {
      updateData.classActivityScore = classActivityScore || 0;
    }

    const [updated] = await db
      .update(studentScoresTable)
      .set(updateData)
      .where(
        and(
          eq(studentScoresTable.studentId, parseInt(studentId)),
          eq(studentScoresTable.examId, parseInt(examId))
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