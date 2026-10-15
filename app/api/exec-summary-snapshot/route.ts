/**
 * Executive summary snapshot for signed-in users.
 *
 * The snapshot carries reservation buyer names and prices, so it lives in the
 * private Supabase Storage bucket `snapshots` (written by
 * scripts/build-exec-snapshot.ts) instead of public/ in this public repo.
 * Any signed-in dashboard user may read it; the Spark Reporting tabs and the
 * Executive Summary page both depend on it.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { data, error } = await createAdminClient().storage.from('snapshots').download('exec-summary-snapshot.json');
  if (error || !data) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });

  return new NextResponse(await data.text(), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
}
