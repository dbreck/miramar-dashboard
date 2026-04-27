'use client';

import { useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import OverviewTab from '@/components/tabs/OverviewTab';
import MarketingTab from '@/components/tabs/MarketingTab';
import RatingsTab from '@/components/tabs/RatingsTab';
import ReportsTab from '@/components/tabs/ReportsTab';
import DesignSystemTab from '@/components/tabs/DesignSystemTab';
import { DateRange } from '@/components/DateRangePicker';
import { FilterProvider } from '@/lib/filter-context';

export type TabId = 'overview' | 'marketing' | 'ratings' | 'reports' | 'design';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date(),
    preset: '7d'
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const handleDataStatus = useCallback((cached: boolean, timestamp: number | null, loading: boolean) => {
    setIsCached(cached);
    setLastFetchedAt(timestamp);
    setIsRefreshing(loading);
  }, []);

  return (
    <FilterProvider>
      <DashboardLayout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        dateRange={dateRange}
        setDateRange={setDateRange}
        onRefresh={handleRefresh}
        lastFetchedAt={lastFetchedAt}
        isCached={isCached}
        isRefreshing={isRefreshing}
      >
        {activeTab === 'overview' && <OverviewTab dateRange={dateRange} refreshTrigger={refreshTrigger} onDataStatus={handleDataStatus} />}
        {activeTab === 'marketing' && <MarketingTab dateRange={dateRange} refreshTrigger={refreshTrigger} onDataStatus={handleDataStatus} />}
        {activeTab === 'ratings' && <RatingsTab dateRange={dateRange} refreshTrigger={refreshTrigger} onDataStatus={handleDataStatus} />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'design' && <DesignSystemTab />}
      </DashboardLayout>
    </FilterProvider>
  );
}
