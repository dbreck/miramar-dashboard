'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Database, TrendingUp, AlertCircle, Zap, Clock, Filter, CheckCircle, Info } from 'lucide-react';

export default function AboutPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            About Mira Mar Leads Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Understanding your data, metrics, and analytics
          </p>
        </div>

        {/* Content Cards */}
        <div className="space-y-6">
          {/* Purpose Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Purpose</h2>
            </div>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              The Mira Mar Leads Dashboard provides real-time analytics and insights into your Spark CRM data.
              It helps you understand lead engagement, team performance, pipeline health, and contact activity patterns.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Track engagement metrics over time</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Analyze lead sources and quality</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Monitor team performance</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Visualize pipeline progression</span>
              </div>
            </div>
          </div>

          {/* Data Sources Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Database className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Data Sources</h2>
            </div>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              All data is fetched in real-time from the Spark.re CRM API. The dashboard uses multiple API endpoints to gather comprehensive contact and interaction data.
            </p>
            <div className="space-y-3 mt-4">
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  Primary Data Sources
                </h3>
                <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300 ml-6">
                  <li className="list-disc">Contacts API - Individual contact records with ratings</li>
                  <li className="list-disc">Interactions API - All communication history (emails, calls, texts)</li>
                  <li className="list-disc">Registration Sources API - Lead source definitions</li>
                  <li className="list-disc">Users API - Team member information</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Important Filtering Notes */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Filter className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Filtering & Date Ranges</h2>
            </div>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              Understanding how date filtering works is crucial to interpreting dashboard metrics correctly.
            </p>
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Active Contacts Filter</h3>
                <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                  Most metrics show "Active" contacts - meaning contacts that had at least one interaction (email, call, text, meeting) during the selected date range.
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Example:</strong> If you see "39 Website leads" in the dashboard but 52 in Spark, the 13-contact difference represents Website contacts that were added but never contacted during the period.
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Why This Approach?</h3>
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
                    <span><strong>API Limitation:</strong> Spark's bulk contact retrieval endpoint has restricted permissions and often returns incomplete results. The dashboard uses a proven workaround: fetching contact IDs from the interactions endpoint first, then retrieving those specific contacts.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                    <span><strong>Engagement Focus:</strong> Shows contacts your team is actively working, not just database entries</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                    <span><strong>Performance Accuracy:</strong> Metrics reflect actual work done, not leads sitting untouched</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                    <span><strong>Pipeline Reality:</strong> Sales funnel shows contacts in motion, not stagnant leads</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Performance Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Performance Optimizations</h2>
            </div>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              The dashboard is optimized for speed while maintaining data accuracy.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-green-600" />
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">5-Minute Cache</h3>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Data is cached for 5 minutes to reduce API calls and improve load times
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-green-600" />
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Parallel Processing</h3>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Contact details fetched in batches of 20 for faster data retrieval
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-green-600" />
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Smart Limiting</h3>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Top 50 most active contacts used for detailed analysis
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Typical Load Time</h3>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  ~5-6 seconds first load, ~3-4 seconds with cache
                </p>
              </div>
            </div>
          </div>

          {/* Known Limitations */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Known Limitations</h2>
            </div>
            <div className="space-y-3">
              <div className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-r-lg">
                <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-1">API Permission Restrictions</h3>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Some Spark API endpoints have restricted permissions. The dashboard uses workarounds (like fetching contact IDs from interactions first) to provide complete data despite these restrictions.
                </p>
              </div>
              <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-r-lg">
                <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">Rating Data Requires Individual Fetches</h3>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Contact ratings (Hot, Warm, Cold, etc.) are only available from the individual contact endpoint, requiring separate API calls for each contact. This is why we limit detailed analysis to the top 50 most active contacts.
                </p>
              </div>
              <div className="border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-r-lg">
                <h3 className="font-semibold text-purple-900 dark:text-purple-300 mb-1">Date Range Comparison Differences</h3>
                <p className="text-sm text-purple-800 dark:text-purple-300">
                  Dashboard contact counts may differ from Spark's native filters because the dashboard shows contacts with interactions during the period, while Spark filters typically show contacts created during the period.
                </p>
              </div>
              <div className="border-l-4 border-gray-500 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-r-lg">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">5-Minute Data Delay</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Due to caching, very recent changes in Spark may take up to 5 minutes to appear in the dashboard. Refresh the page to clear the cache if you need the absolute latest data.
                </p>
              </div>
            </div>
          </div>

          {/* Support Section */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <h2 className="text-2xl font-bold mb-2">Questions or Issues?</h2>
            <p className="mb-4 opacity-90">
              If you notice unexpected data, have questions about metrics, or need help interpreting the dashboard,
              please reach out to your account administrator.
            </p>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-sm font-medium">Last Updated: January 2025</p>
              <p className="text-sm opacity-80">Dashboard Version: 1.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
