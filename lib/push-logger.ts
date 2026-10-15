/**
 * Push activity logger
 * Logs all push-to-Spark actions (new contacts + UTM updates) to a JSONL file
 * and always echoes a compact summary to stdout so Vercel runtime logs capture
 * per-contact Spark errors (the file is ephemeral on Vercel: /tmp only).
 */

import { promises as fs } from 'fs';
import path from 'path';

const LOG_FILE = process.env.VERCEL
  ? path.join('/tmp', 'push-log.jsonl')
  : path.join(process.cwd(), 'data', 'push-log.jsonl');

export interface PushLogEntry {
  action: 'create_contact' | 'update_utm';
  timestamp: string;
  actor?: string;
  contacts: {
    name: string;
    email: string;
    sparkContactId?: number;
    success: boolean;
    error?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    callrailSource?: string;
  }[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

export async function logPush(entry: PushLogEntry): Promise<void> {
  // Always log to stdout — this is the only durable record on Vercel.
  console.log(
    '[push]',
    JSON.stringify({
      action: entry.action,
      actor: entry.actor,
      summary: entry.summary,
      contacts: entry.contacts.map(c => ({
        email: c.email,
        success: c.success,
        error: c.error,
        sparkContactId: c.sparkContactId,
      })),
    })
  );

  try {
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    await fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    // Don't let logging failures break the push
    console.error('Push log write failed:', err);
  }
}
