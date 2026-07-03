// DB driver factory — used by the local server build.
// Production code continues to import from ./index.ts directly.

export async function createDb() {
  if (process.env.DEPLOY_MODE === "local") {
    const { default: Database } = await import("better-sqlite3");
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    const schema = await import("./schema.sqlite.js");

    const dbPath = process.env.SQLITE_PATH ?? "./cbt-local.db";
    const sqlite = new Database(dbPath);
    // WAL mode: concurrent readers don't block writers
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");

    return { db: drizzle(sqlite, { schema }), schema, pool: null };
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
  }
  const pg = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const schema = await import("./schema/index.js");

  const pool = new pg.default.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 3_000,
  });

  return { db: drizzle(pool, { schema }), schema, pool };
}

export type DbContext = Awaited<ReturnType<typeof createDb>>;
