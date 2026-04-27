'use client';

import { ExternalLink } from 'lucide-react';

const SRC = '/embed/Design%20System.html';

export default function DesignSystemPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Mira Mar Sarasota
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">
            Design System
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Brand reference · v 0.1
          </p>
        </div>
        <a
          href={SRC}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3.5 py-2 text-sm rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Open in new tab
        </a>
      </header>
      <div className="rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden bg-white">
        <iframe
          src={SRC}
          title="Mira Mar Sarasota — Design System"
          className="block w-full bg-white"
          style={{ height: 'calc(100vh - 220px)', minHeight: '720px', border: 0 }}
        />
      </div>
    </div>
  );
}
