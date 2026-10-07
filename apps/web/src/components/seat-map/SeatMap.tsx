'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore, SeatItem } from '@/store/cartStore';
import { ZoomIn, ZoomOut, RotateCcw, Sparkles, Layers, ShieldCheck } from 'lucide-react';
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

const TIER_THEMES: Record<
  string,
  {
    name: string;
    label: string;
    backrest: string;
    cushion: string;
    stroke: string;
    glow: string;
    badgeBg: string;
    badgeText: string;
    border: string;
  }
> = {
  VIP: {
    name: 'VIP',
    label: 'VIP Orchestra',
    backrest: '#6d28d9',
    cushion: '#7c3aed',
    stroke: '#c4b5fd',
    glow: 'rgba(124, 58, 237, 0.45)',
    badgeBg: 'bg-violet-500/15',
    badgeText: 'text-violet-300',
    border: 'border-violet-500/40',
  },
  PREMIUM: {
    name: 'PREMIUM',
    label: 'Premium Mezzanine',
    backrest: '#1d4ed8',
    cushion: '#2563eb',
    stroke: '#93c5fd',
    glow: 'rgba(37, 99, 235, 0.45)',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-300',
    border: 'border-blue-500/40',
  },
  STANDARD: {
    name: 'STANDARD',
    label: 'Standard General',
    backrest: '#047857',
    cushion: '#059669',
    stroke: '#6ee7b7',
    glow: 'rgba(5, 150, 105, 0.45)',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-300',
    border: 'border-emerald-500/40',
  },
};

