const nodemailer = require('nodemailer');

let cachedTransporter = null;

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT || 0);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !port || !user || !pass) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // common SMTPS port
    auth: { user, pass },
  });

  return cachedTransporter;
};

const sendEmail = async (options) => {
  // Feature flag: allow disabling emails without breaking flows
  const enabled = String(process.env.EMAIL_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) return;

  // Create a transporter
  const transporter = getTransporter();
  if (!transporter) {
    // Don't throw — email should be best-effort
    console.warn('Email transporter not configured (missing EMAIL_HOST/EMAIL_PORT/EMAIL_USER/EMAIL_PASS). Skipping email.');
    return;
  }

  // Define email options
  const fromName = process.env.EMAIL_FROM_NAME || 'Ruvia';
  const fromEmail = process.env.EMAIL_FROM_EMAIL || 'noreply@ruvia.com';
  const mailOptions = {
    from: `${fromName} <${fromEmail}>`,
    replyTo: process.env.EMAIL_REPLY_TO || undefined,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html, // Optional HTML version
  };

  // Send the email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
