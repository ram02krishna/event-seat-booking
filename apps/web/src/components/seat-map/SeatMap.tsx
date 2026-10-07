'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore, SeatItem } from '@/store/cartStore';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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

interface VenueLayout {
  width?: number;
  height?: number;
  stage?: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
  };
}

interface SeatMapProps {
  seats: SeatData[];
  venueLayout?: VenueLayout;
  onSeatClick?: (seat: SeatData) => void;
}

const TIER_COLORS: Record<string, { fill: string; stroke: string }> = {
  VIP: { fill: '#7c3aed', stroke: '#a78bfa' },
  PREMIUM: { fill: '#2563eb', stroke: '#60a5fa' },
  STANDARD: { fill: '#059669', stroke: '#34d399' },
};

export function SeatMap({ seats, venueLayout }: SeatMapProps) {
  const { selectedSeats, heldSeatIds, toggleSeat } = useCartStore();
  const [hoveredSeat, setHoveredSeat] = useState<SeatData | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const baseWidth = venueLayout?.width || 1000;
  const baseHeight = venueLayout?.height || 700;

  const stage = venueLayout?.stage || {
    x: 250,
    y: 30,
    width: 500,
    height: 45,
    label: 'STAGE',
  };

  function handleSeatClick(seat: SeatData) {
    if (seat.status === 'SOLD') return;
    if (seat.status === 'HELD' && !seat.isHeldByMe) return;

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
    if (!res.success && res.error) {
      setErrorMessage(res.error);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  }

  function handleZoom(delta: number) {
    setZoomLevel((prev) => Math.min(2.0, Math.max(0.7, +(prev + delta).toFixed(2))));
  }

  function resetZoom() {
    setZoomLevel(1);
  }

  return (
    <div className="relative w-full rounded-2xl bg-slate-950/80 border border-slate-800/80 shadow-2xl p-4 sm:p-6 overflow-hidden select-none">
      {/* Controls & Toast */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-violet-600 border border-violet-400" />
            <span>VIP</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-blue-600 border border-blue-400" />
            <span>Premium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 border border-emerald-400" />
            <span>Standard</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-indigo-500 ring-2 ring-indigo-300 ring-offset-1 ring-offset-slate-950" />
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-amber-500/80 border border-amber-400" />
            <span>Held (Others)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-slate-700 border border-slate-600" />
            <span>Sold</span>
          </div>
        </div>

        {/* Zoom Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1">
          <button
            onClick={() => handleZoom(0.15)}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom(-0.15)}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetZoom}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Reset Zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono px-2 text-slate-400">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-rose-500/90 text-white text-xs font-semibold shadow-lg backdrop-blur"
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* SVG Canvas Container */}
      <div className="relative w-full overflow-auto flex justify-center items-center min-h-[460px] max-h-[680px] bg-slate-950/40 rounded-xl border border-slate-900/60 p-2">
        <motion.div
          animate={{ scale: zoomLevel }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ transformOrigin: 'top center' }}
        >
          <svg
            viewBox={`0 0 ${baseWidth} ${baseHeight}`}
            width={baseWidth}
            height={baseHeight}
            className="overflow-visible"
          >
            <defs>
              {/* Radial gradient for stage glow */}
              <radialGradient id="stageGlow" cx="50%" cy="0%" r="90%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Stage illumination background */}
            <ellipse
              cx={baseWidth / 2}
              cy={stage.y + stage.height / 2}
              rx={stage.width * 0.7}
              ry={stage.height * 2.2}
              fill="url(#stageGlow)"
            />

            {/* Stage element */}
            <g>
              <rect
                x={stage.x}
                y={stage.y}
                width={stage.width}
                height={stage.height}
                rx={12}
                fill="#1e1b4b"
                stroke="#6366f1"
                strokeWidth={2}
                className="filter drop-shadow-[0_0_15px_rgba(99,102,241,0.35)]"
              />
              <text
                x={stage.x + stage.width / 2}
                y={stage.y + stage.height / 2 + 5}
                textAnchor="middle"
                fill="#e0e7ff"
                fontSize={13}
                fontWeight="700"
                letterSpacing={3}
              >
                {stage.label}
              </text>
            </g>

            {/* Seats */}
            {seats.map((seat) => {
              const isSelected = selectedSeats.some((s) => s.id === seat.id);
              const isHeld = seat.status === 'HELD';
              const isHeldByMe = isSelected || seat.isHeldByMe || heldSeatIds.includes(seat.id);
              const isSold = seat.status === 'SOLD';
              const isAvailable = seat.status === 'AVAILABLE' && !isSelected;

              // Compute color
              const tierColor = TIER_COLORS[seat.tier] || TIER_COLORS.STANDARD;
              let fill = tierColor.fill;
              let stroke = tierColor.stroke;
              let cursor = 'pointer';
              let opacity = 1;

              if (isSold) {
                fill = '#334155';
                stroke = '#475569';
                cursor = 'not-allowed';
                opacity = 0.55;
              } else if (isHeld && !isHeldByMe) {
                fill = '#d97706';
                stroke = '#fbbf24';
                cursor = 'not-allowed';
                opacity = 0.85;
              } else if (isSelected || isHeldByMe) {
                fill = '#6366f1';
                stroke = '#a5b4fc';
              }

              return (
                <g
                  key={seat.id}
                  onClick={() => handleSeatClick(seat)}
                  onMouseEnter={() => setHoveredSeat(seat)}
                  onMouseLeave={() => setHoveredSeat(null)}
                  style={{ cursor }}
                  className="transition-transform duration-150"
                >
                  {/* Selected glowing ring */}
                  {(isSelected || isHeldByMe) && (
                    <circle
                      cx={seat.x}
                      cy={seat.y}
                      r={18}
                      fill="none"
                      stroke="#818cf8"
                      strokeWidth={2}
                      className="animate-pulse"
                    />
                  )}

                  {/* Main seat circle */}
                  <circle
                    cx={seat.x}
                    cy={seat.y}
                    r={13}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSelected || isHeldByMe ? 2.5 : 1.5}
                    opacity={opacity}
                    className="hover:brightness-125 transition-all"
                  />

                  {/* Seat label */}
                  <text
                    x={seat.x}
                    y={seat.y + 3.5}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={8.5}
                    fontWeight="600"
                    pointerEvents="none"
                  >
                    {seat.row}
                    {seat.number}
                  </text>
                </g>
              );
            })}
          </svg>
        </motion.div>
      </div>

      {/* Floating Tooltip */}
      {hoveredSeat && (
        <div className="mt-3 flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">
              Row {hoveredSeat.row}, Seat {hoveredSeat.number}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-300">{hoveredSeat.section}</span>
            <span className="text-slate-400">•</span>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
              style={{
                backgroundColor: `${TIER_COLORS[hoveredSeat.tier]?.fill}33`,
                color: TIER_COLORS[hoveredSeat.tier]?.stroke,
              }}
            >
              {hoveredSeat.tier}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-emerald-400">
              ${(hoveredSeat.price / 100).toFixed(2)}
            </span>
            <span
              className={`text-[11px] font-medium ${
                hoveredSeat.status === 'AVAILABLE'
                  ? 'text-emerald-400'
                  : hoveredSeat.status === 'HELD'
                  ? 'text-amber-400'
                  : 'text-slate-500'
              }`}
            >
              {hoveredSeat.status}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
