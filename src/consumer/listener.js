import {
  APPLICATION_DLQ_NAME,
  CONSUMER_MAX_RETRIES,
  CONSUMER_RETRY_DELAY_MS,
} from '../config/env.js';
import { getNotificationDetailsByApplicationId } from '../services/applicationsService.js';
import { mailSender } from '../services/MailSender.js';
import logger from '../utils/logger.js';

const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const parseApplicationMessage = (rawContent) => {
  try {
    const parsed = JSON.parse(rawContent);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.application_id !== 'string' ||
      !parsed.application_id.trim()
    ) {
      return null;
    }
    return parsed.application_id.trim();
  } catch {
    return null;
  }
};

const executeWithRetry = async (operation, context) => {
  let lastError;

  for (let attempt = 1; attempt <= CONSUMER_MAX_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      logger.warn(
        { err: error, attempt, maxRetries: CONSUMER_MAX_RETRIES, ...context },
        'Percobaan pemrosesan gagal, menjadwalkan ulang secara terbatas',
      );
      if (attempt < CONSUMER_MAX_RETRIES) {
        await delay(CONSUMER_RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError;
};

/**
 * Membuat fungsi listener pesan RabbitMQ untuk memproses notifikasi lamaran pekerjaan.
 * Pesan tidak valid (poison message) atau yang tetap gagal setelah batas retry maksimum
 * akan di-nack (`requeue = false`) sehingga otomatis dialihkan oleh RabbitMQ ke Dead Letter Queue (DLQ).
 * @param {import('amqplib').Channel} channel
 */
export const createApplicationMessageListener = (channel) => async (message) => {
  if (!message) {
    return;
  }

  const rawContent = message.content.toString('utf8');
  const applicationId = parseApplicationMessage(rawContent);

  if (!applicationId) {
    logger.error(
      { rawContent, dlq: APPLICATION_DLQ_NAME },
      'Poison message terdeteksi (format tidak valid / tanpa application_id), dialihkan ke DLQ',
    );
    channel.nack(message, false, false);
    return;
  }

  try {
    const details = await executeWithRetry(
      () => getNotificationDetailsByApplicationId(applicationId),
      { applicationId, stage: 'fetch-db' },
    );

    if (!details) {
      logger.warn(
        { applicationId },
        'Data lamaran tidak ditemukan di database (kemungkinan telah dihapus), pesan di-ack',
      );
      channel.ack(message);
      return;
    }

    if (!details.job_owner_email) {
      logger.warn(
        { applicationId, jobId: details.job_id },
        'Pemilik lowongan tidak memiliki alamat email terdaftar, notifikasi dilewati',
      );
      channel.ack(message);
      return;
    }

    await executeWithRetry(
      () =>
        mailSender.sendNewApplicationEmail({
          recipientEmail: details.job_owner_email,
          recipientName: details.job_owner_name || 'Pemilik Lowongan',
          applicantName: details.applicant_name,
          applicantEmail: details.applicant_email,
          appliedAt: details.applied_at,
          jobTitle: details.job_title,
          companyName: details.company_name,
        }),
      { applicationId, stage: 'send-mail' },
    );

    channel.ack(message);
  } catch (error) {
    logger.error(
      {
        err: error,
        applicationId,
        maxRetries: CONSUMER_MAX_RETRIES,
        dlq: APPLICATION_DLQ_NAME,
      },
      'Gagal memproses notifikasi lamaran setelah batas retry maksimum, pesan dialihkan ke DLQ',
    );
    channel.nack(message, false, false);
  }
};
