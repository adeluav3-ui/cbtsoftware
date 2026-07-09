import { Router } from "express";
import { getJoinInfo, refreshJoinInfo } from "../local-startup.js";

const router = Router();

router.get("/join-info", (_req, res) => {
  if (process.env.DEPLOY_MODE !== "local") {
    res.status(404).json({ error: "Not available in cloud mode" });
    return;
  }
  const info = getJoinInfo();
  if (!info) {
    res.status(503).json({ error: "Server initializing" });
    return;
  }
  res.json(info);
});

// Re-detect LAN IP and re-register mDNS without restarting the server.
// Called by the admin status bar's Refresh button.
router.post("/join-info/refresh", async (_req, res) => {
  if (process.env.DEPLOY_MODE !== "local") {
    res.status(404).json({ error: "Not available in cloud mode" });
    return;
  }
  try {
    const info = await refreshJoinInfo();
    if (!info) {
      res.status(503).json({ error: "Server initializing" });
      return;
    }
    res.json(info);
  } catch (err) {
    console.error("join-info refresh failed:", err);
    res.status(500).json({ error: "Refresh failed" });
  }
});

export default router;
