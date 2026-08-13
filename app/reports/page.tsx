'use client';

import ReportsTab from '@/components/tabs/ReportsTab';

export default function ReportsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          Mira Mar Sarasota
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">
          Reports
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Marketing performance editions
        </p>
      </header>
      <ReportsTab />
    </div>
  );
}
