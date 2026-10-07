import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { Navbar } from '@/components/navbar';

export const metadata: Metadata = {
  title: 'SeatLock — Event Ticketing',
  description: 'Reserve your seats with real-time availability and zero double-booking.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0a0e1a] text-slate-100 min-h-screen flex flex-col">
        <Providers>
          <Navbar />
          <div className="flex-1">{children}</div>
          <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-600">
            SeatLock &copy; {new Date().getFullYear()} &mdash; Concurrency-Safe Ticketing
          </footer>
        </Providers>
      </body>
    </html>
  );
}
