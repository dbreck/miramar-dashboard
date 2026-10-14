/**
 * Live CallRail / Spark Reconciliation API
 *
 * Thin auth wrapper over `lib/reconciliation.ts`, which does the CallRail pull
 * and Spark matching. The same core powers the missing-lead alert cron.
 *
 * GET /api/reconciliation/live?start=2026-03-01&end=2026-03-24
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireReconcile } from '@/lib/require-admin';
import { callrailConfigured, runReconciliation } from '@/lib/reconciliation';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!(await requireReconcile())) {
    return NextResponse.json({ error: 'Reconcile access required' }, { status: 403 });
  }

  if (!callrailConfigured()) {
    return NextResponse.json(
      { error: 'CALLRAIL_API_TOKEN is not configured. Set it in Vercel and .env.local.' },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start') || undefined;
  const endDate = searchParams.get('end') || undefined;

  try {
    const result = await runReconciliation(startDate, endDate);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Reconciliation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
