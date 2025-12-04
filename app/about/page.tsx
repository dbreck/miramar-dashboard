'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Database, TrendingUp, AlertCircle, Zap, Clock, Filter, CheckCircle, MapPin, Users, BarChart3 } from 'lucide-react';

export default function AboutPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-4xl font-bold text-white mb-2">
            About Mira Mar Leads Dashboard
          </h1>
          <p className="text-gray-400 text-lg">
            Real-time analytics powered by Spark.re CRM
          </p>
        </div>

        {/* Content Cards */}
        <div className="space-y-6">
          {/* Purpose Section */}
          <div className="bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-900/30 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Dashboard Purpose</h2>
            </div>
            <p className="text-gray-300 leading-relaxed mb-4">
              The Mira Mar Leads Dashboard provides real-time analytics and insights into your Spark CRM data.
              Track lead generation, analyze geographic distribution, monitor agent performance, and understand pipeline health with comprehensive visualizations.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-300">Track lead sources and quality</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-300">Geographic distribution by area code & ZIP</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-300">Agent vs non-agent breakdown</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-300">UTM tracking and campaign attribution</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-300">Team performance metrics</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-300">Pipeline progression analysis</span>
              </div>
            </div>
          </div>

          {/* Dashboard Features */}
          <div className="bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-900/30 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Dashboard Features</h2>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-900/50 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  Overview Tab
                </h3>
                <ul className="space-y-1.5 text-sm text-gray-300 ml-6">
                  <li className="list-disc">Lead Sources - Registration source breakdown with horizontal bars for clarity</li>
                  <li className="list-disc">Agent Distribution - All Leads | Agents | Non-Agents split</li>
                  <li className="list-disc">Lead Growth Over Time - Daily lead creation trends with source filtering</li>
                  <li className="list-disc">Leads by Location (Area Code) - Geographic distribution from phone numbers</li>
                  <li className="list-disc">Leads by Location (ZIP Code) - ZIP codes with city names when available</li>
                </ul>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  Additional Tabs
                </h3>
                <ul className="space-y-1.5 text-sm text-gray-300 ml-6">
                  <li className="list-disc">Pipeline - Deal stages, velocity, and conversion rates</li>
                  <li className="list-disc">Contacts - Contact growth and activity timeline</li>
                  <li className="list-disc">Engagement - Interaction types and team performance</li>
                  <li className="list-disc">Marketing - UTM tracking, traffic sources, and campaign performance</li>
                  <li className="list-disc">Team - Individual team member metrics</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Data Sources Section */}
          <div className="bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-900/30 flex items-center justify-center">
                <Database className="w-6 h-6 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Data Sources</h2>
            </div>
            <p className="text-gray-300 leading-relaxed mb-4">
              All data is fetched in real-time from the Spark.re CRM API using automatic pagination to ensure complete data accuracy.
            </p>
            <div className="space-y-3 mt-4">
              <div className="bg-gray-900/50 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-400" />
                  Primary Data Sources
                </h3>
                <ul className="space-y-1.5 text-sm text-gray-300 ml-6">
                  <li className="list-disc">Contacts API - Individual contact records with ratings and agent status</li>
                  <li className="list-disc">Interactions API - All communication history with automatic pagination (all 653+ interactions)</li>
                  <li className="list-disc">Registration Sources API - Lead source definitions</li>
                  <li className="list-disc">Custom Fields API - UTM parameters and tracking data</li>
                  <li className="list-disc">Team Members API - User information for attribution</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Important Filtering Notes */}
          <div className="bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-900/30 flex items-center justify-center">
                <Filter className="w-6 h-6 text-orange-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Filtering & Date Ranges</h2>
            </div>
            <p className="text-gray-300 leading-relaxed mb-4">
              Understanding how date filtering works is crucial to interpreting dashboard metrics correctly.
            </p>
            <div className="space-y-4">
              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                <h3 className="font-semibold text-blue-300 mb-2">Contact Creation Date Filter</h3>
                <p className="text-sm text-blue-300 mb-2">
                  Overview tab metrics show contacts created (<code className="bg-blue-900/40 px-1 rounded">created_at</code>) during the selected date range. This ensures manually entered agents (who have no registration date) are included.
                </p>
                <p className="text-sm text-blue-300">
                  <strong>Note:</strong> A contact created 6 months ago may have interactions today - those interactions are counted separately in the Engagement tab.
                </p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3">Why We Use Created Date</h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">•</span>
                    <span><strong>Includes All Leads:</strong> Manually entered agents and contacts without registration dates are counted</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">•</span>
                    <span><strong>Accurate Attribution:</strong> Matches Spark's reporting when you filter by contact creation date</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">•</span>
                    <span><strong>Complete Picture:</strong> Shows true lead generation regardless of interaction timing</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Performance Section */}
          <div className="bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-900/30 flex items-center justify-center">
                <Zap className="w-6 h-6 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Performance Optimizations</h2>
            </div>
            <p className="text-gray-300 leading-relaxed mb-4">
              The dashboard is optimized for speed while maintaining complete data accuracy through automatic pagination.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-green-400" />
                  <h3 className="font-semibold text-white text-sm">5-Minute Cache</h3>
                </div>
                <p className="text-sm text-gray-300">
                  Data is cached for 5 minutes to reduce API calls and improve load times
                </p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-green-400" />
                  <h3 className="font-semibold text-white text-sm">Automatic Pagination</h3>
                </div>
                <p className="text-sm text-gray-300">
                  Fetches ALL interactions (653+) automatically to ensure accurate counts
                </p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-green-400" />
                  <h3 className="font-semibold text-white text-sm">Parallel Processing</h3>
                </div>
                <p className="text-sm text-gray-300">
                  Contact details fetched in batches of 20 for faster data retrieval
                </p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <h3 className="font-semibold text-white text-sm">Typical Load Time</h3>
                </div>
                <p className="text-sm text-gray-300">
                  ~15-20 seconds first load, instant with cache
                </p>
              </div>
            </div>
          </div>

          {/* Agent Import Exclusion */}
          <div className="bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-900/30 flex items-center justify-center">
                <Users className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Agent Import Data</h2>
            </div>
            <div className="border-l-4 border-red-500 bg-red-900/20 p-4 rounded-r-lg">
              <h3 className="font-semibold text-red-300 mb-2">Automatically Excluded</h3>
              <p className="text-sm text-red-300 mb-3">
                Contacts with registration source &quot;Agent Import&quot; are automatically excluded from all dashboard queries and analytics.
                This includes 6,000+ imported agent records that would otherwise overwhelm the Spark API and skew lead generation metrics.
              </p>
              <p className="text-sm text-red-300">
                <strong>Why:</strong> These bulk-imported records represent agent contact information, not actual leads generated through marketing efforts.
                Including them would misrepresent true lead generation performance.
              </p>
            </div>
          </div>

          {/* Known Limitations */}
          <div className="bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-900/30 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Known Limitations</h2>
            </div>
            <div className="space-y-3">
              <div className="border-l-4 border-amber-500 bg-amber-900/20 p-4 rounded-r-lg">
                <h3 className="font-semibold text-amber-300 mb-1">ZIP Code City Names</h3>
                <p className="text-sm text-amber-300">
                  ZIP codes display with city names (e.g., "34236 Sarasota") only when contacts have the city field populated in Spark. ZIP codes without city data show as numbers only.
                </p>
              </div>
              <div className="border-l-4 border-blue-500 bg-blue-900/20 p-4 rounded-r-lg">
                <h3 className="font-semibold text-blue-300 mb-1">API Permission Restrictions</h3>
                <p className="text-sm text-blue-300">
                  Some Spark API endpoints have restricted permissions. The dashboard uses proven workarounds (like fetching by registration source, then filtering by project) to provide complete data.
                </p>
              </div>
              <div className="border-l-4 border-purple-500 bg-purple-900/20 p-4 rounded-r-lg">
                <h3 className="font-semibold text-purple-300 mb-1">Custom Field Requirements</h3>
                <p className="text-sm text-purple-300">
                  UTM tracking data requires custom fields (utm_source, utm_medium, utm_campaign) to be populated on contacts. The Marketing tab shows UTM data only for contacts with these fields filled in.
                </p>
              </div>
              <div className="border-l-4 border-gray-500 bg-gray-900/50 p-4 rounded-r-lg">
                <h3 className="font-semibold text-white mb-1">5-Minute Data Delay</h3>
                <p className="text-sm text-gray-300">
                  Due to caching, very recent changes in Spark may take up to 5 minutes to appear in the dashboard. Change the date range or refresh the page to clear the cache.
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
              <p className="text-sm font-medium">Last Updated: November 2025</p>
              <p className="text-sm opacity-80">Dashboard Version: 1.4.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
