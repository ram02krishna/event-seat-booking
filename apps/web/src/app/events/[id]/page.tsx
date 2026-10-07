'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { SeatMap, SeatData } from '@/components/seat-map/SeatMap';
import { CartPanel } from '@/components/seat-map/CartPanel';
import { useEventSocket } from '@/hooks/useEventSocket';
import { Calendar, MapPin, Sparkles, RefreshCw, ArrowLeft, Radio } from 'lucide-react';
import Link from 'next/link';

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export default function EventSeatMapPage({ params }: EventPageProps) {
  const { id: eventId } = use(params);

  // Real-time Socket.IO room sync
  useEventSocket(eventId);

  const { data, isLoading, isError, refetch } = useQuery<{
    eventId: string;
    event?: {
      id: string;
      title: string;
      description?: string;
      startsAt: string;
    };
    venue: { id: string; name: string; layout: any };
    seats: SeatData[];
  }>({
    queryKey: ['events', eventId, 'seats'],
    queryFn: () => apiFetch(`/api/events/${eventId}/seats`),
    staleTime: 10000,
  });

  if (isLoading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-pulse">
        <div className="h-28 bg-slate-900/60 rounded-3xl border border-slate-800" />
        <div className="h-[520px] bg-slate-900/60 rounded-3xl border border-slate-800" />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Event Not Found</h2>
        <p className="text-sm text-slate-400">
          The requested event could not be found or has concluded.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
        >
          Back to Events
        </Link>
      </main>
    );
  }

  const { venue, seats, event } = data;
  const availableCount = seats.filter((s) => s.status === 'AVAILABLE').length;

  const eventDate = event?.startsAt
    ? new Date(event.startsAt).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Event Header Banner Card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-r from-slate-950/90 via-slate-900/80 to-indigo-950/40 p-6 sm:p-7 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors group mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Back to All Shows</span>
            </Link>

            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Sockets Active
              </span>
              <span className="text-xs font-mono text-slate-400">
                {availableCount} of {seats.length} seats free
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {event?.title || 'Interactive Venue Seat Map'}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                <span>{venue.name}</span>
              </div>
              {eventDate && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{eventDate}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Max 6 seats per hold</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-800 transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Map</span>
            </button>
          </div>
        </div>
      </div>

      {/* SVG Interactive Seat Map */}
      <SeatMap seats={seats} venueLayout={venue.layout} />

      {/* Slide-in Cart & Hold Drawer */}
      <CartPanel
        eventId={eventId}
        onHoldSuccess={() => refetch()}
        onReleaseSuccess={() => refetch()}
      />
    </main>
  );
}
