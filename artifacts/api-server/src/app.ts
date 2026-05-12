import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import { createClient } from "redis";
import RedisStore from "connect-redis";
import helmet from "helmet";
import router from "./routes/index.js";

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

const app: Express = express();

app.set("trust proxy", 1);

// Security headers for every response
app.use(helmet({
  contentSecurityPolicy: false, // API-only server, no HTML served
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: "https://cbtsoftware-cbt-app.vercel.app",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Cap request body at 2 MB to prevent payload abuse
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

app.use(session({
  store: new RedisStore({ client: redisClient }),
  name: "session_id",
  secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use("/api", router);

export default app;
