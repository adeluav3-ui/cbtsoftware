import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { schoolsTable, usersTable, examsTable, resultsTable, resultAnswersTable, gradingSchemesTable, subjectScoresTable, subjectsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

interface SchoolParams {
  schoolCode: string;
}

interface Session {
  userId?: number;
  role?: string;
  schoolCode?: string | null;
}

interface RequestWithSession extends Request {
  session: Session;
}

const router = Router();

// Create a new school with admin account
router.post("/create", async (req: Request, res: Response) => {
  const { code, name, adminUsername, adminPassword } = req.body;

  if (!code || !name || !adminUsername || !adminPassword) {
    return res.status(400).json({ error: "School code, name, admin username and password are all required" });
  }

  try {
    // Check if code already exists
    const [existing] = await db
      .select()
      .from(schoolsTable)
      .where(eq(schoolsTable.code, code.toUpperCase()))
      .limit(1);

    if (existing) {
      return res.status(400).json({ error: "A school with this code already exists" });
    }

    // Check if admin username already exists in the system
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.username, adminUsername), eq(usersTable.schoolCode, code.toUpperCase())))
      .limit(1);

    if (existingUser) {
      return res.status(400).json({ error: "Admin username already exists for this school" });
    }

    // Create the school
    const [school] = await db
      .insert(schoolsTable)
      .values({ code: code.toUpperCase(), name })
      .returning();

    // Create the school admin
    await db.insert(usersTable).values({
      username: adminUsername,
      password: adminPassword,
      role: "school_admin",
      fullName: `${name} Admin`,
      schoolCode: code.toUpperCase(),
    });

    res.status(201).json(school);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// List all schools
router.get("/", async (_req: Request, res: Response) => {
  try {
    const schools = await db.select().from(schoolsTable).orderBy(schoolsTable.id);
    res.json(schools);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Update school name
router.post("/", async (req: Request, res: Response) => {
  const { code, name } = req.body;

  if (!code || !name) {
    return res.status(400).json({ error: "School code and name required" });
  }

  try {
    const [school] = await db
      .update(schoolsTable)
      .set({ name })
      .where(eq(schoolsTable.code, code))
      .returning();

    if (!school) {
      return res.status(404).json({ error: "School not found" });
    }

    res.json(school);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Start new session (promote students)
router.post("/:schoolCode/new-session", async (req: Request<SchoolParams>, res: Response) => {
  const { schoolCode } = req.params;
  const classOrder = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

  try {
    // Get all students in this school
    const students = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.schoolCode, schoolCode),
          eq(usersTable.role, "student")
        )
      );

    let promoted = 0;
    let archived = 0;

    for (const student of students) {
      const currentClassIndex = classOrder.indexOf(student.class ?? "");
      if (currentClassIndex === -1) continue;

      if (currentClassIndex === classOrder.length - 1) {
        // SSS3 -> archive (delete)
        await db.delete(usersTable).where(eq(usersTable.id, student.id));
        archived++;
      } else {
        // Promote to next class
        const nextClass = classOrder[currentClassIndex + 1];
        await db
          .update(usersTable)
          .set({ class: nextClass })
          .where(eq(usersTable.id, student.id));
        promoted++;
      }
    }

    res.json({
      message: `New session started. ${promoted} students promoted, ${archived} students graduated and archived.`,
    });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Get school's retake passcode (for school admin)
router.get("/:schoolCode/retake-passcode", async (req: Request, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = String(schoolCode);

  try {
    const [school] = await db
      .select({ retakePasscode: schoolsTable.retakePasscode })
      .from(schoolsTable)
      .where(eq(schoolsTable.code, schoolCodeStr))
      .limit(1);

    if (!school) {
      return res.status(404).json({ error: "School not found" });
    }

    res.json({ passcode: school.retakePasscode });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Update school's retake passcode (for school admin)
router.post("/:schoolCode/retake-passcode", async (req: Request, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = String(schoolCode);
  const { passcode } = req.body;

  if (!passcode || typeof passcode !== "string" || passcode.length !== 4 || !/^\d{4}$/.test(passcode)) {
    return res.status(400).json({ error: "Passcode must be a 4-digit number" });
  }

  try {
    const [updated] = await db
      .update(schoolsTable)
      .set({ retakePasscode: passcode })
      .where(eq(schoolsTable.code, schoolCodeStr))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "School not found" });
    }

    res.json({ success: true, passcode: updated.retakePasscode });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Submit exam retake with passcode verification
router.post("/:schoolCode/exams/:examId/retake", async (req: Request, res: Response) => {
  const { schoolCode, examId } = req.params;
  const schoolCodeStr = String(schoolCode);
  const examIdNum = Number(examId);
  const { studentId, passcode } = req.body;

  if (!studentId || !passcode) {
    return res.status(400).json({ error: "studentId and passcode are required" });
  }

  try {
    // Get school's passcode
    const [school] = await db
      .select({ retakePasscode: schoolsTable.retakePasscode })
      .from(schoolsTable)
      .where(eq(schoolsTable.code, schoolCodeStr))
      .limit(1);

    if (!school) {
      return res.status(404).json({ error: "School not found" });
    }

    // Verify passcode
    if (school.retakePasscode !== passcode) {
      return res.status(403).json({ error: "Invalid passcode" });
    }

    // Get student's previous result for this exam
    const [previousResult] = await db
      .select()
      .from(resultsTable)
      .where(
        and(
          eq(resultsTable.examId, examIdNum),
          eq(resultsTable.studentId, Number(studentId)),
          eq(resultsTable.schoolCode, schoolCodeStr)
        )
      )
      .orderBy(desc(resultsTable.submittedAt))
      .limit(1);

    if (!previousResult) {
      return res.status(404).json({ error: "No previous result found to retake" });
    }

    // Delete previous result answers first (due to foreign key)
    await db
      .delete(resultAnswersTable)
      .where(eq(resultAnswersTable.resultId, previousResult.id));

    // Delete previous result
    await db
      .delete(resultsTable)
      .where(eq(resultsTable.id, previousResult.id));

    res.json({
      success: true,
      message: "Previous result cleared. Student can now retake the exam.",
      examId: examIdNum
    });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// School admin login (also uses /auth/login, kept for compatibility)
router.post("/admin/login", async (req: Request, res: Response) => {
  const { username, password, schoolCode } = req.body;

  if (!username || !password || !schoolCode) {
    return res.status(400).json({ error: "Username, password and school code required" });
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.username, username),
          eq(usersTable.password, password),
          eq(usersTable.schoolCode, schoolCode),
          eq(usersTable.role, "school_admin")
        )
      )
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const [school] = await db
      .select()
      .from(schoolsTable)
      .where(eq(schoolsTable.code, schoolCode))
      .limit(1);

    const session = (req as RequestWithSession).session = (req as RequestWithSession).session || {};
    session.userId = user.id;
    session.role = user.role;
    session.schoolCode = user.schoolCode;

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      schoolCode: user.schoolCode,
      schoolName: school?.name ?? null,
      fullName: user.fullName,
      class: user.class,
    });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Get grading scheme for a school
router.get("/:schoolCode/grading-scheme", async (req: Request, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = String(schoolCode);

  try {
    const [scheme] = await db
      .select()
      .from(gradingSchemesTable)
      .where(eq(gradingSchemesTable.schoolCode, schoolCodeStr))
      .limit(1);

    if (!scheme) {
      // Return default scheme
      res.json({
        midTermTotal: 20,
        midTermCbt: 10,
        midTermTheory: 10,
        examTotal: 60,
        examCbt: 30,
        examTheory: 30,
        classActivityTotal: 20,
      });
      return;
    }

    res.json(scheme);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Update grading scheme for a school
router.post("/:schoolCode/grading-scheme", async (req: Request, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = String(schoolCode);
  const { midTermTotal, midTermCbt, midTermTheory, examTotal, examCbt, examTheory, classActivityTotal } = req.body;

  try {
    const [existing] = await db
      .select()
      .from(gradingSchemesTable)
      .where(eq(gradingSchemesTable.schoolCode, schoolCodeStr))
      .limit(1);

    let result;
    if (existing) {
      // Update existing
      [result] = await db
        .update(gradingSchemesTable)
        .set({
          midTermTotal,
          midTermCbt,
          midTermTheory,
          examTotal,
          examCbt,
          examTheory,
          classActivityTotal,
          updatedAt: new Date(),
        })
        .where(eq(gradingSchemesTable.schoolCode, schoolCodeStr))
        .returning();
    } else {
      // Insert new
      [result] = await db
        .insert(gradingSchemesTable)
        .values({
          schoolCode: schoolCodeStr,
          midTermTotal,
          midTermCbt,
          midTermTheory,
          examTotal,
          examCbt,
          examTheory,
          classActivityTotal,
        })
        .returning();
    }

    res.json(result);
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

// Get all subjects for a school
router.get("/:schoolCode/subjects", async (req: Request, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = String(schoolCode);
  const { level } = req.query;

  try {
    const conditions: any[] = [eq(subjectsTable.schoolCode, schoolCodeStr)];

    if (level && typeof level === "string") {
      conditions.push(eq(subjectsTable.level, level));
    }

    const subjects = await db
      .select()
      .from(subjectsTable)
      .where(and(...conditions))
      .orderBy(subjectsTable.name);

    res.json(subjects);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Add a subject
router.post("/:schoolCode/subjects", async (req: Request, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = String(schoolCode);
  const { name, level } = req.body;

  if (!name || !level || !['junior', 'senior'].includes(level)) {
    return res.status(400).json({ error: "Subject name and valid level (junior/senior) required" });
  }

  try {
    const [subject] = await db
      .insert(subjectsTable)
      .values({
        name: name.trim(),
        level,
        schoolCode: schoolCodeStr,
      })
      .returning();

    res.status(201).json(subject);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Delete a subject
router.delete("/:schoolCode/subjects/:subjectId", async (req: Request, res: Response) => {
  const { schoolCode, subjectId } = req.params;
  const schoolCodeStr = String(schoolCode);
  const subjectIdNum = Number(String(subjectId)); // Convert to number safely

  try {
    const [deleted] = await db
      .delete(subjectsTable)
      .where(
        and(
          eq(subjectsTable.id, subjectIdNum),
          eq(subjectsTable.schoolCode, schoolCodeStr)
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Subject not found" });
    }

    res.json({ message: "Subject deleted" });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Get grading scheme for a school
router.get("/:schoolCode/grading-scheme", async (req: Request, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = String(schoolCode);

  try {
    const [scheme] = await db
      .select()
      .from(gradingSchemesTable)
      .where(eq(gradingSchemesTable.schoolCode, schoolCodeStr))
      .limit(1);

    if (!scheme) {
      // Return default scheme with grade ranges
      res.json({
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
      });
      return;
    }

    res.json(scheme);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Update grading scheme for a school
router.post("/:schoolCode/grading-scheme", async (req: Request, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = String(schoolCode);
  const {
    midTermTotal, midTermCbt, midTermTheory,
    examTotal, examCbt, examTheory,
    classActivityTotal,
    gradeAMin, gradeBMin, gradeCMin, gradeDMin, gradeFMax
  } = req.body;

  try {
    const [existing] = await db
      .select()
      .from(gradingSchemesTable)
      .where(eq(gradingSchemesTable.schoolCode, schoolCodeStr))
      .limit(1);

    let result;
    if (existing) {
      // Update existing
      [result] = await db
        .update(gradingSchemesTable)
        .set({
          midTermTotal,
          midTermCbt,
          midTermTheory,
          examTotal,
          examCbt,
          examTheory,
          classActivityTotal,
          gradeAMin,
          gradeBMin,
          gradeCMin,
          gradeDMin,
          gradeFMax,
          updatedAt: new Date(),
        })
        .where(eq(gradingSchemesTable.schoolCode, schoolCodeStr))
        .returning();
    } else {
      // Insert new
      [result] = await db
        .insert(gradingSchemesTable)
        .values({
          schoolCode: schoolCodeStr,
          midTermTotal,
          midTermCbt,
          midTermTheory,
          examTotal,
          examCbt,
          examTheory,
          classActivityTotal,
          gradeAMin,
          gradeBMin,
          gradeCMin,
          gradeDMin,
          gradeFMax,
        })
        .returning();
    }

    res.json(result);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

export default router;