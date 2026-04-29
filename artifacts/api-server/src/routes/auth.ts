import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { usersTable, schoolsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

// Add session type
interface Session {
  userId?: number;
  role?: string;
  schoolCode?: string | null;
}

interface RequestWithSession extends Request {
  session: Session;
}

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
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
    const session = (req as RequestWithSession).session = (req as RequestWithSession).session || {};
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
      profilePicture: user.profilePicture,
    });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

router.post("/logout", (req: Request, res: Response) => {
  const session = (req as RequestWithSession).session;
  if (session) {
    session.userId = undefined;
    session.role = undefined;
    session.schoolCode = undefined;
  }
  res.json({ message: "Logged out" });
  return;
});

router.get("/me", async (req: Request, res: Response) => {
  const session = (req as RequestWithSession).session;
  const userId = session?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        role: usersTable.role,
        schoolCode: usersTable.schoolCode,
        fullName: usersTable.fullName,
        class: usersTable.class,
        profilePicture: usersTable.profilePicture, // Add this line
      })
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
      profilePicture: user.profilePicture, // Add this line
    });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

export default router;