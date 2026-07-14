import { Router } from "express";
import { upsertDevice, getDevices } from "../device-tracker.js";
import {
  getRegisteredDevices,
  deregisterDevice,
  countRegisteredDevices,
  getMaxDevices,
} from "../local-device-registry.js";

const router = Router();

// POST /heartbeat — any user pings their presence (unauthenticated is ok, just records less info)
router.post("/heartbeat", (req, res) => {
  upsertDevice(req.deviceId, {
    ipAddress: req.ip ?? "",
    userAgent: req.headers["user-agent"] ?? "",
    userId: req.session.userId ?? null,
    username: req.session.username ?? null,
    fullName: req.session.fullName ?? null,
    role: req.session.role ?? null,
    schoolCode: req.session.schoolCode ?? null,
  });
  res.json({ ok: true, serverTime: new Date().toISOString() });
});

// GET /devices — super admin always; school_admin in local mode (own school only)
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

// GET /registered-devices — local mode only; school_admin sees their school's seats
router.get("/registered-devices", (req, res) => {
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
  const max = getMaxDevices(code);
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
