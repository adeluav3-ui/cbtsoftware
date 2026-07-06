import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request<any, any, any, any>, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

// Blocks any request in local (offline) mode with 403. Use on routes that
// must never exist in local deployments (super_admin management, cloud-only ops).
export function denyInLocalMode(_req: Request, res: Response, next: NextFunction): void {
  if (process.env.DEPLOY_MODE === "local") {
    res.status(403).json({ error: "Not available in local mode" });
    return;
  }
  next();
}

export function requireSuperAdmin(req: Request<any, any, any, any>, res: Response, next: NextFunction): void {
  // There is no super_admin account in local mode — block unconditionally.
  if (process.env.DEPLOY_MODE === "local") {
    res.status(403).json({ error: "Not available in local mode" });
    return;
  }
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (req.session.role !== "super_admin") {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  next();
}

// school_admin for their own school, or super_admin for any school
export function requireSchoolAdmin(req: Request<any, any, any, any>, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const role = req.session.role;
  if (role === "super_admin") {
    next();
    return;
  }
  if (role !== "school_admin") {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  const schoolCode = req.params.schoolCode;
  if (schoolCode && req.session.schoolCode !== schoolCode) {
    res.status(403).json({ error: "Not authorized for this school" });
    return;
  }
  next();
}

// school_admin or teacher for their own school, or super_admin for any school
export function requireSchoolStaff(req: Request<any, any, any, any>, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const role = req.session.role;
  if (role === "super_admin") {
    next();
    return;
  }
  if (role !== "school_admin" && role !== "teacher") {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  const schoolCode = req.params.schoolCode;
  if (schoolCode && req.session.schoolCode !== schoolCode) {
    res.status(403).json({ error: "Not authorized for this school" });
    return;
  }
  next();
}
