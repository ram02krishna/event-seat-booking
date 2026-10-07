'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Ticket,
  Calendar,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  Printer,
  ShieldCheck,
  Sparkles,
  User,
  Clock,
} from 'lucide-react';
import { formatINR } from '@/lib/format';

interface TicketItem {
  id: string;
  qrToken: string;
  checkedInAt: string | null;
  seat: {
    section: string;
    row: string;
    number: number;
    tier: string;
  };
  price: number;
  qrDataUrl: string;
}

interface OrderItem {
  id: string;
  totalCents: number;
  createdAt: string;
  event: {
    id: string;
    title: string;
    startsAt: string;
    venue: {
      name: string;
    };
  };
  tickets: TicketItem[];
}

export default function MyTicketsPage() {
  const queryClient = useQueryClient();

  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch('/api/auth/me'),
    retry: false,
  });

  const user = authData?.user;

  const { data, isLoading, isError } = useQuery<{ orders: OrderItem[] }>({
    queryKey: ['my-tickets'],
    queryFn: () => apiFetch('/api/orders/my-tickets'),
    enabled: !!user,
    retry: false,
  });

  const orders = data?.orders || [];
  const isPageLoading = authLoading || (!!user && isLoading);

  async function handleQuickLogin(email: string) {
    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'password123' }),
      });
      await queryClient.invalidateQueries();
    } catch {
      // ignore
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 mb-2 transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Events
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">My Ticket Wallet</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              Verified
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Display your high-contrast QR codes directly at the venue gate turnstile for admission.
          </p>
        </div>

        {user && orders.length > 0 && (
          <button
            onClick={() => window.print()}
            className="self-start sm:self-auto px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span>Print Tickets</span>
          </button>
        )}
      </div>

      {isPageLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-48 bg-slate-900/60 rounded-3xl border border-slate-800" />
          <div className="h-48 bg-slate-900/60 rounded-3xl border border-slate-800" />
        </div>
      ) : !user || isError ? (
        <div className="max-w-md mx-auto p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-5 shadow-2xl backdrop-blur-xl">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
            <Ticket className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-white tracking-tight">Sign In to View Tickets</h2>
            <p className="text-xs text-slate-400">
              Your purchased concert and summit QR passes are tied to your customer account.
            </p>
          </div>

          <div className="pt-2 space-y-3">
            <Link
              href="/login"
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold block transition-all shadow-md shadow-indigo-600/30"
            >
              Sign In to Your Account
            </Link>

            <div className="pt-2 border-t border-slate-800 text-left">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider block mb-2 font-medium">
                1-Click Demo Login
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleQuickLogin('alice@example.com')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors text-center"
                >
                  Alice (Customer)
                </button>
                <button
                  onClick={() => handleQuickLogin('bob@example.com')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors text-center"
                >
                  Bob (Customer)
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-900/30 border border-slate-800 text-center space-y-4 max-w-lg mx-auto backdrop-blur-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-400">
            <Ticket className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No Tickets Found</h3>
            <p className="text-xs text-slate-400">
              You haven't reserved seats for any upcoming shows yet. Pick your seats on the interactive map to get started.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20"
            >
              <span>Explore Live Shows</span>
              <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {orders.map((order) => {
            const eventDate = new Date(order.event.startsAt).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-slate-800/90 bg-slate-900/40 overflow-hidden shadow-xl backdrop-blur-sm"
              >
                {/* Order Header Banner */}
                <div className="p-5 sm:p-6 border-b border-slate-800/80 bg-slate-950/60 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        Order #{order.id.slice(0, 8)}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {order.event.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{eventDate}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{order.event.venue.name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Total Paid
                    </span>
                    <span className="font-mono text-xl font-bold text-emerald-400">
                      {formatINR(order.totalCents)}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {order.tickets.length} {order.tickets.length === 1 ? 'Seat Reserved' : 'Seats Reserved'}
                    </div>
                  </div>
                </div>

                {/* Tickets Grid - Boarding Pass Style */}
                <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                  {order.tickets.map((t) => {
                    const tierThemes: Record<string, { badge: string; border: string; accent: string }> = {
                      VIP: {
                        badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                        border: 'border-amber-500/20',
                        accent: 'text-amber-400',
                      },
                      PREMIUM: {
                        badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
                        border: 'border-indigo-500/20',
                        accent: 'text-indigo-400',
                      },
                      STANDARD: {
                        badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
                        border: 'border-cyan-500/20',
                        accent: 'text-cyan-400',
                      },
                    };
                    const theme = tierThemes[t.seat.tier] || tierThemes.STANDARD;

                    return (
                      <div
                        key={t.id}
                        className={`relative rounded-2xl border ${theme.border} bg-slate-950/80 p-5 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-lg group hover:border-slate-700 transition-all`}
                      >
                        {/* Left Stub: Seat Details */}
                        <div className="space-y-3 w-full sm:w-auto">
                          <div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${theme.badge}`}>
                              {t.seat.tier} Tier
                            </span>
                            <div className="text-2xl font-black text-white font-mono mt-1.5 tracking-tight">
                              Row {t.seat.row} • Seat {t.seat.number}
                            </div>
                            <span className="text-xs text-slate-400 block mt-0.5">
                              Section: <strong className="text-slate-300">{t.seat.section}</strong>
                            </span>
                          </div>

                          <div className="pt-1 flex items-center gap-3">
                            {t.checkedInAt ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                <Clock className="w-3 h-3 text-slate-400" />
                                Checked In
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Valid For Entry
                              </span>
                            )}

                            <span className="text-xs font-mono font-semibold text-slate-400">
                              {formatINR(t.price)}
                            </span>
                          </div>
                        </div>

                        {/* Perforated divider on mobile: border-t, on desktop: border-l */}
                        <div className="hidden sm:block border-l border-dashed border-slate-800 h-28 mx-1" />

                        {/* Right Stub: QR Code */}
                        <div className="shrink-0 flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-inner">
                          <div className="bg-white p-2 rounded-lg shadow-md">
                            <img
                              src={t.qrDataUrl}
                              alt="Ticket Turnstile QR"
                              className="w-24 h-24 object-contain"
                            />
                          </div>
                          <span className="text-[9px] font-mono text-slate-400 mt-2 tracking-widest uppercase">
                            {t.qrToken.slice(0, 8)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </main>
  );
}
