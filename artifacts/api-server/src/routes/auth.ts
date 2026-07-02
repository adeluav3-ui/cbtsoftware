import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, schoolsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

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
        .where(and(eq(usersTable.username, username), eq(usersTable.schoolCode, schoolCode)))
        .limit(1);
      user = found;
    } else {
      const [found] = await db
        .select()
        .from(usersTable)
        .where(and(eq(usersTable.username, username), eq(usersTable.role, "super_admin")))
        .limit(1);
      user = found;
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Rolling bcrypt migration: support both hashed and plain-text passwords
    const isHashed = user.password.startsWith("$2");
    let passwordMatch: boolean;

    if (isHashed) {
      passwordMatch = await bcrypt.compare(password, user.password);
    } else {
      passwordMatch = password === user.password;
      if (passwordMatch) {
        // Hash it now — this user is self-migrating on login
        const hashed = await bcrypt.hash(password, 10);
        await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, user.id));
      }
    }

    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    let schoolName: string | null = null;
    let isDisabled = false;
    if (user.schoolCode) {
      const [school] = await db
        .select()
        .from(schoolsTable)
        .where(eq(schoolsTable.code, user.schoolCode))
        .limit(1);
      schoolName = school?.name ?? null;
      isDisabled = school?.isDisabled ?? false;
      if (isDisabled) {
        return res.status(403).json({ error: "This school's access has been suspended. Please contact the platform administrator." });
      }
    }

    // Regenerate session ID on login to prevent session fixation attacks
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate(err => err ? reject(err) : resolve());
    });

    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.schoolCode = user.schoolCode;

    // Explicitly save before responding — Redis writes are async and the
    // response can flush before the auto-save hook completes, causing the
    // very next /me request to return 401.
    await new Promise<void>((resolve, reject) => {
      req.session.save(err => err ? reject(err) : resolve());
    });

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      schoolCode: user.schoolCode,
      schoolName,
      fullName: user.fullName,
      class: user.class,
      profilePicture: user.profilePicture,
      isDisabled: false,
    });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

router.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) console.error(err);
    res.clearCookie("session_id");
    res.json({ message: "Logged out" });
  });
});

router.get("/me", async (req: Request, res: Response) => {
  const userId = req.session?.userId;

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
        profilePicture: usersTable.profilePicture,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    let schoolName: string | null = null;
    let isDisabled = false;
    if (user.schoolCode) {
      const [school] = await db
        .select()
        .from(schoolsTable)
        .where(eq(schoolsTable.code, user.schoolCode))
        .limit(1);
      schoolName = school?.name ?? null;
      isDisabled = school?.isDisabled ?? false;
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      schoolCode: user.schoolCode,
      schoolName,
      fullName: user.fullName,
      class: user.class,
      profilePicture: user.profilePicture,
      isDisabled,
    });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});

export default router;
