'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { Calendar, MapPin, Users, ArrowRight, Sparkles } from 'lucide-react';

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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      {/* Hero Banner */}
      <div className="relative text-center max-w-3xl mx-auto space-y-4 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Real-Time Concurrency-Safe Ticketing</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Reserve Your Seats with <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            Zero Double-Booking
          </span>
        </h1>
        <p className="text-slate-400 text-base max-w-xl mx-auto">
          Explore upcoming concerts and conferences. Pick seats on a live SVG venue map
          and hold them securely for 5 minutes.
        </p>
      </div>

      {/* Events Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight">Upcoming Events</h2>
          <span className="text-xs text-slate-400">{events.length} live events</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
            <div className="h-48 rounded-2xl bg-slate-900 border border-slate-800" />
            <div className="h-48 rounded-2xl bg-slate-900 border border-slate-800" />
          </div>
        ) : isError ? (
          <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-slate-400 text-sm">
            Could not connect to the API. Make sure the backend server is running.
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-slate-400 text-sm">
            No events available at this time.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {events.map((event) => {
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

              return (
                <div
                  key={event.id}
                  className="group relative rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/70 hover:border-indigo-500/40 p-6 flex flex-col justify-between transition-all duration-200 shadow-xl"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {event.availableSeats} Seats Left
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        {event.totalSeats} Total
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {event.title}
                    </h3>
                    <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">
                      {event.description || 'No description provided.'}
                    </p>

                    <div className="pt-2 flex flex-wrap gap-4 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span>
                          {formattedDate} • {formattedTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{event.venue.name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <Link
                      href={`/events/${event.id}`}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs tracking-wide shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 group-hover:gap-3"
                    >
                      <span>Choose Seats</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
