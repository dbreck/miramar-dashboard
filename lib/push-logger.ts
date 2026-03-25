/**
 * Push activity logger
 * Logs all push-to-Spark actions (new contacts + UTM updates) to a JSONL file.
 */

import { promises as fs } from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'data', 'push-log.jsonl');

export interface PushLogEntry {
  action: 'create_contact' | 'update_utm';
  timestamp: string;
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
  try {
    await fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    // Don't let logging failures break the push
    console.error('Push log write failed:', err);
  }
}
