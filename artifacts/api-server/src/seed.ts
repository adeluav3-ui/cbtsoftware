import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";

export async function seedIfEmpty(): Promise<void> {
  // Local mode: seeded entirely via the import-school flow — nothing to do here.
  if (process.env.DEPLOY_MODE === "local") {
    console.log("[seed] Local mode — skipping seed (use import-school to populate).");
    return;
  }

  // Cloud mode: if any user already exists the DB is already initialised.
  try {
    const existing = await db.select().from(usersTable).limit(1);
    if (existing.length > 0) {
      console.log("[seed] Database already has data — skipping seed.");
      return;
    }

    // Fresh cloud deployment with an empty database.
    // Do NOT create any default accounts here — the first super admin must be
    // created deliberately via a one-off script or direct DB access so that no
    // credential ever appears in source code or version history.
    console.log("[seed] Empty cloud database detected.");
    console.log("[seed] No default accounts seeded. Create the initial super admin via a one-off script.");
  } catch (err) {
    console.error("[seed] Seed check failed:", err);
  }
}
