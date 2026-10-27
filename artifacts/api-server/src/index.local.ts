// Entry point for the packaged local (offline) server.
// Differences from index.ts:
//   - Sets DEPLOY_MODE=local before importing app
//   - Serves SPA index.html at the raw HTTP layer (bypasses Express routing)
//   - Prints LAN IP + QR code after binding
//   - No PORT requirement (defaults to 8080)
import "dotenv/config";
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";

process.env.DEPLOY_MODE = "local";

const { default: app } = await import("./app.js");
const { seedIfEmpty } = await import("./seed.js");
const { localStartup } = await import("./local-startup.js");

const port = Number(process.env.PORT ?? "8080");

await seedIfEmpty();

// Read index.html once at startup. We serve it directly at the HTTP level for
// any non-API, non-asset path so Express routing never gets a chance to miss it.
const frontendDir = process.env.FRONTEND_DIR ?? path.join(process.cwd(), "public");
const indexHtmlPath = path.join(frontendDir, "index.html");
let indexHtml: Buffer | null = null;
try {
  indexHtml = fs.readFileSync(indexHtmlPath);
  console.log(`[local] index.html ready: ${indexHtml.length} bytes`);
} catch (err) {
  console.error(`[local] WARN: could not pre-load index.html: ${err}`);
}

// Determines whether a URL should be served as the SPA shell (index.html).
// API calls and static assets (anything with a file extension or /uploads/)
// are passed through to Express unchanged.
function isSpaRoute(url: string): boolean {
  if (url.startsWith("/api/")) return false;
  if (url.startsWith("/uploads/")) return false;
  // Static assets have a file extension
  const basename = url.split("?")[0].split("/").pop() ?? "";
  if (basename.includes(".")) return false;
  return true;
}

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";
  if (req.method === "GET" && isSpaRoute(url) && indexHtml) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(indexHtml);
    return;
  }
  // Everything else (API, static assets, uploads) goes through Express
  (app as http.RequestListener)(req, res);
});

server.listen(port, "0.0.0.0", async () => {
  await localStartup(port);
});
