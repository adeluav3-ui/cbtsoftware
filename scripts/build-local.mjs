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

console.log("[ 1/7 ] Cleaning dist-local …");
await rmrf(OUT_DIR);
await fs.mkdir(OUT_DIR, { recursive: true });

// ── 2. Build frontend ─────────────────────────────────────────────────────────

console.log("[ 2/7 ] Building frontend …");
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

console.log("[ 3/7 ] Bundling server …");
await build({
  entryPoints: [path.join(SERVER_DIR, "src", "index.local.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: path.join(OUT_DIR, "server.mjs"),
  // CJS packages (e.g. dotenv) bundled into an ESM output call require() for
  // Node built-ins. esbuild's CJS stub can't handle that — provide a real one.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
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

console.log("[ 4/7 ] Copying native addons …");

// Resolve better-sqlite3 from the api-server's node_modules
const require = createRequire(import.meta.url);
const sqlite3Pkg = path.dirname(
  require.resolve("better-sqlite3/package.json", {
    paths: [path.join(SERVER_DIR, "node_modules"), path.join(ROOT, "node_modules")],
  })
);

// Copy the entire package so Node can resolve lib/index.js, package.json, and
// the native .node binary under build/Release/ — all are required at runtime.
await copyDir(sqlite3Pkg, path.join(OUT_DIR, "node_modules", "better-sqlite3"));

// In pnpm's isolated linker, transitive deps are siblings in the virtual store.
// better-sqlite3 → bindings → file-uri-to-path (all needed at runtime).
const sqlite3PnpmDir = path.dirname(sqlite3Pkg); // .../@better-sqlite3@x/node_modules/
const bindingsSrc = path.join(sqlite3PnpmDir, "bindings");
await copyDir(bindingsSrc, path.join(OUT_DIR, "node_modules", "bindings"));

const requireFromBindings = createRequire(path.join(bindingsSrc, "package.json"));
const fileUriSrc = path.dirname(requireFromBindings.resolve("file-uri-to-path/package.json"));
await copyDir(fileUriSrc, path.join(OUT_DIR, "node_modules", "file-uri-to-path"));

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

console.log("[ 5/7 ] Copying frontend dist …");
// Vite outputs to dist/public/ (not dist/ directly — see vite.config.ts build.outDir)
const frontendDist = path.join(FRONTEND_DIR, "dist", "public");
await copyDir(frontendDist, path.join(OUT_DIR, "public"));

// ── 6. Download portable Node.js runtime (Windows) ───────────────────────────

console.log("[ 6/7 ] Bundling Node.js runtime …");

// We bundle the exact same Node.js version that ran this build script.
// This guarantees ABI compatibility with the prebuilt better-sqlite3 native
// addon (which was compiled against this running Node.js's ABI).
const NODE_VERSION = process.version; // e.g. "v22.14.0"
const NODE_CACHE_DIR = path.join(__dirname, ".node-cache");
const NODE_CACHE_FILE = path.join(NODE_CACHE_DIR, `node-${NODE_VERSION}-win-x64.exe`);
const NODE_RUNTIME_DIR = path.join(OUT_DIR, "node-runtime");
const NODE_RUNTIME_EXE = path.join(NODE_RUNTIME_DIR, "node.exe");

await fs.mkdir(NODE_RUNTIME_DIR, { recursive: true });

let cacheHit = false;
try {
  await fs.access(NODE_CACHE_FILE);
  cacheHit = true;
} catch { /* not cached yet */ }

if (cacheHit) {
  console.log(`  Cache hit — using ${NODE_CACHE_FILE}`);
} else {
  const url = `https://nodejs.org/dist/${NODE_VERSION}/win-x64/node.exe`;
  console.log(`  Downloading Node.js ${NODE_VERSION} from nodejs.org …`);
  console.log(`  (This is a one-time ~83 MB download; subsequent builds use the cache)`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText} — ${url}`);
  const buf = await res.arrayBuffer();
  await fs.mkdir(NODE_CACHE_DIR, { recursive: true });
  await fs.writeFile(NODE_CACHE_FILE, Buffer.from(buf));
  console.log(`  Cached to ${NODE_CACHE_FILE}`);
}

await fs.copyFile(NODE_CACHE_FILE, NODE_RUNTIME_EXE);
console.log(`  node.exe ready at dist-local/node-runtime/node.exe`);

// ── 7. Write launchers + README ───────────────────────────────────────────────

console.log("[ 7/7 ] Writing launchers …");

// %~dp0 expands to the directory of the .bat file itself (with trailing \),
// so this works regardless of where the user launches it from.
await fs.writeFile(
  path.join(OUT_DIR, "start.bat"),
  `@echo off
title CBT Local Server
cd /d "%~dp0"
node-runtime\\node.exe server.mjs
pause
`,
  "utf8"
);

// On Linux/Mac we don't bundle a native binary, so fall back to system node.
// The node-runtime/ directory only contains the Windows node.exe.
await fs.writeFile(
  path.join(OUT_DIR, "start.sh"),
  `#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
NODE="$DIR/node-runtime/node.exe"
if [ ! -f "$NODE" ]; then
  NODE=node
fi
"$NODE" "$DIR/server.mjs"
`,
  "utf8"
);

await fs.writeFile(
  path.join(OUT_DIR, "README.txt"),
  `CBT LOCAL SERVER
================

Starting the server
-------------------
Windows : double-click  start.bat  (no Node.js installation required)
Mac/Linux: run          ./start.sh  (requires Node.js 20+ installed)

A QR code will appear in the terminal.
Students open that URL (or scan the QR) in any browser.
All devices must be on the SAME Wi-Fi network.

The database is stored in  cbt-local.db  in this folder.
To reset all data, delete that file and restart the server.

First-time setup
----------------
1. On the cloud admin panel, go to your school and download the
   "Export for Offline Use" .json file.
2. Start this server (double-click start.bat).
3. Open the URL shown in the terminal in any browser.
4. The setup screen will appear — upload the .json file.
5. Log in with your school admin username and password.

After the session, export results from the browser and upload them
back to the cloud (Settings -> Upload Results).
`,
  "utf8"
);

// Safety: strip any database files left in dist-local from a prior test run.
// They must never be distributed — the server creates a fresh cbt-local.db on
// first start.
for (const ext of [".db", ".db-shm", ".db-wal"]) {
  const dbFile = path.join(OUT_DIR, `cbt-local${ext}`);
  try {
    await fs.unlink(dbFile);
    console.log(`  Removed leftover database file: cbt-local${ext}`);
  } catch {
    // file doesn't exist — that's fine
  }
}

console.log(`\nDone! Local server output: ${OUT_DIR}`);
console.log("Run:  node dist-local/server.mjs");
