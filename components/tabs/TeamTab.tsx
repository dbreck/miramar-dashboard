'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DateRange } from '../DateRangePicker';

interface TeamTabProps {
  dateRange: DateRange;
}

export default function TeamTab({ dateRange }: TeamTabProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams({
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      });
      const response = await fetch(`/api/dashboard?${params}`);
      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!data || !data.teamPerformance.length) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
        <p className="text-yellow-800 dark:text-yellow-300">No team performance data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Performance Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Team Performance (Last 60 Days)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.teamPerformance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis dataKey="name" type="category" stroke="#6b7280" width={180} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="interactions" fill="#10b981" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Team Member Cards */}
        <div className="space-y-4">
          {data.teamPerformance.map((member: any, idx: number) => (
            <div key={member.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-bold text-lg text-gray-900 dark:text-white">{member.name}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Team Member ID: {member.id}</p>
                </div>
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                    idx === 0 ? 'bg-blue-600' : 'bg-purple-600'
                  }`}
                >
                  {idx + 1}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Workload Share</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{member.percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${idx === 0 ? 'bg-blue-600' : 'bg-purple-600'}`}
                      style={{ width: `${member.percentage}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{member.interactions}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Interactions</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {Math.round((member.interactions / 60) * 100) / 100}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Per Day Avg</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
