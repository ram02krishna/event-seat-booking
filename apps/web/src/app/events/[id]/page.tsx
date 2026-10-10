'use client';

import { use, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { SeatMap, SeatData } from '@/components/seat-map/SeatMap';
import { CartPanel } from '@/components/seat-map/CartPanel';
import { useCartStore } from '@/store/cartStore';
import { useEventSocket } from '@/hooks/useEventSocket';
import { Calendar, MapPin, RefreshCw, ArrowLeft, Users } from 'lucide-react';
import Link from 'next/link';
import { formatEventDateTime } from '@/lib/format';

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export default function EventSeatMapPage({ params }: EventPageProps) {
  const { id: eventId } = use(params);
  useEventSocket(eventId);

  const {
    eventId: cartEventId,
    heldSeatIds,
    holdExpiresAt,
    restoreHold,
    clearHold,
    setEventId,
  } = useCartStore();

  useEffect(() => {
    setEventId(eventId);
  }, [eventId, setEventId]);

  const { data, isLoading, isError, refetch } = useQuery<{
    eventId: string;
    event?: { id: string; title: string; description?: string; startsAt: string };
    venue: { id: string; name: string; layout: any };
    seats: SeatData[];
  }>({
    queryKey: ['events', eventId, 'seats'],
    queryFn: () => apiFetch(`/api/events/${eventId}/seats`),
    staleTime: 10000,
  });

  // Synchronize active holds from server to cartStore so payment button and timer are active
  useEffect(() => {
    if (!data?.seats) return;

    const now = new Date();
    const myHeldSeats = data.seats.filter(
      (s) => s.status === 'HELD' && s.isHeldByMe && s.holdExpiresAt && new Date(s.holdExpiresAt) > now
    );

    if (myHeldSeats.length > 0) {
      const earliestExpiry = myHeldSeats.reduce((earliest, s) => {
        if (!s.holdExpiresAt) return earliest;
        return earliest
          ? new Date(s.holdExpiresAt) < new Date(earliest)
            ? s.holdExpiresAt
            : earliest
          : s.holdExpiresAt;
      }, myHeldSeats[0]?.holdExpiresAt || null);

      if (earliestExpiry) {
        restoreHold(
          eventId,
          myHeldSeats.map((s) => ({
            id: s.id,
            seatId: s.seatId,
            section: s.section,
            row: s.row,
            number: s.number,
            tier: s.tier,
            price: s.price,
          })),
          earliestExpiry
        );
      }
    } else if (cartEventId === eventId && heldSeatIds.length > 0) {
      if (!holdExpiresAt || new Date(holdExpiresAt) <= now) {
        clearHold();
      }
    }
  }, [data?.seats, eventId, cartEventId, heldSeatIds.length, holdExpiresAt, restoreHold, clearHold]);

  if (isLoading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-5 animate-pulse">
        <div className="h-24 bg-slate-800/40 rounded-2xl border border-slate-800" />
        <div className="h-[500px] bg-slate-800/40 rounded-2xl border border-slate-800" />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="max-w-sm mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-lg font-semibold text-white">Event Not Found</h2>
        <p className="text-sm text-slate-400">This event could not be found or has ended.</p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          Back to Events
        </Link>
      </main>
    );
  }

  const { venue, seats, event } = data;
  const availableCount = seats.filter((s) => s.status === 'AVAILABLE').length;

  const eventDate = event?.startsAt ? formatEventDateTime(event.startsAt) : null;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Event header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-800/20 px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Link
              href="/"
              className="text-xs text-slate-500 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              All Events
            </Link>
            <h1 className="text-lg font-bold text-white">
              {event?.title || 'Venue Seat Map'}
            </h1>
            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {venue.name}
              </span>
              {eventDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {eventDate}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {availableCount} of {seats.length} seats available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                <span className="text-emerald-400">Live</span>
              </span>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-sm text-slate-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Seat map */}
      <SeatMap seats={seats} venueLayout={venue.layout} />

      {/* Cart drawer */}
      <CartPanel
        eventId={eventId}
        onHoldSuccess={() => refetch()}
        onReleaseSuccess={() => refetch()}
      />
    </main>
  );
}
