'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { SeatData } from '@/components/seat-map/SeatMap';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

interface SeatPayload {
  seatIds: string[];
  heldByUserId?: string;
  holdExpiresAt?: string;
}

export function useEventSocket(eventId: string) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!eventId) return;

    // Connect to Socket.IO server
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      // Join event room and refetch fresh seat data
      socket.emit('join:event', eventId);
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'seats'] });
    });

    // Refetch all seats on reconnect
    socket.io.on('reconnect', () => {
      socket.emit('join:event', eventId);
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'seats'] });
    });

    // Real-time seat updates
    socket.on('seats:held', (data: SeatPayload) => {
      queryClient.setQueryData(
        ['events', eventId, 'seats'],
        (old: { eventId: string; venue: any; seats: SeatData[] } | undefined) => {
          if (!old) return old;
          const heldSet = new Set(data.seatIds);
          return {
            ...old,
            seats: old.seats.map((seat) => {
              if (heldSet.has(seat.seatId) || heldSet.has(seat.id)) {
                return {
                  ...seat,
                  status: 'HELD' as const,
                  holdExpiresAt: data.holdExpiresAt || null,
                };
              }
              return seat;
            }),
          };
        }
      );
    });

    socket.on('seats:released', (data: SeatPayload) => {
      queryClient.setQueryData(
        ['events', eventId, 'seats'],
        (old: { eventId: string; venue: any; seats: SeatData[] } | undefined) => {
          if (!old) return old;
          const releasedSet = new Set(data.seatIds);
          return {
            ...old,
            seats: old.seats.map((seat) => {
              if (releasedSet.has(seat.seatId) || releasedSet.has(seat.id)) {
                return {
                  ...seat,
                  status: 'AVAILABLE' as const,
                  isHeldByMe: false,
                  holdExpiresAt: null,
                };
              }
              return seat;
            }),
          };
        }
      );
    });

    socket.on('seats:sold', (data: SeatPayload) => {
      queryClient.setQueryData(
        ['events', eventId, 'seats'],
        (old: { eventId: string; venue: any; seats: SeatData[] } | undefined) => {
          if (!old) return old;
          const soldSet = new Set(data.seatIds);
          return {
            ...old,
            seats: old.seats.map((seat) => {
              if (soldSet.has(seat.seatId) || soldSet.has(seat.id)) {
                return {
                  ...seat,
                  status: 'SOLD' as const,
                  isHeldByMe: false,
                  holdExpiresAt: null,
                };
              }
              return seat;
            }),
          };
        }
      );
    });

    return () => {
      socket.emit('leave:event', eventId);
      socket.disconnect();
    };
  }, [eventId, queryClient]);

  return socketRef.current;
}
