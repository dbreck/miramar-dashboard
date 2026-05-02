// Append-only time series of rating distributions, written by
// scripts/build-exec-snapshot.ts and served as a static asset at
// /rating-history.json. Cron runs twice daily (10:00 and 22:00 UTC), so
// each day produces an `am` and a `pm` entry. The dedup key in the build
// script is `${date}-${slot}`. Older entries (pre-twice-daily) have no
// `slot` field and are treated as `am` for backward compatibility.

export type RatingSlot = 'am' | 'pm';

export interface RatingSnapshotEntry {
  date: string;          // YYYY-MM-DD (UTC)
  slot?: RatingSlot;     // optional for backward compat; absent = am
  snapshotAt: string;    // ISO timestamp the build script ran at
  totalContacts: number;
  ratings: Record<string, number>; // { Hot: 2, Warm: 57, Cold: 281, ... }
}

export interface RatingHistoryPayload {
  version: number;
  lastUpdated: string;
  snapshots: RatingSnapshotEntry[];
}

/**
 * Flatten the time series for Recharts: one row per snapshot with a column
 * per rating. Missing ratings on an entry become 0. Labels distinguish the
 * morning and evening snapshots so two same-day points don't collide on
 * the x-axis.
 */
export function ratingHistorySeries(
  payload: RatingHistoryPayload,
): { rows: { date: string; label: string; [rating: string]: number | string }[]; ratings: string[] } {
  const ratings = new Set<string>();
  payload.snapshots.forEach((s) => {
    Object.keys(s.ratings).forEach((r) => ratings.add(r));
  });
  const ratingList = Array.from(ratings);

  const rows = payload.snapshots.map((s) => {
    const slot: RatingSlot = s.slot ?? 'am';
    const dayLabel = new Date(`${s.date}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const row: { date: string; label: string; [rating: string]: number | string } = {
      date: s.date,
      label: `${dayLabel} ${slot}`,
    };
    ratingList.forEach((r) => {
      row[r] = s.ratings[r] || 0;
    });
    return row;
  });

  return { rows, ratings: ratingList };
}
