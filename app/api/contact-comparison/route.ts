import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  const htmlPath = join(process.cwd(), 'data', 'client-contact-comparison.html');

  if (!existsSync(htmlPath)) {
    return new NextResponse(
      '<h1>Report not generated yet</h1><p>The contact comparison report has not been generated.</p>',
      { status: 404, headers: { 'Content-Type': 'text/html' } }
    );
  }

  const html = readFileSync(htmlPath, 'utf-8');

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
