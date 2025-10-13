import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mira Mar Leads - Analytics Dashboard',
  description: 'Spark Data Analytics Dashboard for Mira Mar',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
