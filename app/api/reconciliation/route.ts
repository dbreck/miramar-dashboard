import { NextResponse } from 'next/server';
import { loadReportHtml } from '@/lib/report-files';
import { requireReconcile } from '@/lib/require-admin';

export async function GET() {
  if (!(await requireReconcile())) {
    return NextResponse.json({ error: 'Reconcile access required' }, { status: 403 });
  }

  const html = await loadReportHtml('reconciliation-report.html');

  if (!html) {
    return new NextResponse(
      '<h1>Report not generated yet</h1><p>Run <code>npm run reconcile</code> to generate the report.</p>',
      { status: 404, headers: { 'Content-Type': 'text/html' } }
    );
  }

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
