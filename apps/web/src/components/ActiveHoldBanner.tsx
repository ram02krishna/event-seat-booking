'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { apiFetch } from '@/lib/api';
import { useCartStore } from '@/store/cartStore';
import { useCountdown, formatClock } from '@/hooks/useCountdown';

export interface ActiveHoldInfo {
  eventId: string;
  eventTitle: string;
  venueName?: string;
  startsAt?: string;
  holdExpiresAt: string;
  seats: Array<{
    id: string;
    seatId?: string;
    section?: string;
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
  const { clearHold, restoreHold } = useCartStore();
  const [isReleasing, setIsReleasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the persisted cart in step with what the server says we hold, so checkout opens instantly.
  // Keyed on the hold's content, not object identity, because the query refetches on an interval.
  const holdKey = `${hold.eventId}|${hold.holdExpiresAt}|${hold.seats.map((s) => s.id).join(',')}`;
  useEffect(() => {
    if (hold.seats.length === 0) return;
    restoreHold(
      hold.eventId,
      hold.seats.map((s) => ({
        id: s.id,
        seatId: s.seatId || s.id,
        section: s.section ?? '',
        row: s.row,
        number: s.number,
        tier: s.tier,
        price: s.price,
      })),
      hold.holdExpiresAt,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdKey, restoreHold]);

  const remaining = useCountdown(hold.holdExpiresAt, () => {
    clearHold();
    onReleased?.();
  });

  async function handleRelease() {
    setIsReleasing(true);
    setError(null);
    try {
      await apiFetch(`/api/events/${hold.eventId}/release`, {
        method: 'POST',
        body: JSON.stringify({ seatIds: hold.seats.map((s) => s.seatId || s.id) }),
      });
      clearHold();
      onReleased?.();
    } catch (err: any) {
      setError(err.message || 'Could not release the seats. Try again.');
    } finally {
      setIsReleasing(false);
    }
  }

  if (remaining === 0) return null;

  const urgent = remaining !== null && remaining < 60;
  const seatLabels = hold.seats.map((s) => `${s.row}${s.number}`).join(', ');

  return (
    <section
      aria-label="Seats on hold"
      className="card flex flex-col gap-4 border-l-[3px] border-l-accent p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="eyebrow !text-accent">Seats on hold</p>
          {remaining !== null && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
                urgent ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn'
              }`}
            >
              <Clock className="h-3 w-3" />
              {formatClock(remaining)}
            </span>
          )}
        </div>
        <h3 className="truncate font-display text-lg font-semibold">{hold.eventTitle}</h3>
        <p className="text-[13px] text-ink-2">
          {hold.seats.length} seat{hold.seats.length === 1 ? '' : 's'} ({seatLabels}) ·{' '}
          <span className="font-semibold tabular-nums text-ink">{formatINR(hold.totalPrice)}</span>
        </p>
        {error && <p className="text-[13px] text-danger">{error}</p>}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Link href={`/checkout?eventId=${hold.eventId}`} className="btn btn-primary btn-sm">
          Continue to checkout
        </Link>
        <Link href={`/events/${hold.eventId}`} className="btn btn-secondary btn-sm">
          View seats
        </Link>
        <button type="button" onClick={handleRelease} disabled={isReleasing} className="btn btn-ghost btn-sm">
          {isReleasing ? 'Releasing…' : 'Release'}
        </button>
      </div>
    </section>
  );
}
