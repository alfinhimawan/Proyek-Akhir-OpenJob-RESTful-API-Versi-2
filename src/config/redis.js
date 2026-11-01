import { createClient } from 'redis';
import config from './env.js';
import logger from '../utils/logger.js';

const CONNECT_TIMEOUT_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 5000;

let client = null;
let connectPromise = null;

const createRedisInstance = () => {
  const instance = createClient({
    socket: {
      host: config.redis.host,
      port: config.redis.port,
      connectTimeout: CONNECT_TIMEOUT_MS,
      reconnectStrategy: (retries) => Math.min(retries * 250, MAX_RECONNECT_DELAY_MS),
    },
    password: config.redis.password,
    disableOfflineQueue: true,
  });

  instance.on('error', (error) => {
    logger.warn({ err: error }, 'Koneksi Redis mengalami gangguan');
  });

  return instance;
};

/**
 * Mengambil instance client Redis bersama dan memastikan koneksi siap dipakai.
 * @returns {Promise<import('redis').RedisClientType>}
 */
export const getRedisClient = async () => {
  if (!client) {
    client = createRedisInstance();
  }

  if (client.isReady) {
    return client;
  }

  if (!client.isOpen && !connectPromise) {
    connectPromise = client
      .connect()
      .catch((error) => {
        client = null;
        throw error;
      })
      .finally(() => {
        connectPromise = null;
      });
  }

  if (connectPromise) {
    await connectPromise;
  }

  if (!client || !client.isReady) {
    throw new Error('Redis client belum siap menerima perintah');
  }

  return client;
};

/**
 * Menutup koneksi Redis saat graceful shutdown.
 * @returns {Promise<void>}
 */
export const closeRedisClient = async () => {
  if (!client) {
    return;
  }

  const current = client;
  client = null;

  try {
    if (current.isOpen) {
      await current.quit();
    }
  } catch (error) {
    logger.warn(
      { err: error },
      'Gagal menutup koneksi Redis secara normal, memaksa disconnect',
    );
    current.destroy();
  }
};
