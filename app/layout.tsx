import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-provider';
import { BrandingProvider } from '@/lib/branding';
import { ThemeProvider, themeInitScript } from '@/lib/theme';
import AppShell from '@/components/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lead Analytics Dashboard',
  description: 'Spark Data Analytics Dashboard',
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Libre+Caslon+Display&family=Work+Sans:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Pinyon+Script&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <BrandingProvider>
            <AuthProvider>
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </BrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
