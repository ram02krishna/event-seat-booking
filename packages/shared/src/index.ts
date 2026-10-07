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

// Auth schemas
export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: UserRoleSchema.default('CUSTOMER'),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

// Organizer / Venue / Event schemas
export const CreateVenueSchema = z.object({
  name: z.string().min(2, 'Venue name is required'),
  layout: z.record(z.any()),
});
export type CreateVenueInput = z.infer<typeof CreateVenueSchema>;

export const GenerateSeatsSchema = z.object({
  sections: z.array(
    z.object({
      name: z.string(),
      tier: z.string(),
      rows: z.array(z.string()),
      seatsPerRow: z.number().int().positive(),
      startY: z.number(),
      rowSpacing: z.number().default(50),
      startX: z.number(),
      seatSpacing: z.number().default(50),
      defaultPriceCents: z.number().int().positive(),
    })
  ),
});
export type GenerateSeatsInput = z.infer<typeof GenerateSeatsSchema>;

export const CreateEventSchema = z.object({
  venueId: z.string().uuid('Invalid venue ID'),
  title: z.string().min(2, 'Event title is required'),
  description: z.string().optional(),
  startsAt: z.string().datetime('Must be a valid ISO datetime string'),
  pricing: z.record(z.number().int().positive()).optional(), // tier -> priceCents override
});
export type CreateEventInput = z.infer<typeof CreateEventSchema>;
