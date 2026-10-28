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

const resendApiKey = config.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

function escapeHtml(value: unknown): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]!);
}

export async function sendTicketConfirmationEmail(params: SendTicketsEmailParams) {
  const { toEmail, orderId, eventTitle, startsAt, venueName, tickets } = params;

  const viewTicketsUrl =
    config.CLIENT_TICKETS_URL ||
    'https://seat-lock.vercel.app/my-tickets';

  const formattedDate = new Date(startsAt).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const tierColors: Record<string, { bg: string; text: string; border: string }> = {
    VIP: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
    PREMIUM: { bg: '#e0e7ff', text: '#4338ca', border: '#c7d2fe' },
    STANDARD: { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' },
  };

  const ticketsHtml = tickets
    .map((t, index) => {
      const token = t.qrToken || t.ticketId;
      const qrContentId = `ticket-qr-${index}`;
      const tierStyle = tierColors[t.tier] || tierColors.STANDARD;

      return `
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 14px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04);">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="top" style="padding-right: 14px;">
                <div style="margin-bottom: 6px;">
                  <span style="background-color: ${tierStyle.bg}; color: ${tierStyle.text}; border: 1px solid ${tierStyle.border}; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 6px; letter-spacing: 0.5px; display: inline-block;">
                    ${escapeHtml(t.tier)}
                  </span>
                </div>
                <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
                  ${escapeHtml(t.seatLabel)}
                </div>
                <div style="font-size: 15px; font-weight: 700; color: #059669; margin-bottom: 10px;">
                  ₹${(t.priceCents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 11px; color: #334155; word-break: break-all;">
                  <span style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 3px;">Ticket Token:</span>
                  <span style="color: #4f46e5; font-weight: 600;">${escapeHtml(token)}</span>
                </div>
              </td>
              <td width="116" valign="top" align="center" style="width: 116px; min-width: 116px;">
                <div style="background-color: #ffffff; padding: 6px; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); display: inline-block;">
                  <img
                    src="cid:${qrContentId}"
                    width="104"
                    height="104"
                    alt="Ticket QR Code"
                    style="display: block; width: 104px; height: 104px; border: 0;"
                  />
                </div>
                <div style="font-size: 10px; font-weight: 600; color: #64748b; margin-top: 5px; text-align: center;">
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
      <body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Bar -->
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); padding: 26px 20px; text-align: center;">
            <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 20px; padding: 3px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #ffffff; margin-bottom: 8px;">
              Official Ticket Pass
            </div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
              Booking Confirmed!
            </h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #e0e7ff;">
              Order #${orderId.slice(0, 8)} &bull; Confirmed &amp; Issued
            </p>
          </div>

          <div style="padding: 24px 20px; background-color: #ffffff;">
            <!-- Event Summary Box -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 22px;">
              <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #0f172a; font-weight: 700;">
                ${escapeHtml(eventTitle)}
              </h2>
              <div style="font-size: 13px; color: #475569; margin-bottom: 6px; line-height: 1.4;">
                📍 <strong>Venue:</strong> ${escapeHtml(venueName)}
              </div>
              <div style="font-size: 13px; color: #475569; line-height: 1.4;">
                📅 <strong>Date:</strong> ${escapeHtml(formattedDate)}
              </div>
            </div>

            <!-- Tickets Section -->
            <div style="margin-bottom: 24px;">
              <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.6px;">
                Your Tickets (${tickets.length})
              </h3>
              ${ticketsHtml}
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 26px 0 10px 0;">
              <a
                href="${escapeHtml(viewTicketsUrl)}"
                style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.25);"
              >
                View Tickets in Web App &rarr;
              </a>
            </div>

            <div style="font-size: 12px; color: #64748b; margin-top: 24px; text-align: center; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 18px;">
              Please present this email with the QR code at the entrance turnstile for admission.<br />
              If you have any questions, access your tickets online or contact support.
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

    const overrideEmail = config.RESEND_OVERRIDE_EMAIL;
    const recipient = overrideEmail || (toEmail.endsWith('@example.com') ? 'delivered@resend.dev' : toEmail);
    const fromEmail =
      config.RESEND_TICKETS_FROM_EMAIL ||
      config.RESEND_FROM_EMAIL ||
      'SeatLock <security@ram02krishna.me>';

    // Embed locally generated QR images as inline email attachments. Sending tokens to an
    // external QR image URL would leak reusable admission credentials to a third party.
    const attachments = tickets.map((ticket, index) => ({
      filename: `ticket-${index + 1}.png`,
      content: ticket.qrDataUrl.replace(/^data:image\/png;base64,/, ''),
      contentType: 'image/png',
      contentId: `ticket-qr-${index}`,
    }));

    const result = await resend.emails.send({
      from: fromEmail,
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

export interface SendOtpEmailParams {
  toEmail: string;
  otp: string;
  purpose: 'signup' | 'reset';
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
  isSandboxRestriction?: boolean;
}

export async function sendOtpEmail(params: SendOtpEmailParams): Promise<SendEmailResult> {
  const { toEmail, otp, purpose } = params;
  const isReset = purpose === 'reset';
  const title = isReset ? 'Reset Your Password' : 'Verify Your Email';
  const subtitle = isReset
    ? 'Use the verification code below to reset your account password.'
    : 'Use the verification code below to complete your registration.';
  const subject = isReset
    ? `Password Reset Code: ${otp}`
    : `Your Verification Code: ${otp}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a; margin: 0; padding: 32px 16px;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Bar -->
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); padding: 26px 20px; text-align: center;">
            <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 20px; padding: 3px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #ffffff; margin-bottom: 8px;">
              Security Verification
            </div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
              ${title}
            </h1>
          </div>

          <div style="padding: 28px 24px; text-align: center; background-color: #ffffff;">
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.5;">
              ${subtitle}
            </p>

            <!-- OTP Code Badge -->
            <div style="margin: 16px 0 22px 0; padding: 16px 28px; background-color: #f8fafc; border: 2px dashed #6366f1; border-radius: 12px; display: inline-block;">
              <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #4338ca;">
                ${otp}
              </span>
            </div>

            <p style="margin: 0; font-size: 13px; color: #64748b;">
              This code will expire in <strong style="color: #0f172a;">10 minutes</strong>.
            </p>

            <div style="font-size: 12px; color: #94a3b8; margin-top: 26px; text-align: center; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 16px;">
              If you did not request this verification code, please ignore this email.<br />
              Never share this one-time code with anyone.
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  // OTPs are credentials; never write them to production logs. Local development can log them
  // because the API also deliberately exposes devOtp to the developer-only frontend flow.
  if (config.NODE_ENV !== 'production') {
    logger.info(`[Auth OTP] Verification code for ${toEmail} (${purpose}): ${otp}`);
  }

  if (!resend) {
    logger.info(`[Resend Mock] Resend API key not configured. Email delivery is disabled for ${toEmail}`);
    return { success: config.NODE_ENV !== 'production', error: 'Email delivery is not configured' };
  }

  try {
    const overrideEmail = config.RESEND_OVERRIDE_EMAIL;
    const recipient = overrideEmail || (toEmail.endsWith('@example.com') ? 'delivered@resend.dev' : toEmail);
    const fromEmail = config.RESEND_FROM_EMAIL || 'SeatLock <security@ram02krishna.me>';

    const result = await resend.emails.send({
      from: fromEmail,
      to: recipient,
      subject,
      html,
    });

    if (result.error) {
      const isSandboxRestriction =
        result.error.name === 'validation_error' &&
        result.error.message.includes('You can only send testing emails to your own email address');

      logger.error(`Resend OTP Error: ${result.error.message} (code: ${result.error.name})`);
      if (isSandboxRestriction) {
        logger.warn(
          `[Resend Notice] Resend sandbox restriction: Test accounts can only send emails to the registered Resend account owner. To send to any recipient, verify your domain at resend.com/domains and set RESEND_FROM_EMAIL.`
        );
      }
      return {
        success: false,
        error: result.error.message,
        isSandboxRestriction,
      };
    }

    logger.info(`Resend OTP email sent successfully to ${recipient} (id: ${result.data?.id})`);
    return { success: true };
  } catch (err: any) {
    logger.error(err, `Failed to send Resend OTP email to ${toEmail}`);
    return { success: false, error: err?.message || 'Failed to send verification email' };
  }
}
