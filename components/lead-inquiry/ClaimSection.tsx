import type { ReactNode } from 'react';
import VerdictChip from './VerdictChip';
import type { VerdictState } from '@/lib/lead-inquiry-data';

interface Props {
  id: string;
  number: number;
  claim: string;
  verdict: VerdictState;
  verdictLabel?: string;
  /** What she got right: always shown first. */
  rightPart: ReactNode;
  /** What the full data shows. */
  fullPicture: ReactNode;
  children: ReactNode;
}

export default function ClaimSection({
  id,
  number,
  claim,
  verdict,
  verdictLabel,
  rightPart,
  fullPicture,
  children,
}: Props) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          Claim {number}
        </p>
        <h2
          id={`${id}-title`}
          className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1"
        >
          &ldquo;{claim}&rdquo;
        </h2>
        <div className="mt-3">
          <VerdictChip state={verdict} label={verdictLabel} />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50/60 dark:bg-emerald-900/15 p-4">
            <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              What you got right
            </h3>
            <div className="mt-1.5 text-sm leading-relaxed text-gray-800 dark:text-gray-200 space-y-2">
              {rightPart}
            </div>
          </div>
          <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50/60 dark:bg-blue-900/15 p-4">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
              What the full data shows
            </h3>
            <div className="mt-1.5 text-sm leading-relaxed text-gray-800 dark:text-gray-200 space-y-2">
              {fullPicture}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
