'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  IndianRupee,
  Ticket,
  TrendingUp,
  Building,
  Calendar,
  ShieldCheck,
  ExternalLink,
  Users,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { formatINR } from '@/lib/format';

interface TierStat {
  tier: string;
  total: number;
  sold: number;
  held: number;
  available: number;
  price: number;
  revenue: number;
  occupancyRate: number;
}

interface EventStatsResponse {
  event: {
    id: string;
    title: string;
    description?: string;
    startsAt: string;
    venueName: string;
  };
  overview: {
    totalSeats: number;
    soldSeats: number;
    heldSeats: number;
    availableSeats: number;
    occupancyRate: number;
    revenueCents: number;
  };
  checkIn: {
    totalTickets: number;
    checkedInCount: number;
    checkInRate: number;
  };
  tiers: TierStat[];
  recentOrders: Array<{
    id: string;
    userEmail: string;
    totalCents: number;
    createdAt: string;
    seats: string[];
  }>;
}

export default function EventAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.id;

  const { data, isLoading, error } = useQuery<EventStatsResponse>({
    queryKey: ['organizer', 'event', eventId, 'stats'],
    queryFn: () => apiFetch(`/api/organizer/events/${eventId}/stats`),
    refetchInterval: 6000, // live refresh every 6 seconds
  });

  if (isLoading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-400">
        Loading event telemetry...
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          Failed to load event statistics. Make sure you are signed in with an organizer account.
        </div>
        <Link
          href="/organizer"
          className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Organizer Dashboard
        </Link>
      </main>
    );
  }

  const { event, overview, checkIn, tiers, recentOrders } = data;
  const startDate = new Date(event.startsAt);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Navigation & Header */}
      <div className="space-y-4">
        <Link
          href="/organizer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {event.title}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Live Event
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
              <span className="flex items-center gap-1.5">
                <Building className="w-4 h-4 text-slate-500" />
                {event.venueName}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-500" />
                {startDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                at{' '}
                {startDate.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/events/${event.id}`}
              target="_blank"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Live Seat Map
            </Link>
            <Link
              href="/staff/scanner"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              Open Gate Scanner
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-medium">
            <span>Show Revenue</span>
            <IndianRupee className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white tracking-tight">
            {formatINR(overview.revenueCents)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Collected across {overview.soldSeats} booked seats
          </div>
        </motion.div>

        {/* Occupancy */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-medium">
            <span>Occupancy</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white tracking-tight">
            {overview.occupancyRate}%
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-700"
              style={{ width: `${overview.occupancyRate}%` }}
            />
          </div>
        </motion.div>

        {/* Sold Seats Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-medium">
            <span>Seats Status</span>
            <Ticket className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white tracking-tight">
            {overview.soldSeats}
            <span className="text-sm font-normal text-slate-500 ml-1.5">/ {overview.totalSeats}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
            <span className="text-amber-400">{overview.heldSeats} in cart</span> •{' '}
            <span className="text-slate-400">{overview.availableSeats} available</span>
          </div>
        </motion.div>

        {/* Live Gate Check-in Telemetry */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-5 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between text-emerald-400 text-xs uppercase tracking-wider font-medium">
            <span>Gate Check-Ins</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white tracking-tight">
            {checkIn.checkedInCount}
            <span className="text-sm font-normal text-slate-400 ml-1.5">/ {checkIn.totalTickets} entered</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-700"
              style={{ width: `${checkIn.checkInRate}%` }}
            />
          </div>
          <div className="text-[11px] text-emerald-400/90 mt-1 font-medium">
            {checkIn.checkInRate}% checked in at gate
          </div>
        </motion.div>
      </div>

      {/* Tier Performance Breakdown */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          <span>Seating Tier Breakdown</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((t) => {
            const tierColors: Record<string, { badge: string; border: string; accent: string }> = {
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
            const theme = tierColors[t.tier] || tierColors.STANDARD;

            return (
              <div
                key={t.tier}
                className={`rounded-2xl border ${theme.border} bg-slate-900/40 p-5 space-y-4 backdrop-blur-sm`}
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${theme.badge}`}>
                    {t.tier}
                  </span>
                  <span className="text-xs font-bold text-slate-300">
                    {formatINR(t.price)} <span className="text-[10px] font-normal text-slate-500">/ seat</span>
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">Occupancy</span>
                    <span className="font-bold text-white">{t.occupancyRate}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-700"
                      style={{ width: `${t.occupancyRate}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-800/60">
                  <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/40">
                    <div className="text-xs font-bold text-emerald-400">{t.sold}</div>
                    <div className="text-[10px] text-slate-500">Sold</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/40">
                    <div className="text-xs font-bold text-amber-400">{t.held}</div>
                    <div className="text-[10px] text-slate-500">Held</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/40 border border-slate-800/40">
                    <div className="text-xs font-bold text-slate-300">{t.available}</div>
                    <div className="text-[10px] text-slate-500">Avail</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                  <span className="text-slate-400">Tier Revenue</span>
                  <span className="font-bold text-emerald-400">{formatINR(t.revenue)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Confirmed Orders for this event */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-400" />
          <span>Attendee Bookings</span>
          <span className="text-xs font-normal text-slate-400">({recentOrders.length})</span>
        </h2>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 font-medium">Order ID</th>
                  <th className="px-4 py-3 font-medium">Customer Email</th>
                  <th className="px-4 py-3 font-medium">Assigned Seats</th>
                  <th className="px-4 py-3 font-medium text-right">Total Paid</th>
                  <th className="px-4 py-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No attendee bookings yet for this event.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => {
                    const orderDate = new Date(order.createdAt);
                    return (
                      <tr key={order.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                          {order.id.slice(0, 8)}...
                        </td>
                        <td className="px-4 py-3 font-medium text-white">{order.userEmail}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {order.seats.map((seatLabel) => (
                              <span
                                key={seatLabel}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                              >
                                {seatLabel}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                          {formatINR(order.totalCents)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 text-[11px]">
                          {orderDate.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
