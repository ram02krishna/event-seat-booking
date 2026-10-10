'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, CheckCircle2, ArrowRight, ShieldAlert, Trash2 } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { apiFetch } from '@/lib/api';
import { useCartStore } from '@/store/cartStore';

export interface ActiveHoldInfo {
  eventId: string;
  eventTitle: string;
  venueName?: string;
  startsAt?: string;
  holdExpiresAt: string;
  seats: Array<{
    id: string;
    seatId?: string;
    row: string;
    number: number;
    tier: string;
    price: number;
  }>;
  totalPrice: number;
}

interface ActiveHoldBannerProps {
  hold: ActiveHoldInfo;
  onReleased?: () => void;
}

export function ActiveHoldBanner({ hold, onReleased }: ActiveHoldBannerProps) {
  const router = useRouter();
  const { clearHold, restoreHold } = useCartStore();
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isReleasing, setIsReleasing] = useState(false);

  useEffect(() => {
    // Also sync to cartStore so checkout has immediate state
    if (hold.seats.length > 0) {
      restoreHold(
        hold.eventId,
        hold.seats.map((s) => ({
          id: s.id,
          seatId: s.seatId || s.id,
          section: 'Main',
          row: s.row,
          number: s.number,
          tier: s.tier,
          price: s.price,
        })),
        hold.holdExpiresAt
      );
    }
  }, [hold, restoreHold]);

  useEffect(() => {
    function updateTimer() {
      const expires = new Date(hold.holdExpiresAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expires - now) / 1000));
      setRemainingSeconds(diff);

      if (diff === 0) {
        clearHold();
        onReleased?.();
      }
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [hold.holdExpiresAt, clearHold, onReleased]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  async function handleRelease() {
    setIsReleasing(true);
    try {
      await apiFetch(`/api/events/${hold.eventId}/release`, {
        method: 'POST',
        body: JSON.stringify({
          seatIds: hold.seats.map((s) => s.seatId || s.id),
        }),
      });
      clearHold();
      onReleased?.();
    } catch {
      // ignore
    } finally {
      setIsReleasing(false);
    }
  }

  if (remainingSeconds === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950/60 via-slate-900/90 to-purple-950/50 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Info */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Active Seat Reservation
            </span>
            {remainingSeconds !== null && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                  remainingSeconds < 60
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>{formatTime(remainingSeconds)}</span>
              </span>
            )}
          </div>

          <h3 className="text-base font-bold text-white truncate">{hold.eventTitle}</h3>

          <p className="text-xs text-slate-300 flex flex-wrap items-center gap-2">
            <span>
              {hold.seats.length} seat{hold.seats.length > 1 ? 's' : ''} locked:
            </span>
            <span className="font-semibold text-white">
              {hold.seats.map((s) => `Row ${s.row}-${s.number}`).join(', ')}
            </span>
            <span>• Total:</span>
            <span className="font-mono font-semibold text-emerald-400">
              {formatINR(hold.totalPrice)}
            </span>
          </p>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href={`/checkout?eventId=${hold.eventId}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Proceed to Payment</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <Link
            href={`/events/${hold.eventId}`}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium transition-colors"
          >
            <span>View Seat Map</span>
          </Link>

          <button
            onClick={handleRelease}
            disabled={isReleasing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
            title="Release held seats"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Release</span>
          </button>
        </div>
      </div>
    </div>
  );
}
