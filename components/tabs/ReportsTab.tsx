'use client';

import { useState } from 'react';
import {
  Play,
  ExternalLink,
  Archive,
  FileSearch,
  FileSpreadsheet,
  Cookie,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-provider';
import Modal from '@/components/Modal';

const VIDEO_SRC = '/embed/Performance%20Report%20Video.html';
const LATEST_REPORT_URL = 'https://mira-mar-report.vercel.app/reports/2026-04-25/';
const REPORT_ARCHIVE_URL = 'https://mira-mar-report.vercel.app/';

type CardProps = {
  kicker?: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  cta: string;
} & (
  | { href: string; onClick?: never }
  | { onClick: () => void; href?: never }
);

function ReportCard({ kicker, title, description, icon, cta, href, onClick }: CardProps) {
  const inner = (
    <div className="group h-full flex flex-col bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 overflow-hidden">
      <div className="p-5 flex-1 flex flex-col">
        {kicker && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400 mb-2">
            {kicker}
          </p>
        )}
        <div className="flex items-start gap-3 mb-2">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 shrink-0">
            {icon}
          </span>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-snug">
            {title}
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{description}</p>
      </div>
      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center justify-between">
        <span>{cta}</span>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className="block w-full text-left h-full cursor-pointer">
      {inner}
    </button>
  );
}

function SectionHeader({ label, kicker }: { label: string; kicker: string }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
        {kicker}
      </p>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-1">{label}</h2>
    </div>
  );
}

export default function ReportsTab() {
  const { isAdmin, profile } = useAuth();
  const canViewLLR = isAdmin || !!profile?.can_view_llr;
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <>
      <section className="mb-10">
        <SectionHeader kicker="Marketing Performance" label="Period reports & narrative video" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ReportCard
            kicker="Animated · 60s"
            title="Performance Report Video"
            description="Auto-playing scene-by-scene retrospective of the Mar 27 – Apr 25 period. Opens in a popover."
            icon={<Play className="w-5 h-5" />}
            cta="Play video"
            onClick={() => setVideoOpen(true)}
          />
          <ReportCard
            kicker="Latest · Apr 25, 2026"
            title="Marketing Performance Report"
            description="The current period's full editorial report — KPIs, channel deep dives, and recommendations."
            icon={<ExternalLink className="w-5 h-5" />}
            cta="Open report"
            href={LATEST_REPORT_URL}
          />
          <ReportCard
            kicker="All editions"
            title="Report Archive"
            description="Every prior period report at mira-mar-report.vercel.app, with deltas vs. previous periods."
            icon={<Archive className="w-5 h-5" />}
            cta="Browse archive"
            href={REPORT_ARCHIVE_URL}
          />
        </div>
      </section>

      {isAdmin && (
        <section>
          <SectionHeader kicker="Admin · Operational" label="Lead-quality & integration health" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {canViewLLR && (
              <ReportCard
                title="Lost Leads Report"
                description="All-time CallRail submissions that never reached Spark, with rejection reasons."
                icon={<FileSearch className="w-5 h-5" />}
                cta="Open report"
                href="/api/lost-leads-alltime"
              />
            )}
            <ReportCard
              title="Contact Comparison"
              description="Side-by-side CallRail vs. Spark for matched contacts — UTMs, dates, lag."
              icon={<FileSpreadsheet className="w-5 h-5" />}
              cta="Open report"
              href="/api/contact-comparison"
            />
            <ReportCard
              title="UTM Cookies"
              description="Live UTM cookie diagnostics from WordPress: cookie set/failed by browser type."
              icon={<Cookie className="w-5 h-5" />}
              cta="Open report"
              href="/api/utm-cookie-log"
            />
            <ReportCard
              title="Relay Health"
              description="Form relay outcomes — success, failure, rejection — over the last 24h / 7d."
              icon={<Activity className="w-5 h-5" />}
              cta="Open report"
              href="/api/spark-relay-log"
            />
          </div>
        </section>
      )}

      <Modal
        isOpen={videoOpen}
        onClose={() => setVideoOpen(false)}
        title="Performance Report · Mar 27 – Apr 25, 2026"
        aspectRatio="16 / 9"
        maxWidth="min(95vw, 1600px)"
        bleed
      >
        <iframe
          src={VIDEO_SRC}
          title="Mira Mar — Performance Report (animated)"
          className="block w-full h-full bg-black"
          style={{ border: 0 }}
          sandbox="allow-scripts allow-same-origin"
        />
      </Modal>
    </>
  );
}
