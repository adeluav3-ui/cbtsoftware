import express, { type Express } from "express";
import * as Sentry from "@sentry/node";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import { createClient } from "redis";
import RedisStore from "connect-redis";
import helmet from "helmet";
import path from "node:path";
import router from "./routes/index.js";
import { getUploadsDir } from "./storage.js";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    role?: string;
    schoolCode?: string | null;
  }
}

// Hard-fail on missing SESSION_SECRET in production — a missing secret makes
// sessions forgeable and must never silently fall back to a known value.
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  console.error("FATAL: SESSION_SECRET environment variable must be set in production");
  process.exit(1);
}

const isLocal = process.env.DEPLOY_MODE === "local";

const app: Express = express();

app.set("trust proxy", 1);

// Security headers — in local mode HTML is served so keep helmet lenient
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// In local mode the frontend is on the same origin, so reflect any LAN origin.
// In cloud mode, only allow the Vercel frontend.
app.use(cors(
  isLocal
    ? { origin: true, credentials: true, methods: ["GET", "POST", "PUT", "DELETE", "PATCH"], allowedHeaders: ["Content-Type", "Authorization"] }
    : { origin: "https://cbtsoftware-cbt-app.vercel.app", credentials: true, methods: ["GET", "POST", "PUT", "DELETE", "PATCH"], allowedHeaders: ["Content-Type", "Authorization"] }
));

// 10 MB limit to accommodate local→cloud results sync payloads (answers can be large)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Use Redis when REDIS_URL is configured; otherwise fall back to the
// built-in MemoryStore. Without REDIS_URL, sessions reset on server
// restart (known Render free-tier limitation) but at least they work
// within a single server lifetime instead of silently failing.
let sessionStore: session.Store | undefined;
if (process.env.REDIS_URL) {
  const redisClient = createClient({ url: process.env.REDIS_URL });
  redisClient.connect().catch(err => console.error("Redis connection failed:", err));
  sessionStore = new RedisStore({ client: redisClient });
} else {
  console.warn("REDIS_URL not set — using MemoryStore (sessions reset on restart)");
}

app.use(session({
  store: sessionStore,
  name: "session_id",
  secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: !isLocal, // local server is HTTP, not HTTPS
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use("/api", router);

// In local mode, serve uploaded images and the built React frontend from disk
if (isLocal) {
  app.use("/uploads", express.static(getUploadsDir()));

  const frontendDir = process.env.FRONTEND_DIR ?? path.join(process.cwd(), "public");
  app.use(express.static(frontendDir));

  // SPA fallback — Wouter handles routing client-side, so all non-API paths
  // must return index.html
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDir, "index.html"));
  });
}

// Sentry error handler — must come after routes, before any other error middleware
Sentry.setupExpressErrorHandler(app);

export default app;
