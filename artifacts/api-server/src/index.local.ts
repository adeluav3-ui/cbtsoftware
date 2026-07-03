// Entry point for the packaged local (offline) server.
// Differences from index.ts:
//   - Sets DEPLOY_MODE=local before importing app
//   - Prints LAN IP + QR code after binding
//   - No PORT requirement (defaults to 8080)
import "dotenv/config";

process.env.DEPLOY_MODE = "local";

const { default: app } = await import("./app.js");
const { seedIfEmpty } = await import("./seed.js");
const { localStartup } = await import("./local-startup.js");

const port = Number(process.env.PORT ?? "8080");

await seedIfEmpty();

app.listen(port, "0.0.0.0", async () => {
  await localStartup(port);
});
