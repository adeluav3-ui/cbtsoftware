// Local-only endpoint for first-time offline app activation.
// Requires a valid signed license (issued by the super admin on the cloud).
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { schoolsTable, usersTable, serverConfigTable } from "@workspace/db/schema";
import { count, eq } from "drizzle-orm";
import { verifyLicense } from "../license-utils.js";

const router = Router();

// GET /api/setup/status — whether the local server has been activated yet
router.get("/status", async (_req: Request, res: Response) => {
  if (process.env.DEPLOY_MODE !== "local") {
    res.json({ activated: true });
    return;
  }
  try {
    const [{ c }] = await db.select({ c: count() }).from(schoolsTable);
    res.json({ activated: (c ?? 0) > 0 });
  } catch {
    res.json({ activated: false });
  }
});

// POST /api/setup/activate — activate the local server with a license + school info
router.post("/activate", async (req: Request, res: Response) => {
  if (process.env.DEPLOY_MODE !== "local") {
    res.status(404).json({ error: "Not available in cloud mode" });
    return;
  }

  // Only works when no school exists yet
  try {
    const [{ c }] = await db.select({ c: count() }).from(schoolsTable);
    if ((c ?? 0) > 0) {
      res.status(409).json({ error: "This server is already activated. Contact your administrator." });
      return;
    }
  } catch (err) {
    console.error("[setup/activate] DB check failed:", err);
    res.status(500).json({ error: "Server error" });
    return;
  }

  const { license, schoolName, adminFullName, adminUsername, adminPassword } = req.body;

  // Validate required fields
  if (!license) {
    res.status(400).json({ error: "License is required" });
    return;
  }
  if (!schoolName?.trim()) {
    res.status(400).json({ error: "School name is required" });
    return;
  }
  if (!adminFullName?.trim()) {
    res.status(400).json({ error: "Admin full name is required" });
    return;
  }
  if (!adminUsername?.trim()) {
    res.status(400).json({ error: "Admin username is required" });
    return;
  }
  if (!adminPassword || adminPassword.length < 6) {
    res.status(400).json({ error: "Admin password must be at least 6 characters" });
    return;
  }

  // Verify the license signature
  const result = verifyLicense(license);
  if (!result.valid) {
    res.status(400).json({ error: result.error });
    return;
  }

  const { schoolCode, maxDevices, validUntil } = result.license;

  try {
    // Create the school record using license constraints
    await (db.insert(schoolsTable as any)
      .values({
        code: schoolCode,
        name: schoolName.trim(),
        maxDevices: maxDevices ?? null,
        licenseValidUntil: new Date(validUntil),
      }) as any);

    // Create the school admin account
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await db.insert(usersTable).values({
      username: adminUsername.trim().toLowerCase(),
      password: hashedPassword,
      generatedPassword: adminPassword,
      fullName: adminFullName.trim(),
      role: "school_admin",
      schoolCode,
    } as any);

    // Record school_code in server_config so license checks and time-sync work
    await (db.insert(serverConfigTable as any)
      .values({ key: "school_code", value: schoolCode })
      .onConflictDoUpdate({
        target: (serverConfigTable as any).key,
        set: { value: schoolCode },
      }) as unknown as Promise<void>);

    res.json({ ok: true, schoolCode, maxDevices });
  } catch (err) {
    console.error("[setup/activate] activation failed:", err);
    const detail = err instanceof Error ? err.message : undefined;
    res.status(500).json({ error: "Activation failed", ...(detail && { detail }) });
  }
});

export default router;
