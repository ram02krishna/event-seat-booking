'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { Calendar, MapPin, ArrowRight, Users, RefreshCw } from 'lucide-react';
import { formatINR, formatEventDate, formatEventTime } from '@/lib/format';
import { ActiveHoldBanner, ActiveHoldInfo } from '@/components/ActiveHoldBanner';
import { VenueBadge } from '@/components/venue-badge';

interface EventItem {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  status: string;
  venue: { id: string; name: string; layout?: any };
  totalSeats: number;
  availableSeats: number;
  minPrice?: number;
}

const VENUE_FILTERS = [
  { label: 'All Venues', value: 'ALL' },
  { label: '🎬 Dolby Atmos', value: 'THEATER_DOLBY' },
  { label: '🏢 Conference', value: 'CONFERENCE_HALL' },
  { label: '🎭 Auditorium', value: 'AUDITORIUM' },
  { label: '🏟️ Concert Arena', value: 'ARENA' },
];

export default function HomePage() {
  const queryClient = useQueryClient();
  const [selectedVenueFilter, setSelectedVenueFilter] = useState<string>('ALL');

  const { data, isLoading, isError, refetch } = useQuery<{ events: EventItem[] }>({
    queryKey: ['events'],
    queryFn: () => apiFetch('/api/events'),
  });

  const handlePrefetch = (eventId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['events', eventId, 'seats'],
      queryFn: () => apiFetch(`/api/events/${eventId}/seats`),
      staleTime: 30000,
    });
  };

  const { data: holdData, refetch: refetchHold } = useQuery<{ hold: ActiveHoldInfo | null }>({
    queryKey: ['active-hold'],
    queryFn: () => apiFetch('/api/events/active-hold'),
    refetchInterval: 5000,
  });

  const events = data?.events || [];
  const filteredEvents =
    selectedVenueFilter === 'ALL'
      ? events
      : events.filter((e) => e.venue?.layout?.type === selectedVenueFilter);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Active hold banner if user has seats on hold */}
      {holdData?.hold && (
        <ActiveHoldBanner hold={holdData.hold} onReleased={() => refetchHold()} />
      )}

      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Upcoming Events
          </h1>
          <p className="text-sm text-slate-400">
            Browse events and reserve your seats in real time.
          </p>
        </div>

        {/* Venue Layout Filter Tabs */}
        {events.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {VENUE_FILTERS.map((filter) => {
              const isActive = selectedVenueFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  onClick={() => setSelectedVenueFilter(filter.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'bg-slate-800/40 text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-800/80'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        )}
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
        <div className="p-6 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 text-center space-y-3">
          <p className="text-indigo-300 text-sm font-medium">Could not load events yet.</p>
          <p className="text-slate-400 text-xs max-w-md mx-auto">
            If the backend is waking up from Render&apos;s free tier sleep, cold boot takes about 30–60 seconds.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Loading Events
          </button>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-10 rounded-2xl bg-slate-800/30 border border-slate-800 text-center space-y-3">
          <p className="text-slate-300 text-sm font-semibold">
            {events.length === 0
              ? 'No upcoming events scheduled right now.'
              : 'No events found for this venue category.'}
          </p>
          <p className="text-slate-500 text-xs max-w-sm mx-auto">
            {events.length === 0
              ? 'Check back soon for new theatre plays, concerts, cinema screenings, and live seated performances.'
              : 'Try selecting "All Venues" to view all live seated events.'}
          </p>
          {events.length === 0 ? (
            <Link
              href="/login"
              className="inline-block mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
            >
              Organizer Sign In
            </Link>
          ) : (
            <button
              onClick={() => setSelectedVenueFilter('ALL')}
              className="inline-block mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
            >
              Show All Venues
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) => {
            const eventDate = formatEventDate(event.startsAt);
            const eventTime = formatEventTime(event.startsAt);

            const booked = event.totalSeats > 0
              ? Math.round(((event.totalSeats - event.availableSeats) / event.totalSeats) * 100)
              : 0;

            return (
              <div
                key={event.id}
                onMouseEnter={() => handlePrefetch(event.id)}
                onTouchStart={() => handlePrefetch(event.id)}
                className="group flex flex-col sm:flex-row sm:items-center gap-6 p-6 rounded-2xl bg-slate-800/30 hover:bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition-all"
              >
                {/* Main Info */}
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    {event.venue?.layout?.type && (
                      <div className="mb-2">
                        <VenueBadge type={event.venue.layout.type} size="sm" />
                      </div>
                    )}
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
                    <span className="text-lg font-bold text-white font-mono">
                      {formatINR(event.minPrice && event.minPrice > 0 ? event.minPrice : 75000)}
                    </span>
                  </div>
                  <Link
                    href={`/events/${event.id}`}
                    onMouseEnter={() => handlePrefetch(event.id)}
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
