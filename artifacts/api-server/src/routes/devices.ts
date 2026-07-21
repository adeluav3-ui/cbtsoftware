import { Router } from "express";
import { upsertDevice, getDevices, getDeviceType } from "../device-tracker.js";
import {
  getRegisteredDevices,
  deregisterDevice,
  countRegisteredDevices,
  getMaxDevices,
} from "../local-device-registry.js";
import { db, schoolsTable, deviceSessionsTable } from "@workspace/db";
import { eq, gte, and } from "drizzle-orm";

const router = Router();

// POST /heartbeat — any user pings their presence (unauthenticated is ok, just records less info)
router.post("/heartbeat", async (req, res) => {
  const userAgent = req.headers["user-agent"] ?? "";
  const info = {
    ipAddress: req.ip ?? "",
    userAgent,
    userId: req.session.userId ?? null,
    username: req.session.username ?? null,
    fullName: req.session.fullName ?? null,
    role: req.session.role ?? null,
    schoolCode: req.session.schoolCode ?? null,
  };

  upsertDevice(req.deviceId, info);

  // In cloud mode, also persist to the device_sessions DB table
  if (process.env.DEPLOY_MODE !== "local") {
    const now = new Date();
    await db.insert(deviceSessionsTable).values({
      deviceId: req.deviceId,
      schoolCode: info.schoolCode,
      ipAddress: info.ipAddress,
      userAgent,
      userId: info.userId,
      username: info.username,
      fullName: info.fullName,
      role: info.role,
      firstSeen: now,
      lastSeen: now,
    }).onConflictDoUpdate({
      target: deviceSessionsTable.deviceId,
      set: {
        schoolCode: info.schoolCode,
        ipAddress: info.ipAddress,
        userAgent,
        userId: info.userId,
        username: info.username,
        fullName: info.fullName,
        role: info.role,
        lastSeen: now,
      },
    });
  }

  res.json({ ok: true, serverTime: new Date().toISOString() });
});

// GET /devices — super admin (all); school_admin in local mode (own school only)
router.get("/devices", (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const isLocal = process.env.DEPLOY_MODE === "local";
  const { role, schoolCode } = req.session;

  if (role === "super_admin") {
    res.json(getDevices());
    return;
  }
  if (isLocal && (role === "school_admin" || role === "teacher")) {
    res.json(getDevices(schoolCode ?? undefined));
    return;
  }
  res.status(403).json({ error: "Forbidden" });
});

// GET /school-devices — cloud mode; school_admin sees active devices for their school
router.get("/school-devices", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (process.env.DEPLOY_MODE === "local") {
    res.status(404).json({ error: "Not available in local mode" });
    return;
  }
  const { role, schoolCode } = req.session;
  if (role !== "school_admin" && role !== "super_admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const cutoff = new Date(Date.now() - 30 * 60 * 1000); // active in last 30 min
  const rows = await db
    .select()
    .from(deviceSessionsTable)
    .where(
      and(
        eq(deviceSessionsTable.schoolCode, schoolCode ?? ""),
        gte(deviceSessionsTable.lastSeen, cutoff)
      )
    )
    .orderBy(deviceSessionsTable.lastSeen);

  const devices = rows.map(r => ({
    deviceId: r.deviceId,
    deviceType: getDeviceType(r.userAgent ?? ""),
    ipAddress: r.ipAddress,
    fullName: r.fullName,
    username: r.username,
    role: r.role,
    firstSeen: r.firstSeen,
    lastSeen: r.lastSeen,
  }));

  res.json({ devices, count: devices.length });
});

// GET /registered-devices — local mode only; school_admin sees their school's seats
router.get("/registered-devices", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const isLocal = process.env.DEPLOY_MODE === "local";
  if (!isLocal) {
    res.status(404).json({ error: "Not available in cloud mode" });
    return;
  }
  const { role, schoolCode } = req.session;
  if (role !== "school_admin" && role !== "super_admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const code = schoolCode ?? "";
  const devices = getRegisteredDevices(code);
  // Try Drizzle ORM first; fall back to raw SQLite if it returns null
  let max: number | null = null;
  try {
    const [school] = await db.select({ maxDevices: schoolsTable.maxDevices }).from(schoolsTable).where(eq(schoolsTable.code, code));
    max = school?.maxDevices ?? null;
  } catch {
    // ignore — raw SQLite fallback below
  }
  if (max === null) {
    max = getMaxDevices(code);
  }
  res.json({ devices, count: devices.length, max });
});

// DELETE /registered-devices/:deviceId — deregister a seat (local mode, school_admin only)
router.delete("/registered-devices/:deviceId", (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const isLocal = process.env.DEPLOY_MODE === "local";
  if (!isLocal) {
    res.status(404).json({ error: "Not available in cloud mode" });
    return;
  }
  const { role, schoolCode } = req.session;
  if (role !== "school_admin" && role !== "super_admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { deviceId } = req.params as { deviceId: string };
  const removed = deregisterDevice(deviceId, schoolCode ?? "");
  if (!removed) {
    res.status(404).json({ error: "Device not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
