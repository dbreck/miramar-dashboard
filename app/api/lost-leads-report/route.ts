import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const htmlPath = join(process.cwd(), 'data', 'lost-leads-report.html');

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
