/**
 * Apply DDL for question_groups feature.
 * Run from repo root: node design/apply-ddl.mjs
 * Safe to re-run (uses IF NOT EXISTS throughout).
 */

import pg from 'pg';
// Run from lib/db: node ../../design/apply-ddl.mjs
// DATABASE_URL from lib/db/.env (loaded by dotenv if present, else hardcoded fallback)
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://postgres.cpgsrgcaxryxrjwtlkcd:CBTSoftware%401004@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const log = s => process.stdout.write(`[${new Date().toLocaleTimeString()}] ${s}\n`);

async function run() {
  await client.connect();
  log('Connected to database');

  // 1. Create question_groups table
  log('Creating question_groups table (IF NOT EXISTS)...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS question_groups (
      id          SERIAL PRIMARY KEY,
      exam_id     INTEGER NOT NULL,
      title       TEXT NOT NULL,
      passage_text TEXT,
      image_url   TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  log('  ✓ question_groups table ready');

  // 2. Create index on exam_id
  log('Creating index question_groups_exam_id_idx (IF NOT EXISTS)...');
  await client.query(`
    CREATE INDEX IF NOT EXISTS question_groups_exam_id_idx
    ON question_groups(exam_id)
  `);
  log('  ✓ index ready');

  // 3. Add question_group_id column to questions (idempotent)
  log('Adding question_group_id column to questions (IF NOT EXISTS)...');
  await client.query(`
    ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS question_group_id INTEGER
  `);
  log('  ✓ questions.question_group_id column ready');

  // 4. Verify
  log('\n=== Verification ===');
  const { rows: tables } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'question_groups'
  `);
  log(`  question_groups table: ${tables.length > 0 ? 'EXISTS ✓' : 'MISSING ✗'}`);

  const { rows: cols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'question_group_id'
  `);
  log(`  questions.question_group_id: ${cols.length > 0 ? 'EXISTS ✓' : 'MISSING ✗'}`);

  const { rows: idxs } = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'question_groups' AND indexname = 'question_groups_exam_id_idx'
  `);
  log(`  question_groups_exam_id_idx: ${idxs.length > 0 ? 'EXISTS ✓' : 'MISSING ✗'}`);

  log('\nDDL applied successfully.');
  await client.end();
}

run().catch(async e => {
  log(`FATAL: ${e.message}`);
  await client.end().catch(() => {});
  process.exit(1);
});
