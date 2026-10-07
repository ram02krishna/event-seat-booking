import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { validateBody } from '../middleware/validate';
import {
  RegisterSchema,
  LoginSchema,
  SendOtpRegisterSchema,
  VerifyOtpRegisterSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '@repo/shared';
import { AppError } from '../errors';
import { signToken, requireAuth } from '../middleware/auth';
import { config } from '../config';
import { Role } from '@prisma/client';
import { redisConnection } from '../redis';
import { sendOtpEmail } from '../services/email.service';

export const authRouter = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 1. Send OTP for Registration
authRouter.post(
  '/register/send-otp',
  validateBody(SendOtpRegisterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = req.body.email.trim().toLowerCase();
      const { password } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return next(new AppError(409, 'Email already registered. Please sign in instead.'));
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const otp = generateOtp();

      // Store in Redis with 10 minute expiry (600s)
      await redisConnection.setex(
        `reg_otp:${email}`,
        600,
        JSON.stringify({ otp, passwordHash })
      );

      await sendOtpEmail({
        toEmail: email,
        otp,
        purpose: 'signup',
      });

      return res.status(200).json({
        message: 'Verification code sent to your email',
        email,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 2. Verify OTP & Complete Registration
authRouter.post(
  '/register/verify-otp',
  validateBody(VerifyOtpRegisterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = req.body.email.trim().toLowerCase();
      const { otp } = req.body;

      const cachedData = await redisConnection.get(`reg_otp:${email}`);
      if (!cachedData) {
        return next(
          new AppError(400, 'Verification code expired or not found. Please request a new code.')
        );
      }

      const { otp: storedOtp, passwordHash } = JSON.parse(cachedData);
      if (storedOtp !== otp) {
        return next(new AppError(400, 'Invalid verification code. Please check and try again.'));
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        await redisConnection.del(`reg_otp:${email}`);
        return next(new AppError(409, 'Email already registered. Please sign in.'));
      }

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: Role.CUSTOMER,
        },
      });

      await redisConnection.del(`reg_otp:${email}`);

      const token = signToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      res.cookie('token', token, COOKIE_OPTIONS);
      return res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        message: 'Account verified and created successfully',
      });
    } catch (err) {
      next(err);
    }
  }
);

// 3. Forgot Password - Send OTP
authRouter.post(
  '/forgot-password',
  validateBody(ForgotPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = req.body.email.trim().toLowerCase();

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return next(new AppError(404, 'No account found with this email address.'));
      }

      const otp = generateOtp();
      await redisConnection.setex(
        `pwd_reset:${email}`,
        600,
        JSON.stringify({ otp, userId: user.id })
      );

      await sendOtpEmail({
        toEmail: email,
        otp,
        purpose: 'reset',
      });

      return res.status(200).json({
        message: 'Password reset code sent to your email',
        email,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 4. Reset Password with OTP
authRouter.post(
  '/reset-password',
  validateBody(ResetPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = req.body.email.trim().toLowerCase();
      const { otp, newPassword } = req.body;

      const cached = await redisConnection.get(`pwd_reset:${email}`);
      if (!cached) {
        return next(
          new AppError(400, 'Reset code expired or not found. Please request a new code.')
        );
      }

      const { otp: storedOtp } = JSON.parse(cached);
      if (storedOtp !== otp) {
        return next(new AppError(400, 'Invalid verification code. Please check and try again.'));
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      const updatedUser = await prisma.user.update({
        where: { email },
        data: { passwordHash },
      });

      await redisConnection.del(`pwd_reset:${email}`);

      const token = signToken({
        userId: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
      });

      res.cookie('token', token, COOKIE_OPTIONS);
      return res.status(200).json({
        message: 'Password successfully reset. You are now signed in.',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// Direct Register (Fallback & programmatic compatibility)
authRouter.post(
  '/register',
  validateBody(RegisterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = req.body.email.trim().toLowerCase();
      const { password } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return next(new AppError(409, 'Email already registered'));
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: Role.CUSTOMER,
        },
      });

      const token = signToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      res.cookie('token', token, COOKIE_OPTIONS);
      return res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// Login
authRouter.post(
  '/login',
  validateBody(LoginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return next(new AppError(401, 'Invalid email or password'));
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return next(new AppError(401, 'Invalid email or password'));
      }

      const token = signToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      res.cookie('token', token, COOKIE_OPTIONS);
      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// Logout
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  return res.status(200).json({ message: 'Logged out successfully' });
});

// Current user profile
authRouter.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
      return next(new AppError(404, 'User not found'));
    }

    return res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
});
