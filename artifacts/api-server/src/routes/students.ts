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
import { eq, and, inArray } from "drizzle-orm";

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
        profilePicture: usersTable.profilePicture,
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
router.get("/:studentId/detail", async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;

  try {
    const [student] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        password: usersTable.password, // Add password field
        fullName: usersTable.fullName,
        class: usersTable.class,
        schoolCode: usersTable.schoolCode,
        profilePicture: usersTable.profilePicture,
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
router.post("/:studentId/reset-password", async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: "New password must be at least 4 characters" });
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set({ password: newPassword })
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
      gradeAMin: 70,
      gradeBMin: 60,
      gradeCMin: 50,
      gradeDMin: 40,
      gradeFMax: 39,
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

      // Calculate total scores
      let midTermTotalScore: number | null = null;
      let examTotalScore: number | null = null;
      let classActivityTotalScore: number | null = null;

      if (existing?.midTermScore !== null && existing?.midTermScore !== undefined) {
        midTermTotalScore = (midTermCbt || 0) + (existing.midTermScore || 0);
      } else if (midTermCbt !== null) {
        midTermTotalScore = midTermCbt;
      }

      if (existing?.examScore !== null && existing?.examScore !== undefined) {
        examTotalScore = (examCbt || 0) + (existing.examScore || 0);
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

      subjectMap.set(subject, {
        subjectName: subject,
        midTermScore: midTermTotalScore,
        classActivityScore: classActivityTotalScore,
        examScore: examTotalScore,
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

// Update student profile picture
router.post("/:studentId/profile-picture", async (req: Request<StudentParams>, res: Response) => {
  const { schoolCode, studentId } = req.params;
  const { profilePictureUrl } = req.body;

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

export default router;