'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** CSS aspect-ratio (e.g. "16 / 9"). When set, the inner stage is constrained to it. */
  aspectRatio?: string;
  /** CSS max-width for the dialog (e.g. "min(90vw, 1600px)"). Defaults to a comfortable read width. */
  maxWidth?: string;
  /** When true, the dialog body is rendered without padding so the child can fill the entire stage. */
  bleed?: boolean;
  children: React.ReactNode;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  aspectRatio,
  maxWidth,
  bleed = false,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const stageStyle: React.CSSProperties = {
    maxWidth: maxWidth ?? 'min(90vw, 880px)',
    width: '100%',
    aspectRatio: aspectRatio,
    maxHeight: aspectRatio ? '90vh' : undefined,
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        style={stageStyle}
        className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden focus:outline-none"
      >
        {(title || !bleed) && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {bleed && !title && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <div className={`flex-1 ${bleed ? '' : 'p-5'} overflow-auto bg-white dark:bg-gray-900`}>
          {children}
        </div>
      </div>
    </div>
  );
}
