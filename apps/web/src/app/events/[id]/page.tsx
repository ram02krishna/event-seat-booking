'use client';

import { use, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { SeatMap, SeatData } from '@/components/seat-map/SeatMap';
import { CartPanel } from '@/components/seat-map/CartPanel';
import { Calendar, MapPin, Sparkles, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export default function EventSeatMapPage({ params }: EventPageProps) {
  const { id: eventId } = use(params);

  const { data, isLoading, isError, refetch } = useQuery<{
    eventId: string;
    venue: { id: string; name: string; layout: any };
    seats: SeatData[];
  }>({
    queryKey: ['events', eventId, 'seats'],
    queryFn: () => apiFetch(`/api/events/${eventId}/seats`),
    refetchInterval: 10000, // Poll fallback until Socket.IO in Phase 6
  });

  if (isLoading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-pulse">
        <div className="h-28 bg-slate-900 rounded-2xl border border-slate-800" />
        <div className="h-[520px] bg-slate-900 rounded-2xl border border-slate-800" />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Event Not Found</h2>
        <p className="text-sm text-slate-400">
          The event could not be loaded or does not exist.
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

  const { venue, seats } = data;
  const availableCount = seats.filter((s) => s.status === 'AVAILABLE').length;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Event Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/50 to-indigo-950/40 p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Live Availability
              </span>
              <span className="text-xs text-slate-400">
                {availableCount} of {seats.length} seats available
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Select Your Seats
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                <span>{venue.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Max 6 seats per customer</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => refetch()}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-700/60 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Map</span>
          </button>
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
