/**
 * Upload (or replace) an internal report HTML file in the private Supabase
 * Storage bucket `reports`, which the report routes read via lib/report-files.ts.
 *
 *   npx tsx --env-file=.env.local scripts/upload-report.ts data/lost-leads-report.html [...more]
 */

import { readFileSync } from 'fs';
import { basename } from 'path';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'reports';

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error('Pass one or more file paths.');

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: buckets } = await db.storage.listBuckets();
  if (!buckets?.some(b => b.id === BUCKET)) {
    const { error } = await db.storage.createBucket(BUCKET, { public: false });
    if (error) throw new Error(`createBucket: ${error.message}`);
    console.log(`created private bucket "${BUCKET}"`);
  }

  for (const file of files) {
    const { error } = await db.storage
      .from(BUCKET)
      .upload(basename(file), readFileSync(file), { contentType: 'text/html; charset=utf-8', upsert: true });
    if (error) throw new Error(`${file}: ${error.message}`);
    console.log(`uploaded ${basename(file)}`);
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
