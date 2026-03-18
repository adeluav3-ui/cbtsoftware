import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, schoolsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

router.post("/login", async (req, res) => {
  const { username, password, schoolCode } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  try {
    let user;

    if (schoolCode) {
      const [found] = await db
        .select()
        .from(usersTable)
        .where(
          and(
            eq(usersTable.username, username),
            eq(usersTable.password, password),
            eq(usersTable.schoolCode, schoolCode)
          )
        )
        .limit(1);
      user = found;
    } else {
      const [found] = await db
        .select()
        .from(usersTable)
        .where(
          and(
            eq(usersTable.username, username),
            eq(usersTable.password, password),
            eq(usersTable.role, "super_admin")
          )
        )
        .limit(1);
      user = found;
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Get school name if applicable
    let schoolName: string | null = null;
    if (user.schoolCode) {
      const [school] = await db
        .select()
        .from(schoolsTable)
        .where(eq(schoolsTable.code, user.schoolCode))
        .limit(1);
      schoolName = school?.name ?? null;
    }

    // Store in session
    (req as any).session = (req as any).session || {};
    const session = (req as any).session;
    session.userId = user.id;
    session.role = user.role;
    session.schoolCode = user.schoolCode;

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      schoolCode: user.schoolCode,
      schoolName,
      fullName: user.fullName,
      class: user.class,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/logout", (req, res) => {
  const session = (req as any).session;
  if (session) {
    session.userId = null;
    session.role = null;
    session.schoolCode = null;
  }
  res.json({ message: "Logged out" });
});

router.get("/me", async (req, res) => {
  const session = (req as any).session;
  const userId = session?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    let schoolName: string | null = null;
    if (user.schoolCode) {
      const [school] = await db
        .select()
        .from(schoolsTable)
        .where(eq(schoolsTable.code, user.schoolCode))
        .limit(1);
      schoolName = school?.name ?? null;
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      schoolCode: user.schoolCode,
      schoolName,
      fullName: user.fullName,
      class: user.class,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
