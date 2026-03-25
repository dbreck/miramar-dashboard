/**
 * Push UTM fields to existing Spark contacts (for UTM gap contacts)
 *
 * POST /api/reconciliation/push-utm
 * Body: { contacts: [{ sparkContactId, utmSource, utmMedium, utmCampaign }] }
 */

import { NextRequest, NextResponse } from 'next/server';

const SPARK_API_KEY = process.env.SPARK_API_KEY!;

const UTM_FIELD_IDS = {
  utm_source: 22408,
  utm_medium: 22409,
  utm_campaign: 22410,
};

interface UtmPushContact {
  sparkContactId: number;
  name: string;
  email: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}

interface PushResult {
  email: string;
  name: string;
  sparkContactId: number;
  success: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const contacts: UtmPushContact[] = body.contacts || [];

    if (contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts provided' }, { status: 400 });
    }

    if (contacts.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 contacts per request' }, { status: 400 });
    }

    const results: PushResult[] = [];

    // Process in batches of 3 to avoid rate limits
    for (let i = 0; i < contacts.length; i += 3) {
      const batch = contacts.slice(i, i + 3);
      const batchResults = await Promise.all(
        batch.map(async (c) => {
          try {
            // Build custom field values - only include non-empty UTM fields
            const customFields: { custom_field_id: number; value: string }[] = [];
            if (c.utmSource && c.utmSource !== '(direct)' && c.utmSource !== '(none)') {
              customFields.push({ custom_field_id: UTM_FIELD_IDS.utm_source, value: c.utmSource });
            }
            if (c.utmMedium && c.utmMedium !== '(none)') {
              customFields.push({ custom_field_id: UTM_FIELD_IDS.utm_medium, value: c.utmMedium });
            }
            if (c.utmCampaign && c.utmCampaign !== '(none)') {
              customFields.push({ custom_field_id: UTM_FIELD_IDS.utm_campaign, value: c.utmCampaign });
            }

            if (customFields.length === 0) {
              return {
                email: c.email,
                name: c.name,
                sparkContactId: c.sparkContactId,
                success: false,
                error: 'No UTM values to push',
              };
            }

            const res = await fetch(`https://api.spark.re/v2/contacts/${c.sparkContactId}`, {
              method: 'PUT',
              headers: {
                Authorization: `Token token=${SPARK_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ custom_field_values: customFields }),
            });

            if (!res.ok) {
              const errText = await res.text();
              return {
                email: c.email,
                name: c.name,
                sparkContactId: c.sparkContactId,
                success: false,
                error: `Spark API ${res.status}: ${errText}`,
              };
            }

            return {
              email: c.email,
              name: c.name,
              sparkContactId: c.sparkContactId,
              success: true,
            };
          } catch (err: any) {
            return {
              email: c.email,
              name: c.name,
              sparkContactId: c.sparkContactId,
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

    return NextResponse.json({
      summary: { total: results.length, succeeded, failed },
      results,
    });
  } catch (error: any) {
    console.error('Push UTM error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
