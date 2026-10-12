'use client';

import { CheckCircle2, CircleHelp, CircleSlash } from 'lucide-react';
import type { VerdictState } from '@/lib/lead-inquiry-data';

const STYLES: Record<
  VerdictState,
  { icon: typeof CheckCircle2; kind: string; className: string }
> = {
  right: {
    icon: CheckCircle2,
    kind: 'Right',
    className:
      'bg-emerald-50 text-emerald-800 ring-emerald-600/30 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-400/30',
  },
  partly: {
    icon: CircleHelp,
    kind: 'Partly right',
    className:
      'bg-amber-50 text-amber-900 ring-amber-600/30 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-400/30',
  },
  'not-supported': {
    icon: CircleSlash,
    kind: 'Not supported',
    className:
      'bg-gray-100 text-gray-800 ring-gray-500/30 dark:bg-gray-700/50 dark:text-gray-100 dark:ring-gray-400/30',
  },
};

interface Props {
  state: VerdictState;
  /** Optional custom wording; the verdict kind is still announced to screen readers. */
  label?: string;
}

export default function VerdictChip({ state, label }: Props) {
  const s = STYLES[state];
  const Icon = s.icon;
  const text = label ?? s.kind;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${s.className}`}
    >
      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>
        {label && <span className="sr-only">Verdict: {s.kind}. </span>}
        {text}
      </span>
    </span>
  );
}

export function VerdictKey() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
      <span className="font-medium">How to read the verdicts:</span>
      <VerdictChip state="right" />
      <VerdictChip state="partly" />
      <VerdictChip state="not-supported" />
    </div>
  );
}
