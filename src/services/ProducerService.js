import { APPLICATION_QUEUE_NAME } from '../config/env.js';
import { getRabbitChannel } from '../config/rabbitmq.js';
import logger from '../utils/logger.js';

export default class ProducerService {
  /**
   * Mengirim pesan ke queue RabbitMQ dengan sifat durable & persistent.
   * @param {string} queue
   * @param {Record<string, unknown>} payload
   * @returns {Promise<void>}
   */
  async sendMessage(queue, payload) {
    const channel = await getRabbitChannel();
    await channel.assertQueue(queue, { durable: true });

    const messageBuffer = Buffer.from(JSON.stringify(payload));
    channel.sendToQueue(queue, messageBuffer, {
      persistent: true,
      contentType: 'application/json',
    });
  }

  /**
   * Mengirim event pembuatan lamaran baru yang hanya berisi `application_id`.
   * Bila broker sedang gangguan, error dicatat ke log agar lamaran yang sudah commit tetap tersimpan.
   * @param {string} applicationId
   * @returns {Promise<void>}
   */
  async sendApplicationCreated(applicationId) {
    try {
      await this.sendMessage(APPLICATION_QUEUE_NAME, {
        application_id: applicationId,
      });
      logger.info(
        { queue: APPLICATION_QUEUE_NAME, applicationId },
        'Pesan lamaran baru berhasil dikirim ke RabbitMQ',
      );
    } catch (error) {
      logger.error(
        { err: error, queue: APPLICATION_QUEUE_NAME, applicationId },
        'Gagal mengirim pesan ke RabbitMQ; lamaran tetap tersimpan di database',
      );
    }
  }
}

export const producerService = new ProducerService();
