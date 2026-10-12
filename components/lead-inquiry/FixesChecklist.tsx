import { CheckCircle2, Clock, HelpCircle, ListTodo, type LucideIcon } from 'lucide-react';
import { FIXES, type FixStatus } from '@/lib/lead-inquiry-data';

const STATUS: Record<FixStatus, { label: string; icon: LucideIcon; className: string }> = {
  done: {
    label: 'Done',
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
  },
  'in-progress': {
    label: 'In progress',
    icon: Clock,
    className: 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  },
  'needs-you': {
    label: 'Needs your help',
    icon: HelpCircle,
    className: 'bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100',
  },
  next: {
    label: 'Next step',
    icon: ListTodo,
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-700/60 dark:text-gray-100',
  },
};

export default function FixesChecklist() {
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
      {FIXES.map((f) => {
        const s = STATUS[f.status];
        const Icon = s.icon;
        return (
          <li key={f.title} className="py-4 first:pt-0 last:pb-0">
            <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
              <span
                className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 sm:w-36 ${s.className}`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                {s.label}
              </span>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{f.title}</div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{f.detail}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
