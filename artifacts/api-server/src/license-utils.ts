import crypto from "node:crypto";

// The license secret is injected at build time for local bundles (via esbuild define)
// and read from env for the cloud server.
// Declared as a var so esbuild can substitute the value at bundle time.
declare const __CBT_LICENSE_SECRET__: string;

function getSecret(): string {
  try {
    // esbuild replaces __CBT_LICENSE_SECRET__ with the literal string in local builds
    if (typeof __CBT_LICENSE_SECRET__ !== "undefined" && __CBT_LICENSE_SECRET__) {
      return __CBT_LICENSE_SECRET__;
    }
  } catch {}
  return process.env.CBT_LICENSE_SECRET ?? "";
}

export interface OfflineLicense {
  type: "cbt-offline-license";
  version: 1;
  schoolCode: string;
  maxDevices: number | null;
  validUntil: string; // ISO 8601
  issuedAt: string;   // ISO 8601
  hmac: string;
}

function signingPayload(l: Omit<OfflineLicense, "hmac">): string {
  return [l.type, l.version, l.schoolCode, l.maxDevices ?? "null", l.validUntil, l.issuedAt].join("|");
}

export function generateLicense(
  schoolCode: string,
  maxDevices: number | null,
  validUntilDate: Date
): OfflineLicense {
  const secret = getSecret();
  if (!secret) throw new Error("CBT_LICENSE_SECRET is not configured");

  const partial: Omit<OfflineLicense, "hmac"> = {
    type: "cbt-offline-license",
    version: 1,
    schoolCode: schoolCode.toUpperCase().trim(),
    maxDevices,
    validUntil: validUntilDate.toISOString(),
    issuedAt: new Date().toISOString(),
  };

  const hmac = crypto
    .createHmac("sha256", secret)
    .update(signingPayload(partial))
    .digest("hex");

  return { ...partial, hmac };
}

export function verifyLicense(license: unknown): { valid: true; license: OfflineLicense } | { valid: false; error: string } {
  if (!license || typeof license !== "object") {
    return { valid: false, error: "Invalid license file" };
  }

  const l = license as Record<string, unknown>;

  if (l.type !== "cbt-offline-license") {
    return { valid: false, error: "Not an offline license file" };
  }
  if (l.version !== 1) {
    return { valid: false, error: "Unsupported license version" };
  }
  if (!l.schoolCode || typeof l.schoolCode !== "string") {
    return { valid: false, error: "License is missing school code" };
  }
  if (!l.validUntil || typeof l.validUntil !== "string") {
    return { valid: false, error: "License is missing validity date" };
  }
  if (typeof l.hmac !== "string") {
    return { valid: false, error: "License signature missing" };
  }

  // Check expiry
  const validUntil = new Date(l.validUntil);
  if (isNaN(validUntil.getTime()) || validUntil < new Date()) {
    return { valid: false, error: "This license has expired" };
  }

  // Verify HMAC
  const secret = getSecret();
  if (!secret) return { valid: false, error: "Server misconfiguration: license secret not set" };

  const partial: Omit<OfflineLicense, "hmac"> = {
    type: "cbt-offline-license",
    version: 1,
    schoolCode: l.schoolCode as string,
    maxDevices: typeof l.maxDevices === "number" ? l.maxDevices : null,
    validUntil: l.validUntil as string,
    issuedAt: l.issuedAt as string,
  };

  const expected = crypto
    .createHmac("sha256", secret)
    .update(signingPayload(partial))
    .digest("hex");

  let valid = false;
  try {
    valid = crypto.timingSafeEqual(Buffer.from(l.hmac as string, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return { valid: false, error: "License signature is invalid" };
  }

  if (!valid) {
    return { valid: false, error: "License signature is invalid — this file may have been tampered with" };
  }

  return { valid: true, license: partial as OfflineLicense };
}
