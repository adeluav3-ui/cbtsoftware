import { db } from "@workspace/db";
import { usersTable, schoolsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export async function seedIfEmpty(): Promise<void> {
  try {
    // Check if any users exist already
    const existing = await db.select().from(usersTable).limit(1);
    if (existing.length > 0) {
      console.log("[seed] Database already has data — skipping seed.");
      return;
    }

    console.log("[seed] Empty database detected — seeding initial data…");

    // Create Super Admin
    await db.insert(usersTable).values({
      username: "Phenomenal",
      password: "REDACTED",
      role: "super_admin",
      fullName: "Super Administrator",
      schoolCode: null,
    });

    // Create schools
    await db.insert(schoolsTable).values([
      { code: "NEW-1001", name: "Newbridge Academy" },
      { code: "BDG-4002", name: null },
      { code: "CSE-6782", name: null },
      { code: "WER-5673", name: null },
      { code: "YUE-0978", name: null },
    ]);

    // Create School Admin for NEW-1001
    await db.insert(usersTable).values({
      username: "Newbridge",
      password: "REDACTED",
      role: "school_admin",
      fullName: "Newbridge Academy Admin",
      schoolCode: "NEW-1001",
    });

    console.log("[seed] Seed complete.");
    console.log("[seed] Super Admin → username: Phenomenal | password: REDACTED");
    console.log("[seed] School Admin (NEW-1001) → username: Newbridge | password: REDACTED | school code: NEW-1001");
    return;
  } catch (err) {
    console.error("[seed] Seed failed:", err);
    return;
  }
}