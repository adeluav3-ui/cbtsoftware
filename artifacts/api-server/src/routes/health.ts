import { Router } from "express";
import { ApiTypes } from "@workspace/api-zod";

const router = Router();

router.get("/healthz", (_req, res) => {
  const data = ApiTypes.HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;