'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Search,
  ChevronDown,
  ChevronUp,
  Zap,
  Upload,
  Check,
  Loader2,
  FileSpreadsheet,
  Cookie,
  FileSearch,
  Activity,
  FileBarChart,
} from 'lucide-react';
import { useBranding, BrandLogo } from '@/lib/branding';
import { useAuth } from '@/lib/auth-provider';

// --- reCAPTCHA ---

const RECAPTCHA_SITE_KEY = '6LfqnOErAAAAALcWX6q1VKVJ4zvvS5XxsCNPzuWu';

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

function useRecaptcha() {
  useEffect(() => {
    if (document.querySelector(`script[src*="recaptcha"]`)) return;
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const getToken = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!window.grecaptcha) {
        reject(new Error('reCAPTCHA not loaded'));
        return;
      }
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(RECAPTCHA_SITE_KEY, { action: 'registration' })
          .then(resolve)
          .catch(reject);
      });
    });
  }, []);

  return { getToken };
}

// --- Types ---

interface ReconContact {
  email: string;
  name: string;
  phone: string;
  callrailSource: string;
  callrailUtmSource: string;
  callrailUtmMedium: string;
  callrailUtmCampaign: string;
  submittedAt: string;
  formType: string;
  submissionCount: number;
  inSpark: boolean;
  sparkContactId: number | null;
  sparkRating: string;
  sparkUtmSource: string;
  sparkUtmMedium: string;
  sparkUtmCampaign: string;
  hasPaidSource: boolean;
  hasUtmGap: boolean;
  likelyCause: string;
  matchMethod: 'email' | 'phone' | 'name' | 'none';
  warnings: string[];
  sparkEmail: string;
  callrailZip: string;
  callrailHowHeard: string;
  callrailComments: string;
  callrailIsAgent: boolean;
  callrailBrokerage: string;
}

interface SourceStats {
  source: string;
  total: number;
  inSpark: number;
  missing: number;
  dropRate: number;
}

interface ReconData {
  summary: {
    total: number;
    inSpark: number;
    missing: number;
    utmGaps: number;
    matchRate: number;
    dropRate: number;
  };
  sourceStats: SourceStats[];
  contacts: ReconContact[];
  generatedAt: string;
  dateRange: { start: string; end: string };
}

// --- Date Presets ---

const DATE_PRESETS = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
  { label: 'All', days: 0 },
];

// --- Helpers ---

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sourceColor(source: string): string {
  const s = source.toLowerCase();
  if (s.includes('facebook')) return 'bg-blue-500';
  if (s.includes('instagram')) return 'bg-pink-500';
  if (s.includes('google ads')) return 'bg-red-500';
  if (s.includes('google organic') || s.includes('duckduck')) return 'bg-amber-500';
  if (s.includes('direct')) return 'bg-gray-400';
  return 'bg-teal-500';
}

function sourceBadgeClasses(source: string): string {
  const s = source.toLowerCase();
  if (s.includes('facebook')) return 'bg-blue-500/15 text-blue-400 ring-blue-500/20';
  if (s.includes('instagram')) return 'bg-pink-500/15 text-pink-400 ring-pink-500/20';
  if (s.includes('google ads')) return 'bg-red-500/15 text-red-400 ring-red-500/20';
  if (s.includes('google organic') || s.includes('duckduck')) return 'bg-amber-500/15 text-amber-400 ring-amber-500/20';
  if (s.includes('direct')) return 'bg-gray-500/15 text-gray-400 ring-gray-500/20';
  return 'bg-teal-500/15 text-teal-400 ring-teal-500/20';
}

// --- Filter Type ---

type FilterView = 'all' | 'missing' | 'matched' | 'utm-gaps';

// --- Component ---

