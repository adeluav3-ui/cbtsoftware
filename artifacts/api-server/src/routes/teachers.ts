import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { usersTable, examsTable, questionsTable, resultsTable, resultAnswersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

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

    // 1. Get all exams by this teacher
    const teacherExams = await db
      .select({ id: examsTable.id })
      .from(examsTable)
      .where(
        and(
          eq(examsTable.teacherId, id),
          eq(examsTable.schoolCode, schoolCode)
        )
      );

    if (teacherExams.length > 0) {
      const examIds = teacherExams.map(e => e.id);

      for (const examId of examIds) {
        // 2. Get all results for this exam
        const examResults = await db
          .select({ id: resultsTable.id })
          .from(resultsTable)
          .where(eq(resultsTable.examId, examId));

        // 3. Delete result answers
        for (const result of examResults) {
          await db
            .delete(resultAnswersTable)
            .where(eq(resultAnswersTable.resultId, result.id));
        }

        // 4. Delete results
        await db
          .delete(resultsTable)
          .where(eq(resultsTable.examId, examId));

        // 5. Delete questions
        await db
          .delete(questionsTable)
          .where(eq(questionsTable.examId, examId));
      }

      // 6. Delete exams
      for (const examId of examIds) {
        await db
          .delete(examsTable)
          .where(eq(examsTable.id, examId));
      }
    }

    // 7. Finally delete the teacher
    const [deleted] = await db
      .delete(usersTable)
      .where(
        and(
          eq(usersTable.id, id),
          eq(usersTable.schoolCode, schoolCode),
          eq(usersTable.role, "teacher")
        )
      )
      .returning();

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
      .where(
        and(
          eq(examsTable.schoolCode, schoolCode),
          eq(examsTable.teacherId, parseInt(teacherId))
        )
      )
      .orderBy(examsTable.createdAt);

    // For each exam, get questions and results
    type Exam = typeof examsTable.$inferSelect;
    const examsWithDetails = await Promise.all(
      exams.map(async (exam: Exam) => {
        const questions = await db
          .select()
          .from(questionsTable)
          .where(eq(questionsTable.examId, exam.id))
          .orderBy(questionsTable.id);

        const results = await db
          .select()
          .from(resultsTable)
          .where(
            and(
              eq(resultsTable.examId, exam.id),
              eq(resultsTable.schoolCode, schoolCode)
            )
          )
          .orderBy(resultsTable.submittedAt);

        return { ...exam, questions, results };
      })
    );

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