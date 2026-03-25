/**
 * Push missing contacts to Spark
 *
 * POST /api/reconciliation/push
 * Body: { contacts: [{ name, email, phone, marketingSource, utmSource, utmMedium, utmCampaign }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { logPush } from '@/lib/push-logger';

const SPARK_API_KEY = process.env.SPARK_API_KEY!;

const UTM_FIELD_IDS = {
  utm_source: 22408,
  utm_medium: 22409,
  utm_campaign: 22410,
};

// Map CallRail source names to Spark marketing_source values
function mapMarketingSource(callrailSource: string): string {
  const s = callrailSource.toLowerCase();
  if (s.includes('facebook')) return 'Facebook';
  if (s.includes('instagram')) return 'Instagram';
  if (s.includes('google ads')) return 'Google';
  if (s.includes('google organic')) return 'Google';
  if (s.includes('duckduck')) return 'DuckDuckGo';
  if (s.includes('miramarsarasota')) return 'Website';
  return '';
}

interface PushContact {
  name: string;
  email: string;
  phone: string;
  callrailSource: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}

interface PushResult {
  email: string;
  name: string;
  success: boolean;
  sparkId?: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const contacts: PushContact[] = body.contacts || [];

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
            // Split name into first/last
            const nameParts = c.name.trim().split(/\s+/);
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            // Build request body
            const sparkBody: Record<string, any> = {
              first_name: firstName,
              last_name: lastName,
              email: c.email,
              phone: c.phone,
            };

            // Add marketing source
            const marketingSource = mapMarketingSource(c.callrailSource);
            if (marketingSource) {
              sparkBody.marketing_source = marketingSource;
            }

            // Add UTM custom fields if present
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
            if (customFields.length > 0) {
              sparkBody.custom_field_values = customFields;
            }

            const res = await fetch('https://api.spark.re/v2/contacts', {
              method: 'POST',
              headers: {
                Authorization: `Token token=${SPARK_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(sparkBody),
            });

            if (!res.ok) {
              const errText = await res.text();
              return {
                email: c.email,
                name: c.name,
                success: false,
                error: `Spark API ${res.status}: ${errText}`,
              };
            }

            const data = await res.json();
            return {
              email: c.email,
              name: c.name,
              success: true,
              sparkId: data.id,
            };
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
      contacts: results.map((r, i) => ({
        name: r.name,
        email: r.email,
        sparkContactId: r.sparkId,
        success: r.success,
        error: r.error,
        utmSource: contacts[i]?.utmSource,
        utmMedium: contacts[i]?.utmMedium,
        utmCampaign: contacts[i]?.utmCampaign,
        callrailSource: contacts[i]?.callrailSource,
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
