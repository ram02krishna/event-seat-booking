import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient, Role, EventStatus, SeatStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getVenueTemplate } from '../src/services/venueTemplates.service';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with multi-architecture seatmaps...');

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

  // Helper to create a venue with template seats and an event
  async function createVenueWithEvent(
    type: 'THEATER_DOLBY' | 'CONFERENCE_HALL' | 'AUDITORIUM' | 'ARENA',
    eventTitle: string,
    eventDesc: string,
    daysAhead: number,
    hours: number,
    minutes: number
  ) {
    const template = getVenueTemplate(type);

    const venue = await prisma.venue.create({
      data: {
        name: template.defaultName,
        layout: template.layout as any,
      },
    });

    const seatDefs = template.generateSeats(venue.id);
    await prisma.seat.createMany({ data: seatDefs, skipDuplicates: true });
    const createdSeats = await prisma.seat.findMany({ where: { venueId: venue.id } });

    const startsAt = new Date();
    startsAt.setDate(startsAt.getDate() + daysAhead);
    startsAt.setHours(hours, minutes, 0, 0);

    const event = await prisma.event.create({
      data: {
        venueId: venue.id,
        title: eventTitle,
        description: eventDesc,
        startsAt,
        status: EventStatus.PUBLISHED,
      },
    });

    const eventSeatsData = createdSeats.map((seat) => ({
      eventId: event.id,
      seatId: seat.id,
      price: template.recommendedPricing[seat.tier as 'VIP' | 'PREMIUM' | 'STANDARD'] || 50000,
      status: SeatStatus.AVAILABLE,
    }));

    await prisma.eventSeat.createMany({ data: eventSeatsData });
    console.log(`Created [${type}] venue "${venue.name}" with event "${event.title}" (${createdSeats.length} seats)`);
  }

  // 1. Dolby Atmos Theater
  await createVenueWithEvent(
    'THEATER_DOLBY',
    'Neon Horizon: Dolby Atmos 4K Laser Screening',
    'Experience cinematic excellence with 64-channel spatial sound, laser projection, and ultra-plush recliner stalls.',
    7,
    19,
    45
  );

  // 2. Corporate Conference Hall
  await createVenueWithEvent(
    'CONFERENCE_HALL',
    'Global AI & Distributed Systems Summit 2026',
    'Keynote presentations from world-leading architects on high-concurrency systems, live telemetry, and AI models.',
    14,
    9,
    30
  );

  // 3. Grand Auditorium
  await createVenueWithEvent(
    'AUDITORIUM',
    'Royal Philharmonic: Symphony of Lights & Sound',
    'A masterclass orchestral performance in our acoustically engineered auditorium featuring a sunken orchestra pit and royal tiers.',
    21,
    18,
    30
  );

  // 4. Live Concert Arena
  await createVenueWithEvent(
    'ARENA',
    'Supernova: Live Stadium Tour & Laser Rave',
    'Electrifying arena festival featuring an extended catwalk runway, Golden Circle front pit, and multi-color laser rigs.',
    28,
    20,
    0
  );

  console.log('Seeding complete! 4 venue architectures successfully populated.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
