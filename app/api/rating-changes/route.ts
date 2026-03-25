import { NextResponse } from 'next/server';
import { loadRatingChanges } from '@/lib/snapshot-storage';
import { RatingChange } from '@/lib/rating-types';

/**
 * GET /api/rating-changes
 *
 * Returns accumulated rating change history with optional filters:
 *   - start: ISO date string (filter changes on or after this date)
 *   - end: ISO date string (filter changes on or before this date)
 *   - rating: comma-separated rating names to filter TO (e.g., "Hot,Warm,Reservation Holder")
 *   - source: comma-separated registration source names to include
 *   - from_rating: comma-separated rating names to filter FROM
 *   - limit: max number of results (default: 500)
 *   - offset: skip first N results (for pagination)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const ratingParam = searchParams.get('rating');
    const fromRatingParam = searchParams.get('from_rating');
    const sourceParam = searchParams.get('source');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const limit = limitParam ? parseInt(limitParam, 10) : 500;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    const changesFile = await loadRatingChanges();
    let filtered: RatingChange[] = changesFile.changes;

    // Filter by date range
    if (startParam) {
      const startDate = new Date(startParam);
      filtered = filtered.filter(c => new Date(c.changed_at) >= startDate);
    }
    if (endParam) {
      const endDate = new Date(endParam);
      filtered = filtered.filter(c => new Date(c.changed_at) <= endDate);
    }

    // Filter by new rating (changed TO)
    if (ratingParam) {
      const ratings = ratingParam.split(',').map(r => r.trim().toLowerCase());
      filtered = filtered.filter(c =>
        c.new_rating !== null && ratings.includes(c.new_rating.toLowerCase())
      );
    }

    // Filter by previous rating (changed FROM)
    if (fromRatingParam) {
      const fromRatings = fromRatingParam.split(',').map(r => r.trim().toLowerCase());
      filtered = filtered.filter(c =>
        c.previous_rating !== null && fromRatings.includes(c.previous_rating.toLowerCase())
      );
    }

    // Filter by registration source
    if (sourceParam) {
      const sources = sourceParam.split(',').map(s => s.trim().toLowerCase());
      filtered = filtered.filter(c =>
        c.registration_source !== null && sources.includes(c.registration_source.toLowerCase())
      );
    }

    // Sort by changed_at descending (most recent first)
    filtered.sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

    const total = filtered.length;

    // Apply pagination
    const paginated = filtered.slice(offset, offset + limit);

    // Build summary stats
    const ratingTransitions: Record<string, number> = {};
    filtered.forEach(c => {
      const from = c.previous_rating || 'None';
      const to = c.new_rating || 'None';
      const key = `${from} -> ${to}`;
      ratingTransitions[key] = (ratingTransitions[key] || 0) + 1;
    });

    // Rating change counts by new rating
    const changesByNewRating: Record<string, number> = {};
    filtered.forEach(c => {
      const key = c.new_rating || 'None';
      changesByNewRating[key] = (changesByNewRating[key] || 0) + 1;
    });

    return NextResponse.json({
      total,
      offset,
      limit,
      returned: paginated.length,
      last_updated: changesFile.last_updated,
      summary: {
        total_changes: total,
        by_new_rating: changesByNewRating,
        transitions: ratingTransitions,
      },
      changes: paginated,
    });
  } catch (error: any) {
    console.error('Rating changes error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to read rating changes' },
      { status: 500 }
    );
  }
}
