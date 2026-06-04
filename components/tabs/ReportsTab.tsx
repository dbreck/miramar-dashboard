'use client';

import { ExternalLink, Archive } from 'lucide-react';

const LATEST_REPORT_URL = 'https://mira-mar-report.vercel.app/reports/2026-06-04/';
const REPORT_ARCHIVE_URL = 'https://mira-mar-report.vercel.app/';

type CardProps = {
  kicker?: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  cta: string;
  /** Optional small icon link in the top-right corner that opens in a new tab. */
  secondary?: { href: string; label: string };
} & (
  | { href: string; onClick?: never }
  | { onClick: () => void; href?: never }
);

function ReportCard({ kicker, title, description, icon, cta, href, onClick, secondary }: CardProps) {
  const inner = (
    <div className="group h-full flex flex-col bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 overflow-hidden relative">
      {secondary && (
        <a
          href={secondary.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={secondary.label}
          title={secondary.label}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-md text-gray-400 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors z-10"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
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
  // When there's a secondary <a>, the outer must not be a <button> (nested
  // interactive elements are invalid HTML). Use a div with role="button".
  if (secondary && onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        className="block w-full text-left h-full cursor-pointer"
      >
        {inner}
      </div>
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
  return (
    <>
      <section className="mb-10">
        <SectionHeader kicker="Marketing Performance" label="Period reports" />
        <div className="grid gap-4 sm:grid-cols-2">
          <ReportCard
            kicker="Latest · Jun 4, 2026"
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
    </>
  );
}
