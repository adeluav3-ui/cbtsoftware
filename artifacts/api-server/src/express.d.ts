// Global Express Request augmentation — picked up by all route files automatically.
declare namespace Express {
  interface Request {
    deviceId: string;
  }
}
