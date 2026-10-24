import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { validateBody } from '../middleware/validate';
import { CreateVenueSchema, CreateEventSchema, GenerateSeatsSchema, CreateStaffSchema } from '@repo/shared';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../errors';
import { Role, SeatStatus } from '@prisma/client';
import { getVenueTemplate, VENUE_TEMPLATES } from '../services/venueTemplates.service';
import { redisConnection } from '../redis';

export const organizerRouter = Router();

// Require organizer role for all routes in this router
organizerRouter.use(requireAuth, requireRole([Role.ORGANIZER]));

// List predefined venue templates (Dolby Cinema, Conference Hall, Auditorium, Arena, etc.)
organizerRouter.get('/venue-templates', async (_req: Request, res: Response) => {
  const templates = Object.entries(VENUE_TEMPLATES).map(([type, config]) => ({
    type,
    defaultName: config.defaultName,
    layout: config.layout,
    recommendedPricing: config.recommendedPricing,
  }));
  res.status(200).json({ templates });
});

// Create venue
organizerRouter.post(
  '/venues',
  validateBody(CreateVenueSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, layout, venueType } = req.body;
      const template = getVenueTemplate(venueType);
      const venueLayout = layout || template.layout;

      const venue = await prisma.venue.create({
        data: { name, layout: venueLayout as any },
      });

      // Auto-generate seats for this venue using the template
      const seatDefs = template.generateSeats(venue.id);
      await prisma.seat.createMany({ data: seatDefs, skipDuplicates: true });

      const createdVenue = await prisma.venue.findUnique({
        where: { id: venue.id },
        include: { seats: true },
      });

      res.status(201).json({ venue: createdVenue });
    } catch (err) {
      next(err);
    }
  }
);

// List all venues
organizerRouter.get('/venues', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const venues = await prisma.venue.findMany({
      include: {
        _count: {
          select: { seats: true, events: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ venues });
  } catch (err) {
    next(err);
  }
});

// Generate seats for a venue
organizerRouter.post(
  '/venues/:id/seats',
  validateBody(GenerateSeatsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const venueId = req.params.id as string;
      const { sections } = req.body;

      const venue = await prisma.venue.findUnique({ where: { id: venueId } });
      if (!venue) {
        return next(new AppError(404, 'Venue not found'));
      }

      const seatsToCreate: Array<{
        venueId: string;
        section: string;
        row: string;
        number: number;
        x: number;
        y: number;
        tier: string;
      }> = [];

      for (const section of sections) {
        section.rows.forEach((rowName: string, rowIndex: number) => {
          const y = section.startY + rowIndex * (section.rowSpacing || 50);
          for (let num = 1; num <= section.seatsPerRow; num++) {
            const x = section.startX + (num - 1) * (section.seatSpacing || 50);
            seatsToCreate.push({
              venueId,
              section: section.name,
              row: rowName,
              number: num,
              x,
              y,
              tier: section.tier,
            });
          }
        });
      }

      await prisma.seat.createMany({
        data: seatsToCreate,
        skipDuplicates: true,
      });

      const count = await prisma.seat.count({ where: { venueId } });
      res.status(201).json({ message: `Seats created`, totalSeats: count });
    } catch (err) {
      next(err);
    }
  }
);

