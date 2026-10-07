'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
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
} from 'lucide-react';

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
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state for creating event
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newVenueId, setNewVenueId] = useState('');
  const [newStartsAt, setNewStartsAt] = useState('');
  const [vipPrice, setVipPrice] = useState('80');
  const [premiumPrice, setPremiumPrice] = useState('50');
  const [standardPrice, setStandardPrice] = useState('30');
  const [formError, setFormError] = useState<string | null>(null);

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

  // Venues query for the create event dropdown
  const { data: venuesData } = useQuery<{ venues: Array<{ id: string; name: string }> }>({
    queryKey: ['organizer', 'venues'],
    queryFn: () => apiFetch('/api/organizer/venues'),
    enabled: isOrganizer && showCreateModal,
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async () => {
      if (!newVenueId) throw new Error('Please select a venue');
      if (!newTitle.trim()) throw new Error('Please enter an event title');
      if (!newStartsAt) throw new Error('Please pick a start date and time');

      return apiFetch('/api/organizer/events', {
        method: 'POST',
        body: JSON.stringify({
          venueId: newVenueId,
          title: newTitle,
          description: newDesc || undefined,
          startsAt: new Date(newStartsAt).toISOString(),
          pricing: {
            VIP: Math.round(parseFloat(vipPrice) * 100),
            PREMIUM: Math.round(parseFloat(premiumPrice) * 100),
            STANDARD: Math.round(parseFloat(standardPrice) * 100),
          },
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizer', 'stats'] });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      setNewStartsAt('');
      setFormError(null);
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
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New Event
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
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              ${((summary?.totalRevenueCents ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                          ${(ev.revenueCents / 100).toFixed(2)}
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
                          ${(order.totalCents / 100).toFixed(2)}
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

      {/* Create Event Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white tracking-tight">Create New Event</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  {formError}
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Select Venue</label>
                  <select
                    value={newVenueId}
                    onChange={(e) => setNewVenueId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Choose a venue --</option>
                    {venuesData?.venues?.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Event Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Symphony of the Night"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Description</label>
                  <textarea
                    placeholder="Brief concert or event overview..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={newStartsAt}
                    onChange={(e) => setNewStartsAt(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-slate-300 font-medium mb-2">Tier Pricing ($)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-amber-400 block mb-1 font-semibold">VIP</span>
                      <input
                        type="number"
                        min="1"
                        value={vipPrice}
                        onChange={(e) => setVipPrice(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-400 block mb-1 font-semibold">PREMIUM</span>
                      <input
                        type="number"
                        min="1"
                        value={premiumPrice}
                        onChange={(e) => setPremiumPrice(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-cyan-400 block mb-1 font-semibold">STANDARD</span>
                      <input
                        type="number"
                        min="1"
                        value={standardPrice}
                        onChange={(e) => setStandardPrice(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={createEventMutation.isPending}
                  onClick={() => createEventMutation.mutate()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50"
                >
                  {createEventMutation.isPending ? 'Publishing...' : 'Publish Event'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
