import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

export interface StorageAdapter {
  upload(bucket: string, filePath: string, buffer: Buffer, mimeType: string): Promise<string>;
}

export class SupabaseStorage implements StorageAdapter {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set");
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async upload(bucket: string, filePath: string, buffer: Buffer, mimeType: string): Promise<string> {
    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(filePath, buffer, { contentType: mimeType, upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = this.supabase.storage.from(bucket).getPublicUrl(filePath);
    return publicUrl;
  }
}

export class LocalDiskStorage implements StorageAdapter {
  private uploadsDir: string;
  private baseUrl: string;

  constructor(uploadsDir: string, baseUrl: string) {
    this.uploadsDir = uploadsDir;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async upload(bucket: string, filePath: string, buffer: Buffer, _mimeType: string): Promise<string> {
    const dir = path.join(this.uploadsDir, bucket);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filePath), buffer);
    return `${this.baseUrl}/uploads/${bucket}/${filePath}`;
  }
}

let _storage: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (!_storage) {
    if (process.env.DEPLOY_MODE === "local") {
      const port = process.env.PORT ?? "8080";
      const baseUrl = process.env.LOCAL_BASE_URL ?? `http://localhost:${port}`;
      const uploadsDir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
      _storage = new LocalDiskStorage(uploadsDir, baseUrl);
    } else {
      _storage = new SupabaseStorage();
    }
  }
  return _storage;
}

// Absolute path to the uploads directory — used by app.ts for express.static
export function getUploadsDir(): string {
  return process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
}
