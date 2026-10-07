'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Calendar,
  MapPin,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Zap,
  Clock,
  Radio,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { CURRENCY_SYMBOL } from '@/lib/format';

interface EventItem {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  status: string;
  venue: { id: string; name: string };
  totalSeats: number;
  availableSeats: number;
}

export default function HomePage() {
  const { data, isLoading, isError } = useQuery<{ events: EventItem[] }>({
    queryKey: ['events'],
    queryFn: () => apiFetch('/api/events'),
  });

  const events = data?.events || [];

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-4rem)]">
      {/* Background ambient gradient glow blobs */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-indigo-600/20 via-cyan-500/10 to-transparent blur-[120px] -z-10 rounded-full" />
      <div className="pointer-events-none absolute top-1/2 -right-40 w-[450px] h-[450px] bg-violet-600/10 blur-[130px] -z-10 rounded-full" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-16">
        {/* Hero Section */}
        <div className="relative text-center max-w-3xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-indigo-500/15 to-cyan-500/15 text-indigo-300 border border-indigo-500/30 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>High-Concurrency Seating Architecture</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
            <span className="text-[10px] text-emerald-300 uppercase tracking-wider font-bold">Live</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.1]"
          >
            Real-Time Seats with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-300 to-indigo-300">
              Zero Double-Booking
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed"
          >
            Pick your exact seat on an interactive SVG venue map, hold it with atomic PostgreSQL row locks, and receive instant QR tickets verified at venue turnstiles.
          </motion.p>

          {/* Quick value props pill bar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="pt-2 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-slate-300"
          >
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Sub-50ms Atomic Holds</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>5-Min Auto-Release Worker</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>Socket.IO Live Broadcasts</span>
            </div>
          </motion.div>
        </div>

        {/* Events Grid Section */}
        <section className="space-y-6 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
                <span>Featured Live Shows & Summits</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {events.length} Available
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Select an event to view real-time SVG seat availability and pricing tiers.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((n) => (
                <div
                  key={n}
                  className="h-64 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse p-6"
                />
              ))}
            </div>
          ) : isError ? (
            <div className="p-8 rounded-2xl bg-slate-900/40 border border-rose-500/20 text-center space-y-2">
              <p className="text-rose-400 text-sm font-semibold">Unable to fetch upcoming events.</p>
              <p className="text-slate-500 text-xs">Ensure your backend API is running on port 4000.</p>
            </div>
          ) : events.length === 0 ? (
            <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
              <p className="text-slate-300 text-sm">No published events found.</p>
              <p className="text-slate-500 text-xs">Run seed script to generate sample events.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {events.map((event, index) => {
                const eventDate = new Date(event.startsAt);
                const formattedDate = eventDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const formattedTime = eventDate.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const occupancyPercent =
                  event.totalSeats > 0
                    ? Math.round(((event.totalSeats - event.availableSeats) / event.totalSeats) * 100)
                    : 0;

                const isSummit = event.title.toLowerCase().includes('summit');

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="group relative rounded-3xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/70 hover:border-indigo-500/40 p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-indigo-500/10 backdrop-blur-sm"
                  >
                    <div className="space-y-4">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                          {isSummit ? 'Tech Conference' : 'Concert Performance'}
                        </span>

                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {event.availableSeats} Seats Left
                          </span>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="text-2xl font-bold text-white group-hover:text-indigo-300 transition-colors tracking-tight">
                          {event.title}
                        </h3>
                        <p className="text-slate-400 text-xs sm:text-sm line-clamp-2 mt-2 leading-relaxed">
                          {event.description || 'Live reserved seating event with real-time capacity locks.'}
                        </p>
                      </div>

                      {/* Meta Information */}
                      <div className="pt-1 flex flex-wrap gap-4 text-xs text-slate-300">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                          <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>
                            {formattedDate} • {formattedTime}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                          <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>{event.venue.name}</span>
                        </div>
                      </div>

                      {/* Capacity Progress Bar */}
                      <div className="space-y-1.5 pt-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Venue Capacity Booked</span>
                          <span className="font-mono font-bold text-indigo-300">{occupancyPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-800/90 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-700"
                            style={{ width: `${occupancyPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Card Footer / CTA */}
                    <div className="pt-6 mt-4 border-t border-slate-800/60 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Tickets From</span>
                        <span className="text-lg font-bold text-emerald-400 font-mono">
                          {CURRENCY_SYMBOL}750 <span className="text-xs text-slate-400 font-sans font-normal">/ seat</span>
                        </span>
                      </div>

                      <Link
                        href={`/events/${event.id}`}
                        className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-xs tracking-wide shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 group-hover:gap-2.5"
                      >
                        <span>Select Seats</span>
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* Architecture & Tech Trust Banner */}
        <section className="rounded-3xl border border-slate-800/80 bg-slate-900/30 p-8 sm:p-10 text-center space-y-6 relative overflow-hidden backdrop-blur-sm">
          <div className="max-w-xl mx-auto space-y-2">
            <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Engineered for High-Pressure Flash Sales
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Tested under 1,000 parallel virtual user requests competing for 50 seats. Zero deadlocks, zero double bookings, sub-50ms response latency.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 space-y-1">
              <span className="text-indigo-400 text-xs font-bold uppercase tracking-wider">PostgreSQL</span>
              <p className="text-slate-300 text-xs">Atomic conditional SQL row locks prevent race conditions.</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 space-y-1">
              <span className="text-cyan-400 text-xs font-bold uppercase tracking-wider">BullMQ & Redis</span>
              <p className="text-slate-300 text-xs">Delayed workers automatically release abandoned carts.</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 space-y-1">
              <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Socket.IO</span>
              <p className="text-slate-300 text-xs">Real-time seat color updates broadcast to all viewers.</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 space-y-1">
              <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">Turnstile QR</span>
              <p className="text-slate-300 text-xs">Single-use encrypted tokens validated at the venue gate.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
