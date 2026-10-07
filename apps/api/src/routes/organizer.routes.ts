import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { validateBody } from '../middleware/validate';
import { CreateVenueSchema, CreateEventSchema, GenerateSeatsSchema } from '@repo/shared';
import { requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../errors';
import { Role, SeatStatus } from '@prisma/client';

export const organizerRouter = Router();

// Require organizer role for all routes in this router
organizerRouter.use(requireAuth, requireRole([Role.ORGANIZER]));

// Create venue
organizerRouter.post(
  '/venues',
  validateBody(CreateVenueSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, layout } = req.body;
      const venue = await prisma.venue.create({
        data: { name, layout },
      });
      res.status(201).json({ venue });
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
      const { venueId, title, description, startsAt, pricing } = req.body;

      const venue = await prisma.venue.findUnique({
        where: { id: venueId },
        include: { seats: true },
      });

      if (!venue) {
        return next(new AppError(404, 'Venue not found'));
      }

      if (venue.seats.length === 0) {
        return next(
          new AppError(400, 'Venue has no seats. Generate seats first before creating an event.')
        );
      }

      const event = await prisma.event.create({
        data: {
          venueId,
          title,
          description,
          startsAt: new Date(startsAt),
        },
      });

      // Populate EventSeat records for all venue seats
      const defaultTierPricing: Record<string, number> = {
        VIP: 8000,
        PREMIUM: 5000,
        STANDARD: 3000,
        ...pricing,
      };

      const eventSeatsData = venue.seats.map((seat) => ({
        eventId: event.id,
        seatId: seat.id,
        price: defaultTierPricing[seat.tier] || 3000,
        status: SeatStatus.AVAILABLE,
      }));

      await prisma.eventSeat.createMany({
        data: eventSeatsData,
      });

      res.status(201).json({
        event,
        seatsCount: eventSeatsData.length,
      });
    } catch (err) {
      next(err);
    }
  }
);
