'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IndianRupee,
  Ticket,
  TrendingUp,
  Calendar,
  Plus,
  Users,
  Building,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Search,
  X,
  MapPin,
} from 'lucide-react';
import { formatINR } from '@/lib/format';

interface EventStat {
  id: string;
  title: string;
  startsAt: string;
  venueName: string;
  totalSeats: number;
  soldSeats: number;
  heldSeats: number;
  availableSeats: number;
  occupancyRate: number;
  revenueCents: number;
}

interface OrganizerSummary {
  totalEvents: number;
  totalVenues: number;
  totalTicketsSold: number;
  totalRevenueCents: number;
  totalSeats: number;
  overallOccupancyRate: number;
}

interface RecentOrder {
  id: string;
  userEmail: string;
  eventTitle: string;
  ticketCount: number;
  totalCents: number;
  createdAt: string;
}

interface DashboardData {
  summary: OrganizerSummary;
  events: EventStat[];
  recentOrders: RecentOrder[];
}

export default function OrganizerDashboardPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateCard, setShowCreateCard] = useState(false);

  // Form state for creating event
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newVenueName, setNewVenueName] = useState('Grand Symphony Hall');
  const [newStartsAt, setNewStartsAt] = useState('');
  const [vipPrice, setVipPrice] = useState('2500');
  const [premiumPrice, setPremiumPrice] = useState('1500');
  const [standardPrice, setStandardPrice] = useState('750');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Auth query
  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch('/api/auth/me'),
    retry: false,
  });

  const user = authData?.user;
  const isOrganizer = user?.role === 'ORGANIZER';

  // Stats query
  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery<DashboardData>({
    queryKey: ['organizer', 'stats'],
    queryFn: () => apiFetch('/api/organizer/stats'),
    enabled: isOrganizer,
    refetchInterval: 10000, // live pulse every 10s
  });

  // Venues query for quick chips
  const { data: venuesData } = useQuery<{ venues: Array<{ id: string; name: string }> }>({
    queryKey: ['organizer', 'venues'],
    queryFn: () => apiFetch('/api/organizer/venues'),
    enabled: isOrganizer,
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim()) throw new Error('Please enter an event title');
      if (!newVenueName.trim()) throw new Error('Please enter a venue name');
      if (!newStartsAt) throw new Error('Please pick a start date and time');

      const matchedVenue = venuesData?.venues?.find(
        (v) => v.name.toLowerCase() === newVenueName.trim().toLowerCase()
      );

      return apiFetch('/api/organizer/events', {
        method: 'POST',
        body: JSON.stringify({
          venueId: matchedVenue?.id,
          venueName: newVenueName.trim(),
          title: newTitle.trim(),
          description: newDesc.trim() || undefined,
          startsAt: new Date(newStartsAt).toISOString(),
          pricing: {
            VIP: Math.round(parseFloat(vipPrice || '2500') * 100),
            PREMIUM: Math.round(parseFloat(premiumPrice || '1500') * 100),
            STANDARD: Math.round(parseFloat(standardPrice || '750') * 100),
          },
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizer', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setFormSuccess('Event successfully published and seat map generated!');
      setNewTitle('');
      setNewDesc('');
      setNewStartsAt('');
      setFormError(null);
      setTimeout(() => {
        setFormSuccess(null);
        setShowCreateCard(false);
      }, 2500);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create event');
    },
  });

  // Quick organizer demo login handler
  async function handleOrganizerLogin() {
    await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'organizer@eventseat.com', password: 'password123' }),
    });
    await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
  }

  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-400">
        Loading organizer dashboard...
      </div>
    );
  }

  // Unauthorized view
  if (!isOrganizer) {
    return (
      <main className="max-w-xl mx-auto px-4 py-20">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center shadow-xl space-y-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Building className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Organizer Portal</h1>
            <p className="text-sm text-slate-400">
              This console provides live occupancy telemetry, revenue analytics, and gate check-in reports. You must be signed in with an <strong className="text-indigo-300">ORGANIZER</strong> role.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleOrganizerLogin}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              Sign in as Demo Organizer
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[11px] text-slate-500 mt-2">
              Credentials: organizer@eventseat.com
            </p>
          </div>
        </div>
      </main>
    );
  }

  const summary = statsData?.summary;
  const events = statsData?.events || [];
  const recentOrders = statsData?.recentOrders || [];

  const filteredEvents = events.filter(
    (ev) =>
      ev.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.venueName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Organizer Overview
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              Live Telemetry
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time ticket sales, capacity occupancy, and venue performance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/staff/scanner"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Staff Scanner
          </Link>
          <button
            onClick={() => setShowCreateCard((prev) => !prev)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-md ${
              showCreateCard
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
            }`}
          >
            {showCreateCard ? (
              <>
                <X className="w-4 h-4" />
                <span>Close Form</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>New Event</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-sm relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Gross Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {formatINR(summary?.totalRevenueCents ?? 0)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-400 font-medium">Confirmed</span> across all events
            </div>
          </div>
        </motion.div>

        {/* Tickets Sold */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-sm relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Tickets Sold</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {summary?.totalTicketsSold ?? 0}
              <span className="text-sm font-normal text-slate-500 ml-1.5">/ {summary?.totalSeats ?? 0} seats</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Active inventory booked
            </div>
          </div>
        </motion.div>

        {/* Occupancy Rate */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-sm relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Occupancy Rate</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {summary?.overallOccupancyRate ?? 0}%
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, summary?.overallOccupancyRate ?? 0)}%` }}
              />
            </div>
          </div>
        </motion.div>

        {/* Live Events */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-sm relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Events</span>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center border border-violet-500/20">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {summary?.totalEvents ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              In {summary?.totalVenues ?? 0} configured venues
            </div>
          </div>
        </motion.div>
      </div>

      {/* Inline Create New Event Card (No Drawer / Modal) */}
      <AnimatePresence>
        {showCreateCard && (
          <motion.div
            initial={{ opacity: 0, y: -16, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -16, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/90 p-6 sm:p-7 shadow-2xl backdrop-blur-md space-y-6">
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Create New Event</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Configure your event schedule, venue location, and tier pricing.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateCard(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Close form"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Success Notice */}
              {formSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Error Notice */}
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                {/* Event Title */}
                <div className="space-y-1.5">
                  <label className="block text-slate-300 font-semibold">
                    Event Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Electric Symphony Night"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* Venue / Location (Clean text input) */}
                <div className="space-y-1.5">
                  <label className="block text-slate-300 font-semibold">
                    Venue / Location Name <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="e.g. Grand Symphony Hall"
                      value={newVenueName}
                      onChange={(e) => setNewVenueName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-medium"
                    />
                  </div>
                </div>

                {/* Start Date & Time */}
                <div className="space-y-1.5">
                  <label className="block text-slate-300 font-semibold">
                    Start Date & Time <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={newStartsAt}
                    onChange={(e) => setNewStartsAt(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="block text-slate-300 font-semibold">
                    Description <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Brief description of the concert or event..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Tier Pricing Cards */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Seat Tier Pricing (Indian Rupees ₹)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Automatically assigned to generated seat rows
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* VIP */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        VIP Tier
                      </span>
                      <span className="text-[11px] text-slate-500">Front Rows</span>
                    </div>
                    <div className="relative">
                      <span className="text-xs font-mono text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={vipPrice}
                        onChange={(e) => setVipPrice(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono font-semibold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* PREMIUM */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-indigo-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        Premium Tier
                      </span>
                      <span className="text-[11px] text-slate-500">Mid Rows</span>
                    </div>
                    <div className="relative">
                      <span className="text-xs font-mono text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={premiumPrice}
                        onChange={(e) => setPremiumPrice(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono font-semibold text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* STANDARD */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-cyan-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        Standard Tier
                      </span>
                      <span className="text-[11px] text-slate-500">Upper Rows</span>
                    </div>
                    <div className="relative">
                      <span className="text-xs font-mono text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={standardPrice}
                        onChange={(e) => setStandardPrice(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono font-semibold text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateCard(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={createEventMutation.isPending}
                  onClick={() => createEventMutation.mutate()}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50 flex items-center gap-2"
                >
                  {createEventMutation.isPending ? 'Publishing Event...' : 'Publish Event'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Events Grid Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Event Performance</span>
            <span className="text-xs font-normal text-slate-400">({events.length})</span>
          </h2>

          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search event or venue..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {statsLoading ? (
          <div className="py-12 text-center text-slate-500 text-xs">Loading performance data...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/20 p-8 text-center text-slate-400 text-xs">
            No events match your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEvents.map((ev) => {
              const startDate = new Date(ev.startsAt);
              const soldPercent = ev.totalSeats > 0 ? (ev.soldSeats / ev.totalSeats) * 100 : 0;
              const heldPercent = ev.totalSeats > 0 ? (ev.heldSeats / ev.totalSeats) * 100 : 0;
              const availPercent = ev.totalSeats > 0 ? (ev.availableSeats / ev.totalSeats) * 100 : 0;

              return (
                <div
                  key={ev.id}
                  className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 flex flex-col justify-between hover:border-slate-700/80 transition-all hover:shadow-xl hover:shadow-indigo-950/20 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1 text-base">
                          {ev.title}
                        </h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Building className="w-3.5 h-3.5 text-slate-500" />
                          {ev.venueName}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-400">
                          {formatINR(ev.revenueCents)}
                        </span>
                        <div className="text-[10px] text-slate-500">Revenue</div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-1 bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-800/60">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        {startDate.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        •{' '}
                        {startDate.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Capacity Visual Progress Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Occupancy</span>
                        <span className="font-bold text-indigo-300">{ev.occupancyRate}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-800/80 rounded-full flex overflow-hidden">
                        {soldPercent > 0 && (
                          <div
                            style={{ width: `${soldPercent}%` }}
                            className="bg-emerald-500 h-full"
                            title={`Sold: ${ev.soldSeats}`}
                          />
                        )}
                        {heldPercent > 0 && (
                          <div
                            style={{ width: `${heldPercent}%` }}
                            className="bg-amber-400 h-full"
                            title={`Held: ${ev.heldSeats}`}
                          />
                        )}
                        {availPercent > 0 && (
                          <div
                            style={{ width: `${availPercent}%` }}
                            className="bg-slate-700/60 h-full"
                            title={`Available: ${ev.availableSeats}`}
                          />
                        )}
                      </div>

                      {/* Legend counts */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Sold: <strong className="text-slate-300">{ev.soldSeats}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Held: <strong className="text-slate-300">{ev.heldSeats}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                          Avail: <strong className="text-slate-300">{ev.availableSeats}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card actions */}
                  <div className="pt-4 mt-4 border-t border-slate-800/60 flex items-center justify-between gap-2">
                    <Link
                      href={`/events/${ev.id}`}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                      target="_blank"
                    >
                      <span>Public Map</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>

                    <Link
                      href={`/organizer/events/${ev.id}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all flex items-center gap-1"
                    >
                      <span>Analytics</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Orders Feed */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <span>Recent Booking Activity</span>
          <span className="text-xs font-normal text-slate-400">({recentOrders.length})</span>
        </h2>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 font-medium">Order ID</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium text-center">Tickets</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No orders confirmed yet.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => {
                    const orderDate = new Date(order.createdAt);
                    return (
                      <tr key={order.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                          {order.id.slice(0, 8)}...
                        </td>
                        <td className="px-4 py-3 font-medium text-white">{order.userEmail}</td>
                        <td className="px-4 py-3 text-slate-300 max-w-xs truncate">{order.eventTitle}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {order.ticketCount} {order.ticketCount === 1 ? 'ticket' : 'tickets'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                          {formatINR(order.totalCents)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 text-[11px]">
                          {orderDate.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </main>
  );
}
