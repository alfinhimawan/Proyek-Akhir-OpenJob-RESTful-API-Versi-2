import nodemailer from 'nodemailer';
import config from '../config/env.js';
import transporter from '../config/mail.js';
import logger from '../utils/logger.js';

const escapeHtml = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatApplicationDate = (dateValue) => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const formatted = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'full',
    timeStyle: 'long',
    timeZone: 'Asia/Jakarta',
  }).format(date);
  return `${formatted} (${date.toISOString()})`;
};

export default class MailSender {
  /**
   * Mengirimkan email notifikasi lamaran baru khusus kepada pemilik lowongan (job owner).
   * @param {object} params
   * @param {string} params.recipientEmail
   * @param {string} params.recipientName
   * @param {string} params.applicantName
   * @param {string} params.applicantEmail
   * @param {Date | string} params.appliedAt
   * @param {string} params.jobTitle
   * @param {string} params.companyName
   * @returns {Promise<import('nodemailer').SentMessageInfo>}
   */
  async sendNewApplicationEmail({
    recipientEmail,
    recipientName,
    applicantName,
    applicantEmail,
    appliedAt,
    jobTitle,
    companyName,
  }) {
    const formattedDate = formatApplicationDate(appliedAt);
    const subject = `[OpenJob] Lamaran Baru untuk Posisi ${jobTitle} - ${companyName}`;

    const text = [
      `Halo ${recipientName},`,
      '',
      `Terdapat kandidat baru yang melamar pada lowongan pekerjaan "${jobTitle}" (${companyName}).`,
      '',
      'Rincian Pelamar:',
      `- Nama Pelamar    : ${applicantName}`,
      `- Email Pelamar   : ${applicantEmail}`,
      `- Tanggal Lamaran : ${formattedDate}`,
      '',
      'Silakan tinjau lamaran tersebut melalui layanan OpenJob.',
      '',
      'Salam,',
      'Tim OpenJob',
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2 style="color: #111827;">Notifikasi Lamaran Pekerjaan Baru</h2>
        <p>Halo <strong>${escapeHtml(recipientName)}</strong>,</p>
        <p>
          Terdapat kandidat baru yang melamar pada lowongan
          <strong>${escapeHtml(jobTitle)}</strong> di <strong>${escapeHtml(companyName)}</strong>.
        </p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 6px 12px 6px 0; font-weight: bold;">Nama Pelamar</td>
            <td style="padding: 6px 0;">: ${escapeHtml(applicantName)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px 6px 0; font-weight: bold;">Email Pelamar</td>
            <td style="padding: 6px 0;">: ${escapeHtml(applicantEmail)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px 6px 0; font-weight: bold;">Tanggal Lamaran</td>
            <td style="padding: 6px 0;">: ${escapeHtml(formattedDate)}</td>
          </tr>
        </table>
        <p>Silakan tinjau lamaran tersebut melalui layanan OpenJob.</p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: config.mail.sender,
      to: recipientEmail,
      subject,
      text,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    logger.info(
      {
        messageId: info.messageId,
        recipientEmail,
        previewUrl: previewUrl || undefined,
      },
      'Email notifikasi lamaran berhasil dikirim ke pemilik lowongan',
    );

    return info;
  }
}

export const mailSender = new MailSender();
