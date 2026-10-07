'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Ticket, ShieldCheck, LogOut, LayoutDashboard, UserCheck } from 'lucide-react';

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
      // ignore error on logout
    }
    queryClient.setQueryData(['auth', 'me'], null);
    await queryClient.invalidateQueries();
    router.push('/login');
  }

  const navLinks = [
    { href: '/', label: 'Events' },
    { href: '/my-tickets', label: 'My Tickets' },
    ...((user?.role === 'STAFF' || user?.role === 'ORGANIZER')
      ? [{ href: '/staff/scanner', label: 'Scanner', icon: ShieldCheck, badge: 'Staff' }]
      : []),
    ...(user?.role === 'ORGANIZER'
      ? [{ href: '/organizer', label: 'Organizer', icon: LayoutDashboard, badge: 'Console' }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 group-hover:shadow-indigo-500/40 transition-all duration-200">
            <Ticket className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white flex items-center">
            Seat<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Lock</span>
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'text-white bg-indigo-600/20 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5 text-indigo-400" />}
                <span>{link.label}</span>
                {link.badge && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider font-bold bg-indigo-500/20 text-indigo-300">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Session & Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              {/* User badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs shadow-inner">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-200 font-medium max-w-[130px] sm:max-w-[180px] truncate">
                  {user.email}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {user.role}
                </span>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 bg-slate-900/40 hover:bg-rose-500/10 border border-slate-800/60 hover:border-rose-500/30 transition-all flex items-center gap-1.5 shadow-sm"
                title="Sign out of your account"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400/80" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white transition-all shadow-md shadow-indigo-600/25 flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile nav sub-bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-900 bg-slate-950/60 px-4 py-2 text-xs font-semibold">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                isActive ? 'text-indigo-400 bg-indigo-500/10 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
