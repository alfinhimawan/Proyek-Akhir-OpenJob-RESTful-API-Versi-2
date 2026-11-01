import amqp from 'amqplib';
import config from './env.js';
import logger from '../utils/logger.js';

const SOCKET_TIMEOUT_MS = 3000;

let connection = null;
let channel = null;
let connectingPromise = null;

const resetState = () => {
  connection = null;
  channel = null;
};

/**
 * Membuka atau mengambil kembali channel RabbitMQ yang dipakai bersama.
 * @returns {Promise<import('amqplib').Channel>}
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

      const ch = await conn.createChannel();
      ch.on('error', (error) => {
        logger.warn({ err: error }, 'Channel RabbitMQ mengalami error');
      });
      ch.on('close', () => {
        channel = null;
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
