import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { config } from '../config';
import { logger } from '../logger';
import { Role } from '@prisma/client';

export async function ensureDefaultOrganizer() {
  try {
    const existingOrganizer = await prisma.user.findFirst({
      where: { role: Role.ORGANIZER },
    });

    if (existingOrganizer) {
      logger.info(`Organizer account verified: ${existingOrganizer.email}`);
      return;
    }

    // Check if the default email exists
    const email = config.ORGANIZER_EMAIL;
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: Role.ORGANIZER },
      });
      logger.info(`Promoted existing user ${email} to Organizer`);
      return;
    }

    // Create the sole default organizer account
    const passwordHash = await bcrypt.hash(config.ORGANIZER_PASSWORD, 10);
    const organizer = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: Role.ORGANIZER,
      },
    });

    logger.info(`Created default single Organizer account: ${organizer.email}`);
  } catch (err: any) {
    logger.error(err, 'Failed to ensure default organizer account');
  }
}
