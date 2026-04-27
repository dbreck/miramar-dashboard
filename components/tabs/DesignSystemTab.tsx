'use client';

import { ExternalLink } from 'lucide-react';

const SRC = '/embed/Design%20System.html';

export default function DesignSystemTab() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
            Mira Mar Sarasota
          </p>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-0.5">
            The Brand Edition · v 0.1
          </h2>
        </div>
        <a
          href={SRC}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Open in new tab
        </a>
      </div>
      <iframe
        src={SRC}
        title="Mira Mar Sarasota — Design System"
        className="block w-full bg-white"
        style={{ height: 'calc(100vh - 280px)', minHeight: '720px', border: 0 }}
      />
    </div>
  );
}
