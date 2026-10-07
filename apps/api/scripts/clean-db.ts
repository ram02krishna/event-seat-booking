import { PrismaClient, SeatStatus } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning database data...');

  // 1. Delete all Tickets
  const deletedTickets = await prisma.ticket.deleteMany();
  console.log(`Deleted ${deletedTickets.count} tickets`);

  // 2. Delete all Orders
  const deletedOrders = await prisma.order.deleteMany();
  console.log(`Deleted ${deletedOrders.count} orders`);

  // 3. Delete all Users (accounts)
  const deletedUsers = await prisma.user.deleteMany();
  console.log(`Deleted ${deletedUsers.count} users/accounts`);

  // 4. Reset all EventSeats back to AVAILABLE (clear all holds and selections)
  const updatedSeats = await prisma.eventSeat.updateMany({
    data: {
      status: SeatStatus.AVAILABLE,
      heldByUserId: null,
      holdExpiresAt: null,
      version: 0,
    },
  });
  console.log(`Reset ${updatedSeats.count} event seats back to AVAILABLE (0 held, 0 sold)`);

  // 5. Clear Redis locks and queues
  try {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    await redis.flushall();
    console.log('Flushed Redis cache and queues');
    await redis.quit();
  } catch (err: any) {
    console.warn('Redis flush warning:', err.message);
  }

  // 6. Summary check
  const [users, orders, tickets, heldSeats, soldSeats, availSeats] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.ticket.count(),
    prisma.eventSeat.count({ where: { status: SeatStatus.HELD } }),
    prisma.eventSeat.count({ where: { status: SeatStatus.SOLD } }),
    prisma.eventSeat.count({ where: { status: SeatStatus.AVAILABLE } }),
  ]);

  console.log('Database Status:');
  console.log({
    users,
    orders,
    tickets,
    heldSeats,
    soldSeats,
    availableSeats: availSeats,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
