import amqp from 'amqplib';
import config, {
  APPLICATION_DLQ_NAME,
  APPLICATION_DLQ_ROUTING_KEY,
  APPLICATION_DLX_NAME,
  APPLICATION_QUEUE_NAME,
} from './env.js';
import logger from '../utils/logger.js';

const SOCKET_TIMEOUT_MS = 3000;
const AMQP_PRECONDITION_FAILED = 406;

let connection = null;
let channel = null;
let connectingPromise = null;
let isTopologyAsserted = false;

const resetState = () => {
  connection = null;
  channel = null;
  isTopologyAsserted = false;
};

/**
 * Membuka atau mengambil kembali ConfirmChannel RabbitMQ yang dipakai bersama.
 * @returns {Promise<import('amqplib').ConfirmChannel>}
 */
export const getRabbitChannel = async () => {
  if (channel) {
    return channel;
  }

  if (!connectingPromise) {
    connectingPromise = (async () => {
      const conn = await amqp.connect(config.rabbitmq.url, {
        timeout: SOCKET_TIMEOUT_MS,
      });

      conn.on('error', (error) => {
        logger.warn({ err: error }, 'Koneksi RabbitMQ mengalami error');
      });

      conn.on('close', () => {
        logger.warn('Koneksi RabbitMQ tertutup');
        resetState();
      });

      const ch = await conn.createConfirmChannel();
      ch.on('error', (error) => {
        logger.warn({ err: error }, 'Channel RabbitMQ mengalami error');
      });
      ch.on('close', () => {
        channel = null;
        isTopologyAsserted = false;
      });

      connection = conn;
      channel = ch;
      return ch;
    })()
      .catch((error) => {
        resetState();
        throw error;
      })
      .finally(() => {
        connectingPromise = null;
      });
  }

  return connectingPromise;
};

const declareTopologyOnChannel = async (activeChannel) => {
  await activeChannel.assertExchange(APPLICATION_DLX_NAME, 'direct', { durable: true });
  await activeChannel.assertQueue(APPLICATION_DLQ_NAME, { durable: true });
  await activeChannel.bindQueue(
    APPLICATION_DLQ_NAME,
    APPLICATION_DLX_NAME,
    APPLICATION_DLQ_ROUTING_KEY,
  );
  await activeChannel.assertQueue(APPLICATION_QUEUE_NAME, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': APPLICATION_DLX_NAME,
      'x-dead-letter-routing-key': APPLICATION_DLQ_ROUTING_KEY,
    },
  });
};

/**
 * Memastikan topologi antrean lamaran (utama + Dead Letter Exchange + Dead Letter Queue)
 * telah tersedia secara konsisten baik dari sisi producer maupun consumer.
 * @returns {Promise<import('amqplib').ConfirmChannel>}
 */
export const ensureApplicationMessagingTopology = async () => {
  const activeChannel = await getRabbitChannel();
  if (isTopologyAsserted) {
    return activeChannel;
  }

  try {
    await declareTopologyOnChannel(activeChannel);
    isTopologyAsserted = true;
    return activeChannel;
  } catch (error) {
    if (error?.code === AMQP_PRECONDITION_FAILED) {
      logger.warn(
        { queue: APPLICATION_QUEUE_NAME },
        'Queue lama tanpa argumen DLX terdeteksi; memperbarui topologi queue kosong secara aman',
      );
      const freshChannel = await getRabbitChannel();
      await freshChannel.deleteQueue(APPLICATION_QUEUE_NAME, {
        ifEmpty: true,
        ifUnused: true,
      });
      await declareTopologyOnChannel(freshChannel);
      isTopologyAsserted = true;
      return freshChannel;
    }
    throw error;
  }
};

/**
 * Menutup channel dan koneksi RabbitMQ secara aman saat aplikasi berhenti.
 * @returns {Promise<void>}
 */
export const closeRabbitConnection = async () => {
  const currentChannel = channel;
  const currentConnection = connection;
  resetState();

  try {
    if (currentChannel) {
      await currentChannel.close();
    }
  } catch (error) {
    logger.warn({ err: error }, 'Gagal menutup channel RabbitMQ');
  }

  try {
    if (currentConnection) {
      await currentConnection.close();
    }
  } catch (error) {
    logger.warn({ err: error }, 'Gagal menutup koneksi RabbitMQ');
  }
};
