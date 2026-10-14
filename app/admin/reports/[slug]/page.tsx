'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';
import { findAdminReport } from '@/lib/admin-reports';

export default function AdminReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { isAdmin, isLoading } = useAuth();
  const report = findAdminReport(slug);

  useEffect(() => {
    if (!isLoading && (!isAdmin || !report)) router.replace('/admin');
  }, [isLoading, isAdmin, report, router]);

  if (isLoading || !isAdmin || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Admin
          </Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white truncate">{report.label}</h1>
        </div>
        <a
          href={report.api}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          title="Open full-window"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Full window</span>
        </a>
      </div>
      <iframe
        src={report.api}
        title={report.label}
        className="flex-1 w-full border-0 bg-white"
      />
    </div>
  );
}
