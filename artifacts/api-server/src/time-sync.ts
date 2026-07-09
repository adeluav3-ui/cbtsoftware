// Background time-sync — local mode only.
// Every 20 minutes, calls the cloud time-check endpoint to:
//   1. Advance the trusted_time_floor ratchet (prevents clock rollback attacks)
//   2. Refresh licenseValidUntil from the cloud source of truth
import { db } from "@workspace/db";
import { schoolsTable, serverConfigTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const CLOUD_URL = "https://cbtsoftware.onrender.com/api/time-check";
const INTERVAL_MS = 20 * 60 * 1000;

async function sync(): Promise<void> {
  try {
    // .all() executes the better-sqlite3 sync query and returns an array
    const schoolCodeRows = (db.select({ value: (serverConfigTable as any).value })
      .from(serverConfigTable as any)
      .where(eq((serverConfigTable as any).key, "school_code")) as any).all() as Array<{ value: string | null }>;
    const schoolCode = schoolCodeRows[0]?.value;
    if (!schoolCode) return; // server not yet set up

    const url = `${CLOUD_URL}?schoolCode=${encodeURIComponent(schoolCode)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return;

    const json = await res.json().catch(() => null) as {
      serverTime: string;
      licenseValidUntil: string | null;
    } | null;
    if (!json) return;

    const { serverTime, licenseValidUntil } = json;
    const serverMs = new Date(serverTime).getTime();
    if (isNaN(serverMs)) return;

    // Advance the floor to max(current, serverTime)
    const currentFloorRows = (db.select({ value: (serverConfigTable as any).value })
      .from(serverConfigTable as any)
      .where(eq((serverConfigTable as any).key, "trusted_time_floor")) as any).all() as Array<{ value: string | null }>;
    const currentFloor = parseInt(currentFloorRows[0]?.value ?? "0", 10) || 0;
    const newFloor = Math.max(currentFloor, serverMs);

    await (db.insert(serverConfigTable as any).values({ key: "trusted_time_floor", value: String(newFloor) })
      .onConflictDoUpdate({ target: (serverConfigTable as any).key, set: { value: String(newFloor) } }) as unknown as Promise<void>);

    // Refresh licenseValidUntil in local schools table
    if (licenseValidUntil !== undefined) {
      const parsed = licenseValidUntil ? new Date(licenseValidUntil) : null;
      await (db.update(schoolsTable)
        .set({ licenseValidUntil: parsed })
        .where(eq(schoolsTable.code, schoolCode)) as unknown as Promise<void>);
    }
  } catch {
    // Network unavailable — silent, ratchet stays at last value
  }
}

export function startTimeSync(): void {
  // First sync after 30s startup delay, then every 20 min
  setTimeout(() => {
    void sync();
    setInterval(() => { void sync(); }, INTERVAL_MS);
  }, 30_000);
}
