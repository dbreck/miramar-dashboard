/**
 * Rating Snapshot Types for Mira Mar Project (2855)
 */

export const PROJECT_ID = 2855;

/**
 * Rating ID to name mapping for project 2855
 */
export const RATING_MAP: Record<number, string> = {
  58248: 'Hot',
  58249: 'Warm',
  58755: 'Reservation Holder',
  58250: 'Cold',
  58251: 'Not Interested',
  58245: 'New',
  58246: 'Agent',
  58247: 'Legal',
  58627: 'Team',
  58866: 'Influencer',
  58756: 'Contract Holder',
  59334: 'CB Global Luxury Agent',
  59364: 'Not A Buyer',
  59733: 'Referral',
};

/**
 * A single contact's snapshot record
 */
export interface ContactSnapshot {
  contact_id: number;
  first_name: string;
  last_name: string;
  rating_id: number | null;
  rating_name: string | null;
  registration_source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

/**
 * Full snapshot file structure
 */
export interface Snapshot {
  timestamp: string;       // ISO 8601
  project_id: number;
  total_contacts: number;
  contacts: ContactSnapshot[];
}

/**
 * A detected rating change between snapshots
 */
export interface RatingChange {
  contact_id: number;
  contact_name: string;
  previous_rating_id: number | null;
  previous_rating: string | null;
  new_rating_id: number | null;
  new_rating: string | null;
  changed_at: string;      // ISO 8601 timestamp of detection
  registration_source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

/**
 * Rating changes file structure
 */
export interface RatingChangesFile {
  last_updated: string;
  total_changes: number;
  changes: RatingChange[];
}

/**
 * Summary returned by the snapshot endpoint
 */
export interface SnapshotSummary {
  timestamp: string;
  total_contacts: number;
  new_contacts: number;
  removed_contacts: number;
  rating_changes: number;
  changes: RatingChange[];
  is_first_snapshot: boolean;
  duration_ms: number;
}
