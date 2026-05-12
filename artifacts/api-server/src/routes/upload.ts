import { Router, Request, Response } from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "express-rate-limit";
import { requireAuth } from "../middlewares/auth.js";

const ALLOWED_BUCKETS = ["profile-pictures", "student-images", "question-images", "school-logos"] as const;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: "Too many upload requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, GIF, and WebP images are allowed"));
    }
  },
});

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const router = Router();

router.post(
  "/",
  uploadLimiter,
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response) => {
    const { bucket } = req.body as { bucket?: string };

    if (!bucket || !(ALLOWED_BUCKETS as readonly string[]).includes(bucket)) {
      res.status(400).json({ error: "Invalid bucket" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    try {
      const supabase = getSupabase();
      const ext = req.file.originalname.split(".").pop() ?? "bin";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (error) {
        console.error("Supabase upload error:", error);
        res.status(500).json({ error: "Upload failed" });
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);

      res.json({ url: publicUrl });
    } catch (err) {
      console.error("Upload route error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

export default router;
