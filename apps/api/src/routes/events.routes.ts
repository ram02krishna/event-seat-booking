import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { AppError } from '../errors';
import { HoldSeatsSchema, ReleaseSeatsSchema } from '@repo/shared';
import { holdSeats, releaseSeats } from '../services/hold.service';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { broadcastSeatsHeld, broadcastSeatsReleased } from '../socket';

export const eventsRouter = Router();

// Public: List all published events
eventsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const events = await prisma.event.findMany({
      where: { status: 'PUBLISHED' },
      include: {
        venue: {
          select: { id: true, name: true },
        },
        eventSeats: {
          select: { status: true, holdExpiresAt: true, price: true },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    const now = new Date();
    const eventsWithStats = events.map((event) => {
      const totalSeats = event.eventSeats.length;
      const availableCount = event.eventSeats.filter(
        (es) =>
          es.status === 'AVAILABLE' ||
          (es.status === 'HELD' && es.holdExpiresAt && new Date(es.holdExpiresAt) < now)
      ).length;

      const prices = event.eventSeats.map((es) => es.price);
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

      return {
        id: event.id,
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
        status: event.status,
        venue: event.venue,
        totalSeats,
        availableSeats: availableCount,
        minPrice,
      };
    });

    res.status(200).json({ events: eventsWithStats });
  } catch (err) {
    next(err);
  }
});

// Authenticated or guest check: Get current user's active seat hold if any
eventsRouter.get('/active-hold', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(200).json({ hold: null });
    }

    const now = new Date();
    const heldSeats = await prisma.eventSeat.findMany({
      where: {
        heldByUserId: userId,
        status: 'HELD',
        holdExpiresAt: { gt: now },
      },
      include: {
        seat: true,
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            venue: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [
        { seat: { section: 'asc' } },
        { seat: { row: 'asc' } },
        { seat: { number: 'asc' } },
      ],
    });

    if (heldSeats.length === 0) {
      return res.status(200).json({ hold: null });
    }

    const event = heldSeats[0]!.event;
    const earliestExpiry = heldSeats.reduce((earliest, s) => {
      if (!s.holdExpiresAt) return earliest;
      return earliest
        ? new Date(s.holdExpiresAt) < new Date(earliest)
          ? s.holdExpiresAt
          : earliest
        : s.holdExpiresAt;
    }, heldSeats[0]!.holdExpiresAt);

    return res.status(200).json({
      hold: {
        eventId: event.id,
        eventTitle: event.title,
        venueName: event.venue?.name,
        startsAt: event.startsAt,
        holdExpiresAt: earliestExpiry?.toISOString() || null,
        seats: heldSeats.map((es) => ({
          id: es.id,
          seatId: es.seat.id,
          section: es.seat.section,
          row: es.seat.row,
          number: es.seat.number,
          tier: es.seat.tier,
          price: es.price,
        })),
        totalPrice: heldSeats.reduce((sum, s) => sum + s.price, 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Public: Get single event details with venue layout
eventsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.id as string;
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        venue: true,
      },
    });

    if (!event) {
      return next(new AppError(404, 'Event not found'));
    }

    res.status(200).json({ event });
  } catch (err) {
    next(err);
  }
});

// Public: Get event seats with computed real-time availability
eventsRouter.get('/:id/seats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.id as string;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { venue: true },
    });

    if (!event) {
      return next(new AppError(404, 'Event not found'));
    }

    const eventSeats = await prisma.eventSeat.findMany({
      where: { eventId },
      include: {
        seat: true,
      },
      orderBy: [
        { seat: { section: 'asc' } },
        { seat: { row: 'asc' } },
        { seat: { number: 'asc' } },
      ],
    });

    const now = new Date();
    const currentUserId = req.user?.userId;

    const seats = eventSeats.map((es) => {
      let effectiveStatus = es.status;

      // Expired holds are treated as available
      if (es.status === 'HELD' && es.holdExpiresAt && new Date(es.holdExpiresAt) < now) {
        effectiveStatus = 'AVAILABLE';
      }

      const isHeldByMe =
        effectiveStatus === 'HELD' && !!currentUserId && es.heldByUserId === currentUserId;

      return {
        id: es.id,
        seatId: es.seat.id,
        section: es.seat.section,
        row: es.seat.row,
        number: es.seat.number,
        x: es.seat.x,
        y: es.seat.y,
        tier: es.seat.tier,
        price: es.price,
        status: effectiveStatus,
        isHeldByMe,
        holdExpiresAt: effectiveStatus === 'HELD' ? es.holdExpiresAt : null,
      };
    });

    res.status(200).json({
      eventId,
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
      },
      venue: event.venue,
      seats,
    });
  } catch (err) {
    next(err);
  }
});

// Hold seats (Atomic, concurrency-safe, all-or-nothing)
eventsRouter.post(
  '/:id/hold',
  requireAuth,
  validateBody(HoldSeatsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = req.params.id as string;
      const { seatIds, idempotencyKey } = req.body;
      const userId = req.user!.userId;

      const result = await holdSeats({
        eventId,
        seatIds,
        userId,
        idempotencyKey,
      });

      // Broadcast real-time seat hold to all clients in the room
      broadcastSeatsHeld(eventId, {
        seatIds: result.heldSeats.map((s) => s.seatId),
        heldByUserId: userId,
        holdExpiresAt: result.holdExpiresAt.toISOString(),
      });

      if (result.releasedSeatIds && result.releasedSeatIds.length > 0) {
        broadcastSeatsReleased(eventId, {
          seatIds: result.releasedSeatIds,
        });
      }

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Release held seats
eventsRouter.post(
  '/:id/release',
  requireAuth,
  validateBody(ReleaseSeatsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = req.params.id as string;
      const { seatIds } = req.body;
      const userId = req.user!.userId;

      const result = await releaseSeats({
        eventId,
        seatIds,
        userId,
      });

      // Broadcast real-time seat release
      broadcastSeatsReleased(eventId, {
        seatIds,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);


