import 'dotenv/config';
import "./instrument.js"; // Sentry must init before any other imports

// Dynamic imports ensure Sentry instruments Express, pg, and http
// before those modules are loaded (required in ESM — static imports are hoisted)
const { default: app } = await import("./app.js");
const { seedIfEmpty } = await import("./seed.js");

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

seedIfEmpty().then(() => {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
});
