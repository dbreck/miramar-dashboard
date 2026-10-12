import type { ReactNode } from 'react';
import { Info, Wrench, Lightbulb, type LucideIcon } from 'lucide-react';

type Tone = 'info' | 'ours' | 'recommend';

const TONES: Record<Tone, { icon: LucideIcon; className: string; iconClass: string }> = {
  info: {
    icon: Info,
    className: 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700',
    iconClass: 'text-gray-500 dark:text-gray-400',
  },
  ours: {
    icon: Wrench,
    className: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/60',
    iconClass: 'text-amber-700 dark:text-amber-300',
  },
  recommend: {
    icon: Lightbulb,
    className: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/60',
    iconClass: 'text-blue-700 dark:text-blue-300',
  },
};

export default function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div className={`rounded-lg border p-4 ${t.className}`}>
      <div className="flex gap-3">
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${t.iconClass}`} aria-hidden="true" />
        <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-200 space-y-1.5">
          {title && <div className="font-semibold text-gray-900 dark:text-white">{title}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}
