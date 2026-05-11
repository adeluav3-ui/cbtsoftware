import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { schoolsTable, usersTable, examsTable, questionsTable, resultsTable, resultAnswersTable, gradingSchemesTable, subjectScoresTable, subjectsTable } from "@workspace/db/schema";
import { eq, and, desc, count, inArray } from "drizzle-orm";
import { requireSuperAdmin, requireSchoolAdmin, requireSchoolStaff } from "../middlewares/auth.js";

interface SchoolParams {
  schoolCode: string;
}

const router = Router();

// Create a new school with admin account
router.post("/create", requireSuperAdmin, async (req: Request, res: Response) => {
  const { code, name, adminUsername, adminPassword } = req.body;

  if (!code || !name || !adminUsername || !adminPassword) {
    return res.status(400).json({ error: "School code, name, admin username and password are all required" });
  }

  const upperCode = code.toUpperCase();

  try {
    // Check for duplicates before entering the transaction
    const [existing] = await db
      .select()
      .from(schoolsTable)
      .where(eq(schoolsTable.code, upperCode))
      .limit(1);

    if (existing) {
      return res.status(400).json({ error: "A school with this code already exists" });
    }

    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.username, adminUsername), eq(usersTable.schoolCode, upperCode)))
      .limit(1);

    if (existingUser) {
      return res.status(400).json({ error: "Admin username already exists for this school" });
    }

    // Hash before transaction to keep the transaction short
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);

    // Wrap school + admin creation in a transaction so partial failures roll back
    const school = await db.transaction(async (tx) => {
      const [newSchool] = await tx
        .insert(schoolsTable)
        .values({ code: upperCode, name })
        .returning();

      await tx.insert(usersTable).values({
        username: adminUsername,
        password: hashedAdminPassword,
        role: "school_admin",
        fullName: `${name} Admin`,
        schoolCode: upperCode,
      });

      return newSchool;
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
router.get("/", requireSuperAdmin, async (_req: Request, res: Response) => {
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
router.post("/", requireSuperAdmin, async (req: Request, res: Response) => {
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

// Get school's retake passcode (for school admin)
router.get("/:schoolCode/retake-passcode", requireSchoolAdmin, async (req: Request, res: Response) => {
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
router.post("/:schoolCode/retake-passcode", requireSchoolAdmin, async (req: Request, res: Response) => {
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
router.post("/:schoolCode/exams/:examId/retake", requireSchoolAdmin, async (req: Request, res: Response) => {
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
          eq(usersTable.schoolCode, schoolCode),
          eq(usersTable.role, "school_admin")
        )
      )
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isHashed = user.password.startsWith("$2");
    let passwordMatch: boolean;
    if (isHashed) {
      passwordMatch = await bcrypt.compare(password, user.password);
    } else {
      passwordMatch = password === user.password;
      if (passwordMatch) {
        const hashed = await bcrypt.hash(password, 10);
        await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, user.id));
      }
    }

    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const [school] = await db
      .select()
      .from(schoolsTable)
      .where(eq(schoolsTable.code, schoolCode))
      .limit(1);

    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.schoolCode = user.schoolCode;

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

// Get all subject scores for a school
router.get("/subject-scores", requireSchoolAdmin, async (req: Request, res: Response) => {
  const schoolCode = String(req.params.schoolCode || "");

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
router.get("/:schoolCode/subjects", requireSchoolStaff, async (req: Request, res: Response) => {
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
router.post("/:schoolCode/subjects", requireSchoolAdmin, async (req: Request, res: Response) => {
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
router.delete("/:schoolCode/subjects/:subjectId", requireSchoolAdmin, async (req: Request, res: Response) => {
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
router.get("/:schoolCode/grading-scheme", requireSchoolStaff, async (req: Request, res: Response) => {
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
router.post("/:schoolCode/grading-scheme", requireSchoolAdmin, async (req: Request, res: Response) => {
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

// Update school logo
router.post("/:schoolCode/logo", requireSchoolAdmin, async (req: Request, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = String(schoolCode);
  const { logoUrl } = req.body;

  if (!logoUrl) {
    return res.status(400).json({ error: "Logo URL required" });
  }

  try {
    const [updated] = await db
      .update(schoolsTable)
      .set({ logoUrl })
      .where(eq(schoolsTable.code, schoolCodeStr))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "School not found" });
    }

    res.json(updated);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Update teacher commentary for a student's subject
router.post("/:schoolCode/students/:studentId/subject-comment", requireSchoolStaff, async (req: Request, res: Response) => {
  const { schoolCode, studentId } = req.params;
  const schoolCodeStr = String(schoolCode);
  const studentIdNum = Number(String(studentId)); // Convert safely
  const { subjectName, comment } = req.body;

  if (!subjectName) {
    return res.status(400).json({ error: "Subject name required" });
  }

  try {
    const [existing] = await db
      .select()
      .from(subjectScoresTable)
      .where(
        and(
          eq(subjectScoresTable.studentId, studentIdNum),
          eq(subjectScoresTable.subjectName, subjectName),
          eq(subjectScoresTable.schoolCode, schoolCodeStr)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Subject record not found" });
    }

    const [updated] = await db
      .update(subjectScoresTable)
      .set({ teacherComment: comment || null, updatedAt: new Date() })
      .where(eq(subjectScoresTable.id, existing.id))
      .returning();

    res.json(updated);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Get school info
// Get school info (already exists, but verify it includes term and session)
router.get("/:schoolCode", async (req: Request, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = String(schoolCode);

  try {
    const [school] = await db
      .select({
        name: schoolsTable.name,
        logoUrl: schoolsTable.logoUrl,
        code: schoolsTable.code,
        currentTerm: schoolsTable.currentTerm,
        currentAcademicSession: schoolsTable.currentAcademicSession,
        availableTerms: schoolsTable.availableTerms,
      })
      .from(schoolsTable)
      .where(eq(schoolsTable.code, schoolCodeStr))
      .limit(1);

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

// Update school term and academic session
router.post("/:schoolCode/update-term", requireSchoolAdmin, async (req: Request, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = String(schoolCode);
  const { term } = req.body;

  if (!term) {
    return res.status(400).json({ error: "Term is required" });
  }

  try {
    const [updated] = await db
      .update(schoolsTable)
      .set({ currentTerm: term })
      .where(eq(schoolsTable.code, schoolCodeStr))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "School not found" });
    }

    res.json({ success: true, currentTerm: updated.currentTerm });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Update academic session
router.post("/:schoolCode/update-academic-session", requireSchoolAdmin, async (req: Request, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = String(schoolCode);
  const { academicSession } = req.body;

  if (!academicSession) {
    return res.status(400).json({ error: "Academic session is required" });
  }

  try {
    const [updated] = await db
      .update(schoolsTable)
      .set({ currentAcademicSession: academicSession })
      .where(eq(schoolsTable.code, schoolCodeStr))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "School not found" });
    }

    res.json({ success: true, currentAcademicSession: updated.currentAcademicSession });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Start new session: advance academic session and promote all students one class
router.post("/:schoolCode/new-session", requireSchoolAdmin, async (req: Request, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = String(schoolCode);
  const classOrder = ["Pry 1", "Pry 2", "Pry 3", "Pry 4", "Pry 5", "JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

  try {
    // Get current session to advance it
    const [school] = await db
      .select()
      .from(schoolsTable)
      .where(eq(schoolsTable.code, schoolCodeStr))
      .limit(1);

    // Advance academic session (e.g., 2025/2026 -> 2026/2027)
    let newSession = "2026/2027";
    if (school?.currentAcademicSession) {
      const [startYear] = school.currentAcademicSession.split('/');
      const nextYear = parseInt(startYear) + 1;
      newSession = `${nextYear}/${nextYear + 1}`;
    }

    // Reset to First Term for new session
    await db
      .update(schoolsTable)
      .set({
        currentAcademicSession: newSession,
        currentTerm: "First Term"
      })
      .where(eq(schoolsTable.code, schoolCodeStr));

    // Get all students in this school
    const students = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.schoolCode, schoolCodeStr),
          eq(usersTable.role, "student")
        )
      );

    let promoted = 0;
    let archived = 0;

    for (const student of students) {
      const currentClassIndex = classOrder.indexOf(student.class ?? "");
      if (currentClassIndex === -1) continue;

      if (currentClassIndex === classOrder.length - 1) {
        await db.delete(usersTable).where(eq(usersTable.id, student.id));
        archived++;
      } else {
        const nextClass = classOrder[currentClassIndex + 1];
        await db
          .update(usersTable)
          .set({ class: nextClass })
          .where(eq(usersTable.id, student.id));
        promoted++;
      }
    }

    res.json({
      message: `New session started. ${promoted} students promoted, ${archived} students graduated and archived. New session: ${newSession}`,
      academicSession: newSession,
    });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Get school overview stats (super admin)
router.get("/:schoolCode/overview", requireSuperAdmin, async (req: Request, res: Response) => {
  const schoolCodeStr = String(req.params.schoolCode);

  try {
    const [[teacherCount], [studentCount], [examCount], admin] = await Promise.all([
      db.select({ count: count() }).from(usersTable)
        .where(and(eq(usersTable.schoolCode, schoolCodeStr), eq(usersTable.role, "teacher"))),
      db.select({ count: count() }).from(usersTable)
        .where(and(eq(usersTable.schoolCode, schoolCodeStr), eq(usersTable.role, "student"))),
      db.select({ count: count() }).from(examsTable)
        .where(eq(examsTable.schoolCode, schoolCodeStr)),
      db.select({ username: usersTable.username, fullName: usersTable.fullName })
        .from(usersTable)
        .where(and(eq(usersTable.schoolCode, schoolCodeStr), eq(usersTable.role, "school_admin")))
        .limit(1),
    ]);

    res.json({
      teachers: teacherCount?.count ?? 0,
      students: studentCount?.count ?? 0,
      exams: examCount?.count ?? 0,
      admin: admin[0] ?? null,
    });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Reset school admin password (super admin)
router.post("/:schoolCode/reset-admin-password", requireSuperAdmin, async (req: Request, res: Response) => {
  const schoolCodeStr = String(req.params.schoolCode);
  const { newPassword } = req.body;

  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters" });
  }

  try {
    const hashed = await bcrypt.hash(String(newPassword), 10);
    const [updated] = await db
      .update(usersTable)
      .set({ password: hashed })
      .where(and(eq(usersTable.schoolCode, schoolCodeStr), eq(usersTable.role, "school_admin")))
      .returning({ id: usersTable.id, username: usersTable.username });

    if (!updated) {
      return res.status(404).json({ error: "School admin not found" });
    }

    res.json({ message: "Admin password reset successfully", username: updated.username });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Delete a school and all its data (super admin)
router.delete("/:schoolCode", requireSuperAdmin, async (req: Request, res: Response) => {
  const schoolCodeStr = String(req.params.schoolCode);

  try {
    await db.transaction(async (tx) => {
      const exams = await tx
        .select({ id: examsTable.id })
        .from(examsTable)
        .where(eq(examsTable.schoolCode, schoolCodeStr));

      if (exams.length > 0) {
        const examIds = exams.map(e => e.id);
        const results = await tx
          .select({ id: resultsTable.id })
          .from(resultsTable)
          .where(inArray(resultsTable.examId, examIds));

        if (results.length > 0) {
          const resultIds = results.map(r => r.id);
          await tx.delete(resultAnswersTable).where(inArray(resultAnswersTable.resultId, resultIds));
        }
        await tx.delete(resultsTable).where(eq(resultsTable.schoolCode, schoolCodeStr));
        await tx.delete(questionsTable).where(inArray(questionsTable.examId, examIds));
        await tx.delete(examsTable).where(eq(examsTable.schoolCode, schoolCodeStr));
      }

      await tx.delete(subjectScoresTable).where(eq(subjectScoresTable.schoolCode, schoolCodeStr));
      await tx.delete(subjectsTable).where(eq(subjectsTable.schoolCode, schoolCodeStr));
      await tx.delete(gradingSchemesTable).where(eq(gradingSchemesTable.schoolCode, schoolCodeStr));
      await tx.delete(usersTable).where(eq(usersTable.schoolCode, schoolCodeStr));

      const [deleted] = await tx
        .delete(schoolsTable)
        .where(eq(schoolsTable.code, schoolCodeStr))
        .returning();

      if (!deleted) throw new Error("School not found");
    });

    res.json({ message: "School deleted successfully" });
    return;
  } catch (err) {
    if (err instanceof Error && err.message === "School not found") {
      res.status(404).json({ error: "School not found" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

export default router;