import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { validateBody } from '../middleware/validate';
import { RegisterSchema, LoginSchema } from '@repo/shared';
import { AppError } from '../errors';
import { signToken, requireAuth } from '../middleware/auth';
import { config } from '../config';

export const authRouter = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Register
authRouter.post(
  '/register',
  validateBody(RegisterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, role } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return next(new AppError(409, 'Email already registered'));
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role,
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
