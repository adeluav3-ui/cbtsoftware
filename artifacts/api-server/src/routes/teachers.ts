import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { usersTable, examsTable, questionsTable, resultsTable, resultAnswersTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";

interface SchoolParams {
  schoolCode: string;
}

interface TeacherParams extends SchoolParams {
  teacherId: string;
}

const router = Router({ mergeParams: true });

// List teachers for a school
router.get("/", async (req: Request<SchoolParams>, res: Response) => {
  const { schoolCode } = req.params;

  try {
    const teachers = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        fullName: usersTable.fullName,
        schoolCode: usersTable.schoolCode,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.schoolCode, schoolCode),
          eq(usersTable.role, "teacher")
        )
      )
      .orderBy(usersTable.createdAt);

    res.json(teachers);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Create a teacher
router.post("/", async (req: Request<SchoolParams>, res: Response) => {
  const { schoolCode } = req.params;
  const { username, password, fullName } = req.body;

  if (!username || !password || !fullName) {
    return res.status(400).json({ error: "Username, password and full name required" });
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

    const [teacher] = await db
      .insert(usersTable)
      .values({
        username,
        password,
        fullName,
        role: "teacher",
        schoolCode,
      })
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        fullName: usersTable.fullName,
        schoolCode: usersTable.schoolCode,
        createdAt: usersTable.createdAt,
      });

    res.status(201).json(teacher);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Delete a teacher
router.delete("/:teacherId", async (req: Request<TeacherParams>, res: Response) => {
  const { schoolCode, teacherId } = req.params;

  try {
    const id = parseInt(teacherId);

    const deleted = await db.transaction(async (tx) => {
      const teacherExams = await tx
        .select({ id: examsTable.id })
        .from(examsTable)
        .where(and(eq(examsTable.teacherId, id), eq(examsTable.schoolCode, schoolCode)));

      if (teacherExams.length > 0) {
        const examIds = teacherExams.map(e => e.id);

        const examResults = await tx
          .select({ id: resultsTable.id })
          .from(resultsTable)
          .where(inArray(resultsTable.examId, examIds));

        if (examResults.length > 0) {
          const resultIds = examResults.map(r => r.id);
          await tx.delete(resultAnswersTable).where(inArray(resultAnswersTable.resultId, resultIds));
        }

        await tx.delete(resultsTable).where(inArray(resultsTable.examId, examIds));
        await tx.delete(questionsTable).where(inArray(questionsTable.examId, examIds));
        await tx.delete(examsTable).where(inArray(examsTable.id, examIds));
      }

      const [deletedTeacher] = await tx
        .delete(usersTable)
        .where(and(eq(usersTable.id, id), eq(usersTable.schoolCode, schoolCode), eq(usersTable.role, "teacher")))
        .returning();

      return deletedTeacher;
    });

    if (!deleted) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    res.json({ message: "Teacher deleted" });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Get a teacher's full profile: exams + their questions + results
router.get("/:teacherId/detail", async (req: Request<TeacherParams>, res: Response) => {
  const { schoolCode, teacherId } = req.params;

  try {
    const [teacher] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        fullName: usersTable.fullName,
        schoolCode: usersTable.schoolCode,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.id, parseInt(teacherId)),
          eq(usersTable.schoolCode, schoolCode),
          eq(usersTable.role, "teacher")
        )
      )
      .limit(1);

    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Get all exams by this teacher
    const exams = await db
      .select()
      .from(examsTable)
      .where(and(eq(examsTable.schoolCode, schoolCode), eq(examsTable.teacherId, parseInt(teacherId))))
      .orderBy(examsTable.createdAt);

    if (exams.length === 0) {
      res.json({ ...teacher, exams: [] });
      return;
    }

    const examIds = exams.map(e => e.id);

    // Batch fetch all questions and results in 2 queries instead of 2N
    const [allQuestions, allResults] = await Promise.all([
      db.select().from(questionsTable).where(inArray(questionsTable.examId, examIds)).orderBy(questionsTable.id),
      db.select().from(resultsTable)
        .where(and(inArray(resultsTable.examId, examIds), eq(resultsTable.schoolCode, schoolCode)))
        .orderBy(resultsTable.submittedAt),
    ]);

    const questionsByExam = new Map<number, typeof allQuestions>();
    for (const q of allQuestions) {
      if (!questionsByExam.has(q.examId)) questionsByExam.set(q.examId, []);
      questionsByExam.get(q.examId)!.push(q);
    }

    const resultsByExam = new Map<number, typeof allResults>();
    for (const r of allResults) {
      if (r.examId === null) continue;
      if (!resultsByExam.has(r.examId)) resultsByExam.set(r.examId, []);
      resultsByExam.get(r.examId)!.push(r);
    }

    const examsWithDetails = exams.map(exam => ({
      ...exam,
      questions: questionsByExam.get(exam.id) ?? [],
      results: resultsByExam.get(exam.id) ?? [],
    }));

    res.json({ ...teacher, exams: examsWithDetails });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Update teacher profile picture
router.post("/profile-picture", async (req: Request, res: Response) => {
  // Get user from session (custom auth)
  const session = (req as any).session;
  const userId = session?.userId;

  const { profilePictureUrl } = req.body;

  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!profilePictureUrl) {
    return res.status(400).json({ error: "Profile picture URL required" });
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set({ profilePicture: profilePictureUrl })
      .where(eq(usersTable.id, userId))
      .returning({
        id: usersTable.id,
        fullName: usersTable.fullName,
        profilePicture: usersTable.profilePicture,
      });

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
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