'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  FileSearch,
  FileSpreadsheet,
  Cookie,
  Activity,
  ArrowLeft,
  Loader2,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { BrandLogo } from '@/lib/branding';
import { useAuth } from '@/lib/auth-provider';

const REPORTS = [
  {
    href: '/api/lost-leads-alltime',
    label: 'Lost Leads Report',
    description: 'All-time CallRail submissions that never reached Spark (Dec 2025 – Mar 2026).',
    Icon: FileSearch,
  },
  {
    href: '/api/contact-comparison',
    label: 'Contact Comparison',
    description: 'Side-by-side CallRail vs Spark for 33 contacts with dates, UTMs, and lag.',
    Icon: FileSpreadsheet,
  },
  {
    href: '/api/utm-cookie-log',
    label: 'UTM Cookies',
    description: 'Live UTM cookie diagnostics synced from the WordPress site.',
    Icon: Cookie,
  },
  {
    href: '/api/spark-relay-log',
    label: 'Relay Health',
    description: 'Form relay success and failure monitoring from the WordPress site.',
    Icon: Activity,
  },
];

export default function AdminPage() {
  const router = useRouter();
  const { isAdmin, isLoading: loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAdmin) router.replace('/');
  }, [loading, isAdmin, router]);

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <BrandLogo size={40} />
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Admin</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  User management and internal operational reports
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 shadow hover:shadow-md transition-all text-gray-700 dark:text-gray-300 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
          </div>
        </div>

        <Link
          href="/admin/users"
          className="block bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6 hover:shadow-xl transition-shadow"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">User Management</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Invite users, set roles and permissions, reset passwords</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Internal Reports</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Admin-only diagnostics. These open in a new tab and are not visible to viewers.
          </p>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {REPORTS.map(({ href, label, description, Icon }) => (
              <li key={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-4 py-3.5 group"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="w-4.5 h-4.5 mt-0.5 text-gray-500 dark:text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
