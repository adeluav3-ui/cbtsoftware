import { Router, Request, Response } from "express";
import { requireAuth, requireSchoolStaff } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import {
  examsTable,
  questionsTable,
  resultsTable,
  resultAnswersTable,
  usersTable,
  gradingSchemesTable,
  subjectScoresTable,
  schoolsTable,
} from "@workspace/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

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

type RequestWithSession = Request & { session: Session };

const router = Router({ mergeParams: true });

// Helper function to safely convert param to number
const toNumber = (value: string | string[]): number => {
  return parseInt(String(value), 10);
};

// Helper function to safely convert param to string
const toString = (value: string | string[]): string => {
  return String(value);
};

// List exams for a school
router.get("/", requireAuth, async (req: RequestWithSession, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = toString(schoolCode);
  const { class: examClass, active, page, limit } = req.query;
  const userId = req.session?.userId;
  const userRole = req.session?.role;
  const pageNum = page ? parseInt(page as string) : null;
  const limitNum = limit ? parseInt(limit as string) : null;

  try {
    const conditions: any[] = [eq(examsTable.schoolCode, schoolCodeStr)];

    if (examClass && typeof examClass === "string") {
      conditions.push(eq(examsTable.class, examClass));
    }

    if (active !== undefined) {
      conditions.push(eq(examsTable.isActive, active === "true"));
    }

    // Teachers only see their own exams; students see all active exams for their class
    if (userRole === 'teacher' && userId) {
      conditions.push(eq(examsTable.teacherId, userId));
    }

    const baseQuery = db
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
        term: examsTable.term,
        createdAt: examsTable.createdAt,
        questionCount: sql<number>`(SELECT COUNT(*) FROM questions WHERE questions.exam_id = exams.id)`.as("question_count"),
      })
      .from(examsTable)
      .where(and(...conditions))
      .orderBy(examsTable.createdAt);

    const exams = (pageNum && limitNum)
      ? await baseQuery.limit(limitNum).offset((pageNum - 1) * limitNum)
      : await baseQuery;

    res.json(exams);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Create exam
router.post("/", requireSchoolStaff, async (req: RequestWithSession, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = toString(schoolCode);
  const session = req.session;
  const { title, subject, class: examClass, durationMinutes, assessmentType, term } = req.body;

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
        schoolCode: schoolCodeStr,
        teacherId: Number(teacherId),
        isActive: false,
        assessmentType: assessmentType || "exam",
        term: term || "First Term",
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

// Create a new group for an exam
router.post("/:examId/groups", requireSchoolStaff, async (req: Request<ExamParams>, res: Response) => {
  const { examId } = req.params;
  const examIdNum = toNumber(examId);
  const { groupImageUrl, groupTitle, groupText } = req.body;

  if (!groupTitle || !groupTitle.trim()) {
    return res.status(400).json({ error: "Group title is required" });
  }

  try {
    const [maxGroup] = await db
      .select({ maxId: sql<number>`COALESCE(MAX(group_id), 0)` })
      .from(questionsTable)
      .where(eq(questionsTable.examId, examIdNum));

    const newGroupId = (maxGroup?.maxId || 0) + 1;

    res.json({
      success: true,
      groupId: newGroupId,
      groupImageUrl: groupImageUrl || null,
      groupTitle: groupTitle.trim(),
      groupText: groupText?.trim() || null,
    });
    return;
  } catch (err) {
    console.error("Error creating group:", err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Get exam with questions (grouped)
router.get("/:examId", requireAuth, async (req: Request<ExamParams>, res: Response) => {
  const { schoolCode, examId } = req.params;
  const schoolCodeStr = toString(schoolCode);
  const examIdNum = toNumber(examId);

  try {
    const [exam] = await db
      .select()
      .from(examsTable)
      .where(
        and(
          eq(examsTable.id, examIdNum),
          eq(examsTable.schoolCode, schoolCodeStr)
        )
      )
      .limit(1);

    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    // Order by the effective position of each question/group in the overall
    // list. For standalone questions this is their own id. For grouped
    // questions this is the minimum id of any question in that group —
    // i.e. when the group was first "used". This preserves the creation
    // order regardless of whether group_id (which is a small integer) is
    // numerically less than standalone question ids (which grow large).
    // Without this, ORDER BY group_id would put all groups before all
    // standalone questions because NULL sorts last in Postgres ASC order.
    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.examId, examIdNum))
      .orderBy(
        sql`CASE WHEN questions.group_id IS NULL THEN questions.id ELSE (SELECT MIN(q2.id) FROM questions q2 WHERE q2.group_id = questions.group_id AND q2.exam_id = ${examIdNum}) END`,
        questionsTable.groupOrder,
        questionsTable.id
      );

    const groupedResult: any[] = [];
    let currentGroup: any = null;
    let currentGroupId: number | null = null;

    for (const q of questions) {
      if (q.groupId !== null && q.groupId !== currentGroupId) {
        if (currentGroup) {
          groupedResult.push(currentGroup);
        }
        currentGroup = {
          isGroup: true,
          groupId: q.groupId,
          groupImageUrl: q.groupImageUrl,
          groupTitle: q.groupTitle,
          groupText: q.groupText,
          questions: [q],
        };
        currentGroupId = q.groupId;
      } else if (q.groupId !== null && q.groupId === currentGroupId) {
        currentGroup.questions.push(q);
      } else {
        if (currentGroup) {
          groupedResult.push(currentGroup);
          currentGroup = null;
          currentGroupId = null;
        }
        groupedResult.push({
          isGroup: false,
          question: q,
        });
      }
    }

    if (currentGroup) {
      groupedResult.push(currentGroup);
    }

    res.json({ ...exam, questions: groupedResult });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Transfer exam to a different class
router.patch("/:examId", requireSchoolStaff, async (req: RequestWithSession, res: Response) => {
  const { schoolCode, examId } = req.params;
  const schoolCodeStr = toString(schoolCode);
  const examIdNum = toNumber(examId);
  const { class: newClass } = req.body;
  const userId = req.session?.userId;
  const userRole = req.session?.role;

  const validClasses = ["Pre-School", "KG1", "KG2", "Nursery 1", "Nursery 2", "Pry 1", "Pry 2", "Pry 3", "Pry 4", "Pry 5", "JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3", "Entrance Exam", "Staff Interview"];
  if (!newClass || !validClasses.includes(newClass)) {
    return res.status(400).json({ error: "Valid class is required" });
  }

  try {
    const [existingExam] = await db
      .select()
      .from(examsTable)
      .where(and(eq(examsTable.id, examIdNum), eq(examsTable.schoolCode, schoolCodeStr)))
      .limit(1);

    if (!existingExam) return res.status(404).json({ error: "Exam not found" });

    if (userRole === 'teacher' && userId && existingExam.teacherId !== userId) {
      return res.status(403).json({ error: "You don't have permission to modify this exam" });
    }

    const [updated] = await db
      .update(examsTable)
      .set({ class: newClass })
      .where(and(eq(examsTable.id, examIdNum), eq(examsTable.schoolCode, schoolCodeStr)))
      .returning();

    res.json(updated);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Delete exam
router.delete("/:examId", requireSchoolStaff, async (req: RequestWithSession, res: Response) => {
  const { schoolCode, examId } = req.params;
  const schoolCodeStr = toString(schoolCode);
  const examIdNum = toNumber(examId);
  const userId = req.session?.userId;
  const userRole = req.session?.role;

  try {
    const [existingExam] = await db
      .select()
      .from(examsTable)
      .where(
        and(
          eq(examsTable.id, examIdNum),
          eq(examsTable.schoolCode, schoolCodeStr)
        )
      )
      .limit(1);

    if (!existingExam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    if (userRole === 'teacher') {
      if (!userId) {
        return res.status(401).json({ error: "User ID not found in session" });
      }
      if (existingExam.teacherId !== userId) {
        return res.status(403).json({ error: "You don't have permission to delete this exam" });
      }
    }

    const deleted = await db.transaction(async (tx) => {
      const examResults = await tx
        .select({ id: resultsTable.id, studentId: resultsTable.studentId })
        .from(resultsTable)
        .where(and(eq(resultsTable.examId, examIdNum), eq(resultsTable.schoolCode, schoolCodeStr)));

      if (examResults.length > 0) {
        const resultIds = examResults.map(r => r.id);
        await tx.delete(resultAnswersTable).where(inArray(resultAnswersTable.resultId, resultIds));
        await tx.delete(resultsTable).where(and(eq(resultsTable.examId, examIdNum), eq(resultsTable.schoolCode, schoolCodeStr)));

        // Null out the score component for this assessment type on each affected student
        if (existingExam.assessmentType === 'mid_term') {
          const studentIds = examResults.map(r => r.studentId);
          await tx.update(subjectScoresTable)
            .set({ midTermScore: null, totalScore: null, percentage: null, grade: null, updatedAt: new Date() })
            .where(and(
              inArray(subjectScoresTable.studentId, studentIds),
              eq(subjectScoresTable.subjectName, existingExam.subject),
              eq(subjectScoresTable.schoolCode, schoolCodeStr)
            ));
        } else if (existingExam.assessmentType === 'exam') {
          const studentIds = examResults.map(r => r.studentId);
          await tx.update(subjectScoresTable)
            .set({ examScore: null, totalScore: null, percentage: null, grade: null, updatedAt: new Date() })
            .where(and(
              inArray(subjectScoresTable.studentId, studentIds),
              eq(subjectScoresTable.subjectName, existingExam.subject),
              eq(subjectScoresTable.schoolCode, schoolCodeStr)
            ));
        } else if (existingExam.assessmentType === 'class_activity') {
          const studentIds = examResults.map(r => r.studentId);
          await tx.update(subjectScoresTable)
            .set({ classActivityScore: null, totalScore: null, percentage: null, grade: null, updatedAt: new Date() })
            .where(and(
              inArray(subjectScoresTable.studentId, studentIds),
              eq(subjectScoresTable.subjectName, existingExam.subject),
              eq(subjectScoresTable.schoolCode, schoolCodeStr)
            ));
        }
      }

      await tx.delete(questionsTable).where(eq(questionsTable.examId, examIdNum));

      const [deletedExam] = await tx
        .delete(examsTable)
        .where(and(eq(examsTable.id, examIdNum), eq(examsTable.schoolCode, schoolCodeStr)))
        .returning();

      return deletedExam;
    });

    if (!deleted) {
      return res.status(404).json({ error: "Exam not found" });
    }

    res.json({ message: "Exam deleted successfully" });
    return;
  } catch (err) {
    console.error("Error deleting exam:", err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Toggle exam active/inactive
router.post("/:examId/toggle", requireSchoolStaff, async (req: RequestWithSession, res: Response) => {
  const { schoolCode, examId } = req.params;
  const schoolCodeStr = toString(schoolCode);
  const examIdNum = toNumber(examId);
  const { isActive } = req.body;
  const userId = req.session?.userId;
  const userRole = req.session?.role;

  try {
    const [existingExam] = await db
      .select()
      .from(examsTable)
      .where(
        and(
          eq(examsTable.id, examIdNum),
          eq(examsTable.schoolCode, schoolCodeStr)
        )
      )
      .limit(1);

    if (!existingExam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    if (userRole === 'teacher') {
      if (!userId) {
        return res.status(401).json({ error: "User ID not found in session" });
      }
      if (existingExam.teacherId !== userId) {
        return res.status(403).json({ error: "You don't have permission to modify this exam" });
      }
    }

    const [exam] = await db
      .update(examsTable)
      .set({ isActive })
      .where(
        and(
          eq(examsTable.id, examIdNum),
          eq(examsTable.schoolCode, schoolCodeStr)
        )
      )
      .returning();

    const questionCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(questionsTable)
      .where(eq(questionsTable.examId, examIdNum));

    res.json({ ...exam, questionCount: questionCount[0]?.count ?? 0 });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Bulk add questions (with optional group)
router.post("/:examId/questions/bulk", requireSchoolStaff, async (req: Request<ExamParams>, res: Response) => {
  const { schoolCode, examId } = req.params;
  const schoolCodeStr = toString(schoolCode);
  const examIdNum = toNumber(examId);
  const { questions, groupId, groupTitle, groupText, groupImageUrl } = req.body;

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
    let startOrder = 0;
    if (groupId) {
      const existingInGroup = await db
        .select({ count: sql<number>`count(*)` })
        .from(questionsTable)
        .where(
          and(
            eq(questionsTable.examId, examIdNum),
            eq(questionsTable.groupId, groupId)
          )
        );
      startOrder = existingInGroup[0]?.count || 0;
    }

    const inserted = await db
      .insert(questionsTable)
      .values(
        questions.map((q: any, idx: number) => ({
          examId: examIdNum,
          text: String(q.text),
          optionA: String(q.optionA),
          optionB: String(q.optionB),
          optionC: String(q.optionC),
          optionD: String(q.optionD),
          correctOption: String(q.correctOption),
          schoolCode: schoolCodeStr,
          imageUrl: q.imageUrl || null,
          groupId: groupId || null,
          groupOrder: groupId ? startOrder + idx : 0,
          groupTitle: groupId ? (groupTitle || null) : null,
          groupText: groupId ? (groupText || null) : null,
          groupImageUrl: groupId ? (groupImageUrl || null) : null,
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

// Add question to exam (with optional group)
router.post("/:examId/questions", requireSchoolStaff, async (req: Request<ExamParams>, res: Response) => {
  const { schoolCode, examId } = req.params;
  const schoolCodeStr = toString(schoolCode);
  const examIdNum = toNumber(examId);
  const { text, optionA, optionB, optionC, optionD, correctOption, imageUrl, groupId, groupOrder, groupTitle, groupText, groupImageUrl } = req.body;

  if (!text || !optionA || !optionB || !optionC || !optionD || !correctOption) {
    return res.status(400).json({ error: "All question fields are required" });
  }

  try {
    let finalGroupOrder = groupOrder || 0;
    if (groupId) {
      const existingInGroup = await db
        .select({ count: sql<number>`count(*)` })
        .from(questionsTable)
        .where(
          and(
            eq(questionsTable.examId, examIdNum),
            eq(questionsTable.groupId, groupId)
          )
        );
      finalGroupOrder = existingInGroup[0]?.count || 0;
    }

    const [question] = await db
      .insert(questionsTable)
      .values({
        examId: examIdNum,
        text,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption,
        schoolCode: schoolCodeStr,
        imageUrl: imageUrl || null,
        groupId: groupId || null,
        groupOrder: finalGroupOrder,
        groupTitle: groupId ? (groupTitle || null) : null,
        groupText: groupId ? (groupText || null) : null,
        groupImageUrl: groupId ? (groupImageUrl || null) : null,
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
router.patch("/:examId/questions/:questionId", requireSchoolStaff, async (req: Request<QuestionParams>, res: Response) => {
  const { examId, questionId } = req.params;
  const examIdNum = toNumber(examId);
  const questionIdNum = toNumber(questionId);
  const { text, optionA, optionB, optionC, optionD, correctOption, imageUrl } = req.body;

  if (!text || !optionA || !optionB || !optionC || !optionD || !correctOption) {
    return res.status(400).json({ error: "All question fields are required" });
  }
  if (!["A", "B", "C", "D"].includes(correctOption)) {
    return res.status(400).json({ error: "correctOption must be A, B, C, or D" });
  }

  try {
    const [updated] = await db
      .update(questionsTable)
      .set({ text, optionA, optionB, optionC, optionD, correctOption, imageUrl: imageUrl || null })
      .where(and(eq(questionsTable.id, questionIdNum), eq(questionsTable.examId, examIdNum)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Question not found" });
    res.json(updated);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

router.delete("/:examId/questions/:questionId", requireSchoolStaff, async (req: Request<QuestionParams>, res: Response) => {
  const { examId, questionId } = req.params;
  const examIdNum = toNumber(examId);
  const questionIdNum = toNumber(questionId);

  try {
    const [deleted] = await db
      .delete(questionsTable)
      .where(
        and(
          eq(questionsTable.id, questionIdNum),
          eq(questionsTable.examId, examIdNum)
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
router.get("/:examId/results", requireSchoolStaff, async (req: RequestWithSession, res: Response) => {
  const { schoolCode, examId } = req.params;
  const schoolCodeStr = toString(schoolCode);
  const examIdNum = toNumber(examId);
  const userId = req.session?.userId;
  const userRole = req.session?.role;

  try {
    const [exam] = await db
      .select()
      .from(examsTable)
      .where(
        and(
          eq(examsTable.id, examIdNum),
          eq(examsTable.schoolCode, schoolCodeStr)
        )
      )
      .limit(1);

    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    if (userRole === 'teacher') {
      if (!userId) {
        return res.status(401).json({ error: "User ID not found in session" });
      }
      if (exam.teacherId !== userId) {
        return res.status(403).json({ error: "You don't have permission to view results for this exam" });
      }
    }

    const [gradingScheme] = await db
      .select()
      .from(gradingSchemesTable)
      .where(eq(gradingSchemesTable.schoolCode, schoolCodeStr))
      .limit(1);

    const defaultScheme = {
      midTermTotal: 20,
      midTermCbt: 10,
      midTermTheory: 10,
      examTotal: 60,
      examCbt: 30,
      examTheory: 30,
      classActivityTotal: 20,
      gradeAMin: 70,
      gradeBMin: 60,
      gradeCMin: 50,
      gradeDMin: 40,
      gradeFMax: 39,
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

    const resultsList = await db
      .select()
      .from(resultsTable)
      .where(
        and(
          eq(resultsTable.examId, examIdNum),
          eq(resultsTable.schoolCode, schoolCodeStr)
        )
      );

    if (resultsList.length === 0) {
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
        results: [],
      });
      return;
    }

    const studentIds = resultsList.map(r => r.studentId);

    const subjectScoresList = await db
      .select()
      .from(subjectScoresTable)
      .where(
        and(
          eq(subjectScoresTable.subjectName, exam.subject),
          eq(subjectScoresTable.schoolCode, schoolCodeStr),
          inArray(subjectScoresTable.studentId, studentIds)
        )
      );

    const scoreByStudentId = new Map(subjectScoresList.map(s => [s.studentId, s]));

    const mergedResults = resultsList.map(result => {
      const scoreRecord = scoreByStudentId.get(result.studentId);
      const rawCbtPercentage = (result.score / result.totalQuestions) * 100;
      const scaledCbtScore = (rawCbtPercentage / 100) * componentCbt;

      let componentScore = 0;
      let theoryPortion = 0;

      if (exam.assessmentType === 'mid_term') {
        const storedMidTerm = scoreRecord?.midTermScore || 0;
        theoryPortion = storedMidTerm - scaledCbtScore;
        componentScore = storedMidTerm;
      } else if (exam.assessmentType === 'exam') {
        const storedExam = scoreRecord?.examScore || 0;
        theoryPortion = storedExam - scaledCbtScore;
        componentScore = storedExam;
      } else {
        componentScore = scoreRecord?.classActivityScore || 0;
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
        classActivityScore: scoreRecord?.classActivityScore || 0,
        componentScore: Math.round(componentScore),
        maxScore: componentTotal,
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

// Submit exam
router.post("/:examId/submit", requireAuth, async (req: Request<ExamParams>, res: Response) => {
  const { schoolCode, examId } = req.params;
  const schoolCodeStr = toString(schoolCode);
  const examIdNum = toNumber(examId);
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
          eq(examsTable.id, examIdNum),
          eq(examsTable.schoolCode, schoolCodeStr)
        )
      )
      .limit(1);

    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.examId, examIdNum));

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
      .where(eq(gradingSchemesTable.schoolCode, schoolCodeStr))
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

    // Duplicate submission guard
    const [existingResult] = await db
      .select({ id: resultsTable.id })
      .from(resultsTable)
      .where(and(eq(resultsTable.examId, examIdNum), eq(resultsTable.studentId, parseInt(String(studentId), 10))))
      .limit(1);
    if (existingResult) {
      return res.status(409).json({ error: "You have already submitted this exam." });
    }

    const [student] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, parseInt(String(studentId), 10)))
      .limit(1);

    const studentClass = student?.class ?? "Unknown";

    // Fetch school for current term/session
    const [school] = await db
      .select({ currentTerm: schoolsTable.currentTerm, currentAcademicSession: schoolsTable.currentAcademicSession })
      .from(schoolsTable)
      .where(eq(schoolsTable.code, schoolCodeStr))
      .limit(1);
    const currentTerm = school?.currentTerm ?? "First Term";
    const currentAcademicSession = school?.currentAcademicSession ?? "2025/2026";

    const [result] = await db
      .insert(resultsTable)
      .values({
        examId: examIdNum,
        studentId: parseInt(String(studentId), 10),
        fullName,
        class: studentClass,
        score: cbtScore,
        totalQuestions,
        percentage: (cbtScore / totalQuestions) * 100,
        schoolCode: schoolCodeStr,
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
          schoolCode: schoolCodeStr,
        }))
      );
    }

    const roundedCbt = Math.round(scaledCbtScore);
    const scoreValues: any = {
      studentId: parseInt(String(studentId), 10),
      subjectName: exam.subject,
      className: studentClass,
      schoolCode: schoolCodeStr,
      term: currentTerm,
      academicSession: currentAcademicSession,
    };
    const scoreUpdate: any = { updatedAt: new Date() };

    if (exam.assessmentType === 'mid_term') {
      scoreValues.midTermScore = roundedCbt;
      scoreValues.midTermCbtScore = roundedCbt;
      scoreUpdate.midTermScore = roundedCbt;
      scoreUpdate.midTermCbtScore = roundedCbt;
    } else if (exam.assessmentType === 'exam') {
      scoreValues.examScore = roundedCbt;
      scoreValues.examCbtScore = roundedCbt;
      scoreUpdate.examScore = roundedCbt;
      scoreUpdate.examCbtScore = roundedCbt;
    } else if (exam.assessmentType === 'class_activity') {
      scoreValues.classActivityScore = roundedCbt;
      scoreUpdate.classActivityScore = roundedCbt;
    }

    await db
      .insert(subjectScoresTable)
      .values(scoreValues)
      .onConflictDoUpdate({
        target: [subjectScoresTable.studentId, subjectScoresTable.subjectName, subjectScoresTable.term, subjectScoresTable.academicSession],
        set: scoreUpdate,
      });

    res.json({
      ...result,
      examTitle: exam.title,
      subject: exam.subject,
      assessmentType: exam.assessmentType,
      cbtScore: cbtScore,
      scaledScore: roundedCbt,
      totalPossible: componentTotal,
    });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Reassign an exam's subject and/or assessment type and migrate stored scores safely.
// Raw resultsTable rows are never touched — they are the source of truth.
router.post("/:examId/reassign", requireSchoolStaff, async (req: Request<ExamParams>, res: Response) => {
  const { schoolCode, examId } = req.params;
  const schoolCodeStr = toString(schoolCode);
  const examIdNum = toNumber(examId);
  const { newSubject, newAssessmentType } = req.body as { newSubject?: string; newAssessmentType?: string };

  if (!newSubject?.trim() || !newAssessmentType?.trim()) {
    return res.status(400).json({ error: "newSubject and newAssessmentType are required" });
  }
  const validTypes = ["mid_term", "exam", "class_activity"];
  if (!validTypes.includes(newAssessmentType)) {
    return res.status(400).json({ error: `newAssessmentType must be one of: ${validTypes.join(", ")}` });
  }

  try {
    const [exam] = await db.select().from(examsTable)
      .where(and(eq(examsTable.id, examIdNum), eq(examsTable.schoolCode, schoolCodeStr)))
      .limit(1);
    if (!exam) return res.status(404).json({ error: "Exam not found" });

    const oldSubject = exam.subject ?? "";
    const oldType = exam.assessmentType ?? "exam";
    const newSubjectTrimmed = newSubject.trim();

    // No-op check
    if (oldSubject === newSubjectTrimmed && oldType === newAssessmentType) {
      return res.json({ ok: true, message: "No changes needed", migrated: 0 });
    }

    // Grading scheme for recalculating scaled scores
    const [scheme] = await db.select().from(gradingSchemesTable)
      .where(eq(gradingSchemesTable.schoolCode, schoolCodeStr)).limit(1);
    const midTermCbt = scheme?.midTermCbt ?? 10;
    const examCbt = scheme?.examCbt ?? 30;
    const classActivityTotal = scheme?.classActivityTotal ?? 20;

    const newCbtMax = newAssessmentType === "mid_term" ? midTermCbt
      : newAssessmentType === "exam" ? examCbt
      : classActivityTotal;

    // Raw CBT results for this exam (source of truth)
    const rawResults = await db.select({
      studentId: resultsTable.studentId,
      score: resultsTable.score,
      totalQuestions: resultsTable.totalQuestions,
      class: resultsTable.class,
    }).from(resultsTable)
      .where(and(eq(resultsTable.examId, examIdNum), eq(resultsTable.schoolCode, schoolCodeStr)));

    if (rawResults.length === 0) {
      // No submissions yet — just update the exam record
      await db.update(examsTable)
        .set({ subject: newSubjectTrimmed, assessmentType: newAssessmentType })
        .where(and(eq(examsTable.id, examIdNum), eq(examsTable.schoolCode, schoolCodeStr)));
      return res.json({ ok: true, message: "Exam updated (no submissions to migrate)", migrated: 0 });
    }

    // Fetch school for current term/session context
    const [school] = await db.select({
      currentTerm: schoolsTable.currentTerm,
      currentAcademicSession: schoolsTable.currentAcademicSession,
    }).from(schoolsTable).where(eq(schoolsTable.code, schoolCodeStr)).limit(1);
    const currentTerm = school?.currentTerm ?? "First Term";
    const currentAcademicSession = school?.currentAcademicSession ?? "2025/2026";

    await db.transaction(async (tx) => {
      for (const r of rawResults) {
        if (!r.totalQuestions || r.totalQuestions === 0) continue;
        const newScaled = Math.round((r.score / r.totalQuestions) * newCbtMax);

        // 1. Upsert the new column on the new subject row
        const newValues: any = {
          studentId: r.studentId,
          subjectName: newSubjectTrimmed,
          className: r.class ?? "Unknown",
          schoolCode: schoolCodeStr,
          term: currentTerm,
          academicSession: currentAcademicSession,
        };
        const newUpdate: any = { updatedAt: new Date() };
        if (newAssessmentType === "mid_term") {
          newValues.midTermScore = newScaled;
          newValues.midTermCbtScore = newScaled;
          newUpdate.midTermScore = newScaled;
          newUpdate.midTermCbtScore = newScaled;
        } else if (newAssessmentType === "exam") {
          newValues.examScore = newScaled;
          newValues.examCbtScore = newScaled;
          newUpdate.examScore = newScaled;
          newUpdate.examCbtScore = newScaled;
        } else {
          newValues.classActivityScore = newScaled;
          newUpdate.classActivityScore = newScaled;
        }

        await tx.insert(subjectScoresTable).values(newValues)
          .onConflictDoUpdate({
            target: [subjectScoresTable.studentId, subjectScoresTable.subjectName, subjectScoresTable.term, subjectScoresTable.academicSession],
            set: newUpdate,
          });

        // 2. Clear the OLD column from the old subject row (only the column this exam owned)
        if (oldSubject !== newSubjectTrimmed || oldType !== newAssessmentType) {
          const clearUpdate: any = { updatedAt: new Date() };
          if (oldType === "mid_term") {
            clearUpdate.midTermScore = null;
            clearUpdate.midTermCbtScore = null;
          } else if (oldType === "exam") {
            clearUpdate.examScore = null;
            clearUpdate.examCbtScore = null;
          } else {
            clearUpdate.classActivityScore = null;
          }
          await tx.update(subjectScoresTable)
            .set(clearUpdate)
            .where(and(
              eq(subjectScoresTable.studentId, r.studentId),
              eq(subjectScoresTable.subjectName, oldSubject),
              eq(subjectScoresTable.schoolCode, schoolCodeStr),
              eq(subjectScoresTable.term, currentTerm),
              eq(subjectScoresTable.academicSession, currentAcademicSession),
            ));
        }
      }

      // 3. Update the exam record itself
      await tx.update(examsTable)
        .set({ subject: newSubjectTrimmed, assessmentType: newAssessmentType })
        .where(and(eq(examsTable.id, examIdNum), eq(examsTable.schoolCode, schoolCodeStr)));
    });

    res.json({
      ok: true,
      message: `Reassigned ${rawResults.length} student scores from "${oldSubject}" (${oldType}) → "${newSubjectTrimmed}" (${newAssessmentType})`,
      migrated: rawResults.length,
    });
    return;
  } catch (err) {
    console.error("Exam reassign error:", err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Teacher enters theory and class activity scores
router.post("/:examId/scores", requireSchoolStaff, async (req: Request<ExamParams>, res: Response) => {
  const { schoolCode, examId } = req.params;
  const schoolCodeStr = toString(schoolCode);
  const examIdNum = toNumber(examId);
  const { studentId, theoryScore, classActivityScore } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: "studentId required" });
  }

  try {
    const [exam] = await db
      .select()
      .from(examsTable)
      .where(and(eq(examsTable.id, examIdNum), eq(examsTable.schoolCode, schoolCodeStr)))
      .limit(1);

    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const [[gradingScheme], [school]] = await Promise.all([
      db.select().from(gradingSchemesTable).where(eq(gradingSchemesTable.schoolCode, schoolCodeStr)).limit(1),
      db.select({ currentTerm: schoolsTable.currentTerm, currentAcademicSession: schoolsTable.currentAcademicSession })
        .from(schoolsTable).where(eq(schoolsTable.code, schoolCodeStr)).limit(1),
    ]);

    const defaultScheme = {
      midTermTotal: 20, midTermCbt: 10, midTermTheory: 10,
      examTotal: 60, examCbt: 30, examTheory: 30,
      classActivityTotal: 20,
      gradeAMin: 70, gradeBMin: 60, gradeCMin: 50, gradeDMin: 40, gradeFMax: 39,
    };
    const scheme = gradingScheme || defaultScheme;
    const currentTerm = school?.currentTerm ?? "First Term";
    const currentAcademicSession = school?.currentAcademicSession ?? "2025/2026";

    let componentTotal = 0;
    if (exam.assessmentType === 'mid_term') componentTotal = scheme.midTermTotal;
    else if (exam.assessmentType === 'exam') componentTotal = scheme.examTotal;
    else componentTotal = scheme.classActivityTotal;

    const [existing] = await db
      .select()
      .from(subjectScoresTable)
      .where(and(
        eq(subjectScoresTable.studentId, parseInt(String(studentId), 10)),
        eq(subjectScoresTable.subjectName, exam.subject),
        eq(subjectScoresTable.term, currentTerm),
        eq(subjectScoresTable.academicSession, currentAcademicSession),
      ))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Student score record not found. The student must take the CBT exam first." });
    }

    // Lock class_activity if already entered (score is entirely teacher-entered, no CBT portion)
    if (exam.assessmentType === 'class_activity' && existing.classActivityScore !== null) {
      return res.status(403).json({ error: "Class activity score already entered and cannot be changed. Contact admin if correction needed." });
    }

    // Lock theory if it was already added on top of the CBT score.
    // midTermCbtScore tracks the CBT-only portion; if midTermScore > midTermCbtScore, theory was already added.
    if (exam.assessmentType === 'mid_term') {
      const cbtOnly = existing.midTermCbtScore;
      const combined = existing.midTermScore;
      if (cbtOnly !== null && combined !== null && combined !== cbtOnly) {
        return res.status(403).json({ error: "Theory score already entered and cannot be changed. Contact admin if correction needed." });
      }
      if (cbtOnly === null && combined !== null && combined > 0) {
        // Legacy record: no CBT tracking column — treat any non-zero score as locked
        return res.status(403).json({ error: "Theory score already entered and cannot be changed. Contact admin if correction needed." });
      }
    }
    if (exam.assessmentType === 'exam') {
      const cbtOnly = existing.examCbtScore;
      const combined = existing.examScore;
      if (cbtOnly !== null && combined !== null && combined !== cbtOnly) {
        return res.status(403).json({ error: "Theory score already entered and cannot be changed. Contact admin if correction needed." });
      }
      if (cbtOnly === null && combined !== null && combined > 0) {
        return res.status(403).json({ error: "Theory score already entered and cannot be changed. Contact admin if correction needed." });
      }
    }

    const updateData: any = { updatedAt: new Date() };
    let totalScore = 0;

    if (exam.assessmentType === 'class_activity') {
      updateData.classActivityScore = classActivityScore ?? 0;
      totalScore = updateData.classActivityScore;
    } else if (exam.assessmentType === 'mid_term') {
      // Always use midTermCbtScore as the base so theory doesn't stack
      const cbtBase = existing.midTermCbtScore ?? existing.midTermScore ?? 0;
      const theory = theoryScore ?? 0;
      totalScore = cbtBase + theory;
      updateData.midTermScore = totalScore;
    } else if (exam.assessmentType === 'exam') {
      const cbtBase = existing.examCbtScore ?? existing.examScore ?? 0;
      const theory = theoryScore ?? 0;
      totalScore = cbtBase + theory;
      updateData.examScore = totalScore;
    }

    const percentage = componentTotal > 0 ? (totalScore / componentTotal) * 100 : 0;
    updateData.totalScore = totalScore;
    updateData.percentage = Math.round(percentage);

    let grade = 'F';
    if (percentage >= scheme.gradeAMin) grade = 'A';
    else if (percentage >= scheme.gradeBMin) grade = 'B';
    else if (percentage >= scheme.gradeCMin) grade = 'C';
    else if (percentage >= scheme.gradeDMin) grade = 'D';

    updateData.grade = grade;

    const [updated] = await db
      .update(subjectScoresTable)
      .set(updateData)
      .where(and(
        eq(subjectScoresTable.studentId, parseInt(String(studentId), 10)),
        eq(subjectScoresTable.subjectName, exam.subject),
        eq(subjectScoresTable.term, currentTerm),
        eq(subjectScoresTable.academicSession, currentAcademicSession),
      ))
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