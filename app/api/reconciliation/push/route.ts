/**
 * Push missing contacts to Spark via form submission
 *
 * POST /api/reconciliation/push
 * Body: { contacts: [{ name, email, phone, callrailSource, utmSource, utmMedium, utmCampaign, zip, howHeard, comments, isAgent, brokerage }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireReconcile } from '@/lib/require-admin';
import { logPush } from '@/lib/push-logger';
import { mapMarketingSource, pinRatingByEmail, AUTO_PUSH_RATING_ID } from '@/lib/spark-push';
import { SparkAPIClient } from '@/lib/spark-client';

export const maxDuration = 60;

const SPARK_FORM_URL = 'https://spark.re/mira-mar-acquisitions-company-llc/mira-mar/register/inquire-form';

interface PushContact {
  name: string;
  email: string;
  phone: string;
  callrailSource: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  zip: string;
  howHeard: string;
  comments: string;
  isAgent: boolean;
  brokerage: string;
  /** Per-contact reCAPTCHA v3 token. Tokens are single-use, so each contact needs its own. */
  recaptchaToken?: string;
}

interface PushResult {
  email: string;
  name: string;
  success: boolean;
  sparkId?: number;
  error?: string;
  /** Rating forced to New (58245) after the form submission. */
  ratingPinned?: boolean;
  /** Set when the submission succeeded but the rating could not be pinned. */
  warning?: string;
}

export async function POST(request: NextRequest) {
  const caller = await requireReconcile();
  if (!caller) {
    return NextResponse.json({ error: 'Reconcile access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const contacts: PushContact[] = body.contacts || [];
    // Legacy single token (pre per-contact tokens); only valid for the first contact.
    const sharedRecaptchaToken: string = body.recaptchaToken || '';

    if (contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts provided' }, { status: 400 });
    }

    if (contacts.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 contacts per request' }, { status: 400 });
    }

    const results: PushResult[] = [];
    const sparkClient = process.env.SPARK_API_KEY ? new SparkAPIClient(process.env.SPARK_API_KEY) : null;

    // Process in batches of 3 to avoid rate limits
    for (let i = 0; i < contacts.length; i += 3) {
      const batch = contacts.slice(i, i + 3);
      const batchResults = await Promise.all(
        batch.map(async (c) => {
          try {
            // Split name into first/last
            const nameParts = c.name.trim().split(/\s+/);
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            // Build form-encoded body
            const formData = new URLSearchParams();
            formData.set('contact[first_name]', firstName);
            formData.set('contact[last_name]', lastName);
            formData.set('contact[email]', c.email);
            formData.set('contact[phone]', c.phone);

            if (c.zip) formData.set('contact[postcode]', c.zip);
            if (c.comments) formData.set('contact[comments]', c.comments);
            if (c.howHeard) formData.set('answers[24470][answers]', c.howHeard);

            // Agent flag
            formData.set('agent', c.isAgent ? 'true' : 'false');
            if (c.isAgent && c.brokerage) {
              formData.set('contact[brokerage_name]', c.brokerage);
            }

            // Marketing source
            const marketingSource = mapMarketingSource(c.callrailSource);
            if (marketingSource) {
              formData.set('source', marketingSource);
            } else {
              formData.set('source', 'Reconciliation Import');
            }

            // UTM custom fields
            if (c.utmSource && c.utmSource !== '(direct)' && c.utmSource !== '(none)') {
              formData.set('contact[custom_fields_attributes][22408][value]', c.utmSource);
              formData.set('contact[custom_fields_attributes][22408][template_id]', '22408');
            }
            if (c.utmMedium && c.utmMedium !== '(none)') {
              formData.set('contact[custom_fields_attributes][22409][value]', c.utmMedium);
              formData.set('contact[custom_fields_attributes][22409][template_id]', '22409');
            }
            if (c.utmCampaign && c.utmCampaign !== '(none)') {
              formData.set('contact[custom_fields_attributes][22410][value]', c.utmCampaign);
              formData.set('contact[custom_fields_attributes][22410][template_id]', '22410');
            }

            // reCAPTCHA token (generated in admin's browser, one per contact)
            const recaptchaToken = c.recaptchaToken || sharedRecaptchaToken;
            if (recaptchaToken) {
              formData.set('g-recaptcha-response', recaptchaToken);
            }

            // Redirects (for success detection)
            formData.set('redirect_success', 'https://miramarsarasota.com/thank-you');
            formData.set('redirect_error', 'https://miramarsarasota.com/form-error');

            const res = await fetch(SPARK_FORM_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: formData.toString(),
              redirect: 'manual', // Don't follow redirects — check Location header
            });

            // Spark returns 302 redirect on both success and failure
            const location = res.headers.get('location') || '';
            const isSuccess = res.status === 302 && location.includes('thank-you');

            if (!isSuccess) {
              let detail = '';
              if (location.includes('form-error')) {
                detail = recaptchaToken
                  ? 'Spark rejected the submission (form-error redirect)'
                  : 'Spark rejected the submission — no reCAPTCHA token was generated in your browser';
              } else if (res.status !== 302) {
                const text = await res.text().catch(() => '');
                detail = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
              }
              return {
                email: c.email,
                name: c.name,
                success: false,
                error: `Spark form ${res.status}: redirected to ${location || '(no location)'}${detail ? ` — ${detail}` : ''}`,
              };
            }

            // The form takes Spark's default rating; pin it to New so manual
            // pushes match the cron's auto-push (Heather, 2026-10-15).
            const result: PushResult = { email: c.email, name: c.name, success: true };
            if (sparkClient) {
              const pin = await pinRatingByEmail(sparkClient, c.email, AUTO_PUSH_RATING_ID);
              result.sparkId = pin.sparkContactId;
              result.ratingPinned = pin.pinned;
              if (!pin.pinned) result.warning = `Created, but rating not pinned to New: ${pin.error}`;
            } else {
              result.ratingPinned = false;
              result.warning = 'Created, but rating not pinned to New: SPARK_API_KEY is not set';
            }
            return result;
          } catch (err: any) {
            return {
              email: c.email,
              name: c.name,
              success: false,
              error: err.message,
            };
          }
        })
      );
      results.push(...batchResults);

      // Delay between batches
      if (i + 3 < contacts.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    // Log the push for audit trail
    await logPush({
      action: 'create_contact',
      timestamp: new Date().toISOString(),
      actor: `${caller.userId}${contacts.every(c => c.recaptchaToken || sharedRecaptchaToken) ? '' : ' (missing recaptcha token)'}`,
      contacts: results.map((r, i) => ({
        name: r.name,
        email: r.email,
        sparkContactId: r.sparkId,
        success: r.success,
        error: r.error ?? r.warning,
        utmSource: contacts[i]?.utmSource,
        utmMedium: contacts[i]?.utmMedium,
        utmCampaign: contacts[i]?.utmCampaign,
        callrailSource: contacts[i]?.callrailSource,
        zip: contacts[i]?.zip,
        howHeard: contacts[i]?.howHeard,
        comments: contacts[i]?.comments,
        isAgent: contacts[i]?.isAgent,
        brokerage: contacts[i]?.brokerage,
      })),
      summary: { total: results.length, succeeded, failed },
    });

    return NextResponse.json({
      summary: { total: results.length, succeeded, failed },
      results,
    });
  } catch (error: any) {
    console.error('Push error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
