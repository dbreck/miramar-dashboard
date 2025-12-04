'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Sun, Moon, LogOut, Info, Filter } from 'lucide-react';
import DateRangePicker, { DateRange } from './DateRangePicker';
import FilterPanel from './FilterPanel';
import { useFilters } from '@/lib/filter-context';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: 'overview' | 'contacts' | 'engagement' | 'team' | 'pipeline' | 'marketing';
  setActiveTab: (tab: 'overview' | 'contacts' | 'engagement' | 'team' | 'pipeline' | 'marketing') => void;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

export default function DashboardLayout({ children, activeTab, setActiveTab, dateRange, setDateRange }: DashboardLayoutProps) {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(true); // Default to dark mode
  const [loggingOut, setLoggingOut] = useState(false);
  const { isFilterPanelOpen, setFilterPanelOpen, getActiveFilterCount } = useFilters();
  const activeFilterCount = getActiveFilterCount();

  useEffect(() => {
    // Load dark mode preference from localStorage, default to true
    const savedMode = localStorage.getItem('darkMode');
    const isDark = savedMode === null ? true : savedMode === 'true';
    setDarkMode(isDark);

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', String(newMode));

    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
      setLoggingOut(false);
    }
  };

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'marketing' as const, label: 'Marketing' },
    // Hidden temporarily - will restore when ready to add interaction data
    // { id: 'contacts' as const, label: 'Contacts' },
    // { id: 'engagement' as const, label: 'Engagement' },
    // { id: 'team' as const, label: 'Team' },
    // { id: 'pipeline' as const, label: 'Pipeline' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Mira Mar Logo"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
                  Mira Mar Leads
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Lead Generation Dashboard
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter Button */}
              <button
                onClick={() => setFilterPanelOpen(true)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg shadow hover:shadow-md transition-all cursor-pointer ${
                  activeFilterCount > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
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
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow hover:shadow-md transition-all cursor-pointer"
                aria-label="Toggle dark mode"
              >
                {darkMode ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600" />
                )}
              </button>
              <button
                onClick={() => router.push('/about')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 shadow hover:shadow-md transition-all text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                <Info className="w-4 h-4" />
                <span className="hidden sm:inline">About</span>
              </button>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 shadow hover:shadow-md transition-all text-gray-700 dark:text-gray-300 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Date Range Picker */}
        <DateRangePicker dateRange={dateRange} onChange={setDateRange} />

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active Filters Banner */}
        {activeFilterCount > 0 && (
          <div className="mb-4 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <Filter className="w-4 h-4" />
              <span className="font-medium">
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
              </span>
              <span className="text-blue-500 dark:text-blue-400">
                - Some data may be hidden
              </span>
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
        <div className="transition-all duration-300">
          {children}
        </div>
      </div>

      {/* Filter Panel */}
      <FilterPanel isOpen={isFilterPanelOpen} onClose={() => setFilterPanelOpen(false)} />
    </div>
  );
}
