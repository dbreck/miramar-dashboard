/**
 * Static internal report HTML (lost leads, contact comparison, reconciliation).
 *
 * These files contain lead names, emails and phone numbers, so they are not in
 * git (the repo is public). Production reads them from the private Supabase
 * Storage bucket `reports` via the service-role client; local dev falls back
 * to `data/<name>` on disk. Upload or replace a report with:
 *   npx tsx --env-file=.env.local scripts/upload-report.ts data/<name>.html
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'reports';

export async function loadReportHtml(name: string): Promise<string | null> {
  try {
    const { data, error } = await createAdminClient().storage.from(BUCKET).download(name);
    if (!error && data) return await data.text();
  } catch {
    /* fall through to local file */
  }
  const local = join(process.cwd(), 'data', name);
  return existsSync(local) ? readFileSync(local, 'utf-8') : null;
}
