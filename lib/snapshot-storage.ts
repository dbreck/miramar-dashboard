/**
 * Filesystem-based snapshot storage for rating tracking.
 * Runs server-side only (API routes).
 */

import fs from 'fs/promises';
import path from 'path';
import {
  Snapshot,
  RatingChange,
  RatingChangesFile,
} from './rating-types';

const DATA_DIR = path.join(process.cwd(), 'data');
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');
const CHANGES_FILE = path.join(DATA_DIR, 'rating-changes.json');

/**
 * Ensure data directories exist
 */
async function ensureDirs(): Promise<void> {
  await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });
}

/**
 * Generate a filename for a snapshot based on timestamp
 */
function snapshotFilename(timestamp: string): string {
  // Convert ISO timestamp to safe filename: 2026-03-12T14:30:00.000Z -> 2026-03-12T14-30-00-000Z
  const safe = timestamp.replace(/:/g, '-').replace(/\./g, '-');
  return `snapshot-${safe}.json`;
}

/**
 * Save a snapshot to disk
 */
export async function saveSnapshot(snapshot: Snapshot): Promise<string> {
  await ensureDirs();
  const filename = snapshotFilename(snapshot.timestamp);
  const filepath = path.join(SNAPSHOTS_DIR, filename);
  await fs.writeFile(filepath, JSON.stringify(snapshot, null, 2), 'utf-8');
  return filepath;
}

/**
 * Load the most recent snapshot (by filename sort order)
 * Returns null if no snapshots exist
 */
export async function loadLatestSnapshot(): Promise<Snapshot | null> {
  await ensureDirs();

  const files = await fs.readdir(SNAPSHOTS_DIR);
  const snapshotFiles = files
    .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
    .sort(); // Lexicographic sort works because filenames are ISO-date-based

  if (snapshotFiles.length === 0) return null;

  const latestFile = snapshotFiles[snapshotFiles.length - 1];
  const content = await fs.readFile(path.join(SNAPSHOTS_DIR, latestFile), 'utf-8');
  return JSON.parse(content) as Snapshot;
}

/**
 * Load the rating changes file, or return empty structure
 */
export async function loadRatingChanges(): Promise<RatingChangesFile> {
  await ensureDirs();

  try {
    const content = await fs.readFile(CHANGES_FILE, 'utf-8');
    return JSON.parse(content) as RatingChangesFile;
  } catch {
    return {
      last_updated: new Date().toISOString(),
      total_changes: 0,
      changes: [],
    };
  }
}

/**
 * Append new rating changes to the changes file
 */
export async function appendRatingChanges(newChanges: RatingChange[]): Promise<void> {
  if (newChanges.length === 0) return;

  await ensureDirs();
  const existing = await loadRatingChanges();

  existing.changes.push(...newChanges);
  existing.total_changes = existing.changes.length;
  existing.last_updated = new Date().toISOString();

  await fs.writeFile(CHANGES_FILE, JSON.stringify(existing, null, 2), 'utf-8');
}

/**
 * List all snapshot filenames (sorted chronologically)
 */
export async function listSnapshots(): Promise<string[]> {
  await ensureDirs();
  const files = await fs.readdir(SNAPSHOTS_DIR);
  return files
    .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
    .sort();
}

/**
 * Prune old snapshots, keeping only the N most recent
 */
export async function pruneSnapshots(keepCount: number = 30): Promise<number> {
  await ensureDirs();
  const files = await listSnapshots();

  if (files.length <= keepCount) return 0;

  const toDelete = files.slice(0, files.length - keepCount);
  for (const file of toDelete) {
    await fs.unlink(path.join(SNAPSHOTS_DIR, file));
  }

  return toDelete.length;
}
