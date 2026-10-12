'use client';

import type { CSSProperties } from 'react';
import { useTheme } from '@/lib/theme';

/**
 * Chart tokens for the Lead Inquiry page. Series hues come from the validated
 * dataviz categorical order (slot 1 blue, slot 2 orange, slot 3 aqua), stepped
 * separately for light and dark surfaces. Grid/axis/tooltip match the
 * dashboard's existing gray scale.
 */
export function useChartTheme() {
  const { mode } = useTheme();
  const dark = mode === 'dark';
  return {
    dark,
    blue: dark ? '#3987e5' : '#2a78d6',
    orange: dark ? '#d95926' : '#eb6834',
    aqua: dark ? '#199e70' : '#1baf7a',
    grid: dark ? '#374151' : '#e5e7eb',
    axis: '#9ca3af',
    label: dark ? '#e5e7eb' : '#374151',
    muted: dark ? '#9ca3af' : '#6b7280',
    surface: dark ? '#1f2937' : '#ffffff',
    tooltip: {
      backgroundColor: dark ? '#1f2937' : '#ffffff',
      border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`,
      borderRadius: '8px',
      fontSize: '12px',
      color: dark ? '#f9fafb' : '#111827',
    } as CSSProperties,
  };
}