// Create event and populate its EventSeats
organizerRouter.post(
  '/events',
  validateBody(CreateEventSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { venueId, venueName, venueType, title, description, startsAt, pricing } = req.body;

      let venue = null;
      if (venueId) {
        venue = await prisma.venue.findUnique({
          where: { id: venueId },
          include: { seats: true },
        });
      }

      const template = getVenueTemplate(venueType);

      if (!venue && venueName && venueName.trim()) {
        const vName = venueName.trim();
        const existing = await prisma.venue.findFirst({
          where: { name: { equals: vName, mode: 'insensitive' } },
          include: { seats: true },
        });

        if (existing) {
          venue = existing;
        } else {
          venue = await prisma.venue.create({
            data: {
              name: vName,
              layout: template.layout as any,
            },
            include: { seats: true },
          });

          const seatDefs = template.generateSeats(venue.id);
          await prisma.seat.createMany({ data: seatDefs, skipDuplicates: true });
          venue = await prisma.venue.findUnique({ where: { id: venue.id }, include: { seats: true } });
        }
      }

      // Fallback to default configured venue with seats
      if (!venue) {
        venue = await prisma.venue.findFirst({
          where: { seats: { some: {} } },
          include: { seats: true },
        });
      }

      if (!venue) {
        return next(new AppError(404, 'Venue not found'));
      }

      if (venue.seats.length === 0) {
        const seatDefs = template.generateSeats(venue.id);
        await prisma.seat.createMany({ data: seatDefs, skipDuplicates: true });
        venue = await prisma.venue.findUnique({ where: { id: venue.id }, include: { seats: true } });
      }

      if (!venue || venue.seats.length === 0) {
        return next(
          new AppError(400, 'Venue has no seats. Could not initialize seats.')
        );
      }

      const event = await prisma.event.create({
        data: {
          venueId: venue.id,
          title,
          description,
          startsAt: new Date(startsAt),
        },
      });

      // Populate EventSeat records for all venue seats
      const defaultTierPricing: Record<string, number> = {
        VIP: template.recommendedPricing.VIP,
        PREMIUM: template.recommendedPricing.PREMIUM,
        STANDARD: template.recommendedPricing.STANDARD,
        ...pricing,
      };

      const eventSeatsData = venue.seats.map((seat) => ({
        eventId: event.id,
        seatId: seat.id,
        price: defaultTierPricing[seat.tier] || template.recommendedPricing.STANDARD,
        status: SeatStatus.AVAILABLE,
      }));

      await prisma.eventSeat.createMany({
        data: eventSeatsData,
      });

      // Invalidate public events cache in Redis so new event appears instantly
      await redisConnection.del('cache:events:published').catch(() => null);

      res.status(201).json({
        event,
        seatsCount: eventSeatsData.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Overview stats for organizer dashboard
organizerRouter.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const totalEvents = await prisma.event.count();
    const totalVenues = await prisma.venue.count();
    const totalTicketsSold = await prisma.ticket.count();
    const revenueAgg = await prisma.order.aggregate({
      where: { status: 'CONFIRMED' },
      _sum: { totalCents: true },
    });
    const totalRevenueCents = revenueAgg._sum.totalCents || 0;

    const totalSeats = await prisma.eventSeat.count();
    const overallOccupancyRate = totalSeats > 0 ? Math.round((totalTicketsSold / totalSeats) * 100) : 0;

    const events = await prisma.event.findMany({
      include: { venue: { select: { name: true, layout: true } } },
      orderBy: { startsAt: 'asc' },
    });

    // Aggregate in SQL instead of loading every seat of every event.
    // Lapsed-but-unswept holds are open seats, not held ones.
    const seatStats = await prisma.$queryRaw<
      Array<{ eventId: string; total: bigint; sold: bigint; held: bigint; revenue: bigint | null }>
    >`
      SELECT "eventId",
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'SOLD'::"SeatStatus") AS sold,
             COUNT(*) FILTER (WHERE status = 'HELD'::"SeatStatus" AND "holdExpiresAt" >= NOW()) AS held,
             SUM(price) FILTER (WHERE status = 'SOLD'::"SeatStatus") AS revenue
      FROM "EventSeat"
      GROUP BY "eventId"
    `;
    const statsByEvent = new Map(seatStats.map((r) => [r.eventId, r]));

    const eventStats = events.map((ev) => {
      const st = statsByEvent.get(ev.id);
      const total = Number(st?.total ?? 0);
      const sold = Number(st?.sold ?? 0);
      const held = Number(st?.held ?? 0);
      const occupancyRate = total > 0 ? Math.round((sold / total) * 100) : 0;

      return {
        id: ev.id,
        title: ev.title,
        startsAt: ev.startsAt,
        venueName: ev.venue.name,
        venueType: (ev.venue.layout as any)?.type || 'THEATER_DOLBY',
        totalSeats: total,
        soldSeats: sold,
        heldSeats: held,
        availableSeats: total - sold - held,
        occupancyRate,
        revenueCents: Number(st?.revenue ?? 0),
      };
    });

    const recentOrders = await prisma.order.findMany({
      where: { status: 'CONFIRMED' },
      include: {
        user: { select: { email: true } },
        event: { select: { title: true } },
        tickets: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    res.status(200).json({
      summary: {
        totalEvents,
        totalVenues,
        totalTicketsSold,
        totalRevenueCents,
        totalSeats,
        overallOccupancyRate,
      },
      events: eventStats,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        userEmail: o.user.email,
        eventTitle: o.event.title,
        ticketCount: o.tickets.length,
        totalCents: o.totalCents,
        createdAt: o.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Detailed stats for a single event
organizerRouter.get('/events/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.id as string;
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        venue: true,
        eventSeats: {
          include: {
            seat: true,
            ticket: true,
          },
        },
      },
    });

    if (!event) {
      return next(new AppError(404, 'Event not found'));
    }

    const totalSeats = event.eventSeats.length;
    const sold = event.eventSeats.filter((s) => s.status === SeatStatus.SOLD).length;
    const nowMs = Date.now();
    const isLiveHold = (es: { status: SeatStatus; holdExpiresAt: Date | null }) =>
      es.status === SeatStatus.HELD && !!es.holdExpiresAt && es.holdExpiresAt.getTime() >= nowMs;
    const held = event.eventSeats.filter(isLiveHold).length;
    const available = totalSeats - sold - held;
    const revenueCents = event.eventSeats
      .filter((s) => s.status === SeatStatus.SOLD)
      .reduce((sum, s) => sum + s.price, 0);
    const occupancyRate = totalSeats > 0 ? Math.round((sold / totalSeats) * 100) : 0;

    // Check-in counts
    const tickets = event.eventSeats
      .map((es) => es.ticket)
      .filter((t): t is NonNullable<typeof t> => t !== null && t !== undefined);
    const totalTickets = tickets.length;
    const checkedInCount = tickets.filter((t) => t.checkedInAt !== null).length;
    const checkInRate = totalTickets > 0 ? Math.round((checkedInCount / totalTickets) * 100) : 0;

    // Tier breakdown
    const tierMap = new Map<
      string,
      { total: number; sold: number; held: number; available: number; price: number; revenue: number }
    >();

    for (const es of event.eventSeats) {
      const tier = es.seat.tier;
      if (!tierMap.has(tier)) {
        tierMap.set(tier, { total: 0, sold: 0, held: 0, available: 0, price: es.price, revenue: 0 });
      }
      const item = tierMap.get(tier)!;
      item.total += 1;
      if (es.status === SeatStatus.SOLD) {
        item.sold += 1;
        item.revenue += es.price;
      } else if (isLiveHold(es)) {
        item.held += 1;
      } else {
        item.available += 1;
      }
    }

    const tiers = Array.from(tierMap.entries()).map(([tier, stats]) => ({
      tier,
      ...stats,
      occupancyRate: stats.total > 0 ? Math.round((stats.sold / stats.total) * 100) : 0,
    }));

    // Recent orders for this event
    const recentOrders = await prisma.order.findMany({
      where: { eventId, status: 'CONFIRMED' },
      include: {
        user: { select: { email: true } },
        tickets: {
          include: {
            eventSeat: {
              include: { seat: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.status(200).json({
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
        venueName: event.venue.name,
        venueType: (event.venue.layout as any)?.type || 'THEATER_DOLBY',
      },
      overview: {
        totalSeats,
        soldSeats: sold,
        heldSeats: held,
        availableSeats: available,
        occupancyRate,
        revenueCents,
      },
      checkIn: {
        totalTickets,
        checkedInCount,
        checkInRate,
      },
      tiers,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        userEmail: o.user.email,
        totalCents: o.totalCents,
        createdAt: o.createdAt,
        seats: o.tickets.map((t) => `${t.eventSeat.seat.row}${t.eventSeat.seat.number}`),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// List staff accounts
organizerRouter.get('/staff', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: Role.STAFF },
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ staff });
  } catch (err) {
    next(err);
  }
});

// Create a new staff account (strictly organizer only)
organizerRouter.post(
  '/staff',
  validateBody(CreateStaffSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Login looks accounts up by lowercased email, so store it that way or the account can never sign in
      const email = String(req.body.email).trim().toLowerCase();
      const { password } = req.body;

      const existing = await prisma.user.findUnique({
        where: { email },
      });

      if (existing) {
        return next(new AppError(409, 'User with this email already exists'));
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const newStaff = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: Role.STAFF,
        },
        select: { id: true, email: true, role: true, createdAt: true },
      });

      res.status(201).json({
        message: 'Staff account successfully created',
        staff: newStaff,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Delete/Revoke a staff account
organizerRouter.delete(
  '/staff/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);

      const staffUser = await prisma.user.findFirst({
        where: { id, role: Role.STAFF },
      });

      if (!staffUser) {
        return next(new AppError(404, 'Staff account not found'));
      }

      await prisma.user.delete({
        where: { id },
      });

      res.status(200).json({ message: 'Staff account removed successfully' });
    } catch (err) {
      next(err);
    }
  }
);
