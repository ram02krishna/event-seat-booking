'use client';

import { Suspense, useState } from 'react';
import { useCartStore } from '@/store/cartStore';
import { apiFetch } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Ticket, Mail, ShieldCheck } from 'lucide-react';
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
  const totalCents = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  async function handleConfirmBooking() {
    if (!eventId || selectedSeats.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      await apiFetch('/api/orders/confirm', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          seatIds: selectedSeats.map((s) => s.seatId),
          idempotencyKey: crypto.randomUUID(),
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
      <main className="max-w-sm mx-auto px-4 py-20 text-center space-y-4">
        <Ticket className="w-10 h-10 text-slate-600 mx-auto" />
        <h2 className="text-lg font-semibold text-white">No seats selected</h2>
        <p className="text-sm text-slate-400">Your hold may have expired. Go back and pick seats.</p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          Browse Events
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 py-10 space-y-6">
      <div>
        <Link
          href={eventId ? `/events/${eventId}` : '/'}
          className="text-xs text-slate-500 hover:text-white flex items-center gap-1.5 transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Seat Map
        </Link>
        <h1 className="text-xl font-bold text-white">Review Booking</h1>
        <p className="text-sm text-slate-400 mt-0.5">Confirm your seat selection to issue QR tickets.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-800/20 p-5 space-y-5">
        {/* Account notice */}
        {user ? (
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
            <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-slate-500 text-[11px]">Confirmation will be sent to</p>
              <p className="text-white font-medium truncate">{user.email}</p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 text-center">
            <p className="text-xs text-slate-300 font-medium">Please sign in to complete your booking</p>
            <Link
              href={`/login?redirect=${encodeURIComponent(`/checkout?eventId=${eventId || ''}`)}`}
              className="inline-block px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
            >
              Sign In to Continue
            </Link>
          </div>
        )}

        {/* Seats */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Selected Seats ({selectedSeats.length})
          </p>
          <div className="space-y-2">
            {selectedSeats.map((seat) => (
              <div
                key={seat.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-sm"
              >
                <div>
                  <p className="font-medium text-white">Row {seat.row} &bull; Seat {seat.number}</p>
                  <p className="text-xs text-slate-500">
                    Section {seat.section} &bull; <span className="text-indigo-400">{seat.tier}</span>
                  </p>
                </div>
                <span className="font-mono font-semibold text-white">{formatINR(seat.price)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="pt-3 border-t border-slate-800 space-y-2 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal</span>
            <span className="font-mono text-slate-200">{formatINR(totalCents)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Convenience / Platform Fee</span>
            <span className="text-emerald-400 text-xs font-semibold">₹0 (Waived)</span>
          </div>
          <div className="flex justify-between font-semibold text-white text-base pt-2 border-t border-slate-800">
            <span>Total</span>
            <span className="font-mono">{formatINR(totalCents)}</span>
          </div>
        </div>

        {error && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={handleConfirmBooking}
          disabled={isLoading || !user}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          {isLoading ? 'Generating Tickets...' : 'Confirm & Issue Tickets'}
        </button>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          Atomic seat lock &mdash; zero double-booking
        </div>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto px-4 py-20 text-center text-slate-400 text-sm">
          Loading checkout...
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