export function SeatMap({ seats, venueLayout }: SeatMapProps) {
  const { selectedSeats, heldSeatIds, toggleSeat } = useCartStore();
  const [hoveredSeat, setHoveredSeat] = useState<SeatData | null>(null);
  const [selectedTierFilter, setSelectedTierFilter] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const baseWidth = venueLayout?.width || 1000;
  const baseHeight = venueLayout?.height || 700;

  const stage = venueLayout?.stage || {
    x: 250,
    y: 28,
    width: 500,
    height: 48,
    label: 'MAIN STAGE',
  };

  // Tier statistics
  const tierStats = useMemo(() => {
    const stats: Record<string, { total: number; available: number; minPrice: number }> = {};
    seats.forEach((seat) => {
      if (!stats[seat.tier]) {
        stats[seat.tier] = { total: 0, available: 0, minPrice: seat.price };
      }
      stats[seat.tier]!.total++;
      if (seat.status === 'AVAILABLE') {
        stats[seat.tier]!.available++;
      }
      stats[seat.tier]!.minPrice = Math.min(stats[seat.tier]!.minPrice, seat.price);
    });
    return stats;
  }, [seats]);

  // Compute row boundaries for row indicators
  const rowBounds = useMemo(() => {
    const map = new Map<string, { y: number; minX: number; maxX: number; tier: string }>();
    seats.forEach((seat) => {
      if (!map.has(seat.row)) {
        map.set(seat.row, { y: seat.y, minX: seat.x, maxX: seat.x, tier: seat.tier });
      } else {
        const item = map.get(seat.row)!;
        item.minX = Math.min(item.minX, seat.x);
        item.maxX = Math.max(item.maxX, seat.x);
      }
    });
    return Array.from(map.entries())
      .map(([row, data]) => ({ row, ...data }))
      .sort((a, b) => a.y - b.y);
  }, [seats]);

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
    <div className="relative w-full rounded-3xl bg-slate-950 border border-slate-800/80 shadow-2xl p-4 sm:p-6 overflow-hidden select-none">
      {/* Top Header: Tier Filters & Legend Controls */}
      <div className="space-y-4 mb-4">
        {/* Tier Interactive Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Tiers:</span>
            </span>

            {/* All Tiers Button */}
            <button
              type="button"
              onClick={() => setSelectedTierFilter(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedTierFilter === null
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              All Sections ({seats.length})
            </button>

            {/* Tier Buttons */}
            {Object.entries(TIER_THEMES).map(([tierKey, config]) => {
              const stat = tierStats[tierKey];
              if (!stat) return null;
              const isSelected = selectedTierFilter === tierKey;

              return (
                <button
                  key={tierKey}
                  type="button"
                  onClick={() => setSelectedTierFilter(isSelected ? null : tierKey)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                    isSelected
                      ? `${config.badgeBg} ${config.badgeText} ${config.border} ring-2 ring-indigo-500/40 shadow-lg`
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: config.cushion }}
                  />
                  <span className="font-semibold">{config.label}</span>
                  <span className="font-mono text-[11px] opacity-80">
                    {formatINR(stat.minPrice)}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400">
                    {stat.available} left
                  </span>
                </button>
              );
            })}
          </div>

          {/* Zoom & Reset Controls */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => handleZoom(0.15)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleZoom(-0.15)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={resetZoom}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-2 text-slate-400">
              {Math.round(zoomLevel * 100)}%
            </span>
          </div>
        </div>

        {/* Status Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-emerald-500/20 border border-emerald-400" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-indigo-500 border-2 border-indigo-300 ring-2 ring-indigo-400/40" />
              <span className="text-indigo-300 font-medium">Selected by you</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-amber-500/20 border border-amber-400" />
              <span>Held by others</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-slate-800 border border-slate-700" />
              <span className="text-slate-500">Booked / Sold</span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Click any seat to lock atomically</span>
          </div>
        </div>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold shadow-xl shadow-rose-950/40 backdrop-blur"
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* SVG Auditorium Seating Plan Canvas */}
      <div className="relative w-full overflow-auto flex justify-center items-center min-h-[500px] max-h-[720px] bg-radial from-slate-900/60 to-slate-950 rounded-2xl border border-slate-900/80 p-2 sm:p-4">
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
              {/* Atmospheric Spotlight Beam radiating from Stage */}
              <linearGradient id="spotlightBeam" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.22" />
                <stop offset="40%" stopColor="#818cf8" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
              </linearGradient>

              {/* Stage Surface Gradient */}
              <linearGradient id="stageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e1b4b" />
                <stop offset="50%" stopColor="#2e1065" />
                <stop offset="100%" stopColor="#1e1b4b" />
              </linearGradient>

              {/* Stage Floor Arc Glow */}
              <radialGradient id="stageFloorGlow" cx="50%" cy="0%" r="85%">
                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
                <stop offset="60%" stopColor="#6366f1" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* 1. Spotlight Light Beam across Auditorium */}
            <polygon
              points={`${baseWidth / 2 - 160},40 ${baseWidth / 2 + 160},40 ${baseWidth / 2 + 450},680 ${baseWidth / 2 - 450},680`}
              fill="url(#spotlightBeam)"
              pointerEvents="none"
            />

            {/* 2. Stage Floor Lighting Atmosphere */}
            <ellipse
              cx={baseWidth / 2}
              cy={55}
              rx={stage.width * 0.65}
              ry={60}
              fill="url(#stageFloorGlow)"
              pointerEvents="none"
            />

            {/* 3. Curved Architectural Stage */}
            <g>
              {/* Stage Drop Shadow Apron */}
              <path
                d={`M ${stage.x - 25} ${stage.y + stage.height} 
                    Q ${baseWidth / 2} ${stage.y - 12} ${stage.x + stage.width + 25} ${stage.y + stage.height} 
                    L ${stage.x + stage.width + 10} ${stage.y + stage.height + 16} 
                    Q ${baseWidth / 2} ${stage.y + stage.height + 5} ${stage.x - 10} ${stage.y + stage.height + 16} Z`}
                fill="#0f172a"
                opacity={0.8}
              />

              {/* Main Curved Stage Platform */}
              <path
                d={`M ${stage.x - 20} ${stage.y + stage.height - 2} 
                    Q ${baseWidth / 2} ${stage.y - 10} ${stage.x + stage.width + 20} ${stage.y + stage.height - 2} 
                    L ${stage.x + stage.width + 5} ${stage.y + stage.height + 12} 
                    Q ${baseWidth / 2} ${stage.y + stage.height + 4} ${stage.x - 5} ${stage.y + stage.height + 12} Z`}
                fill="url(#stageGrad)"
                stroke="#6366f1"
                strokeWidth={2}
                className="filter drop-shadow-[0_0_20px_rgba(99,102,241,0.5)]"
              />

              {/* Stage Spotlights Dots */}
              <circle cx={stage.x + 40} cy={stage.y + 12} r={3} fill="#a5b4fc" opacity={0.8} />
              <circle cx={stage.x + 100} cy={stage.y + 6} r={3} fill="#818cf8" opacity={0.9} />
              <circle cx={baseWidth / 2 - 60} cy={stage.y + 2} r={3.5} fill="#c7d2fe" />
              <circle cx={baseWidth / 2 + 60} cy={stage.y + 2} r={3.5} fill="#c7d2fe" />
              <circle cx={stage.x + stage.width - 100} cy={stage.y + 6} r={3} fill="#818cf8" opacity={0.9} />
              <circle cx={stage.x + stage.width - 40} cy={stage.y + 12} r={3} fill="#a5b4fc" opacity={0.8} />

              {/* Stage Typography */}
              <text
                x={baseWidth / 2}
                y={stage.y + stage.height / 2 + 2}
                textAnchor="middle"
                fill="#ffffff"
                fontSize={12}
                fontWeight="800"
                letterSpacing={4}
                className="select-none"
              >
                ✦ MAIN STAGE ✦
              </text>
              <text
                x={baseWidth / 2}
                y={stage.y + stage.height / 2 + 15}
                textAnchor="middle"
                fill="#a5b4fc"
                fontSize={8.5}
                fontWeight="600"
                letterSpacing={2}
                opacity={0.8}
                className="select-none"
              >
                AUDITORIUM PROSCENIUM
              </text>
            </g>

            {/* 4. Section Divider Headers & Acoustic Guides */}
            {/* VIP Header Banner */}
            <g transform="translate(0, 98)">
              <rect
                x={260}
                y={0}
                width={480}
                height={18}
                rx={9}
                fill="#4c1d95"
                fillOpacity={0.25}
                stroke="#7c3aed"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={500}
                y={12}
                textAnchor="middle"
                fill="#c4b5fd"
                fontSize={9}
                fontWeight="700"
                letterSpacing={2}
              >
                ★ VIP FRONT ROW ORCHESTRA ★
              </text>
            </g>

            {/* Premium Header Banner */}
            <g transform="translate(0, 226)">
              <rect
                x={210}
                y={0}
                width={580}
                height={18}
                rx={9}
                fill="#1e3a8a"
                fillOpacity={0.25}
                stroke="#2563eb"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={500}
                y={12}
                textAnchor="middle"
                fill="#93c5fd"
                fontSize={9}
                fontWeight="700"
                letterSpacing={2}
              >
                ◆ PREMIUM MEZZANINE TIER ◆
              </text>
            </g>

            {/* Standard Header Banner */}
            <g transform="translate(0, 404)">
              <rect
                x={160}
                y={0}
                width={680}
                height={18}
                rx={9}
                fill="#064e3b"
                fillOpacity={0.25}
                stroke="#059669"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={500}
                y={12}
                textAnchor="middle"
                fill="#6ee7b7"
                fontSize={9}
                fontWeight="700"
                letterSpacing={2}
              >
                ▲ STANDARD GENERAL SEATING ▲
              </text>
            </g>

            {/* 5. Row Indicators (Both Left & Right Flanks) */}
            {rowBounds.map((rb) => {
              const tierTheme = TIER_THEMES[rb.tier] || TIER_THEMES.STANDARD;
              return (
                <g key={`row-${rb.row}`}>
                  {/* Left row badge */}
                  <g transform={`translate(${rb.minX - 38}, ${rb.y - 12})`}>
                    <rect
                      width={22}
                      height={24}
                      rx={6}
                      fill="#0f172a"
                      stroke={tierTheme.stroke}
                      strokeWidth={1}
                      strokeOpacity={0.4}
                    />
                    <text
                      x={11}
                      y={16}
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize={11}
                      fontWeight="700"
                    >
                      {rb.row}
                    </text>
                  </g>

                  {/* Right row badge */}
                  <g transform={`translate(${rb.maxX + 16}, ${rb.y - 12})`}>
                    <rect
                      width={22}
                      height={24}
                      rx={6}
                      fill="#0f172a"
                      stroke={tierTheme.stroke}
                      strokeWidth={1}
                      strokeOpacity={0.4}
                    />
                    <text
                      x={11}
                      y={16}
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize={11}
                      fontWeight="700"
                    >
                      {rb.row}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* 6. Realistic Stadium Armchairs */}
            {seats.map((seat) => {
              const isSelected = selectedSeats.some((s) => s.id === seat.id);
              const isHeld = seat.status === 'HELD';
              const isHeldByMe = isSelected || seat.isHeldByMe || heldSeatIds.includes(seat.id);
              const isSold = seat.status === 'SOLD';
              const isHovered = hoveredSeat?.id === seat.id;

              const theme = TIER_THEMES[seat.tier] || TIER_THEMES.STANDARD;

              // Dim seats if tier filter active and doesn't match
              const matchesFilter = selectedTierFilter === null || selectedTierFilter === seat.tier;

              // Styles calculation
              let backrestFill = theme.backrest;
              let cushionFill = theme.cushion;
              let stroke = theme.stroke;
              let opacity = matchesFilter ? 1 : 0.25;
              let cursor = 'pointer';

              if (isSold) {
                backrestFill = '#1e293b';
                cushionFill = '#334155';
                stroke = '#475569';
                cursor = 'not-allowed';
                opacity = matchesFilter ? 0.45 : 0.15;
              } else if (isHeld && !isHeldByMe) {
                backrestFill = '#92400e';
                cushionFill = '#d97706';
                stroke = '#fcd34d';
                cursor = 'not-allowed';
                opacity = matchesFilter ? 0.8 : 0.2;
              } else if (isSelected || isHeldByMe) {
                backrestFill = '#4338ca';
                cushionFill = '#6366f1';
                stroke = '#a5b4fc';
                opacity = 1;
              }

              return (
                <g
                  key={seat.id}
                  onClick={() => handleSeatClick(seat)}
                  onMouseEnter={() => setHoveredSeat(seat)}
                  onMouseLeave={() => setHoveredSeat(null)}
                  style={{ cursor }}
                  className="transition-all duration-150"
                >
                  {/* Glowing selection ring when selected */}
                  {(isSelected || isHeldByMe) && (
                    <rect
                      x={seat.x - 17}
                      y={seat.y - 17}
                      width={34}
                      height={32}
                      rx={9}
                      fill="none"
                      stroke="#818cf8"
                      strokeWidth={2.5}
                      className="animate-pulse filter drop-shadow-[0_0_10px_rgba(129,140,248,0.9)]"
                    />
                  )}

                  {/* Hover halo */}
                  {isHovered && !isSold && !isHeld && !isSelected && (
                    <rect
                      x={seat.x - 15}
                      y={seat.y - 15}
                      width={30}
                      height={28}
                      rx={7}
                      fill="none"
                      stroke={theme.stroke}
                      strokeWidth={1.5}
                      opacity={0.6}
                    />
                  )}

                  {/* Realistic Armchair: Backrest */}
                  <rect
                    x={seat.x - 12}
                    y={seat.y - 13}
                    width={24}
                    height={11}
                    rx={4.5}
                    fill={backrestFill}
                    stroke={stroke}
                    strokeWidth={isSelected || isHeldByMe ? 2 : 1.2}
                    opacity={opacity}
                    className="transition-all"
                  />

                  {/* Realistic Armchair: Cushion Base */}
                  <rect
                    x={seat.x - 10}
                    y={seat.y - 2}
                    width={20}
                    height={12}
                    rx={3.5}
                    fill={cushionFill}
                    stroke={stroke}
                    strokeWidth={isSelected || isHeldByMe ? 2 : 1.2}
                    opacity={opacity}
                    className="transition-all"
                  />

                  {/* Left Armrest */}
                  <rect
                    x={seat.x - 14}
                    y={seat.y - 6}
                    width={3}
                    height={11}
                    rx={1.5}
                    fill={stroke}
                    opacity={opacity * 0.85}
                  />

                  {/* Right Armrest */}
                  <rect
                    x={seat.x + 11}
                    y={seat.y - 6}
                    width={3}
                    height={11}
                    rx={1.5}
                    fill={stroke}
                    opacity={opacity * 0.85}
                  />

                  {/* Seat Number */}
                  <text
                    x={seat.x}
                    y={seat.y - 4}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={7.5}
                    fontWeight="700"
                    opacity={opacity}
                    pointerEvents="none"
                  >
                    {seat.number}
                  </text>
                </g>
              );
            })}
          </svg>
        </motion.div>
      </div>

      {/* Floating HUD Seat Inspector Card */}
      <div className="mt-4 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {hoveredSeat ? (
          <>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-md"
                style={{
                  backgroundColor: TIER_THEMES[hoveredSeat.tier]?.cushion || '#6366f1',
                }}
              >
                {hoveredSeat.row}
                {hoveredSeat.number}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">
                    Row {hoveredSeat.row} • Seat {hoveredSeat.number}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      TIER_THEMES[hoveredSeat.tier]?.badgeBg
                    } ${TIER_THEMES[hoveredSeat.tier]?.badgeText} ${
                      TIER_THEMES[hoveredSeat.tier]?.border
                    }`}
                  >
                    {hoveredSeat.tier}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Section: {hoveredSeat.section} •{' '}
                  {hoveredSeat.row === 'A' || hoveredSeat.row === 'B'
                    ? 'Front-row center orchestra'
                    : hoveredSeat.row <= 'E'
                    ? 'Mid-tier elevated angle'
                    : 'Upper tiered general view'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:self-center self-end">
              <span className="font-mono text-base font-extrabold text-emerald-400">
                {formatINR(hoveredSeat.price)}
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  hoveredSeat.status === 'AVAILABLE'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : hoveredSeat.status === 'HELD'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {hoveredSeat.status === 'AVAILABLE'
                  ? 'Click to Select'
                  : hoveredSeat.status === 'HELD'
                  ? 'Locked by Attendee'
                  : 'Sold Out'}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between w-full text-slate-400">
            <span className="flex items-center gap-2 text-xs">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Hover over any armchair to inspect row, tier acoustics, and pricing.</span>
            </span>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Selected: <strong className="text-indigo-300">{selectedSeats.length}/6</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
