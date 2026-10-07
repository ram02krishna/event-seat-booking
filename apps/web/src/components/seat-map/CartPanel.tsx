'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '@/store/cartStore';
import { apiFetch } from '@/lib/api';
import { Clock, Trash2, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatINR } from '@/lib/format';

interface CartPanelProps {
  eventId: string;
  onHoldSuccess?: () => void;
  onReleaseSuccess?: () => void;
}

export function CartPanel({ eventId, onHoldSuccess, onReleaseSuccess }: CartPanelProps) {
  const router = useRouter();
  const { selectedSeats, heldSeatIds, holdExpiresAt, toggleSeat, clearSelection, setHeldSeats, clearHold } =
    useCartStore();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const isHeld = heldSeatIds.length > 0 && !!holdExpiresAt;
  const totalPriceCents = selectedSeats.reduce((acc, seat) => acc + seat.price, 0);

  // Server-authoritative countdown timer
  useEffect(() => {
    if (!holdExpiresAt) {
      setRemainingSeconds(null);
      return;
    }

    function updateTimer() {
      const expires = new Date(holdExpiresAt!).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expires - now) / 1000));
      setRemainingSeconds(diff);

      if (diff === 0) {
        clearHold();
        setErrorMessage('Hold expired! The seats have been released.');
        onReleaseSuccess?.();
      }
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [holdExpiresAt, clearHold, onReleaseSuccess]);

  // Format seconds as MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  async function handleHold() {
    if (selectedSeats.length === 0) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiFetch(`/api/events/${eventId}/hold`, {
        method: 'POST',
        body: JSON.stringify({
          seatIds: selectedSeats.map((s) => s.seatId),
        }),
      });

      setHeldSeats(
        selectedSeats.map((s) => s.id),
        res.holdExpiresAt
      );
      onHoldSuccess?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to hold seats');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRelease() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await apiFetch(`/api/events/${eventId}/release`, {
        method: 'POST',
        body: JSON.stringify({
          seatIds: selectedSeats.map((s) => s.seatId),
        }),
      });

      clearHold();
      onReleaseSuccess?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to release seats');
    } finally {
      setIsLoading(false);
    }
  }

  if (selectedSeats.length === 0 && !isHeld) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96 z-40 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-5"
      >
        {/* Header: Title & Timer / Clear */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-semibold text-sm text-white">
              {isHeld ? 'Held Seats' : 'Selected Seats'} ({selectedSeats.length}/6)
            </h3>
            <p className="text-xs text-slate-400">
              {isHeld ? 'Locked for your checkout' : 'Pick up to 6 seats'}
            </p>
          </div>

          {isHeld && remainingSeconds !== null ? (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold ${
                remainingSeconds < 60
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTime(remainingSeconds)}</span>
            </div>
          ) : (
            <button
              onClick={clearSelection}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Selected seats pills */}
        <div className="max-h-36 overflow-y-auto py-3 space-y-1.5">
          {selectedSeats.map((seat) => (
            <div
              key={seat.id}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">
                  Row {seat.row}-{seat.number}
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  {seat.tier}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-emerald-400 font-semibold">
                  {formatINR(seat.price)}
                </span>
                {!isHeld && (
                  <button
                    onClick={() => toggleSeat(seat)}
                    className="text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Total & Action */}
        <div className="pt-3 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Total Price:</span>
            <span className="font-mono text-lg font-bold text-white">
              {formatINR(totalPriceCents)}
            </span>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!isHeld ? (
            <button
              onClick={handleHold}
              disabled={isLoading || selectedSeats.length === 0}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs tracking-wide shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Locking seats...</span>
              ) : (
                <>
                  <span>Hold Seats for 5 Minutes</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => router.push(`/checkout?eventId=${eventId}`)}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Booking</span>
              </button>

              <button
                onClick={handleRelease}
                disabled={isLoading}
                className="w-full py-1.5 text-slate-400 hover:text-slate-200 text-xs text-center transition-colors"
              >
                Release Seats
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
