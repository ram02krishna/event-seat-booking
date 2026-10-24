'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useCartStore, SeatItem } from '@/store/cartStore';
import { formatINR } from '@/lib/format';

export interface SeatData {
  id: string; // EventSeat id
  seatId: string;
  section: string;
  row: string;
  number: number;
  x: number;
  y: number;
  tier: string;
  price: number;
  status: 'AVAILABLE' | 'HELD' | 'SOLD';
  isHeldByMe: boolean;
  holdExpiresAt: string | null;
}

export interface VenueLayout {
  width?: number;
  height?: number;
  type?: 'THEATER_DOLBY' | 'CONFERENCE_HALL' | 'AUDITORIUM' | 'ARENA' | 'OTHERS' | string;
  stage?: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    subtitle?: string;
  };
  features?: string[];
  sections?: Array<{
    id: string;
    name: string;
    tier: string;
    color: string;
    defaultPriceCents?: number;
  }>;
}

interface SeatMapProps {
  seats: SeatData[];
  venueLayout?: VenueLayout;
}

type SeatKind = 'available' | 'selected' | 'held' | 'sold';

const TIER_VAR: Record<string, string> = {
  VIP: '--tier-vip',
  PREMIUM: '--tier-premium',
  STANDARD: '--tier-standard',
};
const DEFAULT_TIER_NAME: Record<string, string> = { VIP: 'VIP', PREMIUM: 'Premium', STANDARD: 'Standard' };

const tierVar = (tier: string) => TIER_VAR[tier] ?? '--tier-standard';
const rgb = (variable: string, alpha?: number) =>
  alpha === undefined ? `rgb(var(${variable}))` : `rgb(var(${variable}) / ${alpha})`;

function seatPaint(kind: SeatKind, tier: string, hovered: boolean) {
  const t = tierVar(tier);
  switch (kind) {
    case 'selected':
      return { fill: rgb('--accent'), stroke: rgb('--accent'), text: rgb('--accent-fg'), dash: undefined };
    case 'held':
      return { fill: rgb('--warn', 0.14), stroke: rgb('--warn', 0.8), text: rgb('--warn'), dash: '3 2.5' };
    case 'sold':
      return { fill: rgb('--line', 0.9), stroke: 'transparent', text: 'transparent', dash: undefined };
    default:
      return {
        fill: rgb(t, hovered ? 0.34 : 0.16),
        stroke: rgb(t),
        text: rgb('--ink'),
        dash: undefined,
      };
  }
}

const SEAT_STATUS_LABEL: Record<SeatKind, string> = {
  available: 'Available',
  selected: 'Selected',
  held: 'Held by someone else',
  sold: 'Taken',
};

