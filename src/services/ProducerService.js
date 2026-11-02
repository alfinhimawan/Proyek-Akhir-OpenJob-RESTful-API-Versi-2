import { APPLICATION_QUEUE_NAME } from '../config/env.js';
import {
  ensureApplicationMessagingTopology,
  getRabbitChannel,
} from '../config/rabbitmq.js';
import logger from '../utils/logger.js';

export default class ProducerService {
  /**
   * Mengirim pesan ke queue RabbitMQ dengan sifat durable, persistent,
   * serta menunggu konfirmasi broker (publisher confirm).
   * @param {string} queue
   * @param {Record<string, unknown>} payload
   * @param {{ messageId?: string }} [options]
   * @returns {Promise<void>}
   */
  async sendMessage(queue, payload, options = {}) {
    const channel =
      queue === APPLICATION_QUEUE_NAME
        ? await ensureApplicationMessagingTopology()
        : await getRabbitChannel();

    if (queue !== APPLICATION_QUEUE_NAME) {
      await channel.assertQueue(queue, { durable: true });
    }

    const messageBuffer = Buffer.from(JSON.stringify(payload));

    await new Promise((resolve, reject) => {
      channel.sendToQueue(
        queue,
        messageBuffer,
        {
          persistent: true,
          contentType: 'application/json',
          messageId: options.messageId,
          timestamp: Date.now(),
        },
        (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        },
      );
    });
  }

  /**
   * Mengirim event pembuatan lamaran baru yang hanya berisi `application_id`.
   * @param {string} applicationId
   * @param {{ messageId?: string }} [options]
   * @returns {Promise<void>}
   */
  async sendApplicationCreated(applicationId, options = {}) {
    await this.sendMessage(
      APPLICATION_QUEUE_NAME,
      { application_id: applicationId },
      options,
    );
    logger.info(
      { queue: APPLICATION_QUEUE_NAME, applicationId, messageId: options.messageId },
      'Pesan lamaran baru berhasil dikirim ke RabbitMQ',
    );
  }
}

export const producerService = new ProducerService();
