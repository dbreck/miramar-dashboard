'use client';

import { DollarSign, Users, Receipt, CalendarRange, type LucideIcon } from 'lucide-react';
import { GLANCE } from '@/lib/lead-inquiry-data';

const ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  spend: { icon: DollarSign, color: '#eb6834' },
  leads: { icon: Users, color: '#2a78d6' },
  cpl: { icon: Receipt, color: '#c33a32' },
  contacts: { icon: CalendarRange, color: '#1baf7a' },
};

/** Stat tiles in the StatCard visual language (left accent, icon top-right), sized for phones. */
export default function GlanceTiles() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {GLANCE.map((g) => {
        const { icon: Icon, color } = ICONS[g.id];
        return (
          <div
            key={g.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border-l-4"
            style={{ borderColor: color }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">{g.label}</div>
              <Icon className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
              <span className="text-lg font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
                {g.from}
              </span>
              <span className="text-gray-400" aria-hidden="true">→</span>
              <span className="sr-only">to</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {g.to}
              </span>
              {g.change && (
                <span className="ml-1 rounded-md bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  {g.change}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{g.meaning}</p>
          </div>
        );
      })}
    </div>
  );
}
