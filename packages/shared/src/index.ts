import { z } from 'zod';

export const UserRoleSchema = z.enum(['CUSTOMER', 'ORGANIZER', 'STAFF']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const SeatStatusSchema = z.enum(['AVAILABLE', 'HELD', 'SOLD']);
export type SeatStatus = z.infer<typeof SeatStatusSchema>;

export const OrderStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export interface HealthResponse {
  status: 'ok';
  uptime: number;
  timestamp: string;
}
