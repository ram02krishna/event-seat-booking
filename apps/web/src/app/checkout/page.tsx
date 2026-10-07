'use client';

import { Suspense, useState } from 'react';
import { useCartStore } from '@/store/cartStore';
import { apiFetch } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck, CheckCircle2, Ticket, Mail, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { formatINR } from '@/lib/format';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const eventId = searchParams.get('eventId');
  const { selectedSeats, clearHold } = useCartStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: authData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch('/api/auth/me'),
    retry: false,
  });

  const user = authData?.user;
  const totalPriceCents = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  async function handleQuickLogin(email: string) {
    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'password123' }),
      });
      await queryClient.invalidateQueries();
    } catch {
      // ignore
    }
  }

  async function handleConfirmBooking() {
    if (!eventId || selectedSeats.length === 0) return;
    setIsLoading(true);
    setError(null);

    try {
      const idempotencyKey = crypto.randomUUID();
      await apiFetch('/api/orders/confirm', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          seatIds: selectedSeats.map((s) => s.seatId),
          idempotencyKey,
        }),
      });

      clearHold();
      await queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
      router.push('/my-tickets');
    } catch (err: any) {
      setError(err.message || 'Failed to confirm booking');
    } finally {
      setIsLoading(false);
    }
  }

  if (selectedSeats.length === 0) {
    return (
      <main className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
          <Ticket className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">No Seats in Cart</h2>
        <p className="text-xs text-slate-400">
          Your hold has either expired or no seats have been selected yet.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
        >
          Browse Upcoming Events
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-10 sm:py-14 space-y-6">
      <Link
        href={eventId ? `/events/${eventId}` : '/'}
        className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors group"
      >
        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
        Back to Live Seat Map
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Review & Confirm Booking
        </h1>
        <p className="text-xs text-slate-400">
          Instant booking simulation. Confirmed tickets and QR codes are generated immediately.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 sm:p-7 shadow-2xl space-y-6 backdrop-blur-xl">
        {/* Recipient Account Notice */}
        {user ? (
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <span className="text-slate-400 text-[11px] block">Sending Confirmation & QR To:</span>
                <strong className="text-white font-medium">{user.email}</strong>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300">
              {user.role}
            </span>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
              <UserCheck className="w-4 h-4" />
              <span>Sign in required to link tickets</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Pick a quick demo account to sign in without losing your cart:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('alice@example.com')}
                className="py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium border border-slate-700"
              >
                Sign in as Alice
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('bob@example.com')}
                className="py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium border border-slate-700"
              >
                Sign in as Bob
              </button>
            </div>
          </div>
        )}

        {/* Selected Seats List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Reserved Seats</span>
            <span className="text-indigo-400">{selectedSeats.length} Selected</span>
          </div>
          <div className="space-y-2">
            {selectedSeats.map((seat) => (
              <div
                key={seat.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs shadow-inner"
              >
                <div>
                  <span className="font-bold text-white text-sm block">
                    Row {seat.row} • Seat {seat.number}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Section {seat.section} • <span className="text-indigo-400 font-semibold">{seat.tier} Tier</span>
                  </span>
                </div>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {formatINR(seat.price)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="pt-4 border-t border-slate-800 space-y-2.5 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span>Subtotal</span>
            <span className="font-mono text-slate-200">{formatINR(totalPriceCents)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Convenience & Payment Fee</span>
            <span className="text-emerald-400 font-medium">Free (Demo)</span>
          </div>
          <div className="flex items-center justify-between text-sm font-bold text-white pt-2.5 border-t border-slate-800/80">
            <span>Grand Total</span>
            <span className="text-emerald-400 font-mono text-lg">
              {formatINR(totalPriceCents)}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <button
          onClick={handleConfirmBooking}
          disabled={isLoading || !user}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white font-bold text-xs tracking-wider uppercase shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <span>Securing Tickets & Generating QR...</span>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm & Issue Tickets</span>
            </>
          )}
        </button>

        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 pt-1">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Atomic Conditional Lock • Guaranteed Zero Double-Booking</span>
        </div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-xl mx-auto px-4 py-16 text-center text-slate-400 text-xs">
          Loading checkout...
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
