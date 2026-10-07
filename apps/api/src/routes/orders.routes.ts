import { Router, Request, Response, NextFunction } from 'express';
import qrcode from 'qrcode';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { ConfirmOrderSchema } from '@repo/shared';
import { createAndConfirmBooking } from '../services/order.service';

export const ordersRouter = Router();

// Confirm booking & generate tickets
ordersRouter.post(
  '/confirm',
  requireAuth,
  validateBody(ConfirmOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId, seatIds, idempotencyKey } = req.body;
      const userId = req.user!.userId;

      const result = await createAndConfirmBooking({
        eventId,
        seatIds,
        userId,
        idempotencyKey,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Get current user's tickets
ordersRouter.get('/my-tickets', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const orders = await prisma.order.findMany({
      where: { userId, status: 'CONFIRMED' },
      include: {
        event: {
          include: { venue: true },
        },
        tickets: {
          include: {
            eventSeat: {
              include: { seat: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const ordersWithQRs = await Promise.all(
      orders.map(async (order) => {
        const ticketsWithQRs = await Promise.all(
          order.tickets.map(async (t) => {
            const qrDataUrl = await qrcode.toDataURL(t.qrToken, { width: 250, margin: 2 });
            return {
              id: t.id,
              qrToken: t.qrToken,
              checkedInAt: t.checkedInAt,
              seat: t.eventSeat.seat,
              price: t.eventSeat.price,
              qrDataUrl,
            };
          })
        );

        return {
          id: order.id,
          totalCents: order.totalCents,
          createdAt: order.createdAt,
          event: order.event,
          tickets: ticketsWithQRs,
        };
      })
    );

    res.status(200).json({ orders: ordersWithQRs });
  } catch (err) {
    next(err);
  }
});
