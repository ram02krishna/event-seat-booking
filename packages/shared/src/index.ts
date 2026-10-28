import { z } from 'zod';

export const UserRoleSchema = z.enum(['CUSTOMER', 'ORGANIZER', 'STAFF']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const SeatStatusSchema = z.enum(['AVAILABLE', 'HELD', 'SOLD']);
export type SeatStatus = z.infer<typeof SeatStatusSchema>;

export const OrderStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export interface HealthResponse {
  status: 'ok' | 'error' | 'degraded';
  uptime: number;
  timestamp: string;
  db?: string;
  redis?: string;
}

// Auth schemas
export const CreateStaffSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
export type CreateStaffInput = z.infer<typeof CreateStaffSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const SendOtpRegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
export type SendOtpRegisterInput = z.infer<typeof SendOtpRegisterSchema>;

export const VerifyOtpRegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'Verification code must be 6 digits'),
});
export type VerifyOtpRegisterInput = z.infer<typeof VerifyOtpRegisterSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'Verification code must be 6 digits'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export const VenueTypeEnum = z.enum([
  'THEATER_DOLBY',
  'CONFERENCE_HALL',
  'AUDITORIUM',
  'ARENA',
  'OTHERS',
]);
export type VenueType = z.infer<typeof VenueTypeEnum>;

// Organizer / Venue / Event schemas
export const CreateVenueSchema = z.object({
  name: z.string().min(2, 'Venue name is required'),
  layout: z.record(z.any()).optional(),
  venueType: VenueTypeEnum.optional(),
});
export type CreateVenueInput = z.infer<typeof CreateVenueSchema>;

export const GenerateSeatsSchema = z.object({
  sections: z.array(
    z.object({
      name: z.string(),
      tier: z.string(),
      rows: z.array(z.string()).min(1).max(100),
      seatsPerRow: z.number().int().positive().max(200),
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
  venueId: z.string().optional(),
  venueName: z.string().optional(),
  venueType: VenueTypeEnum.optional().default('THEATER_DOLBY'),
  title: z.string().min(2, 'Event title is required'),
  description: z.string().optional(),
  startsAt: z.string().datetime('Must be a valid ISO datetime string'),
  pricing: z.record(z.number().int().positive()).optional(), // tier -> priceCents override
});
export type CreateEventInput = z.infer<typeof CreateEventSchema>;

// Seat hold schemas
export const HoldSeatsSchema = z.object({
  seatIds: z.array(z.string().uuid('Invalid seat ID')).min(1, 'Select at least one seat').max(6, 'Maximum 6 seats per hold'),
});
export type HoldSeatsInput = z.infer<typeof HoldSeatsSchema>;

export const ReleaseSeatsSchema = z.object({
  seatIds: z.array(z.string().uuid('Invalid seat ID')).min(1, 'Select at least one seat').max(6, 'Maximum 6 seats per release'),
});
export type ReleaseSeatsInput = z.infer<typeof ReleaseSeatsSchema>;

// Order confirmation schema
export const ConfirmOrderSchema = z.object({
  eventId: z.string().uuid('Invalid event ID'),
  seatIds: z.array(z.string().uuid('Invalid seat ID')).min(1, 'Select at least one seat').max(6),
  idempotencyKey: z.string().uuid('Invalid idempotency key').optional(),
});
export type ConfirmOrderInput = z.infer<typeof ConfirmOrderSchema>;

// Check-in schema
export const CheckInSchema = z.object({
  qrToken: z.string().min(1, 'Token or Ticket ID is required'),
});
export type CheckInInput = z.infer<typeof CheckInSchema>;
