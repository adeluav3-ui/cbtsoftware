// Public endpoint called by local servers every 20 minutes to:
//   1. Get an authoritative server timestamp (for clock-rollback detection)
//   2. Refresh licenseValidUntil from Postgres (source of truth)
// No authentication required — the response contains only the license date,
// which is low-sensitivity and needed before the local server is set up.
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { schoolsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/time-check", async (req: Request, res: Response) => {
  const { schoolCode } = req.query;

  let licenseValidUntil: string | null = null;

  if (typeof schoolCode === "string" && schoolCode.trim()) {
    try {
      const [school] = await db
        .select({ licenseValidUntil: schoolsTable.licenseValidUntil })
        .from(schoolsTable)
        .where(eq(schoolsTable.code, schoolCode.trim()))
        .limit(1);
      licenseValidUntil = school?.licenseValidUntil?.toISOString() ?? null;
    } catch {
      // DB error — still return serverTime, just omit licenseValidUntil
    }
  }

  res.json({
    serverTime: new Date().toISOString(),
    licenseValidUntil,
  });
});

export default router;
