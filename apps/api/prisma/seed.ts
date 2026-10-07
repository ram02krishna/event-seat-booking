import { PrismaClient, Role, EventStatus, SeatStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Clean existing records
  await prisma.ticket.deleteMany();
  await prisma.order.deleteMany();
  await prisma.eventSeat.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.event.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create users
  const passwordHash = await bcrypt.hash('password123', 10);

  const organizer = await prisma.user.create({
    data: {
      email: 'organizer@eventseat.com',
      passwordHash,
      role: Role.ORGANIZER,
    },
  });

  const staff = await prisma.user.create({
    data: {
      email: 'staff@eventseat.com',
      passwordHash,
      role: Role.STAFF,
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: 'customer@eventseat.com',
      passwordHash,
      role: Role.CUSTOMER,
    },
  });

  console.log('Created users: organizer, staff, customer');

  // 3. Create venue with SVG layout config
  const venue = await prisma.venue.create({
    data: {
      name: 'Grand Symphony Hall',
      layout: {
        width: 1000,
        height: 700,
        stage: {
          x: 250,
          y: 30,
          width: 500,
          height: 50,
          label: 'MAIN STAGE',
        },
        sections: [
          { id: 'VIP', name: 'VIP Front Row', tier: 'VIP', color: '#8b5cf6', defaultPriceCents: 8000 },
          { id: 'PREMIUM', name: 'Premium Middle', tier: 'PREMIUM', color: '#3b82f6', defaultPriceCents: 5000 },
          { id: 'STANDARD', name: 'Standard General', tier: 'STANDARD', color: '#10b981', defaultPriceCents: 3000 },
        ],
      },
    },
  });

  console.log(`Created venue: ${venue.name}`);

  // 4. Generate seats for venue
  // Total: 20 VIP + 36 Premium + 56 Standard = 112 seats
  const seatDefinitions: Array<{
    section: string;
    row: string;
    number: number;
    x: number;
    y: number;
    tier: string;
    priceCents: number;
  }> = [];

  // VIP: rows A, B (10 seats each)
  const vipRows = ['A', 'B'];
  vipRows.forEach((row, rowIndex) => {
    const y = 130 + rowIndex * 50;
    for (let num = 1; num <= 10; num++) {
      const x = 275 + (num - 1) * 50;
      seatDefinitions.push({
        section: 'VIP',
        row,
        number: num,
        x,
        y,
        tier: 'VIP',
        priceCents: 250000,
      });
    }
  });

  // Premium: rows C, D, E (12 seats each)
  const premiumRows = ['C', 'D', 'E'];
  premiumRows.forEach((row, rowIndex) => {
    const y = 260 + rowIndex * 50;
    for (let num = 1; num <= 12; num++) {
      const x = 225 + (num - 1) * 50;
      seatDefinitions.push({
        section: 'PREMIUM',
        row,
        number: num,
        x,
        y,
        tier: 'PREMIUM',
        priceCents: 150000,
      });
    }
  });

  // Standard: rows F, G, H, I (14 seats each)
  const standardRows = ['F', 'G', 'H', 'I'];
  standardRows.forEach((row, rowIndex) => {
    const y = 440 + rowIndex * 50;
    for (let num = 1; num <= 14; num++) {
      const x = 175 + (num - 1) * 50;
      seatDefinitions.push({
        section: 'STANDARD',
        row,
        number: num,
        x,
        y,
        tier: 'STANDARD',
        priceCents: 75000,
      });
    }
  });

  // Insert all seats
  const createdSeats = [];
  for (const def of seatDefinitions) {
    const seat = await prisma.seat.create({
      data: {
        venueId: venue.id,
        section: def.section,
        row: def.row,
        number: def.number,
        x: def.x,
        y: def.y,
        tier: def.tier,
      },
    });
    createdSeats.push({ ...seat, priceCents: def.priceCents });
  }

  console.log(`Created ${createdSeats.length} seats for venue`);

  // 5. Create 2 Events and link seats
  // Event 1: Tech Innovation Summit (14 days ahead at 09:30 AM)
  const event1Date = new Date();
  event1Date.setDate(event1Date.getDate() + 14);
  event1Date.setHours(9, 30, 0, 0);

  // Event 2: Indie Rock Music Night (28 days ahead at 07:30 PM)
  const event2Date = new Date();
  event2Date.setDate(event2Date.getDate() + 28);
  event2Date.setHours(19, 30, 0, 0);

  const event1 = await prisma.event.create({
    data: {
      venueId: venue.id,
      title: 'Tech Innovation Summit 2026',
      description: 'The premier conference on distributed systems, AI architectures, and high-concurrency design.',
      startsAt: event1Date,
      status: EventStatus.PUBLISHED,
    },
  });

  const event2 = await prisma.event.create({
    data: {
      venueId: venue.id,
      title: 'Indie Rock Music Night',
      description: 'An electrifying live performance featuring breakthrough indie rock bands.',
      startsAt: event2Date,
      status: EventStatus.PUBLISHED,
    },
  });

  // Populate EventSeats for both events
  const event1SeatsData = createdSeats.map((seat) => ({
    eventId: event1.id,
    seatId: seat.id,
    price: seat.priceCents,
    status: SeatStatus.AVAILABLE,
  }));

  const event2SeatsData = createdSeats.map((seat) => ({
    eventId: event2.id,
    seatId: seat.id,
    price: seat.priceCents,
    status: SeatStatus.AVAILABLE,
  }));

  await prisma.eventSeat.createMany({ data: event1SeatsData });
  await prisma.eventSeat.createMany({ data: event2SeatsData });

  console.log(`Linked ${event1SeatsData.length} seats to "${event1.title}"`);
  console.log(`Linked ${event2SeatsData.length} seats to "${event2.title}"`);
  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
