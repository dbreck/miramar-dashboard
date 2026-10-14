/**
 * Who receives the missing-lead alert digest.
 *
 * Source of truth is the Supabase `alert_recipients` table (edited on /admin).
 * If the table is empty, fall back to the LEAD_ALERT_TO env var so the cron
 * never goes silent because someone removed the last address.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function envRecipients(): string[] {
  return (process.env.LEAD_ALERT_TO || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);
}

export async function listAlertRecipients(): Promise<{ email: string; createdAt: string }[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from('alert_recipients')
    .select('email, created_at')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`alert_recipients read failed: ${error.message}`);
  return (data || []).map(r => ({ email: r.email, createdAt: r.created_at }));
}

/** Effective recipient list for a send: table first, env fallback. */
export async function getAlertRecipients(): Promise<{ to: string[]; source: 'table' | 'env' }> {
  const rows = await listAlertRecipients();
  if (rows.length) return { to: rows.map(r => r.email), source: 'table' };
  return { to: envRecipients(), source: 'env' };
}
