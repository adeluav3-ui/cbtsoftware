import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router({ mergeParams: true });

// List students for a school, optionally filtered by class
router.get("/", async (req, res) => {
  const { schoolCode } = req.params;
  const { class: studentClass } = req.query;

  try {
    const conditions = [
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Create a student
router.post("/", async (req, res) => {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a student
router.delete("/:studentId", async (req, res) => {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
