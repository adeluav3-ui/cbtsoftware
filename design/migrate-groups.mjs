/**
 * Step 3 — Backfill migration: populate question_groups from denormalized question fields.
 *
 * Uses the Supabase REST API (not direct pg) because Node.js DNS resolution
 * for the Supabase pooler host is flaky on this machine.
 *
 * Safety guarantees:
 *  - Reads existing (exam_id, group_id) pairs from questions
 *  - Inserts one question_groups row per distinct group (idempotent — skips if already exists)
 *  - Updates questions.question_group_id with the new FK
 *  - Does NOT touch any other columns
 *  - Does NOT drop or overwrite legacy group_id / group_title / group_text / group_image_url
 *
 * Run AFTER drizzle-kit push has created the question_groups table and
 * questions.question_group_id column.
 *
 * node design/migrate-groups.mjs
 */

const BASE    = 'https://cpgsrgcaxryxrjwtlkcd.supabase.co/rest/v1';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZ3NyZ2NheHJ5eHJqd3Rsa2NkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg5NjA0NSwiZXhwIjoyMDg5NDcyMDQ1fQ.inMImxOa0ciudsTL69bLfnoY6HJbgsUoH_tUBbCborI';

const headers = (extra = {}) => ({
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...extra,
});

const log = s => process.stdout.write(`[${new Date().toLocaleTimeString()}] ${s}\n`);

async function get(path, params = '') {
  const r = await fetch(`${BASE}${path}${params}`, { headers: headers({ Prefer: 'count=exact' }) });
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

async function patch(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

async function run() {
  // ── 1. Check that question_groups table exists ───────────────────────────
  log('Checking question_groups table exists...');
  try {
    await get('/question_groups', '?limit=1');
    log('  ✓ question_groups table exists');
  } catch (e) {
    log(`  ✗ question_groups table not found: ${e.message}`);
    log('  Run drizzle-kit push first, then re-run this script.');
    process.exit(1);
  }

  // ── 2. Fetch all grouped questions (those with legacy group_id set) ──────
  log('Fetching all questions with group_id set...');
  const grouped = await get(
    '/questions',
    '?group_id=not.is.null&select=id,exam_id,group_id,group_title,group_text,group_image_url,group_order,question_group_id&order=exam_id,group_id,group_order,id&limit=2000'
  );
  log(`  Found ${grouped.length} grouped questions across exams`);

  if (grouped.length === 0) {
    log('Nothing to migrate.');
    return;
  }

  // ── 3. Build map of distinct (exam_id, legacy_group_id) → representative row ─
  const distinctGroups = new Map(); // key: "examId:legacyGroupId"
  const minIdByGroup = new Map();   // key: "examId:legacyGroupId" → min question.id

  for (const q of grouped) {
    const key = `${q.exam_id}:${q.group_id}`;
    if (!distinctGroups.has(key)) {
      distinctGroups.set(key, q);
      minIdByGroup.set(key, q.id);
    } else {
      if (q.id < minIdByGroup.get(key)) minIdByGroup.set(key, q.id);
    }
  }

  log(`  Distinct groups to migrate: ${distinctGroups.size}`);

  // ── 4. Fetch existing question_groups rows (idempotency) ─────────────────
  log('Fetching existing question_groups rows...');
  const existingGroups = await get('/question_groups', '?select=id,exam_id,title&limit=2000');
  // Key by examId + title for matching (not perfect but sufficient since titles are unique per exam)
  const existingSet = new Set(existingGroups.map(g => `${g.exam_id}:${g.title}`));
  const existingByExamTitle = new Map(existingGroups.map(g => [`${g.exam_id}:${g.title}`, g]));
  log(`  Found ${existingGroups.length} existing question_groups rows`);

  // ── 5. Insert question_groups rows and map legacy → new ids ──────────────
  // legacyKey → new question_groups.id
  const legacyToNewId = new Map();

  // First, fill in from existing rows (idempotency: reuse if already created)
  for (const [key, q] of distinctGroups) {
    const title = (q.group_title || `Group ${q.group_id}`).trim();
    const existKey = `${q.exam_id}:${title}`;
    if (existingByExamTitle.has(existKey)) {
      const existing = existingByExamTitle.get(existKey);
      legacyToNewId.set(key, existing.id);
      log(`  Reusing existing group id=${existing.id} for ${existKey}`);
    }
  }

  // Insert missing groups
  let inserted = 0;
  for (const [key, q] of distinctGroups) {
    if (legacyToNewId.has(key)) continue; // already mapped

    const title = (q.group_title || `Group ${q.group_id}`).trim();
    const displayOrder = minIdByGroup.get(key); // preserves creation-order sort

    const [newGroup] = await post('/question_groups', [{
      exam_id: q.exam_id,
      title,
      passage_text: q.group_text || null,
      image_url: q.group_image_url || null,
      display_order: displayOrder,
    }]);

    legacyToNewId.set(key, newGroup.id);
    log(`  Created question_groups id=${newGroup.id}: exam ${q.exam_id} "${title}" (display_order=${displayOrder})`);
    inserted++;
  }

  log(`  Inserted ${inserted} new question_groups rows`);

  // ── 6. Update questions.question_group_id where not already set ──────────
  log('Updating questions.question_group_id...');
  let updated = 0;
  let skipped = 0;

  for (const q of grouped) {
    if (q.question_group_id !== null) {
      skipped++;
      continue; // already migrated
    }

    const key = `${q.exam_id}:${q.group_id}`;
    const newId = legacyToNewId.get(key);
    if (!newId) {
      log(`  ⚠ No new group id for question ${q.id} (key=${key}) — skipping`);
      continue;
    }

    await patch(`/questions?id=eq.${q.id}`, { question_group_id: newId });
    updated++;
  }

  log(`  Updated ${updated} questions.question_group_id`);
  log(`  Skipped ${skipped} already-migrated questions`);

  // ── 7. Verification ───────────────────────────────────────────────────────
  log('\n=== Verification ===');

  const stillNull = await get(
    '/questions',
    '?group_id=not.is.null&question_group_id=is.null&select=id&limit=10'
  );
  if (stillNull.length === 0) {
    log('  ✓ All grouped questions now have question_group_id set');
  } else {
    log(`  ⚠ ${stillNull.length} grouped questions still have question_group_id=null (first 10 ids: ${stillNull.map(q => q.id).join(', ')})`);
  }

  const totalGroups = await get('/question_groups', '?select=id&limit=1');
  log(`  question_groups rows: ${(await get('/question_groups', '?select=count')).length > 0 ? 'present' : '0'}`);

  const allGroups = await get('/question_groups', '?select=id,exam_id,title,display_order&order=exam_id,display_order&limit=100');
  log('\n  question_groups table contents:');
  for (const g of allGroups) {
    log(`    id=${g.id} exam=${g.exam_id} "${g.title}" display_order=${g.display_order}`);
  }

  log('\nMigration complete.');
}

run().catch(e => { log(`FATAL: ${e.message}`); process.exit(1); });
