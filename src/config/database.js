import pg from 'pg';
import config from './env.js';
import logger from '../utils/logger.js';

const pool = new pg.Pool(config.postgres);

pool.on('error', (error) => {
  logger.error({ err: error }, 'Unexpected error pada idle client PostgreSQL');
});

/**
 * Menjalankan beberapa query dalam satu transaksi.
 * `callback` menerima client; COMMIT bila sukses, ROLLBACK bila melempar error.
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} callback
 * @returns {Promise<T>}
 */
export const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Menutup pool koneksi PostgreSQL secara aman saat proses berhenti.
 * @returns {Promise<void>}
 */
export const closeDatabasePool = async () => {
  await pool.end();
};

export default pool;
