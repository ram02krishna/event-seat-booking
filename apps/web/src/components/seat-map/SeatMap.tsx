'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore, SeatItem } from '@/store/cartStore';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Layers,
  ShieldCheck,
  Film,
  Building2,
  Music2,
  Radio,
  Tv,
  Mic2,
  Volume2,
} from 'lucide-react';
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
    label: 'VIP Front Row',
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
    label: 'Premium Middle',
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
  const baseHeight = venueLayout?.height || 740;
  const venueType = venueLayout?.type || 'THEATER_DOLBY';

  const stage = venueLayout?.stage || {
    x: 200,
    y: 22,
    width: 600,
    height: 48,
    label: 'STAGE / SCREEN',
    subtitle: '',
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

  // Compute section min Y for dynamic section banner headers
  const sectionBounds = useMemo(() => {
    const vip = seats.filter((s) => s.tier === 'VIP');
    const premium = seats.filter((s) => s.tier === 'PREMIUM');
    const standard = seats.filter((s) => s.tier === 'STANDARD');

    return {
      VIP: vip.length > 0 ? Math.min(...vip.map((s) => s.y)) : null,
      PREMIUM: premium.length > 0 ? Math.min(...premium.map((s) => s.y)) : null,
      STANDARD: standard.length > 0 ? Math.min(...standard.map((s) => s.y)) : null,
    };
  }, [seats]);

  const selectedSeatIdSet = useMemo(
    () => new Set(selectedSeats.map((s) => s.id)),
    [selectedSeats]
  );
  const heldSeatIdSet = useMemo(() => new Set(heldSeatIds), [heldSeatIds]);

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

  // Get Venue Type Metadata
  const typeMeta = useMemo(() => {
    switch (venueType) {
      case 'THEATER_DOLBY':
        return {
          icon: Film,
          title: 'Theater with Dolby Atmos',
          badge: 'Dolby Atmos 7.1.4 • Curved Screen',
          accent: 'text-violet-400 border-violet-500/30 bg-violet-500/10',
          vipLabel: '★ VIP RECLINER STALLS ★',
          premiumLabel: '★ PREMIUM CLUB CINEMA ★',
          standardLabel: '★ EXECUTIVE CINEMA STALLS ★',
        };
      case 'CONFERENCE_HALL':
        return {
          icon: Building2,
          title: 'Corporate Conference Hall',
          badge: 'Keynote Stage • Dual 8K Displays',
          accent: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
          vipLabel: '★ EXECUTIVE FRONT DELEGATION ★',
          premiumLabel: '★ CORPORATE DELEGATE DESKS ★',
          standardLabel: '★ GENERAL CONFERENCE ROWS ★',
        };
      case 'AUDITORIUM':
        return {
          icon: Music2,
          title: 'Royal Philharmonic Grand Auditorium',
          badge: 'Orchestra Pit • Acoustic Shell',
          accent: 'text-pink-400 border-pink-500/30 bg-pink-500/10',
          vipLabel: '★ ORCHESTRA STALLS (ROYAL) ★',
          premiumLabel: '★ GRAND MEZZANINE TIER ★',
          standardLabel: '★ UPPER BALCONY GALLERY ★',
        };
      case 'ARENA':
        return {
          icon: Radio,
          title: 'Concert Mega Arena',
          badge: 'Catwalk Runway • Laser Lighting',
          accent: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
          vipLabel: '★ GOLDEN CIRCLE FRONT PIT ★',
          premiumLabel: '★ LOWER BOWL CLUB SEATS ★',
          standardLabel: '★ UPPER BOWL BLEACHERS ★',
        };
      default:
        return {
          icon: Sparkles,
          title: 'Event Hall',
          badge: 'Versatile Venue Layout',
          accent: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
          vipLabel: '★ VIP FRONT ROW ★',
          premiumLabel: '★ PREMIUM MIDDLE ★',
          standardLabel: '★ STANDARD GENERAL ★',
        };
    }
  }, [venueType]);

  const VenueIcon = typeMeta.icon;

  return (
    <div className="relative w-full rounded-3xl bg-slate-950 border border-slate-800/80 shadow-2xl p-4 sm:p-6 overflow-hidden select-none">
      {/* Top Header: Venue Type Badge & Legend Controls */}
      <div className="space-y-4 mb-4">
        {/* Venue Architecture Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${typeMeta.accent}`}>
              <VenueIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white tracking-wide">{typeMeta.title}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${typeMeta.accent}`}>
                  {typeMeta.badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {stage.subtitle || (venueLayout?.features?.join(' • ') ?? 'Interactive SVG Seat Map with real-time locking')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>5-minute seat reservation locking</span>
          </div>
        </div>

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

              const customName =
                venueLayout?.sections?.find((s) => s.tier === tierKey)?.name || config.label;

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
                  <span className="font-semibold">{customName}</span>
                  <span className="font-mono text-[11px] opacity-80">
                    {formatINR(stat.minPrice)}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {stat.available}/{stat.total}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() => handleZoom(-0.15)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-400 px-1 min-w-[3rem] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => handleZoom(0.15)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={resetZoom}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-0.5 border-l border-slate-800"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Real-time Legend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-emerald-500 border border-emerald-400 shadow-sm shadow-emerald-500/50" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-indigo-600 border border-indigo-400 shadow-sm shadow-indigo-500/50" />
              <span>Selected by you</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-amber-500 border border-amber-400 animate-pulse" />
              <span>Held by others (Locked)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-slate-700 border border-slate-600 opacity-60" />
              <span>Reserved / Sold</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500">
            Click seats to toggle • Up to 6 seats per booking
          </div>
        </div>
      </div>

      {/* Floating Error Alert */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold shadow-xl border border-rose-400 flex items-center gap-2"
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* SVG Seating Plan Canvas */}
      <div className="relative w-full overflow-auto flex justify-center items-center min-h-[520px] max-h-[750px] bg-radial from-slate-900/60 to-slate-950 rounded-2xl border border-slate-900/80 p-2 sm:p-4">
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

              {/* Dolby Atmos Screen Glow */}
              <linearGradient id="dolbyScreenGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
              </linearGradient>

              {/* Laser Projection Beam from back */}
              <linearGradient id="laserProjectorBeam" x1="50%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                <stop offset="70%" stopColor="#3b82f6" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.0" />
              </linearGradient>

              {/* Stage Surface Gradient */}
              <linearGradient id="stageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e1b4b" />
                <stop offset="50%" stopColor="#2e1065" />
                <stop offset="100%" stopColor="#1e1b4b" />
              </linearGradient>

              {/* Wooden Stage Floor Gradient for Auditorium / Hall */}
              <linearGradient id="timberStageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#451a03" />
                <stop offset="50%" stopColor="#78350f" />
                <stop offset="100%" stopColor="#451a03" />
              </linearGradient>

              {/* Arena Concert Glow */}
              <linearGradient id="arenaLaserBeam" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
                <stop offset="50%" stopColor="#a855f7" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
              </linearGradient>

              {/* Stage Floor Arc Glow */}
              <radialGradient id="stageFloorGlow" cx="50%" cy="0%" r="85%">
                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
                <stop offset="60%" stopColor="#6366f1" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
              </radialGradient>
            </defs>

            {/* Background Atmosphere Beam */}
            <polygon
              points={`${baseWidth / 2 - 180},35 ${baseWidth / 2 + 180},35 ${baseWidth / 2 + 460},710 ${baseWidth / 2 - 460},710`}
              fill="url(#spotlightBeam)"
              pointerEvents="none"
            />

            {/* ============================================================ */}
            {/* VENUE ARCHITECTURAL THEMES & STAGES                          */}
            {/* ============================================================ */}

            {/* 1. THEATER WITH DOLBY ATMOS */}
            {venueType === 'THEATER_DOLBY' && (
              <g id="dolby-atmos-architecture">
                {/* Rear Laser Projector Beam */}
                <polygon
                  points={`${baseWidth / 2 - 60},710 ${baseWidth / 2 + 60},710 ${stage.x + stage.width - 20},${stage.y + 20} ${stage.x + 20},${stage.y + 20}`}
                  fill="url(#laserProjectorBeam)"
                  pointerEvents="none"
                />

                {/* Curved Panoramic Screen */}
                <path
                  d={`M ${stage.x - 20} ${stage.y + 40} 
                      Q ${baseWidth / 2} ${stage.y - 10} ${stage.x + stage.width + 20} ${stage.y + 40} 
                      L ${stage.x + stage.width + 12} ${stage.y + 48} 
                      Q ${baseWidth / 2} ${stage.y + 2} ${stage.x - 12} ${stage.y + 48} Z`}
                  fill="url(#dolbyScreenGlow)"
                  className="filter drop-shadow-[0_0_24px_rgba(56,189,248,0.7)]"
                />

                {/* Screen Frame Border */}
                <path
                  d={`M ${stage.x - 25} ${stage.y + 42} 
                      Q ${baseWidth / 2} ${stage.y - 14} ${stage.x + stage.width + 25} ${stage.y + 42}`}
                  stroke="#38bdf8"
                  strokeWidth={3}
                  fill="none"
                />

                {/* Screen Typography */}
                <text
                  x={baseWidth / 2}
                  y={stage.y + 32}
                  textAnchor="middle"
                  fill="#030712"
                  fontSize={13}
                  fontWeight="900"
                  letterSpacing={4}
                >
                  ✦ {stage.label || 'CURVED DOLBY ATMOS SCREEN'} ✦
                </text>

                {/* Direction to Screen */}
                <text
                  x={baseWidth / 2}
                  y={stage.y + 70}
                  textAnchor="middle"
                  fill="#38bdf8"
                  fontSize={10}
                  fontWeight="700"
                  letterSpacing={3}
                  opacity={0.9}
                >
                  ▲ THIS WAY TO SCREEN ▲
                </text>

                {/* Dolby Left Wall Speakers */}
                {[170, 290, 420, 560].map((sy, i) => (
                  <g key={`spk-l-${i}`} transform={`translate(40, ${sy})`}>
                    <rect width={28} height={20} rx={4} fill="#0f172a" stroke="#38bdf8" strokeWidth={1.5} />
                    <circle cx={14} cy={10} r={5} fill="#38bdf8" opacity={0.8} />
                    <path d="M 32 4 Q 40 10 32 16" stroke="#38bdf8" strokeWidth={1.5} fill="none" opacity={0.6} />
                    <path d="M 37 0 Q 48 10 37 20" stroke="#38bdf8" strokeWidth={1} fill="none" opacity={0.35} />
                    <text x={-6} y={13} fill="#94a3b8" fontSize={8} fontWeight="700" textAnchor="end">
                      L{i + 1}
                    </text>
                  </g>
                ))}

                {/* Dolby Right Wall Speakers */}
                {[170, 290, 420, 560].map((sy, i) => (
                  <g key={`spk-r-${i}`} transform={`translate(${baseWidth - 68}, ${sy})`}>
                    <rect width={28} height={20} rx={4} fill="#0f172a" stroke="#38bdf8" strokeWidth={1.5} />
                    <circle cx={14} cy={10} r={5} fill="#38bdf8" opacity={0.8} />
                    <path d="M -4 4 Q -12 10 -4 16" stroke="#38bdf8" strokeWidth={1.5} fill="none" opacity={0.6} />
                    <path d="M -9 0 Q -20 10 -9 20" stroke="#38bdf8" strokeWidth={1} fill="none" opacity={0.35} />
                    <text x={34} y={13} fill="#94a3b8" fontSize={8} fontWeight="700">
                      R{i + 1}
                    </text>
                  </g>
                ))}

                {/* Dolby Atmos Surround Audio Badge */}
                <g transform="translate(65, 30)">
                  <rect width={130} height={24} rx={6} fill="#0f172a" stroke="#8b5cf6" strokeWidth={1} />
                  <text x={65} y={16} fill="#c4b5fd" fontSize={9} fontWeight="800" textAnchor="middle" letterSpacing={1}>
                    DOLBY ATMOS 7.1.4
                  </text>
                </g>

                {/* 4K Laser Screen Badge */}
                <g transform={`translate(${baseWidth - 195}, 30)`}>
                  <rect width={130} height={24} rx={6} fill="#0f172a" stroke="#38bdf8" strokeWidth={1} />
                  <text x={65} y={16} fill="#7dd3fc" fontSize={9} fontWeight="800" textAnchor="middle" letterSpacing={1}>
                    4K LASER PROJECTION
                  </text>
                </g>

                {/* Center Aisle Floor Runners */}
                <rect x={485} y={120} width={30} height={530} fill="#38bdf8" fillOpacity={0.03} rx={4} />
                <line x1={500} y1={130} x2={500} y2={640} stroke="#38bdf8" strokeWidth={1} strokeDasharray="6 8" opacity={0.35} />
              </g>
            )}

            {/* 2. CONFERENCE HALL */}
            {venueType === 'CONFERENCE_HALL' && (
              <g id="conference-hall-architecture">
                {/* Main Keynote Platform */}
                <rect
                  x={stage.x}
                  y={stage.y}
                  width={stage.width}
                  height={stage.height}
                  rx={10}
                  fill="url(#stageGrad)"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  className="filter drop-shadow-[0_0_20px_rgba(6,182,212,0.45)]"
                />

                {/* Left Presentation Screen */}
                <g transform={`translate(${stage.x + 25}, ${stage.y + 6})`}>
                  <rect width={130} height={36} rx={5} fill="#0f172a" stroke="#06b6d4" strokeWidth={1.5} />
                  <text x={65} y={22} fill="#67e8f9" fontSize={9} fontWeight="800" textAnchor="middle" letterSpacing={1}>
                    8K SLIDE DISPLAY 1
                  </text>
                </g>

                {/* Speaker Podium with Mic */}
                <g transform={`translate(${baseWidth / 2 - 24}, ${stage.y + 4})`}>
                  <rect width={48} height={40} rx={6} fill="#0284c7" stroke="#38bdf8" strokeWidth={1.5} />
                  <circle cx={24} cy={14} r={6} fill="#f0f9ff" />
                  <line x1={24} y1={20} x2={24} y2={32} stroke="#f0f9ff" strokeWidth={2} />
                  <text x={24} y={35} fill="#ffffff" fontSize={6.5} fontWeight="800" textAnchor="middle">
                    PODIUM
                  </text>
                </g>

                {/* Right Presentation Screen */}
                <g transform={`translate(${stage.x + stage.width - 155}, ${stage.y + 6})`}>
                  <rect width={130} height={36} rx={5} fill="#0f172a" stroke="#06b6d4" strokeWidth={1.5} />
                  <text x={65} y={22} fill="#67e8f9" fontSize={9} fontWeight="800" textAnchor="middle" letterSpacing={1}>
                    LIVE TELEMETRY 2
                  </text>
                </g>

                {/* Stage Banner */}
                <text
                  x={baseWidth / 2}
                  y={stage.y + stage.height + 18}
                  textAnchor="middle"
                  fill="#67e8f9"
                  fontSize={10.5}
                  fontWeight="800"
                  letterSpacing={3}
                >
                  ✦ KEYNOTE EXECUTIVE PLATFORM ✦
                </text>

                {/* Aisle Q&A Mics */}
                {[
                  { x: 335, y: 220 },
                  { x: 335, y: 410 },
                  { x: 665, y: 220 },
                  { x: 665, y: 410 },
                ].map((mic, idx) => (
                  <g key={`mic-${idx}`} transform={`translate(${mic.x}, ${mic.y})`}>
                    <circle cx={0} cy={0} r={9} fill="#0891b2" fillOpacity={0.2} stroke="#06b6d4" strokeWidth={1} />
                    <circle cx={0} cy={0} r={4} fill="#22d3ee" />
                    <text x={0} y={15} fill="#67e8f9" fontSize={7.5} fontWeight="700" textAnchor="middle">
                      MIC {idx + 1}
                    </text>
                  </g>
                ))}

                {/* Rear AV Console */}
                <g transform={`translate(${baseWidth / 2 - 140}, ${baseHeight - 35})`}>
                  <rect width={280} height={22} rx={6} fill="#0f172a" stroke="#06b6d4" strokeWidth={1} />
                  <text x={140} y={15} fill="#a5f3fc" fontSize={9} fontWeight="700" textAnchor="middle" letterSpacing={1}>
                    🎛️ AV & SIMULTANEOUS TRANSLATION CONSOLE
                  </text>
                </g>
              </g>
            )}

            {/* 3. GRAND AUDITORIUM */}
            {venueType === 'AUDITORIUM' && (
              <g id="auditorium-architecture">
                {/* Proscenium Classical Arch */}
                <path
                  d={`M ${stage.x - 30} ${stage.y + 40} 
                      Q ${baseWidth / 2} ${stage.y - 16} ${stage.x + stage.width + 30} ${stage.y + 40} 
                      L ${stage.x + stage.width + 10} ${stage.y + 54} 
                      Q ${baseWidth / 2} ${stage.y + 8} ${stage.x - 10} ${stage.y + 54} Z`}
                  fill="url(#timberStageGrad)"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  className="filter drop-shadow-[0_0_20px_rgba(251,191,36,0.35)]"
                />

                {/* Sunken Orchestra Pit */}
                <path
                  d={`M ${stage.x + 40} ${stage.y + 56} 
                      Q ${baseWidth / 2} ${stage.y + 85} ${stage.x + stage.width - 40} ${stage.y + 56} 
                      L ${stage.x + stage.width - 50} ${stage.y + 50} 
                      Q ${baseWidth / 2} ${stage.y + 75} ${stage.x + 50} ${stage.y + 50} Z`}
                  fill="#172554"
                  stroke="#60a5fa"
                  strokeWidth={1.5}
                />

                {/* Conductor Dais */}
                <circle cx={baseWidth / 2} cy={stage.y + 74} r={8} fill="#f59e0b" stroke="#ffffff" strokeWidth={1.5} />
                <text x={baseWidth / 2} y={stage.y + 77} fill="#ffffff" fontSize={7} fontWeight="900" textAnchor="middle">
                  ♫
                </text>

                {/* Stage Typography */}
                <text
                  x={baseWidth / 2}
                  y={stage.y + 34}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={12}
                  fontWeight="800"
                  letterSpacing={4}
                >
                  ✦ GRAND ORCHESTRA STAGE & PIT ✦
                </text>
                <text
                  x={baseWidth / 2}
                  y={stage.y + 98}
                  textAnchor="middle"
                  fill="#fcd34d"
                  fontSize={9}
                  fontWeight="700"
                  letterSpacing={2}
                >
                  ♫ CONDUCTOR & PHILHARMONIC PIT ♫
                </text>

                {/* Left Royal Box */}
                <g transform="translate(45, 120)">
                  <rect width={55} height={65} rx={8} fill="#4c0519" stroke="#fbbf24" strokeWidth={1.5} />
                  <text x={27} y={30} fill="#fef08a" fontSize={8} fontWeight="800" textAnchor="middle">
                    ROYAL
                  </text>
                  <text x={27} y={44} fill="#fef08a" fontSize={8} fontWeight="800" textAnchor="middle">
                    BOX L
                  </text>
                </g>

                {/* Right Royal Box */}
                <g transform={`translate(${baseWidth - 100}, 120)`}>
                  <rect width={55} height={65} rx={8} fill="#4c0519" stroke="#fbbf24" strokeWidth={1.5} />
                  <text x={27} y={30} fill="#fef08a" fontSize={8} fontWeight="800" textAnchor="middle">
                    ROYAL
                  </text>
                  <text x={27} y={44} fill="#fef08a" fontSize={8} fontWeight="800" textAnchor="middle">
                    BOX R
                  </text>
                </g>
              </g>
            )}

            {/* 4. ARENA / CONCERT DOME */}
            {venueType === 'ARENA' && (
              <g id="arena-architecture">
                {/* Laser Truss Beams */}
                <polygon
                  points={`${stage.x - 20},${stage.y + 10} ${stage.x + stage.width + 20},${stage.y + 10} ${baseWidth},680 0,680`}
                  fill="url(#arenaLaserBeam)"
                  pointerEvents="none"
                />

                {/* Concert Main Stage Platform */}
                <rect
                  x={stage.x}
                  y={stage.y}
                  width={stage.width}
                  height={stage.height}
                  rx={8}
                  fill="url(#stageGrad)"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  className="filter drop-shadow-[0_0_24px_rgba(244,63,94,0.6)]"
                />

                {/* Catwalk Runway extending into Golden Circle */}
                <path
                  d={`M ${baseWidth / 2 - 35} ${stage.y + stage.height} 
                      L ${baseWidth / 2 + 35} ${stage.y + stage.height} 
                      L ${baseWidth / 2 + 45} ${stage.y + stage.height + 175} 
                      Q ${baseWidth / 2} ${stage.y + stage.height + 195} ${baseWidth / 2 - 45} ${stage.y + stage.height + 175} Z`}
                  fill="#881337"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  className="filter drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]"
                />

                {/* Catwalk Runway Text */}
                <text
                  x={baseWidth / 2}
                  y={stage.y + stage.height + 100}
                  textAnchor="middle"
                  fill="#fecdd3"
                  fontSize={9}
                  fontWeight="900"
                  letterSpacing={3}
                  transform={`rotate(-90 ${baseWidth / 2} ${stage.y + stage.height + 100})`}
                >
                  ⚡ CATWALK RUNWAY ⚡
                </text>

                {/* Stage Lighting Truss */}
                <line x1={stage.x} y1={stage.y - 4} x2={stage.x + stage.width} y2={stage.y - 4} stroke="#fb7185" strokeWidth={3} strokeDasharray="8 6" />

                {/* Stage Flank Subwoofer Arrays */}
                <g transform={`translate(${stage.x - 55}, ${stage.y + 6})`}>
                  <rect width={45} height={42} rx={4} fill="#0f172a" stroke="#f43f5e" strokeWidth={1.5} />
                  <circle cx={22} cy={14} r={8} fill="#f43f5e" opacity={0.8} />
                  <circle cx={22} cy={30} r={8} fill="#f43f5e" opacity={0.8} />
                  <text x={22} y={-4} fill="#fda4af" fontSize={7} fontWeight="800" textAnchor="middle">
                    SUB L
                  </text>
                </g>
                <g transform={`translate(${stage.x + stage.width + 10}, ${stage.y + 6})`}>
                  <rect width={45} height={42} rx={4} fill="#0f172a" stroke="#f43f5e" strokeWidth={1.5} />
                  <circle cx={22} cy={14} r={8} fill="#f43f5e" opacity={0.8} />
                  <circle cx={22} cy={30} r={8} fill="#f43f5e" opacity={0.8} />
                  <text x={22} y={-4} fill="#fda4af" fontSize={7} fontWeight="800" textAnchor="middle">
                    SUB R
                  </text>
                </g>

                {/* Stage Typography */}
                <text
                  x={baseWidth / 2}
                  y={stage.y + stage.height / 2 + 5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={13}
                  fontWeight="900"
                  letterSpacing={4}
                >
                  ⚡ FESTIVAL THRUST STAGE ⚡
                </text>

                {/* Rear FOH Sound Console */}
                <g transform={`translate(${baseWidth / 2 - 120}, ${baseHeight - 32})`}>
                  <rect width={240} height={20} rx={5} fill="#0f172a" stroke="#a855f7" strokeWidth={1} />
                  <text x={120} y={14} fill="#e9d5ff" fontSize={8.5} fontWeight="800" textAnchor="middle" letterSpacing={1}>
                    🎚️ FOH SOUND & LASER LIGHTING CONSOLE
                  </text>
                </g>
              </g>
            )}

            {/* 5. OTHERS / FALLBACK */}
            {venueType === 'OTHERS' && (
              <g id="others-architecture">
                <rect
                  x={stage.x}
                  y={stage.y}
                  width={stage.width}
                  height={stage.height}
                  rx={8}
                  fill="url(#stageGrad)"
                  stroke="#6366f1"
                  strokeWidth={2}
                />
                <text
                  x={baseWidth / 2}
                  y={stage.y + stage.height / 2 + 5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={12}
                  fontWeight="800"
                  letterSpacing={4}
                >
                  ✦ {stage.label || 'MAIN STAGE'} ✦
                </text>
              </g>
            )}

            {/* ============================================================ */}
            {/* DYNAMIC SECTION DIVIDER BANNERS                              */}
            {/* ============================================================ */}

            {/* VIP Banner */}
            {sectionBounds.VIP !== null && (
              <g transform={`translate(0, ${sectionBounds.VIP - 26})`}>
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
                  {typeMeta.vipLabel}
                </text>
              </g>
            )}

            {/* Premium Banner */}
            {sectionBounds.PREMIUM !== null && (
              <g transform={`translate(0, ${sectionBounds.PREMIUM - 26})`}>
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
                  {typeMeta.premiumLabel}
                </text>
              </g>
            )}

            {/* Standard Banner */}
            {sectionBounds.STANDARD !== null && (
              <g transform={`translate(0, ${sectionBounds.STANDARD - 26})`}>
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
                  {typeMeta.standardLabel}
                </text>
              </g>
            )}

            {/* ============================================================ */}
            {/* ROW INDICATORS                                               */}
            {/* ============================================================ */}
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

            {/* ============================================================ */}
            {/* SEAT RENDERING (ARMCHAIRS)                                   */}
            {/* ============================================================ */}
            {seats.map((seat) => {
              const isSelected = selectedSeatIdSet.has(seat.id);
              const isHeld = seat.status === 'HELD';
              const isHeldByMe = isSelected || seat.isHeldByMe || heldSeatIdSet.has(seat.id);
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
                  opacity={opacity}
                  className="transition-opacity duration-200"
                >
                  {/* Subtle selection / hover glow ring */}
                  {(isSelected || isHovered) && (
                    <circle
                      cx={seat.x}
                      cy={seat.y}
                      r={19}
                      fill="none"
                      stroke={isSelected ? '#818cf8' : '#e2e8f0'}
                      strokeWidth={isSelected ? 2 : 1}
                      strokeDasharray={isSelected ? undefined : '2 2'}
                      opacity={isSelected ? 0.9 : 0.5}
                      className={isSelected ? 'animate-pulse' : ''}
                    />
                  )}

                  {/* Seat Armchair SVG Graphic */}
                  <g transform={`translate(${seat.x - 14}, ${seat.y - 14})`}>
                    {/* Left Armrest */}
                    <rect
                      x={1}
                      y={5}
                      width={4}
                      height={18}
                      rx={2}
                      fill="#0f172a"
                      stroke={stroke}
                      strokeWidth={0.8}
                      strokeOpacity={0.7}
                    />

                    {/* Right Armrest */}
                    <rect
                      x={23}
                      y={5}
                      width={4}
                      height={18}
                      rx={2}
                      fill="#0f172a"
                      stroke={stroke}
                      strokeWidth={0.8}
                      strokeOpacity={0.7}
                    />

                    {/* Backrest */}
                    <rect
                      x={4}
                      y={1}
                      width={20}
                      height={10}
                      rx={3}
                      fill={backrestFill}
                      stroke={stroke}
                      strokeWidth={1}
                    />

                    {/* Cushion / Seat Pan */}
                    <rect
                      x={4}
                      y={10}
                      width={20}
                      height={14}
                      rx={3}
                      fill={cushionFill}
                      stroke={stroke}
                      strokeWidth={1}
                    />

                    {/* Seat Number */}
                    <text
                      x={14}
                      y={20}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={8.5}
                      fontWeight="700"
                      className="pointer-events-none select-none"
                    >
                      {seat.number}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </motion.div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredSeat && (
        <div className="mt-3 flex items-center justify-between px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor:
                  TIER_THEMES[hoveredSeat.tier]?.cushion || '#10b981',
              }}
            />
            <span className="font-semibold text-white">
              Row {hoveredSeat.row}, Seat {hoveredSeat.number}
            </span>
            <span className="text-slate-400">({hoveredSeat.tier})</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-emerald-400 font-semibold">
              {formatINR(hoveredSeat.price)}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                hoveredSeat.status === 'AVAILABLE'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : hoveredSeat.status === 'HELD'
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-slate-800 text-slate-400'
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
