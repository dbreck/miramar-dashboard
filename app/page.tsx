'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import OverviewTab from '@/components/tabs/OverviewTab';
import ContactsTab from '@/components/tabs/ContactsTab';
import EngagementTab from '@/components/tabs/EngagementTab';
import TeamTab from '@/components/tabs/TeamTab';
import PipelineTab from '@/components/tabs/PipelineTab';
import MarketingTab from '@/components/tabs/MarketingTab';
import { DateRange } from '@/components/DateRangePicker';
import { FilterProvider } from '@/lib/filter-context';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'engagement' | 'team' | 'pipeline' | 'marketing'>('overview');
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago (reduced to minimize API calls)
    end: new Date(),
    preset: '7d'
  });

  return (
    <FilterProvider>
      <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab} dateRange={dateRange} setDateRange={setDateRange}>
        {activeTab === 'overview' && <OverviewTab dateRange={dateRange} />}
        {activeTab === 'contacts' && <ContactsTab dateRange={dateRange} />}
        {activeTab === 'engagement' && <EngagementTab dateRange={dateRange} />}
        {activeTab === 'team' && <TeamTab dateRange={dateRange} />}
        {activeTab === 'pipeline' && <PipelineTab dateRange={dateRange} />}
        {activeTab === 'marketing' && <MarketingTab dateRange={dateRange} />}
      </DashboardLayout>
    </FilterProvider>
  );
}
