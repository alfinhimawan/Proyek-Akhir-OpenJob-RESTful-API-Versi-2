import { createClient } from 'redis';
import config from './env.js';
import logger from '../utils/logger.js';

const CONNECT_TIMEOUT_MS = 1500;
const MAX_RECONNECT_RETRIES = 2;
const RETRY_COOLDOWN_MS = 5000;

let client = null;
let connectPromise = null;
let nextConnectAttemptAt = 0;

const createRedisInstance = () => {
  const instance = createClient({
    socket: {
      host: config.redis.host,
      port: config.redis.port,
      connectTimeout: CONNECT_TIMEOUT_MS,
      reconnectStrategy: (retries) => {
        if (retries >= MAX_RECONNECT_RETRIES) {
          return new Error('Redis tidak dapat dijangkau setelah batas percobaan');
        }
        return (retries + 1) * 200;
      },
    },
    password: config.redis.password,
    disableOfflineQueue: true,
  });

  instance.on('error', (error) => {
    logger.warn({ err: error }, 'Koneksi Redis mengalami gangguan');
  });

  instance.on('end', () => {
    if (client === instance) {
      client = null;
    }
  });

  return instance;
};

/**
 * Mengambil instance client Redis bersama dan memastikan koneksi siap dipakai.
 * Dilengkapi cooldown singkat saat Redis sedang mati agar fallback ke PostgreSQL instan.
 * @returns {Promise<import('redis').RedisClientType>}
 */
export const getRedisClient = async () => {
  if (client?.isReady) {
    return client;
  }

  if (Date.now() < nextConnectAttemptAt) {
    throw new Error('Redis sedang dalam masa cooldown pemulihan koneksi');
  }

  if (!client) {
    client = createRedisInstance();
  }

  if (!client.isOpen && !connectPromise) {
    const targetClient = client;
    connectPromise = targetClient
      .connect()
      .catch((error) => {
        nextConnectAttemptAt = Date.now() + RETRY_COOLDOWN_MS;
        targetClient.destroy();
        if (client === targetClient) {
          client = null;
        }
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
    if (current.isReady) {
      await current.quit();
    } else {
      current.destroy();
    }
  } catch (error) {
    logger.warn(
      { err: error },
      'Gagal menutup koneksi Redis secara normal, memaksa disconnect',
    );
    current.destroy();
  }
};
