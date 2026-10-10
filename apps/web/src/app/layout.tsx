import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { Navbar } from '@/components/navbar';
import { BackendBanner } from '@/components/backend-banner';

export const metadata: Metadata = {
  title: 'Event Seat Booking & Live Ticketing',
  description: 'Reserve your seats with real-time availability and zero double-booking.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('app-theme') || localStorage.getItem('seatlock-theme');
                  var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  document.documentElement.classList.remove('light', 'dark');
                  document.documentElement.classList.add(theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col transition-colors duration-200">
        <Providers>
          <BackendBanner />
          <Navbar />
          <div className="flex-1">{children}</div>
        </Providers>
      </body>
    </html>
  );
}

