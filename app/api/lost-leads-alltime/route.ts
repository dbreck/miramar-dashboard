import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  // Auth check: admin only (moved under /admin/reports 2026-10-13)
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role, can_view_llr')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const htmlPath = join(process.cwd(), 'data', 'lost-leads-alltime-report.html');

  if (!existsSync(htmlPath)) {
    return new NextResponse(
      '<h1>Report not generated yet</h1>',
      { status: 404, headers: { 'Content-Type': 'text/html' } }
    );
  }

  const html = readFileSync(htmlPath, 'utf-8');

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
