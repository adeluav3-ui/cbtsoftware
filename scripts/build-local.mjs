#!/usr/bin/env node
/**
 * Builds the local (offline) server distribution.
 *
 * Output: artifacts/api-server/dist-local/
 *   server.mjs          — bundled server (ESM)
 *   node_modules/       — native addons that can't be bundled (better-sqlite3)
 *   public/             — frontend SPA static files
 *   start.bat           — Windows launcher
 *   start.sh            — Linux/Mac launcher
 *   README.txt          — quick-start instructions
 *
 * Usage:
 *   node scripts/build-local.mjs
 *   # or from artifacts/api-server: pnpm run build:local
 */

import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SERVER_DIR = path.join(ROOT, "artifacts", "api-server");
const FRONTEND_DIR = path.join(ROOT, "artifacts", "cbt-app");
const OUT_DIR = path.join(SERVER_DIR, "dist-local");

// ── helpers ──────────────────────────────────────────────────────────────────

async function rmrf(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  for (const entry of await fs.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else {
      await fs.copyFile(s, d);
    }
  }
}

// ── 1. Clean ─────────────────────────────────────────────────────────────────

console.log("[ 1/6 ] Cleaning dist-local …");
await rmrf(OUT_DIR);
await fs.mkdir(OUT_DIR, { recursive: true });

// ── 2. Build frontend ─────────────────────────────────────────────────────────

console.log("[ 2/6 ] Building frontend …");
// VITE_API_URL must point to the local server root (same host, port 8080).
// At runtime the browser is already on http://<lan-ip>:8080, so we use a
// relative path.  Vite replaces the string at build time.
execSync("pnpm run build", {
  cwd: FRONTEND_DIR,
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_API_URL: "/api",
  },
});

// ── 3. Bundle server ──────────────────────────────────────────────────────────

console.log("[ 3/6 ] Bundling server …");
await build({
  entryPoints: [path.join(SERVER_DIR, "src", "index.local.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: path.join(OUT_DIR, "server.mjs"),
  // Alias workspace db packages → the SQLite local implementation
  alias: {
    "@workspace/db": path.join(SERVER_DIR, "src", "db-local.ts"),
    "@workspace/db/schema": path.join(SERVER_DIR, "src", "db-local.ts"),
  },
  external: [
    // Native addons must stay external
    "better-sqlite3",
    // Keep node built-ins external (esbuild handles node: protocol)
    "node:*",
    // bonjour-service uses dynamic requires internally; easier to keep external
    "bonjour-service",
    // drizzle-kit (dev only, never imported at runtime)
    "drizzle-kit",
  ],
  // Suppress "can't bundle .node" warnings — we copy the addon manually below
  logLevel: "warning",
});

// ── 4. Copy native addons ─────────────────────────────────────────────────────

console.log("[ 4/6 ] Copying native addons …");

// Resolve better-sqlite3 from the api-server's node_modules
const require = createRequire(import.meta.url);
const sqlite3Pkg = path.dirname(
  require.resolve("better-sqlite3/package.json", {
    paths: [path.join(SERVER_DIR, "node_modules"), path.join(ROOT, "node_modules")],
  })
);

// The prebuilt .node file lives in better-sqlite3/build/Release/
const addonSrc = path.join(sqlite3Pkg, "build", "Release");
const addonDest = path.join(OUT_DIR, "node_modules", "better-sqlite3", "build", "Release");
await copyDir(addonSrc, addonDest);

// Also need the package.json so Node resolves the addon correctly
await fs.mkdir(path.join(OUT_DIR, "node_modules", "better-sqlite3"), { recursive: true });
await fs.copyFile(
  path.join(sqlite3Pkg, "package.json"),
  path.join(OUT_DIR, "node_modules", "better-sqlite3", "package.json")
);

// Copy bonjour-service (pure JS, but has sub-deps — easiest to copy the whole tree)
try {
  const bonjourPkg = path.dirname(
    require.resolve("bonjour-service/package.json", {
      paths: [path.join(SERVER_DIR, "node_modules"), path.join(ROOT, "node_modules")],
    })
  );
  await copyDir(bonjourPkg, path.join(OUT_DIR, "node_modules", "bonjour-service"));
  // bonjour-service depends on multicast-dns and dns-txt — copy them too
  const bonjourNodeModules = path.join(bonjourPkg, "node_modules");
  const destBonjourNodeModules = path.join(OUT_DIR, "node_modules", "bonjour-service", "node_modules");
  try {
    await copyDir(bonjourNodeModules, destBonjourNodeModules);
  } catch {
    // may not exist if hoisted — that's fine
  }
} catch {
  console.warn("  bonjour-service not found — mDNS will be skipped at runtime");
}

// ── 5. Copy frontend dist ─────────────────────────────────────────────────────

console.log("[ 5/6 ] Copying frontend dist …");
const frontendDist = path.join(FRONTEND_DIR, "dist");
await copyDir(frontendDist, path.join(OUT_DIR, "public"));

// ── 6. Write launchers + README ───────────────────────────────────────────────

console.log("[ 6/6 ] Writing launchers …");

await fs.writeFile(
  path.join(OUT_DIR, "start.bat"),
  `@echo off
title CBT Local Server
node server.mjs
pause
`,
  "utf8"
);

await fs.writeFile(
  path.join(OUT_DIR, "start.sh"),
  `#!/bin/sh
node server.mjs
`,
  "utf8"
);

await fs.writeFile(
  path.join(OUT_DIR, "README.txt"),
  `CBT LOCAL SERVER
================

Requirements
------------
- Node.js 20 or later  (https://nodejs.org)
- All devices must be on the SAME Wi-Fi network

Starting the server
-------------------
Windows : double-click  start.bat
Mac/Linux: run          ./start.sh

A QR code will appear in the terminal.
Students open that URL (or scan the QR) in any browser.

The database is stored in  cbt-local.db  next to this folder.
To reset all data, delete that file and restart the server.

First-time setup
----------------
On first run a default Super Admin account is created:
  Username : Phenomenal
  Password : REDACTED
Log in, create your school, add teachers and students.
`,
  "utf8"
);

console.log(`\nDone! Local server output: ${OUT_DIR}`);
console.log("Run:  node dist-local/server.mjs");
