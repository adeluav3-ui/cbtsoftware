import { Router } from "express";
import { upsertDevice, getDevices } from "../device-tracker.js";

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

export default router;
