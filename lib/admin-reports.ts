/**
 * Internal, admin-only reports. Each is served as HTML by an /api route that
 * is gated by requireAdmin(); the /admin/reports/<slug> page frames it inside
 * the app shell so it sits under the middleware access-control umbrella.
 */
export type AdminReport = {
  slug: string;
  label: string;
  description: string;
  api: string;
};

export const ADMIN_REPORTS: AdminReport[] = [
  {
    slug: 'lost-leads',
    label: 'Lost Leads Report',
    description: 'All-time CallRail submissions that never reached Spark (Dec 2025 – Mar 2026).',
    api: '/api/lost-leads-alltime',
  },
  {
    slug: 'contact-comparison',
    label: 'Contact Comparison',
    description: 'Side-by-side CallRail vs Spark for 33 contacts with dates, UTMs, and lag.',
    api: '/api/contact-comparison',
  },
  {
    slug: 'utm-cookies',
    label: 'UTM Cookies',
    description: 'Live UTM cookie diagnostics synced from the WordPress site.',
    api: '/api/utm-cookie-log',
  },
  {
    slug: 'relay-health',
    label: 'Relay Health',
    description: 'Form relay success and failure monitoring from the WordPress site.',
    api: '/api/spark-relay-log',
  },
];

export function findAdminReport(slug: string): AdminReport | undefined {
  return ADMIN_REPORTS.find((r) => r.slug === slug);
}
