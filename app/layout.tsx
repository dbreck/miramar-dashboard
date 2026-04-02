import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-provider';
import { BrandingProvider } from '@/lib/branding';
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
      <body className="antialiased">
        <BrandingProvider>
          <AuthProvider>{children}</AuthProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
