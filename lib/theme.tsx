'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Palette = 'miramar' | 'classic';
export type Mode = 'light' | 'dark';

interface ThemeContextValue {
  palette: Palette;
  mode: Mode;
  setPalette: (p: Palette) => void;
  setMode: (m: Mode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_PALETTE = 'palette';
const STORAGE_MODE = 'darkMode';

function applyToDocument(palette: Palette, mode: Mode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-palette', palette);
  if (mode === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [palette, setPaletteState] = useState<Palette>('miramar');
  const [mode, setModeState] = useState<Mode>('dark');

  useEffect(() => {
    const savedPalette = (localStorage.getItem(STORAGE_PALETTE) as Palette | null) || 'miramar';
    const savedMode = localStorage.getItem(STORAGE_MODE);
    const isDark = savedMode === null ? true : savedMode === 'true';
    const nextMode: Mode = isDark ? 'dark' : 'light';
    setPaletteState(savedPalette);
    setModeState(nextMode);
    applyToDocument(savedPalette, nextMode);
  }, []);

  const setPalette = (p: Palette) => {
    setPaletteState(p);
    localStorage.setItem(STORAGE_PALETTE, p);
    applyToDocument(p, mode);
  };

  const setMode = (m: Mode) => {
    setModeState(m);
    localStorage.setItem(STORAGE_MODE, String(m === 'dark'));
    applyToDocument(palette, m);
  };

  const toggleMode = () => setMode(mode === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ palette, mode, setPalette, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/**
 * Inline init script — runs before React hydrates so the
 * page paints in the correct palette/mode and skips FOUC.
 */
export const themeInitScript = `
(function() {
  try {
    var p = localStorage.getItem('${STORAGE_PALETTE}') || 'miramar';
    var m = localStorage.getItem('${STORAGE_MODE}');
    var isDark = m === null ? true : m === 'true';
    document.documentElement.setAttribute('data-palette', p);
    if (isDark) document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`;
