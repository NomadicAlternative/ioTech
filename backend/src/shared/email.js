'use strict';

const nodemailer = require('nodemailer');
const logger = require('./logger');

let transporter = null;
let resendClient = null;

/**
 * Initialize Resend if API key is configured (preferred).
 * Falls back to SMTP via nodemailer.
 */
function getResend() {
  if (resendClient !== null) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const { Resend } = require('resend');
      resendClient = new Resend(apiKey);
      logger.info('[email] Resend configured');
      return resendClient;
    } catch {
      logger.warn('[email] Resend SDK not available, falling back to SMTP');
      resendClient = false;
      return null;
    }
  }
  resendClient = false;
  return null;
}

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && port && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: port === '465',
      auth: { user, pass },
    });
    logger.info('[email] SMTP transporter configured');
  } else {
    logger.warn('[email] No email provider configured — emails will be logged to console only');
    transporter = null;
  }

  return transporter;
}

/**
 * Send a password recovery email.
 *
 * Priority: Resend API > SMTP > console log (dev fallback)
 *
 * @param {string} to - Recipient email
 * @param {string} newPassword - The newly generated password
 * @returns {Promise<void>}
 */
async function sendPasswordReset(to, newPassword) {
  const from = process.env.SMTP_FROM || 'noreply@iotech.io';
  const subject = 'ioTech — Nueva contraseña';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #01295F;">ioTech</h2>
      <p>Se ha generado una nueva contraseña para tu cuenta:</p>
      <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <code style="font-size: 18px; font-weight: bold; letter-spacing: 1px;">${newPassword}</code>
      </div>
      <p>Usa esta contraseña para iniciar sesión. Te recomendamos cambiarla desde Configuración una vez que ingreses.</p>
      <p style="color: #71717a; font-size: 12px; margin-top: 24px;">
        Si no solicitaste este cambio, puedes ignorar este mensaje.
      </p>
    </div>
  `;

  // 1. Try Resend first
  const resend = getResend();
  if (resend) {
    try {
      await resend.emails.send({ from, to, subject, html });
      logger.info(`[email] Password reset sent to ${to} via Resend`);
      return;
    } catch (err) {
      logger.error(`[email] Resend failed: ${err.message}. Falling back.`);
    }
  }

  // 2. Try SMTP
  const transport = getTransporter();
  if (transport) {
    await transport.sendMail({ from, to, subject, html });
    logger.info(`[email] Password reset sent to ${to} via SMTP`);
    return;
  }

  // 3. Dev fallback
  logger.info(`[email] DEV — PASSWORD RESET for ${to}: "${newPassword}"`);
}

module.exports = { sendPasswordReset };
