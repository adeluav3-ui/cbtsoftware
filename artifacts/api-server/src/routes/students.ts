import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  examsTable,
  resultsTable,
  resultAnswersTable,
  subjectScoresTable,
  gradingSchemesTable
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

interface SchoolParams {
  schoolCode: string;
}

interface StudentParams extends SchoolParams {
  studentId: string;
}

const router = Router({ mergeParams: true });

// List students for a school, optionally filtered by class
router.get("/", async (req: Request<SchoolParams>, res: Response) => {
  const { schoolCode } = req.params;
  const { class: studentClass } = req.query;

  try {
    const conditions: any[] = [
      eq(usersTable.schoolCode, schoolCode),
      eq(usersTable.role, "student"),
    ];

    if (studentClass && typeof studentClass === "string") {
      conditions.push(eq(usersTable.class, studentClass));
    }

    const students = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        fullName: usersTable.fullName,
        class: usersTable.class,
        schoolCode: usersTable.schoolCode,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(and(...conditions))
      .orderBy(usersTable.fullName);

    res.json(students);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Create a student
router.post("/", async (req: Request<SchoolParams>, res: Response) => {
  const { schoolCode } = req.params;
  const { username, password, fullName, class: studentClass } = req.body;

  if (!username || !password || !fullName || !studentClass) {
    return res.status(400).json({ error: "Username, password, full name and class required" });
  }

  const validClasses = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];
  if (!validClasses.includes(studentClass)) {
    return res.status(400).json({ error: "Invalid class. Must be JSS1, JSS2, JSS3, SSS1, SSS2, or SSS3" });
  }

  try {
    // Check duplicate username within school
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.username, username),
          eq(usersTable.schoolCode, schoolCode)
        )
      )
      .limit(1);

    if (existing) {
      return res.status(400).json({ error: "Username already exists in this school" });
    }

    const [student] = await db
      .insert(usersTable)
      .values({
        username,
        password,
        fullName,
        role: "student",
        schoolCode,
        class: studentClass,
      })
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        fullName: usersTable.fullName,
        class: usersTable.class,
        schoolCode: usersTable.schoolCode,
        createdAt: usersTable.createdAt,
      });

    res.status(201).json(student);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Delete a student
