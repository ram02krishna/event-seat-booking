import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { AppError } from '../errors';

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
        _count: {
          select: { eventSeats: true },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    const eventsWithStats = await Promise.all(
      events.map(async (event) => {
        const now = new Date();
        const availableCount = await prisma.eventSeat.count({
          where: {
            eventId: event.id,
            OR: [
              { status: 'AVAILABLE' },
              { status: 'HELD', holdExpiresAt: { lt: now } },
            ],
          },
        });

        return {
          id: event.id,
          title: event.title,
          description: event.description,
          startsAt: event.startsAt,
          status: event.status,
          venue: event.venue,
          totalSeats: event._count.eventSeats,
          availableSeats: availableCount,
        };
      })
    );

    res.status(200).json({ events: eventsWithStats });
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
      venue: event.venue,
      seats,
    });
  } catch (err) {
    next(err);
  }
});
