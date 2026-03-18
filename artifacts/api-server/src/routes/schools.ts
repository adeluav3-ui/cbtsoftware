import { Router } from "express";
import { db } from "@workspace/db";
import {
  schoolsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

// List all schools
router.get("/", async (_req, res) => {
  try {
    const schools = await db.select().from(schoolsTable).orderBy(schoolsTable.id);
    res.json(schools);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update school name
router.post("/", async (req, res) => {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Start new session (promote students)
router.post("/:schoolCode/new-session", async (req, res) => {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// School admin login (also uses /auth/login, kept for compatibility)
router.post("/admin/login", async (req, res) => {
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

    const session = (req as any).session;
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
