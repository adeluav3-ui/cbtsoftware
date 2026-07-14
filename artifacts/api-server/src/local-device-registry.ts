// Device registration for local offline mode (Model A: permanent seats).
// All functions are no-ops when _db is null (i.e. in cloud builds).
// Call initDeviceRegistry(sqlite) once on local startup to activate.

type SqliteDb = {
  prepare: (sql: string) => {
    run: (...args: unknown[]) => { changes: number };
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  };
};

let _db: SqliteDb | null = null;

export function initDeviceRegistry(db: SqliteDb): void {
  _db = db;
}

export function isDeviceRegistered(deviceId: string): boolean {
  if (!_db) return false;
  return !!_db.prepare("SELECT 1 FROM registered_devices WHERE device_id = ?").get(deviceId);
}

export function countRegisteredDevices(schoolCode: string): number {
  if (!_db) return 0;
  const row = _db.prepare(
    "SELECT COUNT(*) AS c FROM registered_devices WHERE school_code = ?"
  ).get(schoolCode) as { c: number } | undefined;
  return row?.c ?? 0;
}

export function getMaxDevices(schoolCode: string): number | null {
  if (!_db) return null;
  const row = _db.prepare(
    "SELECT max_devices FROM schools WHERE code = ?"
  ).get(schoolCode) as { max_devices: number | null } | undefined;
  return row?.max_devices ?? null;
}

export interface RegisteredDevice {
  deviceId: string;
  schoolCode: string;
  registeredAt: number;
  lastSeen: number;
  userId: number | null;
  username: string | null;
  fullName: string | null;
  role: string | null;
  ipAddress: string | null;
}

export function registerDevice(
  deviceId: string,
  schoolCode: string,
  info: {
    userId?: number | null;
    username?: string | null;
    fullName?: string | null;
    role?: string | null;
    ipAddress?: string | null;
  }
): void {
  if (!_db) return;
  const now = Date.now();
  _db.prepare(`
    INSERT INTO registered_devices
      (device_id, school_code, registered_at, last_seen, user_id, username, full_name, role, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      last_seen   = excluded.last_seen,
      user_id     = excluded.user_id,
      username    = excluded.username,
      full_name   = excluded.full_name,
      role        = excluded.role,
      ip_address  = excluded.ip_address
  `).run(
    deviceId, schoolCode, now, now,
    info.userId ?? null, info.username ?? null,
    info.fullName ?? null, info.role ?? null, info.ipAddress ?? null
  );
}

export function getRegisteredDevices(schoolCode: string): RegisteredDevice[] {
  if (!_db) return [];
  return (_db.prepare(
    "SELECT * FROM registered_devices WHERE school_code = ? ORDER BY registered_at ASC"
  ).all(schoolCode) as Array<{
    device_id: string; school_code: string; registered_at: number; last_seen: number;
    user_id: number | null; username: string | null; full_name: string | null;
    role: string | null; ip_address: string | null;
  }>).map(r => ({
    deviceId: r.device_id,
    schoolCode: r.school_code,
    registeredAt: r.registered_at,
    lastSeen: r.last_seen,
    userId: r.user_id,
    username: r.username,
    fullName: r.full_name,
    role: r.role,
    ipAddress: r.ip_address,
  }));
}

export function deregisterDevice(deviceId: string, schoolCode: string): boolean {
  if (!_db) return false;
  const result = _db.prepare(
    "DELETE FROM registered_devices WHERE device_id = ? AND school_code = ?"
  ).run(deviceId, schoolCode);
  return result.changes > 0;
}
