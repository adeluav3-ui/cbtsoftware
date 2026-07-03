import type { Request, Response, NextFunction } from "express";
import { generateDeviceId } from "../device-tracker.js";

declare module "express" {
  interface Request {
    deviceId: string;
  }
}

export function deviceIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const isLocal = process.env.DEPLOY_MODE === "local";
  let deviceId = req.cookies?.cbt_device_id as string | undefined;

  if (!deviceId || typeof deviceId !== "string" || deviceId.length < 10) {
    deviceId = generateDeviceId();
  }

  req.deviceId = deviceId;

  res.cookie("cbt_device_id", deviceId, {
    httpOnly: true,
    secure: !isLocal,
    sameSite: "lax",
    maxAge: 365 * 24 * 60 * 60 * 1000,
  });

  next();
}
