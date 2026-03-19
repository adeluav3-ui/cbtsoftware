import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { usersTable, examsTable, resultsTable, resultAnswersTable } from "@workspace/db/schema";
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
    const [deleted] = await db
      .delete(usersTable)
      .where(
        and(
          eq(usersTable.id, parseInt(studentId)),
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

export default router;