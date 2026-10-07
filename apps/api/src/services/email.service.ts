import { Resend } from 'resend';
import { logger } from '../logger';
import { config } from '../config';

export interface SendTicketsEmailParams {
  toEmail: string;
  orderId: string;
  eventTitle: string;
  startsAt: Date;
  venueName: string;
  tickets: Array<{
    ticketId: string;
    qrToken?: string;
    seatLabel: string;
    tier: string;
    priceCents: number;
    qrDataUrl: string;
  }>;
}

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

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

  const tierColors: Record<string, { bg: string; text: string; border: string }> = {
    VIP: { bg: '#451a03', text: '#fbbf24', border: '#f59e0b' },
    PREMIUM: { bg: '#1e1b4b', text: '#a5b4fc', border: '#6366f1' },
    STANDARD: { bg: '#083344', text: '#67e8f9', border: '#06b6d4' },
  };

  const ticketsHtml = tickets
    .map((t) => {
      const token = t.qrToken || t.ticketId;
      // Gmail blocks data:image base64 URIs. Use HTTPS QR generator URL for 100% email client compatibility
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=2&data=${encodeURIComponent(token)}`;
      const tierStyle = tierColors[t.tier] || tierColors.STANDARD;

      return `
        <div style="background-color: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 14px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="top" style="padding-right: 14px;">
                <div style="margin-bottom: 6px;">
                  <span style="background-color: ${tierStyle.bg}; color: ${tierStyle.text}; border: 1px solid ${tierStyle.border}; font-size: 10px; font-weight: bold; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.5px;">
                    ${t.tier}
                  </span>
                </div>
                <div style="font-size: 16px; font-weight: bold; color: #ffffff; margin-bottom: 4px;">
                  ${t.seatLabel}
                </div>
                <div style="font-size: 14px; font-weight: bold; color: #10b981; margin-bottom: 10px;">
                  ₹${(t.priceCents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style="background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 6px; padding: 6px 8px; font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #94a3b8; word-break: break-all;">
                  <span style="color: #64748b; font-size: 10px; text-transform: uppercase; display: block; margin-bottom: 2px;">UUID Token:</span>
                  <span style="color: #818cf8; font-weight: bold;">${token}</span>
                </div>
              </td>
              <td width="116" valign="top" align="center" style="width: 116px; min-width: 116px;">
                <div style="background-color: #ffffff; padding: 6px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3); display: inline-block;">
                  <img
                    src="${qrUrl}"
                    width="104"
                    height="104"
                    alt="Ticket QR Code"
                    style="display: block; width: 104px; height: 104px; border: 0;"
                  />
                </div>
                <div style="font-size: 10px; color: #64748b; margin-top: 4px; text-align: center;">
                  Gate Scan Pass
                </div>
              </td>
            </tr>
          </table>
        </div>
      `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="margin: 0; padding: 20px 10px; background-color: #050811; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
          
          <!-- Header Bar -->
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); padding: 24px 20px; text-align: center;">
            <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #c7d2fe; margin-bottom: 4px;">
              SeatLock &bull; Official Ticket Pass
            </div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff;">
              Booking Confirmed!
            </h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #e0e7ff;">
              Order #${orderId.slice(0, 8)} &bull; Confirmed &amp; Issued
            </p>
          </div>

          <div style="padding: 24px 20px;">
            <!-- Event Summary Box -->
            <div style="background-color: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 22px;">
              <h2 style="margin: 0 0 10px 0; font-size: 19px; color: #ffffff; font-weight: bold;">
                ${eventTitle}
              </h2>
              <div style="font-size: 13px; color: #cbd5e1; margin-bottom: 6px;">
                📍 <strong>Venue:</strong> ${venueName}
              </div>
              <div style="font-size: 13px; color: #cbd5e1;">
                📅 <strong>Date:</strong> ${formattedDate}
              </div>
            </div>

            <!-- Tickets Section -->
            <div style="margin-bottom: 24px;">
              <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: bold; color: #e2e8f0; text-transform: uppercase; letter-spacing: 0.5px;">
                Your Tickets (${tickets.length})
              </h3>
              ${ticketsHtml}
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 26px 0 10px 0;">
              <a
                href="${config.CLIENT_URL}/my-tickets"
                style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);"
              >
                View Tickets in Web App &rarr;
              </a>
            </div>

            <div style="font-size: 12px; color: #64748b; margin-top: 24px; text-align: center; line-height: 1.5; border-top: 1px solid #1e293b; padding-top: 18px;">
              Please present this email with the QR code at the entrance turnstile for admission.<br />
              If you have any questions, visit SeatLock online or contact support.
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    if (!resend) {
      logger.info(`[Resend Mock] Confirmation email sent to ${toEmail} for order ${orderId}`);
      return;
    }

    const overrideEmail = process.env.RESEND_OVERRIDE_EMAIL;
    const recipient = overrideEmail || (toEmail.endsWith('@example.com') ? 'delivered@resend.dev' : toEmail);

    const attachments = tickets.map((t, index) => {
      const base64Data = t.qrDataUrl.replace(/^data:image\/png;base64,/, '');
      return {
        filename: `ticket-${index + 1}-${t.seatLabel.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
        content: Buffer.from(base64Data, 'base64'),
        contentType: 'image/png',
      };
    });

    const result = await resend.emails.send({
      from: 'SeatLock <onboarding@resend.dev>',
      to: recipient,
      subject: `Your Tickets for ${eventTitle} (Order #${orderId.slice(0, 8)})`,
      html,
      attachments,
    });

    if (result.error) {
      logger.error(`Resend API Error: ${result.error.message} (code: ${result.error.name})`);
    } else {
      logger.info(`Resend ticket confirmation email sent successfully to ${recipient} (id: ${result.data?.id})`);
    }
  } catch (err) {
    logger.error(err, `Failed to send Resend email to ${toEmail}`);
  }
}