router.delete("/:studentId", async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;

  try {
    const id = parseInt(studentId);

    // 1. Get all result IDs for this student
    const studentResults = await db
      .select({ id: resultsTable.id })
      .from(resultsTable)
      .where(
        and(
          eq(resultsTable.studentId, id),
          eq(resultsTable.schoolCode, schoolCode)
        )
      );

    // 2. Delete result answers first
    if (studentResults.length > 0) {
      const resultIds = studentResults.map(r => r.id);
      for (const resultId of resultIds) {
        await db
          .delete(resultAnswersTable)
          .where(eq(resultAnswersTable.resultId, resultId));
      }
    }

    // 3. Delete results
    await db
      .delete(resultsTable)
      .where(
        and(
          eq(resultsTable.studentId, id),
          eq(resultsTable.schoolCode, schoolCode)
        )
      );

    // 4. Now delete the student
    const [deleted] = await db
      .delete(usersTable)
      .where(
        and(
          eq(usersTable.id, id),
          eq(usersTable.schoolCode, schoolCode),
          eq(usersTable.role, "student")
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json({ message: "Student deleted" });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});
// Get a student's full profile: all results with answer breakdown
router.get("/:studentId/detail", async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;

  try {
    const [student] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        fullName: usersTable.fullName,
        class: usersTable.class,
        schoolCode: usersTable.schoolCode,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.id, parseInt(studentId)),
          eq(usersTable.schoolCode, schoolCode),
          eq(usersTable.role, "student")
        )
      )
      .limit(1);

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Get all results for this student with exam info
    const results = await db
      .select({
        id: resultsTable.id,
        examId: resultsTable.examId,
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
          eq(resultsTable.studentId, parseInt(studentId)),
          eq(resultsTable.schoolCode, schoolCode)
        )
      )
      .orderBy(resultsTable.submittedAt);

    // For each result, get answer breakdown
    type Result = {
      id: number;
      examId: number | null;
      fullName: string | null;
      class: string | null;
      score: number | null;
      totalQuestions: number | null;
      percentage: number | null;
      submittedAt: Date | null;
      examTitle: string | null;
      subject: string | null;
    };

    const resultsWithAnswers = await Promise.all(
      results.map(async (result: Result) => {
        const answers = await db
          .select()
          .from(resultAnswersTable)
          .where(eq(resultAnswersTable.resultId, result.id))
          .orderBy(resultAnswersTable.id);
        return { ...result, answers };
      })
    );

    res.json({ ...student, results: resultsWithAnswers });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Get subject scores for a student
router.get("/:studentId/subject-scores", async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;

  try {
    // Get all unique subjects from exams taken by this student
    const studentExams = await db
      .select({
        subject: examsTable.subject,
      })
      .from(resultsTable)
      .innerJoin(examsTable, eq(resultsTable.examId, examsTable.id))
      .where(
        and(
          eq(resultsTable.studentId, parseInt(studentId)),
          eq(resultsTable.schoolCode, schoolCode)
        )
      )
      .groupBy(examsTable.subject);

    // Get existing subject scores
    const existingScores = await db
      .select()
      .from(subjectScoresTable)
      .where(
        and(
          eq(subjectScoresTable.studentId, parseInt(studentId)),
          eq(subjectScoresTable.schoolCode, schoolCode)
        )
      );

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

    // Get CBT scores for mid-term and exams
    const examResults = await db
      .select({
        examId: resultsTable.examId,
        subject: examsTable.subject,
        assessmentType: examsTable.assessmentType,
        cbtScore: resultsTable.score,
        totalQuestions: resultsTable.totalQuestions,
      })
      .from(resultsTable)
      .innerJoin(examsTable, eq(resultsTable.examId, examsTable.id))
      .where(
        and(
          eq(resultsTable.studentId, parseInt(studentId)),
          eq(resultsTable.schoolCode, schoolCode)
        )
      );

    // Build subject scores
    const subjectMap = new Map();

    for (const exam of studentExams) {
      const subject = exam.subject;
      const existing = existingScores.find(s => s.subjectName === subject);

      // Calculate CBT scores for this subject
      const midTermResult = examResults.find(r => r.subject === subject && r.assessmentType === 'mid_term');
      const examResult = examResults.find(r => r.subject === subject && r.assessmentType === 'exam');

      let midTermCbt = null;
      let examCbt = null;

      if (midTermResult && midTermResult.totalQuestions > 0) {
        const rawPercentage = (midTermResult.cbtScore / midTermResult.totalQuestions) * 100;
        midTermCbt = Math.round((rawPercentage / 100) * scheme.midTermCbt);
      }

      if (examResult && examResult.totalQuestions > 0) {
        const rawPercentage = (examResult.cbtScore / examResult.totalQuestions) * 100;
        examCbt = Math.round((rawPercentage / 100) * scheme.examCbt);
      }

      // Calculate total scores
      const midTermTotal = (existing?.midTermScore !== null && existing?.midTermScore !== undefined)
        ? (midTermCbt || 0) + (existing?.midTermScore || 0)
        : null;

      const examTotal = (existing?.examScore !== null && existing?.examScore !== undefined)
        ? (examCbt || 0) + (existing?.examScore || 0)
        : null;

      const classActivityTotal = existing?.classActivityScore !== null && existing?.classActivityScore !== undefined
        ? existing.classActivityScore
        : null;

      // Calculate overall percentage
      let totalScore = null;
      let percentage = null;
      let grade = null;

      if (midTermTotal !== null && classActivityTotal !== null && examTotal !== null) {
        totalScore = midTermTotal + classActivityTotal + examTotal;
        percentage = Math.round((totalScore / 100) * 100);

        if (percentage >= 70) grade = 'A';
        else if (percentage >= 60) grade = 'B';
        else if (percentage >= 50) grade = 'C';
        else if (percentage >= 40) grade = 'D';
        else grade = 'F';
      }

      subjectMap.set(subject, {
        subjectName: subject,
        midTermScore: existing?.midTermScore !== undefined ? existing.midTermScore : null,
        classActivityScore: existing?.classActivityScore !== undefined ? existing.classActivityScore : null,
        examScore: existing?.examScore !== undefined ? existing.examScore : null,
        midTermCbt: midTermCbt,
        examCbt: examCbt,
        totalScore: totalScore,
        percentage: percentage,
        grade: grade,
      });
    }

    const result = Array.from(subjectMap.values());
    res.json(result);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Save or update subject score for a student
router.post("/:studentId/subject-scores", async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;
  const { subjectName, component, score } = req.body;

  if (!subjectName || !component || score === undefined) {
    return res.status(400).json({ error: "subjectName, component, and score are required" });
  }

  try {
    // Get student's class
    const [student] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, parseInt(studentId)))
      .limit(1);

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Check if record exists
    const [existing] = await db
      .select()
      .from(subjectScoresTable)
      .where(
        and(
          eq(subjectScoresTable.studentId, parseInt(studentId)),
          eq(subjectScoresTable.subjectName, subjectName),
          eq(subjectScoresTable.schoolCode, schoolCode)
        )
      )
      .limit(1);

    let updated;

    if (existing) {
      // Update existing record
      const updateData: any = { updatedAt: new Date() };
      if (component === 'midterm') updateData.midTermScore = score;
      if (component === 'activity') updateData.classActivityScore = score;
      if (component === 'exam') updateData.examScore = score;

      [updated] = await db
        .update(subjectScoresTable)
        .set(updateData)
        .where(eq(subjectScoresTable.id, existing.id))
        .returning();
    } else {
      // Create new record
      const insertData: any = {
        studentId: parseInt(studentId),
        subjectName,
        className: student.class || "Unknown",
        schoolCode,
      };
      if (component === 'midterm') insertData.midTermScore = score;
      if (component === 'activity') insertData.classActivityScore = score;
      if (component === 'exam') insertData.examScore = score;

      [updated] = await db
        .insert(subjectScoresTable)
        .values(insertData)
        .returning();
    }

    res.json(updated);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Get all subject scores for a school
router.get("/subject-scores", async (req: Request<SchoolParams>, res: Response) => {
  const { schoolCode } = req.params;

  try {
    const scores = await db
      .select()
      .from(subjectScoresTable)
      .where(eq(subjectScoresTable.schoolCode, schoolCode));

    res.json(scores);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

export default router;