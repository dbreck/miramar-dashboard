import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  const htmlPath = join(process.cwd(), 'data', 'reconciliation-report.html');

  if (!existsSync(htmlPath)) {
    return new NextResponse(
      '<h1>Report not generated yet</h1><p>Run <code>npm run reconcile</code> to generate the report.</p>',
      { status: 404, headers: { 'Content-Type': 'text/html' } }
    );
  }

  const html = readFileSync(htmlPath, 'utf-8');

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
