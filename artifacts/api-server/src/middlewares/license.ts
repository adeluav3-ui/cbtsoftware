// License enforcement middleware — local mode only.
// Runs after requireAuth; passes through if DEPLOY_MODE !== "local".
import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { schoolsTable, serverConfigTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

// 2-minute grace window for minor clock drift
const CLOCK_GRACE_MS = 2 * 60 * 1000;

export function checkLocalLicense(req: Request, res: Response, next: NextFunction): void {
  if (process.env.DEPLOY_MODE !== "local") { next(); return; }

  try {
    // drizzle-orm/better-sqlite3 queries are synchronous — use .all() to execute
    const configRows = (db.select().from(serverConfigTable as any) as any).all() as Array<{ key: string; value: string | null }>;
    const configMap = new Map(configRows.map(r => [r.key, r.value]));

    const now = Date.now();

    // Clock-tamper ratchet: reject if local time is behind the last trusted floor
    const floorStr = configMap.get("trusted_time_floor");
    if (floorStr) {
      const floor = parseInt(floorStr, 10);
      if (!isNaN(floor) && now < floor - CLOCK_GRACE_MS) {
        res.status(423).json({ error: "CLOCK_TAMPER" });
        return;
      }
    }

    // License expiry: only checked if we know which school this server serves
    const schoolCode = configMap.get("school_code");
    if (schoolCode) {
      const schools = (db.select({ licenseValidUntil: schoolsTable.licenseValidUntil })
        .from(schoolsTable)
        .where(eq(schoolsTable.code, schoolCode)) as any).all() as Array<{ licenseValidUntil: Date | null }>;

      const school = schools[0];
      if (school?.licenseValidUntil && now > school.licenseValidUntil.getTime()) {
        res.status(423).json({
          error: "LICENSE_EXPIRED",
          licenseValidUntil: school.licenseValidUntil.toISOString(),
        });
        return;
      }
    }
  } catch {
    // Fail open — a DB error shouldn't lock out the school
  }

  next();
}
