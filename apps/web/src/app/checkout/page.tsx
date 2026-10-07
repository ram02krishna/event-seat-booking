'use client';

import { Suspense, useState } from 'react';
import { useCartStore } from '@/store/cartStore';
import { apiFetch } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId');
  const { selectedSeats, clearHold } = useCartStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPriceCents = selectedSeats.reduce((sum, s) => sum + s.price, 0);

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
        <h2 className="text-xl font-bold text-white">No Seats Selected</h2>
        <p className="text-xs text-slate-400">
          Your cart is currently empty or your hold expired.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
        >
          Browse Events
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-12 space-y-6">
      <Link
        href={eventId ? `/events/${eventId}` : '/'}
        className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Seat Map
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white tracking-tight">Review & Confirm Booking</h1>
        <p className="text-xs text-slate-400">
          No payment gateway required for this demo. Confirming issues your tickets immediately.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl space-y-6">
        {/* Selected Seats List */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Reserved Seats ({selectedSeats.length})
          </h3>
          <div className="space-y-2">
            {selectedSeats.map((seat) => (
              <div
                key={seat.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs"
              >
                <div>
                  <span className="font-semibold text-white block">
                    Row {seat.row}, Seat {seat.number}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {seat.section} • {seat.tier}
                  </span>
                </div>
                <span className="font-mono font-bold text-emerald-400">
                  ${(seat.price / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="pt-4 border-t border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span>Subtotal:</span>
            <span>${(totalPriceCents / 100).toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Booking Fee:</span>
            <span>$0.00 (Demo Free)</span>
          </div>
          <div className="flex items-center justify-between text-sm font-bold text-white pt-2 border-t border-slate-800/80">
            <span>Total:</span>
            <span className="text-emerald-400 font-mono text-base">
              ${(totalPriceCents / 100).toFixed(2)}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <button
          onClick={handleConfirmBooking}
          disabled={isLoading}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs tracking-wide shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <span>Issuing tickets...</span>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm & Issue Tickets</span>
            </>
          )}
        </button>

        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Guaranteed Concurrency-Safe Reservation</span>
        </div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto py-20 text-center text-slate-400 text-xs">
          Loading checkout...
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
