import { Router } from "express";
import { ApiTypes } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { schoolsTable } from "@workspace/db/schema";
import { count } from "drizzle-orm";

const router = Router();

router.get("/healthz", (_req, res) => {
  const data = ApiTypes.HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Returns whether at least one school has been imported.
// Used by the local-mode frontend to decide whether to show the login form
// or the first-time setup screen.
router.get("/setup-status", async (_req, res) => {
  if (process.env.DEPLOY_MODE !== "local") {
    res.json({ hasSchool: true });
    return;
  }
  try {
    const [result] = await db.select({ c: count() }).from(schoolsTable);
    res.json({ hasSchool: (result?.c ?? 0) > 0 });
  } catch {
    res.json({ hasSchool: false });
  }
});

export default router;
