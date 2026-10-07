'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { Ticket, Calendar, MapPin, CheckCircle2, QrCode, ArrowLeft } from 'lucide-react';

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
  const { data, isLoading, isError } = useQuery<{ orders: OrderItem[] }>({
    queryKey: ['my-tickets'],
    queryFn: () => apiFetch('/api/orders/my-tickets'),
  });

  const orders = data?.orders || [];

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Events
          </Link>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">My Tickets</h1>
          <p className="text-xs text-slate-400">
            Show your QR codes at the venue gate for check-in.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-44 bg-slate-900 rounded-2xl border border-slate-800" />
          <div className="h-44 bg-slate-900 rounded-2xl border border-slate-800" />
        </div>
      ) : isError ? (
        <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
          <p className="text-sm text-slate-300">Please sign in to view your tickets.</p>
          <Link
            href="/login"
            className="inline-block px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
          >
            Sign In
          </Link>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-4">
          <Ticket className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-white">No tickets yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You have not booked any tickets yet. Explore upcoming events and choose your seats!
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
          >
            Browse Events
          </Link>
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
              <div
                key={order.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-xl"
              >
                {/* Event summary banner */}
                <div className="p-5 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-mono text-slate-400 block mb-1">
                      ORDER #{order.id.slice(0, 8).toUpperCase()}
                    </span>
                    <h2 className="text-xl font-bold text-white">{order.event.title}</h2>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-1">
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
                    <span className="text-xs text-slate-400 block">Total Paid</span>
                    <span className="font-mono text-lg font-bold text-emerald-400">
                      ${(order.totalCents / 100).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Individual tickets list */}
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {order.tickets.map((t) => (
                    <div
                      key={t.id}
                      className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-lg text-white">
                            Row {t.seat.row}, Seat {t.seat.number}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {t.seat.section} •{' '}
                          <span className="text-indigo-400 font-semibold">{t.seat.tier}</span>
                        </p>

                        <div className="pt-2">
                          {t.checkedInAt ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              Checked In
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              Valid for Entry
                            </span>
                          )}
                        </div>
                      </div>

                      {/* QR Code image */}
                      <div className="shrink-0 flex flex-col items-center">
                        <img
                          src={t.qrDataUrl}
                          alt="Ticket QR Code"
                          className="w-24 h-24 rounded-lg bg-white p-1 border border-slate-700 shadow-md"
                        />
                        <span className="text-[9px] font-mono text-slate-400 mt-1">
                          {t.qrToken.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