export function SeatMap({ seats, venueLayout }: SeatMapProps) {
  const { selectedSeats, heldSeatIds, toggleSeat, removeSeats } = useCartStore();
  const [activeSeat, setActiveSeat] = useState<SeatData | null>(null);
  const [tierFilter, setTierFilter] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [flash, setFlash] = useState<string | null>(null);

  const venueType = venueLayout?.type || 'OTHERS';

  const selectedIds = useMemo(() => new Set(selectedSeats.map((s) => s.id)), [selectedSeats]);
  const heldIds = useMemo(() => new Set(heldSeatIds), [heldSeatIds]);

  const flashTimer = useRef<number | undefined>(undefined);
  function showFlash(message: string) {
    setFlash(message);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 3500);
  }
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  function kindOf(seat: SeatData): SeatKind {
    if (seat.status === 'SOLD') return 'sold';
    if (selectedIds.has(seat.id) || seat.isHeldByMe || (seat.status === 'HELD' && heldIds.has(seat.id))) {
      return 'selected';
    }
    if (seat.status === 'HELD') return 'held';
    return 'available';
  }

  // If someone else takes a seat while it is sitting in the cart, say so and drop it.
  const seatById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);
  useEffect(() => {
    if (heldSeatIds.length > 0 || selectedSeats.length === 0) return;
    const lost = selectedSeats.filter((sel) => {
      const live = seatById.get(sel.id);
      return !!live && (live.status === 'SOLD' || (live.status === 'HELD' && !live.isHeldByMe));
    });
    if (lost.length === 0) return;
    removeSeats(lost.map((s) => s.id));
    showFlash(
      `${lost.map((s) => `${s.row}${s.number}`).join(', ')} ${lost.length === 1 ? 'was' : 'were'} just taken, so we removed ${lost.length === 1 ? 'it' : 'them'} from your selection.`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seatById]);

  function handleSeatActivate(seat: SeatData) {
    setActiveSeat(seat);
    const kind = kindOf(seat);
    if (kind === 'sold' || kind === 'held') return;

    const item: SeatItem = {
      id: seat.id,
      seatId: seat.seatId,
      section: seat.section,
      row: seat.row,
      number: seat.number,
      tier: seat.tier,
      price: seat.price,
    };
    const res = toggleSeat(item);
    if (!res.success && res.error) showFlash(res.error);
  }

  // ---- geometry -------------------------------------------------------
  const geometry = useMemo(() => {
    const xs = seats.map((s) => s.x);
    const ys = seats.map((s) => s.y);
    const minX = xs.length ? Math.min(...xs) : 0;
    const maxX = xs.length ? Math.max(...xs) : 1000;
    const maxY = ys.length ? Math.max(...ys) : 600;

    const stage = venueLayout?.stage ?? { x: 250, y: 22, width: 500, height: 44, label: 'Stage' };
    const x0 = Math.min(minX - 58, stage.x - 24);
    const x1 = Math.max(maxX + 58, stage.x + stage.width + 24);
    const y0 = stage.y - 18;
    const y1 = maxY + 46;

    // Tier blocks, top to bottom, for the section captions
    const tiers = new Map<string, { minX: number; maxX: number; minY: number; available: number; total: number; minPrice: number }>();
    for (const s of seats) {
      const t = tiers.get(s.tier) ?? { minX: s.x, maxX: s.x, minY: s.y, available: 0, total: 0, minPrice: s.price };
      t.minX = Math.min(t.minX, s.x);
      t.maxX = Math.max(t.maxX, s.x);
      t.minY = Math.min(t.minY, s.y);
      t.total += 1;
      if (s.status === 'AVAILABLE') t.available += 1;
      t.minPrice = Math.min(t.minPrice, s.price);
      tiers.set(s.tier, t);
    }
    const orderedTiers = Array.from(tiers.entries()).sort((a, b) => a[1].minY - b[1].minY);

    // Row labels sit beside the first and last seat of each row (rows can curve)
    const rows = new Map<string, { left: SeatData; right: SeatData }>();
    for (const s of seats) {
      const r = rows.get(s.row);
      if (!r) rows.set(s.row, { left: s, right: s });
      else {
        if (s.x < r.left.x) r.left = s;
        if (s.x > r.right.x) r.right = s;
      }
    }

    return { stage, x0, x1, y0, y1, tiers: orderedTiers, rows: Array.from(rows.entries()) };
  }, [seats, venueLayout]);

  const { stage, x0, x1, y0, y1 } = geometry;
  const cx = stage.x + stage.width / 2;
  const tierName = (tier: string) =>
    venueLayout?.sections?.find((s) => s.tier === tier)?.name || DEFAULT_TIER_NAME[tier] || tier;

  const stageLabel = venueType === 'THEATER_DOLBY' ? 'Screen' : 'Stage';

  const activeKind = activeSeat ? kindOf(activeSeat) : null;

  return (
    <div className="card p-3 sm:p-5">
      {/* Tier filter + zoom */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Highlight a section">
          <button
            type="button"
            aria-pressed={tierFilter === null}
            onClick={() => setTierFilter(null)}
            className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
              tierFilter === null
                ? 'border-ink bg-ink text-bg'
                : 'border-line-strong text-ink-2 hover:border-ink-3 hover:text-ink'
            }`}
          >
            All sections
          </button>
          {geometry.tiers.map(([tier, info]) => {
            const on = tierFilter === tier;
            return (
              <button
                key={tier}
                type="button"
                aria-pressed={on}
                onClick={() => setTierFilter(on ? null : tier)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  on ? 'border-ink bg-sunken text-ink' : 'border-line-strong text-ink-2 hover:border-ink-3 hover:text-ink'
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: rgb(tierVar(tier)) }} />
                {tierName(tier)}
                <span className="tabular-nums text-ink-3">{formatINR(info.minPrice)}</span>
                <span className="hidden text-ink-3 sm:inline">· {info.available} left</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center rounded-lg border border-line-strong" role="group" aria-label="Zoom">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.8, +(z - 0.2).toFixed(2)))}
            disabled={zoom <= 0.8}
            className="p-2 text-ink-2 hover:bg-sunken disabled:opacity-40"
            aria-label="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-12 text-center text-xs tabular-nums text-ink-3" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.2).toFixed(2)))}
            disabled={zoom >= 2}
            className="p-2 text-ink-2 hover:bg-sunken disabled:opacity-40"
            aria-label="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="border-l border-line-strong p-2 text-ink-2 hover:bg-sunken"
            aria-label="Reset zoom"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Map. Zoom changes the drawn size, so scrolling extents stay correct. */}
      <div className="max-h-[72vh] overflow-auto rounded-lg border border-line bg-sunken/50">
        <svg
          viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`}
          role="group"
          aria-label="Seat map"
          style={{ width: `${zoom * 100}%`, minWidth: `${Math.round(680 * zoom)}px`, height: 'auto', display: 'block' }}
        >
          {/* Stage / screen */}
          {venueType === 'THEATER_DOLBY' ? (
            <g>
              <path
                d={`M ${stage.x} ${stage.y + 30} Q ${cx} ${stage.y - 8} ${stage.x + stage.width} ${stage.y + 30}`}
                fill="none"
                stroke={rgb('--ink-2')}
                strokeWidth={4}
                strokeLinecap="round"
              />
              <text x={cx} y={stage.y + 40} textAnchor="middle" fontSize={11} fontWeight={600} letterSpacing={3} fill={rgb('--ink-3')}>
                {stageLabel.toUpperCase()}
              </text>
            </g>
          ) : (
            <g>
              <rect
                x={stage.x}
                y={stage.y}
                width={stage.width}
                height={stage.height}
                rx={8}
                fill={rgb('--surface')}
                stroke={rgb('--line-strong')}
                strokeWidth={1.5}
              />
              <text x={cx} y={stage.y + stage.height / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={600} letterSpacing={3} fill={rgb('--ink-3')}>
                {stageLabel.toUpperCase()}
              </text>
              {venueType === 'ARENA' && (
                <g>
                  <rect
                    x={cx - 34}
                    y={stage.y + stage.height}
                    width={68}
                    height={170}
                    rx={6}
                    fill={rgb('--surface')}
                    stroke={rgb('--line-strong')}
                    strokeWidth={1.5}
                  />
                  <text
                    x={cx}
                    y={stage.y + stage.height + 90}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={600}
                    letterSpacing={3}
                    fill={rgb('--ink-3')}
                    transform={`rotate(-90 ${cx} ${stage.y + stage.height + 90})`}
                  >
                    RUNWAY
                  </text>
                </g>
              )}
            </g>
          )}

          {/* Section captions */}
          {geometry.tiers.map(([tier, info]) => (
            <g key={`cap-${tier}`} pointerEvents="none" opacity={tierFilter && tierFilter !== tier ? 0.3 : 1}>
              <line
                x1={info.minX - 36}
                x2={info.maxX + 36}
                y1={info.minY - 30}
                y2={info.minY - 30}
                stroke={rgb(tierVar(tier), 0.45)}
                strokeWidth={1}
              />
              <text
                x={(info.minX + info.maxX) / 2}
                y={info.minY - 36}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                letterSpacing={2}
                fill={rgb(tierVar(tier))}
              >
                {tierName(tier).toUpperCase()}
              </text>
            </g>
          ))}

          {/* Row letters */}
          {geometry.rows.map(([row, { left, right }]) => (
            <g key={`row-${row}`} pointerEvents="none">
              <text x={left.x - 34} y={left.y + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill={rgb('--ink-3')}>
                {row}
              </text>
              <text x={right.x + 34} y={right.y + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill={rgb('--ink-3')}>
                {row}
              </text>
            </g>
          ))}

          {/* Seats */}
          {seats.map((seat) => {
            const kind = kindOf(seat);
            const interactive = kind === 'available' || kind === 'selected';
            const hovered = activeSeat?.id === seat.id;
            const paint = seatPaint(kind, seat.tier, hovered);
            const dim = tierFilter !== null && tierFilter !== seat.tier;
            const label = `Row ${seat.row}, seat ${seat.number}, ${tierName(seat.tier)}, ${formatINR(seat.price)}, ${SEAT_STATUS_LABEL[kind].toLowerCase()}`;

            return (
              <g
                key={seat.id}
                className="seat-group"
                transform={`translate(${seat.x} ${seat.y})`}
                role="button"
                tabIndex={interactive ? 0 : -1}
                aria-label={label}
                aria-pressed={kind === 'selected'}
                aria-disabled={!interactive}
                opacity={dim ? 0.22 : 1}
                style={{ cursor: interactive ? 'pointer' : 'not-allowed', transition: 'opacity 140ms ease' }}
                onClick={() => handleSeatActivate(seat)}
                onMouseEnter={() => setActiveSeat(seat)}
                onFocus={() => setActiveSeat(seat)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSeatActivate(seat);
                  }
                }}
              >
                {/* generous invisible hit area for touch */}
                <rect x={-19} y={-19} width={38} height={38} fill="transparent" />
                <rect
                  className="seat-focus"
                  x={-19}
                  y={-19}
                  width={38}
                  height={38}
                  rx={9}
                  fill="none"
                  stroke={rgb('--accent')}
                  strokeWidth={2}
                  opacity={0}
                />
                <g
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    transform: kind === 'selected' ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 160ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  {/* backrest */}
                  <rect
                    className="seat-shape"
                    x={-10}
                    y={-14}
                    width={20}
                    height={9}
                    rx={4}
                    fill={paint.fill}
                    stroke={paint.stroke}
                    strokeWidth={1.4}
                    strokeDasharray={paint.dash}
                  />
                  {/* cushion */}
                  <rect
                    className="seat-shape"
                    x={-13}
                    y={-6}
                    width={26}
                    height={19}
                    rx={5}
                    fill={paint.fill}
                    stroke={paint.stroke}
                    strokeWidth={1.4}
                    strokeDasharray={paint.dash}
                  />
                  <text
                    y={7}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={600}
                    fill={paint.text}
                    pointerEvents="none"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {seat.number}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Fixed-height strip: details never push the page around */}
      <div className="mt-3 flex min-h-[44px] items-center justify-between gap-4 rounded-lg bg-sunken/70 px-4 py-2.5 text-[13px]" aria-live="polite">
        {flash ? (
          <p className="font-medium text-danger">{flash}</p>
        ) : activeSeat && activeKind ? (
          <>
            <p className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="font-semibold">
                Row {activeSeat.row}, seat {activeSeat.number}
              </span>
              <span className="text-ink-3">{tierName(activeSeat.tier)}</span>
              <span className="text-ink-3">· {SEAT_STATUS_LABEL[activeKind]}</span>
            </p>
            <p className="shrink-0 font-semibold tabular-nums">{formatINR(activeSeat.price)}</p>
          </>
        ) : (
          <p className="text-ink-3">Tap or hover a seat to see its details. You can pick up to 6.</p>
        )}
      </div>

      {/* Legend */}
      <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-3">
        <li className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-[4px] border" style={{ borderColor: rgb('--tier-premium'), background: rgb('--tier-premium', 0.16) }} />
          Available
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-[4px] bg-accent" />
          Yours
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-[4px] border border-dashed" style={{ borderColor: rgb('--warn'), background: rgb('--warn', 0.14) }} />
          Held by someone else
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-[4px] bg-line" />
          Taken
        </li>
      </ul>
    </div>
  );
}
