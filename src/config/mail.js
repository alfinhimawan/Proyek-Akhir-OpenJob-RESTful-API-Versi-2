import nodemailer from 'nodemailer';
import config from './env.js';

const SECURE_SMTP_PORT = 465;

const transporter = nodemailer.createTransport({
  pool: true,
  maxConnections: 5,
  host: config.mail.host,
  port: config.mail.port,
  secure: config.mail.port === SECURE_SMTP_PORT,
  auth: {
    user: config.mail.user,
    pass: config.mail.password,
  },
});

/**
 * Menutup koneksi transporter SMTP saat proses consumer dihentikan.
 */
export const closeMailTransporter = () => {
  transporter.close();
};

export default transporter;
