import { Router } from "express";
import { getJoinInfo } from "../local-startup.js";

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

export default router;
