'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  GitCompareArrows,
  Palette,
  Sun,
  Moon,
  ChevronUp,
  Settings as SettingsIcon,
  Users as UsersIcon,
  LogOut,
  Menu,
  X,
  FileBarChart,
} from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth-provider';
import { useBranding, BrandLogo } from '@/lib/branding';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
};

const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Spark Reporting',
    icon: LayoutDashboard,
    children: [
      { href: '/executive-summary', label: 'Executive Summary', icon: FileBarChart },
    ],
  },
  { href: '/reconciliation', label: 'Reconcile', icon: GitCompareArrows },
  { href: '/design-system', label: 'Design System', icon: Palette },
];

const NO_SHELL_PREFIXES = ['/login', '/auth'];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const { isAdmin, profile, user, signOut } = useAuth();
  const { title: brandTitle } = useBranding();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const skipShell = NO_SHELL_PREFIXES.some((p) => pathname?.startsWith(p));
  if (skipShell) return <>{children}</>;

  const displayName =
    profile?.full_name?.trim() ||
    profile?.email ||
    user?.email ||
    'Account';
  const initial = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await signOut();
    } catch {
      /* fallthrough — auth-provider already redirects */
    }
  };

  const sidebarBody = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5">
        <Link href="/" className="flex items-center gap-3 group">
          <BrandLogo size={36} />
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Mira Mar
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {brandTitle}
            </div>
          </div>
        </Link>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-800" />

      {/* Nav links */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, children }) => {
          const parentActive =
            href === '/'
              ? pathname === '/'
              : isActive(pathname, href);
          const childActive = (children || []).some((c) => isActive(pathname, c.href));
          const active = parentActive && !childActive;
          const showChildren =
            !!children && (parentActive || childActive);
          return (
            <div key={href}>
              <Link
                href={href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-blue-600 dark:bg-blue-400" />
                )}
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </Link>
              {showChildren && (
                <div className="mt-1 ml-4 pl-4 border-l border-gray-200 dark:border-gray-800 space-y-1">
                  {children!.map(({ href: childHref, label: childLabel, icon: ChildIcon }) => {
                    const cActive = isActive(pathname, childHref);
                    return (
                      <Link
                        key={childHref}
                        href={childHref}
                        className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                          cActive
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        {cActive && (
                          <span className="absolute -left-4 top-2 bottom-2 w-0.5 rounded-r-full bg-blue-600 dark:bg-blue-400" />
                        )}
                        <ChildIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{childLabel}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Mode toggle — segmented sun/moon */}
      <div className="px-4 pb-3">
        <div
          className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1"
          role="tablist"
          aria-label="Theme mode"
        >
          <button
            type="button"
            onClick={() => setMode('light')}
            aria-pressed={mode === 'light'}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              mode === 'light'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            Light
          </button>
          <button
            type="button"
            onClick={() => setMode('dark')}
            aria-pressed={mode === 'dark'}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              mode === 'dark'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            Dark
          </button>
        </div>
      </div>

      {/* User pill + popover */}
      <div className="relative px-3 pb-3" ref={menuRef}>
        {menuOpen && (
          <div
            role="menu"
            aria-label="Account menu"
            className="absolute left-3 right-3 bottom-[72px] bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                router.push('/settings');
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <SettingsIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              Settings
            </button>
            {isAdmin && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  router.push('/admin/users');
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <UsersIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                Users
              </button>
            )}
            <div className="h-px bg-gray-200 dark:bg-gray-700" />
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <LogOut className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              Logout
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            menuOpen
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-semibold shrink-0">
            {initial}
          </span>
          <span className="flex-1 text-left truncate">{displayName}</span>
          <ChevronUp
            className={`w-4 h-4 text-gray-400 transition-transform ${menuOpen ? '' : 'rotate-180'}`}
          />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      {/* Desktop sidebar — viewport-fixed so the user pill is always visible */}
      <aside className="hidden md:flex fixed left-0 top-0 z-40 h-screen w-64 lg:w-72 flex-col border-r border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/80 backdrop-blur-xl">
        {sidebarBody}
      </aside>

      {/* Mobile drawer + backdrop */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-xl flex flex-col">
            <div className="absolute top-3 right-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {sidebarBody}
          </aside>
        </div>
      )}

      {/* Main column — pushed by sidebar width on desktop */}
      <div className="md:ml-64 lg:ml-72 flex flex-col min-h-screen min-w-0">
        {/* Mobile top bar with hamburger */}
        <div className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <BrandLogo size={28} />
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {brandTitle}
          </span>
        </div>

        <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
