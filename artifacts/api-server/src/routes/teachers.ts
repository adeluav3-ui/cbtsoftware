import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router({ mergeParams: true });

// List teachers for a school
router.get("/", async (req, res) => {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Create a teacher
router.post("/", async (req, res) => {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a teacher
router.delete("/:teacherId", async (req, res) => {
  const { schoolCode, teacherId } = req.params;

  try {
    const [deleted] = await db
      .delete(usersTable)
      .where(
        and(
          eq(usersTable.id, parseInt(teacherId)),
          eq(usersTable.schoolCode, schoolCode),
          eq(usersTable.role, "teacher")
        )
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    res.json({ message: "Teacher deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
