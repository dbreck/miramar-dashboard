'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  title: string;
  description: string;
}

export default function InfoTooltip({ title, description }: InfoTooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => {
          e.preventDefault();
          setShow(!show);
        }}
        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="More information"
        type="button"
      >
        <Info className="w-4 h-4" />
      </button>

      {show && (
        <>
          {/* Backdrop for mobile */}
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setShow(false)}
          />

          {/* Tooltip */}
          <div className="absolute z-50 w-72 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl -right-2 top-8 md:top-8">
            <div className="absolute -top-2 right-3 w-4 h-4 bg-white dark:bg-gray-800 border-t border-l border-gray-200 dark:border-gray-700 transform rotate-45" />
            <div className="relative">
              <h4 className="font-semibold text-sm mb-1 text-gray-900 dark:text-white">{title}</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{description}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
