/**
 * Admin CRUD for missing-lead alert recipients.
 *
 * GET    -> { recipients: [{email, createdAt}], fallback: string[] }
 * POST   { email }                  -> add
 * POST   { email, action: 'test' }  -> send a test digest to that one address
 * DELETE { email }                  -> remove
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { EMAIL_RE, envRecipients, listAlertRecipients, normalizeEmail } from '@/lib/alert-recipients';
import { alertHtml, sendAlertEmail } from '@/lib/lead-alert-email';
import type { ReconContact } from '@/lib/reconciliation';

async function readEmail(request: NextRequest): Promise<{ email: string; action?: string } | NextResponse> {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(String(body?.email || ''));
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  return { email, action: body?.action };
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  try {
    return NextResponse.json({ recipients: await listAlertRecipients(), fallback: envRecipients() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const parsed = await readEmail(request);
  if (parsed instanceof NextResponse) return parsed;
  const { email, action } = parsed;

  if (action === 'test') {
    const sample: ReconContact = {
      email: 'sample.lead@example.com',
      name: 'Sample Lead',
      phone: '(941) 555-0100',
      callrailSource: 'Facebook Ads',
      callrailUtmSource: 'meta',
      callrailUtmMedium: 'cpc',
      callrailUtmCampaign: 'prospecting_sarasota',
      submittedAt: new Date().toISOString(),
      formType: 'Other',
      formUrl: 'https://miramarsarasota.com/reserve/',
      submissionCount: 1,
      inSpark: false,
      sparkContactId: null,
      sparkRating: '',
      sparkEmail: '',
      sparkUtmSource: '',
      sparkUtmMedium: '',
      sparkUtmCampaign: '',
      hasPaidSource: true,
      hasUtmGap: false,
      likelyCause: 'Form submission failure',
      captureGaps: ['How did you hear about us'],
      matchMethod: 'none',
      warnings: [],
      callrailZip: '34236',
      callrailHowHeard: '',
      callrailComments: 'This is a test of the missing-lead alert. No action needed.',
      callrailIsAgent: false,
      callrailBrokerage: '',
    };
    try {
      const dashboardUrl = (process.env.DASHBOARD_URL || new URL(request.url).origin).replace(/\/$/, '');
      const { id } = await sendAlertEmail({
        to: [email],
        subject: 'TEST: Mira Mar missing lead alert',
        html: alertHtml({ newMissing: [sample], resolved: [], windowLabel: 'test message', dashboardUrl }),
      });
      return NextResponse.json({ ok: true, id });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
  }

  const db = createAdminClient();
  const { error } = await db
    .from('alert_recipients')
    .upsert({ email, added_by: session.userId }, { onConflict: 'email' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, recipients: await listAlertRecipients() });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const parsed = await readEmail(request);
  if (parsed instanceof NextResponse) return parsed;

  const db = createAdminClient();
  const { error } = await db.from('alert_recipients').delete().eq('email', parsed.email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, recipients: await listAlertRecipients() });
}
