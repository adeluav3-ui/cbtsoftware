import crypto from "node:crypto";

export interface DeviceInfo {
  deviceId: string;
  firstSeen: Date;
  lastSeen: Date;
  ipAddress: string;
  userAgent: string;
  userId: number | null;
  username: string | null;
  fullName: string | null;
  role: string | null;
  schoolCode: string | null;
}

const devices = new Map<string, DeviceInfo>();

export function generateDeviceId(): string {
  return crypto.randomUUID();
}

export function upsertDevice(deviceId: string, update: Partial<Omit<DeviceInfo, "deviceId" | "firstSeen">>): void {
  const existing = devices.get(deviceId);
  const now = new Date();
  devices.set(deviceId, {
    deviceId,
    firstSeen: existing?.firstSeen ?? now,
    lastSeen: now,
    ipAddress: update.ipAddress ?? existing?.ipAddress ?? "",
    userAgent: update.userAgent ?? existing?.userAgent ?? "",
    userId: update.userId !== undefined ? update.userId : (existing?.userId ?? null),
    username: update.username !== undefined ? update.username : (existing?.username ?? null),
    fullName: update.fullName !== undefined ? update.fullName : (existing?.fullName ?? null),
    role: update.role !== undefined ? update.role : (existing?.role ?? null),
    schoolCode: update.schoolCode !== undefined ? update.schoolCode : (existing?.schoolCode ?? null),
  });
}

export function getDevices(schoolCodeFilter?: string): DeviceInfo[] {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000); // last 30 min
  return Array.from(devices.values())
    .filter((d) => {
      if (d.lastSeen < cutoff) return false;
      if (schoolCodeFilter) return d.schoolCode === schoolCodeFilter;
      return true;
    })
    .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
}
