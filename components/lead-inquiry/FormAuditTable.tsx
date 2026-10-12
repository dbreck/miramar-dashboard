import { Check, X } from 'lucide-react';
import { FORM_AUDIT } from '@/lib/lead-inquiry-data';

export default function FormAuditTable() {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm text-left">
        <caption className="sr-only">Is a phone number required on each website form?</caption>
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <th scope="col" className="py-2 px-1 font-semibold">Form</th>
            <th scope="col" className="py-2 px-1 font-semibold">Where</th>
            <th scope="col" className="py-2 px-1 font-semibold text-right">Phone required?</th>
          </tr>
        </thead>
        <tbody>
          {FORM_AUDIT.map((r) => (
            <tr
              key={r.form}
              className={`border-b border-gray-100 dark:border-gray-700/60 ${
                r.phoneRequired ? '' : 'bg-amber-50 dark:bg-amber-900/20'
              }`}
            >
              <td className="py-2 px-1 font-medium text-gray-900 dark:text-white">{r.form}</td>
              <td className="py-2 px-1 text-gray-600 dark:text-gray-300">{r.page}</td>
              <td className="py-2 px-1 text-right whitespace-nowrap">
                {r.phoneRequired ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-medium">
                    <Check className="w-4 h-4" aria-hidden="true" /> Yes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-200 font-semibold">
                    <X className="w-4 h-4" aria-hidden="true" /> No
                    {r.note && (
                      <span className="font-normal text-xs text-amber-800/80 dark:text-amber-200/80">
                        ({r.note.toLowerCase()})
                      </span>
                    )}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
