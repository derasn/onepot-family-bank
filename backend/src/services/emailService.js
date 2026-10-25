const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

let transporter = null;

// Initialize Nodemailer transporter if SMTP credentials are provided
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.SMTP_PORT || '2525', 10),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

/**
 * Send an email notification (or log simulation if SMTP is not configured)
 */
async function sendEmail({ to, subject, html, text }) {
  const from = process.env.SMTP_FROM || '"OnePot Family Bank" <no-reply@onepot.local>';

  if (!transporter) {
    console.log(`[Email Simulated] To: ${to} | Subject: "${subject}" | Content: ${text || html?.replace(/<[^>]*>?/gm, '')}`);
    return { simulated: true, success: true };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html
    });
    console.log(`[Email Sent] MessageId: ${info.messageId} to ${to}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Email Failed] To: ${to}:`, error.message);
    // Non-blocking failure
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendEmail
};

