'use client';

import { Filter, RefreshCw } from 'lucide-react';
import DateRangePicker, { DateRange } from './DateRangePicker';
import FilterPanel from './FilterPanel';
import { useFilters } from '@/lib/filter-context';

type TabId = 'overview' | 'marketing' | 'ratings' | 'reports';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  onRefresh?: () => void;
  lastFetchedAt?: number | null;
  isCached?: boolean;
  isRefreshing?: boolean;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DashboardLayout({
  children,
  activeTab,
  setActiveTab,
  dateRange,
  setDateRange,
  onRefresh,
  lastFetchedAt,
  isCached,
  isRefreshing,
}: DashboardLayoutProps) {
  const { isFilterPanelOpen, setFilterPanelOpen, getActiveFilterCount } = useFilters();
  const activeFilterCount = getActiveFilterCount();

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'ratings', label: 'Ratings' },
    { id: 'reports', label: 'Reports' },
  ];

  const isDataTab = activeTab !== 'reports';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Title */}
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Mira Mar Sarasota
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">
            Spark Reporting
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Lead generation analytics
          </p>
        </div>

        {/* Page-level controls */}
        <div className="flex items-center gap-2">
          {/* Refresh — data tabs only */}
          {onRefresh && isDataTab && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm transition-all cursor-pointer font-medium text-sm ${
                isRefreshing
                  ? 'bg-green-600 text-white opacity-75 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
              title="Pull fresh data from Spark"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          )}
          {/* Filter — data tabs only */}
          {isDataTab && (
            <button
              onClick={() => setFilterPanelOpen(true)}
              className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg shadow-sm transition-all cursor-pointer text-sm font-medium ${
                activeFilterCount > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Date Range — data tabs only */}
      {isDataTab && <DateRangePicker dateRange={dateRange} onChange={setDateRange} />}

      {/* Data Freshness Banner */}
      {isDataTab && lastFetchedAt && (
        <div className="mb-4 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>
              {isCached ? 'Showing cached data' : 'Data loaded'} {formatTimeAgo(lastFetchedAt)}
            </span>
          </div>
          {onRefresh && !isRefreshing && (
            <button
              onClick={onRefresh}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
            >
              Refresh now
            </button>
          )}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Filters Banner */}
      {activeFilterCount > 0 && isDataTab && (
        <div className="mb-4 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <Filter className="w-4 h-4" />
            <span className="font-medium">
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
            </span>
            <span className="text-blue-500 dark:text-blue-400">- Some data may be hidden</span>
          </div>
          <button
            onClick={() => setFilterPanelOpen(true)}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
          >
            Manage Filters
          </button>
        </div>
      )}

      {/* Tab Content */}
      <div className="transition-all duration-300">{children}</div>

      {/* Filter Panel (slide-over) */}
      <FilterPanel isOpen={isFilterPanelOpen} onClose={() => setFilterPanelOpen(false)} />
    </div>
  );
}
