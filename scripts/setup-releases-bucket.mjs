#!/usr/bin/env node
/**
 * One-time script: creates the "offline-releases" Supabase Storage bucket
 * (public) and uploads cbt-offline-v4.zip as the initial download file.
 *
 * The stable download URL will be:
 *   https://cpgsrgcaxryxrjwtlkcd.supabase.co/storage/v1/object/public/offline-releases/cbt-software-setup.exe
 *
 * To update a release: just re-upload a new file to the same path.
 * The homepage never needs changing.
 *
 * Usage:
 *   node scripts/setup-releases-bucket.mjs
 * (reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from artifacts/api-server/.env)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── read env from api-server ──────────────────────────────────────────────────
const envPath = path.join(ROOT, "artifacts", "api-server", ".env");
const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in api-server/.env");
  process.exit(1);
}

const BUCKET = "offline-releases";
const UPLOAD_PATH = "cbt-software-setup.exe"; // stable path — replace in-place for new releases
const ZIP_FILE = path.join(ROOT, "artifacts", "api-server", "cbt-offline-v4.zip");

const headers = {
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "Content-Type":  "application/json",
};

// ── 1. Create bucket (public) ─────────────────────────────────────────────────
console.log(`Creating bucket "${BUCKET}" …`);
const createRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
  method:  "POST",
  headers,
  body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
});
const createBody = await createRes.json();

if (createRes.ok) {
  console.log(`  Bucket created: ${BUCKET}`);
} else if (createBody.error === "Duplicate") {
  console.log(`  Bucket already exists — continuing`);
} else {
  console.error("  Bucket creation failed:", createBody);
  process.exit(1);
}

// ── 2. Upload zip as the initial installer placeholder ─────────────────────────
console.log(`Uploading ${path.basename(ZIP_FILE)} → ${BUCKET}/${UPLOAD_PATH} …`);
const fileBytes = fs.readFileSync(ZIP_FILE);

const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${UPLOAD_PATH}`, {
  method:  "POST",
  headers: {
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "Content-Type":  "application/octet-stream",
    "x-upsert":      "true",  // overwrite if exists
  },
  body: fileBytes,
});
const uploadBody = await uploadRes.json();

if (uploadRes.ok) {
  console.log(`  Uploaded successfully`);
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${UPLOAD_PATH}`;
  console.log(`\nPublic URL:\n  ${publicUrl}\n`);
  console.log("This is the permanent download URL. Replace the file in Supabase Storage");
  console.log("when a new build ships — the URL stays the same.");
} else {
  console.error("  Upload failed:", uploadBody);
  process.exit(1);
}
