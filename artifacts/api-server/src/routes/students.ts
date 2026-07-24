import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { requireAuth, requireSchoolAdmin, requireSchoolStaff } from "../middlewares/auth.js";
import { db } from "@workspace/db";
import {
  usersTable,
  examsTable,
  resultsTable,
  resultAnswersTable,
  subjectScoresTable,
  gradingSchemesTable,
  schoolsTable,
  studentTraitsTable,
  studentAttendanceTable,
} from "@workspace/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

interface SchoolParams {
  schoolCode: string;
}

interface StudentParams extends SchoolParams {
  studentId: string;
}

const router = Router({ mergeParams: true });

// List students for a school, optionally filtered by class
router.get("/", requireSchoolStaff, async (req: Request<SchoolParams>, res: Response) => {
  const { schoolCode } = req.params;
  const { class: studentClass, page, limit } = req.query;
  const pageNum = page ? parseInt(page as string) : null;
  const limitNum = limit ? parseInt(limit as string) : null;

  try {
    const conditions: any[] = [
      eq(usersTable.schoolCode, schoolCode),
      eq(usersTable.role, "student"),
    ];

    if (studentClass && typeof studentClass === "string") {
      conditions.push(eq(usersTable.class, studentClass));
    }

    const baseQuery = db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        fullName: usersTable.fullName,
        class: usersTable.class,
        schoolCode: usersTable.schoolCode,
        profilePicture: usersTable.profilePicture,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(and(...conditions))
      .orderBy(usersTable.fullName);

    const students = (pageNum && limitNum)
      ? await baseQuery.limit(limitNum).offset((pageNum - 1) * limitNum)
      : await baseQuery;

    res.json(students);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Create a student
router.post("/", requireSchoolStaff, async (req: Request<SchoolParams>, res: Response) => {
  const { schoolCode } = req.params;
  const { username, password, fullName, class: studentClass } = req.body;

  if (!username || !password || !fullName || !studentClass) {
    return res.status(400).json({ error: "Username, password, full name and class required" });
  }

  const validClasses = ["Pre-School", "KG1", "KG2", "Nursery 1", "Nursery 2", "Pry 1", "Pry 2", "Pry 3", "Pry 4", "Pry 5", "JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3", "Entrance Exam", "Staff Interview"];
  if (!validClasses.includes(studentClass)) {
    return res.status(400).json({ error: "Invalid class" });
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

    const hashedPassword = await bcrypt.hash(password, 10);

    const [student] = await db
      .insert(usersTable)
      .values({
        username,
        password: hashedPassword,
        generatedPassword: password,
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

// Move student to a different class
router.patch("/:studentId/name", requireSchoolStaff, async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;
  const { fullName } = req.body;

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
    return res.status(400).json({ error: "Name must be at least 2 characters" });
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set({ fullName: fullName.trim() })
      .where(and(eq(usersTable.id, parseInt(studentId)), eq(usersTable.schoolCode, schoolCode), eq(usersTable.role, "student")))
      .returning({ id: usersTable.id, fullName: usersTable.fullName });

    if (!updated) return res.status(404).json({ error: "Student not found" });
    res.json(updated);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

router.patch("/:studentId/class", requireSchoolAdmin, async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;
  const { class: newClass } = req.body;

  const validClasses = ["Pre-School", "KG1", "KG2", "Nursery 1", "Nursery 2", "Pry 1", "Pry 2", "Pry 3", "Pry 4", "Pry 5", "JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3", "Entrance Exam", "Staff Interview"];
  if (!newClass || !validClasses.includes(newClass)) {
    return res.status(400).json({ error: "Valid class required" });
  }

  try {
    const id = parseInt(studentId);
    const [updated] = await db
      .update(usersTable)
      .set({ class: newClass })
      .where(and(eq(usersTable.id, id), eq(usersTable.schoolCode, schoolCode), eq(usersTable.role, "student")))
      .returning({ id: usersTable.id, fullName: usersTable.fullName, class: usersTable.class, username: usersTable.username });

    if (!updated) return res.status(404).json({ error: "Student not found" });
    res.json(updated);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Delete a student
router.delete("/:studentId", requireSchoolStaff, async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;

  try {
    const id = parseInt(studentId);

    const deleted = await db.transaction(async (tx) => {
      const studentResults = await tx
        .select({ id: resultsTable.id })
        .from(resultsTable)
        .where(and(eq(resultsTable.studentId, id), eq(resultsTable.schoolCode, schoolCode)));

      if (studentResults.length > 0) {
        const resultIds = studentResults.map(r => r.id);
        await tx.delete(resultAnswersTable).where(inArray(resultAnswersTable.resultId, resultIds));
      }

      await tx.delete(resultsTable).where(and(eq(resultsTable.studentId, id), eq(resultsTable.schoolCode, schoolCode)));
      await tx.delete(subjectScoresTable).where(and(eq(subjectScoresTable.studentId, id), eq(subjectScoresTable.schoolCode, schoolCode)));

      const [deletedStudent] = await tx
        .delete(usersTable)
        .where(and(eq(usersTable.id, id), eq(usersTable.schoolCode, schoolCode), eq(usersTable.role, "student")))
        .returning();

      return deletedStudent;
    });

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

// Get a student's full profile (include password for admin view)
router.get("/:studentId/detail", requireSchoolAdmin, async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;

  try {
    const [student] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        password: usersTable.generatedPassword,
        fullName: usersTable.fullName,
        class: usersTable.class,
        schoolCode: usersTable.schoolCode,
        profilePicture: usersTable.profilePicture,
        feesFullyPaid: usersTable.feesFullyPaid,
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

    if (results.length === 0) {
      res.json({ ...student, results: [] });
      return;
    }

    // Batch fetch all answers in one query instead of N queries
    const resultIds = results.map(r => r.id);
    const allAnswers = await db
      .select()
      .from(resultAnswersTable)
      .where(inArray(resultAnswersTable.resultId, resultIds))
      .orderBy(resultAnswersTable.id);

    const answersByResult = new Map<number, typeof allAnswers>();
    for (const a of allAnswers) {
      if (!answersByResult.has(a.resultId)) answersByResult.set(a.resultId, []);
      answersByResult.get(a.resultId)!.push(a);
    }

    const resultsWithAnswers = results.map(result => ({
      ...result,
      answers: answersByResult.get(result.id) ?? [],
    }));

    res.json({ ...student, results: resultsWithAnswers });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Reset student password
router.post("/:studentId/reset-password", requireSchoolAdmin, async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: "New password must be at least 4 characters" });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const [updated] = await db
      .update(usersTable)
      .set({ password: hashedPassword, generatedPassword: newPassword })
      .where(
        and(
          eq(usersTable.id, parseInt(studentId)),
          eq(usersTable.schoolCode, schoolCode),
          eq(usersTable.role, "student")
        )
      )
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        fullName: usersTable.fullName,
      });

    if (!updated) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json({ message: "Password reset successfully", student: updated });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Toggle fees-paid status for a student
router.patch("/:studentId/fees-status", requireSchoolAdmin, async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;
  const { feesFullyPaid } = req.body;

  if (typeof feesFullyPaid !== "boolean") {
    return res.status(400).json({ error: "feesFullyPaid must be a boolean" });
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set({ feesFullyPaid })
      .where(and(
        eq(usersTable.id, parseInt(studentId)),
        eq(usersTable.schoolCode, schoolCode),
        eq(usersTable.role, "student"),
      ))
      .returning({ id: usersTable.id, feesFullyPaid: usersTable.feesFullyPaid });

    if (!updated) return res.status(404).json({ error: "Student not found" });
    res.json(updated);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Get subject scores for a student
router.get("/:studentId/subject-scores", requireAuth, async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;

  // Students can only access their own scores
  if ((req as any).session?.role === 'student' && (req as any).session?.userId !== parseInt(studentId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    // Fetch school for current term/session
    const [school] = await db
      .select({ currentTerm: schoolsTable.currentTerm, currentAcademicSession: schoolsTable.currentAcademicSession })
      .from(schoolsTable)
      .where(eq(schoolsTable.code, schoolCode))
      .limit(1);
    const currentTerm = school?.currentTerm ?? "First Term";
    const currentAcademicSession = school?.currentAcademicSession ?? "2025/2026";

    // Fetch student's current class to scope exam results correctly
    const [studentRecord] = await db
      .select({ class: usersTable.class })
      .from(usersTable)
      .where(eq(usersTable.id, parseInt(studentId)))
      .limit(1);
    const studentClass = studentRecord?.class ?? "";

    // Get unique subjects from exams taken by this student in the current term for their current class only
    const studentExams = await db
      .select({
        subject: examsTable.subject,
      })
      .from(resultsTable)
      .innerJoin(examsTable, eq(resultsTable.examId, examsTable.id))
      .where(
        and(
          eq(resultsTable.studentId, parseInt(studentId)),
          eq(resultsTable.schoolCode, schoolCode),
          eq(examsTable.term, currentTerm),
          eq(examsTable.class, studentClass),
        )
      )
      .groupBy(examsTable.subject);

    // Get existing subject scores for the current term/session only
    const existingScores = await db
      .select()
      .from(subjectScoresTable)
      .where(
        and(
          eq(subjectScoresTable.studentId, parseInt(studentId)),
          eq(subjectScoresTable.schoolCode, schoolCode),
          eq(subjectScoresTable.term, currentTerm),
          eq(subjectScoresTable.academicSession, currentAcademicSession),
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
      gradeAMin: 70,
      gradeBMin: 60,
      gradeCMin: 50,
      gradeDMin: 40,
      gradeFMax: 39,
    };

    const scheme = gradingScheme || defaultScheme;

    // Get CBT scores for current term and class only
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
          eq(resultsTable.schoolCode, schoolCode),
          eq(examsTable.term, currentTerm),
          eq(examsTable.class, studentClass),
        )
      );

    // Deduplicate exam subjects case-insensitively (handles "English Language" vs "english language")
    const canonicalName = new Map<string, string>(); // lowercase -> display name
    for (const exam of studentExams) {
      const lower = exam.subject.trim().toLowerCase();
      if (!canonicalName.has(lower)) canonicalName.set(lower, exam.subject.trim());
    }
    // Prefer the name stored in subject_scores as the canonical display name
    for (const score of existingScores) {
      const lower = score.subjectName.trim().toLowerCase();
      canonicalName.set(lower, score.subjectName.trim());
    }

    // Build subject scores — keyed by lowercase name to prevent duplicates
    const subjectMap = new Map<string, any>();

    for (const [lowerSubject, displaySubject] of canonicalName) {
      const subject = displaySubject;
      const existing = existingScores.find(s => s.subjectName.trim().toLowerCase() === lowerSubject);

      // Calculate CBT scores for this subject
      const midTermResult = examResults.find(r => r.subject.trim().toLowerCase() === lowerSubject && r.assessmentType === 'mid_term');
      const examResult = examResults.find(r => r.subject.trim().toLowerCase() === lowerSubject && r.assessmentType === 'exam');

      let midTermCbt: number | null = null;
      let examCbt: number | null = null;

      if (midTermResult && midTermResult.totalQuestions > 0) {
        const rawPercentage = (midTermResult.cbtScore / midTermResult.totalQuestions) * 100;
        midTermCbt = Math.round((rawPercentage / 100) * scheme.midTermCbt);
      }

      if (examResult && examResult.totalQuestions > 0) {
        const rawPercentage = (examResult.cbtScore / examResult.totalQuestions) * 100;
        examCbt = Math.round((rawPercentage / 100) * scheme.examCbt);
      }

      // Calculate total scores.
      // midTermScore / examScore in subject_scores already hold the final combined value (cbt + theory).
      // Only fall back to midTermCbt/examCbt if no subject_scores record exists yet.
      let midTermTotalScore: number | null = null;
      let examTotalScore: number | null = null;
      let classActivityTotalScore: number | null = null;

      if (existing?.midTermScore !== null && existing?.midTermScore !== undefined) {
        midTermTotalScore = existing.midTermScore;
      } else if (midTermCbt !== null) {
        midTermTotalScore = midTermCbt;
      }

      if (existing?.examScore !== null && existing?.examScore !== undefined) {
        examTotalScore = existing.examScore;
      } else if (examCbt !== null) {
        examTotalScore = examCbt;
      }

      if (existing?.classActivityScore !== null && existing?.classActivityScore !== undefined) {
        classActivityTotalScore = existing.classActivityScore;
      }

      // Calculate overall percentage and grade
      let totalScore: number | null = null;
      let percentage: number | null = null;
      let grade: string | null = null;

      // Check if all three components have scores (not null)
      const hasMidTerm = midTermTotalScore !== null;
      const hasClassActivity = classActivityTotalScore !== null;
      const hasExam = examTotalScore !== null;

      if (hasMidTerm && hasClassActivity && hasExam) {
        totalScore = (midTermTotalScore || 0) + (classActivityTotalScore || 0) + (examTotalScore || 0);
        percentage = totalScore; // Since total is out of 100

        // Use dynamic grade ranges from grading scheme
        if (percentage >= scheme.gradeAMin) {
          grade = 'A';
        } else if (percentage >= scheme.gradeBMin) {
          grade = 'B';
        } else if (percentage >= scheme.gradeCMin) {
          grade = 'C';
        } else if (percentage >= scheme.gradeDMin) {
          grade = 'D';
        } else {
          grade = 'F';
        }
      }

      subjectMap.set(lowerSubject, {
        subjectName: displaySubject,
        midTermScore: midTermTotalScore,
        classActivityScore: classActivityTotalScore,
        examScore: examTotalScore,
        totalScore: totalScore,
        percentage: percentage,
        grade: grade,
        teacherComment: existing?.teacherComment ?? null,
      });
    }

    // Also include subjects that have manually-entered scores but no CBT exam
    // (covers KG/Nursery/Primary students who don't do CBT)
    for (const score of existingScores) {
      if (!subjectMap.has(score.subjectName.trim().toLowerCase())) {
        const hasMidTerm = score.midTermScore !== null && score.midTermScore !== undefined;
        const hasClassActivity = score.classActivityScore !== null && score.classActivityScore !== undefined;
        const hasExam = score.examScore !== null && score.examScore !== undefined;

        let totalScore: number | null = null;
        let percentage: number | null = null;
        let grade: string | null = null;

        if (hasMidTerm && hasClassActivity && hasExam) {
          totalScore = (score.midTermScore || 0) + (score.classActivityScore || 0) + (score.examScore || 0);
          percentage = totalScore;

          if (percentage >= scheme.gradeAMin) grade = 'A';
          else if (percentage >= scheme.gradeBMin) grade = 'B';
          else if (percentage >= scheme.gradeCMin) grade = 'C';
          else if (percentage >= scheme.gradeDMin) grade = 'D';
          else grade = 'F';
        }

        subjectMap.set(score.subjectName.trim().toLowerCase(), {
          subjectName: score.subjectName,
          midTermScore: hasMidTerm ? score.midTermScore : null,
          classActivityScore: hasClassActivity ? score.classActivityScore : null,
          examScore: hasExam ? score.examScore : null,
          totalScore,
          percentage,
          grade,
          teacherComment: score.teacherComment ?? null,
        });
      }
    }

    res.json(Array.from(subjectMap.values()));
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Save or update subject score for a student
router.post("/:studentId/subject-scores", requireSchoolStaff, async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;
  const { subjectName, component, score } = req.body;

  if (!subjectName || !component || score === undefined) {
    return res.status(400).json({ error: "subjectName, component, and score are required" });
  }

  try {
    const [[student], [school]] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.id, parseInt(studentId))).limit(1),
      db.select({ currentTerm: schoolsTable.currentTerm, currentAcademicSession: schoolsTable.currentAcademicSession })
        .from(schoolsTable).where(eq(schoolsTable.code, schoolCode)).limit(1),
    ]);

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const currentTerm = school?.currentTerm ?? "First Term";
    const currentAcademicSession = school?.currentAcademicSession ?? "2025/2026";

    // Check if record exists for this term/session
    const [existing] = await db
      .select()
      .from(subjectScoresTable)
      .where(and(
        eq(subjectScoresTable.studentId, parseInt(studentId)),
        eq(subjectScoresTable.subjectName, subjectName),
        eq(subjectScoresTable.schoolCode, schoolCode),
        eq(subjectScoresTable.term, currentTerm),
        eq(subjectScoresTable.academicSession, currentAcademicSession),
      ))
      .limit(1);

    let updated;

    if (existing) {
      const updateData: any = { updatedAt: new Date() };
      if (component === 'midterm') updateData.midTermScore = score;
      if (component === 'activity') updateData.classActivityScore = score;
      if (component === 'exam') updateData.examScore = score;

      // Compute totalScore from merged values
      const mt = component === 'midterm' ? score : existing.midTermScore;
      const ca = component === 'activity' ? score : existing.classActivityScore;
      const ex = component === 'exam' ? score : existing.examScore;
      updateData.totalScore = (mt !== null && ca !== null && ex !== null) ? mt + ca + ex : null;

      [updated] = await db
        .update(subjectScoresTable)
        .set(updateData)
        .where(eq(subjectScoresTable.id, existing.id))
        .returning();
    } else {
      const insertData: any = {
        studentId: parseInt(studentId),
        subjectName,
        className: student.class || "Unknown",
        schoolCode,
        term: currentTerm,
        academicSession: currentAcademicSession,
      };
      if (component === 'midterm') insertData.midTermScore = score;
      if (component === 'activity') insertData.classActivityScore = score;
      if (component === 'exam') insertData.examScore = score;
      // Only one component on insert — total can't be computed yet
      insertData.totalScore = null;

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

// Initialize an empty subject entry for a student (for non-CBT students like KG/Nursery)
router.post("/:studentId/init-subject", requireSchoolStaff, async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;
  const { subjectName } = req.body;

  if (!subjectName || !subjectName.trim()) {
    return res.status(400).json({ error: "subjectName is required" });
  }

  try {
    const [[student], [school]] = await Promise.all([
      db.select().from(usersTable).where(and(eq(usersTable.id, parseInt(studentId)), eq(usersTable.schoolCode, schoolCode))).limit(1),
      db.select({ currentTerm: schoolsTable.currentTerm, currentAcademicSession: schoolsTable.currentAcademicSession })
        .from(schoolsTable).where(eq(schoolsTable.code, schoolCode)).limit(1),
    ]);

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const currentTerm = school?.currentTerm ?? "First Term";
    const currentAcademicSession = school?.currentAcademicSession ?? "2025/2026";

    const [existing] = await db
      .select()
      .from(subjectScoresTable)
      .where(and(
        eq(subjectScoresTable.studentId, parseInt(studentId)),
        eq(subjectScoresTable.subjectName, subjectName.trim()),
        eq(subjectScoresTable.schoolCode, schoolCode),
        eq(subjectScoresTable.term, currentTerm),
        eq(subjectScoresTable.academicSession, currentAcademicSession),
      ))
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: "Subject already exists for this student this term" });
    }

    const [created] = await db
      .insert(subjectScoresTable)
      .values({
        studentId: parseInt(studentId),
        subjectName: subjectName.trim(),
        className: student.class || "Unknown",
        schoolCode,
        term: currentTerm,
        academicSession: currentAcademicSession,
      })
      .returning();

    res.status(201).json(created);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Get all subject scores for a school
router.get("/subject-scores", requireSchoolStaff, async (req: Request<SchoolParams>, res: Response) => {
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

// Bulk fetch subject scores for all students in a class (for the bulk result entry modal)
router.get("/class-subject-scores", requireSchoolStaff, async (req: Request<SchoolParams>, res: Response) => {
  const { schoolCode } = req.params;
  const { class: studentClass, subject } = req.query as { class?: string; subject?: string };

  if (!studentClass || !subject) {
    return res.status(400).json({ error: "class and subject query params are required" });
  }

  try {
    const [school] = await db
      .select({ currentTerm: schoolsTable.currentTerm, currentAcademicSession: schoolsTable.currentAcademicSession })
      .from(schoolsTable)
      .where(eq(schoolsTable.code, schoolCode))
      .limit(1);

    const currentTerm = school?.currentTerm ?? "First Term";
    const currentAcademicSession = school?.currentAcademicSession ?? "2025/2026";

    // Get student IDs in the given class
    const classStudents = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.schoolCode, schoolCode),
          eq(usersTable.class, studentClass),
          eq(usersTable.role, "student")
        )
      );

    if (classStudents.length === 0) {
      return res.json([]);
    }

    const studentIds = classStudents.map(s => s.id);

    const subjectLower = subject.toLowerCase();

    // 1. Stored manual/CBT-upserted scores — case-insensitive subject name match
    const storedScores = await db
      .select({
        studentId: subjectScoresTable.studentId,
        midTermScore: subjectScoresTable.midTermScore,
        classActivityScore: subjectScoresTable.classActivityScore,
        examScore: subjectScoresTable.examScore,
      })
      .from(subjectScoresTable)
      .where(
        and(
          eq(subjectScoresTable.schoolCode, schoolCode),
          sql`lower(${subjectScoresTable.subjectName}) = ${subjectLower}`,
          eq(subjectScoresTable.term, currentTerm),
          eq(subjectScoresTable.academicSession, currentAcademicSession),
          inArray(subjectScoresTable.studentId, studentIds)
        )
      );

    // 2. CBT mid-term results (fallback for students with no stored entry)
    const midTermCbtResults = await db
      .select({
        studentId: resultsTable.studentId,
        score: resultsTable.score,
        totalQuestions: resultsTable.totalQuestions,
      })
      .from(resultsTable)
      .innerJoin(examsTable, eq(resultsTable.examId, examsTable.id))
      .where(
        and(
          eq(examsTable.schoolCode, schoolCode),
          sql`lower(${examsTable.subject}) = ${subjectLower}`,
          eq(examsTable.assessmentType, 'mid_term'),
          inArray(resultsTable.studentId, studentIds)
        )
      );

    // 3. CBT exam results (fallback for students with no stored entry)
    const examCbtResults = await db
      .select({
        studentId: resultsTable.studentId,
        score: resultsTable.score,
        totalQuestions: resultsTable.totalQuestions,
      })
      .from(resultsTable)
      .innerJoin(examsTable, eq(resultsTable.examId, examsTable.id))
      .where(
        and(
          eq(examsTable.schoolCode, schoolCode),
          sql`lower(${examsTable.subject}) = ${subjectLower}`,
          eq(examsTable.assessmentType, 'exam'),
          inArray(resultsTable.studentId, studentIds)
        )
      );

    // 4. Grading scheme for CBT score scaling
    const [gradingScheme] = await db
      .select()
      .from(gradingSchemesTable)
      .where(eq(gradingSchemesTable.schoolCode, schoolCode))
      .limit(1);
    const midTermCbtMax = gradingScheme?.midTermCbt ?? 10;
    const examCbtMax = gradingScheme?.examCbt ?? 30;

    // 5. Merge: stored scores take precedence; CBT results fill in missing components
    const storedMap = new Map(storedScores.map(s => [s.studentId, s]));

    const merged = studentIds.map(studentId => {
      const stored = storedMap.get(studentId);
      const midTermCbt = midTermCbtResults.find(r => r.studentId === studentId);
      const examCbt = examCbtResults.find(r => r.studentId === studentId);

      let midTermScore = stored?.midTermScore ?? null;
      if (midTermScore === null && midTermCbt && midTermCbt.totalQuestions > 0) {
        midTermScore = Math.round((midTermCbt.score / midTermCbt.totalQuestions) * midTermCbtMax);
      }

      let examScore = stored?.examScore ?? null;
      if (examScore === null && examCbt && examCbt.totalQuestions > 0) {
        examScore = Math.round((examCbt.score / examCbt.totalQuestions) * examCbtMax);
      }

      return {
        studentId,
        midTermScore,
        classActivityScore: stored?.classActivityScore ?? null,
        examScore,
      };
    }).filter(r => r.midTermScore !== null || r.classActivityScore !== null || r.examScore !== null);

    res.json(merged);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Get all students with login credentials (school admin only)
router.get("/credentials", requireSchoolAdmin, async (req: Request<SchoolParams>, res: Response) => {
  const { schoolCode } = req.params;

  try {
    const students = await db
      .select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        username: usersTable.username,
        class: usersTable.class,
        generatedPassword: usersTable.generatedPassword,
      })
      .from(usersTable)
      .where(and(
        eq(usersTable.schoolCode, schoolCode),
        eq(usersTable.role, "student")
      ))
      .orderBy(usersTable.class, usersTable.fullName);

    res.json(students);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Update student profile picture
router.post("/:studentId/profile-picture", requireAuth, async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;
  const { profilePictureUrl } = req.body;

  // Students can only update their own profile picture
  if (req.session.role === "student" && req.session.userId !== parseInt(studentId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!profilePictureUrl) {
    return res.status(400).json({ error: "Profile picture URL required" });
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set({ profilePicture: profilePictureUrl })
      .where(
        and(
          eq(usersTable.id, parseInt(studentId)),
          eq(usersTable.schoolCode, schoolCode),
          eq(usersTable.role, "student")
        )
      )
      .returning({
        id: usersTable.id,
        fullName: usersTable.fullName,
        profilePicture: usersTable.profilePicture,
      });

    if (!updated) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json(updated);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Get position-in-class for a student (separate from subject-scores to avoid breaking existing callers)
router.get("/:studentId/class-position", requireAuth, async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;
  if ((req as any).session?.role === 'student' && (req as any).session?.userId !== parseInt(studentId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const [school] = await db
      .select({ currentTerm: schoolsTable.currentTerm, currentAcademicSession: schoolsTable.currentAcademicSession })
      .from(schoolsTable).where(eq(schoolsTable.code, schoolCode)).limit(1);
    const currentTerm = school?.currentTerm ?? "First Term";
    const currentAcademicSession = school?.currentAcademicSession ?? "2025/2026";

    const [thisStudent] = await db
      .select({ class: usersTable.class })
      .from(usersTable).where(eq(usersTable.id, parseInt(studentId))).limit(1);

    if (!thisStudent?.class) {
      return res.json({ positionInClass: null, totalInClass: null });
    }

    const classmates = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(
        eq(usersTable.schoolCode, schoolCode),
        eq(usersTable.role, "student"),
        eq(usersTable.class, thisStudent.class),
      ));

    const classmateIds = classmates.map(c => c.id);
    const totalInClass = classmateIds.length;

    if (classmateIds.length <= 1) {
      return res.json({ positionInClass: 1, totalInClass });
    }

    const classmateScores = await db
      .select({ studentId: subjectScoresTable.studentId, totalScore: subjectScoresTable.totalScore })
      .from(subjectScoresTable)
      .where(and(
        eq(subjectScoresTable.schoolCode, schoolCode),
        inArray(subjectScoresTable.studentId, classmateIds),
        eq(subjectScoresTable.term, currentTerm),
        eq(subjectScoresTable.academicSession, currentAcademicSession),
      ));

    const accumulator = new Map<number, { total: number; count: number }>();
    for (const s of classmateScores) {
      if (s.totalScore !== null) {
        const curr = accumulator.get(s.studentId) ?? { total: 0, count: 0 };
        accumulator.set(s.studentId, { total: curr.total + s.totalScore, count: curr.count + 1 });
      }
    }

    // Rank by average percentage so students with fewer scored subjects are not
    // penalised by a lower raw grandTotal vs students with more subjects scored.
    const averages = new Map<number, number>();
    for (const [id, { total, count }] of accumulator) {
      averages.set(id, count > 0 ? total / count : 0);
    }

    const myId = parseInt(studentId);
    const myAvg = averages.get(myId) ?? 0;
    const sorted = [...averages.entries()].sort((a, b) => b[1] - a[1]);
    let positionInClass: number | null = null;
    let pos = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i][1] !== sorted[i - 1][1]) pos = i + 1;
      if (sorted[i][0] === myId) { positionInClass = pos; break; }
    }

    res.json({ positionInClass, totalInClass });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// ── Traits (affective / psychomotor) ─────────────────────────────────────────

// Get traits for a student for the current term/session
router.get("/:studentId/traits", requireAuth, async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;
  if ((req as any).session?.role === 'student' && (req as any).session?.userId !== parseInt(studentId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const [school] = await db
      .select({ currentTerm: schoolsTable.currentTerm, currentAcademicSession: schoolsTable.currentAcademicSession })
      .from(schoolsTable).where(eq(schoolsTable.code, schoolCode)).limit(1);
    const term = school?.currentTerm ?? "First Term";
    const session = school?.currentAcademicSession ?? "2025/2026";

    const traits = await db
      .select()
      .from(studentTraitsTable)
      .where(and(
        eq(studentTraitsTable.studentId, parseInt(studentId)),
        eq(studentTraitsTable.schoolCode, schoolCode),
        eq(studentTraitsTable.term, term),
        eq(studentTraitsTable.academicSession, session),
      ));
    res.json(traits);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Save/update traits for a student (bulk upsert)
router.post("/:studentId/traits", requireSchoolStaff, async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;
  const { traits } = req.body; // Array of { traitCategory, traitName, rating }

  if (!Array.isArray(traits) || traits.length === 0) {
    return res.status(400).json({ error: "traits array is required" });
  }

  try {
    const [[school], [student]] = await Promise.all([
      db.select({ currentTerm: schoolsTable.currentTerm, currentAcademicSession: schoolsTable.currentAcademicSession })
        .from(schoolsTable).where(eq(schoolsTable.code, schoolCode)).limit(1),
      db.select({ class: usersTable.class }).from(usersTable).where(eq(usersTable.id, parseInt(studentId))).limit(1),
    ]);

    const term = school?.currentTerm ?? "First Term";
    const session = school?.currentAcademicSession ?? "2025/2026";
    const className = student?.class ?? "Unknown";

    const rows = traits.map((t: { traitCategory: string; traitName: string; rating: number }) => ({
      studentId: parseInt(studentId),
      schoolCode,
      term,
      academicSession: session,
      className,
      traitCategory: t.traitCategory,
      traitName: t.traitName,
      rating: t.rating,
    }));

    const result = await db
      .insert(studentTraitsTable)
      .values(rows)
      .onConflictDoUpdate({
        target: [studentTraitsTable.studentId, studentTraitsTable.traitName, studentTraitsTable.term, studentTraitsTable.academicSession],
        set: { rating: sql`excluded.rating`, updatedAt: new Date() },
      })
      .returning();

    res.json(result);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// ── Attendance ────────────────────────────────────────────────────────────────

// Get attendance for a student for the current term/session
router.get("/:studentId/attendance", requireAuth, async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;
  if ((req as any).session?.role === 'student' && (req as any).session?.userId !== parseInt(studentId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const [school] = await db
      .select({ currentTerm: schoolsTable.currentTerm, currentAcademicSession: schoolsTable.currentAcademicSession })
      .from(schoolsTable).where(eq(schoolsTable.code, schoolCode)).limit(1);
    const term = school?.currentTerm ?? "First Term";
    const session = school?.currentAcademicSession ?? "2025/2026";

    const [attendance] = await db
      .select()
      .from(studentAttendanceTable)
      .where(and(
        eq(studentAttendanceTable.studentId, parseInt(studentId)),
        eq(studentAttendanceTable.schoolCode, schoolCode),
        eq(studentAttendanceTable.term, term),
        eq(studentAttendanceTable.academicSession, session),
      ))
      .limit(1);

    res.json(attendance ?? null);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Save/update attendance for a student
router.post("/:studentId/attendance", requireSchoolStaff, async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;
  const { timesSchoolOpened, timesPresent } = req.body;

  if (timesSchoolOpened === undefined || timesPresent === undefined) {
    return res.status(400).json({ error: "timesSchoolOpened and timesPresent are required" });
  }

  try {
    const [[school], [student]] = await Promise.all([
      db.select({ currentTerm: schoolsTable.currentTerm, currentAcademicSession: schoolsTable.currentAcademicSession })
        .from(schoolsTable).where(eq(schoolsTable.code, schoolCode)).limit(1),
      db.select({ class: usersTable.class }).from(usersTable).where(eq(usersTable.id, parseInt(studentId))).limit(1),
    ]);

    const term = school?.currentTerm ?? "First Term";
    const session = school?.currentAcademicSession ?? "2025/2026";
    const className = student?.class ?? "Unknown";

    const [result] = await db
      .insert(studentAttendanceTable)
      .values({
        studentId: parseInt(studentId),
        schoolCode,
        term,
        academicSession: session,
        className,
        timesSchoolOpened,
        timesPresent,
      })
      .onConflictDoUpdate({
        target: [studentAttendanceTable.studentId, studentAttendanceTable.term, studentAttendanceTable.academicSession],
        set: { timesSchoolOpened, timesPresent, updatedAt: new Date() },
      })
      .returning();

    res.json(result);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

const CLASS_ORDER = ["Pre-School", "KG1", "KG2", "Nursery 1", "Nursery 2", "Pry 1", "Pry 2", "Pry 3", "Pry 4", "Pry 5", "JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

// Manually promote a student to the next class (for students held back after new session)
router.patch("/:studentId/promote", requireSchoolAdmin, async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;
  try {
    const [student] = await db
      .select({ id: usersTable.id, class: usersTable.class })
      .from(usersTable)
      .where(and(eq(usersTable.id, parseInt(studentId)), eq(usersTable.schoolCode, schoolCode), eq(usersTable.role, "student")))
      .limit(1);

    if (!student) return res.status(404).json({ error: "Student not found" });

    const classIdx = CLASS_ORDER.indexOf(student.class ?? "");
    if (classIdx === -1) return res.status(400).json({ error: "Unknown class" });
    if (classIdx === CLASS_ORDER.length - 1) return res.status(400).json({ error: "Student is already in the final class" });

    const nextClass = CLASS_ORDER[classIdx + 1];
    const [updated] = await db
      .update(usersTable)
      .set({ class: nextClass })
      .where(eq(usersTable.id, student.id))
      .returning({ id: usersTable.id, class: usersTable.class });

    res.json(updated);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

export default router;