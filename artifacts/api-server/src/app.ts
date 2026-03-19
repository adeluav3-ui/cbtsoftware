import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes/index.js";  // Added /index.js

const app: Express = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Simple in-memory session middleware
const sessions: Record<string, any> = {};

app.use((req, _res, next) => {
  let sessionId = req.cookies?.["session_id"];

  if (!sessionId || !sessions[sessionId]) {
    sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessions[sessionId] = {};
  }

  (req as any).session = sessions[sessionId];
  (req as any).sessionId = sessionId;

  const origJson = _res.json.bind(_res);
  _res.json = function (body: any) {
    _res.cookie("session_id", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    return origJson(body);
  };

  next();
});

app.use("/api", router);

export default app;