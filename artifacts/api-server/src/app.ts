import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import { createClient } from "redis";
import RedisStore from "connect-redis";
import router from "./routes/index.js";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    role?: string;
    schoolCode?: string | null;
  }
}

const app: Express = express();

app.set("trust proxy", 1);

app.use(cors({
  origin: "https://cbtsoftware-cbt-app.vercel.app",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
