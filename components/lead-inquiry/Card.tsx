import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

/** Same surface as the dashboard's chart cards. */
export default function Card({ title, subtitle, children, className = '' }: CardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 ${className}`}>
      {title && (
        <h4 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h4>
      )}
      {subtitle && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
      )}
      <div className={title || subtitle ? 'mt-4' : ''}>{children}</div>
    </div>
  );
}

/** "Show the numbers" disclosure: the table view behind every chart. */
export function NumbersTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className="mt-3 group">
      <summary className="cursor-pointer text-xs font-medium text-blue-700 dark:text-blue-300 select-none">
        Show the numbers
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {headers.map((h) => (
                <th key={h} className="py-1.5 pr-3 font-semibold text-gray-700 dark:text-gray-300">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-700/60">
                {r.map((c, j) => (
                  <td key={j} className="py-1.5 pr-3 text-gray-700 dark:text-gray-300 tabular-nums">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
