import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { schoolsTable, usersTable, examsTable, questionsTable, resultsTable, resultAnswersTable, gradingSchemesTable, subjectScoresTable, subjectsTable } from "@workspace/db/schema";
import { eq, and, desc, count, inArray } from "drizzle-orm";
import { requireAuth, requireSuperAdmin, requireSchoolAdmin, requireSchoolStaff } from "../middlewares/auth.js";

interface SchoolParams {
  schoolCode: string;
}

const router = Router();

// Create a new school with admin account
router.post("/create", requireSuperAdmin, async (req: Request, res: Response) => {
  const { code, name, adminUsername, adminPassword, maxDevices } = req.body;

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
      const licenseValidUntil = new Date();
      licenseValidUntil.setMonth(licenseValidUntil.getMonth() + 3);

      const [newSchool] = await tx
        .insert(schoolsTable)
        .values({ code: upperCode, name, licenseValidUntil, maxDevices: maxDevices ? Number(maxDevices) : null })
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
router.post("/:schoolCode/exams/:examId/retake", requireAuth, async (req: Request, res: Response) => {
  const { schoolCode, examId } = req.params;
  const schoolCodeStr = String(schoolCode);
  const examIdNum = Number(examId);
  const { studentId, passcode } = req.body;

  if (!studentId || !passcode) {
    return res.status(400).json({ error: "studentId and passcode are required" });
  }

  // Students can only retake their own exam
  if (req.session.role === "student" && req.session.userId !== Number(studentId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    // Get school (need passcode + term/session)
    const [school] = await db
      .select()
      .from(schoolsTable)
      .where(eq(schoolsTable.code, schoolCodeStr))
      .limit(1);

    if (!school) {
      return res.status(404).json({ error: "School not found" });
    }

    if (school.retakePasscode !== passcode) {
      return res.status(403).json({ error: "Invalid passcode" });
    }

    // Get exam details to know which score fields to reset
    const [exam] = await db
      .select({ subject: examsTable.subject, assessmentType: examsTable.assessmentType })
      .from(examsTable)
      .where(and(eq(examsTable.id, examIdNum), eq(examsTable.schoolCode, schoolCodeStr)))
      .limit(1);

    // Get student's previous result for this exam
    const [previousResult] = await db
      .select()
      .from(resultsTable)
      .where(and(
        eq(resultsTable.examId, examIdNum),
        eq(resultsTable.studentId, Number(studentId)),
        eq(resultsTable.schoolCode, schoolCodeStr)
      ))
      .orderBy(desc(resultsTable.submittedAt))
      .limit(1);

    if (!previousResult) {
      return res.status(404).json({ error: "No previous result found to retake" });
    }

    // Delete previous result answers and result
    await db.delete(resultAnswersTable).where(eq(resultAnswersTable.resultId, previousResult.id));
    await db.delete(resultsTable).where(eq(resultsTable.id, previousResult.id));

    // Reset the CBT portion of subject_scores so theory isn't lost but new CBT can be submitted
    if (exam) {
      const currentTerm = school.currentTerm ?? "First Term";
      const currentAcademicSession = school.currentAcademicSession ?? "2025/2026";
      const resetData: any = { updatedAt: new Date() };

      if (exam.assessmentType === 'mid_term') {
        resetData.midTermScore = null;
        resetData.midTermCbtScore = null;
      } else if (exam.assessmentType === 'exam') {
        resetData.examScore = null;
        resetData.examCbtScore = null;
      } else if (exam.assessmentType === 'class_activity') {
        resetData.classActivityScore = null;
      }

      await db
        .update(subjectScoresTable)
        .set(resetData)
        .where(and(
          eq(subjectScoresTable.studentId, Number(studentId)),
          eq(subjectScoresTable.subjectName, exam.subject),
          eq(subjectScoresTable.schoolCode, schoolCodeStr),
          eq(subjectScoresTable.term, currentTerm),
          eq(subjectScoresTable.academicSession, currentAcademicSession),
        ));
    }

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

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate(err => err ? reject(err) : resolve());
    });

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

// Get all subject scores for a school (filtered by term/session; optional class filter)
router.get("/:schoolCode/subject-scores", requireSchoolAdmin, async (req: Request, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = String(schoolCode);
  const { term, academicSession, class: className } = req.query;

  try {
    const [school] = await db
      .select({ currentTerm: schoolsTable.currentTerm, currentAcademicSession: schoolsTable.currentAcademicSession })
      .from(schoolsTable)
      .where(eq(schoolsTable.code, schoolCodeStr))
      .limit(1);

    const filterTerm = (term as string) || school?.currentTerm || "First Term";
    const filterSession = (academicSession as string) || school?.currentAcademicSession || "2025/2026";

    const conditions: any[] = [
      eq(subjectScoresTable.schoolCode, schoolCodeStr),
      eq(subjectScoresTable.term, filterTerm),
      eq(subjectScoresTable.academicSession, filterSession),
    ];

    if (className && typeof className === 'string') {
      conditions.push(eq(subjectScoresTable.className, className));
    }

    const scores = await db
      .select()
      .from(subjectScoresTable)
      .where(and(...conditions))
      .limit(5000);

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

  if (!name || !level || !['kg', 'nursery', 'primary', 'junior', 'senior'].includes(level)) {
    return res.status(400).json({ error: "Subject name and valid level (kg/nursery/primary/junior/senior) required" });
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

// Merge one subject name into another — coalesces scores, renames exams, deletes old subject
// Scoped to a specific level so JSS and SSS subjects with the same name stay independent.
router.post("/:schoolCode/subjects/merge", requireSchoolAdmin, async (req: Request, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = String(schoolCode);
  const { fromName, toName, level } = req.body as { fromName?: string; toName?: string; level?: string };

  if (!fromName?.trim() || !toName?.trim() || !level?.trim()) {
    return res.status(400).json({ error: "fromName, toName, and level are required" });
  }
  if (fromName.trim().toLowerCase() === toName.trim().toLowerCase()) {
    return res.status(400).json({ error: "fromName and toName must be different" });
  }

  const levelClassMap: Record<string, string[]> = {
    kg:      ["Pre-School", "KG1", "KG2"],
    nursery: ["Nursery 1", "Nursery 2"],
    primary: ["Pry 1", "Pry 2", "Pry 3", "Pry 4", "Pry 5"],
    junior:  ["JSS1", "JSS2", "JSS3"],
    senior:  ["SSS1", "SSS2", "SSS3"],
  };
  const levelClasses = levelClassMap[level.trim()];
  if (!levelClasses) {
    return res.status(400).json({ error: `Unknown level "${level}"` });
  }

  const from = fromName.trim();
  const to = toName.trim();

  try {
    // Get all student IDs in this level's classes
    const levelStudents = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.schoolCode, schoolCodeStr),
          eq(usersTable.role, "student"),
          inArray(usersTable.class, levelClasses)
        )
      );

    if (levelStudents.length > 0) {
      const levelStudentIds = levelStudents.map(s => s.id);

      // Fetch fromName and toName rows for these students
      const [fromRows, toRows] = await Promise.all([
        db.select().from(subjectScoresTable).where(
          and(
            eq(subjectScoresTable.schoolCode, schoolCodeStr),
            eq(subjectScoresTable.subjectName, from),
            inArray(subjectScoresTable.studentId, levelStudentIds)
          )
        ),
        db.select().from(subjectScoresTable).where(
          and(
            eq(subjectScoresTable.schoolCode, schoolCodeStr),
            eq(subjectScoresTable.subjectName, to),
            inArray(subjectScoresTable.studentId, levelStudentIds)
          )
        ),
      ]);

      // Key by (studentId|term|academicSession) for fast lookup
      const toMap = new Map(
        toRows.map(r => [`${r.studentId}|${r.term}|${r.academicSession}`, r])
      );

      const now = new Date();
      const toDelete: number[] = [];
      const toRename: number[] = [];

      for (const fromRow of fromRows) {
        const key = `${fromRow.studentId}|${fromRow.term}|${fromRow.academicSession}`;
        const toRow = toMap.get(key);

        if (toRow) {
          // Both exist — coalesce null fields from fromName into toName, then delete fromName
          await db.update(subjectScoresTable)
            .set({
              midTermScore: toRow.midTermScore ?? fromRow.midTermScore,
              midTermCbtScore: toRow.midTermCbtScore ?? fromRow.midTermCbtScore,
              classActivityScore: toRow.classActivityScore ?? fromRow.classActivityScore,
              examScore: toRow.examScore ?? fromRow.examScore,
              examCbtScore: toRow.examCbtScore ?? fromRow.examCbtScore,
              totalScore: toRow.totalScore ?? fromRow.totalScore,
              updatedAt: now,
            })
            .where(eq(subjectScoresTable.id, toRow.id));
          toDelete.push(fromRow.id);
        } else {
          // Only fromName row exists — rename it to toName
          toRename.push(fromRow.id);
        }
      }

      if (toDelete.length > 0) {
        await db.delete(subjectScoresTable).where(inArray(subjectScoresTable.id, toDelete));
      }
      if (toRename.length > 0) {
        await db.update(subjectScoresTable)
          .set({ subjectName: to, updatedAt: now })
          .where(inArray(subjectScoresTable.id, toRename));
      }

      // Step 4: Rename exams with fromName subject to toName for this level's classes
      await db.update(examsTable)
        .set({ subject: to })
        .where(
          and(
            eq(examsTable.schoolCode, schoolCodeStr),
            eq(examsTable.subject, from),
            inArray(examsTable.class, levelClasses)
          )
        );
    }

    // Step 5: Delete the fromName subject entry from subjects table for this level
    await db
      .delete(subjectsTable)
      .where(and(
        eq(subjectsTable.schoolCode, schoolCodeStr),
        eq(subjectsTable.name, from),
        eq(subjectsTable.level, level.trim()),
      ));

    res.json({ ok: true, message: `Merged "${from}" into "${to}" for ${level} level successfully` });
    return;
  } catch (err) {
    console.error("Subject merge error:", err);
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

// Save one general teacher comment for the student (applied to all subject_scores this term)
router.post("/:schoolCode/students/:studentId/general-comment", requireSchoolStaff, async (req: Request, res: Response) => {
  const { schoolCode, studentId } = req.params;
  const schoolCodeStr = String(schoolCode);
  const studentIdNum = Number(String(studentId));
  const { comment } = req.body;

  try {
    const [school] = await db
      .select({ currentTerm: schoolsTable.currentTerm, currentAcademicSession: schoolsTable.currentAcademicSession })
      .from(schoolsTable).where(eq(schoolsTable.code, schoolCodeStr)).limit(1);

    const currentTerm = school?.currentTerm ?? "First Term";
    const currentAcademicSession = school?.currentAcademicSession ?? "2025/2026";

    await db
      .update(subjectScoresTable)
      .set({ teacherComment: comment || null, updatedAt: new Date() })
      .where(and(
        eq(subjectScoresTable.studentId, studentIdNum),
        eq(subjectScoresTable.schoolCode, schoolCodeStr),
        eq(subjectScoresTable.term, currentTerm),
        eq(subjectScoresTable.academicSession, currentAcademicSession),
      ));

    res.json({ success: true });
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
        nextTermBegins: schoolsTable.nextTermBegins,
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

// Update next term begins date
router.post("/:schoolCode/next-term-begins", requireSchoolStaff, async (req: Request, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = String(schoolCode);
  const { nextTermBegins } = req.body;

  try {
    const [updated] = await db
      .update(schoolsTable)
      .set({ nextTermBegins: nextTermBegins || null })
      .where(eq(schoolsTable.code, schoolCodeStr))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "School not found" });
    }

    res.json({ success: true, nextTermBegins: updated.nextTermBegins });
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
  const classOrder = ["Pre-School", "KG1", "KG2", "Nursery 1", "Nursery 2", "Pry 1", "Pry 2", "Pry 3", "Pry 4", "Pry 5", "JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

  try {
    // Get current session to advance it
    const [school] = await db
      .select()
      .from(schoolsTable)
      .where(eq(schoolsTable.code, schoolCodeStr))
      .limit(1);

    const prevTerm = school?.currentTerm ?? "Third Term";
    const prevSession = school?.currentAcademicSession ?? "2025/2026";

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

    // Compute each student's average percentage from the previous term's subject scores
    const prevScores = await db
      .select({ studentId: subjectScoresTable.studentId, percentage: subjectScoresTable.percentage })
      .from(subjectScoresTable)
      .where(
        and(
          eq(subjectScoresTable.schoolCode, schoolCodeStr),
          eq(subjectScoresTable.term, prevTerm),
          eq(subjectScoresTable.academicSession, prevSession)
        )
      );

    const accumulator = new Map<number, { sum: number; count: number }>();
    for (const s of prevScores) {
      if (s.percentage !== null) {
        const curr = accumulator.get(s.studentId) ?? { sum: 0, count: 0 };
        accumulator.set(s.studentId, { sum: curr.sum + s.percentage, count: curr.count + 1 });
      }
    }
    const avgMap = new Map<number, number>();
    for (const [id, { sum, count }] of accumulator) {
      avgMap.set(id, count > 0 ? sum / count : 0);
    }

    let promoted = 0;
    let archived = 0;
    let retained = 0;

    const graduateIds: number[] = [];
    const promotionMap = new Map<string, number[]>(); // targetClass -> [studentIds]

    for (const student of students) {
      const currentClassIndex = classOrder.indexOf(student.class ?? "");
      if (currentClassIndex === -1) continue;

      if (currentClassIndex === classOrder.length - 1) {
        graduateIds.push(student.id);
        archived++;
      } else {
        const avg = avgMap.get(student.id);
        if (avg !== undefined && avg < 50) {
          retained++;
        } else {
          const nextClass = classOrder[currentClassIndex + 1];
          const group = promotionMap.get(nextClass) ?? [];
          group.push(student.id);
          promotionMap.set(nextClass, group);
          promoted++;
        }
      }
    }

    // Bulk delete graduates (one query regardless of count)
    if (graduateIds.length > 0) {
      await db.delete(usersTable).where(inArray(usersTable.id, graduateIds));
    }

    // Bulk promote — one UPDATE per target class (max 15 queries total)
    for (const [nextClass, ids] of promotionMap) {
      await db.update(usersTable).set({ class: nextClass }).where(inArray(usersTable.id, ids));
    }

    res.json({
      message: `New session started. ${promoted} students promoted, ${retained} students retained (avg < 50%), ${archived} students graduated and archived. New session: ${newSession}`,
      academicSession: newSession,
      promoted,
      retained,
      archived,
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

// Enable or disable a school (super admin only)
router.post("/:schoolCode/set-disabled", requireSuperAdmin, async (req: Request, res: Response) => {
  const schoolCodeStr = String(req.params.schoolCode);
  const { disabled } = req.body;

  if (typeof disabled !== "boolean") {
    return res.status(400).json({ error: "disabled must be a boolean" });
  }

  try {
    const [updated] = await db
      .update(schoolsTable)
      .set({ isDisabled: disabled })
      .where(eq(schoolsTable.code, schoolCodeStr))
      .returning({ code: schoolsTable.code, isDisabled: schoolsTable.isDisabled });

    if (!updated) {
      return res.status(404).json({ error: "School not found" });
    }

    res.json({ code: updated.code, isDisabled: updated.isDisabled });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Broadsheet: all students in a class with their subject scores, grand total, average, position
router.get("/:schoolCode/broadsheet", requireSchoolAdmin, async (req: Request, res: Response) => {
  const schoolCode = String(req.params.schoolCode);
  const { class: targetClass } = req.query;

  if (!targetClass || typeof targetClass !== "string") {
    return res.status(400).json({ error: "class query parameter is required" });
  }

  try {
    const students = await db
      .select({ id: usersTable.id, fullName: usersTable.fullName, class: usersTable.class })
      .from(usersTable)
      .where(and(eq(usersTable.schoolCode, schoolCode), eq(usersTable.role, "student"), eq(usersTable.class, targetClass)))
      .orderBy(usersTable.fullName);

    if (students.length === 0) {
      return res.json({ students: [], subjects: [] });
    }

    // Determine the correct level for this class
    const levelMap: Record<string, string> = {
      "Pre-School": "kg", KG1: "kg", KG2: "kg",
      "Nursery 1": "nursery", "Nursery 2": "nursery",
      "Pry 1": "primary", "Pry 2": "primary", "Pry 3": "primary", "Pry 4": "primary", "Pry 5": "primary",
      JSS1: "junior", JSS2: "junior", JSS3: "junior",
      SSS1: "senior", SSS2: "senior", SSS3: "senior",
    };
    const level = levelMap[targetClass] ?? "junior";

    // Subjects come from the configured subjects table for this level — not from score data
    const configuredSubjects = await db
      .select({ name: subjectsTable.name })
      .from(subjectsTable)
      .where(and(eq(subjectsTable.schoolCode, schoolCode), eq(subjectsTable.level, level)))
      .orderBy(subjectsTable.name);

    const subjects = configuredSubjects.map(s => s.name);

    const studentIds = students.map(s => s.id);

    // Get current term/session to filter scores
    const [schoolRec] = await db
      .select({ currentTerm: schoolsTable.currentTerm, currentAcademicSession: schoolsTable.currentAcademicSession })
      .from(schoolsTable).where(eq(schoolsTable.code, schoolCode)).limit(1);
    const filterTerm = (req.query.term as string) || schoolRec?.currentTerm || "First Term";
    const filterSession = (req.query.academicSession as string) || schoolRec?.currentAcademicSession || "2025/2026";

    const scores = await db
      .select()
      .from(subjectScoresTable)
      .where(and(
        eq(subjectScoresTable.schoolCode, schoolCode),
        inArray(subjectScoresTable.studentId, studentIds),
        eq(subjectScoresTable.term, filterTerm),
        eq(subjectScoresTable.academicSession, filterSession),
      ));

    // CBT mid-term and exam results as fallback for JSS/SSS students
    const midTermCbtAll = await db
      .select({
        studentId: resultsTable.studentId,
        subject: examsTable.subject,
        score: resultsTable.score,
        totalQuestions: resultsTable.totalQuestions,
      })
      .from(resultsTable)
      .innerJoin(examsTable, eq(resultsTable.examId, examsTable.id))
      .where(and(
        eq(examsTable.schoolCode, schoolCode),
        eq(examsTable.assessmentType, 'mid_term'),
        inArray(resultsTable.studentId, studentIds),
      ));

    const examCbtAll = await db
      .select({
        studentId: resultsTable.studentId,
        subject: examsTable.subject,
        score: resultsTable.score,
        totalQuestions: resultsTable.totalQuestions,
      })
      .from(resultsTable)
      .innerJoin(examsTable, eq(resultsTable.examId, examsTable.id))
      .where(and(
        eq(examsTable.schoolCode, schoolCode),
        eq(examsTable.assessmentType, 'exam'),
        inArray(resultsTable.studentId, studentIds),
      ));

    const [gradingScheme] = await db
      .select()
      .from(gradingSchemesTable)
      .where(eq(gradingSchemesTable.schoolCode, schoolCode))
      .limit(1);
    const midTermCbtMax = gradingScheme?.midTermCbt ?? 10;
    const examCbtMax = gradingScheme?.examCbt ?? 30;

    // Build per-student row keyed by lowercase subject name for case-insensitive matching
    // Use stored totalScore if present; otherwise compute from components
    const scoreByStudent = new Map<number, Map<string, number | null>>();
    // Also store component scores for CBT fallback merging
    const componentsByStudent = new Map<number, Map<string, { mt: number | null; ca: number | null; ex: number | null }>>();

    for (const s of scores) {
      if (!scoreByStudent.has(s.studentId)) scoreByStudent.set(s.studentId, new Map());
      if (!componentsByStudent.has(s.studentId)) componentsByStudent.set(s.studentId, new Map());
      let total: number | null = s.totalScore ?? null;
      if (total === null && s.midTermScore !== null && s.classActivityScore !== null && s.examScore !== null) {
        total = s.midTermScore + s.classActivityScore + s.examScore;
      }
      const key = s.subjectName.toLowerCase();
      scoreByStudent.get(s.studentId)!.set(key, total);
      componentsByStudent.get(s.studentId)!.set(key, {
        mt: s.midTermScore ?? null,
        ca: s.classActivityScore ?? null,
        ex: s.examScore ?? null,
      });
    }

    const rows = students.map(student => {
      const subjectScoresMap = scoreByStudent.get(student.id) ?? new Map();
      const componentsMap = componentsByStudent.get(student.id) ?? new Map();
      const subjectTotals: Record<string, number | null> = {};
      let grandTotal = 0;
      let subjectCount = 0;

      for (const subj of subjects) {
        const subjLower = subj.toLowerCase();
        let score = subjectScoresMap.has(subjLower) ? subjectScoresMap.get(subjLower)! : null;

        // CBT fallback: if no complete score yet, try computing from CBT results
        if (score === null) {
          const stored = componentsMap.get(subjLower);
          const midTermCbt = midTermCbtAll.find(r => r.studentId === student.id && r.subject.toLowerCase() === subjLower);
          const examCbt = examCbtAll.find(r => r.studentId === student.id && r.subject.toLowerCase() === subjLower);

          const mt = stored?.mt ?? (midTermCbt && midTermCbt.totalQuestions > 0
            ? Math.round((midTermCbt.score / midTermCbt.totalQuestions) * midTermCbtMax)
            : null);
          const ca = stored?.ca ?? null;
          const ex = stored?.ex ?? (examCbt && examCbt.totalQuestions > 0
            ? Math.round((examCbt.score / examCbt.totalQuestions) * examCbtMax)
            : null);

          if (mt !== null && ca !== null && ex !== null) {
            score = mt + ca + ex;
          }
        }
        subjectTotals[subj] = score;
        if (score !== null) {
          grandTotal += score;
          subjectCount++;
        }
      }

      const average = subjectCount > 0 ? Math.round((grandTotal / (subjectCount * 100)) * 100 * 10) / 10 : null;

      return { id: student.id, fullName: student.fullName, subjectTotals, grandTotal, average };
    });

    // Calculate positions based on average percentage descending so students with
    // fewer scored subjects are not unfairly penalised by a lower raw grandTotal.
    const sorted = [...rows].sort((a, b) => {
      if (a.average === null && b.average === null) return 0;
      if (a.average === null) return 1;
      if (b.average === null) return -1;
      return b.average - a.average;
    });
    const positionMap = new Map<number, number>();
    let pos = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].average !== sorted[i - 1].average) pos = i + 1;
      positionMap.set(sorted[i].id, pos);
    }

    const result = rows.map(r => ({ ...r, position: positionMap.get(r.id) ?? null }));

    res.json({ students: result, subjects });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// Special results: Entrance Exam or Staff Interview
// GET /:schoolCode/special-results?type=entrance|interview
router.get("/:schoolCode/special-results", requireSchoolAdmin, async (req: Request, res: Response) => {
  const { schoolCode } = req.params;
  const schoolCodeStr = String(schoolCode);
  const { type } = req.query;

  const examClass = type === "interview" ? "Staff Interview" : "Entrance Exam";

  try {
    // Fetch grading scheme for grade computation
    const [scheme] = await db
      .select()
      .from(gradingSchemesTable)
      .where(eq(gradingSchemesTable.schoolCode, schoolCodeStr))
      .limit(1);

    const gradeAMin = scheme?.gradeAMin ?? 70;
    const gradeBMin = scheme?.gradeBMin ?? 60;
    const gradeCMin = scheme?.gradeCMin ?? 50;
    const gradeDMin = scheme?.gradeDMin ?? 40;

    const computeGrade = (pct: number) => {
      if (pct >= gradeAMin) return "A";
      if (pct >= gradeBMin) return "B";
      if (pct >= gradeCMin) return "C";
      if (pct >= gradeDMin) return "D";
      return "F";
    };

    // All results for exams in the special class, joined with exam info
    const rows = await db
      .select({
        resultId: resultsTable.id,
        studentId: resultsTable.studentId,
        fullName: resultsTable.fullName,
        examId: resultsTable.examId,
        examTitle: examsTable.title,
        subject: examsTable.subject,
        score: resultsTable.score,
        totalQuestions: resultsTable.totalQuestions,
        percentage: resultsTable.percentage,
        submittedAt: resultsTable.submittedAt,
        term: resultsTable.term,
      })
      .from(resultsTable)
      .innerJoin(examsTable, eq(resultsTable.examId, examsTable.id))
      .where(
        and(
          eq(resultsTable.schoolCode, schoolCodeStr),
          eq(examsTable.class, examClass),
        )
      )
      .orderBy(desc(resultsTable.percentage));

    const results = rows.map((r, idx) => ({
      ...r,
      grade: computeGrade(r.percentage),
      passed: r.percentage >= gradeDMin,
      rank: idx + 1,
    }));

    // Also fetch all registered candidates (users) in this class
    const candidates = await db
      .select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        username: usersTable.username,
      })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.schoolCode, schoolCodeStr),
          eq(usersTable.role, "student"),
          eq(usersTable.class, examClass),
        )
      )
      .orderBy(usersTable.fullName);

    res.json({ results, candidates, examClass });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

// View license — super admin can see any school, school admin can see their own
router.get("/:schoolCode/license", requireAuth, async (req: Request, res: Response) => {
  const schoolCodeStr = String(req.params.schoolCode);
  if (req.session.role !== "super_admin" && req.session.schoolCode !== schoolCodeStr) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const [school] = await db
      .select({ code: schoolsTable.code, name: schoolsTable.name, licenseValidUntil: schoolsTable.licenseValidUntil })
      .from(schoolsTable)
      .where(eq(schoolsTable.code, schoolCodeStr));
    if (!school) return res.status(404).json({ error: "School not found" });
    res.json({ code: school.code, name: school.name, licenseValidUntil: school.licenseValidUntil?.toISOString() ?? null });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

router.patch("/:schoolCode/license", requireSuperAdmin, async (req: Request, res: Response) => {
  const schoolCodeStr = String(req.params.schoolCode);
  const { licenseValidUntil } = req.body;

  const parsed = licenseValidUntil ? new Date(licenseValidUntil) : null;
  if (!parsed || isNaN(parsed.getTime())) {
    return res.status(400).json({ error: "licenseValidUntil must be a valid ISO date string" });
  }

  try {
    const [updated] = await db
      .update(schoolsTable)
      .set({ licenseValidUntil: parsed })
      .where(eq(schoolsTable.code, schoolCodeStr))
      .returning({ code: schoolsTable.code, licenseValidUntil: schoolsTable.licenseValidUntil });

    if (!updated) return res.status(404).json({ error: "School not found" });
    res.json({ code: updated.code, licenseValidUntil: updated.licenseValidUntil?.toISOString() ?? null });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

router.patch("/:schoolCode/max-devices", requireSuperAdmin, async (req: Request, res: Response) => {
  const schoolCodeStr = String(req.params.schoolCode);
  const { maxDevices } = req.body;

  const val = maxDevices !== undefined && maxDevices !== null && maxDevices !== "" ? Number(maxDevices) : null;
  if (val !== null && (isNaN(val) || val < 1)) {
    return res.status(400).json({ error: "maxDevices must be a positive integer or null" });
  }

  try {
    const [updated] = await db
      .update(schoolsTable)
      .set({ maxDevices: val })
      .where(eq(schoolsTable.code, schoolCodeStr))
      .returning({ code: schoolsTable.code, maxDevices: schoolsTable.maxDevices });

    if (!updated) return res.status(404).json({ error: "School not found" });
    res.json({ code: updated.code, maxDevices: updated.maxDevices ?? null });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

router.patch("/:schoolCode/pure-cbt-mode", requireSuperAdmin, async (req: Request, res: Response) => {
  const schoolCodeStr = String(req.params.schoolCode);
  const { pureCbtMode } = req.body;

  if (typeof pureCbtMode !== "boolean") {
    return res.status(400).json({ error: "pureCbtMode must be a boolean" });
  }

  try {
    const [updated] = await db
      .update(schoolsTable)
      .set({ pureCbtMode })
      .where(eq(schoolsTable.code, schoolCodeStr))
      .returning({ code: schoolsTable.code, pureCbtMode: schoolsTable.pureCbtMode });

    if (!updated) return res.status(404).json({ error: "School not found" });
    res.json({ code: updated.code, pureCbtMode: updated.pureCbtMode });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

export default router;