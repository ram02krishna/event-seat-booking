'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { Calendar, MapPin, ArrowRight, Users } from 'lucide-react';
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
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Upcoming Events
        </h1>
        <p className="text-sm text-slate-400">
          Browse events and reserve your seats in real time.
        </p>
      </div>

      {/* Events */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="h-40 rounded-2xl bg-slate-800/40 border border-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-center space-y-1">
          <p className="text-rose-400 text-sm font-medium">Could not load events.</p>
          <p className="text-slate-500 text-xs">Make sure the API server is running on port 4000.</p>
        </div>
      ) : events.length === 0 ? (
        <div className="p-10 rounded-2xl bg-slate-800/30 border border-slate-800 text-center space-y-1">
          <p className="text-slate-300 text-sm">No events available.</p>
          <p className="text-slate-500 text-xs">Run the seed script to generate sample events.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const eventDate = new Date(event.startsAt).toLocaleDateString('en-IN', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const eventTime = new Date(event.startsAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            });

            const booked = event.totalSeats > 0
              ? Math.round(((event.totalSeats - event.availableSeats) / event.totalSeats) * 100)
              : 0;

            return (
              <div
                key={event.id}
                className="group flex flex-col sm:flex-row sm:items-center gap-6 p-6 rounded-2xl bg-slate-800/30 hover:bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition-all"
              >
                {/* Main Info */}
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <h2 className="text-base font-semibold text-white truncate">{event.title}</h2>
                    <p className="text-sm text-slate-400 line-clamp-1 mt-0.5">
                      {event.description || 'Live seated event with real-time availability.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {eventDate} &bull; {eventTime}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {event.venue.name}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {event.availableSeats} seats left
                    </span>
                  </div>

                  {/* Capacity bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1 rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${booked}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-500 tabular-nums w-8 text-right">{booked}%</span>
                  </div>
                </div>

                {/* Right: Price + CTA */}
                <div className="flex sm:flex-col items-center sm:items-end gap-4 sm:gap-2 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 block">From</span>
                    <span className="text-lg font-bold text-white font-mono">{CURRENCY_SYMBOL}750</span>
                  </div>
                  <Link
                    href={`/events/${event.id}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    Select Seats
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