export default function ReconciliationPage() {
  const router = useRouter();
  const { branded } = useBranding();
  const { isAdmin, profile } = useAuth();
  const { getToken: getRecaptchaToken } = useRecaptcha();
  const [reportsOpen, setReportsOpen] = useState(false);
  const reportsRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ReconData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [filterView, setFilterView] = useState<FilterView>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'date' | 'name' | 'source'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState(false);
  const [pushResults, setPushResults] = useState<{ succeeded: number; failed: number; results: any[] } | null>(null);
  const [selectedUtmEmails, setSelectedUtmEmails] = useState<Set<string>>(new Set());
  const [pushingUtm, setPushingUtm] = useState(false);
  const [pushUtmResults, setPushUtmResults] = useState<{ succeeded: number; failed: number; results: any[] } | null>(null);
  const [agentOverrides, setAgentOverrides] = useState<Map<string, boolean>>(new Map());

  // Close reports dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (reportsRef.current && !reportsRef.current.contains(e.target as Node)) {
        setReportsOpen(false);
      }
    }
    if (reportsOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [reportsOpen]);

  const fetchData = useCallback(async (preset?: string) => {
    setLoading(true);
    setError(null);
    setElapsedTime(0);
    const startTime = Date.now();
    const timer = setInterval(() => setElapsedTime(Math.round((Date.now() - startTime) / 1000)), 1000);

    try {
      const params = new URLSearchParams();
      const p = preset || activePreset;

      if (p === 'custom' && customStart) {
        params.set('start', customStart);
        if (customEnd) params.set('end', customEnd);
      } else if (p !== 'All') {
        const days = DATE_PRESETS.find(d => d.label === p)?.days || 30;
        if (days > 0) {
          const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          params.set('start', start.toISOString().split('T')[0]);
        }
      }

      const res = await fetch(`/api/reconciliation/live?${params}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }, [activePreset, customStart, customEnd]);

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePresetClick = (label: string) => {
    setActivePreset(label);
    fetchData(label);
  };

  // Filter and sort contacts
  const filteredContacts = (data?.contacts || [])
    .filter(c => {
      if (filterView === 'missing') return !c.inSpark;
      if (filterView === 'matched') return c.inSpark;
      if (filterView === 'utm-gaps') return c.hasUtmGap;
      return true;
    })
    .filter(c => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.callrailSource.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'date') return dir * a.submittedAt.localeCompare(b.submittedAt);
      if (sortField === 'name') return dir * a.name.localeCompare(b.name);
      if (sortField === 'source') return dir * a.callrailSource.localeCompare(b.callrailSource);
      return 0;
    });

  // Selection helpers
  const missingContacts = (data?.contacts || []).filter(c => !c.inSpark);
  const visibleMissing = filteredContacts.filter(c => !c.inSpark);
  const allVisibleMissingSelected = visibleMissing.length > 0 && visibleMissing.every(c => selectedEmails.has(c.email));

  const toggleSelect = (email: string) => {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleMissingSelected) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(visibleMissing.map(c => c.email)));
    }
  };

  const pushToSpark = async () => {
    if (selectedEmails.size === 0) return;
    setPushing(true);
    setPushResults(null);

    const contactsToPush = missingContacts
      .filter(c => selectedEmails.has(c.email))
      .map(c => ({
        name: c.name,
        email: c.email,
        phone: c.phone,
        callrailSource: c.callrailSource,
        utmSource: c.callrailUtmSource,
        utmMedium: c.callrailUtmMedium,
        utmCampaign: c.callrailUtmCampaign,
        zip: c.callrailZip,
        howHeard: c.callrailHowHeard,
        comments: c.callrailComments,
        isAgent: agentOverrides.has(c.email) ? agentOverrides.get(c.email)! : c.callrailIsAgent,
        brokerage: c.callrailBrokerage,
      }));

    try {
      // Generate reCAPTCHA token in the admin's browser
      let recaptchaToken = '';
      try {
        recaptchaToken = await getRecaptchaToken();
      } catch {
        // Continue without token — Spark will reject if reCAPTCHA is required
      }

      const res = await fetch('/api/reconciliation/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: contactsToPush, recaptchaToken }),
      });
      const result = await res.json();
      setPushResults({ succeeded: result.summary.succeeded, failed: result.summary.failed, results: result.results });
      setSelectedEmails(new Set());
      // Refresh data after push
      setTimeout(() => fetchData(), 1500);
    } catch (err: any) {
      setPushResults({ succeeded: 0, failed: contactsToPush.length, results: [] });
    } finally {
      setPushing(false);
    }
  };

  // UTM Gap selection helpers
  const utmGapContacts = (data?.contacts || []).filter(c => c.hasUtmGap && c.inSpark && c.sparkContactId);
  const visibleUtmGaps = filteredContacts.filter(c => c.hasUtmGap && c.inSpark && c.sparkContactId);
  const allVisibleUtmGapsSelected = visibleUtmGaps.length > 0 && visibleUtmGaps.every(c => selectedUtmEmails.has(c.email));

  const toggleUtmSelect = (email: string) => {
    setSelectedUtmEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const toggleUtmSelectAll = () => {
    if (allVisibleUtmGapsSelected) {
      setSelectedUtmEmails(new Set());
    } else {
      setSelectedUtmEmails(new Set(visibleUtmGaps.map(c => c.email)));
    }
  };

  const pushUtmToSpark = async () => {
    if (selectedUtmEmails.size === 0) return;
    setPushingUtm(true);
    setPushUtmResults(null);

    const contactsToPush = utmGapContacts
      .filter(c => selectedUtmEmails.has(c.email))
      .map(c => ({
        sparkContactId: c.sparkContactId!,
        name: c.name,
        email: c.email,
        callrailSource: c.callrailSource,
        utmSource: c.callrailUtmSource,
        utmMedium: c.callrailUtmMedium,
        utmCampaign: c.callrailUtmCampaign,
      }));

    try {
      const res = await fetch('/api/reconciliation/push-utm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: contactsToPush }),
      });
      const result = await res.json();
      setPushUtmResults({ succeeded: result.summary.succeeded, failed: result.summary.failed, results: result.results });
      setSelectedUtmEmails(new Set());
      // Refresh data after push
      setTimeout(() => fetchData(), 1500);
    } catch (err: any) {
      setPushUtmResults({ succeeded: 0, failed: contactsToPush.length, results: [] });
    } finally {
      setPushingUtm(false);
    }
  };

  const toggleSort = (field: 'date' | 'name' | 'source') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Top Bar */}
      <div className="border-b border-gray-800/80 bg-gray-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Dashboard</span>
            </button>
            <div className="h-6 w-px bg-gray-800" />
            <div className="flex items-center gap-2.5">
              <BrandLogo size={28} />
              <h1 className="text-lg font-semibold tracking-tight">Lead Reconciliation</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <span className="text-xs text-gray-500 hidden sm:inline">
                Updated {formatDateTime(data.generatedAt)}
              </span>
            )}
            {isAdmin && (
              <div className="relative" ref={reportsRef}>
                <button
                  onClick={() => setReportsOpen(!reportsOpen)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-all"
                  title="Reports"
                >
                  <FileBarChart className="w-3.5 h-3.5" />
                  <ChevronDown className={`w-3 h-3 transition-transform ${reportsOpen ? 'rotate-180' : ''}`} />
                </button>
                {reportsOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-gray-800 rounded-lg ring-1 ring-gray-700 shadow-xl z-50 py-1">
                    {(isAdmin || profile?.can_view_llr) && (
                      <a
                        href="/api/lost-leads-alltime"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                      >
                        <FileSearch className="w-3.5 h-3.5" />
                        Lost Leads Report
                      </a>
                    )}
                    <a
                      href="/api/contact-comparison"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Contact Comparison
                    </a>
                    <a
                      href="/api/utm-cookie-log"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      <Cookie className="w-3.5 h-3.5" />
                      UTM Cookies
                    </a>
                    <a
                      href="/api/spark-relay-log"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      Relay Health
                    </a>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? `${elapsedTime}s` : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Date Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <div className="flex items-center bg-gray-900 rounded-xl p-1 ring-1 ring-gray-800">
            {DATE_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => handlePresetClick(p.label)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activePreset === p.label
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>or</span>
            <input
              type="date"
              value={customStart}
              onChange={e => { setCustomStart(e.target.value); setActivePreset('custom'); }}
              className="bg-gray-900 ring-1 ring-gray-800 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-gray-600"
            />
            <span>&ndash;</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => { setCustomEnd(e.target.value); setActivePreset('custom'); }}
              className="bg-gray-900 ring-1 ring-gray-800 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-gray-600"
            />
            {activePreset === 'custom' && (
              <button
                onClick={() => fetchData('custom')}
                className="px-3 py-1.5 rounded-lg bg-white text-gray-900 text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Go
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && !data && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-gray-800 border-t-white animate-spin" />
              <Zap className="w-6 h-6 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium">Cross-referencing systems</p>
              <p className="text-sm text-gray-500 mt-1">
                Checking CallRail submissions against Spark contacts ({elapsedTime}s)
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <SummaryCard
                label="CallRail Submissions"
                value={data.summary.total}
                sub="unique contacts"
                color="text-white"
              />
              <SummaryCard
                label="In Spark"
                value={data.summary.inSpark}
                sub={`${data.summary.matchRate}% match rate`}
                color="text-emerald-400"
                icon={<CheckCircle2 className="w-5 h-5" />}
              />
              <button onClick={() => setFilterView('missing')} className="text-left">
                <SummaryCard
                  label="Missing"
                  value={data.summary.missing}
                  sub={data.summary.missing > 0 ? `${data.summary.dropRate}% drop rate — click to view` : '0% drop rate'}
                  color={data.summary.missing > 0 ? 'text-red-400' : 'text-emerald-400'}
                  icon={data.summary.missing > 0 ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                  pulse={data.summary.missing > 0}
                  clickable={data.summary.missing > 0}
                />
              </button>
              <SummaryCard
                label="Meta Gaps"
                value={data.summary.utmGaps}
                sub="paid leads w/o UTM"
                color={data.summary.utmGaps > 0 ? 'text-amber-400' : 'text-emerald-400'}
                icon={data.summary.utmGaps > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              />
            </div>

            {/* Source Breakdown */}
            <div className="bg-gray-900 rounded-2xl ring-1 ring-gray-800 p-6 mb-8">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Drop Rate by Source</h2>
              <div className="space-y-3">
                {data.sourceStats.map(s => (
                  <div key={s.source} className="flex items-center gap-4">
                    <div className="w-40 flex items-center gap-2 flex-shrink-0">
                      <div className={`w-2.5 h-2.5 rounded-full ${sourceColor(s.source)}`} />
                      <span className="text-sm font-medium truncate">{s.source}</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full flex">
                          <div
                            className="bg-emerald-500 transition-all duration-700"
                            style={{ width: `${s.total > 0 ? (s.inSpark / s.total) * 100 : 0}%` }}
                          />
                          <div
                            className="bg-red-500 transition-all duration-700"
                            style={{ width: `${s.dropRate}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-24 flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs text-emerald-400 font-mono">{s.inSpark}</span>
                        <span className="text-xs text-gray-600">/</span>
                        <span className="text-xs text-gray-400 font-mono">{s.total}</span>
                        {s.missing > 0 && (
                          <span className="text-xs text-red-400 font-mono ml-auto">-{s.missing}</span>
                        )}
                      </div>
                    </div>
                    <div className="w-16 text-right flex-shrink-0">
                      {s.dropRate > 0 ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                          s.dropRate >= 50 ? 'bg-red-500/15 text-red-400' :
                          s.dropRate > 0 ? 'bg-amber-500/15 text-amber-400' : ''
                        }`}>
                          {s.dropRate}%
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-500/60">0%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact List */}
            <div className="bg-gray-900 rounded-2xl ring-1 ring-gray-800 overflow-hidden">
              {/* Toolbar */}
              <div className="p-4 border-b border-gray-800 flex flex-wrap items-center gap-3">
                {/* Filter Tabs */}
                <div className="flex items-center bg-gray-800/50 rounded-lg p-0.5 ring-1 ring-gray-700/50">
                  {([
                    { key: 'all', label: 'All', count: data.contacts.length },
                    { key: 'missing', label: 'Missing', count: data.summary.missing },
                    { key: 'matched', label: 'Matched', count: data.summary.inSpark },
                    { key: 'utm-gaps', label: 'Meta Gaps', count: data.summary.utmGaps },
                  ] as { key: FilterView; label: string; count: number }[]).map(f => (
                    <button
                      key={f.key}
                      onClick={() => setFilterView(f.key)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        filterView === f.key
                          ? 'bg-gray-700 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {f.label}
                      <span className={`ml-1.5 ${filterView === f.key ? 'text-gray-300' : 'text-gray-600'}`}>
                        {f.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search name, email, source..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-800/50 ring-1 ring-gray-700/50 rounded-lg pl-9 pr-3 py-1.5 text-sm text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-gray-600"
                  />
                </div>

                <span className="text-xs text-gray-600">
                  {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
                </span>

                {/* Push to Spark controls - shown when viewing missing or when items selected */}
                {(filterView === 'missing' || selectedEmails.size > 0) && visibleMissing.length > 0 && (
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={toggleSelectAll}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ring-1 ${
                        allVisibleMissingSelected
                          ? 'bg-blue-500/15 text-blue-400 ring-blue-500/30'
                          : 'text-gray-400 ring-gray-700 hover:ring-gray-600'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      {allVisibleMissingSelected ? 'Deselect All' : `Select All (${visibleMissing.length})`}
                    </button>

                    {selectedEmails.size > 0 && (
                      <button
                        onClick={pushToSpark}
                        disabled={pushing}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {pushing ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Upload className="w-3 h-3" />
                        )}
                        {pushing ? 'Pushing...' : `Push ${selectedEmails.size} to Spark`}
                      </button>
                    )}
                  </div>
                )}

                {/* Push UTM controls - shown when viewing UTM gaps or when UTM items selected */}
                {(filterView === 'utm-gaps' || selectedUtmEmails.size > 0) && visibleUtmGaps.length > 0 && (
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={toggleUtmSelectAll}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ring-1 ${
                        allVisibleUtmGapsSelected
                          ? 'bg-amber-500/15 text-amber-400 ring-amber-500/30'
                          : 'text-gray-400 ring-gray-700 hover:ring-gray-600'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      {allVisibleUtmGapsSelected ? 'Deselect All' : `Select All (${visibleUtmGaps.length})`}
                    </button>

                    {selectedUtmEmails.size > 0 && (
                      <button
                        onClick={pushUtmToSpark}
                        disabled={pushingUtm}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-amber-500 text-white hover:bg-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {pushingUtm ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Upload className="w-3 h-3" />
                        )}
                        {pushingUtm ? 'Updating...' : `Push UTM to ${selectedUtmEmails.size} contacts`}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Push Results Banner */}
              {pushResults && (
                <div className={`px-4 py-3 border-b border-gray-800 flex items-center gap-3 ${
                  pushResults.failed > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                }`}>
                  {pushResults.failed > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  )}
                  <p className="text-sm">
                    <span className="text-emerald-400 font-medium">{pushResults.succeeded} created</span>
                    {pushResults.failed > 0 && (
                      <span className="text-amber-400 font-medium ml-2">{pushResults.failed} failed</span>
                    )}
                    <span className="text-gray-500 ml-2">— refreshing data...</span>
                  </p>
                  <button
                    onClick={() => setPushResults(null)}
                    className="ml-auto text-gray-500 hover:text-gray-300 text-xs"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Push UTM Results Banner */}
              {pushUtmResults && (
                <div className={`px-4 py-3 border-b border-gray-800 flex items-center gap-3 ${
                  pushUtmResults.failed > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                }`}>
                  {pushUtmResults.failed > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  )}
                  <p className="text-sm">
                    <span className="text-emerald-400 font-medium">{pushUtmResults.succeeded} UTM fields updated</span>
                    {pushUtmResults.failed > 0 && (
                      <span className="text-amber-400 font-medium ml-2">{pushUtmResults.failed} failed</span>
                    )}
                    <span className="text-gray-500 ml-2">— refreshing data...</span>
                  </p>
                  <button
                    onClick={() => setPushUtmResults(null)}
                    className="ml-auto text-gray-500 hover:text-gray-300 text-xs"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Table Header */}
              <div className="hidden lg:grid grid-cols-[2rem_1fr_1.2fr_0.8fr_0.8fr_0.6fr_0.5fr] gap-4 px-5 py-2.5 border-b border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <span />
                <SortHeader label="Contact" field="name" current={sortField} dir={sortDir} onClick={toggleSort} />
                <span>Email / Phone</span>
                <SortHeader label="Source" field="source" current={sortField} dir={sortDir} onClick={toggleSort} />
                <SortHeader label="Submitted" field="date" current={sortField} dir={sortDir} onClick={toggleSort} />
                <span>Spark Status</span>
                <span>UTM</span>
              </div>

              {/* Contact Rows */}
              <div className="divide-y divide-gray-800/60">
                {filteredContacts.map(c => (
                  <ContactRow
                    key={c.email}
                    contact={c}
                    expanded={expandedContact === c.email}
                    onToggle={() => setExpandedContact(expandedContact === c.email ? null : c.email)}
                    selected={selectedEmails.has(c.email)}
                    onSelect={() => toggleSelect(c.email)}
                    utmSelected={selectedUtmEmails.has(c.email)}
                    onUtmSelect={() => toggleUtmSelect(c.email)}
                    showUtmCheckbox={filterView === 'utm-gaps' || selectedUtmEmails.size > 0}
                    agentOverride={agentOverrides.get(c.email)}
                    onAgentToggle={(val: boolean) => setAgentOverrides(prev => { const next = new Map(prev); next.set(c.email, val); return next; })}
                  />
                ))}
              </div>

              {filteredContacts.length === 0 && (
                <div className="py-16 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500/30 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">
                    {filterView === 'missing' ? 'No missing contacts!' :
                     filterView === 'utm-gaps' ? 'No Meta gaps detected.' :
                     'No contacts match your search.'}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

function SummaryCard({
  label, value, sub, color, icon, pulse, clickable,
}: {
  label: string; value: number; sub: string; color: string;
  icon?: React.ReactNode; pulse?: boolean; clickable?: boolean;
}) {
  return (
    <div className={`bg-gray-900 rounded-2xl ring-1 ring-gray-800 p-5 relative overflow-hidden ${pulse ? 'ring-red-500/30' : ''} ${clickable ? 'hover:ring-red-500/50 cursor-pointer transition-all' : ''}`}>
      {pulse && <div className="absolute inset-0 bg-red-500/5 animate-pulse" />}
      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          <p className={`text-3xl font-bold mt-1.5 tabular-nums ${color}`}>{value}</p>
          <p className="text-xs text-gray-600 mt-1">{sub}</p>
        </div>
        {icon && <div className={color}>{icon}</div>}
      </div>
    </div>
  );
}

function SortHeader({
  label, field, current, dir, onClick,
}: {
  label: string; field: 'date' | 'name' | 'source';
  current: string; dir: string;
  onClick: (f: 'date' | 'name' | 'source') => void;
}) {
  return (
    <button
      onClick={() => onClick(field)}
      className="flex items-center gap-1 hover:text-gray-300 transition-colors"
    >
      {label}
      {current === field && (
        dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      )}
    </button>
  );
}

function ContactRow({ contact: c, expanded, onToggle, selected, onSelect, utmSelected, onUtmSelect, showUtmCheckbox, agentOverride, onAgentToggle }: {
  contact: ReconContact; expanded: boolean; onToggle: () => void;
  selected: boolean; onSelect: () => void;
  utmSelected: boolean; onUtmSelect: () => void;
  showUtmCheckbox: boolean;
  agentOverride?: boolean;
  onAgentToggle: (val: boolean) => void;
}) {
  const isUtmGapSelectable = c.hasUtmGap && c.inSpark && c.sparkContactId;
  const showCheckbox = !c.inSpark || (showUtmCheckbox && isUtmGapSelectable);
  const isChecked = !c.inSpark ? selected : utmSelected;
  const handleCheck = !c.inSpark ? onSelect : onUtmSelect;
  const checkColor = !c.inSpark ? 'bg-blue-500 border-blue-500' : 'bg-amber-500 border-amber-500';

  return (
    <div className="group">
      <div
        className={`w-full grid grid-cols-1 lg:grid-cols-[2rem_1fr_1.2fr_0.8fr_0.8fr_0.6fr_0.5fr] gap-2 lg:gap-4 px-5 py-3.5 text-left hover:bg-gray-800/30 transition-colors cursor-pointer ${
          selected ? 'bg-blue-500/5' : utmSelected ? 'bg-amber-500/5' : ''
        }`}
        onClick={onToggle}
      >
        {/* Checkbox */}
        <div className="flex items-center" onClick={e => { e.stopPropagation(); handleCheck(); }}>
          {showCheckbox ? (
            <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center cursor-pointer ${
              isChecked
                ? checkColor
                : 'border-gray-600 hover:border-gray-400'
            }`}>
              {isChecked && <Check className="w-3 h-3 text-white" />}
            </div>
          ) : (
            <span />
          )}
        </div>

        {/* Name */}
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            c.inSpark
              ? (c.matchMethod !== 'email' ? 'bg-amber-400' : c.hasUtmGap ? 'bg-amber-400' : 'bg-emerald-400')
              : (c.warnings.length > 0 ? 'bg-amber-400' : 'bg-red-400')
          }`} />
          <span className="text-sm font-medium truncate">{c.name}</span>
        </div>

        {/* Email / Phone */}
        <div className="flex flex-col gap-0.5 pl-5 lg:pl-0">
          <span className="text-sm text-gray-400 truncate">{c.email}</span>
          <span className="text-xs text-gray-600">{c.phone}</span>
        </div>

        {/* Source */}
        <div className="pl-5 lg:pl-0">
          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md ring-1 ${sourceBadgeClasses(c.callrailSource)}`}>
            {c.callrailSource}
          </span>
        </div>

        {/* Submitted */}
        <div className="pl-5 lg:pl-0">
          <span className="text-sm text-gray-400">{formatDate(c.submittedAt)}</span>
          <span className="text-xs text-gray-600 ml-2">{c.formType}</span>
        </div>

        {/* Spark Status */}
        <div className="pl-5 lg:pl-0">
          {c.inSpark ? (
            <div>
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                c.matchMethod === 'email' ? 'text-emerald-400' :
                c.matchMethod === 'phone' ? 'text-blue-400' :
                'text-amber-400'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                {c.sparkRating || 'In Spark'}
              </span>
              {c.matchMethod !== 'email' && (
                <span className="block text-[10px] text-amber-500/70 mt-0.5">
                  via {c.matchMethod}
                </span>
              )}
            </div>
          ) : (
            <div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400">
                <XCircle className="w-3.5 h-3.5" />
                Missing
              </span>
              {c.warnings.length > 0 && (
                <span className="block text-[10px] text-amber-500/70 mt-0.5">
                  {c.warnings.length} warning{c.warnings.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* UTM */}
        <div className="pl-5 lg:pl-0 flex items-center">
          {c.hasPaidSource ? (
            c.hasUtmGap ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            ) : c.inSpark ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/60" />
            ) : (
              <span className="text-xs text-gray-600">&mdash;</span>
            )
          ) : (
            <span className="text-xs text-gray-700">&mdash;</span>
          )}
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-gray-800/40">
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CallRail Side */}
            <div className="bg-gray-800/40 rounded-xl p-4 ring-1 ring-gray-700/30">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                CallRail Data
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Source" value={c.callrailSource} />
                <Field label="Submitted" value={formatDateTime(c.submittedAt)} />
                <Field label="Zip" value={c.callrailZip} />
                <Field label="How heard" value={c.callrailHowHeard} />
                <Field label="Type" value={c.callrailIsAgent ? `Broker${c.callrailBrokerage ? ` (${c.callrailBrokerage})` : ''}` : 'Future Resident'} highlight={c.callrailIsAgent} />
                {c.callrailComments && (
                  <div className="col-span-2">
                    <Field label="Comments" value={c.callrailComments} />
                  </div>
                )}
                {!c.inSpark && (
                  <div className="col-span-2 flex items-center gap-2 pt-1">
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={agentOverride !== undefined ? agentOverride : c.callrailIsAgent}
                        onChange={e => { e.stopPropagation(); onAgentToggle(e.target.checked); }}
                        onClick={e => e.stopPropagation()}
                        className="w-3.5 h-3.5 rounded accent-purple-500 cursor-pointer"
                      />
                      Push as Agent/Broker
                    </label>
                  </div>
                )}
                <Field label="utm_source" value={c.callrailUtmSource} mono />
                <Field label="utm_medium" value={c.callrailUtmMedium} mono />
                <Field label="utm_campaign" value={c.callrailUtmCampaign} mono />
                <Field label="Form" value={c.formType} />
              </div>
            </div>

            {/* Spark Side */}
            <div className={`rounded-xl p-4 ring-1 ${
              c.inSpark
                ? 'bg-emerald-500/5 ring-emerald-500/20'
                : 'bg-red-500/5 ring-red-500/20'
            }`}>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${c.inSpark ? 'bg-emerald-400' : 'bg-red-400'}`} />
                Spark Status
              </h4>
              {c.inSpark ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Rating" value={c.sparkRating} />
                  <Field label="Match Method" value={c.matchMethod === 'email' ? 'Email (exact)' : c.matchMethod === 'phone' ? 'Phone number' : c.matchMethod === 'name' ? 'Name lookup' : 'None'} highlight={c.matchMethod !== 'email'} />
                  {c.sparkEmail && c.sparkEmail !== c.email && (
                    <Field label="Spark Email" value={c.sparkEmail} highlight />
                  )}
                  <Field label="Contact ID" value={String(c.sparkContactId)} />
                  <Field label="utm_source" value={c.sparkUtmSource} mono highlight={c.hasUtmGap} />
                  <Field label="utm_medium" value={c.sparkUtmMedium} mono highlight={c.hasUtmGap} />
                  <Field label="utm_campaign" value={c.sparkUtmCampaign} mono highlight={c.hasUtmGap} />
                  {c.sparkContactId && (
                    <div className="col-span-2">
                      <a
                        href={`https://spark.re/mira-mar-acquisitions-company-llc/mira-mar/contacts/${c.sparkContactId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open in Spark
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm space-y-2">
                  <p className="text-red-400 font-medium">Not found in Spark</p>
                  <p className="text-gray-500 text-xs">
                    Likely cause: <span className="text-gray-400">{c.likelyCause}</span>
                  </p>
                </div>
              )}

              {/* Warnings */}
              {c.warnings.length > 0 && (
                <div className="col-span-2 mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Warnings</span>
                  </div>
                  <ul className="space-y-1">
                    {c.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-amber-300/80 flex items-start gap-1.5">
                        <span className="text-amber-500 mt-0.5">&#x2022;</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  const empty = !value || value === '(direct)' || value === '(none)' || value === '';
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`${mono ? 'font-mono text-xs' : 'text-sm'} ${
        empty ? 'text-gray-600 italic' : highlight ? 'text-amber-400' : 'text-gray-200'
      }`}>
        {empty ? '(empty)' : value}
      </p>
    </div>
  );
}
