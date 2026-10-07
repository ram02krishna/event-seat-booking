'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import {
  Ticket,
  Calendar,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  Printer,
  Clock,
  Copy,
  Check,
} from 'lucide-react';
import { formatINR } from '@/lib/format';

interface TicketItem {
  id: string;
  qrToken: string;
  checkedInAt: string | null;
  seat: { section: string; row: string; number: number; tier: string };
  price: number;
  qrDataUrl: string;
}

interface OrderItem {
  id: string;
  totalCents: number;
  createdAt: string;
  event: { id: string; title: string; startsAt: string; venue: { name: string } };
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
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  function handleCopy(token: string, id: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(token);
      setCopiedTokenId(id);
      setTimeout(() => setCopiedTokenId(null), 2000);
    }
  }


  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-white flex items-center gap-1.5 transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Events
          </Link>
          <h1 className="text-2xl font-bold text-white">My Tickets</h1>
          <p className="text-sm text-slate-400">Your purchased QR passes and seat reservations.</p>
        </div>
        {user && orders.length > 0 && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-sm text-slate-300 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        )}
      </div>

      {/* States */}
      {isPageLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-36 bg-slate-800/40 rounded-2xl border border-slate-800" />
          <div className="h-36 bg-slate-800/40 rounded-2xl border border-slate-800" />
        </div>
      ) : !user || isError ? (
        <div className="max-w-sm mx-auto p-8 rounded-2xl bg-slate-800/30 border border-slate-800 text-center space-y-5">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Sign in to view tickets</h2>
            <p className="text-xs text-slate-400 mt-1">Your tickets are linked to your account.</p>
          </div>
          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium text-center transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-10 rounded-2xl bg-slate-800/30 border border-slate-800 text-center space-y-3">
          <Ticket className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-medium text-slate-300">No tickets yet</p>
          <p className="text-xs text-slate-500">Browse events and pick your seats to get started.</p>
          <Link
            href="/"
            className="inline-block mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            Browse Events
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const eventDate = new Date(order.event.startsAt).toLocaleDateString('en-IN', {
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
                className="rounded-2xl border border-slate-800 bg-slate-800/20 overflow-hidden"
              >
                {/* Order header */}
                <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    <h2 className="text-base font-semibold text-white">{order.event.title}</h2>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {eventDate}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {order.event.venue.name}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Total Paid</p>
                    <p className="text-lg font-bold text-white font-mono">{formatINR(order.totalCents)}</p>
                    <p className="text-xs text-slate-500">{order.tickets.length} seat{order.tickets.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                {/* Tickets */}
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {order.tickets.map((t) => {
                    const tierColor = {
                      VIP: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
                      PREMIUM: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
                      STANDARD: 'text-slate-300 bg-slate-700/40 border-slate-700',
                    }[t.seat.tier] ?? 'text-slate-300 bg-slate-700/40 border-slate-700';

                    return (
                      <div
                        key={t.id}
                        className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3"
                      >
                        <div className="flex items-center gap-4">
                          {/* QR Thumbnail */}
                          <button
                            type="button"
                            onClick={() => handleCopy(t.qrToken, t.id)}
                            className="shrink-0 bg-white p-1.5 rounded-lg shadow-md cursor-pointer hover:ring-2 hover:ring-indigo-500/50 transition-all text-left"
                            title="Click to copy QR token UUID"
                          >
                            <img
                              src={t.qrDataUrl}
                              alt="QR Code"
                              className="w-16 h-16 object-contain"
                            />
                          </button>

                          {/* Details */}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${tierColor}`}>
                                {t.seat.tier}
                              </span>
                              <span className="text-xs font-mono font-semibold text-white">{formatINR(t.price)}</span>
                            </div>

                            <p className="text-sm font-semibold text-white">
                              Row {t.seat.row} &bull; Seat {t.seat.number}
                            </p>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400">Section {t.seat.section}</span>
                              <span className={`flex items-center gap-1 text-[11px] font-medium ${t.checkedInAt ? 'text-slate-500' : 'text-emerald-400'}`}>
                                {t.checkedInAt
                                  ? <><Clock className="w-3 h-3" /> Used</>
                                  : <><CheckCircle2 className="w-3 h-3" /> Valid</>}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Ticket UUID row */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                              Ticket Token / UUID
                            </p>
                            <p className="text-xs font-mono text-slate-300 truncate select-all" title={t.qrToken}>
                              {t.qrToken}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(t.qrToken, t.id)}
                            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 border border-slate-700/80 transition-colors"
                            title="Copy UUID for Staff Check-in"
                          >
                            {copiedTokenId === t.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400 font-semibold">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy UUID</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
