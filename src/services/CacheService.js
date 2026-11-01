import { CACHE_TTL_SECONDS } from '../config/env.js';
import { getRedisClient } from '../config/redis.js';
import logger from '../utils/logger.js';

export default class CacheService {
  /**
   * Mengambil nilai mentah (string) dari Redis berdasarkan key.
   * Mengembalikan null jika cache miss atau jika Redis sedang bermasalah.
   * @param {string} key
   * @returns {Promise<string | null>}
   */
  async get(key) {
    try {
      const client = await getRedisClient();
      return await client.get(key);
    } catch (error) {
      logger.warn({ err: error, key }, 'Gagal membaca cache Redis, fallback ke database');
      return null;
    }
  }

  /**
   * Mengambil dan mengurai nilai JSON dari Redis berdasarkan key.
   * @template T
   * @param {string} key
   * @returns {Promise<T | null>}
   */
  async getJson(key) {
    const raw = await this.get(key);
    if (raw === null) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      logger.warn(
        { err: error, key },
        'Nilai JSON pada cache tidak valid, menghapus key',
      );
      await this.delete(key);
      return null;
    }
  }

  /**
   * Menyimpan nilai string ke Redis dengan masa berlaku (TTL) tertentu.
   * @param {string} key
   * @param {string} value
   * @param {number} [expirationInSecond=CACHE_TTL_SECONDS]
   * @returns {Promise<void>}
   */
  async set(key, value, expirationInSecond = CACHE_TTL_SECONDS) {
    try {
      const client = await getRedisClient();
      await client.set(key, value, { EX: expirationInSecond });
    } catch (error) {
      logger.warn({ err: error, key }, 'Gagal menyimpan data ke cache Redis');
    }
  }

  /**
   * Menyimpan objek sebagai JSON ke Redis dengan masa berlaku (TTL) tertentu.
   * @param {string} key
   * @param {unknown} value
   * @param {number} [expirationInSecond=CACHE_TTL_SECONDS]
   * @returns {Promise<void>}
   */
  async setJson(key, value, expirationInSecond = CACHE_TTL_SECONDS) {
    await this.set(key, JSON.stringify(value), expirationInSecond);
  }

  /**
   * Menghapus satu atau beberapa key dari Redis (invalidasi cache).
   * @param {string | string[]} keys
   * @returns {Promise<void>}
   */
  async delete(keys) {
    const keyList = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
    if (!keyList.length) {
      return;
    }

    try {
      const client = await getRedisClient();
      await client.del(keyList);
    } catch (error) {
      logger.warn({ err: error, keys: keyList }, 'Gagal menghapus key pada cache Redis');
    }
  }
}

export const cacheService = new CacheService();
