import { NextResponse } from 'next/server';
import { loadReportHtml } from '@/lib/report-files';
import { requireAdmin } from '@/lib/require-admin';

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const html = await loadReportHtml('client-contact-comparison.html');

  if (!html) {
    return new NextResponse(
      '<h1>Report not generated yet</h1><p>The contact comparison report has not been generated.</p>',
      { status: 404, headers: { 'Content-Type': 'text/html' } }
    );
  }

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
