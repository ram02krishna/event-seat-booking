import nodemailer from 'nodemailer';
import { logger } from '../logger';

export interface SendTicketsEmailParams {
  toEmail: string;
  orderId: string;
  eventTitle: string;
  startsAt: Date;
  venueName: string;
  tickets: Array<{
    ticketId: string;
    seatLabel: string;
    tier: string;
    priceCents: number;
    qrDataUrl: string;
  }>;
}

// Configurable transporter; logs safely in local/dev if no SMTP host configured
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

export async function sendTicketConfirmationEmail(params: SendTicketsEmailParams) {
  const { toEmail, orderId, eventTitle, startsAt, venueName, tickets } = params;

  const formattedDate = new Date(startsAt).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const attachments = tickets.map((t, index) => {
    const base64Data = t.qrDataUrl.replace(/^data:image\/png;base64,/, '');
    return {
      filename: `ticket-${t.ticketId}.png`,
      content: Buffer.from(base64Data, 'base64'),
      cid: `qr_${index}`,
    };
  });

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #0b0f19; color: #f1f5f9; border-radius: 12px;">
      <h1 style="color: #818cf8; margin-bottom: 5px;">Booking Confirmed!</h1>
      <p style="color: #94a3b8; font-size: 14px; margin-top: 0;">Order #${orderId.slice(0, 8)}</p>

      <div style="background-color: #1e293b; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #ffffff;">${eventTitle}</h2>
        <p style="margin: 4px 0; font-size: 14px; color: #cbd5e1;">📍 <strong>Venue:</strong> ${venueName}</p>
        <p style="margin: 4px 0; font-size: 14px; color: #cbd5e1;">📅 <strong>Date:</strong> ${formattedDate}</p>
      </div>

      <h3 style="color: #e2e8f0; border-bottom: 1px solid #334155; padding-bottom: 8px;">Your Tickets</h3>
      ${tickets
        .map(
          (t, index) => `
        <div style="display: flex; align-items: center; justify-content: space-between; background-color: #131b2e; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
          <div>
            <div style="font-weight: bold; font-size: 16px; color: #ffffff;">${t.seatLabel}</div>
            <div style="color: #818cf8; font-size: 12px; text-transform: uppercase;">${t.tier} • $${(t.priceCents / 100).toFixed(2)}</div>
          </div>
          <img src="cid:qr_${index}" width="80" height="80" alt="Ticket QR" style="border-radius: 6px; background: white; padding: 4px;" />
        </div>
      `
        )
        .join('')}

      <p style="font-size: 12px; color: #64748b; margin-top: 30px; text-align: center;">
        Please present this email or your QR code at the venue gate for check-in.
      </p>
    </div>
  `;

  try {
    if (!process.env.SMTP_USER) {
      logger.info(`[Email Preview] Mock confirmation email sent to ${toEmail} for order ${orderId}`);
      return;
    }

    await transporter.sendMail({
      from: '"SeatLock" <tickets@seatlock.io>',
      to: toEmail,
      subject: `Your Tickets for ${eventTitle}`,
      html,
      attachments,
    });
    logger.info(`Ticket confirmation email sent to ${toEmail}`);
  } catch (err) {
    logger.error(err, `Failed to send ticket email to ${toEmail}`);
  }
}
