'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface BrandingContextType {
  branded: boolean;
  title: string;
  toggleBranding: () => void;
}

const BrandingContext = createContext<BrandingContextType>({
  branded: true,
  title: 'Mira Mar Leads',
  toggleBranding: () => {},
});

export function useBranding() {
  return useContext(BrandingContext);
}

const UNBRANDED_HOST = 'lead-analytics-dash.vercel.app';

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branded, setBranded] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Check localStorage override first
    const override = localStorage.getItem('branding-override');
    if (override !== null) {
      setBranded(override === 'branded');
    } else {
      // Default based on hostname
      setBranded(window.location.hostname !== UNBRANDED_HOST);
    }
    setMounted(true);
  }, []);

  // Update document title when branding changes
  useEffect(() => {
    if (!mounted) return;
    document.title = branded ? 'Mira Mar Leads - Analytics Dashboard' : 'Lead Analytics Dashboard';

    // Update favicon
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (link) {
      link.href = branded ? '/logo.png' : '/favicon.svg';
    }
  }, [branded, mounted]);

  function toggleBranding() {
    const next = !branded;
    setBranded(next);
    localStorage.setItem('branding-override', next ? 'branded' : 'unbranded');
  }

  const title = branded ? 'Mira Mar Leads' : 'Lead Analytics';

  return (
    <BrandingContext.Provider value={{ branded, title, toggleBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

/** Branded logo (Mira Mar) or generic chart icon */
export function BrandLogo({ size = 40 }: { size?: number }) {
  const { branded } = useBranding();
  if (branded) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/logo.png" alt="Logo" width={size} height={size} className="rounded-lg" />;
  }
  const iconSize = Math.round(size * 0.6);
  return (
    <div className="rounded-lg bg-blue-600 flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
    </div>
  );
}
