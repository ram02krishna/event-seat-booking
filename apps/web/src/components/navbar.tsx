'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Ticket, LayoutDashboard, ScanLine, LogOut, User } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch('/api/auth/me'),
    retry: false,
  });

  const user = data?.user;

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    queryClient.setQueryData(['auth', 'me'], null);
    await queryClient.invalidateQueries();
    router.push('/login');
  }

  const navLinks = [
    { href: '/', label: 'Events' },
    { href: '/my-tickets', label: 'My Tickets' },
    ...((user?.role === 'STAFF' || user?.role === 'ORGANIZER')
      ? [{ href: '/staff/scanner', label: 'Scanner', icon: ScanLine }]
      : []),
    ...(user?.role === 'ORGANIZER'
      ? [{ href: '/organizer', label: 'Dashboard', icon: LayoutDashboard }]
      : []),
  ];

  const roleColors: Record<string, string> = {
    ORGANIZER: 'text-violet-400 bg-violet-400/10',
    STAFF: 'text-emerald-400 bg-emerald-400/10',
    CUSTOMER: 'text-sky-400 bg-sky-400/10',
    ATTENDEE: 'text-sky-400 bg-sky-400/10',
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/60 bg-[#0a0e1a]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-6">

        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Ticket className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm text-white tracking-tight">SeatLock</span>
        </Link>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'text-white bg-slate-800'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: User / Auth */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {/* User pill */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-300 max-w-[140px] truncate">{user.email}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${roleColors[user.role] ?? roleColors.CUSTOMER}`}>
                  {user.role}
                </span>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                title="Sign out"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800/60 bg-[#0a0e1a]/95 px-2 py-1.5 text-xs font-medium">
        {navLinks.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1 rounded-md transition-colors ${
                active ? 'text-indigo-400' : 'text-slate-500 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        {user && (
          <button
            onClick={handleLogout}
            className="px-3 py-1 rounded-md text-slate-500 hover:text-white transition-colors"
          >
            Logout
          </button>
        )}
      </div>
    </header>
  );
}
