import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { app } from '../src/app';
import { initSocket } from '../src/socket';
import { prisma } from '../src/db';
import { signToken } from '../src/middleware/auth';
import { Role } from '@prisma/client';

describe('Real-Time Socket.IO Updates', () => {
  let server: http.Server;
  let port: number;
  let clientSocket: ClientSocket;
  let eventId: string;
  let testSeatId: string;
  let token: string;

  beforeAll(async () => {
    // Start HTTP server on dynamic port
    server = http.createServer(app);
    initSocket(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address() as any;
        port = address.port;
        resolve();
      });
    });

    // Find test event and seat
    const event = await prisma.event.findFirst({
      where: { status: 'PUBLISHED' },
      include: { eventSeats: { take: 1 } },
    });
    if (!event || event.eventSeats.length === 0) {
      throw new Error('Test event not found');
    }
    eventId = event.id;
    testSeatId = event.eventSeats[0].seatId;

    // Reset seat to AVAILABLE
    await prisma.eventSeat.updateMany({
      where: { eventId, seatId: testSeatId },
      data: { status: 'AVAILABLE', heldByUserId: null, holdExpiresAt: null },
    });

    // Create test user and token
    const user = await prisma.user.upsert({
      where: { email: 'socket_tester@test.com' },
      update: {},
      create: { email: 'socket_tester@test.com', passwordHash: 'hash', role: Role.CUSTOMER },
    });
    token = signToken({ userId: user.id, email: user.email, role: user.role });

    // Connect socket client
    clientSocket = Client(`http://localhost:${port}`);
    await new Promise<void>((resolve) => {
      clientSocket.on('connect', () => {
        clientSocket.emit('join:event', eventId);
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('receives seats:held event when seats are held', async () => {
    const receivedPromise = new Promise<any>((resolve) => {
      clientSocket.once('seats:held', (data) => {
        resolve(data);
      });
    });

    // Perform seat hold HTTP request
    const res = await request(server)
      .post(`/api/events/${eventId}/hold`)
      .set('Cookie', [`token=${token}`])
      .send({ seatIds: [testSeatId] });

    expect(res.status).toBe(200);

    const receivedData = await receivedPromise;
    expect(receivedData.seatIds).toContain(testSeatId);
    expect(receivedData.heldByUserId).toBeDefined();
  });

  it('receives seats:released event when seats are released', async () => {
    const receivedPromise = new Promise<any>((resolve) => {
      clientSocket.once('seats:released', (data) => {
        resolve(data);
      });
    });

    // Perform seat release HTTP request
    const res = await request(server)
      .post(`/api/events/${eventId}/release`)
      .set('Cookie', [`token=${token}`])
      .send({ seatIds: [testSeatId] });

    expect(res.status).toBe(200);

    const receivedData = await receivedPromise;
    expect(receivedData.seatIds).toContain(testSeatId);
  });
});
