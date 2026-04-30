// Append-only time series of rating distributions, written by
// scripts/build-exec-snapshot.ts and served as a static asset at
// /rating-history.json. Every cron tick adds (or replaces, if same UTC
// day) one entry. The chart renders gracefully with a single point and
// gets richer as days accumulate.

export interface RatingSnapshotEntry {
  date: string;          // YYYY-MM-DD (UTC)
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
 * per rating. Missing ratings on an entry become 0.
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
    const row: { date: string; label: string; [rating: string]: number | string } = {
      date: s.date,
      label: new Date(`${s.date}T00:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }),
    };
    ratingList.forEach((r) => {
      row[r] = s.ratings[r] || 0;
    });
    return row;
  });

  return { rows, ratings: ratingList };
}
