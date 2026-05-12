import 'dotenv/config'; // automatically loads .env
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: 0.1,
  enabled: !!process.env.SENTRY_DSN,
});

import app from "./app.js";
import { seedIfEmpty } from "./seed.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
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